# Changelog -- Analytics Dashboard (RevioMP)

> Обратный хронологический порядок. Полная архитектура: [architecture.md](architecture.md).
> Формулы и бизнес-логика: [business-logic.md](business-logic.md).

---

## [Unreleased]
- PDF export improvements (Playwright backend)
- Hide Business tier, SEO index.html, admin ID -> config

---

## 2026-03-09 (patch)

### Fix: Ozon UE storage-only products double deduction (P0)
- **Bug:** Storage cost application in `dashboard.py` created entries in `ozon_order_date_by_product` for products WITHOUT finance records (0 sales). This triggered the delivery-based calculation path instead of the storage-only path, causing `net_profit = -storage - purchase` instead of `net_profit = -storage`
- **Impact:** Л-Карнитин: -752₽ → -392₽ (was overstated by 360₽ = purchase_price). Бустер тестостерона: -1093.74₽ → -689.74₽ (overstated by 404₽)
- **Fix:** Storage loop now only modifies existing entries in `ozon_order_date_by_product` (products with finance records). Storage-only products handled by safety check (line 964)
- **Files:** `backend/app/api/v1/dashboard.py` (lines 601-606)

---

## 2026-03-09

### Feature Gates for Dashboard Charts + 403 Fix
- **9 new feature gates** in plans.py: profit_chart, drr_chart, conversion_chart, profit_waterfall, top_products, costs_donut, mp_breakdown, stock_forecast, stock_history
- **FeatureGate component redesign:** loading skeleton, a11y (inert, aria-label), MIN_PLAN_MAP, min-h-[44px] touch targets
- **DashboardPage:** all Pro-only charts wrapped in FeatureGate blur overlays; SalesChart + StocksTable remain FREE
- **403 fix:** DashboardPage, UnitEconomicsPage, AdsPage — subscription-aware `enabled` flags prevent API calls for Free users (no more red 403 errors in console)
- **UnitEconomicsPage:** shows FeatureGate overlay instead of error page for Free users
- **AdsPage:** shows FeatureGate overlay instead of error page for Free users
- **SubscriptionCard:** plans comparison table always visible (removed collapsible accordion)
- **Cleanup:** removed dead code ProLockedOverlay.tsx
- **Types:** SubscriptionFeatures extended with 9 new boolean fields
- **Files changed:** plans.py, products.py, export.py, DashboardPage.tsx, UnitEconomicsPage.tsx, AdsPage.tsx, FeatureGate.tsx, SubscriptionCard.tsx, types/index.ts, vite-env.d.ts, App.tsx, 4 chart components

---

## 2026-03-07

### Pricing Tier Overhaul -- Free/Pro rebalance
- **Free tier expanded:** max_sku 3->15, marketplaces WB-only->WB+Ozon, manual_sync 0->1/day, costs_tree_details unlocked, period_comparison unlocked, Telegram summary 1x/day
- **Pro tier repriced:** 990->1 490 rub/month (990 rub/month annual), max_sku 20->50, manual_sync 1->3/day
- **Business tier:** manual_sync aligned to 3/day (was 2)
- **FeatureGate cleanup:** removed `costs_tree_details` and `period_comparison` from MIN_PLAN_MAP (available to all)
- **DashboardPage:** removed subscription check for ChangeBadge period comparison (now available to all)
- **Landing PricingSection:** updated feature lists, pricing table (PRICING_FEATURES 12 rows), FAQ (3 questions updated)
- **Telegram bot knowledge:** updated ai_support.py knowledge base + support.py FAQ with new tier info
- **Docs:** auth-security.md tier matrices updated
- **Files changed:** plans.py, FeatureGate.tsx, PricingSection.tsx, landingData.ts, DashboardPage.tsx, SubscriptionCard.tsx, ai_support.py, support.py, auth-security.md

---

## 2026-03-06

