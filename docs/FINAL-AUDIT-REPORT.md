# PDH Codebase Audit -- Final Consolidated Report

**Date:** 2026-04-06
**Branch:** feat/nutrition
**Files audited:** 402
**Auditors:** 18 Sonnet agents (6 Security+Performance, 6 Maintainability+Quality, 6 Simplification)
**Consolidated by:** Opus

## Summary

- Total unique findings: 85
- Critical: 4
- High: 25
- Moderate: 42
- Nice-to-have: 14

---

## CRITICAL Findings

### 1. Divergent getCelebration implementations -- logic bug producing wrong celebration behavior

**Severity:** CRITICAL
**Categories:** Code Quality, Maintainability
**Files:** `src/hooks/useCelebrationTrigger.ts:34-73`, `src/lib/celebrations.ts:23-61`
**Reported by:** maint-quality-group5

**Problem:** `useCelebrationTrigger.ts` contains a hand-inlined copy of `getCelebration` (noted in a comment as "inlined from celebrations.ts") but the two implementations have diverged in a way that produces different behaviour. `celebrations.ts` uses `streak >= 7 && streak % 7 === 0` (fires for every 7-day multiple: 7, 14, 21...). `useCelebrationTrigger.ts` uses `streak === 7` (fires only at exactly 7 days). The milestone message in the hook also hard-codes "7 days straight", which will print the wrong number if the canonical version fires at higher multiples. Because `useQuickCapture` -> `useCelebrationTrigger` is the live code path used on the Track page, the canonical file (`celebrations.ts`) is effectively dead code while the in-file copy with the bug is active.

**Fix:** Delete the inlined private `getCelebration` from `useCelebrationTrigger.ts`. Import from `src/lib/celebrations.ts` directly: `import { getCelebration } from "@/lib/celebrations";`. Update the consumer comment in `celebrations.ts` from `useQuickCapture.ts` to `useCelebrationTrigger.ts`. Delete the dead duplicate.

---

### 2. Tile color constants triplicated across three files with dead `constants.ts` export

**Severity:** CRITICAL
**Categories:** Maintainability, Code Quality
**Files:** `src/components/track/quick-capture/constants.ts:L1-26`, `src/components/track/quick-capture/QuickCaptureTile.tsx:L16-37`, `src/components/track/quick-capture/DurationEntryPopover.tsx:L27-48`
**Reported by:** maint-quality-group4, simplify-group4

**Problem:** `TINT_BY_PROGRESS_COLOR` and `TINT_CLASSES` are copy-pasted verbatim into all three files. A `constants.ts` file was created specifically to house these values -- and then the exact same definitions were left in-place inside both `QuickCaptureTile.tsx` and `DurationEntryPopover.tsx`. The `constants.ts` export is never imported by either component. This means: (1) three independent sources of truth for what "emerald" or "red" tint means on a tile, (2) a designer or developer changing a color must find and update all three files with no type error if they miss one, (3) `constants.ts` exports dead code. This is the exact scenario the CLAUDE.md "Leave it Better" rule warns against.

**Fix:** Remove the local definitions from `QuickCaptureTile.tsx` (L16-37) and `DurationEntryPopover.tsx` (L27-48), and import from `constants.ts` instead: `import { TINT_BY_PROGRESS_COLOR, TINT_CLASSES } from "./constants";`. Export the `TileColorTint` type from `constants.ts` so both components use the canonical type.

---

### 3. review-findings.json summary block is all-zero, masking 14 real findings

**Severity:** CRITICAL
**Categories:** Maintainability
**Files:** `scripts/ship/review-findings.json:L169-175`
**Reported by:** maint-quality-group2

**Problem:** The `review-findings.json` file on the current branch `feat/nutrition` contains 14 substantive findings covering security issues (CSP vulnerabilities), correctness regressions (broken PWA icons and screenshots), and MODERATE code-quality issues. Despite this, the `summary` block at the end of the file explicitly reads `{ "critical": 0, "high": 0, "moderate": 0, "nice_to_have": 0 }`. Any automated gate, dashboard, or CI check that reads the summary block to decide whether to allow a merge will see a clean bill of health while the file itself contains HIGH severity findings. The findings are completely hidden by the summary.

**Fix:** Recount and correct the summary to reflect the actual findings in the file. Treat the summary as a machine-readable contract, not a post-hoc label.

---

### 4. Section numbering comment mismatch in DrPooReportDetails

**Severity:** CRITICAL
**Categories:** Code Quality
**Files:** `src/components/archive/DrPooReport.tsx:L177`, `DrPooReport.tsx:L193`
**Reported by:** maint-quality-group3

**Problem:** The JSDoc comment at the top of `DrPooReportDetails` (lines 64-73) documents sections 0-5 in a specific order. However in the rendered JSX the Suggestions block is labelled `{/* 5. Suggestions */}` and the Disclaimer is labelled `{/* 6. Disclaimer */}` -- meaning the comment says section 4 for Suggestions but the inline comment says 5, and the comment says section 5 for Disclaimer but the inline comment says 6. Section 4 is completely missing from the rendered output. Any developer trying to reorder or add sections would count incorrectly.

**Fix:** Reconcile the section numbers. Align inline JSX comments to match the doc comment (0-5). Remove the gap. One true source of numbering -- the doc comment -- is sufficient.

---

## HIGH Findings

### 5. Date.now() called inside mutations -- violates Convex determinism requirement

**Severity:** HIGH
**Categories:** Security, Data Correctness, Maintainability
**Files:** `convex/foodParsing.ts:L1551,L1570`, `convex/migrations.ts:L1146`, `convex/foodRequests.ts:L42`, `shared/foodEvidence.ts:L1213`
**Reported by:** sec-perf-group1, sec-perf-group2, maint-quality-group1

**Problem:** Convex mutations must be deterministic because Convex replays them on retry. Calling `Date.now()` inside a mutation handler produces different values on each replay, corrupting timestamps on retry. Specific violations: (1) `convex/foodParsing.ts:L1551,L1570` -- `processEvidence` (an `internalMutation`) uses `args.now ?? Date.now()`, and the scheduler call from `processLogInternal` does NOT pass `now`, so on replay the timestamp will differ. (2) `convex/migrations.ts:L1146` -- `normalizeProfilesV2` calls `Date.now()` directly with no escape hatch. (3) `convex/foodRequests.ts:L42` -- `submitRequest` has `createdAt: args.now ?? Date.now()` where `now` is optional. (4) `shared/foodEvidence.ts:L1213` -- `buildFoodEvidenceResult` uses `args.now ?? Date.now()`, and since this shared function can be called from Convex mutations, the non-determinism is hidden inside a utility. Additionally, multiple client-side files pass `timestamp: Date.now()` as client-supplied mutation arguments (`src/contexts/ProfileContext.tsx:L157`, `src/hooks/usePendingReplies.ts:L19`, `src/hooks/useAiInsights.ts:L318,L361`), which allows spoofed timestamps from modified clients.

**Fix:** For server-side mutations: make `now` a required argument (not optional) in all mutation args. All calling actions must pass `now: Date.now()` when scheduling. For `shared/foodEvidence.ts`: make `args.now` required so callers must explicitly supply the timestamp. For client-supplied timestamps: generate authoritative timestamps server-side in the mutation handler; remove `now`/`timestamp` from mutation argument schemas and compute internally; if the client genuinely needs to pass a user-intended time (e.g. backdating), validate and clamp server-side to a reasonable window (e.g. +/-7 days).

---

### 6. importBackup mutation performs unbounded operations with no payload validation -- data loss risk

**Severity:** HIGH
**Categories:** Security, Performance
**Files:** `convex/logs.ts:L1592-L1614,L1687`, `src/components/settings/app-data-form/useAppDataFormController.ts:L40-L58,L130-L150`
**Reported by:** sec-perf-group1, sec-perf-group3

**Problem:** `importBackup` first calls `deleteAllUserData` (which loops in `while(true)` taking 200 rows at a time), then iterates over every row in the uploaded `payload.data` object and calls `ctx.db.insert()` for each row with no cap. The backup payload validator uses `v.array(v.any())` with no length limit. A large payload could cause the mutation to fail mid-way, leaving partial data in an inconsistent state. The prior `deleteAllUserData` already ran and deleted the user's real data -- if the subsequent inserts fail, the user loses their data permanently with no recovery path. On the client side, `validateBackupPayload` checks the top-level shape but does not validate the content of `data.logs`. Malformed entries with unexpected `type` values, future timestamps, or bad data blobs are passed directly to Convex.

**Fix:** (1) Add array length caps per table in the backup payload validator before processing (e.g., max 10,000 log entries). (2) Split import into multiple mutations (delete phase, then insert in chunks by table) via `ctx.scheduler.runAfter` so each chunk is its own transaction, making partial failure recoverable. (3) Add a client-side validation pass over `data.logs` checking that each entry has a known `type`, numeric `timestamp`, and object `data` field. Reject the import if any log fails validation.

---

### 7. conversations.listByReport uses non-userId-scoped index -- cross-tenant data read

