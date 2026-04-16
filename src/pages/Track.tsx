import {
  addDays,
  differenceInCalendarDays,
  format,
  startOfDay,
} from "date-fns";
import { useConvex } from "convex/react";
import { CalendarDays, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { TodayLog } from "@/components/track/today-log";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTodayLogCrud } from "@/hooks/useTodayLogCrud";
import { useLiveClock } from "@/hooks/useLiveClock";
import { useHabits, useUnitSystem } from "@/hooks/useProfile";
import { getErrorMessage } from "@/lib/errors";
import { asConvexId, toSyncedLogs, type SyncedLog } from "@/lib/sync";
import { getDisplayWeightUnit } from "@/lib/units";
import { api } from "../../convex/_generated/api";
import { useStore } from "@/store";

// ---------------------------------------------------------------------------
// Date picker
// ---------------------------------------------------------------------------

function TrackDatePicker({
  selectedDate,
  todayDate,
  onSelect,
}: {
  selectedDate: Date;
  todayDate: Date;
  onSelect: (date: Date) => void;
}) {
  const [open, setOpen] = useState(false);
  const label =
    differenceInCalendarDays(selectedDate, todayDate) === 0
      ? "Today"
      : format(selectedDate, "EEE, MMM d");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-9 gap-2 rounded-full border-teal-500/20 bg-white/60 px-4 text-xs font-semibold text-teal-700 hover:bg-teal-50 dark:border-teal-400/20 dark:bg-slate-900/40 dark:text-teal-300 dark:hover:bg-slate-900"
        >
          <CalendarDays className="h-4 w-4" aria-hidden="true" />
          <span>{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => {
            if (!date) return;
            onSelect(date);
            setOpen(false);
          }}
          disabled={(date) => startOfDay(date) > todayDate}
          defaultMonth={selectedDate}
        />
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Track page — log viewer + CRUD
// ---------------------------------------------------------------------------

export default function TrackPage() {
  const convex = useConvex();
  const { habits } = useHabits();
  const { unitSystem } = useUnitSystem();
  const weightUnit = getDisplayWeightUnit(unitSystem);

  // Pending edit from cross-page navigation (Home → Track)
  const activeDate = useStore((s) => s.activeDate);
  const setActiveDate = useStore((s) => s.setActiveDate);
  const goBack = useStore((s) => s.goBack);
  const goForward = useStore((s) => s.goForward);
  const goToToday = useStore((s) => s.goToToday);
  const pendingEditLogId = useStore((s) => s.pendingEditLogId);
  const setPendingEditLogId = useStore((s) => s.setPendingEditLogId);

  useLiveClock();
  const now = new Date();

  const todayDate = useMemo(() => startOfDay(now), [now]);
  const dayOffset = useMemo(
    () => differenceInCalendarDays(activeDate, todayDate),
    [activeDate, todayDate],
  );
  const selectedStart = activeDate.getTime();
  const selectedEnd = addDays(activeDate, 1).getTime();

  const [selectedLogs, setSelectedLogs] = useState<SyncedLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsError, setLogsError] = useState<string | null>(null);
  const loadRequestIdRef = useRef(0);

  const loadSelectedLogs = useCallback(async () => {
    const requestId = ++loadRequestIdRef.current;
    setLogsLoading(true);
    setLogsError(null);

    try {
      const rows = await convex.query(api.logs.listByRange, {
        startMs: selectedStart,
        endMs: selectedEnd,
        limit: 500,
      });
      if (requestId !== loadRequestIdRef.current) return;
      setSelectedLogs(toSyncedLogs(rows));
    } catch (error) {
      if (requestId !== loadRequestIdRef.current) return;
      setLogsError(getErrorMessage(error, "Failed to refresh this day."));
    } finally {
      if (requestId === loadRequestIdRef.current) {
        setLogsLoading(false);
      }
    }
  }, [convex, selectedEnd, selectedStart]);

  useEffect(() => {
    void loadSelectedLogs();
  }, [loadSelectedLogs]);

  const { handleDelete: handleDeleteBase, handleSave: handleSaveBase } =
    useTodayLogCrud(selectedLogs);

  // --- Auto-edit state ---
  const [autoEditLogId, setAutoEditLogId] = useState<string | null>(null);

  // Consume pending edit from Zustand store (cross-page navigation from Home)
  useEffect(() => {
    if (pendingEditLogId === null) return;
    let cancelled = false;

    void (async () => {
      try {
        const matchingLog = await convex.query(api.logs.getById, {
          id: asConvexId<"logs">(pendingEditLogId),
        });
        if (cancelled) return;
        if (matchingLog) {
          setActiveDate(startOfDay(new Date(matchingLog.timestamp)));
        }
        setAutoEditLogId(pendingEditLogId);
      } finally {
        if (!cancelled) {
          setPendingEditLogId(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [convex, pendingEditLogId, setActiveDate, setPendingEditLogId]);

  const handleDelete = useCallback(
    async (id: string) => {
      await handleDeleteBase(id);
      await loadSelectedLogs();
    },
    [handleDeleteBase, loadSelectedLogs],
  );

  const handleSave = useCallback(
    async (id: string, data: Parameters<typeof handleSaveBase>[1], timestamp?: number) => {
      await handleSaveBase(id, data, timestamp);
      await loadSelectedLogs();
    },
    [handleSaveBase, loadSelectedLogs],
  );

  const handleAutoEditHandled = useCallback(() => {
    setAutoEditLogId(null);
  }, []);

  // --- Date navigation ---
  const handlePreviousDay = useCallback(() => goBack(), [goBack]);
  const handleNextDay = useCallback(() => goForward(), [goForward]);
  const handleJumpToToday = useCallback(() => goToToday(), [goToToday]);
  const handleSelectDate = useCallback(
    (date: Date) => {
      const normalized = startOfDay(date);
      setActiveDate(
        normalized.getTime() > todayDate.getTime() ? todayDate : normalized,
      );
    },
    [setActiveDate, todayDate],
  );

  return (
    <div className="pb-8">
      <header className="mb-3">
        <div className="flex flex-wrap items-baseline gap-4">
          <h1 className="font-sketch text-2xl font-bold tracking-tight text-teal-600 dark:text-teal-400 md:text-3xl shrink-0">
            Track
          </h1>
          <p className="font-monaco text-xs uppercase tracking-[0.2em] text-teal-600 dark:text-teal-400 shrink-0">
            {format(now, "E · d MMMM · HH:mm")}
          </p>
          <TrackDatePicker
            selectedDate={activeDate}
            todayDate={todayDate}
            onSelect={handleSelectDate}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => void loadSelectedLogs()}
            disabled={logsLoading}
            className="h-9 gap-2 rounded-full border-teal-500/20 bg-white/60 px-4 text-xs font-semibold text-teal-700 hover:bg-teal-50 dark:border-teal-400/20 dark:bg-slate-900/40 dark:text-teal-300 dark:hover:bg-slate-900"
          >
            <RefreshCw
              className={`h-4 w-4 ${logsLoading ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            <span>Refresh</span>
          </Button>
        </div>
        {logsError && (
          <p className="mt-2 text-sm text-rose-500">{logsError}</p>
        )}
      </header>

      <TodayLog
        logs={selectedLogs}
        habits={habits}
        weightUnit={weightUnit}
        constrainHeight={false}
        selectedDate={activeDate}
        dayOffset={dayOffset}
        onPreviousDay={handlePreviousDay}
        onNextDay={handleNextDay}
        onJumpToToday={handleJumpToToday}
        onDelete={handleDelete}
        onSave={handleSave}
        autoEditId={autoEditLogId}
        onAutoEditHandled={handleAutoEditHandled}
      />
    </div>
  );
}
