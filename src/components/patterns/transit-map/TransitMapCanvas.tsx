/**
 * TransitMapCanvas — Core SVG transit map renderer.
 *
 * Sprint 2.7 — WQ-400 (visual upgrade)
 *
 * Renders a London-tube-map-style radial transit map on a 2000x2000 SVG.
 * Thick corridor lines, large station circles with status colors,
 * zone region fills, corridor labels, and representative station names.
 *
 * Layer order (bottom to top):
 *   1. Zone region fills — concentric circles with gradient fills
 *   2. Zone ring borders — subtle dashed boundaries
 *   3. Line track shadows — dark shadow behind each line for depth
 *   4. Line tracks — 11 thick Bezier paths with corridor colors
 *   5. Station circles — large circles with status fill + line-color border
 *   6. Station labels — representative station names
 *   7. Corridor labels — group names at the periphery
 *   8. Hitbox circles — invisible touch targets (WCAG 2.5.8)
 *
 * Geometry is computed once and cached. Evidence updates reactively.
 */

import { formatCanonicalFoodDisplayName } from "@shared/foodNormalize";
import type { FoodGroup, FoodLine } from "@shared/foodRegistry";
import { getGroupDisplayName, getLineDisplayName } from "@shared/foodRegistry";
import type { ReactNode } from "react";
import { memo, useCallback, useMemo } from "react";
import { useTransitMapData } from "@/hooks/useTransitMapData";
import {
  HITBOX_RADIUS,
  type LineGeometry,
  STATUS_COLORS,
  useTransitMapGeometry,
  ZONE_RADII,
  type ZoneRing,
} from "@/hooks/useTransitMapGeometry";
import type { FoodStat } from "@/lib/analysis";
import type { TransitNetwork } from "@/types/transitMap";

// ── Visual constants (rendering only — geometry uses its own) ──────────

/** Station circle radius for display */
const DISPLAY_STATION_R = 18;
/** Selected station gets a larger circle */
const DISPLAY_STATION_R_SELECTED = 24;
/** Track line width */
const TRACK_STROKE = 10;
/** Shadow behind track lines */
const TRACK_SHADOW_STROKE = 18;
/** Zone label font size */
const ZONE_LABEL_SIZE = 28;
/** Corridor label font size */
const CORRIDOR_LABEL_SIZE = 18;
/** Station name label font size */
const STATION_LABEL_SIZE = 13;

// ── Background gradient as SVG defs ────────────────────────────────────

const ZONE_FILLS: Record<string, { fill: string; opacity: number }> = {
  "1A": { fill: "#86efac", opacity: 0.06 },
  "1B": { fill: "#7dd3fc", opacity: 0.05 },
  "2": { fill: "#fbbf24", opacity: 0.04 },
  "3": { fill: "#f87171", opacity: 0.03 },
};

// ── Props ────────────────────────────────────────────────────────────────

export interface TransitMapCanvasProps {
  foodStats: FoodStat[];
  network?: TransitNetwork;
  onStationSelect?: (canonical: string) => void;
  onLineSelect?: (line: FoodLine) => void;
  onCorridorSelect?: (group: FoodGroup) => void;
  svgTransform?: string;
  svgTransition?: string;
  selectedStation?: string | null;
  zoomLevel?: "overview" | "corridor" | "line" | "station";
  className?: string;
}

// ── Status color resolver ────────────────────────────────────────────────

function getStationColor(canonical: string, network: TransitNetwork): string {
  const station = network.stationsByCanonical.get(canonical);
  if (!station || station.primaryStatus === null) {
    return STATUS_COLORS.untested;
  }
  return STATUS_COLORS[station.primaryStatus] ?? STATUS_COLORS.untested;
}

// ── Zone fills — filled concentric circles for zone regions ─────────────

function ZoneFillLayer({ rings }: { rings: ZoneRing[] }): ReactNode {
  // Render from outermost to innermost so inner zones paint on top
  const reversed = [...rings].reverse();
  return (
    <g data-slot="transit-map-zone-fills">
      {reversed.map((ring) => {
        const zf = ZONE_FILLS[ring.zone];
        return (
          <circle
            key={`fill-${ring.zone}`}
            cx={1000}
            cy={1000}
            r={ring.radius}
            fill={zf.fill}
            opacity={zf.opacity}
          />
        );
      })}
    </g>
  );
}

// ── Zone ring borders — dashed circle boundaries ────────────────────────

function ZoneRingLayer({ rings }: { rings: ZoneRing[] }): ReactNode {
  return (
    <g data-slot="transit-map-zone-rings">
      {rings.map((ring) => (
        <circle
          key={ring.zone}
          cx={1000}
          cy={1000}
          r={ring.radius}
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={1.5}
          strokeDasharray="8 6"
        />
      ))}
    </g>
  );
}

