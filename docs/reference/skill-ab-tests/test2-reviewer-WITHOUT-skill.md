# Test 2: Code Review — WITHOUT Skill

## Files Reviewed

- `src/components/track/nutrition/NutritionCard.tsx`
- `src/components/track/nutrition/useNutritionStore.ts`
- `src/components/track/nutrition/nutritionLogging.ts`
- `src/hooks/useNutritionData.ts`
- `src/lib/sync.ts` (barrel re-export)
- `src/lib/nutritionUtils.ts` (partial)
- `src/hooks/useProfile.ts` (partial)

---

## Findings

### 1. Accessibility — Severity: Medium

**`SearchResultRow` has nested interactive elements without keyboard navigation**

The `SearchResultRow` component renders a `div[role="option"]` containing three `<button>` elements. The outer `div` has `tabIndex={-1}` and `aria-selected={false}`, but:

- The two inner buttons that both call `onSelect` duplicate the same action. The "clickable area" button and the "+" button do exactly the same thing (`onClick={() => onSelect(entry.canonical)}`), creating two focusable targets for the identical action. This adds noise to the keyboard tab order without benefit.
- `aria-selected={false}` is hardcoded and never changes — the component never visually reflects a "selected" state. This misrepresents the combobox state to assistive technologies.
- The `div[role="option"]` is not keyboard-activatable on its own (only the buttons inside are). In a proper listbox/combobox pattern, `option` elements should respond to `Enter`/`Space` when focused. The current structure mixes `role="option"` semantics with inner buttons, which is not valid ARIA.

**Fix:** Consolidate into a single button for the main action. Remove the redundant `+` button or replace the outer `div[role="option"]` with a single button row. Track selection state properly or remove `aria-selected` if it is not used.

---

### 2. Logic Bug — Severity: Medium

**`handleLogFoodButton` can silently call `handleLogRawInput` with a stale closure**

In `handleLogFoodButton` (line 658), the callback reads `searchQueryRef.current` (fine — a ref) but calls `void handleLogRawInput()`. `handleLogRawInput` is a `useCallback` whose dependency array includes `state.searchQuery` (line 630). This is correct — it captures the latest `state.searchQuery` at the time of callback creation.

However, `handleLogFoodButton` does NOT list `handleLogRawInput` in its dependency array correctly — it does list it (line 669), so that part is fine. The subtle issue is that both `handleSearchSubmit` and `handleLogFoodButton` guard with `searchQueryRef.current.trim().length > 0` then call `handleLogRawInput`, which itself re-reads `state.searchQuery` from its closure. If `searchQuery` changes between the ref check and the callback execution (unlikely in practice, but possible under concurrent rendering), the two values can disagree.

**Fix:** Either use only the ref or only the state in both places for consistency. The safer option is to have `handleLogRawInput` also read from `searchQueryRef` rather than `state.searchQuery`, making all paths ref-based and concurrent-safe.

---

### 3. Performance — Severity: Low

**`headerIcons` is memoized with `useMemo` but contains inline `onClick` lambdas**

`headerIcons` (line 697) is wrapped in `useMemo`. The goal is presumably to avoid re-creating the JSX on every render. However, two of the three icon buttons use inline arrow functions (`() => dispatch({ type: "SET_VIEW", view: "favourites" })` and `() => dispatch({ type: "SET_VIEW", view: "foodFilter" })`), not `useCallback`-wrapped handlers. Since the `useMemo` dependencies include `dispatch` (which is stable from `useReducer`) and `handleOpenWater` (which is `useCallback`-wrapped), this memoization is correct and will not re-run spuriously. But the inline lambdas created inside the memo are still new function objects every time the memo does re-run. This is a minor inconsistency: the other handlers are `useCallback`-wrapped, these two are not.

**Fix:** Either extract `handleOpenFavourites` and `handleOpenFoodFilter` as `useCallback` handlers for consistency, or accept the inline style since the memo dependency list is already correct and the overhead is negligible.

---

