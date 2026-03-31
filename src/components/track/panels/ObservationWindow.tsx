import { Eye, Timer, Truck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTransitCalibration } from "@/hooks/useProfile";
import type { SyncedLog } from "@/lib/sync";
import { MS_PER_MINUTE } from "@/lib/timeConstants";
import { isFoodLog } from "@/store";

interface ObservationWindowProps {
  logs: SyncedLog[];
}

/** Minimum transit floor in minutes (same as foodEvidence.ts). */
const MIN_TRANSIT_MINUTES = 55;

interface PendingFood {
  name: string;
  timestamp: number;
  elapsedMs: number;
  inTransit: boolean;
  /** Progress through the testing window (transit end → observation end), 0–100 */
  progressPercent: number;
}

function formatElapsed(ms: number): string {
  const totalMinutes = Math.round(ms / MS_PER_MINUTE);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m ago`;
  if (m === 0) return `${h}h ago`;
  return `${h}h ${m}m ago`;
}

function formatRemaining(ms: number): string {
  const remaining = Math.max(0, ms);
  const totalMinutes = Math.ceil(remaining / MS_PER_MINUTE);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function getProgressColor(percent: number): string {
  if (percent < 50) return "var(--teal)";
  if (percent < 75) return "var(--amber)";
  return "var(--emerald)";
}

export function ObservationWindow({ logs }: ObservationWindowProps) {
  const [now, setNow] = useState(() => Date.now());
  const { transitCalibration } = useTransitCalibration();

  // Derive transit and observation window from learned calibration
  const transitStartMinutes = Math.max(
    MIN_TRANSIT_MINUTES,
    transitCalibration.centerMinutes - transitCalibration.spreadMinutes,
  );
  const observationEndMinutes = transitCalibration.centerMinutes + transitCalibration.spreadMinutes;
  const transitMs = transitStartMinutes * MS_PER_MINUTE;
  const observationMs = observationEndMinutes * MS_PER_MINUTE;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const pendingFoods = useMemo(() => {
    const cutoff = now - observationMs;
    const foods: PendingFood[] = [];
    const seen = new Set<string>();

    const foodLogs = logs
      .filter(isFoodLog)
      .filter((log) => log.timestamp >= cutoff)
      .sort((a, b) => b.timestamp - a.timestamp);

    // All bowel events within the observation window
    const bowelEvents = logs
      .filter((log) => log.type === "digestion" && log.timestamp >= cutoff)
      .map((log) => log.timestamp);

    for (const log of foodLogs) {
      const items = log.data.items;
      for (const item of items) {
        if (item == null) continue;
        const name = String(item.parsedName ?? item.name ?? "").trim();
        if (!name || seen.has(name.toLowerCase())) continue;
        seen.add(name.toLowerCase());

        const elapsedMs = now - log.timestamp;
        const inTransit = elapsedMs < transitMs;

        // Only count bowel events that happened AFTER the transit window
        const transitEnd = log.timestamp + transitMs;
        const hasBowelInTestingWindow = bowelEvents.some((ts) => ts >= transitEnd);
        if (hasBowelInTestingWindow) continue;

        // Progress through the testing window (transit end → observation end)
        const testingElapsed = Math.max(0, elapsedMs - transitMs);
        const testingWindow = observationMs - transitMs;
        const progress = inTransit ? 0 : Math.min((testingElapsed / testingWindow) * 100, 100);

        foods.push({
          name,
          timestamp: log.timestamp,
          elapsedMs,
          inTransit,
          progressPercent: progress,
        });
      }
    }

    return foods;
  }, [logs, now, observationMs, transitMs]);

  if (pendingFoods.length === 0) {
    return (
      <section className="glass-card glass-card-observe p-4">
        <SectionHeader
          icon={Eye}
          title="Observation Window"
          color="var(--section-observe)"
          mutedColor="var(--section-observe-muted)"
        />
        <p className="text-xs text-[var(--text-faint)]">
          No foods currently being watched. Eat something to start tracking.
        </p>
      </section>
    );
  }

  const sourceLabel = transitCalibration.source === "learned" ? "learned" : "default";

  return (
    <section className="glass-card glass-card-observe p-4 space-y-3">
      <SectionHeader
        icon={Eye}
        title="Observation Window"
        color="var(--section-observe)"
        mutedColor="var(--section-observe-muted)"
      >
        <span className="ml-auto text-[10px] font-mono text-[var(--text-faint)]">
          {formatDuration(transitStartMinutes)} transit · {formatDuration(observationEndMinutes)}{" "}
          window ({sourceLabel})
        </span>
      </SectionHeader>

      <p className="text-[11px] text-[var(--text-faint)]">
        Log your next bowel movement to record outcomes for these foods
      </p>

      <div className="space-y-2">
        {pendingFoods.map((food) => (
          <div
            key={`${food.name}-${food.timestamp}`}
            className="flex items-center gap-2.5 bg-[var(--section-observe-muted)] border border-[var(--section-observe-border)] rounded-lg p-3"
          >
            {food.inTransit ? (
              <Truck className="h-3.5 w-3.5 flex-shrink-0 text-[var(--text-faint)]" />
            ) : (
              <Timer
                className="h-3.5 w-3.5 flex-shrink-0"
                style={{ color: getProgressColor(food.progressPercent) }}
              />
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex-1 truncate text-sm font-semibold text-[var(--text)]">
                  {food.name}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">{food.name}</TooltipContent>
            </Tooltip>
            {food.inTransit ? (
              <span className="text-[10px] font-mono tabular-nums text-[var(--text-faint)]">
                in transit · {formatRemaining(transitMs - food.elapsedMs)} left
              </span>
            ) : (
              <span className="text-xs font-mono tabular-nums text-[var(--text-faint)]">
                {formatElapsed(food.elapsedMs)}
              </span>
            )}
            <div className="w-14 h-1.5 rounded-full bg-[var(--section-observe-muted)] overflow-hidden flex-shrink-0">
              {food.inTransit ? (
                <div
                  className="h-full rounded-full bg-[var(--text-faint)] opacity-30 animate-pulse"
                  style={{
                    width: `${Math.min((food.elapsedMs / transitMs) * 100, 100)}%`,
                  }}
                />
              ) : (
                <div
                  className="h-full rounded-full transition-all duration-1000 ease-out"
                  style={{
                    width: `${food.progressPercent}%`,
                    backgroundColor: getProgressColor(food.progressPercent),
                    ...(food.progressPercent > 85
                      ? { boxShadow: "0 0 8px var(--section-observe-glow)" }
                      : {}),
                  }}
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
