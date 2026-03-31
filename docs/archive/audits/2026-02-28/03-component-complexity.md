# Category 4: Component Complexity -- God Components & Decomposition

**Audit Date:** 2026-02-28
**Scope:** All `.tsx` files under `src/` (105 files, 19,408 total lines)
**Auditor:** Claude Opus 4.6

---

## Severity Scale

| Severity | Criteria |
|----------|----------|
| **CRITICAL** | 500+ lines, 4+ mixed concerns, urgently needs decomposition |
| **HIGH** | 300+ lines, 3+ mixed concerns, should be decomposed soon |
| **MODERATE** | 200+ lines, 2 mixed concerns, would benefit from decomposition |
| **LOW** | Slightly oversized but manageable |
| **COULD BE IMPROVED** | Not broken, but has a clear path to better structure |

---

## Executive Summary

The codebase contains **one extreme god component** (`TodayLog.tsx` at 3,149 lines) that accounts for 16% of all component code. The main page orchestrator (`Track.tsx` at 832 lines) is the second-largest offender, mixing business logic, food parsing orchestration, celebration logic, and layout. Six more components exceed 500 lines, and four exceed 300 lines.

**Key patterns observed:**
1. **Monolithic log-display file** -- `TodayLog.tsx` contains 15+ sub-components, 8 type definitions, grouping logic, and helper functions all in one file
2. **Inline business logic in page components** -- `Track.tsx` computes Bristol consistency, normalizes episodes, and contains celebration/cap threshold logic that belongs in hooks or utility modules
3. **Settings mega-forms** -- `TrackingForm.tsx` and `AppDataForm.tsx` each handle 5-6 unrelated settings concerns in a single component
4. **Duplicated edit/save/delete patterns** -- Sub-row components in `TodayLog.tsx` repeat nearly identical inline editing state management

**Total findings: 15** (2 CRITICAL, 5 HIGH, 5 MODERATE, 2 LOW, 1 COULD BE IMPROVED)

---

## CRITICAL Findings

### C-01: `src/components/track/TodayLog.tsx` (3,149 lines)

**Severity:** CRITICAL
**Concerns mixed:** 6+ (type definitions, grouping/data-transformation logic, display helper functions, 7 sub-row editing components, 7 group-row components, main TodayLog component)

This is the largest file in the codebase by a factor of nearly 4x. It contains the entire log rendering pipeline: types, data grouping, helper functions, and 15+ React components.

**Specific issues:**

1. **8 display-item type definitions** (lines 39-87): `IndividualItem`, `CounterHabitGroup`, `EventHabitGroup`, `FluidGroup`, `FoodGroup`, `ActivityGroup`, `WeightGroup`, `ReproductiveGroup`, plus the union `DisplayItem`. These should be in a shared types file.

2. **`groupLogEntries` function** (~170 lines): A complex data transformation function that groups raw log entries into display items. This is pure business logic with no React dependency -- it belongs in a utility module (e.g., `lib/logGrouping.ts`).

3. **Helper functions** (~80 lines total): `sumFluidMl`, `getLogIcon`, `getLogColor`, `getLogDetail`, `formatItemDisplay`, `truncatePreviewText`, etc. These are pure functions that should be extracted to a shared helpers file.

4. **`LogEntry` component** (~400 lines): The main inline-editing component contains approximately 20 `useState` hooks for managing editing state across different log types (food, fluid, digestion, reproductive, weight, activity, habit). Each log type has its own editing fields, save logic, and delete confirmation. This component alone is a god component within a god component.

   State hooks observed in `LogEntry`:
   - `editing`, `saving`, `deleting`, `confirmDelete`
   - `draftTimestamp`, `draftNotes`
   - Digestion-specific: `draftBristol`, `draftEpisodes`, `draftAccident`, `draftUrgency`, `draftEffort`, `draftVolume`, `digestionExpanded`
   - Food-specific: `draftFoodItems`
   - Fluid-specific: `draftFluidItems`
   - Activity-specific: `draftActivityDuration`, `draftActivityNotes`
   - Reproductive-specific: `draftReproBleeding`, `draftReproSymptoms`, `draftReproPeriodStart`, `draftReproNotes`
   - Weight-specific: `draftWeightKg`, `draftWeightNotes`

