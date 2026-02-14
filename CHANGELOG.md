# Changelog — Analytics Dashboard

> Полная история выполненных задач. Для текущего статуса см. [CLAUDE.md](CLAUDE.md).

## 14.02.2026 — Landing Page: cleanup + mobile DataFlow + pricing

**Cleanup:**
- Удалён мёртвый код: `_DataFlowSection` (V1, тёмная тема) и `_DataFlowSectionV2` (V2, светлая тема) — ~611 строк
- Файл: `frontend/src/pages/LandingPage.tsx` (2483 → ~2000 строк)

**Mobile DataFlowV3 — полная перезапись:**
- Было: упрощённая 3-элементная версия (WB → Hub → Output)
- Стало: полноценная 7-tier вертикальная диаграмма (300×450 SVG):
  - Sources (WB + Ozon с аватарами, кольцами, status dots)
  - 3 Shelf-карточки (cycling labels + active glow)
  - Hub (spinning gradient border, drop shadow)
  - 3 Output-карточки (разные анимации: fade, scale-bounce, flip)
  - Badges Row 1 (Telegram, ROI, Webhook с SVG-иконками)
  - Badges Row 2 (Excel, REST API, PDF с SVG-иконками)
  - YM placeholder
- 18 анимированных линий (draw-on + flow-dash), 10 traveling packets

**PRO блок скрыт:**
- Флаг `SHOW_PRO = false` в DataFlowSectionV3
- Десктоп: toggle, golden glow, дерево, 3 feature-ноды, traveling dots — всё за флагом
- Мобайл: golden glow + toggle — за флагом
- Включить обратно: `SHOW_PRO = true`

**Pricing — 2 колонки на мобиле:**
- Grid: `grid-cols-2` всегда (было `grid-cols-1 sm:grid-cols-2`)
- Адаптивные размеры: padding `p-3`/`sm:p-6`, шрифт `text-xs`/`sm:text-sm`, цена `text-2xl`/`sm:text-4xl`
- Бейдж "Рекомендуем": `text-[10px]` + `whitespace-nowrap`

**Коммиты:** 007fe8c, d33b2a2

## 14.02.2026 — Управление автопродлением подписки

**Фича:** Toggle автопродления на странице настроек. После отмены автопродления показывается статус "Автопродление отключено — активен до ДД.ММ.ГГГГ" с кнопкой "Включить автопродление".

**Backend:**
- `backend/app/subscription.py` — `auto_renew` и `expires_at` в датакласс UserSubscription + SELECT
- `backend/app/api/v1/subscription.py` — `auto_renew` и `expires_at` в ответе GET /subscription
- `backend/app/api/v1/payment.py` — новый эндпоинт POST /subscription/enable-auto-renew

**Frontend:**
- `frontend/src/types/index.ts` — `auto_renew`, `expires_at` в UserSubscriptionResponse
- `frontend/src/services/api.ts` — `paymentApi.enableAutoRenew()`
- `frontend/src/hooks/useSubscription.ts` — `useEnableAutoRenew()` хук
- `frontend/src/components/Settings/SubscriptionCard.tsx` — условная отрисовка: кнопка отмены / статус + кнопка включения

## 10.02.2026 — WB SPP Discount Fix: Реальная цена продажи

**Исправление:** WB `retail_price` = каталожная цена ДО скидки СПП. Добавлено поле `sale_price` — реальная цена продажи после скидки.

**SQL миграция:**
- `ALTER TABLE mp_orders ADD COLUMN sale_price DECIMAL(12,2)` — применена в Supabase
- Обновлён `backend/migrations/011_orders.sql` (sale_price между price и sale_amount)

**Backend:**
- `backend/app/services/sync_service.py`:
  - sync_orders_wb(): читает `priceWithDisc` из Sales API + `retail_price_withdisc_rub` из reportDetail → сохраняет в sale_price
  - sync_orders_ozon(): sale_price = price (Ozon показывает реальную цену, нет скрытой СПП)
- `backend/app/api/v1/dashboard.py`:
  - GET /dashboard/orders: возвращает sale_price, summary.total_revenue считается по sale_price (fallback на price)
  - GET /dashboard/orders/{id}: возвращает sale_price

