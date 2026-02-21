# Реклама — обзор страницы

> Страница рекламной аналитики: KPI карточки (4x2), графики ДРР и Расход vs Выручка, собственная панель фильтров с локальным МП-фильтром.

**Правила CLAUDE.md:** #41

## Визуальная структура

```
+-----------------------------------------------+
| Реклама                                        |
+-----------------------------------------------+
| СОБСТВЕННАЯ панель фильтров (НЕ FilterPanel)   |
| mobile: sticky top-0 z-30                      |
| desktop: sticky top-16 z-30                    |
| [7д] [30д] [90д] | [Календарь] | [Все|WB|Ozon]|
+-----------------------------------------------+
| KPI Cards (grid-cols-2 lg:grid-cols-4)         |
| Row 1:                                         |
| +----------+ +----------+ +----------+ +------+|
| | Расход   | | ДРР      | | Показы   | |Заказы||
| | 12 400₽  | | 8.5%     | | 45 200   | | 32  ||
| | △-12%    | | было 9.2%| | CTR 2.1% | |CR 4% ||
| +----------+ +----------+ +----------+ +------+|
| Row 2:                                         |
| +----------+ +----------+ +----------+ +------+|
| | Клики    | | CPC      | | CPO      | | ROAS ||
| | 952      | | 13.02₽   | | 387.5₽   | | x11.7||
| |          | | Стоим.кл.| | Стоим.зак| |      ||
| +----------+ +----------+ +----------+ +------+|
+-----------------------------------------------+
| Charts (grid-cols-1 lg:grid-cols-2)            |
| +---------------------+ +---------------------+|
| | ДРР по дням         | | Расход vs Выручка   ||
| | (DrrChart, line)    | | (AdsSpendChart, bar)||
| +---------------------+ +---------------------+|
+-----------------------------------------------+
| [AdsCampaignTable — см. 02-tables.md]          |
+-----------------------------------------------+
| [AdsDailyTable — см. 02-tables.md]             |
+-----------------------------------------------+
```

## Файлы

| Компонент | Путь | Строки | Props |
|-----------|------|--------|-------|
| AdsPage | `frontend/src/pages/AdsPage.tsx` | 1-216 | — (страница-оркестратор) |
| AdsKpiCards | `frontend/src/components/Ads/AdsKpiCards.tsx` | 1-153 | `{ totals, previousTotals?, isLoading }` |
| AdsChartsSection | `frontend/src/components/Ads/AdsChartsSection.tsx` | 1-54 | `{ data: AdCostsChartDataPoint[], isLoading }` |
| AdsSpendChart | `frontend/src/components/Ads/AdsSpendChart.tsx` | 1-99 | `{ data: AdCostsChartDataPoint[] }` |
| DrrChart | `frontend/src/components/Dashboard/DrrChart.tsx` | — | `{ data, isLoading }` (переиспользуется с дашборда) |
| SummaryCard | `frontend/src/components/Dashboard/SummaryCard.tsx` | — | Enterprise карточка с accent, ChangeBadge, tooltip |

## Data Flow

```
AdsPage (оркестратор)
  ├─ useAdCosts({ ...filters, include_prev_period: true })
  │    queryKey: ['dashboard', 'ad-costs', filters]
  │    staleTime: 5min, refetchInterval: 5min
  │    └─ dashboardApi.getAdCosts(params)
  │         └─ GET /api/v1/dashboard/ad-costs
  │              params: date_from, date_to, marketplace, fulfillment_type, include_prev_period
  │              feature_gate: ads_page (Pro+)
  │              └─ dashboard.py → get_ad_costs() (строка 575)
  │                   ├─ mp_ad_costs (расходы на рекламу по дням)
  │                   ├─ mp_sales (выручка для расчёта ДРР)
  │                   └─ previous period (если include_prev_period=true)
  │
  └─ useAdCampaigns(filters)
       queryKey: ['dashboard', 'ad-campaigns', filters]
       staleTime: 5min
       └─ dashboardApi.getAdCampaigns(params)
            └─ GET /api/v1/dashboard/ad-campaigns
                 params: date_from, date_to, marketplace
                 feature_gate: ads_page (Pro+)
                 └─ dashboard.py → get_ad_campaigns() (строка 717)
                      ├─ mp_ad_costs (агрегация по campaign_id + marketplace)
                      ├─ mp_sales (total_revenue для ДРР)
                      └─ mp_products (JOIN для product_name)
```

