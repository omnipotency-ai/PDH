/**
 * @file profiles.ts
 *
 * Public mutations and queries for API key management on the profiles table.
 * The key is encrypted server-side — see convex/lib/apiKeys.ts for details.
 *
 * @consumers
 *   - src/hooks/useApiKey.ts (client-side hook)
 *   - convex/foodLlmMatching.ts (server-side key lookup via internalQuery)
 *   - convex/ai.ts (server-side key lookup via internalQuery)
 */
import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { requireAuth } from "./lib/auth";
import {
  deleteApiKey,
  getApiKey,
  hasStoredApiKey,
  storeApiKey,
} from "./lib/apiKeys";

// Same pattern used in foodLlmMatching.ts and ai.ts
const OPENAI_API_KEY_PATTERN = /^sk-[A-Za-z0-9_-]{20,}$/;

/**
 * Store the user's OpenAI API key (encrypted) in their profile.
 * Validates key format before storing.
 */
export const setApiKey = mutation({
  args: { apiKey: v.string() },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);

    if (!OPENAI_API_KEY_PATTERN.test(args.apiKey)) {
      throw new Error("Invalid API key format");
    }

    await storeApiKey(ctx, userId, args.apiKey);
  },
});

/**
 * Remove the user's stored API key from their profile.
 */
export const removeApiKey = mutation({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireAuth(ctx);

    await deleteApiKey(ctx, userId);
  },
});

/**
 * Check whether the user has an API key stored server-side.
 * Returns a boolean — never exposes the key itself to the client.
 */
export const hasServerApiKey = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return false;
    }

    return await hasStoredApiKey(ctx, identity.subject);
  },
});

/**
 * Internal query for server-side actions to retrieve the user's API key.
 * Only callable from other Convex functions (not from the client).
 */
export const getServerApiKey = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args): Promise<string | null> => {
    return getApiKey(ctx, args.userId);
  },
});

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
