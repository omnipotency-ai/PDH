import type { ConvexReactClient } from "convex/react";
import { api } from "../../convex/_generated/api";

export interface DrPooAnalysisContextArgs {
  historyLimit: number;
  weeklyDigestLimit: number;
  halfWeekStartMs: number;
  stableEndMs: number;
}

export type DrPooAnalysisContext = Awaited<
  ReturnType<typeof fetchDrPooAnalysisContext>
>;

/**
 * Fetches all Dr. Poo analysis context in one parallel round-trip.
 *
 * Previously these were 7 live `useQuery` subscriptions mounted on Home via
 * `useAiInsights`, even though the data was only consumed inside the
 * `runAnalysis` callback. Moving them to imperative on-demand fetches
 * eliminates the continuous reactive bandwidth on Home / Insights.
 */
export async function fetchDrPooAnalysisContext(
  convex: ConvexReactClient,
  args: DrPooAnalysisContextArgs,
) {
  const [
    analysisHistory,
    latestSuccessfulAnalysis,
    foodTrials,
    weeklyDigests,
    conversationHistory,
    recentSuggestions,
    latestWeeklySummary,
    pendingReplies,
  ] = await Promise.all([
    convex.query(api.aiAnalyses.list, { limit: args.historyLimit }),
    convex.query(api.aiAnalyses.latestSuccessful, {}),
    convex.query(api.aggregateQueries.allFoodTrials, {}),
    convex.query(api.aggregateQueries.allWeeklyDigests, {
      limit: args.weeklyDigestLimit,
    }),
    convex.query(api.conversations.listByDateRange, {
      startMs: args.halfWeekStartMs,
      endMs: args.stableEndMs,
    }),
    convex.query(api.aiAnalyses.suggestionsByDateRange, {
      startMs: args.halfWeekStartMs,
      endMs: args.stableEndMs,
    }),
    convex.query(api.weeklySummaries.getLatest, {}),
    convex.query(api.conversations.pendingReplies, {}),
  ]);

  return {
    analysisHistory: analysisHistory ?? [],
    latestSuccessfulAnalysis: latestSuccessfulAnalysis ?? null,
    foodTrials,
    weeklyDigests: weeklyDigests ?? [],
    conversationHistory: conversationHistory ?? [],
    recentSuggestions: recentSuggestions ?? [],
    latestWeeklySummary: latestWeeklySummary ?? null,
    pendingReplies: pendingReplies ?? [],
  };
}
