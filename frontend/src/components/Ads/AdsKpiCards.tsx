/**
 * AdsKpiCards — 4×2 grid рекламных KPI (enterprise SummaryCard)
 * Row 1: Расход | ДРР | Показы | Заказы из рекл.
 * Row 2: Клики | CPC | CPO | ROAS
 */
import { Megaphone, TrendingUp, Eye, ShoppingCart, MousePointer, Target, Banknote } from 'lucide-react';
import { SummaryCard, type CardAccent } from '../Dashboard/SummaryCard';
import { formatCurrency, formatPercent, formatNumber } from '../../lib/utils';
import type { AdCostsResponse } from '../../types';

interface AdsKpiCardsProps {
  totals: AdCostsResponse['totals'];
  previousTotals?: AdCostsResponse['previous_totals'];
  isLoading: boolean;
}

/** Рассчитать Δ% между текущим и предыдущим значением */
const calcChange = (current: number, previous: number | undefined): number | undefined => {
  if (previous === undefined || previous === 0) return undefined;
  return ((current - previous) / Math.abs(previous)) * 100;
};

/** Определить accent для ДРР по порогам */
const getDrrAccent = (drr: number): CardAccent => {
  if (drr > 20) return 'red';
  if (drr > 10) return 'amber';
  return 'emerald';
};

export const AdsKpiCards = ({ totals, previousTotals, isLoading }: AdsKpiCardsProps) => {
  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const cpc = totals.clicks > 0 ? totals.ad_cost / totals.clicks : 0;
  const cpo = totals.orders > 0 ? totals.ad_cost / totals.orders : 0;
  const roas = totals.ad_cost > 0 ? totals.revenue / totals.ad_cost : 0;
  const cr = totals.clicks > 0 ? (totals.orders / totals.clicks) * 100 : 0;

  // Previous period calculations
  const prevCpc = previousTotals && previousTotals.clicks > 0
    ? previousTotals.ad_cost / previousTotals.clicks : undefined;
  const prevCpo = previousTotals && previousTotals.orders > 0
    ? previousTotals.ad_cost / previousTotals.orders : undefined;
  const prevRoas = previousTotals && previousTotals.ad_cost > 0
    ? previousTotals.revenue / previousTotals.ad_cost : undefined;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {/* Row 1 */}
      <SummaryCard
        title="Расход на рекламу"
        mobileTitle="Расход"
        value={totals.ad_cost}
        format="currency"
        icon={Megaphone}
        accent="red"
        change={calcChange(totals.ad_cost, previousTotals?.ad_cost)}
        isPositive={false}
        loading={isLoading}
        tooltip="Суммарный расход на рекламу за период"
      />
      <SummaryCard
        title="ДРР"
        mobileTitle="ДРР"
        value={totals.drr}
        format="percent"
        icon={TrendingUp}
        accent={getDrrAccent(totals.drr)}
        change={calcChange(totals.drr, previousTotals?.drr)}
        isPositive={totals.drr <= (previousTotals?.drr ?? totals.drr)}
        loading={isLoading}
        tooltip="Доля рекламных расходов = Расход / Выручка × 100%"
        secondaryValue={previousTotals ? `было ${formatPercent(previousTotals.drr)}` : undefined}
      />
      <SummaryCard
        title="Показы"
        mobileTitle="Показы"
        value={totals.impressions}
        format="number"
        icon={Eye}
        accent="indigo"
        change={calcChange(totals.impressions, previousTotals?.impressions)}
        loading={isLoading}
        secondaryValue={`CTR ${formatPercent(ctr)}`}
        tooltip="Количество показов рекламных объявлений"
      />
      <SummaryCard
        title="Заказы из рекламы"
        mobileTitle="Заказы"
        value={totals.orders}
        format="number"
        icon={ShoppingCart}
        accent="emerald"
        change={calcChange(totals.orders, previousTotals?.orders)}
        loading={isLoading}
        secondaryValue={`CR ${formatPercent(cr)}`}
        tooltip="Заказы, атрибутированные к рекламным кампаниям"
      />

      {/* Row 2 */}
      <SummaryCard
        title="Клики"
        mobileTitle="Клики"
        value={totals.clicks}
        format="number"
        icon={MousePointer}
        accent="sky"
        change={calcChange(totals.clicks, previousTotals?.clicks)}
        loading={isLoading}
      />
      <SummaryCard
        title="CPC"
        mobileTitle="CPC"
        value={formatCurrency(cpc)}
        icon={MousePointer}
        accent="violet"
        change={calcChange(cpc, prevCpc)}
        isPositive={prevCpc !== undefined ? cpc <= prevCpc : undefined}
        loading={isLoading}
        tooltip="Cost Per Click = Расход / Клики"
        subtitle="Стоимость клика"
      />
      <SummaryCard
        title="CPO"
        mobileTitle="CPO"
        value={formatCurrency(cpo)}
        icon={Banknote}
        accent="amber"
        change={calcChange(cpo, prevCpo)}
        isPositive={prevCpo !== undefined ? cpo <= prevCpo : undefined}
        loading={isLoading}
        tooltip="Cost Per Order = Расход / Заказы"
        subtitle="Стоимость заказа"
      />
      <SummaryCard
        title="ROAS"
        mobileTitle="ROAS"
        value={`×${roas.toFixed(2)}`}
        icon={Target}
        accent="emerald"
        change={calcChange(roas, prevRoas)}
        loading={isLoading}
        tooltip="Return On Ad Spend = Выручка / Расход"
        subtitle={roas > 0 ? `на 1₽ → ${formatNumber(Math.round(roas))}₽ выручки` : undefined}
      />
    </div>
  );
};
