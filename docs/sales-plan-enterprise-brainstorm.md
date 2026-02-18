# Enterprise Sales Plan — Brainstorm Document

> Дата: 18.02.2026
> Участники: Маркетолог, UX/UI дизайнер, Backend-архитектор, Продуктовый аналитик
> Контекст: Полный аудит + brainstorm механизма планирования продаж на уровне enterprise

---

## 1. АУДИТ ТЕКУЩЕЙ СИСТЕМЫ

### 1.1 Что есть сейчас

**Backend** (6 endpoints в `sales_plan.py`):
| Endpoint | Метод | Назначение |
|----------|-------|-----------|
| `/sales-plan` | GET | Получить планы по product_id + month + marketplace |
| `/sales-plan` | PUT | Upsert планов (массовый) |
| `/sales-plan/summary` | GET | Получить summary-планы (total/wb/ozon) |
| `/sales-plan/summary` | PUT | Upsert summary-планов |
| `/sales-plan/completion` | GET | Рассчитать выполнение (самый сложный, ~190 строк) |
| `/sales-plan/reset` | DELETE | Сброс всех планов за месяц |

**База данных** (2 таблицы):
- `mp_sales_plan` — per-product: `(user_id, product_id, month, marketplace, plan_revenue)` UNIQUE
- `mp_sales_plan_summary` — per-level: `(user_id, month, level CHECK IN ('total','wb','ozon'), plan_revenue)` UNIQUE

**Логика completion** (3-уровневый приоритет):
```
1. Если есть total plan → % = actual_revenue / total_plan
2. Иначе если есть MP-планы → % = Σ(actual_mp) / Σ(plan_mp)
3. Иначе если есть product-планы → % = Σ(actual_prod) / Σ(plan_prod)
```
Факт считается ТОЛЬКО за месяцы, в которых ЕСТЬ план (не за весь date range дашборда).

### 1.2 Frontend-компоненты (17+ файлов)

| Компонент | Строк | Где используется |
|-----------|-------|-----------------|
| `SalesPlanEditor.tsx` | ~292 | Settings → Товары tab |
| `PlanCompletionCard.tsx` | ~69 | Dashboard (прогресс-бар) |
| `UePlanPanel.tsx` | ~195 | UE page (collapse-панель) |
| `UeTable.tsx` | ~350+ | UE page (BCG-фильтр, inline edit) |
| `UeKpiCards.tsx` | ~191 | UE page (KPI-карточка "План") |
| `UeExpandedRow.tsx` | ~177 | UE page (per-MP прогресс) |
| `uePlanHelpers.ts` | ~231 | Shared (computePlanPace, classifyMatrix) |
| `useSalesPlan.ts` | ~77 | Hooks (React Query) |
| `SaveInput.tsx` | ~50 | Shared (blur-save pattern) |

### 1.3 Связки между модулями

```
Plan ↔ Dashboard:    PlanCompletionCard (прогресс-бар, скрыт если plan ≤ 0)
Plan ↔ UE:           BCG-матрица, pace/forecast, inline edit, DRR column
Plan ↔ Settings:     SalesPlanEditor (3-level editor)
Plan ↔ FeatureGate:  Скрыт на Free тарифе
Plan ↔ Stock:        ❌ НЕТ СВЯЗИ (критический gap)
Plan ↔ Ads:          ❌ НЕТ СВЯЗИ
Plan ↔ Pricing:      ❌ НЕТ СВЯЗИ
```

### 1.4 Найденные проблемы

| # | Проблема | Критичность |
|---|----------|-------------|
| 1 | План только по выручке (нет прибыли, штук, заказов) | P0 |
| 2 | Только месячный горизонт (нет квартал/год) | P1 |
| 3 | Нет связи План ↔ Остатки (stock-aware) | P0 |
| 4 | Нет связи План ↔ Реклама (ad budget planning) | P1 |
| 5 | Нет MoM/YoY сравнения планов | P2 |
| 6 | Нет auto-suggest на основе истории | P1 |
| 7 | Нет версионности планов (snapshots) | P2 |
| 8 | SalesPlanEditor в Settings (должен быть отдельная страница) | P1 |
| 9 | `_plan_months_range` может вернуть инвертированный диапазон | P2 (баг) |
| 10 | Нет CHECK constraint на marketplace в DB | P3 (cosmetic) |

---