**Severity:** HIGH
**Categories:** Security, Maintainability
**Files:** `convex/conversations.ts:L90-L103`
**Reported by:** sec-perf-group1, sec-perf-group4, maint-quality-group1

**Problem:** `listByReport` fetches all conversation messages for a given `aiAnalysisId` using the `by_aiAnalysisId` index, which is not scoped by `userId`. It then filters in-memory by `userId`. This is security-by-obscurity: Convex document IDs are opaque but not cryptographic secrets and are routinely exposed in API responses, client-side state, URLs, and logs. The underlying query reads all messages for the target analysis ID across all users -- an unnecessary cross-tenant DB read. When the app becomes multi-user, this is a privilege escalation vector.

**Fix:** Add a `by_userId_aiAnalysisId` compound index to the `conversations` table in `schema.ts`. Then query with both fields: `.withIndex("by_userId_aiAnalysisId", (q) => q.eq("userId", userId).eq("aiAnalysisId", args.aiAnalysisId)).collect()`. This enforces isolation at the DB layer and eliminates cross-tenant reads.

---

### 8. Client-provided API key accepted as fallback -- keys transit the network and may be logged

**Severity:** HIGH
**Categories:** Security
**Files:** `convex/ai.ts:L46-L98`, `convex/foodLlmMatching.ts:L542-L719`, `src/lib/apiKeyStore.ts:L1-30`, `src/components/settings/AiSuggestionsCard.tsx:L36,L65-L68`
**Reported by:** sec-perf-group1, sec-perf-group3, sec-perf-group6

**Problem:** Multiple issues with API key handling: (1) Both Convex actions accept an `apiKey: v.optional(v.string())` arg from the client as a legacy BYOK fallback, meaning the raw key transits the network and is serialized in Convex action call logs. (2) The API key is stored in IndexedDB under a predictable key (`PDH-ai-key`) accessible to all same-origin scripts including XSS payloads. There is no encryption at rest. (3) The raw API key string is passed through multiple layers of client-side code (e.g., `AiSuggestionsCard` passes it to `generateSettingsSuggestions`), increasing the surface area for accidental logging. A stolen key lets an attacker make arbitrary AI calls billed to the user's OpenAI account.

**Fix:** (1) Set a timeline to remove the client key arg entirely. Flag with a TODO and target date. (2) Proxy all AI calls through Convex actions that hold the key server-side. If BYOK must remain, store only in `sessionStorage` (cleared on tab close), never persistent storage. (3) Ensure `generateSettingsSuggestions` and `callAi` never log the `apiKey` parameter. Keep key retrieval as close to the Convex action call boundary as possible.

---

### 9. exportBackup performs parallel full-table collects for 13 tables -- no pagination

**Severity:** HIGH
**Categories:** Performance
**Files:** `convex/logs.ts:L1616-L1644`
**Reported by:** sec-perf-group1

**Problem:** `exportBackup` uses `Promise.all` to run 13 `listRowsByUserId` calls simultaneously, each calling `.collect()` with no row limit. A user with years of data could have tens of thousands of rows in `logs`, `ingredientExposures`, `conversations`, etc. Each `.collect()` reads all rows into memory. Running 13 simultaneously will hit Convex's query execution limits for active users, causing the export to fail for precisely the users who need it most.

**Fix:** Add safety caps per table (e.g., 10,000 rows). For complete backup of large datasets, implement paginated export by date range or cursor. Consider implementing as an `action` instead of a `query` for higher execution limits.

---

### 10. Hardcoded patient name ("Peter") in system prompt -- GDPR/privacy violation

**Severity:** HIGH
**Categories:** Security, Code Quality
**Files:** `src/lib/aiAnalysis.ts:L1316,L1320`
**Reported by:** sec-perf-group6

**Problem:** Two fields in the LLM system prompt contain hardcoded references to "Peter" by name, including personal details about ADHD and eating habits. These strings are shipped in the client bundle. If the app is ever opened by a different user, the LLM will address them as "Peter" and the prompt reveals the system was designed for a specific individual. The CLAUDE.md constraint "No Hard-Coding Personalization" is explicitly violated. This is both a PII-in-code security concern and a product correctness issue.

**Fix:** Remove all hardcoded references to "Peter" from the prompt-building code. The `preferredName` field in `AiPreferences` already exists and is inserted via `sanitizeNameForPrompt`. Use `preferredName` variable or "the patient" throughout.

---

### 11. Health profile free-text fields injected into LLM prompts without per-field length caps

**Severity:** HIGH
**Categories:** Security
**Files:** `src/lib/aiAnalysis.ts:L1009-L1058,L1316`
**Reported by:** sec-perf-group6

**Problem:** Free-text health profile fields (`medications`, `supplements`, `allergies`, `intolerances`, `lifestyleNotes`, `dietaryHistory`, `otherConditions`) are trimmed but not length-capped before being embedded in the LLM system prompt. The `sanitizeUnknownStringsDeep` call uses a 50,000-char limit per field -- far too high for individual prompt fields. A malicious entry like `"Ignore all previous instructions..."` would be inserted directly into the system prompt with no further sanitisation beyond control-character stripping.

**Fix:** Apply per-field length caps at the prompt-building layer: medications/supplements/allergies 500 chars each, lifestyleNotes/dietaryHistory 1,000 chars each, otherConditions 200 chars. Apply the same `sanitizeNameForPrompt`-style treatment (strip BiDi characters, HTML tags) to all free-text fields, not just `preferredName`.

---

### 12. Duplicated API-key utility functions across three files

**Severity:** HIGH
**Categories:** Code Quality, Maintainability
**Files:** `convex/ai.ts:L15-L35`, `convex/foodLlmMatching.ts:L42,L113-L130`, `convex/profiles.ts:L23`
**Reported by:** maint-quality-group1, simplify-group1

**Problem:** Three separate files each define their own copy of `OPENAI_API_KEY_PATTERN`, `maskApiKey()`, and a near-identical HTTP error classifier (`classifyOpenAiError` in `ai.ts` vs `classifyHttpError` in `foodLlmMatching.ts`). The functions are functionally identical -- same regex, same logic, same fallback. A comment in `profiles.ts` acknowledges this. The two error classifiers have subtly diverged: both have dead-code double-fallthrough in the else branch. Any change to the API key format requires updating three files.

**Fix:** Create `convex/lib/openai.ts` exporting `OPENAI_API_KEY_PATTERN`, `maskApiKey`, and `classifyOpenAiHttpError`. Import from all three call sites and delete the local definitions.

---

### 13. convex/logs.ts is a 2,100-line god file with mixed responsibilities

**Severity:** HIGH
**Categories:** Maintainability
**Files:** `convex/logs.ts`
**Reported by:** maint-quality-group1

**Problem:** `logs.ts` currently owns: (1) log CRUD mutations, (2) the full profile management system with 10+ optional field normalizers, (3) habit config normalization (~200 lines), (4) the backup export/import system (~600 lines), (5) data access helpers for backup (coerce functions at L1508-1529), and (6) `batchUpdateFoodItems`. These are at least four distinct responsibilities with no coupling. The file is hard to navigate -- `patchProfile` runs from L1117 to L1251 with a 60-line inline payload construction repeated nearly identically in `replaceProfile`.

**Fix:** Split into at minimum three files: `convex/logs.ts` (log CRUD only), `convex/profileMutations.ts` (replaceProfile, patchProfile, getProfile with normalization helpers), `convex/backup.ts` (exportBackup, importBackup, deleteAll with coerce helpers).

---

### 14. Duplicated private utility functions across logs.ts, migrations.ts, ingredientNutritionApi.ts

**Severity:** HIGH
**Categories:** Code Quality, Maintainability
**Files:** `convex/logs.ts:L74,L80,L512,L1508-L1529`, `convex/migrations.ts:L58,L117-L138`, `convex/ingredientNutritionApi.ts:L7-L19`
**Reported by:** maint-quality-group1, simplify-group1

**Problem:** `asTrimmedString`, `asNumber`, `asStringArray`, `asRecord` are each defined independently in `logs.ts` (twice -- once at the top and again near L1508), `migrations.ts`, and `ingredientNutritionApi.ts`. The variants are not identical. Additionally, `slugify` in `migrations.ts:L58` and `slugifyHabitName` in `logs.ts:L512` are byte-for-byte identical except the function name. `inferHabitType` and `inferHabitTypeFromName` implement the same logic with slightly different regex coverage across files, with a manual `// SYNC WITH` comment.

**Fix:** Create `convex/lib/coerce.ts` exporting canonical coercion helpers. Move `slugifyHabitName` and `inferHabitTypeFromName` to shared locations. Remove manual `// SYNC WITH` comments and enforce single source of truth.

---

### 15. buildFoodEvidenceResult processes unbounded logs with O(T x E) inner loop

**Severity:** HIGH
**Categories:** Performance
**Files:** `shared/foodEvidence.ts:L1206`
**Reported by:** sec-perf-group2

