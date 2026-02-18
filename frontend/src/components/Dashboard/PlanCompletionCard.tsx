/**
 * PlanCompletionCard v2 — Enterprise card with pace, forecast, days.
 * Clickable link to /settings?tab=plan.
 */
import { useNavigate } from 'react-router-dom';
import { Target, TrendingUp, ArrowRight, CheckCircle, AlertTriangle } from 'lucide-react';
import { formatCurrency, cn } from '../../lib/utils';
import type { SalesPlanCompletionResponse } from '../../types';

interface PlanCompletionCardProps {
  data: SalesPlanCompletionResponse | undefined;
  loading?: boolean;
}

function getColors(forecastPct: number) {
  if (forecastPct >= 100) return { bar: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' };
  if (forecastPct >= 80) return { bar: 'bg-indigo-500', text: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' };
  return { bar: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' };
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(Math.round(value));
}

export function PlanCompletionCard({ data, loading }: PlanCompletionCardProps) {
  const navigate = useNavigate();

  if (!data || data.total_plan <= 0) return null;

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
        <div className="h-8 bg-gray-100 rounded w-1/2 mb-2" />
        <div className="h-2.5 bg-gray-100 rounded-full" />
      </div>
    );
  }

  const {
    total_plan, total_actual, completion_percent, month_label,
    pace_daily = 0, required_pace = 0,
    forecast_revenue = 0, forecast_percent = 0,
    days_remaining = 0,
  } = data;

  const colors = getColors(forecast_percent || completion_percent);
  const clampedWidth = Math.min(100, completion_percent);
  const isFinished = days_remaining === 0;
  const forecastOk = forecast_percent >= 100;

  return (
    <div className={cn('rounded-xl shadow-sm border p-3 sm:p-4', colors.bg, colors.border)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Target className={cn('w-3.5 h-3.5', colors.text)} />
          <span className="text-xs font-medium text-gray-600">План продаж</span>
          <span className="text-[10px] text-gray-400 ml-1">{month_label}</span>
        </div>
        <button
          onClick={() => navigate('/settings?tab=plan')}
          className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-indigo-600 transition-colors"
        >
          Настроить
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {/* Main: percentage + amounts */}
      <div className="flex items-baseline justify-between mb-1.5">
        <span className={cn('text-2xl sm:text-3xl font-bold tabular-nums', colors.text)}>
          {completion_percent}%
        </span>
        <span className="text-xs text-gray-500 tabular-nums">
          {formatCurrency(total_actual)} / {formatCurrency(total_plan)}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 sm:h-2.5 bg-white/60 rounded-full overflow-hidden mb-3">
        <div
          className={cn('h-full rounded-full transition-all duration-500', colors.bar)}
          style={{ width: `${clampedWidth}%` }}
        />
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-3 gap-2 text-center mb-2">
        <div>
          <div className="text-[10px] text-gray-400">Темп</div>
          <div className="text-xs font-semibold text-gray-700 tabular-nums">
            {formatCompact(pace_daily)}₽/д
          </div>
        </div>
        <div>
          <div className="text-[10px] text-gray-400">{isFinished ? 'Нужно было' : 'Нужно'}</div>
          <div className={cn('text-xs font-semibold tabular-nums', required_pace > pace_daily && !isFinished ? 'text-red-600' : 'text-gray-700')}>
            {formatCompact(required_pace)}₽/д
          </div>
        </div>
        <div>
          <div className="text-[10px] text-gray-400">{isFinished ? 'Дней' : 'Осталось'}</div>
          <div className="text-xs font-semibold text-gray-700 tabular-nums">
            {isFinished ? '0' : days_remaining} дн.
          </div>
        </div>
      </div>

      {/* Forecast row */}
      <div className={cn(
        'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5',
        forecastOk ? 'bg-emerald-100/60' : 'bg-amber-100/60'
      )}>
        {forecastOk
          ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
          : <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
        }
        <span className={cn('text-xs font-medium', forecastOk ? 'text-emerald-700' : 'text-amber-700')}>
          {isFinished ? 'Итог' : 'Прогноз'}:{' '}
          <span className="tabular-nums">{formatCurrency(isFinished ? total_actual : forecast_revenue)}</span>
          {' '}
          <span className="tabular-nums">({isFinished ? completion_percent : forecast_percent}%)</span>
        </span>
        <TrendingUp className={cn('w-3 h-3 ml-auto flex-shrink-0', forecastOk ? 'text-emerald-500' : 'text-amber-500')} />
      </div>
    </div>
  );
}
