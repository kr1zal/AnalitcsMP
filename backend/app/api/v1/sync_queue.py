"""
Sync Queue endpoints (Phase 4):
- POST /sync/process-queue  — cron-only: process all due users
- POST /sync/manual         — user: manual sync with daily limit
- GET  /sync/status         — user: sync status for SyncPage
"""
import hmac
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request

from ...auth import CurrentUser, get_current_user
from ...config import get_settings
from ...db.supabase import get_supabase_client
from ...plans import get_plan, get_next_sync_utc, PLANS
from ...services.sync_service import SyncService
from ...subscription import get_user_subscription, UserSubscription, _load_subscription

logger = logging.getLogger(__name__)
router = APIRouter()

MSK_OFFSET = timedelta(hours=3)


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _now_utc_iso() -> str:
    return _now_utc().isoformat()


def _today_msk() -> str:
    """Current date in MSK as YYYY-MM-DD string."""
    return (_now_utc() + MSK_OFFSET).strftime("%Y-%m-%d")


def _ensure_queue_row(user_id: str, plan_name: str) -> dict:
    """Get or create mp_sync_queue row for user. Returns the row dict."""
    supabase = get_supabase_client()
    result = (
        supabase.table("mp_sync_queue")
        .select("*")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )

    if result.data:
        return result.data[0]

    # Lazy creation
    plan = get_plan(plan_name)
    next_sync = get_next_sync_utc(plan_name)
    row = {
        "user_id": user_id,
        "next_sync_at": next_sync.isoformat(),
        "priority": plan.get("sync_priority", 2),
        "status": "pending",
        "manual_syncs_today": 0,
        "manual_syncs_date": _today_msk(),
    }
    insert_result = supabase.table("mp_sync_queue").insert(row).execute()
    return insert_result.data[0] if insert_result.data else row


def _reset_daily_counter_if_needed(queue_row: dict) -> dict:
    """Reset manual_syncs_today if date changed (MSK midnight)."""
    today = _today_msk()
    if queue_row.get("manual_syncs_date") != today:
        supabase = get_supabase_client()
        supabase.table("mp_sync_queue").update({
            "manual_syncs_today": 0,
            "manual_syncs_date": today,
            "updated_at": _now_utc_iso(),
        }).eq("user_id", queue_row["user_id"]).execute()
        queue_row["manual_syncs_today"] = 0
        queue_row["manual_syncs_date"] = today
    return queue_row


def _is_sync_running(user_id: str) -> bool:
    """Check if there's a running sync lock for this user (TTL 2h)."""
    supabase = get_supabase_client()
    now = _now_utc()
    running = (
        supabase.table("mp_sync_log")
        .select("started_at")
        .eq("user_id", user_id)
        .eq("status", "running")
        .order("started_at", desc=True)
        .limit(1)
        .execute()
    )
    if running.data:
        started_str = running.data[0].get("started_at", "")
        if started_str:
            try:
                s = started_str.strip()
                if s.endswith("Z"):
                    s = s[:-1] + "+00:00"
                started = datetime.fromisoformat(s)
                if started.tzinfo is None:
                    started = started.replace(tzinfo=timezone.utc)
                if (now - started) < timedelta(hours=2):
                    return True
            except Exception:
                pass
    return False