5. **Sub-row components** (7 total, ~50-80 lines each): `FoodSubRow`, `FluidSubRow`, `ActivitySubRow`, `HabitSubRow`, `WeightSubRow`, `ReproductiveSubRow` -- each handles inline editing for a specific log type with largely duplicated patterns (edit button, save/cancel/delete actions, confirmation dialog).

6. **Group-row components** (7 total, ~80-120 lines each): `FoodGroupRow`, `FluidGroupRow`, `ActivityGroupRow`, `CounterHabitRow`, `EventHabitRow`, `WeightGroupRow`, `ReproductiveGroupRow` -- each renders a collapsible group header with an expand/collapse animation and delegates to sub-row components.

7. **Code duplication**: The save/delete/edit pattern is repeated nearly identically across all sub-row and group-row components. Each has: expand state, confirmation state, save handler, delete handler, and nearly identical JSX structure.

**Decomposition recommendation:**

```
src/components/track/today-log/
  types.ts                    -- DisplayItem union, group types
  groupLogEntries.ts          -- Pure grouping function
  helpers.ts                  -- getLogIcon, getLogColor, getLogDetail, etc.
  LogEntry.tsx                -- Main entry component (further split by type)
  editors/
    DigestionEditor.tsx       -- Digestion inline edit form
    FoodEditor.tsx            -- Food inline edit form
    FluidEditor.tsx           -- Fluid inline edit form
    ActivityEditor.tsx        -- Activity inline edit form
    ReproductiveEditor.tsx    -- Reproductive inline edit form
    WeightEditor.tsx          -- Weight inline edit form
    useInlineEditState.ts     -- Shared hook for edit/save/delete/confirm state
  groups/
    FoodGroupRow.tsx
    FluidGroupRow.tsx
    ActivityGroupRow.tsx
    CounterHabitRow.tsx
    EventHabitRow.tsx
    WeightGroupRow.tsx
    ReproductiveGroupRow.tsx
    GroupRowShell.tsx          -- Shared collapsible group wrapper
  sub-rows/
    FoodSubRow.tsx
    FluidSubRow.tsx
    ActivitySubRow.tsx
    HabitSubRow.tsx
    WeightSubRow.tsx
    ReproductiveSubRow.tsx
    SubRowShell.tsx            -- Shared sub-row edit/delete wrapper
  TodayLog.tsx                -- Main orchestrator (~100-150 lines)
```

A shared `useInlineEditState` hook could reduce the duplicated editing/saving/deleting state pattern across all editors. A shared `GroupRowShell` component could standardize the collapsible group pattern. Estimated reduction: 3,149 lines to ~150 lines in the main file, with each extracted module under 150 lines.

---

### C-02: `src/pages/Track.tsx` (832 lines)

**Severity:** CRITICAL
**Concerns mixed:** 5+ (business logic utilities, food parsing orchestration, celebration/cap threshold logic, habit counting, page layout and rendering)

The main tracking page is both a layout orchestrator and a business logic hub. It defines utility functions, manages 12+ `useState` hooks, 10+ `useMemo` hooks, and multiple `useCallback` hooks. The component function body alone is over 700 lines.

**Specific issues:**

1. **Inline utility functions** (lines 51-85): `bristolToConsistency`, `normalizeEpisodes`, `toNumberOrNull`, and `computeTodayHabitCounts` are pure functions defined at module scope. They belong in dedicated utility modules (`lib/digestive.ts` or similar).

2. **Excessive state and memos** (lines 87-250): The component manages:
   - `now`, `dayOffset`, `pendingParse` (useState)
   - `todayStart`, `todayEnd`, `todayLogs`, `selectedDate`, `selectedStart`, `selectedEnd`, `selectedLogs`, `visibleSelectedLogs`, `todayHabitCounts`, `todayFluidTotalsByName`, `todayFluidEntryCounts`, `totalFluidMl`, `todayBmCount`, `lastBmTimestamp`, `hadGapYesterday` (useMemo)

   Many of these derived values could be computed in a custom `useDayStats` hook.

3. **`handleQuickCaptureTap` function** (~100 lines, approximately lines 530-660): This single callback contains fluid logging, activity logging, habit increment dispatching, celebration threshold checking (target met vs. cap exceeded), caffeine-specific entry counting logic, and AI coaching refresh. This is the single most complex function in the component and mixes UI feedback (toasts, celebrations) with data mutations.

