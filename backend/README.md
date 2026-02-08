# Analytics Dashboard Backend

Backend API для аналитики продаж на маркетплейсах Wildberries и Ozon.

## Технологии

- **Python 3.14**
- **FastAPI** - веб-фреймворк
- **Supabase (PostgreSQL)** - база данных
- **httpx** - асинхронные HTTP запросы к API маркетплейсов
- **Pydantic** - валидация данных

## Структура проекта

```
backend/
├── app/
│   ├── api/
│   │   └── v1/
│   │       ├── products.py      # Эндпоинты для товаров
│   │       ├── dashboard.py     # Эндпоинты для дашборда
│   │       ├── sync.py          # Эндпоинты для синхронизации
│   │       ├── export.py        # PDF экспорт (Playwright)
│   │       ├── tokens.py        # CRUD API-токенов пользователей (Phase 2)
│   │       └── subscription.py  # Subscription management (Phase 3)
│   ├── services/
│   │   ├── wb_client.py         # Клиент Wildberries API
│   │   ├── ozon_client.py       # Клиент Ozon API + Performance
│   │   └── sync_service.py      # Сервис синхронизации данных (с user_id + _load_tokens)
│   ├── db/
│   │   └── supabase.py          # Подключение к Supabase
│   ├── models/                  # Pydantic модели
│   ├── auth.py                  # JWT middleware (JWKS, ES256+HS256, cron auth)
│   ├── crypto.py                # Fernet encrypt/decrypt для токенов
│   ├── plans.py                 # Subscription plans config (Phase 3)
│   ├── subscription.py          # Subscription dependencies (Phase 3)
│   ├── config.py                # Settings (+ sync_cron_secret, fernet_key)
│   └── main.py                  # Точка входа FastAPI (CORS restricted)
├── migrations/
│   ├── 001_initial.sql          # SQL схема базы данных
│   ├── 002_optimized_rpc.sql    # RPC функции (get_dashboard_summary, get_costs_tree)
│   ├── 004_add_user_id.sql      # user_id во все таблицы + UNIQUE constraints
│   ├── 005_rls_policies.sql     # RLS ENABLE + CRUD-политики
│   ├── 006_rpc_with_user_id.sql # p_user_id во все RPC
│   ├── 007_user_tokens.sql      # mp_user_tokens + RLS
│   └── 008_subscriptions.sql    # mp_user_subscriptions + RLS (Phase 3)
├── tests/
├── venv/                        # Виртуальное окружение
├── requirements.txt             # + playwright, PyJWT[crypto]
├── test_api.py                  # Тест подключения к API МП
└── test_sync.py                 # Тест синхронизации
```

## Установка и запуск

### 1. Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Переменные окружения

Файл `.env` в корне проекта (`Analitics/`):

```env
# Wildberries
WB_API_TOKEN=your_wb_token

# Ozon Seller API
OZON_CLIENT_ID=your_client_id
OZON_API_KEY=your_api_key

# Ozon Performance API (реклама)
OZON_PERFORMANCE_CLIENT_ID=your_perf_client_id
OZON_PERFORMANCE_CLIENT_SECRET=your_perf_secret

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Auth (Phase 1)
SYNC_CRON_SECRET=your_cron_secret    # для cron auth (X-Cron-Secret header)

# Encryption (Phase 2)
FERNET_KEY=your_fernet_key           # для шифрования токенов пользователей

# App
DEBUG=true
SECRET_KEY=your-secret-key
FRONTEND_URL=http://localhost:5173   # для PDF экспорта
```

### 3. Инициализация базы данных

```bash
# Выполните migrations/001_initial.sql в Supabase SQL Editor
# Опционально: 002_optimized_rpc.sql для RPC функций оптимизации
```

### 4. Запуск сервера

```bash
uvicorn app.main:app --reload --port 8000
```

**Сервер:** http://localhost:8000 **Swagger:** http://localhost:8000/docs

---

## Auth & Security (SaaS Phase 1+2)

### JWT Middleware (auth.py)
- JWKS верификация через PyJWKClient (ES256 + HS256 fallback)
- `get_current_user(authorization)` → CurrentUser(user_id, email)
- `get_current_user_or_cron(authorization, x_cron_secret, x_cron_user_id)` — для cron jobs
- Все endpoints защищены (кроме `/`, `/health`, `/docs`)
- CORS ограничен: `analitics.bixirun.ru` + `localhost:5173`

