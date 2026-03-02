/**
 * Final call-to-action section with animated gradient background.
 */
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { RevealSection } from '../hooks/useLandingAnimations';

export function FinalCTASection() {
  return (
    <section className="relative py-20 sm:py-24 overflow-hidden">
      {/* Animated gradient bg */}
      <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 animate-gradient-shift" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_60%)]" />

      <div className="relative max-w-3xl mx-auto px-4 sm:px-6 text-center">
        <RevealSection>
          <h2 className="text-2xl sm:text-3xl font-bold text-white">
            Начните считать прибыль правильно
          </h2>
          <p className="mt-4 text-indigo-100 text-lg leading-relaxed">
            Подключите маркетплейсы за 2 минуты и увидите реальную картину бизнеса.
          </p>
          <Link
            to="/login?signup=1"
            className="mt-8 inline-flex items-center gap-2 px-8 py-4 bg-white text-indigo-600 font-bold rounded-xl hover:bg-indigo-50 transition-all shadow-xl hover:shadow-2xl"
          >
            Начать бесплатно <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="mt-4 text-indigo-200 text-sm">
            Бесплатно навсегда. Без привязки карты.
          </p>
        </RevealSection>
      </div>
    </section>
  );
}