// ── Zone labels — positioned along each ring arc ────────────────────────

function ZoneLabelLayer({ rings }: { rings: ZoneRing[] }): ReactNode {
  // Place labels at -40 degrees for readable positioning
  const angle = (-40 * Math.PI) / 180;
  return (
    <g data-slot="transit-map-zone-labels">
      {rings.map((ring) => {
        const labelX = 1000 + ring.radius * Math.cos(angle);
        const labelY = 1000 + ring.radius * Math.sin(angle);
        return (
          <g key={ring.zone}>
            {/* Background pill for readability */}
            <rect
              x={labelX - 45}
              y={labelY - 14}
              width={90}
              height={28}
              rx={14}
              fill="rgba(2,6,23,0.75)"
            />
            <text
              x={labelX}
              y={labelY + 1}
              fill="rgba(255,255,255,0.5)"
              fontSize={ZONE_LABEL_SIZE}
              fontFamily="var(--font-mono, monospace)"
              fontWeight={600}
              textAnchor="middle"
              dominantBaseline="central"
              letterSpacing="0.08em"
              pointerEvents="none"
              style={{ userSelect: "none" }}
            >
              {ring.label}
            </text>
          </g>
        );
      })}
    </g>
  );
}

// ── Line tracks — thick colored paths with shadow ───────────────────────

function LineTrackLayer({
  lines,
  onLineSelect,
}: {
  lines: LineGeometry[];
  onLineSelect?: (line: FoodLine) => void;
}): ReactNode {
  return (
    <g data-slot="transit-map-line-tracks">
      {/* Shadow pass — darker, wider, behind the color stroke */}
      {lines.map((lg) => (
        <path
          key={`${lg.line}-shadow`}
          d={lg.path}
          stroke="rgba(2,6,23,0.7)"
          strokeWidth={TRACK_SHADOW_STROKE}
          strokeLinecap="round"
          fill="none"
          pointerEvents="none"
        />
      ))}
      {/* Color pass — the visible colored track */}
      {lines.map((lg) => (
        <path
          key={lg.line}
          d={lg.path}
          stroke={lg.color}
          strokeWidth={TRACK_STROKE}
          strokeLinecap="round"
          fill="none"
          pointerEvents="none"
        />
      ))}
      {/* Hit paths for line click targets */}
      {onLineSelect !== undefined && (
        <g data-slot="transit-map-line-hitboxes">
          {lines.map((lg) => (
            <path
              key={`${lg.line}-hit`}
              d={lg.path}
              stroke="transparent"
              strokeWidth={TRACK_SHADOW_STROKE + 8}
              fill="none"
              pointerEvents="stroke"
              style={{ cursor: "pointer" }}
              role="button"
              aria-label={`${getLineDisplayName(lg.line)} line`}
              onClick={() => onLineSelect(lg.line)}
            />
          ))}
        </g>
      )}
    </g>
  );
}

// ── Station circles — large circles with status fill + line border ──────

const StationCircleLayer = memo(function StationCircleLayer({
  lines,
  network,
  selectedStation,
}: {
  lines: LineGeometry[];
  network: TransitNetwork;
  selectedStation: string | null;
}): ReactNode {
  return (
    <g data-slot="transit-map-station-circles">
      {lines.flatMap((lg) =>
        lg.stations.map((station) => {
          const statusColor = getStationColor(station.canonical, network);
          const isSelected = station.canonical === selectedStation;
          const r = isSelected ? DISPLAY_STATION_R_SELECTED : DISPLAY_STATION_R;
          // Zone 3 stations render smaller unless selected
          const isZone3 = station.zone === "3";
          const displayR = isZone3 && !isSelected ? r * 0.6 : r;

          return (
            <g key={`${lg.line}:${station.canonical}`}>
              {/* Outer glow ring for selected station */}
              {isSelected && (
                <circle
                  cx={station.x}
                  cy={station.y}
                  r={displayR + 8}
                  fill="none"
                  stroke={`${statusColor}55`}
                  strokeWidth={2}
                />
              )}
              {/* Dark background circle */}
              <circle cx={station.x} cy={station.y} r={displayR + 3} fill="rgba(2,6,23,0.85)" />
              {/* Status fill */}
              <circle
                cx={station.x}
                cy={station.y}
                r={displayR}
                fill={statusColor}
                opacity={isZone3 && !isSelected ? 0.5 : 1}
              />
              {/* Line-color border ring */}
              <circle
                cx={station.x}
                cy={station.y}
                r={displayR + 1}
                fill="none"
                stroke={lg.color}
                strokeWidth={isSelected ? 3.5 : 2.5}
              />
              {/* Station initials for larger stations */}
              {displayR >= 14 && station.isRepresentative && (
                <text
                  x={station.x}
                  y={station.y + 1}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#fff"
                  fontSize={displayR * 0.65}
                  fontFamily="var(--font-mono, monospace)"
                  fontWeight={700}
                  pointerEvents="none"
                  style={{ userSelect: "none" }}
                >
                  {station.canonical
                    .split(" ")
                    .map((w) => w[0]?.toUpperCase() ?? "")
                    .join("")
                    .slice(0, 2)}
                </text>
              )}
            </g>
          );
        }),
      )}
    </g>
  );
});

