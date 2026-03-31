# Category 6: Dead Code Detection

**Audit Date:** 2026-02-28
**Scope:** `src/` directory (all `.ts`, `.tsx` files)
**Method:** Exhaustive file-by-file analysis using Glob, Read, and Grep across the entire `src/` directory. Every export was cross-referenced against imports throughout the codebase.

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 8 |
| HIGH | 20 |
| MODERATE | 19 |
| LOW | 8 |
| COULD BE IMPROVED | 3 |
| **Total** | **58** |

---

## CRITICAL -- Entirely Dead Files / Components

These files contain components or utilities that are never imported anywhere in the codebase. They can be deleted entirely.

### DC-01: `src/components/patterns/FactorInsights.tsx` (167 lines)

**Dead component.** `FactorInsights` is exported on line 101 but never imported by any file. Was likely superseded by `DigestiveCorrelationGrid`.

```
src/components/patterns/FactorInsights.tsx:101  export function FactorInsights()
```

### DC-02: `src/components/track/WeightTrendCard.tsx` (115 lines)

**Dead component.** `WeightTrendCard` is exported on line 16 but never imported by any file. Superseded by `src/components/patterns/WeightTracker.tsx`. Also contains a duplicate `formatWeight` function (line 9) that shadows the canonical `src/lib/formatWeight.ts`.

```
src/components/track/WeightTrendCard.tsx:16  export function WeightTrendCard({ logs }: WeightTrendCardProps)
src/components/track/WeightTrendCard.tsx:9   function formatWeight(kg: number, unit: "kg" | "lbs"): string  // duplicate
```

### DC-03: `src/pages/landing/components/TestimonialsSection.tsx` (63 lines)

**Dead component.** `TestimonialsSection` is exported on line 7 but never imported by `LandingPage.tsx` or any other file. Was removed from the landing page but the file remains.

```
src/pages/landing/components/TestimonialsSection.tsx:7  export function TestimonialsSection()
```

### DC-04: `src/pages/landing/components/LandingFooter.tsx` (49 lines)

**Dead component.** `LandingFooter` is exported on line 4 but never imported by `LandingPage.tsx` or any other file.

```
src/pages/landing/components/LandingFooter.tsx:4  export function LandingFooter()
```

### DC-05: `src/components/landing/FeatureCard.tsx` (37 lines)

**Dead component.** `FeatureCard` is exported on line 12 but never imported anywhere. The landing page `FeaturesSection.tsx` implements its own feature cards inline.

```
src/components/landing/FeatureCard.tsx:12  export function FeatureCard({...})
```

### DC-06: `src/components/landing/TestimonialCard.tsx` (53 lines)

**Transitively dead component.** `TestimonialCard` is exported on line 14 but its only consumer is the dead `TestimonialsSection.tsx` (DC-03). Should be deleted together with DC-03.

```
src/components/landing/TestimonialCard.tsx:14  export function TestimonialCard({...})
```

### DC-07: `src/components/ui/pagination.tsx`

**Dead UI primitive.** Never imported by any file. No pagination feature exists in the app.

### DC-08: `src/components/ui/badge.tsx`

**Dead UI primitive.** Never imported by any file.

---

## HIGH -- Unused Exports (Functions, Hooks, Constants)

These are exported symbols that are never imported outside their defining file. The functions/hooks themselves may be used internally, but the `export` keyword is dead.

### DC-09: `src/lib/errors.ts` -- entire file dead (5 lines)

`getErrorMessage` is exported on line 1 but never imported anywhere. The entire file is dead.

```
src/lib/errors.ts:1  export function getErrorMessage(err: unknown): string
```

### DC-10: `src/lib/sync.ts` -- 12 unused hooks + 2 unused types

The following exported hooks are never imported outside `sync.ts`:

| Line | Symbol | Type |
|------|--------|------|
| 243 | `useConversationHistory` | hook |
| 247 | `useConversationByReport` | hook |
| 253 | `useFoodHistory` | hook |
| 257 | `useAllFoods` | hook |
| 261 | `useCulprits` | hook |
| 265 | `useSafeFoods` | hook |
| 271 | `useRecentSuggestions` | hook |
| 275 | `useSuggestionRepetitions` | hook |
| 281 | `FoodTrialStatus` | type |
| 295 | `useFoodTrialsByStatus` | hook |
| 299 | `useFoodTrial` | hook |
| 309 | `useCurrentWeekDigest` | hook |
| 329 | `useWeeklySummaryByWeek` | hook |
| 18 | `SyncedProfile` | type |

These hooks were likely built for features that use direct Convex queries instead, or for planned features not yet implemented.

### DC-11: `src/lib/aiAnalysis.ts` -- 9 unused exported types + 1 deprecated re-export

| Line | Symbol | Notes |
|------|--------|-------|
| 19 | `DEFAULT_AI_MODEL` | `@deprecated` re-export of `DEFAULT_INSIGHT_MODEL` |
| 31 | `DrPooReply` | Duplicate of `store.ts:213` -- neither file imports the other's version |
| 36 | `ConversationMessage` | Never imported externally |
| 42 | `AiAnalysisResult` | Never imported externally |
| 65 | `FoodTrialSummaryInput` | Never imported externally |
| 89 | `WeeklyDigestInput` | Never imported externally |
| 1110 | `PreviousWeeklySummary` | Used internally only |
| 1116 | `SuggestionHistoryEntry` | Used internally only |
| 1129 | `EnhancedAiContext` | Used internally only |
| 1347 | `WeeklySummaryInput` | Used internally only |
| 1362 | `WeeklySummaryResult` | Used internally only |

### DC-12: `src/lib/aiRateLimiter.ts:24` -- `resetRateLimit`

Exported function never called outside the file. No test or UI references it.

```
src/lib/aiRateLimiter.ts:24  export function resetRateLimit(): void
```

### DC-13: `src/lib/openaiClient.ts:28` -- `clearCachedClient`

Exported function never called outside the file.

```
src/lib/openaiClient.ts:28  export function clearCachedClient(): void
```

### DC-14: `src/lib/aiModels.ts:23` -- `VALID_INSIGHT_MODELS`

Exported constant used internally by `getValidInsightModel()` on line 27 but never imported externally.

```
src/lib/aiModels.ts:23  export const VALID_INSIGHT_MODELS: ReadonlySet<string>
```

### DC-15: `src/lib/reproductiveHealth.ts:62` -- `getTodayDateKey`

Exported function never imported externally.

```
src/lib/reproductiveHealth.ts:62  export function getTodayDateKey(): string
```

### DC-16: `src/lib/habitTemplates.ts` -- 2 unused exports

| Line | Symbol | Notes |
|------|--------|-------|
| 62 | `inferHabitType` | Used internally (lines 299, 346) but never imported externally |
| 77 | `isDigestiveHabit` | Never used internally or externally |

### DC-17: `src/lib/foodParsing.ts:4` -- `FOOD_PARSE_MODEL` (deprecated)

Exported constant marked `@deprecated`. Used internally on line 266 but never imported externally. Should use `BACKGROUND_MODEL` directly.

```
src/lib/foodParsing.ts:3   /** @deprecated Use BACKGROUND_MODEL from @/lib/aiModels instead. */
src/lib/foodParsing.ts:4   export const FOOD_PARSE_MODEL = BACKGROUND_MODEL;
```

### DC-18: `src/hooks/useWeeklySummaryAutoTrigger.ts:65` -- `getCompletedPeriodBounds`

Exported function used internally on line 101 but never imported externally.

```
src/hooks/useWeeklySummaryAutoTrigger.ts:65  export function getCompletedPeriodBounds()
```

### DC-19: `src/lib/habitCoaching.ts` -- 2 unused exports

