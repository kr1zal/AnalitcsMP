/**
 * SVG Horizontal Bar Chart для PDF
 * Top товаров по прибыли, ABC distribution и т.д.
 */
import { COLORS } from './print-constants';
import { formatCurrency } from '../../lib/utils';

export interface BarEntry {
  label: string;
  value: number;
  color?: string;
  badge?: string;
  badgeColor?: string;
}

interface PrintSvgBarChartProps {
  entries: BarEntry[];
  width?: number;
  barHeight?: number;
  gap?: number;
  showValues?: boolean;
  valueFormatter?: (v: number) => string;
}

export function PrintSvgBarChart({
  entries,
  width = 700,
  barHeight = 26,
  gap = 10,
  showValues = true,
  valueFormatter = formatCurrency,
}: PrintSvgBarChartProps) {
  if (!entries.length) return null;

  const maxVal = Math.max(...entries.map((e) => Math.abs(e.value)), 1);
  const labelWidth = 160;
  const valueWidth = showValues ? 100 : 0;
  const badgeWidth = entries.some((e) => e.badge) ? 30 : 0;
  const barMaxWidth = width - labelWidth - valueWidth - badgeWidth - 20;
  const totalHeight = (barHeight + gap) * entries.length;

  return (
    <svg width={width} height={totalHeight} style={{ fontFamily: 'Inter, sans-serif' }}>
      {entries.map((entry, i) => {
        const y = i * (barHeight + gap);
        const w = (Math.abs(entry.value) / maxVal) * barMaxWidth;
        const isNegative = entry.value < 0;
        const color = entry.color || (isNegative ? COLORS.red : COLORS.emerald);

        return (
          <g key={i}>
            {/* Badge */}
            {entry.badge && (
              <g>
                <rect
                  x={0}
                  y={y + (barHeight - 16) / 2}
                  width={22}
                  height={16}
                  rx={4}
                  fill={entry.badgeColor || COLORS.gray100}
                />
                <text
                  x={11}
                  y={y + barHeight / 2 + 4}
                  textAnchor="middle"
                  fontSize={9}
                  fontWeight={700}
                  fill={COLORS.gray700}
                >
                  {entry.badge}
                </text>
              </g>
            )}

            {/* Label */}
            <text
              x={badgeWidth + 4}
              y={y + barHeight / 2 + 4}
              fontSize={11}
              fill={COLORS.gray700}
            >
              {entry.label.length > 22 ? entry.label.slice(0, 20) + '...' : entry.label}
            </text>

            {/* Bar */}
            <rect
              x={labelWidth + badgeWidth}
              y={y + 2}
              width={Math.max(w, 3)}
              height={barHeight - 4}
              rx={4}
              fill={color}
              opacity={0.8}
            />

            {/* Value */}
            {showValues && (
              <text
                x={labelWidth + badgeWidth + barMaxWidth + 12}
                y={y + barHeight / 2 + 4}
                fontSize={11}
                fontWeight={600}
                fill={isNegative ? COLORS.red : COLORS.gray900}
              >
                {isNegative ? '−' : ''}
                {valueFormatter(Math.abs(entry.value))}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
