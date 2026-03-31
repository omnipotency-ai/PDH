# Caca Traca — Codebase Health Audit

## Consolidated Report

**Date:** 2026-03-16
**Agents:** A1–A10 (10 parallel domain + cross-cutting agents)
**Files reviewed:** ~250 source files across `convex/`, `shared/`, `src/`
**Model:** Claude Sonnet 4.6

---

## Executive Summary

The codebase is **functionally coherent and architecturally sound** — the food pipeline, evidence engine, and BYOK LLM architecture are well-designed. However, the audit found **serious accumulated technical debt** across five cross-cutting themes that must be addressed before a public launch.

| Theme                                                                                        | Severity | Most Critical File                                        |
| -------------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------- |
| **Type safety violations** — `as any`, double-casts, unsafe narrowing at data boundaries     | Critical | `convex/logs.ts`, `src/lib/sync.ts`                       |
| **Silent error swallowing** — 6+ catch blocks discard save errors with no user feedback      | High     | All 5 SubRow editors                                      |
| **Security gaps** — missing auth, health data in errors, prompt injection vectors            | Critical | `convex/foodLlmMatching.ts`, `src/lib/aiAnalysis.ts`      |
| **Test coverage holes** — LLM path, baseline averages, habit progress untested               | Critical | `src/lib/baselineAverages.ts`, `src/lib/habitProgress.ts` |
| **Accessibility** — 30+ findings including many interactive elements with no accessible name | High     | Track components, Settings, UI primitives                 |

**Totals across all agents:**

| Severity | Count |
| -------- | ----- |
| Critical | 33    |
| High     | ~85   |
| Medium   | ~95   |
| Low      | ~55   |

---

## Critical Issues

