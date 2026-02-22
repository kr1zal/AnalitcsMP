# Реклама — таблицы

> Таблица рекламных кампаний (поиск, сортировка, МП-фильтр, пагинация) и collapsible таблица детализации по дням.

**Правила CLAUDE.md:** #41

## Визуальная структура

```
+--------------------------------------------------+
| AdsCampaignTable                                  |
+--------------------------------------------------+
| Кампании (32)  [Поиск кампании...]               |
|               [Все] [WB] [Ozon] [ДРР>20%]       |
| Mobile: [Сортировка ▼] [↓]                       |
+--------------------------------------------------+
| Desktop: TABLE                                    |
| Кампания | МП | Расход▼ | Показы | Клики | CTR  |
|          |    |         |        |       |      |
| ─────────────────────────────────────────────── |
| Витамин D  WB  4 200₽ ██  12k    320    2.67%  |
| Omega-3   Ozon 3 100₽ █   8.4k   180    2.14%  |
| ...                                              |
| ─────────────────────────────────────────────── |
| ИТОГО         12 400₽    45.2k   952    2.11%  |
+--------------------------------------------------+
| Mobile: CARDS                                     |
| Summary bar: Расход 12.4k | Заказов 32 | 12 камп|
| +----------------------------------------------+ |
| | Витамин D — Всё для суставов        [WB] [v] | |
| | Расход: 4 200₽  ДРР: 8.5%  Заказы: 12       | |
| | [████████████████████]                        | |
| | [expanded: Показы, Клики, CTR, CPC]           | |
| +----------------------------------------------+ |
+--------------------------------------------------+
| 1-10 из 32                         [<] [>]       |
+--------------------------------------------------+

+--------------------------------------------------+
| AdsDailyTable (collapsible)                       |
+--------------------------------------------------+
| Детализация по дням (21 дн.)              [v]    |
+--------------------------------------------------+
| (expanded)                                        |
| Desktop: TABLE                                    |
| Дата▼ | Расход | Выручка | ДРР | Показы | ...   |
| ─────────────────────────────────────────────── |
| 2026-02-21  580₽  6 800₽  8.5%  2.1k  45  ...  |
| 2026-02-20  620₽  7 200₽  8.6%  2.3k  52  ...  |
| ─────────────────────────────────────────────── |
| ИТОГО      12.4k  145k    8.5%  45.2k  952 ... |
+--------------------------------------------------+
| Mobile: CARDS (max-h-[400px] scroll)              |
| Summary bar: Расход 12.4k | ДРР 8.5% | 21 дн.  |
| +----------------------------------------------+ |
| | 21 фев                                   [v] | |
| | Расход: 580₽  ДРР: 8.5%  Заказы: 3          | |
| | [expanded: Выручка, Показы, Клики, CTR]       | |
| +----------------------------------------------+ |
+--------------------------------------------------+
```

## Файлы

| Компонент | Путь | Строки | Props |
|-----------|------|--------|-------|
| AdsCampaignTable | `frontend/src/components/Ads/AdsCampaignTable.tsx` | 1-418 | `{ campaigns: AdCampaignItem[], isLoading: boolean }` |
| AdsDailyTable | `frontend/src/components/Ads/AdsDailyTable.tsx` | 1-264 | `{ data: AdCostsChartDataPoint[], totals: AdCostsResponse['totals'] }` |

## Data Flow

```
AdsPage (оркестратор, AdsPage.tsx строки 195-211)
  ├─ AdsCampaignTable (campaigns={campaignsData.campaigns})
  │    └─ Данные из useAdCampaigns()
  │         queryKey: ['dashboard', 'ad-campaigns', filters]
  │         └─ GET /api/v1/dashboard/ad-campaigns
  │              └─ mp_ad_costs JOIN mp_products
  │
  └─ AdsDailyTable (data={adData.data}, totals={adData.totals})
       └─ Данные из useAdCosts()
            queryKey: ['dashboard', 'ad-costs', filters]
            └─ GET /api/v1/dashboard/ad-costs
                 └─ mp_ad_costs + mp_sales (агрегация по дням)
```

## AdsCampaignTable

### Колонки (desktop)

| Колонка | SortField | Формат | Описание |
|---------|-----------|--------|----------|
| Кампания | — (не сортируется) | text + product_name подстрока | Имя кампании, если нет — `#ID[:8]` |
| МП | — | badge (WB violet / Ozon blue) | `getMpBadge(marketplace)` |
| Расход | `cost` | formatCurrency + progress bar | Bar пропорционален `cost / maxCost` |
| Показы | `impressions` | formatNumber | — |
| Клики | `clicks` | formatNumber | — |
| CTR | `ctr` | formatPercent | clicks / impressions * 100 |
| Заказы | `orders` | formatNumber | Заказы из рекламы |
| ДРР | `drr` | formatPercent + цвет | >20% red, >10% amber, else emerald |
| CPC | `cpc` | formatCurrency | cost / clicks |

