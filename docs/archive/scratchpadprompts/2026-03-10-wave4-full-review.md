# Wave 4 Phase 1 — Full Code Review

**Date:** 2026-03-10
**Branch:** `wave4/phase1-audit`
**Agents:** 7 parallel agents covering all changed files + strategic docs

> **Status as of 2026-03-15:** All criticals fixed. The 12 Active Sprint Tasks at the bottom of this document are ALL DONE as of 2026-03-10 to 2026-03-14. Food system Phases 1–4 are complete. Remaining deferred warnings (O(n²) backfill, `window.confirm`, SW conflict, etc.) are tracked in `memory/project_detail.md` and `docs/consolidated-report.md`.

---

## Headline Numbers

- **3 Critical** (block PR or cause data loss)
- **19 Warnings** (should fix on this branch)
- **22 Minors** (opportunistic / deferred)
- **Strategic docs**: Bayesian engine plan fully done; v3-strategy ~30% done

---

## Critical — Fix Before Committing — ALL DONE (2026-03-10)

| #   | File                              | Issue                                                                                                                                                                                                                     | Status |
| --- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| C1  | `useAppDataFormController.ts:106` | `JSON.parse(raw) as AppBackupPayload` — zero runtime validation. Malformed or malicious backup file goes straight to `importBackup`. Add top-level key checks + throw readable error.                                     | FIXED  |
| C2  | `foodEvidence.ts` + `domain.ts`   | `FoodAssessmentVerdict`, `FoodPrimaryStatus`, `FoodTendency`, `TransitCalibration` defined **independently** in both files. Silent divergence waiting to happen. Define once in `domain.ts`, import in `foodEvidence.ts`. | FIXED  |
| C3  | `useAiInsights.ts:298`            | `loadingRef.current = false` only set when `!signal.aborted`. Aborted request leaves ref permanently `true` → all future analysis silently blocked until page reload. Move reset to unconditional `finally`.              | FIXED  |

---

## Warnings — Should Fix This Branch

### Backend (Convex)

- `computeAggregates.ts` — `updateWeeklyDigestImpl` scans full log history on every trigger → O(n²) during backfill
- `logs.ts:1452` — `foodTrialSummary` backup import uses `as any`, no field validation → post-restore corruption possible
- `foodLibrary.ts` — `mergeDuplicates` has no input size limit + scans all user logs twice in one mutation

### AI Insights

- `useAiInsights.ts` — if `addAiAnalysis` throws inside `void Promise.resolve().then(...)`, `addAssistantMessage` never called → AI response lost from conversation silently
- `ConversationPanel.tsx` — query window frozen at `now + 60s` on mount. Messages logged >60s after mount may not appear in conversation
- `aiAnalysis.ts:fetchWeeklySummary` — no `try/catch` around API call; raw OpenAI SDK errors leak to callers
- `aiAnalysis.ts:1469` — `VALID_EXPERIMENT_STATUSES = new Set([...])` inside `parseAiInsight`, recreated potentially 500× on load. Move to module scope.
- `useScheduledInsights.ts` — `computeSameTimeBaseline` is O(n) log scan, runs inside `useMemo` on every log change

### Settings

- `AppDataForm.tsx` — `useSyncedLogs(5000)` always-live subscription fetching 5000 full log records just to show a count badge. Use a lightweight count query instead.
- `useAppDataFormController.ts` — `window.confirm` used for destructive actions (import/factory reset) in PWA → broken on iOS standalone. Use drawer pattern (same as delete).

### Core Store / Lib

- `SyncedLogsContext.tsx` — entire Bayesian evidence engine runs on every log change just to extract `.transitCalibration`, then discards all food summaries. Export a dedicated `learnTransitCalibration` function or lift full result into context.
- `foodEvidence.ts` — `buildFoodTrials` called twice in `buildFoodEvidenceResult` (redundant O(n) log scan)

### Food / Track

- `useFoodParsing.ts` — food parsing **blocks UI** for full OpenAI API round-trip (1–3s). Pending draft crash-recovery infrastructure already partially in place. Fire-and-forget approach feasible.
- `useFoodParsing.ts:113` — `addFoodLibraryEntries().catch(console.error)` swallows errors (violates project rules). Use `toast.error` or rethrow.
- `BowelSection.tsx` — `BRISTOL_SCALE.map(b => b.value)` recreated on every render and used as `useCallback` dependency → callback never stable. Move to module scope.
- `SmartViews.tsx` — `normalizeColumnFilters` called O(rows × views) times in `countRowsForView`. Normalize once before the reduce loop.
- `StationDetailPanel.tsx` + `columns.tsx` — `bristolAvgFromBreakdown` implemented independently in both. Should import shared `computeBristolAverage` from `foodStatusThresholds.ts`.

