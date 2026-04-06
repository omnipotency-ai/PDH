# Maintainability & Code Quality Audit — Group 2

**Date:** 2026-04-06
**Auditor:** Claude (code-review mode)
**Scope:** E2E specs, configs, all `scripts/ship/review-findings-*.json`, `shared/__tests__/`, `shared/*.ts`, `skills-lock.json`, `index.html`, `package.json`, `playwright.config.ts`

---

## Summary

| Severity     | Count |
| ------------ | ----- |
| CRITICAL     | 1     |
| HIGH         | 12    |
| MODERATE     | 17    |
| NICE-TO-HAVE | 7     |

---

## Findings

---

### [CRITICAL] review-findings.json summary block is all-zero, masking 14 real findings

**Category:** Maintainability
**Files:** `scripts/ship/review-findings.json:L169–175`

**Description:** The `review-findings.json` file on the current branch `feat/nutrition` contains 14 substantive findings covering security issues (F001, F004 — CSP vulnerabilities), correctness regressions (F002, F003 — broken PWA icons and screenshots), and MODERATE code-quality issues. Despite this, the `summary` block at the end of the file explicitly reads `{ "critical": 0, "high": 0, "moderate": 0, "nice_to_have": 0 }`. This mismatch is not cosmetic: any automated gate, dashboard, or CI check that reads the summary block to decide whether to allow a merge will see a clean bill of health while the file itself contains findings at HIGH severity (F001, F002, F003). A person skimming the JSON would also see the all-zero summary and stop reading. The findings are completely hidden by the summary that is supposed to surface them.

**Suggested Fix:** Recount and correct the summary:

```json
"summary": {
  "critical": 0,
  "high": 3,
  "moderate": 5,
  "nice_to_have": 0
}
```

