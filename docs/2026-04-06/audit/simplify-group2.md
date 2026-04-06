# Simplification Audit — Group 2

**Date:** 2026-04-06
**Branch:** feat/nutrition
**Files audited:** e2e specs, index.html, package.json, playwright.config.ts, scripts/ship/_.json, shared/**tests**/_.test.ts, shared/\*.ts, skills-lock.json

---

## Summary

The shared/ food pipeline code is generally well-structured. The main simplification opportunities are in the E2E test helpers (duplicated navigation boilerplate), test factory functions duplicated across multiple test files, the `pickFoodDigestionMetadata` function pattern, and the `foodProjection.ts` re-export that adds an indirection layer with no benefit.

The `scripts/ship/` JSON files are static data artifacts (review findings records) — no code findings apply to them. `index.html`, `package.json`, `playwright.config.ts`, and `skills-lock.json` are all appropriately minimal.

---

### [HIGH] Duplicated `foodLog` and `digestionLog` factory functions across three test files

**Category:** DRY

**Files:**

- `shared/__tests__/foodEvidence.test.ts:L14-L47`
- `shared/__tests__/foodEvidence.thresholds.test.ts:L16-L71`
- `shared/__tests__/foodEvidence.trigger.test.ts:L16-L49`

**Description:**
The `foodLog` and `digestionLog` factory functions are copy-pasted across three separate test files with near-identical implementations. `foodEvidence.test.ts` and `foodEvidence.trigger.test.ts` have identical `digestionLog` signatures including the optional `episodesCount` parameter; `foodEvidence.thresholds.test.ts` uses a slightly simpler variant (no `episodesCount`). The `buildDailyTrialSeries` helper is also duplicated between `foodEvidence.test.ts` (with `confoundedIndexes` support) and `foodEvidence.thresholds.test.ts` (without it), sharing ~90% of the same code.

These factories are the foundational building blocks for all food evidence tests. When the `FoodEvidenceLog` shape changes, all three files must be updated in lockstep.

**Suggested Simplification:**
Extract `foodLog`, `digestionLog`, `habitLog`, `activityLog`, and a full `buildDailyTrialSeries` into a shared test helper file at `shared/__tests__/foodEvidenceTestHelpers.ts` (or a `__tests__/helpers/` subdirectory). Each test file imports what it needs. The `buildDailyTrialSeries` in the thresholds file is a subset of the one in `foodEvidence.test.ts` — use the fuller version with optional parameters.

---

### [HIGH] `foodProjection.ts` re-exports `resolveCanonicalFoodName` it doesn't own

**Category:** Redundancy

**Files:**

- `shared/foodProjection.ts:L6`
- `shared/foodCanonicalName.ts`

**Description:**
`foodProjection.ts` contains this line:

```ts
export { resolveCanonicalFoodName } from "./foodCanonicalName";
```

This is a pure re-export of a function that lives in `foodCanonicalName.ts`. `foodProjection.ts` imports `resolveCanonicalFoodName` for its own internal use (line 1) and then also re-exports it for other consumers. This means there are now two ways to import `resolveCanonicalFoodName`: from `./foodCanonicalName` (the source of truth) and from `./foodProjection` (an accidental re-export). `foodPipelineDisplay.test.ts` (line 14) already imports it from `foodProjection`, which obscures where the function actually lives.

**Suggested Simplification:**
Remove the re-export from `foodProjection.ts`. Consumers that need `resolveCanonicalFoodName` should import it directly from `./foodCanonicalName`. The test file `foodPipelineDisplay.test.ts` should update its import path accordingly. This eliminates the ambiguity about ownership.

---

### [HIGH] `pickFoodDigestionMetadata` uses verbose spread-object pattern instead of a direct pick

**Category:** Over-Engineering

**Files:**

- `shared/foodRegistryUtils.ts:L38-L75`

