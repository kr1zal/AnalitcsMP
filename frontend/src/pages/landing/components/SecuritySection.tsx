/**
 * "Безопасность данных" section.
 */
import { Lock, Eye, ShieldCheck } from 'lucide-react';
import { RevealSection } from '../hooks/useLandingAnimations';

export function SecuritySection() {
  const points = [
    {
      icon: Lock,
      title: 'Шифрование токенов',
      description: 'API-ключи шифруются алгоритмом Fernet и хранятся в зашифрованном виде.',
    },
    {
      icon: Eye,
      title: 'Только чтение',
      description: 'Мы используем только read-only доступ к API маркетплейсов. Никаких изменений.',
    },
    {
      icon: ShieldCheck,
      title: 'Изоляция данных',
      description: 'Row Level Security: каждый пользователь видит только свои данные.',
    },
  ];

  return (
    <section id="security" className="py-16 sm:py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <RevealSection>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center">
            Безопасность данных
          </h2>
          <p className="mt-3 text-gray-500 text-center max-w-lg mx-auto">
            Ваши данные защищены на всех уровнях
          </p>
        </RevealSection>
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-6">
          {points.map((p, i) => {
            const Icon = p.icon;
            return (
              <RevealSection key={p.title} delay={i * 100}>
                <div className="text-center bg-emerald-50/50 border border-emerald-100 rounded-2xl p-6 hover:shadow-md transition-shadow h-full">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mx-auto shadow-sm">
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
