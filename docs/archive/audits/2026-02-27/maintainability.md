# Maintainability Audit

**Date:** 2026-02-27
**Scope:** All staged files (49 code files)
**Reviewer:** Claude Opus 4.6 -- Maintainability Specialist

---

## Executive Summary

This changeset represents a significant evolution of the habit tracking system -- migrating from a flat "goalMode/dailyGoal" model to a richer "kind/dailyTarget/dailyCap" schema, adding AI coaching tiers, digestive correlation analytics, and a backward-compatibility layer for legacy data. The decomposition of the 1400-line `Settings.tsx` monolith into focused form components is a clear maintainability win. However, several files introduce substantial complexity that risks becoming hard to modify: the 580-line `habitHistoryCompat.ts` backward-compat layer, duplicated normalization logic between the Convex backend and frontend, and the Track page accumulating orchestration responsibilities that should be lifted into hooks or a context provider.

---

## Critical Issues

### C1. Duplicated habit normalization logic across Convex backend and frontend

The exact same normalization and inference logic exists in two places:

- **`convex/logs.ts`** lines 23-170: `KNOWN_HABIT_TYPES`, `inferLegacyHabitType()`, `inferHabitKind()`, `normalizeStoredProfileHabit()`, and associated helpers.
- **`src/lib/habitTemplates.ts`** lines 47-78, 120-170: `inferHabitType()`, `inferKind()`, `normalizeHabitConfig()`, and the same habit-type regex patterns.

These are not simple copies -- they have subtle divergences. For example, the Convex version checks for `"hygiene"`, `"wellness"`, and `"recovery"` habit types that the frontend `inferHabitType()` no longer recognizes. The frontend's `inferHabitType` has `"hydration"`, `"alcohol"`, and `"sleep"` which the Convex version also has, but the match patterns differ slightly (e.g., the Convex version checks `/water|hydrat/` while the frontend checks `/water|hydrat/` -- same, but `"hygiene"` and `"wellness"` are handled differently).

```typescript
// convex/logs.ts -- still recognizes removed types
if (/teeth|brush|hygiene|shower|bath/.test(key)) return "hygiene";
if (/breathe|stretch|yoga|wellness/.test(key)) return "wellness";
if (/journal|recovery|therapy|reflect/.test(key)) return "recovery";

// src/lib/habitTemplates.ts -- these types are gone
// No hygiene, wellness, or recovery -- they become "custom"
```

If either side is updated independently, profile sync will produce inconsistent data. This is the single largest maintainability risk in this changeset.

**Recommendation:** Extract shared habit type inference and normalization into a single-source-of-truth module. Since the Convex backend cannot import frontend code, consider a shared `convex/lib/habitNormalization.ts` module that both `convex/logs.ts` and a thin frontend adapter consume. Alternatively, fully commit to server-side normalization in `getProfile` and remove client-side normalization of synced profiles.

---

### C2. Track.tsx is accumulating too many orchestration responsibilities (550+ lines)

`src/pages/Track.tsx` has grown to manage:

- Habit log aggregation and backward-compat backfill
- Streak computation
- AI coaching state (debounce timer, loading flag, message)
- Sleep/fluid/habit/bowel/food/weight logging handlers
- Celebration logic
- Weekly summary auto-trigger
- Fluid totals computation

The component now has 10+ `useMemo` hooks, 5+ `useEffect` hooks, a `useRef` for debouncing, and 12+ handler functions. Many of these are self-contained subsystems that should be custom hooks.

```typescript
// src/pages/Track.tsx -- coaching state that should be a useCoaching() hook
const [coachMessage, setCoachMessage] = useState<string | null>(null);
const [coachLoading, setCoachLoading] = useState(false);
const coachTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

useEffect(() => {
  return () => {
    if (coachTimerRef.current) clearTimeout(coachTimerRef.current);
  };
}, []);

const refreshCoaching = useCallback(
  () => {
    /* 25 lines */
  },
  [
    /*6 deps*/
  ],
);
```

Similarly, the habit compat backfill effect with its `lastHabitImportBatchKeyRef` is a self-contained concern:

```typescript
// src/pages/Track.tsx -- should be a useHabitBackfill() hook
const habitHistoryCompat = useMemo(
  () => buildHabitHistoryCompatBackfill(logs, habitLogs, habits),
  [logs, habitLogs, habits],
);
const lastHabitImportBatchKeyRef = useRef<string | null>(null);
useEffect(() => {
  /* 20 lines of import logic */
}, [habitHistoryCompat.imports, syncKey]);
```

**Recommendation:** Extract at minimum:

1. `useCoaching(habits, todayHabitCounts, todayFluidMl, streakSummaries, apiKey)` -- manages debounce, AI/heuristic fallback, loading state
2. `useHabitBackfill(logs, habitLogs, habits)` -- manages compat layer and import side-effects
3. `useHabitStreaks(habitLogs, habits)` -- manages daySummaries and streakSummaries computation

---

## High Severity

### H1. `habitHistoryCompat.ts` is a 580-line module with no tests and complex deduplication logic

This file contains sophisticated deduplication using binary search across time windows, multiple source kinds, and slot-based habit resolution. The `QUICK_IMPORT_DEDUPE_WINDOW_MS = 1500` constant is a magic number whose value would require understanding the entire dual-write path to validate.

Key complexity areas:

```typescript
// src/lib/habitHistoryCompat.ts -- binary search for near-simultaneous events
const hasNearbyLocalEquivalent = (
  habitId: string,
  at: number,
  value: number,
): boolean => {
  const times = nearbyLocalTimesByHabitValue.get(valueKey(habitId, 0, value));
  if (!times || times.length === 0) return false;
  let lo = 0;
  let hi = times.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const diff = times[mid] - at;
    if (Math.abs(diff) <= QUICK_IMPORT_DEDUPE_WINDOW_MS) return true;
    if (diff < 0) lo = mid + 1;
    else hi = mid - 1;
  }
  return false;
};
```

The file header says "Production cleanup target: run a one-time data migration..." but there is no tracking mechanism (e.g., a TODO issue reference) to ensure this actually happens.

**Recommendation:** Add unit tests for the deduplication logic, especially edge cases around the 1500ms window. Add a concrete cleanup ticket reference in the comment. Consider adding a `console.warn` or analytics event when the compat layer performs imports, so you can track when it is safe to remove.

---

### H2. `convex/validators.ts` frequency enum is duplicated 4 times

The same usage frequency union validator appears for `alcoholFrequency`, `recreationalStimulantsFrequency`, `recreationalDepressantsFrequency`, and `recreationalPsychedelicsFrequency`:

```typescript
// convex/validators.ts -- this block appears 4 times identically
v.union(
  v.literal("more_than_once_daily"),
  v.literal("daily"),
  v.literal("less_than_daily"),
  v.literal("less_than_weekly"),
  v.literal("less_than_monthly"),
  v.literal("less_than_yearly"),
  v.literal(""),
);
```

**Recommendation:** Extract as `const usageFrequencyValidator = v.union(...)` and reference it in each field, matching the pattern already established for `habitKindValidator` and `habitUnitValidator`.

---

### H3. `store.ts` migration function is a growing monolith

The `migrate` function in `src/store.ts` (version 10 -> 17) is a single function handling all historical migrations. At 100+ lines, it performs habit migration, health condition renaming, frequency validation, fluid default extraction, habit log initialization, and AI preference setup. Future schema changes will keep appending to this function.

```typescript
// src/store.ts -- single-pass migration handling everything
migrate: (persisted: any, _version: number) => {
  // ... 100+ lines of mixed concerns
  // No version checks -- runs all migrations every time
};
```

The `_version` parameter is not used, meaning every migration runs on every load regardless of which version the data is actually at. This is currently safe because migrations are idempotent, but it is fragile -- a non-idempotent migration step would break existing users.

**Recommendation:** Either use the `_version` parameter with step-wise migration (standard Zustand pattern), or document clearly that all migration logic must remain idempotent.

---

### H4. `habitCoaching.ts` directly accesses `useStore.getState()` from a non-React module

`src/lib/habitCoaching.ts` imports `useStore` and calls `useStore.getState()` in two places within `generatePaneSummary()`:

```typescript
// src/lib/habitCoaching.ts -- direct store access from a lib module
import { useStore } from "@/store";

export async function generatePaneSummary(...): Promise<string> {
  const cacheKey = paneCacheKey(context.paneId, context.bmMetrics);
  const cached = useStore.getState().paneSummaryCache[cacheKey];
  // ...
  useStore.getState().setPaneSummaryCacheEntry(cacheKey, { ... });
}
```

This creates a hidden dependency from a "pure" library module to the global store. It makes the function untestable without mocking the entire store, and it violates the principle that lib modules should receive their dependencies as arguments.

**Recommendation:** Pass cache read/write callbacks as parameters instead of reaching into the store directly. The calling component or hook can wire these up.

---

### H5. `v.any()` used for `aiPreferences` and `storedProfileHabitsValidator` in Convex schema

Two schema fields use `v.any()`, which disables all type validation:

```typescript
// convex/schema.ts
habits: storedProfileHabitsValidator,  // which is v.array(v.any())
aiPreferences: v.optional(v.any()),
```

While the habits field has a comment explaining why (`"Legacy profile rows may contain pre-HabitConfig objects"`), `aiPreferences` has no such justification. Using `v.any()` means corrupted or malicious data can be persisted without any server-side validation.

**Recommendation:** Define `aiPreferencesValidator` in `convex/validators.ts` to match the `AiPreferences` interface from the store. For `storedProfileHabitsValidator`, add a comment with a migration timeline for tightening validation.

---

## Medium Severity

### M1. `src/lib/aiAnalysis.ts` `buildSystemPrompt()` has grown to 250+ lines

The function now builds demographic lines, lifestyle lines, smoking detail lines, alcohol detail lines, recreational detail lines (with per-category sub-lines), and reproductive health lines -- all with nested conditionals. Each "line builder" follows the same pattern but is inline.

```typescript
// src/lib/aiAnalysis.ts -- repeated pattern for each substance category
if (recreationalCategories.includes("stimulants")) {
  const stimulantParts: string[] = [];
  const frequency = (profile.recreationalStimulantsFrequency ?? "").trim();
  if (frequency) stimulantParts.push(`frequency ${formatFrequency(frequency)}`);
  if (profile.recreationalStimulantsYears != null) {
    stimulantParts.push(`${profile.recreationalStimulantsYears}y`);
  }
  // ... identical pattern for depressants, psychedelics
}
```

**Recommendation:** Extract a `buildSubstanceDetailLine(category, frequency, years)` helper and call it three times.

---

### M2. `HealthProfile` interface in `store.ts` now has 30+ fields with no grouping

The `HealthProfile` interface has grown to include substance use fields with a naming convention (`smokingStatus`, `smokingCigarettesPerDay`, `smokingYears`, `smokingNotes`, then `alcoholUse`, `alcoholAmountPerSession`, etc.) but no nested structure. Compare with `reproductiveHealth` which is properly nested.

```typescript
// src/store.ts -- flat structure for substance use
export interface HealthProfile {
  gender: Gender;
  ageYears: number | null;
  surgeryType: SurgeryType;
  // ... 8 surgery/conditions fields ...
  smokingStatus: SmokingStatus;
  smokingCigarettesPerDay: number | null;
  smokingYears: number | null;
  smokingNotes: string;
  alcoholUse: AlcoholUse;
  alcoholAmountPerSession: string;
  alcoholFrequency: UsageFrequencyChoice;
  alcoholYearsAtCurrentLevel: number | null;
  alcoholNotes: string;
  recreationalDrugUse: string;
  recreationalCategories: RecreationalCategory[];
  recreationalStimulantsAmount: string;
  // ... 9 more recreational fields ...
  lifestyleNotes: string;
}
```

**Recommendation:** Group substance use fields into a nested `lifestyleProfile` sub-object (similar to `reproductiveHealth`) to improve organization and make partial updates cleaner. This would be a breaking schema change, so plan it as a versioned migration.

---

### M3. `QuickCapture.tsx` at 760 lines combines 4 distinct UI concerns

`src/components/track/QuickCapture.tsx` contains:

1. Sleep input drawer (with hour/minute picker)
2. Weight input drawer
3. Add-habit drawer (with template selection and custom form)
4. The main quick-capture grid

Each of these sub-components is defined inline. The sleep picker alone is ~80 lines of JSX.

