# Карточки метрик (SummaryCard grid 4x2)

> 8 карточек в сетке 2x4 (`grid-cols-2 lg:grid-cols-4`) -- воронка продаж (row 1) и финансы (row 2)

**Правила CLAUDE.md:** #10, #19, #28, #36, #43

## Визуальная структура

```
┌──────────────────────────────────────────────────────────────────┐
│ Row 1: Воронка продаж                                            │
│ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌─────────┐│
│ │ [ShoppingBag]  │ │ [ShoppingCart]│ │ [Package]     │ │ [$]     ││
│ │ Заказы         │ │ Выкупы        │ │ Себестоимость │ │ Прибыль ││
│ │                │ │               │ │               │ │         ││
│ │ 1 234          │ │ 95 200 ₽      │ │ 42 000 ₽      │ │ 18 500₽ ││
│ │ 892 400 ₽      │ │ 980 шт · 81%  │ │ ∅ 43₽/шт      │ │ маржа 19││
│ │ 12 возвр.      │ │ Ozon 40k·WB55k│ │               │ │         ││
│ │            +5% │ │          +12% │ │               │ │         ││
│ └───────────────┘ └───────────────┘ └───────────────┘ └─────────┘│
│                                                                  │
│ Row 2: Финансы                                                   │
│ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌─────────┐│
│ │ [Receipt]      │ │ [Megaphone]  │ │ [Banknote]    │ │ [Trend] ││
│ │ Удержания МП   │ │ Реклама      │ │ К перечислению│ │ Δ / Рент││
│ │                │ │               │ │               │ │         ││
│ │ 28 300 ₽       │ │ 6 400 ₽       │ │ 66 900 ₽      │ │ +12.5%  ││
│ │ Комис 4200·..  │ │ ДРР 6.7%     │ │ Ozon 30k·WB37k│ │ было 84k││
│ └───────────────┘ └───────────────┘ └───────────────┘ └─────────┘│
└──────────────────────────────────────────────────────────────────┘
```

Mobile: `grid-cols-2`, desktop (lg+): `grid-cols-4`. Строка `576` в DashboardPage.tsx.

## Файлы

| Компонент | Путь | Props / назначение |
|-----------|------|--------------------|
| DashboardPage | `frontend/src/pages/DashboardPage.tsx` | Оркестратор -- вычисляет все значения карточек |
| SummaryCard | `frontend/src/components/Dashboard/SummaryCard.tsx` | Универсальная карточка |
| CurrencyValue | внутри SummaryCard.tsx (строка 84) | Рубли крупно, копейки мелко, автоsize |
| ChangeBadge | внутри SummaryCard.tsx (строка 108) | +N% / -N% badge с TrendingUp/Down |
| CardTooltip | внутри SummaryCard.tsx (строка 122) | Desktop: hover, Mobile: tap (Portal) |
| useDashboardSummaryWithPrev | `frontend/src/hooks/useDashboard.ts:29` | RPC summary + prev period |
| useCostsTree | `frontend/src/hooks/useDashboard.ts:122` | Дерево удержаний (per-MP) |
| useUnitEconomics | `frontend/src/hooks/useDashboard.ts:45` | UE per-product (purchase fallback) |
| get_dashboard_summary | `backend/migrations/020_fix_rpc_purchase_axis.sql` | PostgreSQL RPC |
| dashboard.py | `backend/app/api/v1/dashboard.py:139` | `/dashboard/summary` endpoint |

### SummaryCardProps (интерфейс, строка 46 SummaryCard.tsx)

```ts
interface SummaryCardProps {
  title: string;
  mobileTitle?: string;           // короткое имя для мобильных
  value: number | string;
  format?: 'currency' | 'number' | 'percent';
  secondaryValue?: string;        // под основным значением
  subtitle?: string;              // мелкий текст внизу
  tooltip?: string;               // (?) подсказка
  tooltipAlign?: 'left' | 'right';
  icon?: LucideIcon;
  accent?: CardAccent;            // indigo|emerald|amber|red|sky|violet|slate
  change?: number;                // ChangeBadge: % к предыдущему периоду
  isPositive?: boolean;
  loading?: boolean;
  warning?: string;               // amber badge
  children?: ReactNode;
}
```

## Data Flow

### Карточка 1: Заказы (строки 581-599)

