# Testing & Quality Assurance Review

**Date:** 2026-02-24
**Reviewer:** Claude Opus 4.6 (QA Specialist)
**Codebase:** Caca Traca -- Ostomy Recovery Tracker
**Stack:** React 19 + TypeScript + Vite + Convex + Zustand + Tailwind CSS 4

---

## Executive Summary

The Caca Traca codebase has **zero automated tests**. There are no unit tests, integration tests, end-to-end tests, or any test infrastructure whatsoever. No test runner (Vitest, Jest, Playwright, Cypress) is installed or configured. No `test` script exists in `package.json`.

Despite this, the codebase contains approximately **2,941 lines of pure business logic** across 8 library files, including medically significant food-to-stool correlation algorithms, AI-powered food parsing, gamification streak logic, and cross-device sync. None of this logic has any automated verification.

The application does benefit from some defensive measures: runtime type guards on AI response parsing (`parseAiInsight`, `isValidFoodParseResult`), fallback logic for AI failures, Convex schema validation on the backend, and an error boundary in the router. However, these are no substitute for systematic testing.

**Risk Assessment: HIGH.** This is a health-related tracking application where incorrect food correlation data could influence dietary decisions during post-surgical recovery. The absence of any test coverage for the core analysis engine is the single most critical quality gap.

---

## Test Coverage Matrix

| Area                                   | Files                               | Lines       | Unit Tests | Integration Tests | E2E Tests |
| -------------------------------------- | ----------------------------------- | ----------- | ---------- | ----------------- | --------- |
| Food-Stool Correlation Engine          | `src/lib/analysis.ts`               | 910         | NONE       | NONE              | NONE      |
| Food Parsing (AI)                      | `src/lib/foodParsing.ts`            | 225         | NONE       | NONE              | NONE      |
| AI Nutritionist Analysis               | `src/lib/aiAnalysis.ts`             | 604         | NONE       | NONE              | NONE      |
| Zustand Store + Migration              | `src/store.ts`                      | 376         | NONE       | NONE              | NONE      |
| Streak / Gamification Logic            | `src/lib/streaks.ts`                | 275         | NONE       | NONE              | NONE      |
| Track Metrics Aggregation              | `src/lib/trackMetrics.ts`           | 150         | NONE       | NONE              | NONE      |
| Habit Templates / Normalization        | `src/lib/habitTemplates.ts`         | 245         | NONE       | NONE              | NONE      |
| Sync Hooks (Convex)                    | `src/lib/sync.ts`                   | 156         | NONE       | NONE              | NONE      |
| Convex Backend (logs, AI, foodLibrary) | `convex/*.ts`                       | ~330        | NONE       | NONE              | NONE      |
| React Components (~25 files)           | `src/components/**`, `src/pages/**` | ~5,000+     | NONE       | NONE              | NONE      |
| **TOTALS**                             | **~40 source files**                | **~8,000+** | **0**      | **0**             | **0**     |

**Overall Coverage: 0%**

---

## Findings

### CRITICAL Severity

#### C1: No Test Infrastructure Exists

**Description:** The project has no test framework installed, no test configuration, and no test scripts. There is no `vitest`, `jest`, `@testing-library/react`, `playwright`, or `cypress` in `package.json`. There is no `test` script in `package.json`.

**Location:** `/package.json` (absence of test dependencies and scripts)

**Impact:** Any code change -- refactoring, bug fix, or feature addition -- has zero automated safety net. Regressions can only be caught through manual testing, which is unreliable for a codebase of this complexity.

**Recommendation:** Install Vitest (pairs naturally with Vite) and `@testing-library/react`. Add a `test` script to `package.json`. Configure `vitest.config.ts` with jsdom environment for component tests.

```bash
bun add -d vitest @testing-library/react @testing-library/jest-dom jsdom happy-dom
```

---

#### C2: Food-Stool Correlation Engine Untested (910 lines)

**Description:** `src/lib/analysis.ts` is the core business logic of the entire application. It contains:

