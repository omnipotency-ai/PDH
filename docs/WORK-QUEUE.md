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

> **Status:** IN PROGRESS (2026-04-06) — waves 0-5 complete except W5-16 deferred on `pans-labyrinth`; wave 6 pending
> **Plan (waves 0-1):** [`docs/plans/2026-04-06-tech-debt-audit-cleanup-waves-0-1.json`](plans/2026-04-06-tech-debt-audit-cleanup-waves-0-1.json)
> **Plan (waves 2-3):** [`docs/plans/2026-04-06-tech-debt-audit-cleanup-waves-2-3.json`](plans/2026-04-06-tech-debt-audit-cleanup-waves-2-3.json)
> **Plan (waves 4-5):** [`docs/plans/2026-04-06-tech-debt-audit-cleanup-waves-4-5.json`](plans/2026-04-06-tech-debt-audit-cleanup-waves-4-5.json)
> **Plan (wave 6):** [`docs/plans/2026-04-06-tech-debt-audit-cleanup-wave-6.json`](plans/2026-04-06-tech-debt-audit-cleanup-wave-6.json)
> **PRD:** [`docs/prd/2026-04-06-tech-debt-audit-cleanup.md`](prd/2026-04-06-tech-debt-audit-cleanup.md)
> **Branch:** `pans-labyrinth`

Waves 0-5 complete except deferred refactor W5-16. Wave 6 remains pending.

### Wave 2

| Task  | Title                                                                       | Depends On | Status | Commit |
| ----- | --------------------------------------------------------------------------- | ---------- | ------ | ------ |
| W2-01 | Consolidate OpenAI utility functions into `convex/lib/openai.ts`            | —          | done   | TBD    |
| W2-02 | Consolidate coerce/normalization utilities into `convex/lib/coerce.ts`      | —          | done   | TBD    |
| W2-03 | Consolidate activity type normalization into `src/lib/activityTypeUtils.ts` | —          | done   | TBD    |
| W2-04 | Consolidate time constants into `src/lib/timeConstants.ts`                  | —          | done   | TBD    |
| W2-05 | Consolidate zone colors into `src/lib/zoneColors.ts`                        | —          | done   | TBD    |
| W2-06 | Pre-compile regex patterns in `shared/food*.ts` files                       | —          | done   | TBD    |
| W2-07 | Extract `useIsMobile` hook to shared location                               | —          | done   | TBD    |
| W2-08 | Consolidate `foodEvidence` test factory functions                           | —          | done   | TBD    |
| W2-09 | Fix stale theme storage key and create `storageKeys.ts`                     | —          | done   | TBD    |
| W2-10 | Consolidate `customFoodPresets` normalization and fix ID generation         | —          | done   | TBD    |

### Wave 3

| Task  | Title                                                                | Depends On | Status | Commit    |
| ----- | -------------------------------------------------------------------- | ---------- | ------ | --------- |
| W3-01 | Split `convex/logs.ts` into focused modules                          | —          | done   | `996b0a0` |
| W3-02 | Split `routeTree.tsx`; extract layout components                     | —          | done   | `a207e76` |
| W3-03 | Split `SmartViews.tsx`; extract utility logic to `smartViewUtils.ts` | —          | done   | TBD       |
| W3-04 | Relocate Dr Poo components from `archive/` to `dr-poo/`              | —          | done   | `ec5deb7` |
| W3-05 | Extract store configuration constants from `src/store.ts`            | —          | done   | `4b71da6` |
| W3-06 | Split `LogEntry.tsx`; delegate to SubRow components                  | —          | done   | `773d55e` |
| W3-07 | Split `aiAnalysis.ts` into focused modules                           | —          | done   | `4caf2d7` |

### Wave 4

