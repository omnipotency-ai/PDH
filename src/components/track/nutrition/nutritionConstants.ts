/**
 * Shared constants for the Nutrition Card component family.
 *
 * Centralizes macro color definitions so they stay in sync
 * across CalorieDetailView and LogFoodModal.
 */

// ---------------------------------------------------------------------------
// Macro colors — single source of truth
// ---------------------------------------------------------------------------

/**
 * Semantic macro nutrient colors.
 *
 * Referenced by MACRO_CONFIG (CalorieDetailView) and
 * MACRO_PILL_CONFIG (LogFoodModal) so changes propagate automatically.
 */
export const MACRO_COLORS = {
  protein: "#f97316",
  carbs: "#34d399",
  fat: "#f87171",
  sugars: "#fbbf24",
  fiber: "#818cf8",
} as const;
