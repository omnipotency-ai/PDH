> **Ref:** `docs/plans/archive/Worktree spec/2026-04-04/consolidated-review-full.md`
> **Updated:** 2026-04-05
> **Version:** 1.0 (ARCHIVED)
> **History:** v1.0 (2026-04-05) — archived from active plans

# Review Findings Status — IMPORTANT Priority

**Updated:** 2026-04-04
**Fixed:** 31/36 | **Open:** 5/36

| #   | Status | Summary                                |
| --- | ------ | -------------------------------------- |
| 1   | FIXED  | patchProfile drops nutritionGoals      |
| 2   | FIXED  | getMealSlot incompatible boundaries    |
| 3   | FIXED  | todayKey never recomputes              |
| 4   | FIXED  | currentMealSlot stale                  |
| 5   | FIXED  | listAll fetches 5000 docs              |
| 6   | FIXED  | unsafe FoodPipelineLog casts           |
| 7   | FIXED  | handleSelectFood duplicate             |
| 8   | FIXED  | calorieDetail duplicates CollapsedView |
| 9   | FIXED  | getItemMacros duplicated               |
| 10  | FIXED  | getDisplayName uses any                |
| 11  | FIXED  | two nutritionUtils files               |
| 12  | FIXED  | per-100g formula triplicated           |
| 13  | FIXED  | no upper-bound on water amount         |
| 14  | FIXED  | portionG unbounded                     |
| 15  | FIXED  | handler deps on stagingItems           |
| 16  | FIXED  | onRemoveItem name vs id                |
| 17  | FIXED  | headerIcons inline lambdas             |
| 18  | FIXED  | inline onToggle per accordion          |
| 19  | FIXED  | stagingTotals computed twice           |
| 20  | FIXED  | FoodItemRow not memoized               |
| 21  | FIXED  | hand-rolled focus trap                 |
| 22  | OPEN   | WaterModal dual keydown listeners      |
| 23  | OPEN   | WaterModal amountRef workaround        |
| 24  | FIXED  | FavouriteRow/FoodFilterRow duplicate   |
| 25  | FIXED  | validFavourites filter duplicated      |
| 26  | FIXED  | frequentFoods alias                    |
| 27  | FIXED  | allFoods slice at render               |
| 28  | FIXED  | no search debounce                     |
| 29  | FIXED  | itemCount per render                   |
| 30  | FIXED  | inline arrows in list                  |
| 31  | OPEN   | formatPortion Map.get per item         |
| 32  | OPEN   | hardcoded teal color                   |
| 33  | FIXED  | FOOD_REGISTRY as cast                  |
| 34  | FIXED  | silent staging removal                 |
| 35  | FIXED  | calculateWaterIntake string match      |
| 36  | OPEN   | setAmountState in dep arrays           |

---

## IMPORTANT

### 1. [FIXED] `patchProfile` silently drops `nutritionGoals` and `foodFavourites` updates (functional bug)

- **File**: `src/contexts/ProfileContext.tsx:151-183`
- **Agents**: 12
- **Issue**: `patchProfile` builds mutation args by explicitly spreading only known fields. `nutritionGoals` and `foodFavourites` are absent from the spread, so `setNutritionGoals()`, `addFavourite()`, and `removeFavourite()` calls pass updates that are silently dropped. These features appear to work in the UI but never persist to Convex.
- **Impact**: Nutrition goals and favourites cannot actually be changed from the UI. This is a functional bug, not a code smell.
- **Suggestion**: Add the missing fields to the explicit spread in `patchProfile`.

### 2. [FIXED] `getMealSlot` and `getCurrentMealSlot` define incompatible slot boundaries

- **File**: `src/lib/nutritionUtils.ts:38-44` and `src/lib/nutritionUtils.ts:64-71`
- **Agents**: 11, 12
- **Issue**: Two exported functions have different slot boundary definitions. `getMealSlot`: breakfast 5-9h, lunch 13-16h, dinner 20-23h. THIS ONE IS CORRECT `getCurrentMealSlot`: breakfast 5-11h, lunch 11-14h, dinner 17-21h. THIS ONE IS INCORRECT. A log at 10am is "snack" in one but "breakfast" in the other.
- **Impact**: Slot-scoped `recentFoods` compares `logSlot === currentMealSlot` — since the functions disagree on boundaries, logged foods frequently fail to match, making the slot-specific list empty and silently falling back to global recents. The feature effectively never works as intended.
- **Suggestion**: Unify into a single boundary table used by both functions. If both variants are genuinely needed, rename to make the distinction explicit.

