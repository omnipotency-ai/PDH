# Next Session Prompt 2: Execute Wave 0 — Schema Widening

> **Created:** 2026-04-08
> **Purpose:** Execute all 5 Wave 0 tasks (pure schema widening, no runtime changes).
> **Prerequisite:** Session 1 (docs) must be complete — branch exists, tracking docs updated.
> **Branch:** `feat/food-platform`

## Context

The Food Platform master plan was approved on 2026-04-08. Wave 0 is pure schema widening — all new fields are `v.optional()`, no migration needed, no runtime behavior changes.

**Master plan:** `docs/plans/food-platform-master-plan.md`
**Data shapes reference:** `docs/reference/data-shapes-snapshot.md`

## Architecture (for context only — do not re-derive)

3-layer model:

1. `clinicalRegistry` (NEW table) — global medical truth, never wiped during AI ops
2. `ingredientProfiles` (extended) — per-user product catalog
3. `logs` (extended) — productId links to exact brand used

`foodEmbeddings` stays as a pure vector search index — do NOT put clinical data there.

## What to read first

1. `docs/plans/food-platform-master-plan.md` — full plan with all 31 tasks
2. `convex/_generated/ai/guidelines.md` — MANDATORY before writing any Convex code
3. `convex/schema.ts` — current schema (the file you'll modify)
4. `convex/validators.ts` — current validators (the file you'll extend)
5. `docs/reference/data-shapes-snapshot.md` — current data shapes

## Wave 0 Tasks (5 tasks, all touch schema.ts + validators.ts)

### W0-T01: Create clinicalRegistry table

Create a new `clinicalRegistry` table in `convex/schema.ts`. This stores the global medical baseline for each canonical food — zone assignments, digestion metadata, default portions.

**Fields** (all from `FoodRegistryEntryBase` + `FoodDigestionMetadata` + `PortionData` in the static files):

```
canonicalName: v.string()          — unique identifier
zone: v.union(v.literal(1), v.literal(2), v.literal(3))
subzone: v.optional(v.union(v.literal("1A"), v.literal("1B")))
category: foodCategoryValidator     — "protein" | "carbohydrate" | "fat" | "dairy" | "condiment" | "drink" | "beverage"
subcategory: foodSubcategoryValidator — "meat" | "fish" | "egg" | ... (27 values)
group: foodGroupValidator           — reuse existing
line: foodLineValidator             — reuse existing
lineOrder: v.number()               — exploration order within line
macros: v.array(v.union(v.literal("protein"), v.literal("carbohydrate"), v.literal("fat")))
notes: v.optional(v.string())

// Portion defaults (from FOOD_PORTION_DATA)
defaultPortionG: v.optional(v.number())
naturalUnit: v.optional(v.string())
unitWeightG: v.optional(v.number())

// Digestion metadata (from FoodDigestionMetadata, all optional)
osmoticEffect: v.optional(osmoticEffectValidator)
totalResidue: v.optional(totalResidueValidator)
fiberTotalApproxG: v.optional(v.number())
fiberInsolubleLevel: v.optional(riskLevelValidator)
fiberSolubleLevel: v.optional(riskLevelValidator)
gasProducing: v.optional(gasProducingValidator)
dryTexture: v.optional(dryTextureValidator)
irritantLoad: v.optional(riskLevelValidator)
highFatRisk: v.optional(riskLevelValidator)
lactoseRisk: v.optional(riskLevelValidator)

createdAt: v.number()
updatedAt: v.number()
```

**Indexes**: `by_canonicalName: ["canonicalName"]`, `by_zone: ["zone"]`, `by_group_line: ["group", "line"]`

**Validators to create** in `convex/validators.ts`:

- `foodCategoryValidator` — union of 7 literals (protein, carbohydrate, fat, dairy, condiment, drink, beverage)
- `foodSubcategoryValidator` — union of all subcategory values from `shared/foodRegistryData.ts`
- `osmoticEffectValidator` — "none" | "low" | "low_moderate" | "moderate" | "moderate_high" | "high"
- `totalResidueValidator` — "very_low" | "low" | "low_moderate" | "moderate" | "high"
- `riskLevelValidator` — "none" | "low" | "moderate" | "high" (reuse for fiber, irritant, fat, lactose)
- `gasProducingValidator` — "no" | "possible" | "yes"
- `dryTextureValidator` — "no" | "low" | "yes"

Check `shared/foodRegistryData.ts` for the exact union values before writing validators. The types are already defined there — mirror them.

### W0-T02: Extend ingredientProfiles with product catalog fields

Add optional fields to the existing `ingredientProfiles` table:

```
customPortions: v.optional(v.array(customPortionValidator))   — [{label: "1 slice", weightG: 31.5}]
productName: v.optional(v.string())                           — "Bon Preu Seeded Bread"
barcode: v.optional(v.string())                               — for future barcode scanning
registryId: v.optional(v.id("clinicalRegistry"))              — link to clinical baseline
```

**New validator**: `customPortionValidator = v.object({ label: v.string(), weightG: v.number() })`

### W0-T03: Add productId to logs table

Add one optional field to the existing `logs` table:

```
productId: v.optional(v.id("ingredientProfiles"))
```

This links a food log entry to the exact brand/product used. When present, historical calorie calculations use this profile's nutrition data instead of guessing from canonicalName.

### W0-T04: Extend foodLibrary for composite meals

From old W0-T01. Add validators and optional fields for structured meal templates:

```
structuredIngredients: v.optional(v.array(structuredIngredientValidator))
modifiers: v.optional(v.array(mealModifierValidator))
sizes: v.optional(v.array(mealSizeValidator))
slotDefaults: v.optional(v.array(slotDefaultValidator))
```

See old execution plan `docs/plans/2026-04-06-food-page-and-meal-system-waves-0-1.json` task W0-T01 for the exact validator shapes (structuredIngredientValidator, mealModifierValidator, sizeAdjustmentValidator, mealSizeValidator, slotDefaultValidator).

### W0-T05: Add foodFavouriteSlotTags to profiles

From old W0-T03. Add to profiles table:

```
foodFavouriteSlotTags: v.optional(v.record(v.string(), v.array(mealSlotValidator)))
```

**New validator**: `mealSlotValidator = v.union(v.literal("breakfast"), v.literal("lunch"), v.literal("dinner"), v.literal("snack"))`

## Execution order

All 5 tasks modify `convex/schema.ts` and `convex/validators.ts`. Execute sequentially:

```
W0-T01 (clinicalRegistry) -> W0-T02 (ingredientProfiles) -> W0-T03 (logs) -> W0-T04 (foodLibrary) -> W0-T05 (profiles)
```

## Verification

After all 5 tasks: Run in this order, note the servers are open and running for convex and dev

```bash
bun run format           # clean
bun run lint:fix         # clean
bun run typecheck        # zero errors
bun run test             # tests updated to match current new reality, both vitest tests and e2e tests need to pass
bun run build            # clean
npx convex dev --once    # schema pushes successfully
```

Then commit:

```
feat(schema): Wave 0 — widen schema for Food Platform 3-layer architecture

- Create clinicalRegistry table (global medical truth)
- Extend ingredientProfiles with customPortions, productName, barcode, registryId
- Add productId to logs table (historical calorie integrity)
- Extend foodLibrary for composite meals (structuredIngredients, modifiers, sizes)
- Add foodFavouriteSlotTags to profiles
```

## After this session

Update tracking docs:

- Mark W0-T01 through W0-T05 as complete in `docs/WORK-QUEUE.md`
- Add WIP entry with commit hash
- Write next session prompt for Wave 1 following the same format as this prompt
- Next up: Wave 1 (bug fixes + data layer hook) — the highest user-impact work
