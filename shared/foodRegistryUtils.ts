/**
 * Food Registry Utilities — lookup, search, and display functions
 * that operate on the canonical food registry.
 *
 * All data definitions live in foodRegistryData.ts.
 * This file imports the registry and provides O(1) lookups + helpers.
 */

import type {
  FoodDigestionMetadata,
  FoodGroup,
  FoodLine,
  FoodRegistryEntry,
  FoodZone,
} from "./foodRegistryData";
import { FOOD_GROUP_LINES, FOOD_REGISTRY } from "./foodRegistryData";
import type { PortionData } from "./foodPortionData";
import { FOOD_PORTION_DATA } from "./foodPortionData";

// Re-export PortionData so consumers can import from this utils file
export type { PortionData };

/**
 * All canonical food names as a Set for O(1) membership checks.
 */
export const CANONICAL_FOOD_NAMES: ReadonlySet<string> = new Set(
  FOOD_REGISTRY.map((e) => e.canonical),
);

/**
 * O(1) lookup map from canonical name to registry entry.
 * Built once at module load.
 */
const FOOD_ENTRY_MAP: ReadonlyMap<string, FoodRegistryEntry> = new Map(
  FOOD_REGISTRY.map((e) => [e.canonical, e]),
);

export function pickFoodDigestionMetadata(
  source: FoodDigestionMetadata,
): FoodDigestionMetadata | undefined {
  const metadata: FoodDigestionMetadata = {
    ...(source.osmoticEffect !== undefined && {
      osmoticEffect: source.osmoticEffect,
    }),
    ...(source.totalResidue !== undefined && {
      totalResidue: source.totalResidue,
    }),
    ...(source.fiberTotalApproxG !== undefined && {
      fiberTotalApproxG: source.fiberTotalApproxG,
    }),
    ...(source.fiberInsolubleLevel !== undefined && {
      fiberInsolubleLevel: source.fiberInsolubleLevel,
    }),
    ...(source.fiberSolubleLevel !== undefined && {
      fiberSolubleLevel: source.fiberSolubleLevel,
    }),
    ...(source.gasProducing !== undefined && {
      gasProducing: source.gasProducing,
    }),
    ...(source.dryTexture !== undefined && {
      dryTexture: source.dryTexture,
    }),
    ...(source.irritantLoad !== undefined && {
      irritantLoad: source.irritantLoad,
    }),
    ...(source.highFatRisk !== undefined && {
      highFatRisk: source.highFatRisk,
    }),
    ...(source.lactoseRisk !== undefined && {
      lactoseRisk: source.lactoseRisk,
    }),
  };

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

export function isCanonicalFood(name: string): boolean {
  return CANONICAL_FOOD_NAMES.has(name);
}

export function getFoodEntry(canonical: string): FoodRegistryEntry | undefined {
  return FOOD_ENTRY_MAP.get(canonical);
}

export function getFoodDigestionMetadata(
  canonical: string,
): FoodDigestionMetadata | undefined {
  const entry = getFoodEntry(canonical);
  return entry ? pickFoodDigestionMetadata(entry) : undefined;
}

export function getFoodZone(canonical: string): FoodZone | undefined {
  return getFoodEntry(canonical)?.zone;
}

export function getFoodsByZone(
  zone: FoodZone,
): ReadonlyArray<FoodRegistryEntry> {
  return FOOD_REGISTRY.filter((e) => e.zone === zone);
}

// ── GROUP → LINE mapping ──────────────────────────────────────────────────

export const FOOD_GROUPS: ReadonlyArray<FoodGroup> = Object.freeze(
  Object.keys(FOOD_GROUP_LINES) as FoodGroup[],
);

export const FOOD_LINES: ReadonlyArray<FoodLine> = Object.freeze(
  Object.values(FOOD_GROUP_LINES).flatMap((lines) => [...lines]) as FoodLine[],
);

export function getFoodGroup(canonical: string): FoodGroup | undefined {
  return getFoodEntry(canonical)?.group;
}

export function getFoodLine(canonical: string): FoodLine | undefined {
  return getFoodEntry(canonical)?.line;
}

export function getFoodsByLine(
  line: FoodLine,
): ReadonlyArray<FoodRegistryEntry> {
  return FOOD_REGISTRY.filter((e) => e.line === line).sort(
    (a, b) => a.lineOrder - b.lineOrder,
  );
}

export function getLinesByGroup(group: FoodGroup): ReadonlyArray<FoodLine> {
  return FOOD_GROUP_LINES[group];
}

export function getLineDisplayName(line: FoodLine): string {
  const names: Record<FoodLine, string> = {
    meat_fish: "Meat & Fish",
    eggs_dairy: "Eggs & Dairy",
    vegetable_protein: "Vegetable Protein",
    grains: "Grains",
    vegetables: "Vegetables",
    fruit: "Fruit",
    oils: "Oils",
    dairy_fats: "Dairy Fats",
    nuts_seeds: "Nuts & Seeds",
    sauces_condiments: "Sauces & Condiments",
    herbs_spices: "Herbs & Spices",
  };
  return names[line];
}

export function getGroupDisplayName(group: FoodGroup): string {
  const names: Record<FoodGroup, string> = {
    protein: "Protein",
    carbs: "Carbs",
    fats: "Fats",
    seasoning: "Seasoning",
  };
  return names[group];
}

// ── PORTION DATA utilities ─────────────────────────────────────────────────

/**
 * Look up static portion + nutrition data for a canonical food.
 * O(1) via Map. Returns undefined if no data seeded for this food.
 */
export function getPortionData(canonical: string): PortionData | undefined {
  return FOOD_PORTION_DATA.get(canonical);
}

/**
 * Calculate estimated calories for a specific portion weight.
 * Returns undefined when no calorie data exists for this food.
 * Rounded to nearest integer.
 */
export function calculateCaloriesForPortion(
  canonical: string,
  portionG: number,
): number | undefined {
  const data = FOOD_PORTION_DATA.get(canonical);
  if (data?.caloriesPer100g == null) return undefined;
  return Math.round((data.caloriesPer100g * portionG) / 100);
}

/**
 * Macronutrient breakdown for a given portion weight.
 * undefined for each field = no data available (distinct from 0 = food has none of this macro).
 */
export interface MacroBreakdown {
  protein: number | undefined;
  carbs: number | undefined;
  fat: number | undefined;
  sugars: number | undefined;
  fiber: number | undefined;
}

/**
 * Calculate macronutrient breakdown for a specific portion weight.
 * Each field is undefined when source data is missing.
 * Non-undefined values rounded to 1 decimal place.
 */
export function calculateMacrosForPortion(
  canonical: string,
  portionG: number,
): MacroBreakdown {
  const data = FOOD_PORTION_DATA.get(canonical);
  if (!data) {
    return {
      protein: undefined,
      carbs: undefined,
      fat: undefined,
      sugars: undefined,
      fiber: undefined,
    };
  }
  const scale = (v: number | undefined): number | undefined =>
    v != null ? Math.round((v * portionG * 10) / 100) / 10 : undefined;

  return {
    protein: scale(data.proteinPer100g),
    carbs: scale(data.carbsPer100g),
    fat: scale(data.fatPer100g),
    sugars: scale(data.sugarsPer100g),
    fiber: scale(data.fiberPer100g),
  };
}
