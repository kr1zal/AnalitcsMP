# Аналитические виджеты

> Секция из 4 виджетов в сетке 2x2: Структура прибыли (waterfall), Структура расходов (donut), Топ товаров по прибыли, Запас по дням.

**Правила CLAUDE.md:** #23, #24, #37

## Визуальная структура

```
┌───────────────────────┬───────────────────────┐
│  ProfitWaterfall      │  CostsDonutChart      │
│  Продажи ████████ 100%│    ┌───┐  Комиссия 35%│
│  −Удерж  █████  55%   │   /     \  Логистика25%│
│  −Закупка ███   28%   │  │ donut │ Хранение 15%│
│  −Реклама █     10%   │   \ ___ /  Штрафы   8% │
│  ─────────────────    │    └───┘   Прочее  17% │
│  Прибыль ██     12%   │                        │
│          маржа 12.3%  │        Итого: 45 000   │
├───────────────────────┼───────────────────────┤
│  TopProductsChart     │  StockForecastChart    │
│  1. Витамин D ███ 12к │  Витамин D ██████ 45д  │
│  2. Омега-3   ██  8к  │  Омега-3   ████   28д  │
│  3. Магний    █   5к  │  Магний    ██     14д  │
│  4. Цинк     █   3к  │  Цинк     █       5д  │
│  5. B12      █   2к  │  B12               0д  │
│  2 товара убыточны    │  ≤7д ≤14д ≤30д >30д   │
│            все 6 →    │            все 5 →     │
└───────────────────────┴───────────────────────┘
            sm:grid-cols-2, gap-2 sm:gap-3
```

## Файлы

| Компонент | Путь | Props |
|-----------|------|-------|
| Секция (inline) | `frontend/src/pages/DashboardPage.tsx` строки 866-889 | -- |
| ProfitWaterfall | `frontend/src/components/Dashboard/ProfitWaterfall.tsx` (171 строк) | `{ revenue, mpDeductions, purchase, ads, profit, loading? }` |
| CostsDonutChart | `frontend/src/components/Dashboard/CostsDonutChart.tsx` (199 строк) | `{ ozonTree?, wbTree?, marketplace, loading? }` |
| TopProductsChart | `frontend/src/components/Dashboard/TopProductsChart.tsx` (151 строк) | `{ products: UnitEconomicsItem[], isLoading? }` |
| StockForecastChart | `frontend/src/components/Dashboard/StockForecastChart.tsx` (163 строки) | `{ stocks: StockItem[], isLoading? }` |

## Data Flow

### ProfitWaterfall

```
ProfitWaterfall (revenue, mpDeductions, purchase, ads, profit)
  └─ DashboardPage: вычисления (IIFE, строки 319-438)
       ├─ revenueForTile ← costs-tree "Продажи" + credits
       ├─ mpDeductionsForTile ← costs-tree (отрицательные items)
       ├─ purchaseCostsForTile ← summary.purchase_costs_total || UE fallback
       ├─ adCostForTile ← summary.ad_cost
       └─ netProfitForTile ← payoutForTile - purchaseCostsForTile - adCostForTile
            └─ Hooks: useCostsTree(ozon), useCostsTree(wb), useDashboardSummaryWithPrev, useUnitEconomics
```

### CostsDonutChart

```
CostsDonutChart (ozonTree, wbTree, marketplace)
  └─ DashboardPage (строки 875-879)
       ├─ ozonCostsTreeData.tree ← useCostsTree({marketplace: 'ozon'})
       ├─ wbCostsTreeData.tree ← useCostsTree({marketplace: 'wb'})
       └─ marketplace ← useFiltersStore
```

### TopProductsChart

```
TopProductsChart (products={unitEconomicsData.products})
  └─ Hook: useUnitEconomics(filters)
       queryKey: ['dashboard', 'unit-economics', filters]
       staleTime: 5min, refetchInterval: 5min
       enabled: Boolean(summaryData)
       └─ API: dashboardApi.getUnitEconomics(params)
            └─ GET /api/v1/dashboard/unit-economics
                 params: date_from, date_to, marketplace, fulfillment_type
                 └─ Backend: dashboard.py → get_unit_economics()
                      └─ RPC + Tables: mp_sales, mp_costs, mp_ad_costs, products
```

### StockForecastChart

```
StockForecastChart (stocks={stocksData.stocks})
  └─ Hook: useStocks('all', fulfillmentType)
       queryKey: ['dashboard', 'stocks', 'all', ft]
       staleTime: 10min, refetchInterval: 10min
       └─ API: dashboardApi.getStocks(undefined, ft)
            └─ GET /api/v1/dashboard/stocks
                 params: marketplace (undefined = all), fulfillment_type
                 └─ Backend: dashboard.py → get_stocks()
                      └─ Tables: mp_stocks, mp_sales (avg_daily_sales 30d)
```

## Формулы

