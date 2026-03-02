/**
 * Social proof: testimonial marquee with touch-swipeable rows.
 */
import { useEffect, useRef, useCallback } from 'react';
import { RevealSection } from '../hooks/useLandingAnimations';
import { TESTIMONIALS_ROW_1, TESTIMONIALS_ROW_2, MP_BADGE_STYLES } from '../constants/landingData';
import type { Testimonial } from '../types';

/* ──────────────────────────────────────────────
   TestimonialCard
   ────────────────────────────────────────────── */

function TestimonialCard({ t }: { t: Testimonial }) {
  return (
    <div className="w-[340px] sm:w-[380px] flex-shrink-0 mx-3">
      <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6 h-full flex flex-col shadow-sm hover:shadow-md transition-shadow duration-300">
        {/* Metric highlight */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg">
            <span className="text-lg font-bold text-gray-900">{t.metric}</span>
            <span className="text-xs text-gray-500">{t.metricLabel}</span>
          </div>
          <span className={`ml-auto text-[11px] px-2 py-0.5 rounded-full font-medium ring-1 ring-inset ${MP_BADGE_STYLES[t.marketplace]}`}>
            {t.marketplace}
          </span>
        </div>

        {/* Quote */}
        <p className="text-[13px] sm:text-sm leading-relaxed text-gray-600 flex-1 mb-4">
          {t.quote}
        </p>

        {/* Author */}
        <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
          <div className={`w-9 h-9 rounded-full ${t.avatarColor} flex items-center justify-center`}>
            <span className="text-xs font-semibold text-white">{t.initials}</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{t.author}</p>
            <p className="text-xs text-gray-400 truncate">{t.role} · {t.niche}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   MarqueeRow — touch-swipeable, CSS auto-scroll
   ────────────────────────────────────────────── */

function MarqueeRow({ testimonials, direction }: { testimonials: Testimonial[]; direction: 'left' | 'right' }) {
  const doubled = [...testimonials, ...testimonials];
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startOffset = useRef(0);
  const currentOffset = useRef(0);
  const resumeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const ANIMATION_DURATION = 60; // seconds, must match CSS

  /** Read current translateX from the running CSS animation or inline transform */
  const getTranslateX = useCallback(() => {
    const el = trackRef.current;
    if (!el) return 0;
    const style = window.getComputedStyle(el);
    const matrix = new DOMMatrix(style.transform);
    return matrix.m41;
  }, []);

  /** Pause CSS animation and switch to manual transform */
  const pauseAnimation = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const tx = getTranslateX();
    currentOffset.current = tx;
    el.style.animation = 'none';
    el.style.transform = `translateX(${tx}px)`;
  }, [getTranslateX]);

  /** Resume CSS animation from current offset position */
  const resumeAnimation = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const totalWidth = el.scrollWidth / 2; // half = one set of cards
    const tx = currentOffset.current;

    // Normalize offset into [0, -totalWidth) range for left, [-totalWidth, 0) for right
    let normalizedTx = tx % totalWidth;
    if (direction === 'left') {
      if (normalizedTx > 0) normalizedTx -= totalWidth;
    } else {
      if (normalizedTx < -totalWidth) normalizedTx += totalWidth;
    }
    currentOffset.current = normalizedTx;

    // Calculate what fraction of the animation cycle this offset represents
    const progress = direction === 'left'
      ? Math.abs(normalizedTx) / totalWidth
      : 1 - Math.abs(normalizedTx) / totalWidth;
    const delay = -(progress * ANIMATION_DURATION);

    el.style.transform = '';
    el.style.animation = '';
    el.classList.remove(direction === 'left' ? 'marquee-left' : 'marquee-right');

    // Force reflow to restart animation
    void el.offsetWidth;

    el.style.animationDelay = `${delay}s`;
    el.classList.add(direction === 'left' ? 'marquee-left' : 'marquee-right');
  }, [direction, ANIMATION_DURATION]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Only handle touch (not mouse on desktop - desktop uses hover pause)
    if (e.pointerType === 'mouse') return;
    dragging.current = true;
    startX.current = e.clientX;
    clearTimeout(resumeTimer.current);
    pauseAnimation();
    startOffset.current = currentOffset.current;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, [pauseAnimation]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current || e.pointerType === 'mouse') return;
    const deltaX = e.clientX - startX.current;
    const tx = startOffset.current + deltaX;
    currentOffset.current = tx;
    if (trackRef.current) {
      trackRef.current.style.transform = `translateX(${tx}px)`;
    }
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragging.current || e.pointerType === 'mouse') return;
    dragging.current = false;
    // Resume auto-scroll after 2s pause
    resumeTimer.current = setTimeout(resumeAnimation, 2000);
  }, [resumeAnimation]);

  useEffect(() => {
    return () => clearTimeout(resumeTimer.current);
  }, []);

  return (
    <div className="overflow-hidden">
      <div
        ref={trackRef}
        className={`marquee-track ${direction === 'left' ? 'marquee-left' : 'marquee-right'}`}
        style={{ touchAction: 'pan-y' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {doubled.map((t, i) => (
          <TestimonialCard key={`${t.author}-${i}`} t={t} />
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   SocialProofSection
   ────────────────────────────────────────────── */

export function SocialProofSection() {
  return (
    <section aria-label="Отзывы клиентов" className="py-14 sm:py-20 bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 mb-10 sm:mb-14">
        <RevealSection>
          <div className="text-center">
            <p className="text-sm font-medium text-indigo-600 mb-2 tracking-wide uppercase">
              Отзывы продавцов
            </p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-3">
              Что говорят те, кто уже считает прибыль
            </h2>
            <p className="text-gray-500 text-sm sm:text-base max-w-2xl mx-auto">
              Селлеры витаминов, БАДов и косметики делятся результатами работы с RevioMP
            </p>
          </div>
        </RevealSection>
      </div>

      {/* Marquee rows */}
      <div className="space-y-4 sm:space-y-6 relative">
        {/* Fade edges */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-16 sm:w-32 bg-gradient-to-r from-gray-50 to-transparent z-10" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-16 sm:w-32 bg-gradient-to-l from-gray-50 to-transparent z-10" />

        <MarqueeRow testimonials={TESTIMONIALS_ROW_1} direction="left" />
        <MarqueeRow testimonials={TESTIMONIALS_ROW_2} direction="right" />
      </div>
    </section>
  );
}
