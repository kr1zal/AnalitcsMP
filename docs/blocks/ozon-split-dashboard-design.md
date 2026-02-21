# Split Dashboard Design — Продажи + Финансы

> Дата: 21.02.2026
> Автор: Claude (senior UI/UX дизайнер)
> Статус: Design spec
> Связан: [ozon-dashboard-audit.md](./ozon-dashboard-audit.md) (Вариант B — Dual-axis)

## Проблема

Ozon использует две оси дат: ORDER (mp_sales, дата заказа) и SETTLEMENT (costs-tree, дата финоперации). Смешивание осей даёт абсурдные числа при коротких периодах (revenue=SETTLEMENT 1783р, count=ORDER 1шт). Решение: визуально разделить дашборд на две зоны с явной маркировкой оси данных.

---

## 1. Общая архитектура: две зоны

```
ЗОНА "ПРОДАЖИ" (ORDER-based)             ЗОНА "ФИНАНСЫ" (SETTLEMENT-based)
  Данные: mp_sales, mp_ad_costs            Данные: costs-tree, mp_costs
  Ось: дата заказа                         Ось: дата финансовой операции
  Обновление: ежедневно                    Обновление: с задержкой 1-3 дня

  Карточки:                                Карточки:
  - Заказы (count + revenue)               - Начислено / Выкупы (costs-tree revenue)
  - Себестоимость (COGS)                   - Удержания МП
  - Реклама + ДРР                          - Чистая прибыль
  - Конверсия (buyout %)                   - К перечислению (payout)

  Графики:                                 Графики:
  - SalesChart (заказы/выкупы/выручка)     - ProfitChart (прибыль по дням)
  - DrrChart (ДРР по дням)                 - ProfitWaterfall (каскад)
  - ConversionChart (конверсия по дням)    - CostsDonutChart (структура расходов)
                                           - TopProductsChart (топ по прибыли)
```

### Принцип разделения

| Метрика | Ось | Зона | Почему |
|---------|-----|------|--------|
| Заказы (count, revenue) | ORDER | Продажи | mp_sales = аналитика МП по дате заказа |
| Себестоимость | ORDER (WB) / SETTLEMENT (Ozon) | Продажи | COGS привязан к кол-ву в своей оси |
| Реклама | ORDER (ad spend date) | Продажи | Дата рекламного расхода = дата показа |
| Конверсия (buyout %) | ORDER | Продажи | orders->sales ratio корректен на одной оси |
| Выкупы / Начислено | SETTLEMENT | Финансы | costs-tree = финотчёт МП |
| Удержания МП | SETTLEMENT | Финансы | Из costs-tree (финотчёт) |
| Чистая прибыль | SETTLEMENT | Финансы | profit = payout - purchase - ads |
| К перечислению | SETTLEMENT | Финансы | total_accrued из costs-tree |

---

## 2. Desktop layout (lg+, 1024px+)

### ASCII Mockup

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  FilterPanel  [7д] [30д] [90д] | 01.02 — 21.02 | МП: [Все ▼] | FBO/FBS   │
└─────────────────────────────────────────────────────────────────────────────┘

┌─ ПРОДАЖИ ── по дате заказа ── ? ────────────────────────────────────────────┐
│                                                                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │ [🛍] Заказы   │ │ [📦] Закупка │ │ [📢] Реклама │ │ [📊] Конверс.│        │
│  │   42          │ │  15 200 ₽    │ │  3 400 ₽     │ │   81%        │        │
│  │ 38 500 ₽     │ │ ∅ 362₽/шт   │ │ ДРР 8.8%     │ │ 34 из 42     │        │
│  │ +12%         │ │              │ │              │ │              │        │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘        │
│                                                                              │
│  ┌─ Товары ─┐  ┌─────────────────────────────────────────────────────────┐  │
│  │ ○ все    │  │   SalesChart            │    DrrChart                   │  │
│  │ ○ 1. Тес │  │   (заказы/выкупы/       │    (ДРР по дням)             │  │
│  │ ○ 2. L-к │  │    выручка по дням)     │                              │  │
│  │ ○ 3. Вит │  ├─────────────────────────┼──────────────────────────────┤  │
│  │ ○ 4. Ома │  │   ConversionChart       │                              │  │
│  │ ○ 5. Цин │  │   (конверсия по дням)   │     (пустой слот)            │  │
│  └──────────┘  └─────────────────────────────────────────────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

              ↕  gap-6 (24px) — визуальное разделение зон

┌─ ФИНАНСЫ ── по дате финоперации ── ? ───────────────────────────────────────┐
│                                                                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │ [🛒] Выкупы  │ │ [📋] Удерж.  │ │ [💰] Прибыль │ │ [💳] Выплата │        │
│  │  38 500 ₽    │ │  12 300 ₽    │ │   7 600 ₽    │ │  26 200 ₽    │        │
│  │ 34 шт        │ │ Ком·Лог·Хран │ │ маржа 19.7%  │ │ Oz 12K·WB 14K│       │
│  │ +8%          │ │              │ │              │ │              │        │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘        │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │   ProfitChart                  │    ProfitWaterfall                    │  │
│  │   (прибыль по дням)            │    (каскад прибыли)                  │  │
│  ├────────────────────────────────┼──────────────────────────────────────┤  │
│  │   CostsDonutChart              │    TopProductsChart                  │  │
│  │   (структура расходов)         │    (топ товаров по прибыли)          │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │   MarketplaceBreakdown  [OZON карточка]  │  [WB карточка]             │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌─ ПЛАН + ОСТАТКИ ── (вне зон, нейтральные данные) ───────────────────────────┐
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │   PlanCompletionCard  (если задан план)                                │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────────────┐ ┌──────────────────────────────────────────────┐  │
│  │ StockForecastChart   │ │ StockHistoryChart                            │  │
│  │ (запас по дням)      │ │ (динамика остатков)                          │  │
│  └──────────────────────┘ └──────────────────────────────────────────────┘  │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │   StocksTable (таблица остатков)                                       │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Desktop Grid System

