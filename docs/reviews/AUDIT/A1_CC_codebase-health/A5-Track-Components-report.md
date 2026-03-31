# A5 — Track Components Audit Report

**Date:** 2026-03-16
**Scope:** `src/components/track/` (all subdirectories)
**Files reviewed:** 46

---

## Summary

| Severity      | Count  |
| ------------- | ------ |
| Critical      | 6      |
| High          | 19     |
| Medium        | 22     |
| Low           | 14     |
| Accessibility | 17     |
| **Total**     | **78** |

---

## Critical Issues

| #   | File                                  | Line/Function                            | Description                                                                                                                                                                                  | Suggested Fix                                          |
| --- | ------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| C1  | `FoodMatchingModal.tsx`               | line 228                                 | **`currentItemIndex != null` is truthy when index is `0`** — queue mode skips the first item silently.                                                                                       | Must be `currentItemIndex !== undefined`.              |
| C2  | `WeightEntryDrawer.tsx`               | line 133                                 | **`renderUnitAwareInput` is a plain function inside a component**, not a React component. If hooks are ever added inside it, Rules of Hooks will be violated.                                | Refactor to a proper component or extract.             |
| C3  | `today-log/helpers.ts`                | `getLogDetail`, fluid branch (~line 259) | **For fluid logs with multiple items, only `items[0]` is accessed.** Multi-item fluid logs produce a wrong/incomplete display label with no error.                                           | Access all items and combine them.                     |
| C4  | `today-log/rows/LogEntry.tsx`         | line 227                                 | **`JSON.stringify` used for change detection before save** — silently fails on key-ordering differences or `undefined` vs missing properties.                                                | Use a field-by-field comparison or always allow saves. |
| C5  | `CycleHormonalSection.tsx`            | lines 31–64                              | **Hardcoded hex color strings** (`#38bdf8`, `#F51441`, etc.) bypass the design system token layer. If the theme changes, these will diverge silently.                                        | Use `var(--color-*)` tokens.                           |
| C6  | `today-log/groups/HabitGroupRows.tsx` | lines 165–170                            | **`EventHabitRow` uncheck fires `void onDelete(entry.id)` in a loop with no error handling and no loading state.** A partial failure silently leaves stale checked entries with no feedback. | Add error handling and a loading state.                |

---

## High Priority