- `resolveAllCorrelations()` -- matches food trials to bowel events using a 55-minute minimum transit window
- `outcomeFromTransitAndCategory()` -- classifies outcomes across 4 transit time buckets (normal/slow/very slow/abnormally slow)
- `buildFoodStats()` -- computes food safety status using a rolling 3-trial window
- `normalizeDigestiveCategory()` -- converts Bristol codes and consistency tags to categories
- `analyzeFactors()` -- correlates lifestyle factors (walk, smoking, sleep, fluid) with bowel outcomes
- `findStalledFoods()` -- detects stalled transit for real-time alerts

None of these functions have any automated tests.

**Location:** `src/lib/analysis.ts:1-910`

**Impact:** This code directly influences dietary recommendations during post-surgical recovery. A bug in `outcomeFromTransitAndCategory()` could incorrectly classify a food as "safe" when it should be "risky", or vice versa. The algorithm has multiple boundary conditions (55 min, 8h, 14h, 18h transit windows) that are easy to get wrong.

**Recommendation:** This file should have the highest test coverage in the entire codebase. Write unit tests for:

- `outcomeFromTransitAndCategory()` at every boundary (54.9 min, 55 min, 7.9h, 8h, 13.9h, 14h, 17.9h, 18h, 18.1h) with each digestive category
- `resolveAllCorrelations()` with known food/bowel event sequences to verify correct pairing
- `buildFoodStats()` status graduation logic (testing -> safe/risky/watch) with edge cases around the 2-trial threshold
- `normalizeDigestiveCategory()` with all Bristol codes (1-7) and consistency tags
- `normalizeEpisodesCount()` with edge values (0, -1, 21, NaN, undefined, "abc")
- `analyzeFactors()` with mock day data for each factor correlation
- BRAT baseline override logic

---

#### C3: Store Migration Logic Untested

**Description:** The Zustand store at `src/store.ts:327-373` contains a `migrate` function (version 8) that transforms persisted state when the schema changes. This migration handles habits normalization, fluid presets, gamification state, health profile, and Dr. Poo replies. If this migration function has a bug, users lose their data on app update.

**Location:** `src/store.ts:327-373`

**Impact:** A broken migration corrupts user data silently. Since the app uses IndexedDB persistence, corrupted state could persist across page reloads. Users would lose their food safety database, streak data, and health profile.

**Recommendation:** Write migration tests that:

- Pass a version 7 (or older) state shape through the migrator and assert correct output
- Test migration with missing fields (habits=undefined, gamification=null)
- Test migration with invalid data (habits array with malformed entries)
- Test migration with empty state
- Test that `calibrations` and `logs` keys are deleted

---

### HIGH Severity

#### H1: AI Response Parsing Has Partial Guards But No Tests

**Description:** `src/lib/foodParsing.ts` contains runtime validators (`isValidFoodComponent`, `isValidParsedFoodItem`, `isValidFoodParseResult`) and a fallback mechanism (`buildFallbackResult`). These are well-designed but completely untested. Similarly, `src/lib/aiAnalysis.ts:491-518` has `applyFallbacks()` for the AI nutritionist response. The `parseAiInsight()` function in `src/store.ts:185-204` also validates AI response shapes.

**Location:** `src/lib/foodParsing.ts:99-165`, `src/lib/aiAnalysis.ts:491-518`, `src/store.ts:185-204`

**Impact:** If the LLM returns an unexpected JSON structure, the validators and fallbacks are the last line of defense. Untested validators may have gaps -- for example, `isValidFoodComponent` allows `undefined` for `quantity` and `unit` (lines 106-108), but the downstream `normalizeComponent` expects `null`. If the validator passes a shape the normalizer does not handle, runtime errors could occur.

**Recommendation:** Test each validator with:

- Valid input (happy path)
- Missing required fields (`name`, `canonicalName`, `isNew`)
- Extra unexpected fields
- Wrong types (number where string expected)
- Null/undefined values for optional fields
- `buildFallbackResult()` with various raw text inputs (empty, single item, comma-separated, semicolons)
- `applyFallbacks()` with partial AI responses (missing `nextFoodToTry`, wrong `sideQuest` shape)

---

#### H2: Streak Logic Has Subtle Boundary Conditions

**Description:** `src/lib/streaks.ts` implements streak counting with shield mechanics. `updateStreak()` has multiple branches: same-day logging, consecutive day, missed-1-day with shield, streak broken. The week-based shield reset depends on `date-fns` `startOfWeek` with `weekStartsOn: 1`. The `checkNewBadges()` function has threshold checks.

**Location:** `src/lib/streaks.ts:77-175`

**Impact:** Incorrect streak logic could break the gamification system, which is designed to maintain ADHD engagement. A bug where streaks never reset or always reset would undermine user motivation.

**Recommendation:** Test `updateStreak()` with:

- First log ever (empty `lastLogDate`)
- Same-day second log
- Consecutive day (daysDiff = 1)
- Missed one day with shield available (daysDiff = 2, shieldsUsed = 0)
- Missed one day with shield already used (daysDiff = 2, shieldsUsed = 1)
- Missed two days (daysDiff = 3)
- Week boundary shield reset
- `checkNewBadges()` at each threshold (1, 10, 50, 100 entries; 7, 30 day streaks)

---

#### H3: `data: any` Used Throughout -- No Type Discrimination

**Description:** The `LogEntry` interface uses `data: any` (`src/store.ts:89`). This `any` type propagates through `SyncedLog`, the Convex schema (`v.any()` in 5 places), and all components that read log data. There are 20+ occurrences of `data: any` across the codebase. Every access to `log.data` requires unsafe property access with no compile-time guarantees.

**Location:** `src/store.ts:89`, `src/lib/sync.ts:12`, `convex/schema.ts:81,89-91`, and 15+ component files

**Impact:** TypeScript cannot catch property access errors on `data`. Typos like `log.data?.birstolCode` (instead of `bristolCode`) would compile without error. This is especially dangerous in `src/lib/analysis.ts` where every food/digestion/habit/activity log is parsed from `data`.

**Recommendation:** Define discriminated union types for each log type's data shape:

```typescript
type FoodData = { items: FoodItem[]; notes: string };
type DigestionData = { bristolCode: number; consistencyTag: string; ... };
type LogEntry =
  | { type: "food"; data: FoodData; ... }
  | { type: "digestion"; data: DigestionData; ... }
  | ...;
```

This converts a large category of runtime bugs into compile-time errors.

---

#### H4: TypeScript `strict` Mode Not Enabled

**Description:** The `tsconfig.json` does not enable `strict: true` or any of its constituent flags (`strictNullChecks`, `strictFunctionTypes`, `strictBindCallApply`, `noImplicitAny`, `noImplicitThis`, `alwaysStrict`). The `noExplicitAny` lint rule is also disabled in `biome.json`.

**Location:** `tsconfig.json:1-26`, `biome.json:19`

**Impact:** Without `strictNullChecks`, TypeScript does not enforce null/undefined checks. Code like `const code = Number(log.data?.bristolCode)` could silently produce `NaN` and TypeScript would not flag the potential null path. Without `noImplicitAny`, function parameters can accidentally be typed as `any`.

**Recommendation:** Enable `strict: true` in `tsconfig.json`. This will surface a number of existing type issues that represent real potential runtime bugs. Fix them incrementally. Re-enable `noExplicitAny` in biome and replace `any` types with proper interfaces.

---

#### H5: Convex Backend Has No Authorization

**Description:** All Convex mutations and queries accept a `syncKey` string parameter and use it as the sole access control mechanism. There is no authentication. Any client can read/write/delete any user's logs if they know or guess the sync key. The default sync key is `"my-recovery-key"` (`src/store.ts:209`).

