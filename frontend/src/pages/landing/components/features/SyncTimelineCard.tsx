/**
 * Sync Timeline Card — 2-phase animated sync log.
 *
 * Inactive: outline circles, skeleton bars, static spinner, "Синхронизация..."
 * Active: filled circles, blur-reveal labels, spinning loader, running dot.
 * Pulse dot starts after 1.5s delay (circles reveal first).
 */
import { RefreshCw } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useHoverOrScroll } from '../../hooks/useLandingAnimations';

const SYNC_EVENTS = [
  { label: 'Продажи', time: '0:01' },
  { label: 'Остатки', time: '0:02' },
  { label: 'Удержания', time: '0:04' },
  { label: 'Заказы', time: '0:06' },
  { label: 'Реклама', time: '0:08' },
  { label: 'Хранение', time: '0:10' },
  { label: 'Финансы', time: '0:12' },
] as const;

const LABEL_SKEL_W = [40, 52, 56, 40, 48, 52, 44] as const;
const METRICS = ['Все маркетплейсы', 'Пара минут', 'Автоматически'] as const;

/* ── Transition helpers ── */

const circleStyle = (i: number, on: boolean): CSSProperties => ({
  opacity: on ? 1 : 0,
  transform: on ? 'scale(1)' : 'scale(0.8)',
  transition: on
    ? `opacity 0.2s ease ${i * 0.12 + 0.3}s, transform 0.2s cubic-bezier(0.34,1.56,0.64,1) ${i * 0.12 + 0.3}s`
    : 'opacity 0.2s ease 0.05s, transform 0.2s ease 0.05s',
});

const labelStyle = (i: number, on: boolean): CSSProperties => ({
  opacity: on ? 1 : 0,
  filter: on ? 'blur(0px)' : 'blur(8px)',
  transition: on
    ? `opacity 0.45s ease ${i * 0.12 + 0.35}s, filter 0.45s ease ${i * 0.12 + 0.35}s`
    : 'opacity 0.15s ease, filter 0.15s ease',
});

const timeStyle = (i: number, on: boolean): CSSProperties => ({
  opacity: on ? 1 : 0,
  transform: on ? 'translateY(0)' : 'translateY(0.4rem)',
  transition: on
    ? `opacity 0.45s ease ${i * 0.12 + 0.42}s, transform 0.45s ease ${i * 0.12 + 0.42}s`
    : 'opacity 0.15s ease, transform 0.15s ease',
});

const skelStyle = (on: boolean): CSSProperties => ({
  opacity: on ? 0 : 0.6,
  transition: on ? 'opacity 0.15s ease' : 'opacity 0.35s ease 0.18s',
});

