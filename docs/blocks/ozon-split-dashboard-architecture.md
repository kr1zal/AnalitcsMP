# Split Dashboard: Продажи + Финансы — Архитектурный план

> **Дата:** 2026-02-21
> **Статус:** PLAN (не реализовано)
> **Автор:** System Architect + Claude
> **Проблема:** Ozon данные на двух осях дат (ORDER vs SETTLEMENT) — карточки смешивают оси, что даёт абсурдные числа

---

## 0. Суть проблемы

### Текущее поведение

Дашборд показывает 8 карточек в одном grid `grid-cols-2 lg:grid-cols-4`:

| Row 1 | Заказы | Выкупы | Себестоимость | Чистая прибыль |
|-------|--------|--------|---------------|----------------|
| Row 2 | Удержания МП | Реклама+ДРР | К перечислению | Рентабельность |

**Проблема:** Карточки смешивают две оси дат:
- **ORDER axis** (mp_sales, дата заказа): Заказы, Выкупы (revenue из mp_sales), Реклама
- **SETTLEMENT axis** (mp_costs / mp_costs_details, дата расчёта): Удержания, К перечислению (total_accrued из costs-tree)

Для WB это не проблема — расчёты происходят почти мгновенно, оси совпадают.
Для Ozon settlement может отставать на 1-3 недели. За 7 дней:
- ORDER axis: заказано 10 шт на 8 630 руб
- SETTLEMENT axis: рассчитано 40 шт (из предыдущих заказов), payout = 22 000 руб

**Результат:** profit = 22 000 - 4 080 (purchase за 10 order) - 500 (ad) = 17 420 — абсурд, маржа 200%.

### Текущие костыли (миграции 019 и 020)

**Миграция 019** (ОТКАЧЕНА миграцией 020): пыталась сделать purchase settlement-based в RPC.
**Миграция 020** (ТЕКУЩАЯ): откатила RPC на полностью order-based purchase.
- RPC `get_dashboard_summary`: `purchase = purchase_price * sales_count` из mp_sales (order-based для ВСЕХ МП)
- UE endpoint (Python): для Ozon `purchase = purchase_price * settled_qty` из mp_costs (settlement-based)

**Текущее смешение на фронте (DashboardPage.tsx):**
- `revenueForTile` (строки 343-387): берётся из costs-tree ("Продажи") = **settlement-based**
- `purchaseCostsForTile` (строка 319-321): из RPC `purchase_costs_total` = **order-based**
- `payoutForTile` (строки 323-333): из costs-tree `total_accrued` = **settlement-based**
- `netProfitForTile` = payoutForTile - purchaseCostsForTile - ad = **MIXED AXES**
- `ordersCountForTile`, `salesCountForTile`: из RPC = **order-based**
- `mpDeductionsForTile`: из costs-tree = **settlement-based**

**Вывод:** Даже сейчас оси смешаны. Purchase order-based, payout settlement-based. Прибыль некорректна для Ozon при коротких периодах.

---

## 1. Целевая архитектура: Две зоны

### Зона "Продажи" (ORDER-based, mp_sales)

Все метрики из одного источника — mp_sales по дате ЗАКАЗА. Консистентны между собой.

| # | Карточка | Источник | Формула |
|---|----------|----------|---------|
| 1 | **Заказы** | mp_sales.orders_count | SUM(orders_count) |
| 2 | **Конверсия (Выкуп%)** | mp_sales | sales_count / orders_count * 100% |
| 3 | **Реклама + ДРР** | mp_ad_costs + mp_sales.revenue | ДРР = ad / order_revenue * 100% |
| 4 | **Себестоимость** | mp_sales.sales_count * purchase_price | Order-based COGS |

### Зона "Финансы" (SETTLEMENT-based, costs-tree)

Все метрики из costs-tree (mp_costs_details) по дате РАСЧЁТА. Консистентны между собой.

| # | Карточка | Источник | Формула |
|---|----------|----------|---------|
| 5 | **Начислено** (выручка) | costs-tree "Продажи" + credits | settlement revenue |
| 6 | **Удержания МП** | costs-tree negative items | SUM(negative tree items) |
| 7 | **Прибыль** | costs-tree payout - settled_purchase - ad | settlement profit |
| 8 | **К перечислению** | costs-tree total_accrued | payout |

