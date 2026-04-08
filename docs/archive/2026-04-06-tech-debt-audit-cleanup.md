# PRD: Tech-Debt Audit Cleanup

> **Date:** 2026-04-06
> **Status:** Draft
> **Source:** `docs/2026-04-06/audit/FINAL-AUDIT-REPORT.md` (85 findings) + `docs/ROADMAP.md` standalone items
> **Scope:** Single initiative, 6 waves, designed for parallel sub-agent execution

---

## 1. Overview

The codebase audit of 402 files surfaced 85 findings (4 critical, 25 high, 42 moderate, 14 nice-to-have). Separately, the ROADMAP carries ~50 standalone bug/debt items accumulated over the Nutrition Card initiative. This PRD consolidates both sources into a single tech-debt cleanup initiative organized into dependency-ordered waves that maximize parallelism.

**What this is:** A mechanical and architectural cleanup pass. Every task has a clear fix described in the audit report or ROADMAP. No new features, no design decisions, no product-scope expansion.

**What this is not:** The Food Registry initiative, Dr. Poo reimagining, Patterns rework, or any feature work. Items that require product/design decisions are explicitly excluded (see Non-goals).

---

## 2. Goals

1. Eliminate all 4 CRITICAL audit findings (divergent logic, triplicated constants, broken summary, stale comments).
2. Close all HIGH-severity security and data-integrity findings (Convex determinism, cross-tenant queries, prompt injection, unbounded mutations).
3. Deduplicate shared logic into canonical utility modules, reducing copy-paste drift risk.
4. Split god files (logs.ts 2100 LOC, routeTree.tsx 434 LOC) into focused modules.
5. Cap all unbounded `.collect()` queries and add pagination guards.
6. Harden the E2E test suite (replace `waitForTimeout` with condition waits).
7. Fold applicable ROADMAP standalone items (bugs, dead code, cleanup) into the same wave structure.
8. Leave the codebase passing `bun run typecheck`, `bun run lint:fix`, `bun run build`, and all existing tests after every wave.

---

## 3. Non-goals

- **New features:** No new UI, no new Convex tables, no new pages.
- **Product/design decisions:** Items like WQ-114 (next food logic), WQ-124 (conversation redesign), WQ-129 (confidence labels), WQ-121 (desktop 3-dot menu) are excluded — they belong to future initiative PRDs.
- **Filter system rework:** WQ-132/133/134 are excluded — the Food Registry initiative replaces the filter system.
- **Toast system redesign:** WQ-115 is excluded — needs a design pass.
- **Low-priority UX polish:** WQ-174 through WQ-185 and WQ-190 are excluded — they are cosmetic and can be swept into a future polish pass.
- **Closed/resolved items:** WQ-419, WQ-422, WQ-423, WQ-425, WQ-426, WQ-427, WQ-429, WQ-430, WQ-432 are already resolved per the planning triage notes.

---

## 4. User Stories

Each wave is a user story. Tasks within a wave have no intra-wave dependencies unless noted, enabling maximum sub-agent parallelism.

---

### US-001: Wave 0 — Security & Data Integrity Hardening

**Description:** As a developer, I want all security and data-integrity vulnerabilities fixed so that the app is safe for multi-user deployment and no data corruption can occur via normal usage paths.

**Tasks:**

| ID    | Audit # | Title                                         | Files                                                                                               | Fix Summary                                                                                                                                                                |
| ----- | ------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W0-01 | #5      | Convex mutation determinism (Date.now)        | `convex/foodParsing.ts`, `convex/migrations.ts`, `convex/foodRequests.ts`, `shared/foodEvidence.ts` | Make `now` required in all mutation args. All scheduling actions pass `Date.now()`. Remove client-supplied timestamps from mutation arg schemas; compute server-side.      |
| W0-02 | #7      | Cross-tenant conversation query               | `convex/conversations.ts`, `convex/schema.ts`                                                       | Add `by_userId_aiAnalysisId` compound index. Replace `by_aiAnalysisId` query with compound index query.                                                                    |
| W0-03 | #10     | Hardcoded patient name in prompt              | `src/lib/aiAnalysis.ts`                                                                             | Replace all "Peter" references with `preferredName` variable or "the patient".                                                                                             |
| W0-04 | #11     | Prompt injection via health profile fields    | `src/lib/aiAnalysis.ts`                                                                             | Add per-field length caps (500 chars medications/supplements/allergies, 1000 chars lifestyle/dietary, 200 chars otherConditions). Apply BiDi/HTML stripping to all fields. |
| W0-05 | #75     | sanitizeNameForPrompt missing XML strip       | `src/lib/aiAnalysis.ts`                                                                             | Strip `<` and `>` from name input.                                                                                                                                         |
| W0-06 | #18     | AI error messages rendered unsanitized        | `src/components/archive/ai-insights/AnalysisProgressOverlay.tsx`, `src/hooks/useAiInsights.ts`      | Create `formatAiError()` helper. Map known error classes to user-friendly strings. Strip key-like patterns.                                                                |
| W0-07 | #19     | AI markdown rendered without rehype-sanitize  | `src/components/track/dr-poo/ConversationPanel.tsx`, `src/components/archive/DrPooReport.tsx`       | Add `rehype-sanitize` plugin. Add `MAX_AI_CONTENT_CHARS = 4000` truncation.                                                                                                |
| W0-08 | #20     | ADD_TO_STAGING bypasses portion clamp         | `src/components/track/nutrition/useNutritionStore.ts`                                               | Add `Math.min(existing.portionG + increment, MAX_PORTION_G)` in ADD_TO_STAGING case.                                                                                       |
| W0-09 | #36     | Double-submit in FoodSection & BowelSection   | `src/components/track/panels/FoodSection.tsx`, `src/components/track/panels/BowelSection.tsx`       | Use `useRef` as immediate guard. Wrap `handleSave` in `useCallback`.                                                                                                       |
| W0-10 | #34     | No input length cap on matchUnresolvedItems   | `convex/foodLlmMatching.ts`                                                                         | Add `if (args.unresolvedSegments.length > 20) throw`.                                                                                                                      |
| W0-11 | #39     | usePanelTime allows arbitrary timestamps      | `src/hooks/usePanelTime.ts`                                                                         | Clamp to 5-years-ago through tomorrow.                                                                                                                                     |
| W0-12 | #70     | Bristol code validation gap                   | `shared/foodEvidence.ts`, `shared/logDataParsers.ts`                                                | Add integer-only guard: `Number.isInteger(bristolCode) && bristolCode >= 1 && bristolCode <= 7`.                                                                           |
| W0-13 | #44     | sanitizeUnknownStringsDeep throws on oversize | `src/lib/inputSafety.ts`                                                                            | Truncate with `"...[truncated]"` suffix instead of throwing.                                                                                                               |
| W0-14 | #38     | CSP allows broad \*.vercel.app                | `vercel.json`                                                                                       | Replace with specific Clerk domains. Remove `api.openai.com` from connect-src.                                                                                             |
| W0-15 | #16     | foodCanonicalization throws on startup        | `shared/foodCanonicalization.ts`                                                                    | Log duplicate warning via `console.error` and skip instead of throwing. Add build-time test for duplicates.                                                                |
| W0-16 | #22     | Client-side rate limiter bypassable           | `src/lib/aiRateLimiter.ts`, `src/lib/habitCoaching.ts`                                              | Move rate limiting server-side to Convex action. Use per-user `lastCallAt` doc. Separate rate limit keys per AI feature. Remove dead `<= 0` branch.                        |
| W0-17 | WQ-320  | SubRow delete error handling                  | Inline `onDelete` calls in SubRow components                                                        | Add try/catch with `toast.error`.                                                                                                                                          |
| W0-18 | WQ-136  | Hardcoded "post-surgery anastomosis" 3x       | `src/lib/habitCoaching.ts`                                                                          | Parameterize from health profile `surgeryType` field.                                                                                                                      |

