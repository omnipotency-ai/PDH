import type { HabitProgressColor } from "@/lib/habitProgress";

// ── Tile color tint ─────────────────────────────────────────────────────

export type TileColorTint = "default" | "emerald" | "orange" | "muted" | "red";

export const TINT_BY_PROGRESS_COLOR: Record<HabitProgressColor, TileColorTint> = {
  neutral: "default",
  "target-in-progress": "default",
  "target-met": "emerald",
  "cap-clear": "default",
  "cap-under": "default",
  "cap-warning": "orange",
  "cap-at": "muted",
  "cap-over": "red",
};

export const TINT_CLASSES: Record<TileColorTint, string> = {
  default: "bg-[var(--surface-2)] border-[var(--color-border-default)]",
  emerald:
    "bg-[rgba(52,211,153,0.12)] border-[rgba(52,211,153,0.35)] dark:bg-[rgba(52,211,153,0.12)] dark:border-[rgba(52,211,153,0.35)]",
  orange:
    "bg-[rgba(251,146,60,0.12)] border-[rgba(251,146,60,0.35)] dark:bg-[rgba(251,146,60,0.12)] dark:border-[rgba(251,146,60,0.35)]",
  muted: "bg-[var(--surface-3)] border-[var(--color-border-default)] opacity-60",
  red: "bg-[rgba(248,113,113,0.12)] border-[rgba(248,113,113,0.35)] dark:bg-[rgba(248,113,113,0.12)] dark:border-[rgba(248,113,113,0.35)]",
};
