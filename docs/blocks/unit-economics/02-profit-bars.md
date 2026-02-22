# Unit-экономика: Profit Bars и Cost Structure

> Горизонтальные бары прибыли с ABC-классификацией и стековый бар структуры затрат

**Правила CLAUDE.md:** #18

## Визуальная структура

```
+-----------------------------------------------------------+
| Прибыль по товарам                                        |
|                                                           |
| [A] Товар-1     ████████████████████  +12 500 ₽  22.1%   |
| [A] Товар-2     ██████████████        +8 200 ₽   19.3%   |
| [B] Товар-3     ██████████            +5 100 ₽   15.7%   |
| [B] Товар-4     ████████              +3 800 ₽   12.4%   |
| [C] Товар-5     █████                 +2 100 ₽   10.2%   |
|                                                           |
|            ещё 2 товаров: +1 200 ₽                        |
|                                                           |
| [C] Товар-7     ██                    −450 ₽     −3.1%   |
| [C] Товар-8     █████                 −1 200 ₽   −8.5%   |
| [C] Товар-9     ████████              −2 800 ₽   −14.2%  |
+-----------------------------------------------------------+
| Структура затрат                                          |
| ███████████████████████████████████████████████████████    |
| [amber]Закупка [purple]Удержания [blue?]Реклама [green]Приб|
|                                                           |
| ● Закуп. 35.2% (18 500₽)  ● Удерж. 28.1% (14 800₽)     |
| ● Рекл.  8.3% (4 370₽)   ● Приб.  28.4% (14 950₽)      |
+-----------------------------------------------------------+
```

## Файлы

| Компонент | Путь | Строк | Props |
|-----------|------|-------|-------|
| UeProfitBars | `frontend/src/components/UnitEconomics/UeProfitBars.tsx` | 114 | `{ products: UnitEconomicsItem[], abcMap: Map<string, AbcGrade> }` |
| UeCostStructure | `frontend/src/components/UnitEconomics/UeCostStructure.tsx` | 66 | `{ totals: UeTotals, hasAds: boolean }` |
| ueHelpers | `frontend/src/components/UnitEconomics/ueHelpers.ts` | 223 | ABC-классификация, margin/color утилиты, computeTotals |

## Data Flow

```
UnitEconomicsPage
  ├─ useMemo: computeTotals(unitProducts)  → totals: UeTotals
  ├─ useMemo: classifyABC(unitProducts)     → abcMap: Map<string, AbcGrade>
  │
  ├─ UeProfitBars(products={unitProducts}, abcMap={abcMap})
  │     └─ useMemo: sort by profit desc → top/bottom/rest
  │
  └─ UeCostStructure(totals={totals}, hasAds={hasAds})
        └─ вычисление % каждого сегмента от revenue
```

## ABC-классификация

**Файл:** `ueHelpers.ts`, функция `classifyABC()` (строки 91-117)

**Алгоритм (кумулятивный Парето):**
1. Отфильтровать прибыльные товары (`net_profit > 0`)
2. Отсортировать по `net_profit` desc
3. Вычислить `totalProfit` = сумма прибыли прибыльных товаров
4. Накопительная сумма: для каждого товара `cumulative += profit`
5. Процент: `pct = cumulative / totalProfit * 100`
6. Классификация:
   - **A** — `pct <= 80%` (80% прибыли)
   - **B** — `80% < pct <= 95%`
   - **C** — `pct > 95%`
7. Убыточные товары (`net_profit <= 0`) — всегда **C**
8. Если `totalProfit <= 0` — все товары получают **C**

**Стили бейджей** (`ABC_STYLES`, строки 119-123):

| Грейд | Стиль |
|-------|-------|
| A | `bg-emerald-100 text-emerald-700 border-emerald-300` |
| B | `bg-amber-100 text-amber-700 border-amber-300` |
| C | `bg-gray-100 text-gray-500 border-gray-300` |

Бейдж: круг `w-5 h-5` с буквой грейда внутри.

## UeProfitBars

**Файл:** `UeProfitBars.tsx` (114 строк)

### Разделение TOP/BOTTOM

Константы (ueHelpers.ts, строки 28-30):
- `TOP_COUNT = 5` — верхние (лучшие) товары
- `BOTTOM_COUNT = 3` — нижние (худшие) товары

Логика `useMemo` (строки 69-80):
1. Сортировка по `net_profit` desc
2. Если товаров <= `TOP_COUNT + BOTTOM_COUNT` (8): все показываются как `top`, `bottom` пуст
3. Иначе:
   - `top` = первые 5
   - `bottom` = последние 3 (реверс: самый худший внизу)
   - `restProfit` = суммарная прибыль средних товаров
   - `restCount` = количество средних товаров

### Бар прибыли (ProfitBar)

Каждый бар содержит (строки 27-66):

```
[A]  Название товара    ████████████  +12 500 ₽  22.1%
 │         │                  │            │        │
 ABC     truncate         bar width      profit   margin
badge   w-20/w-36        % от maxVal    value    (desktop)
```

- **Ширина бара:** `Math.max(2, Math.abs(profit) / maxBarProfit * 100)%` — минимум 2%
- **Цвет бара:** `bg-emerald-400` (прибыль) / `bg-red-400` (убыток)
- **maxBarProfit:** максимальный `|profit|` среди top + bottom товаров
- **Маржа:** скрыта на мобильных (`hidden sm:inline`)

### Разделитель

Между top и bottom блоками (строки 101-104):
```
ещё N товаров: X ₽
```
Показывает суммарную прибыль средних товаров, которые не вошли в top/bottom.