### Landing Enterprise Refactor — Phase E+F
- **FeaturesSection compact 3x2 grid:** Removed hero/standard distinction, all 6 cards uniform. `grid-cols-2 lg:grid-cols-3`. Removed MiniChart/MiniWaterfall decorative components. Pro badge flex layout (no mobile overlap). Removed CTA button (avoids fatigue). Descriptions shortened
- **ProductShowcase CLS fix:** Grid stacking `[grid-area:1/1]` for title+description+highlights — zero layout shift on tab switch. Device toggle extracted from stack. Removed CTA link (demo block)
- **SecuritySection enterprise:** Per-badge unique colors (5 color schemes), glassmorphism cards, shield-pulse animation, WCAG text-gray-400 on dark bg, mobile orphan fix, strict TypeScript Record types
- **HowItWorksSection animated timeline:** Horizontal SVG dashed line (desktop), vertical bar (mobile), circle pop-in animation, CTA as text-link
- **Dead code cleanup:** Deleted MiniChart.tsx, MiniWaterfall.tsx, removed bar-grow-width/height/feature-dot-pattern CSS
- **CSS animations:** shield-pulse, circle-pop-in, security-grid-pattern, showcase-tab-progress + prefers-reduced-motion coverage
- **Затронуто:** FeaturesSection.tsx, ProductShowcase.tsx, SecuritySection.tsx, HowItWorksSection.tsx, landingData.ts, types/index.ts, index.css

---

## 2026-03-01

### Scale Phase 0 — Infrastructure Scalability
- **Phase 0.1 — .limit() on all queries:** Added explicit `.limit()` to all 35 Supabase queries across 6 backend files. Prevents PostgREST 1000-row silent truncation that caused incorrect UE calculations at scale
- **Phase 0.2 — Composite indexes:** Migration 037 — 7 composite indexes `(user_id, marketplace, date)` with user_id as leading column. Enables efficient index scan for multi-tenant SaaS queries instead of sequential scan
- **Phase 0.3 — Batch upserts:** Converted all 11 N+1 sync methods to batch operations (chunk size 500). HTTP calls per sync: ~70,500 → ~150. Sync time: 42+ min → 8-10 min. Pattern: collect rows → chunk by 500 → single upsert/insert. No migrations needed (PostgREST native batch support)
- **Methods batched:** sync_costs_wb/ozon (mp_costs + mp_costs_details), sync_sales_wb/ozon (mp_sales), sync_ads_wb/ozon (mp_ad_costs), sync_stocks_wb/ozon (mp_stocks + mp_stock_snapshots)
- **Verified:** costs-tree WB and OZON data identical before/after batch refactoring
- **Затронуто:** sync_service.py (+107/-46 lines), migration 037_composite_indexes.sql, dashboard.py, sales_plan.py, products.py, subscription.py, sync_queue.py

### UE Storage — Per-Product Storage Display (WB + Ozon)
- **WB Paid Storage API:** `wb_client.get_paid_storage()` — 3-step async (create task → poll status → download), auto 8-day chunking, 429 retry (3 attempts, 10s/20s backoff)
- **WB Storage Sync:** `sync_storage_wb()` — maps nmId → product_id, aggregates calcType rows (base + discount), writes to `mp_storage_costs_daily` (marketplace='wb'). Added to sync queue (24h throttle)
- **UE Backend:** storage query from `mp_storage_costs_daily` for both MPs, storage-only products (0 sales, >0 storage → negative profit), `mp_costs_display = mp_costs - storage` (avoid double-counting)
- **Dual-MP products:** Per-MP sales tracking during aggregation. `is_dual_mp` detection → separate Ozon (order_date path) + WB (proportional) calculation, then combine. Fixes "all" filter losing WB data
- **UE Frontend — collapsed view:** storage column (orange-600) between Удерж. and Реклама, `hasStorage` conditional (like hasAds pattern), WCAG contrast fix (text-gray-500)
- **UE Frontend — expanded view:** MpCard grid `grid-cols-2 sm:grid-cols-4` for 375px mobile, storage in waterfall step (bg-orange-400)
- **UeCostStructure:** "Хранение" segment (bg-orange-400) in stacked bar, conditional on `totals.storage > 0`
- **UeKpiCards:** storage KPI card with warehouse icon, % of revenue, responsive grid `sm:grid-cols-3 lg:grid-cols-5`
- **Export:** storage column in Excel (exportExcel.ts) and PDF (PrintUeTable.tsx), both hasStorage conditional
- **Scale:** `.limit(10000)` on all storage queries, SEC-001 (no error detail leak in 500s)
- **Затронуто:** 13+ файлов — wb_client.py, sync_service.py, dashboard.py, sync_queue.py, UeTable, UeCostStructure, UeKpiCards, UeMiniWaterfall, UeExpandedRow, exportExcel, PrintUeTable, ueHelpers, types/index.ts

