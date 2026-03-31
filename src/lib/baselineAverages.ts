/**
 * Compute baseline averages (all-time) and 24h deltas for habits, fluids,
 * weight, and digestion metrics.
 *
 * This is a pure computation module with no React or store dependencies.
 * It receives data as arguments and returns a BaselineAverages object.
 */

import { normalizeEpisodesCount } from "@/lib/analysis";
import { formatLocalDateKey } from "@/lib/dateUtils";
import type { HabitConfig, HabitLog } from "@/lib/habitTemplates";
import { isCheckboxHabit } from "@/lib/habitTemplates";
import { normalizeFluidItemName } from "@/lib/normalizeFluidName";
import type { SyncedLog } from "@/lib/sync";
import type { BaselineAverages, BaselineDelta, FluidBaseline, HabitBaseline } from "@/types/domain";

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Get the set of unique calendar day strings (YYYY-MM-DD) from an array of timestamps. */
function uniqueDays(timestamps: number[]): Set<string> {
  const days = new Set<string>();
  for (const ts of timestamps) {
    days.add(formatLocalDateKey(ts));
  }
  return days;
}

/**
 * Compute the number of calendar days spanned by a set of timestamps.
 * Returns 0 if timestamps is empty.
 * This counts from the earliest day to the latest day inclusive.
 */
function calendarDaySpan(timestamps: number[]): number {
  if (timestamps.length === 0) return 0;
  let min = timestamps[0];
  let max = timestamps[0];
  for (const ts of timestamps) {
    if (ts < min) min = ts;
    if (ts > max) max = ts;
  }
  const minDay = formatLocalDateKey(min);
  const maxDay = formatLocalDateKey(max);
  if (minDay === maxDay) return 1;
  // Parse YYYY-MM-DD to get day count
  const minDate = new Date(`${minDay}T00:00:00`);
  const maxDate = new Date(`${maxDay}T00:00:00`);
  const diffMs = maxDate.getTime() - minDate.getTime();
  return Math.round(diffMs / (24 * 60 * 60 * 1000)) + 1;
}

/** Safe division: returns 0 if divisor is 0. */
function safeDivide(numerator: number, divisor: number): number {
  return divisor === 0 ? 0 : numerator / divisor;
}

// ── Main computation ──────────────────────────────────────────────────────────

export interface ComputeBaselineInput {
  /** All synced logs (from Convex). */
  logs: SyncedLog[];
  /** User's current habit configurations. */
  habits: HabitConfig[];
  /** Habit logs from Zustand store. */
  habitLogs: HabitLog[];
  /** Today's habit counts (from computeTodayHabitCounts). */
  todayHabitCounts: Record<string, number>;
  /** Today's fluid totals by normalized name (from useDayStats). */
  todayFluidTotalsByName: Record<string, number>;
  /** Today's total fluid ml (from useDayStats). */
  todayTotalFluidMl: number;
  /** Previous lastInsightRunAt value to preserve. */
  lastInsightRunAt: number | null;
  /** Hash of today's totals at the time of the last AI insight run, for change detection. */
  lastInsightRunHash: string | null;
}

/**
 * Compute baseline averages and 24h deltas.
 *
 * The "tracking window" for each metric is the span from the earliest log
 * to the latest log of that type. This means each metric has its own
 * calendar-day denominator, which avoids deflating averages when a user
 * starts tracking a new habit midway through their journey.
 */
