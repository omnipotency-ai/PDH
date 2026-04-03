# W0-03 Fluid Migration Analysis (Agent Beta)

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

These three names are the fallback when the user has no saved presets in their profile.

### FluidPreset type

Defined in `src/types/domain.ts:250-252`:

```ts
export interface FluidPreset {
  name: string;
}
```

### Profile storage

- Schema field: `fluidPresets: v.optional(storedFluidPresetsValidator)` at `convex/schema.ts:339`.
- Validator accepts both `{ name: string }` objects and legacy bare `string` values (`convex/validators.ts:59-64`).
- The `useFluidPresets` hook (`src/hooks/useProfile.ts:108-120`) reads `profile.fluidPresets` and falls back to `[]` if undefined.
- `FluidSection` (`src/components/track/panels/FluidSection.tsx:42-45`) uses the first 3 saved presets, falling back to `DEFAULT_FLUID_PRESETS` when none are saved.

### Custom presets in settings

Users can edit 3 preset names via `src/components/settings/tracking-form/CustomDrinksSection.tsx:1-44`. These are stored as `FluidPresetDraft[]` and persisted to the profile on blur/enter.

### Built-in water button

Water is NOT a preset. It has a dedicated hardcoded button in `FluidSection.tsx:181-194` with its own Droplets icon. It always calls `handleLogSelectedFluid("Water")` directly (line 183). The Enter key also defaults to logging Water (line 143, 170).

---

## 2. Water Special Case

### How water logging works

1. User taps the Water icon button or presses Enter in FluidSection (`src/components/track/panels/FluidSection.tsx:143,170,183`).
2. This calls `handleLogSelectedFluid("Water")` (line 65), which parses the amount input to ml, then calls `onLogFluid("Water", milliliters, timestamp)`.
3. `onLogFluid` is passed as a prop from `Track.tsx:592` and resolves to `handleLogFluid` from `useHabitLog.ts`.
4. `handleLogFluid` (`src/hooks/useHabitLog.ts:111-180`) creates a synced log:
   ```ts
   await addSyncedLog({
     timestamp,
     type: "fluid",
     data: { items: [{ name, quantity: milliliters, unit: "ml" }] },
   });
   ```
5. The log data shape matches `fluidLogDataValidator` (`convex/validators.ts:391-399`):
   ```ts
   v.object({
     items: v.array(
       v.object({
         name: v.string(),
         quantity: v.number(),
         unit: v.string(),
       }),
     ),
   });
   ```
6. The log record is stored with `type: "fluid"` in the `logs` table (`convex/schema.ts:27-34`).

### Water in food registry

Water has a food registry entry at `shared/foodRegistryData.ts:263-283`:

- `canonical: "water"`, zone 1, subzone "1A", category "beverage", subcategory "water"
- Examples: water, plain water, still water, tap water, mineral water, filtered water, glass of water, sparkling water

### Key point: Water stays as type='fluid'

Water logging continues to use the `type: "fluid"` log pathway. It does NOT migrate to food logging. The existing water logging UX (icon button + amount field) is preserved.

---

## 3. Non-Water Drinks Migration Table

### Default presets

| Current Preset Name | Registry Match?                   | Canonical Name        | Registry Location                                                                                                        | Zone   | Recommended Default Portion |
| ------------------- | --------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------ | --------------------------- |
| **Aquarius**        | NO match in `foodRegistryData.ts` | `"electrolyte drink"` | `foodRegistryData.ts:339` (examples include "sports drink", "lucozade sport", "powerade", "gatorade" but NOT "aquarius") | 1 (1A) | 250 ml                      |
| **Juice**           | YES (partial)                     | `"diluted juice"`     | `foodRegistryData.ts:286` (examples include "juice", "fruit juice", "apple juice")                                       | 1 (1A) | 200 ml                      |
| **Green tea**       | YES                               | `"tea"`               | `foodRegistryData.ts:312` (examples include "green tea" at line 329)                                                     | 1 (1A) | 250 ml                      |

### Other beverages in food registry with no current fluid preset