```
Зона "Продажи":
  - Карточки: grid-cols-4, gap-2.5 sm:gap-3
  - Графики: sidebar (w-36) + flex-1 с grid-cols-2 внутри
  - ConversionChart: одна карточка в grid (3-й слот пустой → lg:col-span-2 или gap)

Зона "Финансы":
  - Карточки: grid-cols-4, gap-2.5 sm:gap-3
  - Графики: grid-cols-2, gap-2 sm:gap-3 (БЕЗ сайдбара — фильтр товаров в Продажах)
  - Analytics: grid-cols-2 (CostsDonut + TopProducts)
  - MarketplaceBreakdown: grid-cols-2 (Ozon + WB)

Нейтральная зона:
  - PlanCompletionCard: full-width
  - Stocks: grid-cols-2 (Forecast + History), затем StocksTable full-width
```

### Desktop Spacing

```
Между FilterPanel и зоной "Продажи":        mb-4 lg:mb-6
Между заголовком зоны и карточками:          mb-3 lg:mb-4
Между карточками и графиками:               mb-4 lg:mb-5
Внутри зоны (графики, analytics):            mb-4 lg:mb-5
Между зоной "Продажи" и зоной "Финансы":    mt-6 lg:mt-8 (усиленный gap)
Между зоной "Финансы" и нейтральной зоной:  mt-6 lg:mt-8
```

---

## 3. Tablet layout (md, 768-1023px)

### ASCII Mockup

```
┌──────────────────────────────────────────────┐
│  FilterPanel (компактный)                    │
└──────────────────────────────────────────────┘

┌─ ПРОДАЖИ ── по дате заказа ── ? ─────────────┐
│                                                │
│  ┌─────────────┐ ┌─────────────┐              │
│  │ Заказы      │ │ Закупка     │              │
│  │  42         │ │ 15 200 ₽    │              │
│  └─────────────┘ └─────────────┘              │
│  ┌─────────────┐ ┌─────────────┐              │
│  │ Реклама     │ │ Конверсия   │              │
│  │ 3 400 ₽     │ │  81%        │              │
│  └─────────────┘ └─────────────┘              │
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │ SalesChart                               │ │
│  ├──────────────────────────────────────────┤ │
│  │ DrrChart         │ ConversionChart       │ │
│  └──────────────────────────────────────────┘ │
│                                                │
└────────────────────────────────────────────────┘

         ↕  gap-5 (20px)

┌─ ФИНАНСЫ ── по дате финоперации ── ? ─────────┐
│                                                │
│  ┌─────────────┐ ┌─────────────┐              │
│  │ Выкупы      │ │ Удержания   │              │
│  │ 38 500 ₽    │ │ 12 300 ₽    │              │
│  └─────────────┘ └─────────────┘              │
│  ┌─────────────┐ ┌─────────────┐              │
│  │ Прибыль     │ │ Выплата     │              │
│  │  7 600 ₽    │ │ 26 200 ₽    │              │
│  └─────────────┘ └─────────────┘              │
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │ ProfitChart                              │ │
│  ├──────────────────────────────────────────┤ │
│  │ ProfitWaterfall  │ CostsDonutChart       │ │
│  ├──────────────────┼───────────────────────┤ │
│  │ TopProductsChart │ (пусто)               │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │ MarketplaceBreakdown  [OZON] │ [WB]     │ │
│  └──────────────────────────────────────────┘ │
│                                                │
└────────────────────────────────────────────────┘

┌─ ПЛАН + ОСТАТКИ ─────────────────────────────┐
│  PlanCompletionCard                           │
│  StockForecast  │ StockHistory                │
│  StocksTable (full-width)                     │
└───────────────────────────────────────────────┘
```

### Tablet Grid System

```
Карточки: grid-cols-2, gap-2.5
Графики "Продажи": SalesChart full-width, затем grid-cols-2 (DRR + Conversion)
Графики "Финансы": ProfitChart full-width, затем grid-cols-2 (Waterfall + Donut)
                    TopProducts → col-span-2 (full-width)
Sidebar товаров: СКРЫТ на tablet (md). Фильтр товаров доступен через dropdown.
MarketplaceBreakdown: grid-cols-2
```

---

## 4. Mobile layout (<768px)

### ASCII Mockup

