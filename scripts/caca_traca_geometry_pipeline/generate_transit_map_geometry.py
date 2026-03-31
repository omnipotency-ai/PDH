#!/usr/bin/env python3
"""
generate_transit_map_geometry.py
=================================
Caca Traca — Transit Map Geometry Generator
Sprint 2.7 / WQ-320

PURPOSE
-------
Reads `shared/foodRegistryData.ts` from your project and generates
`src/hooks/useTransitMapGeometry.ts`.

Run this script any time you add, rename, or reclassify a food in the
registry. The output file is fully regenerated from scratch each time.

USAGE
-----
    python3 generate_transit_map_geometry.py \
        --registry shared/foodRegistryData.ts \
        --output   src/hooks/useTransitMapGeometry.ts

    # Or use the defaults (assumes you run from the project root):
    python3 generate_transit_map_geometry.py

WHAT IT DOES
------------
1. Parses foodRegistryData.ts to extract all 147 (or however many) stations
   with their canonical name, zone, subzone, line, lineOrder.
2. Validates the extracted data against expected line/zone counts.
3. Generates useTransitMapGeometry.ts with:
   - 11 hand-authored SVG Bezier paths (one per food line)
   - All station specs using REAL canonicals from the registry
   - Parametric interpolation logic (browser + SSR-safe)
   - Zone rings, interchange positions, zoom level calculations
   - Full colour palette and representative station flags
4. Writes the output file and prints a validation summary.

CUSTOMISING THE MAP GEOMETRY
-----------------------------
The SVG paths and visual layout are defined in the LINE_PATHS and
GEOMETRY_CONFIG dictionaries below. These are the only things you
should edit if you want to change the look of the map.

Everything else (station names, zones, lineOrders) is read directly
from the registry — do NOT hardcode station names in this script.

REQUIREMENTS
------------
Python 3.8+. No external dependencies.
"""

import re
import sys
import json
import argparse
import math
from pathlib import Path
from collections import defaultdict, Counter
from datetime import datetime

# ---------------------------------------------------------------------------
# CLI arguments
# ---------------------------------------------------------------------------

def parse_args():
    parser = argparse.ArgumentParser(
        description="Generate useTransitMapGeometry.ts from foodRegistryData.ts"
    )
    parser.add_argument(
        "--registry",
        default="shared/foodRegistryData.ts",
        help="Path to foodRegistryData.ts (default: shared/foodRegistryData.ts)"
    )
    parser.add_argument(
        "--output",
        default="src/hooks/useTransitMapGeometry.ts",
        help="Output path for useTransitMapGeometry.ts"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Parse and validate only — do not write output file"
    )
    parser.add_argument(
        "--validate-only",
        action="store_true",
        help="Validate an existing output file against the registry"
    )
    return parser.parse_args()

# ---------------------------------------------------------------------------
# Step 1: Parse foodRegistryData.ts
# ---------------------------------------------------------------------------

def parse_registry(registry_path: str) -> list[dict]:
    """
    Extract all station entries from foodRegistryData.ts.
    Returns a list of dicts with keys:
        canonical, zone, subzone, zone_key, group, line, lineOrder
    """
    path = Path(registry_path)
    if not path.exists():
        print(f"ERROR: Registry file not found: {registry_path}")
        sys.exit(1)

    src = path.read_text(encoding="utf-8")

    # Find all canonical: "..." occurrences
    canonical_re = re.compile(r'canonical:\s*"([^"]+)"')
    zone_re      = re.compile(r'\bzone:\s*(\d+),')
    subzone_re   = re.compile(r'subzone:\s*"([^"]+)"')
    group_re     = re.compile(r'\bgroup:\s*"([^"]+)"')
    line_re      = re.compile(r'\bline:\s*"([^"]+)"')
    lineorder_re = re.compile(r'lineOrder:\s*(\d+)')

    matches = list(canonical_re.finditer(src))
    stations = []

    for i, m in enumerate(matches):
        # Determine block extent
        start = m.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(src)
        block = src[start:end]

        # Skip the interface definition line (canonical: string;)
        if "string" in block[:40]:
            continue

        canonical = m.group(1)

        zm  = zone_re.search(block)
        szm = subzone_re.search(block)
        gm  = group_re.search(block)
        lm  = line_re.search(block)
        lom = lineorder_re.search(block)

        zone      = int(zm.group(1))  if zm  else None
        subzone   = szm.group(1)      if szm else None
        group     = gm.group(1)       if gm  else None
        line      = lm.group(1)       if lm  else None
        lineorder = int(lom.group(1)) if lom else None

        if group is None:
            continue  # skip interface/type definitions

        # Compute zone_key used in the map geometry
        if subzone:
            zone_key = subzone  # "1A" or "1B"
        elif zone == 2:
            zone_key = "2"
        elif zone == 3:
            zone_key = "3"
        else:
            zone_key = str(zone)

        stations.append({
            "canonical": canonical,
            "zone":      zone,
            "subzone":   subzone,
            "zone_key":  zone_key,
            "group":     group,
            "line":      line,
            "lineOrder": lineorder,
        })

    return stations

# ---------------------------------------------------------------------------
# Step 2: Validate extracted data
# ---------------------------------------------------------------------------

EXPECTED_LINES = [
    "meat_fish", "eggs_dairy", "vegetable_protein",
    "grains", "vegetables", "fruit",
    "oils", "dairy_fats", "nuts_seeds",
    "sauces_condiments", "herbs_spices",
]

