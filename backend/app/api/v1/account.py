"""
Удаление аккаунта пользователя: все данные + auth user.
"""
import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException

from ...auth import CurrentUser, get_current_user
from ...config import get_settings
from ...db.supabase import get_supabase_client

logger = logging.getLogger(__name__)

router = APIRouter()

# Порядок удаления (foreign key constraints)
_TABLES_DELETE_ORDER = [
    "mp_payments",
    "mp_sync_queue",
    "mp_sync_log",
    "mp_orders",
    "mp_ad_costs",
    "mp_sales_geo",
    "mp_costs_details",
    "mp_costs",
    "mp_stocks",
    "mp_sales",
    "mp_products",
    "mp_user_subscriptions",
    "mp_user_tokens",
]


@router.delete("/account")
async def delete_account(
    current_user: CurrentUser = Depends(get_current_user),
):
    """Полное удаление аккаунта: все данные из БД + auth user из Supabase."""
    settings = get_settings()
    supabase = get_supabase_client()

    # 1. Удаляем данные из всех таблиц (порядок важен — FK constraints)
    for table in _TABLES_DELETE_ORDER:
        try:
            supabase.table(table).delete().eq("user_id", current_user.id).execute()
        except Exception as e:
            logger.warning(f"Error deleting from {table} for user {current_user.id}: {e}")

    # 2. Удаляем auth user через Supabase Admin API
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.delete(
                f"{settings.supabase_url}/auth/v1/admin/users/{current_user.id}",
                headers={
                    "apikey": settings.supabase_service_role_key,
                    "Authorization": f"Bearer {settings.supabase_service_role_key}",
                },
            )
            if resp.status_code >= 400:
                logger.error(
                    f"Failed to delete auth user {current_user.id}: "
                    f"{resp.status_code} {resp.text}"
                )
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to delete auth user: {resp.status_code}",
                )
    except httpx.HTTPError as e:
        logger.error(f"HTTP error deleting auth user {current_user.id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete auth user")

    logger.info(f"Account deleted: user_id={current_user.id}, email={current_user.email}")
    return {"status": "deleted"}
