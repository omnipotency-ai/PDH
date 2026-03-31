import { format } from "date-fns";

/** Format transit time from minutes to hours with 1 decimal place. */
export function formatTransitHours(minutes: number): string {
  const hours = Math.round(minutes / 6) / 10;
  return `${hours}h`;
}

/** Format a timestamp as a short date like "Mar 1", "Feb 27". */
export function formatShortDate(timestamp: number): string {
  return format(new Date(timestamp), "MMM d");
}
