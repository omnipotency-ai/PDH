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

**Status:** round 2 worktree agents running (2026-04-02)
**PRD:** merged to main — `docs/design/meal-logging.md`
**Goal:** Reduce daily logging friction — saved meals, quick-log by meal slot (breakfast/lunch/dinner/snack), favourites, water tracking, calorie breakdown.
**Architecture:** Home screen Nutrition card + modal (not standalone /food route). Progressive disclosure: collapsed card → expanded search → staging modal.

**Key design decisions:**

- Shopping cart pattern with listed rows (+/- portion controls), not chips
- Recipes = extended foodLibrary composites (no new table)
- Meal slots auto-detected by time of day, user can override
- Water logging via separate modal with blue accent
- 1800 kcal/day goal with per-slot breakdown

**Round 1 (completed):** 4 agents built standalone `/food` chip-based builder. V1 and V4 kept for reference. All had Zustand + React 19 infinite loop bug (fixed).
**Round 2 (complete 2026-04-03):** 4 agents finished. User did extensive browser testing with annotated screenshots. Individual reports + overview comparison written.

**Comparison results:**

- A: Best architecture (modular/useReducer), centered modals, correct dark mode, favourites
- B: Best live search, inline staging feedback, auto-detected meal label — but staging lost on close
- C: Best water colours (cyan), cleanest visual — but dark mode broken, monolithic code
- D: Best accessibility, global escape, block text parsing — but 1001-line component
- Round 1 V4: Natural unit portions + 6-value macro bar (kcal/protein/carbs/fat/fibre/sugar)

**Reports:** `docs/plans/Worktree spec/report-agent-{a,b,c,d}.md`, `report-overview.md`, `research-food-filter-patterns.md`
**User annotations:** `docs/plans/Worktree spec/user-annotations/` (images 12-19)

**Next:** Walk through 22 component decisions (visual vs behavioral) one at a time. Then build final combined implementation. See memory file `project_round2_next_session.md` for full agenda.

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
