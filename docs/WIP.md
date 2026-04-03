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

### Wave 1: Meal Logging (Wave 0 complete, Wave 1 next)

**Status:** Wave 0 research complete (2026-04-03). 16 adversarial agents produced 4 cross-validated docs. User reviewed assumptions and made 5 decisions. Plan updated for Wave 1.
**Branch:** `feat/nutrition`
**PRD:** `docs/design/meal-logging.md`
**Decisions:** `memory/project_nutrition_card_decisions.md` + `memory/project_wave0_decisions.md`
**Plan:** `docs/plans/nutrition-card-implementation-plan.json` (needs updates per next-session-prompt)
**Research docs:** `docs/nutrition-card/*.md` (4 final + 12 raw analyses)
**Next session prompt:** `docs/design/next-session-prompt.md`

**Wave 0 completed tasks:**

- W0-01: Data model mapping (147 entries, mock→real gaps documented)
- W0-02: Pipeline integration (Option B confirmed — rawInput + empty items)
- W0-03: Fluid migration (3 presets mapped, water stays fluid)
- W0-04: Portion schema design (separate FOOD_PORTION_DATA, seeding strategy)

**Key Wave 0 user decisions:**

- New `type: "liquid"` log type (food, liquid, fluid)
- Coffee composite: 200ml water + 50ml skimmed milk + coffee = 250ml
- Calorie goal: 1,850 kcal/day
- FOOD_PORTION_DATA must be pre-populated (not empty)
- Fluid→liquid backfill migration needed

**Wave 1 in progress (Foundation):**

- W1-00: Add type="liquid" to schema — **DONE** (2026-04-03)
- W1-01: Populate FOOD_PORTION_DATA (all 147 entries, real data)
- W1-02: Add nutrition goals + favourites to profile
- W1-03: Build useNutritionData hook
- W1-04 (NEW): Backfill fluid→liquid migration

**Remaining waves:**

- Wave 2: Core UI (6 agents building components)
- Wave 3: Integration (wire to existing food pipeline)
- Wave 4: Migration (non-water drinks → food logging)
- Wave 5: Polish (dark mode, a11y, tests)

### Wave 2: Filter Bar (static data)

**Status:** design prompt exists at `docs/design/filter-prompt.md`
**Goal:** Composable filter bar on Patterns database page using classification + digestion risk data from static food registry.
**Dependency:** None — all data exists in `shared/foodRegistryData.ts`. Can run in parallel with Wave 1.

### Wave 3: Live User Data in Filter

**Status:** needs planning
**Goal:** Wire ingredientExposures + ingredientOverrides to filter bar (status column, exposure counts, user verdicts). Expand override enum from safe/watch/avoid to building/like/dislike/watch/avoid.
**Dependency:** Wave 2 (filter bar must exist first).

### Wave 4: Nutrition Enrichment

**Status:** needs planning
**Goal:** Batch job to populate ingredientProfiles.nutritionPer100g from OpenFoodFacts API, then wire kcal/fibre filters to filter bar.
**Dependency:** Wave 2 (filter bar) + ingredientProfiles infrastructure (already built).
