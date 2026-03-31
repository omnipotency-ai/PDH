# Correctness Audit

**Date:** 2026-02-27
**Scope:** All staged files (49 code files)
**Reviewer:** Claude Opus 4.6 -- Correctness Specialist

## Executive Summary

This changeset is a large refactor: the habit system migrates from `goalMode`/`dailyGoal`/`category` to `kind`/`dailyTarget`/`dailyCap`/`unit`, with a new local `HabitLog` store, backward-compat bridging from legacy synced logs, AI coaching, and expanded health/reproductive settings. The core migration logic is solid and well-guarded with defensive runtime checks. However, there are several correctness issues ranging from stale closure bugs to data integrity risks with unbounded state growth, and one critical race condition in the habit import effect.

## Critical Issues

### C1. Race condition / infinite loop risk in habit import effect (Track.tsx)

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/pages/Track.tsx`
**Lines:** ~207-230 (the `useEffect` for `habitHistoryCompat.imports`)

```tsx
useEffect(() => {
  if (habitHistoryCompat.imports.length === 0) return;
  const batchKey = [
    syncKey,
    ...habitHistoryCompat.imports.map(
      (log) => `${log.habitId}:${log.at}:${log.value}`,
    ),
  ].join("|");
  if (lastHabitImportBatchKeyRef.current === batchKey) return;
  lastHabitImportBatchKeyRef.current = batchKey;

  useStore.setState((state) => ({
    habitLogs: [...state.habitLogs, ...habitHistoryCompat.imports],
  }));
  // ...
}, [habitHistoryCompat.imports, syncKey]);
```

The dependency array includes `habitHistoryCompat.imports`, which is derived from `habitLogs` (via `useMemo` with `[logs, habitLogs, habits]`). When this effect runs, it appends to `habitLogs` via `useStore.setState`, which changes `habitLogs`, which re-triggers the `useMemo` for `habitHistoryCompat`, which produces a new `imports` array reference. The `batchKey` guard is the only thing preventing an infinite loop, but:

1. If `buildHabitHistoryCompatBackfill` produces different import entries on the second pass (because `habitLogs` now includes the just-imported entries, potentially changing deduplication logic), the `batchKey` will differ, causing a second append.
2. The `dedupeMergedHabitLogsForCompat` function inside `buildHabitHistoryCompatBackfill` uses `QUICK_IMPORT_DEDUPE_WINDOW_MS = 1500` -- if the second-pass deduplication eliminates the just-imported entries from `imports`, the effect stops. But there's a timing-sensitive edge where this could produce duplicate entries.

**Risk:** Potential duplicate habit log entries or one extra re-render cycle on every mount. The batchKey guard mitigates total runaway, but does not fully prevent double-appending under timing conditions.

**Recommendation:** Move the import logic out of a render-triggered effect. Consider performing the import in a one-time migration function or using a stable ref to track whether import has been done for the current session.

### C2. Unbounded growth of `habitLogs` in IndexedDB (store.ts)

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/store.ts`

The `habitLogs` array is persisted to IndexedDB and is only ever appended to (`addHabitLog` does `[...state.habitLogs, log]`). There is no pruning, cleanup, or size limit. Over months of use, this array will grow without bound. With the compat import backfill adding historical entries, it could become very large immediately.

**Risk:** IndexedDB storage limits, slow serialization/deserialization of Zustand state, and degraded app startup performance over time.

**Recommendation:** Implement a retention window (e.g., keep only last 90 days of habit logs) or implement periodic pruning.

## High Severity

### H1. DailyProgress counts habit logs by name, not by quickIncrement value (DailyProgress.tsx)

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/components/DailyProgress.tsx`
**Lines:** ~23-24

```tsx
const completed = todayHabitLogs.filter(
  (log) => log.data?.name === habit.name,
).length;
const isGoalMet =
  habit.kind === "destructive" ? completed <= goal : completed >= goal;
