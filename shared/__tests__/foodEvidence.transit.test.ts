import { describe, expect, it } from "vitest";
import {
  buildTransitWindow,
  CLINICAL_TRANSIT_RESOLVER_POLICY,
  FOOD_TRANSIT_CATEGORY_ADJUSTMENTS,
  type FoodTransitCategory,
  SURGERY_TYPE_CENTER_MINUTES,
  type SurgeryType,
  type TransitWindow,
} from "../foodEvidence";

/**
 * Tests for transit window calculation with surgery-type and food-category adjustments.
 *
 * These tests verify the updated transit constants (24h center, 8h spread)
 * and the new surgery-type / food-category adjustment system.
 */

const POLICY = CLINICAL_TRANSIT_RESOLVER_POLICY;
const FLOOR_MINUTES = POLICY.minimumPlausibleTransitFloorMinutes; // 360 (6h)

function window(
  overrides?: Partial<{
    surgeryType: SurgeryType;
    foodCategory: FoodTransitCategory;
    modifierDeltaMinutes: number;
    calibrationCenter: number;
    calibrationSpread: number;
    calibrationSource: "default" | "learned";
  }>,
): TransitWindow {
  const hasCalibration =
    overrides?.calibrationCenter !== undefined ||
    overrides?.calibrationSpread !== undefined ||
    overrides?.calibrationSource !== undefined;

  return buildTransitWindow({
    modifierDeltaMinutes: overrides?.modifierDeltaMinutes ?? 0,
    policy: POLICY,
    ...(overrides?.surgeryType !== undefined && {
      surgeryType: overrides.surgeryType,
    }),
    ...(overrides?.foodCategory !== undefined && {
      foodCategory: overrides.foodCategory,
    }),
    ...(hasCalibration && {
      calibration: {
        source: overrides?.calibrationSource ?? "default",
        centerMinutes: overrides?.calibrationCenter ?? 24 * 60,
        spreadMinutes: overrides?.calibrationSpread ?? 8 * 60,
        sampleSize: 0,
        learnedAt: null,
      },
    }),
  });
}

describe("buildTransitWindow — default transit constants", () => {
  it("uses 24h center and 8h spread by default, giving [16h, 32h] window", () => {
    const result = window();

    // 24h center = 1440 min, 8h spread = 480 min
    // start = 1440 - 480 = 960 (16h)
    // end   = 1440 + 480 = 1920 (32h)
    expect(result.startMinutes).toBe(960);
    expect(result.endMinutes).toBe(1920);
  });

  it("window start is above the 6h floor for default constants", () => {
    const result = window();
    expect(result.startMinutes).toBeGreaterThanOrEqual(FLOOR_MINUTES);
  });
});

describe("buildTransitWindow — surgery-type adjustments", () => {
  it("shifts center to 18h (1080 min) for ileocolic surgery", () => {
    const result = window({ surgeryType: "ileocolic" });

    // center = 1080 (18h), spread = 480 (8h)
    // start = 1080 - 480 = 600 (10h)
    // end   = 1080 + 480 = 1560 (26h)
    expect(result.startMinutes).toBe(600);
    expect(result.endMinutes).toBe(1560);
  });

  it("shifts center to 28h (1680 min) for colonic surgery", () => {
    const result = window({ surgeryType: "colonic" });

    // center = 1680 (28h), spread = 480 (8h)
    // start = 1680 - 480 = 1200 (20h)
    // end   = 1680 + 480 = 2160 (36h)
    expect(result.startMinutes).toBe(1200);
    expect(result.endMinutes).toBe(2160);
  });

  it('uses default center when surgeryType is "other"', () => {
    const result = window({ surgeryType: "other" });
    const defaultResult = window();

    expect(result.startMinutes).toBe(defaultResult.startMinutes);
    expect(result.endMinutes).toBe(defaultResult.endMinutes);
  });

  it("uses default center when surgeryType is undefined", () => {
    const result = window({ surgeryType: undefined });
    const defaultResult = window();

    expect(result.startMinutes).toBe(defaultResult.startMinutes);
    expect(result.endMinutes).toBe(defaultResult.endMinutes);
  });

  it("ignores surgery type when calibration is learned", () => {
    const result = window({
      surgeryType: "ileocolic",
      calibrationSource: "learned",
      calibrationCenter: 900, // learned center of 15h
      calibrationSpread: 200,
    });

    // Should use learned center (900), not ileocolic center (1080)
    // start = 900 - 200 = 700
    // end   = 900 + 200 = 1100
    expect(result.startMinutes).toBe(700);
    expect(result.endMinutes).toBe(1100);
  });

  it("applies surgery type when calibration source is default", () => {
    const result = window({
      surgeryType: "colonic",
      calibrationSource: "default",
      calibrationCenter: 1440, // default center — should be overridden
      calibrationSpread: 480,
    });

    // Surgery type overrides the default calibration center
    // center = 1680 (colonic), spread = 480
    // start = 1680 - 480 = 1200
    // end   = 1680 + 480 = 2160
    expect(result.startMinutes).toBe(1200);
    expect(result.endMinutes).toBe(2160);
  });
});

