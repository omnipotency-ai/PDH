import { buildFoodEvidenceResult, toLegacyFoodStatus } from "@shared/foodEvidence";
import { formatCanonicalFoodDisplayName } from "@shared/foodNormalize";
import { resolveCanonicalFoodName } from "@shared/foodCanonicalName";
import type { FoodTrialStatus, SyncedLog } from "@/lib/sync";
import type { DigestiveLogData, FoodPrimaryStatus, FoodTendency } from "@/types/domain";

type DigestiveCategory = "constipated" | "hard" | "firm" | "loose" | "diarrhea";
export type FoodStatus = Exclude<FoodTrialStatus, "culprit" | "cleared">;
type TrialOutcome = "good" | "loose" | "hard" | "bad";

/** A single resolved food-to-bowel correlation record, for display in trial history. */
export interface LocalTrialRecord {
  /** Unique ID for rendering keys (trialId from food log). */
  id: string;
  /** Timestamp of when the food was eaten. */
  foodTimestamp: number;
  /** Bristol score of the correlated bowel event (null if not recorded). */
  bristolCode: number | null;
  /** Transit time in minutes from eating to bowel event. */
  transitMinutes: number;
  /** Outcome classification: good, loose, hard, bad. */
  outcome: TrialOutcome;
  /** Original food name as logged by the user (e.g., "baguette" for canonical "bread"). */
  foodName?: string;
  /** Quantity of the food item (e.g., 2 for "2 slices"). Not yet populated by the evidence pipeline. */
  quantity?: number;
  /** Unit of the food quantity (e.g., "slices", "g"). Not yet populated by the evidence pipeline. */
  unit?: string;
}

export interface FoodStat {
  key: string; // canonical name (from LLM or legacy normalization)
  name: string; // display name
  totalTrials: number; // all-time trial count
  recentOutcomes: TrialOutcome[]; // last 3 trial outcomes (newest first)
  badCount: number; // diarrhea/constipation in last 3
  looseCount: number; // loose in last 3
  hardCount: number; // hard in last 3
  goodCount: number; // normal/no-event in last 3
  avgDelayHours: number | null;
  lastTrialAt: number;
  status: FoodStatus;
  primaryStatus: FoodPrimaryStatus;
  tendency: FoodTendency;
  confidence: number;
  codeScore: number;
  aiScore: number;
  combinedScore: number;
  recentSuspect: boolean;
  clearedHistory: boolean;
  learnedTransitCenterMinutes: number;
  learnedTransitSpreadMinutes: number;
  bristolBreakdown: Record<number, number>; // e.g., { 4: 3, 5: 1, 6: 2 }
  avgTransitMinutes: number | null; // average time from eating to stool in minutes
  resolvedTransits: number; // count of completed transits (resolved trials)
}

interface FusedFoodSummaryOverride {
  aiScore?: number;
  clearedHistory?: boolean;
  codeScore?: number;
  combinedScore?: number;
  confidence?: number;
  learnedTransitCenterMinutes?: number;
  learnedTransitSpreadMinutes?: number;
  primaryStatus?: FoodPrimaryStatus;
  recentSuspect?: boolean;
  tendency?: FoodTendency;
}

interface AnalysisResult {
  foodStats: FoodStat[];
  /** Per-food-key resolved trial records, for trial history display. Sorted newest first. */
  resolvedTrialsByKey: Map<string, LocalTrialRecord[]>;
}

/** Status sort order: safe foods first, risky last */
export const STATUS_ORDER_SAFE_FIRST: Record<FoodStatus, number> = {
  safe: 0,
  "safe-loose": 1,
  "safe-hard": 2,
  testing: 3,
  watch: 4,
  risky: 5,
};

