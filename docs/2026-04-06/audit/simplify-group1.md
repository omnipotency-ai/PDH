# Simplification Audit — Group 1

**Auditor:** Claude Sonnet 4.6  
**Date:** 2026-04-06  
**Scope:** convex/\*, e2e/\*, biome.json, components.json, .vscode/settings.json

---

## Summary

The codebase is generally well-structured and boringly correct. Most complexity found has a clear
reason for existing. Findings are concentrated in three areas:

1. **Duplicated private utility functions** across `logs.ts` and `migrations.ts` that could live in a shared location.
2. **Duplicated API-key error helpers** copy-pasted verbatim across `ai.ts` and `foodLlmMatching.ts`.
3. **Repeated e2e locator helpers** defined identically in multiple spec files that should be promoted to the shared `fixtures.ts`.
4. **A pass-through wrapper** (`ingredientProfileProjection.ts`) that is thin enough to eliminate.
5. **An identity switch function** (`verdictToStoredVerdict`) where the type already guarantees identity.
6. **Duplicated `seedProfile` helper** in two test files that could be shared.

---

### [HIGH] Duplicated API-key utility functions across `ai.ts` and `foodLlmMatching.ts`

**Category:** DRY  
**Files:** `convex/ai.ts:L15-L35`, `convex/foodLlmMatching.ts:L113-L130`

**Description:**  
Two identical functions — `maskApiKey(key: string)` and `classifyOpenAiError/classifyHttpError(status: number)` — are copy-pasted between these two files. They implement the same logic with only a name difference (`classifyOpenAiError` vs `classifyHttpError`). The `OPENAI_API_KEY_PATTERN` regex is also independently defined in three files: `ai.ts`, `foodLlmMatching.ts`, and `profiles.ts`.

`maskApiKey` in `ai.ts`:

```
function maskApiKey(key: string): string {
  if (key.length <= 4) return "****";
  return `****${key.slice(-4)}`;
}
```

`maskApiKey` in `foodLlmMatching.ts`:

```
function maskApiKey(key: string): string {
  if (key.length <= 4) return "****";
  return `****${key.slice(-4)}`;
}
```

`classifyOpenAiError` in `ai.ts` and `classifyHttpError` in `foodLlmMatching.ts` are functionally identical — both map HTTP status codes to the same string codes using the same conditions.

`OPENAI_API_KEY_PATTERN` (`/^sk-[A-Za-z0-9_-]{20,}$/`) appears in `ai.ts:L15`, `foodLlmMatching.ts:L41`, and `profiles.ts:L22`.

**Suggested Simplification:**  
Move `maskApiKey`, the classifier function (pick one name), and `OPENAI_API_KEY_PATTERN` into `convex/lib/apiKeys.ts`, which already owns API-key concern. Export them from there. All three consumers (`ai.ts`, `foodLlmMatching.ts`, `profiles.ts`) import from `convex/lib/apiKeys.ts` already or can be made to. This eliminates three duplicate definitions with zero behaviour change.

---

### [HIGH] Duplicated private utility functions between `logs.ts` and `migrations.ts`

**Category:** DRY  
**Files:** `convex/logs.ts:L73-L83`, `convex/migrations.ts:L117-L138`

**Description:**  
`asTrimmedString(value: unknown): string | undefined` is defined independently in both files with identical logic. `migrations.ts` also has `asString`, `asNumber`, `asNullableNumber`, `asNullableString` — several of which overlap in spirit with helpers in `logs.ts` (`asFiniteNumber`). These are internal parsing helpers that operate on `unknown` DB values.

`logs.ts`:

```typescript
function asTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
```

`migrations.ts` (L121-L125): identical implementation.

**Suggested Simplification:**  
Extract `asTrimmedString` (and potentially the other `as*` coercers) into a new internal file such as `convex/lib/typeCoerce.ts`. Both `logs.ts` and `migrations.ts` import from there. The shared location is already established by `convex/lib/` for internal cross-cutting utilities. This removes approximately 30 lines of duplication and ensures future edits are made in one place.

---

### [MODERATE] `ingredientProfileProjection.ts` is a near-empty pass-through

**Category:** Over-Engineering  
**Files:** `convex/ingredientProfileProjection.ts:L1-L23`, `convex/ingredientProfiles.ts:L1-L9`

**Description:**  
`ingredientProfileProjection.ts` contains four functions:

- `normalizeIngredientProfileTag` — 1 line of logic
- `normalizeIngredientProfileTags` — 6 lines, deduplicates and sorts tags
- `normalizeIngredientProfileLabel` — 1 line of logic
- `getIngredientProfileProjection` — a single-line wrapper that calls `getCanonicalFoodProjection`

The last function is a pure forwarding wrapper with no added value:

```typescript
export function getIngredientProfileProjection(canonicalName: string) {
  return getCanonicalFoodProjection(canonicalName);
}
```

