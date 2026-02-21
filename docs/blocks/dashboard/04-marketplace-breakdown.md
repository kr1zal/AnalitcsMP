# MarketplaceBreakdown — Карточки OZON / WB

> Два параллельных блока с детализацией начислений, удержаний и прибыли по каждому маркетплейсу. Загружаются ВСЕГДА, независимо от глобального фильтра МП.

**Правила CLAUDE.md:** #1, #2, #19, #35, #36

## Визуальная структура

```
┌────────────────────────────────────────────────────────────┐
│  grid grid-cols-2 gap-2 sm:gap-3                           │
│ ┌──────────────────────┐  ┌──────────────────────────────┐ │
│ │ OZON        [Детали ▼]│  │ WB               [Детали ▼] │ │
│ │ Продажи    Начислено  │  │ Продажи (?)    Начислено (?) │ │
│ │ 45 230      38 100    │  │ 72 400 (?)      61 200 (?)  │ │
│ │ ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░  │  │ ▓▓▓▓▓▓▓▓▓░░░░  sales bar   │ │
│ │ Удержания    -7 130   │  │ Удержания       -11 200     │ │
│ │ ▓▓▓▓░░░░ costs bar    │  │ ▓▓▓▓▓▓░░░ costs bar         │ │
│ │ ● Комиссия   -3 200   │  │ ● Комиссия ВВ   -5 100     │ │
│ │ ● Доставка   -2 800   │  │ ● Доставка      -3 400     │ │
│ │ ● Агенты       -650   │  │ ● Эквайринг     -1 800     │ │
│ │ ● FBO          -480   │  │ ● Хранение        -900     │ │
│ │ ────────────────────  │  │ ● СПП           +1 500     │ │
│ │ Прибыль (?)   12 400  │  │ ────────────────────────    │ │
│ │ маржа 27.4%           │  │ Прибыль (?)      18 300    │ │
│ │                        │  │ маржа 25.3%                │ │
│ └──────────────────────┘  └──────────────────────────────┘ │
│                                                            │
│ (?) = HelpCircle тултип (group-hover)                      │
└────────────────────────────────────────────────────────────┘
```

## Файлы

| Компонент | Путь | Props |
|-----------|------|-------|
| MarketplaceBreakdown | `frontend/src/components/Dashboard/MarketplaceBreakdown.tsx` | `{ ozonCostsTree, ozonCostsTreeLoading, wbCostsTree, wbCostsTreeLoading, ozonProfit, wbProfit }` |
| OzonAccrualsCard | `frontend/src/components/Dashboard/OzonAccrualsCard.tsx` | `{ detailsOpen?, onToggleDetails?, costsTreeData, isLoading?, profitData? }` |
| WbAccrualsCard | `frontend/src/components/Dashboard/WbAccrualsCard.tsx` | `{ detailsOpen?, onToggleDetails?, costsTreeData, isLoading?, profitData? }` |
| DashboardPage | `frontend/src/pages/DashboardPage.tsx` | (оркестратор, строки 167–482) |

## Data Flow

```
MarketplaceBreakdown (ozonCostsTree, wbCostsTree, ozonProfit, wbProfit)
  ├─ OzonAccrualsCard (costsTreeData={ozonCostsTreeData})
  └─ WbAccrualsCard (costsTreeData={wbCostsTreeData})
       └─ DashboardPage вычисления:
            ├─ ozonCostsTreeData ← useCostsTree({...filters, marketplace: 'ozon'})  (строка 174)
            ├─ wbCostsTreeData   ← useCostsTree({...filters, marketplace: 'wb'})    (строка 177)
            ├─ ozonProfitData    ← IIFE (строки 450–465)
            └─ wbProfitData      ← IIFE (строки 467–482)
                 └─ Hook: useCostsTree(filters)                     (useDashboard.ts, строка 122)
                      queryKey: ['dashboard', 'costs-tree', filters]
                      staleTime: 5min
                      refetchInterval: 5min
                      enabled: true  (ВСЕГДА, правило #36)
                      └─ API: dashboardApi.getCostsTree(params)     (api.ts, строка 308)
                           └─ GET /api/v1/dashboard/costs-tree
                                params: date_from, date_to, marketplace, include_children, fulfillment_type
                                └─ Backend: dashboard.py → get_costs_tree()  (строка 821)
                                     └─ _fetch_costs_tree_merged()           (строка 94)
                                          ├─ FT задан → 1 RPC: get_costs_tree(p_fulfillment_type)
                                          └─ FT=NULL  → 2 RPC: FBO + FBS → _merge_costs_tree_data()
                                               └─ RPC: get_costs_tree(p_date_from, p_date_to,
                                                    p_marketplace, p_product_id,
                                                    p_include_children, p_user_id,
                                                    p_fulfillment_type)
                                                    └─ Tables: mp_costs_details, mp_costs, mp_sales
```

## Формулы

