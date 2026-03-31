# Code Quality Audit

**Date:** 2026-02-27
**Scope:** All staged files (49 code files)
**Reviewer:** Claude Opus 4.6 -- Code Quality Specialist

## Executive Summary

This changeset is a substantial refactor (~9,000 lines added, ~3,200 removed) that modernizes the habit system from a `category/goalMode/dailyGoal` model to a cleaner `kind/dailyTarget/dailyCap` model, adds comprehensive health profile and AI preference settings, introduces Quick Capture with habit detail sheets, and adds digestive correlation analysis. The code is broadly competent and follows the project's "boring code" ethos, but there are several significant type safety gaps, duplicated logic patterns, and a few components that have grown large enough to warrant extraction.

## Critical Issues

### C-1. `v.any()` used for `aiPreferences` in Convex schema and mutation validator

**File:** `/Users/peterjamesblizzard/projects/caca_traca/convex/schema.ts` (line ~206), `/Users/peterjamesblizzard/projects/caca_traca/convex/logs.ts` (line ~392)

The `aiPreferences` field uses `v.any()` in both the schema and the `replaceProfile` mutation args. The project already has a pattern of defining strict validators in `convex/validators.ts`. Using `v.any()` means any shape can be written to the database, bypassing Convex's runtime validation and opening the door to corrupt data.

```typescript
// convex/schema.ts
aiPreferences: v.optional(v.any()),

// convex/logs.ts replaceProfile mutation
aiPreferences: v.optional(v.any()),
```

**Recommendation:** Define an `aiPreferencesValidator` in `convex/validators.ts` mirroring the `AiPreferences` interface from `src/store.ts`, and use it in both the schema and mutation args. The `sanitizeUnknownStringsDeep` call helps, but it is not a substitute for schema validation.

