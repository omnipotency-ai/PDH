/**
 * TransitMapWithLabels — Wrapper composing SVG canvas, HTML labels, and station inspector.
 *
 * Sprint 2.7 — WQ-402 + WQ-403
 *
 * Renders:
 *   1. TransitMapCanvas (the SVG map)
 *   2. HTML label overlay (positioned absolutely, tracks SVG transform)
 *   3. Station inspector panel (side-by-side at station zoom level)
 *
 * Label visibility varies by zoom level:
 *   - Overview:  representative stations only (isRepresentative: true)
 *   - Corridor:  representatives for the target corridor
 *   - Line:      all stations on the target line
 *   - Station:   none (detail is in the inspector panel)
 *
 * At zoom level 4 (station), layout splits side-by-side:
 *   Left:  zoomed SVG showing neighboring stations
 *   Right: StationInspector panel (NEVER overlays the map)
 */

import { formatCanonicalFoodDisplayName } from "@shared/foodNormalize";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { memo, useCallback, useMemo, useState } from "react";
import { useTransitMapData } from "@/hooks/useTransitMapData";
import {
  type LineGeometry,
  type StationPosition,
  useTransitMapGeometry,
} from "@/hooks/useTransitMapGeometry";
import { useTransitMapZoom } from "@/hooks/useTransitMapZoom";
import type { FoodStat } from "@/lib/analysis";
import StationInspector from "./StationInspector";
import TransitMapCanvas from "./TransitMapCanvas";

// ── Props ────────────────────────────────────────────────────────────────

export interface TransitMapWithLabelsProps {
  foodStats: FoodStat[];
}

// ── Zoom level → human-readable "back to" label ──────────────────────────

function zoomBackLabel(level: 1 | 2 | 3 | 4): string {
  switch (level) {
    case 2:
      return "overview";
    case 3:
      return "corridor";
    case 4:
      return "line";
    default:
      return "overview";
  }
}

// ── Visible station filtering ────────────────────────────────────────────

function getVisibleStations(
  lines: LineGeometry[],
  zoomName: "overview" | "corridor" | "line" | "station",
  target: string | null,
): StationPosition[] {
  switch (zoomName) {
    case "overview": {
      // All representative stations across all lines
      return lines.flatMap((lg) => lg.stations.filter((s) => s.isRepresentative));
    }
    case "corridor": {
      // Representatives for lines in the target corridor
      if (target === null) return [];
      return lines
        .filter((lg) => lg.group === target)
        .flatMap((lg) => lg.stations.filter((s) => s.isRepresentative));
    }
    case "line": {
      // All stations on the target line
      if (target === null) return [];
      const lineGeometry = lines.find((lg) => lg.line === target);
      return lineGeometry?.stations ?? [];
    }
    case "station": {
      // No labels at station zoom — detail is in the inspector
      return [];
    }
  }
}

// ── Label overlay sub-component ──────────────────────────────────────────

