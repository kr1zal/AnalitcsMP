/**
 * Plan Summary Panel — read-only status at top of UE page.
 * Shows completion progress, pace/forecast. Link to plan editor.
 */
import { useState } from 'react';
import { ChevronDown, Target, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCurrency, cn } from '../../lib/utils';
import { getCompletionBarColor, computePlanPace } from './uePlanHelpers';
import type { SalesPlanCompletionResponse } from '../../types';

const MONTHS_RU = [
  '', 'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTHS_RU[m]} ${y}`;
}

interface UePlanPanelProps {
  planData: SalesPlanCompletionResponse | undefined;
  month: string;
}

export function UePlanPanel({ planData, month }: UePlanPanelProps) {
  const [open, setOpen] = useState(true);

  const totalPlan = planData?.total_plan ?? 0;
  const totalActual = planData?.total_actual ?? 0;
  const completionPct = planData?.completion_percent ?? 0;

  // Don't render if no plan
  if (totalPlan <= 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-3 sm:px-5 py-2.5 sm:py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500">План продаж не задан</span>
          </div>
          <Link
            to="/settings?tab=plan"
            className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            Задать план
          </Link>
        </div>
      </div>
    );
  }

  // Aggregate pace
  const totalPace = planData?.period
    ? computePlanPace(totalPlan, totalActual, planData.period)
    : null;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 sm:px-5 py-2.5 sm:py-3 hover:bg-gray-50/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-indigo-500" />
          <span className="text-sm sm:text-base font-semibold text-gray-900">
            План продаж: {monthLabel(month)}
          </span>
          <span className={cn(
            'text-xs font-medium px-1.5 py-0.5 rounded tabular-nums',
            completionPct >= 100 ? 'text-emerald-600 bg-emerald-50' :
            completionPct >= 70 ? 'text-indigo-600 bg-indigo-50' :
            'text-amber-600 bg-amber-50',
          )}>
            {Math.round(completionPct)}%
          </span>
        </div>
        <ChevronDown className={cn('w-4 h-4 text-gray-400 transition-transform', open && 'rotate-180')} />
      </button>

      {/* Expanded content */}
      {open && (
        <div className="px-3 sm:px-5 pb-3 sm:pb-4 border-t border-gray-100">
          {/* Progress bar */}
          <div className="mt-3">
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', getCompletionBarColor(completionPct))}
                style={{ width: `${Math.min(100, completionPct)}%` }}
              />
            </div>

            {/* Metrics row */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
              <span className="tabular-nums">
                {formatCurrency(totalActual)} из {formatCurrency(totalPlan)}
              </span>
              {totalPace && (
                <>
                  <span className="hidden sm:inline text-gray-300">|</span>
                  <span className="tabular-nums">
                    Темп: {formatCurrency(totalPace.dailyPace)}/день
                  </span>
                  <span className="hidden sm:inline text-gray-300">|</span>
                  <span className={cn('tabular-nums font-medium',
                    totalPace.status === 'ahead' ? 'text-emerald-600' :
                    totalPace.status === 'on_track' ? 'text-indigo-600' :
                    'text-amber-600'
                  )}>
                    Прогноз: ~{Math.round(totalPace.forecastPct)}%
                  </span>
                  {totalPace.gap > 0 && (
                    <>
                      <span className="hidden sm:inline text-gray-300">|</span>
                      <span className="tabular-nums text-gray-400">
                        Нужно: {formatCurrency(totalPace.requiredDaily)}/день
                      </span>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Footer: link to plan editor */}
          <div className="mt-3 pt-2 border-t border-gray-100">
            <Link
              to="/settings?tab=plan"
              className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Редактировать план
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
