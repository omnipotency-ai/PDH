import { toast } from "sonner";

import { useHabits } from "@/hooks/useProfile";
import { normalizeActivityTypeKey } from "@/lib/activityTypeUtils";
import { getErrorMessage } from "@/lib/errors";
import type { HabitConfig } from "@/lib/habitTemplates";
import { isSleepHabit } from "@/lib/habitTemplates";
import { normalizeFluidItemName } from "@/lib/normalizeFluidName";
import { useRemoveSyncedLog, useUpdateSyncedLog } from "@/lib/sync";
import type { SyncedLog } from "@/lib/syncCore";
import { useStore } from "@/store";
import type {
  ActivityLogData,
  FluidLogData,
  HabitLogData,
  LogDataMap,
  LogType,
} from "@/types/domain";

type LogPayloadData = LogDataMap[LogType];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getHabitsForActivityType(
  habits: HabitConfig[],
  activityType: string,
): HabitConfig[] {
  if (activityType === "sleep") {
    return habits.filter((habit) => isSleepHabit(habit));
  }
  return habits.filter(
    (habit) => normalizeActivityTypeKey(habit.name) === activityType,
  );
}

function getActivityHabitLogValue(
  habit: HabitConfig,
  durationMinutes: number,
): number {
  return habit.unit === "hours"
    ? Math.round((durationMinutes / 60) * 100) / 100
    : durationMinutes;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Shared CRUD handlers for synced logs.
 * Used by both Track.tsx and Home.tsx (right column TodayLog).
 */
export function useTodayLogCrud(logs: SyncedLog[]) {
  const removeSyncedLog = useRemoveSyncedLog();
  const updateSyncedLog = useUpdateSyncedLog();
  const { habits } = useHabits();
  const addHabitLog = useStore((state) => state.addHabitLog);
  const removeHabitLog = useStore((state) => state.removeHabitLog);

  const handleDelete = async (id: string) => {
    try {
      const logToDelete = logs.find((entry) => entry.id === id);

      await removeSyncedLog(id);

      // Clean up corresponding habit logs in Zustand
      if (logToDelete) {
        if (logToDelete.type === "fluid") {
          const items = logToDelete.data?.items;
          if (Array.isArray(items)) {
            for (const item of items) {
              const normalizedName = normalizeFluidItemName(item?.name);
              const matchingHabit = habits.find(
                (h) =>
                  h.logAs === "fluid" &&
                  normalizeFluidItemName(h.name) === normalizedName,
              );
              if (matchingHabit) {
                removeHabitLog(matchingHabit.id, logToDelete.timestamp);
              }
            }
          }
        } else if (logToDelete.type === "habit") {
          const habitId = logToDelete.data?.habitId;
          if (typeof habitId === "string") {
            removeHabitLog(habitId, logToDelete.timestamp);
          }
        } else if (logToDelete.type === "activity") {
          const activityType = normalizeActivityTypeKey(
            String(logToDelete.data?.activityType ?? ""),
          );
          if (activityType === "sleep") {
            for (const habit of habits) {
              if (isSleepHabit(habit)) {
                removeHabitLog(habit.id, logToDelete.timestamp);
              }
            }
          } else {
            for (const habit of habits) {
              const habitActivityType = normalizeActivityTypeKey(habit.name);
              if (habitActivityType === activityType) {
                removeHabitLog(habit.id, logToDelete.timestamp);
              }
            }
          }
        }
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to delete entry."));
    }
  };

  const handleSave = async (
    id: string,
    data: LogPayloadData,
    timestamp?: number,
  ) => {
    try {
      const log = logs.find((entry) => entry.id === id);
      if (!log) {
        throw new Error("Log not found.");
      }

      await updateSyncedLog({
        id,
        timestamp: timestamp ?? log.timestamp,
        type: log.type,
        data,
      });

      const nextTimestamp = timestamp ?? log.timestamp;

      if (log.type === "fluid") {
        const nextFluidData = data as FluidLogData;
        const previousItems = Array.isArray(log.data?.items)
          ? log.data.items
          : [];
        for (const item of previousItems) {
          const normalizedName = normalizeFluidItemName(item?.name);
          const matchingHabit = habits.find(
            (habit) =>
              habit.logAs === "fluid" &&
              normalizeFluidItemName(habit.name) === normalizedName,
          );
          if (matchingHabit) {
            removeHabitLog(matchingHabit.id, log.timestamp);
          }
        }

        for (const item of nextFluidData.items) {
          const normalizedName = normalizeFluidItemName(item?.name);
          const quantity = Number(item.quantity ?? 0);
          if (!normalizedName || !Number.isFinite(quantity) || quantity <= 0) {
            continue;
          }

          const matchingHabit = habits.find(
            (habit) =>
              habit.logAs === "fluid" &&
              normalizeFluidItemName(habit.name) === normalizedName,
          );
          if (!matchingHabit) continue;

          addHabitLog({
            id: crypto.randomUUID(),
            habitId: matchingHabit.id,
            value: quantity,
            source: "quick",
            at: nextTimestamp,
          });
        }
      } else if (log.type === "habit") {
        const nextHabitData = data as HabitLogData;
        const previousHabitId =
          typeof log.data?.habitId === "string" ? log.data.habitId : null;
        if (previousHabitId) {
          removeHabitLog(previousHabitId, log.timestamp);
        }

        const nextHabitId =
          typeof nextHabitData.habitId === "string"
            ? nextHabitData.habitId
            : null;
        const nextQuantity = Number(nextHabitData.quantity ?? 1);
        if (nextHabitId && Number.isFinite(nextQuantity) && nextQuantity > 0) {
          addHabitLog({
            id: crypto.randomUUID(),
            habitId: nextHabitId,
            value: nextQuantity,
            source: "quick",
            at: nextTimestamp,
          });
        }
      } else if (log.type === "activity") {
        const nextActivityData = data as ActivityLogData;
        const previousActivityType = normalizeActivityTypeKey(
          String(log.data?.activityType ?? ""),
        );
        for (const habit of getHabitsForActivityType(
          habits,
          previousActivityType,
        )) {
          removeHabitLog(habit.id, log.timestamp);
        }

        const nextActivityType = normalizeActivityTypeKey(
          String(nextActivityData.activityType ?? ""),
        );
        const nextDurationMinutes = Number(
          nextActivityData.durationMinutes ?? 0,
        );
        if (Number.isFinite(nextDurationMinutes) && nextDurationMinutes > 0) {
          for (const habit of getHabitsForActivityType(
            habits,
            nextActivityType,
          )) {
            addHabitLog({
              id: crypto.randomUUID(),
              habitId: habit.id,
              value: getActivityHabitLogValue(habit, nextDurationMinutes),
              source: "quick",
              at: nextTimestamp,
            });
          }
        }
      }

      toast.success("Entry updated");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to update entry."));
      throw err;
    }
  };

  return { handleDelete, handleSave };
}
