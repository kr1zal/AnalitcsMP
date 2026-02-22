/**
 * StocksTable — Таблица остатков на складах (enterprise)
 *
 * Features:
 * - Поиск по названию / штрихкоду
 * - Фильтры: Все / OOS WB / OOS Ozon / Мало
 * - Сортировка по колонкам (desktop) / dropdown (mobile)
 * - Клиентская пагинация (20 desktop / 10 mobile)
 * - Визуальные progress bars для WB/OZON
 * - Раскрывающиеся детали по складам + штрихкод
 * - Итоговая строка (суммы WB/Ozon/Σ, средний прогноз)
 * - Sticky header (desktop)
 * - Счётчик: N из M товаров
 * - Адаптивный дизайн (mobile cards / desktop table)
 */
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Package,
  Search,
  HelpCircle,
  X,
} from 'lucide-react';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn, getMarketplaceName } from '../../lib/utils';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { LoadingSpinner } from '../Shared/LoadingSpinner';
import type { StockItem } from '../../types';

// ==================== TYPES ====================

type SortField = 'status' | 'name' | 'wb' | 'ozon' | 'total' | 'forecast';
type FilterType = 'all' | 'oos_wb' | 'oos_ozon' | 'low';

interface StockTotals {
  wbTotal: number;
  ozonTotal: number;
  total: number;
}

// ==================== CONSTANTS ====================

const PAGE_SIZE_DESKTOP = 20;
const PAGE_SIZE_MOBILE = 10;

const FILTERS: { key: FilterType; label: string; mobileLabel: string; activeClass: string; tooltip?: string }[] = [
  { key: 'all', label: 'Все', mobileLabel: 'Все', activeClass: 'bg-gray-900 text-white border-gray-900' },
  { key: 'oos_wb', label: 'OOS WB', mobileLabel: 'OOS WB', activeClass: 'bg-red-600 text-white border-red-600', tooltip: 'Out Of Stock — товары с нулевым\nостатком на складах Wildberries' },
  { key: 'oos_ozon', label: 'OOS Ozon', mobileLabel: 'OOS Oz', activeClass: 'bg-red-600 text-white border-red-600', tooltip: 'Out Of Stock — товары с нулевым\nостатком на складах OZON' },
  { key: 'low', label: 'Мало', mobileLabel: 'Мало', activeClass: 'bg-amber-500 text-white border-amber-500', tooltip: 'Товары с остатком менее 20 шт\nна одном из маркетплейсов' },
];

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'status', label: 'По статусу' },
  { value: 'name', label: 'По названию' },
  { value: 'total', label: 'По кол-ву' },
  { value: 'wb', label: 'По WB' },
  { value: 'ozon', label: 'По OZON' },
  { value: 'forecast', label: 'По прогнозу' },
];

// ==================== HELPERS ====================

function formatUpdatedAt(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const diffMs = Date.now() - d.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'только что';
  if (min < 60) return `${min} мин назад`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  return `${days} д назад`;
}

function getDaysLabel(days: number | null | undefined): { text: string; color: string; bgColor: string } {
  if (days === null || days === undefined) return { text: '—', color: 'text-gray-400', bgColor: '' };
  if (days <= 7) return { text: `${days} д`, color: 'text-red-700', bgColor: 'bg-red-50' };
  if (days <= 14) return { text: `${days} д`, color: 'text-amber-700', bgColor: 'bg-amber-50' };
  if (days <= 30) return { text: `${days} д`, color: 'text-blue-700', bgColor: 'bg-blue-50' };
  return { text: `${days} д`, color: 'text-emerald-700', bgColor: 'bg-emerald-50' };
}

function getStockStatus(quantity: number): { label: string; color: string; barColor: string; rank: number; tooltip: string } {
  if (quantity <= 0) return { label: 'OOS', color: 'text-red-600', barColor: 'bg-red-400', rank: 0, tooltip: 'Out Of Stock — товар закончился' };
  if (quantity < 20) return { label: 'Крит.', color: 'text-red-600', barColor: 'bg-red-400', rank: 1, tooltip: 'Критический остаток: менее 20 шт' };
  if (quantity < 100) return { label: 'Низкий', color: 'text-amber-600', barColor: 'bg-amber-400', rank: 2, tooltip: 'Низкий остаток: менее 100 шт' };
  return { label: 'OK', color: 'text-emerald-600', barColor: 'bg-emerald-400', rank: 3, tooltip: 'Достаточный остаток: от 100 шт' };
}