| #   | File                                       | Line/Function                                                                                       | Description                                                                                                                                                       | Suggested Fix                                             |
| --- | ------------------------------------------ | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| H1  | `WeightEntryDrawer.tsx`                    | multiple (`// F001:`, `// F002:`, `// F003:`, `// F004:`, `// AB3:`, `// AA1:`, `// Z1:`, `// Z2:`) | **AI task-tracking codes embedded in source code.** These are not explanatory comments and pollute the codebase.                                                  | Remove all AI audit-trail comment codes.                  |
| H2  | `today-log/rows/LogEntry.tsx`              | lines 627–689                                                                                       | **Inline reproductive log editing UI duplicates** the full edit form already in `ReproductiveSubRow.tsx`. Two diverging implementations of the same form.         | Delegate to `ReproductiveSubRow`.                         |
| H3  | `today-log/rows/LogEntry.tsx`              | lines 423–478                                                                                       | **Urgency / effort / volume option arrays are defined inline** — these already exist canonically in `bowelConstants.ts`. Divergence is silent.                    | Import from `bowelConstants.ts`.                          |
| H4  | `today-log/helpers.ts`                     | `formatItemDisplay` (~line 137) vs `getFoodItemDisplayName` (~line 64)                              | **Two functions that resolve food item display names via the same chain of logic.** One is redundant.                                                             | Identify and remove the redundant path.                   |
| H5  | `quick-capture/DurationEntryPopover.tsx`   | lines 29–48                                                                                         | **`TINT_BY_PROGRESS_COLOR` and `TINT_CLASSES` are exact duplicates** of the same constants in `QuickCaptureTile.tsx` lines 18–37.                                 | Extract to a shared module.                               |
| H6  | `BowelSection.tsx`                         | `SeverityScale` and `VolumeScale`                                                                   | **Both sub-components produce near-identical JSX button-grid structures** with only label/value differences.                                                      | Extract a single generic `ScalePicker` component.         |
| H7  | `FoodSection.tsx`                          | line 41                                                                                             | **`loadCustomFoodPresets()` called from `useEffect` with no error handling.** If LocalStorage is unavailable or JSON is corrupt, the error is silently swallowed. | Add a `.catch()` handler.                                 |
| H8  | `quick-capture/HabitDetailSheet.tsx`       | sleep onChange handler (~lines 390–400)                                                             | **`setSleepGoal` (Zustand) and `updateHabit` (Convex) called together with no rollback.** If the Convex mutation fails, the Zustand store is left inconsistent.   | Handle the Convex failure and rollback the Zustand state. |
| H9  | `today-log/rows/LogEntry.tsx`              | line 238                                                                                            | **`catch { /* Keep editor open */ }` silently swallows save errors.** The user sees nothing wrong.                                                                | Show a toast on error.                                    |
| H10 | `today-log/editors/ActivitySubRow.tsx`     | line 66                                                                                             | Same silent error swallowing on save.                                                                                                                             | Show a toast on error.                                    |
| H11 | `today-log/editors/FluidSubRow.tsx`        | line 83                                                                                             | Same silent error swallowing on save.                                                                                                                             | Show a toast on error.                                    |
| H12 | `today-log/editors/HabitSubRow.tsx`        | save `catch` block                                                                                  | Same silent error swallowing on save.                                                                                                                             | Show a toast on error.                                    |
| H13 | `today-log/editors/ReproductiveSubRow.tsx` | save `catch` block                                                                                  | Same silent error swallowing on save.                                                                                                                             | Show a toast on error.                                    |
| H14 | `today-log/editors/WeightSubRow.tsx`       | save `catch` block                                                                                  | Same silent error swallowing on save.                                                                                                                             | Show a toast on error.                                    |
| H15 | `today-log/editors/FoodSubRow.tsx`         | lines 277, 412                                                                                      | **`key={i}` (array index) as React key** for both draft and persisted item lists. Index keys break reconciliation when items are reordered or deleted.            | Use a stable unique key (e.g. item ID or canonical name). |
| H16 | `today-log/rows/LogEntry.tsx`              | line 567                                                                                            | Same `key={i}` index-key issue for food item editing list.                                                                                                        | Use a stable unique key.                                  |
| H17 | `dr-poo/ConversationPanel.tsx`             | line 27                                                                                             | **`stableEndMs = Date.now() + 7 days` computed inside `useMemo([])`.** Becomes stale for long-running sessions.                                                   | Recompute periodically or derive from a stable reference. |
| H18 | `today-log/grouping.ts`                    | `sumFluidMl`, unrecognized unit branch                                                              | **Unrecognized unit strings are silently treated as ml.** A log with `unit: "oz"` will be counted incorrectly with no warning.                                    | Throw or warn on unrecognized units.                      |
| H19 | `BowelSection.tsx`                         | `handleSave`, line 236                                                                              | **Async arrow function defined inline without `useCallback`.** New function reference on every render; potential stale-closure bugs.                              | Wrap in `useCallback`.                                    |

---

## Medium Priority

