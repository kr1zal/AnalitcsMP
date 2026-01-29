/**
 * График продаж с табами (Заказы / Выкупы / Выручка)
 */
import { useMemo, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCurrency, formatDate, cn } from '../../lib/utils';
import { LoadingSpinner } from '../Shared/LoadingSpinner';
import type { SalesChartDataPoint } from '../../types';

type ChartTab = 'orders' | 'sales' | 'revenue';

interface SalesChartProps {
  data: SalesChartDataPoint[];
  isLoading?: boolean;
}

const TABS: { value: ChartTab; label: string }[] = [
  { value: 'orders', label: 'Заказы' },
  { value: 'sales', label: 'Выкупы' },
  { value: 'revenue', label: 'Выручка' },
];

export const SalesChart = ({ data, isLoading = false }: SalesChartProps) => {
  const [activeTab, setActiveTab] = useState<ChartTab>('orders');

  const chartData = useMemo(() => {
    return (data ?? []).map((item: any) => ({
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

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
        <LoadingSpinner text="Загрузка графика..." />
      </div>
    );
  }

  if (!chartData || chartData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-3">График продаж</h2>
        <div className="flex items-center justify-center h-64 text-gray-500">
          <p>Нет данных за выбранный период</p>
        </div>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
        <p className="text-sm font-semibold text-gray-900 mb-2">
          {formatDate(d.date, 'dd.MM.yyyy')}
        </p>
        <div className="space-y-1">
          <p className="text-sm text-gray-700">
            <span className="font-medium">Заказы:</span> {d.orders} шт
          </p>
          <p className="text-sm text-gray-700">
            <span className="font-medium">Выкупы:</span> {d.sales} шт
          </p>
          <p className="text-sm text-gray-700">
            <span className="font-medium">Выручка:</span> {formatCurrency(d.revenue)}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
      {/* Заголовок с табами */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Показать:</span>
          <div className="flex gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={cn(
                  'h-8 px-3 text-xs font-medium rounded-md transition-colors',
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
      </div>

      {/* Название активного таба */}
      <h3 className="text-base font-semibold text-gray-900 mb-3">
        {TABS.find(t => t.value === activeTab)?.label}
      </h3>

      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
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
            tickFormatter={config.formatter}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey={config.dataKey}
            stroke={config.stroke}
            fill={config.fill}
            strokeWidth={2}
            name={config.name}
            connectNulls={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
