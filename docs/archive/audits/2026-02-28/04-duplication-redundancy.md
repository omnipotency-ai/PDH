# Category 5: Duplication & Redundancy Audit

**Date:** 2026-02-28
**Scope:** `src/` directory
**Auditor:** Claude Opus 4.6

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 1 |
| HIGH | 5 |
| MODERATE | 6 |
| LOW | 4 |
| COULD BE IMPROVED | 3 |

---

## CRITICAL

### DUP-01: `inputSafety.ts` duplicated across frontend and Convex backend

**Files:**
- `/Users/peterjamesblizzard/projects/caca_traca/src/lib/inputSafety.ts` (lines 1-43)
- `/Users/peterjamesblizzard/projects/caca_traca/convex/lib/inputSafety.ts` (lines 1-105)

**Description:**
The `sanitizePlainText` and `sanitizeUnknownStringsDeep` functions are implemented independently in both the frontend (`src/lib/inputSafety.ts`) and the Convex backend (`convex/lib/inputSafety.ts`). Both share the same regex, the same normalization logic (`NFKC`, `\r\n` -> `\n`, control char stripping), and the same traversal pattern for deep sanitization.

The implementations have already diverged:
- The frontend version accepts `maxLength` as an option on `sanitizePlainText` and throws on overflow.
- The Convex version has a separate `assertMaxLength` helper, `sanitizeRequiredText`, `sanitizeOptionalText`, `sanitizeStringArray`, and `INPUT_SAFETY_LIMITS` constants that the frontend lacks.
- The deep sanitization in the Convex version tracks path names for error messages and enforces `maxStringLength`; the frontend version does neither.

**Frontend snippet:**
```typescript
// src/lib/inputSafety.ts
const CONTROL_CHARS_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function sanitizePlainText(value: string, options: SanitizeTextOptions = {}) {
  const { trim = true, preserveNewlines = true, maxLength } = options;
  let text = String(value ?? "");
  text = text.normalize("NFKC").replace(/\r\n?/g, "\n").replace(CONTROL_CHARS_RE, "");
  if (!preserveNewlines) { text = text.replace(/\s+/g, " "); }
  text = trim ? text.trim() : text;
  if (typeof maxLength === "number" && maxLength > 0 && text.length > maxLength) {
    throw new Error(`Text exceeds maximum length of ${maxLength} characters.`);
  }
  return text;
}
```

**Convex snippet:**
```typescript
// convex/lib/inputSafety.ts
const CONTROL_CHARS_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function sanitizePlainText(value: string, options: SanitizeTextOptions = {}) {
  const { trim = true, preserveNewlines = true } = options;
  let text = String(value ?? "");
  text = text.normalize("NFKC").replace(/\r\n?/g, "\n").replace(CONTROL_CHARS_RE, "");
  if (!preserveNewlines) { text = text.replace(/\s+/g, " "); }
  return trim ? text.trim() : text;
}
```

**Risk:** Any sanitization fix applied to one side may not be applied to the other. A bypass that allows a malicious string through the frontend sanitizer would still reach the backend, but a different bypass in the backend sanitizer would allow unsanitized data into storage.

**Recommendation:**
Extract the shared core logic into a `packages/shared/inputSafety.ts` (or similar shared module) that both frontend and Convex import. The Convex-specific helpers (`sanitizeRequiredText`, `INPUT_SAFETY_LIMITS`, etc.) can remain in the Convex file, calling the shared core. Alternatively, since Convex may not allow importing from `src/`, consider a `convex/_shared/` directory or a build step to copy a canonical file.

---

## HIGH

### DUP-02: `DrPooReply` interface defined identically in two files

**Files:**
- `/Users/peterjamesblizzard/projects/caca_traca/src/store.ts` (lines 213-216)
- `/Users/peterjamesblizzard/projects/caca_traca/src/lib/aiAnalysis.ts` (lines 31-34)

**Snippets:**

