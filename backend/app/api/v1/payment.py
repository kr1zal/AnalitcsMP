"""
Payment endpoints (YooKassa):
- POST /subscription/upgrade   - создать платёж, получить URL для оплаты
- POST /subscription/webhook   - webhook от ЮКассы (без auth, проверка IP)
- POST /subscription/cancel    - отменить автопродление
"""
import asyncio
import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from ...auth import CurrentUser, get_current_user
from ...db.supabase import get_supabase_client
from ...plans import PLANS, get_plan, get_next_sync_utc
from ...services.payment_service import (
    create_payment,
    get_payment,
    verify_webhook_ip,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ─── Модели запросов ───

class UpgradeRequest(BaseModel):
    plan: str  # "pro" или "business"


# ─── POST /subscription/upgrade ───

@router.post("/subscription/upgrade")
async def upgrade_subscription(
    body: UpgradeRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Создаёт платёж в ЮКассе и возвращает URL для оплаты."""
    plan = body.plan

    # Валидация плана
    if plan not in PLANS:
        raise HTTPException(status_code=400, detail=f"Неизвестный тариф: {plan}")

    plan_config = PLANS[plan]
    if plan_config["price_rub"] == 0:
        raise HTTPException(status_code=400, detail="Нельзя оплатить бесплатный тариф")

    # Проверяем текущий план пользователя
    supabase = get_supabase_client()
    sub_row = (
        supabase.table("mp_user_subscriptions")
        .select("plan, status")
        .eq("user_id", current_user.id)
        .limit(1)
        .execute()
    )
    if sub_row.data and sub_row.data[0].get("plan") == plan and sub_row.data[0].get("status") == "active":
        raise HTTPException(status_code=400, detail=f"Вы уже на тарифе {plan_config['name']}")

    # Создаём платёж в ЮКассе
    try:
        payment_data = await create_payment(current_user.id, plan)
    except Exception as e:
        logger.error(f"Payment creation failed for user {current_user.id}: {e}")
        raise HTTPException(status_code=502, detail="Ошибка создания платежа")

    # Сохраняем запись о платеже в mp_payments
    supabase.table("mp_payments").insert({
        "user_id": current_user.id,
        "yookassa_payment_id": payment_data["id"],
        "amount": float(payment_data["amount"]["value"]),
        "currency": payment_data["amount"]["currency"],
        "status": "pending",
        "plan": plan,
        "description": payment_data.get("description", ""),
        "metadata": payment_data.get("metadata", {}),
    }).execute()

    confirmation_url = payment_data.get("confirmation", {}).get("confirmation_url")
    if not confirmation_url:
        raise HTTPException(status_code=502, detail="ЮКасса не вернула URL для оплаты")

    return {"confirmation_url": confirmation_url}


# ─── POST /subscription/webhook ───

@router.post("/subscription/webhook")
async def payment_webhook(request: Request):
    """
    Webhook от ЮКассы. Без JWT auth — проверяем IP отправителя.
    Обрабатывает events: payment.succeeded, payment.canceled.
    """
    # Проверяем IP (Nginx передаёт через X-Forwarded-For / X-Real-IP)
    client_ip = (
        request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        or request.headers.get("x-real-ip", "")
        or (request.client.host if request.client else "")
    )

    if not verify_webhook_ip(client_ip):
        logger.warning(f"Webhook from untrusted IP: {client_ip}")
        raise HTTPException(status_code=403, detail="Forbidden")

    # Парсим тело
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    event_type = body.get("event")
    payment_obj = body.get("object", {})
    yookassa_payment_id = payment_obj.get("id")

    if not yookassa_payment_id:
        raise HTTPException(status_code=400, detail="Missing payment id")

    logger.info(f"Webhook received: {event_type} for payment {yookassa_payment_id}")

    supabase = get_supabase_client()

    # Находим наш платёж
    mp_payment = (
        supabase.table("mp_payments")
        .select("*")
        .eq("yookassa_payment_id", yookassa_payment_id)
        .limit(1)
        .execute()
    )

    if not mp_payment.data:
        logger.warning(f"Webhook for unknown payment: {yookassa_payment_id}")
        return {"status": "ignored", "reason": "unknown_payment"}

    payment_record = mp_payment.data[0]

    # Idempotency: если уже обработан — пропускаем
    if payment_record["status"] != "pending":
        logger.info(f"Payment {yookassa_payment_id} already processed: {payment_record['status']}")
        return {"status": "already_processed"}

    # Двойная верификация: запрашиваем статус напрямую у ЮКассы
    try:
        verified = await get_payment(yookassa_payment_id)
        verified_status = verified.get("status")
    except Exception as e:
        logger.error(f"Failed to verify payment {yookassa_payment_id}: {e}")
        verified_status = payment_obj.get("status")

    if event_type == "payment.succeeded" and verified_status == "succeeded":
        await _handle_payment_succeeded(supabase, payment_record, payment_obj)
    elif event_type == "payment.canceled" and verified_status in ("canceled", "cancelled"):
        _handle_payment_canceled(supabase, payment_record)
    else:
        logger.info(f"Webhook event {event_type} (verified: {verified_status}) — no action")

    return {"status": "ok"}


async def _handle_payment_succeeded(supabase, payment_record: dict, payment_obj: dict):
    """Обработка успешного платежа: активация подписки."""
    user_id = payment_record["user_id"]
    plan = payment_record["plan"]
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=30)

    # Извлекаем payment_method_id (для автоплатежей в будущем)
    pm = payment_obj.get("payment_method", {})
    payment_method_id = pm.get("id") if pm.get("saved") else None

    # Обновляем mp_payments
    supabase.table("mp_payments").update({
        "status": "succeeded",
        "payment_method_id": payment_method_id,
        "updated_at": now.isoformat(),
    }).eq("id", payment_record["id"]).execute()

    # Обновляем подписку
    sub_update = {
        "user_id": user_id,
        "plan": plan,
        "status": "active",
        "changed_by": "yookassa",
        "updated_at": now.isoformat(),
    }
    # expires_at и payment_method_id — только если колонки существуют (после миграции 012)
    sub_update["expires_at"] = expires_at.isoformat()
    if payment_method_id:
        sub_update["payment_method_id"] = payment_method_id
    sub_update["auto_renew"] = True

    supabase.table("mp_user_subscriptions").upsert(
        sub_update, on_conflict="user_id"
    ).execute()

    # Обновляем sync queue (как в change_user_plan)
    new_plan = get_plan(plan)
    next_sync = get_next_sync_utc(plan)
    supabase.table("mp_sync_queue").upsert({
        "user_id": user_id,
        "next_sync_at": next_sync.isoformat(),
        "priority": new_plan.get("sync_priority", 2),
        "status": "pending",
        "updated_at": now.isoformat(),
    }, on_conflict="user_id").execute()

    logger.info(f"Subscription activated: user={user_id}, plan={plan}, expires={expires_at}")

    # Auto sync_products — пересканировать товары с новым лимитом SKU
    # Проверяем что sync не запущен (защита от дупликации товаров)
    async def _trigger_sync(uid: str):
        try:
            sq = supabase.table("mp_sync_queue").select("status").eq("user_id", uid).limit(1).execute()
            if sq.data and sq.data[0].get("status") == "running":
                logger.info(f"Sync already running for {uid}, skipping auto-sync after upgrade")
                return
            from ...services.sync_service import SyncService
            svc = SyncService(user_id=uid)
            result = await svc.sync_products()
            logger.info(f"Auto sync_products after upgrade: user={uid}, result={result}")
        except Exception as e:
            logger.warning(f"Auto sync_products after upgrade failed: user={uid}, {e}")

    asyncio.create_task(_trigger_sync(user_id))


def _handle_payment_canceled(supabase, payment_record: dict):
    """Обработка отменённого платежа."""
    supabase.table("mp_payments").update({
        "status": "canceled",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", payment_record["id"]).execute()

    logger.info(f"Payment canceled: {payment_record['yookassa_payment_id']}")


# ─── POST /subscription/cancel ───

@router.post("/subscription/cancel")
async def cancel_auto_renewal(
    current_user: CurrentUser = Depends(get_current_user),
):
    """Отменяет автопродление подписки (auto_renew = false)."""
    supabase = get_supabase_client()

    result = (
        supabase.table("mp_user_subscriptions")
        .select("plan, status")
        .eq("user_id", current_user.id)
        .limit(1)
        .execute()
    )

    if not result.data or result.data[0].get("plan") == "free":
        raise HTTPException(status_code=400, detail="Нечего отменять — вы на бесплатном тарифе")

    supabase.table("mp_user_subscriptions").update({
        "auto_renew": False,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("user_id", current_user.id).execute()

    logger.info(f"Auto-renewal disabled for user {current_user.id}")
    return {"status": "auto_renew_disabled"}


# ─── POST /subscription/enable-auto-renew ───

@router.post("/subscription/enable-auto-renew")
async def enable_auto_renewal(
    current_user: CurrentUser = Depends(get_current_user),
):
    """Включает автопродление подписки (auto_renew = true)."""
    supabase = get_supabase_client()

    result = (
        supabase.table("mp_user_subscriptions")
        .select("plan, status")
        .eq("user_id", current_user.id)
        .limit(1)
        .execute()
    )

    if not result.data or result.data[0].get("plan") == "free":
        raise HTTPException(status_code=400, detail="Нечего включать — вы на бесплатном тарифе")

    supabase.table("mp_user_subscriptions").update({
        "auto_renew": True,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("user_id", current_user.id).execute()

    logger.info(f"Auto-renewal enabled for user {current_user.id}")
    return {"status": "auto_renew_enabled"}
