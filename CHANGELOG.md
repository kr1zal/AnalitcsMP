# Changelog — Analytics Dashboard

> Полная история выполненных задач. Для текущего статуса см. [CLAUDE.md](CLAUDE.md).

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