**Acceptance Criteria:**

- [ ] No `Date.now()` called inside any Convex mutation handler (grep verification)
- [ ] `conversations.listByReport` uses compound index scoped by userId
- [ ] No hardcoded "Peter" or personal references in any `.ts` file (grep verification)
- [ ] All free-text health profile fields have per-field length caps in prompt builder
- [ ] `sanitizeNameForPrompt` strips `<` and `>` characters
- [ ] AI error messages pass through `formatAiError()` — no raw error strings in UI
- [ ] All `react-markdown` instances rendering AI content use `rehype-sanitize`
- [ ] ADD_TO_STAGING path clamps to MAX_PORTION_G
- [ ] FoodSection and BowelSection use `useRef` guard against concurrent submit
- [ ] `matchUnresolvedItems` rejects arrays longer than 20
- [ ] `usePanelTime` rejects timestamps outside sensible range
- [ ] Bristol code 0, -1, 8, 7.5 all rejected by validation
- [ ] `sanitizeUnknownStringsDeep` truncates instead of throwing
- [ ] `vercel.json` CSP does not contain `*.vercel.app` wildcard
- [ ] `foodCanonicalization.ts` logs duplicate warning instead of crashing
- [ ] Rate limiting enforced server-side per user per AI feature type
- [ ] SubRow delete failures show toast.error
- [ ] No hardcoded "post-surgery anastomosis" strings (grep verification)
- [ ] Typecheck passes (`bun run typecheck`)
- [ ] All existing tests pass
- [ ] Build succeeds (`bun run build`)

---

### US-002: Wave 1 — Mechanical Cleanup (Dead Code, Renames, Markers)

**Description:** As a developer, I want dead code, stale markers, and inert directives removed so that the codebase only contains live, meaningful code.

**Tasks:**

| ID    | Audit # / WQ | Title                                           | Files                                                                                                                | Fix Summary                                                                                                                                                           |
| ----- | ------------ | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W1-01 | #1           | Delete inlined getCelebration duplicate         | `src/hooks/useCelebrationTrigger.ts`                                                                                 | Delete private `getCelebration`. Import from `src/lib/celebrations.ts`. Update consumer comment.                                                                      |
| W1-02 | #2           | Deduplicate tile color constants                | `src/components/track/quick-capture/constants.ts`, `QuickCaptureTile.tsx`, `DurationEntryPopover.tsx`                | Remove local definitions. Import from `constants.ts`. Export `TileColorTint` type.                                                                                    |
| W1-03 | #3           | Fix review-findings.json summary                | `scripts/ship/review-findings.json`                                                                                  | Recount findings and update summary block to match actual content.                                                                                                    |
| W1-04 | #4           | Fix DrPooReport section numbering               | `src/components/archive/DrPooReport.tsx`                                                                             | Align inline JSX comments (0-5) with doc comment. Remove gap.                                                                                                         |
| W1-05 | #28          | Remove dead exports                             | `src/components/patterns/database/foodSafetyUtils.ts`, `src/hooks/useQuickCapture.ts`, `src/hooks/useCelebration.ts` | Delete `FILTER_OPTIONS`, `FilterStatus`, `SortKey`, `SortDir`, `BRAT_KEYS`. Remove `detailDaySummaries`. Remove `SOUND_ENABLED`/`CONFETTI_ENABLED` and dead branches. |
| W1-06 | #59          | Remove "use client" directives                  | 6 files in `src/components/ui/`                                                                                      | Delete `"use client"` from date-picker, drawer, switch, tabs, toggle-group, toggle.                                                                                   |
| W1-07 | #81          | Remove identity-map verdictToStoredVerdict      | `convex/extractInsightData.ts`                                                                                       | Delete function. Use `assessment.verdict` directly.                                                                                                                   |
| W1-08 | #80          | Delete pass-through ingredientProfileProjection | `convex/ingredientProfileProjection.ts`                                                                              | Delete file. Move normalization to `ingredientProfiles.ts`. Update import sites.                                                                                      |
| W1-09 | #45          | Update stale model names                        | `convex/foodLlmMatching.ts`, `convex/foodParsing.ts`, `src/lib/aiModels.ts`, AI section component                    | Update all model constants to current names. Narrow validators. Derive UI copy from constants.                                                                        |
| W1-10 | #46          | Replace manual WriteProcessedFoodItem type      | `convex/foodParsing.ts`                                                                                              | Use `Infer<typeof foodItemValidator>`. Delete manual type.                                                                                                            |
| W1-11 | #68          | Rename ParsedFoodItem collision                 | `shared/logDataParsers.ts`                                                                                           | Rename to `ParsedLogFoodItem`. Update import sites.                                                                                                                   |
| W1-12 | #69          | Standardize review-findings severity taxonomy   | `scripts/ship/review-findings-*.json`                                                                                | Standardize to CRITICAL/HIGH/MODERATE/NICE-TO-HAVE. Archive closed findings. Delete transit-map findings for deleted code.                                            |
| W1-13 | WQ-148       | Rename streaks.ts                               | `src/lib/streaks.ts`                                                                                                 | Rename to `gamificationDefaults.ts`. Update imports.                                                                                                                  |
| W1-14 | WQ-155       | Remove work-ticket marker comments              | All files                                                                                                            | Remove `// F001:`, `// SET-F003:`, `// Bug #46`, etc.                                                                                                                 |
| W1-15 | WQ-161       | Remove registry placeholder notes               | Food registry data                                                                                                   | Replace "New entry." placeholders with clinical rationale or remove.                                                                                                  |
| W1-16 | WQ-163       | Fix stale comment in foodEvidence               | `shared/foodEvidence.ts:L180`                                                                                        | Fix or remove wrong import path comment.                                                                                                                              |
| W1-17 | WQ-153       | Remove dead FILTER_OPTIONS/SortKey/SortDir      | `src/components/patterns/database/foodSafetyUtils.ts`                                                                | Verify zero import sites. Delete exports and barrel entries.                                                                                                          |
| W1-18 | #67          | Remove barrel re-export indirection             | `shared/foodCanonicalization.ts`, `shared/foodProjection.ts`                                                         | Remove re-exports from foodCanonicalization (keep only canonicalizeKnownFoodName). Remove resolveCanonicalFoodName re-export from foodProjection.                     |