```
-- ProfitWaterfall
profit       = payout - purchase - ads                    -- чистая прибыль
margin       = profit / revenue * 100%                    -- маржинальность
bar_width_%  = value / revenue * 100                      -- пропорция бара

-- CostsDonutChart
segment_%    = abs(category_amount) / total_deductions * 100  -- доля категории
total        = SUM(abs(negative tree items))              -- общая сумма удержаний

-- TopProductsChart
bar_width_%  = product_profit / max_profit * 100          -- относительно лучшего

-- StockForecastChart
days_remaining = total_quantity / avg_daily_sales(30d)     -- прогноз в днях
bar_width_%  = days / max_days * 100                       -- относительно максимума
avg_days     = MEAN(days_remaining) по товарам с данными   -- среднее по всем SKU
```

Ссылка: CLAUDE.md секция "Формулы"

## Вычисления на фронтенде

### DashboardPage: передача props (строки 866-889)

Все значения для ProfitWaterfall рассчитываются в DashboardPage через IIFE (после early returns, не useMemo):

```tsx
<ProfitWaterfall
  revenue={revenueForTile}           // строка 343-387: costs-tree "Продажи" + credits
  mpDeductions={mpDeductionsForTile}  // строка 400-410: abs(отрицательные tree items)
  purchase={purchaseCostsForTile}     // строка 319-321: summary.purchase_costs_total || UE sum
  ads={adCostForTile}                 // строка 397: summary.ad_cost
  profit={netProfitForTile}           // строка 427-438: payout - purchase - ads
/>
```

CostsDonutChart получает сырые деревья и сам мержит категории:
```tsx
<CostsDonutChart
  ozonTree={ozonCostsTreeData?.tree}  // ВСЕГДА загружается (правило #36)
  wbTree={wbCostsTreeData?.tree}      // ВСЕГДА загружается (правило #36)
  marketplace={marketplace}            // для фильтрации ozon/wb/all
/>
```

TopProductsChart и StockForecastChart получают массивы данных напрямую из хуков:
```tsx
<TopProductsChart products={unitEconomicsData?.products ?? []} />
<StockForecastChart stocks={stocksData?.stocks ?? []} />
```

## Детали виджетов

### ProfitWaterfall (правило #23)

**Div-based бары** (не Recharts). Пропорции от revenue (100%).

Структура строк:
1. **Продажи** -- emerald, 100%, `text-gray-900`
2. **Удерж. МП** -- red, `(mpDeductions / revenue) * 100%`, со знаком "-"
3. **Закупка** -- orange, `(purchase / revenue) * 100%`, со знаком "-"
4. **Реклама** -- amber, `(ads / revenue) * 100%`, со знаком "-"
5. Разделитель `border-t`
6. **Прибыль** -- indigo (или red при убытке), `abs(margin)%`

**Скрывает нулевые строки:** `.filter((r) => r.value > 0)` (строка 88). Если удержания или реклама = 0, строка не рендерится.

**Header:** "Структура прибыли" + "маржа X.X%" справа (indigo или red).

**Минимальная ширина бара:** `Math.max(2, pct)%` -- даже маленькие значения видны.

**Revenue = 0:** компонент возвращает `null` (строка 54).

### CostsDonutChart

**PieChart (Recharts)** с кольцом (innerRadius=30, outerRadius=50).

Цвета категорий (`CATEGORY_COLORS`, строки 19-32):
| Категория | Цвет | Код |
|-----------|------|-----|
| Комиссия (Ozon/WB) | red | #ef4444 |
| Логистика (доставка) | orange | #f97316 |
| Агенты (Ozon) | purple | #a855f7 |
| FBO (Ozon) | blue | #3b82f6 |
| Промо (Ozon) | yellow | #eab308 |
| Эквайринг (WB) | purple | #a855f7 |
| Хранение (WB) | cyan | #06b6d4 |
| Штрафы (WB) | rose | #f43f5e |

**Fallback-цвета** для неизвестных категорий: indigo, violet, pink, teal, slate.

**Merge по shortLabel:** при `marketplace='all'` категории с одинаковым коротким именем (напр. "Комиссия" от Ozon и WB) суммируются. Реализовано через `Map<string, {fullName, value}>` (строки 62-103).

**WB особенность:** только отрицательные items -- удержания. Положительные (СПП, возмещения) = credits, не учитываются.

**Layout:** flex row -- donut (110x110px фиксированно) слева, легенда справа. Легенда: цветной кружок + shortName + процент.

**Пустой ответ:** возвращает `null` (строка 123).

### TopProductsChart (правило #24)

**Горизонтальные бары** (div-based, не Recharts).

Логика (useMemo, строки 23-37):
1. Фильтрует `WB_ACCOUNT` (системный товар)
2. Сортирует по `net_profit` desc
3. Разделяет на прибыльные и убыточные
4. Берёт top 5 прибыльных (`MAX_VISIBLE = 5`)

