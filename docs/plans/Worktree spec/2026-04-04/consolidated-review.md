# Consolidated Review — Wave 2 Nutrition Card

12 sonnet agents reviewed all nutrition card files. This report deduplicates findings across agents and orders them by priority (critical → important → minor → nice-to-have). No findings were eliminated or reranked.

**Agents 1-6:** Performance & Maintainability
**Agents 7-12:** Security & Simplification

---

## MINOR

### 37. `useEffect` escape-key handler re-attaches on every view transition

- **File**: `src/components/track/nutrition/NutritionCard.tsx:476-485`
- **Agents**: 1, 7
- **Issue**: The `useEffect` for Escape key captures `state.view` in its dependency array, causing the listener to be torn down and re-registered on every view transition. `dispatch` from `useReducer` is stable, so the only real dependency is the runtime check `state.view !== "collapsed"`. On low-end devices or large component trees, this churn can cause subtle timing issues (old handler firing before new one registers in the same frame).
- **Suggestion**: Store `state.view` in a ref and read it inside the handler so the listener is registered once: `const viewRef = useRef(state.view); viewRef.current = state.view;` — handler reads `viewRef.current` instead of closed-over value. Removes the `state.view` dependency and makes the listener stable for the component lifetime.

### 38. Camera/Mic icons are non-interactive placeholder chrome

- **File**: `src/components/track/nutrition/NutritionCard.tsx:228-235`
- **Agents**: 1
- **Issue**: Both icons have `pointer-events-none` and no associated handlers, positioned absolutely inside the search input with `aria-hidden="true"`. The input's `pl-[4.5rem]` left-padding reserves ~20% of input width for them on small screens. A screen reader user gets no indication these features exist (even aspirationally). Non-interactive decoration that looks interactive violates the design system's accessibility mandate.
- **Suggestion**: Either wire the icons to actual handlers (even `toast("Coming soon — camera/voice logging is planned")`) with appropriate `aria-label` and `role="button"`, or remove them entirely until functional. Non-interactive UI chrome that resembles interactive elements is worse than no chrome. If placeholder intent must be communicated, a comment in code is better than phantom UI.

### 39. `color` and `dotColor` in `MEAL_SLOT_CONFIG` are always identical

- **File**: `src/components/track/nutrition/CalorieDetailView.tsx:40-75`
- **Agents**: 2, 8
- **Issue**: Redundant fields implying a distinction that doesn't exist.
- **Suggestion**: Collapse to single `color` field.

### 40. Accordion expand/collapse uses conditional rendering, not CSS animation

- **File**: `src/components/track/nutrition/CalorieDetailView.tsx:324`
- **Issue**: The expanded food-item list is rendered with a plain `{isOpen && hasEntries && (...)}` guard. There is no height transition or fade — the content appears and disappears instantaneously.
- **Impact**: The bar segments have a `transition-[width] duration-500 ease-out` animation (line 171), but the accordion has none. This inconsistency is jarring in a UI that otherwise values calm, progressive disclosure. The `transition-colors` on the header button (line 267) compounds the contrast.
- **Suggestion**: Wrap the expanded content in a CSS grid-row trick (`grid-rows-[0fr] / grid-rows-[1fr]` toggle) or a `max-height` transition to produce a smooth open/close animation. Avoid JS-driven height measurement — the CSS approach is GPU-composited and avoids layout thrash.

### 41. Array index in React key for food items

- **File**: `src/components/track/nutrition/CalorieDetailView.tsx:327-332`
- **Agents**: 2, 8
- **Issue**: Food item rows use `key={\`${log.id}-${idx}\`}`where`idx`is the position within a single log's`items` array. If items within a log are ever reordered (e.g. by a server-side normalisation) or an item is deleted from the middle, siblings shift index and React reuses the wrong DOM node — potentially showing stale rendered state. Delete is a supported action (`onDeleteLog`), making this a realistic scenario.
- **Suggestion**: Use `key={\`${log.id}-${item.canonicalName ?? item.parsedName ?? item.name ?? idx}\`}`as a more stable key. If`FoodItem`ever gains a stable`id` field, use that exclusively.

### 42. `capitalize` utility defined locally in multiple files

