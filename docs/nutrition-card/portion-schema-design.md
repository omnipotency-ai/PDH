# Portion Schema Design -- Cross-Validated Specification

**Date:** 2026-04-03
**Source:** Cross-validation of w0-04-analysis-alpha.md, w0-04-analysis-beta.md, w0-04-analysis-gamma.md
**Status:** Definitive -- all contradictions resolved with code evidence

---

## 1. Consensus Findings

All three agents agree on the following. Each claim is verified against source code.

### 1.1 Registry has ZERO portion or nutrition fields today

`FoodRegistryEntryBase` (`shared/foodRegistryData.ts:116-139`) contains only: `canonical`, `zone`, `subzone?`, `category`, `subcategory`, `macros`, `examples`, `group`, `line`, `lineOrder`, `notes?`, plus the 10 optional `FoodDigestionMetadata` fields inherited via `extends FoodDigestionMetadata` (`shared/foodRegistryData.ts:103-114`). No `defaultPortionG`, no `caloriesPer100g`, nothing nutrition-related.

### 1.2 ingredientProfiles is per-user, starts empty

The `ingredientProfiles` table (`convex/schema.ts:113-138`) is scoped by `userId` + `canonicalName`. The `blankNutrition()` helper (`convex/ingredientProfiles.ts:30-41`) initializes all 8 nutrition fields to `null`. There is no global seed mechanism. Every user starts with zero nutrition data. This means **ZERO registry entries have global static nutrition data today**.

### 1.3 nutritionPer100g has 8 nullable fields

Verified at `convex/schema.ts:124-133`:

| Field           | Type             | Line |
| --------------- | ---------------- | ---- |
| `kcal`          | `number \| null` | 125  |
| `fatG`          | `number \| null` | 126  |
| `saturatedFatG` | `number \| null` | 127  |
| `carbsG`        | `number \| null` | 128  |
| `sugarsG`       | `number \| null` | 129  |
| `fiberG`        | `number \| null` | 130  |
| `proteinG`      | `number \| null` | 131  |
| `saltG`         | `number \| null` | 132  |

### 1.4 Separate FOOD_PORTION_DATA map is the right approach

All three agents recommend a separate `shared/foodPortionData.ts` file over inlining into `FoodRegistryEntryBase`. Verified reasons:

- `foodRegistryData.ts` is already 4382 lines. Adding 9 numeric fields to 147 entries would add ~1300 lines.
- Only 2 files import directly from `foodRegistryData.ts`: `shared/foodRegistryUtils.ts:15-16` and the barrel `shared/foodRegistry.ts:23-25`. All other consumers (18 files) import through the barrel. A separate map avoids touching any existing import chains.
- Different population cadence: registry entries are stable food identity; nutrition data will be populated incrementally.

### 1.5 Every DB field name differs from proposed client field names

All three agents document the same 6 field name mismatches. A mapping adapter function is required.

### 1.6 saturatedFatG and saltG excluded from MVP

