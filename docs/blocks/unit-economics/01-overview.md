# Unit-экономика: Обзор страницы

> Оркестратор UE-страницы: KPI-карточки, план-панель, BCG-матрица, координация 11 подкомпонентов

**Правила CLAUDE.md:** #18, #34, #43

## Визуальная структура

```
+-----------------------------------------------------------+
| Header: "Unit-экономика" + FT badge + (N товаров, период) |
+-----------------------------------------------------------+
| FilterPanel (sticky, общий)                               |
+-----------------------------------------------------------+
| UePlanPanel: прогресс-бар + темп/прогноз + ссылка         |
+-----------------------------------------------------------+
| UeKpiCards Row 1: Выручка | Прибыль | Ср.маржа | Приб/ед  |
| UeKpiCards Row 2: ROI | ROAS? | Возвраты? | План? | Тов.  |
+-----------------------------------------------------------+
| UePlanMatrix (2x2): Звёзды | Ловушки | Потенциал | Пробл. |
+-----------------------------------------------------------+
| UeProfitBars: TOP-5 bars + ... + BOTTOM-3 bars            |
+-----------------------------------------------------------+
| UeCostStructure: стековый бар (закупка|удерж.|рекл.|приб.) |
+-----------------------------------------------------------+
| UeTable: search + filter tabs + sort + pagination         |
|   Expandable rows → UeExpandedRow (WB/OZON cards)         |
+-----------------------------------------------------------+
```

## Файлы

| Компонент | Путь | Строк | Props / назначение |
|-----------|------|-------|--------------------|
| UnitEconomicsPage | `frontend/src/pages/UnitEconomicsPage.tsx` | 325 | Оркестратор, без props (page-level) |
| UeKpiCards | `frontend/src/components/UnitEconomics/UeKpiCards.tsx` | 190 | `{ totals, productCount, profitableCount, hasAds, hasReturns, planData }` |
| UePlanPanel | `frontend/src/components/UnitEconomics/UePlanPanel.tsx` | 142 | `{ planData, month }` |
| UePlanMatrix | `frontend/src/components/UnitEconomics/UePlanMatrix.tsx` | 113 | `{ quadrants, activeQuadrant, onQuadrantClick }` |
| UeProfitBars | `frontend/src/components/UnitEconomics/UeProfitBars.tsx` | 114 | `{ products, abcMap }` |
| UeCostStructure | `frontend/src/components/UnitEconomics/UeCostStructure.tsx` | 66 | `{ totals, hasAds }` |
| UeTable | `frontend/src/components/UnitEconomics/UeTable.tsx` | 668 | 18 props (см. 03-table.md) |
| ueHelpers | `frontend/src/components/UnitEconomics/ueHelpers.ts` | 223 | ABC, alerts, sorting, filtering, totals |
| uePlanHelpers | `frontend/src/components/UnitEconomics/uePlanHelpers.ts` | 230 | Pace/forecast, matrix classification |

## Data Flow

```
UnitEconomicsPage (строки 79-325)
  ├─ useFiltersStore() → datePreset, marketplace, fulfillmentType
  ├─ getDateRangeFromPreset() → dateRange.from / dateRange.to
  │
  ├─ useUnitEconomics(filters)                    ← основные UE данные
  │     queryKey: ['dashboard', 'unit-economics', filters]
  │     staleTime: 5min, refetchInterval: 5min
  │     └─ dashboardApi.getUnitEconomics(filters)
  │          └─ GET /api/v1/dashboard/unit-economics
  │               params: date_from, date_to, marketplace, fulfillment_type
  │               feature gate: unit_economics (Pro+)
  │               └─ dashboard.py → get_unit_economics() (строки 199-509)
  │                    ├─ mp_products (user products)
  │                    ├─ mp_sales (sales analytics)
  │                    ├─ mp_costs (deductions + settled_qty)
  │                    ├─ mp_ad_costs (ads per product)
  │                    └─ _fetch_costs_tree_merged() → total_payout
  │
  ├─ useUnitEconomics({...filters, marketplace: 'wb'})   ← WB данные (enabled: marketplace === 'all')
  ├─ useUnitEconomics({...filters, marketplace: 'ozon'}) ← OZON данные (enabled: marketplace === 'all')
  │
  ├─ useProducts()                                 ← для product_group_id matching
  │     queryKey: ['products', undefined]
  │     staleTime: 30min
  │
  ├─ useSalesPlanCompletion(filters)              ← план продаж completion
  │     └─ GET /api/v1/sales-plan/completion
  │
  ├─ useSalesPlan(planMonth, 'wb')                ← per-MP план (WB)
  └─ useSalesPlan(planMonth, 'ozon')              ← per-MP план (OZON)
```