**Acceptance Criteria:**

- [ ] Only one `getCelebration` function exists in codebase (grep verification)
- [ ] `TINT_BY_PROGRESS_COLOR` and `TINT_CLASSES` each defined in exactly one file
- [ ] `review-findings.json` summary matches actual finding counts
- [ ] DrPooReport section numbers sequential 0-5 with no gaps
- [ ] No `FILTER_OPTIONS`, `SortKey`, `SortDir`, `BRAT_KEYS` exports found (grep)
- [ ] No `"use client"` directives in any `.tsx` file (grep)
- [ ] `verdictToStoredVerdict` function does not exist (grep)
- [ ] `ingredientProfileProjection.ts` file does not exist
- [ ] No references to `gpt-4.1-nano` or `gpt-4o-mini` in Convex code (grep)
- [ ] `WriteProcessedFoodItem` uses `Infer<>` derivation
- [ ] Only one `ParsedFoodItem` export exists (the one in `foodParsing.ts`)
- [ ] All review-findings files use consistent severity taxonomy
- [ ] `streaks.ts` renamed to `gamificationDefaults.ts`
- [ ] No `// F001:`, `// SET-F003:`, `// Bug #46` markers remain (grep)
- [ ] No "New entry." placeholder strings in registry data
- [ ] Stale comment at foodEvidence.ts:180 fixed
- [ ] `PortionData` importable from exactly one canonical location
- [ ] Typecheck passes
- [ ] All existing tests pass

---

### US-003: Wave 2 — Shared Utility Consolidation

**Description:** As a developer, I want duplicated utility functions consolidated into single canonical modules so that changes propagate automatically and drift is impossible.

**Depends on:** Wave 1 (some dead code removal simplifies dedup targets)

**Tasks:**

| ID    | Audit #      | Title                                       | Files                                                                                                                                                                         | Fix Summary                                                                                                                                                                                                                                  |
| ----- | ------------ | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W2-01 | #12          | Consolidate OpenAI utilities                | `convex/ai.ts`, `convex/foodLlmMatching.ts`, `convex/profiles.ts`                                                                                                             | Create `convex/lib/openai.ts` with `OPENAI_API_KEY_PATTERN`, `maskApiKey`, `classifyOpenAiHttpError`. Import everywhere. Delete locals.                                                                                                      |
| W2-02 | #14          | Consolidate coerce utilities                | `convex/logs.ts`, `convex/migrations.ts`, `convex/ingredientNutritionApi.ts`                                                                                                  | Create `convex/lib/coerce.ts` with canonical `asTrimmedString`, `asNumber`, `asStringArray`, `asRecord`. Unify `slugifyHabitName`/`slugify`. Unify `inferHabitType`/`inferHabitTypeFromName`. Delete all locals and `// SYNC WITH` comments. |
| W2-03 | #27          | Consolidate activity type normalization     | `src/hooks/useDayStats.ts`, `src/hooks/useHabitLog.ts`, `src/lib/derivedHabitLogs.ts`, `src/pages/Track.tsx`                                                                  | Create `src/lib/activityTypeUtils.ts` with single `normalizeActivityTypeKey()`. Import in all four files.                                                                                                                                    |
| W2-04 | #50          | Consolidate time constants                  | `src/components/patterns/database/columns.tsx`, `src/components/patterns/hero/BristolTrendTile.tsx`, `src/hooks/useFoodLlmMatching.ts`, `src/hooks/useUnresolvedFoodToast.ts` | Create `src/lib/timeConstants.ts` with `MS_PER_DAY`, `MS_PER_HOUR`, `SIX_HOURS_MS`. Import everywhere.                                                                                                                                       |
| W2-05 | #26          | Consolidate zone colors                     | `src/components/track/FoodMatchingModal.tsx`, `src/components/track/nutrition/NutritionCard.tsx`                                                                              | Create `src/lib/zoneColors.ts` with canonical color per zone. Resolve zone 3 red vs orange inconsistency.                                                                                                                                    |
| W2-06 | #17          | Pre-compile regex patterns                  | `shared/foodNormalize.ts`, `shared/foodMatching.ts`, `shared/foodParsing.ts`                                                                                                  | Hoist all `new RegExp(...)` calls to module-level constants. Build combined FILLER_PHRASE_PATTERN.                                                                                                                                           |
| W2-07 | #51          | Consolidate useIsMobile hook                | `src/components/settings/DeleteConfirmDrawer.tsx`                                                                                                                             | Move `useIsMobile` to `src/hooks/useMediaQuery.ts` with configurable breakpoint. Or migrate to `ResponsiveShell`.                                                                                                                            |
| W2-08 | #82          | Consolidate test factory functions          | `shared/__tests__/foodEvidence*.test.ts` (3 files)                                                                                                                            | Extract `foodLog`, `digestionLog`, `buildDailyTrialSeries` to `shared/__tests__/foodEvidenceTestHelpers.ts`.                                                                                                                                 |
| W2-09 | #54 + WQ-431 | Fix stale theme storage key                 | `src/components/theme-provider.tsx`                                                                                                                                           | Create `src/lib/storageKeys.ts`. Rename key to `"pdh-theme"`. Wrap `localStorage.getItem` in try-catch. Ensure `clearLocalData` includes this key.                                                                                           |
| W2-10 | #64          | Consolidate customFoodPresets normalization | `src/lib/customFoodPresets.ts`                                                                                                                                                | Extract `normalizePreset` helper. Named constants for magic numbers. Use `crypto.randomUUID()` for IDs.                                                                                                                                      |

**Acceptance Criteria:**

