/**
 * DatePillHeader — horizontal scrollable row of date pills.
 *
 * Shows the last N days as clickable pills. Selecting a pill updates
 * the shared activeDate in the global store. Used on Home and Track pages.
 *
 * Layout: [TODAY] [MON APR 7] [SUN APR 6] … (newest left)
 */

import {
  addDays,
  differenceInCalendarDays,
  format,
  startOfDay,
} from "date-fns";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useStore } from "@/store";

// How many past days to show in the pill row (today + 13 past = 14 total)
const PILL_COUNT = 14;

function buildPills(today: Date): Date[] {
  return Array.from({ length: PILL_COUNT }, (_, i) =>
    startOfDay(addDays(today, -i)),
  );
}

function pillLabel(date: Date, today: Date): string {
  const diff = differenceInCalendarDays(date, today);
  if (diff === 0) return "TODAY";
  if (diff === -1) return "YESTERDAY";
  return format(date, "EEE MMM d").toUpperCase();
}

export function DatePillHeader() {
  const activeDate = useStore((s) => s.activeDate);
  const setActiveDate = useStore((s) => s.setActiveDate);

  const today = startOfDay(new Date());
  const pills = buildPills(today);

  const scrollRef = useRef<HTMLDivElement>(null);
  const activePillRef = useRef<HTMLButtonElement>(null);

  // Scroll active pill into view when it changes
  useEffect(() => {
    if (activePillRef.current && scrollRef.current) {
      activePillRef.current.scrollIntoView({
        inline: "nearest",
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [activeDate]);

  return (
    <div
      ref={scrollRef}
      data-slot="date-pill-header"
      className="relative -mx-4 overflow-x-auto px-4 pb-1"
      style={{ scrollbarWidth: "none" }}
    >
      <div className="flex gap-1.5" role="group" aria-label="Select date">
        {pills.map((date) => {
          const isActive = date.getTime() === activeDate.getTime();
          const label = pillLabel(date, today);

          return (
            <button
              key={date.getTime()}
              ref={isActive ? activePillRef : undefined}
              type="button"
              onClick={() => setActiveDate(date)}
              aria-pressed={isActive}
              aria-label={format(date, "EEEE d MMMM yyyy")}
              className={cn(
                "shrink-0 rounded-full px-3 py-1 text-[10px] font-bold tracking-wider transition-colors whitespace-nowrap",
                isActive
                  ? "bg-teal-500/20 text-teal-400 ring-1 ring-teal-500/40"
                  : "bg-[var(--surface-2)] text-[var(--text-faint)] hover:bg-[var(--surface-3)] hover:text-[var(--text-muted)]",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
