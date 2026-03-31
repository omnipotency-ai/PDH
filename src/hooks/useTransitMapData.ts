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
