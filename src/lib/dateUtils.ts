/** Convert a Date or timestamp to 'YYYY-MM-DD' date string. */
export function formatLocalDateKey(input: Date | number): string {
  const date = typeof input === "number" ? new Date(input) : input;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