## Формулы

```
DRR = ad_cost / revenue * 100%                  -- Доля рекламных расходов
CTR = clicks / impressions * 100%               -- Click-Through Rate
CPC = ad_cost / clicks                          -- Cost Per Click
CPO = ad_cost / orders                          -- Cost Per Order
ROAS = revenue / ad_cost                        -- Return On Ad Spend
CR = orders / clicks * 100%                     -- Conversion Rate (клики → заказы)
```

Ссылка: CLAUDE.md секция "Формулы" (`DRR = ad_cost / revenue * 100%`)

## Локальный МП-фильтр (ПРАВИЛО #41)

**AdsPage имеет СОБСТВЕННУЮ панель фильтров, НЕ общий FilterPanel.**

Причина: AdsPage использует `selectedMarketplace` через `useState` (строка 33), а не глобальный `useFiltersStore().marketplace`. Это позволяет переключать МП только для рекламной страницы, не влияя на дашборд.

```tsx
// AdsPage.tsx строка 33
const [selectedMarketplace, setSelectedMarketplace] = useState<'all' | 'wb' | 'ozon'>('all');
```

### Sticky поведение

| Экран | Классы | Описание |
|-------|--------|----------|
| Mobile | `sticky top-0 z-30` | Прилипает к самому верху (нет навигации сверху) |
| Desktop | `sticky top-16 z-30` | Прилипает под навигацией (64px = top-16) |

### Элементы фильтр-панели

- **Пресеты периода:** 7д / 30д / 90д (из `useFiltersStore().datePreset`)
- **DateRangePicker:** кастомный диапазон (из `useFiltersStore()`)
- **МП pills:** Все / WB / Ozon — **ЛОКАЛЬНЫЙ state** (НЕ глобальный)

## Вычисления на фронтенде

### AdsPage (строки 31-215)

1. **filters** (строки 44-48) — собирает `{ date_from, date_to, marketplace: selectedMarketplace }` для обоих хуков
2. **adData** — содержит `totals`, `previous_totals`, `data[]` (chart data по дням)
3. **campaignsData** — содержит `campaigns[]` (для AdsCampaignTable)
4. **isLoading** — `costsLoading && !adData` (показывает полный спиннер только при первой загрузке)
5. **totals fallback** (строки 73-76) — если данных нет, возвращает нулевой объект `{ ad_cost: 0, revenue: 0, drr: 0, impressions: 0, clicks: 0, orders: 0 }`

### AdsKpiCards (строки 30-152)

Вычисляет производные метрики из `totals`:

| Метрика | Формула | Accent | ChangeBadge |
|---------|---------|--------|-------------|
| Расход на рекламу | `totals.ad_cost` | red | `calcChange(current, prev)` — `((cur - prev) / |prev|) * 100` |
| ДРР | `totals.drr` | dynamic: >20% red, >10% amber, else emerald | `isPositive = drr <= prev_drr` |
| Показы | `totals.impressions` | indigo | secondary: `CTR X.X%` |
| Заказы из рекламы | `totals.orders` | emerald | secondary: `CR X.X%` |
| Клики | `totals.clicks` | sky | — |
| CPC | `ad_cost / clicks` | violet | `isPositive = cpc <= prev_cpc` (снижение = хорошо) |
| CPO | `ad_cost / orders` | amber | `isPositive = cpo <= prev_cpo` (снижение = хорошо) |
| ROAS | `revenue / ad_cost` | emerald | secondary: `на 1₽ → N₽ выручки` |

### AdsChartsSection (строки 28-53)

2-колоночная сетка (`grid-cols-1 lg:grid-cols-2`):
- **Левый:** `DrrChart` — переиспользуется с дашборда (line chart ДРР по дням)
- **Правый:** `AdsSpendChart` — bar chart Расход vs Выручка
- **Пустые данные:** показывает `EmptyChart` — "Нет данных"

### AdsSpendChart (строки 54-98)

- Recharts `BarChart` с двумя Bar: `revenue` (indigo, opacity 0.25) и `ad_cost` (red)
- `ResponsiveContainer` height={180} с `sm:!h-[220px]`
- YAxis formatter: `>= 1000 → Xk`
- Custom tooltip: дата + цветные метки + formatCurrency