export function analyzeLogs(
  logs: SyncedLog[],
  fusedFoodSummaries: ReadonlyArray<
    {
      canonicalName: string;
    } & FusedFoodSummaryOverride
  > = [],
  evidenceInputs?: {
    habits?: Array<{ id: string; name: string }> | undefined;
    calibration?: import("@shared/foodEvidence").TransitCalibration | undefined;
    assessments?: import("@shared/foodEvidence").FoodAssessmentRecord[] | undefined;
  },
): AnalysisResult {
  const fused = buildFoodEvidenceResult({
    logs,
    now: Date.now(),
    ...(evidenceInputs?.habits && { habits: evidenceInputs.habits }),
    ...(evidenceInputs?.calibration && {
      calibration: evidenceInputs.calibration,
    }),
    ...(evidenceInputs?.assessments && {
      assessments: evidenceInputs.assessments,
    }),
  });
  const overridesByKey = new Map(
    fusedFoodSummaries.map((summary) => [resolveCanonicalFoodName(summary.canonicalName), summary]),
  );
  const foodStats = fused.summaries.map((summary) => {
    const override = overridesByKey.get(summary.canonicalName);

    // Compute avg transit in a single pass — avoids allocating a transitValues array.
    const trialCount = summary.trials.length;
    let transitSum = 0;
    for (const trial of summary.trials) {
      transitSum += trial.transitMinutes;
    }
    const avgTransitMinutes = trialCount > 0 ? Math.round(transitSum / trialCount) : null;
    const avgDelayHours =
      avgTransitMinutes !== null ? Math.round((avgTransitMinutes / 60) * 10) / 10 : null;
    const recentOutcomes = summary.trials.slice(0, 3).map((trial) => trial.outcome);

    // Count outcomes in a single pass instead of four separate filter calls.
    let badCount = 0;
    let looseCount = 0;
    let hardCount = 0;
    let goodCount = 0;
    for (const outcome of recentOutcomes) {
      if (outcome === "bad") badCount += 1;
      else if (outcome === "loose") looseCount += 1;
      else if (outcome === "hard") hardCount += 1;
      else goodCount += 1;
    }

    const bristolBreakdown = summary.trials.reduce<Record<number, number>>((acc, trial) => {
      if (trial.bristolCode === null) return acc;
      acc[trial.bristolCode] = (acc[trial.bristolCode] ?? 0) + 1;
      return acc;
    }, {});
    const primaryStatus = override?.primaryStatus ?? summary.primaryStatus;
    const tendency = override?.tendency ?? summary.tendency;
    const legacyStatus = toLegacyFoodStatus(primaryStatus, tendency);

    return {
      key: summary.canonicalName,
      name: formatCanonicalFoodDisplayName(summary.canonicalName),
      totalTrials: summary.totalTrials,
      recentOutcomes,
      badCount,
      looseCount,
      hardCount,
      goodCount,
      avgDelayHours,
      lastTrialAt: summary.lastTrialAt,
      status: legacyStatus,
      primaryStatus,
      tendency,
      confidence: override?.confidence ?? summary.confidence,
      codeScore: override?.codeScore ?? summary.codeScore,
      aiScore: override?.aiScore ?? summary.aiScore,
      combinedScore: override?.combinedScore ?? summary.combinedScore,
      recentSuspect: override?.recentSuspect ?? summary.recentSuspect,
      clearedHistory: override?.clearedHistory ?? summary.clearedHistory,
      learnedTransitCenterMinutes:
        override?.learnedTransitCenterMinutes ?? summary.learnedTransitCenterMinutes,
      learnedTransitSpreadMinutes:
        override?.learnedTransitSpreadMinutes ?? summary.learnedTransitSpreadMinutes,
      bristolBreakdown,
      avgTransitMinutes,
      resolvedTransits: summary.resolvedTrials,
    } satisfies FoodStat;
  });
  foodStats.sort((a, b) => {
    const statusDiff = STATUS_ORDER_SAFE_FIRST[a.status] - STATUS_ORDER_SAFE_FIRST[b.status];
    if (statusDiff !== 0) return statusDiff;
    if (b.totalTrials !== a.totalTrials) return b.totalTrials - a.totalTrials;
    return b.lastTrialAt - a.lastTrialAt;
  });

  // Build per-food-key resolved trial records for trial history display
  const resolvedTrialsByKey = new Map<string, LocalTrialRecord[]>();
  for (const summary of fused.summaries) {
    const records = summary.trials.map((trial) => ({
      id: trial.trialId,
      foodTimestamp: trial.foodTimestamp,
      bristolCode: trial.bristolCode,
      transitMinutes: trial.transitMinutes,
      outcome: trial.outcome,
      ...(trial.foodName !== undefined && { foodName: trial.foodName }),
    }));
    if (records.length === 0) continue;
    records.sort((a, b) => b.foodTimestamp - a.foodTimestamp);
    resolvedTrialsByKey.set(summary.canonicalName, records);
  }

  return {
    foodStats,
    resolvedTrialsByKey,
  };
}

export function bristolToConsistency(code: number): DigestiveCategory {
  if (!Number.isInteger(code) || code < 1 || code > 7) {
    throw new Error(`Invalid Bristol code: ${code}. Must be 1-7.`);
  }
  if (code === 7) return "diarrhea";
  if (code === 6) return "loose";
  if (code === 1) return "constipated";
  if (code === 2) return "hard";
  return "firm";
}

export function normalizeDigestiveCategory(
  data: DigestiveLogData | Record<string, unknown>,
): DigestiveCategory | null {
  const tag = readText(data?.consistencyTag).toLowerCase();
  if (
    tag === "constipated" ||
    tag === "hard" ||
    tag === "firm" ||
    tag === "loose" ||
    tag === "diarrhea"
  )
    return tag;

  const code = Number(data?.bristolCode);
  if (Number.isFinite(code) && code >= 1 && code <= 7) {
    return bristolToConsistency(code);
  }

  // No usable data — return null so the caller can skip this data point
  // rather than defaulting to "loose" and unfairly penalising foods.
  return null;
}

function readText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

export function normalizeEpisodesCount(value: unknown): number {
  const count = Number(value);
  if (!Number.isFinite(count)) return 1;
  return Math.min(Math.max(Math.floor(count), 1), 20);
}
