import { v } from "convex/values";
import { resolveCanonicalFoodName } from "../shared/foodCanonicalName";
import { formatCanonicalFoodDisplayName } from "../shared/foodNormalize";
import { query } from "./_generated/server";
import { requireAuth } from "./lib/auth";

export const historyByIngredient = query({
  args: {
    canonicalName: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const limit = Math.min(Math.max(args.limit ?? 200, 1), 1000);
    // Normalize the caller's input so non-canonical names still match.
    const canonicalName = resolveCanonicalFoodName(args.canonicalName);
    const exposures = await ctx.db
      .query("ingredientExposures")
      .withIndex("by_userId_canonicalName", (q) =>
        q.eq("userId", userId).eq("canonicalName", canonicalName),
      )
      .order("desc")
      .take(limit);
    return exposures;
  },
});

export const allIngredients = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    // Canonical names are normalized by the migration script (run after each registry update).
    // We group by stored canonicalName directly — no read-time normalization needed.
    // .take(limit) caps the scan for performance. If a user has more than `limit`
    // exposures, the oldest ones will be excluded from the grouped totals.
    // This is an acceptable tradeoff for the summary view.
    const limit = Math.min(Math.max(args.limit ?? 5000, 1), 20000);
    const rows = await ctx.db
      .query("ingredientExposures")
      .withIndex("by_userId_timestamp", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);

    // If we got exactly `limit` rows back, there may be more rows beyond the cap.
    const isTruncated = rows.length === limit;
    if (isTruncated) {
      console.warn(`allIngredients: cap of ${limit} reached for user ${userId}`);
    }

    const byIngredient = new Map<
      string,
      {
        canonicalName: string;
        displayName: string;
        totalExposures: number;
        lastSeenAt: number;
        latestStage?: 1 | 2 | 3;
        latestPreparation?: string;
        latestSpiceLevel?: "plain" | "mild" | "spicy";
      }
    >();

    for (const row of rows) {
      const existing = byIngredient.get(row.canonicalName);
      if (!existing) {
        byIngredient.set(row.canonicalName, {
          canonicalName: row.canonicalName,
          displayName: formatCanonicalFoodDisplayName(row.canonicalName),
          totalExposures: 1,
          lastSeenAt: row.logTimestamp,
          ...(row.recoveryStage !== undefined && {
            latestStage: row.recoveryStage,
          }),
          ...(row.preparation !== undefined && {
            latestPreparation: row.preparation,
          }),
          ...(row.spiceLevel !== undefined && {
            latestSpiceLevel: row.spiceLevel,
          }),
        });
        continue;
      }

      existing.totalExposures += 1;
    }

    const ingredients = Array.from(byIngredient.values()).sort(
      (a, b) => b.lastSeenAt - a.lastSeenAt,
    );

    return {
      ingredients,
      isTruncated,
      count: ingredients.length,
    };
  },
});
