# Consolidated Codebase Audit — 2026-02-28

**Scope:** 147 source files in `src/` (19,408 lines of component code)
**Reports consolidated:** 8 parallel audits covering imports/exports, shared code, complexity, duplication, dead code, simplification, backwards compatibility, and TODOs
**Raw findings across all reports:** ~211
**Deduplicated unique findings:** 106

---

## Executive Summary

The codebase is functionally solid — zero `@ts-ignore`, zero `@ts-expect-error`, zero commented-out code, zero empty handlers, and only one lint suppression (well-justified). The architecture (local-first Zustand + Convex sync, Clerk auth, AI analysis) is sound. However, rapid feature development has left significant technical debt in three areas:

### The Big Three Problems

1. **God components:** `TodayLog.tsx` (3,149 lines, 16% of all component code) and `Track.tsx` (832 lines) together account for 20% of the codebase. TodayLog contains 15+ sub-components, 8 type definitions, and 170 lines of grouping logic in a single file.

2. **`data: any` on LogEntry:** The core `LogEntry.data` field is typed as `any` — a deliberate compromise for `aiAnalysis.ts` compatibility. This single decision cascades into ~25 downstream `any` usages across the codebase, defeating TypeScript's value proposition on the most important data type.

3. **Code duplication and scattering:** 10+ functions are duplicated across files (bristol mapping, habit counts, caffeine detection, weight conversion, episode normalization, error extraction). Constants like `2.20462` appear as raw literals in 10+ locations across 5 files.

### Cascade Analysis — Highest-Impact Fixes

| Fix                                              | Effort  | Findings Resolved                          | Files Touched |
| ------------------------------------------------ | ------- | ------------------------------------------ | ------------- |
| Type `LogEntry.data` properly                    | Large   | ~25 downstream `any` usages                | 8-10 files    |
| Decompose TodayLog.tsx                           | Large   | Complexity + duplication + compat findings | 1 → 20+ files |
| Extract shared utils (bristol, episodes, weight) | Small   | 8 duplication findings                     | 10+ files     |
| Remove deprecated habit filtering                | Small   | 13 filter call sites removed               | 2 files       |
| Restructure store migration                      | Medium  | 6 backwards-compat findings                | 1 file        |

### Resource Plan

106 unique findings at current team capacity (Claude Code sessions + Codex + Warp + you):

- **Phase 1 — Quick wins (40 findings):** Dead code deletion, export cleanup, constant extraction, duplicate removal. Parallelizable across 6-8 agents. ~1 session.
- **Phase 2 — Structural fixes (35 findings):** Component decomposition, hook extraction, store migration restructuring. Sequential dependencies. ~2-3 sessions.
- **Phase 3 — Type safety + compat removal (20 findings):** `data: any` refactor, Convex data verification, backwards-compat removal. Requires data verification first. ~2 sessions.
- **Phase 4 — Polish (11 findings):** Base UI migration, console.log cleanup, minor simplifications. Low priority. Ongoing.

---

## Files Marked for Possible Deletion

| File                                      | Lines | Status      | Notes                                                                                  |

| ------------------------------------------| ----- | ----------  | -------------------------------------------------------------------------------------- |
| `src/components/track/WeightTrendCard.tsx`| 115   | **COMPARE** | Superseded by `WeightTracker` in patterns/. Contains duplicate `formatWeight`.         |
| `src/lib/errors.ts`                       | 5     | **IMPL**    | `getErrorMessage` never imported. BUT adopt it first -see F-28, then it becomes alive. |
| `src/components/DailyProgress.tsx`        | ~80   | **VERIFY**  | May not be rendered anywhere. Track.tsx uses QuickCapture. Verify before deleting.     |

---

## Master Finding Table

Each finding appears exactly once. Where an issue was flagged by multiple reports, all source report IDs are listed. Findings are ranked by severity, then by estimated impact.

### CRITICAL (3 findings)

