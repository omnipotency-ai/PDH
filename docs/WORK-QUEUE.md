> **Ref:** `docs/WORK-QUEUE.md`
> **Updated:** 2026-04-07
> **Version:** 3.3
> **History:**
>
> - v3.3 (2026-04-07) — Tech-Debt initiative marked complete, task rows removed, resolved ROADMAP items updated
> - v3.2 (2026-04-06) — Food Page & Meal System initiative added (22 tasks, 7 waves)
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

## Active: Food Page, Meal System & Navigation Restructure

> **Status:** ACTIVE
> **PRD:** [`2026-04-06-food-page-and-meal-system.md`](prd/2026-04-06-food-page-and-meal-system.md)
> **Plan:** [`2026-04-06-food-page-and-meal-system.md`](plans/2026-04-06-food-page-and-meal-system.md)
> **Execution plans:** `docs/plans/2026-04-06-food-page-and-meal-system-waves-{0-1,2-3,4-6}.json`
> **Branch:** TBD (create at execution time)

### Roadmap items folded in

- WQ-090 — TrackPage eagerly imported (addressed by W1-T02: Track moves to /track, lazy-loadable)

### Tasks

| Task   | Title                                               | Wave | Depends On     | Status  | Commit |
| ------ | --------------------------------------------------- | ---- | -------------- | ------- | ------ |
| W0-T01 | Extend foodLibrary for composite meals              | 0    | —              | pending |        |
| W0-T02 | Add tspToGrams to ingredientProfiles                | 0    | W0-T01         | pending |        |
| W0-T03 | Add foodFavouriteSlotTags to profiles               | 0    | W0-T01         | pending |        |
| W0-T04 | Mutation: auto-tag favourite slot associations      | 0    | W0-T03         | pending |        |
| W1-T01 | Create page stubs (Home, Food, Insights)            | 1    | W0-T04         | pending |        |
| W1-T02 | Restructure route tree to 4-tab bottom nav          | 1    | W1-T01         | pending |        |
| W1-T03 | Add /patterns → /insights redirect                  | 1    | W1-T02         | pending |        |
| W2-T01 | Simplify Track page to Today's Log only             | 2    | W1-T02         | pending |        |
| W2-T02 | Move Dr. Poo Report into Insights page              | 2    | W1-T01, W2-T01 | pending |        |
| W3-T01 | Home page: greeting + nutrition summary             | 3    | W1-T02         | pending |        |
| W3-T02 | Home page: slot chips, favourites, recent, frequent | 3    | W3-T01         | pending |        |
| W3-T03 | Home page: modifier chips + Quick Capture           | 3    | W3-T02         | pending |        |
| W3-T04 | Home page: search bar + water quick-action          | 3    | W3-T02         | pending |        |
| W3-T05 | Home page: Dr. Poo touchpoints                      | 3    | W3-T01         | pending |        |
| W4-T01 | Audit + fix heart toggle everywhere                 | 4    | W3-T02, W5-T03 | pending |        |
| W4-T02 | Plus button stages + auto-opens modal               | 4    | W3-T02, W5-T01 | pending |        |
| W5-T01 | Food page shell + view switcher + backfill picker   | 5    | W1-T02         | pending |        |
| W5-T02 | Food page search view (no cap)                      | 5    | W5-T01         | pending |        |
| W5-T03 | Food page favourites view + slot filtering          | 5    | W5-T01         | pending |        |
| W5-T04 | Food page filter view (recent/frequent/zone)        | 5    | W5-T01         | pending |        |
| W5-T05 | Food detail editing modal                           | 5    | W5-T02         | pending |        |
| W6-T01 | Populate registry with ~30 post-surgery foods       | 6    | W5-T02         | pending |        |
| W6-T02 | Seed Coffee + Toast meal templates                  | 6    | W0-T01, W6-T01 | pending |        |

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

## Completed: Tech-Debt Audit Cleanup

> **Status:** COMPLETE (2026-04-07) — merged via PR #5 (`pans-labyrinth`, W0-5) and PR #6 (`dantes-inferno`, W6)
> **Plans (archived):** `docs/plans/archive/2026-04-06-tech-debt-audit-cleanup-waves-{0-1,2-3,4-5}.json`, `docs/plans/archive/2026-04-06-tech-debt-audit-cleanup-wave-6.json`
> **PRD:** [`docs/prd/2026-04-06-tech-debt-audit-cleanup.md`](prd/2026-04-06-tech-debt-audit-cleanup.md)

All 7 waves complete (~80 tasks). Deferred: W4-01/02/12/14 (backup/bundle — personal-use product), W5-16 (pure refactor). Also resolved ~30 ROADMAP standalone items.
