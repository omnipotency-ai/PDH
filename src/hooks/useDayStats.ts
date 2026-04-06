import { useMemo } from "react";
import { useHabits } from "@/hooks/useProfile";
import { normalizeEpisodesCount } from "@/lib/analysis";
import { type HabitConfig, isSleepHabit } from "@/lib/habitTemplates";
import { normalizeFluidItemName } from "@/lib/normalizeFluidName";
import type { SyncedLog } from "@/lib/sync";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface UseDayStatsOptions {
  /** All synced logs (unfiltered). */
  logs: SyncedLog[];
  /** Start of today as epoch ms. */
  todayStart: number;
  /** End of today as epoch ms (todayStart + 24h). */
  todayEnd: number;
}

export interface DayStats {
  /** Logs that fall within today's time range. */
  todayLogs: SyncedLog[];
  /** Per-habit aggregated values for today (derived from synced logs). */
  todayHabitCounts: Record<string, number>;
  /** Fluid totals keyed by normalized fluid name. */
  todayFluidTotalsByName: Record<string, number>;
  /** Sum of all fluid intake in ml for today. */
  totalFluidMl: number;
  /** Water-only intake in ml for today (subset of totalFluidMl). */
  waterOnlyMl: number;
  /** Total bowel movement episode count for today. */
  todayBmCount: number;
  /** Timestamp (ms) of the most recent digestion log ever, or null. */
  lastBmTimestamp: number | null;
  /** Whether yesterday had zero logs but there are older logs (gap detection). */
  hadGapYesterday: boolean;
}

function toActivityTypeKey(value: string): string {
  const key = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (/^walk(ing)?$/.test(key)) return "walk";
  return key;
}

function getHabitsForActivityType(
  habits: HabitConfig[],
  activityType: string,
): HabitConfig[] {
  if (activityType === "sleep") {
    return habits.filter((habit) => isSleepHabit(habit));
  }
  return habits.filter(
    (habit) => toActivityTypeKey(habit.name) === activityType,
  );
}

export function useDayStats({
  logs,
  todayStart,
  todayEnd,
}: UseDayStatsOptions): DayStats {
  const { habits } = useHabits();

  const todayLogs = useMemo(
    () =>
      logs.filter(
        (log) => log.timestamp >= todayStart && log.timestamp < todayEnd,
      ),
    [logs, todayStart, todayEnd],
  );

  const todayHabitCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    for (const log of todayLogs) {
      if (log.type === "habit") {
        const habitId =
          typeof log.data?.habitId === "string" ? log.data.habitId : "";
        const quantity = Number(log.data?.quantity ?? 1);
        if (!habitId || !Number.isFinite(quantity) || quantity <= 0) continue;
        counts[habitId] = (counts[habitId] ?? 0) + quantity;
        continue;
      }

      if (log.type === "activity") {
        const activityType = toActivityTypeKey(
          String(log.data?.activityType ?? ""),
        );
        const durationMinutes = Number(log.data?.durationMinutes ?? 0);
        if (
          !activityType ||
          !Number.isFinite(durationMinutes) ||
          durationMinutes <= 0
        )
          continue;

        for (const habit of getHabitsForActivityType(habits, activityType)) {
          const value =
            habit.unit === "hours"
              ? Math.round((durationMinutes / 60) * 100) / 100
              : durationMinutes;
          counts[habit.id] = (counts[habit.id] ?? 0) + value;
        }
        continue;
      }

      if (log.type !== "fluid") continue;
      const items = log.data?.items;
      if (!Array.isArray(items)) continue;

      for (const item of items) {
        const normalizedName = normalizeFluidItemName(item?.name);
        const quantity = Number(item.quantity ?? 0);
        if (!normalizedName || !Number.isFinite(quantity) || quantity <= 0)
          continue;

        for (const habit of habits) {
          if (
            habit.logAs === "fluid" &&
            normalizeFluidItemName(habit.name) === normalizedName
          ) {
            counts[habit.id] = (counts[habit.id] ?? 0) + quantity;
          }
        }
      }
    }

    return counts;
  }, [todayLogs, habits]);

  const todayFluidTotalsByName = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const log of todayLogs) {
      if (log.type !== "fluid") continue;
      const items = log.data?.items;
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        const name = normalizeFluidItemName(item?.name);
        const qty = Number(item.quantity ?? 0);
        if (name && qty > 0) totals[name] = (totals[name] ?? 0) + qty;
      }
    }
    return totals;
  }, [todayLogs]);

  const totalFluidMl = useMemo(() => {
    let sum = 0;
    for (const ml of Object.values(todayFluidTotalsByName)) {
      sum += ml;
    }
    return sum;
  }, [todayFluidTotalsByName]);

  const waterOnlyMl = todayFluidTotalsByName.water ?? 0;

  const todayBmCount = useMemo(() => {
    let total = 0;
    for (const log of todayLogs) {
      if (log.type !== "digestion") continue;
      total += normalizeEpisodesCount(log.data?.episodesCount);
    }
    return total;
  }, [todayLogs]);

  const lastBmTimestamp = useMemo(() => {
    let latest: number | null = null;
    for (const log of logs) {
      if (log.type !== "digestion") continue;
      if (latest === null || log.timestamp > latest) latest = log.timestamp;
    }
    return latest;
  }, [logs]);

  const hadGapYesterday = useMemo(() => {
    const yesterdayStart = todayStart - MS_PER_DAY;
    const hasYesterdayLogs = logs.some(
      (log) => log.timestamp >= yesterdayStart && log.timestamp < todayStart,
    );
    if (hasYesterdayLogs) return false;
    return logs.some((log) => log.timestamp < yesterdayStart);
  }, [logs, todayStart]);

  return {
    todayLogs,
    todayHabitCounts,
    todayFluidTotalsByName,
    totalFluidMl,
    waterOnlyMl,
    todayBmCount,
    lastBmTimestamp,
    hadGapYesterday,
  };
}
