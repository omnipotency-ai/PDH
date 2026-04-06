import { FOOD_PORTION_DATA } from "@shared/foodPortionData";
import { FOOD_REGISTRY } from "@shared/foodRegistryData";
import { describe, expect, it } from "vitest";
import {
  computeStagingTotals,
  createStagedItem,
  FUSE_OPTIONS,
  MAX_PORTION_G,
  MIN_PORTION_G,
  type NutritionState,
  nutritionReducer,
  recalculateMacros,
  searchFoodRegistry,
} from "../useNutritionStore";

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Create a minimal valid initial state for reducer tests.
 * Uses "snack" as the default meal slot to avoid time-of-day dependency.
 */
function makeState(overrides?: Partial<NutritionState>): NutritionState {
  return {
    view: "none",
    searchQuery: "",
    stagingItems: [],
    stagingModalOpen: false,
    waterModalOpen: false,
    activeMealSlot: "snack",
    filterMealSlot: "breakfast",
    lastRemovedItem: null,
    ...overrides,
  };
}

/** Type-narrowing helper: asserts value is non-null and returns it. */
function assertDefined<T>(value: T | null | undefined, label?: string): T {
  if (value == null) {
    throw new Error(`Expected non-null value${label ? ` for ${label}` : ""}`);
  }
  return value;
}

// ── createStagedItem ────────────────────────────────────────────────────────

describe("createStagedItem", () => {
  it("creates a StagedItem for a known canonical food (white rice)", () => {
    const item = assertDefined(createStagedItem("white rice"), "white rice staged item");
    const portion = assertDefined(FOOD_PORTION_DATA.get("white rice"), "white rice portion data");

    expect(item.canonicalName).toBe("white rice");
    expect(item.portionG).toBe(portion.defaultPortionG);
    expect(item.id).toMatch(/^staged_/);

    // Calories: caloriesPer100g * defaultPortionG / 100
    const expectedCal = Math.round(
      ((portion.caloriesPer100g ?? 0) * portion.defaultPortionG) / 100,
    );
    expect(item.calories).toBe(expectedCal);
  });

  it("populates naturalUnit and unitWeightG for foods that have them (toast)", () => {
    const item = assertDefined(createStagedItem("toast"), "toast staged item");
    const portion = assertDefined(FOOD_PORTION_DATA.get("toast"), "toast portion data");

    expect(item.naturalUnit).toBe(portion.naturalUnit);
    expect(item.unitWeightG).toBe(portion.unitWeightG);
  });

  it("omits naturalUnit/unitWeightG for foods without them (white rice)", () => {
    const item = assertDefined(createStagedItem("white rice"), "white rice staged item");
    expect(item.naturalUnit).toBeUndefined();
    expect(item.unitWeightG).toBeUndefined();
  });

  it("computes all 5 macros correctly", () => {
    const item = assertDefined(createStagedItem("white rice"), "white rice staged item");
    const portion = assertDefined(FOOD_PORTION_DATA.get("white rice"), "white rice portion data");
    const scale = portion.defaultPortionG / 100;

    // Each macro = per100g * scale, rounded to 1 decimal
    expect(item.protein).toBe(Math.round((portion.proteinPer100g ?? 0) * scale * 10) / 10);
    expect(item.carbs).toBe(Math.round((portion.carbsPer100g ?? 0) * scale * 10) / 10);
    expect(item.fat).toBe(Math.round((portion.fatPer100g ?? 0) * scale * 10) / 10);
    expect(item.sugars).toBe(Math.round((portion.sugarsPer100g ?? 0) * scale * 10) / 10);
    expect(item.fiber).toBe(Math.round((portion.fiberPer100g ?? 0) * scale * 10) / 10);
  });

  it("returns null for unknown canonical food", () => {
    const item = createStagedItem("nonexistent_food_xyz");
    expect(item).toBeNull();
  });

  it("applies titleCase to displayName (#79)", () => {
    const item = assertDefined(createStagedItem("ripe banana"), "ripe banana staged item");
    expect(item.displayName).toBe("Ripe Banana");
  });

  it("returns null for a name not in FOOD_REGISTRY (#74)", () => {
    const item = createStagedItem("not_in_registry_at_all");
    expect(item).toBeNull();
  });
});

