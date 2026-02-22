# PlanCompletionCard — Виджет выполнения плана продаж

> Карточка прогресса плана продаж за текущий месяц: процент выполнения, темп, прогноз, оставшиеся дни. Кликабельная ссылка на настройку плана.

**Правила CLAUDE.md:** #27, #30, #31

## Визуальная структура

```
┌─────────────────────────────────────────────────────┐
│  bg: emerald-50 / indigo-50 / amber-50              │
│                                                     │
│  🎯 План продаж  Февраль 2026     [Настроить →]    │
│                                                     │
│  67.2%                    285 400₽ / 425 000₽       │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░  progress bar             │
│                                                     │
│  ┌─────────┐  ┌─────────┐  ┌──────────┐            │
│  │  Темп   │  │  Нужно  │  │ Осталось │            │
│  │ 14K₽/д  │  │ 17K₽/д  │  │  8 дн.   │            │
│  └─────────┘  └─────────┘  └──────────┘            │
│                                                     │
│  ┌──────────────────────────────────────────┐       │
│  │ ⚠ Прогноз: 398 200₽ (93.7%)             │       │
│  │ (amber если <100%, emerald если ≥100%)    │       │
│  └──────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────┘
```

## Файлы

| Компонент | Путь | Props |
|-----------|------|-------|
| PlanCompletionCard | `frontend/src/components/Dashboard/PlanCompletionCard.tsx` | `{ data: SalesPlanCompletionResponse \| undefined, loading?: boolean }` |
| DashboardPage | `frontend/src/pages/DashboardPage.tsx` | (оркестратор, строка 209, 782–786) |
| useSalesPlanCompletion | `frontend/src/hooks/useSalesPlan.ts` | hook, строка 76 |
| sales_plan.py | `backend/app/api/v1/sales_plan.py` | endpoint `/sales-plan/completion`, строка 270 |

## Data Flow

```
FeatureGate feature="unit_economics" hide
  └─ PlanCompletionCard (data={planCompletionData}, loading={planCompletionLoading})
       └─ DashboardPage (строка 209, 782–786)
            └─ Hook: useSalesPlanCompletion(filters)          (useSalesPlan.ts, строка 76)
                 queryKey: ['sales-plan', 'completion', filters]
                 staleTime: 5min
                 enabled: true
                 └─ API: salesPlanApi.getCompletion(params)    (api.ts, строка 554)
                      └─ GET /api/v1/sales-plan/completion
                           params: date_from, date_to, marketplace
                           └─ Backend: sales_plan.py → get_sales_plan_completion()  (строка 270)
                                ├─ Priority 1: mp_sales_plan_summary WHERE level='total'
                                ├─ Priority 2: mp_sales_plan_summary WHERE level='wb'/'ozon'
                                └─ Priority 3: mp_sales_plan (per-product)
                                     └─ Actual: SUM(mp_sales.revenue) WHERE date IN plan_months
```

## Формулы

```
-- Процент выполнения
completion_percent = (total_actual / total_plan) × 100%

-- Темп (ежедневный факт)
pace_daily = total_actual / days_elapsed                    -- строка 540

-- Необходимый темп (для достижения плана)
required_pace = (total_plan - total_actual) / days_remaining  -- строка 541

-- Прогноз (экстраполяция текущего темпа)
forecast_revenue = total_actual + pace_daily × days_remaining  -- строка 542
forecast_percent = (forecast_revenue / total_plan) × 100%      -- строка 543

-- Дни
days_elapsed  = min(today, last_day_of_plan) - first_day_of_plan + 1
days_remaining = max(0, last_day_of_plan - today)
days_total    = SUM(days_in_each_plan_month)

-- Actual revenue — ТОЛЬКО за месяцы С ПЛАНОМ (правило #27, #30)
actual_from = first_day_of_first_plan_month
actual_to   = min(today, last_day_of_last_plan_month)
```

Ссылка: CLAUDE.md секция "Формулы" — Pace, Forecast, Plan completion

## Вычисления на фронтенде

### DashboardPage — загрузка (строка 209)

```typescript
const { data: planCompletionData, isLoading: planCompletionLoading } =
  useSalesPlanCompletion(filters);
```

`filters` включает: `date_from`, `date_to`, `marketplace`, `fulfillment_type`.

### DashboardPage — рендер (строки 782–786)

