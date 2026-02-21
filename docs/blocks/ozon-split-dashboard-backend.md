# Split Dashboard — Backend Analysis & Implementation Plan

## 1. Что УЖЕ есть

### 1.1 `mp_costs.settled_qty` — Ozon

**Статус:** Заполняется корректно для Ozon.

**Миграция 019** (`019_ozon_settlement_purchase.sql`):
```sql
ALTER TABLE mp_costs ADD COLUMN IF NOT EXISTS settled_qty INTEGER DEFAULT 0;
```

**Как заполняется** (`sync_service.py:1854-1862`):
```python
# В sync_costs_ozon(), для каждой операции Ozon:
if op_type == "OperationAgentDeliveredToCustomer":
    # settled_qty = количество единиц, проданных по дате расчёта
    item_qty = int(item.get("quantity", 1) or 1)
    costs_agg[key]["settled_qty"] += item_qty
```

Ключ агрегации: `(barcode, date, fulfillment_type)`.
Записывается при upsert в mp_costs (строка 1902):
```python
"settled_qty": costs.get("settled_qty", 0),
```

**Ozon API источник:** `/v3/finance/transaction/list` → `operation_type == "OperationAgentDeliveredToCustomer"` → `item.quantity`.

### 1.2 `mp_costs.settled_qty` — WB

**Статус:** НЕ заполняется (`sync_costs_wb` не пишет `settled_qty`).

**Но это НЕ проблема.** WB `reportDetailByPeriod` — это УЖЕ settlement-based финансовый отчёт. Дата `rr_dt` = дата финоперации (расчёта), а не заказа. Поэтому WB `mp_sales.sales_count` из этого отчёта = settled_qty (те же данные, та же ось дат).

**Вывод:** Для WB можно использовать `mp_sales.sales_count` как settlement-based purchase, поскольку WB mp_sales заполняется из того же reportDetailByPeriod, который уже settlement-based.

### 1.3 UE endpoint — как считает purchase для Ozon

**Файл:** `dashboard.py:404-410`
```python
is_ozon = product_id in ozon_product_ids or bool(product.get("ozon_product_id"))
if is_ozon and has_ozon_settled and product_id in settled_qty_by_product:
    raw_purchase = purchase_price * settled_qty_by_product[product_id]
else:
    raw_purchase = purchase_price * sales_count  # fallback / WB
```

UE endpoint **УЖЕ** правильно делает settlement-based purchase для Ozon. Логику можно переиспользовать.

### 1.4 costs-tree RPC response (текущий)

**RPC:** `get_costs_tree()` (миграция 018)

Возвращает JSON:
```json
{
  "status": "success",
  "period": {"from": "...", "to": "..."},
  "marketplace": "ozon",
  "total_accrued": 963.27,    // SUM(all tree items) = к перечислению
  "total_revenue": 1783.0,    // ABS(SUM(category='Продажи'))
  "percent_base_sales": 1783.0,
  "source": "mp_costs_details",
  "tree": [...]
}
```

**НЕТ** полей `settled_sales_count` и `settled_purchase`.

### 1.5 `get_dashboard_summary` RPC (текущий — миграция 020)

Возвращает ORDER-based данные из mp_sales:
- `orders`, `sales`, `returns`, `revenue` — из mp_sales (дата заказа)
- `purchase_costs_total` — `purchase_price × sales_count` из mp_sales (ORDER-based, все МП)
- `total_costs` — из mp_costs (SETTLEMENT-based)
- `ad_cost` — из mp_ad_costs

**Проблема зоны "Финансы":** фронтенд берёт `payoutForTile` из costs-tree (SETTLEMENT) и `purchaseCostsForTile` из RPC summary (ORDER). Формула прибыли:
```
netProfitForTile = payoutForTile - purchaseCostsForTile - ad
```
Это **смешение осей** (DashboardPage.tsx:437).

---

## 2. Что нужно ДОБАВИТЬ

### 2.1 Новые поля в costs-tree response