### Визуальный макет

```
┌──────────────────────────────────────────────────────────────┐
│  📦 Продажи (по дате заказа)                                │
│  ┌──────────┬──────────┬──────────┬──────────┐              │
│  │ Заказы   │Конверсия │ Реклама  │Себест-ть │              │
│  │ 847 шт   │ 81%      │ 2 340₽   │ 12 580₽  │              │
│  │ 145 320₽ │ 685 выкуп│ ДРР 1.6% │ ∅340/шт  │              │
│  └──────────┴──────────┴──────────┴──────────┘              │
├──────────────────────────────────────────────────────────────┤
│  💰 Финансы (по дате расчёта)                               │
│  ┌──────────┬──────────┬──────────┬──────────┐              │
│  │Начислено │Удержания │ Прибыль  │К перечисл│              │
│  │ 98 450₽  │ 34 200₽  │ 6 830₽   │ 64 250₽  │              │
│  │ +WB+Ozon │Ком+Лог+..│ маржа 7% │Ozon+WB   │              │
│  └──────────┴──────────┴──────────┴──────────┘              │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Затрагиваемые файлы

### Backend (Python)

| Файл | Что меняется |
|------|-------------|
| `backend/app/api/v1/dashboard.py` | Новый endpoint `/dashboard/finance-summary` или расширение costs-tree response |
| `backend/migrations/021_split_dashboard.sql` | Возможно: RPC для settled_purchase из mp_costs |

### Frontend (React/TS)

| Файл | Что меняется |
|------|-------------|
| `frontend/src/pages/DashboardPage.tsx` | Рефакторинг: две секции, новая логика расчётов |
| `frontend/src/components/Dashboard/SummaryCard.tsx` | Без изменений (универсальный компонент) |
| `frontend/src/components/Dashboard/DashboardZone.tsx` | **НОВЫЙ**: обёртка секции с заголовком и разделителем |
| `frontend/src/types/index.ts` | Новые типы для finance summary |
| `frontend/src/hooks/useDashboard.ts` | Новый hook `useFinanceSummary` (если отдельный endpoint) |
| `frontend/src/services/api.ts` | Новый метод API |

### Миграции

| Файл | Содержимое |
|------|-----------|
| `backend/migrations/021_split_dashboard.sql` | Опционально: RPC `get_finance_summary` |

---

## 3. Backend изменения

### 3.1. Что УЖЕ есть

**`mp_costs.settled_qty`** (миграция 019) — колонка существует, заполняется при sync_costs_ozon:
```python
# sync_service.py:1854-1862
if op_type == "OperationAgentDeliveredToCustomer":
    item_qty = int(item.get("quantity", 1) or 1)
    costs_agg[key]["settled_qty"] += item_qty
```

**UE endpoint** (dashboard.py:290-333) уже использует settled_qty:
```python
settled_qty_by_product[product_id] = settled_qty_by_product.get(product_id, 0) + qty
# ...
if is_ozon and has_ozon_settled and product_id in settled_qty_by_product:
    raw_purchase = purchase_price * settled_qty_by_product[product_id]
