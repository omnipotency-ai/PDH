# src/components/ Index

**Files:** 131
**Total Lines:** ~15,860 (estimated from file reads; see per-subdirectory breakdowns)

---

## src/components/track/ (46 files, ~7,900 lines)

### src/components/track/ (root)

| File Path                   | Lines | Purpose                                                                                                                                         | Key Exports         | Imported By                        |
| --------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ---------------------------------- |
| track/TodayStatusRow.tsx    | 89    | Displays today's BM count, fluid total, and time-since-last-BM with color-coded urgency                                                         | `TodayStatusRow`    | 1 (Track.tsx)                      |
| track/FoodMatchingModal.tsx | 653   | Modal for manually matching unresolved food items to the food registry, with search, candidate display, bucket filtering, and ticket submission | `FoodMatchingModal` | 1 (FoodSubRow.tsx via lazy import) |
| track/RawInputEditModal.tsx | 182   | Modal for editing a food log's raw input text, triggering server-side reprocessing                                                              | `RawInputEditModal` | 2 (FoodMatchingModal, FoodSubRow)  |

### src/components/track/dr-poo/

| File Path                          | Lines | Purpose                                                                                                                              | Key Exports         | Imported By           |
| ---------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------- | --------------------- |
| track/dr-poo/AiInsightsBody.tsx    | 45    | Collapsible wrapper showing the full Dr Poo report details with copy-to-clipboard and archive link                                   | `AiInsightsBody`    | 1 (AiInsightsSection) |
| track/dr-poo/AiInsightsSection.tsx | 137   | Top-level Dr Poo card with status indicators, inline progress overlay, conversation panel, and empty-state messaging                 | `AiInsightsSection` | 1 (Track.tsx)         |
| track/dr-poo/ConversationPanel.tsx | 252   | Scrollable chat-style conversation view for Dr Poo messages, with period summaries, optimistic user replies, and expandable messages | `ConversationPanel` | 1 (AiInsightsSection) |
| track/dr-poo/ReplyInput.tsx        | 116   | Input field for replying to Dr Poo with pending replies display and character counter                                                | `ReplyInput`        | 1 (ConversationPanel) |

### src/components/track/panels/

| File Path                             | Lines | Purpose                                                                                                                           | Key Exports                                                                                                                                | Imported By                      |
| ------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| track/panels/index.ts                 | 6     | Barrel export for panel components                                                                                                | Re-exports BowelSection, CycleHormonalSection, FluidSection, FoodSection, ObservationWindow, BowelFormState, CycleLogFormState, ParsedItem | 1 (Track.tsx)                    |
| track/panels/bowelConstants.ts        | 100   | Bristol type color accents, spectrum positions, severity colors, urgency/effort/volume option arrays                              | `BRISTOL_ACCENT`, `SPECTRUM_POS`, `SEVERITY_COLORS`, `URGENCY`, `EFFORT`, `VOLUME`                                                         | 1 (BowelSection)                 |
| track/panels/bristolScaleData.ts      | 272   | SVG shape data and labels for Bristol Scale illustrations (types 1-7)                                                             | `BRISTOL_LABELS`, `BRISTOL_ILLUSTRATION_SHAPES`, type `BristolShape`                                                                       | 1 (BristolScale)                 |
| track/panels/BristolScale.tsx         | 244   | Bristol Scale SVG illustration renderer, radio-group picker, and inline badge component                                           | `BRISTOL_SCALE`, `BristolIllustration`, `BristolScalePicker`, `BristolBadge`                                                               | 2 (BowelSection, LogEntry)       |
| track/panels/BowelSection.tsx         | 499   | Full bowel movement logging form with Bristol type picker, urgency/effort/volume scales, trip stepper, time backdating, and notes | `BowelSection`, `BowelFormState`                                                                                                           | via panels/index.ts -> Track.tsx |
| track/panels/CycleHormonalSection.tsx | 311   | Reproductive health cycle logging form with period start date picker, bleeding status buttons, symptom chips, and notes           | `CycleHormonalSection`, `CycleLogFormState`                                                                                                | via panels/index.ts -> Track.tsx |
| track/panels/FluidSection.tsx         | 254   | Fluid intake logging with quick presets, amount input, unit-aware display, and custom drink name entry                            | `FluidSection`                                                                                                                             | via panels/index.ts -> Track.tsx |
| track/panels/FoodSection.tsx          | 203   | Food logging input with custom food preset badges, time backdating, and optimistic submission                                     | `FoodSection`, `ParsedItem`                                                                                                                | via panels/index.ts -> Track.tsx |
| track/panels/ObservationWindow.tsx    | 219   | Observation window showing foods in transit and testing phases with progress bars and calibrated timing                           | `ObservationWindow`                                                                                                                        | via panels/index.ts -> Track.tsx |

### src/components/track/quick-capture/

| File Path                                    | Lines | Purpose                                                                                                                                                      | Key Exports            | Imported By               |
| -------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- | ------------------------- |
| track/quick-capture/index.ts                 | 1     | Barrel export for QuickCapture                                                                                                                               | `QuickCapture`         | 1 (Track.tsx)             |
| track/quick-capture/QuickCapture.tsx         | 139   | Grid of habit quick-capture tiles with routing to specialized entry UIs for sleep/activity/weight/fluid/checkbox habits                                      | `QuickCapture`         | via index.ts -> Track.tsx |
| track/quick-capture/QuickCaptureTile.tsx     | 210   | Individual habit tile with long-press support, animated counter transitions, progress coloring, and badge indicators                                         | `QuickCaptureTile`     | 1 (QuickCapture)          |
| track/quick-capture/AddHabitDrawer.tsx       | 637   | Multi-step drawer for adding habits: type selection, template browsing, custom creation with type-specific fields                                            | `AddHabitDrawer`       | 1 (QuickCapture)          |
| track/quick-capture/HabitDetailSheet.tsx     | 670   | Habit detail/settings sheet with 7-day micro-graph, progress bar, streak summary, and inline settings editing (goal, increment, kind toggle)                 | `HabitDetailSheet`     | 1 (Track.tsx)             |
| track/quick-capture/DurationEntryPopover.tsx | 295   | Duration entry popover for sleep (hours+minutes) and activity (minutes) habits, with tile rendering and long-press support                                   | `DurationEntryPopover` | 1 (QuickCapture)          |
| track/quick-capture/WeightEntryDrawer.tsx    | 907   | Full weight tracking component: quick-capture tile, entry popover, settings drawer with SVG trend chart, target weight auto-save, and surgery progress stats | `WeightEntryDrawer`    | 1 (QuickCapture)          |

