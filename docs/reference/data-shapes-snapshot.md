# Data Shapes Snapshot

> Generated 2026-04-08. Reference for food logging pipeline work.

---

## 1. `convex/schema.ts` — ingredientProfiles

```ts
ingredientProfiles: defineTable({
  userId: v.string(),
  canonicalName: v.string(),
  displayName: v.string(),
  tags: v.array(v.string()),
  foodGroup: v.union(foodGroupValidator, v.null()),
  foodLine: v.union(foodLineValidator, v.null()),
  lowResidue: v.union(v.boolean(), v.null()),
  source: v.union(v.literal("manual"), v.literal("openfoodfacts"), v.null()),
  externalId: v.union(v.string(), v.null()),
  ingredientsText: v.union(v.string(), v.null()),
  nutritionPer100g: v.object({
    kcal: v.union(v.number(), v.null()),
    fatG: v.union(v.number(), v.null()),
    saturatedFatG: v.union(v.number(), v.null()),
    carbsG: v.union(v.number(), v.null()),
    sugarsG: v.union(v.number(), v.null()),
    fiberG: v.union(v.number(), v.null()),
    proteinG: v.union(v.number(), v.null()),
    saltG: v.union(v.number(), v.null()),
  }),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_userId", ["userId"])
  .index("by_userId_canonicalName", ["userId", "canonicalName"]),
```

## 2. `convex/schema.ts` — foodLibrary

```ts
foodLibrary: defineTable({
  userId: v.string(),
  canonicalName: v.string(),
  type: v.union(v.literal("ingredient"), v.literal("composite")),
  ingredients: v.array(v.string()),
  createdAt: v.number(),
})
  .index("by_userId", ["userId"])
  .index("by_userId_name", ["userId", "canonicalName"]),
```

## 3. `shared/foodRegistryData.ts` — Registry types & zone model

```ts
export type FoodZone = 1 | 2 | 3;
export type FoodSubzone = "1A" | "1B";

export const FOOD_GROUP_LINES = {
  protein: ["meat_fish", "eggs_dairy", "vegetable_protein"],
  carbs: ["grains", "vegetables", "fruit"],
  fats: ["oils", "dairy_fats", "nuts_seeds"],
  seasoning: ["sauces_condiments", "herbs_spices"],
} as const;

export type FoodGroup = keyof typeof FOOD_GROUP_LINES;
export type FoodLine = (typeof FOOD_GROUP_LINES)[FoodGroup][number];

export type FoodCategory =
  | "protein"
  | "carbohydrate"
  | "fat"
  | "dairy"
  | "condiment"
  | "drink"
  | "beverage";

export type FoodSubcategory = "meat" | "fish";
// ... (continues with full subcategory list)
```

## 4. `shared/foodPortionData.ts` — PortionData interface

```ts
export interface PortionData {
  /** Default portion weight in grams. Used as the initial slider value. */
  defaultPortionG: number;

  /**
   * Natural counting unit for discrete foods (e.g. "1 medium egg", "1 slice").
   * Omitted for amorphous/continuous foods (rice, oil, soup).
   */
  naturalUnit?: string;

  /**
   * Weight of one natural unit in grams. Must be present when naturalUnit is set.
   * May differ from defaultPortionG (e.g. bread: naturalUnit="1 slice"=36g,
   * defaultPortionG=72g for 2 slices).
   */
  unitWeightG?: number;

  // -- Nutrition per 100g --------------------------------------------------

  /** Kilocalories per 100g. */
  caloriesPer100g?: number;
  /** Protein grams per 100g. */
  proteinPer100g?: number;
  /** Total carbohydrate grams per 100g. */
  carbsPer100g?: number;
  /** Total fat grams per 100g. */
  fatPer100g?: number;
  /** Sugars grams per 100g. */
  sugarsPer100g?: number;
  // (also fiberPer100g, saturatedFatPer100g, saltPer100g)
}
```

## 5. `src/components/track/nutrition/useNutritionStore.ts` — StagedItem & staging math

```ts
export interface StagedItem {
  id: string;
  canonicalName: string;
  displayName: string;
  portionG: number;
  isLiquid: boolean;
  naturalUnit?: string;
  unitWeightG?: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugars: number;
  fiber: number;
}

export const MAX_PORTION_G = 500;
export const MIN_PORTION_G = 1;
```

### createStagedItem — initial portion from FOOD_PORTION_DATA

```ts
export function createStagedItem(canonicalName: string): StagedItem | null {
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
```

### ADD_TO_STAGING — aggregation on repeat tap

```ts
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
```

### ADJUST_STAGING_PORTION — delta-based with auto-remove

```ts
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
```

