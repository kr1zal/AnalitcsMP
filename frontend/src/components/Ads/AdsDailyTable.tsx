/**
 * AdsDailyTable — Collapsible daily breakdown
 * Desktop: sortable table
 * Mobile: card view with progressive disclosure
 */
import { useState, useMemo, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import { formatCurrency, formatNumber, formatPercent, cn } from '../../lib/utils';
import type { AdCostsChartDataPoint, AdCostsResponse } from '../../types';

interface AdsDailyTableProps {
  data: AdCostsChartDataPoint[];
  totals: AdCostsResponse['totals'];
}

type SortField = 'date' | 'ad_cost' | 'revenue' | 'drr' | 'impressions' | 'clicks' | 'orders';
type SortDir = 'asc' | 'desc';

const getDrrColor = (drr: number): string => {
  if (drr > 20) return 'text-red-600';
  if (drr > 10) return 'text-amber-600';
  return 'text-emerald-600';
};

/** Format date: 2026-02-18 → 18 фев */
const formatShortDate = (date: string): string => {
  const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const parts = date.split('-');
  if (parts.length < 3) return date;
  const day = parseInt(parts[2], 10);
  const month = parseInt(parts[1], 10) - 1;
  return `${day} ${months[month] ?? ''}`;
};

export const AdsDailyTable = ({ data, totals }: AdsDailyTableProps) => {
  const [expanded, setExpanded] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const toggleCard = useCallback((key: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  }, [sortField]);

  const sorted = useMemo(() => {
    const items = [...data];
    items.sort((a, b) => {
      if (sortField === 'date') {
        return sortDir === 'desc' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date);
      }
      const getValue = (item: AdCostsChartDataPoint, f: Exclude<SortField, 'date'>): number => {
        switch (f) {
          case 'ad_cost': return item.ad_cost;
          case 'revenue': return item.revenue;
          case 'drr': return item.drr;
          case 'impressions': return item.impressions;
          case 'clicks': return item.clicks;
          case 'orders': return item.orders;
        }
      };
      const av = getValue(a, sortField);
      const bv = getValue(b, sortField);
      return sortDir === 'desc' ? bv - av : av - bv;
    });
    return items;
  }, [data, sortField, sortDir]);

  const SortHeader = ({ field, label, align = 'right' }: { field: SortField; label: string; align?: 'left' | 'right' }) => (
    <th
      className={cn(
        'px-3 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none',
        align === 'right' ? 'text-right' : 'text-left'
      )}
      onClick={() => handleSort(field)}
    >
      <span className="inline-flex items-center gap-0.5">
        {label}
        {sortField === field && (
          <ChevronDown className={cn('w-3 h-3 transition-transform', sortDir === 'asc' && 'rotate-180')} />
        )}
      </span>
    </th>
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Collapsible header */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-gray-50 transition-colors active:bg-gray-50/50"
      >
        <h3 className="text-sm sm:text-base font-semibold text-gray-900">
          Детализация по дням
          <span className="text-xs font-normal text-gray-400 ml-1.5">{data.length > 0 ? `${data.length} дн.` : 'нет данных'}</span>
        </h3>
        <ChevronDown className={cn(
          'w-4 h-4 text-gray-400 transition-transform duration-200',
          expanded && 'rotate-180'
        )} />
      </button>

      {expanded && data.length === 0 && (
        <div className="p-6 text-center border-t border-gray-100">
          <p className="text-sm text-gray-400">Нет данных за выбранный период</p>
        </div>
      )}

      {expanded && data.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto border-t border-gray-100">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <SortHeader field="date" label="Дата" align="left" />
                  <SortHeader field="ad_cost" label="Расход" />
                  <SortHeader field="revenue" label="Выручка" />
                  <SortHeader field="drr" label="ДРР" />
                  <SortHeader field="impressions" label="Показы" />
                  <SortHeader field="clicks" label="Клики" />
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">CTR</th>
                  <SortHeader field="orders" label="Заказы" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sorted.map((day) => {
                  const ctr = day.impressions > 0 ? (day.clicks / day.impressions) * 100 : 0;
                  return (
                    <tr key={day.date} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-2 text-sm text-gray-900 font-medium">{day.date}</td>
                      <td className="px-3 py-2 text-right text-sm text-red-600 font-medium tabular-nums">
                        {formatCurrency(day.ad_cost)}
                      </td>
                      <td className="px-3 py-2 text-right text-sm text-gray-700 tabular-nums">{formatCurrency(day.revenue)}</td>
                      <td className="px-3 py-2 text-right">
                        <span className={cn('text-sm font-medium tabular-nums', getDrrColor(day.drr))}>
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
                    <span className={cn('text-sm tabular-nums', getDrrColor(totals.drr))}>
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

          {/* Mobile: summary bar */}
          <div className="sm:hidden px-3 py-2 bg-gray-50/80 border-t border-gray-100 flex items-center gap-3 text-[10px] text-gray-500">
            <span>Расход <b className="text-red-600 tabular-nums">{formatCurrency(totals.ad_cost)}</b></span>
            <span>ДРР <b className={cn('tabular-nums', getDrrColor(totals.drr))}>{formatPercent(totals.drr)}</b></span>
            <span className="ml-auto text-gray-400 tabular-nums">{data.length} дн.</span>
          </div>

          {/* Mobile: expandable card list */}
          <div className="sm:hidden divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
            {sorted.map((day) => {
              const isCardExpanded = expandedCards.has(day.date);
              const ctr = day.impressions > 0 ? (day.clicks / day.impressions) * 100 : 0;
              return (
                <div key={`${day.date}-m`}>
                  <button
                    type="button"
                    onClick={() => toggleCard(day.date)}
                    className="w-full px-3 py-2.5 text-left active:bg-gray-50/50 transition-colors"
                    aria-expanded={isCardExpanded}
                  >
                    {/* Row 1: Date + chevron */}
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[13px] font-medium text-gray-900">{formatShortDate(day.date)}</span>
                      <ChevronDown className={cn(
                        'w-3.5 h-3.5 text-gray-400 transition-transform duration-200',
                        isCardExpanded && 'rotate-180'
                      )} />
                    </div>
                    {/* Row 2: Key metrics */}
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <span className="text-[10px] text-gray-400 block">Расход</span>
                        <div className="text-sm font-semibold text-red-600 tabular-nums">{formatCurrency(day.ad_cost)}</div>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-400 block">ДРР</span>
                        <div className={cn('text-sm font-semibold tabular-nums', getDrrColor(day.drr))}>
                          {formatPercent(day.drr)}
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-400 block">Заказы</span>
                        <div className="text-sm font-semibold text-gray-900 tabular-nums">{formatNumber(day.orders)}</div>
                      </div>
                    </div>
                  </button>

                  {/* Expanded details */}
                  {isCardExpanded && (
                    <div className="px-3 pb-2.5">
                      <div className="bg-gray-50 rounded-lg p-2.5">
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div>
                            <span className="text-gray-400">Выручка</span>
                            <div className="font-semibold text-gray-900 tabular-nums">{formatCurrency(day.revenue)}</div>
                          </div>
                          <div>
                            <span className="text-gray-400">Показы</span>
                            <div className="font-semibold text-gray-900 tabular-nums">{formatNumber(day.impressions)}</div>
                          </div>
                          <div>
                            <span className="text-gray-400">Клики</span>
                            <div className="font-semibold text-gray-900 tabular-nums">{formatNumber(day.clicks)}</div>
                          </div>
                          <div>
                            <span className="text-gray-400">CTR</span>
                            <div className="font-semibold text-gray-900 tabular-nums">{formatPercent(ctr)}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