// ── recalculateMacros ───────────────────────────────────────────────────────

describe("recalculateMacros", () => {
  it("recomputes calories and all 5 macros for a new portion", () => {
    const item = assertDefined(createStagedItem("white rice"), "white rice");
    const updated = recalculateMacros(item, 100);

    const portion = assertDefined(FOOD_PORTION_DATA.get("white rice"), "white rice portion data");
    expect(updated.portionG).toBe(100);
    expect(updated.calories).toBe(Math.round(portion.caloriesPer100g ?? 0));
    expect(updated.protein).toBe(Math.round((portion.proteinPer100g ?? 0) * 10) / 10);
    expect(updated.carbs).toBe(Math.round((portion.carbsPer100g ?? 0) * 10) / 10);
    expect(updated.fat).toBe(Math.round((portion.fatPer100g ?? 0) * 10) / 10);
    expect(updated.sugars).toBe(Math.round((portion.sugarsPer100g ?? 0) * 10) / 10);
    expect(updated.fiber).toBe(Math.round((portion.fiberPer100g ?? 0) * 10) / 10);
  });

  it("preserves id, canonicalName, displayName, naturalUnit, unitWeightG", () => {
    const item = assertDefined(createStagedItem("toast"), "toast");
    const updated = recalculateMacros(item, 60);

    expect(updated.id).toBe(item.id);
    expect(updated.canonicalName).toBe(item.canonicalName);
    expect(updated.displayName).toBe(item.displayName);
    expect(updated.naturalUnit).toBe(item.naturalUnit);
    expect(updated.unitWeightG).toBe(item.unitWeightG);
  });

  it("clamps zero portion to MIN_PORTION_G (#80)", () => {
    const item = assertDefined(createStagedItem("toast"), "toast");
    const updated = recalculateMacros(item, 0);

    expect(updated.portionG).toBe(MIN_PORTION_G);
    expect(updated.portionG).toBeGreaterThan(0);
  });

  it("clamps negative portion to MIN_PORTION_G (#80)", () => {
    const item = assertDefined(createStagedItem("toast"), "toast");
    const updated = recalculateMacros(item, -50);

    expect(updated.portionG).toBe(MIN_PORTION_G);
  });

  it("clamps NaN portion to MIN_PORTION_G (#80)", () => {
    const item = assertDefined(createStagedItem("toast"), "toast");
    const updated = recalculateMacros(item, Number.NaN);

    expect(updated.portionG).toBe(MIN_PORTION_G);
    expect(Number.isNaN(updated.calories)).toBe(false);
    expect(Number.isNaN(updated.protein)).toBe(false);
  });

  it("passes through valid positive portion unchanged", () => {
    const item = assertDefined(createStagedItem("toast"), "toast");
    const updated = recalculateMacros(item, 75);

    expect(updated.portionG).toBe(75);
  });
});

// ── Reducer: SET_VIEW ───────────────────────────────────────────────────────

