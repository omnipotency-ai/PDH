# Caca Traca -- Code Health Map

**Generated:** 2026-03-17
**Audit scope:** ~299 files, ~55,000 lines

---

## Task 3: Orphan Detection

### 3a. Dead Exports (exported but never imported)

**Total dead exports:** 91

#### convex/

| File                        | Export Name                               | Type                | Assessment                                                                                                                            |
| --------------------------- | ----------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `convex/validators.ts`      | `habitKindValidator`                      | validator           | Dead code -- investigate purpose. Not imported by any file. Schema uses inline `v.union(...)` for habit kinds.                        |
| `convex/validators.ts`      | `habitUnitValidator`                      | validator           | Dead code -- investigate purpose. Not imported by any file.                                                                           |
| `convex/validators.ts`      | `fluidPresetValidator`                    | validator           | Dead code -- investigate purpose. Only used internally within validators.ts to build `fluidPresetsValidator`. Not imported elsewhere. |
| `convex/validators.ts`      | `storedFluidPresetValidator`              | validator           | Dead code -- investigate purpose. Only used internally within validators.ts.                                                          |
| `convex/validators.ts`      | `foodAssessmentVerdictValidator`          | validator           | Dead code -- investigate purpose. Only used internally within validators.ts to build `structuredFoodAssessmentValidator`.             |
| `convex/validators.ts`      | `structuredFoodAssessmentValidator`       | validator           | Dead code -- investigate purpose. Only used internally within validators.ts to build `aiInsightValidator`.                            |
| `convex/validators.ts`      | `reproductiveHealthValidator`             | validator           | Dead code -- investigate purpose. Only used internally within validators.ts to build `healthProfileValidator`.                        |
| `convex/validators.ts`      | `foodGroupValidator`                      | validator           | Entry point -- imported by schema.ts (used in foodEmbeddings table definition).                                                       |
| `convex/validators.ts`      | `foodLineValidator`                       | validator           | Entry point -- imported by schema.ts (used in foodEmbeddings table definition).                                                       |
| `convex/validators.ts`      | `foodPrimaryStatusValidator`              | validator           | Entry point -- imported by schema.ts (used in foodTrialSummary table definition).                                                     |
| `convex/validators.ts`      | `foodTendencyValidator`                   | validator           | Entry point -- imported by schema.ts (used in foodTrialSummary table definition).                                                     |
| `convex/validators.ts`      | `foodAssessmentCausalRoleValidator`       | validator           | Entry point -- imported by schema.ts.                                                                                                 |
| `convex/validators.ts`      | `foodAssessmentChangeTypeValidator`       | validator           | Entry point -- imported by schema.ts.                                                                                                 |
| `convex/logs.ts`            | `habitConfigValidator` (re-export)        | validator re-export | Dead code -- investigate purpose. Re-exported from validators.ts but no file imports it from logs.ts.                                 |
| `convex/logs.ts`            | `habitTypeValidator` (re-export)          | validator re-export | Dead code -- investigate purpose. Same as above. No consumers via logs.ts path.                                                       |
| `convex/lib/inputSafety.ts` | `sanitizeStringArray`                     | function            | Dead code -- investigate purpose. Exported but never imported by any convex file. (src/lib/inputSafety.ts has its own copy.)          |
| `convex/foodParsing.ts`     | `getFoodDocumentsNeedingEmbeddingRefresh` | function            | Test-only export -- imported only by foodParsing.test.ts.                                                                             |
| `convex/foodLlmMatching.ts` | `_testing`                                | object              | Test-only export -- imported only by foodLlmMatching.test.ts (explicitly documented as test-only).                                    |

#### shared/

| File                       | Export Name                        | Type     | Assessment                                                                                                                                                                                  |
| -------------------------- | ---------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shared/foodRegistry.ts`   | `FoodCategory`                     | type     | Likely unwired -- only referenced in foodRegistry.ts itself (as a field type on entries). No code outside the registry imports or uses this type.                                           |
| `shared/foodRegistry.ts`   | `FoodSubcategory`                  | type     | Likely unwired -- same as FoodCategory. Only used internally as a field type on registry entries. No external consumer.                                                                     |
| `shared/foodRegistry.ts`   | `FoodGasLevel`                     | type     | Likely unwired -- only defined/used within foodRegistry.ts on the `FoodDigestionMetadata` interface. No external import.                                                                    |
| `shared/foodRegistry.ts`   | `FoodDryTextureLevel`              | type     | Likely unwired -- same as FoodGasLevel. No external import.                                                                                                                                 |
| `shared/foodRegistry.ts`   | `getFoodsByZone`                   | function | Test-only export -- only used in foodRegistry.test.ts and re-exported by foodCanonicalization.ts. No production consumer.                                                                   |
| `shared/foodRegistry.ts`   | `isCanonicalFood`                  | function | Limited use -- used in convex/foodParsing.ts and re-exported by foodCanonicalization.ts. 2 consumers total.                                                                                 |
| `shared/foodMatching.ts`   | `ConfidenceRoute`                  | type     | Dead code -- investigate purpose. Only defined and used within foodMatching.ts. Not imported by any external file.                                                                          |
| `shared/foodMatching.ts`   | `splitMealIntoFoodPhrases`         | function | Dead code -- investigate purpose. Only used within foodMatching.ts itself (by `preprocessMealText`). No external consumer.                                                                  |
| `shared/foodMatching.ts`   | `findExactAliasCandidate`          | function | Dead code -- investigate purpose. Only used within foodMatching.ts (by `fuzzySearchFoodCandidates`). Not imported externally.                                                               |
| `shared/foodMatching.ts`   | `buildBucketOptions`               | function | Dead code -- investigate purpose. Only used within foodMatching.ts (by `routeFoodMatchConfidence`). No external consumer.                                                                   |
| `shared/foodMatching.ts`   | `stripFoodAccents`                 | function | Dead code -- investigate purpose. Only used within foodMatching.ts (by `normalizeFoodMatchText`). No external consumer.                                                                     |
| `shared/foodMatching.ts`   | `buildFoodSearchDocuments`         | function | Limited use -- used only in convex/foodParsing.test.ts. No production consumer beyond the `createFoodMatcherContext` internal call.                                                         |
| `shared/foodEvidence.ts`   | `TransitResolverPolicy`            | type     | Dead code -- investigate purpose. Only defined and used within foodEvidence.ts. No external consumer.                                                                                       |
| `shared/foodEvidence.ts`   | `FoodTrialResolutionMode`          | type     | Dead code -- investigate purpose. Only defined and used within foodEvidence.ts. No external consumer.                                                                                       |
| `shared/foodEvidence.ts`   | `CLINICAL_TRANSIT_RESOLVER_POLICY` | const    | Dead code -- investigate purpose. Exported but only used internally within foodEvidence.ts. No external consumer.                                                                           |
| `shared/foodEvidence.ts`   | `FoodEvidenceTrial`                | type     | Dead code -- investigate purpose. Only used within foodEvidence.ts. External consumers use `FoodEvidenceSummary` (which contains the trials array). No direct external import of this type. |
| `shared/foodProjection.ts` | `BRAT_FOOD_KEYS`                   | const    | Dead code -- investigate purpose. Only defined in foodProjection.ts. The only external consumer imports `BRAT_BASELINE_CANONICALS`, not `BRAT_FOOD_KEYS`.                                   |
| `shared/foodProjection.ts` | `CanonicalFoodProjection`          | type     | Test-only export -- only used in foodPipelineDisplay.test.ts. No production consumer.                                                                                                       |

#### src/types/

| File                  | Export Name             | Type      | Assessment                                                                                                                                   |
| --------------------- | ----------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/types/domain.ts` | `PaneSummaryCacheEntry` | interface | Limited use -- used in src/store.ts only (2 references including definition). May be vestigial if the store pane cache is not actively used. |
| `src/types/domain.ts` | `FluidPresetDraft`      | interface | Limited use -- used in PersonalisationForm.tsx and CustomDrinksSection.tsx only.                                                             |
| `src/types/domain.ts` | `DrPooReply`            | interface | Dead code -- investigate purpose. No clear consumer found beyond the type definition itself.                                                 |

#### src/lib/

| File                               | Export Name                       | Type           | Assessment                                                                                                                                                                         |
| ---------------------------------- | --------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/featureFlags.ts`          | `FEATURE_FLAGS`                   | const          | Dead code -- investigate purpose. Defined but never imported anywhere. The `transitMapV2` flag is `true` and the file has no consumers. If the flag is always-on, remove the file. |
| `src/lib/healthProfile.ts`         | `normalizeHealthConditionName`    | function       | Test-only export. Only imported by `__tests__/healthProfile.test.ts`. No runtime consumer.                                                                                         |
| `src/lib/healthProfile.ts`         | `normalizeHealthConditions`       | function       | Test-only export. Only imported by `__tests__/healthProfile.test.ts`. No runtime consumer.                                                                                         |
| `src/lib/streaks.ts`               | `GamificationState`               | interface      | Dead code -- investigate purpose. Only referenced in its own file. Never imported.                                                                                                 |
| `src/lib/streaks.ts`               | `DEFAULT_GAMIFICATION`            | const          | Dead code -- investigate purpose. Only referenced in its own file. Never imported.                                                                                                 |
| `src/lib/reproductiveHealth.ts`    | `isBleedingStatusActive`          | function       | Dead code -- investigate purpose. Only referenced in its own file.                                                                                                                 |
| `src/lib/reproductiveHealth.ts`    | `bleedingStatusBadgeClass`        | function       | Dead code -- investigate purpose. Only referenced in its own file.                                                                                                                 |
| `src/lib/reproductiveHealth.ts`    | `getDateKeyFromTimestamp`         | function       | Dead code -- investigate purpose. Only referenced in its own file. Wraps `formatLocalDateKey` with no added logic.                                                                 |
| `src/lib/reproductiveHealth.ts`    | `getTodayDateKey`                 | function       | Dead code -- investigate purpose. Only referenced in its own file. Wraps `formatLocalDateKey(new Date())`.                                                                         |
| `src/lib/aiRateLimiter.ts`         | `resetRateLimit`                  | function       | Test-only export. No runtime consumer; designed for test teardown. Rate limiting is currently disabled (MIN_CALL_INTERVAL_MS = 0).                                                 |
| `src/lib/aiAnalysis.ts`            | `TOKEN_WARNING_THRESHOLD`         | const          | Dead code -- investigate purpose. Exported but only used internally. No external consumer.                                                                                         |
| `src/lib/timeConstants.ts`         | `HOURS_PER_DAY`                   | const          | Dead code -- investigate purpose. Exported but never imported by any file.                                                                                                         |
| `src/lib/settingsUtils.ts`         | `VALID_USAGE_FREQUENCIES`         | Set            | Dead code -- investigate purpose. Exported but only used by the private `isUsageFrequency` guard in the same file.                                                                 |
| `src/lib/customFoodPresets.ts`     | `CUSTOM_FOOD_PRESETS_STORAGE_KEY` | const          | Dead code -- investigate purpose. Exported but only used internally by `loadCustomFoodPresets` and `saveCustomFoodPresets`.                                                        |
| `src/lib/habitAggregates.ts`       | `getHabitGoal`                    | function       | Dead code -- investigate purpose. Exported but never imported outside its own file.                                                                                                |
| `src/lib/habitTemplates.ts`        | `isDigestiveHabit`                | function       | Dead code -- investigate purpose. Exported but never imported outside its own file.                                                                                                |
| `src/lib/habitTemplates.ts`        | `isDestructiveHabit`              | function       | Dead code -- investigate purpose. Exported but never imported outside its own file.                                                                                                |
| `src/lib/habitTemplates.ts`        | `isActivityHabit`                 | function       | Dead code -- investigate purpose. Exported but never imported outside its own file.                                                                                                |
| `src/lib/habitTemplates.ts`        | `DEFAULT_HABIT_TEMPLATE_KEYS`     | const          | Dead code -- investigate purpose. Exported but only used by `getDefaultHabitTemplates` in the same file.                                                                           |
| `src/lib/habitTemplates.ts`        | `normalizeHabitConfig`            | function       | Likely unwired. Exported but only used internally by `createCustomHabit` in the same file. No external consumer.                                                                   |
| `src/lib/habitCoaching.ts`         | `generateCoachingSnippet`         | async function | Dead code -- investigate purpose. No external consumer found.                                                                                                                      |
| `src/lib/habitCoaching.ts`         | `getHeuristicCoachingMessage`     | function       | Dead code -- investigate purpose. No external consumer found.                                                                                                                      |
| `src/lib/habitCoaching.ts`         | `generateHabitSnippet`            | async function | Dead code -- investigate purpose. No external consumer found.                                                                                                                      |
| `src/lib/habitCoaching.ts`         | `heuristicHabitSnippet`           | function       | Dead code -- investigate purpose. No external consumer found.                                                                                                                      |
| `src/lib/habitCoaching.ts`         | `PANE_CACHE_TTL_MS`               | const          | Dead code -- investigate purpose. Only used internally in same file.                                                                                                               |
| `src/lib/habitCoaching.ts`         | `paneCacheKey`                    | function       | Dead code -- investigate purpose. Only used internally in same file.                                                                                                               |
| `src/lib/digestiveCorrelations.ts` | `buildPaneSummaryContexts`        | function       | Dead code -- investigate purpose. Exported but never imported outside its own file.                                                                                                |
| `src/lib/analysis.ts`              | `normalizeDigestiveCategory`      | function       | Dead code -- investigate purpose. Exported but never imported outside its own file.                                                                                                |
| `src/lib/analysis.ts`              | `STATUS_ORDER_SAFE_FIRST`         | const          | Dead code -- investigate purpose. Exported but only used internally in `analyzeLogs`.                                                                                              |
| `src/lib/foodDigestionMetadata.ts` | `hasFoodDigestionMetadata`        | function       | Dead code -- investigate purpose. Exported but only used internally by `getFoodDigestionBadges`.                                                                                   |
| `src/lib/foodStatusThresholds.ts`  | `RISKY_BAD_COUNT`                 | const          | Dead code -- investigate purpose. Exported but never imported. Status thresholds may have moved to shared/.                                                                        |
| `src/lib/foodStatusThresholds.ts`  | `WATCH_BAD_COUNT`                 | const          | Dead code -- investigate purpose. Same as above.                                                                                                                                   |
| `src/lib/foodStatusThresholds.ts`  | `ZONE_MIN`                        | const          | Dead code -- investigate purpose. Exported but only used internally by `clampZone`.                                                                                                |
| `src/lib/foodStatusThresholds.ts`  | `ZONE_MAX`                        | const          | Dead code -- investigate purpose. Same as above.                                                                                                                                   |
| `src/lib/foodStatusThresholds.ts`  | `BRISTOL_HARD_UPPER`              | const          | Dead code -- investigate purpose. Exported but only used internally by `classifyConsistency`.                                                                                      |
| `src/lib/foodStatusThresholds.ts`  | `BRISTOL_LOOSE_LOWER`             | const          | Dead code -- investigate purpose. Same as above.                                                                                                                                   |
| `src/lib/foodStatusThresholds.ts`  | `MIN_RESOLVED_TRIALS`             | const          | Dead code -- investigate purpose. Exported but never imported. Threshold may have migrated to shared/.                                                                             |
| `src/lib/foodStatusThresholds.ts`  | `classifyConsistency`             | function       | Dead code -- investigate purpose. Exported but never imported.                                                                                                                     |

#### src/hooks/ + src/contexts/ + src/store/

| File                              | Export Name               | Type            | Assessment                                                                                                                                                                  |
| --------------------------------- | ------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/hooks/useFoodLlmMatching.ts` | `useFoodLlmMatching`      | hook (function) | DEAD -- zero importers. The entire 142-line file is unused. Was likely replaced when LLM matching moved server-side but the hook was never removed. Candidate for deletion. |
| `src/hooks/useFoodParsing.ts`     | `FoodParsingState`        | interface       | Dead externally -- only referenced inside `useFoodParsing.ts` itself as the return type annotation. No external consumer imports it. Could be unexported (made local).      |
| `src/store.ts`                    | `isLogType`               | function        | Dead externally -- only referenced in `store.ts` itself (used internally by `createLogTypeGuard`). No external consumer. Could be unexported.                               |
| `src/store.ts`                    | `isHabitLog`              | type guard      | Dead -- only defined in store.ts, never imported elsewhere.                                                                                                                 |
| `src/store.ts`                    | `isActivityLog`           | type guard      | Dead -- only defined in store.ts, never imported elsewhere.                                                                                                                 |
| `src/store.ts`                    | `isWeightLog`             | type guard      | Dead -- only defined in store.ts, never imported elsewhere.                                                                                                                 |
| `src/store.ts`                    | `isReproductiveLog`       | type guard      | Dead -- only defined in store.ts, never imported elsewhere.                                                                                                                 |
| `src/store.ts`                    | `AppState` (type)         | interface       | Dead externally -- only defined in store.ts, never imported elsewhere.                                                                                                      |
| `src/store.ts`                    | `HabitConfig` (re-export) | type re-export  | Dead -- no file imports `HabitConfig` from `@/store`; all consumers import directly from `@/lib/habitTemplates`.                                                            |
| `src/store.ts`                    | `HabitLog` (re-export)    | type re-export  | Dead -- no file imports `HabitLog` from `@/store`; all consumers import directly from `@/lib/habitTemplates`.                                                               |
| `src/store.ts`                    | `SleepGoal` (re-export)   | type re-export  | Dead -- no file imports `SleepGoal` from `@/store`; all consumers import directly from `@/lib/streaks`.                                                                     |

