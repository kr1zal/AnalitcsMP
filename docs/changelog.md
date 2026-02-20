# Changelog -- Analytics Dashboard (RevioMP)

> Обратный хронологический порядок. Полная архитектура: [architecture.md](architecture.md).
> Формулы и бизнес-логика: [business-logic.md](business-logic.md).

---

## [Unreleased]
- PDF export improvements (Playwright backend)
- Hide Business tier, SEO index.html, admin ID -> config

---

## 2026-02-20

### Bugfix: WB Ads sync — агрегация по appType
- **Проблема:** WB API `/adv/v2/fullstats` возвращает метрики разбитые по appType (Поиск/Каталог/Карточка). Upsert перезаписывал данные → оставался только последний appType (35₽ вместо 118₽)
- **Фикс:** агрегация views/clicks/cost/orders по всем appType для одного nmId перед upsert
- Очистка orphan-записей с несуществующими product_id

### UE FBO/FBS Breakdown в MpCard
- **Backend**: `fulfillment_breakdown` для ВСЕХ товаров с продажами (не только FBS)
- Feature gate: `fbs_analytics` (Pro+ план). Free план не получает breakdown и ft-фильтрацию
- Реклама распределяется пропорционально: `ad_ft = ad × (ft_revenue / total_revenue)`
- **Frontend UI**: два режима FtRow — single (без шкалы) и dual (с долей выручки)
- Benchmark цвета маржинальности: ≥25% emerald, ≥15% sky, ≥10% amber, ≥5% orange, <5% red
- Корректное naming: "маржинальность" (не "маржа"), "доля выручки" в заголовке шкалы
- FBO% + FBS% = 100% (base = sum ft-revenue, не costs-tree revenue)
- UE header: badge FBO/FBS + tooltip про рекламу (account-level)

---

## 2026-02-20

### FBS Sync Pipeline
- **Migration 018**: `fulfillment_type VARCHAR(10) DEFAULT 'FBO'` в 6 таблицах (mp_sales, mp_costs, mp_costs_details, mp_orders, mp_stocks, mp_stock_snapshots)
- Unique constraints обновлены: все включают `fulfillment_type`
- RPC функции обновлены с параметром `p_fulfillment_type`
- `_determine_wb_fulfillment(row)`: определяет FBO/FBS из WB reportDetail (isSupply → delivery_type_id → default FBO)
- **sync_sales_wb**: группировка по `(nm_id, date, ft)` вместо `(nm_id, date)`
- **sync_costs_wb**: ключи costs_agg, details_agg, payout_by_key включают ft; балансировка per (pid, date, ft)
- **sync_orders_wb**: fulfillment_type из шага 3 (reportDetail enrichment)
- **sync_costs_ozon**: FBS из `posting.delivery_schema` в finance transactions
- Не затронуты: sync_sales_ozon (Ozon Analytics API без FBS breakdown), sync_stocks_wb (нет FBS поля)
- sync_stocks_ozon и sync_orders_ozon — уже корректно обрабатывали FBO/FBS

---

## 2026-02-19

