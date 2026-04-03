# W0-01 Cross-Validated Data Model Mapping

**Date:** 2026-04-03
**Source:** Cross-validation of Alpha, Beta, and Gamma agent analyses
**Method:** Every factual claim verified against source files; contradictions resolved with line-number evidence

---

## 1. Consensus Findings

All three agents agreed on the following, and source verification confirms each:

### 1.1 FoodRegistryEntry has no nutrition data

The real `FoodRegistryEntry` (`shared/foodRegistryData.ts:116-146`) contains clinical/digestion metadata (zone, group, line, category, subcategory, macros, examples, digestion fields) but zero per-100g nutrition values. Nutrition data lives exclusively in the `ingredientProfiles` Convex table (`convex/schema.ts:113-138`). The mock `FoodItem` conflates these two separate concerns.

### 1.2 ingredientProfiles.nutritionPer100g field names

All three agents correctly mapped the 8 nullable fields at `convex/schema.ts:124-132`:

- `kcal` (maps to mock `caloriesPer100g`)
- `fatG` (maps to mock `fatPer100g`)
- `saturatedFatG` (no mock equivalent)
- `carbsG` (maps to mock `carbsPer100g`)
- `sugarsG` (no mock equivalent)
- `fiberG` (no mock equivalent)
- `proteinG` (maps to mock `proteinPer100g`)
- `saltG` (no mock equivalent)

All are `v.union(v.number(), v.null())` -- nullable. Verified at `convex/schema.ts:125-132`.

### 1.3 FoodLogData shape uses items[] array

Real food logs store `data.items: FoodItem[]` (`domain.ts:368`, `validators.ts:375`), not flat per-food entries. The mock's 1:1 FoodLogEntry-per-food model does not match the real 1:many log-to-items model. All three agents identified this correctly.

### 1.4 MealSlot casing mismatch

Mock: `"Breakfast" | "Lunch" | "Dinner" | "Snack"` (title-case).
Real: `"breakfast" | "lunch" | "dinner" | "snack"` (lowercase).
Verified at `domain.ts:370` and `validators.ts:378-383`.

### 1.5 Macros are not stored on log entries

All three agents agree: mock pre-computes calories/protein/carbs/fat on each log entry, but the real system stores only raw food items (name, quantity, unit). Nutrition must be computed at render time by joining `FoodItem.canonicalName` against `ingredientProfiles.nutritionPer100g`.

### 1.6 foodLibrary composites lack per-ingredient portions

Real `foodLibrary` composites (`convex/schema.ts:356-364`) store only `ingredients: v.array(v.string())` -- canonical name strings. No per-ingredient portion sizes, no pre-computed calorie totals. The mock `SavedMeal` type stores `{foodId, portionG}` objects plus `totalCalories`.

### 1.7 calorieGoal does not exist

Searched `profiles` table definition (`convex/schema.ts:331-354`) -- no `calorieGoal` field. Grep across `src/` and `convex/` returns zero matches for `calorieGoal` or `calorie_goal`. All three agents correct.

### 1.8 waterGoal does not exist

No `waterGoal`, `water_goal`, or `fluidGoal` field anywhere in the Convex schema or frontend code. The `BaselineAverages.waterAvgMlPerDay` (`domain.ts:496`) is a historical average, not a user-set goal. Beta additionally noted `fluidPresets` (`schema.ts:339`) stores drink types but no daily target. All three agents correct.

### 1.9 Favourites do not exist

Grep for `favourit` and `favorit` across `src/` and `convex/` returns zero results (excluding the agent analysis docs themselves). No favourites table, field, or concept exists. All three agents correct.

### 1.10 detectMealSlot time ranges need correction

All three agents agreed the mock's time ranges (4-8 breakfast, 9-12 snack, 13-16 lunch, etc.) differ from the spec requirements (5-9 breakfast, 13-16 lunch, 20-23 dinner, else snack). All noted the real app has a user-configurable `MealSchedule` type at `domain.ts:129-136`.

