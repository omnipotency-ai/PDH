# Simplification Audit — Group 6

**Date:** 2026-04-06
**Scope:** src/lib/_, src/pages/_, src/store.ts, src/types/domain.ts, config files
**Auditor:** Claude Code (Sonnet 4.6)

---

## Summary

The codebase is generally in good shape — "boring code" is largely followed. Most of the findings below are moderate or nice-to-have. There are no critical architecture issues. The most impactful opportunities are: the dead `MIN_CALL_INTERVAL_MS <= 0` branch in `aiRateLimiter.ts`, the redundant `getMealSlot` / `getCurrentMealSlot` duplication, the `VALID_USAGE_FREQUENCIES` Set that mirrors the options array it sits next to, and the `createLogTypeGuard` factory in `store.ts` adding indirection without real benefit.

---

### [MODERATE] `getMealSlot` and `getCurrentMealSlot` are near-identical functions

**Category:** DRY  
**Files:** `src/lib/nutritionUtils.ts:52-82`  
**Description:**  
Both `getMealSlot(timestamp: number)` and `getCurrentMealSlot(now?: Date)` do exactly the same thing: extract an hour and walk `MEAL_SLOT_BOUNDARIES`. The only difference is how they receive their input. The test file even asserts they always return identical results for all 24 hours (line 185-191 of nutritionUtils.test.ts). Having two functions means two sets of tests and a risk of the implementations diverging.

**Suggested Simplification:**  
Keep `getMealSlot` as the canonical implementation. Implement `getCurrentMealSlot` as a thin one-liner that calls it:

```ts
export function getCurrentMealSlot(now?: Date): MealSlot {
  return getMealSlot((now ?? new Date()).getTime());
}
```

This eliminates the duplicated loop and makes the relationship explicit. The test "matches getMealSlot for all boundary hours" would then be trivially true by construction rather than needing explicit verification.

---

### [MODERATE] `aiRateLimiter.ts` — dead branch `MIN_CALL_INTERVAL_MS <= 0`

**Category:** Over-Engineering  
**Files:** `src/lib/aiRateLimiter.ts:17-18`  
**Description:**  
`checkRateLimit` opens with `if (MIN_CALL_INTERVAL_MS <= 0) { return; }`. `MIN_CALL_INTERVAL_MS` is a `const` set to `300_000`. It can never be `<= 0`. This branch is permanently dead code that adds noise and implies the value might be configurable at runtime, which it is not.

**Suggested Simplification:**  
Remove the dead guard. If testing requires bypassing the rate limit, use `resetRateLimit()` (which already exists) rather than the dead branch:

```ts
export function checkRateLimit(): void {
  const now = Date.now();
  if (now - lastCallTimestamp < MIN_CALL_INTERVAL_MS) {
    throw new Error(
      "AI call rate limited — please wait 5 minutes between calls",
    );
  }
  lastCallTimestamp = now;
}
```

---

### [MODERATE] `settingsUtils.ts` — `VALID_USAGE_FREQUENCIES` Set duplicates the options array

**Category:** DRY  
**Files:** `src/lib/settingsUtils.ts:21-30`  
**Description:**  
`USAGE_FREQUENCY_OPTIONS` (lines 6-19) already contains all valid frequency values. The `VALID_USAGE_FREQUENCIES` Set (lines 21-30) then repeats the same eight strings. If a new frequency is added to the options array, the Set must also be updated — a silent maintenance trap. The empty string `""` is intentionally excluded from the Set (it represents "not selected"), which is the only meaningful difference.

**Suggested Simplification:**  
Derive the Set from the options array, excluding the empty placeholder:

```ts
export const VALID_USAGE_FREQUENCIES = new Set(
  USAGE_FREQUENCY_OPTIONS.map((o) => o.value).filter((v) => v !== ""),
);
```

This keeps one source of truth and the exclusion of `""` is still visible.

---

### [MODERATE] `store.ts` — `createLogTypeGuard` factory adds indirection without real benefit