export function SyncTimelineCard() {
  const { ref, active, pointerHandlers } = useHoverOrScroll();

  return (
    <div
      ref={ref}
      {...pointerHandlers}
      className="relative bg-white rounded-2xl ring-1 ring-gray-900/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_32px_rgba(0,0,0,0.06)] p-5 sm:p-6 overflow-hidden cursor-default"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center shadow-sm">
          <RefreshCw className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-gray-900">Авто-синхронизация</h3>
          <p className="text-xs text-gray-500 leading-snug">
            Данные обновляются сами, без&nbsp;ручных выгрузок
          </p>
        </div>
      </div>

      {/* Notification bar */}
      <div className="bg-gradient-to-r from-gray-50 to-gray-50/60 rounded-lg px-3.5 py-2.5 flex items-center gap-2.5 mb-5 ring-1 ring-gray-900/[0.04]">
        <svg
          viewBox="0 0 16 16"
          fill="none"
          className="w-4 h-4 shrink-0"
          style={{ animation: active ? 'bento-spin 1.5s linear infinite' : 'none' }}
        >
          <path
            stroke="url(#sync-spinner-grad)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.25"
            d="M8 1.75v1.042m0 10.416v1.042m3.125-11.663-.521.902m-5.208 9.022-.521.902m8.537-8.538-.902.52m-9.02 5.21-.903.52M14.25 8h-1.042M2.792 8H1.75m11.662 3.125-.902-.52m-9.02-5.21-.903-.52m8.538 8.538-.52-.902m-5.21-9.022-.52-.902"
          />
          <defs>
            <radialGradient id="sync-spinner-grad" cx="0" cy="0" r="1" gradientTransform="rotate(102.529 4.047 5.711) scale(11.5244)" gradientUnits="userSpaceOnUse">
              <stop stopColor="#374151" />
              <stop offset="1" stopColor="#374151" stopOpacity=".15" />
            </radialGradient>
          </defs>
        </svg>
        <span
          className="text-sm font-medium whitespace-nowrap"
          style={{ color: active ? '#111827' : '#9ca3af', transition: 'color 0.4s ease' }}
        >
          {active ? 'Синхронизация завершена' : 'Синхронизация...'}
        </span>
      </div>

      {/* Timeline — line & dot scoped to items container */}
      <div className="pl-5">
        <div className="relative">
          {/* Vertical line — top/bottom inset to align with circle centers */}
          <div
            className="absolute w-px bg-gray-200"
            style={{ left: -13, top: 11, bottom: 11 }}
            aria-hidden="true"
          />

          {/* Running pulse dot — 1.5s delay so circles reveal first */}
          {active && (
            <div
              className="absolute w-[9px] h-[9px] rounded-full pointer-events-none z-10"
              style={{
                left: -17,
                background: '#10b981',
                boxShadow: '0 0 10px rgba(16,185,129,0.4)',
                opacity: 0,
                animation: 'timeline-pulse 3s ease-in-out 1.5s infinite',
              }}
              aria-hidden="true"
            />
          )}

          <div className="space-y-3.5">
            {SYNC_EVENTS.map((evt, i) => (
              <div key={i} className="relative flex items-center gap-3 min-h-[22px]">
                {/* Circle container */}
                <div className="absolute -left-5 top-1/2 -translate-y-1/2">
                  {/* Inactive: outline */}
                  <div
                    className="w-[13px] h-[13px] rounded-full border-[1.5px] border-gray-300 bg-white"
                    style={{
                      opacity: active ? 0 : 1,
                      transition: `opacity 0.15s ease ${active ? '0s' : `${i * 0.06}s`}`,
                    }}
                  />
                  {/* Active: green filled */}
                  <div
                    className="absolute inset-0 w-[13px] h-[13px] rounded-full flex items-center justify-center"
                    style={{
                      backgroundColor: '#10b981',
                      boxShadow: '0 0 6px rgba(16,185,129,0.25)',
                      ...circleStyle(i, active),
                    }}
                  >
                    <svg viewBox="0 0 16 16" fill="none" className="w-2 h-2">
                      <path stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="m4 8 3 3 5-5" />
                    </svg>
                  </div>
                </div>

                {/* Label — skeleton + real */}
                <div className="relative flex-1 min-w-0">
                  <div
                    className="h-3 rounded bg-gray-200/60"
                    style={{ width: LABEL_SKEL_W[i], ...skelStyle(active) }}
                    aria-hidden="true"
                  />
                  <span
                    className="absolute inset-0 flex items-center text-sm text-gray-700 font-medium"
                    style={labelStyle(i, active)}
                  >
                    {evt.label}
                  </span>
                </div>

                {/* Timestamp — skeleton + real */}
                <div className="relative shrink-0 w-[28px]">
                  <div
                    className="h-3 w-full rounded bg-gray-200/60"
                    style={skelStyle(active)}
                    aria-hidden="true"
                  />
                  <span
                    className="absolute inset-0 flex items-center justify-end text-xs text-gray-400 tabular-nums"
                    style={timeStyle(i, active)}
                  >
                    {evt.time}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Metric pills */}
      <div className="mt-5 pt-4 border-t border-gray-100 flex flex-wrap gap-2">
        {METRICS.map((m) => (
          <span key={m} className="text-xs text-gray-600 font-medium px-2.5 py-1 rounded-full bg-gray-50/80 ring-1 ring-gray-900/[0.04]">
            {m}
          </span>
        ))}
      </div>
    </div>
  );
}
