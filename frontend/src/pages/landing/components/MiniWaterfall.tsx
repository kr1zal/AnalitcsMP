/**
 * CSS-only decorative mini waterfall for the Profit hero card.
 * Shows revenue -> costs -> ads = profit breakdown.
 * Animated: bars grow from 0 to target height with stagger delay 100ms.
 * No Recharts, no Framer Motion — pure CSS + IO.
 */
import { useRef, useEffect, useState } from 'react';

const SEGMENTS = [
  { label: 'Выр.', targetH: '4rem', marginTop: 'mt-0', gradient: 'from-indigo-500 to-indigo-400' },
  { label: 'Удерж.', targetH: '2.5rem', marginTop: 'mt-6', gradient: 'from-purple-500 to-purple-400' },
  { label: 'Рекл.', targetH: '1.5rem', marginTop: 'mt-10', gradient: 'from-amber-500 to-amber-400' },
  { label: 'Приб.', targetH: '3rem', marginTop: 'mt-4', gradient: 'from-emerald-500 to-emerald-400' },
] as const;

export function MiniWaterfall() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

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
    <div ref={containerRef} className="mt-4 flex items-end gap-1.5 h-20">
      {SEGMENTS.map((seg, i) => (
        <div key={seg.label} className="flex-1 flex flex-col items-center">
          <div
            className={`w-full bg-gradient-to-t ${seg.gradient} rounded-t ${seg.marginTop} ${
              revealed ? 'animate-bar-height' : 'scale-y-0'
            }`}
            style={{
              height: seg.targetH,
              transformOrigin: 'bottom',
              animationDelay: `${i * 100}ms`,
            } as React.CSSProperties}
          />
          <span className="text-xs text-gray-600 mt-1">{seg.label}</span>
        </div>
      ))}
    </div>
  );
}