### Цветовая кодировка маржи

Функции из `ueHelpers.ts` (строки 65-75):

| Маржа | Текст | Фон |
|-------|-------|-----|
| >= 20% | `text-emerald-700` | `bg-emerald-50` |
| >= 10% | `text-amber-700` | `bg-amber-50` |
| < 10% | `text-red-700` | `bg-red-50` |

## UeCostStructure

**Файл:** `UeCostStructure.tsx` (66 строк)

### Сегменты стекового бара

Вычисление процентов (строки 15-19):

```
purchasePct = purchase / revenue * 100
adsPct = hasAds ? adCost / revenue * 100 : 0
profitPct = profit / revenue * 100
mpCostsPct = 100 - purchasePct - adsPct - profitPct   -- остаток = удержания
```

Гарантия: `purchasePct + mpCostsPct + adsPct + |profitPct| ≈ 100%`

### Порядок сегментов

| # | Сегмент | Цвет бара | Цвет точки | Условие |
|---|---------|-----------|------------|---------|
| 1 | Закупка | `bg-amber-400` | `bg-amber-400` | всегда |
| 2 | Удержания МП | `bg-purple-400` | `bg-purple-400` | всегда |
| 3 | Реклама | `bg-blue-400` | `bg-blue-400` | `hasAds` |
| 4 | Прибыль | `bg-emerald-400` / `bg-red-400` | аналогично | всегда (зелёный если profit>=0, красный если убыток) |

### Стековый бар

- Высота: `h-3 sm:h-4`, скруглённые углы `rounded-full`
- Фон: `bg-gray-100`
- Нулевые сегменты (`pct <= 0`) не рендерятся
- Зазор `gap-0.5` между сегментами

### Легенда

Сетка `grid-cols-2 sm:flex sm:flex-wrap`:
- Мобильные: краткие подписи (`Закуп.`, `Удерж.`, `Рекл.`, `Приб.`)
- Десктоп: полные подписи (`Закупка`, `Удержания МП`, `Реклама`, `Прибыль`)
- Значения: процент (`formatPercent`) + абсолют (`formatCurrency`, desktop only)

### Early return

Если `totals.revenue <= 0` — компонент не рендерится (`return null`).

## Формулы

```
-- ABC-классификация
cumulative_pct = Σprofit(sorted_desc) / total_profit * 100
grade = A (<=80%) | B (<=95%) | C (>95%) | C (убыточный)

-- Profit bar width
bar_width = max(2%, |profit_i| / max(|profit|) * 100%)

-- Margin
margin_i = net_profit_i / revenue_i * 100

-- Cost structure segments
purchase_pct   = purchase / revenue * 100
mp_costs_pct   = 100 - purchase_pct - ads_pct - profit_pct
ads_pct        = ad_cost / revenue * 100
profit_pct     = profit / revenue * 100
```

Ссылка: CLAUDE.md секция "Формулы"

## Вычисления на фронтенде

### UeTotals (ueHelpers.ts, строки 201-223)

Интерфейс `UeTotals`:
```ts
{
  revenue: number;   // Σ displayed_revenue
  purchase: number;  // Σ purchase_costs
  mpCosts: number;   // Σ mp_costs
  adCost: number;    // Σ ad_cost
  profit: number;    // Σ net_profit
  sales: number;     // Σ sales_count
  returns: number;   // Σ returns_count
}
```

Функция `computeTotals()` (строка 211): простая итерация по массиву `products`, суммирование всех метрик.

### getMargin (ueHelpers.ts, строки 54-58)

```ts
getMargin(item) = revenue > 0 ? (net_profit / revenue) * 100 : 0
```

## Состояние и кэширование

- **Zustand:** не используется напрямую (данные из props)
- **React Query:** данные приходят через `UnitEconomicsPage` (см. 01-overview.md)
- **useMemo в UeProfitBars:** пересчёт top/bottom при изменении `products`

## Edge Cases

1. **Нет товаров** — `UeProfitBars` и `UeCostStructure` возвращают `null`
2. **Все товары убыточные** — ABC: все получают `C`, bars все красные
3. **Мало товаров** (<=8) — нет разделителя "ещё N", все показываются как top
4. **Нет рекламы** (`hasAds=false`) — сегмент "Реклама" не показывается в UeCostStructure, ROAS не показывается в KPI
5. **Нулевая выручка** — CostStructure не рендерится, маржа = 0%
6. **Один товар** — один бар в top, bottom пуст

## Зависимости

- **Зависит от:** UnitEconomicsPage (данные через props), ueHelpers (ABC, margin, totals)
- **Используется в:** UnitEconomicsPage (секции "TOP/BOTTOM Bars" и "Cost Structure")
- **Feature gate:** нет (наследуется от страницы `unit_economics`)

## Smart Alerts

Функция `getAlerts()` из `ueHelpers.ts` (строки 127-157) используется в таблице (см. 03-table.md), но связана с ABC-классификацией:

| Алерт | Условие | Иконка | Цвет |
|-------|---------|--------|------|
| loss | `net_profit < 0` | AlertTriangle | `text-red-500` |
| margin_low | `profit > 0 && margin < 5%` | TrendingDown | `text-amber-500` |
| drr_high | `drr > 30%` | Megaphone | `text-orange-500` |

Tooltip содержит конкретные цифры: "Убыток 1 200 ₽", "Маржа 3.2% — ниже 5%", "ДРР 35.1% — выше 30%".
