> **Ref:** `docs/ROADMAP.md`
> **Updated:** 2026-04-07
> **Version:** 2.3
> **History:**
>
> - v2.3 (2026-04-07) — Tech-Debt initiative marked Done, ~30 resolved standalone items moved to Removed
> - v2.2 (2026-04-06) — Food Page & Meal System initiative activated, Navigation Restructure superseded
> - v2.1 (2026-04-06) — added planning triage notes from completed roadmap mapping reports
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

> **Status:** Done
> **Plan (archived):** `docs/plans/archive/nutrition-card-impl-plan-waves-*.json`
> **PRD (archived):** `docs/plans/archive/meal-logging-prd.md`
> **Parent plan:** `docs/plans/data-integration-plan.md` (Wave 1)
> **Merged:** PR #3 into `main` (2026-04-06)

Chip-based, slot-aware meal builder replacing the old single text field. NutritionCard with search, staging, portions, 5-macro tracking, water modal, meal slot auto-detection. All 6 waves (0-5) complete. 69 commits, 1430 tests, 211 files changed.

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

### Tech-Debt Audit Cleanup

> **Status:** Done
> **PRD:** `docs/prd/2026-04-06-tech-debt-audit-cleanup.md`
> **Plans (archived):** `docs/plans/archive/2026-04-06-tech-debt-audit-cleanup-waves-{0-1,2-3,4-5}.json`, `docs/plans/archive/2026-04-06-tech-debt-audit-cleanup-wave-6.json`
> **Merged:** PR #5 (`pans-labyrinth`, W0-5) and PR #6 (`dantes-inferno`, W6) into `main` (2026-04-07)

Cross-cutting cleanup initiative driven by the 2026-04-06 audit report. All 7 waves complete (~80 tasks). Deferred: W4-01/02/12/14 (backup/bundle), W5-16 (pure refactor). Also resolved ~30 standalone ROADMAP items.

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

### Food Page, Meal System & Navigation Restructure

> **Status:** In Work Queue — plan active
> **PRD:** `docs/prd/2026-04-06-food-page-and-meal-system.md`
> **Plan:** `docs/plans/2026-04-06-food-page-and-meal-system.md`
> **Execution plans:** `docs/plans/2026-04-06-food-page-and-meal-system-waves-{0-1,2-3,4-6}.json`
> **Branch:** TBD (create at execution time)

Replace current 3-tab nav (Track / Patterns / Settings) with 4-tab bottom bar (Home / Track / Food / Insights) + header settings. Home = lightning-fast logging. Track = Today's Log only. Food = deep management with search, favourites, filter, editing, backfill. Insights = Patterns + Dr. Poo Report sub-tabs. Schema extensions for composite meal templates (deferred UI), slot-scoped favourite tagging, seed data for ~30 post-surgery foods.

7 waves (W0-W6), 22 tasks. Waves 7-9 (meal system UI, AI text parser, voice capture) deferred.

---

### Meal Plan Table

> **Status:** Parking lot

Structured meal planning based on safe food data.

---

## Standalone Items

> Bugs, debt, and polish not yet assigned to an initiative plan.
> When creating a plan for any initiative above, sweep this list for items that can be folded in.

### Planning Triage Notes (2026-04-06) — RESOLVED

> All items from this triage have been resolved by the Tech-Debt Audit Cleanup initiative (waves 0-6).
> Remaining open items (WQ-161, WQ-162) kept in their standalone tables above.
> All others moved to the Removed section with commit evidence.

### Track Page

| ID     | Title                   | Sev | Description                                 |
| ------ | ----------------------- | --- | ------------------------------------------- |
| WQ-121 | Desktop long-press menu | Med | Add 3-dot menu for desktop discoverability. |

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

| ID     | Title                                   | Sev | Description                                            |
| ------ | --------------------------------------- | --- | ------------------------------------------------------ |
| WQ-136 | "post-surgery anastomosis" hardcoded 3x | Med | In habitCoaching.ts. Parameterize from health profile. |

### Conversation Panel

