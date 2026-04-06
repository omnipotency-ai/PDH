# W0-01 Analysis: Agent Alpha -- Mock-to-Real Mapping Audit

**Date:** 2026-04-03
**Scope:** All 9 Agent A mock component files vs. real domain types, schema, and data layer.

---

## 1. Type & Interface Mappings

### 1.1 mockData.FoodItem (mockData.ts:9-19)

| Mock Field          | Real Equivalent                                                                          | Notes                                                                                                                                   |
| ------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `id: string`        | No direct equivalent                                                                     | Real registry uses `canonical: string` as the key (foodRegistryData.ts:118). There is no `id` field on `FoodRegistryEntry`.             |
| `name: string`      | `canonical: string` (foodRegistryData.ts:118)                                            | The canonical name IS the identifier.                                                                                                   |
| `defaultPortionG`   | **Does not exist** on `FoodRegistryEntry`                                                | Real registry has no portion/serving size data. Portion is user-supplied at log time via `FoodItem.quantity` (domain.ts:330).           |
| `caloriesPer100g`   | `ingredientProfiles.nutritionPer100g.kcal` (schema.ts:125)                               | Per-user, per-ingredient. NOT on the registry entry itself.                                                                             |
| `proteinPer100g`    | `ingredientProfiles.nutritionPer100g.proteinG` (schema.ts:131)                           | Same -- lives in `ingredientProfiles` table, not registry.                                                                              |
| `carbsPer100g`      | `ingredientProfiles.nutritionPer100g.carbsG` (schema.ts:128)                             | Same.                                                                                                                                   |
| `fatPer100g`        | `ingredientProfiles.nutritionPer100g.fatG` (schema.ts:126)                               | Same.                                                                                                                                   |
| `unit: "g" \| "ml"` | `FoodItem.unit: string \| null` (domain.ts:331)                                          | Real type is broader (any string or null).                                                                                              |
| `isLiquid: boolean` | Derivable from `FoodRegistryEntry.subcategory` or `category` (foodRegistryData.ts:39-83) | Categories like "drink", "beverage", subcategories like "water", "juice", "hot_drink" indicate liquids. No explicit `isLiquid` boolean. |

**Summary:** `mockData.FoodItem` conflates the static food registry entry with per-user nutritional profile data. In the real app these are two separate concerns: `FoodRegistryEntry` (shared/foodRegistryData.ts:141-146) for identity/classification, and `ingredientProfiles` (convex/schema.ts:113-138) for nutrition data.

### 1.2 mockData.FoodLogEntry (mockData.ts:410-423)

| Mock Field   | Real Equivalent                                                                        | Notes                                                                                                                   |
| ------------ | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `id: string` | `LogEntry.id: string` (domain.ts:421)                                                  | Direct match.                                                                                                           |
| `foodId`     | No direct equivalent                                                                   | Real food logs don't reference a registry ID. They contain an `items` array of `FoodItem` objects with `canonicalName`. |
| `foodName`   | `FoodItem.parsedName` or `FoodItem.name` (domain.ts:323-325)                           | Real uses `parsedName` (new) or `name` (legacy).                                                                        |
| `portionG`   | `FoodItem.quantity: number \| null` (domain.ts:330)                                    | Real uses `quantity` + `unit`, not `portionG`.                                                                          |
| `calories`   | **Computed value** -- not stored on logs                                               | Must be derived from `ingredientProfiles.nutritionPer100g.kcal * quantity / 100`.                                       |
| `protein`    | **Computed** from `ingredientProfiles`                                                 | Same derivation pattern.                                                                                                |
| `carbs`      | **Computed** from `ingredientProfiles`                                                 | Same.                                                                                                                   |
| `fat`        | **Computed** from `ingredientProfiles`                                                 | Same.                                                                                                                   |
| `mealSlot`   | `FoodLogData.mealSlot?: "breakfast" \| "lunch" \| "dinner" \| "snack"` (domain.ts:370) | Real uses lowercase strings; mock uses title-case. Real is optional.                                                    |
| `timestamp`  | `LogEntry.timestamp: number` (domain.ts:422)                                           | Direct match.                                                                                                           |
| `isMeal`     | **Does not exist** in real schema                                                      | No boolean flag. Composites are handled via `foodLibrary` table's `type: "composite"`.                                  |
| `mealId`     | **Does not exist** in real schema                                                      | No meal reference. foodLibrary composites are tracked separately.                                                       |