**Location:** `convex/logs.ts:128-143` (add mutation), `convex/logs.ts:145-152` (remove mutation), `src/store.ts:209`

**Impact:** Any user's health data can be read, modified, or deleted by anyone who knows the sync key. The default key means all new users share the same namespace until they change it. This is a security and data integrity issue.

**Recommendation:** While not strictly a testing issue, this should be tested: write integration tests that verify data isolation between sync keys. At minimum, add a test that confirms the default sync key is changed during onboarding. Long-term, implement Convex authentication.

---

#### H6: Convex Schema/Validator Mismatch

**Description:** The `habitTypeValidator` in `convex/schema.ts:14-26` includes `v.literal("sweets")`, but the frontend `HabitType` in `src/lib/habitTemplates.ts:3-13` does not include `"sweets"` as a valid type. The `convex/logs.ts:23-34` validator also lacks `"sweets"`. This means the schema allows a value that the logs validator would reject, and neither matches the frontend types exactly.

**Location:** `convex/schema.ts:20` vs `convex/logs.ts:23-34` vs `src/lib/habitTemplates.ts:3-13`

**Impact:** If a profile is saved with habitType `"sweets"`, it would pass schema validation but fail the logs validator. The frontend would never produce this value, but it creates a mismatch between what the database schema allows and what the application understands.

**Recommendation:** Synchronize validators across schema, mutations, and frontend types. Consider generating types from the Convex schema to maintain a single source of truth. Test that all habit types accepted by the frontend are accepted by all Convex validators.

---

### MEDIUM Severity

#### M1: `parseAiInsight()` Does Not Validate Nested Object Shapes

**Description:** In `src/store.ts:185-204`, `parseAiInsight()` checks that `suspectedCulprits` is an array but does not validate the shape of individual items within that array. It casts with `as AiNutritionistInsight["nextFoodToTry"]` without verifying the object has `food`, `reasoning`, and `timing` properties.

**Location:** `src/store.ts:192-203`

**Impact:** If the AI returns `suspectedCulprits: [{ wrong: "shape" }]`, it would pass validation and be stored, potentially causing runtime errors when components try to render `culprit.food` and get `undefined`.

**Recommendation:** Add nested validation for array items. Test with malformed nested objects.

---

#### M2: `normalizeDigestiveCategory()` Defaults to "loose"

**Description:** When neither a valid consistency tag nor a valid Bristol code is present, `normalizeDigestiveCategory()` returns `"loose"` as the default (`src/lib/analysis.ts:789`).

**Location:** `src/lib/analysis.ts:769-790`

**Impact:** Missing data defaults to a negative outcome ("loose"), which could unfairly penalize foods. If the bowel log has no consistency data due to a UI bug, all associated food trials would be classified as "loose" outcomes, potentially marking safe foods as "safe-loose".

**Recommendation:** Consider defaulting to `"firm"` (neutral) instead, or returning a separate "unknown" category that is excluded from analysis. Test this function with undefined, null, empty string, and invalid inputs.

---

#### M3: `worstBristol()` Uses `Math.max()` on Empty Arrays

**Description:** `worstBristol()` at `src/lib/analysis.ts:578` calls `Math.max(...codes)`. If `codes` is empty, `Math.max()` returns `-Infinity`. This value would then be used in average Bristol calculations.

**Location:** `src/lib/analysis.ts:578-580`

**Impact:** While `analyzeFactors()` filters for days with `bristolCodes.length > 0` before calling day metrics, a future code change could introduce a path where an empty array reaches `worstBristol()`, corrupting factor correlation calculations.

**Recommendation:** Add a guard: `if (codes.length === 0) return 0;` or throw. Add a unit test for this edge case.

---

#### M4: `buildSmokingCorrelation()` Median Calculation for Even-Length Arrays

**Description:** The median calculation at `src/lib/analysis.ts:682` uses `Math.floor(counts.length / 2)` to pick the median index. For an even number of elements, this picks the lower of the two middle values (not the average). This is technically a "lower median" but could bias the split.

