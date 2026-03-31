# A9 — Test Quality Audit Report

**Date:** 2026-03-16
**Scope:** All test files (`__tests__/`, `*.test.ts`, `e2e/`)
**Files reviewed:** 42 (25 unit/integration, 13 E2E specs, 2 E2E support files, plus collocated `*.test.ts` in `src/lib/` and `convex/`)

---

## Critical Issues (untested critical paths)

| #   | File/Function                                                                             | Issue                                                                                                                                                                                                                                                                                              | Priority |
| --- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| C1  | `convex/foodParsing.ts` → `processLogInternal` (LLM success path)                         | The test at `convex/__tests__/foodPipelineBranches.test.ts` only tests deterministic parsing. The LLM resolution path inside `processLogInternal` is never exercised. `matchUnresolvedItems` is also disabled with a stub — the entire LLM-backed food resolution path has **zero real coverage**. | Critical |
| C2  | `convex/__tests__/foodPipelineBranches.test.ts` line 438                                  | **`it.fails("rejects re-matching expired items")`** — this test documents that the production guard is **wrong**: expired items can be re-matched when policy says they should not be. The production code has a known bug that no passing test enforces.                                          | Critical |
| C3  | `src/lib/baselineAverages.ts` — `computeBaselineAverages`                                 | Powers the Insights panel. 260+ lines, complex branching over habit types, fluid ml, weight logs, and digestion metrics. **No unit tests at all.**                                                                                                                                                 | Critical |
| C4  | `src/lib/habitProgress.ts` — `getProgressColor`, `getProgressText`, `getProgressFraction` | Drives the visible habit tile state (colors, labels, progress bars) used heavily in the UI. **Zero unit tests.**                                                                                                                                                                                   | Critical |
| C5  | `src/lib/derivedHabitLogs.ts` — full module                                               | Derives habit counts, fluid totals, and activity summaries from raw `SyncedLog[]`. Complex normalization logic with `REC_DRUG_ALIASES`, `WALKING_ALIASES`, and multi-key resolution. **Zero unit tests.**                                                                                          | Critical |

---

## High Priority

| #   | File                                                         | Issue                                                                                                                                                                                                                                                  | Suggested Fix                                                                                                                  |
| --- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| H1  | `src/hooks/__tests__/useTransitMapData.test.ts`              | **Does not test the actual React hook.** It duplicates the hook's network-builder logic inline as a pure function and tests that. If the hook adds any real logic (memoization, error handling, Convex query plumbing), it won't be caught.            | Rename to `transitNetwork.unit.test.ts` or add an actual hook test with `renderHook`.                                          |
| H2  | `shared/__tests__/foodPipelineDisplay.test.ts` lines 106–140 | **Two tests labelled `"BUG BASELINE"` assert the buggy behavior** (`getFoodItemDisplayName` returns `"4 toast"` with quantity prefix). These lock in incorrect behavior — they will pass when the bug exists and fail only when someone fixes the bug. | Use `it.fails()` or add a comment linking the relevant bug ticket.                                                             |
| H3  | `src/lib/__tests__/digestiveCorrelations.test.ts`            | **`computeCorrelations` test only checks `result[0].summaryText.toLowerCase().toContain("fluids")`** — a string presence check that does not verify correctness of computed averages, best/worst day classification, or correlation scores.            | Add assertions on `bestDays[0].avgFluidMl`, `averageScore`, and that days with high fluid intake are classified as `bestDays`. |
| H4  | `src/lib/__tests__/aiModels.test.ts`                         | **Tests check hard-coded constant values**, not behavioral coverage. If the model list changes and `getValidInsightModel` breaks for new values, tests won't catch it. No test for `getModelLabel` on valid current models.                            | Add parametric tests over `INSIGHT_MODEL_OPTIONS`.                                                                             |
| H5  | `e2e/food-tracking.spec.ts`                                  | **`page.waitForTimeout(500)` and `page.waitForTimeout(300)`** as synchronization — hardcoded waits are the most common cause of E2E flakiness. Also uses `.first()` selector for the food group button which will match any visible button.            | Replace `waitForTimeout` with `waitForResponse` or `expect(...).toBeVisible()`. Tighten button selector.                       |
| H6  | `e2e/bowel-tracking.spec.ts`                                 | **Conditional `if (await bristolType4.isVisible())` before clicking** — if the element is not visible, the click is silently skipped and the test passes vacuously.                                                                                    | Remove the conditional; use `await bristolType4.click()` and let the test fail explicitly.                                     |
| H7  | `convex/__tests__/foodLlmMatching.test.ts` lines 863–916     | **Two tests verify a stub, not real behavior.** Both return `{ matched: 0, unresolved: 0 }` because the action is "disabled". These tests silently pass even when the action is fully broken.                                                          | Mark with `test.todo()` or `it.skip()` until `applyLlmResults` is implemented.                                                 |
| H8  | `src/lib/__tests__/foodLlmCanonicalization.test.ts`          | **`buildRegistryVocabularyPrompt()` tested only by spot-checking two example strings** — if the prompt format breaks (e.g., registry vocabulary separator changes), no test would catch it.                                                            | Add a test that parses the prompt structure and validates format consistency.                                                  |

