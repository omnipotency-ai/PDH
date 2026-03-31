# Simplicity Audit

**Date:** 2026-02-27
**Scope:** All staged files (49 code files)
**Reviewer:** Claude Opus 4.6 -- Simplicity Specialist

## Executive Summary

This changeset delivers a significant habit system redesign (from `goalMode`/`dailyGoal`/`category` to `kind`/`dailyTarget`/`dailyCap`/`unit`), plus new features like AI coaching, digestive correlations, a quick-capture grid, and a vastly expanded health/reproductive/lifestyle settings form. While much of the code is straightforward, the changeset introduces **several large new modules** (habitCoaching.ts at 685 lines, habitHistoryCompat.ts at 580 lines, QuickCapture.tsx at 760 lines) that violate the "boring code" principle through over-engineering, speculative generalization, and feature scope that exceeds what a single-user recovery tracker needs. The backward-compatibility layer in particular is built for edge cases that a single user will never encounter.

---

## Critical Issues

### C1. `src/lib/habitHistoryCompat.ts` -- 580-line backward-compat layer is massive over-engineering

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/lib/habitHistoryCompat.ts`

This file is the single largest YAGNI violation in the changeset. For a **single-user app**, it builds an elaborate slot-resolution system with:

- 8 named "compat slots" with a `SlotTarget` abstraction
- `resolveSlotTargets()` that calls `findPreferredHabit()` with arrays of matchers per slot (lines ~185-230)
- Binary-search deduplication across timestamp windows (`hasNearbyLocalEquivalent`, lines ~467-492)
- Multi-source collection (`synced_habit`, `legacy_fluid`, `legacy_activity`) with cross-source deduplication
- Name normalization with Unicode NFKD decomposition and regex-based slot inference (`slotByHabitName`, lines ~146-155)

For a single user migrating their own data, a simple one-time migration script would accomplish the same thing. This module will be the hardest code to maintain and debug.

**Recommendation:** Replace with a one-time migration that converts legacy logs to the new format. Run it once per user on version upgrade. Delete the compat layer.

### C2. `src/lib/habitCoaching.ts` -- 685-line AI coaching module for a personal tracker

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/lib/habitCoaching.ts`

This file contains **five separate AI prompt functions** plus their heuristic fallbacks:

1. `generateCoachingSnippet` + `getHeuristicCoachingMessage` (Track page strip)
2. `generateHabitSnippet` + `heuristicHabitSnippet` (Habit detail sheet)
3. `generatePaneSummary` + `heuristicPaneSummary` (Patterns correlations)
4. `generateSettingsSuggestions` + `heuristicSuggestions` (Settings AI suggestions)

Each pair duplicates the same pattern: build context, call OpenAI, parse response, with a heuristic fallback. The heuristic fallbacks alone (lines ~102-198 for `getHeuristicCoachingMessage`) contain 12 numbered priority cases with complex cascading logic.

For a single-user tracker, having AI coaching at 4 different tiers feels like feature creep. The Track page coaching strip, the per-habit AI snippets in the detail sheet, the per-pane AI summaries in Patterns, AND the settings-page AI suggestions are four separate AI touchpoints.

**Recommendation:** Consolidate to 1-2 AI touchpoints. The existing Dr. Poo conversation already provides personalized advice. The heuristic fallbacks could be the primary feature with AI as an optional enhancement, not four separate subsystems.

### C3. `src/store.ts` / `convex/validators.ts` -- Health profile has exploded with 30+ new fields

**Files:**

- `/Users/peterjamesblizzard/projects/caca_traca/src/store.ts` (HealthProfile interface)
- `/Users/peterjamesblizzard/projects/caca_traca/convex/validators.ts` (healthProfileValidator)

The `HealthProfile` interface has grown from ~14 fields to ~45+ fields. New additions include:

```typescript
// Smoking: 4 fields
smokingCigarettesPerDay: number | null;
smokingYears: number | null;
smokingNotes: string;

// Alcohol: 5 fields
alcoholAmountPerSession: string;
alcoholFrequency: UsageFrequencyChoice;
alcoholYearsAtCurrentLevel: number | null;
alcoholNotes: string;

// Recreational drugs: 12 fields (3 categories x 4 fields each)
recreationalStimulantsAmount: string;
recreationalStimulantsFrequency: UsageFrequencyChoice;
recreationalStimulantsYears: number | null;
recreationalDepressantsAmount: string;
recreationalDepressantsFrequency: UsageFrequencyChoice;
recreationalDepressantsYears: number | null;
recreationalPsychedelicsAmount: string;
recreationalPsychedelicsFrequency: UsageFrequencyChoice;
recreationalPsychedelicsYears: number | null;
```

This is a clinical intake form, not a personal recovery tracker. The recreational drug fields alone have **12 fields across 3 substance categories** with per-category amount, frequency, and years-of-use tracking. This data is fed into Dr. Poo's system prompt via `aiAnalysis.ts`, but the user already has habit tracking for these substances. The health profile is duplicating tracking data as static configuration.

**Recommendation:** The smoking/alcohol/recreational drug detail belongs in the habit tracking system, which already exists. Keep a simple "lifestyle notes" free-text field if the user wants Dr. Poo to know about substance history. Remove the 20+ structured substance-tracking fields from the health profile.

---

## High Severity

### H1. `src/components/track/QuickCapture.tsx` -- 760 lines with too many concerns

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/components/track/QuickCapture.tsx`

This single component handles:

- Habit tile grid rendering
- Sleep entry with hour/minute scroll selectors (lines ~390-530)
- Weight entry with input validation (lines ~540-640)
- Weight settings (surgery start weight) as a separate drawer (lines ~643-730)
- Add Habit drawer with template and custom creation (lines ~78-175)
- Long-press gesture detection for both habit tiles and weight tile

The sleep entry alone is 140 lines of drawer UI with custom hour/minute pickers. The weight quick-capture has **three** separate `ResponsiveShell` dialogs (weight entry, weight settings, add habit). Each has its own state, validation, and submit logic.

```typescript
const [sleepEntryHabit, setSleepEntryHabit] = useState<HabitConfig | null>(
  null,
);
const [sleepHoursValue, setSleepHoursValue] = useState(0);
const [sleepMinutesValue, setSleepMinutesValue] =
  useState<SleepMinuteOption>(0);
const [sleepSaving, setSleepSaving] = useState(false);
const [weightEntryOpen, setWeightEntryOpen] = useState(false);
const [weightInputValue, setWeightInputValue] = useState("");
const [weightSaving, setWeightSaving] = useState(false);
const [weightSettingsOpen, setWeightSettingsOpen] = useState(false);
const [weightSettingsInputValue, setWeightSettingsInputValue] = useState("");
```

That is 9 separate `useState` calls just for the sub-drawers.

**Recommendation:** Extract `SleepEntryDrawer`, `WeightEntryDrawer`, and `AddHabitDrawer` into separate files. Each is a self-contained feature with its own state. The parent `QuickCapture` should only render the grid and coordinate open/close.

### H2. `src/components/track/HabitDetailSheet.tsx` -- 602 lines with triple rendering mode

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/components/track/HabitDetailSheet.tsx`

This component implements **three presentation modes** (mobile drawer, tablet dialog, desktop side panel) with a custom `useHabitDetailPresentationMode` hook that listens to window resize events (lines ~41-61). The responsive shell component (`ResponsiveShell`) already exists and does the same thing. This component reimplements the pattern instead of using `ResponsiveShell`.

Additionally, the component renders an empty `<Drawer>` when closed (lines ~262-272):