| #   | Agent | File                                                 | Line/Function                                                       | Description                                                                                                                                                                                                                                                                   | Suggested Fix                                                                                                                                         |
| --- | ----- | ---------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | A8    | `.env.local`                                         | All lines                                                           | **Live credentials on disk.** `CLERK_SECRET_KEY`, `CONVEX_DEPLOYMENT`, `VERCEL_OIDC_TOKEN` exist in `.env.local`. File is git-ignored but was restored after accidental overwrite. Any future commit could expose them.                                                       | Rotate all three credentials immediately. Run `git log --all -- .env.local` to confirm no historical commit. Install `gitleaks` as a pre-commit hook. |
| C2  | A8    | `convex/foodLlmMatching.ts`                          | Line 383–399, `matchUnresolvedItems`                                | **Public action with no auth check.** `matchUnresolvedItems` accepts an OpenAI `apiKey` as an argument with `requireAuth` never called. Any unauthenticated caller can relay arbitrary prompts to OpenAI using a user-supplied key.                                           | Add `await requireAuth(ctx)` as the first line. Currently the handler returns early (stub), but this must be fixed before the stub is implemented.    |
| C3  | A1    | `convex/logs.ts`                                     | Line 1498, `importBackup`                                           | **`v.any()` in public mutation args.** `payload: v.any()` accepts completely unvalidated input from any authenticated user.                                                                                                                                                   | Replace with a strict typed validator matching the `BackupPayload` structure. The normalization layer can remain for shape tolerance.                 |
| C4  | A1    | `convex/logs.ts`                                     | Lines 1533–1829, `importBackup`                                     | **13+ `as any` casts in DB inserts.** All restored table rows for `logs`, `aiAnalyses`, `profiles`, `weeklyDigest`, `weeklySummaries`, `ingredientProfiles`, `foodTrialSummary` are inserted with `as any`, bypassing schema validation entirely.                             | Derive narrow types from schema validators using `Infer<>` and construct properly-typed insert payloads.                                              |
| C5  | A4    | `src/lib/sync.ts`                                    | Line 73, `toSyncedLogs`                                             | **`as unknown as SyncedLog[]` double-cast** at the primary Convex→client data boundary. Any shape mismatch between Convex's flat union return and the discriminated `SyncedLog` type is silently swallowed.                                                                   | Define a validated mapping function that explicitly narrows each `type` discriminant to its `data` shape.                                             |
| C6  | A4    | `src/lib/sync.ts`                                    | Lines 50–51, `sanitizeLogData`                                      | **`as unknown as ConvexLogData`** at sanitization boundary. Sanitized object bypasses type checking before being sent to Convex.                                                                                                                                              | Accept `LogPayloadData` and return the same type, or document the exact structural delta and use a typed mapping.                                     |
| C7  | A4    | `src/lib/habitTemplates.ts`                          | Line 590, `validateHabitConfig`                                     | **`dailyCap > 0` silently deletes zero-cap habits.** A cap of `0` (zero-tolerance medical constraint, e.g. "no alcohol") is treated as "no cap." `isCapHabit` checks `dailyCap !== undefined` — a zero-cap habit gets no cap enforcement.                                     | Change to `habit.dailyCap >= 0`. This is a patient-safety issue.                                                                                      |
| C8  | A3    | `src/lib/aiAnalysis.ts`                              | `fetchAiInsights`, ~line 1800                                       | **Raw AI response content in error message** — `rawContent.slice(0, 200)` included in the thrown `Error.message`. If the model parrots health profile fields or patient messages in a malformed response, 200 chars of that data land in error-tracking systems unredacted.   | Replace with static: `"AI nutritionist returned invalid JSON."`                                                                                       |
| C9  | A3    | `src/lib/aiAnalysis.ts`                              | `fetchWeeklySummary`, ~line 1933                                    | **Same raw-response exposure** in the weekly summary error path. Conversation history (patient messages, log notes) could be exposed.                                                                                                                                         | Same fix as C8.                                                                                                                                       |
| C10 | A2    | `shared/foodEvidence.ts`                             | L190, L201, L204, L216, L244, L290, L336                            | **Multiple `as` casts on `unknown` log.data.** `log.data` is typed `unknown` but cast to `Record<string, unknown>` without structural validation. `Number()` conversions on malformed data return `NaN`, producing incorrect digestion statistics and safety classifications. | Define a `DigestiveEventData` / `FoodLogItemData` interface; add `typeof data === 'object' && data !== null` guard before narrowing.                  |
| C11 | A5    | `src/components/track/FoodMatchingModal.tsx`         | Line 228                                                            | **`currentItemIndex != null` is truthy when index is `0`** — queue mode silently skips the first item.                                                                                                                                                                        | Change to `currentItemIndex !== undefined`.                                                                                                           |
| C12 | A6    | `src/components/settings/repro/PregnancySection.tsx` | Lines 189, 196                                                      | **Postpartum medication notes overwrite pregnancy medication notes.** Postpartum notes section is bound to `reproductiveHealth.pregnancyMedicationNotes` — the same field as the pregnant section (line 147). This is a data corruption bug.                                  | Use a dedicated postpartum field.                                                                                                                     |
| C13 | A7    | `src/routeTree.tsx` / router config                  | `appLayoutRoute`, `beforeLoad`                                      | **No `beforeLoad` auth guard on `appLayoutRoute`.** TanStack Router never redirects unauthenticated users accessing deep links — they land on the app layout and see no content, or see a broken state.                                                                       | Add `beforeLoad: async ({ context }) => { if (!context.auth.isSignedIn) throw redirect({ to: '/sign-in' }) }` to the app layout route.                |
| C14 | A7    | `src/store.ts`                                       | `useStore.getState()` inside `useCallback`                          | **`useStore.getState()` inside `useCallback` bypasses React subscription model** for `paneSummaryCache`. The hook captures a snapshot at definition time; stale cache values are returned indefinitely.                                                                       | Replace with a `useStore(s => s.paneSummaryCache)` selector.                                                                                          |
| C15 | A7    | `src/pages/Patterns.tsx` (or relevant page)          | `insight: a.insight as AiNutritionistInsight`                       | **Unsafe cast of AI insight** instead of using the existing `parseAiInsight` validator. Malformed AI output silently passes type checking.                                                                                                                                    | Call `parseAiInsight(a.insight)` and handle the failure case.                                                                                         |
| C16 | A9    | `shared/__tests__/`, `convex/__tests__/`             | LLM food resolution path                                            | **Zero tests for the LLM food matching path.** The entire `foodLlmCanonicalization` → `matchUnresolvedItems` → `applyLlmResults` pipeline is untested. This is the highest-value pipeline in the app.                                                                         | Write integration tests covering the happy path, JSON parse failure, and rate-limit rejection.                                                        |
| C17 | A9    | Test suite                                           | `it.fails("rejects re-matching expired items")`                     | **`it.fails` documents a known production bug** — expired items re-matching is broken and this fact is committed as a baseline.                                                                                                                                               | Fix the bug; replace `it.fails` with a real passing assertion.                                                                                        |
| C18 | A9    | No test file exists                                  | `src/lib/baselineAverages.ts`, `computeBaselineAverages` (260+ LOC) | **Zero tests on the primary baseline statistics function.** Contains the zero-cap bug (C7), the Spanish alias hardcode (M), and the non-null assertion (H). All undetected.                                                                                                   | Write unit tests covering multi-habit, zero-cap, and empty-data scenarios.                                                                            |
| C19 | A9    | No test file exists                                  | `src/lib/habitProgress.ts`                                          | **Zero tests on habit progress computation.** Core habit coaching and progress display logic entirely untested.                                                                                                                                                               | Write unit tests.                                                                                                                                     |
| C20 | A9    | No test file exists                                  | `src/lib/derivedHabitLogs.ts`                                       | **Zero tests on `rebuildHabitLogsFromSyncedLogs`.** The function contains an unsafe `as HabitType` cast (A4/H7) and an O(n log n) sort on every call. Both issues are undetected.                                                                                             | Write unit tests.                                                                                                                                     |
| C21 | A10   | `src/contexts/SyncedLogsContext.tsx`                 | `useAllSyncedLogs` / `SyncedLogsProvider`                           | **Unbounded `listAll` query subscribed reactively.** `api.logs.listAll` does `.collect()` on ALL logs for a user with no limit — delivered in real-time on every mutation. Payload grows indefinitely as users log more data.                                                 | Paginate or enforce a hard limit; the main Track page only needs recent logs.                                                                         |
| C22 | A10   | `convex/logs.ts`                                     | Line 763–775, `count` query                                         | **Full table scan to count rows.** `.collect()` entire log table just to return `rows.length` — this is a reactive Convex query that re-runs on every mutation.                                                                                                               | Use `.paginate()` with limit 1, a counter document, or remove UI subscribers that use this for display.                                               |

