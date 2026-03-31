# Flow Trace: Settings Change + Dependencies Audit

## Flow 5: User Changes a Setting (Health Profile)

### Trigger

- **Page:** `src/pages/Settings.tsx` (line 19, `SettingsPage`)
- **UI entry point:** On desktop (`lg+`), the "Health Profile & History" card renders `<HealthForm />` inline (line 81). On mobile (`< lg`), a `<DrawerTrigger>` tile labeled "Health Profile & History" (line 158) opens a `<Drawer>` containing `<HealthForm />` (line 177).
- The user interacts with form fields within `HealthForm` and its six child section components.

### Happy Path

#### Step 1: User edits a field in a section component

Each section receives `healthProfile` (the current `HealthProfile` object) and a `setHealthProfile(updates: Partial<HealthProfile>)` callback as props, following the `HealthSectionProps` interface defined in `src/components/settings/health/types.ts` (line 4).

Example: user changes their surgery type in `SurgerySection` (line 56-64):

```
onChange -> isValidSurgeryType(val) guard -> setHealthProfile({ surgeryType: val, surgeryTypeOther: "" })
```

All six sections follow the same pattern -- they call `setHealthProfile({ fieldName: newValue })` directly from their `onChange` handlers:

| Section               | File                                                     | Key handlers                                                                                                                                                                                                          |
| --------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SurgerySection`      | `src/components/settings/health/SurgerySection.tsx`      | Surgery type select (line 56), surgery date calendar (line 107), "Other" text input (line 77)                                                                                                                         |
| `DemographicsSection` | `src/components/settings/health/DemographicsSection.tsx` | Gender select (line 234-238), `setAgeFromDisplay` (line 193), `setHeightFromDisplayCm` (line 94), `setStartingWeightFromDisplay` (line 168)                                                                           |
| `ConditionsSection`   | `src/components/settings/health/ConditionsSection.tsx`   | `toggleCondition` (line 12-18) toggles comorbidities array, "Other conditions" text input (line 43)                                                                                                                   |
| `MedicationsSection`  | `src/components/settings/health/MedicationsSection.tsx`  | Four text inputs: medications (line 20), supplements (line 29), allergies (line 38), intolerances (line 49)                                                                                                           |
| `LifestyleSection`    | `src/components/settings/health/LifestyleSection.tsx`    | `setSmokingChoice` (line 56), `setAlcoholChoice` (line 62), `setRecreationalChoice` (line 77), `setFrequency` (line 94), `setNumeric` (line 115), `toggleRecreationalCategory` (line 137), lifestyle notes (line 360) |
| `DietarySection`      | `src/components/settings/health/DietarySection.tsx`      | Dietary history text input (line 19)                                                                                                                                                                                  |

**All changes are fired on every keystroke/selection** -- there is no debounce and no "Save" button.

#### Step 2: `HealthForm` wraps partial updates into a full `HealthProfile`

`src/components/settings/HealthForm.tsx` (line 14-26):

1. Calls `useHealthProfile()` from `src/hooks/useProfile.ts` to get `{ healthProfile, isLoading, setHealthProfile }`.
2. Creates a local `setHealthProfile` wrapper (line 20-26) that merges the partial update into the current full `healthProfile` before forwarding:
   ```
   void setFullHealthProfile({ ...healthProfile, ...updates })
   ```
   This wrapper is passed as the `setHealthProfile` prop to every child section.

#### Step 3: `useHealthProfile` hook merges and calls `patchProfile`

`src/hooks/useProfile.ts` (line 80-102):

1. `useHealthProfile()` gets `{ profile, isLoading, patchProfile }` from `useProfileContext()`.
2. Its `setHealthProfile` callback (line 83-89) receives `updates: Partial<HealthProfile>`, merges them:
   ```
   const merged = { ...profile.healthProfile, ...updates } as HealthProfile
   ```
3. Calls `patchProfile({ healthProfile: merged })` -- forwarding the entire merged `HealthProfile` object to the context.

**Note:** There is a double-merge happening. `HealthForm.setHealthProfile` at line 23 merges `{ ...healthProfile, ...updates }`, then `useHealthProfile.setHealthProfile` at line 85 does `{ ...profile.healthProfile, ...updates }` again. Since the output of step 2 is already a full `HealthProfile`, the second merge in step 3 is effectively a no-op (the input is already complete). This is redundant but harmless.

#### Step 4: `ProfileContext.patchProfile` calls the Convex mutation

`src/contexts/ProfileContext.tsx` (line 106-137):

1. `patchProfile(updates: PatchProfileArgs)` builds a conditional-spread argument object that only includes defined fields.
2. For health profile changes, this evaluates to `patchMutation({ healthProfile: <full HealthProfile> })`.
3. `patchMutation` is `useMutation(api.logs.patchProfile)` (line 83).

#### Step 5: Convex `patchProfile` mutation persists to database

`convex/logs.ts` (line 1124-1239):

1. **Authentication check** (line 1142-1144): Calls `ctx.auth.getUserIdentity()`. Throws `"Not authenticated"` if null.
2. **Find existing profile** (line 1146-1149): Queries `profiles` table by `userId` using `by_userId` index.
3. **Sanitization** (line 1181-1184): Runs `sanitizeUnknownStringsDeep(args.healthProfile, { path: "profile.healthProfile" })`. This recursively sanitizes all string values: normalizes unicode (NFKC), strips control characters, enforces a 5000-character-per-string limit (`INPUT_SAFETY_LIMITS.genericStoredString`). See `convex/lib/inputSafety.ts` lines 91-123.
4. **Validation**: The `healthProfileValidator` in `convex/validators.ts` (line 501-568) validates the entire shape via Convex's built-in arg validation before the handler runs.
5. **Write** (line 1206-1208): If profile exists, calls `ctx.db.patch(existing._id, updates)`. If not, inserts a new profile document (line 1212-1237) with required field defaults.

#### Step 6: Convex reactivity propagates the change back

After the mutation commits, Convex's reactive query system automatically triggers the `getProfile` query (`convex/logs.ts` line 1241-1264) for all subscribed clients. The `useQuery(api.logs.getProfile)` in `ProfileProvider` (line 82) receives the updated document. The `useMemo` at line 91-104 recomputes the resolved profile, which propagates through context to all consumers.

### Error/Fallback Branch

#### Validation Errors (Client-Side)

- **DemographicsSection** has `onBlur` validators for height, weight, and age fields. Invalid ranges trigger:
  - A `toast.error(msg)` via sonner (e.g., "Enter a number between 50 and 250 cm.") -- `DemographicsSection.tsx` lines 108-113, 130-134, 186-191, 207-213.
  - Inline error messages rendered below the field with `role="alert"` and `aria-invalid` on the input.
  - The state update still goes through (values are clamped via `Math.min`/`Math.max`), so the validation is **advisory only** -- data is always persisted.

- **SurgerySection** and **DemographicsSection** use type-guard functions (`isValidSurgeryType`, `isValidGender`) that silently reject invalid `<select>` values (early return, no error shown).

#### Mutation Errors (Server-Side)

- **Authentication failure**: `patchProfile` throws `"Not authenticated"` (line 1143). This would propagate as an unhandled Convex error. There is **no try/catch** in `ProfileContext.patchProfile` or `useHealthProfile.setHealthProfile` -- the promise rejection is unhandled (`void setFullHealthProfile(...)` at `HealthForm.tsx` line 23 discards the promise).
- **String length exceeded**: `sanitizeUnknownStringsDeep` throws if any string exceeds 5000 characters (`assertMaxLength` at `inputSafety.ts` line 125-130). Most text inputs have `maxLength` attributes (500-1200 chars) providing a first line of defense.
- **Habit count limit**: Not relevant for health profile, but the mutation guards against `> 100` habits.
- **Convex validator rejection**: If the object shape doesn't match `healthProfileValidator`, Convex rejects it before the handler runs.

**Key finding:** There is no user-facing error handling for mutation failures on the health profile save path. The `void` keyword at `HealthForm.tsx` line 23 explicitly discards the promise. Failed saves are silent.

### State Management

The profile state flow is **React Context only** -- no Zustand store is involved for the live profile data.

```
                                 Convex DB ("profiles" table)
                                       ^         |
                                       |         | (reactive subscription)
                          patchProfile |         | useQuery(api.logs.getProfile)
                            mutation   |         v
                                       |    ProfileProvider (React Context)
                                       |    src/contexts/ProfileContext.tsx
                                       |      - useMemo merges server data + defaults
                                       |      - provides { profile, isLoading, patchProfile }
                                       |         |
                                       |         v
                                   useProfileContext()
                                       |
                                       v
                               useHealthProfile()
                               src/hooks/useProfile.ts
                                 - extracts healthProfile slice
                                 - provides setHealthProfile (partial merge + patchProfile)
                                       |
                                       v
                                  HealthForm
                                  src/components/settings/HealthForm.tsx
                                    - wraps setHealthProfile for partial updates
                                    - passes to 6 section components as props
                                       |
                      +--------+-------+-------+--------+-------+
                      |        |       |       |        |       |
                  Surgery  Demographics Conditions Meds Lifestyle Dietary
