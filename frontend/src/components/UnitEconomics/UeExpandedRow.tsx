/**
 * Expanded row: breakdown по маркетплейсам (WB vs Ozon)
 * Показывает mini waterfall + ключевые метрики для каждого МП
 */
import { Lightbulb } from 'lucide-react';
import { formatCurrency, formatPercent, cn } from '../../lib/utils';
import { UeMiniWaterfall } from './UeMiniWaterfall';
import { getCompletionBarColor } from './uePlanHelpers';
import type { UnitEconomicsItem, FulfillmentBreakdownItem, Marketplace } from '../../types';

interface MpPlanEntry {
  plan_revenue: number;
  actual_revenue: number;
  completion_percent: number;
}

interface UeExpandedRowProps {
  wbMetrics: UnitEconomicsItem | undefined;
  ozonMetrics: UnitEconomicsItem | undefined;
  /** Текущий глобальный фильтр МП */
  marketplace: Marketplace;
  /** Per-MP plan data */
  wbPlan?: MpPlanEntry;
  ozonPlan?: MpPlanEntry;
}

const MP_STYLES = {
  wb: { color: '#8B3FFD', label: 'WB', border: 'border-purple-200', bg: 'bg-purple-50/30', dot: 'bg-purple-500' },
  ozon: { color: '#005BFF', label: 'OZON', border: 'border-blue-200', bg: 'bg-blue-50/30', dot: 'bg-blue-500' },
};

const FT_STYLES = {
  fbo: { badge: 'bg-gray-100 text-gray-600', bar: 'bg-gray-400', label: 'FBO' },
  fbs: { badge: 'bg-blue-100 text-blue-700', bar: 'bg-blue-500', label: 'FBS' },
};

/** Benchmark цвета маржинальности (индустриальный стандарт) */
function getMarginStyle(margin: number): { text: string; bg: string } {
  if (margin >= 25) return { text: 'text-emerald-700', bg: 'bg-emerald-50' };
  if (margin >= 15) return { text: 'text-sky-700', bg: 'bg-sky-50' };
  if (margin >= 10) return { text: 'text-amber-700', bg: 'bg-amber-50' };
  if (margin >= 5) return { text: 'text-orange-600', bg: 'bg-orange-50' };
  return { text: 'text-red-600', bg: 'bg-red-50' };
}

/** Строка FBO/FBS: два режима — пропорция (2 типа) или информативный (1 тип) */
function FtRow({ ft, data, totalRevenue, singleType }: {
  ft: 'fbo' | 'fbs';
  data: FulfillmentBreakdownItem;
  totalRevenue: number;
  singleType: boolean;
}) {
  const s = FT_STYLES[ft];
  const ms = getMarginStyle(data.margin);

  if (singleType) {
    // Единственный тип — без шкалы, с подписью "маржинальность"
    return (
      <div className="flex items-center gap-2 min-w-0">
        <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0', s.badge)}>
          {s.label}
        </span>
        <span className="text-[10px] tabular-nums text-gray-500 flex-shrink-0">{data.sales_count} шт</span>
        <span className="text-[10px] text-gray-300 flex-shrink-0">·</span>
        <span className="text-[9px] text-gray-400 flex-shrink-0 hidden sm:inline">маржинальность</span>
        <span className="text-[9px] text-gray-400 flex-shrink-0 sm:hidden">маржин.</span>
        <span className={cn('text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded flex-shrink-0', ms.text, ms.bg)}>
          {formatPercent(data.margin)}
        </span>
      </div>
    );
  }

  // Два типа — маржинальность + шкала доли выручки
  const pct = totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0;

  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0', s.badge)}>
        {s.label}
      </span>
      <span className="text-[10px] tabular-nums text-gray-500 flex-shrink-0">{data.sales_count} шт</span>
      <span className="text-[10px] text-gray-300 flex-shrink-0">·</span>
      <span className={cn('text-[10px] tabular-nums font-semibold px-1 py-0.5 rounded flex-shrink-0', ms.text, ms.bg)}>
        {formatPercent(data.margin)}
      </span>
      {/* Доля выручки */}
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden min-w-[24px]">
        <div className={cn('h-full rounded-full', s.bar)} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className="text-[9px] tabular-nums text-gray-400 flex-shrink-0 w-7 text-right">{Math.round(pct)}%</span>
    </div>
  );
}

