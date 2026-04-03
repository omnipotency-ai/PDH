# Next Session — Nutrition Card Wave 1 (Foundation)

## Context

Wave 0 research is complete. 16 agents (3 independent + 1 validator × 4 tasks) produced cross-validated docs. All findings verified against source code. Branch: `feat/nutrition`.

## What to read first

1. `memory/project_wave0_decisions.md` — user decisions from end of Wave 0 session
2. `memory/project_nutrition_card_decisions.md` — all 22 locked visual + behavioral decisions
3. `docs/nutrition-card/data-model-mapping.md` — definitive mock → real mapping
4. `docs/nutrition-card/pipeline-integration.md` — how to call the food pipeline (Option B)
5. `docs/nutrition-card/fluid-migration.md` — preset migration table
6. `docs/nutrition-card/portion-schema-design.md` — interfaces, field mapping, seeding strategy
7. `docs/plans/nutrition-card-implementation-plan.json` — the 30-task plan (needs updates below)

## Plan updates required before starting

The original plan needs these additions based on user decisions:

### New: `type: "liquid"` log type

- Add `"liquid"` to LogType union in `convex/validators.ts`, `src/types/domain.ts`
- Update `convex/schema.ts` if LogType is referenced
- Update all consumers of LogType (SyncedLogsContext, syncCore, TodayLog groups)
- This is a schema-level change — do it first in Wave 1

### New: Fluid → liquid backfill migration

- All existing `type: "fluid"` logs where name ≠ "Water" must be updated to `type: "liquid"`
- Use Convex migration pattern (widen-migrate-narrow or batch mutation)
- Water logs stay as `type: "fluid"`

### New: Coffee composite in food registry

- Coffee = composite: 200ml water + 50ml skimmed milk + coffee
- Default portion: 250ml
- QuickCapture coffee tap should create a `type: "liquid"` log (not fluid)
- Wire this in Wave 3 (Integration) alongside other QuickCapture changes

### Changed: FOOD_PORTION_DATA must be pre-populated

- The plan assumed this could start empty. User said NO — all 147 entries need real data.
- This becomes a Wave 1 task: research + populate `shared/foodPortionData.ts` with:
  - Nutrition per 100g from USDA FoodData Central / Open Food Facts
  - Default portion sizes in grams
  - Natural units with gram equivalents (tsp=5g, tbsp=15g, slice bread≈30g, etc.)
- DO NOT hallucinate values. Use verified external data sources.
- This blocks Wave 2 UI work (can't show calories without data).

### Changed: Default calorie goal

- 1,850 kcal/day (not 1,800). Based on user's actual stats: male, 52y, 186cm, 105kg, sedentary.
- Water goal: 1,000ml (unchanged).

## Revised Wave 1 task order

1. **W1-00 (NEW): Add `type: "liquid"` to schema** — validators, domain types, schema, all consumers
2. **W1-01: Populate FOOD_PORTION_DATA** — research real data, populate all 147 entries, create utility functions (TDD)
3. **W1-02: Add nutrition goals + favourites to profile schema** — calorieGoal default 1,850, waterGoalMl 1,000
4. **W1-03: Build useNutritionData hook** — reads from SyncedLogs, handles food + liquid + fluid types
5. **W1-04 (NEW): Backfill fluid → liquid migration** — batch mutation for non-water fluid logs

Tasks W1-00 and W1-01 can run in parallel (no file conflicts). W1-02 depends on W1-00 (schema). W1-03 depends on W1-00 + W1-01 + W1-02. W1-04 depends on W1-00.

## Key research findings to remember

- **Option B for pipeline**: send `rawInput` + `items: []` to trigger server matching
- **Registry has 147 entries** (not 148)
- **canonicalName is optional AND nullable** — UI must handle missing lookups grac- **ingredientProfiles is per-user, starts empty** — static FOOD_PORTION_DATA is the global fallback
- **fiberPer100g in code, "Fibre" in UI** — US spelling in identifiers, UK in display
- **MacroBreakdown nulls mean "no data"** — distinguish from zero grams
- **MealSlot is lowercase** — "breakfast", "lunch", "dinner", "snack"
- **Aquarius → "electrolyte drink"** (250ml), needs adding to examples array
- **"Other" freeform drink button removed** — non-water drinks go through food search
- **QuickCapture fluid habits stay as-is** (`logAs` only accepts "habit" | "fluid", no "food")

## Verification commands

```
bun run typecheck
bun run build
bun run lint:fix
bun run test
bun run format
```

## Branch

`feat/nutrition` — commit to this branch, not adams-rib.
