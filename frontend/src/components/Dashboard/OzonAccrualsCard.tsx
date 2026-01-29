/**
 * OZON Accruals summary card (как блок "Продажи и возвраты / Начисления / Итого" в ЛК).
 * Источник данных: /dashboard/costs-tree (marketplace=ozon)
 */
import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { useCostsTree } from '../../hooks/useDashboard';
import { formatCurrency } from '../../lib/utils';
import type { CostsTreeItem, DashboardFilters } from '../../types';

interface OzonAccrualsCardProps {
  filters: DashboardFilters;
  /**
   * Если задано — детализация контролируется снаружи (синхронизация с WB карточкой).
   */
  detailsOpen?: boolean;
  onToggleDetails?: () => void;
  /**
   * Опционально: показывать % у подкатегорий (листов) в детализации.
   * % считается как доля от "Продажи" (как в ЛК).
   * По умолчанию выключено (в ЛК у подкатегорий % обычно не показываются).
   */
  showLeafPercents?: boolean;
}

type ColorToken =
  | 'salesRevenue'
  | 'salesDiscount'
  | 'salesPartners'
  | 'reward'
  | 'delivery'
  | 'agents'
  | 'fbo'
  | 'promo'
  | 'other';

const COLORS: Record<ColorToken, { dot: string; bar: string }> = {
  salesRevenue: { dot: 'bg-teal-500', bar: 'bg-teal-400' },
  salesDiscount: { dot: 'bg-emerald-300', bar: 'bg-emerald-300' },
  salesPartners: { dot: 'bg-emerald-200', bar: 'bg-emerald-200' },
  reward: { dot: 'bg-blue-500', bar: 'bg-blue-500' },
  delivery: { dot: 'bg-yellow-300', bar: 'bg-yellow-300' },
  agents: { dot: 'bg-violet-400', bar: 'bg-violet-400' },
  fbo: { dot: 'bg-orange-400', bar: 'bg-orange-400' },
  promo: { dot: 'bg-pink-500', bar: 'bg-pink-500' },
  other: { dot: 'bg-gray-300', bar: 'bg-gray-300' },
};

