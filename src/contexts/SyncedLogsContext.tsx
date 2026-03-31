import { createContext, type ReactNode, useContext, useEffect, useMemo } from "react";
import { useHabits } from "@/hooks/useProfile";
import { rebuildHabitLogsFromSyncedLogs } from "@/lib/derivedHabitLogs";
import { type SyncedLog, useAllSyncedLogs } from "@/lib/sync";
import { useStore } from "@/store";

const SyncedLogsContext = createContext<SyncedLog[] | null>(null);

export function SyncedLogsProvider({ children }: { children: ReactNode }) {
  const logs = useAllSyncedLogs();
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
