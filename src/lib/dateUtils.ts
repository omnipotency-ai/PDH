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
  const reference = typeof referenceInput === "number" ? new Date(referenceInput) : referenceInput;
  const scoped = new Date(date);
  scoped.setHours(
    reference.getHours(),
    reference.getMinutes(),
    reference.getSeconds(),
    reference.getMilliseconds(),
  );
  return scoped.getTime();
}
