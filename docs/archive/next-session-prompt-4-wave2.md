# Next Session Prompt 4: Execute Wave 2 — Seed Data + Favourite Slot Mutation

> **Created:** 2026-04-08
> **Purpose:** Execute all 4 Wave 2 tasks (seed clinicalRegistry, seed ~30 post-surgery foods, seed meal templates, favourite slot auto-tag mutation).
> **Prerequisite:** Wave 1 (bug fixes + data hook) complete — commit `e51f4e6` on `odyssey/food-platform`.
> **Branch:** `odyssey/food-platform`

## Context

Wave 0 widened the schema. Wave 1 fixed the 25 kcal bug and created the `useFoodData` hook + `convex/search.ts`. Wave 2 populates the Convex database with clinical food data from the static registries, seeds meal templates, and adds the favourite slot auto-tag mutation that later waves (W5, W6) depend on.

**Master plan:** `docs/plans/food-platform-master-plan.md`

## What to read first

1. `docs/plans/food-platform-master-plan.md` — Wave 2 section (lines 88-103)
2. `convex/_generated/ai/guidelines.md` — MANDATORY before writing any Convex code
3. `convex/schema.ts` — `clinicalRegistry` (lines 58-93), `foodLibrary` (lines 426-439), `profiles` (lines 392-424)
4. `convex/validators.ts` — `structuredIngredientValidator`, `mealModifierValidator`, `mealSizeValidator`, `slotDefaultValidator`, `mealSlotValidator`
5. `shared/foodRegistryData.ts` — `FoodRegistryEntry` type (line 141), `FOOD_REGISTRY` array (~148 entries)
6. `shared/foodPortionData.ts` — `PortionData` interface (line 21), `FOOD_PORTION_DATA` map
7. `convex/profiles.ts` — existing mutations (only AI rate-limit helpers)

## Wave 2 Tasks (4 tasks)

### W2-T01: Registry → clinicalRegistry seed script

**New file:** `convex/seedClinicalData.ts`

**What:** An internal mutation that reads the static `FOOD_REGISTRY` (from `shared/foodRegistryData.ts`) and `FOOD_PORTION_DATA` (from `shared/foodPortionData.ts`) and inserts/updates rows in the `clinicalRegistry` Convex table.

**Requirements:**

1. Export an `internalMutation` named `seedClinicalRegistry` with no args (or a `dryRun` boolean arg for testing).
2. For each entry in `FOOD_REGISTRY`, insert a row into `clinicalRegistry` with these field mappings:
   - `canonicalName` ← `entry.canonical`
   - `zone` ← `entry.zone`
   - `subzone` ← `entry.subzone` (optional — use conditional spread for `exactOptionalPropertyTypes`)
   - `category` ← `entry.category`
   - `subcategory` ← `entry.subcategory`
   - `group` ← `entry.group`
   - `line` ← `entry.line`
   - `lineOrder` ← `entry.lineOrder`
   - `macros` ← `entry.macros` (cast to mutable array: `[...entry.macros]`)
   - `notes` ← `entry.notes` (optional — conditional spread)
   - `defaultPortionG` ← from `FOOD_PORTION_DATA.get(entry.canonical)?.defaultPortionG` (optional — conditional spread)
   - `naturalUnit` ← from `FOOD_PORTION_DATA.get(entry.canonical)?.naturalUnit` (optional — conditional spread)
   - `unitWeightG` ← from `FOOD_PORTION_DATA.get(entry.canonical)?.unitWeightG` (optional — conditional spread)
   - All `FoodDigestionMetadata` fields: `osmoticEffect`, `totalResidue`, `fiberTotalApproxG`, `fiberInsolubleLevel`, `fiberSolubleLevel`, `gasProducing`, `dryTexture`, `irritantLoad`, `highFatRisk`, `lactoseRisk` — each optional, use conditional spread
   - `createdAt` ← `Date.now()`
   - `updatedAt` ← `Date.now()`
3. **Idempotent:** Before inserting, check if a row with the same `canonicalName` already exists (use `.withIndex("by_canonicalName")`). If it exists, patch it instead of inserting.
4. Return a count of inserted/updated rows.

**Convex rules to follow:**

- Use `.withIndex("by_canonicalName", q => q.eq("canonicalName", name))` — never `.filter()`
- Use `internalMutation` (not `mutation`) since this is an admin/seed operation
- All optional fields must use conditional spread: `...(value !== undefined && { field: value })`

**Tests:** `convex/__tests__/seedClinicalData.test.ts` — test the field mapping logic with a mock entry. Since we can't easily test Convex mutations in vitest, extract the mapping function as a pure helper and test that.

---

### W2-T02: Seed ~30 post-surgery foods into static files

**Files:** `shared/foodPortionData.ts`, `shared/foodRegistryData.ts`

**What:** Ensure the static registries contain at least these ~30 core post-surgery foods with full macros sourced from USDA/McCance/OFF. Many already exist — audit and fill gaps.

**Target food list** (from master plan):

> toast, pasta, rice, wraps, lean meat, fish, eggs, cheese, banana, pumpkin, potato, butter, jam, peanut butter, cream cheese, olive oil, salt, pepper, herbs, coffee, milk, sugar, tea, juice, carbonated drink

**Requirements:**

