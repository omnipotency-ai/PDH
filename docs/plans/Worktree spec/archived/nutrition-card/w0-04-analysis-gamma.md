# W0-04 Analysis: Portion Data Schema Design (Agent Gamma)

## 1. Current State Audit

### 1.1 FOOD_REGISTRY Shape & Size

**File:** `shared/foodRegistryData.ts`

The registry contains **148 canonical entries** distributed across zones:

| Zone                          | Count                               |
| ----------------------------- | ----------------------------------- |
| 1A (clear/full liquids)       | 9                                   |
| 1B (soft, low-residue solids) | 29                                  |
| 2 (expanded defensive diet)   | 59                                  |
| 3 (experimental)              | 50                                  |
| **Total**                     | **147** (+ 1 enrichment-only match) |

Each entry is typed as `FoodRegistryEntry`, which is a discriminated union over `FoodGroup` (see `foodRegistryData.ts:141-146`). The base interface is `FoodRegistryEntryBase` (`foodRegistryData.ts:116-139`), extending `FoodDigestionMetadata` (`foodRegistryData.ts:103-114`).

**Current FoodRegistryEntryBase fields** (`foodRegistryData.ts:116-139`):

- `canonical: string`
- `zone: FoodZone`
- `subzone?: FoodSubzone`
- `category: FoodCategory`
- `subcategory: FoodSubcategory`
- `macros: ReadonlyArray<"protein" | "carbohydrate" | "fat">`
- `examples: ReadonlyArray<string>`
- `group: FoodGroup`
- `line: FoodLine`
- `lineOrder: number`
- `notes?: string`
- Plus all `FoodDigestionMetadata` fields (10 optional fields)

**Critically, there are NO portion or nutrition fields on `FoodRegistryEntryBase` today.**

### 1.2 ingredientProfiles Table Schema

**File:** `convex/schema.ts:113-138`

The `ingredientProfiles` table is a **per-user** table (keyed on `userId + canonicalName`) with the following fields:

| Field              | Type                                  | Notes                       |
| ------------------ | ------------------------------------- | --------------------------- |
| `userId`           | `string`                              | Owner                       |
| `canonicalName`    | `string`                              | Links to registry canonical |
| `displayName`      | `string`                              | User-facing label           |
| `tags`             | `string[]`                            | User tags                   |
| `foodGroup`        | `FoodGroup \| null`                   | Projected from registry     |
| `foodLine`         | `FoodLine \| null`                    | Projected from registry     |
| `lowResidue`       | `boolean \| null`                     | Manual flag                 |
| `source`           | `"manual" \| "openfoodfacts" \| null` | Data origin                 |
| `externalId`       | `string \| null`                      | OFF barcode etc.            |
| `ingredientsText`  | `string \| null`                      | Raw ingredient list         |
| `nutritionPer100g` | `object` (see below)                  | Macronutrient data          |
| `createdAt`        | `number`                              | Epoch ms                    |
| `updatedAt`        | `number`                              | Epoch ms                    |

**`nutritionPer100g` sub-object** (`convex/schema.ts:124-133`):

| Field           | Type             |
| --------------- | ---------------- |
| `kcal`          | `number \| null` |
| `fatG`          | `number \| null` |
| `saturatedFatG` | `number \| null` |
| `carbsG`        | `number \| null` |
| `sugarsG`       | `number \| null` |
| `fiberG`        | `number \| null` |
| `proteinG`      | `number \| null` |
| `saltG`         | `number \| null` |

Indexes: `by_userId`, `by_userId_canonicalName` (`convex/schema.ts:137-138`).

### 1.3 ingredientProfiles Mutation Patterns

**File:** `convex/ingredientProfiles.ts`

The `upsert` mutation (`ingredientProfiles.ts:74-193`) accepts partial `nutritionPer100g` patches via `nutritionPatchValidator` (`ingredientProfiles.ts:11-20`) and merges them onto existing values. The `blankNutrition()` helper (`ingredientProfiles.ts:30-41`) initializes all 8 fields to `null`.

Key observation: `foodGroup` and `foodLine` are projected from the registry via `getIngredientProfileProjection` (`ingredientProfileProjection.ts:21-23`), which delegates to `getCanonicalFoodProjection` in `shared/foodProjection.ts`. This means the registry is already the authoritative source for food metadata that gets copied into per-user profiles.

---

## 2. Proposed TypeScript Interfaces

### 2.1 New Portion & Nutrition Fields on FoodRegistryEntryBase

