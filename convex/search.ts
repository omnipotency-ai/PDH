import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Unified food search — merges ingredientProfiles (user products) and
 * clinicalRegistry (global medical baseline) server-side.
 *
 * Uses withIndex for scoped queries instead of .filter() per Convex guidelines.
 * Note: clinicalRegistry is empty until Wave 2 seeds it.
 */
export const unifiedFoodSearch = query({
  args: { query: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const limit = args.limit ?? 30;
    const queryLower = args.query.toLowerCase();
    const results: Array<{
      canonicalName: string;
      source: "user" | "clinical";
      productName?: string;
      profileId?: string;
      zone?: number;
      category?: string;
    }> = [];
    const seen = new Set<string>();

    // 1. Search user's ingredientProfiles — highest priority
    const userProducts = await ctx.db
      .query("ingredientProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", identity.tokenIdentifier))
      .take(200);

    for (const p of userProducts) {
      if (
        p.canonicalName.toLowerCase().includes(queryLower) ||
        p.productName?.toLowerCase().includes(queryLower)
      ) {
        if (!seen.has(p.canonicalName)) {
          seen.add(p.canonicalName);
          results.push({
            canonicalName: p.canonicalName,
            source: "user",
            ...(p.productName !== undefined && { productName: p.productName }),
            profileId: p._id,
          });
        }
      }
    }

    // 2. Search clinicalRegistry — second priority (empty until W2)
    const clinicalEntries = await ctx.db.query("clinicalRegistry").take(500);

    for (const entry of clinicalEntries) {
      if (entry.canonicalName.toLowerCase().includes(queryLower)) {
        if (!seen.has(entry.canonicalName)) {
          seen.add(entry.canonicalName);
          results.push({
            canonicalName: entry.canonicalName,
            source: "clinical",
            zone: entry.zone,
            category: entry.category,
          });
        }
      }
    }

    return results.slice(0, limit);
  },
});

/**
 * Single-food lookup by canonicalName.
 * Checks user's ingredientProfiles first, then clinicalRegistry.
 */
export const lookupFood = query({
  args: { canonicalName: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();

    // 1. Check user's ingredientProfiles first (if authenticated)
    if (identity) {
      const userProfile = await ctx.db
        .query("ingredientProfiles")
        .withIndex("by_userId_canonicalName", (q) =>
          q
            .eq("userId", identity.tokenIdentifier)
            .eq("canonicalName", args.canonicalName),
        )
        .first();
      if (userProfile) {
        return { source: "user" as const, profile: userProfile };
      }
    }

    // 2. Check clinicalRegistry
    const clinical = await ctx.db
      .query("clinicalRegistry")
      .withIndex("by_canonicalName", (q) =>
        q.eq("canonicalName", args.canonicalName),
      )
      .first();
    if (clinical) {
      return { source: "clinical" as const, entry: clinical };
    }

    return null;
  },
});
