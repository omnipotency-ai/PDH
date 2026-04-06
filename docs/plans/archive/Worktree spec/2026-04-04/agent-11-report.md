# Agent 11 — Security & Simplification: useNutritionStore.ts + nutritionUtils

## Summary

Overall this code is healthy. There are no critical security vulnerabilities, no `any` casts, no `ts-ignore`, and no obvious injection vectors. The main issues are architectural (two overlapping `nutritionUtils` files, a minor type cast, two competing `getMealSlot` implementations) and a handful of simplification opportunities in the reducer and utility functions.

---

## Findings

### Important: Two competing getMealSlot implementations with different slot boundaries

- **File**: `src/lib/nutritionUtils.ts:38` and `src/lib/nutritionUtils.ts:64`
- **Issue**: Two exported functions exist in the same file — `getMealSlot` and `getCurrentMealSlot` — with _different_ slot boundary definitions. `getMealSlot` uses breakfast=5–9, lunch=13–16, dinner=20–23. `getCurrentMealSlot` uses breakfast=5–11, lunch=11–14, dinner=17–21. The store (`useNutritionStore.ts:336`) uses `getMealSlot` to set the initial `activeMealSlot`. Other consumers that use `getCurrentMealSlot` will silently disagree about which slot the current time belongs to. There is no comment explaining why two variants exist.
- **Impact**: A user logging food at, say, 10am will have `activeMealSlot = "snack"` (from `getMealSlot`) but `getCurrentMealSlot` would say `"breakfast"`. Silent disagreement between two truth sources erodes trust in the app — especially serious for a medical-adjacent product.
- **Suggestion**: Decide on one canonical set of boundaries, delete or clearly deprecate the other. If both are genuinely needed (e.g. one for grouping historical logs, one for UX suggestions), rename them to make the distinction explicit and add a comment explaining the design intent.

---

### Important: Two nutritionUtils files with no clear ownership boundary

- **File**: `src/components/track/nutrition/nutritionUtils.ts` and `src/lib/nutritionUtils.ts`
- **Issue**: Two files are both named `nutritionUtils.ts`, live at different levels, and both import from `@shared/foodPortionData`. The component-level file contains `titleCase`, `formatPortion`, and `getDefaultCalories`. The lib-level file contains `getMealSlot`, `getCurrentMealSlot`, `calculateTotalCalories`, `calculateTotalMacros`, `groupByMealSlot`, `calculateWaterIntake`. There is no documented reason for the split. `getDefaultCalories` (component file) and `calculateTotalCalories` (lib file) both perform the same per-100g scaling calculation — different surfaces, same arithmetic.
- **Impact**: Future contributors will not know where to add new utility functions. The duplication of the scaling formula (once in `getDefaultCalories`, once in `calculateTotalCalories`, once in `computeMacrosFromPortion` inside the store) means a future nutrition data model change could be partially applied.
- **Suggestion**: Consolidate into `src/lib/nutritionUtils.ts`. Move `titleCase` to a generic `src/lib/formatUtils.ts` (it has no nutrition domain dependency). Move `formatPortion` and `getDefaultCalories` into `src/lib/nutritionUtils.ts` alongside the other portion helpers. Delete the component-level file.

---

### Minor: Type assertion on FOOD_REGISTRY in Fuse.js instantiation

- **File**: `src/components/track/nutrition/useNutritionStore.ts:308`
- **Issue**: `FOOD_REGISTRY as FoodRegistryEntry[]` is used when constructing the Fuse index. The cast is almost certainly safe — `FOOD_REGISTRY` is presumably typed as a readonly tuple or array of `FoodRegistryEntry` — but the cast silences the type-checker rather than letting it verify the assignment. The `as` makes this a weak point if the shape of `FOOD_REGISTRY` ever changes.
- **Impact**: Low risk today, but the cast means TypeScript will not catch a shape mismatch at this call site if the data type is ever widened.
- **Suggestion**: Confirm the type of `FOOD_REGISTRY` in `@shared/foodRegistryData`. If it is `readonly FoodRegistryEntry[]`, pass it directly; Fuse's generic should accept a readonly array. If a cast is genuinely needed, prefer `Array.from(FOOD_REGISTRY)` (which copies and widens) over a bare type assertion.

---

### Minor: Fuse.js search has no input sanitisation comment / length guard rationale

- **File**: `src/components/track/nutrition/useNutritionStore.ts:321–325`
- **Issue**: `searchFoodRegistry` correctly guards against short queries (`query.trim().length < 3`) but operates on a local static dataset, not a remote API. The 3-character minimum is good, but there is no upper-bound guard on query length. For a local Fuse.js index over a static dataset this is not a security issue, but extremely long strings (e.g. pasted accidentally) can cause noticeable jank on lower-end devices.
- **Impact**: Negligible security impact; minor UX robustness concern.
- **Suggestion**: Add a `query.trim().length > 100` early-return guard. This costs one line and prevents any theoretical performance degradation from pathological inputs.

