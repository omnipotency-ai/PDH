# Maintainability & Code Quality Audit — Group 1

**Auditor:** Code Quality Agent
**Date:** 2026-04-06
**Scope:** convex/\*, e2e/\*, biome.json, tsconfig.json, components.json, .vscode/settings.json
**Focus:** Maintainability and Code Quality only (no security or performance findings)

---

## Findings

---

### [HIGH] Duplicated private utility functions across three files

**Category:** Code Quality
**Files:** `convex/ai.ts:16,22,31`, `convex/foodLlmMatching.ts:42,118,126`, `convex/profiles.ts:23`
**Description:** Three separate files each define their own copy of `OPENAI_API_KEY_PATTERN`, `maskApiKey()`, and a near-identical HTTP error classifier (`classifyOpenAiError` in `ai.ts` vs `classifyHttpError` in `foodLlmMatching.ts`). The functions are functionally identical — same regex, same logic, same fallback. A comment in `profiles.ts` even acknowledges this: `// Same pattern used in foodLlmMatching.ts and ai.ts`. Any future change to the API key format (e.g., OpenAI's key prefixes have changed historically) requires updating three files. The two error classifiers have subtly diverged: `classifyOpenAiError` in `ai.ts` maps non-4xx/429/5xx to `"NETWORK_ERROR"` in two branches (the second branch is dead code), while `classifyHttpError` in `foodLlmMatching.ts` has the same dead-code double-fallthrough. This makes it harder to spot that the `else` branch is unreachable.

**Suggested Fix:** Create `convex/lib/openai.ts` (or add to an existing lib file) and export:

```ts
export const OPENAI_API_KEY_PATTERN = /^sk-[A-Za-z0-9_-]{20,}$/;

export function maskApiKey(key: string): string {
  if (key.length <= 4) return "****";
  return `****${key.slice(-4)}`;
}

export function classifyOpenAiHttpError(status: number): string {
  if (status === 401 || status === 403) return "KEY_ERROR";
  if (status === 429) return "QUOTA_ERROR";
  if (status >= 500) return "NETWORK_ERROR";
  return "NETWORK_ERROR";
}
```

Then import from all three call sites and delete the local definitions.

---

### [HIGH] Parallel private utility functions duplicated between `convex/logs.ts` and `convex/migrations.ts`

**Category:** Code Quality
**Files:** `convex/logs.ts:74,80,1508,1514,1520,1525`, `convex/migrations.ts:117,121,127`, `convex/ingredientNutritionApi.ts:7,13,19`
**Description:** `asString`, `asTrimmedString`, `asNumber`, `asStringArray`, and `asRecord` are each defined independently in `logs.ts` (twice — once at the top for profile normalization, and again near L1508 for the backup import routines), `migrations.ts`, and a third variant in `ingredientNutritionApi.ts`. These are type-narrowing guards for unknown JSON that belong in a shared utility. The variants are not identical: `logs.ts`'s top-level `asString` (L1514) trims and requires non-empty, whereas `ingredientNutritionApi.ts`'s `asString` (L7) returns the raw trimmed value but treats `""` as `null`. A future developer reading backup code will not realize there is a semantically different `asString` above it. Additionally, `inferHabitType` in `migrations.ts` and `inferHabitTypeFromName` in `logs.ts` (L521, with comment `// SYNC WITH src/lib/habitTemplates.ts:inferHabitTypeFromName`) implement the same name-based inference with slightly different regex coverage. Three copies of the same function must be kept manually in sync.

**Suggested Fix:**

- Create `convex/lib/coerce.ts` exporting canonical `asTrimmedString`, `asNumber`, `asStringArray`, `asRecord` variants (decide on a single semantic for each).
- Move `inferHabitTypeFromName` into a shared location (either the convex lib or `shared/`) and import it from both `logs.ts` and `migrations.ts`. Remove the manual `// SYNC WITH` comment and enforce the single source of truth.
- Similarly, `slugify` in `migrations.ts` (L58) and `slugifyHabitName` in `logs.ts` (L512) implement the same slug logic — consolidate.

---

### [HIGH] `convex/logs.ts` is a 2,100-line god file with mixed responsibilities

**Category:** Maintainability
**Files:** `convex/logs.ts`
**Description:** `logs.ts` currently owns: (1) log CRUD mutations (`add`, `update`, `remove`), (2) the full profile management system (`replaceProfile`, `patchProfile`, `getProfile` with 10+ optional field normalizers), (3) habit config normalization (7 normalization functions spanning ~200 lines), (4) the backup export/import system (~600 lines), (5) data access helpers for the backup system (coerce functions at L1508-1529), and (6) the `batchUpdateFoodItems` food-pipeline mutation. These are at least four distinct responsibilities with no coupling between them. The file is hard to navigate — the `patchProfile` mutation runs from L1117 to L1251, which contains a 60-line inline payload construction repeated nearly identically in `replaceProfile` (L1014-L1114). Finding a bug in backup import requires scrolling past 1,100 lines of profile management code.

**Suggested Fix:** Split into at minimum three files:

- `convex/logs.ts` — log CRUD only (`add`, `update`, `remove`, `list`, `listAll`, `listByRange`, `count`, `batchUpdateFoodItems`)
- `convex/profileMutations.ts` — `replaceProfile`, `patchProfile`, `getProfile` with their normalization helpers
- `convex/backup.ts` — `exportBackup`, `importBackup`, `deleteAll` with their coerce helpers

---

### [HIGH] `convex/foodRequests.ts` uses `Date.now()` inside a mutation via a client-supplied opt-out

**Category:** Maintainability
**Files:** `convex/foodRequests.ts:42`
**Description:** The `submitRequest` mutation accepts an optional `now` arg and falls back to `Date.now()` inside the handler when it is absent:

```ts
createdAt: args.now ?? Date.now(),
```

`Date.now()` inside a Convex mutation is non-deterministic — Convex replays mutations on retry and the replayed value would differ from the original. The pattern of accepting `now` as a client arg to work around this is correct, but making it optional and defaulting to `Date.now()` in the handler body is wrong. If the client does not supply `now`, every retry of this mutation will write a different `createdAt`. The existing comment in `conversations.ts` explains this correctly: "mutations must be deterministic, so Date.now() inside a mutation would break replay". The same principle has not been applied consistently here.

**Suggested Fix:** Make `now` a required arg (not optional) in `submitRequest`, matching the pattern used in `conversations.addUserMessage`, `logs.patchProfile`, and `weeklySummaries.add`:

```ts
args: {
  // ...
  now: v.number(), // required — client must supply, mutations must be deterministic
},
handler: async (ctx, args) => {
  // ...
  createdAt: args.now,
```

All call sites already pass `now` or should be updated to do so.

---

### [MODERATE] Inconsistent `hasServerApiKey` query bypasses `requireAuth` in favour of raw `ctx.auth`

**Category:** Maintainability
**Files:** `convex/profiles.ts:58-67`
**Description:** `hasServerApiKey` is the only public query in the reviewed files that does not use `requireAuth(ctx)`. Instead it calls `ctx.auth.getUserIdentity()` directly and returns `false` for unauthenticated callers rather than throwing. The CLAUDE.md instructions and the rest of the codebase (including a comment in the code review skill) flag raw `ctx.auth.getUserIdentity()` calls as a legacy pattern. While returning `false` for unauthenticated callers is a deliberate UX choice (the client polls this to show/hide the "add API key" prompt), the inconsistency means this function looks different from every other query in the codebase and developers scanning the file for auth patterns will miss it.

**Suggested Fix:** Add a comment documenting the intentional deviation:

```ts
// Intentional: returns false (not throws) for unauthenticated callers.
// This query is used by the client to probe whether an API key is set
// before the user logs in. requireAuth() would throw — use raw ctx.auth.
const identity = await ctx.auth.getUserIdentity();
```

Alternatively, add a `requireAuthOrNull` helper to `convex/lib/auth.ts` that encodes this pattern, reducing confusion and allowing the calling code to read naturally.

---

### [MODERATE] Stale model names used in the food-matching pipeline constants

**Category:** Maintainability
**Files:** `convex/foodLlmMatching.ts:41`, `convex/foodParsing.ts:56`
**Description:** `foodLlmMatching.ts` uses `DEFAULT_MODEL = "gpt-4.1-nano"` and `foodParsing.ts` uses `OPENAI_FALLBACK_MODEL = "gpt-4o-mini"`. Both are legacy model names. `logs.ts:122-127` has a `LEGACY_AI_MODEL_MAP` that maps both of these to current names (`gpt-5-mini`), acknowledging they are legacy. Yet the pipeline constants were not updated. The `foodLlmMatching.ts` action validator (L553-558) still lists `gpt-4.1-nano`, `gpt-4.1-mini`, `gpt-4o-mini` as valid model args alongside `gpt-5-mini` and `gpt-5-nano`. This creates a mismatch: the user-facing AI model validator in `validators.ts:251` only allows `gpt-5-mini` and `gpt-5.4`, but the internal food-matching action accepts legacy names. Future developers will be confused about which names are current.

**Suggested Fix:**

- Update `DEFAULT_MODEL` in `foodLlmMatching.ts` and `OPENAI_FALLBACK_MODEL` in `foodParsing.ts` to `"gpt-5-mini"`.
- Narrow the `args.model` validator in `foodLlmMatching.ts` to match the canonical set in `validators.ts`.
- Add a comment at each constant explaining the model name convention in this codebase (or reference `LEGACY_AI_MODEL_MAP` in `logs.ts`).

---

### [MODERATE] Duplicate `slugify` / `slugifyHabitName` functions with different signatures

**Category:** Code Quality
**Files:** `convex/migrations.ts:58`, `convex/logs.ts:512`
**Description:** Both files implement a slugification function with the same body:

```ts
// migrations.ts:58
function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug || "custom";
}

// logs.ts:512
function slugifyHabitName(value: string): string {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug || "custom";
}
```

These are byte-for-byte identical except for the function name. If the slug format ever needs to change (e.g., to use `-` instead of `_`), both files must be updated and the inconsistency will silently produce different habit IDs for the same input depending on which path created the habit.

**Suggested Fix:** Export one `slugifyHabitName` from `convex/lib/coerce.ts` or a dedicated `convex/lib/habitNormalize.ts` and import it from both `logs.ts` and `migrations.ts`.

---

### [MODERATE] `WriteProcessedFoodItem` type in `foodParsing.ts` is a manual structural copy of the validator

**Category:** Maintainability
**Files:** `convex/foodParsing.ts:104-149`
**Description:** The file contains a `TODO: derive from validator using Infer<> to keep in sync` comment on `WriteProcessedFoodItem`. This type manually re-enumerates all 11 food group line literals, all resolver strings, and the shape of match candidates — all of which are already defined in `convex/validators.ts`. If a new food group line is added to `validators.ts` (e.g., a new `foodLineValidator` value), this type will silently be out of date and the TypeScript compiler will not catch the drift because the type is used on the write path, not the read path, so the schema validator will reject incorrect writes at runtime rather than compile time.

**Suggested Fix:** Replace the manual type with `Infer<typeof foodItemValidator>` (or a subset) from `validators.ts`. The `TODO` comment acknowledges this — follow through. Remove the manually duplicated union literals and use the imported type from the schema validators.

---

### [MODERATE] `conversations.ts:listByReport` performs a cross-user index scan with in-memory filter

**Category:** Maintainability
**Files:** `convex/conversations.ts:90-103`
**Description:** The `listByReport` query uses the `by_aiAnalysisId` index which is not scoped by userId. The query fetches all messages for a given `aiAnalysisId` across all users and then filters to the caller's `userId` in-memory. The comment acknowledges this and notes a compound index would be better but was deferred because the conversations schema already has four indexes. This is a documented intentional tradeoff, but the comment overstates the safety: "report IDs are not guessable (Convex document IDs)" is true, but this is a security property being used to justify omitting a data isolation guarantee at the index level. If a bug elsewhere ever exposes a report ID to the wrong user, this query will return their messages. The technical debt note exists but the comment should be more explicit about the risk.

**Suggested Fix:** Add a `by_userId_aiAnalysisId` compound index to the `conversations` table in `schema.ts`. This is a schema migration (widen, then migrate, then narrow). Until then, update the comment to explicitly call out that this query relies on `aiAnalysisId` being unguessable as a security property, not just an efficiency note.

---

### [MODERATE] `testFixtures.ts` manually types AI insight shape instead of using domain types

**Category:** Code Quality
**Files:** `convex/testFixtures.ts:19-51`
**Description:** `TEST_AI_INSIGHT` is typed with a large inline object literal type that manually re-enumerates verdicts, confidences, causal roles, etc. These are already defined in `src/types/domain.ts` and in `convex/validators.ts`. If a verdict literal is added or removed, the fixture type will not be caught by TypeScript — tests will compile but may exercise stale shapes. The file also defines `TEST_AI_INSIGHT_WITH_FOODS` as `typeof TEST_AI_INSIGHT`, which means adding a field to `TEST_AI_INSIGHT` automatically widens the type for `TEST_AI_INSIGHT_WITH_FOODS` as well, which is confusing.

**Suggested Fix:** Type `TEST_AI_INSIGHT` using `Infer<typeof aiInsightValidator>` from `validators.ts` (or the domain type from `src/types/domain.ts`) instead of a manual inline type. This will catch structural drift between fixtures and the actual schema at compile time.

---

### [MODERATE] E2E tests use `page.waitForTimeout` instead of explicit waiting on DOM state

**Category:** Code Quality
**Files:** `e2e/food-tracking.spec.ts:43,70`, `e2e/fluid-tracking.spec.ts:54`, `e2e/bowel-tracking.spec.ts:48`, `e2e/drpoo-cooldown.spec.ts` (multiple), `e2e/nutrition-full-flow.spec.ts` (multiple)
**Description:** Multiple E2E tests use `await page.waitForTimeout(N)` with values ranging from 100ms to 1500ms to wait for Convex data to arrive or UI to update. `waitForTimeout` is Playwright's explicit sleep — it makes tests slow and flaky because the timeout is based on local machine speed rather than the actual condition. For example, `food-tracking.spec.ts:L70` waits 1500ms for a food item to appear in "Today's Log", then tries to find it by text. On a slow CI machine, 1500ms may not be enough; on a fast local machine, it wastes time. The correct pattern is `await expect(locator).toBeVisible()` with Playwright's auto-retry, which polls until the element appears (or the test-timeout fires).

**Suggested Fix:** Replace every `page.waitForTimeout(N)` with a condition-based wait. For example:

```ts
// Before
await logButton.click();
await page.waitForTimeout(1500);
const foodEntry = page.locator(`text=${uniqueFood}`).first();
await expect(foodEntry).toBeVisible();

// After
await logButton.click();
const foodEntry = page.locator(`text=${uniqueFood}`).first();
await expect(foodEntry).toBeVisible({ timeout: 8000 });
```

The 8000ms timeout tells Playwright how long to keep retrying, eliminating the fixed sleep.

---

### [MODERATE] `e2e/food-pipeline.spec.ts` selector strategy documented but not enforced

**Category:** Maintainability
**Files:** `e2e/food-pipeline.spec.ts:16-55`
**Description:** The file opens with an excellent 40-line comment documenting every selector used, its stability rating ("Fragile", "Stable"), and TODOs for adding `data-testid` attributes. Three selectors are explicitly marked "Fragile": `foodGroupButton` (button text), `processingSpinner` (CSS class `animate-spin`), and `entry` (Tailwind group variant class). While the documentation is valuable, fragile selectors have been written into the test with no enforcement mechanism. The TODOs have no issue references or dates, making it unclear whether they will be addressed. Other E2E test files (`bowel-tracking.spec.ts:14`, `drpoo-cooldown.spec.ts:22`) also use `section.glass-card-bowel` — a CSS class as a selector — with no documentation of the fragility.

**Suggested Fix:**

- Add `data-testid="food-group-toggle"`, `data-testid="log-entry"`, `data-testid="processing-spinner"` to the relevant React components (these are pure test-only attributes with no UI impact).
- For `bowel-tracking.spec.ts` and `drpoo-cooldown.spec.ts`, replace `section.glass-card-bowel` with `data-slot="bowel-section"` or `data-testid="bowel-section"`.
- Add a GitHub/Linear issue reference to each fragile-selector TODO so they are tracked.

---

### [MODERATE] `auth.setup.ts` sign-in flow does not verify successful authentication before saving state

**Category:** Maintainability
**Files:** `e2e/auth.setup.ts:41-47`
**Description:** After `clerk.signIn()`, the setup test checks only that `body` is visible — which is always true — before saving storage state. If the Clerk sign-in flow fails silently (wrong credentials, rate limit, missing testing token), the storage state will be saved in an unauthenticated state and every downstream test will fail with confusing auth errors rather than a clear "setup failed" message. The `await expect(page.locator("body")).toBeVisible()` assertion provides no actual auth signal.

**Suggested Fix:** After `clerk.signIn()`, wait for a UI element that is only visible to authenticated users:

```ts
// Verify we are actually authenticated before saving storage state
await expect(page.getByRole("img", { name: "PDH" })).toBeVisible({
  timeout: 10000,
});
// Or any authenticated-only element
```

This way, if auth fails, the setup step fails loudly rather than saving a broken state.

---

### [MODERATE] `weeklySummaries.ts` `add` mutation does not accept `promptVersion` but schema stores it

**Category:** Maintainability
**Files:** `convex/weeklySummaries.ts:5-45`, `convex/schema.ts:327`
**Description:** The `weeklySummaries` table schema includes `promptVersion: v.optional(v.number())` with an explanatory comment about personality versioning. The `add` mutation args do not include `promptVersion` in its `args` validator, so the value can never be written via the public API. This means either (a) `promptVersion` is dead schema — written nowhere except potentially backup import — or (b) the mutation was added before `promptVersion` was introduced to the schema and was never updated. Either way, the schema and the mutation are out of sync. A developer reading the schema will assume `promptVersion` is populated; a developer reading the mutation will not know it exists.

**Suggested Fix:** Either add `promptVersion: v.optional(v.number())` to `weeklySummaries.add` args and write it (following the same pattern as `conversations.addUserMessage` which does accept `promptVersion`), or add a comment to the schema explaining that `promptVersion` is only populated via backup import and document whether it is ever expected to be set by the pipeline.

---

### [MODERATE] `foodAssessments.ts:allFoods` query collects up to 2000 rows with no pagination API

**Category:** Maintainability
**Files:** `convex/foodAssessments.ts:39-84`
**Description:** The `allFoods` query hard-codes a limit of 2000 rows but exposes no cursor or pagination argument. The comment acknowledges this: "Safety cap: 2000 rows to prevent unbounded collect." This means if a user somehow accumulates more than 2000 food assessments (unlikely today, but plausible for long-term users), the `allFoods` query will silently truncate older assessments without telling the caller. The returned `latestByFood` map will miss data for foods only assessed in the older (truncated) portion. There is no `isTruncated` flag in the return value, so callers cannot detect this condition.

**Suggested Fix:** Add an `isTruncated` field to the return value (matching the pattern in `ingredientExposures.allIngredients` which already does this correctly):

```ts
return {
  foods: Array.from(latestByFood.values()),
  isTruncated: allAssessments.length === 2000,
};
```

This does not fix the underlying issue but makes the truncation visible to callers. The underlying fix is pagination or using the `foodTrialSummary` table (which is purpose-built to aggregate assessments) rather than scanning raw assessments at query time.

---

### [NICE-TO-HAVE] `convex/ingredientProfileProjection.ts` is a one-function pass-through with misleading name

**Category:** Maintainability
**Files:** `convex/ingredientProfileProjection.ts`
**Description:** The file exports four functions but three of them (`normalizeIngredientProfileTag`, `normalizeIngredientProfileTags`, `normalizeIngredientProfileLabel`) are standalone string normalization utilities with no coupling to "projections". The fourth — `getIngredientProfileProjection` — is a one-line pass-through to `getCanonicalFoodProjection` from `shared/foodProjection`. The file exists as a named re-export layer that adds indirection without adding value. Anyone looking for projection logic will go to this file, see a passthrough, and then need to go to `shared/foodProjection.ts`. The normalization functions could live in `shared/` directly.

**Suggested Fix:** Move `normalizeIngredientProfileTag`, `normalizeIngredientProfileTags`, and `normalizeIngredientProfileLabel` into `shared/foodNormalize.ts` or a new `shared/profileNormalize.ts`. Either inline `getIngredientProfileProjection` at its two call sites or delete the wrapper and import `getCanonicalFoodProjection` directly. Remove `ingredientProfileProjection.ts` if it has no remaining content.

---

### [NICE-TO-HAVE] `convex/schema.ts` uses both `"liquid"` and `"fluid"` as log types for the same concept

**Category:** Maintainability
**Files:** `convex/schema.ts:29-36`, `convex/logs.ts:32-40,837`
**Description:** The `logs` table `type` union includes both `"liquid"` and `"fluid"`. The `add` and `update` mutations treat them identically (`if (args.type === "food" || args.type === "liquid")`). The LEGACY_FLUID_TYPE note in `migrations.ts` confirms that `"liquid"` is a legacy alias for `"fluid"`. Having both in the schema means every type-switch in business logic must handle both values. The `isFoodPipelineType` helper in `shared/logTypeUtils.ts` is presumably one place this is centralized, but anywhere that type-switches on log type directly (like the `add` mutation) must also remember to handle both.

**Suggested Fix:** Document at the top of the schema `type` union that `"liquid"` is a legacy alias scheduled for migration, with a reference to the migration plan. Consider adding a comment to `add` and `update` mutation handlers explaining why both are checked. Long-term: run a migration to normalize `"liquid"` to `"fluid"` so the union can be narrowed.

---

### [NICE-TO-HAVE] `testFixtures.ts` exports test data at module level without `beforeEach` reset

**Category:** Code Quality
**Files:** `convex/testFixtures.ts`
**Description:** `TEST_AI_INSIGHT`, `TEST_AI_REQUEST`, and `TEST_AI_RESPONSE` are exported as mutable `const` objects. TypeScript does not prevent test code from mutating them (e.g., `TEST_AI_INSIGHT.summary = "mutated"`), which would bleed state between tests. Several test files spread these objects directly: `{ ...TEST_AI_INSIGHT, summary: "All good" }` is safe, but any test that mutates without spreading would corrupt subsequent tests in the same run.

**Suggested Fix:** Export the fixtures as `Object.freeze()`-ed constants, or use a factory function pattern:

```ts
export function makeTestAiInsight(overrides?: Partial<...>): ... {
  return { ...BASE_INSIGHT, ...overrides };
}
```

This is a low-probability issue but costs nothing to fix and prevents a class of silent test pollution.

---

## Summary

| Severity     | Count  |
| ------------ | ------ |
| CRITICAL     | 0      |
| HIGH         | 4      |
| MODERATE     | 10     |
| NICE-TO-HAVE | 3      |
| **Total**    | **17** |

## Key Themes

1. **Duplicated private utilities** — `OPENAI_API_KEY_PATTERN`, `maskApiKey`, error classifiers, coercion helpers (`asString`, `asNumber`, etc.), and `slugify` are each defined 2-3 times across files with no shared home. This is the single largest maintainability risk because each divergence is silent.

2. **`convex/logs.ts` is over-loaded** — at 2,100 lines it contains 5+ distinct responsibilities. This makes it hard to navigate, review, and test in isolation.

3. **E2E test resilience** — `waitForTimeout` calls and fragile CSS-class selectors make the suite brittle on slow CI. The documented TODO selectors should be prioritized before the test suite grows further.

4. **Schema/mutation drift** — `weeklySummaries.add` does not write `promptVersion` despite the schema having it; `foodAssessments.allFoods` has no `isTruncated` signal despite silently capping at 2000 rows. These are discoverability gaps that will mislead future developers.