**Summary:** The mock `FoodLogEntry` pre-computes and stores macros inline. The real system stores raw food items in `logs.data.items` and nutrition must be joined at read time from `ingredientProfiles`.

### 1.3 mockData.SavedMeal (mockData.ts:334-339)

| Mock Field      | Real Equivalent                                     | Notes                                                                                                            |
| --------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `id: string`    | `foodLibrary._id` (schema.ts:356-364)               | Convex document ID.                                                                                              |
| `name: string`  | `foodLibrary.canonicalName` (schema.ts:358)         | The canonical name serves as the name.                                                                           |
| `items[]`       | `foodLibrary.ingredients: string[]` (schema.ts:360) | Real stores canonical name strings, not `{foodId, portionG}` objects. No per-ingredient portions in the library. |
| `totalCalories` | **Does not exist** -- must be computed              | Join each ingredient's `ingredientProfiles.nutritionPer100g.kcal` at read time.                                  |

**Key difference:** Real `foodLibrary` entries store only canonical ingredient names, with `type: "ingredient" | "composite"` (schema.ts:359). There are no pre-computed calorie totals and no per-ingredient portion sizes. The mock's `SavedMeal` concept maps to a `foodLibrary` composite entry, but the shape is substantially different.

### 1.4 mockData.MealSlot (mockData.ts:396)

Mock defines: `"Breakfast" | "Lunch" | "Dinner" | "Snack"` (title-case).
Real defines: `"breakfast" | "lunch" | "dinner" | "snack"` (lowercase) at domain.ts:370 and validators.ts:377-382.

**Action required:** Normalize to lowercase throughout. The mock type must be replaced.

---

## 2. Data & Constants Mappings

### 2.1 mockData.FOOD_REGISTRY (mockData.ts:21-330)

- **Mock:** 28 entries, each a `FoodItem` with inline nutrition (kcal, protein, carbs, fat per 100g).
- **Real:** 148 canonical entries in `FOOD_REGISTRY` (shared/foodRegistryData.ts:4321-4322), each a `FoodRegistryEntry` with zone, group, line, digestion metadata -- but **no nutrition data**.

**Shape comparison:**

| Mock field        | Real `FoodRegistryEntry` field          | Present?         |
| ----------------- | --------------------------------------- | ---------------- |
| `id`              | (none -- `canonical` is the key)        | NO               |
| `name`            | `canonical`                             | YES (renamed)    |
| `defaultPortionG` | (none)                                  | NO               |
| `caloriesPer100g` | (none -- see ingredientProfiles)        | NO               |
| `proteinPer100g`  | (none)                                  | NO               |
| `carbsPer100g`    | (none)                                  | NO               |
| `fatPer100g`      | (none)                                  | NO               |
| `unit`            | (none)                                  | NO               |
| `isLiquid`        | Derivable from `category`/`subcategory` | INDIRECT         |
| (none)            | `zone: 1 \| 2 \| 3`                     | YES (mock lacks) |
| (none)            | `group: FoodGroup`                      | YES (mock lacks) |
| (none)            | `line: FoodLine`                        | YES (mock lacks) |
| (none)            | `category`, `subcategory`               | YES (mock lacks) |
| (none)            | `examples: string[]`                    | YES (mock lacks) |
| (none)            | Digestion metadata fields               | YES (mock lacks) |

### 2.2 mockData.SAVED_MEALS (mockData.ts:341-392)

5 mock saved meals. Real equivalent: `foodLibrary` composites (convex/schema.ts:356-364). These are per-user, stored in Convex, not hard-coded constants.

### 2.3 mockData.INITIAL_FOOD_LOGS (mockData.ts:428-534)

8 mock log entries with pre-computed macros. Real: `logs` table rows where `type = "food"` (schema.ts:24-38), fetched via `SyncedLogsContext` / `useAllSyncedLogs()` (SyncedLogsContext.tsx:10).

### 2.4 mockData.WATER_GOAL_ML / INITIAL_WATER_ML (mockData.ts:538-539)

