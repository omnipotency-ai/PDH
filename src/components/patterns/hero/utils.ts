/**
 * Convert a timestamp to a date string key in YYYY-MM-DD format.
 * Used by hero tiles that bucket logs by calendar day.
 */
export function getDateKey(timestamp: number): string {
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
