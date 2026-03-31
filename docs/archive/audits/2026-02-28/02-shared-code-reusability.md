# Category 3: Shared Code & Reusability Audit

**Date:** 2026-02-28
**Scope:** `/Users/peterjamesblizzard/projects/caca_traca/src/`
**Auditor:** Claude Opus 4.6

---

## Executive Summary

The codebase has a reasonable shared code infrastructure in `src/lib/` and `src/hooks/`, but there are several meaningful areas where logic is duplicated across components and modules. The most impactful findings involve:

1. **Bristol code-to-consistency mapping** duplicated across files with divergent implementations
2. **Time duration constants** (`MS_PER_HOUR`, `MS_PER_MINUTE`, `MS_PER_DAY`) redefined in 5+ files
3. **Weight unit conversion** (`kg * 2.20462`) scattered inline across 5 files instead of using the existing `formatWeight` utility
4. **Error message extraction** (`err instanceof Error ? err.message : ...`) repeated 10+ times instead of using the existing `getErrorMessage` utility
5. **Date key formatting** duplicated in `DigestiveCorrelationGrid.tsx` despite existing `formatLocalDateKey` in `habitAggregates.ts`
6. **Caffeine habit detection** logic repeated in 3 files with subtle variations
7. **`DrPooReply` interface** defined in both `store.ts` and `aiAnalysis.ts`
8. **`computeTodayHabitCounts`** function duplicated in `Track.tsx` and `DailyProgress.tsx`
9. **`normalizeEpisodes` / `normalizeEpisodesCount`** duplicated with slight signature differences

---

## Findings

### F-01: Duplicated Bristol Code-to-Consistency Mapping

**Severity:** HIGH

The mapping from Bristol Stool Scale codes to digestive consistency categories exists in two places with the same logic but different function signatures:

**File 1:** `/Users/peterjamesblizzard/projects/caca_traca/src/pages/Track.tsx` (lines 49-59)
```typescript
// Bristol code to consistency tag -- matches the logic in analysis.ts
function bristolToConsistency(
  code: number,
): "constipated" | "hard" | "firm" | "loose" | "diarrhea" {
  if (code >= 7) return "diarrhea";
  if (code === 6) return "loose";
  if (code <= 1) return "constipated";
  if (code === 2) return "hard";
  return "firm";
}
```

**File 2:** `/Users/peterjamesblizzard/projects/caca_traca/src/lib/analysis.ts` (lines 767-790)
```typescript
function normalizeDigestiveCategory(data: any): DigestiveCategory | null {
  const tag = readText(data?.consistencyTag).toLowerCase();
  // ... first tries the tag, then falls back to bristol code ...
  const code = Number(data?.bristolCode);
  if (Number.isFinite(code)) {
    if (code >= 7) return "diarrhea";
    if (code === 6) return "loose";
    if (code <= 1) return "constipated";
    if (code === 2) return "hard";
    return "firm";
  }
  return null;
}
```

The comment on line 49 of `Track.tsx` explicitly says "matches the logic in analysis.ts", confirming this is intentional duplication. The `Track.tsx` version takes a plain number; the `analysis.ts` version takes the full data object and includes a consistency-tag fallback path.

**Recommendation:** Extract a shared `bristolCodeToCategory(code: number)` function into `src/lib/analysis.ts` (or a new `src/lib/digestiveConstants.ts`) and have both call sites use it. The `DigestiveCategory` type should also be exported.

---

### F-02: Time Duration Constants Redefined in Multiple Files

**Severity:** HIGH

The same millisecond constants are redefined in at least 5 separate files:

| Constant | Files |
|---|---|
| `MS_PER_MINUTE = 60 * 1000` | `src/lib/analysis.ts:94`, `src/components/track/ObservationWindow.tsx:13` |
| `MS_PER_HOUR = 60 * 60 * 1000` | `src/lib/analysis.ts:95`, `src/lib/aiAnalysis.ts:100`, `src/components/track/ObservationWindow.tsx:12` |
| `MS_PER_DAY = 24 * 60 * 60 * 1000` | `src/pages/Track.tsx:47` |
| `MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000` | `src/hooks/useAiInsights.ts:23` |
| Inline `24 * 60 * 60 * 1000` | `src/store.ts:474`, `src/store.ts:625`, `src/components/patterns/DigestiveCorrelationGrid.tsx:61`, `src/components/settings/AiSuggestionsCard.tsx:39` |

**Recommendation:** Create `src/lib/timeConstants.ts` exporting `MS_PER_MINUTE`, `MS_PER_HOUR`, `MS_PER_DAY`, `MS_PER_WEEK`. Import everywhere instead of redefining.

---

### F-03: Weight Unit Conversion Scattered Inline

**Severity:** HIGH

The `kg * 2.20462` conversion factor appears in 10 locations across 5 files, despite `src/lib/formatWeight.ts` already providing `formatWeight()` and `formatWeightDelta()`:

**Already using the shared utility:**
- `src/components/patterns/WeightTracker.tsx:87,104,119` (uses `formatWeight` and `formatWeightDelta`)

**NOT using the shared utility (inline `2.20462`):**
- `/Users/peterjamesblizzard/projects/caca_traca/src/components/track/WeightTrendCard.tsx` (lines 9-14) - **re-declares its own `formatWeight` function** that is identical to the one in `src/lib/formatWeight.ts`
- `/Users/peterjamesblizzard/projects/caca_traca/src/components/track/TodayLog.tsx` (lines 2312, 2320, 2330, 2343, 2888) - inline `kg * 2.20462`
- `/Users/peterjamesblizzard/projects/caca_traca/src/components/track/ActivitySection.tsx` (line 66) - inline `raw / 2.20462`

The `WeightTrendCard.tsx` duplication is especially clear:

```typescript
// WeightTrendCard.tsx lines 9-14 -- exact copy of lib/formatWeight.ts
function formatWeight(kg: number, unit: "kg" | "lbs"): string {
  if (unit === "lbs") {
    return `${(kg * 2.20462).toFixed(1)} lbs`;
  }
  return `${kg.toFixed(1)} kg`;
}
```

**Recommendation:** Replace all inline conversions with imports from `src/lib/formatWeight.ts`. Also add helper functions like `kgToLbs(kg: number)` and `lbsToKg(lbs: number)` for the raw conversion used in `ActivitySection.tsx` and `TodayLog.tsx`.

---

### F-04: Error Message Extraction Not Using Existing Utility

**Severity:** MODERATE

`src/lib/errors.ts` exports `getErrorMessage()`:
```typescript
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "An unknown error occurred";
}
```

However, **10+ locations** use the inline pattern instead of calling `getErrorMessage`:

| File | Line | Pattern |
|---|---|---|
| `src/lib/aiAnalysis.ts` | 1315 | `error instanceof Error ? error.message : String(error)` |
| `src/lib/foodParsing.ts` | 275 | `error instanceof Error ? error.message : String(error)` |
| `src/components/settings/AiSuggestionsCard.tsx` | 67 | `err instanceof Error ? err.message : "Failed to generate suggestions"` |
| `src/components/settings/AppDataForm.tsx` | 87, 178 | `error instanceof Error ? error.message : "Failed to save profile."` |
| `src/components/track/FoodSection.tsx` | 36 | `err instanceof Error ? err.message : "Failed to log food."` |
| `src/components/track/FluidSection.tsx` | 71 | `err instanceof Error ? err.message : "Failed to log fluid."` |
| `src/components/track/SleepEntryDrawer.tsx` | 87 | `err instanceof Error ? err.message : "Failed to log sleep."` |
| `src/components/track/WeightEntryDrawer.tsx` | 160 | `err instanceof Error ? err.message : "Failed to log weight."` |
| `src/hooks/useAiInsights.ts` | 224 | `err instanceof Error ? err.message : String(err)` |
| `src/pages/landing/components/PricingSection.tsx` | 48 | `err instanceof Error ? err.message : "Something went wrong."` |