**Location:** `src/lib/analysis.ts:680-682`, also `src/lib/analysis.ts:740-741` for fluid

**Impact:** Minor statistical bias in factor correlations. With an even number of smoking days, the median split may not be balanced.

**Recommendation:** Document the choice or use `(counts[mid-1] + counts[mid]) / 2` for true median. Test with even and odd array lengths.

---

#### M5: `toMillilitersEstimate()` Default Estimation Could Inflate Fluid Totals

**Description:** In `src/lib/trackMetrics.ts:42-58`, when no explicit quantity is present, 250ml is assumed. When a quantity exists but the unit is unknown, it multiplies by 250. So `{ quantity: 3, unit: "" }` yields 750ml, treating "3" as "3 servings of 250ml each", but the user might have meant "3 cups" (720ml) or "3 glasses" (~900ml).

**Location:** `src/lib/trackMetrics.ts:47,57`

**Impact:** Fluid totals displayed to the user may be inaccurate, especially for non-standard units.

**Recommendation:** Test with various quantity/unit combinations. Document the estimation assumptions.

---

#### M6: `useAiInsights` Has Race Condition Potential

**Description:** The `useAiInsights` hook uses `loadingRef.current` as a mutex, but `runAnalysis` can be called from `triggerAnalysis` which is invoked on every food/bowel log. The `loadingRef.current` is only reset in the `finally` block after the async operation completes. If `triggerAnalysis` is called while a request is in flight, it correctly returns early. However, the `abortRef.current?.abort()` at line 41 aborts the previous request, yet line 110 checks `!controller.signal.aborted` before resetting `loadingRef.current`. If a request is aborted, `loadingRef.current` remains `true` permanently, blocking all future analyses.

**Location:** `src/hooks/useAiInsights.ts:37-113`

**Impact:** A race condition where a user rapidly logs food then bowel movement could permanently lock out AI analysis until page reload.

**Recommendation:** Reset `loadingRef.current = false` unconditionally in the `finally` block, or only when the current controller matches `abortRef.current`. Write a test that simulates rapid sequential calls.

---

#### M7: `handleDecrementHabit` Finds Latest Log by Name OR ID

**Description:** In `src/pages/Track.tsx:318-333`, the decrement handler finds the latest habit log matching either `habitId` or `name`. This could match the wrong log if two habits share a name but have different IDs.

**Location:** `src/pages/Track.tsx:318-333`

**Impact:** Decrementing one habit could accidentally remove a log entry for a different habit with the same display name.

**Recommendation:** Match exclusively on `habitId` when available. Test decrement behavior with duplicate-named habits.

---

### LOW Severity

#### L1: `readText()` Converts `undefined` to `"undefined"` Before Trimming

**Description:** `readText()` at `src/lib/analysis.ts:902-904` uses `String(value ?? "")`. If `value` is explicitly `null`, this returns `""`. If `value` is `undefined`, `??` passes it through and `String(undefined)` returns `"undefined"`. Wait -- `undefined ?? ""` returns `""`, so this is actually correct. However, `String(0)` returns `"0"` and `String(false)` returns `"false"` which might not be intended for a text extraction function.

**Location:** `src/lib/analysis.ts:902-904`

**Impact:** Low. Numeric or boolean values in data fields would be converted to their string representations, which is likely acceptable.

**Recommendation:** Add a test to document the expected behavior for non-string inputs.

---

#### L2: `findStalledFoods()` Is Defined But Never Exported

**Description:** `findStalledFoods()` at `src/lib/analysis.ts:493-508` is a private function only used internally by `buildInsightText()`. It cannot be independently tested without restructuring.

**Location:** `src/lib/analysis.ts:493-508`

**Impact:** The function is indirectly tested through `buildInsightText()`, but isolated unit testing would be cleaner.

**Recommendation:** Either export it for direct testing or test it through integration tests of `analyzeLogs()`.

