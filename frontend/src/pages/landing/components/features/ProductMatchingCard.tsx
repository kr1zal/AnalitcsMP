/**
 * Product Matching Card — unique cross-marketplace product linking.
 *
 * Phase-based cinematic animation with animated cursor:
 * Phase 1: Products appear, Ozon offset (scattered)
 * Phase 2-7: Cursor drags each Ozon product into alignment, locks click
 * Phase 8: Prices type in character-by-character
 * Phase 9: Result badge pops
 *
 * Cursor visible on sm+ only (desktop). Mobile gets the same animation sans cursor.
 */
import { Link2 } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import { useHoverOrScroll } from '../../hooks/useLandingAnimations';

/* ── Data ── */

const PRODUCTS = [
  { wb: 'Витамин D3', ozon: 'Витамин Д3', price: '450' },
  { wb: 'Омега-3', ozon: 'Омега-3 900', price: '380' },
  { wb: 'Магний B6', ozon: 'Магний Б6', price: '290' },
] as const;

/* ── Phase timeline (ms after active=true) ── */
// 0: inactive
// 1: products appear, ozon offset
// 2: cursor at ozon row 0
// 3: row 0 dragged into alignment, lock 0 clicks
// 4: cursor at ozon row 1
// 5: row 1 aligned, lock 1 clicks
// 6: cursor at ozon row 2
// 7: row 2 aligned, lock 2 clicks
// 8: cursor at prices, typing starts
// 9: result pops

const PHASE_DELAYS = [100, 500, 900, 1200, 1600, 1900, 2300, 2700, 3400];

/* ── Cursor positions (% of table container) ── */

const CURSOR_POS: Record<number, { x: number; y: number; vis: boolean }> = {
  0: { x: 0, y: 0, vis: false },
  1: { x: 0, y: 0, vis: false },
  2: { x: 70, y: 34, vis: true },   // at first Ozon
  3: { x: 44, y: 34, vis: true },   // dragged to lock
  4: { x: 70, y: 56, vis: true },   // at second Ozon
  5: { x: 44, y: 56, vis: true },   // dragged
  6: { x: 70, y: 78, vis: true },   // at third Ozon
  7: { x: 44, y: 78, vis: true },   // dragged
  8: { x: 88, y: 34, vis: true },   // at prices
  9: { x: 88, y: 78, vis: false },  // fade out
};

/* ── Style helpers ── */

const wbName = (i: number, ph: number): CSSProperties => {
  const on = ph >= 1;
  return {
    opacity: on ? 1 : 0,
    filter: on ? 'blur(0px)' : 'blur(6px)',
    transition: on
      ? `opacity 0.35s ease ${i * 0.08 + 0.05}s, filter 0.35s ease ${i * 0.08 + 0.05}s`
      : 'opacity 0.15s ease, filter 0.15s ease',
  };
};

const ozonName = (i: number, ph: number): CSSProperties => {
  const appeared = ph >= 1;
  const aligned = ph >= 3 + i * 2;
  return {
    opacity: appeared ? 1 : 0,
    filter: appeared ? 'blur(0px)' : 'blur(6px)',
    transform: aligned ? 'translateX(0)' : 'translateX(14px)',
    transition: appeared
      ? 'opacity 0.35s ease, filter 0.35s ease, transform 0.4s cubic-bezier(0.22,1,0.36,1)'
      : 'opacity 0.15s ease, filter 0.15s ease, transform 0.15s ease',
  };
};

const lockClosed = (i: number, ph: number): CSSProperties => {
  const on = ph >= 3 + i * 2;
  return {
    opacity: on ? 1 : 0,
    transform: on ? 'scale(1)' : 'scale(0.5)',
    transition: on
      ? 'opacity 0.25s ease 0.1s, transform 0.25s cubic-bezier(0.34,1.56,0.64,1) 0.1s'
      : 'opacity 0.12s ease, transform 0.12s ease',
  };
};

const lockOpen = (i: number, ph: number): CSSProperties => {
  const closed = ph >= 3 + i * 2;
  return {
    opacity: closed ? 0 : (ph >= 1 ? 0.45 : 0),
    transition: closed ? 'opacity 0.12s ease' : 'opacity 0.3s ease 0.1s',
  };
};

