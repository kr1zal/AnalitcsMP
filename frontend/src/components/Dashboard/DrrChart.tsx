/**
 * График ДРР (Доля Рекламных Расходов)
 */
import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCurrency, formatDate } from '../../lib/utils';
import type { AdCostsChartDataPoint } from '../../types';

interface DrrChartProps {
  data: AdCostsChartDataPoint[];
  isLoading?: boolean;
}

export const DrrChart = ({ data, isLoading = false }: DrrChartProps) => {
  const chartData = useMemo(() => {
    return (data ?? []).map((item) => ({
      ...item,
      dateFormatted: formatDate(item.date, 'dd.MM'),
      drr: item.drr || 0,
      ad_cost: item.ad_cost || 0,
      revenue: item.revenue || 0,
    }));
  }, [data]);

  // Если нет данных - показываем пустой график с нулями
  const displayData = useMemo(() => {
    if (!chartData || chartData.length === 0) {
      const today = new Date();
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today);
        d.setDate(d.getDate() - (6 - i));
        return {
          date: d.toISOString().split('T')[0],
          dateFormatted: formatDate(d.toISOString().split('T')[0], 'dd.MM'),
          drr: 0,
          ad_cost: 0,
          revenue: 0,
        };
      });
    }
    return chartData;
  }, [chartData]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2 sm:p-3">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-12 mb-2" />
          <div className="h-[80px] sm:h-[100px] bg-gray-100 rounded" />
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
          <span className="font-medium">ДРР:</span> {(d.drr || 0).toFixed(1)}%
        </p>
        <p className="text-sm text-gray-700">
          <span className="font-medium">Расход:</span> {formatCurrency(d.ad_cost || 0)}
        </p>
        <p className="text-sm text-gray-700">
          <span className="font-medium">Выручка:</span> {formatCurrency(d.revenue || 0)}
        </p>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2 sm:p-3">
      <h3 className="text-xs sm:text-sm font-semibold text-gray-900 mb-1.5 sm:mb-2">ДРР</h3>
      <ResponsiveContainer width="100%" height={80} className="sm:!h-[100px]">
        <AreaChart data={displayData} margin={{ top: 2, right: 2, left: -15, bottom: 2 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis
            dataKey="dateFormatted"
            stroke="#9ca3af"
            style={{ fontSize: '9px' }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            stroke="#9ca3af"
            style={{ fontSize: '9px' }}
            tickFormatter={(v) => `${v}%`}
            tickLine={false}
            axisLine={false}
            width={35}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="drr"
            stroke="#f59e0b"
            fill="#fef3c7"
            strokeWidth={1.5}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
