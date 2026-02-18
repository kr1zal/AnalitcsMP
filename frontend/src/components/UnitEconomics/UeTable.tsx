/**
 * Enterprise таблица Unit Economics
 * Search + Filter tabs + Sort + Pagination + Expandable rows + ABC + Alerts
 */
import { Fragment, useState, useMemo, useCallback, useEffect } from 'react';
import {
  Search,
  X,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  TrendingDown,
  Megaphone,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { formatCurrency, formatPercent, cn } from '../../lib/utils';
import { UeExpandedRow } from './UeExpandedRow';
import {
  type AbcGrade,
  type SortField,
  type SortDirection,
  type ProductFilter,
  type AlertItem,
  ABC_STYLES,
  FILTER_TABS,
  SORT_OPTIONS,
  ITEMS_PER_PAGE_DESKTOP,
  ITEMS_PER_PAGE_MOBILE,
  getMargin,
  getMarginColor,
  getMarginBg,
  getReturnRate,
  getReturnRateColor,
  getRowBg,
  getAlerts,
  getContribution,
  getSortValue,
  applyProductFilter,
  computeTotals,
} from './ueHelpers';
import type { UnitEconomicsItem, Marketplace } from '../../types';
import type { PlanPaceData, MatrixQuadrant } from './uePlanHelpers';
import { getPaceStatusLabel, getPaceStatusColor, getCompletionColor } from './uePlanHelpers';

// ==================== TYPES ====================

interface MpBreakdownEntry {
  wb?: UnitEconomicsItem;
  ozon?: UnitEconomicsItem;
}

interface MpPlanEntry {
  plan_revenue: number;
  actual_revenue: number;
  completion_percent: number;
}

interface UeTableProps {
  products: UnitEconomicsItem[];
  abcMap: Map<string, AbcGrade>;
  planMap: Map<string, number>;
  mpBreakdown: Map<string, MpBreakdownEntry>;
  marketplace: Marketplace;
  hasAds: boolean;
  hasReturns: boolean;
  hasPlan: boolean;
  totalProfit: number;
  /** Weighted completion from backend (Σactual/Σplan×100) */
  totalPlanCompletion: number;
  planPaceMap: Map<string, PlanPaceData>;
  matrixFilter: MatrixQuadrant | null;
  matrixProductIds: Set<string> | null;
  onMatrixClear: () => void;
  planMonth: string;
  onPlanSave: (mp: string, productId: string, value: number) => Promise<void>;
  wbPlanMap: Map<string, MpPlanEntry>;
  ozonPlanMap: Map<string, MpPlanEntry>;
}

// ==================== SUBCOMPONENTS ====================

function AbcBadge({ grade }: { grade: AbcGrade }) {
  return (
    <span className={cn('inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded border flex-shrink-0', ABC_STYLES[grade])}>
      {grade}
    </span>
  );
}

function AlertIcons({ alerts }: { alerts: AlertItem[] }) {
  if (!alerts.length) return null;
  const ICONS: Record<string, typeof AlertTriangle> = {
    loss: AlertTriangle,
    margin_low: TrendingDown,
    drr_high: Megaphone,
    trap: ShieldAlert,
    potential: Sparkles,
  };
  return (
    <div className="flex items-center gap-0.5">
      {alerts.map((a) => {
        const Icon = ICONS[a.icon];
        return <Icon key={a.key} className={cn('w-3.5 h-3.5', a.color)} aria-label={a.tooltip} />;
      })}
    </div>
  );
}

function SortableHeader({
  field, label, current, dir, onSort, align = 'right',
}: {
  field: SortField; label: string; current: SortField; dir: SortDirection;
  onSort: (f: SortField) => void; align?: 'left' | 'right';
}) {
  const active = current === field;
  return (
    <th
      className={cn(
        'px-2 sm:px-3 py-2.5 text-[10px] sm:text-xs font-medium text-gray-500 uppercase cursor-pointer select-none hover:text-gray-700 transition-colors whitespace-nowrap',
        align === 'left' ? 'text-left' : 'text-right',
      )}
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-0.5">
        {align === 'right' && active && (dir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
        {label}
        {align === 'left' && active && (dir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
        {!active && <ArrowUpDown className="w-3 h-3 opacity-30" />}
      </span>
    </th>
  );
}

function ContributionBar({ pct }: { pct: number }) {
  const absPct = Math.abs(pct);
  return (
    <div className="flex items-center gap-1">
      <div className="w-10 sm:w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full', pct >= 0 ? 'bg-indigo-400' : 'bg-red-300')}
          style={{ width: `${Math.min(absPct, 100)}%` }}
        />
      </div>
      <span className="text-[10px] text-gray-500 tabular-nums w-8 text-right">{pct.toFixed(1)}%</span>
    </div>
  );
}

// ==================== MAIN COMPONENT ====================

export function UeTable({
  products, abcMap, planMap, mpBreakdown, marketplace,
  hasAds, hasReturns: _hasReturns, hasPlan, totalProfit, totalPlanCompletion,
  planPaceMap, matrixFilter, matrixProductIds, onMatrixClear,
  planMonth: _planMonth, onPlanSave: _onPlanSave, wbPlanMap, ozonPlanMap,
}: UeTableProps) {
  // State
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ProductFilter>('all');
  const [sortField, setSortField] = useState<SortField>('net_profit');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [page, setPage] = useState(1);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const itemsPerPage = isMobile ? ITEMS_PER_PAGE_MOBILE : ITEMS_PER_PAGE_DESKTOP;

  // Pipeline: search → filter → sort → paginate
  const processed = useMemo(() => {
    let result = products;

    // Matrix filter (pre-filter from BCG quadrant click)
    if (matrixProductIds) {
      result = result.filter((p) => matrixProductIds.has(p.product.id));
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) => p.product.name.toLowerCase().includes(q) || p.product.barcode.toLowerCase().includes(q),
      );
    }

    // Filter (ABC/profitable/loss)
    result = applyProductFilter(result, filter, abcMap);

    // Sort
    const sorted = [...result].sort((a, b) => {
      const va = getSortValue(a, sortField, { planMap, totalProfit });
      const vb = getSortValue(b, sortField, { planMap, totalProfit });
      const cmp = typeof va === 'string' && typeof vb === 'string'
        ? va.localeCompare(vb, 'ru')
        : (va as number) - (vb as number);
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return sorted;
  }, [products, search, filter, sortField, sortDir, abcMap, planMap, totalProfit, matrixProductIds]);

  // Totals from ALL products (not filtered/paged)
  const allTotals = useMemo(() => computeTotals(products), [products]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(processed.length / itemsPerPage));
  const safePage = Math.min(page, totalPages);
  const paged = processed.slice((safePage - 1) * itemsPerPage, safePage * itemsPerPage);

  // Reset on changes
  useEffect(() => { setPage(1); }, [search, filter, sortField, sortDir, matrixFilter]);
  useEffect(() => { setExpandedRows(new Set()); }, [page]);

  // Handlers
  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'name' ? 'asc' : 'desc');
    }
  }, [sortField]);

  const toggleRow = useCallback((id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // Column count (for colSpan)
  const colCount = 7 + (hasAds ? 2 : 0) + (hasPlan ? 1 : 0) + 2; // +2 for Contribution + Alerts

  const avgMargin = allTotals.revenue > 0 ? (allTotals.profit / allTotals.revenue) * 100 : 0;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Toolbar */}
      <div className="p-3 sm:p-4 border-b border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2 sm:mb-0">
          <h3 className="text-sm sm:text-base font-semibold text-gray-900 flex-shrink-0">
            Таблица эффективности
          </h3>
          <div className="flex-1" />

          {/* Mobile sort */}
          {isMobile && (
            <div className="flex items-center gap-1.5">
              <select
                value={sortField}
                onChange={(e) => { setSortField(e.target.value as SortField); setPage(1); }}
                className="flex-1 text-[11px] border border-gray-200 rounded-md px-2 py-1.5 bg-white"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <button
                onClick={() => setSortDir((d) => d === 'asc' ? 'desc' : 'asc')}
                className="p-1.5 border border-gray-200 rounded-md hover:bg-gray-50"
              >
                {sortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Поиск товара..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-48 pl-8 pr-7 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Matrix filter banner */}
        {matrixFilter && (
          <div className="flex items-center gap-2 mt-2 mb-1 px-2.5 py-1.5 bg-indigo-50 border border-indigo-200 rounded-md">
            <span className="text-xs text-indigo-700">
              Фильтр: <span className="font-semibold">
                {matrixFilter === 'stars' ? '★ Звёзды' : matrixFilter === 'traps' ? '⚠ Ловушки' : matrixFilter === 'potential' ? '↗ Потенциал' : '↓ Проблемы'}
              </span>
            </span>
            <button onClick={onMatrixClear} className="ml-auto p-0.5 text-indigo-400 hover:text-indigo-600 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-1 mt-2">
          {FILTER_TABS.map((tab) => {
            const active = filter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => { setFilter(tab.key); setPage(1); }}
                className={cn(
                  'px-2 sm:px-2.5 py-1 text-[10px] sm:text-xs rounded-md border transition-colors',
                  active ? tab.activeClass : 'border-gray-200 text-gray-600 hover:bg-gray-50',
                )}
              >
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.mobileLabel}</span>
              </button>
            );
          })}
          <span className="text-[10px] text-gray-400 self-center ml-1">
            {processed.length} из {products.length}
          </span>
        </div>
      </div>

      {/* ====== DESKTOP TABLE ====== */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <SortableHeader field="name" label="Товар" current={sortField} dir={sortDir} onSort={handleSort} align="left" />
              <SortableHeader field="sales_count" label="Продажи" current={sortField} dir={sortDir} onSort={handleSort} />
              <SortableHeader field="revenue" label="Выручка" current={sortField} dir={sortDir} onSort={handleSort} />
              <SortableHeader field="purchase_costs" label="Закупка" current={sortField} dir={sortDir} onSort={handleSort} />
              <SortableHeader field="mp_costs" label="Удерж." current={sortField} dir={sortDir} onSort={handleSort} />
              {hasAds && <SortableHeader field="ad_cost" label="Реклама" current={sortField} dir={sortDir} onSort={handleSort} />}
              <SortableHeader field="net_profit" label="Прибыль" current={sortField} dir={sortDir} onSort={handleSort} />
              <SortableHeader field="margin" label="Маржа" current={sortField} dir={sortDir} onSort={handleSort} />
              <SortableHeader field="unit_profit" label="На ед." current={sortField} dir={sortDir} onSort={handleSort} />
              {hasAds && <SortableHeader field="drr" label="ДРР" current={sortField} dir={sortDir} onSort={handleSort} />}
              <SortableHeader field="contribution" label="Доля" current={sortField} dir={sortDir} onSort={handleSort} />
              <th className="px-2 py-2.5 text-[10px] sm:text-xs font-medium text-gray-500 text-center w-10" />
              {hasPlan && <SortableHeader field="plan_completion" label="План" current={sortField} dir={sortDir} onSort={handleSort} />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paged.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-4 py-8 text-center text-sm text-gray-400">
                  {search || filter !== 'all' ? 'Ничего не найдено' : 'Нет данных за период'}
                </td>
              </tr>
            ) : (
              paged.map((item) => {
                const margin = getMargin(item);
                const positive = item.metrics.net_profit >= 0;
                const isExpanded = expandedRows.has(item.product.id);
                const abc = abcMap.get(item.product.id) ?? 'C';
                const alerts = getAlerts(item, planMap.get(item.product.id));
                const contribution = getContribution(item, totalProfit);
                const returns = item.metrics.returns_count ?? 0;

                return (
                  <Fragment key={item.product.id}>
                    <tr
                      className={cn('cursor-pointer transition-colors', getRowBg(margin, item.metrics.net_profit))}
                      onClick={() => toggleRow(item.product.id)}
                    >
                      <td className="px-2 sm:px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <AbcBadge grade={abc} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1">
                              <span className="text-sm font-medium text-gray-900 truncate max-w-[180px]">{item.product.name}</span>
                              <ChevronRightIcon className={cn('w-3.5 h-3.5 text-gray-300 transition-transform flex-shrink-0', isExpanded && 'rotate-90')} />
                            </div>
                            <div className="text-[10px] text-gray-400">{item.product.barcode}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 sm:px-3 py-2.5 text-right text-sm tabular-nums">
                        {item.metrics.sales_count}
                        {returns > 0 && (
                          <span className={cn('ml-1 text-[10px]', getReturnRateColor(getReturnRate(item)))}>
                            ·{returns}
                          </span>
                        )}
                      </td>
                      <td className="px-2 sm:px-3 py-2.5 text-right text-sm tabular-nums font-medium">{formatCurrency(item.metrics.revenue)}</td>
                      <td className="px-2 sm:px-3 py-2.5 text-right text-sm tabular-nums text-amber-600">{formatCurrency(item.metrics.purchase_costs)}</td>
                      <td className="px-2 sm:px-3 py-2.5 text-right text-sm tabular-nums text-purple-600">{formatCurrency(item.metrics.mp_costs)}</td>
                      {hasAds && (
                        <td className="px-2 sm:px-3 py-2.5 text-right text-sm tabular-nums text-blue-600">{formatCurrency(item.metrics.ad_cost ?? 0)}</td>
                      )}
                      <td className="px-2 sm:px-3 py-2.5 text-right">
                        <span className={cn('text-sm font-semibold tabular-nums', positive ? 'text-emerald-700' : 'text-red-600')}>
                          {formatCurrency(item.metrics.net_profit)}
                        </span>
                      </td>
                      <td className="px-2 sm:px-3 py-2.5 text-right">
                        <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded', getMarginColor(margin), getMarginBg(margin))}>
                          {formatPercent(margin)}
                        </span>
                      </td>
                      <td className="px-2 sm:px-3 py-2.5 text-right">
                        <span className={cn('text-sm tabular-nums', positive ? 'text-emerald-700' : 'text-red-600')}>
                          {formatCurrency(item.metrics.unit_profit)}
                        </span>
                      </td>
                      {hasAds && (
                        <td className="px-2 sm:px-3 py-2.5 text-right text-sm tabular-nums text-blue-600">
                          {item.metrics.drr > 0 ? formatPercent(item.metrics.drr) : '—'}
                        </td>
                      )}
                      <td className="px-2 sm:px-3 py-2.5 text-right">
                        <ContributionBar pct={contribution} />
                      </td>
                      <td className="px-1 py-2.5 text-center">
                        <AlertIcons alerts={alerts} />
                      </td>
                      {hasPlan && (() => {
                        const pct = planMap.get(item.product.id);
                        if (pct === undefined) return <td className="px-2 py-2.5 text-right text-xs text-gray-300">—</td>;
                        const pace = planPaceMap.get(item.product.id);
                        return (
                          <td className="px-2 py-2.5 text-right">
                            <div
                              className="flex flex-col items-end gap-0.5"
                              title={pace ? `Прогноз: ~${Math.round(pace.forecastPct)}% · Темп: ${Math.round(pace.dailyPace).toLocaleString('ru-RU')}₽/день${pace.gap > 0 ? ` · Нужно: ${Math.round(pace.requiredDaily).toLocaleString('ru-RU')}₽/день` : ''}` : undefined}
                            >
                              <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded tabular-nums', getCompletionColor(pct))}>{Math.round(pct)}%</span>
                              {pace && (
                                <span className={cn('text-[10px] tabular-nums', getPaceStatusColor(pace.status))}>
                                  {getPaceStatusLabel(pace.status)}
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })()}
                    </tr>
                    {isExpanded && (
                      <tr className="bg-gray-50/30">
                        <td colSpan={colCount} className="px-3 sm:px-4 py-2">
                          <UeExpandedRow
                            wbMetrics={mpBreakdown.get(item.product.id)?.wb}
                            ozonMetrics={mpBreakdown.get(item.product.id)?.ozon}
                            marketplace={marketplace}
                            wbPlan={wbPlanMap.get(item.product.id)}
                            ozonPlan={ozonPlanMap.get(item.product.id)}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
          {/* TOTALS */}
          {products.length > 0 && (
            <tfoot className="bg-gray-50 font-semibold border-t border-gray-200">
              <tr>
                <td className="px-2 sm:px-3 py-2.5 text-sm">ИТОГО <span className="font-normal text-gray-400 text-xs ml-1">({products.length})</span></td>
                <td className="px-2 sm:px-3 py-2.5 text-right text-sm tabular-nums">{allTotals.sales}</td>
                <td className="px-2 sm:px-3 py-2.5 text-right text-sm tabular-nums">{formatCurrency(allTotals.revenue)}</td>
                <td className="px-2 sm:px-3 py-2.5 text-right text-sm tabular-nums text-amber-600">{formatCurrency(allTotals.purchase)}</td>
                <td className="px-2 sm:px-3 py-2.5 text-right text-sm tabular-nums text-purple-600">{formatCurrency(allTotals.mpCosts)}</td>
                {hasAds && <td className="px-2 sm:px-3 py-2.5 text-right text-sm tabular-nums text-blue-600">{formatCurrency(allTotals.adCost)}</td>}
                <td className="px-2 sm:px-3 py-2.5 text-right text-sm tabular-nums">
                  <span className={allTotals.profit >= 0 ? 'text-emerald-700' : 'text-red-600'}>{formatCurrency(allTotals.profit)}</span>
                </td>
                <td className="px-2 sm:px-3 py-2.5 text-right">
                  <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded', getMarginColor(avgMargin), getMarginBg(avgMargin))}>
                    {formatPercent(avgMargin)}
                  </span>
                </td>
                <td className="px-2 sm:px-3 py-2.5 text-right text-sm tabular-nums">
                  <span className={allTotals.profit >= 0 ? 'text-emerald-700' : 'text-red-600'}>
                    {allTotals.sales > 0 ? formatCurrency(allTotals.profit / allTotals.sales) : '—'}
                  </span>
                </td>
                {hasAds && (
                  <td className="px-2 sm:px-3 py-2.5 text-right text-sm tabular-nums text-blue-600">
                    {allTotals.revenue > 0 && allTotals.adCost > 0 ? formatPercent((allTotals.adCost / allTotals.revenue) * 100) : '—'}
                  </td>
                )}
                <td className="px-2 sm:px-3 py-2.5" />
                <td className="px-1 py-2.5" />
                {hasPlan && (() => {
                  const pct = Math.round(totalPlanCompletion);
                  return (
                    <td className="px-2 py-2.5 text-right">
                      <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded tabular-nums', getCompletionColor(pct))}>{pct}%</span>
                    </td>
                  );
                })()}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* ====== MOBILE CARDS ====== */}
      <div className="sm:hidden divide-y divide-gray-100">
        {paged.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-gray-400">
            {search || filter !== 'all' ? 'Ничего не найдено' : 'Нет данных за период'}
          </div>
        ) : (
          paged.map((item) => {
            const margin = getMargin(item);
            const positive = item.metrics.net_profit >= 0;
            const abc = abcMap.get(item.product.id) ?? 'C';
            const isExpanded = expandedRows.has(item.product.id);
            const alerts = getAlerts(item, planMap.get(item.product.id));

            return (
              <div key={item.product.id}>
                <div
                  className={cn('px-3 py-2.5 cursor-pointer transition-colors', isExpanded ? 'bg-gray-50/50' : '')}
                  onClick={() => toggleRow(item.product.id)}
                >
                  {/* Row 1: Name + ABC + Margin + Alerts */}
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <AbcBadge grade={abc} />
                    <div className="text-sm font-medium text-gray-900 truncate flex-1 min-w-0">
                      {item.product.name}
                    </div>
                    {alerts.length > 0 && <AlertIcons alerts={alerts} />}
                    {hasPlan && (() => {
                      const pct = planMap.get(item.product.id);
                      if (pct === undefined) return null;
                      return (
                        <span className={cn('text-[10px] font-medium px-1 py-0.5 rounded tabular-nums flex-shrink-0', getCompletionColor(pct))}>
                          {Math.round(pct)}%
                        </span>
                      );
                    })()}
                    <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded flex-shrink-0', getMarginColor(margin), getMarginBg(margin))}>
                      {formatPercent(margin)}
                    </span>
                    <ChevronRightIcon className={cn('w-3.5 h-3.5 text-gray-300 transition-transform flex-shrink-0', isExpanded && 'rotate-90')} />
                  </div>
                  {/* Row 2: Metrics grid */}
                  <div className="grid grid-cols-3 gap-x-2 text-[11px]">
                    <div>
                      <span className="text-gray-400">Продажи</span>
                      <div className="font-medium tabular-nums">{formatCurrency(item.metrics.revenue)}</div>
                    </div>
                    <div>
                      <span className="text-gray-400">Прибыль</span>
                      <div className={cn('font-semibold tabular-nums', positive ? 'text-emerald-700' : 'text-red-600')}>
                        {formatCurrency(item.metrics.net_profit)}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-400">На ед.</span>
                      <div className={cn('font-medium tabular-nums', positive ? 'text-emerald-700' : 'text-red-600')}>
                        {formatCurrency(item.metrics.unit_profit)}
                      </div>
                    </div>
                  </div>
                  {/* Row 3: Mini cost bar */}
                  {item.metrics.revenue > 0 && (
                    <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden bg-gray-100 mt-1.5">
                      <div className="h-full bg-amber-400" style={{ width: `${(item.metrics.purchase_costs / item.metrics.revenue) * 100}%` }} />
                      <div className="h-full bg-purple-400" style={{ width: `${(item.metrics.mp_costs / item.metrics.revenue) * 100}%` }} />
                      {(item.metrics.ad_cost ?? 0) > 0 && (
                        <div className="h-full bg-blue-400" style={{ width: `${((item.metrics.ad_cost ?? 0) / item.metrics.revenue) * 100}%` }} />
                      )}
                      <div
                        className={cn('h-full', positive ? 'bg-emerald-400' : 'bg-red-400')}
                        style={{ width: `${Math.abs((item.metrics.net_profit / item.metrics.revenue) * 100)}%` }}
                      />
                    </div>
                  )}
                </div>
                {/* Expanded: MP breakdown */}
                {isExpanded && (
                  <div className="px-3 pb-3">
                    <UeExpandedRow
                      wbMetrics={mpBreakdown.get(item.product.id)?.wb}
                      ozonMetrics={mpBreakdown.get(item.product.id)?.ozon}
                      marketplace={marketplace}
                      wbPlan={wbPlanMap.get(item.product.id)}
                      ozonPlan={ozonPlanMap.get(item.product.id)}
                    />
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Mobile totals */}
        {products.length > 0 && (
          <div className="px-3 py-2.5 bg-gray-50">
            <div className="text-xs font-semibold text-gray-700 mb-1">ИТОГО ({products.length})</div>
            <div className="grid grid-cols-3 gap-x-2 text-[11px]">
              <div>
                <span className="text-gray-400">Продажи</span>
                <div className="font-semibold tabular-nums">{formatCurrency(allTotals.revenue)}</div>
              </div>
              <div>
                <span className="text-gray-400">Прибыль</span>
                <div className={cn('font-semibold tabular-nums', allTotals.profit >= 0 ? 'text-emerald-700' : 'text-red-600')}>
                  {formatCurrency(allTotals.profit)}
                </div>
              </div>
              <div>
                <span className="text-gray-400">Маржа</span>
                <div className={cn('font-semibold', getMarginColor(avgMargin))}>
                  {formatPercent(avgMargin)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Pagination */}
      {processed.length > itemsPerPage && (
        <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 border-t border-gray-100 bg-gray-50/50">
          <span className="text-xs text-gray-500">
            {(safePage - 1) * itemsPerPage + 1}–{Math.min(safePage * itemsPerPage, processed.length)} из {processed.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {!isMobile && Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
              .map((p, idx, arr) => (
                <span key={p}>
                  {idx > 0 && arr[idx - 1] !== p - 1 && (
                    <span className="text-xs text-gray-300 px-0.5">…</span>
                  )}
                  <button
                    onClick={() => setPage(p)}
                    className={cn(
                      'w-7 h-7 text-xs rounded',
                      p === safePage ? 'bg-indigo-600 text-white font-medium' : 'hover:bg-gray-200 text-gray-600',
                    )}
                  >
                    {p}
                  </button>
                </span>
              ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