**Problem:** `buildFoodEvidenceResult` iterates over `args.logs` four times back-to-back and calls `buildFoodTrials` twice. A user with 18+ months of logs (10,000-20,000 rows) will load all documents into memory. The `findTriggerCorrelations` inner loop is O(T x E) where T = trial count and E = digestive event count. For a heavy user with 1,000 food trials and 400 bowel events this loop runs 400,000 iterations. When called from a `useQuery` subscription via `listAll`, this computation re-runs on the main thread every time any log is added.

**Fix:** Move `buildFoodEvidenceResult` to a Convex action or scheduled function that computes evidence incrementally and stores results in `foodTrialSummaries`. In the interim, cap `args.logs` to the most recent 2,000 entries. Change `findTriggerCorrelations` from O(T x E) to O(T + E) with a two-pointer approach since both arrays are sorted by timestamp.

---

### 16. foodCanonicalization.ts throws on startup if registry has alias collisions -- no recovery path

**Severity:** HIGH
**Categories:** Security, Availability
**Files:** `shared/foodCanonicalization.ts:L81-87,L92`
**Reported by:** sec-perf-group2

**Problem:** `buildExampleMap()` is called at module load time. If the `FOOD_REGISTRY` contains duplicate normalized aliases, `buildExampleMap` throws an `Error`. Because this is a module-level initializer, the error propagates as an unhandled module load failure. In a browser, this crashes the entire JavaScript bundle silently. In a Convex worker, it causes every function in any importing module to fail. A single duplicate registry entry breaks the entire app with no graceful degradation.

**Fix:** Move duplicate detection to a build-time check (a Vitest unit test or Vite plugin). At runtime, log the collision warning via `console.error` and skip the duplicate rather than throwing.

---

### 17. Regex patterns compiled inside functions on every call

**Severity:** HIGH
**Categories:** Performance
**Files:** `shared/foodNormalize.ts:L229`, `shared/foodMatching.ts:L179`, `shared/foodParsing.ts:L207,L221`
**Reported by:** sec-perf-group2, simplify-group2

**Problem:** In `normalizeFoodName`, the `FILLER_PHRASES` loop calls `new RegExp(...)` inside a for-loop on every invocation. `normalizeFoodName` is called for every food item in every log, every registry entry, and on every keystroke in search input. Each call re-compiles up to 5 regular expressions. In `foodMatching.ts`, `protectPhrases` similarly creates `new RegExp(phrase, "gi")` inside a loop. In `foodParsing.ts`, `parseLeadingQuantity` creates two `new RegExp(...)` patterns from template literals on every call using the static `MEASURE_UNIT_PATTERN`.

**Fix:** Pre-compile all regex patterns at module load time as `const` values. For FILLER_PHRASES, build a single combined pattern: `const FILLER_PHRASE_PATTERN = new RegExp(FILLER_PHRASES.map(p => \`\\b${p}\\b\`).join('|'), 'gi')`. For `parseLeadingQuantity`, hoist the two `new RegExp(...)`calls to module-level constants alongside`MEASURE_UNIT_PATTERN`.

---

### 18. AI error messages rendered directly in UI without sanitization

**Severity:** HIGH
**Categories:** Security
**Files:** `src/components/archive/ai-insights/AnalysisProgressOverlay.tsx:L40-L57`, `src/hooks/useAiInsights.ts:L354-L357`
**Reported by:** sec-perf-group3, sec-perf-group5

**Problem:** The `error` prop is rendered verbatim in the UI without redaction. AI pipeline errors can include request IDs, model names, rate-limit quotas, account tier information, partial health data, or raw API key fragments. There is a "Show more" toggle that exposes the full error string. In `useAiInsights`, `getErrorMessage(err)` extracts `err.message` and passes it directly to `setAiAnalysisStatus("error", message)`, surfacing it as UI state.

**Fix:** Create a `formatAiError(err)` helper that maps known OpenAI error classes to user-friendly strings (rate limit -> "Too many requests", auth -> "API key problem") and falls back to a generic "Analysis failed" for unrecognized errors. Strip anything that looks like a key (`sk-...`) or JSON payload. Apply the same pattern as `sanitizeApiKeyError` in `useApiKey.ts`.

---

### 19. AI-generated Markdown rendered without rehype-sanitize

**Severity:** HIGH
**Categories:** Security
**Files:** `src/components/track/dr-poo/ConversationPanel.tsx:L133,L182`, `src/components/archive/DrPooReport.tsx:L93,L129,L169,L183`
**Reported by:** sec-perf-group4

**Problem:** `react-markdown` is used to render AI-generated conversation content and report details with custom `AI_MARKDOWN_COMPONENTS` but without `rehype-sanitize`. Since the content originates from an LLM that processes user health data, a prompt injection attack (user types a message that manipulates the LLM to emit malicious markdown) is a realistic threat surface. There is also no cap on the size of rendered strings -- a runaway AI response could cause UI jank.

**Fix:** Add `rehype-sanitize` as a rehype plugin to all `react-markdown` instances rendering AI content. Add a `MAX_AI_CONTENT_CHARS = 4000` constant and slice strings before passing to `<Markdown>`. Log a warning when content is truncated.

---

### 20. ADD_TO_STAGING aggregation path bypasses MAX_PORTION_G clamp -- data corruption risk

**Severity:** HIGH
**Categories:** Security, Data Integrity
**Files:** `src/components/track/nutrition/useNutritionStore.ts:L243-L244`
**Reported by:** sec-perf-group4

**Problem:** The `ADJUST_STAGING_PORTION` reducer case correctly clamps `newPortionG` to `MAX_PORTION_G` (500g). However the `ADD_TO_STAGING` case -- triggered every time a user taps (+) on an already-staged food -- does not apply this clamp. Rapid repeated tapping can push a single item well above 500g, generating arbitrarily inflated macro and calorie totals that get written to Convex. This corrupts the user's nutrition data.

**Fix:** One-line fix in `ADD_TO_STAGING`: `const newPortionG = Math.min(existing.portionG + increment, MAX_PORTION_G);`

---

### 21. conversations.listByDateRange fetches without a document limit -- unbounded subscription

**Severity:** HIGH
**Categories:** Performance
**Files:** `convex/conversations.ts:L118`, `src/components/track/dr-poo/ConversationPanel.tsx:L34`
**Reported by:** sec-perf-group4

**Problem:** `useConversationsByDateRange(halfWeekStartMs, STABLE_END)` passes `STABLE_END = 9_999_999_999_999` (year 2286) as the upper bound. The server-side `listByDateRange` query uses `.collect()` with no document limit. Over time, a user with many Dr. Poo messages will cause this subscription to return an unbounded result set. Convex has a 1MB document budget per query; hitting it causes a runtime error that crashes the panel.

**Fix:** Add a `limit` argument to `listByDateRange` and apply `.take(limit)` before `.collect()`. Clamp at 500 messages. The client should pass a reasonable cap (200-500).

---

### 22. Client-side rate limiter is trivially bypassable and shared across unrelated AI features

**Severity:** HIGH
**Categories:** Security
**Files:** `src/lib/aiRateLimiter.ts:L9`, `src/lib/habitCoaching.ts:L39`
**Reported by:** sec-perf-group6, maint-quality-group6

**Problem:** `lastCallTimestamp` is a module-level variable that resets on page reload, HMR, or new tab. An attacker can bypass the 5-minute floor by reloading. Additionally, `checkRateLimit()` is called by both `fetchAiInsights` (Dr. Poo analysis) and `generateCoachingSnippet` (habit coaching) -- both share the same `lastCallTimestamp`, meaning a coaching snippet blocks Dr. Poo analysis for 5 minutes and vice versa. The limiter state also does not survive Vite HMR in dev. The dead branch `if (MIN_CALL_INTERVAL_MS <= 0) return;` adds noise since the constant is always 300,000.

**Fix:** Enforce a per-user cooldown server-side in the Convex action. Record `lastCallAt` per user in a Convex document and reject calls that violate the interval. Use separate rate limiter instances (or named keys) for different AI call types. Remove the dead `<= 0` branch. The client-side check can remain as a UX guard only.

---

### 23. E2E test suite uses `page.waitForTimeout()` extensively -- tests are timing-dependent and fragile

**Severity:** HIGH
**Categories:** Code Quality, Maintainability
**Files:** `e2e/nutrition-water-modal.spec.ts:L35,L44,L102,L111,L119,L142,L158,L200,L268,L276`, `e2e/sleep-tracking.spec.ts:L27,L30`, `e2e/weight-tracking.spec.ts:L37,L43,L64`, `e2e/food-tracking.spec.ts:L43,L70`, `e2e/fluid-tracking.spec.ts:L54`, `e2e/bowel-tracking.spec.ts:L48`, `e2e/drpoo-cooldown.spec.ts`, `e2e/nutrition-full-flow.spec.ts`, `e2e/patterns-food-trials.spec.ts:L149,L516`
**Reported by:** sec-perf-group2, maint-quality-group1, maint-quality-group2