```typescript
// src/store.ts:213
export interface DrPooReply {
  text: string;
  timestamp: number;
}

// src/lib/aiAnalysis.ts:31
export interface DrPooReply {
  text: string;
  timestamp: number;
}
```

**Risk:** If someone adds a field to one definition (e.g., `reportId`), the other will not have it, leading to runtime shape mismatches. The `aiAnalysis.ts` version is used by the analysis function, and the `store.ts` version is used by the store state. They are structurally the same but are independently maintained.

**Recommendation:** Define `DrPooReply` in one place (the store already defines it and it is the canonical source of truth for state shapes) and import it in `aiAnalysis.ts`.

---

### DUP-03: `formatWeight` function duplicated across three locations

**Files:**
- `/Users/peterjamesblizzard/projects/caca_traca/src/lib/formatWeight.ts` (lines 1-6) -- canonical
- `/Users/peterjamesblizzard/projects/caca_traca/src/components/track/WeightTrendCard.tsx` (lines 9-14) -- inline copy
- `/Users/peterjamesblizzard/projects/caca_traca/src/components/track/TodayLog.tsx` (lines 2309-2314, 2320, 2329-2330, 2342-2343, 2886-2889) -- inline reimplementation

**Canonical:**
```typescript
// src/lib/formatWeight.ts
export function formatWeight(kg: number, unit: "kg" | "lbs"): string {
  if (unit === "lbs") {
    return `${(kg * 2.20462).toFixed(1)} lbs`;
  }
  return `${kg.toFixed(1)} kg`;
}
```

**WeightTrendCard (exact copy):**
```typescript
// src/components/track/WeightTrendCard.tsx:9
function formatWeight(kg: number, unit: "kg" | "lbs"): string {
  if (unit === "lbs") {
    return `${(kg * 2.20462).toFixed(1)} lbs`;
  }
  return `${kg.toFixed(1)} kg`;
}
```

**TodayLog (inline reimplementation with subtle differences):**
```typescript
// src/components/track/TodayLog.tsx:2311-2313
weightUnit === "lbs"
  ? `${(kg * 2.20462).toFixed(1)} lbs`
  : `${kg.toFixed(1)} kg`
```

Additionally, `WeightTrendCard.tsx` defines a local `deltaLabel` function (line 50-55) that is functionally similar to `formatWeightDelta` in `src/lib/formatWeight.ts`:

```typescript
// WeightTrendCard.tsx:50
function deltaLabel(delta: number, unit: "kg" | "lbs"): string {
  const abs = Math.abs(unit === "lbs" ? delta * 2.20462 : delta);
  const sign = delta < 0 ? "-" : "+";
  const unitStr = unit === "lbs" ? " lbs" : " kg";
  return `${sign}${abs.toFixed(1)}${unitStr}`;
}
```

**Recommendation:** Delete the local copies in `WeightTrendCard.tsx` and `TodayLog.tsx`, and import from `@/lib/formatWeight`.

---

### DUP-04: Weight conversion constant (`2.20462` / `0.45359237`) scattered across 5+ files

**Files with `2.20462` (kg-to-lbs):**
- `/Users/peterjamesblizzard/projects/caca_traca/src/lib/formatWeight.ts` (lines 3, 11)
- `/Users/peterjamesblizzard/projects/caca_traca/src/components/track/WeightTrendCard.tsx` (lines 11, 51)
- `/Users/peterjamesblizzard/projects/caca_traca/src/components/track/TodayLog.tsx` (lines 2312, 2320, 2330, 2343, 2888)
- `/Users/peterjamesblizzard/projects/caca_traca/src/components/track/ActivitySection.tsx` (line 66)

**Files with `0.45359237` (lbs-to-kg):**
- `/Users/peterjamesblizzard/projects/caca_traca/src/components/track/WeightEntryDrawer.tsx` (line 14)
- `/Users/peterjamesblizzard/projects/caca_traca/src/components/settings/health/DemographicsSection.tsx` (line 7)

