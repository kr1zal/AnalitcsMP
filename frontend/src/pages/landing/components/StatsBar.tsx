/**
 * Stats counter bar: 4 metrics with vertical dividers, hover tooltips, gradient bg.
 */
import { RevealSection } from '../hooks/useLandingAnimations';
import { STATS } from '../constants/landingData';

export function StatsBar() {
  return (
    <section className="py-16 sm:py-24 bg-gradient-to-b from-gray-50/50 to-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <RevealSection>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 sm:gap-0 text-center">
            {STATS.map((stat, i) => (
              <div
                key={stat.label}
                aria-describedby={`stat-tooltip-${i}`}
                className={`group relative py-2 ${
                  i < STATS.length - 1 ? 'sm:border-r sm:border-gray-200' : ''
                }`}
              >
                {/* Hover tooltip (desktop) */}
                <div
                  role="tooltip"
                  id={`stat-tooltip-${i}`}
                  className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:-translate-y-1 z-10"
                >
                  <span className="hidden sm:inline-block whitespace-nowrap rounded-lg bg-gray-900 px-3 py-1.5 text-xs text-white shadow-lg">
                    {stat.detail}
                  </span>
                </div>

                {/* Metric value */}
                <p className="text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent transition-transform duration-300 group-hover:scale-105">
                  {stat.value}
                </p>

                {/* Label */}
                <p className="mt-1.5 text-sm font-semibold text-gray-900">
                  {stat.label}
                </p>

                {/* Detail (mobile only — tooltip hidden on mobile) */}
                <p className="mt-0.5 text-xs text-gray-600 sm:hidden">
                  {stat.detail}
                </p>
              </div>
            ))}
          </div>
        </RevealSection>
      </div>
    </section>
  );
}