**Frontend:**
- `frontend/src/types/index.ts` — `sale_price: number | null` в Order interface
- `frontend/src/pages/OrderMonitorPage.tsx` — полный редизайн:
  - Показывает реальную цену (sale_price), каталожная зачёркнута
  - SPP скидка в % (разница price vs sale_price)
  - Прозрачная математика: sale_price - commission - logistics - storage - other = payout
  - Панель деталей с progress bar издержек + верификация расхождений
  - Колонки: Дата | Товар | МП | Статус | Продажа(+СПП%) | Комиссия | Логистика | Удержания | Выплата | Проведён

## 09.02.2026 — Order Monitor v2: Позаказная детализация

**Новая фича:** Позаказный трекинг каждого заказа/отправления из WB и Ozon с финансовой разбивкой.

**SQL миграция:**
- `backend/migrations/011_orders.sql` — таблица mp_orders (UUID PK, UNIQUE(user_id, marketplace, order_id), 6 индексов, 4 RLS-политики)
- Поля: marketplace, order_id (WB: srid / Ozon: posting_number), status, price, commission, logistics, storage_fee, payout, settled, wb_sale_id, ozon_posting_status, region, warehouse, raw_data JSONB

**Backend (изменённые файлы):**
- `backend/app/services/sync_service.py` — sync_orders_wb() + sync_orders_ozon():
  - WB: 3-step enrichment (get_orders → get_sales → get_report_detail) с накоплением финансов (accumulate, НЕ overwrite)
  - Ozon: FBS + FBO (get_posting_fbs_list + get_posting_fbo_list), per-product financials из financial_data.products[]
  - ozon_posting_status format: "FBO:delivered", "FBS:cancelled"
  - Batch upsert в mp_orders (ON CONFLICT DO UPDATE)
- `backend/app/services/ozon_client.py` — новый метод get_posting_fbo_list() для Ozon FBO
- `backend/app/api/v1/dashboard.py`:
  - GET /dashboard/orders — пагинированный список с фильтрами (date, marketplace, status, settled, search, sort)
  - GET /dashboard/orders/{order_id} — детали одного заказа

**Frontend (изменённые файлы):**
- `frontend/src/pages/OrderMonitorPage.tsx` — полная переработка (~700 строк):
  - 4 KPI карточки (Заказы, Выкупы, Возвраты, Ожидают проведения)
  - Воронка (из mp_orders)
  - Позаказная таблица: Дата | ID заказа | Товар | МП(+FBO/FBS) | Цена | Статус | Комиссия | Логистика | Выплата | Проведён
  - Раскрывающаяся панель деталей с progress bar издержек
  - StatusBadge: ordered(серый), sold(зелёный), returned(красный), cancelled(оранжевый), delivering(синий)
  - MarketplaceBadge с FBO/FBS суб-бейджем для Ozon
  - Мобильные карточки (OrderMobileCard)
  - Пагинация 50/стр
- `frontend/src/hooks/useOrders.ts` — +useOrdersList, +useOrderDetail
- `frontend/src/types/index.ts` — +Order, +OrdersListResponse, +OrderDetailResponse, +OrdersFilters, +OrderStatus
- `frontend/src/services/api.ts` — ordersApi.getList(), ordersApi.getDetail()
- `frontend/src/App.tsx` — исправлен import (default вместо named)

## 09.02.2026 — Order Monitor v1: Воронка заказов

**Новая страница:** Агрегированная воронка заказов — Pro/Business фича. Страница `/orders`.

**Backend (изменённые файлы):**
- `backend/app/plans.py` — добавлена фича `order_monitor` (Free: false, Pro/Business: true)
- `backend/app/api/v1/dashboard.py` — GET /dashboard/order-funnel (авторизация + feature gate)
  - Агрегация mp_sales по дням и товарам (orders, sales, returns, buyout%, revenue)
  - Расчёт непроведённых через сравнение mp_sales.revenue vs costs-tree settled_revenue
  - Фильтры: date_from, date_to, marketplace

