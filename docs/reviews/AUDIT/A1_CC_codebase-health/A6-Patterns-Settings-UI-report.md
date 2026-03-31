# A6 — Patterns, Settings & UI Codebase Health Audit

**Scope:** `src/components/patterns/`, `src/components/settings/`, `src/components/ui/`
**Date:** 2026-03-16
**Auditor:** Claude Sonnet 4.6 (read-only)
**Files reviewed:** 70+ files across all three directories

---

## Executive Summary

The codebase is functional and structurally coherent, but carries a consistent set of quality issues across all three directory groups. The dominant themes are:

1. **Design token bypass** — hardcoded Tailwind colour utilities and hex values throughout `patterns/` instead of CSS custom properties
2. **Incomplete Base UI migration** — Radix data-attribute selectors still present in `settings/` and `ui/` components despite the documented migration target
3. **Accessibility gaps** — missing `aria-sort`, `role="tooltip"`, `id`/`htmlFor` pairings, unlabelled inputs and switches
4. **Correctness bugs** — a pulse-animation transform origin error, duplicated field bindings, copy-paste field collision in pregnancy/postpartum, and a stale static-columns export
5. **File size discipline** — 7 files exceed the implicit 300-line guidance; `DrPooSection.tsx` is 994 lines

---

## Severity Key

| Severity | Meaning |
|---|---|
| CRITICAL | Data corruption, security risk, or broken runtime behaviour |
| HIGH | Type-safety violation (`as`/`!`), confirmed bug, or major accessibility failure |
| MEDIUM | Code smell, missing pattern, duplication, or incomplete migration |
| LOW | Style inconsistency, minor naming issue, minor accessibility gap |

---

## Section 1 — patterns/

### 1.1 Security

No security issues found in the patterns directory. All data displayed comes from typed props; no `dangerouslySetInnerHTML` usage.

### 1.2 Correctness

| ID | Severity | File | Location | Finding |
|---|---|---|---|---|
| P-C1 | HIGH | `transit-map/StationMarker.tsx` | Lines 67–68 | Pulse animation sets `transformOrigin: ${x}px ${y}px` on a `<g>` already translated to `(x, y)`. Child transforms should use `0px 0px`. As written, the animation orbits the wrong point in SVG space. |
| P-C2 | HIGH | `transit-map/TransitMap.tsx` | Lines 400–402 | Non-null assertions `activeSubLine.zones[0]!`, `[1]!`, `[2]!` with no runtime guard. If a sub-line has fewer than 3 zones the component will throw. |
| P-C3 | MEDIUM | `transit-map/useStationArtwork.ts` | Line 23 | `as Record<string, () => Promise<string>>` cast on `import.meta.glob` result. Type safety of all artwork loaders is suppressed. |
| P-C4 | MEDIUM | `database/columns.tsx` | Line 390 | `export const columns = buildColumns()` creates a static column snapshot at module load. Consumers using this export rather than `buildColumns()` will get stale definitions that ignore runtime configuration. |
| P-C5 | MEDIUM | `hero/BristolTrendTile.tsx` | Line 68 | `getDeltaDisplay` always returns `className: "text-rose-300"` regardless of whether the delta is positive. Upward and downward trends look identical. |
| P-C6 | LOW | `transit-map/TransitMapInspector.tsx` | Lines 106–109 | Developer rationale text rendered inside production UI: `"Keep the inspector clean by default..."` — end users can read this. |
| P-C7 | LOW | `transit-map/TransitMap.tsx` | Lines 295–299 | Two developer planning notes rendered as visible UI text: `"Image-first stops, cleaner track geometry..."` and `"The map now suppresses most inline labels..."`. |

### 1.3 Performance

| ID | Severity | File | Location | Finding |
|---|---|---|---|---|
| P-P1 | MEDIUM | `transit-map/useStationArtwork.ts` | Line 67 | Comment documents that the module-level artwork cache survives HMR reloads — this is a side effect of using module-scope state. If hot-reload produces stale artwork, this cache is the cause. Acceptable in production but worth naming. |

### 1.4 Maintainability

