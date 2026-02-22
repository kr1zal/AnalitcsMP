# Plan Editor (PlanTab)

> Редактор плана продаж с 3-уровневой иерархией: общий план -> по МП -> по товарам. Включает алерты по остаткам и копирование плана из прошлого месяца.

**Правила CLAUDE.md:** #27, #30, #31

## Визуальная структура

```
PlanTab (FeatureGate: unit_economics)
+------------------------------------------------------------+
|  SalesPlanEditor                                           |
|  +------------------------------------------------------+  |
|  |  [Target] План продаж                                |  |
|  |                                                      |  |
|  |  [<]  Февраль 2026  [>]       <- month navigation   |  |
|  |                                                      |  |
|  |  --- Уровень 1: Общий план ---                       |  |
|  |  [SaveInput: Общий план ₽___________]                |  |
|  |                                                      |  |
|  |  --- Уровень 2: По маркетплейсам ---                 |  |
|  |  Wildberries      Ozon                               |  |
|  |  [SaveInput ₽]    [SaveInput ₽]                      |  |
|  |                         Сумма: 150 000 ₽             |  |
|  |                                                      |  |
|  |  --- Уровень 3: По товарам ---                       |  |
|  |  [Wildberries] [Ozon]   <- mp tabs                   |  |
|  |  Товар 1   [barcode]     [SaveInput ₽]              |  |
|  |  Товар 2   [barcode]     [SaveInput ₽]              |  |
|  |  ...                                                 |  |
|  |  Итого WB: 120 000 ₽                                |  |
|  |                                                      |  |
|  |  [Copy] Из 2026-01  |  [RotateCcw] Сбросить         |  |
|  |                                                      |  |
|  |  [!] Сумма МП (160 000 ₽) > общий план (150 000 ₽)  |  |
|  |  [!] При наличии общего плана он имеет приоритет     |  |
|  |                                                      |  |
|  |  Приоритет: общий план -> по МП -> по товарам.       |  |
|  +------------------------------------------------------+  |
|                                                            |
|  StockPlanAlerts                                           |
|  +------------------------------------------------------+  |
|  |  [Package] Риски по остаткам                         |  |
|  |  [!] Витамин D: запас на 5 дн., до конца месяца 10  |  |
|  |  [!] Омега-3: запас на 12 дн., до конца месяца 10   |  |
|  |  [v] Цинк, Магний: запас OK                          |  |
|  +------------------------------------------------------+  |
+------------------------------------------------------------+
```

## Файлы

| Компонент | Путь | Props / Export |
|-----------|------|----------------|
| PlanTab | `frontend/src/components/Settings/PlanTab.tsx` | Без props. Поднимает `month` state |
| SalesPlanEditor | `frontend/src/components/Settings/SalesPlanEditor.tsx` | `{ month?: string, onMonthChange?: (month: string) => void }` |
| StockPlanAlerts | `frontend/src/components/Settings/StockPlanAlerts.tsx` | `{ month: string }` |
| SaveInput | `frontend/src/components/Shared/SaveInput.tsx` | `{ value: number, onSave: (value: number) => Promise<void>, placeholder?, className?, compact? }` |
| useSalesPlan | `frontend/src/hooks/useSalesPlan.ts` | 6 хуков: useSalesPlan, useSalesPlanSummary, useUpsertSalesPlan, useUpsertSummaryPlan, useResetSalesPlan, usePreviousPlan |
| salesPlanApi | `frontend/src/services/api.ts` (строки 543-577) | 7 методов API |
| Backend router | `backend/app/api/v1/sales_plan.py` | 6 endpoints |

## Data Flow

### Уровень 1-2: Summary plans (total / wb / ozon)