## Вычисления на фронтенде

### UnitEconomicsPage (оркестратор)

Все вычисления в `useMemo` (строки 119-205):

1. **totals** (строка 124): `computeTotals(unitProducts)` — агрегат revenue/purchase/mpCosts/adCost/profit/sales/returns
2. **abcMap** (строка 128): `classifyABC(unitProducts)` — ABC-классификация по кумулятивной прибыли
3. **planMap** (строки 131-140): `Map<productId, completion_percent>` из `planData.by_product`
4. **planPaceMap** (строка 143): `buildPlanPaceMap(planData)` — прогноз/темп per product
5. **matrixData** (строки 148-151): `classifyMatrix(unitProducts, planMap)` — 4 квадранта BCG
6. **mpBreakdown** (строки 202-205): `buildMpBreakdown()` — соединение WB/OZON данных через `product_group_id`
7. **wbPlanMap / ozonPlanMap** (строки 161-195): план-прогресс per-product per-MP

### buildMpBreakdown (строки 38-75)

Соединяет данные all/wb/ozon по `product_group_id`:
- Строит `groupMap` из products (wb_nm_id → wb_product_id, ozon_product_id → ozon_product_id)
- Для каждого товара из allProducts ищет соответствующие WB/OZON записи
- Если прямого совпадения нет — ищет через product_group_id (linked products)

## KPI-карточки (UeKpiCards)

### Ряд 1 — Основные (фиксированный, 4 карточки)

| Карточка | Значение | Sub-text | Цвет |
|----------|----------|----------|------|
| Выручка | `formatCurrency(totals.revenue)` | `N шт · M возвр.` | blue |
| Прибыль | `formatCurrency(totals.profit)` | "в плюсе" / "убыток" | green / red |
| Ср. маржа | `formatPercent(profit/revenue*100)` | "хорошо" / "средне" / "низкая" | green>=20 / yellow>=10 / red |
| Прибыль/ед. | `formatCurrency(profit/sales)` | "среднее" | green>=0 / red |

### Ряд 2 — Расширенные (динамический, 2-5 карточек)

| Карточка | Условие | Формула |
|----------|---------|---------|
| ROI | всегда | `profit / (purchase + ads) * 100` |
| ROAS | `hasAds` | `revenue / adCost` (множитель, напр. `3.2x`) |
| Возвраты | `hasReturns` | `returns / (sales + returns) * 100` |
| План | `planData.total_plan > 0` | `completion_percent` из backend |
| Товаров | всегда | `productCount` + `profitableCount приб. · lossCount убыт.` |

Количество колонок второго ряда адаптируется: `sm:grid-cols-2/3/4` в зависимости от `row2Cards.length`.

## План-панель (UePlanPanel)

**Если план не задан** (строки 35-52): компактная строка "План продаж не задан" + ссылка "Задать план" на `/settings?tab=plan`.

**Если план задан** (строки 60-141):
- Collapsible (useState `open`, по умолчанию раскрыта)
- Header: иконка Target + "План продаж: Февраль 2026" + badge `XX%`
- Progress bar: цвет через `getCompletionBarColor()` (emerald>=100%, indigo>=70%, amber)
- Метрики: `Xр из Yр` | Темп: `Zр/день` | Прогноз: `~N%` | Нужно: `Wр/день`
- Темп рассчитывается через `computePlanPace()` (фронтенд)
- Footer: ссылка "Редактировать план" на `/settings?tab=plan`

### computePlanPace (uePlanHelpers, строки 82-119)

```
dailyPace = actualRevenue / currentDay
forecastRevenue = dailyPace * totalDays
forecastPct = forecastRevenue / planRevenue * 100
requiredDaily = (planRevenue - actualRevenue) / remainingDays
status: ahead (forecast>=105%), on_track (>=95%), behind (<95%)
```

## BCG-матрица (UePlanMatrix)

Сетка 2x2, показывается только при `hasPlan && unitProducts.length > 0`.

| Квадрант | Условие | Иконка | Цвет |
|----------|---------|--------|------|
| Звёзды | план>=70% И прибылен | `★` | emerald |
| Ловушки | план>=70% И убыточен | `⚠` | red |
| Потенциал | план<70% И прибылен | `↗` | blue |
| Проблемы | план<70% И убыточен | `↓` | gray |

- Клик по квадранту фильтрует таблицу (через `matrixFilter` → `matrixProductIds`)
- Повторный клик снимает фильтр
- Пустые квадранты (`count === 0`) — disabled, `opacity-40`
- Каждая карточка: count, суммарная выручка, суммарная прибыль

## Backend логика

**Endpoint:** `GET /api/v1/dashboard/unit-economics` (строки 199-509 в `dashboard.py`)

