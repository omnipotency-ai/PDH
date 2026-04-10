import { Clock3 } from "lucide-react";
import { useUnitSystem } from "@/hooks/useProfile";
import { formatFluidDisplay } from "@/lib/units";

interface TodayStatusRowProps {
  bmCount: number;
  fluidTotalMl: number;
  waterOnlyMl: number;
  lastBmTimestamp: number | null;
  nowMs: number;
}

const BM_TIMER_THRESHOLDS = {
  RECENT_MINUTES: 55,
  MODERATE_HOURS: 8,
  LONG_HOURS: 24,
} as const;

function getLastBmTextColor(
  lastBmTimestamp: number | null,
  nowMs: number,
): string {
  if (lastBmTimestamp === null) return "var(--text-muted)";
  const elapsedMs = Math.max(0, nowMs - lastBmTimestamp);
  const totalMinutes = Math.floor(elapsedMs / 60_000);
  if (totalMinutes < BM_TIMER_THRESHOLDS.RECENT_MINUTES) return "var(--sky)";
  if (totalMinutes < BM_TIMER_THRESHOLDS.MODERATE_HOURS * 60)
    return "var(--emerald)";
  if (totalMinutes < BM_TIMER_THRESHOLDS.LONG_HOURS * 60)
    return "var(--orange)";
  return "var(--red)";
}

function formatLastBmTime(lastBmTimestamp: number | null): string {
  if (lastBmTimestamp === null) return "No BM logged";
  const d = new Date(lastBmTimestamp);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const period = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;
  return `at ${h12}:${m} ${period}`;
}

export function TodayStatusRow({
  bmCount,
  fluidTotalMl,
  waterOnlyMl,
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
        BMs: {bmCount}
      </span>
      <span
        className="inline-flex items-center rounded-full px-3 py-1 text-center text-xs font-medium"
        style={{
          background: "transparent",
          color: "var(--section-fluid)",
          border: "none",
        }}
      >
        Fluids: {formatFluidDisplay(fluidTotalMl, unitSystem)}{" "}
        <span style={{ color: "var(--water)" }}>
          (water: {formatFluidDisplay(waterOnlyMl, unitSystem)})
        </span>
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
        Last BM {formatLastBmTime(lastBmTimestamp)}
      </span>
    </div>
  );
}
