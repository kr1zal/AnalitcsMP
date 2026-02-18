/**
 * AdsChartsSection — 2-column charts
 * Left: DRR trend (reuse DrrChart)
 * Right: Spend vs Revenue (AdsSpendChart)
 *
 * NOTE: DrrChart is already statically imported → Recharts in main bundle.
 * Lazy-loading AdsSpendChart was causing Recharts "width(-1)" warnings
 * due to Suspense timing. Static import eliminates the issue.
 */
import { DrrChart } from '../Dashboard/DrrChart';
import { AdsSpendChart } from './AdsSpendChart';
import type { AdCostsChartDataPoint } from '../../types';

interface AdsChartsSectionProps {
  data: AdCostsChartDataPoint[];
  isLoading: boolean;
}

const EmptyChart = ({ title }: { title: string }) => (
  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
    <h3 className="text-xs sm:text-sm font-semibold text-gray-900 mb-1.5 sm:mb-2">{title}</h3>
    <div className="h-[180px] sm:h-[220px] flex items-center justify-center">
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
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
          <h3 className="text-xs sm:text-sm font-semibold text-gray-900 mb-1.5 sm:mb-2">
            Расход vs Выручка
          </h3>
          <AdsSpendChart data={data} />
        </div>
      ) : (
        <EmptyChart title="Расход vs Выручка" />
      )}
    </div>
  );
};
