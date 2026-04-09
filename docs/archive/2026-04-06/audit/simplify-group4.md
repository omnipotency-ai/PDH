# Simplification Audit — Group 4

**Date:** 2026-04-06
**Auditor:** Claude Code (Sonnet 4.6)
**Scope:** src/components/track/ (dr-poo, nutrition, panels, quick-capture, today-log) + src/components/ui/ (selected files)

---

## Summary

The codebase is overall well-structured and disciplined. Most complexity exists for legitimate reasons (animation, a11y, Convex-driven data flow). The findings below are genuine simplification opportunities — duplicated constants, unnecessary wrapper divs, redundant state, and a few patterns that add noise without adding clarity.

---

## Findings

### [CRITICAL] DRY violation: Tile tint constants duplicated verbatim

**Category:** DRY
**Files:** `src/components/track/quick-capture/constants.ts:L1-L26`, `src/components/track/quick-capture/DurationEntryPopover.tsx:L27-L48`

**Description:**
`TINT_BY_PROGRESS_COLOR` and `TINT_CLASSES` are defined identically in two files. `constants.ts` exports both. `DurationEntryPopover.tsx` re-declares them locally as `type TileColorTint`, `TINT_BY_PROGRESS_COLOR`, and `TINT_CLASSES` — the exact same record structures with the exact same values. This is a pure copy-paste duplication: if the tint colors or progress color mapping ever change, there are two places to update and they will silently diverge.

**Suggested Simplification:**
Delete the local declarations in `DurationEntryPopover.tsx` and import `TINT_BY_PROGRESS_COLOR`, `TINT_CLASSES`, and `TileColorTint` from `./constants`.

---

### [HIGH] Redundant `formatDuration` function duplicated between helpers and ActivityGroupRow

**Category:** DRY
**Files:** `src/components/track/today-log/helpers.ts:L300-L307`, `src/components/track/today-log/groups/ActivityGroupRow.tsx:L33-L39`

**Description:**
`helpers.ts` exports `formatDuration(minutes, type)` which handles sleep (h/m breakdown) and all other activity types. `ActivityGroupRow.tsx` defines a local `formatTotalDuration(minutes)` that implements the same h/m breakdown logic independently, with slightly different thresholds. There is no reason for two functions — `formatTotalDuration` is used only in `ActivityGroupRow` for total duration display and could be replaced by the shared `formatDuration` with `"activity"` or similar type.

The implementations differ slightly: `formatDuration` returns `"0"` for zero, while `formatTotalDuration` also returns `"0"` for `<= 0`. They are close enough that the local function is unnecessary noise.

**Suggested Simplification:**
Remove `formatTotalDuration` from `ActivityGroupRow.tsx`. Import and reuse `formatDuration` from `../helpers`, passing the `latestType` as the type argument. Since total duration across a mixed activity group is always "activity" (not sleep), the existing function handles this correctly.

---

### [HIGH] `WaterModal` has two separate state variables (`amount` and `inputValue`) for a single value

**Category:** Over-Engineering
**Files:** `src/components/track/nutrition/WaterModal.tsx:L60-L103`

**Description:**
The modal maintains `amount` (number) and `inputValue` (string) as separate but always-synchronized pieces of state. `updateAmount` keeps them in sync; `handleDecrement` and `handleIncrement` each call `setInputValue(String(next))` inline rather than using `updateAmount`. The pattern exists to allow typed mid-edit values (e.g., typing "1" before "50"), but the input is a simple numeric field — there is no ambiguity requiring a separate draft string. The synchronization adds noise: `handleDecrement` and `handleIncrement` each manually call both `setAmount` and `setInputValue` inside the setter function, instead of using the shared `updateAmount` helper they already have.

**Suggested Simplification:**
Have `handleDecrement` and `handleIncrement` call `updateAmount(prev ± STEP_ML)` instead of embedding dual state updates inside `setAmount`'s callback. This makes all three mutation paths (`+`, `-`, type) consistent and removes the need for callers to think about whether to also call `setInputValue`.

---

### [HIGH] `CalorieDetailView` outer wrapper div is a no-op container

**Category:** Over-Engineering
**Files:** `src/components/track/nutrition/CalorieDetailView.tsx:L341-L382`

