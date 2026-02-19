/**
 * Хелперы для Unit Economics enterprise page
 * ABC-классификация, smart alerts, margin/color utilities
 */
import type { UnitEconomicsItem } from '../../types';

// ==================== TYPES ====================

export type AbcGrade = 'A' | 'B' | 'C';
export type SortField =
  | 'name' | 'sales_count' | 'revenue' | 'purchase_costs'
  | 'mp_costs' | 'ad_cost' | 'drr' | 'net_profit'
  | 'unit_profit' | 'margin' | 'contribution' | 'plan_completion';
export type SortDirection = 'asc' | 'desc';

export type ProductFilter = 'all' | 'profitable' | 'loss' | 'abc_a' | 'abc_b' | 'abc_c';

export interface AlertItem {
  key: string;
  icon: 'loss' | 'margin_low' | 'drr_high';
  tooltip: string;
  color: string;
}

// ==================== CONSTANTS ====================

export const ITEMS_PER_PAGE_DESKTOP = 20;
export const ITEMS_PER_PAGE_MOBILE = 10;
export const TOP_COUNT = 5;
export const BOTTOM_COUNT = 3;

export const FILTER_TABS: { key: ProductFilter; label: string; mobileLabel: string; activeClass: string }[] = [
  { key: 'all', label: 'Все', mobileLabel: 'Все', activeClass: 'bg-gray-900 text-white border-gray-900' },
  { key: 'profitable', label: 'Прибыльные', mobileLabel: 'Приб.', activeClass: 'bg-emerald-600 text-white border-emerald-600' },
  { key: 'loss', label: 'Убыточные', mobileLabel: 'Убыт.', activeClass: 'bg-red-600 text-white border-red-600' },
  { key: 'abc_a', label: 'A-класс', mobileLabel: 'A', activeClass: 'bg-emerald-600 text-white border-emerald-600' },
  { key: 'abc_b', label: 'B-класс', mobileLabel: 'B', activeClass: 'bg-amber-500 text-white border-amber-500' },
  { key: 'abc_c', label: 'C-класс', mobileLabel: 'C', activeClass: 'bg-gray-600 text-white border-gray-600' },
];

export const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'net_profit', label: 'Прибыль' },
  { value: 'revenue', label: 'Выручка' },
  { value: 'margin', label: 'Маржа' },
  { value: 'sales_count', label: 'Продажи' },
  { value: 'unit_profit', label: 'На ед.' },
  { value: 'name', label: 'Название' },
  { value: 'drr', label: 'ДРР' },
  { value: 'contribution', label: 'Доля' },
];

// ==================== MARGIN & COLORS ====================

export function getMargin(item: UnitEconomicsItem): number {
  return item.metrics.revenue > 0
    ? (item.metrics.net_profit / item.metrics.revenue) * 100
    : 0;
}

export function getReturnRate(item: UnitEconomicsItem): number {
  const total = item.metrics.sales_count + (item.metrics.returns_count ?? 0);
  return total > 0 ? ((item.metrics.returns_count ?? 0) / total) * 100 : 0;
}

export function getMarginColor(margin: number): string {
  if (margin >= 20) return 'text-emerald-700';
  if (margin >= 10) return 'text-amber-700';
  return 'text-red-700';
}

export function getMarginBg(margin: number): string {
  if (margin >= 20) return 'bg-emerald-50';
  if (margin >= 10) return 'bg-amber-50';
  return 'bg-red-50';
}

export function getReturnRateColor(rate: number): string {
  if (rate >= 15) return 'text-red-600';
  if (rate >= 5) return 'text-amber-600';
  return 'text-gray-500';
}

export function getRowBg(margin: number, profit: number): string {
  if (profit < 0) return 'bg-red-50/40 hover:bg-red-50/60';
  if (margin >= 20) return 'bg-emerald-50/20 hover:bg-emerald-50/40';
  return 'hover:bg-gray-50/50';
}

// ==================== ABC CLASSIFICATION ====================