def _has_tokens(user_id: str) -> bool:
    """Check if user has API tokens saved."""
    supabase = get_supabase_client()
    result = (
        supabase.table("mp_user_tokens")
        .select("id")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    return bool(result.data)


def _create_log(user_id: str, sync_type: str, trigger: str) -> str | None:
    """Create a running sync log entry, return its id."""
    supabase = get_supabase_client()
    result = supabase.table("mp_sync_log").insert({
        "marketplace": "all",
        "sync_type": sync_type,
        "status": "running",
        "records_count": 0,
        "error_message": None,
        "started_at": _now_utc_iso(),
        "finished_at": None,
        "user_id": user_id,
        "trigger": trigger,
    }).execute()
    return result.data[0]["id"] if result.data else None


def _finish_log(log_id: str | None, status: str, records: int = 0, error: str | None = None):
    """Mark a sync log entry as finished."""
    if not log_id:
        return
    supabase = get_supabase_client()
    supabase.table("mp_sync_log").update({
        "status": status,
        "records_count": records,
        "error_message": error,
        "finished_at": _now_utc_iso(),
    }).eq("id", log_id).execute()


async def _run_full_sync(user_id: str, trigger: str) -> dict:
    """Execute full sync cycle for a user. Returns result dict."""
    log_id = _create_log(user_id, "all", trigger)
    try:
        sync_service = SyncService(user_id=user_id)
        result = await sync_service.sync_all(days_back=30)
        total_records = result.get("success_count", 0)
        _finish_log(log_id, "success", total_records)
        return {"status": "completed", "records": total_records}
    except Exception as e:
        _finish_log(log_id, "error", error=str(e))
        return {"status": "error", "error": str(e)}


# ---------------------------------------------------------------------------
# POST /sync/process-queue — cron-only
# ---------------------------------------------------------------------------

@router.post("/sync/process-queue")
async def process_sync_queue(request: Request):
    """
    Cron-only: process all users whose next_sync_at <= now.
    Called every 30 minutes by external cron.
    Auth: X-Cron-Secret header (no user_id needed).
    """
    # Verify cron secret
    cron_secret = (request.headers.get("x-cron-secret") or "").strip()
    if not cron_secret:
        raise HTTPException(status_code=401, detail="X-Cron-Secret header required")

    settings = get_settings()
    expected = (settings.sync_cron_secret or "").strip()
    if not expected or not hmac.compare_digest(cron_secret.encode(), expected.encode()):
        raise HTTPException(status_code=401, detail="Invalid cron secret")

    supabase = get_supabase_client()
    now = _now_utc()

    # Fetch all due queue entries: pending + next_sync_at <= now, ordered by priority
    due = (
        supabase.table("mp_sync_queue")
        .select("user_id, priority, next_sync_at, status")
        .in_("status", ["pending", "completed", "error"])
        .lte("next_sync_at", now.isoformat())
        .order("priority", desc=False)
        .order("next_sync_at", desc=False)
        .execute()
    )

    if not due.data:
        return {"status": "ok", "processed": 0, "skipped": 0, "errors": 0, "message": "No users due for sync"}

    processed = 0
    skipped = 0
    errors = 0

    for entry in due.data:
        user_id = entry["user_id"]

        # Skip if no tokens
        if not _has_tokens(user_id):
            skipped += 1
            logger.info(f"Queue: skipping {user_id} — no tokens")
            continue

        # Skip if sync already running
        if _is_sync_running(user_id):
            skipped += 1
            logger.info(f"Queue: skipping {user_id} — sync already running")
            continue

        # Load subscription to determine plan
        sub = _load_subscription(user_id)
        plan_name = sub.plan

        # Mark as processing
        supabase.table("mp_sync_queue").update({
            "status": "processing",
            "updated_at": _now_utc_iso(),
        }).eq("user_id", user_id).execute()

        # Run sync
        logger.info(f"Queue: syncing user {user_id} (plan={plan_name}, priority={entry['priority']})")
        result = await _run_full_sync(user_id, trigger="auto")

        # Update queue row
        next_sync = get_next_sync_utc(plan_name)
        if result["status"] == "completed":
            supabase.table("mp_sync_queue").update({
                "status": "completed",
                "last_sync_at": _now_utc_iso(),
                "last_error": None,
                "next_sync_at": next_sync.isoformat(),
                "updated_at": _now_utc_iso(),
            }).eq("user_id", user_id).execute()
            processed += 1
        else:
            supabase.table("mp_sync_queue").update({
                "status": "error",
                "last_error": result.get("error", "Unknown error"),
                "next_sync_at": next_sync.isoformat(),
                "updated_at": _now_utc_iso(),
            }).eq("user_id", user_id).execute()
            errors += 1
            logger.error(f"Queue: sync error for {user_id}: {result.get('error')}")

    return {
        "status": "ok",
        "processed": processed,
        "skipped": skipped,
        "errors": errors,
    }


# ---------------------------------------------------------------------------
# POST /sync/manual — user-triggered manual sync with daily limit
# ---------------------------------------------------------------------------

@router.post("/sync/manual")
async def manual_sync(
    current_user: CurrentUser = Depends(get_current_user),
    sub: UserSubscription = Depends(get_user_subscription),
):
    """
    User-triggered manual sync. Checks daily limit per plan.
    Free: 0/day, Pro: 1/day, Business: 2/day.
    """
    plan = sub.plan_config
    limit = plan.get("manual_sync_limit", 0)

    if limit == 0:
        raise HTTPException(status_code=403, detail={
            "error": "manual_sync_not_available",
            "message": "Ручное обновление недоступно на вашем тарифе",
            "current_plan": sub.plan,
        })

    # Get/create queue row
    queue_row = _ensure_queue_row(current_user.id, sub.plan)
    queue_row = _reset_daily_counter_if_needed(queue_row)

    used = queue_row.get("manual_syncs_today", 0)
    if used >= limit:
        next_sync = queue_row.get("next_sync_at")
        raise HTTPException(status_code=403, detail={
            "error": "manual_sync_limit_reached",
            "message": "Лимит ручных обновлений исчерпан на сегодня",
            "remaining": 0,
            "limit": limit,
            "next_auto_sync": next_sync,
        })

    # Check running lock
    if _is_sync_running(current_user.id):
        raise HTTPException(status_code=409, detail={
            "error": "sync_already_running",
            "message": "Синхронизация уже выполняется",
        })

    # Increment counter
    supabase = get_supabase_client()
    supabase.table("mp_sync_queue").update({
        "manual_syncs_today": used + 1,
        "updated_at": _now_utc_iso(),
    }).eq("user_id", current_user.id).execute()

    # Run full sync
    result = await _run_full_sync(current_user.id, trigger="manual")

    # Update queue with last_sync
    next_sync = get_next_sync_utc(sub.plan)
    supabase.table("mp_sync_queue").update({
        "last_sync_at": _now_utc_iso(),
        "last_error": None if result["status"] == "completed" else result.get("error"),
        "next_sync_at": next_sync.isoformat(),
        "updated_at": _now_utc_iso(),
    }).eq("user_id", current_user.id).execute()

    remaining = limit - (used + 1)

    if result["status"] == "error":
        raise HTTPException(status_code=500, detail={
            "error": "sync_failed",
            "message": result.get("error", "Ошибка синхронизации"),
            "syncs_remaining": remaining,
        })

    return {
        "status": "completed",
        "syncs_remaining": remaining,
        "next_auto_sync": next_sync.isoformat(),
    }


# ---------------------------------------------------------------------------
# GET /sync/status — sync status for SyncPage
# ---------------------------------------------------------------------------

@router.get("/sync/status")
async def get_sync_status(
    current_user: CurrentUser = Depends(get_current_user),
    sub: UserSubscription = Depends(get_user_subscription),
):
    """
    Return sync status for the SyncPage status panel.
    Lazy-creates queue row if not exists.
    """
    plan = sub.plan_config
    plan_name = sub.plan

    # Ensure queue row exists
    queue_row = _ensure_queue_row(current_user.id, plan_name)
    queue_row = _reset_daily_counter_if_needed(queue_row)

    # Last successful sync from mp_sync_log
    supabase = get_supabase_client()
    last_ok = (
        supabase.table("mp_sync_log")
        .select("finished_at")
        .eq("user_id", current_user.id)
        .eq("status", "success")
        .order("finished_at", desc=True)
        .limit(1)
        .execute()
    )

    last_sync_at = None
    last_sync_ago_minutes = None
    if last_ok.data:
        last_sync_at = last_ok.data[0].get("finished_at")
        if last_sync_at:
            try:
                s = last_sync_at.strip()
                if s.endswith("Z"):
                    s = s[:-1] + "+00:00"
                dt = datetime.fromisoformat(s)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                diff = _now_utc() - dt
                last_sync_ago_minutes = int(diff.total_seconds() / 60)
            except Exception:
                pass

    # Check if sync is currently running
    is_syncing = _is_sync_running(current_user.id)

    limit = plan.get("manual_sync_limit", 0)
    used = queue_row.get("manual_syncs_today", 0)

    return {
        "plan": plan_name,
        "plan_name": plan.get("name", plan_name),
        "last_sync_at": last_sync_at,
        "last_sync_ago_minutes": last_sync_ago_minutes,
        "next_sync_at": queue_row.get("next_sync_at"),
        "sync_interval_hours": plan.get("sync_interval_hours"),
        "manual_syncs_today": used,
        "manual_sync_limit": limit,
        "manual_syncs_remaining": max(0, limit - used),
        "is_syncing": is_syncing,
    }