---

## Medium Priority

| #   | File                                             | Issue                                                                                                                                                                                                            | Suggested Fix                                                                                                              |
| --- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| M1  | `shared/__tests__/foodEvidence.test.ts`          | **No test for multiple foods eaten simultaneously in a single log event** (confounding between co-eaten foods). This is the most common real-world evidence attribution error.                                   | Add a test: two foods eaten at the same time, one bad outcome — verify both get the outcome correctly attributed/weighted. |
| M2  | `src/lib/__tests__/habitAggregates.test.ts`      | **`computeStreakSummary` has no test for empty array input** or habits where `summaries` exist for a different `habitId`.                                                                                        | Add edge case: `computeStreakSummary([], "habit_water", 7)` and a test with mismatched habitId.                            |
| M3  | `shared/__tests__/foodMatching.test.ts`          | **`routeFoodMatchConfidence` tests use synthetic candidates with hardcoded `combinedConfidence` values.** No test covers the boundary between `medium` and `high` (~0.86) or between `low` and `medium` (~0.56). | Add boundary tests at exactly 0.56 and 0.86.                                                                               |
| M4  | `e2e/patterns-food-trials.spec.ts`               | **`test("logging a new food increases its trial count")` uses `page.waitForTimeout(1000)`** then asserts count increased. Also uses `findFoodRow(page, /toast/i)` which could match "French toast".              | Use `waitForFunction` polling the count; use an exact match selector for the food name cell.                               |
| M5  | `e2e/food-pipeline.spec.ts`                      | **Selectors documented as "Fragile" in the file's own comments** — `section.glass-card-food`, `svg.animate-spin`, placeholder-text-based selectors.                                                              | Add `data-testid` attributes to key elements and update selectors.                                                         |
| M6  | `convex/__tests__/foodLogsMutations.test.ts`     | **No test for `logs.add` mutation with oversized `rawInput` string.** Sanitization is tested in unit tests but the mutation path's integration with sanitization is not verified end-to-end.                     | Add a test passing rawInput with HTML tags and control characters, then verifying the persisted log is clean.              |
| M7  | `shared/__tests__/foodCanonicalization.test.ts`  | **`getFoodDigestionMetadata` test only asserts one "undefined" case.** No test verifies that enriched entries return complete metadata objects.                                                                  | Add parametric tests over a few enriched entries to assert metadata field types.                                           |
| M8  | `src/lib/__tests__/foodParsing.behavior.test.ts` | **`buildFallbackResult` tested via a locally-duplicated copy** of the function logic (lines 12–42), not the actual exported function.                                                                            | Import and test the real `buildFallbackResult` from `foodParsing.ts` directly.                                             |
| M9  | `e2e/weight-tracking.spec.ts`                    | **`page.locator('input[type="text"]').first()`** — the most generic possible selector. Any text input on the page would match.                                                                                   | Use `page.locator('input[aria-label*="weight"]')` or add a `data-testid="weight-input"` attribute.                         |
| M10 | `e2e/settings-page.spec.ts`                      | **All three tests only check for visible text.** No test verifies that the settings page can actually save anything (health conditions, OpenAI key, unit system).                                                | Add a test that changes the unit system and verifies the change persists after page reload.                                |