**Frontend (новые файлы):**
- `frontend/src/pages/OrderMonitorPage.tsx` — первая версия (~420 строк)
- `frontend/src/hooks/useOrders.ts` — React Query hook useOrderFunnel

**Frontend (изменённые файлы):**
- `frontend/src/types/index.ts` — OrderFunnelSummary, OrderFunnelDaily, OrderFunnelProduct, OrderFunnelResponse
- `frontend/src/services/api.ts` — ordersApi.getFunnel()
- `frontend/src/components/Settings/SubscriptionCard.tsx` — label 'Монитор заказов'
- `frontend/src/components/Shared/FeatureGate.tsx` — order_monitor: 'Pro'
- `frontend/src/App.tsx` — route /orders → OrderMonitorPage
- `frontend/src/components/Shared/Layout.tsx` — навигация "Заказы" (ClipboardList icon)

## 09.02.2026 — Bugfix: Calculation Tooltips

- Тултипы на плашках "Продажи" и "Прибыль" с формулами расчёта
- Показываются только при costsTreeRatio < 1 (когда Ozon не провёл все заказы)
- Commit: 3909890

## 09.02.2026 — Bugfix: Proportional Profit Scaling

- Ozon analytics API (mp_sales) vs finance API (costs-tree) рассогласование
- Пропорциональная коррекция закупки: purchase × (costs_tree_revenue / mp_sales_revenue)
- Commit: 4ce13c3

## 09.02.2026 — SaaS Phase 4: Sync Queue

- DB-based queue (mp_sync_queue) + cron `/sync/process-queue` каждые 30 мин
- Расписание: Business 06/12/18/00 MSK, Pro +1ч, Free 08:00/20:00
- Ручной sync: Free:0, Pro:1/день, Business:2/день
- Migration 010: mp_sync_queue + mp_sync_log.trigger
- Commit: a8cb2cd

## 09.02.2026 — Tech Debt Cleanup

- Удалён `secret_key` из config.py (никогда не использовался)
- Добавлен `extra = "ignore"` в Settings.Config (толерантность к лишним env-переменным)
- Dynamic barcodes + ozon_sku_map: загрузка из БД вместо хардкода в sync_service.py
- Migration 009: `ozon_sku` column в mp_products + seed data
- `sync_products()` теперь получает FBO SKU из Ozon API и сохраняет в ozon_sku
- Concurrent sync protection: running-lock + cooldown guard на sales/stocks/costs/ads
- Коммиты: 88bbe86, d4e54d4

## 09.02.2026 — SaaS Phase 3: Subscription Tiers

**3 тарифа:** Free / Pro (990₽/мес) / Business (2990₽/мес). MVP без оплаты — admin назначает тариф.

**SQL миграция (выполнена в Supabase):**
- `008_subscriptions.sql` — mp_user_subscriptions (user_id UNIQUE, plan CHECK, status CHECK)
- RLS: SELECT own row only, INSERT/UPDATE через service_role
- Admin (17e80396-...) → business plan

**Backend (новые файлы):**
- `backend/app/plans.py` — PLANS dict (лимиты SKU, маркетплейсы, фичи для каждого тарифа)
- `backend/app/subscription.py` — UserSubscription dataclass, get_user_subscription (Depends), require_feature factory
- `backend/app/api/v1/subscription.py` — GET /subscription, GET /subscription/plans, PUT /subscription (admin-only)

**Backend (изменённые файлы):**
- `backend/app/main.py` — registered subscription router
- `backend/app/api/v1/dashboard.py` — feature gates: unit-economics, ads, costs-tree details, period comparison
- `backend/app/api/v1/export.py` — require_feature("pdf_export")
- `backend/app/api/v1/sync.py` — marketplace restriction via allowed_mps

**Frontend (новые файлы):**
- `frontend/src/hooks/useSubscription.ts` — useSubscription, usePlans (React Query)
- `frontend/src/components/Shared/FeatureGate.tsx` — blur + lock overlay для заблокированных фич
- `frontend/src/components/Settings/SubscriptionCard.tsx` — карточка тарифа + таблица сравнения