EXPECTED_GROUPS = {
    "protein":   ["meat_fish", "eggs_dairy", "vegetable_protein"],
    "carbs":     ["grains", "vegetables", "fruit"],
    "fats":      ["oils", "dairy_fats", "nuts_seeds"],
    "seasoning": ["sauces_condiments", "herbs_spices"],
}

def validate_registry(stations: list[dict]) -> bool:
    """Print a validation summary. Returns True if valid."""
    ok = True

    # Total count
    print(f"\n{'='*60}")
    print(f"REGISTRY VALIDATION")
    print(f"{'='*60}")
    print(f"Total stations parsed: {len(stations)}")

    # Uniqueness
    canonicals = [s["canonical"] for s in stations]
    unique = set(canonicals)
    if len(unique) != len(canonicals):
        dupes = [c for c in canonicals if canonicals.count(c) > 1]
        print(f"  ERROR: Duplicate canonicals: {list(set(dupes))}")
        ok = False
    else:
        print(f"  Unique canonicals: {len(unique)} ✓")

    # Zone counts
    zone_counts = Counter(s["zone_key"] for s in stations)
    print(f"\nZone distribution:")
    for z in ["1A", "1B", "2", "3"]:
        print(f"  Zone {z}: {zone_counts.get(z, 0)} stations")

    # Line counts
    line_counts = Counter(s["line"] for s in stations)
    print(f"\nLine distribution:")
    for line in EXPECTED_LINES:
        count = line_counts.get(line, 0)
        if count == 0:
            print(f"  ERROR: {line}: 0 stations — missing!")
            ok = False
        else:
            print(f"  {line}: {count} stations")

    # Missing lines
    missing_lines = [l for l in EXPECTED_LINES if l not in line_counts]
    if missing_lines:
        print(f"\n  ERROR: Missing lines: {missing_lines}")
        ok = False

    print(f"\nValidation: {'PASSED ✓' if ok else 'FAILED ✗'}")
    print(f"{'='*60}\n")
    return ok

# ---------------------------------------------------------------------------
# Step 3: Geometry configuration
# ---------------------------------------------------------------------------
#
# EDIT THIS SECTION to change the visual layout of the map.
# Everything below is the creative/geometric design — it does NOT change
# when the food registry changes. Only station names and zones change.

# SVG ViewBox: 2000×2000, center (1000, 1000)
VIEWBOX = {"width": 2000, "height": 2000, "cx": 1000, "cy": 1000}

# Zone ring radii (px from center) — must be monotonically increasing
ZONE_RADII = {"1A": 160, "1B": 360, "2": 660, "3": 920}

# Zone segment fractions along each path
# (what fraction of the path length each zone occupies)
ZONE_SEGMENTS = {
    "1A": (0.00, 0.12),
    "1B": (0.12, 0.32),
    "2":  (0.32, 0.68),
    "3":  (0.68, 1.00),
}

# Station rendering constants
STATION_RADIUS = 6   # visible circle radius (px)
HITBOX_RADIUS  = 22  # invisible touch target — 44px diameter (WCAG 2.5.8)
MIN_SPACING    = 2 * STATION_RADIUS + 4  # 16 px minimum between stations

# ---------------------------------------------------------------------------
# SVG path definitions — ONE path per food line
# ---------------------------------------------------------------------------
#
# Each path is a single cubic Bezier: "M x0 y0 C cx1 cy1, cx2 cy2, x1 y1"
# on the 2000×2000 grid.
#
# Starting point: near Zone 1A boundary (~130–160 px from center)
# End point: beyond Zone 3 boundary (~950 px from center)
#
# Angular layout (degrees from positive-x axis, SVG convention):
#   Protein corridor:    ~145° – 215°   (west)
#   Carbs corridor:      ~240° – 310°   (north-west)
#   Fats corridor:       ~330° –  40°   (north-east / east)
#   Seasoning corridor:   ~50° – 115°   (south-east)
#
# To redesign the map: edit the path strings below.
# To add a new line: add an entry here AND in LINE_COLORS below.

LINE_PATHS = {
    # ── PROTEIN ──────────────────────────────────────────────────────────────
    # meat_fish: west, slight south curve
    "meat_fish":
        "M 882.4 1054.6 C 660.0 1100.0, 340.0 1090.0, 55.0 1083.0",

    # eggs_dairy: west-north-west, curves upward toward south-west
    "eggs_dairy":
        "M 870.3 1040.7 C 630.0 1120.0, 350.0 1280.0, 178.0 1468.0",

    # vegetable_protein: west, tight south-west stub (3 stations)
    "vegetable_protein":
        "M 840.0 1013.8 C 600.0 940.0, 350.0 700.0, 178.0 530.0",

    # ── CARBS ────────────────────────────────────────────────────────────────
    # grains: north-west, long prominent arc (30 stations)
    "grains":
        "M 958.4 882.2 C 920.0 640.0, 1060.0 310.0, 1168.0 68.0",

    # vegetables: north / north-west, broadest arc (31 stations)
    "vegetables":
        "M 1000.0 840.0 C 960.0 600.0, 700.0 340.0, 524.0 178.0",

    # fruit: north-east of Carbs corridor (21 stations)
    "fruit":
        "M 1040.7 870.3 C 1160.0 660.0, 1420.0 420.0, 1612.0 272.0",

    # ── FATS ─────────────────────────────────────────────────────────────────
    # oils: north-east, short stub (3 stations)
    "oils":
        "M 1112.2 958.4 C 1340.0 860.0, 1620.0 670.0, 1820.0 524.0",

    # dairy_fats: east axis, gentle curve (8 stations)
    "dairy_fats":
        "M 1128.0 979.0 C 1370.0 950.0, 1700.0 978.0, 1950.0 1000.0",

    # nuts_seeds: south-east of Fats corridor (6 stations)
    "nuts_seeds":
        "M 1128.0 1021.0 C 1360.0 1090.0, 1630.0 1310.0, 1820.0 1476.0",

    # ── SEASONING ────────────────────────────────────────────────────────────
    # sauces_condiments: south-east (12 stations)
    "sauces_condiments":
        "M 1040.7 1129.7 C 1150.0 1340.0, 1415.0 1572.0, 1612.0 1728.0",

    # herbs_spices: south / south-west, short stub (6 stations)
    "herbs_spices":
        "M 1000.0 1160.0 C 972.0 1376.0, 806.0 1678.0, 674.0 1894.0",
}

