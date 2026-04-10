# W0-04 Analysis Beta: Portion Data Schema & ingredientProfiles Audit

**Agent:** Beta  
**Date:** 2026-04-03  
**Scope:** Portion data extension for FoodRegistryEntry, ingredientProfiles coverage audit, seeding strategy, utility function signatures

---

## 1. Current State Inventory

### 1.1 FOOD_REGISTRY shape (shared/foodRegistryData.ts)

The registry contains **147 canonical entries** across 4 zone arrays (ZONE_1A, ZONE_1B, ZONE_2, ZONE_3), combined at line 4314 and enriched via `applyFoodEntryEnrichment` at line 4322.

The base entry interface (`FoodRegistryEntryBase`, line 116) has these fields:

| Field         | Type                                              | Required    |
| ------------- | ------------------------------------------------- | ----------- |
| `canonical`   | `string`                                          | yes         |
| `zone`        | `FoodZone` (1\|2\|3)                              | yes         |
| `subzone`     | `FoodSubzone` ("1A"\|"1B")                        | zone 1 only |
| `category`    | `FoodCategory`                                    | yes         |
| `subcategory` | `FoodSubcategory`                                 | yes         |
| `macros`      | `ReadonlyArray<"protein"\|"carbohydrate"\|"fat">` | yes         |
| `examples`    | `ReadonlyArray<string>`                           | yes         |
| `group`       | `FoodGroup`                                       | yes         |
| `line`        | `FoodLine`                                        | yes         |
| `lineOrder`   | `number`                                          | yes         |
| `notes`       | `string`                                          | optional    |

`FoodRegistryEntryBase` extends `FoodDigestionMetadata` (line 103), which adds 10 optional fields: `osmoticEffect`, `totalResidue`, `fiberTotalApproxG`, `fiberInsolubleLevel`, `fiberSolubleLevel`, `gasProducing`, `dryTexture`, `irritantLoad`, `highFatRisk`, `lactoseRisk`.

**Key observation:** There are ZERO portion or nutrition fields on the registry today. No `defaultPortionG`, no `caloriesPer100g`, nothing.

### 1.2 ingredientProfiles table (convex/schema.ts, line 113-138)

This is a **per-user** Convex table (indexed by `userId` + `canonicalName`). It stores user-specific ingredient data including nutrition.

**Schema fields:**

| Field              | Type                                  | Notes                        |
| ------------------ | ------------------------------------- | ---------------------------- |
| `userId`           | `string`                              | required, per-user scoping   |
| `canonicalName`    | `string`                              | maps to registry canonical   |
| `displayName`      | `string`                              |                              |
| `tags`             | `string[]`                            |                              |
| `foodGroup`        | `FoodGroup \| null`                   | projected from registry      |
| `foodLine`         | `FoodLine \| null`                    | projected from registry      |
| `lowResidue`       | `boolean \| null`                     |                              |
| `source`           | `"manual" \| "openfoodfacts" \| null` | data provenance              |
| `externalId`       | `string \| null`                      | e.g. Open Food Facts barcode |
| `ingredientsText`  | `string \| null`                      | raw label text               |
| `nutritionPer100g` | `object` (see below)                  | the nutrition sub-object     |
| `createdAt`        | `number`                              |                              |
| `updatedAt`        | `number`                              |                              |

### 1.3 nutritionPer100g sub-object (convex/schema.ts, line 124-133)

Defined inline in the schema and as `nutritionPatchValidator` in `convex/ingredientProfiles.ts` (line 11-20):

| Field           | Type             | Unit                  |
| --------------- | ---------------- | --------------------- |
| `kcal`          | `number \| null` | kilocalories per 100g |
| `fatG`          | `number \| null` | grams per 100g        |
| `saturatedFatG` | `number \| null` | grams per 100g        |
| `carbsG`        | `number \| null` | grams per 100g        |
| `sugarsG`       | `number \| null` | grams per 100g        |
| `fiberG`        | `number \| null` | grams per 100g        |
| `proteinG`      | `number \| null` | grams per 100g        |
| `saltG`         | `number \| null` | grams per 100g        |