**Feature gate:** `require_feature("unit_economics")` — Pro+ план.

**Параметры:**
- `date_from`, `date_to` — период (default: последние 30 дней)
- `marketplace` — фильтр МП (all/wb/ozon)
- `fulfillment_type` — FBO/FBS (regex `^(FBO|FBS)$`)

**Шаги:**
1. Загрузка `mp_products` пользователя
2. Агрегация `mp_sales` (sales_count, revenue, returns) с фильтрами
3. Агрегация `mp_costs` (total_costs + Ozon settled_qty)
4. Агрегация `mp_ad_costs` (attributed + unattributed)
5. FBO/FBS breakdown: `ft_sales`, `ft_costs`, `ft_settled_qty`
6. Costs-tree payout: `_fetch_costs_tree_merged()` для каждого МП
7. Распределение unattributed рекламы пропорционально выручке
8. Per-product расчёт: revenue/mp_costs/purchase/profit/drr/unit_profit
9. Сортировка по net_profit desc

**Ответ:** `UnitEconomicsResponse` — products[], total_ad_cost, total_payout, total_returns, costs_tree_ratio (deprecated=1.0)

## Формулы

```
profit_i = payout_share_i - purchase_i - ad_i              -- правило #18
payout_share_i = total_payout * (mp_sales_revenue_i / Σmp_sales_revenue)
displayed_revenue_i = costs_tree_revenue * share_i          -- включает credits (СПП)
mp_costs_i = displayed_revenue_i - payout_share_i           -- всегда >= 0

purchase_ozon = purchase_price * settled_qty                -- settlement-based, правило #43
purchase_wb   = purchase_price * sales_count                -- order-based

drr_i = ad_cost_i / displayed_revenue_i * 100
unit_profit_i = net_profit_i / sales_count_i
margin_i = net_profit_i / revenue_i * 100

ROI = profit / (purchase + ads) * 100                       -- KPI card
ROAS = revenue / ads                                        -- KPI card
return_rate = returns / (sales + returns) * 100             -- KPI card
```

Ссылка: CLAUDE.md секция "Формулы"

## Состояние и кэширование

- **Zustand:** `useFiltersStore` (datePreset, marketplace, fulfillmentType, customDateFrom, customDateTo)
- **React Query keys:**
  - `['dashboard', 'unit-economics', filters]` — основные UE данные
  - `['dashboard', 'unit-economics', {...filters, marketplace: 'wb'}]` — WB breakdown
  - `['dashboard', 'unit-economics', {...filters, marketplace: 'ozon'}]` — OZON breakdown
  - `['products', undefined]` — список товаров
  - `['sales-plan', 'completion', filters]` — план completion
  - `['sales-plan', month, 'wb']` / `['sales-plan', month, 'ozon']` — per-MP планы
- **staleTime:** 5min (UE), 30min (products)
- **refetchInterval:** 5min (UE)
- **enabled:**
  - WB/OZON data: `marketplace === 'all' && !!unitData` (только при "Все" и после загрузки основных данных)
  - Main UE: всегда `true`

## Edge Cases

1. **Данные не загружены** — `<LoadingSpinner text="Загрузка unit-экономики..." />`
2. **Ошибка API** — красный блок с `error.message`
3. **Пустой ответ** — KPI с нулями, пустая таблица "Нет данных за период"
4. **План не задан** — UePlanPanel показывает "не задан" + ссылку, матрица скрыта, колонка "План" в таблице скрыта
5. **Feature gate** — `<FeatureGate feature="unit_economics">` оборачивает всю страницу; Free-план видит приглашение к обновлению
6. **FT фильтр без fbs_analytics** — backend сбрасывает `fulfillment_type=None`, `include_ft_breakdown=False`
7. **Costs-tree недоступен** — fallback на `mp_sales/mp_costs` (profit = revenue - costs - purchase - ads)
8. **Один МП** — при `marketplace='wb'` или `marketplace='ozon'` per-MP запросы не делаются; expanded row показывает только выбранный МП

## Зависимости

- **Зависит от:** FilterPanel (фильтры), useFiltersStore (Zustand), useUnitEconomics / useSalesPlanCompletion / useSalesPlan (данные), useProducts (product_group_id)
- **Используется в:** Routing (`/unit-economics`), ссылки из TopProductsChart ("все N ->")
- **Feature gate:** `unit_economics` (Pro+)

## Известные проблемы

- [ ] `costs_tree_ratio` в ответе backend = 1.0 (deprecated, оставлено для совместимости, не используется)
- [ ] При большом количестве товаров (100+ SKU) 3 параллельных запроса UE (all/wb/ozon) могут замедлять загрузку
