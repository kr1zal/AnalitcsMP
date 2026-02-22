# StocksTable — Таблица остатков на складах

> Enterprise-таблица с поиском, фильтрами, сортировкой, пагинацией, раскрывающимися строками и итоговой строкой. Всегда показывает все маркетплейсы (`marketplace='all'`), независимо от глобального фильтра МП.

**Правила CLAUDE.md:** #37

## Визуальная структура

### Desktop

```
┌──────────────────────────────────────────────────────────────────────┐
│ Остатки на складах ?                              Обновлено 5 мин назад │
│                                                                      │
│ [Поиск по названию или штрихкоду...]   [Все][OOS WB?][OOS Ozon?][Мало?] 5 из 6│
│                                                                      │
│ ┌────────────────────────────────────────────────────────────────────┐│
│ │ Товар ↕     │  WB ↕           │  OZON ↕          │  Σ ↕ │ ⏱ Прогноз? ↕ ││
│ ├─────────────┼─────────────────┼──────────────────┼──────┼──────────┤│
│ │ Товар 1  ▸  │ 150 ████████ OK │ 0   ─────── OOS  │ 150  │  30 д    ││
│ │ Товар 2  ▾  │  45 ███── Низкий│ 80  ██████ OK     │ 125  │  14 д    ││
│ │   ├─ Штрихкод: 123456 · ~5 шт/день                                ││
│ │   ├─ WB: Подольск 30шт, Коледино 15шт                             ││
│ │   └─ OZON: Хоругвино 80шт                                         ││
│ │ ...                                                                ││
│ ├────────────────────────────────────────────────────────────────────┤│
│ │ Итого: 5 товаров │  450  │  320  │  770  │ Ср. 22д ?              ││
│ └────────────────────────────────────────────────────────────────────┘│
│                                           1-20 из 45  [<] 1 2 3 [>]  │
└──────────────────────────────────────────────────────────────────────┘
```

### Mobile (карточки)

```
┌──────────────────────────────────┐
│ 📦 Остатки ?          5 мин назад│
│ [Поиск товара...]                │
│ [Все][OOS WB][OOS Oz][Мало]  ↕  │
│ Σ 770  WB 450  Oz 320  Ср.≈22д  │  ← summary bar
│──────────────────────────────────│
│ Товар 1                     150  │
│ WB  150 ████████████████ OK      │
│ Oz    0 ──────────────── OOS     │
│                        ≈30 д  ▸  │
│──────────────────────────────────│
│ Товар 2                     125  │
│ WB   45 █████── Низкий           │
│ Oz   80 ██████████── OK          │
│                        ≈14 д  ▸  │
│──────────────────────────────────│
│       [<]   1-10 из 45   [>]    │
└──────────────────────────────────┘
```

## Файлы

| Компонент | Путь | Props / Интерфейс |
|-----------|------|-------------------|
| StocksTable | `frontend/src/components/Dashboard/StocksTable.tsx` (1055 строк) | `{ stocks: StockItem[], isLoading?: boolean }` |
| useStocks | `frontend/src/hooks/useDashboard.ts` (строки 71-80) | `(marketplace?, fulfillmentType?, opts?) => UseQueryResult` |
| dashboardApi.getStocks | `frontend/src/services/api.ts` (строки 263-269) | `GET /dashboard/stocks` |
| get_stocks | `backend/app/api/v1/dashboard.py` (строки 898-990) | endpoint |
| StockItem | `frontend/src/types/index.ts` (строки 321-339) | интерфейс |
| WarehouseStock | `frontend/src/types/index.ts` (строки 308-319) | интерфейс |
| Tip | `frontend/src/components/Dashboard/StocksTable.tsx` (строки 120-202) | внутренний компонент |

## Data Flow

```
DashboardPage
  └─ useStocks('all', fulfillmentType)                     ← ВСЕГДА marketplace='all' (правило #37)
       queryKey: ['dashboard', 'stocks', 'all', ft]
       staleTime: 10 мин
       refetchInterval: 10 мин
       └─ dashboardApi.getStocks(undefined, ft)
            └─ GET /api/v1/dashboard/stocks
                 params: marketplace=undefined, fulfillment_type?
                 └─ dashboard.py → get_stocks()
                      ├─ SELECT *, mp_products(name, barcode)
                      │    FROM mp_stocks WHERE user_id = $1
                      └─ SELECT product_id, sales_count
                           FROM mp_sales WHERE user_id = $1
                           AND date >= (today - 30d)
                           → avg_daily_sales, days_remaining

StocksTable (stocks={stocksData.stocks}, isLoading={stocksLoading})
  ├─ Search → Filter → Sort → Paginate (client-side pipeline)
  └─ Desktop: <table> | Mobile: карточки (useIsMobile)
```

