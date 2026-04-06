# Security & Performance Audit — Group 2

**Scope:** e2e specs, index.html, package.json, playwright.config.ts, all `scripts/ship/review-findings-*.json`, `shared/__tests__/`, `shared/*.ts`, `skills-lock.json`
**Date:** 2026-04-06
**Focus:** Security and Performance only — deduplication against all prior findings files applied

---

## Methodology

All 40 review-findings JSON files were read and their finding titles were catalogued to avoid re-raising already-documented issues. Findings below are net-new observations from the files in scope for this audit pass.

---

## Findings

---

### [HIGH] buildFoodEvidenceResult accepts unbounded `logs` input and processes it entirely in memory

**Category:** Performance
**Files:** `shared/foodEvidence.ts:1206`
**Description:** `buildFoodEvidenceResult` iterates over `args.logs` four times back-to-back: once to build food trials, once to build digestive events, once to compute modifier summaries, and again via `buildFoodTrials` a second time (line 1219) to populate `allFoodTrials`. A user with 18+ months of logs (e.g. 10,000–20,000 rows) will cause all of those documents to be loaded into memory simultaneously on the calling side (whether client or Convex). The food trials loop alone is O(T × E) in the trigger correlation inner loop (`findTriggerCorrelations` at line 1223), where T = trial count and E = digestive event count. For a heavy user with 1,000 food trials and 400 bowel events this loop runs 400,000 iterations before returning.

`buildFoodEvidenceResult` is a pure shared function, so it is callable from both the client and from Convex. Calling it on the client from a `useQuery` subscription that returns all user logs (`listAll`) means every new log addition re-runs this entire computation on the main thread.

**Suggested Fix:**

- Move `buildFoodEvidenceResult` to a Convex action or scheduled function that computes evidence incrementally and stores results in `foodTrialSummaries`. The Patterns page should read from pre-computed summaries rather than recomputing on every render.
- In the interim, add a fast-path that caps `args.logs` to the most recent 2,000 entries and documents the tradeoff.
- The O(T × E) `findTriggerCorrelations` loop should break early once the event timestamp is outside the trigger window, since both arrays are sorted by timestamp. This changes the inner loop from O(T × E) to O(T + E) with a two-pointer approach.

---

### [HIGH] `foodEvidence.ts` calls `Date.now()` as a default parameter in `buildFoodEvidenceResult`

**Category:** Security / Convex Correctness
**Files:** `shared/foodEvidence.ts:1213`
**Description:** Line 1213 reads `const now = args.now ?? Date.now()`. This function is used as shared code callable from both the client and Convex. If it is ever called from within a Convex mutation without passing `args.now`, the mutation becomes non-deterministic (a known HIGH anti-pattern documented throughout the existing findings for `Date.now()` inside mutations). The pattern is subtle because the non-determinism is hidden inside a shared utility, not directly in the mutation handler — making it easy to miss in Convex-specific reviews.

Even on the client, this means the evidence result's decay weights (`recencyWeight`) are anchored to wall-clock time at call invocation, which drifts between the result being computed and rendered. This is a lesser concern but means cached results silently become stale without the caller being aware.

**Suggested Fix:**

- Make `args.now` required rather than optional. All callers must supply the timestamp explicitly, forcing them to decide at the call site whether the value comes from a Convex scheduler, a client clock, or a test fixture.
- If called from Convex, the timestamp should come from the mutation's own argument record (or `ctx.scheduler`), not from `Date.now()` defaulting inside the shared function.

---

### [HIGH] `foodCanonicalization.ts` throws on startup if registry has alias collisions — no recovery path

**Category:** Security / Availability
**Files:** `shared/foodCanonicalization.ts:81-87`
**Description:** `buildExampleMap()` is called at module load time (line 92: `const EXAMPLE_MAP: ReadonlyMap<string, string> = buildExampleMap()`). If the `FOOD_REGISTRY` contains duplicate normalized aliases across entries, `buildExampleMap` throws `new Error(...)` with a detailed message listing all colliding canonicals. Because this is a module-level initializer, the error propagates as an unhandled module load failure. In a browser, this crashes the entire JavaScript bundle silently. In a Convex worker, it causes every function in any module that imports from `foodCanonicalization.ts` to fail with an opaque module-load error.