describe("reducer SET_VIEW", () => {
  it("changes view to the requested panel", () => {
    const state = makeState({ view: "none" });
    const next = nutritionReducer(state, {
      type: "SET_VIEW",
      view: "favourites",
    });
    expect(next.view).toBe("favourites");
  });

  it("toggles to none when setting the same view (toggle behavior)", () => {
    const state = makeState({ view: "favourites" });
    const next = nutritionReducer(state, {
      type: "SET_VIEW",
      view: "favourites",
    });
    expect(next.view).toBe("none");
  });

  it("switches between panels without going through none", () => {
    const state = makeState({ view: "favourites" });
    const next = nutritionReducer(state, {
      type: "SET_VIEW",
      view: "foodFilter",
    });
    expect(next.view).toBe("foodFilter");
  });

  it("does not clear searchQuery on view change", () => {
    const state = makeState({ searchQuery: "hello" });
    const next = nutritionReducer(state, {
      type: "SET_VIEW",
      view: "favourites",
    });
    expect(next.searchQuery).toBe("hello");
  });

  it("preserves staging items across view changes (decision #14)", () => {
    const item = assertDefined(createStagedItem("toast"), "toast");
    const state = makeState({ stagingItems: [item] });
    const next = nutritionReducer(state, {
      type: "SET_VIEW",
      view: "calorieDetail",
    });
    expect(next.stagingItems).toHaveLength(1);
    expect(next.stagingItems[0].canonicalName).toBe("toast");
  });
});

// ── Reducer: SET_SEARCH_QUERY ───────────────────────────────────────────────

describe("reducer SET_SEARCH_QUERY", () => {
  it("updates the searchQuery", () => {
    const state = makeState();
    const next = nutritionReducer(state, {
      type: "SET_SEARCH_QUERY",
      query: "rice",
    });
    expect(next.searchQuery).toBe("rice");
  });
});

// ── Reducer: ADD_TO_STAGING ─────────────────────────────────────────────────

describe("reducer ADD_TO_STAGING", () => {
  it("adds a new food to staging when not already present", () => {
    const state = makeState();
    const next = nutritionReducer(state, {
      type: "ADD_TO_STAGING",
      canonicalName: "white rice",
    });
    const portion = assertDefined(FOOD_PORTION_DATA.get("white rice"), "white rice portion data");

    expect(next.stagingItems).toHaveLength(1);
    expect(next.stagingItems[0].canonicalName).toBe("white rice");
    expect(next.stagingItems[0].portionG).toBe(portion.defaultPortionG);
  });

  it("aggregates same canonicalName: increments portionG by unitWeightG when natural unit exists", () => {
    // toast has naturalUnit="slice", unitWeightG=30
    const state = makeState();
    const s1 = nutritionReducer(state, {
      type: "ADD_TO_STAGING",
      canonicalName: "toast",
    });
    expect(s1.stagingItems).toHaveLength(1);

    const s2 = nutritionReducer(s1, {
      type: "ADD_TO_STAGING",
      canonicalName: "toast",
    });
    // Should still be 1 item, but with increased portion
    expect(s2.stagingItems).toHaveLength(1);

    const toastPortion = assertDefined(FOOD_PORTION_DATA.get("toast"), "toast portion data");
    expect(s2.stagingItems[0].portionG).toBe(
      toastPortion.defaultPortionG + (toastPortion.unitWeightG ?? toastPortion.defaultPortionG),
    );
  });

  it("aggregates same canonicalName: increments portionG by defaultPortionG when no natural unit", () => {
    // white rice has no naturalUnit, so increment by defaultPortionG
    const state = makeState();
    const s1 = nutritionReducer(state, {
      type: "ADD_TO_STAGING",
      canonicalName: "white rice",
    });
    const s2 = nutritionReducer(s1, {
      type: "ADD_TO_STAGING",
      canonicalName: "white rice",
    });

    expect(s2.stagingItems).toHaveLength(1);
    const ricePortion = assertDefined(
      FOOD_PORTION_DATA.get("white rice"),
      "white rice portion data",
    );
    expect(s2.stagingItems[0].portionG).toBe(ricePortion.defaultPortionG * 2);
  });

  it("recalculates macros after aggregation", () => {
    const state = makeState();
    const s1 = nutritionReducer(state, {
      type: "ADD_TO_STAGING",
      canonicalName: "toast",
    });
    const s2 = nutritionReducer(s1, {
      type: "ADD_TO_STAGING",
      canonicalName: "toast",
    });

    const toastPortion = assertDefined(FOOD_PORTION_DATA.get("toast"), "toast portion data");
    const newPortionG =
      toastPortion.defaultPortionG + (toastPortion.unitWeightG ?? toastPortion.defaultPortionG);
    const expectedCal = Math.round(((toastPortion.caloriesPer100g ?? 0) * newPortionG) / 100);
    expect(s2.stagingItems[0].calories).toBe(expectedCal);
  });

  it("clamps portionG to MAX_PORTION_G on repeated ADD_TO_STAGING (W0-08)", () => {
    // toast: defaultPortionG=30, unitWeightG=30 — 17 taps would reach 510g without the clamp
    let state = makeState();
    for (let i = 0; i < 20; i++) {
      state = nutritionReducer(state, {
        type: "ADD_TO_STAGING",
        canonicalName: "toast",
      });
    }
    expect(state.stagingItems).toHaveLength(1);
    expect(state.stagingItems[0].portionG).toBe(MAX_PORTION_G);
    expect(state.stagingItems[0].portionG).toBeLessThanOrEqual(MAX_PORTION_G);
  });

  it("returns unchanged state when canonicalName is not in registry", () => {
    const state = makeState();
    const next = nutritionReducer(state, {
      type: "ADD_TO_STAGING",
      canonicalName: "nonexistent_xyz",
    });
    expect(next.stagingItems).toHaveLength(0);
    expect(next).toBe(state); // referentially identical for unknown
  });
});

