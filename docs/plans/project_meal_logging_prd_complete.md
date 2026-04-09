## Branch & Verification

- **Branch:** `feat/nutrition`
- **Tests:** 1414 passing, 51 test files
- **Verification commands:** `bun run typecheck`, `bun run build`, `bun run lint:fix`, `bun run test`, `bun run format`
- **Plan (original):** `docs/plans/nutrition-card-implementation-plan.json` (v3.0, 32 tasks, 6 waves)
- **Plan (fix):** `docs/plans/2026-04-05-nutrition-card-fix.md` (12 tasks fixing 31 spec deviations)
- **Decisions:** `memory/project_nutrition_card_decisions.md` (22 locked) + `memory/project_wave0_decisions.md`

## 2026-04-05: Spec Deviation Fix (12 tasks)

Browser audit revealed 31 deviations from the 22 locked decisions. 12-task fix plan created and executed via sequential/parallel agent dispatch.

### Completed (10/12)

| Task | What                                                                   | Commit    |
| ---- | ---------------------------------------------------------------------- | --------- |
| T1   | Architecture: remove view switching, collapsed card permanent          | 714d586   |
| T2   | Staging increments 50g/50ml, editable amounts, liquid units=ml         | d22a634   |
| T3   | Water modal: 3-segment ring, 50ml step, remove Cancel, goal text color | d22a634   |
| T4   | "Logging to: Meal" auto-detect label + search zero-state               | c909f29   |
| T5   | Heart-to-favourite toggle on food rows and search results              | ca9dafb   |
| T6   | Remove Favourites tab from filter → Recent/Frequent/All                | d22a634   |
| T7   | Zone badges + explicit + button on search results                      | 3c37f33   |
| T8   | CalorieDetailView per-item macros: all 5 values                        | d22a634   |
| T9   | Match status indicators (green/orange) + unknown food toast            | committed |
| T10  | Remove old FoodSection + FluidSection from Track page                  | d22a634   |

### In Progress

| Task | What                                                     | Status        |
| ---- | -------------------------------------------------------- | ------------- |
| T11  | Visual polish (2-drop icon, button alignment, dark mode) | Agent running |
| T12  | E2E test for full nutrition flow (15 steps)              | Pending T11   |

### Key Architecture Change

The collapsed card (calorie ring, search bar, log food button, water progress) is now **always visible**. Search results, filters, favourites, and calorie detail all render BELOW the water bar. The old `SET_VIEW: "search"` / `"collapsed"` view switching was completely removed. `NutritionView` type is now `"none" | "favourites" | "foodFilter" | "calorieDetail"`.

### Key Behavioral Fixes

- All increments: flat 50g (solids) or 50ml (liquids)
- Liquid foods always show "ml" suffix, never "g" or "cups"
- Amount field in staging modal is editable (click to type custom value)
- Re-adding same food from search adds full defaultPortionG
- Reduce-to-0 via minus button removes item from staging
- Water modal: 3-segment ring (consumed/preview/remaining), 50ml step
- Search zero-state shows recent foods on focus
- "Logging to: Breakfast/Lunch/Dinner/Snack" auto-detect label
- Heart toggle for favouriting foods from any view
- Zone badges (Z1-Z3) on search results
- Green check / orange alert match status in staging modal

## Previous Waves (unchanged)

Wave 0 (Research): COMPLETE — 4 cross-validated docs
Wave 1 (Foundation): COMPLETE — schema, FOOD_PORTION_DATA, goals, hooks
Wave 2 (Core UI): COMPLETE — all 6 components built and wired
Wave 3 (Integration): COMPLETE — pipeline wiring, error boundary, E2E test

## Remaining Work

- W4-01: Migrate non-water drinks to food suggestions
- W4-03: Update TodayLog for nutrition card data
- Wave 5: Polish, accessibility, edge cases

**How to apply:** After T11+T12 complete, the spec-deviation fix is done. Remaining work is W4 drink migration and W5 polish from the original plan.
