# Ozon UE — полное совпадение с ЛК (order_date + storage + delivery_date)

> Дата работы: 2026-02-28
> Статус: **PHASE 2 DONE** — Phase 1 (order_date + storage) ✅, Phase 2 (delivery_date filter) ✅

## История проблемы

Сверка UE с ЛК Ozon (Д3 К2, 21-26 фев):

| Этап | Наш profit | ЛК profit | Gap | Причина |
|------|-----------|-----------|-----|---------|
| Исходный | -1,517₽ | +6.32₽ | 1,523₽ | settlement date вместо order_date |
| + order_date fix | ~2₽ | +6.32₽ | ~4₽ | storage equal distribution (1/N) |
| + daily storage | +2.36₽ | +6.32₽ | 3.96₽ | "Бонусы продавца" в payout |
| + exclude бонусы | **+6.32₽** | +6.32₽ | **0₽** | **SOLVED** |

## Что решено (deployed 28.02.2026)

### 1. order_date в mp_costs_details (миграция 030) ✅

**Причина:** `mp_costs_details.date` = settlement date, а не дата заказа. В один settlement-период попадают расчёты по заказам из РАЗНЫХ периодов.

**Решение:** Ozon Finance API (`/v3/finance/transaction/list`) содержит `posting.order_date`. Синхронизируем в `mp_costs_details.order_date`. UE endpoint фильтрует по order_date.

### 2. Daily per-product storage (миграция 032) ✅

**Причина:** Finance API отдаёт storage как account-level операцию (`OperationMarketplaceServiceStorage`) без привязки к товару. Наш sync распределял поровну (1/N товаров). ЛК распределяет per-product по объёму/весу.

**Решение:** Ozon Placement Report API отдаёт XLSX с daily per-product storage. Новая таблица `mp_storage_costs_daily` (date, product_id, storage_cost). В UE: skip equal-distribution из Query 2, apply per-product daily storage.

**Верификация (21-26 фев):**
| Товар | Наш storage | ЛК storage | Diff |
|-------|-------------|------------|------|
| Д3К2 | 199.20₽ | 199.20₽ | **0.00₽** |
| Тестостерон | 524.32₽ | 524.32₽ | **0.00₽** |
| Л-Карнитин | 294.00₽ | 294.00₽ | **0.00₽** |

### 3. Исключение "Бонусы продавца" ✅

**Причина:** Ozon начисляет "Бонусы продавца" (~3.96₽ для Д3К2) как finance-deduction в payout, но НЕ показывает в UE ЛК.

**Решение:** `_UE_EXCLUDED_SUBCATEGORIES = {"Бонусы продавца"}` в `_accumulate_od_row()`.

### 4. Cron-доступ к UE endpoint ✅

UE endpoint (`/dashboard/unit-economics`) переведён на `get_current_user_or_cron` + `get_subscription_or_cron`. Можно вызывать через `X-Cron-Secret` + `X-Cron-User-Id`.

## Оставшийся gap: COGS ordered vs delivered

### Проблема

ЛК Ozon считает `COGS = purchase_price × delivered_count`, мы считаем `COGS = purchase_price × sales_count` (заказано из Analytics API).

### Сверка 01-26 фев (CSV из ЛК vs API)

| Товар | Заказано | Доставлено | Revenue diff | COGS diff | Profit (ЛК) | Profit (наш) |
|-------|----------|------------|-------------|-----------|-------------|-------------|
| Д3К2 | 11 | 10 | 0₽ | 280₽ | 621.38₽ | 341.38₽ |
| Тестостерон | 6 | 3 | 1,726₽ | 1,212₽ | -785.70₽ | -969.58₽ |
| Л-Карнитин | 36 | 36 | 0₽ | 0₽ | **-6,233.74₽** | **-6,233.74₽** |

**Выводы:**
1. Когда ordered = delivered (Л-Карнитин 36=36) → **полное совпадение**
2. Когда 1 заказ в пути (Д3К2 11→10) → gap = 1 × purchase_price (280₽), revenue совпадает
3. Когда много в пути (Тестостерон 6→3) → gap в revenue И COGS (finance API включает settlement для отгруженных, ЛК только для доставленных)

### Корневые причины расхождения

| # | Причина | Масштаб | Временный? |
|---|---------|---------|------------|
| 1 | COGS × ordered вместо delivered | pp × (ordered - delivered) | Да, самоустраняется при доставке |
| 2 | Revenue за отгруженные-но-не-доставленные | Значительный при большом % в пути | Да, самоустраняется |
| 3 | Deductions за отгруженные-но-не-доставленные | Пропорционально revenue gap | Да, самоустраняется |