```
-- Per-MP profit (вычисляется в DashboardPage, IIFE, строки 450–482)
share         = pureSales_mp / (pureSales_ozon + pureSales_wb)
purchase_mp   = purchaseCostsForTile × share
ad_mp         = summary.ad_cost × share
profit_mp     = total_accrued_mp - purchase_mp - ad_mp

-- Когда фильтр МП активен (marketplace === 'ozon'|'wb'), share = 1
-- Это предотвращает двойной дисконт и завышение прибыли

-- WB Продажи (displayed)
salesDisplay  = salesTotal + creditsTotal     -- СПП + возмещения включены (правило #19)
creditsTotal  = SUM(tree items WHERE amount > 0 AND name != 'Продажи')

-- WB Удержания (только отрицательные items)
costsTotal    = SUM(tree items WHERE name != 'Продажи' AND amount < 0)

-- OZON Продажи — tree["Продажи"] as-is (нет credits, правило #21)
-- OZON Удержания — SUM(все tree items кроме "Продажи")

-- Маржа
margin_ozon   = profit / |salesTotal| × 100%
margin_wb     = profit / |salesTotal + creditsTotal| × 100%

-- Structure bar proportions
bar_segment%  = |item.amount| / |totalAbs| × 100%
```

Ссылка: CLAUDE.md секция "Формулы", правила #10, #19, #21

## Вычисления на фронтенде

### DashboardPage — загрузка данных (строки 167–179)

Два вызова `useCostsTree` выполняются ПАРАЛЛЕЛЬНО с `include_children: true`:
- `ozonCostsTreeData` — `{...filters, marketplace: 'ozon'}` (строка 174)
- `wbCostsTreeData` — `{...filters, marketplace: 'wb'}` (строка 177)

