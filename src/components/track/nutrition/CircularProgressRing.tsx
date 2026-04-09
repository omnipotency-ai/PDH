/**
 * CircularProgressRing — SVG progress ring with optional dual-segment
 * and preview arcs.
 *
 * Layer order (bottom to top):
 *   1. Background track (very muted)
 *   2. Preview arc for primary value (faded primary color)
 *   3. Preview arc for secondary value (faded secondary color)
 *   4. Primary arc (total fluids — bluish-green)
 *   5. Secondary arc (water subset — sky blue, drawn over primary)
 *
 * When `animateIn` is true both arcs animate from 0 on mount via springs.
 */

import { motion, useMotionValue, useSpring } from "motion/react";
import { useEffect } from "react";

// ── Ring geometry defaults ───────────────────────────────────────────────────

const DEFAULTS = {
  SIZE: 160,
  STROKE: 10,
} as const;

// ── Types ────────────────────────────────────────────────────────────────────

interface CircularProgressRingProps {
  /** Primary value (e.g. total fluids ml). */
  value: number;
  /** Goal value. */
  goal: number;
  /** Primary colour — CSS variable or hex. */
  color: string;
  /** Optional secondary value drawn over the primary arc (e.g. water ml). */
  secondaryValue?: number;
  /** Colour for the secondary arc. */
  secondaryColor?: string;
  /** Optional preview for primary value (faded arc). */
  previewValue?: number;
  /** Optional preview for secondary value (faded arc). */
  secondaryPreviewValue?: number;
  /** Animate arcs from 0 → value on mount. */
  animateIn?: boolean;
  size?: number;
  strokeWidth?: number;
  ariaLabel?: string;
  unitLabel?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fractionToOffset(fraction: number, circumference: number): number {
  return circumference * (1 - Math.min(fraction, 1));
}

// ── Component ────────────────────────────────────────────────────────────────

export function CircularProgressRing({
  value,
  goal,
  color,
  secondaryValue,
  secondaryColor,
  previewValue,
  secondaryPreviewValue,
  animateIn = false,
  size = DEFAULTS.SIZE,
  strokeWidth = DEFAULTS.STROKE,
  ariaLabel,
  unitLabel = "ml",
}: CircularProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const safeGoal = goal > 0 ? goal : 1;
  const cx = size / 2;
  const cy = size / 2;

  // Fractions
  const primaryFraction = Math.min(value / safeGoal, 1);
  const secondaryFraction = secondaryValue != null ? Math.min(secondaryValue / safeGoal, 1) : 0;

  // Offsets
  const primaryOffset = fractionToOffset(primaryFraction, circumference);
  const secondaryOffset = fractionToOffset(secondaryFraction, circumference);

  // Preview offsets
  const primaryPreviewOffset =
    previewValue != null
      ? fractionToOffset(Math.min(previewValue / safeGoal, 1), circumference)
      : primaryOffset;
  const secondaryPreviewOffset =
    secondaryPreviewValue != null
      ? fractionToOffset(Math.min(secondaryPreviewValue / safeGoal, 1), circumference)
      : secondaryOffset;

  // Colours
  const colorMuted = `color-mix(in srgb, ${color} 12%, transparent)`;
  const primaryPreviewColor = `color-mix(in srgb, ${color} 35%, transparent)`;
  const secondaryPreviewColor =
    secondaryColor != null
      ? `color-mix(in srgb, ${secondaryColor} 35%, transparent)`
      : primaryPreviewColor;

  // ── Animated offsets via spring ─────────────────────────────────────────
  const springConfig = { stiffness: 80, damping: 20 };

  const motionPrimary = useMotionValue(animateIn ? circumference : primaryOffset);
  const springPrimary = useSpring(motionPrimary, springConfig);

  const motionSecondary = useMotionValue(animateIn ? circumference : secondaryOffset);
  const springSecondary = useSpring(motionSecondary, springConfig);

  useEffect(() => {
    motionPrimary.set(primaryOffset);
  }, [primaryOffset, motionPrimary]);

  useEffect(() => {
    motionSecondary.set(secondaryOffset);
  }, [secondaryOffset, motionSecondary]);

  // Show secondary segment?
  const hasSecondary = secondaryValue != null && secondaryColor != null;

  return (
    <div data-slot="circular-progress-ring" className="relative">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="rotate-[-90deg]"
        role="img"
        aria-label={ariaLabel ?? `Progress: ${value} of ${goal}`}
      >
        <title>Progress ring</title>

        {/* 1. Background track */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={colorMuted}
          strokeWidth={strokeWidth}
        />

        {/* 2. Preview arc — primary (faded total fluids) */}
        {previewValue != null && previewValue > value && (
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={primaryPreviewColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={primaryPreviewOffset}
            style={{ transition: "stroke-dashoffset 0.3s ease" }}
          />
        )}

        {/* 3. Preview arc — secondary (faded water) */}
        {hasSecondary &&
          secondaryPreviewValue != null &&
          secondaryPreviewValue > (secondaryValue ?? 0) && (
            <circle
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke={secondaryPreviewColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={secondaryPreviewOffset}
              style={{ transition: "stroke-dashoffset 0.3s ease" }}
            />
          )}

        {/* 4. Primary arc — total fluids (animated) */}
        <motion.circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{ strokeDashoffset: springPrimary }}
        />

        {/* 5. Secondary arc — water subset (animated, drawn over primary) */}
        {hasSecondary && (
          <motion.circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={secondaryColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            style={{ strokeDashoffset: springSecondary }}
          />
        )}
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
          / {goal} {unitLabel}
        </span>
      </div>
    </div>
  );
}
