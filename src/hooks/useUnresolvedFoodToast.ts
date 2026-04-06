import { isFoodPipelineType } from "@shared/logTypeUtils";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { SyncedLog } from "@/lib/sync";
import { MS_PER_HOUR } from "@/lib/timeConstants";
import type { FoodItem, FoodLog, LiquidLog } from "@/types/domain";

/** 6-hour processing window in milliseconds. */
const PROCESSING_WINDOW_MS = 6 * MS_PER_HOUR;
/** First 3 hours show a gentler message. */
const EARLY_WINDOW_MS = 3 * MS_PER_HOUR;

/**
 * Check if a food item is unresolved (pending or expired but still within window).
 */
function isItemUnresolved(item: FoodItem): boolean {
  // Resolved items have a real canonicalName and resolvedBy
  if (
    item.canonicalName != null &&
    item.canonicalName.length > 0 &&
    item.canonicalName !== "unknown_food" &&
    (item.resolvedBy === "registry" || item.resolvedBy === "llm" || item.resolvedBy === "user")
  ) {
    return false;
  }
  // Expired items are already past the window — no toast needed
  if (item.resolvedBy === "expired") {
    return false;
  }
  return true;
}

/**
 * Find food logs with unresolved items within the 6-hour processing window.
 */
function findUnresolvedFoodLogs(logs: SyncedLog[], nowMs: number): (FoodLog | LiquidLog)[] {
  const result: (FoodLog | LiquidLog)[] = [];
  for (const log of logs) {
    if (!isFoodPipelineType(log.type)) continue;
    const foodLog = log as FoodLog | LiquidLog;
    const ageMs = nowMs - foodLog.timestamp;
    // Only show toast for logs within the 6-hour window
    if (ageMs > PROCESSING_WINDOW_MS || ageMs < 0) continue;
    // Must have items to check
    if (foodLog.data.items.length === 0) continue;
    const hasUnresolved = foodLog.data.items.some(isItemUnresolved);
    if (hasUnresolved) {
      result.push(foodLog);
    }
  }
  return result;
}

/**
 * Persistent toast notification for unresolved food items.
 *
 * Hours 0-3: "Some foods couldn't be matched -- tap to fix"
 * Hours 3-6: "Your entry has issues -- Fix now / Dismiss"
 *
 * The toast updates when the unresolved count changes and auto-dismisses
 * when all items are resolved or the 6-hour window closes.
 */
export function useUnresolvedFoodToast(
  logs: SyncedLog[],
  nowMs: number,
  onReview?: () => void,
): void {
  const toastIdRef = useRef<string | number | null>(null);
  const lastCountRef = useRef(0);
  const lastIsLateRef = useRef(false);
  const onReviewRef = useRef(onReview);
  onReviewRef.current = onReview;

  useEffect(() => {
    const unresolvedLogs = findUnresolvedFoodLogs(logs, nowMs);

    // Count total unresolved items across all logs
    let totalUnresolved = 0;
    let oldestLogTimestamp = nowMs;
    for (const log of unresolvedLogs) {
      for (const item of log.data.items) {
        if (isItemUnresolved(item)) {
          totalUnresolved += 1;
        }
      }
      if (log.timestamp < oldestLogTimestamp) {
        oldestLogTimestamp = log.timestamp;
      }
    }

    // No unresolved items — dismiss any existing toast
    if (totalUnresolved === 0) {
      if (toastIdRef.current != null) {
        toast.dismiss(toastIdRef.current);
        toastIdRef.current = null;
      }
      lastCountRef.current = 0;
      lastIsLateRef.current = false;
      return;
    }

    // Determine message based on age of the oldest unresolved log
    const ageMs = nowMs - oldestLogTimestamp;
    const isLateWindow = ageMs >= EARLY_WINDOW_MS;

    const itemWord = totalUnresolved === 1 ? "food" : "foods";

    const message = isLateWindow
      ? `${totalUnresolved} ${itemWord} still unmatched`
      : `${totalUnresolved} ${itemWord} couldn't be matched`;

    const description = isLateWindow
      ? "Unmatched items will be excluded from analysis after 6 hours."
      : "Tap to review and match to your food registry.";

    // Only update if count or window stage changed, or no toast is active
    if (
      totalUnresolved === lastCountRef.current &&
      isLateWindow === lastIsLateRef.current &&
      toastIdRef.current != null
    ) {
      return;
    }

    lastCountRef.current = totalUnresolved;
    lastIsLateRef.current = isLateWindow;

    // Dismiss previous toast before showing new one
    if (toastIdRef.current != null) {
      toast.dismiss(toastIdRef.current);
    }

    const id = toast.warning(message, {
      description,
      duration: Number.POSITIVE_INFINITY,
      dismissible: isLateWindow,
      ...(onReviewRef.current !== undefined && {
        action: {
          label: "Review",
          onClick: () => onReviewRef.current?.(),
        },
      }),
    });

    toastIdRef.current = id;
  }, [logs, nowMs]);

  // Clean up toast on unmount
  useEffect(() => {
    return () => {
      if (toastIdRef.current != null) {
        toast.dismiss(toastIdRef.current);
      }
    };
  }, []);
}