```
┌──────────────────────────────┐
│  FilterPanel (2 строки)      │
│  [7д][30д][90д]   FBO|FBS    │
│  📅 01.02-21.02 МП▼ 📊 📄   │
└──────────────────────────────┘

┌─ Продажи ── заказы ── ? ─────┐
│                                │
│ ┌────────────┐┌────────────┐  │
│ │ Заказы     ││ Закупка    │  │
│ │  42        ││ 15 200 ₽   │  │
│ └────────────┘└────────────┘  │
│ ┌────────────┐┌────────────┐  │
│ │ Реклама    ││ Конверсия  │  │
│ │ 3 400 ₽    ││  81%       │  │
│ └────────────┘└────────────┘  │
│                                │
│ ┌────────────────────────────┐│
│ │ SalesChart (swipe tabs)    ││
│ │ (заказы по дням)           ││
│ └────────────────────────────┘│
│ ┌────────────────────────────┐│
│ │ DrrChart                   ││
│ └────────────────────────────┘│
│ ┌────────────────────────────┐│
│ │ ConversionChart            ││
│ └────────────────────────────┘│
│                                │
└────────────────────────────────┘

   ─── divider (1px gray-200) ───

┌─ Финансы ── расчёты ── ? ─────┐
│                                │
│ ┌────────────┐┌────────────┐  │
│ │ Выкупы     ││ Удержания  │  │
│ │ 38 500 ₽   ││ 12 300 ₽   │  │
│ └────────────┘└────────────┘  │
│ ┌────────────┐┌────────────┐  │
│ │ Прибыль    ││ Выплата    │  │
│ │  7 600 ₽   ││ 26 200 ₽   │  │
│ └────────────┘└────────────┘  │
│                                │
│ ┌────────────────────────────┐│
│ │ ProfitChart                ││
│ └────────────────────────────┘│
│ ┌────────────────────────────┐│
│ │ ProfitWaterfall            ││
│ └────────────────────────────┘│
│ ┌────────────────────────────┐│
│ │ CostsDonut                 ││
│ └────────────────────────────┘│
│ ┌────────────────────────────┐│
│ │ TopProducts                ││
│ └────────────────────────────┘│
│                                │
│ ┌────────────────────────────┐│
│ │ MarketplaceBreakdown       ││
│ │ [OZON]        [WB]         ││
│ └────────────────────────────┘│
│                                │
└────────────────────────────────┘

┌─ План + Остатки ──────────────┐
│ PlanCompletionCard             │
│ StockForecastChart             │
│ StockHistoryChart              │
│ StocksTable                    │
└────────────────────────────────┘
```

### Mobile Grid System

```
Карточки: grid-cols-2, gap-2
Графики: grid-cols-1 (stacked, full-width)
Sidebar товаров: СКРЫТ. Нет drill-down на mobile (экономия места).
MarketplaceBreakdown: grid-cols-2 (маленькие карточки)
Stocks: grid-cols-1
```

---

## 5. Компонент ZoneHeader (новый)

### Дизайн

ZoneHeader — заголовок зоны с пояснением оси данных. Два варианта: "Продажи" (ORDER) и "Финансы" (SETTLEMENT).

```
Desktop (lg+):
┌──────────────────────────────────────────────────────────────────┐
│  📊 Продажи                                    по дате заказа ? │
└──────────────────────────────────────────────────────────────────┘
  ^icon  ^title                                   ^axis-badge ^tooltip

Tablet (md):
┌──────────────────────────────────────────────┐
│  📊 Продажи                   по дате заказа │
└──────────────────────────────────────────────┘

Mobile (<md):
┌──────────────────────────────┐
│  Продажи · заказы          ? │
└──────────────────────────────┘
```

### Props

```tsx
interface ZoneHeaderProps {
  zone: 'sales' | 'finance';
}
```

### Стиль

```
Общий контейнер:
  flex items-center justify-between
  mb-3 lg:mb-4

Иконка (desktop/tablet):
  w-6 h-6 (hidden на mobile)
  Продажи: BarChart3 (lucide), text-indigo-600
  Финансы: Wallet (lucide), text-emerald-600

Заголовок:
  text-base sm:text-lg font-bold text-gray-900

Axis badge (desktop/tablet):
  text-xs font-medium text-gray-400 bg-gray-50 px-2 py-0.5 rounded-md
  Продажи: "по дате заказа"
  Финансы: "по дате финоперации"

Axis badge (mobile):
  Инлайн после заголовка через " · "
  Продажи: "Продажи · заказы"
  Финансы: "Финансы · расчёты"

Tooltip:
  Продажи: "Данные из аналитики маркетплейсов (mp_sales).\nОсь: дата размещения заказа.\nОбновляется ежедневно."
  Финансы: "Данные из финансового отчёта (costs-tree).\nОсь: дата проведения расчёта маркетплейсом.\nМожет отставать на 1-3 дня от даты заказа."
```

### Tailwind спецификация

```tsx
// ZoneHeader.tsx
<div className="flex items-center justify-between mb-3 lg:mb-4">
  <div className="flex items-center gap-2">
    {/* Icon — hidden mobile */}
    <div className={cn(
      'hidden sm:flex items-center justify-center w-8 h-8 rounded-lg',
      zone === 'sales' ? 'bg-indigo-50' : 'bg-emerald-50'
    )}>
      <Icon className={cn(
        'w-4.5 h-4.5',
        zone === 'sales' ? 'text-indigo-600' : 'text-emerald-600'
      )} />
    </div>

    {/* Title */}
    <h2 className="text-base sm:text-lg font-bold text-gray-900">
      {/* Desktop: полный заголовок */}
      <span className="hidden sm:inline">{title}</span>
      {/* Mobile: заголовок + инлайн-ось */}
      <span className="sm:hidden">
        {title}
        <span className="text-gray-400 font-medium"> · {shortAxis}</span>
      </span>
    </h2>
  </div>

  <div className="flex items-center gap-2">
    {/* Axis badge — hidden mobile */}
    <span className="hidden sm:inline text-xs font-medium text-gray-400 bg-gray-50 px-2 py-0.5 rounded-md">
      {axisBadge}
    </span>

    {/* Tooltip */}
    <CardTooltip text={tooltipText} align="right" />
  </div>
</div>
```

