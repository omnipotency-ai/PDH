/**
 * Shared utility functions for nutrition components.
 *
 * Extracted from FavouritesView and FoodFilterView to eliminate duplication.
 * All functions operate on FOOD_PORTION_DATA entries by canonical name.
 */

import { FOOD_PORTION_DATA } from "@shared/foodPortionData";

/** Capitalize the first letter of each word. */
export function titleCase(str: string): string {
  return str
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Format portion display: "150g" or "1 medium egg (50g)". */
export function formatPortion(canonicalName: string): string {
  const data = FOOD_PORTION_DATA.get(canonicalName);
  if (!data) return "";

  if (data.naturalUnit != null && data.unitWeightG != null) {
    return `${data.naturalUnit} (${data.defaultPortionG}g)`;
  }
  return `${data.defaultPortionG}g`;
}

/** Get calories for the default portion. */
export function getDefaultCalories(canonicalName: string): number {
  const data = FOOD_PORTION_DATA.get(canonicalName);
  if (!data || data.caloriesPer100g == null) return 0;
  return Math.round((data.caloriesPer100g * data.defaultPortionG) / 100);
}
