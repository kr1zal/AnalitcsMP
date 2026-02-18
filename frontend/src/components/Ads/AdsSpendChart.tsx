/**
 * AdsSpendChart — Bar chart: Расход vs Выручка (lazy-loaded)
 */
import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { formatCurrency, formatDate } from '../../lib/utils';
import type { AdCostsChartDataPoint } from '../../types';

interface AdsSpendChartProps {
  data: AdCostsChartDataPoint[];
}

interface TooltipEntry {
  dataKey: string;
  color: string;
  name: string;
  value: number;
  payload?: Record<string, string | number>;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
}

const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-2 sm:p-3 text-xs">
      <p className="font-medium text-gray-900 mb-1">
        {formatDate(String(payload[0]?.payload?.fullDate || ''), 'dd.MM.yyyy')}
      </p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
          <span className="text-gray-600">{entry.name}:</span>
          <span className="font-semibold text-gray-900 tabular-nums">{formatCurrency(entry.value)}</span>
        </div>
      ))}
    </div>
  );
};

export const AdsSpendChart = ({ data }: AdsSpendChartProps) => {
  const chartData = useMemo(() =>
    data.map((d) => ({
      ...d,
      date: formatDate(d.date, 'dd.MM'),
      fullDate: d.date,
    })),
    [data]
  );

  return (
    <div className="h-[160px] sm:h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={{ stroke: '#e5e7eb' }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={(value: string) => (
              <span className="text-xs text-gray-600">
                {value === 'revenue' ? 'Выручка' : 'Расход'}
              </span>
            )}
          />
          <Bar dataKey="revenue" fill="#6366f1" opacity={0.25} name="revenue" radius={[2, 2, 0, 0]} />
          <Bar dataKey="ad_cost" fill="#ef4444" name="ad_cost" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