**Recommendation:** Extract `SleepDrawerContent`, `WeightDrawerContent`, and `AddHabitDrawerContent` (already partially named) into their own files under `src/components/track/`. The main `QuickCapture` component should be a thin orchestrator.

---

### M4. `HabitDetailSheet.tsx` uses `window.innerWidth` for presentation mode

```typescript
// src/components/track/HabitDetailSheet.tsx
function useHabitDetailPresentationMode(): HabitDetailPresentationMode {
  const [mode, setMode] = useState<HabitDetailPresentationMode>(() => {
    if (typeof window === "undefined") return "mobile";
    return getHabitDetailPresentationMode(window.innerWidth);
  });

  useEffect(() => {
    // ...
    window.addEventListener("resize", updateMode);
    return () => {
      window.removeEventListener("resize", updateMode);
    };
  }, []);
  return mode;
}
```

This is a home-grown responsive hook that should use a CSS media query or the existing responsive mechanisms in the project. It also doesn't debounce the resize handler, which can cause excessive re-renders.

**Recommendation:** Use CSS media queries with Tailwind's responsive prefixes for layout changes, or debounce the resize listener. If this pattern is needed elsewhere, extract it as a shared `useBreakpoint()` hook.

---

### M5. `deleteAllBySyncKey` in `convex/logs.ts` is fragile to table additions

The delete-all mutation manually lists every table to clear:

```typescript
// convex/logs.ts -- must be updated whenever a new table is added
const logs = await ctx.db.query("logs").withIndex("by_syncKey", ...).collect();
const aiAnalyses = await ctx.db.query("aiAnalyses").withIndex("by_syncKey", ...).collect();
const conversations = await ctx.db.query("conversations").withIndex("by_syncKey", ...).collect();
// ... 7 more tables ...
```

If a new syncKey-indexed table is added to the schema, the developer must remember to add it here. There is no compile-time or runtime check for completeness.

**Recommendation:** Add a comment listing which schema tables have `by_syncKey` indexes, or derive the list from the schema definition if Convex supports introspection. At minimum, add a comment: "IMPORTANT: Update this list when adding new tables with by_syncKey indexes."

---

### M6. `normalizeFrequency()` defined in both `HealthForm.tsx` and `AppDataForm.tsx`

```typescript
// src/components/settings/HealthForm.tsx
function normalizeFrequency(value: unknown): UsageFrequencyChoice { ... }

// src/components/settings/AppDataForm.tsx
function normalizeUsageFrequency(value: unknown): UsageFrequencyChoice { ... }
```

Both do the same thing with slightly different names.

**Recommendation:** Extract to a shared utility (e.g., in `src/store.ts` alongside the type definition, or in a small `src/lib/settingsHelpers.ts`).

---

### M7. `HABIT_TEMPLATES` uses `Date.now()` for `createdAt` at module load time

```typescript
// src/lib/habitTemplates.ts
export const HABIT_TEMPLATES: Record<string, HabitConfig> = {
  water: {
    id: "habit_water",
    name: "Water",
    createdAt: Date.now(), // evaluated once at module load
    // ...
  },
  // ... all templates share the same createdAt
};
```

All templates will have the same `createdAt` timestamp (module load time). If templates are used as defaults for new users, they all appear to have been "created" at the exact same millisecond. More importantly, if this module is imported during SSR or testing, the timestamps will be meaningless.

**Recommendation:** Use `0` or a sentinel value for template `createdAt`, and set `Date.now()` only when a habit is actually added via `addHabit()`.

---

## Low Severity / Informational

### L1. `celebrations.ts` uses `Math.random()` for message selection

```typescript
// src/lib/celebrations.ts
const messageIndex = Math.floor(Math.random() * dailyMessages.length);
```

This is fine for UX variety but makes the function non-deterministic and harder to test. Consider accepting an optional seed or index parameter for testability.

---

### L2. `inputSafety.ts` syncKey limit increased from 128 to 512 without explanation

```typescript
// convex/lib/inputSafety.ts
syncKey: 512,  // was 128
```

The increase is large (4x). No comment explains why. If this is to support longer recovery keys, document the reason.

---

### L3. `deprecatedHabits.ts` uses `as any` in the Set initialization

