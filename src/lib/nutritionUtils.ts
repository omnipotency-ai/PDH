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
// Meal slot boundaries (single source of truth)
// ---------------------------------------------------------------------------

/**
 * Ordered boundary table for meal slots.
 * Each entry: [startHour (inclusive), endHour (exclusive), slot].
 * Hours outside any range resolve to "snack".
 */
export const MEAL_SLOT_BOUNDARIES: ReadonlyArray<
  readonly [startHour: number, endHour: number, slot: MealSlot]
> = [
  [5, 9, "breakfast"],
  [13, 16, "lunch"],
  [20, 23, "dinner"],
] as const;

// ---------------------------------------------------------------------------
// getMealSlot
// ---------------------------------------------------------------------------

/**
 * Determine meal slot from a timestamp.
 *
 * Uses MEAL_SLOT_BOUNDARIES. Hours not covered resolve to "snack".
 */
export function getMealSlot(timestamp: number): MealSlot {
  const hour = new Date(timestamp).getHours();

  for (const [start, end, slot] of MEAL_SLOT_BOUNDARIES) {
    if (hour >= start && hour < end) return slot;
  }
  return "snack";
}

// ---------------------------------------------------------------------------
// getCurrentMealSlot
// ---------------------------------------------------------------------------

/**
 * Determine the current meal slot based on time of day.
 * Used for scoping food suggestions (e.g. recent foods) to what the user
 * is likely eating right now.
 *
 * Uses the same MEAL_SLOT_BOUNDARIES as getMealSlot. Hours not covered
 * by any boundary resolve to "snack".
 *
 * Accepts an optional Date for testability; defaults to `new Date()`.
 */
export function getCurrentMealSlot(now?: Date): MealSlot {
  const hour = (now ?? new Date()).getHours();

  for (const [start, end, slot] of MEAL_SLOT_BOUNDARIES) {
    if (hour >= start && hour < end) return slot;
  }
  return "snack";
}

// ---------------------------------------------------------------------------
// Unit alias normalization
// ---------------------------------------------------------------------------

const UNIT_ALIASES: Record<string, string> = {
  sl: "slice",
  slices: "slice",
  slice: "slice",
  pc: "piece",
  pcs: "piece",
  pieces: "piece",
  piece: "piece",
  cup: "cup",
  cups: "cup",
  tbsp: "tablespoon",
  tablespoon: "tablespoon",
  tablespoons: "tablespoon",
  tsp: "teaspoon",
  teaspoon: "teaspoon",
  teaspoons: "teaspoon",
};

function normalizeUnitLabel(label: string): string {
  const l = label.toLowerCase().trim();
  return UNIT_ALIASES[l] ?? l;
}

function lookupDefaultPortionG(canonicalName: string): number {
  return FOOD_PORTION_DATA.get(canonicalName)?.defaultPortionG ?? 0;
}