**Problem:** The E2E test suite contains dozens of `page.waitForTimeout(N)` calls with hardcoded millisecond delays (100ms to 1500ms). `waitForTimeout` is a fixed sleep that does not wait for a condition. Under CI load, delays are insufficient; under fast local machines, they waste time. The water modal spec alone has 14 such calls. The sleep-tracking spec has an unusual retry loop (L23-33) that catches and silences errors across three attempts, masking real failures. Each spec file also re-defines its own navigation/locator helpers (`navigateAndWait`, `getNutritionCard`, `getBowelSection`, `getQuickCapture`) identically instead of importing from the existing `e2e/fixtures.ts`.

**Fix:** Replace all `page.waitForTimeout(N)` calls with explicit condition waits: `await expect(element).toBeVisible({ timeout: 8000 })`. Extract shared page objects into `e2e/fixtures.ts` or `e2e/pages/` following the Playwright Page Object Model. Remove retry loops in favor of single attempts with appropriate timeouts.

---

### 24. FoodMatchingModal queries unbounded result sets at 160 items on cold open

**Severity:** HIGH
**Categories:** Performance
**Files:** `src/components/track/FoodMatchingModal.tsx:L95-L103`
**Reported by:** sec-perf-group3

**Problem:** When the modal opens with no search query and no active bucket, it immediately issues a Convex `useQuery` that requests 160 results. This query fires every time the modal opens. Because it is a live `useQuery` subscription, Convex pushes updates whenever the underlying food table changes. Subscribing to 160 food registry entries is a non-trivial subscription cost, and it fires even when the user has no intention of interacting with the search box.

**Fix:** Use `"skip"` for the initial no-query, no-bucket state and only fire the query once the user has typed at least 1 character or selected a bucket.

---

### 25. Duplicated frequency-map computation in FoodFilterView

**Severity:** HIGH
**Categories:** Performance, Maintainability
**Files:** `src/components/track/nutrition/FoodFilterView.tsx:L95-L135`
**Reported by:** sec-perf-group4, maint-quality-group4, simplify-group4

**Problem:** The component has two separate `useMemo` blocks -- `frequentFoods` (L95-115) and `frequencyCountMap` (L118-135) -- that both perform an identical full scan of the `logs` array. The 14-day window can contain thousands of log entries. Both memos have identical dependency arrays (`[logs]`), so they run back-to-back whenever logs update, doubling the work.

**Fix:** Compute a single `frequencyData` memo that returns both `{ sortedFrequentFoods, countMap }` from one pass over the logs array.

---

### 26. ZONE_COLORS duplicated across two files with different semantics

**Severity:** HIGH
**Categories:** Maintainability
**Files:** `src/components/track/FoodMatchingModal.tsx:L38-L42`, `src/components/track/nutrition/NutritionCard.tsx:L324-L328`
**Reported by:** maint-quality-group3

**Problem:** Both files define a `const ZONE_COLORS` map keyed by zone number (1, 2, 3). In `FoodMatchingModal.tsx` the values are Tailwind compound class strings. In `NutritionCard.tsx` the values are raw hex colours. The two maps use different colouring choices for the same zones -- zone 3 is red in the modal but orange in the nutrition card. A developer updating zone semantics would have to find and update both locations.

**Fix:** Extract zone colour logic into a shared utility in `src/lib/zoneColors.ts` with a single canonical colour per zone. Resolve the semantic inconsistency (red vs orange for zone 3) at the same time.

---

### 27. Duplicated activity type key normalization function

**Severity:** HIGH
**Categories:** Maintainability
**Files:** `src/hooks/useDayStats.ts:L38-L46`, `src/hooks/useHabitLog.ts:L68-L77`, `src/lib/derivedHabitLogs.ts:L19-L21`, `src/pages/Track.tsx:L125-L133`
**Reported by:** maint-quality-group5, maint-quality-group6

**Problem:** Four files implement the same activity type normalization logic (lowercasing, replacing non-alphanumeric chars, mapping "walk" to "walking"). The implementations have already diverged: `toActivityType` handles `habitType === "sleep"` early, while `toActivityTypeKey` has no such check. `derivedHabitLogs.ts` uses `normalizeKey` + `normalizeActivityType`, while `Track.tsx` uses `toActivityTypeKey` + its own regex. If the normalization rules diverge, logs will be matched differently in retrospective rebuilds vs. the live track page.

**Fix:** Extract a single `normalizeActivityTypeKey(value: string): string` function into a shared module (e.g. `src/lib/activityTypeUtils.ts`) and import in all four files.

---

### 28. Dead exports and unused code patterns across multiple files

**Severity:** HIGH
**Categories:** Maintainability
**Files:** `src/components/patterns/database/foodSafetyUtils.ts:L20-30`, `src/components/patterns/database/index.ts:L22-23`, `src/hooks/useQuickCapture.ts:L50-56,L133`, `src/hooks/useCelebration.ts:L7-8`
**Reported by:** maint-quality-group3, maint-quality-group5

**Problem:** Multiple dead code patterns: (1) `foodSafetyUtils.ts` exports `FILTER_OPTIONS`, `FilterStatus`, `SortKey`, `SortDir`, and `BRAT_KEYS` -- zero import sites found. (2) `useQuickCapture` returns `detailDaySummaries: []` permanently -- the field is declared in the interface but always empty. (3) `useCelebration` declares `SOUND_ENABLED = true` and `CONFETTI_ENABLED = true` as constants, making the `else` branches (toast.success fallbacks) permanently dead code.

**Fix:** (1) Delete dead exports from `foodSafetyUtils.ts` and corresponding `database/index.ts` entries. (2) Remove `detailDaySummaries` from `QuickCaptureResult` interface and the `detailDaySummaries: []` return value. (3) Remove `SOUND_ENABLED`/`CONFETTI_ENABLED` constants and the dead conditional branches in `useCelebration`.

---

### 29. SmartViews.tsx and FilterSheet.tsx mix concerns and duplicate sortable column lists

**Severity:** HIGH
**Categories:** Maintainability
**Files:** `src/components/patterns/database/SmartViews.tsx:L1-113`, `src/components/patterns/database/FilterSheet.tsx:L51-57`
**Reported by:** maint-quality-group3

**Problem:** `SmartViews.tsx` exports runtime validation/normalisation functions, equality helpers, filter-matching functions, Set constants, type definitions, AND the React component -- all in one file. The non-UI logic belongs in a utility module. Additionally, `FilterSheet.tsx` defines `SORT_OPTIONS` and `SmartViews.tsx` independently defines `SORTABLE_COLUMN_IDS` -- same column IDs, no enforcement of the relationship, can silently diverge.

**Fix:** Move normalisation, equality, row-matching, row-counting functions and `SORTABLE_COLUMN_IDS` into `filterUtils.ts` or `smartViewUtils.ts`. Define `SORT_OPTIONS` once and derive `SORTABLE_COLUMN_IDS` from it.

---

## MODERATE Findings

### 30. allFoodTrials, allIngredients, allFoods -- unbounded .collect() queries on growing tables

**Severity:** MODERATE
**Categories:** Performance
**Files:** `convex/aggregateQueries.ts:L61-L76`, `convex/ingredientExposures.ts:L28-L96`, `convex/foodAssessments.ts:L39-L84`, `src/lib/syncFood.ts:L91-L99`, `src/lib/syncLogs.ts:L24-L27`
**Reported by:** sec-perf-group1, sec-perf-group6

**Problem:** Multiple queries perform unbounded `.collect()` calls on tables that grow with user data: `allFoodTrials` on `foodTrialSummary` (no limit), `allIngredients` default limit is 5,000 rows (max 20,000), `allFoods` hard-codes 2,000 with no `isTruncated` flag, `useAllSyncedLogs` calls `api.logs.listAll` with no limit, and `useAllFoods`/`useAllAssessmentRecords`/`useAllIngredientExposures` have no limits. All are reactive subscriptions that re-read and re-transmit on every mutation. For active users, these become expensive.

**Fix:** Add `.take()` caps with warning logs when reached. Add `isTruncated` flags to return values (matching the pattern in `ingredientExposures.allIngredients`). For the AI pipeline, fetch only the needed date range. Consider pre-computed aggregation tables.

---

### 31. mergeDuplicates mutation performs unbounded full-table collects within one transaction

**Severity:** MODERATE
**Categories:** Performance
**Files:** `convex/foodLibrary.ts:L299-L854`
**Reported by:** sec-perf-group1

**Problem:** `mergeDuplicates` is a public mutation that collects all rows from 7 tables within a single transaction. For active users, `foodAssessments` could have thousands and `ingredientExposures` tens of thousands. Makes N individual `ctx.db.patch()` calls for every matching row. Risks exceeding Convex per-mutation limits.

**Fix:** Break into multiple phases, each as a separate internal mutation orchestrated by an action. Add row-count caps to each collect.

---

### 32. getWeekStart uses Date mutation methods inside internalMutation -- non-deterministic timezone behavior

**Severity:** MODERATE
**Categories:** Security, Data Correctness
**Files:** `convex/computeAggregates.ts:L426-L441,L452`, `convex/aggregateQueries.ts:L143-L159`
**Reported by:** sec-perf-group1

