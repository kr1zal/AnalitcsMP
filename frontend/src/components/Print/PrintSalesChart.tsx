/**
 * Страница динамики продаж — SVG combo chart + summary boxes + insights
 */
import { COLORS, CHART_WIDTH, CHART_HEIGHT } from './print-constants';
import { PrintSvgComboChart } from './PrintSvgComboChart';
import { formatCurrency, formatNumber, formatPercent, formatDate } from '../../lib/utils';
import type { SalesChartDataPoint } from '../../types';

interface PrintSalesChartProps {
  data: SalesChartDataPoint[];
  dateFrom: string;
  dateTo: string;
}

export function PrintSalesChart({ data }: PrintSalesChartProps) {
  const totalOrders = data.reduce((s, d) => s + d.orders, 0);
  const totalSales = data.reduce((s, d) => s + d.sales, 0);
  const totalRevenue = data.reduce((s, d) => s + d.revenue, 0);
  const avgCheck = totalSales > 0 ? totalRevenue / totalSales : 0;
  const buyoutRate = totalOrders > 0 ? (totalSales / totalOrders) * 100 : 0;

  // Best/worst day
  const bestDay = [...data].sort((a, b) => b.revenue - a.revenue)[0];
  const worstDay = [...data].filter((d) => d.revenue > 0).sort((a, b) => a.revenue - b.revenue)[0];

  // Combo chart data
  const comboData = data.map((d) => ({
    label: formatDate(d.date).slice(0, 5),
    areaValue: d.revenue,
    barValue: d.orders,
  }));

  const xTickInterval = Math.max(1, Math.floor(data.length / 15));

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-gray-900">Динамика продаж</h2>

      {/* Summary boxes */}
      <div className="grid grid-cols-5 gap-3">
        <SummaryBox label="Заказы" value={formatNumber(totalOrders)} />
        <SummaryBox label="Выкупы" value={formatNumber(totalSales)} />
        <SummaryBox label="Выручка" value={formatCurrency(totalRevenue)} />
        <SummaryBox label="Ср. чек" value={formatCurrency(avgCheck)} />
        <SummaryBox label="% выкупа" value={formatPercent(buyoutRate)} />
      </div>

      {/* SVG Combo Chart */}
      <div className="rounded-xl border border-gray-200 p-4 bg-white">
        <PrintSvgComboChart
          data={comboData}
          width={CHART_WIDTH}
          height={CHART_HEIGHT}
          areaColor={COLORS.emerald}
          areaFillColor={COLORS.emeraldFill}
          barColor={COLORS.indigo}
          areaLabel="Выручка"
          barLabel="Заказы"
          areaFormatter={(v) => formatCurrency(v)}
          barFormatter={(v) => String(Math.round(v))}
          xTickInterval={xTickInterval}
        />
      </div>

      {/* Key insights */}
      <div className="grid grid-cols-2 gap-4">
        {bestDay && (
          <InsightCard
            icon="↑"
            iconColor={COLORS.emerald}
            title="Лучший день"
            value={formatCurrency(bestDay.revenue)}
            subtitle={`${formatDate(bestDay.date)} — ${formatNumber(bestDay.orders)} заказов`}
          />
        )}
        {worstDay && worstDay !== bestDay && (
          <InsightCard
            icon="↓"
            iconColor={COLORS.amber}
            title="Минимальный день"
            value={formatCurrency(worstDay.revenue)}
            subtitle={`${formatDate(worstDay.date)} — ${formatNumber(worstDay.orders)} заказов`}
          />
        )}
      </div>
    </div>
  );
}

function SummaryBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 p-3 bg-gradient-to-br from-gray-50 to-white">
      <div className="text-lg font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}

function InsightCard({
  icon,
  iconColor,
  title,
  value,
  subtitle,
}: {
  icon: string;
  iconColor: string;
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 p-3 flex items-center gap-3">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
        style={{ backgroundColor: iconColor }}
      >
        {icon}
      </div>
      <div>
        <div className="text-xs text-gray-500">{title}</div>
        <div className="text-sm font-bold text-gray-900">{value}</div>
        <div className="text-xs text-gray-400">{subtitle}</div>
      </div>
    </div>
  );
}