- [ ] `OPENAI_API_KEY_PATTERN` defined in exactly one file (`convex/lib/openai.ts`)
- [ ] `maskApiKey` defined in exactly one file
- [ ] `asTrimmedString`, `asNumber`, `asStringArray`, `asRecord` defined in exactly one file (`convex/lib/coerce.ts`)
- [ ] No `// SYNC WITH` comments remain (grep)
- [ ] `normalizeActivityTypeKey` defined in exactly one file (`src/lib/activityTypeUtils.ts`)
- [ ] `MS_PER_DAY` defined in exactly one file (`src/lib/timeConstants.ts`)
- [ ] `ZONE_COLORS` defined in exactly one canonical location
- [ ] No `new RegExp(...)` inside function bodies in `shared/food*.ts` (grep)
- [ ] `useIsMobile` importable from shared location
- [ ] Test factory functions importable from single helper file
- [ ] `kaka-tracker-theme` string does not appear in codebase (grep)
- [ ] `Math.random()` not used for ID generation in customFoodPresets (grep)
- [ ] Typecheck passes
- [ ] All existing tests pass

---

### US-004: Wave 3 — Architecture: File Splits & Module Boundaries

**Description:** As a developer, I want god files split into focused modules and misplaced components relocated so that the codebase is navigable and each file has a single responsibility.

**Depends on:** Wave 2 (utility consolidation must land first so split files import from canonical locations)

**Tasks:**

| ID    | Audit # / WQ | Title                                 | Files                                                                                       | Fix Summary                                                                                                                                                                                                             |
| ----- | ------------ | ------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W3-01 | #13          | Split logs.ts (2100 LOC)              | `convex/logs.ts`                                                                            | Split into: `convex/logs.ts` (log CRUD only), `convex/profileMutations.ts` (replaceProfile, patchProfile, getProfile), `convex/backup.ts` (exportBackup, importBackup, deleteAll, coerce helpers).                      |
| W3-02 | #62          | Split routeTree.tsx (434 LOC)         | `src/routeTree.tsx`                                                                         | Extract `RouteErrorBoundary`, `AuthLoadingFallback`, `GlobalHeader` into `src/components/layout/`. Keep only route definitions.                                                                                         |
| W3-03 | #29          | Split SmartViews.tsx                  | `src/components/patterns/database/SmartViews.tsx`, `FilterSheet.tsx`                        | Move normalisation, equality, row-matching, row-counting functions and constants to `smartViewUtils.ts`. Define `SORT_OPTIONS` once.                                                                                    |
| W3-04 | #52          | Relocate Dr Poo components            | `src/components/archive/DrPooReport.tsx`, `MealIdeaCard.tsx`, `AnalysisProgressOverlay.tsx` | Move to `src/components/dr-poo/`. Add `MealIdeaCard` to barrel file. Update all import sites.                                                                                                                           |
| W3-05 | #63          | Extract store configuration constants | `src/store.ts`                                                                              | Move `DEFAULT_FLUID_PRESETS`, `MAX_FLUID_PRESETS`, `BLOCKED_FLUID_PRESET_NAMES` to `src/lib/fluidPresets.ts`. Move `DEFAULT_HEALTH_PROFILE` to `domain.ts`. Replace `createLogTypeGuard` factory with direct functions. |
| W3-06 | WQ-107       | Split LogEntry.tsx (741 LOC)          | `src/components/track/today-log/LogEntry.tsx`                                               | Delegate log-type editing to existing SubRow components.                                                                                                                                                                |
| W3-07 | WQ-108       | Split aiAnalysis.ts (2225 LOC)        | `src/lib/aiAnalysis.ts`                                                                     | Split into `aiPrompts.ts`, `aiParsing.ts`, `aiFetchInsights.ts`. (Note: WQ-193 buildUserMessage 15-param refactor fits here.)                                                                                           |

**Acceptance Criteria:**

- [ ] `convex/logs.ts` is under 800 lines (log CRUD only)
- [ ] `convex/profileMutations.ts` exists with profile mutations
- [ ] `convex/backup.ts` exists with backup operations
- [ ] `src/routeTree.tsx` is under 150 lines (route definitions only)
- [ ] `RouteErrorBoundary`, `AuthLoadingFallback`, `GlobalHeader` live in `src/components/layout/`
- [ ] `SmartViews.tsx` contains only the React component
- [ ] Dr Poo components live in `src/components/dr-poo/`
- [ ] `src/store.ts` exports only Zustand store state and actions
- [ ] `LogEntry.tsx` is under 400 lines
- [ ] `aiAnalysis.ts` is split into 3+ focused modules
- [ ] `buildUserMessage` uses an options object instead of 15 positional params
- [ ] All existing import paths updated (no broken imports)
- [ ] Typecheck passes
- [ ] All existing tests pass
- [ ] Build succeeds

---

### US-005: Wave 4 — Performance & Scalability

**Description:** As a developer, I want all unbounded queries capped, expensive computations optimized, and client bundle size reduced so that the app performs well for active users with months of data.

**Tasks:**