These fields are **all optional** to avoid breaking the 148 existing entries. They extend the static registry with reference nutrition data that does NOT depend on per-user ingredientProfiles.

```typescript
// Proposed extension to FoodRegistryEntryBase in shared/foodRegistryData.ts

/**
 * Portion sizing metadata for a canonical food.
 * All fields optional — absence means "no reference data available."
 */
interface FoodPortionData {
  /** Default portion weight in grams (e.g., 1 medium banana = 118g). */
  defaultPortionG?: number;
  /**
   * Natural unit label for display (e.g., "1 medium", "1 slice", "1 cup").
   * Used in UI as the default portion descriptor.
   */
  naturalUnit?: string;
  /**
   * Weight in grams of one natural unit. When present,
   * `naturalUnit` MUST also be present.
   * Example: banana naturalUnit="1 medium", unitWeightG=118.
   */
  unitWeightG?: number;
}

/**
 * Reference macronutrient values per 100g of the food.
 * Sourced from USDA FoodData Central, Open Food Facts, or
 * ingredientProfiles (user-entered). NOT hallucinated.
 */
interface FoodNutritionPer100g {
  caloriesPer100g?: number;
  proteinPer100g?: number;
  carbsPer100g?: number;
  fatPer100g?: number;
  sugarsPer100g?: number;
  fibrePer100g?: number;
}

/**
 * Combined portion + nutrition data for a food registry entry.
 */
type FoodPortionAndNutrition = FoodPortionData & FoodNutritionPer100g;
```

The extended `FoodRegistryEntryBase` becomes:

```typescript
interface FoodRegistryEntryBase
  extends FoodDigestionMetadata, FoodPortionData, FoodNutritionPer100g {
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

### 2.2 Field Name Mismatch Analysis: ingredientProfiles vs Proposed Fields

| ingredientProfiles.nutritionPer100g | Proposed registry field | Mismatch?                                   | Resolution                                                                                                                                       |
| ----------------------------------- | ----------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `kcal`                              | `caloriesPer100g`       | **YES** — name differs                      | Mapping function required. `kcal` is the DB field; `caloriesPer100g` is the display/calculation field. They represent the same value.            |
| `proteinG`                          | `proteinPer100g`        | **YES** — suffix differs (`G` vs `Per100g`) | Both are "grams per 100g." DB uses shorter suffix. Mapping function required.                                                                    |
| `carbsG`                            | `carbsPer100g`          | **YES** — suffix differs                    | Same resolution.                                                                                                                                 |
| `fatG`                              | `fatPer100g`            | **YES** — suffix differs                    | Same resolution.                                                                                                                                 |
| `sugarsG`                           | `sugarsPer100g`         | **YES** — suffix differs                    | Same resolution.                                                                                                                                 |
| `fiberG`                            | `fibrePer100g`          | **YES** — name AND spelling                 | `fiber` (US) vs `fibre` (UK). The app uses UK English (see `CLAUDE.md` product context). DB uses US spelling. Mapping function must handle this. |
| `saturatedFatG`                     | (not proposed)          | N/A                                         | Not needed for nutrition card MVP. Can add later.                                                                                                |
| `saltG`                             | (not proposed)          | N/A                                         | Not needed for nutrition card MVP. Can add later.                                                                                                |

**Critical finding:** Every field name differs between the DB schema and the proposed registry fields. A `mapIngredientProfileToNutrition` adapter function is essential.

### 2.3 Alternative: Keep DB Field Names Everywhere

An alternative design would use the DB field names (`kcal`, `proteinG`, etc.) on the registry as well, avoiding the mismatch entirely. However, this sacrifices clarity — `proteinG` on its own does not communicate "per 100g" to a reader. The explicit `Per100g` suffix is self-documenting and matches USDA/OFF conventions.

**Recommendation:** Keep the proposed `Per100g` suffix names for the client-side registry and provide a single mapping function.

---

## 3. Seeding Strategy

### 3.1 Data Sources (Priority Order)

1. **ingredientProfiles table** — Pull any non-null `nutritionPer100g` rows from Convex. These are user-entered or Open Food Facts-sourced values that already exist in production. This is the primary seed source.
2. **USDA FoodData Central (FDC)** — For gaps in generic whole foods (chicken breast, white rice, banana, etc.). Use the FDC API `foods/search` endpoint with the canonical name. SR Legacy or Foundation datasets are preferred for single-ingredient items.
3. **Open Food Facts** — For processed/packaged items (sweet biscuit, refined confectionery, etc.) where USDA has no direct match. The `source: "openfoodfacts"` field on ingredientProfiles already supports this.

### 3.2 Coverage Assessment

Of 148 registry entries, many are beverages (water, tea, electrolyte drink) or preparations (boiled, grilled) of the same base ingredient. Realistic nutrition data availability:

| Category                                                      | Estimated count | Ease of population                                   |
| ------------------------------------------------------------- | --------------- | ---------------------------------------------------- |
| Single-ingredient whole foods (banana, egg, rice)             | ~60             | High — direct USDA FDC match                         |
| Preparations of whole foods (boiled fish, grilled white meat) | ~40             | Medium — USDA has cooked variants                    |
| Beverages (water, tea, broth)                                 | ~15             | High — well-known or zero-calorie                    |
| Composite/processed (sweet biscuit, pizza)                    | ~15             | Low — highly variable, use OFF averages              |
| Seasonings/condiments (salt, soy sauce, garlic)               | ~18             | Medium — small portions make nutrition less relevant |

**Entries flagged "needs population":** Any entry where neither ingredientProfiles nor USDA/OFF provides data. These should be flagged at build time and tracked in a coverage report.

### 3.3 Static FOOD_PORTION_DATA Map

Rather than embedding portion data directly into the 4000+ line `foodRegistryData.ts`, create a separate static map file:

```typescript
// shared/foodPortionData.ts

