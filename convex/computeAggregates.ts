import { v } from "convex/values";
import { resolveCanonicalFoodName } from "../shared/foodCanonicalName";
import {
  buildFoodEvidenceResult,
  type FoodEvidenceLog,
  type FoodEvidenceSummary,
  type HabitLike,
  normalizeAssessmentRecord,
  type TransitCalibration,
  toLegacyFoodStatus,
} from "../shared/foodEvidence";
import { formatCanonicalFoodDisplayName, prefersSummaryCandidate } from "../shared/foodNormalize";
import { getLoggedFoodIdentity } from "../shared/foodProjection";
import type {
  FoodAssessmentCausalRole,
  FoodAssessmentChangeType,
  FoodAssessmentConfidence,
  FoodAssessmentVerdict,
} from "../shared/foodTypes";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalMutation, mutation } from "./_generated/server";
import { requireAuth } from "./lib/auth";
import { addToKnownFoods } from "./lib/knownFoods";

function getLatestTimestamp(
  timestamps: ReadonlyArray<number | null | undefined>,
  fallback: number,
): number {
  const finite = timestamps.filter(
    (timestamp): timestamp is number => typeof timestamp === "number" && Number.isFinite(timestamp),
  );
  return finite.length > 0 ? Math.max(...finite) : fallback;
}

// ---------------------------------------------------------------------------
// Shared DB assessment → evidence record mapping
// ---------------------------------------------------------------------------

type DbAssessment = {
  canonicalName: string;
  foodName: string;
  verdict: FoodAssessmentVerdict | "culprit" | "next_to_try";
  confidence?: FoodAssessmentConfidence;
  causalRole?: FoodAssessmentCausalRole;
  changeType?: FoodAssessmentChangeType;
  modifierSummary?: string;
  reasoning: string;
  reportTimestamp: number;
};

function mapAssessmentsToRecords(assessments: ReadonlyArray<DbAssessment>) {
  return assessments.map((assessment) =>
    normalizeAssessmentRecord({
      food: assessment.canonicalName || assessment.foodName,
      verdict:
        assessment.verdict === "culprit"
          ? "avoid"
          : assessment.verdict === "next_to_try"
            ? "trial_next"
            : assessment.verdict,
      ...(assessment.confidence && { confidence: assessment.confidence }),
      ...(assessment.causalRole && {
        causalRole: assessment.causalRole,
      }),
      ...(assessment.changeType && {
        changeType: assessment.changeType,
      }),
      ...(assessment.modifierSummary && {
        modifierSummary: assessment.modifierSummary,
      }),
      reasoning: assessment.reasoning,
      reportTimestamp: assessment.reportTimestamp,
    }),
  );
}

// ---------------------------------------------------------------------------
// Shared upsert/delete logic for foodTrialSummary rows
// ---------------------------------------------------------------------------

type ExistingSummaryRow = {
  _id: Id<"foodTrialSummary">;
  _creationTime: number;
  canonicalName: string;
  updatedAt?: number;
  lastAssessedAt?: number;
};

/**
 * Upsert fused evidence summaries into foodTrialSummary rows.
 *
 * @param deleteOrphans - When true (full rebuild), deletes any existing row
 *   whose canonical name is not present in the fused output. When false
 *   (incremental update after a single report), only deletes stale alias
 *   duplicates — rows where multiple DB rows resolve to the same canonical
 *   name but were not chosen as the "winner".
 */