### Разделитель между зонами (divider)

**БЕЗ badge.** Чистый визуальный gap.

```
Desktop (lg+):
  mt-6 lg:mt-8 — увеличенный отступ (24-32px вместо обычных 16-24px)
  Никакой линии — белое пространство достаточно при наличии ZoneHeader

Tablet (md):
  mt-5 — 20px gap

Mobile (<md):
  mt-4 + border-t border-gray-200 pt-4
  На mobile нужна линия — без неё зоны сливаются при скролле
```

```tsx
// ZoneDivider (mobile only line)
<div className="mt-4 sm:mt-5 lg:mt-8 border-t border-gray-200 sm:border-0 pt-4 sm:pt-0" />
```

---

## 6. Перераспределение карточек по зонам

### Зона "Продажи" (ORDER-based) — 4 карточки

| # | Карточка | Данные | Accent | Icon |
|---|----------|--------|--------|------|
| 1 | **Заказы** | orders_count, ordersRevenue (mp_sales) | indigo | ShoppingBag |
| 2 | **Себестоимость** | purchase_price * sales_count (ORDER для WB, SETTLEMENT для Ozon) | amber | Package |
| 3 | **Реклама** | ad_cost + ДРР% (mp_ad_costs) | violet | Megaphone |
| 4 | **Конверсия** | buyout % = sales/orders * 100 | sky | TrendingUp |

**Себестоимость в "Продажах":** COGS привязан к количеству товаров. Для WB order-based (единая ось). Для Ozon используем settled_qty (settlement-based), но показываем в "Продажах" потому что пользователь ментально связывает "закупку" с товарами, а не с финоперациями. Тултип поясняет разницу осей.

**Новая карточка "Конверсия"** заменяет "Рентабельность/Delta". Конверсия = ORDER-metric (orders -> sales), чисто воронкообразная метрика. Рентабельность перемещается в зону "Финансы" как secondaryValue карточки "Прибыль".

### Зона "Финансы" (SETTLEMENT-based) — 4 карточки

| # | Карточка | Данные | Accent | Icon |
|---|----------|--------|--------|------|
| 1 | **Выкупы** | costs_tree_sales + credits (SETTLEMENT) | emerald | ShoppingCart |
| 2 | **Удержания МП** | ABS(отрицательные tree items) | slate | Receipt |
| 3 | **Чистая прибыль** | payout - purchase - ads | emerald/red | DollarSign |
| 4 | **К перечислению** | total_accrued (payout) | sky | Banknote |

**ChangeBadge (period comparison):** Остаётся на карточках "Заказы" (зона Продажи) и "Выкупы" (зона Финансы) — Pro+ feature.

---

## 7. Перераспределение графиков

### Зона "Продажи" — графики

```
Desktop (lg+):
  ┌──── sidebar ────┐  ┌───────────────────────────────────────┐
  │  Товары          │  │  SalesChart     │  DrrChart           │
  │  ○ все           │  │  (заказы по     │  (ДРР по дням)      │
  │  ○ 1. ...        │  │   дням)         │                     │
  │  ○ 2. ...        │  ├─────────────────┼─────────────────────┤
  │                  │  │  ConversionChart │                     │
  │                  │  │  (конверсия)     │  (пустой / reserved)│
  └──────────────────┘  └───────────────────────────────────────┘

  Grid: flex-row gap-3.
  Sidebar: w-28 sm:w-32 lg:w-36.
  Charts: flex-1 grid-cols-2 gap-2 sm:gap-3.
  ConversionChart занимает 1 слот, 4-й пустой.
  АЛЬТЕРНАТИВА: 3-й ряд — 1 chart full-width вместо 2-col.
```

**Sidebar товаров** остаётся ТОЛЬКО в зоне "Продажи". Drill-down по товару влияет на SalesChart, DrrChart, ConversionChart. В зоне "Финансы" sidebar не нужен — TopProductsChart уже показывает per-product, а остальные графики (ProfitWaterfall, CostsDonut) агрегированные.

### Зона "Финансы" — графики

```
Desktop (lg+):
  ┌─────────────────────────────────────────────────────────────┐
  │  ProfitChart (full-width или lg:col-span-2)                 │
  │  (прибыль по дням — area chart, revenue + profit)           │
  └─────────────────────────────────────────────────────────────┘
  ┌───────────────────────┐ ┌──────────────────────────────────┐
  │  ProfitWaterfall      │ │  CostsDonutChart                 │
  │  (каскад прибыли)     │ │  (структура расходов МП)         │
  ├───────────────────────┤ ├──────────────────────────────────┤
  │  TopProductsChart     │ │  (reserved / StockForecast?)     │
  │  (топ товаров)        │ │                                  │
  └───────────────────────┘ └──────────────────────────────────┘

  ProfitChart: col-span-2 (full-width, усиленный акцент на прибыль).
  Analytics: grid-cols-2 gap-2 sm:gap-3.
```

