# Графики с фильтром товаров

> Секция из 4 графиков (2x2 grid) с боковой панелью для drill-down по конкретному товару. Графики: Заказы/Выкупы/Выручка, Прибыль, ДРР, Конверсия.

**Правила CLAUDE.md:** #17, #22, #25, #26

## Визуальная структура

```
┌─────────┬──────────────────────────────────┐
│ Товары  │  ┌──────────┐  ┌──────────┐     │
│         │  │SalesChart │  │ProfitChart│     │
│ (o) все │  │(табы)     │  │(dual area)│     │
│ ( ) 1.  │  └──────────┘  └──────────┘     │
│ ( ) 2.  │  ┌──────────┐  ┌──────────┐     │
│ ( ) 3.  │  │DrrChart   │  │Conversion │     │
│ ...     │  │(amber)    │  │Chart(sky) │     │
│         │  └──────────┘  └──────────┘     │
└─────────┴──────────────────────────────────┘
  w-28/32/36       flex-1, lg:grid-cols-2
```

Mobile: боковая панель `w-28`, графики `grid-cols-1`. Desktop (lg+): панель `w-36`, графики `grid-cols-2`.

## Файлы

| Компонент | Путь | Props |
|-----------|------|-------|
| Секция (inline) | `frontend/src/pages/DashboardPage.tsx` строки 799-863 | -- |
| SalesChart | `frontend/src/components/Dashboard/SalesChart.tsx` | `{ data: SalesChartDataPoint[], isLoading?: boolean }` |
| ProfitChart | `frontend/src/components/Dashboard/ProfitChart.tsx` | `{ data: Array<{date,revenue?,revenuePlot?,__plotNull?}>, profitMargin: number, isLoading?: boolean }` |
| DrrChart | `frontend/src/components/Dashboard/DrrChart.tsx` | `{ data: AdCostsChartDataPoint[], isLoading?: boolean }` |
| ConversionChart | `frontend/src/components/Dashboard/ConversionChart.tsx` | `{ data: Array<{date,orders?,sales?,ordersPlot?,salesPlot?,__plotNull?}>, isLoading?: boolean }` |
| fillDailySeriesYmd | `frontend/src/lib/utils.ts` строки 120-139 | `(range, data, makeEmpty) => T[]` |

## Data Flow

### SalesChart + ProfitChart + ConversionChart

```
SalesChart / ProfitChart / ConversionChart (data={salesChartSeries})
  └─ DashboardPage: salesChartSeries (useMemo, строки 251-277)
       └─ fillDailySeriesYmd(dateRange, rawData, makeEmpty)
            └─ Hook: useSalesChart(chartFilters)
                 queryKey: ['dashboard', 'sales-chart', chartFilters]
                 staleTime: 5min, refetchInterval: 5min
                 └─ API: dashboardApi.getSalesChart(params)
                      └─ GET /api/v1/dashboard/sales-chart
                           params: date_from, date_to, marketplace, product_id, fulfillment_type
                           └─ Backend: dashboard.py → get_sales_chart()
                                └─ RPC / SQL: mp_sales (группировка по дням)
```

### DrrChart

```
DrrChart (data={adCostsSeriesFull})
  └─ DashboardPage: adCostsSeriesFull (useMemo, строки 279-287)
       └─ fillDailySeriesYmd(dateRange, rawData, makeEmpty)
            └─ Hook: useAdCosts(chartFilters)
                 queryKey: ['dashboard', 'ad-costs', chartFilters]
                 staleTime: 5min, refetchInterval: 5min
                 └─ API: dashboardApi.getAdCosts(params)
                      └─ GET /api/v1/dashboard/ad-costs
                           params: date_from, date_to, marketplace, product_id, fulfillment_type
                           └─ Backend: dashboard.py → get_ad_costs()
                                └─ Tables: mp_ad_costs, mp_sales
```

## Формулы

```
profitMargin = netProfitForTile / revenueForTile          -- средняя маржа за период
dailyProfit  = dailyRevenue * profitMargin                 -- оценка прибыли на день
DRR          = ad_cost / revenue * 100%                    -- доля рекламных расходов
conversion   = sales / orders * 100%                       -- процент выкупа
```

Ссылка: CLAUDE.md секция "Формулы"

## Вычисления на фронтенде

### chartFilters (строки 149-155)

Глобальные фильтры из FilterPanel (`marketplace`, `datePreset`, `fulfillmentType`) + drill-down по товару (`selectedProduct`):

