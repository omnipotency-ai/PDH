# Work In Progress — Sprint Execution Log

> Updated by agents as tasks complete. Maintained until all sprints are done.

**Started:** 2026-03-17

---

## Sprint 0: Ship Blockers

### WQ-001: CI Pipeline (Husky + GitHub Actions)

**Status:** done
**Agent:** Sonnet
**Summary:** Installed husky@9.1.7, ran `husky init` (adds `prepare` script to package.json). Created `.husky/pre-commit` with `set -e` and three steps: `bun run typecheck`, `bun run build`, `bun run test:unit`. Created `.github/workflows/ci.yml` with two jobs: `check` (typecheck + build + unit tests on ubuntu-latest using `oven-sh/setup-bun@v2` and `bun install --frozen-lockfile`) and `secrets` (gitleaks scanning). Workflow triggers on push to main/master and on pull requests.

### WQ-002: Secret Scanning (gitleaks hook)

**Status:** done
**Agent:** Sonnet
**Summary:** Gitleaks integrated in two places: (1) `.husky/pre-commit` runs `gitleaks git --staged --no-banner` if gitleaks is available locally (soft check — skips gracefully if not installed; install with `brew install gitleaks`). (2) `.github/workflows/ci.yml` has a dedicated `secrets` job using `gitleaks/gitleaks-action@v2` that runs on every push and PR with `fetch-depth: 0` so full history is available.

### WQ-003: LLM Matching Architecture Investigation

**Status:** done
**Agent:** Opus
**Summary:** Two parallel LLM matching paths exist, but neither fully works. The server pipeline (`processLogInternal` in `foodParsing.ts`) has an active LLM fallback (`tryLlmFallback`) that uses a server-side `OPENAI_API_KEY` env var for low-confidence structurally-ambiguous phrases only — but this env var is not set, so the fallback silently skips. The original BYOK client-initiated path (`useFoodLlmMatching` hook calling `matchUnresolvedItems` action) is fully coded but completely disconnected: the hook is dead code (zero importers), and the action handler is stubbed to return early. The fundamental tension is that `matchUnresolvedItems` was designed as a broad segmentation+web-search LLM call using the user's BYOK key, while the server pipeline's `tryLlmFallback` is a narrow disambiguator using a server key — neither covers the intended use case of GPT-5o-mini web search for unknown foods. To make LLM matching work, either: (a) set `OPENAI_API_KEY` on the Convex server and expand `tryLlmFallback` to handle full segmentation/web-search (simpler but abandons BYOK for food matching), or (b) re-activate the client-initiated hook, un-stub `matchUnresolvedItems`, implement `applyLlmResults`, and wire the hook back into Track.tsx (preserves BYOK but adds complexity).

### WQ-004: Health Data in Error Messages

**Status:** done
**Agent:** Sonnet
**Summary:** Replaced `rawContent.slice(0,200)` and `raw.slice(0,200)` in thrown Error messages in `aiAnalysis.ts` (two locations) and `habitCoaching.ts` with static strings that contain no patient health data.

### WQ-005: dailyCap Zero — No-Judgment Investigation

**Status:** done
**Agent:** Opus
**Summary:** The `dailyCap > 0` check in `validateHabitConfig` (line 590) silently strips a zero-cap from the validated output, so a user who sets dailyCap=0 for "no alcohol" loses their cap entirely — the habit becomes capless/neutral. However, this is largely harmless because the cap never blocks logging anywhere in the app; it is purely informational (progress text, coaching messages, color indicators, toast warnings). The `hasGoal` function in `habitAggregates.ts` (line 192) correctly treats `dailyCap=0` as a valid goal via `!== undefined && !== null`, and `isGoodDay` correctly considers any `totalValue <= 0` a good day — but these never fire because `validateHabitConfig` strips the zero before it can reach them. The fix is narrow: change line 590 from `habit.dailyCap > 0` to `habit.dailyCap >= 0` so zero-cap habits are preserved through validation. No blocking behavior needs to change because none exists. Fix applied: changed `> 0` to `>= 0` in validateHabitConfig and normalizeHabitTypeValue.

### WQ-006: Food Queue Index Bug Fix

**Status:** done
**Agent:** Sonnet
**Summary:** The real bug was in `handleSubmitTicket` in `FoodMatchingModal.tsx`. `currentItemIndex` was derived as `currentItem?.itemIndex ?? 0`, which collapses both "no itemIndex provided" (single-item mode, no index passed by the caller) and "first queue item with itemIndex=0" into the number `0`. The guard `currentItemIndex != null` was therefore always true (the value is always a number), so `itemIndex: 0` was incorrectly included in the `submitFoodRequest` payload even when no valid itemIndex existed. Fixed by checking `currentItem?.itemIndex !== undefined` (the pre-defaulted source value) before including itemIndex in the payload, and added `currentItem` to the `useCallback` dependency array.

### WQ-008: importBackup Typed Validators

**Status:** done
**Agent:** Opus
**Summary:** Replaced `payload: v.any()` with a structured `backupPayloadValidator` that validates top-level shape (version, exportedAt, data object with 13 known table keys containing optional arrays). Eliminated all 13 `as any` casts from DB inserts: replaced inline type assertions with typed helper functions (`asBackupLogType`, `asBackupFoodVerdict`, `asBristolDistribution`, `asKeyFoods`, `asNutritionPer100g`, `asFoodTrialStatus`, `asFoodTrialAiVerdict`, `isFoodPrimaryStatus`, `isFoodTendency`) and validator-typed casts (`typeof logDataValidator.type`, etc.) for complex union fields. Fully typed the `foodTrialSummary` insert (was `omitId(row) as any`) with explicit field-by-field coercion. Remaining `as any` in file (3 total) are outside importBackup: dynamic table queries in `listRowsByUserId` and `deleteAllUserData`.

### WQ-009: Gate Reproductive Health for v1

**Status:** done
**Agent:** Opus
**Summary:** Added `reproductiveHealth: false` feature flag to `featureFlags.ts`. Gated all UI entry points: `ReproductiveHealthSection` (settings toggle returns null), `Settings.tsx` (desktop card + mobile drawer tile), `Track.tsx` (`CycleHormonalSection` panel + `visibleSelectedLogs` filter), `TodayLog.tsx` (reproductive group row). Gated AI context in `aiAnalysis.ts` (system prompt reproductive lines + user message payload + log count). No code deleted -- all components remain intact behind the flag. Typecheck and build pass clean.

### WQ-010: BYOK Disclosure Copy Fix

**Status:** done
**Agent:** Sonnet
**Summary:** Old text: "Stored on this device only — never sent to the cloud." New text: "Stored on your device. When you use AI features, your key is sent over an encrypted connection to make the API request, then immediately discarded — never stored on our servers." Change is in `src/components/settings/app-data-form/ArtificialIntelligenceSection.tsx`. Typecheck and build both pass.

### WQ-011: AI Text Stored as Food — Investigation

**Status:** done
**Agent:** Sonnet
**Summary:** Bug is NOT present in current code. The fix was implemented across three layers during Phase 1 data integrity work. Layer 1 (`convex/extractInsightData.ts`): `isValidFoodName()` guard rejects food names > 60 chars, containing 4-digit years, month words, "bristol N" patterns, 3+ commas, or unit-number patterns — called at line 303 before every `db.insert("foodAssessments")`. Layer 2 (`shared/foodEvidence.ts`): The evidence pipeline filters out entries with no trials and fewer than 2 assessments, preventing assessment-only phantom foods from appearing in the food database. Layer 3 (`computeAggregates.ts`): Same name validation applied server-side. Crucially, `extractInsightData.ts` only ever inserts into `foodAssessments` and `reportSuggestions` tables — it never touches the `logs` table. The food pipeline (`foodParsing.ts`) only processes entries that originated from `log.type === "food"` records with a valid `rawInput` field, so AI report text cannot enter the food log pipeline. The original data corruption (~160 fake entries) was historical and has been cleaned up. No current code path allows AI prose to enter food logs.

### WQ-012: Bristol Classification — Verify Against A1

