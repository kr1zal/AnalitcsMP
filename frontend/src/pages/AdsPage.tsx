/**
 * AdsPage — Enterprise страница рекламных кампаний
 * Orchestrator: собирает AdsKpiCards + AdsChartsSection + AdsCampaignTable + AdsDailyTable
 */
import { useState } from 'react';
import { useAdCosts, useAdCampaigns } from '../hooks/useDashboard';
import { useSubscription } from '../hooks/useSubscription';
import { useFiltersStore } from '../store/useFiltersStore';
import { LoadingSpinner } from '../components/Shared/LoadingSpinner';
import { DateRangePicker } from '../components/Shared/DateRangePicker';
import { useIsMobile } from '../hooks/useMediaQuery';
import { cn, getDateRangeFromPreset, getMaxAvailableDateYmd, normalizeDateRangeYmd } from '../lib/utils';
import { FeatureGate } from '../components/Shared/FeatureGate';
import { AdsKpiCards } from '../components/Ads/AdsKpiCards';
import { AdsChartsSection } from '../components/Ads/AdsChartsSection';
import { AdsCampaignTable } from '../components/Ads/AdsCampaignTable';
import { AdsDailyTable } from '../components/Ads/AdsDailyTable';
import type { DateRangePreset } from '../types';

const DATE_PRESETS: { value: DateRangePreset; label: string }[] = [
  { value: '7d', label: '7д' },
  { value: '30d', label: '30д' },
  { value: '90d', label: '90д' },
];

const MP_OPTIONS = [
  { value: 'all' as const, label: 'Все' },
  { value: 'wb' as const, label: 'WB' },
  { value: 'ozon' as const, label: 'Ozon' },
];

export const AdsPage = () => {
  const { datePreset, customDateFrom, customDateTo, setDatePreset, setCustomDates } = useFiltersStore();
  const { data: subscription } = useSubscription();
  const hasAccess = subscription?.features?.ads_page === true;
  const [selectedMarketplace, setSelectedMarketplace] = useState<'all' | 'wb' | 'ozon'>('all');
  const isMobile = useIsMobile();

  const maxAvailableDate = getMaxAvailableDateYmd();
  const dateRange = getDateRangeFromPreset(datePreset, customDateFrom ?? undefined, customDateTo ?? undefined, maxAvailableDate);

  const handleDateRangeChange = (from: string, to: string) => {
    const normalized = normalizeDateRangeYmd(from, to, { max: maxAvailableDate });
    setCustomDates(normalized.from, normalized.to);
  };

  const filters = {
    date_from: dateRange.from,
    date_to: dateRange.to,
    marketplace: selectedMarketplace,
  };

  // Ad costs with previous period for ChangeBadge — disabled for Free plan
  const { data: adData, isLoading: costsLoading } = useAdCosts(
    { ...filters, include_prev_period: true },
    { enabled: hasAccess },
  );

  // Ad campaigns breakdown — disabled for Free plan
  const { data: campaignsData, isLoading: campaignsLoading } = useAdCampaigns(filters, { enabled: hasAccess });

  const isLoading = costsLoading && !adData;

  // Free plan — показываем FeatureGate блокировку
  if (!hasAccess) {
    return (
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-5">Реклама</h2>
        <FeatureGate feature="ads_page">
          <div className="h-[400px]" />
        </FeatureGate>
      </div>
    );
  }

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
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-5 sm:space-y-6">
        {/* Title */}
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Реклама</h2>

        {/* Filter Panel */}
        {isMobile ? (
          <div className="sticky top-0 z-30 bg-white rounded-xl shadow-sm border border-gray-200 p-3 space-y-2.5">
            {/* Row 1: Date presets */}
            <div className="flex items-center gap-1.5">
              {DATE_PRESETS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setDatePreset(p.value)}
                  className={cn(
                    'h-8 px-3 text-sm font-medium rounded-lg transition-all active:scale-95',
                    datePreset === p.value
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {/* Row 2: Calendar + MP pills */}
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <DateRangePicker
                  from={dateRange.from}
                  to={dateRange.to}
                  maxDate={maxAvailableDate}
                  onChange={handleDateRangeChange}
                  isActive={datePreset === 'custom'}
                />
              </div>
              <div className="flex gap-1">
                {MP_OPTIONS.map((mp) => (
                  <button
                    key={mp.value}
                    onClick={() => setSelectedMarketplace(mp.value)}
                    className={cn(
                      'h-8 px-2.5 text-xs font-medium rounded-lg transition-colors active:scale-95',
                      selectedMarketplace === mp.value
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    )}
                  >
                    {mp.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="sticky top-16 z-30 bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-3">
              {/* Date presets */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600">Период:</span>
                <div className="flex gap-1.5">
                  {DATE_PRESETS.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => setDatePreset(p.value)}
                      className={cn(
                        'h-9 px-3.5 text-sm font-medium rounded-lg transition-all',
                        datePreset === p.value
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-8 w-px bg-gray-200" />

              {/* DateRangePicker */}
              <DateRangePicker
                from={dateRange.from}
                to={dateRange.to}
                maxDate={maxAvailableDate}
                onChange={handleDateRangeChange}
                isActive={datePreset === 'custom'}
              />

              <div className="h-8 w-px bg-gray-200" />

              {/* Marketplace pills */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600">МП:</span>
                <div className="flex gap-1.5">
                  {MP_OPTIONS.map((mp) => (
                    <button
                      key={mp.value}
                      onClick={() => setSelectedMarketplace(mp.value)}
                      className={cn(
                        'h-9 px-3 text-sm font-medium rounded-lg transition-all',
                        selectedMarketplace === mp.value
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      )}
                    >
                      {mp.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

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