// ── Reducer: REMOVE_FROM_STAGING ────────────────────────────────────────────

describe("reducer REMOVE_FROM_STAGING", () => {
  it("removes a staging item by id", () => {
    const item = assertDefined(createStagedItem("toast"), "toast");
    const state = makeState({ stagingItems: [item] });
    const next = nutritionReducer(state, {
      type: "REMOVE_FROM_STAGING",
      id: item.id,
    });
    expect(next.stagingItems).toHaveLength(0);
  });

  it("does not remove other items", () => {
    const toast = assertDefined(createStagedItem("toast"), "toast");
    const rice = assertDefined(createStagedItem("white rice"), "white rice");
    const state = makeState({ stagingItems: [toast, rice] });
    const next = nutritionReducer(state, {
      type: "REMOVE_FROM_STAGING",
      id: toast.id,
    });
    expect(next.stagingItems).toHaveLength(1);
    expect(next.stagingItems[0].canonicalName).toBe("white rice");
  });
});

// ── Reducer: ADJUST_STAGING_PORTION ─────────────────────────────────────────

describe("reducer ADJUST_STAGING_PORTION", () => {
  it("increases portionG by delta and recalculates macros", () => {
    const item = assertDefined(createStagedItem("white rice"), "white rice");
    const state = makeState({ stagingItems: [item] });
    const next = nutritionReducer(state, {
      type: "ADJUST_STAGING_PORTION",
      id: item.id,
      delta: 50,
    });

    const expectedPortionG = item.portionG + 50;
    expect(next.stagingItems[0].portionG).toBe(expectedPortionG);

    const portion = assertDefined(FOOD_PORTION_DATA.get("white rice"), "white rice portion data");
    const expectedCal = Math.round(((portion.caloriesPer100g ?? 0) * expectedPortionG) / 100);
    expect(next.stagingItems[0].calories).toBe(expectedCal);
  });

  it("removes item when portion goes to 0 or below", () => {
    const item = assertDefined(createStagedItem("toast"), "toast");
    const state = makeState({ stagingItems: [item] });
    const next = nutritionReducer(state, {
      type: "ADJUST_STAGING_PORTION",
      id: item.id,
      delta: -item.portionG,
    });
    expect(next.stagingItems).toHaveLength(0);
  });

  it("removes item when delta makes portion negative", () => {
    const item = assertDefined(createStagedItem("toast"), "toast");
    const state = makeState({ stagingItems: [item] });
    const next = nutritionReducer(state, {
      type: "ADJUST_STAGING_PORTION",
      id: item.id,
      delta: -(item.portionG + 100),
    });
    expect(next.stagingItems).toHaveLength(0);
  });

  it("does not affect other items", () => {
    const toast = assertDefined(createStagedItem("toast"), "toast");
    const rice = assertDefined(createStagedItem("white rice"), "white rice");
    const state = makeState({ stagingItems: [toast, rice] });
    const next = nutritionReducer(state, {
      type: "ADJUST_STAGING_PORTION",
      id: toast.id,
      delta: 10,
    });
    expect(next.stagingItems[1]).toBe(rice); // rice unchanged
  });

  it("clamps portion at MAX_PORTION_G (500g)", () => {
    const item = assertDefined(createStagedItem("white rice"), "white rice");
    const state = makeState({ stagingItems: [item] });
    const next = nutritionReducer(state, {
      type: "ADJUST_STAGING_PORTION",
      id: item.id,
      delta: 9999,
    });
    expect(next.stagingItems[0].portionG).toBe(MAX_PORTION_G);
  });

  it("sets lastRemovedItem with displayName when item is removed by zero portion", () => {
    const item = assertDefined(createStagedItem("toast"), "toast");
    const state = makeState({ stagingItems: [item] });
    const next = nutritionReducer(state, {
      type: "ADJUST_STAGING_PORTION",
      id: item.id,
      delta: -item.portionG,
    });
    expect(next.stagingItems).toHaveLength(0);
    expect(next.lastRemovedItem).toBe("Toast");
  });

  it("sets lastRemovedItem to null when portion stays positive", () => {
    const item = assertDefined(createStagedItem("toast"), "toast");
    const state = makeState({ stagingItems: [item] });
    const next = nutritionReducer(state, {
      type: "ADJUST_STAGING_PORTION",
      id: item.id,
      delta: 10,
    });
    expect(next.lastRemovedItem).toBeNull();
  });
});

