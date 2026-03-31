"""
Роутер для плана продаж:
- per product per marketplace (детализация по товарам)
- summary-level: total / per-marketplace (без детализации)
3 уровня: total → по МП → по товарам
"""
from datetime import datetime, timedelta, date as date_type
from calendar import monthrange
from dateutil.relativedelta import relativedelta

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import Optional

from ...db.supabase import get_supabase_client
from ...auth import CurrentUser, get_current_user

router = APIRouter()

VALID_MARKETPLACES = ("wb", "ozon")
VALID_SUMMARY_LEVELS = ("total", "wb", "ozon")


# ==================== PYDANTIC MODELS ====================

class SalesPlanItem(BaseModel):
    product_id: str
    plan_revenue: float = Field(..., ge=0)


class UpsertSalesPlanRequest(BaseModel):
    month: str  # "YYYY-MM"
    marketplace: str  # "wb" or "ozon"
    items: list[SalesPlanItem]


class UpsertSummaryPlanRequest(BaseModel):
    month: str  # "YYYY-MM"
    level: str  # "total", "wb", "ozon"
    plan_revenue: float = Field(..., ge=0)


# ==================== HELPERS ====================

def normalize_month(month_str: str) -> str:
    """Convert 'YYYY-MM' to 'YYYY-MM-01' (first day of month)."""
    try:
        parts = month_str.strip().split("-")
        year = int(parts[0])
        month = int(parts[1])
        if month < 1 or month > 12:
            raise ValueError
        return f"{year:04d}-{month:02d}-01"
    except (IndexError, ValueError):
        raise HTTPException(status_code=400, detail=f"Invalid month format: '{month_str}'. Expected YYYY-MM")


def month_label_ru(month_str: str) -> str:
    """Convert 'YYYY-MM' to 'Февраль 2026'."""
    months_ru = [
        "", "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
        "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
    ]
    try:
        parts = month_str.split("-")
        return f"{months_ru[int(parts[1])]} {parts[0]}"
    except (IndexError, ValueError):
        return month_str


def month_last_day(month_date_str: str) -> str:
    """Return last day of month as 'YYYY-MM-DD'. Input: 'YYYY-MM-01'."""
    parts = month_date_str.split("-")
    year, month = int(parts[0]), int(parts[1])
    _, last = monthrange(year, month)
    return f"{year:04d}-{month:02d}-{last:02d}"


# ==================== ENDPOINTS ====================

# ---------- Per-product plans ----------

@router.get("/sales-plan")
async def get_sales_plan(
    current_user: CurrentUser = Depends(get_current_user),
    month: Optional[str] = Query(None, description="YYYY-MM, default current month"),
    marketplace: str = Query("wb", description="wb or ozon"),
):
    """Get per-product sales plan for a given month + marketplace."""
    supabase = get_supabase_client()

    if marketplace not in VALID_MARKETPLACES:
        raise HTTPException(status_code=400, detail=f"Invalid marketplace: '{marketplace}'. Expected wb or ozon")

    if not month:
        month = datetime.now().strftime("%Y-%m")

    month_date = normalize_month(month)

    plans_result = supabase.table("mp_sales_plan") \
        .select("product_id, plan_revenue") \
        .eq("user_id", current_user.id) \
        .eq("month", month_date) \
        .eq("marketplace", marketplace) \
        .limit(500) \
        .execute()

    products_query = supabase.table("mp_products") \
        .select("id, name, barcode, wb_nm_id, ozon_product_id") \
        .eq("user_id", current_user.id) \
        .limit(500)
    # Фильтр по marketplace: WB = товары с wb_nm_id, Ozon = с ozon_product_id
    if marketplace == "wb":
        products_query = products_query.not_.is_("wb_nm_id", "null")
    elif marketplace == "ozon":
        products_query = products_query.not_.is_("ozon_product_id", "null")
    products_result = products_query.execute()

    plans_map = {p["product_id"]: p["plan_revenue"] for p in plans_result.data}

    plans = []
    for product in products_result.data:
        if product.get("barcode") == "WB_ACCOUNT":
            continue
        plans.append({
            "product_id": product["id"],
            "product_name": product["name"],
            "barcode": product.get("barcode", ""),
            "plan_revenue": float(plans_map.get(product["id"], 0)),
        })

    return {
        "status": "success",
        "month": month[:7],
        "marketplace": marketplace,
        "plans": plans,
    }


