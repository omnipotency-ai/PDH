/**
 * Client-initiated LLM food matching hook.
 *
 * Detects food logs with unresolved items (no canonicalName, no resolvedBy)
 * and calls the server-side matchUnresolvedItems action. The server resolves
 * the OpenAI API key from the user's Convex profile. Each log is only sent
 * once per mount (tracked via a ref Set).
 *
 * Skips if no API key is configured (client or server) or if no unresolved
 * items exist.
 *
 * Shows toast notifications for progress and results:
 * - Start: "Matching foods with AI..."
 * - Success: "X food(s) matched automatically"
 * - Error: user-friendly message (non-retryable errors only)
 */

import { useAction } from "convex/react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useApiKeyContext } from "@/contexts/ApiKeyContext";
import { useSyncedLogsContext } from "@/contexts/SyncedLogsContext";
import { asConvexId, type SyncedLog } from "@/lib/sync";
import type { FoodItem, FoodLog, LiquidLog } from "@/types/domain";
import { isFoodPipelineType } from "@shared/logTypeUtils";
import { api } from "../../convex/_generated/api";

/**
 * Check if a food item is unresolved and eligible for LLM matching.
 * An item is unresolved if it has no canonicalName and no resolvedBy.
 */
function isItemUnresolvedForLlm(item: FoodItem): boolean {
  if (item.canonicalName != null && item.canonicalName.length > 0) {
    return false;
  }
  if (item.resolvedBy != null) {
    return false;
  }
  return true;
}

/**
 * Find food logs that have unresolved items needing LLM matching.
 * Only considers logs from the last 6 hours (the processing window).
 */
function findLogsNeedingLlmMatching(logs: SyncedLog[], nowMs: number): (FoodLog | LiquidLog)[] {
  const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
  const result: (FoodLog | LiquidLog)[] = [];

  for (const log of logs) {
    if (!isFoodPipelineType(log.type)) continue;
    const foodLog = log as FoodLog | LiquidLog;

    // Only process logs within the 6-hour window
    const ageMs = nowMs - foodLog.timestamp;
    if (ageMs > SIX_HOURS_MS || ageMs < 0) continue;

    // Must have rawInput (new-style logs) and items
    if (!foodLog.data.rawInput || foodLog.data.items.length === 0) continue;

    // Must have at least one unresolved item
    const hasUnresolved = foodLog.data.items.some(isItemUnresolvedForLlm);
    if (hasUnresolved) {
      result.push(foodLog);
    }
  }

  return result;
}

/**
 * Automatically triggers LLM matching for food logs with unresolved items.
 *
 * Call this hook from the Track page. It monitors the user's food logs,
 * detects unresolved items, and sends them to OpenAI for matching.
 * Each log is only sent once per component mount.
 */
export function useFoodLlmMatching(): void {
  const logs = useSyncedLogsContext();
  const { hasApiKey } = useApiKeyContext();
  const matchItems = useAction(api.foodLlmMatching.matchUnresolvedItems);

  // Track which log IDs have already been sent to avoid duplicate calls
  const sentLogIdsRef = useRef(new Set<string>());
  // Store the action ref to avoid deps churn
  const matchItemsRef = useRef(matchItems);
  matchItemsRef.current = matchItems;

  useEffect(() => {
    if (!hasApiKey) return;

    const nowMs = Date.now();
    const logsNeedingMatching = findLogsNeedingLlmMatching(logs, nowMs);

    for (const foodLog of logsNeedingMatching) {
      // Skip if already sent
      if (sentLogIdsRef.current.has(foodLog.id)) continue;
      sentLogIdsRef.current.add(foodLog.id);

      // Collect unresolved segments
      const unresolvedSegments = foodLog.data.items
        .filter(isItemUnresolvedForLlm)
        .map((item) => item.userSegment ?? item.name ?? "")
        .filter((segment) => segment.length > 0);

      if (unresolvedSegments.length === 0) continue;

      const rawInput = foodLog.data.rawInput ?? "";
      if (!rawInput) continue;

      // Show a brief "matching in progress" indicator.
      const toastId = toast.loading("Matching foods with AI...", {
        duration: 30_000,
      });

      // Fire and forget — the server resolves the API key from the user's
      // Convex profile. Non-retryable errors (auth, validation, bad key) stay
      // in sentLogIdsRef so we don't spam the API. Retryable errors (rate
      // limit, server) are removed from the set so the next render cycle
      // can retry.
      matchItemsRef
        .current({
          logId: asConvexId<"logs">(foodLog.id),
          rawInput,
          unresolvedSegments,
        })
        .then((result) => {
          if (result.matched > 0) {
            const foodWord = result.matched === 1 ? "food" : "foods";
            toast.success(`${result.matched} ${foodWord} matched automatically`, {
              id: toastId,
            });
          } else {
            // Nothing matched — dismiss the loading toast silently.
            // The unresolved toast from useUnresolvedFoodToast will guide the user.
            toast.dismiss(toastId);
          }
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : "Unknown error";
          console.error(`LLM food matching failed for log ${foodLog.id}: ${message}`);

          // Non-retryable errors: don't remove from sent set (prevents retry loops)
          const isNonRetryable =
            message.includes("[NON_RETRYABLE]") ||
            message.includes("Invalid OpenAI API key") ||
            message.includes("Not authorized");

          if (isNonRetryable) {
            // Show user-friendly error for bad API key — most actionable non-retryable error
            if (
              message.includes("Invalid OpenAI API key") ||
              message.includes("No OpenAI API key available")
            ) {
              toast.error("AI matching failed: check your OpenAI API key in Settings", {
                id: toastId,
              });
            } else {
              toast.dismiss(toastId);
            }
          } else {
            // Retryable error — dismiss loading toast and remove from sent set so it can be retried
            toast.dismiss(toastId);
            sentLogIdsRef.current.delete(foodLog.id);
          }
        });
    }
    // logs array ref changes on every Convex update, but sentLogIdsRef deduplicates
  }, [logs, hasApiKey]);
}
