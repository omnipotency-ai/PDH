# W0-03 Fluid Migration -- Cross-Validated Findings

> Generated 2026-04-03 by cross-validation agent. Every factual claim cites `file:line`.

---

## 1. Consensus Findings (agreed by all 3 agents)

All three agents agree on the following facts, confirmed against source code:

1. **Default fluid presets** are `["Aquarius", "Juice", "Green tea"]`, defined at `src/store.ts:62-66` as `DEFAULT_FLUID_PRESETS`.
2. **FluidPreset type** is `{ name: string }`, defined at `src/types/domain.ts:250-252`.
3. **Water is hardcoded**, not a preset. It has a dedicated Droplets icon button at `FluidSection.tsx:181-193`. Enter key also defaults to logging Water (`FluidSection.tsx:143,170`).
4. **`handleLogFluid` makes no distinction between water and non-water.** All fluids produce identical `type: "fluid"` logs with `data: { items: [{ name, quantity, unit: "ml" }] }` (`useHabitLog.ts:118-124`).
5. **`handleLogFluid` full signature** (`useHabitLog.ts:38-43` interface, `useHabitLog.ts:111-117` implementation):
   ```ts
   (
     name: string,
     milliliters: number,
     timestamp?: number,
     skipHabitLog?: boolean,
   ) => Promise<string>;
   ```
6. **Profile schema**: `fluidPresets: v.optional(storedFluidPresetsValidator)` at `convex/schema.ts:339`. Validator accepts `{ name: string }` or legacy bare `string` (`convex/validators.ts:59-64`).
7. **`useFluidPresets` hook** at `src/hooks/useProfile.ts:108-120` returns `profile.fluidPresets ?? []` and a setter.
8. **QuickCapture fluid handling**: habits with `logAs === "fluid"` call `handleLogFluid(habit.name, habit.quickIncrement, timestamp, true)` at `useHabitLog.ts:631-632`.
9. **"Aquarius" does NOT appear** anywhere in `shared/foodRegistryData.ts` (confirmed: zero grep matches for "aquarius" case-insensitive).
10. **"juice"** appears as an example under `diluted juice` at `foodRegistryData.ts:306`.
11. **"green tea"** appears as an example under `tea` at `foodRegistryData.ts:329`.
12. **Water** has its own registry entry: canonical `"water"`, zone 1A, at `foodRegistryData.ts:263-283`.
13. **`fluidLogDataValidator`** (`convex/validators.ts:391-399`) stays unchanged -- it is needed for existing fluid logs and ongoing water logs.
14. **`CustomDrinksSection`** (`src/components/settings/tracking-form/CustomDrinksSection.tsx:1-44`) allows users to edit 3 preset names, stored to `profile.fluidPresets`.
15. **`logAs` is constrained** to `"habit" | "fluid"` only (`src/lib/habitTemplates.ts:33`). There is no `"food"` option. Attempting to set `logAs: "food"` throws an error (`habitTemplates.ts:624-626`).

---

## 2. Resolved Contradictions

### 2a. "Other" button line range

- **Alpha** cites `FluidSection.tsx:212-281` for the "Other" freeform block.
- **Beta** cites `FluidSection.tsx:212-225` for just the button, plus `234-282` for the expanded form.
- **Gamma** cites `FluidSection.tsx:212-225` for the button.

**Resolution:** Beta's split is the most precise. The "Other" _button_ is at lines 212-225. The expanded _form_ (name input + submit) is at lines 234-282. The entire "Other" feature spans lines 212-282 (Alpha was off by 1 on the end -- the `</section>` close is at 283, not 281). Verified at `FluidSection.tsx:212-282`.

### 2b. Water button line range

- **Alpha** cites `FluidSection.tsx:181-193`.
- **Beta** cites `FluidSection.tsx:181-194`.
- **Gamma** cites `FluidSection.tsx:181-192`.

