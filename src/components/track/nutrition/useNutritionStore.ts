/**
 * useNutritionStore — UI state management for the Nutrition Card.
 *
 * Manages ephemeral UI state: view mode, search query, staging items,
 * modal open/close, meal slot selection.
 *
 * Does NOT hold: foodLogs, calories, macros, water intake — those
 * come from useNutritionData (read-only Convex data hook).
 *
 * Note: WaterModal manages its own local amount state internally.
 *
 * Uses useReducer (decision #9). The reducer is a pure function,
 * exported for direct testing.
 */

import { FOOD_PORTION_DATA } from "@shared/foodPortionData";
import { FOOD_REGISTRY, type FoodRegistryEntry } from "@shared/foodRegistryData";
import Fuse, { type IFuseOptions } from "fuse.js";
import { useDeferredValue, useMemo, useReducer } from "react";
import {
  computeMacrosForPortion,
  getMealSlot,
  type MealSlot,
  titleCase,
} from "@/lib/nutritionUtils";

// ── Types ───────────────────────────────────────────────────────────────────

export type NutritionView = "none" | "favourites" | "foodFilter" | "calorieDetail";

export interface StagedItem {
  /** Unique ID for this staging row. */
  id: string;
  /** Key into FOOD_REGISTRY + FOOD_PORTION_DATA. */
  canonicalName: string;
  /** Human-friendly name. */
  displayName: string;
  /** Current portion in grams (or ml for liquids — same numeric value). */
  portionG: number;
  /** True when the food is a liquid (category "drink" or "beverage"). Displays "ml" instead of "g". */
  isLiquid: boolean;
  /** Natural counting unit, e.g. "slice", "medium egg". */
  naturalUnit?: string;
  /** Grams per natural unit. */
  unitWeightG?: number;
  /** Link to ingredientProfiles entry, if selected from user's catalog. */
  productId?: string;
  /** Computed from portionG + FOOD_PORTION_DATA. */
  calories: number;
  /** Computed protein grams. */
  protein: number;
  /** Computed carbs grams. */
  carbs: number;
  /** Computed fat grams. */
  fat: number;
  /** Computed sugars grams. */
  sugars: number;
  /** Computed fiber grams. */
  fiber: number;
}

export interface NutritionState {
  view: NutritionView;
  searchQuery: string;
  stagingItems: StagedItem[];
  stagingModalOpen: boolean;
  waterModalOpen: boolean;
  /** Auto-detected from time, user can override. */
  activeMealSlot: MealSlot;
  /** For browsing logs by slot. */
  filterMealSlot: MealSlot;
  /** Set when ADJUST_STAGING_PORTION removes an item (portion <= 0). Consuming component reads + toasts, then resets on next action. */
  lastRemovedItem: string | null;
}

export type NutritionAction =
  | { type: "SET_VIEW"; view: NutritionView }
  | { type: "SET_SEARCH_QUERY"; query: string }
  | { type: "ADD_TO_STAGING"; canonicalName: string }
  | { type: "REMOVE_FROM_STAGING"; id: string }
  | { type: "ADJUST_STAGING_PORTION"; id: string; delta: number }
  | { type: "CLEAR_STAGING" }
  | { type: "OPEN_STAGING_MODAL" }
  | { type: "CLOSE_STAGING_MODAL" }
  | { type: "OPEN_WATER_MODAL" }
  | { type: "CLOSE_WATER_MODAL" }
  | { type: "SET_ACTIVE_MEAL_SLOT"; slot: MealSlot }
  | { type: "SET_FILTER_MEAL_SLOT"; slot: MealSlot }
  | { type: "RESET_AFTER_LOG" };

export interface StagingTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugars: number;
  fiber: number;
}

// ── Constants ──────────────────────────────────────────────────────────────

/** Maximum portion weight in grams. Clamps ADJUST_STAGING_PORTION. */
export const MAX_PORTION_G = 500;

/** Minimum portion weight in grams. Clamps recalculateMacros edge cases (#80). */
export const MIN_PORTION_G = 1;

/** Fuse.js configuration for food registry search (#58). */
export const FUSE_OPTIONS: IFuseOptions<FoodRegistryEntry> = {
  keys: ["canonical", "examples"],
  threshold: 0.4,
  includeScore: true,
};

