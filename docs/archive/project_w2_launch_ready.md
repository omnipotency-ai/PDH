## Branch & HEAD

- **Branch:** `feat/nutrition`
- **HEAD:** d2f45e3 (W2 fully complete — all handlers wired, E2E tests, cleanup done)
- **Tests:** 1370 passing, 51 files. Typecheck, build, lint, format all clean.
- **PR:** pending (to be created after doc updates)

## File layout

| File                                                   | Lines | Purpose                                                                                         |
| ------------------------------------------------------ | ----- | ----------------------------------------------------------------------------------------------- |
| `src/components/track/nutrition/NutritionCard.tsx`     | ~550  | Main orchestrator: CollapsedView, SearchView, header icons, all handlers, wires sub-components  |
| `src/components/track/nutrition/CalorieDetailView.tsx` | ~310  | Expanded view: MealBreakdownBar, MacroRow, MealSlotAccordion (one-open-at-a-time)               |
| `src/components/track/nutrition/WaterModal.tsx`        | ~343  | Cyan ring modal (#42BCB8), +/- 200ml, cancel/log buttons                                        |
| `src/components/track/nutrition/LogFoodModal.tsx`      | ~367  | Staging confirmation: food rows with quantity adjust, macro totals, Log Food + add more         |
| `src/components/track/nutrition/FavouritesView.tsx`    | ~170  | Heart icon list with food name, portion+calories, orange + button                               |
| `src/components/track/nutrition/FoodFilterView.tsx`    | ~300  | Tabs: Recent \| Frequent \| Favourites \| All                                                   |
| `src/components/track/nutrition/useNutritionStore.ts`  | ~350  | useReducer state: view, searchQuery, stagingItems[], modals, mealSlot. Fuse.js search.          |
| `src/hooks/useNutritionData.ts`                        | ~172  | Read-only Convex: todayFoodLogs, totalCaloriesToday, waterIntakeToday, caloriesByMealSlot, etc. |
| `src/hooks/useProfile.ts`                              | ~62   | useNutritionGoals (1850kcal, 1000ml defaults), useFoodFavourites (add/remove/isFavourite)       |
| `e2e/nutrition-card.spec.ts`                           | ~66   | 3 basic tests: renders, search transition, Escape key                                           |

## Component architecture

- **NutritionCard** is the orchestrator. It calls `useNutritionStore()` and `useNutritionData()`, manages all callbacks, and conditionally renders views based on `state.view`:
  - `"collapsed"` → CollapsedView (ring + search + water bar)
  - `"search"` → SearchView (full search with results)
  - `"calorieDetail"` → shared layout (ring + water + search) + CalorieDetailView
  - `"favourites"` → FavouritesView
  - `"foodFilter"` → FoodFilterView
- **Modals** (WaterModal, LogFoodModal) render unconditionally, controlled by `state.waterModalOpen` / `state.stagingModalOpen`
- **CalorieDetailView** receives only its unique data (macros, caloriesByMealSlot, logsByMealSlot, onDeleteLog). The shared layout (CalorieRing, WaterProgressRow, SearchInput) is rendered by NutritionCard above it.

## Store API (useNutritionStore)

- **Views:** `NutritionView = "collapsed" | "search" | "favourites" | "foodFilter" | "calorieDetail"`
- **Actions:** SET_VIEW, SET_SEARCH_QUERY, ADD_TO_STAGING, REMOVE_FROM_STAGING(id), ADJUST_STAGING_PORTION(id, delta), CLEAR_STAGING, OPEN/CLOSE_STAGING_MODAL, OPEN/CLOSE_WATER_MODAL, RESET_AFTER_LOG
- **State:** view, searchQuery, stagingItems[], stagingModalOpen, waterModalOpen, mealSlot, waterAmount
- **StagedItem:** { id, canonicalName, displayName, portionG, calories, protein, carbs, fat, sugars, fiber, naturalUnit?, unitWeightG? }
- **Note:** `state.stagingItems` (NOT stagedItems). `REMOVE_FROM_STAGING` takes `id` not `canonicalName`.

## 3 handler stubs to wire

All in NutritionCard.tsx. Pattern references:

### handleLogWater (~line 499)

```ts
// Current: no-op, just closes modal
// Wire to: useAddSyncedLog({ timestamp: Date.now(), type: "fluid", data: { items: [{ name: "Water", quantity: amountMl, unit: "ml" }] } })
// After success: toast("Water Xml logged"), close modal
// On error: toast.error, keep modal open
// Reference: src/hooks/useHabitLog.ts:111-124
```

### handleLogFood (~line 552)

```ts
// Current: no-op, just resets staging
// Wire to: useAddSyncedLog({ timestamp: Date.now(), type: "food", data: { items: state.stagingItems.map(item => ({ canonicalName: item.canonicalName, parsedName: item.displayName, quantity: item.portionG, unit: "g" })) } })
// After success: toast("N items logged"), RESET_AFTER_LOG
// On error: toast.error, do NOT reset (user can retry)
```

### handleDeleteLog (~line 565)

```ts
// Current: no-op
// Wire to: useRemoveSyncedLog(logId)
// After success: toast("Entry deleted")
// On error: toast.error
// Reference: src/pages/Track.tsx:85
```

### Imports needed

```ts
import { toast } from "sonner";
import { useAddSyncedLog, useRemoveSyncedLog } from "@/lib/sync";
import { getErrorMessage } from "@/lib/errors";
```

## Key decisions agents must respect

- **Cyan/teal is #42BCB8** — user corrected from plan's #38bdf8
- **Filter is NOT meal-slot tabs** — it's Recent|Frequent|Favourites|All
- **Meal slot selector** ("log to: Breakfast") is separate from filter
- **6 macro values**: kcal (shown separately) + protein, carbs, fat, sugars, fibre
- **Natural units** alongside grams (slice, piece, tsp)
- **Staging aggregation**: same food = one row, summed quantity
- **Dark mode**: CSS custom properties, NOT hardcoded colors
- **Accessibility**: role=dialog, aria-modal, focus trap, escape to close
- **CalorieDetailView is its own file** — user directive, not inlined in NutritionCard

## Spec review findings (2026-04-04, 4 opus agents)

See `memory/project_meal_logging_prd_complete.md` for the full list. Key items:

- Match status indicators deferred ("parked for research")
- No E2E tests for individual modals/views
- recentFoods not meal-slot-scoped
- Dead code: waterAmount/SET_WATER_AMOUNT in store
- Duplicate utils across FavouritesView/FoodFilterView

## W2 completion (session 2, 2026-04-04)

### Handler implementations (commit 649aade)

All 3 handlers now async with try/catch, toast feedback, and proper dependency arrays:

```ts
// handleLogWater — success: toast + close modal, error: toast + keep modal open
await addSyncedLog({
  timestamp: Date.now(),
  type: "fluid",
  data: { items: [{ name: "Water", quantity: amountMl, unit: "ml" }] },
});

// handleLogFood — success: toast + RESET_AFTER_LOG, error: toast + keep staging (retry)
await addSyncedLog({
  timestamp: Date.now(),
  type: "food",
  data: {
    items: state.stagingItems.map((item) => ({
      canonicalName: item.canonicalName,
      parsedName: item.displayName,
      quantity: item.portionG,
      unit: "g",
    })),
  },
});

// handleDeleteLog — success: toast, error: toast
await removeSyncedLog(logId);
```

### Cleanup done

- Dead `waterAmount`/`SET_WATER_AMOUNT` removed from store (d0aa31a)
- `useAmountState` simplified in WaterModal (d0aa31a)
- Shared `nutritionUtils.ts` extracted from FavouritesView + FoodFilterView (9a08449)
- `getCurrentMealSlot()` + scoped `recentFoods` with global fallback (d9c3837, 16 tests)
- Staging count badge added to SearchView (1635d1d)

### E2E test coverage added

| Spec file                              | Component(s)                    | Tests |
| -------------------------------------- | ------------------------------- | ----- |
| `e2e/nutrition-water-modal.spec.ts`    | WaterModal                      | 14    |
| `e2e/nutrition-logfood-modal.spec.ts`  | LogFoodModal                    | ~15   |
| `e2e/nutrition-calorie-detail.spec.ts` | CalorieDetailView               | 10    |
| `e2e/nutrition-filter-views.spec.ts`   | FavouritesView + FoodFilterView | ~12   |

### Match status research conclusion

Decision #19 (green tick/orange alert) was researched by an opus agent. Finding: in current architecture, ALL staging items come from the food registry (selected via Fuse.js search), so they're always matched. Match indicators are only meaningful when freeform text entry (WQ-410 voice logging) is added. Deferred, not blocked.

## Post-W3 review fix updates (2026-04-04, session 3)

### New files added

| File                                                            | Purpose                                                 |
| --------------------------------------------------------------- | ------------------------------------------------------- |
| `src/components/track/nutrition/NutritionCardErrorBoundary.tsx` | Class component error boundary wrapping NutritionCard   |
| `src/components/track/nutrition/CircularProgressRing.tsx`       | Shared SVG ring: value, goal, color, optional ariaLabel |
| `src/components/track/nutrition/FoodRow.tsx`                    | Shared row component for food lists                     |

### Architecture changes from review fixes

- **LogFoodModal** now uses Base UI Dialog (replaced hand-rolled focus trap, #21)
- **WaterModal** uses CircularProgressRing instead of inline SVG (#44)
- **CalorieDetailView** has CSS grid-rows animated accordion (#40), stable keys (#41), uses getDisplayName/getFoodItems/getItemMacros from nutritionUtils.ts (#43)
- **useNutritionStore** has exhaustive reducer (#73), FUSE_OPTIONS named constant (#58), registry validation (#74), titleCase displayName (#79), portionG clamping MIN_PORTION_G..MAX_PORTION_G (#80), lastRemovedItem for toast (#34)
- **FoodFilterView** has tab count badges (#71)
- **FoodRow** extracted as shared component from FavouritesView/FoodFilterView (#24)
- **nutritionUtils.ts** is now single source of truth — consolidated from 3 locations (#11, #12)
- **REMOVE_FROM_STAGING takes `id` not `canonicalName`** — fixed impedance mismatch (#16)
- **stagingTotals passed as prop** to LogFoodModal instead of recomputed (#19)

**How to apply:** W2 is complete. Read `docs/plans/next-session-prompt.md` for Wave 4 remaining work.
