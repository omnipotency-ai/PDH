# W0-03 Fluid Migration Audit -- Agent Alpha

## 1. Current Fluid Presets

### Default presets (hardcoded)

Defined in `src/store.ts:62-66`:

```ts
export const DEFAULT_FLUID_PRESETS: FluidPreset[] = [
  { name: "Aquarius" },
  { name: "Juice" },
  { name: "Green tea" },
];
```

These are the fallback when the user has not customized their profile presets.

### FluidPreset type

Defined in `src/types/domain.ts:250-252`:

```ts
export interface FluidPreset {
  name: string;
}
```

### Profile storage

- Schema field: `convex/schema.ts:339` -- `fluidPresets: v.optional(storedFluidPresetsValidator)`
- Validator: `convex/validators.ts:51-55` -- `fluidPresetValidator = v.object({ name: v.string() })`
- Legacy compat: `convex/validators.ts:59-64` -- `storedFluidPresetValidator` accepts either `{ name: string }` or bare `string` (for old docs that stored `string[]`)
- Profile type: `src/types/domain.ts:272` -- `fluidPresets?: FluidPreset[]`
- Hook: `src/hooks/useProfile.ts:108-120` -- `useFluidPresets()` returns `profile.fluidPresets ?? []` and a setter

### How presets are consumed in the UI

`src/components/track/panels/FluidSection.tsx:42-45` -- `quickPresets` takes the first 3 saved presets (if any), otherwise falls back to `DEFAULT_FLUID_PRESETS`. These render as buttons alongside a hardcoded "Water" button and an "Other" freeform input.

---

## 2. Water Special Case

Water is **hardcoded** in `FluidSection.tsx` -- it is not one of the configurable presets. It has its own dedicated button (`FluidSection.tsx:181-193`) with the `Droplets` icon and label "Log water".

### Logging flow for water

1. User clicks the water `Droplets` button or presses Enter in the amount input (`FluidSection.tsx:170-172`)
2. Calls `handleLogSelectedFluid("Water")` (`FluidSection.tsx:65-79`)
3. Calls `onLogFluid("Water", milliliters, getTimestampMs())` -- the prop passed from Track.tsx
4. `onLogFluid` is `handleLogFluid` from `useHabitLog` (via `useQuickCapture`)

### handleLogFluid internals

Defined at `src/hooks/useHabitLog.ts:111-180`:

```ts
const handleLogFluid = useCallback(
  async (
    name: string, // e.g. "Water", "Aquarius", "Juice"
    milliliters: number,
    timestamp = captureNow(),
    skipHabitLog = false,
  ): Promise<string> => {
    // 1. Write a Convex log with type: "fluid"
    const logId = await addSyncedLog({
      timestamp,
      type: "fluid",
      data: {
        items: [{ name, quantity: milliliters, unit: "ml" }],
      },
    });
    // 2. Optionally find a matching habit with logAs === "fluid"
    //    and write a local habit log for streak tracking
    // 3. Show undo/edit toast
    return String(logId);
  },
  [
    /* deps */
  ],
);
```

**Critical observation:** `handleLogFluid` treats water and non-water identically. The only differentiator is the `name` string. Both produce `type: "fluid"` logs. There is no branching on `name === "Water"`.

### Data shape (Convex)

`convex/validators.ts:391-399`:

```ts
const fluidLogDataValidator = v.object({
  items: v.array(
    v.object({
      name: v.string(),
      quantity: v.number(),
      unit: v.string(),
    }),
  ),
});
```

All fluid logs use `type: "fluid"` in the `logs` table. The log type is set at `useHabitLog.ts:120`.

---

## 3. Non-Water Drinks Migration Table

### Default presets

| Current Preset | Food Registry Match | Canonical Name      | Registry File:Line               | Recommended Default (ml) | Notes                                                                                                                                                                                                           |
| -------------- | ------------------- | ------------------- | -------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Aquarius**   | NO match            | `electrolyte drink` | `shared/foodRegistryData.ts:339` | 330                      | Aquarius is a sports/electrolyte drink. Maps to "electrolyte drink" (Zone 1A, subcategory: supplement). Registry examples include "sports drink", "lucozade sport", "gatorade" but not "Aquarius" specifically. |
| **Juice**      | Partial match       | `diluted juice`     | `shared/foodRegistryData.ts:286` | 200                      | "Juice" maps to "diluted juice" (Zone 1A, subcategory: juice). Examples include "juice", "fruit juice", "apple juice". Direct match on "juice" exists in examples list at line 306.                             |
| **Green tea**  | YES match           | `tea`               | `shared/foodRegistryData.ts:312` | 250                      | "Green tea" is listed as an example at line 329 under canonical "tea" (Zone 1A, subcategory: hot_drink). Direct alias hit.                                                                                      |

### Other commonly logged fluids (from "Other" freeform input) likely to appear in user data

