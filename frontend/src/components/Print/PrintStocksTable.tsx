/**
 * Страница остатков — таблица со статусом, прогнозом дней, avg daily sales
 */
import { COLORS, STOCK_FORECAST_THRESHOLDS, STOCK_STATUS_THRESHOLDS } from './print-constants';
import { formatNumber } from '../../lib/utils';
import type { StockItem } from '../../types';

interface PrintStocksTableProps {
  stocks: StockItem[];
  showTitle?: boolean;
}

type StockStatus = 'oos' | 'critical' | 'low' | 'ok';

function getStockStatus(total: number): StockStatus {
  if (total <= STOCK_STATUS_THRESHOLDS.oos) return 'oos';
  if (total < STOCK_STATUS_THRESHOLDS.critical) return 'critical';
  if (total < STOCK_STATUS_THRESHOLDS.low) return 'low';
  return 'ok';
}

const STATUS_STYLES: Record<StockStatus, { bg: string; color: string; label: string }> = {
  oos: { bg: '#fef2f2', color: '#dc2626', label: 'Нет' },
  critical: { bg: '#fef2f2', color: '#dc2626', label: 'Крит.' },
  low: { bg: '#fffbeb', color: '#d97706', label: 'Мало' },
  ok: { bg: '#f0fdf4', color: '#16a34a', label: 'OK' },
};

function getForecastColor(days: number | null | undefined): string {
  if (days == null) return COLORS.gray400;
  if (days <= STOCK_FORECAST_THRESHOLDS.critical) return COLORS.red;
  if (days <= STOCK_FORECAST_THRESHOLDS.low) return COLORS.amber;
  if (days <= STOCK_FORECAST_THRESHOLDS.medium) return COLORS.sky;
  return COLORS.emerald;
}

export function PrintStocksTable({ stocks, showTitle = true }: PrintStocksTableProps) {
  // Summary totals
  const totalWb = stocks.reduce((s, st) => {
    const wb = st.warehouses.filter((w) => w.marketplace === 'wb').reduce((sum, w) => sum + w.quantity, 0);
    return s + wb;
  }, 0);
  const totalOzon = stocks.reduce((s, st) => {
    const ozon = st.warehouses.filter((w) => w.marketplace === 'ozon').reduce((sum, w) => sum + w.quantity, 0);
    return s + ozon;
  }, 0);
  const totalAll = totalWb + totalOzon;

  return (
    <div className="space-y-3">
      {showTitle && <h2 className="text-xl font-bold text-gray-900">Остатки на складах</h2>}

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryBox label="OZON" value={formatNumber(totalOzon)} color={COLORS.ozon} />
        <SummaryBox label="WB" value={formatNumber(totalWb)} color={COLORS.wb} />
        <SummaryBox label="Всего" value={formatNumber(totalAll)} />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="bg-gradient-to-r from-emerald-50 to-teal-50">
              <th className="px-3 py-2.5 text-left font-semibold text-gray-700">Товар</th>
              <th className="px-3 py-2.5 text-center font-semibold text-gray-700">OZON</th>
              <th className="px-3 py-2.5 text-center font-semibold text-gray-700">WB</th>
              <th className="px-3 py-2.5 text-center font-semibold text-gray-700">Всего</th>
              <th className="px-3 py-2.5 text-center font-semibold text-gray-700">Продаж/д</th>
              <th className="px-3 py-2.5 text-center font-semibold text-gray-700">Прогноз</th>
              <th className="px-3 py-2.5 text-center font-semibold text-gray-700">Статус</th>
            </tr>
          </thead>
          <tbody>
            {stocks.map((stock, i) => {
              const ozon = stock.warehouses
                .filter((w) => w.marketplace === 'ozon')
                .reduce((s, w) => s + w.quantity, 0);
              const wb = stock.warehouses
                .filter((w) => w.marketplace === 'wb')
                .reduce((s, w) => s + w.quantity, 0);
              const total = ozon + wb;
              const status = getStockStatus(total);
              const statusStyle = STATUS_STYLES[status];
              const forecastColor = getForecastColor(stock.days_remaining);

              return (
                <tr key={stock.barcode} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                  <td className="px-3 py-2 text-gray-900 font-medium truncate max-w-[200px]">
                    {stock.product_name}
                  </td>
                  <td className="px-3 py-2 text-center text-gray-700 tabular-nums">
                    {ozon > 0 ? formatNumber(ozon) : '—'}
                  </td>
                  <td className="px-3 py-2 text-center text-gray-700 tabular-nums">
                    {wb > 0 ? formatNumber(wb) : '—'}
                  </td>
                  <td className="px-3 py-2 text-center font-semibold text-gray-900 tabular-nums">
                    {formatNumber(total)}
                  </td>
                  <td className="px-3 py-2 text-center text-gray-500 tabular-nums">
                    {stock.avg_daily_sales != null ? stock.avg_daily_sales.toFixed(1) : '—'}
                  </td>
                  <td className="px-3 py-2 text-center font-medium tabular-nums" style={{ color: forecastColor }}>
                    {stock.days_remaining != null ? `${Math.round(stock.days_remaining)} дн.` : '—'}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                      style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}
                    >
                      {statusStyle.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 p-3 bg-gradient-to-br from-gray-50 to-white">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-bold mt-0.5" style={{ color: color ?? COLORS.gray900 }}>{value}</div>
    </div>
  );
}