### Footer (ИТОГО)

Сумма по всем **отфильтрованным** записям: totalCost, totalImpressions, totalClicks, CTR (вычисленный), totalOrders. ДРР в footer = "—" (не суммируется). CPC = totalCost / totalClicks.

### Фильтры

| Фильтр | Тип | Значения |
|--------|-----|----------|
| Поиск | `<input>` text | По campaign_name, campaign_id, product_name (case-insensitive) |
| МП pills | кнопки | Все / WB / Ozon / ДРР > 20% |
| Сортировка (mobile) | `<select>` + toggle dir | cost / impressions / clicks / ctr / orders / drr / cpc |

### Пагинация

- **Client-side:** `ITEMS_PER_PAGE = 10`
- Показывает `X-Y из Z`
- Кнопки `<` / `>` (disabled на краях)
- Сброс page при смене фильтра/поиска/сортировки

### Mobile Cards

- **Summary bar:** "Расход X | Заказов Y | Z камп."
- **Свёрнутая карточка:** название + МП badge + grid 3-cols (Расход/ДРР/Заказы) + cost progress bar
- **Раскрытая карточка:** bg-gray-50 блок с grid 2-cols (Показы/Клики/CTR/CPC) + product_name

### Состояние (локальное)

```tsx
// AdsCampaignTable.tsx строки 51-56
const [search, setSearch] = useState('');
const [mpFilter, setMpFilter] = useState<MpFilter>('all');  // 'all' | 'wb' | 'ozon' | 'high-drr'
const [sortField, setSortField] = useState<SortField>('cost');
const [sortDir, setSortDir] = useState<SortDir>('desc');
const [page, setPage] = useState(0);  // 0-indexed
const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
```

### Вычисления (useMemo, строки 78-107)

```tsx
const { filtered, totalCost, totalImpressions, totalClicks, totalOrders } = useMemo(() => {
  // 1. Фильтр по поиску (campaign_name, campaign_id, product_name)
  // 2. Фильтр по МП (wb/ozon/high-drr)
  // 3. Вычисление totals (SUM по отфильтрованным)
  // 4. Сортировка по sortField + sortDir
}, [campaigns, search, mpFilter, sortField, sortDir]);
```

## AdsDailyTable

### Collapsible

Таблица по умолчанию **свёрнута** (`expanded = false`). Заголовок-кнопка "Детализация по дням (N дн.)" с ChevronDown (rotate-180 при expanded).

### Колонки (desktop)

| Колонка | SortField | Формат |
|---------|-----------|--------|
| Дата | `date` | YYYY-MM-DD |
| Расход | `ad_cost` | formatCurrency, red |
| Выручка | `revenue` | formatCurrency |
| ДРР | `drr` | formatPercent + цвет |
| Показы | `impressions` | formatNumber |
| Клики | `clicks` | formatNumber |
| CTR | — (не сортируется) | formatPercent (вычисл.) |
| Заказы | `orders` | formatNumber |

### Footer (ИТОГО)

Из props `totals` (НЕ пересчитывается): ad_cost, revenue, drr, impressions, clicks, CTR (вычисл.), orders.

### Mobile Cards

- **Summary bar:** "Расход X | ДРР Y% | Z дн."
- **Контейнер:** `max-h-[400px] overflow-y-auto` (скроллируемый список)
- **Свёрнутая карточка:** дата (формат "21 фев") + grid 3-cols (Расход/ДРР/Заказы)
- **Раскрытая карточка:** bg-gray-50 блок с grid 2-cols (Выручка/Показы/Клики/CTR)

### Форматирование даты (mobile)

```tsx
// AdsDailyTable.tsx строки 26-33
const formatShortDate = (date: string): string => {
  // "2026-02-18" → "18 фев"
  const months = ['янв', 'фев', 'мар', 'апр', ...];
  return `${day} ${months[month]}`;
};
```

### Состояние (локальное)

```tsx
// AdsDailyTable.tsx строки 36-39
const [expanded, setExpanded] = useState(false);           // collapsible toggle
const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());  // mobile cards
const [sortField, setSortField] = useState<SortField>('date');
const [sortDir, setSortDir] = useState<SortDir>('desc');
```

### Вычисления (useMemo, строки 59-80)

