# Audit: Simplification Opportunities & Overlapping Code

**Date:** 2026-02-28
**Scope:** `/Users/peterjamesblizzard/projects/caca_traca/src/`
**Categories:** 7 (Simplification Opportunities), 8 (Overlapping/Similar Code)

---

## Category 8: Overlapping/Similar Code

### OV-01 — Duplicate `DrPooReply` interface [HIGH]

**Files:**
- `src/store.ts` (line 213)
- `src/lib/aiAnalysis.ts` (line 31)

Both files define an identical `DrPooReply` interface:

```typescript
export interface DrPooReply {
  text: string;
  timestamp: number;
}
```

**Impact:** Maintaining the same interface in two places risks them diverging. Consumers may import from either location inconsistently.

**Recommendation:** Delete the interface from `aiAnalysis.ts` and re-export from `store.ts`:
```typescript
// aiAnalysis.ts
export type { DrPooReply } from "@/store";
```

---

### OV-02 — Duplicate `isCoffeeFluidHabit` / `isCaffeineHabit` functions [HIGH]

**Files:**
- `src/lib/habitCoaching.ts` (line 18): `isCoffeeFluidHabit(habit)`
- `src/lib/habitProgress.ts` (line 27): `isCaffeineHabit(habit)`

Both do the same thing -- check if a habit is a caffeine/coffee fluid habit:

```typescript
// habitCoaching.ts
function isCoffeeFluidHabit(habit: HabitConfig): boolean {
  return habit.logAs === "fluid" && (habit.id === "habit_coffee" || habit.habitType === "caffeine");
}

// habitProgress.ts
function isCaffeineHabit(habit: HabitConfig): boolean {
  return (
    habit.logAs === "fluid" &&
    (habit.id === "habit_coffee" || habit.habitType === "caffeine")
  );
}
```

Additionally, `Track.tsx` (line 629) inlines the same logic:
```typescript
const isCaffeine =
  habit.logAs === "fluid" &&
  (habit.id === "habit_coffee" || habit.habitType === "caffeine");
```

**Impact:** Three independent implementations of the same check. If the caffeine detection logic ever changes, all three must be updated.

**Recommendation:** Export a single `isCaffeineHabit` function from `habitTemplates.ts` (alongside `isCapHabit`, `isTargetHabit`, `isDigestiveHabit`) and import everywhere.

---

### OV-03 — Duplicate `bristolToConsistency` / `normalizeDigestiveCategory` [HIGH]

**Files:**
- `src/pages/Track.tsx` (line 51): `bristolToConsistency(code)`
- `src/lib/analysis.ts` (line 767): `normalizeDigestiveCategory(data)`

Both map Bristol codes to digestive categories, but `Track.tsx`'s version is a simplified function that only takes a code, while `analysis.ts` also checks `consistencyTag` first and returns `null` for invalid data. The mappings are now aligned (both: 1=constipated, 2=hard, 3-5=firm, 6=loose, 7=diarrhea), but they still exist as two separate functions.

**Impact:** Maintenance risk -- any future mapping change requires updating both. Previous audits flagged a mapping inconsistency that has since been fixed, but the duplication remains.

**Recommendation:** Export a `bristolCodeToCategory(code: number)` helper from `analysis.ts` and use it in `Track.tsx`:
```typescript
// analysis.ts (new export)
export function bristolCodeToCategory(code: number): DigestiveCategory {
  if (code >= 7) return "diarrhea";
  if (code === 6) return "loose";
  if (code <= 1) return "constipated";
  if (code === 2) return "hard";
  return "firm";
}

// Track.tsx
import { bristolCodeToCategory } from "@/lib/analysis";
// Replace bristolToConsistency with bristolCodeToCategory
```

---

### OV-04 — Duplicate `normalizeEpisodes` / `normalizeEpisodesCount` [HIGH]

**Files:**
- `src/pages/Track.tsx` (line 61): `normalizeEpisodes(value)`
- `src/lib/analysis.ts` (line 907): `normalizeEpisodesCount(value)`