**ProfitChart на full-width** в зоне "Финансы" — акцент на прибыль. Текущий layout (grid-cols-2 с SalesChart) разбивается: SalesChart идёт в "Продажи", ProfitChart получает больше места.

### MarketplaceBreakdown

Размещение: **зона "Финансы"**, после графиков, перед стоками.

Обоснование: MarketplaceBreakdown (OZON/WB карточки) показывает costs-tree данные = SETTLEMENT. Визуально: пользователь сначала видит агрегированную прибыль, затем drill-down по МП.

### Нейтральная зона (вне зон)

```
PlanCompletionCard     — между зоной "Финансы" и стоками
StockForecastChart     — grid-cols-2 с StockHistoryChart
StockHistoryChart      — grid-cols-2 с StockForecast
StocksTable            — full-width
```

Обоснование: остатки = текущее состояние склада, не привязаны к ORDER/SETTLEMENT осям. План продаж = цель, не привязан к конкретной оси.

---

## 8. WB-specific решения

### Проблема

У WB нет cross-axis проблемы — order date и settlement date совпадают (reportDetailByPeriod привязан к дате реализации). Нужно ли разделять зоны для WB?

### Решение: ОДИНАКОВЫЙ layout для всех МП

**Аргументы за:**
- Консистентность UI — пользователь не путается при переключении МП
- Ментальная модель "Продажи vs Финансы" полезна для ЛЮБОГО МП
- Упрощает код — один layout, нет условного рендеринга
- Пользователь с Ozon+WB не видит "скачок" при смене фильтра

**Аргументы против:**
- Лишний визуальный шум для чисто-WB пользователей
- Зона "Финансы" для WB показывает те же данные что и "Продажи" (но с costs-tree perspective)

**Итог:** Один layout для всех. НЕ объединяем зоны для WB. Единообразие важнее.

### WB-specific tooltip

На ZoneHeader при marketplace=wb:
```
"У WB даты заказов и расчётов совпадают.
Обе зоны показывают данные за один период."
```

На ZoneHeader при marketplace=ozon:
```
"У Ozon расчёты проходят с задержкой 1-3 дня.
Данные в зоне «Финансы» могут отличаться от «Продаж»
на коротких периодах (1-7 дней)."
```

---

## 9. Edge Cases

### 9.1. Нет данных Ozon settlement

```
Зона "Финансы" при пустом costs-tree:
┌──────────────────────────────────────────────────────┐
│  [💰] Финансы — по дате финоперации                  │
│                                                      │
│  ┌─────────────────────────────────────────────┐     │
│  │  ⚠ Финансовые данные Ozon за этот период    │     │
│  │    ещё не поступили. Обычно обновление       │     │
│  │    происходит в течение 1-3 дней.            │     │
│  │                                               │     │
│  │    Показаны данные WB.                       │     │
│  └─────────────────────────────────────────────┘     │
│                                                      │
│  [Карточки с данными только WB, Ozon — skeleton]    │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Tailwind для warning banner:**
```tsx
<div className="bg-amber-50 border border-amber-200 rounded-xl p-3 sm:p-4 mb-3">
  <div className="flex items-start gap-2">
    <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
    <div>
      <p className="text-sm font-medium text-amber-800">
        Финансовые данные Ozon за этот период ещё не поступили
      </p>
      <p className="text-xs text-amber-600 mt-1">
        Обычно обновление происходит в течение 1-3 дней. Показаны данные WB.
      </p>
    </div>
  </div>
</div>
```

### 9.2. Только WB подключен

Зоны остаются. Ozon-карточки показывают "0" или skeleton с пометкой "Ozon не подключен". MarketplaceBreakdown скрывает Ozon-карточку (существующее поведение).

### 9.3. Период 1 день

При period <= 3 дней И marketplace включает ozon: показать warning banner.

```
┌────────────────────────────────────────────────────────────────┐
│  ⚠ Короткий период (1 день). Данные Ozon в зонах «Продажи»   │
│  и «Финансы» могут значительно расходиться из-за задержки      │
│  расчётов. Рекомендуем период от 7 дней для точных данных.    │
└────────────────────────────────────────────────────────────────┘
```

**Расположение:** между FilterPanel и зоной "Продажи".

```tsx
// CrossAxisWarning.tsx
{showCrossAxisWarning && (
  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
    <div className="flex items-center gap-2">
      <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
      <p className="text-sm text-amber-800">
        <span className="font-medium">Короткий период.</span>{' '}
        Данные Ozon в зонах "Продажи" и "Финансы" могут расходиться
        из-за задержки расчётов. Рекомендуем период от 7 дней.
      </p>
      <button onClick={dismissWarning} className="ml-auto flex-shrink-0">
        <X className="w-4 h-4 text-amber-400 hover:text-amber-600" />
      </button>
    </div>
  </div>
)}
```

Условие показа:
```tsx
const showCrossAxisWarning = useMemo(() => {
  if (marketplace === 'wb') return false; // WB не имеет проблемы
  const days = Math.ceil(
    (new Date(dateRange.to).getTime() - new Date(dateRange.from).getTime()) / 86400000
  );
  return days <= 3;
}, [marketplace, dateRange]);
```

### 9.4. Marketplace = WB only (глобальный фильтр)

Зоны остаются, но warning скрыт. Все данные корректны на единой оси.

### 9.5. Ozon costs-tree пуст, но mp_sales есть

Зона "Продажи" показывает данные нормально. Зона "Финансы": карточки в skeleton, banner "Финансовые данные загружаются...".

---

## 10. Tailwind CSS спецификация

### 10.1. ZoneContainer (обёртка зоны)

```tsx
// Без видимой границы — зону определяет ZoneHeader + spacing
<section className="relative">
  <ZoneHeader zone="sales" />
  {/* content */}
