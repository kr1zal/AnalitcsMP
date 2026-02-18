/**
 * AdsCampaignTable — Enterprise таблица рекламных кампаний
 * Search, sort, pagination, color-coded DRR, progress bars
 */
import { useMemo, useState, useCallback } from 'react';
import { Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatCurrency, formatNumber, formatPercent, cn } from '../../lib/utils';
import type { AdCampaignItem } from '../../types';

interface AdsCampaignTableProps {
  campaigns: AdCampaignItem[];
  isLoading: boolean;
}

type SortField = 'cost' | 'impressions' | 'clicks' | 'ctr' | 'orders' | 'drr' | 'cpc';
type SortDir = 'asc' | 'desc';
type MpFilter = 'all' | 'wb' | 'ozon' | 'high-drr';

const ITEMS_PER_PAGE = 10;

const MP_FILTERS: { value: MpFilter; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'wb', label: 'WB' },
  { value: 'ozon', label: 'Ozon' },
  { value: 'high-drr', label: 'ДРР > 20%' },
];

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'cost', label: 'Расход' },
  { value: 'impressions', label: 'Показы' },
  { value: 'clicks', label: 'Клики' },
  { value: 'ctr', label: 'CTR' },
  { value: 'orders', label: 'Заказы' },
  { value: 'drr', label: 'ДРР' },
  { value: 'cpc', label: 'CPC' },
];

const getDrrColor = (drr: number): string => {
  if (drr > 20) return 'text-red-600';
  if (drr > 10) return 'text-amber-600';
  return 'text-emerald-600';
};

const getMpBadge = (mp: string) => {
  if (mp === 'wb') return <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-violet-100 text-violet-700">WB</span>;
  return <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-blue-100 text-blue-700">Ozon</span>;
};