Note that some use `String(error)` as the fallback while others use a custom string. The `getErrorMessage` utility could be enhanced to accept a fallback parameter.

**Recommendation:** Enhance `getErrorMessage` with an optional fallback parameter and replace all inline patterns:
```typescript
export function getErrorMessage(err: unknown, fallback = "An unknown error occurred"): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return fallback;
}
```

---

### F-05: Date Key Formatting Duplicated in DigestiveCorrelationGrid

**Severity:** MODERATE

`src/lib/habitAggregates.ts` exports `formatLocalDateKey(input: Date | number): string` which produces a `YYYY-MM-DD` date string. This is already used by 8+ files.

However, `/Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/DigestiveCorrelationGrid.tsx` (lines 64-68) defines its own identical function:

```typescript
function formatDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
```

Similarly, `src/lib/analysis.ts` (line 517) also builds the same date key inline:
```typescript
const dayKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
```

And `src/lib/reproductiveHealth.ts` (lines 58-63) has its own variants:
```typescript
export function getDateKeyFromTimestamp(timestamp: number): string {
  return format(new Date(timestamp), "yyyy-MM-dd");
}
export function getTodayDateKey(): string {
  return format(new Date(), "yyyy-MM-dd");
}
```

**Recommendation:** Consolidate all `YYYY-MM-DD` date formatting to use `formatLocalDateKey` from `habitAggregates.ts`, or move it to a more general-purpose location like `src/lib/dateUtils.ts`. The `reproductiveHealth.ts` variants (`getDateKeyFromTimestamp`, `getTodayDateKey`) could be thin wrappers around the same function.

---

### F-06: Duplicated `DrPooReply` Interface

**Severity:** MODERATE

The `DrPooReply` interface is defined in two files:

**File 1:** `/Users/peterjamesblizzard/projects/caca_traca/src/store.ts` (lines 213-216)
```typescript
export interface DrPooReply {
  text: string;
  timestamp: number;
}
```

**File 2:** `/Users/peterjamesblizzard/projects/caca_traca/src/lib/aiAnalysis.ts` (lines 31-34)
```typescript
export interface DrPooReply {
  text: string;
  timestamp: number;
}
```

Both are structurally identical but independently declared.

**Recommendation:** Remove the duplicate from `aiAnalysis.ts` and import it from `store.ts` (where the source of truth for persistence lives), or extract it to a shared types file.

---

### F-07: Caffeine Habit Detection Logic Duplicated in 3 Files

**Severity:** MODERATE

The pattern to detect whether a habit is a caffeine/coffee fluid habit appears in three different forms:

**File 1:** `/Users/peterjamesblizzard/projects/caca_traca/src/lib/habitProgress.ts` (lines 27-32)
```typescript
function isCaffeineHabit(habit: HabitConfig): boolean {
  return (
    habit.logAs === "fluid" &&
    (habit.id === "habit_coffee" || habit.habitType === "caffeine")
  );
}
```

**File 2:** `/Users/peterjamesblizzard/projects/caca_traca/src/lib/habitCoaching.ts` (lines 18-20)
```typescript
function isCoffeeFluidHabit(habit: HabitConfig): boolean {
  return habit.logAs === "fluid" && (habit.id === "habit_coffee" || habit.habitType === "caffeine");
}
```

**File 3:** `/Users/peterjamesblizzard/projects/caca_traca/src/pages/Track.tsx` (lines 629-631)
```typescript
const isCaffeine =
  habit.logAs === "fluid" &&
  (habit.id === "habit_coffee" || habit.habitType === "caffeine");
```

All three are semantically identical but have different function names (`isCaffeineHabit` vs `isCoffeeFluidHabit` vs inline).

**Recommendation:** Export `isCaffeineHabit` from `src/lib/habitTemplates.ts` (alongside `isDigestiveHabit`, `isCapHabit`, `isTargetHabit`) and import it everywhere.

