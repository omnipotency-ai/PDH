import { useMemo } from "react";
import { normalizeEpisodesCount } from "@/lib/analysis";
import type { SyncedLog } from "@/lib/sync";
import { Sparkline } from "./Sparkline";
import { getCutoffTimestamp, getDateKey, getRecentDateKeys } from "./utils";

type DigestionLog = Extract<SyncedLog, { type: "digestion" }>;

// ── Types ────────────────────────────────────────────────────────────────────

interface BmFrequencyTileProps {
  digestionLogs: DigestionLog[];
  nowMs: number;
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
export function computeDailyCounts(
  digestionLogs: Array<{ timestamp: number; episodesCount: number }>,
  days: number,
  nowMs: number,
): DailyCount[] {
  const dateKeys = getRecentDateKeys(nowMs, days);

  const countByDate = new Map<string, number>();
  for (const key of dateKeys) {
    countByDate.set(key, 0);
  }

  const cutoff = getCutoffTimestamp(nowMs, days);

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

export function BmFrequencyTile({ digestionLogs, nowMs }: BmFrequencyTileProps) {
  const { sparklinePoints, todayCount, hasData } = useMemo(() => {
    const digestionCounts: Array<{ timestamp: number; episodesCount: number }> = [];
    for (const log of digestionLogs) {
      digestionCounts.push({
        timestamp: log.timestamp,
        episodesCount: normalizeEpisodesCount(log.data?.episodesCount),
      });
    }

    const dailyCounts = computeDailyCounts(digestionCounts, SPARKLINE_DAYS, nowMs);
    return {
      sparklinePoints: dailyCounts.map((d) => ({ dateKey: d.dateKey, value: d.count })),
      todayCount: dailyCounts.at(-1)?.count ?? 0,
      hasData: digestionCounts.length > 0,
    };
  }, [digestionLogs, nowMs]);

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

            {sparklinePoints.length >= 2 && (
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