```

This counts individual log entries (`.length`), not the sum of their values. For habits with `quickIncrement > 1` (e.g., water at 100ml per tap, target 1000ml), each tap adds 1 to `completed` but the actual tracked value is `quickIncrement * completed`. A user who taps water 10 times has logged 1000ml but `completed` shows 10 -- if `dailyTarget` is 1000, the comparison `10 >= 1000` will be false forever.

Additionally, for fluid-based habits (`logAs === "fluid"`), this component filters by `log.data?.name` matching `habit.name`, but fluid logs are stored differently (type `"fluid"` with an items array, not type `"habit"`). So fluid-based habits like Water and Coffee will always show 0 progress.

**Impact:** The DailyProgress section on the Patterns page will show incorrect progress for any habit with `quickIncrement !== 1` or any fluid-tracked habit.

**Recommendation:** Use `todayHabitCounts` from `computeTodayHabitCountsWithCompat` (like Track.tsx does) instead of counting raw log entries. Alternatively, sum `log.data?.quantity` values and account for fluid logs.

### H2. Stale `last7DaysRange` in Track.tsx (never recomputed)

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/pages/Track.tsx`
**Lines:** ~181-187

```tsx
const last7DaysRange = useMemo(() => {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 6);
  return {
    start: formatLocalDateKey(start),
    end: formatLocalDateKey(end),
  };
}, []); // Stable for the session
```

The comment says "fine to recompute on mount only" but this means if the user keeps the app open past midnight, the date range becomes stale. Streak summaries and day summaries will be computed for yesterday's range.

**Impact:** After midnight, coaching messages and habit detail sheets will show stale streak data until the user refreshes.

**Recommendation:** Add a time-based dependency or recompute when `now` (which is already updated) changes its date portion.

### H3. `setHealthProfile` shallow merge loses nested reproductiveHealth fields (store.ts)

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/store.ts`
**Lines:** ~630-640

```tsx
setHealthProfile: (updates) =>
  set((state) => ({
    healthProfile: {
      ...state.healthProfile,
      ...updates,
      reproductiveHealth: {
        ...state.healthProfile.reproductiveHealth,
        ...(updates.reproductiveHealth ?? {}),
      },
    },
  })),
```

If the caller passes `updates` that include top-level fields AND `reproductiveHealth`, the nested merge works correctly. However, if the caller passes `{ reproductiveHealth: { cycleTrackingEnabled: true } }`, the spread will produce a `reproductiveHealth` with all existing fields plus the override -- this is correct.

But the `handleLoadProfile` in `AppDataForm.tsx` calls `setHealthProfile({ ...profile.healthProfile, healthConditions: normalizedConditions, ... })`. Since `profile.healthProfile` already contains a `reproductiveHealth` sub-object, this will work. No bug here after closer inspection.

However, in `ReproForm.tsx`, the `updateReproductiveHealth` function is:

```tsx
const updateReproductiveHealth = (
  updates: Partial<ReproductiveHealthSettings>,
) => {
  setHealthProfile({
    reproductiveHealth: {
      ...healthProfile.reproductiveHealth,
      ...updates,
    },
  });
};
```

This redundantly spreads `reproductiveHealth` since `setHealthProfile` already merges it. Not a bug, but the double spread means `updateReproductiveHealth({ menopauseHrtNotes: e.target.value, hormonalMedicationNotes: e.target.value })` in the ReproForm calls `setHealthProfile` with a full `reproductiveHealth` object -- the store then spreads again. No correctness issue, just unnecessary work.

**Severity downgraded to informational.** The actual merge logic is correct.

### H4. `deleteAllBySyncKey` does not delete from all tables (convex/logs.ts)

**File:** `/Users/peterjamesblizzard/projects/caca_traca/convex/logs.ts`

The mutation deletes from `logs`, `aiAnalyses`, `conversations`, `foodAssessments`, `reportSuggestions`, `foodTrialSummary`, `weeklyDigest`, `weeklySummaries`, `profiles`, and `foodLibrary`. But the schema also has a `mealPlans` table with a `by_syncKey` index (visible in schema.ts from the existing code). If `mealPlans` is not deleted, the user's "Delete My Account Data" feature leaves orphaned data.

**Impact:** Incomplete data deletion. Users who delete their account data may have meal plans persisted.

**Recommendation:** Add `mealPlans` table to the `deleteAllBySyncKey` mutation.

### H5. `aiPreferences` sent to Convex as `v.any()` -- no validation (convex/logs.ts, convex/schema.ts)

**File:** `/Users/peterjamesblizzard/projects/caca_traca/convex/schema.ts` line ~207, `/Users/peterjamesblizzard/projects/caca_traca/convex/logs.ts` line ~389

```tsx
aiPreferences: v.optional(v.any()),
```

The `replaceProfile` mutation accepts `aiPreferences: v.optional(v.any())` and stores it directly. While `sanitizeUnknownStringsDeep` is applied, there is no structural validation. A malicious or buggy client could store arbitrarily shaped data that would break on load.

**Impact:** Potential for corrupted profile data that could crash the UI on load.

**Recommendation:** Define a proper Convex validator for `aiPreferences` matching the `AiPreferences` TypeScript interface.

## Medium Severity

### M1. `computeRangeDays` uses `new Date("YYYY-MM-DDT00:00:00")` which may parse in local time inconsistently (DigestiveCorrelationGrid.tsx)

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/DigestiveCorrelationGrid.tsx`
**Lines:** ~63-66

