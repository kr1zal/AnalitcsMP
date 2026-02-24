# База данных — Analytics Dashboard

> Полная документация схемы PostgreSQL. Supabase Cloud, проект **reviomp** (`xpushkwswfbkdkbmghux`).
>
> Последнее обновление: 18.02.2026

---

## Содержание

1. [Обзор](#1-обзор)
2. [Схема таблиц](#2-схема-таблиц)
3. [RPC-функции](#3-rpc-функции)
4. [RLS-политики](#4-rls-политики)
5. [Миграции](#5-миграции)
6. [ER-диаграмма](#6-er-диаграмма)
7. [Индексы и производительность](#7-индексы-и-производительность)
8. [Формулы и бизнес-логика](#8-формулы-и-бизнес-логика)

---

## 1. Обзор

| Параметр | Значение |
|---|---|
| Провайдер | Supabase Cloud (AWS eu-west-1) |
| СУБД | PostgreSQL 15 |
| Проект | `reviomp` (xpushkwswfbkdkbmghux) |
| Pooler | `aws-1-eu-west-1.pooler.supabase.com:5432` |
| Таблиц | **18** (15 `mp_` + 3 `tg_support_`) |
| RPC-функций | **4** |
| Миграций | **24** (001-024) |
| RLS | Включена на всех таблицах |

### Архитектура доступа

```
Frontend (anon key) ──→ Supabase (RLS: user_id = auth.uid()) ──→ PostgreSQL
                         │
Backend (service_role) ──┘  обходит RLS, но ВСЕГДА фильтрует по user_id в коде
```

- **RLS** (Row Level Security) включена на всех 18 таблицах как **safety net**.
- **Backend** использует `service_role_key`, который обходит RLS, но **всегда** передает `user_id` в запросы явно.
- **RPC-функции** принимают `p_user_id UUID DEFAULT NULL` — backend передает UUID текущего пользователя.
- **Миграции** применяются вручную через Supabase SQL Editor (нет CLI-миграций).

### Соглашения именования

| Элемент | Паттерн | Пример |
|---|---|---|
| Таблицы | `mp_` + snake_case | `mp_sales`, `mp_costs_details` |
| Первичные ключи | `id UUID DEFAULT gen_random_uuid()` | — |
| Внешние ключи | `user_id UUID REFERENCES auth.users(id)` | — |
| Timestamp | `TIMESTAMPTZ DEFAULT now()` | `created_at`, `updated_at` |
| UNIQUE constraints | `mp_{table}_user_{fields}_key` | `mp_sales_user_product_mp_date_key` |
| Индексы | `idx_mp_{table}_{columns}` | `idx_mp_sales_date_mp` |

---

## 2. Схема таблиц

### 2.1. `mp_products` — Мастер-данные товаров

Центральная таблица продуктов. Связывает идентификаторы WB и Ozon через общий штрихкод (barcode). Один пользователь — свой набор товаров.

| Столбец | Тип | Nullable | Default | Описание |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | **PK** |
| `user_id` | `UUID` | NO | — | FK → `auth.users(id)` |
| `barcode` | `VARCHAR(20)` | NO | — | Штрихкод (ШК) — универсальный ID товара |
| `name` | `VARCHAR(255)` | NO | — | Наименование товара |
| `purchase_price` | `DECIMAL(10,2)` | NO | — | Закупочная цена (руб.) |
| `wb_nm_id` | `BIGINT` | YES | — | WB: артикул (nm_id) |
| `wb_vendor_code` | `VARCHAR(50)` | YES | — | WB: код поставщика |
| `ozon_product_id` | `BIGINT` | YES | — | Ozon: product_id |
| `ozon_offer_id` | `VARCHAR(50)` | YES | — | Ozon: offer_id (артикул продавца) |
| `ozon_sku` | `TEXT` | YES | — | Ozon: SKU для Analytics API |
| `sort_order` | `INTEGER` | NO | `0` | Порядок отображения (drag&drop) |
| `product_group_id` | `UUID` | YES | `NULL` | Группа кросс-МП связки |
| `created_at` | `TIMESTAMPTZ` | NO | `now()` | — |
| `updated_at` | `TIMESTAMPTZ` | NO | `now()` | — |

**Ограничения:**
- `UNIQUE (user_id, barcode)` — один штрихкод на пользователя

**Индексы:**
- `idx_mp_products_user` — `(user_id)`
- `idx_mp_products_group` — `(product_group_id) WHERE product_group_id IS NOT NULL` (partial)
- `idx_mp_products_sort` — `(user_id, sort_order)`

**Особенности:**
- Системный товар `WB_ACCOUNT` (barcode = `WB_ACCOUNT`) — виртуальный продукт для комиссий/бонусов WB уровня аккаунта. Фильтруется в UI.
- `purchase_price` задается пользователем вручную (Ozon API не отдает закупку).
- `product_group_id` — UUID для кросс-МП связывания (один физический товар на WB и Ozon).

---

### 2.2. `mp_sales` — Ежедневная агрегация продаж

Агрегированные данные по продажам за каждый день, по каждому товару и маркетплейсу. Источник: WB `reportDetailByPeriod`, Ozon Analytics API.

| Столбец | Тип | Nullable | Default | Описание |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | **PK** |
| `user_id` | `UUID` | NO | — | FK → `auth.users(id)` |
| `product_id` | `UUID` | YES | — | FK → `mp_products(id)` |
| `marketplace` | `VARCHAR(20)` | NO | — | `'wb'` или `'ozon'` |
| `date` | `DATE` | NO | — | Дата (день) |
| `orders_count` | `INTEGER` | NO | `0` | Количество заказов |
| `sales_count` | `INTEGER` | NO | `0` | Количество выкупов (шт.) |
| `returns_count` | `INTEGER` | NO | `0` | Количество возвратов |
| `revenue` | `DECIMAL(12,2)` | NO | `0` | Выручка (руб.) — ВСЕ заказы, вкл. непроведенные |
| `buyout_percent` | `DECIMAL(5,2)` | YES | — | Процент выкупа (рассчитывается) |
| `cart_adds` | `INTEGER` | NO | `0` | Добавления в корзину |
| `created_at` | `TIMESTAMPTZ` | NO | `now()` | — |

**Ограничения:**
- `UNIQUE (user_id, product_id, marketplace, date)` — один рекорд на товар+МП+день

**Индексы:**
- `idx_mp_sales_date` — `(date)`
- `idx_mp_sales_product_marketplace` — `(product_id, marketplace)`
- `idx_mp_sales_user` — `(user_id)`
- `idx_mp_sales_date_mp` — `(date, marketplace)`

**Важно:**
- `revenue` содержит ВСЕ заказы, включая непроведенные (unsettled). Для финализированной выручки используется `mp_costs_details` / RPC `get_costs_tree`.
- Upsert по unique constraint: при повторной синхронизации данные обновляются.

---

### 2.3. `mp_stocks` — Текущие остатки по складам

Снимок текущих остатков (не исторических). Перезаписывается при каждой синхронизации.

| Столбец | Тип | Nullable | Default | Описание |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | **PK** |
| `user_id` | `UUID` | NO | — | FK → `auth.users(id)` |
| `product_id` | `UUID` | YES | — | FK → `mp_products(id)` |
| `marketplace` | `VARCHAR(20)` | NO | — | `'wb'` или `'ozon'` |
| `warehouse` | `VARCHAR(100)` | YES | — | Название склада |
| `quantity` | `INTEGER` | NO | `0` | Количество на складе |
| `updated_at` | `TIMESTAMPTZ` | NO | `now()` | — |

**Ограничения:**
- `UNIQUE (user_id, product_id, marketplace, warehouse)` — один рекорд на товар+МП+склад

**Индексы:**
- `idx_mp_stocks_product` — `(product_id)`
- `idx_mp_stocks_user` — `(user_id)`

---

### 2.4. `mp_costs` — Удержания маркетплейса (агрегация)

Ежедневная агрегация удержаний МП по категориям. Fallback-источник, если `mp_costs_details` пуст.

| Столбец | Тип | Nullable | Default | Описание |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | **PK** |
| `user_id` | `UUID` | NO | — | FK → `auth.users(id)` |
| `product_id` | `UUID` | YES | — | FK → `mp_products(id)` |
| `marketplace` | `VARCHAR(20)` | NO | — | `'wb'` или `'ozon'` |
| `date` | `DATE` | NO | — | Дата |
| `commission` | `DECIMAL(10,2)` | NO | `0` | Комиссия МП |
| `logistics` | `DECIMAL(10,2)` | NO | `0` | Логистика |
| `storage` | `DECIMAL(10,2)` | NO | `0` | Хранение |
| `promotion` | `DECIMAL(10,2)` | NO | `0` | Продвижение/реклама МП |
| `penalties` | `DECIMAL(10,2)` | NO | `0` | Штрафы |
| `acquiring` | `DECIMAL(10,2)` | NO | `0` | Эквайринг |
| `other_costs` | `DECIMAL(10,2)` | NO | `0` | Прочие удержания |
| `total_costs` | `DECIMAL(10,2)` | NO | **GENERATED** | **Вычисляемое** = SUM(все категории) |
| `created_at` | `TIMESTAMPTZ` | NO | `now()` | — |

**Ограничения:**
- `UNIQUE (user_id, product_id, marketplace, date)`
- `total_costs` — `GENERATED ALWAYS AS (...) STORED` (автоматическая сумма)

**Индексы:**
- `idx_mp_costs_date` — `(date)`
- `idx_mp_costs_product` — `(product_id)`
- `idx_mp_costs_user` — `(user_id)`
- `idx_mp_costs_date_mp` — `(date, marketplace)`

---

### 2.5. `mp_costs_details` — Детализация удержаний (costs-tree)

Гранулярная детализация всех начислений/удержаний МП. Данные из финотчетов WB и Ozon. Отображается как tree-view (как в ЛК маркетплейсов). **Основной источник** для RPC `get_costs_tree`.

| Столбец | Тип | Nullable | Default | Описание |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | **PK** |
| `user_id` | `UUID` | NO | — | FK → `auth.users(id)` |
| `product_id` | `UUID` | YES | — | FK → `mp_products(id)` |
| `marketplace` | `VARCHAR(20)` | NO | — | `'wb'` или `'ozon'` |
| `date` | `DATE` | NO | — | Дата |
| `category` | `TEXT` | NO | — | Категория верхнего уровня (`'Продажи'`, `'Вознаграждение Ozon'`, ...) |
| `subcategory` | `TEXT` | YES | — | Подкатегория (детализация) |
| `amount` | `DECIMAL(12,2)` | NO | `0` | Сумма (руб.). Положительные = начисления, отрицательные = удержания |
| `operation_type` | `TEXT` | YES | — | Тип операции (опционально) |
| `operation_id` | `TEXT` | YES | — | ID операции (опционально) |
| `created_at` | `TIMESTAMPTZ` | NO | `now()` | — |

**Ограничения:** Нет UNIQUE — insert-only (при синхронизации предыдущие данные за период удаляются, затем вставляются новые).

**Индексы:**
- `idx_mp_costs_details_user` — `(user_id)`
- `idx_mp_costs_details_date_mp` — `(date, marketplace)`

**Категории WB:**
- `Продажи` (положительная), `Вознаграждение Вайлдберриз (ВВ)`, `Услуги по доставке товара покупателю`, `Стоимость хранения`, `Эквайринг/Комиссии за организацию платежей`, и другие.
- **WB credits** (СПП, возмещения) — положительные items помимо "Продажи". Входят в `displayed_revenue`.

**Категории Ozon:**
- `Продажи` (= Выручка + Баллы за скидки + Программы партнеров), `Вознаграждение Ozon`, `Услуги доставки`, `Услуги агентов`, `Услуги FBO`, и другие.
- **Ozon НЕ имеет credits** (нет аналога СПП).

---

### 2.6. `mp_ad_costs` — Рекламные расходы

Ежедневные рекламные расходы по кампаниям.

| Столбец | Тип | Nullable | Default | Описание |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | **PK** |
| `user_id` | `UUID` | NO | — | FK → `auth.users(id)` |
| `product_id` | `UUID` | YES | — | FK → `mp_products(id)` |
| `marketplace` | `VARCHAR(20)` | NO | — | `'wb'` или `'ozon'` |
| `date` | `DATE` | NO | — | Дата |
| `campaign_id` | `VARCHAR(50)` | YES | — | ID рекламной кампании |
| `campaign_name` | `VARCHAR(255)` | YES | — | Название кампании |
| `impressions` | `INTEGER` | NO | `0` | Показы |
| `clicks` | `INTEGER` | NO | `0` | Клики |
| `cost` | `DECIMAL(10,2)` | NO | `0` | Расход (руб.) |
| `orders_count` | `INTEGER` | NO | `0` | Заказы с рекламы |
| `ctr` | `DECIMAL(5,2)` | YES | — | Click-through rate (%) |
| `cpc` | `DECIMAL(10,2)` | YES | — | Cost per click (руб.) |
| `acos` | `DECIMAL(5,2)` | YES | — | Advertising cost of sale (%) |
| `created_at` | `TIMESTAMPTZ` | NO | `now()` | — |

**Ограничения:**
- `UNIQUE (user_id, product_id, marketplace, date, campaign_id)`

**Индексы:**
- `idx_mp_ad_costs_user` — `(user_id)`
- `idx_mp_ad_costs_date_mp` — `(date, marketplace)`

---

### 2.7. `mp_orders` — Позаказная детализация

Каждый заказ/возврат как отдельная строка. WB: идентифицируется по `srid`, Ozon: по `posting_number`.

| Столбец | Тип | Nullable | Default | Описание |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | **PK** |
| `user_id` | `UUID` | NO | — | FK → `auth.users(id) ON DELETE CASCADE` |
| `marketplace` | `VARCHAR(20)` | NO | — | `'wb'` / `'ozon'` |
| `order_id` | `VARCHAR(100)` | NO | — | WB: srid, Ozon: posting_number |
| `product_id` | `UUID` | YES | — | FK → `mp_products(id)` |
| `barcode` | `VARCHAR(20)` | YES | — | Штрихкод |
| `order_date` | `TIMESTAMPTZ` | NO | — | Дата заказа |
| `last_change_date` | `TIMESTAMPTZ` | YES | — | Дата последнего изменения |
| `status` | `VARCHAR(50)` | NO | `'ordered'` | `ordered` / `sold` / `returned` / `cancelled` / `delivering` |
| `price` | `DECIMAL(12,2)` | NO | `0` | Каталожная цена (до скидки СПП у WB) |
| `sale_price` | `DECIMAL(12,2)` | YES | — | Реальная цена (WB: после СПП, Ozon: = price) |
| `sale_amount` | `DECIMAL(12,2)` | YES | — | WB: forPay из sales, Ozon: payout |
| `commission` | `DECIMAL(10,2)` | NO | `0` | Комиссия МП |
| `logistics` | `DECIMAL(10,2)` | NO | `0` | Логистика |
| `storage_fee` | `DECIMAL(10,2)` | NO | `0` | Хранение |
| `other_fees` | `DECIMAL(10,2)` | NO | `0` | Прочие удержания |
| `payout` | `DECIMAL(12,2)` | YES | — | К перечислению |
| `settled` | `BOOLEAN` | NO | `FALSE` | Финотчет МП подтвердил |
| `wb_sale_id` | `VARCHAR(50)` | YES | — | WB: saleID (S*=продажа, R*=возврат) |
| `wb_rrd_id` | `BIGINT` | YES | — | WB: rrd_id из reportDetail |
| `ozon_posting_status` | `VARCHAR(50)` | YES | — | Ozon: статус отправления as-is |
| `region` | `VARCHAR(100)` | YES | — | Регион доставки |
| `warehouse` | `VARCHAR(100)` | YES | — | Склад отправления |
| `raw_data` | `JSONB` | YES | — | Сырые данные API (опционально) |
| `created_at` | `TIMESTAMPTZ` | NO | `now()` | — |
| `updated_at` | `TIMESTAMPTZ` | NO | `now()` | — |

**Ограничения:**
- `UNIQUE (user_id, marketplace, order_id)` — один заказ на пользователя

**Индексы:**
- `idx_mp_orders_user_id` — `(user_id)`
- `idx_mp_orders_date` — `(user_id, order_date)`
- `idx_mp_orders_status` — `(user_id, status)`
- `idx_mp_orders_product` — `(user_id, product_id)`
- `idx_mp_orders_marketplace_date` — `(user_id, marketplace, order_date)`
- `idx_mp_orders_settled` — `(user_id, settled)`

**WB 3-step accumulate:** Данные WB собираются из трех API (fbo, sales, reportDetail), накапливая финансовые поля (commission, logistics, payout, settled).

---

### 2.8. `mp_stock_snapshots` — Ежедневные снимки остатков

Исторические данные по остаткам для графика динамики. Заполняется автоматически после каждого `sync_stocks`.

| Столбец | Тип | Nullable | Default | Описание |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | **PK** |
| `user_id` | `UUID` | NO | — | FK → `auth.users(id)` |
| `product_id` | `UUID` | NO | — | FK → `mp_products(id) ON DELETE CASCADE` |
| `marketplace` | `VARCHAR(20)` | NO | — | `'wb'` / `'ozon'` |
| `date` | `DATE` | NO | — | Дата снимка |
| `total_quantity` | `INTEGER` | NO | `0` | Суммарное количество на складах |
| `created_at` | `TIMESTAMPTZ` | NO | `now()` | — |

**Ограничения:**
- `UNIQUE (user_id, product_id, marketplace, date)` — один снимок на товар+МП+день

**Индексы:**
- `idx_stock_snapshots_user_date` — `(user_id, date DESC)`
- `idx_stock_snapshots_product_date` — `(user_id, product_id, marketplace, date DESC)`

**Реконструкция:** Начальные данные (до начала снимков) восстановлены скриптом `backend/scripts/reconstruct_stock_history.py` — обратный расчет из текущих остатков + дневных продаж.

---

### 2.9. `mp_sales_plan` — План продаж (per-product per-MP)

Детальный план продаж: сколько выручки ожидается от конкретного товара на конкретном маркетплейсе за месяц.

| Столбец | Тип | Nullable | Default | Описание |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | **PK** |
| `user_id` | `UUID` | NO | — | FK → `auth.users(id) ON DELETE CASCADE` |
| `product_id` | `UUID` | NO | — | FK → `mp_products(id) ON DELETE CASCADE` |
| `month` | `DATE` | NO | — | Первый день месяца (`2026-02-01`) |
| `marketplace` | `VARCHAR(10)` | NO | `'wb'` | `'wb'` / `'ozon'` |
| `plan_revenue` | `NUMERIC(12,2)` | NO | `0` | Плановая выручка (руб.) |
| `created_at` | `TIMESTAMPTZ` | NO | `now()` | — |
| `updated_at` | `TIMESTAMPTZ` | NO | `now()` | — |

**Ограничения:**
- `UNIQUE (user_id, product_id, month, marketplace)`

**Индексы:**
- `idx_sales_plan_user_month` — `(user_id, month, marketplace)`

---

### 2.10. `mp_sales_plan_summary` — Суммарный план продаж

Верхнеуровневый план: общий или по маркетплейсу. Три уровня: `total` -> `wb`/`ozon` -> per-product (в `mp_sales_plan`).

| Столбец | Тип | Nullable | Default | Описание |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | **PK** |
| `user_id` | `UUID` | NO | — | FK → `auth.users(id) ON DELETE CASCADE` |
| `month` | `DATE` | NO | — | Первый день месяца (`2026-02-01`) |
| `level` | `VARCHAR(20)` | NO | — | `'total'` / `'wb'` / `'ozon'` |
| `plan_revenue` | `NUMERIC(12,2)` | NO | `0` | Плановая выручка (руб.) |
| `created_at` | `TIMESTAMPTZ` | NO | `now()` | — |
| `updated_at` | `TIMESTAMPTZ` | NO | `now()` | — |

**Ограничения:**
- `UNIQUE (user_id, month, level)`
- `CHECK (level IN ('total', 'wb', 'ozon'))`

**Индексы:**
- `idx_sales_plan_summary_user_month` — `(user_id, month)`

**Приоритет completion:** `total` > сумма МП > сумма товаров. Если задан total план — используется он. Если нет — суммируются планы per-MP. В последнюю очередь — per-product.

---

### 2.11. `mp_sales_geo` — География продаж

Ежедневная география продаж по регионам.

| Столбец | Тип | Nullable | Default | Описание |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | **PK** |
| `user_id` | `UUID` | NO | — | FK → `auth.users(id)` |
| `product_id` | `UUID` | YES | — | FK → `mp_products(id)` |
| `marketplace` | `VARCHAR(20)` | NO | — | `'wb'` / `'ozon'` |
| `date` | `DATE` | NO | — | Дата |
| `region` | `VARCHAR(100)` | NO | — | Регион |
| `orders_count` | `INTEGER` | NO | `0` | Заказы |
| `sales_count` | `INTEGER` | NO | `0` | Выкупы |
| `revenue` | `DECIMAL(12,2)` | NO | `0` | Выручка |
| `created_at` | `TIMESTAMPTZ` | NO | `now()` | — |

**Ограничения:**
- `UNIQUE (user_id, product_id, marketplace, date, region)`

**Индексы:**
- `idx_mp_sales_geo_user` — `(user_id)`

---

### 2.12. `mp_user_tokens` — API-токены маркетплейсов

Одна строка на пользователя. Все значения **зашифрованы Fernet** на стороне backend. В БД хранятся только ciphertext.

| Столбец | Тип | Nullable | Default | Описание |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | **PK** |
| `user_id` | `UUID` | NO | — | FK → `auth.users(id) ON DELETE CASCADE`, **UNIQUE** |
| `wb_api_token` | `TEXT` | YES | — | WB API токен (encrypted) |
| `ozon_client_id` | `TEXT` | YES | — | Ozon Client ID (encrypted) |
| `ozon_api_key` | `TEXT` | YES | — | Ozon API Key (encrypted) |
| `ozon_perf_client_id` | `TEXT` | YES | — | Ozon Performance Client ID (encrypted) |
| `ozon_perf_secret` | `TEXT` | YES | — | Ozon Performance Secret (encrypted) |
| `created_at` | `TIMESTAMPTZ` | NO | `now()` | — |
| `updated_at` | `TIMESTAMPTZ` | NO | `now()` | — |

**Ограничения:**
- `UNIQUE (user_id)` — одна строка на пользователя

**Индексы:**
- `idx_mp_user_tokens_user` — `(user_id)`

**Безопасность:**
- Шифрование: Fernet (symmetric, backend-only). Ключ в `.env` (`FERNET_KEY`).
- Расшифровка ТОЛЬКО на backend при синхронизации.
- Прогрессивное заполнение: поля nullable — пользователь вводит токены по мере подключения МП.

---

### 2.13. `mp_user_subscriptions` — Подписки пользователей

Одна строка на пользователя. Автоматически создается со значением `free` при первом запросе.

| Столбец | Тип | Nullable | Default | Описание |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | **PK** |
| `user_id` | `UUID` | NO | — | FK → `auth.users(id) ON DELETE CASCADE`, **UNIQUE** |
| `plan` | `TEXT` | NO | `'free'` | `'free'` / `'pro'` / `'business'` |
| `status` | `TEXT` | NO | `'active'` | `'active'` / `'cancelled'` / `'expired'` |
| `started_at` | `TIMESTAMPTZ` | NO | `now()` | Дата начала подписки |
| `expires_at` | `TIMESTAMPTZ` | YES | — | Дата окончания (NULL = бессрочно) |
| `changed_by` | `TEXT` | YES | — | Email администратора, изменившего план |
| `payment_method_id` | `TEXT` | YES | — | ID сохраненного метода оплаты (для рекуррентов) |
| `auto_renew` | `BOOLEAN` | NO | `true` | Автопродление |
| `created_at` | `TIMESTAMPTZ` | NO | `now()` | — |
| `updated_at` | `TIMESTAMPTZ` | NO | `now()` | — |

**Ограничения:**
- `UNIQUE (user_id)`
- `CHECK (plan IN ('free', 'pro', 'business'))`
- `CHECK (status IN ('active', 'cancelled', 'expired'))`

**Индексы:**
- `idx_mp_user_subscriptions_user` — `(user_id)`
- `idx_mp_user_subscriptions_plan` — `(plan)`

**RLS:** Только SELECT для обычных пользователей. INSERT/UPDATE/DELETE — только через backend (service_role_key).

---

### 2.14. `mp_payments` — История платежей (YooKassa)

Все платежи через ЮКасса. Привязка через `yookassa_payment_id`.

| Столбец | Тип | Nullable | Default | Описание |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | **PK** |
| `user_id` | `UUID` | NO | — | FK → `auth.users(id)` |
| `yookassa_payment_id` | `TEXT` | NO | — | **UNIQUE**. ID платежа в ЮКасса |
| `payment_method_id` | `TEXT` | YES | — | ID сохраненного метода |
| `amount` | `DECIMAL(10,2)` | NO | — | Сумма (руб.) |
| `currency` | `TEXT` | NO | `'RUB'` | Валюта |
| `status` | `TEXT` | NO | `'pending'` | `pending` / `succeeded` / `canceled` |
| `plan` | `TEXT` | NO | — | Оплаченный план (`'pro'` / `'business'`) |
| `description` | `TEXT` | YES | — | Описание платежа |
| `metadata` | `JSONB` | NO | `'{}'` | Дополнительные данные |
| `created_at` | `TIMESTAMPTZ` | NO | `now()` | — |
| `updated_at` | `TIMESTAMPTZ` | NO | `now()` | — |

**Ограничения:**
- `UNIQUE (yookassa_payment_id)`

**Индексы:**
- `idx_mp_payments_yookassa_id` — `(yookassa_payment_id)` — быстрый lookup при webhook
- `idx_mp_payments_user_id` — `(user_id)`

**RLS:** SELECT для пользователей + полный доступ через service_role (webhook от ЮКассы).

---

### 2.15. `mp_sync_log` — Логи синхронизации

Журнал всех синхронизаций (автоматических и ручных).

| Столбец | Тип | Nullable | Default | Описание |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | **PK** |
| `user_id` | `UUID` | YES | — | FK → `auth.users(id)` |
| `marketplace` | `VARCHAR(20)` | NO | — | `'wb'` / `'ozon'` |
| `sync_type` | `VARCHAR(50)` | NO | — | `'products'` / `'sales'` / `'stocks'` / `'costs'` / `'orders'` / `'ads'` |
| `status` | `VARCHAR(20)` | NO | — | `'success'` / `'error'` |
| `records_count` | `INTEGER` | NO | `0` | Количество обработанных записей |
| `error_message` | `TEXT` | YES | — | Текст ошибки (при `status='error'`) |
| `trigger` | `TEXT` | NO | `'manual'` | `'auto'` / `'manual'` / `'admin'` / `'system'` |
| `started_at` | `TIMESTAMPTZ` | YES | — | Начало синхронизации |
| `finished_at` | `TIMESTAMPTZ` | NO | `now()` | Завершение |

**Ограничения:**
- `CHECK (trigger IN ('auto', 'manual', 'admin', 'system'))`

**Индексы:**
- `idx_mp_sync_log_user` — `(user_id)`

---

### 2.16. `mp_sync_queue` — Очередь синхронизации

Одна строка на пользователя. Управляет расписанием автоматической синхронизации (cron `*/30`).

| Столбец | Тип | Nullable | Default | Описание |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | **PK** |
| `user_id` | `UUID` | NO | — | FK → `auth.users(id) ON DELETE CASCADE` |
| `next_sync_at` | `TIMESTAMPTZ` | NO | — | Время следующей синхронизации |
| `priority` | `INTEGER` | NO | `2` | Приоритет: `0`=business, `1`=pro, `2`=free |
| `status` | `TEXT` | NO | `'pending'` | `'pending'` / `'processing'` / `'completed'` / `'error'` |
| `last_sync_at` | `TIMESTAMPTZ` | YES | — | Время последней синхронизации |
| `last_error` | `TEXT` | YES | — | Последняя ошибка |
| `manual_syncs_today` | `INTEGER` | NO | `0` | Счетчик ручных синхронизаций за сегодня |
| `manual_syncs_date` | `DATE` | NO | `now() AT TIME ZONE 'Europe/Moscow'` | Дата счетчика (MSK) |
| `created_at` | `TIMESTAMPTZ` | NO | `now()` | — |
| `updated_at` | `TIMESTAMPTZ` | NO | `now()` | — |

**Ограничения:**
- `UNIQUE (user_id)` — одна строка на пользователя
- `CHECK (status IN ('pending', 'processing', 'completed', 'error'))`

**Индексы:**
- `idx_mp_sync_queue_schedule` — `(priority, next_sync_at)` — для ORDER BY при выборке из очереди
- `idx_mp_sync_queue_status` — `(status)`

**RLS:** Только SELECT для пользователей. Запись — через backend (service_role).

---

### 2.17. `tg_support_sessions` -- Сессии поддержки Telegram

Каждая сессия поддержки — один обращение пользователя в Telegram бот. Lifecycle: active -> resolved/escalated -> closed.

| Столбец | Тип | Nullable | Default | Описание |
|---|---|---|---|---|
| `session_id` | `UUID` | NO | `gen_random_uuid()` | **PK** |
| `chat_id` | `BIGINT` | NO | — | Telegram chat ID |
| `user_id` | `UUID` | YES | — | FK -> `auth.users(id) ON DELETE SET NULL` |
| `status` | `VARCHAR(20)` | NO | `'active'` | `active` / `resolved` / `escalated` / `closed` |
| `created_at` | `TIMESTAMPTZ` | NO | `now()` | — |
| `last_message_at` | `TIMESTAMPTZ` | NO | `now()` | Время последнего сообщения |
| `resolved_at` | `TIMESTAMPTZ` | YES | — | Когда пользователь нажал "Вопрос решён" |
| `closed_at` | `TIMESTAMPTZ` | YES | — | Когда сессия закрыта (auto-close или CSAT) |
| `conversation_summary` | `TEXT` | YES | — | Кэшированное summary диалога (Claude Haiku) |
| `escalation_reason` | `VARCHAR(100)` | YES | — | Причина эскалации |
| `message_count` | `INT` | NO | `0` | Счётчик сообщений |
| `ai_confidence_avg` | `FLOAT` | NO | `0.0` | Средняя уверенность AI |

**Ограничения:**
- `CHECK (status IN ('active', 'resolved', 'escalated', 'closed'))`

**Индексы:**
- `idx_tg_sessions_chat_status` -- `(chat_id, status)`
- `idx_tg_sessions_status_last` -- `(status, last_message_at)`

**RLS:** `FOR ALL USING (true)` для service_role. Бот работает через backend service_role.

---

### 2.18. `tg_support_messages` -- Сообщения поддержки

Все сообщения в сессии: user, bot (AI), operator.

| Столбец | Тип | Nullable | Default | Описание |
|---|---|---|---|---|
| `id` | `BIGSERIAL` | NO | auto | **PK** |
| `session_id` | `UUID` | NO | — | FK -> `tg_support_sessions(session_id) ON DELETE CASCADE` |
| `role` | `VARCHAR(20)` | NO | — | `user` / `bot` / `operator` |
| `content` | `TEXT` | NO | — | Текст сообщения |
| `confidence` | `FLOAT` | YES | — | Уверенность AI (только для role=bot) |
| `created_at` | `TIMESTAMPTZ` | NO | `now()` | — |

**Ограничения:**
- `CHECK (role IN ('user', 'bot', 'operator'))`

**Индексы:**
- `idx_tg_messages_session` -- `(session_id, created_at)`

---

### 2.19. `tg_support_csat` -- CSAT-рейтинг

Оценка пользователя после закрытия сессии поддержки.

| Столбец | Тип | Nullable | Default | Описание |
|---|---|---|---|---|
| `id` | `SERIAL` | NO | auto | **PK** |
| `session_id` | `UUID` | NO | — | FK -> `tg_support_sessions(session_id) ON DELETE CASCADE` |
| `rating` | `INT` | NO | — | Оценка (1-5) |
| `feedback` | `TEXT` | YES | — | Текстовый отзыв |
| `created_at` | `TIMESTAMPTZ` | NO | `now()` | — |

**Ограничения:**
- `CHECK (rating >= 1 AND rating <= 5)`

---

## 3. RPC-функции

Все RPC-функции выполняются на стороне PostgreSQL через `supabase.rpc()`. Помечены как `STABLE` (не изменяют данные). Принимают `p_user_id UUID DEFAULT NULL` для multi-tenant изоляции.

### 3.1. `get_dashboard_summary`

Агрегация sales/costs/ads одним запросом.

```sql
get_dashboard_summary(
  p_date_from TEXT,
  p_date_to TEXT,
  p_marketplace TEXT DEFAULT NULL,  -- 'wb', 'ozon', 'all' или NULL
  p_user_id UUID DEFAULT NULL
) RETURNS JSON
```

**Логика:**
1. Агрегирует `mp_sales` (orders, sales, returns, revenue)
2. Агрегирует `mp_costs` (total_costs)
3. Агрегирует `mp_ad_costs` (ad_cost)
4. Считает `purchase_costs_total` = `SUM(purchase_price * sales_count)` через JOIN с `mp_products`
5. Вычисляет метрики: `buyout_percent`, `avg_check`, `net_profit`, `drr`

**Возвращает:**
```json
{
  "status": "success",
  "period": { "from": "...", "to": "..." },
  "marketplace": "all",
  "summary": {
    "orders": 150,
    "sales": 120,
    "returns": 5,
    "revenue": 250000.00,
    "buyout_percent": 80.0,
    "net_profit": 45000.00,
    "drr": 8.5,
    "ad_cost": 21250.00,
    "purchase_costs_total": 33600.00,
    "total_costs": 150150.00,
    "avg_check": 2083.33,
    "costs_breakdown": { ... }
  },
  "previous_period": { "revenue": 0, "sales": 0, "orders": 0, "revenue_change_percent": 0 }
}
```

---

### 3.2. `get_dashboard_summary_with_prev`

Summary текущего + предыдущего периодов с корректировкой Ozon-выручки.

```sql
get_dashboard_summary_with_prev(
  p_date_from TEXT,
  p_date_to TEXT,
  p_marketplace TEXT DEFAULT NULL,
  p_include_costs_tree_revenue BOOLEAN DEFAULT TRUE,
  p_user_id UUID DEFAULT NULL
) RETURNS JSON
```

**Логика:**
1. Автоматически вычисляет предыдущий период: `[date_from - N, date_from - 1]` где N = длина текущего периода.
2. Вызывает `get_dashboard_summary()` дважды (текущий + предыдущий).
3. Если `p_include_costs_tree_revenue = TRUE` — заменяет Ozon-выручку из `mp_sales` на "истинную" из `get_costs_tree()` (категория "Продажи").
4. Рассчитывает `revenue_change_percent` между периодами.

**Возвращает:** Тот же формат + `previous_period`, `prev_period`, `adjusted_revenue`.

**Зачем корректировка Ozon?** `mp_sales.revenue` содержит все заказы (включая непроведенные). `costs_tree` дает финализированную выручку из финотчета. Для точного сравнения периодов используется финализированная выручка.

---

### 3.3. `get_costs_tree`

Иерархия начислений/удержаний (как в ЛК Ozon/WB).

```sql
get_costs_tree(
  p_date_from TEXT,
  p_date_to TEXT,
  p_marketplace TEXT DEFAULT NULL,
  p_product_id UUID DEFAULT NULL,
  p_include_children BOOLEAN DEFAULT TRUE,
  p_user_id UUID DEFAULT NULL
) RETURNS JSON
```

**Логика:**
1. Проверяет наличие данных в `mp_costs_details` (приоритетный источник).
2. Если есть — строит иерархию `category → subcategory` с `json_agg`.
3. Если нет — **fallback** на `mp_costs` + `mp_sales` (упрощенное дерево из 8 категорий).
4. Рассчитывает `total_accrued` (сумма всех items), `total_revenue` (категория "Продажи"), `percent_base_sales`.

**Возвращает:**
```json
{
  "status": "success",
  "total_accrued": 180000.00,
  "total_revenue": 250000.00,
  "percent_base_sales": 250000.00,
  "source": "mp_costs_details",
  "tree": [
    { "name": "Продажи", "amount": 250000.00, "children": [...] },
    { "name": "Вознаграждение Ozon", "amount": -37500.00, "children": [...] },
    ...
  ]
}
```

**Сортировка категорий:** Фиксированный порядок (Продажи=1, Вознаграждение=2, Доставка=3, ...).

---

### 3.4. `get_costs_tree_combined`

Объединенный запрос costs-tree для WB и Ozon в одном вызове.

```sql
get_costs_tree_combined(
  p_date_from TEXT,
  p_date_to TEXT,
  p_product_id UUID DEFAULT NULL,
  p_include_children BOOLEAN DEFAULT TRUE,
  p_user_id UUID DEFAULT NULL
) RETURNS JSON
```

**Логика:** Вызывает `get_costs_tree()` дважды (для `'ozon'` и `'wb'`), объединяет результаты.

**Возвращает:**
```json
{
  "ozon": { ... },   // полный costs-tree для Ozon
  "wb": { ... },     // полный costs-tree для WB
  "period": { "from": "...", "to": "..." }
}
```

**Экономия:** 1 HTTP-запрос вместо 2 при `marketplace=all`.

---

## 4. RLS-политики

Все 18 таблиц имеют RLS. Стандартная политика для большинства таблиц:

```sql
-- SELECT
CREATE POLICY "Users see own {table}" ON mp_{table}
  FOR SELECT USING (auth.uid() = user_id);

-- INSERT
CREATE POLICY "Users insert own {table}" ON mp_{table}
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- UPDATE
CREATE POLICY "Users update own {table}" ON mp_{table}
  FOR UPDATE USING (auth.uid() = user_id);

-- DELETE
CREATE POLICY "Users delete own {table}" ON mp_{table}
  FOR DELETE USING (auth.uid() = user_id);
```

### Исключения

| Таблица | Отличие |
|---|---|
| `mp_user_subscriptions` | Только SELECT для обычных пользователей. Запись через service_role. |
| `mp_sync_queue` | Только SELECT для обычных пользователей. Запись через service_role. |
| `mp_payments` | SELECT для пользователей + `FOR ALL USING (true)` для service_role (webhook). |
| `mp_stock_snapshots` | SELECT для пользователей + `FOR ALL USING (true)` для service_role (sync). |
| `tg_support_sessions` | `FOR ALL USING (true)` для service_role. Бот работает через backend. |
| `tg_support_messages` | `FOR ALL USING (true)` для service_role. Бот работает через backend. |
| `tg_support_csat` | `FOR ALL USING (true)` для service_role. Бот работает через backend. |

### Модель безопасности

```
                 ┌─────────────────┐
Frontend ─────→  │ Supabase (anon) │ ──→ RLS фильтрует по auth.uid()
                 └─────────────────┘

                 ┌──────────────────────┐
Backend ──────→  │ Supabase (service)   │ ──→ RLS обходится, но user_id
                 │ service_role_key     │     передается ЯВНО в каждом запросе
                 └──────────────────────┘
```

---

## 5. Миграции

Все миграции хранятся в `backend/migrations/` и применяются вручную через Supabase SQL Editor.

| # | Файл | Описание | Дата |
|---|---|---|---|
| 001 | `001_initial.sql` | Создание базовых таблиц: `mp_products`, `mp_sales`, `mp_stocks`, `mp_costs`, `mp_sales_geo`, `mp_ad_costs`, `mp_sync_log`, `mp_costs_details`. Seed-данные 5 товаров. Базовые индексы. | 2026-01 |
| 002 | `002_optimized_rpc.sql` | RPC `get_costs_tree_combined`, `get_dashboard_summary_with_prev`. Составные индексы `(date, marketplace)`. | 2026-01 |
| 003 | `003_all_rpc_functions.sql` | Полные RPC: `get_dashboard_summary`, `get_costs_tree` (с fallback на mp_costs). Переписаны все 4 функции. | 2026-01 |
| 004 | `004_add_user_id.sql` | Добавление `user_id` во все таблицы. Пересоздание UNIQUE constraints с `user_id`. Индексы `(user_id)`. SaaS multi-tenant. | 2026-02 |
| 005 | `005_rls_policies.sql` | RLS на 8 таблицах: SELECT/INSERT/UPDATE/DELETE с `auth.uid() = user_id`. | 2026-02 |
| 006 | `006_rpc_with_user_id.sql` | Обновление всех 4 RPC-функций: добавлен `p_user_id UUID DEFAULT NULL`. | 2026-02 |
| 007 | `007_user_tokens.sql` | Таблица `mp_user_tokens` (Fernet encrypted API-токены). UNIQUE по user_id. RLS. | 2026-02 |
| 008 | `008_subscriptions.sql` | Таблица `mp_user_subscriptions`. Планы free/pro/business. RLS SELECT-only. Seed: admin = business. | 2026-02 |
| 009 | `009_add_ozon_sku.sql` | Колонка `ozon_sku` в `mp_products`. Seed существующих SKU. | 2026-02 |
| 010 | `010_sync_queue.sql` | Таблица `mp_sync_queue` + колонка `trigger` в `mp_sync_log`. Авто-синхронизация по расписанию. | 2026-02 |
| 011 | `011_orders.sql` | Таблица `mp_orders` — позаказная детализация. 6 индексов. RLS. | 2026-02 |
| 012 | `012_payments.sql` | Таблица `mp_payments` (YooKassa). Колонки `payment_method_id`, `auto_renew`, `expires_at` в subscriptions. | 2026-02 |
| 013 | `013_product_management.sql` | Колонки `sort_order`, `product_group_id` в `mp_products`. Partial index на group. | 2026-02 |
| 014 | `014_sales_plan.sql` | Таблица `mp_sales_plan` (per-product per-month). RLS. | 2026-02 |
| 015 | `015_sales_plan_marketplace.sql` | Колонка `marketplace` в `mp_sales_plan`. Пересоздание UNIQUE constraint. | 2026-02 |
| 016 | `016_sales_plan_summary.sql` | Таблица `mp_sales_plan_summary` (total/wb/ozon уровень). RLS. | 2026-02 |
| 017 | `017_stock_snapshots.sql` | Таблица `mp_stock_snapshots`. Ежедневные снимки остатков. 2 индекса (DESC). | 2026-02 |
| 018 | `018_fulfillment_type.sql` | Колонка `fulfillment_type VARCHAR(10) DEFAULT 'FBO'` в 6 таблицах. UNIQUE constraints обновлены. RPC с `p_fulfillment_type`. | 2026-02 |
| 019 | `019_ozon_settled_qty.sql` | Колонка `settled_qty` в `mp_costs`. Очистка дублей `mp_ad_costs` Ozon. | 2026-02 |
| 020 | `020_rpc_order_based_purchase.sql` | RPC `get_dashboard_summary` откат на order-based purchase для всех МП. | 2026-02 |
| 021 | `021_dashboard_layout.sql` | Таблица `mp_dashboard_layout` — конфигурация виджетного дашборда. | 2026-02 |
| 022 | `022_dashboard_layout_config.sql` | Расширение `mp_dashboard_layout`: config API для DnD-виджетов. | 2026-02 |
| 023 | `023_telegram_links.sql` | Таблицы `mp_telegram_links`, `mp_telegram_link_tokens` — привязка Telegram аккаунтов. | 2026-02 |
| 024 | `024_support_sessions.sql` | Таблицы `tg_support_sessions`, `tg_support_messages`, `tg_support_csat`. Сессии поддержки в Telegram. 4 индекса. RLS. | 2026-02 |

**Справочный файл:** `FULL_SCHEMA_NEW_PROJECT.sql` — объединенная схема (миграции 001-012 + RPC) для разворачивания нового проекта Supabase с нуля.

---

## 6. ER-диаграмма

```
                                    auth.users
                                        │
                        ┌───────────────┼───────────────────────────┐
                        │               │                           │
                  ┌─────┴─────┐   ┌─────┴──────┐            ┌──────┴──────┐
                  │mp_user_   │   │mp_user_    │            │mp_sync_    │
                  │tokens     │   │subscriptions│            │queue       │
                  │(1:1)      │   │(1:1)       │            │(1:1)       │
                  └───────────┘   └────────────┘            └────────────┘
                        │
                        │  user_id (все таблицы)
                        │
                  ┌─────┴─────┐
                  │mp_products│ ◄─────────────────────────────────────────┐
                  │           │                                            │
                  └─────┬─────┘                                            │
          ┌─────────────┼─────────────┬──────────────┬──────────────┐     │
          │             │             │              │              │     │
    ┌─────┴─────┐ ┌─────┴─────┐ ┌────┴─────┐ ┌─────┴─────┐ ┌─────┴────┐│
    │mp_sales   │ │mp_stocks  │ │mp_costs  │ │mp_ad_costs│ │mp_orders ││
    │(daily agg)│ │(current)  │ │(daily agg)│ │(campaigns)│ │(per-order)││
    └───────────┘ └───────────┘ └──────────┘ └───────────┘ └──────────┘│
          │                                                             │
    ┌─────┴──────────┐                                                  │
    │mp_sales_geo    │                                                  │
    │(by region)     │                                                  │
    └────────────────┘                                                  │
                                                                        │
    ┌────────────────┐  ┌──────────────┐  ┌──────────────────────┐     │
    │mp_costs_details│  │mp_stock_     │  │mp_sales_plan         │─────┘
    │(tree-view)     │  │snapshots     │  │(per-product per-MP)  │
    └────────────────┘  │(daily hist.) │  └──────────────────────┘
                        └──────────────┘
                                          ┌──────────────────────┐
    ┌────────────────┐  ┌──────────────┐  │mp_sales_plan_summary │
    │mp_payments     │  │mp_sync_log   │  │(total/wb/ozon)       │
    │(YooKassa)      │  │(audit trail) │  └──────────────────────┘
    └────────────────┘  └──────────────┘


  Связи:
  ──────  product_id → mp_products(id)    [FK, все таблицы с product_id]
  ──────  user_id → auth.users(id)        [FK, все 15 таблиц]
```

### Группы таблиц по назначению

| Группа | Таблицы | Назначение |
|---|---|---|
| **Аналитика** | `mp_sales`, `mp_costs`, `mp_costs_details`, `mp_ad_costs`, `mp_sales_geo` | Ежедневные агрегаты с МП |
| **Остатки** | `mp_stocks`, `mp_stock_snapshots` | Текущие + исторические остатки |
| **Заказы** | `mp_orders` | Позаказная детализация |
| **Планирование** | `mp_sales_plan`, `mp_sales_plan_summary` | План продаж (3 уровня) |
| **Каталог** | `mp_products` | Мастер-данные товаров |
| **Пользователи** | `mp_user_tokens`, `mp_user_subscriptions`, `mp_payments` | Учетные записи, подписки, платежи |
| **Telegram** | `tg_support_sessions`, `tg_support_messages`, `tg_support_csat` | AI-поддержка в Telegram |
| **Инфра** | `mp_sync_log`, `mp_sync_queue` | Синхронизация и логирование |

---

## 7. Индексы и производительность

### Сводка индексов (38 штук)

| Таблица | Индексов | Ключевые |
|---|---|---|
| `mp_products` | 3 | `user_id`, `sort_order`, `product_group_id` (partial) |
| `mp_sales` | 4 | `date`, `(date, marketplace)`, `user_id`, `(product_id, marketplace)` |
| `mp_stocks` | 2 | `product_id`, `user_id` |
| `mp_costs` | 4 | `date`, `(date, marketplace)`, `user_id`, `product_id` |
| `mp_costs_details` | 2 | `user_id`, `(date, marketplace)` |
| `mp_ad_costs` | 2 | `user_id`, `(date, marketplace)` |
| `mp_orders` | 6 | `user_id`, `(user_id, order_date)`, `(user_id, status)`, и др. |
| `mp_stock_snapshots` | 2 | `(user_id, date DESC)`, `(user_id, product_id, marketplace, date DESC)` |
| `mp_sales_plan` | 1 | `(user_id, month, marketplace)` |
| `mp_sales_plan_summary` | 1 | `(user_id, month)` |
| `mp_sales_geo` | 1 | `user_id` |
| `mp_user_tokens` | 1 | `user_id` |
| `mp_user_subscriptions` | 2 | `user_id`, `plan` |
| `mp_sync_queue` | 2 | `(priority, next_sync_at)`, `status` |
| `mp_sync_log` | 1 | `user_id` |
| `mp_payments` | 2 | `yookassa_payment_id`, `user_id` |
| `tg_support_sessions` | 2 | `(chat_id, status)`, `(status, last_message_at)` |
| `tg_support_messages` | 1 | `(session_id, created_at)` |
| `tg_support_csat` | 0 | FK constraint на session_id |

### Стратегия индексирования

1. **UNIQUE constraints как индексы.** Каждый UNIQUE constraint автоматически создает B-tree индекс. Используются для upsert (`ON CONFLICT`).
2. **Составные индексы `(date, marketplace)`.** Оптимизируют RPC-функции, которые фильтруют по дате и МП одновременно.
3. **Partial index** на `product_group_id` — только WHERE NOT NULL (экономит место, ускоряет lookup групп).
4. **DESC-индексы** на `mp_stock_snapshots` — оптимизированы для выборки последних данных (ORDER BY date DESC).
5. **Приоритетный индекс** `(priority, next_sync_at)` на `mp_sync_queue` — для выборки следующего задания в очереди.

### Оптимизация запросов через RPC

RPC-функции выполняют 3-5 запросов **на стороне PostgreSQL** (в одном round-trip), вместо 3-5 HTTP-запросов от клиента:

| Паттерн | HTTP-запросов | С RPC |
|---|---|---|
| Dashboard summary | 4 (sales + costs + ads + products) | **1** (`get_dashboard_summary`) |
| Summary + prev period | 8 | **1** (`get_dashboard_summary_with_prev`) |
| Costs-tree WB + Ozon | 2 | **1** (`get_costs_tree_combined`) |

---

## 8. Формулы и бизнес-логика

### Прибыль (Dashboard) — актуально с 19.02.2026

```
profit = total_payout - purchase - ads

где:
  total_payout = costs_tree.total_accrued (сумма всех items)
  purchase     = purchase_price * sales_count  (RAW, без коэффициента)
  ads          = ad_cost

// costsTreeRatio УДАЛЁН 19.02.2026
// Историческая формула: purchase_adjusted = purchase * (costs_tree_SALES / mp_sales_revenue)
```

### Прибыль (Unit Economics, per product) — актуально с 19.02.2026

```
profit_i = total_payout * (revenue_i / SUM(revenue)) - purchase_i - ad_i

где:
  revenue_i  = mp_sales.revenue для товара i
  purchase_i = purchase_price_i * sales_count_i  (RAW)
  share      = revenue_i / SUM(all revenue)
  Гарантия: SUM(profit_i) = Dashboard profit
```

### Выручка (отображаемая)

```
WB:   displayed_revenue = costs_tree["Продажи"] + credits (СПП, возмещения)
OZON: displayed_revenue = costs_tree["Продажи"] (нет credits)
```

### ДРР (Доля рекламных расходов)

```
DRR = ad_cost / revenue * 100%
```

### Прогноз остатков

```
days_remaining = total_quantity / avg_daily_sales(30d)
avg_daily_sales = SUM(sales_count за 30 дней) / 30
```

### Конверсия (выкуп)

```
buyout_percent = sales_count / orders_count * 100%
```

### План продаж — completion

```
Приоритет: total plan > SUM(MP plans) > SUM(product plans)

actual = SUM(mp_sales.revenue) ТОЛЬКО за месяцы с планом
completion = actual / plan * 100%

forecast = actual + pace_daily * days_remaining
pace_daily = actual / days_elapsed
```

---

> Документ сгенерирован на основе 24 миграций, 4 RPC-функций и backend-кода проекта Analytics Dashboard. Обновлено: 25.02.2026.
