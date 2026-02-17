/**
 * Страница прибыли и рентабельности — dual area chart + margin trend + insights
 */
import { COLORS, CHART_WIDTH } from './print-constants';
import { PrintSvgAreaChart } from './PrintSvgAreaChart';
import { formatCurrency, formatPercent, formatDate } from '../../lib/utils';
import type { SalesChartDataPoint } from '../../types';

interface PrintProfitChartProps {
  salesData: SalesChartDataPoint[];
  revenue: number;
  profit: number;
  profitMargin: number;
}

export function PrintProfitChart({ salesData, revenue, profit, profitMargin }: PrintProfitChartProps) {
  // Daily profit estimate: revenue × margin
  const dailyProfitData = salesData.map((d) => ({
    label: formatDate(d.date).slice(0, 5),
    value: d.revenue * (profitMargin / 100),
  }));

  const revenueData = salesData.map((d) => ({
    label: formatDate(d.date).slice(0, 5),
    value: d.revenue,
  }));

  const xTickInterval = Math.max(1, Math.floor(salesData.length / 15));

  // Profit margin color
  const marginColor = profitMargin >= 20 ? COLORS.emerald : profitMargin >= 10 ? COLORS.amber : COLORS.red;

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-gray-900">Прибыль и рентабельность</h2>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-200 p-4 bg-gradient-to-br from-emerald-50 to-white">
          <div className="text-xs text-gray-500">Выручка за период</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(revenue)}</div>
        </div>
        <div className="rounded-xl border border-gray-200 p-4 bg-gradient-to-br from-indigo-50 to-white">
          <div className="text-xs text-gray-500">Прибыль за период</div>
          <div className="text-2xl font-bold mt-1" style={{ color: profit >= 0 ? COLORS.emerald : COLORS.red }}>
            {formatCurrency(profit)}
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 p-4 bg-gradient-to-br from-gray-50 to-white">
          <div className="text-xs text-gray-500">Маржа</div>
          <div className="text-2xl font-bold mt-1" style={{ color: marginColor }}>
            {formatPercent(profitMargin)}
          </div>
          <div className="text-xs mt-0.5" style={{ color: marginColor }}>
            {profitMargin >= 20 ? 'Здоровая' : profitMargin >= 10 ? 'Приемлемая' : 'Низкая'}
          </div>
        </div>
      </div>

      {/* Revenue chart */}
      <div className="rounded-xl border border-gray-200 p-4 bg-white">
        <div className="text-sm font-semibold text-gray-700 mb-2">Выручка по дням</div>
        <PrintSvgAreaChart
          data={revenueData}
          width={CHART_WIDTH}
          height={180}
          color={COLORS.emerald}
          fillColor={COLORS.emeraldFill}
          yFormatter={(v) => formatCurrency(v)}
          xTickInterval={xTickInterval}
        />
      </div>

      {/* Profit chart */}
      <div className="rounded-xl border border-gray-200 p-4 bg-white">
        <div className="text-sm font-semibold text-gray-700 mb-2">Прибыль по дням (оценка)</div>
        <PrintSvgAreaChart
          data={dailyProfitData}
          width={CHART_WIDTH}
          height={180}
          color={COLORS.indigo}
          fillColor={COLORS.indigoFill}
          yFormatter={(v) => formatCurrency(v)}
          xTickInterval={xTickInterval}
        />
      </div>
    </div>
  );
}