# ---------------------------------------------------------------------------
# Colour palette
# ---------------------------------------------------------------------------

LINE_COLORS = {
    # Protein — warm reds / terracottas
    "meat_fish":          {"color": "#e11d48", "colorDimmed": "#e11d4866"},
    "eggs_dairy":         {"color": "#c2410c", "colorDimmed": "#c2410c66"},
    "vegetable_protein":  {"color": "#9f1239", "colorDimmed": "#9f123966"},
    # Carbs — blues / teals
    "grains":             {"color": "#0284c7", "colorDimmed": "#0284c766"},
    "vegetables":         {"color": "#0891b2", "colorDimmed": "#0891b266"},
    "fruit":              {"color": "#1d4ed8", "colorDimmed": "#1d4ed866"},
    # Fats — yellows / ambers
    "oils":               {"color": "#d97706", "colorDimmed": "#d9770666"},
    "dairy_fats":         {"color": "#b45309", "colorDimmed": "#b4530966"},
    "nuts_seeds":         {"color": "#92400e", "colorDimmed": "#92400e66"},
    # Seasoning — greens / sage
    "sauces_condiments":  {"color": "#16a34a", "colorDimmed": "#16a34a66"},
    "herbs_spices":       {"color": "#15803d", "colorDimmed": "#15803d66"},
}

ZONE_RING_COLORS = {
    "1A": "rgba(120,180,140,0.18)",
    "1B": "rgba(120,160,200,0.15)",
    "2":  "rgba(160,140,100,0.13)",
    "3":  "rgba(200,100,80,0.10)",
}

# ---------------------------------------------------------------------------
# Representative stations (shown as labels at overview/corridor zoom)
# ---------------------------------------------------------------------------
# These are the canonical names of stations to label at low zoom.
# Update this dict if you rename stations in the registry.

REPRESENTATIVE_STATIONS = {
    "meat_fish":          {"clear broth", "boiled fish", "grilled white meat"},
    "eggs_dairy":         {"egg", "plain yogurt", "milk"},
    "vegetable_protein":  {"tofu"},
    "grains":             {"white rice", "toast", "white bread"},
    "vegetables":         {"mashed potato", "boiled carrot", "courgette"},
    "fruit":              {"ripe banana", "stewed apple", "melon"},
    "oils":               {"olive oil"},
    "dairy_fats":         {"butter", "cream cheese"},
    "nuts_seeds":         {"avocado"},
    "sauces_condiments":  {"salt", "smooth tomato sauce"},
    "herbs_spices":       {"mild herb"},
}

# ---------------------------------------------------------------------------
# Corridor and line visual centres (for zoom level calculations)
# ---------------------------------------------------------------------------

CORRIDOR_CENTERS = {
    "protein":   {"x": 580,  "y": 1020},
    "carbs":     {"x": 880,  "y": 580 },
    "fats":      {"x": 1420, "y": 900 },
    "seasoning": {"x": 1320, "y": 1420},
}

LINE_CENTERS = {
    "meat_fish":          {"x": 470,  "y": 1085},
    "eggs_dairy":         {"x": 510,  "y": 1260},
    "vegetable_protein":  {"x": 490,  "y": 740 },
    "grains":             {"x": 890,  "y": 490 },
    "vegetables":         {"x": 760,  "y": 490 },
    "fruit":              {"x": 1120, "y": 570 },
    "oils":               {"x": 1460, "y": 740 },
    "dairy_fats":         {"x": 1540, "y": 990 },
    "nuts_seeds":         {"x": 1460, "y": 1260},
    "sauces_condiments":  {"x": 1310, "y": 1520},
    "herbs_spices":       {"x": 890,  "y": 1620},
}

LINE_TO_GROUP = {
    "meat_fish": "protein", "eggs_dairy": "protein", "vegetable_protein": "protein",
    "grains": "carbs", "vegetables": "carbs", "fruit": "carbs",
    "oils": "fats", "dairy_fats": "fats", "nuts_seeds": "fats",
    "sauces_condiments": "seasoning", "herbs_spices": "seasoning",
}

# ---------------------------------------------------------------------------
# Step 4: Build station specs from registry data
# ---------------------------------------------------------------------------

