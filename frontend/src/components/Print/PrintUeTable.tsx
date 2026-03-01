/**
 * UE таблица — один chunk (страница) товаров
 * 12 колонок: ABC, Товар, Выкупы, Выручка, Удержания, Хранение, Закупка, Реклама, Прибыль, На ед., Маржа
 */
import { COLORS } from './print-constants';
import { formatCurrency, formatPercent, formatNumber } from '../../lib/utils';
import { getMargin, type AbcGrade, computeTotals } from '../UnitEconomics/ueHelpers';
import type { UnitEconomicsItem } from '../../types';

interface PrintUeTableProps {
  products: UnitEconomicsItem[];
  abcMap: Map<string, AbcGrade>;
  showTotals?: boolean;
  allProducts?: UnitEconomicsItem[];
}

const ABC_BADGE_STYLES: Record<AbcGrade, { bg: string; color: string }> = {
  A: { bg: '#d1fae5', color: '#059669' },
  B: { bg: '#fef3c7', color: '#d97706' },
  C: { bg: '#f3f4f6', color: '#6b7280' },
};

export function PrintUeTable({ products, abcMap, showTotals, allProducts }: PrintUeTableProps) {
  const hasAds = products.some((p) => (p.metrics.ad_cost ?? 0) > 0);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="bg-gradient-to-r from-indigo-50 to-purple-50">
              <Th align="center" width="w-8">ABC</Th>
              <Th align="left">Товар</Th>
              <Th align="right">Выкупы</Th>
              <Th align="right">Выручка</Th>
              <Th align="right">Удержания</Th>
              <Th align="right">Хранение</Th>
              <Th align="right">Закупка</Th>
              {hasAds && <Th align="right">Реклама</Th>}
              {hasAds && <Th align="right">ДРР</Th>}
              <Th align="right">Прибыль</Th>
              <Th align="right">На ед.</Th>
              <Th align="right">Рентаб.</Th>
            </tr>
          </thead>
          <tbody>
            {products.map((item, i) => {
              const margin = getMargin(item);
              const grade = abcMap.get(item.product.id) ?? 'C';
              const badgeStyle = ABC_BADGE_STYLES[grade];
              const marginColor = margin >= 20 ? COLORS.emerald : margin >= 10 ? COLORS.amber : COLORS.red;
              const profitColor = item.metrics.net_profit >= 0 ? COLORS.emerald : COLORS.red;

              return (
                <tr key={item.product.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                  <td className="px-2 py-2 text-center">
                    <span
                      className="inline-block w-5 h-5 rounded text-[10px] font-bold leading-5 text-center"
                      style={{ backgroundColor: badgeStyle.bg, color: badgeStyle.color }}
                    >
                      {grade}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-gray-900 font-medium truncate max-w-[160px]">
                    {item.product.name}
                  </td>
                  <td className="px-2 py-2 text-right text-gray-700 tabular-nums">
                    {formatNumber(item.metrics.sales_count)}
                  </td>
                  <td className="px-2 py-2 text-right text-gray-700 tabular-nums">
                    {formatCurrency(item.metrics.revenue)}
                  </td>
                  <td className="px-2 py-2 text-right text-gray-700 tabular-nums">
                    {formatCurrency(item.metrics.mp_costs)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums" style={{ color: (item.metrics.storage_cost ?? 0) > 0 ? '#ea580c' : '#9ca3af' }}>
                    {(item.metrics.storage_cost ?? 0) > 0 ? formatCurrency(item.metrics.storage_cost) : '\u2014'}
                  </td>
                  <td className="px-2 py-2 text-right text-gray-700 tabular-nums">
                    {formatCurrency(item.metrics.purchase_costs)}
                  </td>
                  {hasAds && (
                    <td className="px-2 py-2 text-right text-gray-700 tabular-nums">
                      {formatCurrency(item.metrics.ad_cost ?? 0)}
                    </td>
                  )}
                  {hasAds && (
                    <td className="px-2 py-2 text-right tabular-nums" style={{ color: (item.metrics.drr ?? 0) > 15 ? COLORS.red : COLORS.gray700 }}>
                      {formatPercent(item.metrics.drr ?? 0)}
                    </td>
                  )}
                  <td className="px-2 py-2 text-right font-semibold tabular-nums" style={{ color: profitColor }}>
                    {formatCurrency(item.metrics.net_profit)}
                  </td>
                  <td className="px-2 py-2 text-right text-gray-700 tabular-nums">
                    {formatCurrency(item.metrics.unit_profit)}
                  </td>
                  <td className="px-2 py-2 text-right font-medium tabular-nums" style={{ color: marginColor }}>
                    {formatPercent(margin)}
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Totals row on last page */}
          {showTotals && allProducts && (
            <tfoot>
              <TotalsRow products={allProducts} hasAds={hasAds} />
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

function Th({ children, align, width }: { children: React.ReactNode; align: 'left' | 'right' | 'center'; width?: string }) {
  return (
    <th className={`px-2 py-2.5 font-semibold text-gray-700 ${width ?? ''}`} style={{ textAlign: align }}>
      {children}
    </th>
  );
}

function TotalsRow({ products, hasAds }: { products: UnitEconomicsItem[]; hasAds: boolean }) {
  const totals = computeTotals(products);
  const margin = totals.revenue > 0 ? (totals.profit / totals.revenue) * 100 : 0;
  const drr = totals.revenue > 0 ? (totals.adCost / totals.revenue) * 100 : 0;
  const unitProfit = totals.sales > 0 ? totals.profit / totals.sales : 0;

  return (
    <tr className="bg-gray-100 font-semibold text-[11px]">
      <td className="px-2 py-2.5" />
      <td className="px-2 py-2.5 text-gray-900">ИТОГО ({products.length})</td>
      <td className="px-2 py-2.5 text-right text-gray-900 tabular-nums">{formatNumber(totals.sales)}</td>
      <td className="px-2 py-2.5 text-right text-gray-900 tabular-nums">{formatCurrency(totals.revenue)}</td>
      <td className="px-2 py-2.5 text-right text-gray-900 tabular-nums">{formatCurrency(totals.mpCosts)}</td>
      <td className="px-2 py-2.5 text-right tabular-nums" style={{ color: totals.storage > 0 ? '#ea580c' : '#9ca3af' }}>
        {totals.storage > 0 ? formatCurrency(totals.storage) : '\u2014'}
      </td>
      <td className="px-2 py-2.5 text-right text-gray-900 tabular-nums">{formatCurrency(totals.purchase)}</td>
      {hasAds && <td className="px-2 py-2.5 text-right text-gray-900 tabular-nums">{formatCurrency(totals.adCost)}</td>}
      {hasAds && <td className="px-2 py-2.5 text-right text-gray-900 tabular-nums">{formatPercent(drr)}</td>}
      <td className="px-2 py-2.5 text-right tabular-nums" style={{ color: totals.profit >= 0 ? COLORS.emerald : COLORS.red }}>
        {formatCurrency(totals.profit)}
      </td>
      <td className="px-2 py-2.5 text-right text-gray-700 tabular-nums">{formatCurrency(unitProfit)}</td>
      <td className="px-2 py-2.5 text-right tabular-nums" style={{ color: margin >= 20 ? COLORS.emerald : margin >= 10 ? COLORS.amber : COLORS.red }}>
        {formatPercent(margin)}
      </td>
    </tr>
  );
}
