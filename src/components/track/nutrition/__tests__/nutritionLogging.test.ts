import { describe, expect, it } from "vitest";
import { buildRawNutritionLogData, buildStagedNutritionLogData } from "../nutritionLogging";
import type { StagedItem } from "../useNutritionStore";

function makeStagedItem(overrides?: Partial<StagedItem>): StagedItem {
  return {
    id: "staged-toast",
    canonicalName: "toast",
    displayName: "Toast",
    portionG: 60,
    isLiquid: false,
    calories: 150,
    protein: 4,
    carbs: 24,
    fat: 2,
    sugars: 1,
    fiber: 2,
    ...overrides,
  };
}

describe("buildRawNutritionLogData", () => {
  it("creates a raw-input parser payload with mealSlot", () => {
    expect(buildRawNutritionLogData(" two toast, honey ", "breakfast")).toEqual({
      rawInput: "two toast, honey",
      items: [],
      mealSlot: "breakfast",
    });
  });

  it("returns null for empty raw input", () => {
    expect(buildRawNutritionLogData("   ", "snack")).toBeNull();
  });
});

describe("buildStagedNutritionLogData", () => {
  it("preserves staged items and includes mealSlot", () => {
    expect(buildStagedNutritionLogData([makeStagedItem()], "lunch")).toEqual({
      mealSlot: "lunch",
      items: [
        {
          canonicalName: "toast",
          parsedName: "Toast",
          quantity: 60,
          unit: "g",
        },
      ],
    });
  });
});
