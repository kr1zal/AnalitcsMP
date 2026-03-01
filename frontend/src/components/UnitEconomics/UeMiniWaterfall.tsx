/**
 * Компактный каскад прибыли (mini waterfall) для expanded row
 * Паттерн из ProfitWaterfall.tsx — div-based bars
 */
import { formatCurrency, cn } from '../../lib/utils';

interface MiniWaterfallProps {
  revenue: number;
  mpDeductions: number;
  storage: number;
  purchase: number;
  ads: number;
  profit: number;
}

const rows = (p: MiniWaterfallProps) => {
  const list: { label: string; value: number; pct: number; bar: string; text: string; negative?: boolean }[] = [
    { label: 'Выручка', value: p.revenue, pct: 100, bar: 'bg-emerald-400', text: 'text-gray-900' },
    { label: 'Удерж.', value: p.mpDeductions, pct: pctOf(p.mpDeductions, p.revenue), bar: 'bg-red-300', text: 'text-red-600', negative: true },
  ];
  if (p.storage > 0) {
    list.push({ label: 'Хранение', value: p.storage, pct: pctOf(p.storage, p.revenue), bar: 'bg-orange-400', text: 'text-orange-600', negative: true });
  }
  list.push(
    { label: 'Закупка', value: p.purchase, pct: pctOf(p.purchase, p.revenue), bar: 'bg-amber-300', text: 'text-amber-700', negative: true },
  );
  if (p.ads > 0) {
    list.push({ label: 'Реклама', value: p.ads, pct: pctOf(p.ads, p.revenue), bar: 'bg-blue-300', text: 'text-blue-700', negative: true });
  }
  list.push({
    label: 'Прибыль',
    value: Math.abs(p.profit),
    pct: pctOf(Math.abs(p.profit), p.revenue),
    bar: p.profit >= 0 ? 'bg-indigo-400' : 'bg-red-400',
    text: p.profit >= 0 ? 'text-indigo-700' : 'text-red-600',
  });
  return list;
};

function pctOf(part: number, total: number): number {
  return total > 0 ? Math.max(2, Math.min((part / total) * 100, 100)) : 0;
}

export function UeMiniWaterfall(props: MiniWaterfallProps) {
  if (!props.revenue || props.revenue <= 0) return null;

  return (
    <div className="space-y-1.5">
      {rows(props).map((r) => (
        <div key={r.label}>
          <div className="flex justify-between text-[10px] sm:text-[11px] leading-tight">
            <span className="text-gray-500">{r.negative ? '−' : ''}{r.label}</span>
            <span className={cn('tabular-nums font-medium', r.text)}>
              {formatCurrency(r.value)}
            </span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-0.5">
            <div
              className={cn(r.bar, 'h-full rounded-full transition-all')}
              style={{ width: `${r.pct}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
