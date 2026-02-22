# Unit-экономика: Таблица эффективности

> Enterprise таблица с per-product метриками, expandable MP breakdown, FBO/FBS разбивкой и ABC/Plan интеграцией

**Правила CLAUDE.md:** #18, #34, #43

## Визуальная структура

```
+----------------------------------------------------------------+
| Таблица эффективности              [sort▾]  [🔍 Поиск товара]  |
|                                                                 |
| [Фильтр: ★ Звёзды                                     ✕]      |
| [Все] [Приб.] [Убыт.] [A] [B] [C]              5 из 6         |
+----------------------------------------------------------------+
| Desktop: TABLE                                                  |
| Товар    Прод. Выруч. Закуп. Удерж. Рекл. Приб. Маржа На ед. ДРР Доля  ! План|
| [A] Товар-1 ▸  45  18.5к  6.5к  5.2к  1.5к  5.3к  28.6% 118₽ 8.1% ██ 22% ... 95%|
|   ┌── WB card ──────┐  ┌── OZON card ─────┐                    |
|   │ Waterfall + FT   │  │ Waterfall + FT   │  Auto-insights    |
|   └──────────────────┘  └──────────────────┘                    |
| [B] Товар-2 ▸  32  12.1к  ...                                  |
|                                                                 |
| ИТОГО (6)   142  52.6к  22.5к  18.2к  4.9к  7.0к  13.3% 49₽ 9.3%      87%|
+----------------------------------------------------------------+
| Mobile: CARDS                                                   |
| [A] Товар-1  ⚠  95%  28.6%  ▸                                 |
|     Продажи    Прибыль     На ед.                              |
|     18 500₽    5 300₽      118₽                                |
|     ████████████████████  (mini cost bar)                       |
+----------------------------------------------------------------+
| 1-20 из 42                    [◀] [1] [2] [3] [▶]             |
+----------------------------------------------------------------+
```

## Файлы

| Компонент | Путь | Строк | Props |
|-----------|------|-------|-------|
| UeTable | `frontend/src/components/UnitEconomics/UeTable.tsx` | 668 | 18 props (см. ниже) |
| UeExpandedRow | `frontend/src/components/UnitEconomics/UeExpandedRow.tsx` | 275 | `{ wbMetrics, ozonMetrics, marketplace, wbPlan, ozonPlan }` |
| UeMiniWaterfall | `frontend/src/components/UnitEconomics/UeMiniWaterfall.tsx` | 61 | `{ revenue, mpDeductions, purchase, ads, profit }` |

### Props UeTable (строки 60-78)

```ts
interface UeTableProps {
  products: UnitEconomicsItem[];
  abcMap: Map<string, AbcGrade>;
  planMap: Map<string, number>;              // product_id → completion_percent
  mpBreakdown: Map<string, MpBreakdownEntry>; // product_id → {wb?, ozon?}
  marketplace: Marketplace;
  hasAds: boolean;
  hasReturns: boolean;
  hasPlan: boolean;
  totalProfit: number;
  totalPlanCompletion: number;               // взвешенный % из backend
  planPaceMap: Map<string, PlanPaceData>;
  matrixFilter: MatrixQuadrant | null;
  matrixProductIds: Set<string> | null;
  onMatrixClear: () => void;
  wbPlanMap: Map<string, MpPlanEntry>;       // per-MP plan progress
  ozonPlanMap: Map<string, MpPlanEntry>;
}
```

## Data Flow

```
UnitEconomicsPage
  ├─ unitProducts, abcMap, planMap, mpBreakdown, planPaceMap, ...
  │
  └─ UeTable(products, abcMap, planMap, mpBreakdown, ...)
       ├─ useMemo: pipeline (search → filter → sort → paginate)
       ├─ useMemo: computeTotals(products) → allTotals (для ИТОГО)
       │
       └─ [expanded row] → UeExpandedRow(wbMetrics, ozonMetrics, ...)
            ├─ MpCard(metrics, mp='wb'/'ozon', plan)
            │    ├─ UeMiniWaterfall(revenue, mpDeductions, purchase, ads, profit)
            │    └─ FtBreakdownSection(fulfillment_breakdown)
            │         ├─ FtRow(ft='fbo', data, totalRevenue, singleType)
            │         └─ FtRow(ft='fbs', data, totalRevenue, singleType)
            │
            └─ buildInsights(wbMetrics, ozonMetrics) → auto-insights
```