| ID    | Audit # / WQ | Title                                           | Files                                                                                            | Fix Summary                                                                                                                                                     |
| ----- | ------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W4-01 | #6           | importBackup unbounded + data loss risk         | `convex/logs.ts` (or `convex/backup.ts` after W3-01)                                             | Add array length caps per table (max 10,000). Split import into chunked mutations via `ctx.scheduler.runAfter`. Add client-side validation pass on `data.logs`. |
| W4-02 | #9           | exportBackup parallel full-table collects       | `convex/logs.ts` (or `convex/backup.ts`)                                                         | Add per-table row caps (10,000). Paginate for large datasets. Consider converting to action.                                                                    |
| W4-03 | #15          | buildFoodEvidenceResult O(T x E) loop           | `shared/foodEvidence.ts`                                                                         | Cap `args.logs` to 2,000 entries. Change `findTriggerCorrelations` to O(T+E) two-pointer.                                                                       |
| W4-04 | #21          | conversations.listByDateRange unbounded         | `convex/conversations.ts`                                                                        | Add `limit` argument. Apply `.take(limit)` before `.collect()`. Default 500.                                                                                    |
| W4-05 | #24          | FoodMatchingModal cold-open 160-item query      | `src/components/track/FoodMatchingModal.tsx`                                                     | Use `"skip"` for initial no-query state. Fire query only after 1+ character typed or bucket selected.                                                           |
| W4-06 | #25          | FoodFilterView double frequency scan            | `src/components/track/nutrition/FoodFilterView.tsx`                                              | Merge two `useMemo` blocks into single `frequencyData` memo.                                                                                                    |
| W4-07 | #30          | Unbounded .collect() on growing tables          | `convex/aggregateQueries.ts`, `convex/ingredientExposures.ts`, `convex/foodAssessments.ts`, etc. | Add `.take()` caps with warning logs. Add `isTruncated` flags.                                                                                                  |
| W4-08 | #31          | mergeDuplicates unbounded transaction           | `convex/foodLibrary.ts`                                                                          | Break into phased internal mutations via action orchestration. Add row-count caps.                                                                              |
| W4-09 | #33          | listFoodEmbeddings fetches full vectors         | `convex/foodParsing.ts`                                                                          | Store staleness metadata in separate `foodEmbeddingMeta` table (canonicalName + embeddingSourceHash only).                                                      |
| W4-10 | #35          | RelativeTime per-row setInterval                | `src/components/patterns/database/columns.tsx`                                                   | Replace with global `useCurrentMinute()` hook. Move `formatRelativeTime` to `src/lib/dateUtils.ts`.                                                             |
| W4-11 | #41          | ProfileContext JSON.stringify per render        | `src/contexts/ProfileContext.tsx`                                                                | Replace deep comparison with shallow field-by-field check. Replace 10-field manual spread with `Object.fromEntries` filter.                                     |
| W4-12 | #42          | FOOD_REGISTRY 4381 lines in client bundle       | `shared/foodRegistryData.ts`                                                                     | Create `ClientFoodRegistryEntry` projection omitting `digestion` metadata. Serve full registry server-side only.                                                |
| W4-13 | #43          | Pretty-printed JSON in AI payloads              | `src/lib/aiAnalysis.ts`                                                                          | Use `JSON.stringify(payload)` (no indentation).                                                                                                                 |
| W4-14 | #65          | Backup export pretty-printed JSON               | `src/components/settings/app-data-form/useAppDataFormController.ts`                              | Use `JSON.stringify(backup)` (no indentation). Warn before large exports.                                                                                       |
| W4-15 | #66          | Patterns.tsx localStorage no debounce           | `src/pages/Patterns.tsx`                                                                         | Debounce `localStorage` writes (300ms). Replace `as` casts with runtime validation.                                                                             |
| W4-16 | #71          | Confetti onComplete re-trigger                  | `src/components/ui/Confetti.tsx`                                                                 | Use `useRef` to hold callback, remove from effect deps.                                                                                                         |
| W4-17 | #84          | CalendarDayButton getDefaultClassNames per cell | `src/components/ui/calendar.tsx`                                                                 | Hoist to module scope: `const DEFAULT_CLASS_NAMES = getDefaultClassNames()`.                                                                                    |
| W4-18 | WQ-090       | TrackPage eagerly imported                      | `src/routeTree.tsx`                                                                              | Add `lazy()` import for TrackPage like all other pages.                                                                                                         |

**Acceptance Criteria:**

- [ ] `importBackup` validator has per-table array length caps
- [ ] Import is chunked — partial failure does not lose all user data
- [ ] `exportBackup` has per-table row caps (10,000)
- [ ] `buildFoodEvidenceResult` caps input logs at 2,000
- [ ] `findTriggerCorrelations` uses two-pointer (O(T+E))
- [ ] `listByDateRange` accepts and enforces a `limit` argument
- [ ] FoodMatchingModal uses `"skip"` on cold open
- [ ] FoodFilterView has single frequency memo (not two)
- [ ] All `aggregateQueries`, `ingredientExposures`, `foodAssessments` queries have `.take()` caps
- [ ] `mergeDuplicates` broken into phased mutations
- [ ] `listFoodEmbeddings` staleness check does not read embedding vectors
- [ ] No `setInterval` inside `RelativeTime` cell renderer (grep)
- [ ] ProfileContext does not call `JSON.stringify` for comparison
- [ ] Client bundle does not include `digestion` metadata from food registry
- [ ] No `JSON.stringify(..., null, 2)` in AI payload or backup export paths
- [ ] Patterns.tsx localStorage writes debounced
- [ ] Confetti `onComplete` held in ref
- [ ] CalendarDayButton `getDefaultClassNames` called at module scope
- [ ] TrackPage uses `lazy()` import
- [ ] Typecheck passes
- [ ] All existing tests pass
- [ ] Build succeeds

---

### US-006: Wave 5 — Correctness, Quality & Test Hardening

**Description:** As a developer, I want state management bugs fixed, loading states surfaced, and E2E tests stabilized so that the app behaves correctly and the test suite is reliable.

**Tasks:**

