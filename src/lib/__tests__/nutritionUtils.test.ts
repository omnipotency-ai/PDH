import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FluidLogData, FoodLogData } from "@/types/domain";
import {
  calculateTotalCalories,
  calculateTotalMacros,
  calculateWaterIntake,
  getMealSlot,
  groupByMealSlot,
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
});