---

### Minor: `computeMacrosFromPortion` is private but duplicates logic already present in lib-level utils

- **File**: `src/components/track/nutrition/useNutritionStore.ts:110–134`
- **Issue**: The per-100g scaling arithmetic (`value * portionG / 100`) appears in three places: `computeMacrosFromPortion` (store), `getDefaultCalories` (component nutritionUtils), and `calculateTotalCalories` / `calculateTotalMacros` (lib nutritionUtils). None calls the others.
- **Impact**: Three implementations of the same formula. If the scaling logic needs to change (e.g. to account for a unit conversion flag on `FoodPortionData`), all three must be found and updated.
- **Suggestion**: After the two-file consolidation, expose a single `computeMacrosForPortion(canonicalName, portionG)` from `src/lib/nutritionUtils.ts` and have the store import it rather than defining its own private version.

---

### Minor: `ADJUST_STAGING_PORTION` silently removes items when portion reaches zero rather than giving the user feedback

- **File**: `src/components/track/nutrition/useNutritionStore.ts:258–268`
- **Issue**: When `action.delta` drives `newPortionG` to ≤ 0 the item is silently filtered out from the staging list. This is a valid design choice (minimum portion = removed) but it is not obvious to the UI layer — the component receives no signal that the item was deleted rather than decremented.
- **Impact**: If a UI consumer tries to show an "undo remove" affordance or a toast, it has no way to know a removal happened via `ADJUST_STAGING_PORTION` rather than `REMOVE_FROM_STAGING`. Not a bug today; a footgun for future contributors.
- **Suggestion**: Either document this behaviour clearly in a JSDoc comment on the case, or handle it via a dedicated `REMOVE_FROM_STAGING` dispatch at the call-site when the portion would reach zero, so the reducer cases remain single-responsibility.

---

### Nice-to-have: `createStagedItem` uses `canonicalName` as `displayName` with no transformation

- **File**: `src/components/track/nutrition/useNutritionStore.ts:147`
- **Issue**: `displayName: canonicalName` — the display name is the same raw string used as a registry key (e.g. `"chicken_breast_raw"`). No `titleCase` or label lookup is applied at creation time in the store.
- **Impact**: Downstream components calling `titleCase(item.displayName)` will get `"Chicken_breast_raw"` (only the first letter capitalised, underscores preserved). This is a cosmetic issue but may be a current rendering defect depending on how components consume `displayName`.
- **Suggestion**: Either apply `titleCase(canonicalName.replace(/_/g, " "))` in `createStagedItem`, or look up a proper `label` field from `FOOD_REGISTRY` if one exists. Centralising this in the store ensures every consumer gets a correctly formatted name without each component defending itself.

---

### Nice-to-have: `generateStagingId` could be inlined

- **File**: `src/components/track/nutrition/useNutritionStore.ts:99–101`
- **Issue**: `generateStagingId` is a one-liner wrapping `crypto.randomUUID()` with a prefix. It is called in exactly one place (`createStagedItem`).
- **Impact**: None. This is a minor readability preference.
- **Suggestion**: Either inline it at the call-site (`id: \`staged\_${crypto.randomUUID()}\``) or keep it as-is — both are fine. If kept, add a comment explaining why the prefix exists (e.g. for easier identification in DevTools).

---

### Nice-to-have: `calculateWaterIntake` matches on string "Water" by name instead of a canonical field

- **File**: `src/lib/nutritionUtils.ts:221`
- **Issue**: `item.name.toLowerCase() !== "water"` relies on the human-readable display name remaining exactly "water". If a log entry uses "Water (still)" or "Sparkling Water", it is silently excluded.
- **Impact**: Minor data correctness risk. In a medical-adjacent app under-counting fluid intake could matter.
- **Suggestion**: Use a `canonicalName` field on the fluid item (if the domain model supports it) rather than a free-text match, or at minimum use a `startsWith` / `includes` heuristic and document the limitation.

---

## What Is Healthy (No Action Needed)

- No `any` casts, no `ts-ignore`, no `as unknown as X` in any of the three files.
- Reducer is a pure function, exported for direct testing — correct pattern.
- `computeStagingTotals` accepts `ReadonlyArray<StagedItem>` — good immutability discipline.
- `ADJUST_STAGING_PORTION` uses a type-guard filter predicate (`: item is StagedItem`) — clean.
- Fuse.js operates on a static local dataset; there is no remote query injection surface.
- `getMealSlot` and `createInitialState` are deterministic and have no hidden side-effects.
- The module-level Fuse singleton is an appropriate optimisation — initialisation cost paid once.
- `groupByMealSlot` is correctly generic (`T extends { timestamp: number }`) without unnecessary complexity.