| ID    | Audit # / WQ | Title                                           | Files                                                                      | Fix Summary                                                                                                                                                       |
| ----- | ------------ | ----------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W5-01 | #23          | E2E waitForTimeout → condition waits            | All `e2e/*.spec.ts` files                                                  | Replace all `page.waitForTimeout(N)` with `expect(element).toBeVisible({ timeout: 8000 })`. Extract shared page objects to `e2e/fixtures.ts`. Remove retry loops. |
| W5-02 | #32          | getWeekStart non-deterministic timezone         | `convex/computeAggregates.ts`, `convex/aggregateQueries.ts`                | Replace with pure epoch arithmetic. Move to `shared/`. Export for client+server use.                                                                              |
| W5-03 | #37          | Hardcoded en-GB locale                          | `src/hooks/useWeeklySummaryAutoTrigger.ts`                                 | Use `Intl.DateTimeFormat` with user locale or ISO 8601. Remove Barcelona reference.                                                                               |
| W5-04 | #40          | Auto-trigger stale across period boundary       | `src/hooks/useWeeklySummaryAutoTrigger.ts`                                 | Replace empty-dep `useMemo` with state variable updated via `setTimeout` or `visibilitychange`.                                                                   |
| W5-05 | #47          | weeklySummaries.add missing promptVersion       | `convex/weeklySummaries.ts`                                                | Add `promptVersion` to mutation args, or add schema comment explaining backup-only population.                                                                    |
| W5-06 | #48          | testFixtures.ts manual typing                   | `convex/testFixtures.ts`                                                   | Type using `Infer<typeof aiInsightValidator>`. Use `Object.freeze()` or factory function.                                                                         |
| W5-07 | #49          | Inconsistent day-boundary strategies            | `src/components/patterns/hero/BristolTrendTile.tsx`, `BmFrequencyTile.tsx` | Standardize on calendar midnight. Extract `getCutoffTimestamp`. Accept `nowMs` prop. Combine chained memos.                                                       |
| W5-08 | #53          | BowelSection 7+ useState calls                  | `src/components/track/panels/BowelSection.tsx`                             | Introduce `BowelFormDraft` state object with single `useState` and `resetDraft` helper.                                                                           |
| W5-09 | #55          | CalorieDetailView deletes whole log             | `src/components/track/nutrition/CalorieDetailView.tsx`                     | Add assertion that staged logs contain exactly one item. Add explanatory comment.                                                                                 |
| W5-10 | #56          | Broad as unknown as FoodLog cast                | `src/components/track/today-log/grouping.ts`                               | Define `FoodPipelineLog = FoodLog \| LiquidLog` union. Use `isFoodPipelineType` to narrow.                                                                        |
| W5-11 | #57          | responsive-shell divergent flex classes         | `src/components/ui/responsive-shell.tsx`                                   | Change mobile `shrink-0` to `flex-1`. Remove SSR guards.                                                                                                          |
| W5-12 | #58          | PopoverTitle typed as h2 rendered as div        | `src/components/ui/popover.tsx`                                            | Change to `<h2>` element (preferred for accessibility).                                                                                                           |
| W5-13 | #60          | SyncedLogsContext hides loading state           | `src/contexts/SyncedLogsContext.tsx`                                       | Expose `isLoading` field alongside `logs`.                                                                                                                        |
| W5-14 | #61          | sounds.ts AudioContext race condition           | `src/lib/sounds.ts`                                                        | Extract `scheduleNotes` helper. Chain from `ctx.resume().then(...)`.                                                                                              |
| W5-15 | #83          | Nested ternary chains                           | Multiple files (WeightSubRow, TodayLog, LifestyleSection, etc.)            | Replace with switch/if-else/lookup objects per CLAUDE.md standard.                                                                                                |
| W5-16 | #85          | Duplicated section-header & alertdialog         | Settings components                                                        | Extend `CollapsibleSectionHeader` with `color` prop. Extract `InlineConfirmation` component.                                                                      |
| W5-17 | WQ-191       | Locale-dependent formatTime                     | `src/lib/aiAnalysis.ts` (or split files)                                   | Use deterministic formatter (ISO 8601 or explicit locale).                                                                                                        |
| W5-18 | WQ-192       | getDaysPostOp uses new Date()                   | AI analysis code                                                           | Accept `now` parameter. Compute once and pass through.                                                                                                            |
| W5-19 | WQ-194       | WeeklyContext/WeeklyDigestInput duplicate types | AI analysis code                                                           | Merge into single type.                                                                                                                                           |
| W5-20 | WQ-196       | fetchWeeklySummary no model validation          | AI analysis code                                                           | Call `getValidInsightModel(model)` before use.                                                                                                                    |
| W5-21 | WQ-113       | BM count data wrong                             | Hero section                                                               | Runtime verification of BM count data.                                                                                                                            |
| W5-22 | WQ-118       | Weight target save bug                          | Weight settings                                                            | Fix: accept integer input (e.g. "180") without requiring decimal or Enter/Tab.                                                                                    |
| W5-23 | WQ-435       | Sleep/Weight two-click open                     | Quick capture buttons                                                      | Fix: open drawer on first click.                                                                                                                                  |
| W5-24 | WQ-428       | Add unauthenticated app-load E2E                | `e2e/`                                                                     | Add E2E test verifying unauthenticated `/` flow.                                                                                                                  |
| W5-25 | WQ-186       | Duplicate timestamp on expand                   | Today log                                                                  | Remove duplicate timestamp display.                                                                                                                               |
| W5-26 | WQ-187       | Cigarettes duplicate subrows                    | Today log                                                                  | Fix duplicate entry rendering.                                                                                                                                    |
| W5-27 | WQ-188       | Sleep expand repeats label                      | Today log                                                                  | Remove duplicate label.                                                                                                                                           |
| W5-28 | WQ-189       | Activity rows split label/time                  | Today log                                                                  | Fix layout to keep label and time together.                                                                                                                       |
| W5-29 | WQ-433       | Count food pipeline liquids toward fluids       | Track page fluid tracking                                                  | Identify liquid food items (registry flag or unit=ml) and count toward total fluid intake.                                                                        |
| W5-30 | WQ-434       | Aquarius portion/calorie data wrong             | Food registry                                                              | Correct electrolyte drink entry. Log liquid foods in ml not grams.                                                                                                |

**Acceptance Criteria:**

- [ ] Zero `page.waitForTimeout` calls in E2E specs (grep verification)
- [ ] Shared page objects extracted to `e2e/fixtures.ts` or `e2e/pages/`
- [ ] `getWeekStart` is a pure function in `shared/` used by both client and server
- [ ] No hardcoded `"en-GB"` locale strings (grep)
- [ ] Weekly auto-trigger recalculates bounds on period boundary crossing
- [ ] `weeklySummaries.add` args include `promptVersion` or schema has comment
- [ ] Test fixtures use `Infer<>` types and `Object.freeze()`
- [ ] BristolTrendTile and BmFrequencyTile use same day-boundary strategy
- [ ] BowelSection uses single `useState<BowelFormDraft>`
- [ ] CalorieDetailView has item-count assertion
- [ ] `grouping.ts` uses `FoodPipelineLog` union (no `as unknown as` cast)
- [ ] Responsive shell mobile uses `flex-1`; no SSR guards
- [ ] PopoverTitle renders as `<h2>`
- [ ] SyncedLogsContext exposes `isLoading`
- [ ] `sounds.ts` awaits `ctx.resume()` before scheduling notes
- [ ] No nested ternary chains in listed files
- [ ] `CollapsibleSectionHeader` accepts `color` prop
- [ ] formatTime uses deterministic formatting
- [ ] `getDaysPostOp` accepts `now` parameter
- [ ] WeeklyContext and WeeklyDigestInput merged
- [ ] `fetchWeeklySummary` validates model
- [ ] BM count data verified correct at runtime
- [ ] Weight target accepts integer input like "180"
- [ ] Sleep/Weight open on first click
- [ ] E2E test for unauthenticated `/` flow exists and passes
- [ ] Duplicate timestamp, subrow, and label bugs fixed in today log
- [ ] Liquid food items counted toward total fluid intake
- [ ] Aquarius/electrolyte drink registry entry corrected
- [ ] Typecheck passes
- [ ] All existing tests pass
- [ ] Build succeeds

---

### US-007: Wave 6 — Remaining Debt & Hardening

**Description:** As a developer, I want the remaining moderate/nice-to-have items cleaned up so that no known debt carries forward into the next feature initiative. For the final pass on this private app, Wave 6 is scoped to runtime, installability, and correctness work that still matters for a personally deployed phone build; public-launch compliance/editorial tasks are explicitly deferred.

**Depends on:** Waves 0-5 complete

**Tasks:**

