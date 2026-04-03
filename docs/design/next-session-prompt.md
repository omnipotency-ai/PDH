# Next Session — Nutrition Card Wave 2 (Core UI)

## Context

Wave 0 (Research) and Wave 1 (Foundation) are complete on `feat/nutrition` branch. PR #2 is open for merge to main. All work is additive — no existing behavior changed.

## What to read first

1. `docs/plans/nutrition-card-implementation-plan.json` (v3.0) — the master plan, Wave 0+1 marked complete
2. `memory/project_nutrition_card_decisions.md` — all 22 locked visual + behavioral decisions
3. `memory/project_wave0_decisions.md` — user decisions: type=liquid, coffee composite, 1850kcal, portions pre-populated
4. `memory/feedback_subagent_model_choice.md` — use opus for implementers + quality reviewers, haiku for spec reviewers

## What was built in Wave 1

- **`shared/logTypeUtils.ts`** — `isFoodPipelineType()` helper (centralised food/liquid check)
- **`shared/foodPortionData.ts`** — 147 entries, USDA nutrition per 100g, portion sizes
- **`shared/foodRegistryUtils.ts`** — `getPortionData`, `calculateCaloriesForPortion`, `calculateMacrosForPortion`
- **`src/lib/nutritionUtils.ts`** — `getMealSlot`, `calculateTotalCalories`, `calculateTotalMacros`, `groupByMealSlot`, `calculateWaterIntake`
- **`src/hooks/useNutritionData.ts`** — read-only hook: todayFoodLogs, totalCaloriesToday, totalMacrosToday, waterIntakeToday, caloriesByMealSlot, logsByMealSlot, recentFoods
- **`src/hooks/useProfile.ts`** — `useNutritionGoals()` (1850kcal, 1000ml defaults), `useFoodFavourites()` (add/remove/isFavourite)
- **`convex/migrations.ts`** — `backfillFluidToLiquid` (ready to run, not yet executed)
- **Profile schema** — `nutritionGoals` + `foodFavourites` optional fields on profiles table

## Wave 2 task order

1. **W2-01: useNutritionStore** — useReducer-based UI state (view, searchQuery, stagingItems, modals, mealSlot). Fuse.js search (threshold 0.4, min 3 chars). Staging aggregates same canonicalName. Staging persists across view changes. **Must complete before W2-02 through W2-06.**
2. **W2-02: NutritionCard (collapsed)** — header, calorie summary bar, search input, log food button, water progress. Uses useNutritionData + useNutritionStore.
3. **W2-03: SearchView** — meals first then foods in results, camera+mic icons, auto-detect meal slot label.
4. **W2-04: StagingModal** — centered, food rows with -/+/cal/X, 5 macro totals, match indicators.
5. **W2-05: WaterModal** — centered, ring animation, plus/minus, cyan/teal theme, escape to close.
6. **W2-06: CalorieDetailView** — segmented color bar by meal slot, per-slot calories, 5 macro columns, accordions.

W2-02 through W2-06 can run in parallel after W2-01 completes (they all depend on the store but not each other).

## Before starting Wave 2

- Merge PR #2 to main (or continue on feat/nutrition)
- Run `backfillFluidToLiquid` migration on dev data
- Agent A's worktree files are reference only: `.claude/worktrees/agent-a31ddf8f/`

## Subagent strategy (learned this session)

- **Opus for implementers** — sonnet ran out of context 3 of 4 times, requiring manual cleanup
- **Haiku for spec reviewers** — checklist comparison works fine at haiku tier
- **Opus for quality reviewers** — catches real architectural bugs (found 20 missed food pipeline consumers)
- **Sonnet for targeted fix agents** — narrow scope, works fine

## Verification commands

```
bun run typecheck
bun run build
bun run lint:fix
bun run test:unit
bun run format
```

## Branch

Continue on `feat/nutrition` or create `feat/nutrition-ui` for Wave 2.