### Cron Auth
- НЕ JWT — вместо этого X-Cron-Secret + X-Cron-User-Id headers
- SYNC_CRON_SECRET в .env

### Token Encryption (crypto.py, Phase 2)
- Fernet symmetric encryption (cryptography library)
- FERNET_KEY в .env → config.py
- Функции: `encrypt_token(value)`, `decrypt_token(encrypted)`

### Tokens API (tokens.py, Phase 2)
- `GET /api/v1/tokens` — статус (has_wb, has_ozon_seller, has_ozon_perf) — booleans
- `PUT /api/v1/tokens` — сохранить/обновить (encrypt before store, upsert)
- `POST /api/v1/tokens/validate` — проверить токены через API МП
- `POST /api/v1/tokens/save-and-sync` — сохранить + sync_all(days_back=30)

### Subscription System (Phase 3)

**Тарифы (plans.py):**
- `free` — 3 SKU, WB only, без auto-sync, без unit-economics/ads/pdf/period-comparison
- `pro` (990₽/мес) — 20 SKU, WB+Ozon, auto-sync 6h, все фичи кроме API
- `business` (2990₽/мес) — unlimited SKU, WB+Ozon, auto-sync 2h, все фичи

**subscription.py — FastAPI Dependencies:**
- `get_user_subscription` — Depends(), загружает подписку из БД (lazy-create `free`)
- `get_subscription_or_cron` — для cron endpoints (cron = bypass)
- `require_feature(feature)` — dependency factory, возвращает 403 если фича недоступна

**Feature gates на endpoints:**
- `dashboard/unit-economics` → `require_feature("unit_economics")`
- `dashboard/ad-costs` → `require_feature("ads_page")`
- `dashboard/costs-tree` → принудительно `include_children=False` для Free
- `dashboard/summary` → silently disable `include_prev_period` без `period_comparison`
- `export/pdf` → `require_feature("pdf_export")`
- `sync/*` → marketplace restriction via `allowed_mps`

**Subscription API (subscription.py router):**
- `GET /subscription` — текущий план + лимиты + SKU usage
- `GET /subscription/plans` — все планы для UI сравнения
- `PUT /subscription` — admin-only смена тарифа

### SyncService._load_tokens (Phase 2)
- Запрашивает mp_user_tokens по user_id
- Дешифрует каждое поле через Fernet
- Fallback на .env per-field если DB пустое
- Создаёт API клиенты с resolved токенами

---

## Production: ежедневная синхронизация (07:00)

Backend **не** запускает синк сам по расписанию. Рекомендованный вариант —
внешний scheduler/cron, который дергает HTTP endpoint.

### Почему так

- Нет дублей при нескольких воркерах/репликах backend
- Прозрачные логи/ретраи на уровне инфраструктуры

### Cron пример (каждый день в 07:00)

```bash
0 7 * * * curl -fsS --retry 3 --retry-delay 10 --max-time 600 -X POST "https://<YOUR_BACKEND_HOST>/api/v1/sync/sales?days_back=14&marketplace=all" -H "X-Sync-Token: <SYNC_TOKEN>" >/dev/null
```

### Важно про WB (чтобы не “плыли” дашборды)

- `mp_sales` (продажи) и `mp_costs_details` (WB costs-tree / “К перечислению”) —
  **разные источники**.
- Если обновить только `sync/sales`, а `sync/costs` для WB не обновлять, то:
  - графики/плашки (из `mp_sales`) и карточка начислений WB (из
    `mp_costs_details`) могут расходиться.
- Практика: либо регулярно гонять `sync/costs?marketplace=wb&days_back=14`, либо
  использовать `sync/all`.

## API Endpoints

### Products (Товары)

#### `GET /api/v1/products`

Список всех товаров.

| Параметр    | Тип               | Описание     |
| ----------- | ----------------- | ------------ |
| marketplace | string (optional) | `wb`, `ozon` |

#### `GET /api/v1/products/{product_id}`

Товар по UUID.

#### `GET /api/v1/products/barcode/{barcode}`

Товар по штрихкоду.

---

### Dashboard (Аналитика)

#### `GET /api/v1/dashboard/summary`