**Category:** Over-Engineering  
**Files:** `src/store.ts:27-51`  
**Description:**  
`createLogTypeGuard` is a higher-order function that returns a type guard for a given `LogType`. It is used to produce seven named guards (`isFoodLog`, `isLiquidLog`, etc.). The factory saves roughly one line per guard but at the cost of a level of indirection. Readers must understand that each guard is the result of a closure call. The simpler pattern — just writing each guard as a direct function — is what "boring code" means.

Additionally, the factory returns `(log: NarrowableLog)` but the `NarrowableLog` union type on line 25 (`LogEntry | { type: string; data: unknown }`) repeats the shape of `LogEntry`, adding another type to track.

**Suggested Simplification:**  
Write the guards directly:

```ts
export function isFoodLog(
  log: NarrowableLog,
): log is LogEntry & { type: "food"; data: LogDataMap["food"] } {
  return log.type === "food";
}
```

Seven direct functions are more scannable and require no factory abstraction. The `NarrowableLog` type alias can be inlined or eliminated if all callers already pass `LogEntry`.

---

### [MODERATE] `habitAggregates.ts` — `timestampToDateString` is a trivial wrapper

**Category:** Redundancy  
**Files:** `src/lib/habitAggregates.ts:52-54`  
**Description:**  
`timestampToDateString(timestamp: number): string` on line 52 is a private helper that simply delegates to `formatLocalDateKey(timestamp)`. It exists solely as an alias. There are two call sites in the same file (lines 107 and 112 via `log.at`), both of which could call `formatLocalDateKey` directly.

**Suggested Simplification:**  
Remove `timestampToDateString` and call `formatLocalDateKey` directly at the two call sites. `formatLocalDateKey` is already imported at line 1.

---

### [MODERATE] `habitCoaching.ts` — `activeHabits` alias adds no information

**Category:** Redundancy  
**Files:** `src/lib/habitCoaching.ts:106, 354, 439`  
**Description:**  
In `getHeuristicCoachingMessage`, `heuristicSuggestions`, and `generateSettingsSuggestions`, the first thing the function does is assign `const activeHabits = context.habits` or `const activeHabits = habits`. The alias is never filtered or transformed — it is just the parameter re-assigned to a new name. This adds cognitive overhead with no benefit.

**Suggested Simplification:**  
Remove the `activeHabits` alias and use `context.habits` / `habits` directly throughout each function. The variable name `habits` is already clear.

---

### [MODERATE] `customFoodPresets.ts` — normalisation logic duplicated between `loadCustomFoodPresets` and `saveCustomFoodPresets`

**Category:** DRY  
**Files:** `src/lib/customFoodPresets.ts:40-82`  
**Description:**  
Both `loadCustomFoodPresets` (lines 40-61) and `saveCustomFoodPresets` (lines 63-82) contain identical normalisation logic for each preset:

```ts
.map((preset) => ({
  id: preset.id,
  name: preset.name.trim().slice(0, 80),
  ingredients: preset.ingredients
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20),
}))
.slice(0, 12)
```

The same shape, same limits (80, 20, 12), same operations appear twice. If the 80-character limit changes, it must be changed in two places.

**Suggested Simplification:**  
Extract a private `normalizePreset` function and a `MAX_PRESETS` constant, and call it from both functions:

```ts
const MAX_NAME_LENGTH = 80;
const MAX_INGREDIENTS = 20;
const MAX_PRESETS = 12;

function normalizePreset(preset: CustomFoodPreset): CustomFoodPreset {
  return {
    id: preset.id,
    name: preset.name.trim().slice(0, MAX_NAME_LENGTH),
    ingredients: preset.ingredients
      .map((i) => i.trim())
      .filter(Boolean)
      .slice(0, MAX_INGREDIENTS),
  };
}
```

---

### [MODERATE] `foodParsing.ts` — `FOOD_PARSE_MODEL` alias is unnecessary

**Category:** Redundancy  
**Files:** `src/lib/foodParsing.ts:100`  
**Description:**  
Line 100: `const FOOD_PARSE_MODEL = BACKGROUND_MODEL;` creates a module-local alias for the imported `BACKGROUND_MODEL` constant. It is used once (line 427) and the alias adds no clarity — `BACKGROUND_MODEL` is already named clearly and its JSDoc says exactly what it is used for.

