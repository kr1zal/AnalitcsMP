"""
Telegram bot integration endpoints:
- POST /telegram/webhook       — aiogram webhook (from Telegram servers)
- POST /telegram/generate-token — generate one-time link token (auth required)
- GET  /telegram/link-status    — check if user has linked Telegram (auth required)
- DELETE /telegram/unlink       — unlink Telegram account (auth required)
- PUT  /telegram/settings       — update notification settings (auth required)
- POST /telegram/send-summaries — cron endpoint: send daily summaries
- POST /telegram/session-cleanup — cron endpoint: idle reminders + auto-close resolved sessions
- POST /telegram/setup-webhook  — one-time: set webhook URL at Telegram API
"""
import hmac
import logging
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from ...auth import CurrentUser, get_current_user
from ...config import get_settings
from ...db.supabase import get_supabase_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/telegram", tags=["Telegram"])

MSK_OFFSET = timedelta(hours=3)


def _now_msk_hhmm() -> str:
    """Current HH:MM in Moscow timezone."""
    now = datetime.now(timezone.utc) + MSK_OFFSET
    return now.strftime("%H:%M")


# ─── Webhook endpoint ───

@router.post("/webhook")
async def telegram_webhook(request: Request) -> dict:
    """
    Receive updates from Telegram via webhook.
    Uses dp.feed_update() — 0 extra processes.
    """
    from ...telegram import get_bot, get_dispatcher, get_webhook_secret

    # Verify webhook secret (in URL or header)
    secret = get_webhook_secret()
    if secret:
        # Telegram sends secret in X-Telegram-Bot-Api-Secret-Token header
        header_secret = request.headers.get("x-telegram-bot-api-secret-token", "")
        if not hmac.compare_digest(header_secret.encode(), secret.encode()):
            raise HTTPException(status_code=403, detail="Invalid webhook secret")

    try:
        from aiogram.types import Update
        body = await request.json()
        update = Update.model_validate(body, context={"bot": get_bot()})
        dp = get_dispatcher()
        await dp.feed_update(bot=get_bot(), update=update)
    except Exception as e:
        logger.error(f"Webhook processing error: {e}")
        # Always return 200 to Telegram to avoid retries
        pass

    return {"ok": True}


# ─── Generate link token ───

@router.post("/generate-token")
async def generate_link_token(
    current_user: CurrentUser = Depends(get_current_user),
) -> dict:
    """
    Generate one-time token for Telegram deep link binding.
    Token expires in 5 minutes.
    Returns: { token, link: "t.me/RevioMPBot?start=LINK_{token}" }
    """
    supabase = get_supabase_client()

    # Invalidate previous unused tokens for this user
    supabase.table("mp_telegram_link_tokens").update(
        {"used": True}
    ).eq("user_id", current_user.id).eq("used", False).execute()

    # Create new token
    token = str(uuid.uuid4())
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()

    supabase.table("mp_telegram_link_tokens").insert({
        "token": token,
        "user_id": current_user.id,
        "expires_at": expires_at,
    }).execute()

    return {
        "token": token,
        "link": f"https://t.me/RevioMPBot?start=LINK_{token}",
        "expires_in": 300,
    }


# ─── Link status ───

@router.get("/link-status")
async def get_link_status(
    current_user: CurrentUser = Depends(get_current_user),
) -> dict:
    """
    Check if user has linked Telegram account.
    Returns: { linked, telegram_username, settings }
    """
    supabase = get_supabase_client()

    result = (
        supabase.table("mp_telegram_links")
        .select("telegram_username, settings, linked_at")
        .eq("user_id", current_user.id)
        .limit(1)
        .execute()
    )

    if result.data:
        link = result.data[0]
        return {
            "linked": True,
            "telegram_username": link.get("telegram_username"),
            "settings": link.get("settings") or {},
            "linked_at": link.get("linked_at"),
        }

    return {
        "linked": False,
        "telegram_username": None,
        "settings": {},
        "linked_at": None,
    }


# ─── Unlink ───

@router.delete("/unlink")
async def unlink_telegram(
    current_user: CurrentUser = Depends(get_current_user),
) -> dict:
    """Unlink Telegram account."""
    supabase = get_supabase_client()

    supabase.table("mp_telegram_links").delete().eq(
        "user_id", current_user.id
    ).execute()

    return {"status": "unlinked"}


# ─── Update settings ───

class TelegramSettingsPayload(BaseModel):
    daily_summary: bool = True
    morning_time: str = "09:00"
    evening_enabled: bool = False
    evening_time: str = "21:00"
    stock_alerts: bool = True