### src/components/track/today-log/

| File Path                           | Lines | Purpose                                                                                                                           | Key Exports                                                    | Imported By                                                    |
| ----------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------- |
| track/today-log/index.ts            | 60    | Barrel export for the entire today-log subsystem                                                                                  | Re-exports all editors, groups, helpers, rows, types, TodayLog | 1 (Track.tsx)                                                  |
| track/today-log/types.ts            | 114   | TypeScript types for display items (group variants), component props, and draft items                                             | 14 type exports                                                | Multiple (helpers, grouping, editors, groups, rows)            |
| track/today-log/helpers.ts          | 404   | Utility functions for log display: food item resolution, log icons/colors/titles/details, date-time manipulation, text formatting | ~25 exported functions/types                                   | Multiple (editors, groups, rows, hooks/useUnresolvedFoodQueue) |
| track/today-log/grouping.ts         | 189   | Groups sorted log entries into display items (food group, fluid group, habit groups, activity/sleep, weight, reproductive)        | `groupLogEntries`                                              | 1 (TodayLog)                                                   |
| track/today-log/AutoEditContext.tsx | 20    | React context for propagating auto-edit entry ID to sub-row editors                                                               | `AutoEditProvider`, `useAutoEdit`                              | 2 (TodayLog, useAutoEditEntry)                                 |
| track/today-log/useAutoEditEntry.ts | 23    | Hook that auto-opens edit mode when entry ID matches the context's autoEditId                                                     | `useAutoEditEntry`                                             | 6 (all SubRow editors)                                         |
| track/today-log/TodayLog.tsx        | 298   | Main daily log component with date navigation, grouped display items, and auto-expand for auto-edit targets                       | `TodayLog`                                                     | via index.ts -> Track.tsx                                      |

### src/components/track/today-log/editors/

| File Path                                      | Lines | Purpose                                                                                                                                             | Key Exports                    | Imported By                        |
| ---------------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ---------------------------------- |
| track/today-log/editors/index.ts               | 7     | Barrel export for all sub-row editors                                                                                                               | Re-exports 6 SubRow components | via today-log/index.ts             |
| track/today-log/editors/ActivitySubRow.tsx     | 172   | Inline editor for activity/sleep log entries with date, time, and duration editing                                                                  | `ActivitySubRow`               | 1 (ActivityGroupRow)               |
| track/today-log/editors/FluidSubRow.tsx        | 211   | Inline editor for fluid log entries with unit-aware quantity display and editing                                                                    | `FluidSubRow`                  | 1 (FluidGroupRow)                  |
| track/today-log/editors/FoodSubRow.tsx         | 521   | Inline editor for food log entries with per-item resolution indicators, processing state, raw input edit modal, and lazy-loaded food matching modal | `FoodSubRow`                   | 1 (FoodGroupRow)                   |
| track/today-log/editors/HabitSubRow.tsx        | 137   | Inline editor for habit log entries with date/time editing                                                                                          | `HabitSubRow`                  | 2 (CounterHabitRow, EventHabitRow) |
| track/today-log/editors/ReproductiveSubRow.tsx | 359   | Inline editor for reproductive cycle log entries with bleeding status, symptoms, period start date, and notes                                       | `ReproductiveSubRow`           | 1 (ReproductiveGroupRow)           |
| track/today-log/editors/WeightSubRow.tsx       | 191   | Inline editor for weight log entries with unit-aware display and conversion                                                                         | `WeightSubRow`                 | 1 (WeightGroupRow)                 |

### src/components/track/today-log/rows/

| File Path                         | Lines | Purpose                                                                                                                                                       | Key Exports | Imported By            |
| --------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ---------------------- |
| track/today-log/rows/index.ts     | 1     | Barrel export for LogEntry                                                                                                                                    | `LogEntry`  | via today-log/index.ts |
| track/today-log/rows/LogEntry.tsx | 833   | Universal log entry component handling all log types (digestion gets expandable inline editor; food, fluid, reproductive, habit, activity get inline editing) | `LogEntry`  | 1 (TodayLog)           |

### src/components/track/today-log/groups/

| File Path                                       | Lines | Purpose                                                                                                    | Key Exports                        | Imported By            |
| ----------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------- | ---------------------- |
| track/today-log/groups/index.ts                 | 7     | Barrel export for all group row components                                                                 | Re-exports 6 group row components  | via today-log/index.ts |
| track/today-log/groups/FoodGroupRow.tsx         | 120   | Expandable grouped row for food log entries with unresolved item count badge and processing indicator      | `FoodGroupRow`                     | 1 (TodayLog)           |
| track/today-log/groups/FluidGroupRow.tsx        | 89    | Expandable grouped row for fluid entries with total liters display                                         | `FluidGroupRow`                    | 1 (TodayLog)           |
| track/today-log/groups/HabitGroupRows.tsx       | 197   | Expandable grouped rows for counter habits (showing count) and event/checkbox habits (with uncheck button) | `CounterHabitRow`, `EventHabitRow` | 1 (TodayLog)           |
| track/today-log/groups/ActivityGroupRow.tsx     | ~100  | Expandable grouped row for activity/sleep entries                                                          | `ActivityGroupRow`                 | 1 (TodayLog)           |
| track/today-log/groups/WeightGroupRow.tsx       | ~100  | Expandable grouped row for weight entries                                                                  | `WeightGroupRow`                   | 1 (TodayLog)           |
| track/today-log/groups/ReproductiveGroupRow.tsx | ~100  | Expandable grouped row for reproductive cycle entries                                                      | `ReproductiveGroupRow`             | 1 (TodayLog)           |

---

## src/components/patterns/ (31 files, ~3,100 lines)

### src/components/patterns/database/