- **File**: `CalorieDetailView.tsx:108-110`, `LogFoodModal.tsx:52-54`
- **Agents**: 2, 4, 8
- **Issue**: Same one-liner string utility duplicated. Likely exists or belongs in `src/lib/utils.ts`.
- **Suggestion**: Centralize in `src/lib/stringUtils.ts`.

### 43. `getDisplayName`/`getFoodItems` not tested in isolation

- **File**: `src/components/track/nutrition/CalorieDetailView.tsx:93-105`
- **Agents**: 2
- **Issue**: `getDisplayName` has a four-property fallback chain (`canonicalName` → `parsedName` → `name` → `userSegment` → `"Unknown food"`), all accessed via `Record<string, any>` with `biome-ignore` suppressions. `getFoodItems` uses `Array.isArray(log.data?.items)` as a guard. Neither has unit tests — the fallback chains are subtle and would silently return "Unknown food" if the data shape shifts.
- **Suggestion**: Move both helpers (along with `getItemMacros`) to `nutritionUtils.ts`, replace `any` with `FoodItem`, and add unit tests covering: all fallback paths, missing fields, empty items arrays, and malformed log shapes.

### 44. SVG ring inlined in WaterModal (~45 lines)

- **File**: `src/components/track/nutrition/WaterModal.tsx:211-255`
- **Agents**: 3
- **Issue**: The circular progress ring (background circle + progress arc + centred text overlay) is 45+ lines of JSX with no internal state or side effects. It takes five derived props (`projectedTotal`, `goalMl`, `strokeDashoffset`, `percentOfGoal`, `goalReached`). Unit testing ring rendering requires mounting the entire modal with all its focus-trap and Convex wiring. The SVG math constants (`RING_SIZE`, `RING_RADIUS`, `RING_CIRCUMFERENCE`) are co-located with modal keyboard logic.
- **Suggestion**: Extract a `<CircularProgressRing>` component (or `<WaterRing>`) accepting `value`, `goal`, and `color` props, owning the SVG math. This is the highest-value maintainability improvement in the file — enables reuse for calories/activity rings and isolated testing.

### 45. Modal `if (!open) return null` prevents animated entry/exit

- **File**: `WaterModal.tsx:152`, `LogFoodModal.tsx:228`
- **Agents**: 3, 4
- **Issue**: Both modals fully unmount when `open` is false (early return `null`). Every open incurs full DOM creation. More importantly, exit animations are impossible with mount/unmount — the component is gone before any CSS transition can play. The decision docs hint at "prefill animation: A" suggesting animations are desired.
- **Suggestion**: No immediate action — document the constraint. If animated entry/exit is added in a future wave, switch to a CSS `opacity`/`transform` approach with the modal always mounted but visually hidden when `open` is false. Alternatively, use `AnimatePresence` from Framer Motion or Tailwind's `data-[state=open]` transitions. Note: WaterModal may already be handled by Base UI Dialog after #21 fix.

### 46. Focus trap queries DOM on every keydown

- **File**: `src/components/track/nutrition/WaterModal.tsx:104-110`
- **Agents**: 3
- **Issue**: `querySelectorAll` on every Tab press. Node list never changes while modal is open.
- **Suggestion**: Cache focusable list in ref on modal open.

### 47. `MACRO_PILL_CONFIG` colors copy-pasted from NutritionCard

- **File**: `src/components/track/nutrition/LogFoodModal.tsx:35-45`
- **Agents**: 4
- **Issue**: Comment on line 34 acknowledges duplication: `"Matches NutritionCard MACRO_CONFIG colors"`. The hex values for protein, carbs, fat, sugars, fibre are copy-pasted literals. If a color is updated in NutritionCard's `MACRO_CONFIG`, LogFoodModal will silently go out of sync — visual inconsistency between the macro pills in staging modal vs. nutrition card.
- **Suggestion**: Extract `MACRO_PILL_CONFIG` (or at minimum the color constants) to a shared `nutritionConstants.ts` file in the same directory and import in both components. One-time refactor that eliminates the sync risk entirely.

### 48. No entry/exit animation on LogFoodModal