```tsx
function computeRangeDays(start: string, end: string): number {
  const startMs = new Date(`${start}T00:00:00`).getTime();
  const endMs = new Date(`${end}T00:00:00`).getTime();
  return Math.round((endMs - startMs) / (24 * 60 * 60 * 1000)) + 1;
}
```

The `T00:00:00` suffix without a timezone causes the Date constructor to parse in local time. This is actually consistent with how `generateDateRange` in `habitAggregates.ts` works, so no cross-system mismatch. However, around DST transitions, `Math.round` could produce off-by-one results because 24 hours does not perfectly align with calendar days.

**Impact:** Rare display-only issue: the "Range: ... (N days)" label could show N-1 or N+1 during DST transitions.

### M2. `paneSummaryCache` grows without bound in Zustand store (store.ts)

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/store.ts`

The `paneSummaryCache` is a `Record<string, PaneSummaryCacheEntry>` persisted to IndexedDB. New entries are added via `setPaneSummaryCacheEntry` but never pruned (except `clearPaneSummaryCache` which is not called automatically). Cache keys include date ranges, so each new date range creates new entries.

**Impact:** Over time, the persisted state object grows. Less severe than `habitLogs` (entries are small), but still accumulates indefinitely.

### M3. `HabitDetailSheet` micro-graph maps DAY_LABELS by index, not by actual day-of-week (HabitDetailSheet.tsx)

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/components/track/HabitDetailSheet.tsx`
**Lines:** ~37, ~329-345

```tsx
const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
// ...
{DAY_LABELS.map((label, index) => {
  const summary = last7Days[index];
```

The `last7Days` are the last 7 entries of `daySummaries` sorted by date, but they are not guaranteed to start on a Monday. If the current day is Wednesday, `last7Days` would be Thu-Wed, but `DAY_LABELS` always shows M-T-W-T-F-S-S. The day labels will be misaligned with the actual dates.

**Impact:** Users will see incorrect day-of-week labels on their 7-day habit micro-graph.

**Recommendation:** Compute day labels from the actual dates in `last7Days` using `date-fns` `getDay()` or similar.

### M4. `QuickCaptureTile` passes `equivalentCount` to `getTileColorTint` and `shouldShowBadge` but those functions expect raw count (QuickCaptureTile.tsx)

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/components/track/QuickCaptureTile.tsx`
**Lines:** ~201-204

```tsx
const equivalentCount =
  habit.logAs === "fluid" &&
  habit.quickIncrement > 0 &&
  fluidTotalMl !== undefined
    ? fluidTotalMl / habit.quickIncrement
    : count;
const tint = getTileColorTint(habit, equivalentCount, fluidTotalMl);
```

`getTileColorTint` receives `equivalentCount` as the `count` parameter. Inside, it checks:

```tsx
const currentValue = habit.logAs === "fluid" ? (fluidTotalMl ?? 0) : count;
```

For fluid habits, it uses `fluidTotalMl` directly (correct). For non-fluid habits, it uses `count` which is `equivalentCount` -- this is the same as `count` for non-fluid habits. So no bug for the tint calculation itself.

However, `shouldShowBadge` also receives `equivalentCount`:

```tsx
const badge = shouldShowBadge(habit, equivalentCount, fluidTotalMl);
```

Inside `shouldShowBadge`, for non-fluid target habits:

```tsx
const currentValue = habit.logAs === "fluid" ? (fluidTotalMl ?? 0) : count;
if (currentValue >= target) return "check";
```

For non-fluid habits, `count` is `equivalentCount` which equals `count` (the raw count). This is correct. No bug after closer inspection.

### M5. `getProgressText` in `HabitDetailSheet` divides fluidMl by quickIncrement for coffee cups but doesn't guard division by zero (HabitDetailSheet.tsx)

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/components/track/HabitDetailSheet.tsx`
**Lines:** ~119-125