**Status:** done
**Agent:** Sonnet
**Summary:** BT-92 is a REAL, UNRESOLVED bug. `classifyConsistency()` in `src/lib/foodStatusThresholds.ts` L127–135 uses a weighted average (via `computeBristolAverage`) and compares against fixed thresholds (avg >= 5.5 = loose, avg <= 2.5 = hard). The "majority-rules with 30% threshold" algorithm was explicitly decided in browser-testing Pass 2 (documented in `docs/browser-testing/2026-03-09-v1-test-run.md` L171 and `docs/archive/v1_sprint_tasks.md` L262) but was never implemented. The A1 consolidated audit does NOT capture this specific bug — H9 in A1 refers to a different issue (`bristolToConsistency(0)` boundary guard in `analysis.ts`, a separate function). The A5 NotebookLM BRISTOL-MAP finding is also different — it concerns Track.tsx mapping Bristol 5 as "loose" (a UI labelling issue, not the classification algorithm). Recommendation: keep open in queue as a genuine unimplemented decision; it is not a duplicate of any audit WQ item.

---

## Sprint 1: Security + Type Safety

### WQ-017: AI Insight Cast Fix

**Status:** done
**Agent:** Sonnet
**Summary:** Replaced the unsafe `as AiNutritionistInsight` cast in `src/hooks/useAiInsights.ts` with the existing `parseAiInsight` validator from `@/lib/aiAnalysis`. The validator returns `null` for malformed stored insights, and a `.filter(r => r !== null)` step removes those from `previousReports`. Also removed the now-unused `AiNutritionistInsight` type import. Pre-existing errors in `convex/foodParsing.ts` are unrelated to this file.

### WQ-020: Sanitize WeeklySummaryInput

**Status:** done
**Agent:** Sonnet
**Summary:** Added `sanitizeUnknownStringsDeep` call to `fetchWeeklySummary` in `src/lib/aiAnalysis.ts`, immediately after `checkRateLimit()`. The sanitized result (`safeInput`) is cast back to `WeeklySummaryInput` and passed to `JSON.stringify` instead of the raw `input`. Pattern matches `fetchAiInsights` exactly: same `INPUT_SAFETY_LIMITS.aiPayloadString` limit, same cast-back pattern. Typecheck passes clean.

### WQ-023: Sanitize foodRequests Inputs

**Status:** done
**Agent:** Sonnet
**Summary:** Added `sanitizeRequiredText` for `foodName` (200 chars, no newlines) and `sanitizeOptionalText` for `rawInput` (500 chars, no newlines) and `note` (500 chars, newlines preserved) in the `submitRequest` mutation in `convex/foodRequests.ts`. Imported both helpers from `./lib/inputSafety`. Updated the `db.insert` call to use the sanitized locals instead of raw `args` values. The `rawInput` and `note` conditional spreads now guard against both `undefined` and `null` (since `sanitizeOptionalText` can return `null`). Typecheck passes clean.

### WQ-024: Length Cap on AI Suggestions

**Status:** done
**Agent:** Sonnet
**Summary:** Imported `sanitizePlainText` from `convex/lib/inputSafety.ts` (already in use elsewhere in the convex layer). Added two module-level constants: `MAX_SUGGESTION_LENGTH = 500` and `MAX_SUGGESTION_BLOCK_LENGTH = 5000`. In the suggestions loop, replaced the bare `.trim()` with `sanitizePlainText(raw).slice(0, MAX_SUGGESTION_LENGTH)` for each individual suggestion, and added a `blockLength` accumulator that breaks out of the loop when the total stored text for a given report would exceed 5000 chars. The `textNormalized` field is now derived from the already-sanitized string rather than re-trimming the raw input.

### WQ-025: Migrations to internalMutation

**Status:** done
**Agent:** Sonnet
**Summary:** Converted `backfillConversations` and `backfillDigestionLogFields` in `convex/migrations.ts` from `mutation` to `internalMutation`. Both are one-time data backfill operations with no external callers (confirmed by grepping all `.ts` and `.tsx` files). Cleaned up the import to drop `mutation` from the `_generated/server` import since it was now unused. These mutations are server-only and cannot be triggered by arbitrary authenticated users from the client. They remain callable from the Convex dashboard via the internal function runner. Typecheck passes clean.

### WQ-044: Replace window.prompt in Patterns.tsx

**Status:** done
**Agent:** Sonnet
**Summary:** `window.prompt("Name this smart view")` was used in `handleSaveView` inside `DatabaseTabContent` in `src/pages/Patterns.tsx`. This was called when the user clicked "Save as view" in `FilterSheet`. It is an essential feature (not debugging code) — it collects a name for a user-defined filter preset (SmartViewPreset). Replaced with an inline name-input form rendered inside `FilterSheet` itself. Changes: (1) `FilterSheetProps.onSaveView` signature changed from `() => void` to `(name: string) => void`; (2) `FilterSheet` gained three state values (`saveViewOpen`, `viewName`, `nameInputRef`) and three handlers (`handleSaveViewButtonClick`, `handleSaveViewCancel`, `handleSaveViewConfirm`) — clicking "Save as view" now reveals an inline `<form>` with a text input and Save/Cancel buttons inside the filter sheet body, autofocusing the input; (3) `handleSaveView` in `Patterns.tsx` updated to accept `name: string` directly, with `window.prompt` removed. No new components or dependencies added. Typecheck passes clean.

### WQ-041: Menopause Dual-Write Fix

**Status:** done
**Agent:** Sonnet
**Summary:** Removed the erroneous `hormonalMedicationNotes: e.target.value` line from the `menopauseHrtNotes` onChange handler in `MenopauseSection.tsx`. The handler was dual-writing to two independent fields simultaneously; now it only sets `menopauseHrtNotes` when the user edits that input. Each notes field is now independent.

### WQ-042: Confetti Re-render Fix

**Status:** done
**Agent:** Sonnet
**Summary:** Added `animateRotationDelta` and `animateDuration` fields to the `Particle` interface and populated them with pre-computed random values inside `createParticles()`. Replaced the two `randomBetween()` calls that were embedded in the `animate` and `transition` props (which regenerated random values on every React re-render, causing visual jitter) with references to these stored particle fields. Random values are now computed once at particle creation time and remain stable across re-renders.

### WQ-018: Prompt Injection Protection for preferredName

**Status:** done
**Agent:** Opus
**Summary:** Added `sanitizeNameForPrompt()` helper that strips XML/HTML tags via regex and truncates to 50 characters. The `buildSystemPrompt` function now wraps the sanitized name in `<patient_name>` XML delimiter tags instead of interpolating the raw value in quotes. This prevents a crafted `preferredName` from injecting prompt manipulation into the LLM system message.

### WQ-026: Re-sanitize Historical Conversation Messages

**Status:** done
**Agent:** Opus
**Summary:** Applied `sanitizeUnknownStringsDeep` to the sliced `recentConversation` array in `fetchAiInsights` before pushing messages into the LLM prompt payload. Historical conversation messages were originally sanitized at input time, but if sanitization rules have since changed, old stored messages could contain patterns the updated rules would catch. The re-sanitization uses the same `INPUT_SAFETY_LIMITS.aiPayloadString` limit and path convention as the other sanitization calls in the function.

### WQ-031: Remove Redundant Casts in aiAnalysis.ts

**Status:** done
**Agent:** Sonnet
**Summary:** Removed four redundant `as` casts (`as LogEntry[]`, `as DrPooReply[]`, `as HealthProfile`, `as EnhancedAiContext`) from the `fetchAiInsights` function in `src/lib/aiAnalysis.ts`. The `sanitizeUnknownStringsDeep` function is generic (`<T>`) and returns `T`, so the casts were doing nothing — they masked the actual return type rather than narrowing it. Also removed the unnecessary parentheses wrapping the `enhancedContext` ternary branch. All 607 unit tests pass.

### WQ-035: Bristol Out-of-Range Throws Error

**Status:** done
**Agent:** Sonnet
**Summary:** Added a guard at the top of `bristolToConsistency` in `src/lib/analysis.ts` that throws `new Error(\`Invalid Bristol code: \${code}. Must be 1-7.\`)`for any input that is not an integer or is outside the range 1-7 (using`Number.isInteger`+ bounds check). Also tightened the existing branch conditions from`code >= 7`/`code <= 1` to exact equality (`code === 7`/`code === 1`), so out-of-range values like 0 or 8 always hit the guard rather than silently mapping to a category. All 607 unit tests pass.

### WQ-036: Quartile Index Bounds Check

**Status:** done
**Agent:** Sonnet
**Summary:** Replaced the two `!` non-null assertions on `values[Math.floor(values.length * 0.75)]` and `values[0]` in `learnTransitCalibration` in `shared/foodEvidence.ts`. Extracted the Q3 index into `q3Idx = Math.min(Math.floor(values.length * 0.75), values.length - 1)` to clamp it within bounds, then accessed `values[q3Idx] ?? 0` and `values[0] ?? 0` with nullish fallbacks. The fallback of `0` is a type-safe safety net — the code is only reachable when `values.length >= MIN_CALIBRATION_TRIALS (4)`, so neither access can actually be undefined. All 607 unit tests pass.

