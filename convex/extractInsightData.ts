import { v } from "convex/values";
import { resolveCanonicalFoodName } from "../shared/foodCanonicalName";
import { canonicalizeKnownFoodName } from "../shared/foodCanonicalization";
import { formatCanonicalFoodDisplayName } from "../shared/foodNormalize";
import type { StructuredFoodAssessment } from "../src/types/domain";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalMutation, mutation } from "./_generated/server";
import { requireAuth } from "./lib/auth";

const MONTH_PATTERN =
  /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i;
const YEAR_PATTERN = /\b\d{4}\b/;
const BRISTOL_PATTERN = /bristol\s*\d/i;
const UNIT_NUMBER_PATTERN = /\d{2,}[a-z]/i;
const FOOD_CHOICE_PATTERN = /\s*(?:\band\/or\b|\/|\bor\b)\s*/i;
const EDGE_PUNCTUATION_PATTERN = /^[\s,.;:()[\]{}]+|[\s,.;:()[\]{}]+$/g;

type ExtractedAssessmentSeed = {
  food: string;
  verdict: StructuredFoodAssessment["verdict"];
  confidence: StructuredFoodAssessment["confidence"];
  causalRole: StructuredFoodAssessment["causalRole"];
  changeType: StructuredFoodAssessment["changeType"];
  modifierSummary: string;
  reasoning: string;
  source: "structured" | "derived";
};

function isValidFoodName(name: string): boolean {
  if (name.length > 60) return false;
  if (YEAR_PATTERN.test(name)) return false;
  if (MONTH_PATTERN.test(name)) return false;
  if (BRISTOL_PATTERN.test(name)) return false;
  if ((name.match(/,/g) ?? []).length >= 3) return false;
  if (UNIT_NUMBER_PATTERN.test(name)) return false;
  return true;
}

function culpritVerdictFromConfidence(
  confidence: "high" | "medium" | "low",
): StructuredFoodAssessment["verdict"] {
  return confidence === "high" ? "avoid" : "watch";
}

function splitCompositeFoodLabel(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (canonicalizeKnownFoodName(trimmed) !== null) return [trimmed];
  if (!FOOD_CHOICE_PATTERN.test(trimmed)) return [trimmed];

  const segments = trimmed
    .split(FOOD_CHOICE_PATTERN)
    .map((segment) => segment.replace(EDGE_PUNCTUATION_PATTERN, "").trim())
    .filter(Boolean);

  if (
    segments.length < 2 ||
    segments.some((segment) => !isValidFoodName(segment))
  ) {
    return [trimmed];
  }

  const uniqueSegments: string[] = [];
  const seen = new Set<string>();
  for (const segment of segments) {
    const key = resolveCanonicalFoodName(segment);
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueSegments.push(segment);
  }

  return uniqueSegments.length > 0 ? uniqueSegments : [trimmed];
}

function expandAssessmentSeed(
  seed: ExtractedAssessmentSeed,
): ExtractedAssessmentSeed[] {
  return splitCompositeFoodLabel(seed.food).map((food) => ({
    ...seed,
    food,
  }));
}

function buildFallbackAssessmentSeeds(insight: {
  suspectedCulprits: Array<{
    food: string;
    confidence: "high" | "medium" | "low";
    reasoning: string;
  }>;
}): ExtractedAssessmentSeed[] {
  return [
    ...insight.suspectedCulprits.map((culprit) => ({
      food: culprit.food,
      verdict: culpritVerdictFromConfidence(culprit.confidence),
      confidence: culprit.confidence,
      causalRole:
        culprit.confidence === "high"
          ? ("primary" as const)
          : ("possible" as const),
      changeType: "unchanged" as const,
      modifierSummary: "",
      reasoning: culprit.reasoning,
      source: "derived" as const,
    })),
  ];
}

function buildAssessmentSeeds(insight: {
  foodAssessments?: StructuredFoodAssessment[] | undefined;
  suspectedCulprits: Array<{
    food: string;
    confidence: "high" | "medium" | "low";
    reasoning: string;
  }>;
}): ExtractedAssessmentSeed[] {
  const explicit = Array.isArray(insight.foodAssessments)
    ? insight.foodAssessments
    : [];
  const explicitSeeds = explicit.flatMap((assessment) =>
    expandAssessmentSeed({
      ...assessment,
      source: "structured" as const,
    }),
  );
  const merged = [...explicitSeeds];
  const seenCanonicalNames = new Set(
    explicitSeeds.map((assessment) =>
      resolveCanonicalFoodName(assessment.food),
    ),
  );
  const allowAllFallbacks = explicitSeeds.length === 0;

  for (const fallback of buildFallbackAssessmentSeeds(insight).flatMap(
    expandAssessmentSeed,
  )) {
    if (
      !allowAllFallbacks &&
      canonicalizeKnownFoodName(fallback.food) === null
    ) {
      console.warn(
        `Dropped fallback assessment for unknown food: ${fallback.food}`,
      );
      continue;
    }
    const key = resolveCanonicalFoodName(fallback.food);
    if (seenCanonicalNames.has(key)) continue;
    seenCanonicalNames.add(key);
    merged.push(fallback);
  }

  return merged;
}

