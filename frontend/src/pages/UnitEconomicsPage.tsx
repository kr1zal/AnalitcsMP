/**
 * Страница Unit-экономики
 * KPI-карточки + ТОП/аутсайдеры bars + прогресс-бар + сортируемая таблица с пагинацией
 */
import { useState, useMemo } from 'react';
import { useUnitEconomics } from '../hooks/useDashboard';
import { useFiltersStore } from '../store/useFiltersStore';
import { FilterPanel } from '../components/Shared/FilterPanel';
import { FeatureGate } from '../components/Shared/FeatureGate';
import { LoadingSpinner } from '../components/Shared/LoadingSpinner';
import { formatCurrency, formatPercent, getDateRangeFromPreset, cn } from '../lib/utils';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Percent,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Search,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import type { UnitEconomicsItem } from '../types';

// ==================== TYPES ====================

type SortField = 'name' | 'sales_count' | 'returns_count' | 'revenue' | 'purchase_costs' | 'mp_costs' | 'ad_cost' | 'drr' | 'net_profit' | 'unit_profit' | 'margin';
type SortDirection = 'asc' | 'desc';

const ITEMS_PER_PAGE = 20;
const TOP_COUNT = 5;
const BOTTOM_COUNT = 3;

// ==================== HELPERS ====================

function getMargin(item: UnitEconomicsItem): number {
  return item.metrics.revenue > 0
    ? (item.metrics.net_profit / item.metrics.revenue) * 100
    : 0;
}

function getMarginColor(margin: number): string {
  if (margin >= 20) return 'text-green-600';
  if (margin >= 10) return 'text-yellow-600';
  return 'text-red-600';
}

function getMarginBg(margin: number): string {
  if (margin >= 20) return 'bg-green-50';
  if (margin >= 10) return 'bg-yellow-50';
  return 'bg-red-50';
}

function getSortValue(item: UnitEconomicsItem, field: SortField): number | string {
  switch (field) {
    case 'name': return item.product.name.toLowerCase();
    case 'margin': return getMargin(item);
    default: return item.metrics[field as keyof typeof item.metrics] ?? 0;
  }
}

// ==================== COMPONENT ====================