| File Path                                | Lines | Purpose                                                                                                                   | Key Exports                                                                                               | Imported By                                      |
| ---------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| patterns/database/index.ts               | 47    | Barrel export for the entire database feature                                                                             | Re-exports all database components, utils, types                                                          | 1 (Patterns.tsx)                                 |
| patterns/database/filterUtils.ts         | 22    | Shared filter-value coercion utilities for column filters                                                                 | `coerceFilterValues`, `getColumnFilterValues`                                                             | 1 (columns.tsx)                                  |
| patterns/database/foodSafetyUtils.ts     | 140   | Food safety status formatting, Bristol color helpers, Bayesian trend computation, AI override flag building               | `BRAT_KEYS`, `formatStatusLabel`, `FILTER_OPTIONS`, `bristolColor`, `computeTrend`, `buildAiFlags`, types | via index.ts -> Patterns.tsx, TrialHistorySubRow |
| patterns/database/AiBadge.tsx            | ~40   | Tooltip badge showing AI analysis flags for a food item                                                                   | `AiBadge`                                                                                                 | 1 (columns.tsx)                                  |
| patterns/database/BristolBreakdown.tsx   | ~80   | Visual Bristol code breakdown with colored bars and tooltip                                                               | `BristolBreakdown`                                                                                        | 1 (columns.tsx)                                  |
| patterns/database/columns.tsx            | ~200  | TanStack Table column definitions for the food database, including status, trend, Bristol breakdown, and AI badge columns | `columns`, `buildColumns`, `buildFoodDatabaseRow`, type `FoodDatabaseRow`, type `OverrideStatus`          | via index.ts -> Patterns.tsx                     |
| patterns/database/DatabaseTable.tsx      | ~300  | TanStack Table-based food database table with sorting, filtering, and expandable rows                                     | `DatabaseTable`                                                                                           | via index.ts -> Patterns.tsx                     |
| patterns/database/FilterSheet.tsx        | ~200  | Responsive filter sheet for food database with multi-select status filters                                                | `FilterSheet`, `countActiveFilters`, type `FilterSheetProps`, type `StatusFilterValue`                    | via index.ts -> Patterns.tsx, columns.tsx        |
| patterns/database/FoodRow.tsx            | ~150  | Expandable food row in the database table with trial history sub-row                                                      | `FoodRow`                                                                                                 | via index.ts -> Patterns.tsx                     |
| patterns/database/SmartViews.tsx         | ~180  | Smart view presets (tabs) for food database with row counting and filter normalization                                    | `SmartViews`, plus utility functions                                                                      | via index.ts -> Patterns.tsx                     |
| patterns/database/StatusBadge.tsx        | ~50   | Colored badge showing food safety status                                                                                  | `StatusBadge`                                                                                             | 1 (columns.tsx)                                  |
| patterns/database/TrendIndicator.tsx     | ~40   | Arrow/icon indicator showing food trend direction                                                                         | `TrendIndicator`                                                                                          | 1 (columns.tsx)                                  |
| patterns/database/TrialHistorySubRow.tsx | ~120  | Expandable sub-row showing a food's trial history with Bristol code outcomes                                              | `TrialHistorySubRow`                                                                                      | via index.ts -> Patterns.tsx                     |

### src/components/patterns/hero/

| File Path                          | Lines | Purpose                                                 | Key Exports                                                        | Imported By                           |
| ---------------------------------- | ----- | ------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------- |
| patterns/hero/index.ts             | 6     | Barrel export for hero strip components                 | Re-exports BmFrequencyTile, BristolTrendTile, HeroStrip, Sparkline | 1 (Patterns.tsx)                      |
| patterns/hero/HeroStrip.tsx        | ~100  | Horizontal strip of summary tiles for the Patterns page | `HeroStrip`                                                        | via index.ts -> Patterns.tsx          |
| patterns/hero/BmFrequencyTile.tsx  | ~60   | Tile showing bowel movement frequency with sparkline    | `BmFrequencyTile`                                                  | 1 (HeroStrip)                         |
| patterns/hero/BristolTrendTile.tsx | ~60   | Tile showing Bristol type trend with sparkline          | `BristolTrendTile`                                                 | 1 (HeroStrip)                         |
| patterns/hero/Sparkline.tsx        | ~60   | Reusable SVG sparkline chart component                  | `Sparkline`, type `SparklineDataPoint`                             | 2 (BmFrequencyTile, BristolTrendTile) |

### src/components/patterns/transit-map/

| File Path                                    | Lines | Purpose                                                                                                                  | Key Exports                                                                                               | Imported By                |
| -------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | -------------------------- |
| patterns/transit-map/types.ts                | 40    | TypeScript types for transit map (FocusedStation, PositionedStation, PositionedTrack, TooltipState, StatusCounts)        | 5 type exports                                                                                            | Multiple transit-map files |
| patterns/transit-map/constants.ts            | 36    | Visual constants for the transit map SVG (colors, dimensions, positions)                                                 | `MAP_BACKGROUND`, `ZONE_SURFACES`, `STATUS_ORDER`, `STATION_RADIUS`, etc.                                 | Multiple transit-map files |
| patterns/transit-map/utils.ts                | 50    | Utility functions for transit map (search normalization, status counting, coordinate distribution, label formatting)     | `normalizeSearchValue`, `makeStatusCounts`, `distribute`, `getInitials`, `getCategoryShortLabel`, `clamp` | Multiple transit-map files |
| patterns/transit-map/useStationArtwork.ts    | ~40   | Hook to load station artwork images                                                                                      | `useStationArtwork`                                                                                       | 1 (TransitMap)             |
| patterns/transit-map/useTransitScene.ts      | ~120  | Hook computing positioned tracks, stations, and zone cards for the transit map SVG layout                                | `useTransitScene`                                                                                         | 1 (TransitMap)             |
| patterns/transit-map/TransitMap.tsx          | ~570  | Full transit-map SVG visualization showing food reintroduction zones with interactive stations, tooltips, and zone cards | `TransitMap` (default export)                                                                             | 1 (Patterns.tsx)           |
| patterns/transit-map/RegistryTransitMap.tsx  | ~200  | Wrapper that feeds registry data into TransitMap                                                                         | `RegistryTransitMap` (default export)                                                                     | 1 (Patterns.tsx)           |
| patterns/transit-map/TransitMapInspector.tsx | ~100  | Debug inspector overlay for transit map data                                                                             | `TransitMapInspector`                                                                                     | 1 (TransitMap)             |
| patterns/transit-map/IntersectionNode.tsx    | ~60   | SVG intersection node component for transit map                                                                          | `IntersectionNode`                                                                                        | 1 (TransitMap)             |
| patterns/transit-map/StationMarker.tsx       | ~80   | SVG station marker circle with status coloring and initials                                                              | `StationMarker`                                                                                           | 1 (TransitMap)             |
| patterns/transit-map/StationTooltip.tsx      | ~80   | Tooltip popup for transit map stations                                                                                   | `StationTooltip`                                                                                          | 1 (TransitMap)             |
| patterns/transit-map/TrackSegment.tsx        | ~60   | SVG track path segment with shadow and color strokes                                                                     | `TrackSegment`                                                                                            | 1 (TransitMap)             |
| patterns/transit-map/ZoneCard.tsx            | ~80   | Zone summary card with status counts and filtering                                                                       | `ZoneCard`                                                                                                | 1 (TransitMap)             |