Both clamp an unknown value into the range [1, 20]:

```typescript
// Track.tsx
function normalizeEpisodes(value: unknown): number {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.min(parsed, 20);
}

// analysis.ts
function normalizeEpisodesCount(value: unknown): number {
  const count = Number(value);
  if (!Number.isFinite(count)) return 1;
  return Math.min(Math.max(Math.floor(count), 1), 20);
}
```

Functionally identical (minor ordering differences in the clamping).

**Recommendation:** Export one canonical function from `analysis.ts` and import in `Track.tsx`.

---

### OV-05 — Duplicate `computeTodayHabitCounts` [HIGH]

**Files:**
- `src/pages/Track.tsx` (line 73)
- `src/components/DailyProgress.tsx` (line 22)

Both compute today's habit totals from a log array. The `Track.tsx` version takes `todayStart` and `todayEnd`; the `DailyProgress.tsx` version only takes `todayStart` (no upper bound check).

```typescript
// Track.tsx
function computeTodayHabitCounts(
  habitLogs: Array<{ habitId: string; value: number; at: number }>,
  todayStart: number,
  todayEnd: number,
): Record<string, number> { ... }

// DailyProgress.tsx
function computeTodayHabitCounts(
  habitLogs: HabitLog[],
  todayStart: number,
): Record<string, number> { ... }
```

**Impact:** The `DailyProgress.tsx` version lacks the upper bound check, which could count future logs if the clock drifts or data is imported with future timestamps.

**Recommendation:** Create a shared utility in `habitAggregates.ts`:
```typescript
export function computeHabitCountsInRange(
  habitLogs: HabitLog[],
  startMs: number,
  endMs: number,
): Record<string, number> { ... }
```

---

### OV-06 — Duplicate `BLOCKED_FLUID_PRESET_NAMES` / `HARDWIRED_FLUID_NAMES` [MODERATE]

**Files:**
- `src/store.ts` (line 387): `BLOCKED_FLUID_PRESET_NAMES`
- `src/components/track/FluidSection.tsx` (line 14): `HARDWIRED_FLUID_NAMES`

Both are Sets of the same fluid names that should not appear as custom presets. The lists are identical.

**Recommendation:** Import `BLOCKED_FLUID_PRESET_NAMES` from the store in `FluidSection.tsx` instead of maintaining a second copy.

---

### OV-07 — Duplicate `STATUS_ORDER` map [MODERATE]

**Files:**
- `src/lib/analysis.ts` (line 103)
- `src/components/patterns/FoodSafetyDatabase.tsx` (line 352)

Both define the same mapping from `FoodStatus` to sort order. The values differ slightly (analysis.ts uses safe=0..risky=5; FoodSafetyDatabase.tsx uses risky=0..testing=5 -- reversed priority), but they serve the same purpose and should be unified.

**Recommendation:** Export `STATUS_ORDER` from `analysis.ts` and derive the reversed version in `FoodSafetyDatabase.tsx` if needed, or provide both as named exports.

---

### OV-08 — Overlapping date formatting functions [MODERATE]

**Files:**
- `src/lib/habitAggregates.ts` (line 22): `formatLocalDateKey(input: Date | number)`
- `src/lib/habitAggregates.ts` (line 31): `timestampToDateString(timestamp: number)` -- just calls `formatLocalDateKey`
- `src/lib/reproductiveHealth.ts` (line 58): `getDateKeyFromTimestamp(timestamp: number)`
- `src/lib/reproductiveHealth.ts` (line 62): `getTodayDateKey()`

`formatLocalDateKey` and `getDateKeyFromTimestamp` do the same thing -- convert a timestamp to `YYYY-MM-DD`. `timestampToDateString` is an unnecessary wrapper.

```typescript
// habitAggregates.ts
export function formatLocalDateKey(input: Date | number): string {
  const date = typeof input === "number" ? new Date(input) : input;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// reproductiveHealth.ts
export function getDateKeyFromTimestamp(timestamp: number): string {
  return format(new Date(timestamp), "yyyy-MM-dd");
}
```

