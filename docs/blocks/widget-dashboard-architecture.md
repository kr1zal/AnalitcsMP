# Widget Dashboard Architecture — Customizable Metric Cards

> Архитектурный документ: замена фиксированного grid 4x2 на кастомизируемую систему виджетов с drag & drop.
>
> Дата: 2026-02-21 | Статус: ПРОЕКТ (не реализовано)

---

## Содержание

1. [Проблема и мотивация](#1-проблема-и-мотивация)
2. [Каталог виджетов (24 штуки)](#2-каталог-виджетов)
3. [Cross-Axis Solution](#3-cross-axis-solution)
4. [Техническая архитектура](#4-техническая-архитектура)
5. [Grid System](#5-grid-system)
6. [Миграция с текущего layout](#6-миграция-с-текущего-layout)
7. [Реализация по фазам](#7-реализация-по-фазам)

---

## 1. Проблема и мотивация

### 1.1 Текущее состояние

Фиксированный grid `grid-cols-2 lg:grid-cols-4` из 8 карточек (`SummaryCard`) в `DashboardPage.tsx`. Порядок и набор захардкожены. Пользователь не может:

- Выбирать, какие метрики показывать
- Менять порядок карточек
- Добавлять новые метрики (средний чек, конверсия, возвраты и т.д.)
- Видеть больше 8 метрик одновременно

### 1.2 Cross-Axis Problem (Ozon)

**Критическая проблема**: текущие 8 карточек смешивают данные из РАЗНЫХ осей:

| Карточка | Источник | Ось |
|----------|---------|------|
| Заказы | `get_dashboard_summary` RPC → `mp_sales` | ORDER (дата заказа) |
| Выкупы | `costs-tree` RPC → `mp_costs_details` | SETTLEMENT (дата фин. операции) |
| Себестоимость | RPC `purchase_price * sales_count` → `mp_sales` | ORDER |
| Чистая прибыль | `payout - purchase - ads` (mixed) | MIXED |
| Удержания МП | `costs-tree` → `mp_costs_details` | SETTLEMENT |
| Реклама | `mp_ad_costs` | AD DATE |
| К перечислению | `costs-tree` → `total_accrued` | SETTLEMENT |
| Рентабельность | computed from mixed sources | MIXED |

**WB**: ORDER и SETTLEMENT совпадают (±1 день). Проблемы нет.
**Ozon**: ORDER (дата заказа покупателя) и SETTLEMENT (дата финансовой операции) могут расходиться на 7-30 дней. Прибыль может показывать абсурдные значения (profit > revenue) при коротких периодах.

### 1.3 Решение

Виджетная система, где каждый виджет:
- Явно помечен своим источником данных (ORDER / SETTLEMENT / CALCULATED)
- Имеет tooltip с объяснением оси
- Пользователь сам выбирает набор — можно показать ТОЛЬКО order-based ИЛИ ТОЛЬКО settlement-based
- Группировка по категориям помогает не смешивать оси

---

## 2. Каталог виджетов

### 2.1 Продажи (Sales) — ORDER-based

Источник: RPC `get_dashboard_summary` → таблица `mp_sales` (дата заказа покупателя).

| # | ID | Название (RU) | Формула | Текущий | Default | Тариф | Ось Ozon |
|---|-----|--------------|---------|---------|---------|-------|----------|
| 1 | `orders_count` | Заказы | `summary.orders` (шт) | **Да** (card 1) | Yes | Free | ORDER: дата заказа |
| 2 | `orders_revenue` | Сумма заказов | `summary.revenue` (руб) | secondaryValue card 1 | Yes | Free | ORDER: дата заказа |
| 3 | `sales_count` | Выкупы (шт) | `summary.sales` (шт) | secondaryValue card 2 | No | Free | ORDER: дата заказа |
| 4 | `returns_count` | Возвраты | `summary.returns` (шт) | subtitle card 1 | No | Free | ORDER: дата заказа |
| 5 | `buyout_percent` | Процент выкупа | `sales / orders * 100%` | secondaryValue card 2 | No | Free | ORDER: дата заказа |
| 6 | `avg_check` | Средний чек | `summary.avg_check` | Нет (был AvgCheckChart) | No | Free | ORDER: дата заказа |
| 7 | `purchase_costs` | Себестоимость | `purchase_price * sales_count` (RPC) | **Да** (card 3) | Yes | Free | ORDER: purchase привязан к дате заказа |

### 2.2 Финансы (Finance) — SETTLEMENT-based

Источник: RPC `get_costs_tree` → таблица `mp_costs_details` (дата финансовой операции МП).

| # | ID | Название (RU) | Формула | Текущий | Default | Тариф | Ось Ozon |
|---|-----|--------------|---------|---------|---------|-------|----------|
| 8 | `revenue_settled` | Выкупы (₽) | `costs_tree_sales + credits` | **Да** (card 2) | Yes | Free | SETTLEMENT: дата фин. операции |
| 9 | `payout` | К перечислению | `total_accrued` | **Да** (card 7) | Yes | Free | SETTLEMENT |
| 10 | `mp_deductions` | Удержания МП | `SUM(negative tree items)` | **Да** (card 5) | Yes | Free | SETTLEMENT |
| 11 | `net_profit` | Чистая прибыль | `payout - purchase - ads` | **Да** (card 4) | Yes | Free | MIXED: payout=SETTL, purchase=ORDER, ads=AD |
| 12 | `profit_margin` | Маржинальность | `net_profit / revenue_settled * 100%` | **Да** (card 8, alt) | Yes | Free | MIXED |
| 13 | `mp_commission` | Комиссия МП | `tree["Вознаграждение..."].amount` | Нет (в subtitle) | No | Pro | SETTLEMENT |
| 14 | `mp_logistics` | Логистика | `tree["Услуги доставки"].amount` | Нет (в subtitle) | No | Pro | SETTLEMENT |
| 15 | `mp_storage` | Хранение | `tree["Стоимость хранения"].amount` | Нет | No | Pro | SETTLEMENT |

### 2.3 Реклама (Ads) — AD-DATE-based

Источник: `mp_ad_costs` (дата расхода рекламного бюджета).

| # | ID | Название (RU) | Формула | Текущий | Default | Тариф | Ось Ozon |
|---|-----|--------------|---------|---------|---------|-------|----------|
| 16 | `ad_cost` | Реклама | `summary.ad_cost` | **Да** (card 6) | Yes | Free | AD DATE |
| 17 | `drr` | ДРР | `ad_cost / revenue * 100%` | secondaryValue card 6 | Yes | Free | AD / SETTLEMENT mix |
| 18 | `acos` | ACOS | `ad_cost / ad_revenue * 100%` | Нет | No | Pro | AD DATE |
| 19 | `cpo` | CPO (стоим. заказа) | `ad_cost / ad_orders` | Нет | No | Pro | AD DATE |

### 2.4 Остатки (Stocks) — NEUTRAL (текущее состояние)

Источник: `mp_stocks` (текущие остатки на складах, не привязаны к периоду).

| # | ID | Название (RU) | Формула | Текущий | Default | Тариф | Ось Ozon |
|---|-----|--------------|---------|---------|---------|-------|----------|
| 20 | `stock_total` | Остатки (шт) | `SUM(stocks.total_quantity)` | Нет | No | Free | NEUTRAL: текущее состояние |
| 21 | `stock_forecast_avg` | Ср. запас дней | `AVG(days_remaining)` | Нет (в StockForecastChart header) | No | Free | NEUTRAL |
| 22 | `oos_count` | Товары OOS | `COUNT(qty == 0)` | Нет | No | Free | NEUTRAL |

### 2.5 План (Plan) — CALCULATED

Источник: `mp_sales_plan` + `mp_sales_plan_summary` (план задан пользователем).

| # | ID | Название (RU) | Формула | Текущий | Default | Тариф | Ось Ozon |
|---|-----|--------------|---------|---------|---------|-------|----------|
| 23 | `plan_completion` | Выполнение плана | `total_actual / total_plan * 100%` | Нет (PlanCompletionCard) | No | Pro | MIXED (actual = settlement) |

### 2.6 Динамика (Delta) — CALCULATED

Источник: `previous_period` из `get_dashboard_summary`.

| # | ID | Название (RU) | Формула | Текущий | Default | Тариф | Ось Ozon |
|---|-----|--------------|---------|---------|---------|-------|----------|
| 24 | `period_delta` | Δ к пред. периоду | `(current - prev) / prev * 100%` | **Да** (card 8) | Yes | Pro | Зависит от базовой метрики |

### 2.7 Сводная таблица: текущие 8 карточек → виджеты

| Текущая карточка | Виджет(ы) |
|-----------------|-----------|
| Card 1: Заказы | `orders_count` + `orders_revenue` (secondary) |
| Card 2: Выкупы | `revenue_settled` + `sales_count` + `buyout_percent` (secondary) |
| Card 3: Себестоимость | `purchase_costs` |
| Card 4: Чистая прибыль | `net_profit` + `profit_margin` (secondary) |
| Card 5: Удержания МП | `mp_deductions` |
| Card 6: Реклама | `ad_cost` + `drr` (secondary) |
| Card 7: К перечислению | `payout` |
| Card 8: Δ / Рентабельность | `period_delta` OR `profit_margin` |

---

## 3. Cross-Axis Solution

### 3.1 Как виджетная система решает проблему

**До (фиксированный layout):**
```
┌─────────┬─────────┬─────────┬─────────┐
│ Заказы  │ Выкупы  │ Себест. │ Прибыль │  ← ORDER + SETTLEMENT перемешаны
│ ORDER   │ SETTL.  │ ORDER   │ MIXED   │  ← пользователь не знает
└─────────┴─────────┴─────────┴─────────┘
```

**После (виджетная система):**
```
┌─────────────────────────────────────────┐
│ Каждый виджет имеет badge оси:          │
│                                         │
│ ┌──────────────┐  ┌──────────────┐      │
│ │ 📊 Заказы    │  │ 📊 Выкупы ₽  │      │
│ │ ORDER-based  │  │ SETTLEMENT   │      │
│ │ ≡ Аналитика  │  │ ≡ Финотчёт   │      │
│ └──────────────┘  └──────────────┘      │
│                                         │
│ Группировка в настройках:               │
│ ☑ ПРОДАЖИ (order)                       │
│   ☑ Заказы  ☑ Сумма заказов  ☑ Себест. │
│ ☑ ФИНАНСЫ (settlement)                  │
│   ☑ Выкупы  ☑ Перечисление  ☑ Удержан. │
│ ☑ РЕКЛАМА (ad-date)                     │
│   ☑ Реклама  ☑ ДРР                     │
└─────────────────────────────────────────┘
```

### 3.2 Axis Badge Component

Каждый виджет показывает маленький badge в header (опционально, toggle в настройках):

```tsx
type DataAxis = 'order' | 'settlement' | 'ad' | 'neutral' | 'calculated' | 'mixed';

const AXIS_META: Record<DataAxis, { label: string; color: string; tooltip: string }> = {
  order:      { label: '📊',  color: 'text-blue-500',    tooltip: 'Данные по дате заказа (аналитика МП)' },
  settlement: { label: '💰',  color: 'text-emerald-500', tooltip: 'Данные по дате фин. операции (финотчёт МП)' },
  ad:         { label: '📢',  color: 'text-violet-500',  tooltip: 'Данные по дате рекламного расхода' },
  neutral:    { label: '📦',  color: 'text-gray-400',    tooltip: 'Текущее состояние (не привязано к периоду)' },
  calculated: { label: '🔢',  color: 'text-amber-500',   tooltip: 'Расчётная метрика на основе других данных' },
  mixed:      { label: '⚡',  color: 'text-orange-500',  tooltip: 'Смешанные оси: прибыль = settlement - order' },
};
```

### 3.3 Ozon-специфичное предупреждение

При `marketplace === 'ozon'` и наличии виджетов с разными осями — показывать info-banner:

```
ℹ️ Ozon: «Заказы» и «Выкупы» показывают данные из разных источников.
   Заказы — по дате заказа, Выкупы — по дате фин. операции.
   Для коротких периодов (7д) значения могут отличаться от ЛК.
```

---

## 4. Техническая архитектура

### 4.1 Supabase Table: `user_dashboard_config`

```sql
-- Миграция 021_user_dashboard_config.sql
CREATE TABLE IF NOT EXISTS user_dashboard_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Layout: ordered list of enabled widget IDs
    -- Example: ["orders_count","revenue_settled","net_profit","ad_cost"]
    enabled_widgets JSONB NOT NULL DEFAULT '["orders_count","orders_revenue","revenue_settled","purchase_costs","net_profit","mp_deductions","ad_cost","payout"]'::jsonb,

    -- Grid layout positions (for @dnd-kit persistence)
    -- Example: [{"id":"orders_count","x":0,"y":0,"w":1,"h":1}, ...]
    layout JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- User preferences
    column_count INTEGER NOT NULL DEFAULT 4 CHECK (column_count BETWEEN 2 AND 6),
    show_axis_badges BOOLEAN NOT NULL DEFAULT false,
    compact_mode BOOLEAN NOT NULL DEFAULT false,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT user_dashboard_config_user_unique UNIQUE (user_id)
);

-- RLS
ALTER TABLE user_dashboard_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own config"
    ON user_dashboard_config FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own config"
    ON user_dashboard_config FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own config"
    ON user_dashboard_config FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Index
CREATE INDEX idx_user_dashboard_config_user ON user_dashboard_config(user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_dashboard_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_dashboard_config_updated
    BEFORE UPDATE ON user_dashboard_config
    FOR EACH ROW EXECUTE FUNCTION update_dashboard_config_timestamp();
```

### 4.2 Widget Registry

Центральный реестр виджетов — единый источник правды для метаданных, компонентов и data-fetching.

```tsx
// frontend/src/components/Dashboard/widgets/registry.ts

import type { LucideIcon } from 'lucide-react';
import type { CardAccent } from '../SummaryCard';

export type DataAxis = 'order' | 'settlement' | 'ad' | 'neutral' | 'calculated' | 'mixed';
export type WidgetCategory = 'sales' | 'finance' | 'ads' | 'stocks' | 'plan' | 'delta';
export type WidgetTier = 'free' | 'pro';
export type WidgetSize = '1x1' | '2x1' | '1x2'; // standard | wide | tall

export interface WidgetDefinition {
  /** Уникальный ID виджета */
  id: string;
  /** Название на русском */
  title: string;
  /** Сокращённое название для мобильных */
  mobileTitle?: string;
  /** Категория для группировки в настройках */
  category: WidgetCategory;
  /** Ось данных (для cross-axis transparency) */
  axis: DataAxis;
  /** Tooltip: описание формулы и источника данных */
  tooltipLines: string[];
  /** Иконка Lucide */
  icon: LucideIcon;
  /** Цветовая схема */
  accent: CardAccent;
  /** Формат отображения значения */
  format: 'currency' | 'number' | 'percent' | 'custom';
  /** Включён по умолчанию для новых пользователей */
  defaultEnabled: boolean;
  /** Минимальный тариф */
  tier: WidgetTier;
  /** Размер виджета (default 1x1) */
  defaultSize: WidgetSize;
  /**
   * Data dependencies: какие React Query hooks нужны.
   * Widget container загружает данные ТОЛЬКО для enabled виджетов.
   */
  dataDeps: WidgetDataDep[];
}

/**
 * Перечисление зависимостей данных.
 * Каждая соответствует одному React Query hook.
 */
export type WidgetDataDep =
  | 'summary'        // useDashboardSummaryWithPrev
  | 'costsTreeOzon'  // useCostsTree({marketplace: 'ozon'})
  | 'costsTreeWb'    // useCostsTree({marketplace: 'wb'})
  | 'unitEconomics'  // useUnitEconomics
  | 'adCosts'        // useAdCosts
  | 'stocks'         // useStocks
  | 'planCompletion' // useSalesPlanCompletion
  | 'products';      // useProducts

/** Category metadata for settings UI */
export const WIDGET_CATEGORIES: Record<WidgetCategory, {
  label: string;
  description: string;
  axisNote?: string;
}> = {
  sales:   { label: 'Продажи',       description: 'Метрики заказов и выкупов', axisNote: 'Данные по дате заказа (order-based)' },
  finance: { label: 'Финансы',       description: 'Расчёты из финансового отчёта МП', axisNote: 'Данные по дате фин. операции (settlement-based)' },
  ads:     { label: 'Реклама',       description: 'Рекламные расходы и эффективность', axisNote: 'Данные по дате расхода' },
  stocks:  { label: 'Остатки',       description: 'Текущее состояние склада' },
  plan:    { label: 'План продаж',   description: 'Выполнение плана' },
  delta:   { label: 'Динамика',      description: 'Сравнение с предыдущим периодом' },
};
```

### 4.3 Widget Definitions (полный список 24 виджетов)

```tsx
// frontend/src/components/Dashboard/widgets/definitions.ts

import {
  ShoppingBag, ShoppingCart, Package, DollarSign, Receipt,
  Megaphone, Banknote, TrendingUp, BarChart3, Percent,
  Truck, Warehouse, Target, PackageX, Calculator,
  MousePointerClick, CreditCard, RotateCcw, PieChart,
  Boxes, CalendarClock, AlertTriangle
} from 'lucide-react';
import type { WidgetDefinition } from './registry';

export const WIDGET_DEFINITIONS: WidgetDefinition[] = [
  // ═══════════════════════════════════════════
  // ПРОДАЖИ (ORDER-BASED)
  // ═══════════════════════════════════════════
  {
    id: 'orders_count',
    title: 'Заказы',
    category: 'sales',
    axis: 'order',
    tooltipLines: [
      'Все заказы за период (вкл. непроведённые).',
      'Источник: mp_sales (аналитика МП).',
    ],
    icon: ShoppingBag,
    accent: 'indigo',
    format: 'number',
    defaultEnabled: true,
    tier: 'free',
    defaultSize: '1x1',
    dataDeps: ['summary'],
  },
  {
    id: 'orders_revenue',
    title: 'Сумма заказов',
    mobileTitle: 'Заказы ₽',
    category: 'sales',
    axis: 'order',
    tooltipLines: [
      'Сумма всех заказов за период (order-based).',
      'Может отличаться от «Выкупы» — здесь ВСЕ заказы,',
      'включая непроведённые и возвраты.',
    ],
    icon: ShoppingCart,
    accent: 'indigo',
    format: 'currency',
    defaultEnabled: true,
    tier: 'free',
    defaultSize: '1x1',
    dataDeps: ['summary'],
  },
  {
    id: 'sales_count',
    title: 'Выкупы (шт)',
    category: 'sales',
    axis: 'order',
    tooltipLines: [
      'Количество выкупленных единиц.',
      'Выкупы = Заказы − Возвраты − Отмены.',
    ],
    icon: ShoppingCart,
    accent: 'emerald',
    format: 'number',
    defaultEnabled: false,
    tier: 'free',
    defaultSize: '1x1',
    dataDeps: ['summary'],
  },
  {
    id: 'returns_count',
    title: 'Возвраты',
    category: 'sales',
    axis: 'order',
    tooltipLines: [
      'Количество возвратов за период.',
      'Процент возвратов = returns / orders * 100%.',
    ],
    icon: RotateCcw,
    accent: 'red',
    format: 'number',
    defaultEnabled: false,
    tier: 'free',
    defaultSize: '1x1',
    dataDeps: ['summary'],
  },
  {
    id: 'buyout_percent',
    title: 'Процент выкупа',
    mobileTitle: 'Выкуп %',
    category: 'sales',
    axis: 'order',
    tooltipLines: [
      'Доля выкупленных заказов.',
      '= Выкупы / Заказы * 100%',
    ],
    icon: Percent,
    accent: 'emerald',
    format: 'percent',
    defaultEnabled: false,
    tier: 'free',
    defaultSize: '1x1',
    dataDeps: ['summary'],
  },
  {
    id: 'avg_check',
    title: 'Средний чек',
    category: 'sales',
    axis: 'order',
    tooltipLines: [
      'Средняя сумма заказа.',
      '= Сумма заказов / Количество заказов',
    ],
    icon: Calculator,
    accent: 'indigo',
    format: 'currency',
    defaultEnabled: false,
    tier: 'free',
    defaultSize: '1x1',
    dataDeps: ['summary'],
  },
  {
    id: 'purchase_costs',
    title: 'Себестоимость',
    mobileTitle: 'Закупка',
    category: 'sales',
    axis: 'order',
    tooltipLines: [
      'Себестоимость реализованных товаров (COGS).',
      '= Закупочная цена * Кол-во выкупов (order-based).',
      'Закупочные цены задаются в Настройки → Товары.',
    ],
    icon: Package,
    accent: 'amber',
    format: 'currency',
    defaultEnabled: true,
    tier: 'free',
    defaultSize: '1x1',
    dataDeps: ['summary', 'unitEconomics'],
  },

  // ═══════════════════════════════════════════
  // ФИНАНСЫ (SETTLEMENT-BASED)
  // ═══════════════════════════════════════════
  {
    id: 'revenue_settled',
    title: 'Выкупы (₽)',
    mobileTitle: 'Выручка',
    category: 'finance',
    axis: 'settlement',
    tooltipLines: [
      'Выручка из финансового отчёта МП (проведённые).',
      '= tree["Продажи"] + credits (СПП, возмещения).',
      'Может отличаться от «Аналитики» в ЛК —',
      'там учтены все заказы, вкл. непроведённые.',
    ],
    icon: ShoppingCart,
    accent: 'emerald',
    format: 'currency',
    defaultEnabled: true,
    tier: 'free',
    defaultSize: '1x1',
    dataDeps: ['costsTreeOzon', 'costsTreeWb'],
  },
  {
    id: 'payout',
    title: 'К перечислению',
    mobileTitle: 'Выплата',
    category: 'finance',
    axis: 'settlement',
    tooltipLines: [
      'Сумма к перечислению от маркетплейсов.',
      '= total_accrued (Выкупы − Удержания МП).',
      'Из финансового отчёта.',
    ],
    icon: Banknote,
    accent: 'sky',
    format: 'currency',
    defaultEnabled: true,
    tier: 'free',
    defaultSize: '1x1',
    dataDeps: ['costsTreeOzon', 'costsTreeWb'],
  },
  {
    id: 'mp_deductions',
    title: 'Удержания МП',
    mobileTitle: 'Удержания',
    category: 'finance',
    axis: 'settlement',
    tooltipLines: [
      'Удержания маркетплейса из финотчёта:',
      'Комиссия + Логистика + Хранение + Эквайринг + ...',
    ],
    icon: Receipt,
    accent: 'slate',
    format: 'currency',
    defaultEnabled: true,
    tier: 'free',
    defaultSize: '1x1',
    dataDeps: ['costsTreeOzon', 'costsTreeWb'],
  },
  {
    id: 'net_profit',
    title: 'Чистая прибыль',
    mobileTitle: 'Прибыль',
    category: 'finance',
    axis: 'mixed',
    tooltipLines: [
      'Чистая прибыль = К перечисл. − Себестоимость − Реклама.',
      '⚠ Смешанные оси: payout (settlement) − purchase (order) − ads.',
      'Для Ozon на коротких периодах может быть неточной.',
    ],
    icon: DollarSign,
    accent: 'emerald',
    format: 'currency',
    defaultEnabled: true,
    tier: 'free',
    defaultSize: '1x1',
    dataDeps: ['summary', 'costsTreeOzon', 'costsTreeWb', 'unitEconomics'],
  },
  {
    id: 'profit_margin',
    title: 'Маржинальность',
    mobileTitle: 'Маржа %',
    category: 'finance',
    axis: 'mixed',
    tooltipLines: [
      'Рентабельность по чистой прибыли.',
      '= Чистая прибыль / Выкупы * 100%.',
    ],
    icon: TrendingUp,
    accent: 'emerald',
    format: 'percent',
    defaultEnabled: true,
    tier: 'free',
    defaultSize: '1x1',
    dataDeps: ['summary', 'costsTreeOzon', 'costsTreeWb', 'unitEconomics'],
  },
  {
    id: 'mp_commission',
    title: 'Комиссия МП',
    mobileTitle: 'Комиссия',
    category: 'finance',
    axis: 'settlement',
    tooltipLines: [
      'Комиссия маркетплейса из costs-tree.',
      'WB: «Вознаграждение Вайлдберриз (ВВ)».',
      'Ozon: «Вознаграждение Ozon».',
    ],
    icon: CreditCard,
    accent: 'slate',
    format: 'currency',
    defaultEnabled: false,
    tier: 'pro',
    defaultSize: '1x1',
    dataDeps: ['costsTreeOzon', 'costsTreeWb'],
  },
  {
    id: 'mp_logistics',
    title: 'Логистика',
    category: 'finance',
    axis: 'settlement',
    tooltipLines: [
      'Расходы на доставку из costs-tree.',
      'WB: «Услуги по доставке товара покупателю».',
      'Ozon: «Услуги доставки».',
    ],
    icon: Truck,
    accent: 'slate',
    format: 'currency',
    defaultEnabled: false,
    tier: 'pro',
    defaultSize: '1x1',
    dataDeps: ['costsTreeOzon', 'costsTreeWb'],
  },
  {
    id: 'mp_storage',
    title: 'Хранение',
    category: 'finance',
    axis: 'settlement',
    tooltipLines: [
      'Расходы на хранение на складе МП.',
      'WB: «Стоимость хранения».',
      'Ozon: «Услуги FBO» (вкл. хранение).',
    ],
    icon: Warehouse,
    accent: 'slate',
    format: 'currency',
    defaultEnabled: false,
    tier: 'pro',
    defaultSize: '1x1',
    dataDeps: ['costsTreeOzon', 'costsTreeWb'],
  },

  // ═══════════════════════════════════════════
  // РЕКЛАМА (AD-DATE-BASED)
  // ═══════════════════════════════════════════
  {
    id: 'ad_cost',
    title: 'Реклама',
    category: 'ads',
    axis: 'ad',
    tooltipLines: [
      'Расходы на рекламу (все кампании суммарно):',
      'WB Продвижение + Ozon Performance.',
    ],
    icon: Megaphone,
    accent: 'violet',
    format: 'currency',
    defaultEnabled: true,
    tier: 'free',
    defaultSize: '1x1',
    dataDeps: ['summary'],
  },
  {
    id: 'drr',
    title: 'ДРР',
    category: 'ads',
    axis: 'mixed',
    tooltipLines: [
      'Доля рекламных расходов.',
      '= Реклама / Выкупы * 100%.',
      '⚠ Реклама = ad-date, Выкупы = settlement.',
    ],
    icon: PieChart,
    accent: 'violet',
    format: 'percent',
    defaultEnabled: true,
    tier: 'free',
    defaultSize: '1x1',
    dataDeps: ['summary', 'costsTreeOzon', 'costsTreeWb'],
  },
  {
    id: 'acos',
    title: 'ACOS',
    category: 'ads',
    axis: 'ad',
    tooltipLines: [
      'Advertising Cost of Sales.',
      '= Реклама / Рекламная выручка * 100%.',
      'Только рекламные заказы (не все продажи).',
    ],
    icon: MousePointerClick,
    accent: 'violet',
    format: 'percent',
    defaultEnabled: false,
    tier: 'pro',
    defaultSize: '1x1',
    dataDeps: ['adCosts'],
  },
  {
    id: 'cpo',
    title: 'CPO',
    category: 'ads',
    axis: 'ad',
    tooltipLines: [
      'Cost Per Order — стоимость рекламного заказа.',
      '= Расход рекламы / Кол-во рекламных заказов.',
    ],
    icon: MousePointerClick,
    accent: 'violet',
    format: 'currency',
    defaultEnabled: false,
    tier: 'pro',
    defaultSize: '1x1',
    dataDeps: ['adCosts'],
  },

  // ═══════════════════════════════════════════
  // ОСТАТКИ (NEUTRAL)
  // ═══════════════════════════════════════════
  {
    id: 'stock_total',
    title: 'Остатки (шт)',
    category: 'stocks',
    axis: 'neutral',
    tooltipLines: [
      'Общее количество единиц на складах.',
      'Текущее состояние (не привязано к периоду).',
    ],
    icon: Boxes,
    accent: 'sky',
    format: 'number',
    defaultEnabled: false,
    tier: 'free',
    defaultSize: '1x1',
    dataDeps: ['stocks'],
  },
  {
    id: 'stock_forecast_avg',
    title: 'Ср. запас дней',
    mobileTitle: 'Запас',
    category: 'stocks',
    axis: 'neutral',
    tooltipLines: [
      'Средний прогноз запаса в днях по всем товарам.',
      '= total_quantity / avg_daily_sales(30d).',
    ],
    icon: CalendarClock,
    accent: 'sky',
    format: 'number',
    defaultEnabled: false,
    tier: 'free',
    defaultSize: '1x1',
    dataDeps: ['stocks'],
  },
  {
    id: 'oos_count',
    title: 'Товары OOS',
    mobileTitle: 'OOS',
    category: 'stocks',
    axis: 'neutral',
    tooltipLines: [
      'Количество товаров с нулевым остатком.',
      'OOS = Out of Stock.',
    ],
    icon: AlertTriangle,
    accent: 'red',
    format: 'number',
    defaultEnabled: false,
    tier: 'free',
    defaultSize: '1x1',
    dataDeps: ['stocks'],
  },

  // ═══════════════════════════════════════════
  // ПЛАН (CALCULATED)
  // ═══════════════════════════════════════════
  {
    id: 'plan_completion',
    title: 'Выполнение плана',
    mobileTitle: 'План',
    category: 'plan',
    axis: 'calculated',
    tooltipLines: [
      'Процент выполнения плана продаж.',
      '= Факт / План * 100%.',
      'Факт = settlement-based (из финотчёта).',
    ],
    icon: Target,
    accent: 'indigo',
    format: 'percent',
    defaultEnabled: false,
    tier: 'pro',
    defaultSize: '1x1',
    dataDeps: ['planCompletion'],
  },

  // ═══════════════════════════════════════════
  // ДИНАМИКА (CALCULATED)
  // ═══════════════════════════════════════════
  {
    id: 'period_delta',
    title: 'Δ к пред. периоду',
    mobileTitle: 'Динамика',
    category: 'delta',
    axis: 'calculated',
    tooltipLines: [
      'Изменение выкупов относительно предыдущего периода.',
      'Доступно только для пресетов (7д/30д/90д).',
    ],
    icon: TrendingUp,
    accent: 'emerald',
    format: 'percent',
    defaultEnabled: true,
    tier: 'pro',
    defaultSize: '1x1',
    dataDeps: ['summary'],
  },
];

/** Quick lookup by widget ID */
export const WIDGET_MAP = new Map(
  WIDGET_DEFINITIONS.map(w => [w.id, w])
);

/** Default enabled widget IDs for new users (preserves current 8-card layout) */
export const DEFAULT_ENABLED_WIDGETS = WIDGET_DEFINITIONS
  .filter(w => w.defaultEnabled)
  .map(w => w.id);
// → ["orders_count","orders_revenue","purchase_costs","revenue_settled","payout",
//    "mp_deductions","net_profit","profit_margin","ad_cost","drr","period_delta"]
```

### 4.4 Zustand Store: `useDashboardLayoutStore`

```tsx
// frontend/src/store/useDashboardLayoutStore.ts

import { create } from 'zustand';

export interface WidgetPosition {
  id: string;   // widget ID from registry
  x: number;    // column (0-based)
  y: number;    // row (0-based)
  w: number;    // width in columns (1 or 2)
  h: number;    // height in rows (1 or 2)
}

interface DashboardLayoutState {
  /** Ordered list of enabled widget IDs */
  enabledWidgets: string[];
  /** Grid positions (optional — if empty, auto-layout from enabledWidgets order) */
  layout: WidgetPosition[];
  /** Number of columns (desktop) */
  columnCount: number;
  /** Show data-axis badges on widgets */
  showAxisBadges: boolean;
  /** Compact mode (smaller cards) */
  compactMode: boolean;
  /** Whether config has been loaded from server */
  isLoaded: boolean;
  /** Whether there are unsaved changes */
  isDirty: boolean;

  // Actions
  setConfig: (config: Partial<DashboardLayoutState>) => void;
  toggleWidget: (widgetId: string) => void;
  reorderWidgets: (fromIndex: number, toIndex: number) => void;
  setLayout: (layout: WidgetPosition[]) => void;
  setColumnCount: (count: number) => void;
  toggleAxisBadges: () => void;
  toggleCompactMode: () => void;
  markClean: () => void;
}

const DEFAULTS = {
  enabledWidgets: [
    'orders_count', 'orders_revenue', 'revenue_settled', 'purchase_costs',
    'net_profit', 'mp_deductions', 'ad_cost', 'payout',
    'drr', 'profit_margin', 'period_delta',
  ],
  layout: [] as WidgetPosition[],
  columnCount: 4,
  showAxisBadges: false,
  compactMode: false,
  isLoaded: false,
  isDirty: false,
};

export const useDashboardLayoutStore = create<DashboardLayoutState>((set) => ({
  ...DEFAULTS,

  setConfig: (config) => set((state) => ({
    ...state,
    ...config,
    isLoaded: true,
    isDirty: false,
  })),

  toggleWidget: (widgetId) => set((state) => {
    const enabled = state.enabledWidgets.includes(widgetId)
      ? state.enabledWidgets.filter(id => id !== widgetId)
      : [...state.enabledWidgets, widgetId];
    return { enabledWidgets: enabled, isDirty: true };
  }),

  reorderWidgets: (fromIndex, toIndex) => set((state) => {
    const updated = [...state.enabledWidgets];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    return { enabledWidgets: updated, isDirty: true };
  }),

  setLayout: (layout) => set({ layout, isDirty: true }),

  setColumnCount: (columnCount) => set({ columnCount, isDirty: true }),

  toggleAxisBadges: () => set((state) => ({
    showAxisBadges: !state.showAxisBadges,
    isDirty: true,
  })),

  toggleCompactMode: () => set((state) => ({
    compactMode: !state.compactMode,
    isDirty: true,
  })),

  markClean: () => set({ isDirty: false }),
}));
```

### 4.5 Persistence Hook: debounced save to Supabase

```tsx
// frontend/src/hooks/useDashboardConfig.ts

import { useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDashboardLayoutStore } from '../store/useDashboardLayoutStore';
import { dashboardApi } from '../services/api';

const SAVE_DEBOUNCE_MS = 1500;

export function useDashboardConfig() {
  const store = useDashboardLayoutStore();
  const queryClient = useQueryClient();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // 1. Load config from server on mount
  const { data: serverConfig, isLoading } = useQuery({
    queryKey: ['dashboard-config'],
    queryFn: () => dashboardApi.getDashboardConfig(),
    staleTime: 1000 * 60 * 30, // 30 min
  });

  // 2. Apply server config to Zustand store (once)
  useEffect(() => {
    if (serverConfig && !store.isLoaded) {
      store.setConfig({
        enabledWidgets: serverConfig.enabled_widgets,
        layout: serverConfig.layout,
        columnCount: serverConfig.column_count,
        showAxisBadges: serverConfig.show_axis_badges,
        compactMode: serverConfig.compact_mode,
      });
    }
  }, [serverConfig, store.isLoaded]);

  // 3. Mutation to save config
  const saveMutation = useMutation({
    mutationFn: (config: {
      enabled_widgets: string[];
      layout: unknown[];
      column_count: number;
      show_axis_badges: boolean;
      compact_mode: boolean;
    }) => dashboardApi.saveDashboardConfig(config),
    onSuccess: () => {
      store.markClean();
      queryClient.invalidateQueries({ queryKey: ['dashboard-config'] });
    },
  });

  // 4. Debounced auto-save on store changes
  const debouncedSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const state = useDashboardLayoutStore.getState();
      if (!state.isDirty || !state.isLoaded) return;
      saveMutation.mutate({
        enabled_widgets: state.enabledWidgets,
        layout: state.layout,
        column_count: state.columnCount,
        show_axis_badges: state.showAxisBadges,
        compact_mode: state.compactMode,
      });
    }, SAVE_DEBOUNCE_MS);
  }, [saveMutation]);

  // Watch for dirty state
  useEffect(() => {
    if (store.isDirty && store.isLoaded) {
      debouncedSave();
    }
  }, [store.isDirty, store.enabledWidgets, store.layout, store.columnCount, debouncedSave]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  return {
    isLoading,
    isSaving: saveMutation.isPending,
  };
}
```

### 4.6 Component Hierarchy

```
DashboardPage.tsx
├── FilterPanel (sticky, unchanged)
├── WidgetGrid                              ← NEW: replaces hardcoded 8 cards
│   ├── DndContext (@dnd-kit/core)
│   │   └── SortableContext (@dnd-kit/sortable)
│   │       └── WidgetCard[]                ← wraps SummaryCard + data resolver
│   │           ├── SortableItem (drag handle + dnd wrapper)
│   │           └── SummaryCard (existing, unchanged)
│   └── WidgetSettingsPanel                 ← slide-out or modal
│       ├── CategoryGroup[]
│       │   └── WidgetToggle[] (checkbox + preview)
│       ├── AxisBadgeToggle
│       ├── ColumnCountSlider
│       └── CompactModeToggle
├── PlanCompletionCard (unchanged)
├── MarketplaceBreakdown (unchanged)
├── Charts section (unchanged)
├── Analytics section (unchanged)
├── StockHistoryChart (unchanged)
└── StocksTable (unchanged)
```

### 4.7 WidgetGrid Component

```tsx
// frontend/src/components/Dashboard/WidgetGrid.tsx

import { useCallback, useMemo, useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Settings2 } from 'lucide-react';
import { useDashboardLayoutStore } from '../../store/useDashboardLayoutStore';
import { WIDGET_MAP, WIDGET_DEFINITIONS } from './widgets/definitions';
import { SummaryCard } from './SummaryCard';
import { WidgetSettingsPanel } from './WidgetSettingsPanel';

interface WidgetGridProps {
  /** Pre-computed widget values from DashboardPage */
  widgetValues: Record<string, WidgetValue>;
  /** Loading states per data dependency */
  loadingStates: Record<string, boolean>;
}

interface WidgetValue {
  value: number | string;
  secondaryValue?: string;
  subtitle?: string;
  warning?: string;
  change?: number;
  isPositive?: boolean;
  /** Override accent color (e.g., net_profit: emerald vs red) */
  accentOverride?: string;
}

// ── Sortable Widget Wrapper ──
function SortableWidget({
  id,
  widgetValue,
  loading,
  showAxisBadge,
  compact,
}: {
  id: string;
  widgetValue?: WidgetValue;
  loading: boolean;
  showAxisBadge: boolean;
  compact: boolean;
}) {
  const def = WIDGET_MAP.get(id);
  if (!def) return null;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div className="relative group">
        {/* Drag handle — visible on hover */}
        <div
          {...listeners}
          className="absolute -left-1 top-1/2 -translate-y-1/2 w-5 h-8
                     flex items-center justify-center cursor-grab
                     opacity-0 group-hover:opacity-100 transition-opacity
                     text-gray-300 hover:text-gray-500 z-10"
          aria-label="Перетащить"
        >
          <svg width="10" height="18" viewBox="0 0 10 18" fill="currentColor">
            <circle cx="2" cy="2" r="1.5" /><circle cx="8" cy="2" r="1.5" />
            <circle cx="2" cy="9" r="1.5" /><circle cx="8" cy="9" r="1.5" />
            <circle cx="2" cy="16" r="1.5" /><circle cx="8" cy="16" r="1.5" />
          </svg>
        </div>

        <SummaryCard
          title={def.title}
          mobileTitle={def.mobileTitle}
          value={widgetValue?.value ?? 0}
          format={def.format === 'custom' ? 'number' : def.format}
          secondaryValue={widgetValue?.secondaryValue}
          subtitle={widgetValue?.subtitle}
          tooltip={def.tooltipLines.join('\n')}
          icon={def.icon}
          accent={(widgetValue?.accentOverride as any) ?? def.accent}
          change={widgetValue?.change}
          isPositive={widgetValue?.isPositive}
          loading={loading}
          warning={widgetValue?.warning}
        />
      </div>
    </div>
  );
}

// ── Main WidgetGrid ──
export function WidgetGrid({ widgetValues, loadingStates }: WidgetGridProps) {
  const {
    enabledWidgets,
    columnCount,
    showAxisBadges,
    compactMode,
    reorderWidgets,
  } = useDashboardLayoutStore();

  const [settingsOpen, setSettingsOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIdx = enabledWidgets.indexOf(String(active.id));
    const toIdx = enabledWidgets.indexOf(String(over.id));
    if (fromIdx >= 0 && toIdx >= 0) {
      reorderWidgets(fromIdx, toIdx);
    }
  }, [enabledWidgets, reorderWidgets]);

  // Grid columns class
  const gridClass = useMemo(() => {
    const colMap: Record<number, string> = {
      2: 'grid-cols-2',
      3: 'grid-cols-2 lg:grid-cols-3',
      4: 'grid-cols-2 lg:grid-cols-4',
      5: 'grid-cols-2 lg:grid-cols-5',
      6: 'grid-cols-2 lg:grid-cols-6',
    };
    return colMap[columnCount] ?? 'grid-cols-2 lg:grid-cols-4';
  }, [columnCount]);

  // Determine loading per widget from dataDeps
  const isWidgetLoading = useCallback((widgetId: string) => {
    const def = WIDGET_MAP.get(widgetId);
    if (!def) return false;
    return def.dataDeps.some(dep => loadingStates[dep]);
  }, [loadingStates]);

  return (
    <>
      {/* Header with settings button */}
      <div className="flex items-center justify-end mb-2">
        <button
          onClick={() => setSettingsOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                     text-gray-500 hover:text-gray-700 hover:bg-gray-50
                     rounded-lg transition-colors"
          aria-label="Настроить виджеты"
        >
          <Settings2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Настроить</span>
        </button>
      </div>

      {/* Sortable grid */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={enabledWidgets} strategy={rectSortingStrategy}>
          <div className={`grid ${gridClass} gap-2.5 sm:gap-3 mb-4 sm:mb-5 lg:mb-6`}>
            {enabledWidgets.map((widgetId) => (
              <SortableWidget
                key={widgetId}
                id={widgetId}
                widgetValue={widgetValues[widgetId]}
                loading={isWidgetLoading(widgetId)}
                showAxisBadge={showAxisBadges}
                compact={compactMode}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Settings panel */}
      {settingsOpen && (
        <WidgetSettingsPanel onClose={() => setSettingsOpen(false)} />
      )}
    </>
  );
}
```

### 4.8 Widget Value Resolver

Мэппинг data -> widget values происходит в `DashboardPage.tsx`, чтобы не менять hook-архитектуру. Каждый виджет получает предвычисленное значение.

```tsx
// В DashboardPage.tsx, после всех hook вызовов:

const widgetValues: Record<string, WidgetValue> = useMemo(() => ({
  // SALES (ORDER-BASED)
  orders_count: {
    value: ordersCountForTile,
    secondaryValue: formatCurrency(ordersRevenueForTile),
    subtitle: returnsCountForTile > 0 ? `${returnsCountForTile} возвр.` : undefined,
    change: ordersChangePct,
  },
  orders_revenue: {
    value: ordersRevenueForTile,
    secondaryValue: `${ordersCountForTile} заказов`,
  },
  sales_count: {
    value: salesCountForTile,
    secondaryValue: `выкуп ${buyoutPercent}%`,
  },
  returns_count: {
    value: returnsCountForTile,
    secondaryValue: ordersCountForTile > 0
      ? `${Math.round((returnsCountForTile / ordersCountForTile) * 100)}% от заказов`
      : undefined,
    accentOverride: returnsCountForTile > 0 ? 'red' : 'slate',
  },
  buyout_percent: {
    value: `${buyoutPercent}%`,
    secondaryValue: `${salesCountForTile} из ${ordersCountForTile}`,
  },
  avg_check: {
    value: summary?.avg_check ?? 0,
    secondaryValue: `${ordersCountForTile} заказов`,
  },
  purchase_costs: {
    value: purchaseCostsForTile,
    secondaryValue: salesCountForTile > 0 ? `∅ ${formatCurrency(avgCcPerUnit)} / шт` : undefined,
    warning: ccWarning,
  },

  // FINANCE (SETTLEMENT-BASED)
  revenue_settled: {
    value: revenueForTile,
    secondaryValue: `${salesCountForTile} шт · выкуп ${buyoutPercent}%`,
    change: revenueChangePct,
  },
  payout: {
    value: payoutForTile ?? 0,
    subtitle: marketplace === 'all' && ozonCostsTreeData && wbCostsTreeData
      ? `Ozon ${formatNumber(Math.round(ozonCostsTreeData.total_accrued ?? 0))} · WB ${formatNumber(Math.round(wbCostsTreeData.total_accrued ?? 0))}`
      : undefined,
  },
  mp_deductions: {
    value: mpDeductionsForTile,
    subtitle: mpDeductionsSubtitle,
  },
  net_profit: {
    value: netProfitForTile,
    secondaryValue: revenueForTile > 0
      ? `маржа ${((netProfitForTile / revenueForTile) * 100).toFixed(1)}%`
      : 'маржа 0%',
    accentOverride: netProfitForTile >= 0 ? 'emerald' : 'red',
  },
  profit_margin: {
    value: revenueForTile > 0
      ? `${((netProfitForTile / revenueForTile) * 100).toFixed(1)}%`
      : '0%',
    secondaryValue: `на ${formatCurrency(revenueForTile)} выручки`,
    accentOverride: netProfitForTile >= 0 ? 'emerald' : 'red',
  },
  mp_commission: {
    value: extractTreeItemAmount(['Вознаграждение Ozon', 'Вознаграждение Вайлдберриз (ВВ)']),
  },
  mp_logistics: {
    value: extractTreeItemAmount(['Услуги доставки', 'Услуги по доставке товара покупателю']),
  },
  mp_storage: {
    value: extractTreeItemAmount(['Стоимость хранения', 'Услуги FBO']),
  },

  // ADS
  ad_cost: {
    value: adCostForTile,
    secondaryValue: `ДРР ${drrForTile}%`,
  },
  drr: {
    value: `${drrForTile}%`,
    secondaryValue: `${formatCurrency(adCostForTile)} реклама`,
  },
  acos: {
    value: adCostsData?.totals?.drr ?? 0,
    // Requires ad-specific revenue
  },
  cpo: {
    value: (adCostsData?.totals?.orders ?? 0) > 0
      ? (adCostsData?.totals?.ad_cost ?? 0) / (adCostsData?.totals?.orders ?? 1)
      : 0,
  },

  // STOCKS
  stock_total: {
    value: (stocksData?.stocks ?? []).reduce((acc, s) => acc + s.total_quantity, 0),
  },
  stock_forecast_avg: {
    value: Math.round(
      (stocksData?.stocks ?? [])
        .filter(s => s.days_remaining != null && s.barcode !== 'WB_ACCOUNT')
        .reduce((acc, s, _, arr) => acc + (s.days_remaining ?? 0) / arr.length, 0)
    ),
    secondaryValue: 'дней',
  },
  oos_count: {
    value: (stocksData?.stocks ?? []).filter(s => s.total_quantity === 0).length,
    accentOverride: (stocksData?.stocks ?? []).filter(s => s.total_quantity === 0).length > 0 ? 'red' : 'emerald',
  },

  // PLAN
  plan_completion: {
    value: planCompletionData?.completion_percent ?? 0,
    secondaryValue: planCompletionData
      ? `${formatCurrency(planCompletionData.total_actual)} из ${formatCurrency(planCompletionData.total_plan)}`
      : undefined,
  },

  // DELTA
  period_delta: {
    value: `${revenueChangeForTile > 0 ? '+' : ''}${revenueChangeForTile}%`,
    secondaryValue: `было ${formatCurrency(prevRevenueForTile)}`,
    isPositive: revenueChangeForTile >= 0,
    accentOverride: revenueChangeForTile >= 0 ? 'emerald' : 'red',
  },
}), [/* all dependencies */]);

const loadingStates: Record<string, boolean> = useMemo(() => ({
  summary: isSummaryLoading,
  costsTreeOzon: ozonCostsTreeLoading,
  costsTreeWb: wbCostsTreeLoading,
  unitEconomics: ueLoading,
  adCosts: adCostsLoading,
  stocks: stocksLoading,
  planCompletion: planCompletionLoading,
  products: false,
}), [isSummaryLoading, ozonCostsTreeLoading, wbCostsTreeLoading, ueLoading, adCostsLoading, stocksLoading, planCompletionLoading]);
```

### 4.9 Backend API Endpoints

```python
# backend/app/api/v1/dashboard_config.py

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional

from ...db.supabase import get_supabase_client
from ...auth import get_current_user_id

router = APIRouter()

class DashboardConfigPayload(BaseModel):
    enabled_widgets: list[str]
    layout: list[dict] = []
    column_count: int = 4
    show_axis_badges: bool = False
    compact_mode: bool = False

DEFAULT_ENABLED = [
    "orders_count", "orders_revenue", "revenue_settled", "purchase_costs",
    "net_profit", "mp_deductions", "ad_cost", "payout",
    "drr", "profit_margin", "period_delta",
]

@router.get("/dashboard/config")
async def get_dashboard_config(
    user_id: str = Depends(get_current_user_id),
):
    """Get user's dashboard widget configuration."""
    supabase = get_supabase_client()
    result = supabase.table("user_dashboard_config") \
        .select("*") \
        .eq("user_id", user_id) \
        .execute()

    if result.data:
        row = result.data[0]
        return {
            "enabled_widgets": row.get("enabled_widgets", DEFAULT_ENABLED),
            "layout": row.get("layout", []),
            "column_count": row.get("column_count", 4),
            "show_axis_badges": row.get("show_axis_badges", False),
            "compact_mode": row.get("compact_mode", False),
        }

    # Return defaults for new users
    return {
        "enabled_widgets": DEFAULT_ENABLED,
        "layout": [],
        "column_count": 4,
        "show_axis_badges": False,
        "compact_mode": False,
    }


@router.put("/dashboard/config")
async def save_dashboard_config(
    payload: DashboardConfigPayload,
    user_id: str = Depends(get_current_user_id),
):
    """Save/update user's dashboard widget configuration."""
    supabase = get_supabase_client()
    data = {
        "user_id": user_id,
        "enabled_widgets": payload.enabled_widgets,
        "layout": payload.layout,
        "column_count": payload.column_count,
        "show_axis_badges": payload.show_axis_badges,
        "compact_mode": payload.compact_mode,
    }

    # Upsert (user_id is UNIQUE)
    supabase.table("user_dashboard_config") \
        .upsert(data, on_conflict="user_id") \
        .execute()

    return {"status": "success"}
```

### 4.10 Widget Settings Panel

```tsx
// frontend/src/components/Dashboard/WidgetSettingsPanel.tsx

interface WidgetSettingsPanelProps {
  onClose: () => void;
}

/**
 * Slide-out panel for configuring dashboard widgets.
 *
 * Layout:
 * ┌─────────────────────────────────────┐
 * │ Настройка виджетов            ✕     │
 * ├─────────────────────────────────────┤
 * │                                     │
 * │ ○ Показывать оси данных             │
 * │ ○ Компактный режим                  │
 * │ Колонок: [2] [3] [4] [5]           │
 * │                                     │
 * │ ── Продажи (order-based) ──         │
 * │ ☑ Заказы                            │
 * │ ☑ Сумма заказов                     │
 * │ ☐ Выкупы (шт)                       │
 * │ ☐ Возвраты                          │
 * │ ☐ Процент выкупа                    │
 * │ ☐ Средний чек                       │
 * │ ☑ Себестоимость                     │
 * │                                     │
 * │ ── Финансы (settlement-based) ──    │
 * │ ☑ Выкупы (₽)                        │
 * │ ☑ К перечислению                    │
 * │ ☑ Удержания МП                      │
 * │ ☑ Чистая прибыль                    │
 * │ ☑ Маржинальность                    │
 * │ ☐ Комиссия МП        🔒 Pro        │
 * │ ☐ Логистика           🔒 Pro        │
 * │ ☐ Хранение            🔒 Pro        │
 * │                                     │
 * │ ── Реклама (ad-date) ──             │
 * │ ☑ Реклама                           │
 * │ ☑ ДРР                               │
 * │ ☐ ACOS                🔒 Pro        │
 * │ ☐ CPO                 🔒 Pro        │
 * │                                     │
 * │ ── Остатки ──                       │
 * │ ☐ Остатки (шт)                      │
 * │ ☐ Ср. запас дней                    │
 * │ ☐ Товары OOS                        │
 * │                                     │
 * │ ── План продаж ──                   │
 * │ ☐ Выполнение плана    🔒 Pro        │
 * │                                     │
 * │ ── Динамика ──                      │
 * │ ☑ Δ к пред. периоду   🔒 Pro        │
 * │                                     │
 * │ [Сбросить по умолчанию]             │
 * └─────────────────────────────────────┘
 */
```

---

## 5. Grid System

### 5.1 Responsive Breakpoints

| Breakpoint | Columns | Widget width | Gap |
|-----------|---------|-------------|-----|
| Mobile (`<640px`) | 1-2 | `grid-cols-1` (stack) or `grid-cols-2` | `gap-2` |
| Tablet (`sm: 640px`) | 2 | `grid-cols-2` | `gap-2.5` |
| Desktop (`lg: 1024px`) | 4 (default, configurable 2-6) | `grid-cols-4` | `gap-3` |

### 5.2 Tailwind Grid Classes

```tsx
// Mobile-first grid, desktop configurable
const GRID_CLASSES: Record<number, string> = {
  2: 'grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5',
  3: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-2.5 lg:gap-3',
  4: 'grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3',                          // DEFAULT
  5: 'grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-2.5',
  6: 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-2.5',
};
```

### 5.3 Widget Sizes (Phase 2 — future)

| Size | Grid span | Use case |
|------|----------|----------|
| `1x1` | `col-span-1 row-span-1` | Standard metric card (all current) |
| `2x1` | `col-span-2 row-span-1` | Wide card (profit waterfall mini, etc.) |
| `1x2` | `col-span-1 row-span-2` | Tall card (mini chart, sparkline) |

Phase 1 (текущий scope): только `1x1` виджеты. Размер фиксирован.
Phase 2: `col-span-2` для "широких" виджетов с мини-графиками.

### 5.4 Card Dimensions

```
Standard (1x1):
- Desktop: ~220px width (в 4-col grid на 1024px viewport)
- Padding: p-4 sm:p-5
- Min height: auto (содержимое определяет)
- Border radius: rounded-2xl
- Shadow: shadow-sm, hover:shadow-md

Compact mode:
- Padding: p-3 sm:p-4
- Font size: text-xl sm:text-2xl (vs default text-2xl sm:text-3xl)
- Icon: w-7 h-7 (vs w-8 h-8 sm:w-9 sm:h-9)
```

### 5.5 Row Count

С 24 доступными виджетами и 4 колонками:
- Default (11 enabled): 3 ряда (4+4+3)
- Maximum (24 enabled, Pro): 6 рядов (4+4+4+4+4+4)
- Minimum (1 enabled): 1 ряд

Нет жёсткого ограничения на кол-во рядов. Grid автоматически растёт.

---

## 6. Миграция с текущего layout

### 6.1 Стратегия: Feature Flag + Fallback

```
Phase 0 (текущий): Hardcoded 8 cards в DashboardPage.tsx
Phase 1 (MVP):     WidgetGrid с toggle "Настроить" — если user_dashboard_config пуст, показываем DEFAULT_ENABLED (= текущие 8+ карточек)
Phase 2 (полный):  Settings panel, dnd, axis badges, 2x1 виджеты
```

### 6.2 Backward Compatibility

1. **Если нет записи в `user_dashboard_config`** — показываем DEFAULT_ENABLED (эквивалент текущих 8 карточек)
2. **SummaryCard** — НЕ меняется, только оборачивается в SortableWidget
3. **Все существующие hooks** — НЕ меняются, данные вычисляются в DashboardPage как сейчас
4. **Новый код** — additive (добавляем WidgetGrid, registry, store, config API)
5. **Старый код** — заменяется только grid `<div className="grid grid-cols-2 lg:grid-cols-4">` на `<WidgetGrid />`

### 6.3 Data Fetching Optimization

Текущий DashboardPage загружает ВСЕ данные (summary, costs-tree, UE, ads, stocks, plan) при монтировании. С виджетной системой можно оптимизировать:

```tsx
// Compute required data deps from enabled widgets
const requiredDeps = useMemo(() => {
  const deps = new Set<WidgetDataDep>();
  enabledWidgets.forEach(id => {
    const def = WIDGET_MAP.get(id);
    if (def) def.dataDeps.forEach(d => deps.add(d));
  });
  return deps;
}, [enabledWidgets]);

// Conditionally enable hooks
const { data: stocksData } = useStocks('all', fulfillmentType, {
  enabled: requiredDeps.has('stocks'),
});
```

Однако, в Phase 1 это **не обязательно** — текущие hooks уже оптимизированы с `staleTime` и `refetchInterval`. Экономия от conditional enabling минимальна (остатки, реклама — единичные запросы).

---

## 7. Реализация по фазам

### Phase 1: MVP (2-3 дня)
- [x] Миграция 021: `user_dashboard_config` таблица
- [x] Backend: `GET/PUT /dashboard/config`
- [x] Widget registry + definitions (24 виджета)
- [x] Zustand store: `useDashboardLayoutStore`
- [x] `useDashboardConfig` hook (load/save)
- [x] `WidgetGrid` component с DnD
- [x] Widget value resolver в DashboardPage
- [x] Default layout = текущие 8+ карточек
- [ ] Замена hardcoded grid на `<WidgetGrid />`

### Phase 2: Settings Panel (1-2 дня)
- [ ] `WidgetSettingsPanel` slide-out
- [ ] Category grouping + checkboxes
- [ ] Column count picker
- [ ] Compact mode toggle
- [ ] Axis badge toggle
- [ ] FeatureGate для Pro-only виджетов
- [ ] "Сбросить по умолчанию" button

### Phase 3: Cross-Axis Transparency (1 день)
- [ ] Axis badge component на каждом виджете
- [ ] Ozon-specific info banner
- [ ] Axis legend в Settings Panel
- [ ] Tooltip enhancement с data source info

### Phase 4: Advanced Sizes (future)
- [ ] 2x1 (wide) widget support
- [ ] Mini sparkline charts в карточках
- [ ] col-span-2 CSS + grid layout persistence

---

## Приложение A: Полная ER-связь

```
user_dashboard_config (NEW)
├── user_id FK → auth.users(id)
├── enabled_widgets JSONB [widget_id, ...]
├── layout JSONB [{id, x, y, w, h}, ...]
├── column_count INT
├── show_axis_badges BOOL
└── compact_mode BOOL

Widget Registry (frontend-only, static)
├── id → matches enabled_widgets entries
├── dataDeps → determines which React Query hooks to enable
├── category → groups in settings UI
├── axis → cross-axis transparency
└── tier → FeatureGate (free/pro)
```

## Приложение B: Архитектурные правила (дополнение к CLAUDE.md)

При реализации добавить в CLAUDE.md:

```
45. **Widget Dashboard:** Registry pattern — WIDGET_DEFINITIONS (frontend-only, static).
    Supabase: user_dashboard_config (JSONB layout). DnD: @dnd-kit/sortable (rectSortingStrategy).
    SummaryCard НЕ меняется — оборачивается в SortableWidget.
    Value resolver — в DashboardPage (НЕ в отдельных widget components).
    Persistence: Zustand + debounced save (1.5s) через PUT /dashboard/config.
    Default layout = 11 виджетов (текущие 8 карточек + drr + profit_margin + period_delta).
    Cross-axis badges: опциональны (show_axis_badges toggle), off по умолчанию.
```
