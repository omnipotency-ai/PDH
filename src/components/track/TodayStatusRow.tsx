import { Clock3 } from "lucide-react";
import { useUnitSystem } from "@/hooks/useProfile";
import { formatFluidDisplay } from "@/lib/units";

interface TodayStatusRowProps {
  bmCount: number;
  fluidTotalMl: number;
  lastBmTimestamp: number | null;
  nowMs: number;
}

const BM_TIMER_THRESHOLDS = {
  RECENT_MINUTES: 55,
  MODERATE_HOURS: 8,
  LONG_HOURS: 24,
} as const;

function getLastBmTextColor(lastBmTimestamp: number | null, nowMs: number): string {
  if (lastBmTimestamp === null) return "var(--text-muted)";
  const elapsedMs = Math.max(0, nowMs - lastBmTimestamp);
  const totalMinutes = Math.floor(elapsedMs / 60_000);
  if (totalMinutes < BM_TIMER_THRESHOLDS.RECENT_MINUTES) return "var(--sky)";
  if (totalMinutes < BM_TIMER_THRESHOLDS.MODERATE_HOURS * 60) return "var(--emerald)";
  if (totalMinutes < BM_TIMER_THRESHOLDS.LONG_HOURS * 60) return "var(--orange)";
  return "var(--red)";
}

function formatTimeSince(lastBmTimestamp: number | null, nowMs: number): string {
  if (lastBmTimestamp === null) return "No BM logged yet";
  const elapsedMs = Math.max(0, nowMs - lastBmTimestamp);
  const totalMinutes = Math.floor(elapsedMs / 60_000);
  if (totalMinutes < 60) return `${totalMinutes}m ago`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 24) return minutes === 0 ? `${hours}h ago` : `${hours}h ${minutes}m ago`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours === 0 ? `${days}d ago` : `${days}d ${remHours}h ago`;
}

export function TodayStatusRow({
  bmCount,
  fluidTotalMl,
  lastBmTimestamp,
  nowMs,
}: TodayStatusRowProps) {
  const { unitSystem } = useUnitSystem();
  const lastBmTextColor = getLastBmTextColor(lastBmTimestamp, nowMs);

  return (
    <div
      data-slot="today-status-row"
      className="flex w-full flex-wrap items-center justify-center gap-2"
    >
      <span
        className="inline-flex items-center rounded-full px-3 py-1 text-center text-xs font-medium"
        style={{
          background: "transparent",
          color: "var(--section-bowel)",
          border: "none",
        }}
      >
        BMs: {bmCount} today
      </span>
      <span
        className="inline-flex items-center rounded-full px-3 py-1 text-center text-xs font-medium"
        style={{
          background: "transparent",
          color: "var(--section-fluid)",
          border: "none",
        }}
      >
        Fluids: {formatFluidDisplay(fluidTotalMl, unitSystem)}
      </span>
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-center text-xs font-medium"
        style={{
          background: "transparent",
          color: lastBmTextColor,
          border: "none",
        }}
      >
        <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
        Last BM: {formatTimeSince(lastBmTimestamp, nowMs)}
      </span>
    </div>
  );
}
