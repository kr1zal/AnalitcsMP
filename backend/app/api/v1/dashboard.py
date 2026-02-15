"""
Роутер для дашборда - сводная аналитика
"""
from fastapi import APIRouter, HTTPException, Query, Depends
from typing import Optional
from datetime import datetime, timedelta

from ...db.supabase import get_supabase_client
from ...auth import CurrentUser, get_current_user
from ...subscription import get_user_subscription, UserSubscription, require_feature
from ...plans import has_feature

router = APIRouter()


@router.get("/dashboard/summary")
async def get_summary(
    current_user: CurrentUser = Depends(get_current_user),
    sub: UserSubscription = Depends(get_user_subscription),
    date_from: Optional[str] = Query(None, description="Дата начала (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="Дата окончания (YYYY-MM-DD)"),
    marketplace: Optional[str] = Query(None, description="Фильтр по МП: wb, ozon"),
    include_prev_period: bool = Query(False, description="Включить данные предыдущего периода"),
    include_ozon_truth: bool = Query(False, description="Использовать 'истинную' выручку Ozon из costs-tree")
):
    """
    Сводка по продажам за период (использует RPC для оптимизации).
    """
    # Feature gate: period comparison requires pro+
    if include_prev_period and not has_feature(sub.plan, "period_comparison"):
        include_prev_period = False

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
                }
            ).execute()

        return result.data

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dashboard/unit-economics")
async def get_unit_economics(
    current_user: CurrentUser = Depends(get_current_user),
    sub: UserSubscription = Depends(require_feature("unit_economics")),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    marketplace: Optional[str] = Query(None)
):
    """
    Unit-экономика по товарам.
    Методология ИДЕНТИЧНА дашборду:
    - Payout (total_accrued) берётся из costs-tree и распределяется по товарам пропорционально выручке
    - Закупка корректируется по costsTreeRatio (доля проведённых заказов)
    - Реклама учитывается по товарам (mp_ad_costs)
    - Формула: Прибыль = PayoutShare − Закупка×ratio − Реклама
    - Гарантия: SUM(profit) = Dashboard profit
    """
    supabase = get_supabase_client()

    if not date_from:
        date_from = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    if not date_to:
        date_to = datetime.now().strftime("%Y-%m-%d")

    try:
        # 1. Продукты пользователя
        products_result = supabase.table("mp_products").select("*").eq("user_id", current_user.id).execute()
        products = {p["id"]: p for p in products_result.data}

        # 2. Продажи (mp_sales — аналитика, все заказы)
        sales_query = supabase.table("mp_sales").select("*").eq("user_id", current_user.id).gte("date", date_from).lte("date", date_to)
        if marketplace and marketplace != "all":
            sales_query = sales_query.eq("marketplace", marketplace)
        sales_result = sales_query.execute()

        # 3. Удержания МП (mp_costs) — для отображения в таблице
        costs_query = supabase.table("mp_costs").select("*").eq("user_id", current_user.id).gte("date", date_from).lte("date", date_to)
        if marketplace and marketplace != "all":
            costs_query = costs_query.eq("marketplace", marketplace)
        costs_result = costs_query.execute()

        # 4. Рекламные расходы по товарам (mp_ad_costs)
        ad_query = supabase.table("mp_ad_costs").select("product_id, cost").eq("user_id", current_user.id).gte("date", date_from).lte("date", date_to)
        if marketplace and marketplace != "all":
            ad_query = ad_query.eq("marketplace", marketplace)
        ad_result = ad_query.execute()

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

        # 5. Агрегация продаж и удержаний по товарам
        product_metrics: dict[str, dict] = {}

        for sale in sales_result.data:
            product_id = sale["product_id"]
            if product_id not in product_metrics:
                product_metrics[product_id] = {"sales": 0, "revenue": 0, "costs": 0}
            product_metrics[product_id]["sales"] += sale.get("sales_count", 0)
            product_metrics[product_id]["revenue"] += float(sale.get("revenue", 0))

        for cost in costs_result.data:
            product_id = cost["product_id"]
            if product_id not in product_metrics:
                continue
            product_metrics[product_id]["costs"] += float(cost.get("total_costs", 0))

        # 6. Costs-tree: payout (total_accrued) + revenue ("Продажи") + credits (СПП и т.д.)
        #    Используем payout для расчёта прибыли — точно как на дашборде.
        #    Credits (WB: СПП, возмещения) включаем в displayed_revenue,
        #    чтобы "Продажи" на дашборде и UE совпадали.
        total_mp_sales_revenue = sum(m["revenue"] for m in product_metrics.values())
        costs_tree_sales = 0.0  # Только tree item "Продажи" (для ratio)
        costs_tree_credits = 0.0  # Положительные items кроме "Продажи" (СПП, возмещения)
        total_payout = 0.0
        try:
            mp_list = [marketplace] if marketplace and marketplace != "all" else ["ozon", "wb"]
            for mp in mp_list:
                ct_result = supabase.rpc(
                    "get_costs_tree",
                    {
                        "p_date_from": date_from,
                        "p_date_to": date_to,
                        "p_marketplace": mp,
                        "p_product_id": None,
                        "p_include_children": False,
                        "p_user_id": current_user.id,
                    }
                ).execute()
                if ct_result.data:
                    ct_data = ct_result.data
                    if isinstance(ct_data, list) and len(ct_data) > 0:
                        ct_data = ct_data[0]
                    if isinstance(ct_data, dict):
                        total_payout += float(ct_data.get("total_accrued", 0) or 0)
                        for item in ct_data.get("tree", []):
                            name = item.get("name", "")
                            amount = float(item.get("amount", 0) or 0)
                            if name == "Продажи":
                                costs_tree_sales += abs(amount)
                            elif amount > 0:
                                # Положительные: СПП, возмещения и т.д.
                                costs_tree_credits += amount
        except Exception:
            pass  # Если costs-tree недоступен — fallback на mp_sales/mp_costs

        # revenue с учётом credits (для отображения: "Продажи" вкл. СПП)
        costs_tree_revenue = costs_tree_sales + costs_tree_credits

        # Ratio: ЧИСТЫЕ продажи (без credits) / mp_sales revenue
        # Credits (СПП) — не от продаж, ratio должен отражать долю проведённых заказов
        costs_tree_ratio = (
            costs_tree_sales / total_mp_sales_revenue
            if total_mp_sales_revenue > 0 and 0 < costs_tree_sales < total_mp_sales_revenue
            else 1.0
        )

        # Флаг: есть ли данные costs-tree для расчёта через payout
        use_payout = total_payout != 0

        # 7. Распределение неатрибутированной рекламы (без product_id) пропорционально выручке
        if unattributed_ad > 0 and total_mp_sales_revenue > 0:
            for pid, m in product_metrics.items():
                share = m["revenue"] / total_mp_sales_revenue
                ad_by_product[pid] = ad_by_product.get(pid, 0) + unattributed_ad * share

        # 8. Формирование результата
        # Dashboard: Продажи = costs-tree "Продажи" + credits (СПП, возмещения)
        # UE per product: распределяем пропорционально mp_sales revenue share.
        #
        # Формула (всегда 100%):
        #   displayed_revenue = (costs_tree_sales + credits) × share
        #   mp_deductions     = displayed_revenue − payout_share  (>=0 т.к. revenue включает credits)
        #   profit            = payout_share − purchase − ads
        #   → revenue = mp_deductions + purchase + ads + profit  ✓
        result = []
        for product_id, metrics in product_metrics.items():
            if product_id not in products:
                continue

            product = products[product_id]
            sales_count = metrics["sales"]
            mp_sales_revenue = metrics["revenue"]  # из mp_sales (аналитика)
            costs = metrics["costs"]  # из mp_costs (fallback)
            purchase_price = float(product.get("purchase_price", 0))
            raw_purchase = purchase_price * sales_count
            adjusted_purchase = raw_purchase * costs_tree_ratio
            ad_cost = ad_by_product.get(product_id, 0)

            if use_payout and total_mp_sales_revenue > 0 and costs_tree_revenue > 0:
                # Доля товара в общей выручке (по mp_sales)
                share = mp_sales_revenue / total_mp_sales_revenue
                # Выручка из costs-tree (как на Dashboard "Продажи")
                displayed_revenue = costs_tree_revenue * share
                # Начислено (payout) для этого товара
                payout_share = total_payout * share
                # Удержания МП = Выручка − Начислено (всегда >= 0 т.к. CT revenue > payout)
                mp_costs_consistent = max(0, displayed_revenue - payout_share)
                # Прибыль = Начислено − Закупка − Реклама
                net_profit = payout_share - adjusted_purchase - ad_cost
            else:
                # Fallback: если costs-tree недоступен — mp_sales/mp_costs
                displayed_revenue = mp_sales_revenue
                mp_costs_consistent = costs
                net_profit = mp_sales_revenue - costs - adjusted_purchase - ad_cost

            unit_profit = round(net_profit / sales_count, 2) if sales_count > 0 else 0

            drr = round((ad_cost / displayed_revenue) * 100, 1) if displayed_revenue > 0 and ad_cost > 0 else 0

            result.append({
                "product": {
                    "id": product_id,
                    "name": product["name"],
                    "barcode": product["barcode"],
                    "purchase_price": purchase_price
                },
                "metrics": {
                    "sales_count": sales_count,
                    "revenue": round(displayed_revenue, 2),
                    "mp_costs": round(mp_costs_consistent, 2),
                    "purchase_costs": round(adjusted_purchase, 2),
                    "ad_cost": round(ad_cost, 2),
                    "drr": drr,
                    "net_profit": round(net_profit, 2),
                    "unit_profit": unit_profit
                }
            })

        result.sort(key=lambda x: x["metrics"]["net_profit"], reverse=True)

        total_ad_cost = sum(p["metrics"]["ad_cost"] for p in result)

        return {
            "status": "success",
            "period": {"from": date_from, "to": date_to},
            "marketplace": marketplace or "all",
            "costs_tree_ratio": round(costs_tree_ratio, 4),
            "total_ad_cost": round(total_ad_cost, 2),
            "total_payout": round(total_payout, 2),
            "products": result
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dashboard/sales-chart")
async def get_sales_chart(
    current_user: CurrentUser = Depends(get_current_user),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    marketplace: Optional[str] = Query(None),
    product_id: Optional[str] = Query(None)
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

        result = query.execute()

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
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dashboard/ad-costs")
async def get_ad_costs(
    current_user: CurrentUser = Depends(get_current_user),
    sub: UserSubscription = Depends(require_feature("ads_page")),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    marketplace: Optional[str] = Query(None)
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
        ads_result = ads_query.execute()

        sales_query = supabase.table("mp_sales").select("*").eq("user_id", current_user.id).gte("date", date_from).lte("date", date_to)
        if marketplace and marketplace != "all":
            sales_query = sales_query.eq("marketplace", marketplace)
        sales_result = sales_query.execute()

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

        return {
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

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dashboard/costs-tree")
async def get_costs_tree(
    current_user: CurrentUser = Depends(get_current_user),
    sub: UserSubscription = Depends(get_user_subscription),
    date_from: Optional[str] = Query(None, description="Дата начала (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="Дата окончания (YYYY-MM-DD)"),
    marketplace: Optional[str] = Query(None, description="Фильтр по МП: wb, ozon"),
    product_id: Optional[str] = Query(None, description="Фильтр по товару (UUID)"),
    include_children: bool = Query(True, description="Включать подкатегории (детализацию) в дереве")
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
        result = supabase.rpc(
            "get_costs_tree",
            {
                "p_date_from": date_from,
                "p_date_to": date_to,
                "p_marketplace": marketplace,
                "p_product_id": product_id,
                "p_include_children": include_children,
                "p_user_id": current_user.id,
            }
        ).execute()

        return result.data

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dashboard/costs-tree-combined")
async def get_costs_tree_combined(
    current_user: CurrentUser = Depends(get_current_user),
    sub: UserSubscription = Depends(get_user_subscription),
    date_from: Optional[str] = Query(None, description="Дата начала (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="Дата окончания (YYYY-MM-DD)"),
    product_id: Optional[str] = Query(None, description="Фильтр по товару (UUID)"),
    include_children: bool = Query(True, description="Включать подкатегории (детализацию) в дереве")
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
        result = supabase.rpc(
            "get_costs_tree_combined",
            {
                "p_date_from": date_from,
                "p_date_to": date_to,
                "p_product_id": product_id,
                "p_include_children": include_children,
                "p_user_id": current_user.id,
            }
        ).execute()

        return result.data

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dashboard/stocks")
async def get_stocks(
    current_user: CurrentUser = Depends(get_current_user),
    marketplace: Optional[str] = Query(None),
):
    """
    Текущие остатки по складам
    """
    supabase = get_supabase_client()

    try:
        query = supabase.table("mp_stocks").select("*, mp_products(name, barcode)").eq("user_id", current_user.id)

        if marketplace and marketplace != "all":
            query = query.eq("marketplace", marketplace)

        result = query.execute()

        # Средние дневные продажи за 30 дней (для прогноза остатков)
        date_30d_ago = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        date_today = datetime.now().strftime("%Y-%m-%d")
        sales_query = supabase.table("mp_sales").select("product_id, sales_count").eq("user_id", current_user.id).gte("date", date_30d_ago).lte("date", date_today)
        if marketplace and marketplace != "all":
            sales_query = sales_query.eq("marketplace", marketplace)
        sales_result = sales_query.execute()

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
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dashboard/order-funnel")
async def get_order_funnel(
    current_user: CurrentUser = Depends(get_current_user),
    sub: UserSubscription = Depends(require_feature("order_monitor")),
    date_from: Optional[str] = Query(None, description="Дата начала (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="Дата окончания (YYYY-MM-DD)"),
    marketplace: Optional[str] = Query(None, description="Фильтр по МП: wb, ozon"),
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
        products_result = supabase.table("mp_products").select("*").eq("user_id", current_user.id).execute()
        products = {p["id"]: p for p in products_result.data}

        # 2. Продажи за период
        sales_query = supabase.table("mp_sales").select("*").eq("user_id", current_user.id).gte("date", date_from).lte("date", date_to)
        if marketplace and marketplace != "all":
            sales_query = sales_query.eq("marketplace", marketplace)
        sales_result = sales_query.execute()

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
                ct_result = supabase.rpc(
                    "get_costs_tree",
                    {
                        "p_date_from": date_from,
                        "p_date_to": date_to,
                        "p_marketplace": mp,
                        "p_product_id": None,
                        "p_include_children": False,
                        "p_user_id": current_user.id,
                    }
                ).execute()
                if ct_result.data:
                    ct_data = ct_result.data
                    if isinstance(ct_data, dict):
                        settled_revenue += abs(float(ct_data.get("total_revenue", 0) or 0))
                    elif isinstance(ct_data, list) and len(ct_data) > 0:
                        settled_revenue += abs(float(ct_data[0].get("total_revenue", 0) or 0))

            if total_revenue > 0 and settled_revenue < total_revenue:
                unsettled_amount = round(total_revenue - settled_revenue, 2)
                ratio = settled_revenue / total_revenue
                unsettled_orders = max(0, total_orders - round(total_orders * ratio))
        except Exception:
            pass  # Если costs-tree недоступен, просто не показываем unsettled

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
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dashboard/orders")
async def get_orders_list(
    current_user: CurrentUser = Depends(get_current_user),
    sub: UserSubscription = Depends(require_feature("order_monitor")),
    date_from: Optional[str] = Query(None, description="Дата начала (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="Дата окончания (YYYY-MM-DD)"),
    marketplace: Optional[str] = Query(None, description="Фильтр по МП: wb, ozon"),
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
        summary_result = summary_query.execute()

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
        raise HTTPException(status_code=500, detail=str(e))


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
                "raw_data": row.get("raw_data"),
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))