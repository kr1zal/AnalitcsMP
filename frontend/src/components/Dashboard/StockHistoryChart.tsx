/**
 * StockHistoryChart — Динамика остатков по дням
 * Self-contained: fetches own data via useStockHistory
 * Фильтры: МП (Все/WB/Ozon) + Линии (Итого/Критичные/Per-product)
 * Данные: mp_stock_snapshots → /dashboard/stock-history
 */
import { Suspense, lazy, useCallback, useMemo, useState } from 'react';
import { formatNumber } from '../../lib/utils';
import { useStockHistory } from '../../hooks/useDashboard';
import { useFiltersStore } from '../../store/useFiltersStore';

const LazyChart = lazy(() =>
  import('./StockHistoryChartInner').then((m) => ({ default: m.StockHistoryChartInner }))
);

interface StockHistoryChartProps {
  dateFrom: string;
  dateTo: string;
  enabled?: boolean;
}

type FilterMode = 'all-products' | 'total' | 'critical' | 'custom';
type MpFilter = 'all' | 'wb' | 'ozon';

const PRODUCT_COLORS = [
  '#6366f1', // indigo
  '#f59e0b', // amber
  '#10b981', // emerald
  '#ef4444', // red
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
];

const MP_OPTIONS: { value: MpFilter; label: string }[] = [
  { value: 'all', label: 'Все МП' },
  { value: 'wb', label: 'WB' },
  { value: 'ozon', label: 'Ozon' },
];

export const StockHistoryChart = ({ dateFrom, dateTo, enabled = true }: StockHistoryChartProps) => {
  const [filterMode, setFilterMode] = useState<FilterMode>('all-products');
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [mpFilter, setMpFilter] = useState<MpFilter>('all');

  const { fulfillmentType } = useFiltersStore();
  const ftParam = fulfillmentType === 'all' ? undefined : fulfillmentType;

  const { data, isLoading } = useStockHistory(
    { date_from: dateFrom, date_to: dateTo, marketplace: mpFilter, fulfillment_type: ftParam },
    { enabled }
  );

  const toggleProduct = useCallback((pid: string) => {
    setSelectedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) {
        next.delete(pid);
      } else if (next.size < 7) {
        next.add(pid);
      }
      return next;
    });
    setFilterMode('custom');
  }, []);

  // Build chart data
  const { chartData, lines, isEmpty } = useMemo(() => {
    if (!data?.dates?.length || !data?.totals?.length) {
      return { chartData: [], lines: [], isEmpty: true };
    }

    const dates = data.dates;
    const series = data.series ?? [];
    const totals = data.totals;

    // Determine which products to show
    let visibleProducts: typeof series = [];
    if (filterMode === 'all-products') {
      visibleProducts = series.slice(0, 7);
    } else if (filterMode === 'total') {
      visibleProducts = [];
    } else if (filterMode === 'critical') {
      visibleProducts = series.filter((s) => {
        const last = s.data[s.data.length - 1] ?? 0;
        return last < 100;
      });
    } else {
      visibleProducts = series.filter((s) => selectedProducts.has(s.product_id));
    }

    // Build data points
    const points = dates.map((date, i) => {
      const point: Record<string, string | number> = {
        date: date.slice(5), // "MM-DD" for compact axis
        fullDate: date,
        total: totals[i] ?? 0,
      };
      for (const s of visibleProducts) {
        point[s.product_id] = s.data[i] ?? 0;
      }
      return point;
    });

    // Build line descriptors
    const lineDescs: { key: string; name: string; color: string; strokeDasharray?: string }[] = [
      { key: 'total', name: 'Итого', color: '#374151', strokeDasharray: '5 3' },
    ];
    visibleProducts.forEach((s, i) => {
      lineDescs.push({
        key: s.product_id,
        name: s.product_name.length > 16 ? s.product_name.slice(0, 15) + '…' : s.product_name,
        color: PRODUCT_COLORS[i % PRODUCT_COLORS.length],
      });
    });

    return { chartData: points, lines: lineDescs, isEmpty: false };
  }, [data, filterMode, selectedProducts]);

  // Current total (last value)
  const currentTotal = data?.totals?.length ? data.totals[data.totals.length - 1] : null;

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
        <div className="animate-pulse">
          <div className="flex items-center justify-between mb-3">
            <div className="h-4 bg-gray-200 rounded w-40" />
            <div className="h-4 bg-gray-200 rounded w-20" />
          </div>
          <div className="h-[160px] sm:h-[200px] bg-gray-50 rounded" />
          <div className="flex gap-2 mt-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-6 bg-gray-100 rounded-full w-20" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isEmpty || !data) return null;

  const products = data.series ?? [];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
      {/* Header */}
      <div className="flex items-baseline justify-between mb-2 sm:mb-3">
        <h3 className="text-xs sm:text-sm font-semibold text-gray-900">Динамика остатков</h3>
        {currentTotal !== null && (
          <span className="text-[10px] sm:text-xs text-gray-400 tabular-nums">
            сейчас {formatNumber(currentTotal)} шт
          </span>
        )}
      </div>

      {/* MP filter + line filter pills */}
      <div className="flex items-center gap-1.5 sm:gap-2 mb-2.5 sm:mb-3 flex-wrap">
        {/* Marketplace pills */}
        {MP_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setMpFilter(opt.value)}
            className={`px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium transition-colors ${
              mpFilter === opt.value
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {opt.label}
          </button>
        ))}

        <span className="text-gray-300 text-[10px]">|</span>

        {/* Line mode pills */}
        <button
          onClick={() => setFilterMode('total')}
          className={`px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium transition-colors ${
            filterMode === 'total'
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Итого
        </button>
        <button
          onClick={() => setFilterMode('critical')}
          className={`px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium transition-colors ${
            filterMode === 'critical'
              ? 'bg-red-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Критичные
        </button>
        <span className="text-gray-300 text-[10px]">|</span>

        {/* Select all / clear buttons */}
        <button
          onClick={() => setFilterMode('all-products')}
          className={`px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium transition-colors ${
            filterMode === 'all-products'
              ? 'bg-emerald-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Все
        </button>
        <button
          onClick={() => {
            setSelectedProducts(new Set());
            setFilterMode('total');
          }}
          className="px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors"
        >
          ✕
        </button>

        {products.map((s, i) => {
          const isSelected = filterMode === 'all-products' || selectedProducts.has(s.product_id);
          const color = PRODUCT_COLORS[i % PRODUCT_COLORS.length];
          return (
            <button
              key={s.product_id}
              onClick={() => toggleProduct(s.product_id)}
              className={`px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium transition-colors border ${
                isSelected
                  ? 'text-white border-transparent'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              }`}
              style={isSelected ? { backgroundColor: color, borderColor: color } : undefined}
              title={s.product_name}
            >
              {s.product_name.length > 10 ? s.product_name.slice(0, 9) + '…' : s.product_name}
            </button>
          );
        })}
      </div>

      {/* Chart */}
      <Suspense
        fallback={<div className="h-[160px] sm:h-[200px] bg-gray-50 rounded animate-pulse" />}
      >
        <LazyChart data={chartData} lines={lines} />
      </Suspense>
    </div>
  );
};