```
SalesPlanEditor (summary.total, summary.wb, summary.ozon)
  └─ useSalesPlanSummary(month)
       queryKey: ['sales-plan', 'summary', month]
       staleTime: 5min
       └─ salesPlanApi.getSummary(month)
            └─ GET /api/v1/sales-plan/summary?month=YYYY-MM
                 └─ Backend: sales_plan.py → get_summary_plans() (строки 210-238)
                      └─ Table: mp_sales_plan_summary
                           filter: user_id, month (normalized to YYYY-MM-01)

  Save (blur):
  └─ useUpsertSummaryPlan()
       └─ salesPlanApi.upsertSummary({ month, level, plan_revenue })
            └─ PUT /api/v1/sales-plan/summary
                 └─ Backend: sales_plan.py → upsert_summary_plan() (строки 241-265)
                      └─ UPSERT mp_sales_plan_summary ON (user_id, month, level)
       onSuccess: invalidate ['sales-plan', 'summary', month] + ['sales-plan', 'completion']
```

### Уровень 3: Per-product plans

```
SalesPlanEditor (productPlans[])
  └─ useSalesPlan(month, 'wb') + useSalesPlan(month, 'ozon')
       queryKey: ['sales-plan', month, marketplace]
       staleTime: 5min
       └─ salesPlanApi.getPlans(month, marketplace)
            └─ GET /api/v1/sales-plan?month=YYYY-MM&marketplace=wb
                 └─ Backend: sales_plan.py → get_sales_plan() (строки 83-130)
                      └─ Tables: mp_sales_plan + mp_products (join по product_id)
                           filter: user_id, month, marketplace
                           exclude: barcode='WB_ACCOUNT'

  Save (blur):
  └─ useUpsertSalesPlan()
       └─ salesPlanApi.upsertPlans({ month, marketplace, items: [{ product_id, plan_revenue }] })
            └─ PUT /api/v1/sales-plan
                 └─ Backend: sales_plan.py → upsert_sales_plan() (строки 133-175)
                      └─ Validate product_ids against mp_products (user ownership)
                      └─ UPSERT mp_sales_plan ON (user_id, product_id, month, marketplace)
       onSuccess: invalidate ['sales-plan', month, marketplace] + ['sales-plan', 'completion']
```

### Копирование плана

```
SalesPlanEditor → handleCopy()
  └─ usePreviousPlan(month)
       queryKey: ['sales-plan', 'previous', month]
       staleTime: 10min
       └─ salesPlanApi.getPrevious(month)
            └─ GET /api/v1/sales-plan/previous?month=YYYY-MM
                 └─ Backend: sales_plan.py → get_previous_plan() (строки 558-605)
                      └─ dateutil.relativedelta: month - 1
                      └─ Tables: mp_sales_plan_summary + mp_sales_plan за prev_month
                      └─ Returns: { has_previous, prev_month, summary, plans[] }

  При confirm:
    1. Copy summary levels (total/wb/ozon) → summaryMut.mutateAsync() x N
    2. Copy per-product plans by MP → upsertProductMut.mutateAsync() x N
    3. toast.success()
```

### Сброс плана

```
SalesPlanEditor → handleReset() (с confirm dialog)
  └─ useResetSalesPlan()
       └─ salesPlanApi.reset(month)
            └─ DELETE /api/v1/sales-plan/reset?month=YYYY-MM
                 └─ Backend: sales_plan.py → reset_sales_plan() (строки 178-205)
                      └─ DELETE mp_sales_plan_summary WHERE user_id, month
                      └─ DELETE mp_sales_plan WHERE user_id, month
       onSuccess: invalidate ALL ['sales-plan'] queries
```

### StockPlanAlerts

```
StockPlanAlerts (month)
  └─ useStocks() (из useDashboard.ts)
       └─ Текущие остатки (без привязки к периоду)
  └─ useMemo: classifyAlert() для каждого товара
       daysToEnd = дней до конца месяца
       severity:
         critical — days_remaining <= 7 AND < daysToEnd
         warning  — days_remaining < daysToEnd
         ok       — запас достаточен
       Exclude: barcode='WB_ACCOUNT'
       Sort: critical → warning → ok
  └─ Рендер: только если есть critical или warning алерты
```

