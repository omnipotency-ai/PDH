> **Ref:** `docs/plans/next-session-prompt.md`
> **Updated:** 2026-04-05
> **Version:** 1.0
> **History:** v1.0 (2026-04-05) — standardized doc header

# Next Session — Nutrition Card Remaining Work

## Context

Waves 0-3 complete. A 31-deviation spec fix (12 tasks) was executed on 2026-04-05, fixing architecture, increments, units, water modal, search, favourites, filter tabs, macros, match indicators, old section removal, and visual polish. Branch is ready for remaining Wave 4 items and Wave 5 polish.

**Branch:** `feat/nutrition`
**HEAD:** `809771c` (E2E test committed)
**Tests:** 1414 passing, 0 failures (2026-04-05)

## What to read first

1. `docs/plans/2026-04-05-nutrition-card-fix.md` — the 12-task fix plan (all complete)
2. `docs/plans/nutrition-card-implementation-plan.json` — original 6-wave plan
3. `memory/project_nutrition_card_decisions.md` — all 22 locked visual + behavioral decisions
4. `memory/project_meal_logging_prd_complete.md` — full project status
5. `docs/WIP.md` — wave-by-wave progress log

## Current state

### Spec Deviation Fix — COMPLETE (2026-04-05)

12 tasks executed via sequential/parallel agent dispatch. Key commits:

| Commit  | What                                                                  |
| ------- | --------------------------------------------------------------------- |
| 714d586 | Architecture: remove view switching, collapsed card permanent         |
| d22a634 | Parallel batch: increments 50g/50ml, water modal, filter tabs, macros |
| c909f29 | "Logging to: Meal" auto-detect + search zero-state                    |
| ca9dafb | Heart-to-favourite toggle on food rows and search results             |
| 3c37f33 | Zone badges + explicit + button on search results                     |
| 1b2fedc | Match status indicators (green/orange) + unknown food toast           |
| 710672f | Visual polish: 2-drop water icon, button alignment                    |
| 809771c | E2E test: 15-step full nutrition flow                                 |

### Key Architecture Changes (from this session)

- **Collapsed card is PERMANENT** — calorie ring, search bar, log food button, water progress bar are ALWAYS visible. No view switching.
- **NutritionView type** is now `"none" | "favourites" | "foodFilter" | "calorieDetail"` — content appears below the water bar
- **All increments** are flat 50g (solids) or 50ml (liquids)
- **Liquids** always display "ml" suffix, never "g" or "cups"
- **Amount field** in staging modal is editable (click to type custom value)
- **Search is inline** — results appear below water bar, zero-state shows recent foods on focus
- **Filter tabs** are now Recent / Frequent / All (Favourites tab removed — redundant with heart icon)
- **Old FoodSection + FluidSection** removed from Track page rendering

### Remaining Work

#### W4-01: Migrate non-water drinks to food suggestions

Add "Common Drinks" section in search zero-state from food registry (hot_drink, juice, fizzy_drink subcategories).

#### W4-03: Update TodayLog for nutrition card data

Ensure logged foods/fluids display correctly with mealSlot badge, portion + calorie info.

#### Wave 5: Polish

- Dark mode audit
- Accessibility hardening (aria, focus management)
- Edge cases and error states
- Full regression (all E2E tests pass)

#### Open review findings worth addressing

| #   | Issue                                | Priority  |
| --- | ------------------------------------ | --------- |
| 32  | Hardcoded teal #42BCB8 not tokenized | IMPORTANT |
| 42  | capitalize utility duplicated        | MINOR     |
| 47  | MACRO_PILL_CONFIG colors copy-pasted | MINOR     |

## On next session start

1. Read this file + the fix plan
2. Run `bun run test` to confirm 1414 passing
3. Browser-test the app via Claude-in-Chrome to verify visual fidelity against annotated screenshots
4. Start W4-01 (drink suggestions) and W4-03 (TodayLog)
5. Dispatch Agent T for shared constants (#32, #42, #47)

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
- **CircularProgressRing** now supports 3-segment display (consumed/toAdd/remaining)
- **StagedItem** has `isLiquid: boolean` flag for unit display logic
- **Reduce-to-0** via minus button removes item from staging (reducer handles it)

## Verification commands

```bash
bun run typecheck
bun run build
bun run lint:fix
bun run test
bun run format
```