All fields are nullable (null = "no data yet"). The `blankNutrition()` helper (line 30-41) initializes all to `null`.

---

## 2. Proposed TypeScript Interfaces

### 2.1 PortionData — the client-side static map value

This is the data structure for the static `FOOD_PORTION_DATA` map, providing portion sizing and nutrition for each canonical food. It is **not** an extension of FoodRegistryEntryBase itself; it lives in a separate map keyed by canonical name.

```typescript
/**
 * Static portion and nutrition data for a canonical food.
 * Source: ingredientProfiles (for foods with user/seed data) or
 *         USDA FoodData Central / Open Food Facts for gaps.
 *
 * All nutrition values are per 100g, matching the ingredientProfiles
 * schema convention.
 */
export interface PortionData {
  /** Default portion weight in grams (e.g. 1 egg = 50g, 1 banana = 120g). */
  defaultPortionG: number;

  /**
   * Human-readable natural unit (e.g. "1 medium egg", "1 slice", "1 cup").
   * Used for display: "120 kcal per 1 medium banana".
   */
  naturalUnit: string;

  /**
   * Weight in grams of one natural unit.
   * May differ from defaultPortionG when the "natural unit" is not the default.
   * Example: bread — naturalUnit "1 slice" = 36g, defaultPortionG = 72g (2 slices).
   */
  unitWeightG: number;

  // ── Nutrition per 100g (mirrors ingredientProfiles.nutritionPer100g) ──

  /** Kilocalories per 100g. Maps to ingredientProfiles.nutritionPer100g.kcal */
  caloriesPer100g: number | null;

  /** Protein grams per 100g. Maps to ingredientProfiles.nutritionPer100g.proteinG */
  proteinPer100g: number | null;

  /** Total carbohydrate grams per 100g. Maps to ingredientProfiles.nutritionPer100g.carbsG */
  carbsPer100g: number | null;

  /** Total fat grams per 100g. Maps to ingredientProfiles.nutritionPer100g.fatG */
  fatPer100g: number | null;

  /** Sugars grams per 100g. Maps to ingredientProfiles.nutritionPer100g.sugarsG */
  sugarsPer100g: number | null;

  /** Dietary fibre grams per 100g. Maps to ingredientProfiles.nutritionPer100g.fiberG */
  fibrePer100g: number | null;

  /** Data provenance. "usda" | "openfoodfacts" | "ingredientProfile" | "estimated" */
  source: "usda" | "openfoodfacts" | "ingredientProfile" | "estimated";
}
```

### 2.2 FoodRegistryEntryBase extension — optional portion fields inlined

Rather than a separate map, an alternative is to add optional fields directly to `FoodRegistryEntryBase` (shared/foodRegistryData.ts, line 116). This keeps portion data co-located with the food definition:

```typescript
interface FoodRegistryEntryBase extends FoodDigestionMetadata {
  // ... existing fields (canonical, zone, subzone, category, etc.) ...

  // ── NEW: optional portion & nutrition defaults ──

  /** Default portion weight in grams. If absent, no portion data available. */
  defaultPortionG?: number;

  /** Human-readable natural unit (e.g. "1 medium egg", "1 slice"). */
  naturalUnit?: string;

  /** Weight in grams of one natural unit. */
  unitWeightG?: number;

  /** Kilocalories per 100g. */
  caloriesPer100g?: number;

  /** Protein grams per 100g. */
  proteinPer100g?: number;

  /** Carbohydrate grams per 100g. */
  carbsPer100g?: number;

  /** Fat grams per 100g. */
  fatPer100g?: number;

  /** Sugars grams per 100g. */
  sugarsPer100g?: number;

  /** Dietary fibre grams per 100g. */
  fibrePer100g?: number;
}
```

### 2.3 Recommendation: separate PortionData map (not inline)