Сводка метрик за период. Включает orphan-costs фильтрацию (удержания только по
товарам с продажами).

| Параметр    | Тип    | По умолчанию | Описание                    |
| ----------- | ------ | ------------ | --------------------------- |
| date_from   | date   | -30 дней     | Начало периода (YYYY-MM-DD) |
| date_to     | date   | сегодня      | Конец периода               |
| marketplace | string | all          | `wb`, `ozon`, `all`         |
| product_id  | string | -            | UUID товара                 |

**Ответ включает:** orders, sales, returns, revenue, net_profit, drr, ad_cost,
total_costs, avg_check, costs_breakdown (commission, logistics, storage,
penalties, acquiring, other).

#### `GET /api/v1/dashboard/sales-chart`

Данные продаж по дням для графика.

| Параметр                        | Тип               | Описание           |
| ------------------------------- | ----------------- | ------------------ |
| date_from, date_to, marketplace | -                 | Аналогично summary |
| product_id                      | string (optional) | Фильтр по товару   |

**Ответ:** массив `{date, orders, sales, revenue, avg_check}` по дням.

#### `GET /api/v1/dashboard/costs-tree`

Иерархическая детализация удержаний (tree-view как в ЛК Ozon). Данные из таблицы
`mp_costs_details`.

| Параметр                        | Тип               | Описание           |
| ------------------------------- | ----------------- | ------------------ |
| date_from, date_to, marketplace | -                 | Аналогично summary |
| product_id                      | string (optional) | Фильтр по товару   |

**Ответ:**

```json
{
  "status": "success",
  "marketplace": "ozon",
  "period": { "from": "2026-01-16", "to": "2026-01-23" },
  "total_accrued": 4513.53,
  "total_revenue": 12907.0,
  "percent_base_sales": 8432.0,
  "tree": [
    {
      "name": "Продажи",
      "amount": 8432.0,
      "percent": null,
      "children": [
        { "name": "Выручка", "amount": 8432.0 }
      ]
    },
    {
      "name": "Вознаграждение Ozon",
      "amount": -2367.5,
      "percent": 18.3,
      "children": [
        { "name": "Витамины", "amount": -2091.76 },
        { "name": "Прочее", "amount": -275.74 }
      ]
    },
    {
      "name": "Услуги доставки",
      "amount": -848.23,
      "percent": 6.6,
      "children": [
        { "name": "Логистика", "amount": -848.23 }
      ]
    },
    {
      "name": "Услуги агентов",
      "amount": -224.47,
      "percent": 1.7,
      "children": [
        { "name": "Эквайринг", "amount": -182.28 },
        { "name": "Звёздные товары", "amount": -42.19 }
      ]
    },
    {
      "name": "Услуги FBO",
      "amount": -521.34,
      "percent": 4.0,
      "children": [
        { "name": "Размещение товаров", "amount": -521.34 }
      ]
    },
    {
      "name": "Продвижение и реклама",
      "amount": -28.43,
      "percent": 0.2,
      "children": [
        { "name": "Бонусы продавца", "amount": -28.43 }
      ]
    }
  ]
}
```

**Маппинг operation_type → category:**

| Ozon operation_type                                        | Категория                                                   | Подкатегория                                                                                      |
| ---------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| OperationAgentDeliveredToCustomer                          | Продажи + Вознаграждение + Услуги доставки + Услуги агентов | Выручка / Витамины/Прочее (группировка проекта) / Логистика / Доставка до места выдачи (LastMile) |
| OperationItemReturn                                        | Услуги доставки                                             | Возвраты                                                                                          |
| MarketplaceRedistributionOfAcquiringOperation              | Услуги агентов                                              | Эквайринг                                                                                         |
| StarsMembership                                            | Услуги агентов                                              | Звёздные товары                                                                                   |
| OperationMarketplaceServicePremiumCashbackIndividualPoints | Продвижение и реклама                                       | Бонусы продавца                                                                                   |
| OperationMarketplaceServiceStorage                         | Услуги FBO                                                  | Размещение товаров                                                                                |

Примечания:

- `%` в `tree[].percent` считается **как в ЛК Ozon**: от суммы категории
  **"Продажи"** (если есть), иначе fallback на `total_revenue`.
- Для операций с несколькими `items[]` order-level суммы распределяются по
  товарам пропорционально `quantity`, чтобы избежать мультипликации.
