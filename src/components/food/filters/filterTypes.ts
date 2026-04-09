/**
 * Filter system types for the Food Registry filter bar.
 *
 * Defines the 18 filter types, operators, value options, and state shape
 * used by the composable chip-based filter bar. Based on the spec in
 * docs/plans/filter-prompt.md.
 */

import type { ZoneRow } from "../zonesColumns";

// ── Filter Type ────────────────────────────────────────────────────────────

export enum FilterType {
  // Classification
  ZONE = "Zone",
  TYPE = "Type",
  MACROS = "Macros",
  SUBCATEGORY = "Subcategory",
  STATUS = "Status",

  // Preparation
  MECHANICAL_FORM = "Form",
  COOKING_METHOD = "Cooking",
  SKIN = "Skin",

  // Digestion Risk
  OSMOTIC_EFFECT = "Osmotic",
  FODMAP_LEVEL = "FODMAP",
  RESIDUE = "Residue",
  GAS_PRODUCING = "Gas",
  FAT_RISK = "Fat risk",
  IRRITANT_LOAD = "Irritant",
  LACTOSE_RISK = "Lactose",

  // Nutrition (numeric)
  FIBRE = "Fibre (g)",
  KCAL = "Calories",

  // Tags
  TAGS = "Tags",
}

// ── Filter Operator ────────────────────────────────────────────────────────

export enum FilterOperator {
  // Single/multi enum
  IS = "is",
  IS_NOT = "is not",
  IS_ANY_OF = "is any of",

  // Array membership (macros, tags)
  INCLUDE = "include",
  DO_NOT_INCLUDE = "do not include",
  INCLUDE_ALL_OF = "include all of",
  INCLUDE_ANY_OF = "include any of",
  EXCLUDE_ALL_OF = "exclude all of",
  EXCLUDE_IF_ANY_OF = "exclude if any of",

  // Numeric
  ABOVE = "above",
  BELOW = "below",
}

// ── Filter Option ──────────────────────────────────────────────────────────

export interface FilterOption {
  name: string;
  label?: string;
}

// ── Filter State ───────────────────────────────────────────────────────────

export interface FilterState {
  id: string;
  type: FilterType;
  operator: FilterOperator;
  values: string[];
  numericValue?: number;
}

// ── Value Options ──────────────────────────────────────────────────────────

const RISK_LEVEL_OPTIONS: FilterOption[] = [
  { name: "none" },
  { name: "low" },
  { name: "low_moderate", label: "Low\u2013moderate" },
  { name: "moderate" },
  { name: "moderate_high", label: "Moderate\u2013high" },
  { name: "high" },
];

const RESIDUE_LEVEL_OPTIONS: FilterOption[] = [
  { name: "very_low", label: "Very low" },
  { name: "low" },
  { name: "low_moderate", label: "Low\u2013moderate" },
  { name: "moderate" },
  { name: "high" },
];