### New UI / Misc

- `routeTree.tsx:487` — `/transit-test` is **public and unauthenticated** in production. Move under `appLayoutRoute` or delete.
- `src/pages/Home.tsx` — dead code, not referenced by any route or import. Delete.
- `vite.config.ts` + `registerServiceWorker.ts` — `vite-plugin-pwa autoUpdate` + manual `registerSW({ immediate: true })` conflict → double SW registration risk. Remove manual wrapper.
- `package.json` — `vite` duplicated in both `dependencies` and `devDependencies`; 5 Linux ARM64 native build binaries in `dependencies` instead of `devDependencies`.

---

## Minor Issues (Opportunistic / Deferred)

- `computeAggregates.ts` — `getWeekStart` uses server UTC, not user timezone from `aiPreferences.locationTimezone`. Week boundaries wrong for non-UTC users.
- `computeAggregates.ts` — `Math.max()` with empty arrays → `-Infinity` stored as `recomputeAt` for new users with no logs.
- `extractInsightData.ts` — `verdictToStoredVerdict` return type includes `"culprit"` / `"next_to_try"` which can never actually be returned.
- `extractInsightData.ts` — N+1 pattern in `backfillAll`: 2 index queries per analysis record to check if already processed.
- `schema.ts` — no `by_userId_type` index on `logs` table. `listFoodLogs` and weekly digest filter by type in memory after full user scan.
- `schema.ts` — `foodTrialSummary` Bayesian fields (`primaryStatus`, `tendency`, `confidence`, etc.) declared `v.optional()` but always written. Weaker schema than actual invariants.
- `TrackingForm.tsx` — drag-and-drop uses HTML drag events only; doesn't work on touch devices (iOS/Android). Silent no-op on mobile.
- `HiddenHabitsSection.tsx` — `hiddenHabits` filter not memoised, inconsistent with parent convention.
- `pendingFoodDraft.ts` — uses `localStorage` while all other app data uses IndexedDB. Stale draft survives "Clear App Data".
- `FoodRow.tsx` — BRAT badge JSX duplicated between mobile/desktop branches.
- `columns.tsx` + `FoodRow.tsx` — transit hours formula (`Math.round(x / 6) / 10`) duplicated and opaque. Extract to `minutesToHoursDisplay()` utility.
- `AddHabitDrawer.tsx` — unit determination uses 7-line nested ternary. Use a `Record<HabitType, string>` lookup.
- `HabitDetailSheet.tsx` — 600+ line inner component, `detailSections` JSX assembled as `const` before return.
- `useTimePicker.ts` — `accentVar` option accepted in interface but silently ignored. Either implement or remove.
- `Space Grotesk` font referenced in `TransitMap.tsx`, `TransitMapTest.tsx`, `Home.tsx` but never loaded in `index.html`. Silent sans-serif fallback.
- `"use client"` Next.js directive in `sonner.tsx`, `date-picker.tsx` — no-op in Vite, misleads future maintainers.
- `aiAnalysis.ts` — `buildUserMessage` has 14 parameters. Should be grouped into an options object.
- `aiAnalysis.ts` — `REPORT_HISTORY_COUNT = 500` pulls 500 full Convex records for educational deduplication. Expensive for a dedup check.
- `main.tsx` — `timepicker-ui` CSS imported globally. Loads on every page including pages that never use the picker.
- `CopyReportButton` — `setTimeout` without `clearTimeout` cleanup in `useEffect`.
- `vite.config.ts` — `globPatterns` excludes `.png`, so PWA icon assets not precached. Icons may not render offline on first visit.
- `testFixtures.ts` — `TEST_AI_INSIGHT` carries inline type annotation duplicating `AiNutritionistInsight`. Import the type directly.

---

## Strategic Docs — Status