---

### F-08: `computeTodayHabitCounts` Duplicated in Two Files

**Severity:** MODERATE

**File 1:** `/Users/peterjamesblizzard/projects/caca_traca/src/pages/Track.tsx` (lines 73-85)
```typescript
function computeTodayHabitCounts(
  habitLogs: Array<{ habitId: string; value: number; at: number }>,
  todayStart: number,
  todayEnd: number,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const log of habitLogs) {
    if (log.at >= todayStart && log.at < todayEnd) {
      counts[log.habitId] = (counts[log.habitId] ?? 0) + log.value;
    }
  }
  return counts;
}
```

**File 2:** `/Users/peterjamesblizzard/projects/caca_traca/src/components/DailyProgress.tsx` (lines 22-33)
```typescript
function computeTodayHabitCounts(
  habitLogs: HabitLog[],
  todayStart: number,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const log of habitLogs) {
    if (log.at >= todayStart) {
      counts[log.habitId] = (counts[log.habitId] ?? 0) + log.value;
    }
  }
  return counts;
}
```

The `Track.tsx` version filters by both `todayStart` and `todayEnd`; the `DailyProgress.tsx` version only filters by `todayStart`. Both serve the same purpose (summing habit log values for today).

**Recommendation:** Extract to `src/lib/habitAggregates.ts` with the `todayEnd` parameter being optional for backwards compatibility:
```typescript
export function computeHabitCountsForRange(
  habitLogs: HabitLog[],
  startMs: number,
  endMs?: number,
): Record<string, number> { ... }
```

---

### F-09: `normalizeEpisodes` / `normalizeEpisodesCount` Duplicated

**Severity:** MODERATE

**File 1:** `/Users/peterjamesblizzard/projects/caca_traca/src/pages/Track.tsx` (lines 61-65)
```typescript
function normalizeEpisodes(value: unknown): number {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.min(parsed, 20);
}
```

**File 2:** `/Users/peterjamesblizzard/projects/caca_traca/src/lib/analysis.ts` (lines 907-911)
```typescript
function normalizeEpisodesCount(value: unknown): number {
  const count = Number(value);
  if (!Number.isFinite(count)) return 1;
  return Math.min(Math.max(Math.floor(count), 1), 20);
}
```

Both clamp to [1, 20] and parse an unknown value to a number. The implementations differ slightly: `Track.tsx` uses `Math.floor` before `isFinite`; `analysis.ts` does `isFinite` check on the raw value then clamps. The semantic behavior is equivalent.

**Recommendation:** Export a single `normalizeEpisodesCount` from a shared location (e.g., `src/lib/digestiveUtils.ts` or `src/lib/analysis.ts`) and import it in `Track.tsx`.

---

### F-10: `readText` Helper Buried in `analysis.ts`

**Severity:** LOW

`src/lib/analysis.ts` (lines 902-905) defines a private `readText` utility:
```typescript
function readText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}
```

This is used 6 times within `analysis.ts` for safely reading potentially-null/undefined string fields from log data. The same pattern of safe-reading unknown values to trimmed strings appears in several other files through different inline approaches.

**Recommendation:** If more code needs this pattern, export it from a shared utility. Currently the usage is contained within `analysis.ts`, so this is low priority.

---

### F-11: `LogType` Union Type vs `SyncedLog["type"]`

**Severity:** LOW

The log type union is defined in two places:

**File 1:** `/Users/peterjamesblizzard/projects/caca_traca/src/store.ts` (lines 28-35)
```typescript
export type LogType =
  | "food" | "fluid" | "habit" | "activity"
  | "digestion" | "weight" | "reproductive";
```

**File 2:** `/Users/peterjamesblizzard/projects/caca_traca/src/lib/sync.ts` (line 14)
```typescript
type: "food" | "fluid" | "habit" | "activity" | "digestion" | "weight" | "reproductive";
```

