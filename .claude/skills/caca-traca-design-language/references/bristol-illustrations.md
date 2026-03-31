# Bristol Scale Illustrations Reference

Procedural SVG definitions for all 7 Bristol Stool Scale types. Use these when building output logging, trend displays, or any UI showing Bristol types.

## Design Principles

- **Procedural SVGs, not photos or emoji.** These are clean, abstract illustrations that are medically recognizable but not gross.
- **Color-coded by status meaning:**
  - Types 1-2: Danger/Caution (reds and oranges) — constipation indicators
  - Types 3-5: Safe (greens) — healthy range, with Type 4 as the ideal
  - Type 6: Caution (orange) — trending toward diarrhea
  - Type 7: Danger (red) — liquid/diarrhea
- **Scalable.** Defined relative to a midpoint, so they work at any size (32px for inline badges, 48px for selection cards, 64px for detail views).
- **Each type has a distinct silhouette** so they're recognizable even at small sizes or without color.

## Type Definitions

### Type 1 — Hard Lumps
**Description:** Separate hard lumps, like nuts
**Status:** Danger (constipation)
**Visual:** 4-5 scattered circles of varying sizes, clustered but not touching
**Colors:** `#f87171` (red-400) with varying opacity (0.55-0.85)

### Type 2 — Lumpy Sausage
**Description:** Sausage-shaped but lumpy
**Status:** Caution
**Visual:** A sausage shape (path with bumpy Q-curves) with lighter bump highlights
**Colors:** `#fb923c` (orange-400) base, `#fdba74` (orange-300) for bumps

### Type 3 — Cracked Sausage
**Description:** Like a sausage with surface cracks
**Status:** Safe (healthy)
**Visual:** Rounded rectangle with 2-3 diagonal crack lines on top surface
**Colors:** `#34d399` (emerald-400) base, `#6ee7b7` (emerald-300) for cracks

### Type 4 — Smooth Snake (Ideal)
**Description:** Like a sausage or snake, smooth and soft
**Status:** Safe (ideal)
**Visual:** Clean rounded rectangle with a subtle inner highlight ellipse — the smoothest shape
**Colors:** `#34d399` (emerald-400) base, `#6ee7b7` (emerald-300) highlight

### Type 5 — Soft Blobs
**Description:** Soft blobs with clear-cut edges
**Status:** Safe
**Visual:** 2-3 overlapping ellipses, each distinct but soft
**Colors:** `#84cc16` (lime-500) and `#a3e635` (lime-400) with varying opacity

### Type 6 — Mushy
**Description:** Fluffy pieces with ragged edges
**Status:** Caution
**Visual:** Large diffuse ellipse with smaller irregular shapes overlapping — no clear edges
**Colors:** `#fb923c` (orange-400) and `#fdba74` (orange-300) at low opacity (0.3-0.4)

### Type 7 — Liquid
**Description:** Entirely liquid, watery, no solid pieces
**Status:** Danger (diarrhea)
**Visual:** Large low-opacity ellipse (puddle) with smaller splatter circles around it
**Colors:** `#f87171` (red-400) and `#fca5a5` (red-300) at very low opacity (0.25-0.4)

## Spectrum Bar

When a Bristol type is selected, show a horizontal spectrum bar with all 7 types:

```
[ 1 ][ 2 ][ 3  4  5 ][ 6 ][ 7 ]
 red  org  ← green →   org  red
           highlighted
```

Types 3-5 are highlighted (bordered or filled) as the "ideal range". The selected type gets a stronger highlight or checkmark. This gives the user immediate visual feedback about where their selection falls on the healthy-unhealthy spectrum.

## Stool Color Picker

Separate from Bristol type. A grid of color swatches representing clinically relevant stool colors:

| Color | Hex | Clinical meaning |
|-------|-----|-----------------|
| Light brown | `#C4A882` | Normal |
| Medium brown | `#8B6914` | Normal (most common) |
| Dark brown | `#5C4033` | Normal |
| Yellow | `#DAA520` | Possible fat malabsorption |
| Green-tinged | `#6B8E23` | Rapid transit, bile |
| Black/tarry | `#2D2D2D` | Possible upper GI bleeding |
| Red-streaked | `#8B4513` with red accent | Possible lower GI bleeding |
| Clay/pale | `#D2B48C` | Possible bile duct issue |

Display as small rounded square swatches (~36x36px), tappable. Selected swatch gets a checkmark overlay or border ring.

**Important:** These colors are for medical tracking. Don't apply bright status colors to the swatches — use the actual representative stool colors. The clinical meaning can be shown as a tooltip or small label below.

## Usage in Different Contexts

| Context | Size | Detail level |
|---------|------|-------------|
| Timeline log entry | 24-32px | Type number + mini illustration, inline |
| Bristol selection grid | 48-56px | Full illustration + type number + short label |
| Detail view header | 64px | Full illustration + type number + full description |
| Trend chart marker | 16-20px | Colored dot only (no illustration) |
| Badge/chip | 20-24px | Type number in colored circle |

## Existing Implementation

The project has an existing procedural SVG implementation in:
- `src/components/track/panels/bristolScaleData.ts` — Shape definitions using circle, ellipse, rect, line, and path primitives
- `design-system-prototype.jsx` — React Native-compatible SVG rendering

When building for React Native, use `react-native-svg` components (Svg, Circle, Ellipse, Rect, Line, Path) to render these shapes.