import type { FoodPortionAndNutrition } from "./foodRegistryData";

/**
 * Static portion + nutrition reference data for canonical foods.
 * Key = canonical name (must match FOOD_REGISTRY entry).
 *
 * Source annotations:
 *   usda:XXXXXX  — USDA FoodData Central FDC ID
 *   off:XXXXXXXX — Open Food Facts barcode
 *   ip           — Pulled from ingredientProfiles (user-verified)
 *   estimate     — Reasonable estimate, needs verification
 *
 * Values are per 100g unless noted.
 */
export const FOOD_PORTION_DATA: ReadonlyMap<string, FoodPortionAndNutrition> =
  new Map([
    // Example entries (DO NOT ship hallucinated values — seed from real sources)
    [
      "ripe banana",
      {
        defaultPortionG: 118,
        naturalUnit: "1 medium",
        unitWeightG: 118,
        caloriesPer100g: 89,
        proteinPer100g: 1.1,
        carbsPer100g: 22.8,
        fatPer100g: 0.3,
        sugarsPer100g: 12.2,
        fibrePer100g: 2.6,
        // source: usda:173944
      },
    ],
    [
      "egg",
      {
        defaultPortionG: 50,
        naturalUnit: "1 large",
        unitWeightG: 50,
        caloriesPer100g: 155,
        proteinPer100g: 13.0,
        carbsPer100g: 1.1,
        fatPer100g: 11.0,
        sugarsPer100g: 1.1,
        fibrePer100g: 0,
        // source: usda:171287
      },
    ],
    // ... remaining entries seeded from ingredientProfiles + USDA/OFF
  ]);
```

### 3.4 Seeding Script Design

```
1. Query ingredientProfiles for all rows where nutritionPer100g has at least one non-null field.
2. For each, map to FOOD_PORTION_DATA shape using the adapter function.
3. For remaining canonicals with no ingredientProfile data, generate a "needs-population.csv" listing:
   - canonical name, zone, category, suggested USDA search term
4. Manually verify USDA/OFF matches before committing to the static map.
5. Never commit hallucinated or AI-generated nutrition values.
```

---

## 4. Utility Function Signatures

All functions live in `shared/foodPortionUtils.ts` (new file), following the existing pattern of `shared/foodRegistryUtils.ts`.

```typescript
// shared/foodPortionUtils.ts

import type { FoodPortionAndNutrition } from "./foodRegistryData";
import { FOOD_PORTION_DATA } from "./foodPortionData";

/**
 * Macronutrient breakdown for a given portion weight.
 * All values in grams except calories (kcal).
 */
export interface MacroBreakdown {
  protein: number;
  carbs: number;
  fat: number;
  sugars: number;
  fibre: number;
}

/**
 * Look up static portion + nutrition data for a canonical food.
 * Returns undefined if no data is available for this canonical.
 *
 * O(1) — backed by a Map.
 */
export function getPortionData(
  canonical: string,
): FoodPortionAndNutrition | undefined {
  return FOOD_PORTION_DATA.get(canonical);
}

