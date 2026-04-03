# W0-03 Fluid Migration Audit -- Agent Gamma

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

These are the three default pill labels displayed beside the water button in `FluidSection`. The constant `MAX_FLUID_PRESETS = 3` (store.ts:69) limits the number of custom presets. `BLOCKED_FLUID_PRESET_NAMES` (store.ts:72) reserves `"agua"`, `"other"`, and `"water"`.

### The `FluidPreset` type

Defined in `src/types/domain.ts:250-252`:

```ts
export interface FluidPreset {
  name: string;
}
```

### How presets are stored in profile

The `profiles` table schema (`convex/schema.ts:339`) has:

```
fluidPresets: v.optional(storedFluidPresetsValidator),
```

The `storedFluidPresetsValidator` (convex/validators.ts:64) is `v.array(storedFluidPresetValidator)`, which is a union of `{ name: string }` and bare `string` (for legacy backward compatibility, convex/validators.ts:59-60).

The `useFluidPresets` hook (`src/hooks/useProfile.ts:108-120`) reads `profile.fluidPresets` and falls back to `[]`. When empty, `FluidSection` falls back to `DEFAULT_FLUID_PRESETS` (FluidSection.tsx:42-45).

### User-configurable presets

Users can customize their 3 drink preset names via `CustomDrinksSection` (`src/components/settings/tracking-form/CustomDrinksSection.tsx:1-44`). This writes back to `profile.fluidPresets` via `patchProfile`.

**Summary of ALL fluid preset names in play:**

