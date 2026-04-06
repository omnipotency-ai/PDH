import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FluidLogData, FoodItem, FoodLogData } from "@/types/domain";
import {
  calculateTotalCalories,
  calculateTotalMacros,
  calculateWaterIntake,
  computeMacrosForPortion,
  filterToKnownFoods,
  formatPortion,
  getCurrentMealSlot,
  getDefaultCalories,
  getDisplayName,
  getFoodItems,
  getItemMacros,
  getMealSlot,
  groupByMealSlot,
  MEAL_SLOT_BOUNDARIES,
  titleCase,
} from "../nutritionUtils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal food/liquid log for calorie/macro tests. */
function makeFoodLog(items: FoodLogData["items"]): {
  data: { items: FoodLogData["items"] };
} {
  return { data: { items } };
}

/** Build a minimal fluid log for water intake tests. */
function makeFluidLog(items: FluidLogData["items"]): {
  id: string;
  timestamp: number;
  type: "fluid";
  data: FluidLogData;
} {
  return {
    id: `fluid-${Date.now()}`,
    timestamp: Date.now(),
    type: "fluid",
    data: { items },
  };
}

/** Build a timestamped record for groupByMealSlot tests. */
function makeTimestamped(hour: number, minute = 0): { timestamp: number } {
  const d = new Date(2026, 3, 3); // 2026-04-03
  d.setHours(hour, minute, 0, 0);
  return { timestamp: d.getTime() };
}

// ---------------------------------------------------------------------------
// getMealSlot
// ---------------------------------------------------------------------------

describe("getMealSlot", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 3, 12, 0, 0)); // noon
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns breakfast for 6am", () => {
    const d = new Date(2026, 3, 3, 6, 0, 0);
    expect(getMealSlot(d.getTime())).toBe("breakfast");
  });

  it("returns lunch for 2pm", () => {
    const d = new Date(2026, 3, 3, 14, 0, 0);
    expect(getMealSlot(d.getTime())).toBe("lunch");
  });

  it("returns dinner for 9pm", () => {
    const d = new Date(2026, 3, 3, 21, 0, 0);
    expect(getMealSlot(d.getTime())).toBe("dinner");
  });

  it("returns snack for 11am", () => {
    const d = new Date(2026, 3, 3, 11, 0, 0);
    expect(getMealSlot(d.getTime())).toBe("snack");
  });

  // Boundary tests
  it("returns breakfast for exactly 5am", () => {
    const d = new Date(2026, 3, 3, 5, 0, 0);
    expect(getMealSlot(d.getTime())).toBe("breakfast");
  });

  it("returns snack for exactly 9am (past breakfast window)", () => {
    const d = new Date(2026, 3, 3, 9, 0, 0);
    expect(getMealSlot(d.getTime())).toBe("snack");
  });

  it("returns lunch for exactly 1pm", () => {
    const d = new Date(2026, 3, 3, 13, 0, 0);
    expect(getMealSlot(d.getTime())).toBe("lunch");
  });

  it("returns snack for exactly 4pm", () => {
    const d = new Date(2026, 3, 3, 16, 0, 0);
    expect(getMealSlot(d.getTime())).toBe("snack");
  });

  it("returns dinner for exactly 8pm", () => {
    const d = new Date(2026, 3, 3, 20, 0, 0);
    expect(getMealSlot(d.getTime())).toBe("dinner");
  });

  it("returns snack for exactly 11pm", () => {
    const d = new Date(2026, 3, 3, 23, 0, 0);
    expect(getMealSlot(d.getTime())).toBe("snack");
  });
});

// ---------------------------------------------------------------------------
// getCurrentMealSlot
// ---------------------------------------------------------------------------

