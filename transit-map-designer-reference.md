# Transit Map — Designer Reference (Concatenated)

**Generated:** 2026-03-20
**Total Files Included:** 38
**Purpose:** Complete visual design reference for the transit map — design specs, data model, components, styling, and constraints. For sharing with a designer to develop a feasible visual hierarchy.

## Reading Order

Priority: #1 → #2 → #7–10 → #11 → #17 → #28 → #4 → #12 (L1-133 only)

## File Categories

| Range | Category |
|-------|----------|
| 1-6 | Design intent & specs (docs) |
| 7-10 | Design constraints (memory) |
| 11-17 | Data model & types |
| 18-21 | Hooks (data → visual) |
| 22-23 | Schema (backend evidence) |
| 24-27 | Components — new production (list-based) |
| 28-34 | Components — old SVG dev reference |
| 35 | Superseded (historical) |
| 36-37 | Host page & CSS theming |
| 38 | Station artwork assets |

---

<a id="ref-0"></a>
# [0] Source: /Users/peterjamesblizzard/projects/caca_traca/docs/plans/2026-03-20-sprint-2.7-transit-map-canvas.md
<!-- Lines:      326 | Included: full -->

# Sprint 2.7: Transit Map Canvas — Radial SVG Explorer Map

> **For Claude:** This is both a plan and a session prompt. Execute this plan using sub-agent driven development.

## Session Instructions

**You are an orchestrator. Do NOT read files yourself.** Dispatch sub-agents for ALL work. Your job is coordination — writing briefs, dispatching agents, reviewing results, and managing dependencies.

**Context management rules:**

- Do NOT read source files in the main conversation. Trust sub-agents to do their own research.
- Give each sub-agent a self-contained brief with file paths and exact specifications.
- Use Opus for complex/reasoning-heavy tasks (geometry design, architecture decisions, integration).
- Use Sonnet for well-defined narrow-scope tasks (component creation, wiring, cleanup).
- Dispatch multiple agents in parallel wherever there are no dependencies.
- Do NOT fix things yourself — send agents to fix them.
- Update `docs/WIP.md` and `docs/WORK-QUEUE.md` at wave boundaries, not after every task.

**Quality gates:** Run `bun run typecheck && bun run test:unit && bun run build` after each wave.

## Goal

Replace the list-based transit map (from Sprint 2.6 Wave 2) with a production SVG canvas map using a radial concentric layout. The map is an **explorer's map** — it shows where the user has been (tested foods with evidence colors) and where they haven't (ghosted stations). It is NOT a linear journey.

## Architecture Context

**Existing data layer (keep as-is):**

- `src/hooks/useTransitMapData.ts` — produces `TransitNetwork` from registry + evidence
- `src/types/transitMap.ts` — `TransitStation`, `TransitLine`, `TransitCorridor`, `TransitNetwork` types + helpers
- `shared/foodRegistry.ts` — 95 canonical foods across 4 groups, 11 lines, 3 zones

**Stack:** React, SVG, Tailwind v4, TypeScript. No external charting/SVG libraries.

## Design Specification

### Mental Model

The map is an **explorer's map**, not a journey. Users can try any food in their current zone freely — there is no prescribed order within a line. The map shows exploration progress (visited vs unvisited destinations), not route progress.

- Zones (1A, 1B, 2, 3) are the real structure — progression gates
- Lines (Meat & Fish, Grains, etc.) are organizational categories, not sequential routes
- "Next food" is about what's available in the user's zone, not the next stop on a track
- The app tracks and informs, never blocks (no-judgment principle)

### Visual Structure

**Radial concentric layout:**

- Zone 1A (liquids, 4 stations) at the center — very sparse
- Zone 1B (soft solids, 26 stations) — first ring
- Zone 2 (extended, 53 stations) — second ring, bulk of the map
- Zone 3 — outer edges, minimal (3-4 representative stations per line branching off)

**Corridors are NOT equal quadrants.** Each corridor's lines radiate outward with their own organic shape. Lines have different lengths based on station count. Lines curve, bend, and overlap like a real transit map (London Underground style, NOT a grid).

**Line sizes (Zones 1A-2 only):**

- grains: 19, vegetables: 15, eggs_dairy: 10, meat_fish: 9
- sauces_condiments: 8, fruit: 7, dairy_fats: 6, herbs_spices: 4
- vegetable_protein: 2, oils: 2, nuts_seeds: 2

**Zone boundaries** visible as concentric ring arcs behind the lines, with zone labels. Interchange markers where lines cross zone boundaries.

### Station Rendering

Each station is a circle on the map positioned along its line's SVG path.

**Status colors:**

- Green (safe) — bright, fully visible
- Blue (building) — bright with subtle pulse animation
- Amber (watch) — bright
- Red (avoid) — bright
- Grey, low opacity — unexplored/untested, ghosted

The map "lights up" as the user explores — motivating without being gamified.

**Labels:** At line and station-focus zoom levels, station names appear. At radial overview and corridor levels, only 2-3 representative stations per line are labeled (lowest lineOrder per zone). The rest are just dots.

### Zoom Levels (4 discrete levels, animated step-zoom)

1. **Radial overview** — all 4 corridors, concentric zone rings, representative stations only
2. **Corridor** — one corridor's lines, representative stations
3. **Line** — all stations on one line
4. **Station focus** — 3-4 neighboring stations on one side of the canvas, station detail callout rendered inline on the canvas beside them

**Transitions:** Tap to zoom in (corridor → line → station). Back/breadcrumb to zoom out. Animated CSS `transform: scale() translate()` transitions — the SVG doesn't re-render, it just scales and pans.

**Station focus callout:** When you tap a station at line level, the map zooms to show the station neighborhood, and a detail callout renders ON the canvas (not in a separate panel, not overlaying the map). The callout shows: station name + zone, status/confidence/tendency, trial count + Bristol breakdown, digestion badges, AI verdict if available.

### Mobile

The SVG canvas has its own natural size (wider than portrait viewport). In portrait, the user sees a slice and swipes left/right to pan. In landscape, the whole map is visible. The station detail callout is part of the canvas — no separate panels.

Touch: `touch-action: pan-x pan-y` on the container. Tap to step-zoom. Swipe to pan.

## Station Count Reference

| Line              | Group     | 1A  | 1B  | Z2  | Map Total | Z3  |
| ----------------- | --------- | --- | --- | --- | --------- | --- |
| grains            | carbs     | 0   | 11  | 8   | 19        | 5   |
| vegetables        | carbs     | 1   | 2   | 12  | 15        | 8   |
| eggs_dairy        | protein   | 2   | 5   | 3   | 10        | 2   |
| meat_fish         | protein   | 1   | 2   | 6   | 9         | 6   |
| sauces_condiments | seasoning | 0   | 1   | 7   | 8         | 5   |
| fruit             | carbs     | 0   | 4   | 3   | 7         | 8   |
| dairy_fats        | fats      | 0   | 0   | 6   | 6         | 2   |
| herbs_spices      | seasoning | 0   | 1   | 3   | 4         | 3   |
| vegetable_protein | protein   | 0   | 0   | 2   | 2         | 1   |
| oils              | fats      | 0   | 1   | 1   | 2         | 1   |
| nuts_seeds        | fats      | 0   | 0   | 2   | 2         | 3   |
| **Total**         |           | 4   | 26  | 53  | **83**    | 44  |

## Implementation Waves

### Wave 1: Geometry Foundation (WQ-320, WQ-321)

**WQ-320: Design the hand-authored map geometry** (Opus)

Create `src/components/patterns/transit-map/useTransitMapGeometry.ts`.

This is the core creative/technical task. Define:

- Zone ring radii (4 concentric circles for 1A, 1B, 2, 3 boundaries)
- SVG viewBox dimensions for the full map
- Hand-authored SVG path (`d` attribute) for each of the 11 food lines
- Station positions (x, y coordinates) along each line path
- Interchange node positions at zone boundary crossings
- Representative station indices per line (for overview/corridor zoom labels)

The geometry must feel like a real transit map — organic, asymmetric, lines of different lengths and curves. NOT a grid, NOT equal quadrants. Reference the NotebookLM radial concentric map image (user has it).

**Key constraints:**

- Lines radiate outward from center through zone rings
- Bigger lines (grains: 19, vegetables: 15) get longer, more prominent paths
- Tiny lines (oils: 2, nuts_seeds: 2) are short stubs
- Zone 3 gets minimal representation (3-4 stations branching off at the edges)
- Corridors occupy different angular regions but NOT equal sectors
- Station positions must not overlap — minimum spacing between circles

**Input:** The hook should consume `TransitNetwork` from `useTransitMapData` and return positioned geometry ready for SVG rendering.

**Output type (define this):**

```typescript
interface MapGeometry {
  viewBox: { width: number; height: number };
  zoneRings: Array<{ zone: string; radius: number; label: string }>;
  lines: Array<{
    line: FoodLine;
    group: FoodGroup;
    path: string; // SVG path d attribute
    color: string; // line color
    stations: Array<{
      canonical: string;
      x: number;
      y: number;
      isRepresentative: boolean; // shown at overview/corridor level
    }>;
  }>;
  interchanges: Array<{ x: number; y: number; zone: string }>;
}
```

Pre-reading for the agent: `shared/foodRegistry.ts` (station data), `src/types/transitMap.ts` (types), `src/components/patterns/transit-map/useTransitScene.ts` (reference for how the Model Guide does scene building).

**WQ-321: Define corridor color palette** (Sonnet)

Create a shared constant mapping each corridor + line to its SVG track color. Each corridor has a base hue, each line within a corridor gets a shade/variant. Also define zone ring colors.

This can be a small addition to an existing constants file or a new `mapColors.ts`.

### Wave 2: Canvas Rendering (WQ-322, WQ-323, WQ-324) — parallel

**WQ-322: TransitMapCanvas component** (Sonnet)

Create `src/components/patterns/transit-map/TransitMapCanvas.tsx`.

The SVG canvas that renders the full map:

- Zone ring arcs (concentric circles with zone labels)
- Line paths (colored SVG `<path>` elements with shadow/glow)
- Station circles along each path (colored by evidence status, ghosted if unexplored)
- Interchange markers at zone boundaries
- Station labels (HTML overlay, positioned by coordinate transform)

Props: `{ geometry: MapGeometry; network: TransitNetwork; zoomLevel: ZoomLevel; onStationTap: (canonical: string) => void; onLineTap: (line: FoodLine) => void; onCorridorTap: (group: FoodGroup) => void }`

At different zoom levels, the canvas shows/hides elements:

- Overview: all lines, representative labels only
- Corridor: highlighted corridor's lines bright, others dimmed, representative labels
- Line: one line highlighted, all its station labels visible
- Station: neighborhood of stations visible, callout rendered

**WQ-323: StationCallout component** (Sonnet)

Create `src/components/patterns/transit-map/StationCallout.tsx`.

Inline canvas callout for the station-focus zoom level. Renders ON the SVG canvas (as a foreignObject or absolutely positioned HTML). Shows:

- Station name + zone badge
- Status, confidence, tendency metrics
- Trial count + Bristol breakdown (compact)
- Digestion badges
- AI verdict if available

Reuse the data logic from `StationInspector.tsx` — same data, different visual container.

Props: `{ station: TransitStation; corridorGroup: FoodGroup; position: { x: number; y: number } }`

**WQ-324: TransitMapZoomController component** (Opus)

Create `src/components/patterns/transit-map/TransitMapZoomController.tsx`.

The zoom state machine + animated transitions + touch handling. This is the top-level component that wraps TransitMapCanvas.

State: `{ level: "overview" | "corridor" | "line" | "station"; corridorGroup?: FoodGroup; line?: FoodLine; stationCanonical?: string }`

Responsibilities:

- Manages zoom level state transitions
- Applies CSS `transform: scale() translate()` to the SVG container for animated zoom
- Handles tap-to-zoom-in and back-to-zoom-out
- Handles mobile touch pan/swipe (`touch-action: pan-x pan-y`)
- Renders breadcrumb trail showing current zoom path (e.g., "Overview > Protein > Meat & Fish")
- Passes zoom-level-appropriate props to TransitMapCanvas

### Wave 3: Integration & Cleanup (WQ-325, WQ-326, WQ-327)

**WQ-325: Wire into Patterns page** (Sonnet)

Replace `TransitMapContainer` import in `src/pages/Patterns.tsx` with `TransitMapZoomController`. The zoom controller calls `useTransitMapData(foodStats)` internally.

**WQ-326: Delete Wave 2 list-based components** (Sonnet)

Delete the list-based components that are now replaced:

- `TransitMapContainer.tsx`
- `LineTrack.tsx`
- `StationNode.tsx`
- `StationInspector.tsx`
- `RegistryTransitMap.tsx` (was already unused)

Verify no broken imports.

**WQ-327: Delete Model Guide and mock data** (Sonnet)

Now that the production map exists, delete the Model Guide:

- Remove the "Model guide" tab from Patterns.tsx (the inner Tabs with "Live network" / "Model guide")
- Delete `TransitMap.tsx` and all Model Guide-only files: `StationMarker.tsx`, `StationTooltip.tsx`, `TransitMapInspector.tsx`, `TrackSegment.tsx`, `ZoneCard.tsx`, `useTransitScene.ts`, `useStationArtwork.ts`, `constants.ts`, `types.ts`, `utils.ts`, `IntersectionNode.tsx`
- Delete `src/data/transitData.ts` (2112-line mock data)
- Verify no broken imports

This also completes WQ-213 and WQ-214 from Sprint 2.6.

### Wave 4: Polish & Verify (WQ-328, WQ-329)

**WQ-328: Quality gate** (Sonnet)

Run `bun run typecheck && bun run test:unit && bun run build`. Fix any issues.

**WQ-329: Browser verification** (Sonnet)

Use playwright-cli to verify the transit map renders on the Patterns page at localhost:3005. Check all 4 zoom levels work. Screenshot for docs.

## Dependency Graph

```
Wave 1: WQ-320 ──┐
         WQ-321 ──┤
                  ├─→ Wave 2: WQ-322 (canvas) ─┐
                  │          WQ-323 (callout) ──┤
                  │          WQ-324 (zoom) ─────┤
                  │                             ├─→ Wave 3: WQ-325 (wire) ─┐
                  │                             │          WQ-326 (delete) ─┤
                  │                             │          WQ-327 (delete) ─┤
                  │                             │                          ├─→ Wave 4: WQ-328, WQ-329
```

WQ-320 and WQ-321 can run in parallel.
WQ-322, WQ-323, WQ-324 can run in parallel (all depend on Wave 1).
WQ-325, WQ-326, WQ-327 run after Wave 2. WQ-326 and WQ-327 can be parallel, WQ-325 first.
Wave 4 runs after Wave 3.

## Pre-reading for Sub-agents

Include these file paths in agent briefs as needed:

- `src/hooks/useTransitMapData.ts` — live data hook
- `src/types/transitMap.ts` — types + helpers
- `shared/foodRegistry.ts` — canonical food entries, groups, lines, zones
- `src/components/patterns/transit-map/useTransitScene.ts` — Model Guide geometry (reference for SVG path building)
- `src/components/patterns/transit-map/TransitMap.tsx` — Model Guide component (reference for SVG rendering patterns)
- `src/components/patterns/transit-map/StationInspector.tsx` — station detail logic to reuse in callout
- `src/pages/Patterns.tsx` — where transit map is rendered
- `src/lib/foodDigestionMetadata.ts` — digestion badges

## Design Constraints (from CLAUDE.md)

- Calm & scannable UX — user may be stressed/symptomatic
- Progressive disclosure — lead with most important signal
- Accessibility mandatory — aria labels, keyboard nav, loading/error states
- Design system discipline — use tokenized colors, check for existing components
- No hard-coding personalization
- Base UI components only (no Radix)
- No `!` non-null assertions
- Explorer map, NOT a linear journey — don't use "next stop" language implying sequence

## WORK-QUEUE Items Addressed

| WQ ID  | Item                                                      | Wave   |
| ------ | --------------------------------------------------------- | ------ |
| WQ-320 | Hand-authored map geometry                                | Wave 1 |
| WQ-321 | Corridor color palette                                    | Wave 1 |
| WQ-322 | TransitMapCanvas SVG component                            | Wave 2 |
| WQ-323 | StationCallout inline detail                              | Wave 2 |
| WQ-324 | TransitMapZoomController                                  | Wave 2 |
| WQ-325 | Wire into Patterns page                                   | Wave 3 |
| WQ-326 | Delete list-based components                              | Wave 3 |
| WQ-327 | Delete Model Guide + mock data (completes WQ-213, WQ-214) | Wave 3 |
| WQ-328 | Quality gate                                              | Wave 4 |
| WQ-329 | Browser verification                                      | Wave 4 |


---

<a id="ref-1"></a>
# [1] Source: /Users/peterjamesblizzard/projects/caca_traca/docs/archive/plans/transit-map-and-reward-model.md
<!-- Lines:      334 | Included: full -->

# Transit Map & Reward Model — Design Reference

**Date:** 2026-03-12  
**Status:** Design intent captured. 4-group/11-line hierarchy implemented in Phase 2.5. Transit map UI deleted — will be rebuilt in Phase 5.  
**Related:** [ADR-0002](../adrs/0002-food-registry-and-canonicalization.md), [Food System Rebuild](./food-system-rebuild.md)

---

## The transit map metaphor

The transit map is a **historical record of where the user has been**, not a live
journey or a progress gate. Think of it as a tube map showing every station you
have ever visited — not which line you are currently riding.

Each **station** is a canonical food from the registry. Its **zone** determines
which part of the network it sits in (Zone 1 = central lines, Zone 2 = outer
network, Zone 3 = the wild periphery). Its **status** determines its colour.

### Station status colours

| Colour             | Meaning                                                                       |
| ------------------ | ----------------------------------------------------------------------------- |
| Grey               | Never trialled. Station not yet visited.                                      |
| Blue               | Trialling — fewer than the minimum resolved trials. Still gathering evidence. |
| Green              | Safe. Consistently good outcomes across trials.                               |
| Green (teal)       | Safe-loose. Good outcomes but tends toward loose stools.                      |
| Green (amber tint) | Safe-hard. Good outcomes but tends toward firm/hard.                          |
| Amber / Orange     | Watch. One or more concerning outcomes. More trials needed.                   |
| Red                | Avoid. Consistent bad outcomes. Strong evidence against.                      |

### What "visited" means

A station is visited the first time a user logs that food. Its colour updates
as evidence accumulates. A station can move from grey → blue → green, or grey
→ blue → orange → red, depending on what the trials show.

Visiting a station is always a win — even if it ends up red, that's valuable
information.

---

## The reward model

The app is designed with ADHD and reward/game theory in mind. Celebrations fire
on **information gain**, not on compliance or "good" behaviour.

### Milestone triggers

| Milestone                                              | Celebration reason                           |
| ------------------------------------------------------ | -------------------------------------------- |
| First food logged ever                                 | Starting the journey                         |
| First food trialled (resolved)                         | First completed experiment                   |
| Zone 1 complete on a sub-line                          | Explored the safe core for this food type    |
| 5 stations green                                       | Building a safe menu                         |
| 10 stations any status                                 | Active explorer                              |
| First station turned red / avoid                       | Detective work done. You know what to avoid. |
| First station turned orange / watch                    | Suspicious! More trials needed.              |
| First station cleared (orange → green)                 | Vindicated! It was fine after all.           |
| All sub-lines in a group have Zone 1 stations visited  | Group foundations complete                   |
| Full sub-line complete (all zones visited)             | Sub-line mastered                            |
| First Zone 3 station trialled                          | Adventurous                                  |
| Longest trial streak (N consecutive days with a trial) | Consistent                                   |

### Design principles for celebrations

- **A red station is not a failure.** Knowing a food causes diarrhea is useful,
  actionable data. It belongs on the avoid list. The user is safer for knowing.
  Celebrate it.
- **Negative discoveries deserve the same celebration as positive ones.**
  The detective framing: every resolved trial is a case closed.
- **No punishment for eating anything.** The system never warns against eating
  a Zone 3 food before the user has trialled Zone 1. It may note "this is a
  Zone 3 food — here's what that means" but it never blocks or scolds.
- **Small wins matter.** First log, first trial, first green station — each gets
  its own moment. Users with ADHD benefit from frequent, low-threshold rewards.

---

## What the transit map is NOT

- **Not a live journey indicator.** There is no "you are here" pin showing the
  current food in transit. Transit times are shown as evidence summaries, not
  as a live countdown.
- **Not a progression lock.** Zone 3 stations are visible and accessible from
  day one. The user can see what's out there and choose their own path.
- **Not punitive.** No red warning before eating. No blocked actions. No shame.

---

## Current implementation state

The transit map UI exists in the codebase but uses **mock/static data** from the
broken legacy engine. It is not wired to Convex. The legacy engine's data was
wrong — none of the analytics, transit times, or food statuses it produced were
usable.

The legacy transit map UI (`TransitMap.tsx`, `StationDetailPanel.tsx`,
`TransitMapTest.tsx`, `transitMapLayout.ts`, `pointsEngine.ts`) was **deleted
in Phase 2.5**. The transit map will be rebuilt from scratch in Phase 5 using
the new registry hierarchy and correct data.

**Do not use any legacy transit map data for product decisions.**

---

## Hierarchical structure — Groups, Lines, and Stations

> Updated 2026-03-12 (Phase 2.5 — complete). Replaces the flat 6-line model.

The transit map is **not one big map of 100 foods**. It is a set of
per-subcategory line maps. The user taps a food group (e.g. "Carbs") and sees
multiple sub-lines on one map. They tap a specific sub-line (e.g. "Vegetables")
and see just that line with its zone progression.

The data model is hierarchical: **Group → Line → Station**.

### The four macronutrient groups

| Group         | Sub-lines                                    | Clinical purpose                                        |
| ------------- | -------------------------------------------- | ------------------------------------------------------- |
| **Protein**   | Meat & Fish, Eggs & Dairy, Vegetable Protein | Users can see if they're getting enough protein sources |
| **Carbs**     | Grains, Vegetables, Fruit                    | Users can see carbohydrate variety and balance          |
| **Fats**      | Oils, Dairy Fats, Nuts & Seeds               | Users can see if they're missing fat sources            |
| **Seasoning** | Sauces & Condiments, Herbs & Spices          | Users can track flavouring tolerance                    |

These groups serve a clinical purpose: even when regressed to basic foods, a user
can see at a glance whether they have a balanced diet across macronutrient groups.

### Per-line independent progression

**Progression is per line, not global.**

Each sub-line has its own sequence of stations, and a user travels each line
independently. They can be at completely different stages on different lines
simultaneously — this is normal and expected.

Example: a user might be at Zone 3 on the Meat & Fish line (they eat air-fried
chicken wings fine) while still at Zone 1 on the Vegetables line (cooked carrot
is as adventurous as they get). The map shows both lines accurately. There is
no "complete Zone 1 before Zone 2" gate.

### Per-line zone structure (the visual concept)

Each sub-line view shows:

- **Zone 1**: A single track, 2–4 stations. Safest, most basic preparations.
- **Interchange node**: Visual zone boundary (structural, not a food). Zone 1 → 2.
- **Zone 2**: Track splits into 2–3 branches. More stations, more adventurous
  preparations. Visually metro-like with parallel tracks and interchanges.
- **Interchange node**: Zone 2 → 3 boundary.
- **Zone 3**: 1–2 lines, fewer stations. Key foods only (fried, raw, spicy
  variants). Arrows indicating "and beyond."

Each view is small and manageable: ~10–15 stations per sub-line, not 100 foods
on one page. This is buildable and useful.

### Key classification decisions

- **Garlic** → Herbs & Spices (Seasoning). It is a herb.
- **Onion** → Vegetables (Carbs). It is a vegetable.
- **Dairy is split**: yogurt, cottage cheese, milk, kefir → Eggs & Dairy
  (Protein). Butter, cream, hard cheese, cream cheese, soft rind cheese →
  Dairy Fats (Fats).
- **Salad** is not a separate sub-line. Raw salad items are Zone 2–3 stations
  on the Vegetables line.
- **Avocado** → Nuts & Seeds (Fats).

### What "next station" means in the UI

The map should make it easy for a user to see:

- Which stations on each line they have visited (any colour other than grey)
- The next unvisited station on each line
- Their overall coverage per line and per group as a simple progress indicator

This gives users with ADHD a clear, low-friction answer to "what should I try
next?" without overwhelming them with the full food list at once.