**Note:** These are inverse constants: `1 / 0.45359237 = 2.20462`. Some files use one, some use the other, with slightly different precision. The magic number `2.20462` appears as a raw literal in 10+ locations.

**Recommendation:** Define conversion constants and helper functions in one place (e.g., `src/lib/formatWeight.ts`):
```typescript
export const LBS_PER_KG = 2.20462;
export const KG_PER_LB = 0.45359237;
export function kgToLbs(kg: number): number { return kg * LBS_PER_KG; }
export function lbsToKg(lbs: number): number { return lbs * KG_PER_LB; }
```
Then replace all raw occurrences of `* 2.20462` and `/ 2.20462` with these helpers.

---

### DUP-05: `BLOCKED_FLUID_PRESET_NAMES` (store.ts) vs `HARDWIRED_FLUID_NAMES` (FluidSection.tsx)

**Files:**
- `/Users/peterjamesblizzard/projects/caca_traca/src/store.ts` (lines 387-395)
- `/Users/peterjamesblizzard/projects/caca_traca/src/components/track/FluidSection.tsx` (lines 14-22)

**store.ts:**
```typescript
export const BLOCKED_FLUID_PRESET_NAMES = new Set([
  "water", "agua", "coffee", "cafe", "café", "kaffee", "other",
]);
```

**FluidSection.tsx:**
```typescript
const HARDWIRED_FLUID_NAMES = new Set([
  "water", "coffee", "cafe", "café", "kaffee", "other", "agua",
]);
```

These are exactly the same set of strings, just in different order, with different constant names. The store uses `BLOCKED_FLUID_PRESET_NAMES` to filter custom presets; the `FluidSection` uses `HARDWIRED_FLUID_NAMES` to filter display presets. Both serve the same purpose: preventing users from creating presets that duplicate built-in fluid buttons.

**Risk:** Adding a new hardwired fluid (e.g., "tea") to one list but not the other would create inconsistent behavior -- the preset might be creatable in the store but invisible in the UI, or vice versa.

**Recommendation:** Delete `HARDWIRED_FLUID_NAMES` from `FluidSection.tsx` and import `BLOCKED_FLUID_PRESET_NAMES` from the store.

---

### DUP-06: `STATUS_ORDER` map duplicated with different sort directions

**Files:**
- `/Users/peterjamesblizzard/projects/caca_traca/src/lib/analysis.ts` (lines 103-110)
- `/Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/FoodSafetyDatabase.tsx` (lines 352-359)

**analysis.ts (safe first):**
```typescript
const STATUS_ORDER: Record<FoodStatus, number> = {
  safe: 0,
  "safe-loose": 1,
  "safe-hard": 2,
  testing: 3,
  watch: 4,
  risky: 5,
};
```

**FoodSafetyDatabase.tsx (risky first):**
```typescript
const STATUS_ORDER: Record<FoodStatus, number> = {
  risky: 0,
  watch: 1,
  "safe-loose": 2,
  "safe-hard": 3,
  safe: 4,
  testing: 5,
};
```

**Description:** Both define a `STATUS_ORDER` map keyed by `FoodStatus`, but with intentionally different orderings. The analysis file sorts safe-first (for data processing), and the UI sorts risky-first (for user attention). Having two independent maps for the same type is a maintenance burden.

**Recommendation:** Export both orderings from `analysis.ts`:
```typescript
export const STATUS_ORDER_SAFE_FIRST: Record<FoodStatus, number> = { ... };
export const STATUS_ORDER_RISKY_FIRST: Record<FoodStatus, number> = { ... };
```
Import the appropriate one in `FoodSafetyDatabase.tsx`.

---

## MODERATE

### DUP-07: Dual correlation systems -- `analyzeFactors()` vs `computeCorrelations()`