4. **Food parsing orchestration** (lines 254-400): `saveParsedItems`, `saveCorrectedItems`, `handleLogFood`, `handleFoodConfirm`, `handleFoodConfirmSkip` -- five functions managing the food parsing pipeline. This entire flow could be a `useFoodParsing` hook.

5. **Prop drilling**: The component passes 8+ props to `TodayLog`, 8+ props to `QuickCapture`, and various props to other child components. Many of these are callbacks defined inline.

6. **`any` type usage** (lines 686, 691): `handleDelete` and `handleSave` use `err: any` and `data: any` -- should use proper error types and `LogUpdateData`.

**Decomposition recommendation:**

```
src/pages/Track.tsx           -- Layout only (~150-200 lines)
src/hooks/useDayStats.ts      -- todayLogs, selected logs, fluid totals, BM counts
src/hooks/useFoodParsing.ts   -- saveParsedItems, saveCorrectedItems, handleLogFood, pending parse state
src/hooks/useQuickCapture.ts  -- handleQuickCaptureTap, celebration/cap logic
src/lib/digestive.ts          -- bristolToConsistency, normalizeEpisodes (pure functions)
```

---

## HIGH Findings

### H-01: `src/components/track/HabitDetailSheet.tsx` (596 lines)

**Severity:** HIGH
**Concerns mixed:** 4 (presentation mode detection, progress calculation helpers, habit settings management, dual rendering paths for mobile/desktop)

**Specific issues:**

1. **`useHabitDetailPresentationMode` hook** (~40 lines): Custom hook detecting device type for Drawer vs. Dialog rendering. Could be extracted to a shared responsive utility.

2. **Progress calculation helpers** (~60 lines): `getProgressFraction`, `getProgressBarColor`, `getDayStatus`, `getDayDotClasses` -- pure functions that could live in `lib/habitProgress.ts` (which already exists and handles related logic).

3. **Settings management**: The component handles habit target/cap editing, unit display conversion, and AI snippet generation alongside the main detail display. The settings form could be its own `HabitSettingsForm.tsx`.

4. **Dual rendering**: The component renders both a `Drawer` (mobile) and a `Dialog` (desktop) with shared content. The `ResponsiveShell` component exists in the codebase -- this component should use it instead of manually branching.

**Decomposition recommendation:**
- Extract progress helpers to `lib/habitProgress.ts`
- Extract settings form to `HabitSettingsForm.tsx`
- Use `ResponsiveShell` instead of manual Drawer/Dialog branching
- Target: main file under 250 lines

---

### H-02: `src/components/patterns/FoodSafetyDatabase.tsx` (587 lines)

**Severity:** HIGH
**Concerns mixed:** 4 (data analysis computation, AI flag computation, filtering/sorting logic, dual rendering for mobile/desktop)

**Specific issues:**

1. **6 inline sub-components**: `StatusBadge`, `BristolBreakdown`, `TrendIndicator`, `AiBadge`, `SortIcon`, `FoodRow` -- all defined in the same file. While individually small, their combined presence inflates the file.

2. **`buildAiFlags` function** (~30 lines): Computes AI-derived flags by parsing stored AI analysis history. This is business logic, not rendering.

3. **`computeTrend` function** (~20 lines): Statistical trend computation that belongs in a utility module.

4. **Dual rendering paths**: Mobile renders cards; desktop renders a table. These are substantially different JSX trees sharing the same data, making the component harder to maintain.

**Decomposition recommendation:**
- Extract `buildAiFlags` and `computeTrend` to `lib/foodAnalysis.ts`
- Extract `FoodRow` and its sub-badges to `FoodSafetyRow.tsx`
- Consider splitting mobile/desktop views into separate components sharing a data hook

---

### H-03: `src/components/track/FoodConfirmModal.tsx` (580 lines)

**Severity:** HIGH
**Concerns mixed:** 3 (custom modal/focus trap implementation, editable item state management, rendering)

**Specific issues:**

1. **Custom focus trap** (~40 lines): Manual implementation of focus trapping via `useRef` and `useEffect`. The codebase already has dialog primitives (`ResponsiveShell`, Base UI components) that handle focus management. This custom implementation is both redundant and a maintenance burden.

