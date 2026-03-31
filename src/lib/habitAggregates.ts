import { formatLocalDateKey } from "./dateUtils";
import type { HabitConfig, HabitLog } from "./habitTemplates";

// --- Today counts ---

/**
 * Compute total values per habit for today from a flat list of HabitLogs.
 * Uses an exclusive upper bound so logs from tomorrow are never counted.
 */
export function computeTodayHabitCounts(
  habitLogs: ReadonlyArray<{ habitId: string; value: number; at: number }>,
  todayStart: number,
  todayEnd: number,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const log of habitLogs) {
    if (log.at >= todayStart && log.at < todayEnd) {
      counts[log.habitId] = (counts[log.habitId] ?? 0) + log.value;
    }
  }
  return counts;
}

// --- Goal helpers ---

/** Return the daily goal for a habit (dailyTarget for positive, dailyCap for destructive, 0 otherwise). */
export function getHabitGoal(habit: HabitConfig): number {
  if (habit.kind === "positive" && habit.dailyTarget !== undefined) return habit.dailyTarget;
  if (habit.kind === "destructive" && habit.dailyCap !== undefined) return habit.dailyCap;
  return 0;
}

// --- Types ---

export interface HabitDaySummary {
  date: string; // 'YYYY-MM-DD'
  habitId: string;
  totalValue: number; // sum of HabitLog values for this day
  isGoodDay: boolean; // positive: totalValue >= dailyTarget, destructive: totalValue <= dailyCap
}

export interface HabitStreakSummary {
  habitId: string;
  currentGoodStreak: number; // consecutive good days ending today
  goodDaysInWindow: number; // e.g., good days in last 7
  windowSize: number; // typically 7
}

// --- Helpers ---

/** Convert a timestamp to 'YYYY-MM-DD' date string. */
function timestampToDateString(timestamp: number): string {
  return formatLocalDateKey(timestamp);
}

/**
 * Generate all date strings (YYYY-MM-DD) from start to end, inclusive.
 * Both start and end must be 'YYYY-MM-DD' format.
 */
function generateDateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const current = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);

  while (current <= endDate) {
    dates.push(formatLocalDateKey(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/**
 * Determine whether a day is "good" for a given habit based on its kind and goal.
 * - positive with dailyTarget: totalValue >= dailyTarget
 * - destructive with dailyCap: totalValue <= dailyCap
 * - no target/cap: always true
 */
function isGoodDay(totalValue: number, habit: HabitConfig): boolean {
  if (habit.kind === "positive" && habit.dailyTarget !== undefined) {
    return totalValue >= habit.dailyTarget;
  }
  if (habit.kind === "destructive" && habit.dailyCap !== undefined) {
    return totalValue <= habit.dailyCap;
  }
  // No target or cap set — always considered a good day
  return true;
}

// --- Computation functions ---

/**
 * Compute per-day summaries for each habit within the given date range.
 * Returns one HabitDaySummary per habit per day, including days with no logs (totalValue: 0).
 */
export function computeDaySummaries(
  habitLogs: HabitLog[],
  habits: HabitConfig[],
  dateRange: { start: string; end: string },
): HabitDaySummary[] {
  const dates = generateDateRange(dateRange.start, dateRange.end);

  // Group log values by "habitId|date"
  const logTotals = new Map<string, number>();
  for (const log of habitLogs) {
    const dateStr = timestampToDateString(log.at);
    // Only include logs within the date range
    if (dateStr < dateRange.start || dateStr > dateRange.end) {
      continue;
    }
    const key = `${log.habitId}|${dateStr}`;
    logTotals.set(key, (logTotals.get(key) ?? 0) + log.value);
  }

  // Build summaries: one per habit per day
  const summaries: HabitDaySummary[] = [];

  for (const habit of habits) {
    for (const date of dates) {
      const key = `${habit.id}|${date}`;
      const totalValue = logTotals.get(key) ?? 0;

      summaries.push({
        date,
        habitId: habit.id,
        totalValue,
        isGoodDay: isGoodDay(totalValue, habit),
      });
    }
  }

  return summaries;
}

/**
 * Compute streak summary for a single habit from its day summaries.
 * - currentGoodStreak: consecutive good days ending at the most recent date
 * - goodDaysInWindow: total good days within the last `windowSize` entries
 */
export function computeStreakSummary(
  daySummaries: HabitDaySummary[],
  habitId: string,
  windowSize: number,
): HabitStreakSummary {
  // Filter to this habit and sort by date descending (most recent first)
  const filtered = daySummaries
    .filter((s) => s.habitId === habitId)
    .sort((a, b) => b.date.localeCompare(a.date));

  // Take only the last `windowSize` days
  const windowed = filtered.slice(0, windowSize);

  // Count consecutive good days from the most recent date, bounded to window
  let currentGoodStreak = 0;
  for (const summary of windowed) {
    if (summary.isGoodDay) {
      currentGoodStreak++;
    } else {
      break;
    }
  }

  // Count total good days within window
  let goodDaysInWindow = 0;
  for (const summary of windowed) {
    if (summary.isGoodDay) {
      goodDaysInWindow++;
    }
  }

  return {
    habitId,
    currentGoodStreak,
    goodDaysInWindow,
    windowSize,
  };
}

/**
 * Returns a human-readable label like "5 of last 7 days".
 */
export function getGoodDayLabel(summary: HabitStreakSummary): string {
  return `${summary.goodDaysInWindow} of last ${summary.windowSize} days`;
}

/** Whether the habit has a meaningful daily target or cap set.
 * For destructive habits, dailyCap=0 means "zero tolerance" which IS a goal. */
export function hasGoal(habit: HabitConfig): boolean {
  if (habit.kind === "positive" && habit.dailyTarget !== undefined && habit.dailyTarget > 0) {
    return true;
  }
  if (habit.kind === "destructive" && habit.dailyCap !== undefined && habit.dailyCap !== null) {
    return true;
  }
  return false;
}

/**
 * Returns a neutral label for habits with no target, e.g., "Logged 4 of last 7 days".
 * Counts days where the habit was logged (totalValue > 0) within the given summaries.
 */
export function getNeutralSummaryLabel(
  daySummaries: HabitDaySummary[],
  habitId: string,
  windowSize: number,
): string {
  const filtered = daySummaries
    .filter((s) => s.habitId === habitId)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, windowSize);

  const loggedDays = filtered.filter((s) => s.totalValue > 0).length;
  return `Logged ${loggedDays} of last ${windowSize} days`;
}