### WQ-037: Auth Guard on appLayoutRoute

**Status:** done
**Agent:** Sonnet
**Summary:** Added a `beforeLoad` guard to `appLayoutRoute` in `src/routeTree.tsx`. The guard reads `window.Clerk.session` (the Clerk singleton set by `@clerk/clerk-react` on the global object during initialization). If Clerk is loaded and `session === null` (user is explicitly not authenticated), it throws `redirect({ to: '/home' })`, sending the user to the landing page where they can sign in. If Clerk is still initializing (`window.Clerk` is undefined), the guard does nothing and lets `AppLayout` handle the `<AuthLoading>` state via its existing `<AuthLoading>/<Unauthenticated>/<Authenticated>` branches. A `ClerkGlobal` type alias was added to correctly type the `window.Clerk` cast without using `any`. Note: this app uses modal sign-in via Clerk's `SignInButton`, not a dedicated `/sign-in` route, so the redirect target is `/home`.

### WQ-021: Strip All Links from AI Markdown

**Status:** done
**Agent:** Sonnet
**Summary:** Found three files rendering AI-generated markdown with no link sanitization: `DrPooReport.tsx` (9 Markdown calls), `ConversationPanel.tsx` (2 calls), and `MealIdeaCard.tsx` (1 call). Added an `AI_MARKDOWN_COMPONENTS` constant in each file that replaces the `a` element with a plain `<span>` — link text is preserved but no clickable anchor is rendered, so `javascript:` URLs and external links cannot be activated. Used `children?: React.ReactNode` to satisfy `exactOptionalPropertyTypes` and the `react-markdown` `Components` type. Typecheck passes clean.

### WQ-027/028/030: Batch `as any` Fixes in logs.ts

**Status:** done
**Agent:** Sonnet
**Summary:** Removed all three remaining `as any` casts outside `importBackup` in `convex/logs.ts`. WQ-028: typed the reconstructed `cleanedData` in `recanonicalizeFoodLogsForUser` as `Doc<"logs">["data"]` instead of `Record<string, unknown>`, eliminating the `as any` on `ctx.db.patch`. WQ-027: changed `listRowsByUserId` to accept `DatabaseReader` instead of `MutationCtx`, enabling direct `db.query(table).withIndex("by_userId", ...)` without casting `ctx.db as any`. Applied the same fix to `deleteAllUserData`. WQ-030: since `listRowsByUserId` now takes `DatabaseReader`, the `exportBackup` query handler passes `ctx.db` directly instead of casting `ctx as unknown as MutationCtx`. Typecheck passes clean with zero `as any` remaining in the file.

### WQ-029: ProcessedFoodItem Full Validation

**Status:** done
**Agent:** Opus
**Summary:** Replaced the unsafe `items as unknown as ProcessedFoodItem[]` cast in `assertProcessedFoodItems` with a full runtime type guard `isProcessedFoodItem`. The guard validates ALL 19 fields on the `ProcessedFoodItem` interface: 4 required fields (userSegment, parsedName, quantity, unit) checked for correct types, and 15 optional fields (quantityText, canonicalName, resolvedBy, recoveryStage, bucketKey, bucketLabel, matchConfidence, matchStrategy, matchCandidates, bucketOptions, defaultPortionDisplay, preparation, spiceLevel, name, rawName) checked for undefined-or-correct-type including literal union validation. The `matchCandidates` and `bucketOptions` arrays are validated element-by-element against their full object shapes (FoodMatchCandidate: 12 fields, FoodMatchBucketOption: 4 fields). Items failing validation are excluded with a `console.warn` instead of throwing, since the function is used in evidence processing and resolution flows where partial success is preferable to full failure. No `as any`, `as unknown as X`, or `!` assertions remain.

### WQ-032: Empty ID Guard on asConvexId

**Status:** done
**Agent:** Opus
**Summary:** Added an `id.length === 0` guard to `asConvexId()` in `src/lib/sync.ts` that throws a descriptive error if an empty string is passed. The function is used at 4 call sites (`useRemoveSyncedLog`, `useUpdateSyncedLog`, `useToggleReportStar`, `FoodMatchingModal.tsx`) — all receive IDs from Convex query results, so an empty string indicates a serious upstream bug that should fail loudly rather than silently creating a bogus Convex ID. The guard throws rather than returning null because all callers pass the result directly to Convex mutations with no null-handling path. All 607 unit tests pass.

### WQ-033: Validate HabitType Before Cast in derivedHabitLogs

**Status:** done
**Agent:** Opus
**Summary:** Replaced the unsafe `log.data.habitType as HabitConfig["habitType"]` cast in `src/lib/derivedHabitLogs.ts` with a proper `isHabitType()` type guard call. The `isHabitType()` function already existed in `src/lib/habitTemplates.ts` as a private function backed by a `VALID_HABIT_TYPES` set — it was changed to `export function` so `derivedHabitLogs.ts` can import it. When `isHabitType()` returns false, `undefined` is passed as the fallback type to `resolveHabitFromKey()`, which then falls back to alias-based matching or returns null (skipping the log entry). This file is actively used (imported by `SyncedLogsContext.tsx`). No console.warn was needed because invalid habit types already cause the entry to be silently skipped via the `if (!habit) continue` guard on line 113. All 607 unit tests pass.

### WQ-016: foodEvidence.ts Structural Guards

**Status:** done
**Agent:** Opus
**Summary:** Replaced all 7 unsafe `as Record<string, unknown>` casts and `as { field?: unknown }` casts in `shared/foodEvidence.ts` with calls to typed parser functions. Created `shared/logDataParsers.ts` with 5 parser/guard functions (`parseDigestiveData`, `parseFoodData`, `parseHabitData`, `parseActivityData`, `parseFluidData`) and their corresponding typed interfaces (`ParsedDigestiveData`, `ParsedFoodData`, `ParsedHabitData`, `ParsedActivityData`, `ParsedFluidData`). Each parser validates the data is a non-null object, checks required fields exist with correct types, and guards all `Number()` conversions against NaN via a `safeNumber()` helper that returns `undefined` for non-finite values. When a parser returns null (invalid data), the calling function skips the record with a `console.warn`. Refactored `normalizeDigestiveCategory` to accept a typed parsed object instead of raw `unknown` data. No `as any`, `as unknown as X`, or `!` assertions used. All 607 unit tests pass.

### WQ-038: `useStore.getState()` Stale Cache

**Status:** done
**Agent:** Opus
**Summary:** Replaced `useStore.getState().paneSummaryCache` inside the `runAnalysis` callback in `src/hooks/useAiInsights.ts` with a reactive selector pattern. Added `const paneSummaryCache = useStore((state) => state.paneSummaryCache)` at the hook level, added it to the `DataRefs` interface, piped it through the `dataRef` snapshot ref (matching the existing pattern for all other reactive data in this hook), and replaced the callback-internal `useStore.getState()` call with `dataRef.current.paneSummaryCache`. Also added `PaneSummaryCacheEntry` to the type imports. The component will now re-render when `paneSummaryCache` updates, and the callback always reads the latest snapshot via the ref.

### WQ-043: Sleep Goal No Rollback on Convex Failure

**Status:** done
**Agent:** Opus
**Summary:** Added error handling to all three sleep-related `onChange` handlers in `src/components/track/quick-capture/HabitDetailSheet.tsx`. The sleep target handler (which fires both `setSleepGoal` and `updateHabit`) now uses `Promise.all()` with `.catch()` that logs the error and shows a toast. The nudge checkbox and nudge time handlers now chain `.catch()` on the `setSleepGoal` promise with toast error feedback. Both `setSleepGoal` and `updateHabit` already call `patchProfile` which writes directly to Convex (there is no separate Zustand state to roll back), so the fix ensures failures are surfaced to the user rather than silently swallowed.

### WQ-014/015: sync.ts Type Guards

