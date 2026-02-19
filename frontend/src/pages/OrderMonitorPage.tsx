/**
 * Страница Монитор заказов — Phase 2: позаказная детализация
 * Каждый заказ = одна строка со всей финансовой информацией.
 * Математика: sale_price - commission - logistics - storage - other = payout
 */
import { useState, useMemo, useCallback } from 'react';
import { useOrderFunnel, useOrdersList } from '../hooks/useOrders';
import { useFiltersStore } from '../store/useFiltersStore';
import { useIsMobile } from '../hooks/useMediaQuery';
import { FilterPanel } from '../components/Shared/FilterPanel';
import { FeatureGate } from '../components/Shared/FeatureGate';
import { LoadingSpinner } from '../components/Shared/LoadingSpinner';
import { formatCurrency, formatPercent, formatNumber, getDateRangeFromPreset, cn } from '../lib/utils';
import {
  ShoppingCart,
  ShoppingBag,
  RotateCcw,
  Clock,
  AlertTriangle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Filter,
  X,
  Check,
  Minus,
} from 'lucide-react';
import type { Order, OrderStatus, OrdersFilters } from '../types';

// ==================== STATUS HELPERS ====================

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bg: string }> = {
  ordered: { label: 'Заказан', color: 'text-gray-700', bg: 'bg-gray-100' },
  delivering: { label: 'Доставка', color: 'text-blue-700', bg: 'bg-blue-100' },
  sold: { label: 'Выкуп', color: 'text-green-700', bg: 'bg-green-100' },
  returned: { label: 'Возврат', color: 'text-red-700', bg: 'bg-red-100' },
  cancelled: { label: 'Отмена', color: 'text-orange-700', bg: 'bg-orange-100' },
};

function StatusBadge({ status }: { status: OrderStatus }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.ordered;
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', cfg.bg, cfg.color)}>
      {cfg.label}
    </span>
  );
}

function SettledBadge({ settled }: { settled: boolean }) {
  return settled ? (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-50 text-green-700">
      <Check className="w-3 h-3" />
    </span>
  ) : (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-yellow-50 text-yellow-700">
      <Clock className="w-3 h-3" />
    </span>
  );
}

function MarketplaceBadge({ mp, ozonPostingStatus }: { mp: string; ozonPostingStatus?: string | null }) {
  const isWB = mp === 'wb';
  const fulfillment = ozonPostingStatus?.split(':')[0];
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={cn(
        'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase',
        isWB ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700',
      )}>
        {isWB ? 'WB' : 'OZ'}
      </span>
      {!isWB && fulfillment && (
        <span className={cn(
          'text-[9px] font-medium',
          fulfillment === 'FBO' ? 'text-blue-500' : 'text-teal-500',
        )}>
          {fulfillment}
        </span>
      )}
    </div>
  );
}

/** Реальная цена продажи: sale_price если есть, иначе price */
function getEffectivePrice(order: Order): number {
  return order.sale_price ?? order.price;
}

/** Скидка СПП = каталожная - реальная (только если sale_price < price) */
function getSppDiscount(order: Order): number {
  if (order.sale_price !== null && order.sale_price < order.price) {
    return order.price - order.sale_price;
  }
  return 0;
}

/** Процент СПП */
function getSppPercent(order: Order): number {
  const discount = getSppDiscount(order);
  if (discount > 0 && order.price > 0) {
    return Math.round((discount / order.price) * 100);
  }
  return 0;
}

// ==================== ORDER DETAIL PANEL ====================

