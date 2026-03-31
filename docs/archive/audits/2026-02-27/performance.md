# Performance Audit

**Date:** 2026-02-27
**Scope:** All staged files (49 code files)
**Reviewer:** Claude Opus 4.6 -- Performance Specialist

## Executive Summary

This changeset introduces a significant feature expansion (habit system redesign, settings decomposition, digestive correlation grid, AI coaching, backward-compat layer). The overall performance posture is **acceptable for a personal-use app** but has several areas where unnecessary re-computation and redundant work will degrade responsiveness as data volume grows. The most impactful issues are: (1) the backward-compatibility backfill in `habitHistoryCompat.ts` runs O(n \* m) deduplication on every render of Track and Patterns pages, (2) multiple resize event listeners are registered without debouncing, and (3) the `deleteAllBySyncKey` Convex mutation collects entire tables into memory before deleting row-by-row.

---

## Critical Issues

### C1. `deleteAllBySyncKey` collects all rows into memory before deletion

**File:** `/Users/peterjamesblizzard/projects/caca_traca/convex/logs.ts` (lines ~460-570)

```typescript
const logs = await ctx.db
  .query("logs")
  .withIndex("by_syncKey", (q) => q.eq("syncKey", syncKey))
  .collect();
for (const row of logs) {
  await ctx.db.delete(row._id);
}
```

This pattern is repeated for 10 separate tables. Each `.collect()` loads every matching row into the Convex function's working memory simultaneously. For a user with thousands of logs, this could hit Convex's function memory/time limits. The serial `await ctx.db.delete()` in a loop also makes this O(n) sequential round-trips.

**Recommendation:** Use Convex's pagination or batch delete patterns. At minimum, process in chunks using `.take(100)` in a loop, or use Convex's `internalMutation` with scheduling to handle large datasets. Consider also using `Promise.all` for batching deletes within reasonable batch sizes.

### C2. `buildHabitHistoryCompatBackfill` is expensive and runs on every render cycle

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/lib/habitHistoryCompat.ts` (lines 463-543)
**Callers:**

- `/Users/peterjamesblizzard/projects/caca_traca/src/pages/Track.tsx` (line 193)
- `/Users/peterjamesblizzard/projects/caca_traca/src/pages/Patterns.tsx` (line 48)
- `/Users/peterjamesblizzard/projects/caca_traca/src/components/settings/AiSuggestionsCard.tsx` (line 41)

```typescript
const habitHistoryCompat = useMemo(
  () => buildHabitHistoryCompatBackfill(logs, habitLogs, habits),
  [logs, habitLogs, habits],
);
```

This function performs:

1. Full iteration over all synced logs with regex matching per log (lines 273-317, 319-357, 359-401)
2. Binary search deduplication against existing habit logs (lines 493-506)
3. Construction of multiple `Map` and `Set` data structures

Because `logs` changes whenever any synced log is added/deleted (the Convex query returns a new array reference), this recomputes on every log mutation. For Track page specifically, every food log, bowel log, or habit tap triggers this recomputation across the entire history.

**Recommendation:**

- Memoize the `collectCompatEntries` output separately from the merge step so the expensive extraction only runs when `logs` structurally changes.
- Consider computing this once on mount and updating incrementally, or moving the compat merge to the Zustand store layer so it runs less frequently.
- The `useMemo` deps are correct but the inputs change too often for how expensive the function is.

---

## High Severity

### H1. Unstable inline closures passed as props cause unnecessary child re-renders in Track page

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/pages/Track.tsx`

Multiple inline arrow functions are created every render and passed as props:

```typescript
// Line 749
onLogWeightKg={(weightKg) => handleLogWeight({ weightKg })}
// Line 750
onLongPress={(habit) => setDetailSheetHabitId(habit.id)}
// Line 831
daySummaries={
  detailSheetHabit ? daySummaries.filter((s) => s.habitId === detailSheetHabit.id) : []
}
```

Each time Track re-renders (which happens on every 60-second timer tick via `setNow`), these create new function/array references, causing `QuickCapture`, `HabitDetailSheet`, and children to re-render even when their actual data has not changed.