| ID | Severity | File | Location | Finding |
|---|---|---|---|---|
| P-M1 | MEDIUM | `database/SmartViews.tsx` | Lines 1–70 | Pure utility functions (`normalizeColumnFilters`, `normalizeSorting`, `columnFiltersEqual`, `sortingEqual`, `rowMatchesFilters`, `countRowsForView`) mixed into the same file as the `SmartViews` UI component. |
| P-M2 | MEDIUM | `transit-map/TransitMap.tsx` | 517 lines | File is 517 lines and contains header, sub-line selector, SVG canvas, and animation logic. Exceeds maintainability threshold; extraction candidates are clear. |
| P-M3 | MEDIUM | `transit-map/RegistryTransitMap.tsx` | 404 lines | `SummaryCard`, `StationButton`, `StationDetail`, `MetricCard`, `EvidenceStat`, `signalDotClass` are all defined in one 404-line file. |
| P-M4 | LOW | `transit-map/TransitMap.tsx` | Line 131–137 | `<style>` tag with keyframe animation injected via JSX. CSS animation belongs in a stylesheet or CSS module. |

### 1.5 Duplication

| ID | Severity | File | Location | Finding |
|---|---|---|---|---|
| P-D1 | MEDIUM | `hero/BmFrequencyTile.tsx` L28–34, `hero/BristolTrendTile.tsx` L34–40 | Both files | `getDateKey` function is defined identically in both files. |
| P-D2 | MEDIUM | `hero/BristolTrendTile.tsx` | Line 30 | `MS_PER_DAY = 86_400_000` duplicates the constant already in `@/lib/timeConstants`. |
| P-D3 | MEDIUM | `database/FoodRow.tsx` | Lines 36–40 and 76–80 | BRAT badge JSX duplicated in mobile and desktop branches. |
| P-D4 | LOW | `transit-map/TransitMapInspector.tsx` | Lines 6–23 | `StatusPill` defined locally, re-exported, and imported back into `TransitMap.tsx` — creates circular-ish dependency within the same feature folder. |

### 1.6 Dead Code

| ID | Severity | File | Location | Finding |
|---|---|---|---|---|
| P-DC1 | MEDIUM | `database/foodSafetyUtils.ts` | Lines 20–30 | `FILTER_OPTIONS`, `SortKey`, `SortDir` appear unused — TanStack Table uses its own filter/sort types. Verify no live consumers before removing. |
| P-DC2 | LOW | `database/columns.tsx` | Line 390 | `export const columns` is likely a backwards-compat export that should be removed or clearly documented as deprecated. |

### 1.7 Error Handling

| ID | Severity | File | Location | Finding |
|---|---|---|---|---|
| P-E1 | HIGH | `transit-map/TransitMap.tsx` | Lines 400–402 | Non-null assertions (see P-C2) — no runtime error recovery if zones array is shorter than 3. |

### 1.8 Accessibility

| ID | Severity | File | Location | Finding |
|---|---|---|---|---|
| P-A1 | HIGH | `database/DatabaseTable.tsx` | Sort header buttons | Sortable column header buttons lack `aria-sort` attribute. Screen readers cannot communicate sort state. |
| P-A2 | HIGH | `hero/Sparkline.tsx` | Chart container | No `aria-label` or visually-hidden description. Screen readers receive no meaningful chart data. |
| P-A3 | MEDIUM | `transit-map/StationTooltip.tsx` | Tooltip div | No `role="tooltip"` attribute. Tooltip content will not be announced by screen readers. |
| P-A4 | LOW | `hero/Sparkline.tsx` | Lines 83, 91 | Axis tick `fill: "#94a3b8"` is a hardcoded colour; if the user has forced colours or high-contrast mode this will not adapt. |

### 1.9 Design System