## Формулы

```
avg_daily_sales = total_sales_30d / 30                    -- средние продажи за 30 дней
days_remaining = total_quantity / avg_daily_sales          -- прогноз запаса в днях
summary.avgDays = SUM(days_remaining) / COUNT(non-null)   -- средний прогноз по отфильтрованным товарам
bar_width_pct = (quantity / max_quantity) * 100            -- ширина progress bar пропорционально макс. значению
```

Ссылка: CLAUDE.md секция "Формулы" (`Stock forecast: days_remaining = quantity / avg_daily_sales(30d)`)

## Вычисления на фронтенде

### Конвейер данных (client-side, строки 258-324)

Все этапы выполняются в `useMemo` с правильными зависимостями:

| Этап | useMemo | Строки | Описание |
|------|---------|--------|----------|
| 1. Totals | `totalsMap` | 261-267 | `Map<barcode, { wbTotal, ozonTotal, total }>` — суммы по складам WB/Ozon из `warehouses` |
| 2. Search | `searched` | 270-276 | Case-insensitive фильтр по `product_name` и `barcode` |
| 3. Filter | `filtered` | 279-287 | Применение активного фильтра (`oos_wb`, `oos_ozon`, `low`, `all`) |
| 4. Sort | `sorted` | 290-316 | Сортировка по выбранному полю (status/name/wb/ozon/total/forecast) |
| 5. Paginate | `paged` | 321-324 | Срез `sorted[(page-1)*pageSize .. page*pageSize]` |

### Сортировка по статусу (строки 307-313)

При сортировке по `status` используется `rank` — числовой приоритет. Берётся минимальный rank из WB и Ozon (наихудший статус):

```ts
const aRank = Math.min(getStockStatus(at.wbTotal).rank, getStockStatus(at.ozonTotal).rank);
```

При равных рангах — вторичная сортировка по `total` количеству.

### Агрегаты (строки 328-360)

- `maxWb`, `maxOzon` — максимальные значения для пропорциональной ширины progress bars
- `summary` — из `filtered` (не `paged`): суммы WB/Ozon/Total + средний прогноз

## Backend логика

### Endpoint: `GET /dashboard/stocks` (строки 898-990)

1. **Параметры:** `marketplace` (optional), `fulfillment_type` (optional, `^(FBO|FBS)$`)
2. **Запрос остатков:** `mp_stocks` с JOIN `mp_products(name, barcode)`, фильтр `user_id`
3. **Запрос продаж 30д:** `mp_sales` за последние 30 дней для расчёта avg_daily_sales
4. **Агрегация по товару** (строки 935-971):
   - Ключ группировки: `product_id || barcode || product_name`
   - Суммирование `quantity` по складам → `total_quantity`
   - Сбор `warehouses[]` с информацией по каждому складу
   - Трекинг `last_updated_at` (максимум по всем складам)
5. **Расчёт прогноза** (строки 973-982):
   ```python
   avg_daily = total_sales_30d / 30
   days_remaining = total_quantity / avg_daily  # если avg > 0
   ```
6. **Response:**
   ```json
   {
     "status": "success",
     "stocks": [{
       "product_id": "uuid",
       "product_name": "...",
       "barcode": "...",
       "total_quantity": 150,
       "last_updated_at": "2026-02-21T10:30:00",
       "avg_daily_sales": 5.0,
       "days_remaining": 30,
       "warehouses": [
         { "marketplace": "wb", "warehouse": "Подольск", "quantity": 100, "updated_at": "..." },
         { "marketplace": "ozon", "warehouse": "Хоругвино", "quantity": 50, "updated_at": "..." }
       ]
     }]
   }
   ```

## Состояние и кэширование

- **Zustand:** `useFiltersStore.fulfillmentType` — единственный глобальный фильтр, влияющий на запрос остатков. `marketplace` ИГНОРИРУЕТСЯ (всегда `'all'`)
- **React Query key:** `['dashboard', 'stocks', 'all', fulfillmentType]`
- **staleTime:** 10 мин (`1000 * 60 * 10`)
- **refetchInterval:** 10 мин — автообновление
- **enabled:** `opts?.enabled ?? true` (в DashboardPage: `stocksEnabled = true`)

### Локальный state компонента (строки 239-244)