**Recommendation:** Wrap with `useCallback` and extract filtered arrays into `useMemo`:

```typescript
const handleLogWeightKg = useCallback(
  (weightKg: number) => handleLogWeight({ weightKg }),
  [handleLogWeight],
);

const detailDaySummaries = useMemo(
  () =>
    detailSheetHabit
      ? daySummaries.filter((s) => s.habitId === detailSheetHabit.id)
      : [],
  [daySummaries, detailSheetHabit],
);
```

### H2. `new Set(habits.map(h => h.id))` recreated every render in QuickCapture

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/components/track/QuickCapture.tsx` (line 236)

```typescript
const existingHabitIds = new Set(habits.map((h) => h.id));
```

This creates a new `Set` on every render of `QuickCapture`. Since `QuickCapture` re-renders on every habit tap (counts change), this is wasteful.

**Recommendation:** Wrap in `useMemo`:

```typescript
const existingHabitIds = useMemo(
  () => new Set(habits.map((h) => h.id)),
  [habits],
);
```

### H3. Resize event listeners without debouncing

**Files:**

- `/Users/peterjamesblizzard/projects/caca_traca/src/components/ui/responsive-shell.tsx` (lines 38-50)
- `/Users/peterjamesblizzard/projects/caca_traca/src/components/track/HabitDetailSheet.tsx` (lines 46-58)

Both `useResponsiveShellMode()` and `useHabitDetailPresentationMode()` attach raw `resize` event listeners:

```typescript
window.addEventListener("resize", updateMode);
```

These fire at 60+ fps during window resizing, calling `setState` on each event. The `setState` is cheap when the value does not change (React bails out), but the event handler itself runs at paint frequency.

**Recommendation:** Either use CSS media queries (preferred -- zero JS cost) or debounce the resize handler. Since these only need to detect breakpoint crossings, a simple `matchMedia` listener would be more efficient:

```typescript
useEffect(() => {
  const mql = window.matchMedia(`(min-width: ${BREAKPOINT}px)`);
  const handler = () => setMode(mql.matches ? "desktop" : "mobile");
  mql.addEventListener("change", handler);
  return () => mql.removeEventListener("change", handler);
}, []);
```

### H4. `getHabitTotalsForDate` scans full habitDaySummaries array per call in digestive correlations

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/lib/digestiveCorrelations.ts` (lines 59-70)

```typescript
function getHabitTotalsForDate(
  date: string,
  habitDaySummaries: HabitDaySummary[],
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const summary of habitDaySummaries) {
    if (summary.date === date) {
      totals.set(summary.habitId, summary.totalValue);
    }
  }
  return totals;
}
```

This is called once per best/worst day per pane builder (4 panes x ~6 days = ~24 calls), and each call scans the entire `habitDaySummaries` array. For a 30-day range with 10 habits, that is 300 summaries scanned 24+ times.

**Recommendation:** Pre-index `habitDaySummaries` by date once at the top of `computeCorrelations`:

```typescript
const summariesByDate = new Map<string, Map<string, number>>();
for (const summary of habitDaySummaries) {
  let dateMap = summariesByDate.get(summary.date);
  if (!dateMap) {
    dateMap = new Map();
    summariesByDate.set(summary.date, dateMap);
  }
  dateMap.set(summary.habitId, summary.totalValue);
}
```

Then pass the indexed structure to pane builders instead of the raw array.

---

## Medium Severity

