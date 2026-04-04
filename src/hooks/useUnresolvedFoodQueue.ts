import { useMemo } from "react";
import { getFoodItemResolutionStatus } from "@/components/track/today-log/helpers";
import type { SyncedLog } from "@/lib/sync";
import type { FoodItem, FoodLogData } from "@/types/domain";
import { isFoodPipelineType } from "@shared/logTypeUtils";

export interface UnresolvedQueueItem {
  logId: string;
  itemIndex: number;
  foodName: string;
  rawInput: string;
  logTimestamp: number;
  logNotes?: string;
  item: FoodItem;
}

/**
 * Build a flat queue of all pending food items from today's logs.
 * Only includes items with status "pending" (not "expired" or "resolved").
 */
export function useUnresolvedFoodQueue(logs: SyncedLog[]): UnresolvedQueueItem[] {
  return useMemo(() => {
    const queue: UnresolvedQueueItem[] = [];

    for (const log of logs) {
      if (!isFoodPipelineType(log.type)) continue;

      const foodData = log.data as FoodLogData;
      if (!Array.isArray(foodData?.items)) continue;
      const items = foodData.items;
      const rawInput = foodData.rawInput ?? "";
      const notes = foodData.notes;

      for (let i = 0; i < items.length; i++) {
        const item: FoodItem = items[i];
        const status = getFoodItemResolutionStatus(item);

        if (status === "pending") {
          queue.push({
            logId: log.id,
            itemIndex: i,
            foodName: item.parsedName ?? item.name ?? item.userSegment ?? "Food",
            rawInput,
            logTimestamp: log.timestamp,
            item,
            ...(notes !== undefined && { logNotes: notes }),
          });
        }
      }
    }

    return queue;
  }, [logs]);
}