</section>
```

Не используем `bg-*` для зон — белый фон сохраняется. Зоны определяются заголовком + увеличенным gap между ними.

### 10.2. ZoneHeader

```tsx
// Продажи
<div className="flex items-center justify-between mb-3 lg:mb-4">
  <div className="flex items-center gap-2 min-w-0">
    <div className="hidden sm:flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-50 ring-1 ring-indigo-100">
      <BarChart3 className="w-[18px] h-[18px] text-indigo-600" />
    </div>
    <h2 className="text-base sm:text-lg font-bold text-gray-900">
      <span className="hidden sm:inline">Продажи</span>
      <span className="sm:hidden">
        Продажи<span className="text-gray-400 font-medium text-sm"> · заказы</span>
      </span>
    </h2>
  </div>
  <div className="flex items-center gap-2">
    <span className="hidden sm:inline text-xs font-medium text-gray-400 bg-gray-50 px-2 py-0.5 rounded-md border border-gray-100">
      по дате заказа
    </span>
    {/* tooltip button */}
  </div>
</div>

// Финансы
<div className="flex items-center justify-between mb-3 lg:mb-4">
  <div className="flex items-center gap-2 min-w-0">
    <div className="hidden sm:flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-50 ring-1 ring-emerald-100">
      <Wallet className="w-[18px] h-[18px] text-emerald-600" />
    </div>
    <h2 className="text-base sm:text-lg font-bold text-gray-900">
      <span className="hidden sm:inline">Финансы</span>
      <span className="sm:hidden">
        Финансы<span className="text-gray-400 font-medium text-sm"> · расчёты</span>
      </span>
    </h2>
  </div>
  <div className="flex items-center gap-2">
    <span className="hidden sm:inline text-xs font-medium text-gray-400 bg-gray-50 px-2 py-0.5 rounded-md border border-gray-100">
      по дате финоперации
    </span>
    {/* tooltip button */}
  </div>
</div>
```

### 10.3. ZoneDivider

```tsx
// Между зонами
<div className="mt-4 sm:mt-5 lg:mt-8 pt-4 sm:pt-5 lg:pt-0 border-t border-gray-200 sm:border-gray-100 lg:border-0" />
```

- Mobile: `mt-4 pt-4 border-t border-gray-200` — чёткая линия
- Tablet: `sm:mt-5 sm:pt-5 sm:border-gray-100` — тонкая линия
- Desktop: `lg:mt-8 lg:pt-0 lg:border-0` — только whitespace (32px gap)

### 10.4. Карточки (grid)

```tsx
// Зона Продажи — карточки
<div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5 lg:gap-3 mb-3 sm:mb-4 lg:mb-5">
  <SummaryCard ... />  {/* Заказы */}
  <SummaryCard ... />  {/* Себестоимость */}
  <SummaryCard ... />  {/* Реклама */}
  <SummaryCard ... />  {/* Конверсия */}
</div>

// Зона Финансы — карточки
<div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5 lg:gap-3 mb-3 sm:mb-4 lg:mb-5">
  <SummaryCard ... />  {/* Выкупы */}
  <SummaryCard ... />  {/* Удержания */}
  <SummaryCard ... />  {/* Прибыль */}
  <SummaryCard ... />  {/* Выплата */}
</div>
```

### 10.5. Графики "Продажи"

```tsx
// Desktop: sidebar + charts
<div className="flex flex-row gap-2 sm:gap-3 mb-3 sm:mb-4 lg:mb-5">
  {/* Sidebar — hidden mobile */}
  <div className="hidden sm:block w-28 sm:w-32 lg:w-36 flex-shrink-0">
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2 sm:p-3">
      <h4 className="text-[9px] sm:text-[10px] font-semibold text-gray-400 uppercase mb-1.5">
        Товары
      </h4>
      {/* radio buttons */}
    </div>
  </div>

  {/* Charts */}
  <div className="flex-1 min-w-0">
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-3">
      <SalesChart ... />
      <DrrChart ... />
      <ConversionChart ... />
      {/* 4-й слот пуст на lg, ConversionChart col-span-1 */}
    </div>
  </div>
</div>
```

### 10.6. Графики "Финансы"

```tsx
// ProfitChart — full-width
<div className="mb-3 sm:mb-4 lg:mb-5">
  <ProfitChart ... />
</div>

// Analytics grid
<div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mb-3 sm:mb-4 lg:mb-5">
  <ProfitWaterfall ... />
  <CostsDonutChart ... />
  <TopProductsChart ... />
  <StockForecastChart ... />
</div>
```

### 10.7. MarketplaceBreakdown

```tsx
// Остаётся в зоне "Финансы", без изменений в компоненте
<div className="mb-3 sm:mb-4 lg:mb-5">
  <MarketplaceBreakdown ... />