#### src/components/

| File                            | Export Name          | Type      | Assessment                                                                                                                                |
| ------------------------------- | -------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `track/panels/BristolScale.tsx` | `BristolScalePicker` | component | Dead code -- investigate purpose. Exported but not imported anywhere in the codebase. May have been used in an older BowelSection design. |
| `ui/date-picker.tsx`            | `DatePicker`         | component | Needs verification -- settings repro files use DatePickerButton instead.                                                                  |

#### src/pages/ + e2e/ + config

| File           | Export Name | Type      | Assessment                                                                                                                                       |
| -------------- | ----------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/store.ts` | `AppState`  | interface | Potentially dead -- exported interface. Grep shows no imports of `AppState` outside the file itself. (Also listed above in hooks/store section.) |

No dead page component exports found -- all pages are consumed by `src/routeTree.tsx` as entry points.

---

### 3b. Orphan Files (no importers, not entry points)

| File                              | Lines | Assessment                                                                                                                     |
| --------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------ |
| `src/hooks/useFoodLlmMatching.ts` | 142   | DEAD file -- zero importers. The hook was orphaned when LLM matching moved server-side. Candidate for deletion.                |
| `src/lib/featureFlags.ts`         | 18    | DEAD file -- zero importers. The sole flag (`transitMapV2: true`) is never read. Feature has shipped; file can be removed.     |
| `src/lib/healthProfile.ts`        | 36    | Test-only file -- zero runtime importers. Both exported functions only consumed by their test file. No runtime code uses them. |

---

### 3c. Unused npm Dependencies

| Package               | Section | Actually Imported?  | Assessment                                                                                                                                                                      |
| --------------------- | ------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `next-themes`         | dep     | **No**              | **UNUSED -- remove.** ThemeProvider is custom (`src/components/theme-provider.tsx`). Not imported anywhere.                                                                     |
| `@clerk/backend`      | devDep  | **No**              | **UNUSED -- remove.** Not imported anywhere. May have been needed as a peer dep for `@clerk/testing` but grep shows zero usage.                                                 |
| `tsx`                 | devDep  | **No**              | **Questionable -- investigate.** Not referenced in any script or source file. May be used for ad-hoc CLI runs (e.g., `npx tsx script.ts`). Safe to remove if not used manually. |
| `@vitest/coverage-v8` | devDep  | N/A (vitest plugin) | **Questionable -- investigate.** Not referenced in vitest.config.ts. Needed only if `vitest --coverage` is run manually. Keep if coverage is used in CI.                        |
| `dotenv`              | dep     | Yes (e2e only)      | **Misplaced** -- production dependency but only used in `e2e/auth.setup.ts`. Should be moved to `devDependencies`.                                                              |

---

## Task 4: Large File Report

**Files over 300 lines:** 42

| File                                             | Lines | Functions/Components                                                                                                                                                                                             | Decomposition Suggestion                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------ | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shared/foodRegistry.ts`                         | 4,058 | ~160 food entries across 4 zone arrays, 16 exported functions/types, 1 aggregation const.                                                                                                                        | Data-heavy by design -- ~3,800 lines are food entry data. The ~250 lines of logic (types + functions) are already clean. Could split the data arrays into separate zone files (`zone1A.ts`, `zone1B.ts`, `zone2.ts`, `zone3.ts`) and re-aggregate in an index. Low priority.                                                                                                                                                            |
| `convex/logs.ts`                                 | 2,018 | ~30 exported + internal functions. 6 queries, 7 mutations, 1 internalMutation, 1 internalQuery. Plus backup/restore, backfill migrations, and profile/habit normalization helpers (~400 LOC).                    | Split recommended. Extract: (1) `convex/profiles.ts` for replaceProfile, patchProfile, getProfile + all habit/preset normalization helpers (~500 LOC); (2) `convex/backup.ts` for exportBackup, importBackup, deleteAll + helper types/functions (~400 LOC); (3) `convex/logsBackfill.ts` for backfillIngredientExposures, recanonicalizeAllFoodLogs, backfillResolvedBy (~400 LOC). Core logs CRUD would be ~700 LOC.                  |
| `src/lib/aiAnalysis.ts`                          | 1,954 | `buildSystemPrompt`, `buildLogContext`, `buildUserMessage`, `parseAiInsight`, `fetchAiInsights`, `fetchWeeklySummary`, `enforceNovelEducationalInsight`, plus ~20 helper functions and type definitions.         | **Critical.** Extract: (1) `aiAnalysisPrompt.ts` -- system prompt construction and tone matrix (~700 LOC), (2) `aiAnalysisContext.ts` -- log context assembly and user message building (~400 LOC), (3) `aiAnalysisParser.ts` -- `parseAiInsight` and validation (~200 LOC), (4) keep `aiAnalysis.ts` as the orchestrator. Also extract weekly summary into `aiWeeklySummary.ts`.                                                       |
| `convex/migrations.ts`                           | 1,364 | 8 exported mutations (4 internalMutation, 2 mutation, 2 more). ~20 internal helpers. Each migration is self-contained.                                                                                           | Fine as-is -- one-shot operations that will eventually be removed. No active development.                                                                                                                                                                                                                                                                                                                                               |
| `convex/foodParsing.ts`                          | 1,228 | ~15 exported functions, ~10 internal helpers. 3 internalQueries, 3 internalMutations, 1 internalAction, 2 public mutations, 1 public query, plus type definitions and OpenAI helpers.                            | Split recommended. Extract `convex/foodParsingOpenAi.ts` for fetchOpenAiEmbeddings, fetchLlmFallbackChoice, ensureFoodEmbeddings, searchEmbeddingCandidates, tryLlmFallback (~200 LOC).                                                                                                                                                                                                                                                 |
| `e2e/food-pipeline.spec.ts`                      | 1,221 | 10 test sections, 30+ test cases.                                                                                                                                                                                | Low priority for decomposition -- test files benefit from colocation. Helper functions at the top (~140 lines) could be extracted to `e2e/helpers/food-pipeline.ts`.                                                                                                                                                                                                                                                                    |
| `shared/foodEvidence.ts`                         | 966   | 1 entry-point function (`buildFoodEvidenceResult`) with ~15 internal helpers, 3 exported utilities, 8 exported types.                                                                                            | Should decompose. Extract: (1) `foodTrialResolver.ts` -- trial resolution, transit windows, modifier summarization (~250 lines); (2) `foodEvidenceScoring.ts` -- posterior calculation, recency weighting, status derivation (~200 lines); (3) keep `foodEvidence.ts` as the orchestrator (~300 lines).                                                                                                                                 |
| `track/quick-capture/WeightEntryDrawer.tsx`      | 907   | `WeightEntryDrawer`, `WeightTrendChart`, `renderUnitAwareInput`, `computeChartData`, 5+ helpers.                                                                                                                 | **HIGH PRIORITY.** Extract `WeightTrendChart` (200 lines) into its own file, extract `computeChartData` and chart constants into `weightChartUtils.ts`, extract `renderUnitAwareInput` into a shared `UnitAwareInput` component.                                                                                                                                                                                                        |
| `track/today-log/rows/LogEntry.tsx`              | 833   | `LogEntry` handling all 7+ log types in one component.                                                                                                                                                           | **HIGH PRIORITY.** Already partly decomposed via group rows + sub-row editors, but the digestion inline editor (~250 lines) and reproductive editor (~60 lines) inside LogEntry should be extracted into dedicated components.                                                                                                                                                                                                          |
| `convex/foodLibrary.ts`                          | 771   | 5 exported mutations/queries, ~6 internal helpers. mergeDuplicates alone is ~500 LOC.                                                                                                                            | Split recommended. Extract `mergeDuplicates` into `convex/foodLibraryMerge.ts` -- it is a complex multi-table migration-like operation that dominates the file. The remaining CRUD would be ~270 LOC.                                                                                                                                                                                                                                   |
| `src/hooks/useQuickCapture.ts`                   | 743   | `useQuickCapture` (1 hook with 9 handlers: tap, checkbox toggle, fluid, sleep, activity, weight, increment, long-press, close sheet).                                                                            | **High priority.** Extract handler groups into focused hooks: `useFluidCapture`, `useSleepCapture`, `useActivityCapture`, `useWeightCapture`, `useCheckboxToggle`. Sleep handler alone is ~170 lines due to midnight-split logic.                                                                                                                                                                                                       |
| `convex/computeAggregates.ts`                    | 721   | 6 exported mutations (2 internalMutation, 4 public/internal), ~5 internal helpers. Two distinct domains: foodTrialSummary and weeklyDigest.                                                                      | Split recommended. Extract into `convex/computeFoodTrials.ts` (~350 LOC) and `convex/computeWeeklyDigest.ts` (~350 LOC). They share only the `getLatestTimestamp` helper.                                                                                                                                                                                                                                                               |
| `e2e/patterns-food-trials.spec.ts`               | 712   | 7 test sections, 14 test cases.                                                                                                                                                                                  | Low priority -- test files benefit from colocation.                                                                                                                                                                                                                                                                                                                                                                                     |
| `src/lib/habitTemplates.ts`                      | 708   | `HabitConfig`, `HabitLog`, type guards (x10), `HABIT_TEMPLATES`, `validateHabitConfig`, `normalizeHabitConfig`, `createCustomHabit`.                                                                             | Extract template data into `habitTemplateData.ts` (~280 LOC of template objects), keep types/guards/validation in `habitTemplates.ts`.                                                                                                                                                                                                                                                                                                  |
| `track/quick-capture/HabitDetailSheet.tsx`       | 670   | `HabitDetailSheet`, `HabitDetailSheetInner`, day-status helpers.                                                                                                                                                 | Extract `HabitMicroGraph` (7-day visualization, ~70 lines), extract `HabitSettingsForm` (~180 lines), extract `makeNumberSaveHandler` into a utility.                                                                                                                                                                                                                                                                                   |
| `src/pages/Track.tsx`                            | 669   | `TrackPage`, `toActivityTypeKey`, `getHabitsForActivityType`, `getActivityHabitLogValue`.                                                                                                                        | **High priority.** The inline handlers `handleLogBowel`, `handleLogCycle`, `handleDelete`, `handleSave` are 200+ lines of imperative mutation logic. Extract to a `useTrackMutations` hook.                                                                                                                                                                                                                                             |
| `src/lib/habitCoaching.ts`                       | 653   | `generateCoachingSnippet`, `getHeuristicCoachingMessage`, `generateHabitSnippet`, `heuristicHabitSnippet`, `generatePaneSummary`, `heuristicPaneSummary`, `generateSettingsSuggestions`, `heuristicSuggestions`. | Split into tiers: (1) `habitCoachingTier1.ts` -- coaching snippets, (2) `habitCoachingTier2.ts` -- pane summaries, (3) `habitCoachingTier3.ts` -- settings suggestions. Most exports appear to be dead -- verify usage before splitting.                                                                                                                                                                                                |
| `track/FoodMatchingModal.tsx`                    | 653   | `FoodMatchingModal`, `TicketForm`.                                                                                                                                                                               | Extract `TicketForm` (~80 lines) into its own file, extract search/filter section into `FoodSearchList`.                                                                                                                                                                                                                                                                                                                                |
| `shared/foodMatching.ts`                         | 643   | 14 exported functions/types, ~10 internal helpers.                                                                                                                                                               | Should decompose. Extract: (1) `foodMatchTypes.ts` -- all type/interface exports (~85 lines); (2) `foodMatchPreprocessing.ts` -- phrase splitting, text normalization (~100 lines); (3) `foodMatchSearch.ts` -- Fuse config, document building, search, alias lookup (~200 lines); (4) keep `foodMatching.ts` as the routing/merging orchestrator (~250 lines).                                                                         |
| `track/quick-capture/AddHabitDrawer.tsx`         | 637   | `AddHabitDrawer`, `AddHabitDrawerContent`, type/template/custom steps.                                                                                                                                           | Extract each step into its own component: `HabitTypeSelector`, `HabitTemplateList`, `CustomHabitForm`.                                                                                                                                                                                                                                                                                                                                  |
| `src/pages/Patterns.tsx`                         | 593   | `PatternsPage`, `DatabaseTabContent`, `TodayLabel`, plus 4 helper functions.                                                                                                                                     | **Medium priority.** `DatabaseTabContent` (260 lines) is an inline component with heavy state management. Extract to its own file `src/components/patterns/DatabaseTabContent.tsx`. `TodayLabel` (23 lines) is also an isolated component -- extract alongside.                                                                                                                                                                         |
| `convex/validators.ts`                           | 581   | ~30 exported validators, organized by domain section.                                                                                                                                                            | Fine as-is. Validators are naturally centralized. Well-organized with section comments.                                                                                                                                                                                                                                                                                                                                                 |
| `src/types/domain.ts`                            | 582   | 60+ type/interface/constant exports covering 8+ distinct domains.                                                                                                                                                | **Should decompose.** This is a "kitchen sink" type file. Extract: (1) `types/logTypes.ts` (~120 lines); (2) `types/healthProfile.ts` (~100 lines); (3) `types/aiPreferences.ts` (~120 lines); (4) `types/baselines.ts` (~80 lines); (5) keep `domain.ts` as a slim barrel re-export (~100 lines).                                                                                                                                      |
| `src/lib/sync.ts`                                | 530   | ~30 Convex hook wrappers, `SyncedLog`, `FoodLibraryEntry`, type adapters.                                                                                                                                        | Group by domain: (1) `sync/logs.ts`, (2) `sync/foodLibrary.ts`, (3) `sync/conversations.ts`, (4) `sync/foodAssessments.ts`, (5) `sync/ingredients.ts`, (6) `sync/weeklySummaries.ts`, with a `sync/index.ts` barrel.                                                                                                                                                                                                                    |
| `src/routeTree.tsx`                              | 525   | `GlobalHeader`, `AppLayout`, `AuthLoadingFallback`, `LegacyMigration`, `RouteErrorBoundary`, 10 route definitions.                                                                                               | **High priority.** This file combines route definitions with 5 substantial components (GlobalHeader alone is 110 lines). Extract: `GlobalHeader` -> `src/components/layout/GlobalHeader.tsx`, `AppLayout` -> `src/components/layout/AppLayout.tsx`, `RouteErrorBoundary` -> `src/components/layout/RouteErrorBoundary.tsx`, `LegacyMigration` -> `src/components/layout/LegacyMigration.tsx`. Leave route definitions in routeTree.tsx. |
| `track/today-log/editors/FoodSubRow.tsx`         | 521   | `FoodSubRow`, `ResolutionDot`, `FoodItemLine`.                                                                                                                                                                   | Moderately decomposed. `ResolutionDot` and `FoodItemLine` could live in their own file as shared food display primitives.                                                                                                                                                                                                                                                                                                               |
| `track/panels/BowelSection.tsx`                  | 499   | `BowelSection`, `SeverityScale`, `VolumeScale`, `TripStepper`.                                                                                                                                                   | Extract `SeverityScale`, `VolumeScale`, `TripStepper` into `bowelFormControls.tsx` (~130 lines).                                                                                                                                                                                                                                                                                                                                        |
| `src/lib/digestiveCorrelations.ts`               | 480   | `computeCorrelations`, `computeDigestiveMetrics`, `buildPaneSummaryContexts`, pane config builders.                                                                                                              | File is internally coherent but could extract the 4 pane config builders (~100 LOC) into `digestivePaneConfigs.ts`.                                                                                                                                                                                                                                                                                                                     |
| `src/lib/foodParsing.ts`                         | 457   | `parseFood`, `buildParsedFoodData`, validation functions, normalization.                                                                                                                                         | Borderline. Validation/normalization could move to `foodParsingValidation.ts` (~100 LOC).                                                                                                                                                                                                                                                                                                                                               |
| `track/today-log/helpers.ts`                     | 404   | ~25 utility functions.                                                                                                                                                                                           | Split into `foodItemHelpers.ts` (resolution, display), `logDisplayHelpers.ts` (icon, color, title, detail), `dateTimeHelpers.ts`, `reproductiveHelpers.ts`.                                                                                                                                                                                                                                                                             |
| `shared/foodParsing.ts`                          | 402   | 7 exported functions, 3 exported types.                                                                                                                                                                          | Borderline. Could extract quantity parsing constants + `parseLeadingQuantity` into `foodQuantityParsing.ts` (~180 lines). The remaining file would be ~220 lines. Low priority.                                                                                                                                                                                                                                                         |
| `convex/extractInsightData.ts`                   | 401   | 3 exported mutations, ~10 internal helpers for assessment extraction.                                                                                                                                            | Fine as-is. Cohesive extraction logic. Would not benefit from splitting.                                                                                                                                                                                                                                                                                                                                                                |
| `convex/foodLlmMatching.ts`                      | 399   | 2 exported items (`_testing`, `matchUnresolvedItems`), ~6 internal functions.                                                                                                                                    | Needs investigation. The `matchUnresolvedItems` action is **stubbed** (returns immediately). The file contains ~350 LOC of prompt building, response parsing, and post-processing only used by tests. Either finish implementing the client-triggered path, or delete the file.                                                                                                                                                         |
| `convex/schema.ts`                               | 376   | 1 default export (schema definition with 17 tables).                                                                                                                                                             | Fine as-is. Schema is naturally centralized.                                                                                                                                                                                                                                                                                                                                                                                            |
| `src/lib/baselineAverages.ts`                    | 361   | `computeBaselineAverages`, `buildTodayHash`.                                                                                                                                                                     | Just over threshold. Single concern -- acceptable.                                                                                                                                                                                                                                                                                                                                                                                      |
| `track/today-log/editors/ReproductiveSubRow.tsx` | 359   | `ReproductiveSubRow`.                                                                                                                                                                                            | Acceptable size for a complex editor, but the editing form (~120 lines) could be extracted.                                                                                                                                                                                                                                                                                                                                             |
| `src/pages/secondary_pages/Menu.tsx`             | 351   | `MenuPage`, `FoodRow`, `ZoneSection`, `SummaryBar`, `formatStatusLabel`, `getStatusBadgeClasses`.                                                                                                                | Low priority. Well-structured with clear sub-components. Could extract to `src/components/menu/` if the file grows.                                                                                                                                                                                                                                                                                                                     |
| `src/hooks/useAiInsights.ts`                     | 345   | `useAiInsights` (1 hook: builds data refs, runs analysis, debounced trigger).                                                                                                                                    | Medium priority. The hook body is dense but conceptually single-purpose. Could extract the `dataRef` snapshot management into a separate `useAiInsightsDataRefs` hook, and the payload construction into a pure function.                                                                                                                                                                                                               |
| `track/panels/CycleHormonalSection.tsx`          | 311   | `CycleHormonalSection`, `BleedingGlyph`.                                                                                                                                                                         | Extract `BleedingGlyph` into a shared component, extract bleeding status button row.                                                                                                                                                                                                                                                                                                                                                    |
| `shared/foodNormalize.ts`                        | 309   | 4 exported functions, ~6 internal helpers.                                                                                                                                                                       | Borderline. The `prefersSummaryCandidate` function is logically unrelated to food name normalization -- extract it to a small `foodSummaryUtils.ts` to improve cohesion.                                                                                                                                                                                                                                                                |
| `src/pages/secondary_pages/Archive.tsx`          | 301   | `ArchivePage`.                                                                                                                                                                                                   | Low priority. Just at the threshold. Single page component with filter/pagination logic. Reasonable as-is.                                                                                                                                                                                                                                                                                                                              |
| `settings/TrackingForm.tsx`                      | ~300  | `TrackingForm` with habit reorder.                                                                                                                                                                               | Could extract habit reorder DnD into `HabitReorderList`.                                                                                                                                                                                                                                                                                                                                                                                |