const formatCurrencyRounded = (value: number): string => {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

function formatOzonAmount(amount: number): string {
  // В ЛК Ozon в этом блоке суммы отображаются в ₽ без копеек.
  const abs = formatCurrencyRounded(Math.abs(amount));
  return amount < 0 ? `-${abs}` : abs;
}

function formatExactSigned(amount: number): string {
  const abs = formatCurrency(Math.abs(amount));
  return amount < 0 ? `-${abs}` : abs;
}

function pct(partAbs: number, totalAbs: number): number {
  if (totalAbs <= 0) return 0;
  return Math.max(0, Math.min(100, (partAbs / totalAbs) * 100));
}

function pct1(partAbs: number, totalAbs: number): number | null {
  if (totalAbs <= 0) return null;
  const v = (partAbs / totalAbs) * 100;
  return Math.round(v * 10) / 10;
}

function normalizePolicyLabel(label: string): string {
  // Backward-compat: ранее бекенд писал "Витамины (14%)" / "Прочее (20%)".
  return String(label || '').replace(/\s*\(\s*\d+(?:[.,]\d+)?\s*%\s*\)\s*$/, '');
}

function pickCostColor(category: string): ColorToken {
  if (category === 'Вознаграждение Ozon') return 'reward';
  if (category === 'Услуги доставки') return 'delivery';
  if (category === 'Услуги агентов') return 'agents';
  if (category === 'Услуги FBO') return 'fbo';
  if (category === 'Продвижение и реклама') return 'promo';
  return 'other';
}

function pickSalesColor(subcategory: string, idx: number): ColorToken {
  // Best-effort mapping. If backend не отдаёт разбиение, будет одна строка.
  const s = subcategory.toLowerCase();
  if (s.includes('выруч')) return 'salesRevenue';
  if (s.includes('балл') || s.includes('скид')) return 'salesDiscount';
  if (s.includes('партн')) return 'salesPartners';
  return idx === 0 ? 'salesRevenue' : idx === 1 ? 'salesDiscount' : 'salesPartners';
}

export const OzonAccrualsCard = ({ filters, showLeafPercents, detailsOpen, onToggleDetails }: OzonAccrualsCardProps) => {
  const [showDetailsLocal, setShowDetailsLocal] = useState(false);
  const [showLeafPercentsLocal, setShowLeafPercentsLocal] = useState(false);

  const controlled = typeof detailsOpen === 'boolean';
  const showDetails = controlled ? detailsOpen : showDetailsLocal;
  const toggleDetails = controlled ? (onToggleDetails ?? (() => {})) : () => setShowDetailsLocal((v) => !v);

  const leafPercentsExternallyControlled = typeof showLeafPercents === 'boolean';
  const leafPercentsEnabled = leafPercentsExternallyControlled ? showLeafPercents : showLeafPercentsLocal;

  const { data, isLoading, error } = useCostsTree({
    ...filters,
    marketplace: 'ozon',
  });

  const computed = useMemo(() => {
    const tree = data?.tree ?? [];
    const salesItem = tree.find((t) => t.name === 'Продажи');
    const costItems = tree.filter((t) => t.name !== 'Продажи');

    const salesTotal = salesItem?.amount ?? 0;
    const costsTotal = costItems.reduce((acc, t) => acc + t.amount, 0);

    const salesChildren = salesItem?.children ?? [];

    const costsForList: CostsTreeItem[] = [...costItems].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

    return {
      tree,
      salesItem,
      costItems,
      salesTotal,
      costsTotal,
      salesChildren,
      costsForList,
      totalAccrued: data?.total_accrued ?? 0,
      percentBaseSales: data?.percent_base_sales ?? null,
      warnings: data?.warnings,
      source: data?.source,
    };
  }, [data]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-24" />
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

  if (error || !data?.tree?.length) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
        <h3 className="text-lg font-bold mb-2" style={{ color: '#005BFF' }}>
          OZON
        </h3>
        <p className="text-sm text-gray-400">
          {error ? 'Не удалось загрузить данные' : 'Нет данных за период'}
        </p>
      </div>
    );
  }

  const salesAbs = Math.abs(computed.salesTotal);
  const costsAbs = Math.abs(computed.costsTotal);
  const denomAbs = Math.abs(
    typeof computed.percentBaseSales === 'number' ? computed.percentBaseSales : computed.salesTotal
  );

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold" style={{ color: '#005BFF' }}>
          OZON
        </h3>
        <button
          type="button"
          onClick={toggleDetails}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
        >
          {showDetails ? 'Свернуть' : 'Детализация'}
          {showDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
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

      {/* 
        В ЛК этот блок широкий. У нас он часто рендерится в половину экрана (в паре с WB),
        поэтому на md делаем 2 колонки + "Итого" на всю ширину, чтобы числа не упирались в разделители.
        Вертикальные разделители включаем только на lg.
      */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-0 lg:divide-x lg:divide-gray-200 md:min-h-[280px]">
        {/* Column 1: Revenue */}
        <div className="lg:pr-6 min-w-0">
          <div
            className="text-sm font-semibold text-gray-900 mb-2"
            title="Продажи = Выручка + Баллы за скидки + Программы партнёров (как в ЛК Ozon)"
          >
            Продажи
          </div>
          <div className="text-3xl font-bold tabular-nums tracking-tight text-gray-900 mb-4 whitespace-nowrap">
            <span title={`Точно: ${formatExactSigned(computed.salesTotal)}`}>
              {formatOzonAmount(computed.salesTotal)}
            </span>
          </div>

          {/* Sales bar */}
          <div className="h-2 rounded bg-gray-100 overflow-hidden flex mb-4">
            {computed.salesChildren.length ? (
              computed.salesChildren.map((c, idx) => {
                const w = pct(Math.abs(c.amount), salesAbs);
                const token = pickSalesColor(c.name, idx);
                return <div key={c.name} className={COLORS[token].bar} style={{ width: `${w}%` }} />;
              })
            ) : (
              <div className={COLORS.salesRevenue.bar} style={{ width: '100%' }} />
            )}
          </div>

          <div className="space-y-2">
            {(computed.salesChildren.length ? computed.salesChildren : [{ name: 'Выручка', amount: computed.salesTotal }]).map(
              (row, idx) => {
                const token = pickSalesColor(row.name, idx);
                return (
                  <div key={row.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-3 h-3 rounded ${COLORS[token].dot} flex-shrink-0`} />
                      <span className="text-gray-700 truncate">{row.name}</span>
                    </div>
                    <span className="tabular-nums text-gray-900 ml-4 flex-shrink-0">
                      <span title={`Точно: ${formatExactSigned(row.amount)}`}>
                        {formatOzonAmount(row.amount)}
                      </span>
                    </span>
                  </div>
                );
              }
            )}
          </div>

          <div className="mt-3 text-xs text-gray-400">
            Сумма = Выручка + Баллы + Партнёры (как в ЛК)
          </div>
        </div>

        {/* Column 2: Costs */}
        <div className="lg:px-6 min-w-0">
          <div className="text-sm font-semibold text-gray-900 mb-2">Удержания</div>
          <div className="text-3xl font-bold tabular-nums tracking-tight text-gray-900 mb-4 whitespace-nowrap">
            <span title={`Точно: ${formatExactSigned(computed.costsTotal)}`}>
              {formatOzonAmount(computed.costsTotal)}
            </span>
          </div>

          {/* Costs bar */}
          <div className="h-2 rounded bg-gray-100 overflow-hidden flex mb-4">
            {computed.costItems.map((c) => {
              const w = pct(Math.abs(c.amount), costsAbs);
              const token = pickCostColor(c.name);
              return <div key={c.name} className={COLORS[token].bar} style={{ width: `${w}%` }} />;
            })}
          </div>

          {/* Costs list (2 columns like LK) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            {computed.costsForList.map((c) => {
              const token = pickCostColor(c.name);
              return (
                <div key={c.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-3 h-3 rounded ${COLORS[token].dot} flex-shrink-0`} />
                    <span className="text-gray-700 truncate">{c.name}</span>
                  </div>
                  <span className="tabular-nums text-gray-900 ml-4 flex-shrink-0">
                    <span title={`Точно: ${formatExactSigned(c.amount)}`}>{formatOzonAmount(c.amount)}</span>
                  </span>
                </div>
              );
            })}
          </div>

          {/* Percent base note (only when backend provides it) */}
          <div
            className="mt-3 text-xs text-gray-400"
            title={`База для %: Продажи за период. Точно: ${formatCurrency(denomAbs)}`}
          >
            % считаются от продаж: {formatOzonAmount(denomAbs)}
          </div>

          <div className="mt-2 text-xs text-gray-400">В карточке суммы округлены до ₽ (как в ЛК).</div>
        </div>

        {/* Column 3: Total */}
        <div className="md:col-span-2 lg:col-span-1 lg:pl-6 min-w-0">
          <div className="text-sm font-semibold text-gray-900 mb-2">Итого</div>
          <div className="text-3xl font-bold tabular-nums tracking-tight text-gray-900 mb-4 whitespace-nowrap">
            <span title={`Точно: ${formatExactSigned(computed.totalAccrued)}`}>
              {formatOzonAmount(computed.totalAccrued)}
            </span>
          </div>
          <div className="text-sm text-gray-500">
            Начислено за период
          </div>
        </div>
      </div>

      {/* Details: tree (без отдельной карточки) */}
      {showDetails && (
        <div className="mt-4 pt-3 border-t border-gray-100">
          <div className="flex items-baseline justify-between mb-2">
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-semibold text-gray-900">Начислено</span>
              <span className="text-[10px] text-gray-400">за период</span>
            </div>
            <div className="flex items-center gap-3">
              <label
                className="flex items-center gap-2 text-[10px] text-gray-500 select-none"
                title="Опционально: показать эффективные % у подкатегорий (доля от 'Продажи')"
              >
                <input
                  type="checkbox"
                  className="w-3 h-3"
                  checked={leafPercentsEnabled}
                  disabled={leafPercentsExternallyControlled}
                  onChange={() => setShowLeafPercentsLocal((v) => !v)}
                />
                % у подкат.
              </label>
              <span className="text-xs font-semibold tabular-nums text-gray-900">
                {formatOzonAmount(computed.totalAccrued)}
              </span>
            </div>
          </div>

          <div className="space-y-0">
            {computed.tree.map((item) => (
              <TreeCategoryInline
                key={item.name}
                item={item}
                leafPercents={{
                  enabled: leafPercentsEnabled,
                  denom: Math.abs(
                    typeof computed.percentBaseSales === 'number'
                      ? computed.percentBaseSales
                      : computed.salesTotal ?? 0
                  ),
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

type LeafPercentsCfg = { enabled: boolean; denom: number };

const TreeCategoryInline = ({ item, leafPercents }: { item: CostsTreeItem; leafPercents: LeafPercentsCfg }) => {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = item.children.length > 0;

  return (
    <div className="relative">
      <div
        className="flex items-center justify-between py-1.5 cursor-pointer group"
        onClick={() => hasChildren && setExpanded((v) => !v)}
      >
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
            {formatOzonAmount(item.amount)}
          </span>
          {item.percent !== null && item.percent !== undefined && (
            <span
              className="text-[10px] text-gray-400"
              title={`Эффективная доля от Продаж (как в ЛК): ${formatCurrency(Math.abs(item.amount))} / ${formatCurrency(leafPercents.denom)} = ${item.percent} %`}
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
              <span className="text-xs text-gray-700">{normalizePolicyLabel(child.name)}</span>
              <div className="flex flex-col items-end flex-shrink-0 ml-3">
                <span className="text-xs tabular-nums text-gray-900">
                  <span title={`Точно: ${formatExactSigned(child.amount)}`}>{formatOzonAmount(child.amount)}</span>
                </span>
                {leafPercents.enabled && leafPercents.denom > 0 && item.name !== 'Продажи' && (
                  <span className="text-[10px] text-gray-400" title="Доля от 'Продажи' (как в ЛК)">
                    {pct1(Math.abs(child.amount), leafPercents.denom)} %
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