const skel = (ph: number): CSSProperties => ({
  opacity: ph >= 1 ? 0 : 0.55,
  transition: ph >= 1 ? 'opacity 0.15s ease' : 'opacity 0.35s ease 0.18s',
});

const resultBadge = (ph: number): CSSProperties => {
  const on = ph >= 9;
  return {
    opacity: on ? 1 : 0,
    transform: on ? 'scale(1)' : 'scale(0.92)',
    filter: on ? 'blur(0px)' : 'blur(4px)',
    transition: on
      ? 'opacity 0.5s ease 0.1s, transform 0.5s cubic-bezier(0.22,1,0.36,1) 0.1s, filter 0.5s ease 0.1s'
      : 'opacity 0.15s ease, transform 0.15s ease, filter 0.15s ease',
  };
};

/* ── Typed value — character-by-character reveal ── */

function TypedPrice({ value, visible, rowDelay }: {
  value: string;
  visible: boolean;
  rowDelay: number;
}) {
  return (
    <>
      {[...value].map((char, ci) => (
        <span
          key={ci}
          style={{
            opacity: visible ? 1 : 0,
            transition: visible
              ? `opacity 0.08s ease ${rowDelay + ci * 0.1}s`
              : 'opacity 0.08s ease',
          }}
        >
          {char}
        </span>
      ))}
    </>
  );
}

/* ── Component ── */

