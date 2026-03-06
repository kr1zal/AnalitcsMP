/**
 * Features Section — asymmetric bento grid on white bg.
 *
 * Desktop (lg+): Sync left (narrow, full height), right column stacked
 * Tablet (sm-lg): 2 columns, hero cards span-2
 * Mobile (<sm): single column stack
 */
import { RevealSection } from '../hooks/useLandingAnimations';
import { FEATURES } from '../constants/landingData';
import { SyncTimelineCard } from './features/SyncTimelineCard';
import { ProfitDeductionsCard } from './features/ProfitDeductionsCard';
import { StandardFeatureCard } from './features/StandardFeatureCard';

export function FeaturesSection() {
  return (
    <section id="features" className="relative py-16 sm:py-24 bg-white overflow-hidden">
      {/* Subtle dot pattern */}
      <div className="features-grid-pattern" aria-hidden="true" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
        <RevealSection>
          <div className="text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Всё, что нужно для аналитики
            </h2>
            <p className="mt-3 text-sm sm:text-base text-gray-500 max-w-xl mx-auto">
              Подключите маркетплейсы и&nbsp;получите полную картину
              бизнеса за&nbsp;пару минут
            </p>
          </div>
        </RevealSection>

        {/* Bento Grid: row1 = sync + profit, row2 = 3 standard cards */}
        <div className="mt-10 sm:mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {/* Sync Timeline */}
          <RevealSection className="sm:col-span-2 lg:col-span-1">
            <SyncTimelineCard />
          </RevealSection>

          {/* Profit + Deductions — spans 2 cols */}
          <RevealSection delay={80} className="sm:col-span-2 lg:col-span-2">
            <ProfitDeductionsCard />
          </RevealSection>

          {/* Standard cards — fill remaining grid cells */}
          {FEATURES.map((f, i) => (
            <RevealSection key={f.title} delay={(i + 2) * 80}>
              <StandardFeatureCard feature={f} />
            </RevealSection>
          ))}
        </div>
      </div>
    </section>
  );
}