### Удаление costsTreeRatio из расчёта прибыли
- **BREAKING CHANGE (бизнес-логика):** costsTreeRatio удалён из расчёта закупки
- Новая формула: `profit = payout - purchase - ads`, где `purchase = purchase_price * sales_count` (RAW)
- До этого: `purchase_adjusted = purchase * (costs_tree_SALES / mp_sales_revenue)` — пропорциональная коррекция на долю проведённых заказов
- Backend возвращает поле `costs_tree_ratio` в `/dashboard/unit-economics` для обратной совместимости (значение не применяется)
- Обновлена документация: architecture.md (правило #10, #18), business-logic.md (разделы 2, 4, 5), database.md, README.md, api-reference.md, frontend-guide.md, phases-history.md

---

## 2026-02-18

### Sales Plan Audit & Fixes
- 6 багфиксов P1: completion inflation (active_mps), wbPlanMap actual mismatch, footer weighted avg, FeatureGate, SaveInput data loss, consistency warnings
- Вынос "План продаж" в отдельный таб Settings (`PlanTab.tsx`)
- URL: `/settings?tab=plan`

### Enterprise Settings
- Объединение SyncPage + SettingsPage-монолит + аккаунт-блок в единую `/settings` с табами
- 5 табов: Подключения | Товары | План продаж | Тариф | Профиль
- URL state через `useSearchParams`, ARIA tablist/tab/tabpanel
- Desktop: vertical sidebar (md+), Mobile: horizontal scroll pills
- SyncingOverlay как full-screen фазовый overlay (idle -> syncing -> done)
- SyncPage удалён, `/sync` -> redirect `/settings?tab=connections`
- SettingsPage: 722 -> 110 строк (tab controller)
- 8 новых компонентов в `Settings/` (ConnectionsTab, ProductsTab, PlanTab, BillingTab, ProfileTab, SettingsTabs, SyncingOverlay, SecretInput, StatusBadge)

### Sales Plan Enterprise v2
- PlanCompletionCard v2: pace_daily, required_pace, forecast_revenue, forecast_percent, days_elapsed/remaining
- StockPlanAlerts: self-contained компонент, severity critical/warning/ok
- Copy Plan: кнопка "Из {prev_month}", GET /sales-plan/previous

### Ads Page Enterprise
- KPI 4x2 cards, AdsCampaignTable (search/sort/pagination)
- AdsChartsSection (Recharts), AdsDailyTable
- Mobile: expandable cards, date picker, chart responsive fixes

### Dashboard Cards Enterprise
- Grid 4x2 (`grid-cols-2 lg:grid-cols-4`), SummaryCard с accent-иконками
- Row1: Заказы | Выкупы | Себестоимость | Чист.прибыль
- Row2: Удержания | Реклама+ДРР | К перечисл. | Delta/Рентабельность
- ChangeBadge для period comparison, CurrencyValue formatter

### StockForecastChart
- Горизонтальный bar chart "Запас по дням" на дашборде
- Сортировка: ascending по days_remaining, цвета: red/amber/blue/green
- Фильтрация WB_ACCOUNT, средний показатель в header

### StockHistoryChart
- Динамика остатков по дням (line chart) над StocksTable
- DB: `mp_stock_snapshots`, snapshot при каждом sync
- Backend: `GET /dashboard/stock-history`
- Фильтры: Все МП / WB / Ozon, multi-select товаров (max 7 линий)
- Historical reconstruction script (304 snapshots, Jan 11 -> Feb 17)

---

## 2026-02-17

### Dashboard Cards v2
- Enterprise SummaryCard с 7 accent colors, secondaryValue
- ДРР merged в карточку Реклама (не отдельная карточка)

---

## 2026-02-16

### Sales Plan v1
- 3 уровня: total -> per-MP (wb/ozon) -> per-product per-MP
- DB: `mp_sales_plan` + `mp_sales_plan_summary` (migrations 014-016)
- Completion priority: total > MP-sum > product-sum
- Backend: 6 endpoints в sales_plan.py
- Frontend: SalesPlanEditor, PlanCompletionCard, UePlanPanel, BCG Matrix
- SaveInput: reusable inline blur-save component

### StocksTable Enterprise
- Search (name/barcode), Filters (All/OOS WB/OOS Ozon/Low)
- Sort: 6 fields, Pagination (20 desktop / 10 mobile)
- Progress bars, expandable rows, summary row
- Tip component: React Portal, desktop hover / mobile tap

---

## 2026-02-15

### Dashboard v2: Визуализация прибыли
- **ProfitWaterfall**: Каскад прибыли (div-based бары, НЕ Recharts)
- **ProfitChart**: Dual AreaChart (revenue + profit), lazy-loaded Recharts
- **TopProductsChart**: Top 5 по profit, horizontal bars, "все N ->" link
- **ConversionChart**: `sales/orders x 100%`, sky-blue (#0ea5e9), lazy-loaded
- Desktop layout: 2x2 charts grid (Sales|Profit, DRR|Conversion) + analytics row

### UE Profit Fix + P1 Features
- UE profit = Dashboard profit: пропорциональное распределение payout по товарам
- P1.1 ДРР по товарам: `ad_cost / revenue x 100%`
- P1.2 Прогноз остатков: `days_remaining = total_quantity / avg_daily_sales(30d)`

### СПП в Продажах
- WB credits (СПП, возмещения) включены в "Продажи"
- `displayed_revenue = costs_tree_sales + credits`
- costsTreeRatio использует ЧИСТЫЕ продажи (без credits)

### Прибыль per OZON/WB
- Прибыль в карточках MarketplaceBreakdown
- `profit_mp = payout_mp - purchase x share - ad x share`
- HelpCircle тултипы на всех метриках

### WB Методология -- ВЕРИФИЦИРОВАНА
- Аудит 15.02.2026: двойного учёта СПП нет
- `total_accrued = SUM(all tree items) = Продажи + Credits + Удержания`

### OZON Методология -- ВЕРИФИЦИРОВАНА
- Аудит 15.02.2026: расхождение с ЛК = 0.00 руб по всем 6 категориям
- У OZON нет credits (нет эквивалента СПП)

### Product Management
- Drag & Drop (@dnd-kit), связки (groups), себестоимость (CC)
- 5 backend endpoints в products.py, migration 013
- CC Conflict shake + modal, SKU лимиты по плану

---

## 2026-02-14

### Auth Flow
- LoginPage: 3 режима (login, signup, forgot-password)
- ResetPasswordPage: ввод нового пароля после перехода по ссылке
- Удаление аккаунта: Danger Zone -> DELETE /api/v1/account
- Email-шаблоны: брендированные (RevioMP, indigo-600), на русском

### YooKassa Payment
- Интеграция оплаты Pro (990 руб/мес) через ЮКассу (httpx, без SDK)
- ShopID: 1273909, Webhook: IP whitelist + двойная верификация
- Endpoints: /subscription/upgrade, /webhook, /cancel, /enable-auto-renew
- Migration 012: таблица mp_payments

### Ozon SKU Mapping Fix
- 6 правок в sync_service.py: парсинг ответа API, source filter, warehouse fallback
- 1 правка в ozon_client.py: парсинг в get_products_by_barcode

---

## 2026-02-10 -- 2026-02-13

### Landing Page
- LandingPage (~2000 строк): NavBar, Hero, TrustBar, DashboardCarousel, StatsBar, Problem, Features, DataFlowV3, HowItWorks, Security, Pricing, FAQ, FinalCTA, Footer
- DataFlowV3: desktop SVG (1000x590) + mobile SVG (300x450)
- MatrixRain: canvas-based digital rain (hero), indigo/violet colors
- PRO блок скрыт через `SHOW_PRO = false`

### Order Monitor v2
- Таблица mp_orders: одна строка = один заказ/отправление (migration 011)
- WB sync: 3-step enrichment, Ozon: FBS + FBO
- sale_price: WB retail_price_withdisc_rub (после СПП), Ozon = price
- Backend: GET /dashboard/orders (пагинация+фильтры)

---

## 2026-02-09

### SaaS Phase 3: Subscription Tiers
- 3 тарифа: Free / Pro (990 руб) / Business (2990 руб)
- Backend: plans.py, subscription.py (Depends), feature gates
- Frontend: FeatureGate (blur+lock), SubscriptionCard, plan badge

### SaaS Phase 4: Sync Queue
- DB-based queue (mp_sync_queue) + cron каждые 30 мин
- Расписание: Business 06/12/18/00 MSK, Pro +1ч, Free 08:00/20:00
- Ручной sync: Free:0, Pro:1/день, Business:2/день

### Order Monitor v1 (Воронка)
- Агрегированная воронка: Заказы -> Выкупы -> Возвраты
- Pro/Business фича, индикатор непроведённых

---

## 2026-02-09

### SaaS Phase 2: Onboarding
- Fernet encryption, mp_user_tokens таблица
- ProtectedRoute -> redirect /settings если нет токенов

---

## 2026-02-08

### SaaS Phase 1: Auth + RLS
- JWT middleware (JWKS), RLS на всех таблицах
- user_id во всех данных
- Cron: X-Cron-Secret + X-Cron-User-Id headers

---

## Исправленные баги (сводка)
- Плашки "Пред.пер." не показывают данные
- `secret_key = "change-me-in-production"` удалён
- Concurrent sync protection (sync guard + lock)
- Ozon SKU mapping hardcoded -> dynamic from DB (migration 009)
- Прибыль -10К: смешивание costs-tree и mp_sales -> пропорциональная коррекция
- WB mp_orders: price = retail_price ДО скидки -> sale_price column
- save-and-sync 500: trigger "onboarding" -> "manual"
- Completion inflation: active_mps filter
- SaveInput data loss при focus
