# Maintainability & Code Quality Audit — Group 4

**Date:** 2026-04-06
**Auditor:** Claude Sonnet 4.6
**Scope:** Track page components — dr-poo, nutrition, panels, quick-capture, today-log, ui primitives

---

## Summary

| Severity     | Count |
| ------------ | ----- |
| CRITICAL     | 1     |
| HIGH         | 5     |
| MODERATE     | 11    |
| NICE-TO-HAVE | 8     |

The nutrition subsystem is in genuinely good shape — the reducer is pure, the test suite is thorough, and type discipline is strong. The main concerns are a trio of duplicated tile-color constants across three files (a real maintenance trap), a pair of type-safety holes in the today-log helpers, a misleading delete action in `CalorieDetailView`, and scattered magic numbers that belong in named constants.

---

## Findings

---

### [CRITICAL] Tile color constants triplicated across three files

**Category:** Maintainability
**Files:**

- `src/components/track/quick-capture/constants.ts:1–26`
- `src/components/track/quick-capture/QuickCaptureTile.tsx:16–37`
- `src/components/track/quick-capture/DurationEntryPopover.tsx:27–48`

**Description:**
`TINT_BY_PROGRESS_COLOR` and `TINT_CLASSES` are copy-pasted verbatim into all three files. A `constants.ts` file was created specifically to house these values — and then the exact same definitions were left in-place inside both `QuickCaptureTile.tsx` and `DurationEntryPopover.tsx`. The `constants.ts` export is never imported by either component. This means:

1. There are three independent sources of truth for what "emerald" or "red" tint means on a tile.
2. A designer or developer changing a color must find and update all three files — with no type error if they miss one.
3. `constants.ts` exports dead code (no consumer currently imports from it).

This is rated CRITICAL because it is the exact scenario the CLAUDE.md "Leave it Better" rule warns against: local inconsistency that deepens over time. A change to the red tint RGBA value in one file will silently diverge from the other two.

**Suggested Fix:**
Remove the local definitions from `QuickCaptureTile.tsx` (L16–37) and `DurationEntryPopover.tsx` (L27–48), and import from `constants.ts` instead:

```typescript
// In both component files, replace local definitions with:
import { TINT_BY_PROGRESS_COLOR, TINT_CLASSES } from "./constants";
```

The `TileColorTint` type should also be exported from `constants.ts` so both components use the canonical type.

---

### [HIGH] `onDeleteLog` in `CalorieDetailView` deletes the whole log, not just one item

**Category:** Code Quality / Maintainability
**Files:**

- `src/components/track/nutrition/CalorieDetailView.tsx:303`
- `src/components/track/nutrition/CalorieDetailView.tsx:276`

**Description:**
Inside `MealSlotAccordion`, each food item row renders a delete button. The `onClick` handler is:

```typescript
onClick={() => onDeleteLog(log.id)}
```

The delete fires `log.id` — the ID of the _entire log entry_ (which may contain multiple `items`). The button is rendered once per `item` in a `flatMap` over `getFoodItems(log)`, but each item's button deletes the whole parent log regardless of which item was clicked.

This is misleading in two ways:

1. The `aria-label` says `Delete ${displayName}` (the individual item name), implying item-level deletion.
2. A log with 3 items will have 3 delete buttons that all delete the same record — all of them will appear to work for the first click, then produce "not found" errors for the subsequent two.

For logs that were created through the staging flow (one log = one food item), this is fine in practice. But for raw-input logs parsed by the LLM (one log = many items), this is a silent data loss risk: the user clicks "delete egg" and loses the entire "egg, toast, and butter" log.

**Suggested Fix:**
Either:

- Make the item-level delete explicit and document the limitation: if a log only ever has one item (post-staging), state this as an invariant with a defensive assertion.
- Or surface an item-level delete mutation in the Convex schema and pass a true `(logId, itemIndex)` callback.

At minimum, add a code comment at the call site explaining the current constraint to prevent future confusion:

```typescript
// Deletes the entire log entry (not just this item).
// This is safe only when staging logs always contain exactly one item.
onClick={() => onDeleteLog(log.id)}
```

---