// ─── Tooltip constants ───

const FORECAST_TOOLTIP =
  'На сколько дней хватит текущего запаса\n\n' +
  'Формула: остаток ÷ ср. продажи/день (30д)\n' +
  'Пример: 150 шт ÷ 5 шт/день = 30 дней\n\n' +
  '≤ 7д — критично (красный)\n' +
  '≤ 14д — пополнить (жёлтый)\n' +
  '≤ 30д — умеренно (синий)\n' +
  '> 30д — достаточно (зелёный)';

const AVG_DAYS_TOOLTIP = 'Средний прогноз запаса по\nвсем товарам в текущем списке';

const STATUS_LEGEND_TOOLTIP =
  'Статусы остатков:\n\n' +
  'OOS — Out Of Stock (0 шт)\n' +
  'Крит. — критический (< 20 шт)\n' +
  'Низкий — пополнить (< 100 шт)\n' +
  'OK — достаточно (≥ 100 шт)';

/** Портальный тултип — рендерится через createPortal в body, не обрезается overflow */
const Tip = ({ text, align = 'left', wide }: { text: string; align?: 'left' | 'right'; wide?: boolean }) => {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const isTouchRef = useRef(false);
  const [isOpen, setIsOpen] = useState(false);

  // Position tooltip relative to trigger
  useEffect(() => {
    if (!isOpen || !triggerRef.current || !tooltipRef.current) return;
    const tr = triggerRef.current.getBoundingClientRect();
    const tt = tooltipRef.current;
    const rect = tt.getBoundingClientRect();
    const pad = 8;

    let top = tr.bottom + 6;
    const flipped = top + rect.height > window.innerHeight - pad;
    if (flipped) top = Math.max(pad, tr.top - rect.height - 6);

    let left = align === 'right' ? tr.right - rect.width : tr.left;
    left = Math.max(pad, Math.min(left, window.innerWidth - rect.width - pad));

    Object.assign(tt.style, { top: `${top}px`, left: `${left}px`, visibility: 'visible' });

    const arrow = tt.querySelector<HTMLElement>('[data-arrow]');
    if (arrow) {
      const al = tr.left + tr.width / 2 - left;
      arrow.style.left = `${Math.max(8, Math.min(al, rect.width - 8))}px`;
      if (flipped) {
        arrow.style.top = 'auto';
        arrow.style.bottom = '-4px';
      } else {
        arrow.style.top = '-4px';
        arrow.style.bottom = 'auto';
      }
    }
  }, [isOpen, align]);

  // Close on scroll / resize / outside tap
  useEffect(() => {
    if (!isOpen) return;
    const close = () => setIsOpen(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    const onDown = (e: Event) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [isOpen]);

  return (
    <span
      ref={triggerRef}
      className="inline-flex flex-shrink-0 ml-0.5 align-middle"
      onTouchStart={() => { isTouchRef.current = true; }}
      onMouseEnter={() => { if (!isTouchRef.current) setIsOpen(true); }}
      onMouseLeave={() => { if (!isTouchRef.current) setIsOpen(false); }}
      onClick={(e) => { e.stopPropagation(); if (isTouchRef.current) setIsOpen((v) => !v); }}
    >
      <HelpCircle className="w-3 h-3 text-gray-400 cursor-help" />
      {isOpen &&
        createPortal(
          <div
            ref={tooltipRef}
            className={cn(
              'fixed z-[9999] p-2 sm:p-2.5 bg-gray-900 text-white text-[10px] sm:text-xs',
              'rounded-lg shadow-2xl leading-relaxed whitespace-pre-line pointer-events-none',
              wide ? 'w-44 sm:w-72' : 'w-44 sm:w-56',
            )}
            style={{ visibility: 'hidden' }}
          >
            {text}
            <span data-arrow className="absolute w-2 h-2 bg-gray-900 rotate-45" />
          </div>,
          document.body,
        )}
    </span>
  );
};

function computeTotals(stock: StockItem): StockTotals {
  const wbTotal = (stock.warehouses || [])
    .filter((w) => w.marketplace === 'wb')
    .reduce((sum, w) => sum + w.quantity, 0);
  const ozonTotal = (stock.warehouses || [])
    .filter((w) => w.marketplace === 'ozon')
    .reduce((sum, w) => sum + w.quantity, 0);
  return { wbTotal, ozonTotal, total: wbTotal + ozonTotal };
}

function getPageNumbers(current: number, total: number): (number | 'dots')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | 'dots')[] = [1];
  if (current > 3) pages.push('dots');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i);
  }
  if (current < total - 2) pages.push('dots');
  if (total > 1) pages.push(total);
  return pages;
}