**Resolution:** The `<button>` element opens at line 181 and its closing `</button>` is at line 193. Line 194 is blank. Verified: the water button is lines **181-193**.

### 2c. `handleLogFluid` signature line numbers

- **Alpha/Beta** cite `useHabitLog.ts:111-117` for the implementation.
- **Gamma** cites `useHabitLog.ts:38-43` for the type signature.

**Resolution:** Both are correct about different things. The _interface_ signature is at `useHabitLog.ts:38-43`. The _implementation_ starts at `useHabitLog.ts:111-117`. No contradiction.

### 2d. Recommended default portion for Aquarius

- **Alpha** says 330 ml.
- **Beta** says 250 ml.
- **Gamma** says 250 ml.

**Resolution:** There is no canonical default portion in the codebase -- these are all estimates. The `electrolyte drink` habit template has `quickIncrement: 250` (`habitTemplates.ts:220`). The migration table below uses **250 ml** to align with the existing habit template.

### 2e. "Other" button fate: kept or removed?

- **Alpha** says "REMOVED" -- custom drinks go through food input.
- **Beta** says "DECISION NEEDED" -- ambiguous whether freeform drinks stay as fluid or become food.
- **Gamma** says the "Other" button moves to NutritionCard search.

**Resolution:** All three agree the "Other" button is **removed from FluidSection**. The disagreement is about what replaces it. The definitive answer: once FluidSection is reduced to water-only, the "Other" freeform input is removed. Non-water drinks are typed into the NutritionCard food search. No decision is needed -- this follows directly from the migration principle: non-water drinks become food.

### 2f. QuickCapture fluid habits post-migration

- **Alpha** says non-water fluid habits need migration -- "open question."
- **Beta** says they need updating -- "should these become food habits?"
- **Gamma** says they stay as `logAs: "fluid"` intentionally, citing the implementation plan.

**Resolution:** The `logAs` field only accepts `"habit" | "fluid"` (`habitTemplates.ts:33,624-626`). There is no `"food"` option. Adding one would require schema/validator changes. The **four** habit templates with `logAs: "fluid"` are:

- `water` (`habitTemplates.ts:187-200`) -- stays as-is
- `tea` (`habitTemplates.ts:201-214`) -- stays as-is
- `electrolyte` (`habitTemplates.ts:215-228`) -- stays as-is
- `coffee` (`habitTemplates.ts:439-454`) -- stays as-is (also `habitType: "destructive"`)

These habits serve a dual purpose: volume/streak tracking (Zustand) AND creating `type: "fluid"` Convex logs. Changing `logAs` would break the volume-tracking pipeline (`useHabitLog.ts:647-653`). The habit templates **stay unchanged**. QuickCapture taps for Tea/Electrolyte/Coffee will continue to create `type: "fluid"` logs. This is a known duality: the same drink can appear as both a `type: "fluid"` log (from a habit tap) and a `type: "food"` log (from NutritionCard). Analytics must handle both types.

### 2g. `FluidSection` removal: file deleted or kept?

- **Alpha** does not specify.
- **Beta** does not specify.
- **Gamma** says file is kept for rollback safety per W4-02.

**Resolution:** The file is **kept but unreferenced** after removal from `Track.tsx:592`. This is safe -- unused files cause no runtime cost and aid rollback. The import at `Track.tsx:24` and usage at `Track.tsx:592` are removed.

---

## 3. Migration Table -- Definitive

### 3a. Default Fluid Presets

| Current Preset | Registry Canonical    | Registry Location         | "Aquarius" in examples? | Zone | Subcategory | Template quickIncrement |
| -------------- | --------------------- | ------------------------- | ----------------------- | ---- | ----------- | ----------------------- |
| **Aquarius**   | `"electrolyte drink"` | `foodRegistryData.ts:339` | **NO** (see note below) | 1A   | supplement  | 250 ml                  |
| **Juice**      | `"diluted juice"`     | `foodRegistryData.ts:286` | "juice" at line 306     | 1A   | juice       | 200 ml (estimate)       |
| **Green tea**  | `"tea"`               | `foodRegistryData.ts:312` | "green tea" at line 329 | 1A   | hot_drink   | 250 ml                  |

