/**
 * Pain points section with large numbers, accent borders, and transition CTA.
 */
import { AlertTriangle, ArrowDown } from 'lucide-react';
import { RevealSection } from '../hooks/useLandingAnimations';
import { PROBLEMS } from '../constants/landingData';

export function ProblemSection() {
  return (
    <section className="py-16 sm:py-24 bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <RevealSection>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 text-center">
            Сколько стоит не знать свою реальную прибыль?
          </h2>
          <p className="mt-3 text-gray-600 text-center max-w-xl mx-auto text-sm sm:text-base">
            Типичные потери селлера на маркетплейсах
          </p>
        </RevealSection>

        {/* Problem cards */}
        <div className="mt-10 sm:mt-14 grid grid-cols-1 sm:grid-cols-3 gap-6">
          {PROBLEMS.map((p, i) => (
            <RevealSection key={p.number + p.unit} delay={i * 120}>
              <div
                className={`${p.bgColor} border border-gray-100 border-l-4 ${p.accentColor} rounded-2xl p-6 hover:shadow-md transition-all duration-300 h-full`}
              >
                {/* Number + warning icon */}
                <div className="flex items-baseline gap-2">
                  <AlertTriangle className="w-5 h-5 text-gray-400 shrink-0 relative top-0.5" />
                  <div>
                    <span className="text-3xl sm:text-4xl font-black text-gray-900">
                      {p.number}
                    </span>
                    <span className="ml-1.5 text-lg sm:text-xl font-semibold text-gray-600">
                      {p.unit}
                    </span>
                  </div>
                </div>

                {/* Subtitle */}
                <h3 className="mt-3 text-base font-semibold text-gray-900">
                  {p.subtitle}
                </h3>

                {/* Description */}
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                  {p.description}
                </p>
              </div>
            </RevealSection>
          ))}
        </div>

        {/* Transition CTA */}
        <RevealSection delay={400}>
          <div className="mt-10 sm:mt-14 text-center">
            <a
              href="#features"
              className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-semibold text-sm sm:text-base transition-colors duration-200 group"
            >
              <ArrowDown className="w-4 h-4 transition-transform duration-300 group-hover:translate-y-0.5" />
              RevioMP собирает всё в одном месте
            </a>
          </div>
        </RevealSection>
      </div>
    </section>
  );
}