---

## High Priority

### Type Safety

| #   | Agent | File                            | Issue                                                                                | Fix                                                     |
| --- | ----- | ------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| H1  | A1    | `convex/logs.ts` L1320, 1430    | `ctx.db as any` in `listRowsByUserId` and `deleteAllUserData`                        | Use per-table explicit query calls                      |
| H2  | A1    | `convex/logs.ts` L470           | `cleanedData as any` passed to `ctx.db.patch`                                        | Type `cleanedData` using Convex `data` field type       |
| H3  | A1    | `convex/foodParsing.ts` L229    | `items as unknown as ProcessedFoodItem[]` — only 4 fields checked before cast        | Check all optional fields in the guard                  |
| H4  | A1    | `convex/logs.ts` L1460          | `ctx as unknown as MutationCtx` inside a `query` handler                             | Extract query logic into a `QueryCtx`-compatible helper |
| H5  | A3    | `aiAnalysis.ts` L1642–1658      | Four `as LogEntry[]`/`as HealthProfile` casts on `sanitizeUnknownStringsDeep` return | Remove redundant casts; the generic preserves the type  |
| H6  | A4    | `sync.ts` L28                   | `return id as Id<T>` with no non-empty string guard                                  | Guard `id.length > 0` before the cast                   |
| H7  | A4    | `derivedHabitLogs.ts` L97       | `log.data.habitType as HabitConfig["habitType"]` on unvalidated string               | Use `isHabitType()` guard before casting                |
| H8  | A4    | `digestiveCorrelations.ts` L432 | `dateStr.split("-").map(Number)` with no NaN validation                              | Use `parseISO` from date-fns or validate format         |
| H9  | A4    | `analysis.ts` L206              | `bristolToConsistency(0)` returns `"constipated"` instead of `null`/error            | Add guard `if (code < 1 \|\| code > 7) return null`     |
| H10 | A2    | `foodEvidence.ts` L452          | Non-null assertion `values[Math.floor(values.length * 0.75)]!`                       | Use `Math.min(idx, values.length - 1)` bounds check     |

### Security (High)

| #   | Agent | File                                                               | Issue                                                                                                 | Fix                                                            |
| --- | ----- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| H11 | A8    | `convex/stripe.ts` L6–56                                           | `successUrl`/`cancelUrl` user-controlled, forwarded to Stripe without validation                      | Validate URLs match app domain server-side                     |
| H12 | A8    | `convex/foodRequests.ts` L22–33                                    | No input sanitization on `foodName`, `rawInput`, `note` — unlike every other mutation                 | Apply `sanitizeRequiredText`/`sanitizeOptionalText`            |
| H13 | A8    | `src/lib/aiAnalysis.ts` L848–851                                   | `prefs.preferredName` interpolated into LLM system prompt without injection delimiters                | Wrap in `<patient_name>...</patient_name>` XML tags            |
| H14 | A8    | `convex/extractInsightData.ts` L266–373                            | AI-generated `insight.suggestions` stored with only `.trim()`, no length cap                          | Apply `sanitizePlainText` + `assertMaxLength`                  |
| H15 | A3    | `foodParsing.ts`                                                   | `existingNames` array injected unsanitized into food parse LLM prompt                                 | Sanitize names before building the user message                |
| H16 | A3    | `aiAnalysis.ts`                                                    | `WeeklySummaryInput` not sanitized before LLM, unlike `fetchAiInsights`                               | Apply `sanitizeUnknownStringsDeep` to the weekly summary input |
| H17 | A8    | `src/components/archive/DrPooReport.tsx` + `ConversationPanel.tsx` | AI-generated markdown rendered with `react-markdown` — no `urlTransform` blocking `javascript:` links | Add `urlTransform` prop or `disallowedElements={['a']}`        |