---

## Task 5: Function Call Traces

### Flow 1: User Logs a Food Item

#### Happy Path

**1. `src/components/track/panels/FoodSection.tsx` -- `submitFood()` (line 45)**

User types text into the food input field and presses Enter or clicks "Log Food." The `submitFood()` closure:

- Validates `foodName.trim()` is non-empty (toast + inline error if empty).
- Saves all input state for error rollback (`savedName`, `savedTimeValue`, `savedActivePreset`, `savedTimestampMs`).
- Checks if the input matches an active custom food preset badge (case-insensitive comparison). If so, marks the item with `fromPreset: true` and attaches `presetIngredients`.
- Builds a `ParsedItem` object: `{ name, quantity: "", unit: "", fromPreset?, presetIngredients? }`.
- Optimistically clears the input field, active preset, and time picker to keep the UI responsive.
- Calls `onLogFood([item], "", savedName, savedTimestampMs)` -- a Promise. On `.catch`, restores all saved input state and shows a toast error. On `.finally`, sets `saving = false`.

**2. `src/pages/Track.tsx` -- wiring (line 251 + 608)**

The Track page instantiates `useFoodParsing({ afterSave })` and passes `handleLogFood` to `<FoodSection onLogFood={handleLogFood} />`.

```
const { handleLogFood } = useFoodParsing({ afterSave });
// afterSave = celebrateLog() -- triggers a confetti burst
```

**3. `src/hooks/useFoodParsing.ts` -- `handleLogFood()` (line 28)**

