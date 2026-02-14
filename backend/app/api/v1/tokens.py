"""
API-токены маркетплейсов: CRUD + валидация.
Токены шифруются Fernet перед сохранением в БД.
"""
import logging
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel

from ...auth import CurrentUser, get_current_user
from ...db.supabase import get_supabase_client
from ...crypto import encrypt_token

logger = logging.getLogger(__name__)

router = APIRouter()


class TokensInput(BaseModel):
    wb_api_token: Optional[str] = None
    ozon_client_id: Optional[str] = None
    ozon_api_key: Optional[str] = None
    ozon_perf_client_id: Optional[str] = None
    ozon_perf_secret: Optional[str] = None


class TokensStatusResponse(BaseModel):
    has_wb: bool
    has_ozon_seller: bool
    has_ozon_perf: bool


# ──────────── GET /tokens ────────────

@router.get("/tokens", response_model=TokensStatusResponse)
async def get_tokens_status(
    current_user: CurrentUser = Depends(get_current_user),
):
    """Какие токены заполнены (без значений)."""
    supabase = get_supabase_client()
    result = (
        supabase.table("mp_user_tokens")
        .select("wb_api_token, ozon_client_id, ozon_api_key, ozon_perf_client_id, ozon_perf_secret")
        .eq("user_id", current_user.id)
        .limit(1)
        .execute()
    )
    if not result.data:
        return TokensStatusResponse(has_wb=False, has_ozon_seller=False, has_ozon_perf=False)

    row = result.data[0]
    return TokensStatusResponse(
        has_wb=bool(row.get("wb_api_token")),
        has_ozon_seller=bool(row.get("ozon_client_id") and row.get("ozon_api_key")),
        has_ozon_perf=bool(row.get("ozon_perf_client_id") and row.get("ozon_perf_secret")),
    )


# ──────────── PUT /tokens ────────────

@router.put("/tokens")
async def save_tokens(
    body: TokensInput,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Сохранить/обновить токены (шифруем перед записью)."""
    supabase = get_supabase_client()

    data: dict = {"user_id": current_user.id}
    if body.wb_api_token is not None:
        data["wb_api_token"] = encrypt_token(body.wb_api_token) if body.wb_api_token else None
    if body.ozon_client_id is not None:
        data["ozon_client_id"] = encrypt_token(body.ozon_client_id) if body.ozon_client_id else None
    if body.ozon_api_key is not None:
        data["ozon_api_key"] = encrypt_token(body.ozon_api_key) if body.ozon_api_key else None
    if body.ozon_perf_client_id is not None:
        data["ozon_perf_client_id"] = encrypt_token(body.ozon_perf_client_id) if body.ozon_perf_client_id else None
    if body.ozon_perf_secret is not None:
        data["ozon_perf_secret"] = encrypt_token(body.ozon_perf_secret) if body.ozon_perf_secret else None

    supabase.table("mp_user_tokens").upsert(data, on_conflict="user_id").execute()
    return {"status": "saved"}


# ──────────── POST /tokens/validate ────────────

@router.post("/tokens/validate")
async def validate_tokens(
    body: TokensInput,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Проверить токены лёгкими API-запросами к маркетплейсам."""
    from ...services.wb_client import WildberriesClient
    from ...services.ozon_client import OzonClient, OzonPerformanceClient

    results = {}

    # WB
    if body.wb_api_token:
        try:
            wb = WildberriesClient(body.wb_api_token)
            await wb.get_cards_by_barcode(["0000000000000"])
            results["wb"] = {"valid": True}
        except Exception as e:
            err = str(e)[:200]
            # 404 = токен рабочий, просто товар не найден
            if "404" in err or "Not Found" in err:
                results["wb"] = {"valid": True}
            else:
                results["wb"] = {"valid": False, "error": err}

    # Ozon Seller
    if body.ozon_client_id and body.ozon_api_key:
        try:
            ozon = OzonClient(body.ozon_client_id, body.ozon_api_key)
            await ozon.get_product_list(limit=1)
            results["ozon_seller"] = {"valid": True}
        except Exception as e:
            results["ozon_seller"] = {"valid": False, "error": str(e)[:200]}

    # Ozon Performance
    if body.ozon_perf_client_id and body.ozon_perf_secret:
        try:
            perf = OzonPerformanceClient(body.ozon_perf_client_id, body.ozon_perf_secret)
            await perf.get_campaigns()
            results["ozon_perf"] = {"valid": True}
        except Exception as e:
            results["ozon_perf"] = {"valid": False, "error": str(e)[:200]}

    return {"results": results}


# ──────────── POST /tokens/save-and-sync ────────────

@router.post("/tokens/save-and-sync")
async def save_tokens_and_sync(
    body: TokensInput,
    background_tasks: BackgroundTasks,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Сохранить токены и запустить синхронизацию в фоне."""
    from datetime import datetime, timezone

    # 1. Сохраняем токены
    await save_tokens(body, current_user)

    # 2. Создаём "running" запись ДО фоновой задачи — is_syncing сразу true
    supabase = get_supabase_client()
    now_iso = datetime.now(timezone.utc).isoformat()
    log_result = supabase.table("mp_sync_log").insert({
        "marketplace": "all",
        "sync_type": "all",
        "status": "running",
        "records_count": 0,
        "error_message": None,
        "started_at": now_iso,
        "finished_at": None,
        "user_id": current_user.id,
        "trigger": "manual",
    }).execute()
    log_id = log_result.data[0]["id"] if log_result.data else None

    # 3. Синхронизацию запускаем в фоне — не блокируем ответ
    async def _run_sync() -> None:
        from ...services.sync_service import SyncService
        try:
            sync_svc = SyncService(user_id=current_user.id)
            result = await sync_svc.sync_all(days_back=30)
            success_count = result.get("success_count", 0)
            # Закрываем master-лог
            if log_id:
                supabase.table("mp_sync_log").update({
                    "status": "success",
                    "records_count": success_count,
                    "finished_at": datetime.now(timezone.utc).isoformat(),
                }).eq("id", log_id).execute()
            logger.info(f"Background sync completed for user {current_user.id}")
        except Exception as e:
            if log_id:
                supabase.table("mp_sync_log").update({
                    "status": "error",
                    "error_message": str(e)[:500],
                    "finished_at": datetime.now(timezone.utc).isoformat(),
                }).eq("id", log_id).execute()
            logger.error(f"Background sync failed for user {current_user.id}: {e}")

    background_tasks.add_task(_run_sync)
    return {"status": "sync_started"}