### M1. `computeDaySummaries` generates O(habits x days) entries including many zero-value rows

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/lib/habitAggregates.ts` (lines 75-112)

```typescript
for (const habit of habits) {
  for (const date of dates) {
    const key = `${habit.id}|${date}`;
    const totalValue = logTotals.get(key) ?? 0;
    summaries.push({ ... });
  }
}
```

For 10 habits over 14 days, this creates 140 objects. For 30 days it is 300 objects. Most will be zero-value. While not catastrophic, this is called in both Track and Patterns pages on every log mutation.

**Recommendation:** Consider a sparse representation (only create summaries for days with actual logs) and treating missing entries as zero in consumer code.

### M2. `normalizeStoredProfileHabits` runs on every `getProfile` query response

**File:** `/Users/peterjamesblizzard/projects/caca_traca/convex/logs.ts` (lines 456-475)

The `getProfile` query normalizes habits on every read. Since Convex queries re-execute on any table mutation, this normalization work is repeated even when the profile has not changed. The normalization itself includes regex inference (`inferLegacyHabitType`) which, while fast, is unnecessary for already-normalized profiles.

**Recommendation:** Normalize once during writes (in `replaceProfile`) rather than on every read. If backward compatibility with old data is needed, run a one-time migration.

### M3. `filterDeprecatedSyncedLogs` creates a new filtered array on every sync query

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/lib/sync.ts` (lines 35, 46)

```typescript
return useMemo(
  () => filterDeprecatedSyncedLogs((logs ?? []) as SyncedLog[]),
  [logs],
);
```

This allocates a new array on every Convex query update. For the common case where there are zero deprecated logs, the filter does nothing but still creates a copy. Consider short-circuiting when the deprecated set is empty (it only contains 2 IDs).

### M4. Patterns page triggers 4 sequential AI API calls without parallelization

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/pages/Patterns.tsx` (lines 71-88)

```typescript
for (const ctx of paneSummaryContexts) {
  if (aiRequestRef.current !== requestId) return;
  try {
    results[ctx.paneId] = await generatePaneSummary(apiKey, ctx);
  } catch { ... }
}
```

Each `generatePaneSummary` call is awaited before the next begins. Since these are independent API calls, they could run in parallel with `Promise.allSettled`.

**Recommendation:**

```typescript
const settled = await Promise.allSettled(
  paneSummaryContexts.map((ctx) => generatePaneSummary(apiKey, ctx)),
);
```

### M5. `computeTodayHabitCountsWithCompat` scans all today's logs redundantly

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/lib/habitHistoryCompat.ts` (lines 443-461)

This calls `collectCompatEntries` which iterates all logs, applies regex matching, and builds maps -- even though the caller (`Track.tsx` line 144) already has `todayLogs` pre-filtered. The function re-processes logs that are already narrowed to today.