**Масштабирование на 100+ SKU:** всегда показывает только top 5. Ссылка "все N -->" ведёт на `/unit-economics` (строки 76-83).

**Ширина бара:** `(product_profit / maxProfit) * 100%`, min 3% для видимости.

**Loss warning** (строки 120-135):
- Показывается под баром при наличии убыточных товаров
- Красный текст: "N товар(ов) убыточны" (русское склонение через `pluralLoss`, строки 64-68)
- Худший товар: имя + сумма убытка (красный)

**Mobile:** дублирует ссылку "Все N товаров -->" в `sm:hidden` блоке внизу (строки 138-147).

**Пустой ответ:** если нет ни прибыльных, ни убыточных -- возвращает `null`.

### StockForecastChart

**Горизонтальные бары** (div-based, не Recharts). Правило #37: остатки ВСЕГДА показывают все МП (marketplace='all').

Цветовые пороги (`getColors`, строки 21-27):
| Порог | Бар | Текст |
|-------|-----|-------|
| null | bg-gray-300 | text-gray-400 |
| <=7 дней | bg-red-500 | text-red-700 |
| <=14 дней | bg-amber-500 | text-amber-700 |
| <=30 дней | bg-blue-500 | text-blue-700 |
| >30 дней | bg-emerald-500 | text-emerald-700 |

**Сортировка:** ascending по `days_remaining` -- критичные товары (0-7д) вверху, null (нет данных) в конце.

**Header:** "Запас по дням" + "Ср. XXд" справа (среднее по товарам с данными).

**Footer:**
- Легенда 4 цветов (red/amber/blue/emerald с пороговыми значениями)
- Ссылка "все N -->" -- `scrollIntoView({ behavior: 'smooth' })` к `#stocks-table` (строки 151-157)

**Фильтрация:** WB_ACCOUNT исключается (строка 38).

**Пустой ответ:** возвращает `null` (строка 83).

## Grid Layout

Контейнер (DashboardPage строка 866):

```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mb-4 sm:mb-5 lg:mb-6">
```

| Позиция (sm+) | Виджет |
|---------------|--------|
| Лево-верх | ProfitWaterfall |
| Право-верх | CostsDonutChart |
| Лево-низ | TopProductsChart |
| Право-низ | StockForecastChart |

Mobile (`grid-cols-1`): виджеты стекаются вертикально в том же порядке.

## Состояние и кэширование

- **Zustand:** `useFiltersStore` (datePreset, marketplace, fulfillmentType)
- **React Query (costs-tree ozon):** `['dashboard', 'costs-tree', {marketplace:'ozon',...}]`, staleTime: 5min
- **React Query (costs-tree wb):** `['dashboard', 'costs-tree', {marketplace:'wb',...}]`, staleTime: 5min
- **React Query (unit-economics):** `['dashboard', 'unit-economics', filters]`, staleTime: 5min, enabled: `Boolean(summaryData)`
- **React Query (stocks):** `['dashboard', 'stocks', 'all', ft]`, staleTime: 10min, refetchInterval: 10min
- **Общие данные:** ProfitWaterfall и CostsDonutChart используют одни и те же costs-tree ответы (не дублируют запросы)

## Edge Cases

1. **Revenue = 0** -- ProfitWaterfall возвращает `null`, CostsDonutChart может показать пустой donut (нет отрицательных items)
2. **Нет товаров с прибылью** -- TopProductsChart показывает "Нет прибыльных товаров" + loss warning
3. **Нет остатков** -- StockForecastChart возвращает `null`
4. **days_remaining = null** -- StockForecastChart показывает "--" с серым баром (нулевой ширины)
5. **marketplace='all'** -- CostsDonutChart мержит одноимённые категории Ozon и WB; StockForecastChart всегда показывает все МП
6. **WB credits (positive items)** -- CostsDonutChart отфильтровывает их (строка 70: `item.amount >= 0` при WB)
7. **Costs-tree загружается** -- ProfitWaterfall и CostsDonutChart показывают loading skeleton

## Зависимости

- **Зависит от:** FilterPanel (фильтры), useCostsTree (ozon + wb), useUnitEconomics, useStocks, useDashboardSummaryWithPrev
- **Используется в:** DashboardPage (секция 4.5, строки 866-889)
- **Feature gate:** нет (виджеты доступны на всех тарифах)
- **Навигация:** TopProductsChart -> `/unit-economics`, StockForecastChart -> `#stocks-table` (scroll)

## Известные проблемы

- [ ] CostsDonutChart: `ResponsiveContainer height={110}` -- фиксированная высота, не адаптируется под количество категорий в легенде
- [ ] TopProductsChart: `WB_ACCOUNT` фильтруется по `product.name.startsWith(...)` -- если пользователь создаст товар с таким именем, он будет скрыт
