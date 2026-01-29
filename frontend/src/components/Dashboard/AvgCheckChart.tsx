/**
 * График среднего чека (BarChart)
 */
import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCurrency, formatDate } from '../../lib/utils';
import type { SalesChartDataPoint } from '../../types';

interface AvgCheckChartProps {
  data: SalesChartDataPoint[];
  isLoading?: boolean;
}

export const AvgCheckChart = ({ data, isLoading = false }: AvgCheckChartProps) => {
  const chartData = useMemo(() => {
    return (data ?? []).map((item) => ({
      ...item,
      dateFormatted: formatDate(item.date, 'dd.MM'),
      avg_check: item.avg_check || 0, // Защита от undefined/null
    }));
  }, [data]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
        <div className="animate-pulse">
          <div className="h-5 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="h-48 bg-gray-100 rounded"></div>
        </div>
      </div>
    );
  }

  if (!chartData || chartData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Средний чек</h3>
        <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
          Нет данных за выбранный период
        </div>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
        <p className="text-sm font-semibold text-gray-900 mb-1">
          {formatDate(d.date, 'dd.MM.yyyy')}
        </p>
        <p className="text-sm text-gray-700">
          <span className="font-medium">Средний чек:</span> {formatCurrency(d.avg_check || 0)}
        </p>
        <p className="text-xs text-gray-500">
          {d.sales} продаж на {formatCurrency(d.revenue)}
        </p>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
      <h3 className="text-base font-semibold text-gray-900 mb-3">Средний чек</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis
            dataKey="dateFormatted"
            stroke="#6b7280"
            style={{ fontSize: '11px' }}
            tickLine={false}
          />
          <YAxis
            stroke="#6b7280"
            style={{ fontSize: '11px' }}
            tickFormatter={(v) => `${v}₽`}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            dataKey="avg_check"
            fill="#6366f1"
            radius={[2, 2, 0, 0]}
            maxBarSize={24}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