The error message that leaks (`Duplicate normalized food aliases found in FOOD_REGISTRY: ${details}`) includes the full list of colliding food names, which are internal product data, though this is low sensitivity.

More critically, this creates a single point of failure: a developer adding one duplicate registry entry will break the entire app at runtime with no graceful degradation. There is no catch block or fallback.

**Suggested Fix:**

- Move duplicate detection to a build-time check (a Vitest unit test or a `vite` plugin) rather than a runtime module initializer. At runtime, log the collision warning to `console.error` and skip the duplicate rather than throwing.
- Alternatively, wrap `buildExampleMap()` in a try/catch and return a partial map with the duplicate skipped, logging the conflict. This is the "leave it better" pattern: the app works even with a bad registry entry, and the error is visible in logs.

---

### [HIGH] Regex patterns in `foodMatching.ts` and `foodNormalize.ts` compiled inside functions on every call

**Category:** Performance
**Files:** `shared/foodNormalize.ts:229`, `shared/foodMatching.ts:179`
**Description:** In `normalizeFoodName` (foodNormalize.ts), the `FILLER_PHRASES` loop (line 229) calls `new RegExp(...)` inside a for-loop on every invocation of `normalizeFoodName`. `normalizeFoodName` is called extremely frequently — it is invoked for every food item in every log, for every entry in the registry (during `buildExampleMap`), and on every keystroke in the search input. Each call re-compiles up to 5 regular expressions from strings.

In `foodMatching.ts`, `protectPhrases` (line 179) similarly creates `new RegExp(phrase, "gi")` inside a loop for every call to `splitMealIntoFoodPhrases`.

Additionally, `parseLeadingQuantity` in `foodParsing.ts` (lines 207, 221) creates two non-trivial `new RegExp(...)` patterns from template literals on every call to `parseLeadingQuantity`, including the full `MEASURE_UNIT_PATTERN` string. These are called once per food phrase parsed, including during every search keystroke.

**Suggested Fix:**

- Pre-compile all regex patterns at module load time as `const` values. For the FILLER_PHRASES loop, build a single combined pattern: `const FILLER_PHRASE_PATTERN = new RegExp(FILLER_PHRASES.map(p => `\\b${p}\\b`).join('|'), 'gi')` and replace the loop with a single `.replace()` call.
- For `parseLeadingQuantity`, move the two `new RegExp(...)` calls outside the function body and into module-level constants. This is a one-line change per pattern.

---

### [MODERATE] `searchFoodDocuments` creates a new `Fuse` instance on every filtered search

**Category:** Performance
**Files:** `shared/foodMatching.ts:544-548`
**Description:** When `options.bucketKey` is provided, `searchFoodDocuments` filters `context.documents` to a subset and then creates `new Fuse(filteredDocuments, DEFAULT_FUSE_OPTIONS)` (line 544) on every call. Fuse.js initialization is not cheap — it builds an internal search index. If a user types in the search input while a bucket filter is active, this re-indexes the document subset on every keystroke. The `context.fuse` is reused only for unfiltered searches; filtered searches always pay the Fuse initialization cost.

**Suggested Fix:**

- Cache Fuse instances per `bucketKey` inside the `FoodMatcherContext`. Since buckets are derived from the static registry, the bucket set is fixed at context creation time. Pre-build one `Fuse` instance per bucket in `createFoodMatcherContext` and store them in a `Map<string, Fuse<FoodSearchDocument>>`.

---

### [MODERATE] `normalizeFoodName` in `foodNormalize.ts` does redundant Unicode normalization passes

