/**
 * AI analysis and conversation sync hooks.
 */

import { useMutation, useQuery } from "convex/react";
import { useCallback, useMemo } from "react";
import { parseAiInsight } from "@/lib/aiAnalysis";
import {
  INPUT_SAFETY_LIMITS,
  sanitizePlainText,
  sanitizeUnknownStringsDeep,
} from "@/lib/inputSafety";
import type { AiNutritionistInsight } from "@/types/domain";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { asConvexId } from "./syncCore";

// ─── AI analysis types ────────────────────────────────────────────────────────

/** Typed payload for AI analysis Convex mutations */
interface AiAnalysisPayload {
  request: {
    model: string;
    messages: Array<{ role: string; content: string }>;
  } | null;
  response: string | null;
  insight: AiNutritionistInsight | null;
}

// ─── AI analysis hooks ────────────────────────────────────────────────────────

export function useAddAiAnalysis() {
  const add = useMutation(api.aiAnalyses.add);
  const aiPayloadSanitizeOptions = {
    maxStringLength: INPUT_SAFETY_LIMITS.aiPayloadString,
  } as const;
  return (
    payload: AiAnalysisPayload & {
      timestamp: number;
      model: string;
      durationMs: number;
      inputLogCount: number;
      latestDigestionLogTimestamp?: number;
      error?: string;
    },
  ) =>
    add({
      timestamp: payload.timestamp,
      request: sanitizeUnknownStringsDeep(payload.request, {
        ...aiPayloadSanitizeOptions,
        path: "request",
      }),
      response: sanitizeUnknownStringsDeep(payload.response, {
        ...aiPayloadSanitizeOptions,
        path: "response",
      }),
      insight: sanitizeUnknownStringsDeep(payload.insight, {
        ...aiPayloadSanitizeOptions,
        path: "insight",
      }),
      model: sanitizePlainText(payload.model, { preserveNewlines: false }),
      durationMs: payload.durationMs,
      inputLogCount: payload.inputLogCount,
      ...(payload.latestDigestionLogTimestamp !== undefined && {
        latestDigestionLogTimestamp: payload.latestDigestionLogTimestamp,
      }),
      ...(payload.error !== undefined && {
        error: sanitizePlainText(payload.error),
      }),
    });
}

export function useAiAnalysisHistory(limit = 50) {
  return useQuery(api.aiAnalyses.list, { limit });
}

export function useLatestSuccessfulAiAnalysis() {
  const row = useQuery(api.aiAnalyses.latestSuccessful, {});
  return useMemo(() => {
    if (!row) return row;
    const insight = parseAiInsight(row.insight);
    if (!insight) return null;
    return {
      ...row,
      insight,
    };
  }, [row]);
}

export function useToggleReportStar() {
  const toggle = useMutation(api.aiAnalyses.toggleStar);
  return (id: string) => toggle({ id: asConvexId<"aiAnalyses">(id) });
}

// ─── Conversation hooks ───────────────────────────────────────────────────────

export function useAddUserMessage() {
  const mutation = useMutation(api.conversations.addUserMessage);
  return useCallback(
    async (content: string, aiAnalysisId?: Id<"aiAnalyses">) => {
      const sanitizedContent = sanitizePlainText(content);
      if (!sanitizedContent) return;
      // TODO: Timestamp should ideally be generated server-side for consistency.
      // Client Date.now() may drift from server time. Acceptable for now since
      // conversations are per-user and timestamps are used for ordering, not billing.
      await mutation({
        content: sanitizedContent,
        timestamp: Date.now(),
        ...(aiAnalysisId !== undefined && { aiAnalysisId }),
      });
    },
    [mutation],
  );
}

export function useAddAssistantMessage() {
  const mutation = useMutation(api.conversations.addAssistantMessage);
  return useCallback(
    async (content: string, aiAnalysisId: Id<"aiAnalyses">) => {
      // TODO: Timestamp should ideally be generated server-side (see addUserMessage).
      await mutation({
        content: sanitizePlainText(content),
        aiAnalysisId,
        timestamp: Date.now(),
      });
    },
    [mutation],
  );
}

export function useConversationHistory(limit?: number) {
  return useQuery(api.conversations.list, limit !== undefined ? { limit } : {});
}

export function useConversationByReport(aiAnalysisId: Id<"aiAnalyses"> | null) {
  return useQuery(api.conversations.listByReport, aiAnalysisId ? { aiAnalysisId } : "skip");
}