describe("getCurrentMealSlot", () => {
  // getCurrentMealSlot now uses the same MEAL_SLOT_BOUNDARIES as getMealSlot.

  it("returns breakfast for 6am", () => {
    expect(getCurrentMealSlot(new Date(2026, 3, 3, 6, 0, 0))).toBe("breakfast");
  });

  it("returns breakfast for exactly 5am (start of window)", () => {
    expect(getCurrentMealSlot(new Date(2026, 3, 3, 5, 0, 0))).toBe("breakfast");
  });

  it("returns snack for 9am (past breakfast window)", () => {
    expect(getCurrentMealSlot(new Date(2026, 3, 3, 9, 0, 0))).toBe("snack");
  });

  it("returns snack for 11am (gap between breakfast and lunch)", () => {
    expect(getCurrentMealSlot(new Date(2026, 3, 3, 11, 0, 0))).toBe("snack");
  });

  it("returns lunch for 1pm", () => {
    expect(getCurrentMealSlot(new Date(2026, 3, 3, 13, 0, 0))).toBe("lunch");
  });

  it("returns lunch for 3:59pm (end of lunch window)", () => {
    expect(getCurrentMealSlot(new Date(2026, 3, 3, 15, 59, 0))).toBe("lunch");
  });

  it("returns snack for 4pm (past lunch window)", () => {
    expect(getCurrentMealSlot(new Date(2026, 3, 3, 16, 0, 0))).toBe("snack");
  });

  it("returns dinner for 8pm", () => {
    expect(getCurrentMealSlot(new Date(2026, 3, 3, 20, 0, 0))).toBe("dinner");
  });

  it("returns dinner for 10:59pm (end of dinner window)", () => {
    expect(getCurrentMealSlot(new Date(2026, 3, 3, 22, 59, 0))).toBe("dinner");
  });

  it("returns snack for 11pm (past dinner window)", () => {
    expect(getCurrentMealSlot(new Date(2026, 3, 3, 23, 0, 0))).toBe("snack");
  });

  it("returns snack for midnight", () => {
    expect(getCurrentMealSlot(new Date(2026, 3, 3, 0, 0, 0))).toBe("snack");
  });

  it("returns snack for 3am", () => {
    expect(getCurrentMealSlot(new Date(2026, 3, 3, 3, 0, 0))).toBe("snack");
  });

  it("returns snack for 4:59am (just before breakfast)", () => {
    expect(getCurrentMealSlot(new Date(2026, 3, 3, 4, 59, 0))).toBe("snack");
  });

  it("defaults to current time when no argument provided", () => {
    // Just verify it returns a valid MealSlot without throwing
    const result = getCurrentMealSlot();
    expect(["breakfast", "lunch", "dinner", "snack"]).toContain(result);
  });

  it("matches getMealSlot for all boundary hours", () => {
    // Both functions should return the same result for any hour
    for (let h = 0; h < 24; h++) {
      const d = new Date(2026, 3, 3, h, 0, 0);
      expect(getCurrentMealSlot(d)).toBe(getMealSlot(d.getTime()));
    }
  });
});

// ---------------------------------------------------------------------------
// calculateTotalCalories
// ---------------------------------------------------------------------------