---

## 2026-02-25

### Telegram Bot v3 — Human-Level Communication (P1-P7)
- **P1 Natural Tone:** typing indicator (ChatAction.TYPING) перед AI-ответами, убран footer "Ответ сформирован AI-ассистентом", естественный тон ("Если остались вопросы — просто напишите")
- **P2 Enriched Context:** `fetch_user_context()` загружает тариф, товары, МП, время последней синхронизации из Supabase. AI видит полный профиль пользователя
- **P3 Full Transcript Escalation:** `build_escalation_transcript()` отправляет оператору полный диалог (Клиент/Бот/Оператор) вместо summary. Truncation: >4000 chars = summary + last 5 messages
- **P4 Operator Joined:** уведомление "К вашему диалогу подключился оператор поддержки" — один раз per session. Flag в `escalation_reason` (pipe-delimited)
- **P5 3-Level CSAT:** "Отлично, спасибо!" (5) / "Помогло частично" (3) / "Не помогло" (1). Partial CSAT запрашивает текстовый фидбек
- **P6 Anomaly Alerts:** check_anomalies_from_data() — алерты при падении заказов >30%, ДРР >20%, маржа <10%. Pure function без доп. RPC
- **P7 Welcome Onboarding:** после привязки аккаунта — интерактивное приветствие с кнопками "Настроить расписание" / "Позже"
- **SEC-001:** html_escape для user.full_name/username через `_safe_user_display()` (XSS prevention)
- **BUG-001:** operator_joined flag перенесён из conversation_summary в escalation_reason (не ломает AI context и summarization)
- **PERF-001:** check_anomalies_from_data() — pure function, переиспользует данные из build_summary_message() без дублирования RPC
- **Затронуто:** handlers.py (+208/-69), ai_support.py (+111), session_manager.py (+125), notifications.py (+121), keyboards.py (+34), support.py (+30)

### Telegram Bot -- Документация
- **6 файлов документации** в `docs/telegram/`: README, bot-architecture, ai-support, support-system, notifications, deployment
- Полное описание webhook pipeline, FSM, DB schema (5 таблиц), deep linking flow
- AI-поддержка: system prompt, confidence scoring, context management, примеры диалогов
- Система поддержки: session lifecycle, CSAT, idle detection, operator flow
- Уведомления: daily summary, stock alerts, AI insights, расписание
- Деплой: Nginx, crontab, env vars, troubleshooting, мониторинг
- Обновлены `docs/README.md` (секция Telegram + быстрая ссылка)

### Telegram Bot — Enterprise Support v2
- **AI-поддержка:** Claude Haiku отвечает на вопросы пользователей в Telegram с персистентной историей
- **Session lifecycle:** active -> resolved/escalated -> closed. Resolved сессии переоткрываются при новом сообщении
- **Persistent storage:** 3 новых таблицы в Supabase (tg_support_sessions, tg_support_messages, tg_support_csat). Migration 024
- **Conversation context:** <= 10 сообщений — полная история, > 10 — summary (Claude Haiku) + последние 10
- **CSAT:** После решения вопроса — "Да, помогли" / "Нет, не помогли". Негативный CSAT эскалирует в группу
- **Idle detection:** Cron каждые 5 мин — напоминание "Всё ещё нужна помощь?" после 30 мин неактивности
- **Auto-close:** Resolved сессии автоматически закрываются через 2 часа
- **Escalation:** При низкой уверенности AI (< 0.7) или по кнопке — summary + эскалация оператору
- **Operator messages:** Ответы из группы поддержки сохраняются в БД (role='operator')
- **Graceful degradation:** Все session_manager функции обрабатывают ошибки без краша бота
- **Backend:** session_manager.py (499 строк), обновлены ai_support.py, handlers.py, keyboards.py, support.py, telegram.py
- **Cron endpoint:** POST /telegram/session-cleanup (X-Cron-Secret auth)
- **Тесты:** 18 enterprise тестов (lifecycle, AI context, CSAT, escalation, edge cases) — все PASSED

---

## 2026-02-23