The issue is that `collectCompatEntries` internally re-processes every log type even when only habit/fluid/activity types are relevant. This is doubly wasteful with food logs (which are the majority in many users' data).

### M6. `useStore` subscriptions in HealthForm are too granular -- 2 separate selectors

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/components/settings/HealthForm.tsx` (lines in the full file)

The HealthForm component subscribes to `healthProfile` and `setHealthProfile` via separate `useStore` calls. Each call creates a separate subscription. While Zustand's shallow comparison handles this well, the `setHealthProfile` selector returns a new stable function reference on every store update because the selector `(s) => s.setHealthProfile` returns the same reference. This is fine -- just noting for completeness.

### M7. `dateRange` in `AiSuggestionsCard` is computed with `useMemo([], [])` -- empty deps

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/components/settings/AiSuggestionsCard.tsx` (lines 32-37)

```typescript
const dateRange = useMemo(() => {
  const today = new Date();
  const end = formatLocalDateKey(today);
  const start = formatLocalDateKey(
    new Date(today.getTime() - 13 * 24 * 60 * 60 * 1000),
  );
  return { start, end };
}, []);
```

Empty dependency array means this is computed once on mount and never updates. If the component stays mounted across midnight, the date range becomes stale. This is a correctness issue more than a performance one, but noting it here.

### M8. Duplicate QuickCapture and TodayStatusRow components rendered for desktop layout

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/pages/Track.tsx` (lines 736-788)

The Track page renders `QuickCapture` and `TodayStatusRow` twice -- once in the mobile block (hidden via `xl:hidden`) and once in the desktop block (hidden via `hidden xl:block`). Both instances are always mounted in the React tree; CSS merely hides one.

```typescript
<div className="space-y-3 xl:hidden mb-5">
  <TodayStatusRow ... />
  <QuickCapture ... />
</div>
...
<section className="hidden xl:block space-y-5 min-w-0">
  <TodayStatusRow ... />
  <QuickCapture ... />
</section>
```

Both `QuickCapture` components maintain their own state (drawer open, sleep entry, weight entry), and both re-render on every habit count change.

**Recommendation:** Render only one instance and use CSS to reposition it, or conditionally render based on the responsive mode hook already available in the codebase.

---

## Low Severity / Informational

### L1. `refreshCoaching` debounce timer creates new closure every render

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/pages/Track.tsx` (lines 267-296)

The `refreshCoaching` callback has many dependencies (`habits`, `todayHabitCounts`, `todayFluidTotalsByName`, `streakSummaries`, `apiKey`, `hadGapYesterday`) causing it to be recreated frequently. Using refs for the data and a stable callback would reduce closure allocations.

### L2. `last7DaysRange` has empty deps -- intentionally stable but could go stale

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/pages/Track.tsx` (lines 199-207)

```typescript
const last7DaysRange = useMemo(() => {
  ...
}, []); // Stable for the session
```

Comment says this is intentional. Fine for a personal tracker, but the range becomes incorrect if the app stays open across midnight.

### L3. OpenAI client instantiated on every API call

**Files:**

- `/Users/peterjamesblizzard/projects/caca_traca/src/lib/habitCoaching.ts` (lines 46-47, 248-249, 531-532)

```typescript
const { default: OpenAI } = await import("openai");
const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
```

Each coaching call dynamically imports the OpenAI module and constructs a new client. The dynamic import is cached by the bundler after first load, but the client construction is repeated. For a personal app this is fine, but a module-level factory could reduce overhead for rapid sequential calls.

### L4. `paneSummaryContexts` references passed directly to useEffect deps

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/pages/Patterns.tsx` (lines 65-89)

The `paneSummaryContexts` array is created inside a `useMemo` so its reference is stable when inputs are unchanged. However, the `useEffect` at line 65 clears AI summaries and fires 4 API calls whenever this reference changes. This is correct behavior but worth noting: changing the date range triggers all 4 API calls even if cached results exist (caching is handled inside `generatePaneSummary` so this is mostly fine).

### L5. `habitHistoryCompat.imports` useEffect has missing dependency

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/pages/Track.tsx` (lines 231-252)

```typescript
useEffect(() => {
  if (habitHistoryCompat.imports.length === 0) return;
  ...
  useStore.setState((state) => ({
    habitLogs: [...state.habitLogs, ...habitHistoryCompat.imports],
  }));
  ...
}, [habitHistoryCompat.imports, syncKey]);
```

The `setState` appends imports to `habitLogs`, which triggers the `habitLogs` Zustand state change, which triggers the `buildHabitHistoryCompatBackfill` useMemo to recompute. The batchKey guard prevents infinite loops, but this is a cascade of unnecessary recomputation.

### L6. 532 KB image in public assets

**File:** `/Users/peterjamesblizzard/projects/caca_traca/public/tracking-personalisation-img.png`

The `tracking-personalisation-img.png` is 532 KB, significantly larger than the other settings images (17-24 KB). This is loaded eagerly on the Settings page.

**Recommendation:** Compress this image or convert to WebP/AVIF format to reduce page weight.

### L7. CSS animations are well-optimized

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/index.css`

The new CSS additions use transforms and opacity for animations (`animate-counter-slide-in`, `animate-counter-slide-out`, `animate-badge-pop-in`), which are GPU-composited properties. No layout-triggering animations were found. Good practice.

### L8. `HealthForm` is a very large component (~1000+ lines)

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/components/settings/HealthForm.tsx`

This single component renders the entire health profile form. While React will only re-render it when its store subscriptions change, the sheer size of the render tree means any state change in the health profile triggers a large reconciliation pass. Consider splitting into sub-sections (Demographics, Surgery, Substances, etc.) that subscribe to narrower store slices.

### L9. Store migration function runs double normalization of fluid presets

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/store.ts` (lines 732-741)

```typescript
if (!Array.isArray(persisted.fluidPresets)) {
  persisted.fluidPresets = DEFAULT_FLUID_PRESETS;
} else {
  persisted.fluidPresets = normalizeFluidPresets(persisted.fluidPresets);
}

// Migration: remove blocked names from fluid presets and cap at 2
if (Array.isArray(persisted.fluidPresets)) {
  persisted.fluidPresets = normalizeFluidPresets(persisted.fluidPresets);
}
```

`normalizeFluidPresets` is called twice on the same data. The second call (lines 739-741) is redundant.

---

## Files Reviewed

| File                                                   | Perf Notes                                                                                                                                                                                                                |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `convex/lib/inputSafety.ts`                            | Minor: syncKey limit raised from 128 to 512. No performance concern.                                                                                                                                                      |
| `convex/logs.ts`                                       | **Critical (C1):** `deleteAllBySyncKey` collects all rows into memory. **Medium (M2):** `getProfile` normalizes on every read.                                                                                            |
| `convex/migrations.ts`                                 | Minor changes to habit lookup. Regex per habit is fine for small profile sizes.                                                                                                                                           |
| `convex/schema.ts`                                     | Schema-only changes. No runtime impact.                                                                                                                                                                                   |
| `convex/validators.ts`                                 | Type definition changes. No runtime impact.                                                                                                                                                                               |
| `src/components/DailyProgress.tsx`                     | Clean. `useMemo` properly guards computation.                                                                                                                                                                             |
| `src/components/archive/DrPooReport.tsx`               | Trivial change. No issue.                                                                                                                                                                                                 |
| `src/components/patterns/DigestiveCorrelationGrid.tsx` | Clean. Proper use of `useMemo`/`useState`.                                                                                                                                                                                |
| `src/components/patterns/FactorInsights.tsx`           | Switched from `useSyncedLogs` to context. Good improvement.                                                                                                                                                               |
| `src/components/patterns/WeightTracker.tsx`            | Clean. Minor refactor.                                                                                                                                                                                                    |
| `src/components/settings/AiSuggestionsCard.tsx`        | **Medium (M7):** Stale date range with empty deps. Calls `buildHabitHistoryCompatBackfill` (C2).                                                                                                                          |
| `src/components/settings/AppDataForm.tsx`              | Clean. Added proper error handling and loading states.                                                                                                                                                                    |
| `src/components/settings/HealthForm.tsx`               | **Low (L8):** Very large component, could benefit from splitting.                                                                                                                                                         |
| `src/components/settings/ReproForm.tsx`                | Clean. Settings form with proper store subscriptions.                                                                                                                                                                     |
| `src/components/settings/SettingsTile.tsx`             | Trivial CSS changes. No issue.                                                                                                                                                                                            |
| `src/components/settings/TrackingForm.tsx`             | Clean. Derives fluid defaults from habits -- fine for small arrays.                                                                                                                                                       |
| `src/components/track/AICoachStrip.tsx`                | Lightweight presentational component. No issue.                                                                                                                                                                           |
| `src/components/track/ActivitySection.tsx`             | Removed sleep logging from this section. Simpler, fewer renders.                                                                                                                                                          |
| `src/components/track/BowelSection.tsx`                | Added `useId()` for radio group name. Good accessibility fix, no perf concern.                                                                                                                                            |
| `src/components/track/HabitDetailSheet.tsx`            | **High (H3):** Resize listener without debounce. AI snippet fetch has good cancellation pattern and ref-based caching.                                                                                                    |
| `src/components/track/QuickCapture.tsx`                | **High (H2):** `existingHabitIds` Set recreated every render. Long press timer handling is clean.                                                                                                                         |
| `src/components/track/QuickCaptureTile.tsx`            | Clean. Good use of `useCallback` for event handlers. Animation effect properly cleans up timeout.                                                                                                                         |
| `src/components/track/TodayLog.tsx`                    | `groupLogEntries` is O(n) and properly memoized. New `findHabitConfigForHabitLog` does 3 sequential `.find()` calls but list is small.                                                                                    |
| `src/components/track/TodayStatusRow.tsx`              | Lightweight presentational component. No issue.                                                                                                                                                                           |
| `src/components/ui/responsive-shell.tsx`               | **High (H3):** Resize listener without debounce.                                                                                                                                                                          |
| `src/hooks/useAiInsights.ts`                           | Iterates `paneSummaryCache` entries in a loop (line 127) -- fine for small cache. Uses refs for stable references -- good pattern.                                                                                        |
| `src/hooks/useCelebration.ts`                          | Simplified. Removed milestone celebration. Clean.                                                                                                                                                                         |
| `src/hooks/useWeeklySummaryAutoTrigger.ts`             | Clean. Passes model preference to API call.                                                                                                                                                                               |
| `src/lib/aiAnalysis.ts`                                | Large system prompt construction. String concatenation is fine. `buildLogContext` properly uses Map for O(1) lookups.                                                                                                     |
| `src/lib/celebrations.ts`                              | Pure function. `Math.random()` index selection is fine.                                                                                                                                                                   |
| `src/lib/deprecatedHabits.ts`                          | Small Set lookups. O(1) per check. Clean.                                                                                                                                                                                 |
| `src/lib/digestiveCorrelations.ts`                     | **High (H4):** `getHabitTotalsForDate` scans full array per call. Should pre-index.                                                                                                                                       |
| `src/lib/foodParsing.ts`                               | Minor prompt changes. No performance concern.                                                                                                                                                                             |
| `src/lib/habitAggregates.ts`                           | **Medium (M1):** Generates dense matrix including zero-value entries.                                                                                                                                                     |
| `src/lib/habitCoaching.ts`                             | **Low (L3):** OpenAI client instantiated per call. **Medium (M4):** Sequential AI calls in pane summaries (called from Patterns page).                                                                                    |
| `src/lib/habitConstants.ts`                            | Removed `HABIT_DISPLAY_LABELS`. Minor cleanup.                                                                                                                                                                            |
| `src/lib/habitHistoryCompat.ts`                        | **Critical (C2):** Expensive backfill runs on every render. Binary search deduplication is algorithmically good but inputs change too often.                                                                              |
| `src/lib/habitIcons.tsx`                               | Static icon mapping. No issue.                                                                                                                                                                                            |
| `src/lib/habitTemplates.ts`                            | Template definitions. `normalizeHabitConfig` is called in store mutations -- fine.                                                                                                                                        |
| `src/lib/streaks.ts`                                   | Simplified. Removed badge system. Good cleanup.                                                                                                                                                                           |
| `src/lib/sync.ts`                                      | **Medium (M3):** `filterDeprecatedSyncedLogs` always allocates new array. `useDeleteAllSyncedData` properly wraps mutation.                                                                                               |
| `src/pages/Archive.tsx`                                | Trivial link change. No issue.                                                                                                                                                                                            |
| `src/pages/Patterns.tsx`                               | **Medium (M4):** Sequential AI API calls. Calls `buildHabitHistoryCompatBackfill` (C2).                                                                                                                                   |
| `src/pages/Settings.tsx`                               | Major refactor to drawer-based architecture. Clean decomposition.                                                                                                                                                         |
| `src/pages/Track.tsx`                                  | **High (H1):** Inline closures passed as props. **Medium (M5, M8):** Compat scan on every render. Duplicate component rendering for responsive layout. **Low (L1, L2, L5):** Timer closures, stale range, import cascade. |
| `src/routeTree.tsx`                                    | Routing changes. No performance concern.                                                                                                                                                                                  |
| `src/store.ts`                                         | **Low (L9):** Double normalization in migration. Store structure is clean. Zustand subscriptions are properly scoped.                                                                                                     |
| `src/index.css`                                        | **Low (L7):** Animations use GPU-composited properties. Good practice. New CSS variables are purely declarative.                                                                                                          |