```typescript
// src/lib/deprecatedHabits.ts
export const DEPRECATED_HABIT_IDS = new Set([
  "habit_teeth_brushing",
  "habit_shower",
] as const);

export function isDeprecatedHabitId(habitId: unknown): boolean {
  return (
    typeof habitId === "string" && DEPRECATED_HABIT_IDS.has(habitId as any)
  );
}
```

The `as any` is needed because `Set<"habit_teeth_brushing" | "habit_shower">.has()` doesn't accept `string`. This is a known TypeScript limitation. Consider typing the Set as `Set<string>` instead, which removes the need for the cast.

---

### L4. `BowelSection.tsx` accessibility improvement uses `useId()` correctly

The migration from `role="radio"` buttons to actual `<input type="radio">` elements with `<label>` wrappers is a good accessibility improvement. The use of `useId()` for the radio group name is correct.

---

### L5. `responsive-shell.tsx` provides a clean abstraction for drawer/dialog switching

The new `ResponsiveShell` component is well-structured with clear breakpoint logic and proper cleanup. Good addition.

---

### L6. Settings page decomposition is a significant maintainability improvement

The old `Settings.tsx` was 1434 lines. It is now 213 lines that compose `HealthForm`, `ReproForm`, `TrackingForm`, `AppDataForm`, `AiSuggestionsCard`, and `SettingsTile`. Each form component owns its own state and handlers. This is the right direction.

---

### L7. `WeightTracker.tsx` and `FactorInsights.tsx` changes are minimal and clean

Both files have minor adjustments (habit kind/goal references) that are consistent with the schema migration. No concerns.

---

### L8. The `useCelebration` hook properly simplified

Removing `celebrateMilestone` and the badge system simplifies the celebration flow. The badge system was over-engineered for a single-user app. Good cleanup.

---

### L9. `routeTree.tsx` change is a single import path update

Trivial change, no concerns.

---

### L10. CSS in `index.css` is well-organized with clear section comments

The new settings panel styles follow the existing naming conventions (`settings-panel`, `settings-panel-health`, etc.) and use CSS custom properties consistently. The addition of light/dark theme variants is thorough.

---

## Files Reviewed

