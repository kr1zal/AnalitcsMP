/**
 * Security Trust Bar section — dark bg, glassmorphism cards, per-badge colors.
 * Rule: sublabel text-gray-400 (NOT gray-500) for WCAG accessibility on dark bg.
 */
import { Shield } from 'lucide-react';
import { RevealSection } from '../hooks/useLandingAnimations';
import { TRUST_BADGES } from '../constants/landingData';
import type { TrustBadge } from '../types';

/** Per-badge color mapping for icon bg, icon text, and hover/active glow. */
const BADGE_COLORS: Record<TrustBadge['color'], {
  iconBg: string;
  iconText: string;
  hoverRing: string;
  hoverShadow: string;
  activeRing: string;
  activeShadow: string;
}> = {
  emerald: {
    iconBg: 'bg-emerald-500/10',
    iconText: 'text-emerald-400',
    hoverRing: 'hover:ring-emerald-500/20',
    hoverShadow: 'hover:shadow-[0_0_20px_rgba(16,185,129,0.1)]',
    activeRing: 'active:ring-emerald-500/20',
    activeShadow: 'active:shadow-[0_0_20px_rgba(16,185,129,0.1)]',
  },
  sky: {
    iconBg: 'bg-sky-500/10',
    iconText: 'text-sky-400',
    hoverRing: 'hover:ring-sky-500/20',
    hoverShadow: 'hover:shadow-[0_0_20px_rgba(14,165,233,0.1)]',
    activeRing: 'active:ring-sky-500/20',
    activeShadow: 'active:shadow-[0_0_20px_rgba(14,165,233,0.1)]',
  },
  violet: {
    iconBg: 'bg-violet-500/10',
    iconText: 'text-violet-400',
    hoverRing: 'hover:ring-violet-500/20',
    hoverShadow: 'hover:shadow-[0_0_20px_rgba(139,92,246,0.1)]',
    activeRing: 'active:ring-violet-500/20',
    activeShadow: 'active:shadow-[0_0_20px_rgba(139,92,246,0.1)]',
  },
  indigo: {
    iconBg: 'bg-indigo-500/10',
    iconText: 'text-indigo-400',
    hoverRing: 'hover:ring-indigo-500/20',
    hoverShadow: 'hover:shadow-[0_0_20px_rgba(99,102,241,0.1)]',
    activeRing: 'active:ring-indigo-500/20',
    activeShadow: 'active:shadow-[0_0_20px_rgba(99,102,241,0.1)]',
  },
  amber: {
    iconBg: 'bg-amber-500/10',
    iconText: 'text-amber-400',
    hoverRing: 'hover:ring-amber-500/20',
    hoverShadow: 'hover:shadow-[0_0_20px_rgba(245,158,11,0.1)]',
    activeRing: 'active:ring-amber-500/20',
    activeShadow: 'active:shadow-[0_0_20px_rgba(245,158,11,0.1)]',
  },
};

export function SecuritySection() {
  return (
    <section id="security" className="relative py-16 sm:py-24 bg-gray-900 overflow-hidden">
      {/* Decorative grid pattern overlay */}
      <div className="security-grid-pattern" aria-hidden="true" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
        <RevealSection>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 animate-shield-pulse">
              <Shield className="w-6 h-6 text-emerald-400" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white">
              Безопасность на всех уровнях
            </h2>
          </div>
        </RevealSection>

        {/* Badges: grid-cols-2 on mobile, flex on sm+ (no orphan) */}
        <div className="mt-10 grid grid-cols-2 sm:flex sm:flex-wrap sm:justify-center gap-3 sm:gap-4">
          {TRUST_BADGES.map((badge, i) => {
            const Icon = badge.icon;
            const c = BADGE_COLORS[badge.color];
            const isLastOdd = i === TRUST_BADGES.length - 1 && TRUST_BADGES.length % 2 !== 0;
            return (
              <RevealSection key={badge.label} delay={i * 80} className={isLastOdd ? 'col-span-2 justify-self-center max-w-[calc(50%-6px)] sm:max-w-none' : ''}>
                <div
                  className={`flex flex-col items-center gap-2.5 sm:min-w-[160px] bg-white/[0.04] border border-white/[0.08] backdrop-blur-sm rounded-2xl p-5 sm:p-6 hover:ring-1 active:ring-1 ${c.hoverRing} ${c.hoverShadow} ${c.activeRing} ${c.activeShadow} transition-all duration-300`}
                >
                  <div className={`p-2.5 rounded-lg ${c.iconBg}`}>
                    <Icon className={`w-6 h-6 ${c.iconText}`} />
                  </div>
                  <span className="text-sm font-medium text-white text-center">
                    {badge.label}
                  </span>
                  <span className="text-xs text-gray-400 text-center">
                    {badge.sublabel}
                  </span>
                </div>
              </RevealSection>
            );
          })}
        </div>

        <RevealSection delay={500}>
          <p className="mt-8 text-center text-gray-300 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            API-ключи шифруются и невидимы даже нашей команде.
            Мы используем только чтение — никаких изменений на ваших аккаунтах маркетплейсов.
          </p>
        </RevealSection>
      </div>
    </section>
  );
}
