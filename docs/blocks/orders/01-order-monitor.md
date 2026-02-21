# Монитор заказов

> Позаказная детализация с воронкой KPI (Заказы/Выкупы/Возвраты/Непроведённые) и списком заказов с фильтрами, сортировкой и серверной пагинацией.

**Правила CLAUDE.md:** #11, #12

## Визуальная структура

```
+-----------------------------------------------+
| Монитор заказов              (LoadingSpinner)  |
| 2026-02-01 — 2026-02-21 (WB)                  |
+-----------------------------------------------+
| FilterPanel (sticky, глобальные фильтры)       |
+-----------------------------------------------+
| KPI Cards (grid 2×2 / sm:4×1)                 |
| +----------+ +----------+ +----------+ +------+
| | Заказы   | | Выкупы   | | Возвраты | | Ожид.|
| | 245      | | 198      | | 12       | | 35   |
| | 58 200₽  | | 80.8%    | |          | | непр.|
| +----------+ +----------+ +----------+ +------+
+-----------------------------------------------+
| Воронка заказов (горизонтальные bars)          |
| Заказы   [██████████████████████████] 245      |
| Выкупы   [████████████████████] 198 (80.8%)    |
| Возвраты [████] 12                             |
+-----------------------------------------------+
| ⚠ 35 заказов ожидают проведения               |
|   МП ещё не финализировал расчёт. 7-14 дней.  |
+-----------------------------------------------+
| Позаказная детализация (1842)   [Фильтры]     |
| Поиск по ID/штрихкоду | Статус | Проведённость|
+-----------------------------------------------+
| Desktop: TABLE                                 |
| Дата | Товар | МП | Статус | Продажа | ...    |
| ───────────────────────────────────────────── |
| Строка заказа (click → expand detail panel)    |
| [OrderDetailPanel: разбивка + визуал бар]      |
+-----------------------------------------------+
| Mobile: CARDS                                  |
| [OrderMobileCard] (tap → expand detail)        |
+-----------------------------------------------+
| Pagination: Стр. 1 из 37 (1842 записей)       |
| [<] [1] [2] [3] [4] [5] [>]                   |
+-----------------------------------------------+
```

## Файлы

| Компонент | Путь | Строки | Props / Описание |
|-----------|------|--------|------------------|
| OrderMonitorPage | `frontend/src/pages/OrderMonitorPage.tsx` | 1-783 | Страница-оркестратор, всё в одном файле |
| StatusBadge | строка 45-52 | внутри файла | `{ status: OrderStatus }` |
| SettledBadge | строка 54-64 | внутри файла | `{ settled: boolean }` |
| MarketplaceBadge | строка 66-87 | внутри файла | `{ mp: string, ozonPostingStatus?: string }` |
| OrderDetailPanel | строка 113-247 | внутри файла | `{ order: Order }` |
| OrderMobileCard | строка 251-299 | внутри файла | `{ order: Order, expanded: boolean, onToggle: () => void }` |
| OrderTableRow | строка 716-780 | внутри файла | `{ order: Order, expanded: boolean, onToggle: () => void }` |
| useOrderFunnel | `frontend/src/hooks/useOrders.ts` | 12-20 | `(filters?: DashboardFilters, opts?: QueryOpts)` |
| useOrdersList | `frontend/src/hooks/useOrders.ts` | 22-29 | `(filters?: OrdersFilters, opts?: QueryOpts)` |

## Data Flow

```
OrderMonitorPage
  ├─ useOrderFunnel(funnelFilters)
  │    queryKey: ['orders', 'funnel', filters]
  │    staleTime: 5min, refetchInterval: 5min
  │    └─ ordersApi.getFunnel(filters)
  │         └─ GET /api/v1/dashboard/order-funnel
  │              params: date_from, date_to, marketplace, fulfillment_type
  │              feature_gate: order_monitor (Pro+)
  │              └─ dashboard.py → get_order_funnel()
  │                   ├─ mp_products (SELECT * WHERE user_id)
  │                   ├─ mp_sales (orders_count, sales_count, returns_count, revenue)
  │                   └─ _fetch_costs_tree_merged() → unsettled расчёт
  │
  └─ useOrdersList(ordersFilters)
       queryKey: ['orders', 'list', filters]
       staleTime: 5min
       └─ ordersApi.getList(filters)
            └─ GET /api/v1/dashboard/orders
                 params: date_from, date_to, marketplace, fulfillment_type,
                         status, settled, search, page, page_size, sort_by, sort_dir
                 feature_gate: order_monitor (Pro+)
                 └─ dashboard.py → get_orders_list()
                      └─ mp_orders SELECT *, mp_products(name, barcode)
                           count="exact", server-side pagination + sort
```