```

**Costs-tree RPC** (get_costs_tree) — возвращает `total_accrued`, `total_revenue`, `tree[]`.

### 3.2. Что нужно ДОБАВИТЬ

#### Вариант A: Расширить costs-tree response (РЕКОМЕНДУЕМЫЙ)

Добавить в ответ costs-tree endpoint:
```python
{
    "total_accrued": 64250,        # уже есть
    "total_revenue": 98450,        # уже есть (percent_base_sales)
    "tree": [...],                 # уже есть
    # === НОВЫЕ ПОЛЯ ===
    "settled_purchase": 42300,     # purchase_price * settled_qty из mp_costs
    "settled_sales_count": 124,    # SUM(settled_qty) из mp_costs
    "settled_profit": 6830,        # total_accrued - settled_purchase - ad_share
}
```

**Реализация в `_fetch_costs_tree_merged()` или в отдельной функции:**
```python
def _get_settled_purchase(supabase, date_from, date_to, marketplace, user_id, fulfillment_type):
    """Возвращает settlement-based purchase и qty для зоны Финансы."""
    query = (
        supabase.table("mp_costs")
        .select("product_id, settled_qty, mp_products(purchase_price)")
        .eq("user_id", user_id)
        .gte("date", date_from)
        .lte("date", date_to)
    )
    if marketplace and marketplace != "all":
        query = query.eq("marketplace", marketplace)
    if fulfillment_type:
        query = query.eq("fulfillment_type", fulfillment_type)
    result = query.execute()

    total_purchase = 0
    total_qty = 0
    for row in result.data:
        qty = int(row.get("settled_qty", 0) or 0)
        price = float(row.get("mp_products", {}).get("purchase_price", 0) or 0)
        total_purchase += price * qty
        total_qty += qty

    return total_purchase, total_qty
```

**Плюсы варианта A:**
- НЕ нужен новый endpoint (меньше HTTP запросов)
- Costs-tree уже загружается всегда (ozonCostsTreeData/wbCostsTreeData)
- Фронтенд просто читает новые поля из существующего ответа

**Минусы:**
- Costs-tree endpoint становится чуть тяжелее (+1 запрос к mp_costs)

#### Вариант B: Отдельный endpoint `/dashboard/finance-summary`

```python
@router.get("/dashboard/finance-summary")
async def get_finance_summary(
    current_user, date_from, date_to, marketplace, fulfillment_type
):
    """Возвращает все settlement-based метрики для зоны Финансы."""
    # costs-tree payout + settled purchase + ad → profit
```

**Минусы:** Дополнительный HTTP запрос. Дублирование логики costs-tree.

### 3.3. Нужна ли миграция?

**НЕТ**. Колонка `mp_costs.settled_qty` уже существует (миграция 019). Данные заполняются при каждом sync_costs_ozon. Backfill нужен только если есть Ozon-данные ДО 20.02.2026 без settled_qty.

**Проверка наличия данных:**
```sql
SELECT COUNT(*), SUM(settled_qty)
FROM mp_costs
WHERE marketplace = 'ozon' AND settled_qty > 0;
```

Если `COUNT = 0` для старых дат — нужен re-sync (`POST /sync/manual` или backfill скрипт). Но это **операционная задача**, не миграция.

### 3.4. Нужно ли менять RPC `get_dashboard_summary`?

**НЕТ для RPC.** Текущий RPC (миграция 020) корректен для зоны "Продажи" — все метрики order-based:
- `revenue` из mp_sales (order-based) -- OK для зоны Продажи
- `purchase_costs_total` = purchase_price * sales_count из mp_sales (order-based) -- OK
- `orders`, `sales`, `returns` из mp_sales -- OK

RPC используется как есть для зоны "Продажи". Зона "Финансы" берёт данные из costs-tree (+ settled_purchase).

---

## 4. Frontend изменения (файл за файлом)

### 4.1. Новый компонент: `DashboardZone.tsx`

```tsx
// frontend/src/components/Dashboard/DashboardZone.tsx
interface DashboardZoneProps {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  children: ReactNode;
}