export const FILTER_VALUE_OPTIONS: Record<FilterType, FilterOption[]> = {
  [FilterType.ZONE]: [
    { name: "1", label: "Early recovery" },
    { name: "2", label: "Expanding" },
    { name: "3", label: "Experimental" },
  ],
  [FilterType.TYPE]: [{ name: "food" }, { name: "liquid" }],
  [FilterType.MACROS]: [
    { name: "carbohydrate", label: "Carbs" },
    { name: "protein" },
    { name: "fat" },
  ],
  [FilterType.SUBCATEGORY]: [
    { name: "meat", label: "Meat" },
    { name: "fish", label: "Fish" },
    { name: "egg", label: "Egg" },
    { name: "legume", label: "Legume" },
    { name: "grain", label: "Grain" },
    { name: "vegetable", label: "Vegetable" },
    { name: "root_vegetable", label: "Root veg" },
    { name: "fruit", label: "Fruit" },
    { name: "oil", label: "Oil" },
    { name: "butter_cream", label: "Butter/cream" },
    { name: "nut_seed", label: "Nut/seed" },
    { name: "nut", label: "Nut" },
    { name: "milk_yogurt", label: "Milk/yogurt" },
    { name: "cheese", label: "Cheese" },
    { name: "dairy", label: "Dairy" },
    { name: "dairy_alternative", label: "Dairy alt" },
    { name: "dessert", label: "Dessert" },
    { name: "frozen", label: "Frozen" },
    { name: "herb", label: "Herb" },
    { name: "spice", label: "Spice" },
    { name: "sauce", label: "Sauce" },
    { name: "acid", label: "Acid" },
    { name: "thickener", label: "Thickener" },
    { name: "seasoning", label: "Seasoning" },
    { name: "irritant", label: "Irritant" },
    { name: "processed", label: "Processed" },
    { name: "composite_dish", label: "Composite" },
    { name: "sugar", label: "Sugar" },
    { name: "broth", label: "Broth" },
    { name: "hot_drink", label: "Hot drink" },
    { name: "juice", label: "Juice" },
    { name: "supplement", label: "Supplement" },
    { name: "water", label: "Water" },
    { name: "alcohol", label: "Alcohol" },
    { name: "fizzy_drink", label: "Fizzy drink" },
  ],
  [FilterType.STATUS]: [
    { name: "building", label: "Currently testing" },
    { name: "like", label: "Safe + like" },
    { name: "dislike", label: "Safe + don't like" },
    { name: "watch", label: "Like + don't tolerate" },
    { name: "avoid", label: "Don't like + don't tolerate" },
  ],
  [FilterType.MECHANICAL_FORM]: [
    { name: "whole" },
    { name: "mashed_pureed", label: "Mashed / pureed" },
    { name: "diced_chopped_sliced", label: "Diced / chopped" },
    { name: "ground_minced", label: "Ground / minced" },
    { name: "blended" },
    { name: "juiced" },
  ],
  [FilterType.COOKING_METHOD]: [
    { name: "raw" },
    { name: "al_dente", label: "Al dente" },
    { name: "wet_heat", label: "Boiled / steamed" },
    { name: "dry_heat_no_oil", label: "Baked / grilled" },
    { name: "shallow_fried", label: "Pan-fried / sauteed" },
    { name: "deep_fried", label: "Deep fried" },
    { name: "processed", label: "Processed / ready-made" },
  ],
  [FilterType.SKIN]: [
    { name: "on", label: "Skin on" },
    { name: "off", label: "Skin off" },
    { name: "n/a" },
  ],

  // Graduated risk scales
  [FilterType.OSMOTIC_EFFECT]: RISK_LEVEL_OPTIONS,
  [FilterType.FODMAP_LEVEL]: RISK_LEVEL_OPTIONS,
  [FilterType.FAT_RISK]: RISK_LEVEL_OPTIONS,
  [FilterType.IRRITANT_LOAD]: RISK_LEVEL_OPTIONS,
  [FilterType.LACTOSE_RISK]: RISK_LEVEL_OPTIONS,
  [FilterType.RESIDUE]: RESIDUE_LEVEL_OPTIONS,
  [FilterType.GAS_PRODUCING]: [{ name: "no" }, { name: "possible" }, { name: "yes" }],

  // Numeric filters have no value options (rendered as input)
  [FilterType.FIBRE]: [],
  [FilterType.KCAL]: [],

  // Tags — seed values; will be dynamically populated from registry later
  [FilterType.TAGS]: [
    { name: "caffeinated" },
    { name: "nightshade" },
    { name: "cruciferous" },
    { name: "fermented" },
    { name: "gluten_containing", label: "Gluten containing" },
    { name: "lactose_containing", label: "Lactose containing" },
    { name: "high_histamine", label: "High histamine" },
    { name: "added_sugar", label: "Added sugar" },
    { name: "whole_grain", label: "Whole grain" },
    { name: "refined" },
  ],
};