| Plan                                                                 | Status                                                                                                                       |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Bayesian engine wiring (2026-03-08)                                  | **100% complete** — all 5 tasks done                                                                                         |
| Layers 1–4 (conversations, food assessments, aggregates, AI context) | **Complete**                                                                                                                 |
| Patterns dashboard                                                   | **Complete**                                                                                                                 |
| Habit system overhaul                                                | **Complete**                                                                                                                 |
| E2E test rebuild                                                     | **Complete** (9 spec files)                                                                                                  |
| Log aggregation design                                               | **Complete**                                                                                                                 |
| v1 release lock migration checklist                                  | **Complete**                                                                                                                 |
| v3-strategy (Dr. Poo prompt upgrade)                                 | **~30%** — `clinicalReasoning` not added, markdown not enabled, meal plan still suppressed, Phase 2 prompt rules not applied |
| PRD-health-profile-and-presync-modal                                 | **Partial** — health profile done; pre-sync check-in modal not started                                                       |
| Transit calibration Settings UI                                      | **Not started** (engine works, no UI)                                                                                        |
| Food database pre-population                                         | **Not started**                                                                                                              |
| Prompt injection defense + CSP headers                               | **Not started**                                                                                                              |

### Top Strategic Gaps (in priority order)

1. Add `clinicalReasoning` field to `AiNutritionistInsight` (v3-strategy Phase 1A — highest impact, pure type + prompt + UI change)
2. Enable markdown rendering in AI narrative fields (`react-markdown` in `AiInsightsBody.tsx` / `DrPooReport.tsx`)
3. Rewrite anti-repetition and anti-nagging prompt rules (v3-strategy 1D, 2A, 2B — pure text changes)
4. Activate proactive meal guidance — change `mealPlan` default from empty array to 1–2 brief ideas
5. Transit calibration Settings UI — display learned transit window, allow manual override
6. Fluid preset lossy sync fix — store `FluidPreset[]` not `string[]` in Convex profile schema
7. Sync habit logs to Convex (currently local-only)
8. Pre-sync check-in modal (mood/cravings/body state before AI call)
9. Prompt injection defense on health profile fields + CSP headers in `vercel.json`
10. `React.memo` + `useShallow` performance pass

---

## What to Fix Now vs Defer

### Fix on this branch before PR

- ~~C1, C2, C3 (criticals)~~ — ALL FIXED (2026-03-10)
- `VALID_EXPERIMENT_STATUSES` → module scope (1 line)
- ~~`loadingRef.current` unconditional in `finally` (same as C3)~~ — FIXED with C3
- `bristolValues` → module scope in `BowelSection.tsx`
- `Home.tsx` — INVESTIGATE FIRST (may contain transit map UI)
- Gate `/transit-test` behind auth
- Fix `package.json` dependency placement

### Defer to separate PRs

- Food parsing async / fire-and-forget
- `useSyncedLogs(5000)` → lightweight count query
- Bayesian engine run-once in context
- v3-strategy prompt upgrades
- SW registration conflict cleanup
- All strategic gap items above

---

## Active Sprint Tasks — feature/v1-sprint

These 12 tasks were identified via browser testing and are the current work queue. They do **not** overlap with the review findings above — they are a separate set of feature fixes.

**Note:** Tasks 11 and 12 may be partially complete already — check git log before implementing.
Wave 4 Phase 1 review fixes (C1, C2, C3) were addressed in commits `dcce19c` and `0325e85` during the wave4/phase1-audit PR.

---

### Phase 1 — Data Integrity

#### Task 1: Fix AI Text Pollution (#91) — DONE

**Problem:** AI report prose (e.g. "Mun 23, February 1647, guacamole 2, TSP") is stored as food entries — ~160 fake entries alongside ~40 real ones.

**Root cause:** `convex/extractInsightData.ts` lines 82–98 inserts every food name from AI `foodAssessments` with zero validation. `src/lib/foodEvidence.ts` lines 545–549 unions ALL food names from logs AND assessments, so assessment-only entries appear as database rows.

**Fix — 3 layers:**

- **Layer 1** (`convex/extractInsightData.ts`): Before the `db.insert` at line 82, skip if:
  - `foodName.length > 60`
  - matches `/\b\d{4}\b/` or `/\b(january|february|...|december)\b/i`
  - matches `/bristol\s*\d/i`
  - contains 3+ commas
  - matches `/\d{2,}[a-z]/i`
  - Replace trivial `normalizeFood` with import of `normalizeFoodName` from `src/lib/foodNormalize.ts`
- **Layer 2** (`src/lib/foodEvidence.ts`): At line 551, filter out entries where `trials.length === 0` AND `assessments.length < 2`
- **Layer 3** (`convex/computeAggregates.ts`): Apply same food name validation for server-side aggregation

**Files:** `convex/extractInsightData.ts`, `src/lib/foodEvidence.ts`, `convex/computeAggregates.ts`

---

#### Task 2: Fix Bristol Classification (#92) — DONE

**Problem:** Foods classified "safe-loose" when they should be "safe". Example: Banana 20/26 safe trials but 6 loose = "safe-loose". Bristol 4–5 are medically safe (Rome III).