- Для операций без `items[]` (например, склад/размещение) распределение делается
  в копейках так, чтобы сумма распределения совпадала с исходной до 0.01 ₽.

#### `GET /api/v1/dashboard/unit-economics`

Unit-экономика по товарам.

#### `GET /api/v1/dashboard/stocks`

Текущие остатки по складам.

Особенности:

- Для WB остатки синхронизируются из `statistics-api` `/api/v1/supplier/stocks`.
  Чтобы получить **полный срез "как в ЛК WB"**, `dateFrom` должен быть
  максимально ранним (например `2019-06-20`). При свежем `dateFrom` WB может
  вернуть **только изменения**, из-за чего часть складов (например,
  "Электросталь") будет отсутствовать в ответе.
- `quantity` для WB — это **available/free stock** (сколько можно добавить в
  корзину).
- Ответ `/dashboard/stocks` включает служебные поля обновления:
  `last_updated_at` на товаре и `updated_at` на уровне склада (если backend
  новой версии).

#### `GET /api/v1/dashboard/ad-costs`

Рекламные расходы по дням.

---

### Sync (Синхронизация)

#### `POST /api/v1/sync/products`

Синхронизация товаров (обновление WB/Ozon ID по штрихкоду).

#### `POST /api/v1/sync/sales`

Синхронизация продаж.

| Параметр    | По умолчанию | Описание            |
| ----------- | ------------ | ------------------- |
| days_back   | 35           | Количество дней     |
| marketplace | all          | `wb`, `ozon`, `all` |

#### `POST /api/v1/sync/stocks`

Синхронизация остатков.

#### `GET /api/v1/sync/stocks/check`

Диагностика остатков (сверка источника маркетплейса vs `mp_stocks`).

Параметры:

| Параметр    | По умолчанию | Описание                                 |
| ----------- | ------------ | ---------------------------------------- |
| marketplace | wb           | Пока реализовано только для `wb`         |
| days_back   | 365          | Окно `dateFrom` для WB stocks (override) |

#### `POST /api/v1/sync/costs`

Синхронизация удержаний (агрегация в mp_costs + детализация в mp_costs_details).

| Параметр    | По умолчанию | Описание            |
| ----------- | ------------ | ------------------- |
| days_back   | 30           | Количество дней     |
| marketplace | all          | `wb`, `ozon`, `all` |

#### `POST /api/v1/sync/ads`

Синхронизация рекламных расходов.

| Параметр    | По умолчанию | Описание            |
| ----------- | ------------ | ------------------- |
| days_back   | 7            | Количество дней     |
| marketplace | all          | `wb`, `ozon`, `all` |

#### `POST /api/v1/sync/all`

Полная синхронизация всех данных.

#### `GET /api/v1/sync/logs`

Логи синхронизаций (последние N записей).

---

## База данных (Supabase)

### Таблицы

#### `mp_products` (Товары)

Мастер-данные с идентификаторами МП.

| Поле            | Тип           | Описание                              |
| --------------- | ------------- | ------------------------------------- |
| id              | UUID          | PK                                    |
| barcode         | VARCHAR(20)   | Штрихкод (уникальный, связь между МП) |
| name            | VARCHAR(255)  | Название                              |
| purchase_price  | DECIMAL(10,2) | Закупочная цена                       |
| wb_nm_id        | BIGINT        | Wildberries nmID                      |
| wb_vendor_code  | VARCHAR(50)   | WB артикул                            |
| ozon_product_id | BIGINT        | Ozon product_id                       |
| ozon_offer_id   | VARCHAR(50)   | Ozon offer_id (= barcode)             |

#### `mp_sales` (Продажи)

Ежедневная агрегация. Unique: `(product_id, marketplace, date)`.

| Поле          | Тип           | Описание         |
| ------------- | ------------- | ---------------- |
| product_id    | UUID          | FK → mp_products |
| marketplace   | VARCHAR(20)   | `wb` / `ozon`    |
| date          | DATE          | Дата             |
| orders_count  | INTEGER       | Заказы           |
| sales_count   | INTEGER       | Выкупы           |
| returns_count | INTEGER       | Возвраты         |
| revenue       | DECIMAL(12,2) | Выручка          |

#### `mp_stocks` (Остатки)

Unique: `(product_id, marketplace, warehouse)`.