### 1.11 ingredientProfiles are lazily populated

All three agents correctly identified that the `ingredientProfiles` table is per-user, populated on demand, with `blankNutrition()` defaults (`convex/ingredientProfiles.ts:30-40`). A new user starts with zero profiles. UI must handle null nutrition gracefully.

### 1.12 getFoodEntry is the real lookup function

`getFoodEntry(canonicalName)` at `shared/foodRegistryUtils.ts:76-78`, re-exported via `shared/foodRegistry.ts:32`. Returns `FoodRegistryEntry | undefined`. All three agents identified this correctly.

---

## 2. Resolved Contradictions

### 2.1 Registry entry count: 147, not 148

**Alpha claimed:** 148 entries (`foodRegistryData.ts:4321-4322`)
**Beta claimed:** 148 entries
**Gamma claimed:** 148 entries

**Actual count: 147.** Verified by running `FOOD_REGISTRY.length` via `npx tsx`. The array is constructed at `foodRegistryData.ts:4314-4319` by spreading `ZONE_1A`, `ZONE_1B`, `ZONE_2`, `ZONE_3`, then exported at line 4321-4322 after `applyFoodEntryEnrichment`. **All three agents were wrong -- the correct count is 147.**

### 2.2 FoodLogEntry.id real equivalent

**Alpha claimed:** `LogEntry.id: string` at `domain.ts:421`
**Beta claimed:** `SyncedLog.id: string` at `syncCore.ts:278`

**Both are correct but referencing different type aliases of the same shape.** `LogEntry` is defined at `domain.ts:418-425` and `SyncedLog` is defined at `src/lib/syncCore.ts:276-283`. Both have identical shapes: `{ id: string; timestamp: number; type: K; data: LogDataMap[K] }`. In practice, the frontend uses `SyncedLog` from `syncCore.ts` (accessed via `SyncedLogsContext`), so Beta's reference is more operationally relevant. **No real contradiction -- just different type paths to the same shape.**

### 2.3 defaultPortionDisplay location

**Alpha claimed:** `FoodItem.defaultPortionDisplay` at `domain.ts:335` serves a similar purpose to `formatPortion`.
**Beta claimed:** `defaultPortionDisplay` exists on `foodItemValidator` at `validators.ts:361` as an optional display string, not a numeric gram value. Does NOT exist on `FoodRegistryEntry`.

**Both are correct and complementary.** `defaultPortionDisplay` is an optional `string` field on the `FoodItem` domain type (`domain.ts:333`) and the `foodItemValidator` (`validators.ts:361`). It is a display string (e.g., "1 slice"), NOT a numeric gram value. It does NOT exist on `FoodRegistryEntry`. Alpha's comparison to `formatPortion` is reasonable but the field's purpose (display hint from parsing) differs from the mock's `defaultPortionG` (numeric grams).

### 2.4 Fuse.js dependency status

**Alpha noted:** "Need to verify this is in `package.json`."
**Beta noted:** `fuse.js` used in `useNutritionStore.ts:1`, needs verification.
**Gamma claimed:** "Not in real app dependencies -- needs `bun add fuse.js`."

**Gamma was wrong. Fuse.js IS already a dependency.** Verified at `package.json:34`: `"fuse.js": "^7.1.0"`. Alpha and Beta were appropriately cautious but did not verify. Gamma made a definitive claim that was incorrect.

### 2.5 SyncedLog type location

**Alpha:** Did not reference `SyncedLog` directly -- used `LogEntry` from `domain.ts`.
**Beta:** Referenced `SyncedLog` at `syncCore.ts:278-279`.
**Gamma:** Referenced `SyncedLog` from `syncCore.ts:276-283`.

**Gamma's line range is more accurate.** The `SyncedLog` type definition spans lines 276-283 of `src/lib/syncCore.ts`. Beta's line 278 is the `id` field within the mapped type. The type is imported into `SyncedLogsContext.tsx:4` via `@/lib/sync`. Operationally, `SyncedLog` is the type used on the frontend, not `LogEntry` from `domain.ts`, though they have the same shape.