async function upsertFoodTrialSummaries(
  ctx: MutationCtx,
  opts: {
    userId: string;
    recomputeAt: number;
    fusedSummaries: ReadonlyArray<FoodEvidenceSummary>;
    existingSummaries: ReadonlyArray<ExistingSummaryRow>;
    deleteOrphans: boolean;
  },
): Promise<{ updated: number }> {
  const { userId, recomputeAt, fusedSummaries, existingSummaries, deleteOrphans } = opts;

  const existingByName = new Map<string, (typeof existingSummaries)[number][]>();
  for (const summary of existingSummaries) {
    const canonicalName = resolveCanonicalFoodName(summary.canonicalName);
    const rows = existingByName.get(canonicalName);
    if (rows) {
      rows.push(summary);
      continue;
    }
    existingByName.set(canonicalName, [summary]);
  }

  const expectedCanonicalNames = new Set<string>();
  const retainedSummaryIds = new Set<Id<"foodTrialSummary">>();

  for (const summary of fusedSummaries) {
    const canonicalName = resolveCanonicalFoodName(summary.canonicalName);
    expectedCanonicalNames.add(canonicalName);

    let existing: (typeof existingSummaries)[number] | undefined;
    for (const candidate of existingByName.get(canonicalName) ?? []) {
      if (!existing || prefersSummaryCandidate(candidate, existing, canonicalName)) {
        existing = candidate;
      }
    }

    const latestAiVerdict = summary.latestAiVerdict;

    const payload = {
      userId,
      canonicalName,
      displayName: formatCanonicalFoodDisplayName(canonicalName),
      currentStatus: toLegacyFoodStatus(summary.primaryStatus, summary.tendency),
      latestAiVerdict,
      ...(summary.latestConfidence && {
        latestConfidence: summary.latestConfidence,
      }),
      totalAssessments: summary.totalAssessments,
      culpritCount: summary.culpritCount,
      safeCount: summary.safeCount,
      nextToTryCount: summary.nextToTryCount,
      firstSeenAt: summary.firstSeenAt,
      lastAssessedAt: summary.lastTrialAt,
      latestReasoning: summary.latestAiReasoning,
      primaryStatus: summary.primaryStatus,
      tendency: summary.tendency,
      confidence: summary.confidence,
      codeScore: summary.codeScore,
      aiScore: summary.aiScore,
      combinedScore: summary.combinedScore,
      recentSuspect: summary.recentSuspect,
      clearedHistory: summary.clearedHistory,
      learnedTransitCenterMinutes: summary.learnedTransitCenterMinutes,
      learnedTransitSpreadMinutes: summary.learnedTransitSpreadMinutes,
      updatedAt: recomputeAt,
    };

    if (existing !== undefined) {
      await ctx.db.patch(existing._id, payload);
      retainedSummaryIds.add(existing._id);
    } else {
      await ctx.db.insert("foodTrialSummary", payload);
    }
  }

  // Delete stale rows. The strategy depends on whether this is a full rebuild
  // or an incremental update.
  for (const summary of existingSummaries) {
    if (retainedSummaryIds.has(summary._id)) {
      continue;
    }

    const canonicalName = resolveCanonicalFoodName(summary.canonicalName);

    if (deleteOrphans) {
      // Full rebuild: delete anything not produced by the current fused output
      // (orphans) and stale alias duplicates alike — both cases are safe to
      // remove since we have the complete fused output.
      await ctx.db.delete(summary._id);
    } else {
      // Incremental update: only delete stale alias duplicates — rows that
      // resolve to the same canonical name as a retained row but weren't the
      // winner. Do NOT delete rows for canonicals not produced by this run,
      // because those foods simply weren't in this report.
      if (expectedCanonicalNames.has(canonicalName)) {
        // Same canonical was produced by the fused output, but this row wasn't
        // retained — it's a stale alias duplicate. Safe to delete.
        await ctx.db.delete(summary._id);
      }
      // Otherwise: this canonical wasn't in the fused output for this run.
      // Leave it alone — it belongs to a different food, not this report.
    }
  }

  return { updated: fusedSummaries.length };
}

// ---------------------------------------------------------------------------
// Core Logic (shared between internalMutation and backfill mutation)
// ---------------------------------------------------------------------------

/** Number of days of logs to read for transit timing evidence. */
const INCREMENTAL_LOG_WINDOW_DAYS = 14;

/**
 * Core logic for recomputing foodTrialSummary for all foods assessed
 * in a given report. Extracted so it can be called from both
 * the internalMutation (real-time) and the backfill mutation (CLI).
 *
 * This is an **incremental** update: it reads only the assessments and
 * summaries for foods mentioned in the triggering report, and a bounded
 * time window of logs (14 days). This keeps document reads at O(affected
 * foods) instead of O(all user data).
 *
 * It only deletes stale alias duplicates, not rows for foods that weren't
 * in the current report.
 */
