/**
 * Улучшенная карточка метрики (компактная, для топ-панели)
 */
import { formatCurrency, formatPercent } from '../../lib/utils';

interface MetricCardProps {
  title: string;
  value: number | string;
  format?: 'currency' | 'number' | 'percent';
  subtitle?: string;
  loading?: boolean;
}

export const MetricCard = ({ title, value, format = 'number', subtitle, loading = false }: MetricCardProps) => {
  const formatValue = (val: number | string): string => {
    if (typeof val === 'string') return val;

    switch (format) {
      case 'currency':
        return formatCurrency(val);
      case 'percent':
        return formatPercent(val);
      case 'number':
      default:
        return val.toLocaleString('ru-RU');
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="animate-pulse">
          <div className="h-3 bg-gray-200 rounded w-2/3 mb-3"></div>
          <div className="h-6 bg-gray-200 rounded w-full mb-2"></div>
          {subtitle && <div className="h-3 bg-gray-200 rounded w-1/2"></div>}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="text-xs font-medium text-gray-500 mb-2">{title}</div>
      <div className="text-2xl font-bold text-gray-900 mb-1">{formatValue(value)}</div>
      {subtitle && <div className="text-xs text-gray-500">{subtitle}</div>}
    </div>
  );
};