| #   | File                                  | Line/Function                   | Description                                                                                                                                             | Suggested Fix                                                                            |
| --- | ------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| M1  | `today-log/rows/LogEntry.tsx`         | lines 69–73                     | `getHabitIcon(habitConfig)` called twice for the same config object.                                                                                    | Extract to a single variable.                                                            |
| M2  | `today-log/groups/HabitGroupRows.tsx` | lines 29 and 38                 | `firstEntry` and `latest` both reference `group.entries[0]`. One is redundant.                                                                          | Use a single name.                                                                       |
| M3  | `today-log/groups/FluidGroupRow.tsx`  | fluid total display             | `totalL` always displayed as `{totalL}L` regardless of user's unit preference.                                                                          | Respect unit preference.                                                                 |
| M4  | `today-log/editors/FluidSubRow.tsx`   | cancel handler                  | Cancel manually resets each draft state field inline — inconsistent with `ReproductiveSubRow` pattern.                                                  | Extract a `resetDraft()` callback.                                                       |
| M5  | `quick-capture/WeightEntryDrawer.tsx` | lines 202–431                   | `WeightTrendChart` sub-component is 229 lines inside a 906-line file.                                                                                   | Extract to its own file.                                                                 |
| M6  | `CycleHormonalSection.tsx`            | `handleSave`, `toggleSymptom`   | Neither function is wrapped in `useCallback`. New references on every render; passed as props.                                                          | Wrap in `useCallback`.                                                                   |
| M7  | `FluidSection.tsx`                    | Enter keydown handler, line 139 | On Enter keypress the code hardcodes `"Water"` as the selected type regardless of current selection context.                                            | Use actual current selection.                                                            |
| M8  | `FluidSection.tsx`                    | `handleOtherClick`, focus logic | `requestAnimationFrame` for focus call with no comment explaining why.                                                                                  | Add a comment explaining the necessity of the deferred focus.                            |
| M9  | `dr-poo/AiInsightsSection.tsx`        | lines 117–129                   | Two near-identical empty-state `<div>` blocks.                                                                                                          | Consolidate into a shared `EmptyStateSlot` component.                                    |
| M10 | `RawInputEditModal.tsx`               | lines 49, 56, 57, 59            | Comments describe "what" not "why" (`// Clear the input`, `// Close the modal`).                                                                        | Remove or replace with intent-explaining comments.                                       |
| M11 | `FoodSection.tsx`                     | lines 56–59, 77, 83             | Same "what" comments with no "why" context.                                                                                                             | Remove or replace.                                                                       |
| M12 | `TodayLog.tsx`                        | lines 243–264                   | `case "sleep"` renders identical `<ActivityGroupRow>` as `case "activity"`.                                                                             | Collapse: `case "activity": case "sleep":`.                                              |
| M13 | `today-log/helpers.ts`                | overall                         | At 404 lines, mixes display formatters, domain calculations, and date utilities.                                                                        | Split into `formatters.ts` and `calculations.ts`.                                        |
| M14 | `ObservationWindow.tsx`               | `setInterval` 30s polling       | Polling interval not paused when tab is hidden (`document.visibilityState`).                                                                            | Pause interval on `visibilitychange`.                                                    |
| M15 | `today-log/rows/LogEntry.tsx`         | line 832                        | **At 832 lines this is the largest file in the directory.** Renders 8+ different log types inline.                                                      | Delegate each log type's editing UI to its SubRow component.                             |
| M16 | `useAutoEditEntry.ts`                 | line 21                         | `startEditing` in `useEffect` deps — if parent doesn't memoize `startEditing`, effect fires on every render.                                            | Callers must ensure `startEditing` is stable (`useCallback`).                            |
| M17 | `quick-capture/AddHabitDrawer.tsx`    | `handleCreateCustom`            | Multi-branch conditional for three creation paths (event / counter / duration) is deeply nested.                                                        | Extract the three creation paths into separate named functions.                          |
| M18 | `quick-capture/AddHabitDrawer.tsx`    | line 345                        | `const { templateKey: _removed, ...habitToAdd } = builtHabit` — underscore-prefixed destructure silently discards `templateKey` without explaining why. | Add a comment explaining why `templateKey` must not be included in the saved habit.      |
| M19 | `dr-poo/ConversationPanel.tsx`        | overall                         | At 251 lines, mixes message rendering, optimistic suppression logic, and scroll behavior.                                                               | Consider extracting scroll behavior to a hook.                                           |
| M20 | `quick-capture/HabitDetailSheet.tsx`  | `makeNumberSaveHandler`         | Factory function that returns a closure — non-trivial pattern with no explanatory comment.                                                              | Add a comment explaining why it exists (avoids duplicating 5 nearly-identical handlers). |
| M21 | `today-log/editors/FoodSubRow.tsx`    | overall                         | 520 lines — exceeds limit.                                                                                                                              | Decompose.                                                                               |
| M22 | `BowelSection.tsx`                    | overall                         | 498 lines — at limit.                                                                                                                                   | Decompose.                                                                               |

---

## Low Priority

