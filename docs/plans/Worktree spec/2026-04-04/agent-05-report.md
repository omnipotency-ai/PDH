# Agent 05 — Performance & Maintainability: FavouritesView.tsx + FoodFilterView.tsx

## Summary

Both files are generally well-structured and readable. The main performance concerns are inline callback creation in list items and redundant utility lookups per render. The main maintainability concerns are near-identical row components between the two files and a `validFavourites` filter computed independently in both components. No critical bugs, but several improvements would reduce duplication and future fragility.

---

## Findings

### [Important]: Inline arrow function in list item `onClick` creates new function reference every render

- **File**: `src/components/track/nutrition/FavouritesView.tsx:125` and `src/components/track/nutrition/FoodFilterView.tsx:260`
- **Issue**: Both `FavouriteRow` and `FoodFilterRow` create a new `() => onAdd(canonicalName)` arrow function on every render inside the `<button onClick>` handler. Neither row component is memoized with `React.memo`, so any parent re-render propagates fully through the list.
- **Impact**: For a list of up to 50 items (the `MAX_ITEMS_PER_TAB` cap), this means 50 new function allocations per render. In a tab-switching context (where `displayedItems` changes) this is acceptable, but if the parent re-renders frequently (e.g. Zustand store ticks), the entire list re-renders unnecessarily.
- **Suggestion**: Wrap both `FavouriteRow` and `FoodFilterRow` in `React.memo`. The inline arrow function itself is low-cost since `canonicalName` is the key binding, but `React.memo` on the row components would prevent re-renders when neither props nor the list contents have changed. Alternatively, pass `onAdd` directly and `canonicalName` separately, and use a `useCallback`-wrapped handler in the parent.

---

### [Important]: `validFavourites` filter is duplicated across both components

- **File**: `src/components/track/nutrition/FavouritesView.tsx:30-32` and `src/components/track/nutrition/FoodFilterView.tsx:79-85`
- **Issue**: Both files independently filter `favourites` to only those names present in `FOOD_PORTION_DATA`. `FavouritesView` does this in the render body (no memoization); `FoodFilterView` wraps it in `useMemo`. The logic is identical.
- **Impact**: If the filtering criteria ever change (e.g. a new registry check is added), it must be updated in two places. The version in `FavouritesView` also recomputes on every render, whereas `FoodFilterView` memoizes it correctly.
- **Suggestion**: Extract a shared `useValidFoods(names: string[]): string[]` hook (or a plain `filterValidFoods(names: string[]): string[]` utility in `nutritionUtils.ts`) that encapsulates the `FOOD_PORTION_DATA.has()` filter. Use `useMemo` in `FavouritesView` just as `FoodFilterView` already does.

---

### [Important]: `formatPortion` and `getDefaultCalories` called twice per item in `FoodFilterView`

- **File**: `src/components/track/nutrition/FoodFilterView.tsx:171-172`
- **Issue**: Inside the `displayedItems.map()`, `formatPortion(canonicalName)` and `getDefaultCalories(canonicalName)` are called on every render pass. Each function does a `FOOD_PORTION_DATA.get(canonicalName)` Map lookup internally. This means 2 Map lookups × N items on every render. The same pattern exists in `FavouritesView` (lines 63-64), but without memoization of the item list.
- **Impact**: `Map.get()` is O(1) and fast, so this is not a measurable bottleneck at 50 items. However, it represents a missed optimization if the list ever grows (e.g. the "All" tab) or if row components start computing richer derived data. More importantly, the data for a given canonical name never changes, making it prime for memoization.
- **Suggestion**: Consider precomputing `{ canonicalName, displayName, portion, calories }` in the `useMemo` that builds `displayedItems` (or a parallel `useMemo`), so row components receive fully resolved props and the Map lookups happen once rather than on every re-render.

---

### [Important]: `allFoods` capped with `.slice()` at render time, not in the memo

- **File**: `src/components/track/nutrition/FoodFilterView.tsx:102`
- **Issue**: `allFoods` is fully built and sorted in a `useMemo` (all N canonical foods), but then `.slice(0, MAX_ITEMS_PER_TAB)` is applied inside the `displayedItems` `useMemo`, not inside the `allFoods` memo itself. This means the full sorted array is always held in memory even though only 50 items are ever displayed.
- **Impact**: At current data sizes this is negligible, but it is architecturally inconsistent: `validRecentFoods` and `validFavourites` both apply `.slice()` in their own memos, while `allFoods` does not. If `allFoods` grows to hundreds of entries, holding the full array in memory unnecessarily is wasteful.
- **Suggestion**: Either apply `.slice(0, MAX_ITEMS_PER_TAB)` inside the `allFoods` memo (at the cost of losing the full list if pagination is later added), or document why the full list is retained. Consistency with the other two memos is the more immediate concern.

---

### [Important]: `FavouriteRow` and `FoodFilterRow` are near-identical — duplicated structure

