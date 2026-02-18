/**
 * AdsChartsSection — 2-column lazy-loaded charts
 * Left: DRR trend (reuse DrrChart)
 * Right: Spend vs Revenue (lazy AdsSpendChart)
 */
import { Suspense, lazy } from 'react';
import { DrrChart } from '../Dashboard/DrrChart';
import type { AdCostsChartDataPoint } from '../../types';

const LazySpendChart = lazy(() =>
  import('./AdsSpendChart').then((m) => ({ default: m.AdsSpendChart }))
);

interface AdsChartsSectionProps {
  data: AdCostsChartDataPoint[];
  isLoading: boolean;
}

const ChartFallback = () => (
  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
    <div className="h-[160px] sm:h-[200px] bg-gray-50 rounded animate-pulse" />
  </div>
);

const EmptyChart = ({ title }: { title: string }) => (
  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2 sm:p-3">
    <h3 className="text-xs sm:text-sm font-semibold text-gray-900 mb-1.5 sm:mb-2">{title}</h3>
    <div className="h-[160px] sm:h-[200px] flex items-center justify-center">
      <p className="text-sm text-gray-300">Нет данных</p>
    </div>
  </div>
);

export const AdsChartsSection = ({ data, isLoading }: AdsChartsSectionProps) => {
  const hasData = data.length > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
      {/* ДРР по дням */}
      {hasData ? (
        <DrrChart data={data} isLoading={isLoading} />
      ) : (
        <EmptyChart title="ДРР по дням" />
      )}

      {/* Расход vs Выручка */}
      {hasData ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2 sm:p-3">
          <h3 className="text-xs sm:text-sm font-semibold text-gray-900 mb-1.5 sm:mb-2">
            Расход vs Выручка
          </h3>
          <Suspense fallback={<ChartFallback />}>
            <LazySpendChart data={data} />
          </Suspense>
        </div>
      ) : (
        <EmptyChart title="Расход vs Выручка" />
      )}
    </div>
  );
};
