# Food Platform & Navigation Restructure — Adapted Master Plan

## Context

Three streams of work need merging into one coherent plan:

1. **new-plan-food.md** — Radical architecture shift: move static food data into Convex, create per-user product catalog with custom portions/nutrition, add OpenFoodFacts UK API integration. Graduate from "hardcoded tracker" to "dynamic diet platform."

2. **kind-scribbling-bird** (active plan) — Three critical bugs: `getEffectivePortionG()` ignores units (25 kcal instead of 751 kcal for "8 sl toast"), staging path discards original units, display shows "8sl" instead of "8 slices (240g)".

3. **waves-0-6 JSON plans** — 22 tasks: schema extensions, 4-tab nav restructure, Home/Track/Food/Insights pages, seed data, cross-cutting UX fixes.

**Outcome**: A single wave structure (W0-W7, 30 tasks) that puts data architecture + bug fixes first, then layers on the UI.

---

## Architecture: 3-Layer Model

```
Layer 1: Clinical (Global)              Layer 2: Personal (Per-user)           Layer 3: External
clinicalRegistry table (NEW)      ->    ingredientProfiles table (extended)    OpenFoodFacts UK API
- zone, subzone, category               - productName ("Bon Preu Bread")      - Convex Action
- digestion metadata                     - customPortions [{label, weightG}]   - Auto-fill nutrition
- defaultPortionG, naturalUnit           - nutritionPer100g (user overrides)   - Barcode future
- clinical notes                         - barcode, registryId link

foodEmbeddings (UNCHANGED)        — remains a pure vector search index.
                                    May be wiped/rebuilt when embedding model changes.
```

**Key decision**: Create a NEW `clinicalRegistry` table. This overrides the general "no new tables" rule for a specific safety reason: `foodEmbeddings` is a vector search index that may need wiping when changing embedding models. Packing permanent medical truth (osmotic effect, lactose risk, zone assignments) into a vector table risks deleting the clinical database during routine AI maintenance. `clinicalRegistry` stores immutable medical baselines; `foodEmbeddings` stays as a search index that points to it.

**Log history integrity**: The `logs` table gets an optional `productId` field (pointing to `ingredientProfiles._id`). When a user logs "Bon Preu Bread" today, the log references the exact product profile used, so historical calorie calculations always map back to the correct brand — not the generic registry entry.

**Hybrid approach**: Static `shared/` files remain for fast client-side lookups and LLM context. Convex becomes the primary source for per-user data and admin-editable clinical data. Server-side Convex query handles unified search (no client-side multi-query merge).

---

## Wave 0 — Schema Widening

> All optional fields. No migration, no runtime behavior changes. Pure widen step.

| ID     | Title                                                 | Key Files                                  | Old Task     |
| ------ | ----------------------------------------------------- | ------------------------------------------ | ------------ |
| W0-T01 | Create clinicalRegistry table                         | `convex/schema.ts`, `convex/validators.ts` | NEW          |
| W0-T02 | Extend ingredientProfiles with product catalog fields | `convex/schema.ts`, `convex/validators.ts` | NEW          |
| W0-T03 | Add productId to logs table                           | `convex/schema.ts`                         | NEW          |
| W0-T04 | Extend foodLibrary for composite meals                | `convex/schema.ts`, `convex/validators.ts` | = old W0-T01 |
| W0-T05 | Add foodFavouriteSlotTags to profiles                 | `convex/schema.ts`, `convex/validators.ts` | = old W0-T03 |

**W0-T01 creates clinicalRegistry**: canonicalName (unique), zone, subzone, category, subcategory, group, line, lineOrder, macros, notes, defaultPortionG, naturalUnit, unitWeightG, osmoticEffect, totalResidue, fiberTotalApproxG, fiberInsolubleLevel, fiberSolubleLevel, gasProducing, dryTexture, irritantLoad, highFatRisk, lactoseRisk. Index: `by_canonicalName`. This is the permanent medical truth — never wiped during AI operations.