| #   | File                                       | Line/Function          | Description                                                                                          | Suggested Fix                                                     |
| --- | ------------------------------------------ | ---------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| L1  | `today-log/editors/FluidSubRow.tsx`        | line 30                | `key?: string \| number` in props interface. `key` is React-reserved and never accessible as a prop. | Remove it from the interface.                                     |
| L2  | `today-log/editors/FoodSubRow.tsx`         | line 157               | Same `key?` in props interface.                                                                      | Remove.                                                           |
| L3  | `today-log/editors/HabitSubRow.tsx`        | line 14                | Same `key?` in props interface.                                                                      | Remove.                                                           |
| L4  | `today-log/editors/ReproductiveSubRow.tsx` | line 29                | Same `key?` in props interface.                                                                      | Remove.                                                           |
| L5  | `today-log/editors/WeightSubRow.tsx`       | line 17                | Same `key?` in props interface.                                                                      | Remove.                                                           |
| L6  | `today-log/editors/ReproductiveSubRow.tsx` | lines 267–272, 291–297 | Vendor-prefixed `WebkitLineClamp` / `WebkitBoxOrient` inline in JSX.                                 | Use Tailwind `line-clamp-2` (Tailwind v4 supports this natively). |
| L7  | `BristolScale.tsx`                         | line 207–210           | `{"✨"}` emoji span missing `aria-hidden="true"`. Decorative emojis announced by screen readers.     | Add `aria-hidden="true"`.                                         |
| L8  | `WeightEntryDrawer.tsx`                    | overall                | 906 lines — far exceeds 300-line limit.                                                              | Decompose.                                                        |
| L9  | `quick-capture/AddHabitDrawer.tsx`         | overall                | 636 lines — exceeds limit.                                                                           | Decompose.                                                        |
| L10 | `quick-capture/HabitDetailSheet.tsx`       | overall                | 669 lines — exceeds limit.                                                                           | Decompose.                                                        |
| L11 | `FoodMatchingModal.tsx`                    | overall                | 653 lines — exceeds limit.                                                                           | Decompose.                                                        |
| L12 | `today-log/rows/LogEntry.tsx`              | overall                | 832 lines — far exceeds limit.                                                                       | Decompose.                                                        |
| L13 | `today-log/helpers.ts`                     | overall                | 404 lines.                                                                                           | Split.                                                            |
| L14 | `quick-capture/WeightEntryDrawer.tsx`      | `WeightTrendChart`     | 229 lines inside a 906-line file — needs extraction.                                                 | Extract to own file.                                              |

---

## Accessibility Issues

| #   | File                                       | Element/Component                       | Issue                                                                                                                     | Fix                                                                              |
| --- | ------------------------------------------ | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| A1  | `dr-poo/ReplyInput.tsx`                    | line 85                                 | Text input has no `<label>`. `placeholder` is not an accessible substitute.                                               | Add `<label>` or `aria-label`.                                                   |
| A2  | `panels/FluidSection.tsx`                  | amount input, line 127                  | Amount input field has no `<label>`.                                                                                      | Add `<label>`.                                                                   |
| A3  | `panels/FoodSection.tsx`                   | food input, line 157                    | Food name input has no `<label>`.                                                                                         | Add `<label>`.                                                                   |
| A4  | `today-log/rows/LogEntry.tsx`              | notes textarea, line 482                | Textarea has no `<label>` or `aria-label`.                                                                                | Add `aria-label`.                                                                |
| A5  | `today-log/editors/ActivitySubRow.tsx`     | date/time/duration inputs               | Three inputs have no `<label>` elements.                                                                                  | Add `<label>` for each.                                                          |
| A6  | `TodayLog.tsx`                             | prev/next day navigation buttons        | Buttons have no `aria-label`. "Yesterday" or "Monday" text is insufficient for screen readers without additional context. | Add descriptive `aria-label`.                                                    |
| A7  | `TodayStatusRow.tsx`                       | status spans                            | Colored status spans convey information through color/position only with no `role` or `aria-label`.                       | Add `aria-label` with full context (e.g., "3 bowel movements today").            |
| A8  | `dr-poo/AiInsightsBody.tsx`                | `CollapsibleTrigger` button             | Missing `aria-expanded` attribute.                                                                                        | Add `aria-expanded`.                                                             |
| A9  | `BristolScale.tsx`                         | `BristolScalePicker`                    | Bristol type buttons convey meaning through SVG illustration only — no `aria-label` or `title` per button.                | Add `aria-label` to each button (e.g., "Type 1 - Separate hard lumps").          |
| A10 | `panels/BowelSection.tsx`                  | `SeverityScale` / `VolumeScale` buttons | Severity buttons (1–5) use numeric labels only. Screen readers need contextual labels.                                    | Add `aria-label` (e.g., "Urgency: 3 out of 5").                                  |
| A11 | `quick-capture/QuickCaptureTile.tsx`       | progress ring animation                 | Animated progress ring has no `role="progressbar"` or `aria-valuenow`.                                                    | Add `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`. |
| A12 | `quick-capture/WeightEntryDrawer.tsx`      | BMI trend chart                         | `WeightTrendChart` SVG has no accessible text equivalent (no `<title>` or `aria-label` on `<svg>`).                       | Add `<title>` element or `aria-label` on the SVG.                                |
| A13 | `today-log/editors/FoodSubRow.tsx`         | `FoodMatchingModal` lazy load           | No `Suspense` fallback with accessible loading announcement (`aria-live` region or `aria-busy`).                          | Add `aria-busy` or a `role="status"` live region.                                |
| A14 | `today-log/groups/HabitGroupRows.tsx`      | expand/collapse toggle                  | Group header buttons should carry `aria-expanded` to indicate expand state.                                               | Add `aria-expanded`.                                                             |
| A15 | `today-log/editors/ReproductiveSubRow.tsx` | symptom toggle buttons                  | Toggle buttons use only visual styling (ring/fill) to indicate selected state.                                            | Add `aria-pressed`.                                                              |
| A16 | `panels/CycleHormonalSection.tsx`          | bleeding status buttons                 | Selected state communicated only via background color.                                                                    | Add `aria-pressed`.                                                              |
| A17 | `dr-poo/AiInsightsSection.tsx`             | progress overlay                        | AI analysis progress overlay has no `aria-live="polite"` or `role="status"` announcement.                                 | Add `role="status"` and `aria-live="polite"`.                                    |