| File                                                   | Status | Notes                                                                                                  |
| ------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------ |
| `convex/lib/inputSafety.ts`                            | M      | syncKey limit increased 128->512, no comment explaining why (L2)                                       |
| `convex/logs.ts`                                       | M      | Duplicated normalization logic (C1), fragile deleteAll (M5), server-side profile normalization is good |
| `convex/migrations.ts`                                 | M      | Defensive typing for raw habits, safe changes                                                          |
| `convex/schema.ts`                                     | M      | `v.any()` for aiPreferences and habits (H5)                                                            |
| `convex/validators.ts`                                 | M      | Frequency enum duplicated 4x (H2), good new habit validators                                           |
| `src/components/DailyProgress.tsx`                     | M      | Clean migration to new habit kind/goal model                                                           |
| `src/components/archive/DrPooReport.tsx`               | M      | Trivial: AI_DISCLAIMER -> getAiDisclaimer()                                                            |
| `src/components/patterns/DigestiveCorrelationGrid.tsx` | A      | Clean component, good separation of concern                                                            |
| `src/components/patterns/FactorInsights.tsx`           | M      | Minor adjustments, clean                                                                               |
| `src/components/patterns/WeightTracker.tsx`            | M      | Minor adjustments, clean                                                                               |
| `src/components/settings/AiSuggestionsCard.tsx`        | A      | Well-structured AI suggestions card                                                                    |
| `src/components/settings/AppDataForm.tsx`              | M      | Duplicate normalizeUsageFrequency (M6), good cloud sync logic                                          |
| `src/components/settings/HealthForm.tsx`               | M      | Large but well-organized, duplicate normalizeFrequency (M6)                                            |
| `src/components/settings/ReproForm.tsx`                | M      | Clean expansion of reproductive health fields                                                          |
| `src/components/settings/SettingsTile.tsx`             | M      | Clean tile component                                                                                   |
| `src/components/settings/TrackingForm.tsx`             | M      | Clean tracking preferences form                                                                        |
| `src/components/track/AICoachStrip.tsx`                | A      | Small, focused component. Good.                                                                        |
| `src/components/track/ActivitySection.tsx`             | M      | Sleep removed to QuickCapture. Clean.                                                                  |
| `src/components/track/BowelSection.tsx`                | M      | Accessibility improvement with radio inputs (L4)                                                       |
| `src/components/track/HabitDetailSheet.tsx`            | A      | Window resize without debounce (M4), otherwise well-structured                                         |
| `src/components/track/QuickCapture.tsx`                | A      | 760 lines, should be decomposed (M3)                                                                   |
| `src/components/track/QuickCaptureTile.tsx`            | A      | Clean tile component with long-press support                                                           |
| `src/components/track/TodayLog.tsx`                    | M      | Minor changes, clean                                                                                   |
| `src/components/track/TodayStatusRow.tsx`              | A      | Small, focused status display                                                                          |
| `src/components/ui/responsive-shell.tsx`               | A      | Clean drawer/dialog abstraction (L5)                                                                   |
| `src/hooks/useAiInsights.ts`                           | M      | Properly wired up habit correlation insights and AI preferences                                        |
| `src/hooks/useCelebration.ts`                          | M      | Good simplification removing badge system (L8)                                                         |
| `src/hooks/useWeeklySummaryAutoTrigger.ts`             | M      | Minor: passes aiPreferences.aiModel                                                                    |
| `src/lib/aiAnalysis.ts`                                | M      | buildSystemPrompt is 250+ lines (M1), tone matrix is a nice addition                                   |
| `src/lib/celebrations.ts`                              | A      | Small, focused. Non-deterministic message selection (L1)                                               |
| `src/lib/deprecatedHabits.ts`                          | A      | Clean deprecation filter. `as any` cast (L3)                                                           |
| `src/lib/digestiveCorrelations.ts`                     | A      | Well-structured correlation engine, good separation                                                    |
| `src/lib/foodParsing.ts`                               | M      | Minor changes, clean                                                                                   |
| `src/lib/habitAggregates.ts`                           | A      | Clean aggregation logic, good types                                                                    |
| `src/lib/habitCoaching.ts`                             | A      | Direct store access (H4), otherwise well-organized tiered coaching                                     |
| `src/lib/habitConstants.ts`                            | M      | Minor changes, clean                                                                                   |
| `src/lib/habitHistoryCompat.ts`                        | A      | 580 lines, complex dedup, no tests (H1)                                                                |
| `src/lib/habitIcons.tsx`                               | M      | Minor icon mapping updates                                                                             |
| `src/lib/habitTemplates.ts`                            | M      | Good schema migration, Date.now() in templates (M7)                                                    |
| `src/lib/streaks.ts`                                   | M      | Good cleanup removing unused badge/streak logic                                                        |
| `src/lib/sync.ts`                                      | M      | Proper deprecated habit filtering at sync boundary                                                     |
| `src/pages/Archive.tsx`                                | M      | Trivial changes                                                                                        |
| `src/pages/Patterns.tsx`                               | M      | Clean integration of digestive correlation grid                                                        |
| `src/pages/Settings.tsx`                               | M      | Excellent decomposition from 1434 to 213 lines (L6)                                                    |
| `src/pages/Track.tsx`                                  | M      | Too many responsibilities (C2)                                                                         |
| `src/routeTree.tsx`                                    | M      | Trivial import update (L9)                                                                             |
| `src/store.ts`                                         | M      | Growing migration monolith (H3), HealthProfile needs grouping (M2)                                     |
| `src/index.css`                                        | M      | Well-organized CSS additions (L10)                                                                     |

---

## Summary of Recommendations by Priority

1. **Critical:** Unify habit normalization between Convex and frontend (C1)
2. **Critical:** Extract Track.tsx orchestration into custom hooks (C2)
3. **High:** Add tests for `habitHistoryCompat.ts` deduplication (H1)
4. **High:** Extract frequency validator in `convex/validators.ts` (H2)
5. **High:** Make store migration version-aware or document idempotency requirement (H3)
6. **High:** Remove direct store access from `habitCoaching.ts` (H4)
7. **High:** Define proper validators for `aiPreferences` schema field (H5)
8. **Medium:** Extract substance detail builder in `aiAnalysis.ts` (M1)
9. **Medium:** Group substance fields into nested object in HealthProfile (M2)
10. **Medium:** Decompose `QuickCapture.tsx` into sub-components (M3)