Для зоны "Финансы" фронтенду нужны settlement-based purchase данные:

```json
{
  "tree": [...],
  "total_accrued": 963.27,
  "total_revenue": 1783.0,
  "percent_base_sales": 1783.0,
  "source": "mp_costs_details",
  "settled_sales_count": 4,      // NEW: количество проведённых единиц
  "settled_purchase": 1616.0     // NEW: purchase_price × settled_qty
}
```

### 2.2 Где добавить — Python wrapper (вариант А)

**Решение: добавить в Python endpoint** (`dashboard.py` — costs-tree endpoint), а НЕ в RPC.

**Почему Python, а не RPC:**
1. **RPC get_costs_tree менять НЕ нужно** (правило #4 задания). RPC работает с mp_costs_details, а settled_qty лежит в mp_costs — это разные таблицы.
2. Python wrapper `_fetch_costs_tree_merged()` уже обогащает данные (merge FBO+FBS). Добавление 2 полей — естественное расширение.
3. Один дополнительный запрос к mp_costs (маленькая таблица, индексированная) — минимальная нагрузка.
4. Для WB нужен запрос к mp_sales (другая таблица) — в SQL RPC это было бы сложнее и менее читаемо.

### 2.3 Логика расчёта по маркетплейсам

**Ozon (settlement-based — из mp_costs):**
```
settled_sales_count = SUM(mp_costs.settled_qty)
    WHERE marketplace='ozon' AND date BETWEEN ... AND fulfillment_type=...
settled_purchase = SUM(mp_products.purchase_price × mp_costs.settled_qty)
    WHERE marketplace='ozon' AND date BETWEEN ... AND fulfillment_type=...
```

**WB (settlement-based — из mp_sales, т.к. WB mp_sales уже settlement-based):**
```
settled_sales_count = SUM(mp_sales.sales_count)
    WHERE marketplace='wb' AND date BETWEEN ... AND fulfillment_type=...
settled_purchase = SUM(mp_products.purchase_price × mp_sales.sales_count)
    WHERE marketplace='wb' AND date BETWEEN ... AND fulfillment_type=...
```

**Почему WB использует mp_sales:** WB `sync_sales_wb` и `sync_costs_wb` оба используют `reportDetailByPeriod` (settlement-based financial report). Дата `rr_dt` — это дата финоперации. Поэтому mp_sales для WB = settlement-based данные. Нет необходимости в отдельном settled_qty для WB.

---

## 3. Нужна ли миграция?

### 3.1 `settled_qty` в mp_costs

**УЖЕ ЕСТЬ** (миграция 019). Заполняется для Ozon. Для WB не нужен (mp_sales уже settlement-based).

### 3.2 Нужен ли `settlement_revenue`?

**НЕТ.** Settlement-based revenue уже есть в costs-tree: `total_revenue` (= tree item "Продажи"). Это значение из mp_costs_details, которое settlement-based по определению (данные из финансовых API).

### 3.3 Нужна ли новая таблица?

**НЕТ.** Все необходимые данные есть:
- Ozon settled_qty → `mp_costs.settled_qty`
- WB settled_qty → `mp_sales.sales_count` (уже settlement-based)
- purchase_price → `mp_products.purchase_price`

### 3.4 Нужен ли settled_qty для WB в mp_costs?

**Опционально, но НЕ блокирует.** Можно добавить в sync_costs_wb позже для единообразия. Сейчас — используем mp_sales.sales_count как эквивалент.

---

## 4. Что НЕ менять

| Компонент | Статус |
|-----------|--------|
| RPC `get_dashboard_summary` | НЕ МЕНЯТЬ — зона "Продажи" (ORDER-based) |
| RPC `get_costs_tree` (SQL) | НЕ МЕНЯТЬ — добавляем в Python wrapper |
| sync pipeline | НЕ МЕНЯТЬ |
| UE endpoint | НЕ МЕНЯТЬ — уже правильно |
| `_merge_costs_tree_data()` | РАСШИРИТЬ — пробросить новые поля при merge |

---

## 5. API Contract

### 5.1 costs-tree endpoint — расширенный response

**Endpoint:** `GET /dashboard/costs-tree`

Текущий:
```json
{
  "status": "success",
  "period": {"from": "2026-02-01", "to": "2026-02-21"},
  "marketplace": "ozon",
  "total_accrued": 963.27,
  "total_revenue": 1783.0,
  "percent_base_sales": 1783.0,
  "source": "mp_costs_details",
  "tree": [...]
}
```

Новый:
```json
{
  "status": "success",
  "period": {"from": "2026-02-01", "to": "2026-02-21"},
  "marketplace": "ozon",
  "total_accrued": 963.27,
  "total_revenue": 1783.0,
  "percent_base_sales": 1783.0,
  "source": "mp_costs_details",
  "tree": [...],
  "settled_sales_count": 4,
  "settled_purchase": 1616.0
}
```

### 5.2 costs-tree-combined — тоже расширяется

```json
{
  "ozon": { "...", "settled_sales_count": 4, "settled_purchase": 1616.0 },
  "wb":   { "...", "settled_sales_count": 12, "settled_purchase": 4848.0 },
  "period": {"from": "...", "to": "..."}
}
```

### 5.3 Backward compatibility

Новые поля — additive. Фронтенд, который не знает о них, просто игнорирует. Ничего не ломается.

---

## 6. Конкретный код

### 6.1 Новый хелпер: `_fetch_settled_purchase()`

Добавить в `dashboard.py` перед `_fetch_costs_tree_merged()`:

```python
def _fetch_settled_purchase(
    supabase,
    date_from: str,
    date_to: str,
    marketplace: str | None,
    user_id: str,
    fulfillment_type: str | None,
) -> dict:
    """
    Считает settlement-based purchase для зоны "Финансы".
    Ozon: settled_qty из mp_costs (Finance Transaction List).
    WB: sales_count из mp_sales (reportDetailByPeriod — уже settlement-based).
    Возвращает: { "settled_sales_count": int, "settled_purchase": float }
    """
    total_settled_qty = 0
    total_settled_purchase = 0.0

    mp_list = [marketplace] if marketplace and marketplace != "all" else ["ozon", "wb"]

    for mp in mp_list:
        if mp == "ozon":
            # Ozon: settled_qty из mp_costs (settlement date)
            query = (
                supabase.table("mp_costs")
                .select("product_id, settled_qty")
                .eq("user_id", user_id)
                .eq("marketplace", "ozon")
                .gte("date", date_from)
                .lte("date", date_to)
            )
            if fulfillment_type:
                query = query.eq("fulfillment_type", fulfillment_type)
            costs_result = query.execute()

            # Агрегируем settled_qty по product_id
            ozon_qty_by_product: dict[str, int] = {}
            for row in costs_result.data:
                pid = row.get("product_id")
                qty = int(row.get("settled_qty", 0) or 0)
                if pid and qty > 0:
                    ozon_qty_by_product[pid] = ozon_qty_by_product.get(pid, 0) + qty

            if ozon_qty_by_product:
                # Получаем purchase_price для этих продуктов
                product_ids = list(ozon_qty_by_product.keys())
                products_result = (
                    supabase.table("mp_products")
                    .select("id, purchase_price")
                    .eq("user_id", user_id)
                    .in_("id", product_ids)
                    .execute()
                )
                price_map = {
                    p["id"]: float(p.get("purchase_price", 0) or 0)
                    for p in products_result.data
                }

                for pid, qty in ozon_qty_by_product.items():
                    total_settled_qty += qty
                    total_settled_purchase += price_map.get(pid, 0) * qty

        elif mp == "wb":
            # WB: sales_count из mp_sales (reportDetailByPeriod = settlement-based)
            query = (
                supabase.table("mp_sales")
                .select("product_id, sales_count")
                .eq("user_id", user_id)
                .eq("marketplace", "wb")
                .gte("date", date_from)
                .lte("date", date_to)
            )
            if fulfillment_type:
                query = query.eq("fulfillment_type", fulfillment_type)
            sales_result = query.execute()

            # Агрегируем sales_count по product_id
            wb_qty_by_product: dict[str, int] = {}
            for row in sales_result.data:
                pid = row.get("product_id")
                qty = int(row.get("sales_count", 0) or 0)
                if pid and qty > 0:
                    wb_qty_by_product[pid] = wb_qty_by_product.get(pid, 0) + qty

            if wb_qty_by_product:
                product_ids = list(wb_qty_by_product.keys())
                products_result = (
                    supabase.table("mp_products")
                    .select("id, purchase_price")
                    .eq("user_id", user_id)
                    .in_("id", product_ids)
                    .execute()
                )
                price_map = {
                    p["id"]: float(p.get("purchase_price", 0) or 0)
                    for p in products_result.data
                }

                for pid, qty in wb_qty_by_product.items():
                    total_settled_qty += qty
                    total_settled_purchase += price_map.get(pid, 0) * qty

    return {
        "settled_sales_count": total_settled_qty,
        "settled_purchase": round(total_settled_purchase, 2),
    }
```

### 6.2 Модификация costs-tree endpoint

Изменить `get_costs_tree()` endpoint в `dashboard.py` (строка 821):

```python
@router.get("/dashboard/costs-tree")
async def get_costs_tree(
    current_user: CurrentUser = Depends(get_current_user),
    sub: UserSubscription = Depends(get_user_subscription),
    date_from: Optional[str] = Query(None, description="Дата начала (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="Дата окончания (YYYY-MM-DD)"),
    marketplace: Optional[str] = Query(None, description="Фильтр по МП: wb, ozon"),
    product_id: Optional[str] = Query(None, description="Фильтр по товару (UUID)"),
    include_children: bool = Query(True, description="Включать подкатегории"),
    fulfillment_type: Optional[str] = Query(None, pattern="^(FBO|FBS)$"),
):
    """
    Иерархическое дерево удержаний (tree-view как в ЛК Ozon).
    Дополнительно: settled_sales_count и settled_purchase для зоны "Финансы".
    """
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

        # Обогащаем settlement-based purchase (только если нет фильтра по товару)
        if isinstance(result, dict) and not product_id:
            settled = _fetch_settled_purchase(
                supabase, date_from, date_to,
                marketplace, current_user.id, fulfillment_type,
            )
            result["settled_sales_count"] = settled["settled_sales_count"]
            result["settled_purchase"] = settled["settled_purchase"]

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

### 6.3 Модификация costs-tree-combined endpoint

```python
@router.get("/dashboard/costs-tree-combined")
async def get_costs_tree_combined(
    current_user: CurrentUser = Depends(get_current_user),
    sub: UserSubscription = Depends(get_user_subscription),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    product_id: Optional[str] = Query(None),
    include_children: bool = Query(True),
    fulfillment_type: Optional[str] = Query(None, pattern="^(FBO|FBS)$"),
):
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

        # Обогащаем settlement-based purchase per marketplace
        if not product_id:
            if isinstance(ozon_data, dict):
                settled_ozon = _fetch_settled_purchase(
                    supabase, date_from, date_to,
                    "ozon", current_user.id, fulfillment_type,
                )
                ozon_data["settled_sales_count"] = settled_ozon["settled_sales_count"]
                ozon_data["settled_purchase"] = settled_ozon["settled_purchase"]

            if isinstance(wb_data, dict):
                settled_wb = _fetch_settled_purchase(
                    supabase, date_from, date_to,
                    "wb", current_user.id, fulfillment_type,
                )
                wb_data["settled_sales_count"] = settled_wb["settled_sales_count"]
                wb_data["settled_purchase"] = settled_wb["settled_purchase"]

        return {
            "ozon": ozon_data,
            "wb": wb_data,
            "period": {"from": date_from, "to": date_to},
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

### 6.4 Модификация `_merge_costs_tree_data()` — проброс новых полей

При merge FBO+FBS (когда fulfillment_type=NULL), новые поля тоже должны суммироваться:

```python
def _merge_costs_tree_data(primary: dict, supplement: dict) -> dict:
    # ... (existing code) ...

    return {
        "status": "success",
        "period": primary.get("period"),
        "marketplace": primary.get("marketplace"),
        "total_accrued": round(p_accrued + s_accrued, 2),
        "total_revenue": round(p_revenue + s_revenue, 2),
        "percent_base_sales": round(p_sales + s_sales, 2),
        "source": "merged",
        "tree": list(tree_map.values()),
        # Проброс settlement полей (если есть)
        "settled_sales_count": (
            int(primary.get("settled_sales_count") or 0) +
            int(supplement.get("settled_sales_count") or 0)
        ),
        "settled_purchase": round(
            float(primary.get("settled_purchase") or 0) +
            float(supplement.get("settled_purchase") or 0),
            2,
        ),
    }
```

**Примечание:** При FT=NULL merge происходит ДО обогащения в endpoint. Поэтому settled-поля в merge будут 0+0=0, а потом endpoint перезапишет их через `_fetch_settled_purchase()`. Но проброс нужен на случай, если `_fetch_costs_tree_merged()` вызывается из UE/order-funnel — там они могут быть полезны.

---

## 7. Схема вызовов (текущая vs новая)

### Текущая (проблема):
```
Frontend DashboardPage.tsx:437
  netProfitForTile = payoutForTile - purchaseCostsForTile - ad
                     ^^^^^^^^^^^^^^^   ^^^^^^^^^^^^^^^^^^
                     costs-tree         RPC summary
                     (SETTLEMENT)       (ORDER) ← СМЕШЕНИЕ ОСЕЙ
```

### Новая (исправлено):
```
Frontend DashboardPage.tsx (новый)
  // Зона "Финансы":
  settledPurchase = ozonCostsTreeData.settled_purchase + wbCostsTreeData.settled_purchase
  netProfitForTile = payoutForTile - settledPurchase - ad
                     ^^^^^^^^^^^^^^^   ^^^^^^^^^^^^^^^
                     costs-tree         costs-tree response
                     (SETTLEMENT)       (SETTLEMENT) ← ОДНА ОСЬ ✓
```

---

## 8. Количество дополнительных запросов

**costs-tree endpoint:**
- +1 запрос к mp_costs (Ozon settled_qty) — ~5 строк за период
- +1 запрос к mp_sales (WB sales_count) — ~30-60 строк за период
- +1 запрос к mp_products (purchase_price) — ~5 строк

**Итого:** +3 маленьких запроса при каждом вызове costs-tree. Таблицы индексированы по (user_id, marketplace, date). Латентность: <10ms каждый.

**Оптимизация (при необходимости):** products запрос можно кешировать (purchase_price редко меняется). Или объединить Ozon+WB в один запрос. Но для 5 SKU это преждевременная оптимизация.

---

## 9. Тестирование

### Верификация:
1. Вызвать `GET /dashboard/costs-tree?marketplace=ozon&date_from=2026-02-01&date_to=2026-02-21`
2. Проверить: `settled_purchase` ≈ `SUM(purchase_price × settled_qty)` из mp_costs WHERE marketplace=ozon
3. Для WB: `settled_purchase` ≈ `SUM(purchase_price × sales_count)` из mp_sales WHERE marketplace=wb
4. Ключевая проверка: `total_accrued - settled_purchase - ad_cost ≈ profit` (все на settlement оси)

### Edge cases:
- Ozon без settled_qty данных (sync ещё не запускался с новым кодом) → settled_sales_count=0, settled_purchase=0.0
- product_id фильтр → settled_purchase НЕ добавляется (per-product settlement не нужен для dashboard)
- marketplace=all → суммируются оба МП
- fulfillment_type=FBO/FBS → фильтруется корректно (оба запроса используют fulfillment_type)