### Silent Error Swallowing

| #   | Agent | File                                       | Issue                                                             | Fix                        |
| --- | ----- | ------------------------------------------ | ----------------------------------------------------------------- | -------------------------- |
| H18 | A5    | `today-log/rows/LogEntry.tsx` L238         | `catch { /* Keep editor open */ }` — save errors silently dropped | Show toast on error        |
| H19 | A5    | `today-log/editors/ActivitySubRow.tsx` L66 | Same pattern                                                      | Show toast                 |
| H20 | A5    | `today-log/editors/FluidSubRow.tsx` L83    | Same pattern                                                      | Show toast                 |
| H21 | A5    | `today-log/editors/HabitSubRow.tsx`        | Same pattern                                                      | Show toast                 |
| H22 | A5    | `today-log/editors/ReproductiveSubRow.tsx` | Same pattern                                                      | Show toast                 |
| H23 | A5    | `today-log/editors/WeightSubRow.tsx`       | Same pattern                                                      | Show toast                 |
| H24 | A4    | `sounds.ts` L50                            | `ctx.resume().catch(() => {})` silently swallows audio resume     | Add `debugWarn` logging    |
| H25 | A4    | `habitCoaching.ts` L569                    | `raw.slice(0, 200)` in error message (health data exposure)       | Replace with static string |

### Correctness (High)

| #   | Agent | File                                   | Issue                                                                                                     | Fix                                         |
| --- | ----- | -------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| H26 | A6    | `transit-map/StationMarker.tsx` L67–68 | Pulse animation `transformOrigin` set on already-translated `<g>` — animation orbits wrong SVG point      | Use `0px 0px` for child transforms          |
| H27 | A6    | `transit-map/TransitMap.tsx` L400–402  | Non-null assertions `zones[0]!`, `[1]!`, `[2]!` — throws if sub-line has < 3 zones                        | Add bounds check                            |
| H28 | A6    | `repro/MenopauseSection.tsx` L81–82    | `onChange` sets both `menopauseHrtNotes` and `hormonalMedicationNotes` to same value — fragile dual-write | Remove coupling                             |
| H29 | A6    | `ui/Confetti.tsx` L118                 | `randomBetween(-180, 180)` in `animate` prop generates new values on every re-render of each particle     | Pre-compute in `createParticles`            |
| H30 | A5    | `quick-capture/HabitDetailSheet.tsx`   | `setSleepGoal` (Zustand) + `updateHabit` (Convex) with no rollback on Convex failure                      | Rollback Zustand state on mutation failure  |
| H31 | A7    | `src/pages/Patterns.tsx`               | `window.prompt()` used for UI interaction                                                                 | Replace with a proper modal/input component |

### Accessibility (High)