(F001, F002, F003 = HIGH per their own `severity` fields; F004, F005, F006, F007, F009 = MODERATE; F008, F010, F011, F012, F013, F014 = LOW — which maps to NICE-TO-HAVE in the project's four-level taxonomy.) Treat the summary as a machine-readable contract, not a post-hoc label.

---

### [HIGH] Inconsistent severity taxonomy across review-findings files creates an unreliable audit corpus

**Category:** Maintainability
**Files:** `scripts/ship/review-findings-pr5-convex-backend.json`, `scripts/ship/review-findings-pr5-ui-components.json`, `scripts/ship/review-findings-total-eclipse-aianalysis.json`, `scripts/ship/review-findings-total-eclipse-pr5.json`, `scripts/ship/review-findings-ui-modals.json`

**Description:** The review-findings corpus uses four different severity taxonomies across its 30 files:

1. `CRITICAL / HIGH / MODERATE / NICE-TO-HAVE` — the declared standard
2. `HIGH / MODERATE / LOW` — used by the total-eclipse and pr5 files (no NICE-TO-HAVE, LOW replaces it)
3. `HIGH / MODERATE / LOW / NICE-TO-HAVE` — pr5-ui-components uses all four including LOW
4. `HIGH / MODERATE` only — some files omit NICE-TO-HAVE entirely

As a result, findings cannot be aggregated across files in any automated way. A query for "all HIGH findings in the codebase" would miss findings labelled LOW that are clearly HIGH by the standard taxonomy (e.g., pr5-convex-backend F002: `Date.now()` inside mutation, labelled LOW, is also HIGH in schema-auth F001 for identical code). The corpus also cannot be sorted by severity to surface the most important work. This undermines the review-findings pattern's core value as a machine-readable audit trail.

**Suggested Fix:** Standardise all files to `CRITICAL / HIGH / MODERATE / NICE-TO-HAVE`. Add a JSON Schema for `review-findings-*.json` and run it in CI. Map LOW → NICE-TO-HAVE across the corpus (LOW is not an official level). Document the severity taxonomy in a `scripts/ship/README.md`.

---

### [HIGH] Review findings `implemented: false` entries are never cleared, making status stale immediately

**Category:** Maintainability
**Files:** All `scripts/ship/review-findings-*.json` files

**Description:** Every finding in all 30 review-findings files has `"implemented": false`. The field exists to track which findings have been fixed, but there is no workflow for marking them `true` after a fix lands. As a result, months-old findings that have been fixed (e.g., findings from `feat/sprint-2.5+` in March 2026 for code already shipped) appear identical to newly discovered open issues. A developer reading any of these files cannot distinguish "this was fixed" from "this is still open". The corpus becomes purely historical documentation within weeks of being written, rather than a living action list.

**Suggested Fix:** Establish a convention: after a sprint ships, run a pass over the relevant findings files and set `"implemented": true` with an optional `"implementedAt": "YYYY-MM-DD"` field. Alternatively, move closed findings to a separate `review-findings-archive/` directory. At minimum, add a comment in `scripts/ship/README.md` that these files are point-in-time snapshots and `implemented` is not actively maintained.

---

### [HIGH] Duplicate helper factories in E2E test files create silent maintenance traps

**Category:** Maintainability / Code Quality
**Files:** `e2e/nutrition-logfood-modal.spec.ts:L32–73`, `e2e/nutrition-water-modal.spec.ts:L13–37`, `e2e/sleep-tracking.spec.ts:L13–18`, `e2e/weight-tracking.spec.ts:L13–15`

**Description:** Each E2E test file defines its own variant of `navigateToNutritionCard`, `getNutritionCard`, and similar page object helpers as inline async functions. The navigation and card-discovery logic is duplicated across at least four files. The logfood modal spec re-implements `enterSearchMode` (L43–49) with its own selector, and the water modal spec duplicates `openWaterModal` with its own timeout-based polling (`page.waitForTimeout(200)`). When a selector like `[data-slot="nutrition-card"]` changes, every file must be updated separately. More critically, the timeout values (100ms, 200ms, 300ms, 500ms) are scattered ad-hoc with no rationale — the logfood spec never uses `waitForTimeout` while the water modal spec calls it after every interaction.

**Suggested Fix:** Extract shared page objects into `e2e/pages/NutritionCardPage.ts` and `e2e/pages/TrackPage.ts` following the Playwright Page Object Model. These should expose methods like `openNutritionCard()`, `openWaterModal()`, `searchForFood(query, expected)`, and `openLogFoodModal()`. Remove all `page.waitForTimeout()` calls — replace with `expect(...).toBeVisible()` waits which are automatically retried by Playwright.

---

### [HIGH] E2E test suite uses fragile `waitForTimeout` instead of Playwright's built-in auto-waiting

**Category:** Code Quality
**Files:** `e2e/nutrition-water-modal.spec.ts:L32,53,69,91,100,115,120,135,159,200,238,258,267,275`, `e2e/weight-tracking.spec.ts:L37,49,65`, `e2e/sleep-tracking.spec.ts` (retry loops at L23–33), `e2e/patterns-food-trials.spec.ts:L149,516`

**Description:** The water modal spec alone has 14 `page.waitForTimeout()` calls. Each one introduces arbitrary wall-clock delay that: (a) makes the suite slower than necessary, (b) makes tests flaky on slower CI machines where 100ms or 200ms is not enough time, and (c) hides the real cause of timing issues. Playwright's expect assertions automatically retry with configurable timeouts — `await expect(modal).toBeVisible()` is both faster and more reliable than `click(); waitForTimeout(200); expect(modal).toBeVisible()`. The sleep-tracking spec has an unusual retry loop (L23–33) that catches and silences errors across three attempts, which can mask real failures as "flaky" rather than surfacing the root cause.

**Suggested Fix:** Remove all `page.waitForTimeout()` calls. Replace with targeted `expect(...).toBeVisible({ timeout: N })` calls where a non-default timeout is justified. The `openSleepPopover` retry loop in `sleep-tracking.spec.ts` should be replaced with a single attempt using a longer timeout, or with a fixture that ensures the app is in the right state before the test starts.

---

### [HIGH] patterns-food-trials.spec.ts mixes TDD intent with live-data assertions — tests are non-deterministic

**Category:** Maintainability / Code Quality
**Files:** `e2e/patterns-food-trials.spec.ts:L118–126,130–155,453–534,541–576`

**Description:** Several tests in this file assert on real database content ("The database should have at least one food row from existing logs or previous test runs"). The `logFoodOnTrack` helper function (L66–73) uses a stale flow that calls `section.locator(SEL.foodInput).first()` then `section.locator(SEL.logFoodButton).click()` — this appears to be an older food-logging flow that bypasses the staged-food modal introduced in the current nutrition card design. The `logFoodOnTrack` helper would silently fail to actually log food in the current UI, making the "logging a new food increases trial count" test (L487–534) potentially always pass when it should fail because no food was actually logged.

Additionally, the "search filters the food list" test (L139–156) asserts only that `filteredCount <= allRowsCount` — this is tautologically true and provides no actual coverage. A test that deletes all food entries would still pass this assertion.

**Suggested Fix:** Audit whether `logFoodOnTrack` still correctly stages and submits food in the current nutrition card UI. If not, update it to use the staged flow matching `nutrition-logfood-modal.spec.ts`. Replace the tautological search filter test with a specific assertion that filtering for a known-present food name returns exactly 1 row.

---

### [HIGH] foodPortionData.test.ts hardcodes the exact registry size (147) — will fail silently as the registry grows

**Category:** Maintainability
**Files:** `shared/__tests__/foodPortionData.test.ts:L23–25`

**Description:** The test asserts `expect(FOOD_PORTION_DATA.size).toBe(147)`. This is a valid regression guard today, but the intent is poorly expressed. When a developer adds a new food to `FOOD_REGISTRY`, they will also need to add a matching entry to `FOOD_PORTION_DATA`. The existing test "has an entry for every FOOD_REGISTRY canonical" (L17–21) already enforces this structural invariant correctly without a hardcoded count. The hardcoded 147 creates a second, weaker version of the same check. When the registry reaches 148 entries, the developer must update both the registry, the portion data map, AND this test — but if they forget to update the test, they get a misleading failure message ("expected 147 to be 148") that doesn't explain what's wrong.

**Suggested Fix:** Remove the `expect(FOOD_PORTION_DATA.size).toBe(147)` assertion. The test at L17–21 already fully enforces the invariant that every registry entry has portion data. If a snapshot of the count is wanted for history, add a comment explaining it: `// Registry has N entries as of YYYY-MM-DD; update when entries are added`.

---

### [HIGH] foodPipelineDisplay.test.ts duplicates resolution logic from `helpers.ts` inline rather than testing the real function

**Category:** Code Quality / Maintainability
**Files:** `shared/__tests__/foodPipelineDisplay.test.ts:L23–56`

**Description:** The test file defines its own copies of `getFoodItemResolutionStatus` (L34–46) and `getFoodItemDisplayName` (L48–56) by hand. These are described as mirroring `src/components/track/today-log/helpers.ts` because "they import React types." The consequence is that the test validates a manually maintained copy of the logic, not the actual implementation. If `helpers.ts` is updated — say, to add a new `resolvedBy` value or change the fallback chain — the test will not catch the regression because it tests the copy, not the original.

**Suggested Fix:** Move `getFoodItemResolutionStatus` and `getFoodItemDisplayName` into `shared/foodProjection.ts` or a separate `shared/foodDisplayHelpers.ts` so they can be tested directly without React dependencies. The `shared/` directory already exists precisely to host code shared between client and server without UI framework imports.

---

### [HIGH] foodEvidence.thresholds.test.ts `makeTrial` uses `Math.random()` for `trialId` — non-deterministic test artifact

**Category:** Code Quality
**Files:** `shared/__tests__/foodEvidence.thresholds.test.ts:L391`

**Description:** The `makeTrial` helper at the bottom of this file generates `trialId` via `Math.random().toString(36).slice(2)`. Because `trialId` is a unique field, any test that inspects trial IDs or compares trial arrays by identity will produce different results on every run. While no current test in this file inspects `trialId` directly, the helper is intended to be reused by future tests. Using `Math.random()` in test fixtures is a code smell that can produce non-reproducible failures and makes test output harder to debug.

**Suggested Fix:** Use a deterministic ID. Options: a counter (`let trialCounter = 0; trialId: \`trial-${trialCounter++}\``), or simply a fixed string when uniqueness is not being tested (`trialId: "trial-test"`). If unique IDs are needed across multiple `makeTrial` calls in a single test, use the index from the call site.

---

### [HIGH] foodCanonicalization.ts is a barrel re-exporter AND a canonicalization engine — two distinct responsibilities in one file

**Category:** Maintainability
**Files:** `shared/foodCanonicalization.ts:L1–43`, `shared/foodCanonicalization.ts:L50–172`

**Description:** `foodCanonicalization.ts` has two distinct and unrelated jobs:

1. Lines 15–42: A barrel re-export of all types and functions from `./foodRegistry` (FOOD_REGISTRY, getFoodEntry, getFoodZone, getLinesByGroup, etc.)
2. Lines 50–172: The actual canonicalization engine — building `EXAMPLE_MAP`, `LEADING_QUANTITY_WORDS`, and `canonicalizeKnownFoodName`

The re-export block is a historical artifact. Every import that uses `from "./foodCanonicalization"` to get `FOOD_REGISTRY` or `getFoodEntry` is importing a thin re-export that adds a module indirection layer for no reason. The real implementation is in `foodRegistry.ts` and `foodRegistryUtils.ts`. This makes it harder to understand the module graph: developers must trace through the barrel to find where types actually live.

**Suggested Fix:** Remove the re-export block (lines 15–42) from `foodCanonicalization.ts`. Update callers that import registry types from `./foodCanonicalization` to import from `./foodRegistry` directly. `foodCanonicalization.ts` should export only `canonicalizeKnownFoodName` and the internal helpers it owns.

---

### [HIGH] review-findings files from older branches cover files that no longer exist or have been significantly refactored

**Category:** Maintainability
**Files:** `scripts/ship/review-findings-transit-map.json`, `scripts/ship/review-findings-use-transit-map-zoom.json`, `scripts/ship/review-findings-total-eclipse-pr5.json`

**Description:** The transit map review files document 25 findings across `TransitMap.tsx`, `TransitMapCanvas.tsx`, `useTransitMapZoom.ts`, and related files. The total-eclipse PR series documents that the transit map feature was "fully stripped" (review-findings-total-eclipse-pr5.json F004, F005). The transit map source files referenced in these findings no longer exist, yet the findings remain in the repository as open, unimplemented issues. Any developer scanning for open HIGH findings would see TM-001 through TM-019 (including a CRITICAL transform bug at TM-001) and attempt to fix code that does not exist. The findings cannot be closed because `implemented` is never updated (see finding above), so these are now permanently misleading noise.

**Suggested Fix:** After the transit map deletion was merged, the transit-map and use-transit-map-zoom review-findings files should have been deleted or moved to `scripts/ship/archive/`. Do that now. The total-eclipse-pr5 findings for transit map CSS (F004, F005) should be marked `implemented: true` since the feature was stripped.

---

### [HIGH] playwright.config.ts has no `reporter` configured — CI failures produce minimal diagnostic output

**Category:** Maintainability
**Files:** `playwright.config.ts:L1–35`

**Description:** The Playwright config has no `reporter` key. By default, Playwright uses the `list` reporter for interactive terminals and `dot` reporter in CI environments. Neither produces structured output suitable for CI dashboards, artifact archiving, or automated failure categorisation. When E2E tests fail in CI, there are no HTML reports, no screenshot attachments, and no video recordings — only terminal stdout. Given that this codebase has ~100+ E2E tests across 8 spec files, debugging failures without artifacts requires re-running locally, which is slow.

**Suggested Fix:**

```ts
reporter: [
  ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ['junit', { outputFile: 'playwright-results.xml' }],
],
```

Add `playwright-report/` and `playwright-results.xml` to `.gitignore`. Set `screenshot: 'only-on-failure'` and `video: 'retain-on-failure'` in the `use` block.

---

### [MODERATE] `foodProjection.ts` contains a re-export of `resolveCanonicalFoodName` alongside its own logic — confusing module ownership

**Category:** Maintainability
**Files:** `shared/foodProjection.ts:L1,6`

**Description:** `foodProjection.ts` imports `resolveCanonicalFoodName` from `./foodCanonicalName` and then immediately re-exports it on line 6: `export { resolveCanonicalFoodName } from "./foodCanonicalName"`. This re-export exists to preserve backwards compatibility for callers that imported `resolveCanonicalFoodName` from `foodProjection.ts` before `foodCanonicalName.ts` was split out. However, it creates a confusing situation: the function is now defined in `foodCanonicalName.ts`, re-exported from `foodProjection.ts`, and used inside `foodProjection.ts` for its own `getLoggedFoodIdentity` and `getCanonicalFoodProjection` implementations. A developer adding a new caller has three plausible import sites.

**Suggested Fix:** Audit and update all import sites that use `resolveCanonicalFoodName` from `./foodProjection` to import from `./foodCanonicalName`. Then remove the re-export from `foodProjection.ts`. This collapses the module graph.

---

### [MODERATE] `foodRegistry.ts` is a second barrel file over `foodRegistryData.ts` + `foodRegistryUtils.ts`, creating three-level indirection

**Category:** Maintainability
**Files:** `shared/foodRegistry.ts:L1–52`

**Description:** The module graph for registry lookups is: `foodRegistryData.ts` (raw data) → `foodRegistryUtils.ts` (lookup functions, imports from foodRegistryData) → `foodRegistry.ts` (barrel re-exporting both) → `foodCanonicalization.ts` (re-exports from foodRegistry) → callers. That is four hops from data to consumer via two barrel files. The `foodRegistry.ts` barrel re-exports `FOOD_PORTION_DATA` from `foodPortionData.ts`, creating a fifth source. This level of indirection exists because the modules were split during a refactor but the barrel file was not cleaned up. Any change to a type in `foodRegistryData.ts` requires checking whether it is re-exported through `foodRegistryUtils.ts`, then through `foodRegistry.ts`, then through `foodCanonicalization.ts`.

**Suggested Fix:** Either collapse `foodRegistry.ts` and `foodRegistryUtils.ts` into a single file (the distinction between "data" and "utils" is already achieved by having `foodRegistryData.ts` be data-only), or eliminate the `foodRegistry.ts` barrel and have all callers import directly from `foodRegistryData.ts` or `foodRegistryUtils.ts`. The current three-file layering adds no encapsulation benefit.

---

### [MODERATE] `logDataParsers.ts` `ParsedFoodItem` type name collides with `ParsedFoodItem` in `foodParsing.ts` — same name, different shape

**Category:** Maintainability / Code Quality
**Files:** `shared/logDataParsers.ts:L22–27`, `shared/foodParsing.ts:L38–52`

**Description:** Both `logDataParsers.ts` and `foodParsing.ts` export a type called `ParsedFoodItem`. The two are structurally different:

- `logDataParsers.ts` `ParsedFoodItem`: lightweight shape with optional `name`, `rawName`, `parsedName`, `userSegment`, `canonicalName` — used as a validation output for evidence pipeline data
- `foodParsing.ts` `ParsedFoodItem`: richer shape with `original`, `canonicalName`, `isNew`, `isComposite`, `quantity`, `unit`, `components`, and optional metadata — used as the output of the parse stage

Any file that imports from both modules must alias one of them. If a developer adds `import { ParsedFoodItem } from "../foodParsing"` to a file that already imports `ParsedFoodItem` from `logDataParsers`, they get a silent name collision with no TypeScript error until the types are used in an incompatible way.

**Suggested Fix:** Rename `logDataParsers.ts`'s type to `ParsedLogFoodItem` or `RawFoodItemData` to reflect its role as a data-layer validation output. The richer `ParsedFoodItem` in `foodParsing.ts` represents a fully parsed result and is the more "canonical" use of that name.

---

### [MODERATE] E2E `patterns-food-trials.spec.ts` has a `_expandFoodRow` helper that is defined but never called (dead code)

**Category:** Code Quality
**Files:** `e2e/patterns-food-trials.spec.ts:L97–99`

**Description:** The function `_expandFoodRow` is defined with an underscore prefix (indicating it may be intentionally unused) and performs `await row.click()`. No test in the file calls `_expandFoodRow`. Every test that expands a row calls `await firstRow.click()` or `await row.click()` directly inline. The underscore prefix is a smell: in this codebase Biome/TypeScript will flag unused variables, so the underscore is used to suppress the warning rather than remove the dead code.

**Suggested Fix:** Delete `_expandFoodRow`. If row expansion is wanted as a named helper, either use it consistently or replace the inline `row.click()` calls throughout the file with it (making the abstraction worth keeping).

---

### [MODERATE] `foodEvidence.transit.test.ts` has a `window()` helper that returns `TransitWindow` but uses an overridden local name for the policy constant

**Category:** Code Quality
**Files:** `shared/__tests__/foodEvidence.transit.test.ts:L19–56`

**Description:** The test file aliased `CLINICAL_TRANSIT_RESOLVER_POLICY` to `POLICY` at line 19, then extracts `FLOOR_MINUTES` from it at line 20. This is fine — but the `window()` helper function (L22–56) re-imports `POLICY` from the outer scope and passes it as `policy: POLICY` into `buildTransitWindow`. The helper conditionally builds a `calibration` object based on whether any calibration-related override is non-undefined. This conditional construction creates a subtle asymmetry: calling `window({ calibrationSource: "default" })` produces a window with explicit calibration, while `window()` with no overrides produces one without calibration. The tests for "uses default center when calibration source is default" (L127) pass `calibrationSource: "default"` explicitly, but the test "applies surgery type when calibration source is default" also passes `calibrationCenter: 1440` along with `calibrationSource: "default"`, which may interact with the policy's internal defaults in a way that is opaque to the reader.

**Suggested Fix:** Add a JSDoc comment to the `window()` helper explaining what constitutes a "no-calibration" call vs. an "explicit-calibration" call, so the asymmetry is visible. Consider splitting into two clearly named helpers: `windowWithDefaultCalibration()` and `windowWithLearnedCalibration(center, spread)`.

---

### [MODERATE] `foodMatchCandidates.test.ts` test name says "last fuzzy candidate wins" but the comment in the implementation says "Map.set overwrites"

**Category:** Code Quality
**Files:** `shared/__tests__/foodMatchCandidates.test.ts:L481–501`

**Description:** The test "last fuzzy candidate with same canonicalName wins" correctly documents the behaviour where `Map.set` overwrites earlier entries. However, this is a silent data loss: if the caller provides two candidates with the same canonical name at different scores, only the last is kept. The test confirms this happens but does not assert that it is the _intended_ semantic. The comment "Map.set overwrites — last entry wins" is descriptive of the implementation, not a specification. This behaviour has no documented justification and is different from what many callers might expect (e.g., "highest scoring wins" would be a more principled policy).

**Suggested Fix:** Either: (a) add a JSDoc to `mergeFoodMatchCandidates` explicitly stating the "last write wins" deduplication policy and why it is correct, or (b) change the implementation to keep the _highest_ scoring duplicate rather than the last, and update the test to reflect this. "Last write wins" is generally a surprising semantic.

---

### [MODERATE] `settings-page.spec.ts` tests a specific settings message that may become stale after copy changes

**Category:** Maintainability
**Files:** `e2e/settings-page.spec.ts:L23`

**Description:** The test asserts `page.getByText(/Your OpenAI API key is stored securely on our servers/i)`. This is a literal string from the UI copy, tied to the current wording. An existing finding (review-findings-settings.json SET-004) identifies that this text is already factually incorrect about how API keys are stored. If the copy is updated to correct the inaccuracy, this test will fail — not because the settings page is broken, but because the expected text changed. E2E tests that assert on prose copy (rather than data-slot attributes or ARIA labels) create coupling between UI copy and test maintenance.

**Suggested Fix:** Use a data-slot attribute on the settings privacy section: `data-slot="api-key-privacy-message"`. Assert `toBeVisible()` on the element rather than `toContainText()` with a literal string. This decouples the test from copy and makes it test the presence of the affordance rather than the exact wording.

---

### [MODERATE] `playwright.config.ts` has no `fullyParallel` setting and no worker limit — slow on multi-core CI

**Category:** Code Quality
**Files:** `playwright.config.ts:L5–35`

**Description:** The config omits `fullyParallel` (defaults to `false`) and `workers` (defaults to half the available CPUs). With 8 spec files and no parallelism configuration, the test suite runs sequentially by default in non-sharded mode. The E2E tests all depend on authenticated state via the `auth-setup` project, which correctly gates the `chromium` project via `dependencies: ["auth-setup"]`. Parallelism is safe for independent tests within the `chromium` project. No `testIdAttribute` is configured, which means Playwright falls back to `data-testid` rather than the codebase's `data-slot` convention.

**Suggested Fix:**

```ts
fullyParallel: true,
workers: process.env.CI ? 2 : undefined,
use: {
  ...
  testIdAttribute: 'data-slot',  // aligns with codebase selector convention
}
```

---

### [MODERATE] `foodParsing.ts` (shared) defines `ParsedFoodItem` with optional fields for a required-in-practice pipeline contract

**Category:** Code Quality
**Files:** `shared/foodParsing.ts:L38–52`

**Description:** `ParsedFoodItem.canonicalName` is typed as `string` (non-optional, no `undefined`), but `ParsedFoodItem.components` is an array of `FoodComponent`, each of which has a non-optional `canonicalName: string`. The `isNew` and `isComposite` flags are both non-optional. This tightly specified type is then used downstream in `buildDeterministicItem`, `mergeParsedItems`, and `resolveExistingCanonicalName` — all of which are tested. However, the test for `buildDeterministicItem` in `foodParsing.test.ts` is not visible in the audited portion of the file (lines 1–100 were read), suggesting the test coverage for these builders may be partial.

**Suggested Fix:** Verify that `buildDeterministicItem`, `resolveExistingCanonicalName`, and `buildExistingNameMap` are covered by tests. The test file currently only tests `sanitiseFoodInput`, `splitRawFoodItems`, and the quantity parser in the readable portion — confirm the full test file covers all exports.

---

### [NICE-TO-HAVE] `skills-lock.json` is checked in but provides no project-specific value documentation

**Category:** Maintainability
**Files:** `skills-lock.json:L1–30`

**Description:** `skills-lock.json` records the hash of five Convex agent skills installed from the `get-convex/agent-skills` GitHub source. The hashes serve as an integrity check, which is good. However, there is no corresponding documentation explaining which skills are active, what each skill does in the context of this project, or how to update them. The filename suggests it is analogous to a lockfile (like `bun.lock`), but a lockfile should be treated as automatically managed — developers should not hand-edit it. Without documentation, developers may not know they need to update it when updating the agent skills, or may update it incorrectly.

**Suggested Fix:** Add a comment block in `scripts/ship/README.md` (or create `docs/ai/agent-skills.md`) explaining what each locked skill does, the command to update skills (`npx convex ai-files install`), and that `skills-lock.json` is auto-managed.

---

### [NICE-TO-HAVE] `index.html` loads three Google Fonts families eagerly — layout shift risk on slow connections

**Category:** Code Quality
**Files:** `index.html:L18–23`

**Description:** The HTML loads `Nunito`, `Bricolage Grotesque`, and `JetBrains Mono` via a single Google Fonts `<link>` with `display=swap`. The `display=swap` parameter prevents invisible text during load, but it causes layout shift (CLS) when the fonts arrive and swap in. Three font families with multiple weights (400–800 for two families, 400–500 for Mono) represents a substantial payload for users on slow connections. There is no `preconnect` for `fonts.googleapis.com` with `crossorigin` attribute, which means the CORS preconnect is suboptimal.

Note: `index.html` line 18–19 does include `<link rel="preconnect" href="https://fonts.googleapis.com" />` and `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />`, which is correct. The remaining concern is font-loading strategy.

**Suggested Fix:** Consider self-hosting the fonts via the `vite-plugin-webfontdownload` package (or equivalent) to avoid GDPR concerns with Google Fonts requests, remove the CDN dependency, and improve font loading performance. At minimum, add `font-display: optional` for JetBrains Mono (used only for code display) to prevent layout shift for that family.

---

### [NICE-TO-HAVE] `foodEvidence.trigger.test.ts` tests `CorrelationType` as a type check with no behavioral assertion

**Category:** Code Quality
**Files:** `shared/__tests__/foodEvidence.trigger.test.ts:L65–72`

**Description:** The describe block "CorrelationType" contains a single test that assigns `"trigger"` and `"transit"` to typed variables and asserts they equal themselves. This tests that TypeScript accepts these string literals as `CorrelationType` — but that is a compile-time check, not a runtime check. The test provides no behavioral coverage and adds noise to the test output. If `CorrelationType` is changed (e.g., a third value is added), this test would not catch any regression.

**Suggested Fix:** Delete this test. Compile-time type checks belong in `.ts` type files, not Vitest tests. If the intent is to document the set of valid values, add a comment to the `CorrelationType` type definition instead.

---

### [NICE-TO-HAVE] `foodEvidence.thresholds.test.ts` has a comment block documenting dead-code removal that is not useful long-term

**Category:** Code Quality
**Files:** `shared/__tests__/foodEvidence.thresholds.test.ts:L379–383`

**Description:** Lines 379–383 contain:

```
// ── Dead code removal verification ──────────────────────────────────────────
// MIN_RESOLVED_TRIALS was deleted from src/lib/foodStatusThresholds.ts (WQ-049).
// Verified by: if it were re-exported, importing it would cause a compile error
// since the constant no longer exists. No runtime test needed.
```

This comment documents a historical refactor decision that no longer needs to be preserved in the test file. As time passes, the WQ-049 work item reference becomes meaningless to new contributors who cannot look it up. The comment takes up 5 lines in the middle of a test file.

**Suggested Fix:** Delete the comment block. If the historical context is important, it belongs in the git commit message or a doc file, not in a test suite.

---

### [NICE-TO-HAVE] `foodRegistry.ts` barrel re-exports `FOOD_PORTION_DATA` from `foodPortionData.ts` — mismatched abstraction level

**Category:** Maintainability
**Files:** `shared/foodRegistry.ts:L50–51`

**Description:** `foodRegistry.ts` re-exports `FOOD_PORTION_DATA` and `PortionData` from `foodPortionData.ts`. Portion data is nutritional/macronutrient data (calories, protein, carbs, fat per 100g, portion sizes). The food registry is structural/taxonomic data (zone, group, line, examples). These are semantically different domains that happen to share the same canonical name key space. Bundling both into a `foodRegistry.ts` barrel muddies the boundary. Callers that only need to look up which zone a food belongs to will also import the portion data bundle.

**Suggested Fix:** Remove the `FOOD_PORTION_DATA` and `PortionData` re-exports from `foodRegistry.ts`. Callers that need portion data should import directly from `foodPortionData.ts` or `foodRegistryUtils.ts` (which already exports `getPortionData`, `calculateCaloriesForPortion`, `calculateMacrosForPortion`).

---

### [NICE-TO-HAVE] `logTypeUtils.ts` is a single 8-line file exporting one function — unnecessary module boundary

**Category:** Code Quality
**Files:** `shared/logTypeUtils.ts:L1–8`

**Description:** `logTypeUtils.ts` exports only `isFoodPipelineType`. The function is 2 lines of logic. Having a dedicated module file for a single 2-line predicate creates overhead for anyone navigating the codebase. Every time a developer does `import { isFoodPipelineType } from "./logTypeUtils"` they have to know this file exists and that it only does this one thing.

**Suggested Fix:** Move `isFoodPipelineType` into `logDataParsers.ts` (where the log-data type infrastructure already lives) or into a small `shared/logUtils.ts` that can accumulate additional log-related utility functions over time. Alternatively, move it into `foodTypes.ts` if log pipeline typing belongs with food type definitions.

---

## Files Reviewed

### E2E Specs

- `e2e/nutrition-logfood-modal.spec.ts`
- `e2e/nutrition-water-modal.spec.ts`
- `e2e/patterns-food-trials.spec.ts`
- `e2e/settings-page.spec.ts`
- `e2e/sleep-tracking.spec.ts`
- `e2e/track-page.spec.ts`
- `e2e/weight-tracking.spec.ts`

### Config & Root Files

- `index.html`
- `package.json`
- `playwright.config.ts`
- `skills-lock.json`

### Review Findings (all 30)

- `scripts/ship/review-findings.json` (feat/nutrition)
- `scripts/ship/review-findings-client-lib.json`
- `scripts/ship/review-findings-convex-ai-payment.json`
- `scripts/ship/review-findings-database-hero.json`
- `scripts/ship/review-findings-docs.json`
- `scripts/ship/review-findings-dr-poo.json`
- `scripts/ship/review-findings-food-pipeline.json`
- `scripts/ship/review-findings-habit-libs.json`
- `scripts/ship/review-findings-hooks-contexts.json`
- `scripts/ship/review-findings-hooks.json`
- `scripts/ship/review-findings-infra.json`
- `scripts/ship/review-findings-lib-utils.json`
- `scripts/ship/review-findings-pages.json`
- `scripts/ship/review-findings-panels.json`
- `scripts/ship/review-findings-pr5-convex-backend.json`
- `scripts/ship/review-findings-pr5-ui-components.json`
- `scripts/ship/review-findings-quick-capture.json`
- `scripts/ship/review-findings-schema-auth.json`
- `scripts/ship/review-findings-server-pipeline.json`
- `scripts/ship/review-findings-settings.json`
- `scripts/ship/review-findings-sync-lib.json`
- `scripts/ship/review-findings-tests.json`
- `scripts/ship/review-findings-today-log-groups-editors.json`
- `scripts/ship/review-findings-today-log.json`
- `scripts/ship/review-findings-total-eclipse-aianalysis.json`
- `scripts/ship/review-findings-total-eclipse-pr5.json`
- `scripts/ship/review-findings-transit-map.json`
- `scripts/ship/review-findings-ui-components.json`
- `scripts/ship/review-findings-ui-modals.json`
- `scripts/ship/review-findings-use-transit-map-zoom.json`

### Shared Tests

- `shared/__tests__/foodCanonicalization.test.ts`
- `shared/__tests__/foodEvidence.test.ts`
- `shared/__tests__/foodEvidence.thresholds.test.ts`
- `shared/__tests__/foodEvidence.transit.test.ts`
- `shared/__tests__/foodEvidence.trigger.test.ts`
- `shared/__tests__/foodMatchCandidates.test.ts`
- `shared/__tests__/foodMatching.test.ts`
- `shared/__tests__/foodNormalize.test.ts`
- `shared/__tests__/foodParsing.test.ts`
- `shared/__tests__/foodPipelineDisplay.test.ts`
- `shared/__tests__/foodPortionData.test.ts`
- `shared/__tests__/foodRegistry.test.ts`

### Shared Source

- `shared/foodCanonicalName.ts`
- `shared/foodCanonicalization.ts`
- `shared/foodEvidence.ts` (1,493 lines — structure reviewed, not line-by-line)
- `shared/foodMatching.ts` (724 lines — structure reviewed)
- `shared/foodNormalize.ts`
- `shared/foodParsing.ts`
- `shared/foodPortionData.ts` (data file — structure reviewed)
- `shared/foodProjection.ts`
- `shared/foodRegistry.ts`
- `shared/foodRegistryData.ts` (data file — structure reviewed)
- `shared/foodRegistryUtils.ts`
- `shared/foodTypes.ts`
- `shared/logDataParsers.ts`
- `shared/logTypeUtils.ts`
