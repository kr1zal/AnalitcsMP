/**
 * Profit + Deductions merged hero card — white theme.
 * Top: deduction tree. Middle: СПП credit. Bottom: profit calculation.
 *
 * Inactive: labels at 55% opacity, values = skeleton bars.
 * Active: hover-triggered stagger blur-reveal.
 */
import { TrendingUp } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useHoverOrScroll } from '../../hooks/useLandingAnimations';

const DEDUCTIONS = [
  { label: 'Комиссия', value: '68 400', color: 'text-violet-500', skelW: 64 },
  { label: 'Логистика', value: '42 100', color: 'text-blue-500', skelW: 56 },
  { label: 'Хранение', value: '18 300', color: 'text-orange-500', skelW: 52 },
  { label: 'Штрафы', value: '14 200', color: 'text-red-500', skelW: 52 },
] as const;

const DEDUCTIONS_TOTAL = { label: 'Итого удержания', value: '143 000', skelW: 72 };

const PROFIT_LINES = [
  { label: 'Выручка', value: '847 200', color: 'text-gray-900', sign: '', skelW: 68 },
  { label: 'СПП', value: '24 100', color: 'text-indigo-500', sign: '+', skelW: 52 },
  { label: 'Удержания', value: '143 000', color: 'text-red-500', sign: '\u2212', skelW: 64 },
  { label: 'Закупка', value: '285 400', color: 'text-amber-600', sign: '\u2212', skelW: 64 },
  { label: 'Реклама', value: '52 300', color: 'text-orange-500', sign: '\u2212', skelW: 56 },
] as const;

const PROFIT_RESULT = { label: 'Чистая прибыль', value: '390 600', pct: '45%' };

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

const dedTotalStyle = (on: boolean): CSSProperties => ({
  opacity: on ? 1 : 0,
  filter: on ? 'blur(0px)' : 'blur(4px)',
  transition: on
    ? 'opacity 0.45s ease 0.55s, filter 0.45s ease 0.55s'
    : 'opacity 0.15s ease, filter 0.15s ease',
});

const dedTotalLabelStyle = (on: boolean): CSSProperties => ({
  opacity: on ? 1 : 0.55,
  transition: on
    ? 'opacity 0.35s ease 0.5s'
    : 'opacity 0.2s ease',
});

const dividerStyle = (delay: number, on: boolean): CSSProperties => ({
  opacity: on ? 1 : 0.3,
  transform: on ? 'scaleX(1)' : 'scaleX(0.3)',
  transformOrigin: 'left',
  transition: on
    ? `opacity 0.35s ease ${delay}s, transform 0.35s cubic-bezier(0.22,1,0.36,1) ${delay}s`
    : 'opacity 0.2s ease, transform 0.2s ease',
});

const profitPop = (on: boolean): CSSProperties => ({
  opacity: on ? 1 : 0,
  transform: on ? 'scale(1)' : 'scale(0.95)',
  filter: on ? 'blur(0px)' : 'blur(4px)',
  transition: on
    ? 'opacity 0.5s ease 1.4s, transform 0.5s cubic-bezier(0.22,1,0.36,1) 1.4s, filter 0.5s ease 1.4s'
    : 'opacity 0.15s ease, transform 0.15s ease, filter 0.15s ease',
});

const skelStyle = (on: boolean, delay = 0.18): CSSProperties => ({
  opacity: on ? 0 : 0.55,
  transition: on ? 'opacity 0.15s ease' : `opacity 0.35s ease ${delay}s`,
});

