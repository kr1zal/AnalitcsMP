/**
 * Stats counter bar: 4 animated metrics.
 */
import { RevealSection, AnimatedNumber } from '../hooks/useLandingAnimations';

export function StatsBar() {
  return (
    <section className="py-12 sm:py-16 bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <RevealSection>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8 text-center">
            {[
              { value: 100, suffix: '%', label: 'Точность расчётов', extra: 'Проверено аудитом' },
              { value: 15, suffix: '+', label: 'Типов отчётов', extra: 'Продажи, остатки, реклама...' },
              { value: 4, suffix: '', label: 'Синхронизации в день', extra: 'Данные всегда актуальны' },
              { value: 5, suffix: '', label: 'Минут на настройку', extra: 'API-ключ и готово' },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                  <AnimatedNumber target={stat.value} suffix={stat.suffix} />
                </p>
                <p className="mt-1 text-sm font-semibold text-gray-900">{stat.label}</p>
                <p className="text-xs text-gray-600 mt-0.5">{stat.extra}</p>
              </div>
            ))}
          </div>
        </RevealSection>
      </div>
    </section>
  );
}