| ID   | Finding                                                   | Files    | Impact                                            | Source Reports   |
| ---- | ----------------------------------------------------------|----------| ------------------------------------------------- | ---------------- |
| F-01 | **TodayLog.tsx is a 3,149-line god component** — 15+ sub-components, 8 type definitions, 170-line grouping function, 20+ useState hooks in LogEntry, duplicated edit/save/delete patterns across 7 sub-row and 7 group-row components| `TodayLog.tsx`| Very High — 16% of all component code in one file | 03-C-01|
| F-02 | **Track.tsx is an 832-line page mixing 5+ concerns** — inline business logic (bristolToConsistency, normalizeEpisodes, computeTodayHabitCounts), food parsing orchestration (5 functions), 100-line celebration/cap callback, 12+ useState, 10+ useMemo| `Track.tsx`| Very High — central orchestrator for all tracking | 03-C-02, 06-S-02 |
| F-03 | **inputSafety.ts has diverged between src/ and convex/** — both share same regex and normalization but the Convex version has grown additional helpers (assertMaxLength, sanitizeRequiredText, INPUT_SAFETY_LIMITS) and tracks path names in deep sanitization. Security fix on one side may not propagate. | `src/lib/inputSafety.ts`, `convex/lib/inputSafety.ts` | High — security divergence risk| 04-DUP-01|

### HIGH (25 findings)

| ID   | Finding                     | Files           | Impact                               | Source Reports                               |
| ---- | --------------------------- | --------------- | ------------------------------------ | -------------------------------------------- |
| F-04 | **`data: any` on LogEntry and SyncedLog** — deliberately typed as `any` for aiAnalysis.ts compatibility. The discriminated union `LogEntryData` exists but isn't used. Cascades to ~25 downstream `any` usages.| `store.ts:310`, `sync.ts:15`| Very High — fixes ~25 findings| 07-F8, 08-H-01|
| F-05 | **completely dead files** (~570 lines) — WeightTrendCard, errors.ts (see deletion table)  | 9 files  | High — immediate cleanup| 01-H-01, 05-DC-01–DC-09|
| F-06 | **`DrPooReply` interface duplicated identically** in store.ts:213 and aiAnalysis.ts:31. Neither imports the other's version.| `store.ts`, `aiAnalysis.ts`| Medium — drift risk| 01-CI-02, 02-F-06, 04-DUP-02, 05-DC-29, 06-OV-01|
| F-07 | **`bristolToConsistency` / `normalizeDigestiveCategory` duplicated** — Track.tsx has a simplified version, analysis.ts has a fuller version. Both map Bristol codes to digestive categories.| `Track.tsx:49`, `analysis.ts:767`| Medium — mapping drift risk          | 02-F-01, 06-OV-03|
| F-08 | **Time duration constants scattered** — `MS_PER_HOUR`, `MS_PER_MINUTE`, `MS_PER_DAY`, `MS_PER_WEEK` redefined in 5+ files. Inline `24*60*60*1000` in 4 more locations.| `analysis.ts`, `aiAnalysis.ts`, `ObservationWindow.tsx`, `Track.tsx`, `useAiInsights.ts`, `store.ts`                                | Medium — DRY violation| 02-F-02|
| F-09 | **Weight conversion `2.20462` scattered as magic number** — appears in 10+ locations across 5 files. `formatWeight.ts` exists but adoption is incomplete. `KG_PER_LB = 0.45359237` independently defined in 2 more files. Includes full `formatWeight` function copy-pasted in WeightTrendCard.tsx. | `formatWeight.ts`, `TodayLog.tsx`, `WeightTrendCard.tsx`, `ActivitySection.tsx`, `WeightEntryDrawer.tsx`, `DemographicsSection.tsx` | Medium — maintenance burden| 02-F-03, 04-DUP-03, 04-DUP-04, 04-DUP-16, 08-M-07, 08-CI-05|
| F-11 | **`computeTodayHabitCounts` duplicated with different behavior** — Track.tsx filters by start AND end; DailyProgress.tsx only by start. Missing upper bound could count future logs.| `Track.tsx:73`, `DailyProgress.tsx:22`| High — potential count bug| 02-F-08, 03-cross, 06-OV-05|
| F-12 | **`normalizeEpisodes` / `normalizeEpisodesCount` duplicated** — both clamp unknown to [1, 20], functionally identical with minor ordering differences.| `Track.tsx:61`, `analysis.ts:907`| Low-Medium| 02-F-09, 06-OV-04|
| F-13 | **`id as any` casts bypass Convex branded ID type safety** — 3 locations in sync hooks cast string to `any` to avoid threading `Id<"logs">` types.| `sync.ts:68,76,114`| Medium — runtime failure risk| 08-H-02|
| F-14 | **`useAddAiAnalysis` accepts `any` for request/response/insight** — no compile-time shape validation on AI analysis payloads persisted to Convex.| `sync.ts:86-88`| Medium — data integrity| 08-H-03|
| F-15 | **Weekly summary backup saved to localStorage but never restored** — backup logic exists, log says "backup remains for retry," but no retry code reads it back.| `useWeeklySummaryAutoTrigger.ts:127,198,201`| Medium — misleading + orphaned data  | 08-H-04|
| F-16 | **HabitDetailSheet oversized (596 lines)** — 4 mixed concerns, manually branches Drawer/Dialog instead of using ResponsiveShell.| `HabitDetailSheet.tsx`| Medium| 03-H-01                                                                |
| F-17 | **FoodSafetyDatabase oversized (587 lines)** — 6 inline sub-components, business logic (`buildAiFlags`, `computeTrend`), dual mobile/desktop rendering.| `FoodSafetyDatabase.tsx`| Medium| 03-H-02|
| F-18 | **FoodConfirmModal oversized (580 lines)** — custom focus trap duplicating existing dialog primitives.| `FoodConfirmModal.tsx`| Medium| 03-H-03|
| F-19 | **BowelSection oversized (571 lines)** — well-structured but inflated by ~85 lines of constant data.| `BowelSection.tsx`| Low-Medium| 03-H-04|
| F-20 | **TrackingForm oversized (560 lines)** — kitchen-sink settings form with 6 unrelated sections.| `TrackingForm.tsx`| Medium| 03-H-05|
| F-21 | **12 unused Convex sync hooks + 2 unused types** — exported but never imported. Built for features that use direct queries instead or aren't implemented.| `sync.ts` (14 symbols)| Medium — dead code + bundle size     | 01-M-01, 05-DC-10|
| F-22 | **Deprecated habit filtering at 13 call sites** — `isDeprecatedHabitId` runs on every habit add, update, log, sync read, and sync write for just 2 removed habit IDs.| `store.ts` (8), `sync.ts` (5)| Medium — runtime overhead| 04-DUP-17, 07-F2|
| F-23 | **Store migration block (135 lines) runs on every app load** — `_version` parameter intentionally ignored, all migrations run regardless of version. Includes migrations for data formats that no longer exist.| `store.ts:697-831`| Medium — performance + complexity    | 06-S-03, 07-F1|
| F-24 | **`normalizeHabitConfig` old-format migration branch** (~35 lines) — migrates `dailyGoal` → `dailyTarget`/`dailyCap`, runs on every call. The `fluidDefaults` param exists solely for this path.| `habitTemplates.ts:283-329`| Medium — unnecessary overhead| 07-F4|
| F-25 | **Legacy fluid data format fallback (`fluidType`)** — 4 call sites fall back to `log.data?.fluidType`, a field from when fluid logs didn't use the `items` array.| `aiAnalysis.ts:268`, `TodayLog.tsx:331,1565,2126`| Medium — confusing data model| 07-F3|
| F-26 | **Celebration logic duplicated between handlers** — target-met celebration check repeated in `handleQuickCaptureTap` and `handleLogSleepQuickCapture` with identical threshold logic.| `Track.tsx:530-660, 493-510`| Medium — regression risk| 06-S-01|
| F-27 | **Deprecated re-exports (3 items)** — `DEFAULT_AI_MODEL` (aiAnalysis.ts), `FOOD_PARSE_MODEL` (foodParsing.ts), `ActivitySection` alias. All have zero or one consumer.| `aiAnalysis.ts:18`, `foodParsing.ts:3`, `ActivitySection.tsx:168`| Low — confusion| 01-H-03, 02-F-18, 04-DUP-09, 05-DC-11/17, 06-OV-10, 07-F11/12, 08-M-05 |
| F-28 | **`getErrorMessage` utility exists but is never used** — 10+ files inline `err instanceof Error ? err.message : ...` instead. Combined with `catch (err: any)` in 4 locations.| `errors.ts`, 10+ consumer files| Medium — inconsistent error handling | 01-H-02, 02-F-04, 05-DC-09, 06-OV-09, 08-M-10|

### MODERATE (40 findings)

| ID   | Finding                            | Files                                                                   | Source Reports                 |
| ---- | ---------------------------------- | ----------------------------------------------------------------------- | ------------------------------ |
| F-29 | AppDataForm oversized (460 lines) — 5 unrelated settings groups | `AppDataForm.tsx`                          | 03-M-01                        |
| F-30 | LifestyleSection oversized (439 lines) + Yes/No radio pattern repeated 3x + frequency dropdown repeated 3x| `LifestyleSection.tsx`  | 03-M-02, 04-DUP-12|
| F-31 | WeightEntryDrawer oversized (381 lines) — weight entry + settings + long-press detection| `WeightEntryDrawer.tsx`| 03-M-03                    |
| F-32 | AiInsightsSection oversized (344 lines) — 4 components in one file| `AiInsightsSection.tsx`                   | 03-M-04                        |
| F-33 | BristolScale oversized (334 lines) — SVG illustration data inflating file| `BristolScale.tsx`                 | 03-M-05                        |
| F-34 | Fluid preset constants duplicated — `BLOCKED_FLUID_PRESET_NAMES` (store) = `HARDWIRED_FLUID_NAMES` (FluidSection)| `store.ts:387`, `FluidSection.tsx:14`| 02-F-14, 04-DUP-05, 06-OV-06   |
| F-35 | `STATUS_ORDER` maps duplicated with different sort directions — safe-first (analysis.ts) vs risky-first (FoodSafetyDatabase.tsx)| `analysis.ts:103`, `FoodSafetyDatabase.tsx:352`                         | 04-DUP-06, 06-OV-07            |
| F-36 | Date key formatting duplicated — `formatDateInputValue` (DigestiveCorrelationGrid), inline (analysis.ts), `getDateKeyFromTimestamp` (reproductiveHealth) all produce `YYYY-MM-DD`                                                                           | Multiple| 02-F-05, 06-OV-08              |
| F-37 | `LogType` union duplicated between store.ts and sync.ts inline| `store.ts:28`, `sync.ts:14`                    | 01-CI-01, 02-F-11, 04-DUP-10|
| F-38 | Dual correlation systems — `analyzeFactors()` in analysis.ts and `computeCorrelations()` in digestiveCorrelations.ts answer the same question differently| `analysis.ts`, `digestiveCorrelations.ts`| 04-DUP-07|
| F-39 | `FoodStatus` vs `FoodTrialStatus` — overlapping types with different naming conventions (`safe-loose` vs `safe_loose`) and different members| `analysis.ts:4`, `sync.ts:281`| 04-DUP-08|
| F-40 | PrivacyPage/TermsPage share identical page shell structure| `PrivacyPage.tsx`, `TermsPage.tsx`                  | 04-DUP-11                   |
| F-41 | Long-press pattern duplicated in 3 components| `QuickCaptureTile.tsx`, `WeightEntryDrawer.tsx`, `SleepEntryDrawer.tsx` | 03-cross             |
| F-42 | `foodParsing.ts` creates own OpenAI client instead of using shared `getOpenAIClient` — misses caching| `foodParsing.ts:261`| 04-DUP-18, 06-S-08, 08-M-04|
| F-43 | Factor correlation builders repetitive — 4 nearly identical functions (~130 lines) differ only in partition logic| `analysis.ts:632-765`| 04-DUP-19, 06-S-06|
| F-44 | `useAiInsights` hook maintains 11 separate useRef instances| `useAiInsights.ts`                                                      | 06-S-04|
| F-45 | `useCoaching` hook maintains 6 separate useRef instances (same pattern)| `useCoaching.ts`                                            | 06-S-05|
| F-46 | `LegacyEarnedBadges` type — badges stored but never read or displayed| `streaks.ts:7-21`                                             | 07-F5|
| F-47 | `sideQuest` / `miniChallenge` dual-name check — AI prompt outputs `sideQuest`, internal type uses `miniChallenge`, parser checks both| `aiAnalysis.ts:1093-1102`| 07-F6|
| F-48 | Health condition name normalization duplicated in store migration and AppDataForm| `store.ts:803-813`, `AppDataForm.tsx:131-141`| 07-F7                          |
| F-49 | Unused store types — `FoodLogData`, `FluidLogData`, `DigestiveLogData`, `ActivityLogData`, `WeightLogData`, `ReproductiveLogData`, `LogEntryData` exported but never imported| `store.ts` (7 types)| 01-M-02, 05-DC-21|
| F-50 | `HEALTH_CONDITION_OPTIONS` combined array never imported — only the split arrays are used| `store.ts:98`| 01-M-03, 05-DC-22|
| F-51 | `applyFallbacks` uses `any` parameter and returns hardcoded "Plain white rice" fallback that could look like a real AI recommendation| `aiAnalysis.ts:1078`| 08-M-02|
| F-52 | Weekly summary parser uses `parsed as any` cast with "No summary available." fallback| `aiAnalysis.ts:1440`                    | 08-M-03|
| F-53 | Walking habit/activity backward-compat merge — TEMP comment, supporting functions exist solely for this| `TodayLog.tsx:155-165`| 07-F13, 08-M-01|
| F-54 | Frequency validation in store migration duplicates `normalizeFrequency` from settingsUtils.ts| `store.ts:783-802`              | 07-F9|
| F-55 | `VALID_USAGE_FREQUENCIES` defined independently in settingsUtils.ts and inline in store migration| `settingsUtils.ts:19`, `store.ts:783`| 06-S-14, 07-F9|
| F-56 | Prop drilling — Track.tsx passes 8-9 props to TodayLog and QuickCapture| `Track.tsx` → children                                | 03-cross|
| F-57 | `Record<string, any>` used for log data mutations in TodayLog — downstream of F-04| `TodayLog.tsx` (6 locations)               | 08-M-08|
| F-58 | Stale JSDoc says "18:00" boundary but `BOUNDARY_HOUR = 21` (9 PM)| `useWeeklySummaryAutoTrigger.ts:89`                         | 08-M-06|
| F-59 | Condition chip rendering duplicated between GI and comorbidity lists| `ConditionsSection.tsx:30-88`                            | 04-DUP-15|
| F-60 | Deleted store keys (`calibrations`, `logs`) cleaned on every app load| `store.ts:769-770`                                      | 07-F10|
| F-61 | `fluidDefaults` migration from old store format — `fluidDefaults.waterMl`/`coffeeMl` extraction| `store.ts:703-713`            | 07-F14|
| F-62 | Unused store actions — `getHabitLogsForRange`, `addFluidPreset`, `removeFluidPreset`, `clearPaneSummaryCache`| `store.ts` (4 actions)| 05-DC-23|
| F-63 | Testing-only exports never tested — `resetRateLimit` (aiRateLimiter), `clearCachedClient` (openaiClient)| 2 files| 01-H-04, 05-DC-12/13           |
| F-64 | Internal-only symbols needlessly exported — `PANE_CACHE_TTL_MS`, `PaneId`, `ConversationMessage`, `AiAnalysisResult`, `BristolOption`, `CelebrationEvent`, `VALID_INSIGHT_MODELS`, `DEPRECATED_HABIT_IDS`, `inferHabitType`, `getCompletedPeriodBounds` | 8 files| 01-L-01, 05-DC-14–19, 05-DC-32 |
| F-65 | `parseAiInsight` (store.ts) and `applyFallbacks` (aiAnalysis.ts) are dual fallback functions for AI response data| `store.ts:479`, `aiAnalysis.ts:1078`| 07-F17|
| F-66 | Caffeine cup calculation spread across 4 locations with different function names| 4 files                                      | 02-F-16, 06-OV-11|
| F-67 | `FluidLogData` has misleading "legacy compatibility" comment — it's now the canonical format| `store.ts:252`                   | 07-F18|
| F-68 | `formatNumber` / `formatCompactNumber` duplicated identically in habitProgress.ts and habitCoaching.ts| 2 files                | 02-F-15|

### LOW (22 findings)

| ID   | Finding                                                                                                                                                           | Files                            | Source Reports     |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ------------------ |
| F-69 | DigestiveCorrelationGrid (317 lines) — inline date picker logic                                                                                                   | `DigestiveCorrelationGrid.tsx`   | 03-L-01            |
| F-70 | Archive (304 lines) — filter toolbar could be extracted                                                                                                           | `Archive.tsx`                    | 03-L-02            |
| F-71 | CycleHormonalSection (303 lines) — inline validation, option lists not from shared lib                                                                            | `CycleHormonalSection.tsx`       | 03-I-01            |
| F-72 | Section header UI pattern repeated 20+ times without component abstraction                                                                                        | 15+ files                        | 02-F-13, 04-DUP-13 |
| F-73 | Glass-card CSS — 13 nearly identical variant blocks in index.css                                                                                                  | `index.css:595-877`              | 04-DUP-14          |
| F-74 | `readText` helper buried as private in analysis.ts — same safe-read pattern appears elsewhere                                                                     | `analysis.ts:902`                | 02-F-10            |
| F-75 | `DigestiveCategory` type not exported — duplicated as inline return type                                                                                          | `analysis.ts:3`                  | 02-F-12            |
| F-76 | Legacy CSS classes `.dot-grid-bg` and `.section-card` explicitly labeled "legacy" with zero consumers                                                             | `index.css:1123-1152`            | 07-F15             |
| F-77 | `isDigestiveHabit` exported but never used anywhere                                                                                                               | `habitTemplates.ts:77`           | 05-DC-16           |
| F-78 | `FactorCorrelation` type becomes dead once FactorInsights.tsx is deleted                                                                                          | `analysis.ts:32`                 | 05-DC-30           |
| F-79 | `HabitLogData` shadow type in TodayLog instead of importing from store                                                                                            | `TodayLog.tsx:350`               | 05-DC-31           |
| F-80 | Smoking correlation special-case early return duplicates metric calculation                                                                                       | `analysis.ts:658-707`            | 06-S-07            |
| F-81 | `parseAiInsight` repetitive null-checking pattern                                                                                                                 | `store.ts:479-498`               | 06-S-09            |
| F-82 | Coaching suggestion validation uses verbose type assertion chain                                                                                                  | `habitCoaching.ts:596-613`       | 06-S-10            |
| F-83 | Console.log statements in weekly summary auto-trigger (4 instances)                                                                                               | `useWeeklySummaryAutoTrigger.ts` | 08-L-01            |
| F-84 | Console.error in AI error logging (10+ instances) — acceptable but noisy                                                                                          | Multiple AI files                | 08-L-02            |
| F-85 | Console.warn for high token count with magic number threshold 50000                                                                                               | `aiAnalysis.ts:1298`             | 08-L-03            |
| F-86 | Silent catches in TodayLog inline edits (7 instances) — intentional, keeps editor open                                                                            | `TodayLog.tsx`                   | 08-L-06            |
| F-87 | Silent catch in WaitlistForm — error details not logged                                                                                                           | `WaitlistForm.tsx:50`            | 08-L-07            |
| F-88 | Unused landing page types — `fadeLeft`, `fadeRight`, `fadeIn` (motionVariants), `ChakraKey`, `chakraGradient` (chakraColors), `SoundVariant`, `CelebrationConfig` | 4 files                          | 05-DC-24–28        |
| F-89 | Conversation/token limit magic numbers (20 messages, 50 food trials, 50000 tokens)                                                                                | `aiAnalysis.ts`                  | 08-CI-06           |
| F-90 | `ApiKeyFooterSection.tsx` has inline footer (lines 78-107) duplicating the proper `LandingFooter.tsx` component                                                   | 2 files                          | Custom finding     |

### COULD BE IMPROVED (16 findings)

| ID    | Finding                                                                                                                                         | Files                                                             | Source Reports |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | -------------- |
| F-91  | Nested ternary for progress text color in QuickCaptureTile                                                                                      | `QuickCaptureTile.tsx:141`                                        | 06-S-11        |
| F-92  | `StatusBadge` if/else chain instead of lookup map                                                                                               | `FoodSafetyDatabase.tsx:49-89`                                    | 06-S-12        |
| F-93  | `getHabitIcon` 14-clause if chain                                                                                                               | `habitIcons.tsx:20-63`                                            | 06-S-13        |
| F-94  | `DailyProgress.tsx` may be dead — verify if rendered anywhere                                                                                   | `DailyProgress.tsx`                                               | 06-S-15        |
| F-95  | Store types monolith — all domain types in store.ts                                                                                             | `store.ts` (~30 types)                                            | 02-F-17        |
| F-96  | Barrel export inconsistency in settings sub-modules                                                                                             | settings/                                                         | 01-CI-04       |
| F-97  | Radix `data-[state=*]` attributes + `asChild` prop usage pending Base UI migration                                                              | 9+ UI components                                                  | 07-F16, 07-F19 |
| F-98  | `dangerouslyAllowBrowser: true` on OpenAI client — inherent to local-first architecture                                                         | `openaiClient.ts`, `foodParsing.ts`                               | 08-CI-08       |
| F-99  | `BOUNDARY_HOUR` and `OBSERVATION_HOURS` hardcoded — may not suit all timezones                                                                  | `useWeeklySummaryAutoTrigger.ts`, `ObservationWindow.tsx`         | 08-CI-07       |
| F-100 | biome-ignore lint suppression (well-justified, acceptable)                                                                                      | `useHabitStreaks.ts:31`                                           | 08-M-09        |
| F-101 | `findStalledFoods` defined but only called once (awareness note)                                                                                | `analysis.ts:495`                                                 | 06-S-16        |
| F-102 | Store migration uses `persisted: any` — pragmatic for deserialized state                                                                        | `store.ts:697`                                                    | 08-CI-01       |
| F-103 | Console.error in route error boundary (standard React pattern, acceptable)                                                                      | `routeTree.tsx:84`                                                | 08-L-04        |
| F-104 | Empty catch for AudioContext resume (intentional, acceptable)                                                                                   | `sounds.ts:50`                                                    | 08-L-05        |
| F-105 | Silent catch in DigestiveCorrelationGrid date formatting (acceptable fallback)                                                                  | `DigestiveCorrelationGrid.tsx:53`                                 | 08-L-08        |
| F-106 | `LandingFooter.tsx` exists as proper component but needs re-integration into LandingPage.tsx replacing the inline footer in ApiKeyFooterSection | `LandingFooter.tsx`, `ApiKeyFooterSection.tsx`, `LandingPage.tsx` | Custom finding |

---

## Severity Summary

| Severity          | Count   | Action Required                                     |
| ----------------- | ------- | --------------------------------------------------- |
| CRITICAL          | 3       | Decompose god components, unify inputSafety         |
| HIGH              | 25      | Fix typing, delete dead code, deduplicate functions |
| MODERATE          | 40      | Component splits, compat removal, consolidation     |
| LOW               | 22      | Cleanup, minor improvements                         |
| COULD BE IMPROVED | 16      | Polish, ongoing migration work                      |
| **Total**         | **106** |                                                     |

---

## Remediation Plan

### Phase 1 — Quick Wins (Trivial to Small effort, parallelizable)

**Target:** ~40 findings resolved. Deploy 6-8 parallel agents.

| Task                                                                                                          | Findings Resolved | Effort  |
| ------------------------------------------------------------------------------------------------------------- | ----------------- | ------- |

| Create `src/lib/timeConstants.ts`, replace 5+ redefinitions                                                   | F-08              | Small   |
| Create `LBS_PER_KG`, `KG_PER_LB`, `kgToLbs()`, `lbsToKg()` in formatWeight.ts, replace all `2.20462` literals | F-09              | Small   |
| Export `isCaffeineHabit` from habitTemplates.ts, replace 3 copies                                             | F-10              | Small   |
| Consolidate `computeTodayHabitCounts` into habitAggregates.ts                                                 | F-11              | Small   |
| Export `normalizeEpisodesCount` from analysis.ts, import in Track.tsx                                         | F-12              | Small   |
| Export `bristolCodeToCategory` from analysis.ts, replace Track.tsx copy                                       | F-07              | Small   |
| Consolidate `DrPooReply` to single definition in store.ts                                                     | F-06              | Small   |
| Import `LogType` from store in sync.ts instead of inline union                                                | F-37              | Small   |
| Import `BLOCKED_FLUID_PRESET_NAMES` in FluidSection.tsx                                                       | F-34              | Small   |
| Export both `STATUS_ORDER` variants from analysis.ts                                                          | F-35              | Small   |
| Adopt `getErrorMessage` utility — add fallback param, replace 10+ inline patterns                             | F-28              | Small   |
| Use `getOpenAIClient` in foodParsing.ts instead of raw client creation                                        | F-42              | Small   |
| Consolidate date key formatting to `formatLocalDateKey`                                                       | F-36              | Small   |
| Consolidate `formatNumber` / `formatCompactNumber`                                                            | F-68              | Trivial |
| Delete dead files (NOT LandingFooter, NOT errors.ts yet)                                                      | F-05 (partial)    | Trivial |
| Remove `export` from internal-only symbols (10 files)                                                         | F-64              | Trivial |
| Remove 3 deprecated re-exports                                                                                | F-27              | Trivial |
| Delete legacy CSS (`.dot-grid-bg`, `.section-card`)                                                           | F-76              | Trivial |
| Fix stale JSDoc (18:00 → 21:00)                                                                               | F-58              | Trivial |
| Fix misleading `FluidLogData` comment                                                                         | F-67              | Trivial |
| Consolidate `VALID_USAGE_FREQUENCIES` — import from settingsUtils in migration                                | F-55              | Trivial |
| Consolidate health condition normalization into shared function                                               | F-48              | Small   |
| Extract `LegalPageShell` component for Privacy/Terms pages                                                    | F-40              | Small   |
| Remove unused store actions (4)                                                                               | F-62              | Trivial |
| Remove `HEALTH_CONDITION_OPTIONS` export                                                                      | F-50              | Trivial |
| Delete unused `FactorCorrelation` export (after dead file cleanup)                                            | F-78              | Trivial |
| Delete unused landing types (fadeLeft, fadeRight, fadeIn, ChakraKey, chakraGradient)                          | F-88              | Trivial |

### Phase 2 — Structural Refactors (Medium effort, some sequential)

**Target:** ~30 findings resolved. Deploy 4-6 agents with dependency ordering.

| Task                                                                                                    | Findings Resolved                                                | Effort | Dependencies     |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------ | ---------------- |
| Decompose TodayLog.tsx into `today-log/` directory (types, grouping, editors, groups, sub-rows, shells) | F-01, F-79, F-53 (walking compat isolated), F-57 (partial), F-86 | Large  | F-07, F-12 first |
| Extract `useQuickCapture`, `useDayStats`, `useFoodParsing` hooks from Track.tsx                         | F-02, F-26, F-56                                                 | Medium | F-10, F-11 first |
| Extract `useLongPress` hook from 3 components                                                           | F-41                                                             | Small  | None             |
| Split TrackingForm.tsx into 6 section components                                                        | F-20                                                             | Small  | None             |
| Split AppDataForm.tsx into 5 section components                                                         | F-29                                                             | Small  | None             |
| Extract `LifestyleSection` substance tracking field component                                           | F-30                                                             | Small  | None             |
| Extract BowelSection constants to `bowelConstants.ts`                                                   | F-19                                                             | Small  | None             |
| Split FoodSafetyDatabase.tsx — extract business logic + sub-components                                  | F-17                                                             | Medium | None             |
| Refactor FoodConfirmModal.tsx — use existing dialog primitives, extract state hook                      | F-18                                                             | Medium | None             |
| Use `ResponsiveShell` in HabitDetailSheet instead of manual Drawer/Dialog branching                     | F-16                                                             | Small  | None             |
| Restructure store migration into named functions + version gating                                       | F-23, F-54, F-60, F-61                                           | Medium | None             |
| Group refs in useAiInsights and useCoaching into single ref objects                                     | F-44, F-45                                                       | Small  | None             |
| Refactor analysis.ts factor builders to generic config-driven pattern                                   | F-43, F-80                                                       | Small  | None             |
| Consolidate caffeine cup calculation to single utility                                                  | F-66                                                             | Small  | F-10 first       |
| Centralize `isDeprecatedHabitId` — consider Zustand middleware or single-entry filter                   | F-22                                                             | Small  | None             |
| Extract `SectionHeader` component for 20+ repeated patterns                                             | F-72                                                             | Small  | None             |
| Re-integrate `LandingFooter.tsx` into LandingPage, remove inline footer from ApiKeyFooterSection        | F-106, F-90                                                      | Small  | None             |
| Extract `ChipGroup` component for condition chip rendering                                              | F-59                                                             | Small  | None             |

### Phase 3 — Type Safety & Backwards Compat Removal (Requires data verification)

**Target:** ~20 findings resolved. Sequential work requiring Convex data checks.

| Task                                                                                         | Findings Resolved                              | Effort | Prerequisites                         |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------ | ------------------------------------- |
| **Type `LogEntry.data` with discriminated union** — refactor aiAnalysis.ts to narrow by type | F-04, F-57, plus ~25 downstream `any` removals | Large  | Audit aiAnalysis.ts read patterns     |
| Type `useAddAiAnalysis` payload with actual shapes                                           | F-14                                           | Small  | F-04                                  |
| Type sync hook IDs with Convex branded types (or `LogId` alias)                              | F-13                                           | Medium | F-04                                  |
| Unify `FoodStatus` / `FoodTrialStatus` types                                                 | F-39                                           | Small  | Data verification                     |
| Remove `fluidType` fallbacks (4 call sites)                                                  | F-25                                           | Small  | Verify no Convex data has old format  |
| Remove `normalizeHabitConfig` old-format branch + `fluidDefaults` param                      | F-24, F-61                                     | Small  | Verify no old-format habits in Convex |
| Remove deprecated habit filtering (13 call sites)                                            | F-22                                           | Small  | Verify no deprecated habits in Convex |
| Align `sideQuest` / `miniChallenge` naming                                                   | F-47                                           | Small  | Choose canonical name                 |
| Remove or implement `LegacyEarnedBadges`                                                     | F-46                                           | Small  | Product decision                      |
| Remove walking compat merge + helper functions                                               | F-53                                           | Small  | Product decision on walking           |
| Implement weekly summary retry or remove backup logic                                        | F-15                                           | Small  | Product decision                      |
| Consolidate `parseAiInsight` / `applyFallbacks` into single function                         | F-65, F-51, F-52                               | Medium | F-04                                  |
| Unify inputSafety.ts between src/ and convex/                                                | F-03                                           | Medium | Determine shared module strategy      |

### Phase 4 — Polish (Low priority, ongoing)

**Target:** ~16 findings. Background work.

| Task                                                                       | Findings Resolved |
| -------------------------------------------------------------------------- | ----------------- |
| Base UI migration — update `data-[state=*]` attributes and `asChild` props | F-97              |
| Replace nested ternaries/if-chains with lookup maps                        | F-91, F-92, F-93  |
| Gate console.log/warn behind debug flag                                    | F-83, F-84, F-85  |
| Extract conversation/token limit magic numbers to constants                | F-89              |
| DRY glass-card CSS with PostCSS or Tailwind plugin                         | F-73              |
| Verify and delete DailyProgress.tsx if dead                                | F-94              |
| Simplify coaching validation type assertions                               | F-82              |
| Consider domain types extraction from store.ts monolith                    | F-95              |
| Extract BristolScale SVG illustrations to separate file                    | F-33              |
| Extract AiInsightsSection sub-components                                   | F-32              |

---

## Appendix: Source Report Index

| Report | File                                        | Findings                                                  |
| ------ | ------------------------------------------- | --------------------------------------------------------- |
| 01     | `01-imports-exports.md`                     | Import/export mapping, dead modules, unused exports       |
| 02     | `02-shared-code-reusability.md`             | Shared code opportunities, duplication for extraction     |
| 03     | `03-component-complexity.md`                | God components, decomposition recommendations             |
| 04     | `04-duplication-redundancy.md`              | Code duplication, type mismatches, constant scattering    |
| 05     | `05-dead-code.md`                           | Dead files, unused exports, dead store actions            |
| 06     | `06-simplification-overlaps.md`             | Simplification opportunities, overlapping implementations |
| 07     | `07-backwards-compatibility.md`             | Legacy code, migration shims, compat fallbacks            |
| 08     | `08-todos-unfinished.md`                    | TODOs, any types, console.logs, unfinished features       |
| 09     | `09-habit-tracking-quick-capture-impact.md` | Special report: habit tracking and quick capture impact   |
