import type { MealSlot } from "@/lib/nutritionUtils";
import type { FoodLogData } from "@/types/domain";
import type { StagedItem } from "./useNutritionStore";

export function buildRawNutritionLogData(rawInput: string, mealSlot: MealSlot): FoodLogData | null {
  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  return {
    rawInput: trimmed,
    items: [],
    mealSlot,
  };
}

export function buildStagedNutritionLogData(
  stagedItems: ReadonlyArray<StagedItem>,
  mealSlot: MealSlot,
): FoodLogData {
  return {
    mealSlot,
    items: stagedItems.map((item) => ({
      canonicalName: item.canonicalName,
      parsedName: item.displayName,
      quantity: item.portionG,
      unit: item.isLiquid ? "ml" : "g",
    })),
  };
}
