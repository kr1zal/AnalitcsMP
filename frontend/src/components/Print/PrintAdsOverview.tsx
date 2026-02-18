/**
 * Реклама: enterprise обзор — 4×2 KPI + DRR chart (compact, fits with campaign table on 1 page)
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

  const xTickInterval = Math.max(1, Math.floor(data.length / 15));

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900">Рекламные кампании</h2>

      {/* 4×2 KPI Grid */}
      <div className="grid grid-cols-4 gap-2">
        <KpiBox label="Расход" value={formatCurrency(totals.ad_cost)} color={COLORS.red} />
        <KpiBox label="ДРР" value={formatPercent(totals.drr)} color={drrColor} />
        <KpiBox label="Показы" value={formatNumber(totals.impressions)} sub={`CTR ${formatPercent(ctr)}`} />
        <KpiBox label="Заказы" value={formatNumber(totals.orders)} />
        <KpiBox label="Клики" value={formatNumber(totals.clicks)} />
        <KpiBox label="CPC" value={formatCurrency(cpc)} sub="стоимость клика" />
        <KpiBox label="CPO" value={formatCurrency(cpo)} sub="стоимость заказа" />
        <KpiBox label="ROAS" value={`×${roas.toFixed(2)}`} color={roas >= 3 ? COLORS.emerald : roas >= 1 ? COLORS.amber : COLORS.red} />
      </div>

      {/* DRR Chart (compact) */}
      <div className="rounded-xl border border-gray-200 p-3 bg-white">
        <div className="text-sm font-semibold text-gray-700 mb-1.5">ДРР по дням</div>
        <PrintSvgAreaChart
          data={drrChartData}
          width={CHART_WIDTH}
          height={120}
          color={COLORS.amber}
          fillColor={COLORS.amberFill}
          yFormatter={(v) => formatPercent(v)}
          xTickInterval={xTickInterval}
        />
      </div>
    </div>
  );
}

function KpiBox({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 p-2.5 bg-gradient-to-br from-gray-50 to-white">
      <div className="text-[10px] text-gray-500 leading-tight">{label}</div>
      <div className="text-base font-bold mt-0.5 leading-tight" style={{ color: color ?? COLORS.gray900 }}>{value}</div>
      {sub && <div className="text-[9px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}