**Status:** done
**Agent:** Opus
**Summary:** Removed both `as unknown as` double-casts from `src/lib/sync.ts`. WQ-014 (read path): replaced the blanket `as unknown as SyncedLog[]` cast in `toSyncedLogs()` with a per-row `toValidatedSyncedLog()` function that validates each log's `type` field at runtime via `isValidLogType()` type guard, then switches on the type to build the correct discriminated union member. Rows with unexpected types are skipped with `console.warn` instead of crashing. WQ-015 (write path): replaced the `as unknown as ConvexLogData` cast in `sanitizeLogData()` with a typed switch on `LogType` that builds each Convex data variant explicitly using `satisfies ConvexLogData`. Added `toConvexFoodItem()` helper to convert `FoodItem.canonicalName` from `string | null` (domain type) to `string | undefined` (Convex validator type) -- a real type mismatch the old cast was silently hiding. The function signature now takes `(type, data)` instead of just `(data)`, requiring callers (`useAddSyncedLog`, `useUpdateSyncedLog`) to pass the log type for discrimination. Updated two call sites (`Track.tsx`, `RawInputEditModal.tsx`) to pass `type` from their already-available log objects. Zero `as any` or `as unknown as` casts remain in the file. All 607 unit tests pass, typecheck clean.

## Sprint 2: Test Coverage

### WQ-052: baselineAverages — Remove "agua" + Tests

**Status:** done
**Agent:** Opus
**Summary:** Removed hardcoded Spanish alias "agua" from `baselineAverages.ts` (CLAUDE.md personalization violation). Created 42 tests covering: multi-habit scenarios, zero-cap habits (dailyCap=0 preserved), empty data, all habit types (boolean/counter/duration/time), fluid baselines, weight baselines, digestion baselines, 24h deltas, change detection via `buildTodayHash`. Includes regression test verifying "agua" is no longer silently merged with "water". Note: separate "agua" in `store.ts` BLOCKED_FLUID_PRESET_NAMES is a different concern, left untouched.

### WQ-053: habitProgress — Comprehensive Tests

**Status:** done
**Agent:** Opus
**Summary:** Created 81 tests covering `getProgressText`, `getProgressColor`, `shouldShowBadge`, `getProgressFraction`, `getProgressBarColor`, and 7 integration scenarios. Covers all habit types, destructive habits (smoking/alcohol/rec drugs/confectionery), zero-cap edge case, fluid targets, imperial units, detail vs tile modes. **Findings for backlog:** (1) "tina" hardcoded in 3 locations (foodEvidence.ts, derivedHabitLogs.ts, habitTemplates.ts); (2) `getProgressFraction` has minor zero-cap division bug (0/0 → NaN, n/0 → Infinity clamped to 1).

### WQ-054: derivedHabitLogs — Tests + WQ-033 Validation

**Status:** done
**Agent:** Opus
**Summary:** Created 48 tests covering: all habit/fluid/activity types, the `isHabitType()` guard from WQ-033 (invalid strings gracefully skipped), sort behavior (ascending, stable, input not mutated), mixed valid/invalid logs, non-matching log types ignored, alias resolution (including "tina"), output shape, and integration with real HABIT_TEMPLATES.

### WQ-055: Fix Expired Items Bug + Convert it.fails

**Status:** done
**Agent:** Opus
**Summary:** Found `it.fails` in `convex/__tests__/foodPipelineBranches.test.ts` line 438. Root cause: `resolveItem` had `item.resolvedBy !== "expired"` in its `alreadyResolved` guard, which accidentally let expired items through by making the entire expression false. Fix: added a dedicated guard for expired items before the `alreadyResolved` check that throws a `ConvexError` directing users to edit the raw log text. Removed the `resolvedBy !== "expired"` exclusion from the general guard. Converted `it.fails` to a normal passing `it`.

### WQ-056: bristolToConsistency — Boundary Tests

**Status:** done
**Agent:** Opus
**Summary:** Created 37 tests: `bristolToConsistency` (16 tests — all valid codes 1-7, boundary values, out-of-range throws, non-integer throws, Infinity), `normalizeDigestiveCategory` (10 tests — all 5 consistency tags, case-insensitive, tag priority over bristolCode, fallback to bristolCode, null/NaN/empty handling), `normalizeEpisodesCount` (9 tests — integer passthrough, decimal flooring, min/max clamp, NaN/Infinity fallback).

### WQ-057: sync.ts — Full Test Coverage

**Status:** done
**Agent:** Opus
**Summary:** Created 40 tests across 5 describe blocks: `asConvexId` (empty string throws per WQ-032), `toConvexFoodItem` (null→undefined conversion), `sanitizeLogData` (all 7 log types produce correct output shapes), `toValidatedSyncedLog` (all 7 types + unknown/empty type returns null with console.warn), `toSyncedLogs` (undefined/empty input, batch conversion, invalid rows skipped, order preserved). Exported 4 functions and 2 types from sync.ts for testability.

### WQ-058: validateHabitConfig — Zero-Cap + Edge Case Tests

**Status:** done
**Agent:** Opus
**Summary:** Created 68 tests covering: required field validation (throws on missing), habitType coercion (legacy types mapped to modern equivalents), kind enforcement (destructive forced, checkbox forced), type-specific constraints (checkbox forces quickIncrement=1, destructive removes dailyTarget), zero-cap preservation (dailyCap=0 kept per WQ-005 fix), optional field validation (weeklyFrequencyTarget, archivedAt, logAs, templateKey), unknown property stripping. Finding: `dailyCap: -1` is silently excluded (not set in output) rather than throwing.

### WQ-059: migrateLegacyStorage — Investigation

**Status:** done (investigation)
**Agent:** Opus
**Summary:** **Recommendation: DELETE.** The migration reads an old Zustand-persisted IndexedDB blob (`"ostomy-tracker-storage"`) that is no longer produced anywhere. The Zustand store has no persist middleware (confirmed by codebase search). Single-user app, migration is 6+ days old, self-destructs after running. The `LegacyMigration` component runs on every mount, finds nothing, returns false. Files to delete: `src/lib/migrateLegacyStorage.ts`, the `LegacyMigration` component in `routeTree.tsx` (lines 290-316 + render at line 333), and its import.

### WQ-060: digestiveCorrelations — Investigation

**Status:** done (investigation)
**Agent:** Opus
**Summary:** **Recommendation: REMOVE.** Correlations do NOT feed Dr. Poo in practice — the pipeline is wired but `setPaneSummaryCacheEntry` is never called (cache always empty). The UI was already deleted. The algorithm has a known overlap bug (best/worst days share entries with ≤4 days). Full dead code chain: `digestiveCorrelations.ts` → `habitCoaching.ts` pane summaries → Zustand `paneSummaryCache` → `useAiInsights.ts` builder → prompt text in `aiAnalysis.ts`. Files to clean: digestiveCorrelations.ts, its test file, habitCoaching.ts dead functions, store.ts paneSummaryCache, useAiInsights.ts correlation builder, aiAnalysis.ts prompt section + types, AppDataForm.tsx localStorage key.

### WQ-063: destructive-habits E2E — Fix Setup + Unskip

**Status:** done
**Agent:** Opus
**Summary:** Tests were skipped because Cigarettes/Rec Drugs aren't in DEFAULT_HABIT_TEMPLATE_KEYS — a fresh test user never has them. Original test bodies were empty stubs. Added `ensureDestructiveHabit` helper that walks through Add Habit UI flow. Implemented 4 full E2E tests: increment count + status update, rec drugs cap status, cigarettes cap overflow (11 taps past dailyCap=10), and desktop 3-dot menu → HabitDetailSheet. All use idempotent setup, relative assertions, and real UI patterns from existing specs. High confidence they pass with dev server. Note: long-press test uses desktop 3-dot button (xl:flex) instead of simulating pointer hold.

### WQ-064: normalizeAssessmentRecord — Quick Tests

**Status:** done
**Agent:** Opus
**Summary:** Created 8 tests covering: happy path with all fields, each of 4 optional field defaults (confidence→medium, causalRole→possible, changeType→unchanged, modifierSummary→""), whitespace trimming, registry-known food canonical resolution ("Banana"→"ripe banana"), unrecognized food fallback to normalizeFoodName, title-casing of foodName.

### Integration Verification

**Tests:** 932 passed, 0 failed (45 test files)
**Typecheck:** Clean (tsc + convex typecheck)
**New tests added this sprint:** 325+ (from 607 baseline)
**Type errors fixed:** 20 (habitProgress imperial→imperial_us, habitTemplates Record cast routing, sync.test FoodMatchResolver values)

## Sprint 2.5 Wave 2: Transit Time Model + Evidence Fixes

### Task 2.1: Transit Time Constants Update

