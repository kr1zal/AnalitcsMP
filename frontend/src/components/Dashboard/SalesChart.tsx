/**
 * График продаж с табами (Заказы / Выкупы / Выручка)
 */
import { useMemo, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { TooltipContentProps } from 'recharts';
import { formatCurrency, formatDate, cn } from '../../lib/utils';
import type { SalesChartPlotPoint } from '../../types';

type ChartTab = 'orders' | 'sales' | 'revenue';

interface SalesChartProps {
  data: SalesChartPlotPoint[];
  isLoading?: boolean;
}

const TABS: { value: ChartTab; label: string }[] = [
  { value: 'orders', label: 'Заказы' },
  { value: 'sales', label: 'Выкупы' },
  { value: 'revenue', label: 'Выручка' },
];

interface SalesChartTooltipPayload {
  date: string;
  orders: number;
  sales: number;
  revenue: number;
}

const SalesChartTooltip = ({ active, payload }: Partial<TooltipContentProps<number, string>>) => {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload as SalesChartTooltipPayload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-2 sm:p-3 text-xs sm:text-sm">
      <p className="font-semibold text-gray-900 mb-1.5 sm:mb-2">
        {formatDate(d.date, 'dd.MM.yyyy')}
      </p>
      <div className="space-y-0.5 sm:space-y-1">
        <p className="text-gray-700">
          <span className="font-medium">Заказы:</span> {d.orders} шт
        </p>
        <p className="text-gray-700">
          <span className="font-medium">Выкупы:</span> {d.sales} шт
        </p>
        <p className="text-gray-700">
          <span className="font-medium">Выручка:</span> {formatCurrency(d.revenue)}
        </p>
      </div>
    </div>
  );
};

export const SalesChart = ({ data, isLoading = false }: SalesChartProps) => {
  const [activeTab, setActiveTab] = useState<ChartTab>('orders');

  const chartData = useMemo(() => {
    return (data ?? []).map((item) => ({
      ...item,
      dateFormatted: formatDate(item.date, 'dd.MM'),
      orders: item.orders ?? 0,
      sales: item.sales ?? 0,
      revenue: item.revenue ?? 0,
      ordersPlot: item.ordersPlot ?? item.orders ?? 0,
      salesPlot: item.salesPlot ?? item.sales ?? 0,
      revenuePlot: item.revenuePlot ?? item.revenue ?? 0,
    }));
  }, [data]);

  // Конфигурация для разных табов
  const config = useMemo(() => {
    switch (activeTab) {
      case 'orders':
        return {
          dataKey: 'ordersPlot',
          stroke: '#10b981',
          fill: '#d1fae5',
          name: 'Заказы',
          formatter: (v: number) => `${v} шт`,
        } as const;
      case 'sales':
        return {
          dataKey: 'salesPlot',
          stroke: '#6366f1',
          fill: '#e0e7ff',
          name: 'Выкупы',
          formatter: (v: number) => `${v} шт`,
        } as const;
      case 'revenue':
        return {
          dataKey: 'revenuePlot',
          stroke: '#8b3ffd',
          fill: '#ede9fe',
          name: 'Выручка',
          formatter: (v: number) => formatCurrency(v),
        } as const;
    }
  }, [activeTab]);

  // Если нет данных - показываем пустой график с нулями
  const displayData = useMemo(() => {
    if (!chartData || chartData.length === 0) {
      // Генерируем 7 дней с нулями для пустого графика
      const today = new Date();
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today);
        d.setDate(d.getDate() - (6 - i));
        return {
          date: d.toISOString().split('T')[0],
          dateFormatted: formatDate(d.toISOString().split('T')[0], 'dd.MM'),
          orders: 0,
          sales: 0,
          revenue: 0,
          ordersPlot: 0,
          salesPlot: 0,
          revenuePlot: 0,
        };
      });
    }
    return chartData;
  }, [chartData]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2 sm:p-3">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-20 mb-2" />
          <div className="h-[100px] sm:h-[140px] bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  // CustomTooltip is defined outside as SalesChartTooltip (above)

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2 sm:p-3">
      {/* Заголовок с табами - компактный */}
      <div className="flex items-center justify-between gap-2 mb-1.5 sm:mb-2">
        <h3 className="text-xs sm:text-sm font-semibold text-gray-900">
          {TABS.find(t => t.value === activeTab)?.label}
        </h3>
        <div className="flex gap-0.5 sm:gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                'h-5 sm:h-6 px-1.5 sm:px-2 text-[10px] sm:text-xs font-medium rounded transition-colors',
                activeTab === tab.value
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* График компактный */}
      <div className="overflow-x-auto -mx-2 sm:mx-0 px-2 sm:px-0">
        <div className="min-w-[300px] sm:min-w-0">
          <ResponsiveContainer width="100%" height={100} className="sm:!h-[140px]">
            <AreaChart data={displayData} margin={{ top: 2, right: 2, left: -15, bottom: 2 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis
                dataKey="dateFormatted"
                stroke="#9ca3af"
                style={{ fontSize: '9px' }}
                tickLine={false}
                interval="preserveStartEnd"
                tick={{ dy: 3 }}
              />
              <YAxis
                stroke="#9ca3af"
                style={{ fontSize: '9px' }}
                tickFormatter={config.formatter}
                tickLine={false}
                axisLine={false}
                width={45}
              />
              <Tooltip content={<SalesChartTooltip />} />
              <Area
                type="monotone"
                dataKey={config.dataKey}
                stroke={config.stroke}
                fill={config.fill}
                strokeWidth={1.5}
                name={config.name}
                connectNulls={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
