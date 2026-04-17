import { useAction, useConvex, useMutation } from "convex/react";
import { useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import { useSyncedLogsContext } from "@/contexts/SyncedLogsContext";
import { useAiConfig } from "@/hooks/useAiConfig";
import { useAiPreferences, useHealthProfile } from "@/hooks/useProfile";
import { getLastHalfWeekBoundary } from "@/hooks/useWeeklySummaryAutoTrigger";
import {
  type FetchAiInsightsOptions,
  fetchAiInsights,
  type PreviousReport,
  parseAiInsight,
} from "@/lib/aiAnalysis";
import { formatAiError } from "@/lib/aiErrorFormatter";
import { DR_POO_MODEL } from "@/lib/aiModels";
import { fetchDrPooAnalysisContext } from "@/lib/drPooAnalysisContext";
import { useAddAiAnalysis, useAddAssistantMessage } from "@/lib/sync";
import { useStore } from "@/store";
import type {
  AiPreferences,
  BaselineAverages,
  DrPooReply,
  HealthProfile,
  LogEntry,
} from "@/types/domain";
import { api } from "../../convex/_generated/api";

const COOLDOWN_MS = 21_600_000; // 6 hours
const REACTIVE_DELAY_MS = 1_500; // wait for Convex reactive query to update
// Pull recent history for educational insight dedupe (avoiding repeats).
// 20 reports covers ~2-3 weeks of typical usage — enough to avoid short-term
// repetition without fetching hundreds of documents from Convex on every render.
const REPORT_HISTORY_COUNT = 20;
const WEEKLY_DIGEST_COUNT = 4;

/**
 * Snapshot of render-time inputs that the analysis callback reads at send time.
 *
 * Unlike the previous implementation, this no longer holds Convex query results —
 * those are now fetched on-demand from within `runAnalysis`. Only per-render
 * inputs that the callback depends on (logs, profile, preferences, mutation
 * closures) are kept here.
 */
interface LiveRefs {
  logs: LogEntry[];
  healthProfile: HealthProfile;
  aiPreferences: AiPreferences;
  baselineAverages: BaselineAverages | null;
  addAssistantMessage: ReturnType<typeof useAddAssistantMessage>;
}

function shouldAutoTriggerAnalysis(args: {
  latestAnalyzedDigestionTimestamp: number | null;
  digestionTimestamp: number;
  bristolScore?: number;
  logs: LogEntry[];
}): boolean {
  const {
    latestAnalyzedDigestionTimestamp,
    digestionTimestamp,
    bristolScore,
    logs,
  } = args;

  if (latestAnalyzedDigestionTimestamp === null) {
    return true;
  }

  if (digestionTimestamp <= latestAnalyzedDigestionTimestamp) {
    return false;
  }

  if (digestionTimestamp - latestAnalyzedDigestionTimestamp >= COOLDOWN_MS) {
    return true;
  }

  if (bristolScore !== 7) {
    return false;
  }

  return !logs.some(
    (log) =>
      log.type === "digestion" &&
      log.timestamp > latestAnalyzedDigestionTimestamp &&
      log.timestamp < digestionTimestamp &&
      log.data.bristolCode === 7,
  );
}

export function useAiInsights() {
  const { isAiConfigured } = useAiConfig();
  const callAi = useAction(api.ai.chatCompletion);
  const convex = useConvex();
  const setAiAnalysisStatus = useStore((state) => state.setAiAnalysisStatus);
  const { healthProfile } = useHealthProfile();
  const { aiPreferences } = useAiPreferences();
  const baselineAverages = useStore((state) => state.baselineAverages);
  const markInsightRun = useStore((state) => state.markInsightRun);

  // Use shared logs from context instead of creating a duplicate subscription
  const { logs, isLoading } = useSyncedLogsContext();

  const addAiAnalysis = useAddAiAnalysis();
  const addAssistantMessage = useAddAssistantMessage();
  const claimPendingReplies = useMutation(
    api.conversations.claimPendingReplies,
  );

  // Use a ref to track the in-flight request — prevents concurrent analysis runs
  const abortRef = useRef<AbortController | null>(null);
  const loadingRef = useRef(false);

  // Conversation history + suggestions: current half-week only (since last Sun/Wed 21:00 boundary).
  // Historical context comes from the weekly summary, not from old messages/suggestions.
  // Derive stableEndMs from the boundary (not Date.now()) so it doesn't freeze at mount.
  const { halfWeekStartMs, stableEndMs } = useMemo(() => {
    const boundary = getLastHalfWeekBoundary();
    const boundaryMs = boundary.getTime();
    // Next boundary is 3-4 days away; add 7 days as a stable upper bound.
    return {
      halfWeekStartMs: boundaryMs,
      stableEndMs: boundaryMs + 7 * 24 * 60 * 60_000,
    };
  }, []);

  // Live refs for per-render inputs consumed inside the analysis callback.
  // Updated every render so the callback identity stays stable while still
  // reading the latest values at send time.
  const liveRef = useRef<LiveRefs>({
    logs,
    healthProfile: healthProfile ?? ({} as HealthProfile),
    aiPreferences,
    baselineAverages,
    addAssistantMessage,
  });
  liveRef.current.logs = logs;
  liveRef.current.healthProfile = healthProfile ?? ({} as HealthProfile);
  liveRef.current.aiPreferences = aiPreferences;
  liveRef.current.baselineAverages = baselineAverages;
  liveRef.current.addAssistantMessage = addAssistantMessage;

  const runAnalysis = useCallback(
    async (runOptions?: FetchAiInsightsOptions) => {
      if (!isAiConfigured) return;
      if (isLoading) return;
      if (loadingRef.current) return;

      const isLightweight = runOptions?.lightweight === true;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      loadingRef.current = true;

      setAiAnalysisStatus("sending");

      try {
        // Wait for Convex reactive query (logs) to include a just-logged entry
        await new Promise((resolve) => setTimeout(resolve, REACTIVE_DELAY_MS));
        if (controller.signal.aborted) return;

        // Fetch all Dr. Poo analysis context on demand (one parallel round-trip)
        const context = await fetchDrPooAnalysisContext(convex, {
          historyLimit: REPORT_HISTORY_COUNT,
          weeklyDigestLimit: WEEKLY_DIGEST_COUNT,
          halfWeekStartMs,
          stableEndMs,
        });

        if (controller.signal.aborted) return;

        const pendingReplies: DrPooReply[] = context.pendingReplies.map(
          (r: { content: string; timestamp: number }) => ({
            text: r.content,
            timestamp: r.timestamp,
          }),
        );

        // Context guard: in lightweight mode, pending replies are sufficient.
        // In full mode, require either bowel data or a pending question.
        if (isLightweight) {
          if (pendingReplies.length === 0) {
            setAiAnalysisStatus("error", "Send a question to Dr. Poo first.");
            return;
          }
        } else {
          const freshLogs = liveRef.current.logs;
          const hasBowelContext = freshLogs.some(
            (log) => log.type === "digestion",
          );
          const hasQuestionContext = pendingReplies.length > 0;
          if (!hasBowelContext && !hasQuestionContext) {
            setAiAnalysisStatus(
              "error",
              "Log a bowel movement or send a question first.",
            );
            return;
          }
        }

        const freshLogs = isLightweight ? [] : liveRef.current.logs;

        const previousReports: PreviousReport[] = isLightweight
          ? []
          : (() => {
              const results: PreviousReport[] = [];
              for (const a of context.analysisHistory) {
                if (a.insight === null || a.insight === undefined || a.error)
                  continue;
                const parsed = parseAiInsight(a.insight);
                if (parsed)
                  results.push({ timestamp: a.timestamp, insight: parsed });
              }
              return results;
            })();

        // Conversation history is always included (both modes need it)
        const conversationHistoryMapped = context.conversationHistory.map(
          (msg: {
            role: "user" | "assistant";
            content: string;
            timestamp: number;
          }) => ({
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp,
          }),
        );

        // Build enhanced context: lightweight mode only includes conversation history
        const enhancedContext = isLightweight
          ? { conversationHistory: conversationHistoryMapped }
          : {
              ...(context.foodTrials !== undefined && {
                foodTrials: context.foodTrials.trials,
              }),
              conversationHistory: conversationHistoryMapped,
              weeklyContext: context.weeklyDigests.map((wd) => ({
                weekStart: wd.weekStart,
                avgBristolScore: wd.avgBristolScore ?? null,
                totalBowelEvents: wd.totalBowelEvents,
                accidentCount: wd.accidentCount,
                uniqueFoodsEaten: wd.uniqueFoodsEaten,
                newFoodsTried: wd.newFoodsTried,
                foodsCleared: wd.foodsCleared,
                foodsFlagged: wd.foodsFlagged,
              })),
              recentSuggestions: context.recentSuggestions.map(
                (s: {
                  text: string;
                  textNormalized: string;
                  reportTimestamp: number;
                }) => ({
                  text: s.text,
                  textNormalized: s.textNormalized,
                  reportTimestamp: s.reportTimestamp,
                }),
              ),
              ...(context.latestWeeklySummary && {
                previousWeeklySummary: {
                  weeklySummary: context.latestWeeklySummary.weeklySummary,
                  keyFoods: context.latestWeeklySummary.keyFoods,
                  carryForwardNotes:
                    context.latestWeeklySummary.carryForwardNotes,
                },
              }),
              ...(liveRef.current.baselineAverages !== null && {
                baselineAverages: liveRef.current.baselineAverages,
              }),
            };

        setAiAnalysisStatus("receiving");
        const result = await fetchAiInsights(
          callAi,
          freshLogs as LogEntry[],
          previousReports,
          pendingReplies,
          liveRef.current.healthProfile,
          enhancedContext,
          liveRef.current.aiPreferences,
          isLightweight ? { lightweight: true } : undefined,
        );

        if (controller.signal.aborted) return;

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
            ...(result.latestDigestionLogTimestamp !== undefined && {
              latestDigestionLogTimestamp: result.latestDigestionLogTimestamp,
            }),
          });

          await claimPendingReplies({ aiAnalysisId: analysisId });

          if (result.insight.summary) {
            await liveRef.current.addAssistantMessage(
              result.insight.summary,
              analysisId,
            );
          }
          if (result.insight.directResponseToUser) {
            await liveRef.current.addAssistantMessage(
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
            model: DR_POO_MODEL,
            durationMs: 0,
            inputLogCount: isLightweight
              ? 0
              : liveRef.current.logs.filter((l) => l.type === "digestion")
                  .length,
            error: message,
          }).catch((saveErr) =>
            console.error("[AI Nutritionist] Failed to save error:", saveErr),
          );
        }
      } finally {
        loadingRef.current = false;
      }
    },
    [
      isAiConfigured,
      callAi,
      convex,
      setAiAnalysisStatus,
      addAiAnalysis,
      claimPendingReplies,
      markInsightRun,
      isLoading,
      halfWeekStartMs,
      stableEndMs,
    ],
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
  // latestSuccessfulAnalysis is fetched on-demand here — previously it was a
  // live subscription on every render, now it's a one-shot fetch only when the
  // trigger actually fires.
  const triggerAnalysis = useCallback(
    async (options?: {
      bristolScore?: number;
      autoSendEnabled?: boolean;
      digestionTimestamp?: number;
    }) => {
      if (!isAiConfigured) return;
      if (options?.autoSendEnabled === false) return;
      const digestionTimestamp = options?.digestionTimestamp;

      if (digestionTimestamp === undefined) {
        await runAnalysis();
        return;
      }

      const latestSuccessful = await convex.query(
        api.aiAnalyses.latestSuccessful,
        {},
      );
      const latestAnalyzedDigestionTimestamp =
        latestSuccessful?.latestDigestionLogTimestamp ?? null;

      if (
        !shouldAutoTriggerAnalysis({
          latestAnalyzedDigestionTimestamp,
          digestionTimestamp,
          ...(options?.bristolScore !== undefined && {
            bristolScore: options.bristolScore,
          }),
          logs: liveRef.current.logs,
        })
      ) {
        return;
      }

      await runAnalysis();
    },
    [isAiConfigured, runAnalysis, convex],
  );

  // sendNow: manual trigger. Always run the full analysis package and include
  // any unclaimed pending replies, regardless of the auto-trigger cooldown.
  const sendNow = useCallback(() => runAnalysis(), [runAnalysis]);

  // Memoize the return value so the parent component only re-renders when
  // the actual outputs change, not when internal queries resolve.
  const hasApiKey = Boolean(isAiConfigured);
  return useMemo(
    () => ({ hasApiKey, triggerAnalysis, sendNow }),
    [hasApiKey, triggerAnalysis, sendNow],
  );
}
