# Work In Progress — Sprint Execution Log

> Updated by agents as tasks complete. Maintained until all sprints are done.

**Started:** 2026-03-17

---

## Sprint 0: Ship Blockers

### WQ-319: Dr. Poo Quality Verification

**Status:** in progress
**Summary:** Comparison doc at docs/verification/wq-319-drpoo-quality-comparison.md. Real before/after data being collected over 1-2 days.

### Phase 3: Architecture Consolidation

**WQ-098: buildFoodEvidenceResult server-only**
**Status:** blocked — client needs trial-level detail not in schema. Fix path documented.

---

## Adams Rib Branch (2026-04-01)

### Completed cleanup

- Stripped 4 dead AI insight fields (lifestyleExperiment, likelySafe, nextFoodToTry, miniChallenge) from entire pipeline
- Removed ParsedItem (dead client-side DTO) and aligned food logging signatures
- Deleted migrateLegacyStorage + LegacyMigration component
- Sunset gpt-5.2 model (legacy alias now maps to gpt-5.4 on backup import)
- Tailwind v4 syntax modernisation in routeTree.tsx and UiMigrationLab.tsx
- Fixed .gitignore for .vite/ cache directory
- Cleaned docs (README.md, chores.html, WIP.md completed items)

### Ingredient systems — investigated, all kept

All 4 ingredient subsystems confirmed as pre-built infrastructure for filter prompt design (`docs/design/filter-prompt.md`). None deleted. Details in memory: `project_ingredient_systems_audit.md`.

---

## Upcoming Work Queue

### feat/nutrition — Meal Logging Refactor

**Branch:** `feat/nutrition`
**PRD:** `docs/design/meal-logging.md`
**Decisions:** `memory/project_nutrition_card_decisions.md` + `memory/project_wave0_decisions.md`
**Plan (original):** `docs/plans/nutrition-card-implementation-plan.json`
**Plan (fix):** `docs/plans/2026-04-05-nutrition-card-fix.md`
**Test count:** 1414 passing, 0 failures (as of 2026-04-05)

---

#### Wave 0: Research — COMPLETE (2026-04-03)

- W0-01: Data model mapping (147 entries, mock→real gaps documented)
- W0-02: Pipeline integration (Option B confirmed — rawInput + empty items)
- W0-03: Fluid migration (3 presets mapped, water stays fluid)
- W0-04: Portion schema design (separate FOOD_PORTION_DATA, seeding strategy)

User decisions: `type: "liquid"` log type, coffee composite, 1,850 kcal/day goal, pre-populated FOOD_PORTION_DATA, fluid→liquid backfill.

---

#### Wave 1: Foundation — COMPLETE (commits 95b3032, f346aba, 74e2489)

- W1-00: Add type="liquid" to schema + all consumers — **DONE** (`a8f21d0` + `1cf848c`)
- W1-01: Populate FOOD_PORTION_DATA (147 entries, real USDA data) — **DONE** (`38267d5` + `1ac20e7`)
- W1-02: Add nutrition goals + favourites to profile — **DONE** (`f471c58`)
- W1-03: Build useNutritionData hook + pure utils — **DONE** (`c261f67`)
- W1-04: Backfill fluid→liquid migration — **DONE** (`3cedd80`)

---

#### Wave 2: Core UI — COMPLETE (commits 7daece1, 2bd26e5, 23cfee6, 8ad0790)

- useNutritionStore: consolidated macros, portion cap, search perf, type safety — **DONE** (`2bd26e5`)
- CalorieDetailView: consolidated macros, typed props, memo accordion — **DONE** (`23cfee6`)
- useNutritionData: stale todayKey/mealSlot fix, FoodPipelineLog types — **DONE** (`7daece1`)
- FavouritesView + FoodRow: shared FoodRow, filterToKnownFoods — **DONE** (`8ad0790`)
- nutritionUtils: consolidated shared meal slot + formatting utilities — **DONE** (`95b3032`)

---

#### Wave 3: Integration — COMPLETE (2026-04-04)

- W3-01: Wire Log Food button to food pipeline — **DONE** (`034636f`)
- W3-02: Wire WaterModal to fluid logging — **DONE** (`034636f`)
- W3-03: Wire staging match status — **DONE** (`034636f`)
- W3-04: Error boundary — **DONE** (`5f2b6e2`)
- W3-05: Mount NutritionCard in Track page — **DONE** (`034636f`)
- W3-06: Wire inline feedback badge + live search — **DONE** (`034636f`)
- W3-07: Full E2E integration test — **DONE** (`2c91729`)

---

#### Spec Deviation Fix — COMPLETE (2026-04-05)

Browser audit revealed 31 deviations from the 22 locked decisions. 12-task fix plan created and executed.

| Task | What                                                                   | Commit    |
| ---- | ---------------------------------------------------------------------- | --------- |
| T1   | Architecture: remove view switching, collapsed card permanent          | `714d586` |
| T2   | Staging increments 50g/50ml, editable amounts, liquid units=ml         | `d22a634` |
| T3   | Water modal: 3-segment ring, 50ml step, remove Cancel, goal text color | `d22a634` |
| T4   | "Logging to: Meal" auto-detect label + search zero-state               | `c909f29` |
| T5   | Heart-to-favourite toggle on food rows and search results              | `ca9dafb` |
| T6   | Remove Favourites tab from filter → Recent/Frequent/All                | `d22a634` |
| T7   | Zone badges + explicit + button on search results                      | `3c37f33` |
| T8   | CalorieDetailView per-item macros: all 5 values                        | `d22a634` |
| T9   | Match status indicators (green/orange) + unknown food toast            | `1b2fedc` |
| T10  | Remove old FoodSection + FluidSection from Track page                  | `d22a634` |
| T11  | Visual polish: 2-drop water icon, button alignment                     | `710672f` |
| T12  | E2E test: 15-step full nutrition flow                                  | `809771c` |

---

#### Wave 4: Migration — PARTIALLY DONE

- W4-01: Migrate non-water drinks to food suggestions — **PENDING**
- W4-02: Remove old FoodSection and FluidSection from Track — **DONE** (T10 in spec fix, `d22a634`)
- W4-03: Update TodayLog for nutrition card data — **PENDING**

---

#### Wave 5: Polish — PENDING

- W5-01: Dark mode and CSS variable audit
- W5-02: Accessibility hardening
- W5-03: Edge cases and error states
- W5-04: Full regression: all tests pass, all E2E pass