**Aquarius note:** "Aquarius" is absent from the `electrolyte drink` examples array (`foodRegistryData.ts:348-360`). The examples are: electrolyte drink, dioralyte, pedialyte, oral rehydration, ORS, rehydration salts, electrolyte water, sports drink, lucozade sport, powerade, gatorade. **Action required:** add "aquarius" to the examples array, or user-typed "Aquarius" will fail fuzzy matching.

### 3b. All Beverage Canonicals in Food Registry

| Canonical           | Zone | Category | Subcategory       | Location                   |
| ------------------- | ---- | -------- | ----------------- | -------------------------- |
| `clear broth`       | 1A   | drink    | broth             | `foodRegistryData.ts:154`  |
| `smooth soup`       | 1A   | drink    | broth             | `foodRegistryData.ts:204`  |
| `protein drink`     | 1A   | drink    | milk_yogurt       | `foodRegistryData.ts:230`  |
| `water`             | 1A   | beverage | water             | `foodRegistryData.ts:263`  |
| `diluted juice`     | 1A   | beverage | juice             | `foodRegistryData.ts:286`  |
| `tea`               | 1A   | beverage | hot_drink         | `foodRegistryData.ts:312`  |
| `electrolyte drink` | 1A   | beverage | supplement        | `foodRegistryData.ts:339`  |
| `ice lolly`         | 1A   | beverage | frozen            | `foodRegistryData.ts:365`  |
| `plant milk`        | 2    | beverage | dairy_alternative | `foodRegistryData.ts:2450` |
| `miso soup`         | 3    | drink    | broth             | `foodRegistryData.ts:3435` |
| `alcohol`           | 3    | beverage | alcohol           | `foodRegistryData.ts:3572` |
| `carbonated drink`  | 3    | beverage | fizzy_drink       | `foodRegistryData.ts:3603` |
| `coffee`            | 3    | beverage | hot_drink         | `foodRegistryData.ts:3637` |

### 3c. Habit Templates with `logAs: "fluid"`

| Template    | Key           | Lines                       | habitType     | quickIncrement | dailyTarget/Cap |
| ----------- | ------------- | --------------------------- | ------------- | -------------- | --------------- |
| Water       | `water`       | `habitTemplates.ts:187-200` | `fluid`       | 100 ml         | 1000 ml target  |
| Tea         | `tea`         | `habitTemplates.ts:201-214` | `fluid`       | 250 ml         | 750 ml target   |
| Electrolyte | `electrolyte` | `habitTemplates.ts:215-228` | `fluid`       | 250 ml         | 500 ml target   |
| Coffee      | `coffee`      | `habitTemplates.ts:439-454` | `destructive` | 250 ml         | 3 cap           |

---

## 4. Water Special Case -- Definitive

**Water remains `type: "fluid"` throughout the migration.** It does not move to the food pipeline. Rationale: water is tracked for hydration volume, not food reintroduction staging.

### Current flow (unchanged post-migration):

1. User taps the Droplets button (`FluidSection.tsx:183`) or presses Enter (`FluidSection.tsx:143,170`).
2. Calls `handleLogSelectedFluid("Water")` (`FluidSection.tsx:65`).
3. Calls `onLogFluid("Water", milliliters, getTimestampMs())` (`FluidSection.tsx:71`).
4. `onLogFluid` is `handleLogFluid` from `useQuickCapture` -> `useHabitLog` (wired at `Track.tsx:592`).
5. `handleLogFluid` writes `addSyncedLog({ timestamp, type: "fluid", data: { items: [{ name: "Water", quantity: milliliters, unit: "ml" }] } })` (`useHabitLog.ts:118-124`).
6. Habit matching finds `HABIT_TEMPLATES.water` (if enabled) and increments Zustand habit log (`useHabitLog.ts:128-142`).