**Description:**
The component's render wraps everything in `<div data-slot="calorie-detail-view">` and then immediately wraps the content again in `<div data-slot="calorie-detail" className="space-y-4">`. The outer div has no className, no style, no purpose — it is a ghost wrapper around a wrapper. The `data-slot` attribute on the outer div could simply move to the inner div.

**Suggested Simplification:**
Remove the outer `<div data-slot="calorie-detail-view">` and move its `data-slot` attribute to the inner `<div data-slot="calorie-detail" className="space-y-4">`, making it `<div data-slot="calorie-detail-view" className="space-y-4">`.

---

### [HIGH] `FoodFilterView` computes the frequency map twice

**Category:** DRY
**Files:** `src/components/track/nutrition/FoodFilterView.tsx:L95-L135`

**Description:**
`frequentFoods` (lines 95–115) iterates over all logs to build a frequency map, sorts it, and produces the ordered list of canonical names. `frequencyCountMap` (lines 118–135) immediately iterates over all logs again to build an identical frequency map — same loop body, same accumulator pattern — just to preserve the count values for display labels on the Frequent tab. The sorted list and the count map are derived from the same data in two separate passes.

**Suggested Simplification:**
Build the frequency map once. From that single map, derive both `frequentFoods` (sorted, filtered, sliced) and `frequencyCountMap`. Something like:

```ts
const { frequentFoods, frequencyCountMap } = useMemo(() => {
  const countMap = new Map<string, number>();
  for (const log of logs) { ... }
  const sorted = [...countMap.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  return { frequentFoods: filterToKnownFoods(sorted).slice(0, MAX_ITEMS_PER_TAB), frequencyCountMap: countMap };
}, [logs]);
```

---

### [MODERATE] `ConversationPanel` spreads optional props defensively but unnecessarily

**Category:** Boring Code
**Files:** `src/components/track/dr-poo/ConversationPanel.tsx:L192-L196`

**Description:**
The component passes `onSendNow` and `replyInputRef` to `<ReplyInput>` using conditional spreads:

```tsx
{...(onSendNow !== undefined && { onSendNow })}
{...(replyInputRef !== undefined && { inputRef: replyInputRef })}
```

This is the `exactOptionalPropertyTypes` safe pattern described in `CLAUDE.md`, so it is technically correct. However, `ReplyInput` accepts both props as optional (`onSendNow?: ...`, `inputRef?: ...`). The conditional spread pattern is necessary when the receiving component uses `exactOptionalPropertyTypes` itself, but the result here is a spread that is harder to read than simply passing the props directly as `onSendNow={onSendNow}`. Check if `exactOptionalPropertyTypes` is actually enforced; if not, direct optional prop passing is simpler.

**Suggested Simplification:**
Verify the tsconfig. If `exactOptionalPropertyTypes` is not enabled globally, pass the props directly: `<ReplyInput onSendNow={onSendNow} inputRef={replyInputRef} />`. If it is enabled, document why this pattern is required here with a one-line comment so future readers understand the idiom.

---

### [MODERATE] `STABLE_END` constant defined inside the component body

**Category:** Boring Code
**Files:** `src/components/track/dr-poo/ConversationPanel.tsx:L28`

**Description:**
`const STABLE_END = 9_999_999_999_999` is defined inside `ConversationPanel` with a comment explaining it. It is a true constant — it never changes and has nothing to do with props or state. Placing it inside the component body means it is re-evaluated on every render (though engines optimize this). More importantly, it makes the component body harder to scan because it reads like a stateful value when it is just a sentinel.

**Suggested Simplification:**
Move `STABLE_END` to module scope, alongside `COLLAPSED_MESSAGE_STYLE`. This is consistent with the existing pattern in the file.

---

### [MODERATE] `BOWEL_LOG_LABELS` is derived at module load from the option arrays it mirrors

**Category:** Over-Engineering
**Files:** `src/components/track/panels/bowelConstants.ts:L121-L133`