/**
 * Calculate estimated calories for a specific portion weight.
 * Returns 0 if no calorie data exists for this canonical.
 *
 * Formula: (caloriesPer100g / 100) * portionG
 */
export function calculateCaloriesForPortion(
  canonical: string,
  portionG: number,
): number {
  const data = FOOD_PORTION_DATA.get(canonical);
  if (!data?.caloriesPer100g) return 0;
  return (data.caloriesPer100g / 100) * portionG;
}

/**
 * Calculate macronutrient breakdown for a specific portion weight.
 * Returns all zeros if no nutrition data exists for this canonical.
 *
 * All returned values are in grams (except calories which is excluded —
 * use calculateCaloriesForPortion for that).
 */
export function calculateMacrosForPortion(
  canonical: string,
  portionG: number,
): MacroBreakdown {
  const data = FOOD_PORTION_DATA.get(canonical);
  if (!data) {
    return { protein: 0, carbs: 0, fat: 0, sugars: 0, fibre: 0 };
  }
  const scale = portionG / 100;
  return {
    protein: (data.proteinPer100g ?? 0) * scale,
    carbs: (data.carbsPer100g ?? 0) * scale,
    fat: (data.fatPer100g ?? 0) * scale,
    sugars: (data.sugarsPer100g ?? 0) * scale,
    fibre: (data.fibrePer100g ?? 0) * scale,
  };
}

/**
 * Adapter: Convert ingredientProfiles.nutritionPer100g DB shape
 * to the client-side FoodNutritionPer100g shape.
 *
 * Handles the field name mismatches documented in section 2.2:
 *   kcal       -> caloriesPer100g
 *   proteinG   -> proteinPer100g
 *   carbsG     -> carbsPer100g
 *   fatG       -> fatPer100g
 *   sugarsG    -> sugarsPer100g
 *   fiberG     -> fibrePer100g  (US -> UK spelling)
 */
