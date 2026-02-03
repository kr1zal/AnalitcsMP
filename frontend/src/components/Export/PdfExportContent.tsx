/**
 * Скрытый контент для PDF экспорта
 * Рендерит три секции: Dashboard summary, Ads, Unit Economics
 * Эти секции захватываются через html2canvas при экспорте в PDF
 */
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { formatCurrency, formatPercent, formatNumber, formatDate } from '../../lib/utils';
import type {
  SalesSummary,
  AdCostsChartDataPoint,
  UnitEconomicsItem,
  CostsTreeResponse,
} from '../../types';

export interface PdfExportRefs {
  dashboardRef: HTMLDivElement | null;
  adsRef: HTMLDivElement | null;
  unitEconomicsRef: HTMLDivElement | null;
}

interface PdfExportContentProps {
  summary: SalesSummary | null;
  ozonCostsTree: CostsTreeResponse | null;
  wbCostsTree: CostsTreeResponse | null;
  adCosts: AdCostsChartDataPoint[];
  adTotals?: {
    ad_cost: number;
    revenue: number;
    drr: number;
    impressions: number;
    clicks: number;
    orders: number;
  };
  unitEconomics: UnitEconomicsItem[];
  period: { from: string; to: string };
}

export const PdfExportContent = forwardRef<PdfExportRefs, PdfExportContentProps>(
  ({ summary, ozonCostsTree, wbCostsTree, adCosts, adTotals, unitEconomics, period }, ref) => {
    const dashboardRef = useRef<HTMLDivElement>(null);
    const adsRef = useRef<HTMLDivElement>(null);
    const unitEconomicsRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
      dashboardRef: dashboardRef.current,
      adsRef: adsRef.current,
      unitEconomicsRef: unitEconomicsRef.current,
    }));

    const periodStr = `${formatDate(period.from)} — ${formatDate(period.to)}`;

    // Данные из costs-tree
    const ozonSales = ozonCostsTree?.tree.find((c) => c.name === 'Продажи')?.amount ?? 0;
    const wbSales = wbCostsTree?.tree.find((c) => c.name === 'Продажи')?.amount ?? 0;
    const totalRevenue = ozonSales + wbSales;

    return (
      <div className="fixed left-[-9999px] top-0 bg-white" style={{ width: '1200px' }}>
        {/* ============ PAGE 1: Dashboard Summary ============ */}
        <div ref={dashboardRef} className="p-8 bg-white" style={{ minHeight: '800px' }}>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Аналитика маркетплейсов</h1>
          <p className="text-gray-500 mb-6">{periodStr}</p>

          {/* Метрики в 2 колонки */}
          <div className="grid grid-cols-2 gap-6 mb-8">
            {/* OZON */}
            <div className="border border-blue-200 rounded-xl p-5 bg-blue-50/30">
              <h2 className="text-lg font-semibold text-blue-700 mb-4">OZON</h2>
              <div className="space-y-3">
                <MetricRow label="Продажи" value={formatCurrency(ozonSales)} />
                <MetricRow label="Начислено" value={formatCurrency(ozonCostsTree?.total_accrued ?? 0)} />
                {ozonCostsTree?.tree
                  .filter((c) => c.name !== 'Продажи')
                  .slice(0, 5)
                  .map((c) => (
                    <MetricRow key={c.name} label={`  ${c.name}`} value={formatCurrency(c.amount)} small />
                  ))}
              </div>
            </div>

            {/* WB */}
            <div className="border border-purple-200 rounded-xl p-5 bg-purple-50/30">
              <h2 className="text-lg font-semibold text-purple-700 mb-4">Wildberries</h2>
              <div className="space-y-3">
                <MetricRow label="Продажи" value={formatCurrency(wbSales)} />
                <MetricRow label="Начислено" value={formatCurrency(wbCostsTree?.total_accrued ?? 0)} />
                {wbCostsTree?.tree
                  .filter((c) => c.name !== 'Продажи')
                  .slice(0, 5)
                  .map((c) => (
                    <MetricRow key={c.name} label={`  ${c.name}`} value={formatCurrency(c.amount)} small />
                  ))}
              </div>
            </div>
          </div>

          {/* Общие показатели */}
          <div className="border border-gray-200 rounded-xl p-5 bg-gray-50/50">
            <h2 className="text-lg font-semibold text-gray-700 mb-4">Общие показатели</h2>
            <div className="grid grid-cols-3 gap-6">
              <MetricBox label="Выручка" value={formatCurrency(totalRevenue)} />
              <MetricBox label="Заказы" value={formatNumber(summary?.orders ?? 0)} />
              <MetricBox label="Выкупы" value={formatNumber(summary?.sales ?? 0)} />
              <MetricBox label="Возвраты" value={formatNumber(summary?.returns ?? 0)} />
              <MetricBox label="Средний чек" value={formatCurrency(summary?.avg_check ?? 0)} />
              <MetricBox label="Прибыль (оценка)" value={formatCurrency(summary?.net_profit ?? 0)} />
            </div>
          </div>
        </div>

        {/* ============ PAGE 2: Ads ============ */}
        <div ref={adsRef} className="p-8 bg-white" style={{ minHeight: '800px' }}>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Рекламные расходы</h1>
          <p className="text-gray-500 mb-6">{periodStr}</p>

          {/* Метрики рекламы */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            <MetricCard label="Расход" value={formatCurrency(adTotals?.ad_cost ?? 0)} color="red" />
            <MetricCard label="ДРР" value={formatPercent(adTotals?.drr ?? 0)} color="orange" />
            <MetricCard label="Показы" value={formatNumber(adTotals?.impressions ?? 0)} color="blue" />
            <MetricCard label="Клики" value={formatNumber(adTotals?.clicks ?? 0)} color="indigo" />
          </div>

          {/* Таблица по дням */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Дата</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">Расход</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">Выручка</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">ДРР %</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">Показы</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">Клики</th>
                </tr>
              </thead>
              <tbody>
                {adCosts.slice(0, 15).map((day, i) => (
                  <tr key={day.date} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-2 text-gray-900">{formatDate(day.date)}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(day.ad_cost)}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{formatCurrency(day.revenue)}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{formatPercent(day.drr)}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{formatNumber(day.impressions)}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{formatNumber(day.clicks)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {adCosts.length > 15 && (
              <div className="px-4 py-2 text-sm text-gray-500 bg-gray-50 border-t">
                + ещё {adCosts.length - 15} дней
              </div>
            )}
          </div>
        </div>

        {/* ============ PAGE 3: Unit Economics ============ */}
        <div ref={unitEconomicsRef} className="p-8 bg-white" style={{ minHeight: '800px' }}>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Unit-экономика</h1>
          <p className="text-gray-500 mb-6">{periodStr}</p>

          {/* Таблица товаров */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Товар</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">Продажи</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">Выручка</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">Удержания МП</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">Закупка</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">Прибыль</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">На ед.</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">Маржа</th>
                </tr>
              </thead>
              <tbody>
                {unitEconomics.map((item, i) => {
                  const margin =
                    item.metrics.revenue > 0
                      ? (item.metrics.net_profit / item.metrics.revenue) * 100
                      : 0;
                  return (
                    <tr key={item.product.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-2 text-gray-900 truncate max-w-[200px]">
                        {item.product.name}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-700">
                        {formatNumber(item.metrics.sales_count)}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-700">
                        {formatCurrency(item.metrics.revenue)}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-700">
                        {formatCurrency(item.metrics.mp_costs)}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-700">
                        {formatCurrency(item.metrics.purchase_costs)}
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-gray-900">
                        {formatCurrency(item.metrics.net_profit)}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-700">
                        {formatCurrency(item.metrics.unit_profit)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <span
                          className={
                            margin >= 20
                              ? 'text-green-600'
                              : margin >= 10
                              ? 'text-yellow-600'
                              : 'text-red-600'
                          }
                        >
                          {formatPercent(margin)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Итого */}
          {unitEconomics.length > 0 && (
            <div className="mt-6 grid grid-cols-4 gap-4">
              <MetricCard
                label="Всего продаж"
                value={formatNumber(unitEconomics.reduce((s, i) => s + i.metrics.sales_count, 0))}
                color="blue"
              />
              <MetricCard
                label="Общая выручка"
                value={formatCurrency(unitEconomics.reduce((s, i) => s + i.metrics.revenue, 0))}
                color="green"
              />
              <MetricCard
                label="Удержания МП"
                value={formatCurrency(unitEconomics.reduce((s, i) => s + i.metrics.mp_costs, 0))}
                color="orange"
              />
              <MetricCard
                label="Прибыль"
                value={formatCurrency(unitEconomics.reduce((s, i) => s + i.metrics.net_profit, 0))}
                color="indigo"
              />
            </div>
          )}
        </div>
      </div>
    );
  }
);

PdfExportContent.displayName = 'PdfExportContent';

// ==================== Helper Components ====================

function MetricRow({
  label,
  value,
  small = false,
}: {
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className={small ? 'text-sm text-gray-500' : 'text-gray-700'}>{label}</span>
      <span className={small ? 'text-sm text-gray-600' : 'font-medium text-gray-900'}>{value}</span>
    </div>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-500">{label}</div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: 'red' | 'orange' | 'blue' | 'indigo' | 'green';
}) {
  const colorClasses = {
    red: 'bg-red-50 border-red-200 text-red-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    green: 'bg-green-50 border-green-200 text-green-700',
  };

  return (
    <div className={`rounded-xl border p-4 ${colorClasses[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm opacity-80">{label}</div>
    </div>
  );
}