/** O(1) lookup set for validating canonical names against FOOD_REGISTRY (#74). */
const FOOD_REGISTRY_CANONICALS: ReadonlySet<string> = new Set(
  FOOD_REGISTRY.map((entry) => entry.canonical),
);

/** O(1) lookup set for canonical names of liquid foods (category "drink" or "beverage"). */
const LIQUID_CANONICALS: ReadonlySet<string> = new Set(
  FOOD_REGISTRY.filter((entry) => entry.category === "drink" || entry.category === "beverage").map(
    (entry) => entry.canonical,
  ),
);

// ── ID generation ───────────────────────────────────────────────────────────

function generateStagingId(): string {
  return `staged_${crypto.randomUUID()}`;
}

// ── Helper functions (exported for testing) ─────────────────────────────────

/**
 * Create a StagedItem for a canonical food.
 * Returns null if the canonicalName is not in FOOD_REGISTRY or FOOD_PORTION_DATA.
 * Applies titleCase to displayName for clean UI presentation (#79).
 */
export function createStagedItem(canonicalName: string): StagedItem | null {
  // #74: Validate canonical name exists in FOOD_REGISTRY before proceeding.
  if (!FOOD_REGISTRY_CANONICALS.has(canonicalName)) return null;

  const portionData = FOOD_PORTION_DATA.get(canonicalName);
  if (!portionData) return null;

  const portionG = portionData.defaultPortionG;
  const macros = computeMacrosForPortion(canonicalName, portionG);

  return {
    id: generateStagingId(),
    canonicalName,
    displayName: titleCase(canonicalName),
    portionG,
    isLiquid: LIQUID_CANONICALS.has(canonicalName),
    ...(portionData.naturalUnit !== undefined && {
      naturalUnit: portionData.naturalUnit,
    }),
    ...(portionData.unitWeightG !== undefined && {
      unitWeightG: portionData.unitWeightG,
    }),
    ...macros,
  };
}

/**
 * Recompute all macro fields for a new portion weight.
 * Preserves id, canonicalName, displayName, naturalUnit, unitWeightG.
 *
 * Edge cases (#80):
 * - portionG <= 0 is clamped to MIN_PORTION_G (1g)
 * - NaN portionG is clamped to MIN_PORTION_G (1g)
 */
export function recalculateMacros(item: StagedItem, newPortionG: number): StagedItem {
  // #80: Guard against NaN and non-positive values.
  const safePortionG = Number.isNaN(newPortionG) || newPortionG <= 0 ? MIN_PORTION_G : newPortionG;

  const macros = computeMacrosForPortion(item.canonicalName, safePortionG);
  return {
    ...item,
    portionG: safePortionG,
    ...macros,
  };
}

/**
 * Compute aggregate totals for a list of staging items.
 */
export function computeStagingTotals(items: ReadonlyArray<StagedItem>): StagingTotals {
  let calories = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  let sugars = 0;
  let fiber = 0;

  for (const item of items) {
    calories += item.calories;
    protein += item.protein;
    carbs += item.carbs;
    fat += item.fat;
    sugars += item.sugars;
    fiber += item.fiber;
  }

  return {
    calories: Math.round(calories),
    protein: Math.round(protein * 10) / 10,
    carbs: Math.round(carbs * 10) / 10,
    fat: Math.round(fat * 10) / 10,
    sugars: Math.round(sugars * 10) / 10,
    fiber: Math.round(fiber * 10) / 10,
  };
}

// ── Reducer ─────────────────────────────────────────────────────────────────

