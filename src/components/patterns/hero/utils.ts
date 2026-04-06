import { formatLocalDateKey } from "@/lib/dateUtils";

/**
 * Convert a timestamp to a date string key in YYYY-MM-DD format.
 * Used by hero tiles that bucket logs by calendar day.
 */
export function getDateKey(timestamp: number): string {
  return formatLocalDateKey(timestamp);
}

/**
 * Return the local calendar-day boundary for `daysAgo` days before `nowMs`.
 * This keeps hero charts aligned to midnight instead of rolling 24h windows.
 */
export function getCutoffTimestamp(nowMs: number, daysAgo: number): number {
  const cutoff = new Date(nowMs);
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - daysAgo);
  return cutoff.getTime();
}

/**
 * Return trailing calendar day keys in chronological order, ending with today.
 */
export function getRecentDateKeys(nowMs: number, days: number): string[] {
  const todayStart = new Date(getCutoffTimestamp(nowMs, 0));
  const keys: string[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(todayStart);
    date.setDate(date.getDate() - i);
    keys.push(formatLocalDateKey(date));
  }

  return keys;
}