| ID     | Title                           | Sev | Description                                                 |
| ------ | ------------------------------- | --- | ----------------------------------------------------------- |
| WQ-123 | Conversation markdown hierarchy | Med | All text bold/large — no visual hierarchy.                  |
| WQ-124 | Conversation card redesign      | Med | Single chat-window with separate summary/suggestions/meals. |

### UI Components & System

| ID     | Title                        | Sev  | Description                                               |
| ------ | ---------------------------- | ---- | --------------------------------------------------------- |
| WQ-115 | Toast notifications weak     | Med  | No coloured backgrounds, stacking, or prominent undo.     |
| WQ-320 | SubRow delete error handling | High | Inline onDelete calls have no try/catch. Add toast.error. |

### Dead Code & Cleanup

| ID     | Title                                     | Sev | Description                                |
| ------ | ----------------------------------------- | --- | ------------------------------------------ |
| WQ-161 | Registry "New entry." placeholder notes   | Low | Replace with clinical rationale or remove. |
| WQ-162 | Zone-change notes lack clinical rationale | Low | Notes explain what changed, not why.       |

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

### Deployment, PWA & Release Hygiene

| ID     | Title                              | Sev | Description                                                           |
| ------ | ---------------------------------- | --- | --------------------------------------------------------------------- |
| WQ-423 | Unblock microphone for voice plans | Med | `Permissions-Policy` sets `microphone=()` — will block voice logging. |

---

## Removed

Items verified as no longer valid (files deleted, code changed, or superseded):