def build_station_specs(stations: list[dict]) -> dict[str, list[tuple]]:
    """
    Group stations by line, sorted by lineOrder within each zone.
    Returns dict: line -> list of (canonical, zone_key, lineOrder, isRepresentative)
    """
    by_line = defaultdict(list)
    for s in stations:
        line = s["line"]
        is_rep = s["canonical"] in REPRESENTATIVE_STATIONS.get(line, set())
        by_line[line].append((s["canonical"], s["zone_key"], s["lineOrder"], is_rep))

    # Sort each line by zone order then lineOrder
    zone_order = {"1A": 0, "1B": 1, "2": 2, "3": 3}
    for line in by_line:
        by_line[line].sort(key=lambda x: (zone_order[x[1]], x[2]))

    return dict(by_line)

# ---------------------------------------------------------------------------
# Step 5: Generate TypeScript output
# ---------------------------------------------------------------------------

def format_station_spec(spec: tuple) -> str:
    canonical, zone, lineorder, is_rep = spec
    rep_str = "true " if is_rep else "false"
    return f'    ["{canonical}", "{zone}", {lineorder:2d}, {rep_str}],'

def format_line_specs(line: str, specs: list[tuple]) -> str:
    lines_out = [f"  // {line}: {len(specs)} stations"]
    lines_out.append(f"  {line}: [")
    for spec in specs:
        lines_out.append(f"  {format_station_spec(spec)}")
    lines_out.append("  ],")
    lines_out.append("")
    return "\n".join(lines_out)