---

#### L3: `sounds.ts` Swallows AudioContext Errors

**Description:** `getAudioContext()` catches all errors silently and returns `null`. `ctx.resume().catch(() => {})` also swallows errors.

**Location:** `src/lib/sounds.ts:6-11,41`

**Impact:** Audio failures are invisible. Not a major issue since sound is non-essential.

**Recommendation:** Log errors at debug level for troubleshooting. Not a testing priority.

---

#### L4: Error Boundary Does Not Report Errors to Any Service

**Description:** `RouteErrorBoundary` in `src/App.tsx:45-94` catches render errors and logs to `console.error` but has no error reporting integration (Sentry, LogRocket, etc.).

**Location:** `src/App.tsx:45-94`

**Impact:** Production errors in component rendering are invisible to the developer.

**Recommendation:** Add error reporting. Test that the error boundary renders the recovery UI when a child throws.

---

#### L5: Hardcoded Patient Constants in `aiAnalysis.ts`

**Description:** `src/lib/aiAnalysis.ts:12-14` has hardcoded patient data (surgery date, weight, height) that should come from the health profile in the store.

**Location:** `src/lib/aiAnalysis.ts:12-14`

**Impact:** The AI system prompt uses stale data rather than the user's actual health profile. The health profile is configurable in Settings but the AI analysis does not read it.

**Recommendation:** Pass health profile data from the store into `fetchAiInsights()`. Test that the system prompt includes current profile data.

---

---

## Recommended Test Strategy

### Phase 1: Foundation (Week 1)

1. **Install Vitest + Testing Library**

   ```bash
   bun add -d vitest @testing-library/react @testing-library/jest-dom jsdom
   ```

2. **Configure Vitest** (`vitest.config.ts`):

   ```typescript
   import { defineConfig } from "vitest/config";
   import path from "path";

   export default defineConfig({
     test: {
       environment: "jsdom",
       globals: true,
       setupFiles: ["./src/test/setup.ts"],
     },
     resolve: {
       alias: { "@": path.resolve(__dirname, "./src") },
     },
   });
   ```

3. **Add test script** to `package.json`:
   ```json
   "test": "vitest",
   "test:ci": "vitest run"
   ```

### Phase 2: Critical Path Tests (Week 1-2)

Focus on pure functions that can be tested without mocking:

1. **`src/lib/analysis.ts`** -- 30+ test cases covering:
   - `outcomeFromTransitAndCategory()` boundary tests
   - `resolveAllCorrelations()` with known data
   - `buildFoodStats()` status graduation
   - `normalizeDigestiveCategory()` all inputs
   - `normalizeEpisodesCount()` edge cases
   - `analyzeLogs()` integration with realistic log data

2. **`src/lib/streaks.ts`** -- 15+ test cases:
   - `updateStreak()` all branches
   - `checkNewBadges()` threshold tests
   - `shouldShowSleepNudge()` time-based logic

3. **`src/lib/foodParsing.ts`** -- 10+ test cases:
   - Validator functions with valid/invalid inputs
   - `buildFallbackResult()` edge cases
   - `normalizeItem()` and `normalizeComponent()`

4. **`src/store.ts`** -- 10+ test cases:
   - `parseAiInsight()` with various shapes
   - `normalizeFluidPresets()` deduplication
   - Migration function with old state shapes

5. **`src/lib/trackMetrics.ts`** -- 10+ test cases:
   - `calculateTrackTotals()` with various log combinations
   - `toMillilitersEstimate()` unit conversions

6. **`src/lib/habitTemplates.ts`** -- 10+ test cases:
   - `normalizeHabitConfig()` with partial inputs
   - `inferHabitType()` regex matching
   - `createCustomHabit()` output shape

### Phase 3: Integration Tests (Week 3)