describe("buildTransitWindow — food-category adjustments", () => {
  it("shifts clear_liquid start 2h earlier", () => {
    const result = window({ foodCategory: "clear_liquid" });

    // Default window: [960, 1920]
    // clear_liquid: start -120, end +0
    // start = 960 - 120 = 840, end = 1920
    expect(result.startMinutes).toBe(840);
    expect(result.endMinutes).toBe(1920);
  });

  it("shifts complex_liquid start 1h earlier", () => {
    const result = window({ foodCategory: "complex_liquid" });

    // start = 960 - 60 = 900, end = 1920
    expect(result.startMinutes).toBe(900);
    expect(result.endMinutes).toBe(1920);
  });

  it("makes no adjustment for simple_carb", () => {
    const result = window({ foodCategory: "simple_carb" });
    const defaultResult = window();

    expect(result.startMinutes).toBe(defaultResult.startMinutes);
    expect(result.endMinutes).toBe(defaultResult.endMinutes);
  });

  it("makes no adjustment for mixed_meal", () => {
    const result = window({ foodCategory: "mixed_meal" });
    const defaultResult = window();

    expect(result.startMinutes).toBe(defaultResult.startMinutes);
    expect(result.endMinutes).toBe(defaultResult.endMinutes);
  });

  it("shifts high_protein start 1h later", () => {
    const result = window({ foodCategory: "high_protein" });

    // start = 960 + 60 = 1020, end = 1920
    expect(result.startMinutes).toBe(1020);
    expect(result.endMinutes).toBe(1920);
  });

  it("shifts high_fat start 2h later", () => {
    const result = window({ foodCategory: "high_fat" });

    // start = 960 + 120 = 1080, end = 1920
    expect(result.startMinutes).toBe(1080);
    expect(result.endMinutes).toBe(1920);
  });

  it("narrows high_fiber window by -1h start and -1h end", () => {
    const result = window({ foodCategory: "high_fiber" });

    // start = 960 - 60 = 900, end = 1920 - 60 = 1860
    expect(result.startMinutes).toBe(900);
    expect(result.endMinutes).toBe(1860);
  });
});

describe("buildTransitWindow — floor clamp after adjustments", () => {
  it("clamps start to 6h floor when ileocolic + clear_liquid + modifier pushes below", () => {
    // ileocolic center = 1080, spread = 480
    // raw start = 1080 - 480 = 600
    // clear_liquid adjustment: -120
    // adjusted start = 600 - 120 = 480
    // modifier: -200
    // shifted start = 480 - 200 = 280 → clamped to 360 (6h floor)
    const result = window({
      surgeryType: "ileocolic",
      foodCategory: "clear_liquid",
      modifierDeltaMinutes: -200,
    });

    expect(result.startMinutes).toBe(FLOOR_MINUTES);
    expect(result.endMinutes).toBeGreaterThan(FLOOR_MINUTES);
  });

  it("clamps start to 6h floor when large negative modifier pushes below", () => {
    const result = window({
      modifierDeltaMinutes: -700,
    });

    // Default start = 960, modifier = -700 → 260 → clamped to 360
    expect(result.startMinutes).toBe(FLOOR_MINUTES);
  });

  it("clamps start to 6h floor with combined surgery + food + modifier adjustments", () => {
    const result = window({
      surgeryType: "ileocolic",
      foodCategory: "clear_liquid",
      modifierDeltaMinutes: -200,
    });

    // ileocolic start = 600, clear_liquid = -120 → 480, modifier = -200 → 280
    // Clamped to 360
    expect(result.startMinutes).toBe(FLOOR_MINUTES);
  });
});

describe("buildTransitWindow — combined surgery + food-category", () => {
  it("applies both colonic center shift and high_fat food adjustment", () => {
    const result = window({
      surgeryType: "colonic",
      foodCategory: "high_fat",
    });

    // colonic center = 1680, spread = 480
    // raw start = 1680 - 480 = 1200
    // high_fat: start +120
    // adjusted start = 1200 + 120 = 1320
    // adjusted end = 2160 + 0 = 2160
    expect(result.startMinutes).toBe(1320);
    expect(result.endMinutes).toBe(2160);
  });

  it("applies ileocolic center shift and high_protein food adjustment", () => {
    const result = window({
      surgeryType: "ileocolic",
      foodCategory: "high_protein",
    });

    // ileocolic center = 1080, spread = 480
    // raw start = 1080 - 480 = 600
    // high_protein: start +60
    // adjusted start = 600 + 60 = 660
    // adjusted end = 1560 + 0 = 1560
    expect(result.startMinutes).toBe(660);
    expect(result.endMinutes).toBe(1560);
  });

  it("applies all three: surgery type + food category + modifier", () => {
    const result = window({
      surgeryType: "colonic",
      foodCategory: "complex_liquid",
      modifierDeltaMinutes: -60,
    });

    // colonic center = 1680, spread = 480
    // raw start = 1200, raw end = 2160
    // complex_liquid: start -60
    // adjusted start = 1200 - 60 = 1140
    // adjusted end = 2160
    // modifier: -60
    // shifted start = 1140 - 60 = 1080
    // shifted end = 2160 - 60 = 2100
    expect(result.startMinutes).toBe(1080);
    expect(result.endMinutes).toBe(2100);
  });
});

describe("transit constant values", () => {
  it("SURGERY_TYPE_CENTER_MINUTES has correct values", () => {
    expect(SURGERY_TYPE_CENTER_MINUTES.ileocolic).toBe(1080); // 18h
    expect(SURGERY_TYPE_CENTER_MINUTES.colonic).toBe(1680); // 28h
  });

  it("FOOD_TRANSIT_CATEGORY_ADJUSTMENTS covers all categories", () => {
    const categories: FoodTransitCategory[] = [
      "clear_liquid",
      "complex_liquid",
      "simple_carb",
      "mixed_meal",
      "high_protein",
      "high_fat",
      "high_fiber",
    ];

    for (const category of categories) {
      const adj = FOOD_TRANSIT_CATEGORY_ADJUSTMENTS[category];
      expect(adj).toBeDefined();
      expect(typeof adj.startAdjustment).toBe("number");
      expect(typeof adj.endAdjustment).toBe("number");
    }
  });

  it("minimumPlausibleTransitFloorMinutes is 360 (6h)", () => {
    expect(FLOOR_MINUTES).toBe(360);
  });
});