**Description:**
`BOWEL_LOG_LABELS` is built at module load time by calling `Object.fromEntries(array.map(...))` on `URGENCY`, `EFFORT`, and `VOLUME` — the same arrays that are also exported directly. Any code that needs the label for a value can already do `URGENCY.find(o => o.value === x)?.label` using the source arrays. The derived object adds indirection and requires TypeScript casting to assert the Record type. If a value is added to `URGENCY` but not matched in `BOWEL_LOG_LABELS`, the mismatch is invisible because the cast hides it.

**Suggested Simplification:**
Either: (a) delete `BOWEL_LOG_LABELS` and have callers use `URGENCY.find(o => o.value === tag)?.label ?? tag`, or (b) if the lookup object is genuinely useful for performance at scale, define it as a plain object literal with explicit keys so additions are caught by TypeScript's exhaustiveness checking.

---

### [MODERATE] `LogEntry.tsx` calls `getHabitIcon` twice for the same `habitConfig`

**Category:** DRY
**Files:** `src/components/track/today-log/rows/LogEntry.tsx:L53-L59`

**Description:**
When resolving the icon and color for a habit log, the code calls `getHabitIcon(habitConfig)` twice — once to get `.Icon` and once to get `.toneClassName`:

```ts
Icon: getHabitIcon(habitConfig).Icon,
color: getHabitIcon(habitConfig).toneClassName,
```

This is two calls to the same function with the same argument. Even if the function is pure and cheap, it reads as if the two properties come from different sources.

**Suggested Simplification:**
Destructure once:

```ts
const { Icon: habitIcon, toneClassName } = getHabitIcon(habitConfig);
const { Icon, color } = habitConfig
  ? { Icon: habitIcon, color: toneClassName }
  : { Icon: getLogIcon(log), color: getLogColor(log) };
```

Or more directly:

```ts
const iconResult = habitConfig ? getHabitIcon(habitConfig) : null;
const Icon = iconResult?.Icon ?? getLogIcon(log);
const color = iconResult?.toneClassName ?? getLogColor(log);
```

---

### [MODERATE] `EditableEntryRow` has a dead `"stacked-2"` layout variant with a TODO note

**Category:** Over-Engineering
**Files:** `src/components/track/today-log/editors/EditableEntryRow.tsx:L55-L59`, `L201-L215`

**Description:**
The `editLayout` prop accepts `"inline" | "stacked" | "stacked-2"`. The JSDoc comment for `"stacked-2"` says:

> `TODO: audit current callers and remove if unused.`

A search across all the sub-row files (`FoodSubRow`, `FluidSubRow`, `ActivitySubRow`, `HabitSubRow`, `WeightSubRow`) shows none of them pass `editLayout="stacked-2"`. The layout exists solely as a defined code path that nothing reaches. Keeping it means future readers must understand three layout modes, one of which is dead.

**Suggested Simplification:**
Remove the `"stacked-2"` layout variant: delete its branch in the if/else chain, remove it from the union type, and remove its JSDoc entry. If it is ever needed again it is easy to add back.

---

### [MODERATE] `HabitSubRow` `buildSaveData` callback does nothing but copy data

**Category:** Over-Engineering
**Files:** `src/components/track/today-log/editors/HabitSubRow.tsx:L8`

**Description:**

```ts
const buildSaveData = useCallback(
  (): LogUpdateData => ({ ...entry.data }),
  [entry.data],
);
```

The callback merely spreads `entry.data` into a new object. The `useCallback` wrapper itself is unnecessary here — this is a trivially cheap function. The real observation is that `HabitSubRow` shows a timestamp-only display with no editable fields other than the date/time (which `EditableEntryRow` handles automatically). The `buildSaveData` function communicates "the habit log data is unchanged" but the component is still wired up as if it edits something.

This is a minor observation — the pattern is correct and the overhead is negligible. The only simplification would be to omit the `useCallback` since `entry.data` as a dependency already means this re-creates on any data change anyway.

**Suggested Simplification:**
Remove the `useCallback` wrapper and inline it:

```ts
function buildSaveData(): LogUpdateData {
  return { ...entry.data };
}
```

This makes it explicit that it is a plain function, not a performance-sensitive memoized callback.

---

### [MODERATE] `WeightSubRow` `buildSaveData` uses a nested ternary for unit conversion

