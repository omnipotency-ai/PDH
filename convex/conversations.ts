import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth } from "./lib/auth";
import { INPUT_SAFETY_LIMITS, sanitizeRequiredText } from "./lib/inputSafety";

// Store a user message (reply to Dr. Poo).
//
// Timestamp is accepted as a client arg for Convex deterministic replay —
// mutations must be deterministic, so Date.now() inside a mutation would break
// replay. The client generates the timestamp and the server stores it as-is.
export const addUserMessage = mutation({
  args: {
    content: v.string(),
    aiAnalysisId: v.optional(v.id("aiAnalyses")),
    timestamp: v.number(),
    promptVersion: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const content = sanitizeRequiredText(
      args.content,
      "User message",
      INPUT_SAFETY_LIMITS.conversationUserContent,
    );
    return await ctx.db.insert("conversations", {
      userId,
      role: "user",
      content,
      timestamp: args.timestamp,
      ...(args.aiAnalysisId !== undefined && {
        aiAnalysisId: args.aiAnalysisId,
      }),
      ...(args.promptVersion !== undefined && {
        promptVersion: args.promptVersion,
      }),
    });
  },
});

// Store Dr. Poo's summary as an assistant message (called after report is saved).
// See addUserMessage for why timestamp is a client arg.
export const addAssistantMessage = mutation({
  args: {
    content: v.string(),
    aiAnalysisId: v.id("aiAnalyses"),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const content = sanitizeRequiredText(
      args.content,
      "Assistant message",
      INPUT_SAFETY_LIMITS.conversationAssistantContent,
    );
    return await ctx.db.insert("conversations", {
      userId,
      role: "assistant",
      content,
      aiAnalysisId: args.aiAnalysisId,
      timestamp: args.timestamp,
    });
  },
});

// Get conversation history (newest first, paginated)
export const list = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const limit = Math.min(Math.max(args.limit ?? 100, 1), 500);
    return await ctx.db
      .query("conversations")
      .withIndex("by_userId_timestamp", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);
  },
});

// Get all messages for a specific report.
//
// Uses the by_userId_aiAnalysisId compound index to enforce tenant isolation
// at the database level, eliminating the prior in-memory userId filter.
export const listByReport = query({
  args: {
    aiAnalysisId: v.id("aiAnalyses"),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const messages = await ctx.db
      .query("conversations")
      .withIndex("by_userId_aiAnalysisId", (q) =>
        q.eq("userId", userId).eq("aiAnalysisId", args.aiAnalysisId),
      )
      .collect();
    // Sort chronologically — index does not guarantee timestamp order
    return messages.sort((a, b) => a.timestamp - b.timestamp);
  },
});

// Get all messages within a date range (for weekly summaries)
export const listByDateRange = query({
  args: {
    startMs: v.number(),
    endMs: v.number(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const messages = await ctx.db
      .query("conversations")
      .withIndex("by_userId_timestamp", (q) =>
        q
          .eq("userId", userId)
          .gte("timestamp", args.startMs)
          .lte("timestamp", args.endMs),
      )
      .collect();
    return messages.sort((a, b) => a.timestamp - b.timestamp);
  },
});

// Search conversations by keyword using Convex full-text search index.
// Previously loaded 500 rows and filtered in JS memory (WQ-337).
// Now uses the `search_content` search index for server-side full-text search,
// with userId as a filter field to enforce multi-tenant isolation.
export const search = query({
  args: {
    keyword: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
    const keyword = sanitizeRequiredText(
      args.keyword,
      "Search keyword",
      INPUT_SAFETY_LIMITS.searchKeyword,
      {
        preserveNewlines: false,
      },
    );
    const messages = await ctx.db
      .query("conversations")
      .withSearchIndex("search_content", (q) =>
        q.search("content", keyword).eq("userId", userId),
      )
      .take(limit);
    return messages;
  },
});

// Claim pending user replies by attaching them to a specific analysis.
//
// Tradeoff (WQ-336): Each pending message gets its own db.patch() call because
// Convex does not support multi-document batch updates. This is N individual
// writes within a single atomic mutation, which is correct and transactional.
// In practice N is small (users rarely have many unclaimed replies between
// reports), and the 20-message cap prevents pathological cases.
const CLAIM_PENDING_CAP = 20;

export const claimPendingReplies = mutation({
  args: {
    aiAnalysisId: v.id("aiAnalyses"),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    // Find recent user messages without an aiAnalysisId.
    // We filter in-memory because Convex cannot index on "field is undefined".
    const recentMessages = await ctx.db
      .query("conversations")
      .withIndex("by_userId_timestamp", (q) => q.eq("userId", userId))
      .order("desc")
      .take(100);
    const pending = recentMessages.filter(
      (m) => m.role === "user" && m.aiAnalysisId === undefined,
    );
    if (pending.length > CLAIM_PENDING_CAP) {
      console.warn(
        `[claimPendingReplies] ${pending.length} pending messages for user ${userId}, capping at ${CLAIM_PENDING_CAP}`,
      );
    }
    const toClaim = pending.slice(0, CLAIM_PENDING_CAP);
    for (const msg of toClaim) {
      await ctx.db.patch(msg._id, { aiAnalysisId: args.aiAnalysisId });
    }
  },
});

// Get pending user replies — messages with role "user" that haven't been claimed by an analysis yet
export const pendingReplies = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireAuth(ctx);
    // Fetch recent user messages and filter for those without an aiAnalysisId.
    // We use the by_userId_timestamp index for efficient retrieval, then filter
    // in-memory since Convex doesn't support indexing on "field is undefined".
    const recentMessages = await ctx.db
      .query("conversations")
      .withIndex("by_userId_timestamp", (q) => q.eq("userId", userId))
      .order("desc")
      .take(100);
    return recentMessages
      .filter((m) => m.role === "user" && m.aiAnalysisId === undefined)
      .slice(0, CLAIM_PENDING_CAP);
  },
});