| ID | Severity | File | Location | Finding |
|---|---|---|---|---|
| P-DS1 | HIGH | `database/DatabaseTable.tsx` | Throughout | Entire component uses hardcoded `slate-900`, `slate-800`, `slate-700`, `slate-400` utilities — completely bypasses the design token system. |
| P-DS2 | HIGH | `database/FilterSheet.tsx` | `getFilterChipClassName`, Apply button | `border-slate-500`, `bg-slate-700`, `teal-500/60`, `teal-900/30`, `teal-200` hardcoded — not tokenized. |
| P-DS3 | MEDIUM | `transit-map/RegistryTransitMap.tsx` | `GROUP_THEME` object (lines 15–43) | All per-group colours use Tailwind utility classes (`border-orange-500/20`, `text-orange-200` etc.) instead of design tokens. |
| P-DS4 | MEDIUM | `hero/BmFrequencyTile.tsx` | Line 120 | `color="#fb7185"` passed to Sparkline — hardcoded hex. |
| P-DS5 | MEDIUM | `hero/BristolTrendTile.tsx` | Line 190 | `color="#fb7185"` passed to Sparkline — same hardcoded hex; duplication of P-DS4. |
| P-DS6 | MEDIUM | `hero/BristolTrendTile.tsx` | Lines 42–53 | `getScoreColor` returns `text-orange-300` for the "good" Bristol score range (3–5). Orange is conventionally a warning colour; green would be semantically correct. |
| P-DS7 | LOW | `transit-map/TransitMap.tsx` | Throughout | Multiple inline hex colours (`rgba(4,9,18,0.88)`, `#86efac`, `rgba(248,250,252,0.96)`) not tokenized. |
| P-DS8 | LOW | `database/BristolBreakdown.tsx` | Background colour | `color-mix(in srgb, ${bristolColor(e.code)} 12%, transparent)` as inline style. Dynamic but not tokenized. |

---

## Section 2 — settings/

### 2.1 Security

| ID | Severity | File | Location | Finding |
|---|---|---|---|---|
| S-SEC1 | LOW | `app-data-form/useAppDataFormController.ts` | Line 147 | `window.confirm()` for factory reset confirmation. Native dialogs can be suppressed or auto-dismissed in some automated/headless environments; more critically they are unstyled and break the calm UX contract. |

### 2.2 Correctness

| ID | Severity | File | Location | Finding |
|---|---|---|---|---|
| S-C1 | CRITICAL | `repro/PregnancySection.tsx` | Lines 189, 196 | Postpartum medication notes section is bound to `reproductiveHealth.pregnancyMedicationNotes` — the same field used by the pregnant section (line 147). Postpartum medication notes overwrite pregnancy medication notes. Postpartum should use a dedicated field. |
| S-C2 | HIGH | `repro/MenopauseSection.tsx` | Lines 81–82 | `onChange` handler sets both `menopauseHrtNotes` and `hormonalMedicationNotes` to the same value simultaneously — two separate fields manually kept in sync. Any future edit to one field breaks the other. |
| S-C3 | MEDIUM | `health/ConditionsSection.tsx` | Lines 26–37 | Both "GI medical conditions" and "Comorbidities affecting digestion" chip groups write to the same `healthProfile.comorbidities` array. A GI condition toggle is indistinguishable from a comorbidity toggle in stored data. |
| S-C4 | MEDIUM | `ReproForm.tsx` | Line 22 | `healthProfile.reproductiveHealth` is accessed directly after the `isLoading` guard without an explicit `null` check on `healthProfile`. If `healthProfile` is null after loading (e.g. a null-return from Convex), this will throw. |
| S-C5 | MEDIUM | `app-data-form/useAppDataFormController.ts` | Lines 193–200 | `toggleReproTracking` calls `setHealthProfile` which is defined as `(updates: Partial<HealthProfile>) => void` — but the underlying implementation (`void setFullHealthProfile(...)`) silently discards the returned Promise. |
| S-C6 | LOW | `PersonalisationForm.tsx` | Lines 54–58 | `biome-ignore lint/correctness/useExhaustiveDependencies` suppression — the suppressed dependency may cause stale closures. |

### 2.3 Performance

| ID | Severity | File | Location | Finding |
|---|---|---|---|---|
| S-P1 | MEDIUM | `AiSuggestionsCard.tsx` | Lines 43–86 | `handleGetSuggestions` is an async function defined inside the component with no `useCallback` wrapper — re-created on every render, which matters if it is passed as a prop. |

### 2.4 Maintainability