---

## src/components/settings/ (41 files, ~3,200 lines)

### src/components/settings/ (root)

| File Path                               | Lines | Purpose                                                                                                                                                  | Key Exports                  | Imported By                                                 |
| --------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------- |
| settings/CollapsibleSectionHeader.tsx   | ~60   | Reusable collapsible section header with chevron toggle animation                                                                                        | `CollapsibleSection`         | 3 (ConditionsSection, LifestyleSection, MedicationsSection) |
| settings/SettingsTile.tsx               | ~40   | Settings grid tile button with icon and label                                                                                                            | `SettingsTile`               | 1 (Settings.tsx)                                            |
| settings/FoodPersonalisationSection.tsx | ~80   | Food personalisation settings (custom food presets management)                                                                                           | `FoodPersonalisationSection` | 1 (PersonalisationForm or TrackingForm)                     |
| settings/AiSuggestionsCard.tsx          | ~100  | Card that triggers and displays AI food-safety suggestions from Convex action                                                                            | `AiSuggestionsCard`          | 1 (TrackingForm)                                            |
| settings/DeleteConfirmDrawer.tsx        | ~80   | Confirmation drawer for destructive data operations                                                                                                      | `DeleteConfirmDrawer`        | 1 (DataManagementSection)                                   |
| settings/HealthForm.tsx                 | ~80   | Container form for health profile sections (demographics, surgery, conditions, dietary, medications, lifestyle)                                          | `HealthForm`                 | 1 (Settings.tsx)                                            |
| settings/PersonalisationForm.tsx        | ~100  | Container form for personalisation settings (food presets, custom food badges)                                                                           | `PersonalisationForm`        | 1 (Settings.tsx)                                            |
| settings/ReproForm.tsx                  | ~60   | Container form for reproductive health sections (cycle, menopause, pregnancy)                                                                            | `ReproForm`                  | 1 (Settings.tsx)                                            |
| settings/AppDataForm.tsx                | ~80   | Container form for app data settings (cloud profile, units, reproductive, AI, data management)                                                           | `AppDataForm`                | 1 (Settings.tsx)                                            |
| settings/TrackingForm.tsx               | ~300  | Main tracking settings form with habit reordering via drag, custom drinks, quick capture defaults, celebrations, hidden habits, and Dr Poo configuration | `TrackingForm`               | 1 (Settings.tsx)                                            |

### src/components/settings/health/

| File Path                                  | Lines | Purpose                                             | Key Exports                                               | Imported By                   |
| ------------------------------------------ | ----- | --------------------------------------------------- | --------------------------------------------------------- | ----------------------------- |
| settings/health/index.ts                   | 8     | Barrel export for health sections                   | Re-exports 6 section components + HealthSectionProps type | 1 (HealthForm)                |
| settings/health/types.ts                   | 9     | Shared HealthSectionProps interface                 | `HealthSectionProps`                                      | Multiple health section files |
| settings/health/DemographicsSection.tsx    | ~80   | Demographics form fields (age, height, etc.)        | `DemographicsSection`                                     | via index.ts -> HealthForm    |
| settings/health/SurgerySection.tsx         | ~120  | Surgery details with date picker and weight inputs  | `SurgerySection`                                          | via index.ts -> HealthForm    |
| settings/health/ConditionsSection.tsx      | ~80   | Medical conditions form with chip-based selection   | `ConditionsSection`                                       | via index.ts -> HealthForm    |
| settings/health/DietarySection.tsx         | ~60   | Dietary restrictions and preferences form           | `DietarySection`                                          | via index.ts -> HealthForm    |
| settings/health/MedicationsSection.tsx     | ~80   | Medications form with add/remove capabilities       | `MedicationsSection`                                      | via index.ts -> HealthForm    |
| settings/health/LifestyleSection.tsx       | ~80   | Lifestyle factors form (exercise, smoking, alcohol) | `LifestyleSection`                                        | via index.ts -> HealthForm    |
| settings/health/SubstanceTrackingField.tsx | ~60   | Reusable field for substance tracking configuration | `SubstanceTrackingField`                                  | health section files          |
| settings/health/ChipGroup.tsx              | ~50   | Reusable chip/tag group for multi-select options    | `ChipGroup`                                               | health section files          |

### src/components/settings/repro/

| File Path                           | Lines | Purpose                                                      | Key Exports                                                                    | Imported By                  |
| ----------------------------------- | ----- | ------------------------------------------------------------ | ------------------------------------------------------------------------------ | ---------------------------- |
| settings/repro/index.ts             | 5     | Barrel export for repro sections                             | Re-exports CycleSection, MenopauseSection, PregnancySection, ReproSectionProps | 1 (ReproForm)                |
| settings/repro/types.ts             | 7     | Shared ReproSectionProps interface                           | `ReproSectionProps`                                                            | Multiple repro section files |
| settings/repro/CycleSection.tsx     | ~80   | Cycle tracking configuration (cycle length, tracking toggle) | `CycleSection`                                                                 | via index.ts -> ReproForm    |
| settings/repro/MenopauseSection.tsx | ~80   | Menopause settings (status, HRT)                             | `MenopauseSection`                                                             | via index.ts -> ReproForm    |
| settings/repro/PregnancySection.tsx | ~80   | Pregnancy settings (due date, trimester)                     | `PregnancySection`                                                             | via index.ts -> ReproForm    |
| settings/repro/DatePickerButton.tsx | ~60   | Reusable date picker button for repro forms                  | `DatePickerButton`                                                             | repro section files          |