## Колонки таблицы (desktop)

| # | Колонка | SortField | Данные | Цвет | Условие |
|---|---------|-----------|--------|------|---------|
| 1 | Товар | `name` | ABC badge + name + barcode + expand chevron | — | всегда |
| 2 | Продажи | `sales_count` | `sales_count` + `·returns_count` | возвраты по returnRate | всегда |
| 3 | Выручка | `revenue` | `formatCurrency(revenue)` | `font-medium` | всегда |
| 4 | Закупка | `purchase_costs` | `formatCurrency(purchase_costs)` | `text-amber-600` | всегда |
| 5 | Удерж. | `mp_costs` | `formatCurrency(mp_costs)` | `text-purple-600` | всегда |
| 6 | Реклама | `ad_cost` | `formatCurrency(ad_cost)` | `text-blue-600` | `hasAds` |
| 7 | Прибыль | `net_profit` | `formatCurrency(net_profit)` | emerald/red по знаку | всегда |
| 8 | Маржа | `margin` | `formatPercent(margin)` | badge (emerald/amber/red) | всегда |
| 9 | На ед. | `unit_profit` | `formatCurrency(unit_profit)` | emerald/red по знаку | всегда |
| 10 | ДРР | `drr` | `formatPercent(drr)` или "—" | `text-blue-600` | `hasAds` |
| 11 | Доля | `contribution` | ContributionBar (progress + %) | indigo/red | всегда |
| 12 | Alerts | — | AlertIcons (loss/margin_low/drr_high) | по типу | всегда |
| 13 | План | `plan_completion` | badge % + pace status | по completion | `hasPlan` |

**Динамические колонки:** Реклама (2 колонки: ad_cost + ДРР) появляется только при `hasAds`. План появляется только при `hasPlan`.

**colCount** (строка 237): `7 + (hasAds ? 2 : 0) + (hasPlan ? 1 : 0) + 2` (для Contribution + Alerts).

## Pipeline обработки данных

`useMemo` (строки 174-204): sequential pipeline:

1. **Matrix filter** — если `matrixProductIds` активен (клик по квадранту BCG), оставляет только товары из выбранного квадранта
2. **Search** — поиск по `name` и `barcode` (case-insensitive, `toLowerCase().includes(q)`)
3. **Filter** — ABC/profitable/loss через `applyProductFilter()`:
   - `all` — без фильтрации
   - `profitable` — `net_profit > 0`
   - `loss` — `net_profit <= 0`
   - `abc_a/b/c` — по грейду из `abcMap`
4. **Sort** — через `getSortValue()` (строки 168-180 в ueHelpers.ts):
   - `name` — `toLowerCase()` + `localeCompare('ru')`
   - `margin` — `net_profit / revenue * 100`
   - `contribution` — `net_profit / totalProfit * 100`
   - `plan_completion` — из `planMap` (нет плана = -1, сортируется в конец)
   - Остальные — прямой доступ к `metrics[field]`

## Пагинация

- **Desktop:** 20 записей (`ITEMS_PER_PAGE_DESKTOP`)
- **Mobile:** 10 записей (`ITEMS_PER_PAGE_MOBILE`)
- Определение mobile: `useEffect` с `window.innerWidth < 640` + resize listener
- Номера страниц (desktop): `1 ... 3 [4] 5 ... 8` — с эллипсами, +/-1 от текущей
- Mobile: только `prev/next` кнопки
- Сброс: `page = 1` при изменении search/filter/sort/matrixFilter
- Сброс expandedRows при смене страницы

## Mobile-карточки

Каждая карточка (строки 507-596):

**Row 1:** ABC badge + name + alerts + plan% + margin badge + chevron

**Row 2:** Grid 3 колонки:
- Продажи: `formatCurrency(revenue)`
- Прибыль: `formatCurrency(net_profit)` (зелёный/красный)
- На ед.: `formatCurrency(unit_profit)` (зелёный/красный)