function OrderDetailPanel({ order }: { order: Order }) {
  const effectivePrice = getEffectivePrice(order);
  const sppDiscount = getSppDiscount(order);
  const sppPercent = getSppPercent(order);
  const totalDeductions = order.commission + order.logistics + order.storage_fee + order.other_fees;
  const calculatedPayout = effectivePrice - totalDeductions;
  const isWB = order.marketplace === 'wb';

  // Rows for cost breakdown
  const breakdownRows = [
    { label: isWB ? 'Цена продажи (после СПП)' : 'Цена продажи', value: effectivePrice, color: 'text-gray-900', bold: true },
    ...(sppDiscount > 0 ? [{ label: `Скидка СПП (${sppPercent}%)`, value: -sppDiscount, color: 'text-amber-600', bold: false }] : []),
    { label: 'Комиссия МП', value: -order.commission, color: 'text-orange-600', bold: false },
    { label: 'Логистика', value: -order.logistics, color: 'text-blue-600', bold: false },
    ...(order.storage_fee > 0 ? [{ label: 'Хранение', value: -order.storage_fee, color: 'text-purple-600', bold: false }] : []),
    ...(order.other_fees > 0 ? [{ label: 'Прочее (штрафы, приёмка)', value: -order.other_fees, color: 'text-gray-500', bold: false }] : []),
  ];

  return (
    <div className="bg-gray-50 border-t border-gray-200 px-4 py-3">
      {/* Financial breakdown table */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Left: cost breakdown */}
        <div>
          <div className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Разбивка стоимости</div>
          <div className="space-y-1">
            {sppDiscount > 0 && (
              <div className="flex justify-between text-xs text-gray-400 pb-1 border-b border-dashed border-gray-200">
                <span>Каталожная цена</span>
                <span className="line-through">{formatCurrency(order.price)}</span>
              </div>
            )}
            {breakdownRows.map((row, i) => (
              <div key={i} className={cn('flex justify-between text-xs', row.bold ? 'font-semibold' : '')}>
                <span className={row.color}>{row.label}</span>
                <span className={cn(row.color, 'font-mono tabular-nums')}>
                  {row.value >= 0 ? formatCurrency(row.value) : `−${formatCurrency(Math.abs(row.value))}`}
                </span>
              </div>
            ))}
            <div className="border-t border-gray-300 pt-1 mt-1 flex justify-between text-xs font-bold">
              <span className="text-green-700">= К выплате</span>
              <span className="text-green-700 font-mono tabular-nums">
                {order.payout !== null ? formatCurrency(order.payout) : formatCurrency(calculatedPayout)}
              </span>
            </div>
            {/* Verification: show if calculated ≈ actual payout */}
            {order.payout !== null && Math.abs(calculatedPayout - order.payout) > 1 && (
              <div className="text-[10px] text-amber-600 mt-0.5">
                Расчётная: {formatCurrency(calculatedPayout)} (разница: {formatCurrency(Math.abs(calculatedPayout - order.payout))})
              </div>
            )}
          </div>
        </div>

        {/* Right: visual bar + meta */}
        <div>
          <div className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Структура удержаний</div>
          {totalDeductions > 0 && effectivePrice > 0 && (
            <>
              <div className="flex h-4 rounded-full overflow-hidden bg-gray-200 mb-2">
                {order.commission > 0 && (
                  <div
                    className="bg-orange-400 transition-all"
                    style={{ width: `${(order.commission / effectivePrice) * 100}%` }}
                    title={`Комиссия: ${formatCurrency(order.commission)}`}
                  />
                )}
                {order.logistics > 0 && (
                  <div
                    className="bg-blue-400 transition-all"
                    style={{ width: `${(order.logistics / effectivePrice) * 100}%` }}
                    title={`Логистика: ${formatCurrency(order.logistics)}`}
                  />
                )}
                {order.storage_fee > 0 && (
                  <div
                    className="bg-purple-400 transition-all"
                    style={{ width: `${(order.storage_fee / effectivePrice) * 100}%` }}
                    title={`Хранение: ${formatCurrency(order.storage_fee)}`}
                  />
                )}
                {order.other_fees > 0 && (
                  <div
                    className="bg-gray-400 transition-all"
                    style={{ width: `${(order.other_fees / effectivePrice) * 100}%` }}
                    title={`Прочее: ${formatCurrency(order.other_fees)}`}
                  />
                )}
                <div
                  className="bg-green-400 transition-all"
                  style={{ width: `${((effectivePrice - totalDeductions) / effectivePrice) * 100}%` }}
                  title={`Выплата: ${formatCurrency(effectivePrice - totalDeductions)}`}
                />
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {order.commission > 0 && (
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-orange-400" />
                    <span className="text-[10px] text-gray-600">Комиссия {formatPercent(order.commission / effectivePrice * 100)}</span>
                  </div>
                )}
                {order.logistics > 0 && (
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-blue-400" />
                    <span className="text-[10px] text-gray-600">Логистика {formatPercent(order.logistics / effectivePrice * 100)}</span>
                  </div>
                )}
                {order.storage_fee > 0 && (
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-purple-400" />
                    <span className="text-[10px] text-gray-600">Хранение {formatPercent(order.storage_fee / effectivePrice * 100)}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                  <span className="text-[10px] text-gray-600">Выплата {formatPercent((effectivePrice - totalDeductions) / effectivePrice * 100)}</span>
                </div>
              </div>
            </>
          )}

          {/* Meta info */}
          <div className="mt-3 space-y-0.5 text-[10px] text-gray-400">
            {order.region && <div>Регион: {order.region}</div>}
            {order.warehouse && <div>Склад: {order.warehouse}</div>}
            {order.wb_sale_id && <div>WB saleID: {order.wb_sale_id}</div>}
            {order.ozon_posting_status && <div>Ozon: {order.ozon_posting_status}</div>}
            <div className="font-mono">ID: {order.order_id}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== ORDER MOBILE CARD ====================

function OrderMobileCard({ order, expanded, onToggle }: { order: Order; expanded: boolean; onToggle: () => void }) {
  const effectivePrice = getEffectivePrice(order);
  const sppPercent = getSppPercent(order);

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <button onClick={onToggle} className="w-full p-3 text-left">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <MarketplaceBadge mp={order.marketplace} ozonPostingStatus={order.ozon_posting_status} />
            <span className="text-sm font-medium truncate max-w-[180px]">{order.product_name}</span>
          </div>
          <StatusBadge status={order.status} />
        </div>
        <div className="grid grid-cols-4 gap-2 mt-2">
          <div>
            <div className="text-[10px] text-gray-500">Продажа</div>
            <div className="text-sm font-medium">{formatCurrency(effectivePrice)}</div>
            {sppPercent > 0 && (
              <div className="text-[9px] text-amber-600">СПП −{sppPercent}%</div>
            )}
          </div>
          <div>
            <div className="text-[10px] text-gray-500">Удержания</div>
            <div className="text-sm font-medium text-red-600">
              {formatCurrency(order.commission + order.logistics + order.storage_fee + order.other_fees)}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500">Выплата</div>
            <div className="text-sm font-medium text-green-600">
              {order.payout !== null ? formatCurrency(order.payout) : '—'}
            </div>
          </div>
          <div className="flex items-center justify-end">
            <SettledBadge settled={order.settled} />
          </div>
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px] text-gray-400">
            {new Date(order.order_date).toLocaleDateString('ru-RU')}
          </span>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>
      {expanded && <OrderDetailPanel order={order} />}
    </div>
  );
}

// ==================== MAIN PAGE ====================

type SortField = 'order_date' | 'price' | 'payout' | 'commission' | 'logistics' | 'status' | 'settled';

const OrderMonitorPage = () => {
  const { datePreset, marketplace, fulfillmentType, customDateFrom, customDateTo } = useFiltersStore();
  const { from: dateFrom, to: dateTo } = getDateRangeFromPreset(datePreset, customDateFrom, customDateTo);
  const ftParam = fulfillmentType === 'all' ? undefined : fulfillmentType;
  const isMobile = useIsMobile();

  // Filters state
  const [statusFilter, setStatusFilter] = useState<OrderStatus | ''>('');
  const [settledFilter, setSettledFilter] = useState<boolean | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>('order_date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Build filters for API
  const ordersFilters = useMemo<OrdersFilters>(() => ({
    date_from: dateFrom,
    date_to: dateTo,
    marketplace: marketplace === 'all' ? undefined : marketplace,
    fulfillment_type: ftParam,
    status: statusFilter || undefined,
    settled: settledFilter ?? undefined,
    search: searchQuery || undefined,
    page,
    page_size: 50,
    sort_by: sortField,
    sort_dir: sortDir,
  }), [dateFrom, dateTo, marketplace, ftParam, statusFilter, settledFilter, searchQuery, page, sortField, sortDir]);

  // Data queries
  const funnelFilters = useMemo(() => ({
    date_from: dateFrom,
    date_to: dateTo,
    marketplace: marketplace === 'all' ? undefined : marketplace,
    fulfillment_type: ftParam,
  }), [dateFrom, dateTo, marketplace, ftParam]);

  const { data: funnelData } = useOrderFunnel(funnelFilters);
  const { data: ordersData, isLoading, isFetching } = useOrdersList(ordersFilters);

  const summary = ordersData?.summary;
  const funnelSummary = funnelData?.summary;
  const orders = ordersData?.orders || [];
  const totalPages = ordersData?.total_pages || 1;

  // Reset page when filters change
  const handleFilterChange = useCallback(() => {
    setPage(1);
  }, []);

  // Sort handler
  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
    setPage(1);
  }, [sortField]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-gray-400" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />;
  };

  return (
    <FeatureGate feature="order_monitor">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Монитор заказов</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {dateFrom} — {dateTo} {marketplace !== 'all' ? `(${marketplace.toUpperCase()})` : ''}
            </p>
          </div>
          {isFetching && <LoadingSpinner size="sm" />}
        </div>

        {/* Filter Panel */}
        <FilterPanel />

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="flex items-center gap-2 mb-1">
              <ShoppingCart className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-gray-500">Заказы</span>
            </div>
            <div className="text-xl font-bold">{formatNumber(summary?.total_orders || funnelSummary?.total_orders || 0)}</div>
            <div className="text-xs text-gray-400 mt-0.5">{formatCurrency(summary?.total_revenue || funnelSummary?.total_revenue || 0)}</div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="flex items-center gap-2 mb-1">
              <ShoppingBag className="w-4 h-4 text-green-500" />
              <span className="text-xs text-gray-500">Выкупы</span>
            </div>
            <div className="text-xl font-bold text-green-600">{formatNumber(summary?.total_sold || funnelSummary?.total_sales || 0)}</div>
            <div className="text-xs text-gray-400 mt-0.5">
              {formatPercent(summary?.buyout_percent || funnelSummary?.buyout_percent || 0)} выкуп
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="flex items-center gap-2 mb-1">
              <RotateCcw className="w-4 h-4 text-red-500" />
              <span className="text-xs text-gray-500">Возвраты</span>
            </div>
            <div className="text-xl font-bold text-red-600">{formatNumber(summary?.total_returned || funnelSummary?.total_returns || 0)}</div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-yellow-500" />
              <span className="text-xs text-gray-500">Ожидают</span>
            </div>
            <div className="text-xl font-bold text-yellow-600">
              {formatNumber(summary?.total_unsettled || funnelSummary?.unsettled_orders || 0)}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">непроведённых</div>
          </div>
        </div>

        {/* Funnel bars */}
        {funnelSummary && funnelSummary.total_orders > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Воронка заказов</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-16">Заказы</span>
                <div className="flex-1 bg-gray-100 rounded-full h-5">
                  <div className="bg-blue-500 rounded-full h-5 flex items-center justify-end pr-2" style={{ width: '100%' }}>
                    <span className="text-[10px] text-white font-medium">{formatNumber(funnelSummary.total_orders)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-16">Выкупы</span>
                <div className="flex-1 bg-gray-100 rounded-full h-5">
                  <div
                    className="bg-green-500 rounded-full h-5 flex items-center justify-end pr-2"
                    style={{ width: `${Math.max(5, funnelSummary.buyout_percent)}%` }}
                  >
                    <span className="text-[10px] text-white font-medium">
                      {formatNumber(funnelSummary.total_sales)} ({formatPercent(funnelSummary.buyout_percent)})
                    </span>
                  </div>
                </div>
              </div>
              {funnelSummary.total_returns > 0 && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-16">Возвраты</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-5">
                    <div
                      className="bg-red-400 rounded-full h-5 flex items-center justify-end pr-2"
                      style={{ width: `${Math.max(5, (funnelSummary.total_returns / funnelSummary.total_orders) * 100)}%` }}
                    >
                      <span className="text-[10px] text-white font-medium">{formatNumber(funnelSummary.total_returns)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Unsettled alert */}
        {(summary?.total_unsettled || 0) > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-medium text-yellow-800">
                {summary!.total_unsettled} заказов ожидают проведения
              </div>
              <div className="text-xs text-yellow-700 mt-0.5">
                МП ещё не финализировал расчёт. Обычно 7–14 дней для Ozon.
              </div>
            </div>
          </div>
        )}

        {/* Orders table section */}
        <div className="bg-white rounded-lg border border-gray-200">
          {/* Table header with filters */}
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-700">
                Позаказная детализация
                {ordersData && <span className="text-gray-400 ml-1">({ordersData.total_count})</span>}
              </h3>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded text-xs',
                  showFilters ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600',
                )}
              >
                <Filter className="w-3 h-3" />
                Фильтры
              </button>
            </div>

            {showFilters && (
              <div className="flex flex-wrap gap-2 mt-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Поиск по ID / штрихкоду"
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); handleFilterChange(); }}
                    className="pl-7 pr-2 py-1 text-xs border border-gray-300 rounded w-48 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value as OrderStatus | ''); handleFilterChange(); }}
                  className="px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">Все статусы</option>
                  <option value="ordered">Заказан</option>
                  <option value="delivering">Доставка</option>
                  <option value="sold">Выкуп</option>
                  <option value="returned">Возврат</option>
                  <option value="cancelled">Отмена</option>
                </select>

                <select
                  value={settledFilter === null ? '' : settledFilter ? 'true' : 'false'}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSettledFilter(v === '' ? null : v === 'true');
                    handleFilterChange();
                  }}
                  className="px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">Все (проведённые)</option>
                  <option value="true">Проведённые</option>
                  <option value="false">Непроведённые</option>
                </select>

                {(statusFilter || settledFilter !== null || searchQuery) && (
                  <button
                    onClick={() => {
                      setStatusFilter('');
                      setSettledFilter(null);
                      setSearchQuery('');
                      handleFilterChange();
                    }}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-3 h-3" />
                    Сбросить
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner />
            </div>
          )}

          {/* Empty state */}
          {!isLoading && orders.length === 0 && (
            <div className="text-center py-12">
              <ShoppingCart className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Нет заказов за выбранный период</p>
              <p className="text-xs text-gray-400 mt-1">Запустите синхронизацию, чтобы загрузить позаказные данные</p>
            </div>
          )}

          {/* Desktop table */}
          {!isLoading && orders.length > 0 && !isMobile && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                      <button onClick={() => handleSort('order_date')} className="flex items-center gap-1">
                        Дата <SortIcon field="order_date" />
                      </button>
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Товар</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">МП</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">
                      <button onClick={() => handleSort('status')} className="flex items-center gap-1">
                        Статус <SortIcon field="status" />
                      </button>
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">
                      <button onClick={() => handleSort('price')} className="flex items-center gap-1 ml-auto">
                        Продажа <SortIcon field="price" />
                      </button>
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">
                      <button onClick={() => handleSort('commission')} className="flex items-center gap-1 ml-auto">
                        Комиссия <SortIcon field="commission" />
                      </button>
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">
                      <button onClick={() => handleSort('logistics')} className="flex items-center gap-1 ml-auto">
                        Логистика <SortIcon field="logistics" />
                      </button>
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Удержания</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">
                      <button onClick={() => handleSort('payout')} className="flex items-center gap-1 ml-auto">
                        Выплата <SortIcon field="payout" />
                      </button>
                    </th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">
                      <button onClick={() => handleSort('settled')} className="flex items-center gap-1">
                        <Check className="w-3 h-3" />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {orders.map((order) => (
                    <OrderTableRow
                      key={order.id}
                      order={order}
                      expanded={expandedId === order.id}
                      onToggle={() => setExpandedId(expandedId === order.id ? null : order.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Mobile cards */}
          {!isLoading && orders.length > 0 && isMobile && (
            <div className="p-3 space-y-2">
              {orders.map((order) => (
                <OrderMobileCard
                  key={order.id}
                  order={order}
                  expanded={expandedId === order.id}
                  onToggle={() => setExpandedId(expandedId === order.id ? null : order.id)}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {!isLoading && totalPages > 1 && (
            <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
              <div className="text-xs text-gray-500">
                Стр. {page} из {totalPages}
                {ordersData && <span className="ml-1">({ordersData.total_count} записей)</span>}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={cn(
                        'w-7 h-7 rounded text-xs',
                        page === pageNum ? 'bg-indigo-600 text-white' : 'hover:bg-gray-100 text-gray-600',
                      )}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
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

// ==================== TABLE ROW (desktop) ====================

function OrderTableRow({ order, expanded, onToggle }: { order: Order; expanded: boolean; onToggle: () => void }) {
  const effectivePrice = getEffectivePrice(order);
  const sppPercent = getSppPercent(order);
  const totalDeductions = order.commission + order.logistics + order.storage_fee + order.other_fees;

  return (
    <>
      <tr
        onClick={onToggle}
        className={cn(
          'cursor-pointer transition-colors',
          expanded ? 'bg-indigo-50' : 'hover:bg-gray-50',
        )}
      >
        <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
          {new Date(order.order_date).toLocaleDateString('ru-RU')}
        </td>
        <td className="px-3 py-2">
          <div className="text-xs font-medium text-gray-900 truncate max-w-[180px]" title={order.product_name}>
            {order.product_name}
          </div>
          <div className="text-[10px] text-gray-400">{order.barcode}</div>
        </td>
        <td className="px-3 py-2 text-center">
          <MarketplaceBadge mp={order.marketplace} ozonPostingStatus={order.ozon_posting_status} />
        </td>
        <td className="px-3 py-2 text-center">
          <StatusBadge status={order.status} />
        </td>
        <td className="px-3 py-2 text-right">
          <div className="text-xs font-medium">{formatCurrency(effectivePrice)}</div>
          {sppPercent > 0 && (
            <div className="text-[10px] text-amber-600">СПП −{sppPercent}%</div>
          )}
        </td>
        <td className="px-3 py-2 text-right text-xs text-orange-600">
          {order.commission > 0 ? (
            <>
              <span>{formatCurrency(order.commission)}</span>
            </>
          ) : <Minus className="w-3 h-3 text-gray-300 ml-auto" />}
        </td>
        <td className="px-3 py-2 text-right text-xs text-blue-600">
          {order.logistics > 0 ? formatCurrency(order.logistics) : <Minus className="w-3 h-3 text-gray-300 ml-auto" />}
        </td>
        <td className="px-3 py-2 text-right text-xs text-red-500 font-medium">
          {totalDeductions > 0 ? formatCurrency(totalDeductions) : <Minus className="w-3 h-3 text-gray-300 ml-auto" />}
        </td>
        <td className="px-3 py-2 text-right text-xs font-semibold text-green-600">
          {order.payout !== null ? formatCurrency(order.payout) : '—'}
        </td>
        <td className="px-3 py-2 text-center">
          <SettledBadge settled={order.settled} />
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={10} className="p-0">
            <OrderDetailPanel order={order} />
          </td>
        </tr>
      )}
    </>
  );
}

export default OrderMonitorPage;