export function mapIngredientProfileNutrition(dbNutrition: {
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  sugarsG: number | null;
  fiberG: number | null;
  saturatedFatG?: number | null;
  saltG?: number | null;
}): Partial<FoodPortionAndNutrition> {
  return {
    ...(dbNutrition.kcal != null && { caloriesPer100g: dbNutrition.kcal }),
    ...(dbNutrition.proteinG != null && {
      proteinPer100g: dbNutrition.proteinG,
    }),
    ...(dbNutrition.carbsG != null && { carbsPer100g: dbNutrition.carbsG }),
    ...(dbNutrition.fatG != null && { fatPer100g: dbNutrition.fatG }),
    ...(dbNutrition.sugarsG != null && {
      sugarsPer100g: dbNutrition.sugarsG,
    }),
    ...(dbNutrition.fiberG != null && { fibrePer100g: dbNutrition.fiberG }),
  };
}
```

---

## 5. Relationship Between Registry and ingredientProfiles

The relationship is **one (registry) to many (ingredientProfiles)**:

- Each `FoodRegistryEntry` defines a canonical food with static metadata (zone, group, line, digestion profile).
- Each `ingredientProfiles` row is **per-user** and stores that user's nutrition data for a canonical food.
- The `canonicalName` field in ingredientProfiles is the join key to the registry.
- `foodGroup` and `foodLine` on ingredientProfiles are **projections** copied from the registry at write time (`convex/ingredientProfiles.ts:94`, `convex/ingredientProfileProjection.ts:21-23`).

**Design implication for the nutrition card:** The card needs BOTH:

1. **Static reference data** (from `FOOD_PORTION_DATA`) — generic nutrition values for display before the user has entered anything.
2. **Per-user data** (from `ingredientProfiles`) — user-specific overrides, e.g., a specific brand's macros scanned from Open Food Facts.

The utility functions in section 4 serve the static path. A separate hook (`useIngredientProfile(canonical)`) would serve the per-user path, with the static data as fallback.

---

## 6. Assumptions Requiring Validation

### A1. Separate file for portion data vs inline on registry entries

**Assumption:** Portion/nutrition data lives in a separate `FOOD_PORTION_DATA` map rather than being added directly to `FoodRegistryEntryBase` fields on each entry in `foodRegistryData.ts`.
**Rationale:** `foodRegistryData.ts` is already ~4400 lines. Adding 6-8 fields to each of 148 entries would add ~1000 lines of numeric data, diluting readability.
**Risk:** Other agents may propose inlining. Cross-validate.

### A2. Per-100g normalization for all nutrition fields

**Assumption:** All nutrition values are stored per 100g, and portion-specific values are calculated at runtime.
**Rationale:** This matches ingredientProfiles (`nutritionPer100g`) and all major food databases (USDA, OFF).
**Risk:** Low. This is the universal standard.

### A3. UK English for field names (`fibre` not `fiber`)

**Assumption:** The new client-side fields use `fibrePer100g` (UK English), while the existing DB field is `fiberG` (US English).
**Rationale:** `CLAUDE.md` describes a UK-based user; existing code mixed. The adapter function handles the translation.
**Risk:** Other agents may choose US spelling for consistency with the DB. Cross-validate.

### A4. `saturatedFatG` and `saltG` excluded from MVP

**Assumption:** The nutrition card MVP shows only 6 macros (calories, protein, carbs, fat, sugars, fibre). Saturated fat and salt are in ingredientProfiles but not surfaced yet.
**Rationale:** Reduces UI complexity for the initial card. Can be added later without schema changes.
**Risk:** Low. These fields remain in the DB and can be mapped when needed.

### A5. Static data takes priority over per-user data for generic foods

**Assumption:** For the nutrition card, if both static reference data and a user's ingredientProfile exist, the **per-user data takes priority** (it may reflect a specific brand or preparation).
**Rationale:** User-entered data is more specific and trustworthy for their context.
**Risk:** Need to confirm this matches the product intent. The user may want to see "reference" values alongside their custom values.

### A6. No new Convex tables required

**Assumption:** Portion data is static and client-side only (no new Convex table). User-specific overrides continue to use `ingredientProfiles`.
**Rationale:** Per `CLAUDE.md` and project memory: "extend existing tables, recipes = foodLibrary composites" and "no new tables."
**Risk:** If portion data needs to be user-editable at scale, a new table might eventually be needed. But for MVP, the static map + existing ingredientProfiles is sufficient.

### A7. defaultPortionG semantics

**Assumption:** `defaultPortionG` represents a "typical serving" for UI defaults (pre-filling the portion input). It is NOT the "reference amount" used for nutrition calculations (that is always explicit via `portionG` parameter).
**Rationale:** Prevents silent errors where calculations accidentally use the default instead of the user's actual portion.
**Risk:** Low, but the function signatures must be clear that `portionG` is always caller-supplied.

### A8. Return 0 (not undefined/NaN) for missing nutrition data

**Assumption:** `calculateCaloriesForPortion` returns `0` and `calculateMacrosForPortion` returns all-zeros when data is missing, rather than `undefined` or `NaN`.
**Rationale:** Simplifies UI rendering — a missing value displays as "0" or "no data" rather than requiring null checks everywhere.
**Risk:** Could be misleading if "0 calories" is displayed for a food where we genuinely lack data. The UI should distinguish "0 because we know" from "0 because unknown." A `hasNutritionData(canonical)` guard function may be needed.

---

## 7. File References Summary

| Reference                             | Path                                    | Lines     |
| ------------------------------------- | --------------------------------------- | --------- |
| FoodRegistryEntryBase interface       | `shared/foodRegistryData.ts`            | 116-139   |
| FoodRegistryEntry discriminated union | `shared/foodRegistryData.ts`            | 141-146   |
| FoodDigestionMetadata interface       | `shared/foodRegistryData.ts`            | 103-114   |
| FOOD_REGISTRY export                  | `shared/foodRegistryData.ts`            | 4321-4322 |
| Registry invariant checker            | `shared/foodRegistryData.ts`            | 4328-4369 |
| getFoodEntry utility                  | `shared/foodRegistryUtils.ts`           | 76-78     |
| FOOD_ENTRY_MAP (O(1) lookup)          | `shared/foodRegistryUtils.ts`           | 29-31     |
| ingredientProfiles schema             | `convex/schema.ts`                      | 113-138   |
| nutritionPer100g sub-object           | `convex/schema.ts`                      | 124-133   |
| nutritionPatchValidator               | `convex/ingredientProfiles.ts`          | 11-20     |
| blankNutrition() helper               | `convex/ingredientProfiles.ts`          | 30-41     |
| upsert mutation                       | `convex/ingredientProfiles.ts`          | 74-193    |
| getIngredientProfileProjection        | `convex/ingredientProfileProjection.ts` | 21-23     |
| barrel re-export                      | `shared/foodRegistry.ts`                | 1-44      |
