/**
 * useTransitMapZoom.ts
 *
 * Zoom state machine for the transit map canvas.
 * 4-level discrete step-zoom: Overview → Corridor → Line → Station.
 *
 * Sprint 2.7 — WQ-401
 */

import type { FoodGroup, FoodLine } from "@shared/foodRegistry";
import { useCallback, useMemo, useState } from "react";
import type { MapGeometry, ZoomLevel } from "@/hooks/useTransitMapGeometry";

// ---------------------------------------------------------------------------
// Zoom context — tracks what we zoomed into so we can zoom back out
// ---------------------------------------------------------------------------

interface ZoomContext {
  corridor?: FoodGroup;
  line?: FoodLine;
  station?: string;
}

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UseTransitMapZoomReturn {
  /** Current zoom state */
  currentZoom: ZoomLevel;
  /** Zoom to overview (level 1) */
  zoomToOverview: () => void;
  /** Zoom to a corridor (level 2) */
  zoomToCorridor: (group: FoodGroup) => void;
  /** Zoom to a line (level 3) */
  zoomToLine: (line: FoodLine) => void;
  /** Zoom to a station (level 4) */
  zoomToStation: (canonical: string) => void;
  /** Step back one zoom level */
  zoomOut: () => void;
  /** CSS transform string for the SVG <g> element */
  transformStyle: string;
  /** CSS transition string for smooth animation */
  transitionStyle: string;
  /** The target key (corridor group, line name, or station canonical) */
  target: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map a FoodLine to its parent FoodGroup — exhaustive. */
function lineToGroup(line: FoodLine): FoodGroup {
  if (line === "meat_fish" || line === "eggs_dairy" || line === "vegetable_protein")
    return "protein";
  if (line === "grains" || line === "vegetables" || line === "fruit") return "carbs";
  if (line === "oils" || line === "dairy_fats" || line === "nuts_seeds") return "fats";
  if (line === "sauces_condiments" || line === "herbs_spices") return "seasoning";
  // Exhaustive check: new FoodLine values will cause a compile error here
  const _exhaustive: never = line;
  throw new Error(`lineToGroup: unhandled FoodLine "${String(_exhaustive)}"`);
}

/** Find which line a station canonical belongs to by searching geometry. */
function findStationLine(geometry: MapGeometry, canonical: string): FoodLine | undefined {
  const lineGeometry = geometry.lines.find((l) =>
    l.stations.some((s) => s.canonical === canonical),
  );
  return lineGeometry?.line;
}

/** Derive the current target string from the zoom context. */
function deriveTarget(context: ZoomContext, level: ZoomLevel["level"]): string | null {
  switch (level) {
    case 1:
      return null;
    case 2:
      return context.corridor ?? null;
    case 3:
      return context.line ?? null;
    case 4:
      return context.station ?? null;
  }
}

// ---------------------------------------------------------------------------
// CSS constants
// ---------------------------------------------------------------------------

const TRANSITION_STYLE = "transform 300ms ease-out";

function buildTransformStyle(zoom: ZoomLevel): string {
  return `scale(${zoom.scale}) translate(${zoom.translateX}px, ${zoom.translateY}px)`;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTransitMapZoom(geometry: MapGeometry): UseTransitMapZoomReturn {
  const [currentZoom, setCurrentZoom] = useState<ZoomLevel>(geometry.zoomLevels.overview);
  const [context, setContext] = useState<ZoomContext>({});

  const zoomToOverview = useCallback(() => {
    setCurrentZoom(geometry.zoomLevels.overview);
    setContext({});
  }, [geometry]);

  const zoomToCorridor = useCallback(
    (group: FoodGroup) => {
      setCurrentZoom(geometry.zoomLevels.corridor(group));
      setContext({ corridor: group });
    },
    [geometry],
  );

  const zoomToLine = useCallback(
    (line: FoodLine) => {
      setCurrentZoom(geometry.zoomLevels.line(line));
      setContext({ corridor: lineToGroup(line), line });
    },
    [geometry],
  );

  const zoomToStation = useCallback(
    (canonical: string) => {
      const stationLine = findStationLine(geometry, canonical);
      const stationCorridor = stationLine !== undefined ? lineToGroup(stationLine) : undefined;

      setCurrentZoom(geometry.zoomLevels.station(canonical));
      setContext({
        ...(stationCorridor !== undefined && { corridor: stationCorridor }),
        ...(stationLine !== undefined && { line: stationLine }),
        station: canonical,
      });
    },
    [geometry],
  );

  const zoomOut = useCallback(() => {
    switch (currentZoom.level) {
      case 4: {
        // Station → Line (use the stored line from context)
        const line = context.line;
        if (line !== undefined) {
          setCurrentZoom(geometry.zoomLevels.line(line));
          setContext({ corridor: lineToGroup(line), line });
        } else {
          // Fallback: no line context, go to overview
          setCurrentZoom(geometry.zoomLevels.overview);
          setContext({});
        }
        break;
      }
      case 3: {
        // Line → Corridor (use the stored corridor from context)
        const corridor = context.corridor;
        if (corridor !== undefined) {
          setCurrentZoom(geometry.zoomLevels.corridor(corridor));
          setContext({ corridor });
        } else {
          // Fallback: no corridor context, go to overview
          setCurrentZoom(geometry.zoomLevels.overview);
          setContext({});
        }
        break;
      }
      case 2: {
        // Corridor → Overview
        setCurrentZoom(geometry.zoomLevels.overview);
        setContext({});
        break;
      }
      case 1: {
        // Overview → Overview (no-op)
        break;
      }
    }
  }, [currentZoom, context, geometry]);

  const target = useMemo(
    () => deriveTarget(context, currentZoom.level),
    [context, currentZoom.level],
  );
  const transformStyle = useMemo(() => buildTransformStyle(currentZoom), [currentZoom]);

  return {
    currentZoom,
    zoomToOverview,
    zoomToCorridor,
    zoomToLine,
    zoomToStation,
    zoomOut,
    transformStyle,
    transitionStyle: TRANSITION_STYLE,
    target,
  };
}
