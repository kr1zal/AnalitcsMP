/**
 * Features Section — asymmetric bento grid on white bg.
 *
 * Desktop (lg+): Sync left (narrow, full height), right column stacked
 * Tablet (sm-lg): 2 columns, hero cards span-2
 * Mobile (<sm): single column stack
 */
import { RevealSection } from '../hooks/useLandingAnimations';
import { SyncTimelineCard } from './features/SyncTimelineCard';
import { ProfitDeductionsCard } from './features/ProfitDeductionsCard';
import { DashboardMetricsCard } from './features/DashboardMetricsCard';
import { ProductMatchingCard } from './features/ProductMatchingCard';
import { AdAnalyticsCard } from './features/AdAnalyticsCard';

export function FeaturesSection() {
  return (
    <section id="features" className="relative py-16 sm:py-24 bg-white overflow-hidden">
      {/* Subtle dot pattern */}
      <div className="features-grid-pattern" aria-hidden="true" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
        <RevealSection>
          <div className="text-center">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200/60 mb-4">
              Возможности
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-gray-900">
              Все, что нужно для аналитики
            </h2>
            <p className="mt-4 text-base sm:text-lg text-gray-500 max-w-2xl mx-auto">
              Подключите маркетплейсы и&nbsp;получите полную картину
              бизнеса за&nbsp;пару минут
            </p>
          </div>
        </RevealSection>

        {/* Bento Grid: row1 = sync + profit, row2 = 3 standard cards */}
        <div className="mt-12 sm:mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 lg:gap-7">
          {/* Sync Timeline */}
          <RevealSection className="sm:col-span-2 lg:col-span-1">
            <SyncTimelineCard />
          </RevealSection>

          {/* Profit + Deductions — spans 2 cols */}
          <RevealSection delay={80} className="sm:col-span-2 lg:col-span-2">
            <ProfitDeductionsCard />
          </RevealSection>

          {/* Dashboard Metrics */}
          <RevealSection delay={160}>
            <DashboardMetricsCard />
          </RevealSection>

          {/* Product Matching — Exclusive */}
          <RevealSection delay={240}>
            <ProductMatchingCard />
          </RevealSection>

          {/* Ad Analytics — Pro */}
          <RevealSection delay={320}>
            <AdAnalyticsCard />
          </RevealSection>
        </div>
      </div>
    </section>
  );
}