// ── Operators Per Filter Type ──────────────────────────────────────────────

/**
 * Returns available operators for a given filter type, based on how many
 * values are currently selected. Operator set changes when count crosses 1.
 */
export function getOperatorsForType(
  filterType: FilterType,
  selectedCount: number,
): FilterOperator[] {
  switch (filterType) {
    // Single-value enums
    case FilterType.ZONE:
    case FilterType.TYPE:
    case FilterType.SKIN:
    case FilterType.GAS_PRODUCING:
      return selectedCount > 1
        ? [FilterOperator.IS_ANY_OF, FilterOperator.IS_NOT]
        : [FilterOperator.IS, FilterOperator.IS_NOT];

    // Multi-value arrays (macros, tags)
    case FilterType.MACROS:
    case FilterType.TAGS:
      return selectedCount > 1
        ? [
            FilterOperator.INCLUDE_ANY_OF,
            FilterOperator.INCLUDE_ALL_OF,
            FilterOperator.EXCLUDE_ALL_OF,
            FilterOperator.EXCLUDE_IF_ANY_OF,
          ]
        : [FilterOperator.INCLUDE, FilterOperator.DO_NOT_INCLUDE];

    // Graduated scales
    case FilterType.OSMOTIC_EFFECT:
    case FilterType.FODMAP_LEVEL:
    case FilterType.RESIDUE:
    case FilterType.FAT_RISK:
    case FilterType.IRRITANT_LOAD:
    case FilterType.LACTOSE_RISK:
    case FilterType.STATUS:
    case FilterType.MECHANICAL_FORM:
    case FilterType.COOKING_METHOD:
    case FilterType.SUBCATEGORY:
      return selectedCount > 1
        ? [FilterOperator.IS_ANY_OF, FilterOperator.IS_NOT]
        : [FilterOperator.IS, FilterOperator.IS_NOT];

    // Numeric thresholds
    case FilterType.FIBRE:
    case FilterType.KCAL:
      return [FilterOperator.ABOVE, FilterOperator.BELOW];
  }
}

// ── Default Operator ───────────────────────────────────────────────────────

/** Returns the default operator for a newly added filter of the given type. */
export function getDefaultOperator(filterType: FilterType): FilterOperator {
  return getOperatorsForType(filterType, 0)[0];
}

// ── Numeric Filter Check ───────────────────────────────────────────────────

export function isNumericFilterType(filterType: FilterType): boolean {
  return filterType === FilterType.FIBRE || filterType === FilterType.KCAL;
}

// ── Display Label ──────────────────────────────────────────────────────────

/** Format a value name for display, using the label from options if available. */
export function getValueDisplayLabel(filterType: FilterType, valueName: string): string {
  const options = FILTER_VALUE_OPTIONS[filterType];
  const match = options.find((o) => o.name === valueName);
  return match?.label ?? valueName;
}

// ── Apply Filters ──────────────────────────────────────────────────────────

/**
 * Maps each FilterType to the corresponding ZoneRow field accessor.
 * Returns the value(s) from the row for comparison, always as string[].
 */