| #   | Agent | Component                                       | Issue                                              | Fix                                                           |
| --- | ----- | ----------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------- |
| H32 | A6    | `database/DatabaseTable.tsx`                    | Sortable column header buttons have no `aria-sort` | Add `aria-sort`                                               |
| H33 | A6    | `hero/Sparkline.tsx`                            | No `aria-label` or accessible description on chart | Add `aria-label`                                              |
| H34 | A6    | `tracking-form/CelebrationsSection.tsx`         | Switch has no linked `<Label>`                     | Add `htmlFor`/`id` pairing                                    |
| H35 | A6    | `tracking-form/QuickCaptureDefaultsSection.tsx` | Input has no `<Label>`, only `placeholder`         | Add `<Label>`                                                 |
| H36 | A5    | `dr-poo/ReplyInput.tsx`                         | Text input has no `<label>`                        | Add `aria-label`                                              |
| H37 | A5    | `BristolScale.tsx`                              | Bristol type buttons have no `aria-label`          | Add `aria-label="Type N — description"`                       |
| H38 | A5    | `quick-capture/QuickCaptureTile.tsx`            | Progress ring has no `role="progressbar"`          | Add `role`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax` |

### Base UI Migration Incomplete (High)

The migration from Radix UI to Base UI is ~60% complete. The following components have broken state styling:

| Component                          | File                                                   | Problem                                               |
| ---------------------------------- | ------------------------------------------------------ | ----------------------------------------------------- |
| `Switch`                           | `ui/switch.tsx`                                        | `data-[state=checked]` — active styling broken        |
| `Tabs`                             | `ui/tabs.tsx`                                          | `data-[state=active]` — active tab styling broken     |
| `ToggleGroup`                      | `ui/toggle-group.tsx`                                  | `data-[state=on]` — toggle state broken               |
| `Accordion`                        | `ui/accordion.tsx`                                     | Mixed: Radix primitive + Base UI selectors            |
| `ReproductiveHealthSection Switch` | `settings/app-data-form/ReproductiveHealthSection.tsx` | Radix selectors on Base UI component                  |
| `UnitsSection ToggleGroup`         | `settings/app-data-form/UnitsSection.tsx`              | Confirmed TODO: `data-[state=on]` not firing          |
| `DeleteConfirmDrawer`              | `settings/DeleteConfirmDrawer.tsx`                     | `data-[state=open/closed]` — overlay animation broken |

### Performance (High)

| #   | Agent | File                               | Issue                                                                                                                | Fix                                                               |
| --- | ----- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| H39 | A10   | `convex/logs.ts` L808              | `listFoodLogs` full `.collect()` then JS filter for food type                                                        | Add `by_userId_type` index                                        |
| H40 | A10   | `src/routeTree.tsx` L33            | `TrackPage` imported eagerly — all other pages are `lazy()`                                                          | Wrap in `lazy()` + `Suspense`                                     |
| H41 | A10   | `src/hooks/useAiInsights.ts` L40   | `REPORT_HISTORY_COUNT = 500` — 500 large AI analysis records fetched reactively on Track page load                   | Reduce to 10–20 for UI; paginate on demand                        |
| H42 | A1    | `convex/computeAggregates.ts` L497 | N+1 full `.collect()` for "prior foods" on every `updateWeeklyDigest` call                                           | Scope query with a time window                                    |
| H43 | A1    | `convex/aiAnalyses.ts` L125        | `.take(100)` in-memory filter — if all 100 are errors, `latestSuccessful` returns null even if older successes exist | Use DB index filter or increase window with documented limitation |

---

## Medium Priority

**Top medium-priority issues by category:**

### Hardcoded Personalization (CLAUDE.md violation)

- `src/lib/habitCoaching.ts` L63–74, L258–262, L541 — `"post-surgery anastomosis recovery patient"` hardcoded in 3 system prompts. Violates the **No Hard-Coding Personalization** rule. Parameterize from health profile.
- `src/lib/baselineAverages.ts` L220 — hardcoded Spanish alias `"agua"` in computation layer.
- `shared/foodEvidence.ts` L283–354 — habit modifier keyword matching uses hardcoded `"tina"` and `"rec drug"`.

### Work-Ticket Markers in Production Code

The following comment codes have no place in production source files:

- `// F001:`, `// F002:`, `// F003:`, `// F004:`, `// AB3:`, `// AA1:`, `// Z1:`, `// Z2:` in `WeightEntryDrawer.tsx`
- `// SET-F003:` through `// SET-F006:` in `AppDataForm.tsx`, `useAppDataFormController.ts`, `DemographicsSection.tsx`
- `// Bug #46`, `// Bug #47` in `PersonalisationForm.tsx`
- `// SET-F006:` in `AiSuggestionsCard.tsx`
- `// TODO(review): the matcher currently projects from the legacy shared transit-map registry...` in `foodMatching.ts` L282–286

### Data Correctness

- `shared/foodRegistry.ts` — `gelatin dessert` classified as `group: "carbs", line: "grains"`. Gelatin is a protein-derived collagen product with essentially zero carbohydrate. Reassign to `"protein"` or document the deliberate choice.
- `shared/foodRegistry.ts` — `"lactose free spreadable cheese"` appears twice in the `cream_cheese` examples array.
- `shared/foodNormalize.ts` L171 — `["pureed potato", "pureed potato"]` reflexive self-mapping in `SYNONYM_MAP`.
- `src/lib/digestiveCorrelations.ts` — best/worst days can overlap when ≤4 total days.

### Performance

- `src/lib/baselineAverages.ts` — `habitLogs.filter(l => l.habitId === habit.id)` inside `for...of habits` loop — O(habits × habitLogs). Pre-build a `Map<habitId, HabitLog[]>`.
- `src/lib/digestiveCorrelations.ts` — `habits.find(h => h.id === id)` called per (day, habitId) pair. Pre-build a `Map<string, HabitConfig>`.
- `convex/migrations.ts` — `backfillConversations` and `backfillDigestionLogFields` are public mutations (any authenticated user can trigger large-scale DB writes). Convert to `internalMutation`.
- `shared/foodMatching.ts` L487–491 — Creates a new `Fuse` instance on every `searchFoodDocuments` call when `bucketKey` filter is active. Cache bucket-filtered Fuse instances on the context.

### Duplication