**Files:**
- `/Users/peterjamesblizzard/projects/caca_traca/src/lib/analysis.ts` -- `analyzeFactors()` (lines 512-574) and helpers `buildWalkCorrelation`, `buildSmokingCorrelation`, `buildSleepCorrelation`, `buildFluidCorrelation` (lines 632-765)
- `/Users/peterjamesblizzard/projects/caca_traca/src/lib/digestiveCorrelations.ts` -- `computeCorrelations()` (lines 337-354) and helpers `waterPaneConfig`, `walkPaneConfig`, `sleepPaneConfig`, `destructivePaneConfig` (lines 163-267)

**Description:** Both systems answer the same question: "How do lifestyle factors (water, walking, sleep, smoking/destructive habits) correlate with bowel quality?" But they use different approaches:

- `analysis.ts` operates on raw `SyncedLog[]`, groups by calendar day, computes `FactorCorrelation[]` with `looseRateWith/Without` and `avgBristolWith/Without`.
- `digestiveCorrelations.ts` operates on pre-aggregated `HabitDaySummary[]` + `DayDigestiveMetrics[]`, ranks days by quality, and produces `CorrelationPaneSummary[]` with best/worst day lists and summary text.

Both compute the same underlying statistics (walk vs no-walk days, sleep vs poor sleep, etc.) but with different data shapes and different output types.

**Risk:** A change to the way "good sleep" is defined in one system will not propagate to the other. Currently `analysis.ts` uses `sleepHours >= 7` as the threshold and `digestiveCorrelations.ts` ranks days by overall BM quality without a fixed sleep threshold.

**Recommendation:** This is a legitimate case of two different abstraction levels (raw analysis vs pre-aggregated), but the factor extraction logic could be shared. Consider extracting the "per-day aggregation" step from `analysis.ts` into a shared helper that both systems can consume.

---

### DUP-08: `FoodStatus` vs `FoodTrialStatus` -- overlapping type definitions

**Files:**
- `/Users/peterjamesblizzard/projects/caca_traca/src/lib/analysis.ts` (line 4):
  ```typescript
  export type FoodStatus = "safe" | "safe-loose" | "safe-hard" | "watch" | "risky" | "testing";
  ```
- `/Users/peterjamesblizzard/projects/caca_traca/src/lib/sync.ts` (lines 281-289):
  ```typescript
  export type FoodTrialStatus =
    | "testing" | "safe" | "safe_loose" | "safe_hard"
    | "watch" | "risky" | "culprit" | "cleared";
  ```

**Description:** These types represent the same concept (the status of a food in the safety database) but use different naming conventions (`safe-loose` vs `safe_loose`) and different member sets (one has `culprit` and `cleared`, the other does not). This stems from the frontend analysis using one type and the Convex backend using a slightly different one.

**Risk:** Converting between these types requires explicit mapping, and adding a new status to one type but not the other will cause silent failures.

**Recommendation:** Unify the two types. If the backend requires additional statuses like `culprit` and `cleared`, make `FoodStatus` a superset:
```typescript
export type FoodStatus = "safe" | "safe-loose" | "safe-hard" | "watch" | "risky" | "testing" | "culprit" | "cleared";
```

---

### DUP-09: Deprecated re-exports kept alive

**Files:**
- `/Users/peterjamesblizzard/projects/caca_traca/src/lib/aiAnalysis.ts` (lines 18-19):
  ```typescript
  /** @deprecated Use DEFAULT_INSIGHT_MODEL from @/lib/aiModels instead. */
  export const DEFAULT_AI_MODEL = DEFAULT_INSIGHT_MODEL;
  ```
- `/Users/peterjamesblizzard/projects/caca_traca/src/lib/foodParsing.ts` (lines 3-4):
  ```typescript
  /** @deprecated Use BACKGROUND_MODEL from @/lib/aiModels instead. */
  export const FOOD_PARSE_MODEL = BACKGROUND_MODEL;
  ```

