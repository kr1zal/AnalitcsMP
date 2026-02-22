/**
 * Универсальный SVG Area Chart для PDF
 * Рисует area + line, grid, оси X/Y
 */
import { CHART_MARGIN, COLORS } from './print-constants';

export interface AreaDataPoint {
  label: string;
  value: number;
}

interface PrintSvgAreaChartProps {
  data: AreaDataPoint[];
  width?: number;
  height?: number;
  color?: string;
  fillColor?: string;
  strokeWidth?: number;
  yFormatter?: (v: number) => string;
  xTickInterval?: number;
  showDots?: boolean;
}

export function PrintSvgAreaChart({
  data,
  width = 1050,
  height = 240,
  color = COLORS.emerald,
  fillColor = COLORS.emeraldFill,
  strokeWidth = 2,
  yFormatter = String,
  xTickInterval,
  showDots = false,
}: PrintSvgAreaChartProps) {
  if (!data.length) {
    return (
      <svg width={width} height={height}>
        <text x={width / 2} y={height / 2} textAnchor="middle" fontSize={12} fill={COLORS.gray400}>
          Нет данных
        </text>
      </svg>
    );
  }

  const M = CHART_MARGIN;
  const plotW = width - M.left - M.right;
  const plotH = height - M.top - M.bottom;

  const maxVal = Math.max(...data.map((d) => d.value), 1);

  const xScale = (i: number) => M.left + (i / Math.max(data.length - 1, 1)) * plotW;
  const yScale = (v: number) => M.top + plotH - (v / maxVal) * plotH;
  const baseline = yScale(0);

  const points = data.map((d, i) => ({ x: xScale(i), y: yScale(d.value) }));

  const areaPath =
    `M ${points[0].x} ${points[0].y} ` +
    points
      .slice(1)
      .map((p) => `L ${p.x} ${p.y}`)
      .join(' ') +
    ` L ${points[points.length - 1].x} ${baseline} L ${points[0].x} ${baseline} Z`;

  const linePath =
    `M ${points[0].x} ${points[0].y} ` +
    points
      .slice(1)
      .map((p) => `L ${p.x} ${p.y}`)
      .join(' ');

  const gridSteps = [0.25, 0.5, 0.75, 1.0];
  const interval = xTickInterval ?? Math.max(1, Math.floor(data.length / 10));

  return (
    <svg width={width} height={height} style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Grid lines */}
      {gridSteps.map((f) => {
        const v = maxVal * f;
        const y = yScale(v);
        return (
          <g key={f}>
            <line x1={M.left} y1={y} x2={M.left + plotW} y2={y} stroke={COLORS.gray200} strokeDasharray="4 4" />
            <text x={M.left - 8} y={y + 4} textAnchor="end" fontSize={9} fill={COLORS.gray400}>
              {yFormatter(v)}
            </text>
          </g>
        );
      })}

      {/* Area fill */}
      <path d={areaPath} fill={fillColor} />

      {/* Line */}
      <path d={linePath} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />

      {/* Dots */}
      {showDots &&
        points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={color} />)}

      {/* X axis */}
      <line x1={M.left} y1={baseline} x2={M.left + plotW} y2={baseline} stroke={COLORS.gray300} />

      {/* X labels */}
      {data.map((d, i) =>
        i % interval === 0 ? (
          <text key={i} x={xScale(i)} y={height - 6} textAnchor="middle" fontSize={9} fill={COLORS.gray400}>
            {d.label}
          </text>
        ) : null,
      )}
    </svg>
  );
}