These are food registry entries categorized as beverages/drinks that are NOT fluid presets but may be logged via the "Other" fluid option:

| Registry Canonical    | Zone   | Category | Subcategory       | Location                   |
| --------------------- | ------ | -------- | ----------------- | -------------------------- |
| `"water"`             | 1 (1A) | beverage | water             | `foodRegistryData.ts:263`  |
| `"diluted juice"`     | 1 (1A) | beverage | juice             | `foodRegistryData.ts:286`  |
| `"tea"`               | 1 (1A) | beverage | hot_drink         | `foodRegistryData.ts:312`  |
| `"electrolyte drink"` | 1 (1A) | beverage | supplement        | `foodRegistryData.ts:339`  |
| `"ice lolly"`         | 1 (1A) | beverage | frozen            | `foodRegistryData.ts:365`  |
| `"clear broth"`       | 1 (1A) | drink    | broth             | `foodRegistryData.ts:154`  |
| `"smooth soup"`       | 1 (1A) | drink    | broth             | `foodRegistryData.ts:204`  |
| `"protein drink"`     | 1 (1A) | drink    | milk_yogurt       | `foodRegistryData.ts:230`  |
| `"milk"`              | 1 (1B) | dairy    | milk_yogurt       | `foodRegistryData.ts:533`  |
| `"plant milk"`        | 2      | beverage | dairy_alternative | `foodRegistryData.ts:2450` |
| `"coffee"`            | 3      | beverage | hot_drink         | `foodRegistryData.ts:3637` |
| `"alcohol"`           | 3      | beverage | alcohol           | `foodRegistryData.ts:3572` |
| `"carbonated drink"`  | 3      | beverage | fizzy_drink       | `foodRegistryData.ts:3603` |
| `"miso soup"`         | 3      | drink    | broth             | `foodRegistryData.ts:3435` |

### Migration notes for "Aquarius"

"Aquarius" is a Japanese sports drink brand. It does NOT appear in any examples array in `foodRegistryData.ts`. The closest match is `"electrolyte drink"` (line 339), which includes sports drink brands like "lucozade sport", "powerade", "gatorade". The alias/example list should be extended to include "aquarius" if this brand is important to the user.

---

## 4. FluidSection Elements: Kept vs Removed

### KEPT (water logging via FluidSection)

- **Water icon button** (`FluidSection.tsx:181-194`): Dedicated Droplets icon, always present, always calls `handleLogSelectedFluid("Water")`.
- **Amount input field** (`FluidSection.tsx:148-179`): ml/fl oz numeric input, used for ALL fluid logging including water.
- **PanelTimePicker** (`FluidSection.tsx:132-146`): Time/date override for backdating fluid logs.
- **"Other" freeform button** (`FluidSection.tsx:212-225`): Opens a text input for arbitrary drink names. This is how users currently log any drink not in presets.
- **Other name input + submit** (`FluidSection.tsx:234-282`): The expanded freeform entry form.

### TO BE MIGRATED (non-water preset buttons move to food logging)

- **quickPresets buttons** (`FluidSection.tsx:195-211`): The 3 preset buttons (Aquarius/Juice/Green tea or custom). These render from `quickPresets` which comes from profile `fluidPresets` or `DEFAULT_FLUID_PRESETS`.
- When migrated, these drinks would be logged as `type: "food"` entries in the nutrition card flow instead of `type: "fluid"`.

### DECISION NEEDED: "Other" freeform drinks

The "Other" button currently allows logging ANY arbitrary drink as `type: "fluid"`. After migration:

- Water logged via the dedicated button stays `type: "fluid"`.
- Non-water drinks from presets move to `type: "food"`.
- What about freeform "Other" entries? They could be either fluid or food. This needs a clear rule.

### QuickCapture fluid handling

`handleQuickCaptureTap` in `src/hooks/useHabitLog.ts:603-708` handles habits with `logAs: "fluid"` (line 631). When a habit has `logAs === "fluid"`, tapping it calls `handleLogFluid(habit.name, habit.quickIncrement, timestamp, true)` (line 632). This creates a `type: "fluid"` log. After migration, habits with `logAs: "fluid"` for non-water drinks would need updating if those drinks become food items.