**Description:**
`pickFoodDigestionMetadata` builds an object by conditionally spreading individual properties using `...(source.foo !== undefined && { foo: source.foo })` for each of 10 fields. This 35-line pattern is a workaround to strip `undefined` values while preserving correct TypeScript types, but it is significantly harder to read than a simple direct assignment, and it makes it easy to forget a field when adding new metadata properties to `FoodDigestionMetadata`.

The function is also used only once (`getFoodDigestionMetadata` in the same file, line 88) and the result is simply checking if any keys are set before returning.

**Suggested Simplification:**
Replace the spread pattern with a direct object assignment that uses the source fields directly, then filter keys:

```ts
export function pickFoodDigestionMetadata(
  source: FoodDigestionMetadata,
): FoodDigestionMetadata | undefined {
  const result: Partial<FoodDigestionMetadata> = {};
  for (const key of Object.keys(source) as (keyof FoodDigestionMetadata)[]) {
    if (source[key] !== undefined) {
      (result as Record<string, unknown>)[key] = source[key];
    }
  }
  return Object.keys(result).length > 0
    ? (result as FoodDigestionMetadata)
    : undefined;
}
```

Or alternatively, since `FoodDigestionMetadata` already uses all-optional fields, simply return `source` when any field is set and `undefined` when all are `undefined`. Either approach halves the line count and makes adding new fields trivially safe.

---

### [MODERATE] E2E test files duplicate identical navigation/setup boilerplate

**Category:** DRY

**Files:**

- `e2e/nutrition-water-modal.spec.ts:L39-L55` (test "water icon opens the WaterModal" duplicates setup already in `openWaterModal` helper)
- `e2e/sleep-tracking.spec.ts:L60-L68` (every test repeats `await page.goto("/"); await expect(page.locator("#root")).toBeVisible();`)
- `e2e/weight-tracking.spec.ts:L16-L19`, `L28-L31`, `L45-L48` (same pattern)
- `e2e/track-page.spec.ts:L4-L7` (same pattern)

**Description:**
Multiple test files contain the same two-line navigation preamble:

```ts
await page.goto("/");
await expect(page.locator("#root")).toBeVisible();
```

In `sleep-tracking.spec.ts` and `weight-tracking.spec.ts`, this appears in every single test body. In `nutrition-water-modal.spec.ts`, the first test (`water icon opens the WaterModal`, lines 39-55) manually replicates the full sequence from the `openWaterModal` helper without calling it, which means if the NutritionCard visibility check changes, there are now two places to update.

**Suggested Simplification:**
Use Playwright's `test.beforeEach` hook at the `describe` level to navigate to `/` and assert `#root` is visible. This is the idiomatic Playwright pattern. The `openWaterModal` helper in `nutrition-water-modal.spec.ts` already handles navigation internally — the first test should simply call `openWaterModal` and then immediately check that the modal is NOT visible before clicking (i.e., test that the modal starts hidden, then opens).

---

### [MODERATE] `nutrition-logfood-modal.spec.ts` helper functions accept `Page` but the `import("@playwright/test").Page` inline type is repeated on every helper signature

**Category:** Over-Engineering

**Files:**

- `e2e/nutrition-logfood-modal.spec.ts:L32, L43, L55, L79`
- `e2e/sleep-tracking.spec.ts:L13, L19, L36`
- `e2e/weight-tracking.spec.ts:L13`

**Description:**
Helper functions across multiple E2E test files use `import("@playwright/test").Page` as the inline parameter type on every function instead of declaring a type alias at the top of the file. For example, `nutrition-logfood-modal.spec.ts` repeats this inline import 4 times across 4 helper functions.

`patterns-food-trials.spec.ts` correctly imports `type { Locator, Page } from "@playwright/test"` at the top (line 1) and uses the named type throughout — this is the better pattern.

**Suggested Simplification:**
Add `import type { Page } from "@playwright/test"` at the top of each affected file and use `Page` directly in function signatures. This matches the pattern already used in `patterns-food-trials.spec.ts` and is more readable.

