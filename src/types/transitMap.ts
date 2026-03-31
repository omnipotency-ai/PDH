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

  // Bristol 6-7 are both loose/watery — group together as "express" (loose).
  const loose = station.bristolBreakdown
    ? Object.entries(station.bristolBreakdown)
        .filter(([code]) => {
          const n = Number(code);
          return n >= 6 && n <= 7;
        })
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

  const total = station.resolvedTransits;
  parts.push(`${total} transit${total === 1 ? "" : "s"}`);

  const details: string[] = [];
  if (good > 0) details.push(`${good} on time`);
  if (hard > 0) details.push(`${hard} delayed`);
  if (loose > 0) details.push(`${loose} express`);

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