describe("calculateTotalCalories", () => {
  it("returns 0 for empty logs", () => {
    expect(calculateTotalCalories([])).toBe(0);
  });

  it("calculates calories for white rice with quantity 200g", () => {
    // white rice: caloriesPer100g = 130, quantity = 200g → 260
    const logs = [makeFoodLog([{ canonicalName: "white rice", quantity: 200, unit: "g" }])];
    expect(calculateTotalCalories(logs)).toBe(260);
  });

  it("returns 0 for item with unknown canonical name", () => {
    const logs = [makeFoodLog([{ canonicalName: "alien food", quantity: 100, unit: "g" }])];
    expect(calculateTotalCalories(logs)).toBe(0);
  });

  it("returns 0 for item with null canonical name", () => {
    const logs = [makeFoodLog([{ canonicalName: null, quantity: 100, unit: "g" }])];
    expect(calculateTotalCalories(logs)).toBe(0);
  });

  it("returns 0 for item with undefined canonical name", () => {
    const logs = [makeFoodLog([{ quantity: 100, unit: "g" }])];
    expect(calculateTotalCalories(logs)).toBe(0);
  });

  it("uses defaultPortionG when quantity is null", () => {
    // white rice: caloriesPer100g = 130, defaultPortionG = 180 → 234
    const logs = [makeFoodLog([{ canonicalName: "white rice", quantity: null, unit: null }])];
    expect(calculateTotalCalories(logs)).toBe(234);
  });

  it("sums across multiple items and multiple logs", () => {
    // white rice 200g: 260 cal
    // ripe banana 100g: 89 cal (caloriesPer100g = 89)
    const logs = [
      makeFoodLog([{ canonicalName: "white rice", quantity: 200, unit: "g" }]),
      makeFoodLog([{ canonicalName: "ripe banana", quantity: 100, unit: "g" }]),
    ];
    expect(calculateTotalCalories(logs)).toBe(260 + 89);
  });
});

// ---------------------------------------------------------------------------
// calculateTotalMacros
// ---------------------------------------------------------------------------

describe("calculateTotalMacros", () => {
  it("returns all zeros for empty logs", () => {
    expect(calculateTotalMacros([])).toEqual({
      protein: 0,
      carbs: 0,
      fat: 0,
      sugars: 0,
      fiber: 0,
    });
  });

  it("calculates proportional macros for white rice 200g", () => {
    // white rice per 100g: protein=2.7, carbs=28.2, fat=0.3, sugars=0, fiber=0.4
    // For 200g: protein=5.4, carbs=56.4, fat=0.6, sugars=0, fiber=0.8
    const logs = [makeFoodLog([{ canonicalName: "white rice", quantity: 200, unit: "g" }])];
    const macros = calculateTotalMacros(logs);
    expect(macros.protein).toBeCloseTo(5.4, 1);
    expect(macros.carbs).toBeCloseTo(56.4, 1);
    expect(macros.fat).toBeCloseTo(0.6, 1);
    expect(macros.sugars).toBeCloseTo(0, 1);
    expect(macros.fiber).toBeCloseTo(0.8, 1);
  });

  it("sums macros from multiple items", () => {
    // white rice 100g + ripe banana 100g
    // rice: protein=2.7 carbs=28.2 fat=0.3 sugars=0 fiber=0.4
    // ripe banana: protein=1.1 carbs=22.8 fat=0.3 sugars=12.2 fiber=2.6
    const logs = [
      makeFoodLog([
        { canonicalName: "white rice", quantity: 100, unit: "g" },
        { canonicalName: "ripe banana", quantity: 100, unit: "g" },
      ]),
    ];
    const macros = calculateTotalMacros(logs);
    expect(macros.protein).toBeCloseTo(3.8, 1);
    expect(macros.carbs).toBeCloseTo(51.0, 1);
    expect(macros.fat).toBeCloseTo(0.6, 1);
    expect(macros.sugars).toBeCloseTo(12.2, 1);
    expect(macros.fiber).toBeCloseTo(3.0, 1);
  });

  it("ignores items without portion data", () => {
    const logs = [makeFoodLog([{ canonicalName: "alien food", quantity: 100, unit: "g" }])];
    expect(calculateTotalMacros(logs)).toEqual({
      protein: 0,
      carbs: 0,
      fat: 0,
      sugars: 0,
      fiber: 0,
    });
  });
});

// ---------------------------------------------------------------------------
// groupByMealSlot
// ---------------------------------------------------------------------------

