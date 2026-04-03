# W0-01 Analysis Beta: Agent A Mock-to-Real Mapping

**Agent:** Beta  
**Date:** 2026-04-03  
**Scope:** Line-by-line mapping of all Agent A mock types, interfaces, functions, and imports against the real PDH domain layer.

---

## 1. Type & Interface Mappings

### 1.1 mockData.FoodItem (mockData.ts:9-19)

| Mock field          | Real equivalent                                                                                                   | Notes                                                                                                                                                                                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id: string`        | `FoodRegistryEntry.canonical: string` (foodRegistryData.ts:118)                                                   | Mock uses synthetic IDs ("f01"); real uses canonical name string as identity.                                                                                                                                               |
| `name: string`      | `FoodRegistryEntry.canonical: string` (foodRegistryData.ts:118)                                                   | Same field serves as both name and ID in real system.                                                                                                                                                                       |
| `defaultPortionG`   | `FoodRegistryEntry.defaultPortionDisplay?: string` -- **does not exist on FoodRegistryEntry**                     | Real entries have no numeric default portion. The `defaultPortionDisplay` field exists on the validator `foodItemValidator` (validators.ts:361) as an optional display string, not a numeric gram value. This is a **gap**. |
| `caloriesPer100g`   | `ingredientProfiles.nutritionPer100g.kcal` (schema.ts:125)                                                        | Stored per-user in Convex `ingredientProfiles` table, not on the registry entry itself.                                                                                                                                     |
| `proteinPer100g`    | `ingredientProfiles.nutritionPer100g.proteinG` (schema.ts:131)                                                    | Same pattern -- per-user Convex table.                                                                                                                                                                                      |
| `carbsPer100g`      | `ingredientProfiles.nutritionPer100g.carbsG` (schema.ts:128)                                                      | Same pattern.                                                                                                                                                                                                               |
| `fatPer100g`        | `ingredientProfiles.nutritionPer100g.fatG` (schema.ts:126)                                                        | Same pattern.                                                                                                                                                                                                               |
| `unit: "g" \| "ml"` | **Does not exist** on FoodRegistryEntry                                                                           | Real registry has no unit field. The `FoodItem` in domain.ts has `unit: string \| null` (domain.ts:331) but that's on log entries, not registry entries.                                                                    |
| `isLiquid: boolean` | Inferred from `FoodRegistryEntry.category === "drink" \| "beverage"` or `subcategory` (foodRegistryData.ts:40-46) | Not a boolean flag; must be derived from category/subcategory.                                                                                                                                                              |

**Shape mismatch severity: HIGH.** The mock FoodItem is a flat nutrition-centric type. The real FoodRegistryEntry is a clinical/digestion-centric type with zone, group, line, category, subcategory, macros array, examples array, and digestion metadata -- but **no calorie/macro numbers**. Nutrition data lives separately in the `ingredientProfiles` Convex table.

### 1.2 mockData.FoodLogEntry (mockData.ts:410-423)

| Mock field           | Real equivalent                                                                                      | Notes                                                                                         |
| -------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `id: string`         | `SyncedLog.id: string` (syncCore.ts:278)                                                             | Direct match.                                                                                 |
| `foodId: string`     | **No direct equivalent.** Real food log items use `canonicalName` (domain.ts:329, validators.ts:357) | Mock references a registry ID; real uses canonical name string.                               |
| `foodName: string`   | `FoodItem.name \| FoodItem.parsedName \| FoodItem.userSegment` (domain.ts:322-326)                   | Real system has multiple name fields due to parsing pipeline.                                 |
| `portionG: number`   | `FoodItem.quantity: number \| null` (domain.ts:330)                                                  | Real field is nullable and not necessarily grams.                                             |
| `calories: number`   | **Does not exist on log entries.**                                                                   | Must be computed at render time from `ingredientProfiles.nutritionPer100g.kcal` and quantity. |
| `protein: number`    | **Does not exist on log entries.**                                                                   | Same as calories -- derived.                                                                  |
| `carbs: number`      | **Does not exist on log entries.**                                                                   | Same.                                                                                         |
| `fat: number`        | **Does not exist on log entries.**                                                                   | Same.                                                                                         |
| `mealSlot: MealSlot` | `FoodLogData.mealSlot?: "breakfast" \| "lunch" \| "dinner" \| "snack"` (domain.ts:370)               | Real uses lowercase strings and is optional. Mock uses capitalized union and is required.     |
| `timestamp: number`  | `SyncedLog.timestamp: number` (syncCore.ts:279)                                                      | Direct match (epoch ms).                                                                      |
| `isMeal: boolean`    | **Does not exist.**                                                                                  | Real system has no per-log-entry meal flag.                                                   |
| `mealId?: string`    | **Does not exist.**                                                                                  | Real system uses `foodLibrary` composites, not meal IDs on logs.                              |

**Shape mismatch severity: HIGH.** The mock pre-computes all nutrition on the log entry. The real system stores only raw food items (name, quantity, unit) on the log, and nutrition must be joined from `ingredientProfiles` at query/render time.

### 1.3 mockData.SavedMeal (mockData.ts:334-339)

| Mock field                         | Real equivalent                                                |
| ---------------------------------- | -------------------------------------------------------------- |
| `id: string`                       | `foodLibrary._id` (schema.ts:356)                              |
| `name: string`                     | `foodLibrary.canonicalName: string` (schema.ts:358)            |
| `items: Array<{foodId, portionG}>` | `foodLibrary.ingredients: string[]` (schema.ts:360)            |
| `totalCalories: number`            | **Does not exist.** Must be computed from ingredient profiles. |

The real `foodLibrary` table (schema.ts:356-364) stores composites as `type: "composite"` with an `ingredients: string[]` array of canonical names. It has no portion sizes per ingredient and no pre-computed calories. The mock's `SavedMeal` is a richer structure with portions and totals that would need to be computed at runtime by joining `foodLibrary.ingredients` against `ingredientProfiles`.

**Verdict:** Partial equivalent exists. The `foodLibrary` with `type: "composite"` is the real-app "saved meal" mechanism, but its shape is much simpler (just canonical name strings, no portions).

### 1.4 mockData.MealSlot (mockData.ts:396)

Mock: `"Breakfast" | "Lunch" | "Dinner" | "Snack"` (capitalized)  
Real: `"breakfast" | "lunch" | "dinner" | "snack"` (lowercase, domain.ts:370)

**Action required:** Lowercase all MealSlot values in the real implementation.

### 1.5 useNutritionStore.StagedItem (useNutritionStore.ts:24-35)

This is a **UI-only ephemeral type** for the staging area before committing a food log. It has no direct Convex equivalent. The real implementation should use a similar ephemeral pattern (Zustand or useReducer) that holds items before calling `convex/logs` mutations.

### 1.6 useNutritionStore.NutritionView (useNutritionStore.ts:39-44)

Pure UI state enum. No backend equivalent needed. The set of views (`"collapsed" | "search" | "favourites" | "mealSlotFilter" | "calorieDetail"`) is an implementation detail of the card component.

### 1.7 useNutritionStore.NutritionState (useNutritionStore.ts:48-62)

| State field        | Real data source                                                                                                                                                                                                                                                                                            |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `view`             | UI-only (no backend)                                                                                                                                                                                                                                                                                        |
| `searchQuery`      | UI-only (no backend)                                                                                                                                                                                                                                                                                        |
| `stagingItems`     | UI-only (ephemeral before commit)                                                                                                                                                                                                                                                                           |
| `stagingModalOpen` | UI-only                                                                                                                                                                                                                                                                                                     |
| `waterModalOpen`   | UI-only                                                                                                                                                                                                                                                                                                     |
| `waterAmount`      | UI-only (the amount being prepared to log)                                                                                                                                                                                                                                                                  |
| `waterIntake`      | Derived from `SyncedLog[]` where `type === "fluid"` and fluid name matches "water" (domain.ts:373-374). Must sum `data.items[].quantity` where `name === "water"` for today.                                                                                                                                |
| `waterGoal`        | **Does not exist in current schema.** No water-specific goal field in `profiles` table. The closest is `fluidPresets` (schema.ts:339) which stores named fluid types but no daily target. The `BaselineAverages.waterAvgMlPerDay` (domain.ts:496) provides a historical average but is not a user-set goal. |
| `foodLogs`         | Derived from `SyncedLog[]` where `type === "food"`, filtered to today. Obtained via `useSyncedLogsContext()` (SyncedLogsContext.tsx:40-46) or `useAllSyncedLogs()` (syncLogs.ts:24).                                                                                                                        |
| `favourites`       | **Does not exist.** No favourites table, field, or mechanism anywhere in the Convex schema or frontend codebase. This is a **new feature** that needs to be built.                                                                                                                                          |
| `calorieGoal`      | **Does not exist.** No calorie goal field in `profiles`, `healthProfile`, or any other table. This is a **gap**.                                                                                                                                                                                            |
| `activeMealSlot`   | UI-only (derived from time of day)                                                                                                                                                                                                                                                                          |
| `filterMealSlot`   | UI-only                                                                                                                                                                                                                                                                                                     |

---

## 2. Constants & Data Mappings

### 2.1 FOOD_REGISTRY (mockData.ts:21-330)

- **Mock:** 28 entries, each a flat `FoodItem` with nutrition data.
- **Real:** 148 entries in `shared/foodRegistryData.ts` (exported as `FOOD_REGISTRY` at line 4321), each a `FoodRegistryEntry` with clinical metadata (zone, group, line, category, subcategory, examples, digestion metadata).
- **Key difference:** Real registry has **no nutrition values** (no kcal, protein, carbs, fat fields). Nutrition lives in the `ingredientProfiles` Convex table, which is per-user and populated on demand.

### 2.2 SAVED_MEALS (mockData.ts:341-392)

- **Mock:** 5 hardcoded meals with ingredient IDs, portions, and pre-computed calories.
- **Real:** `foodLibrary` table composites (schema.ts:356-364). User-specific, stored in Convex. No pre-computed calories. Ingredients are canonical name strings, not ID + portion objects.

### 2.3 WATER_GOAL_ML / INITIAL_WATER_ML (mockData.ts:538-539)

- **Mock:** Hardcoded constants (1000ml goal, 450ml initial).
- **Real:** No water goal exists in the schema. Water intake is derived by filtering fluid logs where the item name is "water" and summing quantities for the current day.

### 2.4 CALORIE_GOAL (mockData.ts:543)

- **Mock:** Hardcoded 1800 kcal.
- **Real:** **Does not exist.** No calorie goal field in any Convex table or profile settings.

### 2.5 INITIAL_FAVOURITES (mockData.ts:547)

- **Mock:** Array of 5 food IDs.
- **Real:** **Does not exist.** No favourites storage mechanism anywhere.

---

## 3. Function Mappings

### 3.1 detectMealSlot (mockData.ts:398-406)

**Mock implementation:**

- 4-8h: Breakfast
- 9-12h: Snack
- 13-16h: Lunch
- 17-19h: Snack
- 20-22h: Dinner
- else: Snack

**Required implementation (per task spec):**

- 5-9am: Breakfast
- 1-4pm (13-16h): Lunch
- 8-11pm (20-23h): Dinner
- else: Snack

**Real system equivalent:** The `MealSchedule` type in domain.ts:129-136 defines user-configurable meal times (`breakfast: "08:00"`, `lunch: "13:00"`, `dinner: "18:00"`, etc.) stored in `profiles.aiPreferences.mealSchedule`. A proper implementation should use these user-configured times, not hardcoded hour ranges. However, for the nutrition card's quick-detect, the fixed time ranges from the spec are acceptable as defaults.

### 3.2 calculateCalories (mockData.ts:555-557)

**Mock:** `Math.round((food.caloriesPer100g * portionG) / 100)`  
**Real:** Must query `ingredientProfiles.nutritionPer100g.kcal` for the canonical name, then apply the same formula. The ingredientProfiles query is `ingredientProfiles.byIngredient({ canonicalName })` (ingredientProfiles.ts:56-72).

### 3.3 calculateMacro (mockData.ts:559-561)

**Mock:** `Math.round(((per100g * portionG) / 100) * 10) / 10`  
**Real:** Same formula, but source data comes from `ingredientProfiles.nutritionPer100g` fields (`proteinG`, `carbsG`, `fatG`).

### 3.4 getFoodById (mockData.ts:551-553)

**Mock:** `FOOD_REGISTRY.find(f => f.id === id)`  
**Real:** `getFoodEntry(canonicalName)` from `shared/foodRegistryUtils.ts` (re-exported via foodRegistry.ts:32). Returns `FoodRegistryEntry | undefined`.

### 3.5 getPortionIncrement (mockData.ts:563-570)

**Mock:** Returns `defaultPortionG` for toast/eggs, 50 for everything else.  
**Real:** **Does not exist.** This is UI logic that would need to be created. Could use the real registry's `category`/`subcategory` fields to determine appropriate increments.

### 3.6 formatPortion (mockData.ts:572-574)

**Mock:** `` `${amount}${unit}` ``  
**Real:** **Does not exist as a standalone function.** The real system has unit formatting in `src/lib/units.ts` but not a simple portion formatter of this shape.

---

## 4. Import Audit

### 4.1 NutritionCard.tsx imports

| Import                                                                                | Source                         | Real equivalent                                                                         |
| ------------------------------------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------- |
| `Camera, ChevronDown, Droplets, Heart, Mic, Plus, SlidersHorizontal, UtensilsCrossed` | `lucide-react`                 | Keep as-is.                                                                             |
| `useCallback, useRef, useState`                                                       | `react`                        | Keep as-is.                                                                             |
| `toast`                                                                               | `sonner`                       | Keep as-is -- sonner is in the stack.                                                   |
| `Badge, Button, Input, Tooltip*`                                                      | `@/components/ui/*`            | Keep as-is -- shadcn/ui components.                                                     |
| `cn`                                                                                  | `@/lib/utils`                  | Keep as-is.                                                                             |
| `calculateCalories, FOOD_REGISTRY, FoodItem, getFoodById, MealSlot, SAVED_MEALS`      | `./mockData`                   | **Replace all.** See mappings above.                                                    |
| `CalorieDetailView, FavouritesView, MealSlotFilterView`                               | Local components               | Keep -- but their props need updating to use real types.                                |
| `StagingModal`                                                                        | Local component                | Keep.                                                                                   |
| `NutritionView, useNutritionStore`                                                    | `./useNutritionStore`          | Refactor: store should consume real data from Convex via hooks.                         |
| `WaterModal`                                                                          | Local component                | Keep.                                                                                   |
| `Fuse` from `fuse.js`                                                                 | Used in useNutritionStore.ts:1 | Keep for fuzzy search, but search corpus changes from mock array to real FOOD_REGISTRY. |

### 4.2 useNutritionStore.ts imports from mockData

All 14 imports from `./mockData` (useNutritionStore.ts:3-20) need replacement:

- `CALORIE_GOAL` -> user profile setting (does not exist yet)
- `calculateCalories` -> function using ingredientProfiles data
- `calculateMacro` -> same
- `detectMealSlot` -> new implementation with corrected times
- `FOOD_REGISTRY` -> real `FOOD_REGISTRY` from `shared/foodRegistry`
- `FoodItem` -> `FoodRegistryEntry` from `shared/foodRegistry`
- `FoodLogEntry` -> `SyncedLog & { type: "food" }` from `src/lib/syncCore`
- `getFoodById` -> `getFoodEntry` from `shared/foodRegistryUtils`
- `getPortionIncrement` -> new helper function
- `INITIAL_FAVOURITES` -> user-specific data (new feature)
- `INITIAL_FOOD_LOGS` -> live Convex data via `useSyncedLogsContext()`
- `INITIAL_WATER_ML` -> derived from today's fluid logs
- `MealSlot` -> use `FoodLogData["mealSlot"]` type from domain.ts
- `SAVED_MEALS` -> `foodLibrary.list()` Convex query
- `SavedMeal` -> return type of `foodLibrary.list()`
- `WATER_GOAL_ML` -> new profile setting (does not exist yet)

---

## 5. ingredientProfiles Audit

### 5.1 Table definition (schema.ts:113-138)

```
ingredientProfiles {
  userId: string
  canonicalName: string
  displayName: string
  tags: string[]
  foodGroup: FoodGroup | null
  foodLine: FoodLine | null
  lowResidue: boolean | null
  source: "manual" | "openfoodfacts" | null
  externalId: string | null
  ingredientsText: string | null
  nutritionPer100g: {
    kcal: number | null
    fatG: number | null
    saturatedFatG: number | null
    carbsG: number | null
    sugarsG: number | null
    fiberG: number | null
    proteinG: number | null
    saltG: number | null
  }
  createdAt: number
  updatedAt: number
}
```

Indexed by: `by_userId`, `by_userId_canonicalName`.

### 5.2 Queries & Mutations (ingredientProfiles.ts)

- `list` (line 43): Returns all profiles for the authenticated user, sorted by `updatedAt` desc.
- `byIngredient` (line 56): Returns a single profile by `canonicalName` for the authenticated user.
- `upsert` (line 74): Creates or updates a profile. Auto-derives `foodGroup` and `foodLine` from `getIngredientProfileProjection()` which delegates to `getCanonicalFoodProjection()` (ingredientProfileProjection.ts:21-23).

### 5.3 nutritionPer100g field structure

All 8 sub-fields are nullable (`number | null`). A profile can exist with all-null nutrition (the `blankNutrition()` helper at ingredientProfiles.ts:30-41 produces this). The `source` field indicates provenance: `"manual"` (user-entered), `"openfoodfacts"` (API import), or `null` (not yet populated).

### 5.4 Coverage estimate

The real FOOD_REGISTRY has **148 canonical entries**. The `ingredientProfiles` table is **per-user** and populated on demand -- there is no global seed. A brand-new user starts with **zero** ingredient profiles. Profiles are created when:

1. A user manually enters nutrition data via the UI
2. Data is imported from OpenFoodFacts
3. The `upsert` mutation is called programmatically

**Estimated coverage for a typical user: LOW (likely <20% of registry entries have profiles with non-null nutrition).** This means the Nutrition Card cannot assume calorie data is available for most foods. The UI must gracefully handle missing nutrition data (show "-- kcal" or similar).

---

## 6. Component-Level Analysis

### 6.1 StagingModal.tsx

Imports `MealSlot` from mockData (line 5) and `StagedItem` from useNutritionStore (line 6). The component itself is largely UI chrome and can remain mostly unchanged. The `StagedItem` type is ephemeral and can stay as a UI-only interface. Only the `MealSlot` import needs redirecting to the real domain type (lowercase values).

### 6.2 WaterModal.tsx

Self-contained UI component with no mock data imports. All state is passed via props. No changes needed beyond ensuring the parent passes real data (derived from fluid logs) instead of mock constants.

### 6.3 CalorieDetailView.tsx

Imports `FoodLogEntry` and `MealSlot` from mockData (line 3), plus `getFoodById` (line 4). These need replacement with real types. The `getFoodById` call on line 114 is used only for the unit display -- the real equivalent is `getFoodEntry(log.canonicalName)` but requires that log items carry `canonicalName`.

### 6.4 FavouritesView.tsx

Imports `FoodItem` and `calculateCalories` from mockData (lines 2-3). Needs real data sources. The `calculateCalories` usage on line 55 computes display calories from default portions -- in the real system this requires an `ingredientProfiles` lookup which is async (Convex query), introducing a data-loading concern this view currently avoids.

### 6.5 MealSlotFilterView.tsx

Imports `FoodLogEntry`, `MealSlot`, and `getFoodById` from mockData (lines 4-5). Also imports `date-fns/formatDistanceToNow` (line 1). The `date-fns` import is fine -- it's already a project dependency.

### 6.6 index.ts

Single re-export: `export { NutritionCard } from "./NutritionCard"`. No changes needed.

---

## 7. Assumptions Requiring Validation

1. **No calorie goal exists anywhere.** I searched `profiles`, `healthProfile`, `aiPreferences` -- none contain a calorie target. **Needs confirmation:** Should we add a `calorieGoal` field to the `profiles` table, or derive it from health profile data (age, weight, gender, activity level)?

2. **No water goal exists.** The `fluidPresets` field on `profiles` stores drink types but no daily target. **Needs confirmation:** Should we add `dailyWaterGoalMl` to the profiles table?

3. **No favourites mechanism exists anywhere.** Searched the entire Convex schema and frontend codebase -- zero hits for "favourite" or "favorite". **Needs confirmation:** Should this be a new field on `profiles` (e.g., `favouriteFoods: string[]` of canonical names) or a separate Convex table?

4. **Nutrition data is sparse.** The `ingredientProfiles` table is per-user and populated on demand. For a new user, zero entries will have calorie data. **Needs confirmation:** Should we seed ingredient profiles from a global dataset, or should the UI treat missing nutrition as expected and display gracefully?

5. **The mock's `SavedMeal` has per-ingredient portions.** The real `foodLibrary` composite type stores only ingredient canonical names with no portion data. **Needs confirmation:** Does the PDH meal logging PRD specify adding portions to composites? If not, how should calorie totals be computed for saved meals?

6. **`defaultPortionG` has no real equivalent.** The real registry lacks default portion sizes. **Needs confirmation:** Should portion defaults be added to the registry entries, stored in `ingredientProfiles`, or hardcoded in a lookup table?

7. **Mock `detectMealSlot` times are wrong.** The spec says breakfast 5-9am, lunch 1-4pm, dinner 8-11pm. The mock uses breakfast 4-8h, snack 9-12h, lunch 13-16h, snack 17-19h, dinner 20-22h. **Action:** Implement the spec's time ranges, but also consider reading `profiles.aiPreferences.mealSchedule` for user-customized windows.

8. **The `isMeal` / `mealId` fields on FoodLogEntry do not exist** in the real log schema. It's unclear how the UI should distinguish a logged composite meal from individual food items. The real system's `FoodLogData.items` array can contain multiple items per log, which implicitly represents a "meal" -- but there is no flag or reference back to a `foodLibrary` composite.

9. **Async data loading.** The mock uses synchronous in-memory data. The real implementation needs Convex queries (`useQuery`) for ingredient profiles, food library, and synced logs. This introduces loading states that the mock components don't handle. Every component that displays calorie data will need a loading/skeleton state.

10. **MealSlot casing.** Mock uses PascalCase (`"Breakfast"`), real uses lowercase (`"breakfast"`). This affects all components that display or filter by meal slot.