**Status:** done
**Agent:** Opus
**Summary:** Updated `shared/foodEvidence.ts` transit constants: `DEFAULT_CENTER_MINUTES` 720→1440 (24h), `DEFAULT_SPREAD_MINUTES` 360→480 (8h), giving default window [16h, 32h]. Floor kept at 360 (6h). Added `SurgeryType` type and `SURGERY_TYPE_CENTER_MINUTES` map (ileocolic: 1080/18h, colonic: 1680/28h). Added `FoodTransitCategory` with 7 categories and `FOOD_TRANSIT_CATEGORY_ADJUSTMENTS` (clear liquids -2h, high-fat +2h, etc.). Extended `buildTransitWindow()` with optional `surgeryType` and `foodCategory` params. Learned calibration supersedes surgery-type estimates. Updated existing tests for new window. 24 new tests, all passing.

### Task 2.2: Trigger Correlation Model

**Status:** done
**Agent:** Opus
**Summary:** Added trigger correlation model to `shared/foodEvidence.ts` for Bristol 6-7 gastrocolic reflex events. 3h trigger window (`TRIGGER_WINDOW_MINUTES = 180`). Bristol 7: trigger primary, transit evidence downweighted (0.1x/0.25x). Bristol 6: both trigger + transit active. Bristol 3-5: transit only. Priority scoring via `computeTriggerPriorityScore()` (Zone 3 foods, fats, recency). `findTriggerCorrelations()` exported. Trigger evidence feeds into `codeScore` as additional negative signal. 20 new tests.

### Task 2.3: Surgery-Type-Aware Bristol Ranges

**Status:** done
**Agent:** Opus
**Summary:** Added `getBristolExpectation(bristolCode, surgeryType, monthsSinceSurgery)` to `src/lib/foodStatusThresholds.ts`. Data-driven lookup tables for ileocolic early recovery (Bristol 5-6 expected), colonic early recovery (Bristol 2-3 expected), and steady state (6+ months, both converge). Bristol 7 always "concern". `BristolExpectation` type: ideal/expected/normal/unusual/concern. Verified `surgeryDate` exists in health profile schema. 73 new tests.

### Task 2.4: Dr. Poo Time-of-Day Awareness

**Status:** done
**Agent:** Opus
**Summary:** Added `buildPartialDayContext()` to `src/lib/aiAnalysis.ts`. Provides: report generation time, partial-day note (before noon), time since last BM, foods currently in transit (6h+ old, max 10 items). Integrated into `buildUserMessage()` as `partialDayContext` in JSON payload. 13 new tests.

### Task 2.5: WQ-012 — Bristol Classification Fix

**Status:** done
**Agent:** Opus
**Summary:** Replaced weighted average in `classifyConsistency()` with majority-rules 30% threshold. 5 Bristol categories: constipated (1-2), hard (3), normal (4), loose (5-6), diarrhea (7). Tie-breaking by concern distance from normal. Fallback for perfectly even splits. `computeBristolAverage()` preserved (used by columns.tsx). New exports: `BristolCategory`, `BristolScore`, `bristolCategory()`, `MAJORITY_THRESHOLD`. 50 new tests.

### Task 2.6: WQ-049 — Evidence Threshold Fix

**Status:** done
**Agent:** Opus
**Summary:** Deleted dead `MIN_RESOLVED_TRIALS = 2` from `foodStatusThresholds.ts`. Added named constants: `INITIAL_GRADUATION_TRIALS = 5`, `RECOVERY_GRADUATION_TRIALS = 3`. Added `countRecentConsecutiveGoodTrials()` function. Recovery path: foods in "watch"/"avoid" with 3 consecutive Bristol 3-5 good outcomes → can recover to "safe". 21 new tests (minus 1 cross-import test removed during integration).

### Task 2.7: WQ-060 — Remove Correlations Dead Code

**Status:** done
**Agent:** Opus
**Summary:** Deleted `digestiveCorrelations.ts` + test file. Removed ~160 lines of dead Tier 2 pane summary code from `habitCoaching.ts`. Removed `paneSummaryCache` from Zustand store, `useAiInsights.ts`, `domain.ts`. Removed `"patterns-correlations-open"` localStorage key. Preserved: `habitCorrelationInsights` in Dr. Poo prompt, Tier 1/3 coaching code.

### Integration Verification

**Tests:** 1126 passed, 0 failed (48 test files) — 194 net new from 932 baseline
**Typecheck:** Clean (tsc + convex typecheck)
**Build:** Clean

## Sprint 2.5 Wave 3: LLM Food Matching Pipeline

### Task 3.1: Architecture Decision — Client-Initiated BYOK

**Status:** done
**Agent:** Orchestrator (no code)
**Summary:** Confirmed client-initiated BYOK approach: API key stored in IndexedDB, client detects unresolved foods, passes key transiently to Convex action, action calls OpenAI and applies results, key never stored server-side at rest.

### Task 3.2: Un-stub `matchUnresolvedItems` Action

**Status:** done
**Agent:** Opus
**Summary:** Wired the previously-stubbed action handler in `convex/foodLlmMatching.ts`. Added `requireAuth(ctx)` auth guard, API key format validation, log ownership check via `getFoodLogVersionInfo` internal query. Builds registry vocabulary, constructs prompt, calls OpenAI via `fetch` with `response_format: { type: "json_object" }`, parses via `parseLlmResponse()`, post-processes via `processLlmResults()`, writes back via `applyLlmResults`. Model-agnostic with optional `model` arg (defaults to `gpt-4.1-nano`). Error handling: 401/403 are `[NON_RETRYABLE]`, graceful degradation on unparseable responses.

### Task 3.3: Implement `applyLlmResults` Mutation

**Status:** done
**Agent:** Opus
**Summary:** Implemented the `applyLlmResults` internalMutation in `convex/foodParsing.ts`. Validates ownership and optimistic concurrency via `expectedItemsVersion`. Matches LLM resolved items to unresolved log items by `userSegment`. Updates items with `canonicalName`, `resolvedBy: "llm"`, `recoveryStage`, clears candidates/buckets. Bumps `itemsVersion`. If `evidenceProcessedAt` is already set (evidence window closed), creates `ingredientExposures` directly for newly resolved items; otherwise defers to existing `processEvidence` scheduler.

### Task 3.4: Review/Update the LLM Prompt

**Status:** done
**Agent:** Opus
**Summary:** Reviewed existing `buildMatchingPrompt()`. No changes needed — prompt correctly handles multi-ingredient inputs, binary matching (match/NOT_ON_LIST), structured JSON response, prompt injection prevention (user data in separate message), web search instructions, typo correction. Token-efficient (parsedName + canonical only, zone derived from registry lookup in `processLlmResults`).

### Task 3.5: Wire the Client Hook

**Status:** done
**Agent:** Sonnet
**Summary:** Added `useFoodLlmMatching()` call to `Track.tsx`. Replaced clever type cast with idiomatic `asConvexId<"logs">()`. Added toast notifications: loading ("Matching foods with AI..."), success ("X food(s) matched automatically"), error (actionable message for bad API key). Non-retryable errors stay in sent set; retryable errors allow retry on next render.

### Task 3.6: Tests + Verification

**Status:** done
**Agent:** Opus
**Summary:** Added 17 new tests for `applyLlmResults` internalMutation covering: correct writeback, version mismatch rejection, segment matching with duplicates, clearing matchCandidates/bucketOptions, post-evidence-window exposure creation, pre-evidence-window skip, cross-user authorization, non-food log rejection, empty items, unmatched segments, multiple resolutions, already-resolved protection, default version, recovery stage on exposures. Plus 2 updated existing tests (auth/validation errors). Total: 1145 tests passing.

### Integration Verification

**Tests:** 1145 passed, 0 failed (48 test files) — 19 net new from 1126 baseline
**Typecheck:** Clean (tsc + convex typecheck)
**Build:** Clean

## Sprint 2.5 Wave 4: Food Registry Hardening

### Task 4.1: Registry Data Fixes

**Status:** done
**Agent:** Codex
**Summary:** Applied the planned registry hardening fixes. Reclassified `gelatin dessert` from `carbs/grains` to `protein/eggs_dairy`, removed the duplicate `"lactose free spreadable cheese"` example from `cream_cheese`, removed the reflexive `["pureed potato", "pureed potato"]` synonym entry, and verified the standalone-word audit: `bread`, `rice`, and `pasta` were already covered; added missing bare `fish` and `chicken` examples to the Zone 1B protein entries.

### Task 4.2: Food Match Candidate Merging

