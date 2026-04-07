import { useAction } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAiConfig } from "@/hooks/useAiConfig";
import { useAiPreferences } from "@/hooks/useProfile";
import { fetchWeeklySummary } from "@/lib/aiAnalysis";
import { formatTime } from "@/lib/aiUtils";
import { debugLog } from "@/lib/debugLog";
import { isDigestionLog } from "@/lib/logTypeGuards";
import {
  useAddWeeklySummary,
  useConversationsByDateRange,
  useLatestWeeklySummary,
  useSuggestionsByDateRange,
  useSyncedLogsByRange,
} from "@/lib/sync";
import { api } from "../../convex/_generated/api";

/**
 * Boundary hour for half-week periods.
 */
const BOUNDARY_HOUR = 21; // 9:00 PM local time

/**
 * Calculate the most recent half-week boundary (Sunday 21:00 or Wednesday 21:00)
 * that has already passed.
 *
 * Half-week periods:
 *   Sunday 21:00 → Wednesday 20:59:59
 *   Wednesday 21:00 → Sunday 20:59:59
 */
export function getLastHalfWeekBoundary(nowMs: number = Date.now()): Date {
  const now = new Date(nowMs);
  const day = now.getDay(); // 0=Sun, 3=Wed
  const hour = now.getHours();
  const target = new Date(now);

  if (day === 0) {
    if (hour >= BOUNDARY_HOUR) {
      target.setHours(BOUNDARY_HOUR, 0, 0, 0);
    } else {
      // Before Sunday boundary — last boundary was Wednesday (4 days back)
      target.setDate(now.getDate() - 4);
      target.setHours(BOUNDARY_HOUR, 0, 0, 0);
    }
  } else if (day === 1 || day === 2) {
    // Mon, Tue — last boundary was Sunday
    target.setDate(now.getDate() - day);
    target.setHours(BOUNDARY_HOUR, 0, 0, 0);
  } else if (day === 3) {
    if (hour >= BOUNDARY_HOUR) {
      target.setHours(BOUNDARY_HOUR, 0, 0, 0);
    } else {
      // Before Wednesday boundary — last boundary was Sunday (3 days back)
      target.setDate(now.getDate() - 3);
      target.setHours(BOUNDARY_HOUR, 0, 0, 0);
    }
  } else {
    // Thu (4), Fri (5), Sat (6) — last boundary was Wednesday
    target.setDate(now.getDate() - (day - 3));
    target.setHours(BOUNDARY_HOUR, 0, 0, 0);
  }

  return target;
}

function getNextHalfWeekBoundaryMs(nowMs: number): number {
  const lastBoundary = getLastHalfWeekBoundary(nowMs);
  const nextBoundary = new Date(lastBoundary);
  nextBoundary.setDate(
    nextBoundary.getDate() + (lastBoundary.getDay() === 0 ? 3 : 4),
  );
  return nextBoundary.getTime();
}

/**
 * Get the period that just completed (the half-week before the most recent boundary).
 * Used by the auto-trigger to know which period to summarise.
 */
function getCompletedPeriodBounds(nowMs: number = Date.now()): {
  startMs: number;
  endMs: number;
  periodLabel: string;
} {
  const lastBoundary = getLastHalfWeekBoundary(nowMs);
  const endMs = lastBoundary.getTime();

  // Find the boundary before lastBoundary
  const prevBoundary = new Date(lastBoundary);
  if (lastBoundary.getDay() === 0) {
    // Last boundary was Sunday — previous was Wednesday (4 days back)
    prevBoundary.setDate(prevBoundary.getDate() - 4);
  } else {
    // Last boundary was Wednesday — previous was Sunday (3 days back)
    prevBoundary.setDate(prevBoundary.getDate() - 3);
  }

  const startMs = prevBoundary.getTime();
  const periodLabel = prevBoundary.toISOString().slice(0, 10);

  return { startMs, endMs, periodLabel };
}

/**
 * Auto-triggers summary generation at each half-week boundary (Sunday 21:00 and Wednesday 21:00).
 * When a boundary passes:
 * 1. Checks if a summary already exists for the just-completed period
 * 2. If not, generates one from conversations, suggestions, and bowel notes
 */
