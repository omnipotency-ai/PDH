> **Ref:** `docs/ROADMAP.md`
> **Updated:** 2026-04-05
> **Version:** 2.0
> **History:**
>
> - v2.0 (2026-04-05) — append-only discipline, status column on initiatives
> - v1.0 (2026-04-05) — created from WORK-QUEUE.md and VISION.md

# PDH — Roadmap

> Master list of everything. Initiatives and standalone items.
> **Append-only.** Never delete rows. Update status in-place. If scope changes, add a new version row.
> Managed by the `project-ops` skill.

---

## How this file works

- **Initiatives** are named bodies of work. Each has a status: Not planned | Planned | In Work Queue | Done | Partial.
- **Standalone items** are bugs, debt, and polish not yet assigned to an initiative.
- When an initiative gets a plan: sweep standalone items that fit, fold them into the plan, remove from standalone section (note in WQ which items were folded).
- When work completes: update initiative status to "Done" or "Partial — remaining items returned". Never delete the row.

---

## Initiatives

### Nutrition Card (Meal Logging Redesign)

> **Status:** In Work Queue — plan active
> **Plan:** `docs/plans/nutrition-card-implementation-plan.json`
> **PRD (archived):** `docs/plans/archive/meal-logging-prd.md`
> **Parent plan:** `docs/plans/data-integration-plan.md` (Wave 1)

Chip-based, slot-aware meal builder replacing the old single text field. NutritionCard with search, staging, portions, 5-macro tracking, water modal, meal slot auto-detection. Waves 0-3 + spec fix complete. W4-01, W4-03, W5 remaining.

---

### Food Registry & Filter Overhaul

> **Status:** Planned
> **Plan:** `docs/plans/data-integration-plan.md` (Waves 2-4)
> **Filter bar plan:** `docs/plans/filter-prompt.md` (Wave 2 detail)

Rebuild the food registry data model (composite keys, new enums, zones, FODMAP, nutrition columns) and the multi-filter system on Patterns page. Includes external nutrition DB integration (McCance & Widdowson / USDA / Open Food Facts).

**Scope includes:**

- Registry data model migration (composite key, new enums, tags, fodmapLevel, type field)
- Food status model rethink (none/building/like/dislike/watch/avoid + baseline flag)
- Multi-filter chip-based component (18 filter types, 5 groups)
- Nutrition columns on registry entries (kcal, protein, fat, saturatedFat, carbs, sugars, fiber, salt)
- External nutrition DB integration + backfill script
- Remove dead `group`/`line`/`lineOrder` fields from registry
- Recipe system (structuredIngredients, slotDefaults, slot-aware portions, "Save as recipe" flow)

---

### Voice / Conversational Food Logging

> **Status:** Not planned

Natural language input ("I ate toast with butter and beans") parsed by AI into structured log entries. Minimal friction. Depends on stable food pipeline from Nutrition Card work.

---

### Dr. Poo Reimagining

> **Status:** Not planned
> **Related:** `docs/dr-poo-prompts/`

Restructure the AI coaching system. Health profile data feeds into a redesigned prompt. Move context compiler server-side. Daily coaching pipeline, prompt engineering for transit correlation insights.

**Scope includes:**

- Move context compiler server-side (new `generateDrPooReport` action)
- Structured health profile data in prompt
- Split `aiAnalysis.ts` (2225 LOC) into focused modules
- Parameterise hardcoded medical context from health profile

---

### Patterns Page Rework

> **Status:** Not planned

Richer visualisation of food-outcome correlations. Food safety database improvements. Confidence labels. Next food to try logic.

---

### Logging Gap Detection & Nudges

> **Status:** Not planned

AI detects missing logs and prompts gently. Especially important on bad days when user avoids logging. Depends on Dr. Poo reimagining.

---

### Gamification Expansion

> **Status:** Not planned

Broader system beyond basic streaks/confetti: badges, challenges, miniChallenge engine. Currently partially in codebase, needs stabilisation.

---

### Photo Food Parsing & Nutrition Label Capture

> **Status:** Parking lot

Camera-based meal logging via vision AI models. Also includes nutrition label photo capture: scan packaging → AI extracts per-100g nutrition data → populates ingredientProfiles. Label capture is a one-time setup activity per product, not daily logging.

---

### Barcode Scanning

> **Status:** Parking lot

Product barcode scan to look up or create foods in the registry. Separate from photo-based nutrition label capture (which uses vision AI). Barcode lookup via OpenFoodFacts or similar API.

---

### Navigation Restructure (Home / Track / Food / Insights)

> **Status:** Not planned

Replace current 3-tab nav (Track / Patterns / Settings) with 4-tab layout: Home, Track, Food, Insights. The meal-logging PRD originally placed NutritionCard on a standalone `/food` route. Currently lives on Track page. This restructure is a prerequisite for the full PRD vision.