## 2. МАРКЕТОЛОГ — Бизнес-метрики и логика планирования

### 2.1 Конкурентный бенчмарк

| Платформа | План продаж | Plan vs Actual | Stock-aware | Profit plan |
|-----------|-------------|----------------|-------------|-------------|
| **SellerBoard** | Нет | Нет | Нет | Нет |
| **MPStats** | Нет (только аналитика) | Нет | Нет | Нет |
| **Shopify** | Revenue targets | Базовый | Inventory alerts | Нет |
| **Stripe** | MRR targets | Dashboard | N/A | Margin tracking |
| **Monday.com** | Custom KPI | Kanban/Gantt | Нет | Custom |
| **Pipedrive** | Sales pipeline | Forecast vs actual | Нет | Revenue only |

**BLUE OCEAN**: Ни один инструмент аналитики маркетплейсов НЕ имеет полноценного Plan vs Actual. Это конкурентное преимущество.

### 2.2 Рекомендуемые метрики планирования

**Tier 1 — Must Have (P0):**
| Метрика | Формула | Зачем |
|---------|---------|-------|
| План по выручке | `plan_revenue` (уже есть) | Базовый KPI |
| План по прибыли | `plan_profit = plan_revenue × target_margin%` | Главная бизнес-цель |
| План по штукам | `plan_units = plan_revenue / avg_check` | Операционное планирование |
| Выполнение % | `actual / plan × 100%` (уже есть) | Контроль |

**Tier 2 — Should Have (P1):**
| Метрика | Формула | Зачем |
|---------|---------|-------|
| Pace (темп) | `daily_actual / (plan / days_in_month)` | Прогноз выполнения |
| Forecast | `actual + pace × remaining_days` | Будет ли выполнен план |
| Plan accuracy | `1 - |actual - plan| / plan` | Качество планирования |
| MoM comparison | `plan_current / plan_prev × 100%` | Динамика амбиций |
| DRR budget | `plan_ad_spend / plan_revenue × 100%` | Контроль расходов |

**Tier 3 — Nice to Have (P2):**
| Метрика | Зачем |
|---------|-------|
| Auto-suggest | ML/статистика: `avg(last_3_months) × growth_coef` |
| Сезонность | Коэффициент по месяцам из истории |
| Plan variance alert | Telegram-уведомление при отклонении >20% |

### 2.3 Монетизация планирования

```
Free:     Нет доступа к планированию
Pro:      Базовый план (выручка, месяц, per-product)
Business: Расширенный план (прибыль, штуки, квартал/год, auto-suggest, alerts)
```

### 2.4 Retention-стратегия через планирование

1. **Habit loop**: Пользователь заходит каждый день проверить % выполнения → sticky metric
2. **Plan accuracy score**: Геймификация — "Точность вашего планирования: 87%"
3. **MoM digest**: "В феврале вы выполнили план на 94%. Средний план +12% к январю"
4. **Stock alert**: "Магний закончится через 7 дней — план на март под угрозой"

---

## 3. UX/UI ДИЗАЙНЕР — Enterprise визуал и взаимодействие

### 3.1 Бенчмарк UX-паттернов

| Платформа | Паттерн планирования | Визуализация |
|-----------|----------------------|-------------|
| **Notion** | Inline databases, formula columns | Progress bars, rollups |
| **Linear** | Cycle planning, velocity tracking | Burndown chart |
| **Monday.com** | Dashboards with widgets | Gauge meters, charts |
| **Stripe** | Revenue goals, MRR chart | Area chart + target line |
| **Geckoboard** | KPI dashboards, goals | Gauge, sparkline, progress |

### 3.2 Архитектура UX — отдельная страница `/planning`

**Рекомендация**: Вынести планирование из Settings в отдельную страницу. Причины:
- Settings — это конфигурация (set & forget)
- Планирование — это активный инструмент (используется ежедневно/еженедельно)
- Enterprise-уровень требует dedicated workspace

**Навигация** (6 → 7 пунктов, но с большей ценностью):
```
Дашборд | Заказы | Аналитика | Реклама | Планирование | Настройки
```

### 3.3 Wireframe — страница Планирования (desktop)