| Поле        | Тип          | Описание                                                                      |
| ----------- | ------------ | ----------------------------------------------------------------------------- |
| product_id  | UUID         | FK → mp_products                                                              |
| marketplace | VARCHAR(20)  | `wb` / `ozon`                                                                 |
| warehouse   | VARCHAR(100) | Название склада                                                               |
| quantity    | INTEGER      | Количество (WB: **доступно к продаже** / `quantity` из WB `/supplier/stocks`) |
| updated_at  | timestamptz  | Время последнего обновления (заполняется при sync)                            |

#### `mp_costs` (Удержания — агрегация)

Ежедневная агрегация по 7 типам. Unique: `(product_id, marketplace, date)`.

| Поле        | Тип           | Описание                       |
| ----------- | ------------- | ------------------------------ |
| product_id  | UUID          | FK → mp_products               |
| marketplace | VARCHAR(20)   | `wb` / `ozon`                  |
| date        | DATE          | Дата                           |
| commission  | DECIMAL(10,2) | Комиссия МП                    |
| logistics   | DECIMAL(10,2) | Логистика                      |
| storage     | DECIMAL(10,2) | Хранение                       |
| promotion   | DECIMAL(10,2) | Продвижение                    |
| penalties   | DECIMAL(10,2) | Штрафы                         |
| acquiring   | DECIMAL(10,2) | Эквайринг                      |
| other_costs | DECIMAL(10,2) | Прочее                         |
| total_costs | DECIMAL(10,2) | **Computed:** сумма всех полей |

**Orphan-costs фильтрация:** Dashboard API исключает costs по товарам без продаж
в выбранном периоде.

#### `mp_costs_details` (Удержания — детализация) **[НОВАЯ]**

Гранулярные транзакции для tree-view. Unique:
`(product_id, marketplace, date, category, subcategory)`.

| Поле           | Тип           | Описание                                                      |
| -------------- | ------------- | ------------------------------------------------------------- |
| product_id     | UUID          | FK → mp_products                                              |
| marketplace    | VARCHAR(20)   | `wb` / `ozon`                                                 |
| date           | DATE          | Дата                                                          |
| category       | VARCHAR(100)  | Категория: "Вознаграждение Ozon", "Услуги доставки" и т.д.    |
| subcategory    | VARCHAR(150)  | Подкатегория: "Логистика", "Эквайринг", "Звёздные товары"     |
| amount         | DECIMAL(10,2) | Сумма (отрицательная = удержание, положительная = начисление) |
| operation_type | VARCHAR(100)  | Сырое значение из API (для отладки)                           |
| operation_id   | VARCHAR(100)  | ID транзакции из API                                          |

**Иерархия Ozon:**

```
Продажи
├── Выручка
├── Баллы за скидки
└── Программы партнёров

Вознаграждение Ozon (commission)
├── Витамины            ← аналитическая группировка проекта (не тариф Ozon)
└── Прочее

Услуги доставки (logistics)
└── Логистика

Услуги агентов (acquiring + other)
├── Эквайринг
├── Звёздные товары
└── Доставка до места выдачи

Услуги FBO (storage)
└── Складские услуги
    └── Размещение товаров на складах Ozon

Продвижение и реклама (promotion)
└── Бонусы продавца
```

#### `mp_ad_costs` (Рекламные расходы)

Unique: `(product_id, marketplace, date, campaign_id)`.

| Поле          | Тип           | Описание         |
| ------------- | ------------- | ---------------- |
| product_id    | UUID          | FK → mp_products |
| marketplace   | VARCHAR(20)   | `wb` / `ozon`    |
| date          | DATE          | Дата             |
| campaign_id   | VARCHAR(50)   | ID кампании      |
| campaign_name | VARCHAR(255)  | Название         |
| impressions   | INTEGER       | Показы           |
| clicks        | INTEGER       | Клики            |
| cost          | DECIMAL(10,2) | Расход           |

#### `mp_user_tokens` (API-токены пользователей, Phase 2)

Зашифрованные токены, one row per user. Unique: `(user_id)`.