```tsx
const sorted = useMemo(() => {
  // Копирует data[], сортирует по sortField + sortDir
  // date: localeCompare, числовые: числовое сравнение
}, [data, sortField, sortDir]);
```

## Backend логика

### GET /dashboard/ad-campaigns (строка 717)

1. **Feature gate:** `require_feature("ads_page")` — Pro+
2. **mp_ad_costs:** SELECT * WHERE user_id, date_from..date_to, [marketplace]
3. **Агрегация:** по ключу `(campaign_id, marketplace)`:
   - Суммирует: cost, impressions, clicks, orders_count
   - campaign_name: из первой записи, fallback — campaign_id
   - product_id: из первой записи где product_id IS NOT NULL
4. **mp_products:** JOIN для product_names по product_id
5. **Вычисления per campaign:**
   - `ctr = clicks / impressions * 100`
   - `cpc = cost / clicks`
   - `drr = cost / total_revenue * 100` (total_revenue = SUM mp_sales.revenue)
6. **Сортировка:** cost desc (server-side)
7. **Ответ:** `{ campaigns: AdCampaignItem[], total_campaigns: number }`

### Данные для AdsDailyTable

Приходят из того же endpoint `GET /dashboard/ad-costs` (поле `data[]`), который уже описан в `01-overview.md`. Каждый элемент — `AdCostsChartDataPoint { date, ad_cost, revenue, drr, impressions, clicks, orders }`.

## Типы

```ts
// types/index.ts строки 631-650

interface AdCampaignItem {
  campaign_id: string;
  campaign_name: string;
  marketplace: Marketplace;
  product_name: string | null;
  cost: number;
  impressions: number;
  clicks: number;
  orders: number;
  ctr: number;       // clicks / impressions * 100
  cpc: number;       // cost / clicks
  drr: number;       // cost / total_revenue * 100
}

interface AdCampaignsResponse {
  status: 'success';
  period: { from: string; to: string };
  campaigns: AdCampaignItem[];
  total_campaigns: number;
}

// types/index.ts строки 218-226
interface AdCostsChartDataPoint {
  date: string;
  ad_cost: number;
  revenue: number;
  drr: number;
  impressions: number;
  clicks: number;
  orders: number;
}
```

## ДРР — цветовые пороги

Общая функция `getDrrColor(drr)` в обоих компонентах:

| Значение ДРР | CSS класс | Цвет |
|--------------|-----------|------|
| > 20% | `text-red-600` | Красный (опасно) |
| > 10% | `text-amber-600` | Жёлтый (внимание) |
| <= 10% | `text-emerald-600` | Зелёный (хорошо) |

## Progress bar расхода

В AdsCampaignTable каждая кампания имеет visual progress bar:

```tsx
const maxCost = Math.max(...filtered.map(c => c.cost));
const costPct = maxCost > 0 ? (c.cost / maxCost) * 100 : 0;
// <div className="bg-red-400" style={{ width: `${Math.max(2, costPct)}%` }} />
```

Минимальная ширина bar = 2% (видимость). Максимальная кампания = 100%.

## Edge Cases

1. **Нет кампаний** — "Нет активных рекламных кампаний за период" + "Данные появятся после синхронизации"
2. **Пустой daily** — "Нет данных за выбранный период" (внутри expanded секции)
3. **isLoading (campaigns)** — skeleton: анимированный pulse (5 строк)
4. **Поиск без результатов** — пустая таблица (0 строк), footer показывает нули
5. **ДРР > 20% фильтр** — кнопка с красным фоном (`bg-red-600 text-white`), фильтрует `c.drr > 20`
6. **Нет product_name** — показывается `#campaign_id[:8]` как fallback
7. **Кампания без кликов** — CPC = 0, CTR = 0
8. **Кампания без impressions** — CTR = 0

## Зависимости

- **Зависит от:** AdsPage (оркестратор передаёт props), useAdCampaigns + useAdCosts (данные)
- **Используется в:** AdsPage (`frontend/src/pages/AdsPage.tsx` строки 205-211)
- **Feature gate:** `ads_page` (Pro+) — проверяется в AdsPage, а не в компонентах
- **Источник данных:** `mp_ad_costs` (рекламные расходы), `mp_sales` (выручка для ДРР), `mp_products` (имена товаров для кампаний)

## Известные проблемы

- [ ] DRR кампаний рассчитывается от ОБЩЕЙ выручки периода, а не от выручки конкретного товара кампании
- [ ] Пагинация AdsCampaignTable — client-side (10 per page), может быть медленной при 100+ кампаниях
- [ ] AdsDailyTable не имеет пагинации — при большом периоде (365 дней) все строки рендерятся в DOM
