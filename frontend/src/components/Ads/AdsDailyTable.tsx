/**
 * AdsDailyTable — Collapsible daily breakdown table
 */
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { formatCurrency, formatNumber, formatPercent, cn } from '../../lib/utils';
import type { AdCostsChartDataPoint, AdCostsResponse } from '../../types';

interface AdsDailyTableProps {
  data: AdCostsChartDataPoint[];
  totals: AdCostsResponse['totals'];
}

export const AdsDailyTable = ({ data, totals }: AdsDailyTableProps) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Collapsible header */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-gray-50 transition-colors"
      >
        <h3 className="text-sm sm:text-base font-semibold text-gray-900">
          Детализация по дням
          <span className="text-xs font-normal text-gray-400 ml-1.5">{data.length > 0 ? `${data.length} дн.` : 'нет данных'}</span>
        </h3>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {expanded && data.length === 0 && (
        <div className="p-6 text-center border-t border-gray-100">
          <p className="text-sm text-gray-400">Нет данных за выбранный период</p>
        </div>
      )}

      {expanded && data.length > 0 && (
        <div className="overflow-x-auto border-t border-gray-100">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Дата</th>
                <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Расход</th>
                <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Выручка</th>
                <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">ДРР</th>
                <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Показы</th>
                <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Клики</th>
                <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">CTR</th>
                <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Заказы</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.map((day) => {
                const ctr = day.impressions > 0 ? (day.clicks / day.impressions) * 100 : 0;
                return (
                  <tr key={day.date} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-2 text-sm text-gray-900 font-medium">{day.date}</td>
                    <td className="px-3 py-2 text-right text-sm text-red-600 font-medium tabular-nums">
                      {formatCurrency(day.ad_cost)}
                    </td>
                    <td className="px-3 py-2 text-right text-sm text-gray-700 tabular-nums">{formatCurrency(day.revenue)}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={cn('text-sm font-medium tabular-nums', day.drr > 20 ? 'text-red-600' : day.drr > 10 ? 'text-amber-600' : 'text-emerald-600')}>
                        {formatPercent(day.drr)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-sm text-gray-700 tabular-nums">{formatNumber(day.impressions)}</td>
                    <td className="px-3 py-2 text-right text-sm text-gray-700 tabular-nums">{formatNumber(day.clicks)}</td>
                    <td className="px-3 py-2 text-right text-sm text-gray-700 tabular-nums">{formatPercent(ctr)}</td>
                    <td className="px-3 py-2 text-right text-sm text-gray-700 tabular-nums">{formatNumber(day.orders)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-50 font-semibold">
              <tr>
                <td className="px-3 py-2.5 text-sm text-gray-900">ИТОГО</td>
                <td className="px-3 py-2.5 text-right text-sm text-red-600 tabular-nums">{formatCurrency(totals.ad_cost)}</td>
                <td className="px-3 py-2.5 text-right text-sm text-gray-900 tabular-nums">{formatCurrency(totals.revenue)}</td>
                <td className="px-3 py-2.5 text-right">
                  <span className={cn('text-sm tabular-nums', totals.drr > 20 ? 'text-red-600' : totals.drr > 10 ? 'text-amber-600' : 'text-emerald-600')}>
                    {formatPercent(totals.drr)}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right text-sm text-gray-900 tabular-nums">{formatNumber(totals.impressions)}</td>
                <td className="px-3 py-2.5 text-right text-sm text-gray-900 tabular-nums">{formatNumber(totals.clicks)}</td>
                <td className="px-3 py-2.5 text-right text-sm text-gray-700 tabular-nums">
                  {formatPercent(totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0)}
                </td>
                <td className="px-3 py-2.5 text-right text-sm text-gray-900 tabular-nums">{formatNumber(totals.orders)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};
