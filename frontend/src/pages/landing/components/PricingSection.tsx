/**
 * Pricing section with Free/Pro cards + comparison table.
 * Rule #16: always grid-cols-2.
 */
import { Link } from 'react-router-dom';
import { CheckCircle, XCircle } from 'lucide-react';
import { RevealSection, useSpotlight } from '../hooks/useLandingAnimations';
import { PRICING_FEATURES } from '../constants/landingData';

function FeatureValue({ value }: { value: boolean | string }) {
  if (typeof value === 'string') {
    return <span className="text-sm text-gray-700 font-medium">{value}</span>;
  }
  return value ? (
    <CheckCircle className="w-5 h-5 text-emerald-500 mx-auto" />
  ) : (
    <XCircle className="w-5 h-5 text-gray-300 mx-auto" />
  );
}

export function PricingSection() {
  const spotlightMove = useSpotlight();
  return (
    <section id="pricing" className="py-16 sm:py-20 bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <RevealSection>
          <div className="text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Простые и понятные тарифы
            </h2>
            <p className="mt-3 text-gray-500">
              Начните бесплатно - обновитесь, когда будете готовы.
            </p>
          </div>
        </RevealSection>

        <div className="mt-12 grid grid-cols-2 gap-3 sm:gap-6 max-w-2xl mx-auto">
          {/* Free */}
          <RevealSection>
            <div onMouseMove={spotlightMove} className="spotlight-card bg-white rounded-2xl border border-gray-200 p-3 sm:p-6 hover:shadow-lg transition-shadow h-full">
              <h3 className="text-base sm:text-lg font-bold text-gray-900">Free</h3>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1">Для старта</p>
              <div className="mt-3 sm:mt-5">
                <span className="text-2xl sm:text-4xl font-extrabold text-gray-900">0 ₽</span>
                <span className="text-xs sm:text-sm text-gray-500 ml-1">навсегда</span>
              </div>
              <Link
                to="/login?signup=1"
                className="mt-4 sm:mt-6 text-center px-2 sm:px-4 py-2 sm:py-3 min-h-[44px] flex items-center justify-center border border-gray-300 text-xs sm:text-sm font-semibold text-gray-700 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all"
              >
                Начать бесплатно
              </Link>
              <ul className="mt-4 sm:mt-6 space-y-2 sm:space-y-3">
                {['Дашборд с ключевыми метриками', 'WB + Ozon', 'До 15 SKU', 'Полная детализация удержаний', 'Сравнение периодов', 'Telegram сводка 1\u00D7/день', '1 ручная синхронизация/день'].map(
                  (f) => (
                    <li key={f} className="flex items-start gap-1.5 sm:gap-2.5 text-xs sm:text-sm text-gray-600">
                      <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500 mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ),
                )}
              </ul>
            </div>
          </RevealSection>

          {/* Pro */}
          <RevealSection delay={100}>
            <div onMouseMove={spotlightMove} className="spotlight-card bg-white rounded-2xl border-2 border-indigo-600 p-3 sm:p-6 relative hover:shadow-xl hover:shadow-indigo-100 transition-shadow h-full">
              <div className="absolute -top-3 sm:-top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-[10px] sm:text-xs font-semibold px-2.5 sm:px-4 py-0.5 sm:py-1 rounded-full shadow-md whitespace-nowrap">
                Рекомендуем
              </div>
              <h3 className="text-base sm:text-lg font-bold text-gray-900">Pro</h3>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1">Для растущего бизнеса</p>
              <div className="mt-3 sm:mt-5">
                <span className="text-2xl sm:text-4xl font-extrabold text-gray-900">1 490 ₽</span>
                <span className="text-xs sm:text-sm text-gray-500 ml-1">/мес</span>
              </div>
              <Link
                to="/login?signup=1&plan=pro"
                className="mt-4 sm:mt-6 text-center px-2 sm:px-4 py-2 sm:py-3 min-h-[44px] flex items-center justify-center bg-gradient-to-r from-indigo-600 to-violet-600 text-xs sm:text-sm font-semibold text-white rounded-xl hover:from-indigo-700 hover:to-violet-700 transition-all shadow-md shadow-indigo-200/50"
              >
                Попробовать Pro
              </Link>
              <ul className="mt-4 sm:mt-6 space-y-2 sm:space-y-3">
                {[
                  { text: 'Все из Free, плюс:', highlight: true },
                  { text: 'До 50 SKU', highlight: false },
                  { text: '3 ручных синхронизации/день', highlight: false },
                  { text: 'Unit-экономика + FBO/FBS', highlight: false },
                  { text: 'Реклама и ДРР', highlight: false },
                  { text: 'План продаж с прогнозом', highlight: false },
                  { text: 'PDF экспорт', highlight: false },
                  { text: 'Telegram: алерты + AI', highlight: false },
                ].map((f) => (
                  <li
                    key={f.text}
                    className={`flex items-start gap-1.5 sm:gap-2.5 text-xs sm:text-sm ${f.highlight ? 'text-indigo-600 font-semibold' : 'text-gray-600'}`}
                  >
                    {!f.highlight && <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500 mt-0.5 shrink-0" />}
                    {f.text}
                  </li>
                ))}
              </ul>
            </div>
          </RevealSection>
        </div>

        {/* Comparison table */}
        <RevealSection className="mt-12">
          <div className="overflow-x-auto">
            <table className="w-full max-w-2xl mx-auto text-sm">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-3 px-3 font-semibold text-gray-500">Функция</th>
                  <th className="text-center py-3 px-3 font-semibold text-gray-700 w-28">Free</th>
                  <th className="text-center py-3 px-3 font-semibold text-indigo-700 w-28">Pro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {PRICING_FEATURES.map((f) => (
                  <tr key={f.name} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 px-3 text-gray-600">{f.name}</td>
                    <td className="py-3 px-3 text-center">
                      <FeatureValue value={f.free} />
                    </td>
                    <td className="py-3 px-3 text-center">
                      <FeatureValue value={f.pro} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </RevealSection>
      </div>
    </section>
  );
}
