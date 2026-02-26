/**
 * Улучшенный стековый бар структуры затрат с легендой
 */
import { formatCurrency, formatPercent, cn } from '../../lib/utils';
import type { UeTotals } from './ueHelpers';

interface UeCostStructureProps {
  totals: UeTotals;
  hasAds: boolean;
}

export function UeCostStructure({ totals, hasAds }: UeCostStructureProps) {
  if (totals.revenue <= 0) return null;

  // Calculate all percentages directly from data to avoid artifacts with negative profit
  const purchasePct = Math.max(0, Math.min(100, (totals.purchase / totals.revenue) * 100));
  const adsPct = hasAds ? Math.max(0, Math.min(100, (totals.adCost / totals.revenue) * 100)) : 0;
  const mpCostsPct = Math.max(0, Math.min(100, (totals.mpCosts / totals.revenue) * 100));
  const profitPct = (totals.profit / totals.revenue) * 100;
  const absProfitPct = Math.min(100, Math.abs(profitPct));

  // Normalize segments to fit 100% total for the stacked bar
  const rawTotal = purchasePct + mpCostsPct + adsPct + absProfitPct;
  const scale = rawTotal > 0 ? 100 / rawTotal : 1;
  const barPurchasePct = purchasePct * scale;
  const barMpCostsPct = mpCostsPct * scale;
  const barAdsPct = adsPct * scale;
  const barProfitPct = absProfitPct * scale;

  const segments: { label: string; shortLabel: string; pct: number; barPct: number; value: number; bar: string; dot: string }[] = [
    { label: 'Закупка', shortLabel: 'Закуп.', pct: purchasePct, barPct: barPurchasePct, value: totals.purchase, bar: 'bg-amber-400', dot: 'bg-amber-400' },
    { label: 'Удержания МП', shortLabel: 'Удерж.', pct: mpCostsPct, barPct: barMpCostsPct, value: totals.mpCosts, bar: 'bg-purple-400', dot: 'bg-purple-400' },
  ];
  if (hasAds) {
    segments.push({ label: 'Реклама', shortLabel: 'Рекл.', pct: adsPct, barPct: barAdsPct, value: totals.adCost, bar: 'bg-blue-400', dot: 'bg-blue-400' });
  }
  segments.push({
    label: 'Прибыль',
    shortLabel: 'Приб.',
    pct: absProfitPct,
    barPct: barProfitPct,
    value: totals.profit,
    bar: totals.profit >= 0 ? 'bg-emerald-400' : 'bg-red-400',
    dot: totals.profit >= 0 ? 'bg-emerald-400' : 'bg-red-400',
  });

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-5">
      <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-3">Структура затрат</h3>

      {/* Stacked bar */}
      <div className="flex items-center gap-0.5 h-3 sm:h-4 rounded-full overflow-hidden bg-gray-100">
        {segments.map((s) =>
          s.barPct > 0 ? (
            <div key={s.label} className={cn('h-full transition-all', s.bar)} style={{ width: `${s.barPct}%` }} />
          ) : null,
        )}
      </div>

      {/* Legend with values */}
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-x-4 gap-y-1 mt-2 sm:mt-3">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-[10px] sm:text-xs">
            <div className={cn('w-2 h-2 rounded-full flex-shrink-0', s.dot)} />
            <span className="text-gray-500">
              <span className="hidden sm:inline">{s.label}</span>
              <span className="sm:hidden">{s.shortLabel}</span>
            </span>
            <span className="font-medium text-gray-700 tabular-nums">{formatPercent(s.pct)}</span>
            <span className="text-gray-400 tabular-nums hidden sm:inline">({formatCurrency(s.value)})</span>
          </div>
        ))}
      </div>
    </div>
  );
}
