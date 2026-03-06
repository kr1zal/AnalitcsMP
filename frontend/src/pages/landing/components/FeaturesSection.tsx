/**
 * Features Section — compact 3x2 uniform grid.
 *
 * Desktop (lg+): 3 columns x 2 rows (~320px total height)
 * Tablet/Mobile: 2 columns x 3 rows (~400px total height)
 *
 * All cards are identical size — no hero/standard distinction.
 * No CTA button — Features is informational, CTAs live in Hero + HowItWorks.
 * Spotlight glow preserved for hover interaction.
 */
import { RevealSection, useSpotlight } from '../hooks/useLandingAnimations';
import { FEATURES } from '../constants/landingData';

export function FeaturesSection() {
  const spotlightMove = useSpotlight();

  return (
    <section id="features" className="py-16 sm:py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <RevealSection>
          <div className="text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Всё, что нужно для аналитики
            </h2>
            <p className="mt-3 text-sm sm:text-base text-gray-600 max-w-xl mx-auto">
              Подключите API-токены маркетплейсов и получите полную картину
              бизнеса за минуту.
            </p>
          </div>
        </RevealSection>

        <div className="mt-10 grid grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <RevealSection key={f.title} delay={i * 60}>
                <div
                  onMouseMove={spotlightMove}
                  className="spotlight-card group relative bg-white rounded-2xl border border-gray-200/80 shadow-sm hover:shadow-xl hover:border-indigo-200 hover:-translate-y-0.5 transition-all duration-300 h-full p-4 sm:p-5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className={`w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br ${f.gradient} flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300`}
                    >
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    {f.badge && (
                      <span className="px-2 py-0.5 text-[10px] font-semibold bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-full leading-tight shrink-0">
                        {f.badge}
                      </span>
                    )}
                  </div>

                  <h3 className="mt-3 text-sm sm:text-base font-semibold text-gray-900">
                    {f.title}
                  </h3>
                  <p className="mt-1.5 text-xs sm:text-sm text-gray-600 leading-relaxed">
                    {f.description}
                  </p>
                </div>
              </RevealSection>
            );
          })}
        </div>
      </div>
    </section>
  );
}
