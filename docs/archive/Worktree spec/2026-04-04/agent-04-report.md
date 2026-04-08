# Agent 04 — Performance & Maintainability: LogFoodModal.tsx

## Summary

`LogFoodModal.tsx` is a 367-line file in good overall shape: well-structured, readable, accessibility-conscious, and correctly decomposed into sub-components. There are no critical bugs. The main concerns are a double-computation of `computeStagingTotals`, inline callback arrows that re-create on every render, a missing `useMemo` opportunity, a hand-rolled focus trap that could be replaced with a native `<dialog>`, and a few minor naming/consistency issues.

---

## Findings

### Important: `computeStagingTotals` called twice — once in modal, once in store

- **File**: `src/components/track/nutrition/LogFoodModal.tsx:232` and `src/components/track/nutrition/useNutritionStore.ts:355-358`
- **Issue**: `LogFoodModal` calls `computeStagingTotals(stagedItems)` directly on line 232, inside the render body with no memoization. `useNutritionStore` already computes and memoises `stagingTotals` (using `useMemo`) and exposes it as a return value. The caller (`NutritionCard` or similar) could pass `stagingTotals` as a prop rather than re-deriving it inside the modal.
- **Impact**: On every render the same O(n) loop runs twice. For small lists (~5 items) this is negligible today, but it is a semantic inconsistency: the store's memoised value is the canonical total; the modal's inline call is a redundant shadow. If the computation ever becomes expensive (e.g. composite foods), the duplication will silently double the cost.
- **Suggestion**: Add `totals: StagingTotals` (or rename it `stagingTotals`) to `LogFoodModalProps`, remove the inline `computeStagingTotals` call, and pass the already-memoised value from the parent. This keeps the modal as a pure display component and eliminates the duplicate calculation.

---

### Important: Inline arrow callbacks on `FoodItemRow` re-create on every render

- **File**: `src/components/track/nutrition/LogFoodModal.tsx:304-311`
- **Issue**: The list map renders `<FoodItemRow>` with `onUpdateQuantity={onUpdateQuantity}` and `onRemoveItem={onRemoveItem}` directly — both are stable props passed through from the parent, which is fine. However, inside `FoodItemRow` (lines 112 and 137), the `onClick` handlers are inline arrow functions:
  ```tsx
  onClick={() => onUpdateQuantity(item.canonicalName, item.portionG - step)}
  onClick={() => onRemoveItem(item.canonicalName)}
  ```
  Because `FoodItemRow` is not wrapped in `React.memo`, every re-render of `LogFoodModal` (e.g. on any quantity change) recreates all `FoodItemRow` instances and all their inline closures. With a list of 5–10 items this is cheap but the pattern is not scalable.
- **Impact**: Each quantity adjustment re-renders the entire list and all rows. For lists up to ~10 items (likely in this app) the cost is low, but the pattern is inconsistent with the "leave it better" principle.
- **Suggestion**: Wrap `FoodItemRow` in `React.memo`. This is safe because its props (`item`, `onUpdateQuantity`, `onRemoveItem`) are stable references or value objects. The inline arrows will still be recreated but `React.memo` will short-circuit the DOM diff for unchanged rows. Alternatively, move the `() => onUpdateQuantity(...)` binding into a `useCallback` inside `FoodItemRow` if you want full stability — but `React.memo` alone is the simpler win here.

---

### Important: Hand-rolled focus trap instead of native `<dialog>`

- **File**: `src/components/track/nutrition/LogFoodModal.tsx:180-226`
- **Issue**: The component implements a manual focus trap (keyboard event listener, `querySelectorAll` for focusable elements, Tab/Shift+Tab cycling) and manually saves/restores focus. This is 40+ lines of code that reinvents behaviour the browser's native `<dialog>` element provides for free, including `inert` on background content, built-in Escape handling, and automatic focus management.
- **Impact**: The manual implementation has a known class of bugs:
  1. The focusable-element selector (line 200) does not include `[contenteditable]`, `summary`, or elements with `tabindex="0"` on non-form elements, so future additions to the modal could silently escape the trap.
  2. The focus trap only handles Tab and Escape — pointer focus (clicking outside the modal after tabbing in) is not trapped.
  3. `querySelectorAll` runs on every keydown event, which is a live DOM query inside a hot event handler.
     The code is testable and currently correct for the existing content, but is fragile to future UI changes.
- **Suggestion**: Replace the `<div role="dialog">` with a native `<dialog>` element and call `dialogRef.current.showModal()` / `.close()` in a `useEffect`. Native `<dialog>` provides focus trapping, Escape handling, and backdrop for free. Alternatively, use a library like `@radix-ui/react-dialog` or Base UI's Dialog (already in the project's component system per `src/components/CLAUDE.md`) which wraps native dialog correctly. Either path removes ~40 lines of manual focus-trap code and eliminates the fragility class.

---

### Minor: `computeStagingTotals` is not memoised at the call site

- **File**: `src/components/track/nutrition/LogFoodModal.tsx:232`
- **Issue**: `const totals = computeStagingTotals(stagedItems)` is an unguarded call in the render body. There is no `useMemo` wrapping it. This means it runs on every render, including re-renders triggered by focus changes, hover state changes from the hover:\* Tailwind classes, or parent component re-renders.
- **Impact**: As noted above, the clean fix is to pass `totals` as a prop. If that refactor is deferred, a short-term mitigation is `const totals = useMemo(() => computeStagingTotals(stagedItems), [stagedItems])`, which prevents recomputation when only non-`stagedItems` state changes in the parent.
- **Suggestion**: Either pass `totals` as a prop (preferred) or add a `useMemo` guard.