## Формулы

```
buyout_percent = total_sales / total_orders * 100   -- процент выкупа
avg_check = total_revenue / total_sales             -- средний чек

-- Непроведённые (unsettled) — из costs-tree:
settled_revenue = SUM(costs_tree.total_revenue per MP)
unsettled_amount = total_revenue - settled_revenue
ratio = settled_revenue / total_revenue
unsettled_orders = total_orders - round(total_orders * ratio)

-- Эффективная цена продажи:
effective_price = sale_price ?? price               -- sale_price = после СПП (WB)
spp_discount = price - sale_price                   -- если sale_price < price
spp_percent = (spp_discount / price) * 100

-- Удержания:
total_deductions = commission + logistics + storage_fee + other_fees
calculated_payout = effective_price - total_deductions
```

Ссылка: CLAUDE.md секция "Формулы", правила #11, #12

## Вычисления на фронтенде

**Страница OrderMonitorPage** (строки 305-712) — оркестратор:

1. **funnelFilters** (useMemo, строки 337-343) — фильтры для воронки: `{ date_from, date_to, marketplace, fulfillment_type }`. Берёт marketplace/fulfillmentType из Zustand store.

2. **ordersFilters** (useMemo, строки 322-334) — фильтры для списка: дополнительно включает `statusFilter`, `settledFilter`, `searchQuery`, `page`, `page_size=50`, `sort_by`, `sort_dir`.

3. **KPI карточки** (строки 391-430) — используют данные из `ordersData.summary` с fallback на `funnelData.summary`. Не дублируют запросы — funnel даёт воронку, orders даёт summary по текущей пагинации.

4. **Воронка** (строки 432-473) — визуальные горизонтальные bars пропорционально `total_orders`. Минимальная ширина bar = 5%.

5. **Хелперы** (строки 89-109):
   - `getEffectivePrice(order)` — `sale_price ?? price`
   - `getSppDiscount(order)` — `price - sale_price` (если sale_price < price)
   - `getSppPercent(order)` — `(discount / price) * 100`

6. **OrderDetailPanel** (строки 113-247):
   - Левая колонка: разбивка стоимости (цена продажи → −комиссия → −логистика → −хранение → −прочее = выплата)
   - Правая колонка: визуальный progress bar удержаний + мета-данные (регион, склад, ID)
   - Верификация: если `|calculatedPayout - payout| > 1₽`, показывается предупреждение

## Backend логика

### GET /dashboard/order-funnel (строка 1105)

1. **Feature gate:** `require_feature("order_monitor")` — Pro+
2. **Данные из mp_sales:** агрегация `orders_count`, `sales_count`, `returns_count`, `revenue` по дням и по товарам
3. **Фильтрация:** marketplace, fulfillment_type
4. **Группировка by_product:** фильтрует WB_ACCOUNT, сортирует по orders desc
5. **Непроведённые:** вызывает `_fetch_costs_tree_merged()` для каждого МП, сравнивает settled_revenue с total_revenue из mp_sales
6. **Ответ:** summary + daily[] + by_product[]

### GET /dashboard/orders (строка 1252)

1. **Feature gate:** `require_feature("order_monitor")` — Pro+
2. **Таблица:** `mp_orders` с JOIN `mp_products(name, barcode)`, `count="exact"` для серверной пагинации
3. **Фильтры:** marketplace, fulfillment_type, status, product_id, settled, search (ilike по order_id и barcode)
4. **Сортировка:** server-side, поля: `order_date | price | payout | status | commission | logistics | settled`
5. **Пагинация:** server-side, `page` + `page_size` (10-200, default 50), `range(offset, offset + page_size - 1)`
6. **Summary:** ОТДЕЛЬНЫЙ запрос по ВСЕМ записям (не только текущая страница), агрегирует total_orders, total_sold, total_returned, total_settled, total_unsettled, total_payout, total_revenue, buyout_percent
7. **sale_price:** если `sale_price IS NOT NULL` — используется как реальная цена (после СПП для WB); иначе price

## Состояние и кэширование

- **Zustand:** `useFiltersStore` — datePreset, marketplace, fulfillmentType, customDateFrom, customDateTo
- **Локальный state (useState):**
  - `statusFilter: OrderStatus | ''` — фильтр по статусу
  - `settledFilter: boolean | null` — фильтр по проведённости
  - `searchQuery: string` — поиск по ID/штрихкоду
  - `page: number` — текущая страница (сбрасывается при смене фильтров)
  - `sortField: SortField` — поле сортировки (default: 'order_date')
  - `sortDir: 'asc' | 'desc'` — направление (default: 'desc')
  - `expandedId: string | null` — ID раскрытого заказа
  - `showFilters: boolean` — видимость панели фильтров
