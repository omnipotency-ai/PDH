## Context (2026-04-01, adams-rib branch)

User was cleaning dead code and asked whether the ingredient subsystems were unused junk. Five parallel research agents investigated every file, write path, read path, UI consumer, and test for each system. **Conclusion: all 4 are pre-built infrastructure that maps directly to the filter prompt design in `docs/design/filter-prompt.md`. None should be deleted.**

## System-by-system findings

### 1. ingredientExposures — KEEP (active writes, no UI consumer yet)

**What it does:** Denormalized index of every food item the user has ever eaten. One row per food per log event. Stores canonicalName, quantity, unit, preparation, recoveryStage, spiceLevel, timestamp.

**Write paths (all active):**

- `convex/foodParsing.ts` → `processEvidence()` (6-hour evidence window closer — primary production writer)
- `convex/foodParsing.ts` → `applyLlmResults()` (after LLM resolution, if evidence window already closed)
- `convex/foodParsing.ts` → `resolveItem()` (user manual resolution)
- `convex/logs.ts` → `rebuildIngredientExposuresForFoodLog()` (log updates/recanonicalization)
- `convex/logs.ts` → backup import path

**Read paths (defined but unused):**

- `convex/ingredientExposures.ts` → `allIngredients` query (groups by canonical, returns totalExposures + lastSeenAt)
- `convex/ingredientExposures.ts` → `historyByIngredient` query (exposure history for single food)
- Hooks exported: `useAllIngredientExposures()`, `useIngredientExposureHistory()`, `useBackfillIngredientExposures()` — all in `syncFood.ts`, re-exported from `sync.ts`. **Zero components call them.**

**Filter prompt connection:** The `allIngredients` query returns exactly what the filter prompt's "Status" dimension needs — exposure count determines whether a food is "building" (currently testing). Without exposures, you can't distinguish "never tried" from "tried 5 times."

**Tests:** Comprehensive — `ingredientExposures.test.ts` (1 test), `logs.test.ts` (4 tests on exposure lifecycle), `foodParsing.test.ts` (processEvidence tests).

### 2. ingredientProfiles + ingredientNutritionApi — KEEP (nutrition column for filter)

**What ingredientProfiles stores:** Per-food metadata: canonicalName, displayName, tags, foodGroup, foodLine, lowResidue flag, source ("manual" | "openfoodfacts"), externalId, ingredientsText, and `nutritionPer100g` object (kcal, fatG, saturatedFatG, carbsG, sugarsG, fiberG, proteinG, saltG — all nullable).

**What ingredientNutritionApi does:** Convex action that queries OpenFoodFacts API, returns up to 15 results with normalized nutrition data per 100g. Fully built, properly structured. Hook: `useSearchIngredientNutritionApi()` in `syncFood.ts`.

**Current state:** Both are feature-complete infrastructure with **zero UI consumers**. No component calls the hooks. Nutrition data is never sent to the AI prompt. The upsert mutation works (tested), the OpenFoodFacts API integration works, but nothing triggers population.

**Filter prompt connection:** The filter prompt has `kcal`, `proteinG`, `fatG`, `fiberG` etc. as filterable dimensions (the "Nutrition" filter group with FIBRE and KCAL filters). These map 1:1 to `ingredientProfiles.nutritionPer100g`. Without this system, the numeric nutrition filters have no data source.

**Files:** `convex/ingredientProfiles.ts` (195 lines), `convex/ingredientProfileProjection.ts` (24 lines), `convex/ingredientNutritionApi.ts` (141 lines), `convex/ingredientProfiles.test.ts` (76 lines, 3 tests passing).

### 3. ingredientOverrides — KEEP (user-set food status, needs enum expansion)

**What it stores:** User-set manual food status per canonical food. Schema: userId, canonicalName, status ("safe" | "watch" | "avoid"), optional note, timestamps.

**Current state:** Backend fully functional with proper race condition handling and deduplication. Hooks exported (`useSetIngredientOverride()`, `useClearIngredientOverride()`). The Patterns database table renders a "Manual" badge when an override exists. But **no UI exists to create or edit overrides** — the hooks are never called by any component.

**Filter prompt connection:** Maps to the "Status" filter dimension. But the filter prompt has 5 statuses (`building | like | dislike | watch | avoid`) while overrides only have 3 (`safe | watch | avoid`). The "like" vs "dislike" distinction (tolerated + taste preference) was discussed in a previous session and captured in the logging UX pivot memory. The override enum needs expanding to match.

**Files:** `convex/ingredientOverrides.ts` (147 lines), `convex/ingredientOverrides.test.ts` (64 lines).

### 4. Food decomposition (composite handling) — ACTIVE, ties into meal logging

**How it works:** When user types "toast with butter", the LLM-based food parsing system (`src/lib/foodLlmCanonicalization.ts`) decides whether the input is composite. Rules: explicit ingredient lists decompose (`isComposite: true`), named dishes don't ("pasta salad" stays as one item). Components are stored as separate items in the log's `items[]` array, each getting its own `ingredientExposure` row.

**foodLibrary table** stores composite definitions: `type: "composite"`, `ingredients: ["toast", "butter"]`. This is the foundation for saved meals.

**Key:** This is NOT coupled to the 4 ingredient subsystems above — it feeds into them (decomposed items create exposures) but works independently.

## Data integration with filter prompt

The filter prompt (`docs/design/filter-prompt.md`) describes a `FoodRegistryEntry` with these dimension groups:

| Filter dimension                                                       | Data source                                                        | Status                                                                          |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Classification (zone, macros, subcategory, group, line)                | Static registry in `shared/foodRegistryData.ts`                    | **Ready** — data exists                                                         |
| Digestion risk (osmotic, FODMAP, residue, gas, fat, irritant, lactose) | `FoodDigestionMetadata` on registry entries                        | **Ready** — data exists                                                         |
| Preparation (mechanicalForm, cookingMethod, skin)                      | Not in any table                                                   | **Not built** — registry is flat canonical names only                           |
| Nutrition (kcal, protein, fat, fibre, etc.)                            | `ingredientProfiles.nutritionPer100g`                              | **Infrastructure ready, no data populated**                                     |
| User status (building/like/dislike/watch/avoid)                        | `ingredientOverrides` + exposure counts from `ingredientExposures` | **Partial** — override enum needs expanding, exposure queries exist but unwired |
| Tags                                                                   | Registry entries + `ingredientProfiles.tags`                       | **Partial** — registry has no tags field yet, profiles do                       |
| Exposure history                                                       | `ingredientExposures` table                                        | **Data accumulating, queries exist, no UI**                                     |