### [HIGH] Broad `as unknown as FoodLog` cast in `grouping.ts` hides type contract

**Category:** Code Quality
**Files:**

- `src/components/track/today-log/grouping.ts:56`

**Description:**

```typescript
foodEntries.push(log as unknown as FoodLog);
```

This cast forces a `type === "liquid"` log into the `FoodLog[]` array. The comment says "Liquid logs use FoodLogData shape" — but this is exactly the kind of claim the CLAUDE.md rule "Code as Evidence, Not Truth" warns against. The actual shape of liquid logs is not validated here; the cast suppresses the type system entirely. If the liquid log shape ever diverges from `FoodLog` (e.g. a new field added to one but not the other), this cast will silently produce garbage downstream with no compile-time warning.

**Suggested Fix:**
Define a shared base type or a discriminated union that captures what food and liquid logs have in common. If `FoodLog` and liquid logs truly share the same `data` shape, express that in the domain types (e.g. a `FoodPipelineLog = FoodLog | LiquidLog` union). Use `isFoodPipelineType` which already exists in `@shared/logTypeUtils` to narrow the type safely rather than casting.

---

### [HIGH] Duplicated frequency-map computation in `FoodFilterView`

**Category:** Maintainability
**Files:**

- `src/components/track/nutrition/FoodFilterView.tsx:95–115`
- `src/components/track/nutrition/FoodFilterView.tsx:118–135`

**Description:**
The component computes two separate `useMemo` blocks that both iterate the full `logs` array and build a frequency map of `canonicalName` occurrences. `frequentFoods` (L95) builds a map to produce a sorted, filtered list. `frequencyCountMap` (L118) builds the exact same map structure again — the comment even acknowledges it is "only used by Frequent tab".

This means on every render where `logs` changes, the same O(n × m) loop runs twice. For a 14-day log window this is a real waste. More importantly, if the frequency-counting logic ever needs to change (e.g. count by meal slot, or exclude certain log types), it must be updated in two places.

**Suggested Fix:**
Compute one `frequencyMap` and derive both the sorted list and the count map from it in a single memo:

```typescript
const { frequentFoods, frequencyCountMap } = useMemo(() => {
  const frequencyMap = new Map<string, number>();
  for (const log of logs) {
    if (!isFoodPipelineType(log.type)) continue;
    const data = log.data as {
      items: ReadonlyArray<{ canonicalName?: string | null }>;
    };
    for (const item of data.items) {
      const canonical = item.canonicalName;
      if (canonical == null) continue;
      frequencyMap.set(canonical, (frequencyMap.get(canonical) ?? 0) + 1);
    }
  }
  const sorted = [...frequencyMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);
  return {
    frequentFoods: filterToKnownFoods(sorted).slice(0, MAX_ITEMS_PER_TAB),
    frequencyCountMap: frequencyMap,
  };
}, [logs]);
```

---

### [HIGH] `STABLE_END` magic constant defined inside component render scope

**Category:** Code Quality
**Files:**

- `src/components/track/dr-poo/ConversationPanel.tsx:28`

**Description:**

```typescript
// Far-future constant so stableEndMs never goes stale across the memo lifetime.
const STABLE_END = 9_999_999_999_999;
```

This constant is defined _inside the component function body_ even though the comment explains it is intentionally a fixed value that "never goes stale". Placing a module-level constant inside the component body means it is re-declared on every render. The value `9_999_999_999_999` is also a magic number — it is approximately year 2286 in Unix time, which is non-obvious without the comment.

More critically, this constant is passed directly to `useConversationsByDateRange` on line 34 without memoization, which is correct because the value is a literal — but its placement inside the function makes it look like a stateful value to future readers.

**Suggested Fix:**
Move `STABLE_END` to module level with a descriptive name:

```typescript
// Year 2286 in ms — used as a "no end date" sentinel for open-ended queries.
const FAR_FUTURE_TIMESTAMP_MS = 9_999_999_999_999;
```

---

### [MODERATE] `formatItemDisplay` in `helpers.ts` is an alias-wrapper with a type cast

**Category:** Maintainability
**Files:**

- `src/components/track/today-log/helpers.ts:130–139`