**Row 3:** Mini cost bar (если `revenue > 0`):
- `amber` = purchase / revenue %
- `purple` = mp_costs / revenue %
- `blue` = ad_cost / revenue % (если > 0)
- `emerald/red` = |net_profit| / revenue %

**Mobile ИТОГО** (строки 599-621): 3 колонки (Продажи, Прибыль, Маржа)

## Expanded Row (UeExpandedRow)

**Условие показа:** `isExpanded` (клик по строке) + данные `mpBreakdown`.

**Фильтрация МП** (строки 242-247):
- `marketplace === 'all'` — показываются оба МП
- `marketplace === 'wb'` — только WB
- `marketplace === 'ozon'` — только OZON

### MpCard (строки 125-201)

Каждая карточка маркетплейса содержит:

1. **Header:** цветная точка + "WB"/"OZON" + margin badge + sales count
2. **Plan progress** (если `plan.plan_revenue > 0`): бар + `X₽ из Y₽` + `N%`
3. **UeMiniWaterfall:** каскад Выручка → -Удерж → -Закупка → -Реклама → Прибыль
4. **FBO/FBS breakdown** (правило #34): ТОЛЬКО в раскрытой MpCard
5. **Bottom metrics:** На ед. | ДРР | Закупка

### Стили МП

| МП | Цвет точки | Border | Фон |
|----|-----------|--------|-----|
| WB | `bg-purple-500` | `border-purple-200` | `bg-purple-50/30` |
| OZON | `bg-blue-500` | `border-blue-200` | `bg-blue-50/30` |

### Auto-insights (строки 203-238)

Генерируются функцией `buildInsights()` при `marketplace === 'all'`:
- Разница маржи > 3 п.п.: `"WB маржа на 5.2 пп выше"`
- Разница ДРР в 1.3x+: `"OZON ДРР в 2.1x выше"`
- Разница unit_profit > 50₽: `"WB +120₽/ед."`

Показываются только на desktop (`hidden sm:flex`).

## FBO/FBS Breakdown (правило #34)

**Файл:** `UeExpandedRow.tsx`, компонент `FtBreakdownSection` (строки 96-123)

Показывается ТОЛЬКО в раскрытой MpCard (НЕ в свёрнутой строке таблицы).

### Два режима FtRow

| Режим | Условие | Содержимое |
|-------|---------|-----------|
| Single | только FBO или только FBS | badge + `N шт` + "маржинальность" + margin% (без шкалы) |
| Dual | FBO И FBS | badge + `N шт` + margin% + шкала доли выручки + `X%` |

### Пропорция выручки

```
ftTotalRevenue = fbo.revenue + fbs.revenue    -- base: сумма FT, НЕ costs-tree
pct = ft.revenue / ftTotalRevenue * 100       -- гарантия: FBO% + FBS% = 100%
```

### Benchmark цвета маржинальности (строки 38-44)

| Маржа | Текст | Фон |
|-------|-------|-----|
| >= 25% | `text-emerald-700` | `bg-emerald-50` |
| >= 15% | `text-sky-700` | `bg-sky-50` |
| >= 10% | `text-amber-700` | `bg-amber-50` |
| >= 5% | `text-orange-600` | `bg-orange-50` |
| < 5% | `text-red-600` | `bg-red-50` |

### Стили FBO/FBS

| Тип | Badge | Бар шкалы |
|-----|-------|-----------|
| FBO | `bg-gray-100 text-gray-600` | `bg-gray-400` |
| FBS | `bg-blue-100 text-blue-700` | `bg-blue-500` |

## UeMiniWaterfall

**Файл:** `UeMiniWaterfall.tsx` (61 строка)

Компактный каскад прибыли в каждой MpCard. Div-based bars (как ProfitWaterfall на дашборде).

| Строка | Значение | Цвет бара |
|--------|----------|-----------|
| Выручка | 100% | `bg-emerald-400` |
| -Удерж. | mpDeductions/revenue % | `bg-red-300` |
| -Закупка | purchase/revenue % | `bg-amber-300` |
| -Реклама | ads/revenue % (если > 0) | `bg-blue-300` |
| Прибыль | |profit|/revenue % | `bg-indigo-400` / `bg-red-400` |

Ширина бара: `Math.max(2, Math.min(part / total * 100, 100))` — минимум 2%.

## Backend: расчёт purchase (правило #43)

**Файл:** `backend/app/api/v1/dashboard.py`, строки 404-410

```python
# Settlement-based purchase для Ozon
is_ozon = product_id in ozon_product_ids or bool(product.get("ozon_product_id"))
if is_ozon and has_ozon_settled and product_id in settled_qty_by_product:
    raw_purchase = purchase_price * settled_qty_by_product[product_id]  # settlement
else:
    raw_purchase = purchase_price * sales_count                         # order-based (WB)
```

**Ozon:** `purchase = purchase_price * settled_qty` — количество из `mp_costs.settled_qty` (дата РАСЧЁТА, из `OperationAgentDeliveredToCustomer`). Settlement-based: пересечение с payout по оси дат (миграция 019).

**WB:** `purchase = purchase_price * sales_count` — order-based из `mp_sales` (работает корректно).

**FBO/FBS purchase** (строки 447-450):
```python
if is_ozon and has_ozon_settled and product_id in ft_settled_qty:
    ft_purchase = purchase_price * ft_settled_qty[product_id].get(ft_key, 0)
else:
    ft_purchase = purchase_price * ft_cnt
```

## Backend: FBO/FBS breakdown (правило #34)

**Файл:** `dashboard.py`, строки 434-467

**Условие:** `not fulfillment_type` (breakdown только если НЕ фильтруют по конкретному FT) + `product_id in ft_sales`.

**Для каждого FT (FBO, FBS):**
1. `ft_cnt` = sales count из `ft_sales`
2. `ft_rev` = revenue из `ft_sales`
3. `c` = costs из `ft_costs`
4. `ft_purchase` = settlement-based (Ozon) или order-based (WB)
5. `ft_ad = ad_cost * (ft_rev / mp_sales_revenue)` — пропорционально выручке
6. **Profit с payout:** `ft_payout = total_payout * (ft_rev / total_mp_sales_revenue)`, `ft_profit = ft_payout - ft_purchase - ft_ad`
7. **Fallback:** `ft_profit = ft_rev - c - ft_purchase - ft_ad`
8. `ft_margin = ft_profit / ft_rev * 100`
9. `ft_unit_profit = ft_profit / ft_cnt`

**Feature gate:** `fbs_analytics` (Pro+). Без Pro+ `include_ft_breakdown = False` — breakdown не генерируется.

## Формулы

```
-- Per-product profit (правило #18)
profit_i = total_payout * (revenue_i / Σrevenue) - purchase_i - ad_i

-- Purchase (правило #43)
purchase_ozon = purchase_price * settled_qty       -- settlement-based
purchase_wb   = purchase_price * sales_count       -- order-based

-- FT breakdown (правило #34)
ft_payout = total_payout * (ft_rev / total_mp_sales_rev)
ft_ad = ad_cost * (ft_rev / product_revenue)       -- пропорционально
ft_profit = ft_payout - ft_purchase - ft_ad
ft_margin = ft_profit / ft_rev * 100
ft_proportion = ft_rev / (fbo_rev + fbs_rev) * 100 -- FBO% + FBS% = 100%

-- Displayed metrics
margin = net_profit / revenue * 100
drr = ad_cost / revenue * 100
unit_profit = net_profit / sales_count
contribution = net_profit / totalProfit * 100       -- доля в общей прибыли
```

Ссылка: CLAUDE.md секция "Формулы"

## Сортировка

**Desktop:** клик по заголовку колонки (SortableHeader). Повторный клик — реверс направления. Новая колонка: `desc` (кроме `name` → `asc`).

**Mobile:** dropdown `<select>` с опциями + кнопка направления.

Опции сортировки (`SORT_OPTIONS` из ueHelpers.ts, строки 41-50):
| Поле | Подпись |
|------|---------|
| net_profit | Прибыль |
| revenue | Выручка |
| margin | Маржа |
| sales_count | Продажи |
| unit_profit | На ед. |
| name | Название |
| drr | ДРР |
| contribution | Доля |

## Filter tabs

Вкладки из `FILTER_TABS` (ueHelpers.ts, строки 32-39):

| Ключ | Desktop | Mobile | Активный цвет |
|------|---------|--------|---------------|
| all | Все | Все | `bg-gray-900 text-white` |
| profitable | Прибыльные | Приб. | `bg-emerald-600 text-white` |
| loss | Убыточные | Убыт. | `bg-red-600 text-white` |
| abc_a | A-класс | A | `bg-emerald-600 text-white` |
| abc_b | B-класс | B | `bg-amber-500 text-white` |
| abc_c | C-класс | C | `bg-gray-600 text-white` |

Счётчик справа: `{processed.length} из {products.length}`.

## Строка ИТОГО (tfoot)

Desktop (строки 463-502): суммы по всем колонкам (не отфильтрованные, из `allTotals`).
- Маржа: средняя (`profit / revenue * 100`)
- На ед.: средний (`profit / sales`)
- ДРР: общий (`adCost / revenue * 100`)
- План: `totalPlanCompletion` из backend (взвешенный)

Mobile (строки 599-621): 3 колонки — Продажи, Прибыль, Маржа.

## Подсветка строк

Функция `getRowBg()` из ueHelpers.ts (строки 83-87):

| Условие | Класс |
|---------|-------|
| `profit < 0` | `bg-red-50/40 hover:bg-red-50/60` |
| `margin >= 20%` | `bg-emerald-50/20 hover:bg-emerald-50/40` |
| Остальные | `hover:bg-gray-50/50` |

## ContributionBar

Компонент (строки 132-145): индикатор доли товара в общей прибыли.
- Progress bar: `w-10 sm:w-12`, `h-1.5`, скруглённый
- Цвет: `bg-indigo-400` (положительный) / `bg-red-300` (отрицательный)
- Текст: `X.X%` справа

## Состояние и кэширование

- **useState:**
  - `search` — строка поиска
  - `filter` — ProductFilter ('all' | 'profitable' | 'loss' | 'abc_a/b/c')
  - `sortField` — SortField (default: 'net_profit')
  - `sortDir` — SortDirection (default: 'desc')
  - `page` — номер страницы
  - `expandedRows` — Set<string> (product_id раскрытых строк)
  - `isMobile` — boolean (window.innerWidth < 640)
- **React Query:** данные приходят через props от UnitEconomicsPage
- **Сброс:** page при search/filter/sort/matrixFilter; expandedRows при смене page

## Edge Cases

1. **Нет данных** — "Нет данных за период" (таблица) / "Ничего не найдено" (фильтр)
2. **Matrix filter активен** — баннер "Фильтр: Звёзды" с кнопкой сброса
3. **Нет WB/OZON данных в expanded row** — "Нет данных по маркетплейсам за период"
4. **Один МП** — expanded row показывает `grid-cols-1 max-w-md` (не растягивается)
5. **FBS без данных** — `FtBreakdownSection` не рендерится (нет `fulfillment_breakdown`)
6. **Feature gate `fbs_analytics`** — backend не генерирует breakdown для Free плана
7. **Plan без данных** — колонка "План" скрыта, pace не показывается
8. **Нет рекламы** — колонки "Реклама" и "ДРР" скрыты, `UeMiniWaterfall` пропускает строку
9. **Ozon без settled_qty** — fallback на `sales_count * purchase_price` (order-based)

## Зависимости

- **Зависит от:** UnitEconomicsPage (все данные через props), ueHelpers (ABC/sort/filter/alerts), uePlanHelpers (pace/matrix/completion)
- **Используется в:** UnitEconomicsPage (основная секция)
- **Feature gate:** `unit_economics` (Pro+) — наследуется от страницы; `fbs_analytics` (Pro+) — для FBO/FBS breakdown

## Известные проблемы

- [ ] `costs_tree_ratio` в типах frontend — deprecated, backend возвращает 1.0, не используется
- [ ] Desktop таблица может требовать горизонтального скролла при всех колонках (hasAds + hasPlan) на узких экранах — `overflow-x-auto` применён