The `SyncedLog` type in `sync.ts` duplicates the union inline rather than referencing `LogType` from the store. If a new log type were added, both would need updating.

**Recommendation:** Have `SyncedLog` reference the `LogType` from `store.ts`:
```typescript
import type { LogType } from "@/store";
export type SyncedLog = {
  id: string;
  timestamp: number;
  type: LogType;
  data: any;
};
```

---

### F-12: `DigestiveCategory` Type Not Exported

**Severity:** LOW

`src/lib/analysis.ts` (line 3) defines:
```typescript
type DigestiveCategory = "constipated" | "hard" | "firm" | "loose" | "diarrhea";
```

This type is used implicitly by `Track.tsx` (`bristolToConsistency` return type) and conceptually by `BowelSection.tsx`, but it is never exported. This means the return type of `bristolToConsistency` duplicates the union.

**Recommendation:** Export `DigestiveCategory` from `analysis.ts` (or the new `digestiveConstants.ts`) so it can be referenced in `Track.tsx`.

---

### F-13: Section Header UI Pattern Repeated Without Abstraction

**Severity:** COULD BE IMPROVED

The section header pattern (icon + title) appears 20+ times across track sections:

```tsx
<div className="section-header">
  <div className="section-icon" style={{ backgroundColor: "var(--section-food-muted)" }}>
    <Soup className="w-4 h-4" style={{ color: "var(--section-food)" }} />
  </div>
  <span className="section-title" style={{ color: "var(--section-food)" }}>
    Food
  </span>
</div>
```

This pattern is used in: `FoodSection.tsx`, `FluidSection.tsx`, `BowelSection.tsx`, `ObservationWindow.tsx`, `CycleHormonalSection.tsx`, `ActivitySection.tsx`, `WeightTrendCard.tsx`, `FactorInsights.tsx`, `MealPlanSection.tsx`, `NextFoodCard.tsx`, `FoodSafetyDatabase.tsx`, `ReproductiveHealthPatterns.tsx`, `WeightTracker.tsx`, `DigestiveCorrelationGrid.tsx`, etc.

While the CSS classes (`section-header`, `section-icon`, `section-title`) help with consistency, the HTML structure and inline style attributes are repeated verbatim.

**Recommendation:** Extract a `<SectionHeader icon={Soup} title="Food" colorVar="section-food" />` component. This would reduce markup repetition and ensure all sections share the exact same structure. Given that the pattern is already well-established through CSS classes, this is lower priority than the logic duplication findings above.

---

### F-14: Fluid Preset Constants Duplicated

**Severity:** COULD BE IMPROVED

Fluid preset constants and blocked names are defined in two places:

**File 1:** `/Users/peterjamesblizzard/projects/caca_traca/src/store.ts` (lines 384-395)
```typescript
export const DEFAULT_FLUID_PRESETS = ["Aquarius", "Juice"];
export const BLOCKED_FLUID_PRESET_NAMES = new Set([
  "water", "agua", "coffee", "cafe", "cafe", "kaffee", "other",
]);
```

**File 2:** `/Users/peterjamesblizzard/projects/caca_traca/src/components/track/FluidSection.tsx` (lines 8-22)
```typescript
const FALLBACK_FLUID_PRESETS = ["Aquarius", "Juice"];
const HARDWIRED_FLUID_NAMES = new Set([
  "water", "coffee", "cafe", "cafe", "kaffee", "other", "agua",
]);
```

The sets are equivalent (same elements, different order). `FALLBACK_FLUID_PRESETS` duplicates `DEFAULT_FLUID_PRESETS`.

**Recommendation:** `FluidSection.tsx` should import `DEFAULT_FLUID_PRESETS` and `BLOCKED_FLUID_PRESET_NAMES` from `store.ts` instead of redeclaring them.

---

### F-15: `formatCompactNumber` / `formatNumber` Utility Duplicated

**Severity:** COULD BE IMPROVED

A simple number-formatting helper appears in two files:

**File 1:** `/Users/peterjamesblizzard/projects/caca_traca/src/lib/habitProgress.ts` (lines 22-24)
```typescript
function formatNumber(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}
```

**File 2:** `/Users/peterjamesblizzard/projects/caca_traca/src/lib/habitCoaching.ts` (lines 22-24)
```typescript
function formatCompactNumber(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}
```

Both are identical in behavior.

**Recommendation:** Extract to a shared utility if additional consumers arise.

---

### F-16: `toDisplayUnits` / Caffeine Cup Calculation Logic Spread

**Severity:** COULD BE IMPROVED

The logic to convert raw ml values to "cup counts" for caffeine habits appears in multiple places with different implementations:

1. `/Users/peterjamesblizzard/projects/caca_traca/src/components/DailyProgress.tsx` (lines 39-44) - `toDisplayUnits`
2. `/Users/peterjamesblizzard/projects/caca_traca/src/lib/habitProgress.ts` (lines 34-39) - `getCaffeineCapEntries`
3. `/Users/peterjamesblizzard/projects/caca_traca/src/lib/habitCoaching.ts` (lines 26-30) - `toCoffeeCupCount`
4. `/Users/peterjamesblizzard/projects/caca_traca/src/pages/Track.tsx` (lines 634-636) - inline calculation

All perform a division by `quickIncrement` to convert ml to cups but use slightly different names and signatures.

**Recommendation:** Centralize in `src/lib/habitProgress.ts` as the canonical location for habit display logic, exporting a single `toCupCount(habit, ml)` function.

---

### F-17: Store Types Monolith -- All Types in `store.ts`

**Severity:** COULD BE IMPROVED

`src/store.ts` is 835 lines and contains ~30 type/interface definitions that serve as the app's core domain types. Types like `FoodItem`, `LogType`, `DigestiveLogData`, `ReproductiveBleedingStatus`, `HealthProfile`, and `AiPreferences` are all defined in the store file rather than in dedicated type files.

This means any file needing a type must import from `@/store`, creating a tight coupling to the store module even when only types are needed (e.g., `src/lib/sync.ts` imports `AiPreferences` and `HealthProfile` from `@/store`).

**Recommendation:** Consider extracting a `src/types/` directory (or `src/lib/types.ts`) for domain types that are used across both store and library code. This is a lower-priority structural improvement.

---

### F-18: Deprecated Re-exports in `foodParsing.ts` and `aiAnalysis.ts`

**Severity:** LOW

Both files have deprecated re-exports pointing to the canonical `aiModels.ts`:

**`src/lib/foodParsing.ts` (lines 1-4):**
```typescript
import { BACKGROUND_MODEL } from "./aiModels";
/** @deprecated Use BACKGROUND_MODEL from @/lib/aiModels instead. */
export const FOOD_PARSE_MODEL = BACKGROUND_MODEL;
```

**`src/lib/aiAnalysis.ts` (line 18-19):**
```typescript
/** @deprecated Use DEFAULT_INSIGHT_MODEL from @/lib/aiModels instead. */
export const DEFAULT_AI_MODEL = DEFAULT_INSIGHT_MODEL;
```

These create unnecessary indirection. Any external consumers should be migrated to import directly from `@/lib/aiModels`.

**Recommendation:** Grep for usage of `FOOD_PARSE_MODEL` and `DEFAULT_AI_MODEL`, update call sites to use the canonical imports, and remove the deprecated re-exports.

---

## Summary Table