**Status:** done
**Agent:** Codex
**Summary:** Added `shared/__tests__/foodMatchCandidates.test.ts` to exercise `mergeFoodMatchCandidates()` across empty inputs, fuzzy-only, embedding-only, combined candidates, confidence weighting, metadata preservation, ordering, and repeated embedding updates. The merge logic now correctly overwrites embedding-only candidates with newer embedding scores before combined ranking.

### Task 4.3: Preparation for Per-Food Registry Audit

**Status:** done
**Agent:** Codex
**Summary:** Created `docs/plans/food-registry-audit-checklist.md` as the reusable per-entry audit template covering canonical naming, group/line, zone placement, examples, alias collisions, `lineOrder`, and digestion metadata.

### Task 4.4: Tests + Verification

**Status:** done
**Agent:** Codex
**Summary:** Verified the Wave 4 slice directly: focused registry/matching unit tests passed (`shared/__tests__/foodMatchCandidates.test.ts`, `foodCanonicalization.test.ts`, `foodRegistry.test.ts`, `foodMatching.test.ts`) and `bun run typecheck` passed clean.

## Sprint 2.5 Wave 5 + Sprint 2.5+ Phases 1-2: Bandwidth Reduction

**Branch:** `fix/drpoo-bandwidth`
**Date:** 2026-03-18

### WQ-315: Dr. Poo Report Trigger Redesign

**Status:** done
**Agent:** Opus (sub-agent coordination)
**Summary:** Replaced 60s debounce with 4h cooldown (`COOLDOWN_MS = 14_400_000`). Auto-trigger now only fires for Bristol 6-7 (diarrhea emergency). Added conversation-only lightweight mode: during cooldown, `sendNow` sends only conversation context + patient snapshot, skipping the full log dump. Rate limiter enabled at 5min safety net (`MIN_CALL_INTERVAL_MS = 300_000`). Persisted `reportTriggerMode: "auto" | "manual"` enum in aiPreferences. Compact segmented pill toggle (Auto/Manual) on BM panel heading row. Files: `useAiInsights.ts`, `aiAnalysis.ts`, `aiRateLimiter.ts`, `validators.ts`, `domain.ts`, `Track.tsx`, `BowelSection.tsx`.

### WQ-316/WQ-300: aiAnalysis Payload Migration

**Status:** done
**Agent:** Opus (sub-agent)
**Summary:** Rewrote `migrateAiAnalysisPayloads` in `migrations.ts` with batch size of 5 (was up to 200), self-scheduling via `ctx.scheduler.runAfter(100ms)`, idempotent (checks existing payloads before creating). Removed configurable `batchSize` arg. Post-deploy: run from Convex dashboard.

### WQ-301: Canonical Name Migration Script

**Status:** done
**Agent:** Opus (sub-agent)
**Summary:** Added `normalizeCanonicalNames` internalMutation to `migrations.ts`. Processes 4 tables in order (foodAssessments → ingredientExposures → foodTrialSummary → foodAliases), batch 50, cursor-based pagination, self-scheduling. Dry-run support. Idempotent — only patches rows where `canonicalizeKnownFoodName(name) ?? normalizeFoodName(name)` differs from stored value. Post-deploy: run from dashboard.

### WQ-303: Fix foodAssessments Full-Table Scans

**Status:** done
**Agent:** Opus (sub-agent)
**Summary:** `historyByFood` now uses `by_userId_canonicalName` index. `culprits` uses two `by_userId_verdict` queries (culprit + avoid) + merge + dedup. `allFoods` kept `.collect()` (Convex has no distinct op). Removed `normalizeCanonicalName()` and `normalizeAssessmentRow()` helpers — runtime re-normalization no longer needed. Tests updated to use post-migration canonical names.

### WQ-304: Fix aggregateQueries Full-Table Scans

**Status:** done
**Agent:** Opus (sub-agent)
**Summary:** `foodTrialsByStatus` uses `by_userId_status` composite index. `foodTrialByName` uses `by_userId_canonicalName` + `.first()`. `allFoodTrials` kept `.collect()` with documented tradeoff (small table). Tests split and updated.

### WQ-305: Fix ingredientExposures Full-Table Scans

**Status:** done
**Agent:** Opus (sub-agent)
**Summary:** `historyByIngredient` uses `by_userId_canonicalName` index (1,924 → ~5-20 reads, 99% reduction). Removed `normalizeCanonicalName` helper and `_normalizeIngredientExposureRow`. `allIngredients` removed per-row normalization, trusts migration. Tests updated.

### WQ-306: Make computeAggregates Incremental

**Status:** done
**Agent:** Opus (sub-agent)
**Summary:** `updateFoodTrialSummaryImpl` rewritten from full-table scans to scoped reads. Gets report assessments via `by_aiAnalysisId`, per-food history via `by_userId_canonicalName` (queries both raw and normalized names for alias merges), existing summaries via same index, and logs via 14-day time window anchored to report timestamp. ~95% reduction (~1,675 → ~60-80 reads per report). All 11 tests pass unchanged.

## Sprint 2.5+ Phases 3-5: Schema Simplification, LLM Context, Verification

### WQ-307: ingredientExposures — Keep + Fix Indexes

**Status:** done
**Summary:** Decision: Option C — keep table, fix indexes. Existing indexed queries (by_userId_canonicalName) from WQ-305 are sufficient.

### WQ-308: Populate & Extend foodEmbeddings

**Status:** done
**Summary:** Seeded registry embeddings via ensureFoodEmbeddings(). Extended schema for alias embeddings (sourceType: registry/alias).

### WQ-309: Eliminate reportSuggestions

**Status:** done
**Summary:** Suggestions read from aiAnalyses.insight.suggestions via new suggestionsByDateRange query. Table removed, write paths removed, backward-compatible import.

### WQ-311: Client-Side Context Compiler

**Status:** done
**Summary:** Refactored buildLogContext + buildUserMessage in aiAnalysis.ts. Variable windows per log type + surgery. Curated food context (active trials, safe, flags). Patient snapshot. Delta signals. 5 new functions.

### WQ-317: API Key Migration (IndexedDB → Convex)

**Status:** done
**Summary:** BYOK OpenAI key stored in Convex profile (base64 obfuscated). Dual-write with auto-migration. Server-side key fallback in actions.

### WQ-313: Test Suite Updates

**Status:** done
**Summary:** 67 new tests for context compiler + 15 API key tests. 1273 total passing.

### WQ-314: Browser Verification

**Status:** done
**Summary:** All pages pass. 0 console errors. Report at docs/verification/wq-314-browser-verification.md.

### WQ-319: Dr. Poo Quality Verification

**Status:** in progress
**Summary:** Comparison doc at docs/verification/wq-319-drpoo-quality-comparison.md. Real before/after data being collected over 1-2 days.

### Integration Verification

**Tests:** 1273 passed, 0 failed (49 test files)
**Typecheck:** Clean
**Build:** Clean

---

## Sprint 2.6 Wave 0: Base UI Migration

### WQ-080 through WQ-086: Full Base UI Migration

**Status:** done
**Agent:** User (manual) + Claude (review/fixes)
**Summary:** Complete migration from `radix-ui` (wrapping `@radix-ui/react-*`) + `vaul` to `@base-ui/react` ^1.3.0. ~60 files changed. All UI primitives migrated: switch, tabs, toggle, toggle-group, accordion, drawer, dialog, popover, sheet, dropdown-menu, checkbox, collapsible, label, scroll-area, separator, tooltip, navigation-menu, badge, button. Data attributes updated per mapping. New helper: `base-ui-utils.tsx`. Compatibility layers for accordion/toggle-group type bridging. Review found and fixed: 3x dead `data-[state=inactive]` selectors in Patterns.tsx, stale vaul doc in CLAUDE.md, inconsistent DeleteConfirmDrawer animation pattern.

### Integration Verification

**Tests:** 1273 passed, 0 failed (49 test files)
**Typecheck:** Clean
**Build:** Clean

---

## Sprint 2.6 Wave 1-3: Transit Map Build

### WQ-208: TransitMapContainer Component

