/**
 * useNutritionStore — UI state management for the Nutrition Card.
 *
 * Manages ephemeral UI state: view mode, search query, staging items,
 * modal open/close, water amount, meal slot selection.
 *
 * Does NOT hold: foodLogs, calories, macros, water intake — those
 * come from useNutritionData (read-only Convex data hook).
 *
 * Uses useReducer (decision #9). The reducer is a pure function,
 * exported for direct testing.
 */

import { FOOD_PORTION_DATA } from "@shared/foodPortionData";
import {
  FOOD_REGISTRY,
  type FoodRegistryEntry,
} from "@shared/foodRegistryData";
import Fuse from "fuse.js";
import { useMemo, useReducer } from "react";
import { getMealSlot, type MealSlot } from "@/lib/nutritionUtils";

// ── Types ───────────────────────────────────────────────────────────────────

export type NutritionView =
  | "collapsed"
  | "search"
  | "favourites"
  | "mealSlotFilter"
  | "calorieDetail";

export interface StagedItem {
  /** Unique ID for this staging row. */
  id: string;
  /** Key into FOOD_REGISTRY + FOOD_PORTION_DATA. */
  canonicalName: string;
  /** Human-friendly name. */
  displayName: string;
  /** Current portion in grams. */
  portionG: number;
  /** Natural counting unit, e.g. "slice", "medium egg". */
  naturalUnit?: string;
  /** Grams per natural unit. */
  unitWeightG?: number;
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
  /** Millilitres, for the water modal slider. */
  waterAmount: number;
  /** Auto-detected from time, user can override. */
  activeMealSlot: MealSlot;
  /** For browsing logs by slot. */
  filterMealSlot: MealSlot;
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
  | { type: "SET_WATER_AMOUNT"; amount: number }
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

// ── ID generation ───────────────────────────────────────────────────────────

function generateStagingId(): string {
  return `staged_${crypto.randomUUID()}`;
}

// ── Helper functions (exported for testing) ─────────────────────────────────

/**
 * Compute macro values for a given portion weight from FOOD_PORTION_DATA.
 * Returns 0 for any missing per-100g value.
 * Calories rounded to nearest integer; macros rounded to 1 decimal.
 */
function computeMacrosFromPortion(
  canonicalName: string,
  portionG: number,
): {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugars: number;
  fiber: number;
} {
  const data = FOOD_PORTION_DATA.get(canonicalName);
  if (!data) {
    return { calories: 0, protein: 0, carbs: 0, fat: 0, sugars: 0, fiber: 0 };
  }
  const scale = portionG / 100;
  return {
    calories: Math.round((data.caloriesPer100g ?? 0) * scale),
    protein: Math.round((data.proteinPer100g ?? 0) * scale * 10) / 10,
    carbs: Math.round((data.carbsPer100g ?? 0) * scale * 10) / 10,
    fat: Math.round((data.fatPer100g ?? 0) * scale * 10) / 10,
    sugars: Math.round((data.sugarsPer100g ?? 0) * scale * 10) / 10,
    fiber: Math.round((data.fiberPer100g ?? 0) * scale * 10) / 10,
  };
}

/**
 * Create a StagedItem for a canonical food.
 * Returns null if the food is not found in FOOD_PORTION_DATA.
 */
export function createStagedItem(canonicalName: string): StagedItem | null {
  const portionData = FOOD_PORTION_DATA.get(canonicalName);
  if (!portionData) return null;

  const portionG = portionData.defaultPortionG;
  const macros = computeMacrosFromPortion(canonicalName, portionG);

  return {
    id: generateStagingId(),
    canonicalName,
    displayName: canonicalName,
    portionG,
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
 */
export function recalculateMacros(
  item: StagedItem,
  newPortionG: number,
): StagedItem {
  const macros = computeMacrosFromPortion(item.canonicalName, newPortionG);
  return {
    ...item,
    portionG: newPortionG,
    ...macros,
  };
}

/**
 * Compute aggregate totals for a list of staging items.
 */
export function computeStagingTotals(
  items: ReadonlyArray<StagedItem>,
): StagingTotals {
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

export function nutritionReducer(
  state: NutritionState,
  action: NutritionAction,
): NutritionState {
  switch (action.type) {
    case "SET_VIEW":
      return { ...state, view: action.view, searchQuery: "" };

    case "SET_SEARCH_QUERY":
      return { ...state, searchQuery: action.query };

    case "ADD_TO_STAGING": {
      const portionData = FOOD_PORTION_DATA.get(action.canonicalName);
      if (!portionData) return state;

      const existingIndex = state.stagingItems.findIndex(
        (item) => item.canonicalName === action.canonicalName,
      );

      if (existingIndex !== -1) {
        // Aggregate: increment portion by unitWeightG or defaultPortionG
        const existing = state.stagingItems[existingIndex];
        const increment =
          portionData.unitWeightG ?? portionData.defaultPortionG;
        const newPortionG = existing.portionG + increment;
        const updated = recalculateMacros(existing, newPortionG);

        const newItems = [...state.stagingItems];
        newItems[existingIndex] = updated;
        return { ...state, stagingItems: newItems };
      }

      // New item
      const newItem = createStagedItem(action.canonicalName);
      if (!newItem) return state;
      return { ...state, stagingItems: [...state.stagingItems, newItem] };
    }

    case "REMOVE_FROM_STAGING":
      return {
        ...state,
        stagingItems: state.stagingItems.filter(
          (item) => item.id !== action.id,
        ),
      };

    case "ADJUST_STAGING_PORTION": {
      const updated = state.stagingItems
        .map((item) => {
          if (item.id !== action.id) return item;
          const newPortionG = item.portionG + action.delta;
          if (newPortionG <= 0) return null;
          return recalculateMacros(item, newPortionG);
        })
        .filter((item): item is StagedItem => item !== null);
      return { ...state, stagingItems: updated };
    }

    case "CLEAR_STAGING":
      return { ...state, stagingItems: [] };

    case "OPEN_STAGING_MODAL":
      return { ...state, stagingModalOpen: true };

    case "CLOSE_STAGING_MODAL":
      return { ...state, stagingModalOpen: false };

    case "OPEN_WATER_MODAL":
      return { ...state, waterModalOpen: true };

    case "CLOSE_WATER_MODAL":
      return { ...state, waterModalOpen: false, waterAmount: 200 };

    case "SET_WATER_AMOUNT": {
      const clamped = Math.max(50, Math.min(2000, action.amount));
      return {
        ...state,
        waterAmount: Number.isFinite(clamped) ? clamped : 200,
      };
    }

    case "SET_ACTIVE_MEAL_SLOT":
      return { ...state, activeMealSlot: action.slot };

    case "SET_FILTER_MEAL_SLOT":
      return { ...state, filterMealSlot: action.slot };

    case "RESET_AFTER_LOG":
      return {
        ...state,
        stagingItems: [],
        stagingModalOpen: false,
        view: "collapsed",
        searchQuery: "",
      };

    default:
      return state;
  }
}

// ── Fuse.js search index (module-level singleton) ───────────────────────────

const fuseIndex = new Fuse<FoodRegistryEntry>(
  FOOD_REGISTRY as FoodRegistryEntry[],
  {
    keys: ["canonical", "examples"],
    threshold: 0.4,
    includeScore: true,
  },
);

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
    view: "collapsed",
    searchQuery: "",
    stagingItems: [],
    stagingModalOpen: false,
    waterModalOpen: false,
    waterAmount: 200,
    activeMealSlot: getMealSlot(Date.now()),
    filterMealSlot: "breakfast",
  };
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useNutritionStore() {
  const [state, dispatch] = useReducer(
    nutritionReducer,
    undefined,
    createInitialState,
  );

  const searchResults = useMemo(
    () => searchFoodRegistry(state.searchQuery),
    [state.searchQuery],
  );

  const stagingTotals = useMemo(
    () => computeStagingTotals(state.stagingItems),
    [state.stagingItems],
  );

  return {
    state,
    dispatch,
    searchResults,
    stagingTotals,
    stagingCount: state.stagingItems.length,
  };
}