### src/components/settings/tracking-form/

| File Path                                              | Lines | Purpose                                                               | Key Exports                                                       | Imported By                  |
| ------------------------------------------------------ | ----- | --------------------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------- |
| settings/tracking-form/index.ts                        | 4     | Barrel export for tracking form sections                              | Re-exports CustomDrinksSection, DrPooSection, HiddenHabitsSection | 1 (TrackingForm)             |
| settings/tracking-form/shared.ts                       | 3     | Shared CSS class constant for tracking form selects                   | `SELECT_CLASS`                                                    | tracking-form section files  |
| settings/tracking-form/QuickCaptureDefaultsSection.tsx | ~80   | Quick capture default habit display settings                          | `QuickCaptureDefaultsSection`                                     | 1 (TrackingForm)             |
| settings/tracking-form/CustomDrinksSection.tsx         | ~80   | Custom drink presets management                                       | `CustomDrinksSection`                                             | via index.ts -> TrackingForm |
| settings/tracking-form/DrPooSection.tsx                | ~100  | Dr Poo AI assistant configuration (system prompt, model, temperature) | `DrPooSection`                                                    | via index.ts -> TrackingForm |
| settings/tracking-form/HiddenHabitsSection.tsx         | ~60   | List of hidden habits with restore buttons                            | `HiddenHabitsSection`                                             | via index.ts -> TrackingForm |
| settings/tracking-form/CelebrationsSection.tsx         | ~60   | Celebrations/confetti settings toggle                                 | `CelebrationsSection`                                             | 1 (TrackingForm)             |

### src/components/settings/app-data-form/

| File Path                                                | Lines | Purpose                                                          | Key Exports                                       | Imported By                 |
| -------------------------------------------------------- | ----- | ---------------------------------------------------------------- | ------------------------------------------------- | --------------------------- |
| settings/app-data-form/index.ts                          | 7     | Barrel export for app data form sections                         | Re-exports 5 sections + useAppDataFormController  | 1 (AppDataForm)             |
| settings/app-data-form/shared.ts                         | 6     | Shared CSS class constants for app data form                     | `APP_DATA_HEADING_CLASS`, `APP_DATA_SELECT_CLASS` | app-data-form section files |
| settings/app-data-form/CloudProfileSection.tsx           | ~80   | Cloud profile/Convex settings display                            | `CloudProfileSection`                             | via index.ts -> AppDataForm |
| settings/app-data-form/UnitsSection.tsx                  | ~60   | Unit system toggle (metric/imperial US/imperial UK)              | `UnitsSection`                                    | via index.ts -> AppDataForm |
| settings/app-data-form/ReproductiveHealthSection.tsx     | ~60   | Top-level reproductive health tracking enable/disable            | `ReproductiveHealthSection`                       | via index.ts -> AppDataForm |
| settings/app-data-form/ArtificialIntelligenceSection.tsx | ~80   | OpenAI API key management and AI settings                        | `ArtificialIntelligenceSection`                   | via index.ts -> AppDataForm |
| settings/app-data-form/DataManagementSection.tsx         | ~100  | Data export and account deletion controls                        | `DataManagementSection`                           | via index.ts -> AppDataForm |
| settings/app-data-form/useAppDataFormController.ts       | ~80   | Controller hook coordinating app data form state and persistence | `useAppDataFormController`                        | via index.ts -> AppDataForm |

---

## src/components/ui/ (30 files, ~1,800 lines)

