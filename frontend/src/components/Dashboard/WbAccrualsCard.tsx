/**
 * WB Accruals summary card (по аналогии с OZON блоком, но семантика WB).
 * Источник данных: /dashboard/costs-tree (marketplace=wb).
 */
import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';
import type { CostsTreeItem, CostsTreeResponse, MpProfitData } from '../../types';

interface WbAccrualsCardProps {
  /** Если задано — детализация контролируется снаружи (синхронизация с OZON карточкой). */
  detailsOpen?: boolean;
  onToggleDetails?: () => void;
  /** Данные costs-tree передаются из родителя (DashboardPage). */
  costsTreeData?: CostsTreeResponse | null;
  isLoading?: boolean;
  /** Прибыль по этому МП (рассчитывается в DashboardPage). */
  profitData?: MpProfitData | null;
}

type ColorToken = 'sales' | 'reward' | 'logistics' | 'acquiring' | 'storage' | 'penalties' | 'other';

const COLORS: Record<ColorToken, { dot: string; bar: string }> = {
  sales: { dot: 'bg-teal-500', bar: 'bg-teal-400' },
  reward: { dot: 'bg-purple-500', bar: 'bg-purple-500' },
  logistics: { dot: 'bg-yellow-300', bar: 'bg-yellow-300' },
  acquiring: { dot: 'bg-violet-400', bar: 'bg-violet-400' },
  storage: { dot: 'bg-orange-400', bar: 'bg-orange-400' },
  penalties: { dot: 'bg-pink-500', bar: 'bg-pink-500' },
  other: { dot: 'bg-gray-300', bar: 'bg-gray-300' },
};

function formatWbAmount(amount: number): string {
  // Без символа ₽ — экономит место на мобиле
  const abs = new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(amount));
  return amount < 0 ? `-${abs}` : abs;
}

function pct(partAbs: number, totalAbs: number): number {
  if (totalAbs <= 0) return 0;
  return Math.max(0, Math.min(100, (partAbs / totalAbs) * 100));
}

function formatExactSigned(amount: number): string {
  const abs = formatCurrency(Math.abs(amount));
  return amount < 0 ? `-${abs}` : abs;
}

function pickCostColor(category: string): ColorToken {
  if (category === 'Вознаграждение Вайлдберриз (ВВ)') return 'reward';
  if (category === 'Эквайринг/Комиссии за организацию платежей') return 'acquiring';
  if (category === 'Услуги по доставке товара покупателю') return 'logistics';
  if (category === 'Стоимость хранения') return 'storage';
  if (category === 'Общая сумма штрафов') return 'penalties';
  return 'other';
}