@router.put("/sales-plan")
async def upsert_sales_plan(
    body: UpsertSalesPlanRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Upsert per-product sales plan values for a month + marketplace."""
    supabase = get_supabase_client()

    if body.marketplace not in VALID_MARKETPLACES:
        raise HTTPException(status_code=400, detail=f"Invalid marketplace: '{body.marketplace}'. Expected wb or ozon")

    month_date = normalize_month(body.month)

    product_ids = [item.product_id for item in body.items]
    products_result = supabase.table("mp_products") \
        .select("id") \
        .eq("user_id", current_user.id) \
        .in_("id", product_ids) \
        .execute()
    valid_ids = {p["id"] for p in products_result.data}

    rows = []
    for item in body.items:
        if item.product_id not in valid_ids:
            continue
        rows.append({
            "user_id": current_user.id,
            "product_id": item.product_id,
            "month": month_date,
            "marketplace": body.marketplace,
            "plan_revenue": item.plan_revenue,
            "updated_at": datetime.now().isoformat(),
        })

    if not rows:
        raise HTTPException(status_code=400, detail="No valid products to update")

    supabase.table("mp_sales_plan").upsert(
        rows,
        on_conflict="user_id,product_id,month,marketplace"
    ).execute()

    return {"status": "success", "updated": len(rows)}


@router.delete("/sales-plan/reset")
async def reset_sales_plan(
    current_user: CurrentUser = Depends(get_current_user),
    month: Optional[str] = Query(None, description="YYYY-MM"),
):
    """Reset ALL plans for a month (summary + per-product) to 0 by deleting rows."""
    supabase = get_supabase_client()

    if not month:
        month = datetime.now().strftime("%Y-%m")

    month_date = normalize_month(month)

    # Delete summary plans
    supabase.table("mp_sales_plan_summary") \
        .delete() \
        .eq("user_id", current_user.id) \
        .eq("month", month_date) \
        .execute()

    # Delete per-product plans
    supabase.table("mp_sales_plan") \
        .delete() \
        .eq("user_id", current_user.id) \
        .eq("month", month_date) \
        .execute()

    return {"status": "success"}


# ---------- Summary plans (total / per-MP) ----------

@router.get("/sales-plan/summary")
async def get_summary_plans(
    current_user: CurrentUser = Depends(get_current_user),
    month: Optional[str] = Query(None, description="YYYY-MM"),
):
    """Get summary plans for a month: total + wb + ozon."""
    supabase = get_supabase_client()

    if not month:
        month = datetime.now().strftime("%Y-%m")

    month_date = normalize_month(month)

    result = supabase.table("mp_sales_plan_summary") \
        .select("level, plan_revenue") \
        .eq("user_id", current_user.id) \
        .eq("month", month_date) \
        .execute()

    summary = {"total": 0, "wb": 0, "ozon": 0}
    for row in result.data:
        if row["level"] in summary:
            summary[row["level"]] = float(row["plan_revenue"])

    return {
        "status": "success",
        "month": month[:7],
        "summary": summary,
    }


@router.put("/sales-plan/summary")
async def upsert_summary_plan(
    body: UpsertSummaryPlanRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Upsert a summary plan (total / wb / ozon)."""
    supabase = get_supabase_client()

    if body.level not in VALID_SUMMARY_LEVELS:
        raise HTTPException(status_code=400, detail=f"Invalid level: '{body.level}'. Expected total, wb, or ozon")

    month_date = normalize_month(body.month)

    supabase.table("mp_sales_plan_summary").upsert(
        {
            "user_id": current_user.id,
            "month": month_date,
            "level": body.level,
            "plan_revenue": body.plan_revenue,
            "updated_at": datetime.now().isoformat(),
        },
        on_conflict="user_id,month,level"
    ).execute()

    return {"status": "success"}


# ---------- Completion ----------

@router.get("/sales-plan/completion")
async def get_sales_plan_completion(
    current_user: CurrentUser = Depends(get_current_user),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    marketplace: Optional[str] = Query(None),
):
    """
    Plan completion: actual revenue vs plan.
    Uses 3-level priority: total → per-MP → per-product.
    BUG FIX: actual revenue only for months that HAVE a plan (not all months in dashboard range).
    """
    supabase = get_supabase_client()

    if not date_from:
        date_from = datetime.now().replace(day=1).strftime("%Y-%m-%d")
    if not date_to:
        date_to = datetime.now().strftime("%Y-%m-%d")

    # Determine which months the date range covers
    start = datetime.strptime(date_from, "%Y-%m-%d")
    end = datetime.strptime(date_to, "%Y-%m-%d")

    months = set()
    current = start.replace(day=1)
    while current <= end:
        months.add(current.strftime("%Y-%m-%d"))
        if current.month == 12:
            current = current.replace(year=current.year + 1, month=1)
        else:
            current = current.replace(month=current.month + 1)

    months_list = sorted(months)
    today = datetime.now().strftime("%Y-%m-%d")
    mp_filter = marketplace if marketplace and marketplace != "all" else None

    # ---- Fetch ALL plan data to determine which months have plans ----
    summary_result = supabase.table("mp_sales_plan_summary") \
        .select("level, plan_revenue, month") \
        .eq("user_id", current_user.id) \
        .in_("month", months_list) \
        .execute()

    # Track which months have summary plans (by level)
    summary_by_level: dict[str, float] = {}
    months_with_summary: dict[str, set[str]] = {}  # level → set of months
    for row in summary_result.data:
        lvl = row["level"]
        m = row["month"][:10]  # normalize to YYYY-MM-DD
        if float(row["plan_revenue"]) > 0:
            summary_by_level[lvl] = summary_by_level.get(lvl, 0) + float(row["plan_revenue"])
            if lvl not in months_with_summary:
                months_with_summary[lvl] = set()
            months_with_summary[lvl].add(m)

    # Priority 1: total plan
    if not mp_filter and summary_by_level.get("total", 0) > 0:
        total_plan = summary_by_level["total"]
        plan_months = sorted(months_with_summary.get("total", set()))
        actual_from, actual_to = _plan_months_range(plan_months, today)
        label = _make_label(plan_months)
        total_actual = await _get_total_actual(supabase, current_user.id, actual_from, actual_to, None)
        total_completion = round((total_actual / total_plan) * 100, 1) if total_plan > 0 else 0
        return {
            "status": "success",
            "period": {"from": actual_from, "to": actual_to},
            "month_label": label,
            "plan_level": "total",
            "total_plan": round(total_plan, 2),
            "total_actual": round(total_actual, 2),
            "completion_percent": total_completion,
            "by_product": [],
            **_calc_pace_forecast(plan_months, total_actual, total_plan),
        }

    # Priority 2: per-MP summary plans
    # FIX: Only count actual revenue from marketplaces that actually have plans
    if mp_filter:
        mp_plan = summary_by_level.get(mp_filter, 0)
        plan_months = sorted(months_with_summary.get(mp_filter, set()))
        active_mps = [mp_filter] if mp_plan > 0 else []
    else:
        active_mps = []
        if summary_by_level.get("wb", 0) > 0:
            active_mps.append("wb")
        if summary_by_level.get("ozon", 0) > 0:
            active_mps.append("ozon")
        mp_plan = sum(summary_by_level.get(mp, 0) for mp in active_mps)
        plan_months = sorted(
            set().union(*(months_with_summary.get(mp, set()) for mp in active_mps)) if active_mps else set()
        )

    if mp_plan > 0:
        actual_from, actual_to = _plan_months_range(plan_months, today)
        label = _make_label(plan_months)
        # When marketplace=all and only some MPs have plans, sum actual only for those MPs
        if mp_filter or len(active_mps) == 2:
            total_actual = await _get_total_actual(supabase, current_user.id, actual_from, actual_to, mp_filter)
        else:
            total_actual = 0
            for mp in active_mps:
                total_actual += await _get_total_actual(supabase, current_user.id, actual_from, actual_to, mp)
        total_completion = round((total_actual / mp_plan) * 100, 1) if mp_plan > 0 else 0
        return {
            "status": "success",
            "period": {"from": actual_from, "to": actual_to},
            "month_label": label,
            "plan_level": "marketplace",
            "total_plan": round(mp_plan, 2),
            "total_actual": round(total_actual, 2),
            "completion_percent": total_completion,
            "by_product": [],
            **_calc_pace_forecast(plan_months, total_actual, mp_plan),
        }

    # Priority 3: per-product plans
    plans_query = supabase.table("mp_sales_plan") \
        .select("product_id, plan_revenue, month, marketplace") \
        .eq("user_id", current_user.id) \
        .in_("month", months_list)

    if mp_filter:
        plans_query = plans_query.eq("marketplace", mp_filter)

    plans_result = plans_query.execute()

    plan_by_product: dict[str, float] = {}
    product_plan_months: set[str] = set()
    for p in plans_result.data:
        if float(p["plan_revenue"]) > 0:
            pid = p["product_id"]
            plan_by_product[pid] = plan_by_product.get(pid, 0) + float(p["plan_revenue"])
            product_plan_months.add(p["month"][:10])

    if not plan_by_product:
        label = _make_label(months_list)
        return {
            "status": "success",
            "period": {"from": months_list[0], "to": today},
            "month_label": label,
            "plan_level": "none",
            "total_plan": 0,
            "total_actual": 0,
            "completion_percent": 0,
            "by_product": [],
            "pace_daily": 0, "required_pace": 0,
            "forecast_revenue": 0, "forecast_percent": 0,
            "days_elapsed": 0, "days_remaining": 0, "days_total": 0,
        }

    # Actual revenue — only for months that have product plans
    plan_months_sorted = sorted(product_plan_months)
    actual_from, actual_to = _plan_months_range(plan_months_sorted, today)
    label = _make_label(plan_months_sorted)

    sales_query = supabase.table("mp_sales") \
        .select("product_id, revenue") \
        .eq("user_id", current_user.id) \
        .gte("date", actual_from) \
        .lte("date", actual_to)

    if mp_filter:
        sales_query = sales_query.eq("marketplace", mp_filter)

    sales_result = sales_query.limit(50000).execute()

    actual_by_product: dict[str, float] = {}
    for s in sales_result.data:
        pid = s["product_id"]
        actual_by_product[pid] = actual_by_product.get(pid, 0) + float(s.get("revenue", 0))

    # Product names
    all_pids = list(set(list(plan_by_product.keys()) + list(actual_by_product.keys())))
    products_result = supabase.table("mp_products") \
        .select("id, name") \
        .eq("user_id", current_user.id) \
        .in_("id", all_pids) \
        .execute()
    products_map = {p["id"]: p["name"] for p in products_result.data}

    by_product = []
    for pid, plan_rev in plan_by_product.items():
        actual_rev = actual_by_product.get(pid, 0)
        completion = round((actual_rev / plan_rev) * 100, 1) if plan_rev > 0 else 0
        by_product.append({
            "product_id": pid,
            "product_name": products_map.get(pid, "Unknown"),
            "plan_revenue": round(plan_rev, 2),
            "actual_revenue": round(actual_rev, 2),
            "completion_percent": completion,
        })

    by_product.sort(key=lambda x: x["completion_percent"], reverse=True)

    total_plan = sum(p["plan_revenue"] for p in by_product)
    total_actual = sum(p["actual_revenue"] for p in by_product)
    total_completion = round((total_actual / total_plan) * 100, 1) if total_plan > 0 else 0

    return {
        "status": "success",
        "period": {"from": actual_from, "to": actual_to},
        "month_label": label,
        "plan_level": "product",
        "total_plan": round(total_plan, 2),
        "total_actual": round(total_actual, 2),
        "completion_percent": total_completion,
        "by_product": by_product,
        **_calc_pace_forecast(plan_months_sorted, total_actual, total_plan),
    }


def _plan_months_range(plan_months: list[str], today: str) -> tuple[str, str]:
    """Compute actual date range from months that have plans.
    Returns (actual_from, actual_to) covering only plan months."""
    if not plan_months:
        return (today, today)
    actual_from = plan_months[0]  # first day of first plan month
    last_month_end = month_last_day(plan_months[-1])
    actual_to = min(today, last_month_end)
    return (actual_from, actual_to)


def _make_label(plan_months: list[str]) -> str:
    """Build a label like 'Февраль 2026' or 'Январь 2026 — Февраль 2026'."""
    if not plan_months:
        return ""
    if len(plan_months) == 1:
        return month_label_ru(plan_months[0][:7])
    return f"{month_label_ru(plan_months[0][:7])} — {month_label_ru(plan_months[-1][:7])}"


async def _get_total_actual(supabase, user_id: str, date_from: str, date_to: str, marketplace: str | None) -> float:
    """Helper: sum all mp_sales.revenue for the period."""
    query = supabase.table("mp_sales") \
        .select("revenue") \
        .eq("user_id", user_id) \
        .gte("date", date_from) \
        .lte("date", date_to)
    if marketplace:
        query = query.eq("marketplace", marketplace)
    result = query.limit(50000).execute()
    return sum(float(r.get("revenue", 0)) for r in result.data)


def _calc_pace_forecast(plan_months: list[str], total_actual: float, total_plan: float) -> dict:
    """Calculate pace, forecast and day metrics for plan completion."""
    if not plan_months or total_plan <= 0:
        return {
            "pace_daily": 0, "required_pace": 0,
            "forecast_revenue": 0, "forecast_percent": 0,
            "days_elapsed": 0, "days_remaining": 0, "days_total": 0,
        }

    today = date_type.today()
    first_day = datetime.strptime(plan_months[0], "%Y-%m-%d").date()
    last_month = plan_months[-1]
    parts = last_month.split("-")
    _, last_d = monthrange(int(parts[0]), int(parts[1]))
    last_day = date_type(int(parts[0]), int(parts[1]), last_d)

    # Total days in all plan months
    days_total = 0
    for m in plan_months:
        mp = m.split("-")
        _, md = monthrange(int(mp[0]), int(mp[1]))
        days_total += md

    days_elapsed = max(0, (min(today, last_day) - first_day).days + 1)
    days_remaining = max(0, (last_day - today).days) if today <= last_day else 0

    pace_daily = round(total_actual / days_elapsed, 2) if days_elapsed > 0 else 0
    required_pace = round((total_plan - total_actual) / days_remaining, 2) if days_remaining > 0 else 0
    forecast_revenue = round(total_actual + pace_daily * days_remaining, 2)
    forecast_percent = round((forecast_revenue / total_plan) * 100, 1) if total_plan > 0 else 0

    return {
        "pace_daily": pace_daily,
        "required_pace": required_pace,
        "forecast_revenue": forecast_revenue,
        "forecast_percent": forecast_percent,
        "days_elapsed": days_elapsed,
        "days_remaining": days_remaining,
        "days_total": days_total,
    }


# ==================== PREVIOUS MONTH ====================

@router.get("/sales-plan/previous")
async def get_previous_plan(
    current_user: CurrentUser = Depends(get_current_user),
    month: Optional[str] = Query(None, description="YYYY-MM"),
):
    """Get plans from the previous month (for copy feature)."""
    supabase = get_supabase_client()

    if not month:
        month = datetime.now().strftime("%Y-%m")

    month_date = normalize_month(month)
    prev = datetime.strptime(month_date, "%Y-%m-%d") - relativedelta(months=1)
    prev_month = prev.strftime("%Y-%m-%d")

    # Summary plans
    summary_result = supabase.table("mp_sales_plan_summary") \
        .select("level, plan_revenue") \
        .eq("user_id", current_user.id) \
        .eq("month", prev_month) \
        .execute()

    summary = {"total": 0, "wb": 0, "ozon": 0}
    for row in summary_result.data:
        if row["level"] in summary:
            summary[row["level"]] = float(row["plan_revenue"])

    # Per-product plans
    plans_result = supabase.table("mp_sales_plan") \
        .select("product_id, plan_revenue, marketplace") \
        .eq("user_id", current_user.id) \
        .eq("month", prev_month) \
        .execute()

    plans = [
        {"product_id": p["product_id"], "plan_revenue": float(p["plan_revenue"]), "marketplace": p["marketplace"]}
        for p in plans_result.data if float(p["plan_revenue"]) > 0
    ]

    has_previous = summary["total"] > 0 or summary["wb"] > 0 or summary["ozon"] > 0 or len(plans) > 0

    return {
        "status": "success",
        "has_previous": has_previous,
        "prev_month": prev.strftime("%Y-%m"),
        "summary": summary,
        "plans": plans,
    }

