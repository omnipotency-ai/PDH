# Caca Traca — Transit Map Geometry Pipeline

Sprint 2.7 / WQ-320

This folder contains the repeatable pipeline for generating
`useTransitMapGeometry.ts` from the food registry.

---

## Files

| File | Purpose |
|---|---|
| `generate_transit_map_geometry.py` | Master generator script — run this whenever the registry changes |
| `useTransitMapGeometry.ts` | Generated output — drop into `src/components/patterns/transit-map/` |
| `README.md` | This file |

---

## Quick Start

```bash
# From your project root:
python3 tools/transit-map/generate_transit_map_geometry.py

# Or with explicit paths:
python3 tools/transit-map/generate_transit_map_geometry.py \
    --registry shared/foodRegistryData.ts \
    --output   src/components/patterns/transit-map/useTransitMapGeometry.ts
```

**Requirements:** Python 3.8+. No external dependencies.

---

## When to Re-run

Re-run the generator any time you:

- Add a new food to `foodRegistryData.ts`
- Rename a food's `canonical` field
- Change a food's `zone`, `subzone`, or `lineOrder`
- Move a food to a different `line`
- Add a new `line` (also requires editing `LINE_PATHS` in the script — see below)

Do **not** manually edit `useTransitMapGeometry.ts`. It is fully overwritten
each run. Any manual edits will be lost.

---

## What the Script Does

1. **Parses** `foodRegistryData.ts` — extracts all 147 stations with their
   `canonical`, `zone`, `subzone`, `line`, and `lineOrder`.

2. **Validates** the registry — checks for duplicate canonicals, missing
   lines, and unexpected zone values. Exits with an error if validation fails.

3. **Generates** `useTransitMapGeometry.ts` with:
   - All station specs using the real canonical names from the registry
   - 11 SVG Bezier paths (one per food line)
   - Parametric interpolation logic (browser hook + SSR-safe static function)
   - Zone rings, interchange positions, zoom level calculations
   - Full colour palette and representative station flags

4. **Validates** the output — cross-checks every canonical in the output
   against the registry. Exits with an error if any mismatch is found.

---

## Customising the Map Layout

The **station names, zones, and lineOrders** come entirely from the registry.
Do not touch those in the script.

The **visual geometry** is defined in the `GEOMETRY CONFIGURATION` section of
the script (roughly lines 100–250). Edit these dictionaries to change the look:

| Dictionary | What it controls |
|---|---|
| `LINE_PATHS` | SVG Bezier path for each food line — the track shape |
| `LINE_COLORS` | Track colour and dimmed colour per line |
| `ZONE_RADII` | Pixel radius of each zone ring from center |
| `ZONE_SEGMENTS` | Fraction of path length allocated to each zone |
| `REPRESENTATIVE_STATIONS` | Which stations get labels at overview/corridor zoom |
| `CORRIDOR_CENTERS` | Zoom level 2 pan target per corridor |
| `LINE_CENTERS` | Zoom level 3 pan target per line |

### Adding a new food line

1. Add entries to `foodRegistryData.ts` with the new `line` key.
2. In the script, add the new line to:
   - `EXPECTED_LINES` list
   - `LINE_PATHS` dict (design a new SVG path)
   - `LINE_COLORS` dict
   - `REPRESENTATIVE_STATIONS` dict
   - `LINE_CENTERS` dict
   - `LINE_TO_GROUP` dict
3. Re-run the script.

---

## CLI Options

```
python3 generate_transit_map_geometry.py [options]

Options:
  --registry PATH    Path to foodRegistryData.ts
                     (default: shared/foodRegistryData.ts)
  --output PATH      Output path for useTransitMapGeometry.ts
                     (default: src/components/patterns/transit-map/useTransitMapGeometry.ts)
  --dry-run          Parse and validate only — do not write output file
  --validate-only    Validate an existing output file against the registry
```

---

## Output File Overview

`useTransitMapGeometry.ts` exports:

| Export | Type | Description |
|---|---|---|
| `useTransitMapGeometry()` | Hook | Browser hook — uses `SVGPathElement` API for precise arc-length interpolation |
| `getStaticTransitMapGeometry()` | Function | SSR-safe — pure TypeScript Bezier math, no DOM required |
| `STATION_SPECS` | Constant | All 147 station specs keyed by line |
| `LINE_PATHS` | Constant | SVG path `d` attribute per line |
| `LINE_COLORS` | Constant | Colour palette per line |
| `ZONE_RINGS` | Constant | Zone ring geometry |
| `ZONE_RADII` | Constant | Zone ring radii |
| `ZONE_SEGMENTS` | Constant | Path fraction per zone |
| `STATUS_COLORS` | Constant | Evidence status colour map |
| `STATION_RADIUS` | Constant | `6` — visible circle radius |
| `HITBOX_RADIUS` | Constant | `22` — 44px touch target (WCAG 2.5.8) |

### Integration

```typescript
// Browser (React component):
import { useTransitMapGeometry } from "./useTransitMapGeometry";
const geometry = useTransitMapGeometry(); // cached after first call

// SSR (Next.js / Remix server component):
import { getStaticTransitMapGeometry } from "./useTransitMapGeometry";
const geometry = getStaticTransitMapGeometry();

// Render a track:
<path d={lg.path} stroke={lg.color} strokeWidth={3} fill="none"
      vectorEffect="non-scaling-stroke" />

// Render a station:
<circle cx={s.x} cy={s.y} r={6} fill={statusColor} />
<circle cx={s.x} cy={s.y} r={22} fill="transparent"
        aria-label={s.canonical} onClick={() => onStationFocus(s.canonical)} />
```

---

## Coordinate System

- ViewBox: `2000 × 2000`
- Center: `(1000, 1000)`
- Zone 1A radius: `160 px`
- Zone 1B radius: `360 px`
- Zone 2 radius: `660 px`
- Zone 3 radius: `920 px`

All station `x, y` coordinates are in this coordinate space.
Scale to your rendered SVG size using the standard `viewBox` attribute.

---

_Generated pipeline — Caca Traca Sprint 2.7_