@router.put("/settings")
async def update_telegram_settings(
    payload: TelegramSettingsPayload,
    current_user: CurrentUser = Depends(get_current_user),
) -> dict:
    """Update notification settings for linked Telegram."""
    supabase = get_supabase_client()

    # Check if linked
    result = (
        supabase.table("mp_telegram_links")
        .select("id")
        .eq("user_id", current_user.id)
        .limit(1)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Telegram not linked")

    # Validate time format
    for time_str in [payload.morning_time, payload.evening_time]:
        try:
            h, m = time_str.split(":")
            assert 0 <= int(h) <= 23 and 0 <= int(m) <= 59
        except (ValueError, AssertionError):
            raise HTTPException(status_code=400, detail=f"Invalid time format: {time_str}")

    settings = payload.model_dump()

    supabase.table("mp_telegram_links").update(
        {"settings": settings}
    ).eq("user_id", current_user.id).execute()

    return {"status": "updated", "settings": settings}


# ─── Cron: send daily summaries ───

@router.post("/send-summaries")
async def send_summaries_cron(request: Request) -> dict:
    """
    Cron endpoint: send daily summaries to matching users.
    Auth: X-Cron-Secret header (same pattern as sync queue).
    Called every 15 minutes, checks which users need summaries now.
    """
    settings = get_settings()

    # Verify cron secret
    cron_secret = (request.headers.get("x-cron-secret") or "").strip()
    expected = (settings.sync_cron_secret or "").strip()
    if not expected or not hmac.compare_digest(cron_secret.encode(), expected.encode()):
        raise HTTPException(status_code=401, detail="Invalid cron secret")

    # Current MSK time rounded to nearest 15 min
    now_hhmm = _now_msk_hhmm()
    h, m = now_hhmm.split(":")
    rounded_m = (int(m) // 15) * 15
    target_time = f"{h}:{rounded_m:02d}"

    from ...telegram.notifications import send_daily_summaries

    stats = {"target_time": target_time}
    result = await send_daily_summaries(target_time)
    stats.update(result)

    logger.info(f"Daily summaries cron: {stats}")
    return stats


# ─── Cron: session cleanup ───

@router.post("/session-cleanup")
async def session_cleanup_cron(request: Request) -> dict:
    """
    Cron endpoint: check idle support sessions + auto-close resolved.
    Auth: X-Cron-Secret header.
    Called every 5 minutes.

    1. check_idle_sessions() -> send "still need help?" reminder
    2. auto_close_resolved() -> close sessions resolved > 2 hours ago
    """
    settings = get_settings()

    # Verify cron secret
    cron_secret = (request.headers.get("x-cron-secret") or "").strip()
    expected = (settings.sync_cron_secret or "").strip()
    if not expected or not hmac.compare_digest(cron_secret.encode(), expected.encode()):
        raise HTTPException(status_code=401, detail="Invalid cron secret")

    from ...telegram import get_bot
    from ...telegram.session_manager import check_idle_sessions, auto_close_resolved, save_message
    from ...telegram.keyboards import after_ai_keyboard

    stats = {"idle_reminded": 0, "auto_closed": 0}

    try:
        # 1. Check idle sessions and send reminder
        idle_sessions = await check_idle_sessions()
        bot = get_bot()

        from ...telegram.session_manager import resolve_session

        for session in idle_sessions:
            try:
                await bot.send_message(
                    session["chat_id"],
                    "Всё ещё нужна помощь? "
                    "Если вопрос решён — нажмите кнопку ниже.",
                    reply_markup=after_ai_keyboard(),
                )
                # 1 reminder max: resolve session so idle check won't find it again.
                # If user responds, get_or_create_session() reopens it.
                # auto_close_resolved() will close it after 2 hours.
                await resolve_session(session["session_id"])
                stats["idle_reminded"] += 1
            except Exception as e:
                logger.warning(
                    f"Failed to send idle reminder to chat "
                    f"{session['chat_id']}: {e}"
                )

        # 2. Auto-close resolved sessions
        closed_count = await auto_close_resolved()
        stats["auto_closed"] = closed_count

    except Exception as e:
        logger.error(f"Session cleanup error: {e}")
        stats["error"] = str(e)

    logger.info(f"Session cleanup cron: {stats}")
    return stats


# ─── One-time webhook setup ───

@router.post("/setup-webhook")
async def setup_webhook(request: Request) -> dict:
    """
    One-time endpoint to set webhook URL at Telegram.
    Auth: X-Cron-Secret (admin only).
    """
    settings_obj = get_settings()

    cron_secret = (request.headers.get("x-cron-secret") or "").strip()
    expected = (settings_obj.sync_cron_secret or "").strip()
    if not expected or not hmac.compare_digest(cron_secret.encode(), expected.encode()):
        raise HTTPException(status_code=401, detail="Invalid cron secret")

    from ...telegram import get_bot, get_webhook_secret

    bot = get_bot()
    # Use analitics.bixirun.ru — Telegram DNS can't resolve reviomp.ru
    webhook_url = "https://analitics.bixirun.ru/api/telegram/webhook"
    secret = get_webhook_secret()

    result = await bot.set_webhook(
        url=webhook_url,
        secret_token=secret or None,
        drop_pending_updates=True,
    )

    return {
        "status": "ok" if result else "failed",
        "webhook_url": webhook_url,
        "has_secret": bool(secret),
    }