| ID | Severity | File | Location | Finding |
|---|---|---|---|---|
| S-M1 | MEDIUM | `TrackingForm.tsx` | 573 lines | Exceeds threshold significantly. Local `SectionHeader`, `buildCustomHabitByCategory`, and `reorderHabits` are all extraction candidates. |
| S-M2 | MEDIUM | `health/DemographicsSection.tsx` | 409 lines | Over threshold. The metric display logic, the height-mode toggle, and the display-value computations are separable. |
| S-M3 | MEDIUM | `health/LifestyleSection.tsx` | 368 lines | Over threshold. |
| S-M4 | MEDIUM | `CollapsibleSectionHeader.tsx` | File name vs export | File is named `CollapsibleSectionHeader.tsx` but exports `CollapsibleSection`. Name mismatch hinders discoverability. |
| S-M5 | MEDIUM | `settings/tracking-form/DrPooSection.tsx` | 994 lines | By far the largest file in scope. `PRESET_CARDS` data (lines 53–179), `ADVANCED_PREVIEW_MATRIX` (lines 279–512), `SliderControl`, `LengthTabBar`, `PreviewTextField`, `PreviewTextBlock` are all separable from the main component. |
| S-M6 | LOW | `PersonalisationForm.tsx` | Line 207 | `MAX_CUSTOM_FOOD_PRESETS = 12` defined inline — should be a named constant exported from a shared constants module. |
| S-M7 | LOW | `AppDataForm.tsx` | Lines 25–32 | `LOCAL_APP_STORAGE_KEYS` is a local array of magic key strings. If those key names change in the storage implementation this list silently drifts. |

### 2.5 Duplication

| ID | Severity | File | Location | Finding |
|---|---|---|---|---|
| S-DU1 | MEDIUM | `DeleteConfirmDrawer.tsx` (lines 17–31) vs `responsive-shell.tsx` (lines 33–57) | Both files | `useIsMobile` hook duplicates breakpoint detection already in `useResponsiveShellMode`. |
| S-DU2 | MEDIUM | `TrackingForm.tsx` (local `SectionHeader`) vs `ui/SectionHeader.tsx` | Both files | Essentially the same component defined twice. |
| S-DU3 | MEDIUM | `app-data-form/DataManagementSection.tsx` | Lines 25, 32–43 | Implements its own `isOpen` expand/collapse state with `ChevronRight` button — duplicates the `CollapsibleSection` pattern in `CollapsibleSectionHeader.tsx`. |
| S-DU4 | MEDIUM | `health/SubstanceTrackingField.tsx` + `health/DemographicsSection.tsx` + `health/SurgerySection.tsx` + `repro/CycleSection.tsx` + `repro/MenopauseSection.tsx` | Multiple files | Identical inline `<select>` styling string `h-9 w-full rounded-xl border border-[var(--section-health-border)] bg-[var(--surface-0)] px-3 text-sm text-[var(--text)]` repeated at least 5 times. A shared `HealthSelect` component or shared class constant would eliminate this. |
| S-DU5 | LOW | `FoodPersonalisationSection.tsx` | Lines 56–118 | Local `RadioGroup` component is fully generic and should live in `ui/`. |

### 2.6 Dead Code / Work Tickets in Production

| ID | Severity | File | Location | Finding |
|---|---|---|---|---|
| S-WT1 | MEDIUM | `AiSuggestionsCard.tsx` | Line 44 | `// SET-F006:` work-package marker in production code |
| S-WT2 | MEDIUM | `AppDataForm.tsx` | Lines 89, 119, 156 | `// SET-F003:`, `// SET-F004:` markers |
| S-WT3 | MEDIUM | `app-data-form/useAppDataFormController.ts` | Lines 15, 73, 117 | `// SET-F003:`, `// SET-F004:` markers |
| S-WT4 | MEDIUM | `health/DemographicsSection.tsx` | Line 31 | `// SET-F005:` marker |
| S-WT5 | MEDIUM | `PersonalisationForm.tsx` | Lines 39, 67 | `// Bug #46`, `// Bug #47` work-ticket references |

### 2.7 Error Handling

| ID | Severity | File | Location | Finding |
|---|---|---|---|---|
| S-E1 | MEDIUM | `AiSuggestionsCard.tsx` | Lines 92–99 | `handleApply` calls `void updateHabit(...)` — silently discards a Promise, swallowing any rejection. |
| S-E2 | MEDIUM | `health/DemographicsSection.tsx` | Multiple `onBlur` validators | `toast.error()` fires on every blur even if the user is mid-entry. Should debounce or only fire on submit. |

### 2.8 Accessibility

