> **Ref:** `docs/WORK-QUEUE.md`
> **Updated:** 2026-04-08
> **Version:** 3.4
> **History:**
>
> - v3.4 (2026-04-08) — Food Platform master plan adopted (31 tasks, 8 waves), old 22-task plan superseded
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

## Active: Food Platform & Navigation Restructure

> **Status:** ACTIVE
> **PRD:** [`2026-04-06-food-page-and-meal-system.md`](prd/2026-04-06-food-page-and-meal-system.md)
> **Plan:** [`food-platform-master-plan.md`](plans/food-platform-master-plan.md)
> **Vision:** [`new-plan-food.md`](plans/new-plan-food.md)
> **Branch:** `odyssey/food-platform`
> **Supersedes:** Food Page, Meal System & Navigation Restructure (old wave JSONs archived 2026-04-08)

### Roadmap items folded in

- WQ-090 — TrackPage eagerly imported (addressed by W3-T02: Track moves to /track, lazy-loadable)

### Tasks

| Task   | Title                                                   | Wave | Depends On     | Status  | Commit  |
| ------ | ------------------------------------------------------- | ---- | -------------- | ------- | ------- |
| W0-T01 | Create clinicalRegistry table                           | 0    | —              | done    | 33e17cc |
| W0-T02 | Extend ingredientProfiles with product catalog fields   | 0    | —              | done    | 33e17cc |
| W0-T03 | Add productId to logs table                             | 0    | —              | done    | 33e17cc |
| W0-T04 | Extend foodLibrary for composite meals                  | 0    | —              | done    | 33e17cc |
| W0-T05 | Add foodFavouriteSlotTags to profiles                   | 0    | —              | done    | 33e17cc |
| W1-T01 | Fix getEffectivePortionG to be unit-aware               | 1    | W0-T02         | done    | e51f4e6 |
| W1-T02 | Fix buildStagedNutritionLogData to preserve units       | 1    | W1-T01         | done    | e51f4e6 |
| W1-T03 | Fix buildPortionText display for discrete units         | 1    | W1-T01         | done    | e51f4e6 |
| W1-T04 | Create useFoodData hook (Convex-first, static fallback) | 1    | W0-T01, W0-T02 | done    | e51f4e6 |
| W2-T01 | Registry → clinicalRegistry seed script                 | 2    | W0-T01         | pending |         |
| W2-T02 | Seed ~30 post-surgery foods                             | 2    | W2-T01         | pending |         |
| W2-T03 | Seed Coffee + Toast meal templates                      | 2    | W0-T04, W2-T02 | pending |         |
| W2-T04 | Favourite slot auto-tag mutation                        | 2    | W0-T05         | pending |         |
| W3-T01 | Page stubs: Home, Food, Insights                        | 3    | —              | pending |         |
| W3-T02 | 4-tab bottom nav layout                                 | 3    | W3-T01         | pending |         |
| W3-T03 | /patterns → /insights redirect                          | 3    | W3-T02         | pending |         |
| W4-T01 | Simplify Track to Today's Log only                      | 4    | W3-T02         | pending |         |
| W4-T02 | Move Dr. Poo to Insights tab                            | 4    | W3-T01, W4-T01 | pending |         |
| W5-T01 | Greeting + nutrition summary                            | 5    | W3-T02, W1-T04 | pending |         |
| W5-T02 | Meal slots, favourites, recent, frequent                | 5    | W5-T01, W2-T04 | pending |         |
| W5-T03 | Modifier chips + Quick Capture                          | 5    | W5-T02         | pending |         |
| W5-T04 | Search bar + water action                               | 5    | W5-T02         | pending |         |
| W5-T05 | Dr. Poo touchpoints                                     | 5    | W5-T01         | pending |         |
| W6-T01 | Food page shell + view switcher + backfill picker       | 6    | W3-T02, W1-T04 | pending |         |
| W6-T02 | Search view (Convex-backed, no cap)                     | 6    | W6-T01         | pending |         |
| W6-T03 | Favourites view with slot filtering                     | 6    | W6-T01         | pending |         |
| W6-T04 | Filter view (recent/frequent/zone)                      | 6    | W6-T01         | pending |         |
| W6-T05 | Food detail modal + custom portions                     | 6    | W6-T02         | pending |         |
| W6-T06 | OpenFoodFacts "Add Product" flow                        | 6    | W6-T05         | pending |         |
| W7-T01 | Heart toggle audit (every FoodRow)                      | 7    | W5-T02, W6-T03 | pending |         |
| W7-T02 | Plus button → auto-stage + open modal                   | 7    | W5-T02, W6-T01 | pending |         |

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
