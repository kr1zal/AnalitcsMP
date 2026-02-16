/**
 * Expanded row: breakdown по маркетплейсам (WB vs Ozon)
 * Показывает mini waterfall + ключевые метрики для каждого МП
 */
import { Lightbulb } from 'lucide-react';
import { formatCurrency, formatPercent, cn } from '../../lib/utils';
import { UeMiniWaterfall } from './UeMiniWaterfall';
import type { UnitEconomicsItem, Marketplace } from '../../types';

interface UeExpandedRowProps {
  wbMetrics: UnitEconomicsItem | undefined;
  ozonMetrics: UnitEconomicsItem | undefined;
  /** Текущий глобальный фильтр МП */
  marketplace: Marketplace;
}

const MP_STYLES = {
  wb: { color: '#8B3FFD', label: 'WB', border: 'border-purple-200', bg: 'bg-purple-50/30', dot: 'bg-purple-500' },
  ozon: { color: '#005BFF', label: 'OZON', border: 'border-blue-200', bg: 'bg-blue-50/30', dot: 'bg-blue-500' },
};

function MpCard({ metrics, mp }: { metrics: UnitEconomicsItem; mp: 'wb' | 'ozon' }) {
  const style = MP_STYLES[mp];
  const m = metrics.metrics;
  const margin = m.revenue > 0 ? (m.net_profit / m.revenue) * 100 : 0;
  const marginColor = margin >= 20 ? 'bg-emerald-50 text-emerald-700' : margin >= 10 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700';

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

      {/* Mini Waterfall */}
      <UeMiniWaterfall
        revenue={m.revenue}
        mpDeductions={m.mp_costs}
        purchase={m.purchase_costs}
        ads={m.ad_cost ?? 0}
        profit={m.net_profit}
      />

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
    insights.push(`${better} маржа на ${diff.toFixed(1)} пп выше`);
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

export function UeExpandedRow({ wbMetrics, ozonMetrics, marketplace }: UeExpandedRowProps) {
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
        {hasWb && wbMetrics && <MpCard metrics={wbMetrics} mp="wb" />}
        {hasOzon && ozonMetrics && <MpCard metrics={ozonMetrics} mp="ozon" />}
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
