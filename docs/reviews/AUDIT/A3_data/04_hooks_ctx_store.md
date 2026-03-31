# src/hooks/ + src/contexts/ + src/store/ Index

**Files:** 22 (18 hooks + 1 test + 3 contexts + 0 store directory; store is a single file `src/store.ts`)
**Total Lines:** 3,629 (hooks: 3,174 incl. test; contexts: 223; store: 232)

---

## src/hooks/ (19 files, 3,174 lines)

> Includes 1 test file (`__tests__/useTransitMapData.test.ts`, 360 lines).

| File Path                                       | Lines | Purpose                                                                                                                | Key Exports                                                                                                                                                | Imported By (excl. self)                                                |
| ----------------------------------------------- | ----: | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `src/hooks/useLongPress.ts`                     |    89 | Distinguishes tap from long-press via pointer events with configurable threshold.                                      | `useLongPress`                                                                                                                                             | 3 (QuickCaptureTile, DurationEntryPopover, WeightEntryDrawer)           |
| `src/hooks/useHabitStreaks.ts`                  |    52 | Computes 7-day habit summaries and per-habit streak records via `useMemo`.                                             | `useHabitStreaks`                                                                                                                                          | 1 (Track.tsx)                                                           |
| `src/hooks/useAiInsights.ts`                    |   345 | Orchestrates AI nutritionist analysis: calls Convex action, debounces, saves results, handles pending replies.         | `useAiInsights`                                                                                                                                            | 1 (Track.tsx)                                                           |
| `src/hooks/useApiKey.ts`                        |    40 | Manages OpenAI API key lifecycle in IndexedDB; load-on-mount + update/remove callbacks.                                | `useApiKey`                                                                                                                                                | 1 (ApiKeyContext.tsx -- sole consumer)                                  |
| `src/hooks/useBaselineAverages.ts`              |   152 | Computes and caches baseline averages + 24h deltas in Zustand store; throttled recomputation.                          | `useBaselineAverages`                                                                                                                                      | 1 (Track.tsx)                                                           |
| `src/hooks/useCelebration.ts`                   |    60 | Manages confetti + sound celebration events and simple "Logged!" toasts.                                               | `useCelebration`                                                                                                                                           | 1 (Track.tsx)                                                           |
| `src/hooks/useDayStats.ts`                      |   168 | Aggregates today's logs into per-habit counts, fluid totals, BM count, gap detection.                                  | `useDayStats`, `DayStats` (type)                                                                                                                           | 1 (Track.tsx); `DayStats` also used in baselineAverages lib             |
| `src/hooks/useFoodParsing.ts`                   |    57 | Saves raw food text to Convex and defers all parsing to server-side pipeline.                                          | `useFoodParsing`, `FoodParsingState` (type)                                                                                                                | 1 (Track.tsx); `FoodParsingState` type unused externally                |
| `src/hooks/useMappedAssessments.ts`             |    69 | Maps raw Convex assessment records into typed `FoodAssessmentRecord[]` with safe enum coercion.                        | `useMappedAssessments`                                                                                                                                     | 2 (Patterns.tsx, Menu.tsx)                                              |
| `src/hooks/usePendingReplies.ts`                |    27 | Wraps Convex query for unclaimed user messages + mutation to add new ones.                                             | `usePendingReplies`                                                                                                                                        | 2 (useAiInsights, ReplyInput) -- also ConversationPanel                 |
| `src/hooks/useQuickCapture.ts`                  |   743 | Handles all quick-capture interactions: tap, long-press, fluid, sleep, activity, weight, checkbox toggle, undo toasts. | `useQuickCapture`                                                                                                                                          | 1 (Track.tsx)                                                           |
| `src/hooks/useTimePicker.ts`                    |    86 | Manages HH:MM time picker state with edited-flag and timestamp conversion.                                             | `useTimePicker`                                                                                                                                            | 2 (FoodSection, BowelSection)                                           |
| `src/hooks/useUnresolvedFoodToast.ts`           |   156 | Persistent toast for unresolved food items with early/late window messaging and auto-dismiss.                          | `useUnresolvedFoodToast`                                                                                                                                   | 1 (Track.tsx)                                                           |
| `src/hooks/useWeeklySummaryAutoTrigger.ts`      |   227 | Auto-generates half-weekly AI summaries at Sunday/Wednesday 21:00 boundaries.                                          | `useWeeklySummaryAutoTrigger`, `getLastHalfWeekBoundary`                                                                                                   | 2 (Track.tsx, useAiInsights -- for boundary fn); also ConversationPanel |
| `src/hooks/useUnresolvedFoodQueue.ts`           |    53 | Builds a flat queue of pending food items from today's logs for the matching modal.                                    | `useUnresolvedFoodQueue`, `UnresolvedQueueItem` (type)                                                                                                     | 2 (Track.tsx, FoodMatchingModal)                                        |
| `src/hooks/useFoodLlmMatching.ts`               |   142 | Auto-triggers LLM matching for food logs with unresolved items; fire-and-forget with retry logic.                      | `useFoodLlmMatching`                                                                                                                                       | **0 -- DEAD (never imported)**                                          |
| `src/hooks/useProfile.ts`                       |   206 | Thin convenience hooks over ProfileContext for each profile section (habits, health, AI prefs, etc.).                  | `useUnitSystem`, `useHabits`, `useHealthProfile`, `useFluidPresets`, `useSleepGoal`, `useAiPreferences`, `useFoodPersonalisation`, `useTransitCalibration` | 26 total unique importers across app                                    |
| `src/hooks/useTransitMapData.ts`                |   193 | Fuses food registry structure with Bayesian evidence to produce a `TransitNetwork` model for the transit map UI.       | `useTransitMapData`                                                                                                                                        | 1 (RegistryTransitMap)                                                  |
| `src/hooks/__tests__/useTransitMapData.test.ts` |   360 | Unit tests for transit map data builder logic and helper functions (pure, no React).                                   | (test file -- no exports consumed)                                                                                                                         | 0                                                                       |

