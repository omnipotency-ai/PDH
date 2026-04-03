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

### Wave 1: Meal Logging (in progress)

**Status:** All 22 decisions locked. Implementation plan written. Ready for execution (2026-04-03).
**PRD:** `docs/design/meal-logging.md`
**Decisions:** `memory/project_nutrition_card_decisions.md`
**Plan:** `docs/plans/nutrition-card-implementation-plan.json` (26 tasks, 6 waves)
**Next session prompt:** `docs/design/next-session-prompt.md`

**Base:** Agent A's worktree (modular, useReducer, 9 files). Color = D's orange. Water = C's cyan.

**Implementation approach:** 6 waves of parallel agents:

- Wave 0: Research (4 agents, read-only analysis docs)
- Wave 1: Foundation (schema, registry, data hooks)
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