| ID | Severity | File | Location | Finding |
|---|---|---|---|---|
| S-A1 | HIGH | `tracking-form/CelebrationsSection.tsx` | Line 33 | `<Switch id="celebrations-enabled">` with no `<Label htmlFor="celebrations-enabled">`. Switch is completely unlabelled for screen readers. |
| S-A2 | HIGH | `tracking-form/QuickCaptureDefaultsSection.tsx` | Line 44 | `<Input>` with only a `placeholder` and no `<Label>`. Screen readers receive no field name. |
| S-A3 | MEDIUM | `health/DemographicsSection.tsx` | Lines 277–299 | Imperial height mode toggle buttons (`ft + in` / `inches`) lack `aria-pressed`. |
| S-A4 | MEDIUM | `health/DemographicsSection.tsx` | Lines 301–335 | Imperial ft+in inputs have no `id`/`htmlFor` label association. |
| S-A5 | MEDIUM | `health/LifestyleSection.tsx` | Lines 278–285, 313–320 | Raw `<input type="checkbox">` elements used instead of the `ui/Checkbox` component. Missing `id`/`htmlFor` label association. |
| S-A6 | MEDIUM | `repro/DatePickerButton.tsx` | Line 38 | `aria-label={placeholder}` where placeholder is `"dd/mm/yyyy"` — not a meaningful description. Parent should pass a semantic label. |
| S-A7 | MEDIUM | `repro/CycleSection.tsx` | Lines 159–172 | Raw `<input type="range">` with `aria-label` but no visual label linked to its current value via `aria-describedby` or `aria-valuetext`. |
| S-A8 | LOW | `settings/tracking-form/DrPooSection.tsx` | Lines 724–726 | `<Label htmlFor="dr-poo-preferred-name">` wraps only the icon; the `Input` has the `id` but the Label text is visually empty for screen readers. A sighted user sees no visual label text. |

### 2.9 Design System / Base UI Migration

| ID | Severity | File | Location | Finding |
|---|---|---|---|---|
| S-DS1 | HIGH | `app-data-form/ReproductiveHealthSection.tsx` | Line 36 | `data-[state=checked]:bg-violet-500 data-[state=unchecked]:bg-muted-foreground/25` — Radix data-attribute selectors on a Switch component. Should be `data-[checked]`/`data-[unchecked]` per CLAUDE.md. |
| S-DS2 | HIGH | `app-data-form/UnitsSection.tsx` | Line 27 | TODO comment explicitly confirms `data-[state=on]` is present where `data-[pressed]` is required. The toggle styling will not fire in Base UI. |
| S-DS3 | HIGH | `DeleteConfirmDrawer.tsx` | Line 166 | `data-[state=closed]:animate-out data-[state=open]:animate-in` — Radix selectors on a Dialog overlay. Should be `data-[popup-open]`/`not-data-[popup-open]`. |
| S-DS4 | MEDIUM | `CollapsibleSectionHeader.tsx` | Lines 22, 30, 31 | `var(--section-health)` hardcoded as accent colour. Component cannot be reused for other section themes without modification. |
| S-DS5 | LOW | `app-data-form/ArtificialIntelligenceSection.tsx` | Line 72 | Hardcoded product name `"GPT-5 Mini"` in user-facing text. Should derive from a constant or model-options array. |

---

## Section 3 — ui/

### 3.1 Security

No security issues found in `ui/`.

### 3.2 Correctness

| ID | Severity | File | Location | Finding |
|---|---|---|---|---|
| U-C1 | HIGH | `Confetti.tsx` | Line 118 | `randomBetween(-180, 180)` called inside `motion.div`'s `animate` prop — produces new random values on every re-render of each particle, not just at creation. Randomness should be pre-computed in `createParticles`. |
| U-C2 | MEDIUM | `accordion.tsx` | Line 34 | Still uses Radix `AccordionPrimitive` (from `radix-ui`). Trigger uses `[&[data-panel-open]>svg]` which is Base UI convention — but the underlying primitive is Radix. This is a mixed-migration state: CLAUDE.md documents the Radix-compatible naming convention but the data attribute mismatch means trigger rotation may not work. |
| U-C3 | MEDIUM | `tabs.tsx` | Line 36 | `data-[state=active]:bg-background` — Radix data attribute. Base UI uses `data-[active]`. The Tabs trigger active state styling will be a no-op in Base UI. |
| U-C4 | MEDIUM | `navigation-menu.tsx` | Line 141 | `NavigationMenuIndicator` uses `data-[state=visible]:animate-in data-[state=hidden]:animate-out` — these are Radix state attributes not mapped in CLAUDE.md. May not animate at all in Base UI. |

### 3.3 Performance

| ID | Severity | File | Location | Finding |
|---|---|---|---|---|
| U-P1 | LOW | `responsive-shell.tsx` | Lines 39–54 | `useResponsiveShellMode` attaches two separate `matchMedia` listeners (one for md, one for xl) that trigger the same handler. A single `resize` observer or combined query could simplify this. |