This hook is thin. It:

- Ignores the `_items` parameter entirely (the `ParsedItem[]` from FoodSection is unused).
- Trims `notes`, defaults timestamp to `Date.now()`.
- Calls `addSyncedLog()` with:
  ```ts
  {
    timestamp: ts,
    type: "food",
    data: {
      rawInput: rawText,   // the original user-typed string
      items: [],           // always empty -- server handles parsing
      notes: trimmedNotes,
    },
  }
  ```
- After the Promise resolves, calls `afterSave()` (confetti).

**Key observation:** The `ParsedItem[]` built in FoodSection (with `fromPreset`, `presetIngredients`) is never sent to the server. The server only receives `rawInput` (the raw text string). Preset metadata is discarded here.

**4. `src/lib/sync.ts` -- `useAddSyncedLog()` (line 142)**

A thin wrapper around `useMutation(api.logs.add)`. It:

- Sanitizes the `data` payload via `sanitizeLogData()` (which calls `sanitizeUnknownStringsDeep()` -- strips control characters, normalizes Unicode, caps string lengths).
- Calls the Convex mutation `api.logs.add` with `{ timestamp, type: "food", data }`.

**5. `convex/logs.ts` -- `add` mutation (line 831)**

The server-side Convex mutation:

- Authenticates the user via `ctx.auth.getUserIdentity()`.
- Sanitizes strings again with `sanitizeUnknownStringsDeep()`.
- Inserts a row into the `"logs"` table: `{ userId, timestamp, type: "food", data }`.
- Detects new-style food logs: checks `foodData.rawInput && (!foodData.items || items.length === 0)`.
  - If true (normal path): Schedules `internal.foodParsing.processLogInternal` via `ctx.scheduler.runAfter(0, ...)` -- the server-side food matching pipeline runs asynchronously.
  - If false (legacy path): Calls `rebuildIngredientExposuresForFoodLog()` synchronously (items were already pre-parsed by old client code).
- Returns the new `logId`.

**6. `convex/foodParsing.ts` -- `processLogInternal` internalAction (line 877)**

This is the server-side food matching pipeline, running as a Convex action (can call external APIs). Steps:

**6a. Load snapshot** (line 880): Queries `getFoodLogForProcessing` to get `{ logId, userId, rawInput }`.

**6b. Preprocess** (line 886): Calls `preprocessMealText(rawInput)` from `shared/foodMatching.ts`:

- Splits raw text on commas, `and`, `with`, `&`, newlines (via `splitMealIntoFoodPhrases`).
- Protects multi-word food names (e.g. "fish and chips") from being split.
- For each phrase, calls `parseLeadingQuantity()` from `shared/foodParsing.ts` to extract quantity/unit.
- Normalizes the parsed name (lowercase, strip accents, collapse whitespace).
- Returns `PreprocessedFoodPhrase[]`.

If no phrases are found, writes empty items and returns.

**6c. Load learned aliases** (line 895): Queries `listFoodAliasesForUser` to get both global and user-specific food aliases from the `foodAliases` table.

**6d. Create matcher context** (line 899): Calls `createFoodMatcherContext(learnedAliases)` from `shared/foodMatching.ts`:

- Builds `FoodSearchDocument[]` from `FOOD_REGISTRY` (static registry) + learned aliases.
- Creates a Fuse.js instance for fuzzy search.
- Builds `exactAliasMap` (normalized text -> document) and `documentMap` (canonical name -> document).

**6e. Generate embeddings** (line 901-916): Attempts to ensure food embeddings are up-to-date in the `foodEmbeddings` table, then fetches OpenAI embeddings for each phrase's `parsedName` using `text-embedding-3-small`. Falls back to fuzzy-only if the embedding layer fails (missing API key, API error).

**6f. Per-phrase matching loop** (line 920-976):

For each preprocessed phrase:

1. **Fuzzy search** (line 922): `fuzzySearchFoodCandidates(phrase.parsedName, matcherContext)` -- checks exact alias map first (instant match), then Fuse.js fuzzy search.

2. **Embedding search** (line 932-942): `searchEmbeddingCandidates(ctx, phraseEmbeddings[index])` -- Convex vector search over `foodEmbeddings` table, returns top 5 candidates with cosine similarity scores.

3. **Merge candidates** (line 944): `mergeFoodMatchCandidates(fuzzy, embedding, context)` -- combines fuzzy and embedding scores (65% fuzzy + 35% embedding for overlapping candidates), sorts by combined confidence.

4. **Route confidence** (line 949): `routeFoodMatchConfidence(phrase, mergedCandidates)`:
   - High confidence (>= 0.86 with sufficient gap): Auto-resolve as `"registry"` via `toResolvedItem()`.
   - Medium confidence (>= 0.56): Store as pending with candidates/buckets for user review.
   - Low confidence (< 0.56): If `isStructurallyAmbiguousPhrase()` (5+ tokens or contains "mixed"/"stuffed"/etc.) AND has candidates, try LLM fallback.

5. **LLM fallback** (line 956-973): `tryLlmFallback(phrase, route.candidates)` -- calls OpenAI `gpt-4o-mini` with a minimal prompt asking it to pick the best candidate from the top 3. If it returns a valid canonical name, resolves as `"llm"`. Uses the server's `OPENAI_API_KEY` env var (not the client's BYOK key).

6. **Pending items** (line 975): If no match is found, stores the item as pending via `toPendingItem()` with `matchCandidates` and `bucketOptions` for the user review modal.

**6g. Write results** (line 978): `writeProcessedItems` internalMutation -- patches the log document's `data.items` array with the processed items, increments `itemsVersion`.

**6h. Schedule evidence processing** (line 983): `ctx.scheduler.runAfter(EVIDENCE_WINDOW_MS, ...)` -- schedules `processEvidence` to run after 6 hours.

**7. `convex/foodParsing.ts` -- `processEvidence` internalMutation (line 1044)**

Runs 6 hours after the food log was created:

- Marks any still-unresolved items as `canonicalName: "unknown_food"`, `resolvedBy: "expired"`.
- Creates `ingredientExposures` records for all resolved items (used for transit timing and food evidence analysis).
- Sets `evidenceProcessedAt` timestamp on the log data.

#### Error/Fallback Branches

- **At step 1 (FoodSection):** If text is empty, shows inline error + toast, does not proceed.
- **At step 1 (FoodSection):** If `onLogFood` Promise rejects, restores all input fields from saved state and shows toast error.
- **At step 5 (logs.add):** If user is not authenticated, throws `"Not authenticated"`. Client receives error, FoodSection restores input.
- **At step 6e (embeddings):** If `OPENAI_API_KEY` is not set on the server, the embedding layer is skipped entirely -- matching proceeds with fuzzy-only (no semantic search). Logged to console.
- **At step 6f.2 (embedding search):** If vector search fails for a specific phrase, that phrase proceeds with fuzzy-only candidates. Logged to console.
- **At step 6f.5 (LLM fallback):** If the OpenAI call fails, the phrase stays as a pending item for user review. Logged to console.
- **At step 6g (writeProcessedItems):** If the log was deleted between steps, the mutation silently returns (checks `if (!log || log.type !== "food") return`).

#### Files Involved

| File                                          | Purpose                                                                                                                                       |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/track/panels/FoodSection.tsx` | UI: food text input, submit handler, preset badges                                                                                            |
| `src/pages/Track.tsx`                         | Wiring: connects FoodSection to useFoodParsing hook                                                                                           |
| `src/hooks/useFoodParsing.ts`                 | Client hook: packages raw text for server                                                                                                     |
| `src/lib/sync.ts`                             | Client: `useAddSyncedLog()` -- sanitizes and calls `api.logs.add`                                                                             |
| `src/lib/inputSafety.ts`                      | Client: `sanitizeUnknownStringsDeep()` -- input sanitization                                                                                  |
| `convex/logs.ts`                              | Server: `add` mutation -- inserts log, schedules processing                                                                                   |
| `convex/foodParsing.ts`                       | Server: `processLogInternal` -- full matching pipeline                                                                                        |
| `shared/foodMatching.ts`                      | Shared: `preprocessMealText`, `fuzzySearchFoodCandidates`, `mergeFoodMatchCandidates`, `routeFoodMatchConfidence`, `createFoodMatcherContext` |
| `shared/foodParsing.ts`                       | Shared: `parseLeadingQuantity` -- quantity/unit extraction                                                                                    |
| `shared/foodRegistry.ts`                      | Shared: `FOOD_REGISTRY` static data, `getFoodZone`, `isCanonicalFood`                                                                         |

---

### Flow 2: Food Item Goes Through LLM Matching

#### Overview: Two Paths Exist (One Active, One Dormant)

There are **two** LLM matching paths in the codebase:

1. **Server-side LLM fallback** (ACTIVE) -- built into `processLogInternal` in `convex/foodParsing.ts`. Uses the server's `OPENAI_API_KEY` env var. Triggered automatically during server-side processing for structurally ambiguous phrases with low confidence.

2. **Client-initiated BYOK LLM matching** (DORMANT) -- the `useFoodLlmMatching` hook + `matchUnresolvedItems` action. This was the original design (client passes their own API key from IndexedDB), but it is currently **disabled**:
   - `useFoodLlmMatching` is defined in `src/hooks/useFoodLlmMatching.ts` but **never imported or called** from any component.
   - `matchUnresolvedItems` action in `convex/foodLlmMatching.ts` is a **no-op stub** (line 390-398): logs a warning and returns `{ matched: 0, unresolved: 0 }`.
   - `applyLlmResults` mutation in `convex/foodParsing.ts` (line 997-1038) **throws an error** if called.

#### Flow 2A: Server-Side LLM Fallback (Active Path)

##### Trigger

During `processLogInternal` (step 6f above), when a phrase routes to `level: "low"` confidence AND `isStructurallyAmbiguousPhrase()` returns true AND there are candidates available.

##### Happy Path

1. **`convex/foodParsing.ts` -- `processLogInternal` loop (line 956)**

   Condition: `route.level === "low" && isStructurallyAmbiguousPhrase(phrase) && route.candidates.length > 0`.

2. **`convex/foodParsing.ts` -- `tryLlmFallback()` (line 790)**
   - Retrieves server API key via `getServerOpenAiApiKey()` (reads `process.env.OPENAI_API_KEY`).
   - If no key, returns `null` (phrase stays pending).

3. **`convex/foodParsing.ts` -- `fetchLlmFallbackChoice()` (line 540)**
   - Sends a request to `https://api.openai.com/v1/chat/completions` using `gpt-4o-mini`, `temperature: 0`.
   - System prompt: "You choose the closest food registry canonical from a short list. Reply with the exact canonical name or the single word none."
   - User prompt: JSON object with the phrase and top 3 candidates (canonical name, zone, group, line, bucket label, confidence, up to 4 examples each).
   - Parses response: strips quotes, normalizes text, looks up the returned name in the candidate list.
   - Returns the matched canonical name, or `null` if "none" or unrecognized.

4. **`convex/foodParsing.ts` -- `tryLlmFallback()` continues (line 804)**

   If a valid canonical name was returned:
   - Creates a modified candidate with `resolver: "llm"` and `combinedConfidence: Math.max(original, 0.6)`.
   - Returns this candidate.

5. **`convex/foodParsing.ts` -- `processLogInternal` loop (line 963-965)**

   If `tryLlmFallback` returned a candidate:
   - Calls `toResolvedItem(phrase, llmCandidate, "llm")` -- creates a `ProcessedFoodItem` with `resolvedBy: "llm"`, `matchStrategy: "llm"`.

6. **`convex/foodParsing.ts` -- `writeProcessedItems` (line 978)**

   Writes the resolved item to the log's `data.items` array (same as Flow 1 step 6g).

##### Error/Fallback Branch

- **Missing server API key:** `tryLlmFallback` returns `null`. Phrase stays as a pending item for manual user resolution.
- **OpenAI API error:** `fetchLlmFallbackChoice` throws. Caught at line 967-972, logged to console. Phrase stays pending.
- **LLM returns "none" or unrecognized name:** `fetchLlmFallbackChoice` returns `null`. Phrase stays pending.
- **LLM hallucinates a name not in candidates:** The lookup `candidates.find(c => c.canonicalName === canonicalName)` returns undefined, so `fetchLlmFallbackChoice` returns `null`. Phrase stays pending.

##### Files Involved

| File                     | Purpose                                                                   |
| ------------------------ | ------------------------------------------------------------------------- |
| `convex/foodParsing.ts`  | `tryLlmFallback()`, `fetchLlmFallbackChoice()`, `getServerOpenAiApiKey()` |
| `shared/foodMatching.ts` | `isStructurallyAmbiguousPhrase()`, `routeFoodMatchConfidence()`           |

#### Flow 2B: Client-Initiated BYOK LLM Matching (Dormant Path)

This path is fully coded but **not connected**. Documented here for completeness since it was the original design.

##### Trigger (Would Be)