### C-2. `findHabitConfigForHabitLog` uses `any` type for `data` parameter

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/components/track/TodayLog.tsx` (line ~346)

```typescript
function findHabitConfigForHabitLog(habits: HabitConfig[], data: any): HabitConfig | null {
```

This function is used extensively throughout `TodayLog.tsx`. The `any` type defeats TypeScript's protections and could mask runtime errors.

**Recommendation:** Define a minimal interface for the habit log data shape:

```typescript
interface HabitLogData {
  habitId?: string;
  name?: string;
  habitType?: string;
  quantity?: number;
  action?: string;
}
```

### C-3. `storedProfileHabitsValidator` is `v.array(v.any())` -- overly permissive

**File:** `/Users/peterjamesblizzard/projects/caca_traca/convex/validators.ts` (line ~58)

```typescript
export const storedProfileHabitsValidator = v.array(v.any());
```

While the comment acknowledges this is for legacy compatibility, and server-side normalization (`normalizeStoredProfileHabits`) handles the data on read, this means any arbitrary data can be stored in the `habits` array of a profile document.

**Recommendation:** Consider a loose-but-bounded validator (e.g., `v.array(v.object({ name: v.string(), ...rest: v.any() }))`) or add a migration to normalize legacy data and then tighten the validator.

## High Severity

### H-1. Duplicated `normalizeFrequency` / `normalizeUsageFrequency` helper

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/components/settings/HealthForm.tsx` (lines 47-60), `/Users/peterjamesblizzard/projects/caca_traca/src/components/settings/AppDataForm.tsx` (lines 14-19)

Two nearly identical functions exist for normalizing usage frequency values:

```typescript
// AppDataForm.tsx
function normalizeUsageFrequency(value: unknown): UsageFrequencyChoice { ... }

// HealthForm.tsx
function normalizeFrequency(value: unknown): UsageFrequencyChoice { ... }
```

**Recommendation:** Extract a single `normalizeUsageFrequency` into a shared utility (e.g., `src/lib/healthProfileUtils.ts`) and import it from both files.

### H-2. HealthForm.tsx is 1010 lines -- god component

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/components/settings/HealthForm.tsx`

This component handles surgery details, demographics, conditions/comorbidities, medications, and lifestyle factors (smoking, alcohol, recreational substances, dietary history) all in one function. The render body alone is over 700 lines of JSX.

**Recommendation:** Extract each section into its own component:

- `SurgeryDetailsSection`
- `DemographicsSection`
- `ConditionsSection`
- `MedicationsSection`
- `LifestyleFactorsSection`
- `DietaryHistorySection`

Pass `healthProfile` and `setHealthProfile` as props.

### H-3. QuickCapture.tsx is 760 lines with deep state management

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/components/track/QuickCapture.tsx`

The component manages sleep entry, weight entry, weight settings, add-habit drawer, and the main tile grid all in one component with 10+ `useState` calls.

**Recommendation:** Extract `SleepEntryDrawer`, `WeightEntryDrawer`, and `WeightSettingsDrawer` into separate components to reduce cognitive load and improve testability.

### H-4. `inferLegacyHabitType` duplicated between `convex/logs.ts` and `src/lib/habitTemplates.ts`

**File:** `/Users/peterjamesblizzard/projects/caca_traca/convex/logs.ts` (lines 64-77), `/Users/peterjamesblizzard/projects/caca_traca/src/lib/habitTemplates.ts` (lines 62-73)

The pattern-matching logic for inferring a habit type from a name string is duplicated:

```typescript
// convex/logs.ts
function inferLegacyHabitType(name: string): string {
  const key = name.toLowerCase().trim();
  if (/cig|smok|nicotine/.test(key)) return "cigarettes";
  // ...
}

// src/lib/habitTemplates.ts
export function inferHabitType(key: string): HabitType {
  if (/cig|smok|nicotine/.test(key)) return "cigarettes";
  // ...
}
```

The Convex version includes extra categories (`hygiene`, `wellness`, `recovery`) that the client-side version dropped, meaning they can diverge silently.

**Recommendation:** If the Convex function cannot import from `src/lib/`, at minimum add a `// SYNC WITH src/lib/habitTemplates.ts:inferHabitType` comment and a unit test that asserts both functions produce the same outputs for the shared test cases.

### H-5. `useEffect` with missing dependency in Track.tsx

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/pages/Track.tsx` (around line ~245 in the diff)

```typescript
useEffect(() => {
  if (habitHistoryCompat.imports.length === 0) return;
  // ...
}, [habitHistoryCompat.imports, syncKey]);
```

The effect reads `useStore.setState` directly, which is fine, but the condition that determines whether to import is comparing against `lastHabitImportBatchKeyRef.current`. This pattern is correct but the toast `id` uses `syncKey` which is already in the dep array. No actual bug here, but the `useStore.setState` inside the effect is a side-channel write that bypasses the normal Zustand flow and could be confusing to future maintainers.

**Recommendation:** Add a clear comment explaining why `useStore.setState` is used directly instead of the `addHabitLog` action (presumably to batch-add without N intermediate renders).

### H-6. `Date.now()` used in `HABIT_TEMPLATES` object literal creates unstable references

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/lib/habitTemplates.ts` (lines 92+)

```typescript
export const HABIT_TEMPLATES: Record<string, HabitConfig> = {
  water: {
    // ...
    createdAt: Date.now(),
    // ...
  },
```

Every time this module is evaluated (app start), all templates get the same `createdAt` timestamp. But more problematically, if code ever compares template objects by reference or stringifies them for caching, the timestamp will differ between sessions.

**Recommendation:** Use a sentinel value like `0` or `-1` for template `createdAt`, and set the real timestamp only when a template is actually added to the user's habits via `addHabit`.

## Medium Severity

### M-1. Duplicated progress text / color logic between `HabitDetailSheet.tsx` and `QuickCaptureTile.tsx`

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/components/track/HabitDetailSheet.tsx` (lines 65-141), `/Users/peterjamesblizzard/projects/caca_traca/src/components/track/QuickCaptureTile.tsx` (lines 11-101)

Both files contain `getProgressText`, `getProgressBarColor`/`getTileColorTint`, and `shouldShowBadge` with substantial overlap. The logic for coffee cup formatting, cap/target comparison, and goal-met detection is repeated.

**Recommendation:** Extract shared helpers into `src/lib/habitProgress.ts` and import from both components.

### M-2. Repeated collapsible section pattern in HealthForm.tsx

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/components/settings/HealthForm.tsx`

Three sections (Conditions, Medications, Lifestyle) use identical toggle patterns:

```typescript
<div className="flex items-center justify-between">
  <p className="text-[11px] font-semibold uppercase ...">Title</p>
  <button
    type="button"
    aria-label={open ? "Collapse X" : "Expand X"}
    aria-expanded={open}
    onClick={() => setOpen((open) => !open)}
    className="inline-flex h-6 w-6 ..."
  >
    <ChevronRight className={`h-4 w-4 transition-transform ${open ? "rotate-90" : ""}`} />
  </button>
</div>
```

**Recommendation:** Extract a `CollapsibleSectionHeader` component that accepts `title`, `open`, `onToggle`, and optional `accentColor`.

### M-3. `deleteAllBySyncKey` in `convex/logs.ts` lacks pagination and could timeout

**File:** `/Users/peterjamesblizzard/projects/caca_traca/convex/logs.ts` (lines ~460-580)

The function uses `.collect()` on 10 different tables and deletes all rows in sequential for-loops. For a user with thousands of logs, this could exceed Convex's mutation time limit.

```typescript
const logs = await ctx.db.query("logs").withIndex(...).collect();
for (const row of logs) {
  await ctx.db.delete(row._id);
}
```

**Recommendation:** Either batch deletions using Convex's `internalMutation` with cursor-based pagination, or document the known limitation for heavy users. At minimum, add a comment noting the potential timeout risk.

### M-4. Magic number 300ms for long-press detection used in multiple files

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/components/track/QuickCaptureTile.tsx` (line 148), `/Users/peterjamesblizzard/projects/caca_traca/src/components/track/QuickCapture.tsx` (line 326)

```typescript
longPressTimerRef.current = setTimeout(() => { ... }, 300);
```

**Recommendation:** Extract `const LONG_PRESS_THRESHOLD_MS = 300` into a shared constant.

### M-5. `new Set(habits.map(h => h.id))` recreated on every render in QuickCapture

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/components/track/QuickCapture.tsx` (line 236)

```typescript
const existingHabitIds = new Set(habits.map((h) => h.id));
```

This is created in the component body (not inside `useMemo`), so it runs on every render.

**Recommendation:** Wrap in `useMemo`:

```typescript
const existingHabitIds = useMemo(
  () => new Set(habits.map((h) => h.id)),
  [habits],
);
```

### M-6. `TONE_MATRIX` could use template literal type for keys

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/lib/aiAnalysis.ts` (around line 330 in the diff)

```typescript
const TONE_MATRIX: Record<string, string> = { ... };
```

Using `Record<string, string>` means any key is valid, including typos. The lookup `TONE_MATRIX[\`${prefs.toneFriendliness}/${prefs.toneProfessionalism}\`]` has no compile-time safety.

**Recommendation:** Use a template literal type:

```typescript
type ToneKey = `${ToneFriendliness}/${ToneProfessionalism}`;
const TONE_MATRIX: Record<ToneKey, string> = { ... };
```

### M-7. `dateRange` in `AiSuggestionsCard` is only computed once

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/components/settings/AiSuggestionsCard.tsx` (lines 32-37)

```typescript
const dateRange = useMemo(() => {
  const today = new Date();
  // ...
}, []);
```

The empty dependency array means the range is computed once when the component mounts. If the component stays mounted past midnight, the range will be stale.

**Recommendation:** This is likely acceptable for a settings page, but add a comment explaining the intentional empty dependency.

### M-8. `HabitType` in `habitTemplates.ts` is missing types that exist in `convex/validators.ts`

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/lib/habitTemplates.ts` (lines 4-14)

The client-side `HabitType` is:

```typescript
export type HabitType =
  | "cigarettes"
  | "medication"
  | "rec_drugs"
  | "caffeine"
  | "confectionery"
  | "movement"
  | "hydration"
  | "alcohol"
  | "sleep"
  | "custom";
```

But the Convex validator in `convex/validators.ts` also includes `"sweets"`, `"hygiene"`, `"wellness"`, `"recovery"`:

```typescript
export const habitTypeValidator = v.union(
  v.literal("cigarettes"), v.literal("medication"), ...,
  v.literal("hygiene"), v.literal("wellness"), v.literal("recovery"),
  v.literal("hydration"), v.literal("alcohol"), v.literal("sleep"), v.literal("custom"),
);
```

Similarly the `KNOWN_HABIT_TYPES` set in `convex/logs.ts` includes all of these. Client code casting `String(habit.habitType) === "recovery"` in `habitIcons.tsx` (line 54) suggests legacy data exists with these types.

**Recommendation:** Either add these legacy types to the client-side `HabitType` or add a normalization step to the Convex `getProfile` handler that maps `hygiene/wellness/recovery` to appropriate modern types. The current mismatch means TypeScript will not catch comparisons against these legacy values.

### M-9. `onSave` in `ActivitySubRow` and multiple `TodayLog` subcomponents uses `data: any`

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/components/track/TodayLog.tsx` (multiple locations)

```typescript
onSave: (id: string, data: any, timestamp?: number) => Promise<void>;
```

The `data: any` parameter propagates throughout the file's callback chain.

**Recommendation:** Define a `LogData` union type or use `Record<string, unknown>` to maintain a minimal level of type checking.

## Low Severity / Informational

### L-1. `computeRangeDays` in `DigestiveCorrelationGrid.tsx` uses `new Date()` constructor with string concatenation

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/DigestiveCorrelationGrid.tsx` (lines 58-62)

```typescript
function computeRangeDays(start: string, end: string): number {
  const startMs = new Date(`${start}T00:00:00`).getTime();
  const endMs = new Date(`${end}T00:00:00`).getTime();
```

This creates dates in local timezone, which is the intended behavior, but `new Date("YYYY-MM-DDT00:00:00")` behavior can vary by browser. Consider using `parseISO` from `date-fns` which is already imported in the file.

### L-2. `setNumeric` in `HealthForm.tsx` uses `keyof typeof healthProfile` which is very broad

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/components/settings/HealthForm.tsx` (around line 280)

```typescript
const setNumeric = (raw: string, key: keyof typeof healthProfile) => {
  // ...
  setHealthProfile({ [key]: value } as Partial<typeof healthProfile>);
};
```

This allows calling `setNumeric("5", "surgeryType")` which would be a type error in practice but is not caught at compile time due to the `as` cast.

**Recommendation:** Narrow the `key` parameter to only numeric fields:

```typescript
type NumericHealthProfileKey = "smokingCigarettesPerDay" | "smokingYears" | "alcoholYearsAtCurrentLevel" | ...;
```

### L-3. Unused import `Sparkles` in `DailyProgress.tsx`

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/components/DailyProgress.tsx` (line 2)

The `Sparkles` icon is imported and used, so this is actually fine. (Verified it is used on line 141.)

### L-4. `celebrations.ts` uses `Math.random()` for message selection

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/lib/celebrations.ts` (line 41)

```typescript
const messageIndex = Math.floor(Math.random() * dailyMessages.length);
```

This means the same message could repeat frequently. Not a bug, but consider cycling through messages deterministically (e.g., based on day count) for better user experience.

### L-5. `useResponsiveShellMode` hook is duplicated between `responsive-shell.tsx` and `HabitDetailSheet.tsx`

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/components/ui/responsive-shell.tsx` (lines 32-53), `/Users/peterjamesblizzard/projects/caca_traca/src/components/track/HabitDetailSheet.tsx` (lines 40-61)

Both files have nearly identical `useResponsiveShellMode` / `useHabitDetailPresentationMode` hooks with the same breakpoint logic.

**Recommendation:** Extract a shared `useBreakpointMode` hook into `src/hooks/useBreakpointMode.ts`.

### L-6. `DEPRECATED_HABIT_IDS` uses `as any` cast

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/lib/deprecatedHabits.ts` (line 10)

```typescript
return typeof habitId === "string" && DEPRECATED_HABIT_IDS.has(habitId as any);
```

The `as any` is used because the `Set` is typed with `as const` string literals. This is a minor type escape hatch.

**Recommendation:** Type the Set as `Set<string>` to avoid the cast:

```typescript
export const DEPRECATED_HABIT_IDS: Set<string> = new Set([
  "habit_teeth_brushing",
  "habit_shower",
]);
```

### L-7. `HABIT_DISPLAY_LABELS` in `habitConstants.ts` is no longer referenced in `TodayLog.tsx`

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/lib/habitConstants.ts`

The import of `HABIT_DISPLAY_LABELS` was removed from `TodayLog.tsx`. Verify it is still used elsewhere; if not, it may be dead code.

### L-8. Inconsistent `data-[state=checked]` usage with Base UI migration

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/components/settings/AppDataForm.tsx` (lines around 240-260)

The `ToggleGroupItem` components use `data-[state=on]` which is the Radix convention. Per the project's Base UI migration rules in `ui-components.md`, this should be `data-[pressed]`. However, if the `ToggleGroup` component wrapper still uses Radix internally, this is correct. Just flagging for awareness.

### L-9. Weight input always shows kilograms in Quick Capture

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/components/track/QuickCapture.tsx` (lines 610-611)

```typescript
description = "Enter your current weight in kilograms (kg).";
```

The description is hardcoded to "kilograms" even though the user may have set their unit system to "imperial". The store has a `unitSystem` field that is not consulted here.

### L-10. `last7DaysRange` computed with empty dependency array in Track.tsx

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/pages/Track.tsx`

```typescript
const last7DaysRange = useMemo(() => {
  // ...
}, []); // Stable for the session -- fine to recompute on mount only
```

The comment acknowledges this. If the user keeps the app open past midnight, the range will be stale, but for a tracking app this is unlikely to cause user-visible issues.

## Files Reviewed

| File                                                   | Status | Quality Notes                                                                                                                                                                         |
| ------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `convex/lib/inputSafety.ts`                            | M      | Clean change (syncKey limit bump). Removed trailing newline. Fine.                                                                                                                    |
| `convex/logs.ts`                                       | M      | Significant additions. `v.any()` for aiPreferences is a critical gap (C-1). `deleteAllBySyncKey` timeout risk (M-3). `normalizeStoredProfileHabit` is well-structured defensive code. |
| `convex/migrations.ts`                                 | M      | Good defensive coding for raw habit data. Proper null checks added.                                                                                                                   |
| `convex/schema.ts`                                     | M      | Two `v.any()` usages (habits and aiPreferences). Habits is acknowledged via comment; aiPreferences needs a proper validator.                                                          |
| `convex/validators.ts`                                 | M      | Clean additions. Frequency validators are well-structured. `storedProfileHabitsValidator` is `v.array(v.any())` (C-3).                                                                |
| `src/components/DailyProgress.tsx`                     | M      | Clean migration from `goalMode`/`dailyGoal` to `kind`/`dailyTarget`/`dailyCap`. `getHabitGoal` helper is a good pattern.                                                              |
| `src/components/archive/DrPooReport.tsx`               | M      | Simple change from constant to function. Clean.                                                                                                                                       |
| `src/components/patterns/DigestiveCorrelationGrid.tsx` | A      | Well-structured new component with good separation of concerns. Minor date parsing note (L-1).                                                                                        |
| `src/components/patterns/FactorInsights.tsx`           | M      | Good migration from emoji strings to Lucide icons. Switched to context-based logs.                                                                                                    |
| `src/components/patterns/WeightTracker.tsx`            | M      | Clean rename from `HabitsStreaksWeight` to `WeightTracker`. Good extraction of `hasGoal` helper.                                                                                      |
| `src/components/settings/AiSuggestionsCard.tsx`        | A      | Well-structured with proper error handling. Callbacks are correctly memoized. `dateRange` memo note (M-7).                                                                            |
| `src/components/settings/AppDataForm.tsx`              | M      | Significant expansion. Good addition of confirmation dialogs and loading states. Duplicated frequency normalizer (H-1).                                                               |
| `src/components/settings/HealthForm.tsx`               | M      | 1010+ lines -- needs extraction (H-2). Duplicated frequency normalizer (H-1). Repeated collapsible pattern (M-2). `setNumeric` type safety (L-2).                                     |
| `src/components/settings/ReproForm.tsx`                | M      | Clean, well-organized. Good use of `DatePickerButton` extraction. Manageable size.                                                                                                    |
| `src/components/settings/SettingsTile.tsx`             | M      | CSS-only changes. Clean.                                                                                                                                                              |
| `src/components/settings/TrackingForm.tsx`             | M      | Good addition of Dr. Poo personalisation and sleep settings. Fluid defaults now derived from habit quickIncrements -- elegant.                                                        |
| `src/components/track/AICoachStrip.tsx`                | A      | Clean, small, focused component. Good loading/empty states.                                                                                                                           |
| `src/components/track/ActivitySection.tsx`             | M      | Clean removal of sleep logging (moved to Quick Capture).                                                                                                                              |
| `src/components/track/BowelSection.tsx`                | M      | Good accessibility improvement: radio inputs replacing button-based radio group. `useId` for group name is correct.                                                                   |
| `src/components/track/HabitDetailSheet.tsx`            | A      | Well-structured with good responsiveness. Duplicated progress logic (M-1). Duplicated responsive hook (L-5). AI snippet caching is well-implemented with cancellation.                |
| `src/components/track/QuickCapture.tsx`                | A      | Large component (760 lines) that should be split (H-3). Good long-press implementation. Missing `useMemo` for `existingHabitIds` (M-5). Weight always shown in kg (L-9).              |
| `src/components/track/QuickCaptureTile.tsx`            | A      | Clean component with good animation handling. Duplicated progress logic (M-1).                                                                                                        |
| `src/components/track/TodayLog.tsx`                    | M      | Large diff with good backward-compat work for walking habit merging. `data: any` throughout (C-2, M-9).                                                                               |
| `src/components/track/TodayStatusRow.tsx`              | A      | Clean, focused component with good time formatting.                                                                                                                                   |
| `src/components/ui/responsive-shell.tsx`               | A      | Good responsive shell pattern. Clean implementation. Duplicated hook pattern (L-5).                                                                                                   |
| `src/hooks/useAiInsights.ts`                           | M      | Good addition of habit correlation insights and AI preferences. Direct `useStore.getState()` access in callback is correctly done.                                                    |
| `src/hooks/useCelebration.ts`                          | M      | Clean simplification removing `celebrateMilestone` and badge-related fields.                                                                                                          |
| `src/hooks/useWeeklySummaryAutoTrigger.ts`             | M      | Clean addition of `aiPreferences.aiModel` passthrough.                                                                                                                                |
| `src/lib/aiAnalysis.ts`                                | M      | Major expansion. Good tone matrix and meal schedule system. `TONE_MATRIX` typing (M-6). System prompt is well-crafted.                                                                |
| `src/lib/celebrations.ts`                              | A      | Small, clean module. `Math.random` for message selection (L-4).                                                                                                                       |
| `src/lib/deprecatedHabits.ts`                          | A      | Good pattern for cleanly removing habits. `as any` cast (L-6).                                                                                                                        |
| `src/lib/digestiveCorrelations.ts`                     | A      | Well-structured correlation engine. Good separation of builder functions per pane.                                                                                                    |
| `src/lib/foodParsing.ts`                               | M      | Mostly formatting changes from Biome. Improved canonical name examples in system prompt.                                                                                              |
| `src/lib/habitAggregates.ts`                           | A      | Clean aggregate computation. Good day summary and streak summary patterns.                                                                                                            |
| `src/lib/habitCoaching.ts`                             | A      | Well-structured AI coaching with heuristic fallbacks. Good separation of concerns.                                                                                                    |
| `src/lib/habitConstants.ts`                            | M      | Clean removal of deprecated habit IDs and labels.                                                                                                                                     |
| `src/lib/habitHistoryCompat.ts`                        | A      | Thorough backward-compatibility layer. Well-commented temporary code.                                                                                                                 |
| `src/lib/habitIcons.tsx`                               | M      | Good addition of new habit type icons. `String(habit.habitType) === "recovery"` workaround noted (M-8).                                                                               |
| `src/lib/habitTemplates.ts`                            | M      | Clean modernization of the habit model. `Date.now()` in templates (H-6). Duplicated inference logic (H-4).                                                                            |
| `src/lib/streaks.ts`                                   | M      | Major simplification removing `updateStreak`, `checkNewBadges`, etc. Clean removal of dead code.                                                                                      |
| `src/lib/sync.ts`                                      | M      | Good addition of deprecated habit filtering at the sync boundary. `useDeleteAllSyncedData` hook is clean.                                                                             |
| `src/pages/Archive.tsx`                                | M      | Small change: back link now goes to Patterns. Clean.                                                                                                                                  |
| `src/pages/Patterns.tsx`                               | M      | Major refactor replacing old patterns with new correlation grid. Well-structured with proper caching via `paneSummaryCache`.                                                          |
| `src/pages/Settings.tsx`                               | M      | Significant simplification -- settings extracted to form components. Clean.                                                                                                           |
| `src/pages/Track.tsx`                                  | M      | Major refactor. Good integration of Quick Capture, coaching, and habit aggregates. `useEffect` for habit import needs documentation (H-5).                                            |
| `src/routeTree.tsx`                                    | M      | Clean route changes.                                                                                                                                                                  |
| `src/store.ts`                                         | M      | Major expansion with good defaults. `resetToFactorySettings` is well-implemented. Deprecated habit filtering at all mutation boundaries is thorough.                                  |
| `src/index.css`                                        | M      | CSS additions for settings panels, chips, and animations. Not reviewed for specific issues.                                                                                           |