export function useWeeklySummaryAutoTrigger() {
  const { isAiConfigured } = useAiConfig();
  const callAi = useAction(api.ai.chatCompletion);
  const { aiPreferences } = useAiPreferences();
  const latestSummary = useLatestWeeklySummary();
  const addWeeklySummary = useAddWeeklySummary();
  const [clockMs, setClockMs] = useState(() => Date.now());

  const { startMs, endMs, periodLabel } = getCompletedPeriodBounds(clockMs);

  useEffect(() => {
    const timeoutMs = Math.max(1, getNextHalfWeekBoundaryMs(clockMs) - Date.now());
    const timeoutId = window.setTimeout(() => {
      setClockMs(Date.now());
    }, timeoutMs);
    return () => window.clearTimeout(timeoutId);
  }, [clockMs]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        setClockMs(Date.now());
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  const conversations = useConversationsByDateRange(startMs, endMs);
  const suggestions = useSuggestionsByDateRange(startMs, endMs);
  const logs = useSyncedLogsByRange(startMs, endMs);

  const generatingRef = useRef(false);
  /** Tracks the period startMs we've already generated (or are generating) for,
   *  so we never fire twice for the same period even if Convex queries re-deliver. */
  const generatedForPeriodRef = useRef<number | null>(null);
  const addWeeklySummaryRef = useRef(addWeeklySummary);
  addWeeklySummaryRef.current = addWeeklySummary;

  // Store reactive query data in refs so the generate callback is stable
  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;
  const suggestionsRef = useRef(suggestions);
  suggestionsRef.current = suggestions;
  const logsRef = useRef(logs);
  logsRef.current = logs;
  const aiPreferencesRef = useRef(aiPreferences);
  aiPreferencesRef.current = aiPreferences;

  const generate = useCallback(async () => {
    if (!isAiConfigured || generatingRef.current) return;

    const currentConversations = conversationsRef.current;
    if (!currentConversations || currentConversations.length === 0) return;

    generatingRef.current = true;
    generatedForPeriodRef.current = startMs;

    // Build the payload
    const conversationMessages = currentConversations.map(
      (msg: { role: string; content: string; timestamp: number }) => ({
        role: msg.role,
        content: msg.content,
        timestamp: formatTime(msg.timestamp),
      }),
    );

    const suggestionTexts = (suggestionsRef.current ?? []).map((s: { text: string }) => s.text);

    const bowelNotes = (logsRef.current ?? [])
      .filter(isDigestionLog)
      .filter((log) => typeof log.data.notes === "string" && log.data.notes.trim() !== "")
      .map((log) => ({
        timestamp: formatTime(log.timestamp),
        bristolCode: typeof log.data.bristolCode === "number" ? log.data.bristolCode : null,
        notes: String(log.data.notes).trim(),
      }));

    const input = {
      weekOf: periodLabel,
      conversationMessages,
      suggestions: suggestionTexts,
      bowelNotes,
    };

    debugLog(
      "WeeklySummary",
      `Auto-generating for week of ${periodLabel}: ${conversationMessages.length} messages, ${suggestionTexts.length} suggestions, ${bowelNotes.length} bowel notes`,
    );

    try {
      const model = aiPreferencesRef.current.aiModel;
      const response = await fetchWeeklySummary(callAi, input, model);

      await addWeeklySummaryRef.current({
        weekStartTimestamp: startMs,
        weekEndTimestamp: endMs,
        weeklySummary: response.result.weeklySummary,
        keyFoods: response.result.keyFoods,
        carryForwardNotes: response.result.carryForwardNotes,
        model,
        durationMs: response.durationMs,
        generatedAt: Date.now(),
        promptVersion: aiPreferencesRef.current.promptVersion,
      });

      debugLog(
        "WeeklySummary",
        `Saved summary for week of ${periodLabel} (${response.durationMs}ms)`,
      );
    } catch (err) {
      console.error("[Weekly Summary] Auto-generation failed:", err);
      // Reset so it can retry on next boundary (but not in a loop)
      generatedForPeriodRef.current = null;
    } finally {
      generatingRef.current = false;
    }
  }, [isAiConfigured, callAi, periodLabel, startMs, endMs]);

  // Auto-trigger: check on mount and whenever data loads.
  // Depends only on stable values — conversations?.length triggers when data first arrives,
  // but generatedForPeriodRef prevents duplicate runs.
  const dataReady = conversations !== undefined && suggestions !== undefined;
  const hasConversations = (conversations?.length ?? 0) > 0;
  const alreadyHasSummary =
    latestSummary !== undefined && latestSummary?.weekStartTimestamp === startMs;

  useEffect(() => {
    if (!isAiConfigured) return;
    if (!dataReady || !hasConversations) return;
    if (alreadyHasSummary) return;
    if (generatingRef.current) return;
    if (generatedForPeriodRef.current === startMs) return;

    generate();
  }, [isAiConfigured, dataReady, hasConversations, alreadyHasSummary, startMs, generate]);
}