---

## Low Priority

| #   | File                                           | Issue                                                                                                                                                 | Suggested Fix                                                                                            |
| --- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| L1  | `src/lib/__tests__/normalizeFluidName.test.ts` | `null` and `undefined` inputs are tested but TypeScript signature may not accept them. Tests coerce invalid types.                                    | Check function signature; if only accepts `string`, remove these tests or guard with `@ts-expect-error`. |
| L2  | `src/lib/__tests__/formatWeight.test.ts`       | No test for very large values or negative values.                                                                                                     | Add edge cases for large values and negative inputs.                                                     |
| L3  | `e2e/app-loads.spec.ts`                        | **Smoke test only** — checks for logo alt text `"Caca Traca"`. If the app loads but all data queries fail, this test still passes.                    | Add a check that at least one data-driven section is visible.                                            |
| L4  | `e2e/fluid-tracking.spec.ts`                   | **CSS-class badge selector** for fluid total. If user has existing fluid entries from earlier test runs, the delta assertion may fail.                | Isolate to a clean user state per test, or compute a delta explicitly.                                   |
| L5  | `shared/__tests__/foodParsing.test.ts`         | Test data is verbose inline objects rather than factory functions. No test for duplicate `original` values in a group.                                | Add a factory function and test duplicate original values.                                               |
| L6  | Multiple test files                            | **Test names across the suite don't specify which operation** (e.g., "rejects unauthenticated access" vs "logs.add: rejects unauthenticated access"). | Prefix test names with the operation.                                                                    |
| L7  | `e2e/sleep-tracking.spec.ts`                   | **Save not verified in Today's Log** — test presses Enter then checks that the popover is gone, not that sleep was actually saved.                    | After submission, verify the sleep entry appears in Today's Log.                                         |

---

## Coverage Gaps (untested source files/functions)