## Формулы

```
-- Plan completion (backend: sales_plan.py, строки 270-478)
completion_percent = (total_actual / total_plan) * 100

-- Приоритет completion (правило #27):
-- 1. total plan (если есть) → actual = SUM(mp_sales.revenue) за plan months
-- 2. per-MP plans (wb/ozon) → actual ТОЛЬКО по МП с планами (active_mps)
-- 3. per-product plans → actual по продуктам с планами

-- Pace/Forecast (backend: _calc_pace_forecast, строки 514-553)
pace_daily = total_actual / days_elapsed
required_pace = (total_plan - total_actual) / days_remaining
forecast_revenue = total_actual + pace_daily * days_remaining
forecast_percent = (forecast_revenue / total_plan) * 100

-- Stock alerts (frontend: StockPlanAlerts.tsx, строки 23-33)
daysToMonthEnd = ceil((lastDayOfMonth - today) / 86400000)
severity = critical если days_remaining <= 7 AND < daysToEnd
         = warning  если days_remaining < daysToEnd
         = ok       иначе
```

Ссылка: CLAUDE.md секция "Формулы" (Pace, Forecast, Plan completion)

## Вычисления на фронтенде

### SalesPlanEditor (строки 79-101)

- `productTabTotal` (useMemo, строка 79): `SUM(productPlans.plan_revenue)` для активной вкладки MP
- `warnings` (useMemo, строка 84): массив строк предупреждений:
  - `mpSum > summary.total * 1.01` -- сумма МП превышает общий план (порог 1%)
  - `summary.total > 0 && (wb > 0 || ozon > 0)` -- приоритет общего плана над МП
  - `wbProductTotal > summary.wb * 1.01` -- сумма товаров WB > план WB
  - `ozonProductTotal > summary.ozon * 1.01` -- сумма товаров Ozon > план Ozon
- `hasAnyPlan` (строка 113): `total > 0 || wb > 0 || ozon > 0 || productTabTotal > 0`

### PlanTab: month state lifting (строки 10-16)

`getCurrentMonth()` вызывается ОДИН раз в PlanTab (строка 16). State `month` передается и в SalesPlanEditor, и в StockPlanAlerts через props. SalesPlanEditor имеет fallback на `internalMonth` для standalone-использования (строки 53-55).

## Backend логика

