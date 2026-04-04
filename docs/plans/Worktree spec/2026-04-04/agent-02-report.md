# Agent 02 — Performance & Maintainability: CalorieDetailView.tsx

## Findings

### Important: getItemMacros duplicates logic already in nutritionUtils.ts

- **File**: `src/components/track/nutrition/CalorieDetailView.tsx:123-145`
- **Issue**: `getItemMacros` reimplements the same per-item macro calculation (portion scaling, rounding) that `calculateTotalMacros` and its internal `getEffectivePortionG` already do in `src/lib/nutritionUtils.ts`. The component even re-imports `FOOD_PORTION_DATA` directly (line 13) rather than relying on the shared utility layer.
- **Impact**: Any bug fix or change to the macro calculation algorithm must be made in two places. Already produces a subtle discrepancy: `getItemMacros` uses `item.quantity` directly (no type guard beyond `> 0`), while `getEffectivePortionG` in nutritionUtils additionally falls back to `portionData.defaultPortionG` when no quantity is present. The two paths can therefore produce different numbers for the same item.
- **Suggestion**: Extract a `getItemMacros(item: FoodItem)` pure function into `nutritionUtils.ts` (or a thin `itemMacros.ts` helper), import it here, and delete the local copy. The `getEffectivePortionG` private helper in nutritionUtils should become the canonical portion-resolution path.

---

### Important: Inline `onToggle` arrow function creates a new reference on every render

- **File**: `src/components/track/nutrition/CalorieDetailView.tsx:398-400`
- **Issue**: The `onToggle` prop passed to each `MealSlotAccordion` is defined as an inline arrow function inside the `MEAL_SLOT_CONFIG.map(...)` call:
  ```tsx
  onToggle={() => setOpenSlot(openSlot === config.slot ? null : config.slot)}
  ```
  This creates a new function reference on every render of `CalorieDetailView`, which means all four `MealSlotAccordion` instances always receive a new `onToggle` prop, defeating any future `React.memo` wrapping.
- **Impact**: Low right now because `MealSlotAccordion` is not memoized, so the extra allocation is harmless. But it is a latent bug: if `MealSlotAccordion` is later wrapped in `memo` (a reasonable optimisation given it renders food item lists), it will still re-render unnecessarily on every parent render. The pattern also obscures intent — it is not obvious at a glance that each accordion gets a slot-specific toggle.
- **Suggestion**: Either (a) pass `setOpenSlot` and `config.slot` as separate props so the stable `setOpenSlot` setter is used directly inside the child, or (b) wrap the four toggles in `useMemo` / `useCallback` keyed by slot. Option (a) is simpler and avoids the closure entirely.

---

### Important: `logsByMealSlot` prop cast silently loses type safety

- **File**: `src/components/track/nutrition/CalorieDetailView.tsx:395`
- **Issue**: The prop is typed `Record<MealSlot, SyncedLog[]>` on the interface (line 33) but is cast with `as FoodPipelineLog[]` at the point of use inside the render:
  ```tsx
  logs={logsByMealSlot[config.slot] as FoodPipelineLog[]}
  ```
  This means non-food/liquid logs (e.g. `type: "fluid"`) would slip through silently if the caller passes mixed logs. The narrowing is deferred to the cast rather than enforced structurally.
- **Impact**: Potential runtime crash or silent wrong data if the parent ever passes logs that include non-food types. Also makes the intent of the props contract ambiguous — callers cannot tell from the interface that only food/liquid logs are expected.
- **Suggestion**: Change the prop type on the interface to `Record<MealSlot, FoodPipelineLog[]>` (or export `FoodPipelineLog` from a shared types file and use it throughout). The parent (`NutritionCard`) already has access to `logsByMealSlot` from `useNutritionData` and can filter there, which is the correct place to enforce the constraint.

---

### Important: `itemCount` recomputed on every render inside MealSlotAccordion, including when closed

- **File**: `src/components/track/nutrition/CalorieDetailView.tsx:253-256`
- **Issue**: Every render of `MealSlotAccordion` (including when the accordion is collapsed) calls `logs.reduce(...)` followed by `getFoodItems(log)` which calls `Array.isArray(log.data?.items)`. For slots with many logs this is O(n items) work done every time the parent re-renders.
- **Impact**: Minimal with current data volumes (post-surgical patients log modestly), but will degrade noticeably if `logsByMealSlot` changes frequently (e.g. on every Convex subscription tick) and a slot has tens of logs. The work is also wasted for the three closed slots.
- **Suggestion**: Memoize `MealSlotAccordion` with `React.memo`. The `itemCount` derivation is cheap to hoist into a `useMemo` inside the component, gated on `logs` identity. This also makes the memo bail-out effective when `logs` reference is stable.

---

### Minor: `color` and `dotColor` in MEAL_SLOT_CONFIG are always identical