**Category:** Performance
**Files:** `shared/foodNormalize.ts:199`
**Description:** `normalizeFoodName` calls `.normalize("NFD")` and then strips combining diacriticals, which is correct. However, this function is called from `normalizeFoodMatchText` in `foodMatching.ts` (line 158), which also calls `.normalize("NFD")` and strips diacriticals independently. When a food phrase is processed, both normalization functions run on the same text, with two full Unicode normalization passes applied sequentially. This is not functionally incorrect but wastes CPU cycles on every food item processed.

**Suggested Fix:**

- Extract the shared normalization primitive (`normalize("NFD").replace(...)`) into a single shared helper used by both `normalizeFoodName` and `normalizeFoodMatchText`. One pass is sufficient since the input to `normalizeFoodMatchText` will already have been through the shared helper.

---

### [MODERATE] E2E test suite uses `page.waitForTimeout()` extensively — tests are timing-dependent and fragile under CI load

**Category:** Performance (test reliability)
**Files:** `e2e/nutrition-water-modal.spec.ts:35,44,102,111,119,142,158,200,268,276`, `e2e/sleep-tracking.spec.ts:27,30`, `e2e/weight-tracking.spec.ts:37,43,64`
**Description:** The E2E test suite contains dozens of `page.waitForTimeout(N)` calls with hardcoded millisecond delays (100ms, 200ms, 300ms, 500ms). `waitForTimeout` is a fixed sleep — it does not wait for a condition. Under CI load or on a slow machine, 100ms or 200ms is insufficient for Convex data delivery or animation completion. Under a fast local dev machine, the delays are wasteful. This creates a test suite that is simultaneously flaky under load and slow unnecessarily.

More critically: `openWaterModal` uses `page.waitForTimeout(200)` to wait for the modal to become visible rather than `await expect(modal).toBeVisible()`. If the modal takes 201ms, the assertion fails. If the network is fast, the test wastes 200ms per call.

**Suggested Fix:**

- Replace all `page.waitForTimeout(N)` calls with explicit condition waits: `await expect(element).toBeVisible()`, `await expect(element).toHaveValue(...)`, or `await page.waitForFunction(...)`. Playwright's built-in auto-waiting makes `waitForTimeout` almost always unnecessary. The only legitimate use is for non-observable state changes like animation completion — even then, prefer `waitForFunction` over a hardcoded sleep.

---

### [MODERATE] `playwright.config.ts` uses a single browser project — no cross-browser security coverage

**Category:** Security
**Files:** `playwright.config.ts:13`
**Description:** All E2E tests run exclusively against Chromium (`devices["Desktop Chrome"]`). Security-relevant behaviors — particularly Content Security Policy enforcement, mixed content blocking, localStorage/sessionStorage isolation, and clipboard API behavior — differ significantly across browser engines. The CSP header issues already flagged in `review-findings.json` (F001: `unsafe-inline` in `script-src`) would not be caught by Chromium-only tests, since Chromium is more permissive in some CSP edge cases than Firefox.

For a health app storing medical data, testing auth flows and data isolation across at least one additional engine (Firefox) is warranted.

**Suggested Fix:**

- Add a Firefox project to `playwright.config.ts` for the auth-dependent test suite (not all tests need multi-browser coverage, but auth and data access tests should run on at least two engines).
- At minimum, add a comment to the config explaining that Firefox/WebKit coverage is deferred and track it as a work queue item.

---

### [MODERATE] `shared/__tests__` test files import `Date` directly — no time control in evidence pipeline tests

**Category:** Performance (test reliability) / Security (evidence correctness)
**Files:** `shared/__tests__/foodEvidence.ts` (multiple test files referencing `now`)
**Description:** The `foodEvidence.ts` tests pass an explicit `now` parameter to `buildFoodEvidenceResult` in most places, which is correct. However, in the transit and trigger evidence tests (`foodEvidence.transit.test.ts`, `foodEvidence.trigger.test.ts`), some test fixtures hardcode absolute timestamps relative to real calendar dates. If the tests are run significantly after the fixture dates, the `recencyWeight` decay function (which uses a 45-day half-life) will produce materially different weight values than what was assumed when the assertions were written. A trial timestamped at Jan 2025 will have approximately 0.15× the weight of a trial timestamped one day ago — after enough time, any hardcoded assertion on combined score or posterior safety will drift.

