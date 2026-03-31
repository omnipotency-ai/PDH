# Special Report: Impact on Habit Tracking & Quick Capture

**Date:** 2026-02-28
**Scope:** All findings from the 8-report codebase audit that affect the habit tracking or quick capture processes and UI

---

## Executive Summary

The habit tracking and quick capture systems are among the most affected areas of the codebase. **23 findings** from the consolidated audit directly impact these features. The most critical issues are:

1. **Track.tsx (832 lines)** is the orchestrator for both habit tracking and quick capture — it's oversized and mixes business logic with UI
2. **TodayLog.tsx (3,149 lines)** renders all logged habits and is the largest god component
3. **`computeTodayHabitCounts` is duplicated** with different behavior between Track.tsx and DailyProgress.tsx (one has an upper bound check, the other doesn't)
4. **`isCaffeineHabit` exists in 3 copies** with different function names
5. **Celebration/cap threshold logic** is duplicated and overly complex within `handleQuickCaptureTap`
6. **The deprecated habit filtering** (`isDeprecatedHabitId`) runs at 13 call sites on every operation

---

## Findings Affecting Habit Tracking

### CRITICAL

#### 1. Track.tsx — Quick Capture Orchestration Too Complex

**File:** `src/pages/Track.tsx` (832 lines)
**Impact:** The `handleQuickCaptureTap` function (lines 530-660) is a 100+ line callback that handles:
- Fluid logging for fluid-type habits
- Activity logging for walking habits
- Habit increment dispatching
- Target-met celebration checking
- Cap-exceeded warning checking
- Caffeine-specific entry counting
- AI coaching refresh

This single function is the heart of quick capture and it mixes data mutations with UI feedback (toasts, celebrations). Any bug in this function affects all quick capture interactions.

**Risk:** A regression in celebration logic could cause missed celebrations (user motivation impact) or false celebrations. The caffeine cap logic has special-case branching that's easy to break.

**Recommendation:** Extract into a `useQuickCapture` hook with sub-functions: `logFluidHabit()`, `logCounterHabit()`, `checkAndCelebrate()`, `checkCapExceeded()`.

---

#### 2. TodayLog.tsx — Habit Display God Component

**File:** `src/components/track/TodayLog.tsx` (3,149 lines)
**Impact on habits:** Contains:
- `CounterHabitRow` component (~100 lines) — renders counter-type habit groups
- `EventHabitRow` component (~80 lines) — renders event-type habit groups
- `HabitSubRow` component (~60 lines) — renders individual habit log entries
- Walking habit/activity backward-compat merge (lines 155-165) — `TEMP BACKWARD-COMPAT` code
- `isWalkingHabitLog`, `isWalkingHabitConfig`, `getWalkEntryDurationMinutes` helper functions solely for backward compat

The habit-related components within TodayLog are tightly coupled to the parent's 20+ useState hooks and the `onSave`/`onDelete` callbacks drilled through props.

---

### HIGH

#### 3. `computeTodayHabitCounts` Duplicated with Different Behavior

**Files:**
- `src/pages/Track.tsx:73` — filters by `todayStart` AND `todayEnd`
- `src/components/DailyProgress.tsx:22` — filters by `todayStart` ONLY (no upper bound)

**Risk to habit tracking:** The DailyProgress version could count future-timestamped habit logs, leading to inflated counts. The Track.tsx version is more correct. Both are used to determine whether habit targets/caps have been reached, which directly affects celebration triggers and UI state.

**Recommendation:** Consolidate into `src/lib/habitAggregates.ts` using the Track.tsx version (with upper bound).

---

#### 4. `isCaffeineHabit` Duplicated in 3 Files

**Files:**
- `src/lib/habitProgress.ts:27` — `isCaffeineHabit(habit)`
- `src/lib/habitCoaching.ts:18` — `isCoffeeFluidHabit(habit)` (different name, same logic)
- `src/pages/Track.tsx:629` — inline `const isCaffeine = ...`

**Risk to habit tracking:** Caffeine habits have special behavior — they use fluid ml for progress tracking instead of tap count, and they have cap-exceeded warnings. If the detection logic changes (e.g., adding tea as caffeine), all 3 copies must be updated.

**Recommendation:** Export `isCaffeineHabit` from `src/lib/habitTemplates.ts` alongside existing predicates.

---

#### 5. Celebration Logic Duplicated Between Handlers

**File:** `src/pages/Track.tsx`
**Lines:** ~530-660 (`handleQuickCaptureTap`) and ~493-510 (`handleLogSleepQuickCapture`)

The target-met celebration check is duplicated between these two handlers:
```typescript
if (isTargetHabit(habit) && habit.dailyTarget) {
  const checkValue = habit.logAs === "fluid" ? newFluidMl : newCount * habit.quickIncrement;
  const prevValue = ...;
  if (checkValue >= habit.dailyTarget && prevValue < habit.dailyTarget) {
    // celebrate
  }
}
```

**Risk:** The celebration threshold logic is complex (fluid vs counter, target vs cap, streak-aware) and maintaining it in 2+ places risks divergence.

**Recommendation:** Extract `checkAndCelebrate(habit, prevValue, newValue, streakSummary)` helper.

---

#### 6. Deprecated Habit Filtering at 13 Call Sites

**Files:** `src/store.ts` (8 sites), `src/lib/sync.ts` (5 sites)

Every habit operation (add, update, log, sync read, sync write) filters out `habit_teeth_brushing` and `habit_shower`. This is 13 `.filter(h => !isDeprecatedHabitId(h.id))` calls that run on every user interaction.

**Risk to performance:** Each quick capture tap triggers habit log addition → deprecated filter. Each sync cycle → deprecated filter on all habits. This is micro-overhead but conceptually wasteful.

**Recommendation:** Verify Convex data is clean, then remove all 13 filter calls. Keep one safety filter in the store migration for one more cycle.

---

#### 7. HabitDetailSheet Oversized (596 lines)

**File:** `src/components/track/HabitDetailSheet.tsx`

This sheet handles habit detail display, progress visualization, AI coaching snippets, and target/cap settings editing. It manually branches between Drawer (mobile) and Dialog (desktop) instead of using the existing `ResponsiveShell` component.

**Impact on habits:** This is the primary habit inspection/configuration UI. Its complexity makes it harder to add new habit features (e.g., habit history charts, export).

---

### MODERATE

#### 8. Caffeine Cup Calculation in 4 Locations

**Files:**
- `src/components/DailyProgress.tsx:39` — `toDisplayUnits`
- `src/lib/habitProgress.ts:34` — `getCaffeineCapEntries`
- `src/lib/habitCoaching.ts:26` — `toCoffeeCupCount`
- `src/pages/Track.tsx:634` — inline calculation

All divide raw ml by `quickIncrement` to convert to cup count, but with different function names and signatures.

---

#### 9. `normalizeHabitConfig` Old-Format Migration Branch

**File:** `src/lib/habitTemplates.ts:283-329`

The second half of this function (~35 lines) migrates from an old habit format that used `dailyGoal` instead of `dailyTarget`/`dailyCap`. This runs on every call to `normalizeHabitConfig`, including habit updates. The `fluidDefaults` parameter exists solely for this migration path.

---

#### 10. Walking Habit/Activity Backward-Compat Merge

**File:** `src/components/track/TodayLog.tsx:155-165`

The `TEMP BACKWARD-COMPAT` code merges walking habit taps into walk activity display groups. Supporting functions: `isWalkingHabitLog`, `isWalkingHabitConfig`, `getWalkEntryDurationMinutes`.

**Product decision needed:** Should walking be a habit (via tile) or an activity (via activity section)? Once decided, migrate legacy data and remove the compat code.

---

#### 11. Long-Press Pattern Duplicated in 3 Components

**Files:**
- `src/components/track/QuickCaptureTile.tsx:50-100`
- `src/components/track/WeightEntryDrawer.tsx:105-147`
- `src/components/track/SleepEntryDrawer.tsx` (similar pattern)

The long-press detection (pointerDown timer → pointerUp check → cleanup) is used for opening habit detail sheets from quick capture tiles.

**Recommendation:** Extract `useLongPress(callback, options)` hook.

---

#### 12. LegacyEarnedBadges — Stored But Never Read

**File:** `src/lib/streaks.ts:7-21`

Badge values (`firstLog`, `tenthLog`, `weekStreak`, etc.) are tracked in gamification state but never displayed or used to trigger anything. The celebrations system uses streak-based logic instead.

**Impact on habits:** Users completing habit milestones may expect badge recognition. The data exists but the feature is incomplete.

---

#### 13. Prop Drilling from Track.tsx to Habit Components

**Chain:** `Track.tsx → QuickCapture → QuickCaptureTile` passes 8+ props including `habits`, `todayHabitCounts`, `todayFluidMl`, `todayFluidEntryCounts`, `onTap`, `onLogSleepHours`, `onLogWeightKg`, `onLongPress`.

Similarly, `Track.tsx → HabitDetailSheet` passes `habit`, `count`, `fluidMl`, `daySummaries`, `streakSummary`, `onClose`.

**Recommendation:** Consider a `DayStatsContext` or `useTrackPageState` hook consumed directly by children.

---

#### 14. `DailyProgress.tsx` — Possibly Dead Component

**File:** `src/components/DailyProgress.tsx`

Contains its own `computeTodayHabitCounts` and `getHabitGoal` functions. May not be rendered anywhere — Track.tsx uses `QuickCapture` and `TodayStatusRow` instead.

**Action:** Verify if this component is actually mounted. If dead, delete it (and the duplicate `computeTodayHabitCounts` goes with it).

---

### LOW

#### 15. `isDigestiveHabit` Exported But Never Used

**File:** `src/lib/habitTemplates.ts:77` — Predicate function exists but is never called.

#### 16. `inferHabitType` Only Used Internally

**File:** `src/lib/habitTemplates.ts:62` — Exported but only used within the same file.

#### 17. `getHabitIcon` Uses Long If-Chain

**File:** `src/lib/habitIcons.tsx:20-63` — 14-clause if chain mapping habit IDs/types to icons. Could be a lookup map but is acceptable.

#### 18. Habit Coaching Validation Verbose

**File:** `src/lib/habitCoaching.ts:596-613` — Long type assertion chain could be simplified with a single cast.

#### 19. `useCoaching` Hook Excessive Refs

**File:** `src/hooks/useCoaching.ts` — 6 separate `useRef` instances mirroring reactive state. Should use a single grouped ref object.

#### 20. `useAiInsights` Hook Excessive Refs

**File:** `src/hooks/useAiInsights.ts` — 11 separate `useRef` instances. Same fix as above.

---

## Quick Capture UI Flow — Risk Map

```
User taps Quick Capture tile
  → QuickCaptureTile.tsx (long-press detection ← duplicated pattern)
    → Track.tsx handleQuickCaptureTap (100+ lines, mixed concerns)
      → store.addHabitLog (deprecated habit filter runs)
      → sync.ts write (deprecated habit filter runs again)
      → celebration check (duplicated logic)
      → cap exceeded check (caffeine special case ← 3 copies of detection)
      → AI coaching refresh
  → TodayLog.tsx re-renders (3,149 line component)
    → groupLogEntries runs (170 lines, walking compat merge)
    → CounterHabitRow / EventHabitRow renders
```

**Key risks in this flow:**
1. The deprecated habit filter runs TWICE per tap (store + sync)
2. Caffeine detection uses an inline copy instead of the shared function
3. Celebration logic is duplicated with sleep handler
4. TodayLog re-render processes 3,149 lines of code

---

## Recommended Remediation Order (Habit-Specific)

| Priority | Finding | Effort | Impact on Habit UX |
|----------|---------|--------|--------------------|
| 1 | Extract `isCaffeineHabit` to habitTemplates.ts | Tiny | Prevents detection drift |
| 2 | Consolidate `computeTodayHabitCounts` | Small | Fixes potential count bug |
| 3 | Extract `checkAndCelebrate` helper | Small | Prevents celebration drift |
| 4 | Extract `useQuickCapture` hook from Track.tsx | Medium | Isolates quick capture logic |
| 5 | Remove deprecated habit filtering (after data verification) | Small | Removes 13 filter calls |
| 6 | Extract `useLongPress` hook | Small | DRYs up tile interaction |
| 7 | Centralize caffeine cup calculation | Small | Single source of truth |
| 8 | Decompose TodayLog habit components | Large | Maintainability |
| 9 | Remove walking compat merge (after product decision) | Medium | Simplifies grouping |
| 10 | Remove normalizeHabitConfig old format (after data verification) | Medium | Simplifies habit creation |
