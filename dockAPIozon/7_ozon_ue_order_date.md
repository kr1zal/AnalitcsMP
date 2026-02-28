# Ozon UE — order_date для точного совпадения с ЛК

> Дата работы: 2026-02-28
> Статус: DONE (profit gap ~4₽ из ~1517₽ → решено на 99.7%)

## Проблема

Сверка UE с ЛК Ozon (Д3 К2, 21-26 фев):
- **Наш profit:** -1,517₽
- **ЛК profit:** +6.32₽
- **Diff:** 1,523₽

**Причина:** `mp_costs_details.date` = settlement date (дата фин. расчёта), а не дата заказа. В один settlement-период попадают расчёты по заказам из РАЗНЫХ периодов.

Пример: заказ от 18 фев может быть "рассчитан" (settlement) 21 фев. При фильтре 21-26 фев по settlement date мы захватываем финансы за заказы, которых в этом периоде не было.

## Решение: order_date из Ozon API

### Источник данных

Endpoint: `POST /v3/finance/transaction/list` (файл `3.md`)

Каждая операция содержит:
```json
{
  "operation_date": "2026-02-24T00:00:00Z",  // settlement date (=mp_costs_details.date)
  "posting": {
    "order_date": "2026-02-23T14:20:50Z"      // РЕАЛЬНАЯ дата заказа
  }
}
```

- `operation_date` — когда Ozon провёл финансовую операцию (settlement)
- `posting.order_date` — когда покупатель оформил заказ (order)
- Storage операции имеют пустой `posting.order_date` → корректно становится NULL

### Подход в UE endpoint

**Два запроса к mp_costs_details:**

1. **Query 1** (per-order): `WHERE order_date BETWEEN date_from AND date_to`
   - Захватывает только операции по заказам ИЗ выбранного периода
   - Payout, revenue, удержания — точно как в ЛК

2. **Query 2** (account-level): `WHERE order_date IS NULL AND date BETWEEN date_from AND date_to`
   - Storage, бонусы и другие операции без привязки к заказу
   - Фильтруются по settlement date (единственный вариант)

**Profit формула (Ozon order_date):**
```
profit = order_payout - purchase_price × qty
```
- `order_payout` = SUM(amount) WHERE order_date IN period (уже включает удержания И рекламу)
- Ad cost НЕ вычитается отдельно — реклама (Звёздные товары) уже внутри payout как finance-deduction
- Storage вычитается из общего payout (account-level, равное распределение)

## Изменения по файлам

### 1. Миграция `backend/migrations/030_order_date.sql` ✅ Applied

```sql
ALTER TABLE mp_costs_details ADD COLUMN IF NOT EXISTS order_date DATE;

CREATE INDEX IF NOT EXISTS idx_mp_costs_details_order_date
    ON mp_costs_details(user_id, marketplace, order_date)
    WHERE order_date IS NOT NULL;

-- Backfill: order_date = date (settlement) как приближение до re-sync
UPDATE mp_costs_details SET order_date = date
    WHERE order_date IS NULL AND marketplace = 'ozon';
```

**ВАЖНО:** Backfill ставит order_date = settlement date. Реальные order_date появляются ТОЛЬКО после re-sync.

### 2. Sync: `backend/app/services/sync_service.py` — sync_costs_ozon()

Что добавлено:
```python
# Извлечение order_date из API response
posting = op.get("posting", {}) or {}
order_date = str(posting.get("order_date") or "")[:10] or None

# Добавлен в ключ агрегации
key = (pid, date, ft, rec["category"], rec["subcategory"], order_date)

# Добавлен в INSERT
if od:
    insert_row["order_date"] = od
```

Что НЕ менялось:
- DELETE по settlement date range (как было)
- mp_costs агрегат (settlement-based, для costs-tree)
- Логика FBS detection (delivery_schema)

### 3. UE endpoint: `backend/app/api/v1/dashboard.py`

#### a) Исключение "Бонусы продавца"
```python
_UE_EXCLUDED_SUBCATEGORIES = {"Бонусы продавца"}

def _accumulate_od_row(pid, amt, cat, ft_val, subcat=""):
    if subcat in _UE_EXCLUDED_SUBCATEGORIES:
        return
    # ... accumulate payout/revenue
```
Причина: "Бонусы продавца" (~3.96₽) включены в payout, но НЕ отображаются в ЛК UE.

#### b) Два запроса (Query 1 + Query 2)
```python
# Query 1: per-order operations (order_date filter)
od_query = (
    supabase.table("mp_costs_details")
    .select("product_id, category, subcategory, amount, fulfillment_type")
    .eq("user_id", current_user.id)
    .eq("marketplace", "ozon")
    .gte("order_date", date_from)
    .lte("order_date", date_to)
)

# Query 2: account-level (order_date IS NULL, settlement date filter)
null_od_query = (
    supabase.table("mp_costs_details")
    .select("product_id, category, subcategory, amount, fulfillment_type")
    .eq("user_id", current_user.id)
    .eq("marketplace", "ozon")
    .is_("order_date", "null")
    .gte("date", date_from)
    .lte("date", date_to)
)
```

#### c) Profit calculation (Ozon PRIMARY path)
```python
if is_ozon and product_id in ozon_order_date_by_product:
    od_data = ozon_order_date_by_product[product_id]
    order_payout = od_data["payout"]
    order_revenue = od_data["revenue"]
    displayed_revenue = order_revenue if order_revenue > 0 else mp_sales_revenue
    mp_costs_consistent = max(0, displayed_revenue - order_payout)
    net_profit = order_payout - raw_purchase
    # Ad cost NOT subtracted — already inside order_payout as finance deduction
```

