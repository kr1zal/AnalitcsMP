/**
 * "How It Works" — animated 3-step timeline.
 * Desktop (sm+): horizontal timeline with SVG dashed line.
 * Mobile: vertical timeline with connecting bar.
 */
import { STEPS } from '../constants/landingData';
import { RevealSection } from '../hooks/useLandingAnimations';
import type { StepItem } from '../types';

const COLOR_MAP: Record<StepItem['color'], {
  circle: string;
  cardBg: string;
  cardBorder: string;
  iconText: string;
}> = {
  emerald: {
    circle: 'from-emerald-500 to-emerald-600',
    cardBg: 'bg-emerald-50',
    cardBorder: 'border-emerald-100',
    iconText: 'text-emerald-600',
  },
  indigo: {
    circle: 'from-indigo-500 to-indigo-600',
    cardBg: 'bg-indigo-50',
    cardBorder: 'border-indigo-100',
    iconText: 'text-indigo-600',
  },
  violet: {
    circle: 'from-violet-500 to-violet-600',
    cardBg: 'bg-violet-50',
    cardBorder: 'border-violet-100',
    iconText: 'text-violet-600',
  },
};

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-16 sm:py-20 bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <RevealSection>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center">
            Начните за 5 минут
          </h2>
          <p className="mt-3 text-sm sm:text-base text-gray-500 text-center max-w-lg mx-auto">
            От регистрации до дашборда — без помощи технической поддержки
          </p>
        </RevealSection>

        {/* Desktop: horizontal timeline (sm+) */}
        <div className="mt-14 hidden sm:block">
          <div className="relative">
            {/* SVG animated connecting line */}
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
              <line
                x1="16.67%"
                y1="50%"
                x2="83.33%"
                y2="50%"
                stroke="url(#timeline-grad)"
                strokeWidth="2"
                strokeDasharray="6 4"
                className="animate-flow-dash"
              />
            </svg>

            {/* Steps row */}
            <div className="grid grid-cols-3 gap-6 relative">
              {STEPS.map((step, i) => (
                <RevealSection key={step.number} delay={i * 150}>
                  <DesktopStep step={step} />
                </RevealSection>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile: vertical timeline */}
        <div className="mt-10 sm:hidden">
          <div className="relative pl-10">
            {/* Vertical connecting line */}
            <div
              className="absolute left-[19px] top-6 bottom-6 w-0.5 bg-gradient-to-b from-emerald-300 via-indigo-300 to-violet-300"
              aria-hidden="true"
            />
            <div className="space-y-8">
              {STEPS.map((step, i) => (
                <RevealSection key={step.number} delay={i * 120}>
                  <MobileStep step={step} />
                </RevealSection>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Desktop step ── */
function DesktopStep({ step }: { step: StepItem }) {
  const c = COLOR_MAP[step.color];
  const Icon = step.icon;

  return (
    <div className="text-center">
      {/* Numbered circle */}
      <div className="relative inline-flex">
        <div
          className={`w-12 h-12 rounded-full bg-gradient-to-br ${c.circle} text-white flex items-center justify-center text-lg font-bold shadow-lg shadow-gray-200/50 relative z-10`}
        >
          {step.number}
        </div>
      </div>

      {/* Text */}
      <h3 className="mt-5 text-base font-semibold text-gray-900">{step.title}</h3>
      <p className="mt-1.5 text-sm text-gray-500">{step.description}</p>

      {/* Icon card */}
      <div className={`mt-4 mx-auto max-w-[220px] p-3.5 rounded-xl ${c.cardBg} border ${c.cardBorder} flex items-center gap-3`}>
        <Icon className={`w-7 h-7 ${c.iconText} shrink-0`} />
        <div className="text-left">
          <p className="text-sm font-medium text-gray-900">{step.title}</p>
          <p className="text-xs text-gray-500">{step.detail}</p>
        </div>
      </div>
    </div>
  );
}

/* ── Mobile step ── */
function MobileStep({ step }: { step: StepItem }) {
  const c = COLOR_MAP[step.color];
  const Icon = step.icon;

  return (
    <div className="relative flex gap-4">
      {/* Numbered circle */}
      <div
        className={`w-10 h-10 rounded-full bg-gradient-to-br ${c.circle} text-white flex items-center justify-center text-sm font-bold shadow-md shrink-0 -ml-10 relative z-10`}
      >
        {step.number}
      </div>

      {/* Content */}
      <div className="pt-1.5 min-w-0">
        <h3 className="text-base font-semibold text-gray-900">{step.title}</h3>
        <p className="mt-1 text-sm text-gray-500">{step.description}</p>

        {/* Icon card */}
        <div className={`mt-3 p-3 rounded-xl ${c.cardBg} border ${c.cardBorder} flex items-center gap-3`}>
          <Icon className={`w-6 h-6 ${c.iconText} shrink-0`} />
          <p className="text-xs text-gray-500">{step.detail}</p>
        </div>
      </div>
    </div>
  );
}