### ProductShowcase — Enterprise Tab Slider
- **ProductShowcase:** заменил Swiper-карусель на enterprise tab-based слайдер (чистый React + CSS, без зависимости Swiper)
- **3 таба:** Виджеты (BarChart3) | Юнит-экономика (TrendingUp) | Остатки (ClipboardList) с иконками lucide
- **Browser Chrome:** macOS-стиль (цветные dots + Lock + reviomp.ru в адресной строке)
- **iPhone Mockup:** Dynamic Island, rounded-[2.5rem] frame, ring border, shadow — реалистичный iPhone frame
- **Crossfade:** opacity + scale(0.98→1) transition 500ms между скриншотами
- **Device Toggle:** Desktop/Mobile переключатель (Monitor/Smartphone иконки)
- **Auto-advance:** 6 сек interval, progress-bar в активном табе (CSS animation), пауза при hover
- **Feature Pills:** CheckCircle бейджи с 3 ключевыми фичами каждого экрана
- **Декор:** gradient glow фон (indigo-50/40), blur orbs за телефоном (indigo/violet + emerald/cyan)
- **ARIA:** tablist/tab/tabpanel, aria-selected, aria-label
- **Скриншоты:** 6 скриншотов (desktop-1/2/3 + mobile-1/2/3) из реального продукта
- **CSS:** `.showcase-tab-progress` animation + prefers-reduced-motion support

### Landing Page Hero Redesign
- **NavBar:** sticky + backdrop-blur при скролле, кликабельный логотип (scroll-to-top), `NAV_ITEMS` const, clean gaps без cell borders, hover:bg-gray-50, hamburger 44px touch target, ARIA aria-expanded
- **HeroSection:** текстовый hero (скриншот убран → перенесён в карусель). H1 "Прозрачная аналитика для маркетплейсов" (primary USP, 44/64/76px). Badge "WB + Ozon в одном дашборде" (differentiator). Подзаголовок с secondary USP "Собери свой дашборд из виджетов за 5 минут". CTA + trust text inline. MatrixRain canvas фон
- **FAQSection:** ARIA атрибуты (aria-expanded, aria-controls, role="region")
- **Исправлено:** `block`+`flex` конфликт (3 места), `as any` → `as const`, симлинки скриншотов заменены на реальные файлы

---

## 2026-02-21

### Fix P0: Purchase date axis mismatch (миграции 019 + 020)
- **Корневая проблема:** RPC `get_dashboard_summary` смешивал оси дат — revenue из mp_sales (дата ЗАКАЗА), но Ozon purchase из mp_costs.settled_qty (дата РАСЧЁТА). На 15 фев: 1 заказ 863₽, но 4 settled товара → purchase=1360₽ → profit < 0
- **Миграция 019:** Добавила `mp_costs.settled_qty`, settlement-based purchase в RPC (неверный подход — смешивает оси)
- **Миграция 020:** Откатила RPC на order-based purchase для ВСЕХ МП (`purchase_price × sales_count` из mp_sales). Settlement-based purchase оставлен ТОЛЬКО в UE Python endpoint (где revenue тоже settlement-based из costs-tree)
- **Принцип:** revenue и purchase ВСЕГДА на одной оси. RPC: обе order-based. UE: обе settlement-based
- **Результат:** 15 фев Ozon FBO: purchase 1360₽ → 404₽ (1 × Тестобустер), profit корректен

### Fix: Ozon UE product marketplace detection (dashboard.py)
- **Баг:** `product.get("marketplace")` на mp_products всегда возвращал "" → settlement-based purchase для Ozon в UE никогда не срабатывал
- **Fix:** Определение Ozon через `ozon_product_ids` set (из mp_costs) + fallback `product.get("ozon_product_id")`

### Fix: Ozon sales pagination (sync_service.py)
- **Баг:** `sync_sales_ozon()` не имел пагинации — при >1000 строк терялись данные
- **Fix:** Пагинационный цикл с `offset += page_limit`, safety limit 10000

### Fix: Deprecated Ozon endpoint
- **`/v1/warehouse/list` → `/v2/warehouse/list`** в ozon_client.py (dead code, но обновлён для совместимости)

### Fix P0: Ozon реклама — дупликация mp_ad_costs (миграция 019)
- **Проблема:** `mp_ad_costs` для Ozon имеет `product_id=NULL` (реклама account-level). PostgreSQL: `NULL != NULL` в UNIQUE constraints → UPSERT при каждом sync INSERT вместо UPDATE → расходы умножались кратно числу синхронизаций
- **Fix:** `sync_ads_ozon` теперь делает DELETE за период перед INSERT (паттерн как у `mp_costs_details`)
- **Очистка:** миграция 019 PART 2 удалила существующие дубликаты через ROW_NUMBER()
- **Затронуто:** `sync_service.py` `sync_ads_ozon()`