```tsx
if (!isOpen) {
  return (
    <Drawer open={false} onOpenChange={handleOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Habit Detail</DrawerTitle>
          <DrawerDescription>No habit selected</DrawerDescription>
        </DrawerHeader>
      </DrawerContent>
    </Drawer>
  );
}
```

There is no need to render a closed drawer. Return `null`.

**Recommendation:** Use `ResponsiveShell` instead of reimplementing three rendering modes. Return `null` when `habit` is null.

### H3. `src/components/ui/responsive-shell.tsx` -- Duplicated responsive breakpoint detection

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/components/ui/responsive-shell.tsx`

This file defines `useResponsiveShellMode()` (lines ~31-50). Then `HabitDetailSheet.tsx` independently defines `useHabitDetailPresentationMode()` with identical logic and identical breakpoints (768/1280). Two copies of the same hook.

```typescript
// responsive-shell.tsx
const RESPONSIVE_SHELL_MD_BREAKPOINT_PX = 768;
const RESPONSIVE_SHELL_XL_BREAKPOINT_PX = 1280;

// HabitDetailSheet.tsx
const HABIT_DETAIL_MD_BREAKPOINT_PX = 768;
const HABIT_DETAIL_XL_BREAKPOINT_PX = 1280;
```

**Recommendation:** Export `useResponsiveShellMode` from `responsive-shell.tsx` and reuse it everywhere. Or better: use `ResponsiveShell` directly.

### H4. `convex/logs.ts` -- 180-line `normalizeStoredProfileHabit` is server-side over-engineering

**File:** `/Users/peterjamesblizzard/projects/caca_traca/convex/logs.ts` (lines ~24-180)

The server-side habit normalization function handles every conceivable legacy format with regex-based type inference (`inferLegacyHabitType`), multi-field kind resolution with three fallback strategies, and unit inference. This duplicates logic already present client-side in `habitTemplates.ts::normalizeHabitConfig()`.

For a single-user app, the server should either store normalized data or trust the client to normalize. Having two independent normalization paths (client in `habitTemplates.ts`, server in `logs.ts`) creates a maintenance burden and potential inconsistencies.

**Recommendation:** Normalize on write (client-side) and store clean data. The server `getProfile` should return data as-stored, not re-normalize on every read.

### H5. `convex/logs.ts` -- `deleteAllBySyncKey` is 80 lines of repetitive table iteration

**File:** `/Users/peterjamesblizzard/projects/caca_traca/convex/logs.ts` (lines ~463-592)

The delete function repeats the same pattern 10 times:

```typescript
const logs = await ctx.db.query("logs").withIndex("by_syncKey", ...).collect();
for (const row of logs) { await ctx.db.delete(row._id); }
// ... repeat for aiAnalyses, conversations, foodAssessments, reportSuggestions, etc.
```

Then it manually sums up all counts. This is classic code that could be a loop over table names.

**Recommendation:** Use an array of table names and iterate:

```typescript
const tables = ["logs", "aiAnalyses", "conversations", ...] as const;
const results: Record<string, number> = {};
for (const table of tables) {
  const rows = await ctx.db.query(table).withIndex("by_syncKey", q => q.eq("syncKey", syncKey)).collect();
  for (const row of rows) await ctx.db.delete(row._id);
  results[table] = rows.length;
}
```

### H6. `src/lib/digestiveCorrelations.ts` -- Four near-identical pane builder functions

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/lib/digestiveCorrelations.ts`

`buildWaterPane`, `buildWalkPane`, `buildSleepPane`, and `buildDestructivePane` (lines ~110-285) are 4 functions that follow an identical structure:

1. Find relevant habit
2. Build `getTag` function
3. Calculate best/worst averages
4. Build summary text

The only difference is which habit ID to look up. This is premature extraction into 4 functions that should be 1 parameterized function.

**Recommendation:** Replace with a single `buildPane(paneId, habitIds, best, worst, habitDaySummaries, habits)` function.

---

## Medium Severity

