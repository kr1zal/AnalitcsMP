/**
 * Shared animation hooks and utility components for the landing page.
 */
import { useState, useEffect, useRef, useCallback, type ReactNode, type MouseEvent } from 'react';
import React from 'react';

/* ──────────────────────────────────────────────
   useRevealOnScroll — IntersectionObserver-based reveal
   ────────────────────────────────────────────── */

export function useRevealOnScroll(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Elements already in viewport on load - reveal immediately, no animation
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      el.classList.add('revealed', 'no-transition');
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('revealed');
          observer.unobserve(el);
        }
      },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return ref;
}

/* ──────────────────────────────────────────────
   RevealSection — wrapper that fades-up on scroll
   ────────────────────────────────────────────── */

export function RevealSection({
  children,
  className = '',
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRevealOnScroll();
  return React.createElement(
    'div',
    {
      ref,
      className: `reveal-on-scroll ${className}`,
      style: delay ? { transitionDelay: `${delay}ms` } : undefined,
    },
    children,
  );
}

/* ──────────────────────────────────────────────
   AnimatedNumber — counts up when visible
   ────────────────────────────────────────────── */

export function AnimatedNumber({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const duration = 1400;
          const start = performance.now();
          const tick = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setValue(Math.round(eased * target));
            if (progress < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          observer.unobserve(el);
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target]);

  return React.createElement(
    'span',
    { ref },
    value.toLocaleString('ru-RU'),
    suffix,
  );
}

/* ──────────────────────────────────────────────
   SectionDivider — thin line between sections (Stripe-style)
   ────────────────────────────────────────────── */

export function SectionDivider() {
  return React.createElement(
    'div',
    { className: 'max-w-6xl mx-auto' },
    React.createElement('div', { className: 'h-px bg-gray-200' }),
  );
}

/* ──────────────────────────────────────────────
   useSpotlight — mouse tracking for spotlight cards
   ────────────────────────────────────────────── */

export function useSpotlight() {
  const onMouseMove = useCallback((e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
    e.currentTarget.style.setProperty('--mouse-y', `${y}px`);
  }, []);
  return onMouseMove;
}

/* ──────────────────────────────────────────────
   useHoverOrScroll — hover on desktop, IntersectionObserver on touch
   Clerk-style: pointerEnter/Leave toggles active (desktop),
   one-shot scroll trigger (mobile/touch).
   ────────────────────────────────────────────── */

export function useHoverOrScroll(threshold = 0.3) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const canHover = useRef(
    typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches,
  );
  const reducedMotion = useRef(
    typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  // Reduced motion → always visible
  useEffect(() => {
    if (reducedMotion.current) setActive(true);
  }, []);

  // Touch devices → IntersectionObserver (toggle on enter/leave viewport)
  useEffect(() => {
    if (canHover.current || reducedMotion.current) return;
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setActive(entry.isIntersecting),
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  const pointerHandlers =
    canHover.current && !reducedMotion.current
      ? {
          onPointerEnter: () => setActive(true),
          onPointerLeave: () => setActive(false),
        }
      : {};

  return { ref, active, pointerHandlers };
}
