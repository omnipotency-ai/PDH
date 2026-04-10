/**
 * DatePillHeader — three-pill date navigator.
 *
 * Shows [prev day] [active day] [next day] centred below the nav.
 * Active date is highlighted with a teal underline bar.
 * Flanking dates are muted and clickable.
 * Next date is suppressed when activeDate is today.
 *
 * Reads/writes activeDate from the global Zustand store so every
 * date-scoped component shares the same selection.
 */

import {
  addDays,
  differenceInCalendarDays,
  format,
  startOfDay,
} from "date-fns";
import { cn } from "@/lib/utils";
import { useStore } from "@/store";

function pillLabel(date: Date, today: Date): string {
  const diff = differenceInCalendarDays(date, today);
  if (diff === 0) return "TODAY";
  if (diff === -1) return "YESTERDAY";
  if (diff === 1) return "TOMORROW";
  return format(date, "EEE MMM d").toUpperCase();
}

export function DatePillHeader() {
  const activeDate = useStore((s) => s.activeDate);
  const setActiveDate = useStore((s) => s.setActiveDate);

  const today = startOfDay(new Date());
  const prevDate = startOfDay(addDays(activeDate, -1));
  const nextDate = startOfDay(addDays(activeDate, 1));
  const canGoForward = activeDate.getTime() < today.getTime();
  // Next date is always capped at today
  const nextDateCapped =
    nextDate.getTime() > today.getTime() ? today : nextDate;

  return (
    <div
      data-slot="date-pill-header"
      className="flex items-center justify-center gap-6 py-1"
    >
      {/* Previous day */}
      <button
        type="button"
        onClick={() => setActiveDate(prevDate)}
        aria-label={format(prevDate, "EEEE d MMMM yyyy")}
        className="text-xs font-semibold tracking-widest text-[var(--text-faint)] uppercase transition-colors hover:text-[var(--text-muted)]"
      >
        {pillLabel(prevDate, today)}
      </button>

      {/* Active date */}
      <div className="relative flex flex-col items-center gap-1">
        <span
          className={cn(
            "text-xs font-bold tracking-widest uppercase",
            "text-teal-400",
          )}
          aria-current="date"
        >
          {pillLabel(activeDate, today)}
        </span>
        {/* Underline bar */}
        <span className="h-0.5 w-full rounded-full bg-teal-500" />
      </div>

      {/* Next day — hidden when activeDate is today */}
      {canGoForward ? (
        <button
          type="button"
          onClick={() => setActiveDate(nextDateCapped)}
          aria-label={format(nextDateCapped, "EEEE d MMMM yyyy")}
          className="text-xs font-semibold tracking-widest text-[var(--text-faint)] uppercase transition-colors hover:text-[var(--text-muted)]"
        >
          {pillLabel(nextDateCapped, today)}
        </button>
      ) : (
        // Spacer so active date stays visually centred
        <span className="invisible text-xs font-semibold tracking-widest">
          YESTERDAY
        </span>
      )}
    </div>
  );
}
