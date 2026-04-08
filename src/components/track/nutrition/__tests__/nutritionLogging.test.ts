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
  it("preserves staged items without naturalUnit as grams", () => {
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

  it("stores discrete quantity and unit when naturalUnit is present", () => {
    const item = makeStagedItem({
      portionG: 240,
      naturalUnit: "slice",
      unitWeightG: 30,
    });
    const result = buildStagedNutritionLogData([item], "breakfast");
    expect(result.items[0]).toEqual({
      canonicalName: "toast",
      parsedName: "Toast",
      quantity: 8,
      unit: "sl",
    });
  });

  it("includes productId when present", () => {
    const item = makeStagedItem({ productId: "product-123" });
    const result = buildStagedNutritionLogData([item], "dinner");
    expect(result.items[0].productId).toBe("product-123");
  });

  it("omits productId when not present", () => {
    const result = buildStagedNutritionLogData([makeStagedItem()], "snack");
    expect(result.items[0]).not.toHaveProperty("productId");
  });
});
