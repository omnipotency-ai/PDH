/**
 * CircularProgressRing — pure presentational SVG progress ring.
 *
 * Renders a background track circle, a progress arc, and centred text
 * showing the current value and goal. No internal state.
 */

// ── Ring geometry constants ────────────────────────────────────────────────────

const RING = {
  SIZE: 160,
  STROKE: 10,
  get RADIUS() {
    return (this.SIZE - this.STROKE) / 2;
  },
  get CIRCUMFERENCE() {
    return 2 * Math.PI * this.RADIUS;
  },
} as const;

// ── Types ──────────────────────────────────────────────────────────────────────

interface CircularProgressRingProps {
  value: number;
  goal: number;
  color: string;
  size?: number;
  strokeWidth?: number;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function CircularProgressRing({
  value,
  goal,
  color,
  size = RING.SIZE,
  strokeWidth = RING.STROKE,
}: CircularProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const safeGoal = goal > 0 ? goal : 1;
  const progressFraction = Math.min(value / safeGoal, 1);
  const strokeDashoffset = circumference * (1 - progressFraction);
  const colorMuted = `${color}1F`; // ~12% opacity hex suffix

  return (
    <div data-slot="circular-progress-ring" className="relative">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="rotate-[-90deg]"
        role="img"
        aria-label={`Progress: ${value} of ${goal}`}
      >
        <title>Progress ring</title>
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colorMuted}
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        {/* stroke-dashoffset is not a standard Tailwind transition target — inline style required */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: "stroke-dashoffset 0.4s ease" }}
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-display text-2xl font-bold tabular-nums"
          style={{ color: "var(--text)" }}
        >
          {value}
        </span>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          / {goal} ml
        </span>
      </div>
    </div>
  );
}
