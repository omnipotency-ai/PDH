import { v } from "convex/values";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { requireAuth } from "./lib/auth";
import {
  aiInsightValidator,
  aiRequestValidator,
  aiResponseValidator,
} from "./validators";

export const add = mutation({
  args: {
    timestamp: v.number(),
    request: aiRequestValidator,
    response: aiResponseValidator,
    insight: aiInsightValidator,
    model: v.string(),
    durationMs: v.number(),
    inputLogCount: v.number(),
    latestDigestionLogTimestamp: v.optional(v.number()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    // Write lightweight metadata to aiAnalyses (no request/response payload).
    const id = await ctx.db.insert("aiAnalyses", {
      userId,
      timestamp: args.timestamp,
      insight: args.insight,
      model: args.model,
      durationMs: args.durationMs,
      inputLogCount: args.inputLogCount,
      ...(args.latestDigestionLogTimestamp !== undefined && {
        latestDigestionLogTimestamp: args.latestDigestionLogTimestamp,
      }),
      ...(args.error !== undefined && { error: args.error }),
    });

    // Store heavy request/response in separate table to avoid bloating
    // reactive subscriptions on aiAnalyses (was 3.29 GB/day bandwidth).
    await ctx.db.insert("aiAnalysisPayloads", {
      userId,
      aiAnalysisId: id,
      request: args.request,
      response: args.response,
    });

    // Extract normalized data from the insight (async, non-blocking).
    // Only schedule for successful reports — skip error reports.
    if (args.error === undefined) {
      if (profile) {
        await ctx.db.patch(profile._id, {
          latestSuccessfulAiAnalysisId: id,
          updatedAt: Math.max(profile.updatedAt, args.timestamp),
        });
      }

      await ctx.scheduler.runAfter(
        0,
        internal.extractInsightData.extractFromReport,
        {
          aiAnalysisId: id,
        },
      );
    }

    return id;
  },
});

export const list = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 1000);
    const rows = await ctx.db
      .query("aiAnalyses")
      .withIndex("by_userId_timestamp", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);

    return rows.map((row) => ({
      id: row._id,
      timestamp: row.timestamp,
      model: row.model,
      durationMs: row.durationMs,
      inputLogCount: row.inputLogCount,
      latestDigestionLogTimestamp: row.latestDigestionLogTimestamp,
      insight: row.insight,
      error: row.error,
      starred: row.starred ?? false,
    }));
  },
});

export const toggleStar = mutation({
  args: {
    id: v.id("aiAnalyses"),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const row = await ctx.db.get(args.id);
    if (!row || row.userId !== userId) {
      throw new Error("Report not found");
    }
    await ctx.db.patch(args.id, { starred: !row.starred });
    return !row.starred;
  },
});

export const latest = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireAuth(ctx);
    const row = await ctx.db
      .query("aiAnalyses")
      .withIndex("by_userId_timestamp", (q) => q.eq("userId", userId))
      .order("desc")
      .first();

    if (!row) return null;

    return {
      id: row._id,
      timestamp: row.timestamp,
      model: row.model,
      durationMs: row.durationMs,
      inputLogCount: row.inputLogCount,
      latestDigestionLogTimestamp: row.latestDigestionLogTimestamp,
      insight: row.insight,
      error: row.error,
      starred: row.starred ?? false,
    };
  },
});

/**
 * Returns flattened suggestions from aiAnalyses.insight.suggestions within a date range.
 * Replaces the old reportSuggestions table queries — suggestions are already stored
 * inline in aiAnalyses.insight and were sanitized at write time.
 */
export const suggestionsByDateRange = query({
  args: {
    startMs: v.number(),
    endMs: v.number(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const rows = await ctx.db
      .query("aiAnalyses")
      .withIndex("by_userId_timestamp", (q) =>
        q
          .eq("userId", userId)
          .gte("timestamp", args.startMs)
          .lte("timestamp", args.endMs),
      )
      .take(500);

    const suggestions: Array<{
      text: string;
      textNormalized: string;
      reportTimestamp: number;
    }> = [];

    for (const row of rows) {
      if (row.error !== undefined || row.insight === null) continue;
      for (const text of row.insight.suggestions) {
        if (!text) continue;
        suggestions.push({
          text,
          textNormalized: text.toLowerCase(),
          reportTimestamp: row.timestamp,
        });
      }
    }

    return suggestions.sort((a, b) => a.reportTimestamp - b.reportTimestamp);
  },
});

export const latestSuccessful = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireAuth(ctx);
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    let row =
      profile?.latestSuccessfulAiAnalysisId !== undefined
        ? await ctx.db.get(profile.latestSuccessfulAiAnalysisId)
        : null;

    if (
      row !== null &&
      (row.userId !== userId || row.error !== undefined || row.insight === null)
    ) {
      row = null;
    }

    if (row === null) {
      const rows = await ctx.db
        .query("aiAnalyses")
        .withIndex("by_userId_timestamp", (q) => q.eq("userId", userId))
        .order("desc")
        .take(50);

      row =
        rows.find(
          (candidate) =>
            candidate.error === undefined && candidate.insight !== null,
        ) ?? null;
    }

    if (!row) return null;

    return {
      id: row._id,
      timestamp: row.timestamp,
      model: row.model,
      durationMs: row.durationMs,
      inputLogCount: row.inputLogCount,
      latestDigestionLogTimestamp: row.latestDigestionLogTimestamp,
      insight: row.insight,
      starred: row.starred ?? false,
    };
  },
});