> **Recovery:** If `clinicalRegistry` is accidentally deleted, it can be fully rebuilt by re-running the `seedClinicalData` internal mutation. The seed data is stored as static arrays in `convex/seedClinicalData.ts` and is idempotent (checks by `canonicalName` before inserting — safe to re-run against a partially populated table).

**W0-T02 adds to ingredientProfiles**: customPortions (array of {label: string, weightG: number}), productName (string), barcode (string), registryId (id of clinicalRegistry).

**W0-T03 adds to logs**: productId: `v.optional(v.id("ingredientProfiles"))`. When a food is logged from staging, productId links back to the exact brand/product used. Historical calorie lookups use this instead of guessing from canonicalName alone.

**Old W0-T02** (tspToGrams) is absorbed — customPortions is more general.

---

## Wave 1 — Bug Fixes + Data Layer Hook

> Highest user impact. Fixes the 25 kcal bug and creates the Convex-first data bridge.

| ID     | Title                                                   | Key Files                                               | Old Task          |
| ------ | ------------------------------------------------------- | ------------------------------------------------------- | ----------------- |
| W1-T01 | Fix getEffectivePortionG to be unit-aware               | `src/lib/nutritionUtils.ts`, tests                      | NEW (KSB Phase 1) |
| W1-T02 | Fix buildStagedNutritionLogData to preserve units       | `src/components/track/nutrition/nutritionLogging.ts`    | NEW (KSB Phase 3) |
| W1-T03 | Fix buildPortionText display for discrete units         | `src/components/track/today-log/editors/FoodSubRow.tsx` | NEW (KSB Phase 2) |
| W1-T04 | Create useFoodData hook (Convex-first, static fallback) | `src/hooks/useFoodData.ts` (new)                        | NEW               |

**W1-T01**: `getEffectivePortionG()` rewrite — normalize unit, handle g/kg/oz/lb/ml/l. For discrete units, use a **customPortions-first** lookup chain:

1. Check `ingredientProfiles.customPortions` for a matching label -> return `quantity * customPortion.weightG`
2. Fallback to `FOOD_PORTION_DATA[canonicalName].unitWeightG` -> return `quantity * unitWeightG`
3. Final fallback: return `quantity` as grams (best guess)

This avoids throwaway work — the math is written to its final shape from day one. When Wave 6 adds the custom portions UI, no rewrite needed. The function accepts an optional `customPortions` parameter (or reads from a context/hook). Refactor `getItemMacros()` to call the shared function. Test: `{ canonicalName: "toast", quantity: 8, unit: "sl" }` -> portionG=240, calories=751 (using static fallback). Also test with customPortions override: `[{label: "slice", weightG: 31.5}]` -> portionG=252.