| Поле                | Тип         | Описание                          |
| ------------------- | ----------- | --------------------------------- |
| user_id             | UUID        | FK → auth.users, UNIQUE           |
| wb_api_token        | TEXT (null) | Fernet-encrypted WB token         |
| ozon_client_id      | TEXT (null) | Fernet-encrypted Ozon Client ID   |
| ozon_api_key        | TEXT (null) | Fernet-encrypted Ozon API Key     |
| ozon_perf_client_id | TEXT (null) | Fernet-encrypted Ozon Perf Client |
| ozon_perf_secret    | TEXT (null) | Fernet-encrypted Ozon Perf Secret |

RLS: 4 политики (SELECT/INSERT/UPDATE/DELETE WHERE auth.uid() = user_id).

#### `mp_user_subscriptions` (Подписки пользователей, Phase 3)

Один тариф на пользователя. Unique: `(user_id)`.

| Поле       | Тип         | Описание                                      |
| ---------- | ----------- | --------------------------------------------- |
| user_id    | UUID        | FK → auth.users, UNIQUE                       |
| plan       | TEXT        | `free` / `pro` / `business`                   |
| status     | TEXT        | `active` / `cancelled` / `expired`            |
| started_at | TIMESTAMPTZ | Начало подписки                               |
| expires_at | TIMESTAMPTZ | NULL = без срока (free / admin-managed)       |
| changed_by | TEXT        | Email админа, изменившего тариф               |

RLS: SELECT own row only. INSERT/UPDATE — через service_role (backend).

#### `mp_sales_geo` (География продаж)

#### `mp_sync_log` (Логи синхронизации)

**Все таблицы (кроме mp_user_tokens) имеют:**
- `user_id UUID NOT NULL REFERENCES auth.users(id)` — добавлен в Phase 1
- RLS ENABLE + политики `auth.uid() = user_id`
- UNIQUE constraints включают user_id

**RPC функции:** 4 функции с `p_user_id` параметром:
- `get_dashboard_summary`, `get_costs_tree`, `get_costs_tree_combined`, `get_dashboard_summary_with_prev`

---

## Архитектура

### Сервисы синхронизации

`SyncService` (sync_service.py):

| Метод                                 | Описание                                |
| ------------------------------------- | --------------------------------------- |
| sync_products()                       | Обновление WB/Ozon ID по штрихкоду      |
| sync_sales_wb() / sync_sales_ozon()   | Продажи (по дням, 35 дней)              |
| sync_stocks_wb() / sync_stocks_ozon() | Остатки по складам                      |
| sync_costs_wb() / sync_costs_ozon()   | Удержания → mp_costs + mp_costs_details |
| sync_ads_wb() / sync_ads_ozon()       | Рекламные расходы                       |
| sync_all()                            | Полная синхронизация                    |

### API клиенты

#### WildberriesClient (wb_client.py)

- Content API: карточки товаров
- Statistics API: продажи, заказы, остатки
- Analytics API: воронка продаж
- Ads API: кампании, статистика
- Finance API: `get_report_detail()` → удержания

#### OzonClient (ozon_client.py)

- `/v3/product/list` — товары
- `/v3/product/info/list` — детальная информация
- `/v4/product/info/stocks` — остатки (часто FBS / “Мои склады”, может
  возвращать items=0 при FBO-only)
- `/v2/analytics/stock_on_warehouses` — остатки на складах Ozon (FBO / “Склад
  Ozon”, основной источник для FBO)
- `/v3/finance/transaction/list` — финансовые транзакции (удержания)
- `/v1/analytics/data` — аналитика продаж (dimensions=["sku","day"])

#### OzonPerformanceClient (ozon_client.py)

- OAuth 2.0 аутентификация
- `/api/client/campaign` — кампании
- `/api/client/statistics` — статистика (UUID-based async + CSV)

### Supabase RPC (оптимизация)

Для ускорения загрузки дашборда используются RPC функции:

| Функция                 | Описание                                          |
| ----------------------- | ------------------------------------------------- |
| `get_dashboard_summary` | Агрегирует sales/costs/ads одним запросом         |
| `get_costs_tree`        | Строит иерархию удержаний на стороне PostgreSQL   |

**Индексы:**
- `idx_mp_sales_date_mp` — для быстрой фильтрации продаж
- `idx_mp_costs_date_mp` — для быстрой фильтрации удержаний
- `idx_mp_costs_details_date_mp` — для tree-view
- `idx_mp_ad_costs_date_mp` — для рекламных расходов

