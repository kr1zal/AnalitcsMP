# StockHistoryChart — Динамика остатков

> Автономный line chart, показывающий изменение остатков по дням. Самостоятельно загружает данные через `useStockHistory` (не зависит от props DashboardPage).

**Правила CLAUDE.md:** #37

## Визуальная структура

```
┌─────────────────────────────────────────────────────────┐
│ Динамика остатков                        сейчас 1 420 шт│
│                                                         │
│ [Все МП] [WB] [Ozon]  |  [Итого] [Критичные] | [Все] [✕]│
│ [Товар1] [Товар2] [Товар3] ...                          │
│                                                         │
│   1.2k ┬───────────────────────────────────             │
│        │  ─ ─ ─ Итого (пунктир, #374151)                │
│        │  ───── Товар1 (indigo)                         │
│   800  │  ───── Товар2 (amber)                          │
│        │  ───── Товар3 (emerald)                        │
│   400  ├───────────────────────────────────             │
│        01-20  01-25  01-30  02-05  02-10               │
└─────────────────────────────────────────────────────────┘
```

## Файлы

| Компонент | Путь | Props / Интерфейс |
|-----------|------|-------------------|
| StockHistoryChart | `frontend/src/components/Dashboard/StockHistoryChart.tsx` (257 строк) | `{ dateFrom: string, dateTo: string, enabled?: boolean }` |
| StockHistoryChartInner | `frontend/src/components/Dashboard/StockHistoryChartInner.tsx` (95 строк) | `{ data: Record<string, string\|number>[], lines: LineDesc[] }` |
| useStockHistory | `frontend/src/hooks/useDashboard.ts` (строки 164-173) | `(params?, opts?) => UseQueryResult` |
| dashboardApi.getStockHistory | `frontend/src/services/api.ts` (строки 279-284) | `GET /dashboard/stock-history` |
| get_stock_history | `backend/app/api/v1/dashboard.py` (строки 993-1102) | endpoint |
| Миграция 017 | `backend/migrations/017_stock_snapshots.sql` | DDL таблицы |
| _save_stock_snapshot | `backend/app/services/sync_service.py` (строки 892-931) | метод SyncService |

## Data Flow

```
StockHistoryChart (dateFrom, dateTo, enabled)
  ├─ useState: filterMode ('all-products' | 'total' | 'critical' | 'custom')
  ├─ useState: selectedProducts (Set<string>, max 7)
  ├─ useState: mpFilter ('all' | 'wb' | 'ozon') — инициализируется из useFiltersStore.marketplace
  │
  └─ useStockHistory({ date_from, date_to, marketplace: mpFilter, fulfillment_type })
       queryKey: ['dashboard', 'stock-history', params]
       staleTime: 10 мин
       └─ dashboardApi.getStockHistory(params)
            └─ GET /api/v1/dashboard/stock-history
                 params: date_from, date_to, marketplace?, product_id?, fulfillment_type?
                 └─ dashboard.py → get_stock_history()
                      └─ SELECT product_id, marketplace, date, total_quantity,
                         mp_products(name, barcode)
                         FROM mp_stock_snapshots
                         WHERE user_id = $1
                           AND date BETWEEN $date_from AND $date_to
                           [AND marketplace = $mp]
                           [AND fulfillment_type = $ft]
                         ORDER BY date ASC
```

## Формулы

```
totals[i] = SUM(quantity) для всех товаров на дату dates[i]   -- общий итог по дню
series[product].data[i] = SUM(quantity) по МП для товара       -- если marketplace='all', суммирует оба МП
currentTotal = totals[last]                                    -- текущий итог (последнее значение)
```

Ссылка: CLAUDE.md секция "Формулы" (`Stock forecast: days_remaining = quantity / avg_daily_sales(30d)`)

## Вычисления на фронтенде

### Построение chartData (useMemo, строки 74-124)

1. **Определение видимых товаров** в зависимости от `filterMode`:
   - `all-products` — первые 7 из `series` (строка 86)
   - `total` — пустой массив, только линия "Итого" (строка 88)
   - `critical` — товары с последним значением < 100 шт (строки 90-93)
   - `custom` — товары из `selectedProducts` (строка 95)

2. **Формирование точек** — для каждой даты создаётся объект `{ date: "MM-DD", fullDate: "YYYY-MM-DD", total, [product_id]: qty }` (строки 99-109)