### Post-migration (W4-02):

- The `<FluidSection>` component rendering is removed from `Track.tsx:592`.
- Water logging moves to a **WaterModal** component within NutritionCard (planned at W2-04).
- WaterModal calls the same `handleLogFluid("Water", amountMl)` function.
- Water continues to use `type: "fluid"` logs and the `fluidLogDataValidator`.
- The Water habit template (`habitTemplates.ts:187-200`) continues to work via QuickCapture.

### Water in the food registry:

Water has a registry entry (`foodRegistryData.ts:263-283`) but this entry is used only for search/resolution if someone types "water" in the food input. It does NOT change how water logs are stored.

---

## 5. QuickCapture and Habit Tile Handling -- Definitive

### How it works today

When a user taps a habit tile in QuickCapture:

1. `handleQuickCaptureTap` writes a Zustand habit log (`useHabitLog.ts:621-627`).
2. If `habit.logAs === "fluid"`, calls `handleLogFluid(habit.name, habit.quickIncrement, timestamp, true)` (`useHabitLog.ts:631-632`). The `skipHabitLog=true` flag prevents double-writing the habit log.
3. If `habit.logAs !== "fluid"`, calls `handleIncrementHabit` instead (`useHabitLog.ts:634-638`).

### Post-migration: no change to QuickCapture

All four `logAs: "fluid"` habit templates (Water, Tea, Electrolyte, Coffee) **continue creating `type: "fluid"` logs** when tapped via QuickCapture. Reasons:

1. `logAs` only accepts `"habit" | "fluid"` (`habitTemplates.ts:33`). There is no `"food"` option, and adding one would require changes to the validator (`habitTemplates.ts:624-626`), the `handleQuickCaptureTap` logic, and all downstream progress/streak calculations.
2. The fluid volume tracking pipeline (`useHabitLog.ts:647-653`) relies on `logAs === "fluid"` for progress bars and daily cap/target calculations.
3. Changing habit templates would break existing user profiles that have these habits configured.

**Consequence:** Tea, Electrolyte drink, and Coffee can produce both `type: "fluid"` logs (from habit taps) and `type: "food"` logs (from NutritionCard). Analytics and AI correlation must query both log types for these items.

---

## 6. Profile Migration Plan -- Definitive

### Changes required

| Change                                                | Location                                                        | Detail                                                       |
| ----------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------ |
| Remove `DEFAULT_FLUID_PRESETS` constant               | `src/store.ts:62-66`                                            | Dead code after FluidSection removal                         |
| Remove `MAX_FLUID_PRESETS` constant                   | `src/store.ts:69`                                               | Dead code                                                    |
| Remove `BLOCKED_FLUID_PRESET_NAMES` constant          | `src/store.ts:72`                                               | Dead code                                                    |
| Remove `useFluidPresets` hook                         | `src/hooks/useProfile.ts:108-120`                               | No longer consumed                                           |
| Remove `FluidPreset` interface                        | `src/types/domain.ts:250-252`                                   | No longer needed                                             |
| Remove `FluidPresetDraft` interface                   | `src/types/domain.ts:265-267`                                   | No longer needed                                             |
| Remove `fluidPresets` from `PersistedProfileSettings` | `src/types/domain.ts:272`                                       | Optional field, safe to drop                                 |
| Remove `CustomDrinksSection` component                | `src/components/settings/tracking-form/CustomDrinksSection.tsx` | Settings UI for 3 drink pills                                |
| **Keep** `fluidPresets` in Convex schema              | `convex/schema.ts:339`                                          | `v.optional()` -- backward compat with existing profile docs |
| **Keep** `storedFluidPresetsValidator`                | `convex/validators.ts:51-64`                                    | Backward compat -- mark as deprecated                        |
| **Keep** `fluidLogDataValidator`                      | `convex/validators.ts:391-399`                                  | Still used for water logs                                    |
| Stop writing `fluidPresets` in profile mutations      | `convex/logs.ts` (patchProfile, replaceProfile)                 | Stop accepting new writes; old data stays                    |

