# W0-01 Analysis: Agent Gamma -- Mock-to-Real Mapping Audit

**Agent:** Gamma  
**Date:** 2026-04-03  
**Scope:** Line-by-line mapping of Agent A mock types, data, and functions to real-app equivalents.

---

## 1. Type & Interface Mappings

### 1.1 mockData.FoodItem (mockData.ts:9-19)

Mock fields:

- `id: string` -- synthetic ID (e.g. "f01")
- `name: string` -- display name
- `defaultPortionG: number` -- default serving size
- `caloriesPer100g: number` -- kcal per 100g
- `proteinPer100g: number` -- protein per 100g
- `carbsPer100g: number` -- carbs per 100g
- `fatPer100g: number` -- fat per 100g
- `unit: "g" | "ml"` -- measurement unit
- `isLiquid: boolean` -- liquid flag

**Real equivalent: FoodRegistryEntry** (`shared/foodRegistryData.ts:116-146`)

The real `FoodRegistryEntry` has a completely different shape. It is a clinical-recovery food classification, NOT a nutrition-data object:

- `canonical: string` (not `name`)
- `zone: FoodZone` (1/2/3 recovery zones)
- `category: FoodCategory`, `subcategory: FoodSubcategory`
- `macros: ReadonlyArray<"protein" | "carbohydrate" | "fat">`
- `group: FoodGroup`, `line: FoodLine`, `lineOrder: number`
- `examples: ReadonlyArray<string>` (user-typed aliases)
- Digestion metadata: osmoticEffect, totalResidue, fiberTotalApproxG, etc.

**Critical gap:** The real registry has ZERO nutrition-per-100g data (no kcal, protein, carbs, fat fields). Nutritional data lives in a separate table: `ingredientProfiles` (see Section 4 below).

The mock `FoodItem` also differs from `domain.ts:320-352` (`FoodItem`), which is a _food-log item_ (what the user typed), not a registry entry. That domain `FoodItem` has `userSegment`, `parsedName`, `resolvedBy`, `canonicalName`, `quantity`, `unit`, `matchConfidence`, etc.

**Mapping verdict:** No 1:1 equivalent. The mock conflates the registry entry (identity) with nutritional profile data (separate table). Integration must join `FoodRegistryEntry` + `ingredientProfiles.nutritionPer100g` to reconstruct mock's shape.

### 1.2 mockData.FoodLogEntry (mockData.ts:410-423)

Mock fields:

- `id, foodId, foodName, portionG, calories, protein, carbs, fat`
- `mealSlot: MealSlot` -- "Breakfast" | "Lunch" | "Dinner" | "Snack"
- `timestamp: number`
- `isMeal: boolean`, `mealId?: string`

**Real equivalent: logs table** (`convex/schema.ts:24-38`) with type="food", plus `FoodLogData` (`src/types/domain.ts:366-371`)

Real food log structure:

- `logs` table row: `{ userId, timestamp, type: "food", data: FoodLogData }`
- `FoodLogData`: `{ rawInput?, items: FoodItem[], notes?, mealSlot?: "breakfast"|"lunch"|"dinner"|"snack" }`
- Each `FoodItem` in `items[]` has: `canonicalName`, `quantity`, `unit`, `preparation`, `recoveryStage`, etc.

**Key differences:**

1. Mock stores flat per-food-item calories/macros directly. Real stores raw food items without pre-computed macros -- macros must be computed by joining with `ingredientProfiles.nutritionPer100g`.
2. Mock `mealSlot` uses title-case ("Breakfast"). Real uses lowercase ("breakfast") -- see `convex/validators.ts:377-383`.
3. Mock has `isMeal` / `mealId` fields. Real has no such fields -- composites are tracked via `foodLibrary` table (`type: "composite"`).
4. Mock stores one food per log entry. Real stores an array of `FoodItem[]` per log entry (multi-item).
5. Real log items have no `foodId` field; they use `canonicalName` to link to the registry.

### 1.3 mockData.SavedMeal (mockData.ts:334-339)

Mock fields:

- `id: string`
- `name: string`
- `items: Array<{ foodId: string; portionG: number }>`
- `totalCalories: number`

**Real equivalent: foodLibrary table with type="composite"** (`convex/schema.ts:356-364`)

Real composite shape:

- `canonicalName: string` (the composite's name, e.g. "scrambled eggs on toast")
- `type: "composite"`
- `ingredients: string[]` (array of canonical ingredient names)
- `createdAt: number`

**Key differences:**

1. Mock stores portion sizes per ingredient. Real composites only store ingredient names, not portions.
2. Mock pre-computes `totalCalories`. Real has no calorie storage on composites.
3. Mock uses synthetic IDs. Real uses Convex document `_id`.
4. Real composites are user-scoped (`userId`). Mock composites are global.

### 1.4 mockData.MealSlot (mockData.ts:396)

Mock type: `"Breakfast" | "Lunch" | "Dinner" | "Snack"` (title-case)

**Real equivalent:** `convex/validators.ts:377-383` and `domain.ts:370`

Real type: `"breakfast" | "lunch" | "dinner" | "snack"` (lowercase)

**Casing mismatch must be normalized during integration.**

### 1.5 useNutritionStore.StagedItem (useNutritionStore.ts:24-35)

**Does not exist in real app.** This is a UI-only ephemeral type for the staging area before food is logged. It should remain a client-side type (Zustand or useReducer state), not persisted to Convex.

### 1.6 useNutritionStore.NutritionView (useNutritionStore.ts:39-44)

**Does not exist in real app.** Pure UI state for which panel is expanded. Should stay client-side.

### 1.7 useNutritionStore.NutritionState (useNutritionStore.ts:48-62)

Ephemeral UI state. No real-app equivalent -- this is a view model. Its fields derive from real data as follows:

- `waterIntake` / `waterGoal` -- see Section 3.1
- `foodLogs` -- see Section 3.2
- `favourites` -- see Section 3.3
- `calorieGoal` -- see Section 3.4

---

## 2. Function Mappings

### 2.1 mockData.FOOD_REGISTRY (mockData.ts:21-330)

Mock: 28 entries, each with per-100g nutrition data (kcal, protein, carbs, fat).

**Real: `FOOD_REGISTRY` in `shared/foodRegistryData.ts`** -- **148 entries** (canonical count), organized by recovery zone (1A, 1B, 2, 3) with clinical digestion metadata but ZERO per-100g nutrition values.

**Entry count difference:** 28 mock vs 148 real (5.3x more in real).  
**Shape difference:** Fundamental. Mock has `caloriesPer100g`, `proteinPer100g`, `carbsPer100g`, `fatPer100g`. Real has `zone`, `group`, `line`, `macros`, `examples`, digestion metadata (`osmoticEffect`, `totalResidue`, `fiberTotalApproxG`, `gasProducing`, etc.).

### 2.2 mockData.calculateCalories (mockData.ts:555-557)

```ts
function calculateCalories(food: FoodItem, portionG: number): number {
  return Math.round((food.caloriesPer100g * portionG) / 100);
}
```

**Real computation path:**

1. Look up `ingredientProfiles` row for the food's `canonicalName` (via `ingredientProfiles.byIngredient` query, `convex/ingredientProfiles.ts:56-72`).
2. Read `nutritionPer100g.kcal` (which can be `null`).
3. If `kcal` is not null and portion is known: `Math.round((kcal * portionG) / 100)`.
4. If `kcal` is null, the calorie count is unknown -- UI must handle this gracefully.

**Same formula, different data source.** The mock reads from the registry entry directly; the real app requires a join to `ingredientProfiles`.

### 2.3 mockData.calculateMacro (mockData.ts:559-561)

Same formula as calculateCalories but returns one decimal place. Real equivalent: same math, applied to `nutritionPer100g.proteinG`, `.carbsG`, `.fatG` from `ingredientProfiles`.

### 2.4 mockData.detectMealSlot (mockData.ts:398-406)

Mock logic:

- 4-8 = Breakfast, 9-12 = Snack, 13-16 = Lunch, 17-19 = Snack, 20-22 = Dinner, else = Snack

**Required corrections per task spec:**

- Breakfast: 5-9am (hours 5-8, i.e. hour >= 5 && hour <= 8)
- Lunch: 1-4pm (hours 13-15, i.e. hour >= 13 && hour <= 15)
- Dinner: 8-11pm (hours 20-22, i.e. hour >= 20 && hour <= 22)
- Everything else: Snack

**Real app equivalent:** `domain.ts:129-136` defines `MealSchedule` with configurable times per user (`breakfast: "08:00"`, `lunch: "13:00"`, `dinner: "18:00"`, etc. in `DEFAULT_AI_PREFERENCES`). The real app uses user-configurable meal windows, not hardcoded hour ranges. The Nutrition Card should ideally use `MealSchedule` from `AiPreferences` rather than a hardcoded function.

### 2.5 mockData.getFoodById (mockData.ts:551-553)

Mock: linear search of `FOOD_REGISTRY` by `id` field.

Real equivalent: `getFoodEntry(canonicalName)` from `shared/foodRegistryUtils.ts` (exported via `shared/foodRegistry.ts:32`). Looks up by canonical name string, not a synthetic ID.

### 2.6 mockData.getPortionIncrement (mockData.ts:563-570)

**Does not exist in real app.** This is UI-only logic for +/- stepper behavior. Can remain client-side. The hardcoded food-name checks (`food.name.startsWith("Toast")`) are fragile and should be refactored to use a property-based approach.

### 2.7 mockData.formatPortion (mockData.ts:572-574)

**Does not exist in real app.** Trivial string formatter. Can remain client-side.

### 2.8 SAVED_MEALS constant (mockData.ts:341-392)

Mock: 5 hardcoded meal composites with ingredient refs and total calories.

Real: `foodLibrary` table, queried via `foodLibrary.list` (`convex/foodLibrary.ts:77-117`). Returns user-scoped entries. Currently has no pre-computed calorie totals -- these must be derived by summing ingredient profile nutritionPer100g values.

### 2.9 Fuse.js search (useNutritionStore.ts:237-248)

Mock: Client-side fuzzy search over `FOOD_REGISTRY` and `SAVED_MEALS` using Fuse.js.

Real: The registry provides `CANONICAL_FOOD_NAMES` (exported from `shared/foodRegistryUtils.ts`). Server-side, `foodEmbeddings` table provides vector search. For client-side search, Fuse.js over registry canonical names is reasonable, but the search corpus should be the real 148-entry registry plus user's foodLibrary composites.

---

## 3. State Derivation Mappings

### 3.1 waterIntake / waterGoal

Mock: `INITIAL_WATER_ML = 450`, `WATER_GOAL_ML = 1000` (hardcoded constants, mockData.ts:538-539).

**Real: No water goal exists anywhere in the codebase.** Searched `waterGoal`, `water_goal`, `fluidGoal`, `fluid_goal` across entire project -- zero results outside Agent A worktree.

Water intake must be derived from fluid logs:

- Filter `SyncedLog[]` where `type === "fluid"` and today's date.
- Sum `data.items` where `name` matches "water" (case-insensitive).
- `FluidLogData` shape: `{ items: Array<{ name: string; quantity: number; unit: string }> }` (`domain.ts:373-375`).

The `BaselineAverages` type (`domain.ts:494-496`) has `waterAvgMlPerDay` and `totalFluidAvgMlPerDay` which could inform a suggested goal, but no explicit goal field exists.

**Action needed:** Water goal needs a storage mechanism. Options: (a) add to `profiles` table, (b) hardcode a sensible default (e.g. 1000ml post-surgery), (c) derive from baseline averages.

### 3.2 foodLogs

Mock: `INITIAL_FOOD_LOGS` array in local state (mockData.ts:428-534).

**Real:** Query `SyncedLog[]` from `SyncedLogsContext` (`src/contexts/SyncedLogsContext.tsx:40-46`), filter for `type === "food"`, and filter for today. Each food log contains `data.items: FoodItem[]`. The `SyncedLog` type (`src/lib/syncCore.ts:276-283`) mirrors `LogEntry` from `domain.ts:418-425`.

### 3.3 favourites

Mock: `INITIAL_FAVOURITES: string[] = ["f03", "f06", "f01", "f11", "f24"]` (mockData.ts:547).

**Real: Does not exist.** No "favourites" concept in schema, profiles, or any source file. Searched entire `src/` and `convex/` directories -- zero matches.

**Action needed:** Must be created. Options:

1. Add `favouriteFoods: v.optional(v.array(v.string()))` to `profiles` table (array of canonical names).
2. Create a separate `foodFavourites` table.
3. Use `foodLibrary` entries with a tag or marker.

Option 1 is simplest and consistent with how `knownFoods` is stored on profiles (`convex/schema.ts:349`).

### 3.4 calorieGoal

Mock: `CALORIE_GOAL = 1800` (mockData.ts:543).

**Real: Does not exist.** Searched entire project -- `calorieGoal` only appears in agent spec documents, not in any schema, type, or component file.

**Action needed:** Similar to water goal -- needs a storage mechanism. Could be added to `profiles` table or derived from health profile data.

---

## 4. ingredientProfiles Audit

### 4.1 Table Definition (convex/schema.ts:113-138)

```
ingredientProfiles: defineTable({
  userId: v.string(),
  canonicalName: v.string(),
  displayName: v.string(),
  tags: v.array(v.string()),
  foodGroup: v.union(foodGroupValidator, v.null()),
  foodLine: v.union(foodLineValidator, v.null()),
  lowResidue: v.union(v.boolean(), v.null()),
  source: v.union(v.literal("manual"), v.literal("openfoodfacts"), v.null()),
  externalId: v.union(v.string(), v.null()),
  ingredientsText: v.union(v.string(), v.null()),
  nutritionPer100g: v.object({
    kcal: v.union(v.number(), v.null()),
    fatG: v.union(v.number(), v.null()),
    saturatedFatG: v.union(v.number(), v.null()),
    carbsG: v.union(v.number(), v.null()),
    sugarsG: v.union(v.number(), v.null()),
    fiberG: v.union(v.number(), v.null()),
    proteinG: v.union(v.number(), v.null()),
    saltG: v.union(v.number(), v.null()),
  }),
  createdAt: v.number(),
  updatedAt: v.number(),
})
```

### 4.2 nutritionPer100g Field Structure

8 fields, all nullable:
| Field | Mock Equivalent | Notes |
|-------|----------------|-------|
| `kcal` | `caloriesPer100g` | Direct mapping |
| `proteinG` | `proteinPer100g` | Direct mapping |
| `carbsG` | `carbsPer100g` | Direct mapping |
| `fatG` | `fatPer100g` | Direct mapping |
| `saturatedFatG` | -- | No mock equivalent; extra detail |
| `sugarsG` | -- | No mock equivalent; extra detail |
| `fiberG` | -- | No mock equivalent; extra detail |
| `saltG` | -- | No mock equivalent; extra detail |

The real schema has 4 additional nutrition fields (saturatedFat, sugars, fiber, salt) that the mock does not model. The mock's `isLiquid` and `unit` fields have no equivalent in `ingredientProfiles`.

### 4.3 Queries and Mutations (convex/ingredientProfiles.ts)

- `list` (line 43-53): Returns all profiles for the authenticated user, sorted by `updatedAt` desc.
- `byIngredient` (line 56-72): Looks up a single profile by `canonicalName` (resolved via `resolveCanonicalFoodName`).
- `upsert` (line 74-193): Creates or updates a profile. Merges nutrition patches. Auto-populates `foodGroup` and `foodLine` from the registry projection.

### 4.4 Coverage Estimate

**The `ingredientProfiles` table is user-scoped and populated on demand.** It is NOT pre-seeded with nutrition data for all 148 registry entries. Profiles are created when:

1. A user manually enters nutrition data (source: "manual").
2. Data is imported from OpenFoodFacts (source: "openfoodfacts").

The `nutritionPer100g` object defaults to all-nulls (`blankNutrition()` at `convex/ingredientProfiles.ts:30-40`). This means:

**Estimated coverage: Near-zero for a new user.** Until the user or an admin populates nutrition data, most registry entries will have `kcal: null`, `proteinG: null`, etc. The Nutrition Card must handle null nutrition gracefully -- showing "unknown" or hiding macro breakdowns when data is unavailable.

This is a fundamental architectural gap vs. the mock, which assumes 100% nutrition coverage for all 28 foods.

---

## 5. Import Audit

### 5.1 External Dependencies Used by Agent A

| Import                         | File                     | Real App Status                                         |
| ------------------------------ | ------------------------ | ------------------------------------------------------- |
| `fuse.js`                      | useNutritionStore.ts:1   | Not in real app dependencies -- needs `bun add fuse.js` |
| `date-fns/formatDistanceToNow` | MealSlotFilterView.tsx:1 | Already in real app (`date-fns` is a dependency)        |
| `lucide-react` icons           | Multiple files           | Already in real app                                     |
| `sonner/toast`                 | NutritionCard.tsx:12     | Already in real app                                     |
| `@/components/ui/badge`        | NutritionCard.tsx:13     | Already in real app                                     |
| `@/components/ui/button`       | Multiple files           | Already in real app                                     |
| `@/components/ui/input`        | NutritionCard.tsx:15     | Already in real app                                     |
| `@/components/ui/tooltip`      | NutritionCard.tsx:16     | Already in real app                                     |
| `@/lib/utils` (cn)             | Multiple files           | Already in real app                                     |

### 5.2 Missing Integrations

The mock imports nothing from:

- `convex/` (no Convex queries or mutations)
- `@/contexts/SyncedLogsContext` (no real log data)
- `@/hooks/useProfile` (no user profile/preferences)
- `shared/foodRegistry` (no real registry)
- Any Convex `useQuery`/`useMutation` hooks

---

## 6. Assumptions Requiring Validation

1. **Nutrition data availability.** The mock assumes 100% nutrition coverage. Real `ingredientProfiles` starts empty for new users. **Must confirm:** Is there a plan to pre-seed nutrition data, or must the UI handle null gracefully? (Gamma recommends: always handle null; display "-- kcal" when unknown.)

2. **Water goal source.** No `waterGoal` field exists anywhere in the real schema. **Must decide:** Where should water goal be stored? Profiles table extension? User preferences? Hardcoded default?

3. **Calorie goal source.** Same as water goal -- no `calorieGoal` field exists. **Must decide** storage location before integration.

4. **Favourites storage.** No favourites mechanism exists. **Must decide:** Add to profiles table (like `knownFoods` pattern at `schema.ts:349`) or create new table?

5. **MealSlot casing.** Mock uses title-case ("Breakfast"), real uses lowercase ("breakfast"). This must be normalized consistently. Recommend: use lowercase everywhere (matching `convex/validators.ts:377-383`) and convert to title-case only for display.

6. **detectMealSlot vs MealSchedule.** The mock uses hardcoded hour ranges. The real app has user-configurable `MealSchedule` in `AiPreferences` (`domain.ts:129-136`). **Must decide:** Use the configurable schedule (correct) or hardcoded ranges (simpler but inconsistent)?

7. **Fuse.js dependency.** Not currently in `package.json`. Needs to be added if fuzzy client-side search is desired. Alternative: use the existing `foodEmbeddings` vector search server-side.

8. **Composite portion sizes.** Real `foodLibrary` composites only store ingredient names, not portions. Mock `SavedMeal` stores per-ingredient portions. **Must decide:** Extend `foodLibrary` schema to include portions, or derive portions from ingredientProfiles' default serving info?

9. **Per-log calorie pre-computation.** Mock stores computed calories per log entry. Real food logs store raw items without nutrition. **Must decide:** Compute on read (join with profiles) or compute on write (denormalize into log data)?

10. **isLiquid / unit fields.** The mock's `isLiquid` and `unit` ("g"|"ml") have no direct equivalent in the real registry. The registry's `subcategory` field can infer liquid status (e.g., subcategories "water", "juice", "broth", "hot_drink", "alcohol", "fizzy_drink" are liquids). The `FoodItem` in domain.ts has a `unit` field but it's freeform string, not restricted to "g"|"ml".

---

## 7. Summary of Integration Gaps

| Gap                                 | Severity     | Notes                                           |
| ----------------------------------- | ------------ | ----------------------------------------------- |
| No nutrition data in registry       | **Critical** | Must join with ingredientProfiles; handle nulls |
| No calorieGoal / waterGoal          | **High**     | Need new fields or defaults                     |
| No favourites system                | **High**     | Need new storage mechanism                      |
| MealSlot casing mismatch            | **Medium**   | Lowercase in real, title-case in mock           |
| FoodLogEntry shape mismatch         | **High**     | Flat vs nested items[], no pre-computed macros  |
| SavedMeal vs foodLibrary            | **Medium**   | No portions in real composites                  |
| detectMealSlot hardcoded            | **Low**      | Should use MealSchedule from preferences        |
| Fuse.js not installed               | **Low**      | Easy to add                                     |
| ingredientProfiles empty by default | **Critical** | UI must handle null nutrition everywhere        |