| Task  | Title                                                               | Depends On | Status  | Commit                                                         |
| ----- | ------------------------------------------------------------------- | ---------- | ------- | -------------------------------------------------------------- |
| W4-01 | Make importBackup safe — add caps, chunk inserts, validate          | —          | skipped | — deferred: personal-use product, backup safety not a priority |
| W4-02 | Cap exportBackup parallel table collects                            | W4-01      | skipped | — deferred: personal-use product, depends on W4-01             |
| W4-03 | Optimize buildFoodEvidenceResult — cap inputs, fix O(TxE) loop      | —          | done    | `4aa2254`                                                      |
| W4-04 | Add limit argument to conversations.listByDateRange                 | —          | done    | `5e3b5e5`                                                      |
| W4-05 | Skip FoodMatchingModal query on cold open                           | —          | done    | `1ba90db`                                                      |
| W4-06 | Merge FoodFilterView double frequency scan into single memo         | —          | done    | `1ba90db`                                                      |
| W4-07 | Add .take() caps to unbounded aggregate/exposure/assessment queries | —          | done    | `4aa2254`                                                      |
| W4-08 | Break mergeDuplicates into phased mutations                         | —          | done    | `1797524`                                                      |
| W4-09 | Optimize listFoodEmbeddings staleness check                         | —          | done    | `c4b22fb`, `8b5096c`                                           |
| W4-10 | Replace per-row setInterval in RelativeTime with global hook        | —          | done    | `0407871`                                                      |
| W4-11 | Optimize ProfileContext — remove JSON.stringify comparison          | —          | done    | `825b8f2`, `8dd4b49`                                           |
| W4-12 | Reduce client bundle — create ClientFoodRegistryEntry projection    | —          | skipped | — deferred: personal-use product, bundle size not a priority   |
| W4-13 | Remove pretty-printed JSON from AI payloads                         | —          | done    | `0407871`                                                      |
| W4-14 | Remove pretty-printed JSON from backup export                       | W4-01      | skipped | — deferred: personal-use product, depends on W4-01             |
| W4-15 | Debounce Patterns.tsx localStorage writes, add runtime validation   | —          | done    | `0407871`                                                      |
| W4-16 | Fix Confetti onComplete re-trigger via useRef                       | —          | done    | `0407871`                                                      |
| W4-17 | Hoist CalendarDayButton getDefaultClassNames to module scope        | —          | done    | `0407871`                                                      |
| W4-18 | Lazy-import TrackPage in routeTree                                  | —          | done    | `0407871`                                                      |

### Wave 5

| Task  | Title                                                          | Depends On | Status  | Commit                  |
| ----- | -------------------------------------------------------------- | ---------- | ------- | ----------------------- |
| W5-01 | Replace E2E waitForTimeout with condition waits and page objects | —        | done    | `b1b9f3b`, `af5537e`    |
| W5-02 | Make getWeekStart deterministic                                | —          | done    | `78a0a52`               |
| W5-03 | Remove hardcoded en-GB locale from weekly summary trigger      | —          | done    | `78a0a52`               |
| W5-04 | Fix stale period bounds in weekly summary trigger              | W5-03      | done    | `78a0a52`               |
| W5-05 | Sync weeklySummaries.add args with schema                      | —          | done    | `78a0a52`               |
| W5-06 | Type testFixtures using Infer<> and freeze exported objects    | —          | done    | `f01aa6c`               |
| W5-07 | Standardize day-boundary strategy in Bristol/BM tiles          | —          | done    | `4a8f7cc`               |
| W5-08 | Consolidate BowelSection form state into BowelFormDraft        | —          | done    | `962c42e`               |
| W5-09 | Add item-count assertion in CalorieDetailView delete           | —          | done    | `f01aa6c`               |
| W5-10 | Replace unsafe cast with FoodPipelineLog union                 | —          | done    | `d681d04`               |
| W5-11 | Fix responsive-shell flex mismatch and remove SSR guards       | —          | done    | `8f8ee78`               |
| W5-12 | Fix PopoverTitle element semantics                             | —          | done    | `8f8ee78`               |
| W5-13 | Expose isLoading from SyncedLogsContext                        | —          | done    | `8f8ee78`               |
| W5-14 | Fix AudioContext race condition in sounds.ts                   | —          | done    | `8f8ee78`               |
| W5-15 | Replace nested ternary chains with clearer control flow        | —          | done    | `42439fa`               |
| W5-16 | Extract CollapsibleSectionHeader color prop / InlineConfirmation | —        | skipped | — deferred pure refactor |
| W5-17 | Make AI analysis formatTime locale-independent                 | —          | done    | `78a0a52`               |
| W5-18 | Fix getDaysPostOp to accept now parameter                      | —          | done    | `78a0a52`               |
| W5-19 | Merge WeeklyContext and WeeklyDigestInput duplicate types      | —          | done    | `78a0a52`               |
| W5-20 | Add model validation to fetchWeeklySummary                     | —          | done    | `78a0a52`               |
| W5-21 | Verify and fix BM count data in hero section                   | —          | done    | `4a8f7cc`               |
| W5-22 | Fix weight target save for integer input                       | —          | done    | `962c42e`               |
| W5-23 | Fix Sleep/Weight quick capture two-click open                  | —          | done    | `962c42e`               |
| W5-24 | Add E2E test for unauthenticated app-load flow                 | —          | done    | `b1b9f3b`               |
| W5-25 | Fix duplicate timestamp display on today log expand            | —          | done    | `d681d04`               |
| W5-26 | Fix cigarettes duplicate subrows in today log                  | —          | done    | `d681d04`               |
| W5-27 | Fix sleep expand repeating label in today log                  | —          | done    | `d681d04`               |
| W5-28 | Fix activity rows label/time separation in today log           | —          | done    | `d681d04`               |
| W5-29 | Count liquid food-pipeline items toward fluid intake           | —          | done    | `d681d04`               |
| W5-30 | Correct Aquarius/electrolyte drink registry entry              | —          | done    | `f01aa6c`               |
