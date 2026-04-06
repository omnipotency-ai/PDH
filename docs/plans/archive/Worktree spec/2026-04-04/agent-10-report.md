# Agent 10 — Security & Simplification: FavouritesView.tsx + FoodFilterView.tsx

## Summary

Both files are generally well-written, type-safe, and follow the project's "boring code" principle. No critical security issues were found. The main findings are simplification opportunities — mostly a row-component duplication and one UX inconsistency that creates confusion — plus a few minor defensive-coding notes.

---

## Findings

### Important: FavouriteRow and FoodFilterRow are near-identical and should share a base

- **Files**: `src/components/track/nutrition/FavouritesView.tsx:85–137`, `src/components/track/nutrition/FoodFilterView.tsx:218–272`
- **Issue**: `FavouriteRow` and `FoodFilterRow` are structurally identical: same layout, same className strings, same portion/calorie rendering pattern, same Add button. The only differences are (a) the heart icon is always filled and orange in `FavouriteRow`, and (b) `FoodFilterRow` accepts an `isFavourite` boolean to toggle the heart's fill state. `FavouriteRow` also uses `h-5 w-5` for the heart while `FoodFilterRow` uses `h-4 w-4` — a silent visual inconsistency.
- **Impact**: Any future change to the row layout (spacing, font weight, button style) must be applied to both components separately. The size mismatch on the heart icon is a minor but confusing UI inconsistency. This is the classic "extracted prematurely in two different places" anti-pattern.
- **Suggestion**: Merge into a single `FoodRow` component in `nutritionUtils.ts` (or a new `FoodRow.tsx`) that accepts an optional `isFavourite?: boolean` (defaulting to `true` for the favourites view, which always shows filled hearts). Delete `FavouriteRow` and replace its usage with `FoodRow`. This is a 1–2 hour refactor and eliminates the layout drift risk.

---

### Important: `frequentFoods` is a reference alias, not a computed value — this is a hidden lie

- **File**: `src/components/track/nutrition/FoodFilterView.tsx:90`
- **Issue**: `const frequentFoods = validRecentFoods;` is a direct reference assignment — not a copy, not a memoized derivation. This is fine for now since the data is read-only, but the `displayedItems` `useMemo` lists `frequentFoods` as a dependency (line 104), which will never independently trigger a re-compute because it will always be referentially identical to `validRecentFoods`. More importantly, the "Frequent" tab silently shows the same data as "Recent" with no UI indicator that it's a placeholder. Users in a post-surgical context may make food decisions based on what they believe is frequency data.
- **Impact**: Low technical risk currently, but medium product trust risk. A user who checks "Frequent" foods and sees identical data to "Recent" without explanation may be confused or make a misinformed decision.
- **Suggestion**: Either (a) add a visible inline notice on the "Frequent" tab panel — e.g., "Frequency tracking coming soon — showing recent foods for now" — or (b) remove the Frequent tab entirely until the feature is built. Given the project's AI Transparency principle ("never present inferred logic as certainty"), a user-visible note is the right call over silently showing wrong data. The `frequentFoods` alias can stay as-is technically; the fix is purely a UI disclosure.

---

### Minor: The `allFoods` list in FoodFilterView is not capped when populated, only when rendered

- **File**: `src/components/track/nutrition/FoodFilterView.tsx:59–68, 102`
- **Issue**: `allFoods` is computed in full (iterating all of `FOOD_REGISTRY`) and stored, then sliced to `MAX_ITEMS_PER_TAB` only at render time inside `displayedItems`. If `FOOD_REGISTRY` grows to thousands of entries, the full array is always held in memory for all tabs, not just when "All" is selected.
- **Impact**: Currently low risk (food registries are small), but fragile as the registry grows. The slice happens in `displayedItems` meaning the full array always exists in the closure.
- **Suggestion**: Apply the slice inside the `allFoods` memo itself: `names.sort(...); return names.slice(0, MAX_ITEMS_PER_TAB);`. This keeps the data structure honest — the variable only ever contains what's shown.

---

### Minor: Duplicate validation logic between FavouritesView and FoodFilterView

- **Files**: `src/components/track/nutrition/FavouritesView.tsx:30–32`, `src/components/track/nutrition/FoodFilterView.tsx:71–77`, `src/components/track/nutrition/FoodFilterView.tsx:79–85`
- **Issue**: The pattern `array.filter((name) => FOOD_PORTION_DATA.has(name))` appears three times across the two files. `FavouritesView` does it synchronously; `FoodFilterView` does it twice inside `useMemo` for both `validRecentFoods` and `validFavourites`.
- **Impact**: If the validation logic needs to change (e.g., a second condition for type-checking), it must be updated in three places. Low severity since `nutritionUtils.ts` already exists as the right home for this.
- **Suggestion**: Add a `filterToKnownFoods(names: string[]): string[]` helper to `nutritionUtils.ts` and call it from all three sites.