| ID    | Audit # / WQ    | Title                                    | Files                                                                 | Fix Summary                                                                                                   |
| ----- | --------------- | ---------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| W6-01 | #8              | Replace BYOK with app-owned OpenAI secret | `convex/ai.ts`, `convex/foodLlmMatching.ts`, AI UI/hooks               | Remove client key storage and `apiKey` args. Read `OPENAI_API_KEY` only from Convex env and update UI copy.   |
| W6-02 | #72             | Legacy BYOK hardening superseded         | `convex/lib/apiKeys.ts`                                               | Runtime no longer uses BYOK; keep legacy helpers out of the active path and defer full removal.              |
| W6-03 | #73             | Meta CSP fallback deferred               | `index.html`                                                          | Header CSP on the private Vercel deployment is sufficient; revisit meta fallback for alternate/public hosting. |
| W6-04 | #74             | AI configuration copy matches reality    | `ArtificialIntelligenceSection.tsx`, `CloudProfileSection.tsx`        | Explain deployment-level secret storage consistently across both sections.                                     |
| W6-05 | #76             | Archive keyboard listener no focus guard | `src/pages/secondary_pages/Archive.tsx`                               | Add guard: ignore events when focus is on INPUT/TEXTAREA/SELECT.                                              |
| W6-06 | #77             | useBaselineAverages timer leak           | `src/hooks/useBaselineAverages.ts`                                    | Always return cleanup function from early return path.                                                        |
| W6-07 | #78             | Privacy Policy TODO re-scoped            | `CloudProfileSection.tsx`                                             | Mark as future public-launch work, not a private-app Wave 6 blocker.                                         |
| W6-08 | #79             | DatePicker uncontrolled demo             | `src/components/ui/date-picker.tsx`                                   | Convert to controlled component with `value`/`onSelect` props, or delete if unused.                           |
| W6-09 | WQ-111 + WQ-122 | BM layout: time before notes, 8-col grid | BowelSection / BM display components                                  | Move time before notes. Implement 8-col grid.                                                                 |
| W6-10 | WQ-131          | Drawer overlay click-through             | Drawer/sheet components                                               | Prevent clicks on overlay from reaching underlying cards.                                                     |
| W6-11 | WQ-150          | toLegacyFoodStatus assessment            | `src/lib/analysis.ts`                                                 | Verify if removable. If still live downstream, add comment. If dead, delete.                                  |
| W6-12 | WQ-151          | columns stale export assessment          | Patterns/database columns                                             | Confirm whether a stale snapshot exists; if not, close the finding as not applicable.                         |
| W6-13 | WQ-162          | Zone-change notes clinical rationale     | Food registry data                                                    | Defer editorial clinical rationale to future domain review instead of blocking Wave 6.                        |
| W6-14 | WQ-198          | Legacy activity sleep readers            | Legacy code paths                                                     | Audit which code paths still read sleep from legacy records. Clean up or add migration.                       |
| W6-15 | WQ-420          | Confirm no missing PWA screenshots       | `vite.config.ts`, `public/`                                           | Verify the manifest does not reference deleted screenshot assets.                                             |
| W6-16 | WQ-421          | Restore installable 512px icon           | `public/icons/`                                                       | Create or restore `icon-384x384.png` and `icon-512x512.png`.                                                  |
| W6-17 | WQ-424          | Precache image assets                    | `vite.config.ts`                                                      | Add png/webp/jpg to Workbox `globPatterns`.                                                                   |

**Acceptance Criteria:**

- [ ] AI uses an app-owned OpenAI secret instead of BYOK
- [ ] No production AI flow depends on BYOK decoding or user-supplied OpenAI keys
- [ ] Private deployment is not blocked on alternate-hosting CSP fallback
- [ ] AI configuration copy matches actual deployment-level storage mechanism
- [ ] Archive keyboard listener ignores events on input elements
- [ ] `useBaselineAverages` always returns cleanup function
- [ ] Privacy Policy note is scoped to future public launch, not private deployment
- [ ] DatePicker is either controlled or deleted
- [ ] BM layout shows time before notes
- [ ] Drawer overlay does not pass clicks through
- [ ] `toLegacyFoodStatus` verified live or removed
- [ ] Columns assessment confirms no stale exported snapshot cleanup is required
- [ ] Legacy sleep readers are either documented or removed
- [ ] Manifest has no missing screenshot references and installable icons are present in build output
- [ ] Workbox `globPatterns` includes image extensions
- [ ] Typecheck passes
- [ ] Build succeeds

---

## 5. Functional Requirements

### FR-01: Wave Independence

Each wave's tasks are internally parallelizable (no intra-wave dependencies) unless explicitly noted. Sub-agents can work on any task within a wave concurrently.

### FR-02: Wave Ordering

| Wave | Depends On | Rationale                                                                     |
| ---- | ---------- | ----------------------------------------------------------------------------- |
| 0    | None       | Security fixes are highest priority and touch isolated code paths             |
| 1    | None       | Mechanical cleanup is independent of security work                            |
| 2    | 1          | Utility consolidation is easier after dead code is removed                    |
| 3    | 2          | File splits should import from canonical utilities                            |
| 4    | 0, 2       | Performance fixes may touch security-hardened code and consolidated utilities |
| 5    | 0, 2, 3    | Correctness fixes span split files and need canonical utilities               |
| 6    | 0-5        | Remaining items are lowest priority                                           |

**Waves 0 and 1 can run in parallel.** Waves 2-6 are sequential.

### FR-03: Verification Gate Per Wave

After each wave completes, before proceeding to the next:

```bash
bun run typecheck
bun run lint:fix
bun run build
bun run test
```

All four must pass. Any failures are fixed within the same wave before advancing.

### FR-04: No New Tables, No New Features

Per CLAUDE.md and the `feedback_no_new_tables.md` memory: extend existing tables only. The one exception is `foodEmbeddingMeta` (W4-09) which stores a projection of existing data for performance — discuss with user before implementing.

---

## 6. Design Considerations

- **No UI changes** except bug fixes (duplicate timestamps, layout fixes, click-through prevention).
- **No new components** — only extract/relocate existing ones.
- **Design system discipline** preserved — no new color tokens, only consolidation of existing duplicates.

---

## 7. Technical Considerations

### Convex Schema Changes

- **W0-02:** New compound index `by_userId_aiAnalysisId` on `conversations` table.
- **W4-09:** Potentially new `foodEmbeddingMeta` table (needs user approval per FR-04).

### Import Path Updates

Waves 2-4 involve significant file moves and renames. Each sub-agent must update all import sites and verify with `bun run typecheck`.

### E2E Test Changes (W5-01)

This is the highest-risk task — replacing timing-based waits with condition waits across 10+ spec files. Run the full E2E suite after each spec file is updated, not as a batch.

### Biome Formatting

Per CLAUDE.md: "Biome auto-fix can aggressively reformat newly-scoped files." After file splits (Wave 3), review Biome changes before committing.

---

## 8. Success Metrics