**Description:**

```typescript
export function formatItemDisplay(item: {
  name?: string;
  rawName?: string | null;
  ...
}): string {
  return getFoodItemDisplayName(item as Parameters<typeof getFoodItemDisplayName>[0]);
}
```

This function exists solely to accept a "looser item shape" and delegate to `getFoodItemDisplayName`. The `as Parameters<...>[0]` cast is a type lie — it asserts that the loosely-typed input satisfies the stricter `FoodItem` type without actually verifying it. If the two types diverge, this cast hides the incompatibility.

Additionally, `formatItemDisplay` is called in only one place in `getLogDetail` (L237), immediately after a call to `getFoodItemDisplayName` (L227). The two functions are nearly interchangeable in this context but the distinction is not documented.

**Suggested Fix:**
Either make `FoodItem` accept the looser shape as part of its definition, or remove `formatItemDisplay` and consolidate callers onto `getFoodItemDisplayName` directly. If both are genuinely needed, document exactly why they differ and remove the unsafe cast.

---

### [MODERATE] `getShapeKey` in `BristolScale.tsx` uses `index` as a fallback, making keys unstable

**Category:** Code Quality
**Files:**

- `src/components/track/panels/BristolScale.tsx:78–93`

**Description:**
The `getShapeKey` function computes a stable React key for each SVG shape. For all shape types except `path`, the key is derived from coordinates (stable). But for `path` shapes the key is `path-${index}` — an array index. The `default` case also falls back to `shape-${index}`.

React keys derived from array indices are unstable when the array order changes. While the bristol scale data is currently static, this is a latent fragility: if shapes are reordered or conditionally filtered, React will silently re-use the wrong component state.

**Suggested Fix:**
Give each `BristolPath` an optional `id` field in the `BristolPath` interface, or derive a stable key from the path's `d` function string identity (e.g. `d.toString().slice(0, 20)`). For the `default` fallback, a comment explaining why index is acceptable (or replacing it with a hash) would prevent future confusion.

---

### [MODERATE] `NutritionCardErrorBoundary` loses error information after reset

**Category:** Maintainability
**Files:**

- `src/components/track/nutrition/NutritionCardErrorBoundary.tsx:25–27`

**Description:**

```typescript
handleReset = (): void => {
  this.setState({ hasError: false });
};
```

The `State` type includes `hasError: boolean` only. There is no `error` field, so the thrown error is never captured in state. The generic `ErrorBoundary` in `src/components/ui/ErrorBoundary.tsx` stores both `hasError` and `error` in state. The `NutritionCardErrorBoundary` is a stripped-down sibling that does not.

As a result, `componentDidCatch` logs the error, but after reset the error is gone. If the error re-occurs, there is no way to compare it to the previous occurrence. More importantly, the `handleReset` state update is missing the `error: null` reset — if the `State` interface is ever extended to include `error`, the reset will be incomplete.

**Suggested Fix:**
Either unify with the shared `ErrorBoundary` by passing a custom `fallback` prop, or add `error: unknown` to `NutritionCardErrorBoundary`'s state and clear it on reset. The generic `ErrorBoundary` already handles this correctly and should be preferred.

---

### [MODERATE] `BowelSection` accumulates 7+ separate `useState` calls — state cohesion issue

**Category:** Maintainability
**Files:**

- `src/components/track/panels/BowelSection.tsx:171–186`

**Description:**
The component manages its form state across 7 independent `useState` hooks (`bristolCode`, `urgencyTag`, `effortTag`, `accident`, `notes`, `trips`, `volumeTag`) plus a `saving` flag. The reset after save (L221–227) must manually reset all 7 fields. This is fragile: if a new field is added, the developer must remember to reset it in three places (initial state, the `useState` call, and the reset block).

Compare with `useNutritionStore` which uses `useReducer` and a dedicated `RESET_AFTER_LOG` action — a much safer pattern for forms with many related fields.

**Suggested Fix:**
Introduce a `BowelFormDraft` state object and a single `useState<BowelFormDraft>` with a `resetDraft` helper:

```typescript
const INITIAL_BOWEL_DRAFT: BowelFormDraft = {
  bristolCode: null,
  urgencyTag: "medium",
  effortTag: "some",
  accident: false,
  notes: "",
  trips: 1,
  volumeTag: "medium",
};

const [draft, setDraft] = useState(INITIAL_BOWEL_DRAFT);
const resetDraft = () => setDraft(INITIAL_BOWEL_DRAFT);
```

This keeps all reset logic in one place and makes new fields safe to add.

---

### [MODERATE] `submitFood` in `FoodSection` calls `void submitFood()` inside `onKeyDown`

**Category:** Code Quality
**Files:**

- `src/components/track/panels/FoodSection.tsx:137–141`

**Description:**

```typescript
onKeyDown={(event) => {
  if (event.key === "Enter") {
    void submitFood();
  }
}}
```

But `submitFood` is not an `async` function — it is a regular synchronous function that internally fires the async `onLogFood` call in a `.catch().finally()` chain without `await`. Calling `void submitFood()` is technically correct (no lint error), but it implies `submitFood` returns a Promise, which it doesn't. This creates false expectations for future readers who might assume the handler is awaitable.

Additionally, `submitFood` is called both as `onClick={submitFood}` (line 151) and `void submitFood()` from the Enter key, which inconsistently treats it as sync vs async.

**Suggested Fix:**
Remove `void` from the keyDown call since `submitFood` is synchronous:

```typescript
if (event.key === "Enter") {
  submitFood();
}
```

Or, if the intent is to handle errors at the `submitFood` level (which it does via `.catch()`), document this clearly with a comment.

---

### [MODERATE] `handleSave` in `BowelSection` is not memoized with `useCallback`

**Category:** Maintainability
**Files:**

- `src/components/track/panels/BowelSection.tsx:206–233`

**Description:**
`handleSave` is an `async` function defined directly in the component body without `useCallback`. It is passed as `onClick` to the Log button (L539) and referenced in the Enter-key handler (L528). Because it captures `bristolCode`, `urgencyTag`, `effortTag`, etc., it re-creates on every render of `BowelSection`. With `AnimatePresence` wrapping a motion.div that also re-renders on state change, this causes unnecessary re-renders of all child components that receive `handleSave` as a prop.

This is a minor performance issue, but more importantly it is inconsistent with the memoization pattern used by `handleBristolKeyDown` (which _is_ wrapped in `useCallback` on L235).

**Suggested Fix:**
Wrap `handleSave` in `useCallback` with the appropriate dependency array:

```typescript
const handleSave = useCallback(async () => {
  // ...
}, [
  bristolCode,
  urgencyTag,
  effortTag,
  accident,
  notes,
  trips,
  volumeTag,
  onSave,
  reset,
]);
```

---

### [MODERATE] `MACRO_COLORS` uses hardcoded hex strings instead of CSS variables

**Category:** Maintainability
**Files:**

- `src/components/track/nutrition/nutritionConstants.ts:18–24`

**Description:**

```typescript
export const MACRO_COLORS = {
  protein: "#f97316", // orange-500
  carbs: "#34d399", // emerald-400
  fat: "#f87171", // red-400
  sugars: "#fbbf24", // amber-400
  fiber: "#818cf8", // indigo-400
} as const;
```

The CLAUDE.md states "Use tokenized colors only." These hardcoded hex values bypass the CSS variable token system. If the design system's semantic color tokens change (e.g. `--orange` shifts from #f97316 to a different value for dark mode support), these macro pill colors will not update.

Additionally, `ZONE_COLORS` in `NutritionCard.tsx:324–328` has the same problem — it defines `1: "#34d399"`, `2: "#fbbf24"`, `3: "#f97316"` as raw hex strings inside the component file.

**Suggested Fix:**
Replace with CSS variable references:

```typescript
export const MACRO_COLORS = {
  protein: "var(--orange)",
  carbs: "var(--emerald)",
  fat: "var(--red)",
  sugars: "var(--amber)",
  fiber: "var(--violet)",
} as const;
```

Verify the CSS variable names against the design token file before changing.

---

### [MODERATE] `editLayout: "stacked-2"` option documented as potentially unused

**Category:** Maintainability
**Files:**

