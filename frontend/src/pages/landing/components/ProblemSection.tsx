/**
 * "Знакомо?" pain points section.
 */
import { LineChart, Eye, RefreshCw } from 'lucide-react';
import { RevealSection } from '../hooks/useLandingAnimations';

export function ProblemSection() {
  const problems = [
    {
      icon: LineChart,
      title: 'Excel и ручные расчёты',
      description: 'Часы на сбор данных из разных ЛК. Формулы ломаются, данные теряются.',
      gradient: 'from-red-500 to-rose-600',
      bg: 'bg-red-50',
    },
    {
      icon: Eye,
      title: 'Скрытые удержания МП',
      description: 'Логистика, хранение, штрафы - разбросаны по десяткам отчётов. Реальную прибыль посчитать невозможно.',
      gradient: 'from-amber-500 to-orange-600',
      bg: 'bg-amber-50',
    },
    {
      icon: RefreshCw,
      title: 'Потеря времени',
      description: 'Вместо развития бизнеса - бесконечная сверка цифр между маркетплейсами.',
      gradient: 'from-orange-500 to-red-600',
      bg: 'bg-orange-50',
    },
  ];

  return (
    <section className="py-16 sm:py-20 bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <RevealSection>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center">
            Знакомо?
          </h2>
          <p className="mt-3 text-gray-500 text-center max-w-lg mx-auto">
            Каждый продавец на маркетплейсах сталкивается с этим
          </p>
        </RevealSection>
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-6">
          {problems.map((p, i) => {
            const Icon = p.icon;
            return (
              <RevealSection key={p.title} delay={i * 100}>
                <div className={`${p.bg} border border-gray-100 rounded-2xl p-6 hover:shadow-md transition-shadow h-full`}>
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${p.gradient} flex items-center justify-center`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-gray-900">{p.title}</h3>
                  <p className="mt-2 text-sm text-gray-600 leading-relaxed">{p.description}</p>
                </div>
              </RevealSection>
            );
          })}
        </div>
      </div>
    </section>
  );
}