---

### Minor: `portion` and `calories` are computed per-render in FavouritesView without memoization

- **File**: `src/components/track/nutrition/FavouritesView.tsx:62–65`
- **Issue**: `formatPortion` and `getDefaultCalories` are called inline inside the `.map()` without any memoization. `FoodFilterView` passes these as props to `FoodFilterRow` computed the same way inline at lines 171–172.
- **Impact**: For the typical favourites list size (< 20 items), this is not a performance concern. However, it means the map does a `Map.get` lookup on every render rather than once. This is genuinely fine at current scale, but noting it for completeness.
- **Suggestion**: No action needed now. If lists grow to hundreds of visible items, consider computing a `displayedItems` array of `{ canonicalName, displayName, portion, calories }` objects in a single `useMemo`. Not worth doing pre-emptively.

---

### Nice-to-have: Tab buttons lack keyboard-activated `tabindex` management for proper ARIA tabs pattern

- **File**: `src/components/track/nutrition/FoodFilterView.tsx:136–153`
- **Issue**: The tab buttons use `role="tab"` and `aria-selected` correctly, but there is no `tabindex` management. In the WAI-ARIA tabs pattern, only the active tab should have `tabindex="0"`; inactive tabs should have `tabindex="-1"` and respond to arrow key navigation. As implemented, all four tabs receive focus individually via Tab key, which is technically non-conformant.
- **Impact**: The app targets post-surgical users who may have motor impairments. This is a genuine accessibility gap, though a minor one — the buttons are still keyboard-accessible, just not following the full tabs interaction model.
- **Suggestion**: Add `tabIndex={isActive ? 0 : -1}` to each tab button, and add an `onKeyDown` handler on the `tablist` div that responds to `ArrowLeft`/`ArrowRight` to move focus between tabs and activate them.

---

### Nice-to-have: Inline `style` for orange color duplicated across both files

- **Files**: `src/components/track/nutrition/FavouritesView.tsx:105, 128–130`, `src/components/track/nutrition/FoodFilterView.tsx:241, 262–264`
- **Issue**: `style={{ color: "var(--orange)" }}` and `style={{ backgroundColor: "rgba(249, 115, 22, 0.15)", color: "var(--orange)" }}` are hardcoded as inline styles in both files. The rgba value `249, 115, 22` is the RGB breakdown of the orange token, but expressed numerically rather than referencing the CSS variable.
- **Impact**: If the orange token changes, the `rgba(...)` value will drift from the actual token color. This is a design system discipline issue — the project CLAUDE.md calls out "use tokenized colors only."
- **Suggestion**: Add a CSS utility class (e.g., `.btn-add-food`) to the design system that encodes both the background-color and color using only CSS variables, so both files can reference the class name rather than inline style objects. Alternatively, expose `--orange-subtle` as a CSS variable (e.g., `color-mix(in srgb, var(--orange) 15%, transparent)`) and use `bg-[var(--orange-subtle)]` in Tailwind.

---

## No Issues Found

- **Type safety**: No `any` casts, no `as` type assertions, no `@ts-ignore`. All props are fully typed with explicit interfaces.
- **Unsafe array access**: No unchecked indexed access. The `FOOD_PORTION_DATA.get()` pattern correctly handles the undefined case with early returns in both utility functions.
- **User data rendering**: `displayName` values are passed through `titleCase()` (a simple string transform) before rendering. No raw HTML, no `dangerouslySetInnerHTML`. `canonicalName` values come from a static data map, not from user-supplied input. XSS surface is effectively zero.
- **Over-engineering**: Tab/filter logic in `FoodFilterView` is appropriately simple — a `useState` + `switch` in `useMemo`. No unnecessary abstraction layers. The `TABS` constant array is the right level of configuration for 4 static tabs.
- **useMemo usage**: All three `useMemo` calls in `FoodFilterView` are justified — `allFoods` is expensive on large registries, and `validRecentFoods`/`validFavourites`/`favouriteSet` memoize array/set derivations that would otherwise re-run on every keystroke if the parent re-renders. `FavouritesView` omits memoization entirely, which is appropriate for its simpler structure.