| File Path               | Lines | Purpose                                                                      | Key Exports                                                                                                           | Imported By                                                                                                              |
| ----------------------- | ----- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| ui/accordion.tsx        | ~80   | Accordion component (Base UI)                                                | `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent`                                                  | 1 (DrPooReport)                                                                                                          |
| ui/badge.tsx            | ~30   | Badge component with variants                                                | `Badge`, `badgeVariants`                                                                                              | Used in patterns                                                                                                         |
| ui/button.tsx           | ~60   | Button component with variants (CVA)                                         | `Button`, `buttonVariants`                                                                                            | ~20+ files                                                                                                               |
| ui/calendar.tsx         | ~100  | Calendar component (react-day-picker wrapper)                                | `Calendar`                                                                                                            | 4 (CycleHormonalSection, SurgerySection, DatePickerButton, Archive, date-picker)                                         |
| ui/card.tsx             | ~50   | Card component with header/content/footer slots                              | `Card`, `CardHeader`, `CardTitle`, `CardContent`, `CardFooter`                                                        | 2 (Settings, AiSuggestionsCard)                                                                                          |
| ui/checkbox.tsx         | ~30   | Checkbox component (Base UI)                                                 | `Checkbox`                                                                                                            | 2 (WaitlistForm, CelebrationsSection)                                                                                    |
| ui/collapsible.tsx      | ~30   | Collapsible component (Base UI)                                              | `Collapsible`, `CollapsibleContent`, `CollapsibleTrigger`                                                             | 6 (PersonalisationForm, AiInsightsBody, DrPooReport, AiSuggestionsCard, TrackingForm, HiddenHabitsSection, DrPooSection) |
| ui/Confetti.tsx         | ~40   | Confetti burst animation component                                           | `ConfettiBurst`                                                                                                       | 1 (Track.tsx)                                                                                                            |
| ui/date-picker.tsx      | ~60   | Date picker combining Calendar + Popover                                     | `DatePicker`                                                                                                          | settings components                                                                                                      |
| ui/drawer.tsx           | ~100  | Drawer component (vaul)                                                      | `Drawer`, `DrawerContent`, `DrawerHeader`, etc.                                                                       | 2 (Settings, responsive-shell)                                                                                           |
| ui/dropdown-menu.tsx    | ~80   | Dropdown menu component (Base UI)                                            | `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuTrigger`                                      | 1 (mode-toggle)                                                                                                          |
| ui/input.tsx            | ~20   | Input component                                                              | `Input`                                                                                                               | ~25+ files                                                                                                               |
| ui/label.tsx            | ~20   | Label component                                                              | `Label`                                                                                                               | ~20+ files                                                                                                               |
| ui/navigation-menu.tsx  | ~80   | Navigation menu component                                                    | `NavigationMenu`, `NavigationMenuList`, `NavigationMenuItem`, `NavigationMenuLink`                                    | 1 (routeTree)                                                                                                            |
| ui/pagination.tsx       | ~60   | Pagination component                                                         | `Pagination`, `PaginationContent`, etc.                                                                               | Used in patterns/database                                                                                                |
| ui/popover.tsx          | ~60   | Popover component (Base UI) with Header/Title/Description sub-components     | `Popover`, `PopoverTrigger`, `PopoverContent`, `PopoverAnchor`, `PopoverHeader`, `PopoverTitle`, `PopoverDescription` | 8+ files                                                                                                                 |
| ui/Reassuring.tsx       | ~40   | Reassuring coaching message component                                        | `ReassuringCoach`                                                                                                     | 1 (DrPooSection)                                                                                                         |
| ui/responsive-shell.tsx | ~100  | Responsive wrapper that renders as Drawer on mobile, Sheet/Dialog on desktop | `ResponsiveShell`, `useResponsiveShellMode`                                                                           | 7 (FoodMatchingModal, RawInputEditModal, AddHabitDrawer, HabitDetailSheet, WeightEntryDrawer, FilterSheet, DrPooSection) |
| ui/scroll-area.tsx      | ~30   | Scroll area component                                                        | `ScrollArea`                                                                                                          | 1 (TodayLog)                                                                                                             |
| ui/SectionHeader.tsx    | ~40   | Reusable section header with icon, title, and color theming                  | `SectionHeader`                                                                                                       | 7 (BowelSection, FluidSection, FoodSection, ObservationWindow, QuickCapture, AiInsightsSection)                          |
| ui/separator.tsx        | ~20   | Separator/divider component                                                  | `Separator`                                                                                                           | 3 (HealthForm, ReproForm, AppDataForm)                                                                                   |
| ui/sheet.tsx            | ~80   | Sheet/slide-out panel component                                              | `Sheet`, `SheetContent`, `SheetHeader`, etc.                                                                          | 1 (responsive-shell)                                                                                                     |
| ui/sonner.tsx           | ~20   | Toast notification wrapper (sonner)                                          | `Toaster`                                                                                                             | 1 (routeTree)                                                                                                            |
| ui/spinner.tsx          | ~15   | Loading spinner component                                                    | `Spinner`                                                                                                             | Various                                                                                                                  |
| ui/switch.tsx           | ~30   | Switch/toggle component                                                      | `Switch`                                                                                                              | 4 (ReproductiveHealthSection, MenopauseSection, PregnancySection, CycleSection, CelebrationsSection)                     |
| ui/tabs.tsx             | ~50   | Tabs component (Base UI)                                                     | `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`                                                                      | 1 (Patterns.tsx)                                                                                                         |
| ui/TimeInput.tsx        | ~120  | Time input with popover picker, icon variant, and accent coloring            | `TimeInput`                                                                                                           | 2 (BowelSection, FoodSection)                                                                                            |
| ui/toggle.tsx           | ~40   | Toggle button with variants (CVA)                                            | `Toggle`, `toggleVariants`                                                                                            | 1 (toggle-group)                                                                                                         |
| ui/toggle-group.tsx     | ~50   | Toggle group component                                                       | `ToggleGroup`, `ToggleGroupItem`                                                                                      | 2 (HabitDetailSheet, UnitsSection)                                                                                       |
| ui/tooltip.tsx          | ~40   | Tooltip component (Base UI)                                                  | `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider`                                                      | ~25+ files (most heavily imported component)                                                                             |

---

## src/components/landing/ (17 files, ~1,200 lines)

| File Path                        | Lines | Purpose                                                    | Key Exports           | Imported By                                                                                                  |
| -------------------------------- | ----- | ---------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------ |
| landing/ApiKeyFooterSection.tsx  | ~40   | Footer section with API key setup CTA                      | `ApiKeyFooterSection` | 1 (LandingPage)                                                                                              |
| landing/BackToTop.tsx            | ~30   | Floating back-to-top button                                | `BackToTop`           | 1 (LandingPage)                                                                                              |
| landing/BetaTestSection.tsx      | ~40   | Beta test signup section with waitlist form                | `BetaTestSection`     | 1 (LandingPage)                                                                                              |
| landing/ChakraBar.tsx            | ~30   | Decorative color gradient bar                              | `ChakraBar`           | 2 (LandingFooter, LegalPageShell)                                                                            |
| landing/FeaturesSection.tsx      | ~80   | Features showcase section with phone frames                | `FeaturesSection`     | 1 (LandingPage)                                                                                              |
| landing/HeroSection.tsx          | ~80   | Hero section with headline and CTA                         | `HeroSection`         | 1 (LandingPage)                                                                                              |
| landing/HowItWorksSection.tsx    | ~60   | Step-by-step how it works section                          | `HowItWorksSection`   | 1 (LandingPage)                                                                                              |
| landing/LandingFooter.tsx        | ~40   | Landing page footer with chakra bar                        | `LandingFooter`       | 1 (ApiKeyFooterSection)                                                                                      |
| landing/LandingNav.tsx           | ~60   | Landing page navigation bar                                | `LandingNav`          | 1 (LandingPage)                                                                                              |
| landing/PhoneFrame.tsx           | ~40   | Phone mockup frame for feature showcases                   | `PhoneFrame`          | 1 (FeaturesSection)                                                                                          |
| landing/PricingCard.tsx          | ~60   | Individual pricing tier card                               | `PricingCard`         | 1 (PricingSection)                                                                                           |
| landing/PricingSection.tsx       | ~80   | Pricing section with tier cards and Stripe checkout action | `PricingSection`      | 1 (LandingPage)                                                                                              |
| landing/ProblemSection.tsx       | ~50   | Problem statement section                                  | `ProblemSection`      | 1 (LandingPage)                                                                                              |
| landing/ScrollArrow.tsx          | ~30   | Animated scroll-down arrow                                 | `ScrollArrow`         | 1 (HeroSection)                                                                                              |
| landing/SectionShell.tsx         | ~30   | Reusable landing page section wrapper                      | `SectionShell`        | 5 (ApiKeyFooterSection, BetaTestSection, FeaturesSection, HowItWorksSection, PricingSection, ProblemSection) |
| landing/WaitlistForm.tsx         | ~80   | Waitlist signup form with Convex mutation                  | `WaitlistForm`        | 1 (BetaTestSection)                                                                                          |
| landing/legal/LegalPageShell.tsx | ~40   | Shell layout for legal pages (privacy, terms)              | `LegalPageShell`      | 2 (PrivacyPage, TermsPage)                                                                                   |