### 3.4 Maintainability

| ID | Severity | File | Location | Finding |
|---|---|---|---|---|
| U-M1 | MEDIUM | `TimeInput.tsx` | 319 lines | Over threshold. The `inline` and `icon` variants could be separated. |
| U-M2 | LOW | `SectionHeader.tsx` | `color`/`mutedColor` props | Typed as `string`. No enforcement that callers pass valid CSS variable format. A union type of known token names would be safer. |
| U-M3 | LOW | `date-picker.tsx` | Line 1 | `"use client"` directive in a Vite/React project. This directive is Next.js-specific and does nothing in this stack. |
| U-M4 | LOW | `tabs.tsx` | Line 1 | Same `"use client"` directive — Next.js artefact. |
| U-M5 | LOW | `toggle.tsx` | Line 1 | Same `"use client"` directive. |

### 3.5 Duplication

| ID | Severity | File | Location | Finding |
|---|---|---|---|---|
| U-DU1 | LOW | `TimeInput.tsx` (line 41 `clamp`) vs `transit-map/*` | Both locations | Local `clamp` utility function duplicated. A shared `@/lib/mathUtils` module would eliminate both. |

### 3.6 Dead Code

No dead exports identified in `ui/`. All exports have observable consumers.

### 3.7 Error Handling

No significant error-handling issues in `ui/` — the components are presentational and errors surface to callers.

### 3.8 Accessibility

| ID | Severity | File | Location | Finding |
|---|---|---|---|---|
| U-A1 | MEDIUM | `sonner.tsx` | Lines 33–34, 40–43 | `actionButtonStyle` and `cancelButtonStyle` use hardcoded `rgba(0,0,0,0.8)` and `rgba(0,0,0,0.25)` colours. In dark mode these will render as near-invisible dark elements on dark backgrounds. |
| U-A2 | LOW | `tooltip.tsx` | `TooltipTrigger` render prop | `React.cloneElement(render, undefined, children)` — using `undefined` as the props argument suppresses any prop merge. If `render` has props they will be lost. Should pass `{}` or the merged props explicitly. |

### 3.9 Design System / Base UI Migration

| ID | Severity | File | Location | Finding |
|---|---|---|---|---|
| U-DS1 | HIGH | `tabs.tsx` | Line 36 | `data-[state=active]` Radix selector (see U-C3). Migration to `data-[active]` required. |
| U-DS2 | HIGH | `switch.tsx` | Styling | `data-[state=checked]` Radix convention in a component not yet migrated to Base UI. Per CLAUDE.md this should be `data-[checked]`. Active state styling will not apply. |
| U-DS3 | HIGH | `toggle-group.tsx` | Throughout | Radix `ToggleGroupPrimitive`. `data-[state=on]`/`data-[state=off]` selectors confirmed unresolved (see `UnitsSection.tsx` TODO). |
| U-DS4 | MEDIUM | `accordion.tsx` | Line 34 | Mixed migration: Base UI `data-[panel-open]` attribute in trigger CSS but Radix backing primitive (see U-C2). |
| U-DS5 | MEDIUM | `collapsible.tsx` | All | Radix `CollapsiblePrimitive`. Not yet migrated but not in CLAUDE.md's explicit "do not replace" list. |
| U-DS6 | MEDIUM | `dropdown-menu.tsx` | Line 141 (CLAUDE.md note) | `DropdownMenuLabel` is rendered outside a `DropdownMenuGroup` in some usages. CLAUDE.md states `GroupLabel` must be inside `Group`. |
| U-DS7 | LOW | `popover.tsx` vs `tooltip.tsx` | Content components | Both still use Radix Popover/Tooltip primitives. Aligned with migration plan but noted for completeness. |
| U-DS8 | LOW | `sonner.tsx` | Lines 29–48 | Toast button styles use hardcoded pixel values and rgba colours. These should use design tokens or CSS variables. |

---

## Section 4 — Cross-Cutting Findings

### 4.1 Base UI Migration Completeness

The migration from Radix UI to Base UI is approximately 60% complete. The table below summarises unmigrated components:

| Component | File | Radix attributes still present | Impact |
|---|---|---|---|
| Switch | `ui/switch.tsx` | `data-[state=checked]` | State styling broken |
| Tabs | `ui/tabs.tsx` | `data-[state=active]` | Active tab styling broken |
| ToggleGroup | `ui/toggle-group.tsx` | `data-[state=on]` | Toggle state broken |
| Accordion | `ui/accordion.tsx` | Radix primitive + Base UI selectors | Mixed state |
| NavigationMenuIndicator | `ui/navigation-menu.tsx` | `data-[state=visible]`/`data-[state=hidden]` | Animations broken |
| ReproductiveHealthSection Switch | `settings/app-data-form/ReproductiveHealthSection.tsx` | `data-[state=checked]` | Consumer applies wrong selectors |
| DeleteConfirmDrawer Dialog | `settings/DeleteConfirmDrawer.tsx` | `data-[state=open]`/`data-[state=closed]` | Overlay animation broken |

### 4.2 File Size Violations (files over ~300 lines)

| File | Lines |
|---|---|
| `settings/tracking-form/DrPooSection.tsx` | 994 |
| `settings/TrackingForm.tsx` | 573 |
| `patterns/transit-map/TransitMap.tsx` | 517 |
| `settings/health/LifestyleSection.tsx` | 368 |
| `patterns/transit-map/RegistryTransitMap.tsx` | 404 |
| `settings/health/DemographicsSection.tsx` | 409 |
| `ui/TimeInput.tsx` | 319 |

### 4.3 Work-Ticket Markers in Production Code

The following marker comments should not appear in production code. All are findings:

- `// SET-F003:` — appears in `AppDataForm.tsx` (L89, L119, L156) and `useAppDataFormController.ts` (L15, L73, L117)
- `// SET-F004:` — same files
- `// SET-F005:` — `DemographicsSection.tsx` L31
- `// SET-F006:` — `AiSuggestionsCard.tsx` L44
- `// Bug #46`, `// Bug #47` — `PersonalisationForm.tsx` L39, L67

---

## Section 5 — Findings Summary Table