```

**Mount point:** `ProfileProvider` wraps the entire authenticated app at `src/routeTree.tsx` (line 332-344), so profile data is available to all routes.

**Default values:** `DEFAULT_HEALTH_PROFILE` is defined in `src/store.ts` (line 79-132) and imported by `ProfileContext.tsx`. Used when server data is null/undefined.

**No Zustand involvement:** `src/store.ts` exports the default constant but does not manage profile state. Zustand is used only for ephemeral UI state (as per project architecture).

### Files Involved

| File                                                        | Role                                                                                           |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `src/pages/Settings.tsx`                                    | Top-level settings page; renders `HealthForm` in card (desktop) and drawer (mobile)            |
| `src/components/settings/HealthForm.tsx`                    | Orchestrates 6 health sections; wraps `setHealthProfile` for partial updates                   |
| `src/components/settings/health/types.ts`                   | `HealthSectionProps` interface shared by all sections                                          |
| `src/components/settings/health/index.ts`                   | Barrel export for all 6 sections                                                               |
| `src/components/settings/health/SurgerySection.tsx`         | Surgery type + date fields                                                                     |
| `src/components/settings/health/DemographicsSection.tsx`    | Gender, age, height, weight, BMI display                                                       |
| `src/components/settings/health/ConditionsSection.tsx`      | Comorbidities chip groups + free text                                                          |
| `src/components/settings/health/MedicationsSection.tsx`     | Medications, supplements, allergies, intolerances                                              |
| `src/components/settings/health/LifestyleSection.tsx`       | Smoking, alcohol, recreational substances                                                      |
| `src/components/settings/health/DietarySection.tsx`         | Dietary history free text                                                                      |
| `src/components/settings/health/ChipGroup.tsx`              | Reusable chip toggle group used by ConditionsSection                                           |
| `src/components/settings/health/SubstanceTrackingField.tsx` | `YesNoRadioGroup` and `FrequencySelect` components used by LifestyleSection                    |
| `src/components/settings/CollapsibleSectionHeader.tsx`      | Expandable section wrapper used by Conditions, Medications, Lifestyle                          |
| `src/hooks/useProfile.ts`                                   | `useHealthProfile()` hook: extracts health profile slice, provides partial-merge setter        |
| `src/contexts/ProfileContext.tsx`                           | `ProfileProvider` + `useProfileContext()`: bridges React to Convex, manages defaults + merging |
| `src/types/domain.ts`                                       | `HealthProfile` interface (line 222-254), `ReproductiveHealthSettings` (line 256-279)          |
| `src/store.ts`                                              | `DEFAULT_HEALTH_PROFILE` constant (line 79-132)                                                |
| `convex/logs.ts`                                            | `patchProfile` mutation (line 1124-1239), `getProfile` query (line 1241-1264)                  |
| `convex/validators.ts`                                      | `healthProfileValidator` (line 501-568), `reproductiveHealthValidator` (line 447-487)          |
| `convex/schema.ts`                                          | `profiles` table definition (line 322-337) with `healthProfile` as optional field              |
| `convex/lib/inputSafety.ts`                                 | `sanitizeUnknownStringsDeep` (line 91-123): recursive string sanitization + length enforcement |
| `src/routeTree.tsx`                                         | `ProfileProvider` mount point (line 332-344) wrapping all authenticated routes                 |
| `src/lib/units.ts`                                          | Unit conversion helpers used by DemographicsSection                                            |

### Downstream Consumers of Health Profile

The `useHealthProfile()` hook is consumed by 8 components/hooks beyond the settings forms:

| Consumer      | File                                                           | Usage                                                                             |
| ------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Track page    | `src/pages/Track.tsx:92`                                       | Reads `healthProfile` for cycle phase display and reproductive section visibility |
| AI Insights   | `src/hooks/useAiInsights.ts:63`                                | Passes health profile into AI analysis prompts                                    |
| Quick Capture | `src/hooks/useQuickCapture.ts:113`                             | Reads profile for habit auto-loading based on smoking status                      |
| Weight Drawer | `src/components/track/quick-capture/WeightEntryDrawer.tsx:443` | Reads + writes `currentWeight` on health profile                                  |
| Cycle Section | `src/components/track/panels/CycleHormonalSection.tsx:107`     | Reads reproductive health settings for cycle tracking display                     |
| AppDataForm   | `src/components/settings/AppDataForm.tsx:40`                   | Reads health profile for cloud profile section and reproductive toggle            |
| ReproForm     | `src/components/settings/ReproForm.tsx:8`                      | Reads + writes reproductive health sub-object                                     |

### Observations

1. **Fire-on-every-keystroke with no debounce.** Every character typed in a text field (medications, allergies, dietary history, lifestyle notes, etc.) triggers the full mutation pipeline: merge -> context -> Convex mutation -> DB write -> reactive query update. For a free-text field with typical 50-character input, that is 50 Convex mutations. This works because Convex is fast and the mutations are cheap, but it is atypical and could create unnecessary server load at scale.

2. **Silent mutation failures.** `HealthForm.tsx` line 23 uses `void setFullHealthProfile(...)` which discards the returned promise. If the Convex mutation fails (auth expired, string too long, network error), the user sees no feedback. The form field will appear to have the new value (via the controlled input), but the server state never changed. On the next `getProfile` reactive update, the field would silently revert.

3. **Double-merge is redundant.** `HealthForm.setHealthProfile` (line 20-26) merges partial into full, then `useHealthProfile.setHealthProfile` (line 84-89) merges partial into full again. The second merge receives an already-complete object, making it a no-op. This is architecturally clean (each layer is self-contained) but adds a small allocation overhead per keystroke.

4. **Advisory-only validation.** `DemographicsSection` validates on blur but the `onChange` handler always persists the clamped value. So validation errors appear _after_ the value is already saved. The toast + inline error is informational rather than preventive.

5. **No optimistic update mechanism.** The flow relies entirely on Convex's reactive subscription for UI consistency. There is no local optimistic state -- after a mutation, the UI waits for the server round-trip to confirm the value. In practice this is fast enough to be imperceptible, but adds a theoretical flash-of-old-value window.

6. **Health profile is a monolithic blob.** Every field change sends the entire `HealthProfile` object (30+ fields including nested `reproductiveHealth` with 20+ fields). There is no field-level patching at the Convex level. This means two concurrent edits to different fields could overwrite each other (last-write-wins), though with a single-user app this is unlikely.

7. **`maxLength` HTML attributes provide first-line defense** against oversized strings (500-1200 chars on most inputs), but the server enforces 5000 chars as the hard limit. The gap means the HTML limit is the meaningful constraint.

8. **`ConditionsSection` and `LifestyleSection` are wrapped in `CollapsibleSection`** (default closed), so their fields are not rendered until expanded. This means no unnecessary re-renders from profile changes until the user opens them.
