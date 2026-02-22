/**
 * SVG Donut Chart для PDF
 * Кольцевая диаграмма с легендой
 */
import { COLORS } from './print-constants';
import { formatCurrency, formatPercent } from '../../lib/utils';

export interface DonutSegment {
  label: string;
  value: number;
  color?: string;
}

interface PrintSvgDonutChartProps {
  segments: DonutSegment[];
  size?: number;
  innerRadius?: number;
  outerRadius?: number;
  showLegend?: boolean;
  legendWidth?: number;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArcSegment(
  cx: number,
  cy: number,
  inner: number,
  outer: number,
  startAngle: number,
  endAngle: number,
): string {
  // Clamp to avoid full-circle rendering issue
  const effectiveEnd = Math.min(endAngle, startAngle + 359.5);

  const outerStart = polarToCartesian(cx, cy, outer, startAngle);
  const outerEnd = polarToCartesian(cx, cy, outer, effectiveEnd);
  const innerStart = polarToCartesian(cx, cy, inner, startAngle);
  const innerEnd = polarToCartesian(cx, cy, inner, effectiveEnd);
  const largeArc = effectiveEnd - startAngle > 180 ? 1 : 0;

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outer} ${outer} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${inner} ${inner} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
}

export function PrintSvgDonutChart({
  segments,
  size = 160,
  innerRadius = 42,
  outerRadius = 70,
  showLegend = true,
  legendWidth = 260,
}: PrintSvgDonutChartProps) {
  const total = segments.reduce((s, seg) => s + Math.abs(seg.value), 0);
  if (!total) return null;

  const cx = size / 2;
  const cy = size / 2;

  // Build arcs
  let currentAngle = 0;
  const arcs = segments
    .filter((s) => s.value > 0)
    .map((seg, i) => {
      const pct = (seg.value / total) * 100;
      const sweep = (pct / 100) * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + sweep;
      currentAngle = endAngle;
      const color = seg.color || COLORS.donut[i % COLORS.donut.length];
      return { ...seg, pct, startAngle, endAngle, color };
    });

  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} style={{ fontFamily: 'Inter, sans-serif' }}>
        {arcs.map((arc, i) => (
          <path key={i} d={describeArcSegment(cx, cy, innerRadius, outerRadius, arc.startAngle, arc.endAngle)} fill={arc.color} />
        ))}
        {/* Center total */}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize={11} fill={COLORS.gray500} fontWeight={500}>
          Итого
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize={13} fill={COLORS.gray900} fontWeight={700}>
          {formatCurrency(total)}
        </text>
      </svg>

      {showLegend && (
        <div className="space-y-1.5">
          {arcs.map((arc, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: arc.color }} />
              <span className="text-gray-600 truncate" style={{ maxWidth: legendWidth - 100 }}>
                {arc.label}
              </span>
              <span className="text-gray-900 font-semibold tabular-nums ml-auto">{formatPercent(arc.pct)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