**W1-T02**: When StagedItem has naturalUnit, store `{ quantity: count, unit: "sl" }` not `{ quantity: grams, unit: "g" }`. Also pass `productId` (from ingredientProfiles, if the food was selected from user's catalog) into the log data, so `W0-T03`'s schema field is populated from the start.

**W1-T03**: UNIT_DISPLAY_MAP (sl->slice/slices, pc->piece/pieces, etc.). Output: "8 slices (240g)".

**W1-T04**: Create `convex/search.ts:unifiedFoodSearch` — a **server-side Convex query** that merges results from ingredientProfiles (user's products) + clinicalRegistry (global foods) + static fallback. The server searches user profiles first, backfills with clinical registry results, deduplicates by canonicalName, and returns one clean sorted array. The client-side `useFoodData()` hook is a thin wrapper around this query — no multi-query merging in React (avoids UI stutter from queries resolving at different speeds). Also provides `lookupFood(canonicalName)` with the same merge priority.

---

## Wave 2 — Seed Data + Migration

> Populate Convex with clinical data and the user's ~30 core foods.

| ID     | Title                                    | Key Files                                                 | Old Task                     |
| ------ | ---------------------------------------- | --------------------------------------------------------- | ---------------------------- |
| W2-T01 | Registry -> clinicalRegistry seed script | `convex/seedClinicalData.ts` (new)                        | NEW                          |
| W2-T02 | Seed ~30 post-surgery foods              | `shared/foodPortionData.ts`, `shared/foodRegistryData.ts` | = old W6-T01 (moved earlier) |
| W2-T03 | Seed Coffee + Toast meal templates       | `convex/seedMealTemplates.ts` (new)                       | = old W6-T02 (moved earlier) |
| W2-T04 | Favourite slot auto-tag mutation         | `convex/profiles.ts`, tests                               | = old W0-T04 (moved from W0) |

**W2-T01**: Internal mutation reads static registry (4000+ entries), inserts into `clinicalRegistry`. For each entry writes: zone, subzone, category, subcategory, group, line, lineOrder, macros, notes, defaultPortionG, naturalUnit, unitWeightG, and all FoodDigestionMetadata. Idempotent (checks by canonicalName). `foodEmbeddings` is NOT touched — it remains a pure search index.

> **Idempotency:** Skips rows where `canonicalName` already exists — safe to re-run. **Rollback:** Query `clinicalRegistry` and delete all rows (no userId filter needed — this table is global). **Confirmation:** Always verify you are targeting the correct Convex deployment before running.

**W2-T02**: The ~30 foods list (toast, pasta, rice, wraps, lean meat, fish, eggs, cheese, banana, pumpkin, potato, butter, jam, PB, cream cheese, olive oil, salt, pepper, herbs, coffee, milk, sugar, tea, juice, carbonated drink, etc.) with full macros sourced from USDA/McCance/OFF. Includes tsp-to-gram densities for spreads (butter 4.7g/tsp, jam 7g/tsp, etc.).

> **Idempotency:** W2-T02 updates static shared files — no Convex rows inserted directly; idempotency is a file-level concern (overwrite is safe). **Confirmation:** Always confirm target userId/environment before running any associated Convex seed step.

**W2-T03**: Seed Coffee + Toast meal templates into `foodLibrary` via `convex/seedMealTemplates.ts`. Each template is a composite meal (e.g. "Morning Coffee" = coffee + milk + sugar) stored as a `foodLibrary` entry with `items[]` referencing canonical names.

> **Idempotency:** Needs clarification — the script should check for an existing `foodLibrary` entry by template name before inserting to avoid duplicates. If not yet implemented this way, add the check. **Rollback:** Query `foodLibrary` and delete rows inserted by this seed (filter by `createdAt` timestamp or add a `seededBy: "seedMealTemplates"` marker field). **Confirmation:** Always confirm target userId and Convex deployment before running.

---

## Wave 3 — Navigation Restructure

> Independent of data work. Can run in parallel with W1/W2.

| ID     | Title                            | Key Files                                              | Old Task     |
| ------ | -------------------------------- | ------------------------------------------------------ | ------------ |
| W3-T01 | Page stubs: Home, Food, Insights | `src/pages/Home.tsx`, `Food.tsx`, `Insights.tsx` (new) | = old W1-T01 |
| W3-T02 | 4-tab bottom nav layout          | `src/routeTree.tsx`                                    | = old W1-T02 |
| W3-T03 | /patterns -> /insights redirect  | `src/routeTree.tsx`                                    | = old W1-T03 |

Unchanged from old plan. Home(/), Track(/track), Food(/food), Insights(/insights).

---

## Wave 4 — Track + Insights Pages

> Depends on W3.

| ID     | Title                              | Key Files                | Old Task     |
| ------ | ---------------------------------- | ------------------------ | ------------ |
| W4-T01 | Simplify Track to Today's Log only | `src/pages/Track.tsx`    | = old W2-T01 |
| W4-T02 | Move Dr. Poo to Insights tab       | `src/pages/Insights.tsx` | = old W2-T02 |

Unchanged from old plan.

---

## Wave 5 — Home Page

> Depends on W3 + W1-T04 (useFoodData hook) + W2-T04 (slot tagging).

| ID     | Title                                    | Key Files                                                     | Old Task               |
| ------ | ---------------------------------------- | ------------------------------------------------------------- | ---------------------- |
| W5-T01 | Greeting + nutrition summary             | `src/pages/Home.tsx`                                          | = old W3-T01           |
| W5-T02 | Meal slots, favourites, recent, frequent | `src/pages/Home.tsx`, `src/hooks/useSlotScopedFoods.ts` (new) | = old W3-T02 (adapted) |
| W5-T03 | Modifier chips + Quick Capture           | `src/pages/Home.tsx`                                          | = old W3-T03           |
| W5-T04 | Search bar + water action                | `src/pages/Home.tsx`                                          | = old W3-T04 (adapted) |
| W5-T05 | Dr. Poo touchpoints                      | `src/pages/Home.tsx`                                          | = old W3-T05           |

**Adapted**: W5-T02 and W5-T04 use `useFoodData` hook for food lookups instead of direct static imports.

---

## Wave 6 — Food Page + Product Management

> Depends on W3 + W1-T04 + W2 (seed data). This is where the new architecture vision shines.

| ID     | Title                                             | Key Files                                                                       | Old Task                |
| ------ | ------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------- |
| W6-T01 | Food page shell + view switcher + backfill picker | `src/pages/Food.tsx`                                                            | = old W5-T01            |
| W6-T02 | Search view (Convex-backed, no cap)               | `src/pages/Food.tsx`, `src/hooks/useFoodData.ts`                                | = old W5-T02 (adapted)  |
| W6-T03 | Favourites view with slot filtering               | `src/pages/Food.tsx`                                                            | = old W5-T03            |
| W6-T04 | Filter view (recent/frequent/zone)                | `src/pages/Food.tsx`                                                            | = old W5-T04            |
| W6-T05 | Food detail modal + custom portions               | `src/components/food/FoodDetailModal.tsx` (new), `convex/ingredientProfiles.ts` | = old W5-T05 (extended) |
| W6-T06 | OpenFoodFacts "Add Product" flow                  | `src/components/food/FoodDetailModal.tsx`, `convex/ingredientNutritionApi.ts`   | NEW                     |

**W6-T02 adapted**: Search queries `useFoodData.searchFoods()` which hits Convex foodEmbeddings first, then Fuse.js fallback. No 50-item cap.

**W6-T05 extended**: Modal now includes: productName field, customPortions editor (add/edit/delete {label, weightG} entries), barcode field, registryId dropdown (link to clinical category). Save writes all fields to ingredientProfiles via extended upsert mutation.

**W6-T06 new**: "Search UK Products" button in FoodDetailModal queries `convex/ingredientNutritionApi.ts:searchOpenFoodFacts` (already exists!). Auto-fills nutrition. User picks clinical category. User adds custom portions. Save creates full ingredientProfile.

---

## Wave 7 — Cross-cutting Polish

> Depends on W5 + W6.

| ID     | Title                                  | Key Files                | Old Task     |
| ------ | -------------------------------------- | ------------------------ | ------------ |
| W7-T01 | Heart toggle audit (every FoodRow)     | `FoodRow.tsx`, all pages | = old W4-T01 |
| W7-T02 | Plus button -> auto-stage + open modal | All pages                | = old W4-T02 |

---

## Dependency Graph

```
W0 (Schema) ──► W1 (Bug Fixes + Hook) ──► W2 (Seed Data) ──► W5 (Home)
                                                            ──► W6 (Food Page)
                                                            ──► W7 (Polish)
              W3 (Nav) ──► W4 (Track+Insights)
                        ──► W5 (Home)
                        ──► W6 (Food Page)
```

**Parallelism**: W3 runs in parallel with W0+W1+W2. W4 runs in parallel with W5/W6 (different pages). W5 and W6 can run in parallel.

---

## Task Mapping Summary

| Old ID                          | New ID      | Status                                   |
| ------------------------------- | ----------- | ---------------------------------------- |
| W0-T01 (foodLibrary composites) | W0-T04      | Kept                                     |
| W0-T02 (tspToGrams)             | --          | Absorbed into W0-T02 customPortions      |
| W0-T03 (slot tags schema)       | W0-T05      | Kept                                     |
| W0-T04 (slot tag mutation)      | W2-T04      | Moved to W2                              |
| W1-T01..T03 (nav)               | W3-T01..T03 | Renumbered                               |
| W2-T01 (simplify Track)         | W4-T01      | Renumbered                               |
| W2-T02 (Dr Poo to Insights)     | W4-T02      | Renumbered                               |
| W3-T01..T05 (Home)              | W5-T01..T05 | Renumbered, T02/T04 use data hook        |
| W4-T01 (heart audit)            | W7-T01      | Moved to final wave                      |
| W4-T02 (plus button)            | W7-T02      | Moved to final wave                      |
| W5-T01..T04 (Food page)         | W6-T01..T04 | Renumbered                               |
| W5-T05 (detail modal)           | W6-T05      | Extended with product catalog            |
| W6-T01 (~30 foods)              | W2-T02      | Moved earlier                            |
| W6-T02 (meal templates)         | W2-T03      | Moved earlier                            |
| --                              | W0-T01      | NEW: clinicalRegistry table              |
| --                              | W0-T02      | NEW: ingredientProfiles product fields   |
| --                              | W0-T03      | NEW: productId on logs table             |
| --                              | W1-T01..T03 | NEW: bug fixes from kind-scribbling-bird |
| --                              | W1-T04      | NEW: server-side unified search + hook   |
| --                              | W2-T01      | NEW: registry seed script                |
| --                              | W6-T06      | NEW: OpenFoodFacts "Add Product" flow    |

**9 NEW tasks, 22 KEPT tasks = 31 total across 8 waves.**

---

## Deferred / Stretch

These items from new-plan-food.md are intentionally deferred:

- **Registry Admin Page** — Data-table UI for editing clinical categories in-browser. Defer until the foodEmbeddings clinical data is stable and the user has used the system enough to know what needs admin editing.
- **Product Manager Page** — Dedicated page for browsing/managing all user products. The FoodDetailModal (W6-T05) covers editing. A full list view can be added after W6.
- **Barcode Scanner UI** — Schema field added in W0-T02. UI deferred per new-plan-food.md ("adding a Barcode Scanner later will be incredibly easy").
- **Voice / Conversational Logging** — Separate initiative in ROADMAP.
- **Photo/Label Capture** — Parking lot in ROADMAP.

---

## Verification Strategy

**Per-wave gates** (must pass before next wave):

1. `bun run typecheck` — zero errors
2. `bun run build` — clean build
3. `bun run test` — all tests pass
4. Visual verification via Claude-in-Chrome on localhost:3005 (for UI waves)

**End-to-end smoke tests after W1**:

- Type "8 sl toast" -> 751 kcal (not 25)
- Stage 2 slices toast -> "2 slices (60g)" preserved
- Timeline shows "8 slices (240g)" not "8sl"

**End-to-end smoke tests after W6**:

- Search "toast" on Food page -> results from Convex
- Tap food name -> FoodDetailModal opens
- Edit portion -> Save -> new values used in staging
- "Search UK Products" -> OFF results -> auto-fill -> save

---

## Files to Update at Execution Start

- `docs/ROADMAP.md` — Update "Food Page, Meal System & Navigation Restructure" initiative to reference this plan; mark old wave JSONs as superseded
- `docs/plans/` — Archive old wave JSONs, create new ones from this plan per-wave
- kind-scribbling-bird plan — Mark Phases 1-3 as absorbed into W1-T01..T03