Different implementations (manual vs. date-fns `format`), same output.

**Recommendation:**
1. Delete `timestampToDateString` from `habitAggregates.ts` -- it is only used once internally and is just a pass-through.
2. Replace `getDateKeyFromTimestamp` and `getTodayDateKey` in `reproductiveHealth.ts` with imports of `formatLocalDateKey` from `habitAggregates.ts`.

---

### OV-09 — Inline error extraction pattern instead of using `getErrorMessage` [MODERATE]

**File:** `src/lib/errors.ts` -- exports `getErrorMessage(err: unknown)`

Multiple files inline the same pattern instead of using this utility:

- `src/hooks/useAiInsights.ts` (line 224): `err instanceof Error ? err.message : String(err)`
- `src/components/settings/AiSuggestionsCard.tsx` (line 67): `err instanceof Error ? err.message : "Failed to generate suggestions"`
- `src/components/track/FluidSection.tsx` (line 71): `err instanceof Error ? err.message : "Failed to log fluid."`
- `src/components/track/FoodSection.tsx` (line 36): `err instanceof Error ? err.message : "Failed to log food."`
- `src/components/track/WeightEntryDrawer.tsx` (line 160): `err instanceof Error ? err.message : "Failed to log weight."`
- `src/components/track/SleepEntryDrawer.tsx` (line 87): `err instanceof Error ? err.message : "Failed to log sleep."`
- `src/lib/foodParsing.ts` (line 275): `error instanceof Error ? error.message : String(error)`

**Recommendation:** Replace all inline patterns with `getErrorMessage(err)` from `@/lib/errors`. For cases needing a custom fallback string, create an overload:
```typescript
export function getErrorMessage(err: unknown, fallback?: string): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return fallback ?? "An unknown error occurred";
}
```

---

### OV-10 — Deprecated exports still present [LOW]

**Files:**
- `src/lib/aiAnalysis.ts` (line 18): `DEFAULT_AI_MODEL` (deprecated, use `DEFAULT_INSIGHT_MODEL`)
- `src/lib/foodParsing.ts` (line 3): `FOOD_PARSE_MODEL` (deprecated, use `BACKGROUND_MODEL`)
- `src/components/track/ActivitySection.tsx` (line 168): `ActivitySection` (deprecated, use `HealthSection`)

**Recommendation:** Search for any consumers of these deprecated exports. If none remain, remove the deprecated re-exports to reduce confusion.

---

### OV-11 — `toCoffeeCupCount` reimplemented with slight variation [LOW]

**Files:**
- `src/lib/habitCoaching.ts` (line 26): `toCoffeeCupCount(habit, ml)` -- returns `null` if not coffee
- `src/lib/habitProgress.ts` (line 35): `getCaffeineCapEntries(habit)` -- returns cap in entry count
- `src/components/DailyProgress.tsx` (line 39): `toDisplayUnits(value, habit)` -- divides by quickIncrement

All three convert between ml and "cup count" for caffeine habits, using slightly different approaches. Each duplicates the core logic of dividing by `quickIncrement`.

**Recommendation:** Create a single `mlToCups(ml: number, habit: HabitConfig): number` utility in `habitTemplates.ts`.

---

## Category 7: Simplification Opportunities

### S-01 — Overly complex celebration logic in `Track.tsx` `handleQuickCaptureTap` [HIGH]

**File:** `src/pages/Track.tsx` (lines 585-659)

The `handleQuickCaptureTap` function is 75 lines long with deeply nested conditionals for target-met/cap-exceeded celebrations. The celebration logic for target habits is duplicated between `handleQuickCaptureTap` and `handleLogSleepQuickCapture` (lines 493-510).

