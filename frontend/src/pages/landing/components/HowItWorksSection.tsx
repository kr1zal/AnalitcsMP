/**
 * "How It Works" — animated 3-step timeline.
 * Desktop (sm+): horizontal timeline with SVG dashed line + backdrop.
 * Mobile: vertical timeline with connecting bar.
 *
 * Changes from previous version:
 * - Removed title duplication in icon cards (card = ONLY icon + detail)
 * - Added glow ring-4 on circles
 * - SVG line strokeWidth 3 + pale backdrop line
 * - Icon cards w-full max-w-[260px] min-h-[64px]
 * - CTA button after steps
 * - Circle pop-in animation (CSS animate-circle-pop)
 * - Mobile circles w-11 h-11, pl-12
 * - Subtitle text-base sm:text-lg
 */
import { ArrowRight } from 'lucide-react';
import { STEPS } from '../constants/landingData';
import { RevealSection } from '../hooks/useLandingAnimations';
import type { StepItem } from '../types';

const COLOR_MAP: Record<StepItem['color'], {
  circle: string;
  ring: string;
  cardBg: string;
  cardBorder: string;
  iconText: string;
}> = {
  emerald: {
    circle: 'from-emerald-500 to-emerald-600',
    ring: 'ring-emerald-100',
    cardBg: 'bg-emerald-50',
    cardBorder: 'border-emerald-100',
    iconText: 'text-emerald-600',
  },
  indigo: {
    circle: 'from-indigo-500 to-indigo-600',
    ring: 'ring-indigo-100',
    cardBg: 'bg-indigo-50',
    cardBorder: 'border-indigo-100',
    iconText: 'text-indigo-600',
  },
  violet: {
    circle: 'from-violet-500 to-violet-600',
    ring: 'ring-violet-100',
    cardBg: 'bg-violet-50',
    cardBorder: 'border-violet-100',
    iconText: 'text-violet-600',
  },
};

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-16 sm:py-24 bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <RevealSection>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 text-center">
            Начните за 5 минут
          </h2>
          <p className="mt-3 text-base sm:text-lg text-gray-600 text-center max-w-lg mx-auto">
            От регистрации до дашборда — без помощи технической поддержки
          </p>
        </RevealSection>

        {/* Desktop: horizontal timeline (sm+) */}
        <div className="mt-14 hidden sm:block">
          <div className="relative">
            {/* SVG animated connecting line with backdrop */}
            <svg
              className="absolute top-6 left-0 w-full h-3 pointer-events-none"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="timeline-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="50%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
              {/* Pale backdrop line */}
              <line
                x1="16.67%"
                y1="50%"
                x2="83.33%"
                y2="50%"
                stroke="#e5e7eb"
                strokeWidth="3"
              />
              {/* Animated gradient line on top */}
              <line
                x1="16.67%"
                y1="50%"
                x2="83.33%"
                y2="50%"
                stroke="url(#timeline-grad)"
                strokeWidth="3"
                strokeDasharray="6 4"
                className="animate-flow-dash"
              />
            </svg>

            {/* Steps row */}
            <div className="grid grid-cols-3 gap-6 relative">
              {STEPS.map((step, i) => (
                <RevealSection key={step.number} delay={i * 150}>
                  <DesktopStep step={step} index={i} />
                </RevealSection>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile: vertical timeline */}
        <div className="mt-10 sm:hidden">
          <div className="relative pl-12">
            {/* Vertical connecting line */}
            <div
              className="absolute left-[21px] top-6 bottom-6 w-0.5 bg-gradient-to-b from-emerald-300 via-indigo-300 to-violet-300"
              aria-hidden="true"
            />
            <div className="space-y-8">
              {STEPS.map((step, i) => (
                <RevealSection key={step.number} delay={i * 120}>
                  <MobileStep step={step} index={i} />
                </RevealSection>
              ))}
            </div>
          </div>
        </div>

        {/* CTA button */}
        <RevealSection delay={600}>
          <div className="mt-12 text-center">
            <a
              href="/signup"
              className="inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-700 font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 rounded"
            >
              Начать бесплатно
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </a>
          </div>
        </RevealSection>
      </div>
    </section>
  );
}

/* -- Desktop step -- */
function DesktopStep({ step, index }: { step: StepItem; index: number }) {
  const c = COLOR_MAP[step.color];
  const Icon = step.icon;

  return (
    <div className="text-center">
      {/* Numbered circle with glow ring + pop-in animation */}
      <div className="relative inline-flex">
        <div
          className={`w-12 h-12 rounded-full bg-gradient-to-br ${c.circle} text-white flex items-center justify-center text-lg font-bold shadow-lg shadow-gray-200/50 relative z-10 ring-4 ${c.ring} animate-circle-pop`}
          style={{ animationDelay: `${index * 150 + 200}ms` }}
        >
          {step.number}
        </div>
      </div>

      {/* Text */}
      <h3 className="mt-5 text-base font-semibold text-gray-900">{step.title}</h3>
      <p className="mt-1.5 text-sm text-gray-600">{step.description}</p>

      {/* Icon card — ONLY icon + detail (NO title duplication) */}
      <div className={`mt-4 mx-auto w-full max-w-[260px] p-3.5 rounded-xl ${c.cardBg} border ${c.cardBorder} min-h-[64px] flex items-center gap-3`}>
        <Icon className={`w-7 h-7 ${c.iconText} shrink-0`} />
        <p className="text-xs text-gray-600 text-left">{step.detail}</p>
      </div>
    </div>
  );
}

/* -- Mobile step -- */
function MobileStep({ step, index }: { step: StepItem; index: number }) {
  const c = COLOR_MAP[step.color];
  const Icon = step.icon;

  return (
    <div className="relative flex gap-4">
      {/* Numbered circle with glow ring + pop-in */}
      <div
        className={`w-11 h-11 rounded-full bg-gradient-to-br ${c.circle} text-white flex items-center justify-center text-sm font-bold shadow-md shrink-0 -ml-12 relative z-10 ring-4 ${c.ring} animate-circle-pop`}
        style={{ animationDelay: `${index * 120 + 200}ms` }}
      >
        {step.number}
      </div>

      {/* Content */}
      <div className="pt-1.5 min-w-0">
        <h3 className="text-base font-semibold text-gray-900">{step.title}</h3>
        <p className="mt-1 text-sm text-gray-600">{step.description}</p>

        {/* Icon card */}
        <div className={`mt-3 p-3 rounded-xl ${c.cardBg} border ${c.cardBorder} min-h-[56px] flex items-center gap-3`}>
          <Icon className={`w-6 h-6 ${c.iconText} shrink-0`} />
          <p className="text-xs text-gray-600">{step.detail}</p>
        </div>
      </div>
    </div>
  );
}
