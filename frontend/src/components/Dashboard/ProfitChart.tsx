/**
 * ProfitChart — график прибыли и выручки
 * Dual area: выручка (зелёная, фон) + оценка прибыли (индиго, передний план)
 * Визуальный зазор между ними = расходы
 *
 * Прибыль оценивается по средней марже периода:
 *   profitMargin = netProfit / revenue (из DashboardPage)
 *   dailyProfit ≈ dailyRevenue × profitMargin
 *
 * Тренд корректен, абсолютные дневные значения — оценка.
 */
import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { formatCurrency, formatDate } from '../../lib/utils';

interface ProfitChartProps {
  data: Array<{
    date: string;
    revenue?: number;
    revenuePlot?: number | null;
    __plotNull?: boolean;
  }>;
  profitMargin: number;
  isLoading?: boolean;
}

export const ProfitChart = ({ data, profitMargin, isLoading = false }: ProfitChartProps) => {
  const profitIsPositive = profitMargin >= 0;
  const profitStroke = profitIsPositive ? '#6366f1' : '#ef4444';
  const profitFill = profitIsPositive ? '#c7d2fe' : '#fecaca';

  const chartData = useMemo(() => {
    if (!data?.length) {
      const today = new Date();
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today);
        d.setDate(d.getDate() - (6 - i));
        const dateStr = d.toISOString().split('T')[0];
        return {
          date: dateStr,
          dateFormatted: formatDate(dateStr, 'dd.MM'),
          revenue: 0,
          profit: 0,
        };
      });
    }

    return data.map((item) => {
      const rev = item.revenuePlot ?? item.revenue ?? 0;
      const isNull = typeof rev !== 'number' || item.__plotNull;
      return {
        date: item.date,
        dateFormatted: formatDate(item.date, 'dd.MM'),
        revenue: isNull ? null : rev,
        profit: isNull ? null : rev * profitMargin,
      };
    });
  }, [data, profitMargin]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2 sm:p-3">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-32 mb-2" />
          <div className="h-[100px] sm:h-[140px] bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d || d.revenue === null) return null;

    const rev = d.revenue ?? 0;
    const prof = d.profit ?? 0;
    const pct = rev > 0 ? ((prof / rev) * 100).toFixed(1) : '0.0';

    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-2 sm:p-3 text-xs sm:text-sm">
        <p className="font-semibold text-gray-900 mb-1.5">
          {formatDate(d.date, 'dd.MM.yyyy')}
        </p>
        <div className="space-y-0.5">
          <p className="text-gray-700 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
            Выручка: {formatCurrency(rev)}
          </p>
          <p className="text-gray-700 flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: profitStroke }}
            />
            Прибыль*: {formatCurrency(prof)} ({pct}%)
          </p>
        </div>
        <p className="text-[10px] text-gray-400 mt-1.5 border-t border-gray-100 pt-1">
          *Оценка по средней марже периода
        </p>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2 sm:p-3">
      {/* Header + mini legend */}
      <div className="flex items-center gap-3 mb-1.5 sm:mb-2">
        <h3 className="text-xs sm:text-sm font-semibold text-gray-900">Прибыль</h3>
        <div className="flex items-center gap-2 text-[9px] sm:text-[10px] text-gray-400">
          <span className="flex items-center gap-0.5">
            <span className="w-2 h-1.5 rounded-sm bg-emerald-300 flex-shrink-0" />
            выручка
          </span>
          <span className="flex items-center gap-0.5">
            <span
              className="w-2 h-1.5 rounded-sm flex-shrink-0"
              style={{ backgroundColor: profitStroke }}
            />
            прибыль
          </span>
        </div>
      </div>

      <div className="overflow-x-auto -mx-2 sm:mx-0 px-2 sm:px-0">
        <div className="min-w-[300px] sm:min-w-0">
          <ResponsiveContainer width="100%" height={100} className="sm:!h-[140px]">
            <AreaChart data={chartData} margin={{ top: 2, right: 2, left: -15, bottom: 2 }}>
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
                tickFormatter={(v: number) => {
                  if (Math.abs(v) >= 1000) return `${Math.round(v / 1000)}к`;
                  return String(Math.round(v));
                }}
                tickLine={false}
                axisLine={false}
                width={40}
              />
              <Tooltip content={<CustomTooltip />} />
              {/* Revenue area (light green, background layer) */}
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#34d399"
                fill="#d1fae5"
                strokeWidth={1}
                fillOpacity={0.4}
                connectNulls={false}
              />
              {/* Profit area (indigo or red, foreground layer) */}
              <Area
                type="monotone"
                dataKey="profit"
                stroke={profitStroke}
                fill={profitFill}
                strokeWidth={1.5}
                fillOpacity={0.6}
                connectNulls={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
