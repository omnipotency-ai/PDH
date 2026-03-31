# Import/Export Audit - 2026-02-28

## Executive Summary

Audited **121 source files** (excluding test files) in `src/`. Found **7 completely dead modules** (never imported), **13 unused exported symbols**, **1 deprecated-but-exported symbol**, and **11 Convex hook functions** exported from `sync.ts` that are never consumed. The store (`store.ts`) has moderate over-export with 10+ typed interfaces that exist only for documentation purposes and are never imported elsewhere.

---

## Category 1: Import Analysis

### 1A. Dead Modules (Files With Zero Inbound Imports)

| Severity | File                                                   | Exports                                                                                                                             | Notes                                                                                                                                             |
| -------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **HIGH** | `src/components/date-picker.tsx`                       | `DatePicker`                                                                                                                        | Generic date picker component. Never imported by any file. Appears to be scaffolded from shadcn/ui but never used.                                |
| **HIGH** | `src/components/landing/FeatureCard.tsx`               | `FeatureCard`                                                                                                                       | Landing page feature card. Was replaced by inline feature rendering in `FeaturesSection.tsx`.                                                     |
| **HIGH** | `src/components/patterns/FactorInsights.tsx`           | `FactorInsights`                                                                                                                    | Full component (~101 lines) that renders factor correlations from `analysis.ts`. Never rendered anywhere. Replaced by `DigestiveCorrelationGrid`. |
| **HIGH** | `src/components/track/WeightTrendCard.tsx`             | `WeightTrendCard`                                                                                                                   | Weight trend display card. Never imported. The `WeightTracker` in patterns/ has taken its place.                                                  |
| **HIGH** | `src/components/ui/pagination.tsx`                     | `Pagination`, `PaginationContent`, `PaginationLink`, `PaginationItem`, `PaginationPrevious`, `PaginationNext`, `PaginationEllipsis` | Full pagination component set (7 exports). Never imported. Scaffolded from shadcn/ui, unused.                                                     |
| **HIGH** | `src/pages/landing/components/LandingFooter.tsx`       | `LandingFooter`                                                                                                                     | Landing page footer. Previously imported in `LandingPage.tsx` but the import was removed. The component still exists.                             |
| **HIGH** | `src/pages/landing/components/TestimonialsSection.tsx` | `TestimonialsSection`                                                                                                               | Testimonials section with cards. Previously imported in `LandingPage.tsx` but the import was removed.                                             |

### 1B. High-Coupling Files (Imported by Many Files)

| File                           | Inbound Import Count     | Notes                                                  |
| ------------------------------ | ------------------------ | ------------------------------------------------------ |
| `src/store.ts`                 | ~30+ direct importers    | Central Zustand store. Expected for this architecture. |
| `src/lib/utils.ts`             | ~40 files reference `cn` | Single-export utility. Expected.                       |
| `src/lib/sync.ts`              | ~15 direct importers     | Convex sync hooks. Expected as the data layer.         |
| `src/components/ui/button.tsx` | ~20+ importers           | Core UI primitive. Expected.                           |
| `src/components/ui/card.tsx`   | ~15+ importers           | Core UI primitive. Expected.                           |
| `src/components/ui/label.tsx`  | ~15+ importers           | Core UI primitive. Expected.                           |
| `src/components/ui/input.tsx`  | ~15+ importers           | Core UI primitive. Expected.                           |
| `src/lib/habitTemplates.ts`    | ~10 importers            | Habit type definitions and templates. Expected.        |

**Assessment**: High coupling is **appropriate** here. The store, UI primitives, and data layer hooks are natural gravity centers. No action needed.

---

## Category 2: Export Analysis

### 2A. Unused Exported Symbols (Exported But Never Imported Elsewhere)

