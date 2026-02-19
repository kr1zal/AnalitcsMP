# Sync Pipeline — Документация

> Последнее обновление: 20.02.2026
> SyncService: `backend/app/services/sync_service.py` (~2650 строк)

---

## 1. Обзор pipeline

Система синхронизации загружает данные с маркетплейсов Wildberries и Ozon в Supabase (PostgreSQL). Архитектура: DB queue + cron каждые 30 минут (правило #9 — без Celery, 1 ядро VPS).

```
                           ┌──────────────────────────────┐
                           │       Cron (*/30 * * * *)     │
                           │    POST /sync/process-queue   │
                           │     X-Cron-Secret header      │
                           └──────────────┬───────────────┘
                                          │
                           ┌──────────────▼───────────────┐
                           │      mp_sync_queue (DB)       │
                           │  priority ASC, next_sync_at   │
                           │  status: pending → processing │
                           └──────────────┬───────────────┘
                                          │
                           ┌──────────────▼───────────────┐
                           │       SyncService(user_id)    │
                           │       sync_all(days_back=30)  │
                           └──────┬───────────────┬───────┘
                                  │               │
                 ┌────────────────▼─┐  ┌─────────▼────────────┐
                 │   WB APIs         │  │   Ozon APIs           │
                 │                   │  │                       │
                 │ Content API       │  │ Seller API            │
                 │ Statistics API    │  │  (httpx, Client-Id +  │
                 │ Analytics API     │  │   Api-Key)            │
                 │ Ads API           │  │ Performance API       │
                 │ (Authorization    │  │  (OAuth2 client_creds)│
                 │  token header)    │  │                       │
                 └────────┬─────────┘  └──────────┬────────────┘
                          │                       │
                          └───────────┬───────────┘
                                      │
                 ┌────────────────────▼────────────────────┐
                 │           Supabase (PostgreSQL)          │
                 │                                         │
                 │  mp_products     mp_sales     mp_stocks  │
                 │  mp_costs        mp_costs_details        │
                 │  mp_ad_costs     mp_orders               │
                 │  mp_stock_snapshots                      │
                 │  mp_sync_log     mp_sync_queue           │
                 └─────────────────────────────────────────┘
```

---

## 2. Архитектура sync

### 2.1 DB Queue (`mp_sync_queue`)

Одна строка на пользователя. Создается лениво при первом обращении.

| Поле | Тип | Описание |
|------|-----|----------|
| `user_id` | UUID | FK → auth.users, UNIQUE |
| `next_sync_at` | TIMESTAMPTZ | Следующий запланированный sync |
| `priority` | INTEGER | 0=Business, 1=Pro, 2=Free (меньше = выше приоритет) |
| `status` | TEXT | `pending` / `processing` / `completed` / `error` |
| `last_sync_at` | TIMESTAMPTZ | Время последней успешной синхронизации |
| `last_error` | TEXT | Сообщение последней ошибки |
| `manual_syncs_today` | INTEGER | Счетчик ручных синхронизаций за сегодня |
| `manual_syncs_date` | DATE | Дата счетчика (сброс в полночь MSK) |

Индексы: `(priority, next_sync_at)` для эффективной выборки очереди.

### 2.2 Лог синхронизации (`mp_sync_log`)

| Поле | Тип | Описание |
|------|-----|----------|
| `marketplace` | TEXT | `wb` / `ozon` / `all` |
| `sync_type` | TEXT | `products` / `sales` / `costs` / `stocks` / `ads` / `orders` / `all` |
| `status` | TEXT | `running` / `success` / `error` |
| `records_count` | INTEGER | Количество обработанных записей |
| `error_message` | TEXT | Сообщение ошибки (если есть) |
| `started_at` | TIMESTAMPTZ | Начало выполнения |
| `finished_at` | TIMESTAMPTZ | Завершение |
| `trigger` | TEXT | `auto` / `manual` / `admin` / `system` |
| `user_id` | UUID | FK → auth.users |

### 2.3 Триггеры запуска

#### Автоматический (cron)

```
POST /sync/process-queue
Header: X-Cron-Secret: <SYNC_CRON_SECRET>
```

Вызывается внешним cron каждые 30 минут. Обрабатывает всех пользователей, у которых `next_sync_at <= now()`:

1. Проверяет наличие токенов (`mp_user_tokens`)
2. Проверяет, что sync не запущен (`is_sync_running` — TTL 2 часа)
3. Загружает подписку для определения плана
4. Устанавливает `status = processing`
5. Выполняет `_run_full_sync(user_id, trigger="auto")`
6. Обновляет `next_sync_at` по расписанию плана

Порядок обработки: `priority ASC, next_sync_at ASC` — Business-пользователи обрабатываются первыми.

#### Ручной (пользователь)

```
POST /sync/manual
Authorization: Bearer <JWT>
```

Лимиты по тарифу (сброс в полночь MSK):
- Free: 0 sync/день (ручной sync недоступен)
- Pro: 1 sync/день
- Business: 2 sync/день

Проверки:
- Лимит дневных синхронизаций
- Нет запущенной синхронизации (`_is_sync_running`)
- Инкремент `manual_syncs_today` до выполнения

#### Отдельные типы (API)

```
POST /sync/products   — товары
POST /sync/sales      — продажи (days_back, marketplace, force)
POST /sync/stocks     — остатки (marketplace, force)
POST /sync/costs      — удержания (days_back, marketplace, force)
POST /sync/ads        — реклама (days_back, marketplace, force)
POST /sync/all        — полная синхронизация (days_back, run_in_background)
```

Каждый endpoint использует lock + cooldown guard:

| Тип | Cooldown (часов) | Lock TTL (часов) |
|-----|------------------|-------------------|
| sales | 20 | 2 |
| stocks | 2 | 2 |
| costs | 4 | 2 |
| ads | 4 | 2 |

Параметр `force=true` игнорирует cooldown (но не lock).

---

## 3. Расписание по тарифам

| Параметр | Free | Pro | Business |
|----------|------|-----|----------|
| **Цена** | 0 руб. | 990 руб. | 2990 руб. |
| **Auto sync** | Нет | Да | Да |
| **Интервал** | - | 6 ч | 2 ч |
| **Приоритет** | 2 (низкий) | 1 (средний) | 0 (высокий) |
| **Manual sync/день** | 0 | 1 | 2 |
| **Max SKU** | 3 | 20 | Unlimited |
| **Маркетплейсы** | WB | WB + Ozon | WB + Ozon |
| **Расписание UTC** | 05:00, 17:00 | 04:00, 10:00, 16:00, 22:00 | 03:00, 09:00, 15:00, 21:00 |
| **Расписание MSK** | 08:00, 20:00 | 07:00, 13:00, 19:00, 01:00 | 06:00, 12:00, 18:00, 00:00 |

Расчет `next_sync_at`:
- Определяется из `sync_schedule_utc` — ближайший будущий час из расписания
- Если все слоты сегодня прошли — первый слот завтра

Планы хранятся в коде (`backend/app/plans.py`), НЕ в БД (правило #8).

---

## 4. Полный цикл sync_all

Метод `sync_all(days_back=30)` выполняет все этапы последовательно:

```
┌─────────────────────────────────────────────────────────────┐
│  sync_all(days_back=30)                                     │
│                                                             │
│  1. sync_products()              — товары WB + Ozon         │
│  2. sync_orders_wb(date_from)    — позаказные данные WB      │
│  3. sync_orders_ozon(date_from)  — позаказные данные Ozon    │
│  4. sync_sales_wb(date_from)     — продажи WB               │
│  5. sync_sales_ozon(date_from)   — продажи Ozon             │
│  6. sync_stocks_wb()             — остатки WB (полный срез)  │
│  7. sync_stocks_ozon()           — остатки Ozon              │
│  8. sync_costs_wb(date_from)     — удержания WB              │
│  9. sync_costs_ozon(date_from)   — удержания Ozon            │
│  10. sync_ads_wb(date_from)      — реклама WB                │
│  11. sync_ads_ozon(date_from)    — реклама Ozon              │
│                                                             │
│  Return: { success_count, error_count, details: {...} }     │
└─────────────────────────────────────────────────────────────┘
```

Каждый этап выполняется в `try/except` — ошибка одного этапа НЕ блокирует остальные. Результат содержит статусы всех 11 этапов.

По умолчанию `days_back=30` — загружаются данные за последние 30 дней. Для sales в отдельном endpoint default `days_back=35`.

---

## 5. Sync Products

**Файл:** `sync_service.py` → `sync_products()`
**Таблица:** `mp_products`
**Триггер:** Первый этап `sync_all`, или отдельно `POST /sync/products`

### Процесс

1. Загружает текущие товары из БД (`_get_products_map()` — {barcode: product})
2. Определяет план пользователя и лимит SKU
3. Для каждого маркетплейса из allowed:

**WB Auto-Discovery:**
```
_fetch_all_wb_cards()
  → POST content-api.wildberries.ru/content/v2/get/cards/list
  → Cursor-based пагинация (limit=100, updatedAt+nmID)
  → Все карточки → extract sizes → barcodes
```
- Существующий barcode → UPDATE (wb_nm_id, wb_vendor_code)
- Новый barcode → INSERT (если лимит SKU не превышен)

**Ozon Auto-Discovery:**
```
_fetch_all_ozon_products()
  → POST api-seller.ozon.ru/v3/product/list
  → last_id пагинация (limit=100)
  → Все products → extract offer_id
```
- Существующий offer_id → UPDATE (ozon_product_id, ozon_offer_id)
- Новый offer_id → INSERT с placeholder именем `Ozon-{offer_id}`
- Затем batch-запрос `/v3/product/info/list` для получения реальных названий

4. **Ozon SKU маппинг** (критично для sales/costs):
   - Method 1: `get_product_info(product_ids)` → `sources[].sku` (prefer fbo) → `fbo_sku` → `top-level sku`
   - Method 2 (fallback): `get_all_stocks_on_warehouses()` → `item_code` → `sku`
   - Результат сохраняется в `mp_products.ozon_sku`

5. **Ozon cost_price**: Для товаров с `purchase_price=0` пробует получить `cost_price` из `/v5/product/info/prices`

6. Инвалидирует кеши (`_barcodes_cache`, `_ozon_sku_map_cache`)

### Системный товар WB_ACCOUNT

Для операций WB без привязки к товару (хранение на уровне аккаунта, прочие удержания) создается системный товар:
- `barcode = "WB_ACCOUNT"`
- `name = "WB: вне разреза товаров"`
- `purchase_price = 0`

---

## 6. Sync Sales

### 6.1 WB Sales

**Файл:** `sync_service.py` → `sync_sales_wb(date_from, date_to)`
**Источник:** WB reportDetailByPeriod (финотчет — источник истины для WB)
**Таблица:** `mp_sales` (upsert по `user_id, product_id, marketplace, date`)

```
WildberriesClient.get_report_detail(date_from, date_to, period="daily")
  → GET statistics-api.wildberries.ru/api/v5/supplier/reportDetailByPeriod
  → Пагинация через rrdid (до 204 No Content)
  → Safety limit: 1,500,000 строк
```

**Группировка**: по `(nm_id, rr_dt[:10], fulfillment_type)`

**FBS detection:** `_determine_wb_fulfillment(row)` определяет тип из строки финотчета:
- `isSupply=true` → FBS, `isSupply=false` → FBO
- Fallback: `delivery_type_id` (1=FBO, 2=FBS)
- Default: FBO

**Классификация строк:**
| doc_type_name | supplier_oper_name | Действие |
|---|---|---|
| `"Продажа"` | `"Продажа"` | `sales += qty, revenue += retail_amount` |
| `*Возврат*` или `*Сторно*` | - | `returns += abs(qty)` |

**Расчеты:**
- `orders_count = sales + returns`
- `buyout_percent = sales / orders_count * 100`

**Upsert:** по `user_id, product_id, marketplace, date, fulfillment_type`

**Дополнительно:** Воронка WB (cart_adds) через Analytics API (`/api/v2/nm-report/detail`). Результат обновляет `mp_sales.cart_adds`.

### 6.2 Ozon Sales

**Файл:** `sync_service.py` → `sync_sales_ozon(date_from, date_to)`
**Источник:** Ozon Analytics API
**Таблица:** `mp_sales` (upsert по `user_id, product_id, marketplace, date`)

```
OzonClient.get_analytics_data(date_from, date_to,
  dimensions=["sku", "day"],
  metrics=["ordered_units", "revenue", "returns", "session_view", "hits_tocart"]
)
  → POST api-seller.ozon.ru/v1/analytics/data
  → limit=1000, offset=0
```

**Маппинг SKU → product_id:** через `ozon_sku_map` (загружен из `mp_products.ozon_sku`)

**Метрики:**
| Индекс | Метрика | Поле |
|--------|---------|------|
| 0 | ordered_units | orders_count |
| 1 | revenue | revenue |
| 2 | returns | returns_count |
| 4 | hits_tocart | cart_adds |

- `sales_count = orders - returns`
- `buyout_percent = (orders - returns) / orders * 100`
- Дни без активности (orders=0, revenue=0, returns=0) пропускаются

---

## 7. Sync Stocks

### 7.1 WB Stocks

**Файл:** `sync_service.py` → `sync_stocks_wb()`
**Таблица:** `mp_stocks` (upsert по `user_id, product_id, marketplace, warehouse`)

```
WildberriesClient.get_stocks(datetime(2019, 6, 20))
  → GET statistics-api.wildberries.ru/api/v1/supplier/stocks
  → dateFrom=2019-06-20 — ПОЛНЫЙ снапшот (не инкремент!)
```

**ВАЖНО:** Параметр `dateFrom` в WB stocks API означает "изменения с даты". Для получения полного среза (как в ЛК) необходимо передавать максимально раннюю дату. При свежем `dateFrom` API вернет только изменения — нельзя удалять отсутствующие склады.

**Маппинг товара:** двухуровневый — сначала по barcode, затем по nmId.

**Агрегация:** Суммируем `quantity` по `(product_id, warehouse)`, т.к. WB может отдавать несколько строк на один товар (разные sizes/barcodes).

Если API вернул пустой список — пропускаем обновление БД (защита от случайного обнуления).

**Snapshot:** После успешного sync вызывается `_save_stock_snapshot("wb")`.

### 7.2 Ozon Stocks

**Файл:** `sync_service.py` → `sync_stocks_ozon()`
**Таблица:** `mp_stocks` (upsert по `user_id, product_id, marketplace, warehouse`)

4-шаговая стратегия (каждая пробуется если предыдущая вернула пустой результат):

```
Стратегия 1: product_id + visibility=ALL
  → POST api-seller.ozon.ru/v4/product/info/stocks

Стратегия 2: product_id (без visibility)
  → POST /v4/product/info/stocks

Стратегия 3: offer_id + visibility=ALL → offer_id без visibility → visibility=ALL
  → POST /v4/product/info/stocks (варианты)

Стратегия 4 (fallback): product_info → product_ids → /v4/product/info/stocks
  → Если offer_id не сработал, пробуем через product_id из /v3/product/info/list

Стратегия 5 (FBO fallback): Analytics API
  → POST api-seller.ozon.ru/v2/analytics/stock_on_warehouses
  → warehouse_type=ALL, пагинация через offset
  → free_to_sell_amount — "Активный сток" (как в ЛК)
```

**Формула quantity из /v4:**
```
quantity = max(present - reserved, 0)
```

**Пагинация /v4:** через `last_id` (Strategy A), fallback на `offset` (Strategy B) при HTTP 400.

**Snapshot:** После успешного sync вызывается `_save_stock_snapshot("ozon")`.

### 7.3 Stock Snapshots

**Файл:** `sync_service.py` → `_save_stock_snapshot(marketplace)`
**Таблица:** `mp_stock_snapshots` (upsert по `user_id, product_id, marketplace, date`)

Сохраняет ежедневный снимок суммарных остатков по товарам для графика динамики остатков (`StockHistoryChart`). Агрегирует `quantity` из `mp_stocks` по `product_id` (сумма через все склады).

Ошибка snapshot НЕ прерывает основной sync.

---

## 8. Sync Costs

### 8.1 WB Costs

**Файл:** `sync_service.py` → `sync_costs_wb(date_from, date_to)`
**Источник:** WB reportDetailByPeriod (тот же, что для sales)
**Таблицы:** `mp_costs` (агрегированные) + `mp_costs_details` (гранулярные, insert-only)

#### Классификация строк (`_classify_wb_report_row`)

Каждая строка финотчета WB разбирается на записи для дерева удержаний:

| Категория | Подкатегория | Поле отчета | Знак |
|-----------|-------------|-------------|------|
| Продажи | Продажа | `retail_amount` | + |
| Вознаграждение ВВ | Без НДС | `ppvz_vw` | - (как в отчете) |
| Вознаграждение ВВ | НДС с ВВ | `ppvz_vw_nds` | - (как в отчете) |
| Эквайринг | Эквайринг | `acquiring_fee` | - |
| Услуги по доставке | Доставка покупателю | `delivery_rub` | - |
| Возмещения | Выдача/возврат на ПВЗ | `ppvz_reward` | + |
| Возмещения | Перевозка/складские | `rebill_logistic_cost` | + |
| Стоимость хранения | Стоимость хранения | `storage_fee` | - |
| Общая сумма штрафов | bonus_type_name | `penalty` | - |
| Прочие удержания | Прочие удержания | `deduction` | - |
| Стоимость приемки | Приемка | `acceptance` | - |
| Лояльность | Компенсация скидки | `cashback_amount` | + |
| Лояльность | Участие в программе | `cashback_discount` | - |
| Корректировка ВВ | Корректировка ВВ | `cashback_commission_change` | +/- |
| Изменение сроков | Изменение сроков | `payment_schedule` | +/- |

#### FBS detection в costs

Каждая строка финотчета WB проходит через `_determine_wb_fulfillment(row)`:
- Ключи агрегации: `costs_agg[(pid, date, ft)]`, `details_agg[(pid, date, ft, cat, subcat)]`, `payout_by_key[(pid, date, ft)]`
- Delete перед insert: удаляет ALL fulfillment_type (не только FBO), т.к. ресинк полностью пересоздает данные

#### Балансировка (residual)

Для 100% совпадения с ЛК WB дерево балансируется до "К перечислению" (`ppvz_for_pay`):

```
diff = payout - SUM(details)
if abs(diff) >= 0.01:
    details["Прочие удержания/выплаты"] += diff
```

Балансировка per `(pid, date, ft)` — каждая комбинация товар+дата+фулфилмент балансируется отдельно.

#### Агрегация mp_costs

Параллельно с деталями формируются агрегированные суммы (только расходы, `abs()`):

| Поле mp_costs | Источник |
|---|---|
| commission | `abs(ppvz_vw) + abs(ppvz_vw_nds)` |
| logistics | `abs(delivery_rub)` |
| acquiring | `abs(acquiring_fee)` |
| storage | `abs(storage_fee)` |
| penalties | `abs(penalty)` |
| other_costs | `abs(deduction) + abs(acceptance)` |

#### Запись в БД

1. `mp_costs` — upsert по `user_id, product_id, marketplace, date, fulfillment_type`
2. `mp_costs_details` — **delete + insert** за период (не upsert, т.к. нет unique constraint на category/subcategory). Delete удаляет ALL fulfillment_type.

### 8.2 Ozon Costs

**Файл:** `sync_service.py` → `sync_costs_ozon(date_from, date_to)`
**Источник:** Ozon Finance Transaction List
**Таблицы:** `mp_costs` + `mp_costs_details`

```
OzonClient.get_finance_transaction_list(date_from, date_to, page=N)
  → POST api-seller.ozon.ru/v3/finance/transaction/list
  → page_size=1000, до 20 страниц
  → Ограничение API: макс. 30 дней за запрос
```

#### FBS detection в Ozon costs

Каждая операция содержит `posting.delivery_schema`:
```python
posting = op.get("posting", {}) or {}
delivery_schema = str(posting.get("delivery_schema") or "").upper()
ft = "FBS" if delivery_schema == "FBS" else "FBO"
```
Ключи агрегации включают `ft`: `costs_agg[(barcode, date, ft)]`, `details_agg[(pid, date, ft, cat, subcat)]`.
Delete перед insert удаляет ALL fulfillment_type.

#### Классификация операций (`_classify_ozon_operation`)

| operation_type | Категория | Подкатегория |
|---|---|---|
| `OperationAgentDeliveredToCustomer` | Продажи / Вознаграждение Ozon / Услуги доставки / Услуги агентов | Выручка / Комиссия / Логистика / LastMile |
| `OperationItemReturn` | Услуги доставки | Возвраты |
| `MarketplaceRedistributionOfAcquiringOperation` | Услуги агентов | Эквайринг |
| `StarsMembership` | Услуги агентов | Звездные товары |
| `OperationMarketplaceServicePremiumCashbackIndividualPoints` | Продвижение и реклама | Бонусы продавца |
| `OperationMarketplaceServiceStorage` | Услуги FBO | Размещение товаров |
| Прочее | Прочее | `operation_type_name` |

#### Распределение по товарам

- **Операции с items:** сумма распределяется пропорционально `quantity` каждого item (allocation="order")
- **Операции без items** (хранение и т.п.): равномерно между всеми Ozon-товарами пользователя. Используется точное распределение в копейках для избежания ошибок округления.

---

## 9. Sync Ads

### 9.1 WB Ads

**Файл:** `sync_service.py` → `sync_ads_wb(date_from, date_to)`
**Таблица:** `mp_ad_costs` (upsert по `user_id, product_id, marketplace, date, campaign_id`)

```
1. WildberriesClient.get_advert_campaigns()
   → GET advert-api.wildberries.ru/adv/v1/promotion/count
   → Extract campaign_ids из adverts[].advert_list[].advertId

2. WildberriesClient.get_advert_stats([campaign_id], date_from, date_to)
   → POST advert-api.wildberries.ru/adv/v2/fullstats
   → PO ОДНОЙ кампании (rate limit WB Ads API)
   → sleep(5) между запросами
```

**Метрики per nm_id per day:**
- `impressions = views`
- `clicks`
- `cost = sum` (расход в рублях)
- `orders_count = orders`
- `ctr = clicks / views * 100`
- `cpc = cost / clicks`
- `acos = cost / ordersSumRub * 100`

### 9.2 Ozon Ads

**Файл:** `sync_service.py` → `sync_ads_ozon(date_from, date_to)`
**Таблица:** `mp_ad_costs` (upsert по `user_id, product_id, marketplace, date, campaign_id`)

```
1. OzonPerformanceClient.get_campaigns()
   → GET api-performance.ozon.ru/api/client/campaign
   → Фильтр: advObjectType == "SKU" (исключая REF_VK/SEARCH_PROMO)

2. OzonPerformanceClient.get_campaign_stats([campaign_id], date_from, date_to)
   → Асинхронный workflow:
     a. POST /api/client/statistics → UUID отчета
     b. Polling GET /api/client/statistics/{UUID} (каждые 3 сек, макс. 90 сек)
     c. Когда state=OK: получаем link → download CSV
   → sleep(5) между кампаниями (ограничение: 1 активный отчет)
```

**CSV парсинг** (`_download_report_csv`):
- Разделитель: `;`
- BOM-safe (`\ufeff` strip)
- Пропуск строки "Всего"
- Дата: `DD.MM.YYYY` → `YYYY-MM-DD`
- Числа: `comma_decimal` → float

**Ozon Performance Auth:** OAuth2 client_credentials flow. Token кешируется в `self.access_token`.

---

## 10. Sync Orders (Order Monitor v2)

### 10.1 WB Orders

**Файл:** `sync_service.py` → `sync_orders_wb(date_from, date_to)`
**Таблица:** `mp_orders` (upsert по `user_id, marketplace, order_id`)

3-шаговое обогащение через `srid`:

```
Шаг 1: get_orders(date_from)
  → GET /api/v1/supplier/orders
  → Базовые данные: srid, barcode, price, region, warehouse
  → status: cancelled (если isCancel) | ordered

     sleep(1)

Шаг 2: get_sales(date_from)
  → GET /api/v1/supplier/sales
  → Обогащение: saleID (S=sold, R=returned), forPay, priceWithDisc
  → Продажа без парного заказа → создаем запись

     sleep(1)

Шаг 3: get_report_detail(date_from, date_to)
  → GET /api/v5/supplier/reportDetailByPeriod
  → НАКОПЛЕНИЕ финансов (несколько строк на srid):
    commission += abs(ppvz_vw + ppvz_vw_nds)
    logistics += abs(delivery_rub)
    storage_fee += abs(storage_fee)
    other_fees += abs(penalty + deduction + acceptance)
    payout += ppvz_for_pay
  → sale_price = retail_price_withdisc_rub (цена после СПП)
  → fulfillment_type = _determine_wb_fulfillment(row)
  → settled = true
```

Batch upsert: пачками по 500 записей.

### 10.2 Ozon Orders

**Файл:** `sync_service.py` → `sync_orders_ozon(date_from, date_to)`
**Таблица:** `mp_orders` (upsert по `user_id, marketplace, order_id`)

```
1. FBS: get_posting_fbs_list() — POST /v3/posting/fbs/list
2. FBO: get_posting_fbo_list() — POST /v2/posting/fbo/list
   → Пагинация offset (limit=100)
   → with: analytics_data + financial_data
```

**Статусы Ozon → наши:**
| Ozon | Наш |
|------|-----|
| delivered | sold |
| cancelled / not_accepted | cancelled |
| awaiting_packaging / awaiting_deliver / acceptance_in_progress / awaiting_registration | ordered |
| delivering | delivering |
| arbitration / client_arbitration | returned |

**Финансы:** Два формата:
- FBO: `financial_data.products[]` (per-product commission/payout)
- FBS: `financial_data.commission_amount` / `financial_data.payout` (top-level, делим на `product_count`)

Для мульти-товарных заказов: `order_id = "{posting_number}_{sku}"`.

---

## 11. API клиенты

### 11.1 WildberriesClient

**Файл:** `backend/app/services/wb_client.py`
**Транспорт:** httpx.AsyncClient (timeout=30s)
**Авторизация:** `Authorization: <api_token>` header

| Base URL | Назначение |
|----------|-----------|
| `https://content-api.wildberries.ru` | Карточки товаров |
| `https://statistics-api.wildberries.ru` | Продажи, заказы, остатки, финотчет |
| `https://seller-analytics-api.wildberries.ru` | Воронка, география |
| `https://advert-api.wildberries.ru` | Рекламные кампании |

**Ключевые методы:**
- `get_cards_list(cursor)` — POST, cursor-based пагинация
- `get_report_detail(date_from, date_to, period)` — GET, rrdid-пагинация, обрабатывает 204
- `get_stocks(date_from)` — GET, dateFrom=2019-06-20 для полного среза
- `get_sales(date_from, flag)` — GET, flag=0 (за день) / flag=1 (обновления)
- `get_orders(date_from, flag)` — GET
- `get_funnel(date_from, date_to, nm_ids)` — POST, воронка продаж
- `get_advert_campaigns()` — GET, список кампаний
- `get_advert_stats(campaign_ids, date_from, date_to)` — POST, статистика per campaign

### 11.2 OzonClient

**Файл:** `backend/app/services/ozon_client.py`
**Транспорт:** httpx.AsyncClient (timeout=30s)
**Base URL:** `https://api-seller.ozon.ru`
**Авторизация:** `Client-Id` + `Api-Key` headers

**Ключевые методы:**
- `get_product_list(limit, last_id)` — POST `/v3/product/list`
- `get_product_info(product_ids, offer_ids)` — POST `/v3/product/info/list`
- `get_product_prices(offer_ids)` — POST `/v5/product/info/prices`
- `get_all_stocks(filter)` — POST `/v4/product/info/stocks` (last_id + offset fallback)
- `get_all_stocks_on_warehouses(warehouse_type)` — POST `/v2/analytics/stock_on_warehouses`
- `get_analytics_data(date_from, date_to, dimensions, metrics)` — POST `/v1/analytics/data`
- `get_finance_transaction_list(date_from, date_to, page)` — POST `/v3/finance/transaction/list`
- `get_posting_fbs_list(date_from, date_to)` — POST `/v3/posting/fbs/list`
- `get_posting_fbo_list(date_from, date_to)` — POST `/v2/posting/fbo/list`

### 11.3 OzonPerformanceClient

**Файл:** `backend/app/services/ozon_client.py` (нижняя часть)
**Транспорт:** httpx.AsyncClient (timeout=30s)
**Auth URL:** `https://api-performance.ozon.ru/api/client/token`
**Base URL:** `https://api-performance.ozon.ru`
**Авторизация:** OAuth2 client_credentials → `Bearer {access_token}`

**Ключевые методы:**
- `get_campaigns()` — GET `/api/client/campaign`
- `get_campaign_stats(campaign_ids, date_from, date_to)`:
  1. POST `/api/client/statistics` → UUID
  2. Polling GET `/api/client/statistics/{UUID}` (3s, max 30 attempts)
  3. При `state=OK` → download CSV по `link`
- `_download_report_csv(link)` — скачивает и парсит CSV-отчет (`;` delimiter)

---

## 12. Токены пользователей

**Файл:** `backend/app/crypto.py`
**Таблица:** `mp_user_tokens`

### Хранение

Все API-токены маркетплейсов хранятся в `mp_user_tokens` в зашифрованном виде:

| Поле | Описание |
|------|----------|
| `wb_api_token` | WB API token (Fernet encrypted) |
| `ozon_client_id` | Ozon Seller Client-Id (Fernet encrypted) |
| `ozon_api_key` | Ozon Seller Api-Key (Fernet encrypted) |
| `ozon_perf_client_id` | Ozon Performance Client-Id (Fernet encrypted) |
| `ozon_perf_secret` | Ozon Performance Client Secret (Fernet encrypted) |

### Шифрование

**Алгоритм:** Fernet (симметричное, AES-128-CBC + HMAC-SHA256)
**Ключ:** `FERNET_KEY` из `.env`

```python
from cryptography.fernet import Fernet

encrypt_token(plaintext: str) -> str   # пустая строка → пустая строка
decrypt_token(ciphertext: str) -> str  # пустая строка → пустая строка
```

Правило #7: Fernet на backend (НЕ pgcrypto/Vault).

### Загрузка токенов

При создании `SyncService(user_id)`:

1. Запрос `mp_user_tokens WHERE user_id = {user_id}`
2. Дешифровка каждого токена через `decrypt_token()`
3. **Fallback:** если токен пустой/ошибка — используется значение из `.env` (legacy/demo)

```python
wb_tok = decrypt_token(row["wb_api_token"]) or settings.wb_api_token
```

---

## 13. Error handling

### Уровни обработки ошибок

**Уровень 1: SyncService (per-method)**
- Каждый `sync_*` метод обернут в `try/except`
- При ошибке записывается лог: `_log_sync(marketplace, sync_type, "error", 0, error_msg, started_at)`
- Возвращает `{"status": "error", "message": error_msg}`
- Ошибка одного метода НЕ прерывает `sync_all`

**Уровень 2: API Router (sync.py)**
- Lock guard: `_check_sync_guard()` — проверяет running lock (TTL 2ч) и cooldown
- Lock создается до sync: `_create_sync_lock()` → `mp_sync_log.status = "running"`
- Lock закрывается после: `_finish_sync_lock(status, records, error)`
- HTTP 500 при неожиданных ошибках

**Уровень 3: Queue Processor (sync_queue.py)**
- Проверка токенов (`_has_tokens`)
- Проверка running lock (`_is_sync_running`)
- Статус очереди обновляется: `processing` → `completed/error`
- `next_sync_at` обновляется даже при ошибке (предотвращает зацикливание)

### Лог в БД

Все операции sync записываются в `mp_sync_log`:
- `status = "running"` — sync в процессе
- `status = "success"` — успешное завершение
- `status = "error"` — ошибка с `error_message`

### Rate limiting

| API | Стратегия |
|-----|-----------|
| WB Ads | `asyncio.sleep(5)` между кампаниями |
| WB Orders | `asyncio.sleep(1)` между шагами (orders → sales → report) |
| Ozon Performance | `asyncio.sleep(5)` между кампаниями; polling 3s × 30 attempts |
| Ozon Finance | Макс. 20 страниц (safety limit) |

---

## 14. Таблицы БД (схема)

### Основные таблицы данных

| Таблица | Описание | Unique constraint |
|---------|----------|-------------------|
| `mp_products` | Мастер-данные товаров | `barcode` (+ `user_id` через RLS) |
| `mp_sales` | Продажи по дням | `user_id, product_id, marketplace, date, fulfillment_type` |
| `mp_stocks` | Остатки по складам | `user_id, product_id, marketplace, warehouse, fulfillment_type` |
| `mp_costs` | Удержания МП (агрегированные) | `user_id, product_id, marketplace, date, fulfillment_type` |
| `mp_costs_details` | Удержания МП (гранулярные) | Нет unique (insert-only, delete+insert). Колонка `fulfillment_type` |
| `mp_ad_costs` | Рекламные расходы | `user_id, product_id, marketplace, date, campaign_id` |
| `mp_orders` | Позаказные данные | `user_id, marketplace, order_id`. Колонка `fulfillment_type` |
| `mp_stock_snapshots` | Снимки остатков по дням | `user_id, product_id, marketplace, date, fulfillment_type` |

### Служебные таблицы

| Таблица | Описание |
|---------|----------|
| `mp_sync_queue` | Очередь синхронизации (1 строка per user) |
| `mp_sync_log` | Лог всех операций sync |
| `mp_user_tokens` | Зашифрованные API-токены |
| `mp_user_subscriptions` | Подписки пользователей |

### `mp_costs` — computed column

```sql
total_costs = commission + logistics + storage + promotion +
              penalties + acquiring + other_costs  -- GENERATED ALWAYS AS ... STORED
```

---

## 14.1 FBS Detection (миграция 018, 20.02.2026)

Колонка `fulfillment_type VARCHAR(10) DEFAULT 'FBO'` добавлена в 6 таблиц: mp_sales, mp_costs, mp_costs_details, mp_orders, mp_stocks, mp_stock_snapshots. Unique constraints обновлены.

### Что определяет FBS

| Sync функция | Источник FBS | Метод |
|---|---|---|
| `sync_sales_wb` | `isSupply` / `delivery_type_id` из reportDetail | `_determine_wb_fulfillment()` |
| `sync_costs_wb` | то же (reportDetail) | `_determine_wb_fulfillment()` |
| `sync_orders_wb` | то же (шаг 3, reportDetail) | `_determine_wb_fulfillment()` |
| `sync_costs_ozon` | `posting.delivery_schema` из finance transactions | inline check |
| `sync_stocks_ozon` | `stocks[].type` (fbo/fbs) — уже было | existing logic |
| `sync_orders_ozon` | отдельные endpoints FBS/FBO — уже было | existing logic |

### Что НЕ определяет FBS (остается FBO default)

| Sync функция | Причина |
|---|---|
| `sync_sales_ozon` | Ozon Analytics API (`/v1/analytics/data`) не предоставляет FBO/FBS breakdown |
| `sync_stocks_wb` | WB Stocks API не имеет надежного поля для FBS |

### `_determine_wb_fulfillment(row)` — приоритет полей

```python
1. isSupply = True  → FBS (продавец отгружает сам)
2. isSupply = False → FBO (склад WB)
3. delivery_type_id = 2 → FBS
4. delivery_type_id = 1 → FBO
5. default → FBO
```

### RPC функции

Все RPC (costs-tree, upsert_mp_sales и т.д.) обновлены в миграции 018 с параметром `p_fulfillment_type`:
- `rpc_costs_tree(p_user_id, p_date_from, p_date_to, p_marketplace)` — агрегирует данные ВСЕХ fulfillment_type (без фильтра)
- `upsert_mp_sales(...)` — принимает `p_fulfillment_type`, используется в unique key

---

## 15. Troubleshooting

### Sync не запускается (cron)

1. **Проверить cron:** `crontab -l` на VPS. Должен быть `*/30 * * * * curl -X POST ... -H "X-Cron-Secret: ..."`.
2. **Проверить секрет:** `X-Cron-Secret` header должен совпадать с `SYNC_CRON_SECRET` в `.env`.
3. **Проверить очередь:** `SELECT * FROM mp_sync_queue WHERE next_sync_at <= now()`. Если пусто — нет пользователей, готовых к sync.
4. **Проверить токены:** `SELECT user_id FROM mp_user_tokens`. Если пусто — пользователь не сохранил токены.

### Sync зависает (running > 2 часов)

Lock автоматически игнорируется через 2 часа. Для ручного сброса:
```sql
UPDATE mp_sync_log SET status = 'error', error_message = 'manual_reset'
WHERE status = 'running' AND started_at < now() - interval '2 hours';
```

### Нет данных после sync

1. **Проверить логи:** `SELECT * FROM mp_sync_log WHERE user_id = '...' ORDER BY finished_at DESC LIMIT 10`.
2. **Проверить токены:** Декриптуется ли токен? Fallback на .env работает?
3. **Проверить cooldown:** Для sales cooldown 20ч. Используйте `force=true` или подождите.
4. **Проверить маппинг SKU:** `SELECT barcode, ozon_sku FROM mp_products WHERE user_id = '...'`. Если `ozon_sku` пустой — Ozon sales не смаппятся.

### Дубли в данных

- `mp_sales`, `mp_costs`, `mp_stocks`, `mp_ad_costs` — upsert по unique constraint. Дублей быть не должно.
- `mp_costs_details` — insert-only после delete за период. Если delete не отработал — возможны дубли.
  ```sql
  DELETE FROM mp_costs_details
  WHERE user_id = '...' AND marketplace = 'wb'
  AND date BETWEEN '2026-01-01' AND '2026-02-01';
  ```

### Stock snapshots пустые

1. Проверить таблицу: `SELECT COUNT(*) FROM mp_stock_snapshots WHERE user_id = '...'`.
2. Snapshots создаются только после успешного `sync_stocks_wb/ozon`.
3. Для исторической реконструкции: `python backend/scripts/reconstruct_stock_history.py`.

### Ozon stocks возвращают 0 записей

Ozon stocks API капризен. Логи sync_service содержат информацию о попытках:
```
Ozon stocks: items=0. Tried filters: [('v4/product/info/stocks', {...}), ...]
```

Проверить:
- Есть ли у товаров `ozon_product_id` (нужен для стратегии 1)
- Работает ли FBO fallback через `/v2/analytics/stock_on_warehouses`

### WB finreport расхождение

Для сверки: `python wb/reconcile_wb.py` (CSV из ЛК vs API). Допустимая погрешность: 0.03 руб.

---

## 16. Файловая карта

```
backend/
  app/
    services/
      sync_service.py          — SyncService (2573 строк, основная логика)
      wb_client.py             — WildberriesClient (4 API base URLs)
      ozon_client.py           — OzonClient + OzonPerformanceClient
    api/v1/
      sync.py                  — REST endpoints: /sync/{type}, /sync/all, /sync/logs
      sync_queue.py            — Queue endpoints: /sync/process-queue, /sync/manual, /sync/status
    plans.py                   — PLANS dict, get_plan(), get_next_sync_utc()
    crypto.py                  — Fernet encrypt/decrypt
    config.py                  — Settings (.env)
    auth.py                    — JWT auth, get_current_user_or_cron
    subscription.py            — UserSubscription, get_subscription_or_cron
  migrations/
    001_initial.sql            — mp_products, mp_sales, mp_stocks, mp_costs, mp_ad_costs
    004_add_user_id.sql        — Multi-tenant: user_id column
    005_rls_policies.sql       — Row Level Security
    007_user_tokens.sql        — mp_user_tokens
    010_sync_queue.sql         — mp_sync_queue + trigger column
    011_orders.sql             — mp_orders
    017_stock_snapshots.sql    — mp_stock_snapshots
    018_fbs_fulfillment_type.sql — fulfillment_type column + unique constraints update
  scripts/
    reconstruct_stock_history.py — One-time historical reconstruction
```