- `src/components/track/today-log/editors/EditableEntryRow.tsx:56–59`

**Description:**
The `editLayout` prop JSDoc includes:

```
 * - "stacked-2": space-y-2 with border/bg — used by editors that need extra visual
 *   separation, e.g. a digestion detail editor embedded inside a group row.
 *   TODO: audit current callers and remove if unused.
```

This is a self-documented TODO that has not been acted on. An unused variant in a shared component is dead code in the interface contract: it expands the option surface for callers without providing value, and makes the component harder to reason about. If a future developer adds a caller that uses `"stacked-2"`, they will implement UI against a variant that may never have been visually tested.

**Suggested Fix:**
Audit all `EditableEntryRow` callers for `editLayout="stacked-2"`. If no caller uses it, remove the variant from the type union and the implementation. Record this in a commit comment. If it is used, remove the TODO.

---

### [NICE-TO-HAVE] `WeightTrendChart` recomputes `toY` twice

**Category:** Code Quality
**Files:**

- `src/components/track/quick-capture/WeightTrendChart.tsx:55–59`, `L112–113`

**Description:**
The `toY` mapping function (converts a kg value to a SVG Y coordinate) is defined inside `computeChartData` on line 55, then re-defined again inside the `WeightTrendChart` component body on line 112. The second definition is needed because `computeChartData` doesn't expose it. This means if the Y-mapping formula ever changes, it must be changed in two places.

**Suggested Fix:**
Either return `toY` from `computeChartData` as part of the `ChartData` object, or extract it as a standalone pure function that both `computeChartData` and the component can reference.

---

### [NICE-TO-HAVE] `ConversationPanel` type annotations on `pendingReplies` are redundant inline types

**Category:** Code Quality
**Files:**

- `src/components/track/dr-poo/ConversationPanel.tsx:60–68`

**Description:**

```typescript
pendingReplies
  .filter((r: { _id: unknown }) => !confirmedMessageIds.has(String(r._id)))
  .map((r: { _id: unknown; content: string; timestamp: number }) => ({
```

Inline parameter type annotations are applied to the `.filter` and `.map` callbacks. These exist because `usePendingReplies` does not return a typed array. The root fix is to type the return value of `usePendingReplies` — the inline annotations are a workaround that obscures the gap. When the hook is eventually typed properly, these annotations will need to be hunted down and removed.

**Suggested Fix:**
Type the return of `usePendingReplies` so its `pendingReplies` field has a concrete type. The inline annotations can then be deleted.

---

### [NICE-TO-HAVE] `DAY_LABELS` constant in `HabitDetailSheet` is misleading — two "T" entries

**Category:** Code Quality
**Files:**

- `src/components/track/quick-capture/HabitDetailSheet.tsx:33`

**Description:**

```typescript
const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
```

This constant is defined at module level but then immediately replaced in the component with:

```typescript
const days = ["S", "M", "T", "W", "T", "F", "S"];
```

(starting from Sunday). `DAY_LABELS` is only used as a fallback when `displayDays.length === 0` (L206), which means it shows Mon–Sun, while the actual rendering uses Sun–Sat derived from `displayDays`. These two label sets use different starting days of the week. If a user has no summary data at all, the fallback labels start from Monday, while a user with any data would see labels starting from Sunday. The inconsistency is invisible in practice (no-data state rarely shows labels) but is a latent UI bug.

**Suggested Fix:**
Derive the fallback labels from the same `days` array (Sunday-indexed) used in the live path, or document why a different week-start convention is used in the fallback.

---

### [NICE-TO-HAVE] `WaterModal` has two state variables for a single conceptual value

**Category:** Code Quality
**Files:**

- `src/components/track/nutrition/WaterModal.tsx:60–61`

**Description:**

```typescript
const [amount, setAmount] = useState(0);
const [inputValue, setInputValue] = useState("0");
```

`amount` (numeric) and `inputValue` (string) represent the same value in two forms. The component carefully synchronizes them via `updateAmount` and the input handlers. This dual-state pattern is necessary to allow partially-typed values (e.g. "" while the user clears the field), but the synchronization is brittle: there are three separate state setters for `amount` (line 74, 81, 88) and the `inputValue` must always be kept in sync or the UI will display stale data.