```ts
const chartFilters = {
  date_from: dateRange.from,
  date_to: dateRange.to,
  marketplace,              // из useFiltersStore (глобальный)
  product_id: selectedProduct, // из useState (боковая панель)
  fulfillment_type: ftParam,  // 'all' → undefined
};
```

### salesChartSeries (useMemo, строки 251-277)

1. Берёт сырые данные из `useSalesChart` (`chartData.data`)
2. Находит `lastActual` -- последний день с фактическими данными
3. Вызывает `fillDailySeriesYmd` для заполнения пропусков нулями
4. Добавляет поля `__plotNull`, `ordersPlot`, `salesPlot`, `revenuePlot` -- дни после `lastActual` получают `null` вместо 0 (разрыв линии на графике, а не ложный ноль)

### adCostsSeriesFull (useMemo, строки 279-287)

Аналогично: `fillDailySeriesYmd` + заполнение `{ date, ad_cost:0, revenue:0, drr:0, impressions:0, clicks:0, orders:0 }`.

### profitMargin (строка 444)

```ts
const profitMargin = revenueForTile > 0 ? netProfitForTile / revenueForTile : 0;
```

Рассчитывается в DashboardPage (IIFE, после early returns) и передаётся в ProfitChart как prop. Это средняя маржа за весь выбранный период.

## Боковая панель товаров

**Расположение:** DashboardPage строки 801-831.

- `selectedProduct` -- `useState<string | undefined>(undefined)` (строка 136)
- Radio-кнопки: "все" + список товаров из `useProducts(marketplace)`
- `sidebarProducts` (useMemo, строки 213-216) -- фильтрует системный товар `WB_ACCOUNT`
- Имена товаров обрезаются: `product.name.slice(0, 8)` с `title` для полного имени
- Контейнер: `max-h-32 sm:max-h-48 overflow-y-auto` (скролл при большом количестве SKU)
- Ширина: `w-28 sm:w-32 lg:w-36 flex-shrink-0`

**Защита от WB_ACCOUNT:** useEffect (строки 218-223) сбрасывает `selectedProduct` если выбранный товар оказался системным.

## Детали графиков

### SalesChart (189 строк)

