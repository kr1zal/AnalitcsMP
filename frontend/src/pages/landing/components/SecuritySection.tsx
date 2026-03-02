/**
 * Security Trust Bar section — dark bg, 5 trust badges, user-facing description.
 */
import { Shield } from 'lucide-react';
import { RevealSection } from '../hooks/useLandingAnimations';
import { TRUST_BADGES } from '../constants/landingData';

export function SecuritySection() {
  return (
    <section id="security" className="py-16 sm:py-20 bg-gray-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <RevealSection>
          <div className="flex items-center justify-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10">
              <Shield className="w-6 h-6 text-emerald-400" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              Безопасность на всех уровнях
            </h2>
          </div>
        </RevealSection>

        <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {TRUST_BADGES.map((badge, i) => {
            const Icon = badge.icon;
            return (
              <RevealSection key={badge.label} delay={i * 80}>
                <div className="flex flex-col items-center gap-2 p-3 sm:p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors duration-200">
                  <div className="p-2 rounded-lg bg-emerald-500/10">
                    <Icon className="w-5 h-5 text-emerald-400" />
                  </div>
                  <span className="text-sm font-medium text-white text-center">
                    {badge.label}
                  </span>
                  <span className="text-xs text-gray-500 text-center">
                    {badge.sublabel}
                  </span>
                </div>
              </RevealSection>
            );
          })}
        </div>

        <RevealSection delay={500}>
          <p className="mt-8 text-center text-gray-400 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
            API-ключи шифруются и невидимы даже нашей команде.
            Мы используем только чтение — никаких изменений на ваших аккаунтах маркетплейсов.
          </p>
        </RevealSection>
      </div>
    </section>
  );
}
