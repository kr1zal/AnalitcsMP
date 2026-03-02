/**
 * "Как это работает" — 3-step process.
 */
import { RevealSection } from '../hooks/useLandingAnimations';

export function HowItWorksSection() {
  const steps = [
    {
      number: '1',
      title: 'Зарегистрируйтесь',
      description: 'Создайте аккаунт за 30 секунд. Без привязки карты.',
    },
    {
      number: '2',
      title: 'Добавьте API-токены',
      description: 'Подключите WB и Ozon через API-ключи из личных кабинетов.',
    },
    {
      number: '3',
      title: 'Получайте аналитику',
      description: 'Данные загрузятся автоматически. Дашборд готов через 2-3 минуты.',
    },
  ];

  return (
    <section id="how-it-works" className="py-16 sm:py-20 bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <RevealSection>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center">
            Как это работает
          </h2>
        </RevealSection>
        <div className="mt-12 relative">
          {/* Connecting line (desktop) */}
          <div className="hidden sm:block absolute top-6 left-[16.67%] right-[16.67%] h-0.5 bg-gradient-to-r from-indigo-200 via-indigo-400 to-indigo-200" />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-6 relative">
            {steps.map((step, i) => (
              <RevealSection key={step.number} delay={i * 120}>
                <div className="text-center">
                  <div className="relative inline-flex">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white flex items-center justify-center text-lg font-bold shadow-lg shadow-indigo-200/50 relative z-10">
                      {step.number}
                    </div>
                  </div>
                  <h3 className="mt-5 text-base font-semibold text-gray-900">{step.title}</h3>
                  <p className="mt-2 text-sm text-gray-600 max-w-xs mx-auto">{step.description}</p>
                </div>
              </RevealSection>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
