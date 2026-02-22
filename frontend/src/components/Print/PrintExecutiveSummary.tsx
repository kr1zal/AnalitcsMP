/**
 * Executive Summary — 6 KPI с Δ%, план продаж, waterfall прибыли, структура расходов
 */
import { COLORS } from './print-constants';
import { PrintSvgDonutChart } from './PrintSvgDonutChart';
import { formatCurrency, formatPercent, formatNumber } from '../../lib/utils';
import type { CostsTreeResponse, SalesPlanCompletionResponse } from '../../types';

interface KpiItem {
  label: string;
  value: string;
  change?: number;
  sublabel?: string;
}

interface PrintExecutiveSummaryProps {
  revenue: number;
  profit: number;
  sales: number;
  avgCheck: number;
  adCost: number;
  drr: number;
  revenueChange: number;
  salesChange: number;
  // Waterfall
  mpDeductions: number;
  purchaseCosts: number;
  // Plan
  planCompletion?: SalesPlanCompletionResponse | null;
  // Donut
  ozonTree?: CostsTreeResponse | null;
  wbTree?: CostsTreeResponse | null;
  marketplace: 'all' | 'ozon' | 'wb';
}

export function PrintExecutiveSummary({
  revenue,
  profit,
  sales,
  avgCheck,
  adCost,
  drr,
  revenueChange,
  salesChange,
  mpDeductions,
  purchaseCosts,
  planCompletion,
  ozonTree,
  wbTree,
  marketplace,
}: PrintExecutiveSummaryProps) {
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

  const kpis: KpiItem[] = [
    { label: 'Выручка', value: formatCurrency(revenue), change: revenueChange },
    { label: 'Прибыль', value: formatCurrency(profit), sublabel: `маржа ${formatPercent(margin)}` },
    { label: 'Выкупы', value: formatNumber(sales), change: salesChange },
    { label: 'Средний чек', value: formatCurrency(avgCheck) },
    { label: 'Реклама', value: formatCurrency(adCost) },
    { label: 'ДРР', value: formatPercent(drr) },
  ];

  // Waterfall bars
  const waterfallItems = [
    { label: 'Продажи', value: revenue, color: COLORS.emerald },
    { label: 'Удержания МП', value: -mpDeductions, color: COLORS.red },
    { label: 'Закупка', value: -purchaseCosts, color: COLORS.orange },
    { label: 'Реклама', value: -adCost, color: COLORS.amber },
    { label: 'Прибыль', value: profit, color: profit >= 0 ? COLORS.indigo : COLORS.red },
  ].filter((i) => i.value !== 0);

  const maxWaterfall = Math.max(...waterfallItems.map((i) => Math.abs(i.value)), 1);

  // Donut segments from costs-tree
  const donutSegments = buildDonutSegments(ozonTree, wbTree, marketplace);

  // Plan completion
  const hasPlan = planCompletion && planCompletion.total_plan > 0;

  return (
    <div className="space-y-5">
      {/* Section title */}
      <h2 className="text-xl font-bold text-gray-900">Executive Summary</h2>

      {/* KPI Grid */}
      <div className="grid grid-cols-6 gap-3">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-gray-200 p-3"
            style={{ background: 'linear-gradient(135deg, #f9fafb, #ffffff)' }}
          >
            <div className="text-xs text-gray-500 mb-1">{kpi.label}</div>
            <div className="text-lg font-bold text-gray-900">{kpi.value}</div>
            {kpi.sublabel && <div className="text-xs text-gray-400 mt-0.5">{kpi.sublabel}</div>}
            {kpi.change !== undefined && kpi.change !== 0 && (
              <div className={`text-xs font-medium mt-0.5 ${kpi.change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {kpi.change >= 0 ? '↑' : '↓'} {formatPercent(Math.abs(kpi.change))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Plan Completion (if exists) */}
      {hasPlan && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 flex items-center gap-6">
          <div>
            <div className="text-sm font-semibold text-indigo-800">План продаж</div>
            <div className="text-xs text-indigo-600 mt-0.5">{planCompletion!.month_label}</div>
          </div>
          <div className="flex-1">
            <div className="h-3 bg-indigo-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(planCompletion!.completion_percent, 100)}%`,
                  backgroundColor: planCompletion!.completion_percent >= 100 ? COLORS.emerald : COLORS.indigo,
                }}
              />
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold" style={{ color: planCompletion!.completion_percent >= 100 ? COLORS.emerald : COLORS.indigo }}>
              {formatPercent(planCompletion!.completion_percent)}
            </div>
            <div className="text-xs text-gray-500">
              {formatCurrency(planCompletion!.total_actual)} / {formatCurrency(planCompletion!.total_plan)}
            </div>
          </div>
        </div>
      )}

      {/* Waterfall + Donut side by side */}
      <div className="grid grid-cols-2 gap-6">
        {/* Waterfall */}
        <div className="rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Каскад прибыли</h3>
          <div className="space-y-2">
            {waterfallItems.map((item) => {
              const w = (Math.abs(item.value) / maxWaterfall) * 100;
              return (
                <div key={item.label} className="flex items-center gap-3">
                  <div className="w-20 text-xs text-gray-600 truncate">{item.label}</div>
                  <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
                    <div
                      className="h-full rounded"
                      style={{ width: `${Math.max(w, 2)}%`, backgroundColor: item.color, opacity: 0.8 }}
                    />
                  </div>
                  <div className="w-24 text-right text-xs font-semibold" style={{ color: item.value < 0 ? COLORS.red : COLORS.gray900 }}>
                    {item.value < 0 ? '−' : ''}{formatCurrency(Math.abs(item.value))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Donut — expense structure */}
        <div className="rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Структура удержаний</h3>
          {donutSegments.length > 0 ? (
            <PrintSvgDonutChart segments={donutSegments} size={120} innerRadius={35} outerRadius={55} legendWidth={200} />
          ) : (
            <div className="text-sm text-gray-400">Нет данных</div>
          )}
        </div>
      </div>
    </div>
  );
}

function buildDonutSegments(
  ozonTree?: CostsTreeResponse | null,
  wbTree?: CostsTreeResponse | null,
  marketplace?: string,
) {
  const categories = new Map<string, number>();

  const addTree = (tree: CostsTreeResponse | null | undefined) => {
    if (!tree) return;
    for (const item of tree.tree) {
      if (item.name === 'Продажи' || item.amount >= 0) continue;
      const current = categories.get(item.name) ?? 0;
      categories.set(item.name, current + Math.abs(item.amount));
    }
  };

  if (marketplace !== 'wb') addTree(ozonTree);
  if (marketplace !== 'ozon') addTree(wbTree);

  return Array.from(categories.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, value]) => ({ label, value }));
}
