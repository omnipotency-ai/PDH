# Agent 07 — Security & Simplification: NutritionCard.tsx

## Summary

NutritionCard.tsx is a reasonably well-structured 550-line React component. There are **no XSS vectors or critical injection risks** — no `dangerouslySetInnerHTML`, no raw HTML insertion, no eval-equivalent patterns. The main issues are in three areas: (1) a duplicate handler pair that should not exist, (2) a significant chunk of inline JSX in the `calorieDetail` view that duplicates the `CollapsedView` structure, and (3) minor type-safety and hardcoding concerns. None are critical for security, but several make the code harder to maintain and trust.

---

## Findings

### [Important]: Duplicate handlers — `handleSelectFood` and `handleAddToStaging` are identical

- **File**: `src/components/track/nutrition/NutritionCard.tsx:541–553`
- **Issue**: Two separate `useCallback` handlers (`handleSelectFood` and `handleAddToStaging`) dispatch the exact same action (`ADD_TO_STAGING`) with the same argument. They exist in parallel with no functional difference.
- **Impact**: Any future change to staging-add logic risks being made in only one place. The cognitive overhead of asking "why are there two?" creates false architectural suspicion. A reader might conclude they differ and spend time investigating.
- **Suggestion**: Delete `handleSelectFood`. Use `handleAddToStaging` everywhere (it is already the more accurately named one). The `SearchView` `onSelect` prop just needs its type/name aligned.

---

### [Important]: `calorieDetail` view duplicates `CollapsedView` JSX inline

- **File**: `src/components/track/nutrition/NutritionCard.tsx:719–761`
- **Issue**: The `calorieDetail` view branch in the main render is a manually expanded, inline version of `CollapsedView` (same `CalorieRing`, same `WaterProgressRow`, same search-input-plus-log-food-button block) with `CalorieDetailView` appended at the bottom. The "Log Food" button JSX — a `<button>` with staging badge — appears three times in the file in near-identical form (collapsed view, search view, calorie detail view).
- **Impact**: Three maintenance points for one logical button. If the button's style, label, or badge logic needs to change, all three must be updated. This is the single largest simplification opportunity in the file.
- **Suggestion**: Extract a `LogFoodButton` sub-component (takes `stagingCount`, `onClick`). Consider whether `calorieDetail` can reuse `CollapsedView` directly (passing `children` for the expansion slot) rather than inlining it. If not, at minimum extract the shared button.

---

### [Important]: Hardcoded teal color `"#42BCB8"` used in three places

- **File**: `src/components/track/nutrition/NutritionCard.tsx:183`, `201`, `664`
- **Issue**: The water/hydration color is hardcoded as a hex literal `#42BCB8` in `WaterProgressRow` (icon color, progress bar fill) and the header `Droplet` icon. No CSS token is used.
- **Impact**: Directly contradicts the project's "Design System Discipline" principle (tokenized colors only). If the design system changes the hydration color, it will need a grep across the codebase rather than a single token change. Also violates the principle of making the design intent legible through naming.
- **Suggestion**: Add a CSS custom property e.g. `--color-water` (or `--teal`) to the design token file, replace all three hardcoded instances with `var(--color-water)`.

---

### [Minor]: `handleRemoveFromStaging` does a linear scan inside the handler on each call

- **File**: `src/components/track/nutrition/NutritionCard.tsx:563–571`
- **Issue**: `handleRemoveFromStaging` and `handleUpdateStagedQuantity` (lines 563–584) both take a `canonicalName`, then do a `.find()` through `state.stagingItems` to resolve an `id` before dispatching. The reducer already holds the items by `id`. The caller (LogFoodModal) presumably could pass the `id` directly.
- **Impact**: Minor inefficiency (staging list is tiny, so not a performance concern), but the pattern leaks reducer internals upward. The component is doing work the caller shouldn't need to know about: it has to "find the id for this name" before calling the reducer, creating a mismatch between the public API (by name) and internal model (by id).
- **Suggestion**: Check whether `LogFoodModal` / `FavouritesView` could pass `id` directly. If so, remove the `.find()` indirection and let callers use the id. If the item identity is truly only known by canonical name at those call sites, document that constraint explicitly so the indirection is not a surprise.