---

## Liquids — tracked, not mapped

Zone 1A liquids (water, broth, juice, herbal tea, nutritional supplement) are
the pre-map starting point. Every anastomosis patient learns these in hospital
before discharge. They are tracked in the app but **do not appear as stations**
on the transit map.

They may appear as:

- A reference card or tooltip within the map view
- A single introductory "Liquids" node with tooltip listing them
- A fallback reference ("these are your safe basics")

**Milk and kefir are NOT liquids.** They belong under Eggs & Dairy (Protein).
Milk was poorly tolerated early in recovery; kefir caused bad diarrhea. Dr. Poo
will advise against drinking milk too early when it appears in logs.

---

## Registry fields: group, line, and lineOrder

> Updated 2026-03-12 (Phase 2.5 — complete). Replaces the flat `TransitLine` model.

Each `FoodRegistryEntry` has three fields powering the transit map:

```typescript
group: FoodGroup; // "protein" | "carbs" | "fats" | "seasoning"
line: FoodLine; // "meat_fish" | "eggs_dairy" | "vegetables" | "grains" | etc.
lineOrder: number; // suggested exploration order within the sub-line (1 = try first)
```

```typescript
type FoodGroup = "protein" | "carbs" | "fats" | "seasoning";

type FoodLine =
  | "meat_fish"
  | "eggs_dairy"
  | "vegetable_protein" // Protein
  | "grains"
  | "vegetables"
  | "fruit" // Carbs
  | "oils"
  | "dairy_fats"
  | "nuts_seeds" // Fats
  | "sauces_condiments"
  | "herbs_spices"; // Seasoning
```

Helper functions from `foodRegistry.ts` / `foodCanonicalization.ts`:

- `getFoodGroup(canonical)` → `FoodGroup | undefined`
- `getFoodLine(canonical)` → `FoodLine | undefined`
- `getFoodsByLine(line)` → sorted by `lineOrder`
- `getLinesByGroup(group)` → all sub-lines for a group
- `getLineDisplayName(line)` → human-readable name
- `getGroupDisplayName(group)` → human-readable name

Constants:

- `FOOD_GROUPS` → all four `FoodGroup` values
- `FOOD_LINES` → all eleven `FoodLine` values

**Status:** Phase 2.5 complete. Hierarchy implemented in registry. Transit map UI deleted — will be rebuilt in Phase 5.

---

## Verification Audit (2026-03-12)

Audited by Claude against the actual codebase (`src/lib/foodRegistry.ts`).

### Types and constants — PASS

- `FoodGroup`, `FoodLine`, `FOOD_GROUPS`, `FOOD_LINES` all exist and match the doc exactly.
- `FoodRegistryEntry` has `group`, `line`, and `lineOrder` fields as documented.

### Helper functions — PASS

All six helpers exist in `foodRegistry.ts` and are re-exported from `foodCanonicalization.ts`:

- `getFoodGroup`, `getFoodLine`, `getFoodsByLine`, `getLinesByGroup`, `getLineDisplayName`, `getGroupDisplayName`.

### Hierarchy (4 groups / 11 lines) — PASS

Group-to-line mapping matches the registry's `GROUP_LINES` constant exactly.

### Key classification decisions — PASS

- Garlic: `herbs_spices` (seasoning) — correct.
- Onion: `vegetables` (carbs) — correct.
- Dairy split: yogurt/egg/milk/cottage cheese in `eggs_dairy` (protein); butter/cream cheese/hard cheese/cream/ice cream/soft rind cheese/double cream in `dairy_fats` (fats) — correct.
- Avocado: `nuts_seeds` (fats) — correct.
- Raw salad: `vegetables` (carbs), Zone 3 — correct.

### Station counts per line — DISCREPANCY

Doc claims "~10-15 stations per sub-line". Actual counts from registry:

| Line              | Stations | Matches "10-15"? |
| ----------------- | -------- | ---------------- |
| meat_fish         | 12       | Yes              |
| eggs_dairy        | 6        | No (below)       |
| vegetable_protein | 1        | No (far below)   |
| grains            | 13       | Yes              |
| vegetables        | 23       | No (far above)   |
| fruit             | 13       | Yes              |
| oils              | 3        | No (below)       |
| dairy_fats        | 7        | No (below)       |
| nuts_seeds        | 4        | No (below)       |
| sauces_condiments | 6        | No (below)       |
| herbs_spices      | 7        | No (below)       |

**Total: 95 stations.** Only 3 of 11 lines fall in the claimed 10-15 range. 6 lines have fewer than 8 stations. Vegetables has 23 (far above). The "~10-15" claim is aspirational, not factual.

### "Not one big map of 100 foods" — BORDERLINE

Total is 95, which is close to 100. The statement is technically correct but misleading since it implies a much smaller number.

### Current implementation state — CONTRADICTION (lines 92 vs 98)

- Line 92: "The transit map UI exists in the codebase"
- Line 98: legacy UI was "deleted in Phase 2.5"

These contradict. Verified: legacy source files (`TransitMap.tsx`, `StationDetailPanel.tsx`, `TransitMapTest.tsx`, `transitMapLayout.ts`, `pointsEngine.ts`) are deleted. Only a stale dist artifact remains (`dist/assets/TransitMapTest-D4XZXwZk.js`). `Patterns.tsx` has a no-op `handleViewOnMap` placeholder. The UI is deleted — line 92 is stale/wrong.

### Liquids section — INACCURACY

Doc lists "Zone 1A liquids (water, broth, juice, herbal tea, nutritional supplement)". The registry has only 2 Zone 1A entries: `clear broth` and `smooth soup`. Water, juice, herbal tea, and nutritional supplement are not registry entries at all. The doc's framing implies they are Zone 1A registry foods; they are actually unregistered items tracked separately (if at all).

### Raw salad classification — MINOR INACCURACY

Doc says "Raw salad items are Zone 2-3 stations on the Vegetables line." In the registry, `raw salad` is Zone 3 only. No salad items exist in Zone 2. Should say "Zone 3".

### Legacy file deletion — PASS

All five legacy files confirmed deleted from source. `Patterns.tsx` handler is a documented no-op.

### Reward model milestones — DESIGN ONLY

No milestone/celebration logic exists in the codebase. These are design intent, not implemented features. The doc does not explicitly mark them as unimplemented.

### Summary

| Area                 | Status        |
| -------------------- | ------------- |
| Types and constants  | PASS          |
| Helper functions     | PASS          |
| Hierarchy            | PASS          |
| Classifications      | PASS          |
| Station counts       | DISCREPANCY   |
| Implementation state | CONTRADICTION |
| Liquids              | INACCURACY    |
| Raw salad            | MINOR         |
| Legacy deletion      | PASS          |
| Reward model         | DESIGN ONLY   |


---

<a id="ref-2"></a>
# [2] Source: /Users/peterjamesblizzard/projects/caca_traca/docs/plans/2026-03-17-sprint-2.6-transit-map-ui.md
<!-- Lines:      168 | Included: full -->

# Sprint 2.6: Transit Map UI — Replace Mock with Live Data

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the production transit map UI powered by live registry and evidence data, replacing all mock/hardcoded visual components so they can be deleted.

**Architecture:** The transit map visualizes food reintroduction progress using a metro-map metaphor. 4 corridors (protein, carbs, fats, seasoning) containing 11 lines, with stations representing canonical foods. Station status comes from the food evidence engine (Sprint 2.5). The existing `useTransitMapData` hook provides the data foundation — this sprint builds the UI on top of it.

**Tech Stack:** React, SVG rendering, Tailwind v4, `useTransitMapData` hook, shared/foodEvidence.ts

**Depends on:** Sprint 2.5 (transit time model, evidence thresholds, LLM pipeline must be working)

---

## Pre-reading

Before starting, read these files:

- `docs/plans/2026-03-17-sprint-2.5-transit-and-llm-pipeline.md` — the data foundation
- `src/hooks/useTransitMapData.ts` — the data hook (what's available)
- `src/components/patterns/transit-map/` — existing components (what exists)
- `src/data/transitData.ts` — the mock data to be replaced
- `src/pages/Patterns.tsx` — where the transit map is rendered
- `docs/adrs/0002-food-registry-and-canonicalization.md` — the registry hierarchy

---

## Wave 1: Audit Existing Transit Map Components

### Task 1.1: Inventory Current Components

Read every file in `src/components/patterns/transit-map/` and document:

- Which components use live data from `useTransitMapData`?
- Which components use hardcoded/mock data from `src/data/transitData.ts`?
- Which components are the "Model Guide" (static reference) vs "Live Network" (dynamic)?
- What is the `RegistryTransitMap` vs `TransitMap` split?

### Task 1.2: Identify What to Keep vs Delete

Based on the inventory:

- **Keep:** Components that render from `useTransitMapData` hook data
- **Delete:** Components that render from `transitData.ts` mock data
- **Refactor:** Components that mix both

### Task 1.3: Document the Target UI Contract

Define what the transit map should show for v1:

- **Corridor view:** 4 macro groups with expandable lines
- **Line view:** Stations ordered by `lineOrder` showing status (safe/building/unknown/culprit)
- **Station detail:** On tap — show evidence summary (trial count, transit times, Bristol scores, AI verdict)
- **Zone indicators:** Zone 1/2/3 boundaries visible on each line
- **"In transit" indicator:** Foods currently being digested (from Sprint 2.5 Wave 2)

---

## Wave 2: Build Production Components

### Task 2.1: Transit Map Container

**Files:**

- Modify or create: `src/components/patterns/transit-map/TransitMapContainer.tsx`

The top-level component that:

- Calls `useTransitMapData()` to get live data
- Renders corridor headers (Protein, Carbs, Fats, Seasoning)
- Handles zoom levels (corridor → line → station) via progressive disclosure
- Shows loading/empty states

### Task 2.2: Line Component

**Files:**

- Modify or create: `src/components/patterns/transit-map/LineTrack.tsx`

Renders a single food line (e.g., "Grains Line"):

- Stations laid out in `lineOrder` sequence
- Zone boundary markers (Zone 1 | Zone 2 | Zone 3)
- Visual connection between stations (the "track")
- Line progress indicator (how far along the user has tested)

### Task 2.3: Station Component

**Files:**

- Modify or create: `src/components/patterns/transit-map/StationNode.tsx`

Renders a single food station:

- Color-coded by status (green=safe, yellow=building, grey=untested, red=culprit)
- Name label (canonical food name)
- Trial count badge
- "In transit" pulse animation if food is currently being digested
- Tap handler → opens Station Inspector

### Task 2.4: Station Inspector (Detail Sheet)

**Files:**

- Create: `src/components/patterns/transit-map/StationInspector.tsx`

A bottom sheet or modal showing food detail:

- Food name + zone + line
- Evidence summary: trial count, avg Bristol score, transit time stats
- AI verdict (from Dr Poo assessments)
- Trial history list (last N transits with timestamps and outcomes)
- "Log this food" quick action

### Task 2.5: Wire into Patterns Page

**Files:**

- Modify: `src/pages/Patterns.tsx`

Replace the current transit map tab content with the new `TransitMapContainer`. Ensure the Database tab still works alongside it.

---

## Wave 3: Delete Mock Data and Legacy Components

### Task 3.1: Remove `transitData.ts`

**Files:**

- Delete: `src/data/transitData.ts`

Verify no remaining imports, then delete the mock data file.

### Task 3.2: Remove Legacy Transit Map Components

Delete any components from Wave 1 inventory that are purely mock-driven and have been replaced by Wave 2 production components.

### Task 3.3: Remove Dead Feature Flag

**Files:**

- Modify: `src/lib/featureFlags.ts`

Remove `transitMapV2: true` (WQ-147) — it's always true and the gate is dead. Remove all conditional checks that reference it.

### Task 3.4: Clean Up Imports

Search for any remaining imports of deleted files. Fix or remove.

### Task 3.5: Tests + Verification

Run `bun run test:unit` + `bun run typecheck` + `bun run build`.

Browser-verify the transit map renders with live data on the Patterns page.

Final commit.

---

## WORK-QUEUE Items Addressed

| WQ ID  | Item                                | Wave             |
| ------ | ----------------------------------- | ---------------- |
| WQ-147 | `transitMapV2` always true — remove | Wave 3           |
| WQ-039 | Pulse animation wrong origin        | Wave 2 (rebuilt) |
| WQ-040 | Non-null assertions on zones        | Wave 2 (rebuilt) |
| WQ-160 | Developer planning notes in UI      | Wave 3 (deleted) |


---

<a id="ref-3"></a>
# [3] Source: /Users/peterjamesblizzard/projects/caca_traca/docs/adrs/0002-food-registry-and-canonicalization.md
<!-- Lines:      289 | Included: full -->

# ADR-0002: Food Registry and Canonicalization System

## Status

**Accepted and implemented.** Registry, canonicalization, evidence pipeline, Convex migration, and server-side food pipeline are all complete. Transit map UI (Phase 5) continues separately.

Implementation history (phases 1-4, server pipeline, audit addenda) archived to `docs/archive/0002-implementation-log.md`.

## Context

The app tracks what a user eats and correlates food intake and lifestyle contributing factors with digestive
outcomes (Bristol Stool Scale, transit time, symptoms). For this to work,
multiple entries that represent the same food must be grouped under a single
**canonical name** — the tracking unit.

The legacy system had `foodCanonicalization.ts` with a hand-written
`CanonicalFood` union type and a flat array of regex rules. It had two
structural problems:

1. **Fine-grained canonicals that prevented trial accumulation.** "Scrambled
   egg", "poached egg", and "omelette" were all separate canonicals. A user
   who ate five different egg preparations would need 3–5 trials behind each
   one before the transit map showed anything meaningful. This was wrong:
   all no-added-fat egg preparations are digestively equivalent and should
   accumulate trials together under a single canonical `"egg"`.

2. **No single source of truth.** The `CanonicalFood` type, the `RULES` array,
   and the test fixtures were three separate places to maintain. Adding a food
   meant updating all three independently.

Additionally, the system had no concept of **dietary zones** — which foods are
safe for a post-anastomosis patient in week 1 vs week 8 vs long-term. The
transit map needed a clinical basis for zone assignment.

## Decision

### 1. A single food registry as the source of truth

`shared/foodRegistry.ts` defines every canonical food the system recognises.
All other food-related modules derive their data from this file. To add,
rename, or reclassify a food, only this file changes.

Each entry carries:

```typescript
interface FoodRegistryEntry {
  canonical: string; // the tracking unit
  zone: FoodZone; // 1 | 2 | 3
  subzone?: FoodSubzone; // "1A" | "1B" — only set for zone 1
  category: FoodCategory; // nutritional category (retained as secondary metadata)
  subcategory: FoodSubcategory;
  macros: ReadonlyArray<"protein" | "carbohydrate" | "fat">;
  osmoticEffect?: FoodRiskLevel;
  totalResidue?: FoodResidueLevel;
  fiberTotalApproxG?: number;
  fiberInsolubleLevel?: FoodRiskLevel;
  fiberSolubleLevel?: FoodRiskLevel;
  gasProducing?: FoodGasLevel;
  dryTexture?: FoodDryTextureLevel;
  irritantLoad?: FoodRiskLevel;
  highFatRisk?: FoodRiskLevel;
  lactoseRisk?: FoodRiskLevel;
  examples: ReadonlyArray<string>; // natural-language phrases → this canonical
  group: FoodGroup; // macronutrient group: "protein" | "carbs" | "fats" | "seasoning"
  line: FoodLine; // sub-line within group (e.g. "meat_fish", "grains", "dairy_fats")
  lineOrder: number; // suggested exploration order within the sub-line (1 = try first)
  notes?: string;
}
```

> **Phase 2.5 change (2026-03-12):** `line: TransitLine` was replaced with
> `group: FoodGroup` + `line: FoodLine`. The flat 7-value `TransitLine` type
> ("hub", "protein", "grain", etc.) was replaced with a two-level hierarchy:
> 4 macronutrient groups containing 11 sub-lines. See section 6 below.

### 2. Collapsed canonicals based on digestive equivalence

The canonical grouping principle is: **same digestive profile = same
canonical**. Preparation method is only a separate canonical when it
meaningfully changes the digestive load.

| User input         | Canonical                                              |
| ------------------ | ------------------------------------------------------ |
| "scrambled eggs"   | `"egg"`                                                |
| "six poached eggs" | `"egg"`                                                |
| "two egg omelette" | `"egg"`                                                |
| "fried egg"        | `"fried egg"` (added fat = different profile)          |
| "boiled chicken"   | `"boiled white meat"`                                  |
| "grilled chicken"  | `"grilled white meat"` (different zone, different fat) |

### 3. Three-zone model — clinical geography, not gates

Zone assignment is derived from post-anastomosis dietary guidelines (NHS
low-residue diet leaflets, UCSF ileostomy diet, Bowel Cancer Australia, Leeds
Teaching Hospitals). The zones:

- **Zone 1A** – Clear/full liquids. Immediate post-op.
- **Zone 1B** – Soft, low-residue solids. <2g fibre/serving. No skins, seeds,
  hulls, spice.
- **Zone 2** – Expanded but defensive. Peeled/well-cooked veg, more protein
  preparations, mild herbs/spices. No garlic, onion, chili, fried foods,
  legumes, raw salads.
- **Zone 3** – Everything else. Higher residue, stronger spice, fried foods,
  legumes, raw veg, fast food.

**Zones are suggested introduction order, not permission gates.**

A user can log and trial any food at any time, regardless of its zone. The zone
is metadata — it tells the transit map where a station sits on the network and
informs the suggested order of exploration. It does not restrict logging or
penalise choices.

The progression is non-linear by design. Some users tolerate Zone 2 foods
before fully exploring Zone 1. Some Zone 3 foods suit certain users better than
some Zone 2 foods, depending on individual physiology, lifestyle factors
(smoking, stimulants, exercise, stress), and gut state on any given day.

**The app records, correlates, and celebrates. It never blocks.**

The key rule for moving a food from Zone 3 → Zone 2 is **peeling + thorough
cooking**: many vegetables become low-residue once skin and seeds are removed
and the flesh is cooked soft. Zone membership is about the food's typical
digestive profile, not about where in their journey the user is.

### 4. Dual-path canonicalization

The system supports two resolution paths that share the same registry:

**Deterministic path** (`canonicalizeKnownFoodName` in
`shared/foodCanonicalization.ts`): builds a lookup map from every example string in
the registry → canonical. O(1) lookup after normalization. Returns
`string | null` — null means "not recognised, escalate to LLM".

**Food-parsing LLM path** (`src/lib/foodLlmCanonicalization.ts` for prompt
utilities, `convex/foodLlmMatching.ts` for runtime matching): the registry's
canonicals, examples, zones, and categories are formatted into the LLM system
prompt as a vocabulary table the model must select from. After the LLM responds,
`postProcessCanonical` resolves the result against the registry deterministically.
The model returns a canonical name or null.

**Dr. Poo report path** (`src/lib/aiAnalysis.ts` + `convex/extractInsightData.ts`):
the narrative report model does **not** receive a full registry dump. Instead,
it receives canonical hints from food-log items and the `foodTrialDatabase`.
The prompt now requires canonical food labels whenever available and requires
patient-facing food verdicts to be mirrored into structured `foodAssessments`.
The extractor also repairs partial reports by canonicalizing and splitting
combined labels such as `"toast / white bread"` into separate structured rows.

The return type `string | null` (replacing the previous `string` fallback) is
intentional: a null explicitly signals "pass to LLM", rather than silently
falling back to the raw input as a pseudo-canonical.

**2026-03-13 parser follow-up:** runtime food parsing is now
**deterministic-first, registry-first**. Simple known inputs are resolved
locally and only unresolved fragments are sent to GPT-5 mini. GPT is therefore
the fallback parser for unresolved or ambiguous input, not the primary parser.

### 5. Normalized alias injectivity

Normalized aliases must map to exactly one canonical.

The earlier first-match-wins behaviour was rejected because it silently hid
registry mistakes and produced wrong deterministic classifications when two
canonicals shared the same normalized alias. This was observed with collisions
including `"chili"`, `"rice cake"`, and `"mild herb"`.

The current rule is:

- Remove ambiguous duplicate aliases from the registry.
- Reject future duplicate normalized aliases at load/test time.
- Treat alias collisions as registry errors, not runtime tie-break cases.

### 6. Hierarchical food grouping — groups and sub-lines

> Added 2026-03-12 (Phase 2.5). Replaces the flat `TransitLine` model.

The transit map is not one big map of all foods. It is a **set of per-subcategory
line maps**. The user taps a food group (e.g. "Carbs") and sees multiple sub-lines.
They tap a specific sub-line (e.g. "Vegetables") and see that line's zone progression.

The data model is hierarchical: **Group → Line → Station**.

**4 macronutrient groups, 11 sub-lines:**

| Group         | Sub-lines                                    | Purpose                          |
| ------------- | -------------------------------------------- | -------------------------------- |
| **Protein**   | Meat & Fish, Eggs & Dairy, Vegetable Protein | Animal and plant protein sources |
| **Carbs**     | Grains, Vegetables, Fruit                    | Carbohydrate-dominant foods      |
| **Fats**      | Oils, Dairy Fats, Nuts & Seeds               | Fat-dominant foods               |
| **Seasoning** | Sauces & Condiments, Herbs & Spices          | Flavourings and aromatics        |

```typescript
type FoodGroup = "protein" | "carbs" | "fats" | "seasoning";

type FoodLine =
  | "meat_fish"
  | "eggs_dairy"
  | "vegetable_protein" // Protein
  | "grains"
  | "vegetables"
  | "fruit" // Carbs
  | "oils"
  | "dairy_fats"
  | "nuts_seeds" // Fats
  | "sauces_condiments"
  | "herbs_spices"; // Seasoning
```

**Key classification decisions:**

- **Garlic** → Herbs & Spices (Seasoning), not Vegetables. It is a herb.
- **Onion** → Vegetables (Carbs). It is a vegetable/salad item.
- **Dairy is split**: yogurt, cottage cheese, milk, kefir → Eggs & Dairy (Protein).
  Butter, cream, hard cheese, cream cheese, soft rind cheese → Dairy Fats (Fats).
- **Salad** is not a separate sub-line. Raw salad items are Zone 2–3 stations on the
  Vegetables line.
- **Avocado** → Nuts & Seeds (Fats).

**Liquids (Zone 1A)** — water, broth, juice, herbal tea, nutritional supplement —
are tracked in the app but **not mapped as stations** on the transit map. They are
the pre-map starting point that every anastomosis patient learns in hospital.
Milk and kefir are not liquids — they belong under Eggs & Dairy (Protein).

**Interchanges** are structural zone-boundary nodes on the visual map (Zone 1→2,
Zone 2→3). They are not food items and do not appear in the data model.

**Why this replaces the flat model:** The original `TransitLine` had 7 values
mixing macronutrient groups with subcategories ("protein" alongside "grain",
"vegetable", "fruit"). It also included "hub" for liquids that shouldn't be on
the map. The hierarchical model correctly separates the grouping level (what tab
the user sees) from the line level (what track they follow within that tab).

## Consequences

### Positive

- Adding a food requires one file change in one place.
- The LLM prompt vocabulary is always in sync with the deterministic rules.
- Trial data accumulates faster because preparations that are digestively
  equivalent are grouped.
- Zone assignment has a documented clinical basis.
- Known-food parsing is cheaper, faster, and more predictable because GPT is
  only used for unresolved fragments.
- Raw user-entered names can be preserved in logs/history while canonicals
  continue to power evidence and aggregation.

### Tradeoffs

- `CanonicalFood` is no longer a TypeScript union type (would require
  `as const` inference on a 100+ entry array). It is now `string` validated at
  runtime via `CANONICAL_FOOD_NAMES: ReadonlySet<string>`.
- `canonicalizeKnownFoodName` now returns `string | null` instead of `string`,
  which is a breaking change from the legacy API. Callers that relied on the
  old fallback-to-input behaviour need updating.
- Registry maintenance is stricter: duplicate normalized aliases now fail fast
  instead of being tolerated by ordering.

## Key Files

| File                                         | Purpose                                                                 |
| -------------------------------------------- | ----------------------------------------------------------------------- |
| `shared/foodRegistry.ts`                     | Single source of truth (all canonicals, zones, groups, lines, metadata) |
| `shared/foodCanonicalization.ts`             | Deterministic lookup from registry. Returns `string \| null`.           |
| `shared/foodNormalize.ts`                    | Text normalization utilities                                            |
| `shared/foodEvidence.ts`                     | Bayesian evidence pipeline (registry-aware)                             |
| `shared/foodParsing.ts`                      | Shared deterministic parsing utilities                                  |
| `convex/foodParsing.ts`                      | Server mutations (processLog, processEvidence, resolveItem)             |
| `convex/foodLlmMatching.ts`                  | LLM action with web search (fallback for unresolved food)               |
| `src/lib/foodLlmCanonicalization.ts`         | Builds LLM prompt vocabulary from registry                              |
| `src/components/track/FoodMatchingModal.tsx` | Manual user resolution UI                                               |
| `docs/research/food-zone-phase.md`           | Clinical research basis for zone assignments                            |

## Research Basis

Primary sources: NHS Trust low-residue and ileostomy diet leaflets (Leeds, UCSF, Torbay, Bowel Cancer Australia), PMC review on ileostomy dietary management (2025), Academy of Nutrition and Dietetics low-fibre handout (UPenn), FOWUSA diet guide. Full citations in `docs/research/food-zone-phase.md`.

## Current Architectural Understanding

The food system is:

- **Registry-first** for canonical food identity
- **Deterministic-first** for routine parsing and matching
- **LLM-assisted** only for unresolved or ambiguous food parsing
- **Prompt-constrained and extraction-repaired** for Dr. Poo report food verdicts
- **Canonical-internal but raw-name-preserving** where user-facing history benefits from the original phrasing

## Implementation History

Phases 1-4, server pipeline (11/11 tasks), verification audits, and addenda are archived in `docs/archive/0002-implementation-log.md`.


---

<a id="ref-4"></a>
# [4] Source: /Users/peterjamesblizzard/projects/caca_traca/docs/archive/scratchpadprompts/transitmap-summary.md
<!-- Lines: 634 | Included: L1-150, L400-550 -->

<!-- === Lines 1-150 === -->
# Caca Traca — Master Project Narrative

> Last updated: 2026-03-15
> Branch: `feature/v1-sprint` (off `master`)
> Purpose: Authoritative record of what was planned, what was built, where implementations diverged from specs, and what remains.

---

## Contents

1. [Product Context](#1-product-context)
2. [V1 Sprint — What Was Planned](#2-v1-sprint--what-was-planned)
3. [Food System — Phases 1–4 (Registry, Evidence, Convex)](#3-food-system--phases-14)
4. [Server-Side Food Pipeline (Phase 5 of food system)](#4-server-side-food-pipeline)
5. [Spec vs Reality — Where Implementations Diverged](#5-spec-vs-reality)
6. [ADR References](#6-adr-references)
7. [Browser Testing Session — Bugs Found and Fixed](#7-browser-testing-session)
8. [E2E Test Suite](#8-e2e-test-suite)
9. [What Remains](#9-what-remains)
10. [Phase 5 — Transit Map UI + Game Layer Rebuild](#10-phase-5--transit-map-ui--game-layer-rebuild)
11. [Architecture Summary](#11-architecture-summary)

---

## 1. Product Context

Caca Traca is an anastomosis food reintegration tracker for post-reconnective surgery. It logs food, fluid, habits, activities, and digestion events, then correlates them with digestive outcomes using Bristol Stool Scale ratings. The user is actively recovering from anastomosis surgery. The app is also being developed as a future product for others in the same situation.

**Core promise:** Help users understand food-to-bowel-movement transit timing and emerging patterns. Feel more trustworthy and coherent than existing tools.

**Non-negotiable constraints established early:**

- Raw log data (food entries, BM records, fluid logs, habit logs, timestamps) is sacred and must never be touched or transformed destructively.
- Dr. Poo conversation history and reports must be preserved.
- All legacy derived analytics (transit times, canonical groupings, zone assignments, food safety scores) were broken and can be deleted without concern.
- The legacy engine never produced usable results — no backwards compatibility shims needed.

---

## 2. V1 Sprint — What Was Planned

The `v1_sprint_tasks.md` documents 12 atomic tasks across 3 phases, all addressing issues found during initial browser testing.

### Phase 1 — Data Integrity (Tasks 1–6)

| Task | Issue                                                                        | Status       |
| ---- | ---------------------------------------------------------------------------- | ------------ |
| 1    | AI text pollution in food database (#91) — ~160 fake entries from AI reports | Open (BT-91) |
| 2    | Bristol classification wrong — majority-rules thresholds (#92)               | Open (BT-92) |
| 3    | Food deduplication — 199 foods should be ~40 (#27)                           | Open (BT-27) |
| 4    | Building evidence threshold — 21+ trial foods stuck in "building" (#87)      | Open (BT-87) |
| 5    | Food trial count merging — bread variants collapsed incorrectly (#86)        | Open (BT-86) |
| 6    | Status logic thresholds too aggressive (#28)                                 | Open (BT-28) |

### Phase 2 — Track Page Fixes (Tasks 7–9)

| Task | Issue                                                                                                                      | Status       |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 7    | Today log text overflow — expanded items push buttons off screen (#82)                                                     | Open (BT-82) |
| 8    | Date header duplication — global header + page header (#83)                                                                | Open (BT-83) |
| 9    | Batch of 5 small bugs: BM time layout, hero label overlap, Dr Poo archive link dup, "Last tested" column, alert badge size | Partial      |

### Phase 3 — Broken Track Features (Tasks 10–12)

| Task | Issue                                                            | Status       |
| ---- | ---------------------------------------------------------------- | ------------ |
| 10   | Revert fluids section to simple design (#6)                      | Open (BT-06) |
| 11   | Toast notifications — coloured backgrounds, stacking, undo (#45) | Open (BT-45) |
| 12   | Units consistency — fl oz not applied everywhere (#49)           | Open (BT-49) |

**Status as of 2026-03-15:** None of these 12 tasks have been implemented yet. The sprint was deprioritized in favour of completing the food system server-side pipeline first. These tasks remain valid and are documented in detail in `docs/v1_sprint_tasks.md`.

---

## 3. Food System — Phases 1–4

### Timeline

The food system rebuild ran from 2026-03-12 to 2026-03-14. It proceeded in 4+1 phases before the server-side pipeline.

### Phase 1 — Registry and Deterministic Canonicalization (2026-03-12)

**Problem:** The legacy system had fine-grained canonicals that prevented trial accumulation (scrambled egg, poached egg, omelette were all separate stations), no single source of truth, and no concept of dietary zones.

**What was built:**

- `shared/foodRegistry.ts` — single source of truth. 100 food entries, each with `canonical`, `zone`, `subzone`, `category`, `subcategory`, `macros`, `examples`, `group`, `line`, `lineOrder`, `notes`.
- `shared/foodCanonicalization.ts` — builds O(1) lookup map from examples → canonical. Returns `string | null`. `null` = pass to LLM.
- `shared/__tests__/foodCanonicalization.test.ts` — 30 tests.
- Collapsed canonicals: same digestive profile = same canonical. "scrambled eggs", "poached eggs", "omelette" all → `"egg"`. "boiled chicken" → `"boiled white meat"`.

**ADR:** `docs/adrs/0002-food-registry-and-canonicalization.md`

### Phase 2 — LLM Canonicalization and Legacy Cleanup (2026-03-12)

**What was built:**

- `src/lib/foodLlmCanonicalization.ts` — builds LLM prompt from registry vocabulary. `postProcessCanonical` resolves LLM output against registry deterministically.
- Registry updated with `line` (TransitLine) and `lineOrder` fields.
- `foodCategoryMapping.ts` created (then deleted in Phase 2.5).
- `foodParsing.ts` and `foodStatusThresholds.ts` updated.

### Phase 2.5 — Hierarchy Revision (2026-03-12)

**Problem:** The flat 7-value `TransitLine` type mixed macronutrient groups with subcategories. The user required a hierarchical Group → Line → Station model for the transit map.

**Hierarchy confirmed and signed off:**

```
PROTEIN  (3 lines): Meat & Fish, Eggs & Dairy, Vegetable Protein
CARBS    (3 lines): Grains, Vegetables, Fruit
FATS     (3 lines): Oils, Dairy Fats, Nuts & Seeds
SEASONING (2 lines): Sauces & Condiments, Herbs & Spices
```

4 groups, 11 sub-lines. Liquids tracked in app but NOT on transit map.

**Key classification decisions:**

- Garlic → Herbs & Spices (Seasoning). "Garlic is a herb."
- Onion → Vegetables (Carbs). "Onions are a vegetable."
- Milk and kefir → Eggs & Dairy (Protein). NOT liquids.
- Avocado → Nuts & Seeds (Fats).
- Dairy split: proteins (yogurt, cottage cheese, milk, kefir) → Protein; fats (butter, cream, cheese) → Fats.

**What was deleted:** 7 legacy files including `transitMapLayout.ts`, `pointsEngine.ts`, `StationDetailPanel.tsx`, `TransitMap.tsx` (old version), `TransitMapTest.tsx`, `foodCategoryMapping.ts`.

**Net result:** -1867 lines. 95 registry entries across 4 groups / 11 sub-lines. All consumers updated.

### Phase 3 — Evidence Pipeline Canonicalization (2026-03-12)

**Problem:** `buildFoodTrials` in `foodEvidence.ts` was using legacy `normalizeFoodName` instead of `canonicalizeKnownFoodName`. All Phase 1–2.5 work was bypassed at this boundary.

**What was fixed:**

1. `buildFoodTrials` and `normalizeAssessmentRecord` now use `canonicalizeKnownFoodName()` with `normalizeFoodName()` fallback.
2. `analysis.ts` BRAT baseline: `"plain white toast"` → `"toast"`.
3. `primaryStatusFromSignals` split: `posteriorSafety < 0.35 AND severeLowConfounderCount >= 2` → `"avoid"`. `posteriorSafety < 0.35 AND effectiveEvidence >= 3.0` → `"watch"`.
4. Dead correlation code deleted from `analysis.ts` (~480 lines total across two passes).

### Phase 4 — Convex Layer Migration (2026-03-13)

**Problem:** Three issues: (A) cross-boundary imports from `src/lib/` into Convex server files, (B) inconsistent normalization (3 different functions in the Convex layer), (C) game layer with wrong taxonomy and orphaned backend.

**Decision: Delete game layer entirely.** The game layer was built on the old 6-line/10-stage taxonomy with wrong canonical names. Phase 5 will rebuild from scratch.

**What was deleted:**

- 6 Convex game layer modules: `stationDefinitions.ts`, `ingredientTemplates.ts`, `trialSessions.ts`, `gameState.ts`, `data/ingredientTemplatesSeed.ts`, `trialSessions.test.ts`
- 4 game layer schema tables

[... lines omitted ...]

<!-- === Lines 400-550 === -->

### Key fixes made to get tests passing

- `button:text-matches('^Food')` selector fails on nested text → changed to `button:has-text("Food intake")`
- Data contamination — unique food names per test (zyphlox, worblex, grelpnik, frobnicator)
- `.last()` vs `.first()` for newest entry (DOM renders newest first)
- `waitForDots` scoped to specific entry, not page-global
- Weight/Sleep: Enter-to-save pattern (no Save button)
- "biscoff" is in registry (maps to "biscuit") — tests must use truly unknown words

### TDD feature implemented (partially)

The TDD test for food names in trial sub-rows drove implementation of:

- `foodName?`, `quantity?`, `unit?` fields on `LocalTrialRecord`
- `TrialHistorySubRow` renders `data-slot="trial-food-name"` and `data-slot="trial-quantity"`

One test still failing: quantity is not yet threaded from `ingredientExposures` through `FoodEvidenceTrial` → `LocalTrialRecord` → UI.

### No CI

No CI pipeline exists. Tests run manually with `bun run test` and `npx playwright test`. Setting up CI is a pre-merge blocker.

---

## 9. What Remains

Items are ordered by priority.

### Immediate (before next major feature)

**1. Food pipeline UI fixes (5 bugs)**
Plan exists: `docs/plans/2026-03-14-food-pipeline-ui-fixes.md`

| Task   | Description                                                                           |
| ------ | ------------------------------------------------------------------------------------- |
| Task 1 | Fix `resolveItem` to allow re-matching expired items — **DONE**                       |
| Task 2 | `backfillResolvedBy` migration for legacy food logs — **implemented but must be run** |
| Task 3 | Fix display names to use `parsedName` instead of `userSegment` — **DONE**             |
| Task 4 | Verify Patterns table uses canonical name — **DONE (follows from Task 3)**            |
| Task 5 | Queue-based `FoodMatchingModal` — **DONE**                                            |
| Task 6 | Wire "Review" toast to queue modal — **DONE**                                         |

**2. Registry gap audit**
Common standalone words not in registry as examples: `chicken` (standalone), `pasta`, `bread`, `fish`, `beef`, etc. A systematic audit would improve deterministic resolution rates and reduce LLM calls. Items to check are documented in the E2E session notes.

**3. Pill/tag input for food entry (UX)**
Users enter ingredient lists without commas. The entire string becomes one food item. Solution: pill/tag input where typing `food, ` converts the segment to a visual pill. Each pill deletable. Comma or pause = pill boundary. This is the most critical UX improvement identified in browser testing.

**4. Quantity threading in trial pipeline**
`quantity`/`unit` from `ingredientExposures` is not yet threaded through `FoodEvidenceTrial` → `LocalTrialRecord` → `TrialHistorySubRow`. One TDD test is still failing because of this.

**5. CI pipeline setup**
No CI exists. This is a pre-merge blocker for `feature/v1-sprint` → `master`.

**6. #80 OpenAI prompt management (SHIP BLOCKER)**
Requires OpenAI dashboard setup, not just code. The API key architecture and prompt versioning strategy (`docs/prompts/v3-strategy.md`) need to be finalized.

**7. Food request persistence**
The `FoodMatchingModal` "Submit food request" path currently does nothing. Needs either: a Convex mutation to store requests, or a feedback mechanism to notify developers.

### V1 Sprint Tasks (deferred from original plan)

All 12 tasks in `docs/v1_sprint_tasks.md` are still open — data integrity fixes (Phase 1), Track page fixes (Phase 2), broken features (Phase 3). These should be addressed before public release.

**Most critical from that list:**

- BT-91: AI text stored as food (data corruption)
- BT-92: Bristol classification wrong (data correctness)
- BT-87: Building evidence threshold (foods stuck in "building")

### Remaining Technical Debt

**High priority:**

- `TD-01`: `buildFoodEvidenceResult` runs in both client and Convex backend — should be server-only.
- `PERF-001`: `analyzeLogs` called independently in Patterns and Menu — lift to shared context.

**Medium priority (7 open items):**

- `TD-05`: O(n²) weekly digest
- `TD-07`: Bayesian run-once optimization
- `TD-08`: Zone type duplication (`Zone` in `foodStatusThresholds.ts` duplicates `FoodZone` from registry)
- `TD-09`: Stale comments referencing deleted files
- `TD-10`: `existingNames` in food parsing may cause LLM to prefer library names over registry canonicals
- `TD-11`: Transit map feature flag orphaned (`transitMapV2: true` remains)
- `TD-12`: `aiAnalysis.ts` is large and could benefit from decomposition

---

## 10. Phase 5 — Transit Map UI + Game Layer Rebuild

**Status:** Data foundation complete. UI not yet built.

### What exists

- `src/types/transitMap.ts` — complete type hierarchy (`TransitStation`, `TransitLine`, `TransitCorridor`, `TransitNetwork`) + helper functions
- `src/hooks/useTransitMapData.ts` — `useTransitMapData(foodStats)` returns a fully populated `TransitNetwork` from registry + evidence
- 16 passing tests for the data hook

### What the UI needs to build on top of

The hook provides:

1. `network.corridors` — iterate for 4 corridor cards (Protein, Carbs, Fats, Seasoning)
2. `corridor.lines` — iterate for line-level views
3. `line.stations` — iterate for individual food stations
4. `line.nextStop` / `corridor.nextStop` — evidence-backed "next station to try"
5. `network.stationsByCanonical` — O(1) deep linking from Dr. Poo / Menu
6. `stationSignalFromStatus(station.primaryStatus)` — green/amber/red/blue/grey
7. `serviceRecord(station)` — "6 transits — 4 on time, 1 delayed, 1 express"
8. `confidenceLabel(station.confidence)` — "Strong signal" / "More transits needed"
9. `tendencyLabel(station.tendency)` — "On time" / "Express" / "Delayed"

### Planned UI (3 zoom levels)

**Zoom out: Corridor cards**
4 cards, each showing: coloured tracks, progress fill (tested/untested), summary stats, next stop.

**Default: Corridor detail**
All lines in a group visible with station dots.

**Zoom in: Line detail**
Single sub-line. Zone-by-zone station layout. Station Inspector panel. Pan/zoom via `react-zoom-pan-pinch`.

### Station Inspector (progressive disclosure)

- Level 1: Station name, signal colour, line & zone, food artwork
- Level 2: Timetable (avg transit), service record, tendency, confidence, AI assessment
- Level 3: Next stop, alternative routes, explore options, change tracks

### Transit-themed vocabulary (confirmed)

| Concept          | UI label     |
| ---------------- | ------------ |
| Tendency: loose  | Express      |
| Tendency: normal | On time      |
| Tendency: hard   | Delayed      |
| Trial count      | "6 transits" |
| Food group       | Corridor     |
| Sub-line         | Line         |
| Zone boundary    | Interchange  |

### Artwork

30 PNGs exist in `src/assets/transit-map/`. 46 of 95 foods have no artwork. All images need re-export with `#1e293b` (Tailwind slate-800) circle background. Source images in `images/` at repo root.

### Deferred to Phase 5+

- Registry CRUD (create, edit, delete custom entries)
- Manual food matching UI for unmatched foods

[... lines omitted ...]


---

<a id="ref-5"></a>
# [5] Source: /Users/peterjamesblizzard/projects/caca_traca/docs/archive/scratchpadprompts/transit-map-and-reward-model.md
<!-- Lines:      170 | Included: full -->

# Transit Map & Reward Model — Current State

**Date:** 2026-03-12
**Status:** Registry hierarchy implemented. Transit map UI deleted. Reward system not implemented.
**Related:** [ADR-0002](../adrs/0002-food-registry-and-canonicalization.md), [Food System Rebuild](./food-system-rebuild.md)
**Archived version:** [archive/transit-map-and-reward-model.md](./archive/transit-map-and-reward-model.md)

---

## What exists in code

### Registry hierarchy (implemented in Phase 2.5)

The food registry (`src/lib/foodRegistry.ts`) implements a 4-group / 11-line hierarchy with 95 total stations (canonical foods).

Each `FoodRegistryEntry` has:

- `group: FoodGroup` — macronutrient group
- `line: FoodLine` — sub-line within the group
- `lineOrder: number` — suggested exploration order (1 = try first)

### Groups, lines, and actual station counts

| Group         | Line              | Stations | Display Name        |
| ------------- | ----------------- | -------- | ------------------- |
| **Protein**   | meat_fish         | 12       | Meat & Fish         |
|               | eggs_dairy        | 6        | Eggs & Dairy        |
|               | vegetable_protein | 1        | Vegetable Protein   |
| **Carbs**     | grains            | 13       | Grains              |
|               | vegetables        | 23       | Vegetables          |
|               | fruit             | 13       | Fruit               |
| **Fats**      | oils              | 3        | Oils                |
|               | dairy_fats        | 7        | Dairy Fats          |
|               | nuts_seeds        | 4        | Nuts & Seeds        |
| **Seasoning** | sauces_condiments | 6        | Sauces & Condiments |
|               | herbs_spices      | 7        | Herbs & Spices      |

**Group totals:** Protein 19, Carbs 49, Fats 14, Seasoning 13.

Station distribution is uneven. Vegetables alone has 23 stations. Vegetable Protein has 1 (legumes only). Several lines have fewer than 7 stations. This is the actual registry — the UI will need to handle variable line lengths.

### Types

```typescript
type FoodGroup = "protein" | "carbs" | "fats" | "seasoning";

type FoodLine =
  | "meat_fish"
  | "eggs_dairy"
  | "vegetable_protein"
  | "grains"
  | "vegetables"
  | "fruit"
  | "oils"
  | "dairy_fats"
  | "nuts_seeds"
  | "sauces_condiments"
  | "herbs_spices";
```

### Helper functions (available now)

Defined in `foodRegistry.ts`, re-exported from `foodCanonicalization.ts`:

- `getFoodGroup(canonical)` — returns `FoodGroup | undefined`
- `getFoodLine(canonical)` — returns `FoodLine | undefined`
- `getFoodsByLine(line)` — returns entries sorted by `lineOrder`
- `getLinesByGroup(group)` — returns all sub-lines for a group
- `getLineDisplayName(line)` — returns human-readable name (e.g. "Meat & Fish")
- `getGroupDisplayName(group)` — returns human-readable name (e.g. "Protein")

Constants:

- `FOOD_GROUPS` — all four `FoodGroup` values
- `FOOD_LINES` — all eleven `FoodLine` values

### Key classification decisions

- **Garlic** — herbs_spices (Seasoning), not vegetables
- **Onion** — vegetables (Carbs), not seasoning
- **Dairy split**: yogurt, egg, milk, cottage cheese, kefir, fried egg in eggs_dairy (Protein). Butter, cream cheese, hard cheese, cream, ice cream, soft rind cheese, double cream in dairy_fats (Fats).
- **Avocado** — nuts_seeds (Fats)
- **Raw salad** — vegetables (Carbs), Zone 3 only

### Zone 1A entries (liquids)

The registry has only 2 Zone 1A entries: `clear broth` and `smooth soup`. Other recovery liquids (water, juice, herbal tea) are not registry entries and do not have stations. They may be tracked in the app's fluid logging but are outside the transit map's station model.

---

## What does NOT exist in code

### Transit map UI — deleted, to be rebuilt in Phase 5

The legacy transit map UI (`TransitMap.tsx`, `StationDetailPanel.tsx`, `TransitMapTest.tsx`, `transitMapLayout.ts`, `pointsEngine.ts`) was deleted in Phase 2.5. Source files are gone. A stale dist artifact (`dist/assets/TransitMapTest-D4XZXwZk.js`) remains but is non-functional. `Patterns.tsx` has a no-op `handleViewOnMap` placeholder.

The transit map will be rebuilt from scratch in Phase 5 using the registry hierarchy and real Convex data.

### Station status model — design only

No station status tracking exists in code. The intended model:

| Colour             | Meaning                                                                       |
| ------------------ | ----------------------------------------------------------------------------- |
| Grey               | Never trialled. Station not yet visited.                                      |
| Blue               | Trialling — fewer than the minimum resolved trials. Still gathering evidence. |
| Green              | Safe. Consistently good outcomes across trials.                               |
| Green (teal)       | Safe-loose. Good outcomes but tends toward loose stools.                      |
| Green (amber tint) | Safe-hard. Good outcomes but tends toward firm/hard.                          |
| Amber / Orange     | Watch. One or more concerning outcomes. More trials needed.                   |
| Red                | Avoid. Consistent bad outcomes. Strong evidence against.                      |

Station status will be derived from the evidence pipeline (Phase 3) once it produces real verdicts.

### Reward / milestone system — design only

No celebration or milestone logic exists. The intended triggers:

| Milestone                                              | Celebration reason                           |
| ------------------------------------------------------ | -------------------------------------------- |
| First food logged ever                                 | Starting the journey                         |
| First food trialled (resolved)                         | First completed experiment                   |
| Zone 1 complete on a sub-line                          | Explored the safe core for this food type    |
| 5 stations green                                       | Building a safe menu                         |
| 10 stations any status                                 | Active explorer                              |
| First station turned red / avoid                       | Detective work done. You know what to avoid. |
| First station turned orange / watch                    | Suspicious! More trials needed.              |
| First station cleared (orange -> green)                | Vindicated! It was fine after all.           |
| All sub-lines in a group have Zone 1 stations visited  | Group foundations complete                   |
| Full sub-line complete (all zones visited)             | Sub-line mastered                            |
| First Zone 3 station trialled                          | Adventurous                                  |
| Longest trial streak (N consecutive days with a trial) | Consistent                                   |

---

## Design intent (not yet implemented)

### The transit map metaphor

The transit map is a **historical record of where the user has been**, not a live journey or a progress gate. Each station is a canonical food. Its zone determines position (Zone 1 = safe core, Zone 2 = expanded, Zone 3 = experimental). Its status colour updates as evidence accumulates.

- Not a live journey indicator — no "you are here" pin
- Not a progression lock — Zone 3 is visible from day one
- Not punitive — no warnings, blocks, or shame

### Per-line visual structure (concept)

Each sub-line view would show:

- **Zone 1**: Single track, safest preparations
- **Interchange node**: Zone boundary (structural, not a food)
- **Zone 2**: Track splits into branches, more adventurous preparations
- **Zone 3**: Fewer stations, experimental foods, "and beyond" arrows

Note: with actual station counts ranging from 1 to 23, the UI will need to adapt to variable line lengths rather than assuming uniform 10-15 stations per line.

### Reward design principles

- A red station is not a failure — it is valuable information. Celebrate it.
- Negative discoveries deserve the same celebration as positive ones.
- No punishment for eating anything.
- Small wins matter — frequent, low-threshold rewards for ADHD users.
- Celebrations fire on information gain, not compliance.

---

## Build order

1. **Phase 5**: Transit map UI — rebuilt from scratch using registry hierarchy and real data
2. **Phase 5+**: Reward/milestone system — wired to station status changes


---

<a id="ref-6"></a>
# [6] Source: /Users/peterjamesblizzard/.claude/projects/-Users-peterjamesblizzard-projects-caca-traca/memory/project_transit_map_explorer_model.md
<!-- Lines:       27 | Included: full -->

---
name: project_transit_map_explorer_model
description: Transit map is an explorer's map of visited/unvisited foods, NOT a linear journey — zones are progression gates, lines are categories
type: project
---

The transit map is an **explorer's map**, not a journey/route.

- **Zones** (1, 2, 3) are the real progression structure. Within a zone, the user can try ANY food freely.
- **Lines** (Meat & Fish, Grains, etc.) are organizational categories, NOT sequential routes. There is no prescribed order within a line.
- **Stations** show where you've been (tested, with evidence color) vs. where you haven't (unvisited). Like marking destinations on a map.
- "Next food" is about what's available in the user's current zone across all lines, not the "next stop on this track."
- The app does NOT block the user from trying anything — it tracks and informs, never gates (per no-judgment principle).

**Why:** The linear journey metaphor implies "follow the track A → B → C" which is wrong. Users can try any Zone 1 protein, any Zone 1 carb, etc. in any order. The map shows exploration progress, not route progress.

**How to apply:** Don't use "next stop" language implying sequence. Use "unexplored" vs "visited" language. Zone boundaries are the meaningful transitions, not station order within a line.

**Zoom-based navigation (Google Maps style):**

- Zoom out: Radial overview showing all 4 corridors with representative stations only
- Zoom in once: Corridor view (e.g., all protein lines with representative stations)
- Zoom in again: Line view (all stations on that line)

Higher zoom levels show example stations, not all 95. Only the line-level view shows every station.

**Reference image:** NotebookLM-generated radial concentric map (user has screenshot). 3 concentric rings (zones), 4 corridor sectors, lines as tracks radiating from center.


---

<a id="ref-7"></a>
# [7] Source: /Users/peterjamesblizzard/.claude/projects/-Users-peterjamesblizzard-projects-caca-traca/memory/project_transit_map_zoom_levels.md
<!-- Lines:       18 | Included: full -->

---
name: project_transit_map_zoom_levels
description: Transit map has 4 zoom levels with animated step-zoom — radial overview → corridor → line → station focus (never overlay/obstruct the map)
type: project
---

Four zoom levels with animated step-zoom transitions:

1. **Radial overview** — all 4 corridors, representative stations only, concentric zone rings
2. **Corridor** — one corridor's lines (e.g., all protein lines), representative stations
3. **Line** — all stations on one line (e.g., Meat & Fish), full detail
4. **Station focus** — 3-4 neighboring stations shown on one side, station inspector detail on the other side

**Key rule:** The inspector NEVER overlays or obstructs the map. At station-focus level, the layout splits: map neighborhood on one side, detail on the other.

**Why:** The map is the primary visual. Overlaying sheets/drawers hides context. The zoom-to-focus pattern keeps the map visible and adds detail alongside it.

**How to apply:** Use side-by-side layout at station-focus level. Animated transitions between all levels. Back/breadcrumb to zoom out. Click-to-zoom in (tap corridor → tap line → tap station).


---

<a id="ref-8"></a>
# [8] Source: /Users/peterjamesblizzard/.claude/projects/-Users-peterjamesblizzard-projects-caca-traca/memory/feedback_transit_map_organic_layout.md
<!-- Lines:       11 | Included: full -->

---
name: feedback_transit_map_organic_layout
description: Transit map layout must be organic/messy like real transit maps, NOT symmetric grids or equal quadrants
type: feedback
---

The transit map layout must feel like a real transit map (London Underground style) — organic, asymmetric, with lines of different lengths and branches. NOT a pie chart, NOT equal quadrants, NOT a grid.

**Why:** Real maps are messy. Lines have different numbers of stations, different branch structures. Seasoning has 2 lines, Protein has 3. Some lines branch, some don't. Forcing symmetry makes it look like a data visualization, not a map. The user explicitly rejected equal sectors and proportional sectors.

**How to apply:** Each line should have its own natural geometry based on its actual station count and zone structure. Lines curve, bend, and overlap. The concentric zone rings provide structural scaffolding, but the lines within them are organic. Think London Underground, not Barcelona grid.


---

<a id="ref-9"></a>
# [9] Source: /Users/peterjamesblizzard/.claude/projects/-Users-peterjamesblizzard-projects-caca-traca/memory/project_transit_map_zone3_minimal.md
<!-- Lines:       16 | Included: full -->

---
name: project_transit_map_zone3_minimal
description: Transit map focuses on Zones 1A/1B/2 — Zone 3 is minimal (3-4 stations max per line, not useful for generalizing)
type: project
---

The transit map's real value is Zones 1A, 1B, and 2. Zone 3 is almost a non-starter for the map visual.

- **Zone 1A** (liquids/broths) — center of the radial map, starting point
- **Zone 1B** (soft solids) — first ring out
- **Zone 2** (extended network) — second ring, most interesting exploration happens here
- **Zone 3** — 3-4 representative stations max per line, possibly clustered as a branch. Not the map's focus.

**Why:** Zone 3 foods are too varied to make meaningful generalizations. Eating one spicy chili 3 times doesn't mean all spicy food is tolerable. The map can't make those judgments. For Zone 3, the database view and tracker are more useful than the map.

**How to apply:** Design the map geometry around Zones 1A/1B/2. Zone 3 gets a visual representation (small branches at the edges) but doesn't get detailed layout attention. Don't spend design effort on Zone 3 station placement.


---

<a id="ref-10"></a>
# [10] Source: /Users/peterjamesblizzard/projects/caca_traca/src/types/transitMap.ts
<!-- Lines:      208 | Included: full -->

/**
 * Transit Map data model — built from registry + evidence pipeline.
 *
 * This replaces the hardcoded transitData.ts model. Every type here is
 * derived from the canonical food registry and the Bayesian evidence
 * pipeline. No hardcoded station statuses, no parallel taxonomy.
 *
 * Hierarchy: Corridor (FoodGroup) → Line (FoodLine) → Station (FoodRegistryEntry + evidence)
 */

import type {
  FoodDigestionMetadata,
  FoodGroup,
  FoodLine,
  FoodSubzone,
  FoodZone,
} from "@shared/foodRegistry";
import type { FoodPrimaryStatus, FoodTendency } from "@shared/foodTypes";

// ── Station (one canonical food with evidence) ────────────────────────────

export interface TransitStation {
  /** Registry canonical name — unique station ID. */
  canonical: string;
  /** Human display name (title-cased canonical). */
  displayName: string;
  /** Zone: 1 (safe start), 2 (expanded), 3 (experimental). */
  zone: FoodZone;
  /** Subzone for Zone 1 entries: 1A (liquids) or 1B (soft solids). */
  subzone: FoodSubzone | undefined;
  /** Position within the line (1 = try first). */
  lineOrder: number;
  /** Registry notes — digestive distinction context. */
  notes: string | undefined;
  /** Shared digestion metadata from the registry. */
  digestion: FoodDigestionMetadata | null;

  // ── Evidence (null = untested) ──────────────────────────────────────────

  /** Bayesian primary status. null = no evidence yet. */
  primaryStatus: FoodPrimaryStatus | null;
  /** Tendency: neutral/loose/hard. null = no evidence. */
  tendency: FoodTendency | null;
  /** Total trial count (all-time). */
  totalTrials: number;
  /** Resolved transit count. */
  resolvedTransits: number;
  /** Average transit time in minutes. null = no resolved transits. */
  avgTransitMinutes: number | null;
  /** Bayesian confidence (0-1). null = untested. */
  confidence: number | null;
  /** Bristol score breakdown: { 3: 5, 4: 8, 6: 2 }. Empty = untested. */
  bristolBreakdown: Record<number, number>;
  /** Latest AI verdict if any. */
  latestAiVerdict: string | null;
  /** Latest AI reasoning if any. */
  latestAiReasoning: string | null;
  /** Timestamp of most recent trial. 0 = never tested. */
  lastTrialAt: number;
  /** Timestamp of first trial. 0 = never tested. */
  firstSeenAt: number;
}

// ── Signal colour (derived from primaryStatus) ───────────────────────────

export type StationSignal = "green" | "amber" | "red" | "blue" | "grey";

export function stationSignalFromStatus(status: FoodPrimaryStatus | null): StationSignal {
  switch (status) {
    case "safe":
      return "green";
    case "building":
      return "blue";
    case "watch":
      return "amber";
    case "avoid":
      return "red";
    case null:
      return "grey";
  }
}

// ── Tendency labels (transit-themed) ─────────────────────────────────────

export type TendencyLabel = "On time" | "Express" | "Delayed";

export function tendencyLabel(tendency: FoodTendency | null): TendencyLabel | null {
  switch (tendency) {
    case "neutral":
      return "On time";
    case "loose":
      return "Express";
    case "hard":
      return "Delayed";
    case null:
      return null;
  }
}

// ── Confidence labels ────────────────────────────────────────────────────

export function confidenceLabel(confidence: number | null): string {
  if (confidence === null || confidence === 0) return "Untested";
  if (confidence < 0.3) return "More transits needed";
  if (confidence < 0.6) return "Building signal";
  return "Strong signal";
}

// ── Service record (summary string) ──────────────────────────────────────

export function serviceRecord(station: TransitStation): string | null {
  if (station.resolvedTransits === 0) return null;

  const parts: string[] = [];
  const good = station.bristolBreakdown
    ? Object.entries(station.bristolBreakdown)
        .filter(([code]) => {
          const n = Number(code);
          return n >= 3 && n <= 5;
        })
        .reduce((sum, [, count]) => sum + count, 0)
    : 0;

  const loose = station.bristolBreakdown
    ? Object.entries(station.bristolBreakdown)
        .filter(([code]) => Number(code) === 6)
        .reduce((sum, [, count]) => sum + count, 0)
    : 0;

  const hard = station.bristolBreakdown
    ? Object.entries(station.bristolBreakdown)
        .filter(([code]) => {
          const n = Number(code);
          return n <= 2;
        })
        .reduce((sum, [, count]) => sum + count, 0)
    : 0;

  const bad = station.bristolBreakdown
    ? Object.entries(station.bristolBreakdown)
        .filter(([code]) => Number(code) >= 7)
        .reduce((sum, [, count]) => sum + count, 0)
    : 0;

  const total = station.resolvedTransits;
  parts.push(`${total} transit${total === 1 ? "" : "s"}`);

  const details: string[] = [];
  if (good > 0) details.push(`${good} on time`);
  if (hard > 0) details.push(`${hard} delayed`);
  if (loose > 0) details.push(`${loose} express`);
  if (bad > 0) details.push(`${bad} cancelled`);

  if (details.length > 0) {
    parts.push(details.join(", "));
  }

  return parts.join(" — ");
}

// ── Line (sub-line within a corridor) ────────────────────────────────────

export interface TransitLine {
  /** FoodLine key (e.g., "meat_fish"). */
  line: FoodLine;
  /** Human display name (e.g., "Meat & Fish"). */
  displayName: string;
  /** Stations sorted by lineOrder. */
  stations: TransitStation[];
  /** Summary: total stations tested / total stations. */
  testedCount: number;
  /** Summary: total stations on this line. */
  totalCount: number;
  /** Next suggested station to try (first untested/building by lineOrder). */
  nextStop: TransitStation | null;
}

// ── Corridor (food group) ────────────────────────────────────────────────

export interface TransitCorridor {
  /** FoodGroup key (e.g., "protein"). */
  group: FoodGroup;
  /** Human display name (e.g., "Protein Corridor"). */
  displayName: string;
  /** Lines within this corridor. */
  lines: TransitLine[];
  /** Summary: total stations tested across all lines. */
  testedCount: number;
  /** Summary: total stations across all lines. */
  totalCount: number;
  /** Next suggested station across all lines in this corridor. */
  nextStop: TransitStation | null;
}

// ── Full network ─────────────────────────────────────────────────────────

export interface TransitNetwork {
  /** All 4 corridors. */
  corridors: TransitCorridor[];
  /** Total stations in the network. */
  totalStations: number;
  /** Total stations with at least one trial. */
  testedStations: number;
  /** Flat lookup: canonical → station (for deep linking). */
  stationsByCanonical: Map<string, TransitStation>;
  /** Flat lookup: canonical → { corridor, line } (for navigation). */
  stationLocation: Map<string, { corridor: TransitCorridor; line: TransitLine }>;
}


---

<a id="ref-11"></a>
# [11] Source: /Users/peterjamesblizzard/projects/caca_traca/shared/foodRegistry.ts
<!-- Lines: 4056 | Included: L1-133, L3920-4056 -->

<!-- === Lines 1-133 === -->
/**
 * Food Registry — the single source of truth for all canonical foods.
 *
 * Every canonical food in this app is defined here. Both the deterministic
 * canonicalization function and the LLM canonicalization prompt are derived
 * from this registry. To add, rename, or reclassify a food, edit this file only.
 *
 * Zone model (metro map metaphor):
 *   Zone 1A  – Clear and full liquids. Immediate post-op recovery.
 *   Zone 1B  – Soft, low-residue solids. First solid foods post-surgery.
 *   Zone 2   – Expanded but still defensive diet. More variety, mild herbs,
 *              more protein preparations, peeled/well-cooked veg. Still no
 *              garlic, onion, chili, fried foods, legumes, or raw salads.
 *   Zone 3   – Experimental. Anything outside Zones 1–2. Introduce one at a
 *              time only when stable on a Zone 2 baseline.
 *
 * Hierarchy:
 *   4 groups (protein, carbs, fats, seasoning) → 11 sub-lines.
 *   Every entry has a required group + line assignment.
 *
 * Clinical basis: <2 g fibre per serving for Zones 1–2; no skins/seeds/hulls;
 * no strong spices. Sources: NHS low-residue diet leaflets, UCSF ileostomy
 * diet, Bowel Cancer Australia, Leeds Teaching Hospitals ileostomy guide.
 */

export type FoodZone = 1 | 2 | 3;
export type FoodSubzone = "1A" | "1B";

const FOOD_GROUP_LINES = {
  protein: ["meat_fish", "eggs_dairy", "vegetable_protein"],
  carbs: ["grains", "vegetables", "fruit"],
  fats: ["oils", "dairy_fats", "nuts_seeds"],
  seasoning: ["sauces_condiments", "herbs_spices"],
} as const;

export type FoodGroup = keyof typeof FOOD_GROUP_LINES;
export type FoodLine = (typeof FOOD_GROUP_LINES)[FoodGroup][number];

export type FoodCategory =
  | "protein"
  | "carbohydrate"
  | "fat"
  | "dairy"
  | "condiment"
  | "drink";

export type FoodSubcategory =
  | "meat"
  | "fish"
  | "egg"
  | "legume"
  | "grain"
  | "vegetable"
  | "fruit"
  | "oil"
  | "butter_cream"
  | "nut_seed"
  | "milk_yogurt"
  | "cheese"
  | "dessert"
  | "herb"
  | "spice"
  | "sauce"
  | "thickener"
  | "seasoning"
  | "irritant"
  | "processed"
  | "sugar"
  | "broth";

export type FoodRiskLevel =
  | "none"
  | "low"
  | "low_moderate"
  | "moderate"
  | "moderate_high"
  | "high";

export type FoodResidueLevel =
  | "very_low"
  | "low"
  | "low_moderate"
  | "moderate"
  | "high";

export type FoodGasLevel = "no" | "possible" | "yes";
export type FoodDryTextureLevel = "no" | "low" | "yes";

export interface FoodDigestionMetadata {
  osmoticEffect?: FoodRiskLevel;
  totalResidue?: FoodResidueLevel;
  fiberTotalApproxG?: number;
  fiberInsolubleLevel?: FoodRiskLevel;
  fiberSolubleLevel?: FoodRiskLevel;
  gasProducing?: FoodGasLevel;
  dryTexture?: FoodDryTextureLevel;
  irritantLoad?: FoodRiskLevel;
  highFatRisk?: FoodRiskLevel;
  lactoseRisk?: FoodRiskLevel;
}

interface FoodRegistryEntryBase extends FoodDigestionMetadata {
  /** The tracking unit. This is what the transit map and trial system use. */
  canonical: string;
  zone: FoodZone;
  /** Only set for zone 1 entries: 1A = liquids, 1B = soft solids. */
  subzone?: FoodSubzone;
  category: FoodCategory;
  subcategory: FoodSubcategory;
  /** Primary macronutrients. Dual-role foods (dairy, legumes) list more than one. */
  macros: ReadonlyArray<"protein" | "carbohydrate" | "fat">;
  /**
   * Natural-language phrases a user might type that map to this canonical.
   * Used both for deterministic lookup (after normalization) and as LLM context.
   */
  examples: ReadonlyArray<string>;
  /** Macronutrient group for transit map display. */
  group: FoodGroup;
  /** Sub-line within the group. */
  line: FoodLine;
  /** Suggested exploration order within the sub-line (1 = try first). */
  lineOrder: number;
  /** Why this canonical is distinct — fed to the LLM as context. */
  notes?: string;
}

export type FoodRegistryEntry = {
  [Group in FoodGroup]: FoodRegistryEntryBase & {
    group: Group;
    line: (typeof FOOD_GROUP_LINES)[Group][number];
  };
}[FoodGroup];


[... lines omitted ...]

<!-- === Lines 3920-4056 === -->
assertFoodRegistryInvariants(FOOD_REGISTRY);

/**
 * All canonical food names as a Set for O(1) membership checks.
 */
export const CANONICAL_FOOD_NAMES: ReadonlySet<string> = new Set(
  FOOD_REGISTRY.map((e) => e.canonical),
);

/**
 * O(1) lookup map from canonical name to registry entry.
 * Built once at module load.
 */
const FOOD_ENTRY_MAP: ReadonlyMap<string, FoodRegistryEntry> = new Map(
  FOOD_REGISTRY.map((e) => [e.canonical, e]),
);

export function pickFoodDigestionMetadata(
  source: FoodDigestionMetadata,
): FoodDigestionMetadata | undefined {
  const metadata: FoodDigestionMetadata = {
    ...(source.osmoticEffect !== undefined && {
      osmoticEffect: source.osmoticEffect,
    }),
    ...(source.totalResidue !== undefined && {
      totalResidue: source.totalResidue,
    }),
    ...(source.fiberTotalApproxG !== undefined && {
      fiberTotalApproxG: source.fiberTotalApproxG,
    }),
    ...(source.fiberInsolubleLevel !== undefined && {
      fiberInsolubleLevel: source.fiberInsolubleLevel,
    }),
    ...(source.fiberSolubleLevel !== undefined && {
      fiberSolubleLevel: source.fiberSolubleLevel,
    }),
    ...(source.gasProducing !== undefined && {
      gasProducing: source.gasProducing,
    }),
    ...(source.dryTexture !== undefined && {
      dryTexture: source.dryTexture,
    }),
    ...(source.irritantLoad !== undefined && {
      irritantLoad: source.irritantLoad,
    }),
    ...(source.highFatRisk !== undefined && {
      highFatRisk: source.highFatRisk,
    }),
    ...(source.lactoseRisk !== undefined && {
      lactoseRisk: source.lactoseRisk,
    }),
  };

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

export function isCanonicalFood(name: string): boolean {
  return CANONICAL_FOOD_NAMES.has(name);
}

export function getFoodEntry(canonical: string): FoodRegistryEntry | undefined {
  return FOOD_ENTRY_MAP.get(canonical);
}

export function getFoodDigestionMetadata(
  canonical: string,
): FoodDigestionMetadata | undefined {
  const entry = getFoodEntry(canonical);
  return entry ? pickFoodDigestionMetadata(entry) : undefined;
}

export function getFoodZone(canonical: string): FoodZone | undefined {
  return getFoodEntry(canonical)?.zone;
}

export function getFoodsByZone(
  zone: FoodZone,
): ReadonlyArray<FoodRegistryEntry> {
  return FOOD_REGISTRY.filter((e) => e.zone === zone);
}

// ── GROUP → LINE mapping ──────────────────────────────────────────────────

export const FOOD_GROUPS: ReadonlyArray<FoodGroup> = Object.freeze(
  Object.keys(FOOD_GROUP_LINES) as FoodGroup[],
);

export const FOOD_LINES: ReadonlyArray<FoodLine> = Object.freeze(
  Object.values(FOOD_GROUP_LINES).flatMap((lines) => [...lines]) as FoodLine[],
);

export function getFoodGroup(canonical: string): FoodGroup | undefined {
  return getFoodEntry(canonical)?.group;
}

export function getFoodLine(canonical: string): FoodLine | undefined {
  return getFoodEntry(canonical)?.line;
}

export function getFoodsByLine(
  line: FoodLine,
): ReadonlyArray<FoodRegistryEntry> {
  return FOOD_REGISTRY.filter((e) => e.line === line).sort(
    (a, b) => a.lineOrder - b.lineOrder,
  );
}

export function getLinesByGroup(group: FoodGroup): ReadonlyArray<FoodLine> {
  return FOOD_GROUP_LINES[group];
}

export function getLineDisplayName(line: FoodLine): string {
  const names: Record<FoodLine, string> = {
    meat_fish: "Meat & Fish",
    eggs_dairy: "Eggs & Dairy",
    vegetable_protein: "Vegetable Protein",
    grains: "Grains",
    vegetables: "Vegetables",
    fruit: "Fruit",
    oils: "Oils",
    dairy_fats: "Dairy Fats",
    nuts_seeds: "Nuts & Seeds",
    sauces_condiments: "Sauces & Condiments",
    herbs_spices: "Herbs & Spices",
  };
  return names[line];
}

export function getGroupDisplayName(group: FoodGroup): string {
  const names: Record<FoodGroup, string> = {
    protein: "Protein",
    carbs: "Carbs",
    fats: "Fats",
    seasoning: "Seasoning",
  };
  return names[group];
}

[... lines omitted ...]


---

<a id="ref-12"></a>
# [12] Source: /Users/peterjamesblizzard/projects/caca_traca/shared/foodTypes.ts
<!-- Lines:       25 | Included: full -->

/**
 * Shared food-system type definitions.
 *
 * These types are used by both the client (src/) and server (convex/) sides.
 * They live in shared/ so that foodEvidence.ts (also in shared/) can import
 * them without reaching into src/types/domain.ts.
 *
 * The canonical copy of these types lives HERE. src/types/domain.ts re-exports
 * them for backward compatibility with existing client-side imports.
 */

export interface TransitCalibration {
  source: "default" | "learned";
  centerMinutes: number;
  spreadMinutes: number;
  sampleSize: number;
  learnedAt: number | null;
}

export type FoodPrimaryStatus = "building" | "safe" | "watch" | "avoid";
export type FoodTendency = "neutral" | "loose" | "hard";
export type FoodAssessmentVerdict = "safe" | "watch" | "avoid" | "trial_next";
export type FoodAssessmentConfidence = "low" | "medium" | "high";
export type FoodAssessmentCausalRole = "primary" | "possible" | "unlikely";
export type FoodAssessmentChangeType = "new" | "upgraded" | "downgraded" | "unchanged";


---

<a id="ref-13"></a>
# [13] Source: /Users/peterjamesblizzard/projects/caca_traca/src/data/transitData.ts
<!-- Lines: 2112 | Included: L1-65 -->

<!-- === Lines 1-65 === -->
// ============================================================
// FOOD TRANSIT MAP — DATA LAYER v2
// Design: Dark Metro Cartography — pastel stations on dark bg
// Hierarchy: Main categories > Sub-lines > Zones > Tracks > Stations
// ============================================================

export type FoodStatus = "untested" | "testing" | "safe" | "watch" | "avoid";

export interface Station {
  id: string;
  name: string;
  preparation: string;
  status: FoodStatus;
  isCurrent?: boolean;
  emoji?: string;
}

export interface Track {
  id: string;
  label?: string;
  stations: Station[];
}

export interface Zone {
  id: string;
  name: string;
  shortName: string;
  description: string;
  tracks: Track[];
}

export interface SubLine {
  id: string;
  name: string;
  /** Pastel line colour (for dark background) */
  color: string;
  zones: Zone[];
}

export interface MainCategory {
  id: string;
  name: string;
  /** Accent colour for the category tab */
  accentColor: string;
  subLines: SubLine[];
}

// ── Status colours (pastel-friendly on dark bg) ───────────────
export const STATUS_COLORS: Record<FoodStatus, string> = {
  untested: "#64748b", // slate — not yet reached
  testing: "#60a5fa", // sky blue — currently trialing
  safe: "#4ade80", // soft green — passed safely
  watch: "#fbbf24", // amber — caused mild upset
  avoid: "#f87171", // soft red — caused bad reaction
};

export const STATUS_LABELS: Record<FoodStatus, string> = {
  untested: "Not yet reached",
  testing: "Currently trialing",
  safe: "Safe ✓",
  watch: "Watch — mild reaction",
  avoid: "Avoid for now",
};

// ── Pastel line colours for dark background ───────────────────

[... lines omitted ...]


---

<a id="ref-14"></a>
# [14] Source: /Users/peterjamesblizzard/projects/caca_traca/src/lib/analysis.ts
<!-- Lines: 249 | Included: L31-56 -->

<!-- === Lines 31-56 === -->
export interface FoodStat {
  key: string; // canonical name (from LLM or legacy normalization)
  name: string; // display name
  totalTrials: number; // all-time trial count
  recentOutcomes: TrialOutcome[]; // last 3 trial outcomes (newest first)
  badCount: number; // diarrhea/constipation in last 3
  looseCount: number; // loose in last 3
  hardCount: number; // hard in last 3
  goodCount: number; // normal/no-event in last 3
  avgDelayHours: number | null;
  lastTrialAt: number;
  status: FoodStatus;
  primaryStatus: FoodPrimaryStatus;
  tendency: FoodTendency;
  confidence: number;
  codeScore: number;
  aiScore: number;
  combinedScore: number;
  recentSuspect: boolean;
  clearedHistory: boolean;
  learnedTransitCenterMinutes: number;
  learnedTransitSpreadMinutes: number;
  bristolBreakdown: Record<number, number>; // e.g., { 4: 3, 5: 1, 6: 2 }
  avgTransitMinutes: number | null; // average time from eating to stool in minutes
  resolvedTransits: number; // count of completed transits (resolved trials)
}

[... lines omitted ...]


---

<a id="ref-15"></a>
# [15] Source: /Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/transit-map/types.ts
<!-- Lines:       39 | Included: full -->

import type { Station, SubLine, Track, Zone } from "@/data/transitData";

export interface FocusedStation {
  station: Station;
  zone: Zone;
  track: Track;
  subLine: SubLine;
  imageSrc?: string;
}

export interface PositionedStation extends FocusedStation {
  x: number;
  y: number;
}

export interface PositionedTrack {
  key: string;
  zone: Zone;
  track: Track;
  path: string;
  stations: PositionedStation[];
  chipX: number;
  chipY: number;
  chipAlign: "start" | "middle" | "end";
}

export interface TooltipState {
  x: number;
  y: number;
  stationId: string;
}

export interface StatusCounts {
  safe: number;
  testing: number;
  watch: number;
  avoid: number;
  untested: number;
}


---

<a id="ref-16"></a>
# [16] Source: /Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/transit-map/constants.ts
<!-- Lines:       35 | Included: full -->

import type { FoodStatus } from "@/data/transitData";

export const MAP_BACKGROUND =
  "radial-gradient(circle at top left, color-mix(in srgb, var(--indigo) 22%, transparent) 0%, transparent 24%), radial-gradient(circle at 88% 12%, color-mix(in srgb, var(--teal) 18%, transparent) 0%, transparent 20%), radial-gradient(circle at 50% 100%, color-mix(in srgb, var(--section-summary) 14%, transparent) 0%, transparent 28%), linear-gradient(180deg, color-mix(in srgb, var(--surface-2) 86%, black 14%) 0%, color-mix(in srgb, var(--surface-0) 92%, black 8%) 100%)";

export const ZONE_SURFACES = [
  {
    fill: "rgba(110, 231, 183, 0.08)",
    stroke: "rgba(110, 231, 183, 0.2)",
    label: "#86efac",
  },
  {
    fill: "rgba(96, 165, 250, 0.08)",
    stroke: "rgba(96, 165, 250, 0.2)",
    label: "#7dd3fc",
  },
  {
    fill: "rgba(244, 114, 182, 0.08)",
    stroke: "rgba(244, 114, 182, 0.2)",
    label: "#f9a8d4",
  },
] as const;

export const STATUS_ORDER: FoodStatus[] = ["safe", "testing", "watch", "avoid", "untested"];
export const STATION_RADIUS = 29;
export const TRACK_SHADOW_STROKE = 18;
export const TRACK_COLOR_STROKE = 10;
export const SVG_VIEWBOX = { width: 1400, height: 860 } as const;
export const INTERCHANGE_A = { x: 330, y: 430 } as const;
export const INTERCHANGE_B = { x: 814, y: 430 } as const;
export const ZONE_CARDS = {
  one: { x: 52, y: 116, width: 300, height: 592 },
  two: { x: 372, y: 184, width: 418, height: 492 },
  three: { x: 836, y: 98, width: 516, height: 650 },
} as const;


---

<a id="ref-17"></a>
# [17] Source: /Users/peterjamesblizzard/projects/caca_traca/src/hooks/useTransitMapData.ts
<!-- Lines:      192 | Included: full -->

/**
 * useTransitMapData — data-driven transit map foundation.
 *
 * Fuses the food registry (95 stations) with the Bayesian evidence pipeline
 * (from analyzeLogs) to produce a map-ready TransitNetwork model.
 *
 * This hook is the ONLY place where registry structure meets evidence data.
 * All downstream transit-map UI components consume TransitNetwork, never
 * the registry or evidence pipeline directly.
 *
 * Data flow:
 *   registry (shared/foodRegistry.ts)
 *     → 95 entries with group, line, lineOrder, zone
 *   + evidence (analyzeLogs → FoodStat[])
 *     → primaryStatus, tendency, trials, bristol, transit times
 *   = TransitNetwork
 *     → corridors → lines → stations (with evidence)
 */

import { formatCanonicalFoodDisplayName } from "@shared/foodNormalize";
import {
  FOOD_GROUPS,
  FOOD_REGISTRY,
  type FoodGroup,
  type FoodLine,
  type FoodRegistryEntry,
  getFoodsByLine,
  getGroupDisplayName,
  getLineDisplayName,
  getLinesByGroup,
  pickFoodDigestionMetadata,
} from "@shared/foodRegistry";
import { useMemo } from "react";
import type { FoodStat } from "@/lib/analysis";
import type {
  TransitCorridor,
  TransitLine,
  TransitNetwork,
  TransitStation,
} from "@/types/transitMap";

// ── Station builder ──────────────────────────────────────────────────────

function buildStation(entry: FoodRegistryEntry, statsByKey: Map<string, FoodStat>): TransitStation {
  const stat = statsByKey.get(entry.canonical);
  const digestion = pickFoodDigestionMetadata(entry) ?? null;

  const displayName = formatCanonicalFoodDisplayName(entry.canonical);

  if (!stat || stat.totalTrials === 0) {
    return {
      canonical: entry.canonical,
      displayName,
      zone: entry.zone,
      subzone: entry.subzone,
      lineOrder: entry.lineOrder,
      notes: entry.notes,
      digestion,
      primaryStatus: null,
      tendency: null,
      totalTrials: 0,
      resolvedTransits: 0,
      avgTransitMinutes: null,
      confidence: null,
      bristolBreakdown: {},
      latestAiVerdict: null,
      latestAiReasoning: null,
      lastTrialAt: 0,
      // TODO: firstSeenAt always equals lastTrialAt here because FoodStat lacks a
      // firstSeenAt field. TransitStation requires it (non-optional), so we cannot
      // remove it without updating the type definition in src/types/transitMap.ts.
      firstSeenAt: 0,
    };
  }

  return {
    canonical: entry.canonical,
    displayName,
    zone: entry.zone,
    subzone: entry.subzone,
    lineOrder: entry.lineOrder,
    notes: entry.notes,
    digestion,
    primaryStatus: stat.primaryStatus,
    tendency: stat.tendency,
    totalTrials: stat.totalTrials,
    resolvedTransits: stat.resolvedTransits,
    avgTransitMinutes: stat.avgTransitMinutes,
    confidence: stat.confidence,
    bristolBreakdown: stat.bristolBreakdown,
    latestAiVerdict: null,
    latestAiReasoning: null,
    lastTrialAt: stat.lastTrialAt,
    // TODO: firstSeenAt always equals lastTrialAt here because FoodStat lacks a
    // firstSeenAt field. TransitStation requires it (non-optional), so we cannot
    // remove it without updating the type definition in src/types/transitMap.ts.
    firstSeenAt: stat.lastTrialAt,
  };
}

// ── Line builder ─────────────────────────────────────────────────────────

function buildLine(line: FoodLine, statsByKey: Map<string, FoodStat>): TransitLine {
  const entries = getFoodsByLine(line); // already sorted by lineOrder
  const stations = entries.map((entry) => buildStation(entry, statsByKey));
  const testedCount = stations.filter((s) => s.totalTrials > 0).length;

  // Next stop: first station by lineOrder that is untested or still building evidence
  const nextStop =
    stations.find((s) => s.primaryStatus === null || s.primaryStatus === "building") ?? null;

  return {
    line,
    displayName: getLineDisplayName(line),
    stations,
    testedCount,
    totalCount: stations.length,
    nextStop,
  };
}

// ── Corridor builder ─────────────────────────────────────────────────────

function buildCorridor(group: FoodGroup, statsByKey: Map<string, FoodStat>): TransitCorridor {
  const groupLines = getLinesByGroup(group);
  const lines = groupLines.map((line) => buildLine(line, statsByKey));

  const testedCount = lines.reduce((sum, l) => sum + l.testedCount, 0);
  const totalCount = lines.reduce((sum, l) => sum + l.totalCount, 0);

  // Corridor next stop: first across all lines by lineOrder
  const nextStop =
    lines
      .flatMap((l) => (l.nextStop ? [l.nextStop] : []))
      .sort((a, b) => a.lineOrder - b.lineOrder)[0] ?? null;

  return {
    group,
    displayName: `${getGroupDisplayName(group)} Corridor`,
    lines,
    testedCount,
    totalCount,
    nextStop,
  };
}

// ── Network builder ──────────────────────────────────────────────────────

function buildTransitNetwork(statsByKey: Map<string, FoodStat>): TransitNetwork {
  const corridors = FOOD_GROUPS.map((group) => buildCorridor(group, statsByKey));

  const stationsByCanonical = new Map<string, TransitStation>();
  const stationLocation = new Map<string, { corridor: TransitCorridor; line: TransitLine }>();

  for (const corridor of corridors) {
    for (const line of corridor.lines) {
      for (const station of line.stations) {
        stationsByCanonical.set(station.canonical, station);
        stationLocation.set(station.canonical, { corridor, line });
      }
    }
  }

  const totalStations = FOOD_REGISTRY.length;
  const testedStations = [...stationsByCanonical.values()].filter((s) => s.totalTrials > 0).length;

  return {
    corridors,
    totalStations,
    testedStations,
    stationsByCanonical,
    stationLocation,
  };
}

// ── Hook ─────────────────────────────────────────────────────────────────

/**
 * Build a TransitNetwork from the food registry and evidence analysis.
 *
 * @param foodStats - Output from analyzeLogs().foodStats. Pass empty array if
 *   analysis hasn't run yet.
 */
export function useTransitMapData(foodStats: FoodStat[]): TransitNetwork {
  return useMemo(() => {
    const statsByKey = new Map<string, FoodStat>();
    for (const stat of foodStats) {
      statsByKey.set(stat.key, stat);
    }
    return buildTransitNetwork(statsByKey);
  }, [foodStats]);
}


---

<a id="ref-18"></a>
# [18] Source: /Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/transit-map/useTransitScene.ts
<!-- Lines:      215 | Included: full -->

import { useMemo } from "react";
import type { Station, SubLine, Track, Zone } from "@/data/transitData";
import { INTERCHANGE_A, INTERCHANGE_B } from "./constants";
import type { PositionedStation, PositionedTrack, StatusCounts } from "./types";
import { resolveArtworkKey } from "./useStationArtwork";
import { distribute, makeStatusCounts } from "./utils";

function createPositionedStation({
  station,
  zone,
  track,
  subLine,
  x,
  y,
  artworkUrls,
}: {
  station: Station;
  zone: Zone;
  track: Track;
  subLine: SubLine;
  x: number;
  y: number;
  artworkUrls: Record<string, string>;
}): PositionedStation {
  const artworkKey = resolveArtworkKey(station);
  const imageSrc = artworkKey !== undefined ? artworkUrls[artworkKey] : undefined;

  return {
    station,
    zone,
    track,
    subLine,
    x,
    y,
    ...(imageSrc !== undefined && { imageSrc }),
  };
}

function buildScene(subLine: SubLine, artworkUrls: Record<string, string>): PositionedTrack[] {
  const tracks: PositionedTrack[] = [];
  const [zoneOne, zoneTwo, zoneThree] = subLine.zones;

  if (zoneOne?.tracks[0]) {
    const x = 162;
    const yPoints = distribute(192, 570, zoneOne.tracks[0].stations.length);
    tracks.push({
      key: zoneOne.tracks[0].id,
      zone: zoneOne,
      track: zoneOne.tracks[0],
      path: `M ${x} 166 V 612 Q ${x} 656 204 656 H 270 Q 312 656 312 610 V ${INTERCHANGE_A.y} H ${INTERCHANGE_A.x}`,
      chipX: 86,
      chipY: 154,
      chipAlign: "start",
      stations: zoneOne.tracks[0].stations.map((station, index) =>
        createPositionedStation({
          station,
          zone: zoneOne,
          track: zoneOne.tracks[0],
          subLine,
          x,
          y: yPoints[index] ?? 192,
          artworkUrls,
        }),
      ),
    });
  }

  if (zoneTwo?.tracks[0]) {
    const topTrack = zoneTwo.tracks[0];
    tracks.push({
      key: topTrack.id,
      zone: zoneTwo,
      track: topTrack,
      path: `M ${INTERCHANGE_A.x} ${INTERCHANGE_A.y} H 378 Q 430 ${INTERCHANGE_A.y} 468 302 H 676 Q 748 302 ${INTERCHANGE_B.x} ${INTERCHANGE_B.y}`,
      chipX: 474,
      chipY: 258,
      chipAlign: "start",
      stations: topTrack.stations.map((station, index) =>
        createPositionedStation({
          station,
          zone: zoneTwo,
          track: topTrack,
          subLine,
          x: distribute(486, 668, topTrack.stations.length)[index] ?? 486,
          y: 302,
          artworkUrls,
        }),
      ),
    });
  }

  if (zoneTwo?.tracks[1]) {
    const bottomTrack = zoneTwo.tracks[1];
    tracks.push({
      key: bottomTrack.id,
      zone: zoneTwo,
      track: bottomTrack,
      path: `M ${INTERCHANGE_A.x} ${INTERCHANGE_A.y} H 378 Q 430 ${INTERCHANGE_A.y} 468 554 H 676 Q 748 554 ${INTERCHANGE_B.x} ${INTERCHANGE_B.y}`,
      chipX: 474,
      chipY: 594,
      chipAlign: "start",
      stations: bottomTrack.stations.map((station, index) =>
        createPositionedStation({
          station,
          zone: zoneTwo,
          track: bottomTrack,
          subLine,
          x: distribute(486, 668, bottomTrack.stations.length)[index] ?? 486,
          y: 554,
          artworkUrls,
        }),
      ),
    });
  }

  if (zoneThree) {
    const trackCount = zoneThree.tracks.length;
    const offsets = distribute(-170, 170, trackCount);
    for (const [index, track] of zoneThree.tracks.entries()) {
      const rowY = INTERCHANGE_B.y + (offsets[index] ?? 0);
      const chipY = rowY < INTERCHANGE_B.y ? rowY - 30 : rowY + 42;
      const branchStartX = rowY === INTERCHANGE_B.y ? 944 : 986;
      const path =
        rowY === INTERCHANGE_B.y
          ? `M 882 ${INTERCHANGE_B.y} H 1262`
          : `M 882 ${INTERCHANGE_B.y} Q 932 ${INTERCHANGE_B.y} 986 ${rowY} H 1262`;

      tracks.push({
        key: track.id,
        zone: zoneThree,
        track,
        path,
        chipX: branchStartX,
        chipY,
        chipAlign: "start",
        stations: track.stations.map((station, stationIndex) =>
          createPositionedStation({
            station,
            zone: zoneThree,
            track,
            subLine,
            x:
              distribute(branchStartX + 58, 1226, track.stations.length)[stationIndex] ??
              branchStartX + 58,
            y: rowY,
            artworkUrls,
          }),
        ),
      });
    }
  }

  return tracks;
}

/**
 * Extract all stations from a SubLine. Used both by useTransitScene
 * and by the artwork hook (to know which images to load).
 */
export function collectSubLineStations(subLine: SubLine | undefined): Station[] {
  if (!subLine) return [];
  return subLine.zones.flatMap((zone) => zone.tracks.flatMap((track) => track.stations));
}

interface TransitScene {
  positionedTracks: PositionedTrack[];
  stationLookup: Map<string, PositionedStation>;
  counts: StatusCounts;
  defaultStation: PositionedStation | null;
}

/**
 * Hook that builds the positioned transit scene from a SubLine and loaded artwork.
 * Extracts all scene-building, station lookup, and status counting logic.
 */
export function useTransitScene(
  activeSubLine: SubLine | undefined,
  artworkUrls: Record<string, string>,
): TransitScene {
  const positionedTracks = useMemo(
    () => (activeSubLine ? buildScene(activeSubLine, artworkUrls) : []),
    [activeSubLine, artworkUrls],
  );

  const stationLookup = useMemo(() => {
    const entries = positionedTracks.flatMap((track) =>
      track.stations.map((station) => [station.station.id, station] as const),
    );
    return new Map<string, PositionedStation>(entries);
  }, [positionedTracks]);

  const counts = useMemo(() => {
    const next = makeStatusCounts();
    for (const track of positionedTracks) {
      for (const station of track.stations) {
        next[station.station.status] += 1;
      }
    }
    return next;
  }, [positionedTracks]);

  const defaultStation = useMemo(() => {
    const current = positionedTracks
      .flatMap((track) => track.stations)
      .find((station) => station.station.isCurrent);
    return current ?? positionedTracks[0]?.stations[0] ?? null;
  }, [positionedTracks]);

  return {
    positionedTracks,
    stationLookup,
    counts,
    defaultStation,
  };
}


---

<a id="ref-19"></a>
# [19] Source: /Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/transit-map/useStationArtwork.ts
<!-- Lines:      202 | Included: full -->

import { useEffect, useRef, useState } from "react";
import type { Station } from "@/data/transitData";
import { normalizeSearchValue } from "./utils";

/**
 * Lazy glob — Vite returns a Record of () => Promise<module> functions.
 * Images are only loaded when invoked, NOT bundled into the initial JS.
 */
const ARTWORK_LOADERS = import.meta.glob("../../../assets/transit-map/*.png", {
  eager: false,
  import: "default",
}) as Record<string, () => Promise<string>>;

/**
 * Map from short key (e.g. "avocado") to its lazy loader function.
 */
const LOADER_BY_KEY = Object.fromEntries(
  Object.entries(ARTWORK_LOADERS).map(([path, loader]) => {
    const fileName = path.split("/").pop() ?? path;
    const key = fileName.replace(/\.png$/i, "");
    return [key, loader];
  }),
) as Record<string, () => Promise<string>>;

// Pre-compiled regex patterns for artwork key resolution.
// Module-level constants avoid re-compiling on every call to resolveArtworkKey.
const RX_SWEET_POTATO = /sweet potato|pumpkin/;
const RX_MASHED_POTATO = /mashed.*potato|potato.*mashed|pureed.*potato/;
const RX_POTATO = /potato/;
const RX_CARROT = /carrot/;
const RX_ZUCCHINI = /zucchini|courgette|cucumber/;
const RX_BROCCOLI = /broccoli|cauliflower/;
const RX_LEAFY = /spinach|lettuce|mixed greens|bok choy|greens|edamame|leafy/;
const RX_HERB =
  /herb|parsley|chives|dill|basil|thyme|oregano|rosemary|sage|mint|coriander|lemongrass|kaffir|fennel/;
const RX_GREEN_HERBS =
  /parsley|chives|dill|basil|thyme|oregano|rosemary|bay leaf|sage|tarragon|mint|coriander|lemongrass|kaffir|fennel/;
const RX_PEPPER = /pepper|capsicum|chilli|mustard|bbq sauce|hot sauce|worcestershire/;
const RX_ONION = /onion/;
const RX_BANANA = /banana/;
const RX_BERRIES = /strawberry|blueberry|berries/;
const RX_RICE = /rice|porridge|semolina|polenta|couscous|quinoa/;
const RX_TOAST = /toast/;
const RX_BREAD = /bread|crumpet|cracker|pretzel|muffin|biscuit|cake/;
const RX_PASTA = /pasta|spaghetti/;
const RX_CHIPS = /chip|fries|tempura/;
const RX_POULTRY = /chicken|turkey/;
const RX_SALMON = /salmon|tuna|sardine/;
const RX_FISH = /white fish|fish|prawn|crab/;
const RX_EGG = /egg/;
const RX_BEEF = /beef|lamb/;
const RX_PORK = /pork|ham|salami|sausage|bacon/;
const RX_COTTAGE_CHEESE = /cottage cheese/;
const RX_YOGURT = /yoghurt|yogurt|milk|ice cream|gelato/;
const RX_CHEESE = /ricotta|feta|mozzarella|cheddar|parmesan|gruyere|cheese|brie|camembert/;
const RX_AVOCADO = /avocado/;
const RX_CINNAMON = /cinnamon|nutmeg/;
const RX_BROTH = /broth|miso|soy sauce|oyster sauce|fish sauce/;

/**
 * Module-level cache: station ID → resolved artwork key (or null = no artwork).
 * Persists for the lifetime of the module, so repeated calls for the same station
 * (e.g. across re-renders or buildScene calls) never re-run the regex battery.
 *
 * NOTE: This cache survives HMR reloads. During development, stale entries may
 * persist across hot updates. Call `clearArtworkKeyCache()` in tests to reset.
 */
const artworkKeyCache = new Map<string, string | null>();

/**
 * Clear the module-level artwork key cache.
 * Intended for test cleanup so cached results don't leak between test cases.
 */
export function clearArtworkKeyCache(): void {
  artworkKeyCache.clear();
}

function matchArtworkKey(key: string): string | undefined {
  if (RX_SWEET_POTATO.test(key)) return "baked_sweet_potato";
  if (RX_MASHED_POTATO.test(key)) return "mashed_potatoes";
  if (RX_POTATO.test(key)) return "raw_potato";
  if (RX_CARROT.test(key)) return "raw_carrot";
  if (RX_ZUCCHINI.test(key)) return "raw_zucchini";
  if (RX_BROCCOLI.test(key)) return "fresh_broccoli";
  if (RX_LEAFY.test(key) && !RX_HERB.test(key)) return "leafy_greens";
  if (RX_GREEN_HERBS.test(key)) return "green_herbs";
  if (RX_PEPPER.test(key)) return "pepper";
  if (RX_ONION.test(key)) return "onion_group";
  if (RX_BANANA.test(key)) return "fresh_banana";
  if (RX_BERRIES.test(key)) return "mixed_berries";
  if (RX_RICE.test(key)) return "rice_bowl";
  if (RX_TOAST.test(key)) return "golden_toast";
  if (RX_BREAD.test(key)) return "bread_basket";
  if (RX_PASTA.test(key)) return "spaghetti_pasta";
  if (RX_CHIPS.test(key)) return "french_fries";
  if (RX_POULTRY.test(key)) return "poultry_drumstick";
  if (RX_SALMON.test(key)) return "salmon_fillet";
  if (RX_FISH.test(key)) return "white_fish";
  if (RX_EGG.test(key)) return "soft_boiled_egg";
  if (RX_BEEF.test(key)) return "beef_steak";
  if (RX_PORK.test(key)) return "pork_chop";
  if (RX_COTTAGE_CHEESE.test(key)) return "cottage_cheese";
  if (RX_YOGURT.test(key)) return "yogurt_pot";
  if (RX_CHEESE.test(key)) return "wedge_of_cheese";
  if (RX_AVOCADO.test(key)) return "avocado";
  if (RX_CINNAMON.test(key)) return "cinnamon";
  if (RX_BROTH.test(key)) return "clear_broth";
  return undefined;
}

/**
 * Given a station, return the artwork key it should use (or undefined).
 * Results are memoized by station ID to avoid re-running 30+ regexes on repeated calls.
 */
export function resolveArtworkKey(station: Station): string | undefined {
  const cached = artworkKeyCache.get(station.id);
  if (cached !== undefined) {
    return cached ?? undefined;
  }
  const key = normalizeSearchValue(`${station.name} ${station.preparation}`);
  const resolved = matchArtworkKey(key);
  artworkKeyCache.set(station.id, resolved ?? null);
  return resolved;
}

/**
 * Collect unique artwork keys needed for a set of stations.
 */
function collectNeededKeys(stations: Station[]): string[] {
  const keys = new Set<string>();
  for (const station of stations) {
    const artworkKey = resolveArtworkKey(station);
    if (artworkKey !== undefined) {
      keys.add(artworkKey);
    }
  }
  return Array.from(keys);
}

/**
 * Hook that lazily loads station artwork PNGs on demand.
 *
 * Given a list of stations currently visible, it loads only the images
 * needed for those stations. Returns a map from artwork key to resolved URL.
 */
export function useStationArtwork(stations: Station[]): Record<string, string> {
  const [loaded, setLoaded] = useState<Record<string, string>>({});

  // Track loaded state via ref to avoid including it in the effect dependency array.
  // Including `loaded` directly would cause an infinite re-render cycle: the effect
  // loads images -> updates `loaded` -> triggers the effect again.
  const loadedRef = useRef(loaded);
  loadedRef.current = loaded;

  useEffect(() => {
    const neededKeys = collectNeededKeys(stations);
    const currentLoaded = loadedRef.current;
    const keysToLoad = neededKeys.filter(
      (k) => currentLoaded[k] === undefined && LOADER_BY_KEY[k] !== undefined,
    );

    if (keysToLoad.length === 0) return;

    let cancelled = false;

    const loadImages = async () => {
      const results: Array<[string, string]> = [];

      await Promise.all(
        keysToLoad.map(async (artworkKey) => {
          const loader = LOADER_BY_KEY[artworkKey];
          if (!loader) return;
          try {
            const url = await loader();
            results.push([artworkKey, url]);
          } catch (error) {
            // Log but don't crash — missing artwork is non-fatal
            console.error(`Failed to load transit map artwork: ${artworkKey}`, error);
          }
        }),
      );

      if (!cancelled && results.length > 0) {
        setLoaded((prev) => {
          const next = { ...prev };
          for (const [key, url] of results) {
            next[key] = url;
          }
          return next;
        });
      }
    };

    loadImages();

    return () => {
      cancelled = true;
    };
  }, [stations]);

  return loaded;
}


---

<a id="ref-20"></a>
# [20] Source: /Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/transit-map/utils.ts
<!-- Lines:       49 | Included: full -->

import type { MainCategory } from "@/data/transitData";
import type { StatusCounts } from "./types";

export function normalizeSearchValue(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function makeStatusCounts(): StatusCounts {
  return { safe: 0, testing: 0, watch: 0, avoid: 0, untested: 0 };
}

export function distribute(start: number, end: number, count: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [(start + end) / 2];
  return Array.from({ length: count }, (_, index) => start + ((end - start) * index) / (count - 1));
}

export function getInitials(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "");
  return letters.join("") || "?";
}

export function getCategoryShortLabel(category: MainCategory): string {
  switch (category.id) {
    case "carbs":
      return "Carbs";
    case "proteins":
      return "Protein";
    case "fats":
      return "Fats";
    case "seasoning":
      return "Spice";
    default:
      return category.name;
  }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}


---

<a id="ref-21"></a>
# [21] Source: /Users/peterjamesblizzard/projects/caca_traca/convex/schema.ts
<!-- Lines: 388 | Included: L54-76, L224-271, L335-344 -->

<!-- === Lines 54-76 === -->
  foodEmbeddings: defineTable({
    canonicalName: v.string(),
    // The raw text that was embedded. For registry entries this is the
    // structured embedding text; for aliases it is the user's original phrase.
    sourceText: v.optional(v.string()),
    // Whether this row represents a registry canonical or a learned user alias.
    // Optional for backward compatibility with existing rows (treated as "registry").
    sourceType: v.optional(v.union(v.literal("registry"), v.literal("alias"))),
    zone: v.union(v.literal(1), v.literal(2), v.literal(3)),
    group: foodGroupValidator,
    line: foodLineValidator,
    bucketKey: v.string(),
    bucketLabel: v.string(),
    embedding: v.array(v.float64()),
    embeddingSourceHash: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_canonicalName", ["canonicalName"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536,
      filterFields: ["zone", "group", "line", "bucketKey"],
    }),

[... lines omitted ...]

<!-- === Lines 224-271 === -->
  foodTrialSummary: defineTable({
    userId: v.string(),
    canonicalName: v.string(),
    displayName: v.string(),
    currentStatus: v.union(
      v.literal("testing"),
      v.literal("safe"),
      v.literal("safe-loose"),
      v.literal("safe-hard"),
      v.literal("watch"),
      v.literal("risky"),
      v.literal("culprit"),
      v.literal("cleared"),
    ),
    primaryStatus: v.optional(foodPrimaryStatusValidator),
    tendency: v.optional(foodTendencyValidator),
    confidence: v.optional(v.number()),
    codeScore: v.optional(v.number()),
    aiScore: v.optional(v.number()),
    combinedScore: v.optional(v.number()),
    recentSuspect: v.optional(v.boolean()),
    clearedHistory: v.optional(v.boolean()),
    learnedTransitCenterMinutes: v.optional(v.number()),
    learnedTransitSpreadMinutes: v.optional(v.number()),
    latestAiVerdict: v.union(
      v.literal("culprit"),
      v.literal("safe"),
      v.literal("next_to_try"),
      v.literal("watch"),
      v.literal("avoid"),
      v.literal("trial_next"),
      v.literal("none"),
    ),
    latestConfidence: v.optional(
      v.union(v.literal("high"), v.literal("medium"), v.literal("low")),
    ),
    totalAssessments: v.number(),
    culpritCount: v.number(),
    safeCount: v.number(),
    nextToTryCount: v.number(),
    firstSeenAt: v.number(),
    lastAssessedAt: v.number(),
    latestReasoning: v.string(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_canonicalName", ["userId", "canonicalName"])
    .index("by_userId_status", ["userId", "currentStatus"]),

[... lines omitted ...]

<!-- === Lines 335-344 === -->
    sleepGoal: v.optional(sleepGoalValidator),
    healthProfile: v.optional(healthProfileValidator),
    aiPreferences: v.optional(aiPreferencesValidator),
    foodPersonalisation: v.optional(foodPersonalisationValidator),
    transitCalibration: v.optional(transitCalibrationValidator),
    // Set of all canonical food names the user has ever logged.
    // Used by weeklyDigest to determine "new foods" without scanning
    // all historical logs. Populated by writeProcessedItems, resolveItem,
    // and updateWeeklyDigestImpl; backfilled by backfillKnownFoodsWorker.
    knownFoods: v.optional(v.array(v.string())),

[... lines omitted ...]


---

<a id="ref-22"></a>
# [22] Source: /Users/peterjamesblizzard/projects/caca_traca/convex/validators.ts
<!-- Lines: 584 | Included: L66-72, L134-145, L286-304 -->

<!-- === Lines 66-72 === -->
export const transitCalibrationValidator = v.object({
  source: v.union(v.literal("default"), v.literal("learned")),
  centerMinutes: v.number(),
  spreadMinutes: v.number(),
  sampleSize: v.number(),
  learnedAt: v.union(v.number(), v.null()),
});

[... lines omitted ...]

<!-- === Lines 134-145 === -->
export const foodPrimaryStatusValidator = v.union(
  v.literal("building"),
  v.literal("safe"),
  v.literal("watch"),
  v.literal("avoid"),
);

export const foodTendencyValidator = v.union(
  v.literal("neutral"),
  v.literal("loose"),
  v.literal("hard"),
);

[... lines omitted ...]

<!-- === Lines 286-304 === -->
export const foodGroupValidator = v.union(
  v.literal("protein"),
  v.literal("carbs"),
  v.literal("fats"),
  v.literal("seasoning"),
);
export const foodLineValidator = v.union(
  v.literal("meat_fish"),
  v.literal("eggs_dairy"),
  v.literal("vegetable_protein"),
  v.literal("grains"),
  v.literal("vegetables"),
  v.literal("fruit"),
  v.literal("oils"),
  v.literal("dairy_fats"),
  v.literal("nuts_seeds"),
  v.literal("sauces_condiments"),
  v.literal("herbs_spices"),
);

[... lines omitted ...]


---

<a id="ref-23"></a>
# [23] Source: /Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/transit-map/TransitMapContainer.tsx
<!-- Lines:      234 | Included: full -->

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useTransitMapData } from "@/hooks/useTransitMapData";
import type { FoodStat } from "@/lib/analysis";
import type { TransitCorridor } from "@/types/transitMap";
import LineTrack from "./LineTrack";
import StationInspector from "./StationInspector";

// ── Corridor theme map ────────────────────────────────────────────────────

const GROUP_THEME: Record<
  TransitCorridor["group"],
  { panel: string; accent: string; chip: string }
> = {
  protein: {
    panel:
      "border-orange-500/20 bg-[radial-gradient(circle_at_top_left,_rgba(251,146,60,0.18),_transparent_45%),linear-gradient(180deg,rgba(15,23,42,0.95),rgba(2,6,23,0.96))]",
    accent: "text-orange-200",
    chip: "border-orange-500/20 bg-orange-500/10 text-orange-200",
  },
  carbs: {
    panel:
      "border-sky-500/20 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_45%),linear-gradient(180deg,rgba(15,23,42,0.95),rgba(2,6,23,0.96))]",
    accent: "text-sky-200",
    chip: "border-sky-500/20 bg-sky-500/10 text-sky-200",
  },
  fats: {
    panel:
      "border-emerald-500/20 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_45%),linear-gradient(180deg,rgba(15,23,42,0.95),rgba(2,6,23,0.96))]",
    accent: "text-emerald-200",
    chip: "border-emerald-500/20 bg-emerald-500/10 text-emerald-200",
  },
  seasoning: {
    panel:
      "border-rose-500/20 bg-[radial-gradient(circle_at_top_left,_rgba(244,63,94,0.18),_transparent_45%),linear-gradient(180deg,rgba(15,23,42,0.95),rgba(2,6,23,0.96))]",
    accent: "text-rose-200",
    chip: "border-rose-500/20 bg-rose-500/10 text-rose-200",
  },
};

// ── Props ─────────────────────────────────────────────────────────────────

export interface TransitMapContainerProps {
  foodStats: FoodStat[];
}

// ── Summary card ──────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: number | string;
  compact?: boolean;
}): ReactNode {
  return (
    <div className="rounded-2xl border border-slate-800/90 bg-slate-950/70 px-3 py-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500">
        {label}
      </p>
      <p
        className={`mt-1 font-display ${compact ? "text-base" : "text-xl"} font-semibold text-slate-100`}
      >
        {value}
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export default function TransitMapContainer({
  foodStats,
}: TransitMapContainerProps): ReactNode {
  const network = useTransitMapData(foodStats);

  const firstStation = useMemo(
    () =>
      network.corridors.flatMap((corridor) =>
        corridor.lines.flatMap((line) => line.stations),
      )[0] ?? null,
    [network.corridors],
  );

  const [selectedCanonical, setSelectedCanonical] = useState<string | null>(
    null,
  );
  // Ref avoids re-triggering the effect when the user selects a station.
  // The effect only needs to run when the network data or firstStation changes.
  const selectedCanonicalRef = useRef(selectedCanonical);
  selectedCanonicalRef.current = selectedCanonical;

  useEffect(() => {
    const current = selectedCanonicalRef.current;
    if (current !== null && network.stationsByCanonical.has(current)) {
      return;
    }
    setSelectedCanonical(firstStation?.canonical ?? null);
  }, [firstStation, network.stationsByCanonical]);

  const selectedStation =
    (selectedCanonical !== null
      ? network.stationsByCanonical.get(selectedCanonical)
      : undefined) ??
    firstStation ??
    null;

  const selectedLocation =
    selectedStation !== null
      ? network.stationLocation.get(selectedStation.canonical)
      : undefined;

  const nextSuggested =
    network.corridors.find((c) => c.nextStop !== null)?.nextStop ?? null;
  const untestedStations = network.totalStations - network.testedStations;

  // Empty state: no food evidence logged yet
  if (foodStats.length === 0 && network.testedStations === 0) {
    return (
      <div className="flex min-h-[300px] items-center justify-center rounded-[1.35rem] border border-[var(--border)] bg-[var(--surface-1)] p-8 text-center">
        <p className="max-w-sm text-sm leading-6 text-slate-400">
          No food evidence yet. Log some food and bowel movements to build your
          transit map.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.85fr)]">
      <section
        data-slot="transit-map-container"
        className="overflow-hidden rounded-[1.35rem] border border-[var(--border)] bg-[var(--surface-1)]"
      >
        {/* Header with summary cards */}
        <div className="border-b border-slate-800 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(251,146,60,0.12),_transparent_30%),linear-gradient(180deg,rgba(2,6,23,0.98),rgba(15,23,42,0.92))] px-5 py-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500">
                Live Registry
              </p>
              <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-50">
                Transit map from your data
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
                Stations, notes, and digestion flags come directly from the
                canonical food registry. Evidence overlays on top of those
                stations without a separate transit taxonomy.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <SummaryCard label="Stations" value={network.totalStations} />
              <SummaryCard label="Tested" value={network.testedStations} />
              <SummaryCard label="Untested" value={untestedStations} />
              <SummaryCard
                label="Next stop"
                value={nextSuggested?.displayName ?? "Pick any"}
                compact
              />
            </div>
          </div>
        </div>

        {/* Corridor sections */}
        <div className="space-y-4 p-4">
          {network.corridors.map((corridor) => {
            const theme = GROUP_THEME[corridor.group];

            return (
              <section
                key={corridor.group}
                className={`rounded-[1.15rem] border p-4 ${theme.panel}`}
              >
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
                      Corridor
                    </p>
                    <h3
                      className={`font-display text-xl font-semibold ${theme.accent}`}
                    >
                      {corridor.displayName}
                    </h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.2em] ${theme.chip}`}
                    >
                      {corridor.testedCount}/{corridor.totalCount} tested
                    </span>
                    {corridor.nextStop !== null && (
                      <span className="rounded-full border border-slate-700 bg-slate-900/70 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-300">
                        Next: {corridor.nextStop.displayName}
                      </span>
                    )}
                  </div>
                </div>

                {/* Lines within corridor */}
                <div className="grid gap-3 lg:grid-cols-2">
                  {corridor.lines.map((line) => (
                    <LineTrack
                      key={line.line}
                      line={line}
                      corridorGroup={corridor.group}
                      selectedCanonical={selectedCanonical}
                      onSelectStation={setSelectedCanonical}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </section>

      {/* Station inspector sidebar */}
      <aside className="rounded-[1.35rem] border border-slate-800 bg-[linear-gradient(180deg,rgba(2,6,23,0.98),rgba(15,23,42,0.96))] p-5">
        {selectedStation === null || selectedLocation === undefined ? (
          <p className="text-sm text-slate-400">No station selected.</p>
        ) : (
          <StationInspector
            station={selectedStation}
            corridorGroup={selectedLocation.corridor.group}
            corridorDisplayName={selectedLocation.corridor.displayName}
            lineName={selectedLocation.line.displayName}
          />
        )}
      </aside>
    </div>
  );
}


---

<a id="ref-24"></a>
# [24] Source: /Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/transit-map/LineTrack.tsx
<!-- Lines:      139 | Included: full -->

import type { FoodGroup } from "@shared/foodRegistry";
import type { TransitLine, TransitStation } from "@/types/transitMap";
import StationNode from "./StationNode";

export interface LineTrackProps {
  line: TransitLine;
  corridorGroup: FoodGroup;
  selectedCanonical: string | null;
  onSelectStation: (canonical: string) => void;
}

// ── Zone label helpers ────────────────────────────────────────────────────

function zoneKey(station: TransitStation): string {
  if (station.subzone !== undefined) {
    return station.subzone; // "1A" or "1B"
  }
  return String(station.zone); // "2" or "3"
}

function zoneLabel(station: TransitStation): string {
  if (station.subzone !== undefined) {
    return `Zone ${station.subzone}`;
  }
  return `Zone ${station.zone}`;
}

// ── Progress bar ─────────────────────────────────────────────────────────

interface ProgressBarProps {
  testedCount: number;
  totalCount: number;
}

function ProgressBar({ testedCount, totalCount }: ProgressBarProps) {
  const fraction = totalCount === 0 ? 0 : testedCount / totalCount;
  const pct = Math.round(fraction * 100);

  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-sky-500/60 transition-all duration-500"
          style={{ width: `${pct}%` }}
          role="presentation"
        />
      </div>
      <span className="shrink-0 font-mono text-[10px] text-slate-500">
        {pct}%
      </span>
    </div>
  );
}

// ── Zone divider ─────────────────────────────────────────────────────────

interface ZoneDividerProps {
  label: string;
}

function ZoneDivider({ label }: ZoneDividerProps) {
  return (
    <div className="flex items-center gap-2 py-1">
      <div className="h-px flex-1 bg-slate-800/80" />
      <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-slate-600">
        {label}
      </span>
      <div className="h-px flex-1 bg-slate-800/80" />
    </div>
  );
}

// ── LineTrack ─────────────────────────────────────────────────────────────

export default function LineTrack({
  line,
  corridorGroup,
  selectedCanonical,
  onSelectStation,
}: LineTrackProps) {
  return (
    <div
      data-slot="line-track"
      className="rounded-2xl border border-slate-800/90 bg-slate-950/75 p-3"
    >
      {/* Header */}
      <div className="mb-1 flex items-start justify-between gap-2">
        <div>
          <h4 className="font-mono text-xs uppercase tracking-[0.2em] text-slate-300">
            {line.displayName}
          </h4>
          <p className="text-xs text-slate-500">
            {line.testedCount}/{line.totalCount} tested
          </p>
        </div>
        {line.nextStop !== null && (
          <span className="shrink-0 rounded-full border border-slate-700 bg-slate-900/90 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
            Next {line.nextStop.displayName}
          </span>
        )}
      </div>

      {/* Progress indicator */}
      <ProgressBar
        testedCount={line.testedCount}
        totalCount={line.totalCount}
      />

      {/* Stations */}
      <div className="mt-3 space-y-2">
        {line.stations.length === 0 ? (
          <p className="py-2 text-center text-xs text-slate-500">
            No stations on this line
          </p>
        ) : (
          line.stations.map((station, index) => {
            const prevStation =
              index > 0 ? line.stations[index - 1] : undefined;
            const showZoneDivider =
              index === 0 ||
              (prevStation !== undefined &&
                zoneKey(station) !== zoneKey(prevStation));

            return (
              <div key={station.canonical}>
                {showZoneDivider && <ZoneDivider label={zoneLabel(station)} />}
                <StationNode
                  station={station}
                  selected={station.canonical === selectedCanonical}
                  onSelect={onSelectStation}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}


---

<a id="ref-25"></a>
# [25] Source: /Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/transit-map/StationNode.tsx
<!-- Lines:       79 | Included: full -->

import {
  serviceRecord,
  stationSignalFromStatus,
  type TransitStation,
} from "@/types/transitMap";

export interface StationNodeProps {
  station: TransitStation;
  selected: boolean;
  onSelect: (canonical: string) => void;
}

function signalDotClass(
  signal: ReturnType<typeof stationSignalFromStatus>,
): string {
  switch (signal) {
    case "green":
      return "bg-emerald-400";
    case "amber":
      return "bg-amber-400";
    case "red":
      return "bg-rose-400";
    case "blue":
      return "bg-sky-400";
    case "grey":
      return "bg-slate-500";
  }
}

export default function StationNode({
  station,
  selected,
  onSelect,
}: StationNodeProps) {
  const signal = stationSignalFromStatus(station.primaryStatus);
  const record = serviceRecord(station);
  const isBuilding = station.primaryStatus === "building";

  return (
    <button
      type="button"
      data-slot="station-node"
      aria-pressed={selected}
      onClick={() => onSelect(station.canonical)}
      className={`w-full rounded-2xl border px-3 py-2 text-left transition focus-visible:ring-2 focus-visible:ring-sky-400 ${
        selected
          ? "border-sky-400/60 bg-sky-500/10 shadow-[0_0_0_1px_rgba(56,189,248,0.15)]"
          : "border-slate-800 bg-slate-900/70 hover:border-slate-700 hover:bg-slate-900"
      }`}
    >
      <div className="flex items-start gap-2">
        <span
          className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${signalDotClass(signal)} ${isBuilding ? "animate-pulse" : ""}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate font-medium text-slate-100">
              {station.displayName}
            </p>
            <div className="flex shrink-0 items-center gap-1.5">
              {station.totalTrials > 0 && (
                <span className="rounded-full border border-slate-700 bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
                  {station.totalTrials}
                </span>
              )}
              <span className="rounded-full border border-slate-700 bg-slate-950 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
                Z{station.zone}
                {station.subzone ?? ""}
              </span>
            </div>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {record ?? "No transit evidence yet"}
          </p>
        </div>
      </div>
    </button>
  );
}


---

<a id="ref-26"></a>
# [26] Source: /Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/transit-map/StationInspector.tsx
<!-- Lines:      282 | Included: full -->

import { Clock3, FlaskConical, Route, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import {
  digestionBadgeClassName,
  getFoodDigestionBadges,
} from "@/lib/foodDigestionMetadata";
import {
  confidenceLabel,
  serviceRecord,
  tendencyLabel,
  type TransitStation,
} from "@/types/transitMap";
import type { FoodGroup } from "@shared/foodRegistry";

// ── Props ─────────────────────────────────────────────────────────────────

export interface StationInspectorProps {
  station: TransitStation;
  corridorGroup: FoodGroup;
  corridorDisplayName: string;
  lineName: string;
}

// ── Corridor chip theming ─────────────────────────────────────────────────

const CORRIDOR_CHIP: Record<FoodGroup, string> = {
  protein: "border-orange-500/20 bg-orange-500/10 text-orange-200",
  carbs: "border-sky-500/20 bg-sky-500/10 text-sky-200",
  fats: "border-emerald-500/20 bg-emerald-500/10 text-emerald-200",
  seasoning: "border-rose-500/20 bg-rose-500/10 text-rose-200",
};

// ── Bristol label helpers ─────────────────────────────────────────────────

function bristolLabel(code: number): string {
  switch (code) {
    case 1:
      return "Type 1: separate hard lumps";
    case 2:
      return "Type 2: lumpy sausage";
    case 3:
      return "Type 3: cracked sausage";
    case 4:
      return "Type 4: smooth sausage";
    case 5:
      return "Type 5: soft blobs";
    case 6:
      return "Type 6: loose";
    case 7:
      return "Type 7: watery";
    default:
      return `Type ${code}`;
  }
}

function bristolBarColor(code: number): string {
  if (code <= 2) return "bg-amber-500";
  if (code <= 5) return "bg-emerald-500";
  if (code === 6) return "bg-amber-400";
  return "bg-rose-500";
}

// ── Sub-components ────────────────────────────────────────────────────────

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}): ReactNode {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3">
      <div className="flex items-center gap-2 text-slate-400">{icon}</div>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-slate-100">{value}</p>
    </div>
  );
}

function EvidenceStat({
  label,
  value,
}: {
  label: string;
  value: string;
}): ReactNode {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm leading-6 text-slate-200">{value}</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export default function StationInspector({
  station,
  corridorGroup,
  corridorDisplayName,
  lineName,
}: StationInspectorProps): ReactNode {
  const digestionBadges = getFoodDigestionBadges(station.digestion);
  const service = serviceRecord(station);
  const chipClass = CORRIDOR_CHIP[corridorGroup];

  // Bristol breakdown — convert Record<number, number> to sorted array
  const bristolEntries = Object.entries(station.bristolBreakdown)
    .map(([code, count]) => ({ code: Number(code), count }))
    .sort((a, b) => a.code - b.code);

  const bristolTotal = bristolEntries.reduce((sum, e) => sum + e.count, 0);

  // Avg transit: convert minutes to hours (1 decimal)
  const avgTransitDisplay =
    station.avgTransitMinutes === null
      ? "Pending"
      : `${Math.round(station.avgTransitMinutes / 6) / 10}h`;

  return (
    <div data-slot="station-inspector" className="space-y-5">
      {/* Station header */}
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
          Selected station
        </p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-3xl font-semibold tracking-tight text-slate-50">
              {station.displayName}
            </h3>
            <p className="mt-1 text-sm text-slate-400">
              {corridorDisplayName} · {lineName}
            </p>
          </div>
          <div
            className={`rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] ${chipClass}`}
          >
            Zone {station.zone}
            {station.subzone !== undefined ? ` · ${station.subzone}` : ""}
          </div>
        </div>
      </div>

      {/* Signal metrics row */}
      <div className="grid gap-2 sm:grid-cols-3">
        <MetricCard
          icon={<Route className="h-4 w-4" />}
          label="Status"
          value={station.primaryStatus ?? "Untested"}
        />
        <MetricCard
          icon={<Clock3 className="h-4 w-4" />}
          label="Confidence"
          value={confidenceLabel(station.confidence)}
        />
        <MetricCard
          icon={<FlaskConical className="h-4 w-4" />}
          label="Tendency"
          value={tendencyLabel(station.tendency) ?? "No signal"}
        />
      </div>

      {/* Registry notes */}
      {station.notes !== undefined && (
        <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
            Registry note
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            {station.notes}
          </p>
        </section>
      )}

      {/* Digestion profile */}
      <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-slate-400" />
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
            Digestion profile
          </p>
        </div>
        {digestionBadges.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            No digestion metadata attached yet.
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {digestionBadges.map((badge) => (
              <span
                key={badge.key}
                className={digestionBadgeClassName(badge.tone)}
              >
                {badge.label}: {badge.value}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Evidence overlay */}
      <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
          Evidence overlay
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <EvidenceStat
            label="Trials logged"
            value={`${station.totalTrials}`}
          />
          <EvidenceStat
            label="Resolved transits"
            value={`${station.resolvedTransits}`}
          />
          <EvidenceStat label="Avg transit" value={avgTransitDisplay} />
          <EvidenceStat
            label="Service record"
            value={service ?? "No record yet"}
          />
        </div>
      </section>

      {/* Bristol breakdown */}
      {bristolEntries.length > 0 && (
        <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
            Bristol breakdown
          </p>
          <div className="mt-3 space-y-2">
            {bristolEntries.map(({ code, count }) => {
              const pct =
                bristolTotal > 0 ? Math.round((count / bristolTotal) * 100) : 0;
              return (
                <div key={code}>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="text-xs text-slate-400">
                      {bristolLabel(code)}
                    </p>
                    <span className="shrink-0 font-mono text-[10px] text-slate-500">
                      {count}x · {pct}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className={`h-full rounded-full ${bristolBarColor(code)}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* AI verdict */}
      {station.latestAiVerdict !== null && (
        <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
            AI verdict
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            {station.latestAiVerdict}
          </p>
          {station.latestAiReasoning !== null && (
            <p className="mt-2 text-xs leading-5 text-slate-500">
              {station.latestAiReasoning}
            </p>
          )}
        </section>
      )}
    </div>
  );
}


---

<a id="ref-27"></a>
# [27] Source: /Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/transit-map/TransitMap.tsx
<!-- Lines:      580 | Included: full -->

import {
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { MAIN_CATEGORIES, type MainCategory } from "@/data/transitData";
import {
  INTERCHANGE_A,
  INTERCHANGE_B,
  MAP_BACKGROUND,
  STATUS_ORDER,
  SVG_VIEWBOX,
  TRACK_COLOR_STROKE,
  TRACK_SHADOW_STROKE,
  ZONE_CARDS,
} from "./constants";
import { IntersectionNode } from "./IntersectionNode";
import { StationTooltip } from "./StationTooltip";
import { TrackSegment } from "./TrackSegment";
import { StatusPill, TransitMapInspector } from "./TransitMapInspector";
import type { TooltipState } from "./types";
import { useStationArtwork } from "./useStationArtwork";
import { collectSubLineStations, useTransitScene } from "./useTransitScene";
import { clamp, getCategoryShortLabel } from "./utils";
import { ZoneCard } from "./ZoneCard";

export default function TransitMap() {
  const [activeCategoryId, setActiveCategoryId] = useState(
    MAIN_CATEGORIES[0]?.id ?? "",
  );
  const [activeSubLineId, setActiveSubLineId] = useState(
    MAIN_CATEGORIES[0]?.subLines[0]?.id ?? "",
  );
  const [selectedStationId, setSelectedStationId] = useState<string | null>(
    null,
  );
  const [hoveredStationId, setHoveredStationId] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgIdPrefix = useId().replace(/:/g, "");

  const activeCategory =
    MAIN_CATEGORIES.find((category) => category.id === activeCategoryId) ??
    MAIN_CATEGORIES[0];
  const activeSubLine =
    activeCategory?.subLines.find(
      (subLine) => subLine.id === activeSubLineId,
    ) ?? activeCategory?.subLines[0];

  // Collect stations from SubLine data (no scene needed) for artwork loading.
  const stationsForArtwork = useMemo(
    () => collectSubLineStations(activeSubLine),
    [activeSubLine],
  );

  // Lazy-load artwork images for the current subline's stations.
  const artworkUrls = useStationArtwork(stationsForArtwork);

  // Build the positioned scene using the loaded artwork URLs.
  const { positionedTracks, stationLookup, counts, defaultStation } =
    useTransitScene(activeSubLine, artworkUrls);

  useEffect(() => {
    if (!activeCategory) return;
    if (
      activeCategory.subLines.some((subLine) => subLine.id === activeSubLineId)
    )
      return;
    setActiveSubLineId(activeCategory.subLines[0]?.id ?? "");
  }, [activeCategory, activeSubLineId]);

  useEffect(() => {
    setSelectedStationId(defaultStation?.station.id ?? null);
    setHoveredStationId(null);
    setTooltip(null);
  }, [defaultStation?.station.id]);

  const activeStation =
    (hoveredStationId ? stationLookup.get(hoveredStationId) : undefined) ??
    (selectedStationId ? stationLookup.get(selectedStationId) : undefined) ??
    defaultStation;

  const testedCount =
    counts.safe + counts.testing + counts.watch + counts.avoid;

  const updateTooltip = useCallback(
    (stationId: string, event: ReactMouseEvent<SVGGElement>) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const nextX = clamp(event.clientX - rect.left + 14, 18, rect.width - 210);
      const nextY = clamp(event.clientY - rect.top - 70, 18, rect.height - 86);
      setTooltip({ x: nextX, y: nextY, stationId });
    },
    [],
  );

  const handleStationHover = useCallback(
    (stationId: string, event: ReactMouseEvent<SVGGElement>) => {
      setHoveredStationId(stationId);
      updateTooltip(stationId, event);
    },
    [updateTooltip],
  );

  const handleStationMove = useCallback(
    (stationId: string, event: ReactMouseEvent<SVGGElement>) => {
      updateTooltip(stationId, event);
    },
    [updateTooltip],
  );

  const handleStationLeave = useCallback(() => {
    setHoveredStationId(null);
    setTooltip(null);
  }, []);

  const handleCategoryChange = useCallback((category: MainCategory) => {
    setActiveCategoryId(category.id);
    setActiveSubLineId(category.subLines[0]?.id ?? "");
  }, []);

  if (!activeCategory || !activeSubLine || !activeStation) {
    return (
      <section
        data-slot="transit-map-redesign"
        className="flex items-center justify-center p-8"
      >
        <p className="text-sm text-slate-400">No transit data available.</p>
      </section>
    );
  }

  const [zoneOne, zoneTwo, zoneThree] = activeSubLine.zones;
  if (!zoneOne || !zoneTwo || !zoneThree) {
    return (
      <section
        data-slot="transit-map-redesign"
        className="flex items-center justify-center p-8"
      >
        <p className="text-sm text-slate-400">No transit data available.</p>
      </section>
    );
  }

  const tooltipStation = tooltip
    ? stationLookup.get(tooltip.stationId)
    : undefined;
  const softShadowId = `${svgIdPrefix}-soft-shadow`;

  return (
    <section
      data-slot="transit-map-redesign"
      className="relative overflow-hidden rounded-[30px] border border-white/10 text-slate-50 shadow-[0_40px_120px_rgba(2,6,23,0.45)]"
      style={{ background: MAP_BACKGROUND }}
    >
      <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)] bg-[size:54px_54px] opacity-20" />
      <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_68%)] opacity-60" />

      <style>{`
        @keyframes transit-pulse {
          0% { opacity: 0.72; transform: scale(1); }
          70% { opacity: 0; transform: scale(1.55); }
          100% { opacity: 0; transform: scale(1.55); }
        }
      `}</style>

      <div className="relative grid gap-5 p-4 md:p-6 xl:grid-cols-[220px_minmax(0,1fr)_320px]">
        {/* Mobile sidebar */}
        <aside className="xl:hidden">
          <div className="grid gap-3">
            <div className="rounded-[24px] border border-white/10 bg-[#06101b]/88 p-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
                Transit Atlas
              </p>
              <h2 className="mt-3 font-display text-3xl font-bold text-slate-50">
                Food Lines
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Visual reference of the food reintroduction map with stations
                grouped by zone and line.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[24px] border border-white/10 bg-[#06101b]/88 p-3.5">
                <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
                  Status Key
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-2">
                    {STATUS_ORDER.slice(0, 3).map((status) => (
                      <StatusPill key={status} status={status} />
                    ))}
                  </div>
                  <div className="flex flex-col gap-2">
                    {STATUS_ORDER.slice(3).map((status) => (
                      <StatusPill key={status} status={status} />
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-[#06101b]/88 p-3.5">
                <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
                  Families
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {MAIN_CATEGORIES.map((category) => {
                    const isActive = category.id === activeCategory.id;
                    return (
                      <button
                        type="button"
                        key={category.id}
                        onClick={() => handleCategoryChange(category)}
                        className="min-w-0 rounded-full border px-1.5 py-2 text-center transition-colors"
                        style={{
                          background: isActive
                            ? `${category.accentColor}18`
                            : "rgba(255,255,255,0.04)",
                          borderColor: isActive
                            ? `${category.accentColor}42`
                            : "rgba(255,255,255,0.08)",
                        }}
                      >
                        <p
                          className="truncate font-display text-[11px] font-semibold"
                          style={{
                            color: isActive
                              ? category.accentColor
                              : "rgba(248,250,252,0.92)",
                          }}
                        >
                          {getCategoryShortLabel(category)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Desktop sidebar */}
        <aside className="hidden xl:flex xl:flex-col xl:gap-4">
          <div className="rounded-[24px] border border-white/10 bg-[#06101b]/88 p-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
              Transit Atlas
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold text-slate-50">
              Food Lines
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Visual reference of the food reintroduction map with stations
              grouped by zone and line.
            </p>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-[#06101b]/88 p-3">
            <p className="px-2 font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
              Families
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2">
              {MAIN_CATEGORIES.map((category) => {
                const isActive = category.id === activeCategory.id;
                return (
                  <button
                    type="button"
                    key={category.id}
                    onClick={() => handleCategoryChange(category)}
                    className="rounded-[18px] border px-4 py-3 text-left transition-colors"
                    style={{
                      background: isActive
                        ? `${category.accentColor}18`
                        : "rgba(255,255,255,0.04)",
                      borderColor: isActive
                        ? `${category.accentColor}42`
                        : "rgba(255,255,255,0.08)",
                    }}
                  >
                    <p
                      className="font-display text-lg font-semibold"
                      style={{
                        color: isActive
                          ? category.accentColor
                          : "rgba(248,250,252,0.92)",
                      }}
                    >
                      {category.name}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                      {category.subLines.length} lines
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-[#06101b]/88 p-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
              Status Key
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {STATUS_ORDER.map((status) => (
                <StatusPill key={status} status={status} />
              ))}
            </div>
          </div>
        </aside>

        {/* Main content area */}
        <div className="min-w-0 flex flex-col gap-4">
          <header className="overflow-hidden rounded-[26px] border border-white/10 bg-[#06101b]/88 p-5">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
                  Active Corridor
                </p>
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <h3 className="font-display text-4xl font-bold text-slate-50">
                    {activeSubLine.name}
                  </h3>
                  <span
                    className="rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em]"
                    style={{
                      color: activeCategory.accentColor,
                      borderColor: `${activeCategory.accentColor}34`,
                      background: `${activeCategory.accentColor}12`,
                    }}
                  >
                    {activeCategory.name}
                  </span>
                </div>
                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">
                  Tap a station to inspect its details. Zones progress from safe
                  foods to more experimental options.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  {
                    label: "Stops",
                    value: `${positionedTracks.flatMap((track) => track.stations).length}`,
                  },
                  { label: "Tested", value: `${testedCount}` },
                  { label: "Safe", value: `${counts.safe}` },
                  { label: "At Risk", value: `${counts.watch + counts.avoid}` },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-[18px] border border-white/8 bg-white/4 px-4 py-3"
                  >
                    <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500">
                      {item.label}
                    </p>
                    <p className="mt-2 font-display text-2xl font-bold text-slate-50">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {activeCategory.subLines.map((subLine) => {
                const isActive = subLine.id === activeSubLine.id;
                return (
                  <button
                    type="button"
                    key={subLine.id}
                    onClick={() => setActiveSubLineId(subLine.id)}
                    className="rounded-full border px-4 py-2 text-sm font-semibold transition-colors"
                    style={{
                      background: isActive
                        ? `${subLine.color}1f`
                        : "rgba(255,255,255,0.04)",
                      borderColor: isActive
                        ? `${subLine.color}50`
                        : "rgba(255,255,255,0.08)",
                      color: isActive
                        ? subLine.color
                        : "rgba(226,232,240,0.72)",
                    }}
                  >
                    {subLine.name}
                  </button>
                );
              })}
            </div>
          </header>

          <div
            ref={containerRef}
            className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#040a13]/90 p-2"
          >
            <div className="px-2 pb-2 md:hidden">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
                Swipe left or right to explore the full line map
              </p>
            </div>
            <div className="max-w-full overflow-x-auto overflow-y-hidden pb-2 touch-pan-x">
              <svg
                viewBox={`0 0 ${SVG_VIEWBOX.width} ${SVG_VIEWBOX.height}`}
                className="min-h-[34rem] w-[1220px] max-w-none sm:w-[1320px] md:w-full md:max-w-full"
                preserveAspectRatio="xMidYMid meet"
              >
                <title>{`${activeCategory.name} ${activeSubLine.name} transit map`}</title>

                <defs>
                  <filter id={softShadowId}>
                    <feDropShadow
                      dx="0"
                      dy="18"
                      stdDeviation="18"
                      floodColor="#020617"
                      floodOpacity="0.4"
                    />
                  </filter>
                  <clipPath id={`${svgIdPrefix}-frame-clip`}>
                    <rect
                      x="0"
                      y="0"
                      width={SVG_VIEWBOX.width}
                      height={SVG_VIEWBOX.height}
                      rx="36"
                    />
                  </clipPath>
                  {positionedTracks.flatMap((track) =>
                    track.stations.map((station) => (
                      <clipPath
                        id={`${svgIdPrefix}-${station.station.id}`}
                        key={`${track.key}-${station.station.id}-clip`}
                        clipPathUnits="objectBoundingBox"
                      >
                        <circle cx="0.5" cy="0.5" r="0.5" />
                      </clipPath>
                    )),
                  )}
                </defs>

                <g clipPath={`url(#${svgIdPrefix}-frame-clip)`}>
                  <rect
                    width={SVG_VIEWBOX.width}
                    height={SVG_VIEWBOX.height}
                    fill="transparent"
                  />

                  <ZoneCard zone={zoneOne} index={0} rect={ZONE_CARDS.one} />
                  <ZoneCard zone={zoneTwo} index={1} rect={ZONE_CARDS.two} />
                  <ZoneCard
                    zone={zoneThree}
                    index={2}
                    rect={ZONE_CARDS.three}
                  />

                  {/* Interchange trunk segment */}
                  <path
                    d={`M ${INTERCHANGE_B.x} ${INTERCHANGE_B.y} H 882`}
                    stroke="rgba(4, 9, 18, 0.88)"
                    strokeWidth={TRACK_SHADOW_STROKE}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d={`M ${INTERCHANGE_B.x} ${INTERCHANGE_B.y} H 882`}
                    stroke={activeSubLine.color}
                    strokeWidth={TRACK_COLOR_STROKE}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {positionedTracks.map((track) => (
                    <TrackSegment
                      key={track.key}
                      track={track}
                      lineColor={activeSubLine.color}
                      svgIdPrefix={svgIdPrefix}
                      softShadowId={softShadowId}
                      selectedStationId={selectedStationId}
                      hoveredStationId={hoveredStationId}
                      onStationHover={handleStationHover}
                      onStationMove={handleStationMove}
                      onStationLeave={handleStationLeave}
                      onStationSelect={setSelectedStationId}
                    />
                  ))}

                  <IntersectionNode
                    x={INTERCHANGE_A.x}
                    y={INTERCHANGE_A.y}
                    color={activeSubLine.color}
                  />
                  <IntersectionNode
                    x={INTERCHANGE_B.x}
                    y={INTERCHANGE_B.y}
                    color={activeSubLine.color}
                  />

                  <g
                    transform={`translate(${INTERCHANGE_A.x - 38}, ${INTERCHANGE_A.y - 92})`}
                  >
                    <rect
                      width={94}
                      height={24}
                      rx={12}
                      fill="rgba(4, 9, 18, 0.78)"
                      stroke={`${activeSubLine.color}35`}
                    />
                    <text
                      x={47}
                      y={16}
                      textAnchor="middle"
                      fontFamily="var(--font-mono)"
                      fontSize={10}
                      letterSpacing={1.6}
                      fill={activeSubLine.color}
                    >
                      INTERCHANGE
                    </text>
                  </g>

                  {defaultStation && (
                    <g
                      transform={`translate(${defaultStation.x + 42}, ${defaultStation.y - 58})`}
                    >
                      <rect
                        width={134}
                        height={44}
                        rx={18}
                        fill="rgba(4, 9, 18, 0.88)"
                        stroke="rgba(74, 222, 128, 0.35)"
                      />
                      <text
                        x={16}
                        y={17}
                        fontFamily="var(--font-mono)"
                        fontSize={10}
                        letterSpacing={1.6}
                        fill="#86efac"
                      >
                        YOU ARE HERE
                      </text>
                      <text
                        x={16}
                        y={32}
                        fontFamily="var(--font-display)"
                        fontSize={14}
                        fontWeight={700}
                        fill="rgba(248, 250, 252, 0.96)"
                      >
                        {defaultStation.station.name}
                      </text>
                    </g>
                  )}
                </g>
              </svg>
            </div>

            {tooltip && tooltipStation && (
              <StationTooltip tooltip={tooltip} station={tooltipStation} />
            )}
          </div>
        </div>

        <TransitMapInspector
          activeStation={activeStation}
          selectedStationId={selectedStationId ?? activeStation.station.id}
          onSelectStation={setSelectedStationId}
        />
      </div>
    </section>
  );
}


---

<a id="ref-28"></a>
# [28] Source: /Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/transit-map/TransitMapInspector.tsx
<!-- Lines:      193 | Included: full -->

import { useState } from "react";
import { type FoodStatus, STATUS_COLORS, STATUS_LABELS } from "@/data/transitData";
import type { FocusedStation } from "./types";
import { getInitials } from "./utils";

function StatusPill({ status }: { status: FoodStatus }) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
      style={{
        background: `${STATUS_COLORS[status]}18`,
        borderColor: `${STATUS_COLORS[status]}38`,
        color: STATUS_COLORS[status],
      }}
    >
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: STATUS_COLORS[status] }}
      />
      {status}
    </span>
  );
}

export { StatusPill };

interface TransitMapInspectorProps {
  activeStation: FocusedStation;
  selectedStationId: string;
  onSelectStation: (stationId: string) => void;
}

export function TransitMapInspector({
  activeStation,
  selectedStationId,
  onSelectStation,
}: TransitMapInspectorProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  return (
    <aside className="flex flex-col gap-4 xl:max-h-[46rem]">
      <div className="overflow-hidden rounded-[24px] border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface-1)_92%,transparent)]">
        <div className="relative overflow-hidden border-b border-[var(--border)] px-5 py-5">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(244,114,182,0.18),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(45,212,191,0.12),transparent_34%)]" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--text-faint)]">
                Station Inspector
              </p>
              <h3 className="mt-2 font-display text-2xl font-bold text-[var(--text)]">
                {activeStation.station.name}
              </h3>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                {activeStation.station.preparation}
              </p>
            </div>
            <StatusPill status={activeStation.station.status} />
          </div>
          <div className="relative mt-5 flex items-center gap-4">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-[22px] border border-[var(--border)] bg-[var(--surface-0)] shadow-[0_20px_50px_rgba(0,0,0,0.18)]">
              {activeStation.imageSrc ? (
                <img
                  src={activeStation.imageSrc}
                  alt={activeStation.station.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="font-mono text-2xl font-bold text-[var(--text-muted)]">
                  {getInitials(activeStation.station.name)}
                </span>
              )}
            </div>
            <div className="space-y-2 text-sm text-[var(--text-muted)]">
              <div>
                <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--text-faint)]">
                  Family
                </span>
                <p className="mt-1 font-medium text-[var(--text)]">{activeStation.subLine.name}</p>
              </div>
              <div>
                <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--text-faint)]">
                  Corridor
                </span>
                <p className="mt-1 font-medium text-[var(--text)]">
                  {activeStation.zone.name}
                  {activeStation.track.label ? ` / ${activeStation.track.label}` : " / Main"}
                </p>
              </div>
            </div>
          </div>
          {activeStation.station.isCurrent && (
            <div className="relative mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/35 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-300" />
              Current stop
            </div>
          )}
          <div className="mt-5">
            <button
              type="button"
              onClick={() => setDetailsOpen((open) => !open)}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-3)]"
            >
              <span className="inline-block h-2 w-2 rounded-full bg-[var(--text-faint)]" />
              {detailsOpen ? "Hide route details" : "Show route details"}
            </button>
            {!detailsOpen && (
              <p className="mt-3 text-sm text-[var(--text-muted)]">
                Keep the inspector clean by default. Open details for jump targets and pinned-state
                context.
              </p>
            )}
          </div>
        </div>

        {detailsOpen && (
          <div className="space-y-4 border-t border-[var(--border)] px-5 py-5">
            <div className="grid grid-cols-2 gap-3 text-sm text-[var(--text-muted)]">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--text-faint)]">
                  Status
                </p>
                <p className="mt-2 font-medium text-[var(--text)]">
                  {STATUS_LABELS[activeStation.station.status]}
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--text-faint)]">
                  Selection
                </p>
                <p className="mt-2 font-medium text-[var(--text)]">
                  {selectedStationId === activeStation.station.id
                    ? "Pinned in map"
                    : "Hover preview"}
                </p>
              </div>
            </div>

            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--text-faint)]">
                Quick Jumps
              </p>
              <div className="mt-3 max-h-[20rem] space-y-3 overflow-y-auto pr-1">
                {activeStation.subLine.zones.map((zone) => (
                  <div key={zone.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-display text-sm font-semibold text-[var(--text)]">
                        {zone.name}
                      </p>
                      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-faint)]">
                        {zone.description}
                      </span>
                    </div>
                    {zone.tracks.map((track) => (
                      <div key={track.id} className="space-y-2">
                        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-faint)]">
                          {track.label ?? "Main line"}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {track.stations.map((station) => {
                            const isSelected = station.id === selectedStationId;
                            return (
                              <button
                                type="button"
                                key={station.id}
                                onClick={() => onSelectStation(station.id)}
                                className="rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-sky-400"
                                style={{
                                  background: isSelected
                                    ? `${STATUS_COLORS[station.status]}24`
                                    : "rgba(255,255,255,0.04)",
                                  borderColor: isSelected
                                    ? `${STATUS_COLORS[station.status]}44`
                                    : "rgba(255,255,255,0.08)",
                                  color: isSelected ? "#f8fafc" : "rgba(226,232,240,0.78)",
                                }}
                              >
                                {station.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}


---

<a id="ref-29"></a>
# [29] Source: /Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/transit-map/StationMarker.tsx
<!-- Lines:      126 | Included: full -->

import type { MouseEvent as ReactMouseEvent } from "react";
import { STATUS_COLORS, STATUS_LABELS, type Station } from "@/data/transitData";
import { STATION_RADIUS } from "./constants";
import { getInitials } from "./utils";

interface StationMarkerProps {
  clipId: string;
  station: Station;
  imageSrc?: string;
  x: number;
  y: number;
  lineColor: string;
  isHovered: boolean;
  isSelected: boolean;
  onHover: (event: ReactMouseEvent<SVGGElement>) => void;
  onMove: (event: ReactMouseEvent<SVGGElement>) => void;
  onLeave: () => void;
  onSelect: () => void;
}

export function StationMarker({
  clipId,
  station,
  imageSrc,
  x,
  y,
  lineColor,
  isHovered,
  isSelected,
  onHover,
  onMove,
  onLeave,
  onSelect,
}: StationMarkerProps) {
  const statusColor = STATUS_COLORS[station.status];
  const ringRadius = STATION_RADIUS + (isSelected ? 5 : station.isCurrent ? 3 : 0);
  const showPulse = station.isCurrent || isSelected;

  return (
    // biome-ignore lint/a11y/useSemanticElements: SVG group used as a focusable station target
    <g
      transform={`translate(${x}, ${y})`}
      role="button"
      tabIndex={0}
      style={{ cursor: "pointer" }}
      onMouseEnter={onHover}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onFocus={onSelect}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      aria-label={`${station.name}. ${station.preparation}. ${STATUS_LABELS[station.status]}.`}
    >
      {showPulse && (
        <>
          <circle
            r={ringRadius + 9}
            fill="none"
            stroke={`${statusColor}55`}
            strokeWidth={2}
            style={{
              animation: "transit-pulse 2.4s ease-out infinite",
              transformOrigin: `${x}px ${y}px`,
            }}
          />
          <circle
            r={ringRadius + 15}
            fill="none"
            stroke={`${lineColor}44`}
            strokeWidth={1.5}
            style={{
              animation: "transit-pulse 2.4s ease-out 0.5s infinite",
              transformOrigin: `${x}px ${y}px`,
            }}
          />
        </>
      )}
      <circle
        r={ringRadius + 7}
        fill="rgba(4, 9, 18, 0.86)"
        stroke={`${lineColor}26`}
        strokeWidth={2}
      />
      {imageSrc ? (
        <image
          href={imageSrc}
          x={-STATION_RADIUS}
          y={-STATION_RADIUS}
          width={STATION_RADIUS * 2}
          height={STATION_RADIUS * 2}
          clipPath={`url(#${clipId})`}
          preserveAspectRatio="xMidYMid slice"
          opacity={isHovered ? 1 : 0.96}
          style={{ filter: "saturate(1.15) contrast(1.08)" }}
        />
      ) : (
        <g>
          <circle r={STATION_RADIUS} fill={`${lineColor}22`} />
          <text
            y={5}
            textAnchor="middle"
            fontFamily="var(--font-mono)"
            fontSize={15}
            fontWeight={700}
            fill="rgba(248, 250, 252, 0.92)"
          >
            {getInitials(station.name)}
          </text>
        </g>
      )}
      <circle
        r={STATION_RADIUS + 1}
        fill="none"
        stroke={statusColor}
        strokeWidth={isSelected ? 4.5 : isHovered ? 4 : 3}
      />
      <circle r={STATION_RADIUS + 5} fill="none" stroke={`${lineColor}45`} strokeWidth={1.5} />
      <title>{`${station.name} • ${station.preparation} • ${STATUS_LABELS[station.status]}`}</title>
    </g>
  );
}


---

<a id="ref-30"></a>
# [30] Source: /Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/transit-map/TrackSegment.tsx
<!-- Lines:      119 | Included: full -->

import type { MouseEvent as ReactMouseEvent } from "react";
import { TRACK_COLOR_STROKE, TRACK_SHADOW_STROKE } from "./constants";
import { StationMarker } from "./StationMarker";
import type { PositionedTrack } from "./types";

interface TrackChipProps {
  label: string;
  x: number;
  y: number;
  color: string;
  align: "start" | "middle" | "end";
}

function TrackChip({ label, x, y, color, align }: TrackChipProps) {
  const width = Math.max(112, label.length * 6.9 + 30);
  const left = align === "middle" ? x - width / 2 : align === "end" ? x - width : x;

  return (
    <g transform={`translate(${left}, ${y - 14})`}>
      <rect
        width={width}
        height={28}
        rx={14}
        fill="rgba(5, 10, 20, 0.84)"
        stroke={`${color}55`}
        strokeWidth={1}
      />
      <text
        x={width / 2}
        y={17}
        textAnchor="middle"
        fontFamily="var(--font-mono)"
        fontSize={10}
        letterSpacing={1.2}
        fill={color}
      >
        {label.toUpperCase()}
      </text>
    </g>
  );
}

interface TrackSegmentProps {
  track: PositionedTrack;
  lineColor: string;
  svgIdPrefix: string;
  softShadowId: string;
  selectedStationId: string | null;
  hoveredStationId: string | null;
  onStationHover: (stationId: string, event: ReactMouseEvent<SVGGElement>) => void;
  onStationMove: (stationId: string, event: ReactMouseEvent<SVGGElement>) => void;
  onStationLeave: () => void;
  onStationSelect: (stationId: string) => void;
}

export function TrackSegment({
  track,
  lineColor,
  svgIdPrefix,
  softShadowId,
  selectedStationId,
  hoveredStationId,
  onStationHover,
  onStationMove,
  onStationLeave,
  onStationSelect,
}: TrackSegmentProps) {
  return (
    <g>
      <path
        d={track.path}
        stroke="rgba(4, 9, 18, 0.88)"
        strokeWidth={TRACK_SHADOW_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={track.path}
        stroke={lineColor}
        strokeWidth={TRACK_COLOR_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        filter={`url(#${softShadowId})`}
      />
      <TrackChip
        label={track.track.label ?? `${track.zone.shortName} main`}
        x={track.chipX}
        y={track.chipY}
        color={lineColor}
        align={track.chipAlign}
      />
      {track.stations.map((station) => {
        const isSelected = station.station.id === selectedStationId;
        const isHovered = station.station.id === hoveredStationId;
        const clipId = `${svgIdPrefix}-${station.station.id}`;

        return (
          <StationMarker
            key={station.station.id}
            clipId={clipId}
            station={station.station}
            x={station.x}
            y={station.y}
            lineColor={lineColor}
            isHovered={isHovered}
            isSelected={isSelected}
            {...(station.imageSrc !== undefined && {
              imageSrc: station.imageSrc,
            })}
            onHover={(event) => onStationHover(station.station.id, event)}
            onMove={(event) => onStationMove(station.station.id, event)}
            onLeave={onStationLeave}
            onSelect={() => onStationSelect(station.station.id)}
          />
        );
      })}
    </g>
  );
}


---

<a id="ref-31"></a>
# [31] Source: /Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/transit-map/ZoneCard.tsx
<!-- Lines:       56 | Included: full -->

import type { Zone } from "@/data/transitData";
import { ZONE_SURFACES } from "./constants";

interface ZoneCardProps {
  zone: Zone;
  index: number;
  rect: { x: number; y: number; width: number; height: number };
}

export function ZoneCard({ zone, index, rect }: ZoneCardProps) {
  const tone = ZONE_SURFACES[index];
  return (
    <g>
      <rect
        x={rect.x}
        y={rect.y}
        width={rect.width}
        height={rect.height}
        rx={28}
        fill={tone.fill}
        stroke={tone.stroke}
        strokeWidth={1.5}
      />
      <text
        x={rect.x + 26}
        y={rect.y + 34}
        fontFamily="var(--font-mono)"
        fontSize={12}
        fontWeight={700}
        letterSpacing={2.1}
        fill={tone.label}
      >
        {zone.shortName}
      </text>
      <text
        x={rect.x + 26}
        y={rect.y + 62}
        fontFamily="var(--font-display)"
        fontSize={28}
        fontWeight={700}
        fill="rgba(248, 250, 252, 0.96)"
      >
        {zone.name}
      </text>
      <text
        x={rect.x + 26}
        y={rect.y + 92}
        fontFamily="var(--font-sans)"
        fontSize={14}
        fill="rgba(226, 232, 240, 0.66)"
      >
        {zone.description}
      </text>
    </g>
  );
}


---

<a id="ref-32"></a>
# [32] Source: /Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/transit-map/IntersectionNode.tsx
<!-- Lines:       25 | Included: full -->

interface IntersectionNodeProps {
  x: number;
  y: number;
  color: string;
}

export function IntersectionNode({ x, y, color }: IntersectionNodeProps) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <circle
        r={23}
        fill="color-mix(in srgb, var(--surface-0) 96%, black 4%)"
        stroke={`${color}35`}
        strokeWidth={3}
      />
      <circle
        r={14}
        fill="color-mix(in srgb, var(--surface-1) 92%, black 8%)"
        stroke={color}
        strokeWidth={4}
      />
      <circle r={5.5} fill={color} />
    </g>
  );
}


---

<a id="ref-33"></a>
# [33] Source: /Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/transit-map/StationTooltip.tsx
<!-- Lines:       39 | Included: full -->

import { STATUS_COLORS } from "@/data/transitData";
import type { PositionedStation, TooltipState } from "./types";

interface StationTooltipProps {
  tooltip: TooltipState;
  station: PositionedStation;
}

export function StationTooltip({ tooltip, station }: StationTooltipProps) {
  return (
    <div
      className="pointer-events-none absolute z-20 min-w-[13rem] rounded-[18px] border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface-1)_94%,transparent)] px-3.5 py-3 shadow-[0_24px_60px_rgba(2,6,23,0.24)] backdrop-blur"
      style={{ left: tooltip.x, top: tooltip.y }}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="font-display text-base font-bold text-[var(--text)]">
          {station.station.name}
        </p>
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]"
          style={{
            background: `${STATUS_COLORS[station.station.status]}18`,
            color: STATUS_COLORS[station.station.status],
          }}
        >
          {station.station.status}
        </span>
      </div>
      <p className="mt-1 text-xs text-[var(--text-muted)]">{station.station.preparation}</p>
      <div className="mt-3 flex items-center gap-2 text-[11px] text-[var(--text-faint)]">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: STATUS_COLORS[station.station.status] }}
        />
        {station.track.label ?? station.zone.name}
      </div>
    </div>
  );
}


---

<a id="ref-34"></a>
# [34] Source: /Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/transit-map/RegistryTransitMap.tsx
<!-- Lines: 406 | Included: L82-370 -->

<!-- === Lines 82-370 === -->
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.85fr)]">
      <section
        data-slot="registry-transit-map"
        className="overflow-hidden rounded-[1.35rem] border border-[var(--border)] bg-[var(--surface-1)]"
      >
        <div className="border-b border-slate-800 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(251,146,60,0.12),_transparent_30%),linear-gradient(180deg,rgba(2,6,23,0.98),rgba(15,23,42,0.92))] px-5 py-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500">
                Live Registry
              </p>
              <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-50">
                Transit map from your data
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
                Stations, notes, and digestion flags come directly from the canonical food registry.
                Evidence overlays on top of those stations without a separate transit taxonomy.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <SummaryCard label="Stations" value={network.totalStations} />
              <SummaryCard label="Tested" value={network.testedStations} />
              <SummaryCard label="Untested" value={untestedStations} />
              <SummaryCard
                label="Next stop"
                value={nextSuggested?.displayName ?? "Pick any"}
                compact
              />
            </div>
          </div>
        </div>

        <div className="space-y-4 p-4">
          {network.corridors.map((corridor) => {
            const theme = GROUP_THEME[corridor.group];

            return (
              <section
                key={corridor.group}
                className={`rounded-[1.15rem] border p-4 ${theme.panel}`}
              >
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
                      Corridor
                    </p>
                    <h3 className={`font-display text-xl font-semibold ${theme.accent}`}>
                      {corridor.displayName}
                    </h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.2em] ${theme.chip}`}
                    >
                      {corridor.testedCount}/{corridor.totalCount} tested
                    </span>
                    {corridor.nextStop !== null && (
                      <span className="rounded-full border border-slate-700 bg-slate-900/70 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-300">
                        Next: {corridor.nextStop.displayName}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  {corridor.lines.map((line) => (
                    <div
                      key={line.line}
                      className="rounded-2xl border border-slate-800/90 bg-slate-950/75 p-3"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div>
                          <h4 className="font-mono text-xs uppercase tracking-[0.2em] text-slate-300">
                            {line.displayName}
                          </h4>
                          <p className="text-xs text-slate-500">
                            {line.testedCount}/{line.totalCount} tested
                          </p>
                        </div>
                        {line.nextStop !== null && (
                          <span className="rounded-full border border-slate-700 bg-slate-900/90 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
                            Next {line.nextStop.displayName}
                          </span>
                        )}
                      </div>

                      <div className="space-y-2">
                        {line.stations.map((station) => (
                          <StationButton
                            key={station.canonical}
                            station={station}
                            selected={station.canonical === selectedStation?.canonical}
                            onSelect={setSelectedCanonical}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </section>

      <aside className="rounded-[1.35rem] border border-slate-800 bg-[linear-gradient(180deg,rgba(2,6,23,0.98),rgba(15,23,42,0.96))] p-5">
        {selectedStation === null || selectedLocation === undefined ? (
          <p className="text-sm text-slate-400">No station selected.</p>
        ) : (
          <StationDetail
            station={selectedStation}
            corridor={selectedLocation.corridor}
            lineName={selectedLocation.line.displayName}
          />
        )}
      </aside>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: number | string;
  compact?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-800/90 bg-slate-950/70 px-3 py-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500">{label}</p>
      <p
        className={`mt-1 font-display ${compact ? "text-base" : "text-xl"} font-semibold text-slate-100`}
      >
        {value}
      </p>
    </div>
  );
}

function StationButton({
  station,
  selected,
  onSelect,
}: {
  station: TransitStation;
  selected: boolean;
  onSelect: (canonical: string) => void;
}) {
  const signal = stationSignalFromStatus(station.primaryStatus);
  const record = serviceRecord(station);

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(station.canonical)}
      className={`w-full rounded-2xl border px-3 py-2 text-left transition focus-visible:ring-2 focus-visible:ring-sky-400 ${
        selected
          ? "border-sky-400/60 bg-sky-500/10 shadow-[0_0_0_1px_rgba(56,189,248,0.15)]"
          : "border-slate-800 bg-slate-900/70 hover:border-slate-700 hover:bg-slate-900"
      }`}
    >
      <div className="flex items-start gap-2">
        <span className={`mt-1 h-2.5 w-2.5 rounded-full ${signalDotClass(signal)}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate font-medium text-slate-100">{station.displayName}</p>
            <span className="shrink-0 rounded-full border border-slate-700 bg-slate-950 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
              Z{station.zone}
              {station.subzone ?? ""}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">{record ?? "No transit evidence yet"}</p>
        </div>
      </div>
    </button>
  );
}

function StationDetail({
  station,
  corridor,
  lineName,
}: {
  station: TransitStation;
  corridor: TransitCorridor;
  lineName: string;
}) {
  const digestionBadges = getFoodDigestionBadges(station.digestion);
  const service = serviceRecord(station);
  const theme = GROUP_THEME[corridor.group];

  return (
    <div className="space-y-5">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
          Selected station
        </p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-3xl font-semibold tracking-tight text-slate-50">
              {station.displayName}
            </h3>
            <p className="mt-1 text-sm text-slate-400">
              {corridor.displayName} · {lineName}
            </p>
          </div>
          <div
            className={`rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] ${theme.chip}`}
          >
            Zone {station.zone}
            {station.subzone !== undefined ? ` · ${station.subzone}` : ""}
          </div>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <MetricCard
          icon={<Route className="h-4 w-4" />}
          label="Status"
          value={station.primaryStatus ?? "Untested"}
        />
        <MetricCard
          icon={<Clock3 className="h-4 w-4" />}
          label="Confidence"
          value={confidenceLabel(station.confidence)}
        />
        <MetricCard
          icon={<FlaskConical className="h-4 w-4" />}
          label="Tendency"
          value={tendencyLabel(station.tendency) ?? "No signal"}
        />
      </div>

      {station.notes !== undefined && (
        <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
            Registry note
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-300">{station.notes}</p>
        </section>
      )}

      <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-slate-400" />
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
            Digestion profile
          </p>
        </div>
        {digestionBadges.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No digestion metadata attached yet.</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {digestionBadges.map((badge) => (
              <span key={badge.key} className={digestionBadgeClassName(badge.tone)}>
                {badge.label}: {badge.value}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
          Evidence overlay
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <EvidenceStat label="Trials logged" value={`${station.totalTrials}`} />
          <EvidenceStat label="Resolved transits" value={`${station.resolvedTransits}`} />
          <EvidenceStat
            label="Avg transit"
            value={
              station.avgTransitMinutes === null
                ? "Pending"
                : // Convert minutes to hours with 1 decimal: divide by 60, round via integer trick to avoid floating-point string issues
                  `${Math.round(station.avgTransitMinutes / 6) / 10}h`
            }
          />
          <EvidenceStat label="Service record" value={service ?? "No record yet"} />
        </div>
      </section>
    </div>
  );
}

[... lines omitted ...]


---

<a id="ref-35"></a>
# [35] Source: /Users/peterjamesblizzard/projects/caca_traca/src/pages/Patterns.tsx
<!-- Lines: 623 | Included: L574-623 -->

<!-- === Lines 574-623 === -->
        <TabsContent value={SECONDARY_PATTERN_TAB} forceMount>
          <div
            data-slot="patterns-transit-map-panel"
            className="overflow-hidden rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface-1)] shadow-[0_24px_80px_rgba(15,23,42,0.18)]"
          >
            <Tabs defaultValue={TRANSIT_REGISTRY_TAB} className="gap-0">
              <div className="flex flex-col gap-3 border-b border-[var(--border)] px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--text-faint)]">
                    Transit views
                  </p>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    The live network reads from the registry and evidence. The
                    model guide keeps the original visual reference untouched.
                  </p>
                </div>
                <TabsList className="grid w-full grid-cols-2 rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-1 sm:w-auto">
                  <TabsTrigger
                    value={TRANSIT_REGISTRY_TAB}
                    className="rounded-lg px-4 py-2 font-mono text-xs uppercase tracking-[0.18em] text-[var(--text-muted)] data-[active]:bg-[var(--surface-2)] data-[active]:text-[var(--text)]"
                  >
                    Live network
                  </TabsTrigger>
                  <TabsTrigger
                    value={TRANSIT_GUIDE_TAB}
                    className="rounded-lg px-4 py-2 font-mono text-xs uppercase tracking-[0.18em] text-[var(--text-muted)] data-[active]:bg-[var(--surface-2)] data-[active]:text-[var(--text)]"
                  >
                    Model guide
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent
                value={TRANSIT_REGISTRY_TAB}
                forceMount
                className="p-4"
              >
                <TransitMapContainer foodStats={analysis.foodStats} />
              </TabsContent>

              <TabsContent value={TRANSIT_GUIDE_TAB}>
                <TransitMap />
              </TabsContent>
            </Tabs>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

[... lines omitted ...]


---

<a id="ref-36"></a>
# [36] Source: /Users/peterjamesblizzard/projects/caca_traca/src/index.css
<!-- Lines: 1806 | Included: L1664-1718 -->

<!-- === Lines 1664-1718 === -->
/* Patterns theming bridge */
[data-slot="patterns-page"] .text-slate-50,
[data-slot="patterns-page"] .text-slate-100,
[data-slot="transit-map-redesign"] .text-slate-50,
[data-slot="transit-map-redesign"] .text-slate-100,
[data-slot="registry-transit-map"] .text-slate-50,
[data-slot="registry-transit-map"] .text-slate-100 {
  color: var(--text);
}

[data-slot="patterns-page"] .text-slate-400,
[data-slot="patterns-page"] .text-slate-300,
[data-slot="transit-map-redesign"] .text-slate-400,
[data-slot="transit-map-redesign"] .text-slate-300,
[data-slot="registry-transit-map"] .text-slate-400,
[data-slot="registry-transit-map"] .text-slate-300 {
  color: var(--text-muted);
}

[data-slot="patterns-page"] .text-slate-500,
[data-slot="transit-map-redesign"] .text-slate-500,
[data-slot="registry-transit-map"] .text-slate-500 {
  color: var(--text-faint);
}

[data-slot="patterns-page"] .border-slate-800,
[data-slot="patterns-page"] .border-slate-700,
[data-slot="patterns-page"] .border-slate-600,
[data-slot="transit-map-redesign"] .border-slate-800,
[data-slot="transit-map-redesign"] .border-slate-700,
[data-slot="transit-map-redesign"] .border-white\/10,
[data-slot="transit-map-redesign"] .border-white\/8,
[data-slot="registry-transit-map"] .border-slate-800,
[data-slot="registry-transit-map"] .border-slate-700,
[data-slot="registry-transit-map"] .border-white\/10 {
  border-color: var(--border) !important;
}

[data-slot="transit-map-redesign"],
[data-slot="registry-transit-map"] {
  color: var(--text);
}

[data-slot="transit-map-redesign"] .bg-\[\#06101b\]\/88,
[data-slot="transit-map-redesign"] .bg-\[\#07101a\]\/90,
[data-slot="transit-map-redesign"] .bg-\[\#040a13\]\/90,
[data-slot="transit-map-redesign"] .bg-\[\#02060d\],
[data-slot="transit-map-redesign"] .bg-\[\#05101b\]\/95 {
  background: color-mix(in srgb, var(--surface-1) 94%, transparent) !important;
}

[data-slot="transit-map-redesign"] .bg-white\/5,
[data-slot="transit-map-redesign"] .bg-white\/4 {
  background-color: color-mix(in srgb, var(--surface-2) 88%, transparent) !important;
}

[... lines omitted ...]


---

<a id="ref-37"></a>
# [37] Source: src/assets/transit-map/ (30 PNG station artwork files)

| File | Artwork Key |
|------|-------------|
| avocado.png | avocado |
| baked_sweet_potato.png | baked_sweet_potato |
| beef_steak.png | beef_steak |
| bread_basket.png | bread_basket |
| cinnamon.png | cinnamon |
| clear_broth.png | clear_broth |
| cottage_cheese.png | cottage_cheese |
| french_fries.png | french_fries |
| fresh_banana.png | fresh_banana |
| fresh_broccoli.png | fresh_broccoli |
| golden_toast.png | golden_toast |
| green_herbs.png | green_herbs |
| honey_pot.png | honey_pot |
| leafy_greens.png | leafy_greens |
| mashed_potatoes.png | mashed_potatoes |
| mixed_berries.png | mixed_berries |
| onion_group.png | onion_group |
| pepper.png | pepper |
| pork_chop.png | pork_chop |
| poultry_drumstick.png | poultry_drumstick |
| raw_carrot.png | raw_carrot |
| raw_potato.png | raw_potato |
| raw_zucchini.png | raw_zucchini |
| rice_bowl.png | rice_bowl |
| salmon_fillet.png | salmon_fillet |
| soft_boiled_egg.png | soft_boiled_egg |
| spaghetti_pasta.png | spaghetti_pasta |
| wedge_of_cheese.png | wedge_of_cheese |
| white_fish.png | white_fish |
| yogurt_pot.png | yogurt_pot |
