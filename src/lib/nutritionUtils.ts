/**
 * Pure nutrition utility functions.
 *
 * These functions derive nutrition summaries from log data and the
 * FOOD_PORTION_DATA registry. They have no React dependencies and
 * are fully testable in isolation.
 */

import { FOOD_PORTION_DATA } from "@shared/foodPortionData";
import type { FluidLogData, FoodItem, FoodLogData } from "@/types/domain";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

export interface MacroTotals {
  protein: number;
  carbs: number;
  fat: number;
  sugars: number;
  fiber: number;
}

// ---------------------------------------------------------------------------
// getMealSlot
// ---------------------------------------------------------------------------

/**
 * Determine meal slot from a timestamp.
 *
 * - Breakfast: 5am (inclusive) to 9am (exclusive)
 * - Lunch: 1pm (inclusive) to 4pm (exclusive)
 * - Dinner: 8pm (inclusive) to 11pm (exclusive)
 * - Snack: everything else
 */
export function getMealSlot(timestamp: number): MealSlot {
  const hour = new Date(timestamp).getHours();

  if (hour >= 5 && hour < 9) return "breakfast";
  if (hour >= 13 && hour < 16) return "lunch";
  if (hour >= 20 && hour < 23) return "dinner";
  return "snack";
}

// ---------------------------------------------------------------------------
// Internal: resolve portion weight for a food item
// ---------------------------------------------------------------------------

/**
 * Get the effective portion weight in grams for a food item.
 * Uses item.quantity if present, otherwise falls back to
 * FOOD_PORTION_DATA.defaultPortionG, or 0 if no data exists.
 */
function getEffectivePortionG(item: FoodItem): number {
  if (item.quantity != null && item.quantity > 0) {
    return item.quantity;
  }
  const canonical = item.canonicalName;
  if (canonical == null) return 0;
  const portionData = FOOD_PORTION_DATA.get(canonical);
  return portionData?.defaultPortionG ?? 0;
}

// ---------------------------------------------------------------------------
// calculateTotalCalories
// ---------------------------------------------------------------------------

/**
 * Calculate total calories from food + liquid logs using FOOD_PORTION_DATA.
 *
 * For each item with a canonicalName, looks up caloriesPer100g and computes:
 *   calories = caloriesPer100g * portionG / 100
 *
 * Items without a canonicalName or without portion data contribute 0.
 * Result is rounded to the nearest integer.
 */
export function calculateTotalCalories(
  logs: ReadonlyArray<{ data: { items: FoodLogData["items"] } }>,
): number {
  let total = 0;
  for (const log of logs) {
    for (const item of log.data.items) {
      const canonical = item.canonicalName;
      if (canonical == null) continue;

      const portionData = FOOD_PORTION_DATA.get(canonical);
      if (portionData?.caloriesPer100g == null) continue;

      const portionG = getEffectivePortionG(item);
      total += (portionData.caloriesPer100g * portionG) / 100;
    }
  }
  return Math.round(total);
}

// ---------------------------------------------------------------------------
// calculateTotalMacros
// ---------------------------------------------------------------------------

/**
 * Calculate total macronutrients (protein, carbs, fat, sugars, fiber)
 * from food + liquid logs.
 *
 * Uses the same portion resolution logic as calculateTotalCalories.
 * Each macro value is rounded to 1 decimal place.
 * Items without portion data contribute 0 to all macros.
 */
export function calculateTotalMacros(
  logs: ReadonlyArray<{ data: { items: FoodLogData["items"] } }>,
): MacroTotals {
  const totals: MacroTotals = {
    protein: 0,
    carbs: 0,
    fat: 0,
    sugars: 0,
    fiber: 0,
  };

  for (const log of logs) {
    for (const item of log.data.items) {
      const canonical = item.canonicalName;
      if (canonical == null) continue;

      const portionData = FOOD_PORTION_DATA.get(canonical);
      if (!portionData) continue;

      const portionG = getEffectivePortionG(item);
      const scale = portionG / 100;

      totals.protein += (portionData.proteinPer100g ?? 0) * scale;
      totals.carbs += (portionData.carbsPer100g ?? 0) * scale;
      totals.fat += (portionData.fatPer100g ?? 0) * scale;
      totals.sugars += (portionData.sugarsPer100g ?? 0) * scale;
      totals.fiber += (portionData.fiberPer100g ?? 0) * scale;
    }
  }

  // Round each macro to 1 decimal place
  totals.protein = Math.round(totals.protein * 10) / 10;
  totals.carbs = Math.round(totals.carbs * 10) / 10;
  totals.fat = Math.round(totals.fat * 10) / 10;
  totals.sugars = Math.round(totals.sugars * 10) / 10;
  totals.fiber = Math.round(totals.fiber * 10) / 10;

  return totals;
}

// ---------------------------------------------------------------------------
// groupByMealSlot
// ---------------------------------------------------------------------------

/**
 * Group timestamped records into meal slot buckets.
 * Returns a record with all four meal slots, each containing an array
 * of the input items that fall into that slot.
 */
export function groupByMealSlot<T extends { timestamp: number }>(
  logs: ReadonlyArray<T>,
): Record<MealSlot, T[]> {
  const groups: Record<MealSlot, T[]> = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: [],
  };

  for (const log of logs) {
    const slot = getMealSlot(log.timestamp);
    groups[slot].push(log);
  }

  return groups;
}

// ---------------------------------------------------------------------------
// calculateWaterIntake
// ---------------------------------------------------------------------------

/**
 * Calculate total water intake from fluid logs in ml.
 *
 * Sums all fluid log items where name is "Water" (case-insensitive).
 * Converts liters to ml when unit is "l" (case-insensitive).
 */
export function calculateWaterIntake(fluidLogs: ReadonlyArray<{ data: FluidLogData }>): number {
  let totalMl = 0;

  for (const log of fluidLogs) {
    for (const item of log.data.items) {
      if (item.name.toLowerCase() !== "water") continue;

      const unitLower = item.unit.toLowerCase();
      if (unitLower === "l") {
        totalMl += item.quantity * 1000;
      } else {
        // Default: treat as ml
        totalMl += item.quantity;
      }
    }
  }

  return totalMl;
}
