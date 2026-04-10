import { addDays, format } from "date-fns";
import { NotebookPen } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AutoEditProvider } from "./AutoEditContext";
import { groupLogEntries } from "./grouping";
import {
  ActivityGroupRow,
  CounterHabitRow,
  EventHabitRow,
  FluidGroupRow,
  FoodGroupRow,
  WeightGroupRow,
} from "./groups";
import { LogEntry } from "./rows";
import { TodayLogActionsProvider } from "./TodayLogContext";
import type { TodayLogProps } from "./types";

/**
 * Given a list of display items, find the group key that contains a log with the given ID.
 * Returns null if not found or the entry is an individual item (no group to expand).
 */
function findGroupKeyForLogId(
  displayItems: ReturnType<typeof groupLogEntries>,
  logId: string,
): string | null {
  for (const item of displayItems) {
    switch (item.kind) {
      case "individual":
        // Individual items don't need group expansion
        break;
      case "counter_habit":
      case "event_habit":
        if (item.entries.some((e) => e.id === logId)) return item.groupKey;
        break;
      case "fluid":
        if (item.entries.some((e) => e.id === logId)) return "fluid";
        break;
      case "food":
        if (item.entries.some((e) => e.id === logId)) return "food";
        break;
      case "activity":
      case "sleep":
        if (item.entries.some((e) => e.id === logId))
          return `activity_${item.groupKey}`;
        break;
      case "weight":
        if (item.entries.some((e) => e.id === logId)) return "weight";
        break;
    }
  }
  return null;
}

function getTodayLogTitle(dayOffset: number): string {
  if (dayOffset === 0) return "Today's Log";
  if (dayOffset === -1) return "Yesterday's Log";
  return "Daily Log";
}

function getTodayLogCenterLabel(selectedDate: Date, dayOffset: number): string {
  if (dayOffset === 0) return "Today";
  return format(selectedDate, "EEE, MMM d, yyyy");
}

function getNextDayAction(
  dayOffset: number,
  onJumpToToday: () => void,
  onNextDay: () => void,
): () => void {
  return dayOffset === -1 ? onJumpToToday : onNextDay;
}

// ── Main component ────────────────────────────────────────────────────