| Likely User Input | Food Registry Match | Canonical Name      | Registry File:Line                | Recommended Default (ml) |
| ----------------- | ------------------- | ------------------- | --------------------------------- | ------------------------ |
| Coffee            | YES                 | `coffee`            | `shared/foodRegistryData.ts:3637` | 200                      |
| Tea               | YES                 | `tea`               | `shared/foodRegistryData.ts:312`  | 250                      |
| Milk              | YES                 | `milk`              | `shared/foodRegistryData.ts:533`  | 200                      |
| Coke / Soda       | YES                 | `carbonated drink`  | `shared/foodRegistryData.ts:3603` | 330                      |
| Beer / Wine       | YES                 | `alcohol`           | `shared/foodRegistryData.ts:3572` | 330                      |
| Oat milk          | YES                 | `plant milk`        | `shared/foodRegistryData.ts:2450` | 200                      |
| Protein shake     | YES                 | `protein drink`     | `shared/foodRegistryData.ts:230`  | 250                      |
| Broth             | YES                 | `clear broth`       | `shared/foodRegistryData.ts:154`  | 250                      |
| Electrolyte       | YES                 | `electrolyte drink` | `shared/foodRegistryData.ts:339`  | 500                      |

### Registry beverage coverage summary

The food registry (`shared/foodRegistryData.ts`) covers beverages with both `category: "drink"` and `category: "beverage"`. Full list of beverage canonicals:

| Canonical         | Zone | Category | Subcategory       | Line |
| ----------------- | ---- | -------- | ----------------- | ---- |
| clear broth       | 1A   | drink    | broth             | 154  |
| smooth soup       | 1A   | drink    | broth             | 204  |
| protein drink     | 1A   | drink    | milk_yogurt       | 230  |
| water             | 1A   | beverage | water             | 263  |
| diluted juice     | 1A   | beverage | juice             | 286  |
| tea               | 1A   | beverage | hot_drink         | 312  |
| electrolyte drink | 1A   | beverage | supplement        | 339  |
| ice lolly         | 1A   | beverage | frozen            | 365  |
| plant milk        | 2    | beverage | dairy_alternative | 2450 |
| miso soup         | 3    | drink    | broth             | 3435 |
| alcohol           | 3    | beverage | alcohol           | 3572 |
| carbonated drink  | 3    | beverage | fizzy_drink       | 3603 |
| coffee            | 3    | beverage | hot_drink         | 3637 |

---

## 4. FluidSection: Elements Kept vs Removed

### Current FluidSection anatomy (`src/components/track/panels/FluidSection.tsx`)

| Element                                           | Lines   | Migration Fate                                              | Rationale                                                                                            |
| ------------------------------------------------- | ------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Water button (Droplets icon)                      | 181-193 | **KEPT** -- moves to WaterModal in NutritionCard            | Water stays as `type='fluid'`. The new WaterModal (planned at W2-04) replaces this button.           |
| Amount input (ml/fl oz)                           | 148-179 | **KEPT for water** in WaterModal, **removed for non-water** | Non-water drinks will use food logging (portion sizes from registry). Water needs a simple ml input. |
| Quick preset buttons (Aquarius, Juice, Green tea) | 195-211 | **REMOVED**                                                 | Non-water drinks become food items logged through the food pipeline.                                 |
| "Other" freeform drink input                      | 212-281 | **REMOVED**                                                 | Custom drinks will be logged as food via the food input.                                             |
| PanelTimePicker                                   | 132-146 | **KEPT** conceptually                                       | WaterModal will need its own time picker or inherit from NutritionCard.                              |
| SectionHeader "Fluids"                            | 126-130 | **REMOVED**                                                 | The entire FluidSection panel disappears. Water logging moves into NutritionCard.                    |

### QuickCapture fluid handling

`src/hooks/useHabitLog.ts:631-632` -- habits with `logAs === "fluid"` call `handleLogFluid` during quick capture taps. Post-migration:

- Water-tracking habits (`logAs === "fluid"` where name normalizes to "water") continue to work unchanged.
- Non-water fluid habits (e.g., a "Coffee" habit with `logAs === "fluid"`) need migration. These should either (a) switch to `logAs: "habit"` and no longer create fluid logs, or (b) be converted to food-logging habits. **This is an open question.**

---

## 5. Profile fluidPresets Migration

### Current schema

`convex/schema.ts:339`: `fluidPresets: v.optional(storedFluidPresetsValidator)`

The field stores an array of `{ name: string }` objects (or legacy bare strings normalized on read at `convex/logs.ts:1245-1246`).

### Migration plan

**Non-water presets can simply be removed from the profile.** The field becomes unnecessary once:

1. Water logging is handled by the WaterModal with no preset selection.
2. Non-water drinks are logged as food items through the food pipeline.

### Specific changes needed

