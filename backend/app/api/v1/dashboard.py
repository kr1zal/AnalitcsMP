"""
Роутер для дашборда - сводная аналитика
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from datetime import datetime, timedelta
from decimal import Decimal

from ...db.supabase import get_supabase_client

router = APIRouter()


@router.get("/dashboard/summary")
async def get_summary(
    date_from: Optional[str] = Query(None, description="Дата начала (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="Дата окончания (YYYY-MM-DD)"),
    marketplace: Optional[str] = Query(None, description="Фильтр по МП: wb, ozon"),
    include_prev_period: bool = Query(False, description="Включить данные предыдущего периода"),
    include_ozon_truth: bool = Query(False, description="Использовать 'истинную' выручку Ozon из costs-tree")
):
    """
    Сводка по продажам за период (использует RPC для оптимизации).

    Возвращает агрегированные данные:
    - Общее количество заказов, выкупов, возвратов
    - Выручка
    - Средний процент выкупа

    При include_prev_period=true также возвращает:
    - Данные предыдущего периода
    - Процент изменения выручки

    При include_ozon_truth=true:
    - Выручка Ozon берётся из costs-tree (как в ЛК)
    """
    supabase = get_supabase_client()

    # Если даты не указаны, берём последние 30 дней
    if not date_from:
        date_from = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    if not date_to:
        date_to = datetime.now().strftime("%Y-%m-%d")

    try:
        # Используем оптимизированную RPC если нужен prev-period
        if include_prev_period:
            result = supabase.rpc(
                "get_dashboard_summary_with_prev",
                {
                    "p_date_from": date_from,
                    "p_date_to": date_to,
                    "p_marketplace": marketplace,
                    "p_include_costs_tree_revenue": include_ozon_truth
                }
            ).execute()
        else:
            # Стандартный запрос без prev-period
            result = supabase.rpc(
                "get_dashboard_summary",
                {
                    "p_date_from": date_from,
                    "p_date_to": date_to,
                    "p_marketplace": marketplace
                }
            ).execute()

        return result.data

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dashboard/unit-economics")
async def get_unit_economics(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    marketplace: Optional[str] = Query(None)
):
    """
    Unit-экономика по товарам

    Возвращает для каждого товара:
    - Продажи, выручка
    - Удержания (комиссия, логистика, хранение и т.д.)
    - Чистая прибыль на единицу
    """
    supabase = get_supabase_client()

    if not date_from:
        date_from = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    if not date_to:
        date_to = datetime.now().strftime("%Y-%m-%d")

    try:
        # Получаем товары
        products_result = supabase.table("mp_products").select("*").execute()
        products = {p["id"]: p for p in products_result.data}

        # Получаем продажи
        sales_query = supabase.table("mp_sales").select("*").gte("date", date_from).lte("date", date_to)
        if marketplace and marketplace != "all":
            sales_query = sales_query.eq("marketplace", marketplace)
        sales_result = sales_query.execute()

        # Получаем удержания
        costs_query = supabase.table("mp_costs").select("*").gte("date", date_from).lte("date", date_to)
        if marketplace and marketplace != "all":
            costs_query = costs_query.eq("marketplace", marketplace)
        costs_result = costs_query.execute()

        # Группируем по product_id
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

        # Считаем costs только для товаров с продажами (исключаем orphan-затраты)
        for cost in costs_result.data:
            product_id = cost["product_id"]
            if product_id not in product_metrics:
                continue  # Пропускаем затраты для товаров без продаж в периоде
            product_metrics[product_id]["costs"] += float(cost.get("total_costs", 0))

        # Рассчитываем unit-экономику
        result = []
        for product_id, metrics in product_metrics.items():
            if product_id not in products:
                continue

            product = products[product_id]
            sales_count = metrics["sales"]
            revenue = metrics["revenue"]
            costs = metrics["costs"]
            purchase_price = float(product.get("purchase_price", 0))

            # Чистая прибыль
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

        # Сортируем по прибыли
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
        query = supabase.table("mp_sales").select("*").gte("date", date_from).lte("date", date_to).order("date")

        if marketplace and marketplace != "all":
            query = query.eq("marketplace", marketplace)
        if product_id:
            query = query.eq("product_id", product_id)

        result = query.execute()

        # Группируем по дате
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

        # Рассчитываем средний чек
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
        # Получаем рекламные расходы
        ads_query = supabase.table("mp_ad_costs").select("*").gte("date", date_from).lte("date", date_to)
        if marketplace and marketplace != "all":
            ads_query = ads_query.eq("marketplace", marketplace)
        ads_result = ads_query.execute()

        # Получаем продажи за тот же период для расчёта ДРР
        sales_query = supabase.table("mp_sales").select("*").gte("date", date_from).lte("date", date_to)
        if marketplace and marketplace != "all":
            sales_query = sales_query.eq("marketplace", marketplace)
        sales_result = sales_query.execute()

        # Группируем продажи по дате
        revenue_by_date = {}
        for sale in sales_result.data:
            date = sale["date"]
            if date not in revenue_by_date:
                revenue_by_date[date] = 0
            revenue_by_date[date] += float(sale.get("revenue", 0))

        # Группируем рекламные расходы по дате
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

        # Рассчитываем ДРР по дням
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

        # Общий ДРР
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
    date_from: Optional[str] = Query(None, description="Дата начала (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="Дата окончания (YYYY-MM-DD)"),
    marketplace: Optional[str] = Query(None, description="Фильтр по МП: wb, ozon"),
    product_id: Optional[str] = Query(None, description="Фильтр по товару (UUID)"),
    include_children: bool = Query(True, description="Включать подкатегории (детализацию) в дереве")
):
    """
    Иерархическое дерево удержаний (tree-view как в ЛК Ozon).
    Использует RPC функцию для оптимизации.
    """
    supabase = get_supabase_client()

    if not date_from:
        date_from = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    if not date_to:
        date_to = datetime.now().strftime("%Y-%m-%d")

    try:
        # Вызываем RPC функцию — один запрос вместо нескольких
        result = supabase.rpc(
            "get_costs_tree",
            {
                "p_date_from": date_from,
                "p_date_to": date_to,
                "p_marketplace": marketplace,
                "p_product_id": product_id,
                "p_include_children": include_children
            }
        ).execute()

        return result.data

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dashboard/costs-tree-combined")
async def get_costs_tree_combined(
    date_from: Optional[str] = Query(None, description="Дата начала (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="Дата окончания (YYYY-MM-DD)"),
    product_id: Optional[str] = Query(None, description="Фильтр по товару (UUID)"),
    include_children: bool = Query(True, description="Включать подкатегории (детализацию) в дереве")
):
    """
    Объединённое дерево удержаний для Ozon и WB в одном запросе.
    Экономит 1 HTTP запрос при marketplace=all.

    Возвращает:
    {
      "ozon": { costs-tree для Ozon },
      "wb": { costs-tree для WB },
      "period": { "from": "...", "to": "..." }
    }
    """
    supabase = get_supabase_client()

    if not date_from:
        date_from = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    if not date_to:
        date_to = datetime.now().strftime("%Y-%m-%d")

    try:
        # Вызываем RPC функцию — один запрос вместо двух
        result = supabase.rpc(
            "get_costs_tree_combined",
            {
                "p_date_from": date_from,
                "p_date_to": date_to,
                "p_product_id": product_id,
                "p_include_children": include_children
            }
        ).execute()

        return result.data

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dashboard/stocks")
async def get_stocks(marketplace: Optional[str] = Query(None)):
    """
    Текущие остатки по складам
    """
    supabase = get_supabase_client()

    try:
        query = supabase.table("mp_stocks").select("*, mp_products(name, barcode)")

        if marketplace and marketplace != "all":
            query = query.eq("marketplace", marketplace)

        result = query.execute()

        # Группируем по товару.
        # Важно: НЕ по product_name (возможны совпадения), а по (product_id|barcode) как по устойчивому ключу.
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

            # last_updated_at: max(updated_at) среди складов (если есть)
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