- `shared/foodCanonicalName.ts` and `shared/foodProjection.ts` both export identical `resolveCanonicalFoodName`/`normalizeCanonicalName` — plus 3 Convex files with private copies. A1 total of 5 copies of the same function. Consolidate to `shared/foodCanonicalName.ts`.
- `quick-capture/DurationEntryPopover.tsx` and `QuickCaptureTile.tsx` — `TINT_BY_PROGRESS_COLOR` and `TINT_CLASSES` are exact duplicates.
- `hero/BmFrequencyTile.tsx` and `hero/BristolTrendTile.tsx` — identical `getDateKey` function.
- Settings directory — identical inline `<select>` class string repeated in 5 components. Extract to a shared `HealthSelect` component.
- `shared/foodMatching.ts` and `shared/foodNormalize.ts` — `MEASURE_UNIT_PATTERN` regex duplicated.

### Regulatory / Clinical Comment Quality

Multiple Zone-change notes (`"Zone changed from 2 to 3 (roasted in fat)."`) explain what changed not why the current zone is correct. Replace with clinical rationale per CLAUDE.md.

---

## Low Priority

The low-priority findings are extensive. Key patterns:

- **`"use client"` directives** in `ui/date-picker.tsx`, `ui/tabs.tsx`, `ui/toggle.tsx` — Next.js artefact, does nothing in Vite.
- **`key?` in props interfaces** across all 5 SubRow editor components — React never passes `key` as a prop; remove.
- **`streaks.ts` misleading filename** — contains no streak logic, only `GamificationState` type definitions. Rename to `gamificationDefaults.ts`.
- **`foodTypes.ts`** — 29 lines re-exporting 6 types from `foodEvidence.ts`. Verify consumers and consolidate.
- **Stale comments** — `// normalizeFoodName and formatFoodDisplayName are imported from @/lib/foodNormalize` in `foodEvidence.ts` L180 has the wrong path.
- **`transitMapV2: true` feature flag** — always true, gate is dead. Remove.
- **Registry "New entry." placeholder notes** — describes nothing. Replace with clinical rationale.
- **Developer planning notes visible in production UI** — `TransitMapInspector.tsx` and `TransitMap.tsx` render developer rationale strings as user-visible text.

---

## Dead Code Report

| File                                                  | Export/Function                        | Status               | Notes                                                                                          |
| ----------------------------------------------------- | -------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------- |
| `convex/foodParsing.ts`                               | `applyLlmResults`                      | Dead — always throws | Body is `throw new Error("Not implemented")`. Any caller would silently fail.                  |
| `convex/foodParsing.ts`                               | `matchUnresolvedItems` (body)          | Unreachable          | Returns early immediately. Dead logic block follows.                                           |
| `shared/foodProjection.ts`                            | `resolveCanonicalFoodName`             | Duplicate            | Identical to `shared/foodCanonicalName.ts:normalizeCanonicalName`. One must be deleted.        |
| `shared/foodCanonicalName.ts`                         | `normalizeCanonicalName`               | Partially dead       | Used in 2 Convex files but copy-pasted as private helper in 3 others.                          |
| `src/lib/aiRateLimiter.ts`                            | `checkRateLimit` body                  | Unreachable          | `MIN_CALL_INTERVAL_MS = 0` makes the entire function body a no-op. Always returns immediately. |
| `src/lib/aiRateLimiter.ts`                            | `resetRateLimit`                       | Dead export          | Resets `lastCallTimestamp` which is never meaningfully read while `MIN_CALL_INTERVAL_MS <= 0`. |
| `src/lib/featureFlags.ts`                             | `transitMapV2: true`                   | Dead gate            | Flag is always true; the `if (transitMapV2)` branch is always taken.                           |
| `src/lib/streaks.ts`                                  | Entire file                            | Misleadingly named   | Contains no streak logic. Only type/constant definitions. Rename.                              |
| `shared/foodEvidence.ts`                              | `toLegacyFoodStatus`                   | Potentially dead     | Exported but not tested. Verify client consumers.                                              |
| `src/components/patterns/database/foodSafetyUtils.ts` | `FILTER_OPTIONS`, `SortKey`, `SortDir` | Likely dead          | TanStack Table uses its own filter/sort types.                                                 |
| `src/components/patterns/database/columns.tsx`        | `export const columns`                 | Stale export         | Static snapshot created at module load. Consumers using this get stale definitions.            |
| `shared/foodNormalize.ts`                             | `prefersSummaryCandidate`              | Untested             | Exported but no tests anywhere.                                                                |
| `shared/foodMatching.ts`                              | `isStructurallyAmbiguousPhrase`        | Untested             | Exported but no tests.                                                                         |
| All 5 SubRow editors                                  | `key?: string \| number` in props      | Dead prop            | React never passes `key` as a prop.                                                            |

---

## Large File Decomposition Recommendations

Files significantly exceeding the 300-line guidance:

| File                                                       | Lines | Priority | Decomposition Plan                                                                                                                      |
| ---------------------------------------------------------- | ----- | -------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `shared/foodRegistry.ts`                                   | 4,057 | MEDIUM   | Split into `foodRegistryData.ts` (raw entries) + `foodRegistryUtils.ts` (lookup functions).                                             |
| `src/lib/aiAnalysis.ts`                                    | 1,953 | MEDIUM   | Split into `aiPrompts.ts`, `aiParsing.ts`, `aiFetchInsights.ts`. All AI code is lazy-loaded so bundle impact is low.                    |
| `convex/logs.ts`                                           | 2,017 | LOW      | Split into `logs/crudLogs.ts`, `logs/adminLogs.ts`, `logs/migrationLogs.ts`. Server-only; no client bundle impact.                      |
| `convex/foodParsing.ts`                                    | 1,227 | LOW      | Split pipeline stages: `foodPipelineProcess.ts`, `foodPipelineSearch.ts`.                                                               |
| `convex/migrations.ts`                                     | 1,359 | LOW      | Archive completed migrations into `convex/migrations/archive/`.                                                                         |
| `src/data/transitData.ts`                                  | 2,112 | LOW      | Already within lazy Patterns chunk. Confirm it doesn't leak to root chunk.                                                              |
| `src/components/settings/tracking-form/DrPooSection.tsx`   | 994   | HIGH     | Extract `PRESET_CARDS`, `ADVANCED_PREVIEW_MATRIX` static data into `drPooPreviewData.ts`; extract `SliderControl`, `LengthTabBar`, etc. |
| `src/components/track/quick-capture/WeightEntryDrawer.tsx` | 906   | HIGH     | Extract `WeightTrendChart` into `WeightChart.tsx` and unit conversion into `weightDrawerUtils.ts`.                                      |
| `src/components/track/today-log/rows/LogEntry.tsx`         | 832   | HIGH     | Delegate each log-type editing section to its SubRow component (the SubRows already exist).                                             |
| `src/lib/sync.ts`                                          | 530   | MEDIUM   | Split into `syncLogs.ts`, `syncFood.ts`, `syncAi.ts`, `syncIngredients.ts`.                                                             |
| `shared/foodEvidence.ts`                                   | 965   | LOW      | Split into `foodEvidenceCore.ts` (scoring) and `foodEvidenceFormatters.ts` (display).                                                   |

---

## Test Coverage Gaps

| Function / Module                                                               | Agent  | Has Tests         | Risk                                                          |
| ------------------------------------------------------------------------------- | ------ | ----------------- | ------------------------------------------------------------- |
| LLM food matching pipeline (`foodLlmCanonicalization` → `matchUnresolvedItems`) | A9     | **No**            | **CRITICAL** — most valuable pipeline, zero coverage          |
| `computeBaselineAverages` (260+ LOC)                                            | A9, A4 | **No**            | **CRITICAL** — contains zero-cap bug, Spanish alias hardcode  |
| `src/lib/habitProgress.ts`                                                      | A9     | **No**            | **CRITICAL** — core habit coaching logic untested             |
| `src/lib/derivedHabitLogs.ts`                                                   | A9     | **No**            | **CRITICAL** — contains unsafe cast; O(n log n) undetected    |
| `analysis.ts:bristolToConsistency`                                              | A4     | **No**            | HIGH — boundary value bug (code=0 → "constipated") undetected |
| `analysis.ts:normalizeDigestiveCategory`                                        | A4     | **No**            | HIGH — used in correlation calculations                       |
| `sync.ts:toSyncedLogs` / `sanitizeLogData`                                      | A4     | **No**            | HIGH — unsafe casts at API boundary                           |
| `habitTemplates.ts:validateHabitConfig`                                         | A4     | **No**            | HIGH — zero-cap bug entirely untested                         |
| `migrateLegacyStorage.ts`                                                       | A4     | **No**            | HIGH — one-time migration; failure silently drops user data   |
| `digestiveCorrelations.ts:computeCorrelations`                                  | A4     | Partial (3 cases) | MEDIUM — best/worst overlap edge case untested                |
| `reproductiveHealth.ts:calculateGestationalAgeFromDueDate`                      | A4     | **No**            | MEDIUM — medical calculation                                  |
| `shared/foodMatching.ts:mergeFoodMatchCandidates`                               | A2     | **No**            | MEDIUM — embedding candidate merging untested                 |
| `shared/foodEvidence.ts:normalizeAssessmentRecord`                              | A2     | **No**            | MEDIUM — exported but untested                                |
| `shared/foodEvidence.ts:toLegacyFoodStatus`                                     | A2     | **No**            | LOW — verify if still consumed                                |
| All E2E tests for food pipeline branches                                        | A9     | Partial           | HIGH — critical pipeline branches have no E2E coverage        |
| `e2e/destructive-habits.spec.ts` (4 tests)                                      | A9     | Skipped           | HIGH — all 4 skipped with no setup path                       |