| Change                                                              | Location                                          | Detail                                                                                                          |
| ------------------------------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Remove `DEFAULT_FLUID_PRESETS` constant                             | `src/store.ts:62-66`                              | No longer used; water is not a "preset"                                                                         |
| Remove `useFluidPresets` hook                                       | `src/hooks/useProfile.ts:108-120`                 | No longer consumed by any component                                                                             |
| Remove `FluidPreset` type                                           | `src/types/domain.ts:250-252`                     | And `FluidPresetDraft` at lines 265-267                                                                         |
| Remove `fluidPresets` from `PersistedProfileSettings`               | `src/types/domain.ts:272`                         | Optional field, can be dropped                                                                                  |
| Keep `fluidPresets` in Convex schema                                | `convex/schema.ts:339`                            | Keep as optional for backward compatibility with existing profile docs. Can be cleaned up in a later migration. |
| Keep `storedFluidPresetsValidator`                                  | `convex/validators.ts:51-64`                      | Same: backward-compat with existing docs. Mark deprecated.                                                      |
| Remove `fluidPresets` from `replaceProfile` and `patchProfile` args | `convex/logs.ts:1019, 1064-1071, 1124, 1157-1164` | Stop accepting new writes. Old data stays in place.                                                             |

### Custom presets concern

Users may have saved custom fluid presets (the Settings UI allows this). These presets represent drink preferences. Post-migration, these preferences are irrelevant because drink logging moves to the food input. No data loss occurs because the presets are just names (no quantities, no history). Historical fluid logs referencing these names remain in the `logs` table and are unaffected.

---

## 6. handleLogFluid Function Detail

### Full signature

`src/hooks/useHabitLog.ts:111-117`:

```ts
const handleLogFluid = useCallback(
  async (
    name: string,
    milliliters: number,
    timestamp = captureNow(),
    skipHabitLog = false,
  ): Promise<string>
```

### Behavior

1. Writes a Convex log via `addSyncedLog` with `type: "fluid"` and `data: { items: [{ name, quantity: milliliters, unit: "ml" }] }` (lines 118-124)
2. If `skipHabitLog` is false, normalizes the name via `normalizeFluidItemName` (`src/lib/normalizeFluidName.ts:5-12`) and searches for a matching habit with `logAs === "fluid"` (lines 128-142)
3. If a matching habit is found, writes a local Zustand habit log entry for streak/goal tracking (lines 135-141)
4. Calls `afterSave()` (line 145)
5. Shows a toast with Undo and Edit actions (lines 147-163)

### Water vs non-water: NO difference

The function does **not** differentiate between water and non-water. Both produce identical `type: "fluid"` Convex logs. The only distinction is the `name` string inside `data.items[0].name`.

Post-migration, `handleLogFluid` will be called **only for water** (from WaterModal via `handleLogFluid('Water', amountMl)`). Non-water drinks will flow through the food logging pipeline (`handleLogFood` / `addSyncedLog` with `type: "food"`).

---

## Assumptions Requiring Validation

1. **"Aquarius" maps to "electrolyte drink"** -- Aquarius is a Japanese/Spanish sports drink. The food registry does not list "Aquarius" as an example under `electrolyte drink` (line 339). An alias should be added to the registry, or the user's existing "Aquarius" fluid logs will not match during historical correlation queries.

2. **Existing fluid logs are NOT migrated** -- The plan assumes historical `type: "fluid"` logs for non-water drinks (e.g., "Juice", "Green tea") remain as-is in the database. They will no longer be created going forward, but old data stays. This could cause inconsistency in analytics if the system treats "Juice" as food in new logs but as fluid in old logs. **Needs product decision: do we backfill?**

3. **Habits with `logAs: "fluid"` for non-water items** -- If a user has a habit configured as `logAs: "fluid"` for "Coffee" or "Juice", the quick capture tap currently calls `handleLogFluid`. After removing non-water from fluid, these habits need to either (a) be migrated to `logAs: "habit"`, (b) have `logAs` removed, or (c) have a new `logAs: "food"` option created. **Needs design decision.**

4. **WaterModal does not exist yet** -- The plan references WaterModal (task W2-04) as the replacement for the water button in FluidSection. Until W2-04 is implemented, the FluidSection must remain functional for water logging. The migration should be phased: first add NutritionCard with WaterModal, then remove FluidSection.

5. **FluidSection removal is a breaking change for non-water logging** -- Removing the FluidSection eliminates the only UI for logging non-water drinks by name+amount. The food input must be capable of handling drink logging (including portion in ml) before FluidSection is removed. The food pipeline currently does not have a "portion in ml" concept -- it uses `quantity` + `unit` from the food item validator (`convex/validators.ts:358-359`), which is flexible enough, but the UI must support it.

6. **`normalizeFluidItemName` function** -- This utility (`src/lib/normalizeFluidName.ts`) is used for fluid habit matching. After migration, it will only need to handle "water" normalization. It could be simplified or removed if water never participates in habit matching.

7. **Profile merge logic in `convex/lib/apiKeys.ts:204-206`** -- The profile deduplication/merge logic references `fluidPresets`. This will become dead code after migration but is harmless if left in place.

8. **The `fluidLogDataValidator` stays** -- `convex/validators.ts:391-399` must remain for validating existing fluid logs and new water logs. It is part of `logDataValidator` (line 526-533) which is a union type. No changes needed to this validator.
