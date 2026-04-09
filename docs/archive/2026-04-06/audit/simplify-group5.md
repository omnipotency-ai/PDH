# Simplification Audit — Group 5

**Date:** 2026-04-06
**Scope:** UI components, contexts, hooks, tests

---

## Summary

The codebase is generally well-structured and follows "boring code" principles. The most significant simplification opportunities are concentrated in three areas: (1) redundant spread patterns used as workarounds for optional props that could be passed directly, (2) the `ProfileContext` patchProfile function which manually spreads each field when a simpler pattern exists, and (3) several constants and dead state that can be removed from `useCelebration`. A handful of moderate findings address minor structural duplications and one misleading type annotation.

---

## Findings

### [HIGH] patchProfile builds identical conditional spreads for every field

**Category:** Over-Engineering
**Files:** `src/contexts/ProfileContext.tsx:151-188`
**Description:** The `patchProfile` callback manually wraps every field in a conditional spread to avoid sending `undefined` values. This produces 10 nearly identical lines of `...(updates.field !== undefined && { field: updates.field })`. The pattern exists because `exactOptionalPropertyTypes` is enabled and the mutation presumably rejects undefined values. However, the mutation's args type can be satisfied more cleanly by filtering the updates object directly, or by passing `updates` through `Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined))`. The current approach will require a new conditional spread every time a field is added to `PatchProfileArgs`, making it a maintenance trap.
**Suggested Simplification:** Replace the 10-field manual spread with a single filter pass:

```ts
const defined = Object.fromEntries(
  Object.entries(updates).filter(([, v]) => v !== undefined),
) as PatchProfileArgs;
await patchMutation({ now: Date.now(), ...defined });
```

This is one line versus ten and automatically handles future fields. If the mutation arg type requires this, a cast is still cleaner than the current verbosity.

---

### [HIGH] ToggleGroup value/defaultValue normalization is a nested ternary chain

**Category:** Over-Engineering / Boring Code
**Files:** `src/components/ui/toggle-group.tsx:46-57`
**Description:** The normalization of `value` and `defaultValue` from `string | string[]` to `string[]` uses two nested ternary chains that are hard to read at a glance:

```ts
const groupValue =
  value === undefined
    ? undefined
    : ((multiple
        ? Array.isArray(value)
          ? value
          : [value]
        : [value]) as string[]);
```

The logic is correct but violates the "no nested ternaries" convention from the project standards. The inner ternary `(Array.isArray(value) ? value : [value])` is also the same in both the `multiple` and non-`multiple` branches when the input is not already an array — the only difference is whether the multiple-mode path allows arrays through.
**Suggested Simplification:** Extract a small helper and use an if/else:

```ts
function toStringArray(v: string | string[]): string[] {
  return Array.isArray(v) ? v : [v];
}
// ...
const groupValue = value === undefined ? undefined : toStringArray(value);
const groupDefaultValue =
  defaultValue === undefined ? undefined : toStringArray(defaultValue);
```

Then the `onValueChange` adapter becomes the only place that cares about `multiple`.

---

### [MODERATE] Repeated `resolveRenderProps` call pattern across 6+ components

**Category:** Redundancy / DRY
**Files:** `src/components/ui/button.tsx:57`, `src/components/ui/collapsible.tsx:19`, `src/components/ui/drawer.tsx:21`, `src/components/ui/dropdown-menu.tsx:26`, `src/components/ui/navigation-menu.tsx:127`, `src/components/ui/popover.tsx:31`, `src/components/ui/sheet.tsx:20`, `src/components/ui/tooltip.tsx:31`
**Description:** Every trigger/link component that supports both `render` and `asChild` calls `resolveRenderProps(render, asChild, children)` then spreads the result into the primitive. The pattern is correct and `resolveRenderProps` is already extracted, but each component also redundantly declares `asChild?: boolean` and `render?: React.ReactElement` in its own type signature, duplicating the same optional props. Callers must discover this pattern is available on each component independently.
**Suggested Simplification:** Define a shared `PolymorphicProps` type alias in `base-ui-utils.tsx` that can be spread into each component's props:

```ts
export type PolymorphicProps = {
  render?: React.ReactElement;
  asChild?: boolean;
};
```

Then each component uses `& PolymorphicProps` instead of declaring the fields inline. This reduces repetition and makes the pattern discoverable. No behavioral change.

---

### [MODERATE] `useCelebration` keeps dead constants and a dead ref

**Category:** Boring Code / Redundancy
**Files:** `src/hooks/useCelebration.ts:7-8, 18-19, 32-47`
**Description:** The file declares `SOUND_ENABLED = true` and `CONFETTI_ENABLED = true` as constants, then branches on them with `if (SOUND_ENABLED)` and `if (CONFETTI_ENABLED)`. Since both are always `true`, the `else` branches (the `toast.success` fallbacks) are dead code that can never execute. The comment acknowledges preferences were removed. Additionally, `timeoutRef` is declared and cleaned up but the only code that uses `clearTimeout(timeoutRef.current)` in the cleanup `useEffect` is correct — however the branch `if (CONFETTI_ENABLED)` wrapping the timeout means without confetti there is no ref usage at all, making `timeoutRef` and its `useEffect` dead when `CONFETTI_ENABLED` is false (which it never is). The dead branches add noise when reading the function.
**Suggested Simplification:** Remove the constants and the dead branches entirely. Call `playSound("goalComplete")` and `setCelebration(...)` unconditionally in `celebrateGoalComplete`. The file's own comment says "Sound and confetti are always enabled." Follow that comment by making the code match:

```ts
const celebrateGoalComplete = useCallback((message: string) => {
  playSound("goalComplete");
  setCelebration({ ... });
  clearTimeout(timeoutRef.current);
  timeoutRef.current = setTimeout(() => setCelebration(null), 2200);
}, []);
```

---

### [MODERATE] `SyncedLogsContext` computes `now` from `dayKey` but then recomputes `startOfToday` independently

**Category:** Redundancy
**Files:** `src/contexts/SyncedLogsContext.tsx:18-30`
**Description:** `now` is derived from `dayKey` via `useMemo`, but then `startOfToday` is constructed again from `now` using `new Date(now.getFullYear(), now.getMonth(), now.getDate())` — which is exactly `now` itself (since `now` was already constructed as midnight of today). The variable `startOfToday` is therefore redundant; it equals `now`. Then `fourteenDaysAgo` and `endOfToday` are derived from `startOfToday`, adding another layer.
**Suggested Simplification:** Use `now` directly as the start-of-today value, eliminating `startOfToday`:

```ts
const now = useMemo(() => {
  const [year, month, day] = dayKey.split("-").map(Number);
  return new Date(year, month, day).getTime(); // Return ms directly
}, [dayKey]);
const fourteenDaysAgoMs = now - 14 * 24 * 60 * 60 * 1000;
const endOfTodayMs = now + 24 * 60 * 60 * 1000;
```

This removes 4 lines and two intermediate Date objects.

---

### [MODERATE] `useResponsiveShellMode` uses a nested ternary in the event handler

**Category:** Boring Code
**Files:** `src/components/ui/responsive-shell.tsx:46`
**Description:** Inside `useResponsiveShellMode`, the media query handler uses:

```ts
setMode(mqlXl.matches ? "desktop" : mqlMd.matches ? "tablet" : "mobile");
```

This is a nested ternary. It is not complex logic, but the project standard explicitly states "Avoid nested ternary operators — prefer switch statements or if/else chains." It also appears in the initialization function `getResponsiveShellMode` which uses the same style.
**Suggested Simplification:** Extract the logic into the existing `getResponsiveShellMode` function (which already does the same thing correctly with if/else) and call that from the handler:

```ts
const handler = () => setMode(getResponsiveShellMode(window.innerWidth));
```