### M1. `src/lib/aiAnalysis.ts` -- TONE_MATRIX with 9 entries for a single user

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/lib/aiAnalysis.ts`

The `TONE_MATRIX` object (visible in the diff around line 64) has 9 entries for all combinations of 3 friendliness levels x 3 professionalism levels. Each is a carefully crafted paragraph. This is a 3x3 config matrix for one user's preferred AI tone.

The user will pick one combination and never change it. The 8 unused tone descriptions will never be read by anyone.

**Recommendation:** Simplify to 3 presets ("casual", "balanced", "clinical") with a single sentence each. Or just use a free-text "tone notes" field that gets appended to the prompt.

### M2. `src/components/settings/AiSuggestionsCard.tsx` -- 244 lines for a rarely-used feature

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/components/settings/AiSuggestionsCard.tsx`

This is a dedicated collapsible card that computes 14-day habit aggregates, then either calls OpenAI or falls back to heuristics to suggest target/cap adjustments. It has 6 `useCallback` hooks:

```typescript
const handleGetSuggestions = useCallback(async () => { ... }, [...]);
const handleApply = useCallback((...) => { ... }, [...]);
const handleDismiss = useCallback((...) => { ... }, [...]);
const getHabitName = useCallback((...) => { ... }, [...]);
const getCurrentValue = useCallback((...) => { ... }, [...]);
const getHabitUnit = useCallback((...) => { ... }, [...]);
```

`getHabitName`, `getCurrentValue`, and `getHabitUnit` are simple habit lookups wrapped in `useCallback` for no performance benefit (they are called during render of suggestion cards, not passed as props to memoized children).

**Recommendation:** Remove `useCallback` from `getHabitName`, `getCurrentValue`, `getHabitUnit` -- these are trivial lookups. Consider whether this feature is needed at all given Dr. Poo already provides this kind of advice through conversation.

### M3. `src/store.ts` -- `AiPreferences` interface adds 9 new fields to persisted state

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/store.ts`

```typescript
export interface AiPreferences {
  preferredName: string;
  location: string;
  mealSchedule: MealSchedule; // { breakfast, lunch, dinner }
  aiModel: AiModel;
  toneFriendliness: ToneFriendliness;
  toneProfessionalism: ToneProfessionalism;
  outputFormat: OutputFormat;
  outputLength: OutputLength;
  suggestionCount: number;
}
```

This is 9 new persistent settings for AI behavior. The `mealSchedule` is a nested object with 3 time fields that get used to compute "mid-morning snack" and "mid-afternoon snack" times in `aiAnalysis.ts::buildMealScheduleText()`. That level of meal-timing precision seems unlikely to meaningfully improve AI output quality.

**Recommendation:** Start with `preferredName`, `aiModel`, and one `tone` selector. Add more only when the simpler version proves insufficient.

### M4. `src/components/settings/TrackingForm.tsx` -- Dr. Poo personalisation settings in wrong place

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/components/settings/TrackingForm.tsx`

The "Dr. Poo Personalisation" section (lines ~139-310 in the diff) includes location, meal schedule (3 time inputs), preferred name, friendliness, communication style, output format, output length, and max suggestions. This is ~170 lines of form UI embedded in the Tracking settings form, which is conceptually about habit templates, fluid presets, and celebrations.

**Recommendation:** If AI personalization must exist, it belongs in the "App & Data" settings panel near the API key configuration, not mixed into tracking settings.