---

## src/components/archive/ (4 files, ~400 lines)

| File Path                                       | Lines | Purpose                                                                                                                       | Key Exports                                                 | Imported By                       |
| ----------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------- |
| archive/DrPooReport.tsx                         | ~300  | Full Dr Poo report renderer with sections for summary, food-specific insights, experiments, meal ideas, and copy-to-clipboard | `DrPooFullReport`, `DrPooReportDetails`, `CopyReportButton` | 2 (Archive page, AiInsightsBody)  |
| archive/ai-insights/index.ts                    | 1     | Barrel export for AI insights components                                                                                      | `AnalysisProgressOverlay`                                   | 1 (AiInsightsSection)             |
| archive/ai-insights/AnalysisProgressOverlay.tsx | ~60   | Progress overlay showing AI analysis status (sending/receiving/done/error) with retry button                                  | `AnalysisProgressOverlay`                                   | via index.ts -> AiInsightsSection |
| archive/ai-insights/MealIdeaCard.tsx            | ~40   | Card displaying an AI-suggested meal idea                                                                                     | `MealIdeaCard`                                              | 1 (DrPooReport)                   |

---

## src/components/ (root) (2 files, ~115 lines)

| File Path          | Lines | Purpose                                                                                           | Key Exports                   | Imported By                                     |
| ------------------ | ----- | ------------------------------------------------------------------------------------------------- | ----------------------------- | ----------------------------------------------- |
| theme-provider.tsx | 85    | Theme context provider (dark/light/system) with localStorage persistence and media query listener | `ThemeProvider`, `useTheme`   | 2 (routeTree via app root, mode-toggle, sonner) |
| mode-toggle.tsx    | 32    | Dark/light/system theme toggle dropdown                                                           | `ModeToggle` (default export) | 1 (routeTree)                                   |

---

## Dead Exports

| File                                 | Export Name                 | Type       | Assessment                                                                                                                      |
| ------------------------------------ | --------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------- |
| patterns/database/foodSafetyUtils.ts | `FILTER_OPTIONS`            | Constant   | Exported via barrel but only used within database feature -- not dead, used by FilterSheet                                      |
| patterns/hero/Sparkline.tsx          | `SparklineDataPoint`        | Type       | Exported via barrel -- used by hero tiles, not dead                                                                             |
| track/today-log/helpers.ts           | `getActivityLabel`          | Function   | Not re-exported from today-log/index.ts, only used internally by ActivitySubRow -- correctly scoped                             |
| track/panels/BristolScale.tsx        | `BristolScalePicker`        | Component  | Exported but not imported anywhere in the codebase -- **potentially dead** (may have been used in an older BowelSection design) |
| ui/date-picker.tsx                   | `DatePicker`                | Component  | Needs verification -- settings repro files use DatePickerButton instead                                                         |
| ui/pagination.tsx                    | Multiple pagination exports | Components | Used within patterns/database but worth confirming actual usage                                                                 |

---

## Files Over 300 Lines

| File                                           | Lines | Functions/Components                                                                            | Decomposition Suggestion                                                                                                                                                                                                          |
| ---------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| track/quick-capture/WeightEntryDrawer.tsx      | 907   | `WeightEntryDrawer`, `WeightTrendChart`, `renderUnitAwareInput`, `computeChartData`, 5+ helpers | **HIGH PRIORITY.** Extract `WeightTrendChart` (200 lines) into its own file, extract `computeChartData` and chart constants into a `weightChartUtils.ts`, extract `renderUnitAwareInput` into a shared `UnitAwareInput` component |
| track/today-log/rows/LogEntry.tsx              | 833   | `LogEntry` handling all 7+ log types in one component                                           | **HIGH PRIORITY.** Already partly decomposed via group rows + sub-row editors, but the digestion inline editor (~250 lines) and reproductive editor (~60 lines) inside LogEntry should be extracted into dedicated components     |
| track/quick-capture/HabitDetailSheet.tsx       | 670   | `HabitDetailSheet`, `HabitDetailSheetInner`, day-status helpers                                 | Extract `HabitMicroGraph` (7-day visualization, ~70 lines), extract `HabitSettingsForm` (~180 lines), extract `makeNumberSaveHandler` into a utility                                                                              |
| track/FoodMatchingModal.tsx                    | 653   | `FoodMatchingModal`, `TicketForm`                                                               | Extract `TicketForm` (~80 lines) into its own file, extract search/filter section into `FoodSearchList`                                                                                                                           |
| track/quick-capture/AddHabitDrawer.tsx         | 637   | `AddHabitDrawer`, `AddHabitDrawerContent`, type/template/custom steps                           | Extract each step into its own component: `HabitTypeSelector`, `HabitTemplateList`, `CustomHabitForm`                                                                                                                             |
| track/today-log/editors/FoodSubRow.tsx         | 521   | `FoodSubRow`, `ResolutionDot`, `FoodItemLine`                                                   | Moderately decomposed. `ResolutionDot` and `FoodItemLine` could live in their own file as shared food display primitives                                                                                                          |
| track/panels/BowelSection.tsx                  | 499   | `BowelSection`, `SeverityScale`, `VolumeScale`, `TripStepper`                                   | Extract `SeverityScale`, `VolumeScale`, `TripStepper` into `bowelFormControls.tsx` (~130 lines)                                                                                                                                   |
| track/today-log/helpers.ts                     | 404   | ~25 utility functions                                                                           | Split into `foodItemHelpers.ts` (resolution, display), `logDisplayHelpers.ts` (icon, color, title, detail), `dateTimeHelpers.ts`, `reproductiveHelpers.ts`                                                                        |
| track/today-log/editors/ReproductiveSubRow.tsx | 359   | `ReproductiveSubRow`                                                                            | Acceptable size for a complex editor, but the editing form (~120 lines) could be extracted                                                                                                                                        |
| track/panels/CycleHormonalSection.tsx          | 311   | `CycleHormonalSection`, `BleedingGlyph`                                                         | Extract `BleedingGlyph` into a shared component, extract bleeding status button row                                                                                                                                               |
| track/today-log/TodayLog.tsx                   | 298   | `TodayLog`, `findGroupKeyForLogId`                                                              | Borderline. Could extract the header/date-navigation into `TodayLogHeader`                                                                                                                                                        |
| track/quick-capture/DurationEntryPopover.tsx   | 295   | `DurationEntryPopover`                                                                          | The tile rendering duplicates QuickCaptureTile layout (~80 lines of shared tint/badge code). Extract shared tile chrome                                                                                                           |
| track/panels/bristolScaleData.ts               | 272   | Pure data (SVG shapes)                                                                          | Data file; no decomposition needed                                                                                                                                                                                                |
| settings/TrackingForm.tsx                      | ~300  | `TrackingForm` with habit reorder                                                               | Could extract habit reorder DnD into `HabitReorderList`                                                                                                                                                                           |