**Frontend (изменённые файлы):**
- `frontend/src/types/index.ts` — SubscriptionPlan, UserSubscriptionResponse, PlanDefinition и др.
- `frontend/src/services/api.ts` — subscriptionApi (getMy, getPlans)
- `frontend/src/components/Shared/ProtectedRoute.tsx` — prefetch подписки
- `frontend/src/components/Shared/Layout.tsx` — бейдж тарифа (Free/Pro/Business) рядом с email
- `frontend/src/pages/SettingsPage.tsx` — секция "Тариф" с SubscriptionCard
- `frontend/src/pages/UnitEconomicsPage.tsx` — FeatureGate wrapper
- `frontend/src/pages/AdsPage.tsx` — FeatureGate wrapper
- `frontend/src/pages/DashboardPage.tsx` — условный PDF экспорт + период comparison

## 09.02.2026 — Bugfix: Previous period comparison

- DashboardPage вызывал `useDashboardSummary` вместо `useDashboardSummaryWithPrev`
- Плашки "Пред.пер." и "Δ к пред." теперь показывают данные
- Commit: 1aa095f

## 08.02.2026 — SaaS Phase 2: Onboarding (Per-User Tokens)

**Архитектура:** Fernet encryption на backend, mp_user_tokens таблица (one row per user).

**SQL миграция (выполнена в Supabase):**
- `007_user_tokens.sql` — mp_user_tokens (user_id UNIQUE, все поля encrypted TEXT nullable)
- RLS: 4 политики (SELECT/INSERT/UPDATE/DELETE WHERE auth.uid() = user_id)

**Backend (новые файлы):**
- `backend/app/crypto.py` — Fernet encrypt/decrypt utility
- `backend/app/api/v1/tokens.py` — 4 endpoints: GET /tokens, PUT /tokens, POST /tokens/validate, POST /tokens/save-and-sync

**Backend (изменённые файлы):**
- `backend/app/config.py` — +fernet_key field
- `backend/app/main.py` — registered tokens router
- `backend/app/services/sync_service.py` — _load_tokens() method (DB per-user → fallback .env)

**Frontend (новые файлы):**
- `frontend/src/hooks/useTokens.ts` — React Query hooks
- `frontend/src/pages/SettingsPage.tsx` — Settings/Onboarding page

**Frontend (изменённые файлы):**
- `frontend/src/types/index.ts` — TokensStatus, TokensInput, TokensValidateResponse
- `frontend/src/services/api.ts` — tokensApi module
- `frontend/src/App.tsx` — /settings route
- `frontend/src/components/Shared/Layout.tsx` — "Настройки" nav item
- `frontend/src/components/Shared/ProtectedRoute.tsx` — onboarding redirect

## 08.02.2026 — SaaS Phase 1: Auth + RLS (DEPLOYED)

**Архитектура:** Hybrid — service_role_key на backend, RLS как safety net, JWT через JWKS.

**SQL миграции:**
- `004_add_user_id.sql` — user_id UUID + индексы + UNIQUE constraints (8 таблиц)
- `005_rls_policies.sql` — RLS ENABLE + CRUD-политики
- `006_rpc_with_user_id.sql` — p_user_id во все 4 RPC
- Данные привязаны к user 17e80396-86e1-4ec8-8cb2-f727462bf20c

**Backend:** auth.py (JWKS), sync_cron_secret, auth на всех endpoints, user_id в sync_service
**Frontend:** LoginPage, ProtectedRoute, auth interceptor, email+logout в Layout
**Deploy:** rsync backend+frontend, pip install PyJWT[crypto], cron с X-Cron-Secret + X-Cron-User-Id

## 08.02.2026 — UnitEconomicsPage Redesign

- Полная переделка страницы unit-экономики
- Очистка мёртвых зависимостей

## 03.02.2026 — PDF Export via Playwright

- Backend endpoint `GET /export/pdf` → Playwright + Chromium → PDF
- Frontend PrintPage (3 страницы A4: Dashboard, Unit-экономика, Реклама)
- Swap 2GB на VPS, Playwright timeout 120 сек
- Качество: идеальный рендеринг, ~76 KB

## 03.02.2026 — Excel Export

