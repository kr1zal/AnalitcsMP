/**
 * Страница рекламных расходов
 * ДРР, ACOS, кампании WB и Ozon Performance
 */
import { useState } from 'react';
import { useAdCosts } from '../hooks/useDashboard';
import { useFiltersStore } from '../store/useFiltersStore';
import { LoadingSpinner } from '../components/Shared/LoadingSpinner';
import { formatCurrency, formatPercent, formatNumber, getDateRangeFromPreset } from '../lib/utils';
import { Megaphone, Eye, MousePointer, ShoppingCart, TrendingUp } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export const AdsPage = () => {
  const { datePreset, customDateFrom, customDateTo } = useFiltersStore();
  const [selectedMarketplace, setSelectedMarketplace] = useState<'all' | 'wb' | 'ozon'>('all');

  const dateRange = getDateRangeFromPreset(datePreset, customDateFrom ?? undefined, customDateTo ?? undefined);

  const filters = {
    date_from: dateRange.from,
    date_to: dateRange.to,
    marketplace: selectedMarketplace,
  };

  const { data: adData, isLoading } = useAdCosts(filters);

  if (isLoading) {
    return <LoadingSpinner text="Загрузка рекламных данных..." />;
  }

  const totals = adData?.totals;
  const chartData = adData?.data || [];
  const hasData = chartData.length > 0 && (totals?.ad_cost ?? 0) > 0;

  // Метрики карточек
  const metrics = [
    {
      label: 'Рекламные расходы',
      value: totals?.ad_cost ?? 0,
      format: 'currency' as const,
      icon: Megaphone,
      color: 'text-red-600',
      bg: 'bg-red-50',
    },
    {
      label: 'ДРР',
      value: totals?.drr ?? 0,
      format: 'percent' as const,
      icon: TrendingUp,
      color: (totals?.drr ?? 0) <= 20 ? 'text-green-600' : 'text-orange-600',
      bg: (totals?.drr ?? 0) <= 20 ? 'bg-green-50' : 'bg-orange-50',
      subtitle: 'Доля рекламных расходов',
    },
    {
      label: 'Показы',
      value: totals?.impressions ?? 0,
      format: 'number' as const,
      icon: Eye,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Клики',
      value: totals?.clicks ?? 0,
      format: 'number' as const,
      icon: MousePointer,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      subtitle: totals && totals.impressions > 0
        ? `CTR: ${formatPercent(totals.clicks / totals.impressions * 100)}`
        : undefined,
    },
    {
      label: 'Заказы из рекламы',
      value: totals?.orders ?? 0,
      format: 'number' as const,
      icon: ShoppingCart,
      color: 'text-green-600',
      bg: 'bg-green-50',
      subtitle: totals && totals.clicks > 0
        ? `CR: ${formatPercent(totals.orders / totals.clicks * 100)}`
        : undefined,
    },
    {
      label: 'CPC',
      value: totals && totals.clicks > 0 ? totals.ad_cost / totals.clicks : 0,
      format: 'currency' as const,
      icon: MousePointer,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      subtitle: 'Стоимость клика',
    },
  ];

  // Форматированные данные для графика
  const formattedChartData = chartData.map(d => ({
    ...d,
    date: d.date.slice(5), // MM-DD
  }));

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Рекламные расходы</h2>
          <p className="text-sm text-gray-500 mt-1">
            Период: {dateRange.from} — {dateRange.to}
          </p>
        </div>
        <div className="flex gap-2">
          {(['all', 'wb', 'ozon'] as const).map((mp) => (
            <button
              key={mp}
              onClick={() => setSelectedMarketplace(mp)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                selectedMarketplace === mp
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {mp === 'all' ? 'Все' : mp.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {!hasData ? (
        /* Состояние без данных */
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <Megaphone className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg font-medium">Нет рекламных данных за период</p>
          <p className="text-sm text-gray-400 mt-2">
            Синхронизируйте рекламные данные на странице "Синхронизация" или проверьте наличие активных кампаний
          </p>
        </div>
      ) : (
        <>
          {/* Карточки метрик */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            {metrics.map((m, idx) => {
              const Icon = m.icon;
              let displayValue: string;
              if (m.format === 'currency') displayValue = formatCurrency(m.value);
              else if (m.format === 'percent') displayValue = formatPercent(m.value);
              else displayValue = formatNumber(m.value);

              return (
                <div key={idx} className={`rounded-lg p-4 ${m.bg}`}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Icon className={`w-3.5 h-3.5 ${m.color}`} />
                    <span className="text-xs text-gray-600">{m.label}</span>
                  </div>
                  <div className={`text-lg font-bold ${m.color}`}>{displayValue}</div>
                  {m.subtitle && (
                    <div className="text-xs text-gray-500 mt-1">{m.subtitle}</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Графики */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* ДРР по дням */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">ДРР по дням (%)</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={formattedChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any) => [`${Number(value).toFixed(1)}%`, 'ДРР']}
                    labelFormatter={(label: any) => `Дата: ${label}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="drr"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    name="ДРР"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Расходы vs Выручка */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Расходы vs Выручка</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={formattedChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any, name: any) => [
                      formatCurrency(Number(value)),
                      name === 'ad_cost' ? 'Реклама' : 'Выручка'
                    ]}
                  />
                  <Legend formatter={(value) => value === 'ad_cost' ? 'Реклама' : 'Выручка'} />
                  <Bar dataKey="revenue" fill="#6366f1" opacity={0.3} name="revenue" />
                  <Bar dataKey="ad_cost" fill="#ef4444" name="ad_cost" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Таблица по дням */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Детализация по дням</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Дата</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Расход</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Выручка</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">ДРР</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Показы</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Клики</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Заказы</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {chartData.map((day) => (
                    <tr key={day.date} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-900">{day.date}</td>
                      <td className="px-4 py-3 text-right text-sm text-red-600 font-medium">
                        {formatCurrency(day.ad_cost)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm">{formatCurrency(day.revenue)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-sm font-medium ${day.drr <= 20 ? 'text-green-600' : 'text-orange-600'}`}>
                          {formatPercent(day.drr)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-sm">{formatNumber(day.impressions)}</td>
                      <td className="px-4 py-3 text-right text-sm">{formatNumber(day.clicks)}</td>
                      <td className="px-4 py-3 text-right text-sm">{day.orders}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 font-semibold">
                  <tr>
                    <td className="px-4 py-3 text-sm">ИТОГО</td>
                    <td className="px-4 py-3 text-right text-sm text-red-600">{formatCurrency(totals?.ad_cost ?? 0)}</td>
                    <td className="px-4 py-3 text-right text-sm">{formatCurrency(totals?.revenue ?? 0)}</td>
                    <td className="px-4 py-3 text-right text-sm">{formatPercent(totals?.drr ?? 0)}</td>
                    <td className="px-4 py-3 text-right text-sm">{formatNumber(totals?.impressions ?? 0)}</td>
                    <td className="px-4 py-3 text-right text-sm">{formatNumber(totals?.clicks ?? 0)}</td>
                    <td className="px-4 py-3 text-right text-sm">{totals?.orders ?? 0}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
