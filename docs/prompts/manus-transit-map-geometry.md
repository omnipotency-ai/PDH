# Manus Prompt: Transit Map Geometry Manifest

> **System Role:** You are a Senior Frontend Engineer and SVG Geometry Expert.
>
> **Task:** Design a production-ready **Geometry Manifest** and **SVG Explorer Map** for the Caca Traca project. We are replacing a list-based view with a radial concentric transit map.

---

## Source Files (read these first)

All paths are from the project root at `/Users/peterjamesblizzard/projects/caca_traca/`.

| File                                                     | Purpose                                     | What to extract                                                                      |
| -------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------ |
| `shared/foodRegistryData.ts`                             | The canonical food registry                 | All 147 stations, their `lineOrder`, `zone`, `FoodLine`, and `FoodGroup` assignments |
| `src/hooks/useTransitMapData.ts`                         | Data hook that fuses registry + evidence    | How live evidence data overlays onto stations (status, confidence, tendency)         |
| `src/types/transitMap.ts`                                | TypeScript types for the transit map        | `TransitNetwork`, `TransitLine`, `TransitStation` interfaces                         |
| `docs/design/transit-map-designer-brief.md`              | Full station inventory tables + design spec | Complete station-by-station tables organised by corridor → line → zone               |
| `docs/plans/2026-03-20-sprint-2.7-transit-map-canvas.md` | Sprint 2.7 implementation plan              | Architecture decisions, zoom behaviour, mobile strategy                              |

---

## Registry Summary

**147 stations** across 4 corridors, 11 lines, and 4 zones.

### By Zone

| Zone | Stations | Map Region                                 |
| ---- | -------- | ------------------------------------------ |
| 1A   | 9        | Center — very sparse, symbolic             |
| 1B   | 29       | First ring                                 |
| 2    | 59       | Second ring — bulk of the map              |
| 3    | 50       | Outer edges — minimal (3-4 stubs per line) |

### By Line (density matters for path authoring)

| Line              | Stations | Corridor  |
| ----------------- | -------- | --------- |
| vegetables        | 31       | Carbs     |
| grains            | 30       | Carbs     |
| fruit             | 21       | Carbs     |
| meat_fish         | 15       | Protein   |
| sauces_condiments | 12       | Seasoning |
| eggs_dairy        | 12       | Protein   |
| dairy_fats        | 8        | Fats      |
| herbs_spices      | 6        | Seasoning |
| nuts_seeds        | 6        | Fats      |
| vegetable_protein | 3        | Protein   |
| oils              | 3        | Fats      |

The Vegetables line (31 stations) is 10x denser than Oils (3 stations). Your geometry must handle this density variance gracefully.

---

## Technical Requirement: The 2000x2000 Grid

All paths MUST be authored on a standardised **2000x2000 SVG ViewBox coordinate system**:

```xml
<svg viewBox="0 0 2000 2000">
```

Center point: `(1000, 1000)`.

Do not "eye-ball" coordinates. Every path `d` attribute, every station `(x, y)`, every zone ring radius must be authored against this grid. This ensures coordinates are resolution-independent and stable across viewport sizes.

---

## Design Constraints

### 1. Organic Geometry (Critical)

The layout MUST be organic and asymmetric — London Underground style, not a symmetric grid or equal quadrants.

- Lines curve and bend like real transit infrastructure
- Corridors are NOT equal quadrants — each occupies a different angular region
- Lines within a corridor spread like tributaries, not parallel tracks
- Use Bezier curves (`Q`, `C` commands), not straight lines (`L`)
- No two lines should share the same angle or curvature

### 2. Adaptive Density via Parametric Path Interpolation (Critical)

Because line density varies 10x (Vegetables: 31 stations vs Oils: 3), you MUST implement a **Parametric Path Interpolation** strategy:

- Use `SVGPathElement.getTotalLength()` to get each path's total length
- Use `SVGPathElement.getPointAtLength(t)` to distribute stations along curves
- Stations are positioned at interpolated points along their line's path
- Zone determines which segment of the path (Zone 1A near center, Zone 3 at the edge)
- Within a zone segment, `lineOrder` determines relative position
- Minimum spacing between adjacent station circles: `2 * stationRadius + 4px`