### Endpoints

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/sales-plan` | Per-product планы за месяц + МП. Join mp_products для имен |
| PUT | `/sales-plan` | Upsert per-product планов. Валидация product_id ownership |
| DELETE | `/sales-plan/reset` | Удаляет ВСЕ планы (summary + per-product) за месяц |
| GET | `/sales-plan/summary` | Summary планы (total/wb/ozon) за месяц |
| PUT | `/sales-plan/summary` | Upsert одного summary level |
| GET | `/sales-plan/completion` | Completion с 3-уровневым приоритетом + pace/forecast |
| GET | `/sales-plan/previous` | Планы за предыдущий месяц (для копирования) |

### Нормализация месяца

`normalize_month("2026-02")` -> `"2026-02-01"` (backend: строки 45-55). Все запросы к БД используют формат `YYYY-MM-01`.

### Completion: 3-level priority (строки 270-478)

1. **Priority 1 (total):** если `mp_filter=None` и `summary.total > 0` -- actual = SUM всех mp_sales за plan months
2. **Priority 2 (per-MP):** если summary.wb или summary.ozon > 0 -- actual ТОЛЬКО по `active_mps` (МП с планами)
3. **Priority 3 (per-product):** если есть per-product планы -- actual по product_id за plan months

Критично: actual revenue считается ТОЛЬКО за месяцы, в которых ЕСТЬ план (`_plan_months_range`), а не за весь date range дашборда (правило #30).

### DB таблицы

| Таблица | PK / Unique | Колонки |
|---------|-------------|---------|
| `mp_sales_plan` | `user_id, product_id, month, marketplace` | plan_revenue, updated_at |
| `mp_sales_plan_summary` | `user_id, month, level` | plan_revenue, updated_at |

## SaveInput: паттерн inline blur-save

**Файл:** `frontend/src/components/Shared/SaveInput.tsx` (83 строки)

### Механизм

1. `localValue` (useState) -- текст в input, инициализируется из `value` prop
2. `isFocusedRef` (useRef) -- предотвращает перезапись при фокусе
3. `prevValue` (useRef) -- синхронизация с серверным значением БЕЗ потери фокуса (строки 28-32)
4. **Blur:** парсит число, сравнивает с `value` prop, вызывает `onSave(newValue)` -- показывает spinner + checkmark
5. **Enter:** вызывает `blur()` на input, что триггерит handleBlur
6. **Compact mode:** для таблиц UE -- уменьшенный padding и text-xs

### Защита от потери данных

```tsx
// Строки 28-32: sync с сервером ТОЛЬКО если input не в фокусе и не saving
if (prevValue.current !== value && !saving && !isFocusedRef.current) {
  prevValue.current = value;
  setLocalValue(value > 0 ? String(value) : '');
}
```

Это решает проблему (правило #30): когда mutation обновляет React Query cache, новое значение приходит через props, но если пользователь уже редактирует другое поле -- оно не перезаписывается.

## Состояние и кэширование

- **Zustand:** не используется (state в React)
- **React Query keys:**
  - `['sales-plan', month, marketplace]` -- per-product plans
  - `['sales-plan', 'summary', month]` -- summary plans
  - `['sales-plan', 'completion', filters]` -- completion card
  - `['sales-plan', 'previous', month]` -- previous month
- **staleTime:** 5min (plans, summary, completion), 10min (previous)
- **Invalidation:** upsert мутации инвалидируют specific key + completion. Reset инвалидирует ALL sales-plan.
- **enabled:** всегда true (данные загружаются при открытии таба)

## Edge Cases

1. **Нет товаров для МП** -- показывает "Нет товаров WB/Ozon" (строка 281-283)
2. **Пустой план** -- все SaveInput показывают placeholder "0", кнопка "Сбросить" скрыта
3. **Нет предыдущего месяца** -- кнопка "Из YYYY-MM" скрыта (`prevData?.has_previous`)
4. **Порог предупреждений** -- 1% tolerance (`mpSum > summary.total * 1.01`) чтобы избежать floating-point false positives
5. **Feature gate** -- `unit_economics` (Pro+). FeatureGate оборачивает весь PlanTab
6. **Месяц в прошлом** -- StockPlanAlerts возвращает `null` если `daysToEnd <= 0`
7. **WB_ACCOUNT** -- исключается из per-product планов (backend: строка 116) и stock alerts (frontend: строка 64)
8. **Копирование при наличии текущего плана** -- `window.confirm()` предупреждение "Текущие значения будут перезаписаны"

## Зависимости

- **Зависит от:** FeatureGate (Pro+), useStocks (для StockPlanAlerts), salesPlanApi (API layer)
- **Используется в:** SettingsPage (tab "План продаж"), PlanCompletionCard (dashboard)
- **Feature gate:** `unit_economics` (Pro+)
- **DB миграции:** 014 (mp_sales_plan), 015 (marketplace column), 016 (mp_sales_plan_summary)

## Известные проблемы

- [ ] `getCurrentMonth()` в SalesPlanEditor (строка 29) дублирует функцию из PlanTab -- но используется только как fallback для standalone
- [ ] Копирование плана выполняет последовательные mutateAsync вызовы (не batch) -- при большом количестве товаров может быть медленно
- [ ] Месяц не привязан к МСК timezone (используется `new Date()` без TZ correction) -- потенциально неверный месяц при переходе через полночь МСК