### 4. Per-product Storage: `backend/migrations/031_storage_costs.sql` ✅ Applied

```sql
CREATE TABLE IF NOT EXISTS mp_storage_costs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    marketplace VARCHAR(10) NOT NULL DEFAULT 'ozon',
    product_id UUID NOT NULL REFERENCES mp_products(id),
    date_from DATE NOT NULL,
    date_to DATE NOT NULL,
    storage_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
    quantity INTEGER DEFAULT 0,
    volume_liters NUMERIC(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, marketplace, product_id, date_from, date_to)
);
```

### 5. Storage sync: sync_service.py — sync_storage_ozon()

Ozon Placement Report API (добавлен 25.12.2025):
1. `POST /v1/report/placement/by-products/create` → получить code
2. `POST /v1/report/info` → поллинг статуса, получить download_url
3. Скачать XLSX, парсить openpyxl
4. XLSX: Col[1]=SKU, Col[2]=Barcode, Col[11]=Storage cost (RUB)
5. Агрегация по SKU → upsert в mp_storage_costs

### 6. OzonClient: `backend/app/services/ozon_client.py`

Два новых метода:
```python
async def create_placement_report(self, date_from: str, date_to: str) -> str
async def get_report_info(self, code: str) -> dict
```

### 7. Sync endpoint: `backend/app/api/v1/sync.py`

```python
@router.post("/sync/storage-ozon")
async def sync_storage_ozon(current_user, sub, days_back=28):
```

## Что НЕ менялось (guard rails)

| Компонент | Статус |
|-----------|--------|
| costs-tree RPC (`get_costs_tree`) | Без изменений — settlement date |
| Dashboard RPC (`get_dashboard_summary`) | Без изменений — order-based из mp_sales |
| WB UE расчёт | Без изменений — proportional payout |
| Frontend (React) | 0 изменений |
| mp_costs таблица (агрегат) | Без изменений |
| Формулы в CLAUDE.md | Без изменений |

## Результаты верификации

### Д3 К2, 21-26 февраля

| Метрика | До fix | После fix | ЛК Ozon |
|---------|--------|-----------|---------|
| Revenue | 4,134₽ (3 batch) | 745₽ (1 order) | 745₽ |
| Profit | -1,517₽ | ~2₽ | 6.32₽ |
| Gap | 1,523₽ | ~4₽ | — |

### Причина остаточного gap ~4₽

Storage allocation: mp_costs_details хранит ежедневные списания хранения с **равным распределением** между товарами (1/N). ЛК распределяет по объёму/весу (per-product).

Варианты:
1. **Equal distribution** (текущий, mp_costs_details) → gap ~4₽
2. **Per-product prorated** (mp_storage_costs monthly) → gap ~10₽ (хуже из-за месячной гранулярности)
3. **Daily per-product** (будущее) → gap ~0₽ (нужно хранить daily XLSX данные)

Выбран вариант 1 как наиболее точный на данный момент.

## Re-sync после деплоя

**КРИТИЧНО:** После деплоя на production нужен re-sync для заполнения order_date:

```bash
# На VPS (или через API)
curl -X POST "https://reviomp.ru/api/sync/trigger" \
  -H "Authorization: Bearer <token>" \
  -d '{"marketplace": "ozon", "sync_type": "costs"}'
```

Или через cron — sync_costs_ozon автоматически заполнит order_date при следующем запуске.

Без re-sync: order_date = settlement date (backfill из миграции 030) → UE будет как до fix.

## Зависимости

- `openpyxl>=3.1.0` добавлен в `backend/requirements.txt`
- Миграции 030, 031 должны быть применены в Supabase
- Ozon API ключ должен иметь доступ к `/v1/report/placement/*`

## Диаграмма data flow

```
Ozon API (/v3/finance/transaction/list)
    │
    ├── operation_date → mp_costs_details.date (settlement)
    ├── posting.order_date → mp_costs_details.order_date (order)
    └── posting.delivery_schema → mp_costs_details.fulfillment_type

UE endpoint (dashboard.py)
    │
    ├── Query 1: WHERE order_date IN [from..to]  ← per-order payout/revenue
    ├── Query 2: WHERE order_date IS NULL         ← storage, account-level
    │             AND date IN [from..to]
    │
    └── profit = order_payout - purchase
              (ad already inside payout)
              (storage from Query 2, equal distrib)
```

## Ключевые уроки

1. **Settlement ≠ Order date.** Ozon рассчитывает финансы с задержкой 1-5 дней. Фильтр по settlement date захватывает "чужие" заказы.

2. **Backfill ≠ Re-sync.** Миграция `SET order_date = date` — приближение. Реальные order_date появляются только после re-sync с API.

3. **Ad cost inside payout.** Ozon включает рекламу (Звёздные товары и т.д.) как finance-deduction внутри payout. Отдельное вычитание ad_cost = двойной учёт.

4. **"Бонусы продавца" не в ЛК.** Ozon начисляет бонусы в payout, но НЕ показывает в UE ЛК. Для совпадения — исключаем через `_UE_EXCLUDED_SUBCATEGORIES`.

5. **Storage гранулярность.** API Placement Report даёт ежедневные per-product данные, но их нужно хранить в daily разбивке для точного совпадения (TODO).
