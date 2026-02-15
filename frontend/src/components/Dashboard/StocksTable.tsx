/**
 * Таблица остатков на складах
 * Mobile: карточный вид с аккордеоном
 * Desktop: классическая таблица
 */
import { ChevronDown, ChevronRight, Package, Clock } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import { LoadingSpinner } from '../Shared/LoadingSpinner';
import { getMarketplaceName, cn } from '../../lib/utils';
import { useIsMobile } from '../../hooks/useMediaQuery';
import type { StockItem } from '../../types';

interface StocksTableProps {
  stocks: StockItem[];
  isLoading?: boolean;
}

export const StocksTable = ({ stocks, isLoading = false }: StocksTableProps) => {
  const isMobile = useIsMobile();
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'oos_wb' | 'oos_ozon' | 'low'>('all');

  const formatUpdatedAt = (iso?: string | null): string | null => {
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
  };

  const getDaysLabel = (days: number | null | undefined): { text: string; color: string; bgColor: string } => {
    if (days === null || days === undefined) return { text: '—', color: 'text-gray-400', bgColor: '' };
    if (days <= 7) return { text: `${days} д`, color: 'text-red-700', bgColor: 'bg-red-50' };
    if (days <= 14) return { text: `${days} д`, color: 'text-yellow-700', bgColor: 'bg-yellow-50' };
    if (days <= 30) return { text: `${days} д`, color: 'text-blue-700', bgColor: 'bg-blue-50' };
    return { text: `${days} д`, color: 'text-green-700', bgColor: 'bg-green-50' };
  };

  const getMpStockStatus = (quantity: number): { label: string; color: string; bgColor: string; rank: number } => {
    if (quantity <= 0) {
      return { label: 'OOS', color: 'text-red-700', bgColor: 'bg-red-50', rank: 0 };
    }
    if (quantity < 20) {
      return { label: 'Крит.', color: 'text-red-700', bgColor: 'bg-red-50', rank: 1 };
    }
    if (quantity < 100) {
      return { label: 'Низкий', color: 'text-yellow-700', bgColor: 'bg-yellow-50', rank: 2 };
    }
    return { label: 'OK', color: 'text-green-700', bgColor: 'bg-green-50', rank: 3 };
  };

  const latestUpdatedAt = useMemo((): string | null => {
    let best: string | null = null;
    for (const s of stocks || []) {
      const candidates: (string | null | undefined)[] = [
        (s as any).last_updated_at,
        ...((s.warehouses || []).map((w) => (w as any).updated_at) as (string | undefined)[]),
      ];
      for (const c of candidates) {
        if (!c) continue;
        if (!best || c > best) best = c;
      }
    }
    return best;
  }, [stocks]);

  const totalsByBarcode = useMemo(() => {
    const m = new Map<string, { wbTotal: number; ozonTotal: number; total: number }>();
    for (const stock of stocks || []) {
      const wbTotal = (stock.warehouses || [])
        .filter((w) => w.marketplace === 'wb')
        .reduce((sum, w) => sum + w.quantity, 0);
      const ozonTotal = (stock.warehouses || [])
        .filter((w) => w.marketplace === 'ozon')
        .reduce((sum, w) => sum + w.quantity, 0);
      m.set(stock.barcode, { wbTotal, ozonTotal, total: wbTotal + ozonTotal });
    }
    return m;
  }, [stocks]);

  const filteredStocks = useMemo(() => {
    return (stocks || []).filter((s) => {
      const t = totalsByBarcode.get(s.barcode) ?? { wbTotal: 0, ozonTotal: 0, total: 0 };
      if (filter === 'oos_wb') return t.wbTotal <= 0;
      if (filter === 'oos_ozon') return t.ozonTotal <= 0;
      if (filter === 'low') return t.wbTotal < 20 || t.ozonTotal < 20;
      return true;
    });
  }, [stocks, filter, totalsByBarcode]);

  const sortedStocks = useMemo(() => {
    return [...filteredStocks].sort((a, b) => {
      const at = totalsByBarcode.get(a.barcode) ?? { wbTotal: 0, ozonTotal: 0, total: 0 };
      const bt = totalsByBarcode.get(b.barcode) ?? { wbTotal: 0, ozonTotal: 0, total: 0 };
      const aRank = Math.min(getMpStockStatus(at.wbTotal).rank, getMpStockStatus(at.ozonTotal).rank);
      const bRank = Math.min(getMpStockStatus(bt.wbTotal).rank, getMpStockStatus(bt.ozonTotal).rank);
      if (aRank !== bRank) return aRank - bRank;
      if (at.total !== bt.total) return at.total - bt.total;
      return a.product_name.localeCompare(b.product_name, 'ru');
    });
  }, [filteredStocks, totalsByBarcode]);

  const toggleRow = (barcode: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(barcode)) {
      newExpanded.delete(barcode);
    } else {
      newExpanded.add(barcode);
    }
    setExpandedRows(newExpanded);
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <LoadingSpinner text="Загрузка остатков..." />
      </div>
    );
  }

  if (!stocks || stocks.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Остатки на складах</h2>
        <div className="flex items-center justify-center h-24 text-gray-500">
          <p className="text-sm">Нет данных об остатках</p>
        </div>
      </div>
    );
  }

  // Фильтры (общие для mobile и desktop)
  const FilterButtons = () => (
    <div className="flex items-center gap-1.5 flex-wrap">
      {[
        { key: 'all', label: 'Все', activeClass: 'bg-gray-900 text-white border-gray-900' },
        { key: 'oos_wb', label: 'OOS WB', activeClass: 'bg-red-600 text-white border-red-600' },
        { key: 'oos_ozon', label: 'OOS Ozon', activeClass: 'bg-red-600 text-white border-red-600' },
        { key: 'low', label: 'Low', activeClass: 'bg-yellow-500 text-white border-yellow-500' },
      ].map((f) => (
        <button
          key={f.key}
          type="button"
          onClick={() => setFilter(f.key as typeof filter)}
          className={cn(
            'px-2.5 py-1 text-xs rounded-full border transition-all active:scale-95',
            filter === f.key ? f.activeClass : 'bg-white text-gray-600 border-gray-200'
          )}
        >
          {f.label}
        </button>
      ))}
    </div>
  );

  // Mobile: карточный вид
  if (isMobile) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="p-3 border-b border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Package className="w-4 h-4 text-gray-400" />
              Остатки
            </h2>
            {(() => {
              const rel = formatUpdatedAt(latestUpdatedAt);
              return rel ? <span className="text-[10px] text-gray-400">{rel}</span> : null;
            })()}
          </div>
          <FilterButtons />
        </div>

        {/* Cards */}
        <div className="divide-y divide-gray-100 max-h-[60vh] overflow-y-auto">
          {sortedStocks.map((stock) => {
            const isExpanded = expandedRows.has(stock.barcode);
            const { wbTotal, ozonTotal, total } = totalsByBarcode.get(stock.barcode) ?? { wbTotal: 0, ozonTotal: 0, total: 0 };
            const wbStatus = getMpStockStatus(wbTotal);
            const ozonStatus = getMpStockStatus(ozonTotal);

            return (
              <div key={stock.barcode} className="bg-white">
                {/* Card Header */}
                <button
                  type="button"
                  onClick={() => toggleRow(stock.barcode)}
                  className="w-full p-3 flex items-center gap-3 active:bg-gray-50 transition-colors"
                >
                  {/* Expand icon */}
                  <div className="flex-shrink-0">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                  </div>

                  {/* Product info */}
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {stock.product_name}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      {/* WB */}
                      <div className="flex items-center gap-1">
                        <span className={cn('text-xs font-semibold', wbStatus.color)}>
                          WB: {wbTotal}
                        </span>
                        <span className={cn('text-[9px] px-1 py-0.5 rounded', wbStatus.bgColor, wbStatus.color)}>
                          {wbStatus.label}
                        </span>
                      </div>
                      {/* Ozon */}
                      <div className="flex items-center gap-1">
                        <span className={cn('text-xs font-semibold', ozonStatus.color)}>
                          Oz: {ozonTotal}
                        </span>
                        <span className={cn('text-[9px] px-1 py-0.5 rounded', ozonStatus.bgColor, ozonStatus.color)}>
                          {ozonStatus.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Forecast + Total */}
                  <div className="flex-shrink-0 text-right">
                    <p className="text-lg font-bold text-gray-900">{total}</p>
                    {(() => {
                      const d = getDaysLabel(stock.days_remaining);
                      if (!stock.days_remaining && stock.days_remaining !== 0) return <p className="text-[10px] text-gray-400">всего</p>;
                      return (
                        <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded', d.color, d.bgColor)} title={stock.avg_daily_sales ? `~${stock.avg_daily_sales} шт/день` : ''}>
                          ≈{d.text}
                        </span>
                      );
                    })()}
                  </div>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-3 pb-3 pt-0">
                    <div className="bg-gray-50 rounded-lg p-2.5 space-y-2">
                      {(['wb', 'ozon'] as const).map((mp) => {
                        const rows = stock.warehouses
                          .filter((w) => w.marketplace === mp)
                          .slice()
                          .sort((a, b) => b.quantity - a.quantity || a.warehouse.localeCompare(b.warehouse, 'ru'));
                        if (rows.length === 0) return null;
                        return (
                          <div key={mp}>
                            <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1">
                              {getMarketplaceName(mp)}
                            </p>
                            <div className="space-y-1">
                              {rows.map((warehouse) => (
                                <div
                                  key={`${warehouse.marketplace}|${warehouse.warehouse}`}
                                  className="flex items-center justify-between bg-white rounded-lg px-2.5 py-1.5 border border-gray-200"
                                >
                                  <span className="text-xs text-gray-700 truncate flex-1 mr-2">
                                    {warehouse.warehouse}
                                  </span>
                                  <span className="text-xs font-semibold text-gray-900 flex-shrink-0">
                                    {warehouse.quantity}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Desktop: классическая таблица
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-5 pb-4">
        <div className="flex items-baseline justify-between gap-4">
          <div className="flex items-baseline gap-4">
            <h2 className="text-base font-semibold text-gray-900">Остатки на складах</h2>
            <FilterButtons />
          </div>
          {(() => {
            const rel = formatUpdatedAt(latestUpdatedAt);
            return rel ? <span className="text-xs text-gray-500">Обновлено {rel}</span> : null;
          })()}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-y border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Товар
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Штрихкод
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                WB
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ozon
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Σ
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Статус
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" title="На сколько дней хватит запаса (avg продажи за 30д)">
                <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />Прогноз</span>
              </th>
              <th className="px-6 py-3 w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sortedStocks.map((stock) => {
              const isExpanded = expandedRows.has(stock.barcode);
              const { wbTotal, ozonTotal, total } = totalsByBarcode.get(stock.barcode) ?? { wbTotal: 0, ozonTotal: 0, total: 0 };
              const wbStatus = getMpStockStatus(wbTotal);
              const ozonStatus = getMpStockStatus(ozonTotal);

              return (
                <Fragment key={stock.barcode}>
                  <tr
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => toggleRow(stock.barcode)}
                  >
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {stock.product_name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 font-mono">
                      {stock.barcode}
                    </td>
                    <td className="px-6 py-4 text-sm text-center font-semibold">
                      <span className={wbTotal <= 0 ? 'text-red-600' : wbTotal < 20 ? 'text-yellow-600' : 'text-gray-900'}>
                        {wbTotal}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-center font-semibold">
                      <span className={ozonTotal <= 0 ? 'text-red-600' : ozonTotal < 20 ? 'text-yellow-600' : 'text-gray-900'}>
                        {ozonTotal}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-center text-gray-900 font-bold">
                      {total}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="inline-flex items-center gap-2">
                        <span
                          className={cn('inline-flex px-2 py-1 text-[11px] font-semibold rounded-full', wbStatus.bgColor, wbStatus.color)}
                        >
                          WB: {wbStatus.label}
                        </span>
                        <span
                          className={cn('inline-flex px-2 py-1 text-[11px] font-semibold rounded-full', ozonStatus.bgColor, ozonStatus.color)}
                        >
                          Oz: {ozonStatus.label}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {(() => {
                        const d = getDaysLabel(stock.days_remaining);
                        return (
                          <span className={cn('text-xs font-semibold px-2 py-1 rounded-full', d.color, d.bgColor)} title={stock.avg_daily_sales ? `~${stock.avg_daily_sales} шт/день` : ''}>
                            {d.text}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      )}
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr className="bg-gray-50">
                      <td colSpan={8} className="px-6 py-4">
                        <div className="ml-8 space-y-3">
                          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                            Детализация по складам:
                          </p>
                          {(['wb', 'ozon'] as const).map((mp) => {
                            const rows = stock.warehouses
                              .filter((w) => w.marketplace === mp)
                              .slice()
                              .sort((a, b) => b.quantity - a.quantity || a.warehouse.localeCompare(b.warehouse, 'ru'));
                            if (rows.length === 0) return null;
                            return (
                              <div key={mp} className="space-y-2">
                                <p className="text-xs font-semibold text-gray-600">
                                  {getMarketplaceName(mp)}
                                </p>
                                {rows.map((warehouse) => (
                                  <div
                                    key={`${warehouse.marketplace}|${warehouse.warehouse}`}
                                    className="flex items-center justify-between bg-white rounded px-4 py-2 border border-gray-200"
                                  >
                                    <span className="text-sm text-gray-700">{warehouse.warehouse}</span>
                                    <span className="text-sm font-semibold text-gray-900">
                                      {warehouse.quantity} шт
                                    </span>
                                  </div>
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