| Line | Symbol | Notes |
|------|--------|-------|
| 351 | `PaneId` | Type used internally but never imported externally |
| 360 | `PANE_CACHE_TTL_MS` | Constant used internally (line 382) but never imported externally |

### DC-20: `src/components/date-picker.tsx` (30 lines)

**Dead component.** `DatePicker` is exported on line 10 but never imported anywhere. The app uses `DatePickerButton.tsx` in reproductive settings instead.

```
src/components/date-picker.tsx:10  export function DatePicker()
```

---

## MODERATE -- Unused Store Exports

These types, interfaces, and constants are exported from `src/store.ts` but never imported by any other file. They are used only within `store.ts` itself.

### DC-21: Unused exported types from `src/store.ts`

| Line | Symbol | Used internally? |
|------|--------|-----------------|
| 28 | `LogType` | Yes (line 306) |
| 44 | `HeightUnit` | Yes (line 183) |
| 45 | `WeightUnit` | Yes (line 184) |
| 120 | `MealSchedule` | Yes (line 125) |
| 213 | `DrPooReply` | Yes (line 373) -- also duplicated in `aiAnalysis.ts:31` |
| 218 | `PaneSummaryCacheEntry` | Yes (lines 324, 350, 618) |
| 246 | `FoodLogData` | Yes (line 295) |
| 251 | `FluidLogData` | Yes (line 296) |
| 256 | `DigestiveLogData` | Yes (line 297) |
| 276 | `ActivityLogData` | Yes (line 299) |
| 282 | `WeightLogData` | Yes (line 300) |
| 286 | `ReproductiveLogData` | Yes (line 301) |
| 294 | `LogEntryData` | Yes (line 308) |

**Note:** These types compose the discriminated union `LogEntryData` (line 294) and are referenced by the `LogEntry` type. Removing the `export` keyword is safe since no external file imports them; however, keeping them exported is harmless if they represent part of the public API surface for future use.

### DC-22: Unused exported constants from `src/store.ts`

| Line | Symbol | Notes |
|------|--------|-------|
| 98 | `HEALTH_CONDITION_OPTIONS` | Combined array -- only the individual arrays (`HEALTH_GI_CONDITION_OPTIONS`, `HEALTH_COMORBIDITY_OPTIONS`) are imported externally |
| 384 | `DEFAULT_FLUID_PRESETS` | Only used internally in `store.ts` |
| 397 | `DEFAULT_HEALTH_PROFILE` | Only used internally in `store.ts` |

### DC-23: Unused store actions

These actions are defined in the store but never called from any component or hook:

| Line | Action | Notes |
|------|--------|-------|
| 338 | `getHabitLogsForRange` | Defined (line 583) but never called outside store |
| 342 | `addFluidPreset` | Defined (line 592) but never called outside store |
| 343 | `removeFluidPreset` | Defined (line 596) but never called outside store |
| 351 | `clearPaneSummaryCache` | Defined (line 634) but never called outside store |

---

## LOW -- Unused Exported Types from Non-Store Files

### DC-24: `src/lib/sounds.ts:42` -- `SoundVariant` type

Exported but never imported externally. Only `playSound` is imported (by `useCelebration.ts`).

```
src/lib/sounds.ts:42  export type SoundVariant = "ding" | "chime" | "sparkle" | "milestone" | "goalComplete";
```

### DC-25: `src/lib/celebrations.ts:4` -- `CelebrationConfig` type

Exported but never imported externally. Used internally as the return type of `getCelebrationConfig` (line 13).

```
src/lib/celebrations.ts:4  export interface CelebrationConfig
```

### DC-26: `src/hooks/useCelebration.ts:6` -- `CelebrationEvent` type

Exported but never imported externally. Used internally as state type (line 14).

```
src/hooks/useCelebration.ts:6  export interface CelebrationEvent
```

### DC-27: `src/pages/landing/lib/motionVariants.ts` -- 3 unused variants