```tsx
const isCoffeeCups =
  habit.logAs === "fluid" &&
  fluidMl !== undefined &&
  habit.quickIncrement > 0 &&
  (habit.id === "habit_coffee" || habit.habitType === "caffeine");
```

The guard `habit.quickIncrement > 0` prevents division by zero. No bug.

### M6. `fetchAiInsights` accesses `useStore.getState().paneSummaryCache` inside a callback (useAiInsights.ts)

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/hooks/useAiInsights.ts`
**Lines:** ~120-137

```tsx
const paneSummaryCache = useStore.getState().paneSummaryCache;
```

This is called inside the `sendNow` callback. Using `useStore.getState()` is the correct Zustand pattern for accessing state outside of React render context (avoids stale closures). No correctness issue.

### M7. `handleSaveSyncKey` on blur may trigger unexpected key change (AppDataForm.tsx)

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/components/settings/AppDataForm.tsx`

The sync key input now auto-saves on blur via `onBlur={handleSaveSyncKey}`. If a user accidentally clicks into the field and then clicks away, the trimmed value is compared with the current syncKey. The guard `if (nextSyncKey === syncKey) return;` prevents unnecessary updates. However, if the user had trailing whitespace, the trimmed version would differ, causing an unexpected key change.

**Impact:** Minor -- unlikely but could change the sync key accidentally.

### M8. `isGoodDay` returns `true` for destructive habits with `totalValue === 0` and `dailyCap === 0` (habitAggregates.ts)

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/lib/habitAggregates.ts`
**Lines:** ~58-66

```tsx
function isGoodDay(totalValue: number, habit: HabitConfig): boolean {
  if (habit.kind === "positive" && habit.dailyTarget !== undefined) {
    return totalValue >= habit.dailyTarget;
  }
  if (habit.kind === "destructive" && habit.dailyCap !== undefined) {
    return totalValue <= habit.dailyCap;
  }
  return true;
}
```

If `dailyCap` is 0, then `totalValue <= 0` is `true` only when `totalValue` is exactly 0. This is semantically correct (cap of 0 means "don't do it at all"). But `dailyCap: 0` could be set by a user who intended "no cap" vs "cap of zero". The `normalizeStoredProfileHabit` in `convex/logs.ts` only sets `dailyCap` when `dailyCap > 0`, so in practice this is prevented.

### M9. `generateDateRange` uses `setDate()` which can skip dates around DST boundaries (habitAggregates.ts)

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/lib/habitAggregates.ts`
**Lines:** ~39-50

```tsx
function generateDateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const current = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  while (current <= endDate) {
    dates.push(formatLocalDateKey(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}
```

`new Date("YYYY-MM-DDT00:00:00")` is parsed in local time. On DST "spring forward" days, `setDate(getDate() + 1)` on a midnight date could produce 01:00 the next day (not midnight), and subsequent iterations would be off. However, since `formatLocalDateKey` extracts year/month/day from the Date object, the date string would still be correct. The `while` loop comparison `current <= endDate` could theoretically include one extra day if the clocks shifted, but since both start and end are at "00:00:00" local time, this is safe in practice.

**Impact:** Negligible in practice, but theoretically fragile around DST.

## Low Severity / Informational

### L1. `HABIT_TEMPLATES` creates objects with `createdAt: Date.now()` at module load time (habitTemplates.ts)

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/lib/habitTemplates.ts`

All template habits have `createdAt: Date.now()` evaluated when the module is first imported. This means all default habits share the same `createdAt` timestamp (the app startup time). This is not a bug per se, but it means there's no ordering information for default habits.

### L2. `handleSaveGoal` in HabitDetailSheet fires on every blur, even if value hasn't changed (HabitDetailSheet.tsx)

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/components/track/HabitDetailSheet.tsx`

The goal and increment inputs fire `handleSaveGoal`/`handleSaveIncrement` on `onBlur`. Each call triggers `updateHabit` which triggers a Zustand state update and re-render. A simple "has the value changed?" guard would prevent unnecessary updates and toast messages.