```tsx
<FeatureGate feature="unit_economics" hide>
  <div className="mb-4 sm:mb-5 lg:mb-6">
    <PlanCompletionCard data={planCompletionData} loading={planCompletionLoading} />
  </div>
</FeatureGate>
```

Feature gate `unit_economics` с prop `hide` — если фича недоступна, блок полностью скрыт (без fallback-сообщения).

### PlanCompletionCard — внутренняя логика (строки 27–131)

1. **Early return null** если `!data || data.total_plan <= 0` (строка 30) — карточка не рендерится если плана нет
2. **Деструктуризация** с дефолтами (строки 42–47):
   - `pace_daily = 0`, `required_pace = 0`, `forecast_revenue = 0`, `forecast_percent = 0`, `days_remaining = 0`
3. **Цвет** определяется по `forecast_percent` (или `completion_percent` если forecast не задан):
   - `>= 100%` — emerald (зелёный, план выполнен/будет выполнен)
   - `>= 80%` — indigo (синий, на пути)
   - `< 80%` — amber (жёлтый, отставание)
4. **Progress bar** — `clampedWidth = Math.min(100, completion_percent)`, transition 500ms
5. **3 метрики** — grid-cols-3:
   - Темп: `formatCompact(pace_daily)₽/д`
   - Нужно / Нужно было (если `isFinished`): `formatCompact(required_pace)₽/д`
     - Красный цвет если `required_pace > pace_daily && !isFinished`
   - Осталось / Дней: `days_remaining дн.`
6. **Forecast row** — emerald или amber фон:
   - Если `forecastOk` (>=100%): CheckCircle + зелёный текст
   - Иначе: AlertTriangle + amber текст
   - Если месяц закончился (`isFinished`): показывает "Итог" вместо "Прогноз"

### formatCompact (строка 21)

Сокращённый формат для компактного отображения:
- `>= 1 000 000` → `1.5M`
- `>= 1 000` → `285K`
- Иначе → целое число

## Backend логика

### Endpoint: `GET /sales-plan/completion` (sales_plan.py, строка 270)

**Параметры:**
- `date_from` — начало периода (default: 1-е число текущего месяца)
- `date_to` — конец периода (default: сегодня)
- `marketplace` — фильтр МП (`wb`, `ozon`, `all`)

**Аутентификация:** `get_current_user` (JWT).

**НЕТ отдельного feature gate** на endpoint — карточка скрывается через `FeatureGate` на фронтенде.

### Алгоритм 3-уровневого приоритета (строки 306–478)

**Шаг 1.** Определяет месяцы, которые покрывает `date_from..date_to` (строки 290–302).

**Шаг 2.** Загружает ВСЕ summary-планы из `mp_sales_plan_summary` за эти месяцы (строка 307).

**Шаг 3. Priority 1 — Total plan** (строки 326–343):
- Условие: `mp_filter` не задан И `summary['total'] > 0`
- `total_actual` = SUM(mp_sales.revenue) за месяцы с total-планом
- Возвращает `plan_level: 'total'`

**Шаг 4. Priority 2 — Per-MP summary** (строки 346–383):
- `active_mps` = только МП с планами > 0 (строки 351–357)
- При `marketplace=all`: суммирует actual только по МП с планами (исключает МП без планов)
- Возвращает `plan_level: 'marketplace'`

**Шаг 5. Priority 3 — Per-product** (строки 385–478):
- Загружает `mp_sales_plan` per product
- `actual_by_product` = SUM(mp_sales.revenue) per product
- Формирует `by_product` массив с completion per product
- Возвращает `plan_level: 'product'`

**Шаг 6.** Если планов нет — возвращает `plan_level: 'none'`, `total_plan: 0`.

### Ключевой баг-фикс (правило #27, #30)

`actual` revenue считается ТОЛЬКО за месяцы с планами, а НЕ за весь date range дашборда. Функция `_plan_months_range()` (строка 481) вычисляет `actual_from` и `actual_to` из списка plan months:
- `actual_from` = первый день первого месяца с планом
- `actual_to` = min(today, последний день последнего месяца с планом)

### Вычисление pace/forecast: `_calc_pace_forecast()` (строка 514)

- `days_total` — суммарное количество дней во всех месяцах с планами
- `days_elapsed` — от первого дня плана до min(today, last_day)
- `days_remaining` — от today до last_day (или 0 если месяц закончился)
- `pace_daily` = actual / days_elapsed
- `required_pace` = (plan - actual) / days_remaining
- `forecast_revenue` = actual + pace_daily * days_remaining
- `forecast_percent` = forecast / plan * 100%

