/**
 * Read-only data hook that derives nutrition summaries from SyncedLogs.
 *
 * This hook does NOT manage UI state (that is useNutritionStore in Wave 2).
 * It only reads and computes derived values from the current logs + profile.
 */

import { isFoodPipelineType } from "@shared/logTypeUtils";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSyncedLogsContext } from "@/contexts/SyncedLogsContext";
import { useNutritionGoals } from "@/hooks/useProfile";
import { getDateScopedTimestamp } from "@/lib/dateUtils";
import {
  calculateTotalCalories,
  calculateTotalMacros,
  getMealSlot,
  groupByMealSlot,
  type MacroTotals,
  type MealSlot,
} from "@/lib/nutritionUtils";
import type { SyncedLog } from "@/lib/sync";
import { MS_PER_DAY } from "@/lib/timeConstants";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Midnight of today in the user's local timezone. */
function getTodayMidnight(): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.getTime();
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Food or liquid SyncedLog narrowed to food pipeline types. */
export type FoodPipelineLog = SyncedLog & { type: "food" | "liquid" };

/** Type guard: narrows a SyncedLog to FoodPipelineLog via discriminated union. */
function isFoodPipelineLog(log: SyncedLog): log is FoodPipelineLog {
  return isFoodPipelineType(log.type);
}

/** Fluid SyncedLog narrowed to fluid type. */
type FluidSyncedLog = SyncedLog & { type: "fluid" };

export interface NutritionData {
  /** Food + liquid logs for the active day. */
  todayFoodLogs: FoodPipelineLog[];
  /** Fluid logs for the active day. */
  todayFluidLogs: FluidSyncedLog[];
  /** Total estimated calories from the active day's food + liquid logs. */
  totalCaloriesToday: number;
  /** Macronutrient totals from the active day's food + liquid logs. */
  totalMacrosToday: MacroTotals;
  /** Total water intake for the active day in ml. */
  waterIntakeToday: number;
  /** Calorie subtotal per meal slot from the active day's food + liquid logs. */
  caloriesByMealSlot: Record<MealSlot, number>;
  /** Active-day food + liquid logs grouped by meal slot. */
  logsByMealSlot: Record<MealSlot, FoodPipelineLog[]>;
  /** Daily calorie goal from profile. */
  calorieGoal: number;
  /** Daily water goal in ml from profile. */
  waterGoal: number;
  /** The current meal slot based on time of day. */
  currentMealSlot: MealSlot;
  /**
   * Canonical food names from the last 7 days scoped to the current meal slot.
   * Falls back to allRecentFoods if no slot-specific foods exist.
   * Most recent first, deduped, max 50.
   */
  recentFoods: string[];
  /** Canonical food names from the last 7 days (all slots), most recent first, deduped, max 50. */
  allRecentFoods: string[];
}

export function getNutritionDayBounds(targetDate?: Date): {
  startMs: number;
  endMs: number;
} {
  const date = targetDate ? new Date(targetDate) : new Date();
  date.setHours(0, 0, 0, 0);
  const startMs = date.getTime();
  return { startMs, endMs: startMs + MS_PER_DAY };
}

export function splitNutritionLogsForWindow(
  logs: ReadonlyArray<SyncedLog>,
  startMs: number,
  endMs: number,
): {
  todayFoodLogs: FoodPipelineLog[];
  todayFluidLogs: FluidSyncedLog[];
} {
  const foodLogs: FoodPipelineLog[] = [];
  const fluidLogs: FluidSyncedLog[] = [];

  for (const log of logs) {
    if (log.timestamp < startMs || log.timestamp >= endMs) continue;

    if (isFoodPipelineLog(log)) {
      foodLogs.push(log);
    } else if (log.type === "fluid") {
      fluidLogs.push(log);
    }
  }

  return { todayFoodLogs: foodLogs, todayFluidLogs: fluidLogs };
}

// ---------------------------------------------------------------------------
// Hook: useTodayKey — recomputes when the calendar day changes
// ---------------------------------------------------------------------------

/**
 * Returns a stable "today" key (midnight timestamp as string) that updates
 * when the calendar day changes — via a midnight-aligned timer and
 * visibilitychange listener.
 */
