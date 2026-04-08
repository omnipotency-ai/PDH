# Test 2: Code Review — WITH Skill

## Files Reviewed

- `src/components/track/nutrition/NutritionCard.tsx` (primary target)
- `src/components/track/nutrition/useNutritionStore.ts` (store + reducer)
- `src/components/track/nutrition/nutritionLogging.ts` (log builders)
- `src/hooks/useNutritionData.ts` (Convex-derived data hook)
- `src/hooks/useProfile.ts` (favourites, nutrition goals)
- `src/lib/sync.ts` (barrel re-export — confirmed hook signatures)

---

## Findings

### F001 — HIGH | Quality | NutritionCard.tsx:71 — `lastRemovedItem` state is never consumed

**Issue:** The store's `lastRemovedItem` field is documented as: _"Consuming component reads + toasts, then resets on next action."_ The reducer populates it correctly when an item is auto-removed by zero-portion. However, `NutritionCard.tsx` never reads `state.lastRemovedItem`, so the removal is silent — no toast, no feedback. The feature is implemented in the reducer and tested in isolation, but the UI integration step was never completed.

**Why it matters:** A user reduces a portion to zero and the item disappears without any notification. This violates the "never swallow errors" and "calm & scannable UX" principles — the user has no idea whether the item was removed intentionally or due to a bug.

**Fix:** Add a `useEffect` in `NutritionCard` that watches `state.lastRemovedItem` and fires a toast:

```tsx
useEffect(() => {
  if (state.lastRemovedItem !== null) {
    toast(`${state.lastRemovedItem} removed`);
  }
}, [state.lastRemovedItem]);
```

---

### F002 — HIGH | Quality | NutritionCard.tsx:587–607 — `handleLogStagedFood` reads `state.stagingItems` directly inside a `useCallback` with `state.stagingItems` as a dep, but also via `stagingItemsRef`

**Issue:** The callback lists `state.stagingItems` as a dependency (line 607), which is correct and necessary for correctness. However, the ref-based pattern (`stagingItemsRef`) used elsewhere in the same component was explicitly introduced to _avoid_ listing `state.stagingItems` as a dep. These two patterns are inconsistent and one is redundant. More importantly, `handleLogStagedFood` at line 596 checks `!FOOD_PORTION_DATA.has(item.canonicalName)` — but `buildStagedNutritionLogData` (called just above) already only includes items that were staged via `createStagedItem`, which _requires_ `FOOD_PORTION_DATA` to be present. The check will always be false for correctly staged items, making it dead code that misleads the reader.

**Why it matters:** Silent dead code misleads future developers. It suggests there is a real code path where staged items lack portion data, which there isn't (the reducer guards it). This is exactly the "do not trust surrounding code" principle from CLAUDE.md.

**Fix:** Remove the `hasUnmatched` check and its branch from `handleLogStagedFood`. The "matching in background" message path is unreachable for staged items. If raw parsing is desired in future, it belongs in the raw-input path, not here.

---

### F003 — HIGH | Quality | NutritionCard.tsx:663–668 — `else` branch after an unconditional `return`

**Issue:** In `handleLogFoodButton`, the first `if` branch returns unconditionally, making the `else` block on line 663 unreachable as an else (it would execute regardless). This is a textbook "unnecessary else after return" pattern:

```tsx
if (stagingItemsRef.current.length > 0) {
  dispatch({ type: "OPEN_STAGING_MODAL" });
  return;
} else {          // <-- "else" is redundant and adds cognitive indirection
  if (searchQueryRef.current.trim().length > 0) {
    ...
  }
  searchInputRef.current?.focus();
}
```

While not a runtime bug, it signals the code was written without refactoring and adds unnecessary nesting. Per CLAUDE.md: "Write simple, readable code."

**Fix:** Remove the `else` block; dedent its contents to the same level as the `if`.

---

### F004 — MODERATE | Simplicity | NutritionCard.tsx:696–727 — `headerIcons` wrapped in `useMemo` for a JSX element with no expensive computation

