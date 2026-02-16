/**
 * Plan × UE helpers — pace/forecast calculations, matrix classification.
 * All computations are frontend-only (no backend changes).
 */
import type { UnitEconomicsItem, SalesPlanCompletionResponse } from '../../types';

// ==================== TYPES ====================

export type MatrixQuadrant = 'stars' | 'potential' | 'traps' | 'problems';

export interface PlanPaceData {
  planRevenue: number;
  actualRevenue: number;
  completionPct: number;
  currentDay: number;
  totalDays: number;
  dailyPace: number;
  forecastRevenue: number;
  forecastPct: number;
  requiredDaily: number;
  gap: number;
  status: 'ahead' | 'on_track' | 'behind';
}

export interface QuadrantData {
  quadrant: MatrixQuadrant;
  label: string;
  icon: string;
  count: number;
  totalRevenue: number;
  totalProfit: number;
  productIds: Set<string>;
  color: string;
  borderColor: string;
  bgColor: string;
  description: string;
}

// ==================== MATRIX CONFIG ====================

const QUADRANT_CONFIG: Record<MatrixQuadrant, Omit<QuadrantData, 'count' | 'totalRevenue' | 'totalProfit' | 'productIds'>> = {
  stars: {
    quadrant: 'stars',
    label: 'Звёзды',
    icon: '★',
    color: 'text-emerald-700',
    borderColor: 'border-emerald-400',
    bgColor: 'bg-emerald-50/50',
    description: 'План выполняется, товар прибылен',
  },
  traps: {
    quadrant: 'traps',
    label: 'Ловушки',
    icon: '⚠',
    color: 'text-red-700',
    borderColor: 'border-red-400',
    bgColor: 'bg-red-50/50',
    description: 'План выполняется, но товар убыточен!',
  },
  potential: {
    quadrant: 'potential',
    label: 'Потенциал',
    icon: '↗',
    color: 'text-blue-700',
    borderColor: 'border-blue-400',
    bgColor: 'bg-blue-50/50',
    description: 'Товар прибылен, нужно больше продаж',
  },
  problems: {
    quadrant: 'problems',
    label: 'Проблемы',
    icon: '↓',
    color: 'text-gray-600',
    borderColor: 'border-gray-300',
    bgColor: 'bg-gray-50/50',
    description: 'Низкие продажи и убыток',
  },
};

// ==================== PACE / FORECAST ====================

export function computePlanPace(
  planRevenue: number,
  actualRevenue: number,
  period: { from: string; to: string },
): PlanPaceData | null {
  if (planRevenue <= 0) return null;

  const now = new Date();
  const from = new Date(period.from);
  const to = new Date(period.to);

  // Days in the plan month
  const totalDays = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86400000) + 1);

  // Current day within period (clamped)
  const elapsed = Math.ceil((now.getTime() - from.getTime()) / 86400000);
  const currentDay = Math.max(1, Math.min(elapsed, totalDays));
  const remainingDays = Math.max(1, totalDays - currentDay);

  const dailyPace = actualRevenue / currentDay;
  const forecastRevenue = dailyPace * totalDays;
  const forecastPct = (forecastRevenue / planRevenue) * 100;
  const requiredDaily = (planRevenue - actualRevenue) / remainingDays;
  const gap = planRevenue - actualRevenue;

  const completionPct = (actualRevenue / planRevenue) * 100;

  let status: PlanPaceData['status'];
  if (forecastPct >= 105) status = 'ahead';
  else if (forecastPct >= 95) status = 'on_track';
  else status = 'behind';

  return {
    planRevenue, actualRevenue, completionPct,
    currentDay, totalDays, dailyPace,
    forecastRevenue, forecastPct, requiredDaily, gap, status,
  };
}

/**
 * Build pace map for all products that have a plan.
 */
export function buildPlanPaceMap(
  planData: SalesPlanCompletionResponse | undefined,
): Map<string, PlanPaceData> {
  const map = new Map<string, PlanPaceData>();
  if (!planData?.by_product || !planData.period) return map;

  for (const p of planData.by_product) {
    if (p.plan_revenue > 0) {
      const pace = computePlanPace(p.plan_revenue, p.actual_revenue, planData.period);
      if (pace) map.set(p.product_id, pace);
    }
  }
  return map;
}

// ==================== MATRIX CLASSIFICATION ====================

/**
 * Classify products into BCG-style matrix quadrants.
 * Only products WITH a plan are classified.
 */
export function classifyMatrix(
  products: UnitEconomicsItem[],
  planMap: Map<string, number>,
): { quadrants: QuadrantData[]; productMap: Map<string, MatrixQuadrant> } {
  const productMap = new Map<string, MatrixQuadrant>();

  const data: Record<MatrixQuadrant, { count: number; revenue: number; profit: number; ids: Set<string> }> = {
    stars:     { count: 0, revenue: 0, profit: 0, ids: new Set() },
    traps:     { count: 0, revenue: 0, profit: 0, ids: new Set() },
    potential: { count: 0, revenue: 0, profit: 0, ids: new Set() },
    problems:  { count: 0, revenue: 0, profit: 0, ids: new Set() },
  };

  for (const item of products) {
    const completion = planMap.get(item.product.id);
    if (completion === undefined) continue; // no plan → skip

    const highPlan = completion >= 70;
    const profitable = item.metrics.net_profit >= 0;

    let q: MatrixQuadrant;
    if (highPlan && profitable) q = 'stars';
    else if (highPlan && !profitable) q = 'traps';
    else if (!highPlan && profitable) q = 'potential';
    else q = 'problems';

    productMap.set(item.product.id, q);
    data[q].count++;
    data[q].revenue += item.metrics.revenue;
    data[q].profit += item.metrics.net_profit;
    data[q].ids.add(item.product.id);
  }

  // Order: stars, traps (top row), potential, problems (bottom row)
  const order: MatrixQuadrant[] = ['stars', 'traps', 'potential', 'problems'];
  const quadrants: QuadrantData[] = order.map((q) => ({
    ...QUADRANT_CONFIG[q],
    count: data[q].count,
    totalRevenue: data[q].revenue,
    totalProfit: data[q].profit,
    productIds: data[q].ids,
  }));

  return { quadrants, productMap };
}

// ==================== PACE STATUS HELPERS ====================

export function getPaceStatusLabel(status: PlanPaceData['status']): string {
  switch (status) {
    case 'ahead': return 'Опережает';
    case 'on_track': return 'На уровне';
    case 'behind': return 'Отстаёт';
  }
}

export function getPaceStatusColor(status: PlanPaceData['status']): string {
  switch (status) {
    case 'ahead': return 'text-emerald-600';
    case 'on_track': return 'text-indigo-600';
    case 'behind': return 'text-amber-600';
  }
}

// ==================== PLAN MONTH EXTRACTION ====================

export function extractPlanMonth(planData: SalesPlanCompletionResponse | undefined): string {
  if (planData?.period?.from) {
    const d = new Date(planData.period.from);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function getCompletionColor(pct: number): string {
  if (pct >= 100) return 'text-emerald-600 bg-emerald-50';
  if (pct >= 70) return 'text-indigo-600 bg-indigo-50';
  return 'text-amber-600 bg-amber-50';
}

export function getCompletionBarColor(pct: number): string {
  if (pct >= 100) return 'bg-emerald-500';
  if (pct >= 70) return 'bg-indigo-500';
  return 'bg-amber-500';
}