export const WbAccrualsCard = ({
  detailsOpen,
  onToggleDetails,
  costsTreeData,
  isLoading: isLoadingProp,
  profitData,
}: WbAccrualsCardProps) => {
  const [showDetailsLocal, setShowDetailsLocal] = useState(false);
  const controlled = typeof detailsOpen === 'boolean';
  const showDetails = controlled ? detailsOpen : showDetailsLocal;
  const toggleDetails = controlled ? (onToggleDetails ?? (() => {})) : () => setShowDetailsLocal((v) => !v);

  const data = costsTreeData;
  const isLoading = isLoadingProp ?? false;

  const computed = useMemo(() => {
    const tree = data?.tree ?? [];
    const salesItem = tree.find((t) => t.name === 'Продажи');
    const costItems = tree.filter((t) => t.name !== 'Продажи');

    const salesTotal = salesItem?.amount ?? 0;
    const costsTotal = costItems.reduce((acc, t) => acc + (t.amount < 0 ? t.amount : 0), 0);
    const creditsTotal = costItems.reduce((acc, t) => acc + (t.amount > 0 ? t.amount : 0), 0);
    const costsForList: CostsTreeItem[] = [...costItems]
      .filter((t) => t.amount < 0)
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

    return {
      tree,
      costItems,
      salesTotal,
      costsTotal,
      creditsTotal,
      costsForList,
      totalAccrued: data?.total_accrued ?? 0,
      percentBaseSales: data?.percent_base_sales ?? null,
      warnings: data?.warnings,
      source: data?.source,
    };
  }, [data]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-5">
        <div className="animate-pulse space-y-3">
          <div className="h-5 bg-gray-200 rounded w-12" />
          <div className="h-8 bg-gray-100 rounded w-24" />
          <div className="h-1.5 bg-gray-100 rounded w-full" />
          <div className="space-y-2">
            <div className="h-3 bg-gray-50 rounded w-32" />
            <div className="h-3 bg-gray-50 rounded w-28" />
          </div>
        </div>
      </div>
    );
  }

  if (!data?.tree?.length) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-5">
        <h3 className="text-base sm:text-lg font-bold mb-2" style={{ color: '#8B3FFD' }}>
          WB
        </h3>
        <div className="text-center py-4 sm:py-6">
          <div className="text-sm text-gray-400">Нет данных за период</div>
        </div>
      </div>
    );
  }

  const costsAbs = Math.abs(computed.costsTotal);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-5">
      <div className="flex items-center justify-between mb-2 sm:mb-4">
        <h3 className="text-base sm:text-lg font-bold" style={{ color: '#8B3FFD' }}>
          WB
        </h3>
        <button
          type="button"
          onClick={toggleDetails}
          className="text-xs sm:text-sm text-purple-600 hover:text-purple-700 font-medium flex items-center gap-0.5 sm:gap-1"
        >
          {showDetails ? 'Свернуть' : 'Детали'}
          {showDetails ? <ChevronUp size={14} className="sm:w-4 sm:h-4" /> : <ChevronDown size={14} className="sm:w-4 sm:h-4" />}
        </button>
      </div>

      {computed.warnings?.length ? (
        <div className="mb-3 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md p-2">
          <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <div className="font-medium">{computed.warnings[0]}</div>
            {computed.source && <div className="text-amber-700/70 text-[10px]">source: {computed.source}</div>}
          </div>
        </div>
      ) : null}

      <div className="space-y-3 sm:space-y-4">
        {/* Row 1: Sales + Total */}
        <div className="flex justify-between items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 mb-0.5">
              <span className="text-[10px] sm:text-xs font-semibold text-gray-500">Продажи</span>
              {computed.creditsTotal > 0.01 && (
                <div className="group relative flex-shrink-0">
                  <HelpCircle className="w-3 h-3 text-gray-400 cursor-help" />
                  <div className="invisible group-hover:visible absolute z-50 top-5 -right-2 sm:left-0 sm:right-auto w-52 sm:w-56 p-2 sm:p-3 bg-gray-900 text-white text-[10px] sm:text-xs rounded-lg shadow-2xl leading-relaxed whitespace-pre-line">
                    {`Сумма включает СПП\n(скидка постоянного покупателя)\n\nПродажи: ${formatWbAmount(computed.salesTotal)}\nСПП / возмещения: +${formatWbAmount(computed.creditsTotal)}\nИтого: ${formatWbAmount(computed.salesTotal + computed.creditsTotal)}`}
                    <div className="absolute -top-1 right-3 sm:right-auto sm:left-2 w-2 h-2 bg-gray-900 rotate-45" />
                  </div>
                </div>
              )}
            </div>
            <div className="text-lg sm:text-2xl font-bold tabular-nums text-gray-900">
              {formatWbAmount(computed.salesTotal + computed.creditsTotal)}
            </div>
          </div>
          <div className="text-right min-w-0">
            <div className="text-[10px] sm:text-xs font-semibold text-gray-500 mb-0.5">Начислено</div>
            <div
              className="text-lg sm:text-2xl font-bold tabular-nums text-purple-600"
              title={`Точно: ${formatExactSigned(computed.totalAccrued)}`}
            >
              {formatWbAmount(computed.totalAccrued)}
            </div>
          </div>
        </div>

        {/* Sales bar */}
        <div className="h-1.5 sm:h-2 rounded bg-gray-100 overflow-hidden flex">
          <div
            className={COLORS.sales.bar}
            style={{ width: computed.creditsTotal > 0.01 ? `${pct(Math.abs(computed.salesTotal), Math.abs(computed.salesTotal) + computed.creditsTotal)}%` : '100%' }}
          />
          {computed.creditsTotal > 0.01 && (
            <div className="bg-emerald-300" style={{ width: `${pct(computed.creditsTotal, Math.abs(computed.salesTotal) + computed.creditsTotal)}%` }} />
          )}
        </div>

        {/* Row 2: Costs */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[10px] sm:text-xs font-semibold text-gray-500">Удержания</span>
            <span className="text-sm sm:text-base font-bold tabular-nums text-gray-900" title={`Точно: ${formatExactSigned(computed.costsTotal)}`}>
              {formatWbAmount(computed.costsTotal)}
            </span>
          </div>

          {/* Costs bar */}
          <div className="h-1.5 sm:h-2 rounded bg-gray-100 overflow-hidden flex mb-2">
            {computed.costItems
              .filter((c) => c.amount < 0)
              .map((c) => {
                const w = pct(Math.abs(c.amount), costsAbs);
                const token = pickCostColor(c.name);
                return <div key={c.name} className={COLORS[token].bar} style={{ width: `${w}%` }} />;
              })}
          </div>

          {/* Costs list - compact */}
          <div className="space-y-1">
            {computed.costsForList.slice(0, 4).map((c) => {
              const token = pickCostColor(c.name);
              return (
                <div key={c.name} className="flex items-center justify-between text-[11px] sm:text-xs">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-2">
                    <span className={`w-2 h-2 rounded ${COLORS[token].dot} flex-shrink-0`} />
                    <span className="text-gray-600 truncate">{c.name}</span>
                  </div>
                  <span className="tabular-nums text-gray-900 flex-shrink-0" title={`Точно: ${formatExactSigned(c.amount)}`}>
                    {formatWbAmount(c.amount)}
                  </span>
                </div>
              );
            })}
            {computed.costsForList.length > 4 && (
              <div className="text-[10px] text-gray-400">+{computed.costsForList.length - 4} ещё</div>
            )}
            {computed.creditsTotal > 0.01 && (
              <div className="flex items-center justify-between text-[11px] sm:text-xs">
                <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-2">
                  <span className="w-2 h-2 rounded bg-emerald-300 flex-shrink-0" />
                  <span className="text-gray-600 truncate" title="Скидка постоянного покупателя">СПП</span>
                </div>
                <span className="tabular-nums text-gray-900 flex-shrink-0">{formatWbAmount(computed.creditsTotal)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Row 3: Profit */}
        {profitData && (
          <div className="pt-2 border-t border-gray-100">
            <div className="flex justify-between items-start">
              <span className="text-[10px] sm:text-xs font-semibold text-gray-500">Прибыль</span>
              <div className="text-right">
                <div
                  className={`text-sm sm:text-base font-bold tabular-nums ${profitData.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}
                  title={[
                    `Прибыль = Начислено − Закупка − Реклама`,
                    `= ${formatWbAmount(computed.totalAccrued)} − ${formatWbAmount(profitData.purchase)} − ${formatWbAmount(profitData.ad)}`,
                    `= ${formatWbAmount(profitData.profit)}`,
                  ].join('\n')}
                >
                  {formatWbAmount(profitData.profit)}
                </div>
                {computed.salesTotal !== 0 && (
                  <div className="text-[9px] sm:text-[10px] text-gray-400">
                    маржа {Math.abs(Math.round((profitData.profit / Math.abs(computed.salesTotal + computed.creditsTotal)) * 1000) / 10)}%
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Details: tree */}
      {showDetails && (
        <div className="mt-4 pt-3 border-t border-gray-100">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-xs font-semibold text-gray-900">Начислено</span>
            <span className="text-xs font-semibold tabular-nums text-gray-900">{formatWbAmount(computed.totalAccrued)}</span>
          </div>

          <div className="space-y-0">
            {computed.tree.map((item) => (
              <TreeCategoryInline
                key={item.name}
                item={item}
                denom={Math.abs(typeof computed.percentBaseSales === 'number' ? computed.percentBaseSales : computed.salesTotal)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const TreeCategoryInline = ({ item, denom }: { item: CostsTreeItem; denom: number }) => {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = item.children.length > 0;

  return (
    <div className="relative">
      <div
        className="flex items-center justify-between py-1.5 cursor-pointer group"
        onClick={() => hasChildren && setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-1 min-w-0 flex-1 mr-2">
          {hasChildren ? (
            <span className="text-gray-400 w-4 h-4 flex items-center justify-center flex-shrink-0 group-hover:text-gray-600">
              {expanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </span>
          ) : (
            <span className="w-4 flex-shrink-0" />
          )}
          <span className="text-xs font-medium text-gray-900 truncate">{item.name}</span>
        </div>

        <div className="flex flex-col items-end flex-shrink-0">
          <span className="text-xs font-medium tabular-nums text-gray-900" title={`Точно: ${formatExactSigned(item.amount)}`}>
            {formatWbAmount(item.amount)}
          </span>
          {item.percent !== null && item.percent !== undefined && (
            <span className="text-[10px] text-gray-400" title={`${formatCurrency(Math.abs(item.amount))} / ${formatCurrency(denom)}`}>
              {item.percent} %
            </span>
          )}
        </div>
      </div>

      {expanded && hasChildren && (
        <div className="ml-4">
          {item.children.map((child) => (
            <div key={child.name} className="flex items-center justify-between py-1">
              <span className="text-xs text-gray-700 truncate flex-1 mr-2">{child.name}</span>
              <span className="text-xs tabular-nums text-gray-900 flex-shrink-0" title={`Точно: ${formatExactSigned(child.amount)}`}>
                {formatWbAmount(child.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