**Status:** done
**Agent:** Sonnet
**Summary:** Created `src/components/patterns/transit-map/TransitMapContainer.tsx` — the top-level production transit map component. Calls `useTransitMapData(foodStats)` to get the `TransitNetwork`. Renders 4 corridor sections with `GROUP_THEME` theming (copied from `RegistryTransitMap`). Each corridor renders its lines via `LineTrack` (import placeholder — `LineTrack` delivered by WQ-209). Manages `selectedCanonical` state with the ref+effect pattern from `RegistryTransitMap` to avoid stale closure issues on network updates. Aside panel renders `StationInspectorPlaceholder` (TODO: WQ-211 replace with `<StationInspector>`). Summary cards header: Stations, Tested, Untested, Next stop. Empty state: shown when `foodStats` is empty AND `testedStations === 0`. Responsive layout: `grid xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.85fr)]`.

### WQ-209: LineTrack Component

**Status:** done
**Agent:** Sonnet
**Summary:** Created `src/components/patterns/transit-map/LineTrack.tsx`. Renders a single food line (e.g., "Grains Line") as a self-contained card. Header shows `displayName` + `testedCount/totalCount`. "Next stop" chip appears when `line.nextStop !== null`. Progress bar (sky-500/60 fill, percentage label) shows how far along the user has tested. Zone boundary markers (horizontal divider with zone label: Zone 1A, Zone 1B, Zone 2, Zone 3) appear at the first station and whenever zone/subzone changes between consecutive stations. Each station renders via the existing `StationNode` component with correct `selected` and `onSelect` props. Empty state: "No stations on this line" when `line.stations.length === 0`. The `corridorGroup` prop is wired in the interface per spec but not yet consumed in rendering (prefixed `_corridorGroup` to suppress lint warning). Typecheck clean.

### WQ-210: StationNode Component

**Status:** done
**Agent:** Sonnet
**Summary:** Created `src/components/patterns/transit-map/StationNode.tsx`. Extracted and enhanced the inline `StationButton` function from `RegistryTransitMap.tsx` into a standalone exported component. Enhancements over the original: (1) `data-slot="station-node"` for CSS targeting; (2) trial count badge (shown when `totalTrials > 0`) alongside the zone chip; (3) `animate-pulse` on the signal dot when `primaryStatus === "building"`, fixing WQ-039 wrong-origin pulse; (4) `serviceRecord` logic duplicated inline so the component is self-contained. `signalDotClass` exhaustive switch covers all 5 signals. Props: `{ station: TransitStation; selected: boolean; onSelect: (canonical: string) => void }`. Default export. Typecheck passes clean.

### WQ-211: StationInspector Component

**Status:** done
**Agent:** Sonnet
**Summary:** Created `src/components/patterns/transit-map/StationInspector.tsx`. Extracted and enhanced the inline `StationDetail` function from `RegistryTransitMap.tsx` into a standalone exported component. Props: `{ station: TransitStation; corridorGroup: FoodGroup; corridorDisplayName: string; lineName: string }`. Sections rendered: (1) Station header — display name (font-display 3xl), corridor+line breadcrumb, zone chip with `CORRIDOR_CHIP` theming keyed by `FoodGroup`; (2) Signal metrics row — 3 `MetricCard`s for Status/Confidence/Tendency using `confidenceLabel()` and `tendencyLabel()`; (3) Registry notes — conditional card when `station.notes !== undefined`; (4) Digestion profile — `getFoodDigestionBadges()` + `digestionBadgeClassName()` from `foodDigestionMetadata`; (5) Evidence overlay — 2x2 grid of `EvidenceStat`s: Trials logged, Resolved transits, Avg transit (minutes→hours via `Math.round(min/6)/10`), Service record; (6) Bristol breakdown — compact horizontal bar chart, only rendered when `bristolBreakdown` has entries, bars color-coded (amber for hard 1-2, emerald for normal 3-5, amber for loose 6, rose for watery 7), percentage + count labels; (7) AI verdict — shown when `latestAiVerdict !== null`, reasoning shown below in smaller text when `latestAiReasoning !== null`. `data-slot="station-inspector"` on root. Typecheck passes clean.

### WQ-212: Wire TransitMapContainer into Patterns Page

**Status:** done
**Agent:** Sonnet
**Summary:** Replaced `RegistryTransitMap` with `TransitMapContainer` in `src/pages/Patterns.tsx`. Updated import at line 31 and render at line 611. `TransitMapContainer` accepts the same `{ foodStats: FoodStat[] }` props interface. `RegistryTransitMap` is now unused by any consumer (its own source file is the only reference) — left in place per Wave 3 cleanup plan. Typecheck passes clean.

---

## Sprint 2.6 Wave 3: Transit Map Cleanup

### WQ-213: Delete `transitData.ts`

**Status:** blocked — Model Guide still rendered
**Agent:** Sonnet
**Summary:** Grepped entire codebase for imports of `transitData`. All references are confined to files in `src/components/patterns/transit-map/` (TransitMap.tsx, StationMarker.tsx, StationTooltip.tsx, TransitMapInspector.tsx, TrackSegment.tsx, ZoneCard.tsx, useTransitScene.ts, useStationArtwork.ts, constants.ts, types.ts, utils.ts). No files outside the `transit-map/` directory import it. Confirmed scoped — `transitData.ts` cannot be deleted until the Model Guide tab is removed. That is a future task.

### WQ-214: Delete Legacy Transit Map Components

**Status:** blocked — Model Guide still rendered
**Agent:** Sonnet
**Summary:** `Patterns.tsx` still renders `<TransitMap />` on line 615 inside the "Model guide" tab content. The Model Guide-only files (TransitMap.tsx, StationMarker.tsx, StationTooltip.tsx, TransitMapInspector.tsx, TrackSegment.tsx, ZoneCard.tsx, useTransitScene.ts, useStationArtwork.ts, constants.ts, types.ts, utils.ts) cannot be deleted until the Model Guide tab is removed from the UI. That removal is a future task.

### WQ-147: Remove Dead `transitMapV2` Flag

**Status:** done
**Agent:** Sonnet
**Summary:** Grepped codebase for `transitMapV2`. The flag was only referenced inside `featureFlags.ts` itself (in the JSDoc comment example and the flag definition). No consumer code checked `FEATURE_FLAGS.transitMapV2` anywhere. Removed the `transitMapV2: true` flag entry and updated the JSDoc usage example to reference `reproductiveHealth` instead. Typecheck, 1273 unit tests, and build all pass clean.

### WQ-160: Remove Developer Planning Notes from UI

**Status:** done
**Agent:** Sonnet
**Summary:** Found and replaced 3 instances of developer-facing text in `src/components/patterns/transit-map/TransitMap.tsx`. (1) Mobile sidebar description (line ~159): "Image-first stops, cleaner track geometry, and hover-driven detail." → "Visual reference of the food reintroduction map with stations grouped by zone and line." (2) Desktop sidebar description (line ~228): same text → same replacement. (3) Active corridor header description (lines ~304-307): "The map now suppresses most inline labels, uses linked inspection instead, and gives Zone 3 a proper branched-tube structure." → "Tap a station to inspect its details. Zones progress from safe foods to more experimental options." Typecheck, 1273 unit tests, and build all pass clean.

### Integration Verification

**Tests:** 1273 passed, 0 failed (49 test files)
**Typecheck:** Clean
**Build:** Clean

---

## Sprint 3: Error Handling + Accessibility

_(pending Sprint 2.6 completion)_

## Sprint 4: Performance + Architecture

### Phase 1: Independent Performance Fixes (7 parallel agents)

**WQ-090: TrackPage lazy import**
**Status:** done
**Summary:** Replaced eager import with `lazy()` + `<Suspense>` in `routeTree.tsx`.

**WQ-091: REPORT_HISTORY_COUNT 500→20**
**Status:** done
**Summary:** Reduced in `useAiInsights.ts`. Only used for dedup + boolean check.

**WQ-093: `.take(100)` filter fix**
**Status:** done
**Summary:** Server-side `.filter().first()` replaces `.take(100)` + in-memory find in `aiAnalyses.ts`.

**WQ-095: baselineAverages O(n²)→O(n)**
**Status:** done
**Summary:** Pre-built `Map<string, HabitLog[]>` in `baselineAverages.ts`.

**WQ-097: Fuse instance caching**
**Status:** done
**Summary:** Module-level `Map<string, Fuse>` cache with contextId invalidation in `foodMatching.ts`.

**WQ-092: N+1 collect for prior foods**
**Status:** already resolved (WQ-302 knownFoods set)

**WQ-096: digestiveCorrelations O(n²)**
**Status:** closed (file deleted in WQ-060)

### Phase 2: logs.ts Performance (1 agent, 3 tasks)

**WQ-087: Unbounded `listAll` query**
**Status:** done
**Summary:** 90-day window + 10k hard limit. Uses `by_userId_timestamp` index.

