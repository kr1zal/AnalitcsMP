/**
 * SVG Combo Chart для PDF — area (выручка) + bars (заказы)
 * Двойная ось Y: левая для area, правая для bars
 */
import { CHART_MARGIN, COLORS } from './print-constants';

export interface ComboDataPoint {
  label: string;
  areaValue: number;
  barValue: number;
}

interface PrintSvgComboChartProps {
  data: ComboDataPoint[];
  width?: number;
  height?: number;
  areaColor?: string;
  areaFillColor?: string;
  barColor?: string;
  areaLabel?: string;
  barLabel?: string;
  areaFormatter?: (v: number) => string;
  barFormatter?: (v: number) => string;
  xTickInterval?: number;
}

export function PrintSvgComboChart({
  data,
  width = 1050,
  height = 260,
  areaColor = COLORS.emerald,
  areaFillColor = COLORS.emeraldFill,
  barColor = COLORS.indigo,
  areaLabel = 'Выручка',
  barLabel = 'Заказы',
  areaFormatter = String,
  barFormatter = String,
  xTickInterval,
}: PrintSvgComboChartProps) {
  if (!data.length) {
    return (
      <svg width={width} height={height}>
        <text x={width / 2} y={height / 2} textAnchor="middle" fontSize={12} fill={COLORS.gray400}>
          Нет данных
        </text>
      </svg>
    );
  }

  const M = { ...CHART_MARGIN, right: 60 };
  const plotW = width - M.left - M.right;
  const plotH = height - M.top - M.bottom;

  const maxArea = Math.max(...data.map((d) => d.areaValue), 1);
  const maxBar = Math.max(...data.map((d) => d.barValue), 1);

  const xScale = (i: number) => M.left + (i / Math.max(data.length - 1, 1)) * plotW;
  const yArea = (v: number) => M.top + plotH - (v / maxArea) * plotH;
  const yBar = (v: number) => M.top + plotH - (v / maxBar) * plotH;
  const baseline = M.top + plotH;

  // Bar width
  const barW = Math.max(2, Math.min(16, (plotW / data.length) * 0.4));

  // Area points
  const areaPoints = data.map((d, i) => ({ x: xScale(i), y: yArea(d.areaValue) }));
  const areaPath =
    `M ${areaPoints[0].x} ${areaPoints[0].y} ` +
    areaPoints
      .slice(1)
      .map((p) => `L ${p.x} ${p.y}`)
      .join(' ') +
    ` L ${areaPoints[areaPoints.length - 1].x} ${baseline} L ${areaPoints[0].x} ${baseline} Z`;
  const linePath =
    `M ${areaPoints[0].x} ${areaPoints[0].y} ` +
    areaPoints
      .slice(1)
      .map((p) => `L ${p.x} ${p.y}`)
      .join(' ');

  const gridSteps = [0.25, 0.5, 0.75, 1.0];
  const interval = xTickInterval ?? Math.max(1, Math.floor(data.length / 10));

  return (
    <svg width={width} height={height} style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Grid */}
      {gridSteps.map((f) => (
        <line
          key={f}
          x1={M.left}
          y1={yArea(maxArea * f)}
          x2={M.left + plotW}
          y2={yArea(maxArea * f)}
          stroke={COLORS.gray200}
          strokeDasharray="4 4"
        />
      ))}

      {/* Bars */}
      {data.map((d, i) => (
        <rect
          key={i}
          x={xScale(i) - barW / 2}
          y={yBar(d.barValue)}
          width={barW}
          height={baseline - yBar(d.barValue)}
          rx={2}
          fill={barColor}
          opacity={0.35}
        />
      ))}

      {/* Area */}
      <path d={areaPath} fill={areaFillColor} />
      <path d={linePath} fill="none" stroke={areaColor} strokeWidth={2} strokeLinejoin="round" />

      {/* Y left axis labels (area) */}
      {gridSteps.map((f) => (
        <text key={f} x={M.left - 8} y={yArea(maxArea * f) + 4} textAnchor="end" fontSize={9} fill={COLORS.gray400}>
          {areaFormatter(maxArea * f)}
        </text>
      ))}

      {/* Y right axis labels (bars) */}
      {gridSteps.map((f) => (
        <text
          key={f}
          x={M.left + plotW + 8}
          y={yBar(maxBar * f) + 4}
          textAnchor="start"
          fontSize={9}
          fill={COLORS.gray400}
        >
          {barFormatter(maxBar * f)}
        </text>
      ))}

      {/* Baseline */}
      <line x1={M.left} y1={baseline} x2={M.left + plotW} y2={baseline} stroke={COLORS.gray300} />

      {/* X labels */}
      {data.map((d, i) =>
        i % interval === 0 ? (
          <text key={i} x={xScale(i)} y={height - 6} textAnchor="middle" fontSize={9} fill={COLORS.gray400}>
            {d.label}
          </text>
        ) : null,
      )}

      {/* Legend */}
      <circle cx={M.left + 10} cy={M.top - 6} r={4} fill={areaColor} />
      <text x={M.left + 18} y={M.top - 2} fontSize={10} fill={COLORS.gray700}>
        {areaLabel}
      </text>
      <rect x={M.left + 90} y={M.top - 10} width={8} height={8} rx={2} fill={barColor} opacity={0.5} />
      <text x={M.left + 102} y={M.top - 2} fontSize={10} fill={COLORS.gray700}>
        {barLabel}
      </text>
    </svg>
  );
}