```typescript
// Pattern repeated for both target check and cap check:
if (isTargetHabit(habit) && habit.dailyTarget) {
  const newFluidMl =
    habit.logAs === "fluid"
      ? (todayFluidTotalsByName[habit.name.toLowerCase()] ?? 0) + habit.quickIncrement
      : 0;
  const newCount = (todayHabitCounts[habit.id] ?? 0) + (habit.logAs === "fluid" ? 0 : 1);
  const checkValue = habit.logAs === "fluid" ? newFluidMl : newCount * habit.quickIncrement;
  const prevValue =
    habit.logAs === "fluid"
      ? (todayFluidTotalsByName[habit.name.toLowerCase()] ?? 0)
      : (todayHabitCounts[habit.id] ?? 0) * habit.quickIncrement;
  if (checkValue >= habit.dailyTarget && prevValue < habit.dailyTarget) {
    const celebrationConfig = getCelebration(habit, streakSummaries[habit.id] ?? null);
    if (celebrationConfig.intensity === "big" || celebrationConfig.intensity === "medium") {
      celebrateGoalComplete(celebrationConfig.message);
    } else {
      toast.success(celebrationConfig.message);
    }
  }
}
```

**Recommendation:** Extract a `checkAndCelebrate(habit, prevValue, newValue)` helper that encapsulates the threshold-crossing check and celebration dispatch. Use it in both `handleQuickCaptureTap` and `handleLogSleepQuickCapture`.

---

### S-02 — Large `Track.tsx` page component (830+ lines) [HIGH]

**File:** `src/pages/Track.tsx`

This file is the largest component at 832 lines. It contains:
- 6 handler functions for different log types (food, fluid, bowel, sleep, weight, cycle)
- Inline celebration logic duplicated between handlers
- `computeTodayHabitCounts` (should be shared)
- `bristolToConsistency` (should be shared)
- `normalizeEpisodes` (should be shared)
- Memoized state computations for fluid totals, BM counts, etc.

**Recommendation:** Extract:
1. `bristolToConsistency`, `normalizeEpisodes`, `computeTodayHabitCounts` into shared lib files (see OV-03, OV-04, OV-05).
2. Extract a `useTrackPageState` custom hook that encapsulates the memoized state (todayLogs, todayFluidTotalsByName, todayFluidEntryCounts, totalFluidMl, todayBmCount, lastBmTimestamp).
3. Extract a `useLogHandlers` hook that encapsulates the save/delete/update handler functions.

---

### S-03 — Zustand store migration function is monolithic (lines 697-831) [MODERATE]

**File:** `src/store.ts` (lines 697-831)

The `migrate` function in the persist middleware is 135 lines of sequential migration logic. It runs on every load regardless of version, with interleaved concerns (fluidDefaults, habits, habitLogs, fluidPresets, gamification, sleepGoal, healthProfile conditions normalization, drPooReplies, aiPreferences).

While it is marked as "ALL migration logic MUST be idempotent" and each section is guarded, the length makes it hard to follow.

**Recommendation:** Extract each migration section into a named function:
```typescript
function migrateHabits(persisted: any, fluidDefaults: any): void { ... }
function migrateHabitLogs(persisted: any): void { ... }
function migrateFluidPresets(persisted: any): void { ... }
function migrateHealthProfile(persisted: any): void { ... }
// etc.
```
Then the `migrate` function becomes a clean sequence of calls.

---

### S-04 — `useAiInsights` hook uses excessive refs pattern [MODERATE]

**File:** `src/hooks/useAiInsights.ts`

This hook maintains 11 separate `useRef` instances to keep mutable snapshots of reactive data for the async callback:

```typescript
const logsRef = useRef(logs);
logsRef.current = logs;
const historyRef = useRef(analysisHistory);
historyRef.current = analysisHistory;
const repliesRef = useRef(drPooReplies);
repliesRef.current = drPooReplies;
const healthProfileRef = useRef(healthProfile);
healthProfileRef.current = healthProfile;
const aiPreferencesRef = useRef(aiPreferences);
aiPreferencesRef.current = aiPreferences;
const foodTrialsRef = useRef(foodTrials);
foodTrialsRef.current = foodTrials;
const weeklyDigestsRef = useRef(weeklyDigests);
weeklyDigestsRef.current = weeklyDigests;
const conversationHistoryRef = useRef(conversationHistory);
conversationHistoryRef.current = conversationHistory;
const recentSuggestionsRef = useRef(recentSuggestions);
recentSuggestionsRef.current = recentSuggestions;
const latestWeeklySummaryRef = useRef(latestWeeklySummary);
latestWeeklySummaryRef.current = latestWeeklySummary;
const addAssistantMessageRef = useRef(addAssistantMessage);
addAssistantMessageRef.current = addAssistantMessage;
```

**Recommendation:** Group related refs into a single ref object:
```typescript
const dataRef = useRef({
  logs, healthProfile, aiPreferences, foodTrials,
  weeklyDigests, conversationHistory, recentSuggestions,
  latestWeeklySummary, history: analysisHistory,
  replies: drPooReplies, addAssistantMessage,
});
// Single update
dataRef.current = {
  logs, healthProfile, aiPreferences, foodTrials,
  weeklyDigests, conversationHistory, recentSuggestions,
  latestWeeklySummary, history: analysisHistory,
  replies: drPooReplies, addAssistantMessage,
};
```

This reduces 22 lines to ~5 lines and makes the pattern clearer.

---

### S-05 — `useCoaching` hook duplicates the refs pattern from `useAiInsights` [MODERATE]

**File:** `src/hooks/useCoaching.ts`

Same pattern as S-04 -- 6 refs manually mirroring reactive state. The same grouped-ref improvement applies.

---

### S-06 — `analysis.ts` factor correlation builder functions are highly repetitive [MODERATE]

**File:** `src/lib/analysis.ts` (lines 632-765)

Four nearly identical functions: `buildWalkCorrelation`, `buildSmokingCorrelation`, `buildSleepCorrelation`, `buildFluidCorrelation`. Each:
1. Partitions days into "with" / "without" based on a condition
2. Calls `buildDayMetrics(withDays, withoutDays)`
3. Returns a `FactorCorrelation` object with the same structure

The only differences are the partition logic and the returned `factor`/`metric` strings.

**Recommendation:** Extract a generic builder:
```typescript
function buildFactorCorrelation(
  days: DayData[],
  factor: string,
  metric: string,
  partitionFn: (day: DayData) => boolean,
): FactorCorrelation {
  const withDays = days.filter(partitionFn);
  const withoutDays = days.filter((d) => !partitionFn(d));
  const { avgBristolWith, avgBristolWithout, looseRateWith, looseRateWithout } =
    buildDayMetrics(withDays, withoutDays);
  return {
    factor, metric,
    daysWithFactor: withDays.length,
    daysWithout: withoutDays.length,
    avgBristolWith, avgBristolWithout,
    looseRateWith, looseRateWithout,
    signal: computeFactorSignal(looseRateWith, looseRateWithout, withDays.length, withoutDays.length),
  };
}
```

This would replace ~130 lines with ~30 lines. The smoking correlation would need special handling for its median-split logic, but walk/sleep/fluid can all use the generic pattern.

---

### S-07 — `buildSmokingCorrelation` has a special-case early return that duplicates metric calculation [LOW]

**File:** `src/lib/analysis.ts` (lines 658-707)

When there are no smoking days, the function manually computes metrics for the "without" group (lines 662-677) instead of just calling the shared `buildDayMetrics` pattern. This creates a separate code path that must be maintained independently.

**Recommendation:** Handle the zero-case as part of the generic builder by checking `daysWithFactor === 0` after building metrics.

---

### S-08 — `foodParsing.ts` creates a new OpenAI client instead of using `getOpenAIClient` [MODERATE]

**File:** `src/lib/foodParsing.ts` (lines 260-261)

```typescript
const { default: OpenAI } = await import("openai");
const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
```

