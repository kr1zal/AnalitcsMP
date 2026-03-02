/**
 * Features Bento Grid — enterprise layout (Linear/Vercel pattern).
 *
 * Desktop (lg+): 4-column grid with two hero cards (Dashboard 2x2, Profit 1x2)
 * Tablet (md): 2-column uniform grid
 * Mobile: stacked, first two full-width, rest in 2-column pairs
 *
 * Decorative visuals: MiniChart (dashboard) + MiniWaterfall (profit) — CSS-only.
 * Spotlight glow preserved from previous version.
 */
import { RevealSection, useSpotlight } from '../hooks/useLandingAnimations';
import { FEATURES } from '../constants/landingData';
import { MiniChart } from './MiniChart';
import { MiniWaterfall } from './MiniWaterfall';

/** Maps visual type to its decorative sub-component. */
function VisualBlock({ visual }: { visual: 'chart' | 'waterfall' | null }) {
  if (visual === 'chart') return <MiniChart />;
  if (visual === 'waterfall') return <MiniWaterfall />;
  return null;
}

/**
 * Grid class for each card position.
 * Index 0 (Dashboard): 2 cols x 2 rows on lg
 * Index 1 (Profit):    1 col  x 2 rows on lg
 */
function gridSpan(index: number): string {
  if (index === 0) return 'sm:col-span-2 lg:col-span-2 lg:row-span-2';
  if (index === 1) return 'lg:row-span-2';
  return '';
}

export function FeaturesSection() {
  const spotlightMove = useSpotlight();

  return (
    <section id="features" className="py-16 sm:py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <RevealSection>
          <div className="text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Всё, что нужно для аналитики
            </h2>
            <p className="mt-3 text-gray-500 max-w-xl mx-auto">
              Подключите API-токены маркетплейсов и получите полную картину
              бизнеса за минуту.
            </p>
          </div>
        </RevealSection>

        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            const isHero = f.size === 'hero';

            return (
              <RevealSection
                key={f.title}
                delay={i * 80}
                className={gridSpan(i)}
              >
                <div
                  onMouseMove={spotlightMove}
                  className={`spotlight-card group relative bg-white rounded-2xl border border-gray-100 hover:shadow-lg hover:border-indigo-100 transition-all duration-300 h-full ${
                    isHero ? 'p-6 sm:p-8' : 'p-6'
                  }`}
                >
                  {/* Pro badge */}
                  {f.badge && (
                    <span className="absolute top-3 right-3 px-2 py-0.5 text-[10px] font-semibold bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-full">
                      {f.badge}
                    </span>
                  )}

                  {/* Icon */}
                  <div
                    className={`${
                      isHero ? 'w-12 h-12' : 'w-11 h-11'
                    } rounded-xl bg-gradient-to-br ${f.gradient} flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300`}
                  >
                    <Icon className={isHero ? 'w-6 h-6 text-white' : 'w-5 h-5 text-white'} />
                  </div>

                  {/* Text */}
                  <h3
                    className={`mt-4 font-semibold text-gray-900 ${
                      isHero ? 'text-lg' : 'text-base'
                    }`}
                  >
                    {f.title}
                  </h3>
                  <p
                    className={`mt-2 text-gray-600 leading-relaxed ${
                      isHero ? 'text-sm sm:text-base' : 'text-sm'
                    }`}
                  >
                    {f.description}
                  </p>

                  {/* Decorative visual (hero cards only) */}
                  <VisualBlock visual={f.visual} />
                </div>
              </RevealSection>
            );
          })}
        </div>

        {/* Transition CTA */}
        <RevealSection>
          <div className="mt-10 text-center">
            <a
              href="#dataflow"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              Посмотреть как это работает &rarr;
            </a>
          </div>
        </RevealSection>
      </div>
    </section>
  );
}