The `useFoodLlmMatching` hook (if it were called) monitors all food logs via `useSyncedLogsContext()`. When it finds food logs from the last 6 hours with items that have no `canonicalName` and no `resolvedBy`, it fires the `matchUnresolvedItems` action.

##### Would-Be Happy Path

1. **`src/hooks/useFoodLlmMatching.ts` -- `useFoodLlmMatching()` (line 70)** [NOT CALLED]
   - Gets logs from `useSyncedLogsContext()`.
   - Gets API key from `useApiKeyContext()` (which reads from `useApiKey` hook, which loads from IndexedDB via `src/lib/apiKeyStore.ts`).
   - Calls `findLogsNeedingLlmMatching(logs, nowMs)` -- filters to food logs within 6 hours that have items with no `canonicalName` and no `resolvedBy`.
   - For each qualifying log (tracked by ref Set to avoid duplicates):
     - Extracts `unresolvedSegments` from items that pass `isItemUnresolvedForLlm()`.
     - Calls `matchItemsRef.current({ apiKey, logId, rawInput, unresolvedSegments })`.

2. **`src/lib/apiKeyStore.ts` -- IndexedDB storage (line 1-16)**

   Uses `idb-keyval` library with key `"caca-traca-openai-key"`:
   - `getApiKey()` -- reads from IndexedDB.
   - `setApiKey(key)` -- writes to IndexedDB.
   - `clearApiKey()` -- deletes from IndexedDB.

   This is wrapped by `src/hooks/useApiKey.ts` which loads the key on mount and exposes `{ apiKey, hasApiKey, loading, updateKey, removeKey }`, further wrapped by `src/contexts/ApiKeyContext.tsx`.

3. **`convex/foodLlmMatching.ts` -- `matchUnresolvedItems` action (line 383)** [CURRENTLY A NO-OP]

   The action currently just logs a warning and returns `{ matched: 0, unresolved: 0 }`. If it were active, it would:
   - Build a registry vocabulary prompt from `FOOD_REGISTRY` via `buildRegistryVocabularyForPrompt()`.
   - Build system + user messages via `buildMatchingPrompt()` -- sanitizes user input, creates structured JSON in user message (prevents prompt injection).
   - Call OpenAI chat completions API with the user's API key.
   - Parse the JSON response via `parseLlmResponse()` -- validates schema, strips code fences.
   - Process results via `processLlmResults()`:
     - Verifies each LLM-suggested canonical name against the registry via `getFoodZone()`.
     - Falls back to `canonicalizeKnownFoodName()` for hallucinated names.
     - Items the LLM marks as `"NOT_ON_LIST"` stay unresolved.
   - Write results back via `applyLlmResults` mutation (also currently throws an error).

##### Error/Fallback Branches (If Active)

- **No API key in IndexedDB:** Hook exits early at line 92 (`if (!hasApiKey || !apiKeyRef.current) return`). No matching attempted.
- **Non-retryable errors** (invalid key, auth failure): Log ID stays in `sentLogIdsRef` Set -- prevents retry loops.
- **Retryable errors** (rate limit, server error): Log ID is removed from `sentLogIdsRef` Set -- next render cycle will retry.
- **LLM returns invalid JSON:** `parseLlmResponse()` returns `null`. Matching fails silently.
- **LLM hallucinates canonicals not in registry:** `processLlmResults()` tries `canonicalizeKnownFoodName()` as a fallback. If that also fails, item stays unresolved.

##### Files Involved

| File                              | Purpose                                                           |
| --------------------------------- | ----------------------------------------------------------------- |
| `src/hooks/useFoodLlmMatching.ts` | Client hook: detects unresolved items, calls action (DORMANT)     |
| `src/contexts/ApiKeyContext.tsx`  | React context: wraps `useApiKey`                                  |
| `src/hooks/useApiKey.ts`          | Hook: loads API key from IndexedDB on mount                       |
| `src/lib/apiKeyStore.ts`          | IndexedDB CRUD for OpenAI API key via `idb-keyval`                |
| `convex/foodLlmMatching.ts`       | Server action: full LLM matching pipeline (STUBBED OUT)           |
| `convex/foodParsing.ts`           | `applyLlmResults` mutation (THROWS ERROR)                         |
| `shared/foodRegistry.ts`          | Registry data for vocabulary prompt and validation                |
| `shared/foodCanonicalization.ts`  | `canonicalizeKnownFoodName()` -- deterministic name normalization |
| `shared/foodParsing.ts`           | `parseLeadingQuantity()` -- quantity extraction                   |
| `convex/lib/inputSafety.ts`       | `sanitizePlainText()` -- input sanitization for prompts           |

#### Flow 2C: Manual User Resolution (Unresolved Item Review)

When the server pipeline leaves items as "pending" (medium or low confidence), the user can manually resolve them.

##### Trigger

1. **`src/hooks/useUnresolvedFoodToast.ts`** -- monitors logs for unresolved items within a 6-hour window. Shows a persistent toast notification:
   - Hours 0-3: gentle message ("N foods couldn't be matched").
   - Hours 3-6: urgent message ("N foods still unmatched -- will be excluded from analysis").
   - Toast has a "Review" action button.

2. **`src/hooks/useUnresolvedFoodQueue.ts`** -- builds a flat queue of `UnresolvedQueueItem[]` from all food logs with "pending" status items.

3. **`src/pages/Track.tsx` (line 230-244)** -- wires the toast callback to open the `FoodMatchingModal`.

##### Happy Path

1. User clicks "Review" on the toast (or the queue opens automatically).
2. **`src/components/track/FoodMatchingModal.tsx`** opens in queue mode, showing one unresolved item at a time.
3. Modal displays:
   - Candidate suggestions from the server pipeline's `matchCandidates` (with confidence %).
   - Bucket options for category-level navigation.
   - Full registry search via `api.foodParsing.searchFoods` query.
   - "Request it be added" link for foods not in the registry.
4. User selects a canonical name and clicks "Match".
5. **`FoodMatchingModal` -- `handleSave()` (line 159)**: calls `resolveItem` mutation.
6. **`convex/foodParsing.ts` -- `resolveItem` mutation (line 1137)**:
   - Validates auth, ownership, item index range.
   - Checks item is not already resolved (throws `ConvexError` if it is).
   - Validates canonical name exists in registry via `isCanonicalFood()`.
   - Updates the item with `resolvedBy: "user"`, `matchStrategy: "user"`, `matchConfidence: 1`.
   - Clears `matchCandidates` and `bucketOptions` from the item.
   - Learns the alias: calls `upsertLearnedAlias()` to save `parsedName -> canonicalName` in the `foodAliases` table, so future matching of the same text auto-resolves.

---

### Flow 3: Dr. Poo Report Generation

#### Triggers

##### 1. Automatic trigger: Bowel movement log (background)

- **Component:** `src/pages/Track.tsx` line 321
- **Action:** User submits a bowel movement via `handleLogBowel()`. After the log is saved, if the `bmTriggersAnalysis` toggle is true, `triggerAnalysis(timestamp)` is called.
- **Debounce:** `triggerAnalysis` (line 318 of `src/hooks/useAiInsights.ts`) performs a data-aware debounce: it skips the call if no new bowel data exists since the last analysis AND less than 60 seconds (`DEBOUNCE_MS`) have elapsed. If there IS new data, it proceeds to `runAnalysis()`.

##### 2. Manual trigger: "Send now" button or asking Dr. Poo

- **Component:** `src/components/track/dr-poo/ReplyInput.tsx` line 31 -- user types a message and presses Enter or taps Send. This calls `addReply(trimmed)` which writes a `conversations` row (role `"user"`, no `aiAnalysisId` yet) via Convex mutation `api.conversations.addUserMessage`.
- **Component:** `src/components/track/dr-poo/ReplyInput.tsx` line 71 -- if pending replies exist, a "Send now" button appears. Clicking it calls `onSendNow()`.
- **Wiring:** `onSendNow` is passed from `Track.tsx` line 549 (`<AiInsightsSection onSendNow={sendNow} />`) through to `ConversationPanel` (line 109 in `AiInsightsSection.tsx`) and down to `ReplyInput` (line 184 in `ConversationPanel.tsx`).
- **Resolution:** `sendNow` is `runAnalysis` returned from `useAiInsights()` at `Track.tsx` line 102.

#### Happy Path

##### Step 1: `useAiInsights()` hook gathers reactive data

**File:** `src/hooks/useAiInsights.ts` (lines 58-344)

The hook subscribes to all data needed for the report via Convex reactive queries and Zustand state:

| Data source          | Hook/query                                 | Purpose                                                                  |
| -------------------- | ------------------------------------------ | ------------------------------------------------------------------------ |
| API key              | `useApiKeyContext()` line 59               | User's OpenAI key from IndexedDB                                         |
| Convex action        | `useAction(api.ai.chatCompletion)` line 60 | Relay for OpenAI calls                                                   |
| Logs                 | `useSyncedLogsContext()` line 69           | All user log entries (food, bowel, habit, fluid, activity, reproductive) |
| Analysis history     | `useAiAnalysisHistory(500)` line 72        | Last 500 reports for educational insight dedup                           |
| Latest success       | `useLatestSuccessfulAiAnalysis()` line 73  | For debounce comparison                                                  |
| Food trials          | `useAllFoodTrials()` line 84               | Food trial summaries from `foodTrialSummary` table                       |
| Weekly digests       | `useWeeklyDigests(4)` line 86              | Last 4 weeks of aggregate stats                                          |
| Conversation history | `useConversationsByDateRange()` line 99    | Current half-week messages                                               |
| Recent suggestions   | `useSuggestionsByDateRange()` line 102     | Suggestion spaced-repetition tracking                                    |
| Weekly summary       | `useLatestWeeklySummary()` line 104        | Prior half-week narrative recap                                          |
| Health profile       | `useHealthProfile()` line 63               | Surgery date, conditions, meds, lifestyle, reproductive health           |
| AI preferences       | `useAiPreferences()` line 64               | Tone, length, format, model, meal schedule                               |
| Baseline averages    | Zustand `state.baselineAverages` line 65   | Today vs. historical baselines for habits/fluids                         |
| Pending replies      | `usePendingReplies()` line 62              | Unclaimed user messages in `conversations` table                         |
| Pane summaries       | Zustand `state.paneSummaryCache` line 170  | Habit-digestion correlation insights                                     |

All these are kept in a `dataRef` (lines 113-138) so the `runAnalysis` callback always reads the freshest values.

##### Step 2: `runAnalysis()` starts (line 140)

1. Guard checks (lines 141-143): bail if no API key or if a request is already in flight (`loadingRef`).
2. Abort controller (lines 146-149): creates a new `AbortController`, sets `loadingRef.current = true`.
3. Status update (line 151): `setAiAnalysisStatus("sending")` -- Zustand store updates, UI shows `AnalysisProgressOverlay` with "Sending logs to AI..." spinner.
4. Snapshot pending replies (line 154): captures current pending reply text before the delay.
5. Reactive delay (line 157): waits 1500ms (`REACTIVE_DELAY_MS`) for Convex reactive queries to include the just-logged entry.
6. Fresh data read (lines 160-167): reads `dataRef.current.logs`. Checks that either bowel context exists OR the user asked a question. If neither, sets status to `"error"` with message and exits.
7. Habit correlation extraction (lines 170-187): reads `paneSummaryCache` from Zustand for water/walk/sleep/destructive correlation insights.
8. Build previous reports (lines 190-198): filters analysis history to only successful reports with non-null insights, maps to `PreviousReport[]`.

##### Step 3: Call `fetchAiInsights()` (line 204)

**File:** `src/lib/aiAnalysis.ts` (line 1631)

Sub-steps:

1. **Rate limit check** (line 1641): `checkRateLimit()` from `src/lib/aiRateLimiter.ts`. Currently a no-op (MIN_CALL_INTERVAL_MS = 0), kept as a hook for future token-budget throttling.

2. **Input sanitization** (lines 1642-1659): All inputs pass through `sanitizeUnknownStringsDeep()` from `src/lib/inputSafety.ts` to enforce max string lengths and strip dangerous content.

3. **Build log context** (line 1661): `buildLogContext(safeLogs)` (line 323) filters logs to last 72 hours (`CONTEXT_WINDOW_HOURS`), then separates and formats into typed arrays: `foodLogs`, `bowelEvents`, `habitLogs`, `fluidLogs`, `activityLogs`, `reproductiveLogs`. Each includes human-readable timestamps.

4. **Model validation** (line 1680): `getValidInsightModel(prefs.aiModel)` resolves the user's chosen model (default: `"gpt-5.4"`) with legacy alias support.