**Все 3 причины — временные.** После завершения доставки всех заказов данные совпадут.

### Phase 2: delivery_date filter (Вариант Б) ✅ — DEPLOYED 28.02.2026

**Решение:** CSV Postings Report (`/v1/report/postings/create`, doc 12.md) содержит "Дата доставки".
Синхронизируем в `mp_orders.delivery_date` → UE фильтрует finance data только по доставленным заказам.

**Варианты (исследованы):**

| Вариант | Описание | Вердикт |
|---------|----------|---------|
| А (delivered_count) | delivered_units для COGS | **Отклонён** — axis mismatch (payout=shipped, COGS=delivered) |
| Б (CSV delivery_date) | Фильтровать finance по delivery_date из CSV | **ВЫБРАН** — обе оси на delivered |
| В+ (accept + UX) | Оставить как есть + индикатор | Запасной |

**Реализация:**
1. **Миграция 033**: `delivery_date TIMESTAMPTZ` в mp_orders + partial index + `last_delivery_sync_at` в mp_sync_queue
2. **sync_delivery_dates_ozon()**: FBO+FBS отчёты → poll → CSV parse (delimiter=`;`, UTF-8-sig) → UPDATE mp_orders
3. **UE endpoint**: delivery_date PRIMARY → order_date FALLBACK. COGS = purchase_price × delivered_count
4. **Cron**: 24h throttle, 60 дней lookback, non-fatal wrapper

**Fallback chain:** delivery_date (exact ЛК match) → order_date (approximate) → payout_rate (costs-tree)

**Верификация (ожидаемая после первого sync):**
- Д3К2 (01-26 фев): profit = 621.38₽ (ЛК)
- Тестостерон: profit = -785.70₽ (ЛК)
- Л-Карнитин 36=36: profit = -6,233.74₽ (уже совпадает)

**CSV-столбцы Postings Report (ключевые):**
- "Номер отправления" — JOIN с mp_costs_details
- "Дата доставки" — формат "2026-02-24 12:51:08"
- "Статус" — фильтр "Доставлен"
- "SKU" — маппинг на product
- "Количество" — для COGS

## Файлы и миграции

### Миграции (все applied в Supabase)

| # | Файл | Назначение |
|---|------|-----------|
| 030 | `030_order_date.sql` | `order_date DATE` в `mp_costs_details` + index |
| 031 | `031_storage_costs.sql` | Таблица `mp_storage_costs` (legacy, period-based) |
| 032 | `032_storage_costs_daily.sql` | Таблица `mp_storage_costs_daily` (daily per-product) + `last_storage_sync_at` |
| 033 | `033_delivery_date.sql` | `delivery_date TIMESTAMPTZ` в mp_orders + index + `last_delivery_sync_at` |

### Изменённые файлы (deployed 28.02.2026)

| Файл | Изменение |
|------|-----------|
| `backend/app/services/sync_service.py` | `sync_storage_ozon()` → daily XLSX parsing + `_build_legacy_storage_rows()` |
| `backend/app/api/v1/dashboard.py` | UE: Query 2a (daily storage) + skip equal dist + exclude бонусы + cron access |
| `backend/app/api/v1/sync_queue.py` | Storage в auto queue с 24h throttle (`last_storage_sync_at`) |
| `backend/app/services/ozon_client.py` | `create_placement_report()`, `get_report_info()` (ранее) |
| `backend/app/api/v1/sync.py` | `/sync/storage-ozon` endpoint (ранее) |
| `backend/app/services/ozon_client.py` | `create_postings_report()` — CSV Postings Report |
| `backend/app/services/sync_service.py` | `sync_delivery_dates_ozon()` — ~190 строк |
| `backend/app/api/v1/dashboard.py` | UE: delivery_date PRIMARY → order_date FALLBACK |
| `backend/app/api/v1/sync_queue.py` | Delivery dates auto sync с 24h throttle |
| `backend/migrations/033_delivery_date.sql` | Миграция: delivery_date + index + throttle |

## Архитектура UE (текущая)

### Data flow