`getResponsiveShellMode` already takes a width, so instead of reading from mql objects, pass `window.innerWidth` at call time. This removes the duplicate branching logic and the handler reduces to one line.

---

### [MODERATE] `PopoverTitle` renders a `<div>` but is typed as `React.ComponentProps<"h2">`

**Category:** Boring Code
**Files:** `src/components/ui/popover.tsx:125-127`
**Description:** `PopoverTitle` accepts `React.ComponentProps<"h2">` in its props type, which implies the semantic and attribute set of an `<h2>` element, but renders a plain `<div>`. This mismatch means callers might pass `h2`-specific attributes that are silently ignored, and `aria-level` or heading semantics are not conveyed. The companion `PopoverDescription` correctly uses `ComponentProps<"p">` and renders a `<p>`.
**Suggested Simplification:** Change the props type to `React.ComponentProps<"div">` to match the actual rendered element, or change the element to `<h2>` to match the intended semantics. The latter is correct from an accessibility standpoint — a popover title should be a real heading.

---

### [MODERATE] `useDetailSheetController` wraps `habits.find()` in `useMemo` unnecessarily

**Category:** Over-Engineering
**Files:** `src/hooks/useDetailSheetController.ts:27-30`
**Description:** The `detailSheetHabit` derivation is:

```ts
const detailSheetHabit = useMemo(
  () => habits.find((habit) => habit.id === detailSheetHabitId) ?? null,
  [habits, detailSheetHabitId],
);
```

`useMemo` here is premature — `habits.find()` over a small array (typically <20 habits) is negligible. The result only changes when `detailSheetHabitId` changes (which is a user tap) or when `habits` changes (rare). This is not a hot path and the overhead of the memo bookkeeping likely exceeds the cost of the raw lookup. The code signals to readers that this is an expensive computation requiring memoization, which is misleading.
**Suggested Simplification:** Remove the `useMemo`:

```ts
const detailSheetHabit =
  habits.find((h) => h.id === detailSheetHabitId) ?? null;
```

---

### [MODERATE] `useQuickCapture` uses conditional spreads to pass optional props through to `useHabitLog`

**Category:** Over-Engineering
**Files:** `src/hooks/useQuickCapture.ts:116-119`
**Description:** The call to `useHabitLog` uses conditional spread for `captureTimestamp`, `captureStart`, `captureEnd`, and `captureOffset`:

```ts
...(captureTimestamp !== undefined && { captureTimestamp }),
...(captureStart !== undefined && { captureStart }),
...(captureEnd !== undefined && { captureEnd }),
...(captureOffset !== undefined && { captureOffset }),
```

But `useHabitLog` defines these as optional props with defaults (`captureOffset = 0`), so passing `undefined` is safe and TypeScript-compatible. The conditional spreads are doing nothing useful here — they exist to satisfy `exactOptionalPropertyTypes`, but the underlying `useHabitLog` already handles the `undefined` cases with defaults.
**Suggested Simplification:** If `useHabitLog`'s interface accepts `captureOffset?: number` (with default `0`), you can just pass the values directly:

```ts
captureTimestamp,
captureStart,
captureEnd,
captureOffset,
```

If the Convex `exactOptionalPropertyTypes` setting requires the conditional spreads at the mutation call site, that concern does not apply here where we are calling a local hook function.

---

### [MODERATE] `date-picker.tsx` is an uncontrolled demo component exported from the UI library

**Category:** Over-Engineering
**Files:** `src/components/ui/date-picker.tsx`
**Description:** `DatePicker` is a fully uncontrolled demo component — it manages its own internal `date` state. It accepts no `value`, `onChange`, or `onSelect` props from the outside. If any consumer needs a controlled date picker (the typical use case), they cannot use this component; they must compose their own from `Popover` + `Calendar`. This means the component as written is not reusable in the conventional sense — it is a demo or example, not a UI primitive. Placing it in `src/components/ui/` alongside genuine primitives is misleading.
**Suggested Simplification:** Either (a) delete the file if no current feature uses it, or (b) convert it to a controlled component with `value: Date | undefined` and `onSelect: (date: Date | undefined) => void` props, which is the form that would actually be reused. A controlled date picker is a genuine UI primitive; an uncontrolled demo is not.