export function nutritionReducer(state: NutritionState, action: NutritionAction): NutritionState {
  // Reset lastRemovedItem on every action; ADJUST_STAGING_PORTION overrides below.
  const base = state.lastRemovedItem !== null ? { ...state, lastRemovedItem: null } : state;

  switch (action.type) {
    case "SET_VIEW":
      // Toggle: if already on the requested panel, collapse to "none".
      return {
        ...base,
        view: action.view === base.view ? "none" : action.view,
      };

    case "SET_SEARCH_QUERY":
      return { ...base, searchQuery: action.query };

    case "ADD_TO_STAGING": {
      const portionData = FOOD_PORTION_DATA.get(action.canonicalName);
      if (!portionData) return base;

      const existingIndex = base.stagingItems.findIndex(
        (item) => item.canonicalName === action.canonicalName,
      );

      if (existingIndex !== -1) {
        // Aggregate: increment portion by unitWeightG or defaultPortionG, clamped to MAX_PORTION_G.
        const existing = base.stagingItems[existingIndex];
        const increment = portionData.unitWeightG ?? portionData.defaultPortionG;
        const newPortionG = Math.min(existing.portionG + increment, MAX_PORTION_G);
        const updated = recalculateMacros(existing, newPortionG);

        const newItems = [...base.stagingItems];
        newItems[existingIndex] = updated;
        return { ...base, stagingItems: newItems };
      }

      // New item
      const newItem = createStagedItem(action.canonicalName);
      if (!newItem) return base;
      return { ...base, stagingItems: [...base.stagingItems, newItem] };
    }

    case "REMOVE_FROM_STAGING":
      return {
        ...base,
        stagingItems: base.stagingItems.filter((item) => item.id !== action.id),
      };

    case "ADJUST_STAGING_PORTION": {
      let removedDisplayName: string | null = null;
      const updated = base.stagingItems
        .map((item) => {
          if (item.id !== action.id) return item;
          const newPortionG = item.portionG + action.delta;
          if (newPortionG <= 0) {
            removedDisplayName = item.displayName;
            return null;
          }
          const clamped = Math.min(newPortionG, MAX_PORTION_G);
          return recalculateMacros(item, clamped);
        })
        .filter((item): item is StagedItem => item !== null);
      return {
        ...base,
        stagingItems: updated,
        lastRemovedItem: removedDisplayName,
      };
    }

    case "CLEAR_STAGING":
      return { ...base, stagingItems: [] };

    case "OPEN_STAGING_MODAL":
      return { ...base, stagingModalOpen: true };

    case "CLOSE_STAGING_MODAL":
      return { ...base, stagingModalOpen: false };

    case "OPEN_WATER_MODAL":
      return { ...base, waterModalOpen: true };

    case "CLOSE_WATER_MODAL":
      return { ...base, waterModalOpen: false };

    case "SET_ACTIVE_MEAL_SLOT":
      return { ...base, activeMealSlot: action.slot };

    case "SET_FILTER_MEAL_SLOT":
      return { ...base, filterMealSlot: action.slot };

    case "RESET_AFTER_LOG":
      return {
        ...base,
        stagingItems: [],
        stagingModalOpen: false,
        view: "none",
        searchQuery: "",
      };

    default: {
      // #73: Exhaustive check — TypeScript will error if a new action type is added
      // to NutritionAction but not handled above.
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

// ── Fuse.js search index (module-level singleton) ───────────────────────────

// FOOD_REGISTRY is ReadonlyArray<FoodRegistryEntry> — Fuse accepts ReadonlyArray, no cast needed.
const fuseIndex = new Fuse<FoodRegistryEntry>(FOOD_REGISTRY, FUSE_OPTIONS);

/**
 * Search the food registry using Fuse.js fuzzy search.
 * Returns empty array if query is less than 3 non-whitespace characters.
 * Results limited to 20.
 */
export function searchFoodRegistry(query: string): FoodRegistryEntry[] {
  if (query.trim().length < 3) return [];
  const results = fuseIndex.search(query);
  return results.slice(0, 20).map((r) => r.item);
}

// ── Initial state factory ───────────────────────────────────────────────────

function createInitialState(): NutritionState {
  return {
    view: "none",
    searchQuery: "",
    stagingItems: [],
    stagingModalOpen: false,
    waterModalOpen: false,
    activeMealSlot: getMealSlot(Date.now()),
    filterMealSlot: "breakfast",
    lastRemovedItem: null,
  };
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useNutritionStore() {
  const [state, dispatch] = useReducer(nutritionReducer, undefined, createInitialState);

  const searchResults = useMemo(() => searchFoodRegistry(state.searchQuery), [state.searchQuery]);

  // Fix #28: Defer search results so staging interactions don't block search rendering.
  const deferredSearchResults = useDeferredValue(searchResults);

  const stagingTotals = useMemo(
    () => computeStagingTotals(state.stagingItems),
    [state.stagingItems],
  );

  return {
    state,
    dispatch,
    searchResults: deferredSearchResults,
    stagingTotals,
    stagingCount: state.stagingItems.length,
  };
}