function lookupExplicitDiscreteWeightG(
  canonicalName: string | null | undefined,
  normalizedUnit: string,
): number | null {
  const portionData = FOOD_PORTION_DATA.get(canonicalName ?? "");
  if (!portionData) return null;

  if (normalizedUnit === "teaspoon") {
    return portionData.teaspoonWeightG ?? null;
  }
  if (normalizedUnit === "tablespoon") {
    return portionData.tablespoonWeightG ?? null;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Resolve portion weight for a food item (unit-aware)
// ---------------------------------------------------------------------------

/**
 * Get the effective portion weight in grams for a food item.
 *
 * Handles weight units (g, kg, oz, lb), volume units (ml, l), and discrete
 * units (sl, pc, cup, tbsp, tsp) via a customPortions-first lookup chain:
 *   1. customPortions array (user overrides)
 *   2. FOOD_PORTION_DATA.unitWeightG (static registry)
 *   3. Treat quantity as grams (best guess)
 *
 * Falls back to FOOD_PORTION_DATA.defaultPortionG when no quantity is given.
 */
export function getEffectivePortionG(
  item: FoodItem,
  customPortions?: Array<{ label: string; weightG: number }>,
): number {
  const qty = item.quantity != null && item.quantity > 0 ? item.quantity : null;
  const unit = item.unit?.toLowerCase().trim() ?? "";

  // Direct weight units — return as grams
  if (unit === "g" || unit === "") return qty ?? lookupDefaultPortionG(item.canonicalName ?? "");
  if (unit === "kg") return (qty ?? 0) * 1000;
  if (unit === "oz") return (qty ?? 0) * 28.3495;
  if (unit === "lb") return (qty ?? 0) * 453.592;

  // Volume units — return as ml (treated as grams for water-density foods)
  if (unit === "ml") return qty ?? lookupDefaultPortionG(item.canonicalName ?? "");
  if (unit === "l") return (qty ?? 0) * 1000;

  // Discrete units (sl, pc, cup, tbsp, tsp, etc.) — customPortions-first lookup chain
  if (qty != null) {
    // 1. Check customPortions for matching label
    if (customPortions) {
      const match = customPortions.find(
        (p) => normalizeUnitLabel(p.label) === normalizeUnitLabel(unit),
      );
      if (match) return qty * match.weightG;
    }
    // 2. Use explicit food-specific tsp/tbsp densities when available.
    const normalizedUnit = normalizeUnitLabel(unit);
    const explicitDiscreteWeightG = lookupExplicitDiscreteWeightG(
      item.canonicalName,
      normalizedUnit,
    );
    if (explicitDiscreteWeightG != null) {
      return qty * explicitDiscreteWeightG;
    }
    // 3. Fallback to static FOOD_PORTION_DATA unitWeightG — only when the unit
    //    is a recognized discrete alias or matches the food's naturalUnit
    const portionData = FOOD_PORTION_DATA.get(item.canonicalName ?? "");
    if (portionData?.unitWeightG) {
      const isKnownDiscrete = normalizedUnit !== unit || UNIT_ALIASES[unit] !== undefined;
      const matchesNatural =
        portionData.naturalUnit && normalizeUnitLabel(portionData.naturalUnit) === normalizedUnit;
      if (isKnownDiscrete || matchesNatural) return qty * portionData.unitWeightG;
    }
    // 4. Final fallback: treat as grams (best guess)
    return qty;
  }

  return lookupDefaultPortionG(item.canonicalName ?? "");
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
// isWaterItem
// ---------------------------------------------------------------------------

/**
 * Determine whether a fluid log item represents water.
 *
 * Matches "Water", "Water (still)", "Sparkling Water", "still water", etc.
 * Uses a startsWith heuristic on the lowercased name, plus a check for
 * names that end with "water" (e.g. "sparkling water").
 *
 * FluidLogData items have no `canonicalName` field — only `name`.
 */
function isWaterItem(name: string): boolean {
  const lower = name.toLowerCase().trim();
  return lower === "water" || lower.startsWith("water ") || lower.endsWith(" water");
}

// ---------------------------------------------------------------------------
// calculateWaterIntake
// ---------------------------------------------------------------------------

/**
 * Calculate total water intake from fluid logs in ml.
 *
 * Sums all fluid log items where name matches water (case-insensitive,
 * including variants like "Water (still)" and "Sparkling Water").
 * Converts liters to ml when unit is "l" (case-insensitive).
 */
export function calculateWaterIntake(fluidLogs: ReadonlyArray<{ data: FluidLogData }>): number {
  let totalMl = 0;

  for (const log of fluidLogs) {
    for (const item of log.data.items) {
      if (!isWaterItem(item.name)) continue;

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

// ---------------------------------------------------------------------------
// capitalize
// ---------------------------------------------------------------------------

/** Capitalize the first letter of a string. */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ---------------------------------------------------------------------------
// titleCase
// ---------------------------------------------------------------------------

/** Capitalize the first letter of each word. */
export function titleCase(str: string): string {
  return str
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// ---------------------------------------------------------------------------
// formatPortion
// ---------------------------------------------------------------------------

/** Format portion display: "150g" or "1 medium egg (50g)". */
export function formatPortion(canonicalName: string): string {
  const data = FOOD_PORTION_DATA.get(canonicalName);
  if (!data) return "";

  if (data.naturalUnit != null && data.unitWeightG != null) {
    return `${data.naturalUnit} (${data.defaultPortionG}g)`;
  }
  return `${data.defaultPortionG}g`;
}

// ---------------------------------------------------------------------------
// getDefaultCalories
// ---------------------------------------------------------------------------

/** Get calories for the default portion. */
export function getDefaultCalories(canonicalName: string): number {
  const data = FOOD_PORTION_DATA.get(canonicalName);
  if (!data || data.caloriesPer100g == null) return 0;
  return Math.round((data.caloriesPer100g * data.defaultPortionG) / 100);
}

// ---------------------------------------------------------------------------
// computeMacrosForPortion
// ---------------------------------------------------------------------------

/**
 * Canonical per-100g scaling function.
 *
 * Looks up `canonicalName` in FOOD_PORTION_DATA and scales all macro values
 * by `portionG / 100`. Returns zeros for unknown foods.
 *
 * Calories: rounded to nearest integer. Macros: rounded to 1 decimal place.
 */
export function computeMacrosForPortion(
  canonicalName: string,
  portionG: number,
): {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugars: number;
  fiber: number;
} {
  const data = FOOD_PORTION_DATA.get(canonicalName);
  if (!data) {
    return { calories: 0, protein: 0, carbs: 0, fat: 0, sugars: 0, fiber: 0 };
  }
  const scale = portionG / 100;
  return {
    calories: Math.round((data.caloriesPer100g ?? 0) * scale),
    protein: Math.round((data.proteinPer100g ?? 0) * scale * 10) / 10,
    carbs: Math.round((data.carbsPer100g ?? 0) * scale * 10) / 10,
    fat: Math.round((data.fatPer100g ?? 0) * scale * 10) / 10,
    sugars: Math.round((data.sugarsPer100g ?? 0) * scale * 10) / 10,
    fiber: Math.round((data.fiberPer100g ?? 0) * scale * 10) / 10,
  };
}

// ---------------------------------------------------------------------------
// filterToKnownFoods
// ---------------------------------------------------------------------------

/**
 * Filter a list of food names to only those that exist in FOOD_PORTION_DATA.
 *
 * Replaces the triplicated `names.filter(n => FOOD_PORTION_DATA.has(n))`
 * pattern across components.
 */
export function filterToKnownFoods(names: ReadonlyArray<string>): string[] {
  return names.filter((name) => FOOD_PORTION_DATA.has(name));
}

// ---------------------------------------------------------------------------
// Food item display helpers (shared from CalorieDetailView)
// ---------------------------------------------------------------------------

/**
 * Return the food items array from a food/liquid log's data.
 * The log must have a `data.items` field (i.e. be a food or liquid log).
 */
export function getFoodItems(log: { data: { items: FoodItem[] } }): FoodItem[] {
  return log.data.items;
}

/**
 * Resolve the best display name for a food item.
 * Priority: canonicalName → parsedName → name → userSegment → "Unknown food".
 */
export function getDisplayName(item: FoodItem): string {
  return item.canonicalName ?? item.parsedName ?? item.name ?? item.userSegment ?? "Unknown food";
}

// ---------------------------------------------------------------------------
// getItemMacros
// ---------------------------------------------------------------------------

const ZERO_ITEM_MACROS = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  sugars: 0,
  fiber: 0,
  portionG: 0,
} as const;

/**
 * Resolve effective portion weight and compute macros for a single food item.
 *
 * Uses `item.quantity` when present, otherwise falls back to
 * `FOOD_PORTION_DATA.defaultPortionG`. Items with no `canonicalName` or no
 * portion data return all-zero macros.
 */
export function getItemMacros(item: FoodItem): {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugars: number;
  fiber: number;
  portionG: number;
} {
  const canonical = item.canonicalName;
  if (canonical == null) return { ...ZERO_ITEM_MACROS };

  // Unknown food: no portion data, nothing to compute.
  const portionData = FOOD_PORTION_DATA.get(canonical);
  if (!portionData) return { ...ZERO_ITEM_MACROS };

  const portionG = getEffectivePortionG(item);

  const macros = computeMacrosForPortion(canonical, portionG);
  return { ...macros, portionG };
}