---

## Security Findings

### Critical

1. **Live credentials in `.env.local`** (A8/C1) — Rotate immediately: `CLERK_SECRET_KEY`, `CONVEX_DEPLOYMENT`, `VERCEL_OIDC_TOKEN`.
2. **`matchUnresolvedItems` has no auth check** (A8/C2, C2 above) — Unauthenticated caller can proxy arbitrary prompts to OpenAI.
3. **Health data in error messages** (A3/C1, C2; A4/H5) — `rawContent.slice(0, 200)` in 3 thrown errors leaks patient data to error tracking.

### High

1. **Prompt injection via `prefs.preferredName`** (A8/H4) — User-controlled string interpolated directly into LLM system prompt without delimiter protection.
2. **`existingNames` unsanitized in food parse prompt** (A3 Prompt Quality #1) — Food library entry names injected into LLM user message without sanitization.
3. **`WeeklySummaryInput` unsanitized** (A3 Prompt Quality #3) — No `sanitizeUnknownStringsDeep` call unlike `fetchAiInsights`.
4. **AI markdown rendered without link sanitization** (A8/H3) — `react-markdown` renders AI output with no `urlTransform` blocking `javascript:` links.
5. **`successUrl`/`cancelUrl` not validated server-side** (A8/H1, A1/H1) — User-controlled URLs forwarded directly to Stripe.
6. **`foodRequests.submitRequest` has no input sanitization** (A8/H2, A1/M1) — Unlike all other mutations.

### Medium

1. **`backfillConversations` / `backfillDigestionLogFields` are public mutations** (A8/M2, M3) — Authenticated users can trigger large-scale DB writes repeatedly. Convert to `internalMutation`.
2. **Historical prompt injection payloads in conversation history** (A8/M4) — Stored messages re-sent to LLM without re-sanitization.
3. **AI-generated suggestion strings stored with only `.trim()`** (A8/H5) — No length cap or control character stripping on LLM output before DB insert.

### Authentication Coverage

All Convex endpoints except `matchUnresolvedItems` (public action, no auth) and the intentionally public `waitlist.join`/`waitlist.unsubscribe` have auth checks. The TanStack Router `appLayoutRoute` missing `beforeLoad` guard (C13) means deep-link navigation for unauthenticated users fails gracefully at the UI but is not enforced at the routing layer.

---

## Recommended Remediation Order

### Immediate (before next user-visible release)

1. **Rotate credentials** (C1) — `.env.local` live keys
2. **Add auth to `matchUnresolvedItems`** (C2)
3. **Fix health data in error messages** (C8, C9, H25) — 3 files
4. **Fix `dailyCap === 0` discarding zero-tolerance habits** (C7) — patient safety
5. **Fix `currentItemIndex != null` queue bug** (C11) — silent skipping of first food item

### Sprint 1 (type safety + data correctness)

1. Replace `v.any()` in `importBackup` with typed validator (C3)
2. Replace all `as any` casts in `importBackup` DB inserts (C4)
3. Fix `as unknown as SyncedLog[]` in `sync.ts` (C5)
4. Fix postpartum notes overwriting pregnancy notes (C12) — data corruption
5. Add `beforeLoad` auth guard to `appLayoutRoute` (C13)
6. Fix `gelatin dessert` food classification (Medium)

### Sprint 2 (test coverage)

1. Write tests for LLM food matching pipeline (C16)
2. Write tests for `computeBaselineAverages` (C18) — covering zero-cap scenario
3. Write tests for `habitProgress.ts` (C19) and `derivedHabitLogs.ts` (C20)
4. Fix `it.fails("rejects re-matching expired items")` — resolve the underlying bug (C17)

### Sprint 3 (accessibility + UX)

1. Silent error swallowing in all 6 SubRow editors (H18–H23) — show toast
2. Fix incomplete Base UI migration (`switch.tsx`, `tabs.tsx`, `toggle-group.tsx`)
3. Add accessible names to all unlabelled interactive elements
4. Remove all work-ticket marker comments from source

### Sprint 4 (performance + architecture)

1. Add `listAll` pagination / hard limit in `SyncedLogsProvider` (C21)
2. Convert `count` query from `.collect()` to efficient count (C22)
3. Wrap `TrackPage` in `lazy()` (H40)
4. Reduce `REPORT_HISTORY_COUNT` from 500 to 10 (H41)
5. Extract dead code: `applyLlmResults`, `aiRateLimiter` body, duplicate `resolveCanonicalFoodName`
6. Add `recharts` to Vite `manualChunks` (H42/H6 in A10)