This ensures stations never overlap regardless of line density, and adding/removing a station doesn't require re-authoring coordinates — only re-interpolation.

### 3. Zoom-Invariant Styling (High Priority)

```xml
<path vector-effect="non-scaling-stroke" stroke-width="3" />
```

ALL track paths MUST use `vector-effect="non-scaling-stroke"`. Without this, line weights become giant blurry pipes when the user zooms in. The metro lines must remain clean and crisp across all 4 zoom levels.

### 4. Zone Boundaries

Define 4 concentric rings centered at `(1000, 1000)`:

| Zone | Ring         | Purpose                                |
| ---- | ------------ | -------------------------------------- |
| 1A   | Inner circle | Boundary around the center liquid zone |
| 1B   | Second ring  | First solid foods                      |
| 2    | Third ring   | Bulk of the map — most visual weight   |
| 3    | Outer ring   | Edge territory, minimal                |

Rings are rendered as subtle arc segments (not solid circles) behind the line paths. Zone labels ("Zone 1A", "Zone 1B", etc.) along the arcs, low contrast.

### 5. Interactive Hitboxes (Medium Priority)

Design a **Hidden Hitbox Layer** with larger invisible circles for each station:

```tsx
{
  /* Visible station */
}
<circle cx={x} cy={y} r={6} fill={statusColor} />;
{
  /* Invisible hitbox — 44px minimum touch target */
}
<circle
  cx={x}
  cy={y}
  r={22}
  fill="transparent"
  style={{ cursor: "pointer" }}
  aria-label={stationName}
  onClick={() => onStationFocus(canonical)}
/>;
```

Minimum 44px touch target per WCAG 2.5.8. This is essential for ADHD-friendly mobile interaction — the user is often stressed or symptomatic and cannot aim precisely.

---

## Mental Model: Explorer's Map

This is an **explorer's map**, NOT a journey or route planner.

- The user explores freely within their current zone
- There is no prescribed order within a line
- Stations "light up" as the user logs foods and gets evidence
- Untested stations are ghosted (grey, low opacity)
- A red station is NOT a failure — it is useful data. No "blocked" or "prohibited" language.

The map celebrates information gain, not compliance.

---

## Deliverable: `useTransitMapGeometry.ts`

Your primary deliverable is the code for `useTransitMapGeometry.ts`. This hook returns a `MapGeometry` object.

### Interface

```typescript
import type { FoodLine, FoodGroup } from "@/shared/foodRegistryData";

interface StationPosition {
  canonical: string; // matches registry canonical exactly
  x: number; // on the 2000x2000 grid
  y: number; // on the 2000x2000 grid
  isRepresentative: boolean; // label shown at overview/corridor zoom
}

interface LineGeometry {
  line: FoodLine;
  group: FoodGroup;
  path: string; // SVG path d attribute
  color: string; // primary track stroke color
  colorDimmed: string; // dimmed state (other corridors in focus)
  stations: StationPosition[];
}

interface ZoneRing {
  zone: "1A" | "1B" | "2" | "3";
  radius: number; // on the 2000x2000 grid
  label: string;
  color: string; // subtle arc stroke color
}

interface Interchange {
  line: FoodLine;
  zone: "1A" | "1B" | "2" | "3";
  x: number;
  y: number;
}

interface ZoomLevel {
  level: 1 | 2 | 3 | 4;
  name: "overview" | "corridor" | "line" | "station";
  scale: number;
  translateX: number;
  translateY: number;
}

interface MapGeometry {
  viewBox: { width: 2000; height: 2000 };
  center: { x: 1000; y: 1000 };
  zoneRings: ZoneRing[];
  lines: LineGeometry[];
  interchanges: Interchange[];
  zoomLevels: {
    overview: ZoomLevel;
    corridor: (group: FoodGroup) => ZoomLevel;
    line: (line: FoodLine) => ZoomLevel;
    station: (canonical: string) => ZoomLevel;
  };
}

export function useTransitMapGeometry(): MapGeometry;
```

### What the hook must contain

1. **Exact SVG path strings** for all 11 lines — the `d` attribute for `<path>` elements. Each path radiates from near center `(1000, 1000)` outward through zone rings.