## 6. `src/lib/nutritionUtils.ts` — computeMacrosForPortion (the core math)

```ts
/**
 * Canonical per-100g scaling function.
 *
 * Looks up `canonicalName` in FOOD_PORTION_DATA and scales all macro values
 * by `portionG / 100`. Returns zeros for unknown foods.
 *
 * Calories: rounded to nearest integer. Macros: rounded to 1 decimal place.
 */
export function computeMacrosForPortion(
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
```

### recalculateMacros — wraps computeMacrosForPortion with clamping

```ts
export function recalculateMacros(
  item: StagedItem,
  newPortionG: number,
): StagedItem {
  const safePortionG =
    Number.isNaN(newPortionG) || newPortionG <= 0 ? MIN_PORTION_G : newPortionG;
  const macros = computeMacrosForPortion(item.canonicalName, safePortionG);
  return {
    ...item,
    portionG: safePortionG,
    ...macros,
  };
}
```

### getItemMacros — resolves portion from logged FoodItem

```ts
export function getItemMacros(item: FoodItem): {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugars: number;
  fiber: number;
  portionG: number;
} {
  const canonical = item.canonicalName;
  if (canonical == null) return { ...ZERO_ITEM_MACROS };

  const portionData = FOOD_PORTION_DATA.get(canonical);
  if (!portionData) return { ...ZERO_ITEM_MACROS };

  let portionG = 0;
  if (item.quantity != null && item.quantity > 0) {
    portionG = item.quantity;
  } else {
    portionG = portionData.defaultPortionG;
  }

  const macros = computeMacrosForPortion(canonical, portionG);
  return { ...macros, portionG };
}
```

### calculateTotalCalories / calculateTotalMacros — aggregate across logs

```ts
export function calculateTotalCalories(
  logs: ReadonlyArray<{ data: { items: FoodLogData["items"] } }>,
): number {
  let total = 0;
  for (const log of logs) {
    for (const item of log.data.items) {
      const canonical = item.canonicalName;
      if (canonical == null) continue;
      const portionData = FOOD_PORTION_DATA.get(canonical);
      if (portionData?.caloriesPer100g == null) continue;
      const portionG = getEffectivePortionG(item);
      total += (portionData.caloriesPer100g * portionG) / 100;
    }
  }
  return Math.round(total);
}

export function calculateTotalMacros(
  logs: ReadonlyArray<{ data: { items: FoodLogData["items"] } }>,
): MacroTotals {
  const totals: MacroTotals = {
    protein: 0,
    carbs: 0,
    fat: 0,
    sugars: 0,
    fiber: 0,
  };
  for (const log of logs) {
    for (const item of log.data.items) {
      const canonical = item.canonicalName;
      if (canonical == null) continue;
      const portionData = FOOD_PORTION_DATA.get(canonical);
      if (!portionData) continue;
      const portionG = getEffectivePortionG(item);
      const scale = portionG / 100;
      totals.protein += (portionData.proteinPer100g ?? 0) * scale;
      totals.carbs += (portionData.carbsPer100g ?? 0) * scale;
      totals.fat += (portionData.fatPer100g ?? 0) * scale;
      totals.sugars += (portionData.sugarsPer100g ?? 0) * scale;
      totals.fiber += (portionData.fiberPer100g ?? 0) * scale;
    }
  }
  // Round each to 1 decimal place
  totals.protein = Math.round(totals.protein * 10) / 10;
  totals.carbs = Math.round(totals.carbs * 10) / 10;
  totals.fat = Math.round(totals.fat * 10) / 10;
  totals.sugars = Math.round(totals.sugars * 10) / 10;
  totals.fiber = Math.round(totals.fiber * 10) / 10;
  return totals;
}
```

---

## Data flow summary

```
FOOD_REGISTRY (canonical names, zones, groups, categories)
       |
       v
FOOD_PORTION_DATA (defaultPortionG, naturalUnit, unitWeightG, *Per100g nutrition)
       |
       v
createStagedItem() ──> StagedItem { portionG, macros via computeMacrosForPortion }
       |
       v
ADD_TO_STAGING / ADJUST_STAGING_PORTION ──> recalculateMacros() ──> updated StagedItem
       |
       v
computeStagingTotals() ──> StagingTotals { calories, protein, carbs, fat, sugars, fiber }

--- After log is committed to Convex ---

logs table (type: "food", data.items[].canonicalName, data.items[].quantity)
       |
       v
calculateTotalCalories() / calculateTotalMacros() ──> reads FOOD_PORTION_DATA again
       |
       v
ingredientProfiles (per-user, has its own nutritionPer100g — NOT used in staging math today)
foodLibrary (composite recipes — NOT used in staging math today)
```