- **File**: `src/components/track/nutrition/LogFoodModal.tsx:236-366`
- **Agents**: 4
- **Issue**: The modal renders or does not render with a hard `if (!open) return null` gate. No CSS transition or animation for open/close. The backdrop has `backdrop-blur-sm` but no fade-in. The dialog panel has no slide-up or scale animation. On a calm, clinical UI for a stressed user, abrupt modal appearance can feel jarring.
- **Suggestion**: Add Tailwind `animate-in`/`animate-out` classes (via `tailwindcss-animate`, which shadcn/ui typically includes) to the backdrop and dialog panel. Alternatively, keep the `open` prop and let CSS handle visibility with `data-[state=open]` transitions. When #21 converts this to Base UI Dialog, animation can be handled by Base UI's built-in transition support.

### 49. `frequentFoods` alias mutable reference — implicit dependency identity

- **File**: `src/components/track/nutrition/FoodFilterView.tsx:90`
- **Agents**: 5
- **Issue**: When frequency tracking is implemented, replacement must be wrapped in `useMemo`.
- **Suggestion**: Comment noting the dependency implication.

### 50. Tab panel `aria-label` computed with `TABS.find()` on every render

- **File**: `src/components/track/nutrition/FoodFilterView.tsx:160`
- **Agents**: 5
- **Issue**: Linear search through 4 items per render. Negligible but unnecessary.
- **Suggestion**: Derive `activeTabLabel` constant once in component.

### 51. No `React.memo` or `useCallback` on Favourites/Filter row components

- **File**: `FavouritesView.tsx:85`, `FoodFilterView.tsx:218`
- **Agents**: 5
- **Issue**: Plain function components with no memoization. Re-render on every parent tick.
- **Suggestion**: Wrap in `React.memo`. Only meaningful if `onAdd` is also stabilized.

### 52. `FavouritesView` has no `useMemo` on `validFavourites`

- **File**: `src/components/track/nutrition/FavouritesView.tsx:30-32`
- **Agents**: 5
- **Issue**: FoodFilterView memoizes the equivalent filter; FavouritesView does not. Inconsistent.
- **Suggestion**: Add `useMemo` to match FoodFilterView pattern.

### 53. `caloriesByMealSlot` iterates via four separate `calculateTotalCalories` calls

- **File**: `src/hooks/useNutritionData.ts:131-143`
- **Agents**: 6
- **Issue**: Groups by slot (one pass), then four separate function calls. Readable but slightly redundant.
- **Suggestion**: Keep as-is unless profiling shows hot path. Could fold into single accumulation.

### 54. Redundant guard on accordion button click

- **File**: `src/components/track/nutrition/CalorieDetailView.tsx:268-270`
- **Agents**: 8
- **Issue**: `disabled={!hasEntries}` prevents click, but handler also checks `if (hasEntries)`. Dead code.
- **Suggestion**: Remove the guard from onClick handler.

### 55. `useNutritionGoals` spreads `profile.nutritionGoals` flat into return

- **File**: `src/hooks/useProfile.ts:224-229`
- **Agents**: 12
- **Issue**: The hook returns `{ ...profile.nutritionGoals, setNutritionGoals }`, spreading the object's fields flat. `NutritionGoals` has two fields (`dailyCalorieGoal`, `dailyWaterGoalMl`). The return type is implicitly `NutritionGoals & { setNutritionGoals }` — not explicitly annotated, so callers destructure relying on implicit spread. `useNutritionData.ts:90` does exactly this: `{ dailyCalorieGoal, dailyWaterGoalMl }`. If `NutritionGoals` gains fields, callers automatically get them without visibility.
- **Suggestion**: Either add an explicit return type annotation, or return goals as a named nested property: `{ goals: profile.nutritionGoals, setNutritionGoals }` to make the API surface explicit and discoverable.

### 56. `useMemo` wrapping return values in every `useProfile.ts` hook

- **File**: `src/hooks/useProfile.ts` (throughout)
- **Agents**: 12
- **Issue**: ProfileContext already provides reference stability via JSON comparison. The leaf-hook memos add a redundant second layer.
- **Suggestion**: Remove memos from simpler hooks. Defensible in hooks returning callback arrays.