| State | Тип | Default | Описание |
|-------|-----|---------|----------|
| search | `string` | `''` | Поисковый запрос |
| filter | `FilterType` | `'all'` | Активный фильтр |
| sortBy | `SortField` | `'status'` | Поле сортировки |
| sortDir | `'asc'\|'desc'` | `'asc'` | Направление |
| page | `number` | `1` | Текущая страница |
| expandedRows | `Set<string>` | `new Set()` | Раскрытые строки (по barcode) |

Сброс `page` на 1 при смене search/filter/sort/pageSize (строки 249-251). Сброс `expandedRows` при смене page (строки 254-256).

## UI: фильтры (строки 52-57)

| Ключ | Desktop | Mobile | Стиль (active) | Tooltip | Логика |
|------|---------|--------|-----------------|---------|--------|
| `all` | Все | Все | `bg-gray-900 text-white` | --- | Показать всё |
| `oos_wb` | OOS WB | OOS WB | `bg-red-600 text-white` | "Out Of Stock -- товары с нулевым остатком на складах Wildberries" | `wbTotal <= 0` |
| `oos_ozon` | OOS Ozon | OOS Oz | `bg-red-600 text-white` | "Out Of Stock -- товары с нулевым остатком на складах OZON" | `ozonTotal <= 0` |
| `low` | Мало | Мало | `bg-amber-500 text-white` | "Товары с остатком менее 20 шт на одном из маркетплейсов" | `wbTotal < 20 \|\| ozonTotal < 20` |

## UI: сортировка (строки 59-66)

| Значение | Подпись | Desktop | Mobile |
|----------|---------|---------|--------|
| `status` | По статусу | Click на заголовок (rank) | Dropdown |
| `name` | По названию | Click на "Товар" | Dropdown |
| `total` | По кол-ву | Click на "Σ" | Dropdown |
| `wb` | По WB | Click на "WB" | Dropdown |
| `ozon` | По OZON | Click на "OZON" | Dropdown |
| `forecast` | По прогнозу | Click на "Прогноз" | Dropdown |

Desktop: иконки `ArrowUp/ArrowDown/ArrowUpDown` рядом с заголовком (строки 609-618).
Mobile: `<select>` + кнопка переключения направления (строки 690-717).

## Статусы остатков (строки 92-97)

| Статус | Условие | Цвет текста | Цвет bar | Rank | Tooltip |
|--------|---------|-------------|----------|------|---------|
| OOS | `quantity <= 0` | `text-red-600` | `bg-red-400` | 0 | "Out Of Stock -- товар закончился" |
| Крит. | `quantity < 20` | `text-red-600` | `bg-red-400` | 1 | "Критический остаток: менее 20 шт" |
| Низкий | `quantity < 100` | `text-amber-600` | `bg-amber-400` | 2 | "Низкий остаток: менее 100 шт" |
| OK | `quantity >= 100` | `text-emerald-600` | `bg-emerald-400` | 3 | "Достаточный остаток: от 100 шт" |

## Прогноз остатков (строки 84-89)

| Порог | Цвет текста | Фон badge | Значение |
|-------|-------------|-----------|----------|
| `<= 7 д` | `text-red-700` | `bg-red-50` | Критично |
| `<= 14 д` | `text-amber-700` | `bg-amber-50` | Пополнить |
| `<= 30 д` | `text-blue-700` | `bg-blue-50` | Умеренно |
| `> 30 д` | `text-emerald-700` | `bg-emerald-50` | Достаточно |
| `null` | `text-gray-400` | --- | Нет данных ("--") |

## Пагинация (строки 318-324, 523-606)

| Платформа | Размер страницы | Навигация |
|-----------|----------------|-----------|
| Desktop | 20 (`PAGE_SIZE_DESKTOP`) | Номера страниц (1 2 ... 5 6 ... 10) + стрелки |
| Mobile | 10 (`PAGE_SIZE_MOBILE`) | Стрелки `[<] [>]` + "1-10 из 45" |

Алгоритм номеров страниц `getPageNumbers()` (строки 214-224): если всего <= 7 — все; иначе 1 ... [current-1, current, current+1] ... last.

## Progress bars (строки 429-461)

Ширина bar пропорциональна максимальному значению по всем товарам:
- `maxWb = Math.max(1, ...все wbTotal)` — гарантия деления не на 0
- `pct = (quantity / max) * 100`
- Минимальная ширина для ненулевых: `Math.max(4, pct)%`

Desktop: `h-2`. Mobile (compact): `h-1.5`.

