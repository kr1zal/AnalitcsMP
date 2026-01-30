/**
 * WB Accruals summary card (по аналогии с OZON блоком, но семантика WB).
 * Источник данных: /dashboard/costs-tree (marketplace=wb), который строится из WB reportDetailByPeriod.
 *
 * ОПТИМИЗАЦИЯ: данные передаются через props из DashboardPage,
 * чтобы избежать дублирования запросов.
 */
import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';
import type { CostsTreeItem, CostsTreeResponse, DashboardFilters } from '../../types';

interface WbAccrualsCardProps {
  filters: DashboardFilters;
  /**
   * Если задано — детализация контролируется снаружи (синхронизация с OZON карточкой).
   */
  detailsOpen?: boolean;
  onToggleDetails?: () => void;
  /**
   * ОПТИМИЗАЦИЯ: данные costs-tree передаются из родителя (DashboardPage),
   * чтобы избежать дублирования запросов.
   */
  costsTreeData?: CostsTreeResponse | null;
  isLoading?: boolean;
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
  // В карточке показываем ₽ без копеек (как в OZON карточке), точные значения остаются в title.
  const abs = new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
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

function nearlyEq(a: number, b: number, eps: number = 0.01): boolean {
  return Math.abs(a - b) <= eps;
}

function buildAmountMap(items: CostsTreeItem[], opts?: { excludeSales?: boolean }): Map<string, number> {
  const m = new Map<string, number>();
  for (const it of items) {
    if (opts?.excludeSales && it.name === 'Продажи') continue;
    m.set(it.name, it.amount ?? 0);
  }
  return m;
}

function isSameTreeByCategoryAmount(a: CostsTreeItem[], b: CostsTreeItem[]): boolean {
  const ma = buildAmountMap(a, { excludeSales: false });
  const mb = buildAmountMap(b, { excludeSales: false });
  if (ma.size !== mb.size) return false;
  for (const [k, va] of ma.entries()) {
    const vb = mb.get(k);
    if (typeof vb !== 'number') return false;
    if (!nearlyEq(va, vb)) return false;
  }
  return true;
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
  filters: _filters,
  detailsOpen,
  onToggleDetails,
  costsTreeData,
  isLoading: isLoadingProp,
}: WbAccrualsCardProps) => {
  // _filters зарезервирован для будущего использования
  const [showDetailsLocal, setShowDetailsLocal] = useState(false);
  const controlled = typeof detailsOpen === 'boolean';
  const showDetails = controlled ? detailsOpen : showDetailsLocal;
  const toggleDetails = controlled ? (onToggleDetails ?? (() => {})) : () => setShowDetailsLocal((v) => !v);

  // ОПТИМИЗАЦИЯ: данные передаются через props из DashboardPage
  const data = costsTreeData;
  const isLoading = isLoadingProp ?? false;
  const error = null; // ошибки обрабатываются в DashboardPage

  // WB_ACCOUNT логика убрана для оптимизации (редко используется)
  // Переменные оставлены для возможного восстановления функциональности
  const wbAccountTree = null as CostsTreeResponse | null;
  const summaryData = null as { summary?: { revenue?: number; sales?: number; total_costs?: number } } | null;

  const computed = useMemo(() => {
    const tree = data?.tree ?? [];
    const salesItem = tree.find((t) => t.name === 'Продажи');
    const costItems = tree.filter((t) => t.name !== 'Продажи');

    const salesTotal = salesItem?.amount ?? 0;
    // В WB дереве кроме продаж есть начисления (возмещения/компенсации) — они могут быть положительными.
    // В блоке "Удержания" показываем только реальные удержания (отрицательные суммы).
    const costsTotal = costItems.reduce((acc, t) => acc + (t.amount < 0 ? t.amount : 0), 0);
    const creditsTotal = costItems.reduce((acc, t) => acc + (t.amount > 0 ? t.amount : 0), 0);
    const salesChildren = salesItem?.children ?? [];
    const costsForList: CostsTreeItem[] = [...costItems]
      .filter((t) => t.amount < 0)
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

    return {
      tree,
      salesItem,
      costItems,
      salesTotal,
      costsTotal,
      creditsTotal,
      salesChildren,
      costsForList,
      totalAccrued: data?.total_accrued ?? 0,
      percentBaseSales: data?.percent_base_sales ?? null,
      warnings: (data as any)?.warnings as string[] | undefined,
      source: (data as any)?.source as string | undefined,
    };
  }, [data]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-20" />
          <div className="h-10 bg-gray-100 rounded w-40" />
          <div className="h-2 bg-gray-100 rounded w-full" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-3">
              <div className="h-4 bg-gray-100 rounded w-40" />
              <div className="h-3 bg-gray-50 rounded w-56" />
              <div className="h-3 bg-gray-50 rounded w-48" />
            </div>
            <div className="space-y-3">
              <div className="h-4 bg-gray-100 rounded w-32" />
              <div className="h-3 bg-gray-50 rounded w-56" />
              <div className="h-3 bg-gray-50 rounded w-48" />
            </div>
            <div className="space-y-3">
              <div className="h-4 bg-gray-100 rounded w-16" />
              <div className="h-3 bg-gray-50 rounded w-40" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const hasTree = !!data?.tree?.length;
  const summary = summaryData?.summary;
  const wbAccountSales = wbAccountTree?.tree?.find((t) => t.name === 'Продажи')?.amount ?? 0;
  const wbAccountTreeItems = wbAccountTree?.tree?.filter((t) => t.name !== 'Продажи' && Math.abs(t.amount) > 0.009) ?? [];
  // Важно: total_accrued включает "Продажи", а секция WB_ACCOUNT задумана как account-level (без SKU),
  // поэтому в заголовке показываем сумму БЕЗ продаж, чтобы не дублировать общий итог.
  const wbAccountNetWithoutSales = wbAccountTreeItems.reduce((acc, t) => acc + (t.amount ?? 0), 0);
  const wbAccountDenom = Math.abs(
    typeof wbAccountTree?.percent_base_sales === 'number' ? wbAccountTree.percent_base_sales : 0
  );
  const wbAccountFullyDuplicatesMain =
    !!wbAccountTree?.tree?.length && !!data?.tree?.length && isSameTreeByCategoryAmount(wbAccountTree.tree, data.tree);

  if (error || !hasTree) {
    // Fallback: показываем агрегаты из /dashboard/summary, чтобы карточка не была пустой.
    const fallbackRevenue = summary?.revenue ?? null;
    const fallbackSales = summary?.sales ?? null;
    const fallbackCosts = summary?.total_costs ?? null;
    const fallbackTotal = fallbackRevenue !== null && fallbackCosts !== null ? fallbackRevenue - fallbackCosts : null;

    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
        <h3 className="text-lg font-bold mb-2" style={{ color: '#8B3FFD' }}>
          WB
        </h3>
        <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-md p-3">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <div className="font-medium">Нет детализации WB за период</div>
            <div className="text-amber-700/80">
              {error ? 'Ошибка загрузки дерева. ' : ''}
              Показаны агрегаты из сводки. Для 1-в-1 мэтча с ЛК запусти синхронизацию удержаний WB.
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-2.5">
          <Row label="Продажи" value={fallbackRevenue !== null ? formatWbAmount(fallbackRevenue) : '—'} alert={fallbackRevenue === null} />
          <Row label="Выкупы" value={fallbackSales !== null ? `${fallbackSales} шт` : '—'} alert={fallbackSales === null} />
          <Row label="Удержания" value={fallbackCosts !== null ? `-${formatCurrency(fallbackCosts)}` : '—'} alert={fallbackCosts === null} valueClassName="text-red-600 font-semibold" />
          <div className="border-t pt-3 mt-3">
            <Row
              label="Итого (оценка)"
              value={fallbackTotal !== null ? formatWbAmount(fallbackTotal) : '—'}
              alert={fallbackTotal === null}
              valueClassName="font-bold text-xl text-gray-900"
            />
          </div>
        </div>
      </div>
    );
  }

  const _salesAbs = Math.abs(computed.salesTotal); // зарезервировано для будущего использования
  const costsAbs = Math.abs(computed.costsTotal); // costsTotal уже только удержания (<=0)
  void _salesAbs; // suppress unused warning

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
        <div className="mb-4 flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-md p-3">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <div className="font-medium">Показаны данные с предупреждениями</div>
            <div className="text-amber-700/80">{computed.warnings[0]}</div>
            {computed.source ? (
              <div className="mt-1 text-amber-700/70 text-xs">
                source: <span className="font-mono">{computed.source}</span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Compact layout for 50% width on mobile */}
      <div className="space-y-3 sm:space-y-4">
        {/* Row 1: Sales + Total */}
        <div className="flex justify-between items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] sm:text-xs font-semibold text-gray-500 mb-0.5">Продажи</div>
            <div className="text-lg sm:text-2xl font-bold tabular-nums text-gray-900" title={`Продажи: ${formatExactSigned(computed.salesTotal)}${computed.creditsTotal > 0.01 ? ` + СПП: ${formatExactSigned(computed.creditsTotal)}` : ''}`}>
              {formatWbAmount(computed.salesTotal + computed.creditsTotal)}
            </div>
          </div>
          <div className="text-right min-w-0">
            <div className="text-[10px] sm:text-xs font-semibold text-gray-500 mb-0.5">Начислено</div>
            <div className="text-lg sm:text-2xl font-bold tabular-nums text-purple-600" title={`Точно: ${formatExactSigned(computed.totalAccrued)}`}>
              {formatWbAmount(computed.totalAccrued)}
            </div>
          </div>
        </div>

        {/* Sales bar */}
        <div className="h-1.5 sm:h-2 rounded bg-gray-100 overflow-hidden flex">
          {/* Sales portion */}
          <div className={COLORS.sales.bar} style={{ width: computed.creditsTotal > 0.01 ? `${pct(Math.abs(computed.salesTotal), Math.abs(computed.salesTotal) + computed.creditsTotal)}%` : '100%' }} />
          {/* Credits (СПП) portion */}
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
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`w-2 h-2 rounded ${COLORS[token].dot} flex-shrink-0`} />
                    <span className="text-gray-600 truncate">{c.name}</span>
                  </div>
                  <span className="tabular-nums text-gray-900 ml-2 flex-shrink-0" title={`Точно: ${formatExactSigned(c.amount)}`}>
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
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-2 h-2 rounded bg-emerald-300 flex-shrink-0" />
                  <span className="text-gray-600 truncate" title="Скидка постоянного покупателя">СПП</span>
                </div>
                <span className="tabular-nums text-gray-900 ml-2">{formatWbAmount(computed.creditsTotal)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {showDetails && (
        <div className="mt-4 pt-3 border-t border-gray-100">
          <div className="flex items-baseline justify-between mb-2">
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-semibold text-gray-900">К перечислению</span>
              <span className="text-[10px] text-gray-400">за период</span>
            </div>
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

          {/* WB: account-level строки без SKU (WB_ACCOUNT) */}
          {wbAccountTreeItems.length ? (
            <div className="mt-4 pt-3 border-t border-gray-100">
              <div className="flex items-baseline justify-between mb-2">
                <div className="flex items-baseline gap-2 min-w-0">
                  <span className="text-xs font-semibold text-gray-900 truncate">Служебные WB (без товара)</span>
                </div>
                <span className="text-xs font-semibold tabular-nums text-gray-900">
                  {formatWbAmount(wbAccountNetWithoutSales)}
                </span>
              </div>

              {wbAccountFullyDuplicatesMain ? (
                <div className="mt-2 text-[10px] text-gray-500 bg-gray-50 border border-gray-100 rounded-md px-2 py-2">
                  Учтено в отчёте &quot;К перечислению&quot; как операции без привязки к товару — разнести по SKU нельзя.
                  {Math.abs(wbAccountSales) > 0.009 ? ' Включая часть продаж.' : ''}
                </div>
              ) : (
                <div className="space-y-0">
                  {wbAccountTreeItems.map((item: CostsTreeItem) => (
                    <TreeCategoryInline key={`wb_account_${item.name}`} item={item} denom={wbAccountDenom} />
                  ))}
                </div>
              )}

              {/* Примечание объединено в инфо-блок выше */}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

const Row = ({
  label,
  value,
  alert,
  valueClassName,
}: {
  label: string;
  value: string;
  alert?: boolean;
  valueClassName?: string;
}) => {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-gray-600 flex items-center gap-1.5">
        {label}
        {alert ? <AlertTriangle size={14} className="text-amber-600" /> : null}
      </span>
      <span className={valueClassName ?? 'font-semibold text-gray-900'}>{value}</span>
    </div>
  );
};

const TreeCategoryInline = ({ item, denom }: { item: CostsTreeItem; denom: number }) => {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = item.children.length > 0;

  return (
    <div className="relative">
      <div className="flex items-center justify-between py-1.5 cursor-pointer group" onClick={() => hasChildren && setExpanded((v) => !v)}>
        <div className="flex items-center gap-1 min-w-0">
          {hasChildren ? (
            <span className="text-gray-400 w-5 h-5 flex items-center justify-center flex-shrink-0 group-hover:text-gray-600">
              {expanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </span>
          ) : (
            <span className="w-5 flex-shrink-0" />
          )}
          <span className="text-xs font-medium text-gray-900">{item.name}</span>
        </div>

        <div className="flex flex-col items-end flex-shrink-0 ml-3">
          <span className="text-xs font-medium tabular-nums text-gray-900" title={`Точно: ${formatExactSigned(item.amount)}`}>
            {formatWbAmount(item.amount)}
          </span>
          {item.percent !== null && item.percent !== undefined && (
            <span
              className="text-[10px] text-gray-400"
              title={`Эффективная доля от Продаж (как в ЛК): ${formatCurrency(Math.abs(item.amount))} / ${formatCurrency(denom)} = ${item.percent} %`}
            >
              {item.percent} %
            </span>
          )}
        </div>
      </div>

      {expanded && hasChildren && (
        <div className="ml-5">
          {item.children.map((child) => (
            <div key={child.name} className="flex items-center justify-between py-1.5">
              <span className="text-xs text-gray-700">{child.name}</span>
              <span className="text-xs tabular-nums text-gray-900 ml-3 flex-shrink-0" title={`Точно: ${formatExactSigned(child.amount)}`}>
                {formatWbAmount(child.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