describe("groupByMealSlot", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 3, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns empty groups for empty input", () => {
    const result = groupByMealSlot([]);
    expect(result).toEqual({
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: [],
    });
  });

  it("groups logs correctly by time ranges", () => {
    const breakfast = makeTimestamped(7);
    const lunch = makeTimestamped(13, 30);
    const dinner = makeTimestamped(20, 30);
    const snack = makeTimestamped(11);

    const result = groupByMealSlot([breakfast, lunch, dinner, snack]);
    expect(result.breakfast).toEqual([breakfast]);
    expect(result.lunch).toEqual([lunch]);
    expect(result.dinner).toEqual([dinner]);
    expect(result.snack).toEqual([snack]);
  });

  it("places multiple items in the same slot", () => {
    const a = makeTimestamped(6);
    const b = makeTimestamped(7);
    const result = groupByMealSlot([a, b]);
    expect(result.breakfast).toEqual([a, b]);
    expect(result.lunch).toEqual([]);
    expect(result.dinner).toEqual([]);
    expect(result.snack).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// calculateWaterIntake
// ---------------------------------------------------------------------------

describe("calculateWaterIntake", () => {
  it("sums ml correctly", () => {
    const logs = [
      makeFluidLog([
        { name: "Water", quantity: 250, unit: "ml" },
        { name: "Water", quantity: 500, unit: "ml" },
      ]),
    ];
    expect(calculateWaterIntake(logs)).toBe(750);
  });

  it("converts liters to ml", () => {
    const logs = [makeFluidLog([{ name: "Water", quantity: 1, unit: "l" }])];
    expect(calculateWaterIntake(logs)).toBe(1000);
  });

  it("handles case-insensitive water name", () => {
    const logs = [makeFluidLog([{ name: "water", quantity: 300, unit: "ml" }])];
    expect(calculateWaterIntake(logs)).toBe(300);
  });

  it("ignores non-water items", () => {
    const logs = [
      makeFluidLog([
        { name: "Water", quantity: 250, unit: "ml" },
        { name: "Orange Juice", quantity: 200, unit: "ml" },
      ]),
    ];
    expect(calculateWaterIntake(logs)).toBe(250);
  });

  it("returns 0 for empty logs", () => {
    expect(calculateWaterIntake([])).toBe(0);
  });

  it("sums across multiple fluid logs", () => {
    const logs = [
      makeFluidLog([{ name: "Water", quantity: 250, unit: "ml" }]),
      makeFluidLog([{ name: "Water", quantity: 500, unit: "ml" }]),
    ];
    expect(calculateWaterIntake(logs)).toBe(750);
  });

  // Fix #35: water name matching variants
  it("matches 'Water (still)'", () => {
    const logs = [makeFluidLog([{ name: "Water (still)", quantity: 250, unit: "ml" }])];
    expect(calculateWaterIntake(logs)).toBe(250);
  });

  it("matches 'Sparkling Water'", () => {
    const logs = [makeFluidLog([{ name: "Sparkling Water", quantity: 500, unit: "ml" }])];
    expect(calculateWaterIntake(logs)).toBe(500);
  });

  it("matches 'still water' (lowercase)", () => {
    const logs = [makeFluidLog([{ name: "still water", quantity: 300, unit: "ml" }])];
    expect(calculateWaterIntake(logs)).toBe(300);
  });

  it("does not match 'Watermelon Juice'", () => {
    // "watermelon juice" starts with "water" but the next char is not a space
    const logs = [makeFluidLog([{ name: "Watermelon Juice", quantity: 200, unit: "ml" }])];
    expect(calculateWaterIntake(logs)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// MEAL_SLOT_BOUNDARIES
// ---------------------------------------------------------------------------

describe("MEAL_SLOT_BOUNDARIES", () => {
  it("is exported and has 3 entries", () => {
    expect(MEAL_SLOT_BOUNDARIES).toHaveLength(3);
  });

  it("contains breakfast, lunch, dinner", () => {
    const slots = MEAL_SLOT_BOUNDARIES.map(([, , slot]) => slot);
    expect(slots).toEqual(["breakfast", "lunch", "dinner"]);
  });
});

// ---------------------------------------------------------------------------
// titleCase
// ---------------------------------------------------------------------------

describe("titleCase", () => {
  it("capitalizes single word", () => {
    expect(titleCase("chicken")).toBe("Chicken");
  });

  it("capitalizes multiple words", () => {
    expect(titleCase("white rice")).toBe("White Rice");
  });

  it("handles empty string", () => {
    expect(titleCase("")).toBe("");
  });

  it("preserves already-capitalized words", () => {
    expect(titleCase("Ripe Banana")).toBe("Ripe Banana");
  });
});

// ---------------------------------------------------------------------------
// formatPortion
// ---------------------------------------------------------------------------

describe("formatPortion", () => {
  it("returns empty string for unknown food", () => {
    expect(formatPortion("alien food")).toBe("");
  });

  it("returns gram format for amorphous foods", () => {
    const result = formatPortion("white rice");
    expect(result).toMatch(/^\d+g$/);
  });
});

// ---------------------------------------------------------------------------
// getDefaultCalories
// ---------------------------------------------------------------------------

describe("getDefaultCalories", () => {
  it("returns 0 for unknown food", () => {
    expect(getDefaultCalories("alien food")).toBe(0);
  });

  it("computes calories for white rice default portion", () => {
    // white rice: caloriesPer100g = 130, defaultPortionG = 180 → 234
    expect(getDefaultCalories("white rice")).toBe(234);
  });
});

// ---------------------------------------------------------------------------
// computeMacrosForPortion
// ---------------------------------------------------------------------------

describe("computeMacrosForPortion", () => {
  it("returns all zeros for unknown food", () => {
    expect(computeMacrosForPortion("alien food", 100)).toEqual({
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      sugars: 0,
      fiber: 0,
    });
  });

  it("computes correct values for white rice 200g", () => {
    // white rice per 100g: cal=130, protein=2.7, carbs=28.2, fat=0.3, sugars=0, fiber=0.4
    const result = computeMacrosForPortion("white rice", 200);
    expect(result.calories).toBe(260);
    expect(result.protein).toBeCloseTo(5.4, 1);
    expect(result.carbs).toBeCloseTo(56.4, 1);
    expect(result.fat).toBeCloseTo(0.6, 1);
    expect(result.sugars).toBeCloseTo(0, 1);
    expect(result.fiber).toBeCloseTo(0.8, 1);
  });

  it("returns zeros for 0g portion", () => {
    const result = computeMacrosForPortion("white rice", 0);
    expect(result.calories).toBe(0);
    expect(result.protein).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// filterToKnownFoods
// ---------------------------------------------------------------------------

describe("filterToKnownFoods", () => {
  it("returns empty array for empty input", () => {
    expect(filterToKnownFoods([])).toEqual([]);
  });

  it("filters out unknown foods", () => {
    const result = filterToKnownFoods(["white rice", "alien food", "ripe banana"]);
    expect(result).toContain("white rice");
    expect(result).toContain("ripe banana");
    expect(result).not.toContain("alien food");
  });

  it("returns empty array when all foods are unknown", () => {
    expect(filterToKnownFoods(["alien food", "space gruel"])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getFoodItems (#43)
// ---------------------------------------------------------------------------

describe("getFoodItems", () => {
  it("returns the items array from a log", () => {
    const item: FoodItem = {
      quantity: 100,
      unit: "g",
      canonicalName: "white rice",
    };
    const log = { data: { items: [item] } };
    expect(getFoodItems(log)).toEqual([item]);
  });

  it("returns an empty array when items is empty", () => {
    const log = { data: { items: [] } };
    expect(getFoodItems(log)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getDisplayName (#43)
// ---------------------------------------------------------------------------

describe("getDisplayName", () => {
  it("prefers canonicalName", () => {
    const item: FoodItem = {
      canonicalName: "white rice",
      parsedName: "rice",
      name: "Rice",
      userSegment: "some rice",
      quantity: null,
      unit: null,
    };
    expect(getDisplayName(item)).toBe("white rice");
  });

  it("falls back to parsedName when canonicalName is null", () => {
    const item: FoodItem = {
      canonicalName: null,
      parsedName: "rice",
      name: "Rice",
      quantity: null,
      unit: null,
    };
    expect(getDisplayName(item)).toBe("rice");
  });

  it("falls back to name when canonicalName and parsedName are absent", () => {
    const item: FoodItem = {
      name: "Rice",
      quantity: null,
      unit: null,
    };
    expect(getDisplayName(item)).toBe("Rice");
  });

  it("falls back to userSegment when name is also absent", () => {
    const item: FoodItem = {
      userSegment: "some rice",
      quantity: null,
      unit: null,
    };
    expect(getDisplayName(item)).toBe("some rice");
  });

  it("returns 'Unknown food' when all name fields are absent", () => {
    const item: FoodItem = { quantity: null, unit: null };
    expect(getDisplayName(item)).toBe("Unknown food");
  });
});

// ---------------------------------------------------------------------------
// getItemMacros (#43)
// ---------------------------------------------------------------------------

describe("getItemMacros", () => {
  it("returns all-zero macros when canonicalName is null", () => {
    const item: FoodItem = { canonicalName: null, quantity: 100, unit: "g" };
    const result = getItemMacros(item);
    expect(result).toEqual({
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      sugars: 0,
      fiber: 0,
      portionG: 0,
    });
  });

  it("returns all-zero macros when canonicalName is undefined", () => {
    const item: FoodItem = { quantity: 100, unit: "g" };
    const result = getItemMacros(item);
    expect(result.calories).toBe(0);
    expect(result.portionG).toBe(0);
  });

  it("returns all-zero macros for an unknown food", () => {
    // When canonicalName has no entry in FOOD_PORTION_DATA, the function
    // returns early with all zeros — including portionG — because there is
    // no portion data from which to compute anything meaningful.
    const item: FoodItem = {
      canonicalName: "alien food",
      quantity: 100,
      unit: "g",
    };
    const result = getItemMacros(item);
    expect(result.calories).toBe(0);
    expect(result.protein).toBe(0);
    expect(result.carbs).toBe(0);
    expect(result.fat).toBe(0);
    expect(result.portionG).toBe(0);
  });

  it("uses item.quantity as portionG when present and positive", () => {
    const item: FoodItem = {
      canonicalName: "white rice",
      quantity: 200,
      unit: "g",
    };
    const result = getItemMacros(item);
    expect(result.portionG).toBe(200);
    expect(result.calories).toBe(260);
  });

  it("falls back to defaultPortionG when quantity is null", () => {
    // white rice: defaultPortionG = 180, caloriesPer100g = 130 → 234 kcal
    const item: FoodItem = {
      canonicalName: "white rice",
      quantity: null,
      unit: null,
    };
    const result = getItemMacros(item);
    expect(result.portionG).toBe(180);
    expect(result.calories).toBe(234);
  });

  it("falls back to defaultPortionG when quantity is 0", () => {
    const item: FoodItem = {
      canonicalName: "white rice",
      quantity: 0,
      unit: "g",
    };
    const result = getItemMacros(item);
    expect(result.portionG).toBe(180);
  });

  it("returns correct macro breakdown for white rice 100g", () => {
    const item: FoodItem = {
      canonicalName: "white rice",
      quantity: 100,
      unit: "g",
    };
    const result = getItemMacros(item);
    expect(result.portionG).toBe(100);
    expect(result.calories).toBe(130);
    expect(result.protein).toBeCloseTo(2.7, 1);
    expect(result.carbs).toBeCloseTo(28.2, 1);
    expect(result.fat).toBeCloseTo(0.3, 1);
  });
});
