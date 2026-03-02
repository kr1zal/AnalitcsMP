/**
 * Landing page hero section.
 * Text hero with badge, H1, subheadline, CTA + trust text.
 * Rule #45: text hero WITHOUT screenshot.
 */
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export function HeroSection() {
  return (
    <section className="relative pt-6 pb-16 sm:pt-8 sm:pb-20 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-50/60 via-white to-white" />

      {/* MatrixRain removed (24.02.2026) - irrelevant decoration, 2000s aesthetic */}

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 text-center">
        {/* Badge */}
        <div className="animate-fade-up inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-50 border border-indigo-100 rounded-full mb-10 sm:mb-14">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-medium text-indigo-700">
            WB + Ozon в одном дашборде
          </span>
        </div>

        {/* H1 */}
        <h1 className="animate-fade-up delay-100 text-[44px] sm:text-[64px] lg:text-[76px] font-extrabold leading-[1.08] tracking-tight max-w-4xl mx-auto">
          <span className="text-gray-900">Прозрачная аналитика</span>
          <br />
          <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
            для маркетплейсов
          </span>
        </h1>

        {/* Subheadline - 2 lines max on desktop */}
        <p className="animate-fade-up delay-200 mt-5 text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
          Выручка, прибыль, удержания, реклама и&nbsp;остатки - в&nbsp;реальном времени.
          Собери свой дашборд из&nbsp;виджетов за&nbsp;5 минут.
        </p>

        {/* CTA + trust inline */}
        <div className="animate-fade-up delay-300 mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/login?signup=1"
            className="group inline-flex items-center gap-2 px-7 py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold rounded-xl hover:from-indigo-700 hover:to-violet-700 transition-all shadow-lg shadow-indigo-200/50 hover:shadow-xl hover:shadow-indigo-300/50"
          >
            Начать бесплатно
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <span className="text-sm text-gray-400">
            Бесплатно навсегда. Без привязки карты.
          </span>
        </div>
      </div>
    </section>
  );
}