**I recommend the separate `FOOD_PORTION_DATA` map approach** over inlining into FoodRegistryEntryBase. Reasons:

1. **File size discipline.** foodRegistryData.ts is already 4,381 lines with 147 entries. Adding 9 optional fields with values to each would add ~1,300+ lines. A separate file keeps it manageable.
2. **Different population cadence.** Registry entries are stable (food identity). Nutrition data will be populated incrementally (from ingredientProfiles, USDA, etc.). Separate files = separate change frequency.
3. **No schema migration.** The registry is a static TypeScript const. Adding optional fields is non-breaking, but a separate map is even cleaner — zero risk of breaking the 7 existing consumers of `FoodRegistryEntry`.
4. **Testability.** Nutrition lookups can be unit-tested independently of registry shape.

---

## 3. Field Name Mismatch Audit: ingredientProfiles vs. PortionData

| ingredientProfiles.nutritionPer100g | Proposed PortionData | Match?                                                   |
| ----------------------------------- | -------------------- | -------------------------------------------------------- |
| `kcal`                              | `caloriesPer100g`    | **RENAME** — same semantics, different key               |
| `proteinG`                          | `proteinPer100g`     | **RENAME** — same semantics, different key               |
| `carbsG`                            | `carbsPer100g`       | **RENAME** — same semantics, different key               |
| `fatG`                              | `fatPer100g`         | **RENAME** — same semantics, different key               |
| `sugarsG`                           | `sugarsPer100g`      | **RENAME** — same semantics, different key               |
| `fiberG`                            | `fibrePer100g`       | **RENAME** + **SPELLING** — `fiber` (US) vs `fibre` (UK) |
| `saturatedFatG`                     | _(not included)_     | **OMITTED** — low-priority for nutrition card MVP        |
| `saltG`                             | _(not included)_     | **OMITTED** — low-priority for nutrition card MVP        |

**Critical note on fiber/fibre:** The ingredientProfiles table uses `fiberG` (American spelling). The PortionData interface uses `fibrePer100g` (British spelling, matching the CLAUDE.md project convention of a UK-based user). The mapping function must handle this translation. The existing `FoodDigestionMetadata` (line 103) uses `fiberTotalApproxG` and `fiberInsolubleLevel`/`fiberSolubleLevel` — all American spelling. Consistency suggests using `fiber` everywhere internally and displaying "fibre" only in the UI layer.

**Revised recommendation:** Use `fiberPer100g` (not `fibrePer100g`) in the PortionData interface to match the existing codebase convention. Display as "fibre" in UI text only.

---

## 4. ingredientProfiles Coverage Audit

### 4.1 Relationship model

`ingredientProfiles` is a **per-user** table. Each row links a `canonicalName` (matching the registry) to nutrition data for that user. This means:

- There is no global/shared nutrition data store.
- Nutrition data is populated when a user manually enters it or imports from Open Food Facts.
- Two users logging "egg" can have different nutrition profiles.
- There is no seed data mechanism — new users start with all-null nutrition for every food.

The `foodGroup` and `foodLine` fields are **projected** from the registry at write time via `getIngredientProfileProjection` (convex/ingredientProfileProjection.ts, line 21-23), which calls `getCanonicalFoodProjection` from `shared/foodProjection`.

### 4.2 Coverage gap

For the nutrition card to show calorie/macro data on first use (before a user has manually populated ingredientProfiles), we need **static reference data**. The ingredientProfiles table cannot serve this purpose because:

1. It requires authentication (`requireAuth` at line 46, 63, 88).
2. It is per-user — no "global" seed rows exist.
3. It starts empty for every user.

This confirms the need for a **client-side static map** (`FOOD_PORTION_DATA`) that provides default reference values for all 147 registry entries.

### 4.3 Mutation analysis (convex/ingredientProfiles.ts)

The `upsert` mutation (line 74-194) handles both insert and update. Key observations:

