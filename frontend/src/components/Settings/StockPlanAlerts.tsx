/**
 * StockPlanAlerts — warnings when stock won't last until end of plan month.
 * Self-contained: loads stocks via useStocks, receives plan month as prop.
 * Shows only if there are products with stock risk.
 */
import { useMemo } from 'react';
import { AlertTriangle, CheckCircle, Package } from 'lucide-react';
import { useStocks } from '../../hooks/useDashboard';
import { cn } from '../../lib/utils';
import type { StockItem } from '../../types';

interface StockPlanAlertsProps {
  month: string; // "YYYY-MM"
}

interface StockAlert {
  productName: string;
  daysRemaining: number | null;
  daysToMonthEnd: number;
  severity: 'critical' | 'warning' | 'ok';
}

function getDaysToMonthEnd(month: string): number {
  const [y, m] = month.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const today = new Date();
  const monthEnd = new Date(y, m - 1, lastDay);

  if (today > monthEnd) return 0;

  const diff = Math.ceil((monthEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

function classifyAlert(stock: StockItem, daysToEnd: number): StockAlert {
  const dr = stock.days_remaining;
  let severity: 'critical' | 'warning' | 'ok' = 'ok';

  if (dr === null || dr === undefined) {
    severity = 'ok'; // no data — skip
  } else if (dr <= 7 && dr < daysToEnd) {
    severity = 'critical';
  } else if (dr < daysToEnd) {
    severity = 'warning';
  }

  return {
    productName: stock.product_name,
    daysRemaining: dr ?? null,
    daysToMonthEnd: daysToEnd,
    severity,
  };
}

export function StockPlanAlerts({ month }: StockPlanAlertsProps) {
  const { data: stocksData } = useStocks();

  const alerts = useMemo(() => {
    if (!stocksData?.stocks) return [];
    const daysToEnd = getDaysToMonthEnd(month);
    if (daysToEnd <= 0) return [];

    return stocksData.stocks
      .filter((s) => s.barcode !== 'WB_ACCOUNT')
      .map((s) => classifyAlert(s, daysToEnd))
      .sort((a, b) => {
        const order = { critical: 0, warning: 1, ok: 2 };
        return order[a.severity] - order[b.severity];
      });
  }, [stocksData, month]);

  const criticalAlerts = alerts.filter((a) => a.severity === 'critical');
  const warningAlerts = alerts.filter((a) => a.severity === 'warning');
  const okAlerts = alerts.filter((a) => a.severity === 'ok');

  // Don't render if no risks
  if (criticalAlerts.length === 0 && warningAlerts.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-1.5">
      <div className="flex items-center gap-1.5 mb-1">
        <Package className="w-3.5 h-3.5 text-gray-500" />
        <span className="text-xs font-medium text-gray-600">Риски по остаткам</span>
      </div>

      {criticalAlerts.map((a) => (
        <div key={a.productName} className="flex items-start gap-1.5 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-md px-2.5 py-1.5">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-red-500" />
          <span>
            <strong>{a.productName}</strong>: запас на {a.daysRemaining ?? '?'} дн., до конца месяца {a.daysToMonthEnd}
          </span>
        </div>
      ))}

      {warningAlerts.map((a) => (
        <div key={a.productName} className="flex items-start gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-500" />
          <span>
            <strong>{a.productName}</strong>: запас на {a.daysRemaining ?? '?'} дн., до конца месяца {a.daysToMonthEnd}
          </span>
        </div>
      ))}

      {okAlerts.length > 0 && (
        <div className={cn('flex items-center gap-1.5 text-[10px] text-gray-400')}>
          <CheckCircle className="w-3 h-3 text-emerald-400" />
          <span>{okAlerts.map((a) => a.productName).join(', ')}: запас OK</span>
        </div>
      )}
    </div>
  );
}