---

### Minor: `onRemoveItem` prop uses `canonicalName` but the store's `REMOVE_FROM_STAGING` action dispatches by `id`

- **File**: `src/components/track/nutrition/LogFoodModal.tsx:25` vs `src/components/track/nutrition/useNutritionStore.ts:250-254`
- **Issue**: `LogFoodModalProps.onRemoveItem` is typed as `(canonicalName: string) => void`, but the reducer's `REMOVE_FROM_STAGING` action filters by `item.id`. The caller (parent component) must therefore translate `canonicalName → id` before dispatching, or dispatch by `canonicalName` through a different path. This is an impedance mismatch: the modal's external API uses one key, the store uses another.
- **Impact**: This is a latent confusion risk. If a future developer adds the same food twice (two staged rows with different `id`s but the same `canonicalName`), removing by `canonicalName` would be ambiguous. The store's `ADD_TO_STAGING` reducer already handles duplicates by merging portions, so in practice there is currently at most one row per `canonicalName` — but the API surface doesn't enforce or document this invariant.
- **Suggestion**: Either (a) align the prop to `(id: string) => void` and update `FoodItemRow` to call `onRemoveItem(item.id)`, or (b) document the invariant explicitly in both `LogFoodModalProps` and the reducer. Option (a) is cleaner because it removes the implicit contract.

---

### Minor: `MACRO_PILL_CONFIG` colors are duplicated from `NutritionCard`

- **File**: `src/components/track/nutrition/LogFoodModal.tsx:35-45`
- **Issue**: The comment on line 34 acknowledges this: `"Matches NutritionCard MACRO_CONFIG colors"`. The hex values are copy-pasted literals. If a color is updated in `NutritionCard`, `LogFoodModal` will silently go out of sync.
- **Impact**: Visual inconsistency between the macro pills in the staging modal and the macro pills in the nutrition card. Already a known risk — the comment is evidence the author was aware.
- **Suggestion**: Extract `MACRO_PILL_CONFIG` (or at minimum the color constants) to a shared file in the same directory (e.g. `nutritionConstants.ts` or `macroConfig.ts`) and import it in both components. This is a one-time refactor that eliminates the sync risk entirely.

---

### Minor: `capitalize` helper is a general utility defined locally

- **File**: `src/components/track/nutrition/LogFoodModal.tsx:52-54`
- **Issue**: `capitalize` is a simple, generic string utility. It likely exists elsewhere in the codebase or belongs in `src/lib/utils.ts`.
- **Impact**: Low — a few lines of duplication. Minimal risk unless the behavior needs to change (e.g. to handle multi-word names with different casing rules).
- **Suggestion**: Check `src/lib/utils.ts` or shared utilities for an existing `capitalize`. If found, remove the local definition and import the shared one. If not found, add it to `src/lib/utils.ts` so it is available project-wide.

---

### Minor: No entry animation on the modal

- **File**: `src/components/track/nutrition/LogFoodModal.tsx:236-366` (entire return block)
- **Issue**: The modal renders or does not render with a hard `if (!open) return null` gate (line 228). There is no CSS transition or animation for open/close. The backdrop has `backdrop-blur-sm` but no fade-in. The dialog panel has no slide-up or scale animation.
- **Impact**: On a calm, clinical UI for a stressed user (per product brief), abrupt modal appearance can feel jarring. This is a UX/perceived-performance issue rather than a runtime performance issue.
- **Suggestion**: Add a Tailwind `animate-in`/`animate-out` class (via `tailwindcss-animate`, which shadcn/ui typically includes) to the backdrop and dialog panel. Alternatively, keep the `open` prop and let CSS handle visibility with `data-[state=open]` transitions, which also avoids the hard unmount and preserves scroll position on re-open.

---

### Nice-to-have: `FoodItemRow` and `MacroPill` could be extracted to separate files

- **File**: `src/components/track/nutrition/LogFoodModal.tsx:82-161`
- **Issue**: `FoodItemRow` and `MacroPill` are full components with their own props interfaces, defined in the same file as the modal. They are already named and structured as standalone components.
- **Impact**: The file at 367 lines is manageable today. However, `FoodItemRow` in particular contains non-trivial logic (`getStep`, `formatPortion`, `canDecrement`). Co-location in one file makes individual unit testing slightly harder and increases the cognitive surface area when debugging.
- **Suggestion**: No immediate action needed, but consider extracting `FoodItemRow` (with its helpers `getStep`, `formatPortion`) to `FoodItemRow.tsx` and `MacroPill` to `MacroPill.tsx` within the same directory when the file grows or when tests are added. The split would improve discoverability and make unit testing each component trivial.

---

### Nice-to-have: `formatPortion` pluralisation logic is fragile

- **File**: `src/components/track/nutrition/LogFoodModal.tsx:61-70`
- **Issue**: `formatPortion` appends `"s"` for plural counts: `${unitCount} ${item.naturalUnit}${unitCount !== 1 ? "s" : ""}`. This works for regular English nouns (`slice → slices`, `egg → eggs`) but will produce incorrect output for irregular plurals (e.g. `"medium" → "mediums"`, `"loaf" → "loafs"` instead of `"loaves"`).
- **Impact**: Currently low — the naturalUnit values in FOOD_PORTION_DATA are likely all regular nouns. But this is a silent correctness gap that will surface as food data expands.
- **Suggestion**: Store an optional `naturalUnitPlural` field in `FOOD_PORTION_DATA` entries, falling back to the naive `+s` rule when absent. This is a data-level fix that does not complicate the display logic significantly.