```
┌─────────────────────────────────────────────────────────────┐
│  Планирование                                  Февраль 2026 │
│  ◀ Янв  [Фев]  Мар ▶              [Квартал] [Год] [+ План] │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──── Общий план ─────────────────────────────────────────┐│
│  │                                                           ││
│  │  Выручка        ████████████████░░░░  78%   780K / 1M   ││
│  │  Прибыль        ██████████░░░░░░░░░░  52%   156K / 300K ││
│  │  Штуки          ████████████████████  94%   470 / 500   ││
│  │                                                           ││
│  │  Темп:  26K/день  |  Прогноз: 1.04M (104%)  |  Дней: 10 ││
│  │                                                           ││
│  └───────────────────────────────────────────────────────────┘│
│                                                               │
│  ┌──── Cumulative Chart ─────────────────────────────────────┐│
│  │     1M ┤                                          ___--- ││
│  │        │                                    _--*        ││
│  │   750K ┤                              _--*             ││
│  │        │                        __--*   <- Прогноз     ││
│  │   500K ┤                  __--*   (пунктир)            ││
│  │        │            __--*                               ││
│  │   250K ┤      __--*   <- Факт (solid)                  ││
│  │        │ __--*                                          ││
│  │      0 ┤*─────────┬──────────┬──────────┬──────────────││
│  │        1         7         14         21         28     ││
│  │                                                           ││
│  │  ── План (target line)  ── Факт  - - Прогноз            ││
│  └───────────────────────────────────────────────────────────┘│
│                                                               │
│  ┌──── По маркетплейсам ─────────────────────────────────────┐│
│  │                                                           ││
│  │  WB        ████████████████░░░░  82%   ▲+5% vs Янв      ││
│  │  Ozon      ██████████░░░░░░░░░░  61%   ▼-3% vs Янв      ││
│  │                                                           ││
│  └───────────────────────────────────────────────────────────┘│
│                                                               │
│  ┌──── По товарам ───────────────────────────────────────────┐│
│  │                                                           ││
│  │  Товар          │ План     │ Факт    │ %    │ Прогноз   ││
│  │  ───────────────┼──────────┼─────────┼──────┼───────────││
│  │  Магний + В6    │ 300K     │ 245K    │ 82%  │ 310K ✓   ││
│  │  Витамин D3+К2  │ 250K     │ 178K    │ 71%  │ 228K ⚠   ││
│  │  L-карнитин     │ 200K     │ 168K    │ 84%  │ 214K ✓   ││
│  │  Магний цитрат  │ 150K     │ 112K    │ 75%  │ 144K ⚠   ││
│  │  Тестобустер    │ 100K     │  77K    │ 77%  │  99K ⚠   ││
│  │                                                           ││
│  │  ✓ = прогноз ≥ план    ⚠ = прогноз < план               ││
│  └───────────────────────────────────────────────────────────┘│
│                                                               │
│  ┌──── Stock Alert ──────────────────────────────────────────┐│
│  │  ⚠ Магний цитрат: запас 12 дней — план на март под       ││
│  │    угрозой (нужно 45 дней для выполнения плана)          ││
│  │  ⚠ Тестобустер: запас 8 дней — закажите поставку          ││
│  └───────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### 3.4 Wireframe — мобильная версия

```
┌───────────────────────┐
│ Планирование    Фев ▼ │
├───────────────────────┤
│                        │
│ Общий план             │
│ ████████████░░░░ 78%   │
│ 780K / 1M выручки      │
│                        │
│ Темп: 26K/д            │
│ Прогноз: 1.04M (104%) │
│                        │
│ [Cumulative chart]     │
│  ...sparkline...       │
│                        │
│ ─── WB ───── 82% ──── │
│ ─── Ozon ─── 61% ──── │
│                        │
│ По товарам          ▼  │
│ ┌────────────────────┐ │
│ │ Магний+В6    82% ✓ │ │
│ │ 245K / 300K        │ │
│ ├────────────────────┤ │
│ │ Витамин D3   71% ⚠│ │
│ │ 178K / 250K        │ │
│ └────────────────────┘ │
│                        │
│ ⚠ Stock Alert: 2 товара│
│   с низким запасом     │
└───────────────────────┘
```

### 3.5 Dashboard Widget

Вместо текущего `PlanCompletionCard` (простой прогресс-бар) — расширенный виджет:

```
┌────────────────────────────────────┐
│ План на февраль           [→]      │
│                                     │
│    78%         Темп: 26K/д         │
│  ┌─────┐      Прогноз: 104% ✓     │
│  │ ██  │      Осталось: 10 дней    │
│  │ ██  │                            │
│  │ ██  │      WB:   82%            │
│  │ ██  │      Ozon: 61%            │
│  │░░░░ │                            │
│  └─────┘                            │
│   gauge                             │
└────────────────────────────────────┘
```

### 3.6 Celebrate animations

При достижении 100%: confetti-анимация (react-confetti или CSS keyframes).
При 90%+: пульсирующий зеленый badge "Почти!"

---

## 4. BACKEND-АРХИТЕКТОР — Data model, API, масштабируемость

### 4.1 Анализ текущей модели

**Текущие 2 таблицы — корректны, но ограничены:**
- `mp_sales_plan` хранит только `plan_revenue` (NUMERIC 12,2)
- `mp_sales_plan_summary` — то же самое на уровне total/MP
- Нет поддержки нескольких метрик (прибыль, штуки)
- Нет версионности (перезапись = потеря истории)

### 4.2 Предлагаемая расширенная модель

**Вариант: Columnar metrics (рекомендуемый, НЕ EAV/JSON)**

```sql
-- Миграция 018: Расширение mp_sales_plan
ALTER TABLE mp_sales_plan
  ADD COLUMN plan_profit    NUMERIC(12,2) DEFAULT NULL,
  ADD COLUMN plan_units     INTEGER       DEFAULT NULL,
  ADD COLUMN plan_ad_spend  NUMERIC(12,2) DEFAULT NULL;