Оба всегда `enabled: true` — MarketplaceBreakdown показывает карточки OZON и WB независимо от глобального фильтра МП (правило #36).

### DashboardPage — IIFE для per-MP profit (строки 450–482)

Используется IIFE (а не `useMemo`), так как код находится после early returns (строки 289–311). React hooks нельзя вызывать условно.

**ozonProfitData (строки 450–465):**
1. `ozonPayout = ozonCostsTreeData.total_accrued`
2. Если `marketplace === 'ozon'` — `share = 1` (данные уже фильтрованы)
3. Иначе: `share = ozonPureSales / (ozonPureSales + wbPureSales)`
   - `pureSales` — tree item с `name === 'Продажи'`
4. `purchase = purchaseCostsForTile × share`
5. `ad = summary.ad_cost × share`
6. `profit = ozonPayout - purchase - ad`

**wbProfitData (строки 467–482):** — аналогично, зеркальный расчёт.

### OzonAccrualsCard — useMemo computed (строка 113)

- `salesItem` = tree.find('Продажи')
- `costItems` = tree.filter(NOT 'Продажи')
- `salesTotal` = salesItem.amount
- `costsTotal` = SUM(costItems)
- `salesChildren` = salesItem.children (для разбивки: Выручка / Баллы / Партнёры)
- `costsForList` = costItems sorted by |amount| desc

### WbAccrualsCard — useMemo computed (строка 76)

- `salesTotal` = tree.find('Продажи').amount
- `costsTotal` = SUM(tree items WHERE amount < 0, кроме "Продажи") — только отрицательные
- `creditsTotal` = SUM(tree items WHERE amount > 0, кроме "Продажи") — СПП, возмещения
- `costsForList` = только отрицательные items, sorted by |amount| desc, показываются max 4 + "ещё N"

**WB СПП тултип (строка 165–173):**
Показывается когда `creditsTotal > 0.01`. Тултип открывается ВЛЕВО на мобиле (`-right-2`) для предотвращения вылета за viewport. Содержит разбивку: Продажи + СПП/возмещения = Итого.

## Backend логика

### Endpoint: `GET /dashboard/costs-tree` (dashboard.py, строка 821)

**Параметры:**
- `date_from`, `date_to` — период (YYYY-MM-DD)
- `marketplace` — `ozon` или `wb`
- `product_id` — UUID товара (опционально)
- `include_children` — детализация подкатегорий (Free план: false)
- `fulfillment_type` — `FBO` или `FBS` (опционально)

**Feature gate:** `costs_tree_details` — Free план получает только верхний уровень (без children).

**Вызывает:** `_fetch_costs_tree_merged()` (строка 94).

### Хелпер: `_fetch_costs_tree_merged()` (dashboard.py, строка 94)

Центральный хелпер для FBO/FBS merge. Используется в 4 местах:
- `/dashboard/costs-tree`
- `/dashboard/costs-tree-combined`
- `/dashboard/unit-economics` (строка 353)
- `/dashboard/order-funnel` (строка 1208)

**Логика:**
1. Если `fulfillment_type` задан (FBO или FBS) — один вызов RPC `get_costs_tree`
2. Если `fulfillment_type=None` ("Все") — два вызова:
   - RPC с `p_fulfillment_type='FBO'`
   - RPC с `p_fulfillment_type='FBS'`
3. Если FBS данных нет (`|fbs_accrued| < 0.01` и `|fbs_revenue| < 0.01`) — возвращает FBO as-is
4. Иначе — мержит через `_merge_costs_tree_data()`

### Хелпер: `_merge_costs_tree_data()` (dashboard.py, строка 23)

Объединяет два RPC-ответа:
- Суммирует `total_accrued`, `total_revenue`, `percent_base_sales`
- Объединяет tree items по `name`:
  - Существующий item: суммирует `amount`, мержит `children` по subcategory name
  - Новый item: добавляет в tree
- Устанавливает `source: "merged"`
- Пропускает items с `|amount| < 0.01`

### RPC: `get_costs_tree`

Определена в миграциях (002, 003, 006, 018, 019, 020). Параметры:
- `p_date_from`, `p_date_to`, `p_marketplace`, `p_product_id`
- `p_include_children`, `p_user_id`, `p_fulfillment_type`

Таблицы: `mp_costs_details` (primary) с fallback на `mp_sales` + `mp_costs`.

## Типы данных

```typescript
// frontend/src/types/index.ts

interface CostsTreeItem {           // строка 261
  name: string;
  amount: number;
  percent: number | null;
  children: CostsTreeChild[];
}

interface CostsTreeResponse {       // строка 268
  status: 'success';
  period: { from: string; to: string };
  marketplace: Marketplace;
  total_accrued: number;
  total_revenue: number;
  percent_base_sales?: number;
  warnings?: string[];
  source?: string;
  tree: CostsTreeItem[];
}

interface MpProfitData {            // строка 496
  profit: number;
  purchase: number;
  ad: number;
}

interface MarketplaceBreakdownProps {  // MarketplaceBreakdown.tsx, строка 10
  ozonCostsTree?: CostsTreeResponse | null;
  ozonCostsTreeLoading?: boolean;
  wbCostsTree?: CostsTreeResponse | null;
  wbCostsTreeLoading?: boolean;
  ozonProfit?: MpProfitData | null;
  wbProfit?: MpProfitData | null;
}
```

## Состояние и кэширование

- **Zustand:** `useFiltersStore` (datePreset, marketplace, fulfillmentType) — marketplace из фильтра НЕ влияет на загрузку (оба МП всегда загружаются)
- **React Query key:** `['dashboard', 'costs-tree', { ...filters, marketplace: 'ozon'|'wb', include_children: true }]`
- **staleTime:** 5 мин
- **refetchInterval:** 5 мин
- **enabled:** `true` (всегда, правило #36)
- **Синхронизация деталей:** `detailsOpen` state в MarketplaceBreakdown (строка 27), передаётся обеим карточкам — раскрытие/свёртывание синхронизировано

## Визуализация — Structure Bar

### Sales bar
- **OZON:** если есть `salesChildren` — сегменты по подкатегориям (Выручка=teal, Баллы=emerald-300, Партнёры=emerald-200). Иначе — сплошной teal
- **WB:** два сегмента — sales (teal-400) + credits/СПП (emerald-300). Пропорция: `|salesTotal| / (|salesTotal| + creditsTotal)`

### Costs bar
- **OZON:** цветовое кодирование: Комиссия=blue, Доставка=yellow, Агенты=violet, FBO=orange, Промо=pink, прочие=gray
- **WB:** Комиссия ВВ=purple, Логистика=yellow, Эквайринг=violet, Хранение=orange, Штрафы=pink, прочие=gray
- Ширина сегмента пропорциональна `|amount| / |costsAbs|`

### Costs list
- **OZON:** все items, sorted by |amount| desc
- **WB:** top 4 items + "+N ещё" если больше. СПП показывается отдельно внизу (emerald-300 dot)

## Edge Cases

1. **Данные ещё не загружены** — skeleton-анимация (animate-pulse) в каждой карточке
2. **Пустой ответ (нет данных)** — "Нет данных за период" с заголовком МП
3. **Ошибка API** — обрабатывается в DashboardPage (early return с красным блоком). Внутри карточек `error = null`
4. **Warnings от backend** — amber-блок с текстом warning + source (например, fallback без mp_costs_details)
5. **profitData = null** — секция "Прибыль" не рендерится (данные summary ещё не загружены)
6. **marketplace filter активен** — share = 1 для matching карточки, profit корректен
7. **Суммы без символа рубля** — `formatOzonAmount` / `formatWbAmount` возвращают число без `₽` (экономия места на mobile)

## Зависимости

- **Зависит от:** FilterPanel (datePreset, fulfillmentType), useCostsTree (данные), DashboardPage (profit вычисления)
- **Используется в:** DashboardPage (строка 789), PrintPage
- **Feature gate:** `costs_tree_details` (Free план = без children) / нет gate для самих карточек
- **Поставляет данные:** `ozonCostsTreeData` и `wbCostsTreeData` используются также для: revenueForTile, payoutForTile, mpDeductionsForTile, netProfitForTile, CostsDonutChart, ProfitWaterfall

## Известные проблемы

- [ ] WB `reportDetailByPeriod` может не содержать FBS данные в `mp_costs_details` — FBS берётся из fallback (mp_sales + mp_costs). Merge корректен, но tree structure может отличаться от primary