- 6 листов: Сводка (OZON/WB), Продажи по дням, Реклама, Удержания МП, Unit-экономика, Остатки
- Frontend: xlsx библиотека
- Mobile: кнопки-иконки на уровне с МП селектором

## 02.02.2026 — Mobile Menu Improvements

- Swipe вправо для закрытия (threshold 60px)
- Ярлычок: 16px с chevron, 48px touch target, усиленная тень
- Панель: 240px (было 280px), компактные отступы
- Подсказка "← свайп для закрытия"

## 02.02.2026 — Tooltips + Spacing

- Tooltips с формулами вместо технических терминов
- Система отступов: mb-4→5→6 между секциями, gap-2→3 между карточками

## 01.02.2026 — CSS/UX Fixes + Deploy

- CSS overflow на мобиле: truncate, flex-1, min-w-0
- UI cleanup: "К перечислению" → "Начислено", убран мёртвый код
- Расхождение цифр: верхняя плашка теперь из costs-tree
- Frontend deployed to production

## 31.01.2026 — Sync + UX

- SYNC_TOKEN убран из .env
- Страница /sync работает: логи, кнопки
- WB карточка: компактный fallback "Нет данных за период"

## 30.01.2026 — Mobile-first Refactoring (Sessions 1+2)

**Layout:**
- Desktop: header + горизонтальная навигация
- Mobile: боковая плашка (градиент indigo→violet), slide-in панель 240px

**MarketplaceBreakdown:**
- grid-cols-2 на всех экранах (50/50)
- WB: Продажи + СПП, "К перечисл." → "Начислено"
- OZON: все категории удержаний видны

**Графики:**
- Компактные: 100px mobile / 140px desktop
- Zero-line при отсутствии данных

**DateRangePicker:**
- react-day-picker v9, 32px ячейки
- Пресеты: Сегодня, Вчера, 7д, 30д, Месяц
- captionLayout="label" (не dropdown)

**Responsive hooks:** useIsMobile, useIsTablet, useIsDesktop

## 30.01.2026 — Optimization (RPC + Combined queries)

**Backend RPC:**
- get_dashboard_summary, get_costs_tree — агрегация на стороне PostgreSQL
- get_costs_tree_combined, get_dashboard_summary_with_prev

**Frontend:**
- AccrualsCards через props (не свои запросы)
- Убраны deferredEnabled, useInView
- React.lazy() для графиков
- useMemo для серий данных

## 29.01.2026 — Optimization (Supabase RPC)

- RPC функции: get_dashboard_summary, get_costs_tree
- Индексы: idx_mp_sales_date_mp, idx_mp_costs_date_mp, idx_mp_costs_details_date_mp, idx_mp_ad_costs_date_mp

## Earlier — MATCH Upper Tiles + Native Semantics

- Верхние плашки → семантика costs-tree
- Выручка: WB=mp_sales.revenue, Ozon=costs-tree "Продажи"
- Прибыль: payout − закупка − ads (оценка)
- ДРР: Ads API / Выручка
- Tooltips с расшифровками

## Earlier — OZON Accruals

- Ozon finance API: пагинация, маппинг SKU, mp_costs + mp_costs_details
- _classify_ozon_operation(): 5 типов → category/subcategory
- OzonAccrualsCard: карточка + дерево удержаний
- 53 mp_costs + 353 mp_costs_details

## Earlier — WB Matching + Accruals

- Источник истины: reportDetailByPeriod
- sync_sales_wb() на reportDetailByPeriod
- sync_costs_wb(): mp_costs + mp_costs_details
- Системный товар WB_ACCOUNT
- WbAccrualsCard + дерево удержаний
- Reconcile: wb/reconcile_wb.py

## Earlier — Ads Sync

- POST /sync/ads endpoint
- sync_ads_wb: кампании по одной + rate limit
- OzonPerformanceClient: UUID async + CSV
- AdsPage: метрики, графики ДРР, таблица по дням

## Earlier — Initial Implementation

- Backend: FastAPI + Supabase, API клиенты WB/Ozon
- Frontend: React 19 + TS 5.9 + Vite 7 + Tailwind 3
- DashboardPage, UnitEconomicsPage, SyncPage, AdsPage, PrintPage
- 5 SKU, синхронизация данных
