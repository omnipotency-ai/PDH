import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth } from "./lib/auth";

export const add = mutation({
  args: {
    weekStartTimestamp: v.number(),
    weekEndTimestamp: v.number(),
    weeklySummary: v.string(),
    keyFoods: v.object({
      safe: v.array(v.string()),
      flagged: v.array(v.string()),
      toTryNext: v.array(v.string()),
    }),
    carryForwardNotes: v.array(v.string()),
    model: v.string(),
    durationMs: v.number(),
    generatedAt: v.number(),
    promptVersion: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    // Prevent duplicate summaries for the same week
    const existing = await ctx.db
      .query("weeklySummaries")
      .withIndex("by_userId_weekStart", (q) =>
        q.eq("userId", userId).eq("weekStartTimestamp", args.weekStartTimestamp),
      )
      .first();

    if (existing) {
      // Update in place
      await ctx.db.patch(existing._id, {
        weekEndTimestamp: args.weekEndTimestamp,
        weeklySummary: args.weeklySummary,
        keyFoods: args.keyFoods,
        carryForwardNotes: args.carryForwardNotes,
        model: args.model,
        durationMs: args.durationMs,
        generatedAt: args.generatedAt,
        ...(args.promptVersion !== undefined && {
          promptVersion: args.promptVersion,
        }),
      });
      return existing._id;
    }

    return await ctx.db.insert("weeklySummaries", { userId, ...args });
  },
});

export const getLatest = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireAuth(ctx);
    return await ctx.db
      .query("weeklySummaries")
      .withIndex("by_userId_weekStart", (q) => q.eq("userId", userId))
      .order("desc")
      .first();
  },
});

export const getByWeek = query({
  args: {
    weekStartTimestamp: v.number(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    return await ctx.db
      .query("weeklySummaries")
      .withIndex("by_userId_weekStart", (q) =>
        q.eq("userId", userId).eq("weekStartTimestamp", args.weekStartTimestamp),
      )
      .first();
  },
});

export const listAll = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const limit = Math.min(Math.max(args.limit ?? 12, 1), 52);
    return await ctx.db
      .query("weeklySummaries")
      .withIndex("by_userId_weekStart", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);
  },
});
