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
import { internalQuery, mutation, query } from "./_generated/server";
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