// ==================== PROPS ====================

interface StocksTableProps {
  stocks: StockItem[];
  isLoading?: boolean;
}

// ==================== COMPONENT ====================

export const StocksTable = ({ stocks, isLoading = false }: StocksTableProps) => {
  const isMobile = useIsMobile();

  // ─── State ───
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortField>('status');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const pageSize = isMobile ? PAGE_SIZE_MOBILE : PAGE_SIZE_DESKTOP;

  // Reset page on filter / search / sort / pageSize change
  useEffect(() => {
    setPage(1);
  }, [search, filter, sortBy, sortDir, pageSize]);

  // Clear expanded rows on page change
  useEffect(() => {
    setExpandedRows(new Set());
  }, [page]);

  // ─── Data Pipeline ───

  // 1. Compute totals per item
  const totalsMap = useMemo(() => {
    const m = new Map<string, StockTotals>();
    for (const s of stocks || []) {
      m.set(s.barcode, computeTotals(s));
    }
    return m;
  }, [stocks]);

  // 2. Search
  const searched = useMemo(() => {
    if (!search.trim()) return stocks || [];
    const q = search.toLowerCase().trim();
    return (stocks || []).filter(
      (s) => s.product_name.toLowerCase().includes(q) || s.barcode.includes(q),
    );
  }, [stocks, search]);

  // 3. Filter
  const filtered = useMemo(() => {
    return searched.filter((s) => {
      const t = totalsMap.get(s.barcode) ?? { wbTotal: 0, ozonTotal: 0, total: 0 };
      if (filter === 'oos_wb') return t.wbTotal <= 0;
      if (filter === 'oos_ozon') return t.ozonTotal <= 0;
      if (filter === 'low') return t.wbTotal < 20 || t.ozonTotal < 20;
      return true;
    });
  }, [searched, filter, totalsMap]);

  // 4. Sort
  const sorted = useMemo(() => {
    const mult = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const at = totalsMap.get(a.barcode) ?? { wbTotal: 0, ozonTotal: 0, total: 0 };
      const bt = totalsMap.get(b.barcode) ?? { wbTotal: 0, ozonTotal: 0, total: 0 };

      switch (sortBy) {
        case 'name':
          return mult * a.product_name.localeCompare(b.product_name, 'ru');
        case 'wb':
          return mult * (at.wbTotal - bt.wbTotal);
        case 'ozon':
          return mult * (at.ozonTotal - bt.ozonTotal);
        case 'total':
          return mult * (at.total - bt.total);
        case 'forecast':
          return mult * ((a.days_remaining ?? 9999) - (b.days_remaining ?? 9999));
        case 'status':
        default: {
          const aRank = Math.min(getStockStatus(at.wbTotal).rank, getStockStatus(at.ozonTotal).rank);
          const bRank = Math.min(getStockStatus(bt.wbTotal).rank, getStockStatus(bt.ozonTotal).rank);
          if (aRank !== bRank) return mult * (aRank - bRank);
          return mult * (at.total - bt.total);
        }
      }
    });
  }, [filtered, sortBy, sortDir, totalsMap]);

  // 5. Paginate
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = useMemo(
    () => sorted.slice((safePage - 1) * pageSize, safePage * pageSize),
    [sorted, safePage, pageSize],
  );

  // ─── Aggregates ───

  const maxWb = useMemo(
    () => Math.max(1, ...Array.from(totalsMap.values()).map((t) => t.wbTotal)),
    [totalsMap],
  );
  const maxOzon = useMemo(
    () => Math.max(1, ...Array.from(totalsMap.values()).map((t) => t.ozonTotal)),
    [totalsMap],
  );

  // Summary from filtered (not paged) — overall filtered totals
  const summary = useMemo(() => {
    let wb = 0;
    let ozon = 0;
    let daysSum = 0;
    let daysCount = 0;
    for (const s of filtered) {
      const t = totalsMap.get(s.barcode);
      if (t) {
        wb += t.wbTotal;
        ozon += t.ozonTotal;
      }
      if (s.days_remaining != null) {
        daysSum += s.days_remaining;
        daysCount++;
      }
    }
    return {
      wb,
      ozon,
      total: wb + ozon,
      avgDays: daysCount > 0 ? Math.round(daysSum / daysCount) : null,
    };
  }, [filtered, totalsMap]);

  // Latest updated_at
  const latestUpdatedAt = useMemo((): string | null => {
    let best: string | null = null;
    for (const s of stocks || []) {
      const candidates = [s.last_updated_at, ...(s.warehouses || []).map((w) => w.updated_at)];
      for (const c of candidates) {
        if (c && (!best || c > best)) best = c;
      }
    }
    return best;
  }, [stocks]);

  // ─── Handlers ───

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortBy === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortBy(field);
        setSortDir('asc');
      }
    },
    [sortBy],
  );

  const toggleRow = useCallback((barcode: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(barcode)) next.delete(barcode);
      else next.add(barcode);
      return next;
    });
  }, []);

  const resetFilters = useCallback(() => {
    setSearch('');
    setFilter('all');
  }, []);

  // ─── Loading State ───
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <LoadingSpinner text="Загрузка остатков..." />
      </div>
    );
  }

  // ─── Empty State ───
  if (!stocks?.length) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col items-center justify-center py-8 text-gray-400">
          <Package className="w-10 h-10 mb-3 opacity-50" />
          <p className="text-sm font-medium">Нет данных об остатках</p>
          <p className="text-xs mt-1">Синхронизируйте данные из маркетплейсов</p>
        </div>
      </div>
    );
  }

  const updatedLabel = formatUpdatedAt(latestUpdatedAt);
  const totalStocks = stocks.length;
  const filteredCount = filtered.length;

  // ─── Shared: stock bar renderer ───
  const renderBar = (quantity: number, max: number, compact?: boolean) => {
    const status = getStockStatus(quantity);
    const pct = max > 0 ? (quantity / max) * 100 : 0;
    return (
      <div className={cn('flex items-center gap-1.5', compact ? 'gap-1' : 'gap-1.5')}>
        <span
          className={cn(
            'font-semibold tabular-nums text-right flex-shrink-0',
            status.color,
            compact ? 'text-[11px] w-7' : 'text-sm w-8',
          )}
        >
          {quantity}
        </span>
        <div className={cn('flex-1 bg-gray-100 rounded-full overflow-hidden', compact ? 'h-1.5' : 'h-2')}>
          <div
            className={cn('h-full rounded-full transition-all duration-500', status.barColor)}
            style={{ width: `${quantity > 0 ? Math.max(4, pct) : 0}%` }}
          />
        </div>
        <span
          className={cn(
            'font-medium flex-shrink-0',
            status.color,
            compact ? 'text-[9px] w-9' : 'text-[10px] w-11',
          )}
          title={status.tooltip}
        >
          {status.label}
        </span>
      </div>
    );
  };

  // ─── Shared: warehouse details ───
  const renderWarehouseDetails = (stock: StockItem) => (
    <div className="space-y-2">
      <p className="text-[10px] text-gray-400">
        Штрихкод: <span className="font-mono text-gray-600">{stock.barcode}</span>
        {stock.avg_daily_sales ? ` · ~${stock.avg_daily_sales} шт/день` : ''}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {(['wb', 'ozon'] as const).map((mp) => {
          const rows = stock.warehouses
            .filter((w) => w.marketplace === mp)
            .slice()
            .sort((a, b) => b.quantity - a.quantity || a.warehouse.localeCompare(b.warehouse, 'ru'));

          return (
            <div key={mp}>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                {getMarketplaceName(mp)}
              </p>
              {rows.length > 0 ? (
                <div className="space-y-1">
                  {rows.map((w) => (
                    <div
                      key={`${w.marketplace}|${w.warehouse}`}
                      className="flex items-center justify-between bg-white rounded-md px-2.5 py-1.5 border border-gray-200"
                    >
                      <span className="text-xs text-gray-600 truncate mr-2">{w.warehouse}</span>
                      <span className="text-xs font-semibold text-gray-900 tabular-nums flex-shrink-0">
                        {w.quantity} шт
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-gray-400 italic px-2.5 py-1.5">нет на складах</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  // ─── No results after filtering ───
  const renderEmptyFiltered = () => (
    <div className="py-10 text-center">
      <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
      <p className="text-sm text-gray-400">{search ? 'Ничего не найдено' : 'Нет товаров по фильтру'}</p>
      <button
        type="button"
        onClick={resetFilters}
        className="text-xs text-indigo-500 hover:text-indigo-700 mt-2 transition-colors"
      >
        Сбросить фильтры
      </button>
    </div>
  );

  // ─── Pagination shared ───
  const renderPagination = (variant: 'mobile' | 'desktop') => {
    if (totalPages <= 1) return null;

    const startItem = (safePage - 1) * pageSize + 1;
    const endItem = Math.min(safePage * pageSize, sorted.length);

    if (variant === 'mobile') {
      return (
        <div className="px-3 py-2.5 border-t border-gray-100 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-30 active:bg-gray-50 transition-colors"
            aria-label="Предыдущая страница"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <span className="text-xs text-gray-500 tabular-nums">
            {startItem}–{endItem} из {sorted.length}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-30 active:bg-gray-50 transition-colors"
            aria-label="Следующая страница"
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      );
    }

    // Desktop pagination with page numbers
    return (
      <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-between">
        <span className="text-xs text-gray-500 tabular-nums">
          {startItem}–{endItem} из {sorted.length}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            className="p-1.5 rounded-md border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition-colors"
            aria-label="Предыдущая страница"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          {getPageNumbers(safePage, totalPages).map((num, i) =>
            num === 'dots' ? (
              <span key={`dots-${i}`} className="px-1.5 text-xs text-gray-400 select-none">
                ...
              </span>
            ) : (
              <button
                key={num}
                type="button"
                onClick={() => setPage(num)}
                className={cn(
                  'w-8 h-8 text-xs rounded-md transition-colors',
                  num === safePage
                    ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100',
                )}
              >
                {num}
              </button>
            ),
          )}
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            className="p-1.5 rounded-md border border-gray-200 disabled:opacity-30 hover:bg-gray-50 transition-colors"
            aria-label="Следующая страница"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  // ─── Sort icon for desktop headers ───
  const renderSortIcon = (field: SortField) => {
    if (sortBy !== field) {
      return <ArrowUpDown className="w-3 h-3 text-gray-300 group-hover:text-gray-400 transition-colors" />;
    }
    return sortDir === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-indigo-500" />
    ) : (
      <ArrowDown className="w-3 h-3 text-indigo-500" />
    );
  };

  // =============================================
  // MOBILE RENDER
  // =============================================
  if (isMobile) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        {/* ─── Header ─── */}
        <div className="px-3 pt-3 pb-2 space-y-2">
          {/* Title row */}
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
              <Package className="w-4 h-4 text-gray-400" />
              Остатки
              <Tip text={STATUS_LEGEND_TOOLTIP} />
            </h2>
            {updatedLabel && (
              <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                <Clock className="w-3 h-3" />
                {updatedLabel}
              </span>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск товара..."
              aria-label="Поиск по остаткам"
              className="w-full pl-8 pr-8 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400
                         placeholder:text-gray-400 transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5"
                aria-label="Очистить поиск"
              >
                <X className="w-3.5 h-3.5 text-gray-400" />
              </button>
            )}
          </div>

          {/* Filters row + sort + count */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 flex-shrink min-w-0">
              {FILTERS.map((f) => (
                <span key={f.key} className="inline-flex items-center gap-0.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setFilter(f.key)}
                    className={cn(
                      'px-2 py-1 text-[11px] rounded-full border whitespace-nowrap transition-all active:scale-95',
                      filter === f.key ? f.activeClass : 'bg-white text-gray-600 border-gray-200',
                    )}
                  >
                    {f.mobileLabel}
                  </button>
                  {f.tooltip && <Tip text={f.tooltip} align={f.key === 'oos_wb' ? 'left' : 'right'} />}
                </span>
              ))}
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* Sort dropdown */}
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as SortField);
                  setSortDir('asc');
                }}
                className="text-[10px] bg-gray-50 border border-gray-200 rounded-md px-1.5 py-1
                           focus:outline-none focus:ring-1 focus:ring-indigo-500 text-gray-600"
                aria-label="Сортировка"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                className="p-1 rounded border border-gray-200 active:bg-gray-50"
                aria-label={sortDir === 'asc' ? 'По возрастанию' : 'По убыванию'}
              >
                {sortDir === 'asc' ? (
                  <ArrowUp className="w-3 h-3 text-gray-500" />
                ) : (
                  <ArrowDown className="w-3 h-3 text-gray-500" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ─── Summary bar ─── */}
        <div className="px-3 py-1.5 bg-gray-50/80 border-y border-gray-100 flex items-center gap-3 text-[10px] text-gray-500">
          <span>
            Σ <b className="text-gray-700 tabular-nums">{summary.total}</b>
          </span>
          <span>
            WB <b className="text-gray-700 tabular-nums">{summary.wb}</b>
          </span>
          <span>
            Oz <b className="text-gray-700 tabular-nums">{summary.ozon}</b>
          </span>
          {summary.avgDays !== null && (
            <span className="inline-flex items-center gap-0.5">
              Ср. ≈<b className="text-gray-700 tabular-nums">{summary.avgDays}д</b>
              <Tip text={AVG_DAYS_TOOLTIP} align="right" />
            </span>
          )}
          <span className="ml-auto text-gray-400 tabular-nums">
            {filteredCount}/{totalStocks}
          </span>
        </div>

        {/* ─── Cards ─── */}
        {paged.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {paged.map((stock) => {
              const isExpanded = expandedRows.has(stock.barcode);
              const t = totalsMap.get(stock.barcode) ?? { wbTotal: 0, ozonTotal: 0, total: 0 };
              const forecast = getDaysLabel(stock.days_remaining);

              return (
                <div key={stock.barcode}>
                  <button
                    type="button"
                    onClick={() => toggleRow(stock.barcode)}
                    className="w-full px-3 py-2.5 text-left active:bg-gray-50/50 transition-colors"
                    aria-expanded={isExpanded}
                  >
                    {/* Row 1: Name + Total */}
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-[13px] font-medium text-gray-900 truncate pr-3 flex-1 leading-tight">
                        {stock.product_name}
                      </p>
                      <div className="flex-shrink-0 text-right">
                        <span className="text-lg font-bold text-gray-900 tabular-nums leading-none">{t.total}</span>
                      </div>
                    </div>

                    {/* Row 2: WB bar */}
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-[10px] font-medium text-gray-400 w-5 flex-shrink-0">WB</span>
                      {renderBar(t.wbTotal, maxWb, true)}
                    </div>

                    {/* Row 3: OZON bar */}
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-[10px] font-medium text-gray-400 w-5 flex-shrink-0">Oz</span>
                      {renderBar(t.ozonTotal, maxOzon, true)}
                    </div>

                    {/* Row 4: Forecast + Chevron */}
                    <div className="flex items-center justify-end gap-2 mt-0.5">
                      {stock.days_remaining != null && (
                        <span
                          className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded', forecast.color, forecast.bgColor)}
                          title={stock.avg_daily_sales ? `~${stock.avg_daily_sales} шт/день` : ''}
                        >
                          ≈{forecast.text}
                        </span>
                      )}
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {/* Expanded warehouse details */}
                  {isExpanded && (
                    <div className="px-3 pb-3">
                      <div className="bg-gray-50 rounded-lg p-2.5">{renderWarehouseDetails(stock)}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          renderEmptyFiltered()
        )}

        {/* ─── Pagination ─── */}
        {renderPagination('mobile')}
      </div>
    );
  }

  // =============================================
  // DESKTOP RENDER
  // =============================================
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      {/* ─── Header ─── */}
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-1">
            Остатки на складах
            <Tip text={STATUS_LEGEND_TOOLTIP} />
          </h2>
          {updatedLabel && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Обновлено {updatedLabel}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-4">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по названию или штрихкоду..."
              aria-label="Поиск по остаткам"
              className="w-full pl-9 pr-9 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400
                         placeholder:text-gray-400 transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-200 transition-colors"
                aria-label="Очистить поиск"
              >
                <X className="w-3.5 h-3.5 text-gray-400" />
              </button>
            )}
          </div>

          {/* Filters + Count */}
          <div className="flex items-center gap-2">
            {FILTERS.map((f) => (
              <span key={f.key} className="inline-flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    'px-3 py-1.5 text-xs rounded-full border transition-all hover:shadow-sm',
                    filter === f.key ? f.activeClass : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300',
                  )}
                >
                  {f.label}
                </button>
                {f.tooltip && <Tip text={f.tooltip} align={f.key === 'oos_wb' ? 'left' : 'right'} />}
              </span>
            ))}
            <span className="text-xs text-gray-400 ml-1 tabular-nums">
              {filteredCount} из {totalStocks}
            </span>
          </div>
        </div>
      </div>

      {/* ─── Table ─── */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-50/95 backdrop-blur-sm border-y border-gray-200">
              <th
                scope="col"
                className="group px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700 transition-colors"
                onClick={() => handleSort('name')}
              >
                <span className="inline-flex items-center gap-1">
                  Товар
                  {renderSortIcon('name')}
                </span>
              </th>
              <th
                scope="col"
                className="group px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700 transition-colors w-[180px]"
                onClick={() => handleSort('wb')}
              >
                <span className="inline-flex items-center gap-1">
                  WB
                  {renderSortIcon('wb')}
                </span>
              </th>
              <th
                scope="col"
                className="group px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700 transition-colors w-[180px]"
                onClick={() => handleSort('ozon')}
              >
                <span className="inline-flex items-center gap-1">
                  OZON
                  {renderSortIcon('ozon')}
                </span>
              </th>
              <th
                scope="col"
                className="group px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700 transition-colors w-[70px]"
                onClick={() => handleSort('total')}
              >
                <span className="inline-flex items-center gap-1 justify-center">
                  Σ
                  {renderSortIcon('total')}
                </span>
              </th>
              <th
                scope="col"
                className="group px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700 transition-colors w-[120px]"
                onClick={() => handleSort('forecast')}
              >
                <span className="inline-flex items-center gap-1 justify-center">
                  <Clock className="w-3 h-3" />
                  Прогноз
                  <Tip text={FORECAST_TOOLTIP} align="right" wide />
                  {renderSortIcon('forecast')}
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paged.length > 0 ? (
              <>
                {paged.map((stock) => {
                  const isExpanded = expandedRows.has(stock.barcode);
                  const t = totalsMap.get(stock.barcode) ?? { wbTotal: 0, ozonTotal: 0, total: 0 };
                  const forecast = getDaysLabel(stock.days_remaining);

                  return (
                    <Fragment key={stock.barcode}>
                      <tr
                        className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                        onClick={() => toggleRow(stock.barcode)}
                        aria-expanded={isExpanded}
                      >
                        {/* Товар */}
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900 truncate">
                              {stock.product_name}
                            </span>
                            <span className="flex-shrink-0 text-gray-300 transition-transform duration-200">
                              {isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5" />
                              )}
                            </span>
                          </div>
                        </td>

                        {/* WB */}
                        <td className="px-4 py-3">{renderBar(t.wbTotal, maxWb)}</td>

                        {/* OZON */}
                        <td className="px-4 py-3">{renderBar(t.ozonTotal, maxOzon)}</td>

                        {/* Σ */}
                        <td className="px-4 py-3 text-center">
                          <span className="text-sm font-bold text-gray-900 tabular-nums">{t.total}</span>
                        </td>

                        {/* Прогноз */}
                        <td className="px-4 py-3 text-center">
                          <span
                            className={cn(
                              'text-xs font-semibold px-2 py-1 rounded-full inline-block',
                              forecast.color,
                              forecast.bgColor,
                            )}
                            title={stock.avg_daily_sales ? `~${stock.avg_daily_sales} шт/день` : ''}
                          >
                            {forecast.text}
                          </span>
                        </td>
                      </tr>

                      {/* Expanded row */}
                      {isExpanded && (
                        <tr className="bg-gray-50/50">
                          <td colSpan={5} className="px-5 py-4">
                            <div className="ml-4">{renderWarehouseDetails(stock)}</div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}

                {/* ─── Summary row ─── */}
                <tr className="bg-gray-50/70 border-t-2 border-gray-200">
                  <td className="px-5 py-3 text-xs font-semibold text-gray-500">
                    Итого: {filteredCount} {filteredCount === 1 ? 'товар' : filteredCount < 5 ? 'товара' : 'товаров'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-bold text-gray-700 tabular-nums">{summary.wb}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-bold text-gray-700 tabular-nums">{summary.ozon}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-xs font-bold text-gray-900 tabular-nums">{summary.total}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-xs text-gray-500 inline-flex items-center gap-0.5 justify-center">
                      {summary.avgDays !== null ? (
                        <>Ср. {summary.avgDays}д <Tip text={AVG_DAYS_TOOLTIP} align="right" /></>
                      ) : '—'}
                    </span>
                  </td>
                </tr>
              </>
            ) : (
              <tr>
                <td colSpan={5}>{renderEmptyFiltered()}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ─── Pagination ─── */}
      {renderPagination('desktop')}
    </div>
  );
};