| ID     | Title                                  | Reason removed                                                 |
| ------ | -------------------------------------- | -------------------------------------------------------------- |
| WQ-034 | dateStr.split NaN check                | File `digestiveCorrelations.ts` no longer exists               |
| WQ-087 | Unbounded listAll query                | SyncedLogsContext now uses date-bounded `useSyncedLogsByRange` |
| WQ-094 | analyzeLogs called twice               | No longer called from Patterns.tsx or Menu.tsx                 |
| WQ-098 | buildFoodEvidenceResult client+server  | Architecture changed; no longer dual-use                       |
| WQ-112 | Fluid section design                   | Replaced by NutritionCard                                      |
| WQ-116 | Units not applied to fluids            | Fixed in NutritionCard — all liquids show ml                   |
| WQ-117 | Food section redesign                  | Replaced by NutritionCard                                      |
| WQ-120 | Insights bar removal                   | Heuristics insight no longer found on Track page               |
| WQ-125 | Meal card blog-style                   | MealCard component no longer exists                            |
| WQ-138 | Hardcoded "tina"/"rec drug"            | "rec drug" not found; "tina" only in test/preview data         |
| WQ-152 | key?: string in SubRow props           | No longer present                                              |
| WQ-197 | 4 orphan game layer tables             | No game table references found in convex/                      |
| WQ-318 | Move context compiler server-side      | File `buildLlmContext.ts` no longer exists                     |
| WQ-321 | Sparkline gradient ID breaks           | color.replace("#","") pattern no longer in codebase            |
| WQ-411 | Portion size tracking                  | Done — NutritionCard                                           |
| WQ-413 | Liquids consolidation                  | Done — NutritionCard                                           |
| WQ-414 | Wire NutritionCard handler stubs       | Done                                                           |
| WQ-415 | NutritionCard E2E tests                | Done                                                           |
| WQ-416 | Extract duplicate nutrition utils      | Done                                                           |
| WQ-417 | Meal-slot-scoped recent foods          | Done                                                           |
| WQ-418 | Clean dead water store state           | Done                                                           |
| WQ-090 | TrackPage eagerly imported             | Done — tech-debt W4-18, lazy-loaded in `routeTree.tsx`         |
| WQ-107 | Split LogEntry.tsx (741 LOC)           | Done — tech-debt W3-06, now 234 LOC (`773d55e`)                |
| WQ-108 | Split aiAnalysis.ts (2225 LOC)         | Done — tech-debt W3-07, now 66 LOC (`4caf2d7`)                 |
| WQ-111 | BM time label position                 | Done — tech-debt W6-09, BM layout rework                       |
| WQ-113 | BM count data wrong                    | Done — tech-debt W5-21 (`4a8f7cc`)                             |
| WQ-118 | Weight target save bug                 | Done — tech-debt W5-22 (`962c42e`)                             |
| WQ-122 | BM layout rework                       | Done — tech-debt W6-09                                         |
| WQ-131 | Drawer overlay click-through           | Done — tech-debt W6-10                                         |
| WQ-148 | streaks.ts misleadingly named          | Done — renamed to `gamificationDefaults.ts`                    |
| WQ-150 | toLegacyFoodStatus potentially dead    | Assessed in W6-11 — still live, documented as intentional      |
| WQ-151 | columns stale export                   | Assessed in W6-12 — confirmed live                             |
| WQ-153 | FILTER_OPTIONS/SortKey/SortDir dead    | Done — removed in tech-debt cleanup                            |
| WQ-155 | Work-ticket marker comments            | Done — removed in tech-debt cleanup                            |
| WQ-159 | "use client" directives                | Done — removed (files deleted or cleaned)                      |
| WQ-163 | Stale comment: wrong import path       | Done — code restructured, comment no longer present            |
| WQ-186 | Duplicate timestamp on expand          | Done — tech-debt W5-25 (`d681d04`)                             |
| WQ-187 | Cigarettes duplicate subrows           | Done — tech-debt W5-26 (`d681d04`)                             |
| WQ-188 | Sleep expand repeats label             | Done — tech-debt W5-27 (`d681d04`)                             |
| WQ-189 | Activity rows split label/time         | Done — tech-debt W5-28 (`d681d04`)                             |
| WQ-191 | Locale-dependent formatTime            | Done — tech-debt W5-17 (`78a0a52`)                             |
| WQ-192 | getDaysPostOp uses new Date()          | Done — tech-debt W5-18, accepts `now` param (`78a0a52`)        |
| WQ-193 | buildUserMessage has 15 parameters     | Done — tech-debt W3-07, uses `BuildUserMessageParams` object   |
| WQ-194 | WeeklyContext/WeeklyDigestInput dup    | Done — tech-debt W5-19, merged (`78a0a52`)                     |
| WQ-196 | fetchWeeklySummary no model validation | Done — tech-debt W5-20 (`78a0a52`)                             |
| WQ-198 | Legacy activity sleep readers          | Done — tech-debt W6-14                                         |
| WQ-419 | Replace placeholder CSP domain         | Done — tech-debt, placeholder removed from `vercel.json`       |
| WQ-420 | Restore missing PWA screenshots        | Done — tech-debt W6-15                                         |
| WQ-421 | Restore installable 512px icon         | Done — tech-debt W6-16, icons added (`edec8b1`)                |
| WQ-422 | Document or remove unsafe-inline       | Done — tech-debt W6-03, accepted-risk documented               |
| WQ-424 | Precache image assets                  | Done — tech-debt W6-17, globPatterns includes png/jpg/webp     |
| WQ-425 | Move dotenv to devDependencies         | Done — tech-debt, moved to devDeps                             |
| WQ-426 | Remove dead next-themes dep            | Done — tech-debt, removed from package.json                    |
| WQ-427 | Clean stale transit-map gitignore      | Done — tech-debt, exclusions removed                           |
| WQ-428 | Add unauthenticated app-load E2E       | Done — tech-debt W5-24 (`b1b9f3b`)                             |
| WQ-429 | Make document title descriptive        | Done — tech-debt, title updated                                |
| WQ-430 | Lowercase package name                 | Done — tech-debt, name lowercased                              |
| WQ-431 | Rename stale theme storage key         | Done — tech-debt W2-09, `storageKeys.ts` created               |
| WQ-432 | Simplify .playwright-cli ignores       | Done — tech-debt, redundant entries removed                    |
| WQ-433 | Count liquid foods toward fluids       | Done — tech-debt W5-29 (`d681d04`)                             |
| WQ-434 | Aquarius/electrolyte data wrong        | Done — tech-debt W5-30 (`f01aa6c`)                             |
| WQ-435 | Sleep/Weight two-click to open         | Done — tech-debt W5-23 (`962c42e`)                             |
