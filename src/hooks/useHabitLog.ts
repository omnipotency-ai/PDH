import { startOfWeek } from "date-fns";
import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { useProfileContext } from "@/contexts/ProfileContext";
import { useHabits, useHealthProfile, useUnitSystem } from "@/hooks/useProfile";
import type { HabitConfig } from "@/lib/habitTemplates";
import {
  isCapHabit,
  isCheckboxHabit,
  isTargetHabit,
} from "@/lib/habitTemplates";
import { normalizeFluidItemName } from "@/lib/normalizeFluidName";
import { type SyncedLog, useAddSyncedLog } from "@/lib/sync";
import { formatFluidDisplay } from "@/lib/units";
import { useStore } from "@/store";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UseHabitLogOptions {
  afterSave: () => void;
  todayHabitCounts: Record<string, number>;
  todayFluidTotalsByName: Record<string, number>;
  logs: SyncedLog[];
  todayStart: number;
  todayEnd: number;
  removeSyncedLog: (id: string) => Promise<unknown>;
  removeHabitLog: (habitId: string, at: number) => void;
  onRequestEdit: (logId: string, captureOffset?: number) => void;
  captureTimestamp?: number;
  captureStart?: number;
  captureEnd?: number;
  captureOffset?: number;
  checkAndCelebrateGoal: (
    habit: HabitConfig,
    previousValue: number,
    nextValue: number,
  ) => void;
  /** Direct celebration callback for custom messages (e.g. weekly frequency goals). */
  celebrateGoalComplete: (message: string) => void;
}