---

### Meal Plan Table

> **Status:** Parking lot

Structured meal planning based on safe food data.

---

## Standalone Items

> Bugs, debt, and polish not yet assigned to an initiative plan.
> When creating a plan for any initiative above, sweep this list for items that can be folded in.

### Track Page

| ID     | Title                          | Sev  | Description                                                                   |
| ------ | ------------------------------ | ---- | ----------------------------------------------------------------------------- |
| WQ-090 | TrackPage eagerly imported     | High | Only page not using `lazy()` in routeTree.tsx. Conscious choice or oversight. |
| WQ-107 | Split LogEntry.tsx (741 LOC)   | High | Delegate log-type editing to existing SubRow components.                      |
| WQ-111 | BM time label position         | Med  | Time needs to move before notes.                                              |
| WQ-113 | BM count data wrong            | Med  | Needs runtime verification in hero.                                           |
| WQ-118 | Weight target save bug         | Med  | Typing "180" doesn't save — needs "180.0" or Enter/Tab.                       |
| WQ-121 | Desktop long-press menu        | Med  | Add 3-dot menu for desktop discoverability.                                   |
| WQ-122 | BM layout rework               | Med  | Time before notes, 8-col grid.                                                |
| WQ-186 | Duplicate timestamp on expand  | Low  | Timestamp shown twice in today log.                                           |
| WQ-187 | Cigarettes duplicate subrows   | Low  | Duplicate entries.                                                            |
| WQ-188 | Sleep expand repeats label     | Low  | Label shown twice.                                                            |
| WQ-189 | Activity rows split label/time | Low  | Label and time separated.                                                     |

### Patterns Page

| ID     | Title                        | Sev | Description                                                |
| ------ | ---------------------------- | --- | ---------------------------------------------------------- |
| WQ-114 | Next food logic              | Med | Depends on food safety grid pipeline.                      |
| WQ-128 | Date header duplication      | Med | Repeats date in page + global header.                      |
| WQ-129 | Safe foods confidence labels | Med | "moderate"/"strong"/"weak" labels undefined.               |
| WQ-130 | Amber dot not intuitive      | Med | Unresolved food amber dot needs better affordance.         |
| WQ-135 | Trial history not wired      | Med | Row detail says "no trial history" but table shows counts. |

### Database Filters

| ID     | Title                      | Sev | Description                                              |
| ------ | -------------------------- | --- | -------------------------------------------------------- |
| WQ-132 | Filter toggle system color | Med | Starred filter uses browser orange instead of app theme. |
| WQ-133 | Food DB filter clearing    | Med | Requires Clear All + Apply; should be instant.           |
| WQ-134 | Filter sheet double-open   | Med | Sheet pops open, closes, opens again.                    |

### AI & Dr. Poo

| ID     | Title                                           | Sev | Description                                                    |
| ------ | ----------------------------------------------- | --- | -------------------------------------------------------------- |
| WQ-108 | Split aiAnalysis.ts (2225 LOC)                  | Med | Split into aiPrompts.ts, aiParsing.ts, aiFetchInsights.ts.     |
| WQ-136 | "post-surgery anastomosis" hardcoded 3x         | Med | In habitCoaching.ts. Parameterize from health profile.         |
| WQ-191 | Locale-dependent formatTime                     | Med | toLocaleString non-deterministic. Use deterministic formatter. |
| WQ-192 | getDaysPostOp uses new Date()                   | Med | Drift across renders.                                          |
| WQ-193 | buildUserMessage has 15 parameters              | Low | Use options object. (Do during WQ-108 split)                   |
| WQ-194 | WeeklyContext/WeeklyDigestInput duplicate types | Low | Structurally identical. Merge.                                 |
| WQ-196 | fetchWeeklySummary doesn't validate model       | Low | Should call getValidInsightModel(model).                       |

### Conversation Panel

| ID     | Title                           | Sev | Description                                                 |
| ------ | ------------------------------- | --- | ----------------------------------------------------------- |
| WQ-123 | Conversation markdown hierarchy | Med | All text bold/large — no visual hierarchy.                  |
| WQ-124 | Conversation card redesign      | Med | Single chat-window with separate summary/suggestions/meals. |

### UI Components & System

| ID     | Title                        | Sev  | Description                                               |
| ------ | ---------------------------- | ---- | --------------------------------------------------------- |
| WQ-115 | Toast notifications weak     | Med  | No coloured backgrounds, stacking, or prominent undo.     |
| WQ-131 | Drawer overlay click-through | Med  | Clicking outside drawer triggers underlying cards.        |
| WQ-320 | SubRow delete error handling | High | Inline onDelete calls have no try/catch. Add toast.error. |

### Dead Code & Cleanup