Every other AI call in the codebase uses the cached `getOpenAIClient(apiKey)` from `openaiClient.ts`, but `parseFood` creates a fresh client every time.

**Recommendation:** Replace with `const client = await getOpenAIClient(apiKey);` for consistency and caching.

---

### S-09 — `parseAiInsight` in `store.ts` uses repetitive null-checking pattern [LOW]

**File:** `src/store.ts` (lines 479-498)

```typescript
export function parseAiInsight(raw: unknown): AiNutritionistInsight | null {
  if (raw == null || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.summary !== "string") return null;
  return {
    suspectedCulprits: Array.isArray(obj.suspectedCulprits) ? obj.suspectedCulprits : [],
    likelySafe: Array.isArray(obj.likelySafe) ? obj.likelySafe : [],
    mealPlan: Array.isArray(obj.mealPlan) ? obj.mealPlan : [],
    nextFoodToTry: obj.nextFoodToTry != null && typeof obj.nextFoodToTry === "object"
      ? (obj.nextFoodToTry as AiNutritionistInsight["nextFoodToTry"])
      : { food: "", reasoning: "", timing: "" },
    miniChallenge: obj.miniChallenge != null && typeof obj.miniChallenge === "object"
      ? (obj.miniChallenge as AiNutritionistInsight["miniChallenge"])
      : null,
    suggestions: Array.isArray(obj.suggestions) ? obj.suggestions : [],
    summary: obj.summary as string,
  };
}
```

This is fine but could use small helpers like `arrayOrDefault(value, [])` and `objectOrDefault(value, fallback)` if it grows.

**Impact:** Low -- the function is readable as-is.

---

### S-10 — `habitCoaching.ts` heuristic suggestion validation is verbose [LOW]

**File:** `src/lib/habitCoaching.ts` (lines 596-613)

The `generateSettingsSuggestions` function's validation loop uses a long chain of type assertions:

```typescript
if (
  item &&
  typeof item === "object" &&
  typeof (item as Record<string, unknown>).habitId === "string" &&
  typeof (item as Record<string, unknown>).suggestion === "string" &&
  typeof (item as Record<string, unknown>).newValue === "number" &&
  knownIds.has((item as Record<string, unknown>).habitId as string)
) {
  results.push({
    habitId: (item as Record<string, unknown>).habitId as string,
    suggestion: (item as Record<string, unknown>).suggestion as string,
    newValue: (item as Record<string, unknown>).newValue as number,
  });
}
```

**Recommendation:** Cast once and use a named variable:
```typescript
for (const item of parsed) {
  const obj = item as Record<string, unknown> | null;
  if (!obj) continue;
  const { habitId, suggestion, newValue } = obj;
  if (
    typeof habitId === "string" &&
    typeof suggestion === "string" &&
    typeof newValue === "number" &&
    knownIds.has(habitId)
  ) {
    results.push({ habitId, suggestion, newValue });
  }
}
```

---

### S-11 — Nested ternary for progress text color in `QuickCaptureTile.tsx` [COULD BE IMPROVED]

**File:** `src/components/track/QuickCaptureTile.tsx` (lines 141-148)

```typescript
const progressTextColor =
  tint === "red"
    ? "text-red-400"
    : tint === "emerald"
      ? "text-emerald-400"
      : tint === "yellow"
        ? "text-amber-400"
        : "text-[var(--text-muted)]";
```

**Recommendation:** Use a lookup map for clarity:
```typescript
const TINT_TEXT_COLORS: Record<TileColorTint, string> = {
  default: "text-[var(--text-muted)]",
  emerald: "text-emerald-400",
  yellow: "text-amber-400",
  muted: "text-[var(--text-muted)]",
  red: "text-red-400",
};
const progressTextColor = TINT_TEXT_COLORS[tint];
```

This is consistent with how `TINT_CLASSES` (line 27) is already structured.

---

### S-12 — `StatusBadge` in `FoodSafetyDatabase.tsx` uses if/else chain instead of map [COULD BE IMPROVED]

