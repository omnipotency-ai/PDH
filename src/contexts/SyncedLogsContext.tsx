import { useQuery } from "convex/react";
import { createContext, type ReactNode, useContext, useEffect, useMemo } from "react";
import { useHabits } from "@/hooks/useProfile";
import { rebuildHabitLogsFromSyncedLogs } from "@/lib/derivedHabitLogs";
import { type SyncedLog, toSyncedLogs } from "@/lib/sync";
import { useStore } from "@/store";
import { api } from "../../convex/_generated/api";

export interface SyncedLogsContextValue {
  logs: SyncedLog[];
  isLoading: boolean;
}

const SyncedLogsContext = createContext<SyncedLogsContextValue | null>(null);

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

  const rawLogs = useQuery(api.logs.listByRange, {
    startMs: fourteenDaysAgoMs,
    endMs: endOfTodayMs,
    limit: 5000,
  });
  const isLoading = rawLogs === undefined;
  const logs = useMemo(() => toSyncedLogs(rawLogs), [rawLogs]);
  const { habits } = useHabits();
  const habitLogs = useStore((state) => state.habitLogs);
  const setHabitLogs = useStore((state) => state.setHabitLogs);

  const derivedHabitLogs = useMemo(
    () => rebuildHabitLogsFromSyncedLogs(logs, habits),
    [logs, habits],
  );
  const value = useMemo(() => ({ logs, isLoading }), [logs, isLoading]);

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

  return <SyncedLogsContext.Provider value={value}>{children}</SyncedLogsContext.Provider>;
}

export function useSyncedLogsContext(): SyncedLogsContextValue {
  const ctx = useContext(SyncedLogsContext);
  if (ctx === null) {
    throw new Error("useSyncedLogsContext must be used within SyncedLogsProvider");
  }
  return ctx;
}