---

## Import Sources

src/components/ imports from:

- **src/hooks/** -- `useProfile` (useUnitSystem, useHealthProfile, useHabits, useFluidPresets, useSleepGoal, useTransitCalibration), `useTimePicker`, `useLongPress`, `usePendingReplies`, `useWeeklySummaryAutoTrigger`, `useUnresolvedFoodQueue`
- **src/contexts/** -- `ApiKeyContext` (useApiKeyContext), `SyncedLogsContext` (useSyncedLogsContext)
- **src/lib/** -- `sync` (SyncedLog, useUpdateSyncedLog, useConversationsByDateRange, useLatestWeeklySummary, useLatestSuccessfulAiAnalysis, asConvexId), `habitTemplates`, `habitIcons`, `habitProgress`, `habitAggregates`, `reproductiveHealth`, `units`, `dateUtils`, `errors`, `utils` (cn), `aiAnalysis`, `customFoodPresets`, `formatWeight`, `normalizeFluidName`, `timeConstants`
- **src/store/** -- Zustand store (useStore, isFoodLog, DEFAULT_FLUID_PRESETS)
- **src/types/domain** -- Domain type imports (FoodItem, FoodLog, SyncedLog, etc.)
- **src/data/** -- `transitData` (Station, Zone, Track, SubLine, MainCategory, FoodStatus)
- **shared/** -- `foodProjection` (BRAT_FOOD_KEYS), `foodRegistry` (FoodGroup, getGroupDisplayName) -- via relative path `../../../shared/`
- **convex/\_generated/** -- `api` -- via relative path `../../../convex/_generated/api`
- **npm:** react, react-dom, date-fns, lucide-react, sonner, motion/react (framer-motion), react-markdown, @tanstack/react-router, @tanstack/react-table (via patterns/database), react-day-picker (via calendar), @base-ui/react, vaul (via drawer), convex/react

---

## Surprising Findings

1. **Components importing directly from `convex/` source and `shared/` via relative paths:**
   - `src/components/track/FoodMatchingModal.tsx` imports `api` from `../../../convex/_generated/api` **and** `FoodGroup, getGroupDisplayName` from `../../../shared/foodRegistry` -- this component calls Convex mutations directly (`resolveItem`, `submitFoodRequest`, `searchFoods`) rather than going through a hook layer. This is the only non-landing component that does this.
   - `src/components/settings/AiSuggestionsCard.tsx` imports `api` from `../../../convex/_generated/api` and calls `useAction` directly.
   - `src/components/landing/WaitlistForm.tsx` and `src/components/landing/PricingSection.tsx` also import from `convex/` directly -- acceptable for landing page forms but inconsistent with the rest of the app.

2. **Hook importing from components (inverted dependency):**
   - `src/hooks/useUnresolvedFoodQueue.ts` imports `getFoodItemResolutionStatus` from `@/components/track/today-log/helpers` -- this function is a pure utility and should live in `src/lib/` or `src/types/` instead of a component helpers file.
   - `src/hooks/useFoodParsing.ts` imports `ParsedItem` type from `@/components/track/panels` -- same issue; the type should be in `src/types/domain`.

3. **Massive single-file components:** `WeightEntryDrawer.tsx` (907 lines) is the largest component file and contains an entire SVG charting subsystem, three separate UI modes (tile, popover, settings drawer), and complex state management. This should be the top decomposition priority.

4. **Duplicated tile chrome:** `QuickCaptureTile.tsx` and `DurationEntryPopover.tsx` both define identical `TINT_BY_PROGRESS_COLOR` and `TINT_CLASSES` mappings (~35 lines each). These should be extracted into a shared `tileStyles.ts`.

5. **`BristolScalePicker` appears to be dead code:** Exported from `BristolScale.tsx` but not imported anywhere. The `BowelSection` uses `BRISTOL_SCALE` data and `BristolIllustration` directly with its own custom picker UI.

6. **Lazy import pattern for code splitting:** `FoodSubRow.tsx` lazy-loads `FoodMatchingModal` to avoid bundling the food registry data in the initial payload -- good practice, well-documented with a comment.

7. **Cross-subdirectory component imports within components/ are well-structured:** archive -> ui, track -> ui, track/dr-poo -> archive (for DrPooReport), patterns/database -> ui. The dependency direction is clean: feature components -> ui primitives.