export function ProductMatchingCard() {
  const { ref, active, pointerHandlers } = useHoverOrScroll();
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!active) {
      setPhase(0);
      return;
    }

    const timers = PHASE_DELAYS.map((delay, i) =>
      setTimeout(() => setPhase(i + 1), delay),
    );

    return () => timers.forEach(clearTimeout);
  }, [active]);

  const cur = CURSOR_POS[phase] ?? CURSOR_POS[0];

  return (
    <div
      ref={ref}
      {...pointerHandlers}
      className="relative bg-white rounded-2xl ring-1 ring-gray-900/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_32px_rgba(0,0,0,0.06)] p-5 sm:p-6 h-full overflow-hidden cursor-default"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-sm">
          <Link2 className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-gray-900">Мэтчинг товаров</h3>
          <p className="text-xs text-gray-500 leading-snug">
            Свяжите товары WB и&nbsp;Ozon в&nbsp;1&nbsp;клик
          </p>
        </div>
        <span
          className="px-2 py-0.5 text-[10px] font-semibold bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white rounded-full leading-tight shrink-0"
          style={{
            boxShadow: phase >= 9 ? '0 0 12px rgba(139,92,246,0.3)' : 'none',
            transition: 'box-shadow 0.4s ease',
          }}
        >
          Эксклюзив
        </span>
      </div>

      {/* Matching table */}
      <div className="relative bg-gradient-to-br from-gray-50/80 to-gray-50/40 rounded-xl p-3 sm:p-4 ring-1 ring-gray-900/[0.04]">
        {/* Animated cursor (desktop only) */}
        <div
          className="absolute pointer-events-none z-10 hidden sm:block"
          style={{
            left: `${cur.x}%`,
            top: `${cur.y}%`,
            opacity: cur.vis ? 1 : 0,
            transition: 'left 0.35s cubic-bezier(0.22,1,0.36,1), top 0.35s cubic-bezier(0.22,1,0.36,1), opacity 0.2s ease',
          }}
        >
          <svg
            width="16"
            height="20"
            viewBox="0 0 16 20"
            fill="none"
            style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.2))' }}
          >
            <path
              d="M1 1L1 15.5L4.5 11.5L8 19L10.5 18L7 10.5L12.5 10.5L1 1Z"
              fill="white"
              stroke="#374151"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Column headers */}
        <div className="flex items-center gap-1.5 sm:gap-2 mb-3 px-0.5">
          <span className="flex-1 text-[10px] uppercase tracking-wider text-violet-500/70 font-semibold">
            Wildberries
          </span>
          <div className="w-[22px] shrink-0" />
          <span className="flex-1 text-[10px] uppercase tracking-wider text-blue-500/70 font-semibold">
            Ozon
          </span>
          <span className="w-9 sm:w-10 text-[10px] uppercase tracking-wider text-gray-400 font-semibold text-right shrink-0">
            Цена
          </span>
        </div>

        {/* Product rows */}
        <div className="space-y-3">
          {PRODUCTS.map((p, i) => (
            <div key={i} className="flex items-center gap-1.5 sm:gap-2">
              {/* WB name */}
              <div className="flex-1 min-w-0 relative h-[18px]">
                <div
                  className="h-3 w-[60px] rounded bg-gray-200/60 absolute top-[3px]"
                  style={skel(phase)}
                  aria-hidden="true"
                />
                <span
                  className="absolute inset-0 flex items-center text-[12px] sm:text-[13px] text-gray-700 font-medium truncate"
                  style={wbName(i, phase)}
                >
                  {p.wb}
                </span>
              </div>

              {/* Lock */}
              <div className="relative w-[22px] h-[22px] shrink-0 flex items-center justify-center">
                {/* Open */}
                <svg
                  viewBox="0 0 22 22"
                  className="w-[18px] h-[18px] absolute"
                  style={lockOpen(i, phase)}
                >
                  <rect x="4" y="12" width="14" height="8" rx="2" fill="none" stroke="#d1d5db" strokeWidth="1.5" />
                  <path d="M7.5 12V8.5a3.5 3.5 0 0 1 7 0" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                {/* Closed */}
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={lockClosed(i, phase)}
                >
                  <svg viewBox="0 0 22 22" className="w-[18px] h-[18px]">
                    <rect x="4" y="12" width="14" height="8" rx="2" fill="#7c3aed" />
                    <path d="M7.5 12V8.5a3.5 3.5 0 0 1 7 0v3.5" fill="none" stroke="#7c3aed" strokeWidth="1.5" strokeLinecap="round" />
                    <circle cx="11" cy="16" r="1.2" fill="white" />
                  </svg>
                </div>
              </div>

              {/* Ozon name */}
              <div className="flex-1 min-w-0 relative h-[18px] overflow-hidden">
                <div
                  className="h-3 w-[64px] rounded bg-gray-200/60 absolute top-[3px]"
                  style={skel(phase)}
                  aria-hidden="true"
                />
                <span
                  className="absolute inset-0 flex items-center text-[12px] sm:text-[13px] text-gray-700 font-medium truncate"
                  style={ozonName(i, phase)}
                >
                  {p.ozon}
                </span>
              </div>

              {/* Price (typed character-by-character) */}
              <div className="relative w-9 sm:w-10 h-[18px] shrink-0">
                <div
                  className="h-3 w-7 rounded bg-gray-200/60 absolute top-[3px] right-0"
                  style={skel(phase)}
                  aria-hidden="true"
                />
                <span className="absolute inset-0 flex items-center justify-end text-[12px] sm:text-[13px] font-bold tabular-nums text-violet-600">
                  <TypedPrice value={p.price} visible={phase >= 8} rowDelay={i * 0.2} />
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Result footer */}
      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
        <span
          className="text-sm font-medium text-gray-600"
          style={{
            opacity: phase >= 8 ? 1 : 0.55,
            transition: phase >= 8 ? 'opacity 0.35s ease 0.3s' : 'opacity 0.2s ease',
          }}
        >
          Связано
        </span>
        <div className="relative">
          <div
            className="flex items-center gap-2"
            style={skel(phase)}
            aria-hidden="true"
          >
            <div className="h-4 w-[52px] rounded bg-gray-200/60" />
            <div className="h-5 w-[56px] rounded bg-gray-200/60" />
          </div>
          <div
            className="absolute right-0 inset-y-0 flex items-center gap-2"
            style={resultBadge(phase)}
          >
            <span className="text-base font-bold text-violet-600 tabular-nums whitespace-nowrap">
              3 товара
            </span>
            <span className="text-xs font-bold px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-lg ring-1 ring-emerald-200 whitespace-nowrap">
              = 1 цена
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
