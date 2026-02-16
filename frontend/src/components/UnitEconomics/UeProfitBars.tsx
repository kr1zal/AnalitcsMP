/**
 * TOP/BOTTOM горизонтальные bars прибыли + ABC бейджи
 */
import { useMemo } from 'react';
import { formatCurrency, cn } from '../../lib/utils';
import type { UnitEconomicsItem } from '../../types';
import { type AbcGrade, ABC_STYLES, getMargin, getMarginColor, getMarginBg, TOP_COUNT, BOTTOM_COUNT } from './ueHelpers';

interface UeProfitBarsProps {
  products: UnitEconomicsItem[];
  abcMap: Map<string, AbcGrade>;
}

function AbcBadge({ grade }: { grade: AbcGrade }) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded border flex-shrink-0',
        ABC_STYLES[grade],
      )}
    >
      {grade}
    </span>
  );
}

function ProfitBar({ item, maxValue, grade }: { item: UnitEconomicsItem; maxValue: number; grade: AbcGrade }) {
  const profit = item.metrics.net_profit;
  const positive = profit >= 0;
  const width = Math.max(2, (Math.abs(profit) / maxValue) * 100);
  const margin = getMargin(item);

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <AbcBadge grade={grade} />
      <div className="w-20 sm:w-36 text-xs sm:text-sm text-gray-700 truncate flex-shrink-0" title={item.product.name}>
        {item.product.name}
      </div>
      <div className="flex-1 flex items-center gap-1.5">
        <div className="flex-1 h-4 sm:h-5 bg-gray-50 rounded overflow-hidden">
          <div
            className={cn('h-full rounded transition-all', positive ? 'bg-emerald-400' : 'bg-red-400')}
            style={{ width: `${width}%` }}
          />
        </div>
        <span
          className={cn(
            'text-xs sm:text-sm font-medium tabular-nums w-16 sm:w-20 text-right flex-shrink-0',
            positive ? 'text-emerald-700' : 'text-red-600',
          )}
        >
          {formatCurrency(profit)}
        </span>
        <span
          className={cn(
            'text-[10px] px-1 py-0.5 rounded flex-shrink-0 hidden sm:inline',
            getMarginColor(margin),
            getMarginBg(margin),
          )}
        >
          {margin.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

export function UeProfitBars({ products, abcMap }: UeProfitBarsProps) {
  const { top, bottom, restProfit, restCount } = useMemo(() => {
    const byProfit = [...products].sort((a, b) => b.metrics.net_profit - a.metrics.net_profit);
    if (byProfit.length <= TOP_COUNT + BOTTOM_COUNT) {
      return { top: byProfit, bottom: [] as UnitEconomicsItem[], restProfit: 0, restCount: 0 };
    }
    return {
      top: byProfit.slice(0, TOP_COUNT),
      bottom: byProfit.slice(-BOTTOM_COUNT).reverse(),
      restProfit: byProfit.slice(TOP_COUNT, -BOTTOM_COUNT).reduce((s, p) => s + p.metrics.net_profit, 0),
      restCount: byProfit.length - TOP_COUNT - BOTTOM_COUNT,
    };
  }, [products]);

  if (!products.length) return null;

  const maxBarProfit = Math.max(
    ...top.map((p) => Math.abs(p.metrics.net_profit)),
    ...bottom.map((p) => Math.abs(p.metrics.net_profit)),
    1,
  );

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-5">
      <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-3 sm:mb-4">
        Прибыль по товарам
      </h3>
      <div className="space-y-1.5 sm:space-y-2">
        {top.map((item) => (
          <ProfitBar key={item.product.id} item={item} maxValue={maxBarProfit} grade={abcMap.get(item.product.id) ?? 'C'} />
        ))}
      </div>
      {bottom.length > 0 && (
        <>
          <div className="my-2 sm:my-3 text-xs text-gray-400 text-center">
            ещё {restCount} товаров: {formatCurrency(restProfit)}
          </div>
          <div className="space-y-1.5 sm:space-y-2">
            {bottom.map((item) => (
              <ProfitBar key={item.product.id} item={item} maxValue={maxBarProfit} grade={abcMap.get(item.product.id) ?? 'C'} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
