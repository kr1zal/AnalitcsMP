"""
Роутер для запуска синхронизации данных
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends, Query
from typing import Optional
from datetime import datetime, timedelta, timezone

from ...services.sync_service import SyncService
from ...db.supabase import get_supabase_client
from ...auth import CurrentUser, get_current_user, get_current_user_or_cron

router = APIRouter()

def _now_utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_dt(value: str | None) -> datetime | None:
    """
    Parse ISO datetime string from Supabase into aware datetime (UTC where possible).
    Handles both 'Z' and '+00:00' variants.
    """
    if not value:
        return None
    s = value.strip()
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(s)
    except Exception:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


@router.post("/sync/products")
async def sync_products(
    current_user: CurrentUser = Depends(get_current_user_or_cron),
):
    """
    Синхронизация товаров (обновление WB/Ozon ID)
    """
    try:
        sync_service = SyncService(user_id=current_user.id)
        result = await sync_service.sync_products()
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sync/sales")
async def sync_sales(
    current_user: CurrentUser = Depends(get_current_user_or_cron),
    days_back: int = 35,
    marketplace: Optional[str] = None,
    force: bool = False,
):
    """
    Синхронизация продаж за последние N дней

    - **days_back**: количество дней для загрузки (по умолчанию 35)
    - **marketplace**: wb, ozon или all (по умолчанию)
    - **force**: игнорировать idempotency-guard (по умолчанию false)
    """
    try:
        # Idempotency + lock (protect from double-trigger / concurrent cron)
        supabase = get_supabase_client()
        now = datetime.now(timezone.utc)

        # 1) Running lock (2h TTL)
        running = (
            supabase.table("mp_sync_log")
            .select("id, started_at")
            .eq("marketplace", "all")
            .eq("sync_type", "sales")
            .eq("status", "running")
            .eq("user_id", current_user.id)
            .order("started_at", desc=True)
            .limit(1)
            .execute()
        )
        if running.data:
            started = _parse_dt(running.data[0].get("started_at"))
            if started and (now - started) < timedelta(hours=2):
                return {
                    "status": "skipped",
                    "reason": "already_running",
                    "running_since": running.data[0].get("started_at"),
                }

        # 2) Recent success guard (20h window)
        if not force:
            last_ok = (
                supabase.table("mp_sync_log")
                .select("finished_at")
                .eq("marketplace", "all")
                .eq("sync_type", "sales")
                .eq("status", "success")
                .eq("user_id", current_user.id)
                .order("finished_at", desc=True)
                .limit(1)
                .execute()
            )
            if last_ok.data:
                finished = _parse_dt(last_ok.data[0].get("finished_at"))
                if finished and (now - finished) < timedelta(hours=20):
                    return {
                        "status": "skipped",
                        "reason": "already_synced_recently",
                        "last_finished_at": last_ok.data[0].get("finished_at"),
                    }

        # Create a single "job" log row as a lock + summary (marketplace=all)
        lock_insert = (
            supabase.table("mp_sync_log")
            .insert(
                {
                    "marketplace": "all",
                    "sync_type": "sales",
                    "status": "running",
                    "records_count": 0,
                    "error_message": None,
                    "started_at": _now_utc_iso(),
                    "finished_at": None,
                    "user_id": current_user.id,
                }
            )
            .execute()
        )
        lock_id = lock_insert.data[0]["id"] if lock_insert.data else None

        sync_service = SyncService(user_id=current_user.id)
        date_from = datetime.now() - timedelta(days=days_back)
        date_to = datetime.now()

        results = {}

        if marketplace in [None, "wb", "all"]:
            results["wb"] = await sync_service.sync_sales_wb(date_from, date_to)

        if marketplace in [None, "ozon", "all"]:
            results["ozon"] = await sync_service.sync_sales_ozon(date_from, date_to)

        total_records = 0
        for k, v in results.items():
            if isinstance(v, dict):
                total_records += int(v.get("records") or 0)

        # Mark lock as success
        if lock_id:
            supabase.table("mp_sync_log").update(
                {
                    "status": "success",
                    "records_count": total_records,
                    "error_message": None,
                    "finished_at": _now_utc_iso(),
                }
            ).eq("id", lock_id).execute()

        return {
            "status": "completed",
            "period": {
                "from": date_from.strftime("%Y-%m-%d"),
                "to": date_to.strftime("%Y-%m-%d")
            },
            "results": results,
            "job": {"marketplace": "all", "sync_type": "sales", "records": total_records},
        }
    except HTTPException:
        raise
    except Exception as e:
        # Best-effort: mark lock as error (if created)
        try:
            if "lock_id" in locals() and locals().get("lock_id"):
                supabase = get_supabase_client()
                supabase.table("mp_sync_log").update(
                    {
                        "status": "error",
                        "records_count": 0,
                        "error_message": str(e),
                        "finished_at": _now_utc_iso(),
                    }
                ).eq("id", locals()["lock_id"]).execute()
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sync/stocks")
async def sync_stocks(
    current_user: CurrentUser = Depends(get_current_user_or_cron),
    marketplace: Optional[str] = None,
):
    """
    Синхронизация остатков на складах

    - **marketplace**: wb, ozon или all (по умолчанию)
    """
    try:
        sync_service = SyncService(user_id=current_user.id)
        results = {}

        if marketplace in [None, "wb", "all"]:
            results["wb"] = await sync_service.sync_stocks_wb()

        if marketplace in [None, "ozon", "all"]:
            results["ozon"] = await sync_service.sync_stocks_ozon()

        return {
            "status": "completed",
            "results": results
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sync/stocks/check")
async def check_stocks(
    current_user: CurrentUser = Depends(get_current_user_or_cron),
    marketplace: Optional[str] = None,
    days_back: int = 365,
):
    """
    Диагностика остатков (сверка источника маркетплейса vs mp_stocks).

    - **marketplace**: wb (пока реализовано), ozon/all — зарезервировано
    - **days_back**: окно dateFrom для WB stocks (по умолчанию 365)
    """
    try:
        sync_service = SyncService(user_id=current_user.id)

        if marketplace in [None, "wb", "all"]:
            return await sync_service.diagnose_stocks_wb(days_back=days_back)

        raise HTTPException(status_code=400, detail="Unsupported marketplace for stocks check (use wb)")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sync/costs")
async def sync_costs(
    current_user: CurrentUser = Depends(get_current_user_or_cron),
    days_back: int = 30,
    marketplace: Optional[str] = None,
):
    """
    Синхронизация удержаний МП за последние N дней

    - **days_back**: количество дней для загрузки (по умолчанию 30)
    - **marketplace**: wb, ozon или all (по умолчанию)
    """
    try:
        sync_service = SyncService(user_id=current_user.id)
        date_from = datetime.now() - timedelta(days=days_back)
        date_to = datetime.now()

        results = {}

        if marketplace in [None, "wb", "all"]:
            results["wb"] = await sync_service.sync_costs_wb(date_from, date_to)

        if marketplace in [None, "ozon", "all"]:
            results["ozon"] = await sync_service.sync_costs_ozon(date_from, date_to)

        return {
            "status": "completed",
            "period": {
                "from": date_from.strftime("%Y-%m-%d"),
                "to": date_to.strftime("%Y-%m-%d")
            },
            "results": results
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sync/ads")
async def sync_ads(
    current_user: CurrentUser = Depends(get_current_user_or_cron),
    days_back: int = 30,
    marketplace: Optional[str] = None,
):
    """
    Синхронизация рекламных расходов за последние N дней

    - **days_back**: количество дней для загрузки (по умолчанию 30)
    - **marketplace**: wb, ozon или all (по умолчанию)
    """
    try:
        sync_service = SyncService(user_id=current_user.id)
        date_from = datetime.now() - timedelta(days=days_back)
        date_to = datetime.now()

        results = {}

        if marketplace in [None, "wb", "all"]:
            results["wb"] = await sync_service.sync_ads_wb(date_from, date_to)

        if marketplace in [None, "ozon", "all"]:
            results["ozon"] = await sync_service.sync_ads_ozon(date_from, date_to)

        return {
            "status": "completed",
            "period": {
                "from": date_from.strftime("%Y-%m-%d"),
                "to": date_to.strftime("%Y-%m-%d")
            },
            "results": results
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sync/all")
async def sync_all(
    background_tasks: BackgroundTasks,
    current_user: CurrentUser = Depends(get_current_user_or_cron),
    days_back: int = 30,
    run_in_background: bool = False,
):
    """
    Полная синхронизация всех данных

    - **days_back**: количество дней для загрузки (по умолчанию 30)
    - **run_in_background**: запустить в фоне (по умолчанию false)
    """
    try:
        sync_service = SyncService(user_id=current_user.id)

        if run_in_background:
            background_tasks.add_task(sync_service.sync_all, days_back)
            return {
                "status": "started",
                "message": "Синхронизация запущена в фоновом режиме",
                "days_back": days_back
            }
        else:
            result = await sync_service.sync_all(days_back)
            return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sync/logs")
async def get_sync_logs(
    current_user: CurrentUser = Depends(get_current_user_or_cron),
    limit: int = 50,
):
    """
    Получить логи синхронизации

    - **limit**: количество последних записей (по умолчанию 50)
    """
    try:
        supabase = get_supabase_client()
        result = (
            supabase.table("mp_sync_log")
            .select("*")
            .eq("user_id", current_user.id)
            .order("finished_at", desc=True)
            .limit(limit)
            .execute()
        )

        return {
            "status": "success",
            "count": len(result.data),
            "logs": result.data
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
