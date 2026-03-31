import { format } from "date-fns";
import { useMemo, useState } from "react";
import { formatWeight } from "@/lib/formatWeight";

// ── Chart constants ─────────────────────────────────────────────────────────

const CHART_WIDTH = 320;
const CHART_HEIGHT = 160;
const CHART_PADDING_LEFT = 40;
const CHART_PADDING_RIGHT = 14;
const CHART_PADDING_TOP = 14;
const CHART_PADDING_BOTTOM = 24;
const CHART_PLOT_WIDTH = CHART_WIDTH - CHART_PADDING_LEFT - CHART_PADDING_RIGHT;
const CHART_PLOT_HEIGHT = CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM;

// ── Chart data computation ──────────────────────────────────────────────────

interface ChartPoint {
  x: number;
  y: number;
  valueKg: number;
  date: string;
}

interface ChartData {
  points: ChartPoint[];
  yMin: number;
  yMax: number;
  targetY: number | null;
  yTicks: number[];
}

function computeChartData(
  weightLogs: Array<{ timestamp: number; data: { weightKg: number } }>,
  targetWeightKg: number | null,
  startingWeightKg: number | null,
): ChartData {
  // Filter out corrupt NaN/Infinity weight values before computing chart data
  const validLogs = weightLogs.filter((l) => Number.isFinite(l.data.weightKg));

  if (validLogs.length === 0) {
    return { points: [], yMin: 0, yMax: 1, targetY: null, yTicks: [] };
  }

  const allValues = validLogs.map((l) => l.data.weightKg);
  if (targetWeightKg != null) allValues.push(targetWeightKg);
  if (startingWeightKg != null) allValues.push(startingWeightKg);

  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const yMin = rawMin - 1;
  const yMax = rawMax + 1;
  const yRange = Math.max(0.0001, yMax - yMin);

  const toY = (val: number) => CHART_PADDING_TOP + ((yMax - val) / yRange) * CHART_PLOT_HEIGHT;
  const toX = (idx: number, total: number) =>
    total <= 1
      ? CHART_PADDING_LEFT + CHART_PLOT_WIDTH / 2
      : CHART_PADDING_LEFT + (idx / (total - 1)) * CHART_PLOT_WIDTH;

  const points: ChartPoint[] = validLogs.map((log, index) => ({
    x: toX(index, validLogs.length),
    y: toY(log.data.weightKg),
    valueKg: log.data.weightKg,
    date: format(new Date(log.timestamp), "d MMM"),
  }));

  const targetY = targetWeightKg != null ? toY(targetWeightKg) : null;

  // Generate 3-5 Y-axis ticks
  const tickCount = 4;
  const step = yRange / (tickCount - 1);
  const yTicks: number[] = [];
  for (let i = 0; i < tickCount; i++) {
    yTicks.push(yMin + step * i);
  }

  return { points, yMin, yMax, targetY, yTicks };
}

// ── Component ───────────────────────────────────────────────────────────────

interface WeightTrendChartProps {
  weightLogs: Array<{ timestamp: number; data: { weightKg: number } }>;
  targetWeightKg: number | null;
  startingWeightKg: number | null;
  displayWeightUnit: "kg" | "lbs" | "stones";
}

