# Frontend Guide -- Analytics Dashboard

Полное руководство по frontend-приложению аналитики маркетплейсов WB и Ozon.

---

## 1. Обзор

### Стек технологий

| Категория | Библиотека | Версия | Назначение |
|-----------|-----------|--------|------------|
| UI Framework | React | 19.2 | Компонентная модель, Suspense, lazy |
| Типизация | TypeScript | 5.9 | Строгая типизация, no `any` |
| Сборка | Vite | 7.2 | Dev server, HMR, production build |
| CSS | Tailwind CSS | 3.4 | Utility-first стилизация |
| Server State | React Query (TanStack) | 5.90 | Кэширование, refetch, staleTime |
| Client State | Zustand | 5.0 | UI-состояние (фильтры, auth) |
| Роутинг | React Router DOM | 7.12 | SPA навигация, protected routes |
| HTTP | Axios | 1.13 | API клиент с interceptors |
| Auth | Supabase JS | 2.95 | Аутентификация, JWT сессии |
| Графики | Recharts | 3.7 | Area, Bar, Line, Donut charts |
| Drag & Drop | @dnd-kit | 6.3 / 10.0 | Сортировка товаров |
| Даты | date-fns | 4.1 | Форматирование, арифметика дат |
| Календарь | react-day-picker | 9.13 | DateRangePicker |
| Иконки | lucide-react | 0.562 | SVG иконки |
| Уведомления | Sonner | 2.0 | Toast-уведомления |
| Excel | xlsx (SheetJS) | 0.18 | Клиентский Excel экспорт |
| Слайдер | Swiper | 12.1 | Карусель на Landing |
| Шрифт | @fontsource/inter | 5.2 | Inter font |

### Архитектура

```
Pages (10)
  └── Components (71 .tsx файлов)
        ├── Dashboard (19)
        ├── Settings (13)
        ├── Shared (8)
        ├── UnitEconomics (10)
        ├── Ads (5)
        └── Print (16 + 1 .ts)
  └── Hooks (11 файлов, 35+ экспортов)
  └── Services (api.ts — единый API клиент)
  └── Stores (2 Zustand-стора)
  └── Types (index.ts — 80+ типов)
  └── Lib (utils.ts, supabase.ts, exportExcel.ts)
```

Поток данных: **Pages** загружают данные через **Hooks** (React Query), которые вызывают **Services** (api.ts). Pages передают данные в **Components** через props. UI-состояние хранится в **Stores** (Zustand). Все типы определены в **Types**.

---

## 2. Структура каталогов

```
frontend/src/
├── App.tsx                          # Корневой компонент, роутинг, QueryClient
├── main.tsx                         # Entry point, ReactDOM.createRoot
├── index.css                        # Tailwind directives (@tailwind base/components/utilities)
├── vite-env.d.ts                    # Vite env types
│
├── pages/                           # 10 страниц-контейнеров
│   ├── DashboardPage.tsx            # Главная (949 строк)
│   ├── UnitEconomicsPage.tsx        # Unit-экономика (314)
│   ├── OrderMonitorPage.tsx         # Монитор заказов (779)
│   ├── AdsPage.tsx                  # Реклама (215)
│   ├── SettingsPage.tsx             # Настройки — tab controller (110)
│   ├── PrintPage.tsx                # PDF-рендер для Playwright (361)
│   ├── LandingPage.tsx              # Лендинг для неавторизованных (2039)
│   ├── LoginPage.tsx                # Вход / Регистрация / Forgot (283)
│   ├── ResetPasswordPage.tsx        # Сброс пароля (199)
│   └── LegalPages.tsx               # Юридические страницы (373)
│
├── components/
│   ├── Dashboard/                   # 19 компонентов дашборда
│   ├── Settings/                    # 13 компонентов настроек
│   ├── Shared/                      # 8 общих компонентов
│   ├── UnitEconomics/               # 8 .tsx + 2 .ts хелпера
│   ├── Ads/                         # 5 компонентов рекламы
│   └── Print/                       # 16 .tsx + 1 .ts (PDF-рендеринг)
│
├── hooks/                           # 11 файлов с React Query / utility хуками
│   ├── useAuth.ts                   # Supabase auth listener
│   ├── useDashboard.ts              # 12 data-хуков (summary, charts, stocks, UE...)
│   ├── useExport.ts                 # Excel + PDF экспорт
│   ├── useInView.ts                 # IntersectionObserver (lazy load)
│   ├── useMediaQuery.ts             # Breakpoint хуки (isMobile, isTablet, isDesktop)
│   ├── useOrders.ts                 # Монитор заказов (funnel, list, detail)
│   ├── useProducts.ts               # CRUD товаров (mutations)
│   ├── useSalesPlan.ts              # План продаж (8 хуков)
│   ├── useSubscription.ts           # Подписки и оплата (5 хуков)
│   ├── useSync.ts                   # Синхронизация (6 хуков)
│   └── useTokens.ts                 # API-токены (4 хука)
│
├── services/
│   └── api.ts                       # Axios instance, interceptors, 8 namespaces
│
├── store/
│   ├── useAuthStore.ts              # Auth state (user, session, logout)
│   └── useFiltersStore.ts           # Dashboard фильтры (datePreset, marketplace)
│
├── types/
│   └── index.ts                     # 80+ типов / интерфейсов
│
├── lib/
│   ├── utils.ts                     # Форматирование, даты, cn(), debounce
│   ├── supabase.ts                  # Supabase client init
│   └── exportExcel.ts               # Генерация Excel (6 листов)
│
└── assets/                          # Статические файлы
```