SQL миграция: `migrations/002_optimized_rpc.sql`

### Поток данных удержаний

```
WB: get_report_detail()
    → reportDetailByPeriod (источник истины “как в ЛК”)
    → ключевые поля: retail_amount, ppvz_for_pay, ppvz_vw, ppvz_vw_nds, acquiring_fee,
      delivery_rub, storage_fee, penalty, rebill_logistic_cost, ppvz_reward, deduction, acceptance, cashback_*
    → sync_sales_wb()/sync_costs_wb()
    → mp_sales (выручка/выкупы по rr_dt) + mp_costs (агрегация) + mp_costs_details (детализация)
    → Важно: строки без привязки к товару (nm_id/barcode отсутствуют или не замаплены)
      пишутся в системный товар `WB_ACCOUNT` ("WB: вне разреза товаров"), чтобы totals сходились 1-в-1.

Ozon: get_finance_transaction_list()
    → operation_type (русский текст), amount, items[].sku
    → sync_costs_ozon()
    → mp_costs (агрегация по ключевым словам) + mp_costs_details (category/subcategory)

Dashboard API:
    → mp_costs (для карточек/графиков, с orphan-costs фильтрацией)
    → mp_costs_details (для tree-view детализации)
```

---

## Reconcile (контроль точности “как в ЛК”)

Инструменты контроля не являются production-кодом: они нужны, чтобы быстро
ловить регрессы при изменениях WB/Ozon отчётов.

- Ozon: `ozon/reconcile_accruals.py` + `ozon/RECONCILE.md`
- WB: `wb/reconcile_wb.py` + `wb/RECONCILE.md`

Рекомендуемый процесс: **раз в 1–2 месяца** сохранять свежие выгрузки из ЛК
(эталон) и прогонять reconcile против API.

---

## Данные (актуально на 30.01.2026)

| Таблица          | WB                   | Ozon                                          |
| ---------------- | -------------------- | --------------------------------------------- |
| mp_products      | 5 товаров            | 5 товаров                                     |
| mp_sales         | ~51 запись (35 дней) | 43 записи (35 дней)                           |
| mp_stocks        | 2 склада             | FBO склады (из Analytics stock_on_warehouses) |
| mp_costs         | ~46 записей          | 53 записи (30 дней)                           |
| mp_costs_details | Детализация WB       | 353 записи (детализация удержаний)            |
| mp_ad_costs      | 1 запись (0.18₽)     | 0 (кампании неактивны)                        |

**Ozon finance API:** 291 операция за 30 дней (5 типов: Доставка, Звёздные товары, Бонусы, Эквайринг, Хранение)

---

## Troubleshooting

### Supabase "Legacy API keys are disabled"

Обновить ключи в `.env` (Settings → API в Supabase Dashboard).

### Ozon 404

API обновлён: v2→v3 (products), v3→v4 (stocks). Клиент актуален.

### Ozon costs = 0 (устаревшая проблема)

Ранее Finance API не возвращал транзакций. Сейчас синхронизация работает корректно:
- 53 записи в `mp_costs` (агрегация)
- 353 записи в `mp_costs_details` (детализация)
- Если всё равно 0 — проверить в ЛК Ozon раздел "Начисления".

### Ozon FBO остатки не видны (в ЛК есть “Склад Ozon”, а API stocks пустые)

Если `POST /api/v1/sync/stocks?marketplace=ozon` возвращает `records=0`, а в ЛК
видны остатки на “Склад Ozon”:

- Это типичный кейс **FBO-only**: `/v4/product/info/stocks` может отдавать
  только FBS (“Мои склады”) или `items=0`.
- В проекте для FBO используется fallback через
  **`POST /v2/analytics/stock_on_warehouses`**.
- Проверь, что sync ответ содержит
  `"source": "v2/analytics/stock_on_warehouses"`.
- Проверь выдачу: `GET /api/v1/dashboard/stocks?marketplace=ozon` (должны быть
  склады РФЦ и количества = `free_to_sell_amount`).

### Orphan-costs на дашборде

Если costs показывают завышенные значения — это storage/logistics за период без
продаж. Dashboard фильтрует по product_id с продажами в выбранном периоде.

---

## Деплой

```bash
# Production
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4

# Или с Gunicorn
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

CORS: настроить `allow_origins` в `app/main.py` для production домена.
