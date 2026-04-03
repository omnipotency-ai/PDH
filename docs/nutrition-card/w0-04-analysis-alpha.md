# W0-04 Analysis: Portion Data Schema — Agent Alpha

**Date:** 2026-04-03
**Scope:** Portion data extension for FoodRegistryEntry, ingredientProfiles audit, seeding strategy, utility function signatures.

---

## 1. TypeScript Interfaces

### 1.1 Current FoodRegistryEntryBase Shape

The base interface lives at `shared/foodRegistryData.ts:116-139`. It extends `FoodDigestionMetadata` and contains:

```typescript
interface FoodRegistryEntryBase extends FoodDigestionMetadata {
  canonical: string;
  zone: FoodZone;
  subzone?: FoodSubzone;
  category: FoodCategory;
  subcategory: FoodSubcategory;
  macros: ReadonlyArray<"protein" | "carbohydrate" | "fat">;
  examples: ReadonlyArray<string>;
  group: FoodGroup;
  line: FoodLine;
  lineOrder: number;
  notes?: string;
}
```

The `FoodRegistryEntry` export type (`shared/foodRegistryData.ts:141-146`) is a discriminated union that constrains `group`/`line` pairs via a mapped type over `FoodGroup`.

The registry contains **147 entries** across 4 zones:

- Zone 1A: 9 entries (clear/full liquids)
- Zone 1B: 29 entries (soft low-residue solids)
- Zone 2: 59 entries (expanded defensive diet)
- Zone 3: 50 entries (experimental foods)

### 1.2 Proposed Portion + Nutrition Extension

The new fields should be added to `FoodRegistryEntryBase` as **optional fields** to avoid breaking the 147 existing entries during incremental population. Two logical groups: portion sizing and macronutrient density.

```typescript
// --- Proposed additions to FoodRegistryEntryBase (shared/foodRegistryData.ts:116) ---

interface FoodRegistryEntryBase extends FoodDigestionMetadata {
  // ... existing fields unchanged ...

  // ── Portion sizing ──────────────────────────────────────────────
  /**
   * Default portion weight in grams. Used as the initial slider value
   * when the user does not specify a portion.
   * Example: "ripe banana" → 120, "white rice" → 150.
   */
  defaultPortionG?: number;

  /**
   * Natural counting unit for discrete foods.
   * Example: "egg" → "egg", "ripe banana" → "banana", "toast" → "slice".
   * Omitted for continuous/amorphous foods (e.g. "white rice", "olive oil").
   */
  naturalUnit?: string;

  /**
   * Weight of one natural unit in grams. Only meaningful when naturalUnit is set.
   * Example: "egg" → 50 (one medium egg), "toast" → 30 (one slice).
   */
  unitWeightG?: number;

  // ── Macronutrient density (per 100 g) ──────────────────────────
  /**
   * All values are per 100 g of edible portion (cooked weight where relevant).
   * Source: ingredientProfiles.nutritionPer100g for populated items,
   * USDA FoodData Central or Open Food Facts for gaps.
   */
  caloriesPer100g?: number;
  proteinPer100g?: number;
  carbsPer100g?: number;
  fatPer100g?: number;
  sugarsPer100g?: number;
  fibrePer100g?: number;
}
```

### 1.3 Design Rationale

**Why extend FoodRegistryEntryBase rather than a separate map?**

- The registry is already the single source of truth for canonical food metadata (`shared/foodRegistryData.ts:1-24`).
- Utilities in `shared/foodRegistryUtils.ts` already provide O(1) lookups via `FOOD_ENTRY_MAP` (line 29-31). Adding portion data to the entry avoids a second parallel lookup table.
- However, see Section 3 for a **FOOD_PORTION_DATA** static map as a transitional approach until all 147 entries are populated.

**Why optional?**

- Only a subset of entries will have data initially. Making them required would force hallucinated values or break the build.
- The nutrition card UI must handle `undefined` gracefully (show "no data" rather than zeros).