async function updateFoodTrialSummaryImpl(
  ctx: MutationCtx,
  args: { userId: string; aiAnalysisId: Id<"aiAnalyses"> },
): Promise<{ updated: number }> {
  // Step 1: Get profile and AI analysis metadata.
  const [profile, aiAnalysis] = await Promise.all([
    ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first(),
    ctx.db.get(args.aiAnalysisId),
  ]);

  // Step 2: Get only the assessments from this specific report to find
  // which foods were affected.
  const reportAssessments = await ctx.db
    .query("foodAssessments")
    .withIndex("by_aiAnalysisId", (q) => q.eq("aiAnalysisId", args.aiAnalysisId))
    .collect();

  const affectedFoods = new Set(reportAssessments.map((a) => a.canonicalName));

  // If no foods were assessed in this report, there's nothing to update.
  if (affectedFoods.size === 0) {
    // Still update the profile timestamp if we have a valid report timestamp.
    if (profile && aiAnalysis) {
      const recomputeAt = getLatestTimestamp([profile.updatedAt, aiAnalysis.timestamp], 0);
      await ctx.db.patch(profile._id, { updatedAt: recomputeAt });
    }
    return { updated: 0 };
  }

  // Step 3: Deduplicate query names up front. For each affected food,
  // collect both the raw name and its normalized canonical form into a
  // single Set. When raw === canonical (the common case), this avoids
  // a redundant database query per food (~10% latency improvement).
  const uniqueQueryNames = new Set<string>();
  for (const foodName of affectedFoods) {
    uniqueQueryNames.add(foodName);
    uniqueQueryNames.add(resolveCanonicalFoodName(foodName));
  }

  // Step 3b: For each unique name, get ALL historical assessments
  // (not just this report's). Query by both raw and normalized canonical
  // names so that alias renames (e.g. "baguette" -> "white bread") are
  // captured. Uses the by_userId_canonicalName index.
  const allAssessmentsForAffectedFoods: Doc<"foodAssessments">[] = [];
  for (const queryName of uniqueQueryNames) {
    const foodAssessments = await ctx.db
      .query("foodAssessments")
      .withIndex("by_userId_canonicalName", (q) =>
        q.eq("userId", args.userId).eq("canonicalName", queryName),
      )
      .collect();
    allAssessmentsForAffectedFoods.push(...foodAssessments);
  }

  // Step 4: For each unique name, get existing summary rows.
  // We query by both the raw canonical name AND its normalized form so
  // that stale alias duplicates (e.g. "baguette" vs "white bread") are
  // found and can be cleaned up by upsertFoodTrialSummaries.
  const existingSummaries: ExistingSummaryRow[] = [];
  for (const queryName of uniqueQueryNames) {
    const summaryRows = await ctx.db
      .query("foodTrialSummary")
      .withIndex("by_userId_canonicalName", (q) =>
        q.eq("userId", args.userId).eq("canonicalName", queryName),
      )
      .collect();
    existingSummaries.push(...summaryRows);
  }

  // Step 5: Get logs within a bounded time window. The evidence pipeline
  // pairs food events with digestion events, so we need both types, plus
  // habit/activity logs for modifier context. A 14-day window anchored to
  // the report timestamp captures the relevant transit timing data without
  // scanning all historical logs.
  if (!aiAnalysis) {
    throw new Error(
      `AI analysis ${args.aiAnalysisId} not found — cannot compute food trial summary without a report timestamp`,
    );
  }
  const windowMs = INCREMENTAL_LOG_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const windowAnchor = aiAnalysis.timestamp;
  const windowStart = windowAnchor - windowMs;
  const recentLogs = await ctx.db
    .query("logs")
    .withIndex("by_userId_timestamp", (q) =>
      q.eq("userId", args.userId).gte("timestamp", windowStart),
    )
    .collect();

  // Step 6: Compute the recomputeAt timestamp from the scoped data.
  const recomputeAt = getLatestTimestamp(
    [
      ...recentLogs.map((log) => log.timestamp),
      ...allAssessmentsForAffectedFoods.map((a) => a.reportTimestamp),
      profile?.updatedAt,
      aiAnalysis?.timestamp,
    ],
    0,
  );

  // Step 7: Run the evidence computation with scoped data.
  const fused = buildFoodEvidenceResult({
    logs: recentLogs.map((log) => ({
      id: String(log._id),
      timestamp: log.timestamp,
      type: log.type,
      data: log.data,
    })) as FoodEvidenceLog[],
    habits: (profile?.habits ?? []) as HabitLike[],
    assessments: mapAssessmentsToRecords(allAssessmentsForAffectedFoods),
    ...(profile?.transitCalibration && {
      calibration: profile.transitCalibration as TransitCalibration,
    }),
    now: recomputeAt,
  });

  if (profile) {
    await ctx.db.patch(profile._id, {
      transitCalibration: fused.transitCalibration,
      updatedAt: recomputeAt,
    });
  }

  // Step 8: Filter the fused summaries to only include the affected foods.
  // buildFoodEvidenceResult may produce summaries for other foods that
  // appear in the log window but weren't in this report. We only want
  // to upsert summaries for the foods that were actually assessed.
  const affectedFoodNormalized = new Set([...affectedFoods].map(resolveCanonicalFoodName));
  const scopedSummaries = fused.summaries.filter((s) =>
    affectedFoodNormalized.has(resolveCanonicalFoodName(s.canonicalName)),
  );

  return upsertFoodTrialSummaries(ctx, {
    userId: args.userId,
    recomputeAt,
    fusedSummaries: scopedSummaries,
    existingSummaries,
    deleteOrphans: false,
  });
}