| Source File/Function                                                                                             | Has Tests?        | Risk Level | Notes                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------- | ----------------- | ---------- | --------------------------------------------------------------------------------------------------------- |
| `src/lib/baselineAverages.ts` — `computeBaselineAverages`                                                        | No                | Critical   | 260+ LOC, complex branching, powers Insights panel deltas.                                                |
| `src/lib/habitProgress.ts` — `getProgressColor`, `getProgressText`, `getProgressFraction`, `getProgressBarColor` | No                | Critical   | Drives all habit tile visual state. Multiple branching paths.                                             |
| `src/lib/derivedHabitLogs.ts` — full module                                                                      | No                | Critical   | Core to Today view. Complex alias resolution.                                                             |
| `src/lib/habitCoaching.ts` — all functions                                                                       | No                | High       | LLM-backed coaching messages. 12+ branching heuristic paths.                                              |
| `src/lib/analysis.ts` — `analyzeLogs` (bulk)                                                                     | Partial (3 tests) | High       | `FoodStat` shape fields (`recentSuspect`, `posteriorSafety`, `tendency`, score computation) are untested. |
| `src/lib/trialFormatters.ts` — `formatTransitHours`, `formatShortDate`                                           | No                | Medium     | Non-obvious rounding formula. Unit test would catch precision bugs.                                       |
| `src/lib/reproductiveHealth.ts`                                                                                  | No                | Medium     | Menstrual cycle logic used in reproductive log display.                                                   |
| `src/lib/units.ts`                                                                                               | No                | Medium     | Unit conversion utilities used across the app.                                                            |
| `src/lib/settingsUtils.ts`                                                                                       | No                | Medium     | Settings helpers.                                                                                         |
| `src/lib/customFoodPresets.ts`                                                                                   | No                | Low        | Small module.                                                                                             |
| `src/hooks/useFoodParsing.ts`                                                                                    | No                | High       | Orchestrates client-side food parsing flow with API key management. Primary user-facing hook.             |
| `src/hooks/useUnresolvedFoodQueue.ts`                                                                            | No                | High       | Drives the toast-and-match flow for pending food items. Key UX path.                                      |
| `src/hooks/useFoodLlmMatching.ts`                                                                                | No                | High       | Client-initiated LLM matching (BYOK architecture). Critical for food resolution.                          |
| `src/hooks/useBaselineAverages.ts`                                                                               | No                | High       | Wraps `computeBaselineAverages` with Convex data.                                                         |
| `src/hooks/useDayStats.ts`                                                                                       | No                | Medium     | Computes daily summaries for the Track page.                                                              |
| `convex/foodRequests.ts`                                                                                         | No                | High       | Recently fixed bug #10. Regression risk without tests.                                                    |
| `convex/ingredientNutritionApi.ts`                                                                               | No                | Medium     | External API calls. Should have unit tests for response parsing.                                          |

---

## Test Quality Assessment by File

| Test File                                           | Quality                           | Issues                                                                                        |
| --------------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------- |
| `src/lib/__tests__/formatWeight.test.ts`            | Good                              | Missing negative/large value edge cases.                                                      |
| `src/lib/__tests__/normalizeFluidName.test.ts`      | Good                              | Type coercion of null/undefined not aligned with TS types.                                    |
| `src/lib/__tests__/inputSafety.test.ts`             | Excellent                         | Thorough boundary testing.                                                                    |
| `src/lib/__tests__/digestiveCorrelations.test.ts`   | Adequate                          | Core scoring logic asserted via weak string contains check.                                   |
| `src/lib/__tests__/habitAggregates.test.ts`         | Good                              | Missing empty-input and mismatched-habitId edge cases.                                        |
| `src/lib/__tests__/healthProfile.test.ts`           | Excellent                         | Strong coverage of normalization, deduplication, and legacy mapping.                          |
| `src/lib/__tests__/aiModels.test.ts`                | Adequate                          | Tests constants more than behavior.                                                           |
| `src/lib/__tests__/aiAnalysis.test.ts`              | Excellent                         | Comprehensive: valid, null, malformed, all array filtering cases. One of the best files.      |
| `src/lib/__tests__/foodLlmCanonicalization.test.ts` | Adequate                          | Prompt content-check is weak. `postProcessCanonical` is well-tested.                          |
| `src/lib/__tests__/foodParsing.test.ts`             | Good                              | LLM path well-exercised with mocks.                                                           |
| `src/lib/__tests__/foodParsing.behavior.test.ts`    | Good                              | `buildFallbackResult` mirror concern.                                                         |
| `src/lib/analysis.test.ts`                          | Partial                           | Only 3 tests, narrow scope.                                                                   |
| `src/hooks/__tests__/useTransitMapData.test.ts`     | Good (as unit tests) but misnamed | Does not test the hook at all.                                                                |
| `convex/__tests__/foodLogsMutations.test.ts`        | Excellent                         | Best integration test file. Full lifecycle, auth, cross-user isolation, cascade regression.   |
| `convex/__tests__/foodLlmMatching.test.ts`          | Good                              | `parseLlmResponse` and `processLlmResults` are extensively tested. Stub tests are misleading. |
| `convex/__tests__/foodPipelineBranches.test.ts`     | Good                              | `it.fails` for expired item re-matching documents a real bug. Error paths well-covered.       |
| `shared/__tests__/foodPipelineDisplay.test.ts`      | Adequate                          | Bug-baseline tests lock in wrong behavior. `resolveCanonicalFoodName` tests are solid.        |
| `shared/__tests__/foodRegistry.test.ts`             | Excellent                         | Thorough structural coverage.                                                                 |
| `shared/__tests__/foodCanonicalization.test.ts`     | Excellent                         | Comprehensive zone-by-zone alias testing and invariants.                                      |
| `shared/__tests__/foodEvidence.test.ts`             | Good                              | Complex Bayesian evidence model well-tested. Missing co-eaten food confounding case.          |
| `shared/__tests__/foodMatching.test.ts`             | Good                              | Boundary conditions missing for confidence thresholds.                                        |
| `shared/__tests__/foodNormalize.test.ts`            | Good                              | Edge cases well-covered.                                                                      |
| `shared/__tests__/foodParsing.test.ts`              | Good                              | All parsing primitives covered.                                                               |