**Why "per 100g" naming instead of matching ingredientProfiles "xG" convention?**

- The registry is a static, client-side, non-user-scoped data structure. Using descriptive names (`caloriesPer100g`) is clearer for reading registry data entries inline.
- The `ingredientProfiles` table uses compact names (`kcal`, `fatG`) because it is a Convex document with patch semantics. The mapping between the two is documented in Section 2.3.

---

## 2. ingredientProfiles Coverage Audit

### 2.1 Table Schema (convex/schema.ts:113-138)

```typescript
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
});
```

**Indexes:** `by_userId`, `by_userId_canonicalName` (schema.ts:137-138).

### 2.2 nutritionPer100g Field Inventory

The `nutritionPer100g` object contains **8 fields**, all nullable numbers:

| Field           | Unit      | Description              |
| --------------- | --------- | ------------------------ |
| `kcal`          | kcal/100g | Energy (kilocalories)    |
| `fatG`          | g/100g    | Total fat                |
| `saturatedFatG` | g/100g    | Saturated fat subset     |
| `carbsG`        | g/100g    | Total carbohydrates      |
| `sugarsG`       | g/100g    | Sugars subset of carbs   |
| `fiberG`        | g/100g    | Dietary fibre            |
| `proteinG`      | g/100g    | Protein                  |
| `saltG`         | g/100g    | Salt (sodium equivalent) |

The blank state is defined at `convex/ingredientProfiles.ts:30-41` — all fields default to `null`.

### 2.3 Field Name Mapping: ingredientProfiles vs. Proposed Registry Fields

| ingredientProfiles field | Proposed registry field | Notes                                           |
| ------------------------ | ----------------------- | ----------------------------------------------- |
| `kcal`                   | `caloriesPer100g`       | Rename: "kcal" → "calories" for readability     |
| `proteinG`               | `proteinPer100g`        | Drop "G" suffix; "per100g" is in the name       |
| `carbsG`                 | `carbsPer100g`          | Same pattern                                    |
| `fatG`                   | `fatPer100g`            | Same pattern                                    |
| `sugarsG`                | `sugarsPer100g`         | Same pattern                                    |
| `fiberG`                 | `fibrePer100g`          | Spelling: US "fiber" vs. UK "fibre" — see below |
| `saturatedFatG`          | _(not proposed)_        | Not needed for nutrition card MVP               |
| `saltG`                  | _(not proposed)_        | Not needed for nutrition card MVP               |

**Fibre/Fiber Spelling Mismatch:**

- `ingredientProfiles` uses US spelling: `fiberG` (schema.ts:130, ingredientProfiles.ts:17)
- The existing `FoodDigestionMetadata` uses mixed: `fiberTotalApproxG`, `fiberInsolubleLevel`, `fiberSolubleLevel` (foodRegistryData.ts:107-109) — all US spelling.
- Proposed field uses UK spelling: `fibrePer100g`.
- **Recommendation:** Use `fibrePer100g` in the registry (the user is UK-based and the app is UK-English). The mapping function between ingredientProfiles and registry data will handle the translation. This is a cosmetic difference, not a data incompatibility.

### 2.4 Relationship Between Registry and ingredientProfiles

The registry (`FOOD_REGISTRY`) is a **static, client-side, non-user-scoped** array of 147 entries. It is the canonical list of trackable foods.

`ingredientProfiles` is a **per-user Convex table**. Each row is scoped by `userId` + `canonicalName`. The `canonicalName` field links back to the registry via `resolveCanonicalFoodName()` (`convex/ingredientProfiles.ts:90`, `shared/foodCanonicalName.ts`).

Key architectural facts:

- `ingredientProfiles` derives `foodGroup` and `foodLine` from the registry at upsert time via `getIngredientProfileProjection()` (ingredientProfiles.ts:94, ingredientProfileProjection.ts:21-23, foodProjection.ts:55-64).
- A user may have ingredientProfile rows for canonicals NOT in the registry (custom/unknown foods).
- Many registry entries will have NO corresponding ingredientProfile rows until users log them and populate nutrition data.
- The `source` field on ingredientProfiles (`"manual"` | `"openfoodfacts"` | `null`) tracks data provenance.