The entire file is only imported by `convex/ingredientProfiles.ts` and `convex/foodLibrary.ts`. The abstraction doesn't simplify anything — it creates an indirection layer with an invented name for a function that already has a clear name in `shared/foodProjection`.

**Suggested Simplification:**  
Delete `ingredientProfileProjection.ts`. Move `normalizeIngredientProfileTag`, `normalizeIngredientProfileTags`, and `normalizeIngredientProfileLabel` directly into `ingredientProfiles.ts` (the only caller that uses all three). Replace calls to `getIngredientProfileProjection` with direct calls to `getCanonicalFoodProjection` from `shared/foodProjection`. This eliminates a file that exists solely to forward calls.

---

### [MODERATE] `verdictToStoredVerdict` is an identity switch that adds no value

**Category:** Over-Engineering  
**Files:** `convex/extractInsightData.ts:L41-L58`

**Description:**  
The function maps every case of `StructuredFoodAssessment["verdict"]` to an identical string:

```typescript
function verdictToStoredVerdict(
  verdict: StructuredFoodAssessment["verdict"],
): "safe" | "watch" | "avoid" | "trial_next" {
  switch (verdict) {
    case "safe": return "safe";
    case "watch": return "watch";
    case "avoid": return "avoid";
    case "trial_next": return "trial_next";
    default: { ... }
  }
}
```

This is an identity function whose only purpose is an exhaustiveness check. If `StructuredFoodAssessment["verdict"]` and the stored verdict type are the same union (which the switch cases confirm they are), TypeScript already enforces this without the runtime overhead of a switch statement.

**Suggested Simplification:**  
Check whether `StructuredFoodAssessment["verdict"]` is assignable to the stored verdict type union. If so, remove `verdictToStoredVerdict` entirely and use `assessment.verdict` directly at the call site (`convex/extractInsightData.ts:L279`). If the types need to stay formally separated, add a type assertion with a comment explaining why. Either way eliminates 17 lines of no-op switch logic.

---

### [MODERATE] Duplicated `seedProfile` helper in two test files

**Category:** DRY  
**Files:** `convex/__tests__/nutritionGoals.test.ts:L19-L28`, `convex/__tests__/profiles.test.ts:L37-L46`

**Description:**  
Both files define a function with the same name and identical body:

`nutritionGoals.test.ts`:

```typescript
async function seedProfile(t: ReturnType<typeof convexTest>, userId: string) {
  await t.run(async (ctx) => {
    await ctx.db.insert("profiles", {
      userId,
      unitSystem: "metric",
      habits: [],
      updatedAt: Date.now(),
    });
  });
}
```

`profiles.test.ts`: identical implementation.

**Suggested Simplification:**  
Move `seedProfile` into `convex/testFixtures.ts`, which already exists as the shared test fixture module. Both test files import from there. This follows the existing pattern (where `TEST_AI_REQUEST`, `TEST_AI_INSIGHT`, etc. live) and eliminates one duplicate function definition.

---

### [MODERATE] Repeated `navigateAndWait` and `getNutritionCard` helpers across e2e specs

**Category:** DRY  
**Files:**

- `e2e/food-pipeline.spec.ts:L86-L88`
- `e2e/nutrition-filter-views.spec.ts:L44-L48`
- `e2e/food-tracking.spec.ts:L12-L13`
- `e2e/fluid-tracking.spec.ts:L13-L14`
- `e2e/nutrition-calorie-detail.spec.ts:L17-L18`

**Description:**  
`navigateAndWait` is defined identically in `food-pipeline.spec.ts` and `nutrition-filter-views.spec.ts`:

```typescript
async function navigateAndWait(page: Page) {
  await page.goto("/");
  await expect(page.locator(SEL.root)).toBeVisible();
}
```

`getNutritionCard` is defined identically (with the same body `page.locator('[data-slot="nutrition-card"]')`) in `food-tracking.spec.ts`, `fluid-tracking.spec.ts`, `nutrition-calorie-detail.spec.ts`, and `nutrition-water-modal.spec.ts`.

Similarly, `getBowelSection` is duplicated between `bowel-tracking.spec.ts` and `drpoo-cooldown.spec.ts`, and `getQuickCapture` appears in `destructive-habits.spec.ts`, `sleep-tracking.spec.ts`, and `weight-tracking.spec.ts` with the same body each time.

The shared `e2e/fixtures.ts` file already exists for this purpose and currently only re-exports `test` and `expect` from Playwright.

**Suggested Simplification:**  
Promote the common locator helpers and `navigateAndWait` into `e2e/fixtures.ts` as named exports. Each spec file already imports from `fixtures.ts`, so no new dependency is needed. At minimum, centralize:

- `navigateAndWait(page)`
- `getNutritionCard(page)`
- `getBowelSection(page)`
- `getQuickCapture(page)`

