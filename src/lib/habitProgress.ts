import type { HabitConfig } from "@/lib/habitTemplates";
import { isCapHabit, isTargetHabit } from "@/lib/habitTemplates";
import { formatFluidDisplay, type UnitSystem } from "@/lib/units";

type ProgressTextMode = "detail" | "tile";

export type HabitProgressColor =
  | "neutral"
  | "target-in-progress"
  | "target-met"
  | "cap-clear"
  | "cap-under"
  | "cap-warning"
  | "cap-at"
  | "cap-over";

function getProgressValue(habit: HabitConfig, count: number, fluidMl: number | undefined): number {
  if (habit.logAs === "fluid" && fluidMl !== undefined) {
    // Cap habits (e.g., coffee) compare in cups, not ml
    if (isCapHabit(habit) && habit.quickIncrement > 0) {
      return Math.round(fluidMl / habit.quickIncrement);
    }
    // Target habits (e.g., water) compare in ml
    return fluidMl;
  }
  return count;
}

/** Format a number as integer or 1-decimal. Used by progress text and coaching. */
export function formatHabitNumber(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

export function getProgressText(
  habit: HabitConfig,
  count: number,
  fluidMl: number | undefined,
  mode: ProgressTextMode = "detail",
  unitSystem: UnitSystem = "metric",
): string {
  const value = getProgressValue(habit, count, fluidMl);

  if (habit.logAs === "fluid" && isCapHabit(habit)) {
    const cap = habit.dailyCap ?? 0;
    const rawMl = Math.max(0, fluidMl ?? 0);
    const fluidDisplay = formatFluidDisplay(rawMl, unitSystem);
    if (value < cap) {
      const left = cap - value;
      return `${fluidDisplay} · ${left} cup${left === 1 ? "" : "s"} left`;
    }
    if (value === cap) {
      return `${fluidDisplay} · At cap`;
    }
    const over = value - cap;
    return `${fluidDisplay} · ${over} cup${over === 1 ? "" : "s"} over`;
  }

  if (isTargetHabit(habit)) {
    const target = habit.dailyTarget ?? 0;
    const isSingleCount = target === 1 && habit.unit === "count";
    if (isSingleCount && count >= 1) {
      return "Done ✓";
    }

    // Fluid target habits (e.g. water): display value in user's unit
    if (habit.logAs === "fluid" && habit.unit === "ml") {
      const rawMl = Math.max(0, fluidMl ?? 0);
      const fluidDisplay = formatFluidDisplay(rawMl, unitSystem);
      const targetDisplay = formatFluidDisplay(target, unitSystem);
      return `${fluidDisplay} / ${targetDisplay}`;
    }

    const displayUnit =
      mode === "tile"
        ? habit.unit === "minutes"
          ? "min"
          : habit.unit === "hours"
            ? "hrs"
            : habit.unit
        : habit.unit;
    return `${value} / ${target} ${displayUnit}`;
  }

  if (isCapHabit(habit)) {
    const cap = habit.dailyCap ?? 0;

    if (value < cap) return mode === "detail" ? `${cap - value} remaining` : `${cap - value} left`;
    if (value === cap) return "At cap";
    return `${value - cap} over`;
  }

  // For fluid habits without a target or cap, still show the unit (e.g. "250 ml")
  if (habit.logAs === "fluid" && habit.unit === "ml") {
    const rawMl = Math.max(0, fluidMl ?? 0);
    return formatFluidDisplay(rawMl, unitSystem);
  }

  return `${count}`;
}

export function getProgressColor(
  habit: HabitConfig,
  count: number,
  fluidMl: number | undefined,
): HabitProgressColor {
  if (isTargetHabit(habit)) {
    const value = getProgressValue(habit, count, fluidMl);
    const target = habit.dailyTarget ?? 1;
    return value >= target ? "target-met" : "target-in-progress";
  }

  if (isCapHabit(habit)) {
    const value = getProgressValue(habit, count, fluidMl);
    const cap = habit.dailyCap ?? 1;
    if (value > cap) return "cap-over";
    if (value === cap) return "cap-at";
    if (value === 0) return "cap-clear";
    const remaining = cap - value;
    if (remaining <= 2) return "cap-warning";
    return "cap-under";
  }

  return "neutral";
}

export function shouldShowBadge(
  habit: HabitConfig,
  count: number,
  fluidMl: number | undefined,
): "check" | "warning" | null {
  const progressColor = getProgressColor(habit, count, fluidMl);
  if (progressColor === "target-met") return "check";
  if (progressColor === "cap-over") return "warning";
  return null;
}

/** Calculate progress as a fraction (0–1) of the target or cap. */
export function getProgressFraction(
  habit: HabitConfig,
  count: number,
  fluidMl: number | undefined,
): number {
  if (isTargetHabit(habit)) {
    const target = habit.dailyTarget ?? 1;
    const value = getProgressValue(habit, count, fluidMl);
    return Math.min(value / target, 1);
  }

  if (isCapHabit(habit)) {
    const cap = habit.dailyCap ?? 1;
    const value = getProgressValue(habit, count, fluidMl);
    return Math.min(value / cap, 1);
  }

  return 0;
}

/** Map a HabitProgressColor to a Tailwind background class for progress bars. */
export function getProgressBarColor(progressColor: HabitProgressColor): string {
  switch (progressColor) {
    case "target-met":
      return "bg-emerald-500";
    case "target-in-progress":
      return "bg-emerald-500/60";
    case "cap-warning":
      return "bg-orange-500";
    case "cap-at":
      return "bg-amber-500";
    case "cap-over":
      return "bg-red-500";
    case "cap-clear":
      return "bg-emerald-500";
    case "cap-under":
      return "bg-emerald-500/60";
    case "neutral":
      return "bg-[var(--text-muted)]";
  }
}
