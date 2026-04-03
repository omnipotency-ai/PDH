/**
 * Food Registry — barrel re-export.
 *
 * All registry data (types, entries, zone arrays) lives in foodRegistryData.ts.
 * All lookup/utility functions live in foodRegistryUtils.ts.
 *
 * This file re-exports everything from both for backward compatibility.
 */

export type {
  FoodCategory,
  FoodDigestionMetadata,
  FoodDryTextureLevel,
  FoodGasLevel,
  FoodGroup,
  FoodLine,
  FoodRegistryEntry,
  FoodResidueLevel,
  FoodRiskLevel,
  FoodSubcategory,
  FoodSubzone,
  FoodZone,
} from "./foodRegistryData";

export { FOOD_GROUP_LINES, FOOD_REGISTRY } from "./foodRegistryData";

export {
  CANONICAL_FOOD_NAMES,
  FOOD_GROUPS,
  FOOD_LINES,
  calculateCaloriesForPortion,
  calculateMacrosForPortion,
  getFoodDigestionMetadata,
  getFoodEntry,
  getFoodGroup,
  getFoodLine,
  getFoodsByLine,
  getFoodsByZone,
  getFoodZone,
  getGroupDisplayName,
  getLineDisplayName,
  getLinesByGroup,
  getPortionData,
  isCanonicalFood,
  pickFoodDigestionMetadata,
} from "./foodRegistryUtils";

export type { MacroBreakdown } from "./foodRegistryUtils";

export { FOOD_PORTION_DATA } from "./foodPortionData";
export type { PortionData } from "./foodPortionData";