- `nutritionPer100g` is patched field-by-field (lines 109-121), not replaced wholesale. Individual null values are preserved unless explicitly overwritten.
- `source` tracks provenance: `"manual"` or `"openfoodfacts"` or `null`.
- The `list` query (line 43) returns all profiles for a user, sorted by `updatedAt` desc.
- `byIngredient` query (line 56) does exact canonicalName lookup after `resolveCanonicalFoodName`.

### 4.4 ingredientProfiles vs. static PortionData: complementary, not competing

The runtime priority should be:

1. **ingredientProfiles** (per-user, Convex) — if the user has populated nutrition for this food, use their data. This respects preferences (e.g., their specific brand of yogurt).
2. **FOOD_PORTION_DATA** (static, client-side) — fallback for foods the user hasn't profiled. Shows reference values with a clear "reference data" indicator in the UI.

---

## 5. Seeding Strategy

### 5.1 Data sources (in priority order)

1. **ingredientProfiles (runtime).** Per-user data from Convex. Highest trust. Used when available.
2. **USDA FoodData Central.** The gold standard for generic food nutrition. Free API, well-structured, covers nearly all 147 registry entries. Use SR Legacy or Foundation datasets.
3. **Open Food Facts.** Already integrated as a `source` option in ingredientProfiles. Good for branded/packaged foods but less reliable for generic whole foods (e.g., "egg", "white rice").

### 5.2 Population plan for FOOD_PORTION_DATA

**Phase 1: Manual seed from USDA** (covers ~120 of 147 entries)

For each registry entry, look up the USDA FDC ID and extract:

- `defaultPortionG` from USDA "portion" or "household serving"
- `naturalUnit` from USDA portion description
- `unitWeightG` from USDA gram weight per portion
- All 6 nutrition fields from USDA nutrient data per 100g

**Phase 2: Estimated values** (covers ~20 composite/ambiguous entries)

Foods like "curry dish", "stir fry", "fast food burger", "pizza" are composites with highly variable nutrition. These get `source: "estimated"` with conservative middle-ground values and a flag in the UI indicating low confidence.

**Phase 3: Flagged "needs population"** (~7 entries)

Entries that are too ambiguous for even estimates (e.g., "deep fried food", "exotic fruit") get `null` nutrition values and are excluded from calorie display until populated.

### 5.3 Static map structure

```typescript
// shared/foodPortionData.ts

import type { PortionData } from "./foodPortionTypes";

/**
 * Static portion and nutrition reference data for canonical foods.
 * Keyed by canonical name (must match FOOD_REGISTRY entries).
 *
 * Source: USDA FoodData Central SR Legacy, supplemented by
 * Open Food Facts for branded items. Composite dishes use
 * conservative estimates marked source: "estimated".
 *
 * This is REFERENCE data, not user data. User-specific values
 * in ingredientProfiles always take priority at runtime.
 */
export const FOOD_PORTION_DATA: ReadonlyMap<string, PortionData> = new Map([
  [
    "egg",
    {
      defaultPortionG: 50,
      naturalUnit: "1 medium egg",
      unitWeightG: 50,
      caloriesPer100g: 155,
      proteinPer100g: 13,
      carbsPer100g: 1.1,
      fatPer100g: 11,
      sugarsPer100g: 1.1,
      fiberPer100g: 0,
      source: "usda",
    },
  ],
  [
    "white rice",
    {
      defaultPortionG: 186, // 1 cup cooked
      naturalUnit: "1 cup cooked",
      unitWeightG: 186,
      caloriesPer100g: 130,
      proteinPer100g: 2.7,
      carbsPer100g: 28,
      fatPer100g: 0.3,
      sugarsPer100g: 0,
      fiberPer100g: 0.4,
      source: "usda",
    },
  ],
  // ... remaining 145 entries
]);
```

### 5.4 Entries flagged as "needs population"

These canonical names lack a clear USDA/OFF match and should be flagged:

1. `deep fried food` — too generic (what is fried?)
2. `exotic fruit` — catch-all category
3. `basic savoury snack` — brand-dependent
4. `low-fiber sweet snack` — brand-dependent
5. `simple chocolate snack` — brand-dependent
6. `high-sugar refined snack` — brand-dependent
7. `refined confectionery` — brand-dependent

These composite/catch-all entries could show "No nutrition data — too variable" in the UI rather than misleading estimates.

---

## 6. Utility Function Signatures

All utilities belong in a new file: `shared/foodPortionUtils.ts`, following the existing pattern of `shared/foodRegistryUtils.ts`.

```typescript
// shared/foodPortionUtils.ts

import type { PortionData } from "./foodPortionTypes";
import { FOOD_PORTION_DATA } from "./foodPortionData";

/**
 * Look up static portion data for a canonical food name.
 * Returns undefined if no data exists for this food.
 *
 * Does NOT check ingredientProfiles (that is a Convex query).
 * Callers should check ingredientProfiles first, then fall back here.
 */
export function getPortionData(canonical: string): PortionData | undefined {
  return FOOD_PORTION_DATA.get(canonical);
}

/**
 * Calculate estimated calories for a given portion weight.
 *
 * @param canonical - The canonical food name
 * @param portionG - Portion weight in grams
 * @returns Estimated calories, or 0 if no nutrition data available
 *
 * Formula: (caloriesPer100g / 100) * portionG
 */
export function calculateCaloriesForPortion(
  canonical: string,
  portionG: number,
): number {
  const data = FOOD_PORTION_DATA.get(canonical);
  if (!data?.caloriesPer100g) return 0;
  return Math.round((data.caloriesPer100g / 100) * portionG);
}

/**
 * Macronutrient breakdown for a given portion weight.
 * All values in grams, rounded to 1 decimal place.
 * Returns null fields when source data is missing.
 */
export interface MacroBreakdown {
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  sugars: number | null;
  fiber: number | null;
}

/**
 * Calculate macronutrient values for a given portion weight.
 *
 * @param canonical - The canonical food name
 * @param portionG - Portion weight in grams
 * @returns MacroBreakdown with per-portion values, or all-null if no data
 */
export function calculateMacrosForPortion(
  canonical: string,
  portionG: number,
): MacroBreakdown {
  const data = FOOD_PORTION_DATA.get(canonical);
  if (!data) {
    return { protein: null, carbs: null, fat: null, sugars: null, fiber: null };
  }

  const scale = portionG / 100;
  const round1 = (v: number | null): number | null =>
    v !== null ? Math.round(v * scale * 10) / 10 : null;

  return {
    protein: round1(data.proteinPer100g),
    carbs: round1(data.carbsPer100g),
    fat: round1(data.fatPer100g),
    sugars: round1(data.sugarsPer100g),
    fiber: round1(data.fiberPer100g),
  };
}
```

### 6.1 Integration with ingredientProfiles (Convex-aware wrapper)

The above utilities are pure/static. A React hook would layer in user data:

```typescript
// Sketch — not a deliverable, just illustrating the resolution chain
function usePortionData(canonical: string): PortionData | undefined {
  const profile = useQuery(api.ingredientProfiles.byIngredient, {
    canonicalName: canonical,
  });

  // User data takes priority
  if (profile?.nutritionPer100g) {
    return mergeProfileIntoPortionData(canonical, profile.nutritionPer100g);
  }

  // Fall back to static reference data
  return getPortionData(canonical);
}
```

---

## 7. Assumptions Requiring Validation

### A1: Separate file vs. inline extension

**Assumption:** A separate `FOOD_PORTION_DATA` map in `shared/foodPortionData.ts` is preferred over adding optional fields to `FoodRegistryEntryBase`.

**Validation needed:** Confirm with other agents and project owner. The inline approach would keep everything in one lookup but inflates an already-large file. The separate-map approach adds an extra import but is cleaner architecturally.

### A2: fiber vs. fibre spelling

