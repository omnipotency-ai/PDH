# Next Session — Nutrition Card Wave 4 (Migration)

## Context

Waves 0-3 are fully complete. A 12-agent code review produced 84 findings; 55 are fixed, 29 remain open.
Wave 3-07 (E2E integration test) is done. The branch is ready for Wave 4 (Migration).

**Branch:** `feat/nutrition`
**HEAD:** `2af90ae` (review status docs committed)
**Tests:** 1412 passing, 0 failures (2026-04-04)

## What to read first

1. `docs/plans/nutrition-card-implementation-plan.json` — full plan with task status + `review_fixes_applied` section
2. `docs/plans/Worktree spec/2026-04-04/consolidated-review-full.md` — IMPORTANT findings with FIXED/OPEN status
3. `docs/plans/Worktree spec/2026-04-04/consolidated-review.md` — MINOR + NICE-TO-HAVE findings with FIXED/OPEN status
4. `memory/project_nutrition_card_decisions.md` — all 22 locked visual + behavioral decisions
5. `docs/WIP.md` — wave-by-wave progress log

## Current state

### Wave 3: Integration — COMPLETE

All 7 tasks done. Key commits this session:

| Commit  | What                                                                                                    |
| ------- | ------------------------------------------------------------------------------------------------------- |
| 034636f | Wave 3-4 review fixes — id-based callbacks, Frequent tab, useProfile cleanup                            |
| 8abdc96 | NutritionCard — stable Escape listener via viewRef, memoize headerIcons                                 |
| 965c376 | LogFoodModal — Base UI Dialog, pass stagingTotals as prop, memo FoodItemRow                             |
| 5f2b6e2 | NutritionCardErrorBoundary (W3-04)                                                                      |
| 15c3c6e | CalorieDetailView — animation, type safety, memoization, stable keys                                    |
| af109ac | useNutritionStore — FUSE_OPTIONS, exhaustive reducer, registry validation, titleCase, portionG clamping |
| d5dab23 | WaterModal — CircularProgressRing, cap 100%, no negative remaining                                      |
| b18b8ae | FoodFilterView — tab count badges                                                                       |
| 2c91729 | W3-07 full nutrition flow E2E (13-step)                                                                 |

### Wave 4: Migration — NEXT UP

Three tasks, all pending:

1. **W4-01: Migrate non-water drinks to food suggestions** — add Common Drinks section in search zero-state from food registry (hot_drink, juice, fizzy_drink subcategories). Remove FluidSection non-water presets.
2. **W4-02: Remove old FoodSection and FluidSection from Track** — clean up now that NutritionCard replaces both.
3. **W4-03: Update TodayLog for nutrition card data** — ensure logged foods/fluids display correctly in the daily timeline.

### Wave 5: Polish — AFTER W4

Four tasks: dark mode audit, accessibility hardening, edge cases, full regression.

### Open review findings worth addressing alongside Wave 4

| #   | Issue                                | Priority  |
| --- | ------------------------------------ | --------- |
| 22  | WaterModal dual keydown listeners    | IMPORTANT |
| 23  | WaterModal amountRef workaround      | IMPORTANT |
| 32  | Hardcoded teal #42BCB8 not tokenized | IMPORTANT |
| 42  | capitalize utility duplicated        | MINOR     |
| 47  | MACRO_PILL_CONFIG colors copy-pasted | MINOR     |

Agent T (#32, #42, #47) was not dispatched yet — these are quick wins.

## On next session start

1. Read this file + the plan JSON
2. Run `bun run test` to confirm 1412 passing
3. Start Wave 4 tasks (can parallelize W4-01 and W4-02 since they touch different files)
4. Dispatch Agent T for shared constants (#32, #42, #47) alongside Wave 4

## Key architecture facts (do not re-derive)

- **Option B for pipeline**: send `rawInput` + `items: []` to trigger server matching
- **Registry has 147 entries** (not 148)
- **canonicalName is optional AND nullable** — UI must handle missing lookups gracefully
- **ingredientProfiles is per-user, starts empty** — static FOOD_PORTION_DATA is the global fallback
- **fiberPer100g in code, "Fibre" in UI** — US spelling in identifiers, UK in display
- **MacroBreakdown nulls mean "no data"** — distinguish from zero grams
- **MealSlot is lowercase** — "breakfast", "lunch", "dinner", "snack"
- **"Other" freeform drink button removed** — non-water drinks go through food search
- **QuickCapture fluid habits stay as-is** (`logAs` only accepts "habit" | "fluid", no "food")
- **CircularProgressRing** is now a shared component — reusable for calories/activity rings

## Verification commands

```bash
bun run typecheck
bun run build
bun run lint:fix
bun run test
bun run format
```
