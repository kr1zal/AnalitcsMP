/**
 * Pain points section — enterprise redesign.
 *
 * Gradient top-border cards, gradient number text, pill badge header.
 * Reference: Linear.app / Stripe.com section pattern.
 */
import { ArrowDown } from 'lucide-react';
import { RevealSection } from '../hooks/useLandingAnimations';
import { PROBLEMS } from '../constants/landingData';

export function ProblemSection() {
  return (
    <section className="relative py-16 sm:py-24 bg-gradient-to-b from-gray-50 via-white to-white overflow-hidden">
      {/* Subtle dot pattern */}
      <div className="problems-dot-pattern" aria-hidden="true" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <RevealSection>
          <div className="text-center">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-600 ring-1 ring-red-200/60 mb-4">
              Проблемы селлеров
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 tracking-tight">
              Сколько стоит не&nbsp;знать свою реальную прибыль?
            </h2>
            <p className="mt-4 text-base sm:text-lg text-gray-500 max-w-xl mx-auto">
              Типичные потери селлера на маркетплейсах
            </p>
          </div>
        </RevealSection>

        {/* Problem cards */}
        <div className="mt-12 sm:mt-16 grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-6">
          {PROBLEMS.map((p, i) => (
            <RevealSection key={p.number + p.unit} delay={i * 120}>
              <div className="bg-white rounded-2xl overflow-hidden ring-1 ring-gray-900/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_6px_24px_rgba(0,0,0,0.04)] hover:shadow-[0_1px_3px_rgba(0,0,0,0.06),0_8px_32px_rgba(0,0,0,0.08)] hover:ring-gray-900/[0.08] transition-all duration-300 h-full">
                {/* Gradient top accent bar */}
                <div
                  className={`h-1 bg-gradient-to-r ${p.gradientFrom ?? 'from-gray-400'} ${p.gradientTo ?? 'to-gray-600'}`}
                />

                <div className="p-5 sm:p-6 lg:p-8">
                  {/* Number + unit */}
                  <div className="flex items-baseline gap-2">
                    <span
                      className={`text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r ${p.numberGradient ?? 'from-gray-700 to-gray-900'}`}
                    >
                      {p.number}
                    </span>
                    <span className="text-lg sm:text-xl font-semibold text-gray-400">
                      {p.unit}
                    </span>
                  </div>

                  {/* Subtitle */}
                  <h3 className="mt-4 text-base sm:text-lg font-semibold text-gray-900">
                    {p.subtitle}
                  </h3>

                  {/* Description */}
                  <p className="mt-2 text-sm sm:text-base text-gray-500 leading-relaxed">
                    {p.description}
                  </p>
                </div>
              </div>
            </RevealSection>
          ))}
        </div>

        {/* Transition CTA */}
        <RevealSection delay={400}>
          <div className="mt-12 sm:mt-16 text-center">
            <a
              href="#features"
              className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-semibold text-base sm:text-lg transition-colors duration-200 group"
            >
              <ArrowDown className="w-4 h-4 transition-transform duration-300 group-hover:translate-y-0.5" />
              RevioMP собирает все в одном месте
            </a>
          </div>
        </RevealSection>
      </div>
    </section>
  );
}