---

## Large Components (>300 lines)

| File                                    | Lines | Action Needed                                                      |
| --------------------------------------- | ----- | ------------------------------------------------------------------ |
| `today-log/rows/LogEntry.tsx`           | 832   | HIGH — delegate each log-type editing section to its SubRow        |
| `quick-capture/WeightEntryDrawer.tsx`   | 906   | HIGH — extract `WeightTrendChart`; split entry logic               |
| `quick-capture/HabitDetailSheet.tsx`    | 669   | MEDIUM — split settings sections into sub-components               |
| `FoodMatchingModal.tsx`                 | 653   | MEDIUM — extract `TicketForm` to own file                          |
| `quick-capture/AddHabitDrawer.tsx`      | 636   | MEDIUM — extract step components                                   |
| `today-log/editors/FoodSubRow.tsx`      | 520   | MEDIUM — extract matching modal trigger logic                      |
| `BowelSection.tsx`                      | 498   | MEDIUM — extract `SeverityScale`/`VolumeScale` to shared component |
| `today-log/helpers.ts`                  | 404   | LOW — split into `formatters.ts` and `calculations.ts`             |
| `today-log/rows/ReproductiveSubRow.tsx` | 358   | LOW — monitor; currently coherent                                  |
| `CycleHormonalSection.tsx`              | 310   | LOW — at limit; monitor                                            |
| `TodayLog.tsx`                          | 297   | LOW — at limit; monitor                                            |

---

## Dead Code

| #   | File                                  | Finding                                                                                                                                        |
| --- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | All five SubRow editor files          | `key?: string \| number` in props interface — React never passes `key` as a prop; dead code.                                                   |
| D2  | `today-log/groups/HabitGroupRows.tsx` | `latest` variable — alias for `group.entries[0]`, same reference as `firstEntry`.                                                              |
| D3  | `today-log/rows/LogEntry.tsx`         | Inline urgency/effort/volume arrays duplicate `bowelConstants.ts` — the constants file's exports are dead with respect to this rendering path. |
| D4  | `WeightEntryDrawer.tsx`               | AI task-tracking comment codes (`// F001:` etc.) are dead annotations not linked to any issue tracker.                                         |

---

## Cross-Cutting Patterns

**Silent error swallowing** is the most pervasive pattern. Six `catch { /* keep open */ }` blocks across `ActivitySubRow`, `FluidSubRow`, `HabitSubRow`, `ReproductiveSubRow`, `WeightSubRow`, and `LogEntry` silently discard save failures with no user notification. A shared error-toast helper should be called from each catch block.

**Missing `<label>` elements** appear in at least five separate input fields across four components — this is a systemic gap.

**`key?` in props interface** appears identically in all five SubRow editor components — introduced once and copy-pasted to all others. A single fix can be applied across all five files.

**Duplicated constants** (`TINT_BY_PROGRESS_COLOR`/`TINT_CLASSES` in two Quick Capture files; inline bowel option arrays duplicating `bowelConstants.ts`) — future edits to one copy will silently diverge from the other.