**Suggested Fix:**
This pattern is acceptable for controlled numeric inputs. Consider adding a comment explaining the dual-state rationale (or a reference to `handleInputChange` as the canonical sync point) so future developers don't accidentally update one without the other. Alternatively, consolidate into a single `inputValue` string and derive `amount` with `useMemo` from it.

---

### [NICE-TO-HAVE] `titleCaseToken` in `helpers.ts` is re-implemented elsewhere

**Category:** Maintainability
**Files:**

- `src/components/track/today-log/helpers.ts:335–340`
- `src/lib/nutritionUtils.ts` (referenced via `titleCase` import in other files)

**Description:**
`titleCaseToken` in `helpers.ts` converts underscore-separated tokens to title case. A `titleCase` function exists in `@/lib/nutritionUtils` and is imported by multiple files in the nutrition subtree. These may or may not do exactly the same thing, but their existence as separate implementations is a maintenance risk.

**Suggested Fix:**
Audit whether `titleCaseToken` and `titleCase` (from nutritionUtils) produce identical output for the same inputs. If so, consolidate to a single shared utility in `@/lib/`. If they differ, document the difference explicitly.

---

### [NICE-TO-HAVE] `sanitizeDecimalInput` in `weightUtils.ts` has a misleading intermediate step

**Category:** Code Quality
**Files:**

- `src/components/track/quick-capture/weightUtils.ts:7–18`

**Description:**

```typescript
const parts = sanitized.split(".");
if (parts.length > 2) {
  sanitized = `${parts[0]}.${parts.slice(1).join("")}`;
}
// Re-split after multi-dot normalization to apply decimal truncation correctly
const finalParts = sanitized.split(".");
```

After the multi-dot normalization, `sanitized` is re-split into `finalParts`. This is correct but the intermediate `sanitized` string after joining `parts.slice(1)` could itself contain dots (since `slice(1).join("")` keeps internal dots). The comment acknowledges the re-split is needed, but the logic is not self-evident. Input `"1.2.3"` would become `"1.23"` (dot in parts[1] is kept). This is probably the intended behavior (strip extra dots, keep one decimal), but a test case for this specific input would confirm it.

**Suggested Fix:**
Add an explanatory comment to the `slice(1).join("")` line clarifying that `join("")` intentionally strips secondary dots, not just combines the parts:

```typescript
// Join secondary fragments without a separator to strip extra dots
// e.g. "1.2.3" → parts = ["1", "2", "3"] → "1" + "23" = "1.23"
sanitized = `${parts[0]}.${parts.slice(1).join("")}`;
```

Or replace the two-pass logic with a single regex: `sanitized.replace(/[^\d.]/g, "").replace(/(\.\d?).*$/, "$1")`.

---

## Notable Strengths

The following patterns are done well and should be preserved:

1. **`useNutritionStore` reducer** — Pure function, exhaustive switch with `never` type guard, exported for direct unit testing. Exactly the right pattern for complex UI state.
2. **Test coverage for the nutrition reducer** — The test file covers happy paths, edge cases (rapid +/-, NaN, max items), and uses real fixture data from `FOOD_PORTION_DATA` rather than mocks. This is exemplary.
3. **`EditableEntryRow`** — The "render props" pattern for edit fields cleanly separates the shared save/delete/date-time infrastructure from domain-specific editors.
4. **`TodayLogActionsContext`** — Correctly throws when used outside the provider (`if (ctx === null) throw new Error(...)`), which is the right pattern for required contexts.
5. **`MEAL_SLOT_CONFIG` and `MACRO_CONFIG` arrays** — Single source of truth, `ReadonlyArray<...>`, used uniformly across `CalorieDetailView`. Good.
6. **`CircularProgressRing`** — Spring-based animation with `useMotionValue` + `useEffect` is a clean pattern that avoids the stale-closure pitfall common with motion libraries.
7. **`nutritionLogging.ts`** — Remarkably small and well-scoped. Two pure builder functions, directly testable, with matching tests that cover the only real edge case (empty input returns null).