def generate_typescript(stations: list[dict], station_specs: dict) -> str:
    """Generate the complete useTransitMapGeometry.ts file content."""

    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    total = len(stations)
    zone_counts = Counter(s["zone_key"] for s in stations)

    # Build STATION_SPECS block
    specs_lines = []
    for line in EXPECTED_LINES:
        specs = station_specs.get(line, [])
        specs_lines.append(format_line_specs(line, specs))
    specs_block = "\n".join(specs_lines)

    # Build LINE_PATHS block
    paths_lines = []
    for line in EXPECTED_LINES:
        group = LINE_TO_GROUP[line]
        path = LINE_PATHS[line]
        count = len(station_specs.get(line, []))
        paths_lines.append(f"  // {line} ({group}) — {count} stations")
        paths_lines.append(f'  {line}:')
        paths_lines.append(f'    "{path}",')
        paths_lines.append("")
    paths_block = "\n".join(paths_lines)

    # Build LINE_COLORS block
    colors_lines = []
    for line in EXPECTED_LINES:
        c = LINE_COLORS[line]
        colors_lines.append(
            f'  {line}:'
            f' {{ color: "{c["color"]}", colorDimmed: "{c["colorDimmed"]}" }},'
        )
    colors_block = "\n".join(colors_lines)

    # Build ZONE_RINGS block
    rings_lines = []
    for z, radius in ZONE_RADII.items():
        color = ZONE_RING_COLORS[z]
        label = f"Zone {z}"
        rings_lines.append(
            f'  {{ zone: "{z}", radius: {radius}, '
            f'label: "{label}", color: "{color}" }},'
        )
    rings_block = "\n".join(rings_lines)

    # Build CORRIDOR_CENTERS block
    cc_lines = []
    for group, c in CORRIDOR_CENTERS.items():
        cc_lines.append(f'  {group}: {{ x: {c["x"]}, y: {c["y"]} }},')
    cc_block = "\n".join(cc_lines)

    # Build LINE_CENTERS block
    lc_lines = []
    for line in EXPECTED_LINES:
        c = LINE_CENTERS[line]
        lc_lines.append(f'  {line}: {{ x: {c["x"]}, y: {c["y"]} }},')
    lc_block = "\n".join(lc_lines)

    # Build ZONE_SEGMENTS block
    zs_lines = []
    for z, (start, end) in ZONE_SEGMENTS.items():
        zs_lines.append(f'  "{z}": [{start:.2f}, {end:.2f}],')
    zs_block = "\n".join(zs_lines)

    ts = f'''/**
 * useTransitMapGeometry.ts
 *
 * Geometry Manifest for the Caca Traca Digestive Transit Map.
 * Sprint 2.7 — WQ-320
 *
 * AUTO-GENERATED by generate_transit_map_geometry.py
 * Generated: {now}
 * Registry stations: {total} ({zone_counts.get("1A",0)} Zone 1A + {zone_counts.get("1B",0)} Zone 1B + {zone_counts.get("2",0)} Zone 2 + {zone_counts.get("3",0)} Zone 3)
 *
 * DO NOT EDIT STATION SPECS MANUALLY.
 * To update: edit shared/foodRegistryData.ts, then re-run:
 *   python3 generate_transit_map_geometry.py
 *
 * To change the map layout (paths, colours, zoom centres):
 *   edit generate_transit_map_geometry.py — GEOMETRY CONFIGURATION section.
 *
 * All coordinates are on a 2000×2000 SVG ViewBox grid, center (1000, 1000).
 */

import type {{ FoodGroup, FoodLine }} from "@shared/foodRegistry";

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface StationPosition {{
  /** Matches registry canonical exactly — e.g. "white rice" */
  canonical: string;
  x: number;
  y: number;
  zone: "1A" | "1B" | "2" | "3";
  lineOrder: number;
  /** Shown as label at overview / corridor zoom level */
  isRepresentative: boolean;
}}

export interface LineGeometry {{
  line: FoodLine;
  group: FoodGroup;
  /** SVG path d attribute — cubic Bezier, radiates from center outward */
  path: string;
  color: string;
  colorDimmed: string;
  stations: StationPosition[];
}}

export interface ZoneRing {{
  zone: "1A" | "1B" | "2" | "3";
  radius: number;
  label: string;
  color: string;
}}

export interface Interchange {{
  line: FoodLine;
  zone: "1A" | "1B" | "2" | "3";
  x: number;
  y: number;
}}

export interface ZoomLevel {{
  level: 1 | 2 | 3 | 4;
  name: "overview" | "corridor" | "line" | "station";
  scale: number;
  translateX: number;
  translateY: number;
}}

export interface MapGeometry {{
  viewBox: {{ width: 2000; height: 2000 }};
  center: {{ x: 1000; y: 1000 }};
  zoneRings: ZoneRing[];
  lines: LineGeometry[];
  interchanges: Interchange[];
  zoomLevels: {{
    overview: ZoomLevel;
    corridor: (group: FoodGroup) => ZoomLevel;
    line: (line: FoodLine) => ZoomLevel;
    station: (canonical: string) => ZoomLevel;
  }};
}}

// ---------------------------------------------------------------------------
// Zone ring radii — monotonically increasing: 1A < 1B < 2 < 3
// ---------------------------------------------------------------------------

export const ZONE_RADII: Record<"1A" | "1B" | "2" | "3", number> = {{
  "1A": {ZONE_RADII["1A"]},
  "1B": {ZONE_RADII["1B"]},
  "2":  {ZONE_RADII["2"]},
  "3":  {ZONE_RADII["3"]},
}};

export const ZONE_RINGS: ZoneRing[] = [
{rings_block}
];

// ---------------------------------------------------------------------------
// Status colours (from evidence engine)
// ---------------------------------------------------------------------------

export const STATUS_COLORS = {{
  untested: "rgba(160,160,160,0.30)",
  building: "#3b82f6",
  safe:     "#22c55e",
  watch:    "#f59e0b",
  avoid:    "#ef4444",
}} as const;

// ---------------------------------------------------------------------------
// Corridor colour palette
// ---------------------------------------------------------------------------

export const LINE_COLORS: Record<FoodLine, {{ color: string; colorDimmed: string }}> = {{
{colors_block}
}};

// ---------------------------------------------------------------------------
// SVG Path Definitions — 11 organic cubic Bezier curves on 2000×2000 grid
// ---------------------------------------------------------------------------
//
// Angular layout (degrees from positive-x axis, SVG convention):
//   Protein corridor:    ~145° – 215°   (west)
//   Carbs corridor:      ~240° – 310°   (north-west)
//   Fats corridor:       ~330° –  40°   (north-east / east)
//   Seasoning corridor:   ~50° – 115°   (south-east)
//
// To redesign the map: edit LINE_PATHS in generate_transit_map_geometry.py

export const LINE_PATHS: Record<FoodLine, string> = {{
{paths_block}
}};

// ---------------------------------------------------------------------------
// Zone segment fractions along each path
// ---------------------------------------------------------------------------

export const ZONE_SEGMENTS: Record<"1A" | "1B" | "2" | "3", [number, number]> = {{
{zs_block}
}};

export const STATION_RADIUS = {STATION_RADIUS};
export const HITBOX_RADIUS  = {HITBOX_RADIUS};
export const MIN_SPACING    = {MIN_SPACING};

// ---------------------------------------------------------------------------
// Station Registry — auto-generated from shared/foodRegistryData.ts
// ---------------------------------------------------------------------------
//
// Format: [canonical, zone, lineOrder, isRepresentative]
// DO NOT EDIT MANUALLY. Re-run generate_transit_map_geometry.py instead.

type ZoneId = "1A" | "1B" | "2" | "3";
type StationSpec = [string, ZoneId, number, boolean];

export const STATION_SPECS: Record<FoodLine, StationSpec[]> = {{

{specs_block}
}};

// ---------------------------------------------------------------------------
// Corridor and line visual centres (for zoom level calculations)
// ---------------------------------------------------------------------------

const CORRIDOR_CENTERS: Record<FoodGroup, {{ x: number; y: number }}> = {{
{cc_block}
}};

const LINE_CENTERS: Record<FoodLine, {{ x: number; y: number }}> = {{
{lc_block}
}};

// ---------------------------------------------------------------------------
// Zoom level helper
// ---------------------------------------------------------------------------

function zoomTo(
  level: 1 | 2 | 3 | 4,
  name: ZoomLevel["name"],
  scale: number,
  cx: number,
  cy: number
): ZoomLevel {{
  const half = 1000;
  return {{
    level,
    name,
    scale,
    translateX: half / scale - cx,
    translateY: half / scale - cy,
  }};
}}

// ---------------------------------------------------------------------------
// Pure-TypeScript Bezier math (SSR-safe, no DOM required)
// ---------------------------------------------------------------------------

function cubicBezierPoint(
  p0: [number, number], p1: [number, number],
  p2: [number, number], p3: [number, number],
  t: number
): [number, number] {{
  const mt = 1 - t;
  return [
    mt*mt*mt*p0[0] + 3*mt*mt*t*p1[0] + 3*mt*t*t*p2[0] + t*t*t*p3[0],
    mt*mt*mt*p0[1] + 3*mt*mt*t*p1[1] + 3*mt*t*t*p2[1] + t*t*t*p3[1],
  ];
}}

function buildArcLengthTable(
  p0: [number, number], p1: [number, number],
  p2: [number, number], p3: [number, number],
  steps = 200
): number[] {{
  const table: number[] = [0];
  let prev = p0;
  for (let i = 1; i <= steps; i++) {{
    const curr = cubicBezierPoint(p0, p1, p2, p3, i / steps);
    const dx = curr[0] - prev[0], dy = curr[1] - prev[1];
    table.push(table[i - 1] + Math.sqrt(dx * dx + dy * dy));
    prev = curr;
  }}
  return table;
}}

function getPointAtFraction(
  p0: [number, number], p1: [number, number],
  p2: [number, number], p3: [number, number],
  fraction: number, table: number[]
): [number, number] {{
  const totalLen = table[table.length - 1];
  const target = fraction * totalLen;
  const steps = table.length - 1;
  let lo = 0, hi = steps;
  while (lo < hi - 1) {{
    const mid = (lo + hi) >> 1;
    if (table[mid] < target) lo = mid; else hi = mid;
  }}
  const segFrac = table[lo] === table[hi]
    ? lo / steps
    : (lo + (target - table[lo]) / (table[hi] - table[lo])) / steps;
  return cubicBezierPoint(p0, p1, p2, p3, segFrac);
}}

function parseCubicPath(d: string): {{
  p0: [number, number]; p1: [number, number];
  p2: [number, number]; p3: [number, number];
}} {{
  const clean = d.replace(/\\s+/g, " ").trim();
  const mMatch = clean.match(/M\\s*([\\d.]+)\\s+([\\d.]+)/);
  const cMatch = clean.match(
    /C\\s*([\\d.]+)\\s+([\\d.]+)[,\\s]+([\\d.]+)\\s+([\\d.]+)[,\\s]+([\\d.]+)\\s+([\\d.]+)/
  );
  if (!mMatch || !cMatch) throw new Error(`Cannot parse path: ${{d}}`);
  return {{
    p0: [parseFloat(mMatch[1]), parseFloat(mMatch[2])],
    p1: [parseFloat(cMatch[1]), parseFloat(cMatch[2])],
    p2: [parseFloat(cMatch[3]), parseFloat(cMatch[4])],
    p3: [parseFloat(cMatch[5]), parseFloat(cMatch[6])],
  }};
}}

// ---------------------------------------------------------------------------
// Station interpolation (shared logic)
// ---------------------------------------------------------------------------

function interpolateStationsStatic(
  pathD: string,
  specs: StationSpec[]
): StationPosition[] {{
  const {{ p0, p1, p2, p3 }} = parseCubicPath(pathD);
  const table = buildArcLengthTable(p0, p1, p2, p3);

  const byZone: Record<ZoneId, StationSpec[]> = {{ "1A": [], "1B": [], "2": [], "3": [] }};
  for (const spec of specs) byZone[spec[1]].push(spec);
  for (const zone of ["1A", "1B", "2", "3"] as ZoneId[]) {{
    byZone[zone].sort((a, b) => a[2] - b[2]);
  }}

  const positions: StationPosition[] = [];
  for (const zone of ["1A", "1B", "2", "3"] as ZoneId[]) {{
    const zoneSpecs = byZone[zone];
    if (zoneSpecs.length === 0) continue;
    const [segStart, segEnd] = ZONE_SEGMENTS[zone];
    const count = zoneSpecs.length;
    for (let i = 0; i < count; i++) {{
      const spec = zoneSpecs[i];
      const t = segStart + (segEnd - segStart) * ((i + 1) / (count + 1));
      const [x, y] = getPointAtFraction(p0, p1, p2, p3, t, table);
      positions.push({{
        canonical:        spec[0],
        x:                Math.round(x * 10) / 10,
        y:                Math.round(y * 10) / 10,
        zone,
        lineOrder:        spec[2],
        isRepresentative: spec[3],
      }});
    }}
  }}
  return positions;
}}

// ---------------------------------------------------------------------------
// Interchange positions (zone boundary crossings)
// ---------------------------------------------------------------------------

function computeInterchangesStatic(line: FoodLine, pathD: string): Interchange[] {{
  const {{ p0, p1, p2, p3 }} = parseCubicPath(pathD);
  const table = buildArcLengthTable(p0, p1, p2, p3);
  const boundaries: Array<[ZoneId, number]> = [
    ["1A", ZONE_SEGMENTS["1A"][1]],
    ["1B", ZONE_SEGMENTS["1B"][1]],
    ["2",  ZONE_SEGMENTS["2"][1]],
  ];
  return boundaries.map(([zone, t]) => {{
    const [x, y] = getPointAtFraction(p0, p1, p2, p3, t, table);
    return {{ line, zone, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 }};
  }});
}}

// ---------------------------------------------------------------------------
// Line group helper
// ---------------------------------------------------------------------------

function lineGroup(line: FoodLine): FoodGroup {{
  if (line === "meat_fish" || line === "eggs_dairy" || line === "vegetable_protein")
    return "protein";
  if (line === "grains" || line === "vegetables" || line === "fruit")
    return "carbs";
  if (line === "oils" || line === "dairy_fats" || line === "nuts_seeds")
    return "fats";
  return "seasoning";
}}

// ---------------------------------------------------------------------------
// getStaticTransitMapGeometry — SSR-safe, no DOM required
// ---------------------------------------------------------------------------

let _staticCache: MapGeometry | null = null;

/**
 * Returns the complete MapGeometry using pure-TypeScript Bezier math.
 * Safe to call on the server (Next.js, Remix) or in a Worker.
 * Result is memoised after first call.
 */
export function getStaticTransitMapGeometry(): MapGeometry {{
  if (_staticCache) return _staticCache;

  const allLines = Object.keys(STATION_SPECS) as FoodLine[];
  const lines: LineGeometry[] = allLines.map((line) => {{
    const pathD = LINE_PATHS[line];
    const specs = STATION_SPECS[line];
    const {{ color, colorDimmed }} = LINE_COLORS[line];
    const group = lineGroup(line);
    const stations = interpolateStationsStatic(pathD, specs);
    return {{ line, group, path: pathD, color, colorDimmed, stations }};
  }});

  const interchanges: Interchange[] = lines.flatMap((lg) =>
    computeInterchangesStatic(lg.line, lg.path)
  );

  const stationLookup = new Map(
    lines.flatMap((lg) => lg.stations.map((s) => [s.canonical, s]))
  );

  const zoomLevels: MapGeometry["zoomLevels"] = {{
    overview: zoomTo(1, "overview", 1.0, 1000, 1000),
    corridor: (group: FoodGroup) => {{
      const c = CORRIDOR_CENTERS[group];
      return zoomTo(2, "corridor", 1.6, c.x, c.y);
    }},
    line: (line: FoodLine) => {{
      const c = LINE_CENTERS[line];
      return zoomTo(3, "line", 2.8, c.x, c.y);
    }},
    station: (canonical: string) => {{
      const s = stationLookup.get(canonical);
      return zoomTo(4, "station", 5.0, s?.x ?? 1000, s?.y ?? 1000);
    }},
  }};

  _staticCache = {{
    viewBox:   {{ width: 2000, height: 2000 }},
    center:    {{ x: 1000, y: 1000 }},
    zoneRings: ZONE_RINGS,
    lines,
    interchanges,
    zoomLevels,
  }};
  return _staticCache;
}}

// ---------------------------------------------------------------------------
// useTransitMapGeometry — browser hook (uses SVGPathElement for precision)
// ---------------------------------------------------------------------------

function interpolateStationsBrowser(
  pathD: string,
  specs: StationSpec[]
): StationPosition[] {{
  if (typeof document === "undefined") {{
    return interpolateStationsStatic(pathD, specs);
  }}

  const svgNS = "http://www.w3.org/2000/svg";
  const pathEl = document.createElementNS(svgNS, "path") as SVGPathElement;
  pathEl.setAttribute("d", pathD);
  const svgEl = document.createElementNS(svgNS, "svg") as SVGSVGElement;
  svgEl.setAttribute("viewBox", "0 0 2000 2000");
  svgEl.style.cssText = "position:absolute;visibility:hidden;pointer-events:none;width:0;height:0;";
  svgEl.appendChild(pathEl);
  document.body.appendChild(svgEl);

  const totalLength = pathEl.getTotalLength();
  const byZone: Record<ZoneId, StationSpec[]> = {{ "1A": [], "1B": [], "2": [], "3": [] }};
  for (const spec of specs) byZone[spec[1]].push(spec);
  for (const zone of ["1A", "1B", "2", "3"] as ZoneId[]) {{
    byZone[zone].sort((a, b) => a[2] - b[2]);
  }}

  const positions: StationPosition[] = [];
  for (const zone of ["1A", "1B", "2", "3"] as ZoneId[]) {{
    const zoneSpecs = byZone[zone];
    if (zoneSpecs.length === 0) continue;
    const [segStart, segEnd] = ZONE_SEGMENTS[zone];
    const count = zoneSpecs.length;
    for (let i = 0; i < count; i++) {{
      const spec = zoneSpecs[i];
      const t = segStart + (segEnd - segStart) * ((i + 1) / (count + 1));
      const pt = pathEl.getPointAtLength(t * totalLength);
      positions.push({{
        canonical:        spec[0],
        x:                Math.round(pt.x * 10) / 10,
        y:                Math.round(pt.y * 10) / 10,
        zone,
        lineOrder:        spec[2],
        isRepresentative: spec[3],
      }});
    }}
  }}

  document.body.removeChild(svgEl);
  return positions;
}}

let _browserCache: MapGeometry | null = null;

/**
 * useTransitMapGeometry
 *
 * Returns the complete MapGeometry for the Caca Traca transit map.
 * Computed once on first call and cached — stable reference for React memoisation.
 * Must be called in a browser context. For SSR use getStaticTransitMapGeometry().
 */
export function useTransitMapGeometry(): MapGeometry {{
  if (_browserCache) return _browserCache;

  const allLines = Object.keys(STATION_SPECS) as FoodLine[];
  const lines: LineGeometry[] = allLines.map((line) => {{
    const pathD = LINE_PATHS[line];
    const specs = STATION_SPECS[line];
    const {{ color, colorDimmed }} = LINE_COLORS[line];
    const group = lineGroup(line);
    const stations = interpolateStationsBrowser(pathD, specs);
    return {{ line, group, path: pathD, color, colorDimmed, stations }};
  }});

  const interchanges: Interchange[] = lines.flatMap((lg) =>
    computeInterchangesStatic(lg.line, lg.path)
  );

  const stationLookup = new Map(
    lines.flatMap((lg) => lg.stations.map((s) => [s.canonical, s]))
  );

  const zoomLevels: MapGeometry["zoomLevels"] = {{
    overview: zoomTo(1, "overview", 1.0, 1000, 1000),
    corridor: (group: FoodGroup) => {{
      const c = CORRIDOR_CENTERS[group];
      return zoomTo(2, "corridor", 1.6, c.x, c.y);
    }},
    line: (line: FoodLine) => {{
      const c = LINE_CENTERS[line];
      return zoomTo(3, "line", 2.8, c.x, c.y);
    }},
    station: (canonical: string) => {{
      const s = stationLookup.get(canonical);
      return zoomTo(4, "station", 5.0, s?.x ?? 1000, s?.y ?? 1000);
    }},
  }};

  _browserCache = {{
    viewBox:   {{ width: 2000, height: 2000 }},
    center:    {{ x: 1000, y: 1000 }},
    zoneRings: ZONE_RINGS,
    lines,
    interchanges,
    zoomLevels,
  }};
  return _browserCache;
}}

// ---------------------------------------------------------------------------
// SVG Rendering Reference (usage snippets for TransitMapCanvas.tsx)
// ---------------------------------------------------------------------------
//
// Track path — zoom-invariant stroke weight:
//   <path d={{lg.path}} stroke={{lg.color}} strokeWidth={{3}} fill="none"
//         vectorEffect="non-scaling-stroke" />
//
// Visible station circle:
//   <circle cx={{s.x}} cy={{s.y}} r={{6}} fill={{statusColor}} />
//
// Invisible hitbox — 44px touch target (WCAG 2.5.8):
//   <circle cx={{s.x}} cy={{s.y}} r={{22}} fill="transparent"
//           style={{{{ cursor: "pointer" }}}} aria-label={{s.canonical}}
//           onClick={{() => onStationFocus(s.canonical)}} />
//
// Zone ring arc:
//   <circle cx={{1000}} cy={{1000}} r={{ring.radius}} fill="none"
//           stroke={{ring.color}} strokeWidth={{1}}
//           vectorEffect="non-scaling-stroke" />
//
// Zoom level 4 — inspector NEVER overlays the map (side-by-side only):
//   <div style={{{{ display: "flex" }}}}>
//     <svg style={{{{ flex: "0 0 50%" }}}}>{{/* zoomed station cluster */}}</svg>
//     <div style={{{{ flex: "0 0 50%" }}}}>{{/* StationCallout — sibling, not overlay */}}</div>
//   </div>

export {{ CORRIDOR_CENTERS, LINE_CENTERS }};
'''
    return ts