### Schema migration: NOT required

The `fluidPresets` field is `v.optional()` (`convex/schema.ts:339`), so existing documents validate with or without the field. No widen-migrate-narrow cycle is needed. The field simply becomes unused. A future cleanup pass can remove it from the schema after confirming no documents still contain it.

### Custom presets data: soft loss, acceptable

Users who customized their 3 drink pills lose those _labels_, but:

- No historical log data is lost -- old `type: "fluid"` records stay in the database.
- Those drinks can be searched and logged via NutritionCard food input.
- The `fluidPresets` profile field is left in place, so the data is not destroyed.

---

## 7. Assumptions Requiring Validation

### Resolved

| #   | Assumption                                    | Resolution                                                                                                                                                                                                                                                                                    |
| --- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | "Aquarius" maps to "electrolyte drink"        | **Confirmed correct** -- Aquarius is a sports/electrolyte drink (Coca-Cola brand, popular in Japan/Spain). The mapping to `electrolyte drink` is semantically right. However, "aquarius" must be **added to the examples array** at `foodRegistryData.ts:348-360` for fuzzy matching to work. |
| R2  | `logAs: "food"` could be added for habits     | **Not feasible without significant work.** The validator at `habitTemplates.ts:624-626` explicitly rejects any value other than `"habit"` or `"fluid"`. The fluid volume pipeline in `useHabitLog.ts:647-653` would break. Habit templates stay unchanged.                                    |
| R3  | WaterModal does not exist yet                 | **Confirmed.** No `WaterModal` component exists in the codebase. It is a planned component (W2-04). Until it is built, FluidSection must remain mounted in Track.tsx for water logging.                                                                                                       |
| R4  | `fluidPresets` schema field can be left as-is | **Confirmed.** The field is `v.optional()` and causes no validation issues when unused.                                                                                                                                                                                                       |

### Still open (require product/design decisions)

| #   | Assumption                                                                           | Why it matters                                                                                                                                                                                                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| O1  | **Historical fluid logs for non-water drinks are NOT backfilled to `type: "food"`.** | Old Tea/Juice/etc. logs remain `type: "fluid"` while new logs for the same drinks are `type: "food"`. AI analysis and transit correlation queries must handle both types. This is a known gap that affects analytics correctness. **Decision needed: accept dual-type data, or plan a backfill migration.**                                                                |
| O2  | **Coffee dual-logging risk.**                                                        | Coffee has a habit template (`logAs: "fluid"`, `habitType: "destructive"`) AND a food registry entry (`foodRegistryData.ts:3637`). A user could tap the Coffee habit tile (creating a `type: "fluid"` log) and also log "coffee" via NutritionCard (creating a `type: "food"` log) for the same cup. **Decision needed: is this acceptable, or should the UX prevent it?** |
| O3  | **CustomDrinksSection removal timing.**                                              | Should the settings UI for drink presets be removed in the same wave as FluidSection removal (W4-02), or earlier/later? Removing it before FluidSection is confusing; removing it after leaves orphaned UI. **Recommendation: remove in W4-02 alongside FluidSection.**                                                                                                    |
| O4  | **Default portion sizes for migrated drinks.**                                       | The food registry entries do not include default portions. The recommended amounts above (200-250 ml) are estimates aligned with habit template `quickIncrement` values. The actual defaults depend on the portion system designed in W0-04.                                                                                                                               |
| O5  | **Phasing constraint.**                                                              | FluidSection cannot be removed (W4-02) until WaterModal is implemented (W2-04). The migration must be phased: (1) build NutritionCard with WaterModal, (2) remove FluidSection. If these are in separate PRs, there is a transitional period where both water logging UIs exist.                                                                                           |
