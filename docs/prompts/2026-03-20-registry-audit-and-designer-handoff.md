# Registry Audit & Designer Handoff

## Session Prompt

Pick up from where we left off. Check memory for current state.

Key context:

- Sprint 2.7 (radial SVG transit map) is planned but NOT started — `docs/plans/2026-03-20-sprint-2.7-transit-map-canvas.md`
- **The registry must be finalized BEFORE the map is designed.** The SVG map geometry is hand-authored per station. Every time the registry changes, the map must be redesigned. This is expensive. So we stabilize the registry first.
- Registry changes after this audit will only happen on version releases.
- Branch: `feat/sprint-2.5+`
- 1273 unit tests passing, typecheck clean, build clean.

**YOUR TASK: Audit every food in the registry and prepare designer handoff documentation.**

## Part 1: Per-Food Registry Audit

### What to do

Go through every entry in `shared/foodRegistry.ts` using the checklist at `docs/plans/food-registry-audit-checklist.md`. This is a thorough, entry-by-entry review.

For each food entry, verify:

1. **Canonical name** — unambiguous, plain English, includes preparation state where it matters
2. **Group/Line** — correct classification (protein/carbs/fats/seasoning → correct line)
3. **Zone** — clinically appropriate for post-anastomosis reintegration (1A/1B/2/3)
4. **Examples** — cover realistic user input variants, no false match risks
5. **Aliases/overlap** — no collisions with nearby entries
6. **lineOrder** — sensible clinical progression within the line (lower = safer/gentler)
7. **Digestion metadata** — if present, consistent with zone and clinical guidance

### How to do it

**Use sub-agent development.** You are the orchestrator. Do NOT read `foodRegistry.ts` yourself — it's 4000+ lines and will burn your context.

Dispatch sub-agents to audit by zone, one agent per zone:

- **Agent 1 (Opus):** Audit Zone 1A entries (4 stations). These are the foundation — get them perfect.
- **Agent 2 (Opus):** Audit Zone 1B entries (26 stations). The first solid foods.
- **Agent 3 (Opus):** Audit Zone 2 entries (53 stations). The bulk of the registry.
- **Agent 4 (Opus):** Audit Zone 3 entries (44 stations). Less critical for the map but still need correctness.

Each agent should:

1. Read `shared/foodRegistry.ts` and extract only entries for their zone
2. Read `docs/plans/food-registry-audit-checklist.md` for the checklist template
3. For each entry, run through all 7 checks
4. Output a findings report with: OK entries (brief), NEEDS FIX entries (with specific change), QUERY entries (flag for user review)
5. Do NOT modify the registry — just report findings

### After audit agents return

Collect all findings into a single consolidated report at `docs/registry-audit-findings.md`. Organize by:

1. **Confirmed correct** — entries that passed all checks (just list them)
2. **Needs fix** — entries with specific changes needed (detail each one)
3. **Needs user review** — entries where you're uncertain (present the question clearly)
4. **Missing foods** — foods that should exist in the registry but don't. Think about what a post-anastomosis patient would commonly eat that isn't covered.
5. **Candidate removals** — entries that are too specific, too obscure, or overlap with other entries

Present the "needs user review" items to the user as a numbered list so they can make decisions quickly.

### After user reviews findings

Apply all agreed changes to `shared/foodRegistry.ts` in a single batch. Run tests to verify nothing breaks.

## Part 2: Designer Handoff Documentation

After the registry is finalized, prepare documentation for the map designer. Create `docs/design/transit-map-designer-brief.md` containing:

### Section 1: Station Inventory

A complete, readable table of every station that will appear on the map, organized by corridor → line → zone:

```
## Protein Corridor

### Meat & Fish Line
| lineOrder | Station | Zone | Subzone | Notes |
|-----------|---------|------|---------|-------|
| 1 | Clear Broth | 1 | 1A | Starting liquid |
| 2 | Boiled Fish | 1 | 1B | First solid protein |
...
```

This is what the designer uses to know exactly which stations go where.

### Section 2: Data Model Summary

Explain (in plain language for a designer, not a developer) what `useTransitMapData` does:

- The registry defines the stations (fixed list, doesn't change between releases)
- The evidence engine overlays status colors based on the user's logged food + bowel data
- Status values: safe (green), building (blue), watch (amber), avoid (red), untested (grey/ghosted)
- Each station has: display name, zone, trial count, confidence level, tendency, Bristol breakdown

### Section 3: Visual Reference & Design Spec

Summarize the design decisions from the Sprint 2.7 plan:

- Radial concentric layout (Zone 1A center → Zone 3 outer edges)
- Explorer's map, NOT a journey — users explore freely within zones
- 4 zoom levels with animated step-zoom
- Organic/asymmetric line geometry (London Underground style, not a grid)
- Station focus: inline callout on canvas, never overlay the map
- Mobile: pan/swipe in portrait, full map in landscape
- Zone 3 minimal (3-4 stations per line, branching off edges)

Include the station count table from the Sprint 2.7 plan.

### Section 4: Tech Stack for the Designer

- SVG for map geometry (paths, circles, arcs)
- HTML overlay for labels (positioned absolutely via coordinate transforms)
- React + TypeScript
- Tailwind v4 for styling
- CSS transforms for zoom/pan animations
- No external charting libraries
- The designer delivers: SVG path `d` attributes for each line, station x/y coordinates, zone ring radii, viewBox dimensions

### Section 5: What the Designer Delivers

The designer needs to produce:

1. **SVG path data** for each of the 11 food lines (the `d` attribute for `<path>` elements)
2. **Station coordinates** (x, y) for each station along its line path
3. **Zone ring geometry** — radii for the 4 concentric zone boundaries
4. **Interchange positions** — x, y for zone boundary crossing markers
5. **ViewBox dimensions** — overall SVG canvas size
6. **Color palette** — corridor colors, line shade variants, zone ring colors
7. **Representative stations** — which 2-3 stations per line to label at overview/corridor zoom

This can be delivered as a Figma file, an SVG file, or direct TypeScript constants — whatever is fastest.

## Execution Order

1. Dispatch 4 parallel audit agents (Part 1)
2. Consolidate findings → present to user
3. Apply registry changes
4. Run tests
5. Generate designer handoff doc (Part 2) — dispatch a Sonnet agent for the table generation (mechanical task)
6. Update `docs/WIP.md` and memory

## Pre-reading for Sub-agents

- `shared/foodRegistry.ts` — the registry (4000+ lines)
- `docs/plans/food-registry-audit-checklist.md` — the per-entry checklist
- `src/hooks/useTransitMapData.ts` — the data hook
- `src/types/transitMap.ts` — transit map types
- `docs/plans/2026-03-20-sprint-2.7-transit-map-canvas.md` — the map design plan
- `docs/research/2026-03-17-Clinical-Transit-Times-Post-Anastomosis.md` — clinical reference for zone decisions