### M5. `src/lib/celebrations.ts` -- New file for 48 lines of celebration config

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/lib/celebrations.ts`

This creates a separate module for a `getCelebration()` function that returns milestone messages. The `useCelebration` hook was already simplified in this same changeset (removing `celebrateMilestone`). The new celebrations.ts file adds `CelebrationConfig` with `confettiColor`, `message`, and `intensity` levels ("small", "medium", "big"), but it is unclear where the intensity actually gets used.

```typescript
const dailyMessages = [
  `${habit.name} target hit. Nice.`,
  `${habit.name} -- another good day.`,
  `That's your ${habit.name} goal done for today.`,
  `${habit.name} locked in.`,
  `${habit.name} target reached -- well done.`,
];
const messageIndex = Math.floor(Math.random() * dailyMessages.length);
```

Five hardcoded messages with random selection is simple, but the `CelebrationConfig` type with `intensity` and `confettiColor` adds structure that may not be consumed anywhere.

**Recommendation:** Inline this into the celebration hook if `intensity` is not actually consumed. Otherwise, keep it but verify the `intensity` field is used.

### M6. `src/components/settings/ReproForm.tsx` -- Tripled in size with conditional sub-panels

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/components/settings/ReproForm.tsx`

This form went from ~170 lines to ~510+ lines (3x growth). New features include:

- `DatePickerButton` component (57 lines, defined inline)
- Pregnancy trimester auto-calculation
- Oral contraceptive toggle with notes
- Breastfeeding toggle
- HRT/thyroid toggles with conditional notes
- Cycle phase selector with severity slider

For a single-user digestive recovery tracker, this level of reproductive health detail is clinical-grade. The app description says it "correlates foods with digestive outcomes" -- most of these reproductive sub-fields will not meaningfully improve food-digestion correlation for the target user.

**Recommendation:** The cycle tracking and pregnancy status are genuinely useful for digestive correlation. The contraceptive notes, HRT details, thyroid toggles, and breastfeeding flags add complexity for marginal value. Consider keeping only the fields that Dr. Poo's system prompt actually references.

### M7. `src/lib/deprecatedHabits.ts` -- Over-engineered for removing 2 habits

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/lib/deprecatedHabits.ts`

36 lines and 5 exported functions to remove `habit_teeth_brushing` and `habit_shower`:

```typescript
export const DEPRECATED_HABIT_IDS = new Set(["habit_teeth_brushing", "habit_shower"] as const);
export function isDeprecatedHabitId(habitId: unknown): boolean { ... }
export function filterDeprecatedHabits<T extends HabitConfig>(habits: readonly T[]): T[] { ... }
export function filterDeprecatedHabitLogs<T extends Pick<HabitLog, "habitId">>(logs: readonly T[]): T[] { ... }
export function isDeprecatedSyncedHabitLog(log: SyncedHabitLogLike): boolean { ... }
export function filterDeprecatedSyncedLogs<T extends SyncedHabitLogLike>(logs: readonly T[]): T[] { ... }
```

5 exported functions for filtering 2 IDs from 3 different data shapes. The `SyncedHabitLogLike` type (lines 24-29) is a 6-line type definition just for this filtering.

**Recommendation:** A single `isDeprecatedHabitId()` check plus inline `.filter()` calls at usage sites would be simpler. No need for 5 exported generics.

---

## Low Severity / Informational

### L1. `src/components/track/QuickCaptureTile.tsx` -- Counter slide animation state

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/components/track/QuickCaptureTile.tsx` (lines ~146-170)

The tile tracks `outgoingText`, `animating`, and `previousProgressTextRef` to animate counter changes with CSS slide-in/slide-out. This is 25 lines of animation state management for a text label update. It works fine but is "clever" -- a simple text swap would be more boring.

### L2. `src/components/track/TodayStatusRow.tsx` -- Color-coded BM timer

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/components/track/TodayStatusRow.tsx`

`getLastBmTextColor` uses 4 color thresholds (sky < 55min, emerald < 8h, orange < 24h, red >= 24h). This is fine but the thresholds are undocumented magic numbers.

### L3. `convex/validators.ts` -- Frequency validator duplicated 4 times

**File:** `/Users/peterjamesblizzard/projects/caca_traca/convex/validators.ts`

The same `v.union(v.literal("more_than_once_daily"), v.literal("daily"), ...)` frequency validator is repeated verbatim for `recreationalStimulantsFrequency`, `recreationalDepressantsFrequency`, and `recreationalPsychedelicsFrequency` (plus `alcoholFrequency`). This should be extracted to a shared validator.

### L4. `src/components/settings/HealthForm.tsx` -- Collapsible sections add UX complexity

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/components/settings/HealthForm.tsx`