---

## 3. Страницы

### 3.1 DashboardPage (`/`)

**Файл:** `pages/DashboardPage.tsx` (949 строк)

Главная страница аналитики. Оркестратор: загружает все данные, вычисляет метрики, передает в компоненты.

**Hooks:**
- `useDashboardSummaryWithPrev` -- сводка с данными предыдущего периода
- `useCostsTree` x2 -- параллельно для Ozon и WB (архитектурное правило #1)
- `useUnitEconomics` -- unit-экономика для TopProductsChart + purchase fallback
- `useSalesChart` -- данные графика продаж
- `useAdCosts` -- рекламные расходы
- `useStocks` -- остатки
- `useSalesPlanCompletion` -- выполнение плана
- `useProducts` -- товары для бокового фильтра

**Компоненты:**
- `FilterPanel` -- период + экспорт
- `SummaryCard` x8 -- карточки метрик (4x2 grid)
- `PlanCompletionCard` -- карточка плана продаж
- `MarketplaceBreakdown` -- OZON/WB карточки
- `SalesChart` (lazy) -- график заказов/выкупов
- `ProfitChart` (lazy) -- график прибыли
- `DrrChart` (lazy) -- график ДРР
- `ConversionChart` (lazy) -- график конверсии
- `ProfitWaterfall` -- каскад прибыли
- `CostsDonutChart` -- структура расходов
- `TopProductsChart` -- топ-5 товаров
- `StockForecastChart` -- прогноз остатков
- `StockHistoryChart` -- динамика остатков
- `StocksTable` -- таблица остатков

**Ключевые вычисления (IIFE, не useMemo):**
- `revenueForTile` -- выручка из costs-tree (Продажи + Credits)
- `netProfitForTile` -- прибыль = payout - purchase - ads (RAW, costsTreeRatio удалён 19.02.2026)
- Per-MP profit: `ozonProfitData`, `wbProfitData`

---

### 3.2 UnitEconomicsPage (`/unit-economics`)

**Файл:** `pages/UnitEconomicsPage.tsx` (314 строк)

Enterprise страница unit-экономики с планом продаж, ABC-классификацией, матрицей.

**Hooks:** `useUnitEconomics`, `useProducts`, `useSalesPlanCompletion`, `useSalesPlan`

**Компоненты:** `UePlanPanel`, `UeKpiCards`, `UePlanMatrix`, `UeProfitBars`, `UeCostStructure`, `UeTable`

---

### 3.3 OrderMonitorPage (`/orders`)

**Файл:** `pages/OrderMonitorPage.tsx` (779 строк)

Позаказная детализация: каждый заказ = строка с финансовой разбивкой.

**Hooks:** `useOrderFunnel`, `useOrdersList`, `useIsMobile`

**Особенности:** Фильтры по статусу (ordered/sold/returned/cancelled/delivering), поиск, сортировка, пагинация, expandable rows.

---

### 3.4 AdsPage (`/ads`)

**Файл:** `pages/AdsPage.tsx` (215 строк)

Enterprise страница рекламных кампаний.

**Hooks:** `useAdCosts`, `useAdCampaigns`

**Компоненты:** `AdsKpiCards`, `AdsChartsSection`, `AdsCampaignTable`, `AdsDailyTable`

---

### 3.5 SettingsPage (`/settings?tab=`)

**Файл:** `pages/SettingsPage.tsx` (110 строк)

Unified настройки с 5 табами. URL state через `useSearchParams`.

**Табы:** `connections` | `products` | `plan` | `billing` | `profile`

**Компоненты:** `SettingsTabs`, `ConnectionsTab`, `ProductsTab`, `PlanTab`, `BillingTab`, `ProfileTab`, `SyncingOverlay`

**Редиректы:** `/sync` -> `/settings?tab=connections`, `?payment=` -> `tab=billing`

---

### 3.6 PrintPage (`/print`)

**Файл:** `pages/PrintPage.tsx` (361 строк)

PDF-рендер для Playwright (backend). Без Layout. Авторизация через `?token=` в URL.

**Структура PDF:** Обложка -> Executive Summary -> Маркетплейсы -> Графики -> UE -> Остатки -> Реклама

---

### 3.7 LandingPage (`/` для неавторизованных)

**Файл:** `pages/LandingPage.tsx` (2039 строк)

Rich landing: Swiper-карусель, scroll-reveal, Canvas MatrixRain, счетчики, pricing.

---

### 3.8 LoginPage (`/login`)

**Файл:** `pages/LoginPage.tsx` (283 строк)

3 режима: `login` | `signup` | `forgot`. Supabase Auth напрямую.

---

### 3.9 ResetPasswordPage (`/reset-password`)

**Файл:** `pages/ResetPasswordPage.tsx` (199 строк)

Обработка события `PASSWORD_RECOVERY` от Supabase.

---

### 3.10 LegalPages (`/legal`, `/policy`, `/privacy`)

**Файл:** `pages/LegalPages.tsx` (373 строк)

3 экспорта: `LegalPage`, `PolicyPage`, `PrivacyPage`. Доступны без авторизации.

---

## 4. Компоненты

### 4.1 Dashboard (19 компонентов)

| Компонент | Строк | Описание |
|-----------|-------|----------|
| `SummaryCard` | 258 | Enterprise-карточка метрики с иконкой, accent-цветом, ChangeBadge, tooltip |
| `StocksTable` | 1054 | Таблица остатков: search, фильтры, sort, pagination, expandable, summary row |
| `OzonAccrualsCard` | 402 | Карточка OZON: costs-tree, прибыль, СПП tooltip |
| `WbAccrualsCard` | 357 | Карточка WB: costs-tree, прибыль, СПП tooltip |
| `StockHistoryChart` | 246 | Динамика остатков: self-contained, MP фильтр, multi-select линий |
| `CostsTreeView` | 240 | Tree-view удержаний (как в ЛК МП) |
| `CostsDonutChart` | 198 | Donut-диаграмма расходов (Recharts) |
| `SalesChart` | 188 | График заказов/выкупов (lazy, Recharts Area) |
| `ProfitChart` | 184 | Dual area: revenue + profit (lazy) |
| `ProfitWaterfall` | 170 | Каскад прибыли: div-based bars (НЕ Recharts) |
| `StockForecastChart` | 162 | Горизонтальный bar: запас по дням, цветовая кодировка |
| `TopProductsChart` | 150 | Top 5 товаров по прибыли, horizontal bars |
| `PlanCompletionCard` | 131 | Карточка выполнения плана продаж |
| `ConversionChart` | 121 | Конверсия: sales/orders (lazy, sky-blue) |
| `DrrChart` | 110 | График ДРР (lazy) |
| `AvgCheckChart` | 103 | Средний чек (не используется, сохранен для восстановления) |
| `StockHistoryChartInner` | 94 | Inner Recharts компонент для StockHistoryChart |
| `MarketplaceBreakdown` | 48 | Обертка: OZON + WB карточки |
| `MetricCard` | 48 | Legacy карточка метрики (заменена на SummaryCard) |

### 4.2 Settings (13 компонентов)

| Компонент | Строк | Описание |
|-----------|-------|----------|
| `ProductManagement` | 749 | 3-column drag&drop, link/unlink, CC edit |
| `ConnectionsTab` | 515 | API-токены WB/Ozon, валидация, sync |
| `SalesPlanEditor` | 429 | 3-уровневый редактор: total -> MP -> product |
| `SubscriptionCard` | 288 | Карточка тарифа с кнопками upgrade/cancel |
| `SyncingOverlay` | 181 | Full-screen overlay: idle -> syncing -> done |
| `ProfileTab` | 137 | Email, удаление аккаунта |
| `StockPlanAlerts` | 112 | Предупреждения по остаткам и планам |
| `SettingsTabs` | 86 | Desktop: vertical sidebar / Mobile: scroll pills |
| `SecretInput` | 40 | Поле ввода с маской (для API ключей) |
| `BillingTab` | 40 | Обертка для SubscriptionCard |
| `PlanTab` | 28 | Обертка для SalesPlanEditor + StockPlanAlerts |
| `StatusBadge` | 17 | Бейдж статуса синхронизации |
| `ProductsTab` | 12 | Обертка для ProductManagement |

### 4.3 Shared (8 компонентов)

| Компонент | Строк | Описание |
|-----------|-------|----------|
| `DateRangePicker` | 314 | Календарь с пресетами (7d/30d/90d/custom), `captionLayout="label"` |
| `Layout` | 287 | Адаптивная навигация: desktop header + mobile slide panel |
| `FilterPanel` | 254 | Период + МП фильтр + экспорт кнопки |
| `SaveInput` | 83 | Inline blur-save: server sync при потере фокуса |
| `FeatureGate` | 55 | Проверка подписки: показать / blur+lock / скрыть |
| `ProtectedRoute` | 31 | Auth guard + onboarding redirect |
| `LoadingSpinner` | 24 | Спиннер загрузки с текстом |

### 4.4 UnitEconomics (8 .tsx + 2 .ts)

| Компонент | Строк | Описание |
|-----------|-------|----------|
| `UeTable` | 672 | Enterprise таблица: search, filter tabs, sort, pagination, expandable |
| `UeKpiCards` | 190 | 8 KPI-карточек + Plan KPI |
| `UeExpandedRow` | 176 | Расширяемая строка с MP breakdown |
| `UePlanPanel` | 142 | Summary Panel: editing, progress, forecast |
| `UeProfitBars` | 114 | TOP/BOTTOM bars с ABC-классификацией |
| `UePlanMatrix` | 113 | BCG Plan-Profit Matrix (2x2) |
| `UeCostStructure` | 66 | Стековый бар структуры затрат |
| `UeMiniWaterfall` | 61 | Мини-каскад прибыли (в expanded row) |
| `ueHelpers.ts` | -- | `classifyABC()`, `computeTotals()` |
| `uePlanHelpers.ts` | -- | Хелперы для плана продаж |

### 4.5 Ads (5 компонентов)

| Компонент | Строк | Описание |
|-----------|-------|----------|
| `AdsCampaignTable` | 417 | Таблица кампаний: search, sort, pagination |
| `AdsDailyTable` | 263 | Дневная таблица рекламных расходов |
| `AdsKpiCards` | 152 | 4x2 KPI карточки рекламы |
| `AdsSpendChart` | 98 | График расходов на рекламу (Recharts) |
| `AdsChartsSection` | 53 | Обертка для AdsSpendChart |

### 4.6 Print (16 .tsx + 1 .ts)

Компоненты для PDF-рендера (Playwright). SVG-графики (НЕ Recharts) для идеальной печати.

| Компонент | Строк | Описание |
|-----------|-------|----------|
| `PrintSvgComboChart` | 161 | Combo chart: bars + line (SVG) |
| `PrintUeTable` | 147 | UE таблица для печати |
| `PrintUeOverview` | 135 | UE обзор: ABC, top 5, убыточные |
| `PrintStocksTable` | 132 | Таблица остатков для печати |
| `PrintSalesChart` | 127 | График продаж (SVG) |
| `PrintMarketplaceBreakdown` | 118 | OZON/WB breakdown для печати |
| `PrintSvgBarChart` | 115 | Bar chart (SVG) |
| `PrintSvgAreaChart` | 114 | Area chart (SVG) |
| `PrintSvgDonutChart` | 112 | Donut chart (SVG) |
| `PrintAdsCampaignTable` | 109 | Таблица кампаний для печати |
| `PrintCoverPage` | 102 | Обложка PDF |
| `PrintProfitChart` | 89 | График прибыли (SVG) |
| `PrintAdsTable` | 79 | Таблица рекламы для печати |
| `PrintAdsOverview` | 71 | Обзор рекламы для печати |
| `PrintExecutiveSummary` | 197 | Executive Summary: KPI, plan, waterfall, donut |
| `PrintPageShell` | 41 | Shell-обертка с page-break |
| `print-constants.ts` | 91 | Пагинация, размеры, цвета, пороги |

---

## 5. Hooks

### 5.1 Data Hooks (React Query)

Все data hooks используют `useQuery` / `useMutation` из `@tanstack/react-query`.

#### useDashboard.ts (12 хуков)

| Hook | API Endpoint | staleTime | Описание |
|------|-------------|-----------|----------|
| `useDashboardSummary` | `GET /dashboard/summary` | 5 мин | Сводка продаж |
| `useDashboardSummaryWithPrev` | `GET /dashboard/summary?include_prev_period=true` | 5 мин | Сводка + предыдущий период |
| `useUnitEconomics` | `GET /dashboard/unit-economics` | 5 мин | Unit-экономика |
| `useSalesChart` | `GET /dashboard/sales-chart` | 5 мин | Данные графика продаж |
| `useStocks` | `GET /dashboard/stocks` | 10 мин | Остатки на складах |
| `useStockHistory` | `GET /dashboard/stock-history` | 10 мин | История остатков |
| `useAdCosts` | `GET /dashboard/ad-costs` | 5 мин | Рекламные расходы |
| `useAdCampaigns` | `GET /dashboard/ad-campaigns` | 5 мин | Рекламные кампании |
| `useCostsTree` | `GET /dashboard/costs-tree` | 5 мин | Дерево удержаний |
| `useCostsTreeCombined` | `GET /dashboard/costs-tree-combined` | 5 мин | Ozon+WB combined tree |
| `useProducts` | `GET /products` | 30 мин | Список товаров |

#### useOrders.ts (3 хука)

| Hook | API Endpoint | staleTime | Описание |
|------|-------------|-----------|----------|
| `useOrderFunnel` | `GET /dashboard/order-funnel` | 5 мин | Воронка заказов |
| `useOrdersList` | `GET /dashboard/orders` | 5 мин | Список заказов с пагинацией |
| `useOrderDetail` | `GET /dashboard/orders/:id` | 10 мин | Детали заказа |

#### useSalesPlan.ts (8 хуков)

| Hook | API Endpoint | staleTime | Тип |
|------|-------------|-----------|-----|
| `useSalesPlan` | `GET /sales-plan` | 5 мин | query |
| `useUpsertSalesPlan` | `PUT /sales-plan` | -- | mutation |
| `useSalesPlanSummary` | `GET /sales-plan/summary` | 5 мин | query |
| `useUpsertSummaryPlan` | `PUT /sales-plan/summary` | -- | mutation |
| `useResetSalesPlan` | `DELETE /sales-plan/reset` | -- | mutation |
| `usePreviousPlan` | `GET /sales-plan/previous` | 10 мин | query |
| `useSalesPlanCompletion` | `GET /sales-plan/completion` | 5 мин | query |

#### useProducts.ts (5 хуков)

| Hook | API Endpoint | Тип | Описание |
|------|-------------|-----|----------|
| `useProducts` | `GET /products` | query | Список товаров |
| `useUpdatePurchasePrice` | `PUT /products/:id/purchase-price` | mutation | Обновить себестоимость |
| `useReorderProducts` | `PUT /products/reorder` | mutation | Сортировка drag&drop |
| `useLinkProducts` | `POST /products/link` | mutation | Связать WB+Ozon |
| `useUnlinkProducts` | `POST /products/unlink/:id` | mutation | Разорвать связь |

#### useSubscription.ts (5 хуков)

| Hook | API Endpoint | staleTime | Тип |
|------|-------------|-----------|-----|
| `useSubscription` | `GET /subscription` | 10 мин | query |
| `usePlans` | `GET /subscription/plans` | 1 час | query |
| `useUpgrade` | `POST /subscription/upgrade` | -- | mutation |
| `useCancelSubscription` | `POST /subscription/cancel` | -- | mutation |
| `useEnableAutoRenew` | `POST /subscription/enable-auto-renew` | -- | mutation |

#### useSync.ts (6 хуков)

| Hook | API Endpoint | staleTime | Тип |
|------|-------------|-----------|-----|
| `useSyncLogs` | `GET /sync/logs` | 30 сек | query |
| `useSyncStatus` | `GET /sync/status` | 10 сек | query (polling 30s) |
| `useSyncAll` | `POST /sync/all` | -- | mutation |
| `useSyncSales` | `POST /sync/sales` | -- | mutation |
| `useSyncStocks` | `POST /sync/stocks` | -- | mutation |
| `useManualSync` | `POST /sync/manual` | -- | mutation |

#### useTokens.ts (4 хука)

| Hook | API Endpoint | staleTime | Тип |
|------|-------------|-----------|-----|
| `useTokensStatus` | `GET /tokens` | 10 мин | query |
| `useSaveTokens` | `PUT /tokens` | -- | mutation |
| `useValidateTokens` | `POST /tokens/validate` | -- | mutation |
| `useSaveAndSync` | `POST /tokens/save-and-sync` | -- | mutation |

### 5.2 Utility Hooks

| Hook | Файл | Описание |
|------|------|----------|
| `useAuth` | `useAuth.ts` | Supabase auth listener. Один раз в App.tsx |
| `useExport` | `useExport.ts` | Excel (frontend xlsx) + PDF (backend Playwright) |
| `useInView` | `useInView.ts` | IntersectionObserver, опция `once` |
| `useMediaQuery` | `useMediaQuery.ts` | CSS media query hook |
| `useIsMobile` | `useMediaQuery.ts` | `(max-width: 639px)` |
| `useIsTablet` | `useMediaQuery.ts` | `(min-width: 640px) and (max-width: 1023px)` |
| `useIsDesktop` | `useMediaQuery.ts` | `(min-width: 1024px)` |

---

## 6. Stores (Zustand)

### useAuthStore

```typescript
interface AuthState {
  user: User | null;           // Supabase User
  session: Session | null;     // Supabase Session
  isLoading: boolean;          // true при инициализации
  setAuth: (user, session) => void;
  setLoading: (loading) => void;
  logout: () => Promise<void>; // supabase.auth.signOut()
}
```

Используется в: `RootLayout`, `ProtectedRoute`, `Layout`, `ProfileTab`.

### useFiltersStore

```typescript
interface FiltersState {
  datePreset: DateRangePreset;        // '7d' | '30d' | '90d' | 'custom'
  marketplace: Marketplace;           // 'wb' | 'ozon' | 'all'
  customDateFrom: string | null;      // YYYY-MM-DD
  customDateTo: string | null;
  setDatePreset: (preset) => void;
  setMarketplace: (mp) => void;
  setCustomDates: (from, to) => void;
  reset: () => void;
}
```

Значения по умолчанию: `datePreset='7d'`, `marketplace='all'`.

Используется в: `DashboardPage`, `FilterPanel`, `DateRangePicker`, `AdsPage`, `UnitEconomicsPage`, `OrderMonitorPage`.

---

## 7. API Layer (services/api.ts)

### Axios Instance

```typescript
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});
```

### Interceptors

1. **Request interceptor (auth):**
   - Приоритет 1: `window.__PDF_TOKEN` (для PrintPage)
   - Приоритет 2: `supabase.auth.getSession()` -> `Authorization: Bearer <token>`

2. **Response interceptor (401):**
   - При 401 -> redirect на `/login` (кроме PDF-режима)

3. **Dev logging interceptor:**
   - Логирует `[API] GET /url`, время выполнения, размер ответа

### Namespaces (8)

| Namespace | Методы | Описание |
|-----------|--------|----------|
| `productsApi` | `getAll`, `getById`, `getByBarcode`, `updatePurchasePrice`, `reorder`, `link`, `unlink` | CRUD товаров |
| `dashboardApi` | `getSummary`, `getSummaryWithPrev`, `getUnitEconomics`, `getSalesChart`, `getStocks`, `getStockHistory`, `getAdCosts`, `getAdCampaigns`, `getCostsTree`, `getCostsTreeCombined` | Все данные дашборда |
| `ordersApi` | `getFunnel`, `getList`, `getDetail` | Монитор заказов |
| `exportApi` | `exportPdf` | PDF экспорт (blob, timeout 120s) |
| `tokensApi` | `getStatus`, `save`, `validate`, `saveAndSync` | API-токены МП |
| `subscriptionApi` | `getMy`, `getPlans` | Подписки |
| `paymentApi` | `upgrade`, `cancel`, `enableAutoRenew` | Оплата (YooKassa) |
| `syncApi` | `syncAll`, `syncProducts`, `syncSales`, `syncStocks`, `syncCosts`, `syncAds`, `getLogs`, `getStatus`, `manualSync` | Синхронизация |
| `accountApi` | `deleteAccount` | Удаление аккаунта |
| `salesPlanApi` | `getPlans`, `upsertPlans`, `getCompletion`, `getSummary`, `upsertSummary`, `reset`, `getPrevious` | План продаж |

---

## 8. Types (types/index.ts)

80+ типов, организованных по доменам:

### Общие

| Тип | Описание |
|-----|----------|
| `Marketplace` | `'wb' \| 'ozon' \| 'all'` |
| `SyncStatus` | `'success' \| 'error'` |
| `SyncType` | `'products' \| 'sales' \| 'stocks' \| 'costs' \| 'ads' \| 'orders' \| 'all'` |
| `DateRangePreset` | `'7d' \| '30d' \| '90d' \| 'custom'` |
| `LoadingState` | `{ isLoading, error }` |
| `TrendData` | `{ value, change, isPositive }` |

### Продукты

`Product`, `ProductsResponse`, `UpdatePurchasePriceResponse`, `ReorderItem`, `ReorderResponse`, `LinkProductsRequest`, `LinkProductsResponse`, `UnlinkProductsResponse`

### Dashboard

`SalesSummary`, `CostsBreakdown`, `PreviousPeriod`, `DashboardSummaryResponse`, `DashboardSummaryWithPrevResponse`, `DashboardFilters`

### Unit-экономика

`ProductMetrics`, `UnitEconomicsItem`, `UnitEconomicsResponse`

### Графики

`SalesChartDataPoint`, `SalesChartResponse`, `AdCostsChartDataPoint`, `AdCostsResponse`

### Costs Tree

`CostsTreeChild`, `CostsTreeItem`, `CostsTreeResponse`, `CostsTreeCombinedResponse`

### Остатки

`WarehouseStock`, `StockItem`, `StocksResponse`, `StockHistorySeriesItem`, `StockHistoryResponse`

### Синхронизация

`SyncLog`, `SyncLogsResponse`, `SyncResultDetail`, `SyncAllResponse`, `SyncStatusResponse`, `ManualSyncResponse`

### Токены

`TokensStatus`, `TokensInput`, `TokenValidationResult`, `TokensValidateResponse`

### Подписки

`SubscriptionPlan`, `SubscriptionStatus`, `SubscriptionFeatures`, `SubscriptionLimits`, `UserSubscriptionResponse`, `PlanDefinition`, `PlansListResponse`

### Монитор заказов

`OrderStatus`, `Order`, `OrdersListSummary`, `OrdersListResponse`, `OrderDetailResponse`, `OrdersFilters`, `OrderFunnelSummary`, `OrderFunnelDaily`, `OrderFunnelProduct`, `OrderFunnelResponse`

### План продаж

`SalesPlanItem`, `SalesPlanResponse`, `SalesPlanCompletionItem`, `SalesPlanCompletionResponse`, `SalesPlanSummary`, `SalesPlanSummaryResponse`, `PreviousPlanResponse`

### Рекламные кампании

`AdCampaignItem`, `AdCampaignsResponse`, `AdCost`, `AdPerformanceResponse`

### Прибыль per MP

`MpProfitData` -- `{ profit, purchase, ad }`

---

## 9. Routing

### Конфигурация маршрутов (App.tsx)

```
/                       -> RootLayout
                           ├── unauth: LandingPage
                           └── auth: ProtectedRoute -> Layout (Outlet)
                               ├── / (index)        -> DashboardPage
                               ├── /orders           -> OrderMonitorPage
                               ├── /unit-economics   -> UnitEconomicsPage
                               ├── /products         -> Redirect -> /unit-economics
                               ├── /ads              -> AdsPage
                               ├── /sync             -> Redirect -> /settings?tab=connections
                               └── /settings         -> SettingsPage

/login                  -> LoginPage (без защиты)
/reset-password         -> ResetPasswordPage (без защиты)
/print                  -> PrintPage (без Layout, auth через ?token=)
/legal                  -> LegalPage (без защиты)
/policy                 -> PolicyPage (без защиты)
/privacy                -> PrivacyPage (без защиты)
```

### Protected Routes

`ProtectedRoute` проверяет:
1. **Auth:** Есть ли `user` в `useAuthStore` -> иначе redirect `/login`
2. **Onboarding:** Есть ли API-токены (WB или Ozon) -> иначе redirect `/settings` с `state.onboarding=true`
3. **Prefetch:** Подписка загружается при входе

### Navigation (Layout)

Desktop: горизонтальное меню в header.
Mobile: компактная плашка справа с chevron, swipe-to-close.

Пункты: Дашборд | Заказы | Unit-экономика | Реклама | Настройки.

Доступ к пунктам контролируется через `SubscriptionFeatures`.

---

## 10. Стилизация

### Tailwind CSS v3

Конфигурация: Tailwind 3.4.19. **НЕ v4** (архитектурное правило #4).

### Цветовая палитра

| Назначение | Цвет | Tailwind-класс |
|------------|------|----------------|
| Primary (кнопки, ссылки, active) | `#4F46E5` | `indigo-600` |
| Success (прибыль, рост) | `#10B981` | `emerald-500` |
| Danger (убытки, ошибки) | `#EF4444` | `red-500` |
| Warning (предупреждения) | `#F59E0B` | `amber-500` |
| Info | `#0EA5E9` | `sky-500` |
| Accent (реклама) | `#8B5CF6` | `violet-500` |
| WB brand | `#8B3FFD` | -- (custom) |
| OZON brand | `#005BFF` | -- (custom) |
| Neutral | `#F9FAFB..#111827` | `gray-50..gray-900` |

### SummaryCard Accent Colors (7)

`indigo` | `emerald` | `amber` | `red` | `violet` | `sky` | `slate`

### UI-паттерны

**Card:**
```html
<div class="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
```

**Stat tile (gradient):**
```html
<div class="bg-gradient-to-br from-indigo-50 to-white rounded-xl p-4">
```

**Table header:**
```html
<th class="text-xs font-medium text-gray-500 uppercase tracking-wider">
```

**Button primary:**
```html
<button class="bg-indigo-600 text-white rounded-lg px-4 py-2 hover:bg-indigo-700 transition-colors">
```

**Grid карточек (Dashboard):**
```html
<div class="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
```

### Responsive: Mobile-first

```
sm:  640px+   (tablet portrait)
md:  768px+   (tablet landscape)
lg:  1024px+  (desktop)
xl:  1280px+  (wide desktop)
```

Всегда от мобильного к десктопу:
```html
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
```

### Recharts: правило height

**ВСЕГДА** `height={NUMBER}` + `className="sm:!h-[Xpx]"`.

**НИКОГДА** `height="100%"` -- вызывает width(-1)/height(-1) warnings.

```tsx
// ПРАВИЛЬНО
<ResponsiveContainer width="100%" height={140} className="sm:!h-[180px]">
  <AreaChart data={data}>...</AreaChart>
</ResponsiveContainer>

// НЕПРАВИЛЬНО
<ResponsiveContainer width="100%" height="100%">
```

---

## 11. Conventions

### Именование файлов

| Тип | Паттерн | Пример |
|-----|---------|--------|
| Компоненты | `PascalCase.tsx` | `SummaryCard.tsx` |
| Страницы | `PascalCase.tsx` | `DashboardPage.tsx` |
| Hooks | `camelCase.ts` | `useDashboard.ts` |
| Services | `camelCase.ts` | `api.ts` |
| Stores | `camelCase.ts` | `useAuthStore.ts` |
| Types | `index.ts` | `types/index.ts` |
| Utilities | `camelCase.ts` | `utils.ts` |
| Хелперы | `camelCase.ts` | `ueHelpers.ts` |
| Константы | `kebab-case.ts` | `print-constants.ts` |

### Структура компонента

```tsx
// 1. Импорты
import { ... } from '...';

// 2. Types/Interfaces
interface Props {
  data: SalesSummary;
  isLoading?: boolean;
}

// 3. Компонент
export function MyComponent({ data, isLoading }: Props) {
  // 4. Hooks (все в начале)
  const { marketplace } = useFiltersStore();

  // 5. Derived state (useMemo)
  const filtered = useMemo(() => ..., [deps]);

  // 6. Handlers (useCallback)
  const handleClick = useCallback(() => { ... }, []);

  // 7. Early returns
  if (isLoading) return <LoadingSpinner />;
  if (!data) return <EmptyState />;

  // 8. Main render
  return ( ... );
}
```

### Правила кода

- **No `any`** -- всегда явные типы
- **No `useEffect` для загрузки данных** -- только React Query
- **Server state в React Query**, UI state в Zustand
- **useMemo** для тяжёлых вычислений, **useCallback** для handlers в children
- **Компоненты >200 строк** -> разбить на субкомпоненты
- **Null safety:** `data?.value ?? 0`, не `data!.value`
- **Форматирование:** `formatCurrency(value)`, не `value.toFixed(2)`
- **Проверка сборки:** `npm run build` (НИКОГДА `npm run dev` для проверки)

### Env Variables

| Переменная | Описание |
|------------|----------|
| `VITE_API_URL` | URL backend API (`http://localhost:8000/api/v1`) |
| `VITE_SUPABASE_URL` | URL проекта Supabase |
| `VITE_SUPABASE_ANON_KEY` | Anon key Supabase (НЕ JWT) |

### QueryClient Defaults

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 минут
    },
  },
});
```

### Lib Utilities (lib/utils.ts)

| Функция | Описание |
|---------|----------|
| `formatCurrency(value)` | `Intl.NumberFormat('ru-RU', currency: 'RUB')` |
| `formatNumber(value)` | Разделители тысяч |
| `formatPercent(value, decimals)` | `X.X%` |
| `formatDate(date, format)` | `dd.MM.yyyy` по умолчанию |
| `formatDateForAPI(date)` | `yyyy-MM-dd` |
| `getDateRangeFromPreset(preset, from?, to?)` | Диапазон дат по пресету |
| `getMaxAvailableDateYmd()` | T-0 после 10:00 МСК, иначе T-1. **Всегда в МСК TZ** (не зависит от TZ браузера) |
| `normalizeDateRangeYmd(from, to, opts?)` | Нормализация + clamp max |
| `fillDailySeriesYmd(range, data, makeEmpty)` | Заполнение пропусков в дневном ряде |
| `calculatePercentChange(current, prev)` | Процент изменения |
| `isPositiveChange(change, type)` | Для costs/returns снижение = хорошо |
| `cn(...classes)` | Объединение CSS классов |
| `getMarketplaceColor(mp)` | WB=#8B3FFD, Ozon=#005BFF |
| `getMarketplaceName(mp)` | Wildberries / Ozon / Все площадки |
| `debounce(fn, ms)` | Debounce |
| `copyToClipboard(text)` | `navigator.clipboard.writeText` |
| `getTodayYmd()` | Сегодня YYYY-MM-DD (МСК TZ) |

---

## Приложение: Архитектурные правила (frontend-релевантные)

Полный список см. в CLAUDE.md. Ключевые для frontend:

1. **Costs-tree:** отдельные параллельные запросы per marketplace (НЕ combined)
2. **AccrualsCards:** данные через props из DashboardPage
3. **DateRangePicker:** `captionLayout="label"` (НЕ dropdown)
4. **Tailwind v3** (НЕ v4)
5. **Recharts ResponsiveContainer:** ВСЕГДА `height={NUMBER}`, НИКОГДА `height="100%"`
6. **Dashboard Cards:** grid `grid-cols-2 lg:grid-cols-4`, ДРР merged в Реклама
7. **Enterprise Settings:** unified `/settings?tab=`, 5 табов, URL state через `useSearchParams`
8. **ProfitWaterfall:** div-based bars (НЕ Recharts)
9. **Product Management:** 3-col, @dnd-kit, click modals (НЕ hover)
10. **Pricing:** всегда `grid-cols-2`