**Issue:** `headerIcons` is a `useMemo` wrapping three `<button>` elements. The dependencies are `dispatch` (stable from `useReducer`) and `handleOpenWater` (a `useCallback`). In practice this memo never saves any real work — JSX construction is not expensive, and the primary cost would be re-rendering the buttons, which happens via the normal React reconciliation regardless. This is premature optimization (micro-optimization with no evidence of a problem), which CLAUDE.md explicitly flags as a pattern not to follow.

**Why it matters:** Wrapping JSX directly in `useMemo` is an unusual pattern that confuses readers unfamiliar with the codebase. It also signals "this is expensive" when it isn't, leading to cargo-cult memoization elsewhere.

**Fix:** Extract into a small sub-component (`NutritionHeaderActions`) or just inline the JSX directly in the render. Either approach is more idiomatic React.

---

### F005 — MODERATE | Simplicity | NutritionCard.tsx:474–478 — `surfaceSlot` ternary is hard to read

**Issue:** The `surfaceSlot` derived value uses a nested ternary with a leading `undefined` case:

```tsx
const surfaceSlot =
  state.view !== "none"
    ? undefined
    : searchFocused || state.searchQuery.trim().length > 0
      ? "search-view"
      : "collapsed-view";
```

This reads backwards (the `undefined` case fires when something IS active, which is the non-obvious branch). It also conflates three logical states (panel open, search active, collapsed) with two ternaries.

**Fix:** An explicit `if`/`else` block or a helper function with named conditions would make the intent clearer:

```tsx
function getSurfaceSlot(
  view: NutritionView,
  searchActive: boolean,
): string | undefined {
  if (view !== "none") return undefined;
  return searchActive ? "search-view" : "collapsed-view";
}
```

---

### F006 — MODERATE | Accessibility | NutritionCard.tsx:321–325 — `SearchResultRow` `role="option"` is not inside a `role="listbox"` ancestor at the element level

**Issue:** `SearchResultRow` renders a `<div role="option">`. The `role="listbox"` container is the parent `<div id="nutrition-search-results" role="listbox">` in NutritionCard. However, `SearchResultRow` itself contains two nested `<button>` elements (the heart toggle and the select button) inside the `role="option"`. Interactive elements inside `role="option"` are not permitted by ARIA spec — `option` must not contain interactive descendants. Screen readers will behave inconsistently here.

**Why it matters:** CLAUDE.md states "Accessibility is Mandatory." The current structure is invalid ARIA, not a style preference.

**Fix:** Reconsider the design: the heart toggle and the main action are separate interactive targets inside a list item. Replace `role="option"` with `role="listitem"` (inside `role="list"` on the container), or handle favouriting separately outside the listbox pattern entirely. A single-action design where the whole row is one button (with a separate accessible mechanism for favouriting) would be cleaner.

---

### F007 — MODERATE | Performance | NutritionCard.tsx:430–431 — Blur timeout ref pattern is correct but the ref is not typed consistently

**Issue:** `blurTimeoutRef` is typed as `useRef<ReturnType<typeof setTimeout> | null>(null)` which is fine. However, the broader ref pattern (three snapshot refs: `stagingItemsRef`, `viewRef`, `searchQueryRef` + `searchFocusedRef`) adds significant cognitive overhead. All of these exist to work around stale closures in the global `keydown` handler and the `handleLogFoodButton` callback. This is a legitimate pattern but its necessity should be re-evaluated: if the `keydown` handler were registered via a library (e.g., a focus trap) or if the two callbacks were restructured, several refs could be eliminated.

This is not a bug, but the pattern adds four "invisible" state reads that TypeScript cannot type-check, increasing the risk of a ref being out of sync. The comment on each ref explains this, which is good, but the volume of refs is a warning sign.

**Severity note:** Flagged MODERATE because the pattern is documented and correct today, but represents accumulated debt.

---

### F008 — MODERATE | Correctness | useNutritionData.ts:181 — `activeDayEnd` computed without `todayKey` dependency when `targetDate` is undefined

