Perfect! Now I have a complete picture. Let me compile the comprehensive research findings:

## WQ-198: Legacy Activity Sleep Readers — Research Findings

### Executive Summary

All sleep-related code has **successfully migrated from legacy patterns to the current canonical architecture**. There are **NO legacy sleep readers remaining** in the active codebase. Sleep is now exclusively handled via activity logs with `activityType: "sleep"`.

---

### Architecture Overview

**Current (Correct) Pattern:**
- Sleep data is stored as **activity logs** with `activityType: "sleep"` and `durationMinutes` field
- Sleep habits are identified by `habitType: "sleep"` in the habit configuration
- Derived habit logs are built from activity logs by the `rebuildHabitLogsFromSyncedLogs()` function

**Legacy Pattern (Migrated):**
- Top-level log type `"sleep"` with fields like `sleepStartAt`, `wakeAt`, `wakeOffsetHours`
- This pattern has been fully normalized via migration

---

### Sleep Reading Code Paths (Current)

#### 1. **Frontend Sleep Logging** (`src/hooks/useHabitLog.ts`)
**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/hooks/useHabitLog.ts`

Two handlers for sleep capture:
- **`handleLogSleepQuickCapture()`** (lines 211–372)
  - Converts hours to minutes: `const totalMinutes = Math.round(normalizedHours * 60)`
  - Creates activity log: `type: "activity", data: { activityType: "sleep", durationMinutes }`
  - Handles midnight crossing: splits sleep into two activity logs if it spans calendar days
  - Creates corresponding habit logs for each sleep habit found in `habits.filter((h) => h.habitType === "sleep")`
  - Returns values in hours for sleep habits (converted from minutes)

#### 2. **Frontend Activity Type Recognition** (`src/hooks/useHabitLog.ts:54–63`)
**Function:** `toActivityType(habit: HabitConfig): string`
```typescript
if (habit.habitType === "sleep") return "sleep";
```
Ensures activity logs created from sleep habits are tagged `activityType: "sleep"`

#### 3. **Frontend Day Stats Calculation** (`src/hooks/useDayStats.ts:46–86`)
**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/hooks/useDayStats.ts`

Daily habit counts aggregation:
- Line 73–86: Processes activity logs
  - `const activityType = toActivityTypeKey(String(log.data?.activityType ?? ""))`
  - If `activityType === "sleep"`, routes to all sleep-type habits
  - Converts `durationMinutes` to hours for sleep habits: `Math.round((durationMinutes / 60) * 100) / 100`
  - **CORRECT PATH:** Uses `log.data?.durationMinutes`, not legacy fields

#### 4. **Frontend Track Page** (`src/pages/Track.tsx:91–101`)
**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/pages/Track.tsx`

Activity deletion and habit matching:
- Lines 91–101: `getHabitsForActivityType()`
  - If `activityType === "sleep"`, filters habits by `isSleepHabit(habit)`
  - **CORRECT:** No legacy field reads
- Lines 447–460: Activity log deletion
  - Extracts `activityType` from `log.data?.activityType`
  - If sleep, removes all sleep habit logs with matching timestamp

#### 5. **Derived Habit Log Builder** (`src/lib/derivedHabitLogs.ts:130–160`)
**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/lib/derivedHabitLogs.ts`
**Tested by:** `/Users/peterjamesblizzard/projects/caca_traca/src/lib/__tests__/derivedHabitLogs.test.ts` (WQ-054 verified)

The canonical habit log rebuilder:
```typescript
if (log.type === "activity") {
  const activityType = normalizeActivityType(
    typeof log.data.activityType === "string" ? log.data.activityType : "",
  );
  const durationMinutes = Number(log.data.durationMinutes ?? 0);
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) continue;

  if (activityType === "sleep") {
    for (const habit of habits.filter((entry) => entry.habitType === "sleep")) {
      rebuilt.push({
        id: `derived:${log.id}:${habit.id}`,
        habitId: habit.id,
        value: getActivityHabitValue(habit, durationMinutes),
        source: "import",
        at: log.timestamp,
      });
    }
    continue;
  }
  // ... other activities
}
```
- **CORRECT:** Only reads `log.data.activityType` and `log.data.durationMinutes`
- **CORRECT:** No access to legacy fields