**Suggested Simplification:**  
Remove `FOOD_PARSE_MODEL` and use `BACKGROUND_MODEL` directly in the `callAi` invocation. This eliminates a layer of indirection with no downside.

---

### [MODERATE] `syncAi.ts` — `aiPayloadSanitizeOptions` const created inside a hook body on every call

**Category:** Over-Engineering  
**Files:** `src/lib/syncAi.ts:34-36`  
**Description:**  
Inside `useAddAiAnalysis`, the `aiPayloadSanitizeOptions` object is defined with `as const` on lines 34-36:

```ts
const aiPayloadSanitizeOptions = {
  maxStringLength: INPUT_SAFETY_LIMITS.aiPayloadString,
} as const;
```

This object is created anew on every render (it is inside the hook body, not at module scope). `INPUT_SAFETY_LIMITS.aiPayloadString` is a compile-time constant. Moving this to module scope eliminates the repeated object allocation and makes the constant's scope explicit.

**Suggested Simplification:**  
Move the options object to module scope:

```ts
const AI_PAYLOAD_SANITIZE_OPTIONS = {
  maxStringLength: INPUT_SAFETY_LIMITS.aiPayloadString,
} as const;
```

---

### [MODERATE] `analysis.ts` — `bristolToConsistency` could use a switch statement instead of chained ifs

**Category:** Boring Code  
**Files:** `src/lib/analysis.ts:206-215`  
**Description:**  
`bristolToConsistency` uses a guard clause followed by four `if` statements over integer values 1-7. The CLAUDE.md project standard prefers `switch` for multiple discrete conditions. The current form requires readers to mentally trace the fall-through logic. A switch would make all branches immediately visible.

**Suggested Simplification:**

```ts
export function bristolToConsistency(code: number): DigestiveCategory {
  if (!Number.isInteger(code) || code < 1 || code > 7) {
    throw new Error(`Invalid Bristol code: ${code}. Must be 1-7.`);
  }
  switch (code) {
    case 1:
      return "constipated";
    case 2:
      return "hard";
    case 6:
      return "loose";
    case 7:
      return "diarrhea";
    default:
      return "firm"; // 3, 4, 5
  }
}
```

---

### [MODERATE] `habitProgress.ts` — `getProgressText` uses nested ternaries for unit abbreviation

**Category:** Boring Code  
**Files:** `src/lib/habitProgress.ts:73-79`  
**Description:**  
Lines 73-79 contain a nested ternary to compute `displayUnit`:

```ts
const displayUnit =
  mode === "tile"
    ? habit.unit === "minutes"
      ? "min"
      : habit.unit === "hours"
        ? "hrs"
        : habit.unit
    : habit.unit;
```

This is exactly the pattern the project's CLAUDE.md says to avoid ("Avoid nested ternary operators — prefer switch statements or if/else chains"). There is a clear outer condition (mode) and then inner conditions (unit).

**Suggested Simplification:**

```ts
let displayUnit = habit.unit;
if (mode === "tile") {
  if (habit.unit === "minutes") displayUnit = "min";
  else if (habit.unit === "hours") displayUnit = "hrs";
}
```

Or alternatively, a helper:

```ts
function tileUnitLabel(unit: HabitUnit): string {
  if (unit === "minutes") return "min";
  if (unit === "hours") return "hrs";
  return unit;
}
// ...
const displayUnit = mode === "tile" ? tileUnitLabel(habit.unit) : habit.unit;
```

---

### [MODERATE] `habitIcons.tsx` — name-based fallback uses two separate `if` blocks for the same icon result

**Category:** DRY  
**Files:** `src/lib/habitIcons.tsx:112-117`  
**Description:**  
Lines 112-117 check `nameLower.includes("stretch")` and `nameLower.includes("breath")` in separate if-blocks, both returning the exact same value `{ Icon: HeartPlus, toneClassName: "text-teal-400" }`. This is a minor DRY violation.

**Suggested Simplification:**  
Combine the two checks:

```ts
if (nameLower.includes("stretch") || nameLower.includes("breath")) {
  return { Icon: HeartPlus, toneClassName: "text-teal-400" };
}
```

---

### [NICE-TO-HAVE] `aiModels.ts` — `LEGACY_INSIGHT_MODEL_ALIASES` is an empty object

**Category:** Over-Engineering  
**Files:** `src/lib/aiModels.ts:26`  
**Description:**  
`LEGACY_INSIGHT_MODEL_ALIASES` is defined as `Readonly<Record<string, InsightModel>>` but is an empty object literal `{}`. It is consulted in `getValidInsightModel` (line 37), but since it is empty, the lookup always falls through to `DEFAULT_INSIGHT_MODEL`. This is placeholder infrastructure for migration aliases that have never been added.

**Suggested Simplification:**  
Either add actual aliases if they are needed, or remove the constant and simplify `getValidInsightModel`:

```ts
export function getValidInsightModel(model: unknown): InsightModel {
  if (isInsightModel(model)) return model;
  return DEFAULT_INSIGHT_MODEL;
}
```

When real aliases are needed, add the lookup back at that point.

---

### [NICE-TO-HAVE] `vite.config.ts` — destructured empty parameter `({})` in `defineConfig`

**Category:** Boring Code  
**Files:** `vite.config.ts:7`  
**Description:**  
`defineConfig(({}) => { ... })` destructures an empty object from the Vite environment parameter. Nothing from `env` (the `mode`, `command`, etc.) is used. The destructuring pattern `({})` is unusual and requires a reader to look twice.

**Suggested Simplification:**  
Use `defineConfig(() => { ... })` — no destructuring needed since nothing from the environment is used. This is simpler and more honest.

---

### [NICE-TO-HAVE] `baselineAverages.ts` — `for…of` on Map entries uses `[, val]` skip pattern

**Category:** Boring Code  
**Files:** `src/lib/baselineAverages.ts:147`  
**Description:**  
Line 147: `for (const [, val] of dayTotals)` uses a destructuring skip for the unused key. This is idiomatic but subtly harder to read. The loop is only summing values.

**Suggested Simplification:**  
Use `dayTotals.values()` directly:

```ts
for (const val of dayTotals.values()) {
  if (val >= habit.dailyTarget) metDays++;
}
```

This makes the intent clearer: only values are needed.

---

### [NICE-TO-HAVE] `sync.ts` (barrel) — comment block "All existing imports continue to work unchanged" is redundant

**Category:** Redundancy  
**Files:** `src/lib/sync.ts:1-11`  
**Description:**  
The barrel re-export file has a comment block explaining that it was decomposed into sub-modules, and that all imports still work. This is true of any barrel file and does not add useful information. The sub-module names and their responsibilities are better expressed by the sub-module file names themselves.

**Suggested Simplification:**  
Keep the section comments (e.g. `// Core types and pure functions`) that group the exports, but remove the explanatory paragraph that states obvious re-export facts.

---

### [NICE-TO-HAVE] `normalizeFluidName.ts` — the comment references `Track.tsx` but the function is used more broadly

**Category:** Redundancy  
**Files:** `src/lib/normalizeFluidName.ts:3`  
**Description:**  
The file-level comment says "Used by Track.tsx for fluid totals display." In reality, `normalizeFluidItemName` is also used by `baselineAverages.ts`, `derivedHabitLogs.ts`, and `habitCoaching.ts`. The comment is stale and misleading.

**Suggested Simplification:**  
Update or remove the restrictive comment. A simpler one-liner like `/** Normalize a fluid item name for consistent comparison. */` is accurate and sufficient.

---

### [NICE-TO-HAVE] `sounds.ts` — musical note constants could be grouped into an object

**Category:** Boring Code  
**Files:** `src/lib/sounds.ts:14-20`  
**Description:**  
Seven top-level constants (`C5`, `E5`, `G5`, `C6`, `E6`, `G6`, `B4`) are exported from module scope. They pollute the module's namespace and their relationship (they are musical note frequencies used by `playSound`) is only implied by proximity.