export const UnitEconomicsPage = () => {
  const { datePreset, marketplace, customDateFrom, customDateTo } = useFiltersStore();
  const dateRange = getDateRangeFromPreset(datePreset, customDateFrom, customDateTo);

  const filters = {
    date_from: dateRange.from,
    date_to: dateRange.to,
    marketplace,
  };

  const { data: unitData, isLoading, error } = useUnitEconomics(filters);

  // State
  const [sortField, setSortField] = useState<SortField>('net_profit');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  // Reset page on filter/search change
  const unitProducts = unitData?.products || [];

  // Aggregates
  const totals = useMemo(() => {
    const t = { revenue: 0, purchase: 0, mpCosts: 0, adCost: 0, profit: 0, sales: 0, returns: 0 };
    for (const p of unitProducts) {
      t.revenue += p.metrics.revenue;
      t.purchase += p.metrics.purchase_costs;
      t.mpCosts += p.metrics.mp_costs;
      t.adCost += p.metrics.ad_cost ?? 0;
      t.profit += p.metrics.net_profit;
      t.sales += p.metrics.sales_count;
      t.returns += p.metrics.returns_count ?? 0;
    }
    return t;
  }, [unitProducts]);

  const hasAds = totals.adCost > 0;
  const hasReturns = totals.returns > 0;
  const costsTreeRatio = unitData?.costs_tree_ratio ?? 1;

  const avgMargin = totals.revenue > 0 ? (totals.profit / totals.revenue) * 100 : 0;
  const avgUnitProfit = totals.sales > 0 ? totals.profit / totals.sales : 0;

  // Filtered + sorted
  const sortedProducts = useMemo(() => {
    let filtered = unitProducts;
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.product.name.toLowerCase().includes(q) ||
          p.product.barcode.toLowerCase().includes(q)
      );
    }

    return [...filtered].sort((a, b) => {
      const va = getSortValue(a, sortField);
      const vb = getSortValue(b, sortField);
      const cmp = typeof va === 'string' && typeof vb === 'string'
        ? va.localeCompare(vb)
        : (va as number) - (vb as number);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [unitProducts, search, sortField, sortDir]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedProducts.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paginatedProducts = sortedProducts.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE
  );
  const showPagination = sortedProducts.length > ITEMS_PER_PAGE;

  // TOP/BOTTOM bars
  const barsData = useMemo(() => {
    const byProfit = [...unitProducts].sort((a, b) => b.metrics.net_profit - a.metrics.net_profit);
    if (byProfit.length <= TOP_COUNT + BOTTOM_COUNT) return { top: byProfit, bottom: [], restProfit: 0 };

    const top = byProfit.slice(0, TOP_COUNT);
    const bottom = byProfit.slice(-BOTTOM_COUNT).reverse();
    const restProfit = byProfit
      .slice(TOP_COUNT, -BOTTOM_COUNT)
      .reduce((s, p) => s + p.metrics.net_profit, 0);
    return { top, bottom, restProfit };
  }, [unitProducts]);

  // Sort handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'name' ? 'asc' : 'desc');
    }
    setPage(1);
  };

  if (isLoading) {
    return <LoadingSpinner text="Загрузка unit-экономики..." />;
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">Ошибка: {(error as Error).message}</p>
        </div>
      </div>
    );
  }

  const maxBarProfit = Math.max(
    ...barsData.top.map((p) => Math.abs(p.metrics.net_profit)),
    ...barsData.bottom.map((p) => Math.abs(p.metrics.net_profit)),
    1
  );

  return (
    <FeatureGate feature="unit_economics">
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-2xl font-bold text-gray-900">Unit-экономика</h2>
        <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
          Прибыль на единицу · {unitProducts.length} товаров · {dateRange.from} — {dateRange.to}
          {costsTreeRatio < 1 && (
            <span className="ml-1 text-amber-600" title="Закупка скорректирована по доле проведённых заказов из финотчёта МП">
              · проведено {Math.round(costsTreeRatio * 100)}%
            </span>
          )}
        </p>
      </div>

      {/* Фильтры */}
      <FilterPanel />

      {/* ① KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mt-4 sm:mt-6 mb-4 sm:mb-6">
        <KpiCard
          label="Выручка"
          value={formatCurrency(totals.revenue)}
          sub={`${totals.sales} шт${hasReturns ? ` · ${totals.returns} возвр.` : ''}`}
          icon={<ShoppingCart className="w-3.5 h-3.5" />}
          color="blue"
        />
        <KpiCard
          label="Прибыль"
          value={formatCurrency(totals.profit)}
          sub={totals.profit >= 0 ? 'в плюсе' : 'убыток'}
          icon={<DollarSign className="w-3.5 h-3.5" />}
          color={totals.profit >= 0 ? 'green' : 'red'}
        />
        <KpiCard
          label="Ср. маржа"
          value={formatPercent(avgMargin)}
          sub={avgMargin >= 20 ? 'хорошо' : avgMargin >= 10 ? 'средне' : 'низкая'}
          icon={<Percent className="w-3.5 h-3.5" />}
          color={avgMargin >= 20 ? 'green' : avgMargin >= 10 ? 'yellow' : 'red'}
        />
        <KpiCard
          label="Прибыль/ед."
          value={formatCurrency(avgUnitProfit)}
          sub="среднее"
          icon={avgUnitProfit >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          color={avgUnitProfit >= 0 ? 'green' : 'red'}
        />
      </div>

      {/* ② TOP/BOTTOM Bars */}
      {unitProducts.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-5 mb-4 sm:mb-6">
          <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-3 sm:mb-4">
            Прибыль по товарам
          </h3>

          {/* TOP */}
          <div className="space-y-1.5 sm:space-y-2">
            {barsData.top.map((item) => (
              <ProfitBar key={item.product.id} item={item} maxValue={maxBarProfit} />
            ))}
          </div>

          {/* Rest summary */}
          {barsData.bottom.length > 0 && (
            <>
              <div className="my-2 sm:my-3 text-xs text-gray-400 text-center">
                ещё {unitProducts.length - TOP_COUNT - BOTTOM_COUNT} товаров: {formatCurrency(barsData.restProfit)}
              </div>
              {/* BOTTOM (losers) */}
              <div className="space-y-1.5 sm:space-y-2">
                {barsData.bottom.map((item) => (
                  <ProfitBar key={item.product.id} item={item} maxValue={maxBarProfit} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ③ Cost Structure Bar */}
      {totals.revenue > 0 && (() => {
        // Прибыль считается через payout distribution (costs-tree), поэтому
        // mpCosts вычисляем как остаток, чтобы бар всегда давал 100%:
        // revenue = purchase + mpCosts_implied + ads + profit
        const purchasePct = Math.max(0, (totals.purchase / totals.revenue) * 100);
        const adsPct = hasAds ? Math.max(0, (totals.adCost / totals.revenue) * 100) : 0;
        const profitPct = (totals.profit / totals.revenue) * 100;
        const absProfitPct = Math.abs(profitPct);
        // MP costs = всё что осталось между выручкой, закупкой, рекламой и прибылью
        const mpCostsPct = Math.max(0, 100 - purchasePct - adsPct - profitPct);
        return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-5 mb-4 sm:mb-6">
          <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-3">Структура затрат</h3>

          <div className="flex items-center gap-0.5 h-3 sm:h-4 rounded-full overflow-hidden bg-gray-100">
            <div
              className="h-full bg-amber-400 transition-all"
              style={{ width: `${purchasePct}%` }}
            />
            <div
              className="h-full bg-purple-400 transition-all"
              style={{ width: `${mpCostsPct}%` }}
            />
            {hasAds && (
              <div
                className="h-full bg-blue-400 transition-all"
                style={{ width: `${adsPct}%` }}
              />
            )}
            <div
              className={cn('h-full transition-all', totals.profit >= 0 ? 'bg-green-400' : 'bg-red-400')}
              style={{ width: `${absProfitPct}%` }}
            />
          </div>

          <div className="flex justify-between mt-1.5 sm:mt-2 text-[10px] sm:text-xs text-gray-500">
            <span>Закупка {formatPercent(purchasePct)}</span>
            <span>Удержания МП {formatPercent(mpCostsPct)}</span>
            {hasAds && <span>Реклама {formatPercent(adsPct)}</span>}
            <span>Прибыль {formatPercent(absProfitPct)}</span>
          </div>
        </div>
        );
      })()}

      {/* ④ Sortable Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {/* Table header: search + count */}
        <div className="p-3 sm:p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center gap-2">
          <h3 className="text-sm sm:text-base font-semibold text-gray-900 flex-shrink-0">
            Таблица эффективности
          </h3>
          <div className="flex-1" />
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Поиск товара..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full sm:w-48 pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400"
            />
          </div>
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <SortableHeader field="name" label="Товар" current={sortField} dir={sortDir} onSort={handleSort} align="left" />
                <SortableHeader field="sales_count" label="Кол-во" current={sortField} dir={sortDir} onSort={handleSort} />
                {hasReturns && <SortableHeader field="returns_count" label="Возвр." current={sortField} dir={sortDir} onSort={handleSort} />}
                <SortableHeader field="revenue" label="Продажи" current={sortField} dir={sortDir} onSort={handleSort} />
                <SortableHeader field="purchase_costs" label="Закупка" current={sortField} dir={sortDir} onSort={handleSort} />
                <SortableHeader field="mp_costs" label="Удерж. МП" current={sortField} dir={sortDir} onSort={handleSort} />
                {hasAds && <SortableHeader field="ad_cost" label="Реклама" current={sortField} dir={sortDir} onSort={handleSort} />}
                {hasAds && <SortableHeader field="drr" label="ДРР" current={sortField} dir={sortDir} onSort={handleSort} />}
                <SortableHeader field="net_profit" label="Прибыль" current={sortField} dir={sortDir} onSort={handleSort} />
                <SortableHeader field="unit_profit" label="На ед." current={sortField} dir={sortDir} onSort={handleSort} />
                <SortableHeader field="margin" label="Маржа" current={sortField} dir={sortDir} onSort={handleSort} />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedProducts.length === 0 ? (
                <tr>
                  <td colSpan={(hasAds ? 10 : 8) + (hasReturns ? 1 : 0)} className="px-4 py-8 text-center text-sm text-gray-400">
                    {search ? 'Ничего не найдено' : 'Нет данных за период'}
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((item) => {
                  const margin = getMargin(item);
                  const positive = item.metrics.net_profit >= 0;
                  return (
                    <tr key={item.product.id} className="hover:bg-gray-50/50">
                      <td className="px-3 py-2.5">
                        <div className="text-sm font-medium text-gray-900 truncate max-w-[200px]">{item.product.name}</div>
                        <div className="text-[10px] text-gray-400">{item.product.barcode}</div>
                      </td>
                      <td className="px-3 py-2.5 text-right text-sm tabular-nums">{item.metrics.sales_count}</td>
                      {hasReturns && (
                        <td className="px-3 py-2.5 text-right text-sm tabular-nums text-red-500">
                          {item.metrics.returns_count > 0 ? item.metrics.returns_count : '—'}
                        </td>
                      )}
                      <td className="px-3 py-2.5 text-right text-sm tabular-nums font-medium">{formatCurrency(item.metrics.revenue)}</td>
                      <td className="px-3 py-2.5 text-right text-sm tabular-nums text-amber-600">{formatCurrency(item.metrics.purchase_costs)}</td>
                      <td className="px-3 py-2.5 text-right text-sm tabular-nums text-purple-600">{formatCurrency(item.metrics.mp_costs)}</td>
                      {hasAds && (
                        <td className="px-3 py-2.5 text-right text-sm tabular-nums text-blue-600">{formatCurrency(item.metrics.ad_cost ?? 0)}</td>
                      )}
                      {hasAds && (
                        <td className="px-3 py-2.5 text-right text-sm tabular-nums text-blue-600">
                          {item.metrics.drr > 0 ? formatPercent(item.metrics.drr) : '—'}
                        </td>
                      )}
                      <td className="px-3 py-2.5 text-right">
                        <span className={cn('text-sm font-semibold tabular-nums', positive ? 'text-green-600' : 'text-red-600')}>
                          {formatCurrency(item.metrics.net_profit)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span className={cn('text-sm tabular-nums', positive ? 'text-green-600' : 'text-red-600')}>
                          {formatCurrency(item.metrics.unit_profit)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded', getMarginColor(margin), getMarginBg(margin))}>
                          {formatPercent(margin)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {/* TOTALS row - always shows totals for ALL products (not just current page) */}
            {unitProducts.length > 0 && (
              <tfoot className="bg-gray-50 font-semibold border-t border-gray-200">
                <tr>
                  <td className="px-3 py-2.5 text-sm">
                    ИТОГО
                    <span className="font-normal text-gray-400 text-xs ml-1">({unitProducts.length})</span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-sm tabular-nums">{totals.sales}</td>
                  {hasReturns && (
                    <td className="px-3 py-2.5 text-right text-sm tabular-nums text-red-500">{totals.returns}</td>
                  )}
                  <td className="px-3 py-2.5 text-right text-sm tabular-nums">{formatCurrency(totals.revenue)}</td>
                  <td className="px-3 py-2.5 text-right text-sm tabular-nums text-amber-600">{formatCurrency(totals.purchase)}</td>
                  <td className="px-3 py-2.5 text-right text-sm tabular-nums text-purple-600">{formatCurrency(totals.mpCosts)}</td>
                  {hasAds && (
                    <td className="px-3 py-2.5 text-right text-sm tabular-nums text-blue-600">{formatCurrency(totals.adCost)}</td>
                  )}
                  {hasAds && (
                    <td className="px-3 py-2.5 text-right text-sm tabular-nums text-blue-600">
                      {totals.revenue > 0 && totals.adCost > 0 ? formatPercent((totals.adCost / totals.revenue) * 100) : '—'}
                    </td>
                  )}
                  <td className="px-3 py-2.5 text-right text-sm tabular-nums">
                    <span className={totals.profit >= 0 ? 'text-green-600' : 'text-red-600'}>{formatCurrency(totals.profit)}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-sm tabular-nums">
                    <span className={totals.profit >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {totals.sales > 0 ? formatCurrency(totals.profit / totals.sales) : '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-sm">
                    <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded', getMarginColor(avgMargin), getMarginBg(avgMargin))}>
                      {formatPercent(avgMargin)}
                    </span>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Mobile cards */}
        <div className="sm:hidden divide-y divide-gray-100">
          {paginatedProducts.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-gray-400">
              {search ? 'Ничего не найдено' : 'Нет данных за период'}
            </div>
          ) : (
            paginatedProducts.map((item) => {
              const margin = getMargin(item);
              const positive = item.metrics.net_profit >= 0;
              return (
                <div key={item.product.id} className="px-3 py-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="text-sm font-medium text-gray-900 truncate flex-1 min-w-0 mr-2">
                      {item.product.name}
                    </div>
                    <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded flex-shrink-0', getMarginColor(margin), getMarginBg(margin))}>
                      {formatPercent(margin)}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-x-2 text-[11px]">
                    <div>
                      <span className="text-gray-400">Продажи</span>
                      <div className="font-medium tabular-nums">{formatCurrency(item.metrics.revenue)}</div>
                    </div>
                    <div>
                      <span className="text-gray-400">Прибыль</span>
                      <div className={cn('font-semibold tabular-nums', positive ? 'text-green-600' : 'text-red-600')}>
                        {formatCurrency(item.metrics.net_profit)}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-400">На ед.</span>
                      <div className={cn('font-medium tabular-nums', positive ? 'text-green-600' : 'text-red-600')}>
                        {formatCurrency(item.metrics.unit_profit)}
                      </div>
                    </div>
                  </div>
                  {item.metrics.returns_count > 0 && (
                    <div className="text-[10px] text-red-500 mt-0.5">
                      возвр. {item.metrics.returns_count}
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Mobile totals */}
          {unitProducts.length > 0 && (
            <div className="px-3 py-2.5 bg-gray-50">
              <div className="text-xs font-semibold text-gray-700 mb-1">ИТОГО ({unitProducts.length})</div>
              <div className="grid grid-cols-3 gap-x-2 text-[11px]">
                <div>
                  <span className="text-gray-400">Продажи</span>
                  <div className="font-semibold tabular-nums">{formatCurrency(totals.revenue)}</div>
                </div>
                <div>
                  <span className="text-gray-400">Прибыль</span>
                  <div className={cn('font-semibold tabular-nums', totals.profit >= 0 ? 'text-green-600' : 'text-red-600')}>
                    {formatCurrency(totals.profit)}
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
        {showPagination && (
          <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 border-t border-gray-100 bg-gray-50/50">
            <span className="text-xs text-gray-500">
              {(safePage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(safePage * ITEMS_PER_PAGE, sortedProducts.length)} из {sortedProducts.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
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
                        p === safePage
                          ? 'bg-indigo-600 text-white font-medium'
                          : 'hover:bg-gray-200 text-gray-600'
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
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
    </FeatureGate>
  );
};

// ==================== SUB-COMPONENTS ====================

/** KPI Card */
function KpiCard({
  label,
  value,
  sub,
  icon,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'red' | 'yellow';
}) {
  const colors = {
    blue: 'bg-blue-50 border-blue-100 text-blue-700',
    green: 'bg-green-50 border-green-100 text-green-700',
    red: 'bg-red-50 border-red-100 text-red-700',
    yellow: 'bg-yellow-50 border-yellow-100 text-yellow-700',
  };

  return (
    <div className={cn('rounded-lg border p-2.5 sm:p-4', colors[color])}>
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[10px] sm:text-xs opacity-80">{label}</span>
      </div>
      <div className="text-base sm:text-xl font-bold truncate">{value}</div>
      <div className="text-[10px] sm:text-xs opacity-60 mt-0.5">{sub}</div>
    </div>
  );
}

/** Horizontal profit bar */
function ProfitBar({ item, maxValue }: { item: UnitEconomicsItem; maxValue: number }) {
  const profit = item.metrics.net_profit;
  const positive = profit >= 0;
  const width = Math.max(2, (Math.abs(profit) / maxValue) * 100);
  const margin = getMargin(item);

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <div className="w-24 sm:w-40 text-xs sm:text-sm text-gray-700 truncate flex-shrink-0" title={item.product.name}>
        {item.product.name}
      </div>
      <div className="flex-1 flex items-center gap-1.5">
        <div className="flex-1 h-4 sm:h-5 bg-gray-50 rounded overflow-hidden">
          <div
            className={cn('h-full rounded transition-all', positive ? 'bg-green-400' : 'bg-red-400')}
            style={{ width: `${width}%` }}
          />
        </div>
        <span className={cn('text-xs sm:text-sm font-medium tabular-nums w-16 sm:w-20 text-right flex-shrink-0', positive ? 'text-green-600' : 'text-red-600')}>
          {formatCurrency(profit)}
        </span>
        <span className={cn('text-[10px] px-1 py-0.5 rounded flex-shrink-0 hidden sm:inline', getMarginColor(margin), getMarginBg(margin))}>
          {formatPercent(margin)}
        </span>
      </div>
    </div>
  );
}

/** Sortable table header */
function SortableHeader({
  field,
  label,
  current,
  dir,
  onSort,
  align = 'right',
}: {
  field: SortField;
  label: string;
  current: SortField;
  dir: SortDirection;
  onSort: (f: SortField) => void;
  align?: 'left' | 'right';
}) {
  const active = current === field;
  return (
    <th
      className={cn(
        'px-3 py-2.5 text-xs font-medium text-gray-500 uppercase cursor-pointer select-none hover:text-gray-700 transition-colors',
        align === 'left' ? 'text-left' : 'text-right'
      )}
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-0.5">
        {align === 'right' && active && (
          dir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
        )}
        {label}
        {align === 'left' && active && (
          dir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
        )}
        {!active && <ArrowUpDown className="w-3 h-3 opacity-30" />}
      </span>
    </th>
  );
}