---

### [Minor]: Escape key handler has an implicit dependency on `state.view` closure

- **File**: `src/components/track/nutrition/NutritionCard.tsx:476–485`
- **Issue**: The `useEffect` escape handler captures `state.view` in its closure via the dependency array. This is correct React, but the pattern means the listener is torn down and re-registered on every view change. Since this is a `window` listener, it adds a small but unnecessary churn on every view transition.
- **Impact**: Negligible in practice for this app. However, on a low-end device or inside a large component tree, this pattern can cause subtle timing issues (e.g., the old handler firing before the new one is registered during the same frame).
- **Suggestion**: Use a `ref` to track `state.view` inside the effect so the handler only needs to be registered once. Example: `const viewRef = useRef(state.view); viewRef.current = state.view;` then the handler reads `viewRef.current` instead of the closed-over value. Removes the `state.view` dependency and makes the listener stable.

---

### [Minor]: `FOOD_REGISTRY as FoodRegistryEntry[]` type assertion in the store

- **File**: `src/components/track/nutrition/useNutritionStore.ts:308` (referenced by NutritionCard indirectly)
- **Issue**: The Fuse index is initialized with `FOOD_REGISTRY as FoodRegistryEntry[]`. This is a `as`-cast that suppresses TypeScript's ability to verify the registry shape. If `FOOD_REGISTRY` is typed as `readonly`, a widening cast to mutable array also hides that.
- **Impact**: Low risk today (the registry is static shared data), but it sets a precedent. If `FOOD_REGISTRY` is ever partially typed or gains optional fields, the cast hides mismatches.
- **Suggestion**: Fix the source type of `FOOD_REGISTRY` so the cast is unnecessary, or use a type assertion comment explaining why it's safe. At minimum, verify `FOOD_REGISTRY` is exported with an explicit `FoodRegistryEntry[]` type from its source file.

---

### [Nice-to-have]: `headerIcons` JSX stored as a variable in render body

- **File**: `src/components/track/nutrition/NutritionCard.tsx:637–667`
- **Issue**: `headerIcons` is a JSX variable defined in the middle of the render body. This is a common React anti-pattern that bypasses React's reconciliation (the variable is re-created on every render as a new JSX object). It also makes the component harder to read because the render return is split across lines.
- **Impact**: Minor. In this case the buttons are stable (they dispatch to a stable `dispatch`), so there's no real perf issue. But it is non-idiomatic and slightly deceptive — it looks like a cached value when it isn't.
- **Suggestion**: Extract to a named sub-component `NutritionCardHeaderIcons` with `dispatch` as a prop, or inline directly into the `SectionHeader` JSX. Either is clearer than a JSX variable.

---

### [Nice-to-have]: `onFocus` no-op callback passed to `NutritionSearchInput` from `SearchView`

- **File**: `src/components/track/nutrition/NutritionCard.tsx:329–333`
- **Issue**: `SearchView` renders `NutritionSearchInput` with `onFocus={() => { /* Already in search view */ }}` — an explicit no-op with a comment explaining why it's empty.
- **Impact**: Zero. But it means `NutritionSearchInput` always requires an `onFocus` prop even when the caller has no use for it. This is an API smell.
- **Suggestion**: Make `onFocus` optional in `NutritionSearchInput` (default to a no-op inside the component). Removes the awkward empty lambda at every call site where transitioning into search view is already handled.

---

## Security Summary

No XSS vectors found. No `dangerouslySetInnerHTML`. No unsanitized user input rendered as HTML. All user-controlled strings (`entry.canonical`, `searchQuery`) are rendered as React text nodes, not HTML. No `as any` casts in NutritionCard.tsx itself. The one `as` cast lives in the store (noted above). No injection risks identified. The data path — user types in search → Fuse.js searches a static local registry → canonical name dispatched to reducer → synced to Convex via typed action — is clean.