1. Audit `FOOD_REGISTRY` (~148 entries) and `FOOD_PORTION_DATA` against the target list. Identify which are missing or have incomplete nutrition data.
2. For missing foods, add entries to both files with:
   - Full `FoodRegistryEntry` in `foodRegistryData.ts` (zone, subzone, category, subcategory, group, line, lineOrder, macros, examples, notes, digestion metadata)
   - Full `PortionData` in `foodPortionData.ts` (defaultPortionG, naturalUnit, unitWeightG, caloriesPer100g, proteinPer100g, carbsPer100g, fatPer100g, sugarsPer100g, fiberPer100g, source)
3. For existing foods with missing nutrition data, backfill the missing fields.
4. Include tsp-to-gram densities for spreads: butter 4.7g/tsp, jam 7g/tsp, peanut butter 5.3g/tsp, cream cheese 5g/tsp.
5. Source all nutrition data from USDA FoodData Central, McCance & Widdowson, or Open Food Facts UK.

**Tests:** After changes, run existing `nutritionUtils.test.ts` tests to ensure no regressions. Add test cases for at least 3 newly-added foods in `getEffectivePortionG` and `computeMacrosForPortion` tests.

---

### W2-T03: Seed Coffee + Toast meal templates

**New file:** `convex/seedMealTemplates.ts`

**What:** An internal mutation that seeds composite meal templates into the `foodLibrary` table. These templates let a user log "Coffee + Toast" as a single action in later waves.

**Requirements:**

1. Export an `internalMutation` named `seedMealTemplates`.
2. Args: `userId: v.string()` — templates are per-user (foodLibrary is user-scoped).
3. Seed at least 2 templates:
   - **"coffee + toast"**: type `"composite"`, ingredients `["coffee", "toast"]`, with `structuredIngredients` array specifying default quantities (e.g. coffee 200ml, toast 2 slices), `modifiers` for optional additions (butter, jam, milk, sugar), `slotDefaults` for breakfast slot.
   - **"toast + spread"**: type `"composite"`, ingredients `["toast"]`, with `modifiers` for spreads (butter, jam, peanut butter, cream cheese).
4. Use `structuredIngredientValidator` shape: `{ canonicalName, quantity, unit }`.
5. Use `mealModifierValidator` shape: `{ canonicalName, quantity, unit, isDefault }`.
6. **Idempotent:** Check by `userId` + `canonicalName` using `.withIndex("by_userId_name")`.
7. Set `createdAt: Date.now()`.

**Convex rules:** Same as W2-T01 — `.withIndex()`, no `.filter()`, `internalMutation`.

**Tests:** Extract template definitions as constants and test their structure matches validators. Test idempotency logic.

---

### W2-T04: Favourite slot auto-tag mutation

**File:** `convex/profiles.ts`

**What:** A mutation that automatically tags a food as a favourite with its meal slot when the user logs it. This powers the "favourites by slot" feature in W5-T02.

**Requirements:**

1. Export a `mutation` named `toggleFavouriteSlotTag` (or `addFavouriteSlotTag` + `removeFavouriteSlotTag` if cleaner).
2. Args: `canonicalName: v.string()`, `slot: mealSlotValidator` (import from validators.ts).
3. Auth: Use `ctx.auth.getUserIdentity()` to get the user, extract `tokenIdentifier` as userId.
4. Logic:
   - Query profile using `.withIndex("by_userId")`.
   - Read existing `foodFavouriteSlotTags` (a `Record<string, MealSlot[]>`).
   - Toggle: if the slot is already in the array for that food, remove it. If not, add it.
   - Also ensure the food is in `foodFavourites` array (add if missing when adding a slot tag, but DON'T remove from foodFavourites when removing a slot tag — that's a separate action).
   - Patch the profile with updated `foodFavouriteSlotTags` and `foodFavourites`.
5. Export a `query` named `getFavouriteSlotTags` that returns the full `foodFavouriteSlotTags` record for the authenticated user.

**Convex rules:**

- Use `mutation` (not `internalMutation`) — this is user-facing
- Use `.withIndex("by_userId")` for profile lookup
- Auth is required — throw if no identity

**Tests:** `convex/__tests__/favouriteSlotTags.test.ts` — extract the toggle logic as a pure function and test: add new food+slot, add second slot to same food, remove slot, ensure foodFavourites sync.

---

## Execution instructions

1. Use the `executing-plans` skill — load this plan, create tasks, execute in batches.
2. Read `convex/_generated/ai/guidelines.md` BEFORE writing any Convex code. Follow its rules over any code suggested in this prompt.
3. Run all 4 tasks. W2-T01 and W2-T02 are independent; W2-T03 depends on W2-T02 (needs canonical names); W2-T04 is independent.
4. After all tasks, run the full verification: `bun run format && bun run lint:fix && bun run typecheck && bun vitest run && bun run build`.
5. Commit with message: `feat(data): Wave 2 — seed clinicalRegistry, meal templates, favourite slot mutation`
6. Update `docs/WORK-QUEUE.md` with commit hashes for W2-T01 through W2-T04.
7. Write the Wave 3 next-session prompt to `docs/plans/next-session-prompt-5-wave3.md`.

## Commit message

```
feat(data): Wave 2 — seed clinicalRegistry, meal templates, favourite slot mutation

Seed static food registry into clinicalRegistry table. Backfill ~30
core post-surgery foods with full USDA/McCance macros. Add composite
meal templates (coffee+toast). Add toggleFavouriteSlotTag mutation
for meal-slot-scoped favourites.
```