### 57. `useHealthProfile` uses `as HealthProfile` cast on partial spread

- **File**: `src/hooks/useProfile.ts:88-89`
- **Agents**: 12
- **Issue**: `setHealthProfile` merges `{ ...profile.healthProfile, ...updates }` where `updates: Partial<HealthProfile>`, then asserts the result `as HealthProfile` without checking required fields are present. If `profile.healthProfile` ever has optional fields that are undefined and `updates` does not supply them, the cast silently sends an incomplete object to `patchProfile`. The `ProfileContext` applies defaults via `resolveProfile` so this rarely fires in practice — but the cast is a soundness gap that hides genuine mismatches.
- **Suggestion**: If `HealthProfile` has required fields, document them and check at runtime. If all fields are optional, reflect that in the type definition so the cast is unnecessary. Removing the cast and letting TypeScript infer the type directly would surface any genuine mismatch at compile time.

### 58. Fuse.js no upper-bound query length guard

- **File**: `src/components/track/nutrition/useNutritionStore.ts:321-325`
- **Agents**: 11
- **Issue**: No security issue (local static data), but extremely long pasted strings could cause jank.
- **Suggestion**: Add `query.trim().length > 100` early-return guard.

### 59. SVG `transition` inline style inconsistent with Tailwind approach

- **File**: `src/components/track/nutrition/WaterModal.tsx:240`
- **Agents**: 3
- **Issue**: `style={{ transition: "stroke-dashoffset 0.4s ease" }}` — technically necessary for SVG, but asymmetric with rest of file's Tailwind usage.
- **Suggestion**: Add comment explaining SVG constraint.

### 60. `recentFoods` fallback assignment outside all memos

- **File**: `src/hooks/useNutritionData.ts:194-195`
- **Agents**: 6
- **Issue**: Ternary returns stable references (correct), but easy to misread as producing new reference.
- **Suggestion**: Add inline comment or wrap in `useMemo` for explicitness.

### 61. Inline `rgba(249, 115, 22, 0.15)` bypasses design token

- **File**: `FavouritesView.tsx:105,128-130`, `FoodFilterView.tsx:241,262-264`
- **Agents**: 10
- **Issue**: `style={{ backgroundColor: "rgba(249, 115, 22, 0.15)", color: "var(--orange)" }}` — the rgba value `249, 115, 22` is the RGB breakdown of the orange token, but expressed numerically rather than referencing the CSS variable. If the orange token changes, the `rgba(...)` will drift from the actual token color. Violates "tokenized colors only" principle from CLAUDE.md.
- **Suggestion**: Add a CSS utility class (e.g. `.btn-add-food { background-color: color-mix(in srgb, var(--orange) 15%, transparent); color: var(--orange); }`) to the design system. Both files reference the class name rather than inline style objects. Alternatively, expose `--orange-subtle` as a CSS variable and use `bg-[var(--orange-subtle)]` in Tailwind.

---

## NICE-TO-HAVE

### 62. NutritionCard.tsx is ~805 lines with 8 co-located sub-components

- **File**: `src/components/track/nutrition/NutritionCard.tsx`
- **Agents**: 1
- **Issue**: The file contains `CalorieRing`, `CalorieProgressBar`, `WaterProgressRow`, `NutritionSearchInput`, `SearchResultRow`, `SearchView`, `CollapsedView`, and `NutritionCard`. Each sub-component is small and clearly named, but total file length makes it hard to navigate. If a developer needs to test `CalorieRing` or `WaterProgressRow` in isolation, they must import from an 800-line orchestrator file.
- **Suggestion**: Split presentational primitives (`CalorieRing`, `CalorieProgressBar`, `WaterProgressRow`, `NutritionSearchInput`) into `NutritionCardPrimitives.tsx`. `SearchResultRow` and `SearchView` could move to `NutritionSearchView.tsx`. Main file becomes <200 lines of pure orchestration logic. This is a "leave it better" refactor, not urgent.

### 63. No `React.memo` on any NutritionCard sub-component