---

## E2E Test Assessment

| Test File                          | Reliability          | Issues                                                                                                                              |
| ---------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `e2e/app-loads.spec.ts`            | High                 | Smoke test only.                                                                                                                    |
| `e2e/track-page.spec.ts`           | High                 | Very thin — 2 visibility checks, no interaction tested.                                                                             |
| `e2e/food-tracking.spec.ts`        | Medium               | `waitForTimeout` synchronization. Selector fragility.                                                                               |
| `e2e/bowel-tracking.spec.ts`       | Medium               | Conditional click hides failures.                                                                                                   |
| `e2e/fluid-tracking.spec.ts`       | Medium               | `waitForTimeout`. Delta computation fragile with shared test user state.                                                            |
| `e2e/sleep-tracking.spec.ts`       | Medium               | Save not verified in Today's Log.                                                                                                   |
| `e2e/weight-tracking.spec.ts`      | Medium               | Over-broad `input[type="text"].first()` selector.                                                                                   |
| `e2e/settings-page.spec.ts`        | High (but low value) | Only text presence checks. No settings mutation tested.                                                                             |
| `e2e/destructive-habits.spec.ts`   | N/A                  | **All 4 tests skipped with no setup path.** Entire file adds zero value in CI.                                                      |
| `e2e/food-pipeline.spec.ts`        | Medium               | Self-documented fragile selectors. Good adversarial test design.                                                                    |
| `e2e/patterns-food-trials.spec.ts` | Medium               | Good `data-slot` selectors. `waitForTimeout` for synchronization. Conditional warn-not-fail on category/zone checks too permissive. |

---

## Summary

**Key strengths:**

- Food pipeline unit test suite (`foodCanonicalization`, `foodEvidence`, `foodMatching`, `foodNormalize`, `foodParsing`, `foodRegistry`) is thorough and well-structured.
- `convex/__tests__/foodLogsMutations.test.ts` is the best single test file.
- `aiAnalysis.test.ts` is exemplary: input validation, defaults, array filtering, and shape contract all covered.
- The `it.fails()` pattern in `foodPipelineBranches.test.ts` correctly documents a known production bug.

**Key weaknesses:**

- The entire client-side data layer (`baselineAverages`, `derivedHabitLogs`, `habitProgress`, `analysis.ts` bulk) has near-zero unit test coverage despite being foundational to the Today and Insights views.
- All `src/hooks/` except `useTransitMapData` have no tests.
- The LLM food matching path (`matchUnresolvedItems`, `useFoodLlmMatching`) is completely untested as real behavior.
- E2E tests rely heavily on `waitForTimeout` and fragile CSS-class selectors.
- Two "bug baseline" tests in `foodPipelineDisplay.test.ts` intentionally assert incorrect behavior.
- `convex/foodRequests.ts` (recently fixed bug #10) has no regression tests.
