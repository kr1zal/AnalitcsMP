/**
 * "Всё что нужно" feature cards with spotlight hover effect.
 */
import {
  BarChart3,
  TrendingUp,
  PieChart,
  ClipboardList,
  RefreshCw,
  Megaphone,
} from 'lucide-react';
import { RevealSection, useSpotlight } from '../hooks/useLandingAnimations';

export function FeaturesSection() {
  const spotlightMove = useSpotlight();
  const features = [
    {
      icon: BarChart3,
      title: 'Дашборд',
      description: 'Все ключевые метрики на одном экране: выручка, прибыль, возвраты, ДРР.',
      gradient: 'from-indigo-500 to-indigo-600',
    },
    {
      icon: TrendingUp,
      title: 'Реальная прибыль',
      description: 'Автоматический расчёт чистой прибыли с учётом ВСЕХ удержаний маркетплейсов.',
      gradient: 'from-emerald-500 to-emerald-600',
    },
    {
      icon: PieChart,
      title: 'Дерево удержаний',
      description: 'Детализация расходов: комиссии, логистика, хранение, штрафы - как в ЛК, но нагляднее.',
      gradient: 'from-violet-500 to-violet-600',
    },
    {
      icon: ClipboardList,
      title: 'Монитор заказов',
      description: 'Позаказная детализация с реальными ценами после скидок и полной разбивкой издержек.',
      gradient: 'from-blue-500 to-blue-600',
    },
    {
      icon: RefreshCw,
      title: 'Авто-синхронизация',
      description: 'Данные обновляются автоматически до 4 раз в день. Без ручных выгрузок.',
      gradient: 'from-cyan-500 to-cyan-600',
    },
    {
      icon: Megaphone,
      title: 'Рекламная аналитика',
      description: 'Расходы на рекламу, ДРР по дням, ROI кампаний - WB и Ozon в одном месте.',
      gradient: 'from-amber-500 to-amber-600',
    },
  ];

  return (
    <section id="features" className="py-16 sm:py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <RevealSection>
          <div className="text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Всё, что нужно для аналитики
            </h2>
            <p className="mt-3 text-gray-500 max-w-xl mx-auto">
              Подключите API-токены маркетплейсов и получите полную картину бизнеса за минуту.
            </p>
          </div>
        </RevealSection>
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <RevealSection key={f.title} delay={i * 80}>
                <div
                  onMouseMove={spotlightMove}
                  className="spotlight-card group bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg hover:border-indigo-100 transition-all duration-300 h-full"
                >
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${f.gradient} flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-gray-900">{f.title}</h3>
                  <p className="mt-2 text-sm text-gray-600 leading-relaxed">{f.description}</p>
                </div>
              </RevealSection>
            );
          })}
        </div>
      </div>
    </section>
  );
}
