/**
 * Standard feature card — white with hover-triggered skeleton-to-content reveal.
 *
 * Inactive: icon + title visible, description replaced with skeleton bars.
 * Active (hover/scroll): description reveals with blur-to-sharp, card lifts.
 */
import type { CSSProperties } from 'react';
import type { Feature } from '../../types';
import { useHoverOrScroll } from '../../hooks/useLandingAnimations';

interface Props {
  feature: Feature;
}

/** Description blur-reveal */
const descStyle = (on: boolean): CSSProperties => ({
  opacity: on ? 1 : 0,
  filter: on ? 'blur(0px)' : 'blur(6px)',
  transition: on
    ? 'opacity 0.45s ease 0.15s, filter 0.45s ease 0.15s'
    : 'opacity 0.15s ease, filter 0.15s ease',
});

/** Skeleton bar — inverse of description */
const skelStyle = (on: boolean): CSSProperties => ({
  opacity: on ? 0 : 0.5,
  transition: on ? 'opacity 0.12s ease' : 'opacity 0.35s ease 0.18s',
});

export function StandardFeatureCard({ feature }: Props) {
  const Icon = feature.icon;
  const { ref, active, pointerHandlers } = useHoverOrScroll();

  return (
    <div
      ref={ref}
      {...pointerHandlers}
      className="relative bg-white rounded-2xl ring-1 ring-gray-900/[0.05] shadow-[0_1px_2px_rgba(0,0,0,0.03),0_4px_16px_rgba(0,0,0,0.03)] p-5 sm:p-6 h-full overflow-hidden cursor-default"
      style={{
        boxShadow: active
          ? '0 1px 3px rgba(0,0,0,0.06), 0 8px 32px rgba(0,0,0,0.08), 0 0 0 1px rgba(99,102,241,0.1)'
          : undefined,
        transform: active ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'box-shadow 0.3s ease, transform 0.3s ease',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div
          className={`w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center shadow-sm`}
          style={{
            transform: active ? 'scale(1.1)' : 'scale(1)',
            transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)',
          }}
        >
          <Icon className="w-5 h-5 text-white" />
        </div>
        {feature.badge && (
          <span
            className="px-2 py-0.5 text-[10px] font-semibold bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-full leading-tight shrink-0"
            style={{
              boxShadow: active ? '0 0 12px rgba(99,102,241,0.3)' : 'none',
              transition: 'box-shadow 0.4s ease',
            }}
          >
            {feature.badge}
          </span>
        )}
      </div>

      <h3 className="mt-3 text-sm sm:text-base font-semibold text-gray-900">
        {feature.title}
      </h3>

      {/* Description area — skeleton + real text */}
      <div className="relative mt-1.5 min-h-[36px]">
        {/* Skeleton bars (visible when inactive) */}
        <div className="space-y-2" style={skelStyle(active)} aria-hidden="true">
          <div className="h-2.5 w-full rounded bg-gray-200/50" />
          <div className="h-2.5 w-3/4 rounded bg-gray-200/50" />
        </div>
        {/* Real description */}
        <p
          className="absolute inset-0 text-sm text-gray-500 leading-relaxed"
          style={descStyle(active)}
        >
          {feature.description}
        </p>
      </div>
    </div>
  );
}
