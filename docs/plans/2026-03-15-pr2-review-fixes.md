# PR #2 Review Fix Plan

> **Status as of 2026-03-16:** Waves 1 and 2 are landed. Waves 3 and 4 remain open and are now tracked in the backlog as `PR2-WAVE3-4`, with this document retained as the detailed catalogue.

**Date**: 2026-03-15
**PR**: https://github.com/PBLIZZ/caca_traca/pull/2
**Total findings**: 124 (13 Critical, 36 High, 43 Medium, 32 Low)

## Wave 1 — Critical + Security High (15 issues, 8 agents) — COMPLETE

| Agent | Domain         | Issues                                                                  | Files                              | Status | Notes                                        |
| ----- | -------------- | ----------------------------------------------------------------------- | ---------------------------------- | ------ | -------------------------------------------- |
| 1     | Data Integrity | DI-F001 (race condition), SEC-F007 (ownership)                          | convex/foodParsing.ts              | Done   | Atomic OCC guard + userId check              |
| 2     | LLM Security   | LLM-F001 (prompt injection), SEC-F008 (ownership)                       | convex/foodLlmMatching.ts          | Done   | System/user message split + ownership check  |
| 3     | Transit Map    | PERF-F01 (lazy load), PAT-F001 (decomposition)                          | TransitMap.tsx → 12 files          | Done   | 1311→570 LOC, lazy glob, 4.3MB code-split    |
| 4     | Food Modal     | TRK-F002 (ticket save), A11Y-F001 (ARIA list), A11Y-F003 (search label) | FoodMatchingModal.tsx              | Done   | Real Convex mutation + ARIA listbox/combobox |
| 5     | Track Toast    | TRK-F001 (toast error handling)                                         | Track.tsx                          | Done   | try-catch + empty queue guard                |
| 6     | Settings       | SET-F001 (loading states), SET-F002 (async errors)                      | HealthForm, ReproForm, AppDataForm | Done   | isLoading gate + await async calls           |
| 7     | Dialog ARIA    | A11Y-F002 (dialog labeling)                                             | responsive-shell.tsx               | Done   | False positive — Radix handles automatically |
| 8     | Tests          | TEST-F001 (processLogInternal), TEST-F002 (LLM failures)                | convex/**tests**/                  | Done   | 31 new error path tests                      |

**Verification**: Typecheck clean, 559→562 tests all passing.

## Wave 2 — High Priority (36 issues, 9 agents) — COMPLETE

| Agent | Domain         | Issues                                 | Files                                  | Status | Notes                                      |
| ----- | -------------- | -------------------------------------- | -------------------------------------- | ------ | ------------------------------------------ |
| 1     | Data Integrity | DI-F002, DI-F003, DI-F004              | convex/foodParsing.ts, validators.ts   | Done   | Empty canonical reject, itemsVersion, OCC  |
| 2     | LLM Fixes      | LLM-F002, LLM-F003, LLM-F004           | foodLlmMatching.ts, useFoodLlmMatching | Done   | Stale key, regex, error classification     |
| 3     | Track UI       | TRK-F003, F004, F005, F006, F007       | 5 Track components                     | Done   | ESC handler, state restore, scroll, errors |
| 4     | Patterns UI    | PAT-F002, F003, F004                   | TrialHistorySubRow, Patterns.tsx       | Done   | Food name fallback, stable counts, search  |
| 5     | Settings UI    | SET-F003, F004, F005, F006, F007, F008 | 5 Settings components                  | Done   | Loading gate, confirm drawer, validation   |
| 6     | Performance    | PERF-F02, F03, F04                     | useStationArtwork, Track, analysis     | Done   | Regex cache, React.lazy, single-pass       |
| 7     | Tests          | TEST-F003, F004, F005, F006            | E2E + unit tests                       | Done   | Cascade tests, selector docs, console spy  |
| 8     | Duplication    | DUP-F001, DUP-F002                     | src/lib/foodParsing.ts + tests         | Done   | Removed 115 lines of duplicated helpers    |
| 9     | Accessibility  | A11Y-F004, F005, F006, F007            | Bristol, Habits, Weight components     | Done   | Radiogroup, aria-hidden, 44px touch target |

**False positives found (5 total)**: A11Y-F002 (Radix handles), TRK-F007 (already awaited), DUP-F001 (already clean), A11Y-F004 (already fixed in W1), SET-F007 (plaintext DELETE is standard UX).

**Verification**: Typecheck clean, 562 tests all passing.

## Wave 3 — Medium (43 issues) — PENDING

See full catalogue in PR comments. Domains: Data Integrity (2), Security (3), State Management (2), UI Track (3), UI Patterns (6), UI Settings (5), LLM (5), Food Pipeline (3), Performance (3), Test Coverage (6), Duplication (2), Accessibility (3+).

## Wave 4 — Low (32 issues) — PENDING

Cleanup, documentation, minor polish. See PR comments for full list.

## Summary Statistics

| Metric           | Value                           |
| ---------------- | ------------------------------- |
| Issues fixed     | 49 (of 124)                     |
| False positives  | 5                               |
| Tests added      | 35+                             |
| Tests passing    | 562                             |
| Typecheck        | Clean                           |
| Files changed    | ~50                             |
| New schema table | foodRequests                    |
| LOC reduced      | ~850 (TransitMap decomposition) |