### 2.6 FoodItem.canonicalName optionality

**Alpha:** Referenced `FoodItem.canonicalName` (domain.ts:329) without noting optionality.
**Beta:** Referenced it at `domain.ts:329, validators.ts:357` and noted it links to the registry.
**Gamma:** Noted `canonicalName` is on log items but did not flag optionality.

**All missed an important detail.** `FoodItem.canonicalName` is `string | null` AND optional (`canonicalName?: string | null` at `domain.ts:329`; `v.optional(v.string())` at `validators.ts:357`). This means some logged food items may have NO canonical name (e.g., unresolved user input). The nutrition card must handle this: if `canonicalName` is missing, no `ingredientProfiles` lookup is possible.

---

## 3. Gaps Found (Caught by One Agent, Missed by Others)

### 3.1 Async data loading concern (Beta only)

Beta (assumption #9) flagged that the mock uses synchronous in-memory data, but the real implementation requires Convex queries (`useQuery`) for ingredient profiles, food library, and synced logs. This introduces loading states the mock components do not handle. Every component displaying calorie data needs a loading/skeleton state. Alpha and Gamma did not explicitly call this out.

### 3.2 isLiquid derivation detail (Gamma only)

Gamma (assumption #10) explicitly listed the subcategories that indicate liquids: `"water"`, `"juice"`, `"broth"`, `"hot_drink"`, `"alcohol"`, `"fizzy_drink"`. Verified at `foodRegistryData.ts:48-83`. Alpha mentioned derivability from category/subcategory but did not enumerate the values. Beta was similarly vague.

### 3.3 Per-log calorie pre-computation decision (Gamma only)

Gamma (assumption #9) raised the compute-on-read vs. compute-on-write question: should calories be computed at render time (join with profiles) or denormalized into log data? Alpha and Beta assumed compute-on-read without flagging it as a design decision.

### 3.4 foodEmbeddings alternative to Fuse.js (Gamma only)

Gamma (section 2.9) noted the `foodEmbeddings` table provides server-side vector search as an alternative to client-side Fuse.js. Alpha and Beta only discussed Fuse.js without mentioning this existing alternative.

### 3.5 Component-level import analysis (Beta only)

Beta (section 6) provided a per-component breakdown of which specific imports need changing in `StagingModal.tsx`, `WaterModal.tsx`, `CalorieDetailView.tsx`, `FavouritesView.tsx`, and `MealSlotFilterView.tsx`. Alpha and Gamma only analyzed `NutritionCard.tsx` and `useNutritionStore.ts` imports.

### 3.6 WaterModal is self-contained (Beta only)

Beta (section 6.2) noted `WaterModal.tsx` has no mock data imports and receives all state via props. No changes needed beyond ensuring the parent passes real data. This useful detail was not mentioned by Alpha or Gamma.

### 3.7 knownFoods as a pattern for favourites (Gamma only)

Gamma (section 3.3) suggested modelling `favouriteFoods` as `v.optional(v.array(v.string()))` on the `profiles` table, noting this is consistent with how `knownFoods` is already stored (`convex/schema.ts:349`). This is actionable guidance Alpha and Beta did not provide.

---

## 4. Combined Mapping Table

### 4.1 Types

| Mock Type                                    | Real Equivalent                                                                        | Source                                                           |
| -------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `FoodItem` (mockData.ts:9-19)                | `FoodRegistryEntry` + `ingredientProfiles.nutritionPer100g` (join required)            | `shared/foodRegistryData.ts:116-146`, `convex/schema.ts:113-138` |
| `FoodLogEntry` (mockData.ts:410-423)         | `SyncedLog & { type: "food" }` with `data: FoodLogData` containing `items: FoodItem[]` | `src/lib/syncCore.ts:276-283`, `domain.ts:366-371`               |
| `SavedMeal` (mockData.ts:334-339)            | `foodLibrary` row where `type === "composite"`                                         | `convex/schema.ts:356-364`                                       |
| `MealSlot` (mockData.ts:396)                 | `FoodLogData["mealSlot"]` = `"breakfast" \| "lunch" \| "dinner" \| "snack"`            | `domain.ts:370`, `validators.ts:378-383`                         |
| `StagedItem` (useNutritionStore.ts:24-35)    | Ephemeral UI type -- no backend equivalent                                             | Keep as client-side Zustand/useReducer                           |
| `NutritionView` (useNutritionStore.ts:39-44) | Ephemeral UI enum -- no backend equivalent                                             | Keep as client-side                                              |

### 4.2 Constants

| Mock Constant                               | Real Equivalent                                                | Source                                     |
| ------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------ |
| `FOOD_REGISTRY` (28 entries with nutrition) | `FOOD_REGISTRY` (147 entries, no nutrition)                    | `shared/foodRegistryData.ts:4321-4322`     |
| `SAVED_MEALS` (5 hardcoded)                 | `foodLibrary.list()` Convex query (user-scoped)                | `convex/foodLibrary.ts:77`                 |
| `INITIAL_FOOD_LOGS` (8 entries)             | `useSyncedLogsContext()` filtered to `type === "food"` + today | `src/contexts/SyncedLogsContext.tsx:40-46` |
| `WATER_GOAL_ML` (1000)                      | **Does not exist** -- must be created                          | --                                         |
| `INITIAL_WATER_ML` (450)                    | Derived: sum fluid logs where name="water" for today           | `domain.ts:373-374`                        |
| `CALORIE_GOAL` (1800)                       | **Does not exist** -- must be created                          | --                                         |
| `INITIAL_FAVOURITES` (5 IDs)                | **Does not exist** -- must be created                          | --                                         |

### 4.3 Functions

| Mock Function                       | Real Equivalent                                                                           | Source                                                                           |
| ----------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `getFoodById(id)`                   | `getFoodEntry(canonicalName)`                                                             | `shared/foodRegistryUtils.ts:76-78`, re-exported via `shared/foodRegistry.ts:32` |
| `calculateCalories(food, portionG)` | `Math.round((profile.nutritionPer100g.kcal * quantity) / 100)` with null handling         | `convex/ingredientProfiles.ts:56-72` for lookup                                  |
| `calculateMacro(per100g, portionG)` | Same formula, source from `nutritionPer100g.proteinG / .carbsG / .fatG`                   | `convex/schema.ts:124-132`                                                       |
| `detectMealSlot(timestamp)`         | New implementation with corrected times; ideally read `MealSchedule` from `aiPreferences` | `domain.ts:129-136` for `MealSchedule` type                                      |
| `getPortionIncrement(food)`         | **Does not exist** -- must be created                                                     | --                                                                               |
| `formatPortion(amount, unit)`       | **Does not exist** as standalone; `defaultPortionDisplay` on `FoodItem` is related        | `domain.ts:333`                                                                  |

### 4.4 Store State Fields

| Store Field        | Real Data Source                                                | Type                          |
| ------------------ | --------------------------------------------------------------- | ----------------------------- |
| `view`             | UI-only                                                         | Zustand/local                 |
| `searchQuery`      | UI-only                                                         | Zustand/local                 |
| `stagingItems`     | UI-only (ephemeral before commit)                               | Zustand/local                 |
| `stagingModalOpen` | UI-only                                                         | Zustand/local                 |
| `waterModalOpen`   | UI-only                                                         | Zustand/local                 |
| `waterAmount`      | UI-only                                                         | Zustand/local                 |
| `waterIntake`      | Derived: sum today's fluid logs where name="water"              | `SyncedLogsContext` + filter  |
| `waterGoal`        | **Must be created**                                             | New profile field or default  |
| `foodLogs`         | `useSyncedLogsContext()` filtered to type="food" + today        | `SyncedLogsContext.tsx:40-46` |
| `favourites`       | **Must be created**                                             | New profile field             |
| `calorieGoal`      | **Must be created**                                             | New profile field             |
| `activeMealSlot`   | Derived from current time + `MealSchedule` from `aiPreferences` | `domain.ts:129-136`           |
| `filterMealSlot`   | UI-only                                                         | Zustand/local                 |

---

## 5. Fields That Must Be Created

| Field                        | Recommended Location                                  | Rationale                                                                                 |
| ---------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `calorieGoal`                | `profiles` table (new optional field)                 | Follows existing `profiles` pattern; no calorie concept exists anywhere.                  |
| `waterGoalMl`                | `profiles` table (new optional field)                 | Same pattern; no water-specific goal field exists.                                        |
| `favouriteFoods`             | `profiles` table as `v.optional(v.array(v.string()))` | Consistent with `knownFoods` pattern at `schema.ts:349`. Array of canonical name strings. |
| `getPortionIncrement` helper | Client-side utility function                          | UI affordance for +/- stepper; derive from registry `category`/`subcategory`.             |
| `formatPortion` helper       | Client-side utility function                          | Trivial string formatter.                                                                 |

All three schema additions to `profiles` require a Convex schema migration.

---

## 6. Assumptions Requiring Validation

Merged and deduplicated from all three agents. Items resolved by source verification are marked as such.

### Resolved by Code Review

| #   | Assumption                                    | Resolution                                                                                                                                                       |
| --- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Fuse.js may not be in package.json            | **Resolved: It IS a dependency** (`package.json:34`: `"fuse.js": "^7.1.0"`). Gamma was wrong.                                                                    |
| R2  | Registry has 148 entries                      | **Resolved: Count is 147**, not 148. All three agents were wrong.                                                                                                |
| R3  | date-fns is available                         | **Resolved: Confirmed** -- it is a project dependency.                                                                                                           |
| R4  | `canonicalName` is always present on FoodItem | **Resolved: It is NOT always present.** `canonicalName?: string \| null` at `domain.ts:329`. The UI must handle missing canonical names (unresolved food items). |

### Still Requiring Human/Product Decision

| #   | Assumption                                          | Decision Needed                                                                                                                                                                                           |
| --- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | No calorie goal exists                              | Where to store `calorieGoal`? Profiles table field, or derived from health profile (age/weight/gender/activity)?                                                                                          |
| A2  | No water goal exists                                | Where to store `waterGoalMl`? Profiles table field, or hardcoded post-surgery default (e.g. 1000ml)?                                                                                                      |
| A3  | No favourites mechanism exists                      | Store as `favouriteFoods: string[]` on profiles (like `knownFoods`), or separate table?                                                                                                                   |
| A4  | Nutrition data is sparse for most users             | Should ingredient profiles be pre-seeded from a global dataset (OpenFoodFacts bulk import), or should the UI treat missing nutrition as expected and display "-- kcal"?                                   |
| A5  | foodLibrary composites lack per-ingredient portions | Does the meal logging PRD require adding portions to composites? If not, how should calorie totals for saved meals be computed?                                                                           |
| A6  | No default portion sizes in registry                | Should portion defaults be added to registry entries, stored in `ingredientProfiles`, or maintained as a client-side lookup table?                                                                        |
| A7  | detectMealSlot should use MealSchedule              | Use user-configurable `MealSchedule` from `aiPreferences` (correct but more complex), or hardcoded spec ranges (simpler) as defaults?                                                                     |
| A8  | Per-log calorie pre-computation                     | Compute nutrition on read (join with profiles at render time) or on write (denormalize into log data)? Compute-on-read is simpler; compute-on-write is faster at scale.                                   |
| A9  | Async loading states needed                         | Mock uses synchronous data. Real implementation needs Convex `useQuery` for ingredient profiles, food library, and synced logs. Every calorie-displaying component needs loading/skeleton states.         |
| A10 | isMeal/mealId have no real equivalent               | How should the UI distinguish a logged composite meal from individual food items? Real `FoodLogData.items[]` implicitly represents a meal (multiple items), but no flag or `foodLibrary` backlink exists. |
