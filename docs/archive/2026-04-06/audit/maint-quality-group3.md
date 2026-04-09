# Maintainability & Code Quality Audit — Group 3

**Audited:** 2026-04-06
**Auditor:** Claude Sonnet 4.6 (automated)
**Scope:** 63 files across `src/components/` (archive, patterns, settings, track, root)

---

## Findings

---

### [CRITICAL] Section numbering comment mismatch in DrPooReportDetails

**Category:** Code Quality
**Files:** `src/components/archive/DrPooReport.tsx:177`, `DrPooReport.tsx:193`

**Description:**
The JSDoc comment at the top of `DrPooReportDetails` (lines 64–73) documents sections 0–5 in a specific order: "0. Clinical Reasoning, 1. Suspected Culprits, 2. Meal Ideas, 3. Did You Know, 4. Suggestions, 5. Disclaimer." However in the rendered JSX the Suggestions block is labelled `{/* 5. Suggestions */}` and the Disclaimer is labelled `{/* 6. Disclaimer */}` — meaning the comment says section 4 for Suggestions but the inline comment says 5, and the comment says section 5 for Disclaimer but the inline comment says 6. The count in the doc comment lists 6 items (0–5) but calls item 4 "Suggestions", while the rendered comment block calls the same item "5. Suggestions". This is actively misleading to any developer trying to reorder or add sections — they would count incorrectly, and any section enumerated "4" is completely missing from the rendered output (there is no `{/* 4. ... */}` in the JSX).

**Suggested Fix:**
Reconcile the section numbers. The doc comment lists 6 entries (0–5); align inline JSX comments to match. If "Did You Know?" is 3, Suggestions should be `{/* 4. Suggestions */}` and Disclaimer `{/* 5. Disclaimer */}`. Remove any gap. One true source of numbering — the doc comment — is sufficient; the per-block inline comments can be removed or shortened.

---

### [HIGH] Dead exports pollute the public API of `foodSafetyUtils` and `database/index`

**Category:** Maintainability
**Files:** `src/components/patterns/database/foodSafetyUtils.ts:20-30`, `src/components/patterns/database/index.ts:22-23`

**Description:**
`foodSafetyUtils.ts` exports `FILTER_OPTIONS`, `FilterStatus`, `SortKey`, and `SortDir`. These are re-exported verbatim through `database/index.ts`. A full-codebase search finds zero import sites for any of these four symbols outside the two files that define/re-export them. `BRAT_KEYS` (an alias for the imported `BRAT_FOOD_KEYS`) suffers the same fate. These unused exports create noise in the module API, make it unclear what the module's actual surface area is, and cause tree-shakers to keep the code even when it is unneeded. The re-export chain also means that renaming or deleting these will require two-file edits with no tooling help because nothing imports them.

**Suggested Fix:**
Delete the dead exports from `foodSafetyUtils.ts` (`FilterStatus`, `SortKey`, `SortDir`, `FILTER_OPTIONS`, `BRAT_KEYS`) and remove the corresponding entries from `database/index.ts`. If any of these are needed in an adjacent page, they can be added back when the consumer is written.

---

### [HIGH] `ZONE_COLORS` is duplicated across two unrelated components with different semantics

**Category:** Maintainability
**Files:** `src/components/track/FoodMatchingModal.tsx:38-42`, `src/components/track/nutrition/NutritionCard.tsx:324-328`

**Description:**
Both files define a `const ZONE_COLORS` map keyed by zone number (1, 2, 3). In `FoodMatchingModal.tsx` the values are Tailwind compound class strings (`"bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"` etc.). In `NutritionCard.tsx` the values are raw hex colours (`"#34d399"`, `"#fbbf24"`, `"#f97316"`). The two maps use different colouring choices for the same zones — zone 3 is red (`dark:text-red-400`) in the modal but orange (`#f97316`) in the nutrition card. A developer updating zone semantics would have to find and update both locations, and would likely miss the inconsistency in the styling approach.

