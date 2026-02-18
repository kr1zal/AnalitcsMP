/**
 * AdsPage — Enterprise страница рекламных кампаний
 * Orchestrator: собирает AdsKpiCards + AdsChartsSection + AdsCampaignTable + AdsDailyTable
 */
import { useState } from 'react';
import { useAdCosts, useAdCampaigns } from '../hooks/useDashboard';
import { useFiltersStore } from '../store/useFiltersStore';
import { LoadingSpinner } from '../components/Shared/LoadingSpinner';
import { getDateRangeFromPreset } from '../lib/utils';
import { FeatureGate } from '../components/Shared/FeatureGate';
import { AdsKpiCards } from '../components/Ads/AdsKpiCards';
import { AdsChartsSection } from '../components/Ads/AdsChartsSection';
import { AdsCampaignTable } from '../components/Ads/AdsCampaignTable';
import { AdsDailyTable } from '../components/Ads/AdsDailyTable';

const MP_OPTIONS = [
  { value: 'all' as const, label: 'Все' },
  { value: 'wb' as const, label: 'WB' },
  { value: 'ozon' as const, label: 'Ozon' },
];

export const AdsPage = () => {
  const { datePreset, customDateFrom, customDateTo } = useFiltersStore();
  const [selectedMarketplace, setSelectedMarketplace] = useState<'all' | 'wb' | 'ozon'>('all');

  const dateRange = getDateRangeFromPreset(datePreset, customDateFrom ?? undefined, customDateTo ?? undefined);

  const filters = {
    date_from: dateRange.from,
    date_to: dateRange.to,
    marketplace: selectedMarketplace,
  };

  // Ad costs with previous period for ChangeBadge
  const { data: adData, isLoading: costsLoading } = useAdCosts(
    { ...filters, include_prev_period: true }
  );

  // Ad campaigns breakdown
  const { data: campaignsData, isLoading: campaignsLoading } = useAdCampaigns(filters);

  const isLoading = costsLoading && !adData;

  if (isLoading) {
    return (
      <FeatureGate feature="ads_page">
        <LoadingSpinner text="Загрузка рекламных данных..." />
      </FeatureGate>
    );
  }

  const chartData = adData?.data ?? [];
  const previousTotals = adData?.previous_totals;
  const campaigns = campaignsData?.campaigns ?? [];

  // Always provide totals — zero fallback if no data
  const totals = adData?.totals ?? {
    ad_cost: 0, revenue: 0, drr: 0,
    impressions: 0, clicks: 0, orders: 0,
  };

  return (
    <FeatureGate feature="ads_page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Реклама</h2>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              {dateRange.from} — {dateRange.to}
            </p>
          </div>
          <div className="flex gap-1.5 sm:gap-2">
            {MP_OPTIONS.map((mp) => (
              <button
                key={mp.value}
                onClick={() => setSelectedMarketplace(mp.value)}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm rounded-lg transition-colors ${
                  selectedMarketplace === mp.value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {mp.label}
              </button>
            ))}
          </div>
        </div>

        {/* KPI Cards — 4×2 enterprise grid (always visible) */}
        <AdsKpiCards
          totals={totals}
          previousTotals={previousTotals}
          isLoading={costsLoading}
        />

        {/* Charts — DRR trend + Spend vs Revenue */}
        <AdsChartsSection data={chartData} isLoading={costsLoading} />

        {/* Campaign breakdown table */}
        <AdsCampaignTable
          campaigns={campaigns}
          isLoading={campaignsLoading}
        />

        {/* Daily breakdown (collapsible) */}
        <AdsDailyTable data={chartData} totals={totals} />
      </div>
    </FeatureGate>
  );
};