| ID     | Title                                      | Sev | Description                                                          |
| ------ | ------------------------------------------ | --- | -------------------------------------------------------------------- |
| WQ-148 | streaks.ts misleadingly named              | Low | No streak logic. Rename to gamificationDefaults.ts.                  |
| WQ-150 | toLegacyFoodStatus potentially dead        | Low | Used in analysis.ts but may be removable.                            |
| WQ-151 | columns stale export                       | Low | Static snapshot at module load in patterns/database.                 |
| WQ-153 | FILTER_OPTIONS/SortKey/SortDir likely dead | Low | TanStack Table uses its own types. Verify and remove.                |
| WQ-155 | Work-ticket marker comments                | Low | Remove // F001:, // SET-F003:, // Bug #46, etc.                      |
| WQ-159 | "use client" directives                    | Low | Next.js artifact in date-picker, tabs, toggle. Does nothing in Vite. |
| WQ-161 | Registry "New entry." placeholder notes    | Low | Replace with clinical rationale or remove.                           |
| WQ-162 | Zone-change notes lack clinical rationale  | Low | Notes explain what changed, not why.                                 |
| WQ-163 | Stale comment: wrong import path           | Low | In foodEvidence.ts:180. Fix or remove.                               |
| WQ-198 | Legacy activity sleep readers              | Low | Some code paths may still read sleep from legacy records.            |

### Low-Priority UX Bugs

| ID     | Title                                    | Sev | Description                                |
| ------ | ---------------------------------------- | --- | ------------------------------------------ |
| WQ-174 | Destructive alert icon size              | Low | h-6 w-6 should be h-5 w-5.                 |
| WQ-175 | BM pill text alignment                   | Low | Left-aligned in some pills.                |
| WQ-176 | Quick capture medium viewport            | Low | 3-col breaks at medium viewport.           |
| WQ-177 | Activity detail orange                   | Low | System default orange highlight.           |
| WQ-178 | Celebration too weak                     | Low | Sound too short, confetti too minimal.     |
| WQ-179 | Boolean habit duplicate name             | Low | "Brush Teeth / Brush Teeth".               |
| WQ-180 | Alert badge position                     | Low | Should be top-right with hover X.          |
| WQ-181 | Fluid habit auto-styling                 | Low | Auto-set blue glass icon for fluid habits. |
| WQ-182 | Hero label overlap                       | Low | Side labels overlap numbers.               |
| WQ-183 | Habit-digestion correlation inconclusive | Low | Most results are inconclusive.             |
| WQ-184 | Dr Poo archive link dup                  | Low | Duplicate link.                            |
| WQ-185 | "Last tested" ambiguity                  | Low | Last eaten or last transit? Clarify.       |
| WQ-190 | Tea quick capture missing unit           | Low | No unit shown.                             |

---

## Removed

Items verified as no longer valid (files deleted, code changed, or superseded):

| ID     | Title                                 | Reason removed                                                 |
| ------ | ------------------------------------- | -------------------------------------------------------------- |
| WQ-034 | dateStr.split NaN check               | File `digestiveCorrelations.ts` no longer exists               |
| WQ-087 | Unbounded listAll query               | SyncedLogsContext now uses date-bounded `useSyncedLogsByRange` |
| WQ-094 | analyzeLogs called twice              | No longer called from Patterns.tsx or Menu.tsx                 |
| WQ-098 | buildFoodEvidenceResult client+server | Architecture changed; no longer dual-use                       |
| WQ-112 | Fluid section design                  | Replaced by NutritionCard                                      |
| WQ-116 | Units not applied to fluids           | Fixed in NutritionCard — all liquids show ml                   |
| WQ-117 | Food section redesign                 | Replaced by NutritionCard                                      |
| WQ-120 | Insights bar removal                  | Heuristics insight no longer found on Track page               |
| WQ-125 | Meal card blog-style                  | MealCard component no longer exists                            |
| WQ-138 | Hardcoded "tina"/"rec drug"           | "rec drug" not found; "tina" only in test/preview data         |
| WQ-152 | key?: string in SubRow props          | No longer present                                              |
| WQ-197 | 4 orphan game layer tables            | No game table references found in convex/                      |
| WQ-318 | Move context compiler server-side     | File `buildLlmContext.ts` no longer exists                     |
| WQ-321 | Sparkline gradient ID breaks          | color.replace("#","") pattern no longer in codebase            |
| WQ-411 | Portion size tracking                 | Done — NutritionCard                                           |
| WQ-413 | Liquids consolidation                 | Done — NutritionCard                                           |
| WQ-414 | Wire NutritionCard handler stubs      | Done                                                           |
| WQ-415 | NutritionCard E2E tests               | Done                                                           |
| WQ-416 | Extract duplicate nutrition utils     | Done                                                           |
| WQ-417 | Meal-slot-scoped recent foods         | Done                                                           |
| WQ-418 | Clean dead water store state          | Done                                                           |