**Suggested Fix:**

- All test fixtures should use `now - N` relative timestamps where `now` is a controlled value passed into the test's call to `buildFoodEvidenceResult`. Remove any absolute epoch timestamps (e.g. `new Date('2024-12-01').getTime()`) from test fixtures.

---

### [MODERATE] `FOOD_REGISTRY` data in `foodRegistryData.ts` is a 4,381-line static array included in the client bundle unconditionally

**Category:** Performance
**Files:** `shared/foodRegistryData.ts`
**Description:** The food registry is a large static data file (4,381 lines). It is imported by `foodRegistryUtils.ts`, which is imported by `foodRegistry.ts`, which is imported by `foodMatching.ts`, `foodCanonicalization.ts`, `foodEvidence.ts`, and `foodProjection.ts`. All of these are ultimately imported into the client bundle (via `src/`), meaning the full registry is bundled into the main JavaScript chunk that every user downloads.

The registry contains detailed clinical annotations (digestion metadata, fiber levels, osmotic effects, irritant loads) that are only used in the AI prompt pipeline and evidence computation — not in the food search UI itself. This data inflates the client bundle unnecessarily.

**Suggested Fix:**

- Audit which registry fields are actually needed on the client (likely only `canonical`, `zone`, `group`, `line`, `examples`, `macros`). Create a client-facing projection type `ClientFoodRegistryEntry` that omits `digestion` metadata fields. The full registry with all metadata should remain on the server side (Convex actions/queries).
- Track this as a bundle size optimization. The impact depends on the minified size of the registry; measure with `bun run build -- --report` before and after.

---

### [MODERATE] `logDataParsers.ts` — `safeNumber` coerces any value to a number, masking type errors from upstream code

**Category:** Security
**Files:** `shared/logDataParsers.ts:58-62`
**Description:** `safeNumber` calls `Number(value)` on any `unknown` input and returns the result if finite. This means a string `"3"` is silently coerced to `3`, a boolean `true` coerces to `1`, and an object `{}` becomes `NaN` (filtered). This is intentional for tolerance of legacy data, but it creates an implicit contract mismatch: code that stores `bristolCode: "5"` as a string will be accepted and interpreted as `5` rather than flagging the upstream storage bug.

More critically, `safeNumber` is used to parse `bristolCode` from digestive log data. If a malformed or adversarially crafted log entry stores `bristolCode: "7.9"` (a string), it becomes `7.9` — a non-integer that then passes through `normalizeDigestiveCategory` (foodEvidence.ts line 406) where comparisons like `bristol >= 7` return `true`. There is no integer-only guard.

**Suggested Fix:**

- For `bristolCode` specifically, add an integer check after `safeNumber`: `if (!Number.isInteger(parsed.bristolCode) || parsed.bristolCode < 1 || parsed.bristolCode > 7)` discard or null the value. This is consistent with the documented Bristol 1–7 integer range.
- Document in `logDataParsers.ts` that `safeNumber` is permissive by design and callers should apply domain-specific validation after calling it.

---

### [MODERATE] `foodMatching.ts` — `splitMealIntoFoodPhrases` has no maximum input length guard

**Category:** Security
**Files:** `shared/foodMatching.ts:205`
**Description:** `splitMealIntoFoodPhrases` accepts a raw text string with no length cap. It calls `protectPhrases` (which loops over PROTECTED_PHRASES running 4 regex operations per phrase), then splits on the conjunction pattern, then maps each segment through `sanitizeFoodPhrase`. A user submitting a very long string (e.g., 100KB of food text from a malicious client or a voice-to-text error) will cause this function to run all regex operations on the full string, then produce a large array of segments, each of which is then passed to `preprocessMealText` → `parseLeadingQuantity`. The downstream callers may then iterate all segments.

This is on the client path (UI search input), so direct exploitation is limited. However, `preprocessMealText` is also called in Convex action context for the food matching pipeline — if a mutation accepts raw text and calls these shared functions without a prior length check, the server-side execution time could be significant.

