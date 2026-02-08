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
    Unit-экономика по товарам
    """
    supabase = get_supabase_client()

    if not date_from:
        date_from = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    if not date_to:
        date_to = datetime.now().strftime("%Y-%m-%d")

    try:
        products_result = supabase.table("mp_products").select("*").eq("user_id", current_user.id).execute()
        products = {p["id"]: p for p in products_result.data}

        sales_query = supabase.table("mp_sales").select("*").eq("user_id", current_user.id).gte("date", date_from).lte("date", date_to)
        if marketplace and marketplace != "all":
            sales_query = sales_query.eq("marketplace", marketplace)
        sales_result = sales_query.execute()

        costs_query = supabase.table("mp_costs").select("*").eq("user_id", current_user.id).gte("date", date_from).lte("date", date_to)
        if marketplace and marketplace != "all":
            costs_query = costs_query.eq("marketplace", marketplace)
        costs_result = costs_query.execute()

        product_metrics = {}

        for sale in sales_result.data:
            product_id = sale["product_id"]
            if product_id not in product_metrics:
                product_metrics[product_id] = {
                    "sales": 0,
                    "revenue": 0,
                    "costs": 0
                }
            product_metrics[product_id]["sales"] += sale.get("sales_count", 0)
            product_metrics[product_id]["revenue"] += float(sale.get("revenue", 0))

        for cost in costs_result.data:
            product_id = cost["product_id"]
            if product_id not in product_metrics:
                continue
            product_metrics[product_id]["costs"] += float(cost.get("total_costs", 0))

        result = []
        for product_id, metrics in product_metrics.items():
            if product_id not in products:
                continue

            product = products[product_id]
            sales_count = metrics["sales"]
            revenue = metrics["revenue"]
            costs = metrics["costs"]
            purchase_price = float(product.get("purchase_price", 0))

            net_profit = revenue - costs - (purchase_price * sales_count)
            unit_profit = round(net_profit / sales_count, 2) if sales_count > 0 else 0

            result.append({
                "product": {
                    "id": product_id,
                    "name": product["name"],
                    "barcode": product["barcode"],
                    "purchase_price": purchase_price
                },
                "metrics": {
                    "sales_count": sales_count,
                    "revenue": round(revenue, 2),
                    "mp_costs": round(costs, 2),
                    "purchase_costs": round(purchase_price * sales_count, 2),
                    "net_profit": round(net_profit, 2),
                    "unit_profit": unit_profit
                }
            })

        result.sort(key=lambda x: x["metrics"]["net_profit"], reverse=True)

        return {
            "status": "success",
            "period": {"from": date_from, "to": date_to},
            "marketplace": marketplace or "all",
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

        return {
            "status": "success",
            "stocks": list(stocks_by_product.values())
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
