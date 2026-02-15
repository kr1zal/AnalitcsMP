/**
 * Карточка выполнения плана продаж на Dashboard.
 * Показывается только если total_plan > 0 (пользователь задал план).
 */
import { Target } from 'lucide-react';
import { formatCurrency, cn } from '../../lib/utils';
import type { SalesPlanCompletionResponse } from '../../types';

interface PlanCompletionCardProps {
  data: SalesPlanCompletionResponse | undefined;
  loading?: boolean;
}

function getCompletionColor(pct: number): { bar: string; text: string; bg: string } {
  if (pct >= 100) return { bar: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' };
  if (pct >= 70) return { bar: 'bg-indigo-500', text: 'text-indigo-700', bg: 'bg-indigo-50' };
  return { bar: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50' };
}

export function PlanCompletionCard({ data, loading }: PlanCompletionCardProps) {
  // Don't render if no plan set
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

  const { total_plan, total_actual, completion_percent, month_label } = data;
  const colors = getCompletionColor(completion_percent);
  const clampedWidth = Math.min(100, completion_percent);

  return (
    <div className={cn('rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4', colors.bg)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Target className={cn('w-3.5 h-3.5', colors.text)} />
          <span className="text-xs font-medium text-gray-600">План продаж</span>
        </div>
        <span className="text-[10px] text-gray-400">{month_label}</span>
      </div>

      {/* Percentage */}
      <div className={cn('text-2xl sm:text-3xl font-bold tabular-nums mb-1.5', colors.text)}>
        {completion_percent}%
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 sm:h-2.5 bg-white/60 rounded-full overflow-hidden mb-1.5">
        <div
          className={cn('h-full rounded-full transition-all duration-500', colors.bar)}
          style={{ width: `${clampedWidth}%` }}
        />
      </div>

      {/* Amounts */}
      <div className="text-xs text-gray-600 tabular-nums">
        {formatCurrency(total_actual)} / {formatCurrency(total_plan)}
      </div>
    </div>
  );
}