**File:** `src/components/patterns/FoodSafetyDatabase.tsx` (lines 49-89)

The `StatusBadge` component uses a 6-branch if/else chain to assign `color`, `bg`, and `border`:

```typescript
if (status === "safe") {
  color = "var(--section-observe)";
  bg = "var(--section-observe-muted)";
  border = "var(--section-observe-border)";
} else if (status === "safe-loose") { ... }
// ... 4 more branches
```

**Recommendation:** Use a lookup map:
```typescript
const STATUS_THEME: Record<FoodStatus, { color: string; bg: string; border: string }> = {
  safe:         { color: "var(--section-observe)", bg: "var(--section-observe-muted)", border: "var(--section-observe-border)" },
  "safe-loose": { color: "var(--section-quick)",   bg: "var(--section-quick-muted)",   border: "var(--section-quick-border)" },
  // ...
};
```

---

### S-13 — `getHabitIcon` in `habitIcons.tsx` uses long if-chain [COULD BE IMPROVED]

**File:** `src/lib/habitIcons.tsx` (lines 20-63)

A 14-clause if chain maps habit IDs/types to icons. Each clause checks both `habit.id` and `habit.habitType`.

**Recommendation:** This is borderline -- the current code is clear and easy to add new cases to. A map-based approach might be more compact but would require handling the dual-key lookup. The current approach is acceptable but could be simplified to check `habitType` first (since it covers all cases) and only fall back to `habit.id` for custom habits.

---

### S-14 — `settingsUtils.ts` duplicates `VALID_USAGE_FREQUENCIES` from store migration [LOW]

**Files:**
- `src/lib/settingsUtils.ts` (line 19): `VALID_USAGE_FREQUENCIES` Set
- `src/store.ts` (line 783): `validFrequencies` Set (inline in migration)

Both define the same set of valid usage frequency strings.

**Recommendation:** Import `VALID_USAGE_FREQUENCIES` from `settingsUtils.ts` in the store migration, or export a `UsageFrequency` type-guard from `settingsUtils.ts` that the store can use.

---

### S-15 — `DailyProgress.tsx` component is unused or underused [COULD BE IMPROVED]

**File:** `src/components/DailyProgress.tsx`

This component computes habit progress with its own `computeTodayHabitCounts` and `getHabitGoal` helpers. It is not imported in `Track.tsx` (which handles habit progress display via `QuickCapture` and `TodayStatusRow`).

**Recommendation:** Verify whether `DailyProgress` is actually rendered anywhere. If not, consider removing it to eliminate dead code and the duplicate `computeTodayHabitCounts`. If it is used (e.g., in a route not covered by this audit), merge its `computeTodayHabitCounts` with the shared version.

---

### S-16 — `findStalledFoods` in `analysis.ts` is defined but only called within `buildInsightText` [LOW]

**File:** `src/lib/analysis.ts` (lines 495-510)

The function `findStalledFoods` is a well-defined utility, but it is only used in one place (`buildInsightText`, line 836). Since it is not exported, it could be inlined. However, keeping it as a named function is reasonable for readability.

**Impact:** No action needed -- noting for awareness.

---

## Summary Table

