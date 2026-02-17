/**
 * StockForecastChart — Запас по дням
 * Горизонтальные бары с прогнозом остатков по товарам
 * Цвет бара зависит от порога: красный ≤7д, янтарный ≤14д, синий ≤30д, зелёный >30д
 *
 * Показывает все SKU, отсортированных по дням (критичные первыми).
 */
import { useMemo } from 'react';
import type { StockItem } from '../../types';

interface StockForecastChartProps {
  stocks: StockItem[];
  isLoading?: boolean;
}

type ThresholdColor = {
  bar: string;
  text: string;
};

function getColors(days: number | null | undefined): ThresholdColor {
  if (days == null) return { bar: 'bg-gray-300', text: 'text-gray-400' };
  if (days <= 7) return { bar: 'bg-red-500', text: 'text-red-700' };
  if (days <= 14) return { bar: 'bg-amber-500', text: 'text-amber-700' };
  if (days <= 30) return { bar: 'bg-blue-500', text: 'text-blue-700' };
  return { bar: 'bg-emerald-500', text: 'text-emerald-700' };
}

function formatDays(days: number | null | undefined): string {
  if (days == null) return '—';
  return `${Math.round(days)}д`;
}

export const StockForecastChart = ({ stocks, isLoading = false }: StockForecastChartProps) => {
  const { items, avgDays, totalCount } = useMemo(() => {
    if (!stocks?.length) return { items: [], avgDays: null, totalCount: 0 };

    const filtered = stocks.filter((s) => !s.product_name.startsWith('WB_ACCOUNT'));

    // Sort ascending by days_remaining: null (no data) last, critical first
    const sorted = [...filtered].sort((a, b) => {
      if (a.days_remaining == null && b.days_remaining == null) return 0;
      if (a.days_remaining == null) return 1;
      if (b.days_remaining == null) return -1;
      return a.days_remaining - b.days_remaining;
    });

    const withDays = filtered.filter((s) => s.days_remaining != null);
    const avg =
      withDays.length > 0
        ? Math.round(
            withDays.reduce((sum, s) => sum + (s.days_remaining ?? 0), 0) / withDays.length
          )
        : null;

    return { items: sorted, avgDays: avg, totalCount: filtered.length };
  }, [stocks]);

  const maxDays = useMemo(() => {
    const vals = items.map((s) => s.days_remaining ?? 0);
    return vals.length > 0 ? Math.max(...vals, 1) : 1;
  }, [items]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-44 mb-3" />
          {[30, 55, 70, 90, 45].map((w, i) => (
            <div key={i} className="flex items-center gap-2 mb-2.5">
              <div className="h-3 bg-gray-200 rounded w-20 sm:w-28 flex-shrink-0" />
              <div className="flex-1 h-2.5 bg-gray-100 rounded-full">
                <div className="h-full bg-gray-200 rounded-full" style={{ width: `${w}%` }} />
              </div>
              <div className="h-3 bg-gray-200 rounded w-10 flex-shrink-0" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!items.length) return null;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
      {/* Header */}
      <div className="flex items-baseline justify-between mb-2.5 sm:mb-3">
        <h3 className="text-xs sm:text-sm font-semibold text-gray-900">Запас по дням</h3>
        {avgDays != null && (
          <span className="text-[10px] sm:text-xs text-gray-400 tabular-nums">
            Ср. {avgDays}д
          </span>
        )}
      </div>

      {/* Bars */}
      <div className="space-y-2 sm:space-y-2.5">
        {items.map((item) => {
          const days = item.days_remaining;
          const colors = getColors(days);
          const pct = days != null ? (days / maxDays) * 100 : 0;

          return (
            <div
              key={item.barcode}
              className="flex items-center gap-1.5 sm:gap-2"
            >
              <span
                className="text-[11px] sm:text-xs text-gray-700 w-[72px] sm:w-28 lg:w-36 truncate flex-shrink-0"
                title={item.product_name}
              >
                {item.product_name}
              </span>
              <div className="flex-1 h-2 sm:h-2.5 bg-gray-100 rounded-full overflow-hidden min-w-[40px]">
                <div
                  className={`h-full ${colors.bar} rounded-full transition-all duration-500`}
                  style={{ width: `${Math.max(days != null ? 3 : 0, pct)}%` }}
                />
              </div>
              <span
                className={`text-[11px] sm:text-xs font-semibold tabular-nums w-10 sm:w-12 text-right flex-shrink-0 ${colors.text}`}
              >
                {formatDays(days)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Footer: legend + scroll link */}
      <div className="mt-2.5 sm:mt-3 pt-2 sm:pt-3 border-t border-gray-100 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-[10px] sm:text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
            ≤7д
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
            ≤14д
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
            ≤30д
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
            &gt;30д
          </span>
        </div>
        <button
          onClick={() =>
            document.getElementById('stocks-table')?.scrollIntoView({ behavior: 'smooth' })
          }
          className="text-[10px] sm:text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors flex-shrink-0"
        >
          все {totalCount} →
        </button>
      </div>
    </div>
  );
};
