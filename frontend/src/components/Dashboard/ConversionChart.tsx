/**
 * ConversionChart — график конверсии (выкуп %)
 * Показывает % выкупленных заказов по дням: sales / orders × 100
 * Ключевая метрика: если конверсия падает — проблемы с доставкой/товаром
 */
import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatDate } from '../../lib/utils';

interface ConversionChartProps {
  data: Array<{
    date: string;
    orders?: number;
    sales?: number;
    ordersPlot?: number | null;
    salesPlot?: number | null;
    __plotNull?: boolean;
  }>;
  isLoading?: boolean;
}

export const ConversionChart = ({ data, isLoading = false }: ConversionChartProps) => {
  const chartData = useMemo(() => {
    if (!data?.length) {
      const today = new Date();
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today);
        d.setDate(d.getDate() - (6 - i));
        const dateStr = d.toISOString().split('T')[0];
        return { date: dateStr, dateFormatted: formatDate(dateStr, 'dd.MM'), conversion: 0, orders: 0, sales: 0 };
      });
    }

    return data.map((item) => {
      const orders = item.ordersPlot ?? item.orders ?? 0;
      const sales = item.salesPlot ?? item.sales ?? 0;
      const isNull = orders === null || sales === null || item.__plotNull;
      return {
        date: item.date,
        dateFormatted: formatDate(item.date, 'dd.MM'),
        conversion: isNull ? null : (typeof orders === 'number' && orders > 0 ? (Number(sales) / orders) * 100 : 0),
        orders: isNull ? null : orders,
        sales: isNull ? null : sales,
      };
    });
  }, [data]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2 sm:p-3">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-20 mb-2" />
          <div className="h-[80px] sm:h-[100px] bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d || d.conversion === null) return null;

    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-2 sm:p-3 text-xs sm:text-sm">
        <p className="font-semibold text-gray-900 mb-1">
          {formatDate(d.date, 'dd.MM.yyyy')}
        </p>
        <div className="space-y-0.5">
          <p className="text-gray-700">
            <span className="font-medium">Конверсия:</span> {(d.conversion ?? 0).toFixed(1)}%
          </p>
          <p className="text-gray-700">
            <span className="font-medium">Заказы:</span> {d.orders ?? 0} шт
          </p>
          <p className="text-gray-700">
            <span className="font-medium">Выкупы:</span> {d.sales ?? 0} шт
          </p>
        </div>
        <p className="text-[10px] text-gray-400 mt-1 border-t border-gray-100 pt-1">
          Выкупы / Заказы × 100%
        </p>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2 sm:p-3">
      <h3 className="text-xs sm:text-sm font-semibold text-gray-900 mb-1.5 sm:mb-2">Конверсия</h3>
      <ResponsiveContainer width="100%" height={80} className="sm:!h-[100px]">
        <AreaChart data={chartData} margin={{ top: 2, right: 2, left: -15, bottom: 2 }}>
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
            dataKey="conversion"
            stroke="#0ea5e9"
            fill="#e0f2fe"
            strokeWidth={1.5}
            connectNulls={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