---

### [MODERATE] `CalendarDayButton` calls `getDefaultClassNames()` on every render

**Category:** Over-Engineering
**Files:** `src/components/ui/calendar.tsx:145`
**Description:** `CalendarDayButton` is called once per day cell (up to ~42 times per calendar render). Each call invokes `getDefaultClassNames()` to access `defaultClassNames.day`. If `getDefaultClassNames()` is not memoized internally by `react-day-picker`, this creates 42 unnecessary object allocations per calendar render. The parent `Calendar` component already calls `getDefaultClassNames()` once and uses its result throughout. `CalendarDayButton` should reuse that result or hoist the call.
**Suggested Simplification:** Move the `getDefaultClassNames()` call outside the component function and into module scope (it returns static data):

```ts
const defaultCalendarClassNames = getDefaultClassNames();

function CalendarDayButton({ ... }) {
  // Use defaultCalendarClassNames.day directly
}
```

---

### [NICE-TO-HAVE] `useFoodParsing` wraps a single `addSyncedLog` call in a hook

**Category:** Over-Engineering
**Files:** `src/hooks/useFoodParsing.ts`
**Description:** The entire hook is a thin wrapper around a single `useCallback` that calls `addSyncedLog`. The hook's body is 10 lines of logic after imports. It provides no meaningful abstraction beyond renaming the function to `handleLogFood` and trimming notes. The abstraction layer exists (per comments in the file) because parsing was previously done client-side, but now the server handles everything. What remains is barely more than calling `addSyncedLog` directly.
**Suggested Simplification:** This is a judgment call — the hook is used in multiple places so the extraction still saves some lines. However, if `useFoodParsing` is only ever called from `useQuickCapture`, it could be inlined there. The finding is mild since the separation is not actively harmful.

---

### [NICE-TO-HAVE] Test helper `makeLog` in `useNutritionData.test.ts` is duplicated from other test files

**Category:** DRY
**Files:** `src/hooks/__tests__/useNutritionData.test.ts:5-13`, `src/lib/__tests__/baselineAverages.test.ts:42-53`, `src/lib/__tests__/derivedHabitLogs.test.ts:53-63`
**Description:** Multiple test files define their own local `makeLog` / `makeFluidLog` / `makeDigestionLog` factory functions with the same shape. These differ slightly in signature (some take `Partial<SyncedLog>`, others take named parameters) but serve the same purpose: building a minimal valid `SyncedLog` for tests. This DRY violation makes it easy for factories to diverge.
**Suggested Simplification:** Extract shared test factories into a `src/lib/__tests__/testUtils.ts` (or `src/test-utils/logFactories.ts`) module that all test files import. This is a standard pattern for shared test helpers.

---

### [NICE-TO-HAVE] `Sonner` `Toaster` uses an arrow function component instead of a `function` declaration

**Category:** Boring Code
**Files:** `src/components/ui/sonner.tsx:11`
**Description:** `const Toaster = ({ ...props }: ToasterProps) => { ... }` uses an arrow function. The project prefers `function` declarations for top-level components (per CLAUDE.md: "Prefer `function` keyword over arrow functions"). This is consistent with the ui library files using `function` for all other components (`Button`, `Card`, `Checkbox`, etc.).
**Suggested Simplification:** Change to `function Toaster({ ...props }: ToasterProps) { ... }`.

---

### [NICE-TO-HAVE] `Drawer` and `Sheet` components have identical empty spread wrappers

**Category:** Redundancy
**Files:** `src/components/ui/drawer.tsx:9-11`, `src/components/ui/sheet.tsx:8-10`, `src/components/ui/dropdown-menu.tsx:8-9`
**Description:** Several thin wrapper components use `{ ...props }` spread syntax in their destructuring pattern, e.g.:

```ts
function Drawer({ ...props }: React.ComponentProps<typeof DrawerPrimitive.Root>) {
  return <DrawerPrimitive.Root data-slot="drawer" {...props} />;
}
```

The `{ ...props }` destructuring is identical to just writing `(props)`. The spread-then-spread pattern is a no-op transformation that adds visual noise. The same pattern appears in `DropdownMenu`, `Sheet`, `DrawerPortal`, `DrawerClose`, `DropdownMenuPortal`, `DropdownMenuGroup`, `DropdownMenuRadioGroup`, `DropdownMenuSub`.
**Suggested Simplification:** Change `{ ...props }` to `props` in the parameter list for pass-through wrappers. This is pure readability — no behavioral change:

```ts
function Drawer(props: React.ComponentProps<typeof DrawerPrimitive.Root>) {
  return <DrawerPrimitive.Root data-slot="drawer" {...props} />;
}
```

---

### [NICE-TO-HAVE] `useWeeklySummaryAutoTrigger` reads `latestSummary?.weekStartTimestamp` with optional chaining when `latestSummary` is already typed as not null in the check

**Category:** Boring Code
**Files:** `src/hooks/useWeeklySummaryAutoTrigger.ts:219-221`
**Description:**

```ts
const alreadyHasSummary =
  latestSummary !== undefined && latestSummary?.weekStartTimestamp === startMs;
```

After the `!== undefined` check, the `?.` optional chain on `latestSummary?.weekStartTimestamp` is redundant — TypeScript and runtime both know `latestSummary` is defined at that point. The `?.` is defensive coding that fights the explicit check right next to it.
**Suggested Simplification:**

```ts
const alreadyHasSummary =
  latestSummary !== undefined && latestSummary.weekStartTimestamp === startMs;
```

---

### [NICE-TO-HAVE] `useMappedAssessments` has four tiny `map*` helper functions that could each be an inline type guard

**Category:** Over-Engineering
**Files:** `src/hooks/useMappedAssessments.ts:5-49`
**Description:** `mapVerdict`, `mapConfidence`, `mapCausalRole`, and `mapChangeType` each do the same thing: accept `unknown`, match it against a set of known literals, and fall back to a default. The four functions are structurally identical. They are not tested independently, and the set of valid values for each field is already expressed in the TypeScript type for `FoodAssessmentRecord`.
**Suggested Simplification:** Consider a single generic helper:

```ts
function safeEnum<T extends string>(
  value: unknown,
  valid: readonly T[],
  fallback: T,
): T {
  return valid.includes(value as T) ? (value as T) : fallback;
}
```

Then each field is one line: `verdict: safeEnum(r.verdict, ["safe", "watch", "avoid", "trial_next"], "watch")`. This reduces four 9-line functions to one 3-line function plus four single-line call sites. The tradeoff is that the valid values move from the switch branches to the call site — still perfectly readable.

---

### [NICE-TO-HAVE] `index.css` section token groups follow a 4-property pattern but `--section-tracking` in dark mode has a mismatched value

**Category:** Boring Code
**Files:** `src/index.css:236-239`
**Description:** Every section color group defines `--section-X`, `--section-X-muted`, `--section-X-border`, `--section-X-glow`. In the dark theme, `--section-tracking` is `rgba(249, 115, 22, 0.8)` (orange, 80% opacity) while every other section uses a solid opaque color for the base token. The `-muted`, `-border`, and `-glow` sub-tokens use a different base color (`251, 191, 36` = amber) than the base token (`249, 115, 22` = orange), creating an inconsistent palette for this one section. In light mode, `--section-tracking` is correctly `#d97706` with amber-consistent sub-tokens.
**Suggested Simplification:** Align the dark mode `--section-tracking` base color and its sub-tokens to use the same hue. Either make the base `#f97316` (solid orange) and the sub-tokens use the same orange channel, or make the base `#fbbf24` (amber) to match the sub-tokens. This is a design inconsistency, not a code logic error.