export function WeightTrendChart({
  weightLogs,
  targetWeightKg,
  startingWeightKg,
  displayWeightUnit,
}: WeightTrendChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const chart = useMemo(
    () => computeChartData(weightLogs, targetWeightKg, startingWeightKg),
    [weightLogs, targetWeightKg, startingWeightKg],
  );

  if (chart.points.length === 0) {
    return (
      <p className="text-xs text-[var(--text-muted)]">Log a weigh-in to see your trend line.</p>
    );
  }

  const isSinglePoint = chart.points.length === 1;
  const polylinePoints = chart.points.map((p) => `${p.x},${p.y}`).join(" ");
  const yRange = Math.max(0.0001, chart.yMax - chart.yMin);
  const toY = (val: number) =>
    CHART_PADDING_TOP + ((chart.yMax - val) / yRange) * CHART_PLOT_HEIGHT;

  // X-axis: up to 5 evenly-spaced date labels
  const xAxisDates: Array<{ label: string; x: number }> = [];
  if (chart.points.length > 0) {
    const maxLabels = Math.min(5, chart.points.length);
    const indices: number[] = [];
    if (maxLabels === 1) {
      indices.push(0);
    } else {
      for (let i = 0; i < maxLabels; i++) {
        indices.push(Math.round((i / (maxLabels - 1)) * (chart.points.length - 1)));
      }
    }
    for (const idx of indices) {
      xAxisDates.push({
        label: chart.points[idx].date,
        x: chart.points[idx].x,
      });
    }
  }

  // Progress-toward-goal bar: percentage of distance covered from starting to target
  let progressPercent: number | null = null;
  if (targetWeightKg != null && startingWeightKg != null && chart.points.length > 0) {
    const latestKg = chart.points[chart.points.length - 1].valueKg;
    const totalDelta = targetWeightKg - startingWeightKg;
    const achievedDelta = latestKg - startingWeightKg;
    if (Math.abs(totalDelta) > 0.01) {
      progressPercent = Math.max(0, (achievedDelta / totalDelta) * 100);
    }
  }

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="h-40 w-full"
        role="img"
        aria-label="Weight trend chart"
        onMouseLeave={() => setHoveredIndex(null)}
        onTouchEnd={() => setHoveredIndex(null)}
      >
        {/* Y-axis ticks and labels */}
        {chart.yTicks.map((tick) => {
          const y = toY(tick);
          return (
            <g key={tick}>
              <line
                x1={CHART_PADDING_LEFT}
                y1={y}
                x2={CHART_WIDTH - CHART_PADDING_RIGHT}
                y2={y}
                stroke="var(--text-faint)"
                strokeWidth="0.5"
                strokeDasharray="3 3"
                opacity={0.4}
              />
              <text
                x={CHART_PADDING_LEFT - 4}
                y={y + 3}
                textAnchor="end"
                fill="var(--text-faint)"
                fontSize="8"
                fontFamily="monospace"
              >
                {formatWeight(tick, displayWeightUnit).replace(/ (kg|lbs|st)$/, "")}
              </text>
            </g>
          );
        })}

        {/* Target weight line */}
        {chart.targetY != null && (
          <>
            <line
              x1={CHART_PADDING_LEFT}
              y1={chart.targetY}
              x2={CHART_WIDTH - CHART_PADDING_RIGHT}
              y2={chart.targetY}
              stroke="var(--section-habits)"
              strokeDasharray="5 4"
              strokeWidth="1.5"
            />
            <text
              x={CHART_WIDTH - CHART_PADDING_RIGHT}
              y={chart.targetY - 4}
              textAnchor="end"
              fill="var(--section-habits)"
              fontSize="8"
              fontFamily="monospace"
            >
              target
            </text>
          </>
        )}

        {/* Single point renders a larger circle + label instead of invisible polyline */}
        {isSinglePoint ? (
          <>
            <circle
              cx={chart.points[0].x}
              cy={chart.points[0].y}
              r={6}
              fill="var(--section-weight)"
            />
            <text
              x={chart.points[0].x}
              y={chart.points[0].y - 12}
              textAnchor="middle"
              fill="var(--section-weight)"
              fontSize="10"
              fontWeight="bold"
              fontFamily="monospace"
            >
              {formatWeight(chart.points[0].valueKg, displayWeightUnit)}
            </text>
          </>
        ) : (
          <>
            {/* Data line */}
            <polyline
              points={polylinePoints}
              fill="none"
              stroke="var(--section-weight)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Data points */}
            {chart.points.map((point, index) => (
              // biome-ignore lint/a11y/noStaticElementInteractions: SVG circle cannot use role=button (useSemanticElements conflict)
              <circle
                key={`point-${point.date}-${point.valueKg}`}
                cx={point.x}
                cy={point.y}
                r={hoveredIndex === index ? 5 : 3}
                fill="var(--section-weight)"
                className="cursor-pointer transition-all"
                aria-label={`Data point: ${point.date}`}
                onMouseEnter={() => setHoveredIndex(index)}
                onTouchStart={() => setHoveredIndex(index)}
              />
            ))}
          </>
        )}

        {/* X-axis date labels — up to 5 evenly-spaced */}
        {xAxisDates.map((item, i) => (
          <text
            key={`xdate-${item.label}-${item.x}`}
            x={item.x}
            y={CHART_HEIGHT - 4}
            textAnchor={i === 0 ? "start" : i === xAxisDates.length - 1 ? "end" : "middle"}
            fill="var(--text-faint)"
            fontSize="8"
            fontFamily="monospace"
          >
            {item.label}
          </text>
        ))}
      </svg>

      {/* Progress toward goal bar */}
      {progressPercent !== null && (
        <div className="mt-2 space-y-1">
          <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
            <span>{progressPercent > 100 ? "Target exceeded" : "Progress to goal"}</span>
            <span
              className={`font-mono font-semibold ${progressPercent > 100 ? "text-emerald-500" : "text-[var(--section-weight)]"}`}
            >
              {Math.round(progressPercent)}%
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-3)]">
            <div
              className={`h-full rounded-full transition-all ${progressPercent > 100 ? "bg-emerald-500" : "bg-[var(--section-weight)]"}`}
              style={{ width: `${Math.min(progressPercent, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Tooltip with clamped position to stay within chart bounds */}
      {hoveredIndex !== null && chart.points[hoveredIndex] && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border bg-[var(--surface-2)] px-2 py-1 text-xs shadow-sm"
          style={{
            left: `${Math.min(95, Math.max(5, (chart.points[hoveredIndex].x / CHART_WIDTH) * 100))}%`,
            top: `${Math.min(80, Math.max(5, (chart.points[hoveredIndex].y / CHART_HEIGHT) * 100 - 20))}%`,
            transform: "translateX(-50%)",
          }}
        >
          <p className="font-mono font-semibold text-[var(--text)]">
            {formatWeight(chart.points[hoveredIndex].valueKg, displayWeightUnit)}
          </p>
          <p className="text-[var(--text-muted)]">{chart.points[hoveredIndex].date}</p>
        </div>
      )}
    </div>
  );
}