---

### [MODERATE] `foodNormalize.ts` contains `prefersSummaryCandidate` — a function that does not belong in a "normalize" module

**Category:** Over-Engineering

**Files:**

- `shared/foodNormalize.ts:L276-L301`

**Description:**
`foodNormalize.ts` is described as containing "shared food name normalisation utilities" and exports `normalizeFoodName`, `formatFoodDisplayName`, and `formatCanonicalFoodDisplayName`. These are all pure string-transformation functions that operate on a single food name.

However, the file also exports `prefersSummaryCandidate<T>`, a generic comparison function that takes two `foodTrialSummary`-like rows and determines which to prefer. This is database-record comparison logic, not string normalization. Its comment describes it as "used by computeAggregates + aggregateQueries", which are server-side Convex operations.

**Suggested Simplification:**
Move `prefersSummaryCandidate` to a more appropriate home — either a new `shared/foodSummaryUtils.ts`, or alongside the Convex aggregate query code where it is actually used. `foodNormalize.ts` should remain focused on string normalization of food names only.

---

### [MODERATE] `foodCanonicalization.ts` re-exports the entire `foodRegistry` public API

**Category:** Redundancy

**Files:**

- `shared/foodCanonicalization.ts:L15-L42`

**Description:**
`foodCanonicalization.ts` re-exports 16 names from `foodRegistry.ts` (types and functions) that it does not itself use for its own canonicalization logic. The file's stated purpose is "food canonicalization — deterministic path", but it doubles as a barrel for the entire registry API.

This means consumers can import `getFoodEntry`, `FOOD_REGISTRY`, etc. from either `./foodCanonicalization` or `./foodRegistry` — there are now two correct import paths for the same symbols. `foodParsing.ts` imports `canonicalizeKnownFoodName` and `getFoodZone` from `./foodCanonicalization` (line 17), while `foodEvidence.ts` imports `getFoodZone` and `getFoodGroup` from `./foodRegistry` directly — two different conventions for accessing the same registry.

**Suggested Simplification:**
Remove the re-exports from `foodCanonicalization.ts`. Import consumers should import registry functions from `./foodRegistry` or `./foodRegistryUtils` directly. `foodCanonicalization.ts` should only export `canonicalizeKnownFoodName` (and the supporting types it introduces). This makes the dependency graph clear: `foodCanonicalization` depends on `foodRegistry`, not the other way around, and no consumer should be confused about where to import registry utilities.

---

### [MODERATE] `foodEvidence.ts` defines a local `readText` that duplicates the one in `foodProjection.ts`

**Category:** DRY

**Files:**

- `shared/foodEvidence.ts:L402-L404`
- `shared/foodProjection.ts:L29-L31`

**Description:**
Both `foodEvidence.ts` and `foodProjection.ts` independently define the same private helper:

```ts
function readText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
```

These are byte-for-byte identical implementations of the same utility.

**Suggested Simplification:**
Extract `readText` into `shared/logDataParsers.ts` (which already has similar `safeString` and `safeNumber` helpers) or a small `shared/typeGuards.ts`. Both `foodEvidence.ts` and `foodProjection.ts` import from it. Alternatively, `readText` is essentially `safeString` with an empty-string fallback — a one-liner alias `const readText = (v: unknown) => safeString(v) ?? ""` would remove the duplication without creating a new file, if `safeString` is made exportable from `logDataParsers.ts`.

---

### [MODERATE] `patterns-food-trials.spec.ts` loop pattern scans rows imperatively where a filter would be clearer

**Category:** Boring Code

**Files:**

- `e2e/patterns-food-trials.spec.ts:L202-L247` (trial entries test)
- `e2e/patterns-food-trials.spec.ts:L268-L326` (food names test)
- `e2e/patterns-food-trials.spec.ts:L395-L444` (quantity test)