---

## 5. Profile fluidPresets Migration

### Current schema

```
profiles table → fluidPresets: v.optional(storedFluidPresetsValidator)
```

Where `storedFluidPresetsValidator` is `v.array(v.union(v.object({ name: v.string() }), v.string()))` (`convex/validators.ts:59-64`).

### Migration options

**Option A: Remove non-water presets entirely**

- Set `fluidPresets` to `[]` or `undefined` for all profiles.
- Remove `DEFAULT_FLUID_PRESETS` from `src/store.ts:62-66`.
- Remove `CustomDrinksSection` from settings (`src/components/settings/tracking-form/CustomDrinksSection.tsx`).
- The FluidSection simplifies to water-only logging with the "Other" freeform option.
- **Risk**: Users who customized their 3 drink presets lose that configuration.

**Option B: Keep fluidPresets for backward compatibility, phase out**

- Stop rendering non-water preset buttons in FluidSection.
- Keep the schema field but stop writing to it.
- Add a migration to move custom presets into "favorite foods" or a similar food-level quick-pick system.

**Option C: Repurpose fluidPresets as water-amount presets**

- Instead of drink names, store quick-tap water amounts (e.g., 250ml, 500ml).
- This changes the semantics entirely but reuses the UI slot.

### Custom presets concern

Users can set custom drink names in settings via `CustomDrinksSection.tsx`. These could be anything: "Coffee", "Protein shake", "Oat milk latte". If we remove non-water presets, these customizations are silently lost. A data migration or user notification is needed.

---

## 6. handleLogFluid Function

### Full signature

From `src/hooks/useHabitLog.ts:111-117`:

```ts
const handleLogFluid = useCallback(
  async (
    name: string,
    milliliters: number,
    timestamp = captureNow(),
    skipHabitLog = false,
  ): Promise<string> => { ... }
```

### What it does (step by step)

1. **Creates a synced log** (`useHabitLog.ts:118-124`): Calls `addSyncedLog` with `type: "fluid"` and data `{ items: [{ name, quantity: milliliters, unit: "ml" }] }`.
2. **Optionally matches a habit** (`useHabitLog.ts:129-143`): Unless `skipHabitLog` is true, normalizes the fluid name via `normalizeFluidItemName` (`src/lib/normalizeFluidName.ts:5-12`) and searches for a habit with `logAs === "fluid"` whose name matches. If found, writes a habit log entry.
3. **Calls afterSave** (`useHabitLog.ts:145`): Triggers UI refresh.
4. **Shows undo toast** (`useHabitLog.ts:147-164`): Unless `skipHabitLog` is true, shows a toast with Undo (removes synced log + habit log) and Edit (opens edit sheet) actions.
5. **Returns the log ID** (`useHabitLog.ts:166`).

### How it differs between water and non-water

`handleLogFluid` itself makes NO distinction between water and non-water. It treats all fluids identically:

- Same `type: "fluid"` log.
- Same data shape: `{ items: [{ name, quantity, unit: "ml" }] }`.
- Same habit-matching logic (checks for any habit with `logAs: "fluid"` and matching name).

The water/non-water distinction exists ONLY at the UI level in `FluidSection.tsx`:

- Water has a dedicated icon button (line 181-194).
- Non-water drinks are preset text buttons (line 195-211) or freeform "Other" (line 212-282).
- All call the same `handleLogSelectedFluid` -> `onLogFluid` -> `handleLogFluid` pipeline.

---

## Migration Summary Table