**Issue:** When `targetDate` is undefined (the default "today" case), `activeDayStart` is derived from `Number(todayKey)` but `activeDayEnd` is computed as `activeDayStart + MS_PER_DAY`. This is correct for the value, but the `useMemo` that consumes `activeDayStart` and `activeDayEnd` (line 184) will correctly recompute when `todayKey` changes, because `activeDayStart` is derived from it inline (not memoized itself). However, this inline derivation means `activeDayStart` and `activeDayEnd` are both computed on every render (not memoized), and any change to `logs` or the profile will trigger a re-render that recomputes these. Minor, but worth noting.

**Fix:** Consider memoizing `activeDayStart`/`activeDayEnd` together:

```ts
const { activeDayStart, activeDayEnd } = useMemo(() => {
  const start = targetDate ? selectedDayStart : Number(todayKey);
  return { activeDayStart: start, activeDayEnd: start + MS_PER_DAY };
}, [targetDate, selectedDayStart, todayKey]);
```

---

### F009 — NICE-TO-HAVE | Simplicity | NutritionCard.tsx:691–693 — `new Date()` called on every render for `selectedDateLabel`

**Issue:** `selectedDateLabel` calls `new Date()` inline (via `isSameDay(selectedDate, new Date())`). For a synchronous UI component this is inconsequential, but it is inconsistent with the deliberate `useTodayKey` pattern in `useNutritionData` (which specifically avoids re-deriving "today" on every render). The inconsistency is minor but signals code written independently of the data hook.

**Fix:** Not urgent. Could use `useMemo` or accept a `todayDate` prop from the parent.

---

### F010 — NICE-TO-HAVE | Clarity | NutritionCard.tsx:348–384 — `SearchResultRow` has two buttons with `onClick={() => onSelect(...)}` — intent is ambiguous

**Issue:** Both the "Clickable area for adding to staging" `<button>` (line 349) and the explicit `+` button (line 375) call `onSelect(entry.canonical)`. The comment "Explicit + button" suggests the `+` button is the primary affordance, while the middle section is a secondary tap target. Having two elements fire the exact same action is fine UX-wise, but the `aria-label` on the middle button ("Select Banana") and the `+` button ("Add Banana to staging") describe the same action with different words, which may confuse screen reader users.

**Fix:** Consolidate aria labels or make the outer row a single button. Low priority.

---

## Summary

| Severity     | Count  |
| ------------ | ------ |
| CRITICAL     | 0      |
| HIGH         | 3      |
| MODERATE     | 5      |
| NICE-TO-HAVE | 2      |
| **Total**    | **10** |

**Overall assessment:** The component is structurally sound with a well-designed reducer, good error handling on all async paths, and mostly correct accessibility. The three HIGH findings are all correctness/silent-failure issues rather than security problems: a missing UI integration for `lastRemovedItem`, dead code in the staged-food log path, and an unnecessary `else` branch that adds misleading nesting. The most impactful fix is F001 (toast on silent item removal). The ARIA issue (F006) should be addressed before any accessibility audit. No security vulnerabilities found.

---

## Methodology Notes

The review followed the agent definition methodology in this order:

1. **Scope identification:** Confirmed the target file (`NutritionCard.tsx`) and identified its direct imports. Read all relevant hooks and utilities.

2. **Stack-specific checks evaluated first:**
   - _Convex:_ No Convex functions are defined in this file. The data hook (`useNutritionData`) reads from a context backed by Convex, not direct `useQuery` calls — no subscription or index concerns found at this layer.
   - _Clerk Auth:_ No auth calls in this component. Auth is handled upstream in the context layer. No auth bypass or data isolation issues visible here.
   - _React/Router:_ This is a standard React component (not a route). No route-level issues applicable. No server-only imports.

3. **General checks applied:** Security (none found), Simplicity (F003, F004, F005, F007, F010), Performance (F008, F009), Quality (F001, F002, F006).

4. **"What NOT to Flag" respected:** Tailwind class ordering and minor formatting were not flagged. No hypothetical issues were included — all findings are grounded in code evidence. The `isFavourite` O(n) scan (array `includes` on `favourites`) was noted but not flagged because the favourites list is small and there is no evidence of a performance problem.

5. **CLAUDE.md cross-references:** "Never swallow errors" → F001; "Write boring code, not clever code" → F003, F004, F005; "Accessibility is Mandatory" → F006; "Code as Evidence, Not Truth" → F002.
