# PDH — Work Queue

> **Single source of truth** for all remediation, bugs, and tech debt.
>
> **Created:** 2026-03-17
> **Last updated:** 2026-04-04

---

## How to use this file

- Each item has a unique ID (WQ-###)
- Severity: **Crit** = security/data loss/patient safety, **High** = bugs/type safety/correctness, **Med** = maintainability/UX, **Low** = polish/cleanup
- Status: `open`, `in-progress`, `blocked`, `deferred`
- Items within each section are ordered by priority (do top items first)

---

## Priority: Food Registry & Filter Overhaul

> New data model + multi-dimensional filter system. Design spec: `docs/design/filter-prompt.md`

| ID     | Title                                           | Sev  | Description                                                                                                                                                                                                   | Status |
| ------ | ----------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| WQ-400 | Registry data model migration                   | Crit | Migrate `shared/foodRegistryData.ts` to new entry shape: composite key (canonical + mechanicalForm + cookingMethod + skin), new enums, tags, fodmapLevel, type field. Update Convex schema + validators.      | open   |
| WQ-401 | Food status model rethink                       | Crit | Replace current status system with: none (untested) / building / like / dislike / watch / avoid. Add baseline flag for control foods. Update all consumers (database table, filters, today-log, AI analysis). | open   |
| WQ-402 | Multi-filter component                          | High | Build composable chip-based filter bar per `docs/design/filter-prompt.md`. Replace existing `FilterSheet.tsx`. 18 filter types across 5 groups. Integrate with TanStack React Table.                          | open   |
| WQ-403 | Nutrition columns (structure only)              | Med  | Add kcal, proteinG, fatG, saturatedFatG, carbsG, sugarsG, fiberG, saltG to registry entry type. Leave unpopulated until external DB integration.                                                              | open   |
| WQ-404 | External nutrition DB integration               | Med  | Pull nutrition data from McCance & Widdowson / USDA FoodData Central / Open Food Facts. Populate registry nutrition columns. Script to backfill.                                                              | open   |
| WQ-405 | Remove `group`/`line`/`lineOrder` from registry | Med  | Transit map groupings are dead. Remove these fields from registry entries, types, and all consumers.                                                                                                          | open   |

---

## Priority: Logging UX Redesign

> PRD: `docs/design/meal-logging.md` (merged). All 22 decisions locked (2026-04-03). Implementation plan: `docs/plans/nutrition-card-implementation-plan.json` (26 tasks, 6 waves). Waves 1-2 complete. Wave 3 mostly complete. Waves 4-5 in progress (2026-04-04).

| ID     | Title                             | Sev  | Description                                                                                                                            | Status |
| ------ | --------------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| WQ-410 | Voice/conversational food logging | Crit | Natural language input ("I ate toast with butter and beans") parsed by AI into structured log entries. Minimal friction.               | open   |
| WQ-411 | Portion size tracking             | High | +/- portion controls per food row in staging area. UI built in LogFoodModal (W2-03). handleLogFood wired to useAddSyncedLog (649aade). | done   |
| WQ-412 | Logging gap detection & nudges    | Med  | AI detects missing logs and prompts gently. Especially important on bad days when user avoids logging.                                 | open   |
| WQ-413 | Liquids consolidation             | Med  | Water stays in fluids (separate modal with cyan accent #42BCB8). WaterModal wired to useAddSyncedLog (649aade).                        | done   |
| WQ-414 | Wire NutritionCard handler stubs  | High | All 3 handlers wired: handleLogWater, handleLogFood (649aade), handleDeleteLog. Toast feedback on success/error.                       | done   |
| WQ-415 | NutritionCard E2E tests           | Med  | 4 Playwright E2E spec files added: WaterModal (14 tests), LogFoodModal, CalorieDetailView (10 tests), FavouritesView+FoodFilterView.   | done   |
| WQ-416 | Extract duplicate nutrition utils | Low  | titleCase, formatPortion, getDefaultCalories extracted to nutritionUtils.ts. Both files updated (e385d9c).                             | done   |
| WQ-417 | Meal-slot-scoped recent foods     | Med  | getCurrentMealSlot() added to nutritionUtils. recentFoods scoped with global fallback. 16 tests (d9c3837).                             | done   |
| WQ-418 | Clean dead water store state      | Low  | waterAmount/SET_WATER_AMOUNT removed from store. WaterModal simplified (d0aa31a).                                                      | done   |

---

## Open: Security & Type Safety

| ID  | Title | Sev | File(s) | Description | Status |
| --- | ----- | --- | ------- | ----------- | ------ |

| WQ-034 | `dateStr.split("-")` no NaN check | High | `src/lib/digestiveCorrelations.ts` | Part of broader app-wide date/time consolidation effort. | deferred |

---

## Open: Performance & Architecture

| ID     | Title                                   | Sev  | File(s)                              | Description                                                       | Status  |
| ------ | --------------------------------------- | ---- | ------------------------------------ | ----------------------------------------------------------------- | ------- |
| WQ-087 | Unbounded `listAll` query               | High | `src/contexts/SyncedLogsContext.tsx` | Still bare `.collect()` with no date window or hard limit.        | open    |
| WQ-090 | `TrackPage` eagerly imported            | High | `src/routeTree.tsx`                  | Only page not using `lazy()`.                                     | open    |
| WQ-094 | `analyzeLogs` called twice              | High | `Patterns.tsx`, `Menu.tsx`           | Both call independently. Lift to shared context or memoized hook. | open    |
| WQ-098 | `buildFoodEvidenceResult` client+server | High | `shared/foodEvidence.ts`             | Client needs trial-level detail not in schema.                    | blocked |
| WQ-107 | Split `LogEntry.tsx` (832 LOC)          | High | `today-log/rows/LogEntry.tsx`        | Delegate log-type editing to existing SubRow components.          | open    |
| WQ-108 | Split `aiAnalysis.ts` (1953 LOC)        | Med  | `src/lib/aiAnalysis.ts`              | Split into `aiPrompts.ts`, `aiParsing.ts`, `aiFetchInsights.ts`.  | open    |
| WQ-318 | Move context compiler server-side       | High | `convex/buildLlmContext.ts`          | Move compiler to server. New generateDrPooReport action.          | blocked |

---

## Open: Error Handling & Accessibility

| ID     | Title                                             | Sev  | File(s)              | Description                                                                            | Status |
| ------ | ------------------------------------------------- | ---- | -------------------- | -------------------------------------------------------------------------------------- | ------ |
| WQ-320 | Delete handlers in SubRows have no error handling | High | All 5 SubRow editors | Inline `onDelete` calls have no try/catch. Add `toast.error(getErrorMessage(...))`.    | open   |
| WQ-321 | Sparkline gradient ID breaks with CSS variables   | High | `hero/Sparkline.tsx` | `color.replace("#", "")` invalid when callers pass `var(--section-summary)`. Sanitize. | open   |

---

## Open: UX Bugs & Polish

| ID     | Title                           | Sev | File(s)                       | Description                                                  | Status |
| ------ | ------------------------------- | --- | ----------------------------- | ------------------------------------------------------------ | ------ |
| WQ-111 | BM time label position          | Med | Track/BM section              | Time needs to move before notes.                             | open   |
| WQ-112 | Fluid section design            | Med | Track/Fluid section           | User wants old design back (ml + drink + add).               | open   |
| WQ-113 | BM count data wrong             | Med | Track/Hero                    | Needs runtime verification.                                  | open   |
| WQ-114 | Next food logic                 | Med | Food pipeline                 | Depends on food safety grid pipeline.                        | open   |
| WQ-115 | Toast notifications weak        | Med | Toast system                  | No coloured backgrounds, stacking, or prominent undo.        | open   |
| WQ-116 | Units not applied to fluids     | Med | FluidSection + other surfaces | Some surfaces may hardcode ml.                               | open   |
| WQ-117 | Food section redesign           | Med | Track/Food section            | Remove "Food Badges" title, simplify layout.                 | open   |
| WQ-118 | Weight target save bug          | Med | Weight section                | Typing "180" doesn't save — needs "180.0" or Enter/Tab.      | open   |
| WQ-120 | Insights bar removal            | Med | Track page                    | Remove heuristics insight below quick capture.               | open   |
| WQ-121 | Desktop long-press menu         | Med | Today log                     | Add 3-dot menu for desktop discoverability.                  | open   |
| WQ-122 | BM layout rework                | Med | Track/BM section              | Time before notes, 8-col grid.                               | open   |
| WQ-123 | Conversation markdown hierarchy | Med | ConversationPanel             | All text bold/large — no visual hierarchy.                   | open   |
| WQ-124 | Conversation card redesign      | Med | ConversationPanel             | Single chat-window with separate summary/suggestions/meals.  | open   |
| WQ-125 | Meal card blog-style            | Med | Meal cards                    | Time/slot where image would be, menu where snippet would be. | open   |
| WQ-126 | Next Food to Try + zones        | Med | Dr Poo / Patterns             | Show Dr. Poo suggestions AND zone-1 options.                 | open   |
| WQ-128 | Date header duplication         | Med | Patterns page                 | Repeats date in page + global header.                        | open   |
| WQ-129 | Safe foods confidence labels    | Med | Food evidence UI              | "moderate"/"strong"/"weak" labels undefined.                 | open   |
| WQ-130 | Amber dot not intuitive         | Med | FoodMatchingModal trigger     | Unresolved food amber dot needs better affordance.           | open   |
| WQ-131 | Drawer overlay click-through    | Med | Drawer system                 | Clicking outside drawer triggers underlying cards.           | open   |
| WQ-132 | Filter toggle system color      | Med | Database filters              | Starred filter uses browser orange instead of app theme.     | open   |
| WQ-133 | Food DB filter clearing         | Med | Database filters              | Requires Clear All + Apply; should be instant.               | open   |
| WQ-134 | Filter sheet double-open        | Med | Database filters              | Sheet pops open, closes, opens again.                        | open   |
| WQ-135 | Trial history not wired         | Med | Database row detail           | Row detail says "no trial history" but table shows counts.   | open   |

---

## Open: Hardcoded Personalization

| ID     | Title                                    | Sev | File(s)                                      | Description                       | Status |
| ------ | ---------------------------------------- | --- | -------------------------------------------- | --------------------------------- | ------ |
| WQ-136 | "post-surgery anastomosis" hardcoded 3x  | Med | `src/lib/habitCoaching.ts:63-74,258-262,541` | Parameterize from health profile. | open   |
| WQ-138 | Hardcoded "tina" and "rec drug" keywords | Med | `shared/foodEvidence.ts:283-354`             | Move to configurable list.        | open   |

---

## Open: Dead Code & Polish

| ID     | Title                                               | Sev | File(s)                                              | Description                                                      | Status |
| ------ | --------------------------------------------------- | --- | ---------------------------------------------------- | ---------------------------------------------------------------- | ------ |
| WQ-148 | `streaks.ts` misleadingly named                     | Low | `src/lib/streaks.ts`                                 | No streak logic. Rename to `gamificationDefaults.ts`.            | open   |
| WQ-150 | `toLegacyFoodStatus` potentially dead               | Low | `shared/foodEvidence.ts`                             | Exported but not tested. Verify consumers.                       | open   |
| WQ-151 | `columns` stale export                              | Low | `patterns/database/columns.tsx`                      | Static snapshot at module load.                                  | open   |
| WQ-152 | `key?: string` in all SubRow props                  | Low | All 5 SubRow editors                                 | React never passes `key` as a prop. Remove from interfaces.      | open   |
| WQ-153 | `FILTER_OPTIONS`, `SortKey`, `SortDir` likely dead  | Low | `patterns/database/foodSafetyUtils.ts`               | TanStack Table uses its own types. Verify and remove.            | open   |
| WQ-154 | 91 dead exports (A3 orphan scan)                    | Low | Multiple files                                       | Remove after verification.                                       | open   |
| WQ-155 | Work-ticket marker comments                         | Low | Various                                              | Remove `// F001:`, `// SET-F003:`, `// Bug #46`, etc.            | open   |
| WQ-159 | `"use client"` directives (Next.js artifact)        | Low | `ui/date-picker.tsx`, `ui/tabs.tsx`, `ui/toggle.tsx` | Does nothing in Vite. Remove.                                    | open   |
| WQ-161 | Registry "New entry." placeholder notes             | Low | `shared/foodRegistryData.ts`                         | Replace with clinical rationale or remove.                       | open   |
| WQ-162 | Zone-change notes lack clinical rationale           | Low | `shared/foodRegistryData.ts`                         | Notes explain what changed, not why.                             | open   |
| WQ-163 | Stale comment: wrong import path                    | Low | `shared/foodEvidence.ts:180`                         | References wrong path. Fix or remove.                            | open   |
| WQ-191 | Locale-dependent `formatTime`                       | Med | `src/lib/aiAnalysis.ts`                              | `toLocaleString` non-deterministic. Use deterministic formatter. | open   |
| WQ-192 | `getDaysPostOp` uses `new Date()`                   | Med | `src/lib/aiAnalysis.ts`                              | Drift across renders.                                            | open   |
| WQ-193 | `buildUserMessage` has 15 parameters                | Low | `src/lib/aiAnalysis.ts`                              | Use options object. (Do during WQ-108 split)                     | open   |
| WQ-194 | `WeeklyContext`/`WeeklyDigestInput` duplicate types | Low | `src/lib/aiAnalysis.ts`                              | Structurally identical. Merge.                                   | open   |
| WQ-196 | `fetchWeeklySummary` doesn't validate model         | Low | `src/lib/aiAnalysis.ts`                              | Should call `getValidInsightModel(model)`.                       | open   |

---

## Open: Infrastructure

| ID     | Title                                | Sev | File(s)          | Description                                               | Status |
| ------ | ------------------------------------ | --- | ---------------- | --------------------------------------------------------- | ------ |
| WQ-197 | 4 orphan game layer tables in Convex | Low | Convex dashboard | Manual deletion required via web dashboard.               | open   |
| WQ-198 | Legacy activity sleep readers        | Low | Various          | Some code paths may still read sleep from legacy records. | open   |

---

## Open: Low-Priority UX Bugs

| ID     | Title                                    | Sev | Description                                | Status |
| ------ | ---------------------------------------- | --- | ------------------------------------------ | ------ |
| WQ-174 | Destructive alert icon size              | Low | h-6 w-6 → h-5 w-5 (partial).               | open   |
| WQ-175 | BM pill text alignment                   | Low | Left-aligned in some pills.                | open   |
| WQ-176 | Quick capture medium viewport            | Low | 3-col breaks at medium viewport.           | open   |
| WQ-177 | Activity detail orange                   | Low | System default orange highlight.           | open   |
| WQ-178 | Celebration too weak                     | Low | Sound too short, confetti too minimal.     | open   |
| WQ-179 | Boolean habit duplicate name             | Low | "Brush Teeth / Brush Teeth".               | open   |
| WQ-180 | Alert badge position                     | Low | Should be top-right with hover X.          | open   |
| WQ-181 | Fluid habit auto-styling                 | Low | Auto-set blue glass icon for fluid habits. | open   |
| WQ-182 | Hero label overlap                       | Low | Side labels overlap numbers.               | open   |
| WQ-183 | Habit-digestion correlation inconclusive | Low | Most results are inconclusive.             | open   |
| WQ-184 | Dr Poo archive link dup                  | Low | Duplicate link.                            | open   |
| WQ-185 | "Last tested" ambiguity                  | Low | Last eaten or last transit? Clarify.       | open   |
| WQ-186 | Duplicate timestamp on expand            | Low | Timestamp shown twice.                     | open   |
| WQ-187 | Cigarettes duplicate subrows             | Low | Duplicate entries.                         | open   |
| WQ-188 | Sleep expand repeats label               | Low | Label shown twice.                         | open   |
| WQ-189 | Activity rows split label/time           | Low | Label and time separated.                  | open   |
| WQ-190 | Tea quick capture missing unit           | Low | No unit shown.                             | open   |

---

## Removed (Total Eclipse — 2026-03-31)

The following sections were fully removed from the codebase and work queue:

- **Transit Map** (Sprint 2.6, Sprint 2.7, WQ-039/040/207-214/320-329) — feature deleted
- **Reproductive Health** (WQ-007/009/041/061/069/084/173) — feature deleted
- **Landing/Marketing Pages** — feature deleted
- **Observation Window** — feature deleted
- All `done`/`descoped` items cleared from queue
