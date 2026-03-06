/**
 * CSS-only decorative mini bar chart for the Dashboard hero card.
 * Animated: bars grow from 0 to target width via IntersectionObserver.
 * Numeric values shown to the right of each bar.
 * No Recharts, no Framer Motion — pure CSS + IO.
 */
import { useRef, useEffect, useState } from 'react';

const BARS = [
  { label: 'Выручка', target: 85, value: '1.2M', gradient: 'from-indigo-500 to-violet-500' },
  { label: 'Прибыль', target: 62, value: '340K', gradient: 'from-emerald-500 to-green-500' },
  { label: 'Расходы', target: 38, value: '860K', gradient: 'from-purple-500 to-violet-500' },
] as const;

export function MiniChart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // If already in viewport on mount — reveal immediately
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      setRevealed(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="mt-4 space-y-2.5">
      {BARS.map((bar, i) => (
        <div key={bar.label} className="flex items-center gap-2">
          <span className="text-xs text-gray-600 w-16 shrink-0">{bar.label}</span>
          <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full bg-gradient-to-r ${bar.gradient} rounded-full ${
                revealed ? 'animate-bar-width' : 'scale-x-0'
              }`}
              style={{
                width: `${bar.target}%`,
                transformOrigin: 'left',
                animationDelay: `${i * 120}ms`,
              } as React.CSSProperties}
            />
          </div>
          <span className={`text-xs font-medium text-gray-600 w-10 text-right transition-opacity duration-500 ${
            revealed ? 'opacity-100' : 'opacity-0'
          }`}
            style={{ transitionDelay: `${i * 120 + 400}ms` }}
          >
            {bar.value}
          </span>
        </div>
      ))}
    </div>
  );
}