5. **Build system prompt** (line 1682): `buildSystemPrompt(safeHealthProfile, prefs)` (line 622) constructs a massive system prompt (~1200 lines in the source) containing:
   - Patient profile (surgery type/date, demographics, weight/height/BMI, comorbidities, medications, supplements, allergies, intolerances, lifestyle factors including smoking/alcohol/recreational detail, reproductive health)
   - Tone matrix selection based on `approach` x `register` preferences (9 combinations: supportive/personal/analytical x everyday/mixed/clinical)
   - Preferred name usage
   - Response priority rules
   - User request override (highest priority -- fulfil patient questions even if they conflict with format/length constraints)
   - The "Prime Directive": Dr. Poo is a clinical detective, not a calculator
   - Baseline comparison usage instructions
   - Deductive reasoning framework (7 sections)
   - Bristol stool interpretation for post-anastomosis patients
   - Stalled transit detection
   - Meal planning rules (optional, de-emphasised)
   - Autonomy and Trade-Off Engine (8 rules)
   - Mini challenge gamification rules
   - Habit-digestion correlation insight integration
   - Time awareness
   - Complete JSON output schema with field-by-field rules
   - Structure and length preference directives

6. **Build conversation history** (lines 1692-1703): Appends up to 20 most recent messages from the current half-week as alternating user/assistant messages.

7. **Build user message payload** (line 1746): `buildUserMessage()` (line 1275) constructs a JSON payload containing:
   - `currentTime`, `daysPostOp`
   - `foodLogs`, `bowelEvents`, `habitLogs`, `fluidLogs`, `activityLogs`
   - `cycleHormonalLogs` (if reproductive tracking enabled)
   - `reproductiveHealthContext` (cycle day, gestational age, etc.)
   - `patientMessages` (user replies, or explicit "NONE" marker)
   - `recentSuggestionHistory` (grouped by text with repeat counts)
   - `foodTrialDatabase` (up to 50 most recently assessed foods)
   - `weeklyTrends` (last 4 weeks of aggregate data)
   - `previousWeekRecap` (last weekly summary narrative)
   - `habitCorrelationInsights` (water/walk/sleep/destructive correlations)
   - `baselineComparison` (today vs. historical averages)

8. **Token estimate warning** (lines 1768-1778): Estimates tokens (~chars/4) and logs a warning if over 50,000.

9. **API call** (lines 1780-1793): Calls `callAi()` which is `useAction(api.ai.chatCompletion)` -- a Convex action.

##### Step 4: Convex action `chatCompletion` relays to OpenAI

**File:** `convex/ai.ts` (lines 17-67)

1. Auth check (line 36): `requireAuth(ctx)` verifies the Convex user identity.
2. API key validation (line 37): Regex check (`/^sk-[A-Za-z0-9_-]{20,}$/`) -- rejects malformed keys.
3. OpenAI client (lines 41-42): Dynamically imports `openai`, creates client with the transiently-provided key (never stored server-side).
4. Chat completion (lines 44-54): Calls `client.chat.completions.create()` with the model, messages, temperature, max_tokens, and `response_format: { type: "json_object" }`.
5. Return (lines 56-65): Returns `{ content, usage }` to the client.

##### Step 5: Response parsing and enrichment (back in `fetchAiInsights`)

**File:** `src/lib/aiAnalysis.ts` (lines 1794-1829)

1. Duration measurement (line 1794): `performance.now()` delta.
2. JSON parse (lines 1796-1801): Parses `rawContent`. Throws if invalid JSON.
3. Structured parse (line 1803): `parseAiInsight(parsed)` (line 1441) validates and normalizes every field of the AI response into a typed `AiNutritionistInsight`. Missing/malformed fields get safe defaults (e.g., default "Plain white rice" for `nextFoodToTry`).
4. Force null directResponse (lines 1809-1812): If no patient messages were pending, forces `directResponseToUser = null` regardless of what the model returned.
5. Educational insight dedup (line 1814): `enforceNovelEducationalInsight()` checks against all previous reports' educational insights. If the model returned a duplicate, picks a fallback from the local `FALLBACK_EDUCATIONAL_INSIGHTS` bank (10 entries).
6. Truncation for storage (lines 1816-1821): Messages are truncated to `INPUT_SAFETY_LIMITS.aiPayloadString` length for Convex storage.
7. Return (lines 1823-1829): Returns `{ insight, request, rawResponse, durationMs, inputLogCount }`.

##### Step 6: Store results in Convex (back in `runAnalysis`)

**File:** `src/hooks/useAiInsights.ts` (lines 256-292)

1. Mark baseline consumed (line 258): `markInsightRun()` -- Zustand records that the current baseline data has been used.
2. Save analysis (line 261): `addAiAnalysis()` calls `api.aiAnalyses.add` mutation.

**File:** `convex/aiAnalyses.ts` (lines 11-47)

- Inserts into `aiAnalyses` table: `userId`, `timestamp`, `request`, `response`, `insight`, `model`, `durationMs`, `inputLogCount`.
- Returns the new document `Id<"aiAnalyses">`.
- Async extraction (lines 38-44): Schedules `internal.extractInsightData.extractFromReport` to run immediately (non-blocking). This extracts:
  - Food assessments into `foodAssessments` table (canonical names, verdicts, confidence, reasoning).
  - Suggestions into `reportSuggestions` table (text, normalized text, position).
  - Then schedules `computeAggregates.updateFoodTrialSummary` and `computeAggregates.updateWeeklyDigest`.

##### Step 7: Claim pending replies (line 271)

`claimPendingReplies({ aiAnalysisId })` calls `api.conversations.claimPendingReplies` mutation.

**File:** `convex/conversations.ts` (lines 158-178)

Finds all recent user messages with no `aiAnalysisId` and patches them to link to this analysis.

##### Step 8: Save assistant messages (lines 273-281)

If the insight has a `summary`, saves it as an assistant conversation message linked to the analysis ID. If it has a `directResponseToUser`, saves that as a second assistant message.

##### Step 9: Status update to "done" (line 284)

`setAiAnalysisStatus("done")` -- Zustand updates, UI shows checkmark for 2 seconds then resets to idle.

##### Step 10: Display

The `AiInsightsSection` component reactively reads the latest successful analysis. `DrPooReportDetails` renders 9 sections: clinical reasoning, suspected culprits + likely safe, meal ideas, next food to try, Did You Know?, suggestions, mini challenge, AI disclaimer, and lifestyle experiment status.

#### Error/Fallback Branches

- **No API key:** `runAnalysis` returns immediately. UI shows the "Add your OpenAI API key in Settings" empty state.
- **Request already in flight:** `runAnalysis` returns immediately (loadingRef guard). Silent skip.
- **No bowel data AND no user question:** Sets `aiAnalysisStatus` to `"error"` with message "Log a bowel movement or send a question first." `AnalysisProgressOverlay` renders the error with Dismiss and Try Again buttons.
- **Invalid API key format:** Throws `"Invalid OpenAI API key format."` -- caught at catch block.
- **Not authenticated:** Throws `"Not authenticated"` -- caught at catch block.
- **OpenAI API error:** `callAi()` throws -- caught, re-thrown as `"AI nutritionist request failed: <message>"`.
- **Invalid JSON from AI:** Throws `"AI nutritionist returned invalid JSON: <first 200 chars>"`.
- **Unexpected response structure:** `parseAiInsight` returns null, throws `"AI nutritionist returned an unexpected response structure."`.
- **Main catch block (lines 294-311):** Logs error, sets status to `"error"`, saves error record to Convex (preserves failure in history).
- **Save failure after successful AI call:** Catches separately, shows toast notification.

#### Files Involved

| File                                                             | Purpose                                                                                             |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `src/pages/Track.tsx`                                            | Page host. Wires `useAiInsights`, passes `sendNow` and calls `triggerAnalysis` after BM logs.       |
| `src/components/track/dr-poo/AiInsightsSection.tsx`              | Dr. Poo card. Shows progress overlay, conversation panel, report body, and empty states.            |
| `src/components/track/dr-poo/ConversationPanel.tsx`              | Scrollable message timeline with markdown rendering.                                                |
| `src/components/track/dr-poo/ReplyInput.tsx`                     | Text input for user messages. "Send now" button. Character limit (2500).                            |
| `src/components/track/dr-poo/AiInsightsBody.tsx`                 | Collapsible report details wrapper with copy and archive links.                                     |
| `src/components/archive/DrPooReport.tsx`                         | `DrPooReportDetails` (9-section renderer) and `DrPooFullReport` (Archive page variant).             |
| `src/components/archive/ai-insights/AnalysisProgressOverlay.tsx` | Inline progress indicator (sending/receiving/done/error).                                           |
| `src/hooks/useAiInsights.ts`                                     | Orchestrates the entire flow. `triggerAnalysis` and `sendNow`.                                      |
| `src/hooks/usePendingReplies.ts`                                 | Convex-backed pending replies.                                                                      |
| `src/hooks/useApiKey.ts`                                         | Loads/saves OpenAI API key from IndexedDB.                                                          |
| `src/contexts/ApiKeyContext.tsx`                                 | React context wrapper for `useApiKey`.                                                              |
| `src/store.ts`                                                   | Zustand store: `aiAnalysisStatus`, `aiAnalysisError`, `baselineAverages`, `paneSummaryCache`.       |
| `src/lib/aiAnalysis.ts`                                          | Core AI module (~1830 lines). System prompt, payload building, response parsing, `fetchAiInsights`. |
| `src/lib/aiModels.ts`                                            | Model configuration. Validation, legacy aliases.                                                    |
| `src/lib/aiRateLimiter.ts`                                       | Rate limit guard (currently disabled).                                                              |
| `src/lib/convexAiClient.ts`                                      | TypeScript type definition for the Convex AI action caller.                                         |
| `src/lib/apiKeyStore.ts`                                         | IndexedDB persistence for OpenAI API key.                                                           |
| `src/lib/inputSafety.ts`                                         | Input sanitization.                                                                                 |
| `src/lib/sync.ts`                                                | Convex reactive query wrappers.                                                                     |
| `convex/ai.ts`                                                   | `chatCompletion` action -- thin relay to OpenAI.                                                    |
| `convex/aiAnalyses.ts`                                           | `add` mutation, queries, `toggleStar`.                                                              |
| `convex/conversations.ts`                                        | Message CRUD, `claimPendingReplies`.                                                                |
| `convex/extractInsightData.ts`                                   | `extractFromReport` -- extracts food assessments and suggestions.                                   |
| `convex/validators.ts`                                           | Validators for AI analysis data.                                                                    |
| `src/types/domain.ts`                                            | `AiNutritionistInsight`, `AiAnalysisStatus`, `HealthProfile`, `AiPreferences`, etc.                 |

---

### Flow 4: Food Trial Evidence Processing

#### Triggers

There are **two independent triggers** for ingredient exposure creation, plus a **higher-level evidence pipeline** in `shared/foodEvidence.ts` that computes trial summaries from logs + digestion events + AI assessments.

##### Trigger 1: Food log creation/update (new-style with rawInput)

When `logs.add()` or `logs.update()` processes a food log that has `rawInput` (raw text), it schedules `foodParsing.processLogInternal` which, after matching, schedules `foodParsing.processEvidence` with a **6-hour delay**.

##### Trigger 2: Food log creation/update (legacy style with pre-resolved items)

When `logs.add()`, `logs.update()`, or `logs.batchUpdateFoodItems()` processes a food log that already has `items` populated (legacy path), it calls `rebuildIngredientExposuresForFoodLog()` **synchronously** within the same mutation.

##### Trigger 3: AI report generation (food trial summaries, separate from exposures)

When `extractInsightData.extractFromReport()` inserts food assessments from an AI analysis, it schedules `computeAggregates.updateFoodTrialSummary` which calls `buildFoodEvidenceResult()` from `shared/foodEvidence.ts` -- a completely separate pipeline that correlates food logs with digestion events using transit timing.

#### Happy Path (New-Style Pipeline)

##### Step 1: Food log created

- **File:** `convex/logs.ts`, line 831
- **Function:** `add` (mutation)
- User submits raw text (e.g., "chicken breast, rice, steamed broccoli")
- Log inserted to `logs` table with `type: "food"`, `data: { rawInput: "...", items: [] }`
- Condition: `rawInput` is present and `items` is empty/missing

##### Step 2: Schedule server-side food parsing

- **File:** `convex/logs.ts`, lines 855-858
- `ctx.scheduler.runAfter(0, internal.foodParsing.processLogInternal, { logId })`
- Runs immediately (delay = 0)

##### Step 3: Parse and match food items

- **File:** `convex/foodParsing.ts`, line 877
- **Function:** `processLogInternal` (internalAction)
- Reads log via `getFoodLogForProcessing`
- Preprocesses raw text into phrases via `preprocessMealText()` from `shared/foodMatching`
- Loads learned aliases via `listFoodAliasesForUser`
- Creates matcher context via `createFoodMatcherContext(learnedAliases)`

##### Step 4: Multi-strategy matching per phrase

- **File:** `convex/foodParsing.ts`, lines 920-976
- For each phrase:
  1. Fuzzy search via `fuzzySearchFoodCandidates()`
  2. Embedding search via `searchEmbeddingCandidates()` using Convex vector index
  3. Merge candidates via `mergeFoodMatchCandidates()`
  4. Route confidence via `routeFoodMatchConfidence()`
  5. If high confidence: create resolved item via `toResolvedItem()`
  6. If low confidence + structurally ambiguous: try LLM fallback via `tryLlmFallback()`
  7. Otherwise: create pending/unresolved item via `toPendingItem()`

