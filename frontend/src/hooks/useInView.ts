import { useEffect, useRef, useState, type RefObject } from 'react';

type UseInViewOptions = IntersectionObserverInit & {
  /**
   * If true, stops observing after first time it becomes visible.
   */
  once?: boolean;
};

export function useInView<T extends Element>(options?: UseInViewOptions): { ref: RefObject<T | null>; inView: boolean } {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // If IntersectionObserver is unavailable, treat as visible (best-effort).
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }

    const once = options?.once ?? false;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        const isVisible = Boolean(entry?.isIntersecting);
        if (isVisible) {
          setInView(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      {
        root: options?.root ?? null,
        rootMargin: options?.rootMargin ?? '0px',
        threshold: options?.threshold ?? 0,
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [options?.root, options?.rootMargin, options?.threshold, options?.once]);

  return { ref, inView };
}

