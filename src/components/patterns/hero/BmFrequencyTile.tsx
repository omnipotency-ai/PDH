import { useMemo } from "react";
import { normalizeEpisodesCount } from "@/lib/analysis";
import type { SyncedLog } from "@/lib/sync";
import { Sparkline } from "./Sparkline";
import { getDateKey } from "./utils";

type DigestionLog = Extract<SyncedLog, { type: "digestion" }>;

// ── Types ────────────────────────────────────────────────────────────────────

interface BmFrequencyTileProps {
  digestionLogs: DigestionLog[];
}

interface DailyCount {
  /** Date key in YYYY-MM-DD format */
  dateKey: string;
  /** Number of BMs that day */
  count: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

const SPARKLINE_DAYS = 7;

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Compute daily BM counts for each of the last `days` calendar days.
 * Always returns exactly `days` entries (in chronological order),
 * filling in 0 for days with no digestion logs.
 *
 * Uses calendar midnight boundaries so that the cutoff aligns with day buckets.
 */
function computeDailyCounts(
  digestionLogs: Array<{ timestamp: number; episodesCount: number }>,
  days: number,
): DailyCount[] {
  const now = new Date();
  // Build a map of all day keys we care about, initialized to 0
  const dateKeys: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    dateKeys.push(getDateKey(d.getTime()));
  }

  const countByDate = new Map<string, number>();
  for (const key of dateKeys) {
    countByDate.set(key, 0);
  }

  // Compute cutoff from calendar midnight boundary instead of raw ms offset
  const cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
  const cutoff = cutoffDate.getTime();

  // Tally digestion logs into buckets
  for (const log of digestionLogs) {
    if (log.timestamp < cutoff) continue;
    const key = getDateKey(log.timestamp);
    const existing = countByDate.get(key);
    if (existing !== undefined) {
      countByDate.set(key, existing + log.episodesCount);
    }
  }

  return dateKeys.map((dateKey) => ({
    dateKey,
    count: countByDate.get(dateKey) ?? 0,
  }));
}

// ── Component ────────────────────────────────────────────────────────────────

export function BmFrequencyTile({ digestionLogs }: BmFrequencyTileProps) {
  const digestionCounts = useMemo(() => {
    const result: Array<{ timestamp: number; episodesCount: number }> = [];
    for (const log of digestionLogs) {
      result.push({
        timestamp: log.timestamp,
        episodesCount: normalizeEpisodesCount(log.data?.episodesCount),
      });
    }
    return result;
  }, [digestionLogs]);

  // Compute 7-day daily counts (always 7 entries, one per day)
  const dailyCounts = useMemo(
    () => computeDailyCounts(digestionCounts, SPARKLINE_DAYS),
    [digestionCounts],
  );

  // Map to the format expected by the Sparkline component
  const sparklinePoints = useMemo(
    () => dailyCounts.map((d) => ({ dateKey: d.dateKey, value: d.count })),
    [dailyCounts],
  );

  const todayCount = dailyCounts.at(-1)?.count ?? 0;

  const hasData = digestionCounts.length > 0;

  return (
    <div data-slot="bm-frequency-tile" className="flex flex-col gap-2">
      <div className="px-1 text-[11px] font-medium uppercase tracking-[0.24em] text-[var(--text-faint)]">
        BM Count
      </div>

      <div className="relative rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/95 p-4 pt-16">
        {hasData ? (
          <>
            <div className="absolute right-4 top-4 text-right">
              <div className="text-3xl font-bold text-rose-400">{todayCount}</div>
              <div className="text-[10px] uppercase tracking-[0.24em] text-[var(--text-faint)]">
                today
              </div>
            </div>

            {dailyCounts.length >= 2 && (
              <Sparkline
                data={sparklinePoints}
                color="var(--section-summary)"
                height={120}
                unit="BMs"
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