## Раскрывающиеся строки (строки 464-505)

При клике на строку (desktop: `<tr onClick>`, mobile: `<button onClick>`) — toggle barcode в `expandedRows`.

Содержимое (`renderWarehouseDetails`):
1. **Штрихкод** + средние дневные продажи (`~X шт/день`)
2. **Две колонки** (WB / Ozon) с детализацией по складам:
   - Сортировка: по `quantity` DESC, затем по имени склада
   - Каждый склад: название + "X шт"
   - Пустой МП: "нет на складах"

## Tip — портальный тултип (строки 120-202)

Внутренний компонент, рендерится через `createPortal(... , document.body)` — не обрезается overflow контейнера.

| Платформа | Триггер | Закрытие |
|-----------|---------|----------|
| Desktop | `onMouseEnter` / `onMouseLeave` | hover out |
| Mobile | `onClick` (tap toggle) | tap outside / scroll / resize |

- Определение touch: `isTouchRef.current` устанавливается в `onTouchStart`
- Позиционирование: `fixed`, авто-flip вверх если не помещается снизу
- Стрелка: `<span data-arrow>` с `rotate-45`, позиция рассчитывается относительно триггера
- Ширины: стандартный `w-44 sm:w-56`, wide `w-44 sm:w-72`

## Размещение на дашборде

В `DashboardPage.tsx` (строки 900-906):

```tsx
<div id="stocks-table" className="mb-4 sm:mb-5 lg:mb-6">
  <StocksTable
    stocks={stocksData?.stocks || []}
    isLoading={!stocksEnabled || stocksLoading}
  />
</div>
```

`id="stocks-table"` используется для scroll-навигации из `StockForecastChart` (ссылка "все N -->" скроллит к таблице).

## Summary row (строки 1018-1039)

Итоговая строка внизу таблицы (только desktop) с агрегатами по **отфильтрованным** товарам:

| Колонка | Значение | Формат |
|---------|----------|--------|
| Товар | "Итого: N товаров" (русская плюрализация) | text |
| WB | `summary.wb` | число |
| OZON | `summary.ozon` | число |
| Σ | `summary.total` | число жирным |
| Прогноз | "Ср. Xд" или "—" | с Tip тултипом |

Mobile: summary bar (строки 722-742) — горизонтальная строка `Σ 770  WB 450  Oz 320  Ср.≈22д  5/6`.

## Edge Cases

1. **Данные ещё не загружены** — `LoadingSpinner` с текстом "Загрузка остатков..." (строки 403-408)
2. **Пустой массив stocks** — empty state с иконкой Package и текстом "Нет данных об остатках" (строки 412-421)
3. **Поиск/фильтр без результатов** — "Ничего не найдено" / "Нет товаров по фильтру" + кнопка "Сбросить фильтры" (строки 508-520)
4. **days_remaining = null** — отображается "—" серым (нет продаж → невозможно рассчитать). При сортировке по forecast: null уходит в конец (rank 9999, строка 306)
5. **Много товаров** — клиентская пагинация, номера страниц с ellipsis
6. **Feature gate** — нет. Доступен на всех тарифах

## Типы

```ts
// frontend/src/types/index.ts (строки 308-344)
interface WarehouseStock {
  marketplace: Marketplace;
  warehouse: string;
  quantity: number;
  fulfillment_type?: 'FBO' | 'FBS';
  updated_at?: string;
}

interface StockItem {
  product_id?: string | null;
  product_name: string;
  barcode: string;
  total_quantity: number;
  last_updated_at?: string | null;
  avg_daily_sales?: number;
  days_remaining?: number | null;
  warehouses: WarehouseStock[];
}

interface StocksResponse {
  status: 'success';
  stocks: StockItem[];
}
```

## Зависимости

- **Зависит от:** `useStocks` (данные), `useFiltersStore` (fulfillmentType), `useIsMobile` (responsive), `formatNumber` / `getMarketplaceName` (utils), `LoadingSpinner` (shared)
- **Используется в:** DashboardPage (строки 24, 901-905)
- **Scroll target:** `StockForecastChart` ссылается на `#stocks-table`
- **Feature gate:** нет (доступен всем)

## Известные проблемы

- [ ] `formatUpdatedAt()` использует `Date.now()` — не привязан к МСК TZ (но для relative time "5 мин назад" это некритично)
- [ ] Backend `get_stocks()` использует `datetime.now()` для `date_30d_ago` без явного TZ (UTC сервера, может расходиться на 1 день с МСК)