**Suggested Fix:**
Extract zone colour logic into a shared utility in `src/lib/` (e.g. `src/lib/zoneColors.ts`) with a single canonical colour per zone. Components that need Tailwind class strings can derive them from the canonical colours or use a variant of the utility that returns class-strings. The semantic inconsistency (red vs orange for zone 3) should be resolved at the same time.

---

### [HIGH] `useIsMobile` hook is locally defined in `DeleteConfirmDrawer` instead of being a shared hook

**Category:** Maintainability
**Files:** `src/components/settings/DeleteConfirmDrawer.tsx:18-31`

**Description:**
`DeleteConfirmDrawer.tsx` defines a private `useIsMobile()` hook (lines 18–31) that uses `window.matchMedia` and `useEffect` for responsive switching between a Drawer and a Dialog. This is a classic reusable hook that almost certainly exists or will be needed elsewhere in this codebase (the `ResponsiveShell` component suggests the codebase already abstracts this concern). Keeping the hook private means: (1) any other component that needs the same logic will duplicate it, (2) the 768 px breakpoint is hard-coded as a local magic number with no reference to the design system token, and (3) the hook is not testable in isolation.

**Suggested Fix:**
Move `useIsMobile` (or the more general `useMediaQuery`) to `src/hooks/useMediaQuery.ts`. Export it with the breakpoint as a parameter. `MD_BREAKPOINT_PX` should either reference a shared design token constant or be defined once in `src/lib/breakpoints.ts`. `DeleteConfirmDrawer` then imports from the shared hook.

---

### [HIGH] `SmartViews.tsx` file mixes unrelated concerns — data validation logic with UI rendering

**Category:** Maintainability
**Files:** `src/components/patterns/database/SmartViews.tsx:1-113`

**Description:**
`SmartViews.tsx` exports: two runtime validation/normalisation functions (`normalizeColumnFilters`, `normalizeSorting`), three equality helpers (`columnFiltersEqual`, `sortingEqual`), two filter-matching functions (`rowMatchesFilters`, `countRowsForView`), two private `Set` constants used for validation (`FILTERABLE_COLUMN_IDS`, `SORTABLE_COLUMN_IDS`), type definitions (`SmartViewPreset`, `SmartViewsProps`), and the React component `SmartViews`. The non-UI logic (normalisation, equality, row-matching, row-counting) belongs in a utility module — either `filterUtils.ts` or a new `smartViewUtils.ts`. The current arrangement means unit-testing the normalisation functions requires importing the React component file, and any change to either the logic or the UI touches the same file.

**Suggested Fix:**
Move `normalizeColumnFilters`, `normalizeSorting`, `columnFiltersEqual`, `sortingEqual`, `rowMatchesFilters`, `countRowsForView`, `FILTERABLE_COLUMN_IDS`, and `SORTABLE_COLUMN_IDS` into `filterUtils.ts` (or a dedicated `smartViewUtils.ts`). Leave only `SmartViewPreset`, `SmartViewsProps`, and the `SmartViews` component in `SmartViews.tsx`. Update `index.ts` re-exports accordingly.

---

### [HIGH] `SORT_OPTIONS` in `FilterSheet.tsx` duplicates the sort column list that `SORTABLE_COLUMN_IDS` in `SmartViews.tsx` also enumerates

**Category:** Maintainability
**Files:** `src/components/patterns/database/FilterSheet.tsx:51-57`, `src/components/patterns/database/SmartViews.tsx:7`

**Description:**
`FilterSheet.tsx` defines `SORT_OPTIONS` as an explicit array of `{ value, label }` tuples covering `["lastTested", "bristolAvg", "transitAvg", "trials", "stage"]`. `SmartViews.tsx` independently defines `SORTABLE_COLUMN_IDS = new Set(["lastTested", "bristolAvg", "transitAvg", "trials", "stage"])`. If a developer adds a new sortable column they must update both locations. There is no enforcement of the relationship, and the two lists can silently diverge. Additionally, `SORT_OPTIONS` uses `"trials"` (mapped to the `resolvedTransits` accessor — not `totalTrials`) while `SORTABLE_COLUMN_IDS` uses `"trials"` with no label context; both refer to the same column but through the same opaque string.

