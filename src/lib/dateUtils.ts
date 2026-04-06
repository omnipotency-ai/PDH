import { MS_PER_DAY, MS_PER_HOUR, MS_PER_MINUTE } from "@/lib/timeConstants";

/**
 * Format a timestamp as a relative time string (e.g., "2 days ago").
 * Accepts an optional `nowMs` so callers can pass a stable clock value.
 * Returns "Never" when the timestamp is 0 or missing.
 */
export function formatRelativeTime(
  timestamp: number,
  nowMs: number = Date.now(),
): string {
  if (timestamp <= 0) return "Never";

  const diff = nowMs - timestamp;

  if (diff < 0) return "Just now";
  if (diff < MS_PER_MINUTE) return "Just now";
  if (diff < MS_PER_HOUR) {
    const mins = Math.floor(diff / MS_PER_MINUTE);
    return `${mins}m ago`;
  }
  if (diff < MS_PER_DAY) {
    const hours = Math.floor(diff / MS_PER_HOUR);
    return `${hours}h ago`;
  }
  if (diff < 30 * MS_PER_DAY) {
    const days = Math.floor(diff / MS_PER_DAY);
    return `${days}d ago`;
  }
  if (diff < 365 * MS_PER_DAY) {
    const months = Math.floor(diff / (30 * MS_PER_DAY));
    return `${months}mo ago`;
  }
  const years = Math.floor(diff / (365 * MS_PER_DAY));
  return `${years}y ago`;
}

/** Convert a Date or timestamp to 'YYYY-MM-DD' date string. */
export function formatLocalDateKey(input: Date | number): string {
  const date = typeof input === "number" ? new Date(input) : input;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Apply the clock time from a reference instant to a calendar date.
 *
 * Useful for backdated logging: the user chooses a date, and we keep the
 * current local time-of-day instead of forcing the new entry to midnight.
 */
export function getDateScopedTimestamp(
  date: Date,
  referenceInput: Date | number = Date.now(),
): number {
  const reference =
    typeof referenceInput === "number"
      ? new Date(referenceInput)
      : referenceInput;
  const scoped = new Date(date);
  scoped.setHours(
    reference.getHours(),
    reference.getMinutes(),
    reference.getSeconds(),
    reference.getMilliseconds(),
  );
  return scoped.getTime();
}