export const DashboardZone = ({ title, subtitle, icon: Icon, children }: DashboardZoneProps) => (
  <div className="mb-4 sm:mb-5 lg:mb-6">
    {/* Zone header */}
    <div className="flex items-center gap-2 mb-2 sm:mb-3">
      <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gray-100">
        <Icon className="w-4 h-4 text-gray-500" />
      </div>
      <div>
        <h2 className="text-sm sm:text-base font-semibold text-gray-800">{title}</h2>
        <p className="text-[10px] sm:text-xs text-gray-400">{subtitle}</p>
      </div>
    </div>
    {/* Zone cards grid */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
      {children}
    </div>
  </div>
);
```

**Размер:** ~30 строк. Чисто презентационный, без логики.

### 4.2. DashboardPage.tsx — структура рендера

**Текущий рендер (строки 576-779):** один `<div className="grid grid-cols-2 lg:grid-cols-4">` с 8 карточками.

**Новый рендер:**

```tsx
{/* ═══ Зона 1: Продажи (ORDER-based) ═══ */}
<DashboardZone
  title="Продажи"
  subtitle="по дате заказа"
  icon={ShoppingBag}
>
  {/* 1. Заказы (как сейчас) */}
  <SummaryCard title="Заказы" value={ordersCountForTile} ... />

  {/* 2. Конверсия / Выкуп% (НОВАЯ — вместо "Выкупы") */}
  <SummaryCard
    title="Конверсия"
    mobileTitle="Выкуп%"
    value={`${buyoutPercent}%`}
    secondaryValue={`${salesCountForTile} из ${ordersCountForTile}`}
    ...
  />

  {/* 3. Реклама + ДРР (перенесена из Row 2) */}
  <SummaryCard title="Реклама" value={adCostForTile} ... />

  {/* 4. Себестоимость (order-based COGS) */}
  <SummaryCard title="Себестоимость" value={purchaseCostsForTile} ... />
</DashboardZone>

{/* ═══ Зона 2: Финансы (SETTLEMENT-based) ═══ */}
<DashboardZone
  title="Финансы"
  subtitle="по дате расчёта МП"
  icon={Banknote}
>
  {/* 5. Начислено (settlement revenue = costs-tree "Продажи" + credits) */}
  <SummaryCard
    title="Начислено"
    mobileTitle="Выручка"
    value={revenueForTile}    // уже settlement-based из costs-tree
    format="currency"
    ...
  />

  {/* 6. Удержания МП (settlement, как сейчас) */}
  <SummaryCard title="Удержания" value={mpDeductionsForTile} ... />

  {/* 7. Прибыль (settlement-based: payout - settled_purchase - ad) */}
  <SummaryCard
    title="Прибыль"
    value={settlementProfitForTile}    // НОВЫЙ расчёт
    ...
  />

  {/* 8. К перечислению (settlement, как сейчас) */}
  <SummaryCard title="К перечислению" value={payoutForTile} ... />
</DashboardZone>
```

### 4.3. Новые переменные расчёта в DashboardPage

```tsx
// ═══ Зона Финансы: settlement-based profit ═══
// settled_purchase из costs-tree response (новое поле)
const settledPurchaseForTile = (() => {
  if (marketplace === 'ozon') return ozonCostsTreeData?.settled_purchase ?? 0;
  if (marketplace === 'wb') return wbCostsTreeData?.settled_purchase ?? 0;
  if (marketplace === 'all') {
    return (ozonCostsTreeData?.settled_purchase ?? 0) + (wbCostsTreeData?.settled_purchase ?? 0);
  }
  return 0;
})();

// Settlement-based profit: payout - settled_purchase - ad
const settlementProfitForTile = (() => {
  if (payoutForTile === null) return 0;
  return payoutForTile - settledPurchaseForTile - adCostForTile;
})();
```

### 4.4. Карточки: что меняется

| # | Карточка | Было | Стало | Зона | Props изменения |
|---|----------|------|-------|------|-----------------|
| 1 | Заказы | Row1 #1 | Продажи #1 | Продажи | Без изменений |
| 2 | Выкупы | Row1 #2 (revenue) | **Конверсия** (buyout%) | Продажи | `value` меняется на `buyoutPercent%`, `secondaryValue` = "685 из 847" |
| 3 | Реклама | Row2 #2 | Продажи #3 | Продажи | Перемещена, `drrForTile` считается от orderRevenue (не settlement) |
| 4 | Себестоимость | Row1 #3 | Продажи #4 | Продажи | Без изменений (уже order-based) |
| 5 | **Начислено** | НЕ БЫЛО | Финансы #1 | Финансы | Новая, `value=revenueForTile` (settlement) |
| 6 | Удержания | Row2 #1 | Финансы #2 | Финансы | Перемещена, без изменений |
| 7 | Прибыль | Row1 #4 (mixed) | Финансы #3 | Финансы | `value=settlementProfitForTile` (pure settlement) |
| 8 | К перечислению | Row2 #3 | Финансы #4 | Финансы | Без изменений |
| ~~9~~ | ~~Рентабельность~~ | Row2 #4 | **УДАЛЕНА** | — | Маржа вынесена в secondaryValue карточки Прибыль |

### 4.5. SummaryCard.tsx — изменения

**Компонент НЕ МЕНЯЕТСЯ.** Он уже универсальный, принимает любые value/format/accent. Все изменения — на стороне DashboardPage (какие props передаём).

### 4.6. Типы (types/index.ts)

Расширить `CostsTreeResponse`:
```tsx
export interface CostsTreeResponse {
  // ... существующие поля ...
  /** Settlement-based purchase (purchase_price * settled_qty). Новое поле для Split Dashboard. */
  settled_purchase?: number;
  /** Settlement-based qty (SUM settled_qty). Новое поле. */
  settled_sales_count?: number;
}
```

---

## 5. Графики: какая зона

### 5.1. SalesChart (Заказы/Выкупы по дням)

**Зона: Продажи.** Данные из mp_sales (order-based). Не меняется.

### 5.2. ProfitChart (Выручка + Прибыль)

**Зона: Финансы.** Сейчас использует `profitMargin = netProfitForTile / revenueForTile` — после фикса оба будут settlement-based. Логически корректно.

**Альтернатива:** ProfitChart показывает daily estimate. Daily данные из mp_sales (order-based). Для точности нужны daily settlement данные из mp_costs_details, которых в текущем API нет. **Решение:** оставить как estimate, добавить пометку "оценка" в tooltip.

### 5.3. DrrChart (ДРР по дням)

**Зона: Продажи.** ДРР = ad_cost / revenue. Revenue из mp_sales. Не меняется.

### 5.4. ConversionChart (Конверсия по дням)

**Зона: Продажи.** sales/orders из mp_sales. Не меняется.

### 5.5. ProfitWaterfall

**Зона: Финансы.** Структура прибыли. Все компоненты settlement-based:
```
revenue (settlement) → -mpDeductions (settlement) → -settled_purchase → -ads = profit
```

**Изменение:** `purchase` prop меняется на `settledPurchaseForTile`.

### 5.6. CostsDonutChart

**Зона: Финансы.** Уже использует costs-tree (settlement). Не меняется.

### 5.7. TopProductsChart

**Зона: Финансы.** Данные из UE (uses settlement-based purchase для Ozon). Не меняется.

### 5.8. StockForecastChart

**Зона: Нейтральная (вне зон).** Остатки — текущее состояние, не привязаны к осям.

### Итоговый layout

```
FilterPanel (sticky)

═══ Продажи (по дате заказа) ═══
[Заказы] [Конверсия] [Реклама+ДРР] [Себестоимость]

═══ Финансы (по дате расчёта) ═══
[Начислено] [Удержания] [Прибыль] [К перечислению]

PlanCompletionCard
MarketplaceBreakdown (OZON / WB)

── Графики: Продажи ──
sidebar + [SalesChart | DrrChart | ConversionChart]

── Графики: Финансы ──
[ProfitChart] (или объединить все 4 как сейчас)

── Аналитика ──
[ProfitWaterfall | CostsDonut | TopProducts | StockForecast]

StockHistoryChart
StocksTable
```

**УПРОЩЁННЫЙ вариант (рекомендуемый):** графики оставить как есть (2x2 grid), не разделять по зонам — слишком сильное визуальное усложнение. Достаточно разделить карточки.

---

## 6. Поведение при marketplace=WB

У WB нет cross-axis проблемы (settlement = order date, расчёты мгновенные).

**Вопрос:** Зоны остаются или объединяются?

### Рекомендация: ЗОНЫ ОСТАЮТСЯ ВСЕГДА

Причины:
1. **Консистентный UX** — пользователь привыкает к одному layout независимо от фильтра МП
2. **Будущие МП** — при добавлении Яндекс.Маркет или СберМегаМаркет снова будет лаг
3. **Разные бизнес-вопросы** — "сколько заказали?" vs "сколько заработали?" — разные задачи
4. **Для WB числа просто СОВПАДУТ** (или будут близки) — это не баг, а валидация

**Пометка:** Добавить tooltip при mp=wb: "Для WB данные совпадают с зоной Продажи".

---

## 7. Поведение при marketplace=all

Обе зоны показывают агрегат Ozon + WB:

**Зона Продажи:**
- `ordersCountForTile` = SUM(mp_sales.orders) across both MPs — **OK, одна ось**
- `purchaseCostsForTile` = из RPC, order-based — **OK**
- `adCostForTile` = из RPC, account-level — **OK**

**Зона Финансы:**
- `revenueForTile` = ozon_costs_tree_sales + wb_costs_tree_sales + credits — **OK, обе settlement**
- `mpDeductionsForTile` = ozon_deductions + wb_deductions — **OK**
- `settledPurchaseForTile` = ozon_settled_purchase + wb_settled_purchase — **OK**
  - Для WB `settled_purchase` = order-based (settled_qty = 0, fallback на sales_count) — корректно, т.к. WB оси совпадают
- `payoutForTile` = ozon_total_accrued + wb_total_accrued — **OK**

**Ключевой момент:** WB settled_qty в mp_costs = 0 (не заполняется, т.к. WB sync не считает settled_qty). Backend должен fallback на order-based purchase для WB.

### Backend fallback логика для settled_purchase:

```python
def _get_settled_purchase(supabase, date_from, date_to, marketplace, user_id, fulfillment_type):
    """
    Для Ozon: settlement-based (purchase_price * settled_qty из mp_costs)
    Для WB: order-based fallback (purchase_price * sales_count из mp_sales)
    """
    # Ozon: settled_qty из mp_costs
    ozon_purchase = 0
    if marketplace in (None, 'all', 'ozon'):
        ozon_costs = supabase.table("mp_costs") \
            .select("product_id, settled_qty, mp_products(purchase_price)") \
            .eq("user_id", user_id).eq("marketplace", "ozon") \
            .gte("date", date_from).lte("date", date_to)
        if fulfillment_type:
            ozon_costs = ozon_costs.eq("fulfillment_type", fulfillment_type)
        for row in ozon_costs.execute().data:
            qty = int(row.get("settled_qty", 0) or 0)
            price = float(row.get("mp_products", {}).get("purchase_price", 0) or 0)
            ozon_purchase += price * qty

    # WB: order-based из mp_sales (settled_qty не заполняется для WB)
    wb_purchase = 0
    if marketplace in (None, 'all', 'wb'):
        wb_sales = supabase.table("mp_sales") \
            .select("product_id, sales_count, mp_products(purchase_price)") \
            .eq("user_id", user_id).eq("marketplace", "wb") \
            .gte("date", date_from).lte("date", date_to)
        if fulfillment_type:
            wb_sales = wb_sales.eq("fulfillment_type", fulfillment_type)
        for row in wb_sales.execute().data:
            qty = int(row.get("sales_count", 0) or 0)
            price = float(row.get("mp_products", {}).get("purchase_price", 0) or 0)
            wb_purchase += price * qty

    return ozon_purchase + wb_purchase
```

---

## 8. Проверка данных: settled_qty

### Текущее состояние

`settled_qty` заполняется в `sync_service.py:1854-1862` при sync_costs_ozon:
```python
if op_type == "OperationAgentDeliveredToCustomer":
    item_qty = int(item.get("quantity", 1) or 1)
    costs_agg[key]["settled_qty"] += item_qty
```

**Вопрос:** Данные заполнены для нужных дат?

**Проверить SQL:**
```sql
-- Наличие settled_qty данных
SELECT
    marketplace,
    MIN(date) as min_date,
    MAX(date) as max_date,
    COUNT(*) as rows,
    SUM(settled_qty) as total_settled_qty,
    SUM(CASE WHEN settled_qty > 0 THEN 1 ELSE 0 END) as rows_with_qty
FROM mp_costs
WHERE user_id = 'e2db2023-4ce3-4182-96d3-7a194657cb4a'
GROUP BY marketplace;
```

Если `rows_with_qty = 0` для ozon — нужен re-sync Ozon costs.

### Backfill

**Автоматический:** при следующем `POST /sync/manual` с Ozon costs — settled_qty заполнится для всех дат в окне API Ozon (обычно 6 месяцев).

**Ручной:** не нужен, sync_costs_ozon покрывает полный диапазон.

---

## 9. Порядок реализации (фазы)

### Фаза 1: Backend — расширение costs-tree (1-2 часа)

1. Добавить `_get_settled_purchase()` в `dashboard.py`
2. Расширить `/dashboard/costs-tree` endpoint — добавить `settled_purchase` и `settled_sales_count` в ответ
3. Убедиться что fallback для WB (order-based) работает
4. Обновить `_fetch_costs_tree_merged()` — merge settled_purchase из FBO+FBS
5. Тест: `curl /dashboard/costs-tree?marketplace=ozon&date_from=...` — проверить новые поля

### Фаза 2: Frontend — типы и компонент DashboardZone (30 мин)

1. Расширить `CostsTreeResponse` в `types/index.ts`
2. Создать `DashboardZone.tsx` (~30 строк)
3. Убедиться что `npm run build` проходит

### Фаза 3: Frontend — рефакторинг DashboardPage (2-3 часа)

1. Добавить расчёт `settledPurchaseForTile` и `settlementProfitForTile`
2. Заменить один grid 8 карточек на две DashboardZone по 4 карточки
3. Перераспределить карточки по зонам (см. таблицу в 4.4)
4. Заменить карточку "Выкупы" на "Конверсия" (в зоне Продажи)
5. Добавить карточку "Начислено" (в зоне Финансы)
6. Убрать карточку "Рентабельность" (маржа → secondaryValue Прибыли)
7. Обновить ProfitWaterfall props: `purchase={settledPurchaseForTile}`
8. `npm run build` — проверить компиляцию

### Фаза 4: Тестирование и деплой (1 час)

1. Проверить SQL: settled_qty заполнен для текущего пользователя
2. Если нет — запустить re-sync Ozon costs
3. Проверить все карточки при marketplace=ozon, wb, all
4. Проверить mobile layout (375px)
5. Проверить что при коротких периодах (7д) прибыль адекватна
6. Деплой

**Итого: ~5-6 часов разработки.**

---

## 10. Риски и edge cases

### 10.1. settled_qty = 0 для всех дат

**Когда:** Первый sync Ozon costs был до миграции 019 (до 21.02.2026), и re-sync не запускался.
**Решение:** Backend fallback — если SUM(settled_qty) = 0, использовать order-based purchase (как сейчас).
**UX:** Показать warning badge на карточке Прибыль: "Данные расчётов ещё не загружены. Запустите синхронизацию."

### 10.2. Пустой costs-tree (нет mp_costs_details)

**Когда:** Новый пользователь, первый sync ещё не прошёл.
**Решение:** Зона Финансы показывает skeleton (loading). Или fallback: показать order-based данные с пометкой "ожидание данных от МП".

### 10.3. WB settled_qty не заполняется

**Факт:** `sync_service.py` НЕ считает settled_qty для WB (только Ozon).
**Решение:** Backend использует order-based purchase для WB в `_get_settled_purchase()`. Это корректно, т.к. у WB оси совпадают.

### 10.4. Конверсия 0% при 0 заказов

**Решение:** SummaryCard уже обрабатывает — показывает "0%". Tooltip поясняет "Нет заказов за период".

### 10.5. Отрицательный settlement profit

**Когда:** За короткий период settled_purchase > payout (рассчитано больше товаров, чем начислено).
**Решение:** Карточка меняет accent на "red", показывает отрицательное значение. Tooltip: "За этот период удержания и себестоимость превысили начисления МП."

### 10.6. ДРР в зоне Продажи — от какой revenue?

**Текущий ДРР:** ad / revenueForTile (settlement-based). **Это ошибка в текущем коде!**
**Фикс:** В зоне Продажи ДРР = ad / ordersRevenueForTile (order-based):
```tsx
const drrSalesZone = ordersRevenueForTile > 0
  ? Math.round((adCostForTile / ordersRevenueForTile) * 1000) / 10
  : 0;
```

### 10.7. Excel/PDF export

Export сейчас использует `summary`, `ozonCostsTree`, `wbCostsTree`, `unitEconomics`, `stocks`.
**Изменение:** Добавить в export обе зоны. ExcelExportData расширить:
```tsx
interface ExcelExportData {
  // ... существующие поля ...
  salesZone: { orders, conversion, ad, purchase };
  financeZone: { revenue, deductions, profit, payout };
}
```

### 10.8. PlanCompletionCard — от какой выручки?

`PlanCompletionCard` использует actual из `mp_sales` (order-based). План продаж = "сколько продать" = order axis. **Корректно для зоны Продажи.** Визуально: PlanCompletionCard размещается МЕЖДУ зонами или после зоны Продажи.

### 10.9. Period comparison (ChangeBadge)

Сейчас `ordersChangePct` и `revenueChangePct` вычисляются из `previous_period`.
- Зона Продажи: ordersChangePct → OK (order-based).
- Зона Финансы: `revenueChangePct` сейчас из RPC previous_period — нужно пересчитать из costs-tree prev (уже делается в `get_dashboard_summary_with_prev` через `adjusted_revenue`).

---

## 11. Архитектурные правила (новые, для CLAUDE.md)

```
45. **Split Dashboard:** Две зоны — "Продажи" (ORDER-based, mp_sales) и "Финансы" (SETTLEMENT-based, costs-tree).
    Внутри каждой зоны ВСЕ метрики на одной оси дат. НИКОГДА не смешивать order revenue с settlement purchase.
    Зоны ВСЕГДА видны (даже при mp=wb, где оси совпадают).
    DashboardZone компонент: заголовок + subtitle + grid-cols-2 lg:grid-cols-4.

46. **settled_purchase:** Backend поле в costs-tree response. Ozon: purchase_price * settled_qty из mp_costs.
    WB: fallback на purchase_price * sales_count из mp_sales (оси совпадают).
    Используется ТОЛЬКО в зоне Финансы. Зона Продажи использует purchase из RPC (order-based).
```

---

## 12. Контрольные точки верификации

После реализации проверить:

| # | Проверка | Ожидание |
|---|----------|----------|
| 1 | mp=ozon, 7d: Заказы vs Начислено | Могут сильно отличаться (разные оси) |
| 2 | mp=ozon, 7d: Прибыль (settlement) | payout - settled_purchase - ad. Не должно быть profit > revenue |
| 3 | mp=wb, 7d: Заказы vs Начислено | Должны быть близки (оси совпадают) |
| 4 | mp=all, 30d: Прибыль | settlement profit, адекватная маржа (5-25%) |
| 5 | mp=ozon, 7d: settled_purchase | > 0 (если sync прошёл) |
| 6 | mp=wb, 7d: settled_purchase | = order-based purchase (fallback) |
| 7 | Карточки Продажи: все order-based | Заказы, Конверсия, Реклама, COGS — все из mp_sales |
| 8 | Карточки Финансы: все settlement | Начислено, Удержания, Прибыль, Выплата — все из costs-tree |
| 9 | ProfitWaterfall: uses settled purchase | Каскад: Начислено → -Удерж → -SettledPurchase → -Ad = Profit |
| 10 | Mobile 375px: обе зоны | 2 колонки, заголовки видны |

---

## 13. Что НЕ меняется

- `SummaryCard.tsx` — без изменений (универсальный)
- `MarketplaceBreakdown` — без изменений (уже settlement-based)
- `StocksTable`, `StockForecastChart`, `StockHistoryChart` — без изменений (не привязаны к осям)
- RPC `get_dashboard_summary` — без изменений (используется для зоны Продажи)
- RPC `get_costs_tree` — без изменений (response расширяется в Python endpoint, не в RPC)
- `useDashboard.ts` hooks — без изменений (новые поля приходят в существующих ответах)
- Sync pipeline — без изменений (settled_qty уже заполняется)
- Миграции — НЕ нужны (settled_qty уже есть)