interface HabitLogResult {
  handleQuickCaptureTap: (habit: HabitConfig) => Promise<void>;
  handleLogSleepQuickCapture: (
    habit: HabitConfig,
    hours: number,
  ) => Promise<void>;
  handleLogActivityQuickCapture: (
    habit: HabitConfig,
    minutes: number,
  ) => Promise<void>;
  handleLogFluid: (
    name: string,
    milliliters: number,
    timestamp?: number,
    skipHabitLog?: boolean,
  ) => Promise<string>;
  handleIncrementHabit: (
    habit: HabitConfig,
    currentCompleted: number,
    timestamp?: number,
  ) => Promise<string>;
  handleLogWeightKg: (weightKg: number) => Promise<void>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toActivityType(habit: HabitConfig): string {
  const key = habit.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (habit.habitType === "sleep") return "sleep";
  if (/^walk(ing)?$/.test(key)) return "walk";
  return key || "activity";
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * All habit/fluid/activity/sleep/weight logging handlers.
 * Extracted from useQuickCapture to isolate data persistence logic.
 */
export function useHabitLog({
  afterSave,
  todayHabitCounts,
  todayFluidTotalsByName,
  logs,
  todayStart,
  todayEnd,
  removeSyncedLog,
  removeHabitLog,
  onRequestEdit,
  captureTimestamp: captureTimestampProp,
  captureStart: captureStartProp,
  captureEnd: captureEndProp,
  captureOffset = 0,
  checkAndCelebrateGoal,
  celebrateGoalComplete,
}: UseHabitLogOptions): HabitLogResult {
  const addSyncedLog = useAddSyncedLog();
  const { habits } = useHabits();
  const addHabitLog = useStore((state) => state.addHabitLog);
  const habitLogs = useStore((state) => state.habitLogs);
  const { healthProfile } = useHealthProfile();
  const { patchProfile } = useProfileContext();
  const { unitSystem } = useUnitSystem();

  // Ref for healthProfile so callbacks can read the latest value
  const healthProfileRef = useRef(healthProfile);
  healthProfileRef.current = healthProfile;

  // Capture timestamp ref — stable reference, no useCallback dep changes needed.
  // When dayOffset === 0 this is undefined and captureNow() falls back to Date.now().
  const captureTimestampRef = useRef<number | undefined>(captureTimestampProp);
  captureTimestampRef.current = captureTimestampProp;

  const captureNow = useCallback(
    () => captureTimestampRef.current ?? Date.now(),
    [],
  );
  const captureStart = captureStartProp ?? todayStart;
  const captureEnd = captureEndProp ?? todayEnd;

  // ─── handleLogFluid ───────────────────────────────────────────────────────

  const handleLogFluid = useCallback(
    async (
      name: string,
      milliliters: number,
      timestamp = captureNow(),
      skipHabitLog = false,
    ): Promise<string> => {
      const logId = await addSyncedLog({
        timestamp,
        type: "fluid",
        data: {
          items: [{ name, quantity: milliliters, unit: "ml" }],
        },
      });
      const syncedLogId = String(logId);

      let matchedHabitId: string | undefined;
      if (!skipHabitLog) {
        const normalizedName = normalizeFluidItemName(name);
        const matchingFluidHabit = habits.find(
          (h) =>
            h.logAs === "fluid" &&
            normalizeFluidItemName(h.name) === normalizedName,
        );
        if (matchingFluidHabit) {
          matchedHabitId = matchingFluidHabit.id;
          addHabitLog({
            id: crypto.randomUUID(),
            habitId: matchingFluidHabit.id,
            value: isCapHabit(matchingFluidHabit) ? 1 : milliliters,
            source: "quick",
            at: timestamp,
          });
        }
      }

      afterSave();

      if (!skipHabitLog) {
        const undoHabitId = matchedHabitId;
        const editId = syncedLogId;
        toast(`+${formatFluidDisplay(milliliters, unitSystem)} ${name}`, {
          action: {
            label: "Undo",
            onClick: () => {
              void removeSyncedLog(syncedLogId);
              if (undoHabitId) removeHabitLog(undoHabitId, timestamp);
            },
          },
          cancel: {
            label: "Edit",
            onClick: () => onRequestEdit(editId, captureOffset),
          },
          duration: 4000,
        });
      }

      return syncedLogId;
    },
    [
      addSyncedLog,
      habits,
      addHabitLog,
      captureNow,
      captureOffset,
      afterSave,
      removeSyncedLog,
      removeHabitLog,
      onRequestEdit,
      unitSystem,
    ],
  );

  // ─── handleIncrementHabit ─────────────────────────────────────────────────

  const handleIncrementHabit = useCallback(
    async (
      habit: HabitConfig,
      currentCompleted: number,
      timestamp = captureNow(),
    ): Promise<string> => {
      const logId = await addSyncedLog({
        timestamp,
        type: "habit",
        data: {
          habitId: habit.id,
          name: habit.name,
          habitType: habit.habitType,
          quantity: 1,
          action: "event",
        },
      });
      afterSave();

      checkAndCelebrateGoal(habit, currentCompleted, currentCompleted + 1);

      return String(logId);
    },
    [addSyncedLog, captureNow, afterSave, checkAndCelebrateGoal],
  );

  // ─── handleLogSleepQuickCapture ───────────────────────────────────────────

  const handleLogSleepQuickCapture = useCallback(
    async (habit: HabitConfig, hours: number): Promise<void> => {
      const normalizedHours = Math.round(hours * 4) / 4;
      if (!Number.isFinite(normalizedHours) || normalizedHours <= 0) {
        toast.error("Enter sleep hours greater than 0.");
        return;
      }

      const wakeTime = captureNow();
      const totalMinutes = Math.round(normalizedHours * 60);
      const sleepStart = wakeTime - totalMinutes * 60_000;

      // Split across midnight: if sleep started before today's midnight, create
      // two separate logs so each calendar day gets the correct portion.
      if (sleepStart < captureStart) {
        const todayMinutes = Math.round((wakeTime - captureStart) / 60_000);
        const yesterdayMinutes = totalMinutes - todayMinutes;

        const [todayLogId, yesterdayLogId] = await Promise.all([
          addSyncedLog({
            // Today portion stamped at actual wake time.
            timestamp: wakeTime,
            type: "activity",
            data: { activityType: "sleep", durationMinutes: todayMinutes },
          }),
          addSyncedLog({
            // Yesterday portion stamped at 23:59:59.999 of yesterday.
            timestamp: captureStart - 1,
            type: "activity",
            data: { activityType: "sleep", durationMinutes: yesterdayMinutes },
          }),
        ]);
        const syncedTodayId = String(todayLogId);
        const syncedYesterdayId = String(yesterdayLogId);

        const todayHours = Math.round((todayMinutes / 60) * 100) / 100;
        const yesterdayHours = Math.round((yesterdayMinutes / 60) * 100) / 100;

        // NOTE: Reading getState() after an await creates a potential race condition —
        // another callback could have mutated habitLogs between the await and this read.
        // In practice, this is low-risk because quick-capture taps are debounced and
        // the dedup check (matching habitId + timestamp + value) is tolerant of duplicates.
        const currentHabitLogs = useStore.getState().habitLogs;
        const hasTodayHabitLog = currentHabitLogs.some(
          (log) =>
            log.habitId === habit.id &&
            log.at === wakeTime &&
            Math.abs(log.value - todayHours) < 0.001,
        );
        if (!hasTodayHabitLog) {
          addHabitLog({
            id: crypto.randomUUID(),
            habitId: habit.id,
            value: todayHours,
            source: "quick",
            at: wakeTime,
          });
        }

        const hasYesterdayHabitLog = useStore
          .getState()
          .habitLogs.some(
            (log) =>
              log.habitId === habit.id &&
              log.at === captureStart - 1 &&
              Math.abs(log.value - yesterdayHours) < 0.001,
          );
        if (!hasYesterdayHabitLog) {
          addHabitLog({
            id: crypto.randomUUID(),
            habitId: habit.id,
            value: yesterdayHours,
            source: "quick",
            at: captureStart - 1,
          });
        }

        afterSave();

        const previousValue = todayHabitCounts[habit.id] ?? 0;
        const nextValue = previousValue + todayHours;
        checkAndCelebrateGoal(habit, previousValue, nextValue);

        toast(`+${normalizedHours} hrs ${habit.name} (split across midnight)`, {
          action: {
            label: "Undo",
            onClick: () => {
              void removeSyncedLog(syncedTodayId);
              void removeSyncedLog(syncedYesterdayId);
              removeHabitLog(habit.id, wakeTime);
              removeHabitLog(habit.id, captureStart - 1);
            },
          },
          cancel: {
            label: "Edit",
            onClick: () => onRequestEdit(syncedTodayId, captureOffset),
          },
          duration: 4000,
        });

        return;
      }

      // No midnight crossing — log as a single entry at wake time.
      const logId = await addSyncedLog({
        timestamp: wakeTime,
        type: "activity",
        data: {
          activityType: "sleep",
          durationMinutes: totalMinutes,
        },
      });
      const syncedLogId = String(logId);

      const hasMatchingHabitLog = useStore
        .getState()
        .habitLogs.some(
          (log) =>
            log.habitId === habit.id &&
            log.at === wakeTime &&
            Math.abs(log.value - normalizedHours) < 0.001,
        );
      if (!hasMatchingHabitLog) {
        addHabitLog({
          id: crypto.randomUUID(),
          habitId: habit.id,
          value: normalizedHours,
          source: "quick",
          at: wakeTime,
        });
      }

      afterSave();

      const previousValue = todayHabitCounts[habit.id] ?? 0;
      const nextValue = previousValue + normalizedHours;
      checkAndCelebrateGoal(habit, previousValue, nextValue);

      toast(`+${normalizedHours} hrs ${habit.name}`, {
        action: {
          label: "Undo",
          onClick: () => {
            void removeSyncedLog(syncedLogId);
            removeHabitLog(habit.id, wakeTime);
          },
        },
        cancel: {
          label: "Edit",
          onClick: () => onRequestEdit(syncedLogId, captureOffset),
        },
        duration: 4000,
      });
    },
    [
      addSyncedLog,
      addHabitLog,
      afterSave,
      captureNow,
      captureStart,
      captureOffset,
      todayHabitCounts,
      checkAndCelebrateGoal,
      removeSyncedLog,
      removeHabitLog,
      onRequestEdit,
    ],
  );

  // ─── handleLogActivityQuickCapture ────────────────────────────────────────

  const handleLogActivityQuickCapture = useCallback(
    async (habit: HabitConfig, minutes: number): Promise<void> => {
      const normalizedMinutes = Math.max(1, Math.round(minutes));
      if (!Number.isFinite(normalizedMinutes) || normalizedMinutes <= 0) {
        toast.error("Enter activity minutes greater than 0.");
        return;
      }

      const timestamp = captureNow();
      const activityType = toActivityType(habit);

      const logId = await addSyncedLog({
        timestamp,
        type: "activity",
        data: {
          activityType,
          durationMinutes: normalizedMinutes,
        },
      });
      const syncedLogId = String(logId);

      const habitLogValue =
        habit.unit === "hours"
          ? Math.round((normalizedMinutes / 60) * 100) / 100
          : normalizedMinutes;

      addHabitLog({
        id: crypto.randomUUID(),
        habitId: habit.id,
        value: habitLogValue,
        source: "quick",
        at: timestamp,
      });

      afterSave();

      const previousValue = todayHabitCounts[habit.id] ?? 0;
      const nextValue = previousValue + habitLogValue;
      checkAndCelebrateGoal(habit, previousValue, nextValue);

      if (
        habit.weeklyFrequencyTarget !== undefined &&
        habit.weeklyFrequencyTarget > 0
      ) {
        const weekStart = startOfWeek(new Date(timestamp), {
          weekStartsOn: 1,
        }).getTime();
        const weekEnd = weekStart + 7 * 24 * 60 * 60 * 1000;
        const sessionsThisWeek = habitLogs.filter(
          (entry) =>
            entry.habitId === habit.id &&
            entry.at >= weekStart &&
            entry.at < weekEnd,
        ).length;
        const nextSessions = sessionsThisWeek + 1;
        if (
          sessionsThisWeek < habit.weeklyFrequencyTarget &&
          nextSessions >= habit.weeklyFrequencyTarget
        ) {
          celebrateGoalComplete(
            `${habit.name} weekly goal hit: ${nextSessions}/${habit.weeklyFrequencyTarget} sessions.`,
          );
        }
      }
      toast(`+${normalizedMinutes} min ${habit.name}`, {
        action: {
          label: "Undo",
          onClick: () => {
            void removeSyncedLog(syncedLogId);
            removeHabitLog(habit.id, timestamp);
          },
        },
        cancel: {
          label: "Edit",
          onClick: () => onRequestEdit(syncedLogId, captureOffset),
        },
        duration: 4000,
      });
    },
    [
      addSyncedLog,
      addHabitLog,
      captureNow,
      captureOffset,
      habitLogs,
      afterSave,
      todayHabitCounts,
      checkAndCelebrateGoal,
      celebrateGoalComplete,
      removeSyncedLog,
      removeHabitLog,
      onRequestEdit,
    ],
  );

  // ─── handleLogWeightKg ────────────────────────────────────────────────────

  const handleLogWeightKg = useCallback(
    async (weightKg: number): Promise<void> => {
      const previousWeight = healthProfileRef.current?.currentWeight ?? null;
      const logId = await addSyncedLog({
        timestamp: captureNow(),
        type: "weight",
        data: { weightKg },
      });
      const syncedLogId = String(logId);
      if (healthProfileRef.current) {
        void patchProfile({
          healthProfile: {
            ...healthProfileRef.current,
            currentWeight: weightKg,
          },
        });
      }
      afterSave();

      toast("Weight logged", {
        action: {
          label: "Undo",
          onClick: () => {
            void removeSyncedLog(syncedLogId);
            if (healthProfileRef.current) {
              void patchProfile({
                healthProfile: {
                  ...healthProfileRef.current,
                  currentWeight: previousWeight,
                },
              });
            }
          },
        },
        cancel: {
          label: "Edit",
          onClick: () => onRequestEdit(syncedLogId, captureOffset),
        },
        duration: 4000,
      });
    },
    [
      addSyncedLog,
      captureNow,
      captureOffset,
      patchProfile,
      afterSave,
      removeSyncedLog,
      onRequestEdit,
    ],
  );

  // ─── handleCheckboxToggle ─────────────────────────────────────────────────

  const handleCheckboxToggle = useCallback(
    async (habit: HabitConfig): Promise<void> => {
      const todayCheckboxEntries = logs
        .filter(
          (entry) =>
            entry.type === "habit" &&
            entry.timestamp >= captureStart &&
            entry.timestamp < captureEnd &&
            String(entry.data?.habitId ?? "").trim() === habit.id,
        )
        .sort((a, b) => b.timestamp - a.timestamp);

      if (todayCheckboxEntries.length > 0) {
        for (const entry of todayCheckboxEntries) {
          await removeSyncedLog(entry.id);
          removeHabitLog(habit.id, entry.timestamp);
        }
        toast.success(`${habit.name} unchecked`);
        return;
      }

      const timestamp = captureNow();
      addHabitLog({
        id: crypto.randomUUID(),
        habitId: habit.id,
        value: 1,
        source: "quick",
        at: timestamp,
      });

      const checkLogId = await addSyncedLog({
        timestamp,
        type: "habit",
        data: {
          habitId: habit.id,
          name: habit.name,
          habitType: habit.habitType,
          quantity: 1,
          action: "check",
        },
      });
      const checkSyncedLogId = String(checkLogId);
      afterSave();

      toast(`\u2713 ${habit.name}`, {
        action: {
          label: "Undo",
          onClick: () => {
            void removeSyncedLog(checkSyncedLogId);
            removeHabitLog(habit.id, timestamp);
          },
        },
        cancel: {
          label: "Edit",
          onClick: () => onRequestEdit(checkSyncedLogId, captureOffset),
        },
        duration: 4000,
      });
    },
    [
      addHabitLog,
      addSyncedLog,
      captureNow,
      captureStart,
      captureEnd,
      captureOffset,
      logs,
      removeSyncedLog,
      removeHabitLog,
      afterSave,
      onRequestEdit,
    ],
  );

  // ─── handleQuickCaptureTap ────────────────────────────────────────────────

  const handleQuickCaptureTap = useCallback(
    async (habit: HabitConfig): Promise<void> => {
      if (isCheckboxHabit(habit)) {
        try {
          await handleCheckboxToggle(habit);
        } catch (error) {
          console.error("Checkbox toggle failed:", error);
          toast.error(`Failed to update ${habit.name}.`);
        }
        return;
      }

      const timestamp = captureNow();

      // Cap habits use 1 for fluid logAs; everything else uses quickIncrement
      const habitLogValue =
        habit.logAs === "fluid" && isCapHabit(habit) ? 1 : habit.quickIncrement;

      // 1. Persist HabitLog event to the Zustand habit log store
      addHabitLog({
        id: crypto.randomUUID(),
        habitId: habit.id,
        value: habitLogValue,
        source: "quick",
        at: timestamp,
      });

      let syncedLogId: string | undefined;
      try {
        if (habit.logAs === "fluid") {
          syncedLogId = await handleLogFluid(
            habit.name,
            habit.quickIncrement,
            timestamp,
            true,
          );
        } else {
          syncedLogId = await handleIncrementHabit(
            habit,
            todayHabitCounts[habit.id] ?? 0,
            timestamp,
          );
        }
      } catch (syncError) {
        console.error("Failed to save habit tap:", syncError);
        toast.error(`Failed to save ${habit.name}. Please try again.`);
      }
      if (isTargetHabit(habit) && habit.dailyTarget) {
        const fluidKey = normalizeFluidItemName(habit.name);
        const newFluidMl =
          habit.logAs === "fluid"
            ? (todayFluidTotalsByName[fluidKey] ?? 0) + habit.quickIncrement
            : 0;
        const newCount =
          (todayHabitCounts[habit.id] ?? 0) + (habit.logAs === "fluid" ? 0 : 1);
        const checkValue =
          habit.logAs === "fluid"
            ? newFluidMl
            : newCount * habit.quickIncrement;
        const prevValue =
          habit.logAs === "fluid"
            ? (todayFluidTotalsByName[fluidKey] ?? 0)
            : (todayHabitCounts[habit.id] ?? 0) * habit.quickIncrement;

        checkAndCelebrateGoal(habit, prevValue, checkValue);
      }

      if (isCapHabit(habit) && habit.dailyCap) {
        const currentCount =
          habit.logAs === "fluid"
            ? (todayHabitCounts[habit.id] ?? 0) + 1
            : (todayHabitCounts[habit.id] ?? 0) + habitLogValue;
        if (currentCount > habit.dailyCap) {
          toast.warning(
            `${currentCount - habit.dailyCap} over your ${habit.name} cap. Tomorrow's a new day.`,
          );
        }
      }
      if (syncedLogId) {
        const undoLabel =
          habit.logAs === "fluid"
            ? `+${formatFluidDisplay(habit.quickIncrement, unitSystem)} ${habit.name}`
            : `+${habit.quickIncrement} ${habit.name}`;
        const capturedId = syncedLogId;
        toast(undoLabel, {
          action: {
            label: "Undo",
            onClick: () => {
              void removeSyncedLog(capturedId);
              removeHabitLog(habit.id, timestamp);
            },
          },
          cancel: {
            label: "Edit",
            onClick: () => onRequestEdit(capturedId, captureOffset),
          },
          duration: 4000,
        });
      }
    },
    [
      addHabitLog,
      captureNow,
      captureOffset,
      handleCheckboxToggle,
      handleLogFluid,
      handleIncrementHabit,
      todayHabitCounts,
      todayFluidTotalsByName,
      checkAndCelebrateGoal,
      removeHabitLog,
      removeSyncedLog,
      onRequestEdit,
      unitSystem,
    ],
  );

  return {
    handleQuickCaptureTap,
    handleLogSleepQuickCapture,
    handleLogActivityQuickCapture,
    handleLogFluid,
    handleIncrementHabit,
    handleLogWeightKg,
  };
}
