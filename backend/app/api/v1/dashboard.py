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
    marketplace: Optional[str] = Query(None, description="Фильтр по МП: wb, ozon")
):
    """
    Сводка по продажам за период

    Возвращает агрегированные данные:
    - Общее количество заказов, выкупов, возвратов
    - Выручка
    - Средний процент выкупа
    """
    supabase = get_supabase_client()

    # Если даты не указаны, берём последние 30 дней
    if not date_from:
        date_from = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    if not date_to:
        date_to = datetime.now().strftime("%Y-%m-%d")

    try:
        query = supabase.table("mp_sales").select("*").gte("date", date_from).lte("date", date_to)

        # Фильтр по маркетплейсу (только если не "all")
        if marketplace and marketplace != "all":
            query = query.eq("marketplace", marketplace)

        result = query.execute()
        sales = result.data

        # Агрегация
        total_orders = sum(s.get("orders_count", 0) for s in sales)
        total_sales = sum(s.get("sales_count", 0) for s in sales)
        total_returns = sum(s.get("returns_count", 0) for s in sales)
        total_revenue = sum(float(s.get("revenue", 0)) for s in sales)

        avg_buyout = round(total_sales / total_orders * 100, 2) if total_orders > 0 else 0

        # Получаем удержания для чистой прибыли (с детализацией)
        # Фильтруем costs только по product_id, у которых есть продажи в периоде
        # Это исключает orphan-затраты (хранение без продаж)
        product_ids_with_sales = list(set(s["product_id"] for s in sales if s.get("product_id")))

        costs_result_data = []
        # Для WB "истина" включает начисления/удержания вне продаж (например, хранение).
        # Поэтому для marketplace=wb НЕ фильтруем orphan-costs по product_id с продажами.
        if marketplace == "wb":
            costs_query = supabase.table("mp_costs").select("*").gte("date", date_from).lte("date", date_to).eq("marketplace", "wb")
            costs_result = costs_query.execute()
            costs_result_data = costs_result.data
        elif product_ids_with_sales:
            costs_query = supabase.table("mp_costs").select("*").gte("date", date_from).lte("date", date_to)
            if marketplace and marketplace != "all":
                costs_query = costs_query.eq("marketplace", marketplace)
            costs_query = costs_query.in_("product_id", product_ids_with_sales)
            costs_result = costs_query.execute()
            costs_result_data = costs_result.data

        total_costs = sum(float(c.get("total_costs", 0)) for c in costs_result_data)

        # Детализация расходов
        costs_commission = sum(float(c.get("commission", 0)) for c in costs_result_data)
        costs_logistics = sum(float(c.get("logistics", 0)) for c in costs_result_data)
        costs_storage = sum(float(c.get("storage", 0)) for c in costs_result_data)
        costs_penalties = sum(float(c.get("penalties", 0)) for c in costs_result_data)
        costs_acquiring = sum(float(c.get("acquiring", 0)) for c in costs_result_data)
        costs_other = sum(float(c.get("other_costs", 0)) for c in costs_result_data)

        # Получаем рекламные расходы
        ads_query = supabase.table("mp_ad_costs").select("cost").gte("date", date_from).lte("date", date_to)
        if marketplace and marketplace != "all":
            ads_query = ads_query.eq("marketplace", marketplace)
        ads_result = ads_query.execute()
        total_ad_cost = sum(float(a.get("cost", 0)) for a in ads_result.data)

        # Закупочные расходы
        products_result = supabase.table("mp_products").select("id, purchase_price").execute()
        purchase_prices = {p["id"]: float(p.get("purchase_price", 0)) for p in products_result.data}
        total_purchase = sum(
            purchase_prices.get(s["product_id"], 0) * s.get("sales_count", 0)
            for s in sales
        )

        # Чистая прибыль = выручка - удержания МП - реклама - закупка
        net_profit = total_revenue - total_costs - total_ad_cost - total_purchase

        # ДРР = рекламные расходы / выручка * 100
        drr = round(total_ad_cost / total_revenue * 100, 2) if total_revenue > 0 else 0

        # Средний чек
        avg_check = round(total_revenue / total_sales, 2) if total_sales > 0 else 0

        # === Данные за ПРЕДЫДУЩИЙ период (для сравнения) ===
        from_date = datetime.strptime(date_from, "%Y-%m-%d")
        to_date = datetime.strptime(date_to, "%Y-%m-%d")
        period_days = (to_date - from_date).days + 1
        prev_from = (from_date - timedelta(days=period_days)).strftime("%Y-%m-%d")
        prev_to = (from_date - timedelta(days=1)).strftime("%Y-%m-%d")

        prev_query = supabase.table("mp_sales").select("*").gte("date", prev_from).lte("date", prev_to)
        if marketplace and marketplace != "all":
            prev_query = prev_query.eq("marketplace", marketplace)
        prev_result = prev_query.execute()
        prev_sales = prev_result.data

        prev_revenue = sum(float(s.get("revenue", 0)) for s in prev_sales)
        prev_total_sales = sum(s.get("sales_count", 0) for s in prev_sales)
        prev_orders = sum(s.get("orders_count", 0) for s in prev_sales)

        # Прошлый/Настоящий % (рост выручки)
        revenue_change = round((total_revenue - prev_revenue) / prev_revenue * 100, 1) if prev_revenue > 0 else 0

        return {
            "status": "success",
            "period": {"from": date_from, "to": date_to},
            "marketplace": marketplace or "all",
            "summary": {
                "orders": total_orders,
                "sales": total_sales,
                "returns": total_returns,
                "revenue": round(total_revenue, 2),
                "buyout_percent": avg_buyout,
                "net_profit": round(net_profit, 2),
                "drr": drr,
                "ad_cost": round(total_ad_cost, 2),
                "total_costs": round(total_costs, 2),
                "avg_check": avg_check,
                "costs_breakdown": {
                    "commission": round(costs_commission, 2),
                    "logistics": round(costs_logistics, 2),
                    "storage": round(costs_storage, 2),
                    "penalties": round(costs_penalties, 2),
                    "acquiring": round(costs_acquiring, 2),
                    "other": round(costs_other, 2)
                }
            },
            "previous_period": {
                "revenue": round(prev_revenue, 2),
                "sales": prev_total_sales,
                "orders": prev_orders,
                "revenue_change_percent": revenue_change
            }
        }

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
    product_id: Optional[str] = Query(None, description="Фильтр по товару (UUID)")
):
    """
    Иерархическое дерево удержаний (tree-view как в ЛК Ozon).

    Возвращает дерево:
    - Начислено за период (итого)
      - Продажи (Выручка, Баллы, Партнёры)
      - Вознаграждение Ozon (Витамины, Прочее) — наша группировка
      - Услуги доставки (Логистика, Возвраты)
      - Услуги агентов (Эквайринг, Звёздные товары)
      - Услуги FBO (Размещение товаров)
      - Продвижение и реклама (Бонусы продавца)
    """
    supabase = get_supabase_client()

    if not date_from:
        date_from = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    if not date_to:
        date_to = datetime.now().strftime("%Y-%m-%d")

    try:
        query = supabase.table("mp_costs_details").select("*") \
            .gte("date", date_from).lte("date", date_to)

        if marketplace and marketplace != "all":
            query = query.eq("marketplace", marketplace)
        if product_id:
            query = query.eq("product_id", product_id)

        result = query.execute()
        details = result.data

        # Fallback: если детализация не синхронизирована, собираем best-effort дерево из mp_sales/mp_costs,
        # чтобы UI не был пустым (и можно было увидеть хоть какие-то числа).
        # Для WB это критично: mp_costs_details появляется только после sync_costs_wb новой версии.
        warnings: list[str] = []
        source = "mp_costs_details"
        if not details and marketplace in ["wb", "ozon"]:
            source = "fallback_mp_sales_mp_costs"
            warnings.append("Нет mp_costs_details за период — показаны агрегаты (без точного 'К перечислению'). Запусти sync/costs для полной детализации.")

            # Sales total (mp_sales.revenue)
            sales_total = total_revenue

            # Costs totals (mp_costs)
            costs_query = supabase.table("mp_costs").select("*").gte("date", date_from).lte("date", date_to).eq("marketplace", marketplace)
            if product_id:
                costs_query = costs_query.eq("product_id", product_id)
            costs_result = costs_query.execute()
            costs_rows = costs_result.data

            def ssum(field: str) -> float:
                return sum(float(c.get(field, 0) or 0) for c in costs_rows)

            comm = ssum("commission")
            logi = ssum("logistics")
            stor = ssum("storage")
            acq = ssum("acquiring")
            pen = ssum("penalties")
            other = ssum("other_costs")

            # Собираем pseudo-details (с знаками для дерева)
            pseudo = []
            if sales_total:
                pseudo.append({"category": "Продажи", "subcategory": "Выручка", "amount": sales_total})

            if marketplace == "wb":
                if comm:
                    pseudo.append({"category": "Вознаграждение WB", "subcategory": "Комиссия WB (агрегат)", "amount": -comm})
                if logi:
                    pseudo.append({"category": "Логистика", "subcategory": "Логистика (агрегат)", "amount": -logi})
                if acq:
                    pseudo.append({"category": "Эквайринг", "subcategory": "Эквайринг (агрегат)", "amount": -acq})
                if stor:
                    pseudo.append({"category": "Хранение", "subcategory": "Хранение (агрегат)", "amount": -stor})
                if pen:
                    pseudo.append({"category": "Штрафы", "subcategory": "Штрафы (агрегат)", "amount": -pen})
                if other:
                    pseudo.append({"category": "Прочее", "subcategory": "Прочее (агрегат)", "amount": -other})
            else:
                # ozon fallback (на случай)
                if comm:
                    pseudo.append({"category": "Вознаграждение Ozon", "subcategory": "Комиссия (агрегат)", "amount": -comm})
                if logi:
                    pseudo.append({"category": "Услуги доставки", "subcategory": "Логистика (агрегат)", "amount": -logi})
                if acq:
                    pseudo.append({"category": "Услуги агентов", "subcategory": "Эквайринг (агрегат)", "amount": -acq})
                if stor:
                    pseudo.append({"category": "Услуги FBO", "subcategory": "Складские услуги (агрегат)", "amount": -stor})
                if other:
                    pseudo.append({"category": "Прочее", "subcategory": "Прочее (агрегат)", "amount": -other})

            details = pseudo

        # Также получаем выручку (mp_sales.revenue) — оставляем в ответе, но для мэтчинга с ЛК Ozon
        # проценты должны считаться от "Продажи" (внутри дерева), а не от mp_sales.revenue.
        sales_query = supabase.table("mp_sales").select("revenue, marketplace") \
            .gte("date", date_from).lte("date", date_to)
        if marketplace and marketplace != "all":
            sales_query = sales_query.eq("marketplace", marketplace)
        if product_id:
            sales_query = sales_query.eq("product_id", product_id)
        sales_result = sales_query.execute()
        total_revenue = sum(float(s.get("revenue", 0)) for s in sales_result.data)

        # Агрегируем по category → subcategory
        # Используем Decimal, чтобы не ловить плавающие ошибки округления (копейки)
        from decimal import Decimal, ROUND_HALF_UP

        def d(x) -> Decimal:
            try:
                return Decimal(str(x or "0"))
            except Exception:
                return Decimal("0")

        tree: dict[str, dict[str, Decimal]] = {}  # {category: {subcategory: amount}}
        for row in details:
            cat = row.get("category", "Прочее")
            sub = row.get("subcategory", "")
            amount = d(row.get("amount", 0))

            if cat not in tree:
                tree[cat] = {}
            if sub not in tree[cat]:
                tree[cat][sub] = Decimal("0")
            tree[cat][sub] += amount

        # База для % как в ЛК Ozon: "Продажи" (а не mp_sales.revenue).
        sales_base = Decimal("0")
        if "Продажи" in tree:
            sales_base = sum(tree["Продажи"].values(), Decimal("0"))
        sales_base_abs = abs(sales_base)
        total_revenue_abs = abs(d(total_revenue))

        # Формируем иерархию для frontend
        # Порядок категорий как в ЛК (Ozon / WB)
        if marketplace == "wb":
            category_order = [
                "Продажи",
                "Возмещения",
                "Вознаграждение Вайлдберриз (ВВ)",
                "Эквайринг/Комиссии за организацию платежей",
                "Услуги по доставке товара покупателю",
                "Стоимость хранения",
                "Стоимость операций при приемке",
                "Прочие удержания/выплаты",
                "Общая сумма штрафов",
                "Корректировка Вознаграждения Вайлдберриз (ВВ)",
                "Стоимость участия в программе лояльности",
                "Компенсация скидки по программе лояльности",
                "Разовое изменение срока перечисления денежных средств",
            ]
        else:
            category_order = [
                "Продажи",
                "Вознаграждение Ozon",
                "Услуги доставки",
                "Услуги агентов",
                "Услуги FBO",
                "Продвижение и реклама",
                "Прочее",
            ]

        tree_items = []
        total_accrued = Decimal("0")

        def _sorted_children(category: str, items: dict[str, Decimal]) -> list[tuple[str, Decimal]]:
            """
            Сортировка подкатегорий:
            - где известен порядок ЛК — фиксируем его
            - иначе — по убыванию |amount| (чтобы крупное было сверху), затем по имени (детерминизм)
            """
            preferred: dict[str, list[str]] = {
                # OZON (как в ЛК начислений)
                "Продажи": ["Выручка", "Баллы за скидки", "Программы партнёров"],
                "Возвраты": ["Возврат выручки", "Баллы за скидки", "Программы партнёров"],
                "Вознаграждение Ozon": ["Вознаграждение за продажу", "Возврат вознаграждения", "Витамины", "Прочее"],
                "Услуги доставки": ["Логистика", "Обратная логистика", "Возвраты"],
                "Услуги агентов": ["Эквайринг", "Звёздные товары", "Доставка до места выдачи"],
                "Услуги FBO": [
                    "Складские услуги",
                    "Размещение товаров",
                    "Размещение товаров на складах Ozon",
                    "Размещение товаров на складах",
                ],
                "Продвижение и реклама": ["Бонусы продавца"],
            }

            pref = preferred.get(category, [])
            rank = {name: i for i, name in enumerate(pref)}

            def key(kv: tuple[str, Decimal]) -> tuple[int, float, str]:
                name, amount = kv
                if name in rank:
                    return (rank[name], 0.0, name)
                return (999, -float(abs(amount)), name)

            return sorted(items.items(), key=key)

        for cat in category_order:
            if cat not in tree:
                continue

            subcategories = tree[cat]
            cat_total = sum(subcategories.values(), Decimal("0"))
            total_accrued += cat_total

            # % как в ЛК: от "Продажи" (только для расходных категорий)
            denom = sales_base_abs if sales_base_abs > 0 else total_revenue_abs
            pct = (
                float((abs(cat_total) / denom * Decimal("100")).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))
                if denom > 0 and cat != "Продажи"
                else None
            )

            children = []
            for sub, amount in _sorted_children(cat, subcategories):
                children.append({
                    "name": sub,
                    "amount": float(amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
                })

            tree_items.append({
                "name": cat,
                "amount": float(cat_total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
                "percent": pct,
                "children": children,
            })

        resp = {
            "status": "success",
            "period": {"from": date_from, "to": date_to},
            "marketplace": marketplace or "all",
            "total_accrued": float(total_accrued.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            "total_revenue": round(total_revenue, 2),
            "percent_base_sales": float(sales_base_abs.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            "tree": tree_items,
        }
        if warnings:
            resp["warnings"] = warnings
            resp["source"] = source
        return resp

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