# ---------------------------------------------------------------------------
# Step 6: Validate the generated output
# ---------------------------------------------------------------------------

def validate_output(ts_content: str, stations: list[dict]) -> bool:
    """Cross-check the generated TypeScript against the registry."""
    ok = True
    print(f"\n{'='*60}")
    print(f"OUTPUT VALIDATION")
    print(f"{'='*60}")

    # Count station entries in output
    hook_canonicals = re.findall(
        r'"([^"]+)",\s*"[123][AB]?",\s*\d+,\s*(?:true|false)', ts_content
    )
    print(f"Station entries in output: {len(hook_canonicals)}")

    registry_canonicals = {s["canonical"] for s in stations}
    hook_set = set(hook_canonicals)

    not_in_registry = hook_set - registry_canonicals
    not_in_hook = registry_canonicals - hook_set

    if not_in_registry:
        print(f"  ERROR: In output but NOT in registry: {not_in_registry}")
        ok = False
    else:
        print(f"  All output canonicals exist in registry ✓")

    if not_in_hook:
        print(f"  ERROR: In registry but NOT in output: {not_in_hook}")
        ok = False
    else:
        print(f"  All registry canonicals present in output ✓")

    # Zone assignments
    registry_map = {s["canonical"]: s for s in stations}
    zone_mismatches = []
    for m in re.finditer(r'"([^"]+)",\s*"([123][AB]?)",\s*(\d+),\s*(?:true|false)', ts_content):
        canonical, zone = m.group(1), m.group(2)
        reg = registry_map.get(canonical)
        if reg and reg["zone_key"] != zone:
            zone_mismatches.append(f"{canonical}: output={zone} registry={reg['zone_key']}")

    if zone_mismatches:
        print(f"  Zone mismatches: {zone_mismatches}")
        ok = False
    else:
        print(f"  All zone assignments correct ✓")

    print(f"\nOutput validation: {'PASSED ✓' if ok else 'FAILED ✗'}")
    print(f"{'='*60}\n")
    return ok

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    args = parse_args()

    print(f"\nCaca Traca — Transit Map Geometry Generator")
    print(f"Registry: {args.registry}")
    print(f"Output:   {args.output}")

    # Parse registry
    stations = parse_registry(args.registry)

    # Validate registry
    registry_ok = validate_registry(stations)
    if not registry_ok:
        print("Registry validation failed. Fix the issues above and re-run.")
        sys.exit(1)

    # Build station specs
    station_specs = build_station_specs(stations)

    # Generate TypeScript
    ts_content = generate_typescript(stations, station_specs)

    # Validate output
    output_ok = validate_output(ts_content, stations)
    if not output_ok:
        print("Output validation failed. This is a bug in the generator.")
        sys.exit(1)

    if args.dry_run:
        print("Dry run — output file not written.")
        return

    if args.validate_only:
        output_path = Path(args.output)
        if output_path.exists():
            existing = output_path.read_text(encoding="utf-8")
            validate_output(existing, stations)
        else:
            print(f"Output file not found: {args.output}")
        return

    # Write output
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(ts_content, encoding="utf-8")

    size_kb = len(ts_content) / 1024
    lines = ts_content.count('\n')
    print(f"Written: {args.output}")
    print(f"  Size: {size_kb:.1f} KB, {lines} lines")
    print(f"  Stations: {len(stations)}")
    print(f"\nDone. ✓\n")

if __name__ == "__main__":
    main()
