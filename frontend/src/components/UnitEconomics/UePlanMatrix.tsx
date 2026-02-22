/**
 * BCG-style Plan × Profit Matrix (2×2).
 * Quadrants: Звёзды | Ловушки | Потенциал | Проблемы.
 * Click → filters table. Click again → deselect.
 */
import { formatCurrency, cn } from '../../lib/utils';
import type { QuadrantData, MatrixQuadrant } from './uePlanHelpers';

interface UePlanMatrixProps {
  quadrants: QuadrantData[];
  activeQuadrant: MatrixQuadrant | null;
  onQuadrantClick: (q: MatrixQuadrant) => void;
}

function QuadrantCard({
  data,
  active,
  onClick,
}: {
  data: QuadrantData;
  active: boolean;
  onClick: () => void;
}) {
  const empty = data.count === 0;

  return (
    <button
      onClick={onClick}
      disabled={empty}
      className={cn(
        'text-left rounded-lg border-l-4 p-2.5 sm:p-3.5 transition-all',
        data.borderColor,
        active ? 'ring-2 ring-offset-1 ring-indigo-400 shadow-md' : '',
        empty
          ? 'opacity-40 cursor-not-allowed bg-gray-50/30'
          : cn(data.bgColor, 'hover:shadow-sm cursor-pointer'),
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-sm sm:text-base">{data.icon}</span>
        <span className={cn('text-xs sm:text-sm font-semibold', data.color)}>{data.label}</span>
        <span className={cn(
          'ml-auto text-xs sm:text-sm font-bold tabular-nums',
          data.color,
        )}>
          {data.count}
        </span>
      </div>

      {/* Description */}
      <p className="text-[10px] sm:text-xs text-gray-500 leading-tight mb-1.5 sm:mb-2">
        {data.description}
      </p>

      {/* Metrics */}
      {!empty && (
        <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs">
          <span className="text-gray-500 tabular-nums">
            <span className="hidden sm:inline">Выручка: </span>{formatCurrency(data.totalRevenue)}
          </span>
          <span className={cn('font-medium tabular-nums',
            data.totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600',
          )}>
            <span className="hidden sm:inline">Прибыль: </span>
            {formatCurrency(data.totalProfit)}
          </span>
        </div>
      )}
    </button>
  );
}

export function UePlanMatrix({ quadrants, activeQuadrant, onQuadrantClick }: UePlanMatrixProps) {
  const totalProducts = quadrants.reduce((s, q) => s + q.count, 0);
  if (totalProducts === 0) return null;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm sm:text-base font-semibold text-gray-900">
          План × Прибыль
        </h3>
        <span className="text-[10px] sm:text-xs text-gray-400">
          {totalProducts} товаров с планом
        </span>
      </div>

      {/* 2x2 grid: top row = plan ≥70%, bottom row = plan <70% */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {/* Row labels (desktop only) */}
        <div className="col-span-2 hidden sm:grid grid-cols-2 gap-3 text-[10px] text-gray-400 -mb-1">
          <span className="text-center">План ≥70% · Прибылен</span>
          <span className="text-center">План ≥70% · Убыточен</span>
        </div>

        {quadrants.map((q) => (
          <QuadrantCard
            key={q.quadrant}
            data={q}
            active={activeQuadrant === q.quadrant}
            onClick={() => onQuadrantClick(q.quadrant)}
          />
        ))}

        <div className="col-span-2 hidden sm:grid grid-cols-2 gap-3 text-[10px] text-gray-400 -mt-1">
          <span className="text-center">{`План <70% · Прибылен`}</span>
          <span className="text-center">{`План <70% · Убыточен`}</span>
        </div>
      </div>
    </div>
  );
}
