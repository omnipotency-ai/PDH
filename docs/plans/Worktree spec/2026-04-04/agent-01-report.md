# Agent 01 — Performance & Maintainability: NutritionCard.tsx

## Summary

NutritionCard.tsx is ~805 lines including sub-components defined in the same file. The architecture is broadly sound: a clean reducer/store separation, good memoisation in the store and data hook, and sensible splitting of concerns across sub-components. The issues below are real but not catastrophic — most are in the "important" or "minor" band. The two most actionable concerns are the duplicated JSX block in `calorieDetail` view and the pair of handlers that do identical work.

---

## Findings

### [Important]: Duplicated JSX block in calorieDetail view

- **File**: `src/components/track/nutrition/NutritionCard.tsx:719–762`
- **Issue**: The `calorieDetail` branch renders `CalorieRing`, `WaterProgressRow`, and a hand-rolled search+Log-Food row inline. This is identical markup to what `CollapsedView` already renders for those three elements — only `CalorieDetailView` is new. The duplication means future styling/behaviour changes to the collapsed search row must be applied in two places.
- **Impact**: Maintenance risk; the two surfaces will quietly diverge as features are added (e.g., the badge count logic on the Log Food button already has a subtle structural difference: `CollapsedView` always shows the button; `calorieDetail` does too but the `stagingCount` guard is identical — currently in sync but fragile).
- **Suggestion**: Extract a shared `NutritionSearchRow` sub-component (search input + Log Food button) and reuse it inside both `CollapsedView` and the `calorieDetail` div. `CollapsedView` could also accept an optional `extraContent` slot rendered below the search row, or the `calorieDetail` branch could simply render `<CollapsedView …>` with an additional child.

---

### [Important]: `handleSelectFood` and `handleAddToStaging` are identical

- **File**: `src/components/track/nutrition/NutritionCard.tsx:541–553`
- **Issue**: Both callbacks dispatch `ADD_TO_STAGING` with the same argument shape. `handleSelectFood` is passed to `SearchView` and `handleAddToStaging` is passed to `FavouritesView` and `FoodFilterView`, but the bodies are byte-for-byte the same.
- **Impact**: Any future change to staging dispatch logic must be applied twice. One of the two is clearly a redundant artefact.
- **Suggestion**: Delete `handleSelectFood` and rename `handleAddToStaging` to `handleAddToStaging` everywhere, or vice-versa. Pass the single callback to all three consumers.

---

### [Important]: `headerIcons` JSX stored as a plain variable, not a component or memoised value

- **File**: `src/components/track/nutrition/NutritionCard.tsx:637–667`
- **Issue**: `headerIcons` is declared as a `const` JSX expression inside the component body. It contains two inline arrow functions (`onClick` on the Favourites and Filter buttons) that are re-created on every render because they are not wrapped in `useCallback`. These lambdas are then used as `onClick` props on buttons inside `SectionHeader`, so every render of `NutritionCard` produces fresh function references for those two buttons.
- **Impact**: Mild — button re-renders are cheap, and React will not propagate past a button's own synthetic event boundary. However, if `SectionHeader` is ever wrapped in `React.memo`, these unstable refs will defeat the memoisation. More importantly, the pattern is inconsistent: all other handlers in the file use `useCallback`, making this an outlier that future maintainers may copy incorrectly.
- **Suggestion**: Either lift the two inline lambdas into named `useCallback` handlers (`handleOpenFavourites`, `handleOpenFoodFilter`) to match the rest of the file, or extract `headerIcons` into a small sub-component that can be independently memoised.

---

### [Important]: `handleRemoveFromStaging` and `handleUpdateStagedQuantity` scan `state.stagingItems` on every call