/**
 * Recomputes the foodTrialSummary for all foods that were assessed
 * in the given report. Called after extractInsightData extracts
 * food assessments from a new AI analysis.
 */
export const updateFoodTrialSummary = internalMutation({
  args: {
    userId: v.string(),
    aiAnalysisId: v.id("aiAnalyses"),
  },
  handler: async (ctx, args) => {
    try {
      return await updateFoodTrialSummaryImpl(ctx, args);
    } catch (error) {
      console.error(
        `[updateFoodTrialSummary] Failed for user ${args.userId}, analysis ${args.aiAnalysisId}:`,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  },
});

// ---------------------------------------------------------------------------
// Weekly Digest Computation
// ---------------------------------------------------------------------------

function getWeekStart(timestamp: number): {
  weekStart: string;
  weekStartTimestamp: number;
} {
  const date = new Date(timestamp);
  const day = date.getDay();
  // Shift so Monday = 0. Sunday (0) maps to -6, others map to (1 - day).
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return {
    weekStart: monday.toISOString().split("T")[0],
    weekStartTimestamp: monday.getTime(),
  };
}

/**
 * Core logic for recomputing the weeklyDigest row for the week
 * containing eventTimestamp. Extracted so it can be called from both
 * the internalMutation (real-time) and the backfill mutation (CLI).
 */
async function updateWeeklyDigestImpl(
  ctx: MutationCtx,
  args: { userId: string; eventTimestamp: number; now?: number },
): Promise<{ weekStart: string }> {
  const { weekStart, weekStartTimestamp } = getWeekStart(args.eventTimestamp);
  const weekEndTimestamp = weekStartTimestamp + 7 * 24 * 60 * 60 * 1000;

  // Load profile for knownFoods set (used to determine "new" foods below)
  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_userId", (q) => q.eq("userId", args.userId))
    .first();

  // Get all logs for this week
  const logs = await ctx.db
    .query("logs")
    .withIndex("by_userId_timestamp", (q) =>
      q
        .eq("userId", args.userId)
        .gte("timestamp", weekStartTimestamp)
        .lt("timestamp", weekEndTimestamp),
    )
    .collect();

  const digestionLogs = logs.filter((l) => l.type === "digestion");
  const foodLogs = logs.filter((l) => l.type === "food");
  const habitLogs = logs.filter((l) => l.type === "habit");
  const fluidLogs = logs.filter((l) => l.type === "fluid");

  // Bristol distribution
  const bristolDist = {
    bristol1: 0,
    bristol2: 0,
    bristol3: 0,
    bristol4: 0,
    bristol5: 0,
    bristol6: 0,
    bristol7: 0,
  };
  const bristolScores: number[] = [];
  let accidentCount = 0;

  for (const log of digestionLogs) {
    const data = log.data as Record<string, unknown> | null;
    const code = Number(data?.bristolCode);
    if (code >= 1 && code <= 7) {
      const key = `bristol${code}` as keyof typeof bristolDist;
      bristolDist[key]++;
      bristolScores.push(code);
    }
    if (data?.accident) accidentCount++;
  }

  const avgBristol =
    bristolScores.length > 0
      ? Math.round((bristolScores.reduce((a, b) => a + b, 0) / bristolScores.length) * 10) / 10
      : undefined;

  // Food stats -- collect unique food names from this week
  const foodNames = new Set<string>();
  for (const log of foodLogs) {
    const data = log.data as Record<string, unknown> | null;
    if (Array.isArray(data?.items)) {
      for (const item of data.items as Array<Record<string, unknown>>) {
        const identity = getLoggedFoodIdentity(item);
        if (identity && identity.canonicalName !== "unknown_food") {
          foodNames.add(identity.canonicalName);
        }
      }
    }
  }

  // Determine "new" foods this week by checking set membership against
  // the profile's knownFoods set, instead of scanning all historical logs
  // (WQ-302). The knownFoods set is maintained by writeProcessedItems,
  // resolveItem, and this function itself.
  const knownFoodsSet = new Set(profile?.knownFoods ?? []);
  const newFoods = [...foodNames].filter((f) => !knownFoodsSet.has(f));

  // Update the profile's knownFoods with this week's foods so future
  // digest runs don't need to re-scan. This also acts as a catch-up
  // for any foods that slipped through (e.g., logged before the
  // knownFoods field existed).
  if (foodNames.size > 0) {
    await addToKnownFoods(ctx, args.userId, [...foodNames]);
  }

  // AI report stats for this week (capped to avoid hitting Convex's 32K
  // document read limit for power users — WQ-335)
  const WEEKLY_DIGEST_QUERY_LIMIT = 1000;
  const weekReports = await ctx.db
    .query("aiAnalyses")
    .withIndex("by_userId_timestamp", (q) =>
      q
        .eq("userId", args.userId)
        .gte("timestamp", weekStartTimestamp)
        .lt("timestamp", weekEndTimestamp),
    )
    .take(WEEKLY_DIGEST_QUERY_LIMIT);
  if (weekReports.length === WEEKLY_DIGEST_QUERY_LIMIT) {
    console.warn(
      `[weeklyDigest] aiAnalyses query hit ${WEEKLY_DIGEST_QUERY_LIMIT} limit for user ${args.userId}, week ${weekStart}. Results may be incomplete.`,
    );
  }

  // Food assessment stats for this week (capped — WQ-335)
  const weekAssessments = await ctx.db
    .query("foodAssessments")
    .withIndex("by_userId_timestamp", (q) =>
      q
        .eq("userId", args.userId)
        .gte("reportTimestamp", weekStartTimestamp)
        .lt("reportTimestamp", weekEndTimestamp),
    )
    .take(WEEKLY_DIGEST_QUERY_LIMIT);
  if (weekAssessments.length === WEEKLY_DIGEST_QUERY_LIMIT) {
    console.warn(
      `[weeklyDigest] foodAssessments query hit ${WEEKLY_DIGEST_QUERY_LIMIT} limit for user ${args.userId}, week ${weekStart}. Results may be incomplete.`,
    );
  }

  const culpritFoods = new Map<string, number>();
  const safeFoodMap = new Map<string, number>();
  for (const a of weekAssessments) {
    if (a.verdict === "culprit" || a.verdict === "avoid") {
      culpritFoods.set(a.canonicalName, (culpritFoods.get(a.canonicalName) ?? 0) + 1);
    } else if (a.verdict === "safe") {
      safeFoodMap.set(a.canonicalName, (safeFoodMap.get(a.canonicalName) ?? 0) + 1);
    }
  }

  const topCulprits = [...culpritFoods.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name);
  const topSafe = [...safeFoodMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name);

  // Fluid total
  let totalFluidMl = 0;
  for (const log of fluidLogs) {
    const data = log.data as Record<string, unknown> | null;
    const items = Array.isArray(data?.items)
      ? (data.items as Array<Record<string, unknown>>)
      : [data];
    for (const item of items) {
      const ml = Number(item?.quantity ?? item?.amountMl);
      if (Number.isFinite(ml) && ml > 0) totalFluidMl += ml;
    }
  }

  // Upsert -- find existing digest for this week or create a new one
  const existing = await ctx.db
    .query("weeklyDigest")
    .withIndex("by_userId_weekStart", (q) =>
      q.eq("userId", args.userId).eq("weekStartTimestamp", weekStartTimestamp),
    )
    .first();

  const digestData = {
    userId: args.userId,
    weekStart,
    weekStartTimestamp,
    totalBowelEvents: digestionLogs.length,
    ...(avgBristol !== undefined && { avgBristolScore: avgBristol }),
    bristolDistribution: bristolDist,
    accidentCount,
    totalFoodLogs: foodLogs.length,
    uniqueFoodsEaten: foodNames.size,
    newFoodsTried: newFoods.length,
    totalReports: weekReports.length,
    foodsCleared: safeFoodMap.size,
    foodsFlagged: culpritFoods.size,
    topCulprits,
    topSafe,
    ...(habitLogs.length > 0 && { totalHabitLogs: habitLogs.length }),
    ...(totalFluidMl > 0 && { totalFluidMl }),
    updatedAt: args.now ?? Date.now(),
  };

  if (existing) {
    await ctx.db.patch(existing._id, digestData);
  } else {
    await ctx.db.insert("weeklyDigest", digestData);
  }

  return { weekStart };
}

// ---------------------------------------------------------------------------
// Paginated Backfill Helpers
// ---------------------------------------------------------------------------

/** Stagger delay between scheduled mutations to avoid burst reads. */
const BACKFILL_STAGGER_MS = 500;

/**
 * Recomputes the weeklyDigest row for the week containing eventTimestamp.
 * Aggregates bowel events, food logs, fluid intake, habit logs, AI reports,
 * and food assessment verdicts into a single summary document.
 */
export const updateWeeklyDigest = internalMutation({
  args: {
    userId: v.string(),
    eventTimestamp: v.number(),
    now: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    try {
      return await updateWeeklyDigestImpl(ctx, {
        userId: args.userId,
        eventTimestamp: args.eventTimestamp,
        ...(args.now !== undefined && { now: args.now }),
      });
    } catch (error) {
      console.error(
        `[updateWeeklyDigest] Failed for user ${args.userId}, timestamp ${args.eventTimestamp}:`,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  },
});

// ---------------------------------------------------------------------------
// Backfill — Paginated via scheduled mutations
// ---------------------------------------------------------------------------

/**
 * Collects distinct report IDs for a user, then schedules one
 * updateFoodTrialSummary per report with staggered delays.
 * Each scheduled mutation reads only the data for one report,
 * staying well within the 32K document read limit.
 */
export const backfillFoodTrialsWorker = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const assessments = await ctx.db
      .query("foodAssessments")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .take(5000);

    const reportIds = [...new Set(assessments.map((a) => a.aiAnalysisId))];

    const scheduledTaskIds: string[] = [];
    for (let i = 0; i < reportIds.length; i++) {
      try {
        const taskId = await ctx.scheduler.runAfter(
          i * BACKFILL_STAGGER_MS,
          internal.computeAggregates.updateFoodTrialSummary,
          { userId: args.userId, aiAnalysisId: reportIds[i] },
        );
        scheduledTaskIds.push(String(taskId));
      } catch (error) {
        console.error(
          `[backfillFoodTrialsWorker] Failed to schedule updateFoodTrialSummary for report ${reportIds[i]}, user ${args.userId}:`,
          error instanceof Error ? error.message : String(error),
        );
        throw error;
      }
    }
    console.info(
      `[backfillFoodTrialsWorker] Scheduled ${scheduledTaskIds.length} tasks for user ${args.userId}`,
    );

    return { scheduledReports: reportIds.length };
  },
});

/**
 * Finds the first log timestamp, then schedules one updateWeeklyDigest
 * per week with staggered delays.
 */
export const backfillWeeklyDigestsWorker = internalMutation({
  args: { userId: v.string(), now: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const firstLog = await ctx.db
      .query("logs")
      .withIndex("by_userId_timestamp", (q) => q.eq("userId", args.userId))
      .order("asc")
      .first();

    if (firstLog === null) return { scheduledWeeks: 0 };

    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    const now = args.now ?? Date.now();
    let current = firstLog.timestamp;
    let weeks = 0;

    while (current <= now) {
      try {
        const taskId = await ctx.scheduler.runAfter(
          weeks * BACKFILL_STAGGER_MS,
          internal.computeAggregates.updateWeeklyDigest,
          { userId: args.userId, eventTimestamp: current },
        );
        console.info(
          `[backfillWeeklyDigestsWorker] Scheduled week ${weeks} (task ${String(taskId)}) for user ${args.userId}`,
        );
      } catch (error) {
        console.error(
          `[backfillWeeklyDigestsWorker] Failed to schedule updateWeeklyDigest for week ${weeks}, user ${args.userId}:`,
          error instanceof Error ? error.message : String(error),
        );
        throw error;
      }
      current += oneWeek;
      weeks++;
    }
    console.info(
      `[backfillWeeklyDigestsWorker] Scheduled ${weeks} weekly digest tasks for user ${args.userId}`,
    );

    return { scheduledWeeks: weeks };
  },
});

/**
 * Backfills all foodTrialSummary rows for the authenticated user.
 * Schedules one mutation per report to avoid hitting document read limits.
 */
export const backfillFoodTrials = mutation({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireAuth(ctx);
    try {
      const taskId = await ctx.scheduler.runAfter(
        0,
        internal.computeAggregates.backfillFoodTrialsWorker,
        { userId },
      );
      console.info(`[backfillFoodTrials] Scheduled worker (task ${String(taskId)}) for user ${userId}`);
    } catch (error) {
      console.error(
        `[backfillFoodTrials] Failed to schedule worker for user ${userId}:`,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
    return { scheduled: true };
  },
});

export const backfillFoodTrialsForUser = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    try {
      const taskId = await ctx.scheduler.runAfter(
        0,
        internal.computeAggregates.backfillFoodTrialsWorker,
        {
          userId: args.userId,
        },
      );
      console.info(
        `[backfillFoodTrialsForUser] Scheduled worker (task ${String(taskId)}) for user ${args.userId}`,
      );
    } catch (error) {
      console.error(
        `[backfillFoodTrialsForUser] Failed to schedule worker for user ${args.userId}:`,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
    return { scheduled: true };
  },
});

/**
 * Backfills all weeklyDigest rows for the authenticated user.
 * Schedules one mutation per week to avoid hitting document read limits.
 */
export const backfillWeeklyDigests = mutation({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireAuth(ctx);
    try {
      const taskId = await ctx.scheduler.runAfter(
        0,
        internal.computeAggregates.backfillWeeklyDigestsWorker,
        { userId },
      );
      console.info(
        `[backfillWeeklyDigests] Scheduled worker (task ${String(taskId)}) for user ${userId}`,
      );
    } catch (error) {
      console.error(
        `[backfillWeeklyDigests] Failed to schedule worker for user ${userId}:`,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
    return { scheduled: true };
  },
});

export const backfillWeeklyDigestsForUser = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    try {
      const taskId = await ctx.scheduler.runAfter(
        0,
        internal.computeAggregates.backfillWeeklyDigestsWorker,
        {
          userId: args.userId,
        },
      );
      console.info(
        `[backfillWeeklyDigestsForUser] Scheduled worker (task ${String(taskId)}) for user ${args.userId}`,
      );
    } catch (error) {
      console.error(
        `[backfillWeeklyDigestsForUser] Failed to schedule worker for user ${args.userId}:`,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
    return { scheduled: true };
  },
});

// ---------------------------------------------------------------------------
// Known Foods Backfill (WQ-302)
// ---------------------------------------------------------------------------

/** Batch size for the known foods backfill pagination. */
const KNOWN_FOODS_BACKFILL_BATCH = 100;

/**
 * Paginated worker that scans food logs and populates the profile's
 * `knownFoods` set. Processes KNOWN_FOODS_BACKFILL_BATCH logs per
 * invocation and self-schedules until all logs are processed.
 *
 * @param cursor - Timestamp to resume scanning from (0 for first run).
 */
export const backfillKnownFoodsWorker = internalMutation({
  args: {
    userId: v.string(),
    cursor: v.number(),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (profile === null) {
      return { done: true, processed: 0, totalKnown: 0 };
    }

    const knownSet = new Set(profile.knownFoods ?? []);
    const initialSize = knownSet.size;

    // Fetch a batch of food logs starting from the cursor timestamp.
    const logs = await ctx.db
      .query("logs")
      .withIndex("by_userId_timestamp", (q) =>
        q.eq("userId", args.userId).gte("timestamp", args.cursor),
      )
      .take(KNOWN_FOODS_BACKFILL_BATCH);

    let lastTimestamp = args.cursor;
    let processedCount = 0;

    for (const log of logs) {
      lastTimestamp = log.timestamp;
      if (log.type !== "food") continue;

      const data = log.data as Record<string, unknown> | null;
      if (!Array.isArray(data?.items)) continue;

      for (const item of data.items as Array<Record<string, unknown>>) {
        const identity = getLoggedFoodIdentity(item);
        if (identity && identity.canonicalName !== "unknown_food") {
          knownSet.add(identity.canonicalName);
        }
      }
      processedCount++;
    }

    // Patch the profile if we found any new foods in this batch.
    if (knownSet.size > initialSize) {
      await ctx.db.patch(profile._id, {
        knownFoods: [...knownSet],
      });
    }

    // If we got a full batch, there may be more logs. Self-schedule
    // with cursor advanced past the last timestamp to avoid re-reading.
    if (logs.length === KNOWN_FOODS_BACKFILL_BATCH) {
      try {
        const taskId = await ctx.scheduler.runAfter(
          BACKFILL_STAGGER_MS,
          internal.computeAggregates.backfillKnownFoodsWorker,
          {
            userId: args.userId,
            // Advance by 1ms to avoid re-reading the last log
            cursor: lastTimestamp + 1,
          },
        );
        console.info(
          `[backfillKnownFoodsWorker] Self-scheduled next batch (task ${String(taskId)}) for user ${args.userId}, cursor ${lastTimestamp + 1}`,
        );
      } catch (error) {
        console.error(
          `[backfillKnownFoodsWorker] Failed to self-schedule next batch for user ${args.userId}:`,
          error instanceof Error ? error.message : String(error),
        );
        throw error;
      }
      return {
        done: false,
        processed: processedCount,
        totalKnown: knownSet.size,
      };
    }

    return {
      done: true,
      processed: processedCount,
      totalKnown: knownSet.size,
    };
  },
});

/**
 * Backfills the knownFoods set for the authenticated user by scanning
 * all existing food logs. Run from the Convex dashboard after deploying
 * the WQ-302 schema change.
 */
export const backfillKnownFoods = mutation({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireAuth(ctx);
    try {
      const taskId = await ctx.scheduler.runAfter(
        0,
        internal.computeAggregates.backfillKnownFoodsWorker,
        {
          userId,
          cursor: 0,
        },
      );
      console.info(`[backfillKnownFoods] Scheduled worker (task ${String(taskId)}) for user ${userId}`);
    } catch (error) {
      console.error(
        `[backfillKnownFoods] Failed to schedule worker for user ${userId}:`,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
    return { scheduled: true };
  },
});

export const backfillKnownFoodsForUser = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    try {
      const taskId = await ctx.scheduler.runAfter(
        0,
        internal.computeAggregates.backfillKnownFoodsWorker,
        {
          userId: args.userId,
          cursor: 0,
        },
      );
      console.info(
        `[backfillKnownFoodsForUser] Scheduled worker (task ${String(taskId)}) for user ${args.userId}`,
      );
    } catch (error) {
      console.error(
        `[backfillKnownFoodsForUser] Failed to schedule worker for user ${args.userId}:`,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
    return { scheduled: true };
  },
});
