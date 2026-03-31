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
  isCanonicalFood,
  pickFoodDigestionMetadata,
} from "./foodRegistryUtils";