**Description:** These deprecated aliases simply re-export their canonical counterpart. They add dead code and confusion about which import to use.

**Recommendation:** Grep for all imports of `DEFAULT_AI_MODEL` and `FOOD_PARSE_MODEL`, update them to use the canonical imports from `@/lib/aiModels`, then delete the deprecated re-exports.

---

### DUP-10: `LogType` in store.ts mirrors `SyncedLog["type"]` in sync.ts

**Files:**
- `/Users/peterjamesblizzard/projects/caca_traca/src/store.ts` (lines 28-35):
  ```typescript
  export type LogType =
    | "food" | "fluid" | "habit" | "activity" | "digestion" | "weight" | "reproductive";
  ```
- `/Users/peterjamesblizzard/projects/caca_traca/src/lib/sync.ts` (lines 13-14):
  ```typescript
  type: "food" | "fluid" | "habit" | "activity" | "digestion" | "weight" | "reproductive";
  ```

**Description:** The same union literal type is written out in full in two places. If a new log type is added, both must be updated.

**Recommendation:** Import and reuse `LogType` from the store in `sync.ts`:
```typescript
import type { LogType } from "@/store";
export type SyncedLog = { id: string; timestamp: number; type: LogType; data: any; };
```

---

### DUP-11: PrivacyPage and TermsPage share identical page shell structure

**Files:**
- `/Users/peterjamesblizzard/projects/caca_traca/src/pages/PrivacyPage.tsx` (lines 1-9)
- `/Users/peterjamesblizzard/projects/caca_traca/src/pages/TermsPage.tsx` (lines 1-9)

**Snippets (identical structure):**
```tsx
<div data-theme="dark" className="min-h-screen bg-[#080c14] text-[rgba(240,248,255,0.95)]">
  <ChakraBar />
  <div className="mx-auto max-w-3xl px-4 py-16 md:px-6">
    <Link to="/home" className="mb-8 inline-block text-sm text-[var(--text-faint)] transition-colors hover:text-[var(--teal)]">
      Back to Home
    </Link>
    <h1 className="mb-8 font-display text-4xl font-extrabold text-[var(--text)]">
      {title}
    </h1>
    <div className="prose-landing space-y-6 text-sm leading-relaxed text-[var(--text-muted)]">
      ...content...
    </div>
  </div>
</div>
```

**Recommendation:** Extract a `LegalPageShell` component:
```tsx
function LegalPageShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div data-theme="dark" className="min-h-screen bg-[#080c14] text-[rgba(240,248,255,0.95)]">
      <ChakraBar />
      <div className="mx-auto max-w-3xl px-4 py-16 md:px-6">
        <Link to="/home" className="...">Back to Home</Link>
        <h1 className="...">{title}</h1>
        <div className="prose-landing ...">{children}</div>
      </div>
    </div>
  );
}
```

---

### DUP-12: Lifestyle section radio button pattern repeated 3 times

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/components/settings/health/LifestyleSection.tsx`

The same Yes/No radio button pattern is repeated for Smoking (lines 160-181), Alcohol (lines 229-250), and Recreational Substances (lines 305-326):

```tsx
<div className="flex flex-wrap gap-4">
  <label className="inline-flex items-center gap-2 text-xs text-[var(--text)]">
    <input type="radio" name="{name}" checked={choice === "yes"} onChange={...}
      className="h-3.5 w-3.5 accent-[var(--section-health)]" />
    Yes
  </label>
  <label className="inline-flex items-center gap-2 text-xs text-[var(--text)]">
    <input type="radio" name="{name}" checked={choice === "no"} onChange={...}
      className="h-3.5 w-3.5 accent-[var(--section-health)]" />
    No
  </label>