export function ProfitDeductionsCard() {
  const { ref, active, pointerHandlers } = useHoverOrScroll();

  return (
    <div
      ref={ref}
      {...pointerHandlers}
      className="relative bg-white rounded-2xl ring-1 ring-gray-900/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_32px_rgba(0,0,0,0.06)] p-5 sm:p-6 h-full overflow-hidden cursor-default"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-sm">
          <TrendingUp className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-gray-900">Прибыль и&nbsp;удержания</h3>
          <p className="text-xs text-gray-500 leading-snug">
            Все расходы и&nbsp;чистая прибыль в&nbsp;одном расчёте
          </p>
        </div>
      </div>

      {/* Section 1: Deduction tree */}
      <div className="bg-gradient-to-br from-gray-50/80 to-gray-50/40 rounded-xl p-4 ring-1 ring-gray-900/[0.04] mb-3">
        <div className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-2.5">Дерево удержаний</div>
        <div className="space-y-2">
          {DEDUCTIONS.map((d, i) => {
            const delay = i * 0.1 + 0.1;
            return (
              <div key={i} className="flex items-center justify-between gap-2">
                <span className="text-sm text-gray-600" style={labelFade(delay, active)}>
                  {d.label}
                </span>
                <div className="relative h-5 flex items-center">
                  <div
                    className="h-3 rounded bg-gray-200/60"
                    style={{ width: d.skelW, ...skelStyle(active) }}
                    aria-hidden="true"
                  />
                  <span
                    className={`absolute right-0 text-sm sm:text-base font-bold tabular-nums whitespace-nowrap ${d.color}`}
                    style={valBlur(delay, active)}
                  >
                    &minus;{d.value}                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="my-2.5 h-px bg-gray-200" style={dividerStyle(0.5, active)} />
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-gray-700" style={dedTotalLabelStyle(active)}>
            {DEDUCTIONS_TOTAL.label}
          </span>
          <div className="relative h-5 flex items-center">
            <div
              className="h-3.5 rounded bg-gray-200/60"
              style={{ width: DEDUCTIONS_TOTAL.skelW, ...skelStyle(active, 0.2) }}
              aria-hidden="true"
            />
            <span
              className="absolute right-0 text-base font-bold tabular-nums text-red-500 whitespace-nowrap"
              style={dedTotalStyle(active)}
            >
              &minus;{DEDUCTIONS_TOTAL.value}            </span>
          </div>
        </div>
      </div>

      {/* Section 2: Profit calculation */}
      <div className="bg-gradient-to-br from-gray-50/80 to-gray-50/40 rounded-xl p-4 ring-1 ring-gray-900/[0.04]">
        <div className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-2.5">Расчёт прибыли</div>
        <div className="space-y-2">
          {PROFIT_LINES.map((line, i) => {
            const delay = i * 0.1 + 0.7;
            return (
              <div key={i} className="flex items-center justify-between gap-2">
                <span className="text-sm text-gray-600" style={labelFade(delay, active)}>
                  {line.label}
                </span>
                <div className="relative h-5 flex items-center">
                  <div
                    className="h-3 rounded bg-gray-200/60"
                    style={{ width: line.skelW, ...skelStyle(active) }}
                    aria-hidden="true"
                  />
                  <span
                    className={`absolute right-0 text-sm sm:text-base font-bold tabular-nums whitespace-nowrap ${line.color}`}
                    style={valBlur(delay, active)}
                  >
                    {line.sign}{line.value}                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="my-2.5 h-px bg-gray-200" style={dividerStyle(1.25, active)} />
        <div className="flex items-center justify-between gap-2">
          <span
            className="text-sm font-semibold text-emerald-600"
            style={{
              opacity: active ? 1 : 0.5,
              transition: active ? 'opacity 0.4s ease 1.3s' : 'opacity 0.2s ease',
            }}
          >
            {PROFIT_RESULT.label}
          </span>
          <div className="relative flex items-center gap-2">
            <div
              className="flex items-center gap-2"
              style={skelStyle(active, 0.2)}
              aria-hidden="true"
            >
              <div className="h-4 w-[56px] rounded bg-gray-200/60" />
              <div className="h-5 w-[32px] rounded bg-gray-200/60" />
            </div>
            <div className="absolute right-0 flex items-center gap-2" style={profitPop(active)}>
              <span className="text-lg sm:text-xl font-bold text-emerald-600 tabular-nums whitespace-nowrap">
                {PROFIT_RESULT.value}              </span>
              <span className="text-xs sm:text-sm font-bold px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-lg ring-1 ring-emerald-200">
                {PROFIT_RESULT.pct}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