export const AdsCampaignTable = ({ campaigns, isLoading }: AdsCampaignTableProps) => {
  const [search, setSearch] = useState('');
  const [mpFilter, setMpFilter] = useState<MpFilter>('all');
  const [sortField, setSortField] = useState<SortField>('cost');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(0);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
    setPage(0);
  }, [sortField]);

  // Filter + sort
  const { filtered, totalCost, totalImpressions, totalClicks, totalOrders } = useMemo(() => {
    let items = [...campaigns];

    // Search
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter(
        (c) =>
          c.campaign_name.toLowerCase().includes(q) ||
          c.campaign_id.toLowerCase().includes(q) ||
          (c.product_name && c.product_name.toLowerCase().includes(q))
      );
    }

    // MP filter
    if (mpFilter === 'wb') items = items.filter((c) => c.marketplace === 'wb');
    else if (mpFilter === 'ozon') items = items.filter((c) => c.marketplace === 'ozon');
    else if (mpFilter === 'high-drr') items = items.filter((c) => c.drr > 20);

    // Totals before sort
    const totalCost = items.reduce((s, c) => s + c.cost, 0);
    const totalImpressions = items.reduce((s, c) => s + c.impressions, 0);
    const totalClicks = items.reduce((s, c) => s + c.clicks, 0);
    const totalOrders = items.reduce((s, c) => s + c.orders, 0);

    // Sort
    items.sort((a, b) => {
      const av = a[sortField] ?? 0;
      const bv = b[sortField] ?? 0;
      return sortDir === 'desc' ? (bv as number) - (av as number) : (av as number) - (bv as number);
    });

    return { filtered: items, totalCost, totalImpressions, totalClicks, totalOrders };
  }, [campaigns, search, mpFilter, sortField, sortDir]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paged = filtered.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);
  const maxCost = filtered.length > 0 ? Math.max(...filtered.map((c) => c.cost)) : 1;

  // Sort header helper
  const SortHeader = ({ field, label, align = 'right' }: { field: SortField; label: string; align?: 'left' | 'right' }) => (
    <th
      className={cn(
        'px-3 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none',
        align === 'right' ? 'text-right' : 'text-left'
      )}
      onClick={() => handleSort(field)}
    >
      <span className="inline-flex items-center gap-0.5">
        {label}
        {sortField === field && (
          sortDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />
        )}
      </span>
    </th>
  );

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="animate-pulse">
          <div className="h-5 bg-gray-200 rounded w-48 mb-4" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 bg-gray-100 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-3 sm:p-4 border-b border-gray-100">
          <h3 className="text-sm sm:text-base font-semibold text-gray-900">Кампании</h3>
        </div>
        <div className="p-8 text-center">
          <p className="text-gray-400 text-sm">Нет активных рекламных кампаний за период</p>
          <p className="text-gray-300 text-xs mt-1">Данные появятся после синхронизации</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header + controls */}
      <div className="p-3 sm:p-4 border-b border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <h3 className="text-sm sm:text-base font-semibold text-gray-900 flex-shrink-0">
            Кампании
            <span className="text-xs font-normal text-gray-400 ml-1.5">{filtered.length}</span>
          </h3>

          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Поиск кампании..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 outline-none"
            />
          </div>

          {/* MP filter pills */}
          <div className="flex gap-1.5 flex-wrap">
            {MP_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => { setMpFilter(f.value); setPage(0); }}
                className={cn(
                  'px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium transition-colors',
                  mpFilter === f.value
                    ? f.value === 'high-drr' ? 'bg-red-600 text-white' : 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Mobile sort dropdown */}
          <select
            value={sortField}
            onChange={(e) => { setSortField(e.target.value as SortField); setPage(0); }}
            className="sm:hidden text-xs border border-gray-200 rounded-lg px-2 py-1.5"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table (desktop) */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Кампания</th>
              <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-14">МП</th>
              <SortHeader field="cost" label="Расход" />
              <SortHeader field="impressions" label="Показы" />
              <SortHeader field="clicks" label="Клики" />
              <SortHeader field="ctr" label="CTR" />
              <SortHeader field="orders" label="Заказы" />
              <SortHeader field="drr" label="ДРР" />
              <SortHeader field="cpc" label="CPC" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paged.map((c) => {
              const costPct = maxCost > 0 ? (c.cost / maxCost) * 100 : 0;
              return (
                <tr key={`${c.campaign_id}-${c.marketplace}`} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2.5">
                    <div className="text-sm text-gray-900 font-medium truncate max-w-[200px]" title={c.campaign_name}>
                      {c.campaign_name || `#${c.campaign_id.slice(0, 8)}`}
                    </div>
                    {c.product_name && (
                      <div className="text-[10px] text-gray-400 truncate max-w-[200px]">{c.product_name}</div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center">{getMpBadge(c.marketplace)}</td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="text-sm font-medium text-gray-900 tabular-nums">{formatCurrency(c.cost)}</div>
                    <div className="mt-0.5 h-1 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full bg-red-400" style={{ width: `${Math.max(2, costPct)}%` }} />
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right text-sm text-gray-700 tabular-nums">{formatNumber(c.impressions)}</td>
                  <td className="px-3 py-2.5 text-right text-sm text-gray-700 tabular-nums">{formatNumber(c.clicks)}</td>
                  <td className="px-3 py-2.5 text-right text-sm text-gray-700 tabular-nums">{formatPercent(c.ctr)}</td>
                  <td className="px-3 py-2.5 text-right text-sm text-gray-700 tabular-nums">{formatNumber(c.orders)}</td>
                  <td className="px-3 py-2.5 text-right">
                    <span className={cn('text-sm font-medium tabular-nums', getDrrColor(c.drr))}>
                      {formatPercent(c.drr)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-sm text-gray-700 tabular-nums">{formatCurrency(c.cpc)}</td>
                </tr>
              );
            })}
          </tbody>

          {/* Summary row */}
          <tfoot className="bg-gray-50">
            <tr className="font-semibold text-sm">
              <td className="px-3 py-2.5 text-gray-900">ИТОГО</td>
              <td className="px-3 py-2.5" />
              <td className="px-3 py-2.5 text-right text-gray-900 tabular-nums">{formatCurrency(totalCost)}</td>
              <td className="px-3 py-2.5 text-right text-gray-900 tabular-nums">{formatNumber(totalImpressions)}</td>
              <td className="px-3 py-2.5 text-right text-gray-900 tabular-nums">{formatNumber(totalClicks)}</td>
              <td className="px-3 py-2.5 text-right text-gray-700 tabular-nums">
                {formatPercent(totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0)}
              </td>
              <td className="px-3 py-2.5 text-right text-gray-900 tabular-nums">{formatNumber(totalOrders)}</td>
              <td className="px-3 py-2.5 text-right">
                <span className={getDrrColor(totalCost > 0 ? (totalCost / (totalCost / ((campaigns[0]?.drr || 1) / 100))) * 100 : 0)}>
                  —
                </span>
              </td>
              <td className="px-3 py-2.5 text-right text-gray-700 tabular-nums">
                {formatCurrency(totalClicks > 0 ? totalCost / totalClicks : 0)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Cards (mobile) */}
      <div className="sm:hidden divide-y divide-gray-100">
        {paged.map((c) => (
          <div key={`${c.campaign_id}-${c.marketplace}-m`} className="p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-gray-900 truncate flex-1 mr-2">
                {c.campaign_name || `#${c.campaign_id.slice(0, 8)}`}
              </span>
              {getMpBadge(c.marketplace)}
            </div>
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <div>
                <span className="text-gray-400">Расход</span>
                <div className="font-semibold text-red-600 tabular-nums">{formatCurrency(c.cost)}</div>
              </div>
              <div>
                <span className="text-gray-400">ДРР</span>
                <div className={cn('font-semibold tabular-nums', getDrrColor(c.drr))}>{formatPercent(c.drr)}</div>
              </div>
              <div>
                <span className="text-gray-400">Заказы</span>
                <div className="font-semibold text-gray-900 tabular-nums">{formatNumber(c.orders)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-2.5 border-t border-gray-100 bg-gray-50">
          <span className="text-xs text-gray-500">
            {page * ITEMS_PER_PAGE + 1}–{Math.min((page + 1) * ITEMS_PER_PAGE, filtered.length)} из {filtered.length}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1 rounded hover:bg-gray-200 disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-1 rounded hover:bg-gray-200 disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
