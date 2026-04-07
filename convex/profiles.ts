/**
 * @file profiles.ts
 *
 * Runtime profile helpers. The app now uses an app-owned OpenAI secret from
 * Convex environment variables, so only per-user AI rate-limit state remains here.
 */
import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

/**
 * Internal query: read the stored AI rate limit timestamps for a user.
 * Returns null timestamps if no limits have been recorded yet.
 */
export const getAiRateLimits = internalQuery({
  args: { userId: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<{
    lastDrPooCallAt: number | null;
    lastCoachingCallAt: number | null;
  }> => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    if (profile === null) {
      return { lastDrPooCallAt: null, lastCoachingCallAt: null };
    }

    return {
      lastDrPooCallAt: profile.aiRateLimits?.lastDrPooCallAt ?? null,
      lastCoachingCallAt: profile.aiRateLimits?.lastCoachingCallAt ?? null,
    };
  },
});

/**
 * Internal mutation: update the AI rate limit timestamp for a specific feature.
 * Creates the profile's aiRateLimits field if it does not exist.
 */
export const updateAiRateLimit = internalMutation({
  args: {
    userId: v.string(),
    featureType: v.union(v.literal("drpoo"), v.literal("coaching")),
    calledAt: v.number(),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    if (profile === null) {
      // No profile yet — nothing to update. The rate limit will not persist
      // for this call, but this is a safe degradation (profile is created on
      // first meaningful user action).
      return;
    }

    const existing = profile.aiRateLimits ?? {};

    if (args.featureType === "drpoo") {
      await ctx.db.patch(profile._id, {
        aiRateLimits: { ...existing, lastDrPooCallAt: args.calledAt },
      });
    } else {
      await ctx.db.patch(profile._id, {
        aiRateLimits: { ...existing, lastCoachingCallAt: args.calledAt },
      });
    }
  },
});
