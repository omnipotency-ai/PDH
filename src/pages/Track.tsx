import { addDays, differenceInCalendarDays, format, startOfDay } from "date-fns";
import { CalendarDays } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { TodayLog } from "@/components/track/today-log";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useSyncedLogsContext } from "@/contexts/SyncedLogsContext";
import { useLiveClock } from "@/hooks/useLiveClock";
import { useHabits, useUnitSystem } from "@/hooks/useProfile";
import { normalizeActivityTypeKey } from "@/lib/activityTypeUtils";
import { getErrorMessage } from "@/lib/errors";
import type { HabitConfig } from "@/lib/habitTemplates";
import { isSleepHabit } from "@/lib/habitTemplates";
import { normalizeFluidItemName } from "@/lib/normalizeFluidName";
import { useRemoveSyncedLog, useUpdateSyncedLog } from "@/lib/sync";
import { getDisplayWeightUnit } from "@/lib/units";
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
// Date picker
// ---------------------------------------------------------------------------

function TrackDatePicker({
  selectedDate,
  todayDate,
  onSelect,
}: {
  selectedDate: Date;
  todayDate: Date;
  onSelect: (date: Date) => void;
}) {
  const [open, setOpen] = useState(false);
  const label =
    differenceInCalendarDays(selectedDate, todayDate) === 0
      ? "Today"
      : format(selectedDate, "EEE, MMM d");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-9 gap-2 rounded-full border-teal-500/20 bg-white/60 px-4 text-xs font-semibold text-teal-700 hover:bg-teal-50 dark:border-teal-400/20 dark:bg-slate-900/40 dark:text-teal-300 dark:hover:bg-slate-900"
        >
          <CalendarDays className="h-4 w-4" aria-hidden="true" />
          <span>{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => {
            if (!date) return;
            onSelect(date);
            setOpen(false);
          }}
          disabled={(date) => startOfDay(date) > todayDate}
          defaultMonth={selectedDate}
        />
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Helpers (shared with save handler)
// ---------------------------------------------------------------------------

function getHabitsForActivityType(habits: HabitConfig[], activityType: string): HabitConfig[] {
  if (activityType === "sleep") {
    return habits.filter((habit) => isSleepHabit(habit));
  }
  return habits.filter((habit) => normalizeActivityTypeKey(habit.name) === activityType);
}

function getActivityHabitLogValue(habit: HabitConfig, durationMinutes: number): number {
  return habit.unit === "hours" ? Math.round((durationMinutes / 60) * 100) / 100 : durationMinutes;
}

// ---------------------------------------------------------------------------
// Track page — log viewer + CRUD
// ---------------------------------------------------------------------------

export default function TrackPage() {
  const { logs } = useSyncedLogsContext();
  const removeSyncedLog = useRemoveSyncedLog();
  const updateSyncedLog = useUpdateSyncedLog();

  const { habits } = useHabits();
  const addHabitLog = useStore((state) => state.addHabitLog);
  const removeHabitLog = useStore((state) => state.removeHabitLog);
  const { unitSystem } = useUnitSystem();
  const weightUnit = getDisplayWeightUnit(unitSystem);

  // Pending edit from cross-page navigation (Home → Track)
  const pendingEditLogId = useStore((s) => s.pendingEditLogId);
  const setPendingEditLogId = useStore((s) => s.setPendingEditLogId);

  useLiveClock();
  const now = new Date();
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));

  const todayDate = useMemo(() => startOfDay(now), [now]);
  const dayOffset = useMemo(
    () => differenceInCalendarDays(selectedDate, todayDate),
    [selectedDate, todayDate],
  );
  const selectedStart = selectedDate.getTime();
  const selectedEnd = addDays(selectedDate, 1).getTime();

  const selectedLogs = useMemo(
    () => logs.filter((log) => log.timestamp >= selectedStart && log.timestamp < selectedEnd),
    [logs, selectedStart, selectedEnd],
  );

  // --- Auto-edit state ---
  const [autoEditLogId, setAutoEditLogId] = useState<string | null>(null);

  // Consume pending edit from Zustand store (cross-page navigation from Home)
  useEffect(() => {
    if (pendingEditLogId === null) return;
    const matchingLog = logs.find((entry) => entry.id === pendingEditLogId);
    if (matchingLog) {
      setSelectedDate(startOfDay(new Date(matchingLog.timestamp)));
    }
    setAutoEditLogId(pendingEditLogId);
    setPendingEditLogId(null);
  }, [pendingEditLogId, logs, setPendingEditLogId]);

  const handleAutoEditHandled = useCallback(() => {
    setAutoEditLogId(null);
  }, []);

  // --- Date navigation ---
  const handlePreviousDay = useCallback(
    () => setSelectedDate((value) => startOfDay(addDays(value, -1))),
    [],
  );
  const handleNextDay = useCallback(
    () =>
      setSelectedDate((value) => {
        const next = startOfDay(addDays(value, 1));
        return next.getTime() > todayDate.getTime() ? todayDate : next;
      }),
    [todayDate],
  );
  const handleJumpToToday = useCallback(() => setSelectedDate(todayDate), [todayDate]);
  const handleSelectDate = useCallback(
    (date: Date) => {
      const normalized = startOfDay(date);
      setSelectedDate(normalized.getTime() > todayDate.getTime() ? todayDate : normalized);
    },
    [todayDate],
  );

  // --- Log CRUD ---

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
                (h) => h.logAs === "fluid" && normalizeFluidItemName(h.name) === normalizedName,
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

  const handleSave = async (id: string, data: LogPayloadData, timestamp?: number) => {
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
        const previousItems = Array.isArray(log.data?.items) ? log.data.items : [];
        for (const item of previousItems) {
          const normalizedName = normalizeFluidItemName(item?.name);
          const matchingHabit = habits.find(
            (habit) =>
              habit.logAs === "fluid" && normalizeFluidItemName(habit.name) === normalizedName,
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
              habit.logAs === "fluid" && normalizeFluidItemName(habit.name) === normalizedName,
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
        const previousHabitId = typeof log.data?.habitId === "string" ? log.data.habitId : null;
        if (previousHabitId) {
          removeHabitLog(previousHabitId, log.timestamp);
        }

        const nextHabitId =
          typeof nextHabitData.habitId === "string" ? nextHabitData.habitId : null;
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
        const previousActivityType = normalizeActivityTypeKey(String(log.data?.activityType ?? ""));
        for (const habit of getHabitsForActivityType(habits, previousActivityType)) {
          removeHabitLog(habit.id, log.timestamp);
        }

        const nextActivityType = normalizeActivityTypeKey(
          String(nextActivityData.activityType ?? ""),
        );
        const nextDurationMinutes = Number(nextActivityData.durationMinutes ?? 0);
        if (Number.isFinite(nextDurationMinutes) && nextDurationMinutes > 0) {
          for (const habit of getHabitsForActivityType(habits, nextActivityType)) {
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

  return (
    <div className="pb-8">
      <header className="mb-3">
        <div className="flex flex-wrap items-baseline gap-4">
          <h1 className="font-display text-2xl font-bold tracking-tight text-teal-600 dark:text-teal-400 md:text-3xl shrink-0">
            Track
          </h1>
          <p className="font-monaco text-xs uppercase tracking-[0.2em] text-teal-600 dark:text-teal-400 shrink-0">
            {format(now, "E · d MMMM · HH:mm")}
          </p>
          <TrackDatePicker
            selectedDate={selectedDate}
            todayDate={todayDate}
            onSelect={handleSelectDate}
          />
        </div>
      </header>

      <TodayLog
        logs={selectedLogs}
        habits={habits}
        weightUnit={weightUnit}
        constrainHeight={false}
        selectedDate={selectedDate}
        dayOffset={dayOffset}
        onPreviousDay={handlePreviousDay}
        onNextDay={handleNextDay}
        onJumpToToday={handleJumpToToday}
        onDelete={handleDelete}
        onSave={handleSave}
        autoEditId={autoEditLogId}
        onAutoEditHandled={handleAutoEditHandled}
      />
    </div>
  );
}