1. **Zustand store integration** -- test action sequences (addHabit -> removeHabit, recordLogEntry -> checkNewBadges)
2. **Analysis pipeline integration** -- feed realistic log sequences through `analyzeLogs()` and verify complete output
3. **Food parsing with mock OpenAI** -- mock the OpenAI client and test the full `parseFood()` pipeline

### Phase 4: Component Tests (Week 4+)

1. **BowelSection** -- form state management, Bristol code selection, save callback
2. **FoodSection** -- input validation, loading states, error handling
3. **TodayLog** -- log rendering, delete/edit flows
4. **Settings** -- profile sync flow, habit management

### Phase 5: E2E Tests (Future)

Install Playwright for critical user flows:

- Log food -> observe correlation -> check food safety database
- Log bowel movement -> verify AI analysis triggers
- Cross-device sync (save profile -> load on new session)

---

## Priority Test Additions (Ranked)

| Priority | File                | Function(s)                        | Est. Tests | Rationale                                                    |
| -------- | ------------------- | ---------------------------------- | ---------- | ------------------------------------------------------------ |
| 1        | `analysis.ts`       | `outcomeFromTransitAndCategory`    | 20         | Core medical correlation logic with 4 boundary conditions    |
| 2        | `analysis.ts`       | `resolveAllCorrelations`           | 8          | Pairing algorithm determines which food caused which outcome |
| 3        | `analysis.ts`       | `buildFoodStats`                   | 12         | Safety status graduation affects dietary recommendations     |
| 4        | `store.ts`          | `migrate`                          | 8          | Data loss prevention on version upgrades                     |
| 5        | `streaks.ts`        | `updateStreak`                     | 10         | Gamification correctness for ADHD engagement                 |
| 6        | `foodParsing.ts`    | validators + `buildFallbackResult` | 10         | AI response safety net                                       |
| 7        | `analysis.ts`       | `normalizeDigestiveCategory`       | 8          | Input normalization affects all downstream analysis          |
| 8        | `trackMetrics.ts`   | `calculateTrackTotals`             | 8          | Dashboard accuracy                                           |
| 9        | `habitTemplates.ts` | `normalizeHabitConfig`             | 8          | Settings data integrity                                      |
| 10       | `store.ts`          | `parseAiInsight`                   | 6          | AI insight storage safety                                    |
| 11       | `analysis.ts`       | `analyzeFactors`                   | 8          | Lifestyle correlation accuracy                               |
| 12       | `streaks.ts`        | `shouldShowSleepNudge`             | 6          | Nudge timing correctness                                     |

**Estimated total: ~112 test cases to achieve meaningful coverage of all business logic.**

---

## Overall Testing Assessment

| Criterion           | Rating | Notes                                                                 |
| ------------------- | ------ | --------------------------------------------------------------------- |
| Test Coverage       | 0/10   | Zero tests exist                                                      |
| Test Infrastructure | 0/10   | No framework installed                                                |
| Type Safety         | 3/10   | TypeScript without strict mode; `any` throughout data layer           |
| Runtime Validation  | 5/10   | Good validators exist for AI responses; poor for log data             |
| Error Handling      | 4/10   | Fallbacks exist for AI failures; errors logged to console only        |
| Data Integrity      | 3/10   | Migration exists but untested; no schema validation on log data       |
| Security Testing    | 0/10   | No auth; sync key is sole access control; API key stored in IndexedDB |
| Regression Safety   | 0/10   | No CI pipeline, no pre-commit hooks, no test gates                    |
| Code Testability    | 7/10   | Business logic is well-separated into pure functions; easy to test    |

**The good news:** The codebase architecture is actually well-suited for testing. Business logic is cleanly separated from UI in pure functions within `src/lib/`. The analysis engine, streak logic, metric calculations, and validators can all be tested with zero mocking. This means high-value test coverage can be achieved quickly.

**The bad news:** With zero tests, every change is a gamble. The 910-line food correlation engine -- the heart of the application -- has never been verified against known-good inputs and outputs. Given that this application helps a post-surgical patient make dietary decisions, this is a meaningful quality and safety gap.
