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

function abbreviateUnit(naturalUnit: string): string {
  const l = naturalUnit.toLowerCase().trim();
  const ABBREVS: Record<string, string> = {
    slice: "sl",
    "1 slice": "sl",
    piece: "pc",
    "1 piece": "pc",
    "medium egg": "pc",
    "1 medium egg": "pc",
    cup: "cup",
    tablespoon: "tbsp",
    teaspoon: "tsp",
  };
  return ABBREVS[l] ?? l;
}

export function buildStagedNutritionLogData(
  stagedItems: ReadonlyArray<StagedItem>,
  mealSlot: MealSlot,
): FoodLogData {
  return {
    mealSlot,
    items: stagedItems.map((item) => {
      // If the item has a natural unit and we can derive the count, store discrete
      if (item.naturalUnit && item.unitWeightG && item.unitWeightG > 0) {
        const count = Math.round(item.portionG / item.unitWeightG);
        const unitAbbrev = abbreviateUnit(item.naturalUnit);
        return {
          canonicalName: item.canonicalName,
          parsedName: item.displayName,
          quantity: count,
          unit: unitAbbrev,
          resolvedBy: "registry" as const,
          ...(item.productId ? { productId: item.productId } : {}),
        };
      }
      // Otherwise store as grams/ml
      return {
        canonicalName: item.canonicalName,
        parsedName: item.displayName,
        quantity: item.portionG,
        unit: item.isLiquid ? "ml" : "g",
        resolvedBy: "registry" as const,
        ...(item.productId ? { productId: item.productId } : {}),
      };
    }),
  };
}
