# Backdate Quick Capture + Panel Time Input Unification

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** When the user navigates to a past day, all logging paths (quick capture + left-column panels) stamp entries to that day. Panels adopt native `<input type="time">` (same keyboard UX as edit mode). Fluids get a time input. Enter in any time/date input saves. Sleep split timestamps are fixed.

**Architecture:** `dayOffset` already drives the log view; we extend it to drive log creation. `Track.tsx` computes `captureTimestamp` (today's wall-clock time mapped onto the selected date) and threads it to `useQuickCapture` and the three panels. A single `usePanelTime` hook replaces `useTimePicker` across all panels. Quick capture uses a `captureNow` ref in `useHabitLog` — one local function, no per-handler `useCallback` dep changes. Panels replace the custom `TimeInput` component with native `<input type="time">`, consistent with `EditableEntryRow`.

**Tech Stack:** React, TypeScript, Tailwind v4, date-fns, Sonner toasts

---

## Key Facts (read before touching code)

- `dayOffset` in `Track.tsx`: `0` = today, negative = past days.
- `selectedStart` / `selectedEnd` = boundaries of the selected day (already computed).
- `todayStart` = midnight of _actual_ today — used for day stats and destructive habit rollover. **Do not change these usages.**
- `captureTimestamp` formula: `selectedStart + (now.getTime() - todayStart)` — today's wall-clock time mapped onto the selected date. `undefined` when `dayOffset === 0` (falls back to `Date.now()`).
- The custom `TimeInput` component + `useTimePicker` hook are used only in the three panels. `EditableEntryRow` (edit mode) already uses native `<input type="date">` / `<input type="time">`. We unify to native inputs everywhere.
- `handleLogFluid` in `Track.tsx` already has signature `(name, ml, timestamp?, skipHabitLog?)`. `FluidSection`'s prop type needs updating to expose the `timestamp` param.
- Sleep split: the "today portion" should be stamped at `wakeTime` (actual wake time), and the "yesterday portion" at `captureStart - 1` (23:59:59.999 of previous day). Currently both are wrong (today portion → midnight, yesterday portion → sleep start).

---

## Task 1: `captureNow` ref + sleep split fix in `useHabitLog`

**File:** `src/hooks/useHabitLog.ts`

This task uses a stable ref to avoid touching any existing `useCallback` dep arrays.

**Step 1: Add four new optional fields to `UseHabitLogOptions` (after `onRequestEdit` on line 24)**

```typescript
  captureTimestamp?: number;
  captureStart?: number;
  captureEnd?: number;
  captureOffset?: number;
```

**Step 2: Destructure them in the hook signature (after existing destructured params)**

```typescript
  captureTimestamp: captureTimestampProp,
  captureStart: captureStartProp,
  captureEnd: captureEndProp,
  captureOffset = 0,
```

**Step 3: Add the ref + helper immediately after the `healthProfileRef` block (around line 91)**

```typescript
// Capture timestamp ref — stable reference, no useCallback dep changes needed.
// When dayOffset === 0 this is undefined and captureNow() falls back to Date.now().
const captureTimestampRef = useRef<number | undefined>(captureTimestampProp);
captureTimestampRef.current = captureTimestampProp;

const captureNow = useCallback(
  () => captureTimestampRef.current ?? Date.now(),
  [],
);
const captureStart = captureStartProp ?? todayStart;
const captureEnd = captureEndProp ?? todayEnd;
```

**Step 4: Replace `Date.now()` in handler bodies with `captureNow()`**

Handlers that need changing (each has one `const timestamp = Date.now()` or equivalent):

- `handleLogSleepQuickCapture` line 201: `const wakeTime = Date.now()` → `const wakeTime = captureNow()`
- `handleLogActivityQuickCapture` line 363: `const timestamp = Date.now()` → `const timestamp = captureNow()`
- `handleLogWeightKg` line 448: `timestamp: Date.now()` → `timestamp: captureNow()`
- `handleCheckboxToggle` line 511: `const timestamp = Date.now()` → `const timestamp = captureNow()`
- `handleQuickCaptureTap` line 576: `const timestamp = Date.now()` → `const timestamp = captureNow()`

> `handleLogFluid` (line 98) and `handleIncrementHabit` (line 169) use `Date.now()` as default param values only — these are called externally with explicit timestamps, so leave them untouched.

**Step 5: Fix `todayStart` / `todayEnd` references in sleep and checkbox**

In `handleLogSleepQuickCapture`:

- Line 207: `if (sleepStart < todayStart)` → `if (sleepStart < captureStart)`
- Line 208: `Math.round((wakeTime - todayStart) / 60_000)` → `Math.round((wakeTime - captureStart) / 60_000)`

In `handleCheckboxToggle`:

- Line 496–500 filter: `entry.timestamp >= todayStart && entry.timestamp < todayEnd` → `>= captureStart && < captureEnd`

**Step 6: Fix sleep split timestamps (correctness bug, independent of backdate feature)**

Current (wrong):

```typescript
// "today portion" stamped at midnight
timestamp: todayStart,
// "yesterday portion" stamped at sleep start (e.g. 22:00)
timestamp: sleepStart,
```

Correct:

```typescript
// "today portion" stamped at actual wake time (e.g. 02:00)
timestamp: wakeTime,
// "yesterday portion" stamped at end of previous day (23:59:59.999)
timestamp: captureStart - 1,
```

Replace in the `await Promise.all([...])` block (lines ~211–222):

- `timestamp: todayStart` → `timestamp: wakeTime`
- `timestamp: sleepStart` → `timestamp: captureStart - 1`

**Step 7: Update `onRequestEdit` signature and all callsites**

Interface change:

```typescript
onRequestEdit: (logId: string, captureOffset?: number) => void;
```

Add second argument at every `onRequestEdit(id)` call (7 total) → `onRequestEdit(id, captureOffset)`:

- handleLogFluid ~line 143
- handleLogSleepQuickCapture (split) ~line 282
- handleLogSleepQuickCapture (single) ~line 335
- handleLogActivityQuickCapture ~line 422
- handleLogWeightKg ~line 479
- handleCheckboxToggle ~line 544
- handleQuickCaptureTap ~line 648

**Step 8: Add `captureNow` to `useHabitLog` return value for use by panels (optional — see Task 4)**

No return value change needed; panels get `captureTimestamp` directly from Track.tsx.

**Step 9: Typecheck**

```bash
bun run typecheck
```

Expected: zero new errors (all new fields are optional).

**Step 10: Commit**

```bash
git add src/hooks/useHabitLog.ts
git commit -m "feat: captureNow ref + sleep split fix + backdate params in useHabitLog"
```

---

## Task 2: Thread capture params through `useQuickCapture`

**File:** `src/hooks/useQuickCapture.ts`

**Step 1: Add optional fields to `UseQuickCaptureOptions`**

After `onRequestEdit`:

```typescript
  captureTimestamp?: number;
  captureStart?: number;
  captureEnd?: number;
  captureOffset?: number;
```

**Step 2: Destructure and pass to `useHabitLog`**

Add to destructure:

```typescript
  captureTimestamp,
  captureStart,
  captureEnd,
  captureOffset,
```

In the `useHabitLog({...})` call, add:

```typescript
    ...(captureTimestamp !== undefined && { captureTimestamp }),
    ...(captureStart !== undefined && { captureStart }),
    ...(captureEnd !== undefined && { captureEnd }),
    ...(captureOffset !== undefined && { captureOffset }),
```

**Step 3: Typecheck + commit**

```bash
bun run typecheck
git add src/hooks/useQuickCapture.ts
git commit -m "feat: thread capture params through useQuickCapture"
```

---

## Task 3: Compute + wire `captureTimestamp` in `Track.tsx`

**File:** `src/pages/Track.tsx`

**Step 1: Compute `captureTimestamp` after the `selectedEnd` line (~line 148)**

```typescript
// undefined when on today → useHabitLog falls back to Date.now() at invocation time.
const captureTimestamp = useMemo(
  () =>
    dayOffset === 0 ? undefined : selectedStart + (now.getTime() - todayStart),
  [dayOffset, selectedStart, now, todayStart],
);
```

**Step 2: Pass capture params to `useQuickCapture` (lines 281–293)**

```typescript
    ...(captureTimestamp !== undefined && { captureTimestamp }),
    ...(dayOffset !== 0 && { captureStart: selectedStart }),
    ...(dayOffset !== 0 && { captureEnd: selectedEnd }),
    ...(dayOffset !== 0 && { captureOffset: dayOffset }),
```

**Step 3: Update `handleRequestEdit` to navigate to the captured day**

```typescript
const handleRequestEdit = useCallback((logId: string, captureOffset = 0) => {
  setDayOffset(captureOffset);
  setAutoEditLogId(logId);
}, []);
```

**Step 4: Pass `captureTimestamp` to the three panels**

```tsx
  <FoodSection onLogFood={handleLogFood} captureTimestamp={captureTimestamp} />
  <FluidSection onLogFluid={handleLogFluid} captureTimestamp={captureTimestamp} />
  <BowelSection onSave={handleLogBowel} captureTimestamp={captureTimestamp} />
```

**Step 5: Replace the `quickCapture` variable with `quickCaptureSection` that includes the banner**

```tsx
const quickCaptureSection = (
  <div className="space-y-2">
    {dayOffset !== 0 && (
      <div
        role="alert"
        className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs"
      >
        <span className="font-medium text-amber-400">
          Logging for {format(selectedDate, "EEE d MMM")}
        </span>
        <button
          type="button"
          onClick={handleJumpToToday}
          className="shrink-0 text-amber-400/80 underline-offset-2 hover:text-amber-300 hover:underline"
        >
          Back to today
        </button>
      </div>
    )}
    <QuickCapture
      habits={habits}
      todayHabitCounts={todayHabitCounts}
      todayFluidMl={todayFluidTotalsByName}
      onTap={handleQuickCaptureTap}
      onLogSleepHours={handleLogSleepQuickCapture}
      onLogActivityMinutes={handleLogActivityQuickCapture}
      onLogWeightKg={handleLogWeightKg}
      onLongPress={handleQuickCaptureLongPress}
    />
  </div>
);
```

Replace all three usages of `{quickCapture}` in the JSX with `{quickCaptureSection}`.

**Step 6: Typecheck + commit**

```bash
bun run typecheck
git add src/pages/Track.tsx
git commit -m "feat: wire captureTimestamp to panels + backdate banner in Track.tsx"
```

---

## Task 4: Create `usePanelTime` hook

**File:** `src/hooks/usePanelTime.ts` (new file)

This replaces `useTimePicker` in all three panels. Uses the capture timestamp as the date base, with an optional user-specified time overlay.

```typescript
import { useCallback, useState } from "react";

/**
 * Manages the time input state for a logging panel.
 *
 * When captureTimestamp is provided (backdating), the final timestamp uses
 * the capture date + user's entered time. When absent, uses Date.now().
 *
 * Returns a native <input type="time"> compatible value (HH:mm or "").
 */
export function usePanelTime(captureTimestamp?: number) {
  const [timeValue, setTimeValue] = useState("");

  const getTimestampMs = useCallback((): number => {
    const base = captureTimestamp ?? Date.now();
    if (!timeValue) return base;
    const [h, m] = timeValue.split(":").map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return base;
    const d = new Date(base);
    return new Date(
      d.getFullYear(),
      d.getMonth(),
      d.getDate(),
      h,
      m,
      0,
      0,
    ).getTime();
  }, [captureTimestamp, timeValue]);

  const reset = useCallback(() => setTimeValue(""), []);
  const isEdited = timeValue !== "";

  return { timeValue, setTimeValue, isEdited, getTimestampMs, reset };
}
```

**Typecheck + commit:**

```bash
bun run typecheck
git add src/hooks/usePanelTime.ts
git commit -m "feat: add usePanelTime hook (replaces useTimePicker in panels)"
```

---

## Task 5: Update `FoodSection`

**File:** `src/components/track/panels/FoodSection.tsx`

FoodSection already has time input logic. We replace `useTimePicker` with `usePanelTime`, switch `TimeInput` to native `<input type="time">`, add `captureTimestamp` prop, and add Enter-saves behaviour.

**Step 1: Update props interface**

Add to the props interface (or function params if not typed):

```typescript
  captureTimestamp?: number;
```

**Step 2: Replace `useTimePicker` import with `usePanelTime`**

Remove:

```typescript
import { useTimePicker } from "@/hooks/useTimePicker"; // or wherever it's imported
```

Add:

```typescript
import { usePanelTime } from "@/hooks/usePanelTime";
```

**Step 3: Replace `useTimePicker()` call**

```typescript
const { timeValue, setTimeValue, isEdited, getTimestampMs, reset } =
  usePanelTime(captureTimestamp);
```

**Step 4: Replace `TimeInput` with native `<input type="time">`**

Find the `<TimeInput ...>` JSX block and replace it with:

```tsx
<div className="flex items-center gap-1.5">
  {captureTimestamp !== undefined && (
    <span className="text-xs font-medium text-amber-400">
      {format(new Date(captureTimestamp), "d MMM")}
    </span>
  )}
  <input
    type="time"
    value={timeValue}
    onChange={(e) => setTimeValue(e.target.value)}
    onKeyDown={(e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void submitFood();
      }
    }}
    className="w-[4.5rem] rounded border border-[var(--color-border-default)] bg-[var(--surface-2)] px-1.5 py-0.5 text-xs tabular-nums text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
    aria-label="Log time"
  />
</div>
```

**Step 5: Update reset call**

Where `resetTime()` was called, call `reset()` instead.

**Step 6: Typecheck + commit**

```bash
bun run typecheck
git add src/components/track/panels/FoodSection.tsx
git commit -m "feat: replace TimeInput with native time input in FoodSection + captureTimestamp"
```

---

## Task 6: Update `FluidSection`

**File:** `src/components/track/panels/FluidSection.tsx`

FluidSection currently has **no time input at all**. We add one and update the prop signature.

**Step 1: Update props interface**

The `onLogFluid` prop needs to accept an optional timestamp:

```typescript
  onLogFluid: (name: string, milliliters: number, timestamp?: number) => Promise<string> | void;
  captureTimestamp?: number;
```

**Step 2: Add `usePanelTime`**

```typescript
import { usePanelTime } from "@/hooks/usePanelTime";
// also import format from date-fns if not already imported
```

```typescript
const { timeValue, setTimeValue, getTimestampMs, reset } =
  usePanelTime(captureTimestamp);
```

**Step 3: Update all `onLogFluid(...)` call sites to pass `getTimestampMs()`**

Find every `onLogFluid(name, ml)` call → `onLogFluid(name, ml, getTimestampMs())`.

After each successful log call, add `reset()`.

**Step 4: Add the time input to the JSX**

Find a suitable place near the fluid submit button/amount field and add:

```tsx
<div className="flex items-center gap-1.5">
  {captureTimestamp !== undefined && (
    <span className="text-xs font-medium text-amber-400">
      {format(new Date(captureTimestamp), "d MMM")}
    </span>
  )}
  <input
    type="time"
    value={timeValue}
    onChange={(e) => setTimeValue(e.target.value)}
    onKeyDown={(e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        // trigger the submit for whatever flow is active
      }
    }}
    className="w-[4.5rem] rounded border border-[var(--color-border-default)] bg-[var(--surface-2)] px-1.5 py-0.5 text-xs tabular-nums text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
    aria-label="Log time"
  />
</div>
```

> The Enter handler in FluidSection is more complex because there are two flows (preset buttons and custom drink). For the custom drink flow, wire Enter → `handleOtherSubmit()`. For the amount field flow, the existing Enter handler already submits; no change needed there.

**Step 5: Typecheck + commit**

```bash
bun run typecheck
git add src/components/track/panels/FluidSection.tsx
git commit -m "feat: add time input to FluidSection + captureTimestamp support"
```

---

## Task 7: Update `BowelSection`

**File:** `src/components/track/panels/BowelSection.tsx`

BowelSection already has time input (icon variant). We replace `useTimePicker` with `usePanelTime` and switch to native input.

**Step 1: Update props**

```typescript
  captureTimestamp?: number;
```

**Step 2: Replace `useTimePicker` with `usePanelTime`**

```typescript
import { usePanelTime } from "@/hooks/usePanelTime";

const { timeValue, setTimeValue, isEdited, getTimestampMs, reset } =
  usePanelTime(captureTimestamp);
```

**Step 3: Replace `TimeInput` with native `<input type="time">`**

Replace the `<TimeInput ...>` JSX block:

```tsx
<div className="flex items-center gap-1.5">
  {captureTimestamp !== undefined && (
    <span className="text-xs font-medium text-amber-400">
      {format(new Date(captureTimestamp), "d MMM")}
    </span>
  )}
  <input
    type="time"
    value={timeValue}
    onChange={(e) => setTimeValue(e.target.value)}
    onKeyDown={(e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void handleSave();
      }
    }}
    className="w-[4.5rem] rounded border border-[var(--color-border-default)] bg-[var(--surface-2)] px-1.5 py-0.5 text-xs tabular-nums text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
    aria-label="Log time"
  />
  {isEdited && (
    <span className="text-xs text-[var(--text-muted)]">Backdated</span>
  )}
</div>
```

**Step 4: Update timestamp construction in `handleSave`**

Where `getTimestampMs()` is called to build `timestampMs`, ensure it now goes through `usePanelTime`'s version (this should be automatic since we renamed the hook).

**Step 5: Update reset call**

`resetTime()` → `reset()`.

**Step 6: Typecheck + commit**

```bash
bun run typecheck
git add src/components/track/panels/BowelSection.tsx
git commit -m "feat: replace TimeInput with native time input in BowelSection + captureTimestamp"
```

---

## Task 8: Enter key saves in `EditableEntryRow` date/time inputs

**File:** `src/components/track/today-log/editors/EditableEntryRow.tsx`

Currently the date and time `<input>` elements have no Enter key handler. Add one to both.

**Step 1: Find the date input (around line 134)**

Add `onKeyDown`:

```tsx
<input
  type="date"
  value={draftDate}
  onChange={(e) => setDraftDate(e.target.value)}
  onKeyDown={(e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleSave();
    }
  }}
  // ... existing className
/>
```

**Step 2: Find the time input (around line 141)**

Add the same `onKeyDown`:

```tsx
<input
  type="time"
  value={draftTime}
  onChange={(e) => setDraftTime(e.target.value)}
  onKeyDown={(e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleSave();
    }
  }}
  // ... existing className
/>
```

**Step 3: Typecheck + commit**

```bash
bun run typecheck
git add src/components/track/today-log/editors/EditableEntryRow.tsx
git commit -m "feat: Enter key saves in EditableEntryRow date/time inputs"
```

---

## Task 9: Full check + smoke test

**Step 1:**

```bash
bun run typecheck && bun run lint:fix
```

Re-read any files Biome reformats.

**Step 2: Manual smoke test**

```bash
bun run dev
```

Test cases:

| Scenario                                      | Expected                                                                  |
| --------------------------------------------- | ------------------------------------------------------------------------- |
| Today, quick capture tile                     | Entry stamped at current time, no banner                                  |
| Navigate to yesterday via TodayLog `<` button | Amber banner appears above quick capture                                  |
| Tap quick capture tile while on yesterday     | Entry in yesterday's log at ~current wall-clock time                      |
| Tap "Back to today"                           | Banner gone, today active                                                 |
| Tap "Edit" on backdated toast                 | Navigates to yesterday's log, entry in edit mode                          |
| Log 4h sleep at 2am (today)                   | Today portion stamped at 02:00; yesterday portion stamped at 23:59:59.999 |
| Log food with time set                        | Timestamp uses selected day + entered time                                |
| Log fluid with time set                       | Timestamp uses selected day + entered time                                |
| Log BM with time set                          | Timestamp uses selected day + entered time                                |
| Enter in date input (edit mode)               | Saves entry                                                               |
| Enter in time input (edit mode)               | Saves entry                                                               |
| Enter in time input (food panel)              | Submits food                                                              |
| Enter in time input (bowel panel)             | Submits BM                                                                |
| On today (dayOffset 0)                        | All panels show no date label, behaviour identical to before              |

**Step 3: Commit if Biome reformatted anything**

```bash
git add -p
git commit -m "style: biome format after panel time input + backdate changes"
```

---

## Work Queue Items Resolved by This Plan

| ID         | Title                   | Resolution                                                                                                                                                                                           |
| ---------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **WQ-119** | TimeInput Enter-to-save | Fully resolved — `TimeInput` is replaced with native `<input type="time">` in all panels; native inputs support Enter via `onKeyDown`. `EditableEntryRow` also gets explicit Enter-to-save (Task 8). |

## Work Queue Items That Touch the Same Files (coordinate before implementing)

| ID         | Title                                                             | File overlap       | Risk                                                                                                                                   |
| ---------- | ----------------------------------------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| **WQ-117** | Food section redesign (remove Food Badges title, simplify layout) | `FoodSection.tsx`  | Our Task 5 modifies FoodSection. Do WQ-117 in a separate branch first or after, not concurrently.                                      |
| **WQ-122** | BM layout rework (time before notes, 8-col grid)                  | `BowelSection.tsx` | Our Task 7 moves the time input. Do WQ-122 after this plan lands so it gets the new native input rather than the old TimeInput.        |
| **WQ-116** | Units not applied to fluids                                       | `FluidSection.tsx` | We update FluidSection's `onLogFluid` prop type. Don't hardcode `ml` in the timestamp logic — our `getTimestampMs()` is unit-agnostic. |

## Out of Scope

- `useTimePicker` and `TimeInput` can be deleted once all three panels are migrated — leave as dead code for now, remove in a cleanup PR.
- `todayHabitCounts` used in celebration checks is still "actual today" — goal celebrations on backdated entries may be slightly off. Acceptable for v1.
- `handleLogBowel` and `handleLogCycle` in Track.tsx use `Date.now()` directly, not `captureTimestamp`. These have their own date/time pickers in the panels (BowelSection has its time input, CycleHormonalSection is feature-flagged). Consistent with the panel approach taken here.
- No changes to `ObservationWindow` — read-only.
- **WQ-118** (weight target save bug — "180" vs "180.0") is tangentially related to Enter-to-save but is in `WeightEntryDrawer`, not touched by this plan.