**Problem:** `getWeekStart` uses `new Date()`, `date.getDay()`, `date.setDate()`, and `date.setHours(0,0,0,0)` inside an `internalMutation`. The `setHours` call uses the server's local timezone (UTC on Convex, but implicit). Additionally, `currentWeekDigest` accepts `weekStartMs` from the client with no shared utility ensuring client and server compute the same value. If they differ by even a millisecond, the query returns null.

**Fix:** Replace with pure epoch arithmetic for determinism. Move `getWeekStart` to `shared/` and export for use by both server and client.

---

### 33. listFoodEmbeddings fetches full 1536-dimension vectors for staleness check

**Severity:** MODERATE
**Categories:** Performance
**Files:** `convex/foodParsing.ts:L453-L470`
**Reported by:** sec-perf-group1

**Problem:** `listFoodEmbeddings` fetches up to 1,000 full `foodEmbeddings` documents, each containing a 1,536-float embedding (~12KB per document). The purpose is only to check `canonicalName` and `embeddingSourceHash` for staleness. At 1,000 documents, this reads ~12MB of float data that is immediately discarded.

**Fix:** Store embedding staleness metadata in a separate small table (e.g. `foodEmbeddingMeta`) with only `canonicalName` and `embeddingSourceHash`. Reduces staleness check from ~12MB to ~50KB.

---

### 34. foodLlmMatching.matchUnresolvedItems has no rate limiting or input length cap

**Severity:** MODERATE
**Categories:** Security
**Files:** `convex/foodLlmMatching.ts:L542-L719`
**Reported by:** sec-perf-group1

**Problem:** The public action accepts `unresolvedSegments: v.array(v.string())` with no length limit. Each segment triggers OpenAI API calls. No rate limiting or cost tracking.

**Fix:** Add a length cap: `if (args.unresolvedSegments.length > 20) throw new Error(...)`.

---

### 35. RelativeTime component creates one setInterval per visible table row

**Severity:** MODERATE
**Categories:** Performance
**Files:** `src/components/patterns/database/columns.tsx:L141-L153`
**Reported by:** sec-perf-group3

**Problem:** With 25-100 rows visible, creates 25-100 simultaneous `setInterval` timers running every 60 seconds, each causing a setState and re-render. The `formatRelativeTime` function also belongs in a shared utility, not a column-factory file.

**Fix:** Replace per-instance `setInterval` with a global `useCurrentMinute()` hook. Move `formatRelativeTime` to `src/lib/trialFormatters.ts` or `src/lib/dateUtils.ts`.

---

### 36. FoodSection and BowelSection double-submit vulnerability

**Severity:** MODERATE
**Categories:** Security, Data Integrity
**Files:** `src/components/track/panels/FoodSection.tsx:L32-L54`, `src/components/track/panels/BowelSection.tsx:L206`
**Reported by:** sec-perf-group4

**Problem:** `submitFood` guards with `if (saving) return` then calls `setSaving(true)` -- but in React 18 concurrent rendering, two rapid invocations can both pass the guard before either sets `saving = true`, resulting in duplicate log entries. `BowelSection.handleSave` has the same issue and is also not wrapped in `useCallback`, causing stale closure risks.

**Fix:** Use a `useRef` as an immediate non-reactive guard: `const submittingRef = useRef(false); if (submittingRef.current) return; submittingRef.current = true;`. Also wrap `handleSave` in `useCallback`.

---

### 37. Hardcoded en-GB locale in AI prompt construction

**Severity:** MODERATE
**Categories:** Security, Code Quality
**Files:** `src/hooks/useWeeklySummaryAutoTrigger.ts:L18,L147,L163`
**Reported by:** sec-perf-group5, maint-quality-group5

**Problem:** Timestamps in the weekly summary payload are formatted with `toLocaleString("en-GB", ...)` and the comment references "Barcelona CET/CEST" -- hardcoding for a single user's locale and timezone. Violates the CLAUDE.md rule "No Hard-Coding Personalization".

**Fix:** Use `Intl.DateTimeFormat` with the user's locale from their profile (or `navigator.language` as fallback), or format as ISO 8601. Remove the Barcelona timezone reference from comments.

---

### 38. vercel.json CSP allows https://\*.vercel.app broadly

**Severity:** MODERATE
**Categories:** Security
**Files:** `vercel.json:L13`
**Reported by:** sec-perf-group6, maint-quality-group6

**Problem:** The CSP header includes `https://*.vercel.app` in `script-src`, allowing scripts from any Vercel-hosted app to execute. Also includes `https://api.openai.com` in `connect-src` despite all AI calls going through Convex. Both weaken the CSP unnecessarily.

**Fix:** Replace `https://*.vercel.app` with specific Clerk and application domains. Remove `https://api.openai.com` from `connect-src`. Check Clerk's CSP documentation for exact required origins.

---

### 39. usePanelTime allows arbitrary timestamps without validation

**Severity:** MODERATE
**Categories:** Security
**Files:** `src/hooks/usePanelTime.ts:L17-L35`
**Reported by:** sec-perf-group5

**Problem:** `getTimestampMs()` accepts user-entered date strings with no range validation. Far-future timestamps break time-sorted queries; epoch-0 timestamps confuse transit-time calculations.

**Fix:** Add client-side validation clamping to a sensible range (no earlier than 5 years ago, no later than tomorrow). Add server-side validation in relevant Convex mutations.

---

### 40. useWeeklySummaryAutoTrigger computes period bounds once at mount -- stale across boundaries

**Severity:** MODERATE
**Categories:** Performance
**Files:** `src/hooks/useWeeklySummaryAutoTrigger.ts:L110-L114`
**Reported by:** sec-perf-group5

**Problem:** `getCompletedPeriodBounds()` is called inside `useMemo(() => ..., [])` with empty deps -- computed once and never updated. If the app is left open across a half-week boundary, the hook will never trigger generation for the newly completed period.

**Fix:** Track the boundary using a state variable that updates via `setTimeout` or `visibilitychange` listener when a new boundary passes.

---

### 41. ProfileContext uses JSON.stringify on every render for reference stability

**Severity:** MODERATE
**Categories:** Performance
**Files:** `src/contexts/ProfileContext.tsx:L138-L149,L151-L188`
**Reported by:** sec-perf-group5, simplify-group5

**Problem:** `JSON.stringify(nextProfile)` is called on every render to detect changes. For a `ResolvedProfile` with arrays, this serializes several kilobytes per Convex re-delivery. Additionally, the `patchProfile` callback manually wraps every field in a conditional spread (`...(updates.field !== undefined && { field: updates.field })`) -- 10 nearly identical lines.

**Fix:** Replace `JSON.stringify` deep comparison with shallow field-by-field check. Replace the 10-field manual spread with `Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined))`.

---

### 42. FOOD_REGISTRY data (4,381 lines) bundled into the client unconditionally

**Severity:** MODERATE
**Categories:** Performance
**Files:** `shared/foodRegistryData.ts`
**Reported by:** sec-perf-group2

**Problem:** The food registry contains detailed clinical annotations (digestion metadata, fiber levels, osmotic effects) only used in the AI prompt pipeline and evidence computation, not the food search UI. This data inflates the client bundle unnecessarily.

**Fix:** Audit which fields are needed on the client. Create a `ClientFoodRegistryEntry` projection type that omits `digestion` metadata. Keep full registry on the server side.

---

### 43. buildUserMessage uses pretty-printed JSON in AI payloads -- wasted tokens

**Severity:** MODERATE
**Categories:** Performance
**Files:** `src/lib/aiAnalysis.ts:L1557`
**Reported by:** sec-perf-group6

**Problem:** `JSON.stringify(payload, null, 2)` pretty-prints with 2-space indentation. For a payload with food logs, bowel events, etc., the whitespace adds thousands of characters (hundreds of billable tokens). Could reduce token cost per call by 5-15%.

**Fix:** Use `JSON.stringify(payload)` (no indentation). The LLM handles compact JSON equally well.

---

### 44. sanitizeUnknownStringsDeep throws on oversized strings -- crashes AI calls

**Severity:** MODERATE
**Categories:** Security, Performance
**Files:** `src/lib/inputSafety.ts:L55-L81`, `src/lib/aiAnalysis.ts:L1736-L1877`
**Reported by:** sec-perf-group6

**Problem:** `sanitizeUnknownStringsDeep` throws an `Error` when a string exceeds `maxStringLength`. If any string field in the logs exceeds 50,000 characters (possible with long voice transcripts), the entire AI call throws at sanitization, not at the API call.

**Fix:** Instead of throwing, truncate at the limit with a suffix like `"...[truncated]"` and log a warning. Client-side sanitizer should clean and cap, not crash.

---

### 45. Stale model names in food-matching pipeline and UI copy

**Severity:** MODERATE
**Categories:** Maintainability, Code Quality
**Files:** `convex/foodLlmMatching.ts:L41`, `convex/foodParsing.ts:L56`, `src/lib/aiModels.ts:L11-L14`, `src/components/settings/app-data-form/ArtificialIntelligenceSection.tsx:L73`
**Reported by:** maint-quality-group1, maint-quality-group3, maint-quality-group6