// ── Reducer: lastRemovedItem reset ──────────────────────────────────────────

describe("reducer lastRemovedItem auto-reset", () => {
  it("resets lastRemovedItem to null on the next action", () => {
    const item = assertDefined(createStagedItem("toast"), "toast");
    const state = makeState({
      stagingItems: [item],
    });
    // First: remove via zero-portion
    const withRemoved = nutritionReducer(state, {
      type: "ADJUST_STAGING_PORTION",
      id: item.id,
      delta: -item.portionG,
    });
    expect(withRemoved.lastRemovedItem).toBe("Toast");

    // Next action should reset it
    const afterNext = nutritionReducer(withRemoved, {
      type: "SET_SEARCH_QUERY",
      query: "rice",
    });
    expect(afterNext.lastRemovedItem).toBeNull();
  });
});

// ── Reducer: CLEAR_STAGING ──────────────────────────────────────────────────

describe("reducer CLEAR_STAGING", () => {
  it("empties the staging items array", () => {
    const item = assertDefined(createStagedItem("toast"), "toast");
    const state = makeState({ stagingItems: [item] });
    const next = nutritionReducer(state, { type: "CLEAR_STAGING" });
    expect(next.stagingItems).toHaveLength(0);
  });
});

// ── Reducer: OPEN/CLOSE modals ──────────────────────────────────────────────

describe("reducer staging modal actions", () => {
  it("OPEN_STAGING_MODAL sets stagingModalOpen to true", () => {
    const state = makeState({ stagingModalOpen: false });
    const next = nutritionReducer(state, { type: "OPEN_STAGING_MODAL" });
    expect(next.stagingModalOpen).toBe(true);
  });

  it("CLOSE_STAGING_MODAL sets stagingModalOpen to false", () => {
    const state = makeState({ stagingModalOpen: true });
    const next = nutritionReducer(state, { type: "CLOSE_STAGING_MODAL" });
    expect(next.stagingModalOpen).toBe(false);
  });
});