**Category:** Boring Code
**Files:** `src/components/track/today-log/editors/WeightSubRow.tsx:L29-L37`

**Description:**
The weight conversion inside `buildSaveData` uses a nested ternary:

```ts
const weightKg = ...
  ? weightUnit === "lbs"
    ? Math.round(lbsToKg(rawVal) * 10) / 10
    : weightUnit === "stones"
      ? Math.round(stonesToKg(rawVal) * 10) / 10
      : rawVal
  : entry.data.weightKg;
```

The outer ternary for validity check, then two nested ternaries for unit conversion. The project's CLAUDE.md explicitly says: "Avoid nested ternary operators — prefer switch statements or if/else chains for multiple conditions."

**Suggested Simplification:**
Extract a small helper or use an if/else chain:

```ts
function toKg(rawVal: number, weightUnit: string): number {
  if (weightUnit === "lbs") return Math.round(lbsToKg(rawVal) * 10) / 10;
  if (weightUnit === "stones") return Math.round(stonesToKg(rawVal) * 10) / 10;
  return rawVal;
}
```

Then in `buildSaveData`:

```ts
const weightKg =
  Number.isFinite(rawVal) && rawVal > 0
    ? toKg(rawVal, weightUnit)
    : entry.data.weightKg;
```

---

### [MODERATE] `WeightGroupRow` `displayWeight` uses nested ternaries

**Category:** Boring Code
**Files:** `src/components/track/today-log/groups/WeightGroupRow.tsx:L25-L31`

**Description:**
Same pattern as `WeightSubRow.buildSaveData` — a nested ternary for unit-specific weight formatting:

```ts
const displayWeight =
  Number.isFinite(kg) && kg > 0
    ? weightUnit === "lbs"
      ? `${kgToLbs(kg).toFixed(1)} lbs`
      : weightUnit === "stones"
        ? `${kgToStones(kg).toFixed(1)} st`
        : `${kg.toFixed(1)} kg`
    : null;
```

The project CLAUDE.md flags nested ternaries as a violation. Separately, this logic is also very similar to the `displayVal` calculation in `WeightSubRow.tsx` (lines 68–75) — both perform the same three-way unit conversion on a kg value. The project already has `formatWeight(kg, displayWeightUnit)` available in `@/lib/formatWeight` (used in `WeightEntryDrawer`), which handles exactly this.

**Suggested Simplification:**
Use the existing `formatWeight(kg, weightUnit)` function from `@/lib/formatWeight` instead of the inline nested ternary. This also removes the duplication with `WeightSubRow.tsx`'s `displayVal`.

---

### [MODERATE] `FluidGroupRow` builds tooltip content string twice

**Category:** DRY
**Files:** `src/components/track/today-log/groups/FluidGroupRow.tsx:L40-L58`

**Description:**
The collapsed preview shows the latest fluid entry's data as a truncated string inside a `<Tooltip>`. The `TooltipTrigger` content is `truncatePreviewText(...)` of the summary string. The `TooltipContent` is the full summary string. Both are built from the same three interpolated values (`format(latest.timestamp, "HH:mm")`, `latestName`, qty/unit). The full string is constructed twice — once inline for the trigger and once inline for the content — instead of being derived once to a variable.

**Suggested Simplification:**
Derive the summary string once:

```ts
const latestSummary =
  `${format(latest.timestamp, "HH:mm")}  ${latestName}  ${Number.isFinite(latestQty) && latestQty > 0 ? `${latestQty}${latestUnit}` : ""}`.trim();
```

Then use `truncatePreviewText(latestSummary)` for the trigger and `latestSummary` for the tooltip content.

Note: `FluidSubRow.tsx` already does this correctly (line 86: `const summaryText = ...`), so `FluidGroupRow` should follow the same pattern its sub-row already uses.

---

### [MODERATE] `FoodSection` saves unneeded state for the optimistic restore path

**Category:** Over-Engineering
**Files:** `src/components/track/panels/FoodSection.tsx:L44-L68`