**Assumption:** Use `fiberPer100g` internally (matching `ingredientProfiles.nutritionPer100g.fiberG` and `FoodDigestionMetadata.fiberTotalApproxG`) and display "fibre" only in the UI.

**Validation needed:** Confirm codebase spelling convention. The existing code consistently uses "fiber" in field names (see shared/foodRegistryData.ts:107, convex/schema.ts:130).

### A3: saturatedFatG and saltG omitted from PortionData

**Assumption:** The nutrition card MVP does not need saturated fat or salt. These can be added later.

**Validation needed:** Confirm with nutrition card design requirements. If the card shows a full nutrition label, these fields would be needed.

### A4: Static map is sufficient for MVP

**Assumption:** A static TypeScript map (built at compile time) is adequate. We do not need a Convex table for global nutrition reference data.

**Validation needed:** If the app needs to update nutrition data without a code deploy, a Convex table would be better. However, per CLAUDE.md principle "Convex is the Boss" — this is reference data, not user data, so a static approach may be acceptable for MVP.

### A5: ingredientProfiles has no global seed data

**Assumption:** There are no existing seed rows in ingredientProfiles. Every user starts with no nutrition data.

**Validation needed:** Check whether any migration or seed script populates ingredientProfiles rows. The `source` field supports `"openfoodfacts"` which suggests some automated import may exist, but I found no evidence of bulk seeding in the codebase.

### A6: "needs population" entries should show no data rather than estimates

**Assumption:** For the 7 catch-all/composite canonical names identified in section 5.4, it is better to show "no data available" than to show potentially misleading estimates.

**Validation needed:** Confirm product preference. Some users may prefer rough estimates over blank data.

### A7: defaultPortionG represents a "typical serving"

**Assumption:** `defaultPortionG` is the weight used when no quantity/unit is provided by the user (e.g., they just log "egg" without "2 eggs" or "100g egg"). This should represent a single typical serving.

**Validation needed:** Confirm this matches the nutrition card's intended behavior. The existing `parseLeadingQuantity` function (shared/foodParsing.ts:172) already extracts quantity and unit; the question is what default to use when both are null.

### A8: PortionData source tracking

**Assumption:** Each entry in FOOD_PORTION_DATA should carry a `source` field indicating provenance (usda, openfoodfacts, estimated). This supports the CLAUDE.md principle of AI transparency — never presenting inferred data as certainty.

**Validation needed:** Confirm whether source provenance should be visible in the UI or is metadata only.

---

## 8. File References

| File                                    | Lines     | Relevance                                                   |
| --------------------------------------- | --------- | ----------------------------------------------------------- |
| `shared/foodRegistryData.ts`            | 116-139   | `FoodRegistryEntryBase` interface definition                |
| `shared/foodRegistryData.ts`            | 103-114   | `FoodDigestionMetadata` interface                           |
| `shared/foodRegistryData.ts`            | 4314-4322 | Registry assembly and enrichment                            |
| `shared/foodRegistry.ts`                | 1-44      | Barrel re-exports                                           |
| `shared/foodRegistryUtils.ts`           | 29-31     | `FOOD_ENTRY_MAP` — existing O(1) lookup pattern to follow   |
| `shared/foodParsing.ts`                 | 172-290   | `parseLeadingQuantity` — how quantity/unit are parsed today |
| `convex/schema.ts`                      | 113-138   | `ingredientProfiles` table schema                           |
| `convex/schema.ts`                      | 124-133   | `nutritionPer100g` sub-object definition                    |
| `convex/ingredientProfiles.ts`          | 11-20     | `nutritionPatchValidator`                                   |
| `convex/ingredientProfiles.ts`          | 30-41     | `blankNutrition()` helper                                   |
| `convex/ingredientProfiles.ts`          | 56-72     | `byIngredient` query — the lookup path from client          |
| `convex/ingredientProfileProjection.ts` | 21-23     | How group/line are projected from registry                  |