</div>
```

Similarly, the "Frequency of use" select dropdown pattern is repeated for alcohol, stimulants, and depressants (lines 269-280, 343-356, 389-400).

**Recommendation:** Extract a `<YesNoRadioGroup name={...} value={...} onChange={...} />` and `<FrequencySelect value={...} onChange={...} />` component.

---

## LOW

### DUP-13: Section header boilerplate repeated across 15+ components

**Files:** Appears in `FoodSection.tsx`, `FluidSection.tsx`, `BowelSection.tsx`, `ActivitySection.tsx`, `QuickCapture.tsx`, `ObservationWindow.tsx`, `TodayLog.tsx`, `FoodSafetyDatabase.tsx`, `NextFoodCard.tsx`, `FactorInsights.tsx`, `MealPlanSection.tsx`, `WeightTracker.tsx`, `CycleHormonalSection.tsx`, `AiInsightsSection.tsx`, `ReproductiveHealthPatterns.tsx`

**Pattern:**
```tsx
<div className="section-header">
  <div className="section-icon" style={{ backgroundColor: "var(--section-{name}-muted)" }}>
    <Icon className="w-4 h-4" style={{ color: "var(--section-{name})" }} />
  </div>
  <span className="section-title" style={{ color: "var(--section-{name})" }}>
    {Title}
  </span>
</div>
```

This pattern is identical in structure across all components, with only the section color variable and icon/title differing. The CSS classes `section-header`, `section-icon`, and `section-title` are defined in `index.css` (lines 1099-1122).

**Recommendation:** Create a `<SectionHeader icon={Icon} title="Food" section="food" />` component to reduce the ~8 lines to 1.

---

### DUP-14: `glass-card` CSS variants -- 13 nearly identical blocks

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/index.css` (lines 595-877)

Each glass card variant (food, fluid, bowel, activity, quick, observe, summary, log, habits, health, repro, tracking, appdata) defines the same structure:

```css
.glass-card-{name} {
  border-color: var(--section-{name}-border);
  box-shadow: 0 1px 3px var(--section-{name}-shadow);
}
.glass-card-{name}:hover {
  border-color: var(--section-{name}-hover-border);
  box-shadow: 0 2px 8px var(--section-{name}-hover-shadow);
}
```

Then repeated again for `[data-theme="light"]` overrides (lines 794-877), adding 13 more small blocks.

**Recommendation:** This is a CSS-level concern rather than TypeScript, but it could be simplified with a CSS custom property pattern or a single parameterized utility class. Consider a Tailwind plugin or CSS `@each`-like approach via PostCSS.

---