</div>
```

### 10.8. CrossAxisWarning

```tsx
<div className="bg-amber-50 border border-amber-200 rounded-xl p-3 sm:p-4 mb-4 sm:mb-5">
  <div className="flex items-start sm:items-center gap-2 sm:gap-3">
    <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 sm:mt-0 flex-shrink-0" />
    <p className="text-xs sm:text-sm text-amber-800 flex-1">
      <span className="font-semibold">Короткий период.</span>{' '}
      Данные Ozon в зонах "Продажи" и "Финансы" могут расходиться
      из-за задержки расчётов ({daysCount}д). Рекомендуем от 7 дней.
    </p>
    <button
      onClick={dismiss}
      className="flex-shrink-0 p-1 rounded-lg hover:bg-amber-100 transition-colors"
    >
      <X className="w-3.5 h-3.5 text-amber-400" />
    </button>
  </div>
</div>
```

### 10.9. Нейтральная зона

```tsx
// PlanCompletionCard
<div className="mb-3 sm:mb-4 lg:mb-5">
  <PlanCompletionCard ... />
</div>

// Stocks row
<div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mb-3 sm:mb-4 lg:mb-5">
  <StockForecastChart ... />  {/* MOVED from Finance analytics to neutral */}
  {/* StockHistoryChart — self-contained, full-width */}
</div>

<div className="mb-3 sm:mb-4 lg:mb-5">
  <StockHistoryChart ... />
</div>

<div id="stocks-table" className="mb-3 sm:mb-4 lg:mb-5">
  <StocksTable ... />
</div>
```

---

## 11. Scrolling behavior

Все зоны в **едином скролле** (single page scroll). Нет табов, нет горизонтального свайпа между зонами.

Обоснование:
- Пользователь видит полную картину при скролле
- Табы скрывают данные (анти-паттерн для дашбордов)
- GA/Mixpanel/Shopify используют single scroll dashboard
- Mobile: natural vertical scroll, divider помогает навигации

**Sticky FilterPanel** сохраняется (top-0 z-30 на mobile, top-16 z-30 на desktop).

---

## 12. Карточка "Конверсия" (новая, заменяет Delta/Рентабельность)

### Зачем

Текущая 8-я карточка "Δ к предыдущему / Рентабельность" — условная (зависит от preset/custom). В split-layout рентабельность уходит в secondaryValue карточки "Прибыль" (зона Финансы), а Delta — в ChangeBadge. Освободившийся слот занимает "Конверсия" — чисто ORDER-метрика.

### Дизайн

```
┌──────────────────────────────┐
│  [📊] Конверсия          ?   │
│                              │
│   81%                        │
│   34 из 42 заказов           │
│                              │
└──────────────────────────────┘
```

```tsx
<SummaryCard
  title="Конверсия"
  mobileTitle="Выкуп"
  value={buyoutPercent}
  format="percent"  // или передать как string: `${buyoutPercent}%`
  secondaryValue={`${salesCountForTile} из ${ordersCountForTile} заказов`}
  tooltip={[
    'Процент выкупа = Выкупы / Заказы × 100%',
    `= ${salesCountForTile} / ${ordersCountForTile} × 100%`,
    `= ${buyoutPercent}%`,
    '',
    'Показывает какая доля заказов была выкуплена.',
  ].join('\n')}
  icon={TrendingUp}
  accent="sky"
  loading={isSummaryLoading}