describe("reducer water modal actions", () => {
  it("OPEN_WATER_MODAL sets waterModalOpen to true", () => {
    const state = makeState({ waterModalOpen: false });
    const next = nutritionReducer(state, { type: "OPEN_WATER_MODAL" });
    expect(next.waterModalOpen).toBe(true);
  });

  it("CLOSE_WATER_MODAL sets waterModalOpen to false", () => {
    const state = makeState({ waterModalOpen: true });
    const next = nutritionReducer(state, { type: "CLOSE_WATER_MODAL" });
    expect(next.waterModalOpen).toBe(false);
  });
});

// ── Reducer: SET_ACTIVE_MEAL_SLOT ───────────────────────────────────────────

describe("reducer SET_ACTIVE_MEAL_SLOT", () => {
  it("overrides the active meal slot", () => {
    const state = makeState({ activeMealSlot: "snack" });
    const next = nutritionReducer(state, {
      type: "SET_ACTIVE_MEAL_SLOT",
      slot: "lunch",
    });
    expect(next.activeMealSlot).toBe("lunch");
  });
});

// ── Reducer: SET_FILTER_MEAL_SLOT ───────────────────────────────────────────

describe("reducer SET_FILTER_MEAL_SLOT", () => {
  it("changes the filter meal slot", () => {
    const state = makeState({ filterMealSlot: "breakfast" });
    const next = nutritionReducer(state, {
      type: "SET_FILTER_MEAL_SLOT",
      slot: "dinner",
    });
    expect(next.filterMealSlot).toBe("dinner");
  });
});

// ── Reducer: RESET_AFTER_LOG ────────────────────────────────────────────────

describe("reducer RESET_AFTER_LOG", () => {
  it("clears staging, closes staging modal, resets view to none, clears search", () => {
    const item = assertDefined(createStagedItem("toast"), "toast");
    const state = makeState({
      stagingItems: [item],
      stagingModalOpen: true,
      view: "calorieDetail",
      searchQuery: "toast",
    });
    const next = nutritionReducer(state, { type: "RESET_AFTER_LOG" });

    expect(next.stagingItems).toHaveLength(0);
    expect(next.stagingModalOpen).toBe(false);
    expect(next.view).toBe("none");
    expect(next.searchQuery).toBe("");
  });

  it("preserves water state and meal slot settings", () => {
    const state = makeState({
      waterModalOpen: true,
      activeMealSlot: "lunch",
      filterMealSlot: "dinner",
    });
    const next = nutritionReducer(state, { type: "RESET_AFTER_LOG" });

    expect(next.waterModalOpen).toBe(true);
    expect(next.activeMealSlot).toBe("lunch");
    expect(next.filterMealSlot).toBe("dinner");
  });
});

// ── Search (Fuse.js) ────────────────────────────────────────────────────────

describe("search via Fuse.js", () => {
  it("returns empty array when query is less than 3 characters", () => {
    expect(searchFoodRegistry("ri")).toHaveLength(0);
    expect(searchFoodRegistry("")).toHaveLength(0);
    expect(searchFoodRegistry("ab")).toHaveLength(0);
  });

  it("returns empty array for whitespace-only query", () => {
    expect(searchFoodRegistry("   ")).toHaveLength(0);
  });

  it("returns results for a query of 3+ characters matching a canonical name", () => {
    const results = searchFoodRegistry("rice");
    expect(results.length).toBeGreaterThan(0);
    // white rice should be in results
    expect(results.some((r) => r.canonical === "white rice")).toBe(true);
  });

  it("returns results matching example aliases", () => {
    // "banana" is an example alias for "ripe banana"
    const results = searchFoodRegistry("banana");
    expect(results.some((r) => r.canonical === "ripe banana")).toBe(true);
  });

  it("limits results to 20", () => {
    // Use a very broad query that might match many foods
    const results = searchFoodRegistry("chicken");
    expect(results.length).toBeLessThanOrEqual(20);
  });

  it("handles typos with threshold 0.4 (dyslexia support)", () => {
    // Transposition: "banan" should still match "banana" examples
    const results = searchFoodRegistry("banan");
    expect(results.length).toBeGreaterThan(0);
  });

  it("searches use real FOOD_REGISTRY (not mocks)", () => {
    // Verify registry has expected size
    expect(FOOD_REGISTRY.length).toBeGreaterThanOrEqual(140);
  });
});

