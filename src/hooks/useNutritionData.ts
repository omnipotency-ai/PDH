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
import {
  calculateTotalCalories,
  calculateTotalMacros,
  calculateWaterIntake,
  getCurrentMealSlot,
  getMealSlot,
  groupByMealSlot,
  type MacroTotals,
  type MealSlot,
} from "@/lib/nutritionUtils";
import type { SyncedLog } from "@/lib/sync";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Midnight of today in the user's local timezone. */
function getTodayMidnight(): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.getTime();
}

/** Midnight 7 days ago in the user's local timezone. */
function getSevenDaysAgoMidnight(): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  now.setDate(now.getDate() - 7);
  return now.getTime();
}

/** Milliseconds from now until the next local midnight. */
function msUntilNextMidnight(): number {
  const now = new Date();
  const tomorrow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  );
  return tomorrow.getTime() - now.getTime();
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
  /** Food + liquid logs for today. */
  todayFoodLogs: FoodPipelineLog[];
  /** Fluid logs for today. */
  todayFluidLogs: FluidSyncedLog[];
  /** Total estimated calories from today's food + liquid logs. */
  totalCaloriesToday: number;
  /** Macronutrient totals from today's food + liquid logs. */
  totalMacrosToday: MacroTotals;
  /** Total water intake today in ml. */
  waterIntakeToday: number;
  /** Calorie subtotal per meal slot from today's food + liquid logs. */
  caloriesByMealSlot: Record<MealSlot, number>;
  /** Today's food + liquid logs grouped by meal slot. */
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
    // Timer aligned to next midnight (+ 100ms buffer to avoid edge-case).
    const timerId = setTimeout(() => {
      checkDayChange();
    }, msUntilNextMidnight() + 100);

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

export function useNutritionData(): NutritionData {
  const logs = useSyncedLogsContext();
  const { dailyCalorieGoal, dailyWaterGoalMl } = useNutritionGoals();

  // Stable "today" key that updates on day boundaries (midnight timer +
  // visibilitychange). Downstream memos recompute when the day changes.
  const todayKey = useTodayKey();

  // Split logs into today's food+liquid and fluid logs.
  const { todayFoodLogs, todayFluidLogs } = useMemo(() => {
    const todayMidnight = Number(todayKey);
    const foodLogs: FoodPipelineLog[] = [];
    const fluidLogs: FluidSyncedLog[] = [];

    for (const log of logs) {
      if (log.timestamp < todayMidnight) continue;

      if (isFoodPipelineLog(log)) {
        foodLogs.push(log);
      } else if (log.type === "fluid") {
        fluidLogs.push(log);
      }
    }

    return { todayFoodLogs: foodLogs, todayFluidLogs: fluidLogs };
  }, [logs, todayKey]);

  // Derive calorie total.
  const totalCaloriesToday = useMemo(
    () => calculateTotalCalories(todayFoodLogs),
    [todayFoodLogs],
  );

  // Derive macro totals.
  const totalMacrosToday = useMemo(
    () => calculateTotalMacros(todayFoodLogs),
    [todayFoodLogs],
  );

  // Derive water intake.
  const waterIntakeToday = useMemo(
    () => calculateWaterIntake(todayFluidLogs),
    [todayFluidLogs],
  );

  // Group today's food logs by meal slot.
  const logsByMealSlot = useMemo(
    () => groupByMealSlot(todayFoodLogs),
    [todayFoodLogs],
  );

  // Calculate calories per meal slot.
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

  // Current meal slot based on time of day. No memo — getCurrentMealSlot() is
  // cheap (one Date + a short loop) and recomputes on every render triggered
  // by Convex subscription updates, keeping the slot fresh.
  const currentMealSlot = getCurrentMealSlot();

  // Recent foods: canonical names from last 7 days, most recent first, deduped, max 50.
  // Computes both all-slot and per-slot lists in one pass.
  const { slotRecentFoods, allRecentFoods } = useMemo(() => {
    const sevenDaysAgo = getSevenDaysAgoMidnight();
    const seenAll = new Set<string>();
    const seenSlot = new Set<string>();
    const allResult: string[] = [];
    const slotResult: string[] = [];

    // Logs arrive descending (most recent first) from Convex query. Iterate forward.
    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
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

      // Early exit once both lists are full
      if (allResult.length >= 50 && slotResult.length >= 50) break;
    }

    return {
      slotRecentFoods: slotResult.slice(0, 50),
      allRecentFoods: allResult.slice(0, 50),
    };
  }, [logs, currentMealSlot]);

  // Fall back to global recents if no slot-specific foods exist.
  const recentFoods =
    slotRecentFoods.length > 0 ? slotRecentFoods : allRecentFoods;

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