export function computeBaselineAverages(input: ComputeBaselineInput): BaselineAverages {
  const {
    logs,
    habits,
    habitLogs,
    todayHabitCounts,
    todayFluidTotalsByName,
    todayTotalFluidMl,
    lastInsightRunAt,
    lastInsightRunHash,
  } = input;

  const now = Date.now();

  // ── 1. Habit baselines from Zustand habitLogs ──────────────────────────────

  const habitBaselines: Record<string, HabitBaseline> = {};

  for (const habit of habits) {
    const logsForHabit = habitLogs.filter((log) => log.habitId === habit.id);
    if (logsForHabit.length === 0) {
      // No logs yet for this habit — include it with zero values
      habitBaselines[habit.id] = {
        habitId: habit.id,
        habitName: habit.name,
        habitType: habit.habitType,
        avgPerLoggedDay: 0,
        avgPerCalendarDay: 0,
        completionRate: null,
        calendarDays: 0,
        loggedDays: 0,
        unit: habit.unit,
      };
      continue;
    }

    // Per-habit tracking window: from first to last log for THIS habit
    const timestamps = logsForHabit.map((log) => log.at);
    const calendarDays = calendarDaySpan(timestamps);
    const loggedDaySet = uniqueDays(timestamps);
    const loggedDays = loggedDaySet.size;

    // Sum values per day
    const dayTotals = new Map<string, number>();
    for (const log of logsForHabit) {
      const day = formatLocalDateKey(log.at);
      dayTotals.set(day, (dayTotals.get(day) ?? 0) + log.value);
    }

    // Total value across all logs
    let totalValue = 0;
    for (const val of dayTotals.values()) {
      totalValue += val;
    }

    const avgPerLoggedDay = safeDivide(totalValue, loggedDays);
    const avgPerCalendarDay = safeDivide(totalValue, calendarDays);

    // Completion rate for checkbox habits (% of calendar days meeting target)
    let completionRate: number | null = null;
    if (isCheckboxHabit(habit) && habit.dailyTarget !== undefined && calendarDays > 0) {
      let metDays = 0;
      for (const [, val] of dayTotals) {
        if (val >= habit.dailyTarget) {
          metDays++;
        }
      }
      // Days not in dayTotals are zero-days, which don't meet target (assuming target > 0)
      completionRate = safeDivide(metDays, calendarDays);
    }

    habitBaselines[habit.id] = {
      habitId: habit.id,
      habitName: habit.name,
      habitType: habit.habitType,
      avgPerLoggedDay,
      avgPerCalendarDay,
      completionRate,
      calendarDays,
      loggedDays,
      unit: habit.unit,
    };
  }

  // ── 2. Fluid baselines from synced logs ────────────────────────────────────

  const fluidBaselines: Record<string, FluidBaseline> = {};
  let totalFluidMlAllTime = 0;
  let waterMlAllTime = 0;

  // Collect per-day per-fluid ml totals
  const fluidDayTotals = new Map<string, Map<string, number>>(); // fluidName -> day -> ml
  const allFluidTimestamps: number[] = [];

  for (const log of logs) {
    if (log.type !== "fluid") continue;
    const items = log.data?.items;
    if (!Array.isArray(items)) continue;

    allFluidTimestamps.push(log.timestamp);
    const day = formatLocalDateKey(log.timestamp);

    for (const item of items) {
      const name = normalizeFluidItemName(item?.name);
      const qty = Number(item?.quantity ?? 0);
      if (!name || qty <= 0) continue;

      if (!fluidDayTotals.has(name)) {
        fluidDayTotals.set(name, new Map());
      }
      const dayMap = fluidDayTotals.get(name);
      if (!dayMap) continue;
      dayMap.set(day, (dayMap.get(day) ?? 0) + qty);
    }
  }

  // TODO: All fluids share one calendarDaySpan (from any fluid log). This deflates
  // averages for fluids added later (e.g. tea added 2 weeks after water). Each fluid
  // should ideally have its own calendarDaySpan computed from its own timestamps.
  // Full fix is complex — requires per-fluid timestamp tracking and separate spans.
  const fluidCalendarDays = calendarDaySpan(allFluidTimestamps);

  for (const [fluidName, dayMap] of fluidDayTotals) {
    let totalMl = 0;
    for (const ml of dayMap.values()) {
      totalMl += ml;
    }
    const loggedDays = dayMap.size;
    const avgMlPerDay = safeDivide(totalMl, fluidCalendarDays);
    const avgMlPerLoggedDay = safeDivide(totalMl, loggedDays);

    fluidBaselines[fluidName] = {
      fluidName,
      avgMlPerDay,
      avgMlPerLoggedDay,
      calendarDays: fluidCalendarDays,
      loggedDays,
    };

    totalFluidMlAllTime += totalMl;
    if (fluidName === "water") {
      waterMlAllTime += totalMl;
    }
  }

  const totalFluidAvgMlPerDay = safeDivide(totalFluidMlAllTime, fluidCalendarDays);
  const waterAvgMlPerDay = safeDivide(waterMlAllTime, fluidCalendarDays);

  // ── 3. Weight baseline from synced logs ────────────────────────────────────

  let weightSum = 0;
  let weightCount = 0;
  for (const log of logs) {
    if (log.type !== "weight") continue;
    const kg = Number(log.data?.weightKg);
    if (Number.isFinite(kg) && kg > 0) {
      weightSum += kg;
      weightCount++;
    }
  }
  const avgWeightKg = weightCount > 0 ? weightSum / weightCount : null;

  // ── 4. Digestion baseline from synced logs ─────────────────────────────────

  let totalBmCount = 0;
  let bristolSum = 0;
  let bristolCount = 0;
  const digestionTimestamps: number[] = [];

  for (const log of logs) {
    if (log.type !== "digestion") continue;
    digestionTimestamps.push(log.timestamp);
    totalBmCount += normalizeEpisodesCount(log.data?.episodesCount);
    const bristol = Number(log.data?.bristolCode);
    if (Number.isFinite(bristol) && bristol >= 1 && bristol <= 7) {
      bristolSum += bristol;
      bristolCount++;
    }
  }

  const digestionCalendarDays = calendarDaySpan(digestionTimestamps);
  const avgBmPerDay = safeDivide(totalBmCount, digestionCalendarDays);
  const avgBristolScore = bristolCount > 0 ? bristolSum / bristolCount : null;

  // ── 5. 24h deltas for habits ───────────────────────────────────────────────

  const deltas: Record<string, BaselineDelta> = {};
  for (const habit of habits) {
    const baseline = habitBaselines[habit.id];
    if (!baseline || baseline.calendarDays === 0) continue;

    const todayValue = todayHabitCounts[habit.id] ?? 0;
    const baselineAvg = baseline.avgPerCalendarDay;
    const absoluteDelta = todayValue - baselineAvg;
    const percentDelta = baselineAvg !== 0 ? absoluteDelta / baselineAvg : null;

    deltas[habit.id] = {
      habitId: habit.id,
      todayValue,
      baselineAvg,
      absoluteDelta,
      percentDelta,
    };
  }

  // ── 6. 24h deltas for fluids ───────────────────────────────────────────────

  const fluidDeltas: Record<string, BaselineDelta> = {};
  for (const [fluidName, baseline] of Object.entries(fluidBaselines)) {
    const todayValue = todayFluidTotalsByName[fluidName] ?? 0;
    const baselineAvg = baseline.avgMlPerDay;
    const absoluteDelta = todayValue - baselineAvg;
    const percentDelta = baselineAvg !== 0 ? absoluteDelta / baselineAvg : null;

    fluidDeltas[fluidName] = {
      habitId: fluidName, // use fluidName as the key for fluid deltas
      todayValue,
      baselineAvg,
      absoluteDelta,
      percentDelta,
    };
  }

  // Total fluid delta
  let totalFluidDelta: BaselineDelta | null = null;
  if (fluidCalendarDays > 0) {
    const absoluteDelta = todayTotalFluidMl - totalFluidAvgMlPerDay;
    const percentDelta = totalFluidAvgMlPerDay !== 0 ? absoluteDelta / totalFluidAvgMlPerDay : null;
    totalFluidDelta = {
      habitId: "__total_fluid__",
      todayValue: todayTotalFluidMl,
      baselineAvg: totalFluidAvgMlPerDay,
      absoluteDelta,
      percentDelta,
    };
  }

  // ── 7. Change detection ────────────────────────────────────────────────────

  const todayHash = buildTodayHash(todayHabitCounts, todayFluidTotalsByName, todayTotalFluidMl);
  // Compare current today hash against the hash saved at last AI insight run.
  // When lastInsightRunHash is null (first run ever), treat as "changed" so the
  // first scheduled AI insight fires. Otherwise detect actual changes since last run.
  const changedSinceLastRun = lastInsightRunHash === null || todayHash !== lastInsightRunHash;

  return {
    habits: habitBaselines,
    fluids: fluidBaselines,
    totalFluidAvgMlPerDay,
    waterAvgMlPerDay,
    avgWeightKg,
    avgBmPerDay,
    avgBristolScore,
    deltas,
    fluidDeltas,
    totalFluidDelta,
    computedAt: now,
    lastInsightRunAt,
    changedSinceLastRun,
  };
}

/**
 * Build a simple hash string from today's totals for change detection.
 * This is intentionally simple — just a JSON-like concatenation of sorted keys and values.
 */
export function buildTodayHash(
  todayHabitCounts: Record<string, number>,
  todayFluidTotalsByName: Record<string, number>,
  todayTotalFluidMl: number,
): string {
  const habitParts = Object.keys(todayHabitCounts)
    .sort()
    .map((k) => `${k}:${todayHabitCounts[k]}`)
    .join(",");
  const fluidParts = Object.keys(todayFluidTotalsByName)
    .sort()
    .map((k) => `${k}:${todayFluidTotalsByName[k]}`)
    .join(",");
  return `h[${habitParts}]f[${fluidParts}]t${todayTotalFluidMl}`;
}