**Suggested Fix:**

- Add a guard at the top of `splitMealIntoFoodPhrases`: `if (rawText.length > 500) rawText = rawText.slice(0, 500)` (or throw if the context warrants it). The UI already has a character limit on inputs, but server-side code should not rely on client enforcement.
- Check whether any Convex mutation calls `splitMealIntoFoodPhrases` or `preprocessMealText` without a prior input length cap in `convex/lib/inputSafety.ts`.

---

### [MODERATE] `foodNormalize.ts` — FILLER_PHRASES regex is constructed with no escaping, accepting user-controlled regex metacharacters

**Category:** Security
**Files:** `shared/foodNormalize.ts:229`
**Description:** The `FILLER_PHRASES` array contains strings like `"lactose free"`, `"gluten free"`, etc. These are developer-controlled constants, not user input, so there is no direct injection risk here. However, `normalizeFoodName` uses `new RegExp(\`\\b${phrase}\\b\`, "gi")`(line 229) to build the pattern from these strings. If`FILLER_PHRASES`is ever extended by a developer who adds a phrase containing regex metacharacters (e.g.,`"50%+ fat-free"`for a future feature), the resulting`RegExp`construction will have unintended behavior or throw a`SyntaxError`.

The pattern `new RegExp(...)` from a developer-controlled string is less severe than from user input, but is still a latent code quality risk.

**Suggested Fix:**

- Pre-compile `FILLER_PHRASES` into a single combined regex at module load time (see the performance finding above). This also eliminates the per-call regex compilation. When building the combined pattern, escape each phrase: `phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`.

---

### [MODERATE] `foodEvidence.ts` — `normalizeDigestiveCategory` handles `bristol >= 7` as diarrhea but `bristolCode` field is unvalidated before being stored back in evidence

**Category:** Security / Data Integrity
**Files:** `shared/foodEvidence.ts:416-418`, `shared/foodEvidence.ts:446-449`
**Description:** `normalizeDigestiveCategory` (line 413) accepts any `bristol` value. For `bristol >= 7` it returns `"diarrhea"`, which means bristol values of `8`, `99`, or `-5` would be accepted and categorized. The `bristolCode` is then stored directly into the constructed `DigestiveEvent` object (line 448) without range clamping or rejection. A `DigestiveEvent` with `bristolCode: 99` would then flow through `findTriggerCorrelations` (which checks `bristol === 6 || bristol === 7`) — the out-of-range value passes the check false and is silently ignored, but it still pollutes the events array used in `resolveTrials`.

This is downstream of `parseDigestiveData` → `safeNumber`, which accepts any finite number. The validator issue in `convex/validators.ts` (already flagged as F008 in review-findings-schema-auth.json) allows out-of-range Bristol codes to reach shared functions. The shared functions should not assume upstream validation was applied.

**Suggested Fix:**

- In `buildDigestiveEvents`, after calling `normalizeDigestiveCategory`, add a guard: `if (bristolCode !== undefined && (!Number.isInteger(bristolCode) || bristolCode < 1 || bristolCode > 7)) continue;` to discard invalid logs rather than carrying them forward.

---

### [MODERATE] `skills-lock.json` is tracked in git — hash-based integrity, but Convex skills are fetched from an unconfigured GitHub source at install time

**Category:** Security
**Files:** `skills-lock.json:1-30`
**Description:** `skills-lock.json` pins 5 Convex-provided skills from `get-convex/agent-skills` (GitHub). The file records a `computedHash` for each skill. If the hash verification is not enforced at runtime, a compromised or updated version of the upstream skill could be pulled silently. There is no indication in the file or surrounding tooling of what `computedHash` corresponds to (SHA-256 of what artifact? the entire downloaded file? a specific field?). If the hash check is weak or absent, any update to the upstream GitHub repository would be pulled on the next `npx convex ai-files install` without developer awareness.

Skills that include Convex schema operations or migration patterns could, if compromised, provide incorrect patterns that introduce vulnerabilities into generated Convex code.

