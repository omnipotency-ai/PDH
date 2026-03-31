# Audit Remediation Queue

**Created:** 2026-03-17
**Sources:** A1 (codebase health), A2 (gap analysis), A3 (code map), A4 (deep review), A5 (doc cross-ref), PR #2 review, PR #3 review

## How to use this file

- Each item has a unique ID (AQ-###)
- Items already tracked in bugs.md or tech-debt.md have cross-references
- Items fixed in PR #2 Waves 1-2 or PR #3 are marked Done
- Repro health items descoped per ADR-0008
- Severity: Crit = data loss/security breach, High = bugs/type safety, Med = maintainability, Low = polish

---

## Sprint 0: Immediate (before any release)

| ID     | Title                                             | Source         | Severity | File(s)                                             | Description                                                                                                             |
| ------ | ------------------------------------------------- | -------------- | -------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| AQ-001 | Rotate live credentials                           | A1/C1          | Crit     | `.env.local`                                        | `CLERK_SECRET_KEY`, `CONVEX_DEPLOYMENT`, `VERCEL_OIDC_TOKEN` on disk. Rotate + install `gitleaks` pre-commit.           |
| AQ-002 | Auth check on `matchUnresolvedItems`              | A1/C2          | Crit     | `convex/foodLlmMatching.ts`                         | Public action accepts API key with no `requireAuth`. Currently stubbed (PR#3/C-1) but must have auth before unstubbing. |
| AQ-003 | Health data in error messages                     | A1/C8, C9, H25 | Crit     | `src/lib/aiAnalysis.ts`, `src/lib/habitCoaching.ts` | `rawContent.slice(0,200)` leaks patient data to error tracking. Replace with static messages.                           |
| AQ-004 | `dailyCap === 0` discards zero-tolerance habits   | A1/C7          | Crit     | `src/lib/habitTemplates.ts:590`                     | Zero-cap habit (e.g. "no alcohol") treated as "no cap". Patient safety issue. Change to `>= 0`.                         |
| AQ-005 | `currentItemIndex != null` skips first queue item | A1/C11         | Crit     | `src/components/track/FoodMatchingModal.tsx:228`    | Queue mode skips index 0. Change to `!== undefined`.                                                                    |
| AQ-006 | Postpartum notes overwrite pregnancy notes        | A1/C12         | Crit     | `PregnancySection.tsx:189,196`                      | Both sections bound to `pregnancyMedicationNotes`. Data corruption. Use dedicated field.                                |
| AQ-007 | CI pipeline (ship blocker)                        | A2/Gap-1       | Crit     | No `.github/workflows/`                             | All checks manual. See also: features.md #CI-PIPELINE                                                                   |
| AQ-008 | `v.any()` in `importBackup` args                  | A1/C3          | Crit     | `convex/logs.ts:1498`                               | Accepts unvalidated input from any authenticated user. Replace with strict typed validator.                             |
| AQ-009 | BYOK disclosure is misleading                     | A2/Gap-6       | High     | `ArtificialIntelligenceSection.tsx`                 | UI says key "never sent to cloud" but it transits to Convex actions. Fix copy.                                          |

---

## Sprint 1: Security + Type Safety

| ID     | Title                                              | Source     | Severity | File(s)                                    | Description                                                                                                       |
| ------ | -------------------------------------------------- | ---------- | -------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | --- | ----------------------- |
| AQ-010 | 13+ `as any` casts in `importBackup` DB inserts    | A1/C4      | Crit     | `convex/logs.ts:1533-1829`                 | All restored table rows bypass schema validation. Derive types with `Infer<>`.                                    |
| AQ-011 | `as unknown as SyncedLog[]` double-cast            | A1/C5      | Crit     | `src/lib/sync.ts:73`                       | Primary Convex-to-client data boundary. Build validated mapping function.                                         |
| AQ-012 | `as unknown as ConvexLogData` sanitization cast    | A1/C6      | Crit     | `src/lib/sync.ts:50-51`                    | Sanitized object bypasses type checking. Use typed mapping.                                                       |
| AQ-013 | Multiple `as` casts on `unknown` log.data          | A1/C10     | Crit     | `shared/foodEvidence.ts`                   | 7 locations cast `unknown` without structural validation. `NaN` produces incorrect stats.                         |
| AQ-014 | Unsafe AI insight cast                             | A1/C15     | Crit     | `src/pages/Patterns.tsx`                   | `as AiNutritionistInsight` instead of `parseAiInsight` validator.                                                 |
| AQ-015 | No `beforeLoad` auth guard on `appLayoutRoute`     | A1/C13     | High     | `src/routeTree.tsx`                        | Deep links for unauthenticated users show broken state. Add redirect.                                             |
| AQ-016 | `useStore.getState()` stale cache                  | A1/C14     | High     | `src/store.ts`                             | Bypasses React subscription for `paneSummaryCache`. Use selector instead.                                         |
| AQ-017 | `successUrl`/`cancelUrl` unvalidated               | A1/H11     | High     | `convex/stripe.ts:6-56`                    | User-controlled URLs forwarded to Stripe. Validate against app domain.                                            |
| AQ-018 | No input sanitization on `foodRequests`            | A1/H12     | High     | `convex/foodRequests.ts:22-33`             | `foodName`, `rawInput`, `note` unsanitized unlike all other mutations.                                            |
| AQ-019 | Prompt injection via `preferredName`               | A1/H13     | High     | `src/lib/aiAnalysis.ts:848-851`            | User string interpolated into LLM system prompt. Wrap in XML tags.                                                |
| AQ-020 | AI suggestions stored without length cap           | A1/H14     | High     | `convex/extractInsightData.ts:266-373`     | Only `.trim()` applied. Add `sanitizePlainText` + `assertMaxLength`.                                              |
| AQ-021 | `existingNames` unsanitized in food parse prompt   | A1/H15     | High     | `convex/foodParsing.ts`                    | Food library names injected into LLM user message without sanitization.                                           |
| AQ-022 | `WeeklySummaryInput` unsanitized                   | A1/H16     | High     | `src/lib/aiAnalysis.ts`                    | No `sanitizeUnknownStringsDeep` unlike `fetchAiInsights`.                                                         |
| AQ-023 | AI markdown rendered without safe-link policy      | A1/H17     | High     | `DrPooReport.tsx`, `ConversationPanel.tsx` | `react-markdown` with no `urlTransform` blocking `javascript:` links.                                             |
| AQ-024 | `ctx.db as any` in two queries                     | A1/H1      | High     | `convex/logs.ts:1320,1430`                 | Use per-table explicit query calls.                                                                               |
| AQ-025 | `cleanedData as any` in patch                      | A1/H2      | High     | `convex/logs.ts:470`                       | Type using Convex `data` field type.                                                                              |
| AQ-026 | `items as unknown as ProcessedFoodItem[]`          | A1/H3      | High     | `convex/foodParsing.ts:229`                | Only 4 of N fields checked before cast. Check all optional fields.                                                |
| AQ-027 | `ctx as unknown as MutationCtx` in query           | A1/H4      | High     | `convex/logs.ts:1460`                      | Extract into `QueryCtx`-compatible helper.                                                                        |
| AQ-028 | Four redundant `as` casts on sanitize return       | A1/H5      | High     | `src/lib/aiAnalysis.ts:1642-1658`          | Generic preserves type; remove casts.                                                                             |
| AQ-029 | `return id as Id<T>` with no guard                 | A1/H6      | High     | `src/lib/sync.ts:28`                       | Add `id.length > 0` guard.                                                                                        |
| AQ-030 | `as HabitType` on unvalidated string               | A1/H7      | High     | `src/lib/derivedHabitLogs.ts:97`           | Use `isHabitType()` guard.                                                                                        |
| AQ-031 | `dateStr.split("-").map(Number)` no NaN check      | A1/H8      | High     | `src/lib/digestiveCorrelations.ts:432`     | Use `parseISO` or validate format.                                                                                |
| AQ-032 | `bristolToConsistency(0)` returns "constipated"    | A1/H9      | High     | `src/lib/analysis.ts:206`                  | Add guard `if (code < 1                                                                                           |     | code > 7) return null`. |
| AQ-033 | Non-null assertion on quartile index               | A1/H10     | High     | `shared/foodEvidence.ts:452`               | Use `Math.min(idx, values.length - 1)` bounds check.                                                              |
| AQ-034 | Migrations are public mutations                    | A1/Med, A3 | Med      | `convex/migrations.ts`                     | `backfillConversations`/`backfillDigestionLogFields` can be triggered by any user. Convert to `internalMutation`. |
| AQ-035 | Historical prompts re-sent without re-sanitization | A1/Med     | Med      | Conversation history                       | Stored messages re-sent to LLM without re-sanitization.                                                           |

---

## Sprint 2: Test Coverage

| ID     | Title                                               | Source | Severity | File(s)                            | Description                                                                                                  |
| ------ | --------------------------------------------------- | ------ | -------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| AQ-036 | Zero tests for LLM food matching pipeline           | A1/C16 | Crit     | `convex/__tests__/`                | Highest-value pipeline, zero integration coverage. Write happy path + JSON parse failure + rate-limit tests. |
| AQ-037 | Zero tests for `computeBaselineAverages`            | A1/C18 | Crit     | `src/lib/baselineAverages.ts`      | 260+ LOC, contains zero-cap bug (AQ-004) and Spanish alias hardcode.                                         |
| AQ-038 | Zero tests for `habitProgress.ts`                   | A1/C19 | Crit     | `src/lib/habitProgress.ts`         | Core habit coaching logic entirely untested.                                                                 |
| AQ-039 | Zero tests for `derivedHabitLogs.ts`                | A1/C20 | Crit     | `src/lib/derivedHabitLogs.ts`      | Contains unsafe `as HabitType` cast (AQ-030) and O(n log n) sort.                                            |
| AQ-040 | `it.fails` documents known production bug           | A1/C17 | High     | E2E test suite                     | Expired items re-matching is broken. Fix bug; replace `it.fails` with passing assertion.                     |
| AQ-041 | Zero tests for `bristolToConsistency`               | A1/A4  | High     | `src/lib/analysis.ts`              | Boundary value bug (code=0) undetected.                                                                      |
| AQ-042 | Zero tests for `toSyncedLogs`/`sanitizeLogData`     | A1/A4  | High     | `src/lib/sync.ts`                  | Unsafe casts at API boundary untested.                                                                       |
| AQ-043 | Zero tests for `validateHabitConfig`                | A1/A4  | High     | `src/lib/habitTemplates.ts`        | Zero-cap bug entirely untested.                                                                              |
| AQ-044 | Zero tests for `migrateLegacyStorage`               | A1/A4  | High     | `src/lib/migrateLegacyStorage.ts`  | One-time migration; failure silently drops user data.                                                        |
| AQ-045 | Partial tests for `computeCorrelations`             | A1/A4  | Med      | `src/lib/digestiveCorrelations.ts` | Best/worst day overlap edge case untested.                                                                   |
| AQ-046 | Zero tests for `calculateGestationalAgeFromDueDate` | A1/A4  | Med      | `src/lib/reproductiveHealth.ts`    | Medical calculation untested.                                                                                |
| AQ-047 | Zero tests for `mergeFoodMatchCandidates`           | A1/A2  | Med      | `shared/foodMatching.ts`           | Embedding candidate merging untested.                                                                        |
| AQ-048 | 4 skipped destructive-habits E2E tests              | A1/A9  | High     | `e2e/destructive-habits.spec.ts`   | All skipped with no setup path.                                                                              |

---

## Sprint 3: Error Handling + Accessibility + Base UI

### Error Handling (Silent Swallowing)

| ID     | Title                                      | Source | Severity | File(s)                                    | Description                                                     |
| ------ | ------------------------------------------ | ------ | -------- | ------------------------------------------ | --------------------------------------------------------------- |
| AQ-049 | LogEntry save error silently dropped       | A1/H18 | High     | `today-log/rows/LogEntry.tsx:238`          | `catch { /* Keep editor open */ }` — show toast on error.       |
| AQ-050 | ActivitySubRow save error swallowed        | A1/H19 | High     | `today-log/editors/ActivitySubRow.tsx:66`  | Show toast.                                                     |
| AQ-051 | FluidSubRow save error swallowed           | A1/H20 | High     | `today-log/editors/FluidSubRow.tsx:83`     | Show toast.                                                     |
| AQ-052 | HabitSubRow save error swallowed           | A1/H21 | High     | `today-log/editors/HabitSubRow.tsx`        | Show toast.                                                     |
| AQ-053 | ReproductiveSubRow save error swallowed    | A1/H22 | High     | `today-log/editors/ReproductiveSubRow.tsx` | Show toast.                                                     |
| AQ-054 | WeightSubRow save error swallowed          | A1/H23 | High     | `today-log/editors/WeightSubRow.tsx`       | Show toast.                                                     |
| AQ-055 | Audio resume error swallowed               | A1/H24 | Med      | `src/lib/sounds.ts:50`                     | `ctx.resume().catch(() => {})` — add `debugWarn` logging.       |
| AQ-056 | `setSleepGoal` + `updateHabit` no rollback | A1/H30 | High     | `quick-capture/HabitDetailSheet.tsx`       | Zustand + Convex dual write with no rollback on Convex failure. |

### Accessibility

| ID     | Title                                      | Source           | Severity | File(s)                                         | Description                                                    |
| ------ | ------------------------------------------ | ---------------- | -------- | ----------------------------------------------- | -------------------------------------------------------------- |
| AQ-057 | Sortable column headers no `aria-sort`     | A1/H32           | High     | `database/DatabaseTable.tsx`                    | Add `aria-sort` attribute.                                     |
| AQ-058 | Sparkline chart no accessible description  | A1/H33           | High     | `hero/Sparkline.tsx`                            | Add `aria-label`.                                              |
| AQ-059 | CelebrationsSection switch no label        | A1/H34           | High     | `tracking-form/CelebrationsSection.tsx`         | Add `htmlFor`/`id` pairing.                                    |
| AQ-060 | QuickCaptureDefaultsSection input no label | A1/H35           | High     | `tracking-form/QuickCaptureDefaultsSection.tsx` | Add `<Label>`.                                                 |
| AQ-061 | ReplyInput no label                        | A1/H36           | High     | `dr-poo/ReplyInput.tsx`                         | Add `aria-label`.                                              |
| AQ-062 | Bristol type buttons no accessible name    | A1/H37           | High     | `BristolScale.tsx`                              | Add `aria-label="Type N - description"`.                       |
| AQ-063 | Progress ring no progressbar role          | A1/H38           | High     | `quick-capture/QuickCaptureTile.tsx`            | Add `role`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`. |
| AQ-064 | `window.prompt()` for save-view UI         | A1/H31, PR3/M-35 | High     | `src/pages/Patterns.tsx`                        | Replace with proper modal/input component.                     |

### Base UI Migration (Broken State Styling)

| ID     | Title                                        | Source | Severity | File(s)                         | Description                                         |
| ------ | -------------------------------------------- | ------ | -------- | ------------------------------- | --------------------------------------------------- |
| AQ-065 | Switch `data-[state=checked]` broken         | A1     | High     | `ui/switch.tsx`                 | Active styling not working after Base UI migration. |
| AQ-066 | Tabs `data-[state=active]` broken            | A1     | High     | `ui/tabs.tsx`                   | Active tab styling broken.                          |
| AQ-067 | ToggleGroup `data-[state=on]` broken         | A1     | High     | `ui/toggle-group.tsx`           | Toggle state broken.                                |
| AQ-068 | Accordion mixed Radix/Base UI selectors      | A1     | Med      | `ui/accordion.tsx`              | Radix primitive + Base UI selectors conflict.       |
| AQ-069 | ReproHealthSection Radix on Base UI          | A1     | Med      | `ReproductiveHealthSection.tsx` | Radix selectors on Base UI component.               |
| AQ-070 | UnitsSection ToggleGroup broken              | A1     | Med      | `UnitsSection.tsx`              | Confirmed TODO: `data-[state=on]` not firing.       |
| AQ-071 | DeleteConfirmDrawer overlay animation broken | A1     | Med      | `DeleteConfirmDrawer.tsx`       | `data-[state=open/closed]` not working.             |

---

## Sprint 4: Performance + Dead Code + Duplication

### Performance

| ID     | Title                                             | Source | Severity | File(s)                            | Description                                                           |
| ------ | ------------------------------------------------- | ------ | -------- | ---------------------------------- | --------------------------------------------------------------------- |
| AQ-072 | Unbounded `listAll` query subscribed reactively   | A1/C21 | Crit     | `SyncedLogsContext.tsx`            | `.collect()` on ALL logs, grows indefinitely. Paginate or hard limit. |
| AQ-073 | Full table scan for row count                     | A1/C22 | Crit     | `convex/logs.ts:763-775`           | `.collect()` just to get `.length`. Use paginate/counter.             |
| AQ-074 | `listFoodLogs` full collect + JS filter           | A1/H39 | High     | `convex/logs.ts:808`               | Add `by_userId_type` index.                                           |
| AQ-075 | `TrackPage` imported eagerly                      | A1/H40 | High     | `src/routeTree.tsx:33`             | All others are `lazy()`. Wrap in `lazy()` + `Suspense`.               |
| AQ-076 | `REPORT_HISTORY_COUNT = 500`                      | A1/H41 | High     | `src/hooks/useAiInsights.ts:40`    | 500 AI records fetched reactively on Track load. Reduce to 10-20.     |
| AQ-077 | N+1 full `.collect()` in `updateWeeklyDigest`     | A1/H42 | High     | `convex/computeAggregates.ts:497`  | Scope "prior foods" query with time window.                           |
| AQ-078 | `.take(100)` in-memory filter for latest analysis | A1/H43 | Med      | `convex/aiAnalyses.ts:125`         | If all 100 are errors, returns null. Use DB index filter.             |
| AQ-079 | O(habits x habitLogs) filter loop                 | A1/Med | Med      | `src/lib/baselineAverages.ts`      | Pre-build `Map<habitId, HabitLog[]>`.                                 |
| AQ-080 | O(days x habits) `.find` loop                     | A1/Med | Med      | `src/lib/digestiveCorrelations.ts` | Pre-build `Map<string, HabitConfig>`.                                 |
| AQ-081 | New Fuse instance per `searchFoodDocuments` call  | A1/Med | Med      | `shared/foodMatching.ts:487-491`   | Cache bucket-filtered Fuse instances.                                 |

### Dead Code

| ID     | Title                                              | Source      | Severity | File(s)                                              | Description                                                                                                      |
| ------ | -------------------------------------------------- | ----------- | -------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| AQ-082 | `applyLlmResults` always throws                    | A1, A3      | Med      | `convex/foodParsing.ts`                              | Dead body. Remove or stub properly.                                                                              |
| AQ-083 | `aiRateLimiter` is a no-op                         | A1, A3      | Med      | `src/lib/aiRateLimiter.ts`                           | `MIN_CALL_INTERVAL_MS = 0`. Entire body unreachable.                                                             |
| AQ-084 | Duplicate `resolveCanonicalFoodName`               | A1, A3      | Med      | `shared/foodProjection.ts`                           | Identical to `shared/foodCanonicalName.ts`. Delete one.                                                          |
| AQ-085 | `normalizeCanonicalName` copy-pasted 3+ times      | A1, PR3/H-6 | Med      | 3 convex files                                       | Partial fix in PR#3. Remaining files need import from shared module.                                             |
| AQ-086 | Dead validators in `convex/validators.ts`          | A3          | Low      | `convex/validators.ts`                               | `habitKindValidator`, `habitUnitValidator`, `fluidPresetValidator`, `storedFluidPresetValidator` never imported. |
| AQ-087 | `FILTER_OPTIONS`, `SortKey`, `SortDir` likely dead | A1, A3      | Low      | `foodSafetyUtils.ts`                                 | TanStack Table uses own filter/sort types.                                                                       |
| AQ-088 | `key?: string` dead prop in 5 SubRow editors       | A1, A3      | Low      | All SubRow editors                                   | React never passes `key` as a prop. Remove from interfaces.                                                      |
| AQ-089 | `streaks.ts` misleadingly named                    | A1, A3      | Low      | `src/lib/streaks.ts`                                 | Contains no streak logic. Rename to `gamificationDefaults.ts`.                                                   |
| AQ-090 | `toLegacyFoodStatus` potentially dead              | A1, A3      | Low      | `shared/foodEvidence.ts`                             | Exported but untested. Verify consumers.                                                                         |
| AQ-091 | `"use client"` directives (Vite no-op)             | A1          | Low      | `ui/date-picker.tsx`, `ui/tabs.tsx`, `ui/toggle.tsx` | Next.js artifact. Remove.                                                                                        |
| AQ-092 | `foodTypes.ts` 29-line re-export file              | A1          | Low      | `src/lib/foodTypes.ts`                               | Re-exports 6 types from `foodEvidence.ts`. Consolidate.                                                          |

### Duplication

| ID     | Title                               | Source       | Severity | File(s)                                            | Description                                                       |
| ------ | ----------------------------------- | ------------ | -------- | -------------------------------------------------- | ----------------------------------------------------------------- |
| AQ-093 | `TINT_BY_PROGRESS_COLOR` duplicated | A1           | Med      | `DurationEntryPopover.tsx`, `QuickCaptureTile.tsx` | Exact duplicate. Extract to shared module.                        |
| AQ-094 | `getDateKey` duplicated             | A1           | Med      | `BmFrequencyTile.tsx`, `BristolTrendTile.tsx`      | Identical function. Extract to shared utils.                      |
| AQ-095 | Inline `<select>` class repeated 5x | A1           | Med      | 5 Settings components                              | Extract to shared `HealthSelect` component.                       |
| AQ-096 | `MEASURE_UNIT_PATTERN` duplicated   | A1, PR3/M-23 | Med      | `foodMatching.ts`, `foodNormalize.ts`              | Regex duplicated. (Partially fixed in PR#3 for `foodParsing.ts`.) |

---

## Sprint 5: Polish + Personalization + Comments

### Hardcoded Personalization (CLAUDE.md Violation)

| ID     | Title                                           | Source | Severity | File(s)                               | Description                                                                         |
| ------ | ----------------------------------------------- | ------ | -------- | ------------------------------------- | ----------------------------------------------------------------------------------- |
| AQ-097 | Surgery-specific strings in 3 coaching prompts  | A1/Med | Med      | `src/lib/habitCoaching.ts:63,258,541` | `"post-surgery anastomosis recovery patient"` hardcoded. Parameterize from profile. |
| AQ-098 | Spanish alias `"agua"` in computation layer     | A1/Med | Med      | `src/lib/baselineAverages.ts:220`     | Hardcoded. Move to i18n or remove.                                                  |
| AQ-099 | `"tina"` and `"rec drug"` hardcoded in evidence | A1/Med | Med      | `shared/foodEvidence.ts:283-354`      | Habit modifier keywords. Externalize.                                               |

### Work-Ticket Markers in Production Code

| ID     | Title                                                        | Source | Severity | File(s)                                                                     | Description                            |
| ------ | ------------------------------------------------------------ | ------ | -------- | --------------------------------------------------------------------------- | -------------------------------------- |
| AQ-100 | `// F001:`-`F004:`, `// AB3:`, `// AA1:`, `// Z1:`, `// Z2:` | A1     | Low      | `WeightEntryDrawer.tsx`                                                     | Remove work-ticket markers.            |
| AQ-101 | `// SET-F003:`-`// SET-F006:`                                | A1     | Low      | `AppDataForm.tsx`, `useAppDataFormController.ts`, `DemographicsSection.tsx` | Remove.                                |
| AQ-102 | `// Bug #46`, `// Bug #47`                                   | A1     | Low      | `PersonalisationForm.tsx`                                                   | Remove.                                |
| AQ-103 | `// SET-F006:`                                               | A1     | Low      | `AiSuggestionsCard.tsx`                                                     | Remove.                                |
| AQ-104 | `// TODO(review):` in `foodMatching.ts`                      | A1     | Low      | `shared/foodMatching.ts:282-286`                                            | Remove or convert to actionable issue. |

### Data Correctness (Low)

| ID     | Title                                            | Source | Severity | File(s)                            | Description                                                      |
| ------ | ------------------------------------------------ | ------ | -------- | ---------------------------------- | ---------------------------------------------------------------- |
| AQ-105 | `gelatin dessert` classified as carbs/grains     | A1/Med | Med      | `shared/foodRegistry.ts`           | Gelatin is protein-derived. Reassign to `"protein"` or document. |
| AQ-106 | `"lactose free spreadable cheese"` duplicate     | A1/Med | Low      | `shared/foodRegistry.ts`           | Appears twice in `cream_cheese` examples.                        |
| AQ-107 | `["pureed potato","pureed potato"]` self-mapping | A1/Med | Low      | `shared/foodNormalize.ts:171`      | Reflexive synonym. Remove.                                       |
| AQ-108 | Best/worst days overlap when <=4 days            | A1/Med | Low      | `src/lib/digestiveCorrelations.ts` | Edge case in correlation display.                                |

### Stale Comments + Docs

| ID     | Title                                      | Source | Severity | File(s)                                     | Description                                        |
| ------ | ------------------------------------------ | ------ | -------- | ------------------------------------------- | -------------------------------------------------- |
| AQ-109 | Stale import path comment                  | A1     | Low      | `shared/foodEvidence.ts:180`                | Wrong path reference.                              |
| AQ-110 | Registry "New entry." placeholder notes    | A1     | Low      | `shared/foodRegistry.ts`                    | Non-descriptive. Replace with clinical rationale.  |
| AQ-111 | Developer planning notes in production UI  | A1     | Low      | `TransitMapInspector.tsx`, `TransitMap.tsx` | Developer rationale rendered as user-visible text. |
| AQ-112 | Zone-change notes explain "what" not "why" | A1/Med | Low      | `shared/foodRegistry.ts`                    | Replace with clinical rationale per CLAUDE.md.     |

### Large File Decomposition

| ID     | Title                         | Source | Severity | File(s)                                     | Description                                                             |
| ------ | ----------------------------- | ------ | -------- | ------------------------------------------- | ----------------------------------------------------------------------- |
| AQ-113 | DrPooSection.tsx 994 LOC      | A1     | High     | `settings/tracking-form/DrPooSection.tsx`   | Extract static data + subcomponents.                                    |
| AQ-114 | WeightEntryDrawer.tsx 906 LOC | A1     | High     | `track/quick-capture/WeightEntryDrawer.tsx` | Extract `WeightTrendChart` + unit conversion utils.                     |
| AQ-115 | LogEntry.tsx 832 LOC          | A1     | High     | `track/today-log/rows/LogEntry.tsx`         | Delegate editing to existing SubRow components.                         |
| AQ-116 | foodRegistry.ts 4057 LOC      | A1     | Med      | `shared/foodRegistry.ts`                    | Split data + utils. See also: tech-debt.md                              |
| AQ-117 | aiAnalysis.ts 1953 LOC        | A1     | Med      | `src/lib/aiAnalysis.ts`                     | Split into prompts/parsing/fetch modules. See also: tech-debt.md #TD-12 |
| AQ-118 | sync.ts 530 LOC               | A1     | Med      | `src/lib/sync.ts`                           | Split by domain.                                                        |

### Stale Documentation (from A2 + A5)

| ID     | Title                                                         | Source     | Severity | File(s)                              | Description                                  |
| ------ | ------------------------------------------------------------- | ---------- | -------- | ------------------------------------ | -------------------------------------------- |
| AQ-119 | `current-state-architecture.md` describes old client LLM path | A2/Stale-1 | Med      | `docs/current-state-architecture.md` | Update to reflect server-first matcher.      |
| AQ-120 | `launch-criteria.md` says transit map deferred                | A2/Stale-2 | Med      | `docs/product/launch-criteria.md`    | Transit map exists now. Update doc.          |
| AQ-121 | `launch-criteria.md` test counts stale                        | A2/Stale-3 | Low      | `docs/product/launch-criteria.md`    | Claims 75 E2E + 33 unit; actual is 607 unit. |
| AQ-122 | `scope-control.md` lists prompt mgmt as blocker               | A2/Stale-7 | Low      | `docs/product/scope-control.md`      | Downgraded per ADR-0008.                     |

---

## Done (already fixed)

### PR #2 Waves 1-2 (49 issues fixed)

| ID     | PR Item                        | Title                                        | Notes                                           |
| ------ | ------------------------------ | -------------------------------------------- | ----------------------------------------------- |
| AQ-D01 | DI-F001, SEC-F007              | Food parsing race condition + ownership      | Atomic OCC guard + userId check                 |
| AQ-D02 | LLM-F001, SEC-F008             | Prompt injection + ownership in LLM matching | System/user message split                       |
| AQ-D03 | PERF-F01, PAT-F001             | TransitMap lazy load + decomposition         | 1311 to 570 LOC                                 |
| AQ-D04 | TRK-F002, A11Y-F001, A11Y-F003 | Food modal save + ARIA                       | Real Convex mutation + ARIA listbox             |
| AQ-D05 | TRK-F001                       | Toast error handling                         | try-catch + empty queue guard                   |
| AQ-D06 | SET-F001, SET-F002             | Settings loading states + async errors       | isLoading gate + await                          |
| AQ-D07 | TEST-F001, TEST-F002           | processLogInternal + LLM failure tests       | 31 new error path tests                         |
| AQ-D08 | Wave 2                         | 36 High issues across 9 agents               | See `docs/plans/2026-03-15-pr2-review-fixes.md` |

### PR #3 (107 issues fixed)

| ID     | PR Item | Title                                        | Notes                                                                     |
| ------ | ------- | -------------------------------------------- | ------------------------------------------------------------------------- |
| AQ-D09 | C-1     | `matchUnresolvedItems` stubbed cleanly       | Early return, dead code removed                                           |
| AQ-D10 | C-2     | `updateFoodTrialSummaryImpl` deletion sweep  | `upsertFoodTrialSummaries` with `deleteOrphans` param                     |
| AQ-D11 | C-3     | 120-line duplication in computeAggregates    | Extracted shared helpers                                                  |
| AQ-D12 | C-4     | `historyByIngredient` full-table scan        | Single-pass loop, documented tradeoff                                     |
| AQ-D13 | H-6     | `normalizeCanonicalName` partial dedup       | Created `shared/foodCanonicalName.ts` (partial; 3 copies remain = AQ-085) |
| AQ-D14 | H-7     | `prefersSummaryCandidate` dedup              | Exported from `shared/foodNormalize.ts`                                   |
| AQ-D15 | H-12    | Bare "pepper" ambiguity                      | Removed from black pepper aliases                                         |
| AQ-D16 | H-13    | Infinite re-render in `useStationArtwork`    | Removed `loaded` from dependency array                                    |
| AQ-D17 | H-18    | Swallowed factory reset error                | Async + try/catch + error toast                                           |
| AQ-D18 | H-20    | Stale index in `FoodSubRow`                  | Bounds check added                                                        |
| AQ-D19 | M-5     | `assertProcessedFoodItems` incomplete        | Added `quantity` + `unit` validation                                      |
| AQ-D20 | M-24    | `normalizeItem` stale uncertainty fields     | Clears stale fields when `uncertain` is false                             |
| AQ-D21 | M-25    | `buildParsedFoodData` hardcodes `resolvedBy` | Now uses `isNew` check                                                    |
| AQ-D22 | M-31-32 | Keyboard focus on transit map buttons        | Added `focus-visible:ring-2`                                              |
| AQ-D23 | M-38    | Missing `non_binary` gender option           | Added option                                                              |
| AQ-D24 | M-39-40 | Labels + error accessibility in Demographics | `htmlFor`/`id` + `role="alert"`                                           |
| AQ-D25 | M-45    | Double-submission guard on food submit       | `saving` state flag                                                       |
| AQ-D26 | 39 Low  | Comment improvements, docs, constants        | See PR #3 report                                                          |

### Other Already Resolved

| ID     | Title                           | Notes                                                                                                        |
| ------ | ------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| AQ-D27 | TD-11: Transit map feature flag | Outstanding — `featureFlags.ts` still exists. Needs `reproductiveHealth: false` flag added for repro gating. |

---

## Descoped / Won't Fix

| ID     | Title                                      | Source              | Reason                                                                                                                   |
| ------ | ------------------------------------------ | ------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| AQ-X01 | BUG-01: Repro health inconsistent state    | bugs.md             | Descoped per ADR-0008. Feature flag gating not yet implemented.                                                          |
| AQ-X02 | BUG-02: Repro health can't be cleared      | bugs.md             | Descoped per ADR-0008.                                                                                                   |
| AQ-X03 | BT-80: OpenAI prompt management            | bugs.md/features.md | Downgraded per ADR-0008. Tracked in features.md as High.                                                                 |
| AQ-X04 | A1/C12: Postpartum notes field bug         | A1                  | Reproductive health descoped for v1 (ADR-0008) but feature flag gating not yet implemented. Track as AQ-006 for post-v1. |
| AQ-X05 | A2/Gap-5: Reproductive health active in v1 | A2                  | Decision made per ADR-0008 to gate for v1. Feature flag gating not yet implemented.                                      |

---

## Cross-Reference Index

| Backlog Item             | AQ ID(s)                                    | Status                  |
| ------------------------ | ------------------------------------------- | ----------------------- |
| bugs.md #BT-91           | Related to AQ-013 (type safety on log.data) | Both open               |
| bugs.md #BT-92           | Related to AQ-032 (bristolToConsistency)    | Both open               |
| bugs.md #PR2-WAVE3-4     | Merged into Sprint 3-5 items                | Superseded by this file |
| tech-debt.md #TD-01      | Related to AQ-072 (server-only evidence)    | Both open               |
| tech-debt.md #PERF-001   | Related to AQ-079 (analyzeLogs duplication) | Both open               |
| tech-debt.md #TD-05      | AQ-077 (weekly digest N+1)                  | Both open               |
| tech-debt.md #TD-06      | AQ-008 (backup field validation)            | Both open               |
| tech-debt.md #TD-12      | AQ-117 (aiAnalysis.ts decomposition)        | Both open               |
| features.md #CI-PIPELINE | AQ-007                                      | Both open               |