**Test Coverage (lines 596–624):**
```typescript
it("routes sleep activities to all sleep-type habits", () => {
  const habits = [
    { id: "habit_sleep", habitType: "sleep", unit: "hours", ... },
    { id: "habit_sleep_2", habitType: "sleep", unit: "hours", ... }
  ];
  const logs = [
    makeActivityLog("log1", 1000, { activityType: "sleep", durationMinutes: 120 })
  ];
  const result = rebuildHabitLogsFromSyncedLogs(logs, habits);
  expect(result[0].habitId).toBe("habit_sleep");
  expect(result[0].value).toBe(2); // 120 / 60 = 2 hours
  expect(result[1].habitId).toBe("habit_sleep_2");
});
```

#### 6. **Helper: Sleep Habit Detection** (`src/lib/habitTemplates.ts:155–157`)
```typescript
export function isSleepHabit(habit: HabitConfig): boolean {
  return habit.habitType === "sleep" || habit.id === "habit_sleep";
}
```
Used by:
- `src/pages/Track.tsx` (deletion, habit matching)
- `src/hooks/useDayStats.ts` (activity routing)
- `src/components/track/quick-capture/QuickCapture.tsx` (UI routing)
- `src/components/track/quick-capture/HabitDetailSheet.tsx` (drawer type)

---

### Backend Sleep Schema

#### Schema (`convex/schema.ts`)
**File:** `/Users/peterjamesblizzard/projects/caca_traca/convex/schema.ts`

Activity log data validator (lines 413–417):
```typescript
const activityLogDataValidator = v.object({
  activityType: v.string(),
  durationMinutes: v.optional(v.number()),
  feelTag: v.optional(v.string()),
});
```
- **CORRECT:** No legacy fields like `sleepStartAt`, `wakeAt`, `wakeOffsetHours`

#### Log Types (`convex/schema.ts:24–37`)
```typescript
type: v.union(
  v.literal("food"),
  v.literal("fluid"),
  v.literal("habit"),
  v.literal("activity"),
  v.literal("digestion"),
  v.literal("weight"),
  v.literal("reproductive"),
),
```
- **CORRECT:** No top-level `"sleep"` type (it was migrated to `"activity"`)

#### Habit Type Validator (`convex/validators.ts:19–23`)
```typescript
export const habitTypeValidator = v.union(
  v.literal("sleep"),
  v.literal("count"),
  v.literal("activity"),
  // ...
);
```
- `"sleep"` is a valid habit type, not a log type

---

### Migrations (Completed)

#### Migration 1: Legacy Top-Level Sleep Type Normalization
**File:** `/Users/peterjamesblizzard/projects/caca_traca/convex/migrations.ts:1239–1284`
**Function:** `normalizeLegacyTopLevelLogTypesV1()`

Converts legacy sleep logs to activity logs:
```typescript
if (type === "sleep") {
  const duration = Number(data.durationMinutes);
  await ctx.db.patch(log._id, {
    type: "activity",
    data:
      Number.isFinite(duration) && duration > 0
        ? { activityType: "sleep", durationMinutes: duration }
        : { activityType: "sleep" },
  });
  fixed++;
  continue;
}
```
- Converts `type: "sleep"` → `type: "activity"` with `activityType: "sleep"`
- Preserves `durationMinutes` if present

#### Migration 2: Activity Data Normalization
**File:** `/Users/peterjamesblizzard/projects/caca_traca/convex/migrations.ts:363–387`
**Function:** `normalizeActivityData()`

Drops legacy activity fields (lines 375–384):
```typescript
if (
  data.type !== undefined ||
  data.sleepStartAt !== undefined ||
  data.wakeAt !== undefined ||
  data.wakeOffsetHours !== undefined ||
  data.notes !== undefined ||
  data.paceTag !== undefined
) {
  fixes.droppedActivityLegacyFields += 1;
}
```
- **DETECTED LEGACY FIELDS:** `sleepStartAt`, `wakeAt`, `wakeOffsetHours` (mentioned in migration checklist)
- **ACTION TAKEN:** Counted and dropped during normalization
- **STATUS:** These fields are only referenced in the migration as legacy cleanup