### 4. UX / Logic — Severity: Low

**`handleExpandCalories` only dispatches `SET_VIEW` with `"calorieDetail"` — no toggle**

The `CalorieRing` onExpand handler (line 525) always dispatches `SET_VIEW` to `"calorieDetail"`. The reducer implements toggle logic in `SET_VIEW` (if the requested view equals the current view, it collapses to `"none"`). This means tapping the ring while `calorieDetail` is open correctly collapses it. That part works.

However, `handleExpandCalories` is named as if it only opens. A reader has to check the reducer to understand the toggle is handled there. No bug, but the naming can mislead future maintainers.

**Fix:** Rename to `handleToggleCalorieDetail` or add a comment linking to the toggle behavior in the reducer.

---

### 5. Code Quality — Severity: Low

**`else` branch after `return` inside `handleLogFoodButton`**

Lines 661–668 use `if (...) { ...; return; } else { ... }`. The `else` is redundant when the `if` branch always returns. Biome or ESLint likely catches this (`no-else-return`). It doesn't affect correctness but is inconsistent with the project's "boring code" principle.

**Fix:** Remove the `else` and dedent its body.

---

### 6. Accessibility — Severity: Low

**Camera and Mic icons inside the search field are purely decorative but hint at unimplemented features**

`NutritionSearchInput` renders `Camera` and `Mic` icons as `pointer-events-none` decorations with `aria-hidden="true"`. The placeholder text says "Search or type a food..." with no mention of camera/voice. If these features are not yet implemented, the icons set false user expectations. For a health-critical app, misleading affordances erode trust.

**Fix:** Either remove the icons until the features are implemented, or replace with a single magnifying glass search icon. If they are intentional aspirational placeholders, document this in a TODO comment.

---

### 7. Missing Error Boundary — Severity: Low

**`NutritionCard` renders data from Convex with no error boundary or explicit loading guard**

`useNutritionData` returns data derived from `useSyncedLogsContext`. If the Convex subscription is in an error state or `logs` is undefined, derived values (`totalCaloriesToday`, `totalFluidsMl`, etc.) will be computed from an empty or undefined array. The hooks appear to default to `0` / empty arrays, so no crash, but there is no visible error state in `NutritionCard` when data loading fails. The project's CLAUDE.md explicitly states: "If connectivity or Convex is unavailable, prefer explicit failure states over misleading 'saved' behavior."

**Fix:** Add an error or connectivity state to `useNutritionData` and expose it in `NutritionCard` so a failure renders an explicit message rather than silently showing zeroes.

---

### 8. Type Safety — Severity: Low

**`buildStagedNutritionLogData` does not guard against empty `stagedItems`**

`buildStagedNutritionLogData` in `nutritionLogging.ts` accepts an empty array without returning `null` or signalling an error — it will log a valid `FoodLogData` with an empty `items` array. The call site in `handleLogStagedFood` does check `state.stagingItems.length` implicitly (the staging modal only opens when there are items), but there is no function-level guard. A future caller could accidentally create empty food logs.

**Fix:** Add a guard: `if (stagedItems.length === 0) throw new Error("Cannot log empty staging list")` or return `null` and update the call site.

---

## Summary

`NutritionCard.tsx` is well-structured and clearly organized. The separation of concerns between `useNutritionStore` (UI state), `useNutritionData` (Convex data), and the logging helpers is solid. The ref-snapshot pattern for stable callbacks is correctly applied throughout.

The most significant issues are accessibility-related: the `SearchResultRow` component has invalid ARIA structure (nested interactive elements inside `role="option"`, hardcoded `aria-selected={false}`) and duplicated action buttons. These would fail a WCAG audit.

Other issues are minor: one redundant `else`, some inconsistency in handler naming, no explicit Convex error state surfaced in the UI, and decorative icons implying features that may not exist yet.

No security vulnerabilities were found. No data is sent to external services from this component directly. All mutations go through `useAddSyncedLog`/`useRemoveSyncedLog` which are Convex-backed.