| ID    | Severity          | Type       | Description                                                   | Files Affected |
|-------|-------------------|------------|---------------------------------------------------------------|----------------|
| OV-01 | HIGH              | Overlap    | Duplicate `DrPooReply` interface                              | 2              |
| OV-02 | HIGH              | Overlap    | Duplicate `isCoffeeFluidHabit` / `isCaffeineHabit`           | 3              |
| OV-03 | HIGH              | Overlap    | Duplicate `bristolToConsistency` / `normalizeDigestiveCategory` | 2            |
| OV-04 | HIGH              | Overlap    | Duplicate `normalizeEpisodes` / `normalizeEpisodesCount`      | 2              |
| OV-05 | HIGH              | Overlap    | Duplicate `computeTodayHabitCounts`                           | 2              |
| OV-06 | MODERATE          | Overlap    | Duplicate `BLOCKED_FLUID_PRESET_NAMES` / `HARDWIRED_FLUID_NAMES` | 2          |
| OV-07 | MODERATE          | Overlap    | Duplicate `STATUS_ORDER` map                                  | 2              |
| OV-08 | MODERATE          | Overlap    | Overlapping date formatting functions                         | 2              |
| OV-09 | MODERATE          | Overlap    | Inline error extraction instead of using `getErrorMessage`    | 7+             |
| OV-10 | LOW               | Overlap    | Deprecated exports still present                              | 3              |
| OV-11 | LOW               | Overlap    | `toCoffeeCupCount` / `getCaffeineCapEntries` / `toDisplayUnits` | 3            |
| S-01  | HIGH              | Simplify   | Overly complex celebration logic in Track.tsx                 | 1              |
| S-02  | HIGH              | Simplify   | Track.tsx is 830+ lines, needs extraction                     | 1              |
| S-03  | MODERATE          | Simplify   | Monolithic store migration function                           | 1              |
| S-04  | MODERATE          | Simplify   | Excessive refs pattern in `useAiInsights`                     | 1              |
| S-05  | MODERATE          | Simplify   | Excessive refs pattern in `useCoaching`                       | 1              |
| S-06  | MODERATE          | Simplify   | Repetitive factor correlation builders                        | 1              |
| S-07  | LOW               | Simplify   | Smoking correlation special-case early return                 | 1              |
| S-08  | MODERATE          | Simplify   | `foodParsing.ts` creates new OpenAI client instead of cached  | 1              |
| S-09  | LOW               | Simplify   | Repetitive null-checking in `parseAiInsight`                  | 1              |
| S-10  | LOW               | Simplify   | Verbose type assertion chain in suggestion validation         | 1              |
| S-11  | COULD BE IMPROVED | Simplify   | Nested ternary for progress text color                        | 1              |
| S-12  | COULD BE IMPROVED | Simplify   | `StatusBadge` if/else chain                                   | 1              |
| S-13  | COULD BE IMPROVED | Simplify   | `getHabitIcon` long if-chain                                  | 1              |
| S-14  | LOW               | Overlap    | Duplicate `VALID_USAGE_FREQUENCIES` set                       | 2              |
| S-15  | COULD BE IMPROVED | Simplify   | `DailyProgress.tsx` may be dead code with duplicate logic     | 1              |
| S-16  | LOW               | Info       | `findStalledFoods` used only once                             | 1              |

---

## Prioritized Remediation Order

### Phase 1 -- Quick wins (eliminate all HIGH overlaps)
1. **OV-02**: Extract `isCaffeineHabit` to `habitTemplates.ts`, import everywhere
2. **OV-03**: Extract `bristolCodeToCategory` from `analysis.ts`, replace `bristolToConsistency` in `Track.tsx`
3. **OV-04**: Export `normalizeEpisodesCount` from `analysis.ts`, import in `Track.tsx`
4. **OV-05**: Extract shared `computeHabitCountsInRange` to `habitAggregates.ts`
5. **OV-01**: Delete `DrPooReply` from `aiAnalysis.ts`, re-export from store

### Phase 2 -- Moderate overlaps
6. **OV-06**: Import `BLOCKED_FLUID_PRESET_NAMES` in `FluidSection.tsx`
7. **OV-07**: Export `STATUS_ORDER` from `analysis.ts`
8. **OV-08**: Consolidate date key formatting to `formatLocalDateKey`
9. **OV-09**: Replace inline error extraction with `getErrorMessage`
10. **S-08**: Use `getOpenAIClient` in `foodParsing.ts`

### Phase 3 -- Simplification refactors
11. **S-01 + S-02**: Extract celebration helper and split `Track.tsx`
12. **S-04 + S-05**: Group refs in insight/coaching hooks
13. **S-06**: Extract generic factor correlation builder
14. **S-03**: Split store migration into named functions
