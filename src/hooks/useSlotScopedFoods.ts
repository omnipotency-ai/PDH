import { isFoodPipelineType } from "@shared/logTypeUtils";
import { useMemo } from "react";
import { useSyncedLogsContext } from "@/contexts/SyncedLogsContext";
import { getMealSlot, type MealSlot } from "@/lib/nutritionUtils";
import type { SyncedLog } from "@/lib/sync";
import { MS_PER_DAY } from "@/lib/timeConstants";

type FoodPipelineLog = SyncedLog & { type: "food" | "liquid" };

interface SlotScopedFoods {
  recentFoods: string[];
  frequentFoods: string[];
}

function isFoodPipelineLog(log: SyncedLog): log is FoodPipelineLog {
  return isFoodPipelineType(log.type);
}

export function useSlotScopedFoods(activeMealSlot: MealSlot): SlotScopedFoods {
  const { logs } = useSyncedLogsContext();

  return useMemo(() => {
    const recentFoods: string[] = [];
    const recentSeen = new Set<string>();
    const frequencyMap = new Map<string, number>();
    const lastSeenMap = new Map<string, number>();
    const recentCutoff = Date.now() - 7 * MS_PER_DAY;

    for (const log of logs) {
      if (!isFoodPipelineLog(log)) continue;
      if (getMealSlot(log.timestamp) !== activeMealSlot) continue;

      for (const item of log.data.items) {
        const canonicalName = item.canonicalName;
        if (!canonicalName) continue;

        if (log.timestamp >= recentCutoff && !recentSeen.has(canonicalName)) {
          recentSeen.add(canonicalName);
          recentFoods.push(canonicalName);
        }

        frequencyMap.set(canonicalName, (frequencyMap.get(canonicalName) ?? 0) + 1);
        lastSeenMap.set(
          canonicalName,
          Math.max(lastSeenMap.get(canonicalName) ?? 0, log.timestamp),
        );
      }
    }

    const frequentFoods = [...frequencyMap.entries()]
      .sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];

        const bLastSeen = lastSeenMap.get(b[0]) ?? 0;
        const aLastSeen = lastSeenMap.get(a[0]) ?? 0;
        if (bLastSeen !== aLastSeen) return bLastSeen - aLastSeen;

        return a[0].localeCompare(b[0]);
      })
      .map(([canonicalName]) => canonicalName);

    return {
      recentFoods,
      frequentFoods,
    };
  }, [activeMealSlot, logs]);
}
