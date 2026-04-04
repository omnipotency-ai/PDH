# Next Session — Wave 3 Integration + PR Review

## TL;DR

Wave 2 is complete on `feat/nutrition`. PR needs creating + opus review. Then Wave 3 remaining tasks: error boundary, integration E2E test. Several W3 tasks are already done from W2 wiring work.

## Current State

- **Branch:** `feat/nutrition`
- **HEAD:** `d2f45e3` (all W2 work complete)
- **Tests:** 1370 passing (51 files), typecheck + build clean
- **W2 status:** All 6 tasks complete, all handlers wired, 4 E2E spec files, cleanup done
- **PR:** Not yet created

## Step 1: Create PR + dispatch review agents

```bash
git push -u origin feat/nutrition
gh pr create --title "feat: Nutrition Card — Wave 2 complete" --body "$(cat <<'EOF'
## Summary
- NutritionCard with collapsed/expanded calorie detail views
- WaterModal (cyan #42BCB8 ring, +/- 200ml, wired to Convex fluid logging)
- LogFoodModal (staging confirmation with macro totals, wired to Convex food logging)
- CalorieDetailView (meal breakdown bar, macros, one-at-a-time accordions, delete wired)
- FavouritesView + FoodFilterView (Recent|Frequent|Favourites|All tabs)
- useNutritionStore (useReducer + Fuse.js search, staging aggregation)
- useNutritionData (read-only Convex: calories, water, macros, meal slots)
- Shared nutritionUtils.ts (extracted from duplicate code)
- getCurrentMealSlot + meal-slot-scoped recentFoods with global fallback
- Dead waterAmount/SET_WATER_AMOUNT state removed from store
- 4 new Playwright E2E spec files (~50 tests total)

## Test plan
- [x] Typecheck, build, 1370 unit tests pass
- [ ] Visual verification on localhost:3005
- [ ] Water modal: open, adjust amount, log → appears in today log
- [ ] Food staging: search → add → review in modal → log → appears in today log
- [ ] Delete: expand calorie detail → accordion → delete button removes entry
- [ ] Escape key returns to collapsed from any expanded view
- [ ] Favourites: heart icon → list → add to staging
- [ ] Filter tabs: Recent | Frequent | Favourites | All switch correctly

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Then dispatch 2 opus agents reviewing the full diff (`git diff main...HEAD`):

1. **Code quality reviewer** — security, correctness, performance, React patterns, accessibility
2. **Architecture reviewer** — component boundaries, state management, data flow, future extensibility

## Step 2: Wave 3 remaining tasks

Several W3 tasks are already done from W2 work. Here's the updated status:

| Task  | Title                                    | Status                                                                    |
| ----- | ---------------------------------------- | ------------------------------------------------------------------------- |
| W3-01 | Wire Log Food to food parsing pipeline   | **DONE** — handleLogFood wired in 649aade                                 |
| W3-02 | Wire WaterModal to fluid logging         | **DONE** — handleLogWater wired in 649aade                                |
| W3-03 | Wire match status to FoodMatchingModal   | **DEFERRED** — all staging items pre-matched from registry                |
| W3-04 | Add error boundary around NutritionCard  | **TODO** — wrap in NutritionCardErrorBoundary                             |
| W3-05 | Mount NutritionCard in Track page        | **DONE** — mounted in 41e09d9, needs error boundary wrapping              |
| W3-06 | Wire inline feedback badge + live search | **PARTIALLY DONE** — staging count badge added in 1635d1d, search working |
| W3-07 | End-to-end integration test              | **TODO** — full flow: search → stage → log → verify in today log          |

### Agent prompt: W3-04 Error Boundary

```
Add an error boundary around NutritionCard in Track.tsx. This is a food reintegration tracker app (PDH).

## Files to read:
1. src/pages/Track.tsx — find where NutritionCard is rendered
2. src/components/ui/ErrorBoundary.tsx — existing error boundary component
3. src/components/track/nutrition/NutritionCard.tsx — what it renders

## Task:
1. Wrap the NutritionCard in Track.tsx with ErrorBoundary (or create NutritionCardErrorBoundary if needed)
2. The fallback should show a calm, minimal error state — not a scary crash screen
3. The error boundary should NOT break the rest of the Track page if NutritionCard fails

## Constraints:
- Use the existing ErrorBoundary component if it supports custom fallback
- Run: bun run typecheck && bun run build && bun run test
- Commit with message: "feat: add error boundary around NutritionCard (W3-04)"
```

### Agent prompt: W3-07 Integration E2E

```
Write a Playwright E2E integration test for the full nutrition logging flow. This is a food reintegration tracker (PDH).

## Files to read:
1. e2e/nutrition-card.spec.ts — existing test patterns
2. e2e/nutrition-water-modal.spec.ts — water modal test patterns
3. e2e/nutrition-logfood-modal.spec.ts — logfood modal test patterns
4. src/components/track/nutrition/NutritionCard.tsx — the orchestrator

## Test to write in e2e/nutrition-integration.spec.ts:
Full flow test:
1. Navigate to Track page
2. NutritionCard renders in collapsed state
3. Search for a food (type 3+ chars)
4. Select a search result (adds to staging)
5. Open LogFoodModal (click Log Food button)
6. Verify staged items appear with macros
7. Click "Log Food" to submit
8. Verify toast confirmation
9. Expand CalorieDetailView (tap ring)
10. Verify the logged food appears in the correct meal slot accordion

Water flow test:
1. Open WaterModal
2. Adjust amount
3. Log water
4. Verify toast + water progress bar updates

## Constraints:
- Follow existing e2e test patterns (import from ./fixtures)
- Run: bunx playwright test e2e/nutrition-integration.spec.ts
- Commit with message: "test: add full nutrition flow integration E2E test (W3-07)"
```

## Key files

| File                                                   | Purpose                                           |
| ------------------------------------------------------ | ------------------------------------------------- |
| `src/components/track/nutrition/NutritionCard.tsx`     | Main orchestrator (~580 lines)                    |
| `src/components/track/nutrition/CalorieDetailView.tsx` | Expanded view with breakdown/macros/accordions    |
| `src/components/track/nutrition/WaterModal.tsx`        | Water logging modal (cyan #42BCB8)                |
| `src/components/track/nutrition/LogFoodModal.tsx`      | Staging confirmation modal                        |
| `src/components/track/nutrition/FavouritesView.tsx`    | Favourites list                                   |
| `src/components/track/nutrition/FoodFilterView.tsx`    | Filter tabs (Recent/Frequent/Favourites/All)      |
| `src/components/track/nutrition/useNutritionStore.ts`  | UI state (useReducer + Fuse.js)                   |
| `src/components/track/nutrition/nutritionUtils.ts`     | Shared utils (titleCase, formatPortion, calories) |
| `src/hooks/useNutritionData.ts`                        | Read-only Convex data + meal-slot-scoped recents  |
| `src/lib/nutritionUtils.ts`                            | getCurrentMealSlot (time-of-day determination)    |
| `src/hooks/useProfile.ts`                              | Nutrition goals + favourites                      |
| `e2e/nutrition-*.spec.ts`                              | 4 E2E spec files                                  |

## After Wave 3

- **Wave 4:** Migration — non-water drinks to food logging, remove old FoodSection/FluidSection
- **Wave 5:** Polish — dark mode audit, a11y hardening, edge cases, full regression