2. **Editable item state machine** (~100 lines): Complex state management for editing parsed food items, including composite food expansion, uncertain item resolution, and component-level quantity editing.

3. **`UncertainBlock` and `CompositeBlock` sub-components** (~120 lines each): Well-extracted sub-components, but they could be in their own files given the overall file size.

**Decomposition recommendation:**
- Replace custom focus trap with existing dialog/modal primitives
- Extract `UncertainBlock` and `CompositeBlock` to separate files
- Extract the editable-item state logic into a `useFoodConfirmState` hook

---

### H-04: `src/components/track/BowelSection.tsx` (571 lines)

**Severity:** HIGH (borderline MODERATE -- well-structured but large)
**Concerns mixed:** 3 (constant data definitions, sub-component definitions, main form logic)

**Specific issues:**

1. **Large constant data blocks** (~85 lines): `BRISTOL_ACCENT`, `SEVERITY_COLORS`, `SPECTRUM_POS`, and similar styling constants take up significant space. These are not logic, just configuration data that could live in a constants file.

2. **Sub-components**: `SeverityScale`, `VolumeScale`, `TripStepper` are well-extracted within the file, but they have no dependencies on the parent component's state -- they could be separate files.

3. **The main `BowelSection` component** itself is reasonably focused on bowel movement logging. The file size is inflated primarily by constants and self-contained sub-components rather than true complexity mixing.

**Decomposition recommendation:**
- Move constants to `lib/bowelConstants.ts`
- Move `SeverityScale`, `VolumeScale`, `TripStepper` to their own files under `components/track/bowel/`
- Main file would drop to ~250 lines

---

### H-05: `src/components/settings/TrackingForm.tsx` (560 lines)

**Severity:** HIGH
**Concerns mixed:** 6 (AI preferences, celebration settings, sleep goal settings, custom drink management, fluid defaults, habit management)

This is a classic "kitchen-sink settings form" anti-pattern. Six logically distinct settings areas are rendered in a single component with a single, long return statement.

**Specific issues:**

1. **6 distinct settings sections** rendered sequentially:
   - AI output preferences (format, length, tone)
   - Celebration/gamification toggles
   - Sleep goal configuration
   - Custom drink name management
   - Fluid default volumes (water, coffee)
   - Habit list management (add/archive)

2. **Unit conversion logic inline** (lines 71-78): Fluid unit conversion between metric and imperial is computed inline rather than using a shared utility.

3. **No section isolation**: All sections share the same component scope, making it impossible to lazy-load or independently test individual settings panels.

**Decomposition recommendation:**
```
src/components/settings/tracking/
  AiPreferencesSection.tsx
  CelebrationSection.tsx
  SleepGoalSection.tsx
  CustomDrinksSection.tsx
  FluidDefaultsSection.tsx
  HabitManagementSection.tsx
  TrackingForm.tsx             -- Composes the above (~50 lines)
```

---

## MODERATE Findings

### M-01: `src/components/settings/AppDataForm.tsx` (460 lines)

**Severity:** MODERATE
**Concerns mixed:** 5 (data export, cloud profile sync, API key management, unit/reproductive toggles, factory reset/delete account)

**Specific issues:**

1. **5 unrelated settings groups**: Data export (CSV/JSON), cloud profile sync, OpenAI API key entry, unit system toggle + reproductive health toggle, and destructive actions (factory reset, delete all data).

2. **`handleSaveProfile` and `handleLoadProfile`** (~60 lines combined): Cloud sync logic that should be in a hook.

3. **Export logic** (lines 46-71): CSV/JSON export generation using `papaparse` -- this is data processing logic, not UI.

4. **15+ Zustand selectors** at the component top: Every store selector for every settings section is pulled in at the top of the component, even though each is only used in its respective section.

**Decomposition recommendation:**
- Split into: `DataExportSection`, `CloudSyncSection`, `ApiKeySection`, `PreferencesSection`, `DangerZoneSection`
- Extract export logic to `lib/dataExport.ts`

---

### M-02: `src/components/settings/health/LifestyleSection.tsx` (439 lines)

**Severity:** MODERATE
**Concerns mixed:** 2 (form state management, repetitive UI rendering)