3. **Описания линий** — массив `LineDesc[]`: "Итого" всегда первая (пунктир `#374151`), далее товары с циклическими цветами `PRODUCT_COLORS[i % 7]` (строки 112-121)

### Имена товаров — обрезка

- В легенде линий: до 16 символов + `...` (строка 118)
- В pill-кнопках: до 10 символов + `...` (строка 243)

## Backend логика

### Endpoint: `GET /dashboard/stock-history` (строки 993-1102)

1. **Параметры:** `date_from`, `date_to` (default: последние 30 дней), `marketplace`, `product_id`, `fulfillment_type`
2. **Запрос:** `mp_stock_snapshots` с JOIN на `mp_products(name, barcode)`, фильтр по user_id + параметрам
3. **Фильтрация WB_ACCOUNT:** строки 1051-1053 — системный продукт исключается
4. **Агрегация:** если `marketplace='all'`, суммирует кол-во по МП для одного product_id на одну дату (строка 1067)
5. **Сортировка series:** по последнему значению ascending — критичные товары сверху (строка 1084)
6. **Response:**
   ```json
   {
     "status": "success",
     "period": { "from": "2026-01-20", "to": "2026-02-20" },
     "dates": ["2026-01-20", "2026-01-21", ...],
     "products": [{ "id": "uuid", "name": "...", "barcode": "..." }],
     "series": [{ "product_id": "uuid", "product_name": "...", "barcode": "...", "data": [150, 148, ...] }],
     "totals": [1420, 1405, ...]
   }
   ```

### Создание снимков: `_save_stock_snapshot()` (строки 892-931)

Вызывается после каждого `sync_stocks_wb` (строка 883) и `sync_stocks_ozon` (строки 1207, 1264).

1. Читает текущие `mp_stocks` для маркетплейса
2. Агрегирует по `(product_id, fulfillment_type)` — суммирует `quantity` по складам
3. Upsert в `mp_stock_snapshots` с `on_conflict="user_id,product_id,marketplace,date,fulfillment_type"`
4. При ошибке — логирует warning, но не прерывает sync

### Таблица: `mp_stock_snapshots` (миграция 017)

```sql
CREATE TABLE mp_stock_snapshots (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES auth.users(id),
    product_id       UUID NOT NULL REFERENCES mp_products(id) ON DELETE CASCADE,
    marketplace      VARCHAR(20) NOT NULL,
    date             DATE NOT NULL,
    total_quantity   INTEGER NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, product_id, marketplace, date)
);

-- Индексы:
-- idx_stock_snapshots_user_date (user_id, date DESC)
-- idx_stock_snapshots_product_date (user_id, product_id, marketplace, date DESC)
```

**RLS:** SELECT по `auth.uid() = user_id`. Service role — полный доступ.

## Состояние и кэширование

- **Zustand:** `useFiltersStore` — берётся `marketplace` и `fulfillmentType` для инициализации локальных фильтров
- **Локальный state:** `mpFilter` (MpFilter), `filterMode` (FilterMode), `selectedProducts` (Set\<string>)
- **React Query key:** `['dashboard', 'stock-history', { date_from, date_to, marketplace, fulfillment_type }]`
- **staleTime:** 10 мин (`1000 * 60 * 10`)
- **enabled:** `opts?.enabled ?? true` (передаётся из DashboardPage как `stocksEnabled`)

### Lazy loading

`StockHistoryChartInner` загружается через `React.lazy()` + `Suspense` (строки 12-14, 249-253). Fallback — анимированный серый прямоугольник 160px / 200px.

## UI: фильтры

### МП фильтр (pill-кнопки, строки 166-179)

| Значение | Подпись | Стиль (active) |
|----------|---------|----------------|
| `all` | Все МП | `bg-indigo-600 text-white` |
| `wb` | WB | `bg-indigo-600 text-white` |
| `ozon` | Ozon | `bg-indigo-600 text-white` |

Инициализация: из глобального `useFiltersStore.marketplace` (строки 47-52). При смене глобального фильтра — локальный подстраивается через `useEffect`.

### Фильтр линий (pill-кнопки, строки 183-245)

