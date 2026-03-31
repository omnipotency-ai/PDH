/**
 * Weekly digest, weekly summary, and date-range query hooks.
 */

import { useMutation, useQuery } from "convex/react";
import { sanitizeUnknownStringsDeep } from "@/lib/inputSafety";
import { api } from "../../convex/_generated/api";

// ─── Weekly digest hooks ─────────────────────────────────────────────────────

export function useWeeklyDigests(limit?: number) {
  return useQuery(api.aggregateQueries.allWeeklyDigests, limit !== undefined ? { limit } : {});
}

/** Compute Monday 00:00:00.000 local time for the current week. */
function getCurrentWeekStartMs(): number {
  const now = new Date();
  const day = now.getDay();
  // getDay(): 0=Sun, 1=Mon, ..., 6=Sat → shift so Monday = start of week
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday.getTime();
}

export function useCurrentWeekDigest() {
  const weekStartMs = getCurrentWeekStartMs();
  return useQuery(api.aggregateQueries.currentWeekDigest, { weekStartMs });
}

// ─── Weekly summary data hooks ───────────────────────────────────────────────

export function useConversationsByDateRange(startMs: number, endMs: number) {
  return useQuery(api.conversations.listByDateRange, { startMs, endMs });
}

export function useSuggestionsByDateRange(startMs: number, endMs: number) {
  return useQuery(api.aiAnalyses.suggestionsByDateRange, { startMs, endMs });
}

// ─── Weekly summary persistence hooks ────────────────────────────────────────

export function useLatestWeeklySummary() {
  return useQuery(api.weeklySummaries.getLatest, {});
}

export function useWeeklySummaryByWeek(weekStartTimestamp: number | null) {
  return useQuery(
    api.weeklySummaries.getByWeek,
    weekStartTimestamp !== null ? { weekStartTimestamp } : "skip",
  );
}

export function useAddWeeklySummary() {
  const add = useMutation(api.weeklySummaries.add);
  return (payload: {
    weekStartTimestamp: number;
    weekEndTimestamp: number;
    weeklySummary: string;
    keyFoods: {
      safe: string[];
      flagged: string[];
      toTryNext: string[];
    };
    carryForwardNotes: string[];
    model: string;
    durationMs: number;
    generatedAt: number;
  }) =>
    add({
      ...sanitizeUnknownStringsDeep(payload),
    });
}