function useTodayKey(): string {
  const [todayKey, setTodayKey] = useState(() => String(getTodayMidnight()));

  const checkDayChange = useCallback(() => {
    const currentMidnight = String(getTodayMidnight());
    setTodayKey((prev) => (prev !== currentMidnight ? currentMidnight : prev));
  }, []);

  useEffect(() => {
    const currentDayStartMs = Number(todayKey);
    const nextMidnightMs = currentDayStartMs + MS_PER_DAY;

    // Timer aligned to next midnight (+ 100ms buffer to avoid edge-case).
    const timerId = setTimeout(
      () => {
        checkDayChange();
      },
      Math.max(0, nextMidnightMs - Date.now()) + 100,
    );

    // Also check when tab becomes visible (user returns after midnight).
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkDayChange();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearTimeout(timerId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [checkDayChange, todayKey]);

  return todayKey;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useNutritionData(targetDate?: Date): NutritionData {
  const logs = useSyncedLogsContext();
  const { dailyCalorieGoal, dailyWaterGoalMl } = useNutritionGoals();

  // Stable "today" key that updates on day boundaries (midnight timer +
  // visibilitychange). Downstream memos recompute when the day changes.
  const todayKey = useTodayKey();

  const { startMs: selectedDayStart, endMs: selectedDayEnd } = useMemo(
    () => getNutritionDayBounds(targetDate),
    [targetDate],
  );
  const activeDayStart = targetDate ? selectedDayStart : Number(todayKey);
  const activeDayEnd = targetDate ? selectedDayEnd : activeDayStart + MS_PER_DAY;

  // Split logs into active-day food+liquid and fluid logs.
  const { todayFoodLogs, todayFluidLogs } = useMemo(
    () => splitNutritionLogsForWindow(logs, activeDayStart, activeDayEnd),
    [logs, activeDayStart, activeDayEnd],
  );

  // Derive calorie total.
  const totalCaloriesToday = useMemo(() => calculateTotalCalories(todayFoodLogs), [todayFoodLogs]);

  // Derive macro totals.
  const totalMacrosToday = useMemo(() => calculateTotalMacros(todayFoodLogs), [todayFoodLogs]);

  // Derive water intake.
  const waterIntakeToday = useMemo(() => {
    let total = 0;
    for (const log of todayFluidLogs) {
      for (const item of log.data.items) {
        total += Number(item.quantity ?? 0);
      }
    }
    return total;
  }, [todayFluidLogs]);

  // Group today's food logs by meal slot.
  const logsByMealSlot = useMemo(() => groupByMealSlot(todayFoodLogs), [todayFoodLogs]);

  // Calculate calories per meal slot.
  // Intentionally simple: 4 calls over small arrays. Single-pass accumulation not worth the complexity.
  const caloriesByMealSlot = useMemo(() => {
    const result: Record<MealSlot, number> = {
      breakfast: 0,
      lunch: 0,
      dinner: 0,
      snack: 0,
    };
    for (const slot of ["breakfast", "lunch", "dinner", "snack"] as const) {
      result[slot] = calculateTotalCalories(logsByMealSlot[slot]);
    }
    return result;
  }, [logsByMealSlot]);

  // Current meal slot based on the active day plus the current clock time.
  const currentMealSlot = targetDate
    ? getMealSlot(getDateScopedTimestamp(targetDate))
    : getMealSlot(Date.now());

  // Recent foods: canonical names from last 7 days, most recent first, deduped, max 50.
  // Computes both all-slot and per-slot lists in one pass.
  const { slotRecentFoods, allRecentFoods } = useMemo(() => {
    const sevenDaysAgo = activeDayStart - 7 * MS_PER_DAY;
    const seenAll = new Set<string>();
    const seenSlot = new Set<string>();
    const allResult: string[] = [];
    const slotResult: string[] = [];

    // Logs arrive descending (most recent first) from Convex query. Iterate forward.
    for (const log of logs) {
      if (log.timestamp >= activeDayEnd) continue;
      if (log.timestamp < sevenDaysAgo) break;

      if (!isFoodPipelineLog(log)) continue;

      const logSlot = getMealSlot(log.timestamp);

      for (const item of log.data.items) {
        const canonical = item.canonicalName;
        if (canonical == null) continue;

        // Add to all-slot list
        if (!seenAll.has(canonical)) {
          seenAll.add(canonical);
          allResult.push(canonical);
        }

        // Add to slot-specific list
        if (logSlot === currentMealSlot && !seenSlot.has(canonical)) {
          seenSlot.add(canonical);
          slotResult.push(canonical);
        }
      }

      // Early exit only if both lists are full — slot list may never reach 50
      if (allResult.length >= 50 && slotResult.length >= 50) break;
    }

    return {
      slotRecentFoods: slotResult.slice(0, 50),
      allRecentFoods: allResult.slice(0, 50),
    };
  }, [logs, currentMealSlot, activeDayEnd, activeDayStart]);

  // Fall back to global recents if no slot-specific foods exist.
  // Both branches are stable memo references — no new array allocated
  const recentFoods = slotRecentFoods.length > 0 ? slotRecentFoods : allRecentFoods;

  return {
    todayFoodLogs,
    todayFluidLogs,
    totalCaloriesToday,
    totalMacrosToday,
    waterIntakeToday,
    caloriesByMealSlot,
    logsByMealSlot,
    calorieGoal: dailyCalorieGoal,
    waterGoal: dailyWaterGoalMl,
    currentMealSlot,
    recentFoods,
    allRecentFoods,
  };
}