**Suggested Fix:**
Define `SORT_OPTIONS` once in `filterUtils.ts` and derive `SORTABLE_COLUMN_IDS` from it (`new Set(SORT_OPTIONS.map(o => o.value))`). Import `SORT_OPTIONS` into `FilterSheet.tsx` and `SORTABLE_COLUMN_IDS` (or a derived constant) into `SmartViews.tsx`.

---

### [MODERATE] `MS_PER_DAY` (and sibling `MS_PER_HOUR`, `MS_PER_MINUTE`) are duplicated across multiple files

**Category:** Code Quality
**Files:** `src/components/patterns/database/columns.tsx:99-101`, `src/components/patterns/hero/BristolTrendTile.tsx:33`

**Description:**
`MS_PER_DAY = 86_400_000` is defined locally in both `columns.tsx` and `BristolTrendTile.tsx`. `MS_PER_HOUR` and `MS_PER_MINUTE` are additionally defined in `columns.tsx`. These are universal constants, not domain-specific. Duplication means a typo in one copy produces a silent numeric bug with no compile-time protection. The pattern of re-defining time constants locally in component files is a code smell that compounds — it tends to grow as more components need time calculations.

**Suggested Fix:**
Extract to `src/lib/timeConstants.ts`:

```ts
export const MS_PER_MINUTE = 60_000;
export const MS_PER_HOUR = 3_600_000;
export const MS_PER_DAY = 86_400_000;
```

Import from there in all consumers.

---

### [MODERATE] `formatRelativeTime` in `columns.tsx` belongs in `trialFormatters.ts` (or a shared date utility), not a column-factory file

**Category:** Maintainability
**Files:** `src/components/patterns/database/columns.tsx:107-133`

**Description:**
`columns.tsx` is a column-factory file that should contain only TanStack Table column definitions. Lines 107–133 define a `formatRelativeTime` helper function, and lines 141–153 define a `RelativeTime` React sub-component. These are general-purpose time-formatting utilities. `trialFormatters.ts` already exists in `src/lib/` and is imported in `TrialHistorySubRow.tsx` for exactly this class of formatting. Keeping `formatRelativeTime` and `RelativeTime` in `columns.tsx` means they cannot be reused (and would be duplicated if needed elsewhere), and makes `columns.tsx` harder to read as a column definition file.

**Suggested Fix:**
Move `formatRelativeTime` to `src/lib/trialFormatters.ts` (or `src/lib/dateUtils.ts`). Move `RelativeTime` to a small component file (e.g. `src/components/patterns/database/RelativeTime.tsx`) or inline it in `columns.tsx` as a thin wrapper that calls the shared formatter. Export from there and import into `columns.tsx`.

---

### [MODERATE] `MAX_CUSTOM_FOOD_PRESETS` magic number is locally defined inside a function body

**Category:** Code Quality
**Files:** `src/components/settings/PersonalisationForm.tsx:207`

**Description:**
The constant `MAX_CUSTOM_FOOD_PRESETS = 12` is declared inside the `addCustomFoodCard` callback function, not at module scope. Magic numbers inside function bodies are invisible to callers and cannot be referenced in validation logic, tests, or error messages without duplicating the value. There is already a pattern in this codebase for module-scoped max constants (`MAX_FLUID_PRESETS` imported from `@/store`). The inline constant is inconsistent with that convention.

**Suggested Fix:**
Move to module scope (or to a shared constants module if it needs to be referenced elsewhere):

```ts
const MAX_CUSTOM_FOOD_PRESETS = 12;
```

If the limit is significant enough to show in the UI ("You can add up to 12 custom foods"), reference the constant in the helper text rather than repeating the number.

---

### [MODERATE] `DrPooReport.tsx` is placed in `archive/` but is imported and used directly by the Track page

**Category:** Maintainability
**Files:** `src/components/archive/DrPooReport.tsx`, `src/components/track/dr-poo/AiInsightsBody.tsx:3`

