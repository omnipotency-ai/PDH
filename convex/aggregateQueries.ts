import { v } from "convex/values";
import { resolveCanonicalFoodName } from "../shared/foodCanonicalName";
import {
  formatCanonicalFoodDisplayName,
  prefersSummaryCandidate,
} from "../shared/foodNormalize";
import { query } from "./_generated/server";
import { requireAuth } from "./lib/auth";

// Matches the `currentStatus` union in schema.ts → foodTrialSummary
const foodTrialStatusValidator = v.union(
  v.literal("testing"),
  v.literal("safe"),
  v.literal("safe-loose"),
  v.literal("safe-hard"),
  v.literal("watch"),
  v.literal("risky"),
  v.literal("culprit"),
  v.literal("cleared"),
);

function normalizeFoodTrialSummaryRows<
  T extends {
    _creationTime: number;
    canonicalName: string;
    displayName: string;
    updatedAt?: number;
    lastAssessedAt?: number;
  },
>(rows: ReadonlyArray<T>): T[] {
  const byCanonical = new Map<string, T>();

  for (const row of rows) {
    const canonicalName = resolveCanonicalFoodName(row.canonicalName);
    const existing = byCanonical.get(canonicalName);
    // Returns virtual normalized rows — canonicalName may differ from the stored DB value
    const normalizedRow = {
      ...row,
      canonicalName,
      displayName: formatCanonicalFoodDisplayName(canonicalName),
    };

    if (
      !existing ||
      prefersSummaryCandidate(normalizedRow, existing, canonicalName)
    ) {
      byCanonical.set(canonicalName, normalizedRow);
    }
  }

  return Array.from(byCanonical.values()).sort(
    (a, b) =>
      (b.updatedAt ?? b._creationTime) - (a.updatedAt ?? a._creationTime) ||
      (b.lastAssessedAt ?? 0) - (a.lastAssessedAt ?? 0) ||
      b._creationTime - a._creationTime,
  );
}

// ─── Food Trial Summary queries ──────────────────────────────────────────────────

export const allFoodTrials = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireAuth(ctx);
    // Small table (~50-100 docs per user, grows slowly). Full collect is acceptable.
    // If table grows significantly, consider pagination or status-based queries.
    // Uses by_userId_updatedAt so the DB returns rows pre-sorted by updatedAt desc,
    // reducing work in the in-memory normalization/dedup sort.
    const rows = await ctx.db
      .query("foodTrialSummary")
      .withIndex("by_userId_updatedAt", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
    return normalizeFoodTrialSummaryRows(rows);
  },
});

export const foodTrialsByStatus = query({
  args: { status: foodTrialStatusValidator },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const rows = await ctx.db
      .query("foodTrialSummary")
      .withIndex("by_userId_status", (q) =>
        q.eq("userId", userId).eq("currentStatus", args.status),
      )
      .collect();
    return normalizeFoodTrialSummaryRows(rows);
  },
});

export const foodTrialByName = query({
  args: { canonicalName: v.string() },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    // Normalize input name (e.g. "Scrambled Egg" -> "egg") so the index
    // lookup matches the canonical form stored in the DB.
    // The canonicalName migration ensures DB values are already normalized,
    // so runtime re-normalization of stored rows is not needed here.
    const normalizedCanonicalName = resolveCanonicalFoodName(
      args.canonicalName,
    );
    const trial = await ctx.db
      .query("foodTrialSummary")
      .withIndex("by_userId_canonicalName", (q) =>
        q.eq("userId", userId).eq("canonicalName", normalizedCanonicalName),
      )
      .first();
    return trial;
  },
});

// ─── Weekly Digest queries ───────────────────────────────────────────────────

export const allWeeklyDigests = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const limit = Math.min(Math.max(args.limit ?? 12, 1), 52);
    return await ctx.db
      .query("weeklyDigest")
      .withIndex("by_userId_weekStart", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);
  },
});

export const weeklyDigestByWeek = query({
  args: { weekStartTimestamp: v.number() },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    return await ctx.db
      .query("weeklyDigest")
      .withIndex("by_userId_weekStart", (q) =>
        q
          .eq("userId", userId)
          .eq("weekStartTimestamp", args.weekStartTimestamp),
      )
      .first();
  },
});

export const currentWeekDigest = query({
  args: {
    /** Monday 00:00:00 UTC timestamp for the current week. Must be computed
     *  on the client to keep this query deterministic. */
    weekStartMs: v.number(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);

    return await ctx.db
      .query("weeklyDigest")
      .withIndex("by_userId_weekStart", (q) =>
        q.eq("userId", userId).eq("weekStartTimestamp", args.weekStartMs),
      )
      .first();
  },
});
