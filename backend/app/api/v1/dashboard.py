"""
Роутер для дашборда - сводная аналитика
"""
import logging
from fastapi import APIRouter, HTTPException, Query, Depends
from typing import Optional
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

from ...db.supabase import get_supabase_client
from ...auth import CurrentUser, get_current_user, get_current_user_or_cron
from ...subscription import get_user_subscription, get_subscription_or_cron, UserSubscription, require_feature, has_feature
from ...plans import has_feature

router = APIRouter()


# ─── Costs-tree FBO/FBS merge helpers ─────────────────────────────────────────
# WB reportDetailByPeriod может не содержать FBS-данные в mp_costs_details
# (поля isSupply/delivery_type_id отсутствуют в ряде версий API).
# FBS-данные при этом могут быть в mp_costs/mp_sales (из других sync-пайплайнов).
# При fulfillment_type=NULL ("Все") RPC видит mp_costs_details (только FBO) и
# игнорирует FBS. Для корректного суммирования: FBO из primary + FBS из fallback.

def _merge_costs_tree_data(primary: dict, supplement: dict) -> dict:
    """
    Merge two costs-tree RPC responses (primary + supplement).
    Суммирует total_accrued, total_revenue, объединяет tree items по name.
    """
    if not supplement:
        return primary
    if not primary:
        return supplement

    p_accrued = float(primary.get("total_accrued") or 0)
    s_accrued = float(supplement.get("total_accrued") or 0)
    p_revenue = float(primary.get("total_revenue") or 0)
    s_revenue = float(supplement.get("total_revenue") or 0)
    p_sales = float(primary.get("percent_base_sales") or 0)
    s_sales = float(supplement.get("percent_base_sales") or 0)

    # Merge tree items by category name
    tree_map: dict[str, dict] = {}
    for item in (primary.get("tree") or []):
        name = item.get("name", "")
        tree_map[name] = {
            "name": name,
            "amount": float(item.get("amount") or 0),
            "percent": item.get("percent"),
            "children": list(item.get("children") or []),
        }

    for item in (supplement.get("tree") or []):
        name = item.get("name", "")
        amount = float(item.get("amount") or 0)
        if abs(amount) < 0.01:
            continue
        if name in tree_map:
            tree_map[name]["amount"] = round(tree_map[name]["amount"] + amount, 2)
            # Merge children по subcategory name
            existing_children = tree_map[name].get("children") or []
            new_children = item.get("children") or []
            if new_children:
                child_map = {}
                for c in existing_children:
                    cn = c.get("name", "")
                    child_map[cn] = {**c, "amount": float(c.get("amount") or 0)}
                for c in new_children:
                    cn = c.get("name", "")
                    ca = float(c.get("amount") or 0)
                    if cn in child_map:
                        child_map[cn]["amount"] = round(child_map[cn]["amount"] + ca, 2)
                    else:
                        child_map[cn] = {**c, "amount": ca}
                tree_map[name]["children"] = list(child_map.values())
        else:
            tree_map[name] = {
                "name": name,
                "amount": round(amount, 2),
                "percent": item.get("percent"),
                "children": list(item.get("children") or []),
            }

    return {
        "status": "success",
        "period": primary.get("period"),
        "marketplace": primary.get("marketplace"),
        "total_accrued": round(p_accrued + s_accrued, 2),
        "total_revenue": round(p_revenue + s_revenue, 2),
        "percent_base_sales": round(p_sales + s_sales, 2),
        "source": "merged",
        "tree": list(tree_map.values()),
    }


def _fetch_costs_tree_merged(
    supabase,
    date_from: str,
    date_to: str,
    marketplace: str | None,
    product_id: str | None,
    include_children: bool,
    user_id: str,
    fulfillment_type: str | None,
) -> dict:
    """
    Fetch costs-tree с автоматическим FBO+FBS merge при fulfillment_type=None.
    Когда FT задан (FBO/FBS) — один вызов RPC.
    Когда FT=None ("Все") — два вызова (FBO + FBS), результат объединяется.
    """
    params = {
        "p_date_from": date_from,
        "p_date_to": date_to,
        "p_marketplace": marketplace,
        "p_product_id": product_id,
        "p_include_children": include_children,
        "p_user_id": user_id,
    }

    if fulfillment_type is not None:
        params["p_fulfillment_type"] = fulfillment_type
        result = supabase.rpc("get_costs_tree", params).execute()
        return result.data

    # FT=None → fetch FBO и FBS отдельно, merge
    fbo_params = {**params, "p_fulfillment_type": "FBO"}
    fbs_params = {**params, "p_fulfillment_type": "FBS"}

    fbo_data = supabase.rpc("get_costs_tree", fbo_params).execute().data
    fbs_data = supabase.rpc("get_costs_tree", fbs_params).execute().data

    # Если FBS пуст — возвращаем FBO as-is (частый случай)
    fbs_accrued = float(fbs_data.get("total_accrued") or 0) if fbs_data else 0
    fbs_revenue = float(fbs_data.get("total_revenue") or 0) if fbs_data else 0
    if abs(fbs_accrued) < 0.01 and abs(fbs_revenue) < 0.01:
        return fbo_data

    return _merge_costs_tree_data(fbo_data, fbs_data)


