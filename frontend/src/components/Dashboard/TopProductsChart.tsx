/**
 * TopProductsChart — Топ товаров по прибыли
 * Горизонтальные бары с прибылью по товарам
 * Показывает до 5 лучших + инфо об убыточных + ссылку "все товары → UE"
 *
 * Масштабируется на 100+ товаров: всегда показываем только top N.
 */
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn, formatCurrency } from '../../lib/utils';
import type { UnitEconomicsItem } from '../../types';

interface TopProductsChartProps {
  products: UnitEconomicsItem[];
  isLoading?: boolean;
}

const MAX_VISIBLE = 5;

export const TopProductsChart = ({ products, isLoading = false }: TopProductsChartProps) => {
  const navigate = useNavigate();

  const { top, lossCount, worstLoss, totalCount } = useMemo(() => {
    if (!products?.length) return { top: [], lossCount: 0, worstLoss: null, totalCount: 0 };

    const filtered = products.filter((p) => !p.product.name.startsWith('WB_ACCOUNT'));
    const sorted = [...filtered].sort((a, b) => b.metrics.net_profit - a.metrics.net_profit);
    const profitable = sorted.filter((p) => p.metrics.net_profit > 0);
    const losses = sorted.filter((p) => p.metrics.net_profit < 0);

    return {
      top: profitable.slice(0, MAX_VISIBLE),
      lossCount: losses.length,
      worstLoss: losses.length > 0 ? losses[losses.length - 1] : null,
      totalCount: filtered.length,
    };
  }, [products]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-44 mb-3" />
          {[85, 68, 52, 38, 22].map((w, i) => (
            <div key={i} className="flex items-center gap-2 mb-2.5">
              <div className="h-3 bg-gray-200 rounded w-4 flex-shrink-0" />
              <div className="h-3 bg-gray-200 rounded w-20 sm:w-28 flex-shrink-0" />
              <div className="flex-1 h-2.5 bg-gray-100 rounded-full">
                <div className="h-full bg-gray-200 rounded-full" style={{ width: `${w}%` }} />
              </div>
              <div className="h-3 bg-gray-200 rounded w-14 flex-shrink-0" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!top.length && lossCount === 0) return null;

  const maxProfit = top.length > 0 ? top[0].metrics.net_profit : 1;

  // Pluralize "товар" for Russian
  const pluralLoss = (n: number) => {
    if (n % 10 === 1 && n % 100 !== 11) return 'товар убыточен';
    if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return 'товара убыточны';
    return 'товаров убыточны';
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
      <div className="flex items-baseline justify-between mb-2.5 sm:mb-3">
        <h3 className="text-xs sm:text-sm font-semibold text-gray-900">
          Топ товаров по прибыли
        </h3>
        {totalCount > MAX_VISIBLE && (
          <button
            onClick={() => navigate('/unit-economics')}
            className="text-[10px] sm:text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
          >
            все {totalCount} →
          </button>
        )}
      </div>

      {/* Top profitable products */}
      {top.length > 0 ? (
        <div className="space-y-2 sm:space-y-2.5">
          {top.map((item, i) => {
            const pct = maxProfit > 0 ? (item.metrics.net_profit / maxProfit) * 100 : 0;
            return (
              <div key={item.product.id} className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-[10px] sm:text-xs text-gray-400 w-3 sm:w-4 text-right flex-shrink-0 tabular-nums">
                  {i + 1}
                </span>
                <span
                  className="text-[11px] sm:text-xs text-gray-700 w-[72px] sm:w-28 lg:w-36 truncate flex-shrink-0"
                  title={item.product.name}
                >
                  {item.product.name}
                </span>
                <div className="flex-1 h-2 sm:h-2.5 bg-gray-100 rounded-full overflow-hidden min-w-[40px]">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(3, pct)}%` }}
                  />
                </div>
                <span className="text-[11px] sm:text-xs font-semibold text-emerald-700 tabular-nums w-[60px] sm:w-20 text-right flex-shrink-0">
                  {formatCurrency(item.metrics.net_profit)}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-gray-400 text-center py-2">Нет прибыльных товаров</p>
      )}

      {/* Loss warning */}
      {lossCount > 0 && worstLoss && (
        <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-gray-100">
          <div className="flex items-center flex-wrap gap-x-1.5 gap-y-0.5 text-[10px] sm:text-xs">
            <span className="text-red-500 font-medium">
              {lossCount} {pluralLoss(lossCount)}
            </span>
            <span className="text-gray-300">·</span>
            <span className="text-gray-500 truncate max-w-[200px]" title={worstLoss.product.name}>
              худший: {worstLoss.product.name}
            </span>
            <span className={cn('font-semibold tabular-nums', 'text-red-600')}>
              {formatCurrency(worstLoss.metrics.net_profit)}
            </span>
          </div>
        </div>
      )}

      {/* Link to full UE page (mobile-friendly) */}
      {totalCount > MAX_VISIBLE && (
        <div className="mt-2 sm:mt-3 pt-2 border-t border-gray-50 sm:hidden">
          <button
            onClick={() => navigate('/unit-economics')}
            className="text-[11px] text-indigo-600 font-medium w-full text-center"
          >
            Все {totalCount} товаров →
          </button>
        </div>
      )}
    </div>
  );
};
