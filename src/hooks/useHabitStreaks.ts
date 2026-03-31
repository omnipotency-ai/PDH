import { useMemo } from "react";
import { formatLocalDateKey } from "@/lib/dateUtils";
import type { HabitDaySummary, HabitStreakSummary } from "@/lib/habitAggregates";
import { computeDaySummaries, computeStreakSummary } from "@/lib/habitAggregates";
import type { HabitConfig, HabitLog } from "@/lib/habitTemplates";

interface UseHabitStreaksParams {
  habitLogs: HabitLog[];
  habits: HabitConfig[];
  now: Date;
}

interface UseHabitStreaksResult {
  daySummaries: HabitDaySummary[];
  streakSummaries: Record<string, HabitStreakSummary>;
}

export function useHabitStreaks({
  habitLogs,
  habits,
  now,
}: UseHabitStreaksParams): UseHabitStreaksResult {
  const todayKey = formatLocalDateKey(now);

  // Derive from todayKey (not now) so recomputation only fires on calendar-date change,
  // not on every 60-second timer tick that updates `now`.
  const last7DaysRange = useMemo(() => {
    const end = new Date(`${todayKey}T12:00:00`);
    const start = new Date(`${todayKey}T12:00:00`);
    start.setDate(start.getDate() - 6);
    return {
      start: formatLocalDateKey(start),
      end: formatLocalDateKey(end),
    };
  }, [todayKey]);

  const daySummaries = useMemo(
    () => computeDaySummaries(habitLogs, habits, last7DaysRange),
    [habitLogs, habits, last7DaysRange],
  );

  const streakSummaries = useMemo(() => {
    const result: Record<string, HabitStreakSummary> = {};
    for (const habit of habits) {
      result[habit.id] = computeStreakSummary(daySummaries, habit.id, 7);
    }
    return result;
  }, [habits, daySummaries]);

  return { daySummaries, streakSummaries };
}