-- Миграция 019: Расширение mp_sales_plan_summary
ALTER TABLE mp_sales_plan_summary
  ADD COLUMN plan_profit    NUMERIC(12,2) DEFAULT NULL,
  ADD COLUMN plan_units     INTEGER       DEFAULT NULL,
  ADD COLUMN plan_ad_spend  NUMERIC(12,2) DEFAULT NULL;
```

**Почему NOT EAV/JSON:**
- EAV (key-value): сложные JOIN-ы, невозможность индексации, теряется типизация
- JSON column: невозможность partial update, сложные запросы
- Columnar: простые запросы, индексация, NULL = "не задано", легко добавлять поля

### 4.3 Версионность планов (Phase 2)

```sql
-- Миграция 020: Версионность
CREATE TABLE mp_plan_versions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id),
  month        DATE NOT NULL,
  version      INTEGER NOT NULL DEFAULT 1,
  snapshot     JSONB NOT NULL,     -- полный слепок планов на момент сохранения
  created_at   TIMESTAMPTZ DEFAULT now(),
  note         TEXT,                -- "Увеличил план после акции"
  UNIQUE(user_id, month, version)
);
ALTER TABLE mp_plan_versions ENABLE ROW LEVEL SECURITY;
```

### 4.4 Шаблоны планов (Phase 3)

```sql
CREATE TABLE mp_plan_templates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id),
  name         TEXT NOT NULL,       -- "Стандартный месяц", "Сезон распродаж"
  template     JSONB NOT NULL,      -- { products: [{product_id, revenue, profit, units}] }
  created_at   TIMESTAMPTZ DEFAULT now()
);
```

### 4.5 Оптимизация completion-запроса

Текущий `GET /sales-plan/completion` выполняет **4 отдельных запроса** к Supabase:
1. SELECT mp_sales_plan_summary
2. SELECT mp_sales_plan
3. SELECT mp_sales (actual revenue)
4. Вычисление в Python

**Рекомендация — RPC (Supabase function):**

```sql
CREATE OR REPLACE FUNCTION plan_completion(
  p_user_id UUID,
  p_date_from DATE,
  p_date_to DATE,
  p_marketplace TEXT DEFAULT 'all'
) RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  -- Один запрос вместо 4
  WITH plan_data AS (
    SELECT ... FROM mp_sales_plan_summary
    UNION ALL
    SELECT ... FROM mp_sales_plan
  ),
  actual_data AS (
    SELECT ... FROM mp_sales
  )
  SELECT json_build_object(
    'total_plan', ...,
    'total_actual', ...,
    'completion_pct', ...,
    'by_marketplace', ...,
    'by_product', ...
  ) INTO result
  FROM plan_data
  JOIN actual_data ON ...;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Выигрыш**: 4 round-trips → 1. При 100+ SKU разница существенная.

### 4.6 Миграционная стратегия