const LabelOverlay = memo(function LabelOverlay({
  stations,
  viewBoxWidth,
  viewBoxHeight,
  transformStyle,
  transitionStyle,
}: {
  stations: StationPosition[];
  viewBoxWidth: number;
  viewBoxHeight: number;
  transformStyle: string;
  transitionStyle: string;
}): ReactNode {
  if (stations.length === 0) return null;

  return (
    <div
      data-slot="transit-map-label-overlay"
      style={{
        position: "absolute",
        inset: 0,
        transform: transformStyle,
        transition: transitionStyle,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      {stations.map((station) => {
        const leftPct = (station.x / viewBoxWidth) * 100;
        const topPct = (station.y / viewBoxHeight) * 100;
        const displayName = formatCanonicalFoodDisplayName(station.canonical);

        return (
          <span
            key={station.canonical}
            className="rounded bg-slate-950/80 px-1.5 py-0.5 font-mono text-[11px] tracking-wide text-slate-300"
            style={{
              position: "absolute",
              left: `${leftPct}%`,
              top: `${topPct}%`,
              transform: "translate(-50%, -120%)",
              display: "inline-block",
              whiteSpace: "nowrap",
              maxWidth: "140px",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {displayName}
          </span>
        );
      })}
    </div>
  );
});

// ── Back button sub-component ────────────────────────────────────────────

function BackButton({ level, onBack }: { level: 1 | 2 | 3 | 4; onBack: () => void }): ReactNode {
  if (level <= 1) return null;

  return (
    <button
      data-slot="transit-map-back-button"
      type="button"
      onClick={onBack}
      className="absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-800/90 hover:text-slate-100"
    >
      <ChevronLeft className="h-3.5 w-3.5" />
      Back to {zoomBackLabel(level)}
    </button>
  );
}

// ── Main component ───────────────────────────────────────────────────────

export default function TransitMapWithLabels({ foodStats }: TransitMapWithLabelsProps): ReactNode {
  const geometry = useTransitMapGeometry();
  const network = useTransitMapData(foodStats);
  const {
    currentZoom,
    zoomToCorridor,
    zoomToLine,
    zoomToStation,
    zoomOut,
    transformStyle,
    transitionStyle,
    target,
  } = useTransitMapZoom(geometry);

  const [selectedStation, setSelectedStation] = useState<string | null>(null);

  // ── Station selection handler ──────────────────────────────────────────

  const handleStationSelect = useCallback(
    (canonical: string) => {
      setSelectedStation(canonical);
      zoomToStation(canonical);
    },
    [zoomToStation],
  );

  // zoomToLine and zoomToCorridor are already stable useCallback refs from useTransitMapZoom
  const handleLineSelect = zoomToLine;
  const handleCorridorSelect = zoomToCorridor;

  const handleZoomOut = useCallback(() => {
    // When zooming out from station level, clear the selected station
    if (currentZoom.level === 4) {
      setSelectedStation(null);
    }
    zoomOut();
  }, [currentZoom.level, zoomOut]);

  // ── Compute visible labels ─────────────────────────────────────────────

  const visibleStations = useMemo(
    () => getVisibleStations(geometry.lines, currentZoom.name, target),
    [geometry.lines, currentZoom.name, target],
  );

  // ── Resolve station data for inspector (station zoom only) ─────────────

  const inspectorData = useMemo(() => {
    if (currentZoom.name !== "station" || selectedStation === null) {
      return null;
    }

    const station = network.stationsByCanonical.get(selectedStation);
    const location = network.stationLocation.get(selectedStation);

    if (station === undefined || location === undefined) {
      return null;
    }

    return {
      station,
      corridorGroup: location.corridor.group,
      corridorDisplayName: location.corridor.displayName,
      lineName: location.line.displayName,
    };
  }, [currentZoom.name, selectedStation, network]);

  // ── Station zoom: side-by-side layout ──────────────────────────────────

  if (currentZoom.name === "station" && inspectorData !== null) {
    return (
      <div data-slot="transit-map-with-labels" className="flex h-full gap-4">
        {/* Left: SVG canvas at station zoom */}
        <div className="relative min-w-0 flex-1">
          <BackButton level={currentZoom.level} onBack={handleZoomOut} />
          <TransitMapCanvas
            foodStats={foodStats}
            network={network}
            onStationSelect={handleStationSelect}
            onLineSelect={handleLineSelect}
            onCorridorSelect={handleCorridorSelect}
            svgTransform={transformStyle}
            svgTransition={transitionStyle}
            selectedStation={selectedStation}
            zoomLevel={currentZoom.name}
          />
        </div>

        {/* Right: Station inspector (sibling div, NEVER overlays the map) */}
        <div className="w-[380px] shrink-0 overflow-y-auto">
          <StationInspector
            station={inspectorData.station}
            corridorGroup={inspectorData.corridorGroup}
            corridorDisplayName={inspectorData.corridorDisplayName}
            lineName={inspectorData.lineName}
          />
        </div>
      </div>
    );
  }

  // ── Non-station zoom: canvas + label overlay ───────────────────────────

  return (
    <div data-slot="transit-map-with-labels" className="relative h-full">
      <BackButton level={currentZoom.level} onBack={handleZoomOut} />

      <TransitMapCanvas
        foodStats={foodStats}
        network={network}
        onStationSelect={handleStationSelect}
        onLineSelect={handleLineSelect}
        onCorridorSelect={handleCorridorSelect}
        svgTransform={transformStyle}
        svgTransition={transitionStyle}
        selectedStation={selectedStation}
        zoomLevel={currentZoom.name}
      />

      <LabelOverlay
        stations={visibleStations}
        viewBoxWidth={geometry.viewBox.width}
        viewBoxHeight={geometry.viewBox.height}
        transformStyle={transformStyle}
        transitionStyle={transitionStyle}
      />
    </div>
  );
}
