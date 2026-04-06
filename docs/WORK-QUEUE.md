> **Ref:** `docs/WORK-QUEUE.md`
> **Updated:** 2026-04-06
> **Version:** 3.1
> **History:**
>
> - v3.1 (2026-04-06) — Nutrition Card initiative marked complete, task rows removed
> - v3.0 (2026-04-05) — inline tasks with dependencies, managed by project-ops skill
> - v2.0 (2026-04-05) — rewritten as planned-work-only queue
> - v1.0 (2026-04-05) — standardized doc header

# PDH — Work Queue

> Active work with plans attached. Nothing enters here without a plan.
> Standalone bugs and unplanned items live in `ROADMAP.md` until folded into a plan.
> Managed by the `project-ops` skill.
>
> **Flow:** ROADMAP (everything) -> **WORK-QUEUE (you are here)** -> WIP (executing) -> Archive (done)

---

## How this file works

- Each entry is an **initiative** with a plan link and inline task table.
- Tasks have a "Depends On" column — tasks with no dependencies can run in parallel.
- When a task completes: update its status and commit hash.
- When an initiative completes:
  1. Outstanding tasks get pushed back to `ROADMAP.md` as standalone items
  2. Completed task rows are removed
  3. Initiative row stays with final status
  4. Plan goes to `docs/plans/archive/`

---

## Completed: Nutrition Card (Meal Logging Redesign)

> **Status:** COMPLETE (2026-04-06) — merged via PR #3
> **Plan (archived):** `docs/plans/archive/nutrition-card-impl-plan-waves-*.json`
> **PRD (archived):** [`meal-logging-prd.md`](plans/archive/meal-logging-prd.md)
> **Branch:** `feat/nutrition` (merged to `main`)

All 6 waves complete (W0-W5), 69 commits, 1430 tests, 211 files changed.

### Roadmap items folded into this plan

- ~~WQ-411~~ Portion size tracking (done W2)
- ~~WQ-413~~ Liquids consolidation (done W2)
- ~~WQ-414~~ Wire handler stubs (done W2)
- ~~WQ-415~~ E2E tests (done W3)
- ~~WQ-416~~ Extract nutrition utils (done W2)
- ~~WQ-417~~ Meal-slot-scoped recent foods (done W2)
- ~~WQ-418~~ Clean dead water store state (done W2)

---

## Active: Tech-Debt Audit Cleanup

> **Status:** IN PROGRESS (2026-04-06) — waves 0-1 complete on `pans-labyrinth`, wave 2 starting
> **Plan (waves 0-1):** [`docs/plans/2026-04-06-tech-debt-audit-cleanup-waves-0-1.json`](plans/2026-04-06-tech-debt-audit-cleanup-waves-0-1.json)
> **Plan (waves 2-3):** [`docs/plans/2026-04-06-tech-debt-audit-cleanup-waves-2-3.json`](plans/2026-04-06-tech-debt-audit-cleanup-waves-2-3.json)
> **Plan (waves 4-5):** [`docs/plans/2026-04-06-tech-debt-audit-cleanup-waves-4-5.json`](plans/2026-04-06-tech-debt-audit-cleanup-waves-4-5.json)
> **Plan (wave 6):** [`docs/plans/2026-04-06-tech-debt-audit-cleanup-wave-6.json`](plans/2026-04-06-tech-debt-audit-cleanup-wave-6.json)
> **PRD:** [`docs/prd/2026-04-06-tech-debt-audit-cleanup.md`](prd/2026-04-06-tech-debt-audit-cleanup.md)
> **Branch:** `pans-labyrinth`

Waves 0-1 were executed on `pans-labyrinth` and are represented in branch history by task commits `W0-01` through `W1-18`. The next executable task is `W2-01`.

### Wave 2

| Task | Title | Depends On | Status | Commit |
|------|-------|-----------|--------|--------|
| W2-01 | Consolidate OpenAI utility functions into `convex/lib/openai.ts` | — | done | TBD |
| W2-02 | Consolidate coerce/normalization utilities into `convex/lib/coerce.ts` | — | done | TBD |
| W2-03 | Consolidate activity type normalization into `src/lib/activityTypeUtils.ts` | — | done | TBD |
| W2-04 | Consolidate time constants into `src/lib/timeConstants.ts` | — | done | TBD |
| W2-05 | Consolidate zone colors into `src/lib/zoneColors.ts` | — | done | TBD |
| W2-06 | Pre-compile regex patterns in `shared/food*.ts` files | — | done | TBD |
| W2-07 | Extract `useIsMobile` hook to shared location | — | done | TBD |
| W2-08 | Consolidate `foodEvidence` test factory functions | — | pending | |
| W2-09 | Fix stale theme storage key and create `storageKeys.ts` | — | pending | |
| W2-10 | Consolidate `customFoodPresets` normalization and fix ID generation | — | pending | |

### Wave 3

| Task | Title | Depends On | Status | Commit |
|------|-------|-----------|--------|--------|
| W3-01 | Split `convex/logs.ts` into focused modules | — | pending | |
| W3-02 | Split `routeTree.tsx`; extract layout components | — | pending | |
| W3-03 | Split `SmartViews.tsx`; extract utility logic to `smartViewUtils.ts` | — | pending | |
| W3-04 | Relocate Dr Poo components from `archive/` to `dr-poo/` | — | pending | |
| W3-05 | Extract store configuration constants from `src/store.ts` | — | pending | |
| W3-06 | Split `LogEntry.tsx`; delegate to SubRow components | — | pending | |
| W3-07 | Split `aiAnalysis.ts` into focused modules | — | pending | |