### L3. `getPresetRange` in DigestiveCorrelationGrid uses `new Date()` without memoization (DigestiveCorrelationGrid.tsx)

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/DigestiveCorrelationGrid.tsx`

`getPresetRange(days)` creates a new `Date()` each time it's called, including inside `activePresetDays` useMemo. Since it's used for comparison, a tiny timing difference (e.g., between the stored `dateRange` and a freshly computed `getPresetRange`) could cause the preset to never match, keeping the "Custom" mode active. In practice, this only matters if the component re-renders right at midnight.

### L4. `celebrations.ts` uses `Math.random()` for message selection (celebrations.ts)

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/lib/celebrations.ts`

```tsx
const messageIndex = Math.floor(Math.random() * dailyMessages.length);
```

This means the celebration message can vary on each render/call. Not a correctness bug, just worth noting that this makes testing harder and could cause UI flicker if the component re-renders.

### L5. `QuickCaptureTile` long press timer of 300ms is very short (QuickCaptureTile.tsx)

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/components/track/QuickCaptureTile.tsx`

The long press timer is 300ms. On mobile devices, this is close to the threshold of a normal tap, which could cause accidental long-press triggers (opening the detail sheet) when the user intended to tap (increment).

### L6. `useWeeklySummaryAutoTrigger` closure may use stale `aiPreferences.aiModel` (useWeeklySummaryAutoTrigger.ts)

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/hooks/useWeeklySummaryAutoTrigger.ts`

```tsx
const aiPreferences = useStore((state) => state.aiPreferences);
// ... later in the effect:
const response = await fetchWeeklySummary(apiKey, input, aiPreferences.aiModel);
```

If `aiPreferences` changes between when the effect was scheduled and when it fires, the model could be stale. This is a very minor issue since the AI model is unlikely to change during a weekly summary generation.

### L7. `normalizeStoredProfileHabit` uses `as` cast without validation (convex/logs.ts)

**File:** `/Users/peterjamesblizzard/projects/caca_traca/convex/logs.ts`
**Lines:** ~89

```tsx
const raw = rawHabit as Record<string, unknown>;
```

This is after the `typeof rawHabit !== "object"` guard, so the cast is safe. All subsequent property access uses runtime type guards. Acceptable pattern.

### L8. `FactorInsights` checks `logs.length === 0` instead of `factorCorrelations.length === 0` (FactorInsights.tsx)

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/FactorInsights.tsx`

```tsx
if (logs.length === 0) return null;
```

Previously this checked `factorCorrelations.length === 0`. Now it checks if there are no logs at all. This means the component will render (showing the card header and grid) even when there are logs but no correlations to display. The grid will simply be empty, which is a minor UI issue rather than a correctness bug.

### L9. `formatLocalDateKey` accepts both Date and number -- the `Date` path re-wraps (habitAggregates.ts)

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/lib/habitAggregates.ts`

```tsx
export function formatLocalDateKey(input: Date | number): string {
  const date = typeof input === "number" ? new Date(input) : input;
```

This is fine and defensive. No issue.

### L10. The `"sweets"` habitType in KNOWN_HABIT_TYPES (convex/logs.ts) is not in habitTypeValidator (convex/validators.ts)

**File:** `/Users/peterjamesblizzard/projects/caca_traca/convex/logs.ts` line ~30

```tsx
const KNOWN_HABIT_TYPES = new Set<string>([
  // ...
  "sweets",
  // ...
]);
```

The `habitTypeValidator` in `validators.ts` does not include `"sweets"` -- it has `"confectionery"` instead. This means `normalizeStoredProfileHabit` will accept `"sweets"` as a valid habit type, but the strict `habitsValidator` (used in `replaceProfile`) will reject it. The Convex read path (`getProfile`) uses the loose normalization, so this won't crash on read, but could cause a mismatch if the normalized profile is then saved back.

**Impact:** Minor data integrity issue during legacy migration.

## Files Reviewed