```
SummaryCard (value={ordersCountForTile}, format="number")
  └─ ordersCountForTile = summary?.orders ?? 0                    (строка 485)
  └─ ordersRevenueForTile = summary?.revenue ?? 0                 (строка 486)
  └─ returnsCountForTile = summary?.returns ?? 0                  (строка 441)
       └─ useDashboardSummaryWithPrev(filters)                    (строка 162)
            queryKey: ['dashboard', 'summary-with-prev', filters]
            staleTime: 5min, refetchInterval: 5min
            └─ dashboardApi.getSummaryWithPrev(filters)
                 └─ GET /api/v1/dashboard/summary
                      params: date_from, date_to, marketplace, fulfillment_type,
                              include_prev_period=true
                      └─ RPC: get_dashboard_summary_with_prev(...)
                           └─ внутри вызывает get_dashboard_summary(...)
                                └─ Таблицы: mp_sales (orders_count, sales_count,
                                            returns_count, revenue)
```

**Источник:** `mp_sales` -- все заказы за период, включая непроведённые.

### Карточка 2: Выкупы (строки 602-626)

```
SummaryCard (value={revenueForTile}, format="currency")
  └─ revenueForTile = getSalesTotalFromCostsTree(...)            (строки 343-387)
       = tree["Продажи"].amount + Σ(positive items кроме "Продажи")
       └─ useCostsTree({ ...filters, marketplace: 'ozon' })      (строки 174-176)
       └─ useCostsTree({ ...filters, marketplace: 'wb' })        (строки 177-179)
            queryKey: ['dashboard', 'costs-tree', { ...filters, marketplace }]
            staleTime: 5min, refetchInterval: 5min
            └─ dashboardApi.getCostsTree(params)
                 └─ GET /api/v1/dashboard/costs-tree
                      params: date_from, date_to, marketplace, include_children,
                              fulfillment_type
                      └─ _fetch_costs_tree_merged() (строка 94, dashboard.py)
                           └─ RPC: get_costs_tree(p_date_from, ..., p_fulfillment_type)
                                └─ Таблицы: mp_costs_details, mp_costs, mp_sales (fallback)
```

**Функция `getSalesTotalFromCostsTree`** (строка 63, DashboardPage.tsx):
1. Находит `tree.find(t => t.name === "Продажи")` -- сумма проведённых продаж.
2. Считает credits: `tree.filter(t => t.name !== "Продажи" && t.amount > 0)` -- СПП, возмещения (только WB).
3. Возвращает `salesItem.amount + credits`.

**Логика по marketplace** (IIFE, строки 343-387):
- `marketplace === 'ozon'` -- берёт из ozonCostsTreeData
- `marketplace === 'wb'` -- берёт из wbCostsTreeData
- `marketplace === 'all'` -- суммирует оба; при частичной загрузке ждёт пока оба будут готовы
- Fallback на `summary.revenue` только если costs-tree полностью загрузился и пуст.

### Карточка 3: Себестоимость (строки 629-646)

```
SummaryCard (value={purchaseCostsForTile}, format="currency")
  └─ purchaseCostsForTile                                        (строки 319-321)
       = summary.purchase_costs_total                             (приоритет: RPC)
         ?? UE fallback: Σ(p.metrics.purchase_costs)              (если RPC вернул null)
       └─ RPC get_dashboard_summary → v_purchase_costs_total     (миграция 020)
            = SUM(p.purchase_price * s.sales_count)
            FROM mp_sales s JOIN mp_products p ON s.product_id = p.id
            WHERE date in range AND marketplace AND user_id
```

