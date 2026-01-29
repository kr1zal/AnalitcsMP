/**
 * Таблица остатков на складах
 */
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import { LoadingSpinner } from '../Shared/LoadingSpinner';
import { getMarketplaceName, cn } from '../../lib/utils';
import type { StockItem } from '../../types';

interface StocksTableProps {
  stocks: StockItem[];
  isLoading?: boolean;
}

export const StocksTable = ({ stocks, isLoading = false }: StocksTableProps) => {
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

  const getMpStockStatus = (quantity: number): { label: string; color: string; rank: number } => {
    // rank: меньше = хуже (для сортировки)
    if (quantity <= 0) {
      return { label: 'OOS', color: 'text-red-700 bg-red-50', rank: 0 };
    }
    if (quantity < 20) {
      return { label: 'Критичный', color: 'text-red-700 bg-red-50', rank: 1 };
    }
    if (quantity < 100) {
      return { label: 'Низкий', color: 'text-yellow-700 bg-yellow-50', rank: 2 };
    }
    return { label: 'Достаточно', color: 'text-green-700 bg-green-50', rank: 3 };
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

  // IMPORTANT: hooks must run before any early returns.
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
      // secondary: меньше total выше (операционно важнее)
      if (at.total !== bt.total) return at.total - bt.total;
      return a.product_name.localeCompare(b.product_name, 'ru');
    });
  }, [filteredStocks, totalsByBarcode]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
        <LoadingSpinner text="Загрузка остатков..." />
      </div>
    );
  }

  if (!stocks || stocks.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-3">Остатки на складах</h2>
        <div className="flex items-center justify-center h-32 text-gray-500">
          <p>Нет данных об остатках</p>
        </div>
      </div>
    );
  }

  const toggleRow = (barcode: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(barcode)) {
      newExpanded.delete(barcode);
    } else {
      newExpanded.add(barcode);
    }
    setExpandedRows(newExpanded);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-5 pb-4">
        <div className="flex items-baseline justify-between gap-4">
          <div className="flex items-baseline gap-4">
            <h2 className="text-base font-semibold text-gray-900">Остатки на складах</h2>
            <div className="hidden sm:flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={cn(
                  'px-2 py-1 text-xs rounded-full border',
                  filter === 'all'
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-700 border-gray-200'
                )}
              >
                Все
              </button>
              <button
                type="button"
                onClick={() => setFilter('oos_wb')}
                className={cn(
                  'px-2 py-1 text-xs rounded-full border',
                  filter === 'oos_wb'
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-white text-gray-700 border-gray-200'
                )}
              >
                OOS WB
              </button>
              <button
                type="button"
                onClick={() => setFilter('oos_ozon')}
                className={cn(
                  'px-2 py-1 text-xs rounded-full border',
                  filter === 'oos_ozon'
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-white text-gray-700 border-gray-200'
                )}
              >
                OOS Ozon
              </button>
              <button
                type="button"
                onClick={() => setFilter('low')}
                className={cn(
                  'px-2 py-1 text-xs rounded-full border',
                  filter === 'low'
                    ? 'bg-yellow-500 text-white border-yellow-500'
                    : 'bg-white text-gray-700 border-gray-200'
                )}
              >
                Low
              </button>
            </div>
          </div>
          {(() => {
            const rel = formatUpdatedAt(latestUpdatedAt);
            return rel ? (
              <span className="text-xs text-gray-500">Обновлено {rel}</span>
            ) : null;
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
                Всего
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Статус
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
                  {/* Основная строка */}
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
                    <td className="px-6 py-4 text-sm text-center text-gray-900 font-semibold">
                      {wbTotal}
                    </td>
                    <td className="px-6 py-4 text-sm text-center text-gray-900 font-semibold">
                      {ozonTotal}
                    </td>
                    <td className="px-6 py-4 text-sm text-center text-gray-900 font-bold">
                      {total}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="inline-flex items-center gap-2">
                        <span
                          className={cn(
                            'inline-flex px-2 py-1 text-[11px] font-semibold rounded-full',
                            wbStatus.color
                          )}
                          title="Статус по WB"
                        >
                          WB: {wbStatus.label}
                        </span>
                        <span
                          className={cn(
                            'inline-flex px-2 py-1 text-[11px] font-semibold rounded-full',
                            ozonStatus.color
                          )}
                          title="Статус по Ozon"
                        >
                          Ozon: {ozonStatus.label}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      )}
                    </td>
                  </tr>

                  {/* Развёрнутая строка с деталями по складам */}
                  {isExpanded && (
                    <tr className="bg-gray-50">
                      <td colSpan={7} className="px-6 py-4">
                        <div className="ml-8 space-y-2">
                          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">
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
                                    <div className="flex items-center gap-3">
                                      <span className="text-sm text-gray-700">{warehouse.warehouse}</span>
                                    </div>
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