- **File**: `src/components/track/nutrition/NutritionCard.tsx:563–584`
- **Issue**: Both handlers do a `.find()` over `state.stagingItems` to resolve a `canonicalName` → `id` lookup before dispatching. The `useCallback` deps include `state.stagingItems`, so the callbacks are regenerated whenever any staging item changes. Downstream consumers (`LogFoodModal`) receive new function references on every staging mutation (quantity change, removal).
- **Impact**: `LogFoodModal` likely re-renders entirely after each quantity stepper interaction, even for unchanged items in the list, because its `onRemoveItem`/`onUpdateQuantity` props are always new. For small staging lists (typical use: 1–5 items) this is negligible, but it represents an avoidable pattern.
- **Suggestion**: The cleaner fix is to push the `canonicalName→id` resolution into the reducer or expose an `id`-based API from `LogFoodModal` directly, so callers dispatch by `id` rather than `canonicalName`. This removes the `state.stagingItems` dependency from both callbacks and stabilises the refs. Alternatively, `React.memo` on `LogFoodModal` with a custom comparator would contain the blast radius without changing the dispatch API.

---

### [Minor]: `useEffect` escape-key handler depends on `state.view` but calls `dispatch`; `dispatch` is stable so the dep is correct, but the guard re-attaches on every view transition

- **File**: `src/components/track/nutrition/NutritionCard.tsx:476–485`
- **Issue**: The effect re-runs (remove + re-add listener) on every `state.view` change. Because `dispatch` from `useReducer` is guaranteed stable, the only real dependency is the runtime check `state.view !== "collapsed"`. This could be written with a ref to avoid listener churn, but the current form is correct and the overhead is negligible.
- **Impact**: Negligible performance impact; worth noting as a pattern deviation from a "stable listener" idiom, but not a bug.
- **Suggestion**: Optionally, store `state.view` in a ref and read it inside the handler; the effect would then have no deps and the listener would attach once. Only worth doing if listener registration overhead becomes measurable.

---

### [Minor]: `todayKey` memo in `useNutritionData` uses `[]` deps but `getTodayMidnight()` is called at module-load time conceptually

- **File**: `src/hooks/useNutritionData.ts:94–97`
- **Issue**: `todayKey` is memoised with empty deps `[]`, meaning it is computed once per component mount and never refreshed until unmount/remount. If the component stays mounted across a midnight boundary (unlikely for a mobile-first health app, but possible on a desktop session), today's logs will be scoped to the wrong day.
- **Impact**: Low probability in practice. The app is likely navigated away and back at midnight. If it were a background-running dashboard it would be a real bug.
- **Suggestion**: Add a periodic refresh mechanism (e.g. a `useEffect` with a `setInterval` aligned to the next midnight) or simply omit the memo and compute `todayKey` inline — the `getTodayMidnight()` call is cheap (`new Date()` + bitwise ops).

---

### [Minor]: `currentMealSlot` memo in `useNutritionData` has incorrect dependency

- **File**: `src/hooks/useNutritionData.ts:145`
- **Issue**: `const currentMealSlot = useMemo(() => getCurrentMealSlot(), [todayKey]);` — `todayKey` never changes during a session (empty-dep memo above), so `currentMealSlot` is effectively computed once at mount. `getCurrentMealSlot()` presumably checks `Date.now()` against time-of-day thresholds, which means the slot will be stale if the user keeps the page open across a meal-slot boundary (breakfast → lunch, etc.).
- **Impact**: `recentFoods` falls back to `allRecentFoods` based on the stale slot. The staging default meal slot in `useNutritionStore` has the same issue (`getMealSlot(Date.now())` in `createInitialState` is called once). Minor UX degradation only.
- **Suggestion**: Make `currentMealSlot` depend on a live clock tick rather than the static `todayKey`. A lightweight `useCurrentMealSlot()` hook with a `setInterval` re-evaluating every 10–15 minutes would fix both sites.

---

### [Minor]: `NutritionSearchInput` renders Camera and Mic icons as non-interactive placeholders

