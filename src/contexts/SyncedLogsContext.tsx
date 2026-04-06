import { createContext, type ReactNode, useContext, useEffect, useMemo } from "react";
import { useHabits } from "@/hooks/useProfile";
import { rebuildHabitLogsFromSyncedLogs } from "@/lib/derivedHabitLogs";
import { type SyncedLog, useSyncedLogsByRange } from "@/lib/sync";
import { useStore } from "@/store";

const SyncedLogsContext = createContext<SyncedLog[] | null>(null);

/** Day-granularity key so the date boundaries stay stable within a single calendar day. */
function todayDayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
}

export function SyncedLogsProvider({ children }: { children: ReactNode }) {
  const dayKey = todayDayKey();

  const now = useMemo(() => {
    const [year, month, day] = dayKey.split("-").map(Number);
    return new Date(year, month, day);
  }, [dayKey]);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const fourteenDaysAgo = new Date(startOfToday);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);
  const fourteenDaysAgoMs = fourteenDaysAgo.getTime();
  // End of today = start of tomorrow (exclusive upper bound)
  const endOfTodayMs = endOfToday.getTime();

  const logs = useSyncedLogsByRange(fourteenDaysAgoMs, endOfTodayMs);
  const { habits } = useHabits();
  const habitLogs = useStore((state) => state.habitLogs);
  const setHabitLogs = useStore((state) => state.setHabitLogs);

  const derivedHabitLogs = useMemo(
    () => rebuildHabitLogsFromSyncedLogs(logs, habits),
    [logs, habits],
  );

  useEffect(() => {
    const isSame =
      habitLogs.length === derivedHabitLogs.length &&
      habitLogs.every((entry, index) => {
        const other = derivedHabitLogs[index];
        return (
          other !== undefined &&
          entry.habitId === other.habitId &&
          entry.at === other.at &&
          Math.abs(entry.value - other.value) < 0.001
        );
      });
    if (!isSame) {
      setHabitLogs(derivedHabitLogs);
    }
  }, [derivedHabitLogs, habitLogs, setHabitLogs]);

  return <SyncedLogsContext.Provider value={logs}>{children}</SyncedLogsContext.Provider>;
}

export function useSyncedLogsContext(): SyncedLog[] {
  const ctx = useContext(SyncedLogsContext);
  if (ctx === null) {
    throw new Error("useSyncedLogsContext must be used within SyncedLogsProvider");
  }
  return ctx;
}
