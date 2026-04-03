import { describe, expect, it } from "vitest";
import { FOOD_REGISTRY } from "../foodRegistryData";
import { FOOD_PORTION_DATA } from "../foodPortionData";
import {
  calculateCaloriesForPortion,
  calculateMacrosForPortion,
  getPortionData,
} from "../foodRegistryUtils";

// ── FOOD_PORTION_DATA ────────────────────────────────────────────────────────

describe("FOOD_PORTION_DATA", () => {
  it("is a non-empty ReadonlyMap", () => {
    expect(FOOD_PORTION_DATA.size).toBeGreaterThan(0);
  });

  it("has an entry for every FOOD_REGISTRY canonical", () => {
    for (const entry of FOOD_REGISTRY) {
      expect(FOOD_PORTION_DATA.has(entry.canonical)).toBe(true);
    }
  });

  it("has exactly 147 entries matching the registry size", () => {
    expect(FOOD_PORTION_DATA.size).toBe(FOOD_REGISTRY.length);
    expect(FOOD_PORTION_DATA.size).toBe(147);
  });

  it("every entry has defaultPortionG greater than 0", () => {
    for (const [canonical, data] of FOOD_PORTION_DATA) {
      expect(
        data.defaultPortionG,
        `defaultPortionG for "${canonical}"`,
      ).toBeGreaterThan(0);
    }
  });

  it("every entry has a valid source field", () => {
    const validSources = new Set(["usda", "openfoodfacts", "estimated"]);
    for (const [canonical, data] of FOOD_PORTION_DATA) {
      expect(
        validSources.has(data.source),
        `source "${data.source}" for "${canonical}" must be usda | openfoodfacts | estimated`,
      ).toBe(true);
    }
  });

  it("entries with naturalUnit also have unitWeightG", () => {
    for (const [canonical, data] of FOOD_PORTION_DATA) {
      if (data.naturalUnit !== undefined) {
        expect(
          data.unitWeightG,
          `"${canonical}" has naturalUnit but missing unitWeightG`,
        ).toBeDefined();
        expect(
          data.unitWeightG,
          `unitWeightG for "${canonical}" must be > 0`,
        ).toBeGreaterThan(0);
      }
    }
  });
});

// ── getPortionData ───────────────────────────────────────────────────────────

describe("getPortionData", () => {
  it("returns data for a known canonical", () => {
    const data = getPortionData("grilled white meat");
    expect(data).toBeDefined();
    if (data === undefined)
      throw new Error("expected data for 'grilled white meat'");
    expect(data.defaultPortionG).toBeGreaterThan(0);
    expect(data.source).toBeDefined();
  });

  it("returns data for 'clear broth' (zone 1A liquid)", () => {
    const data = getPortionData("clear broth");
    expect(data).toBeDefined();
    if (data === undefined) throw new Error("expected data for 'clear broth'");
    expect(data.caloriesPer100g).toBeDefined();
  });

  it("returns data for 'egg' (zone 1B protein)", () => {
    const data = getPortionData("egg");
    expect(data).toBeDefined();
  });

  it("returns undefined for an unknown canonical", () => {
    expect(getPortionData("not a food")).toBeUndefined();
  });

  it("returns undefined for an empty string", () => {
    expect(getPortionData("")).toBeUndefined();
  });
});

// ── calculateCaloriesForPortion ──────────────────────────────────────────────

