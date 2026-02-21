/**
 * Widget Registry — типы и константы для Widget Dashboard
 *
 * Единый реестр определений виджетов (метрик-карточек).
 * Каждый виджет описывает: источник данных (axis), категорию,
 * зависимости от React Query хуков, формат отображения и tier.
 */
import type { LucideIcon } from 'lucide-react';
import type { CardAccent } from '../SummaryCard';

// Re-export CardAccent from SummaryCard — single source of truth
export type { CardAccent } from '../SummaryCard';

// Data axis for cross-axis transparency (Ozon ORDER vs SETTLEMENT)
export type DataAxis = 'order' | 'settlement' | 'ad' | 'neutral' | 'calculated' | 'mixed';

// Widget categories for settings panel grouping
export type WidgetCategory = 'sales' | 'finance' | 'ads' | 'stocks' | 'plan' | 'delta';

// Subscription tier requirement
export type WidgetTier = 'free' | 'pro';

// Widget display format
export type WidgetFormat = 'currency' | 'number' | 'percent';

// Data dependencies — which React Query hooks are needed
export type WidgetDataDep =
  | 'summary'
  | 'costsTreeOzon'
  | 'costsTreeWb'
  | 'unitEconomics'
  | 'adCosts'
  | 'stocks'
  | 'planCompletion'
  | 'products';

// Widget definition — single source of truth for each metric card
export interface WidgetDefinition {
  id: string;
  title: string;
  mobileTitle?: string;
  category: WidgetCategory;
  axis: DataAxis;
  tooltipLines: string[];
  icon: LucideIcon;
  accent: CardAccent;
  format: WidgetFormat;
  defaultEnabled: boolean;
  tier: WidgetTier;
  dataDeps: WidgetDataDep[];
}

// Resolved widget value for rendering
export interface WidgetValue {
  value: number | string;
  secondaryValue?: string;
  subtitle?: string;
  warning?: string;
  change?: number;
  isPositive?: boolean;
  accentOverride?: CardAccent;
}

// Category metadata for settings panel
export interface CategoryMeta {
  label: string;
  description: string;
  axisNote?: string;
}

export const WIDGET_CATEGORIES: Record<WidgetCategory, CategoryMeta> = {
  sales:   { label: 'Продажи',     description: 'Метрики заказов и выкупов', axisNote: 'Данные по дате заказа' },
  finance: { label: 'Финансы',     description: 'Расчёты из финансового отчёта МП', axisNote: 'Данные по дате фин. операции' },
  ads:     { label: 'Реклама',     description: 'Рекламные расходы и эффективность', axisNote: 'Данные по дате расхода' },
  stocks:  { label: 'Остатки',     description: 'Текущее состояние склада' },
  plan:    { label: 'План продаж', description: 'Выполнение плана' },
  delta:   { label: 'Динамика',    description: 'Сравнение с предыдущим периодом' },
};

// Axis badge styles
export const AXIS_STYLES: Record<DataAxis, { label: string; bg: string; text: string; border: string }> = {
  order:      { label: 'заказы',   bg: 'bg-blue-50',    text: 'text-blue-600',    border: 'border-blue-200' },
  settlement: { label: 'финансы',  bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
  ad:         { label: 'реклама',  bg: 'bg-amber-50',   text: 'text-amber-600',   border: 'border-amber-200' },
  neutral:    { label: 'остатки',  bg: 'bg-gray-50',    text: 'text-gray-600',    border: 'border-gray-200' },
  calculated: { label: 'расчёт',   bg: 'bg-violet-50',  text: 'text-violet-600',  border: 'border-violet-200' },
  mixed:      { label: 'смешанн.', bg: 'bg-orange-50',  text: 'text-orange-600',  border: 'border-orange-200' },
};