| File                                                   | Status | Correctness Notes                                                                                                                                                                                                             |
| ------------------------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `convex/lib/inputSafety.ts`                            | M      | Sync key limit raised 128->512. No correctness issue.                                                                                                                                                                         |
| `convex/logs.ts`                                       | M      | New `deleteAllBySyncKey` (H4: may miss tables), `normalizeStoredProfileHabit` is well-guarded, `aiPreferences: v.any()` is risky (H5).                                                                                        |
| `convex/migrations.ts`                                 | M      | Defensive runtime guards added for `buildHabitLookup`. Correct.                                                                                                                                                               |
| `convex/schema.ts`                                     | M      | `storedProfileHabitsValidator` uses `v.array(v.any())` -- intentionally permissive for reads. Acceptable.                                                                                                                     |
| `convex/validators.ts`                                 | M      | New validators for expanded health/repro fields. Correct. L10: "sweets" mismatch.                                                                                                                                             |
| `src/components/DailyProgress.tsx`                     | M      | H1: Counts by `.length` not value sum; fluid habits not counted.                                                                                                                                                              |
| `src/components/archive/DrPooReport.tsx`               | M      | `AI_DISCLAIMER` -> `getAiDisclaimer()`. Correct.                                                                                                                                                                              |
| `src/components/patterns/DigestiveCorrelationGrid.tsx` | A      | M1: DST edge case in `computeRangeDays`. L3: preset matching race.                                                                                                                                                            |
| `src/components/patterns/FactorInsights.tsx`           | M      | L8: Shows empty grid when logs exist but no correlations.                                                                                                                                                                     |
| `src/components/patterns/WeightTracker.tsx`            | M      | Renamed and refactored. `hasGoal` helper is correct.                                                                                                                                                                          |
| `src/components/settings/AiSuggestionsCard.tsx`        | A      | Clean. `dateRange` useMemo has empty deps -- stale after midnight but acceptable for settings page.                                                                                                                           |
| `src/components/settings/AppDataForm.tsx`              | M      | M7: Auto-save on blur could trim whitespace unexpectedly. Delete flow is well-guarded with confirm dialogs.                                                                                                                   |
| `src/components/settings/HealthForm.tsx`               | M      | Large expansion. `normalizeFrequency` helper is correct. Checkbox toggling and form state management is clean.                                                                                                                |
| `src/components/settings/ReproForm.tsx`                | M      | Expanded with date pickers, switches, conditional sections. `calculateGestationalAgeFromDueDate` used correctly.                                                                                                              |
| `src/components/settings/SettingsTile.tsx`             | M      | Purely visual changes. No correctness issues.                                                                                                                                                                                 |
| `src/components/settings/TrackingForm.tsx`             | M      | Fluid defaults now derived from habit quickIncrement. Correct approach.                                                                                                                                                       |
| `src/components/track/AICoachStrip.tsx`                | A      | Simple presentational component. Correct.                                                                                                                                                                                     |
| `src/components/track/ActivitySection.tsx`             | M      | Sleep logging removed from activity section (moved to QuickCapture). Correct.                                                                                                                                                 |
| `src/components/track/BowelSection.tsx`                | M      | Radio group refactored from button to native `<input type="radio">`. Correct. `useId()` for radio group name is proper.                                                                                                       |
| `src/components/track/HabitDetailSheet.tsx`            | A      | M3: Day labels misaligned with actual dates. L2: Blur fires updates even when unchanged. AI snippet caching via ref is clean.                                                                                                 |
| `src/components/track/QuickCapture.tsx`                | A      | Sleep hours picker, weight entry, add habit drawer. Well-structured. `sanitizeWeightInput` is thorough.                                                                                                                       |
| `src/components/track/QuickCaptureTile.tsx`            | A      | L5: 300ms long press may be too short. Animation logic is clean. Color tint logic is correct.                                                                                                                                 |
| `src/components/track/TodayLog.tsx`                    | M      | Walking habit logs merged into walk activity group. `findHabitConfigForHabitLog` fallback chain is reasonable.                                                                                                                |
| `src/components/track/TodayStatusRow.tsx`              | A      | Pure display component. `formatTimeSince` handles edge cases correctly.                                                                                                                                                       |
| `src/components/ui/responsive-shell.tsx`               | A      | Clean responsive shell using Drawer/Dialog/Sheet. Correct.                                                                                                                                                                    |
| `src/hooks/useAiInsights.ts`                           | M      | `paneSummaryCache` access via `useStore.getState()` is correct Zustand pattern. `aiPreferences` ref updated properly.                                                                                                         |
| `src/hooks/useCelebration.ts`                          | M      | Simplified: removed `celebrateMilestone`, `isMilestone`, `newBadges`. Clean simplification.                                                                                                                                   |
| `src/hooks/useWeeklySummaryAutoTrigger.ts`             | M      | L6: Potential stale closure for `aiPreferences`. Minor risk.                                                                                                                                                                  |
| `src/lib/aiAnalysis.ts`                                | M      | `buildMealScheduleText` handles time parsing correctly. Tone matrix is well-structured. `getAiDisclaimer` accepts model param.                                                                                                |
| `src/lib/celebrations.ts`                              | A      | L4: `Math.random()` message selection. Functionally correct.                                                                                                                                                                  |
| `src/lib/deprecatedHabits.ts`                          | A      | Clean utility. `isDeprecatedHabitId` uses `as any` cast for Set membership check -- acceptable.                                                                                                                               |
| `src/lib/digestiveCorrelations.ts`                     | A      | `rankDaysByQuality` sorts by distance from Bristol 3.5 -- correct. Pane builders are well-structured.                                                                                                                         |
| `src/lib/foodParsing.ts`                               | M      | Mostly formatting changes. System prompt updated with better examples. No logic changes.                                                                                                                                      |
| `src/lib/habitAggregates.ts`                           | A      | M9: DST edge case in `generateDateRange`. Core logic (`isGoodDay`, `computeStreakSummary`) is correct.                                                                                                                        |
| `src/lib/habitCoaching.ts`                             | A      | Three tiers of coaching (AI, heuristic, settings suggestions). Well-structured. JSON parsing has proper error handling.                                                                                                       |
| `src/lib/habitConstants.ts`                            | M      | Removed deprecated habit IDs. Added `habit_rec_drugs` alias. Correct.                                                                                                                                                         |
| `src/lib/habitHistoryCompat.ts`                        | A      | Complex but well-tested deduplication logic. Binary search for nearby timestamps is correct. `QUICK_IMPORT_DEDUPE_WINDOW_MS` of 1500ms is reasonable.                                                                         |
| `src/lib/habitIcons.tsx`                               | M      | New icons for water, alcohol, sleep. `String(habit.habitType)` cast added for safety. Correct.                                                                                                                                |
| `src/lib/habitTemplates.ts`                            | M      | Major refactor of HabitConfig shape. `validateHabitConfig` throws on invalid input. `normalizeHabitConfig` handles old-to-new migration. `createCustomHabit` uses conditional spreads correctly.                              |
| `src/lib/streaks.ts`                                   | M      | Removed `updateStreak`, `checkNewBadges`, `BADGE_INFO`, `getWeeklySummary`. Simplified to types and defaults only.                                                                                                            |
| `src/lib/sync.ts`                                      | M      | `filterDeprecatedSyncedLogs` and `filterDeprecatedHabits` applied to queries and saves. `useDeleteAllSyncedData` hook added. Correct.                                                                                         |
| `src/pages/Archive.tsx`                                | M      | Back link changed from "/" to "/patterns". Import path fixed. Correct.                                                                                                                                                        |
| `src/pages/Patterns.tsx`                               | M      | Major refactor: removed NormalizeButton, added DigestiveCorrelationGrid. AI summary generation is clean with cancellation via `aiRequestRef`.                                                                                 |
| `src/pages/Settings.tsx`                               | M      | Complete rewrite: decomposed into sub-forms. Clean delegation to SettingsTile grid + Card-based forms.                                                                                                                        |
| `src/pages/Track.tsx`                                  | M      | C1: Race condition in import effect. H2: Stale date range. Core flow (QuickCapture -> addHabitLog + addSyncedLog -> celebrations) is well-orchestrated.                                                                       |
| `src/routeTree.tsx`                                    | M      | Settings page wrapped in SyncedLogsProvider. Correct.                                                                                                                                                                         |
| `src/store.ts`                                         | M      | C2: Unbounded habitLogs growth. M2: Unbounded paneSummaryCache. Migration logic (v17) is thorough with condition normalization and frequency validation. `resetToFactorySettings` preserves syncKey -- correct design choice. |
| `src/index.css`                                        | M      | Visual-only: color changes and new settings page tokens. No correctness impact.                                                                                                                                               |