**Description:**
`submitFood` captures `savedName`, `savedTimeValue`, `savedDateValue`, `savedActivePreset`, and `savedTimestampMs` before clearing the form — but `savedTimeValue`, `savedDateValue`, and `savedActivePreset` are only used if the save fails. On success these captured values are never read. The time values are especially questionable: restoring `savedTimeValue` and `savedDateValue` on error means the user gets their old time back, which is correct — but `setTimeValue` and `setDateValue` require `usePanelTime`'s setters to be exposed to `FoodSection`. This restoration is also only partial: `reset()` was already called before the error path, so the time state from `usePanelTime` is already reset and restoring via `setTimeValue` re-applies the old value to the post-reset state. This is a subtle correctness issue, not just a style one.

**Suggested Simplification:**
Restore only what the user typed — `foodName` and `activePreset`. The time picker state is a "nice to have" restore that complicates the code path and interacts awkwardly with `usePanelTime`. Drop the time restore on error; the user will lose their time selection on error (acceptable), and the code becomes straightforward:

```ts
onLogFood("", savedName, savedTimestampMs)
  .catch((err) => {
    setFoodName(savedName);
    setActivePreset(savedActivePreset);
    toast.error(getErrorMessage(err, "Failed to log food."));
  })
  .finally(() => setSaving(false));
```

---

### [NICE-TO-HAVE] `NutritionCardErrorBoundary` is a thin duplicate of `ErrorBoundary`

**Category:** DRY
**Files:** `src/components/track/nutrition/NutritionCardErrorBoundary.tsx:L1-L50`, `src/components/ui/ErrorBoundary.tsx:L1-L90`

**Description:**
`NutritionCardErrorBoundary` is a fully custom class component (50 lines) that implements the same pattern as the generic `ErrorBoundary` in `src/components/ui/ErrorBoundary.tsx`. The only differences are: (1) the error message text is nutrition-specific, (2) the button label says "Try again" instead of "Retry". `ErrorBoundary` already accepts a `fallback` render prop for custom fallback UI, which could produce the exact same output.

**Suggested Simplification:**
Delete `NutritionCardErrorBoundary` and replace its usage with:

```tsx
<ErrorBoundary
  label="Nutrition tracking"
  fallback={({ reset }) => (
    <div role="alert" data-slot="nutrition-card-error" className="glass-card space-y-3 p-4">
      <p style={{ color: "var(--text-muted)" }} className="text-sm">
        Nutrition tracking is temporarily unavailable.
      </p>
      <button type="button" onClick={reset} ...>Try again</button>
    </div>
  )}
>
```

---

### [NICE-TO-HAVE] `CircularProgressRing` has two separate `useEffect` calls that could be one

**Category:** Over-Engineering
**Files:** `src/components/track/nutrition/CircularProgressRing.tsx:L119-L125`

**Description:**
Two `useEffect` hooks each update one motion value when an offset changes:

```ts
useEffect(() => {
  motionPrimary.set(primaryOffset);
}, [primaryOffset, motionPrimary]);
useEffect(() => {
  motionSecondary.set(secondaryOffset);
}, [secondaryOffset, motionSecondary]);
```

These could be combined into a single effect:

```ts
useEffect(() => {
  motionPrimary.set(primaryOffset);
  motionSecondary.set(secondaryOffset);
}, [primaryOffset, secondaryOffset, motionPrimary, motionSecondary]);
```

The current split means React schedules two separate effect teardowns and re-runs when either value changes. Combining is both simpler and avoids a scenario where primary animates one frame before secondary starts.

**Suggested Simplification:**
Merge into one `useEffect`. This is a minor cleanup with a trivial correctness benefit.

---

### [NICE-TO-HAVE] `getShapeKey` in `BristolScale.tsx` has a dead `default` branch

**Category:** Boring Code
**Files:** `src/components/track/panels/BristolScale.tsx:L78-L93`

**Description:**
`getShapeKey` has a `default` branch that returns `shape-${index}`. Since `BristolShape` is a discriminated union of exactly `circle | ellipse | rect | line | path`, TypeScript narrows the type to `never` at the default. The function is only ever called on shapes from `BRISTOL_ILLUSTRATION_SHAPES`, which only contain those five types. The default branch is dead code. The same is true in `renderShape` (line 149) which returns `null` in its default branch.

**Suggested Simplification:**
Remove the `default` branches and add a TypeScript exhaustiveness assertion instead:

```ts
const _exhaustive: never = shape;
return `shape-${index}`;
```

Or simply remove the default and let TypeScript's control-flow analysis verify completeness.

---

### [NICE-TO-HAVE] `displayPadding` prop in `EditableEntryRow` uses a ternary chain instead of a lookup

**Category:** Boring Code
**Files:** `src/components/track/today-log/editors/EditableEntryRow.tsx:L235-L236`

**Description:**

```ts
const paddingClass =
  displayPadding === "spacious"
    ? "py-2"
    : displayPadding === "normal"
      ? "py-1.5"
      : "py-1";
```

This is a nested ternary for three values mapping to three strings. The CLAUDE.md standard is to avoid nested ternaries.

**Suggested Simplification:**
Use a simple lookup object:

```ts
const PADDING_CLASSES = {
  compact: "py-1",
  normal: "py-1.5",
  spacious: "py-2",
} as const;
const paddingClass = PADDING_CLASSES[displayPadding];
```

---

### [NICE-TO-HAVE] `TodayLog.tsx` title and day labels use inline ternary chains

**Category:** Boring Code
**Files:** `src/components/track/today-log/TodayLog.tsx:L114-L119`

**Description:**

```ts
const title =
  dayOffset === 0
    ? "Today's Log"
    : dayOffset === -1
      ? "Yesterday's Log"
      : "Daily Log";
const prevDayLabel =
  dayOffset === 0 ? "Yesterday" : format(addDays(selectedDate, -1), "EEEE");
```

`title` uses a nested ternary (three options). Per CLAUDE.md, this should be an if/else or switch. The `prevDayLabel` is a simple two-way ternary which is fine, but `title` and `nextDayLabel` (line 160, which has a two-way conditional inline in the JSX) could be clearer.

**Suggested Simplification:**

```ts
function getDayTitle(offset: number): string {
  if (offset === 0) return "Today's Log";
  if (offset === -1) return "Yesterday's Log";
  return "Daily Log";
}
const title = getDayTitle(dayOffset);
```

---

### [NICE-TO-HAVE] `FoodSection` loads custom food presets in a `useEffect` with no cleanup concern

**Category:** Over-Engineering
**Files:** `src/components/track/panels/FoodSection.tsx:L28-L30`

**Description:**

```ts
useEffect(() => {
  setCustomFoodPresets(loadCustomFoodPresets());
}, []);
```

`loadCustomFoodPresets` is a synchronous function that reads from `localStorage` (or similar). There is no async operation, no cleanup needed. Using `useEffect` for synchronous initialization that does not depend on the DOM is unnecessary — this could be the initial state value:

```ts
const [customFoodPresets, setCustomFoodPresets] = useState<CustomFoodPreset[]>(
  loadCustomFoodPresets,
);
```

Passing the function reference (not its result) to `useState` is the lazy initializer pattern and reads presets exactly once on mount without the `useEffect` ceremony.

**Suggested Simplification:**
Replace the `useEffect` + `useState("")` initialization with lazy `useState(loadCustomFoodPresets)`.

---

### [NICE-TO-HAVE] `BRISTOL_ACCENT` in `bowelConstants.ts` has duplicate entries for types 1/7 and 2/6

**Category:** DRY
**Files:** `src/components/track/panels/bowelConstants.ts:L5-L41`

**Description:**
Bristol types 1 and 7 share identical `hex`, `border`, and `glow` values (both red). Types 2 and 6 share identical values (both orange). The data is correct (the Bristol scale is symmetric in severity) but the duplication means a color change requires updating four entries instead of two. If this were a color token they would already share a single source.

**Suggested Simplification:**
Extract the shared color objects:

```ts
const ACCENT_RED = {
  hex: "#f87171",
  border: "rgba(248, 113, 113, 0.35)",
  glow: "...",
};
const ACCENT_ORANGE = {
  hex: "#fb923c",
  border: "rgba(251, 146, 60, 0.35)",
  glow: "...",
};
```

Then reference them:

```ts
export const BRISTOL_ACCENT = { 1: ACCENT_RED, 7: ACCENT_RED, 2: ACCENT_ORANGE, 6: ACCENT_ORANGE, ... };
```

---
