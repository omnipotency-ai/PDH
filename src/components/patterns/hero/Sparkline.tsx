import { useId } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// ── Types ────────────────────────────────────────────────────────────────────

export interface SparklineDataPoint {
  /** Date key in YYYY-MM-DD format */
  dateKey: string;
  /** The numeric value to plot */
  value: number;
}

interface SparklineProps {
  data: SparklineDataPoint[];
  /** CSS color token or value for stroke and fill */
  color: string;
  /** Chart height in pixels. Default 64. */
  height?: number;
  /** Y-axis label shown as axis label (e.g., "Bristol", "Count") */
  yLabel?: string;
  /** Unit shown after value in tooltip (e.g., "avg", "BMs") */
  unit?: string;
  /** Y-axis domain: [min, max]. If omitted, Recharts auto-scales. */
  yDomain?: [number, number];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Format "YYYY-MM-DD" → "Mar 5" */
function formatDateLabel(dateKey: string): string {
  const [yearStr, monthStr, dayStr] = dateKey.split("-");
  const date = new Date(Number(yearStr), Number(monthStr) - 1, Number(dayStr));
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Custom Tooltip ───────────────────────────────────────────────────────────

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: SparklineDataPoint }>;
  color: string;
  unit?: string;
}

function CustomTooltip({ active, payload, color, unit }: CustomTooltipProps) {
  if (!active || !payload?.length) {
    return null;
  }
  const point = payload[0];
  const dateLabel = formatDateLabel(point.payload.dateKey);
  const valueDisplay = Number.isInteger(point.value) ? String(point.value) : point.value.toFixed(1);

  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-xs shadow-lg">
      <p className="text-[var(--text-faint)]">{dateLabel}</p>
      <p className="font-medium" style={{ color }}>
        {valueDisplay}
        {unit ? ` ${unit}` : ""}
      </p>
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export function Sparkline({ data, color, height = 64, yLabel, unit, yDomain }: SparklineProps) {
  const gradientId = useId();

  if (data.length === 0) {
    return null;
  }

  const chartLabel = yLabel ? `Sparkline chart: ${yLabel}` : "Sparkline chart";

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart
        data={data}
        margin={{ top: 4, right: 4, bottom: 0, left: yLabel ? -12 : -20 }}
        role="img"
        aria-label={chartLabel}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>

        <XAxis
          dataKey="dateKey"
          tickFormatter={formatDateLabel}
          tick={{ fontSize: 9, fill: "var(--text-faint)" }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
          minTickGap={20}
        />

        <YAxis
          tick={{ fontSize: 9, fill: "var(--text-faint)" }}
          axisLine={false}
          tickLine={false}
          width={28}
          {...(yDomain !== undefined && { domain: yDomain })}
          allowDecimals={false}
          {...(yLabel !== undefined && {
            label: {
              value: yLabel,
              angle: -90,
              position: "insideLeft",
              offset: 16,
              style: { fontSize: 9, fill: "var(--text-faint)" },
            },
          })}
        />

        <Tooltip
          content={<CustomTooltip color={color} {...(unit !== undefined && { unit })} />}
          cursor={{ stroke: "var(--border-strong)", strokeDasharray: "3 3" }}
        />

        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={{
            r: 3,
            fill: color,
            stroke: "var(--surface-3)",
            strokeWidth: 2,
          }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
