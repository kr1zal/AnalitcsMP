/**
 * UE обзор — 4 KPI, Top 5 по прибыли (SVG bars), убыточные, ABC distribution
 */
import { COLORS } from './print-constants';
import { PrintSvgBarChart, type BarEntry } from './PrintSvgBarChart';
import { formatCurrency, formatPercent, formatNumber } from '../../lib/utils';
import { classifyABC, computeTotals, type AbcGrade } from '../UnitEconomics/ueHelpers';
import type { UnitEconomicsItem } from '../../types';

interface PrintUeOverviewProps {
  products: UnitEconomicsItem[];
}

const ABC_COLORS: Record<AbcGrade, string> = {
  A: COLORS.emerald,
  B: COLORS.amber,
  C: COLORS.gray400,
};

const ABC_BADGE_BG: Record<AbcGrade, string> = {
  A: '#d1fae5',
  B: '#fef3c7',
  C: '#f3f4f6',
};

export function PrintUeOverview({ products }: PrintUeOverviewProps) {
  const totals = computeTotals(products);
  const abcMap = classifyABC(products);
  const totalMargin = totals.revenue > 0 ? (totals.profit / totals.revenue) * 100 : 0;

  // Sort by profit desc
  const sorted = [...products].sort((a, b) => b.metrics.net_profit - a.metrics.net_profit);
  const top5 = sorted.slice(0, 5).filter((p) => p.metrics.net_profit > 0);
  const lossProducts = sorted.filter((p) => p.metrics.net_profit < 0);

  // ABC distribution counts
  const abcCounts = { A: 0, B: 0, C: 0 };
  for (const [, grade] of abcMap) abcCounts[grade]++;

  // Top 5 bar entries
  const topBarEntries: BarEntry[] = top5.map((p) => ({
    label: p.product.name,
    value: p.metrics.net_profit,
    color: COLORS.emerald,
    badge: abcMap.get(p.product.id) ?? 'C',
    badgeColor: ABC_BADGE_BG[abcMap.get(p.product.id) ?? 'C'],
  }));

  // Loss bar entries (abs values, red)
  const lossBarEntries: BarEntry[] = lossProducts.slice(0, 5).map((p) => ({
    label: p.product.name,
    value: Math.abs(p.metrics.net_profit),
    color: COLORS.red,
  }));

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-gray-900">Unit-экономика: обзор</h2>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-3">
        <KpiBox label="Товаров" value={String(products.length)} />
        <KpiBox label="Общая прибыль" value={formatCurrency(totals.profit)} color={totals.profit >= 0 ? COLORS.emerald : COLORS.red} />
        <KpiBox label="Общая маржа" value={formatPercent(totalMargin)} color={totalMargin >= 20 ? COLORS.emerald : totalMargin >= 10 ? COLORS.amber : COLORS.red} />
        <KpiBox label="Всего выкупов" value={formatNumber(totals.sales)} />
      </div>

      {/* ABC Distribution */}
      <div className="rounded-xl border border-gray-200 p-4">
        <div className="text-sm font-semibold text-gray-700 mb-3">ABC-классификация</div>
        <div className="flex items-center gap-4">
          {(['A', 'B', 'C'] as AbcGrade[]).map((grade) => {
            const pct = products.length > 0 ? (abcCounts[grade] / products.length) * 100 : 0;
            return (
              <div key={grade} className="flex items-center gap-2">
                <div className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold" style={{ backgroundColor: ABC_BADGE_BG[grade], color: ABC_COLORS[grade] }}>
                  {grade}
                </div>
                <span className="text-sm text-gray-700">
                  {abcCounts[grade]} ({formatPercent(pct)})
                </span>
              </div>
            );
          })}
        </div>

        {/* ABC bar */}
        <div className="mt-3 h-3 rounded-full overflow-hidden flex bg-gray-100">
          {(['A', 'B', 'C'] as AbcGrade[]).map((grade) => {
            const pct = products.length > 0 ? (abcCounts[grade] / products.length) * 100 : 0;
            return pct > 0 ? (
              <div key={grade} className="h-full" style={{ width: `${pct}%`, backgroundColor: ABC_COLORS[grade], opacity: 0.7 }} />
            ) : null;
          })}
        </div>
      </div>

      {/* Top 5 + Loss side by side */}
      <div className="grid grid-cols-2 gap-6">
        {/* Top 5 by profit */}
        <div className="rounded-xl border border-gray-200 p-4">
          <div className="text-sm font-semibold text-gray-700 mb-3">
            Топ-5 по прибыли
          </div>
          {topBarEntries.length > 0 ? (
            <PrintSvgBarChart entries={topBarEntries} width={480} barHeight={24} gap={8} />
          ) : (
            <div className="text-sm text-gray-400">Нет прибыльных товаров</div>
          )}
        </div>

        {/* Loss products */}
        <div className="rounded-xl border border-gray-200 p-4">
          <div className="text-sm font-semibold text-gray-700 mb-3">
            Убыточные товары {lossProducts.length > 0 && <span className="text-red-500 font-normal">({lossProducts.length})</span>}
          </div>
          {lossBarEntries.length > 0 ? (
            <PrintSvgBarChart entries={lossBarEntries} width={480} barHeight={24} gap={8} />
          ) : (
            <div className="text-sm text-emerald-600">Убыточных товаров нет</div>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 p-3 bg-gradient-to-br from-gray-50 to-white">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-xl font-bold mt-0.5" style={{ color: color ?? COLORS.gray900 }}>{value}</div>
    </div>
  );
}
