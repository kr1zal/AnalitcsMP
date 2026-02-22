/**
 * ProfitWaterfall — каскад прибыли
 * Показывает структуру: Продажи → −Удержания → −Закупка → −Реклама = Прибыль
 * Все данные рассчитаны в DashboardPage — компонент только визуализирует
 */
import { cn, formatCurrency } from '../../lib/utils';

interface ProfitWaterfallProps {
  revenue: number;
  mpDeductions: number;
  purchase: number;
  ads: number;
  profit: number;
  loading?: boolean;
}

interface WaterfallRow {
  label: string;
  value: number;
  pct: number;
  barColor: string;
  valueColor: string;
}

export const ProfitWaterfall = ({
  revenue,
  mpDeductions,
  purchase,
  ads,
  profit,
  loading = false,
}: ProfitWaterfallProps) => {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-36 mb-3" />
          {[100, 55, 28, 10, 30].map((w, i) => (
            <div key={i} className="mb-2">
              <div className="flex justify-between mb-0.5">
                <div className="h-3 bg-gray-200 rounded w-16" />
                <div className="h-3 bg-gray-200 rounded w-20" />
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full">
                <div className="h-full bg-gray-200 rounded-full" style={{ width: `${w}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!revenue || revenue <= 0) return null;

  const margin = (profit / revenue) * 100;

  const revenueRow: WaterfallRow = {
    label: 'Продажи',
    value: revenue,
    pct: 100,
    barColor: 'bg-emerald-500',
    valueColor: 'text-gray-900',
  };

  const costRows: WaterfallRow[] = [
    {
      label: 'Удерж. МП',
      value: mpDeductions,
      pct: (mpDeductions / revenue) * 100,
      barColor: 'bg-red-400',
      valueColor: 'text-red-600',
    },
    {
      label: 'Закупка',
      value: purchase,
      pct: (purchase / revenue) * 100,
      barColor: 'bg-orange-400',
      valueColor: 'text-orange-600',
    },
    {
      label: 'Реклама',
      value: ads,
      pct: (ads / revenue) * 100,
      barColor: 'bg-amber-400',
      valueColor: 'text-amber-600',
    },
  ].filter((r) => r.value > 0);

  const profitRow: WaterfallRow = {
    label: 'Прибыль',
    value: Math.abs(profit),
    pct: Math.abs(margin),
    barColor: profit >= 0 ? 'bg-indigo-500' : 'bg-red-500',
    valueColor: profit >= 0 ? 'text-indigo-700' : 'text-red-700',
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
      <div className="flex items-baseline justify-between mb-2.5 sm:mb-3">
        <h3 className="text-xs sm:text-sm font-semibold text-gray-900">Структура прибыли</h3>
        <span
          className={cn(
            'text-xs sm:text-sm font-bold tabular-nums',
            profit >= 0 ? 'text-indigo-600' : 'text-red-600'
          )}
        >
          маржа {margin.toFixed(1)}%
        </span>
      </div>

      <div className="space-y-1.5 sm:space-y-2">
        {/* Revenue */}
        <Row row={revenueRow} />

        {/* Costs */}
        {costRows.map((row) => (
          <Row key={row.label} row={row} negative />
        ))}

        {/* Divider + Profit */}
        <div className="border-t border-gray-200 pt-1.5 sm:pt-2">
          <Row row={profitRow} bold sign={profit < 0 ? '−' : ''} />
        </div>
      </div>
    </div>
  );
};

function Row({
  row,
  negative = false,
  bold = false,
  sign = '',
}: {
  row: WaterfallRow;
  negative?: boolean;
  bold?: boolean;
  sign?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <span
          className={cn(
            'text-[11px] sm:text-xs',
            bold ? `font-bold ${row.valueColor}` : 'font-medium text-gray-600'
          )}
        >
          {row.label}
        </span>
        <span
          className={cn(
            'text-[11px] sm:text-xs tabular-nums',
            bold ? `font-bold ${row.valueColor}` : `font-semibold ${row.valueColor}`
          )}
        >
          {negative ? '−\u2009' : sign}
          {formatCurrency(row.value)}
        </span>
      </div>
      <div className="h-2 sm:h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={cn(row.barColor, 'h-full rounded-full transition-all duration-500')}
          style={{ width: `${Math.max(row.value > 0 ? 2 : 0, Math.min(row.pct, 100))}%` }}
        />
      </div>
    </div>
  );
}