2. **Station (x, y) coordinates** for all 147 stations, computed via parametric interpolation along their line's path. Stations must not overlap.

3. **Zone ring radii** — 4 values defining the concentric zone boundaries.

4. **Interchange positions** — where each line crosses a zone boundary ring.

5. **Zoom level calculations** for 4 animated zoom levels:

| Level | Name     | Behaviour                                                             |
| ----- | -------- | --------------------------------------------------------------------- |
| 1     | Overview | All corridors visible, zone rings, representative station labels only |
| 2     | Corridor | One corridor's lines bright, others dimmed, corridor station labels   |
| 3     | Line     | One line highlighted, all its station labels visible                  |
| 4     | Station  | 3-4 neighboring stations visible, map + inspector side-by-side        |

6. **Station Focus Rule (Critical):** At zoom level 4, the layout splits side-by-side — map on one side, Station Inspector on the other. The inspector **NEVER** overlays the map. This is a `<foreignObject>` or absolutely positioned HTML div beside the zoomed station cluster.

### Corridor color palette

| Corridor  | Hue Family              | Lines                                    |
| --------- | ----------------------- | ---------------------------------------- |
| Protein   | Warm reds / terracottas | meat_fish, eggs_dairy, vegetable_protein |
| Carbs     | Blues / teals           | grains, vegetables, fruit                |
| Fats      | Yellows / ambers        | oils, dairy_fats, nuts_seeds             |
| Seasoning | Greens / sage           | sauces_condiments, herbs_spices          |

Each line within a corridor needs a distinct shade variant. Define both `color` (active) and `colorDimmed` (when another corridor is in focus).

### Representative stations (labelled at overview zoom)

| Line              | Representatives                              |
| ----------------- | -------------------------------------------- |
| meat_fish         | clear broth, boiled fish, grilled white meat |
| eggs_dairy        | egg, plain yogurt, milk                      |
| vegetable_protein | tofu                                         |
| grains            | white rice, toast, white bread               |
| vegetables        | mashed potato, boiled carrot, courgette      |
| fruit             | ripe banana, stewed apple, melon             |
| oils              | olive oil                                    |
| dairy_fats        | butter, cream cheese                         |
| nuts_seeds        | avocado                                      |
| sauces_condiments | salt, smooth tomato sauce                    |
| herbs_spices      | mild herb                                    |

---

## Tech Stack

- **SVG** for map geometry (paths, circles, arcs)
- **HTML overlay** for labels (positioned via coordinate transforms from SVG x,y)
- **React 19 + TypeScript** (strict mode, `exactOptionalPropertyTypes`)
- **Tailwind v4** for styling (CSS custom properties)
- **CSS transforms** for zoom/pan animations (`transform: scale() translate()`)
- **No external charting libraries** — zero dependencies beyond React

---

## Status Colors (from evidence engine)

| Status            | Color                | Meaning                              |
| ----------------- | -------------------- | ------------------------------------ |
| `null` / untested | Grey, 30% opacity    | Never trialled — ghosted             |
| `building`        | Blue (subtle pulse)  | Active trials, insufficient evidence |
| `safe`            | Green, fully visible | Consistently good outcomes           |
| `watch`           | Amber                | Concerning outcomes                  |
| `avoid`           | Red                  | Consistent bad outcomes              |

---

## Quality Gates

The output must satisfy these constraints:

1. **All 147 stations** from the registry appear in the geometry with correct line and zone assignments
2. **No station overlaps** — verify minimum spacing between all adjacent stations on each line
3. **All paths start near center** `(1000, 1000)` and terminate at the Zone 3 outer edge
4. **`vector-effect="non-scaling-stroke"`** on all track paths
5. **Hitbox circles** ≥ 44px touch target for every station
6. **Zone ring radii** are monotonically increasing (1A < 1B < 2 < 3)
7. **Zoom level 4** never overlays the inspector on the map — side-by-side split only
8. **The hook is importable** — the code must compile in a React + TypeScript + Tailwind v4 project with no additional dependencies

**Final Goal:** The output must be so precise that a developer can import the path data directly without needing to tweak the "look" of the curves in the code editor. The geometry is mathematically locked into the code.