##### Step 5: Write processed items back to log

- **File:** `convex/foodParsing.ts`, lines 978-981
- `writeProcessedItems` (internalMutation): patches the log's `data.items` array with processed items and increments `itemsVersion`

##### Step 6: Schedule evidence processing (6-hour delay)

- **File:** `convex/foodParsing.ts`, lines 983-989
- `ctx.scheduler.runAfter(EVIDENCE_WINDOW_MS, internal.foodParsing.processEvidence, { logId })`
- `EVIDENCE_WINDOW_MS = 6 * 60 * 60 * 1000` (6 hours)
- This delay gives the user time to manually resolve unmatched items before evidence is finalized

##### Step 7: Process evidence (create ingredientExposures)

- **File:** `convex/foodParsing.ts`, line 1044
- **Function:** `processEvidence` (internalMutation)
- Idempotency guard: If `data.evidenceProcessedAt` is already set, returns early
- Empty items: If no items, just marks `evidenceProcessedAt` and returns
- Expire unresolved items: Any item without a `canonicalName` is set to `canonicalName: "unknown_food"` with `resolvedBy: "expired"`
- Write updated items: Patches the log atomically with serialized items + `evidenceProcessedAt` timestamp
- Insert exposures: For each item with a valid, non-"unknown_food" `canonicalName`, inserts a row into `ingredientExposures`:

```
{
  userId,
  logId,
  itemIndex: i,
  logTimestamp: log.timestamp,
  ingredientName: item.userSegment,    // original user text
  canonicalName: item.canonicalName,    // resolved canonical
  quantity: item.quantity,
  unit: item.unit,
  preparation?: item.preparation,
  recoveryStage?: item.recoveryStage,  // 1 | 2 | 3
  spiceLevel?: item.spiceLevel,        // "plain" | "mild" | "spicy"
  createdAt: Date.now(),
}
```

#### Happy Path (Legacy Pipeline -- synchronous)

##### Step 1: Food log with pre-resolved items

- **File:** `convex/logs.ts`, lines 860-868
- When `add()` receives a food log where `items` is already populated (legacy client), it calls `rebuildIngredientExposuresForFoodLog()` synchronously

##### Step 2: Rebuild exposures

- **File:** `convex/logs.ts`, line 260
- **Function:** `rebuildIngredientExposuresForFoodLog` (private helper)
- First calls `clearIngredientExposuresForLog()` to delete any existing exposures for this logId
- Then calls `getCanonicalizedFoodItems()` to extract items from the log data
- For each item with valid `ingredientName` AND `canonicalName`:
  - Normalizes canonical name via `normalizeCanonicalIngredientName()`
  - Skips `"unknown_food"` items
  - Inserts into `ingredientExposures`

Also triggered by: `logs.update()`, `logs.batchUpdateFoodItems()`, `logs.backfillIngredientExposures()`, `logs.recanonicalizeAllFoodLogs()`.

#### Error/Fallback Branches

- **No rawInput on food log (legacy path):** Falls through to synchronous `rebuildIngredientExposuresForFoodLog()`
- **Items array is empty or null:** Marks `evidenceProcessedAt` and returns
- **Item missing ingredientName or canonicalName:** Individual items are skipped
- **Food has canonicalName = "unknown_food":** Explicitly skipped in both paths
- **Matching failed:** Item stored as pending; after 6 hours, marked as `resolvedBy: "expired"` with `canonicalName: "unknown_food"`. No exposure record created.
- **OpenAI API unavailable:** Embedding search fails gracefully (falls back to fuzzy-only). LLM fallback fails gracefully (item stays unresolved).
- **Evidence already processed (idempotency):** `processEvidence` checks `data.evidenceProcessedAt` and returns early
- **Food log deleted:** `logs.remove()` calls `clearIngredientExposuresForLog()` to clean up exposures
- **Food log updated:** New-style clears and re-schedules; legacy clears and rebuilds

#### Architecture: Two Independent Evidence Systems

There are **two separate "evidence" systems** that serve different purposes:

1. **`ingredientExposures` table** -- a flat log of which canonical foods the user has eaten, when, and with what preparation. Created by `processEvidence` (new-style) or `rebuildIngredientExposuresForFoodLog` (legacy). Used for exposure history queries (UI: "how many times have I eaten X?").

2. **`shared/foodEvidence.ts` / `foodTrialSummary` table** -- a Bayesian evidence engine that correlates food intake with digestive outcomes using transit timing, modifier signals (habits, activity, fluid), and AI assessments. Does NOT read from `ingredientExposures` at all -- reads raw logs directly. Used for food safety status (safe/watch/avoid/building).

These systems are not directly connected. The `ingredientExposures` table is purely an exposure ledger; the transit-based evidence system is the actual "food trial" engine.

#### Gap: resolveItem Does Not Create Exposures

`foodParsing.resolveItem()` updates the item's canonical name in the log but does NOT schedule a new `processEvidence` call or directly insert into `ingredientExposures`. If `processEvidence` has already run (`evidenceProcessedAt` is set) and the user then resolves an expired item, that resolution will never generate an exposure record.

#### Files Involved

| File                             | Purpose                                                                                                                |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `convex/logs.ts`                 | Food log CRUD, `rebuildIngredientExposuresForFoodLog`, `clearIngredientExposuresForLog`, `backfillIngredientExposures` |
| `convex/foodParsing.ts`          | Server-side food matching pipeline: `processLogInternal`, `processEvidence`, `resolveItem`, `writeProcessedItems`      |
| `convex/ingredientExposures.ts`  | Read-only queries: `allIngredients`, `historyByIngredient`                                                             |
| `convex/schema.ts`               | Table definitions for `ingredientExposures`, `logs`, `foodTrialSummary`                                                |
| `shared/foodEvidence.ts`         | Separate evidence pipeline: `buildFoodEvidenceResult`, transit resolution, Bayesian scoring                            |
| `convex/computeAggregates.ts`    | `updateFoodTrialSummary` -- upserts `foodTrialSummary` rows from fused evidence                                        |
| `convex/extractInsightData.ts`   | `extractFromReport` -- extracts food assessments from AI reports, schedules aggregate updates                          |
| `convex/foodLibrary.ts`          | Also calls `buildFoodEvidenceResult` for library-level evidence queries                                                |
| `src/lib/sync.ts`                | Client-side hooks: `useAllIngredientExposures`, `useIngredientExposureHistory`                                         |
| `shared/foodMatching.ts`         | Shared matching logic                                                                                                  |
| `shared/foodCanonicalization.ts` | `canonicalizeKnownFoodName` -- registry lookup                                                                         |
| `shared/foodNormalize.ts`        | `normalizeFoodName`, `formatCanonicalFoodDisplayName`                                                                  |
| `shared/foodProjection.ts`       | `getLoggedFoodIdentity`, `getCanonicalFoodProjection`                                                                  |

---

### Flow 5: User Changes a Setting

#### Trigger

- **Page:** `src/pages/Settings.tsx` (line 19, `SettingsPage`)
- On desktop (`lg+`), the "Health Profile & History" card renders `<HealthForm />` inline. On mobile (`< lg`), a `<DrawerTrigger>` tile opens a `<Drawer>` containing `<HealthForm />`.
- The user interacts with form fields within `HealthForm` and its six child section components.

#### Happy Path

##### Step 1: User edits a field in a section component

Each section receives `healthProfile` and a `setHealthProfile(updates: Partial<HealthProfile>)` callback as props. All six sections follow the same pattern -- they call `setHealthProfile({ fieldName: newValue })` directly from their `onChange` handlers:

| Section               | File                                                     | Key handlers                                                                 |
| --------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `SurgerySection`      | `src/components/settings/health/SurgerySection.tsx`      | Surgery type select, surgery date calendar, "Other" text input               |
| `DemographicsSection` | `src/components/settings/health/DemographicsSection.tsx` | Gender select, age, height, starting weight                                  |
| `ConditionsSection`   | `src/components/settings/health/ConditionsSection.tsx`   | `toggleCondition` toggles comorbidities array, "Other conditions" text input |
| `MedicationsSection`  | `src/components/settings/health/MedicationsSection.tsx`  | Four text inputs: medications, supplements, allergies, intolerances          |
| `LifestyleSection`    | `src/components/settings/health/LifestyleSection.tsx`    | Smoking, alcohol, recreational substance choices and frequency               |
| `DietarySection`      | `src/components/settings/health/DietarySection.tsx`      | Dietary history text input                                                   |

**All changes are fired on every keystroke/selection** -- there is no debounce and no "Save" button.

##### Step 2: `HealthForm` wraps partial updates into a full `HealthProfile`

`src/components/settings/HealthForm.tsx` (line 14-26):

1. Calls `useHealthProfile()` from `src/hooks/useProfile.ts` to get `{ healthProfile, isLoading, setHealthProfile }`.
2. Creates a local `setHealthProfile` wrapper that merges the partial update into the current full `healthProfile` before forwarding:
   ```
   void setFullHealthProfile({ ...healthProfile, ...updates })
   ```

##### Step 3: `useHealthProfile` hook merges and calls `patchProfile`

`src/hooks/useProfile.ts` (line 80-102):

1. Gets `{ profile, isLoading, patchProfile }` from `useProfileContext()`.
2. Its `setHealthProfile` callback merges updates and calls `patchProfile({ healthProfile: merged })`.

**Note:** There is a double-merge happening. Both HealthForm and useHealthProfile merge partial into full. The second merge is effectively a no-op (input is already complete). Redundant but harmless.

##### Step 4: `ProfileContext.patchProfile` calls the Convex mutation

`src/contexts/ProfileContext.tsx` (line 106-137):

1. `patchProfile(updates)` builds a conditional-spread argument object.
2. Calls `patchMutation({ healthProfile: <full HealthProfile> })`.
3. `patchMutation` is `useMutation(api.logs.patchProfile)`.

##### Step 5: Convex `patchProfile` mutation persists to database

`convex/logs.ts` (line 1124-1239):

1. Authentication check: Calls `ctx.auth.getUserIdentity()`. Throws `"Not authenticated"` if null.
2. Find existing profile: Queries `profiles` table by `userId` using `by_userId` index.
3. Sanitization: Runs `sanitizeUnknownStringsDeep(args.healthProfile)`. Normalizes unicode (NFKC), strips control characters, enforces a 5000-character-per-string limit.
4. Validation: The `healthProfileValidator` validates the entire shape before the handler runs.
5. Write: If profile exists, `ctx.db.patch(existing._id, updates)`. If not, inserts a new profile document with required field defaults.

##### Step 6: Convex reactivity propagates the change back

After the mutation commits, Convex's reactive query system triggers the `getProfile` query for all subscribed clients. The `useQuery(api.logs.getProfile)` in `ProfileProvider` receives the updated document and recomputes the resolved profile via `useMemo`.

#### State Flow Diagram

```
                                 Convex DB ("profiles" table)
                                       ^         |
                                       |         | (reactive subscription)
                          patchProfile |         | useQuery(api.logs.getProfile)
                            mutation   |         v
                                       |    ProfileProvider (React Context)
                                       |    src/contexts/ProfileContext.tsx
                                       |      - useMemo merges server data + defaults
                                       |      - provides { profile, isLoading, patchProfile }
                                       |         |
                                       |         v
                                   useProfileContext()
                                       |
                                       v
                               useHealthProfile()
                               src/hooks/useProfile.ts
                                 - extracts healthProfile slice
                                 - provides setHealthProfile
                                       |
                                       v
                                  HealthForm
                                  src/components/settings/HealthForm.tsx
                                    - wraps setHealthProfile for partial updates
                                    - passes to 6 section components as props
                                       |
                      +--------+-------+-------+--------+-------+
                      |        |       |       |        |       |
                  Surgery  Demographics Conditions Meds Lifestyle Dietary
```

#### Error/Fallback Branches

- **Validation (client-side):** DemographicsSection has `onBlur` validators for height, weight, and age fields. Invalid ranges trigger toast errors and inline error messages. The state update still goes through (values are clamped) -- validation is advisory only.
- **Type guards:** SurgerySection and DemographicsSection use type-guard functions (`isValidSurgeryType`, `isValidGender`) that silently reject invalid `<select>` values.
- **Authentication failure:** `patchProfile` throws `"Not authenticated"`. There is **no try/catch** in `ProfileContext.patchProfile` or `useHealthProfile.setHealthProfile` -- the `void` keyword at `HealthForm.tsx` line 23 explicitly discards the promise. Failed saves are **silent**.
- **String length exceeded:** `sanitizeUnknownStringsDeep` throws if any string exceeds 5000 characters. Most text inputs have `maxLength` attributes (500-1200 chars) as first-line defense.
- **Convex validator rejection:** If the object shape doesn't match `healthProfileValidator`, Convex rejects before the handler runs.