- **React Query keys:**
  - `['orders', 'funnel', filters]` — staleTime: 5min, refetchInterval: 5min
  - `['orders', 'list', filters]` — staleTime: 5min, без refetchInterval
- **enabled:** всегда true (оба хука)

## Типы

```ts
// types/index.ts строки 654-765

type OrderStatus = 'ordered' | 'sold' | 'returned' | 'cancelled' | 'delivering';

interface Order {
  id: string;
  marketplace: Marketplace;
  order_id: string;
  product_id: string | null;
  product_name: string;
  barcode: string;
  order_date: string;
  last_change_date: string | null;
  status: OrderStatus;
  price: number;
  sale_price: number | null;    // WB: retail_price_withdisc_rub (после СПП)
  sale_amount: number | null;
  commission: number;
  logistics: number;
  storage_fee: number;
  other_fees: number;
  payout: number | null;
  settled: boolean;
  region: string | null;
  warehouse: string | null;
  fulfillment_type?: 'FBO' | 'FBS';
  wb_sale_id: string | null;
  ozon_posting_status: string | null;
}

interface OrdersFilters extends DashboardFilters {
  status?: OrderStatus;
  settled?: boolean;
  search?: string;
  page?: number;
  page_size?: number;
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
}

interface OrderFunnelSummary {
  total_orders: number;
  total_sales: number;
  total_returns: number;
  buyout_percent: number;
  total_revenue: number;
  unsettled_orders: number;
  unsettled_amount: number;
  avg_check: number;
}

interface OrdersListSummary {
  total_orders: number;
  total_sold: number;
  total_returned: number;
  total_settled: number;
  total_unsettled: number;
  total_payout: number;
  total_revenue: number;
  buyout_percent: number;
}
```

## STATUS_CONFIG

Конфигурация статусов заказов (строки 37-43):

| Статус | Label | Цвет текста | Фон |
|--------|-------|-------------|-----|
| `ordered` | Заказан | text-gray-700 | bg-gray-100 |
| `delivering` | Доставка | text-blue-700 | bg-blue-100 |
| `sold` | Выкуп | text-green-700 | bg-green-100 |
| `returned` | Возврат | text-red-700 | bg-red-100 |
| `cancelled` | Отмена | text-orange-700 | bg-orange-100 |

## Desktop vs Mobile

- **Desktop** (строки 586-643): `<table>` с sortable заголовками, click по строке раскрывает OrderDetailPanel через `<td colSpan={10}>`
- **Mobile** (строки 646-657): `OrderMobileCard` — карточки с tap для раскрытия деталей. Grid `grid-cols-4` для метрик (Продажа/Удержания/Выплата/Проведён)
- **Детект:** `useIsMobile()` хук

## Edge Cases

1. **Данные ещё не загружены** — `isLoading` показывает `<LoadingSpinner />`. `isFetching` показывает маленький спиннер в заголовке
2. **Пустой ответ** — иконка ShoppingCart + "Нет заказов за выбранный период" + подсказка про синхронизацию
3. **Ошибка API** — обрабатывается React Query (стандартный error state)
4. **Feature gate** — `<FeatureGate feature="order_monitor">` оборачивает всю страницу (Pro+)
5. **Расхождение payout** — если `|calculatedPayout - order.payout| > 1₽`, показывается warning в OrderDetailPanel
6. **Unsettled alert** — жёлтый баннер с `AlertTriangle`, если `summary.total_unsettled > 0`
7. **Непроведённые без costs-tree** — если costs-tree недоступен, unsettled не показывается (try/catch, pass)

## Зависимости

- **Зависит от:** FilterPanel (глобальные фильтры), useFiltersStore (Zustand), useOrderFunnel + useOrdersList (React Query)
- **Используется в:** роутинг `/orders` (отдельная страница)
- **Feature gate:** `order_monitor` (Pro+)
- **API:** ordersApi из `frontend/src/services/api.ts` (строки 344-362)
- **Источник данных:** `mp_orders` (Phase 2, позаказная детализация), `mp_sales` (Phase 1, воронка), `mp_products` (JOIN для имён)

## Известные проблемы

- [ ] Ozon posting_status отображается как raw строка (например `FBO:delivered`), можно сделать human-readable