## Типы данных

```typescript
// frontend/src/types/index.ts, строка 525

interface SalesPlanCompletionResponse {
  status: 'success';
  period: { from: string; to: string };
  month_label: string;                           // "Февраль 2026"
  plan_level: 'total' | 'marketplace' | 'product' | 'none';
  total_plan: number;
  total_actual: number;
  completion_percent: number;
  by_product: SalesPlanCompletionItem[];
  // v2 fields
  pace_daily?: number;
  required_pace?: number;
  forecast_revenue?: number;
  forecast_percent?: number;
  days_elapsed?: number;
  days_remaining?: number;
  days_total?: number;
}

interface SalesPlanCompletionItem {               // строка 517
  product_id: string;
  product_name: string;
  plan_revenue: number;
  actual_revenue: number;
  completion_percent: number;
}
```

## Состояние и кэширование

- **Zustand:** `useFiltersStore` (datePreset, marketplace, fulfillmentType) — определяет period и mp для запроса
- **React Query key:** `['sales-plan', 'completion', { date_from, date_to, marketplace, fulfillment_type }]`
- **staleTime:** 5 мин
- **enabled:** `true` (всегда)
- **Инвалидация:** при upsert/reset плана — `invalidateQueries({ queryKey: ['sales-plan', 'completion'] })` (useSalesPlan.ts, строки 28, 49, 61)

## Цветовое кодирование

### Карточка (фон, текст, progress bar, border)

| Условие | Фон | Текст | Bar | Border |
|---------|-----|-------|-----|--------|
| `forecast_percent >= 100` | emerald-50 | emerald-700 | emerald-500 | emerald-200 |
| `forecast_percent >= 80` | indigo-50 | indigo-700 | indigo-500 | indigo-200 |
| `forecast_percent < 80` | amber-50 | amber-700 | amber-500 | amber-200 |

Определяется функцией `getColors()` (строка 15). Приоритет: `forecast_percent`, fallback на `completion_percent`.

### Required pace

- Красный (`text-red-600`) если `required_pace > pace_daily && !isFinished` — текущий темп недостаточен
- Иначе серый (`text-gray-700`)

### Forecast row

- Зелёный фон (`bg-emerald-100/60`) + CheckCircle если `forecast_percent >= 100`
- Amber фон (`bg-amber-100/60`) + AlertTriangle если `forecast_percent < 100`

## Edge Cases

1. **Плана нет (`total_plan <= 0`)** — компонент возвращает `null`, ничего не рендерится
2. **Загрузка** — skeleton (animate-pulse): полоска заголовка, блок значения, progress bar
3. **Месяц закончился (`days_remaining === 0`)** — `isFinished = true`:
   - "Нужно" → "Нужно было"
   - "Осталось" → "Дней: 0 дн."
   - "Прогноз" → "Итог" (показывает actual вместо forecast)
4. **Feature gate недоступен (Free план)** — `FeatureGate feature="unit_economics" hide` полностью скрывает блок
5. **Completion > 100%** — progress bar ограничен `Math.min(100, completion_percent)`, но процент показывается as-is (может быть 120%)
6. **Несколько месяцев с планами** — label формируется как "Январь 2026 — Февраль 2026", actual суммируется за все plan-months

## Зависимости

- **Зависит от:** FilterPanel (period, marketplace), FeatureGate (unit_economics), useSalesPlanCompletion (данные)
- **Используется в:** DashboardPage (строка 782)
- **Feature gate:** `unit_economics` (Pro+). Определён в `backend/app/plans.py`: Free=false, Pro=true, Business=true
- **Навигация:** кнопка "Настроить →" ведёт на `/settings?tab=plan` (строка 64)
- **Связанные компоненты:** SalesPlanEditor (PlanTab в Settings), SaveInput, PlanCompletionCard

## Таблицы БД

| Таблица | Назначение |
|---------|-----------|
| `mp_sales_plan_summary` | Планы уровня total / per-MP (user_id, month, level, plan_revenue) |
| `mp_sales_plan` | Планы per-product per-MP (user_id, product_id, month, marketplace, plan_revenue) |
| `mp_sales` | Фактические продажи (revenue) для расчёта actual |

## Известные проблемы

- [ ] Endpoint `/sales-plan/completion` не имеет feature gate на backend — проверка только на фронтенде через FeatureGate. Free-пользователь может вызвать API напрямую (low risk, данные readonly)