| Severity     | File                              | Symbol                            | Line | Notes                                                                                                                                                     |
| ------------ | --------------------------------- | --------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **HIGH**     | `src/lib/errors.ts`               | `getErrorMessage`                 | 1    | Exported function, never imported by any file in src/. The entire file is dead code.                                                                      |
| **HIGH**     | `src/lib/reproductiveHealth.ts`   | `getTodayDateKey`                 | 62   | Exported function, only defined/used internally within the same file (and it's not even used internally). Never imported elsewhere.                       |
| **HIGH**     | `src/lib/aiRateLimiter.ts`        | `resetRateLimit`                  | 24   | Marked "for testing purposes" but never imported by any test or source file.                                                                              |
| **HIGH**     | `src/lib/openaiClient.ts`         | `clearCachedClient`               | 28   | Marked "for testing purposes" but never imported by any test or source file.                                                                              |
| **HIGH**     | `src/lib/aiAnalysis.ts`           | `DEFAULT_AI_MODEL`                | 19   | Deprecated re-export (`@deprecated` JSDoc tag). Aliases `DEFAULT_INSIGHT_MODEL`. Never imported by any consumer.                                          |
| **HIGH**     | `src/lib/aiAnalysis.ts`           | `ConversationMessage` (interface) | 36   | Exported interface, only used internally within `aiAnalysis.ts`. Never imported elsewhere.                                                                |
| **HIGH**     | `src/lib/aiAnalysis.ts`           | `AiAnalysisResult` (interface)    | 42   | Exported interface, only used internally within `aiAnalysis.ts`. Never imported elsewhere.                                                                |
| **HIGH**     | `src/lib/habitCoaching.ts`        | `PANE_CACHE_TTL_MS`               | 360  | Exported constant, only used internally within `habitCoaching.ts`. Never imported elsewhere.                                                              |
| **HIGH**     | `src/lib/habitCoaching.ts`        | `PaneId` (type)                   | 351  | Exported type, only used internally within `habitCoaching.ts`. Never imported elsewhere.                                                                  |
| **HIGH**     | `src/lib/habitTemplates.ts`       | `isDigestiveHabit`                | 77   | Exported function, never imported by any file.                                                                                                            |
| **HIGH**     | `src/lib/habitTemplates.ts`       | `inferHabitType`                  | 62   | Exported function, only used internally within `habitTemplates.ts` itself (by `normalizeHabitConfig` and `createCustomHabit`). Never imported externally. |
| **MODERATE** | `src/components/BristolScale.tsx` | `BristolOption` (interface)       | 4    | Exported interface, never imported by any other file. Only used by `BRISTOL_SCALE` in the same file.                                                      |
| **MODERATE** | `src/hooks/useCelebration.ts`     | `CelebrationEvent` (interface)    | 6    | Exported interface, never imported by any other file. Only used by the hook itself.                                                                       |

### 2B. Excessive Export Surface in `src/lib/sync.ts`

`sync.ts` exports **31 hooks/types/functions**. Of these, **11** are never imported by any consumer:

| Symbol                     | Line | Status                    |
| -------------------------- | ---- | ------------------------- |
| `useFoodHistory`           | 253  | Never imported            |
| `useAllFoods`              | 257  | Never imported            |
| `useCulprits`              | 261  | Never imported            |
| `useSafeFoods`             | 265  | Never imported            |
| `useRecentSuggestions`     | 271  | Never imported            |
| `useSuggestionRepetitions` | 275  | Never imported            |
| `useFoodTrialsByStatus`    | 295  | Never imported            |
| `useFoodTrial`             | 299  | Never imported            |
| `useCurrentWeekDigest`     | 309  | Never imported            |
| `useConversationByReport`  | 247  | Never imported            |
| `useWeeklySummaryByWeek`   | 329  | Never imported            |
| `FoodTrialStatus` (type)   | 281  | Never imported            |
| `SyncedProfile` (type)     | 18   | Never imported externally |

**Severity**: **MODERATE** -- These hooks wrap Convex queries and may have been created as API surface for future features. However, 11 unused hooks is a significant amount of dead code that increases maintenance burden and bundle size.

### 2C. Excessive Export Surface in `src/store.ts`

`store.ts` exports **45+ types, interfaces, and constants**. Of these, the following are never imported elsewhere:

| Symbol                     | Type      | Notes                                                                                                          |
| -------------------------- | --------- | -------------------------------------------------------------------------------------------------------------- |
| `LogType`                  | type      | Never imported (the equivalent type is inline in `sync.ts` SyncedLog)                                          |
| `LogEntryData`             | type      | Never imported                                                                                                 |
| `FoodLogData`              | interface | Never imported                                                                                                 |
| `FluidLogData`             | interface | Never imported                                                                                                 |
| `DigestiveLogData`         | interface | Never imported                                                                                                 |
| `ActivityLogData`          | interface | Never imported                                                                                                 |
| `WeightLogData`            | interface | Never imported                                                                                                 |
| `ReproductiveLogData`      | interface | Never imported                                                                                                 |
| `HEALTH_CONDITION_OPTIONS` | const     | Never imported (only the split arrays `HEALTH_GI_CONDITION_OPTIONS` and `HEALTH_COMORBIDITY_OPTIONS` are used) |
| `DEFAULT_HEALTH_PROFILE`   | const     | Only used internally in `store.ts`                                                                             |
| `DEFAULT_FLUID_PRESETS`    | const     | Only used internally in `store.ts`                                                                             |

**Severity**: **MODERATE** -- The typed log data interfaces (`FoodLogData`, etc.) were added for type safety but the app still uses `any` for `LogEntry.data`. These interfaces represent aspirational typing that isn't enforced. The `LogType` type is duplicated in `sync.ts`.

### 2D. Deprecated Exports

| File                     | Symbol             | Notes                                                                                                                         |
| ------------------------ | ------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/aiAnalysis.ts`  | `DEFAULT_AI_MODEL` | Has `@deprecated` JSDoc. Points to `DEFAULT_INSIGHT_MODEL`. No consumers. Safe to remove.                                     |
| `src/lib/foodParsing.ts` | `FOOD_PARSE_MODEL` | Has `@deprecated` JSDoc. Aliases `BACKGROUND_MODEL`. Only used internally within `foodParsing.ts`. The export is unnecessary. |

---

## Summary Table: All Source Files

| File                                                            | Inbound Imports | Exported Symbols          | Dead Exports                                                      | Notes                                       |
| --------------------------------------------------------------- | --------------- | ------------------------- | ----------------------------------------------------------------- | ------------------------------------------- |
| `src/main.tsx`                                                  | 0 (entry point) | 0                         | 0                                                                 | App entry point                             |
| `src/App.tsx`                                                   | 1               | 1 (`default`)             | 0                                                                 |                                             |
| `src/routeTree.tsx`                                             | 1               | 2 (`routeTree`, `router`) | 0                                                                 |                                             |
| `src/store.ts`                                                  | 30+             | 45+                       | 11                                                                | See 2C                                      |
| `src/vite-env.d.ts`                                             | 0 (ambient)     | 0                         | 0                                                                 | Type declarations                           |
| **lib/**                                                        |                 |                           |                                                                   |                                             |
| `src/lib/utils.ts`                                              | 40+             | 1 (`cn`)                  | 0                                                                 |                                             |
| `src/lib/errors.ts`                                             | 0               | 1                         | 1                                                                 | **DEAD FILE**                               |
| `src/lib/sounds.ts`                                             | 1               | 2                         | 0                                                                 |                                             |
| `src/lib/formatWeight.ts`                                       | 2               | 2                         | 0                                                                 |                                             |
| `src/lib/reproductiveHealth.ts`                                 | 5               | 10                        | 1 (`getTodayDateKey`)                                             |                                             |
| `src/lib/analysis.ts`                                           | 3               | 4                         | 0                                                                 |                                             |
| `src/lib/habitIcons.tsx`                                        | 2               | 1                         | 0                                                                 |                                             |
| `src/lib/streaks.ts`                                            | 2               | 4                         | 0                                                                 |                                             |
| `src/lib/habitAggregates.ts`                                    | 5               | 5                         | 0                                                                 |                                             |
| `src/lib/habitTemplates.ts`                                     | 10              | 12                        | 2 (`isDigestiveHabit`, `inferHabitType`)                          |                                             |
| `src/lib/inputSafety.ts`                                        | 1               | 2                         | 0                                                                 |                                             |
| `src/lib/habitConstants.ts`                                     | 2               | 2                         | 0                                                                 |                                             |
| `src/lib/celebrations.ts`                                       | 1               | 2                         | 0                                                                 |                                             |
| `src/lib/deprecatedHabits.ts`                                   | 2               | 2                         | 0                                                                 | `DEPRECATED_HABIT_IDS` only used internally |
| `src/lib/sync.ts`                                               | 15+             | 31                        | 13                                                                | See 2B                                      |
| `src/lib/settingsUtils.ts`                                      | 2               | 3                         | 0                                                                 |                                             |
| `src/lib/aiRateLimiter.ts`                                      | 2               | 2                         | 1 (`resetRateLimit`)                                              |                                             |
| `src/lib/openaiClient.ts`                                       | 2               | 2                         | 1 (`clearCachedClient`)                                           |                                             |
| `src/lib/aiAnalysis.ts`                                         | 3               | 10+                       | 3 (`DEFAULT_AI_MODEL`, `ConversationMessage`, `AiAnalysisResult`) |                                             |
| `src/lib/aiModels.ts`                                           | 4               | 6                         | 0                                                                 | `VALID_INSIGHT_MODELS` only used internally |
| `src/lib/foodParsing.ts`                                        | 1               | 5                         | 1 (`FOOD_PARSE_MODEL` deprecated)                                 |                                             |
| `src/lib/digestiveCorrelations.ts`                              | 1               | 5                         | 0                                                                 |                                             |
| `src/lib/habitProgress.ts`                                      | 2               | 4                         | 0                                                                 |                                             |
| `src/lib/habitCoaching.ts`                                      | 2               | 10                        | 2 (`PANE_CACHE_TTL_MS`, `PaneId`)                                 |                                             |
| `src/lib/normalizeFluidName.ts`                                 | 1               | 1                         | 0                                                                 |                                             |
| **hooks/**                                                      |                 |                           |                                                                   |                                             |
| `src/hooks/useAiInsights.ts`                                    | 1               | 1                         | 0                                                                 |                                             |
| `src/hooks/useCelebration.ts`                                   | 1               | 2                         | 1 (`CelebrationEvent` interface)                                  |                                             |
| `src/hooks/useCoaching.ts`                                      | 1               | 1                         | 0                                                                 |                                             |
| `src/hooks/useHabitStreaks.ts`                                  | 1               | 1                         | 0                                                                 |                                             |
| `src/hooks/useWeeklySummaryAutoTrigger.ts`                      | 1               | 3                         | 0                                                                 |                                             |
| **contexts/**                                                   |                 |                           |                                                                   |                                             |
| `src/contexts/SyncedLogsContext.tsx`                            | 5               | 2                         | 0                                                                 |                                             |
| **pages/**                                                      |                 |                           |                                                                   |                                             |
| `src/pages/Track.tsx`                                           | 1               | 1 (`default`)             | 0                                                                 |                                             |
| `src/pages/Patterns.tsx`                                        | 1               | 1 (`default`)             | 0                                                                 |                                             |
| `src/pages/Settings.tsx`                                        | 1               | 1 (`default`)             | 0                                                                 |                                             |
| `src/pages/Archive.tsx`                                         | 1               | 1 (`default`)             | 0                                                                 |                                             |
| `src/pages/PrivacyPage.tsx`                                     | 1               | 1 (`default`)             | 0                                                                 |                                             |
| `src/pages/TermsPage.tsx`                                       | 1               | 1 (`default`)             | 0                                                                 |                                             |
| `src/pages/ApiKeyGuidePage.tsx`                                 | 1               | 1 (`default`)             | 0                                                                 |                                             |
| `src/pages/landing/LandingPage.tsx`                             | 1               | 1 (`default`)             | 0                                                                 |                                             |
| `src/pages/landing/lib/chakraColors.ts`                         | 5               | 1                         | 0                                                                 |                                             |
| `src/pages/landing/lib/motionVariants.ts`                       | 5               | 2+                        | 0                                                                 |                                             |
| `src/pages/landing/components/*.tsx` (9 files)                  | 1 each          | 1 each                    | 0                                                                 | All correctly imported by LandingPage       |
| **DEAD** `src/pages/landing/components/LandingFooter.tsx`       | **0**           | 1                         | 1                                                                 | **DEAD FILE**                               |
| **DEAD** `src/pages/landing/components/TestimonialsSection.tsx` | **0**           | 1                         | 1                                                                 | **DEAD FILE**                               |
| **components/ui/** (20 files)                                   |                 |                           |                                                                   |                                             |
| `src/components/ui/button.tsx`                                  | 20+             | 2                         | 0                                                                 |                                             |
| `src/components/ui/card.tsx`                                    | 15+             | 5                         | 0                                                                 |                                             |
| `src/components/ui/tooltip.tsx`                                 | 3               | 3                         | 0                                                                 |                                             |
| `src/components/ui/input.tsx`                                   | 15+             | 1                         | 0                                                                 |                                             |
| `src/components/ui/label.tsx`                                   | 15+             | 1                         | 0                                                                 |                                             |
| `src/components/ui/switch.tsx`                                  | 4               | 1                         | 0                                                                 |                                             |
| `src/components/ui/separator.tsx`                               | 3               | 1                         | 0                                                                 |                                             |
| `src/components/ui/badge.tsx`                                   | 4               | 2                         | 0                                                                 |                                             |
| `src/components/ui/field.tsx`                                   | 5               | 2                         | 0                                                                 |                                             |
| `src/components/ui/checkbox.tsx`                                | 3               | 1                         | 0                                                                 |                                             |
| `src/components/ui/popover.tsx`                                 | 4               | 3                         | 0                                                                 |                                             |
| `src/components/ui/calendar.tsx`                                | 3               | 1                         | 0                                                                 |                                             |
| `src/components/ui/drawer.tsx`                                  | 3               | 5                         | 0                                                                 |                                             |
| `src/components/ui/sheet.tsx`                                   | 2               | 5                         | 0                                                                 |                                             |
| `src/components/ui/scroll-area.tsx`                             | 2               | 1                         | 0                                                                 |                                             |
| `src/components/ui/collapsible.tsx`                             | 2               | 3                         | 0                                                                 |                                             |
| `src/components/ui/accordion.tsx`                               | 2               | 4                         | 0                                                                 |                                             |
| `src/components/ui/toggle.tsx`                                  | 2               | 2                         | 0                                                                 |                                             |
| `src/components/ui/toggle-group.tsx`                            | 2               | 2                         | 0                                                                 |                                             |
| `src/components/ui/dropdown-menu.tsx`                           | 1               | 10+                       | 0                                                                 |                                             |
| `src/components/ui/navigation-menu.tsx`                         | 1               | 4                         | 0                                                                 |                                             |
| `src/components/ui/responsive-shell.tsx`                        | 1               | 1                         | 0                                                                 |                                             |
| **DEAD** `src/components/ui/pagination.tsx`                     | **0**           | 7                         | 7                                                                 | **DEAD FILE**                               |
| **components/track/** (15 files)                                | 1 each          | 1-3 each                  | 0                                                                 | All correctly wired                         |
| **DEAD** `src/components/track/WeightTrendCard.tsx`             | **0**           | 1                         | 1                                                                 | **DEAD FILE**                               |
| **components/patterns/** (6 files)                              | 1 each          | 1 each                    | 0                                                                 |                                             |
| **DEAD** `src/components/patterns/FactorInsights.tsx`           | **0**           | 1                         | 1                                                                 | **DEAD FILE**                               |
| **components/landing/** (7 files)                               | 1 each          | 1 each                    | 0                                                                 |                                             |
| **DEAD** `src/components/landing/FeatureCard.tsx`               | **0**           | 1                         | 1                                                                 | **DEAD FILE**                               |
| **DEAD** `src/components/date-picker.tsx`                       | **0**           | 1                         | 1                                                                 | **DEAD FILE**                               |
| **components/settings/**                                        | All imported    | Varies                    | 0                                                                 | Properly connected                          |
| `src/components/mode-toggle.tsx`                                | 1               | 1 (`default`)             | 0                                                                 |                                             |
| `src/components/theme-provider.tsx`                             | 1               | 1                         | 0                                                                 |                                             |
| `src/components/AiInsightsSection.tsx`                          | 1               | 1                         | 0                                                                 |                                             |
| `src/components/BristolScale.tsx`                               | 2               | 4                         | 1 (`BristolOption`)                                               |                                             |
| `src/components/Confetti.tsx`                                   | 1               | 1                         | 0                                                                 |                                             |
| `src/components/DailyProgress.tsx`                              | 1               | 1                         | 0                                                                 |                                             |

---

## Findings By Severity

### CRITICAL

None found. All import chains are intact for the modules that are actually used.

### HIGH (7 Dead Files + 13 Dead Exports)

**H-01: Seven dead module files should be deleted.**

These files are never imported and serve no purpose:

1. `/Users/peterjamesblizzard/projects/caca_traca/src/components/date-picker.tsx` -- Scaffolded shadcn/ui component, never used.
2. `/Users/peterjamesblizzard/projects/caca_traca/src/components/landing/FeatureCard.tsx` -- Replaced by inline rendering in `FeaturesSection.tsx`.
3. `/Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/FactorInsights.tsx` -- Replaced by `DigestiveCorrelationGrid`. Contains ~100 lines of dead code.
4. `/Users/peterjamesblizzard/projects/caca_traca/src/components/track/WeightTrendCard.tsx` -- Superseded by `WeightTracker` in patterns/.
5. `/Users/peterjamesblizzard/projects/caca_traca/src/components/ui/pagination.tsx` -- 7 exports, none used anywhere. Scaffolded from shadcn/ui.
6. `/Users/peterjamesblizzard/projects/caca_traca/src/pages/landing/components/LandingFooter.tsx` -- Was removed from `LandingPage.tsx` imports.
7. `/Users/peterjamesblizzard/projects/caca_traca/src/pages/landing/components/TestimonialsSection.tsx` -- Was removed from `LandingPage.tsx` imports.

**H-02: `src/lib/errors.ts` is entirely dead code.**

The file exports `getErrorMessage` which is never imported by any file. The entire module can be deleted.

**H-03: Deprecated exports should be removed.**

- `DEFAULT_AI_MODEL` in `src/lib/aiAnalysis.ts` (line 19) -- marked `@deprecated`, zero consumers.
- `FOOD_PARSE_MODEL` in `src/lib/foodParsing.ts` (line 4) -- marked `@deprecated`, only used internally. Remove the export keyword.

**H-04: Testing-only exports are never tested.**

- `resetRateLimit` in `src/lib/aiRateLimiter.ts` (line 24) -- "for testing" but no test imports it.
- `clearCachedClient` in `src/lib/openaiClient.ts` (line 28) -- "for testing" but no test imports it.

### MODERATE

**M-01: `sync.ts` has 11 unused Convex hook exports.**

The following hooks in `src/lib/sync.ts` are exported but never imported anywhere:

- `useFoodHistory`, `useAllFoods`, `useCulprits`, `useSafeFoods`
- `useRecentSuggestions`, `useSuggestionRepetitions`
- `useFoodTrialsByStatus`, `useFoodTrial`
- `useCurrentWeekDigest`, `useConversationByReport`, `useWeeklySummaryByWeek`
- Types: `FoodTrialStatus`, `SyncedProfile`

These wrap Convex queries and create reactive subscriptions. If unused, they add dead code to the bundle. **Recommendation**: Either delete them or add a comment documenting they are reserved for upcoming features.

**M-02: `store.ts` exports typed log data interfaces that are never consumed.**

`LogEntryData`, `FoodLogData`, `FluidLogData`, `DigestiveLogData`, `ActivityLogData`, `WeightLogData`, `ReproductiveLogData`, `LogType` -- all defined and exported but never imported. The actual `LogEntry.data` field is typed as `any`. These represent aspirational typing that is never enforced. **Recommendation**: Either enforce them by narrowing `LogEntry.data` or remove them.

**M-03: `HEALTH_CONDITION_OPTIONS` is never imported.**

Only the constituent arrays (`HEALTH_GI_CONDITION_OPTIONS` and `HEALTH_COMORBIDITY_OPTIONS`) are imported by `ConditionsSection.tsx`. The combined array is unused.

### LOW

**L-01: Internal-only symbols exported unnecessarily.**

Several symbols are exported but only used within their own file:

- `PANE_CACHE_TTL_MS` and `PaneId` in `habitCoaching.ts`
- `ConversationMessage` and `AiAnalysisResult` in `aiAnalysis.ts`
- `BristolOption` in `BristolScale.tsx`
- `CelebrationEvent` in `useCelebration.ts`
- `VALID_INSIGHT_MODELS` in `aiModels.ts` (only used by `getValidInsightModel` in same file)
- `DEPRECATED_HABIT_IDS` in `deprecatedHabits.ts` (only consumed via `isDeprecatedHabitId`)

These exports are harmless but add noise to the module API. **Recommendation**: Remove the `export` keyword from symbols that are only used internally.

### COULD BE IMPROVED

**CI-01: `LogType` is duplicated between `store.ts` and `sync.ts`.**

`store.ts` exports `LogType` as a union type. `sync.ts` re-defines the same union inline in the `SyncedLog` type definition. These should share a single source of truth.

**CI-02: `DrPooReply` interface is duplicated.**

Defined in both `src/store.ts` (line 213) and `src/lib/aiAnalysis.ts` (line 32). The `aiAnalysis.ts` version could import from `store.ts` instead.

**CI-03: `habitTemplates.ts` could export fewer symbols.**

`inferHabitType` is only used internally. Only 8 of its 12 exports are consumed externally. Consider un-exporting internal helpers.

**CI-04: Consider barrel exports for settings sub-modules.**

`src/components/settings/health/index.ts` and `src/components/settings/repro/index.ts` exist as barrel files but each sub-component is also imported directly in some places. Standardize the import pattern.

---

## Recommendations Summary

| Priority | Action                                             | Files Affected                         | Effort  |
| -------- | -------------------------------------------------- | -------------------------------------- | ------- |
| 1        | Delete 7 dead module files                         | 7 files                                | Trivial |
| 2        | Delete `src/lib/errors.ts`                         | 1 file                                 | Trivial |
| 3        | Remove `DEFAULT_AI_MODEL` deprecated export        | `aiAnalysis.ts`                        | Trivial |
| 4        | Remove `FOOD_PARSE_MODEL` export keyword           | `foodParsing.ts`                       | Trivial |
| 5        | Audit 11 unused sync hooks -- delete or document   | `sync.ts`                              | Small   |
| 6        | Un-export internal-only symbols in 6 files         | 6 files                                | Small   |
| 7        | Consolidate `DrPooReply` and `LogType` definitions | `store.ts`, `aiAnalysis.ts`, `sync.ts` | Small   |
| 8        | Remove or enforce typed log data interfaces        | `store.ts`                             | Medium  |