**Coverage gap:** There is no mechanism today to pre-populate ingredientProfiles with reference nutrition data. All nutrition data is user-entered or imported from Open Food Facts on a per-user basis. The proposed static registry extension would provide **baseline reference data** that works even without user-specific ingredientProfile rows.

---

## 3. Seeding Strategy

### 3.1 Transitional Architecture: FOOD_PORTION_DATA Map

Rather than populating all 147 entries at once in `foodRegistryData.ts`, use a **separate static map** that can be incrementally populated and merged at runtime.

```typescript
// shared/foodPortionData.ts

export interface PortionData {
  /** Default portion weight in grams */
  defaultPortionG: number;
  /** Natural counting unit (e.g. "egg", "slice") — omit for amorphous foods */
  naturalUnit?: string;
  /** Weight of one natural unit in grams */
  unitWeightG?: number;
  /** Kilocalories per 100g */
  caloriesPer100g?: number;
  /** Protein grams per 100g */
  proteinPer100g?: number;
  /** Carbohydrate grams per 100g */
  carbsPer100g?: number;
  /** Fat grams per 100g */
  fatPer100g?: number;
  /** Sugars grams per 100g */
  sugarsPer100g?: number;
  /** Dietary fibre grams per 100g */
  fibrePer100g?: number;
  /** Data provenance */
  source: "ingredientProfiles" | "usda" | "openfoodfacts" | "estimated";
}

/**
 * Static portion + nutrition reference data.
 * Keyed by canonical food name (must match FOOD_REGISTRY canonical exactly).
 *
 * Population priority:
 * 1. Pull verified data from ingredientProfiles where source != null
 * 2. Fill gaps with USDA FoodData Central (SR Legacy or Foundation)
 * 3. Fill remaining gaps with Open Food Facts
 * 4. Flag anything still missing as "needs population"
 */
export const FOOD_PORTION_DATA: ReadonlyMap<string, PortionData> = new Map([
  // --- Zone 1A examples (populated from USDA FDC) ---
  [
    "clear broth",
    {
      defaultPortionG: 240,
      caloriesPer100g: 7,
      proteinPer100g: 1.0,
      carbsPer100g: 0.3,
      fatPer100g: 0.1,
      sugarsPer100g: 0.2,
      fibrePer100g: 0,
      source: "usda",
    },
  ],
  // ... 146 more entries to populate ...
]);
```

### 3.2 Population Pipeline

**Step 1: Extract from ingredientProfiles (Convex query)**

- Query all `ingredientProfiles` rows where `nutritionPer100g.kcal IS NOT null`.
- Group by `canonicalName`, deduplicate (take most recent `updatedAt`).
- Map field names: `kcal` -> `caloriesPer100g`, `fiberG` -> `fibrePer100g`, etc.
- Mark `source: "ingredientProfiles"`.

**Step 2: Flag gaps**

- Cross-reference the 147 FOOD_REGISTRY canonicals against Step 1 results.
- Any canonical without data is flagged "needs population".

**Step 3: Fill from USDA FoodData Central**