**Specific issues:**

1. **Highly repetitive UI patterns**: The smoking, alcohol, and recreational substances sections follow nearly identical patterns (frequency select, amount input, quit date picker). The shared structure could be abstracted into a `SubstanceTrackingField` component.

2. **Inline validation and conversion**: Each section has its own inline validation that could use shared form utilities.

**Decomposition recommendation:**
- Extract a reusable `SubstanceTrackingField` component
- Estimated reduction: 439 lines to ~200 lines

---

### M-03: `src/components/track/WeightEntryDrawer.tsx` (381 lines)

**Severity:** MODERATE
**Concerns mixed:** 3 (weight entry, weight settings, long-press detection)

**Specific issues:**

1. **Two distinct UI flows in one component**: Weight entry (log today's weight) and weight settings (set surgery start weight) are separate user flows that happen to share a trigger button.

2. **Long-press detection logic** (~40 lines): `handleWeightTilePointerDown`, `handleWeightTilePointerUp`, `handleWeightTilePointerCancel`, `handleWeightTilePointerLeave`, `handleWeightTileContextMenu` -- this pattern is duplicated from `QuickCaptureTile.tsx`. It should be a shared `useLongPress` hook.

3. **Unit conversion helpers** (lines 14-36): `kgToDisplay`, `displayToKg`, `sanitizeWeightInput` -- pure functions that could be in a shared utility.

**Decomposition recommendation:**
- Extract `useLongPress` hook (shared with `QuickCaptureTile.tsx`)
- Split into `WeightEntrySheet.tsx` and `WeightSettingsSheet.tsx`
- Move conversion helpers to `lib/unitConversion.ts`

---

### M-04: `src/components/AiInsightsSection.tsx` (344 lines)

**Severity:** MODERATE
**Concerns mixed:** 2 (analysis progress overlay, insights display with reply input)

**Specific issues:**

1. **4 components in one file**: `StepIcon`, `AnalysisProgressOverlay`, `ReplyInput`, `AiInsightsBody`, plus the main `AiInsightsSection`. While individually small, the file is approaching the complexity threshold.

2. **`AnalysisProgressOverlay`** (~80 lines) is a self-contained progress indicator that could be its own file.

**Decomposition recommendation:**
- Extract `AnalysisProgressOverlay` to its own file
- Keep other small sub-components co-located (they are tightly coupled to the parent)

---

### M-05: `src/components/BristolScale.tsx` (334 lines)

**Severity:** MODERATE
**Concerns mixed:** 2 (SVG illustration data, interactive picker + badge components)

**Specific issues:**

1. **`BristolIllustration` SVG component** (~165 lines): Contains 7 switch cases, each rendering a different SVG illustration. This is data/asset content, not logic.

2. **`BRISTOL_SCALE` data array** (~35 lines): Static data defining labels and descriptions for each Bristol type.

3. **`BristolScalePicker` and `BristolBadge`**: The actual interactive components are relatively small (~60 lines each).

**Decomposition recommendation:**
- Move `BristolIllustration` SVGs to a separate `BristolIllustrations.tsx` file or SVG asset files
- Move `BRISTOL_SCALE` data to `lib/bristolData.ts`
- Main file would be ~120 lines

---

## LOW Findings

### L-01: `src/components/patterns/DigestiveCorrelationGrid.tsx` (317 lines)

**Severity:** LOW

Contains a `CorrelationPane` sub-component and date range management logic. The component is focused on a single concern (displaying digestive correlations) but contains inline date picker logic that could be a shared `useDateRange` hook. Overall structure is acceptable.

---

### L-02: `src/pages/Archive.tsx` (304 lines)

**Severity:** LOW

Contains filtering, pagination, keyboard navigation, and star toggle. Mixes toolbar/filter logic with report display, but the concerns are closely related and the component is cohesive. Could benefit from extracting the filter toolbar into an `ArchiveToolbar.tsx` component.

---

## COULD BE IMPROVED

### I-01: `src/components/track/CycleHormonalSection.tsx` (303 lines)

**Severity:** COULD BE IMPROVED

Focused on a single domain (cycle/hormonal logging), but contains some inline validation and date calculation logic that could be extracted. The reproductive symptom option lists are defined inline rather than imported from the shared `lib/reproductiveHealth.ts` module.

---

## Cross-Cutting Concerns

### Prop Drilling

The following prop chains are notable:

| Source | Intermediate | Destination | Props drilled |
|--------|-------------|-------------|--------------|
| `Track.tsx` | -- | `TodayLog.tsx` | `logs`, `habits`, `selectedDate`, `dayOffset`, `onPreviousDay`, `onNextDay`, `onJumpToToday`, `onDelete`, `onSave` (9 props) |
| `Track.tsx` | -- | `QuickCapture` | `habits`, `todayHabitCounts`, `todayFluidMl`, `todayFluidEntryCounts`, `onTap`, `onLogSleepHours`, `onLogWeightKg`, `onLongPress` (8 props) |
| `TodayLog.tsx` | Group rows | Sub rows | `onSave`, `onDelete` passed through every group to every sub-row |
| `Track.tsx` | -- | `HabitDetailSheet` | `habit`, `count`, `fluidMl`, `daySummaries`, `streakSummary`, `onClose` (6 props) |

**Recommendation:** Consider a context provider for the day-level tracking state (selected logs, habit counts, fluid totals) to reduce drilling. Alternatively, the `useDayStats` hook recommended in C-02 could be consumed directly by child components.

### Duplicated Long-Press Pattern

The long-press detection pattern (pointerDown timer, pointerUp check, pointerCancel/Leave cleanup, contextMenu prevention) appears in at least 3 locations:
- `src/components/track/QuickCaptureTile.tsx` (lines 50-100)
- `src/components/track/WeightEntryDrawer.tsx` (lines 105-147)
- `src/components/track/SleepEntryDrawer.tsx` (similar pattern)

**Recommendation:** Extract a shared `useLongPress(callback, options)` hook.

### Duplicated `computeTodayHabitCounts`

This function appears in at least 2 locations with slightly different signatures:
- `src/pages/Track.tsx` (line 73)
- `src/components/DailyProgress.tsx` (line 22)

**Recommendation:** Consolidate into `lib/habitAggregates.ts` (which already exists and contains related functions).

### `any` Type Usage in Callbacks

`Track.tsx` uses `err: any` and `data: any` in `handleDelete` and `handleSave`. These should use proper types (`Error` and `LogUpdateData` respectively).

---

## Priority Ranking for Remediation

| Priority | Finding | Effort | Impact |
|----------|---------|--------|--------|
| 1 | C-01: TodayLog.tsx decomposition | Large (2-3 days) | Very high -- reduces largest file by 90%, eliminates duplication |
| 2 | C-02: Track.tsx hook extraction | Medium (1 day) | High -- separates business logic from layout |
| 3 | H-05: TrackingForm.tsx split | Small (0.5 days) | Medium -- improves settings maintainability |
| 4 | H-01: HabitDetailSheet.tsx cleanup | Medium (1 day) | Medium -- reduces complexity, uses existing patterns |
| 5 | H-02: FoodSafetyDatabase.tsx split | Small (0.5 days) | Medium -- separates analysis from rendering |
| 6 | H-03: FoodConfirmModal.tsx refactor | Medium (1 day) | Medium -- removes custom focus trap, uses primitives |
| 7 | H-04: BowelSection.tsx constants extraction | Small (0.5 days) | Low-medium -- cleaner separation |
| 8 | M-01: AppDataForm.tsx split | Small (0.5 days) | Medium -- improves settings maintainability |
| 9 | M-02: LifestyleSection.tsx abstraction | Small (0.5 days) | Low -- reduces repetition |
| 10 | Cross-cutting: `useLongPress` hook | Small (2 hours) | Low-medium -- reduces 3 instances of duplication |
| 11 | Cross-cutting: `computeTodayHabitCounts` dedup | Tiny (30 min) | Low -- single source of truth |

---

## Summary Statistics

| Metric | Value |
|--------|-------|
| Total `.tsx` files | 105 |
| Total lines | 19,408 |
| Files > 500 lines | 7 |
| Files > 300 lines | 11 |
| Files > 200 lines | 20 |
| CRITICAL findings | 2 |
| HIGH findings | 5 |
| MODERATE findings | 5 |
| LOW findings | 2 |
| COULD BE IMPROVED | 1 |
| Cross-cutting concerns | 4 |