| ID | Severity | Category | File |
|---|---|---|---|
| S-C1 | CRITICAL | Correctness | `repro/PregnancySection.tsx` |
| P-C2 | HIGH | Correctness | `transit-map/TransitMap.tsx` |
| P-A1 | HIGH | Accessibility | `database/DatabaseTable.tsx` |
| P-A2 | HIGH | Accessibility | `hero/Sparkline.tsx` |
| P-DS1 | HIGH | Design System | `database/DatabaseTable.tsx` |
| P-DS2 | HIGH | Design System | `database/FilterSheet.tsx` |
| P-C1 | HIGH | Correctness | `transit-map/StationMarker.tsx` |
| P-C3 | HIGH | Correctness (`as` cast) | `transit-map/useStationArtwork.ts` |
| S-A1 | HIGH | Accessibility | `tracking-form/CelebrationsSection.tsx` |
| S-A2 | HIGH | Accessibility | `tracking-form/QuickCaptureDefaultsSection.tsx` |
| S-DS1 | HIGH | Design System/Migration | `app-data-form/ReproductiveHealthSection.tsx` |
| S-DS2 | HIGH | Design System/Migration | `app-data-form/UnitsSection.tsx` |
| S-DS3 | HIGH | Design System/Migration | `DeleteConfirmDrawer.tsx` |
| S-C2 | HIGH | Correctness | `repro/MenopauseSection.tsx` |
| U-C1 | HIGH | Correctness | `ui/Confetti.tsx` |
| U-DS1 | HIGH | Design System/Migration | `ui/tabs.tsx` |
| U-DS2 | HIGH | Design System/Migration | `ui/switch.tsx` |
| U-DS3 | HIGH | Design System/Migration | `ui/toggle-group.tsx` |
| P-C5 | MEDIUM | Correctness | `hero/BristolTrendTile.tsx` |
| P-C4 | MEDIUM | Correctness | `database/columns.tsx` |
| P-D1 | MEDIUM | Duplication | `hero/BmFrequencyTile.tsx`, `hero/BristolTrendTile.tsx` |
| P-D2 | MEDIUM | Duplication | `hero/BristolTrendTile.tsx` |
| P-D3 | MEDIUM | Duplication | `database/FoodRow.tsx` |
| P-DC1 | MEDIUM | Dead Code | `database/foodSafetyUtils.ts` |
| P-DS3–7 | MEDIUM | Design System | Various patterns/ |
| P-M1–4 | MEDIUM | Maintainability | Various patterns/ |
| S-C3 | MEDIUM | Correctness | `health/ConditionsSection.tsx` |
| S-C4 | MEDIUM | Correctness | `ReproForm.tsx` |
| S-C5 | MEDIUM | Correctness | `useAppDataFormController.ts` |
| S-DU1–5 | MEDIUM | Duplication | Various settings/ |
| S-M1–7 | MEDIUM | Maintainability | Various settings/ |
| S-A3–7 | MEDIUM | Accessibility | Various settings/ |
| S-DS4–5 | MEDIUM | Design System | Various settings/ |
| S-P1 | MEDIUM | Performance | `AiSuggestionsCard.tsx` |
| S-E1–2 | MEDIUM | Error Handling | Various settings/ |
| S-WT1–5 | MEDIUM | Work Ticket Markers | Various settings/ |
| U-C2–4 | MEDIUM | Correctness/Migration | `accordion.tsx`, `tabs.tsx`, `navigation-menu.tsx` |
| U-DS4–6 | MEDIUM | Design System | Various ui/ |
| U-A1 | MEDIUM | Accessibility | `sonner.tsx` |
| U-M1–2 | MEDIUM | Maintainability | `TimeInput.tsx`, `SectionHeader.tsx` |
| P-C6–7 | LOW | Correctness | `transit-map/TransitMapInspector.tsx`, `TransitMap.tsx` |
| P-A3–4 | LOW | Accessibility | `transit-map/StationTooltip.tsx`, `Sparkline.tsx` |
| P-DC2 | LOW | Dead Code | `database/columns.tsx` |
| P-D4 | LOW | Duplication | `transit-map/TransitMapInspector.tsx` |
| S-A8 | LOW | Accessibility | `tracking-form/DrPooSection.tsx` |
| S-DS5 | LOW | Design System | `app-data-form/ArtificialIntelligenceSection.tsx` |
| S-C6 | LOW | Correctness | `PersonalisationForm.tsx` |
| S-M7 | LOW | Maintainability | `AppDataForm.tsx` |
| U-M3–5 | LOW | Maintainability | `date-picker.tsx`, `tabs.tsx`, `toggle.tsx` |
| U-DS7–8 | LOW | Design System | `popover.tsx`, `sonner.tsx` |
| U-P1 | LOW | Performance | `responsive-shell.tsx` |
| U-DU1 | LOW | Duplication | `TimeInput.tsx` |
| U-A2 | LOW | Accessibility | `tooltip.tsx` |
| S-SEC1 | LOW | Security | `useAppDataFormController.ts` |

---

## Section 6 — Recommended Priorities

**Fix immediately (CRITICAL/HIGH correctness):**
1. `repro/PregnancySection.tsx` S-C1 — postpartum medication notes clobber pregnancy notes (data corruption)
2. `transit-map/StationMarker.tsx` P-C1 — pulse animation orbits wrong SVG point (visual bug)
3. `transit-map/TransitMap.tsx` P-C2 — non-null assertions on `zones[]` will throw (crash risk)
4. `repro/MenopauseSection.tsx` S-C2 — dual-field sync in onChange is fragile (data integrity)
5. `ui/Confetti.tsx` U-C1 — randomBetween in animate prop causes unstable re-renders

**Fix in next sprint (HIGH migration/accessibility):**
6. Complete Base UI migration for `switch.tsx`, `tabs.tsx`, `toggle-group.tsx` — state styling is broken
7. Fix Radix selectors in `ReproductiveHealthSection.tsx`, `UnitsSection.tsx`, `DeleteConfirmDrawer.tsx`
8. Add `aria-sort` to `DatabaseTable.tsx` sort headers
9. Add accessible description to `Sparkline.tsx` chart container
10. Label the unlabelled switch in `CelebrationsSection.tsx` and the unlabelled input in `QuickCaptureDefaultsSection.tsx`

**Schedule for Medium sprint:**
- Tokenise all hardcoded colours in `DatabaseTable.tsx`, `FilterSheet.tsx`, `RegistryTransitMap.tsx`
- Extract `DrPooSection.tsx` (994 lines) into sub-files
- Consolidate the `HealthSelect` inline-select pattern into a shared component
- Remove work-ticket markers (SET-F003 through SET-F006, Bug #46, Bug #47) from production code
- Create a shared `getDateKey` and import it in both hero tile files