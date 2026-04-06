import { useAction, useMutation } from "convex/react";
import { useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import { useApiKeyContext } from "@/contexts/ApiKeyContext";
import { useSyncedLogsContext } from "@/contexts/SyncedLogsContext";
import { usePendingReplies } from "@/hooks/usePendingReplies";
import { useAiPreferences, useHealthProfile } from "@/hooks/useProfile";
import { getLastHalfWeekBoundary } from "@/hooks/useWeeklySummaryAutoTrigger";
import {
  type FetchAiInsightsOptions,
  fetchAiInsights,
  type PreviousReport,
  parseAiInsight,
} from "@/lib/aiAnalysis";
import { formatAiError } from "@/lib/aiErrorFormatter";
import { DEFAULT_INSIGHT_MODEL } from "@/lib/aiModels";
import {
  useAddAiAnalysis,
  useAddAssistantMessage,
  useAiAnalysisHistory,
  useAllFoodTrials,
  useConversationsByDateRange,
  useLatestSuccessfulAiAnalysis,
  useLatestWeeklySummary,
  useSuggestionsByDateRange,
  useWeeklyDigests,
} from "@/lib/sync";
import { useStore } from "@/store";
import type { AiPreferences, DrPooReply, HealthProfile, LogEntry } from "@/types/domain";
import { api } from "../../convex/_generated/api";

const COOLDOWN_MS = 21_600_000; // 6 hours
const REACTIVE_DELAY_MS = 1_500; // wait for Convex reactive query to update
// Pull recent history for educational insight dedupe (avoiding repeats).
// 20 reports covers ~2-3 weeks of typical usage — enough to avoid short-term
// repetition without fetching hundreds of documents from Convex on every render.
const REPORT_HISTORY_COUNT = 20;

/**
 * Mutable snapshot refs that track the latest values of reactive data for use inside callbacks.
 *
 * All Convex query results are stored here rather than used as callback dependencies.
 * This means the 8+ independent queries can resolve at different times without
 * causing callback identity churn or cascading re-renders to the parent component.
 */
interface DataRefs {
  logs: LogEntry[];
  history: ReturnType<typeof useAiAnalysisHistory>;
  addAssistantMessage: ReturnType<typeof useAddAssistantMessage>;
  replies: DrPooReply[];
  healthProfile: HealthProfile;
  aiPreferences: AiPreferences;
  foodTrials: ReturnType<typeof useAllFoodTrials>;
  weeklyDigests: ReturnType<typeof useWeeklyDigests>;
  conversationHistory: ReturnType<typeof useConversationsByDateRange>;
  recentSuggestions: ReturnType<typeof useSuggestionsByDateRange>;
  latestWeeklySummary: ReturnType<typeof useLatestWeeklySummary>;
  latestSuccessfulAnalysis: ReturnType<typeof useLatestSuccessfulAiAnalysis>;
  baselineAverages: import("@/types/domain").BaselineAverages | null;
}

export function useAiInsights() {
  const { apiKey } = useApiKeyContext();
  const callAi = useAction(api.ai.chatCompletion);
  const setAiAnalysisStatus = useStore((state) => state.setAiAnalysisStatus);
  const { pendingReplies } = usePendingReplies();
  const { healthProfile } = useHealthProfile();
  const { aiPreferences } = useAiPreferences();
  const baselineAverages = useStore((state) => state.baselineAverages);
  const markInsightRun = useStore((state) => state.markInsightRun);

  // Use shared logs from context instead of creating a duplicate subscription
  const logs = useSyncedLogsContext();

  // Fetch last N successful analyses for conversation context
  const analysisHistory = useAiAnalysisHistory(REPORT_HISTORY_COUNT);
  const latestSuccessfulAnalysis = useLatestSuccessfulAiAnalysis();

  const addAiAnalysis = useAddAiAnalysis();
  const addAssistantMessage = useAddAssistantMessage();
  const claimPendingReplies = useMutation(api.conversations.claimPendingReplies);

  // Use a ref to track the in-flight request — prevents concurrent analysis runs
  const abortRef = useRef<AbortController | null>(null);
  const loadingRef = useRef(false);

  // Layer 1-3 enhanced context hooks
  const foodTrials = useAllFoodTrials();

  const weeklyDigests = useWeeklyDigests(4);

  // Conversation history + suggestions: current half-week only (since last Sun/Wed 21:00 boundary).
  // Historical context comes from the weekly summary, not from old messages/suggestions.
  // Derive stableEndMs from the boundary (not Date.now()) so it doesn't freeze at mount.
  // The end bound is the next boundary after the current one, plus a day of padding.
  const { halfWeekStartMs, stableEndMs } = useMemo(() => {
    const boundary = getLastHalfWeekBoundary();
    const boundaryMs = boundary.getTime();
    // Next boundary is 3-4 days away; add 7 days as a stable upper bound.
    return {
      halfWeekStartMs: boundaryMs,
      stableEndMs: boundaryMs + 7 * 24 * 60 * 60_000,
    };
  }, []);

  const conversationHistory = useConversationsByDateRange(halfWeekStartMs, stableEndMs);

  // Suggestions: current half-week only (same boundary as conversations)
  const recentSuggestions = useSuggestionsByDateRange(halfWeekStartMs, stableEndMs);

  const latestWeeklySummary = useLatestWeeklySummary();

  // Map Convex pending replies to DrPooReply shape for the analysis callback
  const drPooReplies: DrPooReply[] = useMemo(
    () =>
      pendingReplies.map((r: { content: string; timestamp: number }) => ({
        text: r.content,
        timestamp: r.timestamp,
      })),
    [pendingReplies],
  );

  // ---------------------------------------------------------------------------
  // Single ref object for all mutable data snapshots used inside callbacks.
  // By storing ALL query results in a ref, we decouple query resolution from
  // callback identity — the 8+ queries can each resolve independently without
  // invalidating useCallback deps or triggering parent re-renders.
  // ---------------------------------------------------------------------------
  const dataRef = useRef<DataRefs>({
    logs,
    history: analysisHistory,
    addAssistantMessage,
    replies: drPooReplies,
    healthProfile: healthProfile ?? ({} as HealthProfile),
    aiPreferences,
    foodTrials,
    weeklyDigests,
    conversationHistory,
    recentSuggestions,
    latestWeeklySummary,
    latestSuccessfulAnalysis,
    baselineAverages,
  });
  dataRef.current.logs = logs;
  dataRef.current.history = analysisHistory;
  dataRef.current.addAssistantMessage = addAssistantMessage;
  dataRef.current.replies = drPooReplies;
  dataRef.current.healthProfile = healthProfile ?? ({} as HealthProfile);
  dataRef.current.aiPreferences = aiPreferences;
  dataRef.current.foodTrials = foodTrials;
  dataRef.current.weeklyDigests = weeklyDigests;
  dataRef.current.conversationHistory = conversationHistory;
  dataRef.current.recentSuggestions = recentSuggestions;
  dataRef.current.latestWeeklySummary = latestWeeklySummary;
  dataRef.current.latestSuccessfulAnalysis = latestSuccessfulAnalysis;
  dataRef.current.baselineAverages = baselineAverages;

  const runAnalysis = useCallback(
    async (runOptions?: FetchAiInsightsOptions) => {
      if (!apiKey) return;
      // Guard: skip if a request is already in flight
      if (loadingRef.current) return;

      const isLightweight = runOptions?.lightweight === true;

      // Abort any previous controller (defensive — should not be needed given the guard above)
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      loadingRef.current = true;

      setAiAnalysisStatus("sending");

      // Snapshot pending replies before the delay
      const pendingReplies = [...dataRef.current.replies];

      // Wait for Convex reactive query to include the just-logged entry
      await new Promise((resolve) => setTimeout(resolve, REACTIVE_DELAY_MS));

      // Context guard: in lightweight mode, pending replies are sufficient.
      // In full mode, require either bowel data or a pending question.
      if (isLightweight) {
        if (pendingReplies.length === 0) {
          setAiAnalysisStatus("error", "Send a question to Dr. Poo first.");
          loadingRef.current = false;
          return;
        }
      } else {
        const freshLogs = dataRef.current.logs;
        const hasBowelContext = freshLogs.some((log) => log.type === "digestion");
        const hasQuestionContext = pendingReplies.length > 0;
        if (!hasBowelContext && !hasQuestionContext) {
          setAiAnalysisStatus("error", "Log a bowel movement or send a question first.");
          loadingRef.current = false;
          return;
        }
      }

      // In lightweight mode, skip heavy data collection
      const freshLogs = isLightweight ? [] : dataRef.current.logs;

      const previousReports: PreviousReport[] = isLightweight
        ? []
        : (() => {
            const history = dataRef.current.history ?? [];
            const results: PreviousReport[] = [];
            for (const a of history) {
              if (a.insight === null || a.insight === undefined || a.error) continue;
              const parsed = parseAiInsight(a.insight);
              if (parsed) results.push({ timestamp: a.timestamp, insight: parsed });
            }
            return results;
          })();

      // Conversation history is always included (both modes need it)
      const conversationHistoryMapped = (dataRef.current.conversationHistory ?? []).map(
        (msg: { role: "user" | "assistant"; content: string; timestamp: number }) => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
        }),
      );

      // Build enhanced context: lightweight mode only includes conversation history
      const enhancedContext = isLightweight
        ? { conversationHistory: conversationHistoryMapped }
        : {
            ...(dataRef.current.foodTrials !== undefined && {
              foodTrials: dataRef.current.foodTrials.trials,
            }),
            conversationHistory: conversationHistoryMapped,
            weeklyContext: (dataRef.current.weeklyDigests ?? []).map((wd) => ({
              weekStart: wd.weekStart,
              avgBristolScore: wd.avgBristolScore ?? null,
              totalBowelEvents: wd.totalBowelEvents,
              accidentCount: wd.accidentCount,
              uniqueFoodsEaten: wd.uniqueFoodsEaten,
              newFoodsTried: wd.newFoodsTried,
              foodsCleared: wd.foodsCleared,
              foodsFlagged: wd.foodsFlagged,
            })),
            recentSuggestions: (dataRef.current.recentSuggestions ?? []).map(
              (s: { text: string; textNormalized: string; reportTimestamp: number }) => ({
                text: s.text,
                textNormalized: s.textNormalized,
                reportTimestamp: s.reportTimestamp,
              }),
            ),
            ...(dataRef.current.latestWeeklySummary && {
              previousWeeklySummary: {
                weeklySummary: dataRef.current.latestWeeklySummary.weeklySummary,
                keyFoods: dataRef.current.latestWeeklySummary.keyFoods,
                carryForwardNotes: dataRef.current.latestWeeklySummary.carryForwardNotes,
              },
            }),
            ...(dataRef.current.baselineAverages !== null && {
              baselineAverages: dataRef.current.baselineAverages,
            }),
          };

      try {
        if (controller.signal.aborted) return;

        setAiAnalysisStatus("receiving");
        const result = await fetchAiInsights(
          callAi,
          apiKey,
          freshLogs as LogEntry[],
          previousReports,
          pendingReplies,
          dataRef.current.healthProfile,
          enhancedContext,
          dataRef.current.aiPreferences,
          isLightweight ? { lightweight: true } : undefined,
        );

        if (!controller.signal.aborted) {
          // Mark that the insight run consumed the current baseline data
          // (skip in lightweight mode — no baseline data was consumed)
          if (!isLightweight) {
            markInsightRun();
          }

          try {
            const analysisId = await addAiAnalysis({
              timestamp: Date.now(),
              request: result.request,
              response: result.rawResponse,
              insight: result.insight,
              model: result.request.model,
              durationMs: result.durationMs,
              inputLogCount: result.inputLogCount,
            });

            await claimPendingReplies({ aiAnalysisId: analysisId });

            if (result.insight.summary) {
              await dataRef.current.addAssistantMessage(result.insight.summary, analysisId);
            }
            if (result.insight.directResponseToUser) {
              await dataRef.current.addAssistantMessage(
                result.insight.directResponseToUser,
                analysisId,
              );
            }

            if (!controller.signal.aborted) {
              setAiAnalysisStatus("done");
            }
          } catch (err) {
            console.error("[AI Nutritionist] Failed to save analysis:", err);
            if (!controller.signal.aborted) {
              setAiAnalysisStatus("error", "Failed to save analysis");
            }
            toast.error("Failed to save analysis");
          }
        }
      } catch (err: unknown) {
        console.error("[AI Nutritionist]", err);
        if (!controller.signal.aborted) {
          const message = formatAiError(err);
          setAiAnalysisStatus("error", message);

          // Save error record to Convex
          addAiAnalysis({
            timestamp: Date.now(),
            request: null,
            response: null,
            insight: null,
            model: DEFAULT_INSIGHT_MODEL,
            durationMs: 0,
            inputLogCount: isLightweight
              ? 0
              : dataRef.current.logs.filter((l) => l.type === "digestion").length,
            error: message,
          }).catch((saveErr) => console.error("[AI Nutritionist] Failed to save error:", saveErr));
        }
      } finally {
        loadingRef.current = false;
      }
    },
    [apiKey, callAi, setAiAnalysisStatus, addAiAnalysis, claimPendingReplies, markInsightRun],
  );

  // Background trigger (after logging bowel movement) — cooldown-gated, Bristol-aware.
  //
  // Policy: 6-hour cooldown on all auto-reports.
  // Only Bristol 7 can break cooldown, and only if no Bristol 7 has been
  // logged in the last 6 hours. This prevents report spam on bad days
  // while ensuring the first severe episode gets flagged.
  // When a report fires after 6 hours, it naturally includes all BMs from
  // the quiet period.
  //
  // latestSuccessfulAnalysis is read from dataRef (not a dep) so the callback
  // identity is stable even when that query re-resolves with the same timestamp.
  const triggerAnalysis = useCallback(
    async (options?: { bristolScore?: number; autoSendEnabled?: boolean }) => {
      if (!apiKey) return;

      if (options?.autoSendEnabled === false) return;

      const bristolScore = options?.bristolScore;
      const latestAiInsightAt = dataRef.current.latestSuccessfulAnalysis?.timestamp ?? null;
      const cooldownPassed = !latestAiInsightAt || Date.now() - latestAiInsightAt >= COOLDOWN_MS;

      if (!cooldownPassed) {
        // Inside cooldown — only Bristol 7 can break through, and only if
        // there hasn't been a 7 in the last 6 hours (not since last report).
        if (bristolScore !== 7) return;

        const sixHoursAgo = Date.now() - COOLDOWN_MS;
        const has7InLastSixHours = dataRef.current.logs.some(
          (log) =>
            log.type === "digestion" && log.timestamp > sixHoursAgo && log.data.bristolCode === 7,
        );
        // The current BM hasn't been saved to logs yet at this point,
        // so if we find a 7 in the logs it's a *previous* 7 — skip.
        if (has7InLastSixHours) return;
      }

      await runAnalysis();
    },
    [apiKey, runAnalysis],
  );

  // sendNow: manual trigger. During cooldown, use lightweight mode (conversation-only).
  // Reads latestSuccessfulAnalysis from dataRef for the same reason as triggerAnalysis.
  const sendNow = useCallback(() => {
    const latestAiInsightAt = dataRef.current.latestSuccessfulAnalysis?.timestamp ?? null;
    const isInCooldown = latestAiInsightAt != null && Date.now() - latestAiInsightAt < COOLDOWN_MS;
    return runAnalysis(isInCooldown ? { lightweight: true } : undefined);
  }, [runAnalysis]);

  // Memoize the return value so the parent component only re-renders when
  // the actual outputs change, not when internal queries resolve.
  const hasApiKey = Boolean(apiKey);
  return useMemo(
    () => ({ hasApiKey, triggerAnalysis, sendNow }),
    [hasApiKey, triggerAnalysis, sendNow],
  );
}
