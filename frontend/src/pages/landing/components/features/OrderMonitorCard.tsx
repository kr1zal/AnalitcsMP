/**
 * Order Monitor Card — enterprise order funnel.
 *
 * 4-step funnel (Заказы → В пути → Доставлено → Выкуп) with animated
 * circle checkmarks, progress bars, and staggered blur-reveal.
 */
import { ClipboardList } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useHoverOrScroll } from '../../hooks/useLandingAnimations';

const FUNNEL = [
  { label: 'Заказы', value: '312', pct: 100, barColor: 'bg-blue-500', textColor: 'text-blue-600', dotColor: '#3b82f6' },
  { label: 'В пути', value: '287', pct: 92, barColor: 'bg-sky-500', textColor: 'text-sky-600', dotColor: '#0ea5e9' },
  { label: 'Доставлено', value: '264', pct: 85, barColor: 'bg-cyan-500', textColor: 'text-cyan-600', dotColor: '#06b6d4' },
  { label: 'Выкуп', value: '241', pct: 77, barColor: 'bg-emerald-500', textColor: 'text-emerald-600', dotColor: '#10b981' },
] as const;

const BUYOUT = { value: '77%', label: 'Процент выкупа' };

/* ── Transition helpers ── */

const circleStyle = (i: number, on: boolean): CSSProperties => ({
  opacity: on ? 1 : 0,
  transform: on ? 'scale(1)' : 'scale(0.7)',
  transition: on
    ? `opacity 0.25s ease ${i * 0.12 + 0.1}s, transform 0.25s cubic-bezier(0.34,1.56,0.64,1) ${i * 0.12 + 0.1}s`
    : 'opacity 0.15s ease, transform 0.15s ease',
});

const labelBlur = (i: number, on: boolean): CSSProperties => ({
  opacity: on ? 1 : 0,
  filter: on ? 'blur(0px)' : 'blur(6px)',
  transition: on
    ? `opacity 0.4s ease ${i * 0.12 + 0.15}s, filter 0.4s ease ${i * 0.12 + 0.15}s`
    : 'opacity 0.15s ease, filter 0.15s ease',
});

const valBlur = (i: number, on: boolean): CSSProperties => ({
  opacity: on ? 1 : 0,
  filter: on ? 'blur(0px)' : 'blur(8px)',
  transition: on
    ? `opacity 0.45s ease ${i * 0.12 + 0.18}s, filter 0.45s ease ${i * 0.12 + 0.18}s`
    : 'opacity 0.15s ease, filter 0.15s ease',
});

const barStyle = (i: number, pct: number, on: boolean): CSSProperties => ({
  width: on ? `${pct}%` : '0%',
  transition: on
    ? `width 0.6s cubic-bezier(0.22,1,0.36,1) ${i * 0.12 + 0.2}s`
    : 'width 0.2s ease',
});

const skelStyle = (on: boolean): CSSProperties => ({
  opacity: on ? 0 : 0.55,
  transition: on ? 'opacity 0.15s ease' : 'opacity 0.35s ease 0.18s',
});

const badgePop = (on: boolean): CSSProperties => ({
  opacity: on ? 1 : 0,
  transform: on ? 'scale(1)' : 'scale(0.92)',
  filter: on ? 'blur(0px)' : 'blur(4px)',
  transition: on
    ? 'opacity 0.5s ease 0.7s, transform 0.5s cubic-bezier(0.22,1,0.36,1) 0.7s, filter 0.5s ease 0.7s'
    : 'opacity 0.15s ease, transform 0.15s ease, filter 0.15s ease',
});

export function OrderMonitorCard() {
  const { ref, active, pointerHandlers } = useHoverOrScroll();

  return (
    <div
      ref={ref}
      {...pointerHandlers}
      className="relative bg-white rounded-2xl ring-1 ring-gray-900/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_32px_rgba(0,0,0,0.06)] p-5 sm:p-6 h-full overflow-hidden cursor-default"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
          <ClipboardList className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-gray-900">Монитор заказов</h3>
          <p className="text-xs text-gray-500 leading-snug">
            Воронка от заказа до&nbsp;выкупа
          </p>
        </div>
      </div>

      {/* Funnel steps */}
      <div className="space-y-3">
        {FUNNEL.map((step, i) => (
          <div key={i} className="flex items-center gap-3">
            {/* Circle: outline → filled check */}
            <div className="relative w-[18px] h-[18px] shrink-0">
              <div
                className="w-[18px] h-[18px] rounded-full border-[1.5px] border-gray-300 bg-white"
                style={{
                  opacity: active ? 0 : 1,
                  transition: `opacity 0.15s ease ${active ? '0s' : `${i * 0.06}s`}`,
                }}
              />
              <div
                className="absolute inset-0 w-[18px] h-[18px] rounded-full flex items-center justify-center"
                style={{
                  backgroundColor: step.dotColor,
                  boxShadow: `0 0 8px ${step.dotColor}40`,
                  ...circleStyle(i, active),
                }}
              >
                <svg viewBox="0 0 16 16" fill="none" className="w-2.5 h-2.5">
                  <path stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="m4 8 3 3 5-5" />
                </svg>
              </div>
            </div>

            {/* Label + value + bar */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="relative min-w-0">
                  <div
                    className="h-3 w-16 rounded bg-gray-200/60"
                    style={skelStyle(active)}
                    aria-hidden="true"
                  />
                  <span
                    className="absolute inset-0 flex items-center text-sm text-gray-700 font-medium"
                    style={labelBlur(i, active)}
                  >
                    {step.label}
                  </span>
                </div>
                <div className="relative shrink-0">
                  <div
                    className="h-3.5 w-8 rounded bg-gray-200/60"
                    style={skelStyle(active)}
                    aria-hidden="true"
                  />
                  <span
                    className={`absolute inset-0 flex items-center justify-end text-sm font-bold tabular-nums ${step.textColor}`}
                    style={valBlur(i, active)}
                  >
                    {step.value}
                  </span>
                </div>
              </div>
              {/* Progress bar */}
              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className={`h-full rounded-full ${step.barColor}`}
                  style={barStyle(i, step.pct, active)}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Buyout rate badge */}
      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
        <span
          className="text-sm font-medium text-gray-600"
          style={{
            opacity: active ? 1 : 0.55,
            transition: active ? 'opacity 0.35s ease 0.6s' : 'opacity 0.2s ease',
          }}
        >
          {BUYOUT.label}
        </span>
        <div className="relative">
          <div
            className="h-6 w-12 rounded bg-gray-200/60"
            style={skelStyle(active)}
            aria-hidden="true"
          />
          <span
            className="absolute inset-0 flex items-center justify-end text-base font-bold text-emerald-600 tabular-nums"
            style={badgePop(active)}
          >
            {BUYOUT.value}
          </span>
        </div>
      </div>
    </div>
  );
}