## Backend логика

### GET /dashboard/ad-costs (строка 575)

1. **Feature gate:** `require_feature("ads_page")` — Pro+
2. **mp_ad_costs:** SELECT * WHERE user_id, date_from..date_to, [marketplace]
3. **mp_sales:** SELECT * для выручки (revenue по дням), фильтр по fulfillment_type
4. **Агрегация по дням:** `ads_by_date[date]` — суммирует cost, impressions, clicks, orders_count
5. **Chart data:** merge дат из ads + sales, вычисляет DRR per day
6. **Totals:** суммы по всему периоду (ad_cost, revenue, drr, impressions, clicks, orders)
7. **Previous period** (если include_prev_period=true):
   - Вычисляет длину текущего периода: `(date_to - date_from).days + 1`
   - prev_from = date_from - period_length, prev_to = date_from - 1
   - Те же запросы mp_ad_costs + mp_sales за предыдущий период
   - Возвращает `previous_totals` с теми же полями

### GET /dashboard/ad-campaigns (строка 717)

1. **Feature gate:** `require_feature("ads_page")` — Pro+
2. **Агрегация:** по `(campaign_id, marketplace)` — суммирует cost, impressions, clicks, orders
3. **Product names:** JOIN mp_products по product_id
4. **Вычисления:** CTR, CPC, DRR (относительно ОБЩЕЙ выручки, не выручки кампании)
5. **Сортировка:** по cost desc
6. **Ответ:** `{ campaigns[], total_campaigns }`

## Состояние и кэширование

- **Zustand (global):** `useFiltersStore` — datePreset, customDateFrom, customDateTo (период)
- **Локальный state:** `selectedMarketplace` — `useState<'all' | 'wb' | 'ozon'>('all')` (НЕ глобальный)
- **React Query keys:**
  - `['dashboard', 'ad-costs', { ...filters, include_prev_period: true }]` — staleTime: 5min, refetchInterval: 5min
  - `['dashboard', 'ad-campaigns', filters]` — staleTime: 5min
- **enabled:** всегда true (оба хука)

## Типы

```ts
// types/index.ts строки 218-252

interface AdCostsChartDataPoint {
  date: string;
  ad_cost: number;
  revenue: number;
  drr: number;
  impressions: number;
  clicks: number;
  orders: number;
}

interface AdCostsResponse {
  status: 'success';
  period: { from: string; to: string };
  marketplace: Marketplace;
  totals: {
    ad_cost: number;
    revenue: number;
    drr: number;
    impressions: number;
    clicks: number;
    orders: number;
  };
  previous_totals?: { ... };  // те же поля
  data: AdCostsChartDataPoint[];
}
```

## Edge Cases

1. **Данные ещё не загружены** — `costsLoading && !adData` показывает полный `<LoadingSpinner text="Загрузка рекламных данных..." />`
2. **Пустой ответ** — KPI показывают нули (zero fallback), графики показывают EmptyChart "Нет данных"
3. **Ошибка API** — React Query стандартный error handling
4. **Feature gate** — `<FeatureGate feature="ads_page">` оборачивает всю страницу (Pro+)
5. **Нет предыдущего периода** — `previousTotals` = undefined, ChangeBadge не показывается
6. **DRR = 0** — если revenue = 0, backend возвращает drr = 0; accent = emerald

## Зависимости

- **Зависит от:** useFiltersStore (период из Zustand), useAdCosts + useAdCampaigns (React Query), SummaryCard (Enterprise карточка)
- **НЕ зависит от:** FilterPanel (собственная панель, правило #41)
- **Используется в:** роутинг `/ads` (отдельная страница)
- **Feature gate:** `ads_page` (Pro+)
- **Источник данных:** `mp_ad_costs` (рекламные расходы), `mp_sales` (выручка для ДРР), `mp_products` (имена товаров)

## Известные проблемы

- [ ] DRR кампании вычисляется относительно ОБЩЕЙ выручки (не выручки конкретной кампании) — может быть неточным для multi-SKU
- [ ] Recharts статически импортирован в AdsChartsSection (DrrChart + AdsSpendChart) — увеличивает main bundle
