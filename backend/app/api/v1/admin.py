"""
Admin endpoints:
- POST /admin/sync/{user_id}  — force sync for any user (admin-only)
"""
import logging

from fastapi import APIRouter, Depends, HTTPException

from ...auth import CurrentUser, get_current_user
from .sync_queue import _is_sync_running, _run_full_sync

logger = logging.getLogger(__name__)
router = APIRouter()

ADMIN_USER_IDS = ["17e80396-86e1-4ec8-8cb2-f727462bf20c"]


@router.post("/admin/sync/{user_id}")
async def admin_force_sync(
    user_id: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Admin-only: force sync for any user.
    Ignores cooldown and daily limits, respects running-lock.
    """
    if current_user.id not in ADMIN_USER_IDS:
        raise HTTPException(status_code=403, detail="Admin access required")

    # Respect running lock
    if _is_sync_running(user_id):
        raise HTTPException(status_code=409, detail={
            "error": "sync_already_running",
            "message": f"Sync already running for user {user_id}",
        })

    logger.info(f"Admin force sync for user {user_id} by admin {current_user.id}")
    result = await _run_full_sync(user_id, trigger="admin")

    if result["status"] == "error":
        raise HTTPException(status_code=500, detail={
            "error": "sync_failed",
            "message": result.get("error", "Sync failed"),
            "user_id": user_id,
        })

    return {
        "status": "completed",
        "user_id": user_id,
        "records": result.get("records", 0),
    }