- **File**: `src/components/track/nutrition/CalorieDetailView.tsx:40-75`
- **Issue**: Every entry in `MEAL_SLOT_CONFIG` has `color` and `dotColor` set to the same value (e.g. both `"var(--orange)"`). The two fields serve different rendering purposes (bar segment vs legend dot) but carry no distinct information.
- **Impact**: Not a bug, but unnecessarily verbose configuration that implies a distinction that does not currently exist. A future maintainer might wonder if the values are supposed to differ and make an incorrect assumption.
- **Suggestion**: Collapse to a single `color` field. If the design ever needs separate bar vs dot colors, re-add `dotColor` at that point.

---

### Minor: Accordion expand/collapse uses conditional rendering, not CSS animation

- **File**: `src/components/track/nutrition/CalorieDetailView.tsx:324`
- **Issue**: The expanded food-item list is rendered with a plain `{isOpen && hasEntries && (...)}` guard. There is no height transition or fade — the content appears and disappears instantaneously.
- **Impact**: The bar segments have a `transition-[width] duration-500 ease-out` animation (line 171), but the accordion has none. This inconsistency is jarring in a UI that otherwise values calm, progressive disclosure. The `transition-colors` on the header button (line 267) compounds the contrast.
- **Suggestion**: Wrap the expanded content in a CSS grid-row trick (`grid-rows-[0fr] / grid-rows-[1fr]` toggle) or a `max-height` transition to produce a smooth open/close animation. Avoid JS-driven height measurement — the CSS approach is GPU-composited and avoids layout thrash.

---

### Minor: Index used as part of React key for food items

- **File**: `src/components/track/nutrition/CalorieDetailView.tsx:327`
- **Issue**: Food item rows use `key={`${log.id}-${idx}`}` where `idx` is the array index within a single log's `items` array. If items within a log are ever reordered (e.g. by a server-side normalisation pass), React will reuse the wrong DOM node.
- **Impact**: Currently low risk because `items` is not expected to reorder in place. However, this is a fragile assumption. If an item has a stable identifier (e.g. `canonicalName`), that is a more reliable key.
- **Suggestion**: Use `key={`${log.id}-${item.canonicalName ?? idx}`}` as a quick win, or ensure items carry a stable `id` field and use that exclusively.

---

### Minor: `capitalize` utility defined locally, likely already exists elsewhere

- **File**: `src/components/track/nutrition/CalorieDetailView.tsx:108-110`
- **Issue**: A one-line `capitalize` function is defined at module scope. This kind of string utility tends to be duplicated across files in larger codebases.
- **Impact**: Minor duplication risk; not a correctness issue.
- **Suggestion**: Check `src/lib/` for an existing string utilities module. If one exists, import from there. If not, add `capitalize` there so it is available project-wide.

---

### Minor: `getDisplayName` and `getFoodItems` are not tested in isolation

- **File**: `src/components/track/nutrition/CalorieDetailView.tsx:93-105`
- **Issue**: These two helpers operate on loosely-typed `Record<string, any>` and contain non-trivial fallback chains. They are defined inside the component file with no corresponding unit tests, and the `biome-ignore` suppressions signal known type weakness.
- **Impact**: The fallback chain in `getDisplayName` (four properties tried in order) is subtle and could silently return `"Unknown food"` if the data shape shifts without the developer noticing.
- **Suggestion**: Move these helpers (along with `getItemMacros`) into `nutritionUtils.ts` or a dedicated `foodItemHelpers.ts`, and add unit tests covering the fallback paths. The `any` suppressions would then be contained to one file rather than scattered.

---

### Nice-to-have: MealBreakdownBar total computed inline, not memoized

- **File**: `src/components/track/nutrition/CalorieDetailView.tsx:154-157`
- **Issue**: `MealBreakdownBar` recomputes `total` by iterating `MEAL_SLOT_CONFIG` (4 items) on every render. The component is not memoized.
- **Impact**: Negligible at this scale; flagged for completeness.
- **Suggestion**: Wrap `MealBreakdownBar` in `React.memo`. The `total` computation is then trivially correct. Not urgent.

---

### Nice-to-have: Time strings in MEAL_SLOT_CONFIG are display-only and do not derive from getMealSlot boundaries

- **File**: `src/components/track/nutrition/CalorieDetailView.tsx:50-74`
- **Issue**: The `time` field (e.g. `"07:00"` for breakfast) is a hardcoded display string, not derived from the actual slot boundaries defined in `getMealSlot` in `nutritionUtils.ts`. The slot boundaries are 5am–9am for breakfast, but the display shows `"07:00"`.
- **Impact**: If the slot boundaries change (a reasonable future scenario as the user's digestion patterns evolve), the displayed times will be wrong without any TypeScript error to catch it. This is a silent documentation/display inconsistency.
- **Suggestion**: Either (a) acknowledge this is a "representative" example time with a comment, or (b) derive the display time programmatically from the slot boundary constants. At minimum, add a comment cross-referencing `getMealSlot` so future maintainers know to update both.