**Description:**
`AiInsightsBody.tsx` on the Track page imports `CopyReportButton` and `DrPooReportDetails` directly from `src/components/archive/DrPooReport.tsx`. The `archive/` directory name implies components that are only used on the Archive page, but these components are actively used on Track — the app's primary page. This creates a misleading conceptual boundary. A developer might reasonably assume they can modify or delete archive components without affecting Track. The `ai-insights/index.ts` only re-exports `AnalysisProgressOverlay`, not the report components — making the actual export surface inconsistent.

**Suggested Fix:**
Move `DrPooReport.tsx`, `MealIdeaCard.tsx`, and `AnalysisProgressOverlay.tsx` out of `archive/` into a shared location such as `src/components/dr-poo/` or `src/components/patterns/ai-insights/`. The `archive/` directory should contain only components whose sole purpose is the Archive page. Update imports accordingly.

---

### [MODERATE] `MealIdeaCard.tsx` is not re-exported from `archive/ai-insights/index.ts`

**Category:** Maintainability
**Files:** `src/components/archive/ai-insights/index.ts:1`, `src/components/archive/ai-insights/MealIdeaCard.tsx`

**Description:**
`archive/ai-insights/index.ts` exports only `AnalysisProgressOverlay`. `MealIdeaCard` lives in the same directory but is absent from the barrel file. `DrPooReport.tsx` imports `MealIdeaCard` via a direct path rather than through the barrel (`import { MealIdeaCard } from "@/components/archive/ai-insights/MealIdeaCard"`). This is an inconsistency: the directory has a barrel file, yet some of its exports bypass it. Future imports of `MealIdeaCard` elsewhere would have to decide whether to use the barrel or the direct path, likely introducing further inconsistency.

**Suggested Fix:**
Add `export { MealIdeaCard } from "./MealIdeaCard";` to `archive/ai-insights/index.ts` and update `DrPooReport.tsx` to import via the barrel. Or, if the barrel is not intended to be the public API, remove `index.ts` and let all consumers use direct paths.

---

### [MODERATE] `BristolTrendTile` and `BmFrequencyTile` use inconsistent day-boundary strategies

**Category:** Maintainability
**Files:** `src/components/patterns/hero/BristolTrendTile.tsx:84-85`, `src/components/patterns/hero/BmFrequencyTile.tsx:52-54`

**Description:**
`BmFrequencyTile` uses calendar midnight boundaries (`new Date(year, month, date - N)`) to compute cutoff dates. This is correct for counting BMs per calendar day and ensures the 7-day window always covers 7 full days regardless of time of day. `BristolTrendTile` uses raw millisecond arithmetic (`now - days * MS_PER_DAY`) for the same cutoff calculation. This means a log at 11:59 PM may be included in one tile's window but excluded from the other's for the same `days` value. The two tiles also define `MS_PER_DAY` independently (see F007). For a medical app where day boundaries in digestion data are significant, this silent divergence in computation method is a maintainability and data-correctness risk.

**Suggested Fix:**
Standardise on the calendar midnight approach. Extract a shared utility function `getCutoffTimestamp(daysAgo: number): number` into `src/components/patterns/hero/utils.ts` (which already contains `getDateKey`). Both tiles import and use this function. This makes the boundary strategy explicit, testable, and consistent.

---

### [MODERATE] `useAppDataFormController` accepts `healthProfile` and `setHealthProfile` but never uses them

**Category:** Maintainability
**Files:** `src/components/settings/app-data-form/useAppDataFormController.ts:65-67`

**Description:**
The `UseAppDataFormControllerArgs` interface declares `healthProfile: HealthProfile | null` and `setHealthProfile: (updates: Partial<HealthProfile>) => void`. In the implementation, both are destructured with leading underscores (`_healthProfile`, `_setHealthProfile`) at line 65–66, signalling they are intentionally ignored. The caller (`AppDataForm.tsx`) still computes `patchHealthProfile` and passes it in. This is dead code in the controller interface. The comment at line 15 ("SET-F003: null until Convex has loaded the profile — mutations must not fire with stale defaults while null") references these params as if they had a role, but neither is used anywhere in the function body.