- **Does not exist** as a first-class concept in the real app.
- Water is tracked as fluid logs (`type: "fluid"` in logs table, domain.ts:373-375).
- Water intake is derived by summing fluid logs where the fluid name is "water".
- Water goal: **No water-specific goal exists**. The `BaselineAverages` type (domain.ts:496) has `waterAvgMlPerDay` for baselines, but there is no user-configurable water goal field in profiles or anywhere else.

### 2.5 mockData.CALORIE_GOAL (mockData.ts:544)

- **Does not exist** in the real schema. No `calorieGoal` field on profiles, aiPreferences, or any other table.
- This will need to be added (likely to `profiles` table) or derived from health profile data.

### 2.6 mockData.INITIAL_FAVOURITES (mockData.ts:547)

- **Does not exist** anywhere in the real app. No `favourites` field in profiles, no favourites table, no favourites concept.
- Grep for "favourite" and "favorite" across both `src/` and `convex/` returns zero results.
- **Must be created** -- likely as an array field on `profiles` or a new lightweight table.

---

## 3. Function Mappings

### 3.1 mockData.calculateCalories (mockData.ts:555-557)

```ts
// Mock: (food.caloriesPer100g * portionG) / 100
```

**Real equivalent:** Must be computed as:

```ts
(ingredientProfile.nutritionPer100g.kcal * quantity) / 100;
```

Where `ingredientProfile` is fetched from the `ingredientProfiles` table (convex/ingredientProfiles.ts:56-72) by canonical name, and `quantity` comes from `FoodItem.quantity` on the log entry.

**Critical gap:** `nutritionPer100g.kcal` is `number | null` (schema.ts:125). Must handle null (ingredient has no known calorie data).

### 3.2 mockData.detectMealSlot (mockData.ts:398-406)

**Mock time ranges (INCORRECT per task spec):**

- Breakfast: 4-8am
- Snack: 9-12pm
- Lunch: 1-4pm
- Snack: 5-7pm
- Dinner: 8-10pm
- Snack: all other hours

**Corrected time ranges per task requirements:**

- Breakfast: 5-9am
- Lunch: 1-4pm
- Dinner: 8-11pm
- Snack: all other hours

**Real app equivalent:** `MealSchedule` in `AiPreferences` (domain.ts:129-136) defines user-configurable meal times as strings (e.g., "08:00", "13:00", "18:00"). The real implementation should derive meal slot from these user preferences rather than hard-coded hour ranges.

### 3.3 mockData.getFoodById (mockData.ts:551-553)

**Real equivalent:** `getFoodEntry(canonicalName)` from `shared/foodRegistryUtils.ts` (re-exported via `shared/foodRegistry.ts:32`). Lookup is by canonical name string, not by numeric ID.

### 3.4 mockData.calculateMacro (mockData.ts:559-561)

Same pattern as `calculateCalories` -- compute `(per100g * portionG) / 100`. Real implementation must pull from `ingredientProfiles.nutritionPer100g` fields.

### 3.5 mockData.getPortionIncrement (mockData.ts:563-570)

**Does not exist** in real app. This is a UI affordance. Must be created. Could derive from `FoodRegistryEntry.subcategory` or hard-code per-category defaults.

### 3.6 mockData.formatPortion (mockData.ts:572-574)

**Does not exist** in real app. Trivial utility -- `${amount}${unit}`. The real `FoodItem.defaultPortionDisplay` (domain.ts:335) serves a similar purpose.

---

## 4. Store / State Mappings

### 4.1 useNutritionStore State (useNutritionStore.ts:48-62)

| State field        | Real source                                                                          | Mapping                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `view`             | **Ephemeral UI state** -- Zustand or local state                                     | No Convex equivalent needed.                                                                    |
| `searchQuery`      | **Ephemeral UI state**                                                               | Same.                                                                                           |
| `stagingItems`     | **Ephemeral UI state**                                                               | Same -- staging is pre-commit.                                                                  |
| `stagingModalOpen` | **Ephemeral UI state**                                                               | Same.                                                                                           |
| `waterModalOpen`   | **Ephemeral UI state**                                                               | Same.                                                                                           |
| `waterAmount`      | **Ephemeral UI state**                                                               | Same.                                                                                           |
| `waterIntake`      | **Derived** from fluid logs: `sum(logs.filter(type="fluid", name="water").quantity)` | Must query `SyncedLogsContext` and filter.                                                      |
| `waterGoal`        | **Does not exist** -- needs creating                                                 | Add to profiles or use a default constant.                                                      |
| `foodLogs`         | `SyncedLogsContext` filtered to `type === "food"`                                    | Use `useSyncedLogsContext()` from SyncedLogsContext.tsx:40-46, filter by type and today's date. |
| `favourites`       | **Does not exist** -- needs creating                                                 | See section 2.6 above.                                                                          |
| `calorieGoal`      | **Does not exist** -- needs creating                                                 | See section 2.5 above.                                                                          |
| `activeMealSlot`   | **Derived** from `MealSchedule` in `aiPreferences`                                   | User-configurable schedule at domain.ts:129-136.                                                |
| `filterMealSlot`   | **Ephemeral UI state**                                                               | Same.                                                                                           |