**Problem:** `foodLlmMatching.ts` uses `DEFAULT_MODEL = "gpt-4.1-nano"`, `foodParsing.ts` uses `OPENAI_FALLBACK_MODEL = "gpt-4o-mini"` -- both are legacy. `LEGACY_AI_MODEL_MAP` in `logs.ts` maps these to current names but the constants were not updated. The user-facing AI model validator in `validators.ts` only allows `gpt-5-mini` and `gpt-5.4`, but the internal food-matching action accepts legacy names. UI copy hard-codes "GPT-5 Mini" without deriving from a constant.

**Fix:** Update all model constants to current names. Narrow the `args.model` validator in `foodLlmMatching.ts` to match `validators.ts`. Derive model names in UI copy from constants, not hardcoded strings.

---

### 46. WriteProcessedFoodItem type manually copies validator -- will drift

**Severity:** MODERATE
**Categories:** Maintainability
**Files:** `convex/foodParsing.ts:L104-L149`
**Reported by:** maint-quality-group1

**Problem:** Contains a `TODO: derive from validator using Infer<> to keep in sync`. The type manually re-enumerates all food group line literals, resolver strings, and match candidate shapes already defined in `validators.ts`.

**Fix:** Replace with `Infer<typeof foodItemValidator>` from `validators.ts`. Follow through on the existing TODO.

---

### 47. weeklySummaries.add mutation does not accept promptVersion despite schema having it

**Severity:** MODERATE
**Categories:** Maintainability
**Files:** `convex/weeklySummaries.ts:L5-L45`, `convex/schema.ts:L327`
**Reported by:** maint-quality-group1

**Problem:** Schema includes `promptVersion: v.optional(v.number())` but the `add` mutation args do not include it. The value can never be written via the public API. Schema and mutation are out of sync.

**Fix:** Either add `promptVersion` to `add` args, or add a comment to the schema explaining it is only populated via backup import.

---

### 48. testFixtures.ts manually types AI insight shape instead of using domain types

**Severity:** MODERATE
**Categories:** Code Quality
**Files:** `convex/testFixtures.ts:L19-L51`
**Reported by:** maint-quality-group1, simplify-group1

**Problem:** `TEST_AI_INSIGHT` uses a large inline object literal type that manually re-enumerates verdicts, confidences, causal roles. These are already defined in `domain.ts` and `validators.ts`. Test fixtures also use mutable `const` objects -- not frozen -- so mutations could bleed state between tests.

**Fix:** Type using `Infer<typeof aiInsightValidator>`. Use `Object.freeze()` on exported fixtures or use a factory function pattern: `export function makeTestAiInsight(overrides?: Partial<...>)`.

---

### 49. BristolTrendTile and BmFrequencyTile use inconsistent day-boundary strategies

**Severity:** MODERATE
**Categories:** Maintainability, Data Correctness
**Files:** `src/components/patterns/hero/BristolTrendTile.tsx:L84-L85`, `src/components/patterns/hero/BmFrequencyTile.tsx:L52-L54`
**Reported by:** maint-quality-group3, sec-perf-group3

**Problem:** `BmFrequencyTile` uses calendar midnight boundaries while `BristolTrendTile` uses raw millisecond arithmetic. A log at 11:59 PM may be included in one tile's window but excluded from the other. Both compute `Date.now()` outside memos with no stable clock, causing staleness if mounted for long periods. Also chain 3 separate `useMemo` calls where one is sufficient.

**Fix:** Standardise on calendar midnight approach. Extract a shared `getCutoffTimestamp(daysAgo: number)` utility. Accept a `nowMs` prop from a parent that controls the clock. Combine chained memos into a single memo.

---

### 50. MS_PER_DAY and sibling time constants duplicated across files

**Severity:** MODERATE
**Categories:** Code Quality
**Files:** `src/components/patterns/database/columns.tsx:L99-L101`, `src/components/patterns/hero/BristolTrendTile.tsx:L33`, `src/hooks/useFoodLlmMatching.ts:L47`, `src/hooks/useUnresolvedFoodToast.ts:L9`
**Reported by:** maint-quality-group3, maint-quality-group5

**Problem:** `MS_PER_DAY = 86_400_000` is defined locally in multiple files. The 6-hour processing window constant is defined as `SIX_HOURS_MS` in one file and `PROCESSING_WINDOW_MS` in another with different derivation. A typo in one copy produces a silent numeric bug.

**Fix:** Consolidate all time constants in `src/lib/timeConstants.ts`. Import from there everywhere.

---

### 51. useIsMobile hook locally defined instead of shared

**Severity:** MODERATE
**Categories:** Maintainability
**Files:** `src/components/settings/DeleteConfirmDrawer.tsx:L18-L31`
**Reported by:** maint-quality-group3, simplify-group3

**Problem:** `DeleteConfirmDrawer.tsx` defines a private `useIsMobile()` hook with a hard-coded 768px breakpoint. The codebase already has `ResponsiveShell` for the same pattern. Any other component needing mobile detection will duplicate it.

**Fix:** Either migrate `DeleteConfirmDrawer` to use `ResponsiveShell`, or move `useIsMobile` to `src/hooks/useMediaQuery.ts` with the breakpoint as a parameter.

---

### 52. DrPooReport.tsx placed in archive/ but imported by Track page

**Severity:** MODERATE
**Categories:** Maintainability
**Files:** `src/components/archive/DrPooReport.tsx`, `src/components/track/dr-poo/AiInsightsBody.tsx:L3`, `src/components/archive/ai-insights/index.ts:L1`
**Reported by:** maint-quality-group3

**Problem:** `AiInsightsBody.tsx` on Track imports `CopyReportButton` and `DrPooReportDetails` from `archive/DrPooReport.tsx`. The `archive/` directory name implies components only used on Archive. `MealIdeaCard` is also not re-exported from the barrel `ai-insights/index.ts`.

**Fix:** Move `DrPooReport.tsx`, `MealIdeaCard.tsx`, and `AnalysisProgressOverlay.tsx` to `src/components/dr-poo/` or `src/components/patterns/ai-insights/`. Add `MealIdeaCard` to the barrel file.

---

### 53. BowelSection accumulates 7+ separate useState calls -- fragile reset

**Severity:** MODERATE
**Categories:** Maintainability
**Files:** `src/components/track/panels/BowelSection.tsx:L171-L186`
**Reported by:** maint-quality-group4

**Problem:** The component manages form state across 7 independent `useState` hooks. The reset after save must manually reset all 7 fields. Adding a new field requires updating three places.

**Fix:** Introduce a `BowelFormDraft` state object with a single `useState<BowelFormDraft>` and a `resetDraft` helper, matching the pattern used by `useNutritionStore`.

---

### 54. ThemeProvider uses stale storage key "kaka-tracker-theme"

**Severity:** MODERATE
**Categories:** Maintainability
**Files:** `src/components/theme-provider.tsx:L37`
**Reported by:** maint-quality-group3, sec-perf-group3

**Problem:** The default `storageKey` is `"kaka-tracker-theme"` -- the old project name. If cleanup logic targets different keys, theme preference would persist after factory reset. No `try-catch` guard against `localStorage` being unavailable (restricted browser privacy mode, storage-blocked iframe).

**Fix:** Move storage key to `src/lib/storageKeys.ts`, rename to `"pdh-theme"`. Ensure `clearLocalData` includes this key. Wrap `localStorage.getItem` in try-catch with fallback to `defaultTheme`.

---

### 55. onDeleteLog in CalorieDetailView deletes the whole log, not just one item

**Severity:** MODERATE
**Categories:** Code Quality, Data Integrity
**Files:** `src/components/track/nutrition/CalorieDetailView.tsx:L276,L303`
**Reported by:** maint-quality-group4

**Problem:** Each food item row renders a delete button with `onClick={() => onDeleteLog(log.id)}`. For logs with multiple items (e.g., "egg, toast, and butter"), clicking "delete egg" deletes the entire log. The `aria-label` says `Delete ${displayName}` (individual item name), implying item-level deletion.

**Fix:** Add a defensive assertion that staged logs contain exactly one item. At minimum, add a code comment explaining the constraint. Surface an item-level delete mutation if multi-item logs are supported.

---

### 56. Broad `as unknown as FoodLog` cast in grouping.ts

**Severity:** MODERATE
**Categories:** Code Quality
**Files:** `src/components/track/today-log/grouping.ts:L56`
**Reported by:** maint-quality-group4

**Problem:** `foodEntries.push(log as unknown as FoodLog)` forces a liquid log into the FoodLog array. If the shapes ever diverge, the cast silently produces garbage.

**Fix:** Define a shared `FoodPipelineLog = FoodLog | LiquidLog` union. Use `isFoodPipelineType` to narrow safely rather than casting.

---

### 57. responsive-shell.tsx has divergent body wrapper div classes (shrink-0 vs flex-1)