**Root cause:** `tendencyFromTrials` (line 450–456 of `foodEvidence.ts`) returns "loose" with NO percentage threshold — 6 loose out of 26 total triggers it.

**Fix:**

1. `tendencyFromTrials`: Add percentage threshold — only return "loose" if `looseCount / totalTrials >= 0.30`, only return "hard" if `hardCount / totalTrials >= 0.30`, otherwise return "neutral"
2. Verify `classifyConsistency` in `foodStatusThresholds.ts` (line 139–147) — `BRISTOL_LOOSE_LOWER = 5.5` is OK for average classification but confirm it's not driving primary status
3. Verify `primaryStatusFromSignals` — `posteriorSafety >= 0.65` → "safe" threshold looks correct

**Files:** `src/lib/foodEvidence.ts`, possibly `src/lib/foodStatusThresholds.ts`

---

#### Task 3: Fix Food Deduplication (#27) — DONE

**Problem:** 199 food entries when only ~40 real foods. Same food appears under different names ("Cottage Cheese", "Grams Of Cottage Cheese", "G Cottage Cheese").

**Fix:**

1. Enhance `normalizeFoodName` in `src/lib/foodNormalize.ts`:
   - Strip quantity prefixes: `/^\d+\s*(g|grams?|ml|oz|cups?|tbsp|tsp|...)\s*(of\s+)?/i`
   - Map synonyms: "plain white toast" → "white toast"
   - Strip trailing descriptors: "plain", "fresh", "organic"
2. Ensure ALL entry points (extractInsightData, useFoodParsing, foodEvidence) use the same `normalizeFoodName`
3. Consider a one-time migration/cleanup for existing `foodTrialSummary` and `foodLibrary` duplicates

**Files:** `src/lib/foodNormalize.ts`, any files using a local `normalizeFood` instead

---

#### Task 4: Fix Building Evidence Threshold (#87) — DONE

**Problem:** Foods with 21+ trials (mashed potato 21T, bread 14T, cottage cheese 11T) stuck in "building evidence" status. Recency decay (45-day half-life) makes older trials contribute < 1.5 threshold.

**Root cause:** `primaryStatusFromSignals` (line 462–464): `if (args.effectiveEvidence < BUILDING_EVIDENCE_THRESHOLD) return "building"`. With decay, the sum can fall below 1.5 even with many trials.

**Fix:**

1. Change the check: only return "building" if BOTH evidence score is low AND raw trial count < 5:
   ```
   if (args.effectiveEvidence < BUILDING_EVIDENCE_THRESHOLD && args.resolvedTrialCount < 5) return "building"
   ```
2. Add `resolvedTrialCount` parameter to `primaryStatusFromSignals`
3. Pass `trials.length` from caller at line 604

**Files:** `src/lib/foodEvidence.ts`

---

#### Task 5: Fix Food Trial Count Merging (#86) — DONE

**Problem:** "Fresh Baked Baguette" shows 22T when user never ate it 22 times. Bread variants being merged into single entries.

**Root cause:** `normalizeFoodName` too aggressive — collapsing "white bread", "baguette", "toast", "bread snacks" to the same canonical name.

**Fix:**

1. Review `src/lib/foodNormalize.ts` — find where bread variants are collapsed. Keep different preparations as separate foods:
   - White bread ≠ baguette ≠ toast ≠ bread snacks
   - Mashed potato = pureed potato (same)
   - Boiled chicken ≠ fried chicken (different digestion impact)
2. Only merge truly identical items (case/whitespace differences)

**Files:** `src/lib/foodNormalize.ts`, `src/lib/foodParsing.ts`, `convex/extractInsightData.ts`

---

#### Task 6: Fix Status Logic Thresholds (#28) — DONE

**Problem:** Classification too aggressive. 1 bad trial out of 2 = "watch" immediately. `posteriorSafety` gap between "avoid" (< 0.35) and "safe" (>= 0.65) is too wide.

**Fix:**

1. Narrow the safe threshold: `posteriorSafety >= 0.55` → "safe" (lowered from 0.65)
2. Check if `RISKY_BAD_COUNT` and `WATCH_BAD_COUNT` in `foodStatusThresholds.ts` are still referenced anywhere — if dead code, add comment noting they're legacy
3. Key principle: deterministic engine should max out at "watch" — only AI elevates to "avoid". "Avoid" is never permanent, never deterministic.

**Files:** `src/lib/foodEvidence.ts`, `src/lib/foodStatusThresholds.ts`

---

### Phase 2 — Track Page Fixes