---

## src/contexts/ (3 files, 223 lines)

| File Path                            | Lines | Purpose                                                                                                                               | Key Exports                                                                          | Imported By (excl. self)                                                                                                                                                                        |
| ------------------------------------ | ----: | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/contexts/ApiKeyContext.tsx`     |    18 | Wraps `useApiKey` hook in React Context so the API key is shared app-wide without prop drilling.                                      | `ApiKeyProvider`, `useApiKeyContext`                                                 | 7 (Provider: routeTree; Hook: useAiInsights, useFoodLlmMatching, useWeeklySummaryAutoTrigger, AiSuggestionsCard, AppDataForm, AiInsightsSection)                                                |
| `src/contexts/ProfileContext.tsx`    |   158 | Fetches user profile from Convex, merges with defaults, and provides a `patchProfile` mutation. Source of truth for all profile data. | `ProfileProvider`, `useProfileContext`, `DEFAULT_PROFILE`, `PatchProfileArgs` (type) | Provider: routeTree; Hook: useProfile, useQuickCapture, AppDataForm, useAppDataFormController; DEFAULT_PROFILE: useAppDataFormController; PatchProfileArgs: useAppDataFormController, routeTree |
| `src/contexts/SyncedLogsContext.tsx` |    47 | Subscribes to all synced logs from Convex, derives habit logs, and shares them via context. Prevents duplicate Convex subscriptions.  | `SyncedLogsProvider`, `useSyncedLogsContext`                                         | Provider: routeTree; Hook: useAiInsights, useFoodLlmMatching, Patterns.tsx, Track.tsx, WeightEntryDrawer, Menu.tsx, HeroStrip                                                                   |

---

## src/store.ts (1 file, 232 lines)

> Note: There is no `src/store/` directory. The Zustand store is a single file at `src/store.ts`.

| File Path      | Lines | Purpose                                                                                                                                                                     | Key Exports                                                                                                                                                                                                                                                                                                                  | Imported By (excl. self)              |
| -------------- | ----: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `src/store.ts` |   232 | Zustand store for transient UI state: habit logs (in-memory mirror), AI pane summary cache, baseline averages, and analysis status. Also exports type guards and constants. | `useStore`, `isLogType`, `isFoodLog`, `isFluidLog`, `isDigestionLog`, `isHabitLog`, `isActivityLog`, `isWeightLog`, `isReproductiveLog`, `DEFAULT_FLUID_PRESETS`, `MAX_FLUID_PRESETS`, `BLOCKED_FLUID_PRESET_NAMES`, `DEFAULT_HEALTH_PROFILE`, `AppState` (type), re-exports: `HabitConfig`, `HabitLog`, `SleepGoal` (types) | 15 unique files import from `@/store` |

---

## Dead Exports

| File                              | Export Name               | Type            | Assessment                                                                                                                                                                      |
| --------------------------------- | ------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/hooks/useFoodLlmMatching.ts` | `useFoodLlmMatching`      | hook (function) | **DEAD -- zero importers.** The entire 142-line file is unused. Was likely replaced when LLM matching moved server-side but the hook was never removed. Candidate for deletion. |
| `src/hooks/useFoodParsing.ts`     | `FoodParsingState`        | interface       | **DEAD externally** -- only referenced inside `useFoodParsing.ts` itself as the return type annotation. No external consumer imports it. Could be unexported (made local).      |
| `src/store.ts`                    | `isLogType`               | function        | **DEAD externally** -- only referenced in `store.ts` itself (used internally by `createLogTypeGuard`). No external consumer. Could be unexported.                               |
| `src/store.ts`                    | `isHabitLog`              | type guard      | **DEAD** -- only defined in store.ts, never imported elsewhere.                                                                                                                 |
| `src/store.ts`                    | `isActivityLog`           | type guard      | **DEAD** -- only defined in store.ts, never imported elsewhere.                                                                                                                 |
| `src/store.ts`                    | `isWeightLog`             | type guard      | **DEAD** -- only defined in store.ts, never imported elsewhere.                                                                                                                 |
| `src/store.ts`                    | `isReproductiveLog`       | type guard      | **DEAD** -- only defined in store.ts, never imported elsewhere.                                                                                                                 |
| `src/store.ts`                    | `AppState` (type)         | interface       | **DEAD externally** -- only defined in store.ts, never imported elsewhere.                                                                                                      |
| `src/store.ts`                    | `HabitConfig` (re-export) | type re-export  | **DEAD** -- no file imports `HabitConfig` from `@/store`; all consumers import directly from `@/lib/habitTemplates`.                                                            |
| `src/store.ts`                    | `HabitLog` (re-export)    | type re-export  | **DEAD** -- no file imports `HabitLog` from `@/store`; all consumers import directly from `@/lib/habitTemplates`.                                                               |
| `src/store.ts`                    | `SleepGoal` (re-export)   | type re-export  | **DEAD** -- no file imports `SleepGoal` from `@/store`; all consumers import directly from `@/lib/streaks`.                                                                     |