function FtBreakdownSection({ breakdown }: {
  breakdown: { fbo?: FulfillmentBreakdownItem; fbs?: FulfillmentBreakdownItem };
}) {
  const { fbo, fbs } = breakdown;
  if (!fbo && !fbs) return null;

  const hasFbo = fbo && fbo.sales_count > 0;
  const hasFbs = fbs && fbs.sales_count > 0;
  const hasBoth = hasFbo && hasFbs;

  // Use sum of FBO+FBS revenue as base (NOT costs-tree revenue) so FBO%+FBS%=100%
  const ftTotalRevenue = (fbo?.revenue ?? 0) + (fbs?.revenue ?? 0);

  return (
    <div className="mt-2.5 pt-2 border-t border-dashed border-gray-200/80">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[9px] font-medium text-gray-400 uppercase tracking-wider">Фулфилмент</span>
        {hasBoth && (
          <span className="text-[9px] text-gray-300 uppercase tracking-wider">доля выручки</span>
        )}
      </div>
      <div className="space-y-1">
        {hasFbo && <FtRow ft="fbo" data={fbo} totalRevenue={ftTotalRevenue} singleType={!hasBoth} />}
        {hasFbs && <FtRow ft="fbs" data={fbs} totalRevenue={ftTotalRevenue} singleType={!hasBoth} />}
      </div>
    </div>
  );
}

function MpCard({ metrics, mp, plan }: { metrics: UnitEconomicsItem; mp: 'wb' | 'ozon'; plan?: MpPlanEntry }) {
  const style = MP_STYLES[mp];
  const m = metrics.metrics;
  const margin = m.revenue > 0 ? (m.net_profit / m.revenue) * 100 : 0;
  const ms = getMarginStyle(margin);
  const marginColor = `${ms.bg} ${ms.text}`;

  return (
    <div className={cn('rounded-lg border-2 p-3 sm:p-4', style.border, style.bg)}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', style.dot)} />
        <span className="text-sm font-semibold text-gray-900">{style.label}</span>
        <span className={cn('text-[10px] sm:text-xs font-medium px-1.5 py-0.5 rounded', marginColor)}>
          {formatPercent(margin)}
        </span>
        <span className="text-[10px] text-gray-400 ml-auto">{m.sales_count} шт</span>
      </div>

      {/* Plan progress bar */}
      {plan && plan.plan_revenue > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-[10px] mb-1">
            <span className="text-gray-500">
              План: <span className="font-medium tabular-nums">{Math.round(plan.completion_percent)}%</span>
            </span>
            <span className="text-gray-400 tabular-nums">
              {formatCurrency(plan.actual_revenue)} из {formatCurrency(plan.plan_revenue)}
            </span>
          </div>
          <div className="h-1.5 bg-gray-200/60 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', getCompletionBarColor(plan.completion_percent))}
              style={{ width: `${Math.min(100, plan.completion_percent)}%` }}
            />
          </div>
        </div>
      )}

      {/* Mini Waterfall */}
      <UeMiniWaterfall
        revenue={m.revenue}
        mpDeductions={m.mp_costs}
        purchase={m.purchase_costs}
        ads={m.ad_cost ?? 0}
        profit={m.net_profit}
      />

      {/* FBO/FBS breakdown */}
      {metrics.fulfillment_breakdown && (
        <FtBreakdownSection breakdown={metrics.fulfillment_breakdown} />
      )}

      {/* Bottom metrics */}
      <div className="grid grid-cols-3 gap-2 mt-3 pt-2 border-t border-gray-200/60">
        <div className="text-[10px] sm:text-[11px]">
          <span className="text-gray-400">На ед.</span>
          <div className={cn('font-medium tabular-nums', m.unit_profit >= 0 ? 'text-emerald-700' : 'text-red-600')}>
            {formatCurrency(m.unit_profit)}
          </div>
        </div>
        <div className="text-[10px] sm:text-[11px]">
          <span className="text-gray-400">ДРР</span>
          <div className="font-medium tabular-nums text-gray-700">
            {m.drr > 0 ? formatPercent(m.drr) : '—'}
          </div>
        </div>
        <div className="text-[10px] sm:text-[11px]">
          <span className="text-gray-400">Закупка</span>
          <div className="font-medium tabular-nums text-amber-700">
            {formatCurrency(m.purchase_costs)}
          </div>
        </div>
      </div>
    </div>
  );
}