/>
```

---

## 13. Полная структура DashboardPage (после рефакторинга)

```tsx
return (
  <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8">

    {/* CC=0 reminder modal */}
    {showCcModal && <CcReminderModal ... />}

    {/* FilterPanel */}
    <FilterPanel ... />

    {/* Cross-axis warning (Ozon + short period) */}
    {showCrossAxisWarning && <CrossAxisWarning ... />}

    {/* ═══════════════ ЗОНА: ПРОДАЖИ ═══════════════ */}
    <section>
      <ZoneHeader zone="sales" />

      {/* Карточки: Заказы, Себестоимость, Реклама, Конверсия */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5 lg:gap-3 mb-3 sm:mb-4 lg:mb-5">
        <SummaryCard title="Заказы" ... />
        <SummaryCard title="Себестоимость" ... />
        <SummaryCard title="Реклама" ... />
        <SummaryCard title="Конверсия" ... />
      </div>

      {/* Графики: SalesChart, DrrChart, ConversionChart + sidebar */}
      <div className="flex flex-row gap-2 sm:gap-3 mb-3 sm:mb-4 lg:mb-5">
        <ProductSidebar ... />  {/* hidden mobile */}
        <div className="flex-1 min-w-0">
          <Suspense fallback={<ChartSkeletons />}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-3">
              <SalesChart ... />
              <DrrChart ... />
              <ConversionChart ... />
            </div>
          </Suspense>
        </div>
      </div>
    </section>

    {/* ═══════════ РАЗДЕЛИТЕЛЬ ═══════════ */}
    <ZoneDivider />

    {/* ═══════════════ ЗОНА: ФИНАНСЫ ═══════════════ */}
    <section>
      <ZoneHeader zone="finance" />

      {/* Карточки: Выкупы, Удержания, Прибыль, Выплата */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5 lg:gap-3 mb-3 sm:mb-4 lg:mb-5">
        <SummaryCard title="Выкупы" ... />
        <SummaryCard title="Удержания МП" ... />
        <SummaryCard title="Чистая прибыль" ... />
        <SummaryCard title="К перечислению" ... />
      </div>

      {/* ProfitChart — full-width */}
      <div className="mb-3 sm:mb-4 lg:mb-5">
        <Suspense fallback={<ChartSkeleton />}>
          <ProfitChart ... />
        </Suspense>
      </div>

      {/* Analytics: Waterfall, Donut, TopProducts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mb-3 sm:mb-4 lg:mb-5">
        <ProfitWaterfall ... />
        <CostsDonutChart ... />
        <TopProductsChart ... />
      </div>

      {/* MarketplaceBreakdown */}
      <div className="mb-3 sm:mb-4 lg:mb-5">
        <MarketplaceBreakdown ... />
      </div>
    </section>

    {/* ═══════════ РАЗДЕЛИТЕЛЬ ═══════════ */}
    <ZoneDivider />

    {/* ═══════════════ НЕЙТРАЛЬНАЯ ЗОНА ═══════════════ */}

    {/* План продаж */}
    <FeatureGate feature="unit_economics" hide>
      <div className="mb-3 sm:mb-4 lg:mb-5">
        <PlanCompletionCard ... />
      </div>
    </FeatureGate>

    {/* Stocks */}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mb-3 sm:mb-4 lg:mb-5">
      <StockForecastChart ... />
    </div>

    <div className="mb-3 sm:mb-4 lg:mb-5">
      <StockHistoryChart ... />
    </div>

    <div id="stocks-table" className="mb-3 sm:mb-4 lg:mb-5">
      <StocksTable ... />
    </div>

  </div>
);
```

---

## 14. Новые файлы и изменения

### Новые компоненты

| Файл | Назначение | ~LOC |
|------|-----------|------|
| `Dashboard/ZoneHeader.tsx` | Заголовок зоны (Продажи / Финансы) | ~80 |
| `Dashboard/ZoneDivider.tsx` | Разделитель между зонами | ~10 |
| `Dashboard/CrossAxisWarning.tsx` | Warning banner для коротких периодов Ozon | ~40 |

### Изменённые файлы

| Файл | Изменение |
|------|-----------|
| `pages/DashboardPage.tsx` | Реструктуризация: 2 зоны + нейтральная. Перемещение компонентов. Новая карточка "Конверсия". |
| `Dashboard/SummaryCard.tsx` | Без изменений (переиспользуется как есть) |
| `Dashboard/ProfitChart.tsx` | Возможно: убрать из grid-cols-2, сделать full-width в зоне Финансы |
| `Dashboard/MarketplaceBreakdown.tsx` | Без изменений (перемещается в зону Финансы) |
| `Dashboard/ProfitWaterfall.tsx` | Без изменений |
| `Dashboard/StockForecastChart.tsx` | Перемещается в нейтральную зону |

### НЕ создаём

- Новых API endpoints (используем существующие)
- Новых hooks (используем существующие)
- Миграций (дизайн-рефакторинг, не data change)

---

## 15. Метрики оценки дизайна

| Критерий | Текущий | После split |
|----------|---------|-------------|
| Cross-axis confusion | Частое (6 из 16 блоков) | Нулевое (явная маркировка) |
| Информационная перегрузка | Высокая (8 карточек в ряд) | Средняя (4+4, разделены) |
| Время до понимания "где деньги" | ~15 сек | ~5 сек (зона "Финансы") |
| Кол-во scroll до StocksTable | ~3 экрана | ~4 экрана (больше контента) |
| Новых компонентов | 0 | 3 (ZoneHeader, Divider, Warning) |
| Изменённых компонентов | 0 | 1-2 (DashboardPage, ProfitChart) |
| Сложность реализации | — | ~6-8 часов фронтенд |

---

## 16. Альтернативы рассмотренные и отвергнутые

### Tab-based (Продажи / Финансы как табы)

Отвергнуто. Табы скрывают данные. Пользователь должен видеть обе зоны одновременно для сравнения. Анти-паттерн для аналитических дашбордов (GA, Mixpanel, Amplitude — все используют scroll, не табы).

### Side-by-side (два столбца: Продажи | Финансы)

Отвергнуто. Не работает на mobile. На desktop даёт слишком узкие карточки (по 2 в ряд вместо 4). Нарушает pattern "4 карточки в ряд".

### Collapsible зоны (accordion)

Отвергнуто. Скрывает данные по умолчанию. Пользователь должен кликать чтобы развернуть. Dashboard = обзор, не drill-down.

### Color-coded zones (bg-blue-50 vs bg-green-50)

Отвергнуто. Создаёт визуальный шум. Цвета фона конфликтуют с цветами акцентов карточек. Enterprise дашборды используют whitespace + headers, не цветовые зоны.

---

## 17. Резюме решений

1. **Layout:** Vertical split, single scroll, 3 зоны (Продажи, Финансы, Нейтральная)
2. **Разделитель:** Whitespace (desktop) + thin line (mobile)
3. **ZoneHeader:** Icon + title + axis badge + tooltip
4. **Карточки:** 4+4 (Заказы/COGS/Ads/Conversion + Buyouts/Deductions/Profit/Payout)
5. **Графики:** Sales zone gets SalesChart+DRR+Conversion. Finance zone gets ProfitChart(fullwidth)+Waterfall+Donut+TopProducts
6. **MarketplaceBreakdown:** Зона Финансы
7. **Stocks/Plan:** Нейтральная зона (вне осей)
8. **WB:** Одинаковый layout для всех МП
9. **Edge cases:** CrossAxisWarning для коротких периодов, settlement skeleton, tooltip пояснения
10. **Sidebar товаров:** Только в зоне "Продажи"