// ── Staging totals computation ──────────────────────────────────────────────

describe("staging totals (computeStagingTotals)", () => {
  it("sums calories and all 5 macros from staging items", () => {
    const toast = assertDefined(createStagedItem("toast"), "toast");
    const rice = assertDefined(createStagedItem("white rice"), "white rice");

    const totals = computeStagingTotals([toast, rice]);

    expect(totals.calories).toBe(toast.calories + rice.calories);
    expect(totals.protein).toBeCloseTo(toast.protein + rice.protein, 1);
    expect(totals.carbs).toBeCloseTo(toast.carbs + rice.carbs, 1);
    expect(totals.fat).toBeCloseTo(toast.fat + rice.fat, 1);
    expect(totals.sugars).toBeCloseTo(toast.sugars + rice.sugars, 1);
    expect(totals.fiber).toBeCloseTo(toast.fiber + rice.fiber, 1);
  });

  it("returns all zeros for empty staging", () => {
    const totals = computeStagingTotals([]);

    expect(totals.calories).toBe(0);
    expect(totals.protein).toBe(0);
    expect(totals.carbs).toBe(0);
    expect(totals.fat).toBe(0);
    expect(totals.sugars).toBe(0);
    expect(totals.fiber).toBe(0);
  });
});

// ── FUSE_OPTIONS (#58) ────────────────────────────────────────────────────