- **File**: `src/components/track/nutrition/NutritionCard.tsx`
- **Agents**: 1
- **Issue**: `NutritionCard` owns a `useReducer` and re-renders on every action (including `SET_SEARCH_QUERY` on each keystroke). All sub-components re-render on every keystroke — including `CalorieRing` and `WaterProgressRow`, which only care about their numeric props. For components with CSS transitions (`transition-[stroke-dashoffset]` on the ring), React diffs the output and SVG attributes won't change — so it's harmless. On a phone with a slow JS engine, it's a minor drain.
- **Suggestion**: Wrap `CalorieRing`, `WaterProgressRow`, and `CollapsedView` in `React.memo`. Search-view components intentionally depend on `searchQuery` so they do not need it. Pairs well with the handler-stability fix (#15, #17) to form a coherent performance story.

### 64. `MealBreakdownBar` total not memoized

- **File**: `src/components/track/nutrition/CalorieDetailView.tsx:154-157`
- **Agents**: 2
- **Issue**: Negligible at 4 items.
- **Suggestion**: Wrap in `React.memo`.

### 65. Time strings in `MEAL_SLOT_CONFIG` don't derive from `getMealSlot` boundaries

- **File**: `src/components/track/nutrition/CalorieDetailView.tsx:50-74`
- **Agents**: 2
- **Issue**: The `time` field (e.g. `"07:00"` for breakfast) is a hardcoded display string, not derived from the actual slot boundaries defined in `getMealSlot` (`nutritionUtils.ts`). The slot boundary is 5am for breakfast, but the display shows `"07:00"`. If slot boundaries change (a reasonable future scenario as the user's digestion patterns evolve), the displayed times will be wrong with no TypeScript error to catch it.
- **Suggestion**: Either (a) derive the display time programmatically from the `MEAL_SLOT_BOUNDARIES` constant (after #2 fix creates it), or (b) add a cross-reference comment: `// Display time — actual slot boundary is defined in MEAL_SLOT_BOUNDARIES in nutritionUtils.ts` so future maintainers know to update both.

### 66. Magic number 50ms focus delay — `requestAnimationFrame` is more correct

- **File**: `src/components/track/nutrition/WaterModal.tsx:72`
- **Agents**: 3
- **Issue**: `setTimeout(() => closeButtonRef.current?.focus(), 50)` uses an undocumented 50ms delay. The comment says "ensure the modal is rendered" but this is a heuristic, not a guaranteed mechanism. On slow devices 50ms may not be enough; on fast devices it's unnecessary. Note: may be resolved by #21 Base UI Dialog migration which handles initial focus natively.
- **Suggestion**: Replace with `requestAnimationFrame(() => closeButtonRef.current?.focus())` — guarantees focus happens after paint without an arbitrary timer.

### 67. LogFoodModal focus-restore 0ms `setTimeout` unnecessary

- **File**: `src/components/track/nutrition/LogFoodModal.tsx:187-189`
- **Agents**: 9
- **Issue**: `setTimeout(() => { dialogRef.current?.focus(); }, 0)` uses a 0ms timeout that is unnecessary — the dialog has `tabIndex={-1}` and is conditionally rendered (`if (!open) return null` runs before this effect), meaning the dialog is already in the DOM when the effect fires. The `clearTimeout(timer)` cleanup adds complexity for no benefit.
- **Suggestion**: Replace with direct `dialogRef.current?.focus()` and remove the `clearTimeout` cleanup. When #21 converts this to Base UI Dialog, auto-focus is handled natively.

### 68. `FoodItemRow` and `MacroPill` could be extracted to own files

- **File**: `src/components/track/nutrition/LogFoodModal.tsx:82-161`
- **Agents**: 4
- **Suggestion**: Extract when file grows or tests added.

### 69. `formatPortion` pluralisation uses naive `+s` — fails on irregular plurals

- **File**: `src/components/track/nutrition/LogFoodModal.tsx:61-70`
- **Agents**: 4
- **Issue**: `formatPortion` appends `"s"` for plural counts: `${unitCount} ${item.naturalUnit}${unitCount !== 1 ? "s" : ""}`. Works for regular nouns (`slice → slices`, `egg → eggs`) but produces incorrect output for irregulars (e.g. `"medium" → "mediums"`, `"loaf" → "loafs"` instead of `"loaves"`). Currently low risk because naturalUnit values in FOOD_PORTION_DATA are likely all regular, but will surface as food data expands.
- **Suggestion**: Store an optional `naturalUnitPlural` field in `FOOD_PORTION_DATA` entries (e.g. `{ naturalUnit: "loaf", naturalUnitPlural: "loaves" }`), falling back to the naive `+s` rule when absent. This is a data-level fix that does not complicate the display logic.

### 70. Shared `portion + " . " + calories` format string duplicated in both row components

- **File**: `FavouritesView.tsx:118-119`, `FoodFilterView.tsx:253-255`
- **Agents**: 5
- **Suggestion**: Extract `formatPortionCalories()` utility.

### 71. No unit tests for FavouritesView or FoodFilterView

- **File**: `src/components/track/nutrition/`
- **Agents**: 5
- **Issue**: The `__tests__` directory contains only `useNutritionStore.test.ts`. Neither view has unit tests — only E2E coverage via Playwright. The row rendering logic for the `portion · calories` conditional is particularly tricky and worth unit-testing. Future refactoring (e.g. extracting `FoodRow` in #24) carries higher regression risk without unit tests.
- **Suggestion**: Add Vitest + React Testing Library unit tests covering: empty state, single item, `isFavourite` toggling, `onAdd` callback firing, tab switching in `FoodFilterView`, and edge cases (invalid canonical names, names not in FOOD_PORTION_DATA).

### 72. Store hook returns `state` as whole object — broad re-renders

- **File**: `src/components/track/nutrition/useNutritionStore.ts:360-367`
- **Agents**: 6
- **Issue**: `useNutritionStore()` returns `{ state, dispatch, searchResults, stagingTotals, stagingCount }`. Consumers that only need `state.view` (e.g. header collapse logic) still receive the entire state and re-render whenever any field changes, including `searchQuery` updates on each keystroke. In React 18 with concurrent scheduler this is often batched, but can cause perceptible flicker on lower-end devices.
- **Suggestion**: Either (a) export a selector pattern (e.g. `useNutritionStoreSelector(selector)`) mirroring Zustand's API, or (b) split into `useNutritionView()`, `useNutritionSearch()`, `useNutritionStaging()` to allow components to subscribe to only what they need. This is an architectural decision — only matters once profiling reveals excessive re-renders.

### 73. `createInitialState` calls `getMealSlot(Date.now())` — flaky in tests

- **File**: `src/components/track/nutrition/useNutritionStore.ts:329-339`
- **Agents**: 6
- **Issue**: The lazy initialiser for `useReducer` calls `getMealSlot(Date.now())` once. In tests this produces a time-sensitive default that varies depending on when the test runs, making test behaviour non-deterministic unless the test mocks `Date.now`.
- **Suggestion**: Accept an optional `initialSlot` parameter in `createInitialState` (defaulting to `getMealSlot(Date.now())`) so tests can inject a fixed slot without mocking the global clock. Example: `createInitialState(initialSlot?: MealSlot)`.

### 74. Module-level Fuse index constructed at import time

- **File**: `src/components/track/nutrition/useNutritionStore.ts:307-314`
- **Agents**: 6
- **Issue**: Correct for 148 entries. Blocks main thread if registry grows.
- **Suggestion**: Add comment documenting intentional placement.

### 75. `headerIcons` JSX as render-body variable (non-idiomatic)

- **File**: `src/components/track/nutrition/NutritionCard.tsx:637-667`
- **Agents**: 7
- **Issue**: `headerIcons` is a `const` JSX expression defined in the middle of the render body. This is a common React anti-pattern — the variable is re-created on every render as a new JSX object, bypassing React's reconciliation. It looks like a cached value when it isn't. Also makes the component harder to read because the render return is split across lines.
- **Suggestion**: Extract to a named sub-component `NutritionCardHeaderIcons` with `dispatch` as a prop, or inline directly into the `SectionHeader` JSX. Either is clearer than a JSX variable.

### 76. `onFocus` no-op callback passed to `NutritionSearchInput` from SearchView

- **File**: `src/components/track/nutrition/NutritionCard.tsx:329-333`
- **Agents**: 7
- **Issue**: `SearchView` renders `NutritionSearchInput` with `onFocus={() => { /* Already in search view */ }}` — an explicit no-op with a comment. This means `NutritionSearchInput` always requires an `onFocus` prop even when the caller has no use for it. API smell that creates awkward empty lambdas at every call site.
- **Suggestion**: Make `onFocus` optional in `NutritionSearchInput` (default to a no-op inside the component). Removes the awkward empty lambda at every call site where transitioning into search view is already handled.

### 77. Tab ARIA pattern incomplete — missing `tabindex` management and arrow-key nav

- **File**: `src/components/track/nutrition/FoodFilterView.tsx:136-153`
- **Agents**: 10
- **Issue**: Tab buttons use `role="tab"` and `aria-selected` correctly, but there is no `tabindex` management. In the WAI-ARIA tabs pattern, only the active tab should have `tabindex="0"`; inactive tabs should have `tabindex="-1"` and respond to arrow key navigation. As implemented, all four tabs receive focus individually via Tab key — technically non-conformant. The app targets post-surgical users who may have motor impairments, making this a genuine accessibility gap.
- **Suggestion**: Add `tabIndex={isActive ? 0 : -1}` to each tab button, and add an `onKeyDown` handler on the `tablist` div that responds to `ArrowLeft`/`ArrowRight` to move focus between tabs and activate them. Reference: WAI-ARIA Authoring Practices — Tabs pattern.

### 78. Hardcoded hex colors in CalorieDetailView config should use design tokens

- **File**: `src/components/track/nutrition/CalorieDetailView.tsx:58-88`
- **Agents**: 8
- **Issue**: Breakfast uses `var(--orange)` but other slots use hardcoded hex. Inconsistent.
- **Suggestion**: Convert all to CSS custom properties.

### 79. `createStagedItem` uses `canonicalName` as `displayName` with no transformation

- **File**: `src/components/track/nutrition/useNutritionStore.ts:147`
- **Agents**: 11
- **Issue**: `displayName: canonicalName` — the display name is the same raw string used as a registry key (e.g. `"chicken_breast_raw"`). Downstream components calling `titleCase(item.displayName)` will get `"Chicken_breast_raw"` — only the first letter capitalised, underscores preserved. This is a current rendering defect visible in the staging modal.
- **Suggestion**: Either (a) apply `titleCase(canonicalName.replace(/_/g, " "))` in `createStagedItem` so every consumer gets a correctly formatted name, or (b) look up a proper `label` field from `FOOD_REGISTRY` if one exists. Centralising this in the store ensures every consumer gets a clean display name without each component defending itself.

### 80. `generateStagingId` is a one-liner used once

- **File**: `src/components/track/nutrition/useNutritionStore.ts:99-101`
- **Agents**: 11
- **Suggestion**: Inline or add comment explaining prefix purpose.

### 81. `todayKey` number→string→number round-trip serves no purpose

- **File**: `src/hooks/useNutritionData.ts:94-101`
- **Agents**: 12
- **Suggestion**: Store as `number` directly, or remove `todayKey` entirely (see finding #3).

### 82. Early-exit condition in recent foods loop — misleading comment

- **File**: `src/hooks/useNutritionData.ts:183-184`
- **Agents**: 12
- **Issue**: Comment says "Early exit once both lists are full" but `slotResult` rarely reaches 50.
- **Suggestion**: Clarify comment. Replace indexed `for` with `for...of`.

### 83. SVG ring constants scattered across file header

- **File**: `src/components/track/nutrition/WaterModal.tsx:24-27`
- **Agents**: 9
- **Suggestion**: Cosmetic. Group into single object if desired.

### 84. `SearchResultRow` `FOOD_PORTION_DATA.get()` per render

- **File**: `src/components/track/nutrition/NutritionCard.tsx:270-271`
- **Agents**: 1
- **Issue**: O(1) Map.get() on 20 items. Negligible.
- **Suggestion**: No action needed.

---

## Summary Statistics

| Priority                  | Count  |
| ------------------------- | ------ |
| Minor                     | 25     |
| Nice-to-have              | 23     |