- Use USDA FoodData Central API (https://fdc.nal.usda.gov/api-guide.html).
- Prefer "SR Legacy" dataset for whole/raw foods, "Foundation" for detailed nutrient profiles.
- Map USDA nutrients: Energy (kcal, nutrient ID 1008), Protein (1003), Carbohydrate (1005), Total Fat (1004), Sugars (2000), Fiber (1079).
- Portion data: use USDA `foodPortions` endpoint for `gramWeight` of standard measures.

**Step 4: Fill remaining from Open Food Facts**

- Use Open Food Facts API (https://world.openfoodfacts.org/api/v2/).
- Already partially integrated: `ingredientProfiles.source` supports `"openfoodfacts"`.
- Fields map: `energy_kcal_100g`, `proteins_100g`, `carbohydrates_100g`, `fat_100g`, `sugars_100g`, `fiber_100g`.

**Step 5: Estimated fallbacks**

- For composite/abstract entries (e.g. "fast food burger", "deep fried food", "refined confectionery") use `source: "estimated"` with conservative ranges.
- These should be flagged in the UI as approximate.

### 3.3 Entry Classification

Of the 147 registry entries, expected coverage tiers:

| Tier                   | Count (est.) | Description                                                                     | Source                    |
| ---------------------- | ------------ | ------------------------------------------------------------------------------- | ------------------------- |
| A: Exact match in USDA | ~80-90       | Single-ingredient whole foods (banana, egg, rice, chicken)                      | USDA FDC                  |
| B: Close USDA match    | ~20-30       | Prepared foods with a reasonable USDA proxy (toast, smooth soup)                | USDA FDC + manual portion |
| C: Open Food Facts     | ~10-15       | Branded/processed items (protein drink, sweet biscuit)                          | OFF API                   |
| D: Composite/estimated | ~15-20       | Multi-ingredient dishes (chili con carne, fish pie, stir fry)                   | Estimated averages        |
| E: No meaningful data  | ~5-10        | Abstract categories (deep fried food, refined confectionery, seasoning entries) | Mark as unavailable       |

### 3.4 Portion Defaults — Design Principles

- `defaultPortionG` should represent a **realistic single serving**, not a package size.
- For Zone 1A liquids: use 240 mL (≈ 240g for water-based liquids).
- For Zone 1B soft solids: use typical clinical diet portions (e.g. 150g for porridge, 120g for banana).
- For Zone 2/3: use standard UK portion sizes from the British Nutrition Foundation.
- `naturalUnit` should only be set for foods with a clear, universally-understood counting unit.

---

## 4. Utility Function Signatures

All utility functions live in a new file: `shared/foodPortionUtils.ts`.

```typescript
// shared/foodPortionUtils.ts

import type { PortionData } from "./foodPortionData";
import { FOOD_PORTION_DATA } from "./foodPortionData";

/**
 * Get portion + nutrition reference data for a canonical food.
 * Returns undefined if no data has been seeded for this food.
 *
 * @param canonical - Exact canonical name (must match FOOD_REGISTRY)
 */
export function getPortionData(canonical: string): PortionData | undefined {
  return FOOD_PORTION_DATA.get(canonical);
}

/**
 * Calculate estimated calories for a given portion weight.
 * Returns 0 if no calorie data exists for this food.
 *
 * @param canonical - Exact canonical name
 * @param portionG - Portion weight in grams
 */
export function calculateCaloriesForPortion(
  canonical: string,
  portionG: number,
): number {
  const data = FOOD_PORTION_DATA.get(canonical);
  if (!data?.caloriesPer100g) return 0;
  return Math.round((data.caloriesPer100g * portionG) / 100);
}

/**
 * Calculate estimated macronutrients for a given portion weight.
 * Any field without source data returns 0.
 *
 * @param canonical - Exact canonical name
 * @param portionG - Portion weight in grams
 */
export function calculateMacrosForPortion(
  canonical: string,
  portionG: number,
): {
  protein: number;
  carbs: number;
  fat: number;
  sugars: number;
  fibre: number;
} {
  const data = FOOD_PORTION_DATA.get(canonical);
  const scale = (per100g: number | undefined) =>
    per100g ? Math.round(((per100g * portionG) / 100) * 10) / 10 : 0;

  return {
    protein: scale(data?.proteinPer100g),
    carbs: scale(data?.carbsPer100g),
    fat: scale(data?.fatPer100g),
    sugars: scale(data?.sugarsPer100g),
    fibre: scale(data?.fibrePer100g),
  };
}

/**
 * Get the default portion weight for a canonical food.
 * Falls back to a global default (150g) if no data exists.
 */
export function getDefaultPortionG(canonical: string): number {
  return FOOD_PORTION_DATA.get(canonical)?.defaultPortionG ?? 150;
}

/**
 * Convert a natural-unit count to grams.
 * Returns undefined if the food has no natural unit defined.
 *
 * @param canonical - Exact canonical name
 * @param count - Number of natural units (e.g. 2 eggs)
 */
export function naturalUnitsToGrams(
  canonical: string,
  count: number,
): number | undefined {
  const data = FOOD_PORTION_DATA.get(canonical);
  if (!data?.naturalUnit || !data?.unitWeightG) return undefined;
  return Math.round(data.unitWeightG * count);
}

/**
 * Maps ingredientProfiles.nutritionPer100g field names to PortionData field names.
 * Used by the seeding pipeline to convert Convex data to static registry format.
 */
export function mapIngredientProfileToPortionData(nutrition: {
  kcal: number | null;
  fatG: number | null;
  saturatedFatG: number | null;
  carbsG: number | null;
  sugarsG: number | null;
  fiberG: number | null;
  proteinG: number | null;
  saltG: number | null;
}): Pick<
  PortionData,
  | "caloriesPer100g"
  | "proteinPer100g"
  | "carbsPer100g"
  | "fatPer100g"
  | "sugarsPer100g"
  | "fibrePer100g"
> {
  return {
    caloriesPer100g: nutrition.kcal ?? undefined,
    proteinPer100g: nutrition.proteinG ?? undefined,
    carbsPer100g: nutrition.carbsG ?? undefined,
    fatPer100g: nutrition.fatG ?? undefined,
    sugarsPer100g: nutrition.sugarsG ?? undefined,
    fibrePer100g: nutrition.fiberG ?? undefined,
  };
}
```

### 4.1 Rounding Strategy

- **Calories:** Rounded to nearest integer (Math.round). Consistent with food label norms.
- **Macros (g):** Rounded to 1 decimal place (Math.round \* 10 / 10). Sufficient precision for tracking.
- **naturalUnitsToGrams:** Rounded to nearest integer (grams).

### 4.2 Edge Cases

| Case                     | Behavior                                                               |
| ------------------------ | ---------------------------------------------------------------------- |
| Unknown canonical        | `getPortionData` returns `undefined`; calorie/macro functions return 0 |
| portionG = 0             | Returns 0 for all calculations (mathematically correct)                |
| Negative portionG        | Returns negative values — caller should validate input                 |
| Missing individual macro | That field returns 0; others still calculate                           |
| Food with no naturalUnit | `naturalUnitsToGrams` returns `undefined`                              |

---

## 5. Assumptions Requiring Validation

### 5.1 Schema Assumptions

1. **`FoodRegistryEntryBase` is the correct extension point.** The type is not exported (only `FoodRegistryEntry` is). Adding fields to `FoodRegistryEntryBase` at `shared/foodRegistryData.ts:116` propagates to the exported union type automatically. **Validate:** Confirm no other code depends on the exact shape of `FoodRegistryEntryBase` being exhaustive.

2. **Optional fields won't break runtime invariant checks.** The `assertFoodRegistryInvariants()` function at `shared/foodRegistryData.ts:4328` validates canonical uniqueness, zone/subzone consistency, and group/line pairings. It does NOT iterate over arbitrary keys, so adding optional fields is safe. **Validate:** Re-run `bun run typecheck` after changes.

3. **The 147 entry count is stable.** The registry count was 147 at analysis time. New entries should not break the portion data map — unmatched keys are simply ignored by the `Map.get()` lookup.

### 5.2 Data Assumptions

4. **ingredientProfiles may have ZERO populated nutrition rows.** The table is per-user and nutrition data is manually entered. There may be no rows with non-null `kcal` values in production. **Validate:** Query Convex dashboard to count rows where `nutritionPer100g.kcal IS NOT NULL`.

5. **"Per 100g" means cooked/prepared weight for cooked foods.** This is the USDA and Open Food Facts convention for ready-to-eat items. Raw weights would inflate calorie density for foods that absorb water (rice, pasta). **Validate:** Confirm this aligns with user mental model.

6. **UK spelling "fibre" is preferred.** The codebase uses US spelling internally (`fiberG`, `fiberTotalApproxG`) but the product targets a UK user. **Validate:** Confirm whether the UI-facing field name should be UK ("fibre") or consistent with codebase ("fiber").

### 5.3 Architecture Assumptions

7. **A separate `FOOD_PORTION_DATA` map is acceptable.** This avoids modifying all 147 registry entries in one PR. The map could eventually be folded into `FoodRegistryEntryBase` entries once fully populated. **Validate:** Confirm with other agents whether inline vs. separate map is preferred.

8. **`saturatedFatG` and `saltG` are NOT needed for the nutrition card MVP.** The proposed interface omits these two fields from the registry extension, even though `ingredientProfiles` tracks them. **Validate:** Confirm the nutrition card design does not display saturated fat or salt.

9. **No per-user override of portion defaults is needed at this layer.** The static `FOOD_PORTION_DATA` provides baseline defaults. If a user customizes their typical portion size, that should be stored in `ingredientProfiles` or a new `userPortionPreferences` field — not in the static registry. **Validate:** Confirm this separation of concerns with the product design.

10. **The `source` field on `PortionData` is for audit provenance only.** It does not affect calculation logic. It would be displayed in a "data source" tooltip on the nutrition card. **Validate:** Confirm UI design includes a provenance indicator.

### 5.4 Cross-Agent Validation Points

11. **Field naming convention:** Other agents may propose different names (e.g. `kcalPer100g` instead of `caloriesPer100g`, `fiberPer100g` instead of `fibrePer100g`). Need consensus.

12. **Global fallback default (150g):** The `getDefaultPortionG` function falls back to 150g. This may be too large for seasoning entries (herbs, spices, sauces) and too small for liquids. Other agents may propose category-aware defaults.

13. **Rounding precision:** One decimal for macros, integers for calories. Other agents may propose different precision.

---

## Appendix: File Reference Index

| File                                    | Key Lines            | Purpose                                         |
| --------------------------------------- | -------------------- | ----------------------------------------------- |
| `shared/foodRegistryData.ts`            | 116-139              | `FoodRegistryEntryBase` interface               |
| `shared/foodRegistryData.ts`            | 141-146              | `FoodRegistryEntry` discriminated union         |
| `shared/foodRegistryData.ts`            | 152, 394, 1156, 2569 | Zone array definitions                          |
| `shared/foodRegistryData.ts`            | 4314-4322            | `BASE_FOOD_REGISTRY` + `FOOD_REGISTRY` assembly |
| `shared/foodRegistryData.ts`            | 4328-4380            | Invariant assertion function                    |
| `shared/foodRegistryUtils.ts`           | 29-31                | `FOOD_ENTRY_MAP` O(1) lookup                    |
| `shared/foodRegistryUtils.ts`           | 76-78                | `getFoodEntry()`                                |
| `shared/foodRegistry.ts`                | 1-43                 | Barrel re-exports                               |
| `shared/foodProjection.ts`              | 55-64                | `getCanonicalFoodProjection()`                  |
| `convex/schema.ts`                      | 113-138              | `ingredientProfiles` table definition           |
| `convex/schema.ts`                      | 124-133              | `nutritionPer100g` object shape                 |
| `convex/ingredientProfiles.ts`          | 11-19                | `nutritionPatchValidator`                       |
| `convex/ingredientProfiles.ts`          | 30-41                | `blankNutrition()` default                      |
| `convex/ingredientProfiles.ts`          | 74-194               | `upsert` mutation                               |
| `convex/ingredientProfileProjection.ts` | 21-23                | Registry-to-profile projection                  |
