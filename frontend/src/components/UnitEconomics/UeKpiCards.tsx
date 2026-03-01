/**
 * KPI-карточки для Unit Economics (2 ряда: основные + расширенные)
 */
import {
  ShoppingCart,
  DollarSign,
  Percent,
  TrendingUp,
  TrendingDown,
  Target,
  Megaphone,
  RotateCcw,
  Package,
  Warehouse,
} from 'lucide-react';
import { formatCurrency, formatPercent, cn } from '../../lib/utils';
import type { UeTotals } from './ueHelpers';
import type { SalesPlanCompletionResponse } from '../../types';

interface UeKpiCardsProps {
  totals: UeTotals;
  productCount: number;
  profitableCount: number;
  hasAds: boolean;
  hasReturns: boolean;
  planData?: SalesPlanCompletionResponse;
}

type CardColor = 'blue' | 'green' | 'red' | 'yellow' | 'indigo' | 'purple' | 'muted';

const COLOR_MAP: Record<CardColor, string> = {
  blue: 'bg-blue-50 border-blue-100 text-blue-700',
  green: 'bg-emerald-50 border-emerald-100 text-emerald-700',
  red: 'bg-red-50 border-red-100 text-red-700',
  yellow: 'bg-amber-50 border-amber-100 text-amber-700',
  indigo: 'bg-indigo-50 border-indigo-100 text-indigo-700',
  purple: 'bg-purple-50 border-purple-100 text-purple-700',
  muted: 'bg-gradient-to-br from-gray-50 to-white border-gray-200 text-gray-700',
};

function KpiCard({
  label,
  value,
  sub,
  icon,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  color: CardColor;
}) {
  return (
    <div className={cn('rounded-lg border p-2.5 sm:p-4', COLOR_MAP[color])}>
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[10px] sm:text-xs opacity-80">{label}</span>
      </div>
      <div className="text-base sm:text-xl font-bold truncate">{value}</div>
      <div className="text-[10px] sm:text-xs opacity-60 mt-0.5 truncate">{sub}</div>
    </div>
  );
}

export function UeKpiCards({ totals, productCount, profitableCount, hasAds, hasReturns, planData }: UeKpiCardsProps) {
  const avgMargin = totals.revenue > 0 ? (totals.profit / totals.revenue) * 100 : 0;
  const avgUnitProfit = totals.sales > 0 ? totals.profit / totals.sales : 0;

  // ROI = profit / (purchase + ads) × 100
  const invested = totals.purchase + totals.adCost;
  const roi = invested > 0 ? (totals.profit / invested) * 100 : 0;

  // ROAS = revenue / ads
  const roas = totals.adCost > 0 ? totals.revenue / totals.adCost : 0;

  // Return rate
  const totalDelivered = totals.sales + totals.returns;
  const returnRate = totalDelivered > 0 ? (totals.returns / totalDelivered) * 100 : 0;

  const lossCount = productCount - profitableCount;

  // Сколько карточек во втором ряду (динамически)
  const row2Cards: React.ReactNode[] = [];

  row2Cards.push(
    <KpiCard
      key="roi"
      label="ROI"
      value={formatPercent(roi)}
      sub={roi >= 100 ? 'отлично' : roi >= 50 ? 'хорошо' : roi > 0 ? 'низкий' : 'нет окупаемости'}
      icon={<Target className="w-3.5 h-3.5" />}
      color="muted"
    />,
  );

  if (totals.storage > 0) {
    const storagePctOfRevenue = totals.revenue > 0 ? (totals.storage / totals.revenue) * 100 : 0;
    row2Cards.push(
      <KpiCard
        key="storage"
        label="Хранение"
        value={formatCurrency(totals.storage)}
        sub={`${storagePctOfRevenue.toFixed(1)}% от выручки`}
        icon={<Warehouse className="w-3.5 h-3.5" />}
        color="muted"
      />,
    );
  }

  if (hasAds) {
    row2Cards.push(
      <KpiCard
        key="roas"
        label="ROAS"
        value={`${roas.toFixed(1)}x`}
        sub={roas >= 5 ? 'отлично' : roas >= 3 ? 'хорошо' : 'низкий'}
        icon={<Megaphone className="w-3.5 h-3.5" />}
        color="muted"
      />,
    );
  }

  if (hasReturns) {
    row2Cards.push(
      <KpiCard
        key="returns"
        label="Возвраты"
        value={formatPercent(returnRate)}
        sub={`${totals.returns} шт из ${totalDelivered}`}
        icon={<RotateCcw className="w-3.5 h-3.5" />}
        color="muted"
      />,
    );
  }

  if (planData && planData.total_plan > 0) {
    const pct = planData.completion_percent;
    row2Cards.push(
      <KpiCard
        key="plan"
        label="План"
        value={`${Math.round(pct)}%`}
        sub={planData.month_label ?? 'текущий месяц'}
        icon={<Target className="w-3.5 h-3.5" />}
        color={pct >= 100 ? 'green' : pct >= 70 ? 'indigo' : 'yellow'}
      />,
    );
  }

  row2Cards.push(
    <KpiCard
      key="products"
      label="Товаров"
      value={String(productCount)}
      sub={`${profitableCount} приб. · ${lossCount} убыт.`}
      icon={<Package className="w-3.5 h-3.5" />}
      color="muted"
    />,
  );

  // Сколько cols для 2го ряда (adaptive for 2-6 cards)
  const row2Cols = row2Cards.length >= 5
    ? 'sm:grid-cols-3 lg:grid-cols-5'
    : row2Cards.length === 4
      ? 'sm:grid-cols-4'
      : row2Cards.length === 3
        ? 'sm:grid-cols-3'
        : 'sm:grid-cols-2';

  return (
    <div className="space-y-2 sm:space-y-3">
      {/* Row 1: Primary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <KpiCard
          label="Выручка"
          value={formatCurrency(totals.revenue)}
          sub={`${totals.sales} шт${hasReturns ? ` · ${totals.returns} возвр.` : ''}`}
          icon={<ShoppingCart className="w-3.5 h-3.5" />}
          color="blue"
        />
        <KpiCard
          label="Прибыль"
          value={formatCurrency(totals.profit)}
          sub={totals.profit >= 0 ? 'в плюсе' : 'убыток'}
          icon={<DollarSign className="w-3.5 h-3.5" />}
          color={totals.profit >= 0 ? 'green' : 'red'}
        />
        <KpiCard
          label="Ср. рентаб."
          value={formatPercent(avgMargin)}
          sub={avgMargin >= 20 ? 'хорошо' : avgMargin >= 10 ? 'средне' : 'низкая'}
          icon={<Percent className="w-3.5 h-3.5" />}
          color={avgMargin >= 20 ? 'green' : avgMargin >= 10 ? 'yellow' : 'red'}
        />
        <KpiCard
          label="Прибыль/ед."
          value={formatCurrency(avgUnitProfit)}
          sub="среднее"
          icon={avgUnitProfit >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          color={avgUnitProfit >= 0 ? 'green' : 'red'}
        />
      </div>

      {/* Row 2: Advanced KPIs */}
      <div className={cn('grid grid-cols-2 gap-2 sm:gap-3', row2Cols)}>
        {row2Cards}
      </div>
    </div>
  );
}