---

## 2026-02-20

### Fix: Timezone-independent date calculation
- **Баг:** `getMaxAvailableDateYmd()` форматировала дату через `format(date, 'yyyy-MM-dd')` (date-fns), которая использует локальную TZ браузера. На ПК с разными часовыми поясами `date_to` мог отличаться на 1 день → сдвиг 7-дневного окна → разные данные costs-tree → драматическая разница в выручке и прибыли
- **Подтверждено:** Feb 13-19 давал +192₽ прибыли, Feb 14-20 давал -1186₽ (разница в payout 1100₽ из-за разных выплат Ozon по дням)
- **Исправление:** `formatDateMoscow()` через `toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' })` — дата всегда в МСК независимо от TZ браузера
- **Затронуто:** `getMaxAvailableDateYmd()`, `getTodayYmd()` в `frontend/src/lib/utils.ts`

### Enterprise: Sticky FilterPanel + URL state + единый МП-фильтр
- **FilterPanel sticky**: панель фильтров прилипает к верху экрана при скролле (`sticky top-0 z-30`). Паттерн GA/Mixpanel/Shopify — не нужно скроллить вверх для смены фильтров
- **AdsPage sticky**: фильтры страницы рекламы также прилипают при скролле
- **URL state sync**: двусторонняя синхронизация фильтров Zustand ↔ URL query params (`useFilterUrlSync` хук). Параметры: `?period=30d&mp=wb&ft=FBS&from=YYYY-MM-DD&to=YYYY-MM-DD`. Дефолтные значения не пишутся в URL. Сохраняет чужие query params (utm_source, ref)
- **Убран sidebar МП-фильтр**: графики следуют за глобальным фильтром МП из FilterPanel
- **Sidebar оставлен**: только фильтр товаров (drill-down для графиков)
- **PlanCompletionCard**: добавлен `fulfillment_type` в API запрос
- **StockHistoryChart**: МП-фильтр синхронизируется с FilterPanel

### Fix: Отвязка MarketplaceBreakdown и остатков от глобального фильтра МП
- **MarketplaceBreakdown**: Карточки OZON и WB теперь ВСЕГДА загружают данные, независимо от выбранного МП в фильтре. Ранее при выборе WB карточка OZON была пустой и наоборот
- **Stocks**: StocksTable, StockForecastChart и StockHistoryChart теперь всегда показывают остатки по ВСЕМ маркетплейсам. StocksTable имеет встроенные фильтры (Все/OOS WB/OOS Ozon) для детализации
- Фильтры, влияющие на MarketplaceBreakdown: только период дат и FBO/FBS
- Фильтры, влияющие на Stocks: только FBO/FBS (остатки — текущее состояние, не аналитика за период)

### Bugfix: Costs-tree FBO/FBS merge — корректное суммирование "Все"
- **Проблема:** WB `reportDetailByPeriod` не содержит полей `isSupply`/`delivery_type_id` → `_determine_wb_fulfillment()` всегда возвращал FBO → `mp_costs_details` имел 0 FBS записей → RPC `get_costs_tree` при "Все" использовал только FBO данные, игнорируя FBS из `mp_costs`/`mp_sales`
- **Фикс 1:** `_determine_wb_fulfillment()` — добавлена поддержка `delivery_method` ("FBW"→FBO, "FBS"/"DBS"→FBS) и `srv_dbs` (True→FBS), которые реально присутствуют в API
- **Фикс 2:** Хелперы `_merge_costs_tree_data()` + `_fetch_costs_tree_merged()` — при `fulfillment_type=None` ("Все") делают два RPC вызова (FBO+FBS) и мержат результаты: суммируют `total_accrued`, `total_revenue`, объединяют tree items по category name
- **Применено к 4 эндпоинтам:** `/dashboard/costs-tree`, `/dashboard/costs-tree-combined`, `/dashboard/unit-economics`, Order Monitor
- **Верификация:** FBO=7015.93 + FBS=8353.00 = Все=15368.93 ✓, Σ(tree)=total_accrued для всех режимов ✓

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