describe("FUSE_OPTIONS constant (#58)", () => {
  it("has the expected keys and threshold", () => {
    expect(FUSE_OPTIONS.keys).toEqual(["canonical", "examples"]);
    expect(FUSE_OPTIONS.threshold).toBe(0.4);
    expect(FUSE_OPTIONS.includeScore).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// W5-03: Edge case tests
// ══════════════════════════════════════════════════════════════════════════

// ── Edge case: rapid +/- does not produce negative portionG ──────────────

describe("edge case: rapid +/- never produces negative portionG", () => {
  it("removes item instead of going negative on rapid decrements", () => {
    const item = assertDefined(createStagedItem("toast"), "toast");
    let state = makeState({ stagingItems: [item] });

    // Rapid decrements: repeatedly decrease by large amounts
    for (let i = 0; i < 20; i++) {
      state = nutritionReducer(state, {
        type: "ADJUST_STAGING_PORTION",
        id: item.id,
        delta: -100,
      });
    }

    // Item should be removed, not stuck with negative portionG
    expect(state.stagingItems).toHaveLength(0);
    // No item should ever have negative portionG
    for (const staged of state.stagingItems) {
      expect(staged.portionG).toBeGreaterThanOrEqual(0);
    }
  });

  it("handles alternating rapid +/- without going below MIN_PORTION_G", () => {
    const item = assertDefined(createStagedItem("toast"), "toast");
    let state = makeState({ stagingItems: [item] });

    // Increase then decrease rapidly
    state = nutritionReducer(state, {
      type: "ADJUST_STAGING_PORTION",
      id: item.id,
      delta: 50,
    });
    state = nutritionReducer(state, {
      type: "ADJUST_STAGING_PORTION",
      id: item.id,
      delta: -50,
    });

    // Should be back to original portionG
    expect(state.stagingItems).toHaveLength(1);
    expect(state.stagingItems[0].portionG).toBe(item.portionG);
  });
});

// ── Edge case: special characters in search ──────────────────────────────

describe("edge case: special chars in search", () => {
  it("does not throw on regex-special characters", () => {
    // These characters are special in regex but Fuse.js should handle them
    const specialInputs = ["(rice)", "[banana]", "chicken*", "egg+", "toast?", "rice{2}"];
    for (const input of specialInputs) {
      expect(() => searchFoodRegistry(input)).not.toThrow();
    }
  });

  it("returns empty or valid results for bracket-heavy queries", () => {
    const results = searchFoodRegistry("(((");
    // Should not crash, may return empty
    expect(Array.isArray(results)).toBe(true);
  });
});

// ── Edge case: RESET_AFTER_LOG preserves staging on mutation failure ─────

describe("edge case: staging preserved when log mutation is not followed by RESET_AFTER_LOG", () => {
  it("staging items persist if RESET_AFTER_LOG is never dispatched (simulating error path)", () => {
    const item = assertDefined(createStagedItem("toast"), "toast");
    const state = makeState({
      stagingItems: [item],
      stagingModalOpen: true,
    });

    // On error, only CLOSE_STAGING_MODAL might be dispatched, NOT RESET_AFTER_LOG
    // Verify staging is not cleared by other actions
    const next = nutritionReducer(state, { type: "CLOSE_STAGING_MODAL" });
    expect(next.stagingItems).toHaveLength(1);
    expect(next.stagingItems[0].canonicalName).toBe("toast");
    expect(next.stagingModalOpen).toBe(false);
  });
});

// ── Edge case: empty staging → Log Food behavior ─────────────────────────

describe("edge case: empty staging interactions", () => {
  it("OPEN_STAGING_MODAL with empty staging still opens modal", () => {
    const state = makeState({ stagingItems: [] });
    const next = nutritionReducer(state, { type: "OPEN_STAGING_MODAL" });
    expect(next.stagingModalOpen).toBe(true);
    expect(next.stagingItems).toHaveLength(0);
  });

  it("RESET_AFTER_LOG works even with empty staging", () => {
    const state = makeState({
      stagingItems: [],
      searchQuery: "rice",
      view: "calorieDetail",
    });
    const next = nutritionReducer(state, { type: "RESET_AFTER_LOG" });
    expect(next.stagingItems).toHaveLength(0);
    expect(next.searchQuery).toBe("");
    expect(next.view).toBe("none");
  });
});

// ── Edge case: 20+ staging items ─────────────────────────────────────────

describe("edge case: many staging items", () => {
  it("handles 20+ distinct staging items without error", () => {
    let state = makeState();

    // Add many distinct foods from registry that have portion data
    const foodsWithPortionData = FOOD_REGISTRY.filter((e) => FOOD_PORTION_DATA.has(e.canonical));
    const toAdd = foodsWithPortionData.slice(0, 25);

    for (const entry of toAdd) {
      state = nutritionReducer(state, {
        type: "ADD_TO_STAGING",
        canonicalName: entry.canonical,
      });
    }

    expect(state.stagingItems.length).toBe(toAdd.length);

    // All items should have valid macros
    for (const item of state.stagingItems) {
      expect(item.portionG).toBeGreaterThan(0);
      expect(item.calories).toBeGreaterThanOrEqual(0);
      expect(Number.isNaN(item.calories)).toBe(false);
    }

    // Staging totals should compute without error
    const totals = computeStagingTotals(state.stagingItems);
    expect(totals.calories).toBeGreaterThan(0);
    expect(Number.isNaN(totals.calories)).toBe(false);
  });

  it("CLEAR_STAGING clears all 20+ items at once", () => {
    let state = makeState();
    const foodsWithPortionData = FOOD_REGISTRY.filter((e) => FOOD_PORTION_DATA.has(e.canonical));
    for (const entry of foodsWithPortionData.slice(0, 25)) {
      state = nutritionReducer(state, {
        type: "ADD_TO_STAGING",
        canonicalName: entry.canonical,
      });
    }
    expect(state.stagingItems.length).toBe(25);

    const next = nutritionReducer(state, { type: "CLEAR_STAGING" });
    expect(next.stagingItems).toHaveLength(0);
  });
});