```
Ozon Finance API (/v3/finance/transaction/list)
    │
    ├── operation_date → mp_costs_details.date (settlement)
    ├── posting.order_date → mp_costs_details.order_date (order)
    └── posting.delivery_schema → mp_costs_details.fulfillment_type

Ozon Placement Report API (/v1/report/placement/by-products/create)
    │
    └── XLSX (daily per SKU per warehouse) → mp_storage_costs_daily

Ozon Postings Report API (/v1/report/postings/create, doc 12.md)
    │
    └── CSV (posting_number, delivery_date, status, SKU) → mp_orders.delivery_date

UE endpoint (dashboard.py)
    │
    ├── Step A: mp_orders WHERE delivery_date IN [from..to]
    │   └── delivered postings → their order_dates + delivered_count
    │
    ├── Query 1: mp_costs_details WHERE (product_id, order_date) IN delivered
    │   └── _accumulate_od_row() (skip "Бонусы продавца")
    │   └── Fallback: WHERE order_date IN [from..to] (if no delivery_date data)
    │
    ├── Query 2a: mp_storage_costs_daily         ← per-product daily storage
    │   └── Fallback: mp_storage_costs (legacy)  ← period-based prorated
    │
    ├── Query 2: WHERE order_date IS NULL         ← account-level ops
    │   └── Skip "Размещение товаров" if has_per_product_storage
    │
    └── profit = order_payout - per_product_storage - COGS
              COGS = purchase_price × delivered_count (or sales_count fallback)
              (ads already inside order_payout)
              (бонусы excluded)
```

### 3-уровневый fallback для storage

1. **`mp_storage_costs_daily`** (primary) — SUM per product per day, без proration
2. **`mp_storage_costs`** (legacy fallback) — period-based с proration
3. **`mp_costs_details` equal distribution** (last resort) — 1/N товаров

### UE profit формула (Ozon)

```
# PRIMARY (delivery_date mode — matches ЛК exactly):
delivered_postings = mp_orders WHERE delivery_date IN period
per_order_payout = SUM(mp_costs_details.amount
    WHERE (product_id, order_date) IN delivered_postings
    AND subcategory NOT IN {"Бонусы продавца"})
COGS = purchase_price × delivered_count (from mp_orders)

# FALLBACK (order_date mode — if delivery_date not synced):
per_order_payout = SUM(mp_costs_details.amount
    WHERE order_date IN period
    AND subcategory NOT IN {"Бонусы продавца"})
COGS = purchase_price × sales_count (from mp_sales)

# Common:
daily_storage = SUM(mp_storage_costs_daily.storage_cost
    WHERE date IN period AND product_id = pid)
profit = per_order_payout - daily_storage - COGS
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

## Ключевые уроки

1. **Settlement ≠ Order date.** Ozon рассчитывает финансы с задержкой 1-5 дней. Фильтр по settlement date захватывает "чужие" заказы.

2. **Backfill ≠ Re-sync.** Миграция `SET order_date = date` — приближение. Реальные order_date появляются только после re-sync с API.

3. **Ad cost inside payout.** Ozon включает рекламу (Звёздные товары и т.д.) как finance-deduction внутри payout. Отдельное вычитание ad_cost = двойной учёт.

4. **"Бонусы продавца" не в ЛК.** Ozon начисляет бонусы в payout, но НЕ показывает в UE ЛК. Для совпадения — исключаем через `_UE_EXCLUDED_SUBCATEGORIES`.

5. **Storage: daily > monthly > equal.** API Placement Report даёт ежедневные per-product данные. Monthly proration хуже чем equal distribution. Daily — точное совпадение.

6. **COGS: delivered ≠ ordered.** ЛК использует delivered_count, Analytics API отдаёт ordered_units. Для закрытых периодов (>7 дней) разница стремится к нулю.

7. **Ozon settles at shipment, not delivery.** Finance API содержит операции для отгруженных (но не доставленных) заказов. ЛК считает только доставленные. Это создаёт временный gap для "горячих" периодов.

## Все 13 категорий Ozon costs (reference)

```
Продажи / Выручка                        (+) revenue
Вознаграждение Ozon / {product_name}     (-) commission
Услуги агентов / Эквайринг               (-) acquiring
Услуги агентов / Доставка до места выдачи (-) last mile
Услуги агентов / Звёздные товары         (-) promo (inside payout)
Услуги доставки / Логистика              (-) logistics
Услуги доставки / Возвраты               (-) return logistics
Услуги FBO / Размещение товаров          (-) storage (account-level, order_date=NULL)
Продвижение и реклама / Бонусы продавца  (-) seller bonus (EXCLUDED from UE)
Вознаграждение Ozon / Прочее             (-) other commission
Вознаграждение Ozon / Витамины           (-) category commission
```
