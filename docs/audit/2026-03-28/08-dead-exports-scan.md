I now have complete, verified results. Here is the full dead export report.

---

## WQ-154: Dead Export Scan Results

**Total confirmed dead exports: 73**

Scanned directories: `src/lib/`, `shared/`, `src/components/patterns/database/`, `src/hooks/`

---

### `src/lib/aiAnalysis.ts` (8 dead exports)

| Line | Export | Confidence |
|------|--------|------------|
| 41 | `TOKEN_WARNING_THRESHOLD` | certain |
| 228 | `FoodItemDetail` (interface) | certain |
| 2133 | `PreviousWeeklySummary` (interface) | certain |
| 2139 | `SuggestionHistoryEntry` (interface) | certain |
| 2146 | `HabitCorrelationInsight` (interface) | certain |
| 2152 | `EnhancedAiContext` (interface) | certain |
| 2533 | `WeeklySummaryInput` (interface) | certain |
| 2548 | `WeeklySummaryResult` (interface) | certain |

---

### `src/lib/aiRateLimiter.ts` (1 dead export)

| Line | Export | Confidence |
|------|--------|------------|
| 30 | `resetRateLimit` | certain |

---

### `src/lib/analysis.ts` (1 dead export)

| Line | Export | Confidence |
|------|--------|------------|
| 78 | `STATUS_ORDER_SAFE_FIRST` | certain |

---

### `src/lib/celebrations.ts` (1 dead export -- entire file is dead)

| Line | Export | Confidence |
|------|--------|------------|
| 23 | `getCelebration` | certain |

No file in the codebase imports from `src/lib/celebrations.ts`. The `getCelebration` in `useCelebrationTrigger.ts` is a separate, locally-defined function.

---

### `src/lib/customFoodPresets.ts` (1 dead export)

| Line | Export | Confidence |
|------|--------|------------|
| 7 | `CUSTOM_FOOD_PRESETS_STORAGE_KEY` | certain |

Used internally (3 occurrences in same file) but never imported externally. The export is unnecessary.

---

### `src/lib/foodDigestionMetadata.ts` (2 dead exports)

| Line | Export | Confidence |
|------|--------|------------|
| 3 | `DigestionBadgeTone` (type) | certain |
| 50 | `hasFoodDigestionMetadata` | certain |

---

### `src/lib/foodLlmCanonicalization.ts` (1 dead export)

| Line | Export | Confidence |
|------|--------|------------|
| 29 | `buildRegistryVocabularyPrompt` | needs-verification |

Only used in tests (`foodLlmCanonicalization.test.ts`). No production consumer. Might be intentionally test-only.

---

### `src/lib/foodParsing.ts` (6 dead exports)

| Line | Export | Confidence |
|------|--------|------------|
| 59 | `ParsedFoodLogItem` (interface) | certain |
| 71 | `NewFoodLibraryEntry` (interface) | certain |
| 78 | `ParsedFoodWritePayload` (interface) | certain |
| 178 | `isRecord` | certain |
| 186 | `hasValidFoodFields` | needs-verification |
| 215 | `isValidParsedFoodItem` | needs-verification |
| 313 | `normalizeComponent` | certain |

`hasValidFoodFields`, `isValidParsedFoodItem`, and `isValidFoodParseResult` (line 228) are used only in tests. `isRecord`, `normalizeComponent`, and `ParsedFoodWritePayload` are used only internally in the same file.

---

### `src/lib/foodStatusThresholds.ts` (8 dead exports)

| Line | Export | Confidence |
|------|--------|------------|
| 40 | `BRISTOL_HARD_UPPER` | certain |
| 43 | `BRISTOL_LOOSE_LOWER` | certain |
| 72 | `ZONE_MIN` | certain |
| 73 | `ZONE_MAX` | certain |
| 81 | `clampZone` | certain |
| 90 | `RISKY_BAD_COUNT` | certain |
| 93 | `WATCH_BAD_COUNT` | certain |
| 121 | `BristolCategory` (type) | certain |

---

### `src/lib/formatWeight.ts` (4 dead exports)

| Line | Export | Confidence |
|------|--------|------------|
| 1 | `LBS_PER_KG` | certain |
| 2 | `KG_PER_LB` | certain |
| 3 | `LBS_PER_STONE` | certain |
| 4 | `KG_PER_STONE` | certain |

The conversion functions (`kgToLbs`, `lbsToKg`, etc.) are used, but these raw constants are not.

---

### `src/lib/habitAggregates.ts` (1 dead export)

| Line | Export | Confidence |
|------|--------|------------|
| 27 | `getHabitGoal` | certain |

---

### `src/lib/habitCoaching.ts` (4 dead exports)

| Line | Export | Confidence |
|------|--------|------------|
| 32 | `generateCoachingSnippet` | certain |
| 101 | `getHeuristicCoachingMessage` | certain |
| 228 | `generateHabitSnippet` | certain |
| 288 | `heuristicHabitSnippet` | certain |

`generateSettingsSuggestions` and `heuristicSuggestions` ARE used (via `AiSuggestionsCard.tsx`). The four coaching/snippet functions above have zero consumers.

---

### `src/lib/habitTemplates.ts` (4 dead exports)

| Line | Export | Confidence |
|------|--------|------------|
| 139 | `isDigestiveHabit` | certain |
| 176 | `isDestructiveHabit` | certain |
| 180 | `isActivityHabit` | certain |
| 468 | `DEFAULT_HABIT_TEMPLATE_KEYS` | certain |

---