The locked decision doc (`project_nutrition_card_decisions.md`, decision #22) states: "5 values (protein, carbs, fat, sugars, fibre) -- kcal shown separately above." The implementation plan (`docs/plans/nutrition-card-implementation-plan.json:612`) confirms: "5-macro totals (protein/carbs/fat/sugars/fibre)". Saturated fat and salt are in the DB schema but not surfaced in the nutrition card MVP.

### 1.7 Per-user data takes priority over static reference data at runtime

All agents agree: if `ingredientProfiles` has non-null nutrition for a food, use it. Fall back to `FOOD_PORTION_DATA` static reference data when the user has not populated their own values.

---

## 2. Resolved Contradictions

### 2.1 Registry entry count: 147 (not 148)

**Alpha:** 147. **Beta:** 147. **Gamma:** "148 canonical entries" (section 1.1 header), then "147 (+ 1 enrichment-only match)" in the zone table, then uses "148" elsewhere.

**Resolution:** Programmatic count confirms **147 entries**.

```
Zone 1A: 9, Zone 1B: 29, Zone 2: 59, Zone 3: 50 = Total: 147
```

Evidence: `npx tsx -e "import { FOOD_REGISTRY } from './shared/foodRegistryData'; console.log(FOOD_REGISTRY.length);"` outputs `147`. The `BASE_FOOD_REGISTRY` array at `shared/foodRegistryData.ts:4314-4318` spreads all 4 zone arrays. The `applyFoodEntryEnrichment` function at line 4322 enriches existing entries but does not add new ones. Gamma's "148" is incorrect; the "+1 enrichment-only match" note suggests Gamma miscounted an enrichment as a separate entry.

**Definitive answer: 147 entries.**

### 2.2 fiber vs fibre: use `fiberPer100g` in code, "fibre" in UI only

**Alpha:** Recommends `fibrePer100g` (UK spelling) in the PortionData interface.
**Beta:** Initially proposes `fibrePer100g`, then revises to `fiberPer100g` for consistency.
**Gamma:** Uses `fibrePer100g`.

**Code evidence:**

- **DB layer** uses US spelling exclusively: `fiberG` (`convex/schema.ts:130`), `fiberTotalApproxG` / `fiberInsolubleLevel` / `fiberSolubleLevel` (`shared/foodRegistryData.ts:106-108`), `high_fiber` (`shared/foodEvidence.ts:349`).
- **UI-facing strings** use UK spelling: `"high-fibre"` (`src/pages/secondary_pages/Menu.tsx:46`), `"fibre content"` (`src/lib/aiAnalysis.ts:1204`), `"fibre"` tag (`src/components/archive/ai-insights/MealIdeaCard.tsx:96`).
- **Convex layer** is 100% US "fiber" -- zero instances of "fibre" in `convex/*.ts`.
- **shared layer** uses US "fiber" for all field/variable names, UK "fibre" only in human-readable `notes` strings.

**Resolution:** The codebase has a clear convention -- US "fiber" for identifiers, UK "fibre" for display text. Beta's revised recommendation is correct.

**Definitive answer: `fiberPer100g` in code. Display as "Fibre" in UI labels.**

### 2.3 PortionData naturalUnit and unitWeightG: optional vs required

**Alpha:** Both `naturalUnit` and `unitWeightG` are optional on PortionData.
**Beta:** Both are required (not optional) on PortionData.
**Gamma:** Both are optional.

**Resolution:** They must be optional. Not all foods have natural counting units (e.g., "white rice", "olive oil", "curry dish" are amorphous/continuous). Making them required would force meaningless values like `naturalUnit: "serving"` for every entry.

**Definitive answer: Both optional. When `naturalUnit` is present, `unitWeightG` must also be present (documented as an invariant, not enforced by types).**

### 2.4 Nutrition fields on PortionData: nullable vs optional-undefined

**Alpha:** Uses `caloriesPer100g?: number` (optional, never null).
**Beta:** Uses `caloriesPer100g: number | null` (required, nullable).
**Gamma:** Uses `caloriesPer100g?: number` (optional, never null).

**Resolution:** Since `FOOD_PORTION_DATA` is a static map where entries are only added when data is known, an entry's presence in the map already signals "we have data for this food." Individual nutrition fields should be optional-undefined (not nullable) because:

- Null semantics belong to the DB layer (`ingredientProfiles.nutritionPer100g` uses `null` for "not yet entered").
- The static map is compiled from verified sources. If we have an entry, we know its calories. If a specific macro is unknown, omit it.
- Simpler consumer code: `data?.caloriesPer100g` vs `data?.caloriesPer100g ?? undefined`.

**Definitive answer: Optional (`?:`), not nullable (`| null`).**

### 2.5 MacroBreakdown return type: null vs 0 for missing data

**Alpha:** Returns `0` for missing macros.
**Beta:** Returns `null` for missing macros.
**Gamma:** Returns `0` for missing macros.

**Resolution:** Return `null` for missing data. Returning `0` conflates "this food has 0g protein" (e.g., olive oil) with "we have no protein data." The UI must distinguish these cases per CLAUDE.md: "AI Transparency -- never present inferred logic as certainty." A `null` return forces the UI to handle the unknown case explicitly.

**Definitive answer: `null` for missing data. `0` only when the source data explicitly says 0.**

### 2.6 Rounding in utility functions

**Alpha:** Rounds calories to integer, macros to 1 decimal.
**Beta:** Rounds calories to integer, macros to 1 decimal.
**Gamma:** No rounding (raw floating point).

**Resolution:** Round. Unrounded floats produce ugly UI values like "13.333333g protein." Alpha and Beta agree on the convention.

**Definitive answer: Calories rounded to nearest integer. Macros rounded to 1 decimal place.**

### 2.7 Source field values

**Alpha:** `"ingredientProfiles" | "usda" | "openfoodfacts" | "estimated"`
**Beta:** `"ingredientProfile" | "usda" | "openfoodfacts" | "estimated"` (singular)
**Gamma:** Uses comments only, no formal source field.

**Resolution:** Use a `source` field with the literal `"ingredientProfile"` (singular, matching the table name convention). Include `"usda"` and `"openfoodfacts"` for external sources and `"estimated"` for conservative approximations.

**Definitive answer: `source: "ingredientProfile" | "usda" | "openfoodfacts" | "estimated"`**

---

## 3. Final TypeScript Interfaces

```typescript
// shared/foodPortionData.ts

/**
 * Static portion and nutrition reference data for a canonical food.
 *
 * Lives in a separate Map (not inlined into FoodRegistryEntryBase) to keep
 * foodRegistryData.ts at its current size and allow independent population.
 *
 * All nutrition values are per 100g of edible portion (cooked weight where
 * relevant), matching the ingredientProfiles.nutritionPer100g convention.
 *
 * Field naming: US English for identifiers (matching existing codebase
 * convention in shared/ and convex/). UK "fibre" used in UI display only.
 */
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
  /** Dietary fiber grams per 100g. Display as "Fibre" in UI. */
  fiberPer100g?: number;

  /** Data provenance for audit and UI transparency. */
  source: "ingredientProfile" | "usda" | "openfoodfacts" | "estimated";
}
```

---

## 4. ingredientProfiles to PortionData Field Mapping

Definitive adapter function. Maps the DB compact names to the client descriptive names.

```typescript
// shared/foodPortionUtils.ts

/**
 * Adapter: Convert ingredientProfiles.nutritionPer100g (DB shape)
 * to the client-side PortionData nutrition fields.
 *
 * DB field          -> Client field        Notes
 * kcal              -> caloriesPer100g     Rename only
 * proteinG          -> proteinPer100g      Drop "G" suffix
 * carbsG            -> carbsPer100g        Drop "G" suffix
 * fatG              -> fatPer100g          Drop "G" suffix
 * sugarsG           -> sugarsPer100g       Drop "G" suffix
 * fiberG            -> fiberPer100g        Drop "G" suffix (US spelling kept)
 * saturatedFatG     -> (not mapped)        Excluded from MVP
 * saltG             -> (not mapped)        Excluded from MVP
 *
 * Source: convex/schema.ts:124-132
 */
export function mapIngredientProfileNutrition(dbNutrition: {
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  sugarsG: number | null;
  fiberG: number | null;
  saturatedFatG: number | null;
  saltG: number | null;
}): Partial<
  Pick<
    PortionData,
    | "caloriesPer100g"
    | "proteinPer100g"
    | "carbsPer100g"
    | "fatPer100g"
    | "sugarsPer100g"
    | "fiberPer100g"
  >
> {
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
    ...(dbNutrition.fiberG != null && { fiberPer100g: dbNutrition.fiberG }),
  };
}
```

---

## 5. Seeding Strategy

### 5.1 Current global nutrition data: ZERO

The `ingredientProfiles` table is per-user. There are no global seed rows, no migration that pre-populates nutrition, and no static nutrition data anywhere in the codebase. Every nutrition value displayed by the nutrition card must come from either:

1. The new `FOOD_PORTION_DATA` static map (this task creates it), or
2. A user's `ingredientProfiles` rows (populated manually or via Open Food Facts import).

### 5.2 Population pipeline

1. **USDA FoodData Central** -- primary source for ~100-120 of 147 entries. Use SR Legacy / Foundation datasets. Map USDA nutrient IDs: Energy (1008), Protein (1003), Carbohydrate (1005), Total Fat (1004), Sugars (2000), Fiber (1079).
2. **Open Food Facts** -- secondary source for branded/processed items (~10-15 entries). Already integrated as a `source` option in `ingredientProfiles` (`convex/schema.ts:121`).
3. **Conservative estimates** -- for composite/ambiguous entries (~15-20). Marked `source: "estimated"`. UI must show a low-confidence indicator.
4. **Unpopulatable** -- entries too generic for meaningful data (~5-10, e.g. "deep fried food", "exotic fruit", "refined confectionery"). These get no entry in the map. UI shows "No nutrition data available."

### 5.3 No hallucinated values

Every numeric value committed to `FOOD_PORTION_DATA` must cite a real source (USDA FDC ID, Open Food Facts barcode, or `ingredientProfiles` row). AI-generated or "looks about right" values are forbidden. This aligns with CLAUDE.md: "AI Transparency -- do not allow AI output to silently override canonical facts."

### 5.4 Portion defaults by zone

| Zone | Guidance                                                          | Example defaultPortionG         |
| ---- | ----------------------------------------------------------------- | ------------------------------- |
| 1A   | Liquids: 240ml (approx 240g for water-based)                      | clear broth: 240, water: 240    |
| 1B   | Clinical diet portions                                            | porridge: 150, ripe banana: 118 |
| 2    | Standard UK portion sizes (British Nutrition Foundation)          | white rice: 180, chicken: 130   |
| 3    | Standard UK portions, but smaller for high-risk experimental food | raw apple: 150, whole grain: 40 |

---

## 6. Utility Function Signatures

All functions in `shared/foodPortionUtils.ts`.

```typescript
import type { PortionData } from "./foodPortionData";
import { FOOD_PORTION_DATA } from "./foodPortionData";

/**
 * Macronutrient breakdown for a given portion weight.
 * null = no data available (distinct from 0 = food has none of this macro).
 */
export interface MacroBreakdown {
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  sugars: number | null;
  fiber: number | null;
}

/**
 * Look up static portion + nutrition data for a canonical food.
 * O(1) via Map. Returns undefined if no data seeded for this food.
 */
export function getPortionData(canonical: string): PortionData | undefined {
  return FOOD_PORTION_DATA.get(canonical);
}

/**
 * Get the default portion weight for a canonical food.
 * Falls back to 150g if no data exists.
 */
export function getDefaultPortionG(canonical: string): number {
  return FOOD_PORTION_DATA.get(canonical)?.defaultPortionG ?? 150;
}

/**
 * Calculate estimated calories for a specific portion weight.
 * Returns null if no calorie data exists for this food.
 *
 * Rounded to nearest integer.
 */
export function calculateCaloriesForPortion(
  canonical: string,
  portionG: number,
): number | null {
  const data = FOOD_PORTION_DATA.get(canonical);
  if (data?.caloriesPer100g == null) return null;
  return Math.round((data.caloriesPer100g * portionG) / 100);
}

/**
 * Calculate macronutrient breakdown for a specific portion weight.
 * Each field is null when source data is missing.
 * Non-null values rounded to 1 decimal place.
 */
export function calculateMacrosForPortion(
  canonical: string,
  portionG: number,
): MacroBreakdown {
  const data = FOOD_PORTION_DATA.get(canonical);
  if (!data) {
    return { protein: null, carbs: null, fat: null, sugars: null, fiber: null };
  }
  const scale = (v: number | undefined) =>
    v != null ? Math.round((v * portionG * 10) / 100) / 10 : null;

  return {
    protein: scale(data.proteinPer100g),
    carbs: scale(data.carbsPer100g),
    fat: scale(data.fatPer100g),
    sugars: scale(data.sugarsPer100g),
    fiber: scale(data.fiberPer100g),
  };
}

/**
 * Convert a natural-unit count to grams.
 * Returns undefined if the food has no natural unit defined.
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
 * Check whether static nutrition data exists for a canonical food.
 * Use this to decide whether to show "no data" in the UI.
 */
export function hasNutritionData(canonical: string): boolean {
  const data = FOOD_PORTION_DATA.get(canonical);
  return data?.caloriesPer100g != null;
}
```

---

## 7. Assumptions Requiring Validation

Merged from all three agents, deduplicated, with resolvable ones resolved inline.

### Resolved

| ID  | Assumption                                     | Resolution                                                                                                                                                                                                                        |
| --- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Entry count is 147 vs 148                      | **Resolved: 147.** See section 2.1.                                                                                                                                                                                               |
| R2  | fiber vs fibre spelling                        | **Resolved: `fiberPer100g` in code, "Fibre" in UI.** See section 2.2.                                                                                                                                                             |
| R3  | Separate map vs inline                         | **Resolved: Separate map.** See section 1.4.                                                                                                                                                                                      |
| R4  | ingredientProfiles has zero global seed data   | **Resolved: Confirmed zero.** See section 5.1.                                                                                                                                                                                    |
| R5  | saturatedFatG and saltG excluded from MVP      | **Resolved: Confirmed by decision #22 and implementation plan.** See section 1.6.                                                                                                                                                 |
| R6  | FoodRegistryEntryBase is not exported directly | **Resolved:** Only `FoodRegistryEntry` (the union type) is exported (`shared/foodRegistryData.ts:141-146`). Adding optional fields to the base interface propagates automatically. But since we use a separate map, this is moot. |

### Still open -- require human/product validation

| ID  | Assumption                                                                                                                                                                      | Risk                                                                          | Who decides   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------- |
| V1  | `defaultPortionG` represents a "typical single serving" (not a reference amount for nutrition calculations). The UI pre-fills this; the user adjusts.                           | Low -- but confirms expected UX behavior.                                     | Product owner |
| V2  | "Per 100g" means cooked/prepared weight for cooked foods, matching USDA and Open Food Facts convention. Raw weights would inflate calorie density for water-absorbing foods.    | Low -- standard convention.                                                   | Product owner |
| V3  | The `source` provenance field should be visible in the UI (e.g., tooltip: "Source: USDA FoodData Central"). Aligns with CLAUDE.md AI transparency principle.                    | Medium -- affects UI design.                                                  | Product owner |
| V4  | No per-user override of portion defaults at this layer. If a user customizes their typical portion, that goes in `ingredientProfiles` or a future field, not in the static map. | Low -- clean separation of concerns.                                          | Architecture  |
| V5  | A static TypeScript map is sufficient for MVP. If nutrition data needs to update without a code deploy, a Convex table for global reference data would be needed instead.       | Medium -- but per "no new tables" directive, static map is preferred for now. | Architecture  |
| V6  | The 150g global fallback for `getDefaultPortionG` may be wrong for seasonings (~5g) and liquids (~240g). Consider category-aware fallbacks in a future iteration.               | Low -- affects UX quality, not correctness.                                   | Future work   |

---

## Appendix: Source File Reference

| File                                    | Lines     | What was verified                                                      |
| --------------------------------------- | --------- | ---------------------------------------------------------------------- |
| `shared/foodRegistryData.ts`            | 103-114   | `FoodDigestionMetadata` -- 10 optional fields, all US "fiber" spelling |
| `shared/foodRegistryData.ts`            | 116-139   | `FoodRegistryEntryBase` -- no portion/nutrition fields                 |
| `shared/foodRegistryData.ts`            | 141-146   | `FoodRegistryEntry` union type -- only exported type                   |
| `shared/foodRegistryData.ts`            | 4314-4322 | `BASE_FOOD_REGISTRY` assembly + enrichment (147 entries)               |
| `shared/foodRegistryData.ts`            | 4328-4381 | Invariant checker -- validates canonicals, zones, group/line           |
| `shared/foodRegistryUtils.ts`           | 29-31     | `FOOD_ENTRY_MAP` -- existing O(1) lookup pattern                       |
| `shared/foodRegistryUtils.ts`           | 76-78     | `getFoodEntry()`                                                       |
| `shared/foodRegistry.ts`                | 23-25     | Barrel re-exports from `foodRegistryData.ts`                           |
| `convex/schema.ts`                      | 113-138   | `ingredientProfiles` table definition                                  |
| `convex/schema.ts`                      | 124-133   | `nutritionPer100g` object -- 8 nullable number fields                  |
| `convex/ingredientProfiles.ts`          | 11-20     | `nutritionPatchValidator`                                              |
| `convex/ingredientProfiles.ts`          | 30-41     | `blankNutrition()` -- all fields init to `null`                        |
| `convex/ingredientProfiles.ts`          | 74-193    | `upsert` mutation -- patches nutrition field-by-field                  |
| `convex/ingredientProfileProjection.ts` | 21-23     | Registry-to-profile projection for group/line                          |
| Decision doc                            | #22       | "5 values (protein, carbs, fat, sugars, fibre)"                        |
| Implementation plan                     | line 612  | "5-macro totals (protein/carbs/fat/sugars/fibre)"                      |
