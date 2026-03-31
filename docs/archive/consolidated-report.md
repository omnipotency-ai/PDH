# Caca Traca — Consolidated Project Status Report

**Last updated:** 2026-03-15
**Branch:** `feature/v1-sprint` (off `master`)

---

## Current State Summary

The v1 sprint is nearly complete. All core food system work (Phases 1–4), browser testing Pass 1, and server-side pipeline work are done. The remaining blockers are the OpenAI prompt management task (#80) and Pass 2 browser testing for Settings, AI, and Menu pages.

---

## What Is Done

### Browser Testing Pass 1 (2026-03-09)

- 63 bugs found (#1–#63)
- 61 bugs fixed
- 2 deferred: #1 (Menu nav), #60 (Track layout redesign)
- Full record: `docs/browser-testing/2026-03-09-v1-test-run.md`

### Browser Testing Pass 2 (2026-03-10)

- Track page (desktop) and Patterns page tested
- Additional bugs found: #64–#96
- Bug totals: 96 total, 17 verified fixed, 5 partially fixed, 3 irrelevant (deleted features), many still open
- Settings, AI, and Menu pages NOT yet tested

### Wave 4 Code Review (2026-03-10)

- 3 criticals, 19 warnings, 22 minors identified
- All 3 criticals fixed
- Majority of warnings fixed; remaining deferred (see `docs/scratchpadprompts/2026-03-10-wave4-full-review.md`)

### Sprint Tasks — Phases 1–5 (2026-03-10)

- Phase 1 (data integrity): Tasks 1–6 all done (AI pollution fix, Bristol classification, food dedup, building evidence threshold, food trial merging, status logic thresholds)
- Phase 2 (track page): Tasks 7–9 all done (text overflow, date header, batch small fixes)
- Phase 3 (broken features): Tasks 10–12 all done (fluids revert, toast notifications, units consistency)
- Phase 4 (wave 4 warnings): All quick wins done (package.json cleanup, AI error handling, log count query, module-scope constants)
- Phase 5 (design): Conversation card redesign, meal cards, desktop 3-dot menu

### Food System Phases 1–4 (2026-03-13 to 2026-03-15)

**Phase 1 — Registry and Shared Code**

- `shared/` directory at repo root (used by both `src/` and `convex/`)
- `shared/foodRegistry.ts` — canonical registry (4 groups, 11 lines, ~100+ entries)
- `shared/foodCanonicalization.ts` — registry-based canonicalization
- `shared/foodNormalize.ts` — normalization with singularization, synonym map, quantity stripping
- `shared/foodTypes.ts` — shared types
- 33 unit tests in `shared/__tests__/`

**Phase 2 — Server-Side Pipeline**

- Food parsing now server-side via Convex action
- LLM matching is client-initiated (BYOK — user's OpenAI key, not server-scheduled)
- Queue mode added to `FoodMatchingModal`
- `resolvedBy` field migration completed

**Phase 3 — Data Quality**

- Registry-first lookup (no LLM for known foods)
- Size abbreviation parsing (sm, lg, med without leading number)
- Code fence stripping from LLM responses
- Segment match-back for LLM parsed names

**Phase 4 — UI + Bug Fixes**

- Inline edit data loss fixed
- Display shows `parsedName` not `userSegment`
- Quantity display fixed ("2 sl toast" not just "toast")
- Canonical name persists after save (no longer reverts to raw name)
- Delete confirmation added
- "Request this food" UI button wired (stub — console only, not yet persisted)

**Server-side pipeline Tasks 1–11 — ALL DONE**
Full record: `docs/archive/plans/2026-03-14-server-side-food-pipeline.md`

### E2E Test Suite

- 75 tests passing (food pipeline: 36, patterns: 17, others)
- 1 TDD failure (intentional — food names in trial sub-rows, feature implemented)
- 6 skipped
- Food pipeline browser-verified: bugs #1–#9 all confirmed fixed

### Architecture

- Cloud-only (ADR-0001): Convex = sole source of truth
- IDB = API key storage only
- Zustand = ephemeral UI state only
- Clerk auth on all tables
- AI calls are client-initiated (BYOK pattern — user provides OpenAI key stored in IDB)

---

## What Is Not Done (Remaining Work)

### Ship Blockers

| #   | Item                     | Notes                                              |
| --- | ------------------------ | -------------------------------------------------- |
| #80 | OpenAI prompt management | Requires OpenAI dashboard setup + prompt ID wiring |

### High Priority

| #   | Item                              | Notes                                                          |
| --- | --------------------------------- | -------------------------------------------------------------- |
| —   | Pass 2 browser testing: Settings  | Bugs #46, #47, #51–#55 unverified                              |
| —   | Pass 2 browser testing: AI system | Bugs #35–#38, #42–#43, #61 unverified                          |
| —   | Pass 2 browser testing: Menu page | Bugs #22–#24 unverified                                        |
| —   | Pill/tag input for food entry     | User-requested UX improvement                                  |
| —   | Registry gap audit                | Standalone words (chicken, pasta, bread) missing from registry |
| —   | Food request persistence (#10)    | "Request this food" button is UI stub only                     |

### Medium Priority

| #   | Item                                 | Notes                                                                |
| --- | ------------------------------------ | -------------------------------------------------------------------- |
| —   | CI pipeline                          | No CI exists yet                                                     |
| —   | Quantity threading                   | Thread quantity/unit from ingredientExposures through trial pipeline |
| —   | Delete 4 orphan game tables          | From Convex dashboard                                                |
| —   | Lift `analyzeLogs` to shared context | Duplicated in Patterns + Menu                                        |

### Deferred

- #1 Menu nav, #60 Track layout redesign
- v3-strategy prompt upgrade (~30% done)
- Transit calibration Settings UI
- Food database pre-population
- Pre-sync modal (abandoned)
- Phase 5: Transit map UI + game layer rebuild

---

## Architecture Debt (Known)

- `buildFoodEvidenceResult()` runs client + server — should be server-only
- `analyzeLogs` duplicated across pages
- `aiAnalysis.ts` is very large
- `window.confirm` used for destructive actions in Settings (broken on iOS PWA)
- SW registration conflict: `vite-plugin-pwa autoUpdate` + manual `registerSW` double-register
- O(n²) weekly digest backfill (`updateWeeklyDigestImpl`)

---

## AI System — Current Architecture

The AI system is client-initiated BYOK (bring your own key). The user stores their OpenAI API key in IndexedDB. All LLM calls are made from the client, not from Convex server actions. This is a deliberate architecture decision (see `memory/feedback_llm_key_architecture.md`).

**7 LLM call types exist** (food parsing, Dr. Poo report, pane summaries, coaching snippet, habit detail snippet, settings suggestions, weekly summary). Most are over-calling and need rework — this is tracked in `docs/reviews/ai_prompt/AI_SYSTEM_REVIEW.md` as a separate task (#80 is the ship blocker).

**Key AI review documents:**

- `docs/reviews/ai_prompt/AI_SYSTEM_REVIEW.md` — all 7 call types, issues, action items
- `docs/reviews/ai_prompt/PROMPT_ANALYSIS.md` — 154-instruction atomization, conflicts, refactor proposal
- `docs/adrs/0007-ai-model-configuration.md` — model config decisions

---

## Key Documents

| Document                                                     | Purpose                              |
| ------------------------------------------------------------ | ------------------------------------ |
| `docs/v1_sprint_tasks.md`                                    | Full sprint task list with status    |
| `docs/current-state-architecture.md`                         | Architecture detail                  |
| `docs/adrs/0001-cloud-only-architecture.md`                  | Cloud-only ADR                       |
| `docs/adrs/0002-food-registry-and-canonicalization.md`       | Food registry ADR                    |
| `docs/browser-testing/2026-03-09-v1-test-run.md`             | Bug tracker (96 bugs)                |
| `docs/archive/plans/2026-03-14-server-side-food-pipeline.md` | Food pipeline plan (archived — done) |
| `docs/plans/2026-03-14-food-pipeline-ui-fixes.md`            | Food UI fixes plan                   |
| `memory/project_detail.md`                                   | Live project state (authoritative)   |

---

## Original Review (2026-03-10)

The original consolidated review against the 63-bug test run list is preserved below. It documents the specific component-level changes made during the initial sprint phases. See the "What Was Changed" sections per component for detailed notes on individual bug fixes.

The original review was written as a reverse-engineering audit confirming that bug fixes were in place in the codebase. It covered:

- Track page (Bugs #1–#15, #44–#50, #56–#58, #62–#63)
- AI & Conversation (Bugs #37–#43, #54–#55, #59, #61)
- Patterns page (Bugs #17–#26, #28–#33)
- Settings & Menu (Bugs #22–#24, #46–#47, #50, #52–#57)
- Core Libraries (Bugs #15–#16, #21, #25, #28, #31, #35–#36, #44–#45, #48–#50)

For the full component-by-component breakdown, see the archived version of this file in git history (commit `6b170f7`).
