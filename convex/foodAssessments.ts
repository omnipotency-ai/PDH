import { v } from "convex/values";
import { resolveCanonicalFoodName } from "../shared/foodCanonicalName";
import { formatCanonicalFoodDisplayName } from "../shared/foodNormalize";
import { query } from "./_generated/server";
import { requireAuth } from "./lib/auth";

// Get the full assessment history for a specific food.
// Uses the by_userId_canonicalName index for efficient lookup.
// Stored canonicalName values are normalized by the canonical migration script —
// no runtime re-normalization of rows is needed.
export const historyByFood = query({
  args: {
    canonicalName: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);

    // Normalize the input argument — caller may pass a display name or alias.
    const canonicalName = resolveCanonicalFoodName(args.canonicalName);

    const assessments = await ctx.db
      .query("foodAssessments")
      .withIndex("by_userId_canonicalName", (q) =>
        q.eq("userId", userId).eq("canonicalName", canonicalName),
      )
      .order("desc")
      .take(limit);

    return assessments;
  },
});

// Get all unique foods that have been assessed, with their latest verdict.
//
// NOTE: This query must collect all user assessments to deduplicate by canonical
// name (Convex has no "distinct" index operation). Safety cap at 2000 rows.
export const allFoods = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireAuth(ctx);

    // Stored canonicalName is normalized by the canonical migration script.
    // No runtime re-normalization needed.
    // Safety cap: 2000 rows to prevent unbounded collect.
    const allAssessments = await ctx.db
      .query("foodAssessments")
      .withIndex("by_userId_timestamp", (q) => q.eq("userId", userId))
      .order("desc")
      .take(2000);

    const latestByFood = new Map<
      string,
      {
        canonicalName: string;
        foodName: string;
        originalFoodName: string;
        latestVerdict: (typeof allAssessments)[number]["verdict"];
        latestConfidence?: (typeof allAssessments)[number]["confidence"];
        latestReasoning: string;
        lastAssessedAt: number;
      }
    >();

    for (const assessment of allAssessments) {
      const canonicalName = assessment.canonicalName;
      if (latestByFood.has(canonicalName)) continue;
      latestByFood.set(canonicalName, {
        canonicalName,
        foodName: formatCanonicalFoodDisplayName(canonicalName),
        originalFoodName: assessment.foodName,
        latestVerdict: assessment.verdict,
        ...(assessment.confidence !== undefined && {
          latestConfidence: assessment.confidence,
        }),
        latestReasoning: assessment.reasoning,
        lastAssessedAt: assessment.reportTimestamp,
      });
    }

    return Array.from(latestByFood.values());
  },
});

// Get all raw assessment records for the evidence engine.
// Stored canonicalName is normalized by the canonical migration script.
// No runtime re-normalization needed.
export const allAssessmentRecords = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const limit = Math.min(Math.max(args.limit ?? 500, 1), 1000);
    return await ctx.db
      .query("foodAssessments")
      .withIndex("by_userId_timestamp", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);
  },
});

// Get all flagged foods across all reports.
// Keep the historical "culprits" endpoint name for backwards compatibility,
// but treat both legacy "culprit" and current "avoid" verdicts as flagged.
//
// Uses two indexed queries (one per verdict) then merges and deduplicates,
// rather than scanning all assessments.
export const culprits = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const limit = Math.min(Math.max(args.limit ?? 100, 1), 500);

    // Stored canonicalName is normalized by the canonical migration script.
    // No runtime re-normalization needed.
    const [culpritRows, avoidRows] = await Promise.all([
      ctx.db
        .query("foodAssessments")
        .withIndex("by_userId_verdict", (q) =>
          q.eq("userId", userId).eq("verdict", "culprit"),
        )
        .order("desc")
        .collect(),
      ctx.db
        .query("foodAssessments")
        .withIndex("by_userId_verdict", (q) =>
          q.eq("userId", userId).eq("verdict", "avoid"),
        )
        .order("desc")
        .collect(),
    ]);

    // Merge both result sets, sort by timestamp descending, deduplicate by
    // canonical name (keeping only the latest assessment per food).
    const allRows = [...culpritRows, ...avoidRows].sort(
      (a, b) => b.reportTimestamp - a.reportTimestamp,
    );

    const seen = new Set<string>();
    const results: (typeof allRows)[number][] = [];
    for (const row of allRows) {
      if (results.length >= limit) break;
      if (seen.has(row.canonicalName)) continue;
      seen.add(row.canonicalName);
      results.push(row);
    }
    return results;
  },
});

// Get all safe foods.
// Already uses the by_userId_verdict index.
// Stored canonicalName is normalized by the canonical migration script.
// No runtime re-normalization needed.
export const safeFoods = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const limit = Math.min(Math.max(args.limit ?? 100, 1), 500);
    return await ctx.db
      .query("foodAssessments")
      .withIndex("by_userId_verdict", (q) =>
        q.eq("userId", userId).eq("verdict", "safe"),
      )
      .order("desc")
      .take(limit);
  },
});

// Get assessments for a specific report.
// Uses composite by_userId_aiAnalysisId index so the database only returns
// rows belonging to the authenticated user — no post-filter needed.
export const byReport = query({
  args: {
    aiAnalysisId: v.id("aiAnalyses"),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    // Stored canonicalName is normalized by the canonical migration script.
    // No runtime re-normalization needed.
    return await ctx.db
      .query("foodAssessments")
      .withIndex("by_userId_aiAnalysisId", (q) =>
        q.eq("userId", userId).eq("aiAnalysisId", args.aiAnalysisId),
      )
      .collect();
  },
});