#### Task 7: Fix Today Log Text Overflow (#82) — DONE

**Problem:** Expanding a food entry in Today Log pushes chevron/edit/delete buttons off the right edge of screen.

**Fix:**

1. In `src/components/track/today-log/rows/LogEntry.tsx` (817 lines), find the expanded item layout
2. Add `line-clamp-2` or text wrapping to food name text
3. Put action buttons (chevron, edit, delete) in a fixed-width container that doesn't flex with text

**Files:** `src/components/track/today-log/rows/LogEntry.tsx`

---

#### Task 8: Fix Date Header Duplication (#83) — DONE

**Problem:** Patterns page shows date in both global header and page header. Date should only appear once at page level.

**Fix:**

1. `src/routeTree.tsx` GlobalHeader (line 274): Remove `<span>{dateLabel}</span>` and the `now` state + 60s timer (lines 175–180) if only used for dateLabel. **This also eliminates the 60s full-tree re-render issue.**
2. `src/pages/Track.tsx`: Add date display above food section, format "EEEE, MMMM d", style subtle/text-sm
3. `src/pages/Settings.tsx`: Add similar date display at top

**Files:** `src/routeTree.tsx`, `src/pages/Track.tsx`, `src/pages/Settings.tsx`

---

#### Task 9: Batch Track Bug Fixes — DONE

Fix 5 small issues in one pass:

1. **#4 BM time layout** (`src/components/track/BowelSection.tsx`): Move time input BEFORE notes field. 8-col grid with time + notes on same row, accordion toggle below.
2. **#84 Hero label overlap** (`src/components/patterns/hero/`): Side text labels ("Bristol", "Count") superimposed over numbers. Add spacing/offset.
3. **#89 Dr Poo archive link duplicate** (`src/pages/Patterns.tsx`): Remove "Dr. Poo Archive" link — already accessible from Track page.
4. **#90 "Last tested" column** (`src/components/patterns/database/columns.tsx`): Rename column header from "Last tested" to "Last eaten".
5. **#62 Alert badge size** (search `src/components/track/`): Find destructive habit alert badge, change `h-6 w-6` to `h-5 w-5`.

**Files:** `BowelSection.tsx`, `src/components/patterns/hero/`, `src/pages/Patterns.tsx`, `columns.tsx`, track components

---

### Phase 3 — Broken Track Features

#### Task 10: Revert Fluids Section (#6)

**Problem:** Current fluid section has wrong preset-with-amount model. User wants original simple design.

**Required design:**

- Drink name input + ml input + "Add" button
- Three preset buttons below: 🥛 water, ☕ coffee, "Other"
- Clicking preset fills drink name; user enters ml manually
- No ml amounts on presets — just icon/name

**Files:** `src/components/track/FluidSection.tsx` (check git history for original: `git log --oneline src/components/track/FluidSection.tsx`)

---

#### Task 11: Fix Toast Notifications (#45)

**⚠️ Check first:** `git log --oneline | grep -i sonner` — commit `4e36117` may have partially done this.

**Required design:**

- Coloured backgrounds: red for errors, orange for warnings, green for success, blue for info
- Stack visibly (`visibleToasts: 5+`)
- Undo button obvious and prominent
- `richColors` enabled, position `top-center`, duration `4000ms`

**Files:** `src/components/ui/sonner.tsx`

---

#### Task 12: Fix Units Consistency (#49)

**⚠️ Check first:** `git log --oneline | grep -i unit` — commit `05741f9` may have partially done this.

**Problem:** When user sets imperial/fl oz in Settings, fluid displays still show ml throughout (stats bar, AI insights, today log, input placeholders).

**Fix:**

1. Find unit preference in `src/store.ts`
2. Audit: `FluidSection.tsx`, `today-log/` entries, `QuickCapture.tsx`, AI insights components, stats bar
3. Use/create `formatFluidAmount(ml: number, unit: 'ml' | 'floz'): string` utility (1 fl oz = 29.5735 ml)
4. Replace all hardcoded `"ml"` displays with formatted version

**Files:** `src/store.ts`, `src/components/track/FluidSection.tsx`, `src/components/track/today-log/`, `src/components/track/QuickCapture.tsx`

---

### Execution Order

```
Phase 1: Tasks 1+2 first (data integrity, most critical)
         Tasks 3+4+5+6 in parallel after 1+2
Phase 2: Tasks 7+8+9 in parallel (independent of Phase 1)
Phase 3: Tasks 10+11+12 in parallel (independent)
Phases 2+3 can run in parallel with each other.
```