| Metric                                   | Before | Target                      |
| ---------------------------------------- | ------ | --------------------------- |
| Critical audit findings                  | 4      | 0                           |
| High audit findings                      | 25     | 0                           |
| Moderate audit findings                  | 42     | 0                           |
| Nice-to-have audit findings              | 14     | 0                           |
| Open ROADMAP standalone items (in scope) | ~40    | 0                           |
| `convex/logs.ts` LOC                     | 2,100  | < 800                       |
| `src/lib/aiAnalysis.ts` LOC              | 2,225  | < 800 (split into 3+ files) |
| `src/routeTree.tsx` LOC                  | 434    | < 150                       |
| `page.waitForTimeout` calls in E2E       | ~50    | 0                           |
| Duplicate utility definitions            | 15+    | 0                           |
| Typecheck                                | Pass   | Pass                        |
| Build                                    | Pass   | Pass                        |
| Test suite                               | Pass   | Pass                        |

---

## 9. Open Questions

1. **W4-09 (foodEmbeddingMeta table):** This is the only item that may require a new Convex table. Should we proceed with a projection table, or find an alternative that extends the existing `foodEmbeddings` table?

2. **W6-13 (Zone-change clinical rationale):** If this app ever needs publication-ready food-registry copy, handle it as a separate editorial/domain-review task rather than as cleanup debt.

3. **Wave 0+1 parallel execution:** Both are large waves with no dependencies. Should we run them simultaneously (faster) or sequentially (easier to review)?

4. **W5-29 (liquid food identification):** What is the correct mechanism for identifying liquid foods — a registry flag, subcategory check, or unit=ml? This borders on product design.

---

## Appendix A: ROADMAP Items Excluded From This PRD

These items require product/design decisions and belong in future initiative PRDs:

| WQ ID      | Title                           | Reason Excluded                           |
| ---------- | ------------------------------- | ----------------------------------------- |
| WQ-114     | Next food logic                 | Feature work, depends on food safety grid |
| WQ-115     | Toast notifications weak        | Design decision needed                    |
| WQ-121     | Desktop long-press 3-dot menu   | Feature work                              |
| WQ-123     | Conversation markdown hierarchy | Design decision needed                    |
| WQ-124     | Conversation card redesign      | Feature work                              |
| WQ-128     | Date header duplication         | Design decision needed                    |
| WQ-129     | Safe foods confidence labels    | Feature work                              |
| WQ-130     | Amber dot not intuitive         | Design decision needed                    |
| WQ-132     | Filter toggle system color      | Superseded by Food Registry initiative    |
| WQ-133     | Food DB filter clearing         | Superseded by Food Registry initiative    |
| WQ-134     | Filter sheet double-open        | Superseded by Food Registry initiative    |
| WQ-135     | Trial history not wired         | Feature work                              |
| WQ-174-185 | Low-priority UX bugs            | Cosmetic polish, future sweep             |
| WQ-190     | Tea quick capture missing unit  | Cosmetic polish                           |

## Appendix B: ROADMAP Items Already Resolved

Per planning triage notes (2026-04-06), these are already fixed on current branch:

| WQ ID  | Title                                            |
| ------ | ------------------------------------------------ |
| WQ-419 | Placeholder CSP domain removed                   |
| WQ-422 | unsafe-inline documented with accepted-risk note |
| WQ-423 | Microphone policy already opened                 |
| WQ-425 | dotenv moved to devDependencies                  |
| WQ-426 | next-themes removed                              |
| WQ-427 | Transit-map gitignore cleaned                    |
| WQ-429 | Document title updated                           |
| WQ-430 | Package name lowercased                          |
| WQ-432 | Playwright ignores simplified                    |

## Appendix C: Cross-Reference — Audit Finding to Task ID

| Audit # | Task ID | Wave |
| ------- | ------- | ---- |
| 1       | W1-01   | 1    |
| 2       | W1-02   | 1    |
| 3       | W1-03   | 1    |
| 4       | W1-04   | 1    |
| 5       | W0-01   | 0    |
| 6       | W4-01   | 4    |
| 7       | W0-02   | 0    |
| 8       | W6-01   | 6    |
| 9       | W4-02   | 4    |
| 10      | W0-03   | 0    |
| 11      | W0-04   | 0    |
| 12      | W2-01   | 2    |
| 13      | W3-01   | 3    |
| 14      | W2-02   | 2    |
| 15      | W4-03   | 4    |
| 16      | W0-15   | 0    |
| 17      | W2-06   | 2    |
| 18      | W0-06   | 0    |
| 19      | W0-07   | 0    |
| 20      | W0-08   | 0    |
| 21      | W4-04   | 4    |
| 22      | W0-16   | 0    |
| 23      | W5-01   | 5    |
| 24      | W4-05   | 4    |
| 25      | W4-06   | 4    |
| 26      | W2-05   | 2    |
| 27      | W2-03   | 2    |
| 28      | W1-05   | 1    |
| 29      | W3-03   | 3    |
| 30      | W4-07   | 4    |
| 31      | W4-08   | 4    |
| 32      | W5-02   | 5    |
| 33      | W4-09   | 4    |
| 34      | W0-10   | 0    |
| 35      | W4-10   | 4    |
| 36      | W0-09   | 0    |
| 37      | W5-03   | 5    |
| 38      | W0-14   | 0    |
| 39      | W0-11   | 0    |
| 40      | W5-04   | 5    |
| 41      | W4-11   | 4    |
| 42      | W4-12   | 4    |
| 43      | W4-13   | 4    |
| 44      | W0-13   | 0    |
| 45      | W1-09   | 1    |
| 46      | W1-10   | 1    |
| 47      | W5-05   | 5    |
| 48      | W5-06   | 5    |
| 49      | W5-07   | 5    |
| 50      | W2-04   | 2    |
| 51      | W2-07   | 2    |
| 52      | W3-04   | 3    |
| 53      | W5-08   | 5    |
| 54      | W2-09   | 2    |
| 55      | W5-09   | 5    |
| 56      | W5-10   | 5    |
| 57      | W5-11   | 5    |
| 58      | W5-12   | 5    |
| 59      | W1-06   | 1    |
| 60      | W5-13   | 5    |
| 61      | W5-14   | 5    |
| 62      | W3-02   | 3    |
| 63      | W3-05   | 3    |
| 64      | W2-10   | 2    |
| 65      | W4-14   | 4    |
| 66      | W4-15   | 4    |
| 67      | W1-18   | 1    |
| 68      | W1-11   | 1    |
| 69      | W1-12   | 1    |
| 70      | W0-12   | 0    |
| 71      | W4-16   | 4    |
| 72      | W6-02   | 6    |
| 73      | W6-03   | 6    |
| 74      | W6-04   | 6    |
| 75      | W0-05   | 0    |
| 76      | W6-05   | 6    |
| 77      | W6-06   | 6    |
| 78      | W6-07   | 6    |
| 79      | W6-08   | 6    |
| 80      | W1-08   | 1    |
| 81      | W1-07   | 1    |
| 82      | W2-08   | 2    |
| 83      | W5-15   | 5    |
| 84      | W4-17   | 4    |
| 85      | W5-16   | 5    |