**Suggested Simplification:**  
Group them into a module-scoped constant object. This is not a significant issue but would make the grouping explicit and the constants non-exportable (they have no external consumers):

```ts
const NOTE = {
  C5: 523.25,
  E5: 659.25,
  G5: 783.99,
  C6: 1046.5,
  E6: 1318.5,
  G6: 1567.98,
  B4: 987.77,
} as const;
```

---

### [NICE-TO-HAVE] `archive.tsx` — `reduce` used where `flatMap` + `filter` would be clearer

**Category:** Boring Code  
**Files:** `src/pages/secondary_pages/Archive.tsx:32-43`  
**Description:**  
The `allReports` memo uses `.reduce<ArchiveReport[]>` to build a list, pushing items conditionally inside the reducer. This is the "reduce as a generic loop" pattern that the project's "boring code" philosophy discourages.

**Suggested Simplification:**

```ts
const allReports = useMemo(() => {
  if (!history) return [] as ArchiveReport[];
  return history
    .filter((r) => !r.error && r.insight !== null)
    .flatMap((r) => {
      const insight = parseAiInsight(r.insight);
      if (!insight) return [];
      return [
        {
          id: String(r.id),
          timestamp: r.timestamp,
          insight,
          starred: r.starred,
        },
      ];
    });
}, [history]);
```

`flatMap` with `[]` as the empty case is idiomatic for conditional mapping and reads more directly.

---

### [NICE-TO-HAVE] `foodParsing.ts` — `rawItems.forEach` then `for...of` inconsistency

**Category:** Boring Code  
**Files:** `src/lib/foodParsing.ts:402-414`  
**Description:**  
Lines 402-409 use `rawItems.forEach((item, index) => { ... })` for the deterministic-parsing pass, while lines 415-453 use `for...of` for the unresolved-items pass. The project's "boring code" standard and the CLAUDE.md preference for `function` keyword and explicit code would suggest using consistent iteration. `forEach` with `return` (line 407) as a continue-equivalent is non-obvious to readers.

**Suggested Simplification:**  
Replace the `forEach` with a `for...of` loop using index from `entries()`:

```ts
for (const [index, item] of rawItems.entries()) {
  const parsed = buildDeterministicItem(item, existingNameMap);
  if (parsed) {
    parsedGroups.set(index, [parsed]);
    continue;
  }
  unresolvedItems.push({ index, text: item });
}
```

This makes the `continue` explicit and consistent with the loop below it.

---

### [NICE-TO-HAVE] `habitCoaching.ts` — `average` helper function is defined locally but is general-purpose

**Category:** Over-Engineering  
**Files:** `src/lib/habitCoaching.ts:320-323`  
**Description:**  
A private `average(values: number[]): number` helper is defined locally in `habitCoaching.ts`. This is a simple utility (`values.reduce((sum, v) => sum + v, 0) / values.length`). Its presence in a domain-specific coaching file means it is invisible to other modules that might also compute averages. This is not a significant issue but is worth noting as a candidate for `src/lib/utils.ts` if a second callsite emerges.

**Suggested Simplification:**  
Keep as-is for now, but note: if `average` is needed elsewhere, move it to `utils.ts` at that time.

---

### [NICE-TO-HAVE] `habitTemplates.ts` — `normalizeHabitTypeValue` parameter object has 7 fields but could accept the raw object directly

**Category:** Over-Engineering  
**Files:** `src/lib/habitTemplates.ts:88-135`  
**Description:**  
`normalizeHabitTypeValue` accepts an object with seven `rawX` fields (`rawType`, `rawName`, `rawKind`, etc.) to avoid directly typing the raw persisted data. It is called exclusively by `coerceHabitType` on line 510-518, which unpacks all fields from `habit: Record<string, unknown>`. This indirection — wrapping and immediately unwrapping — adds a layer of complexity with no type safety benefit, since all fields are `unknown` on both sides.

**Suggested Simplification:**  
Merge `normalizeHabitTypeValue` into `coerceHabitType` and accept `Record<string, unknown>` directly. The internal logic does not change; the wrapper object is eliminated. This is a larger refactor and should only be done when touching this area.

---