```
Phase 1 (backward-compatible):
  018_extend_sales_plan.sql — добавить колонки plan_profit, plan_units, plan_ad_spend
  → Все текущие запросы продолжают работать (новые колонки = NULL)
  → Фронт постепенно начинает использовать новые поля

Phase 2 (новые фичи):
  019_plan_versions.sql — версионность
  020_plan_templates.sql — шаблоны

Phase 3 (оптимизация):
  021_plan_completion_rpc.sql — RPC-функция для completion
  → Замена 4 запросов на 1
```

---

## 5. ПРОДУКТОВЫЙ АНАЛИТИК — Связки и зависимости

### 5.1 Персоны пользователей

| Персона | SKU | Потребности | Приоритет фич |
|---------|-----|-------------|---------------|
| **Начинающий** (5-20 SKU) | 5-20 | Простой план, авто-подсказки | Auto-suggest, Templates |
| **Средний** (20-100 SKU) | 20-100 | Групповое планирование, stock-aware | Stock alerts, MP breakdown |
| **Enterprise** (100-1000 SKU) | 100+ | Массовый импорт, агрегация | Bulk edit, Categories, API |

### 5.2 Шесть критических связок

#### Связка 1: План ↔ Остатки (STOCK-AWARE PLANNING) — P0

```
Формула: days_to_plan = plan_units_remaining / avg_daily_sales
Alert: IF stock_days < days_to_plan THEN "Запас не хватит для выполнения плана"

Пример:
  План на февраль: 500 штук Магний+В6
  Продано за 18 дней: 340 штук
  Осталось по плану: 160 штук
  Остаток на складе: 120 штук
  Avg daily: 19 шт/день
  Дней запаса: 6.3 дня
  Дней до конца месяца: 10

  ⚠ ALERT: "Магний+В6: запас на 6 дней, но до конца месяца 10 дней.
            Нужно 40 доп. единиц для выполнения плана"
```

**Это конкурентное преимущество #1.** Ни один маркетплейс-инструмент этого не делает.

#### Связка 2: План ↔ Реклама (AD BUDGET PLANNING) — P1

```
Формула: required_ad_spend = (plan_revenue - organic_forecast) / ROAS
DRR target: plan_ad_spend / plan_revenue × 100%

Пример:
  План выручки: 1M
  Органический прогноз: 700K
  Нужно "добрать" рекламой: 300K
  Текущий ROAS: 5.0
  Нужный рекл. бюджет: 300K / 5.0 = 60K
  DRR план: 60K / 1M = 6%
```

#### Связка 3: План ↔ UE (PROFIT PLANNING) — P0

```
Формула: plan_profit = plan_revenue × target_margin%
         target_margin = historical_margin × (1 + improvement_target)

Пример:
  План выручки: 1M
  Историческая маржа: 18%
  Целевая маржа: 20% (+2% за счёт оптимизации)
  План прибыли: 1M × 20% = 200K
```

#### Связка 4: План ↔ Ценообразование — P2

```
Если avg_check падает → план по штукам растёт → нужно больше остатков
Мониторить: actual_avg_check vs planned_avg_check
Alert: "Средний чек упал на 8%. Для выполнения плана нужно на 9% больше продаж"
```

#### Связка 5: План ↔ Сезонность — P2

```
Коэффициенты из истории:
  Январь: 0.7x (спад после НГ)
  Февраль: 0.85x
  Март: 1.1x (8 марта)
  ...
  Ноябрь: 1.4x (Black Friday)
  Декабрь: 1.5x (НГ)

Auto-suggest: plan_next_month = avg_last_3_months × season_coef
```

#### Связка 6: План ↔ План (MoM/YoY comparison) — P1

```
MoM growth: (plan_feb - plan_jan) / plan_jan × 100%
YoY growth: (plan_feb_2026 - plan_feb_2025) / plan_feb_2025 × 100%
Plan accuracy: 1 - |actual - plan| / plan (за предыдущие месяцы)
```

### 5.3 ICE-приоритизация фич

