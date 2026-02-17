/**
 * Реклама: обзор — 6 KPI + SVG DRR chart (area)
 */
import { COLORS, CHART_WIDTH, DRR_THRESHOLDS } from './print-constants';
import { PrintSvgAreaChart } from './PrintSvgAreaChart';
import { formatCurrency, formatNumber, formatPercent, formatDate } from '../../lib/utils';
import type { AdCostsResponse, AdCostsChartDataPoint } from '../../types';

interface PrintAdsOverviewProps {
  totals: AdCostsResponse['totals'];
  data: AdCostsChartDataPoint[];
}

export function PrintAdsOverview({ totals, data }: PrintAdsOverviewProps) {
  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const cpc = totals.clicks > 0 ? totals.ad_cost / totals.clicks : 0;
  const cpo = totals.orders > 0 ? totals.ad_cost / totals.orders : 0;
  const roas = totals.ad_cost > 0 ? totals.revenue / totals.ad_cost : 0;

  const drrColor = totals.drr > DRR_THRESHOLDS.high ? COLORS.red : totals.drr > DRR_THRESHOLDS.medium ? COLORS.amber : COLORS.emerald;

  // DRR chart data
  const drrChartData = data.map((d) => ({
    label: formatDate(d.date).slice(0, 5),
    value: d.drr,
  }));

  // Ad spend chart data
  const adSpendData = data.map((d) => ({
    label: formatDate(d.date).slice(0, 5),
    value: d.ad_cost,
  }));

  const xTickInterval = Math.max(1, Math.floor(data.length / 15));

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-gray-900">Рекламные кампании</h2>

      {/* KPI Grid */}
      <div className="grid grid-cols-6 gap-3">
        <KpiBox label="Расход" value={formatCurrency(totals.ad_cost)} color={COLORS.red} />
        <KpiBox label="ДРР" value={formatPercent(totals.drr)} color={drrColor} />
        <KpiBox label="Показы" value={formatNumber(totals.impressions)} />
        <KpiBox label="Клики" value={formatNumber(totals.clicks)} />
        <KpiBox label="CTR" value={formatPercent(ctr)} />
        <KpiBox label="Заказы от рекл." value={formatNumber(totals.orders)} />
      </div>

      {/* Additional metrics */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-gray-200 p-3 bg-gradient-to-br from-gray-50 to-white">
          <div className="text-xs text-gray-500">CPC (стоимость клика)</div>
          <div className="text-lg font-bold text-gray-900 mt-0.5">{formatCurrency(cpc)}</div>
        </div>
        <div className="rounded-xl border border-gray-200 p-3 bg-gradient-to-br from-gray-50 to-white">
          <div className="text-xs text-gray-500">CPO (стоимость заказа)</div>
          <div className="text-lg font-bold text-gray-900 mt-0.5">{formatCurrency(cpo)}</div>
        </div>
        <div className="rounded-xl border border-gray-200 p-3 bg-gradient-to-br from-gray-50 to-white">
          <div className="text-xs text-gray-500">ROAS</div>
          <div className="text-lg font-bold text-gray-900 mt-0.5">×{roas.toFixed(2)}</div>
        </div>
      </div>

      {/* DRR Chart */}
      <div className="rounded-xl border border-gray-200 p-4 bg-white">
        <div className="text-sm font-semibold text-gray-700 mb-2">ДРР по дням</div>
        <PrintSvgAreaChart
          data={drrChartData}
          width={CHART_WIDTH}
          height={160}
          color={COLORS.amber}
          fillColor={COLORS.amberFill}
          yFormatter={(v) => formatPercent(v)}
          xTickInterval={xTickInterval}
        />
      </div>

      {/* Ad Spend Chart */}
      <div className="rounded-xl border border-gray-200 p-4 bg-white">
        <div className="text-sm font-semibold text-gray-700 mb-2">Расход по дням</div>
        <PrintSvgAreaChart
          data={adSpendData}
          width={CHART_WIDTH}
          height={160}
          color={COLORS.red}
          fillColor={COLORS.redFill}
          yFormatter={(v) => formatCurrency(v)}
          xTickInterval={xTickInterval}
        />
      </div>
    </div>
  );
}

function KpiBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 p-3 bg-gradient-to-br from-gray-50 to-white">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-bold mt-0.5" style={{ color: color ?? COLORS.gray900 }}>{value}</div>
    </div>
  );
}