async function hasExtractedFoodAssessments(
  ctx: MutationCtx,
  aiAnalysisId: Id<"aiAnalyses">,
) {
  const existingAssessment = await ctx.db
    .query("foodAssessments")
    .withIndex("by_aiAnalysisId", (q) => q.eq("aiAnalysisId", aiAnalysisId))
    .first();
  return existingAssessment !== null;
}

async function scheduleMissingExtractionsForUser(
  ctx: MutationCtx,
  args: {
    userId: string;
    limit?: number;
  },
) {
  const limit = args.limit ?? 200;
  const analyses = await ctx.db
    .query("aiAnalyses")
    .withIndex("by_userId_timestamp", (q) => q.eq("userId", args.userId))
    .order("desc")
    .take(limit);

  /** Stagger delay between scheduled extractions to spread load (matches
   *  backfillFoodTrialsWorker pattern in computeAggregates.ts). */
  const EXTRACTION_STAGGER_MS = 500;

  let processed = 0;
  for (const analysis of analyses) {
    const hasAssessment = await hasExtractedFoodAssessments(ctx, analysis._id);
    if (hasAssessment) continue;

    await ctx.scheduler.runAfter(
      processed * EXTRACTION_STAGGER_MS,
      internal.extractInsightData.extractFromReport,
      {
        aiAnalysisId: analysis._id,
      },
    );
    processed++;
  }

  return { scheduled: processed };
}

export const extractFromReport = internalMutation({
  args: {
    aiAnalysisId: v.id("aiAnalyses"),
    skipScheduling: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.aiAnalysisId);
    if (!report || report.error) return { extracted: false };

    const insight = report.insight;
    if (!insight) return { extracted: false };

    const userId = report.userId;
    const reportTimestamp = report.timestamp;
    const existingAssessments = await ctx.db
      .query("foodAssessments")
      .withIndex("by_aiAnalysisId", (q) =>
        q.eq("aiAnalysisId", args.aiAnalysisId),
      )
      .collect();

    const existingCanonicalNames = new Set(
      existingAssessments.map((assessment) =>
        resolveCanonicalFoodName(assessment.canonicalName),
      ),
    );
    const structuredAssessments = buildAssessmentSeeds({
      foodAssessments: (insight.foodAssessments ?? undefined) as
        | StructuredFoodAssessment[]
        | undefined,
      suspectedCulprits: insight.suspectedCulprits ?? [],
    });

    // ─── Extract structured food assessments ─────────────────────────────
    let insertedAny = false;

    for (const assessment of structuredAssessments) {
      const rawFoodName = assessment.food.trim();
      if (!rawFoodName) continue;
      if (!isValidFoodName(rawFoodName)) continue;

      const canonicalName = resolveCanonicalFoodName(rawFoodName);
      if (existingCanonicalNames.has(canonicalName)) continue;

      // Apply canonical display name for both structured and derived sources
      // when the food is recognized, so display names are always consistent.
      const foodName =
        canonicalizeKnownFoodName(rawFoodName) !== null
          ? formatCanonicalFoodDisplayName(canonicalName)
          : rawFoodName;

      await ctx.db.insert("foodAssessments", {
        userId,
        aiAnalysisId: args.aiAnalysisId,
        reportTimestamp,
        foodName,
        canonicalName,
        verdict: assessment.verdict,
        confidence: assessment.confidence,
        causalRole: assessment.causalRole,
        changeType: assessment.changeType,
        modifierSummary: assessment.modifierSummary.trim(),
        reasoning: assessment.reasoning.trim(),
      });
      existingCanonicalNames.add(canonicalName);
      insertedAny = true;
    }

    // Schedule aggregate updates after extraction
    if (insertedAny && args.skipScheduling !== true) {
      await ctx.scheduler.runAfter(
        0,
        internal.computeAggregates.updateFoodTrialSummary,
        {
          userId,
          aiAnalysisId: args.aiAnalysisId,
        },
      );

      await ctx.scheduler.runAfter(
        0,
        internal.computeAggregates.updateWeeklyDigest,
        {
          userId,
          eventTimestamp: reportTimestamp,
          now: reportTimestamp,
        },
      );
    }

    return { extracted: insertedAny };
  },
});

// One-time backfill: extract normalized data from all existing reports.
export const backfillAll = mutation({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    return scheduleMissingExtractionsForUser(ctx, {
      userId,
      ...(args.limit !== undefined && { limit: args.limit }),
    });
  },
});

export const backfillAllForUser = internalMutation({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) =>
    scheduleMissingExtractionsForUser(ctx, {
      userId: args.userId,
      ...(args.limit !== undefined && { limit: args.limit }),
    }),
});