**Description:**
Three tests in this file use an imperative `for` loop over rows with a `break` on the first match — essentially a `find` operation. The pattern is:

```ts
for (let i = 0; i < Math.min(rowCount, N); i++) {
  const row = rows.nth(i);
  ...
  if (condition) {
    // do assertions
    break;
  }
}
```

This structure requires careful reading to understand the intent (find the first row matching some condition and assert on it). The loop also silently skips rows without condition being met and provides no failure message if no qualifying row is found at all. In two of the three cases, there is a `console.warn` at the end for the not-found case, but the test still passes.

**Suggested Simplification:**
Extract the "find first row with resolved trials" logic into a small helper:

```ts
async function findFirstRowWithResolvedTrials(
  page: Page,
  maxRows = 5,
): Promise<Locator | null> {
  const rows = page.locator(SEL.databaseRow);
  const rowCount = await rows.count();
  for (let i = 0; i < Math.min(rowCount, maxRows); i++) {
    const row = rows.nth(i);
    const trialsText = await getTrialsText(row);
    if (parseTrials(trialsText).resolved > 0) return row;
  }
  return null;
}
```

Each test then becomes a simple: `const row = await findFirstRowWithResolvedTrials(page); if (!row) return; /* skip */`. This removes the repeated loop structure and makes the intent immediately clear.

---

### [MODERATE] `_expandFoodRow` helper in `patterns-food-trials.spec.ts` is unused

**Category:** Redundancy

**Files:**

- `e2e/patterns-food-trials.spec.ts:L97-L99`

**Description:**
The file defines `_expandFoodRow` (prefixed with `_` indicating it was written but never used):

```ts
async function _expandFoodRow(row: Locator) {
  await row.click();
}
```

Every test that needs to expand a row calls `row.click()` directly. This function is never called anywhere in the file.

**Suggested Simplification:**
Delete `_expandFoodRow`. It adds noise and the `_` prefix is a workaround smell — if the function were genuinely useful, it would be named without the prefix and used. A `click()` call is already self-explanatory.

---

### [NICE-TO-HAVE] `foodParsing.ts` builds `numericMeasureMatch` and `wordMeasureMatch` regexes inside the function body on every call

**Category:** Over-Engineering

**Files:**

- `shared/foodParsing.ts:L207-L232`

**Description:**
Inside `parseLeadingQuantity`, two `RegExp` objects are constructed on every invocation using `new RegExp(...)` with the shared `MEASURE_UNIT_PATTERN` string interpolated in. Since `MEASURE_UNIT_PATTERN` is a module-level constant and these regexes never vary, they are re-created on every call to `parseLeadingQuantity`.

The other patterns in the same function (`approximateMatch`, `numericSizedMatch`, `numericCountMatch`, etc.) are defined as regex literals directly in the `exec` call — also constructed each call, but as literals they benefit from engine optimization. The two `new RegExp(...)` constructions are notably different in that they build dynamically but with static inputs.

**Suggested Simplification:**
Hoist the two compiled patterns to module level as named constants alongside `MEASURE_UNIT_PATTERN`:

```ts
const NUMERIC_MEASURE_RE = new RegExp(
  `^(\\d+(?:\\.\\d+)?)\\s*(${MEASURE_UNIT_PATTERN})\\s+(?:of\\s+)?(.+)$`,
  "i",
);
const WORD_MEASURE_RE = new RegExp(
  `^(a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\\s+(${MEASURE_UNIT_PATTERN})\\s+(?:of\\s+)?(.+)$`,
  "i",
);
```

Then reference them in `parseLeadingQuantity`. This avoids re-compilation on every parse call and makes the full pattern visible at module level alongside the other constants.

---

### [NICE-TO-HAVE] `foodPortionData.test.ts` hardcodes the expected count `147` as a magic number

**Category:** Boring Code

**Files:**

- `shared/__tests__/foodPortionData.test.ts:L23`

**Description:**
The test asserts `expect(FOOD_PORTION_DATA.size).toBe(147)` — a raw number with no explanation of where 147 comes from. The test also asserts `expect(FOOD_PORTION_DATA.size).toBe(FOOD_REGISTRY.length)` on the line before, making the `147` assertion redundant: if the first assertion passes, the second can only differ if `FOOD_REGISTRY.length` is not 147 (which is already covered).

**Suggested Simplification:**
Remove the hardcoded `147` assertion entirely. The `FOOD_PORTION_DATA.size === FOOD_REGISTRY.length` assertion already guarantees the same constraint without requiring a magic number to be updated every time a food is added to the registry. If the intent is to document the current count, a comment serves better than a brittle equality check.

---

### [NICE-TO-HAVE] `foodEvidence.ts` uses `Array.prototype.forEach` inside `buildFoodTrials` instead of a `for...of` loop

**Category:** Boring Code

**Files:**

- `shared/foodEvidence.ts:L468`

**Description:**
`buildFoodTrials` uses `forEach` with an arrow function:

```ts
parsed.items.forEach((item, index) => {
  ...
});
```

The surrounding loop over `logs` uses `for...of`. The rest of the codebase (including other loops in `foodEvidence.ts`) consistently uses `for...of`. A `forEach` here is slightly inconsistent and cannot use `continue`/`break` if the inner logic ever needs early exit.

**Suggested Simplification:**
Replace with a `for...of` loop with an explicit index counter, matching the style used everywhere else in the file:

```ts
for (let index = 0; index < parsed.items.length; index++) {
  const item = parsed.items[index];
  ...
}
```

---

### [NICE-TO-HAVE] `foodRegistryUtils.ts` exports `PortionData` type that is already exported from `foodPortionData.ts`

**Category:** Redundancy

**Files:**

- `shared/foodRegistryUtils.ts:L21`
- `shared/foodPortionData.ts:L22-L56`
- `shared/foodRegistry.ts:L51`

**Description:**
`PortionData` is defined in `foodPortionData.ts` and is re-exported from both `foodRegistryUtils.ts` (via `export type { PortionData }`) and from `foodRegistry.ts` (via the barrel). Consumers can import `PortionData` from three different paths. The comment on `foodRegistryUtils.ts:L20` explains the re-export is "so consumers can import from this utils file", but this creates ambiguity about the canonical import location.

**Suggested Simplification:**
The barrel `foodRegistry.ts` already re-exports `PortionData` from `foodPortionData.ts` directly (line 51). The re-export in `foodRegistryUtils.ts` is therefore redundant. Remove it from `foodRegistryUtils.ts`. Consumers who want `PortionData` should import from `./foodPortionData` or from `./foodRegistry` (the barrel).

---

### [NICE-TO-HAVE] `nutrition-water-modal.spec.ts` uses arrow functions for `getNutritionCard` and `getWaterModal` defined inside `describe`

**Category:** Boring Code

**Files:**

- `e2e/nutrition-water-modal.spec.ts:L13-L18`

**Description:**
`getNutritionCard` and `getWaterModal` are defined as arrow function constants inside the `describe` block:

```ts
const getNutritionCard = (page: ...) => page.locator(...)
const getWaterModal = (page: ...) => page.locator(...)
```

In `nutrition-logfood-modal.spec.ts`, the equivalent helpers are declared as `async function` statements at module scope, which is consistent with the project's preference for the `function` keyword over arrow functions (per CLAUDE.md). The mixed style within the E2E test suite makes it harder to scan for helpers at a glance.

**Suggested Simplification:**
Move `getNutritionCard` and `getWaterModal` to module scope and declare them as `function` statements (or at minimum, `const` declarations at module scope rather than inside `describe`). This matches the pattern in `nutrition-logfood-modal.spec.ts` and makes helpers easier to find.