### 3. [FIXED] `todayKey` memo never recomputes — date boundary bug

- **File**: `src/hooks/useNutritionData.ts:94-97`
- **Agents**: 1, 6, 12
- **Issue**: `useMemo(() => ..., [])` with empty deps computes `todayKey` once at mount. If the app stays open across midnight, all downstream memos (food/fluid split, calorie totals, water intake, meal-slot grouping) silently show yesterday's data as "today".
- **Impact**: Silent data incorrectness across day boundaries. Particularly harmful for a post-surgical tracker where a late-night snack should appear in today's totals.
- **Suggestion**: Drive from a clock signal, `visibilitychange` listener, or compute inline (cheap `Date` construction per render).

### 4. [FIXED] `currentMealSlot` has wrong dependency — stale for entire session

- **File**: `src/hooks/useNutritionData.ts:145`
- **Agents**: 1, 6, 12
- **Issue**: `useMemo(() => getCurrentMealSlot(), [todayKey])` depends on `todayKey` which never changes (finding #3). So `currentMealSlot` is computed once at mount and locked for the session. A user who opens at breakfast sees breakfast suggestions all day.
- **Impact**: Wrong meal-slot-scoped food suggestions throughout the day.
- **Suggestion**: Remove the memo (function is cheap), or add a clock tick dependency.

### 5. [FIXED] `listAll` fetches up to 5,000 documents for every Convex subscription re-run

- **File**: `src/lib/syncLogs.ts:24-27` (query `convex/logs.ts:754`)
- **Agents**: 6
- **Issue**: `useAllSyncedLogs` issues `take(5000)` with no date filter. Every write to the logs table triggers full re-delivery and full re-derivation of all downstream memos, even for months-old mutations. Already tracked as WQ-087.
- **Impact**: Growing performance degradation as log history grows. Every Convex write reprocesses the entire payload.
- **Suggestion**: Use `useSyncedLogsByRange` bounded to 8 days (7-day recents + today). MAKE IT 2 WEEKS

### 6. [FIXED] Unsafe `as FoodPipelineLog[]` casts bypass discriminated union

- **File**: `src/hooks/useNutritionData.ts:109,163` and `src/components/track/nutrition/CalorieDetailView.tsx:395`
- **Agents**: 2, 8, 12
- **Issue**: After `isFoodPipelineType()` passes, logs are cast without verifying `data.items` exists. Line 166 accesses `foodLog.data.items` directly — if a log has a malformed or legacy shape, this throws at runtime and crashes the nutrition UI.
- **Impact**: Runtime crash on malformed data. CalorieDetailView also casts `SyncedLog[]` to `FoodPipelineLog[]` — non-food logs pass through silently.
- **Suggestion**: Use runtime guard (`if (!Array.isArray(foodLog.data?.items)) continue;`) or change prop types to enforce `FoodPipelineLog[]` upstream. DO THE LATTER

### 7. [FIXED] `handleSelectFood` and `handleAddToStaging` are byte-for-byte identical

- **File**: `src/components/track/nutrition/NutritionCard.tsx:541-553`
- **Agents**: 1, 7
- **Issue**: Two separate `useCallback` handlers dispatch the exact same `ADD_TO_STAGING` action with the same argument shape. One is passed to SearchView, the other to FavouritesView/FoodFilterView.
- **Impact**: Future staging-add logic changes risk being applied in only one place. Creates false architectural suspicion.
- **Suggestion**: Delete `handleSelectFood`, use `handleAddToStaging` everywhere.

### 8. [FIXED] `calorieDetail` view duplicates `CollapsedView` JSX inline

- **File**: `src/components/track/nutrition/NutritionCard.tsx:719-762`
- **Agents**: 1, 7
- **Issue**: The `calorieDetail` branch renders `CalorieRing`, `WaterProgressRow`, and search+LogFood row inline — identical to what `CollapsedView` already renders. The "Log Food" button JSX appears three times in the file.
- **Impact**: Three maintenance points for one logical button. Styling/behaviour changes must be applied in multiple places.
- **Suggestion**: Extract a shared `NutritionSearchRow` or `LogFoodButton` sub-component. Consider whether `calorieDetail` can reuse `CollapsedView` with a children slot. SHOULD BE A COMPONENT FOR COLLAPSED VIEW AND THEN THE CALORI AND ALL THE OTHER PARTS ARE THE ADDITIONAL PARTS

### 9. [FIXED] `getItemMacros` duplicates typed logic from `nutritionUtils.ts` with diverging rounding

- **File**: `src/components/track/nutrition/CalorieDetailView.tsx:123-145`
- **Agents**: 2, 8
- **Issue**: Re-implements portion-weight resolution and per-macro scaling already in `nutritionUtils.ts`. Uses `Record<string, any>` instead of `FoodItem`. The two implementations already diverge on rounding strategy.
- **Impact**: Two sources of truth. A bug fix in `nutritionUtils.ts` won't propagate. The `any` type hides field rename errors.
- **Suggestion**: Consolidate into a single typed `getItemMacros(item: FoodItem)` in `nutritionUtils.ts`.

### 10. [FIXED] `getDisplayName` and `getFoodItems` use `Record<string, any>` when `FoodItem` is available

- **File**: `src/components/track/nutrition/CalorieDetailView.tsx:93-106`
- **Agents**: 2, 8
- **Issue**: Both helpers accept `Record<string, any>` with `biome-ignore` suppressions. `FoodItem` in `src/types/domain.ts` already defines all accessed fields. The `any` means field renames produce no compile-time error.
- **Impact**: Type safety negated. Silent bugs on domain model changes.
- **Suggestion**: Replace `Record<string, any>` with `FoodItem`.

### 11. [FIXED] Two `nutritionUtils.ts` files with no documented ownership boundary

- **File**: `src/components/track/nutrition/nutritionUtils.ts` and `src/lib/nutritionUtils.ts`
- **Agents**: 11
- **Issue**: Both import from `@shared/foodPortionData`. The per-100g scaling formula is duplicated across three locations (store, component utils, lib utils). No documented reason for the split.
- **Impact**: Contributors don't know where to add new utilities. Schema changes partially applied.
- **Suggestion**: Consolidate into `src/lib/nutritionUtils.ts`. Move `titleCase` to `src/lib/formatUtils.ts`.

### 12. [FIXED] Per-100g scaling formula triplicated across store, component utils, and lib utils

- **File**: `useNutritionStore.ts:110-134`, component `nutritionUtils.ts`, lib `nutritionUtils.ts`
- **Agents**: 11 (extends findings 9 and 11)
- **Issue**: `computeMacrosFromPortion` (store), `getDefaultCalories` (component), and `calculateTotalCalories`/`calculateTotalMacros` (lib) all implement `value * portionG / 100` independently.
- **Impact**: Three implementations of the same formula. A data model change could be partially applied.
- **Suggestion**: Expose a single `computeMacrosForPortion(canonicalName, portionG)` from `src/lib/nutritionUtils.ts`.

### 13. [FIXED] No upper-bound validation on water amount before Convex mutation

- **File**: `src/components/track/nutrition/WaterModal.tsx:138` and `NutritionCard.tsx:524-539`
- **Agents**: 9
- **Issue**: `WaterModal` UI-clamps to `MAX_ML = 2000` but `handleLogWater` passes `amountMl: number` to `addSyncedLog` with no guard. A future callsite or test could bypass the UI clamp.
- **Impact**: Violates "Convex is the Boss" and "data correctness first" principles.
- **Suggestion**: Add `if (amountMl <= 0 || amountMl > 2000) return;` in `handleLogWater`.

### 14. [FIXED] `portionG` can grow unboundedly in LogFoodModal

- **File**: `src/components/track/nutrition/LogFoodModal.tsx:127-129` and `useNutritionStore.ts:258-268`
- **Agents**: 9
- **Issue**: The increment button has no upper bound. A user can click `+` indefinitely — portionG grows without limit. Absurd values (999,999g) reach Convex and corrupt macro displays.
- **Impact**: Unrealistic data in database. Corrupts transit/digestion correlation logic.
- **Suggestion**: Add `MAX_PORTION_G` constant (e.g. 2000g), disable increment at cap, mirror in reducer. MAX SHOULD BE 500G/500ML WHOEVER HEARD OF ANYONE EATING MORE THAN 500G OF ANYTHUING IN ONE SITTING AND THAT PERSOBN WANTS TO LOSE WEIGHT???

### 15. [FIXED] `handleRemoveFromStaging` / `handleUpdateStagedQuantity` depend on `state.stagingItems`

- **File**: `src/components/track/nutrition/NutritionCard.tsx:563-584`
- **Agents**: 1, 7
- **Issue**: Both do `.find()` over `state.stagingItems` to resolve `canonicalName` → `id`. The `useCallback` deps include `state.stagingItems`, regenerating callbacks on every staging mutation. `LogFoodModal` receives fresh function refs on every quantity change.
- **Impact**: `LogFoodModal` re-renders entirely after each quantity stepper interaction.
- **Suggestion**: Push `canonicalName→id` resolution into reducer, or expose `id`-based API from `LogFoodModal`. DO THE MORE ROBUST OPTION NOT THE EASIEST

### 16. [FIXED] `onRemoveItem` uses `canonicalName` but store dispatches by `id` — impedance mismatch

- **File**: `src/components/track/nutrition/LogFoodModal.tsx:25` vs `useNutritionStore.ts:250-254`
- **Agents**: 4, 7
- **Issue**: `LogFoodModalProps.onRemoveItem` typed as `(canonicalName: string) => void`, but reducer filters by `item.id`. If the same food appears twice (different `id`s, same `canonicalName`), removing by name is ambiguous.
- **Impact**: Latent confusion risk. API surface doesn't enforce the one-row-per-name invariant.
- **Suggestion**: Align to `(id: string) => void`.

### 17. [FIXED] `headerIcons` inline lambdas not wrapped in `useCallback`

- **File**: `src/components/track/nutrition/NutritionCard.tsx:637-667`
- **Agents**: 1, 7
- **Issue**: Favourites and Filter button `onClick` handlers are re-created on every render. Pattern is inconsistent with all other handlers in the file which use `useCallback`.
- **Impact**: Defeats future `React.memo` on `SectionHeader`. Inconsistent pattern for maintainers to copy.
- **Suggestion**: Lift into named `useCallback` handlers (`handleOpenFavourites`, `handleOpenFoodFilter`).

### 18. [FIXED] Inline `onToggle` arrow per accordion creates new reference every render

- **File**: `src/components/track/nutrition/CalorieDetailView.tsx:398-400`
- **Agents**: 2
- **Issue**: Each `MealSlotAccordion` gets a new `onToggle` function on every render, defeating future `React.memo`.
- **Impact**: Latent bug if accordions are later memoized.
- **Suggestion**: Pass `setOpenSlot` and `config.slot` separately, or use `useCallback` per slot.

### 19. [FIXED] `computeStagingTotals` called twice — once in modal, once in store

- **File**: `src/components/track/nutrition/LogFoodModal.tsx:232` and `useNutritionStore.ts:355-358`
- **Agents**: 4
- **Issue**: LogFoodModal calls `computeStagingTotals(stagedItems)` inline in render. The store already memoizes `stagingTotals`.
- **Impact**: Same O(n) loop runs twice. Semantic inconsistency: store's value is canonical, modal's is redundant.
- **Suggestion**: Pass `stagingTotals` as prop, remove inline call.

### 20. [FIXED] Inline arrow callbacks on `FoodItemRow` — not memoized

- **File**: `src/components/track/nutrition/LogFoodModal.tsx:304-311`
- **Agents**: 4
- **Issue**: `FoodItemRow` is not wrapped in `React.memo`. Every quantity change re-renders all rows.
- **Impact**: Entire list re-renders on any quantity adjustment.
- **Suggestion**: Wrap `FoodItemRow` in `React.memo`.

### 21. [FIXED] Hand-rolled focus trap duplicated across both modals instead of shared hook or native `<dialog>`

- **File**: `src/components/track/nutrition/WaterModal.tsx:95-127` and `LogFoodModal.tsx:191-215`
- **Agents**: 3, 4, 9
- **Issue**: 40+ lines of identical focus-trap logic (querySelectorAll, Tab/Shift+Tab cycling) in both files. Missing coverage for `[contenteditable]`, `summary`, and pointer-focus escape. querySelectorAll runs on every keydown.
- **Impact**: Accessibility bug fix would need to happen in two places. Fragile to UI changes.
- **Suggestion**: Extract `useFocusTrap(ref, enabled, onEscape)` hook, or use native `<dialog>` / Base UI Dialog. BASE UI HANDLES THIS WELL

### 22. [OPEN] Two `window.addEventListener("keydown")` effects mounted simultaneously in WaterModal

- **File**: `src/components/track/nutrition/WaterModal.tsx:80-127`
- **Agents**: 3
- **Issue**: Escape handler and focus-trap handler are separate `useEffect` calls, both on `window`. Both fire on every keydown.
- **Impact**: Minor CPU waste. Makes keyboard logic harder to reason about.
- **Suggestion**: Merge into one listener handling both Escape and Tab.

### 23. [OPEN] Unnecessary `amountRef` / stale-closure workaround in WaterModal

- **File**: `src/components/track/nutrition/WaterModal.tsx:54,66,137-140`
- **Agents**: 3, 9
- **Issue**: `amountRef` mirrors `amount` state on every render. `handleLogWater` reads the ref to avoid a stale closure. But `useCallback([onLogWater, amount])` is the idiomatic pattern and works correctly.
- **Impact**: Readability. "Clever code" that surprises readers.
- **Suggestion**: Remove `amountRef`, close over `amount` directly with proper deps.

### 24. [FIXED] `FavouriteRow` and `FoodFilterRow` are near-identical — duplicated structure

- **File**: `src/components/track/nutrition/FavouritesView.tsx:85-137` and `FoodFilterView.tsx:218-272`
- **Agents**: 5, 10
- **Issue**: Same layout, classes, inline styles. Only difference: heart fill state and a silent size inconsistency (h-5 w-5 vs h-4 w-4).
- **Impact**: Visual/layout changes must be applied in two places. Heart icon size mismatch is a visual inconsistency.
- **Suggestion**: Extract single `FoodRow` component.

### 25. [FIXED] `validFavourites` filter duplicated across both components (3 instances)

- **File**: `FavouritesView.tsx:30-32`, `FoodFilterView.tsx:71-77`, `FoodFilterView.tsx:79-85`
- **Agents**: 5, 10
- **Issue**: `array.filter(name => FOOD_PORTION_DATA.has(name))` appears three times. FavouritesView version has no `useMemo`.
- **Impact**: Filter criteria change must be applied in three places.
- **Suggestion**: Extract `filterToKnownFoods()` to `nutritionUtils.ts`.

### 26. [FIXED] `frequentFoods` is a reference alias — "Frequent" tab silently shows "Recent" data

- **File**: `src/components/track/nutrition/FoodFilterView.tsx:90`
- **Agents**: 5, 10
- **Issue**: `const frequentFoods = validRecentFoods;` — the Frequent tab shows identical data to Recent with no disclosure. Users may make food decisions based on what they believe is frequency data.
- **Impact**: Violates AI Transparency principle ("never present inferred logic as certainty"). Product trust risk in medical-adjacent context.
- **Suggestion**: Add visible inline notice on Frequent tab, or remove tab until implemented.IMPLEMENT THE TAB EVEN THOUGH ITS A BIGGER JOB

### 27. [FIXED] `allFoods` capped with `.slice()` at render time, not in the memo

- **File**: `src/components/track/nutrition/FoodFilterView.tsx:102`
- **Agents**: 5, 10
- **Issue**: Full sorted array always held in memory; slice applied only in `displayedItems` memo, not `allFoods` memo. Inconsistent with `validRecentFoods` and `validFavourites` patterns.
- **Impact**: Full array in memory unnecessarily. Architecturally inconsistent.
- **Suggestion**: Apply slice inside `allFoods` memo.

### 28. [FIXED] No search debounce — Fuse.js runs on every keystroke

- **File**: `src/components/track/nutrition/useNutritionStore.ts:350-353`
- **Agents**: 6
- **Issue**: `searchResults` useMemo keyed on `state.searchQuery`. Every character typed fires Fuse.js synchronously and triggers full React re-render of all store subscribers.
- **Impact**: Fine at 148 entries currently. Does not scale. Causes unnecessary re-renders of unrelated UI.
- **Suggestion**: `useDeferredValue` or 150ms debounce. Consider splitting hook return for selector pattern. TRY TO AVOID FULL RE-RENDERS

### 29. [FIXED] `itemCount` recomputed on every render inside MealSlotAccordion, even when closed

- **File**: `src/components/track/nutrition/CalorieDetailView.tsx:253-256`
- **Agents**: 2
- **Issue**: Three closed accordions still traverse their logs array each render cycle.
- **Impact**: Wasted work. Will degrade with more logs.
- **Suggestion**: Wrap `MealSlotAccordion` in `React.memo`.

### 30. [FIXED] Inline arrow functions in Favourites/Filter list item `onClick`

- **File**: `FavouritesView.tsx:125` and `FoodFilterView.tsx:260`
- **Agents**: 5
- **Issue**: New `() => onAdd(canonicalName)` arrow on every render. Neither row component memoized. Up to 50 new allocations per render.
- **Impact**: Unnecessary re-renders if parent ticks frequently.
- **Suggestion**: Wrap row components in `React.memo`.

### 31. [OPEN] `formatPortion` and `getDefaultCalories` each do Map.get() per item per render

- **File**: `src/components/track/nutrition/FoodFilterView.tsx:171-172`
- **Agents**: 5
- **Issue**: 2 Map lookups x N items on every render. Data never changes for a given canonical name.
- **Impact**: Negligible at current scale. Missed optimization for growth.
- **Suggestion**: Precompute resolved props in `useMemo` that builds `displayedItems`.

### 32. [OPEN] Hardcoded `#42BCB8` teal color repeated across multiple files

- **File**: `NutritionCard.tsx:183,200,664`, `WaterModal.tsx:21`
- **Agents**: 1, 3, 7
- **Issue**: Water/hydration color as hex literal, not a CSS design token. Contradicts "tokenized colors only" principle.
- **Impact**: Grep-and-replace needed if color changes.
- **Suggestion**: Add `--color-water` CSS custom property to design token system.

### 33. [FIXED] `FOOD_REGISTRY as FoodRegistryEntry[]` type assertion in Fuse constructor

- **File**: `src/components/track/nutrition/useNutritionStore.ts:308`
- **Agents**: 7, 11
- **Issue**: `as` cast silences TypeScript rather than letting it verify the shape. If `FOOD_REGISTRY` is `readonly`, cast also hides that.
- **Impact**: Low risk today. Sets precedent for type-unsafe patterns.
- **Suggestion**: Fix source type of `FOOD_REGISTRY` so cast is unnecessary, or use `Array.from()`. DO THE FORMER

### 34. [FIXED] `ADJUST_STAGING_PORTION` silently removes items when portion reaches zero

- **File**: `src/components/track/nutrition/useNutritionStore.ts:258-268`
- **Agents**: 11
- **Issue**: When delta drives `newPortionG` to <= 0, item is silently filtered out. UI layer gets no signal that removal happened (vs. explicit `REMOVE_FROM_STAGING`).
- **Impact**: Footgun for future "undo remove" affordance or toast. Actions should be single-responsibility.
- **Suggestion**: Document behaviour or handle via explicit `REMOVE_FROM_STAGING` dispatch at call-site. POP TOAST ON REMOVAL

### 35. [FIXED] `calculateWaterIntake` matches on free-text string "Water" by name

- **File**: `src/lib/nutritionUtils.ts:221`
- **Agents**: 11
- **Issue**: `item.name.toLowerCase() !== "water"` — "Water (still)" or "Sparkling Water" would be silently excluded.
- **Impact**: Under-counting fluid intake in a medical-adjacent app.
- **Suggestion**: Use `canonicalName` field or `includes`/`startsWith` heuristic.

### 36. [OPEN] `setAmountState` listed as dependency unnecessarily in WaterModal

- **File**: `src/components/track/nutrition/WaterModal.tsx:59-63,129-135`
- **Agents**: 3, 9
- **Issue**: React guarantees `setState` is stable. Including in dep arrays is harmless but teaches incorrect React mental model.
- **Impact**: Noise. Incorrect pattern propagation.
- **Suggestion**: Remove from dependency arrays.
