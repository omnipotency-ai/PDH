# Caca Traca — Work Queue

> **Single source of truth** for all remediation, bugs, and tech debt.
> Replaces: `bugs.md`, `tech-debt.md`, `audit-remediation.md`
>
> **Sources:** A1 (consolidated codebase health), A2 (gap analysis), A3 (code health map), A4 (aiAnalysis deep dive), A5 (NotebookLM cross-ref), bugs.md, tech-debt.md
>
> **Created:** 2026-03-17
> **Last updated:** 2026-03-21

---

## How to use this file

- Each item has a unique ID (WQ-###)
- Cross-references to original source IDs are in the Source column
- Severity: **Crit** = security/data loss/patient safety, **High** = bugs/type safety/correctness, **Med** = maintainability/UX, **Low** = polish/cleanup
- Status: `open`, `in-progress`, `done`, `descoped`
- Items within each sprint are ordered by priority (do top items first)

---

## Sprint 0: Ship Blockers (before any user touches this)

| ID     | Title                                             | Source              | Sev  | File(s)                                                        | Description                                                                                                                                                                                    | Status   |
| ------ | ------------------------------------------------- | ------------------- | ---- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| WQ-001 | CI pipeline                                       | A2/Gap-1            | Crit | `.husky/pre-commit`, `.github/workflows/ci.yml`                | Husky pre-commit (typecheck + build + test:unit) + GitHub Actions CI (check + gitleaks).                                                                                                       | done     |
| WQ-002 | Secret scanning (gitleaks)                        | A1/C1               | Crit | `.husky/pre-commit`, `.github/workflows/ci.yml`                | gitleaks in pre-commit hook (soft check) + GH Actions job. Credential rotation deferred (private repo, sole dev).                                                                              | done     |
| WQ-003 | LLM matching architecture                         | A1/C2               | Crit | `convex/foodLlmMatching.ts`, `convex/foodParsing.ts`           | Investigated: two parallel LLM paths exist, neither works. Stubbed action + dead BYOK hook. Architecture decision deferred — hybrid approach recommended. Auth check not needed while stubbed. | done     |
| WQ-004 | Health data in error messages                     | A1/C8,C9,H25        | Crit | `src/lib/aiAnalysis.ts`, `src/lib/habitCoaching.ts`            | Replaced `rawContent.slice(0,200)` with static error strings in 3 locations. `console.error` retained for dev debugging.                                                                       | done     |
| WQ-005 | `dailyCap === 0` discards zero-tolerance habits   | A1/C7               | Crit | `src/lib/habitTemplates.ts:590`                                | Changed `> 0` to `>= 0` in `validateHabitConfig` and `normalizeHabitTypeValue`. Cap is informational only (no blocking).                                                                       | done     |
| WQ-006 | `currentItemIndex != null` skips first queue item | A1/C11              | Crit | `src/components/track/FoodMatchingModal.tsx`                   | Fixed: real bug was `currentItem?.itemIndex ?? 0` collapsing undefined and 0. Now checks `currentItem?.itemIndex !== undefined`.                                                               | done     |
| WQ-007 | Postpartum notes overwrite pregnancy notes        | A1/C12              | —    | `src/components/settings/repro/PregnancySection.tsx`           | **Descoped** — covered by WQ-009 reproductive health gating. Fix deferred to post-v1 repro re-enablement.                                                                                      | descoped |
| WQ-008 | `v.any()` in `importBackup` args                  | A1/C3,C4            | Crit | `convex/logs.ts`                                               | Replaced `v.any()` with `backupPayloadValidator`. Eliminated 13 `as any` casts with typed helper functions. 3 remaining `as any` are outside importBackup.                                     | done     |
| WQ-009 | Gate reproductive health for v1                   | ADR-0008            | Crit | `featureFlags.ts`, `AppDataForm`, `Track.tsx`, `aiAnalysis.ts` | Added `reproductiveHealth: false` flag. Gated 6 UI entry points + AI context. Components intact behind flag.                                                                                   | done     |
| WQ-010 | BYOK disclosure is misleading                     | A2/Gap-6, A1/H-note | High | `ArtificialIntelligenceSection.tsx`                            | Updated copy: "Stored on your device. Sent over encrypted connection for API requests, then immediately discarded — never stored on our servers."                                              | done     |
| WQ-011 | AI text stored as food                            | bugs/BT-91          | Crit | Food pipeline                                                  | Confirmed resolved: 3 layers of protection (`isValidFoodName` guard, evidence filtering, type-gated pipeline). Historical data cleaned.                                                        | done     |
| WQ-012 | Bristol classification wrong                      | bugs/BT-92          | Crit | `src/lib/foodStatusThresholds.ts`                              | **Fixed in Sprint 2.5 Wave 2.** Replaced weighted average with majority-rules 30% threshold.                                                                                                   | done     |

---

## Sprint 1: Security + Type Safety

### Security

| ID         | Title                                                | Source | Sev  | File(s)                                                        | Description                                                                                                                                  | Status   |
| ---------- | ---------------------------------------------------- | ------ | ---- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| WQ-013     | 13+ `as any` casts in `importBackup` DB inserts      | A1/C4  | Crit | `convex/logs.ts:1533-1829`                                     | **Done in WQ-008.** Eliminated 13 `as any` casts with typed helpers. 3 remaining `as any` outside importBackup (see WQ-027, WQ-028, WQ-030). | done     |
| WQ-014     | `as unknown as SyncedLog[]` double-cast              | A1/C5  | Crit | `src/lib/sync.ts`                                              | Replaced with `toValidatedSyncedLog()` per-row narrowing. Invalid logs warn+skip. Also found/fixed canonicalName type mismatch.              | done     |
| WQ-015     | `as unknown as ConvexLogData` sanitization cast      | A1/C6  | Crit | `src/lib/sync.ts`                                              | Typed switch on `type` with `satisfies ConvexLogData` per branch. Zero `as unknown as` casts remain.                                         | done     |
| WQ-016     | Multiple `as` casts on `unknown` log.data            | A1/C10 | Crit | `shared/foodEvidence.ts`, `shared/logDataParsers.ts`           | 7 casts replaced with 5 structural parsers (digestive, food, habit, activity, fluid). Invalid data warns+skips.                              | done     |
| WQ-017     | Unsafe AI insight cast                               | A1/C15 | Crit | `src/hooks/useAiInsights.ts`                                   | Cast was already removed from Patterns.tsx. Found same pattern in useAiInsights.ts:197. Replaced with `parseAiInsight()` + null filter.      | done     |
| WQ-018     | Prompt injection via `preferredName`                 | A1/H13 | High | `src/lib/aiAnalysis.ts`                                        | Name sanitized (strip XML/HTML, 50 char limit) + wrapped in `<patient_name>` XML delimiters.                                                 | done     |
| ~~WQ-019~~ | ~~`existingNames` unsanitized in food parse prompt~~ | A1/H15 | —    | `convex/foodParsing.ts`                                        | **Not applicable.** Verification confirmed candidates are passed via `JSON.stringify()` as structured data, not raw string interpolation.    | done     |
| WQ-020     | `WeeklySummaryInput` unsanitized                     | A1/H16 | High | `src/lib/aiAnalysis.ts`                                        | Applied `sanitizeUnknownStringsDeep` to weekly summary input, matching `fetchAiInsights` pattern.                                            | done     |
| WQ-021     | AI markdown rendered without safe-link policy        | A1/H17 | High | `DrPooReport.tsx`, `ConversationPanel.tsx`, `MealIdeaCard.tsx` | All links stripped from AI markdown (12 instances). `a` → `<span>` via components override.                                                  | done     |
| WQ-022     | `successUrl`/`cancelUrl` unvalidated                 | A1/H11 | High | `convex/stripe.ts:6-56`                                        | **Deferred** — Stripe setup incomplete. Will validate when payment frontend is built.                                                        | deferred |
| WQ-023     | No input sanitization on `foodRequests`              | A1/H12 | High | `convex/foodRequests.ts`                                       | Applied `sanitizeRequiredText`/`sanitizeOptionalText` to foodName, rawInput, note.                                                           | done     |
| WQ-024     | AI suggestions stored without length cap             | A1/H14 | High | `convex/extractInsightData.ts`                                 | `sanitizePlainText` + 500 char/suggestion, 5000 char/block caps with accumulator.                                                            | done     |
| WQ-025     | Migrations are public mutations                      | A1/Med | Med  | `convex/migrations.ts`                                         | Both converted to `internalMutation`. `mutation` import removed. No external callers.                                                        | done     |
| WQ-026     | Historical prompts re-sent without re-sanitization   | A1/Med | Med  | `src/lib/aiAnalysis.ts`                                        | `sanitizeUnknownStringsDeep` applied to `recentConversation` before LLM payload inclusion.                                                   | done     |

### Type Safety

| ID     | Title                                           | Source       | Sev  | File(s)                            | Description                                                                                                 | Status   |
| ------ | ----------------------------------------------- | ------------ | ---- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------- |
| WQ-027 | `ctx.db as any` in two queries                  | A1/H1        | High | `convex/logs.ts`                   | `listRowsByUserId` now accepts `DatabaseReader` directly. Zero `as any` casts remain in logs.ts.            | done     |
| WQ-028 | `cleanedData as any` in patch                   | A1/H2        | High | `convex/logs.ts`                   | Cast narrowed to `as unknown as Doc<"logs">["data"]` — intentional narrow cast within type-guarded context. | done     |
| WQ-029 | `items as unknown as ProcessedFoodItem[]`       | A1/H3        | High | `convex/foodParsing.ts`            | Full `isProcessedFoodItem` guard validating all 19 fields incl. nested arrays. Invalid items warn+skip.     | done     |
| WQ-030 | `ctx as unknown as MutationCtx` in query        | A1/H4        | High | `convex/logs.ts`                   | `listRowsByUserId` accepts `DatabaseReader`; `exportBackup` passes `ctx.db` directly — no cast needed.      | done     |
| WQ-031 | Four redundant `as` casts on sanitize return    | A1/H5, A4/H2 | High | `src/lib/aiAnalysis.ts`            | Four redundant `as` casts removed — generic preserves type.                                                 | done     |
| WQ-032 | `return id as Id<T>` no guard                   | A1/H6        | High | `src/lib/sync.ts`                  | Throws on empty string — empty ID = serious upstream bug. All callers receive IDs from Convex queries.      | done     |
| WQ-033 | `as HabitType` on unvalidated string            | A1/H7        | High | `src/lib/derivedHabitLogs.ts`      | Exported existing `isHabitType()` guard. Invalid types skip via `resolveHabitFromKey` null handling.        | done     |
| WQ-034 | `dateStr.split("-").map(Number)` no NaN check   | A1/H8        | High | `src/lib/digestiveCorrelations.ts` | **Deferred** — part of broader app-wide date/time consolidation effort.                                     | deferred |
| WQ-035 | `bristolToConsistency(0)` returns "constipated" | A1/H9        | High | `src/lib/analysis.ts`              | Guard added: throws on non-integer or out-of-range (< 1 or > 7). Range checks tightened to exact.           | done     |
| WQ-036 | Non-null assertion on quartile index            | A1/H10       | High | `shared/foodEvidence.ts`           | `Math.min` bounds check + `?? 0` fallback. No `!` assertions.                                               | done     |
| WQ-037 | No `beforeLoad` auth guard on `appLayoutRoute`  | A1/C13       | High | `src/routeTree.tsx`                | `beforeLoad` guard added. Redirects to `/home` (modal sign-in, no `/sign-in` route exists).                 | done     |
| WQ-038 | `useStore.getState()` stale cache               | A1/C14       | High | `src/hooks/useAiInsights.ts`       | Replaced with reactive selector + `dataRef` pattern matching hook convention.                               | done     |

### Correctness (High)

| ID     | Title                                     | Source            | Sev  | File(s)                               | Description                                                                                     | Status |
| ------ | ----------------------------------------- | ----------------- | ---- | ------------------------------------- | ----------------------------------------------------------------------------------------------- | ------ |
| WQ-039 | Pulse animation wrong origin              | A1/H26            | High | `transit-map/StationMarker.tsx:67-68` | **Moved to Sprint 2.6** — rebuilt from scratch in new StationNode component.                    | moved  |
| WQ-040 | Non-null assertions on zones array        | A1/H27            | High | `transit-map/TransitMap.tsx:400-402`  | **Moved to Sprint 2.6** — rebuilt from scratch with proper data flow.                           | moved  |
| WQ-041 | Menopause dual-write                      | A1/H28            | High | `repro/MenopauseSection.tsx`          | Removed `hormonalMedicationNotes` coupling. Each field now only updates itself.                 | done   |
| WQ-042 | Confetti values on every re-render        | A1/H29            | High | `ui/Confetti.tsx`                     | Random values pre-computed in `createParticles()`. No more per-render jitter.                   | done   |
| WQ-043 | Sleep goal no rollback on Convex failure  | A1/H30            | High | `quick-capture/HabitDetailSheet.tsx`  | `.catch()` + `toast.error` on all 3 sleep handlers. No Zustand rollback needed — Convex is SoT. | done   |
| WQ-044 | `window.prompt()` used for UI interaction | A1/H31            | High | `Patterns.tsx`, `FilterSheet.tsx`     | Replaced with inline form (text input + Save/Cancel) in FilterSheet. Keyboard Enter support.    | done   |
| WQ-045 | Food safety grid incorrect                | bugs/BT-20        | High | Food evidence pipeline                | **Moved to Sprint 2.5 Wave 5** — browser verification.                                          | moved  |
| WQ-046 | DB status logic thresholds                | bugs/BT-28        | High | Food classification pipeline          | **Moved to Sprint 2.5 Wave 5** — browser verification.                                          | moved  |
| WQ-047 | DB trend lines missing                    | bugs/BT-31        | High | Patterns page                         | **Moved to Sprint 2.5 Wave 5** — browser verification.                                          | moved  |
| WQ-048 | Food trial count merging                  | bugs/BT-86        | High | Normalization pipeline                | **Moved to Sprint 2.5 Wave 5** — browser verification.                                          | moved  |
| WQ-049 | Building evidence threshold too low       | bugs/BT-87        | High | Food evidence                         | **Fixed in Sprint 2.5 Wave 2.** 5-trial initial graduation, 3-trial recovery path.              | done   |
| WQ-050 | Transit time assumptions conflict         | A5/TRANSIT-WINDOW | High | `analysis.ts`, transit resolver       | **Fixed in Sprint 2.5 Wave 2.** Aligned to clinical model, no 55min conflict existed.           | done   |

---

## Sprint 2: Test Coverage

| ID     | Title                                            | Source | Sev  | File(s)                            | Description                                                                                        | Status   |
| ------ | ------------------------------------------------ | ------ | ---- | ---------------------------------- | -------------------------------------------------------------------------------------------------- | -------- |
| WQ-051 | Zero tests: LLM food matching pipeline           | A1/C16 | Crit | `convex/__tests__/`                | **Moved to Sprint 2.5 Wave 3** — full BYOK pipeline implementation + tests.                        | moved    |
| WQ-052 | Zero tests: `computeBaselineAverages`            | A1/C18 | Crit | `src/lib/baselineAverages.ts`      | 42 tests written. Also removed hardcoded "agua" alias (CLAUDE.md violation).                       | done     |
| WQ-053 | Zero tests: `habitProgress.ts`                   | A1/C19 | Crit | `src/lib/habitProgress.ts`         | 81 tests written. All habit types + destructive + zero-cap + integration scenarios.                | done     |
| WQ-054 | Zero tests: `derivedHabitLogs.ts`                | A1/C20 | Crit | `src/lib/derivedHabitLogs.ts`      | 48 tests written. Validates WQ-033 isHabitType guard + sort + alias resolution.                    | done     |
| WQ-055 | `it.fails` documents known production bug        | A1/C17 | High | E2E test suite                     | Bug fixed: expired items guard was inverted. `it.fails` converted to passing `it`.                 | done     |
| WQ-056 | Zero tests: `bristolToConsistency`               | A1/A4  | High | `src/lib/analysis.ts`              | 37 tests: bristolToConsistency + normalizeDigestiveCategory + normalizeEpisodesCount.              | done     |
| WQ-057 | Zero tests: `toSyncedLogs`/`sanitizeLogData`     | A1/A4  | High | `src/lib/sync.ts`                  | 40 tests: all log types, discriminated unions, null→undefined conversion, empty ID guard.          | done     |
| WQ-058 | Zero tests: `validateHabitConfig`                | A1/A4  | High | `src/lib/habitTemplates.ts`        | 68 tests: zero-cap preserved, legacy type coercion, kind enforcement, optional fields.             | done     |
| WQ-059 | Zero tests: `migrateLegacyStorage`               | A1/A4  | High | `src/lib/migrateLegacyStorage.ts`  | **Investigation: DELETE.** Migration obsolete — old format no longer produced. Delete in Sprint 6. | done     |
| WQ-060 | Partial tests: `computeCorrelations`             | A1/A4  | Med  | `src/lib/digestiveCorrelations.ts` | **Investigation: REMOVE.** Dead code — no runtime consumers, cache never populated. Sprint 6.      | done     |
| WQ-061 | Zero tests: `calculateGestationalAgeFromDueDate` | A1/A4  | Med  | `src/lib/reproductiveHealth.ts`    | **Descoped** per ADR-0008.                                                                         | descoped |
| WQ-062 | Zero tests: `mergeFoodMatchCandidates`           | A1/A2  | Med  | `shared/foodMatching.ts`           | Bundled with WQ-051 LLM pipeline work.                                                             | deferred |
| WQ-063 | 4 skipped destructive-habits E2E tests           | A1/A9  | High | `e2e/destructive-habits.spec.ts`   | All 4 tests implemented + unskipped. Setup helper added. Needs dev server to run.                  | done     |
| WQ-064 | Zero tests: `normalizeAssessmentRecord`          | A1/A2  | Med  | `shared/foodEvidence.ts`           | 8 tests: happy path, defaults, trimming, registry lookup, title-casing.                            | done     |

---

## Sprint 2.5: Transit Time, Evidence Thresholds, LLM Pipeline

**Plan:** `docs/plans/2026-03-17-sprint-2.5-transit-and-llm-pipeline.md`

| ID     | Title                                    | Source            | Sev  | Wave   | Description                                                                                                                                                                                   | Status |
| ------ | ---------------------------------------- | ----------------- | ---- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| WQ-199 | Clinical transit time research           | New               | High | Wave 1 | Full research doc at docs/research/2026-03-17-Clinical-Transit-Times-Post-Anastomosis.md. 6h floor validated, 24h center, surgery-type profiles.                                              | done   |
| WQ-200 | LLM cost research (BYOK)                 | New               | High | Wave 1 | Full research doc at docs/research/2026-03-17-LLM-Cost-Analysis-Food-Matching.md. ~$0.11/mo per user with BYOK.                                                                               | done   |
| WQ-201 | Codebase architecture scan               | New               | High | Wave 1 | Architecture summary in sprint plan file. Key integration map, function signatures, line numbers documented.                                                                                  | done   |
| WQ-050 | Transit time assumptions conflict        | A5/TRANSIT-WINDOW | High | Wave 2 | Aligned to clinical model: center 24h, spread 8h, floor 6h. Surgery-type + food-category adjustments. No 55min conflict (never existed).                                                      | done   |
| WQ-202 | Transit time calculation start-to-finish | New               | High | Wave 2 | Trigger correlation model (0-3h for Bristol 6-7) + transit (6-96h). Surgery/food adjustments integrated into buildTransitWindow().                                                            | done   |
| WQ-203 | Dr Poo time-of-day awareness             | New               | High | Wave 2 | buildPartialDayContext(): report time, partial-day note, time since last BM, in-transit foods.                                                                                                | done   |
| WQ-204 | Transit weight in assessments            | New               | High | Wave 2 | Trigger evidence feeds codeScore as negative signal. Bristol 7 downweights transit (0.1x). Recovery path: 3 good trials to escape avoid.                                                      | done   |
| WQ-012 | Bristol classification wrong             | bugs/BT-92        | Crit | Wave 2 | Replaced weighted average with majority-rules 30% threshold. 5 categories, tie-breaking by concern distance. 50 tests.                                                                        | done   |
| WQ-049 | Evidence threshold too low               | bugs/BT-87        | High | Wave 2 | Deleted dead MIN_RESOLVED_TRIALS=2. Real threshold=5 (INITIAL_GRADUATION_TRIALS). Recovery: 3 consecutive good trials to escape watch/avoid.                                                  | done   |
| WQ-051 | LLM food matching pipeline               | A1/C16            | Crit | Wave 3 | Full BYOK pipeline: matchUnresolvedItems + applyLlmResults + client hook. 19 new tests. 1145 total passing.                                                                                   | done   |
| WQ-062 | mergeFoodMatchCandidates tests           | A1/A2             | Med  | Wave 4 | Test + fix candidate merging from alias/fuzzy/embedding/LLM sources.                                                                                                                          | done   |
| WQ-139 | `gelatin dessert` misclassified          | A1/Med            | Med  | Wave 4 | Reclassify from carbs/grains to protein.                                                                                                                                                      | done   |
| WQ-140 | Duplicate registry example               | A1/Med            | Med  | Wave 4 | Remove duplicate "lactose free spreadable cheese" in cream_cheese.                                                                                                                            | done   |
| WQ-141 | Reflexive SYNONYM_MAP                    | A1/Med            | Med  | Wave 4 | Remove ["pureed potato", "pureed potato"].                                                                                                                                                    | done   |
| WQ-205 | Registry standalone word audit           | New               | Med  | Wave 4 | Add missing common standalone words (chicken, bread, fish, etc).                                                                                                                              | done   |
| WQ-206 | Per-food registry audit checklist        | New               | Med  | Wave 4 | Create checklist template for later per-food review session.                                                                                                                                  | done   |
| WQ-315 | Dr. Poo report trigger redesign          | User/billing      | Crit | Wave 5 | 4h cooldown, Bristol 6-7 emergency only, conversation-only lightweight mode during cooldown, Auto/Manual segmented toggle persisted in aiPreferences. Rate limiter enabled (5min safety net). | done   |
| WQ-316 | aiAnalyses table split migration         | User/billing      | Crit | Wave 5 | Migration batched (5 docs/batch, self-scheduling, idempotent). **Post-deploy:** Run from Convex dashboard. WQ-300 extends this for remaining 38 docs.                                         | done   |
| WQ-045 | Food safety grid incorrect               | bugs/BT-20        | High | Wave 5 | Browser verified PASS (2026-03-19). Correct status display confirmed.                                                                                                                         | done   |
| WQ-046 | DB status logic thresholds               | bugs/BT-28        | High | Wave 5 | Browser verified PASS. Initial "building" state correct before evidence window closes.                                                                                                        | done   |
| WQ-047 | DB trend lines missing                   | bugs/BT-31        | High | Wave 5 | Browser verified PASS. "—" for insufficient data, sparkline renders when data exists.                                                                                                         | done   |
| WQ-048 | Food trial count merging                 | bugs/BT-86        | High | Wave 5 | Browser verified PASS. Normalization correct, trial counts not duplicated.                                                                                                                    | done   |

---

## Sprint 2.5+: Data Architecture Overhaul — Schema, Bandwidth & LLM Context Pipeline

**Plan:** `docs/plans/2026-03-18-sprint-2.5+-data-architecture-overhaul.md`
**Audit:** `docs/research/2026-03-18-data-architecture-audit.md`

### Phase 1: Emergency Bandwidth Fixes (parallel, no dependencies)

| ID     | Title                                           | Source   | Sev  | Phase/Wave | Description                                                                                                                                                                                                                                                                                                      | Status |
| ------ | ----------------------------------------------- | -------- | ---- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| WQ-300 | Complete aiAnalysis payload migration (38 docs) | Audit F2 | Crit | P1/W1A     | Migration batched (5 docs/batch, self-scheduling, idempotent). **Post-deploy:** Run `migrateAiAnalysisPayloads` from Convex dashboard.                                                                                                                                                                           | done   |
| WQ-301 | Canonical name migration script                 | Audit F5 | Crit | P1/W1B     | `normalizeCanonicalNames` internalMutation: 4 tables, batch 50, self-scheduling, dry-run support. **Post-deploy:** Run from dashboard.                                                                                                                                                                           | done   |
| WQ-302 | Fix weeklyDigest "new foods" historical scan    | Audit F3 | High | P1/W1C     | Added `knownFoods` set to profiles. Replaced unbounded historical log scan with set membership check. knownFoods populated by writeProcessedItems, resolveItem, applyLlmResults, and updateWeeklyDigestImpl. Backfill via `backfillKnownFoods`. **Post-deploy:** Run `backfillKnownFoods` from Convex dashboard. | done   |

### Phase 2: Query Index Restoration (depends on WQ-301)

| ID     | Title                                    | Source   | Sev  | Phase/Wave | Description                                                                                                                                              | Status |
| ------ | ---------------------------------------- | -------- | ---- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| WQ-303 | Fix foodAssessments full-table scans     | Audit F5 | High | P2/W2A     | Replaced historyByFood, culprits with indexed queries. Removed runtime canonicalization. allFoods kept .collect() (no distinct op). Tests updated.       | done   |
| WQ-304 | Fix aggregateQueries full-table scans    | Audit F5 | High | P2/W2B     | foodTrialsByStatus uses by_userId_status index. foodTrialByName uses by_userId_canonicalName + .first(). Tests updated.                                  | done   |
| WQ-305 | Fix ingredientExposures full-table scans | Audit F4 | High | P2/W2C     | historyByIngredient uses by_userId_canonicalName (1,924 → ~5-20 reads). Removed runtime canonicalization. Tests updated.                                 | done   |
| WQ-306 | Make computeAggregates incremental       | Audit F3 | Crit | P2/W2D     | Scoped reads: report assessments via by_aiAnalysisId, per-food history via by_userId_canonicalName, 14-day log window. ~1,675 → ~60-80 reads per report. | done   |

### Phase 3: Schema Simplification (depends on Phase 2)

| ID     | Title                                   | Source   | Sev  | Phase/Wave | Description                                                                                                                                                                              | Status |
| ------ | --------------------------------------- | -------- | ---- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| WQ-307 | ingredientExposures: keep + fix indexes | Audit F4 | Med  | P3/W3A     | **Decision: Option C — keep table, fix indexes.** All 4 indexes in place (`by_userId`, `by_userId_logId`, `by_userId_canonicalName`, `by_userId_timestamp`), queries use them correctly. | done   |
| WQ-308 | Populate & extend foodEmbeddings        | Audit F1 | High | P3/W3B     | Seed registry embeddings via existing ensureFoodEmbeddings(). Extend schema for alias embeddings (sourceType: registry/alias). Embed user aliases on creation. Solves Chelitos problem.  | done   |
| WQ-309 | Evaluate reportSuggestions elimination  | Audit F6 | Low  | P3/W3C     | Eliminated. Suggestions read from aiAnalyses.insight.suggestions via new suggestionsByDateRange query. Table removed, write paths removed, backward-compatible import.                   | done   |

### Phase 4: LLM Context Pipeline Redesign (depends on Phase 2 — can run in parallel with Phase 3)

| ID     | Title                                            | Source          | Sev  | Phase/Wave | Description                                                                                                                                                                                 | Status  |
| ------ | ------------------------------------------------ | --------------- | ---- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| WQ-310 | Design relevance-filtered LLM context payload    | Audit/Strategic | Crit | P4/W4A     | Variable windows by log type + surgery. Concrete deltas (no pattern detection). Habit streaks. Done in plan doc.                                                                            | done    |
| WQ-311 | Build context compiler (client-side refactor)    | Audit/Strategic | Crit | P4/W4B     | Refactor buildLogContext + buildUserMessage in aiAnalysis.ts. 5 functions, variable windows, summary-based. Client-side first, server-side later (Wave 4D).                                 | done    |
| WQ-312 | LLM web search decision                          | Audit F7        | Med  | P4/W4B     | **Decision: KEEP.** Web search stays as last-resort fallback after embeddings/fuzzy/alias/LLM all fail. Not removing.                                                                       | done    |
| WQ-317 | Migrate API key storage from IndexedDB to Convex | User/arch       | High | P4/W4C     | Store user's BYOK OpenAI key in Convex profile (base64 obfuscated). Dual-write (IndexedDB + Convex) with auto-migration. Server-side key fallback in actions. Clear disclosure updated.     | done    |
| WQ-318 | Move context compiler server-side                | Arch            | High | P4/W4D     | After 4B+4C stabilization (~1wk real usage): move compiler to convex/buildLlmContext.ts. New generateDrPooReport action. **Phase 4 not complete until this ships.** Target: early Sprint 3. | blocked |

### Phase 5: Verification & Cleanup (depends on 4B and 4C)

| ID     | Title                        | Source | Sev  | Phase/Wave | Description                                                                                                                    | Status |
| ------ | ---------------------------- | ------ | ---- | ---------- | ------------------------------------------------------------------------------------------------------------------------------ | ------ |
| WQ-313 | Test suite updates           | —      | High | P5/W5A     | 67 new tests for context compiler + 15 API key tests. 1273 total passing.                                                      | done   |
| WQ-314 | Browser verification         | —      | High | P5/W5B     | Full Playwright verification completed 2026-03-19. All items PASS. Report: `docs/verification/wq-314-browser-verification.md`. | done   |
| WQ-319 | Dr. Poo quality verification | —      | Crit | P5/W5C     | Comparison doc at docs/verification/wq-319-drpoo-quality-comparison.md. 5 scenarios analyzed. **Awaiting user sign-off.**      | review |

---

## Transit Map Visuals (PAUSED)

**Plan:** `docs/plans/2026-03-17-sprint-2.6-transit-map-ui.md`

### Wave 0: Base UI Primitives (promoted from Sprint 3)

> Broken UI primitives must be fixed before building new transit map components on top of them.

| ID     | Title                                         | Source | Sev  | File(s)                                                | Description                                                                                                             | Status |
| ------ | --------------------------------------------- | ------ | ---- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ------ |
| WQ-080 | Switch: `data-[state=checked]` broken         | A1     | High | `ui/switch.tsx`                                        | Full Base UI migration: `@base-ui/react/switch`, `data-[checked]`/`data-[unchecked]`. All consumers updated.            | done   |
| WQ-081 | Tabs: `data-[state=active]` broken            | A1     | High | `ui/tabs.tsx`                                          | Full Base UI migration: `@base-ui/react/tabs`, `data-[active]`, `Tab`/`Panel` API. Patterns.tsx consumers updated.      | done   |
| WQ-082 | ToggleGroup: `data-[state=on]` broken         | A1     | High | `ui/toggle-group.tsx`                                  | Full Base UI migration: `@base-ui/react/toggle-group`, `data-[pressed]`. UnitsSection, HabitDetailSheet updated.        | done   |
| WQ-083 | Accordion: mixed Radix + Base UI              | A1     | High | `ui/accordion.tsx`                                     | Full Base UI migration: `@base-ui/react/accordion`, `data-[panel-open]`, type bridging for single/multiple.             | done   |
| WQ-084 | ReproductiveHealthSection: Radix on Base UI   | A1     | High | `settings/app-data-form/ReproductiveHealthSection.tsx` | Consumer updated: `data-[checked]`/`data-[unchecked]`.                                                                  | done   |
| WQ-085 | UnitsSection: `data-[state=on]` not firing    | A1     | High | `settings/app-data-form/UnitsSection.tsx`              | Consumer updated: `data-[pressed]`. TODO comment removed.                                                               | done   |
| WQ-086 | DeleteConfirmDrawer: overlay animation broken | A1     | High | `settings/DeleteConfirmDrawer.tsx`                     | Migrated to `@base-ui/react/dialog`. Animations use `data-[starting-style]`/`data-[ending-style]` consistent with rest. | done   |

### Wave 1-3: Transit Map Build

| ID     | Title                                 | Source         | Sev  | Wave   | Description                                                            | Status  |
| ------ | ------------------------------------- | -------------- | ---- | ------ | ---------------------------------------------------------------------- | ------- |
| WQ-207 | Audit existing transit map components | New            | High | Wave 1 | Inventory: what's mock vs live, Model Guide vs Live Network.           | done    |
| WQ-208 | Transit map container                 | New            | High | Wave 2 | Top-level component: corridors, zoom levels, loading states.           | done    |
| WQ-209 | Line track component                  | New            | High | Wave 2 | Single food line: stations in lineOrder, zone markers, progress.       | done    |
| WQ-210 | Station node component                | New            | High | Wave 2 | Single station: color by status, trial badge, in-transit pulse, tap.   | done    |
| WQ-211 | Station inspector detail sheet        | New            | High | Wave 2 | Sidebar: evidence summary, AI verdict, Bristol breakdown, digestion.   | done    |
| WQ-212 | Wire into Patterns page               | New            | High | Wave 2 | Replace RegistryTransitMap with TransitMapContainer.                   | done    |
| WQ-213 | Delete transitData.ts mock data       | New            | Med  | Wave 3 | Blocked — Model Guide tab still rendered. File scoped to transit-map/. | blocked |
| WQ-214 | Delete legacy transit map components  | New            | Med  | Wave 3 | Blocked — Model Guide tab still rendered in Patterns.tsx.              | blocked |
| WQ-147 | Remove dead `transitMapV2` flag       | A1, bugs/TD-11 | Low  | Wave 3 | Flag removed — was never referenced outside featureFlags.ts.           | done    |
| WQ-160 | Developer notes in production UI      | A1             | Low  | Wave 3 | Replaced with user-facing descriptions in TransitMap.tsx.              | done    |
| WQ-039 | Pulse animation wrong origin          | A1/H26         | High | Wave 2 | Rebuilt in StationNode — pulse on signal dot only when building.       | done    |
| WQ-040 | Non-null assertions on zones          | A1/H27         | High | Wave 2 | Rebuilt — no assertions needed with proper TransitNetwork data flow.   | done    |

---

## Sprint 2.7: Transit Map Canvas — Radial SVG Explorer Map

**Plan:** `docs/plans/2026-03-20-sprint-2.7-transit-map-canvas.md`

### Wave 1: Geometry Foundation

| ID     | Title                      | Source | Sev  | Wave   | Description                                                         | Status |
| ------ | -------------------------- | ------ | ---- | ------ | ------------------------------------------------------------------- | ------ |
| WQ-320 | Hand-authored map geometry | New    | High | Wave 1 | SVG paths, station positions, zone rings for radial concentric map. | open   |
| WQ-321 | Corridor color palette     | New    | Med  | Wave 1 | Color constants for corridors, lines, and zone rings.               | open   |

### Wave 2: Canvas Rendering

| ID     | Title                          | Source | Sev  | Wave   | Description                                                       | Status |
| ------ | ------------------------------ | ------ | ---- | ------ | ----------------------------------------------------------------- | ------ |
| WQ-322 | TransitMapCanvas SVG component | New    | High | Wave 2 | Full SVG canvas: zone rings, line paths, station circles, labels. | open   |
| WQ-323 | StationCallout inline detail   | New    | High | Wave 2 | Inline canvas callout for station-focus zoom level.               | open   |
| WQ-324 | TransitMapZoomController       | New    | High | Wave 2 | Zoom state machine + animated transitions + touch pan/swipe.      | open   |

### Wave 3: Integration & Cleanup

| ID     | Title                          | Source | Sev  | Wave   | Description                                                                       | Status |
| ------ | ------------------------------ | ------ | ---- | ------ | --------------------------------------------------------------------------------- | ------ |
| WQ-325 | Wire into Patterns page        | New    | High | Wave 3 | Replace TransitMapContainer with TransitMapZoomController.                        | open   |
| WQ-326 | Delete list-based components   | New    | Med  | Wave 3 | Remove TransitMapContainer, LineTrack, StationNode, StationInspector.             | open   |
| WQ-327 | Delete Model Guide + mock data | New    | Med  | Wave 3 | Remove Model Guide tab, all SVG components, transitData.ts. Completes WQ-213/214. | open   |

### Wave 4: Polish & Verify

| ID     | Title                | Source | Sev  | Wave   | Description                                                  | Status |
| ------ | -------------------- | ------ | ---- | ------ | ------------------------------------------------------------ | ------ |
| WQ-328 | Quality gate         | New    | High | Wave 4 | Typecheck + tests + build.                                   | open   |
| WQ-329 | Browser verification | New    | Med  | Wave 4 | Playwright verify all 4 zoom levels render on Patterns page. | open   |

---

## Sprint 3: Error Handling + Accessibility + Base UI

### Error Handling (Silent Swallowing)

| ID         | Title                                             | Source          | Sev  | File(s)                                    | Description                                                                                                                                                    | Status |
| ---------- | ------------------------------------------------- | --------------- | ---- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| WQ-065     | LogEntry save error silently dropped              | A1/H18          | High | `today-log/rows/LogEntry.tsx:238`          | `catch { /* Keep editor open */ }` — show toast on error. Added `toast.error(getErrorMessage(err, ...))`.                                                      | done   |
| WQ-066     | ActivitySubRow save error swallowed               | A1/H19          | High | `today-log/editors/ActivitySubRow.tsx:66`  | Show toast. Added `toast.error(getErrorMessage(err, ...))`.                                                                                                    | done   |
| WQ-067     | FluidSubRow save error swallowed                  | A1/H20          | High | `today-log/editors/FluidSubRow.tsx:83`     | Show toast. Added `toast.error(getErrorMessage(err, ...))`.                                                                                                    | done   |
| WQ-068     | HabitSubRow save error swallowed                  | A1/H21          | High | `today-log/editors/HabitSubRow.tsx`        | Show toast. Added `toast.error(getErrorMessage(err, ...))`.                                                                                                    | done   |
| WQ-069     | ReproductiveSubRow save error swallowed           | A1/H22          | High | `today-log/editors/ReproductiveSubRow.tsx` | Show toast. Added `toast.error(getErrorMessage(err, ...))`. (Gated by WQ-009 but fixed anyway)                                                                 | done   |
| WQ-070     | WeightSubRow save error swallowed                 | A1/H23          | High | `today-log/editors/WeightSubRow.tsx`       | Show toast. Added `toast.error(getErrorMessage(err, ...))`.                                                                                                    | done   |
| WQ-071     | Audio resume error swallowed                      | A1/H24          | Med  | `src/lib/sounds.ts:50`                     | Added `console.warn("AudioContext resume failed:", err)` logging.                                                                                              | done   |
| ~~WQ-072~~ | ~~Sleep goal + updateHabit no rollback~~          | —               | —    | —                                          | Duplicate of WQ-043.                                                                                                                                           | —      |
| WQ-320     | Delete handlers in SubRows have no error handling | Sprint 3 review | High | All 5 SubRow editors + `LogEntry.tsx`      | Inline `onDelete` calls have no try/catch — rejection is unhandled, confirm prompt gets stuck. Same `toast.error(getErrorMessage(...))` pattern as WQ-065–070. | open   |

### Accessibility

| ID     | Title                                                 | Source          | Sev  | File(s)                                         | Description                                                                                                                                                                                                     | Status |
| ------ | ----------------------------------------------------- | --------------- | ---- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| WQ-073 | DB table: no `aria-sort` on sortable columns          | A1/H32          | High | `database/DatabaseTable.tsx`                    | Added `aria-sort` (ascending/descending/none) via TanStack `getIsSorted()`.                                                                                                                                     | done   |
| WQ-074 | Sparkline: no accessible description                  | A1/H33          | High | `hero/Sparkline.tsx`                            | Added `role="img"` + `aria-label` to AreaChart.                                                                                                                                                                 | done   |
| WQ-075 | CelebrationsSection: switch no linked label           | A1/H34          | High | `tracking-form/CelebrationsSection.tsx`         | Replaced `<p>` with `<Label htmlFor="celebrations-enabled">`.                                                                                                                                                   | done   |
| WQ-076 | QuickCaptureDefaults: input no label                  | A1/H35          | High | `tracking-form/QuickCaptureDefaultsSection.tsx` | Added sr-only `<Label htmlFor="qc-water-default">`.                                                                                                                                                             | done   |
| WQ-077 | ReplyInput: no label                                  | A1/H36          | High | `dr-poo/ReplyInput.tsx`                         | Added `aria-label="Reply to Dr. Poo"`.                                                                                                                                                                          | done   |
| WQ-078 | BristolScale: buttons no aria-label                   | A1/H37          | High | `BristolScale.tsx`                              | Added `aria-label="Type N — description"` per button.                                                                                                                                                           | done   |
| WQ-079 | QuickCaptureTile: progress ring no role               | A1/H38          | High | `quick-capture/QuickCaptureTile.tsx`            | **N/A** — no SVG progress ring exists. Text-based progress only.                                                                                                                                                | done   |
| WQ-321 | Sparkline gradient ID breaks with CSS variable colors | Sprint 3 review | High | `hero/Sparkline.tsx`                            | `color.replace("#", "")` produces invalid ID when callers pass `var(--section-summary)`. Parentheses in `url(#fill-var(...))` misparsed. All instances share same gradient ID. Fix: sanitize to `[a-zA-Z0-9-]`. | open   |

### Base UI Migration (Radix → Base UI selector fixes)

> Returned from transit map sprint — these are general UI bugs, not transit-map-specific.

| ID     | Title                                         | Source | Sev  | File(s)                                                | Description                                                            | Status |
| ------ | --------------------------------------------- | ------ | ---- | ------------------------------------------------------ | ---------------------------------------------------------------------- | ------ |
| WQ-080 | Switch: `data-[state=checked]` broken         | A1     | High | `ui/switch.tsx`                                        | Active styling broken — Radix selectors on Base UI component.          | open   |
| WQ-081 | Tabs: `data-[state=active]` broken            | A1     | High | `ui/tabs.tsx`                                          | Active tab styling broken.                                             | open   |
| WQ-082 | ToggleGroup: `data-[state=on]` broken         | A1     | High | `ui/toggle-group.tsx`                                  | Toggle state broken.                                                   | open   |
| WQ-083 | Accordion: mixed Radix + Base UI              | A1     | High | `ui/accordion.tsx`                                     | Mixed primitive sources.                                               | open   |
| WQ-084 | ReproductiveHealthSection: Radix on Base UI   | A1     | High | `settings/app-data-form/ReproductiveHealthSection.tsx` | Radix selectors on Base UI component. (Gated by WQ-009 but fix anyway) | open   |
| WQ-085 | UnitsSection: `data-[state=on]` not firing    | A1     | High | `settings/app-data-form/UnitsSection.tsx`              | Confirmed TODO in code.                                                | open   |
| WQ-086 | DeleteConfirmDrawer: overlay animation broken | A1     | High | `settings/DeleteConfirmDrawer.tsx`                     | `data-[state=open/closed]` selectors broken.                           | open   |

---

## Sprint 4: Performance + Architecture + Tech Debt

### Performance

| ID     | Title                                           | Source        | Sev  | File(s)                              | Description                                                                           | Status |
| ------ | ----------------------------------------------- | ------------- | ---- | ------------------------------------ | ------------------------------------------------------------------------------------- | ------ |
| WQ-087 | Unbounded `listAll` query                       | A1/C21        | High | `src/contexts/SyncedLogsContext.tsx` | **NOT DONE** — still bare `.collect()` with no date window or hard limit. Needs fix.  | open   |
| WQ-088 | Full table scan for count                       | A1/C22        | High | `convex/logs.ts:763-775`             | `.take(10_001)` capped count. Returns `{ count, capped }`. UI shows "10,000+".        | done   |
| WQ-089 | `listFoodLogs` full collect + JS filter         | A1/H39        | High | `convex/logs.ts:808`                 | Added `by_userId_type` + `by_userId_type_timestamp` indexes. Direct index query.      | done   |
| WQ-090 | `TrackPage` eagerly imported                    | A1/H40        | High | `src/routeTree.tsx:33`               | **NOT DONE** — still eagerly imported. Only page not using `lazy()`.                  | open   |
| WQ-091 | `REPORT_HISTORY_COUNT = 500`                    | A1/H41        | High | `src/hooks/useAiInsights.ts:40`      | Reduced to 20. Covers ~2 weeks of heavy usage for dedup.                              | done   |
| WQ-092 | N+1 collect for prior foods                     | A1/H42        | High | `convex/computeAggregates.ts:497`    | Already resolved by WQ-302 (knownFoods set on profile).                               | done   |
| WQ-093 | `.take(100)` filter misses older successes      | A1/H43        | Med  | `convex/aiAnalyses.ts:125`           | Server-side `.filter(q => q.eq(...)).first()` replaces `.take(100)` + in-memory find. | done   |
| WQ-094 | `analyzeLogs` called twice                      | bugs/PERF-001 | High | `Patterns.tsx`, `Menu.tsx`           | Both call `analyzeLogs` independently. Lift to shared context or memoized hook.       | open   |
| WQ-095 | `baselineAverages` O(habits × habitLogs)        | A1/Med        | Med  | `src/lib/baselineAverages.ts`        | Pre-built `Map<habitId, HabitLog[]>` for O(1) lookup.                                 | done   |
| WQ-096 | `digestiveCorrelations` O(days × habits) lookup | A1/Med        | Med  | `src/lib/digestiveCorrelations.ts`   | Stale — file already deleted in WQ-060.                                               | closed |
| WQ-097 | Fuse instance recreated per call                | A1/Med        | Med  | `shared/foodMatching.ts:487-491`     | Module-level cache with contextId invalidation.                                       | done   |

### Architecture / Tech Debt

| ID     | Title                                   | Source               | Sev  | File(s)                                                                     | Description                                                                   | Status  |
| ------ | --------------------------------------- | -------------------- | ---- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------- |
| WQ-098 | `buildFoodEvidenceResult` client+server | bugs/TD-01, A2/Gap-9 | High | `shared/foodEvidence.ts`, `convex/computeAggregates.ts`                     | Blocked — client needs trial-level detail not in schema. Fix path documented. | blocked |
| WQ-099 | 5 copies of `resolveCanonicalFoodName`  | A1/Med               | Med  | `shared/foodCanonicalName.ts`, `shared/foodProjection.ts`, + 3 Convex files | 9 copies → 1 in `shared/foodCanonicalName.ts`. 13 files updated.              | done    |
| WQ-100 | Duplicate `TINT_BY_PROGRESS_COLOR`      | A1/Med               | Med  | `DurationEntryPopover.tsx`, `QuickCaptureTile.tsx`                          | Extracted to `quick-capture/constants.ts`.                                    | done    |
| WQ-101 | Duplicate `getDateKey`                  | A1/Med               | Med  | `hero/BmFrequencyTile.tsx`, `hero/BristolTrendTile.tsx`                     | Extracted to `hero/utils.ts`. Also consolidated `MS_PER_DAY`.                 | done    |
| WQ-102 | Duplicate select class string           | A1/Med               | Med  | 5 Settings components                                                       | `SettingsSelect` component with `section` prop. 6 consumers updated.          | done    |
| WQ-103 | Duplicate `MEASURE_UNIT_PATTERN` regex  | A1/Med               | Med  | `shared/foodMatching.ts`, `shared/foodNormalize.ts`                         | Canonical in `foodNormalize.ts`. Fixed drift (added `mg`, `servings`).        | done    |
| WQ-104 | Zone type duplication                   | bugs/TD-08           | Med  | `foodStatusThresholds.ts`                                                   | Removed `Zone` alias, use `FoodZone` from registry directly.                  | done    |

### Large File Decomposition

| ID     | Title                                   | Source             | Sev  | File(s)                                     | Description                                                                      | Status |
| ------ | --------------------------------------- | ------------------ | ---- | ------------------------------------------- | -------------------------------------------------------------------------------- | ------ |
| WQ-105 | Split `DrPooSection.tsx` (994 LOC)      | A1                 | High | `settings/tracking-form/DrPooSection.tsx`   | 994→418 LOC + 3 extracted files.                                                 | done   |
| WQ-106 | Split `WeightEntryDrawer.tsx` (906 LOC) | A1                 | High | `track/quick-capture/WeightEntryDrawer.tsx` | 906→533 LOC + `WeightTrendChart`, `UnitAwareInput`, `weightUtils`.               | done   |
| WQ-107 | Split `LogEntry.tsx` (832 LOC)          | A1                 | High | `today-log/rows/LogEntry.tsx`               | Delegate log-type editing to existing SubRow components.                         | open   |
| WQ-108 | Split `aiAnalysis.ts` (1953 LOC)        | A1, A4, bugs/TD-12 | Med  | `src/lib/aiAnalysis.ts`                     | Split into `aiPrompts.ts`, `aiParsing.ts`, `aiFetchInsights.ts`.                 | open   |
| WQ-109 | Split `foodRegistry.ts` (4057 LOC)      | A1                 | Med  | `shared/foodRegistry.ts`                    | Split into `foodRegistryData.ts` (3718) + `foodRegistryUtils.ts` (145) + barrel. | done   |
| WQ-110 | Split `sync.ts` (530 LOC)               | A1                 | Med  | `src/lib/sync.ts`                           | Split into 5 modules: syncCore, syncLogs, syncAi, syncFood, syncWeekly + barrel. | done   |

---

## Sprint 5: UX Bugs + Polish

### Medium UX Bugs

| ID     | Title                           | Source             | Sev | File(s)                       | Description                                                                                                | Status |
| ------ | ------------------------------- | ------------------ | --- | ----------------------------- | ---------------------------------------------------------------------------------------------------------- | ------ |
| WQ-111 | BM time label position          | bugs/BT-04         | Med | Track/BM section              | Time needs to move before notes.                                                                           | open   |
| WQ-112 | Fluid section design            | bugs/BT-06         | Med | Track/Fluid section           | User wants old design back (ml + drink + add).                                                             | open   |
| WQ-113 | BM count data wrong             | bugs/BT-18         | Med | Track/Hero                    | Needs runtime verification.                                                                                | open   |
| WQ-114 | Next food logic                 | bugs/BT-21         | Med | Food pipeline                 | Depends on food safety grid pipeline.                                                                      | open   |
| WQ-115 | Toast notifications weak        | bugs/BT-45         | Med | Toast system                  | No coloured backgrounds, stacking, or prominent undo.                                                      | open   |
| WQ-116 | Units not applied to fluids     | bugs/BT-49         | Med | FluidSection + other surfaces | Some surfaces may hardcode ml.                                                                             | open   |
| WQ-117 | Food section redesign           | bugs/BT-64         | Med | Track/Food section            | Remove "Food Badges" title, simplify layout.                                                               | open   |
| WQ-118 | Weight target save bug          | bugs/BT-65         | Med | Weight section                | Typing "180" doesn't save — needs "180.0" or Enter/Tab.                                                    | open   |
| WQ-119 | TimeInput Enter-to-save         | bugs/BT-67         | Med | TimeInput component           | Resolved: TimeInput replaced with native `<input type="time">` in all panels + EditableEntryRow onKeyDown. | done   |
| WQ-120 | Insights bar removal            | bugs/BT-73         | Med | Track page                    | Remove heuristics insight below quick capture.                                                             | open   |
| WQ-121 | Desktop long-press menu         | bugs/BT-74         | Med | Today log                     | Add 3-dot menu for desktop discoverability.                                                                | open   |
| WQ-122 | BM layout rework                | bugs/BT-75         | Med | Track/BM section              | Time before notes, 8-col grid.                                                                             | open   |
| WQ-123 | Conversation markdown hierarchy | bugs/BT-76         | Med | ConversationPanel             | All text bold/large — no visual hierarchy.                                                                 | open   |
| WQ-124 | Conversation card redesign      | bugs/BT-77         | Med | ConversationPanel             | Single chat-window with separate summary/suggestions/meals cards.                                          | open   |
| WQ-125 | Meal card blog-style            | bugs/BT-78         | Med | Meal cards                    | Time/slot where image would be, menu where snippet would be.                                               | open   |
| WQ-126 | Next Food to Try + zones        | bugs/BT-79         | Med | Dr Poo / Patterns             | Show Dr. Poo suggestions AND zone-1 options.                                                               | open   |
| WQ-127 | Today log text overflow         | bugs/BT-82, WIP-E4 | Med | Today log                     | Fixed: truncate, overflow-hidden, line-clamp-2, min-w-0 throughout.                                        | done   |
| WQ-128 | Date header duplication         | bugs/BT-83         | Med | Patterns page                 | Repeats date in page + global header.                                                                      | open   |
| WQ-129 | Safe foods confidence labels    | bugs/BT-85         | Med | Food evidence UI              | "moderate"/"strong"/"weak" labels undefined.                                                               | open   |
| WQ-130 | Amber dot not intuitive         | bugs/BUG-AMBER     | Med | FoodMatchingModal trigger     | Unresolved food amber dot needs better affordance (arrow, label, or button).                               | open   |
| WQ-131 | Drawer overlay click-through    | bugs/WIP-X1        | Med | Drawer system                 | Clicking outside drawer triggers underlying quick capture cards.                                           | open   |
| WQ-132 | Filter toggle system color      | bugs/WIP-BD1       | Med | Database filters              | Starred filter uses browser orange instead of app theme.                                                   | open   |
| WQ-133 | Food DB filter clearing         | bugs/WIP-BE2       | Med | Database filters              | Requires Clear All + Apply; should be instant.                                                             | open   |
| WQ-134 | Filter sheet double-open        | bugs/WIP-AG1       | Med | Database filters              | Sheet pops open, closes, opens again.                                                                      | open   |
| WQ-135 | Trial history not wired         | bugs/WIP-AH1       | Med | Database row detail           | Row detail says "no trial history" but table shows counts.                                                 | open   |

### Hardcoded Personalization (CLAUDE.md violation)

| ID     | Title                                    | Source | Sev | File(s)                                      | Description                                         | Status |
| ------ | ---------------------------------------- | ------ | --- | -------------------------------------------- | --------------------------------------------------- | ------ |
| WQ-136 | "post-surgery anastomosis" hardcoded 3x  | A1/Med | Med | `src/lib/habitCoaching.ts:63-74,258-262,541` | Parameterize from health profile.                   | open   |
| WQ-137 | Spanish alias "agua" hardcoded           | A1/Med | Med | `src/lib/baselineAverages.ts:220`            | **Done in WQ-052.** Removed from computation layer. | done   |
| WQ-138 | Hardcoded "tina" and "rec drug" keywords | A1/Med | Med | `shared/foodEvidence.ts:283-354`             | Move to configurable list.                          | open   |

### Data Correctness (Medium)

| ID     | Title                                  | Source     | Sev | File(s)                            | Description                                                                    | Status |
| ------ | -------------------------------------- | ---------- | --- | ---------------------------------- | ------------------------------------------------------------------------------ | ------ |
| WQ-139 | `gelatin dessert` misclassified        | A1/Med     | Med | `shared/foodRegistry.ts`           | **Done in Sprint 2.5 Wave 4.** Reclassified to protein.                        | done   |
| WQ-140 | Duplicate registry example             | A1/Med     | Med | `shared/foodRegistry.ts`           | **Done in Sprint 2.5 Wave 4.** Duplicate removed.                              | done   |
| WQ-141 | Reflexive self-mapping in SYNONYM_MAP  | A1/Med     | Med | `shared/foodNormalize.ts:171`      | **Done in Sprint 2.5 Wave 4.** Reflexive mapping removed.                      | done   |
| WQ-142 | Best/worst days overlap                | A1/Med     | Med | `src/lib/digestiveCorrelations.ts` | **Moot** — entire module recommended for removal (WQ-060). Delete in Sprint 6. | done   |
| WQ-143 | Stale comments reference deleted files | bugs/TD-09 | Med | `foodStatusThresholds.ts`          | Fixed: comments are accurate tombstones explaining migration to food registry. | done   |

---

## Sprint 6: Dead Code + Polish + Documentation

### Dead Code Removal

| ID     | Title                                              | Source         | Sev | File(s)                                | Description                                                           | Status |
| ------ | -------------------------------------------------- | -------------- | --- | -------------------------------------- | --------------------------------------------------------------------- | ------ |
| WQ-144 | `applyLlmResults` always throws                    | A1             | Low | `convex/foodParsing.ts`                | Fully implemented: validates args, optimistic concurrency, DB writes. | done   |
| WQ-145 | `matchUnresolvedItems` body unreachable            | A1             | Low | `convex/foodLlmMatching.ts`            | Fully implemented: auth, fuzzy pre-match, OpenAI call, post-process.  | done   |
| WQ-146 | `aiRateLimiter` is a no-op                         | A1             | Low | `src/lib/aiRateLimiter.ts`             | Fixed: `MIN_CALL_INTERVAL_MS = 300_000` (5 min). Rate limiter active. | done   |
| WQ-147 | `transitMapV2` always true                         | A1, bugs/TD-11 | Low | `src/lib/featureFlags.ts`              | **Moved to Sprint 2.6 Wave 3.** Remove flag + all conditional checks. | moved  |
| WQ-148 | `streaks.ts` misleadingly named                    | A1             | Low | `src/lib/streaks.ts`                   | No streak logic. Rename to `gamificationDefaults.ts`.                 | open   |
| WQ-149 | `foodTypes.ts` re-export wrapper                   | A1             | Low | `src/lib/foodTypes.ts`                 | File deleted. Consumers consolidated.                                 | done   |
| WQ-150 | `toLegacyFoodStatus` potentially dead              | A1             | Low | `shared/foodEvidence.ts`               | Exported but not tested. Verify consumers.                            | open   |
| WQ-151 | `columns` stale export                             | A1             | Low | `patterns/database/columns.tsx`        | Static snapshot at module load.                                       | open   |
| WQ-152 | `key?: string` in all SubRow props                 | A1             | Low | All 5 SubRow editors                   | React never passes `key` as a prop. Remove from interfaces.           | open   |
| WQ-153 | `FILTER_OPTIONS`, `SortKey`, `SortDir` likely dead | A1             | Low | `patterns/database/foodSafetyUtils.ts` | TanStack Table uses its own types. Verify and remove.                 | open   |
| WQ-154 | 91 dead exports (A3 orphan scan)                   | A3             | Low | Multiple files                         | See A3 CODE_HEALTH_MAP for full list. Remove after verification.      | open   |

### Work Ticket Markers in Production Code

| ID     | Title                                        | Source | Sev | File(s)                                                                     | Description                                                   | Status |
| ------ | -------------------------------------------- | ------ | --- | --------------------------------------------------------------------------- | ------------------------------------------------------------- | ------ |
| WQ-155 | `// F001:` through `// AB3:` comments        | A1/Med | Low | `WeightEntryDrawer.tsx`                                                     | Remove work-ticket markers.                                   | open   |
| WQ-156 | `// SET-F003:` through `// SET-F006:`        | A1/Med | Low | `AppDataForm.tsx`, `useAppDataFormController.ts`, `DemographicsSection.tsx` | Remove.                                                       | open   |
| WQ-157 | `// Bug #46`, `// Bug #47`                   | A1/Med | Low | `PersonalisationForm.tsx`                                                   | Remove.                                                       | open   |
| WQ-158 | `// TODO(review):` in `foodMatching.ts`      | A1/Med | Low | `shared/foodMatching.ts:282-286`                                            | Remove or resolve.                                            | open   |
| WQ-159 | `"use client"` directives (Next.js artifact) | A1     | Low | `ui/date-picker.tsx`, `ui/tabs.tsx`, `ui/toggle.tsx`                        | Does nothing in Vite. Remove.                                 | open   |
| WQ-160 | Developer planning notes in production UI    | A1     | Low | `TransitMapInspector.tsx`, `TransitMap.tsx`                                 | **Moved to Sprint 2.6 Wave 3.** Remove or gate.               | moved  |
| WQ-161 | Registry "New entry." placeholder notes      | A1     | Low | `shared/foodRegistry.ts`                                                    | Describes nothing. Replace with clinical rationale or remove. | open   |
| WQ-162 | Zone-change notes lack clinical rationale    | A1/Med | Low | `shared/foodRegistry.ts`                                                    | Notes explain what changed, not why. Add rationale.           | open   |
| WQ-163 | Stale comment: wrong import path             | A1     | Low | `shared/foodEvidence.ts:180`                                                | References wrong path for normalizeFoodName. Fix or remove.   | open   |

### Documentation Fixes

| ID     | Title                                             | Source          | Sev | File(s)                                   | Description                                                                                                        | Status |
| ------ | ------------------------------------------------- | --------------- | --- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------ |
| WQ-164 | `current-state-architecture.md` stale             | A2/Gap-3, A5    | Med | `docs/current-state-architecture.md`      | Still describes client-initiated LLM loop. Update to server-first.                                                 | open   |
| WQ-165 | `launch-criteria.md` stale test counts            | A2, A5          | Med | `docs/product/launch-criteria.md`         | Claims "75 E2E + 33 unit tests" — actual is 607 unit tests.                                                        | open   |
| WQ-166 | `launch-criteria.md` in untracked `docs/product/` | Session review  | Med | `docs/product/launch-criteria.md`         | In gitignored directory. Move into tracked docs tree.                                                              | open   |
| WQ-167 | `scope-control.md` in untracked `docs/product/`   | Session review  | Med | `docs/product/scope-control.md`           | Same issue. Move into tracked docs tree.                                                                           | open   |
| WQ-168 | `MD_INDEX.md` references archived files           | Session review  | Med | `docs/MD_INDEX.md`                        | Archive as `MD_INDEX_v1.md`, create fresh version.                                                                 | open   |
| WQ-169 | Archive files need headers                        | Session review  | Low | `docs/archive/*`                          | Each archived file should explain why it was archived.                                                             | open   |
| WQ-170 | Verify ADR-0002 implementation log                | Session review  | Low | `docs/archive/0002-implementation-log.md` | Verify completeness.                                                                                               | open   |
| WQ-171 | Terminology drift across docs                     | A5              | Low | Multiple docs                             | "Transit map" vs "transit chart" vs "metro map" vs "live network"; "trials" vs "transits"; etc. Standardize.       | open   |
| WQ-172 | Missing ADR for BYOK architecture change          | A5/REV-AI-MODEL | Low | `docs/adrs/`                              | Original ADR-0003 specified client BYOK; implementation moved to server-initiated. No ADR explains why.            | open   |
| WQ-173 | Health profile scope creep (45+ fields)           | A5/SCOPE-HEALTH | Med | Health profile, `convex/schema.ts`        | Grown from ~14 to ~45+ fields including clinical-grade reproductive tracking. Audit and trim non-essential fields. | open   |

### Remaining Low-Priority Bugs

| ID     | Title                                    | Source      | Sev | File(s)            | Description                                    | Status |
| ------ | ---------------------------------------- | ----------- | --- | ------------------ | ---------------------------------------------- | ------ |
| WQ-174 | Destructive alert icon size              | bugs/BT-62  | Low | Alert components   | h-6 w-6 → h-5 w-5 (partial).                   | open   |
| WQ-175 | BM pill text alignment                   | bugs/BT-66  | Low | BM pills           | Left-aligned in some pills.                    | open   |
| WQ-176 | Quick capture medium viewport            | bugs/BT-68  | Low | Quick capture grid | 3-col breaks → needs 2-col at medium viewport. | open   |
| WQ-177 | Activity detail orange                   | bugs/BT-69  | Low | Activity detail    | System default orange highlight.               | open   |
| WQ-178 | Celebration too weak                     | bugs/BT-70  | Low | Celebration system | Sound too short, confetti too minimal.         | open   |
| WQ-179 | Boolean habit duplicate name             | bugs/BT-71  | Low | Habit display      | "Brush Teeth / Brush Teeth".                   | open   |
| WQ-180 | Alert badge position                     | bugs/BT-72  | Low | Alert badges       | Should be top-right with hover X.              | open   |
| WQ-181 | Fluid habit auto-styling                 | bugs/BT-81  | Low | Habit creation     | Auto-set blue glass icon for fluid habits.     | open   |
| WQ-182 | Hero label overlap                       | bugs/BT-84  | Low | Hero tiles         | Side labels overlap numbers.                   | open   |
| WQ-183 | Habit-digestion correlation inconclusive | bugs/BT-88  | Low | Correlations       | Most results are inconclusive.                 | open   |
| WQ-184 | Dr Poo archive link dup                  | bugs/BT-89  | Low | Archive page       | Duplicate link.                                | open   |
| WQ-185 | "Last tested" ambiguity                  | bugs/BT-90  | Low | Food display       | Last eaten or last transit? Clarify.           | open   |
| WQ-186 | Duplicate timestamp on expand            | bugs/WIP-E1 | Low | Today log          | Timestamp shown twice.                         | open   |
| WQ-187 | Cigarettes duplicate subrows             | bugs/WIP-E2 | Low | Today log          | Duplicate entries.                             | open   |
| WQ-188 | Sleep expand repeats label               | bugs/WIP-E3 | Low | Today log          | Label shown twice.                             | open   |
| WQ-189 | Activity rows split label/time           | bugs/WIP-E5 | Low | Today log          | Label and time separated.                      | open   |
| WQ-190 | Tea quick capture missing unit           | bugs/WIP-J1 | Low | Quick capture      | No unit shown.                                 | open   |

### Misc Low (A4 aiAnalysis.ts specific)

| ID     | Title                                               | Source | Sev | File(s)                           | Description                                                                          | Status |
| ------ | --------------------------------------------------- | ------ | --- | --------------------------------- | ------------------------------------------------------------------------------------ | ------ |
| WQ-191 | Locale-dependent `formatTime`                       | A4/H1  | Med | `src/lib/aiAnalysis.ts:298-306`   | `toLocaleString` non-deterministic across environments. Use deterministic formatter. | open   |
| WQ-192 | `getDaysPostOp` uses `new Date()`                   | A4/H3  | Med | `src/lib/aiAnalysis.ts:313`       | Drift across renders. Minor but worth noting.                                        | open   |
| WQ-193 | `buildUserMessage` has 15 parameters                | A4/M7  | Low | `src/lib/aiAnalysis.ts:1275-1291` | Use options object. (Do during WQ-108 split)                                         | open   |
| WQ-194 | `WeeklyContext`/`WeeklyDigestInput` duplicate types | A4/M8  | Low | `src/lib/aiAnalysis.ts:214-234`   | Structurally identical. Merge. (Do during WQ-108 split)                              | open   |
| WQ-195 | `CONTEXT_WINDOW_HOURS = 72` undocumented            | A4/L11 | Low | `src/lib/aiAnalysis.ts:236`       | Add comment explaining why 72 hours.                                                 | open   |
| WQ-196 | `fetchWeeklySummary` doesn't validate model         | A4/L15 | Low | `src/lib/aiAnalysis.ts:1893`      | Should call `getValidInsightModel(model)`.                                           | open   |

### Infrastructure

| ID     | Title                                | Source              | Sev | File(s)          | Description                                               | Status |
| ------ | ------------------------------------ | ------------------- | --- | ---------------- | --------------------------------------------------------- | ------ |
| WQ-197 | 4 orphan game layer tables in Convex | bugs/CONVEX-ORPHANS | Low | Convex dashboard | Manual deletion required via web dashboard.               | open   |
| WQ-198 | Legacy activity sleep readers        | bugs/INV-01         | Low | Various          | Some code paths may still read sleep from legacy records. | open   |

---

## Descoped (not doing for v1)

| ID     | Title                               | Source      | Status                |
| ------ | ----------------------------------- | ----------- | --------------------- |
| WQ-D01 | Repro health inconsistent state     | bugs/BUG-01 | Descoped per ADR-0008 |
| WQ-D02 | Repro health can't be cleared       | bugs/BUG-02 | Descoped per ADR-0008 |
| WQ-D03 | Menu nav (no UI path)               | bugs/BT-01  | Deferred design task  |
| WQ-D04 | Track page full redesign            | bugs/BT-60  | Deferred design task  |
| WQ-D05 | Food request admin/review tooling   | A2/Gap-10   | Post-v1               |
| WQ-D06 | Onboarding wizard                   | A2/Gap-12   | Post-v1               |
| WQ-D07 | Runtime prompt management dashboard | ADR-0008    | Post-v1 (downgraded)  |

---

## Sprint 7: Full Codebase Audit Findings (2026-03-20)

**Source:** `docs/2026-03-20-full-codebase-audit.md` — 12 parallel Haiku 4.5 Explorer agents, each reviewing the full 380-file codebase.

> Items below are NET NEW findings not already tracked elsewhere in this queue. Cross-references note related existing WQ items where applicable.

### Security & Auth (Convex Backend)

| ID         | Title                                                      | Source                             | Sev  | File(s)                                                                  | Description                                                                                                                                                                                                     | Status |
| ---------- | ---------------------------------------------------------- | ---------------------------------- | ---- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| WQ-322     | `foodAssessments.byReport` post-filter auth gap            | Audit/Convex,Perf-BE               | Crit | `convex/foodAssessments.ts:188-206`                                      | Uses single `by_aiAnalysisId` index then post-filters userId. Malicious client can enumerate IDs. Add composite index `by_userId_aiAnalysisId`. (Also flagged as read amplification by perf audit.)             | done   |
| WQ-323     | OpenAI calls: inadequate error handling + log sanitization | Audit/Convex,Security,Perf-BE,Cost | Crit | `convex/foodLlmMatching.ts`, `convex/ai.ts`, `src/hooks/useApiKey.ts:64` | LLM errors swallowed with console.warn. Client can't distinguish quota/network/key issues. Also: `console.error("[ApiKey]", err)` may log key. Fix both: structured errors + sanitized logging. Absorbs WQ-331. | done   |
| WQ-324     | API key validation runs after OpenAI client creation       | Audit/Convex                       | Crit | `convex/ai.ts:48-53`                                                     | `OPENAI_API_KEY_PATTERN` check runs after `new OpenAI({ apiKey })`. Move validation to top of handler.                                                                                                          | done   |
| WQ-325     | Race conditions in upsert mutations                        | Audit/Convex                       | High | `convex/ingredientOverrides.ts`, `convex/foodLibrary.ts`                 | Check-then-act pattern: two concurrent requests → duplicate documents. Accept duplicates and dedupe in queries, or add optimistic locking.                                                                      | done   |
| WQ-326     | No error handling on `ctx.scheduler.runAfter()` calls      | Audit/Convex,Perf-BE               | High | `convex/computeAggregates.ts:682-687`                                    | Scheduled mutations fail silently. Log task IDs, add try/catch in handlers. Backfill halts without warning. (Also flagged by perf audit.)                                                                       | done   |
| WQ-327     | `allIngredients` truncates at 5K with no flag              | Audit/Convex,Perf-BE               | High | `convex/ingredientExposures.ts:39-47`                                    | `.take(5000)` caps results. Power users get incomplete aggregation. Add truncation flag or pagination. (Also flagged by perf audit.)                                                                            | done   |
| WQ-328     | No profile existence check before storing API key          | Audit/Convex                       | High | `convex/lib/apiKeys.ts:41-48`, `convex/profiles.ts`                      | `storeApiKey` throws "Profile not found" if profile missing. `setApiKey` should upsert profile or return clear error.                                                                                           | done   |
| WQ-329     | Missing integer validation on quantity fields              | Audit/Security                     | Med  | `convex/foodParsing.ts`, `shared/foodMatching.ts`                        | `v.number()` accepts negative, NaN, Infinity. Add `Number.isFinite()` guard and min/max bounds.                                                                                                                 | done   |
| WQ-330     | Inconsistent error messages — no error codes               | Audit/Convex                       | Med  | Multiple convex files                                                    | All errors are plain strings. Client can't parse or i18n. Define error codes (VALIDATION_ERROR, NOT_FOUND, etc.).                                                                                               | open   |
| ~~WQ-331~~ | ~~Error logging could expose API key~~                     | —                                  | —    | —                                                                        | **Absorbed into WQ-323** (same root cause: error handling + log sanitization).                                                                                                                                  | —      |
| WQ-332     | Env var format validation missing                          | Audit/Security                     | Low  | `convex/stripe.ts:16-19`, `convex/auth.config.ts:6`                      | STRIPE*SECRET_KEY accepted without `sk_test*`/`sk*live*` pattern check. Add regex validation.                                                                                                                   | done   |
| WQ-333     | No CSP headers configured                                  | Audit/Security                     | Low  | `vite.config.ts`                                                         | No Content-Security-Policy. Add minimal CSP for production deployment.                                                                                                                                          | done   |

### Performance (Backend)

| ID     | Title                                                   | Source        | Sev  | File(s)                               | Description                                                                                                            | Status |
| ------ | ------------------------------------------------------- | ------------- | ---- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------ |
| WQ-334 | Double query in `updateFoodTrialSummaryImpl`            | Audit/Perf-BE | High | `convex/computeAggregates.ts:300-316` | Queries by raw name AND canonical for each food (2x reads). Deduplicate names before loop. ~10% latency gain.          | done   |
| WQ-335 | Unbounded `.collect()` in weekly digest queries         | Audit/Perf-BE | High | `convex/computeAggregates.ts:543-562` | `aiAnalyses` + `foodAssessments` queries in digest have no limit. Could hit 32K Convex read limit. Add `.take(limit)`. | done   |
| WQ-336 | `conversations.claimPendingReplies` N individual writes | Audit/Perf-BE | High | `convex/conversations.ts:157-165`     | Loads 100 messages then patches each individually. 50 pending = 50 DB writes. Document tradeoff or batch.              | done   |
| WQ-337 | Conversation search: 500-row client-side filter         | Audit/Perf-BE | Med  | `convex/conversations.ts:140-145`     | Loads 500 rows, filters in memory. Add fulltext index or server-side filter.                                           | done   |
| WQ-338 | Double normalization in migrations                      | Audit/Perf-BE | Med  | `convex/migrations.ts:51-56`          | `resolveCanonicalFoodName()` called redundantly in loop. Cache results within batch.                                   | done   |
| WQ-339 | Missing composite indexes for sort patterns             | Audit/Convex  | Med  | `convex/schema.ts`                    | `foodTrialSummary` queries sort by updatedAt in memory. Add `by_userId_updatedAt` index.                               | done   |

### Performance (Frontend)

| ID     | Title                                                        | Source               | Sev  | File(s)                                         | Description                                                                                                                                                                                                      | Status |
| ------ | ------------------------------------------------------------ | -------------------- | ---- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| WQ-340 | `useBaselineAverages` throttle cascading recomputes          | Audit/Perf-FE        | High | `src/hooks/useBaselineAverages.ts:71-96`        | 5s throttle queues multiple setTimeouts. Replace with debounce or batch state updates.                                                                                                                           | done   |
| WQ-341 | Skeleton/empty states missing across app                     | Audit/Perf-FE,Design | High | `src/pages/Patterns.tsx`, multiple components   | DatabaseTable + TransitMap lazy-load without fallback UI. No centralized empty state pattern (ObservationWindow, TodayLog lack "no entries" UI). Add Suspense skeletons + empty state component. Absorbs WQ-359. | open   |
| WQ-342 | TodayLog grouping creates new Map/Set every render           | Audit/Perf-FE        | Med  | `src/components/track/today-log/grouping.ts:37` | `groupLogEntries()` allocates 22 new Map/Set. Use Object or pre-allocated structures.                                                                                                                            | done   |
| WQ-343 | TrialHistorySubRow renders all trials without virtualization | Audit/Perf-FE        | Med  | `patterns/database/TrialHistorySubRow.tsx`      | Foods with 50 trials render 50 DOM nodes. Paginate (show 10 + "View more") or virtualize.                                                                                                                        | done   |
| WQ-344 | `useAiInsights` subscribes to 8+ independent queries         | Audit/Perf-FE        | Med  | `src/hooks/useAiInsights.ts:67-97`              | Each `useQuery()` syncs independently. Batch into single action or `useQueries()` if available.                                                                                                                  | done   |
| WQ-345 | Zustand store subscriptions in ProfileContext re-renders     | Audit/Perf-FE        | Med  | `src/contexts/ProfileContext.tsx:91-104`        | Any profile mutation re-renders top-level provider. Verify granular selectors or split providers.                                                                                                                | done   |

### Cost & Tokenomics

| ID     | Title                                        | Source             | Sev  | File(s)                         | Description                                                                                                                                                                      | Status |
| ------ | -------------------------------------------- | ------------------ | ---- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| WQ-346 | Memoize `buildRegistryVocabularyForPrompt()` | Audit/Cost,Perf-BE | High | `convex/foodLlmMatching.ts:104` | Rebuilds 125-food markdown table every call. 6,250 wasted tokens/call. Convert to module-level static. **15 min fix.** (Also flagged by perf audit for registry in-memory load.) | done   |
| WQ-347 | Add fuzzy pre-matching before LLM            | Audit/Cost         | High | `convex/foodLlmMatching.ts:440` | Fuse.js already in deps. Simple matches ("banana" → "ripe banana") skip LLM. Saves ~40% of LLM calls. **1 hour fix.**                                                            | done   |
| WQ-348 | Compress Dr. Poo conversation context        | Audit/Cost         | Med  | `src/lib/aiAnalysis.ts:67,94`   | `MAX_CONVERSATION_MESSAGES` 20→10. Combined with WQ-091 (500→20 reports), saves 20K tokens/call. **30 min fix.**                                                                 | done   |

### Component Quality & Decomposition

| ID     | Title                                                 | Source         | Sev  | File(s)                                                    | Description                                                                                                             | Status |
| ------ | ----------------------------------------------------- | -------------- | ---- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------ |
| WQ-349 | Decompose `useQuickCapture.ts` (742 LOC)              | Audit/Quality  | Crit | `src/hooks/useQuickCapture.ts`                             | 8+ internal state pieces, 6+ async handlers. Split into useHabitLog, useCelebrationTrigger, useDetailSheetController.   | done   |
| WQ-350 | Extract `EditableEntryRow` from 6 duplicate sub-rows  | Audit/Simplify | High | All 6 SubRow editors in `today-log/editors/`               | 80% identical code: state mgmt, delete confirmation, edit/cancel buttons. ~500 LOC saved. See also WQ-107.              | done   |
| WQ-351 | Track.tsx passes 15+ props to TodayLog                | Audit/Quality  | High | `src/pages/Track.tsx`                                      | Props: logs, habits, weightUnit, selectedDate, dayOffset, nav handlers, delete, save, autoEditId, etc. Extract context. | done   |
| WQ-352 | Missing error boundaries (modals, streaming, transit) | Audit/Quality  | High | `FoodMatchingModal.tsx`, `useAiInsights`, transit-map      | Modal/streaming crashes take down component tree. Wrap in `<ErrorBoundary>` at page level.                              | done   |
| WQ-353 | 5 accessibility gaps: aria-live, aria-hidden          | Audit/Quality  | Med  | `QuickCaptureTile.tsx`, `BowelSection.tsx`, `LogEntry.tsx` | Animated counters missing `aria-live="polite"`. Decorative icons missing `aria-hidden`. No fieldset in edit mode.       | done   |
| WQ-354 | Weight parsing duplicated (metric/imperial)           | Audit/Quality  | Med  | `track/quick-capture/WeightEntryDrawer.tsx`                | `parseEntryWeightKg` / `parseTargetWeightKg` duplicate logic. Extract `parseWeightKg(value, unit)`.                     | done   |

### Design Consistency

| ID         | Title                                               | Source       | Sev | File(s)                                      | Description                                                                                               | Status |
| ---------- | --------------------------------------------------- | ------------ | --- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------ |
| WQ-355     | Hardcoded hex colors in bowelConstants/BristolScale | Audit/Design | Med | `bowelConstants.ts:5-40`, `BristolScale.tsx` | Direct hex values (`#f87171`, `#34d399`) instead of CSS variables. Replace with `--section-bowel` tokens. | open   |
| WQ-356     | 5 missing section color tokens in CSS               | Audit/Design | Med | `src/index.css`                              | All 5 tokens defined in dark + light mode (lines 226-249, 408-431).                                       | done   |
| WQ-357     | 296 hardcoded pixel font sizes                      | Audit/Design | Med | Multiple components                          | `text-[10px]` (201) + `text-[11px]` (95). Define custom Tailwind text scale or use `text-xs`.             | open   |
| WQ-358     | 56 redundant `dark:` prefixes                       | Audit/Design | Low | Multiple components                          | App is dark-only. `dark:data-[state=on]:text-emerald-300` → `data-[state=on]:text-emerald-300`.           | open   |
| ~~WQ-359~~ | ~~No consistent empty state pattern~~               | —            | —   | —                                            | **Absorbed into WQ-341** (skeleton + empty states are the same initiative).                               | —      |

### Simplification & Dead Code

| ID     | Title                                      | Source         | Sev | File(s)                        | Description                                                                                                            | Status |
| ------ | ------------------------------------------ | -------------- | --- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ------ |
| WQ-360 | ~~Delete unused `customFoodPresets.ts`~~   | Audit/Simplify | —   | `src/lib/customFoodPresets.ts` | **Wrong finding** — actively imported by FoodSection.tsx + PersonalisationForm.tsx.                                    | closed |
| WQ-361 | Inline `celebrations.ts` (single consumer) | Audit/Simplify | Low | `src/lib/celebrations.ts`      | Only imported by `useQuickCapture.ts`. ~30 LOC, simple enough to inline.                                               | open   |
| WQ-362 | Food matching 4-layer type cascade         | Audit/Simplify | Med | `shared/foodMatching.ts`       | `PreprocessedFoodPhrase` → `FoodMatchCandidate` → `FoodMatchBucketOption` → `ConfidenceRoute`. Flatten. ~80 LOC saved. | open   |
| WQ-363 | Merge ingredient exposure/profile hooks    | Audit/Simplify | Med | `src/lib/syncFood.ts`          | Separate hooks for exposures and profiles. Unify into `useIngredientData()` returning merged view. ~50 LOC saved.      | open   |

### Architecture & Documentation

| ID     | Title                                                   | Source        | Sev | File(s)                         | Description                                                                                                              | Status |
| ------ | ------------------------------------------------------- | ------------- | --- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------ |
| WQ-364 | No root README.md                                       | Audit/Docs    | Med | `/README.md`                    | New devs can't find entry points. Create with: quick start (bun install, convex dev, bun run dev), stack, links to docs. | open   |
| WQ-365 | No architecture overview for food evidence pipeline     | Audit/Docs    | Med | `docs/`                         | Missing ARCHITECTURE-OVERVIEW.md: food system 101, data flow diagram, Bayesian evidence pipeline, LLM matching paths.    | open   |
| WQ-366 | WIP.md is 14k tokens — too large to navigate            | Audit/Docs    | Med | `docs/WIP.md`                   | Split into per-sprint summaries or convert to reference-style. Add table of contents.                                    | open   |
| WQ-367 | ~40% of constants scattered across files                | Audit/Arch    | Med | Multiple                        | Evidence window, LLM config, OpenAI URL in multiple files. Centralize to `convex/constants.ts` + `src/lib/constants.ts`. | open   |
| WQ-368 | Some imports use relative paths instead of `@/` aliases | Audit/Arch    | Low | Multiple                        | Inconsistent import style. Run lint rule or codemod to enforce `@/*` and `@shared/*` aliases.                            | open   |
| WQ-369 | `ingredientExposures` projection contract undocumented  | Audit/Arch    | Low | `convex/ingredientExposures.ts` | Derived/projected table rebuilt from logs — no comment explains invariant. Add inline doc.                               | open   |
| WQ-370 | Fuse.js threshold (0.35) undocumented                   | Audit/Quality | Low | `shared/foodMatching.ts:96`     | No explanation why 0.35. Add comment with rationale or A/B test reference.                                               | open   |
| WQ-371 | `as` casts in syncCore.ts need JSDoc                    | Audit/Quality | Low | `src/lib/syncCore.ts:119-188`   | 6+ `as` casts at API boundary in `sanitizeLogData()`. Add JSDoc explaining why each is safe.                             | open   |

---

## Untested (need browser verification — no code change yet)

These items from bugs.md need manual browser testing before they can be assessed:

- **Settings:** BT-46, BT-47, BT-51, BT-52, BT-53, BT-54, BT-55
- **AI system:** BT-35, BT-36, BT-37, BT-38, BT-42, BT-43, BT-61
- **Menu:** BT-22, BT-23, BT-24

---

## Summary

| Sprint                                        | Total | Done | Open | Future | Moved | Descoped |
| --------------------------------------------- | ----- | ---- | ---- | ------ | ----- | -------- |
| **Sprint 0: Ship Blockers**                   | 12    | 11   | 1    | —      | —     | 1        |
| **Sprint 1: Security + Type Safety**          | 38    | 30   | 2    | —      | 6     | —        |
| **Sprint 2: Test Coverage**                   | 14    | 11   | —    | —      | 2     | 1        |
| **Sprint 2.5: Transit + Evidence + LLM**      | 20    | 16   | 4    | —      | —     | —        |
| **Sprint 2.5+: Data Architecture Overhaul**   | 19    | 15   | 2    | 1      | 1     | —        |
| **Sprint 2.6: Transit Map UI (list-based)**   | 12    | 5    | —    | 5      | 2     | —        |
| **Sprint 2.7: Transit Map SVG Canvas**        | 10    | 3    | 7    | —      | —     | —        |
| **Sprint 3: Error Handling + A11y + Base UI** | 24    | 14   | 2    | —      | 7     | 1        |
| **Sprint 4: Performance + Architecture**      | 24    | 19   | 3    | 1      | —     | —        |
| **Sprint 5: UX Bugs + Polish**                | 26    | 2    | 24   | —      | —     | —        |
| **Sprint 6: Dead Code + Polish + Docs**       | 55    | —    | 55   | —      | —     | —        |
| **Sprint 7: Full Codebase Audit**             | 50    | 30   | 18   | —      | —     | 2        |
| **Descoped**                                  | 7     | —    | —    | —      | —     | 7        |
| **Total**                                     | 311   | 156  | 102  | 6      | 18    | 12       |

**Last updated:** 2026-03-21

- Sprint 2.6 Wave 0 complete — full Base UI migration (WQ-080–086 done by Codex)
- Sprint 2.6 Waves 1-3 done (list-based), superseded by Sprint 2.7 SVG canvas
- Registry audit complete: 147 stations, geometry pipeline operational
- **Sprint 7 Phases 1-3 complete:** 30/50 audit items done (3 Crit, 12 High, 13 Med, 2 Low). 18 remain (Phase 4: Med/Low).
- Sprint 2.7 (WQ-400–WQ-406) in progress separately