- Water (built-in, always present as a dedicated button -- NOT a preset)
- Aquarius (default preset #1)
- Juice (default preset #2)
- Green tea (default preset #3)
- Any user-customized name replacing the above

---

## 2. Water Special Case

### How water logging works today

Water is **not** a preset -- it has a dedicated hardcoded button in `FluidSection.tsx:181-192` (the Droplets icon button). The Enter key defaults to logging water as well (FluidSection.tsx:143-145, 168-170).

When the user taps the water button, it calls:

```ts
handleLogSelectedFluid("Water"); // FluidSection.tsx:183
```

which calls:

```ts
onLogFluid((name = "Water"), milliliters, getTimestampMs()); // FluidSection.tsx:71
```

`onLogFluid` is the prop that maps to `handleLogFluid` from `useHabitLog` (wired in Track.tsx:592).

### handleLogFluid data shape

In `useHabitLog.ts:111-180`, `handleLogFluid` calls `addSyncedLog` with:

```ts
{
  timestamp,
  type: "fluid",
  data: {
    items: [{ name, quantity: milliliters, unit: "ml" }],
  },
}
```

This matches `fluidLogDataValidator` in `convex/validators.ts:391-399`:

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

### Water stays as type='fluid'

Water logging writes `type: "fluid"` to the logs table. Per the implementation plan (W4-01), water remains a fluid log type. The NutritionCard will handle water via a dedicated WaterModal component, NOT through the food pipeline. This is the correct design because water has no nutritional staging, no recovery zone, and is tracked for hydration volume, not food reintroduction.

### Habit integration for water

After writing the fluid log, `handleLogFluid` also looks for a matching habit with `logAs === "fluid"` (useHabitLog.ts:129-131). The `HABIT_TEMPLATES.water` template (habitTemplates.ts:187-200) has `logAs: "fluid"` and `habitType: "fluid"`, so water fluid logs also increment the Water habit tracker in QuickCapture.

---

## 3. Non-Water Drinks Migration Table

| Current Preset Name | Food Registry Match                                                                                                             | Registry Canonical Name | Zone | Subcategory | Recommended Default Portion (ml) | Notes                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ---- | ----------- | -------------------------------- | ------------------------------------------------------------------------------------- |
| **Aquarius**        | No exact match. Closest: `electrolyte drink` (foodRegistryData.ts:339, examples include "sports drink", "gatorade", "powerade") | `electrolyte drink`     | 1A   | supplement  | 250                              | Aquarius is a Japanese sports/electrolyte drink. Maps to the electrolyte drink entry. |
| **Juice**           | Yes: `diluted juice` (foodRegistryData.ts:286, examples include "juice", "apple juice", "fruit juice")                          | `diluted juice`         | 1A   | juice       | 200                              | "juice" appears directly in the examples list at foodRegistryData.ts:306              |
| **Green tea**       | Yes: `tea` (foodRegistryData.ts:312, examples include "green tea" at line 329)                                                  | `tea`                   | 1A   | hot_drink   | 250                              | Green tea is explicitly listed as an example of the `tea` canonical entry             |

### Additional fluid-related habit templates that need consideration

| Habit Template                                                              | Registry Match                                     | Registry Canonical Name | Zone | Notes                                                           |
| --------------------------------------------------------------------------- | -------------------------------------------------- | ----------------------- | ---- | --------------------------------------------------------------- |
| `Tea` (habitTemplates.ts:201-214, templateKey: "tea")                       | Yes: `tea` (foodRegistryData.ts:312)               | `tea`                   | 1A   | Direct match                                                    |
| `Electrolyte drink` (habitTemplates.ts:215-228, templateKey: "electrolyte") | Yes: `electrolyte drink` (foodRegistryData.ts:339) | `electrolyte drink`     | 1A   | Direct match                                                    |
| `Coffee` (habitTemplates.ts:439-454, templateKey: "coffee")                 | Yes: `coffee` (foodRegistryData.ts:3637)           | `coffee`                | 3    | Destructive habit, `logAs: "fluid"`, `habitType: "destructive"` |

### Other beverages in the food registry (no current preset but relevant)

- `water` (foodRegistryData.ts:263) -- Zone 1A, subcategory: water
- `plant milk` (foodRegistryData.ts:2450) -- Zone 2, subcategory: dairy_alternative
- `alcohol` (foodRegistryData.ts:3572) -- Zone 3, subcategory: alcohol
- `carbonated drink` (foodRegistryData.ts:3603) -- Zone 3, subcategory: fizzy_drink
- `miso soup` (foodRegistryData.ts:3435) -- Zone 3, subcategory: broth
- `clear broth` (foodRegistryData.ts:154) -- Zone 1A, subcategory: broth
- `ice lolly` (foodRegistryData.ts:364) -- Zone 1A, subcategory: frozen

---

## 4. FluidSection Elements: Kept vs. Removed

### What STAYS (water via WaterModal)

- **Water logging button and its flow.** Water continues to use `type: "fluid"` log entries. The current dedicated water button (FluidSection.tsx:181-192) will be replaced by a WaterModal in NutritionCard.
- **Water habit integration.** `handleLogFluid` in `useHabitLog.ts` will continue to exist and be called for water. The habit matching logic (useHabitLog.ts:128-143) that links fluid logs to `logAs: "fluid"` habits stays intact.
- **`fluidLogDataValidator`** (convex/validators.ts:391-399) stays unchanged. Existing fluid log records are never migrated.

### What MOVES to food

- **Non-water drink presets** (Aquarius, Juice, Green tea). These become food items logged via the NutritionCard search zero-state "Common drinks" section (per W4-01 plan).
- **The "Other" button** (FluidSection.tsx:212-225) for custom drink names. Custom drinks will be typed into NutritionCard search instead.

### What gets REMOVED from Track.tsx

- The entire `<FluidSection>` component rendering (Track.tsx:592) is removed in W4-02.
- The FluidSection.tsx file is kept alive (not deleted) for rollback safety per W4-02 plan description.

### QuickCapture fluid handling

QuickCapture (`src/hooks/useQuickCapture.ts`) composes `useHabitLog` and exposes `handleLogFluid` (useQuickCapture.ts:101). This continues to work because:

- Habits with `logAs: "fluid"` (Water, Tea, Electrolyte drink, Coffee) still exist in habit templates.
- When tapped via QuickCapture, they call `handleLogFluid` (useHabitLog.ts:632), which writes `type: "fluid"` logs.
- The implementation plan explicitly states: "Keep QuickCapture fluid handling for non-water habits" (nutrition-card-implementation-plan.json:1075).

**Important nuance:** The plan says QuickCapture keeps fluid handling for "non-water habits" -- meaning Tea, Electrolyte drink, Coffee habit tiles on the QuickCapture bar still log as fluid type. This is intentional: the habit tracker cares about volume/count tracking, not food reintroduction staging.

---

## 5. Profile fluidPresets Migration

### Current state

`profiles.fluidPresets` (`convex/schema.ts:339`) stores an optional array of `{ name: string }` or legacy bare strings. The field controls which 3 pill labels appear in FluidSection.

### Migration plan

**Non-water presets can be removed from the profile** once FluidSection is removed from Track.tsx (W4-02). Specifically:

1. **The `fluidPresets` field in the profile schema should remain `v.optional()`** for backward compatibility. Existing profile documents should not require a migration.

2. **No database migration needed for existing profiles.** The field becomes unused after FluidSection is removed. It can be cleaned up in a later schema-narrowing pass.

3. **CustomDrinksSection** (`src/components/settings/tracking-form/CustomDrinksSection.tsx`) should be removed or hidden in settings after FluidSection is gone. It currently lets users customize their 3 fluid preset pills.

4. **DEFAULT_FLUID_PRESETS**, `MAX_FLUID_PRESETS`, and `BLOCKED_FLUID_PRESET_NAMES** in `src/store.ts:62-72` become dead code once FluidSection is removed.

### Custom presets

Users who customized their drink presets (e.g., changed "Aquarius" to "Coconut water") will lose those as FluidSection pill labels. However:

- Those drinks can be typed into NutritionCard search.
- No logged data is lost -- old fluid logs with custom names remain valid in the database.
- The `fluidPresets` profile field simply becomes unused, not deleted.

---

## 6. handleLogFluid Function -- Full Analysis

### Signature

Defined in `src/hooks/useHabitLog.ts:38-43`:

```ts
handleLogFluid: (
  name: string,
  milliliters: number,
  timestamp?: number,
  skipHabitLog?: boolean,
) => Promise<string>;
```

Returns the synced log ID as a string.

### What it does (useHabitLog.ts:111-180)

1. **Writes a fluid log** via `addSyncedLog` with `type: "fluid"` and `data: { items: [{ name, quantity: milliliters, unit: "ml" }] }` (lines 118-124).

2. **Matches to a habit** (unless `skipHabitLog=true`): normalizes the fluid name via `normalizeFluidItemName`, then searches `habits` for one with `logAs === "fluid"` and a matching normalized name (lines 128-131). If found, writes a `habitLog` entry to the Zustand store (lines 135-141).

3. **Shows toast with undo/edit** (lines 150-163): displays the amount logged, with "Undo" (removes the synced log + habit log) and "Edit" actions.

### How it differs between water and non-water

**There is no branching between water and non-water inside `handleLogFluid` itself.** The function is name-agnostic. Every call:

- Writes `type: "fluid"` regardless of drink name
- Attempts habit matching by normalized name
- Shows the same toast pattern

The difference is in **who calls it and how**:

| Caller             | Water                                | Non-water preset                      | Other (custom)                         | QuickCapture habit tap                     |
| ------------------ | ------------------------------------ | ------------------------------------- | -------------------------------------- | ------------------------------------------ |
| **Entry point**    | FluidSection water button (line 183) | FluidSection preset button (line 199) | FluidSection "Other" submit (line 107) | handleQuickCaptureTap (useHabitLog.ts:632) |
| **skipHabitLog**   | false                                | false                                 | false                                  | true (habit log already written by caller) |
| **Habit matched?** | Yes, if Water habit exists           | Yes, if a matching fluid habit exists | Unlikely (custom name)                 | No (skipHabitLog=true)                     |

The `skipHabitLog=true` case is used by `handleQuickCaptureTap` (useHabitLog.ts:632) because the QuickCapture code already writes its own habit log entry at line 621-628 before calling `handleLogFluid`.

---

## Assumptions Requiring Validation

1. **"Aquarius" maps to "electrolyte drink":** This assumes Aquarius is the Japanese sports drink brand. If it is something else (e.g., a brand-specific product with different characteristics), the mapping may need adjustment. The food registry has no "Aquarius" example string -- confirm with the user.

2. **Non-water drinks logged via QuickCapture habits remain as `type: "fluid"` post-migration.** The plan says "Keep QuickCapture fluid handling" but does not specify whether tapping a "Tea" habit tile on QuickCapture should eventually create a `type: "food"` log instead of `type: "fluid"`. Current plan implies they stay as fluid. Validate this is intentional and not a gap.

3. **No database migration for existing fluid logs.** The plan states "Old fluid logs remain valid -- no database migration" (nutrition-card-implementation-plan.json, W4-01 description). This means historical fluid logs for non-water drinks (Tea, Juice, etc.) will have `type: "fluid"` while new logs for the same drinks will have `type: "food"`. AI analysis and timeline queries that correlate drinks with digestive outcomes need to handle both types. Validate that the AI pipeline/transit analysis already accounts for this or that it is a known gap.

4. **`fluidPresets` schema field left in place.** The assumption is that leaving `v.optional()` fields in the schema is acceptable tech debt. A future schema-narrowing migration could remove it. Confirm no Convex schema validation issues arise from orphaned optional fields.

5. **CustomDrinksSection removal timing.** The settings form references `fluidPresets` via the `CustomDrinksSection` component. It is unclear whether this should be removed in W4-01 (migrate drinks), W4-02 (remove FluidSection), or a later wave. The current plan does not explicitly address this settings page cleanup.

6. **Portion sizes for migrated drinks.** The recommended default portions above (200-250 ml) are estimates based on common serving sizes. The food registry entries do not currently include default portion data (this is a separate task, W0-04). The actual defaults depend on W0-04's outcome.

7. **Coffee habit dual nature.** Coffee is `habitType: "destructive"` with `logAs: "fluid"` (habitTemplates.ts:439-454). It exists as both a habit tracker (counting cups) and a fluid logger. Post-migration, coffee will also have a food registry entry (zone 3). The interaction between the "Coffee" habit tile (which creates fluid logs) and a future "coffee" food card (which creates food logs) needs design clarification. Could a user end up logging the same coffee twice through different UI paths?
