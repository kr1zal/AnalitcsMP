/**
 * Страница маркетплейсов — OZON + WB карточки с ключевыми метриками
 */
import { COLORS } from './print-constants';
import { PrintSvgDonutChart, type DonutSegment } from './PrintSvgDonutChart';
import { formatCurrency } from '../../lib/utils';
import type { CostsTreeResponse } from '../../types';

interface PrintMarketplaceBreakdownProps {
  ozonTree?: CostsTreeResponse | null;
  wbTree?: CostsTreeResponse | null;
  marketplace: 'all' | 'ozon' | 'wb';
}

interface MpCardData {
  title: string;
  color: string;
  sales: number;
  credits: number;
  displayedRevenue: number;
  deductions: number;
  accrued: number;
  donutSegments: DonutSegment[];
}

export function PrintMarketplaceBreakdown({ ozonTree, wbTree, marketplace }: PrintMarketplaceBreakdownProps) {
  const cards: MpCardData[] = [];

  if ((marketplace === 'all' || marketplace === 'ozon') && ozonTree) {
    cards.push(buildMpCard('OZON', COLORS.ozon, ozonTree, false));
  }
  if ((marketplace === 'all' || marketplace === 'wb') && wbTree) {
    cards.push(buildMpCard('Wildberries', COLORS.wb, wbTree, true));
  }

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-gray-900">Маркетплейсы</h2>

      <div className={`grid gap-6 ${cards.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {cards.map((card) => (
          <div key={card.title} className="rounded-2xl border-2 p-5" style={{ borderColor: card.color + '40' }}>
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: card.color }} />
              <h3 className="text-lg font-bold" style={{ color: card.color }}>{card.title}</h3>
            </div>

            {/* Metrics row */}
            <div className="grid grid-cols-4 gap-3 mb-5">
              <MetricBox label="Продажи" value={formatCurrency(card.displayedRevenue)} />
              {card.credits > 0 && (
                <MetricBox label="СПП/Возм." value={formatCurrency(card.credits)} sublabel="вкл. в продажи" />
              )}
              <MetricBox label="Удержания" value={formatCurrency(card.deductions)} color={COLORS.red} />
              <MetricBox label="Начислено" value={formatCurrency(card.accrued)} color={card.accrued >= 0 ? COLORS.emerald : COLORS.red} />
            </div>

            {/* Donut chart */}
            {card.donutSegments.length > 0 && (
              <div>
                <div className="text-xs font-medium text-gray-500 mb-2">Структура удержаний</div>
                <PrintSvgDonutChart segments={card.donutSegments} size={110} innerRadius={30} outerRadius={50} legendWidth={180} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricBox({ label, value, sublabel, color }: { label: string; value: string; sublabel?: string; color?: string }) {
  return (
    <div className="rounded-lg bg-gray-50 p-2.5">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-base font-bold mt-0.5" style={{ color: color ?? COLORS.gray900 }}>{value}</div>
      {sublabel && <div className="text-[10px] text-gray-400 mt-0.5">{sublabel}</div>}
    </div>
  );
}

function buildMpCard(title: string, color: string, tree: CostsTreeResponse, isWb: boolean): MpCardData {
  const salesItem = tree.tree.find((c) => c.name === 'Продажи');
  const pureSales = salesItem?.amount ?? 0;

  // WB credits = positive items except "Продажи"
  const credits = isWb
    ? tree.tree.filter((c) => c.name !== 'Продажи' && c.amount > 0).reduce((s, c) => s + c.amount, 0)
    : 0;

  const displayedRevenue = pureSales + credits;

  // Deductions = negative items (for WB: also exclude positive non-sales)
  const deductionItems = isWb
    ? tree.tree.filter((c) => c.name !== 'Продажи' && c.amount < 0)
    : tree.tree.filter((c) => c.name !== 'Продажи');

  const deductions = deductionItems.reduce((s, c) => s + Math.abs(c.amount), 0);

  // Donut from deduction items
  const donutSegments: DonutSegment[] = deductionItems
    .map((c) => ({ label: c.name, value: Math.abs(c.amount) }))
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  return {
    title,
    color,
    sales: pureSales,
    credits,
    displayedRevenue,
    deductions,
    accrued: tree.total_accrued,
    donutSegments,
  };
}