| Item                         | Current State                                      | Post-Migration State                                      | Action Required                                               |
| ---------------------------- | -------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------- |
| Water button                 | Hardcoded in FluidSection, logs as `type: "fluid"` | Unchanged                                                 | None                                                          |
| Water amount input           | Shared with all fluids                             | Stays, used for water only                                | UI simplification                                             |
| Aquarius preset              | FluidSection button, logs as `type: "fluid"`       | Logged as `type: "food"`, canonical = "electrolyte drink" | Add "aquarius" to registry examples; remove from FluidSection |
| Juice preset                 | FluidSection button, logs as `type: "fluid"`       | Logged as `type: "food"`, canonical = "diluted juice"     | Remove from FluidSection; food logging handles it             |
| Green tea preset             | FluidSection button, logs as `type: "fluid"`       | Logged as `type: "food"`, canonical = "tea"               | Remove from FluidSection; food logging handles it             |
| "Other" freeform             | FluidSection text input, logs as `type: "fluid"`   | Ambiguous -- needs decision                               | See assumptions below                                         |
| `DEFAULT_FLUID_PRESETS`      | `src/store.ts:62-66`                               | Remove or reduce to empty                                 | Delete constant or repurpose                                  |
| `CustomDrinksSection`        | Settings UI for 3 drink names                      | Remove or repurpose                                       | Communicate loss of customization                             |
| `profile.fluidPresets`       | Schema field in profiles table                     | Deprecate; stop writing                                   | Schema migration not urgent (field is optional)               |
| `handleLogFluid`             | Handles all fluids uniformly                       | Handle water only (or keep for backward compat)           | No code change needed if "Other" keeps logging as fluid       |
| Habits with `logAs: "fluid"` | Used for non-water drink habits                    | Need review -- should these become food habits?           | Audit existing habits per user                                |
| `fluidLogDataValidator`      | Validates `{ items: [{ name, quantity, unit }] }`  | Still used for water logs                                 | No change needed                                              |
| `FluidSection` component     | Full fluid panel with presets + water + other      | Water-focused panel                                       | Remove preset buttons; keep water + possibly "Other"          |

---

## Assumptions Requiring Validation

1. **"Aquarius" -> "electrolyte drink" mapping**: Aquarius is not listed in the `electrolyte drink` examples array (`foodRegistryData.ts:348-360`). This alias needs to be added explicitly to the registry, or users typing "Aquarius" will fail to resolve. Confirm this is the correct canonical mapping with the user.

2. **"Other" freeform drink fate**: The current "Other" button lets users log arbitrary drinks as `type: "fluid"`. After migration, should arbitrary non-water drinks:
   - (a) Still log as `type: "fluid"` (simplest, preserves backward compat)?
   - (b) Log as `type: "food"` and go through the food resolution pipeline?
   - (c) Be removed entirely, forcing all non-water drinks through food logging?

3. **Habit `logAs: "fluid"` for non-water drinks**: Some habits may have `logAs: "fluid"` for drinks like coffee or juice. After migration, these habits would still create `type: "fluid"` logs via `handleQuickCaptureTap` (`useHabitLog.ts:631-632`). Should these be changed to `logAs: "food"` or handled differently?

4. **Historical data**: Existing `type: "fluid"` logs for non-water drinks (juice, tea, etc.) remain in the database. The migration plan does not address re-typing historical logs. Confirm whether historical fluid logs should be left as-is or backfilled to `type: "food"`.

5. **Custom presets data loss**: Users who set custom drink names in `CustomDrinksSection` will lose that configuration silently. A user-facing notification or migration path (e.g., converting custom presets to favorite foods) should be defined.

6. **Default portion sizes**: The recommended ml values in the migration table (250ml for Aquarius/Green tea, 200ml for Juice) are approximations. The food logging pipeline may use different default portions. These need alignment with the nutrition card's portion system.

7. **FluidSection vs WaterModal**: The task brief mentions "WaterModal" but no such component exists in the codebase. Water is logged inline via the FluidSection's dedicated water button. Confirm there is no planned WaterModal component, or clarify what it refers to.

8. **Profile schema migration timing**: The `fluidPresets` field is `v.optional`, so it can safely be ignored without a schema migration. However, if `CustomDrinksSection` is removed from settings, old profile data with presets will become orphaned. Confirm whether a widen-migrate-narrow cycle is needed or if soft deprecation (stop reading/writing) is sufficient.