This removes approximately 15-20 lines of duplication spread across 7 files, and makes `fixtures.ts` serve its stated purpose.

---

### [MODERATE] `aiAnalyses.ts` has two near-identical row-projection shapes

**Category:** DRY  
**Files:** `convex/aiAnalyses.ts:L74-L83`, `convex/aiAnalyses.ts:L113-L123`, `convex/aiAnalyses.ts:L191-L202`

**Description:**  
The `list`, `latest`, and `latestSuccessful` queries each independently project the same subset of fields from a DB row into the same output shape:

```typescript
{
  id: row._id,
  timestamp: row.timestamp,
  model: row.model,
  durationMs: row.durationMs,
  inputLogCount: row.inputLogCount,
  insight: row.insight,
  error: row.error,
  starred: row.starred ?? false,
}
```

This shape is repeated three times. If a field is added (e.g. `clinicalReasoningText`), all three projections must be updated.

**Suggested Simplification:**  
Extract a `projectAnalysisRow(row: Doc<"aiAnalyses">)` helper function at the top of the file, and call it from all three query handlers. This eliminates two duplicate projections and centralises the shape definition. The function is simple, concrete, and only used inside this one file — not an over-abstraction.

---

### [NICE-TO-HAVE] `dedupeStrings` in `foodLibrary.ts` duplicates `[...new Set(arr)]`

**Category:** Redundancy  
**Files:** `convex/foodLibrary.ts:L44-L54`

**Description:**  
`dedupeStrings` is a private function that reimplements what `[...new Set(arr)]` already does:

```typescript
function dedupeStrings(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      out.push(value);
    }
  }
  return out;
}
```

It is only used in one place (`normalizeIngredients`, line 67).

**Suggested Simplification:**  
Replace the function with an inline `[...new Set(normalized)]` at its call site. The intent is immediately clear, the function is removed, and the behaviour is identical. The order-preserving property of `Set` in modern JS is well-established.

---

### [NICE-TO-HAVE] `firstNonNull` in `foodLibrary.ts` is a local reimplementation of a concept that already exists in `apiKeys.ts`

**Category:** DRY  
**Files:** `convex/foodLibrary.ts:L71-L75`, `convex/lib/apiKeys.ts:L160-L167`

**Description:**  
`firstNonNull<T>(values: Array<T | null | undefined>): T | null` in `foodLibrary.ts` and `firstDefined<T>(values: ReadonlyArray<T | undefined>): T | undefined` in `apiKeys.ts` solve the same problem with slightly different null/undefined handling. Both traverse an array and return the first non-absent value.

These are not identical (one returns `null` for failure, the other `undefined`), so they cannot be mechanically merged. But the pattern is duplicated across two separate files with no shared home.

**Suggested Simplification:**  
This is low priority — the difference in semantics (null vs undefined failure sentinel) makes unification non-trivial and potentially confusing. Flag as a future consideration if a `convex/lib/utils.ts` module is ever created.

---

### [NICE-TO-HAVE] `e2e/fixtures.ts` is nearly empty and states its purpose without fulfilling it

**Category:** Redundancy  
**Files:** `e2e/fixtures.ts:L1-L10`

**Description:**  
The file currently contains only a re-export of `test` and `expect` and a comment saying it "exists for future extension." Its stated purpose is to hold page object models and custom helpers — but those helpers have since been written, duplicated across spec files, and never moved here (see the `navigateAndWait`/`getNutritionCard` finding above).

**Suggested Simplification:**  
This is resolved by the `navigateAndWait`/`getNutritionCard` finding above. Once shared helpers are added, the comment in `fixtures.ts` can be removed since the file will speak for itself.

---

## Non-Findings (Notable but Intentional)

The following patterns were examined and found to be **justified**:

- **`isProcessedFoodItem` runtime guard in `foodParsing.ts`** — large but necessary because Convex stores items as `Record<string, unknown>[]`. Removing it would silently misinterpret corrupt data.
- **`upsertFoodTrialSummaries` complexity in `computeAggregates.ts`** — the `deleteOrphans` flag controlling two distinct deletion strategies is documented and load-bearing for correctness.
- **Multiple `as*` coercer functions in `migrations.ts`** — these handle legacy DB shapes that do not match current TypeScript types. They exist because the migration must handle old data gracefully.
- **`_testing` export in `foodLlmMatching.ts`** — the pattern of exporting private functions under a `_testing` namespace for unit tests is a reasonable escape hatch for testing otherwise-internal logic.
- **`buildMergedProfile` and `consolidateProfiles` in `apiKeys.ts`** — the complexity here handles real race conditions in Convex where unique constraints don't exist. The comment explains this clearly.
- **Module-level caches (`_cachedRegistryVocabulary`, `_cachedFuseIndex`) in `foodLlmMatching.ts`** — lazy module-level caching of static data is appropriate and clearly documented.
