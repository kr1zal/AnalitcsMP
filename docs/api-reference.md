# API Reference — Analytics Dashboard

> **Base URL:** `https://reviomp.ru/api/v1`
> **Версия:** 1.0.0
> **Стек:** FastAPI + Supabase (PostgreSQL + RLS)

---

## Оглавление

1. [Аутентификация](#аутентификация)
2. [Feature Gates](#feature-gates)
3. [Health](#health)
4. [Dashboard](#dashboard)
   - [GET /dashboard/summary](#get-dashboardsummary)
   - [GET /dashboard/unit-economics](#get-dashboardunit-economics)
   - [GET /dashboard/sales-chart](#get-dashboardsales-chart)
   - [GET /dashboard/ad-costs](#get-dashboardad-costs)
   - [GET /dashboard/ad-campaigns](#get-dashboardad-campaigns)
   - [GET /dashboard/costs-tree](#get-dashboardcosts-tree)
   - [GET /dashboard/costs-tree-combined](#get-dashboardcosts-tree-combined)
   - [GET /dashboard/stocks](#get-dashboardstocks)
   - [GET /dashboard/stock-history](#get-dashboardstock-history)
   - [GET /dashboard/order-funnel](#get-dashboardorder-funnel)
   - [GET /dashboard/orders](#get-dashboardorders)
   - [GET /dashboard/orders/{order_id}](#get-dashboardordersorder_id)
5. [Sync](#sync)
   - [POST /sync/products](#post-syncproducts)
   - [POST /sync/sales](#post-syncsales)
   - [POST /sync/stocks](#post-syncstocks)
   - [POST /sync/costs](#post-synccosts)
   - [POST /sync/ads](#post-syncads)
   - [POST /sync/all](#post-syncall)
   - [GET /sync/logs](#get-synclogs)
   - [GET /sync/stocks/check](#get-syncstockscheck)
   - [POST /sync/process-queue](#post-syncprocess-queue)
   - [POST /sync/manual](#post-syncmanual)
   - [GET /sync/status](#get-syncstatus)
6. [Products](#products)
   - [GET /products](#get-products)
   - [GET /products/{product_id}](#get-productsproduct_id)
   - [GET /products/barcode/{barcode}](#get-productsbarcodebarcode)
   - [PUT /products/{product_id}/purchase-price](#put-productsproduct_idpurchase-price)
   - [PUT /products/reorder](#put-productsreorder)
   - [POST /products/link](#post-productslink)
   - [POST /products/unlink/{group_id}](#post-productsunlinkgroup_id)
7. [Sales Plan](#sales-plan)
   - [GET /sales-plan](#get-sales-plan)
   - [PUT /sales-plan](#put-sales-plan)
   - [DELETE /sales-plan/reset](#delete-sales-planreset)
   - [GET /sales-plan/summary](#get-sales-plansummary)
   - [PUT /sales-plan/summary](#put-sales-plansummary)
   - [GET /sales-plan/completion](#get-sales-plancompletion)
   - [GET /sales-plan/previous](#get-sales-planprevious)
8. [Export](#export)
   - [GET /export/pdf](#get-exportpdf)
9. [Tokens](#tokens)
   - [GET /tokens](#get-tokens)
   - [PUT /tokens](#put-tokens)
   - [POST /tokens/validate](#post-tokensvalidate)
   - [POST /tokens/save-and-sync](#post-tokenssave-and-sync)
10. [Subscription](#subscription)
    - [GET /subscription](#get-subscription)
    - [GET /subscription/plans](#get-subscriptionplans)
    - [PUT /subscription](#put-subscription)
11. [Payment](#payment)
    - [POST /subscription/upgrade](#post-subscriptionupgrade)
    - [POST /subscription/webhook](#post-subscriptionwebhook)
    - [POST /subscription/cancel](#post-subscriptioncancel)
    - [POST /subscription/enable-auto-renew](#post-subscriptionenable-auto-renew)
12. [Admin](#admin)
    - [POST /admin/sync/{user_id}](#post-adminsyncuser_id)
13. [Account](#account)
    - [DELETE /account](#delete-account)

---

## Аутентификация

API использует два метода аутентификации:

### 1. JWT Bearer (основной)

Все пользовательские запросы требуют JWT токен из Supabase Auth в заголовке `Authorization`.

```
Authorization: Bearer <supabase_jwt_token>
```

Токен верифицируется через JWKS (`<SUPABASE_URL>/auth/v1/.well-known/jwks.json`). Поддерживаются алгоритмы **ES256** (новые проекты) и **HS256** (legacy). Audience: `authenticated`.

Из payload извлекаются:
- `sub` — UUID пользователя (`user_id`)
- `email` — email пользователя

**Ошибки аутентификации:**

| Код | Описание |
|-----|----------|
| 401 | `Authorization header required` — заголовок отсутствует |
| 401 | `Token expired` — срок действия JWT истёк |
| 401 | `Invalid token: ...` — невалидный токен |
| 401 | `Token missing sub claim` — отсутствует идентификатор пользователя |

### 2. X-Cron-Secret (серверный cron)

Для серверных задач синхронизации (cron */30) используется пара заголовков:

```
X-Cron-Secret: <SYNC_CRON_SECRET>
X-Cron-User-Id: <user_uuid>
```

Секрет проверяется через `hmac.compare_digest`. При совпадении запрос обрабатывается от имени указанного пользователя.

Используется в endpoint-ах: `POST /sync/products`, `POST /sync/sales`, `POST /sync/stocks`, `POST /sync/costs`, `POST /sync/ads`, `POST /sync/all`, `GET /sync/logs`, `GET /sync/stocks/check`.

Для `POST /sync/process-queue` используется только `X-Cron-Secret` (без `X-Cron-User-Id` — обрабатывает всех пользователей из очереди).

### 3. IP Verification (YooKassa webhook)

`POST /subscription/webhook` не требует JWT. Проверяется IP-адрес отправителя из `X-Forwarded-For` / `X-Real-IP` против белого списка ЮКассы.

---

## Feature Gates

Доступ к функциям зависит от тарифного плана пользователя. При попытке вызвать endpoint, требующий более высокого плана, возвращается `403` с описанием необходимого тарифа.

| Feature | Free | Pro (990 руб/мес) | Business (2990 руб/мес) | Описание |
|---------|:----:|:--:|:--------:|----------|
| `dashboard` | + | + | + | Основной дашборд |
| `costs_tree_basic` | + | + | + | Дерево удержаний (только top-level) |
| `costs_tree_details` | - | + | + | Дерево удержаний (с подкатегориями) |
| `unit_economics` | - | + | + | Unit-экономика по товарам |
| `ads_page` | - | + | + | Страница рекламы, ДРР, кампании |
| `pdf_export` | - | + | + | Экспорт в PDF (Playwright) |
| `period_comparison` | - | + | + | Сравнение с предыдущим периодом |
| `order_monitor` | - | - | + | Воронка заказов, список заказов |
| `api_access` | - | - | + | Прямой доступ к API |

**Лимиты по тарифам:**

| Параметр | Free | Pro | Business |
|----------|------|-----|----------|
| Макс. SKU | 3 | 20 | Безлимит |
| Маркетплейсы | WB | WB + Ozon | WB + Ozon |
| Авто-синхронизация | Нет | Каждые 6ч | Каждые 2ч |
| Ручная синхронизация | 0/день | 1/день | 2/день |

**Формат ошибки 403 (feature gate):**

```json
{
  "detail": {
    "error": "feature_not_available",
    "feature": "unit_economics",
    "current_plan": "free",
    "required_plan": "pro",
    "message": "Feature 'unit_economics' requires a higher plan. Current: free"
  }
}
```

> **Примечание:** Business-тариф скрыт (`visible: false`) до завершения Order Monitor.

---

## Health

### GET /

Корневой endpoint. Не требует аутентификации.

**Auth:** Нет

**Ответ:**

```json
{
  "app": "Analytics Dashboard API",
  "version": "1.0.0",
  "docs": "/docs",
  "status": "running"
}
```

---

### GET /health

### GET /api/v1/health

Health check. Не требует аутентификации.

**Auth:** Нет

**Ответ:**

```json
{
  "status": "ok"
}
```

---

## Dashboard

### GET /dashboard/summary

Сводка по продажам за период. Использует RPC-функции Supabase для оптимизации.

**Auth:** JWT Bearer
**Feature Gate:** `dashboard` (все планы). Если `include_prev_period=true`, требуется `period_comparison` (Pro+), иначе параметр игнорируется.

**Параметры:**

| Параметр | Тип | Обязательный | По умолчанию | Описание |
|----------|-----|:------------:|:------------:|----------|
| `date_from` | string | Нет | 30 дней назад | Дата начала (YYYY-MM-DD) |
| `date_to` | string | Нет | Сегодня | Дата окончания (YYYY-MM-DD) |
| `marketplace` | string | Нет | `null` (все) | Фильтр по МП: `wb`, `ozon` |
| `include_prev_period` | bool | Нет | `false` | Включить данные предыдущего периода (Pro+) |
| `include_ozon_truth` | bool | Нет | `false` | Использовать "истинную" выручку Ozon из costs-tree |

**Пример ответа:**

Возвращает результат RPC-функции `get_dashboard_summary` или `get_dashboard_summary_with_prev` (при `include_prev_period=true`). Структура зависит от SQL-функции в Supabase.

---

### GET /dashboard/unit-economics

Unit-экономика по товарам. Методология идентична дашборду.

**Auth:** JWT Bearer
**Feature Gate:** `unit_economics` (Pro+)

**Формулы (актуально с 19.02.2026):**
- `purchase_i = purchase_price_i * sales_count_i` (RAW, без коэффициента)
- `profit_i = payout_share - purchase_i - ad_cost`
- `drr = ad_cost / displayed_revenue * 100%`
- Гарантия: `SUM(profit_i) = Dashboard profit`
- Поле `costs_tree_ratio` в ответе сохранено для обратной совместимости, но не используется в расчётах

**Параметры:**

| Параметр | Тип | Обязательный | По умолчанию | Описание |
|----------|-----|:------------:|:------------:|----------|
| `date_from` | string | Нет | 30 дней назад | Дата начала (YYYY-MM-DD) |
| `date_to` | string | Нет | Сегодня | Дата окончания (YYYY-MM-DD) |
| `marketplace` | string | Нет | `null` (все) | Фильтр по МП: `wb`, `ozon` |

**Пример ответа:**

```json
{
  "status": "success",
  "period": { "from": "2026-01-19", "to": "2026-02-18" },
  "marketplace": "all",
  "costs_tree_ratio": 0.8523,
  "total_ad_cost": 12450.50,
  "total_payout": 185320.00,
  "total_returns": 14,
  "products": [
    {
      "product": {
        "id": "uuid-1234",
        "name": "Витамин D3",
        "barcode": "4607001234567",
        "purchase_price": 250.00
      },
      "metrics": {
        "sales_count": 120,
        "returns_count": 3,
        "revenue": 89500.00,
        "mp_costs": 22375.00,
        "purchase_costs": 25560.00,
        "ad_cost": 5230.00,
        "drr": 5.8,
        "net_profit": 36335.00,
        "unit_profit": 302.79
      }
    }
  ]
}
```

---

### GET /dashboard/sales-chart

Данные для графика продаж по дням.

**Auth:** JWT Bearer
**Feature Gate:** Нет (все планы)

**Параметры:**

| Параметр | Тип | Обязательный | По умолчанию | Описание |
|----------|-----|:------------:|:------------:|----------|
| `date_from` | string | Нет | 30 дней назад | Дата начала (YYYY-MM-DD) |
| `date_to` | string | Нет | Сегодня | Дата окончания (YYYY-MM-DD) |
| `marketplace` | string | Нет | `null` (все) | Фильтр по МП: `wb`, `ozon` |
| `product_id` | string | Нет | `null` | UUID товара |

**Пример ответа:**

```json
{
  "status": "success",
  "period": { "from": "2026-01-19", "to": "2026-02-18" },
  "data": [
    {
      "date": "2026-02-01",
      "orders": 45,
      "sales": 38,
      "revenue": 28500.00,
      "avg_check": 750.00
    },
    {
      "date": "2026-02-02",
      "orders": 52,
      "sales": 41,
      "revenue": 31200.00,
      "avg_check": 760.98
    }
  ]
}
```

---

### GET /dashboard/ad-costs

Рекламные расходы и ДРР за период (по дням).

**Auth:** JWT Bearer
**Feature Gate:** `ads_page` (Pro+)

**Параметры:**

| Параметр | Тип | Обязательный | По умолчанию | Описание |
|----------|-----|:------------:|:------------:|----------|
| `date_from` | string | Нет | 30 дней назад | Дата начала (YYYY-MM-DD) |
| `date_to` | string | Нет | Сегодня | Дата окончания (YYYY-MM-DD) |
| `marketplace` | string | Нет | `null` (все) | Фильтр по МП: `wb`, `ozon` |
| `include_prev_period` | bool | Нет | `false` | Включить данные предыдущего периода |

**Пример ответа:**

```json
{
  "status": "success",
  "period": { "from": "2026-01-19", "to": "2026-02-18" },
  "marketplace": "all",
  "totals": {
    "ad_cost": 12450.50,
    "revenue": 285000.00,
    "drr": 4.37,
    "impressions": 524000,
    "clicks": 8320,
    "orders": 156
  },
  "data": [
    {
      "date": "2026-02-01",
      "ad_cost": 450.00,
      "revenue": 28500.00,
      "drr": 1.58,
      "impressions": 18500,
      "clicks": 295,
      "orders": 6
    }
  ],
  "previous_totals": {
    "ad_cost": 10200.00,
    "revenue": 265000.00,
    "drr": 3.85,
    "impressions": 480000,
    "clicks": 7100,
    "orders": 132
  }
}
```

> Поле `previous_totals` присутствует только при `include_prev_period=true`.

---

### GET /dashboard/ad-campaigns

Рекламные кампании с агрегированными метриками за период.

**Auth:** JWT Bearer
**Feature Gate:** `ads_page` (Pro+)

**Параметры:**

| Параметр | Тип | Обязательный | По умолчанию | Описание |
|----------|-----|:------------:|:------------:|----------|
| `date_from` | string | Нет | 30 дней назад | Дата начала (YYYY-MM-DD) |
| `date_to` | string | Нет | Сегодня | Дата окончания (YYYY-MM-DD) |
| `marketplace` | string | Нет | `null` (все) | Фильтр по МП: `wb`, `ozon` |

**Пример ответа:**

```json
{
  "status": "success",
  "period": { "from": "2026-01-19", "to": "2026-02-18" },
  "campaigns": [
    {
      "campaign_id": "12345",
      "campaign_name": "Витамин D3 - Поиск",
      "marketplace": "wb",
      "product_name": "Витамин D3 2000 МЕ",
      "cost": 5230.00,
      "impressions": 215000,
      "clicks": 3420,
      "orders": 68,
      "ctr": 1.59,
      "cpc": 1.53,
      "drr": 1.84
    }
  ],
  "total_campaigns": 5
}
```

---

### GET /dashboard/costs-tree

Иерархическое дерево начислений/удержаний МП (аналог ЛК Ozon/WB).

**Auth:** JWT Bearer
**Feature Gate:** `costs_tree_basic` (все). При `include_children=true` требуется `costs_tree_details` (Pro+).

**Параметры:**

| Параметр | Тип | Обязательный | По умолчанию | Описание |
|----------|-----|:------------:|:------------:|----------|
| `date_from` | string | Нет | 30 дней назад | Дата начала (YYYY-MM-DD) |
| `date_to` | string | Нет | Сегодня | Дата окончания (YYYY-MM-DD) |
| `marketplace` | string | Нет | `null` (все) | Фильтр: `wb`, `ozon` |
| `product_id` | string | Нет | `null` | UUID товара |
| `include_children` | bool | Нет | `true` | Включать подкатегории (детализацию) |

**Ответ:** Результат RPC-функции `get_costs_tree`. Содержит `total_accrued`, массив `tree` с иерархической структурой начислений.

> **Free план:** `include_children` принудительно устанавливается в `false`.

---

### GET /dashboard/costs-tree-combined

Объединённое дерево удержаний для Ozon и WB в одном запросе.

**Auth:** JWT Bearer
**Feature Gate:** `costs_tree_basic` (все). При `include_children=true` требуется `costs_tree_details` (Pro+).

**Параметры:**

| Параметр | Тип | Обязательный | По умолчанию | Описание |
|----------|-----|:------------:|:------------:|----------|
| `date_from` | string | Нет | 30 дней назад | Дата начала (YYYY-MM-DD) |
| `date_to` | string | Нет | Сегодня | Дата окончания (YYYY-MM-DD) |
| `product_id` | string | Нет | `null` | UUID товара |
| `include_children` | bool | Нет | `true` | Включать подкатегории |

**Ответ:** Результат RPC-функции `get_costs_tree_combined`.

> **Архитектурное решение (правило #1):** Фронтенд использует отдельные параллельные запросы `costs-tree` per marketplace (НЕ `costs-tree-combined`).

---

### GET /dashboard/stocks

Текущие остатки по складам с прогнозом запаса.

**Auth:** JWT Bearer
**Feature Gate:** Нет (все планы)

**Формулы:**
- `avg_daily_sales = total_sales_30d / 30`
- `days_remaining = total_quantity / avg_daily_sales`

**Параметры:**

| Параметр | Тип | Обязательный | По умолчанию | Описание |
|----------|-----|:------------:|:------------:|----------|
| `marketplace` | string | Нет | `null` (все) | Фильтр: `wb`, `ozon` |

**Пример ответа:**

```json
{
  "status": "success",
  "stocks": [
    {
      "product_id": "uuid-1234",
      "product_name": "Витамин D3 2000 МЕ",
      "barcode": "4607001234567",
      "total_quantity": 450,
      "avg_daily_sales": 15.0,
      "days_remaining": 30,
      "last_updated_at": "2026-02-18T12:00:00+00:00",
      "warehouses": [
        {
          "marketplace": "wb",
          "warehouse": "Коледино",
          "quantity": 280,
          "updated_at": "2026-02-18T12:00:00+00:00"
        },
        {
          "marketplace": "ozon",
          "warehouse": "Хоругвино",
          "quantity": 170,
          "updated_at": "2026-02-18T11:30:00+00:00"
        }
      ]
    }
  ]
}
```

---

### GET /dashboard/stock-history

История остатков по дням из `mp_stock_snapshots`.

**Auth:** JWT Bearer
**Feature Gate:** Нет (все планы)

**Параметры:**

| Параметр | Тип | Обязательный | По умолчанию | Описание |
|----------|-----|:------------:|:------------:|----------|
| `date_from` | string | Нет | 30 дней назад | Дата начала (YYYY-MM-DD) |
| `date_to` | string | Нет | Сегодня | Дата окончания (YYYY-MM-DD) |
| `marketplace` | string | Нет | `null` (все) | Фильтр: `wb`, `ozon`, `all` |
| `product_id` | string | Нет | `null` | UUID товара |

**Пример ответа:**

```json
{
  "status": "success",
  "period": { "from": "2026-01-19", "to": "2026-02-18" },
  "dates": ["2026-01-19", "2026-01-20", "2026-01-21"],
  "products": [
    { "id": "uuid-1234", "name": "Витамин D3", "barcode": "4607001234567" }
  ],
  "series": [
    {
      "product_id": "uuid-1234",
      "product_name": "Витамин D3",
      "barcode": "4607001234567",
      "data": [520, 505, 490]
    }
  ],
  "totals": [520, 505, 490]
}
```

> Системный продукт `WB_ACCOUNT` автоматически фильтруется. При `marketplace=all` суммируются остатки по всем МП для каждого товара.

---

### GET /dashboard/order-funnel

Воронка заказов: Заказы -> Выкупы -> Возвраты + непроведённые.

**Auth:** JWT Bearer
**Feature Gate:** `order_monitor` (Business)

**Параметры:**

| Параметр | Тип | Обязательный | По умолчанию | Описание |
|----------|-----|:------------:|:------------:|----------|
| `date_from` | string | Нет | 30 дней назад | Дата начала (YYYY-MM-DD) |
| `date_to` | string | Нет | Сегодня | Дата окончания (YYYY-MM-DD) |
| `marketplace` | string | Нет | `null` (все) | Фильтр: `wb`, `ozon` |

**Пример ответа:**

```json
{
  "status": "success",
  "period": { "from": "2026-01-19", "to": "2026-02-18" },
  "marketplace": "all",
  "summary": {
    "total_orders": 1200,
    "total_sales": 980,
    "total_returns": 45,
    "buyout_percent": 81.7,
    "total_revenue": 735000.00,
    "unsettled_orders": 120,
    "unsettled_amount": 89500.00,
    "avg_check": 750.00
  },
  "daily": [
    {
      "date": "2026-02-01",
      "orders": 45,
      "sales": 38,
      "returns": 2,
      "revenue": 28500.00,
      "buyout_percent": 84.4
    }
  ],
  "by_product": [
    {
      "product_id": "uuid-1234",
      "product_name": "Витамин D3",
      "barcode": "4607001234567",
      "orders": 350,
      "sales": 295,
      "returns": 12,
      "buyout_percent": 84.3,
      "revenue": 221250.00,
      "avg_check": 750.00
    }
  ]
}
```

---

### GET /dashboard/orders

Позаказная детализация с пагинацией, фильтрами и поиском.

**Auth:** JWT Bearer
**Feature Gate:** `order_monitor` (Business)

**Параметры:**

| Параметр | Тип | Обязательный | По умолчанию | Описание |
|----------|-----|:------------:|:------------:|----------|
| `date_from` | string | Нет | 30 дней назад | Дата начала (YYYY-MM-DD) |
| `date_to` | string | Нет | Сегодня | Дата окончания (YYYY-MM-DD) |
| `marketplace` | string | Нет | `null` (все) | Фильтр: `wb`, `ozon` |
| `status` | string | Нет | `null` | Статус: `ordered`, `sold`, `returned`, `cancelled`, `delivering` |
| `product_id` | string | Нет | `null` | UUID товара |
| `settled` | bool | Нет | `null` | Фильтр по проведённости |
| `search` | string | Нет | `null` | Поиск по order_id, barcode |
| `page` | int | Нет | `1` | Номер страницы (>= 1) |
| `page_size` | int | Нет | `50` | Размер страницы (10-200) |
| `sort_by` | string | Нет | `order_date` | Поле сортировки: `order_date`, `price`, `payout`, `status`, `commission`, `logistics`, `settled` |
| `sort_dir` | string | Нет | `desc` | Направление: `asc`, `desc` |

**Пример ответа:**

```json
{
  "status": "success",
  "period": { "from": "2026-01-19", "to": "2026-02-18" },
  "total_count": 1200,
  "page": 1,
  "page_size": 50,
  "total_pages": 24,
  "orders": [
    {
      "id": "uuid-row",
      "marketplace": "wb",
      "order_id": "WB-123456",
      "product_id": "uuid-1234",
      "product_name": "Витамин D3",
      "barcode": "4607001234567",
      "order_date": "2026-02-18T10:30:00+00:00",
      "last_change_date": "2026-02-18T15:00:00+00:00",
      "status": "sold",
      "price": 890.00,
      "sale_price": 750.00,
      "sale_amount": 750.00,
      "commission": 142.50,
      "logistics": 85.00,
      "storage_fee": 12.00,
      "other_fees": 5.50,
      "payout": 505.00,
      "settled": true,
      "region": "Московская область",
      "warehouse": "Коледино",
      "wb_sale_id": "S-9876543",
      "ozon_posting_status": null
    }
  ],
  "summary": {
    "total_orders": 1200,
    "total_sold": 980,
    "total_returned": 45,
    "total_settled": 860,
    "total_unsettled": 340,
    "total_payout": 520000.00,
    "total_revenue": 735000.00,
    "buyout_percent": 81.7
  }
}
```

---

### GET /dashboard/orders/{order_id}

Детали одного заказа с полным cost breakdown.

**Auth:** JWT Bearer
**Feature Gate:** `order_monitor` (Business)

**Path параметры:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| `order_id` | string | Идентификатор заказа (marketplace order ID) |

**Пример ответа:**

```json
{
  "status": "success",
  "order": {
    "id": "uuid-row",
    "marketplace": "wb",
    "order_id": "WB-123456",
    "product_id": "uuid-1234",
    "product_name": "Витамин D3",
    "barcode": "4607001234567",
    "order_date": "2026-02-18T10:30:00+00:00",
    "last_change_date": "2026-02-18T15:00:00+00:00",
    "status": "sold",
    "price": 890.00,
    "sale_price": 750.00,
    "sale_amount": 750.00,
    "commission": 142.50,
    "logistics": 85.00,
    "storage_fee": 12.00,
    "other_fees": 5.50,
    "payout": 505.00,
    "settled": true,
    "region": "Московская область",
    "warehouse": "Коледино",
    "wb_sale_id": "S-9876543",
    "wb_rrd_id": 12345678,
    "ozon_posting_status": null,
    "raw_data": { "...": "исходные данные из API маркетплейса" }
  }
}
```

**Ошибки:**

| Код | Описание |
|-----|----------|
| 404 | `Order not found` |

---

## Sync

Все endpoint-ы синхронизации поддерживают два метода аутентификации: **JWT Bearer** и **X-Cron-Secret** (см. [Аутентификация](#аутентификация)).

Механизмы защиты:
- **Running lock** (TTL 2ч) — предотвращает параллельные синхронизации
- **Cooldown** — предотвращает повторные запуски после недавнего успеха
- **Idempotency guard** — можно обойти через `force=true`

### POST /sync/products

Синхронизация товаров (обновление WB/Ozon ID).

**Auth:** JWT Bearer | X-Cron-Secret
**Feature Gate:** Нет

**Пример ответа:**

```json
{
  "status": "completed",
  "wb": { "records": 5 },
  "ozon": { "records": 6 }
}
```

---

### POST /sync/sales

Синхронизация продаж за последние N дней.

**Auth:** JWT Bearer | X-Cron-Secret
**Feature Gate:** Нет (маркетплейсы ограничиваются тарифом)

**Параметры:**

| Параметр | Тип | Обязательный | По умолчанию | Описание |
|----------|-----|:------------:|:------------:|----------|
| `days_back` | int | Нет | `35` | Количество дней для загрузки |
| `marketplace` | string | Нет | `null` (все) | `wb`, `ozon`, `all` |
| `force` | bool | Нет | `false` | Игнорировать idempotency-guard |

**Cooldown:** 20 часов

**Пример ответа:**

```json
{
  "status": "completed",
  "period": { "from": "2026-01-14", "to": "2026-02-18" },
  "results": {
    "wb": { "records": 1250, "status": "success" },
    "ozon": { "records": 980, "status": "success" }
  },
  "job": { "marketplace": "all", "sync_type": "sales", "records": 2230 }
}
```

**Ответ при cooldown:**

```json
{
  "status": "skipped",
  "reason": "already_synced_recently",
  "last_finished_at": "2026-02-18T08:00:00+00:00"
}
```

---

### POST /sync/stocks

Синхронизация остатков на складах. Также создаёт snapshot в `mp_stock_snapshots`.

**Auth:** JWT Bearer | X-Cron-Secret
**Feature Gate:** Нет (маркетплейсы ограничиваются тарифом)

**Параметры:**

| Параметр | Тип | Обязательный | По умолчанию | Описание |
|----------|-----|:------------:|:------------:|----------|
| `marketplace` | string | Нет | `null` (все) | `wb`, `ozon`, `all` |
| `force` | bool | Нет | `false` | Игнорировать cooldown |

**Cooldown:** 2 часа

**Пример ответа:**

```json
{
  "status": "completed",
  "results": {
    "wb": { "records": 12, "status": "success" },
    "ozon": { "records": 8, "status": "success" }
  }
}
```

---

### POST /sync/costs

Синхронизация удержаний МП за последние N дней.

**Auth:** JWT Bearer | X-Cron-Secret
**Feature Gate:** Нет (маркетплейсы ограничиваются тарифом)

**Параметры:**

| Параметр | Тип | Обязательный | По умолчанию | Описание |
|----------|-----|:------------:|:------------:|----------|
| `days_back` | int | Нет | `30` | Количество дней для загрузки |
| `marketplace` | string | Нет | `null` (все) | `wb`, `ozon`, `all` |
| `force` | bool | Нет | `false` | Игнорировать cooldown |

**Cooldown:** 4 часа

**Пример ответа:**

```json
{
  "status": "completed",
  "period": { "from": "2026-01-19", "to": "2026-02-18" },
  "results": {
    "wb": { "records": 850, "status": "success" },
    "ozon": { "records": 620, "status": "success" }
  }
}
```

---

### POST /sync/ads

Синхронизация рекламных расходов за последние N дней.

**Auth:** JWT Bearer | X-Cron-Secret
**Feature Gate:** Нет (маркетплейсы ограничиваются тарифом)

**Параметры:**

| Параметр | Тип | Обязательный | По умолчанию | Описание |
|----------|-----|:------------:|:------------:|----------|
| `days_back` | int | Нет | `30` | Количество дней для загрузки |
| `marketplace` | string | Нет | `null` (все) | `wb`, `ozon`, `all` |
| `force` | bool | Нет | `false` | Игнорировать cooldown |

**Cooldown:** 4 часа

**Пример ответа:**

```json
{
  "status": "completed",
  "period": { "from": "2026-01-19", "to": "2026-02-18" },
  "results": {
    "wb": { "records": 320, "status": "success" },
    "ozon": { "records": 215, "status": "success" }
  }
}
```

---

### POST /sync/all

Полная синхронизация всех данных (products + sales + stocks + costs + ads).

**Auth:** JWT Bearer | X-Cron-Secret
**Feature Gate:** Нет

**Параметры:**

| Параметр | Тип | Обязательный | По умолчанию | Описание |
|----------|-----|:------------:|:------------:|----------|
| `days_back` | int | Нет | `30` | Количество дней для загрузки |
| `run_in_background` | bool | Нет | `false` | Запустить в фоне (BackgroundTasks) |

**Ответ (синхронный):**

```json
{
  "status": "completed",
  "success_count": 5,
  "results": { "...": "детализация по каждому типу" }
}
```

**Ответ (фоновый, `run_in_background=true`):**

```json
{
  "status": "started",
  "message": "Синхронизация запущена в фоновом режиме",
  "days_back": 30
}
```

---

### GET /sync/logs

Логи синхронизации.

**Auth:** JWT Bearer | X-Cron-Secret
**Feature Gate:** Нет

**Параметры:**

| Параметр | Тип | Обязательный | По умолчанию | Описание |
|----------|-----|:------------:|:------------:|----------|
| `limit` | int | Нет | `50` | Количество последних записей |

**Пример ответа:**

```json
{
  "status": "success",
  "count": 12,
  "logs": [
    {
      "id": "uuid",
      "marketplace": "all",
      "sync_type": "sales",
      "status": "success",
      "records_count": 1250,
      "error_message": null,
      "started_at": "2026-02-18T08:00:00+00:00",
      "finished_at": "2026-02-18T08:02:30+00:00",
      "user_id": "uuid",
      "trigger": "auto"
    }
  ]
}
```

---

### GET /sync/stocks/check

Диагностика остатков: сверка данных маркетплейса с `mp_stocks`.

**Auth:** JWT Bearer | X-Cron-Secret
**Feature Gate:** Нет

**Параметры:**

| Параметр | Тип | Обязательный | По умолчанию | Описание |
|----------|-----|:------------:|:------------:|----------|
| `marketplace` | string | Нет | `null` | `wb` (реализовано), `ozon/all` -- зарезервировано |
| `days_back` | int | Нет | `365` | Окно dateFrom для WB stocks |

**Ошибки:**

| Код | Описание |
|-----|----------|
| 400 | `Unsupported marketplace for stocks check (use wb)` |

---

### POST /sync/process-queue

Обработка очереди синхронизации. **Только для cron.** Обрабатывает всех пользователей, у которых `next_sync_at <= now`.

**Auth:** X-Cron-Secret (только заголовок, без `X-Cron-User-Id`)
**Feature Gate:** Нет

**Пример ответа:**

```json
{
  "status": "ok",
  "processed": 3,
  "skipped": 1,
  "errors": 0
}
```

---

### POST /sync/manual

Ручная синхронизация с дневным лимитом по тарифу.

**Auth:** JWT Bearer
**Feature Gate:** Зависит от `manual_sync_limit` тарифа (Free: 0, Pro: 1, Business: 2)

**Пример ответа (успех):**

```json
{
  "status": "completed",
  "syncs_remaining": 0,
  "next_auto_sync": "2026-02-18T16:00:00+00:00"
}
```

**Ошибки:**

| Код | Описание |
|-----|----------|
| 403 | `manual_sync_not_available` — ручная синхронизация недоступна на тарифе |
| 403 | `manual_sync_limit_reached` — лимит исчерпан на сегодня |
| 409 | `sync_already_running` — синхронизация уже выполняется |

---

### GET /sync/status

Статус синхронизации для страницы настроек.

**Auth:** JWT Bearer
**Feature Gate:** Нет

**Пример ответа:**

```json
{
  "plan": "pro",
  "plan_name": "Pro",
  "last_sync_at": "2026-02-18T08:02:30+00:00",
  "last_sync_ago_minutes": 45,
  "next_sync_at": "2026-02-18T13:00:00+00:00",
  "sync_interval_hours": 6,
  "manual_syncs_today": 1,
  "manual_sync_limit": 1,
  "manual_syncs_remaining": 0,
  "is_syncing": false
}
```

---

## Products

### GET /products

Список всех товаров пользователя (исключая `WB_ACCOUNT`).

**Auth:** JWT Bearer
**Feature Gate:** Нет

**Параметры:**

| Параметр | Тип | Обязательный | По умолчанию | Описание |
|----------|-----|:------------:|:------------:|----------|
| `marketplace` | string | Нет | `null` (все) | Фильтр: `wb` (с wb_nm_id), `ozon` (с ozon_product_id) |

**Пример ответа:**

```json
{
  "status": "success",
  "count": 5,
  "products": [
    {
      "id": "uuid-1234",
      "user_id": "uuid-user",
      "name": "Витамин D3 2000 МЕ",
      "barcode": "4607001234567",
      "marketplace": "wb",
      "wb_nm_id": 12345678,
      "ozon_product_id": null,
      "purchase_price": 250.00,
      "sort_order": 0,
      "product_group_id": "uuid-group",
      "created_at": "2026-01-15T10:00:00+00:00",
      "updated_at": "2026-02-18T12:00:00+00:00"
    }
  ]
}
```

---

### GET /products/{product_id}

Получить товар по UUID.

**Auth:** JWT Bearer
**Feature Gate:** Нет

**Path параметры:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| `product_id` | string | UUID товара |

**Ошибки:**

| Код | Описание |
|-----|----------|
| 404 | `Product not found` |

---

### GET /products/barcode/{barcode}

Получить товар по штрихкоду.

**Auth:** JWT Bearer
**Feature Gate:** Нет

**Path параметры:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| `barcode` | string | Штрихкод товара |

**Ошибки:**

| Код | Описание |
|-----|----------|
| 404 | `Product not found` |

---

### PUT /products/{product_id}/purchase-price

Обновить себестоимость товара. Если товар в группе (`product_group_id`), обновляет все связанные товары.

**Auth:** JWT Bearer
**Feature Gate:** Нет

**Path параметры:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| `product_id` | string | UUID товара |

**Body (JSON):**

```json
{
  "purchase_price": 250.00
}
```

| Поле | Тип | Обязательное | Описание |
|------|-----|:------------:|----------|
| `purchase_price` | float | Да | Себестоимость (>= 0) |

**Пример ответа:**

```json
{
  "status": "success",
  "product_id": "uuid-1234",
  "purchase_price": 250.00,
  "linked_updated": 1
}
```

---

### PUT /products/reorder

Массовое обновление порядка сортировки товаров (drag & drop).

**Auth:** JWT Bearer
**Feature Gate:** Нет

**Body (JSON):**

```json
{
  "items": [
    { "product_id": "uuid-1", "sort_order": 0 },
    { "product_id": "uuid-2", "sort_order": 1 },
    { "product_id": "uuid-3", "sort_order": 2 }
  ]
}
```

**Пример ответа:**

```json
{
  "status": "success",
  "updated": 3
}
```

---

### POST /products/link

Связать два товара с разных маркетплейсов. Устанавливает одинаковый `product_group_id` и `purchase_price`.

**Auth:** JWT Bearer
**Feature Gate:** Нет

**Body (JSON):**

```json
{
  "wb_product_id": "uuid-wb",
  "ozon_product_id": "uuid-ozon",
  "purchase_price": 250.00
}
```

| Поле | Тип | Обязательное | Описание |
|------|-----|:------------:|----------|
| `wb_product_id` | string | Да | UUID товара WB (должен иметь `wb_nm_id`) |
| `ozon_product_id` | string | Да | UUID товара Ozon (должен иметь `ozon_product_id`) |
| `purchase_price` | float | Да | Себестоимость (>= 0) |

**Пример ответа:**

```json
{
  "status": "success",
  "group_id": "uuid-group",
  "purchase_price": 250.00
}
```

**Ошибки:**

| Код | Описание |
|-----|----------|
| 400 | `First product must be a WB product (wb_nm_id required)` |
| 400 | `Second product must be an Ozon product (ozon_product_id required)` |
| 400 | `Cannot link a product with itself` |
| 404 | `WB product not found` / `Ozon product not found` |

---

### POST /products/unlink/{group_id}

Разорвать связь между товарами в группе. `purchase_price` сохраняется.

**Auth:** JWT Bearer
**Feature Gate:** Нет

**Path параметры:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| `group_id` | string | UUID группы товаров |

**Пример ответа:**

```json
{
  "status": "success",
  "unlinked_count": 2
}
```

**Ошибки:**

| Код | Описание |
|-----|----------|
| 404 | `No products found with this group_id` |

---

## Sales Plan

3-уровневая система планирования: **total** -> **per-MP** (wb/ozon) -> **per-product per-MP**.

### GET /sales-plan

Получить per-product план продаж на месяц по маркетплейсу.

**Auth:** JWT Bearer
**Feature Gate:** Нет

**Параметры:**

| Параметр | Тип | Обязательный | По умолчанию | Описание |
|----------|-----|:------------:|:------------:|----------|
| `month` | string | Нет | Текущий месяц | Формат: `YYYY-MM` |
| `marketplace` | string | Нет | `wb` | `wb` или `ozon` |

**Пример ответа:**

```json
{
  "status": "success",
  "month": "2026-02",
  "marketplace": "wb",
  "plans": [
    {
      "product_id": "uuid-1234",
      "product_name": "Витамин D3",
      "barcode": "4607001234567",
      "plan_revenue": 120000.00
    },
    {
      "product_id": "uuid-5678",
      "product_name": "Омега-3",
      "barcode": "4607009876543",
      "plan_revenue": 0
    }
  ]
}
```

---

### PUT /sales-plan

Upsert per-product план продаж.

**Auth:** JWT Bearer
**Feature Gate:** Нет

**Body (JSON):**

```json
{
  "month": "2026-02",
  "marketplace": "wb",
  "items": [
    { "product_id": "uuid-1234", "plan_revenue": 120000.00 },
    { "product_id": "uuid-5678", "plan_revenue": 85000.00 }
  ]
}
```

| Поле | Тип | Обязательное | Описание |
|------|-----|:------------:|----------|
| `month` | string | Да | Формат: `YYYY-MM` |
| `marketplace` | string | Да | `wb` или `ozon` |
| `items` | array | Да | Массив `{ product_id, plan_revenue }` |

**Пример ответа:**

```json
{
  "status": "success",
  "updated": 2
}
```

---

### DELETE /sales-plan/reset

Сброс ВСЕХ планов за месяц (summary + per-product). Удаляет строки из обеих таблиц.

**Auth:** JWT Bearer
**Feature Gate:** Нет

**Параметры:**

| Параметр | Тип | Обязательный | По умолчанию | Описание |
|----------|-----|:------------:|:------------:|----------|
| `month` | string | Нет | Текущий месяц | Формат: `YYYY-MM` |

**Пример ответа:**

```json
{
  "status": "success"
}
```

---

### GET /sales-plan/summary

Получить summary-планы: total + wb + ozon.

**Auth:** JWT Bearer
**Feature Gate:** Нет

**Параметры:**

| Параметр | Тип | Обязательный | По умолчанию | Описание |
|----------|-----|:------------:|:------------:|----------|
| `month` | string | Нет | Текущий месяц | Формат: `YYYY-MM` |

**Пример ответа:**

```json
{
  "status": "success",
  "month": "2026-02",
  "summary": {
    "total": 500000.00,
    "wb": 300000.00,
    "ozon": 200000.00
  }
}
```

---

### PUT /sales-plan/summary

Upsert summary-план (total / wb / ozon).

**Auth:** JWT Bearer
**Feature Gate:** Нет

**Body (JSON):**

```json
{
  "month": "2026-02",
  "level": "total",
  "plan_revenue": 500000.00
}
```

| Поле | Тип | Обязательное | Описание |
|------|-----|:------------:|----------|
| `month` | string | Да | Формат: `YYYY-MM` |
| `level` | string | Да | `total`, `wb` или `ozon` |
| `plan_revenue` | float | Да | Плановая выручка (>= 0) |

**Пример ответа:**

```json
{
  "status": "success"
}
```

---

### GET /sales-plan/completion

Выполнение плана: фактическая выручка vs план. Использует 3-уровневый приоритет: **total > per-MP > per-product**.

**Auth:** JWT Bearer
**Feature Gate:** Нет

**Параметры:**

| Параметр | Тип | Обязательный | По умолчанию | Описание |
|----------|-----|:------------:|:------------:|----------|
| `date_from` | string | Нет | 1-е число текущего месяца | Дата начала (YYYY-MM-DD) |
| `date_to` | string | Нет | Сегодня | Дата окончания (YYYY-MM-DD) |
| `marketplace` | string | Нет | `null` (все) | Фильтр: `wb`, `ozon` |

**Логика приоритетов:**
1. Если есть `total` план и не выбран конкретный МП -- используется `total`
2. Иначе если есть планы на уровне МП -- суммируются по МП, у которых есть планы
3. Иначе используются per-product планы

**Важно:** Фактическая выручка считается **только за месяцы, в которых установлен план** (не за весь date range дашборда).

**Пример ответа:**

```json
{
  "status": "success",
  "period": { "from": "2026-02-01", "to": "2026-02-18" },
  "month_label": "Февраль 2026",
  "plan_level": "total",
  "total_plan": 500000.00,
  "total_actual": 285000.00,
  "completion_percent": 57.0,
  "by_product": [],
  "pace_daily": 15833.33,
  "required_pace": 17916.67,
  "forecast_revenue": 443333.24,
  "forecast_percent": 88.7,
  "days_elapsed": 18,
  "days_remaining": 10,
  "days_total": 28
}
```

---

### GET /sales-plan/previous

Получить планы предыдущего месяца (для копирования).

**Auth:** JWT Bearer
**Feature Gate:** Нет

**Параметры:**

| Параметр | Тип | Обязательный | По умолчанию | Описание |
|----------|-----|:------------:|:------------:|----------|
| `month` | string | Нет | Текущий месяц | Формат: `YYYY-MM` (вернутся планы за месяц-1) |

**Пример ответа:**

```json
{
  "status": "success",
  "has_previous": true,
  "prev_month": "2026-01",
  "summary": {
    "total": 450000.00,
    "wb": 270000.00,
    "ozon": 180000.00
  },
  "plans": [
    { "product_id": "uuid-1234", "plan_revenue": 120000.00, "marketplace": "wb" },
    { "product_id": "uuid-5678", "plan_revenue": 85000.00, "marketplace": "wb" }
  ]
}
```

---

## Export

### GET /export/pdf

Генерация PDF отчёта через Playwright. Открывает фронтенд-страницу `/print` с данными пользователя и рендерит в PDF.

**Auth:** JWT Bearer
**Feature Gate:** `pdf_export` (Pro+)

**Параметры:**

| Параметр | Тип | Обязательный | По умолчанию | Описание |
|----------|-----|:------------:|:------------:|----------|
| `date_from` | string | Да | -- | Начало периода (YYYY-MM-DD) |
| `date_to` | string | Да | -- | Конец периода (YYYY-MM-DD) |
| `marketplace` | string | Нет | `all` | `all`, `ozon`, `wb` |

**Content-Type ответа:** `application/pdf`

**Заголовок:** `Content-Disposition: attachment; filename="analytics_2026-01-19_2026-02-18_all.pdf"`

**Технические детали:**
- Viewport: 1200x800, deviceScaleFactor: 2
- Формат: A4 landscape, print_background: true
- Отступы: 10mm со всех сторон
- Ожидание: `[data-pdf-ready="true"]` (timeout 45сек), fallback 3сек

---

## Tokens

API-токены маркетплейсов. Шифруются Fernet перед сохранением в БД.

### GET /tokens

Статус токенов (какие заполнены). Значения токенов **не возвращаются**.

**Auth:** JWT Bearer
**Feature Gate:** Нет

**Пример ответа:**

```json
{
  "has_wb": true,
  "has_ozon_seller": true,
  "has_ozon_perf": false
}
```

---

### PUT /tokens

Сохранить/обновить API-токены маркетплейсов.

**Auth:** JWT Bearer
**Feature Gate:** Нет

**Body (JSON):**

```json
{
  "wb_api_token": "eyJhb...",
  "ozon_client_id": "123456",
  "ozon_api_key": "abc-def-ghi",
  "ozon_perf_client_id": null,
  "ozon_perf_secret": null
}
```

| Поле | Тип | Обязательное | Описание |
|------|-----|:------------:|----------|
| `wb_api_token` | string / null | Нет | API-токен Wildberries |
| `ozon_client_id` | string / null | Нет | Client ID Ozon Seller API |
| `ozon_api_key` | string / null | Нет | API Key Ozon Seller API |
| `ozon_perf_client_id` | string / null | Нет | Client ID Ozon Performance API |
| `ozon_perf_secret` | string / null | Нет | Client Secret Ozon Performance API |

> Передавайте `null` чтобы не менять значение. Передавайте пустую строку `""` чтобы очистить.

**Пример ответа:**

```json
{
  "status": "saved"
}
```

---

### POST /tokens/validate

Проверить токены легкими API-запросами к маркетплейсам. Токены отправляются в теле запроса (не берутся из БД).

**Auth:** JWT Bearer
**Feature Gate:** Нет

**Body:** Аналогичен `PUT /tokens`

**Пример ответа:**

```json
{
  "results": {
    "wb": { "valid": true },
    "ozon_seller": { "valid": true },
    "ozon_perf": { "valid": false, "error": "Invalid client_id" }
  }
}
```

---

### POST /tokens/save-and-sync

Сохранить токены и запустить полную синхронизацию в фоне. Используется на этапе onboarding.

**Auth:** JWT Bearer
**Feature Gate:** Нет

**Body:** Аналогичен `PUT /tokens`

**Пример ответа:**

```json
{
  "status": "sync_started"
}
```

> Синхронизация выполняется в фоне через `BackgroundTasks`. Запись `running` в `mp_sync_log` создаётся немедленно, чтобы `is_syncing` сразу стал `true`.

---

## Subscription

### GET /subscription

Текущая подписка пользователя с лимитами и фичами.

**Auth:** JWT Bearer
**Feature Gate:** Нет

**Пример ответа:**

```json
{
  "plan": "pro",
  "status": "active",
  "plan_name": "Pro",
  "auto_renew": true,
  "expires_at": "2026-03-18T12:00:00+00:00",
  "limits": {
    "max_sku": 20,
    "current_sku": 5,
    "sku_remaining": 15,
    "marketplaces": ["wb", "ozon"],
    "auto_sync": true,
    "sync_interval_hours": 6
  },
  "features": {
    "dashboard": true,
    "costs_tree_basic": true,
    "costs_tree_details": true,
    "unit_economics": true,
    "ads_page": true,
    "pdf_export": true,
    "period_comparison": true,
    "order_monitor": false,
    "api_access": false
  }
}
```

---

### GET /subscription/plans

Доступные тарифные планы для сравнения. Скрытые планы (`visible: false`) не возвращаются.

**Auth:** Нет
**Feature Gate:** Нет

**Пример ответа:**

```json
{
  "plans": [
    {
      "id": "free",
      "name": "Free",
      "price_rub": 0,
      "max_sku": 3,
      "marketplaces": ["wb"],
      "auto_sync": false,
      "sync_interval_hours": null,
      "manual_sync_limit": 0,
      "features": {
        "dashboard": true,
        "costs_tree_basic": true,
        "costs_tree_details": false,
        "unit_economics": false,
        "ads_page": false,
        "pdf_export": false,
        "period_comparison": false,
        "order_monitor": false,
        "api_access": false
      }
    },
    {
      "id": "pro",
      "name": "Pro",
      "price_rub": 990,
      "max_sku": 20,
      "marketplaces": ["wb", "ozon"],
      "auto_sync": true,
      "sync_interval_hours": 6,
      "manual_sync_limit": 1,
      "features": { "...": "..." }
    }
  ]
}
```

---

### PUT /subscription

Изменение тарифа пользователя. **Только для администратора.**

**Auth:** JWT Bearer (admin)
**Feature Gate:** Нет (проверка `admin_user_ids` в конфиге)

**Body (JSON):**

```json
{
  "user_id": "uuid-user",
  "plan": "pro"
}
```

| Поле | Тип | Обязательное | Описание |
|------|-----|:------------:|----------|
| `user_id` | string | Да | UUID пользователя |
| `plan` | string | Да | `free`, `pro` или `business` |

**Пример ответа:**

```json
{
  "status": "updated",
  "user_id": "uuid-user",
  "plan": "pro",
  "sync_triggered": true
}
```

> Если upgrade открывает новые маркетплейсы (например, free -> pro добавляет Ozon), автоматически запускается синхронизация.

**Ошибки:**

| Код | Описание |
|-----|----------|
| 400 | `Invalid plan: ...` |
| 403 | `Admin access required` |

---

## Payment

Интеграция с ЮКасса (ShopID: 1273909).

### POST /subscription/upgrade

Создать платёж в ЮКассе для перехода на платный тариф.

**Auth:** JWT Bearer
**Feature Gate:** Нет

**Body (JSON):**

```json
{
  "plan": "pro"
}
```

| Поле | Тип | Обязательное | Описание |
|------|-----|:------------:|----------|
| `plan` | string | Да | `pro` или `business` |

**Пример ответа:**

```json
{
  "confirmation_url": "https://yoomoney.ru/checkout/payments/v2/contract?orderId=..."
}
```

**Ошибки:**

| Код | Описание |
|-----|----------|
| 400 | `Неизвестный тариф: ...` |
| 400 | `Нельзя оплатить бесплатный тариф` |
| 400 | `Вы уже на тарифе Pro` |
| 502 | `Ошибка создания платежа` |
| 502 | `ЮКасса не вернула URL для оплаты` |

---

### POST /subscription/webhook

Webhook от ЮКассы. Обрабатывает события `payment.succeeded` и `payment.canceled`.

**Auth:** IP Verification (белый список ЮКассы)
**Feature Gate:** Нет

**Body (JSON от ЮКассы):**

```json
{
  "event": "payment.succeeded",
  "object": {
    "id": "yookassa-payment-id",
    "status": "succeeded",
    "amount": { "value": "990.00", "currency": "RUB" },
    "payment_method": {
      "id": "pm-id",
      "saved": true
    }
  }
}
```

**Обработка:**
- `payment.succeeded` -- активация подписки на 30 дней, обновление sync queue
- `payment.canceled` -- обновление статуса платежа
- Идемпотентность: повторные webhook-и для обработанных платежей игнорируются
- Двойная верификация: статус платежа проверяется напрямую у ЮКассы

**Пример ответа:**

```json
{
  "status": "ok"
}
```

---

### POST /subscription/cancel

Отключить автопродление подписки.

**Auth:** JWT Bearer
**Feature Gate:** Нет

**Пример ответа:**

```json
{
  "status": "auto_renew_disabled"
}
```

**Ошибки:**

| Код | Описание |
|-----|----------|
| 400 | `Нечего отменять -- вы на бесплатном тарифе` |

---

### POST /subscription/enable-auto-renew

Включить автопродление подписки.

**Auth:** JWT Bearer
**Feature Gate:** Нет

**Пример ответа:**

```json
{
  "status": "auto_renew_enabled"
}
```

**Ошибки:**

| Код | Описание |
|-----|----------|
| 400 | `Нечего включать -- вы на бесплатном тарифе` |

---

## Admin

### POST /admin/sync/{user_id}

Принудительная синхронизация для любого пользователя. Игнорирует cooldown и дневные лимиты, но уважает running-lock.

**Auth:** JWT Bearer (admin)
**Feature Gate:** Нет (проверка `admin_user_ids` в конфиге)

**Path параметры:**

| Параметр | Тип | Описание |
|----------|-----|----------|
| `user_id` | string | UUID пользователя для синхронизации |

**Пример ответа:**

```json
{
  "status": "completed",
  "user_id": "uuid-user",
  "records": 2540
}
```

**Ошибки:**

| Код | Описание |
|-----|----------|
| 403 | `Admin access required` |
| 409 | `sync_already_running` -- синхронизация уже выполняется |
| 500 | `sync_failed` -- ошибка синхронизации |

---

## Account

### DELETE /account

Полное удаление аккаунта: все данные из БД + auth user из Supabase.

**Auth:** JWT Bearer
**Feature Gate:** Нет

**Порядок удаления (FK constraints):**

1. `mp_payments`
2. `mp_sync_queue`
3. `mp_sync_log`
4. `mp_orders`
5. `mp_ad_costs`
6. `mp_sales_geo`
7. `mp_costs_details`
8. `mp_costs`
9. `mp_stocks`
10. `mp_sales`
11. `mp_products`
12. `mp_user_subscriptions`
13. `mp_user_tokens`
14. Auth user (Supabase Admin API)

**Пример ответа:**

```json
{
  "status": "deleted"
}
```

> **Внимание:** Операция необратима. Удаляются все данные пользователя из всех таблиц и аккаунт из Supabase Auth.

---

## Общие ошибки

| Код | Описание |
|-----|----------|
| 401 | Не авторизован (отсутствует / невалидный / просроченный JWT) |
| 403 | Нет доступа (feature gate, не admin, IP не в whitelist) |
| 404 | Ресурс не найден |
| 409 | Конфликт (sync already running) |
| 500 | Внутренняя ошибка сервера |
| 502 | Ошибка внешнего сервиса (ЮКасса) |

---

## Таблицы БД (справочно)

| Таблица | Описание |
|---------|----------|
| `mp_products` | Товары (name, barcode, purchase_price, wb_nm_id, ozon_product_id, product_group_id) |
| `mp_sales` | Продажи по дням (orders_count, sales_count, returns_count, revenue) |
| `mp_costs` | Удержания МП по товарам |
| `mp_costs_details` | Детализация удержаний (tree items) |
| `mp_stocks` | Текущие остатки по складам |
| `mp_stock_snapshots` | Дневные снимки остатков (для графика динамики) |
| `mp_ad_costs` | Рекламные расходы по дням/кампаниям |
| `mp_orders` | Позаказная детализация (Order Monitor v2) |
| `mp_sales_geo` | Географическая аналитика продаж |
| `mp_sales_plan` | Per-product планы продаж (по МП и месяцу) |
| `mp_sales_plan_summary` | Summary-планы (total / wb / ozon) |
| `mp_user_tokens` | Зашифрованные API-токены МП (Fernet) |
| `mp_user_subscriptions` | Подписки (plan, status, expires_at, auto_renew) |
| `mp_payments` | Платежи ЮКасса |
| `mp_sync_queue` | Очередь синхронизации (priority, next_sync_at) |
| `mp_sync_log` | Логи синхронизации (status, records_count, trigger) |

---

> Документация сгенерирована 18.02.2026. Актуальная OpenAPI-спецификация доступна по адресу `/docs` (Swagger UI) и `/redoc` (ReDoc).
