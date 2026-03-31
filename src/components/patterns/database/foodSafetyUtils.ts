import { BRAT_FOOD_KEYS } from "@shared/foodProjection";
import { parseAiInsight } from "@/lib/aiAnalysis";
import type { useAiAnalysisHistory } from "@/lib/sync";
import type { FoodPrimaryStatus, FoodTendency } from "@/types/domain";

// ─── Constants ───────────────────────────────────────────────────────────────

export const BRAT_KEYS = BRAT_FOOD_KEYS;

export function formatStatusLabel(
  primaryStatus: FoodPrimaryStatus,
  tendency: FoodTendency,
): string {
  if (primaryStatus !== "safe") return primaryStatus;
  if (tendency === "loose") return "safe (loose)";
  if (tendency === "hard") return "safe (hard)";
  return "safe";
}

export type FilterStatus = "all" | FoodPrimaryStatus;
export type SortKey = "name" | "status" | "transits" | "lastEaten";
export type SortDir = "asc" | "desc";

export const FILTER_OPTIONS: Array<{ value: FilterStatus; label: string }> = [
  { value: "all", label: "All" },
  { value: "safe", label: "Safe" },
  { value: "building", label: "Building" },
  { value: "watch", label: "Watch" },
  { value: "avoid", label: "Avoid" },
];

// ─── Bristol color helpers ────────────────────────────────────────────────────

export function bristolColor(code: number): string {
  if (code <= 2) return "var(--section-food)"; // red/constipated
  if (code <= 5) return "var(--section-observe)"; // green/normal
  if (code === 6) return "var(--section-quick)"; // amber/loose
  return "var(--section-food)"; // red/diarrhea (7)
}

// ─── Trend computation (Bayesian-derived) ────────────────────────────────────

export type Trend = "improving" | "stable" | "worsening";

export interface TrendData {
  recentOutcomes: ReadonlyArray<string>;
  confidence: number;
  clearedHistory: boolean;
  recentSuspect: boolean;
  primaryStatus: FoodPrimaryStatus;
  combinedScore: number;
}

/**
 * Compute trend using Bayesian engine signals rather than simple outcome counting.
 *
 * Accepts any object with the required trend fields (FoodStat, FoodDatabaseRow, etc.).
 *
 * Uses the Bayesian-derived fields:
 * - `confidence` (0-1): Bayesian evidence strength (effectiveEvidence / 6)
 * - `primaryStatus`: Bayesian posterior-derived status
 * - `clearedHistory`: was previously flagged bad, now safe (improving)
 * - `recentSuspect`: recently flagged by AI or has severe low-confounder events (worsening)
 * - `combinedScore`: net Bayesian score (positive = good, negative = bad)
 *
 * Falls back to outcome comparison when Bayesian confidence is too low.
 */
export function computeTrend(stat: TrendData): Trend | null {
  // Need at least 2 resolved outcomes for any trend signal
  if (stat.recentOutcomes.length < 2) return null;

  // Bayesian confidence too low — no reliable trend
  if (stat.confidence < 0.15) return null;

  // Strong Bayesian signals: clearedHistory means was bad, now safe
  if (stat.clearedHistory) return "improving";

  // Recent suspect with negative Bayesian status → worsening
  if (stat.recentSuspect && (stat.primaryStatus === "watch" || stat.primaryStatus === "avoid")) {
    return "worsening";
  }

  // Use combined Bayesian score direction with confidence weighting.
  // combinedScore is (codePositive - codeNegative + aiScore), reflecting
  // the net posterior evidence direction.
  if (stat.confidence >= 0.3) {
    if (stat.combinedScore > 0.5) return stat.primaryStatus === "safe" ? "stable" : "improving";
    if (stat.combinedScore < -0.5) return "worsening";
    return "stable";
  }

  // Low confidence fallback: compare recent vs older outcomes
  const all = stat.recentOutcomes;
  const badScore = (outcomes: typeof all) =>
    outcomes.reduce((sum, o) => sum + (o === "bad" ? 2 : o === "loose" || o === "hard" ? 1 : 0), 0);

  const midpoint = Math.ceil(all.length / 2);
  const recent = all.slice(0, midpoint);
  const older = all.slice(midpoint);

  if (older.length === 0) return null;

  const recentScore = badScore(recent) / recent.length;
  const olderScore = badScore(older) / older.length;

  if (recentScore < olderScore - 0.3) return "improving";
  if (recentScore > olderScore + 0.3) return "worsening";
  return "stable";
}

// ─── AI override flags ────────────────────────────────────────────────────────

export interface AiFlags {
  likelySafe: Set<string>;
  suspectedCulprits: Set<string>;
}

export function buildAiFlags(aiHistory: ReturnType<typeof useAiAnalysisHistory>): AiFlags {
  const likelySafe = new Set<string>();
  const suspectedCulprits = new Set<string>();

  if (!aiHistory || aiHistory.length === 0) return { likelySafe, suspectedCulprits };

  // Find latest record with a valid insight
  const latest = aiHistory.find(
    (a: { insight: unknown; error?: unknown }) => a.insight && !a.error,
  );
  if (!latest) return { likelySafe, suspectedCulprits };

  const insight = parseAiInsight(latest.insight);
  if (!insight) return { likelySafe, suspectedCulprits };

  for (const item of insight.likelySafe) {
    likelySafe.add(item.food.toLowerCase());
  }
  for (const item of insight.suspectedCulprits) {
    suspectedCulprits.add(item.food.toLowerCase());
  }

  return { likelySafe, suspectedCulprits };
}