- **File**: `src/components/track/nutrition/NutritionCard.tsx:228–235`
- **Issue**: Both icons have `pointer-events-none` and no associated handlers. They are positioned absolutely inside the input with `aria-hidden="true"`. The input's `pl-[4.5rem]` left-padding reserves space for them. The input has a single `aria-label="Search foods"` which correctly hides the icons from screen readers, but a user relying on a screen reader gets no indication that camera/voice features are available (even aspirationally). The icons also appear on every view where `NutritionSearchInput` is rendered, including the `calorieDetail` inline block.
- **Impact**: Accessibility ambiguity — icons that look interactive but are not; the large left padding consumes ~20% of the input width on small screens.
- **Suggestion**: Either wire the icons to actual handlers (even a `toast("Coming soon")`) or remove them until they are functional. Non-interactive decoration that looks interactive violates the design system's accessibility mandate. If placeholder intent must be communicated, a comment in code is better than phantom UI chrome.

---

### [Minor]: `SearchResultRow` calls `FOOD_PORTION_DATA.get()` on every render with no memoisation

- **File**: `src/components/track/nutrition/NutritionCard.tsx:270–271`
- **Issue**: Each row reads from a `Map` and does two arithmetic operations on render. The list is capped at 20 results. `FOOD_PORTION_DATA` is a module-level constant Map, so the `.get()` is O(1).
- **Impact**: Negligible. Flagged only for completeness. If the list ever grows beyond 20 or the component is pulled into a virtualised list, this becomes a non-issue by design.
- **Suggestion**: No action required at current scale.

---

### [Nice-to-have]: Component file is ~805 lines with 8 co-located sub-components

- **File**: `src/components/track/nutrition/NutritionCard.tsx:1–805`
- **Issue**: The file contains `CalorieRing`, `CalorieProgressBar`, `WaterProgressRow`, `NutritionSearchInput`, `SearchResultRow`, `SearchView`, `CollapsedView`, and `NutritionCard`. While each sub-component is small and clearly named, the total file length makes it hard to navigate and increases the cognitive surface area for any single change.
- **Impact**: Maintainability concern only — no runtime impact. The sub-components are pure/presentational and co-location keeps related markup together, which has real benefits. However, if a future developer needs to test `CalorieRing` or `WaterProgressRow` in isolation, they must import from a 800-line orchestrator file.
- **Suggestion**: Consider splitting presentational primitives (`CalorieRing`, `CalorieProgressBar`, `WaterProgressRow`, `NutritionSearchInput`) into a sibling `NutritionCardPrimitives.tsx` or into their own small files. `SearchResultRow` and `SearchView` could move to a `NutritionSearchView.tsx`. The main file would then be <200 lines of pure orchestration logic. This is a "leave it better" refactor, not urgent.

---

### [Nice-to-have]: No `React.memo` on any sub-component

- **File**: `src/components/track/nutrition/NutritionCard.tsx` (all sub-components)
- **Issue**: None of the sub-components (`CollapsedView`, `SearchView`, `CalorieRing`, etc.) are wrapped in `React.memo`. Since `NutritionCard` owns a `useReducer` and re-renders on every action (including transient ones like `SET_SEARCH_QUERY` on each keystroke), all sub-components re-render on every keystroke — including `CalorieRing` and `WaterProgressRow`, which only care about their numeric props.
- **Impact**: Each keystroke during search triggers a re-render of the entire subtree. For components with CSS transitions (`transition-[stroke-dashoffset]` on the ring), this is harmless because React diffs the output and the SVG attributes won't change. For a phone with a slow JS engine, it's a minor drain.
- **Suggestion**: Wrap `CalorieRing`, `WaterProgressRow`, and `CollapsedView` in `React.memo`. The search-view components intentionally depend on `searchQuery`, so they do not need it. This is low-priority polish, but pairs well with the handler-stability fix above to form a coherent performance story.

---

### [Nice-to-have]: Hard-coded teal colour `#42BCB8` repeated in two places

- **File**: `src/components/track/nutrition/NutritionCard.tsx:185, 200, 664`
- **Issue**: The water teal colour is expressed as a hex literal `#42BCB8` three times in this file (twice in `WaterProgressRow`, once in `headerIcons`). The calorie colour uses the design-token `var(--orange)` correctly.
- **Impact**: If the teal value changes, it must be updated in three places in this file alone, plus anywhere else the colour is used.
- **Suggestion**: Add `--teal` (or `--section-water`) to the design token system and replace all three literals with `var(--teal)` to match the `var(--orange)` pattern used throughout.
