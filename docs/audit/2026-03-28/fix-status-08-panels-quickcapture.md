# Fix Status: Panels & Quick Capture Audit Findings

**Date:** 2026-03-28
**Scope:** `src/components/track/panels/`, `src/components/track/FoodMatchingModal.tsx`, `src/components/track/quick-capture/`
**Typecheck:** Clean (no new errors introduced; all errors are pre-existing in unrelated files)

## HIGH Fixes (all applied)

| Finding | File | Fix |
|---|---|---|
| handleSave no in-flight guard | BowelSection.tsx | Added `if (saving) return;` at top, wrapped in `useCallback` with full deps |
| Broken ARIA combobox/listbox ownership | FoodMatchingModal.tsx | Added `role="group"` + `aria-label` to group divs, `role="presentation"` to sticky headers, fixed `aria-expanded` to use `open` prop instead of `groupedOptions.length > 0` |
| BristolScalePicker value typed as `number` | BristolScale.tsx | Changed `value: number` to `value: 1 \| 2 \| 3 \| 4 \| 5 \| 6 \| 7` in `BristolScalePickerProps`. Left `BristolIllustration` and `BristolBadge` as `number` since external callers pass wider types. |
| sanitizeDecimalInput multi-dot broken | weightUtils.ts | Re-split on `.` after multi-dot normalization (`finalParts`) before applying decimal truncation |
| populateEntryState doesn't clear entryValue in imperial_uk | WeightEntryDrawer.tsx | Added `setEntryValue("")` in the imperial_uk branch |
| Bounds checking runs before Math.round | WeightEntryDrawer.tsx | Round stones/pounds to integers BEFORE bounds check (`stones < 0 \|\| pounds < 0 \|\| pounds >= 14`) |
| fl oz values not converted to ml for custom fluid habits | AddHabitDrawer.tsx | Imported `flOzToMl`, applied `Math.round(flOzToMl(value))` to `quickIncrement` and `dailyTarget` when `selectedType === "fluid"` and `unitSystem !== "metric"` |

## MODERATE Fixes (all applied)

| Finding | File | Fix |
|---|---|---|
| Logs wrong drink on Enter when showOther is active | FluidSection.tsx | Enter key handler in amount input now checks `showOther` and calls `handleOtherSubmit()` instead of `handleLogSelectedFluid("Water")` |
| Save not disabled when bristolCode === null | BowelSection.tsx | Added `bristolCode === null` to Save button `disabled` prop |
| aria-expanded without aria-controls | CycleHormonalSection.tsx | Added `aria-controls="cycle-details"` to expand button, `id="cycle-details"` to target panel |
| Symptom toggles missing group label | CycleHormonalSection.tsx | Wrapped symptom toggles in `<fieldset>` with `<legend>` |
| String() cast on potentially undefined | ObservationWindow.tsx | Added `if (item == null) continue;` null guard before property access |
| Optimistic rollback drops dateValue | FoodSection.tsx | Saved `dateValue` before optimistic clear, restore it via `setDateValue(savedDateValue)` in error handler |
| SEVERITY_COLORS coupled to array index | bowelConstants.ts | Converted from positional array to `Record<string, SeverityColor>` keyed by option values (urgency, effort, volume). Consumer updated to use `SEVERITY_COLORS[opt.value]` |
| role="toolbar" without roving tabindex | BowelSection.tsx | Changed `role="toolbar"` to `role="group"` |
| X icon missing aria-hidden | DurationEntryPopover.tsx | Added `aria-hidden="true"` to X icon |
| weeklyActivitySessions uses new Date() without stable dep | HabitDetailSheet.tsx | Extracted `weekStartMs` into its own `useMemo` with empty deps (stable per mount, sheet is short-lived) |
| Progress bar silently clamps overshoot | WeightTrendChart.tsx | Removed upper clamp on `progressPercent`, bar width clamped to 100% visually, label changes to "Target exceeded" with emerald color when > 100% |

## Files Modified

- `src/components/track/panels/BowelSection.tsx`
- `src/components/track/panels/BristolScale.tsx`
- `src/components/track/panels/CycleHormonalSection.tsx`
- `src/components/track/panels/FluidSection.tsx`
- `src/components/track/panels/FoodSection.tsx`
- `src/components/track/panels/ObservationWindow.tsx`
- `src/components/track/panels/bowelConstants.ts`
- `src/components/track/FoodMatchingModal.tsx`
- `src/components/track/quick-capture/AddHabitDrawer.tsx`
- `src/components/track/quick-capture/DurationEntryPopover.tsx`
- `src/components/track/quick-capture/HabitDetailSheet.tsx`
- `src/components/track/quick-capture/WeightEntryDrawer.tsx`
- `src/components/track/quick-capture/WeightTrendChart.tsx`
- `src/components/track/quick-capture/weightUtils.ts`

## Files NOT Modified (no findings or not in scope)

- `src/components/track/panels/PanelTimePicker.tsx`
- `src/components/track/quick-capture/QuickCaptureTile.tsx`
- `src/components/track/quick-capture/QuickCapture.tsx`
- `src/components/track/quick-capture/UnitAwareInput.tsx`