**Severity:** MODERATE
**Categories:** Code Quality
**Files:** `src/components/ui/responsive-shell.tsx:L86-L88,L106-L108`
**Reported by:** maint-quality-group5

**Problem:** Mobile path uses `shrink-0` (prevents shrinking but doesn't grow) while tablet/desktop uses `flex-1`. On mobile, drawer content may not scroll correctly with tall content. Also contains `typeof window === "undefined"` SSR guards that are dead code in this Vite SPA.

**Fix:** Audit intended mobile drawer layout. If body should fill remaining space, change `shrink-0` to `flex-1`. Remove SSR guards.

---

### 58. PopoverTitle typed as ComponentProps<"h2"> but rendered as <div>

**Severity:** MODERATE
**Categories:** Code Quality, Accessibility
**Files:** `src/components/ui/popover.tsx:L125-L127`
**Reported by:** maint-quality-group5, simplify-group5

**Problem:** Accepts `ComponentProps<"h2">` but renders a `<div>`. Passing `h2`-specific attributes will be silently ignored. Produces incorrect semantic HTML.

**Fix:** Either change to `<h2>` (preferred for accessibility) or change type to `ComponentProps<"div">`.

---

### 59. "use client" directives on files in a Vite SPA -- dead code

**Severity:** MODERATE
**Categories:** Maintainability
**Files:** `src/components/ui/date-picker.tsx:L1`, `src/components/ui/drawer.tsx:L1`, `src/components/ui/switch.tsx:L1`, `src/components/ui/tabs.tsx:L1`, `src/components/ui/toggle-group.tsx:L1`, `src/components/ui/toggle.tsx:L1`
**Reported by:** sec-perf-group5, maint-quality-group5

**Problem:** `"use client"` is a Next.js App Router directive with no effect in a Vite SPA. Six UI files have it while others don't. Creates false impression that RSC patterns are in play.

**Fix:** Remove `"use client"` from all six files.

---

### 60. SyncedLogsContext does not surface loading state

**Severity:** MODERATE
**Categories:** Maintainability
**Files:** `src/contexts/SyncedLogsContext.tsx:L7,L59`
**Reported by:** maint-quality-group5

**Problem:** The context value coerces `undefined` (loading) to `[]` (empty). Consumers cannot distinguish "data is loading" from "no logs exist". AI analysis could run prematurely against an empty dataset while data is still loading.

**Fix:** Expose an `isLoading` field alongside `logs`, or change context value to `SyncedLog[] | undefined` where `undefined` means loading.

---

### 61. sounds.ts has a race condition when resuming suspended AudioContext

**Severity:** MODERATE
**Categories:** Code Quality
**Files:** `src/lib/sounds.ts:L67-L73`
**Reported by:** maint-quality-group6

**Problem:** `AudioContext.resume()` is async but the code does not await it, then synchronously checks `ctx.state` which will still show "suspended". The sound is silently dropped.

**Fix:** Extract note scheduling into a `scheduleNotes(ctx, variant)` helper. Chain it from the resolved promise: `ctx.resume().then(() => scheduleNotes(ctx, variant)).catch(...)`.

---

### 62. routeTree.tsx contains the full application shell, error boundaries, and navigation -- 434 lines

**Severity:** MODERATE
**Categories:** Maintainability
**Files:** `src/routeTree.tsx:L62-L327`
**Reported by:** maint-quality-group6

**Problem:** Contains `RouteErrorBoundary`, `AuthLoadingFallback`, `GlobalHeader` (with full navigation rendering), `AppLayout`, and all route definitions. Conflates route configuration with UI components.

**Fix:** Extract `RouteErrorBoundary`, `AuthLoadingFallback`, and `GlobalHeader` into `src/components/layout/`. Keep `routeTree.tsx` focused on route definitions.

---

### 63. store.ts exports configuration constants that are not store state

**Severity:** MODERATE
**Categories:** Maintainability
**Files:** `src/store.ts:L27-L74`
**Reported by:** maint-quality-group6, simplify-group6

**Problem:** Exports `DEFAULT_FLUID_PRESETS`, `MAX_FLUID_PRESETS`, `BLOCKED_FLUID_PRESET_NAMES`, and `DEFAULT_HEALTH_PROFILE` alongside Zustand state. The `createLogTypeGuard` factory also adds indirection without benefit.

**Fix:** Move fluid preset constants to `src/lib/fluidPresets.ts`. Move `DEFAULT_HEALTH_PROFILE` to `domain.ts` or a dedicated defaults file. Replace the `createLogTypeGuard` factory with direct function declarations.

---

### 64. customFoodPresets.ts duplicates normalization logic between load and save

**Severity:** MODERATE
**Categories:** Maintainability
**Files:** `src/lib/customFoodPresets.ts:L22-L82`
**Reported by:** maint-quality-group6, simplify-group6, sec-perf-group6

**Problem:** Both `loadCustomFoodPresets` and `saveCustomFoodPresets` contain identical normalization (`.trim().slice(0, 80)` for names, `.slice(0, 20)` for ingredients, `.slice(0, 12)` for the list). Magic numbers 80, 20, 12 have no named constants. ID generation uses `Math.random()` with only 10,001 possible values -- collision risk on rapid creation.

**Fix:** Extract a `normalizePreset` helper and named constants (`MAX_PRESET_NAME_LENGTH = 80`, etc.). Use `crypto.randomUUID()` for ID generation.

---

### 65. Backup JSON export uses pretty-printed JSON with no size guard

**Severity:** MODERATE
**Categories:** Performance
**Files:** `src/components/settings/app-data-form/useAppDataFormController.ts:L86-L89`
**Reported by:** sec-perf-group3

**Problem:** Full backup payload serialised with `JSON.stringify(backup, null, 2)`. For large datasets on mobile devices with limited RAM, serializing with pretty-print causes unnecessary bloat and potential jank.

**Fix:** Use `JSON.stringify(backup)` (no indentation). Estimate log count and warn user before proceeding if large.

---

### 66. Patterns.tsx writes to localStorage on every state change without debounce

**Severity:** MODERATE
**Categories:** Performance
**Files:** `src/pages/Patterns.tsx:L43-L52,L76-L116,L156-L189`
**Reported by:** sec-perf-group6

**Problem:** Three `useEffect` hooks write to `localStorage` on every state change to filters, sorting, and views. `localStorage.setItem` is synchronous blocking I/O. Also uses `as` type assertions on `JSON.parse` output from untrusted data.

**Fix:** Debounce the `localStorage` write effects (300-500ms). Replace `as` cast with proper runtime validation or Zod schema.

---

### 67. foodRegistry barrel creates three-level module indirection

**Severity:** MODERATE
**Categories:** Maintainability
**Files:** `shared/foodCanonicalization.ts:L15-L42`, `shared/foodRegistry.ts:L1-L52`, `shared/foodProjection.ts:L6`
**Reported by:** maint-quality-group2, simplify-group2

**Problem:** Module graph for registry lookups: `foodRegistryData.ts` -> `foodRegistryUtils.ts` -> `foodRegistry.ts` (barrel) -> `foodCanonicalization.ts` (re-exports) -> callers. Four hops via two barrel files. `resolveCanonicalFoodName` is re-exported from `foodProjection.ts` creating a third import path. `PortionData` is re-exported from three locations.

**Fix:** Remove re-exports from `foodCanonicalization.ts` (keep only `canonicalizeKnownFoodName`). Remove `resolveCanonicalFoodName` re-export from `foodProjection.ts`. Consumers import directly from the owning module.

---

### 68. ParsedFoodItem type name collision between two files

**Severity:** MODERATE
**Categories:** Maintainability
**Files:** `shared/logDataParsers.ts:L22-L27`, `shared/foodParsing.ts:L38-L52`
**Reported by:** maint-quality-group2

**Problem:** Both files export a type called `ParsedFoodItem` with structurally different shapes. Any file importing from both must alias. Silent name collision with no TypeScript error.

**Fix:** Rename `logDataParsers.ts`'s type to `ParsedLogFoodItem` or `RawFoodItemData`.

---

### 69. Inconsistent severity taxonomy across review-findings files

**Severity:** MODERATE
**Categories:** Maintainability
**Files:** All `scripts/ship/review-findings-*.json` files
**Reported by:** maint-quality-group2

**Problem:** The 30 review-findings files use four different severity taxonomies. Findings cannot be aggregated across files. Every finding has `"implemented": false` with no workflow for marking them true. Transit map findings reference deleted files but remain as open issues.

**Fix:** Standardise all files to `CRITICAL / HIGH / MODERATE / NICE-TO-HAVE`. Add a JSON Schema. Map LOW -> NICE-TO-HAVE. Move closed findings to archive. Delete transit-map findings for deleted code.

---

### 70. Bristol code validation gap -- non-integer and out-of-range values accepted

**Severity:** MODERATE
**Categories:** Security, Data Integrity
**Files:** `shared/foodEvidence.ts:L416-L418,L446-L449`, `shared/logDataParsers.ts:L58-L62`
**Reported by:** sec-perf-group2

**Problem:** `safeNumber` coerces `"7.9"` to 7.9 (a non-integer). `normalizeDigestiveCategory` accepts any `bristol >= 7` as diarrhea, meaning bristol 8, 99, or -5 would be categorized. No integer-only guard anywhere in the pipeline.

**Fix:** In `buildDigestiveEvents`, add a guard: `if (bristolCode !== undefined && (!Number.isInteger(bristolCode) || bristolCode < 1 || bristolCode > 7)) continue;`. Also add integer check in `safeNumber` callers for `bristolCode`.

---

### 71. Confetti.tsx onComplete in useEffect deps causes re-trigger risk

**Severity:** MODERATE
**Categories:** Performance
**Files:** `src/components/ui/Confetti.tsx:L94`
**Reported by:** sec-perf-group4

**Problem:** If parent passes unstable (non-memoized) `onComplete`, the effect re-fires every render, potentially restarting confetti animation mid-flight.

**Fix:** Use a `useRef` to hold the callback so it is not a dependency.

---

## NICE-TO-HAVE Findings

### 72. Legacy base64-only API key decryption has no integrity check

**Severity:** NICE-TO-HAVE
**Categories:** Security
**Files:** `convex/lib/apiKeys.ts:L94-L96`
**Reported by:** sec-perf-group1

**Problem:** `decryptLegacyApiKey` simply calls `atob(value)` with no validation that the decoded bytes represent a valid API key.

**Fix:** After decoding, validate with `OPENAI_API_KEY_PATTERN` and throw a specific error if it fails.

---

### 73. index.html has no Content Security Policy meta tag fallback

**Severity:** NICE-TO-HAVE
**Categories:** Security
**Files:** `index.html:L1-L29`
**Reported by:** sec-perf-group2

**Problem:** No `<meta http-equiv="Content-Security-Policy">` tag as defense-in-depth. If served from a context without server-side headers, no CSP protection at all.

**Fix:** Add a baseline meta CSP: `default-src 'self'` and `object-src 'none'`.

---

### 74. Misleading API key privacy copy in ArtificialIntelligenceSection

**Severity:** NICE-TO-HAVE
**Categories:** Security
**Files:** `src/components/settings/app-data-form/ArtificialIntelligenceSection.tsx:L49-L52`
**Reported by:** sec-perf-group3

**Problem:** Copy says "stored securely on our servers" but the key may actually be stored in IndexedDB on the client. `CloudProfileSection` says "AES-256-GCM encryption". The two descriptions contradict each other.

**Fix:** Audit whether the key is stored locally or server-side and update copy to match reality.

---

### 75. sanitizeNameForPrompt does not strip XML-like delimiters

**Severity:** NICE-TO-HAVE
**Categories:** Security
**Files:** `src/lib/aiAnalysis.ts:L51-L59`
**Reported by:** sec-perf-group6

**Problem:** A name like `Pete</patient_name>INJECTED<patient_name>` would close the intended XML tag early and inject unescaped string into the prompt.

**Fix:** Additionally strip `<` and `>` characters from the name.

---

### 76. Archive.tsx keyboard event listener has no focus guard

**Severity:** NICE-TO-HAVE
**Categories:** Security
**Files:** `src/pages/secondary_pages/Archive.tsx:L90-L98`
**Reported by:** sec-perf-group6

**Problem:** ArrowLeft/ArrowRight listener fires globally, including when user is typing in an input.

**Fix:** Add guard to ignore events when focus is on INPUT/TEXTAREA/SELECT elements.

---

### 77. useBaselineAverages timer leak -- cleanup not always returned

**Severity:** NICE-TO-HAVE
**Categories:** Code Quality
**Files:** `src/hooks/useBaselineAverages.ts:L121-L147`
**Reported by:** maint-quality-group5

**Problem:** The early return path `if (!needsRecompute) return;` returns `undefined` (no cleanup). If a timer was previously scheduled, it fires after unmount.

**Fix:** Always return a cleanup function: `if (!needsRecompute) return () => {};`

---

### 78. CloudProfileSection TODO for missing Privacy Policy link -- GDPR compliance gap

**Severity:** NICE-TO-HAVE
**Categories:** Maintainability
**Files:** `src/components/settings/app-data-form/CloudProfileSection.tsx:L30-L33`
**Reported by:** maint-quality-group3

**Problem:** TODO comment states Privacy Policy link must be reinstated before launch for GDPR. No tracked work item.

**Fix:** File a tracked work item and add the issue ID to the comment.

---

### 79. DatePicker is an uncontrolled demo component -- not usable in production forms

**Severity:** NICE-TO-HAVE
**Categories:** Maintainability
**Files:** `src/components/ui/date-picker.tsx`
**Reported by:** maint-quality-group5, simplify-group5

**Problem:** Fully self-contained with no `value`, `onChange`, or `disabled` props. This is the shadcn demo boilerplate, not a usable component.

**Fix:** Either delete or convert to a controlled component with `value` and `onSelect` props.

---

### 80. ingredientProfileProjection.ts is a one-function pass-through

**Severity:** NICE-TO-HAVE
**Categories:** Maintainability
**Files:** `convex/ingredientProfileProjection.ts`
**Reported by:** maint-quality-group1, simplify-group1

**Problem:** `getIngredientProfileProjection` is a single-line forwarding wrapper to `getCanonicalFoodProjection`. The normalization functions could live in `shared/`.

**Fix:** Delete the file. Move normalization functions into `ingredientProfiles.ts`. Replace calls to `getIngredientProfileProjection` with direct calls to `getCanonicalFoodProjection`.

---

### 81. verdictToStoredVerdict is an identity switch that adds no value

**Severity:** NICE-TO-HAVE
**Categories:** Code Quality
**Files:** `convex/extractInsightData.ts:L41-L58`
**Reported by:** simplify-group1

**Problem:** Maps every case to an identical string (safe->safe, watch->watch, etc.). This is 17 lines of no-op switch logic.

**Fix:** Check if the types are assignable. If so, remove the function and use `assessment.verdict` directly.

---

### 82. Duplicated test factory functions across foodEvidence test files

**Severity:** NICE-TO-HAVE
**Categories:** Code Quality
**Files:** `shared/__tests__/foodEvidence.test.ts:L14-L47`, `shared/__tests__/foodEvidence.thresholds.test.ts:L16-L71`, `shared/__tests__/foodEvidence.trigger.test.ts:L16-L49`
**Reported by:** simplify-group2, maint-quality-group2

**Problem:** `foodLog`, `digestionLog`, and `buildDailyTrialSeries` factory functions are copy-pasted across three test files with near-identical implementations. When the `FoodEvidenceLog` shape changes, all three must be updated.

**Fix:** Extract into `shared/__tests__/foodEvidenceTestHelpers.ts`.

---

### 83. Confetti, CircularProgressRing -- minor effect splitting and ternary patterns

**Severity:** NICE-TO-HAVE
**Categories:** Code Quality
**Files:** `src/components/track/nutrition/CircularProgressRing.tsx:L119-L125`, various files with nested ternaries
**Reported by:** simplify-group4, simplify-group5, simplify-group3, simplify-group6

**Problem:** Multiple files use nested ternary chains where CLAUDE.md explicitly says to avoid them. Examples: `WeightSubRow.tsx`, `WeightGroupRow.tsx`, `EditableEntryRow.tsx`, `TodayLog.tsx`, `LifestyleSection.tsx`, `AnalysisProgressOverlay.tsx`, `habitProgress.ts`, `responsive-shell.tsx`, `toggle-group.tsx`. CircularProgressRing has two `useEffect` calls that could be one.

**Fix:** Replace nested ternaries with switch/if-else/lookup objects per CLAUDE.md standard. Merge split effects where dependencies overlap.

---

### 84. CalendarDayButton calls getDefaultClassNames() on every render (per cell)

**Severity:** NICE-TO-HAVE
**Categories:** Performance
**Files:** `src/components/ui/calendar.tsx:L145`
**Reported by:** sec-perf-group5, simplify-group5

**Problem:** Called once per day cell (28-42 times per calendar render). Returns static data that never changes.

**Fix:** Hoist to module scope: `const DEFAULT_CLASS_NAMES = getDefaultClassNames();`

---

### 85. Duplicated section-header and alertdialog patterns in Settings

**Severity:** NICE-TO-HAVE
**Categories:** Code Quality
**Files:** `src/components/settings/CollapsibleSectionHeader.tsx:L11-L39`, `src/components/settings/TrackingForm.tsx:L170-L201`, `src/components/settings/app-data-form/DataManagementSection.tsx:L31-L43`, `src/components/settings/AppDataForm.tsx:L138-L200`
**Reported by:** simplify-group3

**Problem:** Three components implement the same collapsible section header pattern with different hard-coded color tokens. Two inline `alertdialog` blocks in `AppDataForm` are nearly identical.

**Fix:** Extend `CollapsibleSectionHeader` to accept a `color` prop and optional icon/subtitle. Extract an `InlineConfirmation` component for the alert dialogs.