The form uses 4 `useState` booleans for collapsible sections: `conditionsOpen`, `medicationsOpen`, `lifestyleOpen`, `surgeryDatePickerOpen`. Collapsible sections in a settings form that the user visits rarely add navigation friction. Consider showing all fields expanded by default.

### L5. `src/lib/foodParsing.ts` -- Mostly formatting changes

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/lib/foodParsing.ts`

The changes are primarily Biome formatter adjustments plus expanded food category examples in the system prompt. The expanded examples are helpful for better AI parsing. No simplicity concerns.

### L6. `src/components/patterns/DigestiveCorrelationGrid.tsx` -- Custom date range picker

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/DigestiveCorrelationGrid.tsx`

317 lines for a correlation grid with preset range buttons (7/14/30 days) plus a custom date range picker. The custom mode with `customStartDraft`/`customEndDraft`/`canApplyCustom` validation adds 50+ lines of state management. For a personal tracker, the 3 preset options are likely sufficient.

### L7. `src/components/settings/AppDataForm.tsx` -- `normalizeUsageFrequency` duplicated

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/components/settings/AppDataForm.tsx`

`normalizeUsageFrequency()` (lines ~10-16) is defined here, and an identical `normalizeFrequency()` function exists in `HealthForm.tsx`. Extract to a shared utility.

### L8. `src/hooks/useCelebration.ts` -- Good simplification

The removal of `celebrateMilestone` and the badge-related fields (`isMilestone`, `milestoneMessage`, `newBadges`) from `CelebrationEvent` is a welcome simplification. This is code deletion done well.

### L9. `src/lib/streaks.ts` -- Good simplification

Removing `updateStreak`, `checkNewBadges`, `getWeeklySummary`, and `BADGE_INFO` (160+ lines deleted) is an excellent simplification. The badge system was over-engineered for a single user. The remaining `GamificationState` and `SleepGoal` types are appropriately simple.

---

## Files Reviewed

| File                                                   | Status | Simplicity Notes                                                                                                                                                                                                                                  |
| ------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `convex/lib/inputSafety.ts`                            | M      | Trivial: sync key limit raised 128->512, trailing newline removed. Fine.                                                                                                                                                                          |
| `convex/logs.ts`                                       | M      | **H4, H5**: Server-side habit normalization duplicates client logic; delete function is repetitive.                                                                                                                                               |
| `convex/migrations.ts`                                 | M      | Defensive typing for habit lookup. Reasonable.                                                                                                                                                                                                    |
| `convex/schema.ts`                                     | M      | Schema relaxed to `v.array(v.any())` for legacy compat plus `aiPreferences: v.optional(v.any())`. Pragmatic.                                                                                                                                      |
| `convex/validators.ts`                                 | M      | **L3, C3**: Massive health profile expansion; frequency validator duplicated 4x.                                                                                                                                                                  |
| `src/components/DailyProgress.tsx`                     | M      | Clean migration from `goalMode`/`dailyGoal` to `kind`/`dailyTarget`/`dailyCap`. Simple and clear.                                                                                                                                                 |
| `src/components/archive/DrPooReport.tsx`               | M      | Trivial: `AI_DISCLAIMER` -> `getAiDisclaimer()`. Fine.                                                                                                                                                                                            |
| `src/components/patterns/DigestiveCorrelationGrid.tsx` | A      | **L6**: 317 lines. Custom date range picker adds state complexity. Preset buttons alone would suffice.                                                                                                                                            |
| `src/components/patterns/FactorInsights.tsx`           | M      | Clean: emojis -> Lucide icons, direct context import.                                                                                                                                                                                             |
| `src/components/patterns/WeightTracker.tsx`            | M      | Clean: removed `mergeRequiredHabits`, simplified goal check.                                                                                                                                                                                      |
| `src/components/settings/AiSuggestionsCard.tsx`        | A      | **M2**: 244 lines with unnecessary `useCallback` wrappers on simple lookups.                                                                                                                                                                      |
| `src/components/settings/AppDataForm.tsx`              | M      | **L7**: Duplicated `normalizeUsageFrequency`. Significant growth with data management, units, model selector.                                                                                                                                     |
| `src/components/settings/HealthForm.tsx`               | M      | **L4, C3**: Massive form expansion for substance use details.                                                                                                                                                                                     |
| `src/components/settings/ReproForm.tsx`                | M      | **M6**: Tripled in size. Clinical-grade reproductive tracking.                                                                                                                                                                                    |
| `src/components/settings/SettingsTile.tsx`             | M      | Cosmetic tweaks. Fine.                                                                                                                                                                                                                            |
| `src/components/settings/TrackingForm.tsx`             | M      | **M4**: Dr. Poo personalisation settings (170 lines) placed in tracking form.                                                                                                                                                                     |
| `src/components/track/AICoachStrip.tsx`                | A      | 46 lines. Clean, simple component. No issues.                                                                                                                                                                                                     |
| `src/components/track/ActivitySection.tsx`             | M      | Clean: sleep logging removed from activity section (moved to QuickCapture).                                                                                                                                                                       |
| `src/components/track/BowelSection.tsx`                | M      | Improved accessibility: `<button>` -> `<label>` + `<input type="radio">`. Good change.                                                                                                                                                            |
| `src/components/track/HabitDetailSheet.tsx`            | A      | **H2, H3**: 602 lines with duplicated responsive mode detection. Should use ResponsiveShell.                                                                                                                                                      |
| `src/components/track/QuickCapture.tsx`                | A      | **H1**: 760 lines. Too many concerns in one component. Extract sub-drawers.                                                                                                                                                                       |
| `src/components/track/QuickCaptureTile.tsx`            | A      | **L1**: 275 lines. Counter animation state is a bit clever but acceptable.                                                                                                                                                                        |
| `src/components/track/TodayLog.tsx`                    | M      | Large diff but mostly backward-compat for walking habit merging. The `findHabitConfigForHabitLog` function with 3-tier fallback (id, name, habitType) is reasonable for compat.                                                                   |
| `src/components/track/TodayStatusRow.tsx`              | A      | 79 lines. Simple status display. **L2**: magic number thresholds for BM color.                                                                                                                                                                    |
| `src/components/ui/responsive-shell.tsx`               | A      | **H3**: Good abstraction but duplicated in HabitDetailSheet.                                                                                                                                                                                      |
| `src/hooks/useAiInsights.ts`                           | M      | Reads `paneSummaryCache` from store to feed into AI context. Adds coupling between patterns page cache and insight generation.                                                                                                                    |
| `src/hooks/useCelebration.ts`                          | M      | **L8**: Good simplification. Removed badge/milestone complexity.                                                                                                                                                                                  |
| `src/hooks/useWeeklySummaryAutoTrigger.ts`             | M      | Minor: passes `aiPreferences.aiModel` to weekly summary. Fine.                                                                                                                                                                                    |
| `src/lib/aiAnalysis.ts`                                | M      | **M1**: TONE_MATRIX with 9 entries. Meal schedule time computation. Significant prompt engineering expansion.                                                                                                                                     |
| `src/lib/celebrations.ts`                              | A      | **M5**: 48 lines. `intensity` field may be unused.                                                                                                                                                                                                |
| `src/lib/deprecatedHabits.ts`                          | A      | **M7**: 5 exports for filtering 2 habit IDs. Over-engineered.                                                                                                                                                                                     |
| `src/lib/digestiveCorrelations.ts`                     | A      | **H6**: 432 lines. Four near-identical pane builder functions should be one parameterized function.                                                                                                                                               |
| `src/lib/foodParsing.ts`                               | M      | **L5**: Mostly formatting. Expanded food examples are helpful.                                                                                                                                                                                    |
| `src/lib/habitAggregates.ts`                           | A      | 163 lines. Clean, focused module. `computeDaySummaries` and `computeStreakSummary` are appropriately simple.                                                                                                                                      |
| `src/lib/habitCoaching.ts`                             | A      | **C2**: 685 lines. Five AI prompt functions with heuristic fallbacks. Over-scoped.                                                                                                                                                                |
| `src/lib/habitConstants.ts`                            | M      | Removed deprecated habits from constants. Good.                                                                                                                                                                                                   |
| `src/lib/habitHistoryCompat.ts`                        | A      | **C1**: 580 lines. Massive backward-compat layer for a single user.                                                                                                                                                                               |
| `src/lib/habitIcons.tsx`                               | M      | Added icons for water, alcohol, sleep. Straightforward.                                                                                                                                                                                           |
| `src/lib/habitTemplates.ts`                            | M      | Major refactor from old to new habit shape. `normalizeHabitConfig` handles migration. `validateHabitConfig` with explicit field-by-field checks is thorough but verbose (~60 lines of validation). The `createCustomHabit` function is now clean. |
| `src/lib/streaks.ts`                                   | M      | **L9**: Excellent simplification. 160+ lines of badge/streak logic removed.                                                                                                                                                                       |
| `src/lib/sync.ts`                                      | M      | Clean: deprecated habit filtering, profile sync with aiPreferences, `useDeleteAllSyncedData` hook.                                                                                                                                                |
| `src/pages/Archive.tsx`                                | M      | Minor: link target changed from `/` to `/patterns`. Fine.                                                                                                                                                                                         |
| `src/pages/Patterns.tsx`                               | M      | Significant rewrite. Added digestive correlations, reduced from 231 to 111 lines. Good simplification of the page itself, though it delegates to new complex modules.                                                                             |
| `src/pages/Settings.tsx`                               | M      | Layout changes, image tiles for setting categories.                                                                                                                                                                                               |
| `src/pages/Track.tsx`                                  | M      | Integrated QuickCapture, AICoachStrip, TodayStatusRow. The Track page orchestration is reasonable.                                                                                                                                                |
| `src/routeTree.tsx`                                    | M      | Route structure changes. Fine.                                                                                                                                                                                                                    |
| `src/store.ts`                                         | M      | **C3, M3**: Store version 10->17. Major growth in HealthProfile and AiPreferences. New habitLogs array, paneSummaryCache. Migration logic is thorough.                                                                                            |
| `src/index.css`                                        | M      | Color palette adjustments, new settings page tokens, animation keyframes. Design refinement, not complexity.                                                                                                                                      |

---

## Summary Statistics

| Severity | Count |
| -------- | ----- |
| Critical | 3     |
| High     | 6     |
| Medium   | 7     |
| Low/Info | 9     |

**Total new lines of code added:** ~5,000+ across new files alone
**Largest new files by line count:**

1. `src/components/track/QuickCapture.tsx` -- 760 lines
2. `src/lib/habitCoaching.ts` -- 685 lines
3. `src/components/track/HabitDetailSheet.tsx` -- 602 lines
4. `src/lib/habitHistoryCompat.ts` -- 580 lines
5. `src/lib/digestiveCorrelations.ts` -- 432 lines

The project motto is "Don't be clever. Write boring code." The core habit system migration (templates, validators, icons, streaks simplification) follows this principle well. But the AI coaching layer, backward-compat bridge, and health profile expansion push in the opposite direction -- toward a clinical-grade, multi-tier AI coaching platform rather than a personal recovery tracker.