### DUP-15: Condition chip styling repeated in ConditionsSection

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/components/settings/health/ConditionsSection.tsx`

Lines 30-55 (GI conditions) and lines 63-88 (comorbidities) contain identical chip rendering logic:

```tsx
{OPTIONS.map((condition) => {
  const selected = healthProfile.healthConditions.includes(condition);
  return (
    <button
      key={condition}
      type="button"
      onClick={() => toggleCondition(condition)}
      className={cn(
        "settings-chip inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs transition-all",
        selected ? "border-[var(--section-health)]/50 ..." : "border-[var(--surface-3)] ...",
      )}
    >
      <Check className={cn("h-3 w-3 transition-all duration-200", ...)} />
      <span className="whitespace-nowrap font-normal">{condition}</span>
    </button>
  );
})}
```

**Recommendation:** Extract a `<ChipGroup options={OPTIONS} selected={healthProfile.healthConditions} onToggle={toggleCondition} />` component.

---

### DUP-16: `KG_PER_LB` constant defined independently in two files

**Files:**
- `/Users/peterjamesblizzard/projects/caca_traca/src/components/track/WeightEntryDrawer.tsx` (line 14): `const KG_PER_LB = 0.45359237;`
- `/Users/peterjamesblizzard/projects/caca_traca/src/components/settings/health/DemographicsSection.tsx` (line 7): `const KG_PER_LB = 0.45359237;`

**Recommendation:** Move to `src/lib/formatWeight.ts` alongside the other weight conversion utilities and import from there.

---

## COULD BE IMPROVED

### DUP-17: `isDeprecatedHabitId()` filtering repeated in 10+ locations

**Files:** `store.ts` (6 call sites), `sync.ts` (4 call sites), `deprecatedHabits.ts` (1 definition)

Every time habits or habit logs are read, the code applies `.filter(h => !isDeprecatedHabitId(h.id))`. This defensive check is applied at:
- Store initialization, migration, `addHabit`, `setHabits`, `updateHabit`, `addHabitLog`
- `useSyncedLogs`, `useSyncedLogsByRange`, `useProfileSync` (both read and write)

While not strictly "duplicated logic" (they all call the same function), the fact that every consumer must remember to filter deprecated habits is error-prone.

**Recommendation:** Consider intercepting at a lower level -- e.g., a middleware in the Zustand store that automatically strips deprecated habits from all reads/writes, or a custom `useFilteredHabits()` hook that wraps the store selector.

---

### DUP-18: AI client creation pattern repeated across 3 files

**Files:**
- `/Users/peterjamesblizzard/projects/caca_traca/src/lib/habitCoaching.ts` (lines 46, 248, 387, 525): `const client = await getOpenAIClient(apiKey);` followed by `checkRateLimit();`
- `/Users/peterjamesblizzard/projects/caca_traca/src/lib/aiAnalysis.ts`: similar pattern with `getOpenAIClient`
- `/Users/peterjamesblizzard/projects/caca_traca/src/lib/foodParsing.ts` (lines 260-261): creates its own OpenAI client directly:
  ```typescript
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
  ```

**Description:** `foodParsing.ts` does not use the shared `getOpenAIClient` helper and instead creates a new OpenAI instance directly with a dynamic import. This means it does not benefit from any centralized client configuration or caching that `openaiClient.ts` provides.

**Recommendation:** Update `foodParsing.ts` to use `getOpenAIClient(apiKey)` from `@/lib/openaiClient` for consistency and single point of configuration.

---

### DUP-19: Factor correlation builder functions share identical structure

**File:** `/Users/peterjamesblizzard/projects/caca_traca/src/lib/analysis.ts`

The four correlation builders (`buildWalkCorrelation`, `buildSmokingCorrelation`, `buildSleepCorrelation`, `buildFluidCorrelation`) at lines 632-765 share a highly similar structure:

1. Split days into two groups (with/without the factor)
2. Call `buildDayMetrics(withDays, withoutDays)`
3. Return a `FactorCorrelation` object with the metrics

While each has unique grouping logic, the return shape and metric computation are identical. The `digestiveCorrelations.ts` file solved this same problem elegantly with a `PaneConfig` builder pattern (lines 100-159), which shows that the pattern is recognized but not applied consistently.

**Recommendation:** Refactor the `analysis.ts` factor builders to use a similar config-driven approach, reducing ~130 lines to ~50.

---

## Non-Findings (Investigated but Not Duplicated)

The following areas were investigated and found to be acceptably non-duplicated:

1. **`SyncedLogsContext`** -- Properly wraps `useSyncedLogs` in a single provider to prevent duplicate Convex subscriptions. Well designed.

2. **`habitTemplates.ts` / `habitConstants.ts`** -- These are complementary, not overlapping. Templates define HabitConfig shapes; constants define behavior flags.

3. **`analysis.ts` vs `aiAnalysis.ts`** -- Despite similar names, these serve completely different purposes. `analysis.ts` does local statistical analysis; `aiAnalysis.ts` sends data to OpenAI for AI-powered insights. No code is shared between them, and that is correct.

4. **Section header CSS in `index.css`** -- The `.section-header`, `.section-icon`, `.section-title` classes are defined once and used by the repeated JSX pattern. The CSS itself is not duplicated.

5. **Store types re-exported** -- `HabitConfig`, `HabitLog`, `GamificationState`, `SleepGoal` are re-exported from the store via `export type { ... }` which is idiomatic TypeScript and not duplication.