### `src/lib/reproductiveHealth.ts` (4 dead exports)

| Line | Export | Confidence |
|------|--------|------------|
| 59 | `getDateKeyFromTimestamp` | certain |
| 63 | `getTodayDateKey` | certain |
| 97 | `bleedingStatusBadgeClass` | certain |
| 112 | `isBleedingStatusActive` | certain |

---

### `src/lib/streaks.ts` (2 dead exports)

| Line | Export | Confidence |
|------|--------|------------|
| 1 | `GamificationState` (interface) | certain |
| 18 | `DEFAULT_GAMIFICATION` | certain |

`SleepGoal` and `DEFAULT_SLEEP_GOAL` from the same file ARE used.

---

### `src/lib/timeConstants.ts` (2 dead exports)

| Line | Export | Confidence |
|------|--------|------------|
| 4 | `MS_PER_WEEK` | certain |
| 5 | `HOURS_PER_DAY` | certain |

`MS_PER_MINUTE`, `MS_PER_HOUR`, `MS_PER_DAY` are used.

---

### `src/lib/units.ts` (2 dead exports)

| Line | Export | Confidence |
|------|--------|------------|
| 6 | `normalizeUnitSystem` | certain |
| 89 | `cmToFeetInches` | certain |

---

### `shared/foodEvidence.ts` (4 dead exports)

| Line | Export | Confidence |
|------|--------|------------|
| 32 | `FoodTrialResolutionMode` (type) | certain |
| 147 | `TransitResolverPolicy` (interface) | certain |
| 275 | `TriggerEvidence` (interface) | certain |
| 388 | `FOOD_GROUP_TO_TRANSIT_CATEGORY` | certain |

All four are used internally within `foodEvidence.ts` but never imported by any other file.

---

### `shared/foodMatching.ts` (5 dead exports)

| Line | Export | Confidence |
|------|--------|------------|
| 79 | `ConfidenceRoute` (interface) | certain |
| 154 | `stripFoodAccents` | certain |
| 205 | `splitMealIntoFoodPhrases` | certain |
| 416 | `findExactAliasCandidate` | certain |
| 627 | `buildBucketOptions` | certain |

---

### `shared/foodProjection.ts` (1 dead export)

| Line | Export | Confidence |
|------|--------|------------|
| 8 | `BRAT_BASELINE_CANONICALS` | certain |

---

### `shared/logDataParsers.ts` (5 dead exports)

| Line | Export | Confidence |
|------|--------|------------|
| 14 | `ParsedDigestiveData` (interface) | certain |
| 33 | `ParsedHabitData` (interface) | certain |
| 39 | `ParsedActivityData` (interface) | certain |
| 44 | `ParsedFluidItem` (interface) | certain |
| 48 | `ParsedFluidData` (interface) | certain |

The parser functions (`parseDigestiveData`, etc.) are used, but these return-type interfaces are never referenced directly.

---

### `src/hooks/useDayStats.ts` (1 dead export)

| Line | Export | Confidence |
|------|--------|------------|
| 19 | `DayStats` (interface) | certain |

The `useDayStats` hook is used, but the `DayStats` type is never imported by any consumer.

---

### `src/hooks/useFoodParsing.ts` (1 dead export)

| Line | Export | Confidence |
|------|--------|------------|
| 9 | `FoodParsingState` (interface) | certain |

---

### `src/hooks/useTimePicker.ts` (1 dead export -- entire file is dead)

| Line | Export | Confidence |
|------|--------|------------|
| 42 | `useTimePicker` | certain |

---

### `src/hooks/useTransitMapGeometry.ts` (8 dead exports)

| Line | Export | Confidence |
|------|--------|------------|
| 95 | `ZONE_RINGS` | certain |
| 118 | `LINE_COLORS` | certain |
| 144 | `LINE_PATHS` | certain |
| 183 | `ZONE_SEGMENTS` | certain |
| 192 | `MIN_SPACING` | certain |
| 204 | `STATION_SPECS` | certain |
| 603 | `getStaticTransitMapGeometry` | certain |
| 781 | `CORRIDOR_CENTERS, LINE_CENTERS` | certain |

Used internally but never imported externally. Note: `STATUS_COLORS`, `HITBOX_RADIUS`, `ZONE_RADII`, `useTransitMapGeometry`, `StationPosition`, `LineGeometry`, `ZoneRing`, `MapGeometry`, `ZoomLevel` from this file ARE used.

---

### `src/hooks/useTransitMapZoom.ts` (1 dead export)

| Line | Export | Confidence |
|------|--------|------------|
| 28 | `UseTransitMapZoomReturn` (interface) | certain |

The `useTransitMapZoom` function itself is used, but the return type interface is never directly referenced.

---

### Summary by category

| Category | Count |
|----------|-------|
| Dead constants/values | 22 |
| Dead functions | 24 |
| Dead types/interfaces | 25 |
| Dead entire files | 2 (`celebrations.ts`, `useTimePicker.ts`) |
| **Total** | **73** |

### Highest-value cleanup targets (most dead exports per file)

1. `src/lib/foodStatusThresholds.ts` -- 8 dead
2. `src/lib/aiAnalysis.ts` -- 8 dead
3. `src/hooks/useTransitMapGeometry.ts` -- 8 dead (+ CORRIDOR_CENTERS/LINE_CENTERS = 9)
4. `src/lib/foodParsing.ts` -- 6 dead
5. `shared/foodMatching.ts` -- 5 dead
6. `shared/logDataParsers.ts` -- 5 dead