**КРИТИЧНО (правило #43, миграция 020):** RPC `get_dashboard_summary` считает purchase ВСЕГДА order-based (из `mp_sales`), для ВСЕХ маркетплейсов. Ранее Ozon purchase считался settlement-based из `mp_costs.settled_qty` -- это приводило к несовпадению осей дат (revenue order-date vs purchase settlement-date), из-за чего profit < 0 при положительной марже.

Settlement-based purchase (`purchase_price * settled_qty`) используется ТОЛЬКО в UE endpoint (Python, `dashboard.py:407-410`), где revenue тоже settlement-based (из costs-tree).

### Карточка 4: Чистая прибыль (строки 649-676)

```
SummaryCard (value={netProfitForTile}, format="currency")
  └─ netProfitForTile                                            (строки 427-438)
       = payoutForTile - purchaseCostsForTile - ad
       └─ payoutForTile                                          (строки 323-333)
            = costs-tree total_accrued (per marketplace или сумма)
            = ozonCostsTreeData.total_accrued + wbCostsTreeData.total_accrued
       └─ purchaseCostsForTile (см. карточку 3)
       └─ ad = summary.ad_cost ?? 0                              (строка 430)
```

**Формула:**
```
netProfitForTile = payoutForTile - purchaseCostsForTile - adCostForTile
```

`payoutForTile` (IIFE, строки 323-333):
- `marketplace === 'ozon'` -- `ozonCostsTreeData.total_accrued`
- `marketplace === 'wb'` -- `wbCostsTreeData.total_accrued`
- `marketplace === 'all'` -- сумма обоих (null если хотя бы один не загрузился)
- Fallback: если `payoutForTile === null` -- используется `summary.net_profit` (строка 434)

### Карточка 5: Удержания МП (строки 681-696)

```
SummaryCard (value={mpDeductionsForTile}, format="currency")
  └─ mpDeductionsForTile                                         (строки 400-410)
       = getDeductionsAbsFromCostsTree(data, marketplace)
       └─ WB: Σ(tree items < 0, кроме "Продажи")                (только отрицательные)
       └─ Ozon: Σ(tree items кроме "Продажи")                   (все, т.к. нет credits)
       └─ fallback: summary.total_costs
  └─ mpDeductionsSubtitle                                        (строки 412-425)
       = top-3 категории по абсолютной сумме (shortCostLabel)
```

**Функция `getDeductionsAbsFromCostsTree`** (строка 75):
- WB: считает только отрицательные items (т.к. есть положительные credits -- СПП, возмещения)
- Ozon: считает все items кроме "Продажи" (credits в Ozon нет)
- Возвращает `Math.abs(sum)`

### Карточка 6: Реклама + ДРР (строки 699-718)

```
SummaryCard (value={adCostForTile}, format="currency")
  └─ adCostForTile = summary?.ad_cost ?? 0                       (строка 397)
  └─ drrForTile = adCostForTile / revenueForTile * 100           (строка 398)
       (secondaryValue: "ДРР X.X%")
       └─ RPC get_dashboard_summary → v_ad_cost
            = SUM(cost) FROM mp_ad_costs
            WHERE date in range AND marketplace AND user_id
            -- НЕ фильтруется по fulfillment_type (account-level)
```

**Примечание:** ДРР объединён с рекламой в одну карточку (правило #28 -- НЕ отдельная карточка).

### Карточка 7: К перечислению (строки 721-739)

```
SummaryCard (value={payoutForTile ?? 0}, format="currency")
  └─ payoutForTile (тот же, что в карточке 4)
       = costs-tree total_accrued (per MP или сумма)
  └─ subtitle: "Ozon XXX · WB YYY" (при marketplace='all')
```

### Карточка 8: Δ / Рентабельность (строки 742-778)

Условный рендеринг:

```
canShowChange = showPeriodComparison && subscription?.features?.period_comparison
                                                                  (строка 495)
```

**Вариант A (canShowChange=true):** Δ к предыдущему периоду
```
SummaryCard (value="+12.5%", accent=emerald/red)
  └─ revenueChangeForTile                                        (строки 391-395)
       = ((revenueForTile - prevRevenueForTile) / prevRevenueForTile) * 100
  └─ secondaryValue: "было XXX ₽"
  └─ previousPeriod из useDashboardSummaryWithPrev
```

**Вариант B (canShowChange=false):** Рентабельность
```
SummaryCard (value="19.4%", accent=emerald/red)
  └─ = (netProfitForTile / revenueForTile) * 100
```

`showPeriodComparison = datePreset !== 'custom'` (строка 158). При custom-дате -- рентабельность, при пресете (7д/30д/90д) -- Δ. Δ требует фичу `period_comparison` (Pro+).

## Формулы

```
revenueForTile     = tree["Продажи"] + credits (СПП, возмещения)  -- displayed_revenue
purchaseCostsForTile = SUM(purchase_price * sales_count)          -- order-based, RPC миграция 020
adCostForTile      = SUM(mp_ad_costs.cost)                        -- account-level, без FT-фильтра
payoutForTile      = total_accrued из costs-tree                  -- Начислено (= Выкупы - Удержания)
netProfitForTile   = payoutForTile - purchaseCostsForTile - adCostForTile
mpDeductionsForTile = |Σ(tree items < 0)|                         -- WB: только отрицательные; Ozon: все кроме Продажи
drrForTile         = adCostForTile / revenueForTile * 100%
buyoutPercent      = salesCountForTile / ordersCountForTile * 100
profitMargin       = netProfitForTile / revenueForTile * 100%
```

Ссылка: CLAUDE.md секция "Формулы", правила #10, #19, #43

## Вычисления на фронтенде

Все вычисления карточек находятся в `DashboardPage.tsx` ПОСЛЕ early returns (строки 289-312) -- поэтому используются IIFE `(() => { ... })()` вместо `useMemo` (хуки нельзя вызывать после условного return).

| Переменная | Строки | Тип вычисления | Описание |
|------------|--------|----------------|----------|
| `purchaseCostsForTile` | 319-321 | `??` chain | RPC value ?? UE fallback |
| `payoutForTile` | 323-333 | IIFE | total_accrued per-MP или сумма |
| `isCostsTreeLoading` | 336-341 | IIFE | Флаг загрузки costs-tree |
| `revenueForTile` | 343-387 | IIFE | getSalesTotalFromCostsTree per-MP |
| `revenueChangeForTile` | 391-395 | IIFE | % изменения к prev period |
| `adCostForTile` | 397 | прямое | summary.ad_cost ?? 0 |
| `drrForTile` | 398 | прямое | ad / revenue * 100 |
| `mpDeductionsForTile` | 400-410 | IIFE | getDeductionsAbsFromCostsTree per-MP |
| `netProfitForTile` | 427-438 | IIFE | payout - purchase - ad |
| `ordersCountForTile` | 485 | прямое | summary.orders ?? 0 |
| `buyoutPercent` | 487 | прямое | sales / orders * 100 |
| `avgCcPerUnit` | 490 | прямое | purchaseCosts / salesCount |

## Backend логика

### GET /dashboard/summary (dashboard.py:139)

1. **Feature gates:** `period_comparison` (Pro+), `fbs_analytics` (Pro+)
2. **Дефолтные даты:** если не переданы -- последние 30 дней
3. **RPC вызов:** `get_dashboard_summary_with_prev` (если `include_prev_period=true`)
   - Внутри вызывает `get_dashboard_summary` дважды (текущий + предыдущий период)
   - Дополнительно запрашивает Ozon costs-tree revenue для корректного сравнения
4. **Возвращает:** `{ summary: SalesSummary, previous_period: PreviousPeriod }`

### RPC get_dashboard_summary (миграция 020)

Параметры: `p_date_from, p_date_to, p_marketplace, p_user_id, p_fulfillment_type`

Запросы к таблицам:
1. `mp_sales` -- orders, sales, returns, revenue (все по date range + marketplace + FT)
2. `mp_costs` -- total_costs (удержания по settlement date)
3. `mp_ad_costs` -- ad_cost (БЕЗ фильтра fulfillment_type -- account-level)
4. `mp_sales JOIN mp_products` -- purchase = `SUM(purchase_price * sales_count)` (order-based)

Расчёт:
```sql
v_net_profit := v_revenue - v_total_costs - v_purchase_costs_total - v_ad_cost;
v_drr := CASE WHEN v_revenue > 0 THEN ROUND((v_ad_cost / v_revenue) * 100, 1) ELSE 0 END;
```

**ВАЖНО:** `net_profit` из RPC -- это приблизительный расчёт (revenue из mp_sales). Фронтенд пересчитывает прибыль через `payoutForTile` из costs-tree для точности. RPC net_profit используется ТОЛЬКО как fallback (строка 434).

### GET /dashboard/costs-tree (dashboard.py:821)

1. **Feature gate:** `costs_tree_details` -- без неё `include_children=false`
2. **FBO/FBS merge:** при `fulfillment_type=None` вызывает `_fetch_costs_tree_merged()` (строка 94)
   - Два RPC: `get_costs_tree(FBO)` + `get_costs_tree(FBS)`
   - Merge: суммирование `total_accrued`, `total_revenue`, объединение tree items по name
3. **Возвращает:** `CostsTreeResponse { total_accrued, total_revenue, tree[] }`

## Состояние и кэширование

| Хук | queryKey | staleTime | refetchInterval | enabled |
|-----|----------|-----------|-----------------|---------|
| `useDashboardSummaryWithPrev` | `['dashboard', 'summary-with-prev', filters]` | 5 мин | 5 мин | `true` |
| `useCostsTree` (ozon) | `['dashboard', 'costs-tree', { ...filters, marketplace: 'ozon' }]` | 5 мин | 5 мин | `true` |
| `useCostsTree` (wb) | `['dashboard', 'costs-tree', { ...filters, marketplace: 'wb' }]` | 5 мин | 5 мин | `true` |
| `useUnitEconomics` | `['dashboard', 'unit-economics', filters]` | 5 мин | 5 мин | `Boolean(summaryData)` |

- **Zustand:** `useFiltersStore` (datePreset, marketplace, fulfillmentType, customDateFrom, customDateTo)
- `filters` объект строится в DashboardPage.tsx (строки 141-146): `{ date_from, date_to, marketplace, fulfillment_type }`
- `fulfillmentType === 'all'` конвертируется в `undefined` для API (строка 129)

## Цветовые схемы (accent)

| Карточка | accent | Иконка |
|----------|--------|--------|
| Заказы | `indigo` | ShoppingBag |
| Выкупы | `emerald` | ShoppingCart |
| Себестоимость | `amber` | Package |
| Чистая прибыль | `emerald` / `red` (динамически) | DollarSign |
| Удержания МП | `slate` | Receipt |
| Реклама | `violet` | Megaphone |
| К перечислению | `sky` | Banknote |
| Δ / Рентабельность | `emerald` / `red` (динамически) | TrendingUp |

Стили accent определены в `accentStyles` (строка 36, SummaryCard.tsx): каждый accent задаёт `bg`, `text`, `ring` классы Tailwind.

## Edge Cases

1. **Costs-tree ещё не загружен** -- `revenueForTile` возвращает 0 (skeleton через `loading={isCostsTreeLoading}`), НЕ fallback на summary.revenue. Fallback только если costs-tree загрузился и пуст.
2. **Отсутствует purchase_price** -- `purchaseCostsForTile = 0`, отображается warning badge (amber) с текстом "Без учёта себестоимости N товаров. Заполните в настройках." (строки 246-248, ccWarning).
3. **CC=0 modal** -- при первом заходе показывается модальное окно с предложением заполнить CC (строки 530-565). Dismissed через localStorage `cc-reminder-dismissed`.
4. **payoutForTile === null** -- fallback на `summary.net_profit` (строка 434).
5. **Нет рекламных данных** -- `adCostForTile = 0`, `drrForTile = 0`.
6. **canShowChange=false** (custom period или Free план) -- 8-я карточка показывает рентабельность вместо Δ.
7. **Один МП загрузился, другой нет** (при marketplace='all') -- ждёт оба; если один пуст после загрузки -- берёт что есть + 0 (строки 372-376).
8. **Ошибка summary** -- полноэкранное сообщение об ошибке с деталями request URL (строки 293-311).

## Зависимости

- **Зависит от:** FilterPanel (фильтры в Zustand), useFiltersStore, useDashboardSummaryWithPrev, useCostsTree (2x), useUnitEconomics
- **Используется в:** DashboardPage (строки 576-779)
- **Feature gate:**
  - `period_comparison` (Pro+) -- для ChangeBadge и Δ-карточки
  - `fbs_analytics` (Pro+) -- для фильтрации по fulfillment_type в RPC

## Адаптивность

- Mobile (`grid-cols-2`): `mobileTitle` для длинных названий (Себестоимость -> "Закупка", Чистая прибыль -> "Прибыль", К перечислению -> "Выплата", Δ к пред. периоду -> "Динамика", Удержания МП -> "Удержания").
- Шрифт адаптируется через `getFontSizeClass(numDigits)` (строка 75, SummaryCard.tsx): до 5 цифр -- `text-2xl`, 7 цифр -- `text-xl`, 9 цифр -- `text-lg`, 10+ -- `text-base`.
- ChangeBadge скрыт на мобильных (`hidden sm:inline-flex`).
- Tooltip: desktop -- hover (group-hover), mobile -- tap toggle через React Portal.

## Известные проблемы

- [ ] `costs_breakdown` в RPC возвращает нули (заглушка) -- детализация удержаний берётся из costs-tree, а не из RPC
- [ ] UE fallback для purchase (строка 321) зависит от `useUnitEconomics`, который require `unit_economics` feature gate -- на Free плане fallback недоступен