---

### Profile Sleep Goal (Not Log Data)

**File:** `/Users/peterjamesblizzard/projects/caca_traca/convex/validators.ts:218–220`

Sleep goal is stored in user profile preferences, not in logs:
```typescript
export const sleepGoalValidator = v.object({
  targetHours: v.number(),
  nudgeTime: v.string(),
});
```

Used in:
- `convex/schema.ts:341` — `sleepGoal: v.optional(sleepGoalValidator)`
- `convex/logs.ts:1030, 1083, 1177` — Profile sync
- `src/types/domain.ts:312` — User preferences

This is **independent of activity log sleep tracking**.

---

### E2E Test Coverage

**File:** `/Users/peterjamesblizzard/projects/caca_traca/e2e/sleep-tracking.spec.ts`

Three tests verify sleep UI and logging:
1. **sleep tile exists in Quick Capture** — UI presence
2. **tapping Sleep opens sleep entry drawer** — Hours/Minutes inputs visible
3. **can select hours and minutes and log sleep** — E2E flow verification

Tests use native time inputs and verify popover lifecycle. **No legacy field assertions.**

---

### Unit Test Coverage for Sleep Reconstruction

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/lib/__tests__/derivedHabitLogs.test.ts`

Tests that verify sleep-specific behavior (from grep results):
- **Line 215–217:** Tests sleep habit type validation
- **Lines 317–329:** Sleep habit log creation from activity logs
- **Lines 517–534:** Sleep template resolution
- **Lines 596–624:** Sleep activity routing to multiple sleep habits
- **Lines 954–972:** Sleep fallback template matching
- **Lines 1044–1055:** Sleep activity resolution against real templates

**All tests use:**
- `makeActivityLog(..., { activityType: "sleep", durationMinutes: X })`
- **No legacy field usage**

---

### Summary Table: All Sleep Reading Code Paths

| Component | File | Code Path | Current Status | Legacy Risk |
|-----------|------|-----------|-----------------|------------|
| Quick Sleep Capture | `src/hooks/useHabitLog.ts:211–372` | Creates activity logs with `activityType: "sleep"` | ✅ Current | None |
| Day Stats Aggregation | `src/hooks/useDayStats.ts:73–86` | Reads `log.data?.activityType` and `log.data?.durationMinutes` | ✅ Current | None |
| Track Page Deletion | `src/pages/Track.tsx:447–460` | Reads `log.data?.activityType` from activity logs | ✅ Current | None |
| Track Page Activity Routing | `src/pages/Track.tsx:91–101` | Routes by `activityType === "sleep"` | ✅ Current | None |
| Derived Habit Logs | `src/lib/derivedHabitLogs.ts:130–160` | Reads `log.data.activityType` and `log.data.durationMinutes` | ✅ Current | None |
| Habit Detection | `src/lib/habitTemplates.ts:155–157` | Filters by `habitType === "sleep"` | ✅ Current | None |
| Schema Validation | `convex/schema.ts:413–417` | Activity log validator (no legacy fields) | ✅ Current | None |
| Legacy Normalization | `convex/migrations.ts:1250–1258` | Migrates `type: "sleep"` → `type: "activity"` | ✅ Completed | None |
| Activity Data Cleanup | `convex/migrations.ts:375–384` | Detects and drops legacy fields (`sleepStartAt`, `wakeAt`, `wakeOffsetHours`) | ✅ Completed | None |

---

### Conclusion

**NO LEGACY SLEEP READERS REMAIN.** All code paths have been successfully migrated to the canonical pattern:
- Activity logs with `type: "activity"` and `data: { activityType: "sleep", durationMinutes }`
- Sleep habit detection via `habit.habitType === "sleep"`
- Habit log derivation via `rebuildHabitLogsFromSyncedLogs()` (tested in WQ-054)

Legacy fields (`sleepStartAt`, `wakeAt`, `wakeOffsetHours`) are only mentioned in migration cleanup code and have been removed from all active code paths. The migration infrastructure detects and drops any remaining legacy data during normalization.

**WQ-198 can be marked RESOLVED — no code changes needed.**