// ── Station name labels — for representative stations ───────────────────

function StationNameLayer({ lines }: { lines: LineGeometry[] }): ReactNode {
  return (
    <g data-slot="transit-map-station-names">
      {lines.flatMap((lg) =>
        lg.stations
          .filter((s) => s.isRepresentative)
          .map((station) => {
            const displayName = formatCanonicalFoodDisplayName(station.canonical);
            // Offset label position based on which side of center the station is
            const dx = station.x - 1000;
            const textAnchor = dx < -50 ? "end" : dx > 50 ? "start" : "middle";
            const labelOffsetX = dx < -50 ? -22 : dx > 50 ? 22 : 0;
            const labelOffsetY = -26;

            return (
              <g key={`label-${station.canonical}`}>
                {/* Background pill */}
                <rect
                  x={
                    station.x +
                    labelOffsetX -
                    (textAnchor === "middle" ? 40 : textAnchor === "end" ? 80 : 0)
                  }
                  y={station.y + labelOffsetY - 10}
                  width={80}
                  height={20}
                  rx={10}
                  fill="rgba(2,6,23,0.7)"
                  pointerEvents="none"
                />
                <text
                  x={station.x + labelOffsetX}
                  y={station.y + labelOffsetY}
                  textAnchor={textAnchor}
                  dominantBaseline="central"
                  fill="rgba(248,250,252,0.85)"
                  fontSize={STATION_LABEL_SIZE}
                  fontFamily="var(--font-sans, sans-serif)"
                  fontWeight={500}
                  pointerEvents="none"
                  style={{ userSelect: "none" }}
                >
                  {displayName}
                </text>
              </g>
            );
          }),
      )}
    </g>
  );
}

// ── Corridor labels — group names positioned at periphery ───────────────

