> **Ref:** `docs/WORK-QUEUE.md`
> **Updated:** 2026-04-05
> **Version:** 3.0
> **History:**
>
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

## Active: Nutrition Card (Meal Logging Redesign)

> **Plan:** [`nutrition-card-implementation-plan.json`](plans/nutrition-card-implementation-plan.json)
> **PRD (archived):** [`meal-logging-prd.md`](plans/archive/meal-logging-prd.md)
> **Branch:** `feat/nutrition`
> **Next session:** [`next-session-prompt.md`](plans/next-session-prompt.md)

### Remaining Tasks

| Task  | Title                                        | Depends On          | Status | Commit                    |
| ----- | -------------------------------------------- | ------------------- | ------ | ------------------------- |
| W4-01 | Migrate non-water drinks to food suggestions | —                   | done   | `db1b2d4`, `269ccc7`      |
| W4-03 | Wire TodayLog for nutrition card data        | W4-01               | done   | `66b74fe`                 |
| W5-01 | Dark mode and CSS variable audit             | W4-03               | done   | `78c56fe`                 |
| W5-02 | Accessibility hardening                      | W4-03               | done   | (in `78c56fe`, `9b93f3f`) |
| W5-03 | Edge cases and error states                  | W4-03               | done   | `9b93f3f`                 |
| W5-04 | Full regression (all tests + E2E)            | W5-01, W5-02, W5-03 | done   | `122ea23`                 |

### Completed Waves (summary)

| Wave     | Status   | Key commits                                           |
| -------- | -------- | ----------------------------------------------------- |
| Wave 0   | Complete | Research: data model, pipeline, fluid, portions       |
| Wave 1   | Complete | `a8f21d0`, `38267d5`, `f471c58`, `c261f67`, `3cedd80` |
| Wave 2   | Complete | `2bd26e5`, `23cfee6`, `7daece1`, `8ad0790`, `95b3032` |
| Wave 3   | Complete | `034636f`, `8abdc96`, `965c376`, `5f2b6e2`, `2c91729` |
| Spec fix | Complete | `714d586` through `809771c` (12 tasks)                |
| W4-02    | Complete | `d22a634` — removed old FoodSection + FluidSection    |

### Roadmap items folded into this plan

- ~~WQ-411~~ Portion size tracking (done W2)
- ~~WQ-413~~ Liquids consolidation (done W2)
- ~~WQ-414~~ Wire handler stubs (done W2)
- ~~WQ-415~~ E2E tests (done W3)
- ~~WQ-416~~ Extract nutrition utils (done W2)
- ~~WQ-417~~ Meal-slot-scoped recent foods (done W2)
- ~~WQ-418~~ Clean dead water store state (done W2)