- **Табы:** Заказы (`ordersPlot`, emerald #10b981) | Выкупы (`salesPlot`, indigo #6366f1) | Выручка (`revenuePlot`, purple #8b3ffd)
- **activeTab** -- локальный `useState<ChartTab>('orders')`
- **config** (useMemo, строки 39-66) -- переключает `dataKey`, `stroke`, `fill`, `name`, `formatter` по табу
- **displayData** -- если данных нет, генерирует 7 дней с нулями (пустой график с осями)
- **Tooltip:** показывает все 3 метрики одновременно (заказы, выкупы, выручка)
- **connectNulls={false}** -- разрыв линии в хвосте (после lastActual)

### ProfitChart (185 строк)

- **Dual Area:** revenue (emerald #34d399, fillOpacity 0.4, фоновый слой) + profit (indigo #6366f1 или red #ef4444, fillOpacity 0.6, передний план)
- **Визуальный зазор** между площадями = расходы (удержания + закупка + реклама)
- **Дневная прибыль:** `rev * profitMargin` -- оценка, тренд корректен, абсолютные значения приблизительны
- **Цвет прибыли:** indigo при profitMargin >= 0, red при убытке
- **Tooltip:** "Прибыль*" с пометкой "*Оценка по средней марже периода"
- **Легенда:** мини-legend в header (выручка / прибыль)

### DrrChart (111 строк)

- **Одна Area:** drr (amber #f59e0b / #fef3c7)
- **YAxis:** `tickFormatter={(v) => v + '%'}`
- **Tooltip:** ДРР %, расход в рублях, выручка, пометка "от всех заказов (вкл. непроведённые)"
- **Данные:** из `useAdCosts`, где `drr = ad_cost / revenue * 100`

### ConversionChart (122 строки)

- **Одна Area:** conversion (sky-blue #0ea5e9 / #e0f2fe) -- правило #25
- **Формула:** `(sales / orders) * 100` за каждый день
- **__plotNull:** null-значения для хвоста (разрыв линии)
- **Tooltip:** конверсия %, заказы шт, выкупы шт, пометка "Выкупы / Заказы x 100%"

## Lazy Loading (Suspense)

Все 4 графика lazy-loaded через `React.lazy()` (DashboardPage строки 49-60):

```ts
const SalesChart = lazy(() => import('../components/Dashboard/SalesChart').then(m => ({ default: m.SalesChart })));
const ProfitChart = lazy(() => import('../components/Dashboard/ProfitChart').then(m => ({ default: m.ProfitChart })));
const DrrChart = lazy(() => import('../components/Dashboard/DrrChart').then(m => ({ default: m.DrrChart })));
const ConversionChart = lazy(() => import('../components/Dashboard/ConversionChart').then(m => ({ default: m.ConversionChart })));
```

**Suspense fallback** (строки 835-847): скелетон из 4 карточек с `animate-pulse`. Первый ряд (SalesChart/ProfitChart) выше: `h-[100px] sm:h-[140px]`. Второй ряд (DrrChart/ConversionChart) ниже: `h-[80px] sm:h-[100px]`.

## fillDailySeriesYmd (utils.ts строки 120-139)

Заполняет пропуски в дневном ряде нулями (или кастомным объектом).

```ts
export const fillDailySeriesYmd = <T extends { date: string }>(
  range: { from: string; to: string },
  data: T[],
  makeEmpty: (date: string) => T
): T[] => {
  const byDate = new Map<string, T>();
  for (const item of data) byDate.set(item.date, item);
  // итерация от from до to, подстановка makeEmpty(date) при отсутствии
};
```

**Зачем:** API может вернуть только дни с данными (без нулевых). Графику нужен непрерывный ряд дат для корректной оси X.

## ResponsiveContainer: правило высоты (правило #17)

```tsx
// ПРАВИЛЬНО: height={NUMBER} + className override для sm+
<ResponsiveContainer width="100%" height={100} className="sm:!h-[140px]">

// ЗАПРЕЩЕНО: height="100%" -- вызывает width(-1)/height(-1) warnings
<ResponsiveContainer width="100%" height="100%">
```

Размеры по графикам:
- **SalesChart:** `height={100}` / `sm:!h-[140px]`
- **ProfitChart:** `height={100}` / `sm:!h-[140px]`
- **DrrChart:** `height={80}` / `sm:!h-[100px]`
- **ConversionChart:** `height={80}` / `sm:!h-[100px]`

## Состояние и кэширование

- **Zustand:** `useFiltersStore` (datePreset, marketplace, fulfillmentType, customDateFrom, customDateTo)
- **React Query (sales-chart):** `['dashboard', 'sales-chart', chartFilters]`, staleTime: 5min, refetchInterval: 5min
- **React Query (ad-costs):** `['dashboard', 'ad-costs', chartFilters]`, staleTime: 5min, refetchInterval: 5min
- **enabled:** `true` (всегда загружаются, visibility gating убран)
- **product_id drill-down:** при смене `selectedProduct` -- новый queryKey, React Query делает новый запрос

## Layout (правило #26)

Dashboard layout (lg+): 2x2 charts grid:

| Ряд 1 | SalesChart (Заказы/Выкупы/Выручка) | ProfitChart (revenue + profit) |
|--------|-------------------------------------|-------------------------------|
| **Ряд 2** | **DrrChart** (ДРР %) | **ConversionChart** (Конверсия %) |

Контейнер: `flex flex-row gap-2 sm:gap-3`. Панель товаров слева, графики справа в `grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-3`.

## Edge Cases

1. **Данные не загружены** -- Suspense fallback (скелетон), затем `isLoading` скелетон в каждом графике
2. **Пустой ответ (0 дней)** -- SalesChart/ProfitChart/ConversionChart генерируют 7 дней с нулями, DrrChart аналогично
3. **Хвост без данных** -- `__plotNull: true` + `connectNulls={false}` = разрыв линии (не ложный 0)
4. **WB_ACCOUNT выбран** -- useEffect автоматически сбрасывает selectedProduct в undefined
5. **Одна метрика = 0** -- графики рисуют плоскую линию на оси X

## Зависимости

- **Зависит от:** FilterPanel (datePreset, marketplace, fulfillmentType), useFiltersStore, useSalesChart, useAdCosts, useProducts
- **Используется в:** DashboardPage (секция 4, строки 799-863)
- **Feature gate:** нет (графики доступны на всех тарифах)

## Известные проблемы

- [ ] `chartData` и `adCostsSeriesFull` кастятся через `as any` -- типизация неполная после добавления `__plotNull`/`ordersPlot`
- [ ] SalesChart: при пустых данных генерация 7 дней использует `new Date()` без МСК TZ (не критично для fallback)