function CorridorLabelLayer(): ReactNode {
  const corridors: Array<{ group: FoodGroup; angle: number }> = [
    { group: "protein", angle: 180 },
    { group: "carbs", angle: 270 },
    { group: "fats", angle: 0 },
    { group: "seasoning", angle: 90 },
  ];

  return (
    <g data-slot="transit-map-corridor-labels">
      {corridors.map(({ group, angle }) => {
        const rad = (angle * Math.PI) / 180;
        const labelR = ZONE_RADII["3"] + 60;
        const x = 1000 + labelR * Math.cos(rad);
        const y = 1000 + labelR * Math.sin(rad);

        return (
          <g key={group}>
            <rect
              x={x - 70}
              y={y - 14}
              width={140}
              height={28}
              rx={14}
              fill="rgba(2,6,23,0.8)"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth={1}
            />
            <text
              x={x}
              y={y + 1}
              textAnchor="middle"
              dominantBaseline="central"
              fill="rgba(248,250,252,0.75)"
              fontSize={CORRIDOR_LABEL_SIZE}
              fontFamily="var(--font-mono, monospace)"
              fontWeight={700}
              letterSpacing="0.15em"
              pointerEvents="none"
              style={{ userSelect: "none", textTransform: "uppercase" }}
            >
              {getGroupDisplayName(group)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

// ── Hitbox layer (unchanged) ────────────────────────────────────────────

const StationHitboxLayer = memo(function StationHitboxLayer({
  lines,
  onStationSelect,
}: {
  lines: LineGeometry[];
  onStationSelect?: (canonical: string) => void;
}): ReactNode {
  if (onStationSelect === undefined) {
    return null;
  }
  return (
    <g data-slot="transit-map-station-hitboxes">
      {lines.flatMap((lg) =>
        lg.stations.map((station) => (
          <circle
            key={`${lg.line}:${station.canonical}-hit`}
            cx={station.x}
            cy={station.y}
            r={Math.max(HITBOX_RADIUS, DISPLAY_STATION_R + 4)}
            fill="transparent"
            pointerEvents="auto"
            style={{ cursor: "pointer" }}
            role="button"
            aria-label={`${formatCanonicalFoodDisplayName(station.canonical)}, view station details`}
            onClick={() => onStationSelect(station.canonical)}
          />
        )),
      )}
    </g>
  );
});

// ── Main component ───────────────────────────────────────────────────────

export default function TransitMapCanvas({
  foodStats,
  network: networkProp,
  onStationSelect,
  onLineSelect,
  onCorridorSelect,
  svgTransform,
  svgTransition,
  selectedStation,
  zoomLevel = "overview",
  className,
}: TransitMapCanvasProps): ReactNode {
  const geometry = useTransitMapGeometry();
  const networkFromHook = useTransitMapData(foodStats);
  const network = networkProp ?? networkFromHook;

  const normalizedSelectedStation = selectedStation ?? null;

  const zoomGroupStyle = useMemo(() => {
    const style: Record<string, string> = {};
    if (svgTransform !== undefined) {
      style.transform = svgTransform;
    }
    if (svgTransition !== undefined) {
      style.transition = svgTransition;
    }
    return style;
  }, [svgTransform, svgTransition]);

  const handleBackgroundClick = useCallback(
    (event: React.MouseEvent<SVGRectElement>) => {
      if (onCorridorSelect === undefined) return;

      const svg = event.currentTarget.closest("svg");
      if (!svg) return;

      const pt = svg.createSVGPoint();
      pt.x = event.clientX;
      pt.y = event.clientY;
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const svgPt = pt.matrixTransform(ctm.inverse());

      const dx = svgPt.x - geometry.center.x;
      const dy = svgPt.y - geometry.center.y;

      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < ZONE_RADII["1A"]) return;

      const angle = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;

      let group: FoodGroup;
      if (angle >= 145 && angle < 215) {
        group = "protein";
      } else if (angle >= 215 && angle < 330) {
        group = "carbs";
      } else if (angle >= 330 || angle < 50) {
        group = "fats";
      } else {
        group = "seasoning";
      }

      onCorridorSelect(group);
    },
    [onCorridorSelect, geometry.center.x, geometry.center.y],
  );

  return (
    <svg
      data-slot="transit-map-canvas"
      viewBox={`0 0 ${geometry.viewBox.width} ${geometry.viewBox.height}`}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-labelledby="transit-map-title"
      {...(className !== undefined && { className })}
      style={{
        width: "100%",
        height: "100%",
        background:
          "radial-gradient(circle at 50% 50%, rgba(99,102,241,0.12), transparent 40%), " +
          "radial-gradient(circle at 20% 80%, rgba(45,212,191,0.08), transparent 30%), " +
          "radial-gradient(circle at 80% 20%, rgba(244,114,182,0.08), transparent 30%), " +
          "linear-gradient(180deg, #07111d 0%, #040912 100%)",
      }}
    >
      <title id="transit-map-title">Digestive Transit Map</title>

      <g data-slot="transit-map-zoom-group" style={zoomGroupStyle}>
        {/* Background click target */}
        <rect
          x={0}
          y={0}
          width={geometry.viewBox.width}
          height={geometry.viewBox.height}
          fill="transparent"
          pointerEvents={onCorridorSelect !== undefined ? "auto" : "none"}
          onClick={handleBackgroundClick}
          {...(onCorridorSelect !== undefined && {
            style: { cursor: "pointer" },
          })}
        />

        {/* Layer 1: Zone region fills */}
        <ZoneFillLayer rings={geometry.zoneRings} />

        {/* Layer 2: Zone ring borders */}
        <ZoneRingLayer rings={geometry.zoneRings} />

        {/* Layer 3+4: Line tracks with shadows */}
        <LineTrackLayer
          lines={geometry.lines}
          {...(onLineSelect !== undefined && { onLineSelect })}
        />

        {/* Layer 5: Station circles */}
        <StationCircleLayer
          lines={geometry.lines}
          network={network}
          selectedStation={normalizedSelectedStation}
        />

        {/* Layer 6: Station name labels */}
        {(zoomLevel === "overview" || zoomLevel === "corridor") && (
          <StationNameLayer lines={geometry.lines} />
        )}

        {/* Zone labels */}
        <ZoneLabelLayer rings={geometry.zoneRings} />

        {/* Corridor labels at periphery */}
        <CorridorLabelLayer />

        {/* Layer 7: Hitbox circles (invisible, interactive — on top) */}
        <StationHitboxLayer
          lines={geometry.lines}
          {...(onStationSelect !== undefined && { onStationSelect })}
        />
      </g>
    </svg>
  );
}
