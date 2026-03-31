import { useMemo } from "react";
import type { SyncedLog } from "@/lib/sync";
import { Sparkline } from "./Sparkline";
import { getDateKey } from "./utils";

type DigestionLog = Extract<SyncedLog, { type: "digestion" }>;

// ── Types ────────────────────────────────────────────────────────────────────

interface BristolTrendTileProps {
  digestionLogs: DigestionLog[];
}

interface DailyAverage {
  /** Date key in YYYY-MM-DD format */
  dateKey: string;
  /** Average Bristol score for the day */
  average: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

const SPARKLINE_DAYS = 14;
const AVERAGE_DAYS = 7;
/** "Good" range thresholds */
const GOOD_LOW = 3;
const GOOD_HIGH = 5;
const BORDERLINE_LOW = 2.5;
const BORDERLINE_HIGH = 5.5;
/** Normal range midpoint — movement toward 4.0 is improvement, away is concern. */
const NORMAL_MIDPOINT = 4.0;

const MS_PER_DAY = 86_400_000;

// ── Helpers ──────────────────────────────────────────────────────────────────

function getScoreColor(score: number): string {
  if (score >= GOOD_LOW && score <= GOOD_HIGH) {
    return "text-emerald-400";
  }
  if (
    (score >= BORDERLINE_LOW && score < GOOD_LOW) ||
    (score > GOOD_HIGH && score <= BORDERLINE_HIGH)
  ) {
    return "text-orange-300";
  }
  return "text-rose-400";
}

function getDeltaDisplay(
  delta: number,
  currentAverage: number,
): {
  arrow: string;
  text: string;
  className: string;
} {
  if (delta === 0) {
    return { arrow: "", text: "0.0", className: "text-[var(--text-faint)]" };
  }

  const previousAverage = currentAverage - delta;
  const previousDistance = Math.abs(previousAverage - NORMAL_MIDPOINT);
  const currentDistance = Math.abs(currentAverage - NORMAL_MIDPOINT);
  const isImproving = currentDistance < previousDistance;

  const sign = delta > 0 ? "+" : "";
  return {
    arrow: delta > 0 ? "\u25B2" : "\u25BC",
    text: `${sign}${delta.toFixed(1)}`,
    className: isImproving ? "text-emerald-400" : "text-rose-300",
  };
}

/**
 * Compute daily averages for digestion logs over the last N days.
 * Returns an array of length up to `days`, one entry per calendar day
 * that has at least one digestion log. Days with no logs are omitted.
 */
function computeDailyAverages(
  digestionLogs: Array<{ timestamp: number; bristolCode: number }>,
  days: number,
): DailyAverage[] {
  const now = Date.now();
  const cutoff = now - days * MS_PER_DAY;

  // Group scores by date key
  const byDate = new Map<string, number[]>();
  for (const log of digestionLogs) {
    if (log.timestamp < cutoff) continue;
    const key = getDateKey(log.timestamp);
    const existing = byDate.get(key);
    if (existing) {
      existing.push(log.bristolCode);
    } else {
      byDate.set(key, [log.bristolCode]);
    }
  }

  // Build sorted array of daily averages
  const result: DailyAverage[] = [];
  for (const [dateKey, scores] of byDate) {
    const sum = scores.reduce((a, b) => a + b, 0);
    result.push({ dateKey, average: sum / scores.length });
  }
  result.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  return result;
}

// ── Component ────────────────────────────────────────────────────────────────

export function BristolTrendTile({ digestionLogs }: BristolTrendTileProps) {
  const digestionData = useMemo(() => {
    const result: Array<{ timestamp: number; bristolCode: number }> = [];
    for (const log of digestionLogs) {
      if (typeof log.data.bristolCode === "number") {
        result.push({
          timestamp: log.timestamp,
          bristolCode: log.data.bristolCode,
        });
      }
    }
    return result;
  }, [digestionLogs]);

  // Compute 14-day sparkline data
  const sparklineData = useMemo(
    () => computeDailyAverages(digestionData, SPARKLINE_DAYS),
    [digestionData],
  );

  // Map to the format expected by the Sparkline component
  const sparklinePoints = useMemo(
    () => sparklineData.map((d) => ({ dateKey: d.dateKey, value: d.average })),
    [sparklineData],
  );

  // Compute 7-day average (current week) and previous 7-day average (prior week)
  const { currentAverage, previousAverage } = useMemo(() => {
    const now = Date.now();
    const oneWeekAgo = now - AVERAGE_DAYS * MS_PER_DAY;
    const twoWeeksAgo = now - AVERAGE_DAYS * 2 * MS_PER_DAY;

    let currentSum = 0;
    let currentCount = 0;
    let previousSum = 0;
    let previousCount = 0;

    for (const log of digestionData) {
      if (log.timestamp >= oneWeekAgo) {
        currentSum += log.bristolCode;
        currentCount++;
      } else if (log.timestamp >= twoWeeksAgo) {
        previousSum += log.bristolCode;
        previousCount++;
      }
    }

    return {
      currentAverage: currentCount > 0 ? currentSum / currentCount : null,
      previousAverage: previousCount > 0 ? previousSum / previousCount : null,
    };
  }, [digestionData]);

  // Compute week-over-week delta
  const delta =
    currentAverage !== null && previousAverage !== null ? currentAverage - previousAverage : null;

  const hasData = currentAverage !== null;
  const deltaDisplay =
    delta !== null && currentAverage !== null ? getDeltaDisplay(delta, currentAverage) : null;

  return (
    <div data-slot="bristol-trend-tile" className="flex flex-col gap-2">
      <div className="px-1 text-[11px] font-medium uppercase tracking-[0.24em] text-[var(--text-faint)]">
        Bristol Trend
      </div>

      <div className="relative rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/95 p-4 pt-16">
        {hasData ? (
          <>
            <div className="absolute right-4 top-4 text-right">
              <div className={`text-3xl font-bold ${getScoreColor(currentAverage)}`}>
                {currentAverage.toFixed(1)}
              </div>

              {deltaDisplay !== null && (
                <div className={`text-[11px] font-medium ${deltaDisplay.className}`}>
                  {deltaDisplay.arrow} {deltaDisplay.text}
                </div>
              )}
            </div>

            {sparklineData.length >= 2 && (
              <Sparkline
                data={sparklinePoints}
                color="var(--section-summary)"
                height={120}
                unit="avg"
              />
            )}
          </>
        ) : (
          <p className="text-sm text-[var(--text-faint)]">No digestion data yet</p>
        )}
      </div>
    </div>
  );
}