**Suggested Fix:**

- Verify that the `computedHash` values are actually checked during skill installation and document this in a comment in `skills-lock.json`.
- Pin skills to specific git commit SHAs rather than floating branch/tag references, similar to how `npm` lock files pin exact versions. This prevents silent upstream changes.
- Review the 5 installed skills' content against their hashes to confirm they match the local install.

---

### [NICE-TO-HAVE] `index.html` has no Content Security Policy meta tag

**Category:** Security
**Files:** `index.html:1-29`
**Description:** The HTML entry point has no `<meta http-equiv="Content-Security-Policy">` tag. The CSP is presumably set via server headers (Vercel config or similar), but there is no fallback in the HTML itself. If the app is served from a context that does not apply server-side headers (e.g. local `file://` development, a bare S3 bucket, or an iframe embed), there will be no CSP protection at all. Given that `review-findings.json` already flags the server-side CSP as having `unsafe-inline` and a placeholder domain wildcard, the defense-in-depth posture here is weaker than it should be for a medical data app.

**Suggested Fix:**

- Add a `<meta http-equiv="Content-Security-Policy">` tag to `index.html` with a baseline policy that at minimum sets `default-src 'self'` and restricts `object-src 'none'`. This supplements (not replaces) server-side headers and applies regardless of the serving context.

---

### [NICE-TO-HAVE] `package.json` includes `openai` as a production dependency — the OpenAI SDK is used only on the client for user-supplied API keys

**Category:** Security / Bundle Size
**Files:** `package.json:38`
**Description:** The `openai` package (v6.22.0) is listed as a production dependency. The OpenAI SDK is used on the client to call the API with the user's own key (stored in IndexedDB). The SDK itself is large and includes a significant amount of code that is not needed in a browser context (Node.js HTTP adapters, streaming utilities, etc.). More significantly, shipping the full OpenAI SDK client-side means the API key handling path is in the client bundle — any XSS vulnerability in the app could potentially exfiltrate the user's stored API key by accessing the same-origin IndexedDB.

**Suggested Fix:**

- Consider whether direct client-side OpenAI calls can be moved server-side entirely (through a Convex action that accepts the user's key from secure IndexedDB storage). This would keep the key out of fetch headers that could be sniffed by XSS.
- At minimum, evaluate whether the OpenAI SDK's browser bundle can be replaced with a minimal `fetch`-based wrapper that does not include Node.js-specific code, reducing bundle size.

---

### [NICE-TO-HAVE] E2E test for `patterns-food-trials.spec.ts` logs real food to the shared database — tests are not isolated and pollute production-equivalent data

**Category:** Security
**Files:** `e2e/patterns-food-trials.spec.ts:487-534`
**Description:** The `logFoodOnTrack` helper (line 66) calls the actual Track page food logging flow, which submits a real Convex mutation to the test user's database. The "logging a new food on Track increases its trial count on Patterns" test (line 487) deliberately logs `"toast"` to the shared test environment and then verifies the trial count increases. This means:

1. E2E tests write real data to what appears to be a shared backend (not a sandboxed test database, since the test uses the same Convex backend as `bun run dev`).
2. Test data accumulates across runs (the test acknowledges this: "Other tests in the suite may also log 'toast'").
3. If E2E tests run against the production Convex deployment (as is common in CI without environment isolation), they will pollute real user data.

There is no teardown, no test-scoped Convex environment, and no use of the `convex-test` package (which is in `devDependencies`) for this test path.

**Suggested Fix:**

- Ensure E2E tests run exclusively against a dedicated test Convex deployment (separate `CONVEX_URL` for CI). This is the standard pattern.
- Consider adding a test-scoped cleanup: after the "logging a new food" test, delete the log entry using an internal Convex mutation exposed only in test environments.
- Document in `playwright.config.ts` which Convex environment the E2E suite targets.

---

_End of audit. All prior findings from `scripts/ship/review-findings-_.json` were reviewed during deduplication. The findings above represent net-new observations from the Group 2 file scope.\*