| Кнопка | FilterMode | Стиль (active) | Поведение |
|--------|------------|-----------------|-----------|
| Итого | `total` | `bg-gray-900 text-white` | Только пунктирная линия "Итого" |
| Критичные | `critical` | `bg-red-600 text-white` | Товары с последним значением < 100 |
| Все | `all-products` | `bg-emerald-600 text-white` | Первые 7 товаров (default) |
| ✕ | сброс в `total` | `bg-gray-100 text-gray-400` | Очищает selectedProducts |
| [Товар N] | `custom` | цвет из PRODUCT_COLORS | Мульти-выбор, max 7 товаров |

### 7 цветов линий (константа PRODUCT_COLORS, строки 25-33)

| Индекс | Цвет | HEX |
|--------|------|-----|
| 0 | indigo | `#6366f1` |
| 1 | amber | `#f59e0b` |
| 2 | emerald | `#10b981` |
| 3 | red | `#ef4444` |
| 4 | blue | `#3b82f6` |
| 5 | violet | `#8b5cf6` |
| 6 | pink | `#ec4899` |

Линия "Итого" — всегда `#374151` (gray-700), `strokeDasharray="5 3"`, `strokeWidth=2`.

## Recharts конфигурация (StockHistoryChartInner)

- **ResponsiveContainer:** `height={160}`, `className="sm:!h-[200px]"` (правило #17 — НЕ `height="100%"`)
- **LineChart:** margin `{ top: 4, right: 4, bottom: 0, left: -20 }`
- **XAxis:** `dataKey="date"` (формат "MM-DD"), `interval="preserveStartEnd"`, fontSize 10
- **YAxis:** tickFormatter `v >= 1000 ? "${v/1000}k" : v`
- **Line:** `type="monotone"`, `dot={false}`, `activeDot={{ r: 3 }}`
- **Tooltip:** кастомный `CustomTooltip` с цветными маркерами, значение в формате `formatNumber(value) шт`

## Размещение на дашборде

В `DashboardPage.tsx` (строки 892-898):

```tsx
<div className="mb-4 sm:mb-5 lg:mb-6">
  <StockHistoryChart
    dateFrom={dateRange.from}
    dateTo={stockHistoryDateTo}    // всегда "сегодня МСК"
    enabled={stocksEnabled}         // true
  />
</div>
```

`stockHistoryDateTo` (строка 206) — текущая дата в МСК TZ через `toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' })`. Это гарантирует, что снимки пишутся и читаются в одной временной зоне (правило #42).

## Edge Cases

1. **Данные ещё не загружены** — skeleton: анимированные серые блоки (строки 130-145)
2. **Пустой ответ** — компонент возвращает `null` (строка 148: `if (isEmpty || !data) return null`)
3. **Нет серий (только totals)** — при `filterMode='total'` рисуется только пунктирная линия "Итого"
4. **Более 7 товаров** — в режиме `all-products` отображаются только первые 7 (отсортированные по критичности); в `custom` max 7 через проверку `next.size < 7` (строка 65)
5. **Смена глобального МП-фильтра** — `useEffect` синхронизирует `mpFilter` с `globalMp` (строки 50-52)
6. **Feature gate** — нет. Виджет доступен на всех тарифах

## Зависимости

- **Зависит от:** `useStockHistory` (данные), `useFiltersStore` (инициализация mpFilter), `formatNumber` (utils)
- **Используется в:** DashboardPage (строки 29, 893-897)
- **Feature gate:** нет (доступен всем)
- **Lazy-loaded:** StockHistoryChartInner (recharts) через React.lazy

## Типы

```ts
// frontend/src/types/index.ts (строки 769-783)
interface StockHistorySeriesItem {
  product_id: string;
  product_name: string;
  barcode: string;
  data: number[];
}

interface StockHistoryResponse {
  status: 'success';
  period: { from: string; to: string };
  dates: string[];
  products: { id: string; name: string; barcode: string }[];
  series: StockHistorySeriesItem[];
  totals: number[];
}
```

## Известные проблемы

- [ ] `_save_stock_snapshot()` использует `datetime.now()` без TZ — потенциальное расхождение с МСК (правило #42 касается фронтенда, бэкенд пока на UTC сервера)
- [ ] Историческая реконструкция — одноразовый скрипт `backend/scripts/reconstruct_stock_history.py` (304 снимка Jan 11 - Feb 17, 2026), не является частью штатного pipeline