### 4.2 useNutritionStore Derived Values (useNutritionStore.ts:256-335)

| Derived value        | How to compute from real data                                                                                                    |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `totalCaloriesToday` | Sum `nutritionPer100g.kcal * item.quantity / 100` for each food item in today's food logs, joining against `ingredientProfiles`. |
| `totalMacrosToday`   | Same join, summing `proteinG`, `carbsG`, `fatG`.                                                                                 |
| `logsByMealSlot`     | Group today's food logs by `data.mealSlot`.                                                                                      |
| `caloriesByMealSlot` | Same grouping with calorie summation.                                                                                            |
| `searchResults`      | Fuse.js search against `FOOD_REGISTRY` canonical names. Must adapt to use `FoodRegistryEntry.canonical` + `examples`.            |
| `recentFoods`        | Deduplicated food logs sorted by timestamp desc.                                                                                 |
| `favouriteFoods`     | Requires new persistence mechanism.                                                                                              |

---

## 5. Component Import Audit

### 5.1 NutritionCard.tsx Imports (NutritionCard.tsx:1-32)

| Import                     | Source file  | Real equivalent exists?               |
| -------------------------- | ------------ | ------------------------------------- |
| `lucide-react` icons       | External dep | YES -- already in project             |
| `sonner/toast`             | External dep | YES -- already in project             |
| `@/components/ui/badge`    | UI lib       | YES                                   |
| `@/components/ui/button`   | UI lib       | YES                                   |
| `@/components/ui/input`    | UI lib       | YES                                   |
| `@/components/ui/tooltip`  | UI lib       | YES                                   |
| `@/lib/utils` (cn)         | Utility      | YES                                   |
| `CalorieDetailView`        | Local        | Mock component -- needs rewrite       |
| `FavouritesView`           | Local        | Mock component -- needs rewrite       |
| `MealSlotFilterView`       | Local        | Mock component -- needs rewrite       |
| `mockData` types/functions | Local mock   | Must be replaced with real imports    |
| `StagingModal`             | Local        | Mock component -- needs rewrite       |
| `useNutritionStore`        | Local mock   | Must be replaced with real data hooks |
| `WaterModal`               | Local        | Mock component -- needs rewrite       |

### 5.2 Third-Party Dependencies

| Dependency | Used in                  | In project?                              |
| ---------- | ------------------------ | ---------------------------------------- |
| `fuse.js`  | useNutritionStore.ts:1   | Needs verification -- check package.json |
| `date-fns` | MealSlotFilterView.tsx:1 | YES -- already in project                |

---

## 6. ingredientProfiles Table Audit

### 6.1 Schema Definition (convex/schema.ts:113-138)

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

Indexes: `by_userId`, `by_userId_canonicalName` (schema.ts:137-138).

### 6.2 Queries/Mutations (convex/ingredientProfiles.ts)

- `list` (line 43): Returns all profiles for authenticated user, sorted by `updatedAt` desc.
- `byIngredient` (line 56): Lookup single profile by `canonicalName` for authenticated user.
- `upsert` (line 74): Create or update a profile. Uses `resolveCanonicalFoodName` for normalization. Merges nutrition fields via patch semantics (line 109-121).

### 6.3 nutritionPer100g Field Structure

The `nutritionPer100g` object has 8 fields (schema.ts:124-133), all `number | null`:

- `kcal` -- maps to mock's `caloriesPer100g`
- `proteinG` -- maps to mock's `proteinPer100g`
- `carbsG` -- maps to mock's `carbsPer100g`
- `fatG` -- maps to mock's `fatPer100g`
- `saturatedFatG` -- **no mock equivalent** (mock lacks this)
- `sugarsG` -- **no mock equivalent**
- `fiberG` -- **no mock equivalent** (clinically important for PDH)
- `saltG` -- **no mock equivalent**

### 6.4 Coverage Estimate

The `ingredientProfiles` table is **per-user** -- profiles are created per user per ingredient. The FOOD_REGISTRY has 148 canonical entries. Coverage depends entirely on:

1. Whether any batch seeding has been performed for the user
2. Whether OpenFoodFacts data has been imported (source: `"openfoodfacts"`)

Without querying the live database, the expected state is: **near-zero pre-populated profiles** unless the user has manually upserted them or a migration/seed script has run. The `source` field being nullable and the `upsert` mutation's design (ingredientProfiles.ts:74-193) confirm this is a lazy-population model -- profiles are created on demand, not pre-seeded.

**Implication for Nutrition Card:** Many foods will have `null` nutrition values. The UI must gracefully handle missing calorie/macro data -- showing "unknown" or prompting the user to enter values rather than displaying 0.

---

## 7. Assumptions Requiring Validation

1. **No calorie goal exists in the real system.** Confirmed by schema audit -- `profiles` table (schema.ts:331-354) has no `calorieGoal` field. Must be added or the feature must be redesigned.

2. **No water goal exists in the real system.** Same -- no `waterGoal` field anywhere. Must be added or use a sensible default.

3. **No favourites mechanism exists.** Zero references to "favourite" or "favorite" in `src/` or `convex/`. Must be designed and implemented (likely a `favouriteFoods: string[]` field on profiles, or a new table).

4. **Fuse.js dependency status.** The mock uses `fuse.js` for fuzzy search (useNutritionStore.ts:1). Need to verify this is in `package.json`. If not, it must be added or an alternative search approach used.

5. **ingredientProfiles coverage is likely sparse.** The calorie/macro display features assume nutrition data exists for logged foods. In practice, many profiles may have `null` kcal/proteinG/carbsG/fatG. The Nutrition Card must handle this gracefully.

6. **detectMealSlot should use MealSchedule.** The mock hard-codes time ranges. The real app has a user-configurable `MealSchedule` (domain.ts:129-136) with named meal times. The implementation should read from `aiPreferences.mealSchedule` and derive the current slot, falling back to the corrected defaults (breakfast 5-9am, lunch 1-4pm, dinner 8-11pm).

7. **Food log structure is fundamentally different.** Mock stores one FoodLogEntry per food item with inline macros. Real stores one log entry with a `data.items[]` array of `FoodItem` objects. The mapping is 1:many, not 1:1.

8. **SavedMeal portions are not stored.** Real `foodLibrary` composites store only ingredient names (schema.ts:360), not `{foodId, portionG}` pairs. If the Nutrition Card needs per-ingredient portions for saved meals, this must be designed.

9. **Water intake derivation.** To compute current water intake, filter `SyncedLogs` where `type === "fluid"`, then sum `data.items` where `name` matches "water" (case-insensitive). The `FluidLogData` structure (domain.ts:373-375) stores `items: Array<{ name, quantity, unit }>`.

10. **The mock's `isMeal` / `mealId` concept has no direct equivalent.** Real system uses `foodLibrary` composites, but the link between a logged food entry and a saved composite is not stored on the log itself.

---

## 8. Risk Summary

| Risk                                               | Severity | Detail                                                                                             |
| -------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------- |
| Missing nutrition data for many foods              | HIGH     | `ingredientProfiles` is lazily populated; many entries will have null kcal/macros                  |
| No calorie goal, water goal, or favourites storage | MEDIUM   | Three features need new persistence (schema changes or profile field additions)                    |
| Meal slot casing mismatch                          | LOW      | Mock uses title-case; real uses lowercase. Straightforward fix.                                    |
| Food log shape mismatch                            | HIGH     | Mock assumes 1:1 log:food; real is 1:many via `data.items[]`. Component logic needs restructuring. |
| SavedMeal shape mismatch                           | MEDIUM   | Mock stores portions per ingredient; real `foodLibrary` stores only canonical names.               |