function getRowValue(row: ZoneRow, filterType: FilterType): string[] | number | null {
  switch (filterType) {
    case FilterType.ZONE:
      return [String(row.zone)];
    case FilterType.TYPE:
      // ZoneRow doesn't have a type field yet; return null for unmatched
      return null;
    case FilterType.MACROS:
      // ZoneRow doesn't have macros; return null
      return null;
    case FilterType.SUBCATEGORY:
      return [row.subcategory];
    case FilterType.STATUS:
      // ZoneRow doesn't have status; return null
      return null;
    case FilterType.MECHANICAL_FORM:
      // ZoneRow doesn't have mechanicalForm; return null
      return null;
    case FilterType.COOKING_METHOD:
      // ZoneRow doesn't have cookingMethod; return null
      return null;
    case FilterType.SKIN:
      // ZoneRow doesn't have skin; return null
      return null;
    case FilterType.OSMOTIC_EFFECT:
      return row.osmoticEffect !== undefined ? [row.osmoticEffect] : null;
    case FilterType.FODMAP_LEVEL:
      // ZoneRow doesn't have fodmapLevel; return null
      return null;
    case FilterType.RESIDUE:
      return row.totalResidue !== undefined ? [row.totalResidue] : null;
    case FilterType.GAS_PRODUCING:
      return row.gasProducing !== undefined ? [row.gasProducing] : null;
    case FilterType.FAT_RISK:
      return row.highFatRisk !== undefined ? [row.highFatRisk] : null;
    case FilterType.IRRITANT_LOAD:
      return row.irritantLoad !== undefined ? [row.irritantLoad] : null;
    case FilterType.LACTOSE_RISK:
      return row.lactoseRisk !== undefined ? [row.lactoseRisk] : null;
    case FilterType.FIBRE:
      return row.fiberTotalApproxG !== undefined ? row.fiberTotalApproxG : null;
    case FilterType.KCAL:
      // ZoneRow doesn't have kcal; return null
      return null;
    case FilterType.TAGS:
      // ZoneRow doesn't have tags; return null
      return null;
  }
}

/**
 * Tests whether a single row matches a single filter.
 * Returns true if the row should be included.
 */
function matchesSingleFilter(row: ZoneRow, filter: FilterState): boolean {
  const rowValue = getRowValue(row, filter.type);

  // If the row has no value for this field, exclude it from positive matches
  // but include it for negative matches (IS_NOT, DO_NOT_INCLUDE, etc.)
  if (rowValue === null) {
    switch (filter.operator) {
      case FilterOperator.IS_NOT:
      case FilterOperator.DO_NOT_INCLUDE:
      case FilterOperator.EXCLUDE_ALL_OF:
      case FilterOperator.EXCLUDE_IF_ANY_OF:
        return true;
      default:
        return false;
    }
  }

  // Numeric filters
  if (typeof rowValue === "number") {
    const threshold = filter.numericValue;
    if (threshold === undefined) return true; // No threshold set, pass through
    switch (filter.operator) {
      case FilterOperator.ABOVE:
        return rowValue > threshold;
      case FilterOperator.BELOW:
        return rowValue < threshold;
      default:
        return true;
    }
  }

  // String array filters
  const values = filter.values;
  if (values.length === 0) return true; // No values selected, pass through

  switch (filter.operator) {
    case FilterOperator.IS:
      return values.length > 0 && rowValue.includes(values[0]);

    case FilterOperator.IS_NOT:
      return values.length > 0 && !rowValue.includes(values[0]);

    case FilterOperator.IS_ANY_OF:
      return rowValue.some((v) => values.includes(v));

    case FilterOperator.INCLUDE:
      return values.length > 0 && rowValue.some((v) => v === values[0]);

    case FilterOperator.DO_NOT_INCLUDE:
      return values.length > 0 && !rowValue.some((v) => v === values[0]);

    case FilterOperator.INCLUDE_ALL_OF:
      return values.every((v) => rowValue.includes(v));

    case FilterOperator.INCLUDE_ANY_OF:
      return values.some((v) => rowValue.includes(v));

    case FilterOperator.EXCLUDE_ALL_OF:
      return !values.every((v) => rowValue.includes(v));

    case FilterOperator.EXCLUDE_IF_ANY_OF:
      return !values.some((v) => rowValue.includes(v));

    case FilterOperator.ABOVE:
    case FilterOperator.BELOW:
      // Numeric operators should not appear with string values
      return true;
  }
}

/**
 * Pure filter function: applies all active filters to rows using AND logic.
 * All filters must match for a row to be included.
 */
export function applyFilters(rows: ZoneRow[], filters: FilterState[]): ZoneRow[] {
  if (filters.length === 0) return rows;
  return rows.filter((row) => filters.every((filter) => matchesSingleFilter(row, filter)));
}