export function classifyABC(products: UnitEconomicsItem[]): Map<string, AbcGrade> {
  const profitable = products
    .filter((p) => p.metrics.net_profit > 0)
    .sort((a, b) => b.metrics.net_profit - a.metrics.net_profit);

  const totalProfit = profitable.reduce((s, p) => s + p.metrics.net_profit, 0);
  const map = new Map<string, AbcGrade>();

  if (totalProfit <= 0) {
    for (const p of products) map.set(p.product.id, 'C');
    return map;
  }

  let cumulative = 0;
  for (const p of profitable) {
    cumulative += p.metrics.net_profit;
    const pct = (cumulative / totalProfit) * 100;
    map.set(p.product.id, pct <= 80 ? 'A' : pct <= 95 ? 'B' : 'C');
  }

  // Loss-making = always C
  for (const p of products) {
    if (!map.has(p.product.id)) map.set(p.product.id, 'C');
  }

  return map;
}

export const ABC_STYLES: Record<AbcGrade, string> = {
  A: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  B: 'bg-amber-100 text-amber-700 border-amber-300',
  C: 'bg-gray-100 text-gray-500 border-gray-300',
};

// ==================== SMART ALERTS ====================

export function getAlerts(item: UnitEconomicsItem): AlertItem[] {
  const alerts: AlertItem[] = [];
  const margin = getMargin(item);

  if (item.metrics.net_profit < 0) {
    alerts.push({
      key: 'loss',
      icon: 'loss',
      tooltip: `Убыток ${Math.abs(item.metrics.net_profit).toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽`,
      color: 'text-red-500',
    });
  } else if (margin > 0 && margin < 5) {
    alerts.push({
      key: 'margin_low',
      icon: 'margin_low',
      tooltip: `Маржа ${margin.toFixed(1)}% — ниже 5%`,
      color: 'text-amber-500',
    });
  }

  if (item.metrics.drr > 30) {
    alerts.push({
      key: 'drr_high',
      icon: 'drr_high',
      tooltip: `ДРР ${item.metrics.drr.toFixed(1)}% — выше 30%`,
      color: 'text-orange-500',
    });
  }

  return alerts;
}

// ==================== CONTRIBUTION ====================

export function getContribution(item: UnitEconomicsItem, totalProfit: number): number {
  if (totalProfit === 0) return 0;
  return (item.metrics.net_profit / totalProfit) * 100;
}

// ==================== SORTING ====================

export function getSortValue(
  item: UnitEconomicsItem,
  field: SortField,
  extras: { planMap?: Map<string, number>; totalProfit?: number },
): number | string {
  switch (field) {
    case 'name': return item.product.name.toLowerCase();
    case 'margin': return getMargin(item);
    case 'contribution': return getContribution(item, extras.totalProfit ?? 0);
    case 'plan_completion': return extras.planMap?.get(item.product.id) ?? -1;
    default: return (item.metrics as unknown as Record<string, number>)[field] ?? 0;
  }
}

// ==================== FILTERING ====================

export function applyProductFilter(
  products: UnitEconomicsItem[],
  filter: ProductFilter,
  abcMap: Map<string, AbcGrade>,
): UnitEconomicsItem[] {
  switch (filter) {
    case 'profitable': return products.filter((p) => p.metrics.net_profit > 0);
    case 'loss': return products.filter((p) => p.metrics.net_profit <= 0);
    case 'abc_a': return products.filter((p) => abcMap.get(p.product.id) === 'A');
    case 'abc_b': return products.filter((p) => abcMap.get(p.product.id) === 'B');
    case 'abc_c': return products.filter((p) => abcMap.get(p.product.id) === 'C');
    default: return products;
  }
}

// ==================== TOTALS ====================

export interface UeTotals {
  revenue: number;
  purchase: number;
  mpCosts: number;
  adCost: number;
  profit: number;
  sales: number;
  returns: number;
}

export function computeTotals(products: UnitEconomicsItem[]): UeTotals {
  const t: UeTotals = { revenue: 0, purchase: 0, mpCosts: 0, adCost: 0, profit: 0, sales: 0, returns: 0 };
  for (const p of products) {
    t.revenue += p.metrics.revenue;
    t.purchase += p.metrics.purchase_costs;
    t.mpCosts += p.metrics.mp_costs;
    t.adCost += p.metrics.ad_cost ?? 0;
    t.profit += p.metrics.net_profit;
    t.sales += p.metrics.sales_count;
    t.returns += p.metrics.returns_count ?? 0;
  }
  return t;
}