function buildInsights(wb: UnitEconomicsItem | undefined, ozon: UnitEconomicsItem | undefined): string[] {
  const insights: string[] = [];
  if (!wb || !ozon) {
    if (!wb && ozon) insights.push('Нет продаж на WB за период');
    if (wb && !ozon) insights.push('Нет продаж на OZON за период');
    return insights;
  }

  const wbMargin = wb.metrics.revenue > 0 ? (wb.metrics.net_profit / wb.metrics.revenue) * 100 : 0;
  const ozMargin = ozon.metrics.revenue > 0 ? (ozon.metrics.net_profit / ozon.metrics.revenue) * 100 : 0;
  const diff = Math.abs(wbMargin - ozMargin);

  if (diff > 3) {
    const better = wbMargin > ozMargin ? 'WB' : 'OZON';
    insights.push(`${better} рентабельность на ${diff.toFixed(1)} пп выше`);
  }

  const wbDrr = wb.metrics.drr;
  const ozDrr = ozon.metrics.drr;
  if (wbDrr > 0 && ozDrr > 0) {
    const ratio = wbDrr > ozDrr ? wbDrr / ozDrr : ozDrr / wbDrr;
    if (ratio > 1.3) {
      const worse = wbDrr > ozDrr ? 'WB' : 'OZON';
      insights.push(`${worse} ДРР в ${ratio.toFixed(1)}x выше`);
    }
  }

  const wbUp = wb.metrics.unit_profit;
  const ozUp = ozon.metrics.unit_profit;
  if (Math.abs(wbUp - ozUp) > 50) {
    const better = wbUp > ozUp ? 'WB' : 'OZON';
    insights.push(`${better} +${formatCurrency(Math.abs(wbUp - ozUp))}/ед.`);
  }

  return insights;
}

export function UeExpandedRow({ wbMetrics, ozonMetrics, marketplace, wbPlan, ozonPlan }: UeExpandedRowProps) {
  // Если фильтр = конкретный МП, показываем только его
  const showWb = marketplace === 'all' || marketplace === 'wb';
  const showOzon = marketplace === 'all' || marketplace === 'ozon';

  const hasWb = showWb && !!wbMetrics;
  const hasOzon = showOzon && !!ozonMetrics;

  if (!hasWb && !hasOzon) {
    return (
      <div className="text-xs text-gray-400 py-3 text-center">
        Нет данных по маркетплейсам за период
      </div>
    );
  }

  const insights = marketplace === 'all' ? buildInsights(wbMetrics, ozonMetrics) : [];
  const isSingleMp = (hasWb && !hasOzon) || (!hasWb && hasOzon);

  return (
    <div className="py-2">
      <div className={cn('grid gap-2 sm:gap-3', isSingleMp ? 'grid-cols-1 max-w-md' : 'grid-cols-1 sm:grid-cols-2')}>
        {hasWb && wbMetrics && <MpCard metrics={wbMetrics} mp="wb" plan={wbPlan} />}
        {hasOzon && ozonMetrics && <MpCard metrics={ozonMetrics} mp="ozon" plan={ozonPlan} />}
      </div>

      {/* Auto-insights (desktop only, comparison mode) */}
      {insights.length > 0 && (
        <div className="hidden sm:flex items-center gap-2 mt-2 px-2 py-1.5 bg-indigo-50/50 rounded text-[11px] text-indigo-700">
          <Lightbulb className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{insights.join(' · ')}</span>
        </div>
      )}
    </div>
  );
}