- **File**: `src/components/track/nutrition/FavouritesView.tsx:85-137` and `src/components/track/nutrition/FoodFilterView.tsx:218-272`
- **Issue**: The two row components share the same layout: a Heart icon, a food name span, a portion+calories span, and an orange `+` button. The only behavioural difference is that `FavouriteRow` always renders the heart filled/orange, while `FoodFilterRow` renders it filled or unfilled depending on `isFavourite`. The className strings, inline styles, and structure are copy-pasted.
- **Impact**: Any visual change to the row (spacing, font size, button style) must be made in two places. The shared `portion + " · " + calories` formatting logic (lines 118-119 and 253-255) is also duplicated. This is a meaningful maintenance burden and a likely source of visual drift over time.
- **Suggestion**: Extract a single `FoodRow` component in a shared file (e.g. `src/components/track/nutrition/FoodRow.tsx`) that accepts an optional `isFavourite?: boolean` prop. When `isFavourite` is `undefined` (as in `FavouritesView`), always render the heart filled. Both views import and use the same component.

---

### [Minor]: `frequentFoods` alias is a mutable reference alias, not a copy or memo

- **File**: `src/components/track/nutrition/FoodFilterView.tsx:90`
- **Issue**: `const frequentFoods = validRecentFoods;` is a plain reference assignment, not a `useMemo`. This is intentional (it's a placeholder), but it means `frequentFoods` is not a stable value in the dependency array on line 104 — it changes identity whenever `validRecentFoods` changes, which is correct but implicit.
- **Impact**: Low immediate impact. The bigger risk is that when frequency tracking is implemented, a developer might replace this line with a real computation and forget to wrap it in `useMemo`, causing the `displayedItems` memo to recompute unnecessarily. The comment on lines 87-90 correctly flags this as a placeholder, which mitigates the risk.
- **Suggestion**: When frequency tracking is implemented, ensure the replacement is wrapped in `useMemo`. Until then, a comment noting the dependency implication would improve clarity.

---

### [Minor]: Tab panel `aria-label` computed with `TABS.find()` on every render

- **File**: `src/components/track/nutrition/FoodFilterView.tsx:160`
- **Issue**: `TABS.find((t) => t.id === activeTab)?.label ?? ""` runs a linear search through `TABS` (4 items) on every render to generate the `aria-label` for the tab panel.
- **Impact**: Completely negligible at 4 items. This is a micro-inefficiency only.
- **Suggestion**: Derive a `activeTabLabel` constant inside the component (e.g. `const activeTabLabel = TABS.find(...).label`) and reuse it in both the `aria-label` and potentially elsewhere. This also slightly improves readability.

---

### [Minor]: No `React.memo` or `useCallback` on row components — fine now, fragile at scale

- **File**: `src/components/track/nutrition/FavouritesView.tsx:85` and `src/components/track/nutrition/FoodFilterView.tsx:218`
- **Issue**: Both `FavouriteRow` and `FoodFilterRow` are plain function components with no memoization. The parent components do not stabilize `onAddToStaging` with `useCallback` (it is passed directly from props, so its stability depends entirely on the caller).
- **Impact**: If the parent (e.g. the Nutrition Card) re-renders frequently without changing the food lists, all row components will re-render unnecessarily. At 50 items this is unlikely to be perceptible, but it is an easy win to guard against.
- **Suggestion**: Wrap both row components in `React.memo`. Note that this is only meaningful if `onAdd` is stabilized with `useCallback` at the call site; document this coupling in a comment.

---

### [Minor]: `FavouritesView` has no `useMemo` on `validFavourites`

- **File**: `src/components/track/nutrition/FavouritesView.tsx:30-32`
- **Issue**: `FoodFilterView` wraps the equivalent filter in `useMemo([favourites])`. `FavouritesView` does not. This means `validFavourites` is recomputed on every render of `FavouritesView`, even if `favourites` has not changed.
- **Impact**: Low — the filter is a simple `Array.prototype.filter` over `favourites`. For typical list sizes this is unnoticeable. However, the inconsistency between the two files may confuse future maintainers.
- **Suggestion**: Add `useMemo` to the `validFavourites` computation in `FavouritesView` to match the pattern in `FoodFilterView`.

---

### [Nice-to-have]: Shared `portion + calories` format string duplicated in both row components

- **File**: `src/components/track/nutrition/FavouritesView.tsx:118-119` and `src/components/track/nutrition/FoodFilterView.tsx:253-255`
- **Issue**: The conditional `{portion}{portion && calories > 0 ? " · " : ""}{calories > 0 ? \`${calories} kcal\` : ""}` pattern is copied verbatim in both row components.
- **Impact**: Minor duplication. If the separator or display format changes (e.g. to show kJ, or a different separator), both places must be updated.
- **Suggestion**: Extract a `formatPortionCalories(portion: string, calories: number): string` utility in `nutritionUtils.ts` that returns the formatted string. Both row components call it and render the result.

---

### [Nice-to-have]: No unit tests for either view component

- **File**: `src/components/track/nutrition/` (directory)
- **Issue**: The `__tests__` directory contains only `useNutritionStore.test.ts`. Neither `FavouritesView` nor `FoodFilterView` has unit tests. The E2E tests (referenced in git log) cover `FavouritesView` and `FoodFilterView` behaviorally, but low-level unit tests for edge cases (empty lists, invalid canonical names, tab switching) are absent.
- **Impact**: Future refactoring (e.g. extracting `FoodRow`) carries higher regression risk without unit tests. The row rendering logic for the `portion · calories` conditional is particularly tricky and worth unit-testing.
- **Suggestion**: Add Vitest + React Testing Library unit tests for both components, covering: empty state, single item, `isFavourite` toggling, `onAdd` callback firing, and tab switching in `FoodFilterView`.
