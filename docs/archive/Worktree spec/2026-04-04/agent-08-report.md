# Agent 08 — Security & Simplification: CalorieDetailView.tsx

## Summary

The file is generally well-structured and calm. There are no XSS vectors or obvious runtime crashes. The main issues are: (1) a redundant and misleading type cast that bypasses the existing discriminated union, (2) `any`-typed helper functions that duplicate logic already typed correctly in `nutritionUtils.ts`, (3) a `key` prop using array index that can cause stale UI, and (4) two minor design inconsistencies in the config constants.

---

## Findings

### Important: Type cast discards discriminated union safety

- **File**: `src/components/track/nutrition/CalorieDetailView.tsx:395`
- **Issue**: `logsByMealSlot[config.slot] as FoodPipelineLog[]` casts `SyncedLog[]` to `FoodPipelineLog[]` with a bare `as` assertion. `SyncedLog` is a proper discriminated union (`{ type: K; data: LogDataMap[K] }`) so a log with `type: "digestion"` will silently pass through the cast and land in the accordion. The `as` is doing zero narrowing — it just reassures the compiler.
- **Impact**: If the caller ever passes a mixed `logsByMealSlot` (e.g. all log types, not just food/liquid), `getFoodItems` will call `log.data?.items` on a digestion log whose `data` has no `items` field. The `Array.isArray` guard in `getFoodItems` saves it from crashing, but the cast means the type system gives no warning at the call site.
- **Suggestion**: The prop type should declare `logsByMealSlot: Record<MealSlot, FoodPipelineLog[]>` (the caller is responsible for pre-filtering), or a proper runtime filter (`logs.filter((l): l is FoodPipelineLog => l.type === "food" || l.type === "liquid")`) should replace the `as` cast. Either approach makes the contract explicit without relying on a silent assertion.

---

### Important: `getItemMacros` duplicates typed logic from `nutritionUtils.ts`

- **File**: `src/components/track/nutrition/CalorieDetailView.tsx:123–145`
- **Issue**: `getItemMacros` takes `Record<string, any>` and re-implements portion-weight resolution and per-macro scaling that is already implemented — and properly typed — in `nutritionUtils.ts` (`getEffectivePortionG`, `calculateTotalMacros`). The two implementations can silently diverge; they already differ in rounding strategy (component rounds each field individually inline vs. `calculateTotalMacros` accumulates first, rounds at the end).
- **Impact**: Two sources of truth for the same calculation. A change in `nutritionUtils.ts` (e.g. a bug fix) will not propagate to the per-item display. The `any` type also means a typo like `item.Quantity` (capital Q) would silently return 0 instead of a type error.
- **Suggestion**: Extract a `getItemMacros(item: FoodItem)` overload in `nutritionUtils.ts` (or a sibling file) that takes the typed `FoodItem` and returns the same shape. The component can then call it with a typed item rather than `Record<string, any>`. This collapses two implementations to one.

---

### Important: `getDisplayName` and `getFoodItems` use `any` when `FoodItem` is available

- **File**: `src/components/track/nutrition/CalorieDetailView.tsx:93–106`
- **Issue**: Both helpers are typed as `Record<string, any>` input. The `FoodItem` interface in `src/types/domain.ts` already defines all four fields accessed: `canonicalName`, `parsedName`, `name`, `userSegment`. The `biome-ignore` comments acknowledge the `any` but don't explain why `FoodItem` can't be used.
- **Impact**: `getDisplayName` accesses four fields by string key with no type safety. A field rename in `FoodItem` won't produce a compile-time error here.
- **Suggestion**: Replace `Record<string, any>` with `FoodItem` in both helpers. The nullish-coalesce chain in `getDisplayName` maps exactly onto the optional fields in the interface.

---

### Minor: `key={log.id + "-" + idx}` uses array index as secondary key

- **File**: `src/components/track/nutrition/CalorieDetailView.tsx:332`
- **Issue**: The key `${log.id}-${idx}` uses `idx` (position within a log's items array) as the disambiguator. If the same `log.id` has items reordered or an item is deleted from the middle, React will match the wrong DOM nodes and may show stale rendered state (e.g. the wrong item name on a delete animation).
- **Impact**: Low probability in current usage (items are unlikely to be reordered), but delete is a supported action (`onDeleteLog`), so after deletion the sibling items shift index and React could reuse the wrong node.
- **Suggestion**: Use a more stable key. If `FoodItem` had a stable `id` field that would be ideal, but since it doesn't, `${log.id}-${item.canonicalName ?? item.parsedName ?? item.name ?? idx}` is more stable than raw position.

---

### Minor: `color` and `dotColor` are always identical in `MEAL_SLOT_CONFIG`

- **File**: `src/components/track/nutrition/CalorieDetailView.tsx:40–75`
- **Issue**: Every entry in `MEAL_SLOT_CONFIG` sets `color` and `dotColor` to the same value. The two fields serve different roles in the JSX (bar segment background vs. legend dot), but having them duplicated in the config is misleading and a future maintenance trap — a developer changing `color` might forget `dotColor`.
- **Impact**: Minor. No bug today, but it's confusing and increases the chance of an inconsistency being introduced later.
- **Suggestion**: Remove `dotColor` from the config type and just use `color` in both places, or alias them at the usage site. If they are ever intended to diverge, a comment explaining the distinction would help.

---

### Minor: Redundant guard on accordion button click

- **File**: `src/components/track/nutrition/CalorieDetailView.tsx:268–270`
- **Issue**: The button sets `disabled={!hasEntries}` (line 273) but the `onClick` handler also checks `if (hasEntries) onToggle()` (line 269). When `disabled` is true, the browser will not fire `onClick`, so the `if (hasEntries)` guard is dead code.
- **Impact**: No bug, just noise. The guard creates a false impression that `onClick` can fire when `!hasEntries`.
- **Suggestion**: Remove the `if (hasEntries)` guard from the `onClick` handler; rely solely on `disabled`.

---

### Nice-to-have: `capitalize` utility belongs in a shared helper module

- **File**: `src/components/track/nutrition/CalorieDetailView.tsx:108–110`
- **Issue**: `capitalize` is a one-liner string utility defined inside the component file. It is the kind of function that inevitably gets reimplemented elsewhere.
- **Impact**: No bug, but contributes to scattered micro-utilities.
- **Suggestion**: Move to `src/lib/stringUtils.ts` (or equivalent) so it can be shared without reimplementation.

---

### Nice-to-have: Hardcoded hex colors in config should use design tokens

- **File**: `src/components/track/nutrition/CalorieDetailView.tsx:58–88`
- **Issue**: `MEAL_SLOT_CONFIG` and `MACRO_CONFIG` contain hardcoded hex values (`#34d399`, `#a78bfa`, `#fbbf24`, etc.). Breakfast uses `var(--orange)` from the design token system; the others do not.
- **Impact**: Inconsistency between token-based and hardcoded colors. If the theme changes, the hardcoded values won't update.
- **Suggestion**: Convert to CSS custom properties (`var(--color-emerald-400)` etc.) consistent with how `var(--orange)` is already used for breakfast. Check the project's Tailwind v4 token map for the correct variable names.