| Line | Symbol | Notes |
|------|--------|-------|
| 32 | `fadeLeft` | Never imported. Only `fadeUp`, `staggerContainer`, `scaleIn`, `viewportOnce` are used. |
| 42 | `fadeRight` | Never imported |
| 52 | `fadeIn` | Never imported |

### DC-28: `src/pages/landing/lib/chakraColors.ts` -- 2 unused exports

| Line | Symbol | Notes |
|------|--------|-------|
| 13 | `ChakraKey` | Type never imported externally |
| 27 | `chakraGradient` | Function never imported -- `ChakraBar.tsx` constructs its own gradient from `CHAKRA_SEQUENCE` directly |

### DC-29: `src/lib/aiAnalysis.ts:31` -- Duplicate `DrPooReply` interface

`DrPooReply` is defined in both `src/store.ts:213` and `src/lib/aiAnalysis.ts:31`. Neither file imports the other's definition. This creates two structurally identical but nominally distinct types. The store's version is the one persisted; the `aiAnalysis.ts` version is used only within that file's internal function signatures.

### DC-30: `src/lib/analysis.ts:32` -- `FactorCorrelation` type partially dead

`FactorCorrelation` (line 32) is exported and imported only by the dead `FactorInsights.tsx` (DC-01). Once DC-01 is deleted, this type export becomes dead. `FoodStat`, `FoodStatus`, and `analyzeLogs` from the same file are still actively used by `FoodSafetyDatabase.tsx`.

### DC-31: `src/components/track/TodayLog.tsx:350` -- Shadow interface `HabitLogData`

`TodayLog.tsx` defines its own local `HabitLogData` interface (line 350) instead of importing the structurally compatible `HabitLogData` from `src/store.ts:276`. This is not dead code per se, but it is a shadow type that makes the store's export appear unused when it is semantically the same type.

---

## COULD BE IMPROVED

### DC-32: Overexported internal helpers

Several files export utility functions and types that are only used internally. While harmless, removing the `export` keyword makes the module's public API surface clearer:

- `src/lib/habitCoaching.ts:351` -- `PaneId`, `PANE_CACHE_TTL_MS`
- `src/lib/aiModels.ts:23` -- `VALID_INSIGHT_MODELS`
- `src/hooks/useWeeklySummaryAutoTrigger.ts:65` -- `getCompletedPeriodBounds`
- `src/lib/habitTemplates.ts:62` -- `inferHabitType`
- `src/lib/reproductiveHealth.ts:62` -- `getTodayDateKey`

### DC-33: No commented-out code found

No commented-out code blocks were found in the codebase. All `//` comments are legitimate documentation or explanatory comments.

### DC-34: No dead routes found

All routes in `src/routeTree.tsx` are reachable and render active page components:
- `/` -- redirects to `/home`
- `/home` -- `LandingPage`
- `/patterns` -- `Patterns`
- `/settings` -- `Settings`
- `/archive` -- `Archive`
- `/terms`, `/privacy`, `/api-key-guide` -- static legal/guide pages
- `/habits`, `/calibration` -- legacy redirects to `/`

No stale feature flags, unreachable code paths, or dead CSS class references were detected in the TypeScript/TSX source files.

---

## Recommended Cleanup Priority

1. **Delete dead files** (DC-01 through DC-08, DC-09, DC-20): ~520 lines of dead code across 10 files. No risk of breakage.
2. **Remove unused sync hooks** (DC-10): 12 hooks + 2 types. If these are planned for future use, annotate them; otherwise delete.
3. **Clean up aiAnalysis.ts exports** (DC-11): Remove unused type exports and the deprecated `DEFAULT_AI_MODEL` re-export. Consolidate the duplicate `DrPooReply` into a single shared definition.
4. **Remove dead store exports** (DC-21 through DC-23): Remove `export` from types/constants only used within `store.ts`. Delete the 4 unused store actions if no feature plans reference them.
5. **Remove dead utility exports** (DC-12 through DC-19, DC-24 through DC-28): Remove `export` keywords or delete the functions if not needed internally.
