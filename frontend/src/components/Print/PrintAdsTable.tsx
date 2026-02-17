/**
 * Реклама: таблица по дням — один chunk (страница)
 */
import { COLORS, DRR_THRESHOLDS } from './print-constants';
import { formatCurrency, formatNumber, formatPercent, formatDate } from '../../lib/utils';
import type { AdCostsChartDataPoint, AdCostsResponse } from '../../types';

interface PrintAdsTableProps {
  data: AdCostsChartDataPoint[];
  showTotals?: boolean;
  totals?: AdCostsResponse['totals'];
}

export function PrintAdsTable({ data, showTotals, totals }: PrintAdsTableProps) {
  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="bg-gradient-to-r from-red-50 to-orange-50">
            <th className="px-3 py-2.5 text-left font-semibold text-gray-700">Дата</th>
            <th className="px-3 py-2.5 text-right font-semibold text-gray-700">Расход</th>
            <th className="px-3 py-2.5 text-right font-semibold text-gray-700">Выручка</th>
            <th className="px-3 py-2.5 text-right font-semibold text-gray-700">ДРР</th>
            <th className="px-3 py-2.5 text-right font-semibold text-gray-700">Показы</th>
            <th className="px-3 py-2.5 text-right font-semibold text-gray-700">Клики</th>
            <th className="px-3 py-2.5 text-right font-semibold text-gray-700">CTR</th>
            <th className="px-3 py-2.5 text-right font-semibold text-gray-700">Заказы</th>
          </tr>
        </thead>
        <tbody>
          {data.map((day, i) => {
            const ctr = day.impressions > 0 ? (day.clicks / day.impressions) * 100 : 0;
            const drrColor = day.drr > DRR_THRESHOLDS.high
              ? COLORS.red
              : day.drr > DRR_THRESHOLDS.medium
                ? COLORS.amber
                : COLORS.emerald;

            return (
              <tr key={day.date} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                <td className="px-3 py-2 text-gray-900 font-medium">{formatDate(day.date)}</td>
                <td className="px-3 py-2 text-right text-gray-700 tabular-nums">{formatCurrency(day.ad_cost)}</td>
                <td className="px-3 py-2 text-right text-gray-700 tabular-nums">{formatCurrency(day.revenue)}</td>
                <td className="px-3 py-2 text-right font-medium tabular-nums" style={{ color: drrColor }}>
                  {formatPercent(day.drr)}
                </td>
                <td className="px-3 py-2 text-right text-gray-700 tabular-nums">{formatNumber(day.impressions)}</td>
                <td className="px-3 py-2 text-right text-gray-700 tabular-nums">{formatNumber(day.clicks)}</td>
                <td className="px-3 py-2 text-right text-gray-700 tabular-nums">{formatPercent(ctr)}</td>
                <td className="px-3 py-2 text-right text-gray-700 tabular-nums">{formatNumber(day.orders)}</td>
              </tr>
            );
          })}
        </tbody>

        {showTotals && totals && (
          <tfoot>
            <tr className="bg-gray-100 font-semibold text-[11px]">
              <td className="px-3 py-2.5 text-gray-900">ИТОГО</td>
              <td className="px-3 py-2.5 text-right text-gray-900 tabular-nums">{formatCurrency(totals.ad_cost)}</td>
              <td className="px-3 py-2.5 text-right text-gray-900 tabular-nums">{formatCurrency(totals.revenue)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums" style={{
                color: totals.drr > DRR_THRESHOLDS.high ? COLORS.red : totals.drr > DRR_THRESHOLDS.medium ? COLORS.amber : COLORS.emerald,
              }}>
                {formatPercent(totals.drr)}
              </td>
              <td className="px-3 py-2.5 text-right text-gray-900 tabular-nums">{formatNumber(totals.impressions)}</td>
              <td className="px-3 py-2.5 text-right text-gray-900 tabular-nums">{formatNumber(totals.clicks)}</td>
              <td className="px-3 py-2.5 text-right text-gray-900 tabular-nums">
                {formatPercent(totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0)}
              </td>
              <td className="px-3 py-2.5 text-right text-gray-900 tabular-nums">{formatNumber(totals.orders)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