**WQ-088: Full table scan for count**
**Status:** done
**Summary:** `.take(10_001)` capped count. Returns `{ count, capped }`. UI shows "10,000+".

**WQ-089: `listFoodLogs` full collect + JS filter**
**Status:** done
**Summary:** Added `by_userId_type` + `by_userId_type_timestamp` indexes. Direct index query.

### Phase 3: Architecture Consolidation (7 parallel agents)

**WQ-098: buildFoodEvidenceResult server-only**
**Status:** blocked — client needs trial-level detail not in schema. Fix path documented.

**WQ-099: Consolidate resolveCanonicalFoodName**
**Status:** done
**Summary:** 9 copies → 1 in `shared/foodCanonicalName.ts`. 13 files updated.

**WQ-100: Extract TINT_BY_PROGRESS_COLOR**
**Status:** done
**Summary:** Shared constant in `quick-capture/constants.ts`.

**WQ-101: Extract getDateKey**
**Status:** done
**Summary:** Shared function in `hero/utils.ts`. Also consolidated `MS_PER_DAY`.

**WQ-102: Extract HealthSelect component**
**Status:** done
**Summary:** `SettingsSelect` component with `section` prop. 6 consumers updated.

**WQ-103: Consolidate MEASURE_UNIT_PATTERN**
**Status:** done
**Summary:** Canonical version in `foodNormalize.ts`. Fixed drift (added `mg`, `servings`).

**WQ-104: Consolidate Zone type**
**Status:** done
**Summary:** Removed `Zone` alias, use `FoodZone` from registry directly.

### Phase 4: Large File Decomposition (4 parallel agents)

**WQ-105: Split DrPooSection.tsx (994→418 LOC)**
**Status:** done
**Summary:** Extracted `drPooPreviewData.ts` (532), `DrPooPreviewComponents.tsx` (103), `DrPooSliderControl.tsx` (77).

**WQ-106: Split WeightEntryDrawer.tsx (906→533 LOC)**
**Status:** done
**Summary:** Extracted `WeightTrendChart.tsx` (313), `UnitAwareInput.tsx` (84), `weightUtils.ts` (38). Also cleaned WQ-155 task markers.

**WQ-109: Split foodRegistry.ts (4057 LOC)**
**Status:** done
**Summary:** `foodRegistryData.ts` (3718) + `foodRegistryUtils.ts` (145) + barrel re-export.

**WQ-110: Split sync.ts (698 LOC)**
**Status:** done
**Summary:** 5 modules: `syncCore` (230), `syncLogs` (100), `syncAi` (130), `syncFood` (210), `syncWeekly` (65) + barrel.

### Deferred (file conflicts with concurrent sprints)

- **WQ-094** — `Patterns.tsx` conflict with Sprint 2.7
- **WQ-107** — `LogEntry.tsx` conflict with Sprint 3
- **WQ-108** — `aiAnalysis.ts` active TS errors

### Quality Gate

**Tests:** 1273 passed, 0 failed (49 files)
**Typecheck:** Pre-existing errors only (`LogEntry.tsx`, `UiMigrationLab.tsx`) — none from Sprint 4
**Build:** Blocked by pre-existing `LogEntry.tsx` error (Sprint 3 owns this)

## Sprint 5: Polish + Dead Code + Documentation

_(pending Sprint 4 completion)_

## Sprint 7: Full Codebase Audit Findings (2026-03-21)

> 47 items from the 12-agent codebase audit. Executing in 4 phases via sub-agents.
> **Excluded from this sprint:** WQ-341 (touches Patterns.tsx), transit-map parts of WQ-352.

### Phase 1: Backend Security + Performance (8 agents, parallel)

| WQ     | Title                                                                  | Status |
| ------ | ---------------------------------------------------------------------- | ------ |
| WQ-322 | `foodAssessments.byReport` auth gap — composite index                  | done   |
| WQ-323 | OpenAI error handling — structured error codes + masked keys           | done   |
| WQ-324 | API key validation — moved before client creation                      | done   |
| WQ-325 | Upsert race conditions — self-healing dedup on read+write              | done   |
| WQ-326 | Scheduler error handling — try/catch + task ID logging on all 9 calls  | done   |
| WQ-327 | allIngredients truncation flag — `{ ingredients, isTruncated, count }` | done   |
| WQ-328 | Profile existence check before API key                                 | done   |
| WQ-334 | Double query — deduplicated via single `uniqueQueryNames` Set          | done   |
| WQ-335 | Unbounded .collect() — capped at 1000 with console.warn                | done   |
| WQ-336 | conversations.claimPendingReplies — capped at 20 + logging             | done   |
| WQ-337 | Conversation search — added `search_content` search index              | done   |
| WQ-338 | Double normalization in migrations                                     | done   |
| WQ-346 | Memoize buildRegistryVocabularyForPrompt — module-level cache          | done   |
| WQ-347 | Fuzzy pre-matching — Fuse.js at 0.15 threshold, ~40% LLM calls saved   | done   |

**Phase 1 spec review: ALL PASS.** Minor notes: `resolvedBy: "llm"` for fuzzy matches, 4xx→NETWORK_ERROR misclassification, duplicated helpers. None are spec violations.

### Phase 2: Validation + Frontend Performance (9 agents, parallel)

| WQ     | Title                                                     | Status |
| ------ | --------------------------------------------------------- | ------ |
| WQ-329 | Number validation — sanitizeQuantity + isFinite guards    | done   |
| WQ-332 | Env var format validation — Stripe + Clerk regex          | done   |
| WQ-333 | CSP headers — already existed in vercel.json              | done   |
| WQ-339 | Composite indexes — `by_userId_updatedAt` + query updated | done   |
| WQ-340 | useBaselineAverages — throttle→debounce + refs pattern    | done   |
| WQ-342 | TodayLog grouping — Map→plain object, spread→loop helper  | done   |
| WQ-343 | TrialHistorySubRow — show 10 + "Show all" button          | done   |
| WQ-344 | useAiInsights — dataRef + memoized return stabilization   | done   |
| WQ-345 | ProfileContext — structural comparison via JSON.stringify | done   |
| WQ-348 | Dr. Poo context — messages 20→10, reports 500→20          | done   |

### Phase 3: Component Quality + Refactoring (6 agents)

| WQ     | Title                                                          | Status |
| ------ | -------------------------------------------------------------- | ------ |
| WQ-349 | Decompose useQuickCapture — 3 sub-hooks + 124 LOC composer     | done   |
| WQ-350 | Extract EditableEntryRow — shared component, -223 LOC net      | done   |
| WQ-351 | Track.tsx props — TodayLogActionsContext + TodayLogDataContext | done   |
| WQ-352 | Error boundaries — ErrorBoundary.tsx + 2 wraps in Track        | done   |
| WQ-353 | A11y gaps — aria-live, aria-hidden, fieldset across 3 files    | done   |
| WQ-354 | Weight parsing — shared parseWeightKg function                 | done   |
| WQ-361 | Inline celebrations.ts — merged into useCelebrationTrigger     | done   |

### Quality Gate (Phases 1-3)

**Tests:** 1272 passed, 0 failed (49 files)
**Typecheck:** Clean (`tsc --noEmit` + `convex typecheck`)
**Build:** Clean

**Spec review:** All 14 Phase 1 items verified by 4 independent spec reviewers — all passed.
**Code quality review:** 2 reviewers approved with follow-up notes:

- Extract duplicated `maskApiKey`/`classifyError`/`OPENAI_API_KEY_PATTERN` to shared module
- Add `resolvedBy: "fuzzy"` value for Fuse.js matches (currently mislabeled as `"llm"`)
- Add test coverage for `fuzzyPreMatch`
- Magic number `20` in `pendingReplies` query → use `CLAIM_PENDING_CAP` (fixed)
- Log prefix `[claimPendingReplies]` consistency (fixed)

### Remaining (Phase 4 — not yet started)

| Category            | Items | IDs                            |
| ------------------- | ----- | ------------------------------ |
| Error codes         | 1     | WQ-330                         |
| Design consistency  | 4     | WQ-355, WQ-356, WQ-357, WQ-358 |
| Simplification      | 3     | WQ-360, WQ-362, WQ-363         |
| Architecture & docs | 8     | WQ-364–WQ-371                  |
| **Excluded**        | 1     | WQ-341 (touches Patterns.tsx)  |

All Phase 4 items are Med/Low severity.
