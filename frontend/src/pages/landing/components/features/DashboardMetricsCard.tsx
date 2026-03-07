/**
 * Dashboard Metrics Card — enterprise mini-dashboard.
 *
 * 2×2 grid of key metrics with staggered blur-reveal animation.
 * Inactive: skeleton bars. Active: values blur-reveal with stagger.
 */
import { BarChart3 } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useHoverOrScroll } from '../../hooks/useLandingAnimations';

const METRICS = [
  { label: 'Выручка', value: '847 200', unit: '', color: 'text-indigo-600', skelW: 64 },
  { label: 'Прибыль', value: '390 600', unit: '', color: 'text-emerald-600', skelW: 60 },
  { label: 'Заказы', value: '312', unit: '', color: 'text-gray-900', skelW: 36 },
  { label: 'ДРР', value: '6.1%', unit: '', color: 'text-amber-600', skelW: 36 },
] as const;

const PILLS = ['16+ виджетов', 'Любые МП'] as const;

/* ── Transition helpers ── */

const valBlur = (delay: number, on: boolean): CSSProperties => ({
  opacity: on ? 1 : 0,
  filter: on ? 'blur(0px)' : 'blur(8px)',
  transition: on
    ? `opacity 0.45s ease ${delay}s, filter 0.45s ease ${delay}s`
    : 'opacity 0.15s ease, filter 0.15s ease',
});

const labelFade = (delay: number, on: boolean): CSSProperties => ({
  opacity: on ? 1 : 0.55,
  transition: on
    ? `opacity 0.35s ease ${delay}s`
    : 'opacity 0.2s ease',
});

const skelStyle = (on: boolean): CSSProperties => ({
  opacity: on ? 0 : 0.55,
  transition: on ? 'opacity 0.15s ease' : 'opacity 0.35s ease 0.18s',
});

export function DashboardMetricsCard() {
  const { ref, active, pointerHandlers } = useHoverOrScroll();

  return (
    <div
      ref={ref}
      {...pointerHandlers}
      className="relative bg-white rounded-2xl ring-1 ring-gray-900/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_32px_rgba(0,0,0,0.06)] p-5 sm:p-6 h-full overflow-hidden cursor-default"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-sm">
          <BarChart3 className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-gray-900">Дашборд</h3>
          <p className="text-xs text-gray-500 leading-snug">
            Соберите свой экран из&nbsp;16+ виджетов
          </p>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="bg-gradient-to-br from-gray-50/80 to-gray-50/40 rounded-xl p-3 sm:p-4 ring-1 ring-gray-900/[0.04]">
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          {METRICS.map((m, i) => {
            const delay = i * 0.1 + 0.15;
            return (
              <div
                key={i}
                className="p-2.5 sm:p-3 rounded-lg bg-white/70 ring-1 ring-gray-900/[0.03]"
              >
                <span
                  className="text-[11px] text-gray-500 font-medium uppercase tracking-wider block"
                  style={labelFade(delay, active)}
                >
                  {m.label}
                </span>
                <div className="relative mt-1.5 h-6 flex items-center">
                  <div
                    className="h-3.5 rounded bg-gray-200/60"
                    style={{ width: m.skelW, ...skelStyle(active) }}
                    aria-hidden="true"
                  />
                  <span
                    className={`absolute inset-0 flex items-center text-lg font-bold tabular-nums ${m.color}`}
                    style={valBlur(delay, active)}
                  >
                    {m.value}{m.unit}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pills */}
      <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-2">
        {PILLS.map((p) => (
          <span
            key={p}
            className="text-xs text-gray-600 font-medium px-2.5 py-1 rounded-full bg-gray-50/80 ring-1 ring-gray-900/[0.04]"
          >
            {p}
          </span>
        ))}
      </div>
    </div>
  );
}