export function TodayLog({
  logs,
  habits,
  weightUnit,
  constrainHeight = false,
  selectedDate,
  dayOffset,
  onPreviousDay,
  onNextDay,
  onJumpToToday,
  onDelete,
  onSave,
  autoEditId,
  onAutoEditHandled,
  title: titleProp,
}: TodayLogProps) {
  const sorted = useMemo(
    () => [...logs].sort((a, b) => b.timestamp - a.timestamp),
    [logs],
  );
  const displayItems = useMemo(
    () => groupLogEntries(sorted, habits),
    [sorted, habits],
  );

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Auto-expand the group containing the autoEditId entry
  const lastAutoExpandedRef = useRef<string | null>(null);
  useEffect(() => {
    if (autoEditId == null || autoEditId === lastAutoExpandedRef.current)
      return;
    lastAutoExpandedRef.current = autoEditId;
    const groupKey = findGroupKeyForLogId(displayItems, autoEditId);
    if (groupKey != null) {
      setExpandedGroups((prev) => {
        if (prev.has(groupKey)) return prev;
        const next = new Set(prev);
        next.add(groupKey);
        return next;
      });
    }
  }, [autoEditId, displayItems]);

  // Stable callback for context so child components can clear the autoEditId
  const handleAutoEditHandled = useCallback(() => {
    onAutoEditHandled?.();
  }, [onAutoEditHandled]);

  const autoEditContextValue = useMemo(
    () => ({
      autoEditId: autoEditId ?? null,
      onAutoEditHandled: handleAutoEditHandled,
    }),
    [autoEditId, handleAutoEditHandled],
  );
  const toggleGroup = useCallback((key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const canMoveForward = dayOffset < 0;
  const title = titleProp ?? getTodayLogTitle(dayOffset);

  const prevDayLabel =
    dayOffset === 0 ? "Yesterday" : format(addDays(selectedDate, -1), "EEEE");
  const centerLabel = getTodayLogCenterLabel(selectedDate, dayOffset);
  const nextDayLabel =
    dayOffset === -1 ? "Today" : format(addDays(selectedDate, 1), "EEEE");
  const handleNextDay = getNextDayAction(dayOffset, onJumpToToday, onNextDay);

  const header = (
    <div className="mb-2 space-y-1">
      <div className="flex items-center justify-between gap-2">
        <div className="section-header !mb-0">
          <div
            className="section-icon"
            style={{ backgroundColor: "var(--section-log-muted)" }}
          >
            <NotebookPen
              className="h-4 w-4"
              style={{ color: "var(--section-log)" }}
            />
          </div>
          <span
            className="section-title font-sketch"
            style={{ color: "var(--section-log)" }}
          >
            {title}
          </span>
        </div>
        {logs.length > 0 && (
          <span className="text-xs text-[var(--section-log)] opacity-60">
            {logs.length} entries
          </span>
        )}
      </div>
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={onPreviousDay}
          aria-label="Go to previous day"
          className="text-xs font-medium text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--section-log)]"
        >
          {prevDayLabel}
        </button>
        <span
          className="rounded-full border px-3 py-1 text-xs font-semibold"
          style={{
            backgroundColor:
              "color-mix(in srgb, var(--section-log) 10%, var(--color-bg-elevated) 90%)",
            borderColor:
              "color-mix(in srgb, var(--section-log) 28%, transparent)",
            color:
              "color-mix(in srgb, var(--section-log) 82%, var(--color-text-primary) 18%)",
          }}
        >
          {centerLabel}
        </span>
        {canMoveForward && (
          <button
            type="button"
            onClick={handleNextDay}
            aria-label="Go to next day"
            className="text-xs font-medium text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--section-log)]"
          >
            {nextDayLabel}
          </button>
        )}
      </div>
    </div>
  );

  const actionsValue = useMemo(
    () => ({ onDelete, onSave }),
    [onDelete, onSave],
  );

  if (sorted.length === 0) {
    return (
      <section className="glass-card glass-card-log rounded-2xl p-4">
        {header}
        <div className="flex flex-col items-center gap-2 py-6">
          <NotebookPen className="h-8 w-8 text-[var(--section-log)] opacity-40" />
          <p className="text-center text-sm text-[var(--color-text-tertiary)]">
            No entries logged for this day yet.
          </p>
        </div>
      </section>
    );
  }

  return (
    <AutoEditProvider value={autoEditContextValue}>
      <TodayLogActionsProvider value={actionsValue}>
        <section
          className={`glass-card glass-card-log rounded-2xl p-4 ${
            constrainHeight
              ? "flex h-full min-h-0 flex-1 flex-col overflow-hidden"
              : ""
          }`}
        >
          {header}

          <ScrollArea
            className={
              constrainHeight
                ? "h-full min-h-0 flex-1 pr-1"
                : "min-h-[22rem] max-h-[70vh] pr-1 md:max-h-[calc(100vh-12rem)]"
            }
          >
            <div className="divide-y divide-[var(--section-log-border)] overflow-hidden">
              {displayItems.map((item) => {
                switch (item.kind) {
                  case "individual":
                    return (
                      <LogEntry
                        key={item.log.id}
                        log={item.log}
                        habits={habits}
                      />
                    );
                  case "counter_habit":
                    return (
                      <CounterHabitRow
                        key={item.groupKey}
                        group={item}
                        habits={habits}
                        expanded={expandedGroups.has(item.groupKey)}
                        onToggle={() => toggleGroup(item.groupKey)}
                      />
                    );
                  case "event_habit":
                    return (
                      <EventHabitRow
                        key={item.groupKey}
                        group={item}
                        habits={habits}
                        expanded={expandedGroups.has(item.groupKey)}
                        onToggle={() => toggleGroup(item.groupKey)}
                      />
                    );
                  case "food":
                    return (
                      <FoodGroupRow
                        key="food-group"
                        group={item}
                        expanded={expandedGroups.has("food")}
                        onToggle={() => toggleGroup("food")}
                      />
                    );
                  case "fluid":
                    return (
                      <FluidGroupRow
                        key="fluid-group"
                        group={item}
                        expanded={expandedGroups.has("fluid")}
                        onToggle={() => toggleGroup("fluid")}
                      />
                    );
                  case "activity":
                  case "sleep":
                    return (
                      <ActivityGroupRow
                        key={`activity-group-${item.groupKey}`}
                        group={item}
                        expanded={expandedGroups.has(
                          `activity_${item.groupKey}`,
                        )}
                        onToggle={() =>
                          toggleGroup(`activity_${item.groupKey}`)
                        }
                      />
                    );
                  case "weight":
                    return (
                      <WeightGroupRow
                        key="weight-group"
                        group={item}
                        weightUnit={weightUnit}
                        expanded={expandedGroups.has("weight")}
                        onToggle={() => toggleGroup("weight")}
                      />
                    );
                  default:
                    return null;
                }
              })}
            </div>
          </ScrollArea>
        </section>
      </TodayLogActionsProvider>
    </AutoEditProvider>
  );
}