**Suggested Fix:**
Remove `healthProfile` and `setHealthProfile` from `UseAppDataFormControllerArgs`. Remove the corresponding `patchHealthProfile` wrapper in `AppDataForm.tsx`. Update the SET-F003 comment to accurately describe what the controller actually does with the null-profile scenario (which is: guard at the call site in `AppDataForm.tsx` before invoking the controller's mutations).

---

### [MODERATE] `ArtificialIntelligenceSection.tsx` contains a stale/incorrect model name in UI copy

**Category:** Code Quality
**Files:** `src/components/settings/app-data-form/ArtificialIntelligenceSection.tsx:73`

**Description:**
Line 73 states: `"Background tasks always use GPT-5 Mini."` This is a factual claim presented as UI copy. As of the audit date this model name does not match the standard OpenAI model naming convention (`gpt-4o-mini`, `gpt-3.5-turbo`, etc.) and appears to be either a future model name, a speculation, or a stale placeholder from early development. If the model name is wrong or changes, user-visible UI copy will be misleading. Separately, this string is also inconsistent with whatever `INSIGHT_MODEL_OPTIONS[0]` is — if the recommended model changes, the copy does not update automatically.

**Suggested Fix:**
Either: (a) derive the background model name from a constant defined alongside `INSIGHT_MODEL_OPTIONS` in `aiModels.ts` and reference it in the copy, or (b) replace the model name with a version-agnostic description like `"Background tasks always use a cost-optimised model."` Do not hard-code model names in UI strings.

---

### [MODERATE] `CloudProfileSection.tsx` contains a TODO comment about a missing Privacy Policy link that blocks GDPR compliance

**Category:** Maintainability
**Files:** `src/components/settings/app-data-form/CloudProfileSection.tsx:30-33`

**Description:**
A multi-line `TODO (pre-launch)` comment at lines 30–33 states that a Privacy Policy link was removed because the policy page is not yet published, and notes it "must be reinstated before public launch to comply with GDPR transparency requirements." This is a compliance item embedded as a source-code comment with no tracking in a work queue or issue tracker. It is at risk of being forgotten. The GDPR link currently in the component points to the EU Commission's generic data protection page — not a product-specific Privacy Policy.

**Suggested Fix:**
File a tracked work item for this (Linear/GitHub issue) and add the issue ID to the comment so it is findable. The generic GDPR Commission link should remain until the actual Privacy Policy is live, but the TODO comment should reference the issue number so it is not forgotten.

---

### [MODERATE] `ThemeProvider` uses a stale internal storage key `"kaka-tracker-theme"`

**Category:** Maintainability
**Files:** `src/components/theme-provider.tsx:37`

**Description:**
The default `storageKey` for `ThemeProvider` is `"kaka-tracker-theme"`. This key is the old project/app name. If the key name is mismatched with any other localStorage cleanup logic (e.g. the `clearLocalData` function in `useAppDataFormController.ts` lists explicit keys to remove), the theme preference would persist after a factory reset. More broadly, using an undocumented hard-coded string that references a legacy project name is a maintenance risk — it could be confused with live product data or accidentally targeted in a clearing operation.

**Suggested Fix:**
Move the storage key to a shared constants file (e.g. `src/lib/storageKeys.ts`) alongside the other storage keys used in `AppDataForm.tsx`. Use a name that reflects the current product (`"pdh-theme"` or `"pdh-tracker-theme"`). Ensure `clearLocalData` includes this key if a factory reset should also reset the theme.

---

### [MODERATE] `DrPooSection.tsx` uses `Label` with incorrect `justify-center` that has no effect

**Category:** Code Quality
**Files:** `src/components/settings/tracking-form/DrPooSection.tsx:114`

**Description:**
Line 114: `<Label className="text-xs justify-center text-[var(--text)]/70">`. A `Label` renders as an inline element (or `<label>`) — `justify-center` is a flexbox alignment property that has no effect unless the element is a flex container. This is likely copied from a flex layout context and left in by accident. It clutters the className and could confuse developers into thinking flexbox alignment is relevant here.

**Suggested Fix:**
Remove `justify-center` from the Label's className. If the intent was to center the label text, use `text-center` instead, and confirm whether centering is actually the desired layout.

---

### [MODERATE] `CustomDrinksSection.tsx` uses array index as React list key

**Category:** Code Quality
**Files:** `src/components/settings/tracking-form/CustomDrinksSection.tsx:23`

**Description:**
Line 23: `<div key={\`drink-${index}\`}>`. The fluid presets have a fixed maximum count (`MAX_FLUID_PRESETS`) and are rendered in the same order they appear in the `fluidDrafts`array. While this is technically safe when the list is fixed-length and non-reorderable, it is inconsistent with the pattern used everywhere else in the codebase (e.g.`CustomFoodCard`in`PersonalisationForm.tsx`uses`preset.id`). The index-as-key pattern suppresses React's ability to detect order changes and is flagged by lint rules. If the fluid drafts ever become reorderable, this key will cause bugs.

**Suggested Fix:**
If `fluidDrafts` have stable identities (e.g. a fixed slot index that is semantically meaningful), use the slot index with a comment explaining why it is stable. Otherwise assign stable IDs to fluid preset slots. The simplest fix is a comment: `{/* key is stable: fluid presets are fixed-length and non-reorderable */}`. A better fix is adding an `id` field to `FluidPresetDraft`.

---

### [MODERATE] `ConditionsSection.tsx` passes `healthProfile.comorbidities` to both `ChipGroup` instances but GI conditions and comorbidities are the same field

**Category:** Maintainability
**Files:** `src/components/settings/health/ConditionsSection.tsx:28-36`

**Description:**
Both `ChipGroup` instances in `ConditionsSection` display different `options` arrays (`HEALTH_GI_CONDITION_OPTIONS` vs `HEALTH_COMORBIDITY_OPTIONS`) but both bind to `healthProfile.comorbidities` as `selectedValues` and both call the same `toggleCondition` handler. This means selecting a GI condition and selecting a comorbidity both write to the same array field. While this may be intentional (the field stores all conditions regardless of sub-category), it is not stated anywhere in the code, and the two separate `ChipGroup` sections with different labels imply to a developer that the data is stored separately. The absence of a comment makes this a silent foot-gun when the domain model is reviewed.

**Suggested Fix:**
Add a comment above both `ChipGroup` components explaining that GI conditions and comorbidities intentionally share the same `comorbidities` field. If separation is ever desired, the shared array will need to be split. Alternatively, separate the fields at the type level if the distinction matters for AI context.

---

### [NICE-TO-HAVE] `LifestyleSection.tsx` uses a `switch` statement to dispatch `setHealthProfile` for each numeric field — a union-indexed approach would be simpler

**Category:** Code Quality
**Files:** `src/components/settings/health/LifestyleSection.tsx:115-135`

**Description:**
The `setNumeric` helper function uses a 5-arm `switch` statement keyed on a `NumericHealthProfileKey` union. Each arm is identical in structure (`setHealthProfile({ [key]: value })`). TypeScript's computed property syntax with the union key would eliminate the switch entirely. The `switch` pattern must be extended every time a new numeric field is added, creating a maintenance burden.

**Suggested Fix:**
Replace the switch with:

```ts
const setNumeric = (raw: string, key: NumericHealthProfileKey) => {
  const value = raw ? Number(raw) : null;
  if (value !== null && !Number.isFinite(value)) return;
  setHealthProfile({ [key]: value });
};
```

TypeScript will enforce that `key` is a valid `NumericHealthProfileKey` and that `value` is assignable to the field type.

---

### [NICE-TO-HAVE] `FoodMatchingModal.tsx` uses raw `--color-*` CSS tokens that diverge from the rest of the codebase

**Category:** Maintainability
**Files:** `src/components/track/FoodMatchingModal.tsx:267`, `FoodMatchingModal.tsx:288`, `FoodMatchingModal.tsx:321-322`

**Description:**
`FoodMatchingModal.tsx` references token names like `var(--color-border-default)`, `var(--color-bg-overlay)`, `var(--color-text-primary)`, `var(--color-text-secondary)`, `var(--color-text-tertiary)`, and `var(--color-bg-surface)`. The rest of the audited codebase uses tokens named `var(--border)`, `var(--surface-1)`, `var(--text)`, `var(--text-muted)`, `var(--text-faint)`, etc. The `--color-*` naming convention appears to be an older or alternative token system. If these tokens are not defined in the Tailwind v4 theme, they will silently fall back to `initial` in production, making text invisible or borders disappear.

**Suggested Fix:**
Audit which token names are actually defined in the design system CSS and replace `--color-*` tokens with their canonical equivalents. If both naming systems are defined, add a comment explaining the mapping. Eliminate use of the `--color-*` convention in this component to be consistent with the rest of the codebase.

---

### [NICE-TO-HAVE] `SliderControl.tsx` grid layout assumes exactly 3 options

**Category:** Code Quality
**Files:** `src/components/settings/tracking-form/DrPooSliderControl.tsx:51`

**Description:**
Line 51: `<div className="grid grid-cols-3 text-[10px]">`. The label row below the slider always uses a 3-column grid, but `SliderControl` is a generic component parameterised by `options: readonly AxisOption<T>[]`. Currently all callers happen to pass exactly 3 options (`APPROACH_OPTIONS`, `REGISTER_OPTIONS`, `STRUCTURE_OPTIONS`, `LENGTH_OPTIONS`). If a future caller passes 2 or 4 options, the grid will misalign the labels against the slider stops.

**Suggested Fix:**
Make the column count dynamic:

```tsx
<div className={`grid grid-cols-${options.length} text-[10px]`}>
```

Or, since Tailwind purges dynamic class strings, pass the count explicitly:

```tsx
style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
```

---

### [NICE-TO-HAVE] `PreviewTextField` in `DrPooPreviewComponents.tsx` uses regex that matches Unicode range `[\u2022-]` incorrectly

**Category:** Code Quality
**Files:** `src/components/settings/tracking-form/DrPooPreviewComponents.tsx:48`

**Description:**
Line 48: `/^[\u2022-]\s/`. Inside a character class, `\u2022-` is a partial range specification — the `-` here could be interpreted as a range from `\u2022` to the next character, which is `]` (end of class). Most JavaScript engines will interpret the trailing `-` as a literal hyphen when it appears at the end of a character class, but this is ambiguous. The intent is to match lines starting with a bullet character (`•`, `\u2022`) OR a hyphen (`-`). Lines 59 also uses `line.trim().replace(/^[\u2022-]\s*/, "")` with the same ambiguous character class.

**Suggested Fix:**
Write the regex unambiguously:

```ts
/^[\u2022\-]\s/   // explicit escaped hyphen
// or
/^[•-]\s/        // literal bullet + literal hyphen (hyphen at end of class = literal)
```

The clearest form is:

```ts
/^(\u2022|-)\s/; // alternation rather than character class range
```

---

## Summary

| Severity     | Count  |
| ------------ | ------ |
| CRITICAL     | 1      |
| HIGH         | 5      |
| MODERATE     | 10     |
| NICE-TO-HAVE | 4      |
| **Total**    | **20** |

---

## Notes

- No issues were found with Convex function determinism, auth patterns, or security in this file set (none of the audited files contain Convex queries/mutations/actions or Clerk auth calls).
- `src/App.tsx` is minimal and correct.
- `src/components/theme-provider.tsx` and `src/components/mode-toggle.tsx` are structurally sound; only the storage key naming issue is flagged.
- The settings health section components (`DemographicsSection.tsx`, `SurgerySection.tsx`, `MedicationsSection.tsx`, `DietarySection.tsx`) are well-structured with good validation patterns.
- `FilterSheet.tsx`, `DatabaseTable.tsx`, and the database column/filter utilities are generally well-organised; issues are about cross-file duplication rather than internal quality.