#### Files Involved

| File                                                     | Role                                                                                |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `src/pages/Settings.tsx`                                 | Top-level settings page; renders `HealthForm` in card (desktop) and drawer (mobile) |
| `src/components/settings/HealthForm.tsx`                 | Orchestrates 6 health sections; wraps `setHealthProfile` for partial updates        |
| `src/components/settings/health/types.ts`                | `HealthSectionProps` interface shared by all sections                               |
| `src/components/settings/health/SurgerySection.tsx`      | Surgery type + date fields                                                          |
| `src/components/settings/health/DemographicsSection.tsx` | Gender, age, height, weight, BMI display                                            |
| `src/components/settings/health/ConditionsSection.tsx`   | Comorbidities chip groups + free text                                               |
| `src/components/settings/health/MedicationsSection.tsx`  | Medications, supplements, allergies, intolerances                                   |
| `src/components/settings/health/LifestyleSection.tsx`    | Smoking, alcohol, recreational substances                                           |
| `src/components/settings/health/DietarySection.tsx`      | Dietary history free text                                                           |
| `src/hooks/useProfile.ts`                                | `useHealthProfile()`: extracts health profile slice, provides partial-merge setter  |
| `src/contexts/ProfileContext.tsx`                        | `ProfileProvider` + `useProfileContext()`: bridges React to Convex                  |
| `src/types/domain.ts`                                    | `HealthProfile` interface, `ReproductiveHealthSettings`                             |
| `src/store.ts`                                           | `DEFAULT_HEALTH_PROFILE` constant                                                   |
| `convex/logs.ts`                                         | `patchProfile` mutation, `getProfile` query                                         |
| `convex/validators.ts`                                   | `healthProfileValidator`, `reproductiveHealthValidator`                             |
| `convex/schema.ts`                                       | `profiles` table definition                                                         |
| `convex/lib/inputSafety.ts`                              | `sanitizeUnknownStringsDeep`: recursive string sanitization                         |
| `src/routeTree.tsx`                                      | `ProfileProvider` mount point wrapping all authenticated routes                     |
| `src/lib/units.ts`                                       | Unit conversion helpers used by DemographicsSection                                 |

---

## Surprising Findings Summary

### Critical (architectural violations)

1. **`extractInsightData.ts` imports from `../src/types/domain`** -- Convex server code importing from the React frontend `src/` directory. The `StructuredFoodAssessment` type should be moved to `shared/` or duplicated in convex validators. Type-only import so no runtime impact, but creates fragile coupling.

2. **Two hooks import from component internals (inverted dependency):**
   - `src/hooks/useUnresolvedFoodQueue.ts` imports `getFoodItemResolutionStatus` from `@/components/track/today-log/helpers`
   - `src/hooks/useFoodParsing.ts` imports `ParsedItem` type from `@/components/track/panels`

   These types/utilities should be lifted to `@/lib/` or `@/types/`.

3. **Two independent evidence systems that are not connected.** `ingredientExposures` is a flat exposure ledger. `shared/foodEvidence.ts` / `foodTrialSummary` is the actual Bayesian trial engine. They re-extract food items from raw logs independently and could theoretically disagree about what foods were in a log.

4. **`resolveItem` does not create exposure records.** If a user resolves a food item after the 6-hour evidence window has closed, that resolution never generates an `ingredientExposure` record. This is a data integrity gap.

5. **Preset metadata is discarded.** `FoodSection` carefully builds `ParsedItem` objects with `fromPreset` and `presetIngredients`, but `useFoodParsing` ignores the `_items` parameter entirely and only sends `rawText`. The preset information never reaches the server.

6. **Silent mutation failures in Settings.** `HealthForm.tsx` uses `void setFullHealthProfile(...)` which discards the returned promise. If the Convex mutation fails (auth expired, string too long, network error), the user sees no feedback and the form field silently reverts on next reactive update.

### High (dead code / disconnected systems)

7. **Two LLM matching paths, one dormant.** The BYOK client-initiated LLM path (`useFoodLlmMatching` hook + `matchUnresolvedItems` action + `applyLlmResults` mutation) is fully implemented but completely disconnected (~540 lines of dead code across `convex/foodLlmMatching.ts` + `src/hooks/useFoodLlmMatching.ts`).

8. **`foodLlmMatching.ts` is effectively dead code at runtime.** The `matchUnresolvedItems` action is stubbed to return `{ matched: 0, unresolved: 0 }` without calling OpenAI. The file contains ~350 lines exercised only by tests.

9. **`useFoodLlmMatching` is completely dead code.** The hook (142 lines) is never imported anywhere. LLM matching moved entirely server-side, but this client-side trigger was never removed.

10. **11 dead exports in `store.ts`.** Three type re-exports (`HabitConfig`, `HabitLog`, `SleepGoal`) and 5 type guards (`isLogType`, `isHabitLog`, `isActivityLog`, `isWeightLog`, `isReproductiveLog`) plus `AppState` are never imported externally.

11. **`src/lib/habitCoaching.ts` has 8 exported functions, most appear dead.** The coaching and snippet functions (`generateCoachingSnippet`, `getHeuristicCoachingMessage`, `generateHabitSnippet`, `heuristicHabitSnippet`) have zero external consumers.

12. **`next-themes` is a phantom dependency.** Listed in `dependencies` but never imported. The app has a fully custom `ThemeProvider`.

13. **`@clerk/backend` is unused.** Listed as a devDependency but never imported anywhere.

14. **Multiple files define identical `normalizeCanonicalName` functions.** `foodAssessments.ts`, `ingredientExposures.ts`, `ingredientOverrides.ts`, and `aggregateQueries.ts` all define local copies instead of importing from `shared/foodCanonicalName.ts`.

15. **`src/lib/featureFlags.ts` is entirely unused.** The sole flag (`transitMapV2: true`) is never read. The feature has shipped.

16. **`src/lib/foodStatusThresholds.ts` has 11 exports but only 3 are imported externally.** The remaining 8 are dead or were migrated to `shared/foodEvidence`.

### Medium (naming / organization issues)

17. **`logs.ts` is a 2,018-line mega-file** that owns four distinct domains: log CRUD, profile management, data backup/restore, and backfill migrations. Largest file in convex/ by a wide margin.

18. **`aiAnalysis.ts` at 1,954 lines exceeds the 300-line threshold by 6.5x.** Contains the entire Dr. Poo AI system: a 1,200-line system prompt builder, log context assembly, insight parsing, weekly summary generation, and educational insight deduplication.

19. **`routeTree.tsx` is a "god file" at 525 lines.** Contains 5 non-trivial components alongside route definitions. `GlobalHeader` alone is 110 lines.

20. **`useQuickCapture` at 743 lines is the largest hook by far** and handles 9 distinct capture flows. Sleep handler alone contains ~170 lines of midnight-split logic.

21. **`WeightEntryDrawer.tsx` at 907 lines** is the largest component file, containing an entire SVG charting subsystem.

22. **`src/lib/sync.ts` imports from React hooks.** This is a lib file that contains ~30 React hooks. It straddles the line between "library" and "hooks layer." Pure types should stay in lib; hooks should move to `src/hooks/`.

23. **`src/lib/habitIcons.tsx` is a `.tsx` file in lib.** Imports from `lucide-react` (a UI component library), coupling the lib layer to a UI icon library.

24. **`prefersSummaryCandidate` in `foodNormalize.ts` is misplaced.** This function compares summary rows for deduplication and has nothing to do with food name normalization.

25. **`domain.ts` re-exports `shared/foodTypes.ts` types** creating a dual-import path: consumers can import `FoodPrimaryStatus` from either `@shared/foodTypes` or `@/types/domain`.

26. **`domain.ts` imports from 4 different `src/lib/` modules** (`aiModels`, `habitTemplates`, `streaks`, `units`), creating a coupling chain that prevents it from being shared with the server.

27. **`foodCanonicalName.ts` is barely used and duplicated.** Only 2 convex files import it; 3 others define identical local functions instead.

28. **Re-exports from `logs.ts` are orphaned.** `habitConfigValidator` and `habitTypeValidator` are re-exported with a comment saying "for use in sync.ts and other files" but no file imports them via the logs.ts path.

29. **Double sanitization.** Input is sanitized both client-side (`src/lib/sync.ts`) and server-side (`convex/logs.ts`). Defensive but means every string is processed twice.

30. **Components importing directly from `convex/` source and `shared/` via relative paths.** `FoodMatchingModal.tsx` and `AiSuggestionsCard.tsx` call Convex mutations directly rather than going through a hook layer.

31. **Duplicated tile chrome.** `QuickCaptureTile.tsx` and `DurationEntryPopover.tsx` both define identical `TINT_BY_PROGRESS_COLOR` and `TINT_CLASSES` mappings (~35 lines each).

32. **`src/lib/analysis.test.ts` is a co-located test file** (not in `__tests__/`). Inconsistent with the other 12 test files which live in `src/lib/__tests__/`.

33. **`dotenv` is a production dependency but only used in `e2e/auth.setup.ts`.** Should be moved to `devDependencies`.

34. **`store.ts` exports far more than just the Zustand store.** Also exports 7 type guards, 4 constants, 3 re-exported types, and 1 interface. Blurs the boundary between state management and data model definitions.

### Low (style / consistency)

35. **`foodRegistry.ts` at 4,058 lines is the largest file in the entire project.** However, ~3,800 lines are food entry data (not logic), making it a data file that happens to be TypeScript.

36. **`FoodCategory` and `FoodSubcategory` types are defined but never used outside `foodRegistry.ts`.** May be aspirational (for future categorization features) or vestigial.

37. **`BRAT_FOOD_KEYS` (Set) is exported but no consumer uses it.** Only `BRAT_BASELINE_CANONICALS` (the array) is actually imported.

38. **`ConfidenceRoute` type is not imported by any file.** Only used as a return type within `foodMatching.ts`.

39. **`foodMatching.ts` has many "internal-only" exports.** Functions like `stripFoodAccents`, `findExactAliasCandidate`, `buildBucketOptions` could be un-exported.

40. **`foodEvidence.ts` exports several types/constants that have no external consumer.** Exported "just in case" rather than for actual consumers.

41. **Track.tsx is imported eagerly, not lazily.** All other pages use `lazy()` but `TrackPage` is imported directly. Likely intentional (default route) but means all 669 lines are in the main bundle.

42. **`testFixtures.ts` is registered in the Convex API.** Has no runtime impact but is somewhat unusual to have test support files in the Convex module tree.

43. **All 4 destructive-habits E2E tests are SKIPPED.** They require "Cigarettes" habit which is not in the default template keys. Need setup logic to first add the custom habit.

44. **`useAiInsights` manually syncs 13 reactive values into a single `dataRef`.** A custom `useLatestRef` utility or a snapshot getter pattern would reduce boilerplate and risk of stale-data bugs.

45. **Evidence window is fire-and-forget.** The 6-hour `processEvidence` scheduler has no retry mechanism. If it fails, unresolved items never get marked as expired and never produce exposure records.

46. **Embedding staleness check is expensive.** `ensureFoodEmbeddings` pulls full 1536-dimension embedding vectors from all rows just to check `embeddingSourceHash` staleness.

47. **Fire-on-every-keystroke with no debounce in Settings.** Every character typed in health profile text fields triggers the full mutation pipeline. Works because Convex is fast, but atypical.

48. **Health profile is a monolithic blob.** Every field change sends the entire `HealthProfile` object (30+ fields). No field-level patching at the Convex level. Two concurrent edits to different fields could overwrite each other (last-write-wins).

49. **No explicit abort/cancellation UI for Dr. Poo.** The `AbortController` is created but there is no user-facing cancel button during the potentially long API call.

50. **`computeAggregates.ts` duplicates the assessment-to-evidence mapping logic** found in `foodLibrary.ts`. Both files build `FoodEvidenceSummary[]` arrays with near-identical code.

51. **`migrations.ts` has no consumers via import.** All 8 exported mutations are Convex entry points (callable via dashboard or CLI). This is correct for migration code.

52. **`BristolScalePicker` appears to be dead code.** Exported from `BristolScale.tsx` but not imported anywhere. The `BowelSection` uses its own custom picker UI.

53. **Reactive delay is a fixed 1500ms in Dr. Poo flow.** Assumes Convex will have the new log within 1.5s. No verification that the expected data actually appeared.

54. **`src/lib/reproductiveHealth.ts` has 4 dead exports.** `getDateKeyFromTimestamp` and `getTodayDateKey` are trivial wrappers that add no value.

55. **Rate limiter is disabled.** `MIN_CALL_INTERVAL_MS = 0` means rapid clicks are only guarded by the `loadingRef` lock. The rate limiter module is dead code.

56. **Lazy import pattern for code splitting.** `FoodSubRow.tsx` lazy-loads `FoodMatchingModal` to avoid bundling the food registry data in the initial payload -- good practice, well-documented.