---

## Files Over 300 Lines

| File                                            | Lines | Functions/Components                                                                                                                 | Decomposition Suggestion                                                                                                                                                                                                                                                                             |
| ----------------------------------------------- | ----: | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/hooks/useQuickCapture.ts`                  |   743 | `useQuickCapture` (1 hook with 9 handlers: tap, checkbox toggle, fluid, sleep, activity, weight, increment, long-press, close sheet) | **High priority.** Extract handler groups into focused hooks: `useFluidCapture`, `useSleepCapture`, `useActivityCapture`, `useWeightCapture`, `useCheckboxToggle`. The shared `checkAndCelebrateGoal` helper is already factored out. Sleep handler alone is ~170 lines due to midnight-split logic. |
| `src/hooks/useAiInsights.ts`                    |   345 | `useAiInsights` (1 hook: builds data refs, runs analysis, debounced trigger)                                                         | **Medium priority.** The hook body is dense but conceptually single-purpose. Could extract the `dataRef` snapshot management into a separate `useAiInsightsDataRefs` hook, and the payload construction (lines 170-253) into a pure function.                                                        |
| `src/hooks/__tests__/useTransitMapData.test.ts` |   360 | (test file)                                                                                                                          | Not a decomposition concern -- test files are expected to be long. The pure `buildTransitNetworkForTest` helper duplicates hook internals; could be extracted from the hook as a shared pure function to reduce test drift.                                                                          |

---

## Import Sources

### src/hooks/ imports from:

- `react` (useState, useCallback, useMemo, useEffect, useRef)
- `convex/react` (useAction, useMutation, useQuery)
- `date-fns` (startOfWeek)
- `sonner` (toast)
- `@/contexts/ApiKeyContext` (useApiKeyContext)
- `@/contexts/ProfileContext` (useProfileContext)
- `@/contexts/SyncedLogsContext` (useSyncedLogsContext)
- `@/store` (useStore, isDigestionLog)
- `@/lib/*` (aiAnalysis, aiModels, analysis, apiKeyStore, baselineAverages, celebrations, dateUtils, debugLog, errors, habitAggregates, habitTemplates, normalizeFluidName, sounds, sync, timeConstants, units)
- `@/types/domain`
- `@/types/transitMap`
- `@/components/track/panels` (ParsedItem type)
- `@/components/track/today-log/helpers` (getFoodItemResolutionStatus)
- `@shared/foodEvidence`
- `@shared/foodNormalize`
- `@shared/foodRegistry`
- `../../convex/_generated/api` (direct Convex API import)

### src/contexts/ imports from:

- `react` (createContext, useContext, ReactNode, useMemo, useCallback, useEffect)
- `convex/react` (useMutation, useQuery)
- `@/hooks/useApiKey` (useApiKey)
- `@/hooks/useProfile` (useHabits)
- `@/lib/habitTemplates` (HabitConfig, getDefaultHabitTemplates)
- `@/lib/streaks` (SleepGoal, DEFAULT_SLEEP_GOAL)
- `@/lib/units` (UnitSystem)
- `@/lib/derivedHabitLogs` (rebuildHabitLogsFromSyncedLogs)
- `@/lib/sync` (SyncedLog, useAllSyncedLogs)
- `@/store` (useStore, DEFAULT_HEALTH_PROFILE)
- `@/types/domain` (multiple types)
- `../../convex/_generated/api`

### src/store.ts imports from:

- `zustand` (create)
- `@/lib/habitTemplates` (HabitLog type)
- `@/lib/timeConstants` (MS_PER_WEEK)
- `@/types/domain` (multiple types)

---

## Circular Dependencies

### No true circular dependencies found.

The import graph flows cleanly in one direction:

```
store.ts (leaf -- imports only from lib/ and types/)
    ^
    |
contexts/ (import from hooks/, store, lib/)
    ^         \
    |          v
hooks/ (import from contexts/, store, lib/)
```

**Potential concern (not a cycle):** `hooks/ <-> contexts/` form a bidirectional import relationship:

- `SyncedLogsContext.tsx` imports `useHabits` from `@/hooks/useProfile`
- `ApiKeyContext.tsx` imports `useApiKey` from `@/hooks/useApiKey`
- Multiple hooks import from `@/contexts/*`

This is **not a circular dependency** because the specific files involved never form a cycle:

- `useApiKey.ts` does NOT import from any context
- `useProfile.ts` imports from `ProfileContext`, but `ProfileContext` does NOT import from `useProfile`
- `SyncedLogsContext` imports `useProfile`, but `useProfile` imports from `ProfileContext` (not SyncedLogsContext)

The dependency chains are all acyclic:

```
useProfile -> ProfileContext -> convex (no cycle)
SyncedLogsContext -> useProfile -> ProfileContext (no cycle)
ApiKeyContext -> useApiKey (no cycle)
useAiInsights -> ApiKeyContext -> useApiKey (no cycle)
```

---

## Surprising Findings

1. **`useFoodLlmMatching` is completely dead code.** The hook (142 lines) is never imported anywhere in the codebase. It appears LLM food matching was moved entirely server-side, but this client-side trigger hook was never cleaned up.

2. **11 dead exports in `store.ts`.** Three type re-exports (`HabitConfig`, `HabitLog`, `SleepGoal`) and 5 type guards (`isLogType`, `isHabitLog`, `isActivityLog`, `isWeightLog`, `isReproductiveLog`) plus `AppState` are never imported externally. The re-exports are vestigial from when the store was the canonical source for these types.

3. **`useQuickCapture` at 743 lines is the largest hook by far** and handles 9 distinct capture flows. The sleep handler alone contains ~170 lines of midnight-split logic. This is the highest-priority decomposition target in the hooks layer.

4. **`useAiInsights` manually syncs 13 reactive values into a single `dataRef`** (lines 112-138). This is a pattern smell -- a custom `useLatestRef` utility or a different architecture (e.g., passing a snapshot getter to `runAnalysis`) would reduce boilerplate and risk of stale-data bugs.

5. **Two hooks import directly from component internals:**
   - `useFoodParsing.ts` imports `ParsedItem` from `@/components/track/panels`
   - `useUnresolvedFoodQueue.ts` imports `getFoodItemResolutionStatus` from `@/components/track/today-log/helpers`

   This inverts the expected dependency direction (hooks should not depend on components). These types/utilities should be lifted to `@/lib/` or `@/types/`.

6. **`useProfile.ts` is the most-imported hook** with 26 unique importers (via its 8 sub-hooks). It is effectively a facade over `ProfileContext` and is consumed by nearly every feature area.

7. **Store is purely transient** -- no persist middleware. All habit logs are derived from Convex on mount via `SyncedLogsContext`. This is clean but means a page refresh triggers full recomputation.
