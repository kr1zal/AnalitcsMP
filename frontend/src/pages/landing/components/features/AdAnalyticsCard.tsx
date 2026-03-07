/**
 * Ad Analytics Card — enterprise DRR sparkline chart + KPIs.
 *
 * SVG sparkline with stroke-dashoffset draw animation.
 * Inactive: flat gray line. Active: line draws, area fades in, dots pop, KPIs blur-reveal.
 */
import { Megaphone } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useHoverOrScroll } from '../../hooks/useLandingAnimations';

/* ── Chart data ── */

const DRR_VALUES = [8.2, 7.1, 6.8, 7.5, 5.9, 6.1, 5.4] as const;
const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const;

// SVG viewBox 200×60. Y inverted (min=5.4, max=8.2, range=2.8)
const W = 200;
const H = 60;
const PAD = 5;
const MIN_V = 5.4;
const RANGE = 2.8;

const points = DRR_VALUES.map((v, i) => ({
  x: i * (W / (DRR_VALUES.length - 1)),
  y: H - ((v - MIN_V) / RANGE) * (H - PAD * 2) - PAD,
}));

const LINE_PATH = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ');
const AREA_PATH = `${LINE_PATH} L ${W},${H} L 0,${H} Z`;
const PATH_LENGTH = 240; // approximate stroke length

/* ── KPIs ── */

const KPIS = [
  { label: 'Расходы', value: '52 300', unit: '', color: 'text-amber-600', skelW: 56 },
  { label: 'ДРР', value: '6.1%', unit: '', color: 'text-emerald-600', skelW: 40 },
] as const;

/* ── Transition helpers ── */

const lineStyle = (on: boolean): CSSProperties => ({
  strokeDasharray: PATH_LENGTH,
  strokeDashoffset: on ? 0 : PATH_LENGTH,
  transition: on
    ? 'stroke-dashoffset 1.2s ease 0.2s'
    : 'stroke-dashoffset 0.3s ease',
});

const areaStyle = (on: boolean): CSSProperties => ({
  opacity: on ? 0.25 : 0,
  transition: on
    ? 'opacity 0.6s ease 0.4s'
    : 'opacity 0.2s ease',
});

const dotStyle = (i: number, on: boolean): CSSProperties => ({
  opacity: on ? 1 : 0,
  transform: on ? 'scale(1)' : 'scale(0)',
  transition: on
    ? `opacity 0.25s ease ${0.4 + i * 0.08}s, transform 0.25s cubic-bezier(0.34,1.56,0.64,1) ${0.4 + i * 0.08}s`
    : 'opacity 0.15s ease, transform 0.15s ease',
});

const flatLineStyle = (on: boolean): CSSProperties => ({
  opacity: on ? 0 : 0.5,
  transition: on ? 'opacity 0.2s ease' : 'opacity 0.35s ease 0.15s',
});

const dayLabelStyle = (i: number, on: boolean): CSSProperties => ({
  opacity: on ? 1 : 0.4,
  transition: on
    ? `opacity 0.3s ease ${0.3 + i * 0.06}s`
    : 'opacity 0.2s ease',
});

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

export function AdAnalyticsCard() {
  const { ref, active, pointerHandlers } = useHoverOrScroll();

  return (
    <div
      ref={ref}
      {...pointerHandlers}
      className="relative bg-white rounded-2xl ring-1 ring-gray-900/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_32px_rgba(0,0,0,0.06)] p-5 sm:p-6 h-full overflow-hidden cursor-default"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-sm">
          <Megaphone className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-gray-900">Рекламная аналитика</h3>
          <p className="text-xs text-gray-500 leading-snug">
            Расходы и&nbsp;ДРР по&nbsp;дням
          </p>
        </div>
        <span
          className="px-2 py-0.5 text-[10px] font-semibold bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-full leading-tight shrink-0"
          style={{
            boxShadow: active ? '0 0 12px rgba(99,102,241,0.3)' : 'none',
            transition: 'box-shadow 0.4s ease',
          }}
        >
          Pro
        </span>
      </div>

      {/* Chart */}
      <div className="bg-gradient-to-br from-gray-50/80 to-gray-50/40 rounded-xl p-3 sm:p-4 ring-1 ring-gray-900/[0.04] mb-3">
        <div className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-2">
          ДРР по дням
        </div>
        <div className="relative h-[64px] sm:h-[72px]">
          {/* Inactive: flat gray line */}
          <div
            className="absolute left-0 right-0 top-1/2 h-px bg-gray-300/60"
            style={flatLineStyle(active)}
            aria-hidden="true"
          />

          {/* Active: SVG sparkline */}
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full"
          >
            <defs>
              <linearGradient id="ad-area-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {/* Area fill */}
            <path d={AREA_PATH} fill="url(#ad-area-grad)" style={areaStyle(active)} />

            {/* Line */}
            <path
              d={LINE_PATH}
              fill="none"
              stroke="#f59e0b"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={lineStyle(active)}
            />

            {/* Dots */}
            {points.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={3}
                fill="white"
                stroke="#f59e0b"
                strokeWidth={1.5}
                style={dotStyle(i, active)}
              />
            ))}
          </svg>
        </div>

        {/* Day labels */}
        <div className="flex justify-between mt-1.5">
          {DAYS.map((d, i) => (
            <span
              key={d}
              className="text-[10px] text-gray-400 font-medium"
              style={dayLabelStyle(i, active)}
            >
              {d}
            </span>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
        {KPIS.map((kpi, i) => {
          const delay = 1.0 + i * 0.12;
          return (
            <div
              key={i}
              className="p-2.5 sm:p-3 rounded-xl bg-gradient-to-br from-gray-50/80 to-gray-50/40 ring-1 ring-gray-900/[0.04]"
            >
              <span
                className="text-[11px] text-gray-500 font-medium uppercase tracking-wider block"
                style={labelFade(delay, active)}
              >
                {kpi.label}
              </span>
              <div className="relative mt-1.5 h-6 flex items-center">
                <div
                  className="h-3.5 rounded bg-gray-200/60"
                  style={{ width: kpi.skelW, ...skelStyle(active) }}
                  aria-hidden="true"
                />
                <span
                  className={`absolute inset-0 flex items-center text-lg font-bold tabular-nums ${kpi.color}`}
                  style={valBlur(delay, active)}
                >
                  {kpi.value}{kpi.unit}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