@router.get("/dashboard/summary")
async def get_summary(
    current_user: CurrentUser = Depends(get_current_user),
    sub: UserSubscription = Depends(get_user_subscription),
    date_from: Optional[str] = Query(None, description="Дата начала (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="Дата окончания (YYYY-MM-DD)"),
    marketplace: Optional[str] = Query(None, description="Фильтр по МП: wb, ozon"),
    fulfillment_type: Optional[str] = Query(None, pattern="^(FBO|FBS)$", description="Фильтр по типу фулфилмента"),
    include_prev_period: bool = Query(False, description="Включить данные предыдущего периода"),
    include_ozon_truth: bool = Query(False, description="Использовать 'истинную' выручку Ozon из costs-tree")
):
    """
    Сводка по продажам за период (использует RPC для оптимизации).
    """
    # Feature gate: period comparison requires pro+
    if include_prev_period and not has_feature(sub.plan, "period_comparison"):
        include_prev_period = False

    # Feature gate: FBS analytics requires pro+
    if fulfillment_type and not has_feature(sub.plan, "fbs_analytics"):
        fulfillment_type = None

    supabase = get_supabase_client()

    if not date_from:
        date_from = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    if not date_to:
        date_to = datetime.now().strftime("%Y-%m-%d")

    try:
        if include_prev_period:
            result = supabase.rpc(
                "get_dashboard_summary_with_prev",
                {
                    "p_date_from": date_from,
                    "p_date_to": date_to,
                    "p_marketplace": marketplace,
                    "p_include_costs_tree_revenue": include_ozon_truth,
                    "p_user_id": current_user.id,
                    "p_fulfillment_type": fulfillment_type,
                }
            ).execute()
        else:
            result = supabase.rpc(
                "get_dashboard_summary",
                {
                    "p_date_from": date_from,
                    "p_date_to": date_to,
                    "p_marketplace": marketplace,
                    "p_user_id": current_user.id,
                    "p_fulfillment_type": fulfillment_type,
                }
            ).execute()

        return result.data

    except Exception as e:
        logger.exception("Endpoint error: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/dashboard/unit-economics")
async def get_unit_economics(
    current_user: CurrentUser = Depends(get_current_user_or_cron),
    sub: UserSubscription = Depends(get_subscription_or_cron),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    marketplace: Optional[str] = Query(None),
    fulfillment_type: Optional[str] = Query(None, pattern="^(FBO|FBS)$"),
):
    """
    Unit-экономика по товарам.
    - Ozon: revenue/sales из mp_sales (order-based), удержания оценены через payout rate
      из costs-tree (mp_costs = settlement-based, нельзя использовать напрямую)
    - WB: proportional payout из costs-tree
    - Закупка: purchase_price × sales_count (order-based, все МП)
    - Реклама: mp_ad_costs per product
    """
    # Feature gate (cron bypasses — internal access)
    if current_user.email != "cron@system" and not has_feature(sub.plan, "unit_economics"):
        raise HTTPException(status_code=403, detail="Feature 'unit_economics' requires Pro plan")

    supabase = get_supabase_client()

    # Feature gate: FBS filtering requires Pro+ plan
    include_ft_breakdown = True
    if fulfillment_type and not has_feature(sub.plan, "fbs_analytics"):
        fulfillment_type = None
    if not has_feature(sub.plan, "fbs_analytics"):
        include_ft_breakdown = False

    if not date_from:
        date_from = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    if not date_to:
        date_to = datetime.now().strftime("%Y-%m-%d")

    try:
        # 1. Продукты пользователя
        products_result = supabase.table("mp_products").select("*").eq("user_id", current_user.id).limit(500).execute()
        products = {p["id"]: p for p in products_result.data}

        # 2. Продажи (mp_sales — аналитика, все заказы)
        sales_query = supabase.table("mp_sales").select("*").eq("user_id", current_user.id).gte("date", date_from).lte("date", date_to)
        if marketplace and marketplace != "all":
            sales_query = sales_query.eq("marketplace", marketplace)
        if fulfillment_type:
            sales_query = sales_query.eq("fulfillment_type", fulfillment_type)
        sales_result = sales_query.limit(50000).execute()

        # 3. Удержания МП (mp_costs) — для отображения в таблице
        costs_query = supabase.table("mp_costs").select("*").eq("user_id", current_user.id).gte("date", date_from).lte("date", date_to)
        if marketplace and marketplace != "all":
            costs_query = costs_query.eq("marketplace", marketplace)
        if fulfillment_type:
            costs_query = costs_query.eq("fulfillment_type", fulfillment_type)
        costs_result = costs_query.limit(50000).execute()

        # 4. Рекламные расходы по товарам (mp_ad_costs) — NOT filtered by fulfillment_type (account-level)
        ad_query = supabase.table("mp_ad_costs").select("product_id, cost").eq("user_id", current_user.id).gte("date", date_from).lte("date", date_to)
        if marketplace and marketplace != "all":
            ad_query = ad_query.eq("marketplace", marketplace)
        ad_result = ad_query.limit(10000).execute()

        # Агрегация рекламы по product_id
        ad_by_product: dict[str, float] = {}
        unattributed_ad = 0.0
        for ad in ad_result.data:
            cost = float(ad.get("cost", 0) or 0)
            pid = ad.get("product_id")
            if pid:
                ad_by_product[pid] = ad_by_product.get(pid, 0) + cost
            else:
                unattributed_ad += cost

        # 4a. При фильтре по fulfillment_type: пропорциональное распределение рекламы
        # Реклама — account-level, не привязана к FBO/FBS. Чтобы profit_FBO + profit_FBS = profit_Total,
        # распределяем рекламу пропорционально: ad_ft = ad × (revenue_ft / revenue_total) per product.
        total_revenue_by_product: dict[str, float] = {}
        if fulfillment_type:
            total_sales_query = supabase.table("mp_sales").select("product_id, revenue").eq("user_id", current_user.id).gte("date", date_from).lte("date", date_to)
            if marketplace and marketplace != "all":
                total_sales_query = total_sales_query.eq("marketplace", marketplace)
            # NO fulfillment_type filter — total revenue across FBO+FBS
            total_sales_result = total_sales_query.limit(50000).execute()
            for sale in total_sales_result.data:
                pid = sale["product_id"]
                total_revenue_by_product[pid] = total_revenue_by_product.get(pid, 0) + float(sale.get("revenue", 0))

        # 5. Агрегация продаж и удержаний по товарам
        product_metrics: dict[str, dict] = {}

        # 5a. FBO/FBS breakdown per product (when not filtered by fulfillment_type)
        ft_sales: dict[str, dict[str, dict]] = {}  # {product_id: {FBO: {sales, revenue}, FBS: {...}}}
        ft_costs: dict[str, dict[str, float]] = {}  # {product_id: {FBO: costs, FBS: costs}}

        ozon_product_ids: set[str] = set()  # product_id's с Ozon costs

        # Per-MP revenue/sales tracking (for dual-MP products in "all" filter)
        per_mp_sales: dict[str, dict[str, dict]] = {}  # {product_id: {ozon: {sales, revenue}, wb: {...}}}

        for sale in sales_result.data:
            product_id = sale["product_id"]
            if product_id not in product_metrics:
                product_metrics[product_id] = {"sales": 0, "revenue": 0, "costs": 0, "returns": 0}
            product_metrics[product_id]["sales"] += sale.get("sales_count", 0)
            product_metrics[product_id]["revenue"] += float(sale.get("revenue", 0))
            product_metrics[product_id]["returns"] += sale.get("returns_count", 0) or 0

            # Track per-MP (needed when filter="all" and product on both MPs)
            sale_mp = sale.get("marketplace", "wb")
            if product_id not in per_mp_sales:
                per_mp_sales[product_id] = {}
            if sale_mp not in per_mp_sales[product_id]:
                per_mp_sales[product_id][sale_mp] = {"sales": 0, "revenue": 0.0}
            per_mp_sales[product_id][sale_mp]["sales"] += sale.get("sales_count", 0)
            per_mp_sales[product_id][sale_mp]["revenue"] += float(sale.get("revenue", 0))

            # Track per fulfillment_type (only for Pro+ with fbs_analytics)
            if include_ft_breakdown and not fulfillment_type:
                ft = sale.get("fulfillment_type", "FBO") or "FBO"
                if product_id not in ft_sales:
                    ft_sales[product_id] = {}
                if ft not in ft_sales[product_id]:
                    ft_sales[product_id][ft] = {"sales": 0, "revenue": 0}
                ft_sales[product_id][ft]["sales"] += sale.get("sales_count", 0)
                ft_sales[product_id][ft]["revenue"] += float(sale.get("revenue", 0))

        for cost in costs_result.data:
            product_id = cost["product_id"]

            cost_mp = cost.get("marketplace", "")
            if cost_mp == "ozon":
                ozon_product_ids.add(product_id)

            if product_id not in product_metrics:
                continue
            product_metrics[product_id]["costs"] += float(cost.get("total_costs", 0))

            # Track per fulfillment_type (only for Pro+ with fbs_analytics)
            if include_ft_breakdown and not fulfillment_type:
                ft = cost.get("fulfillment_type", "FBO") or "FBO"
                if product_id not in ft_costs:
                    ft_costs[product_id] = {}
                ft_costs[product_id][ft] = ft_costs[product_id].get(ft, 0) + float(cost.get("total_costs", 0))

        # 6. Costs-tree: payout (total_accrued) + revenue ("Продажи") + credits (СПП и т.д.)
        #    Используем payout для расчёта прибыли — точно как на дашборде.
        #    Credits (WB: СПП, возмещения) включаем в displayed_revenue,
        #    чтобы "Продажи" на дашборде и UE совпадали.
        total_mp_sales_revenue = sum(m["revenue"] for m in product_metrics.values())
        costs_tree_sales = 0.0  # Только tree item "Продажи" (для ratio)
        costs_tree_credits = 0.0  # Положительные items кроме "Продажи" (СПП, возмещения)
        total_payout = 0.0
        # Per-MP payout for exact Ozon method
        payout_by_mp: dict[str, float] = {}
        sales_by_mp: dict[str, float] = {}
        credits_by_mp: dict[str, float] = {}
        try:
            mp_list = [marketplace] if marketplace and marketplace != "all" else ["ozon", "wb"]
            for mp in mp_list:
                ct_data = _fetch_costs_tree_merged(
                    supabase, date_from, date_to, mp, None,
                    False, current_user.id, fulfillment_type,
                )
                if ct_data:
                    if isinstance(ct_data, list) and len(ct_data) > 0:
                        ct_data = ct_data[0]
                    if isinstance(ct_data, dict):
                        mp_payout = float(ct_data.get("total_accrued", 0) or 0)
                        total_payout += mp_payout
                        payout_by_mp[mp] = mp_payout
                        mp_tree_sales = 0.0
                        mp_tree_credits = 0.0
                        for item in ct_data.get("tree", []):
                            name = item.get("name", "")
                            amount = float(item.get("amount", 0) or 0)
                            if name == "Продажи":
                                costs_tree_sales += abs(amount)
                                mp_tree_sales += abs(amount)
                            elif amount > 0:
                                # Положительные: СПП, возмещения и т.д.
                                costs_tree_credits += amount
                                mp_tree_credits += amount
                        sales_by_mp[mp] = mp_tree_sales
                        credits_by_mp[mp] = mp_tree_credits
        except Exception as e:
            logger.warning(f"costs-tree RPC failed for unit-economics (marketplace={marketplace}): {e}")
            # fallback на mp_sales/mp_costs

        # revenue с учётом credits (для отображения: "Продажи" вкл. СПП)
        costs_tree_revenue = costs_tree_sales + costs_tree_credits

        # Флаг: есть ли данные costs-tree для расчёта через payout
        use_payout = total_payout != 0

        # 7. Распределение неатрибутированной рекламы (без product_id) пропорционально выручке
        if unattributed_ad > 0 and total_mp_sales_revenue > 0:
            for pid, m in product_metrics.items():
                share = m["revenue"] / total_mp_sales_revenue
                ad_by_product[pid] = ad_by_product.get(pid, 0) + unattributed_ad * share

        # 7b. Ozon UE: PRIMARY = delivery_date (доставлено), FALLBACK = order_date (заказано).
        #
        # delivery_date approach (matches Ozon LK exactly):
        #   1) Из mp_orders: get delivered orders WHERE delivery_date BETWEEN from AND to
        #   2) Use their order_dates to filter mp_costs_details (finance data)
        #   3) COGS: purchase_price × delivered_count (from mp_orders)
        #
        # Fallback (if no delivery_date data synced yet):
        #   Current logic: mp_costs_details WHERE order_date BETWEEN from AND to
        ozon_order_date_by_product: dict[str, dict] = {}  # {product_id: {payout, revenue}}
        ozon_order_date_ft_by_product: dict[str, dict[str, dict]] = {}  # {product_id: {FBO: {payout, revenue}, FBS: ...}}

        # Delivered counts per product (from mp_orders with delivery_date)
        ozon_delivered_counts: dict[str, int] = {}  # {product_id: delivered_qty}
        ozon_delivered_ft_counts: dict[str, dict[str, int]] = {}  # {product_id: {FBO: qty, FBS: qty}}

        # Subcategories excluded from UE payout (not shown in ЛК UE, stay in costs-tree)
        _UE_EXCLUDED_SUBCATEGORIES = {"Бонусы продавца"}

        # Flag: are we using delivery_date or order_date filtering?
        using_delivery_date = False

        def _accumulate_od_row(pid: str, amt: float, cat: str, ft_val: str, subcat: str = ""):
            """Accumulate order_date row into per-product and per-FT dicts."""
            if subcat in _UE_EXCLUDED_SUBCATEGORIES:
                return
            if pid not in ozon_order_date_by_product:
                ozon_order_date_by_product[pid] = {"payout": 0.0, "revenue": 0.0}
            ozon_order_date_by_product[pid]["payout"] += amt
            if cat == "Продажи" or amt > 0:
                ozon_order_date_by_product[pid]["revenue"] += abs(amt)
            if include_ft_breakdown and not fulfillment_type:
                if pid not in ozon_order_date_ft_by_product:
                    ozon_order_date_ft_by_product[pid] = {}
                if ft_val not in ozon_order_date_ft_by_product[pid]:
                    ozon_order_date_ft_by_product[pid][ft_val] = {"payout": 0.0, "revenue": 0.0}
                ozon_order_date_ft_by_product[pid][ft_val]["payout"] += amt
                if cat == "Продажи" or amt > 0:
                    ozon_order_date_ft_by_product[pid][ft_val]["revenue"] += abs(amt)

        try:
            if not marketplace or marketplace in ("all", "ozon"):
                # Step A: Try RPC get_ozon_ue_delivered (Rule #49: single SQL, exact JOIN)
                # Returns both delivered orders (source='order') and their costs (source='cost')
                # Uses posting_number JOIN (exact) with order_date fallback (legacy data)
                try:
                    rpc_params = {
                        "p_user_id": current_user.id,
                        "p_date_from": date_from,
                        "p_date_to": date_to,
                    }
                    if fulfillment_type:
                        rpc_params["p_fulfillment_type"] = fulfillment_type
                    rpc_result = supabase.rpc("get_ozon_ue_delivered", rpc_params).execute()

                    if rpc_result.data and len(rpc_result.data) > 0:
                        order_rows = [r for r in rpc_result.data if r.get("source") == "order"]
                        cost_rows = [r for r in rpc_result.data if r.get("source") == "cost"]

                        if order_rows:
                            using_delivery_date = True

                            for row in cost_rows:
                                pid = row.get("product_id")
                                if not pid:
                                    continue
                                amt = float(row.get("amount", 0) or 0)
                                cat = row.get("category", "")
                                subcat = row.get("subcategory", "")
                                ft_val = row.get("fulfillment_type", "FBO") or "FBO"
                                _accumulate_od_row(pid, amt, cat, ft_val, subcat)
                                # Count delivered from settled finance: each delivery has
                                # exactly one "Выручка" entry. This matches ЛК exactly
                                # (orders with delivery_date but no finance record yet
                                # are NOT counted — Ozon hasn't settled them).
                                if cat == "Продажи" and subcat == "Выручка":
                                    ozon_delivered_counts[pid] = ozon_delivered_counts.get(pid, 0) + 1
                                    if pid not in ozon_delivered_ft_counts:
                                        ozon_delivered_ft_counts[pid] = {}
                                    ozon_delivered_ft_counts[pid][ft_val] = ozon_delivered_ft_counts[pid].get(ft_val, 0) + 1

                            logger.info(f"UE Ozon: RPC delivery_date — "
                                        f"{len(order_rows)} order rows, "
                                        f"{len(cost_rows)} cost rows, "
                                        f"delivered counts: {dict(ozon_delivered_counts)}")
                except Exception as e:
                    logger.debug(f"get_ozon_ue_delivered RPC failed (may not exist yet): {e}")

                if not using_delivery_date:
                    # Fallback: order_date mode (current logic)
                    od_query = (
                        supabase.table("mp_costs_details")
                        .select("product_id, category, subcategory, amount, fulfillment_type")
                        .eq("user_id", current_user.id)
                        .eq("marketplace", "ozon")
                        .gte("order_date", date_from)
                        .lte("order_date", date_to)
                    )
                    if fulfillment_type:
                        od_query = od_query.eq("fulfillment_type", fulfillment_type)
                    od_result = od_query.limit(50000).execute()

                    for row in od_result.data:
                        pid = row["product_id"]
                        amt = float(row.get("amount", 0) or 0)
                        cat = row.get("category", "")
                        subcat = row.get("subcategory", "")
                        ft_val = row.get("fulfillment_type", "FBO") or "FBO"
                        _accumulate_od_row(pid, amt, cat, ft_val, subcat)

                # Query 2a: check per-product DAILY storage from mp_storage_costs_daily
                # (Ozon Placement Report XLSX with daily granularity).
                # If available → use exact per-product daily storage instead of equal distribution.
                per_product_storage: dict[str, float] = {}  # {product_id: total_storage_cost}
                try:
                    daily_storage_q = (
                        supabase.table("mp_storage_costs_daily")
                        .select("product_id, storage_cost")
                        .eq("user_id", current_user.id)
                        .eq("marketplace", "ozon")
                        .gte("date", date_from)
                        .lte("date", date_to)
                        .limit(10000)
                    )
                    daily_storage_result = daily_storage_q.execute()
                    if daily_storage_result.data:
                        for sr in daily_storage_result.data:
                            s_pid = sr["product_id"]
                            s_cost = float(sr.get("storage_cost", 0) or 0)
                            per_product_storage[s_pid] = per_product_storage.get(s_pid, 0) + s_cost
                except Exception as e:
                    logger.debug(f"mp_storage_costs_daily query failed (table may not exist): {e}")

                # Fallback: try legacy mp_storage_costs (period-based) if daily table empty
                if not per_product_storage:
                    try:
                        legacy_q = (
                            supabase.table("mp_storage_costs")
                            .select("product_id, storage_cost, date_from, date_to")
                            .eq("user_id", current_user.id)
                            .eq("marketplace", "ozon")
                            .lte("date_from", date_to)
                            .gte("date_to", date_from)
                            .limit(1000)
                        )
                        legacy_result = legacy_q.execute()
                        if legacy_result.data:
                            for sr in legacy_result.data:
                                s_pid = sr["product_id"]
                                s_cost = float(sr.get("storage_cost", 0) or 0)
                                s_from = sr.get("date_from", "")
                                s_to = sr.get("date_to", "")
                                try:
                                    report_days = (datetime.strptime(s_to, "%Y-%m-%d") - datetime.strptime(s_from, "%Y-%m-%d")).days + 1
                                    if report_days <= 0:
                                        report_days = 29
                                except Exception:
                                    report_days = 28
                                request_days = (datetime.strptime(date_to, "%Y-%m-%d") - datetime.strptime(date_from, "%Y-%m-%d")).days + 1
                                prorated = s_cost * min(request_days, report_days) / report_days
                                per_product_storage[s_pid] = per_product_storage.get(s_pid, 0) + prorated
                    except Exception as e:
                        logger.debug(f"mp_storage_costs legacy query failed: {e}")

                has_per_product_storage = bool(per_product_storage)
                if has_per_product_storage:
                    logger.info(f"UE Ozon: using per-product storage for {len(per_product_storage)} products "
                                f"(total={sum(per_product_storage.values()):.2f} RUB)")

                # Query 2: account-level operations (order_date IS NULL, e.g. storage fees)
                # These have no order_date → use settlement date as period filter
                null_od_query = (
                    supabase.table("mp_costs_details")
                    .select("product_id, category, subcategory, amount, fulfillment_type")
                    .eq("user_id", current_user.id)
                    .eq("marketplace", "ozon")
                    .is_("order_date", "null")
                    .gte("date", date_from)
                    .lte("date", date_to)
                )
                if fulfillment_type:
                    null_od_query = null_od_query.eq("fulfillment_type", fulfillment_type)
                null_od_result = null_od_query.limit(10000).execute()

                for row in null_od_result.data:
                    pid = row["product_id"]
                    amt = float(row.get("amount", 0) or 0)
                    cat = row.get("category", "")
                    subcat = row.get("subcategory", "")
                    ft_val = row.get("fulfillment_type", "FBO") or "FBO"

                    # Skip equally-distributed storage if we have per-product daily data
                    if has_per_product_storage and subcat == "Размещение товаров":
                        continue

                    _accumulate_od_row(pid, amt, cat, ft_val, subcat)

                # Apply per-product daily storage to payout (storage is a NEGATIVE charge)
                if has_per_product_storage:
                    for pid, storage_cost in per_product_storage.items():
                        if pid not in ozon_order_date_by_product:
                            ozon_order_date_by_product[pid] = {"payout": 0.0, "revenue": 0.0}
                        # storage_cost is positive (amount from XLSX), subtract from payout
                        ozon_order_date_by_product[pid]["payout"] -= storage_cost
        except Exception as e:
            logger.warning(f"order_date query failed for Ozon UE: {e}")
            # fallback: ozon_order_date_by_product stays empty → payout_rate method will be used

        # 8. Формирование результата
        # Ozon PRIMARY (delivery_date): filter mp_costs_details by order_dates of
        #   delivered orders (delivery_date BETWEEN from AND to in mp_orders).
        #   COGS = purchase_price × delivered_count (from mp_orders).
        #   This matches Ozon LK exactly.
        #
        # Ozon SECONDARY (order_date fallback): if no delivery_date data synced yet,
        #   mp_costs_details WHERE order_date BETWEEN from AND to.
        #   COGS = purchase_price × sales_count (from mp_sales).
        #
        # Ozon FALLBACK: payout RATE from costs-tree (если order_date данных нет).
        #   payout_rate = ozon_payout / ozon_tree_revenue.
        #   profit = mp_sales_revenue × payout_rate - purchase - ads.
        #
        # WB: proportional payout (нет per-product breakdown в costs_details)
        #   displayed_revenue = (costs_tree_sales + credits) × share
        #   profit = wb_payout × share - purchase - ads

        # Per-MP payout и revenue (для proportional share)
        wb_payout = payout_by_mp.get("wb", 0)
        wb_tree_revenue = sales_by_mp.get("wb", 0) + credits_by_mp.get("wb", 0)
        ozon_payout = payout_by_mp.get("ozon", 0)
        ozon_tree_revenue = sales_by_mp.get("ozon", 0) + credits_by_mp.get("ozon", 0)

        # Per-MP product sets (для proportional share среди товаров одного МП)
        wb_product_ids: set[str] = set()
        for pid, product in products.items():
            if product.get("wb_nm_id") and not product.get("ozon_product_id"):
                wb_product_ids.add(pid)
            elif product.get("wb_vendor_code") and not product.get("ozon_product_id"):
                wb_product_ids.add(pid)
        for sale in sales_result.data:
            if sale.get("marketplace") == "wb":
                wb_product_ids.add(sale["product_id"])

        wb_total_mp_sales_revenue = sum(
            product_metrics.get(pid, {}).get("revenue", 0)
            for pid in wb_product_ids
            if pid in product_metrics
        )
        ozon_total_mp_sales_revenue = sum(
            product_metrics.get(pid, {}).get("revenue", 0)
            for pid in ozon_product_ids
            if pid in product_metrics
        )

        # 8a. Per-product storage costs (ALL marketplaces) — DISPLAY ONLY field.
        # Storage is already deducted from profit (Ozon: via payout, WB: via costs-tree proportional).
        # This query provides the `storage_cost` field for UI breakdown visibility.
        all_mp_storage: dict[str, float] = {}  # {product_id: total_storage_cost}
        try:
            all_storage_q = (
                supabase.table("mp_storage_costs_daily")
                .select("product_id, storage_cost")
                .eq("user_id", current_user.id)
                .gte("date", date_from)
                .lte("date", date_to)
                .limit(10000)
            )
            # If marketplace filter is set, only show storage for that MP
            if marketplace and marketplace != "all":
                all_storage_q = all_storage_q.eq("marketplace", marketplace)
            all_storage_result = all_storage_q.execute()
            if all_storage_result.data:
                for sr in all_storage_result.data:
                    s_pid = sr["product_id"]
                    s_cost = float(sr.get("storage_cost", 0) or 0)
                    all_mp_storage[s_pid] = all_mp_storage.get(s_pid, 0) + s_cost
        except Exception as e:
            logger.debug(f"All-MP storage query for display failed: {e}")

        # 8b. Add storage-only products (0 sales but have storage costs)
        # These products exist in mp_storage_costs_daily but not in mp_sales
        for s_pid in all_mp_storage:
            if s_pid not in product_metrics and s_pid in products:
                product_metrics[s_pid] = {"sales": 0, "revenue": 0, "costs": 0, "returns": 0}

        result = []
        for product_id, metrics in product_metrics.items():
            if product_id not in products:
                continue

            product = products[product_id]
            sales_count = metrics["sales"]
            mp_sales_revenue = metrics["revenue"]  # из mp_sales (аналитика)
            costs = metrics["costs"]  # из mp_costs (fallback)
            purchase_price = float(product.get("purchase_price", 0))
            is_ozon = product_id in ozon_product_ids or bool(product.get("ozon_product_id"))
            # Ozon with delivery_date: override sales_count with delivered_count
            # (ЛК shows delivered, not shipped; COGS = purchase_price × delivered)
            if is_ozon and using_delivery_date and product_id in ozon_delivered_counts:
                sales_count = ozon_delivered_counts[product_id]
            raw_purchase = purchase_price * sales_count
            ad_cost = ad_by_product.get(product_id, 0)

            # Check if product has sales on BOTH MPs (dual-MP, filter="all")
            product_mp_data = per_mp_sales.get(product_id, {})
            has_ozon_sales = "ozon" in product_mp_data
            has_wb_sales = "wb" in product_mp_data
            is_dual_mp = has_ozon_sales and has_wb_sales and (not marketplace or marketplace == "all")

            if is_dual_mp and product_id in ozon_order_date_by_product:
                # DUAL-MP: product on both Ozon + WB with filter="all"
                # Calculate each MP separately and combine
                od_data = ozon_order_date_by_product[product_id]
                ozon_order_payout = od_data["payout"]
                ozon_order_revenue = od_data["revenue"]

                # Ozon part
                ozon_sales_count = product_mp_data["ozon"]["sales"]
                if using_delivery_date and product_id in ozon_delivered_counts:
                    ozon_sales_count = ozon_delivered_counts[product_id]
                ozon_purchase = purchase_price * ozon_sales_count
                ozon_profit = ozon_order_payout - ozon_purchase
                ozon_mp_costs = max(0, ozon_order_revenue - ozon_order_payout)

                # WB part (proportional)
                wb_product_rev = product_mp_data["wb"]["revenue"]
                wb_sales_count = product_mp_data["wb"]["sales"]
                wb_purchase = purchase_price * wb_sales_count
                if wb_total_mp_sales_revenue > 0 and wb_tree_revenue > 0:
                    wb_share = wb_product_rev / wb_total_mp_sales_revenue
                    wb_displayed_rev = wb_tree_revenue * wb_share
                    wb_payout_share = wb_payout * wb_share
                else:
                    wb_displayed_rev = wb_product_rev
                    wb_payout_share = wb_product_rev  # fallback
                wb_mp_costs = max(0, wb_displayed_rev - wb_payout_share)
                wb_profit = wb_payout_share - wb_purchase - ad_cost

                # Combined
                displayed_revenue = ozon_order_revenue + wb_displayed_rev
                mp_costs_consistent = ozon_mp_costs + wb_mp_costs
                net_profit = ozon_profit + wb_profit
                sales_count = ozon_sales_count + wb_sales_count
                raw_purchase = ozon_purchase + wb_purchase

            elif is_ozon and product_id in ozon_order_date_by_product:
                # Ozon PRIMARY: delivery_date or order_date-based exact matching.
                # payout = SUM(all mp_costs_details amounts WHERE order_date matches delivered orders).
                # Finance payout already includes ALL deductions (commission, logistics, ads).
                # profit = order_payout - purchase (NO separate ad subtraction — ads already deducted).
                od_data = ozon_order_date_by_product[product_id]
                order_payout = od_data["payout"]
                order_revenue = od_data["revenue"]
                displayed_revenue = order_revenue if order_revenue > 0 else mp_sales_revenue
                mp_costs_consistent = max(0, displayed_revenue - order_payout)
                net_profit = order_payout - raw_purchase
                # Ad cost still tracked for DRR display, but NOT subtracted from profit
                # (it's already inside order_payout as finance deduction)
            elif is_ozon and ozon_tree_revenue > 0:
                # Ozon FALLBACK 1: payout rate from costs-tree.
                # Used when order_date data not yet available (before re-sync).
                payout_rate = ozon_payout / ozon_tree_revenue
                displayed_revenue = mp_sales_revenue
                payout_share = mp_sales_revenue * payout_rate
                mp_costs_consistent = max(0, displayed_revenue - payout_share)
                net_profit = payout_share - raw_purchase - ad_cost
            elif is_ozon:
                # Ozon FALLBACK 2: no costs-tree, no order_date → mp_sales/mp_costs
                displayed_revenue = mp_sales_revenue
                mp_costs_consistent = costs
                net_profit = mp_sales_revenue - costs - raw_purchase - ad_cost
            elif use_payout and total_mp_sales_revenue > 0 and costs_tree_revenue > 0:
                # WB: proportional within WB costs-tree
                if wb_total_mp_sales_revenue > 0 and wb_tree_revenue > 0:
                    share = mp_sales_revenue / wb_total_mp_sales_revenue
                    displayed_revenue = wb_tree_revenue * share
                    payout_share = wb_payout * share
                else:
                    share = mp_sales_revenue / total_mp_sales_revenue if total_mp_sales_revenue > 0 else 0
                    displayed_revenue = costs_tree_revenue * share
                    payout_share = total_payout * share
                mp_costs_consistent = max(0, displayed_revenue - payout_share)
                net_profit = payout_share - raw_purchase - ad_cost
            else:
                # Fallback: если costs-tree недоступен — mp_sales/mp_costs
                displayed_revenue = mp_sales_revenue
                mp_costs_consistent = costs
                net_profit = mp_sales_revenue - costs - raw_purchase - ad_cost

            unit_profit = round(net_profit / sales_count, 2) if sales_count > 0 else 0

            drr = round((ad_cost / displayed_revenue) * 100, 1) if displayed_revenue > 0 and ad_cost > 0 else 0

            # FBO/FBS breakdown (always when no fulfillment_type filter)
            fb: dict | None = None
            if not fulfillment_type and product_id in ft_sales:
                ft_data = ft_sales[product_id]
                fb = {}
                for ft_key in ("FBO", "FBS"):
                    s = ft_data.get(ft_key, {"sales": 0, "revenue": 0})
                    ft_cnt = s["sales"]
                    ft_rev = s["revenue"]
                    # Ozon delivered: override ft_cnt with delivered count per FT
                    if is_ozon and using_delivery_date and product_id in ozon_delivered_ft_counts:
                        ft_cnt = ozon_delivered_ft_counts[product_id].get(ft_key, 0)
                    if ft_cnt <= 0 and ft_rev <= 0:
                        continue
                    c = ft_costs.get(product_id, {}).get(ft_key, 0)
                    ft_purchase = purchase_price * ft_cnt
                    # Proportional ad: ad_ft = ad × (ft_revenue / total_revenue)
                    ft_ad = ad_cost * (ft_rev / mp_sales_revenue) if mp_sales_revenue > 0 else 0
                    if is_ozon and product_id in ozon_order_date_ft_by_product:
                        # Ozon PRIMARY: order_date-based per FT
                        ft_od = ozon_order_date_ft_by_product[product_id].get(ft_key, {})
                        ft_payout = ft_od.get("payout", 0.0)
                        ft_od_revenue = ft_od.get("revenue", 0.0)
                        # profit = ft_payout - ft_purchase (ads already in payout)
                        ft_profit = ft_payout - ft_purchase
                        if ft_od_revenue > 0:
                            ft_rev = ft_od_revenue  # use order_date revenue for display
                    elif is_ozon and ozon_tree_revenue > 0:
                        # Ozon FALLBACK: payout rate per FT
                        ft_payout_rate = ozon_payout / ozon_tree_revenue
                        ft_payout = ft_rev * ft_payout_rate
                        ft_profit = ft_payout - ft_purchase - ft_ad
                    elif use_payout and total_mp_sales_revenue > 0:
                        # WB: proportional payout
                        ft_payout = total_payout * (ft_rev / total_mp_sales_revenue)
                        ft_profit = ft_payout - ft_purchase - ft_ad
                    else:
                        ft_profit = ft_rev - c - ft_purchase - ft_ad
                    ft_margin = (ft_profit / ft_rev * 100) if ft_rev > 0 else 0
                    ft_unit_profit = round(ft_profit / ft_cnt, 2) if ft_cnt > 0 else 0
                    fb[ft_key.lower()] = {
                        "sales_count": ft_cnt,
                        "revenue": round(ft_rev, 2),
                        "net_profit": round(ft_profit, 2),
                        "margin": round(ft_margin, 1),
                        "unit_profit": ft_unit_profit,
                    }

            # Storage cost (display-only): from mp_storage_costs_daily
            product_storage_cost = round(all_mp_storage.get(product_id, 0), 2)

            # Subtract storage from mp_costs for display to avoid double-counting:
            # mp_costs already includes storage (payout = revenue - ALL deductions incl. storage).
            # displayed mp_costs = pure deductions (commission + logistics + other) WITHOUT storage.
            mp_costs_display = max(0, round(mp_costs_consistent - product_storage_cost, 2))

            # For storage-only products (0 sales): profit should reflect storage cost as loss
            if sales_count == 0 and product_storage_cost > 0 and net_profit == 0:
                net_profit = -product_storage_cost

            item: dict = {
                "product": {
                    "id": product_id,
                    "name": product["name"],
                    "barcode": product["barcode"],
                    "purchase_price": purchase_price
                },
                "metrics": {
                    "sales_count": sales_count,
                    "returns_count": metrics["returns"],
                    "revenue": round(displayed_revenue, 2),
                    "mp_costs": mp_costs_display,
                    "storage_cost": product_storage_cost,
                    "purchase_costs": round(raw_purchase, 2),
                    "ad_cost": round(ad_cost, 2),
                    "drr": drr,
                    "net_profit": round(net_profit, 2),
                    "unit_profit": unit_profit
                }
            }
            if fb:
                item["fulfillment_breakdown"] = fb
            result.append(item)

        result.sort(key=lambda x: x["metrics"]["net_profit"], reverse=True)

        total_ad_cost = sum(p["metrics"]["ad_cost"] for p in result)
        total_returns = sum(p["metrics"]["returns_count"] for p in result)
        total_storage_cost = sum(p["metrics"]["storage_cost"] for p in result)

        return {
            "status": "success",
            "period": {"from": date_from, "to": date_to},
            "marketplace": marketplace or "all",
            "costs_tree_ratio": 1.0,  # deprecated: ratio больше не используется, оставлено для совместимости
            "total_ad_cost": round(total_ad_cost, 2),
            "total_payout": round(total_payout, 2),
            "total_returns": total_returns,
            "total_storage_cost": round(total_storage_cost, 2),
            "products": result
        }

    except Exception as e:
        logger.exception("Endpoint error: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/dashboard/sales-chart")
async def get_sales_chart(
    current_user: CurrentUser = Depends(get_current_user),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    marketplace: Optional[str] = Query(None),
    product_id: Optional[str] = Query(None),
    fulfillment_type: Optional[str] = Query(None, pattern="^(FBO|FBS)$"),
):
    """
    Данные для графика продаж (по дням)
    """
    supabase = get_supabase_client()

    if not date_from:
        date_from = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    if not date_to:
        date_to = datetime.now().strftime("%Y-%m-%d")

    try:
        query = supabase.table("mp_sales").select("*").eq("user_id", current_user.id).gte("date", date_from).lte("date", date_to).order("date")

        if marketplace and marketplace != "all":
            query = query.eq("marketplace", marketplace)
        if product_id:
            query = query.eq("product_id", product_id)
        if fulfillment_type:
            query = query.eq("fulfillment_type", fulfillment_type)

        result = query.limit(50000).execute()

        chart_data = {}
        for sale in result.data:
            date = sale["date"]
            if date not in chart_data:
                chart_data[date] = {
                    "date": date,
                    "orders": 0,
                    "sales": 0,
                    "revenue": 0
                }
            chart_data[date]["orders"] += sale.get("orders_count", 0)
            chart_data[date]["sales"] += sale.get("sales_count", 0)
            chart_data[date]["revenue"] += float(sale.get("revenue", 0))

        for date_key in chart_data:
            sales_count = chart_data[date_key]["sales"]
            revenue = chart_data[date_key]["revenue"]
            chart_data[date_key]["avg_check"] = round(revenue / sales_count, 2) if sales_count > 0 else 0

        chart_data_list = list(chart_data.values())
        chart_data_list.sort(key=lambda x: x["date"])

        return {
            "status": "success",
            "period": {"from": date_from, "to": date_to},
            "data": chart_data_list
        }

    except Exception as e:
        logger.exception("Endpoint error: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/dashboard/ad-costs")
async def get_ad_costs(
    current_user: CurrentUser = Depends(get_current_user),
    sub: UserSubscription = Depends(require_feature("ads_page")),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    marketplace: Optional[str] = Query(None),
    fulfillment_type: Optional[str] = Query(None, pattern="^(FBO|FBS)$"),
    include_prev_period: bool = Query(False),
):
    """
    Рекламные расходы и ДРР за период (по дням)
    """
    supabase = get_supabase_client()

    if not date_from:
        date_from = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    if not date_to:
        date_to = datetime.now().strftime("%Y-%m-%d")

    try:
        ads_query = supabase.table("mp_ad_costs").select("*").eq("user_id", current_user.id).gte("date", date_from).lte("date", date_to)
        if marketplace and marketplace != "all":
            ads_query = ads_query.eq("marketplace", marketplace)
        ads_result = ads_query.limit(10000).execute()

        sales_query = supabase.table("mp_sales").select("*").eq("user_id", current_user.id).gte("date", date_from).lte("date", date_to)
        if marketplace and marketplace != "all":
            sales_query = sales_query.eq("marketplace", marketplace)
        if fulfillment_type:
            sales_query = sales_query.eq("fulfillment_type", fulfillment_type)
        sales_result = sales_query.limit(50000).execute()

        revenue_by_date = {}
        for sale in sales_result.data:
            date = sale["date"]
            if date not in revenue_by_date:
                revenue_by_date[date] = 0
            revenue_by_date[date] += float(sale.get("revenue", 0))

        ads_by_date = {}
        total_ad_cost = 0
        total_impressions = 0
        total_clicks = 0
        total_orders = 0

        for ad in ads_result.data:
            date = ad["date"]
            if date not in ads_by_date:
                ads_by_date[date] = {
                    "date": date,
                    "cost": 0,
                    "impressions": 0,
                    "clicks": 0,
                    "orders": 0
                }
            ads_by_date[date]["cost"] += float(ad.get("cost", 0))
            ads_by_date[date]["impressions"] += ad.get("impressions", 0)
            ads_by_date[date]["clicks"] += ad.get("clicks", 0)
            ads_by_date[date]["orders"] += ad.get("orders_count", 0)

            total_ad_cost += float(ad.get("cost", 0))
            total_impressions += ad.get("impressions", 0)
            total_clicks += ad.get("clicks", 0)
            total_orders += ad.get("orders_count", 0)

        chart_data = []
        for date in sorted(set(list(ads_by_date.keys()) + list(revenue_by_date.keys()))):
            ad_data = ads_by_date.get(date, {"cost": 0, "impressions": 0, "clicks": 0, "orders": 0})
            revenue = revenue_by_date.get(date, 0)
            drr = round(ad_data["cost"] / revenue * 100, 2) if revenue > 0 else 0

            chart_data.append({
                "date": date,
                "ad_cost": round(ad_data["cost"], 2),
                "revenue": round(revenue, 2),
                "drr": drr,
                "impressions": ad_data["impressions"],
                "clicks": ad_data["clicks"],
                "orders": ad_data["orders"]
            })

        total_revenue = sum(revenue_by_date.values())
        total_drr = round(total_ad_cost / total_revenue * 100, 2) if total_revenue > 0 else 0

        response = {
            "status": "success",
            "period": {"from": date_from, "to": date_to},
            "marketplace": marketplace or "all",
            "totals": {
                "ad_cost": round(total_ad_cost, 2),
                "revenue": round(total_revenue, 2),
                "drr": total_drr,
                "impressions": total_impressions,
                "clicks": total_clicks,
                "orders": total_orders
            },
            "data": chart_data
        }

        # Previous period comparison
        if include_prev_period:
            date_from_dt = datetime.strptime(date_from, "%Y-%m-%d")
            date_to_dt = datetime.strptime(date_to, "%Y-%m-%d")
            period_length = (date_to_dt - date_from_dt).days + 1
            prev_from = (date_from_dt - timedelta(days=period_length)).strftime("%Y-%m-%d")
            prev_to = (date_from_dt - timedelta(days=1)).strftime("%Y-%m-%d")

            prev_ads_query = supabase.table("mp_ad_costs").select("cost,impressions,clicks,orders_count").eq("user_id", current_user.id).gte("date", prev_from).lte("date", prev_to)
            if marketplace and marketplace != "all":
                prev_ads_query = prev_ads_query.eq("marketplace", marketplace)
            prev_ads_result = prev_ads_query.limit(10000).execute()

            prev_sales_query = supabase.table("mp_sales").select("revenue").eq("user_id", current_user.id).gte("date", prev_from).lte("date", prev_to)
            if marketplace and marketplace != "all":
                prev_sales_query = prev_sales_query.eq("marketplace", marketplace)
            if fulfillment_type:
                prev_sales_query = prev_sales_query.eq("fulfillment_type", fulfillment_type)
            prev_sales_result = prev_sales_query.limit(50000).execute()

            prev_ad_cost = sum(float(ad.get("cost", 0)) for ad in prev_ads_result.data)
            prev_impressions = sum(ad.get("impressions", 0) for ad in prev_ads_result.data)
            prev_clicks = sum(ad.get("clicks", 0) for ad in prev_ads_result.data)
            prev_orders = sum(ad.get("orders_count", 0) for ad in prev_ads_result.data)
            prev_revenue = sum(float(s.get("revenue", 0)) for s in prev_sales_result.data)
            prev_drr = round(prev_ad_cost / prev_revenue * 100, 2) if prev_revenue > 0 else 0

            response["previous_totals"] = {
                "ad_cost": round(prev_ad_cost, 2),
                "revenue": round(prev_revenue, 2),
                "drr": prev_drr,
                "impressions": prev_impressions,
                "clicks": prev_clicks,
                "orders": prev_orders
            }

        return response

    except Exception as e:
        logger.exception("Endpoint error: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/dashboard/ad-campaigns")
async def get_ad_campaigns(
    current_user: CurrentUser = Depends(get_current_user),
    sub: UserSubscription = Depends(require_feature("ads_page")),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    marketplace: Optional[str] = Query(None),
):
    """
    Рекламные кампании с агрегированными метриками за период
    """
    supabase = get_supabase_client()

    if not date_from:
        date_from = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    if not date_to:
        date_to = datetime.now().strftime("%Y-%m-%d")

    try:
        # Получаем рекламные данные за период
        ads_query = supabase.table("mp_ad_costs").select("*").eq("user_id", current_user.id).gte("date", date_from).lte("date", date_to)
        if marketplace and marketplace != "all":
            ads_query = ads_query.eq("marketplace", marketplace)
        ads_result = ads_query.limit(10000).execute()

        # Получаем общую выручку для расчёта ДРР
        sales_query = supabase.table("mp_sales").select("revenue").eq("user_id", current_user.id).gte("date", date_from).lte("date", date_to)
        if marketplace and marketplace != "all":
            sales_query = sales_query.eq("marketplace", marketplace)
        sales_result = sales_query.limit(50000).execute()
        total_revenue = sum(float(s.get("revenue", 0)) for s in sales_result.data)

        # Агрегация по campaign_id + marketplace + campaign_name
        campaigns_map: dict = {}
        for ad in ads_result.data:
            key = (ad.get("campaign_id", ""), ad.get("marketplace", ""))
            if key not in campaigns_map:
                campaigns_map[key] = {
                    "campaign_id": ad.get("campaign_id", ""),
                    "campaign_name": ad.get("campaign_name") or ad.get("campaign_id", ""),
                    "marketplace": ad.get("marketplace", ""),
                    "product_id": ad.get("product_id"),
                    "cost": 0,
                    "impressions": 0,
                    "clicks": 0,
                    "orders": 0,
                }
            campaigns_map[key]["cost"] += float(ad.get("cost", 0))
            campaigns_map[key]["impressions"] += ad.get("impressions", 0)
            campaigns_map[key]["clicks"] += ad.get("clicks", 0)
            campaigns_map[key]["orders"] += ad.get("orders_count", 0)
            # Берём product_id из первой строки где он есть
            if not campaigns_map[key]["product_id"] and ad.get("product_id"):
                campaigns_map[key]["product_id"] = ad.get("product_id")

        # Получаем имена товаров
        product_ids = list(set(
            c["product_id"] for c in campaigns_map.values() if c.get("product_id")
        ))
        product_names: dict = {}
        if product_ids:
            products_result = supabase.table("mp_products").select("id,name").eq("user_id", current_user.id).in_("id", product_ids).execute()
            for p in products_result.data:
                product_names[p["id"]] = p.get("name", "")

        # Формируем результат
        campaigns = []
        for camp in campaigns_map.values():
            cost = round(camp["cost"], 2)
            impressions = camp["impressions"]
            clicks = camp["clicks"]
            orders = camp["orders"]
            ctr = round(clicks / impressions * 100, 2) if impressions > 0 else 0
            cpc = round(cost / clicks, 2) if clicks > 0 else 0
            drr = round(cost / total_revenue * 100, 2) if total_revenue > 0 else 0

            campaigns.append({
                "campaign_id": camp["campaign_id"],
                "campaign_name": camp["campaign_name"],
                "marketplace": camp["marketplace"],
                "product_name": product_names.get(camp.get("product_id"), None),
                "cost": cost,
                "impressions": impressions,
                "clicks": clicks,
                "orders": orders,
                "ctr": ctr,
                "cpc": cpc,
                "drr": drr,
            })

        # Сортировка по cost desc
        campaigns.sort(key=lambda x: x["cost"], reverse=True)

        return {
            "status": "success",
            "period": {"from": date_from, "to": date_to},
            "campaigns": campaigns,
            "total_campaigns": len(campaigns),
        }

    except Exception as e:
        logger.exception("Endpoint error: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/dashboard/costs-tree")
async def get_costs_tree(
    current_user: CurrentUser = Depends(get_current_user),
    sub: UserSubscription = Depends(get_user_subscription),
    date_from: Optional[str] = Query(None, description="Дата начала (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="Дата окончания (YYYY-MM-DD)"),
    marketplace: Optional[str] = Query(None, description="Фильтр по МП: wb, ozon"),
    product_id: Optional[str] = Query(None, description="Фильтр по товару (UUID)"),
    include_children: bool = Query(True, description="Включать подкатегории (детализацию) в дереве"),
    fulfillment_type: Optional[str] = Query(None, pattern="^(FBO|FBS)$"),
):
    """
    Иерархическое дерево удержаний (tree-view как в ЛК Ozon).
    """
    # Free plan: basic costs tree only (no children details)
    if not has_feature(sub.plan, "costs_tree_details"):
        include_children = False

    supabase = get_supabase_client()

    if not date_from:
        date_from = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    if not date_to:
        date_to = datetime.now().strftime("%Y-%m-%d")

    try:
        result = _fetch_costs_tree_merged(
            supabase, date_from, date_to, marketplace, product_id,
            include_children, current_user.id, fulfillment_type,
        )

        return result

    except Exception as e:
        logger.exception("Endpoint error: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/dashboard/costs-tree-combined")
async def get_costs_tree_combined(
    current_user: CurrentUser = Depends(get_current_user),
    sub: UserSubscription = Depends(get_user_subscription),
    date_from: Optional[str] = Query(None, description="Дата начала (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="Дата окончания (YYYY-MM-DD)"),
    product_id: Optional[str] = Query(None, description="Фильтр по товару (UUID)"),
    include_children: bool = Query(True, description="Включать подкатегории (детализацию) в дереве"),
    fulfillment_type: Optional[str] = Query(None, pattern="^(FBO|FBS)$"),
):
    """
    Объединённое дерево удержаний для Ozon и WB в одном запросе.
    """
    if not has_feature(sub.plan, "costs_tree_details"):
        include_children = False

    supabase = get_supabase_client()

    if not date_from:
        date_from = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    if not date_to:
        date_to = datetime.now().strftime("%Y-%m-%d")

    try:
        ozon_data = _fetch_costs_tree_merged(
            supabase, date_from, date_to, "ozon", product_id,
            include_children, current_user.id, fulfillment_type,
        )
        wb_data = _fetch_costs_tree_merged(
            supabase, date_from, date_to, "wb", product_id,
            include_children, current_user.id, fulfillment_type,
        )
        return {
            "ozon": ozon_data,
            "wb": wb_data,
            "period": {"from": date_from, "to": date_to},
        }

    except Exception as e:
        logger.exception("Endpoint error: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/dashboard/stocks")
async def get_stocks(
    current_user: CurrentUser = Depends(get_current_user),
    marketplace: Optional[str] = Query(None),
    fulfillment_type: Optional[str] = Query(None, pattern="^(FBO|FBS)$"),
):
    """
    Текущие остатки по складам
    """
    supabase = get_supabase_client()

    try:
        query = supabase.table("mp_stocks").select("*, mp_products(name, barcode)").eq("user_id", current_user.id)

        if marketplace and marketplace != "all":
            query = query.eq("marketplace", marketplace)
        if fulfillment_type:
            query = query.eq("fulfillment_type", fulfillment_type)

        result = query.limit(5000).execute()

        # Средние дневные продажи за 30 дней (для прогноза остатков)
        date_30d_ago = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        date_today = datetime.now().strftime("%Y-%m-%d")
        sales_query = supabase.table("mp_sales").select("product_id, sales_count").eq("user_id", current_user.id).gte("date", date_30d_ago).lte("date", date_today)
        if marketplace and marketplace != "all":
            sales_query = sales_query.eq("marketplace", marketplace)
        if fulfillment_type:
            sales_query = sales_query.eq("fulfillment_type", fulfillment_type)
        sales_result = sales_query.limit(50000).execute()

        sales_by_product: dict[str, int] = {}
        for sale in sales_result.data:
            pid = sale.get("product_id")
            if pid:
                sales_by_product[pid] = sales_by_product.get(pid, 0) + sale.get("sales_count", 0)

        stocks_by_product: dict[str, dict] = {}
        for stock in result.data:
            product_data = stock.get("mp_products")
            if not product_data:
                continue

            product_name = product_data.get("name", "Unknown")
            barcode = product_data.get("barcode")
            product_id = stock.get("product_id")
            key = str(product_id or barcode or product_name)

            if key not in stocks_by_product:
                stocks_by_product[key] = {
                    "product_id": product_id,
                    "product_name": product_name,
                    "barcode": barcode,
                    "total_quantity": 0,
                    "last_updated_at": None,
                    "warehouses": [],
                    "avg_daily_sales": 0,
                    "days_remaining": None,
                }

            warehouse_info = {
                "marketplace": stock["marketplace"],
                "warehouse": stock.get("warehouse", "N/A"),
                "quantity": stock["quantity"],
                "updated_at": stock.get("updated_at"),
            }
            stocks_by_product[key]["warehouses"].append(warehouse_info)
            stocks_by_product[key]["total_quantity"] += stock["quantity"]

            upd = stock.get("updated_at")
            if upd:
                cur = stocks_by_product[key].get("last_updated_at")
                if not cur or str(upd) > str(cur):
                    stocks_by_product[key]["last_updated_at"] = upd

        # Расчёт прогноза остатков
        for key, s in stocks_by_product.items():
            pid = s.get("product_id")
            total_sales_30d = sales_by_product.get(pid, 0) if pid else 0
            avg_daily = round(total_sales_30d / 30, 2) if total_sales_30d > 0 else 0
            s["avg_daily_sales"] = avg_daily
            if avg_daily > 0 and s["total_quantity"] > 0:
                s["days_remaining"] = round(s["total_quantity"] / avg_daily)
            else:
                s["days_remaining"] = None

        return {
            "status": "success",
            "stocks": list(stocks_by_product.values())
        }

    except Exception as e:
        logger.exception("Endpoint error: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/dashboard/stock-history")
async def get_stock_history(
    current_user: CurrentUser = Depends(get_current_user),
    date_from: Optional[str] = Query(None, description="Дата начала (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="Дата окончания (YYYY-MM-DD)"),
    marketplace: Optional[str] = Query(None, description="Фильтр по МП: wb, ozon, all"),
    product_id: Optional[str] = Query(None, description="UUID товара (опционально)"),
    fulfillment_type: Optional[str] = Query(None, pattern="^(FBO|FBS)$"),
):
    """
    История остатков по дням (из mp_stock_snapshots).
    Возвращает дневные снимки для графика динамики остатков.
    """
    supabase = get_supabase_client()

    try:
        # Default: last 30 days
        if not date_from:
            date_from = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        if not date_to:
            date_to = datetime.now().strftime("%Y-%m-%d")

        query = (
            supabase.table("mp_stock_snapshots")
            .select("product_id, marketplace, date, total_quantity, mp_products(name, barcode)")
            .eq("user_id", current_user.id)
            .gte("date", date_from)
            .lte("date", date_to)
            .order("date", desc=False)
            .limit(50000)
        )

        if marketplace and marketplace != "all":
            query = query.eq("marketplace", marketplace)

        if product_id:
            query = query.eq("product_id", product_id)

        if fulfillment_type:
            query = query.eq("fulfillment_type", fulfillment_type)

        result = query.execute()

        # Aggregate: per date per product, sum across marketplaces (if all)
        # Result shape: { dates: string[], products: { id, name, barcode }[], series: { product_id: string, data: number[] }[], totals: number[] }
        dates_set: set[str] = set()
        products_map: dict[str, dict] = {}
        # raw[product_id][date] = total_quantity
        raw: dict[str, dict[str, int]] = {}

        for row in result.data:
            pid = row.get("product_id")
            date = row.get("date")
            qty = row.get("total_quantity", 0)
            product_data = row.get("mp_products")

            if not pid or not date:
                continue

            # Filter WB_ACCOUNT system product
            if product_data and product_data.get("barcode") == "WB_ACCOUNT":
                continue

            dates_set.add(date)

            if pid not in products_map and product_data:
                products_map[pid] = {
                    "id": pid,
                    "name": product_data.get("name", "Unknown"),
                    "barcode": product_data.get("barcode", ""),
                }

            if pid not in raw:
                raw[pid] = {}
            # Sum across marketplaces for same date (when marketplace=all)
            raw[pid][date] = raw[pid].get(date, 0) + qty

        dates = sorted(dates_set)

        # Build series
        series = []
        for pid, daily in raw.items():
            product_info = products_map.get(pid, {"id": pid, "name": "Unknown", "barcode": ""})
            data = [daily.get(d, 0) for d in dates]
            series.append({
                "product_id": pid,
                "product_name": product_info["name"],
                "barcode": product_info["barcode"],
                "data": data,
            })

        # Sort series: lowest last value first (most critical)
        series.sort(key=lambda s: s["data"][-1] if s["data"] else 0)

        # Totals per date (sum across all products)
        totals = []
        for d in dates:
            total = sum(daily.get(d, 0) for daily in raw.values())
            totals.append(total)

        return {
            "status": "success",
            "period": {"from": date_from, "to": date_to},
            "dates": dates,
            "products": list(products_map.values()),
            "series": series,
            "totals": totals,
        }

    except Exception as e:
        logger.exception("Endpoint error: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/dashboard/order-funnel")
async def get_order_funnel(
    current_user: CurrentUser = Depends(get_current_user),
    sub: UserSubscription = Depends(require_feature("order_monitor")),
    date_from: Optional[str] = Query(None, description="Дата начала (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="Дата окончания (YYYY-MM-DD)"),
    marketplace: Optional[str] = Query(None, description="Фильтр по МП: wb, ozon"),
    fulfillment_type: Optional[str] = Query(None, pattern="^(FBO|FBS)$"),
):
    """
    Воронка заказов: Заказы → Выкупы → Возвраты + непроведённые Ozon.
    Pro+ фича.
    """
    supabase = get_supabase_client()

    if not date_from:
        date_from = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    if not date_to:
        date_to = datetime.now().strftime("%Y-%m-%d")

    try:
        # 1. Продукты пользователя
        products_result = supabase.table("mp_products").select("*").eq("user_id", current_user.id).limit(500).execute()
        products = {p["id"]: p for p in products_result.data}

        # 2. Продажи за период
        sales_query = supabase.table("mp_sales").select("*").eq("user_id", current_user.id).gte("date", date_from).lte("date", date_to)
        if marketplace and marketplace != "all":
            sales_query = sales_query.eq("marketplace", marketplace)
        if fulfillment_type:
            sales_query = sales_query.eq("fulfillment_type", fulfillment_type)
        sales_result = sales_query.limit(50000).execute()

        # 3. Агрегация по дням и по товарам
        daily_map: dict[str, dict] = {}
        product_map: dict[str, dict] = {}
        total_orders = 0
        total_sales = 0
        total_returns = 0
        total_revenue = 0.0

        for sale in sales_result.data:
            date = sale["date"]
            product_id = sale["product_id"]
            orders = sale.get("orders_count", 0) or 0
            sales = sale.get("sales_count", 0) or 0
            returns = sale.get("returns_count", 0) or 0
            revenue = float(sale.get("revenue", 0) or 0)

            if date not in daily_map:
                daily_map[date] = {"date": date, "orders": 0, "sales": 0, "returns": 0, "revenue": 0.0}
            daily_map[date]["orders"] += orders
            daily_map[date]["sales"] += sales
            daily_map[date]["returns"] += returns
            daily_map[date]["revenue"] += revenue

            if product_id not in product_map:
                product_map[product_id] = {"orders": 0, "sales": 0, "returns": 0, "revenue": 0.0}
            product_map[product_id]["orders"] += orders
            product_map[product_id]["sales"] += sales
            product_map[product_id]["returns"] += returns
            product_map[product_id]["revenue"] += revenue

            total_orders += orders
            total_sales += sales
            total_returns += returns
            total_revenue += revenue

        # Расчёт buyout_percent для daily
        daily_list = []
        for d in sorted(daily_map.values(), key=lambda x: x["date"]):
            d["buyout_percent"] = round(d["sales"] / d["orders"] * 100, 1) if d["orders"] > 0 else 0
            d["revenue"] = round(d["revenue"], 2)
            daily_list.append(d)

        # 4. By product
        by_product = []
        for product_id, m in product_map.items():
            if product_id not in products:
                continue
            p = products[product_id]
            if p.get("name", "").startswith("WB_ACCOUNT"):
                continue
            by_product.append({
                "product_id": product_id,
                "product_name": p["name"],
                "barcode": p.get("barcode", ""),
                "orders": m["orders"],
                "sales": m["sales"],
                "returns": m["returns"],
                "buyout_percent": round(m["sales"] / m["orders"] * 100, 1) if m["orders"] > 0 else 0,
                "revenue": round(m["revenue"], 2),
                "avg_check": round(m["revenue"] / m["sales"], 2) if m["sales"] > 0 else 0,
            })
        by_product.sort(key=lambda x: x["orders"], reverse=True)

        # 5. Непроведённые (settled via costs-tree)
        unsettled_orders = 0
        unsettled_amount = 0.0
        try:
            mp_list = [marketplace] if marketplace and marketplace != "all" else ["ozon", "wb"]
            settled_revenue = 0.0
            for mp in mp_list:
                ct_data = _fetch_costs_tree_merged(
                    supabase, date_from, date_to, mp, None,
                    False, current_user.id, fulfillment_type,
                )
                if ct_data:
                    if isinstance(ct_data, dict):
                        settled_revenue += abs(float(ct_data.get("total_revenue", 0) or 0))
                    elif isinstance(ct_data, list) and len(ct_data) > 0:
                        settled_revenue += abs(float(ct_data[0].get("total_revenue", 0) or 0))

            if total_revenue > 0 and settled_revenue < total_revenue:
                unsettled_amount = round(total_revenue - settled_revenue, 2)
                ratio = settled_revenue / total_revenue
                unsettled_orders = max(0, total_orders - round(total_orders * ratio))
        except Exception as e:
            logger.warning(f"costs-tree RPC failed for order-funnel unsettled calc: {e}")
            # Если costs-tree недоступен, просто не показываем unsettled

        # 6. Summary
        buyout_percent = round(total_sales / total_orders * 100, 1) if total_orders > 0 else 0
        avg_check = round(total_revenue / total_sales, 2) if total_sales > 0 else 0

        return {
            "status": "success",
            "period": {"from": date_from, "to": date_to},
            "marketplace": marketplace or "all",
            "summary": {
                "total_orders": total_orders,
                "total_sales": total_sales,
                "total_returns": total_returns,
                "buyout_percent": buyout_percent,
                "total_revenue": round(total_revenue, 2),
                "unsettled_orders": unsettled_orders,
                "unsettled_amount": unsettled_amount,
                "avg_check": avg_check,
            },
            "daily": daily_list,
            "by_product": by_product,
        }

    except Exception as e:
        logger.exception("Endpoint error: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/dashboard/orders")
async def get_orders_list(
    current_user: CurrentUser = Depends(get_current_user),
    sub: UserSubscription = Depends(require_feature("order_monitor")),
    date_from: Optional[str] = Query(None, description="Дата начала (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="Дата окончания (YYYY-MM-DD)"),
    marketplace: Optional[str] = Query(None, description="Фильтр по МП: wb, ozon"),
    fulfillment_type: Optional[str] = Query(None, pattern="^(FBO|FBS)$"),
    status: Optional[str] = Query(None, description="Фильтр по статусу: ordered, sold, returned, cancelled, delivering"),
    product_id: Optional[str] = Query(None, description="Фильтр по product_id"),
    settled: Optional[bool] = Query(None, description="Фильтр по проведённости"),
    search: Optional[str] = Query(None, description="Поиск по order_id, barcode"),
    page: int = Query(1, ge=1, description="Номер страницы"),
    page_size: int = Query(50, ge=10, le=200, description="Размер страницы"),
    sort_by: str = Query("order_date", description="Поле сортировки"),
    sort_dir: str = Query("desc", description="Направление: asc, desc"),
):
    """
    Список заказов с пагинацией и фильтрами.
    Pro+ фича.
    """
    supabase = get_supabase_client()

    if not date_from:
        date_from = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    if not date_to:
        date_to = datetime.now().strftime("%Y-%m-%d")

    try:
        # Базовый запрос с JOIN на mp_products
        query = (
            supabase.table("mp_orders")
            .select("*, mp_products(name, barcode)", count="exact")
            .eq("user_id", current_user.id)
            .gte("order_date", f"{date_from}T00:00:00")
            .lte("order_date", f"{date_to}T23:59:59")
        )

        if marketplace and marketplace != "all":
            query = query.eq("marketplace", marketplace)
        if fulfillment_type:
            query = query.eq("fulfillment_type", fulfillment_type)
        if status:
            query = query.eq("status", status)
        if product_id:
            query = query.eq("product_id", product_id)
        if settled is not None:
            query = query.eq("settled", settled)
        if search:
            query = query.or_(f"order_id.ilike.%{search}%,barcode.ilike.%{search}%")

        # Сортировка
        allowed_sort = {"order_date", "price", "payout", "status", "commission", "logistics", "settled"}
        sort_field = sort_by if sort_by in allowed_sort else "order_date"
        query = query.order(sort_field, desc=(sort_dir == "desc"))

        # Пагинация
        offset = (page - 1) * page_size
        query = query.range(offset, offset + page_size - 1)

        result = query.execute()
        total_count = result.count if result.count is not None else 0

        # Форматируем ответ
        orders = []
        for row in result.data:
            product_info = row.get("mp_products") or {}
            orders.append({
                "id": row["id"],
                "marketplace": row["marketplace"],
                "order_id": row["order_id"],
                "product_id": row.get("product_id"),
                "product_name": product_info.get("name", "—"),
                "barcode": row.get("barcode", ""),
                "order_date": row["order_date"],
                "last_change_date": row.get("last_change_date"),
                "status": row["status"],
                "price": float(row.get("price", 0) or 0),
                "sale_price": float(row["sale_price"]) if row.get("sale_price") is not None else None,
                "sale_amount": float(row["sale_amount"]) if row.get("sale_amount") is not None else None,
                "commission": float(row.get("commission", 0) or 0),
                "logistics": float(row.get("logistics", 0) or 0),
                "storage_fee": float(row.get("storage_fee", 0) or 0),
                "other_fees": float(row.get("other_fees", 0) or 0),
                "payout": float(row["payout"]) if row.get("payout") is not None else None,
                "settled": row.get("settled", False),
                "region": row.get("region"),
                "warehouse": row.get("warehouse"),
                "wb_sale_id": row.get("wb_sale_id"),
                "ozon_posting_status": row.get("ozon_posting_status"),
                "fulfillment_type": row.get("fulfillment_type", "FBO"),
            })

        # Summary: агрегация по всем записям (не только по текущей странице)
        summary_query = (
            supabase.table("mp_orders")
            .select("status, settled, payout, price, sale_price")
            .eq("user_id", current_user.id)
            .gte("order_date", f"{date_from}T00:00:00")
            .lte("order_date", f"{date_to}T23:59:59")
        )
        if marketplace and marketplace != "all":
            summary_query = summary_query.eq("marketplace", marketplace)
        if fulfillment_type:
            summary_query = summary_query.eq("fulfillment_type", fulfillment_type)
        summary_result = summary_query.limit(100000).execute()

        total_orders = len(summary_result.data)
        total_settled = sum(1 for r in summary_result.data if r.get("settled"))
        total_unsettled = total_orders - total_settled
        total_payout = sum(float(r.get("payout", 0) or 0) for r in summary_result.data if r.get("payout"))
        total_sold = sum(1 for r in summary_result.data if r.get("status") == "sold")
        total_returned = sum(1 for r in summary_result.data if r.get("status") == "returned")
        # Используем sale_price (реальная цена) если есть, иначе price (каталожная)
        total_revenue = sum(
            float(r.get("sale_price") or r.get("price", 0) or 0)
            for r in summary_result.data
        )

        total_pages = max(1, (total_count + page_size - 1) // page_size)

        return {
            "status": "success",
            "period": {"from": date_from, "to": date_to},
            "total_count": total_count,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "orders": orders,
            "summary": {
                "total_orders": total_orders,
                "total_sold": total_sold,
                "total_returned": total_returned,
                "total_settled": total_settled,
                "total_unsettled": total_unsettled,
                "total_payout": round(total_payout, 2),
                "total_revenue": round(total_revenue, 2),
                "buyout_percent": round(total_sold / total_orders * 100, 1) if total_orders > 0 else 0,
            },
        }

    except Exception as e:
        logger.exception("Endpoint error: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/dashboard/orders/{order_id}")
async def get_order_detail(
    order_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    sub: UserSubscription = Depends(require_feature("order_monitor")),
):
    """
    Детали одного заказа с cost breakdown.
    Pro+ фича.
    """
    supabase = get_supabase_client()

    try:
        result = (
            supabase.table("mp_orders")
            .select("*, mp_products(name, barcode)")
            .eq("user_id", current_user.id)
            .eq("order_id", order_id)
            .limit(1)
            .execute()
        )

        if not result.data:
            raise HTTPException(status_code=404, detail="Order not found")

        row = result.data[0]
        product_info = row.get("mp_products") or {}

        return {
            "status": "success",
            "order": {
                "id": row["id"],
                "marketplace": row["marketplace"],
                "order_id": row["order_id"],
                "product_id": row.get("product_id"),
                "product_name": product_info.get("name", "—"),
                "barcode": row.get("barcode", ""),
                "order_date": row["order_date"],
                "last_change_date": row.get("last_change_date"),
                "status": row["status"],
                "price": float(row.get("price", 0) or 0),
                "sale_price": float(row["sale_price"]) if row.get("sale_price") is not None else None,
                "sale_amount": float(row["sale_amount"]) if row.get("sale_amount") is not None else None,
                "commission": float(row.get("commission", 0) or 0),
                "logistics": float(row.get("logistics", 0) or 0),
                "storage_fee": float(row.get("storage_fee", 0) or 0),
                "other_fees": float(row.get("other_fees", 0) or 0),
                "payout": float(row["payout"]) if row.get("payout") is not None else None,
                "settled": row.get("settled", False),
                "region": row.get("region"),
                "warehouse": row.get("warehouse"),
                "wb_sale_id": row.get("wb_sale_id"),
                "wb_rrd_id": row.get("wb_rrd_id"),
                "ozon_posting_status": row.get("ozon_posting_status"),
                "fulfillment_type": row.get("fulfillment_type", "FBO"),
                "raw_data": row.get("raw_data"),
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Endpoint error: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error")


# ─── Order-Based Summary (mp_orders aggregation) ────────────────────────────
# Позаказная аналитика: commission, logistics, storage, profit estimate.
# Данные из mp_orders (позаказная детализация), НЕ из mp_sales (агрегат).
# Даёт актуальную финансовую картину без задержки settlement (1-14 дней Ozon).

@router.get("/dashboard/order-summary")
async def get_order_summary(
    current_user: CurrentUser = Depends(get_current_user),
    sub: UserSubscription = Depends(require_feature("unit_economics")),
    date_from: Optional[str] = Query(None, description="Дата начала (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="Дата окончания (YYYY-MM-DD)"),
    marketplace: Optional[str] = Query(None, description="Фильтр по МП: wb, ozon"),
    fulfillment_type: Optional[str] = Query(None, pattern="^(FBO|FBS)$", description="Фильтр FBO/FBS"),
):
    """
    Агрегированная сводка из mp_orders (позаказная аналитика).
    Pro+ фича (unit_economics gating).

    Возвращает: totals (commission, logistics, storage, other_fees, sale_amount,
    payout, estimated_profit, orders_count, settled_count, unsettled_count)
    + by_marketplace breakdown.
    """
    supabase = get_supabase_client()

    if not date_from:
        from datetime import timezone
        MSK = timezone(timedelta(hours=3))
        date_from = (datetime.now(MSK) - timedelta(days=7)).strftime("%Y-%m-%d")
    if not date_to:
        from datetime import timezone
        MSK = timezone(timedelta(hours=3))
        date_to = datetime.now(MSK).strftime("%Y-%m-%d")

    try:
        # --- 1. Fetch mp_orders with pagination (PostgREST limit 1000) ---
        rows: list = []
        page_size = 1000
        offset = 0
        select_fields = "marketplace, commission, logistics, storage_fee, other_fees, sale_amount, payout, settled, status, product_id, quantity, mp_products(purchase_price)"

        while True:
            query = (
                supabase.table("mp_orders")
                .select(select_fields)
                .eq("user_id", current_user.id)
                .gte("order_date", f"{date_from}T00:00:00")
                .lte("order_date", f"{date_to}T23:59:59")
            )
            if marketplace and marketplace != "all":
                query = query.eq("marketplace", marketplace)
            if fulfillment_type:
                query = query.eq("fulfillment_type", fulfillment_type)

            query = query.range(offset, offset + page_size - 1)
            result = query.execute()
            batch = result.data or []
            rows.extend(batch)

            if len(batch) < page_size:
                break
            offset += page_size

        # --- 2. Fetch ads for the period (profit = payout - purchase - ads) ---
        ads_query = (
            supabase.table("mp_ad_costs")
            .select("marketplace, cost")
            .eq("user_id", current_user.id)
            .gte("date", date_from)
            .lte("date", date_to)
        )
        if marketplace and marketplace != "all":
            ads_query = ads_query.eq("marketplace", marketplace)

        ads_result = ads_query.limit(10000).execute()
        ads_rows = ads_result.data or []

        total_ads = 0.0
        ads_by_mp: dict[str, float] = {}
        for ad_row in ads_rows:
            cost = float(ad_row.get("cost") or 0)
            mp = ad_row.get("marketplace", "unknown")
            total_ads += cost
            ads_by_mp[mp] = ads_by_mp.get(mp, 0) + cost

        # --- 3. Aggregate ---
        def _aggregate(orders: list, ads_amount: float = 0.0) -> dict:
            total_commission = 0.0
            total_logistics = 0.0
            total_storage = 0.0
            total_other_fees = 0.0
            total_sale_amount = 0.0
            total_payout = 0.0
            total_purchase = 0.0
            orders_count = 0
            settled_count = 0
            unsettled_count = 0
            has_logistics = False

            for row in orders:
                commission = float(row.get("commission") or 0)
                logistics = float(row.get("logistics") or 0)
                storage = float(row.get("storage_fee") or 0)
                other = float(row.get("other_fees") or 0)
                sale_amount = float(row.get("sale_amount") or 0)
                payout = float(row.get("payout") or 0)
                settled = row.get("settled", False)
                qty = int(row.get("quantity") or 1)

                # Purchase from joined mp_products × quantity
                product_info = row.get("mp_products") or {}
                purchase_price = float(product_info.get("purchase_price") or 0)

                total_commission += commission
                total_logistics += logistics
                total_storage += storage
                total_other_fees += other
                total_sale_amount += sale_amount
                total_payout += payout
                total_purchase += purchase_price * qty
                orders_count += 1

                if logistics != 0:
                    has_logistics = True

                if settled:
                    settled_count += 1
                else:
                    unsettled_count += 1

            total_deductions = total_commission + total_logistics + total_storage + total_other_fees
            # payout = sale_amount - deductions (удержания уже вычтены)
            # profit = payout - purchase - ads (правило #10 CLAUDE.md)
            # fallback: если payout=0 — используем sale_amount - deductions - purchase - ads
            if total_payout > 0:
                estimated_profit = total_payout - total_purchase - ads_amount
            else:
                estimated_profit = total_sale_amount - total_deductions - total_purchase - ads_amount
            settled_ratio = (settled_count / orders_count * 100) if orders_count > 0 else 0

            agg = {
                "commission": round(total_commission, 2),
                "logistics": round(total_logistics, 2),
                "storage_fee": round(total_storage, 2),
                "other_fees": round(total_other_fees, 2),
                "total_deductions": round(total_deductions, 2),
                "sale_amount": round(total_sale_amount, 2),
                "payout": round(total_payout, 2),
                "purchase": round(total_purchase, 2),
                "ads": round(ads_amount, 2),
                "estimated_profit": round(estimated_profit, 2),
                "orders_count": orders_count,
                "settled_count": settled_count,
                "unsettled_count": unsettled_count,
                "settled_ratio": round(settled_ratio, 1),
            }

            # Ozon edge case: logistics=0 note
            if orders_count > 0 and not has_logistics:
                agg["logistics_note"] = "Логистика FBO и хранение начисляются в финотчёте"

            return agg

        totals = _aggregate(rows, total_ads)

        # Per-marketplace breakdown
        by_mp: dict[str, list] = {}
        for row in rows:
            mp = row.get("marketplace", "unknown")
            if mp not in by_mp:
                by_mp[mp] = []
            by_mp[mp].append(row)

        by_marketplace = {}
        for mp, mp_rows in by_mp.items():
            by_marketplace[mp] = _aggregate(mp_rows, ads_by_mp.get(mp, 0))

        return {
            "status": "success",
            "period": {"from": date_from, "to": date_to},
            "totals": totals,
            "by_marketplace": by_marketplace,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Endpoint error: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/dashboard/fulfillment-info")
async def get_fulfillment_info(
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Проверяет наличие FBS данных у пользователя.
    Используется для Progressive Disclosure: FBS pills скрыты если нет FBS данных.
    """
    supabase = get_supabase_client()

    try:
        result = (
            supabase.table("mp_sales")
            .select("id", count="exact")
            .eq("user_id", current_user.id)
            .eq("fulfillment_type", "FBS")
            .limit(1)
            .execute()
        )

        has_fbs = result.count is not None and result.count > 0

        return {
            "has_fbs_data": has_fbs,
            "fbs_products_count": result.count or 0,
        }

    except Exception as e:
        logger.exception("Endpoint error: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error")