describe("calculateCaloriesForPortion", () => {
  it("computes calories correctly: Math.round(caloriesPer100g * portionG / 100)", () => {
    // grilled white meat: test with 150g to verify the formula
    const data = getPortionData("grilled white meat");
    if (data?.caloriesPer100g === undefined)
      throw new Error("test data not available");
    const expected = Math.round((data.caloriesPer100g * 150) / 100);
    expect(calculateCaloriesForPortion("grilled white meat", 150)).toBe(
      expected,
    );
  });

  it("returns an integer (rounded to nearest whole number)", () => {
    const result = calculateCaloriesForPortion("egg", 60);
    expect(result).toBeDefined();
    if (result === undefined) throw new Error("expected a result");
    expect(Number.isInteger(result)).toBe(true);
  });

  it("returns 0 for 0g portion", () => {
    const result = calculateCaloriesForPortion("grilled white meat", 0);
    expect(result).toBe(0);
  });

  it("scales linearly with portion weight", () => {
    const cal100 = calculateCaloriesForPortion("white rice", 100);
    const cal200 = calculateCaloriesForPortion("white rice", 200);
    if (cal100 === undefined || cal200 === undefined)
      throw new Error("test data not available");
    expect(cal200).toBe(cal100 * 2);
  });

  it("returns undefined when no calorie data exists for this food", () => {
    // Use a canonical that has no caloriesPer100g (if any), or mock via unknown name
    // Since all 147 entries have calorie data, test with unknown name
    const result = calculateCaloriesForPortion("unknown food xyz", 100);
    expect(result).toBeUndefined();
  });

  it("returns undefined for unknown canonical regardless of portion size", () => {
    expect(calculateCaloriesForPortion("not a food", 150)).toBeUndefined();
    expect(calculateCaloriesForPortion("", 100)).toBeUndefined();
  });
});

// ── calculateMacrosForPortion ────────────────────────────────────────────────

describe("calculateMacrosForPortion", () => {
  it("computes all 5 macros proportionally for a known food", () => {
    const data = getPortionData("grilled white meat");
    if (data === undefined) throw new Error("test data not available");

    const result = calculateMacrosForPortion("grilled white meat", 100);

    // At 100g, each macro = per-100g value (rounded to 1dp)
    const round1dp = (v: number | undefined) =>
      v !== undefined ? Math.round(v * 10) / 10 : undefined;

    expect(result.protein).toBe(round1dp(data.proteinPer100g));
    expect(result.carbs).toBe(round1dp(data.carbsPer100g));
    expect(result.fat).toBe(round1dp(data.fatPer100g));
    expect(result.sugars).toBe(round1dp(data.sugarsPer100g));
    expect(result.fiber).toBe(round1dp(data.fiberPer100g));
  });

  it("scales proportionally with portion weight", () => {
    const result100 = calculateMacrosForPortion("white rice", 100);
    const result200 = calculateMacrosForPortion("white rice", 200);

    if (result100.protein !== undefined && result200.protein !== undefined) {
      // Allow for rounding: 200g should be ~2x the 100g value
      expect(result200.protein).toBeCloseTo(result100.protein * 2, 1);
    }
    if (result100.carbs !== undefined && result200.carbs !== undefined) {
      expect(result200.carbs).toBeCloseTo(result100.carbs * 2, 1);
    }
  });

  it("returns all undefined fields for an unknown canonical", () => {
    const result = calculateMacrosForPortion("not a food", 100);
    expect(result.protein).toBeUndefined();
    expect(result.carbs).toBeUndefined();
    expect(result.fat).toBeUndefined();
    expect(result.sugars).toBeUndefined();
    expect(result.fiber).toBeUndefined();
  });

  it("returns all undefined fields for an empty string", () => {
    const result = calculateMacrosForPortion("", 100);
    expect(result.protein).toBeUndefined();
    expect(result.carbs).toBeUndefined();
    expect(result.fat).toBeUndefined();
    expect(result.sugars).toBeUndefined();
    expect(result.fiber).toBeUndefined();
  });

  it("returns 0 for 0g portion on a known food (not undefined)", () => {
    const result = calculateMacrosForPortion("grilled white meat", 0);
    // 0g portion: scale(v) = Math.round(v * 0 * 10 / 100) / 10 = 0
    const data = getPortionData("grilled white meat");
    if (data?.proteinPer100g !== undefined) {
      expect(result.protein).toBe(0);
    }
  });

  it("rounds to 1 decimal place", () => {
    // Use a portion that would produce a fractional value
    const result = calculateMacrosForPortion("egg", 47);
    if (result.protein !== undefined) {
      const decimals = result.protein.toString().split(".")[1];
      expect((decimals?.length ?? 0) <= 1).toBe(true);
    }
  });
});