| ID | Severity | Finding | Files Affected |
|----|----------|---------|----------------|
| F-01 | HIGH | Duplicated `bristolToConsistency` mapping | `Track.tsx`, `analysis.ts` |
| F-02 | HIGH | Time constants (`MS_PER_*`) redefined in 5+ files | `analysis.ts`, `aiAnalysis.ts`, `ObservationWindow.tsx`, `Track.tsx`, `useAiInsights.ts`, + inlines |
| F-03 | HIGH | Weight conversion `2.20462` scattered inline | `WeightTrendCard.tsx`, `TodayLog.tsx`, `ActivitySection.tsx` |
| F-04 | MODERATE | `getErrorMessage` utility exists but not used | 10+ component files |
| F-05 | MODERATE | Date key formatting redefined | `DigestiveCorrelationGrid.tsx`, `analysis.ts`, `reproductiveHealth.ts` |
| F-06 | MODERATE | `DrPooReply` interface duplicated | `store.ts`, `aiAnalysis.ts` |
| F-07 | MODERATE | Caffeine habit detection duplicated in 3 files | `habitProgress.ts`, `habitCoaching.ts`, `Track.tsx` |
| F-08 | MODERATE | `computeTodayHabitCounts` duplicated | `Track.tsx`, `DailyProgress.tsx` |
| F-09 | MODERATE | `normalizeEpisodes` duplicated | `Track.tsx`, `analysis.ts` |
| F-10 | LOW | `readText` helper buried in `analysis.ts` | `analysis.ts` |
| F-11 | LOW | `LogType` union inline in `SyncedLog` | `store.ts`, `sync.ts` |
| F-12 | LOW | `DigestiveCategory` type not exported | `analysis.ts` |
| F-13 | COULD BE IMPROVED | Section header UI pattern not abstracted | 20+ component files |
| F-14 | COULD BE IMPROVED | Fluid preset constants duplicated | `store.ts`, `FluidSection.tsx` |
| F-15 | COULD BE IMPROVED | `formatNumber` / `formatCompactNumber` duplicated | `habitProgress.ts`, `habitCoaching.ts` |
| F-16 | COULD BE IMPROVED | Caffeine cup calculation in 4 locations | `DailyProgress.tsx`, `habitProgress.ts`, `habitCoaching.ts`, `Track.tsx` |
| F-17 | COULD BE IMPROVED | All domain types in `store.ts` monolith | `store.ts` |
| F-18 | LOW | Deprecated re-exports still present | `foodParsing.ts`, `aiAnalysis.ts` |

---

## Recommended Remediation Order

1. **F-02** - Create `src/lib/timeConstants.ts` (trivial, high impact, eliminates 5+ redefinitions)
2. **F-01** - Extract `bristolCodeToCategory` to shared util (prevents divergence in critical logic)
3. **F-03** - Replace inline weight conversions with `formatWeight` imports + add `kgToLbs`/`lbsToKg` helpers
4. **F-07** - Export `isCaffeineHabit` from `habitTemplates.ts`
5. **F-08** - Extract `computeHabitCountsForRange` to `habitAggregates.ts`
6. **F-09** - Export `normalizeEpisodesCount` from `analysis.ts` or a shared file
7. **F-04** - Replace inline error extraction with `getErrorMessage()` calls
8. **F-06** - Remove `DrPooReply` duplicate from `aiAnalysis.ts`
9. **F-05** - Consolidate date key formatting
10. **F-14** - Import fluid constants from store in `FluidSection.tsx`
11. Remaining items as time permits

---

## What Is Already Done Well

- **`src/lib/` structure** is well-organized with clear module boundaries
- **`habitTemplates.ts`** is a good example of centralized domain logic with predicates (`isCapHabit`, `isTargetHabit`, `isDigestiveHabit`)
- **`habitAggregates.ts`** with `formatLocalDateKey` is well-shared (8+ consumers)
- **`inputSafety.ts`** for sanitization is correctly centralized and used by the sync layer
- **`openaiClient.ts`** and `aiRateLimiter.ts`** are properly extracted shared utilities
- **`celebrations.ts`** cleanly separates celebration logic from UI
- **Hook extraction** (`useCelebration`, `useCoaching`, `useHabitStreaks`, `useAiInsights`) is appropriate
- **`formatWeight.ts`** exists as the correct shared utility; the problem is incomplete adoption, not absence
- **`aiModels.ts`** is a good single source of truth for model configuration