| # | Фича | Impact | Confidence | Ease | ICE Score |
|---|------|--------|------------|------|-----------|
| 1 | **Stock Alert в плане** | 9 | 8 | 9 | **648** |
| 2 | **Plan Variance (MoM)** | 8 | 10 | 8 | **640** |
| 3 | **Profit plan** (plan_profit column) | 9 | 9 | 7 | **567** |
| 4 | **Copy Plan** (шаблон из прошлого месяца) | 7 | 9 | 8 | **504** |
| 5 | **Cumulative chart** | 8 | 9 | 7 | **504** |
| 6 | **Units plan** (plan_units column) | 7 | 8 | 8 | **448** |
| 7 | **Auto-suggest** (avg × coef) | 8 | 7 | 7 | **392** |
| 8 | **Ad budget plan** | 7 | 7 | 6 | **294** |
| 9 | **Quarterly/Yearly** | 6 | 8 | 5 | **240** |
| 10 | **Plan templates** | 5 | 7 | 6 | **210** |
| 11 | **Plan versions** | 4 | 7 | 5 | **140** |

---

## 6. КОНСЕНСУС ЭКСПЕРТОВ — Roadmap

### Phase 1: Quick Wins (1-2 дня)

**Цель**: Расширить метрики + связать с остатками

1. **DB migration 018**: `ALTER TABLE` — добавить `plan_profit`, `plan_units`, `plan_ad_spend`
2. **Stock Alert в плане**: Показать предупреждение если `stock_days < days_remaining_in_month`
3. **Copy Plan**: Кнопка "Скопировать из прошлого месяца" в SalesPlanEditor
4. **Plan Variance**: Badge с % изменения vs прошлый месяц

### Phase 2: Отдельная страница (2-3 дня)

**Цель**: Dedicated `/planning` page с enterprise UI

5. **Страница `/planning`**: Вынести из Settings, добавить в навигацию
6. **Cumulative chart**: Факт vs План vs Прогноз (line chart)
7. **Gauge meters**: Визуальные progress gauges для общего плана
8. **Расширенная таблица товаров**: Все 3 метрики (выручка, прибыль, штуки)
9. **MP breakdown**: Per-marketplace прогресс с сравнением vs прошлый месяц

### Phase 3: Smart Features (3-5 дней)

**Цель**: Автоматизация и аналитика

10. **Auto-suggest**: `avg(last_3_months) × season_coef` с возможностью override
11. **Profit planning**: Задать target_margin% → автоматический plan_profit
12. **Ad budget planning**: ROAS-based расчёт бюджета для "добора" плана
13. **Plan versions**: Snapshot при каждом сохранении
14. **Quarter/Year view**: Агрегация месячных планов

### Phase 4: Notifications & Alerts (1-2 дня)

15. **Stock-plan alerts**: "Запас не хватит для плана — закажите поставку"
16. **Pace alerts**: "Темп ниже плана на 15% — нужно 28K/день вместо 24K/день"
17. **Completion celebration**: Confetti при 100%, push если >90%

---

## 7. АРХИТЕКТУРНЫЕ РЕШЕНИЯ (для CLAUDE.md)

### Предлагаемые новые правила:

```
30. Sales Plan Enterprise: отдельная страница /planning (НЕ в Settings).
    3 метрики: revenue + profit + units (columnar, НЕ EAV/JSON).
    Stock-aware alerts через days_remaining vs plan_remaining.

31. Plan Completion: 3-уровневый приоритет (total > MP > product).
    Факт ТОЛЬКО за месяцы с планом. RPC-оптимизация при 50+ SKU.

32. Plan Versions: immutable snapshots в JSONB.
    Каждое сохранение = новая версия. Rollback через восстановление snapshot.
```

---

## 8. ВОПРОСЫ ДЛЯ ОБСУЖДЕНИЯ

1. **Отдельная страница vs улучшение текущего?**
   - Отдельная `/planning` page (рекомендация экспертов)
   - Или оставить в Settings + расширить Dashboard widget?

2. **Какие метрики в первую очередь?**
   - Profit plan (все эксперты согласны — P0)
   - Units plan (операционная метрика)
   - Ad budget plan (связка с рекламой)

3. **Stock-aware planning — насколько глубоко?**
   - Минимум: предупреждение "запас не хватит"
   - Максимум: автоматический расчёт необходимой поставки + интеграция с закупками

4. **Горизонт планирования?**
   - Только месяц (текущее) vs Квартал/Год (расширение)
   - Auto-rollup: годовой план = Σ месячных планов

5. **Auto-suggest — формула?**
   - Простая: `avg(last_3_months) × growth_10%`
   - С сезонностью: `avg(last_3_months) × season_coef`
   - ML (будущее): тренд + сезонность + внешние факторы
