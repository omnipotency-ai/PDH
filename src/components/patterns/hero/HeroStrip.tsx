import { useMemo } from "react";
import { useSyncedLogsContext } from "@/contexts/SyncedLogsContext";
import { useCurrentMinute } from "@/hooks/useCurrentMinute";
import type { SyncedLog } from "@/lib/sync";
import { BmFrequencyTile } from "./BmFrequencyTile";
import { BristolTrendTile } from "./BristolTrendTile";

type DigestionLog = Extract<SyncedLog, { type: "digestion" }>;

// ── Component ────────────────────────────────────────────────────────────────

export function HeroStrip() {
  const { logs } = useSyncedLogsContext();
  const nowMs = useCurrentMinute();
  const digestionLogs = useMemo(
    () => logs.filter((log): log is DigestionLog => log.type === "digestion"),
    [logs],
  );

  return (
    <div data-slot="hero-strip" className="flex flex-col gap-3">
      {/* Metric tiles grid */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
        <BristolTrendTile digestionLogs={digestionLogs} nowMs={nowMs} />
        <BmFrequencyTile digestionLogs={digestionLogs} nowMs={nowMs} />
      </div>
    </div>
  );
}
