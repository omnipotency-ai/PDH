import {
  addDays,
  differenceInCalendarDays,
  format,
  startOfDay,
} from "date-fns";
import { CalendarDays } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { TodayLog } from "@/components/track/today-log";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useSyncedLogsContext } from "@/contexts/SyncedLogsContext";
import { useTodayLogCrud } from "@/hooks/useTodayLogCrud";
import { useLiveClock } from "@/hooks/useLiveClock";
import { useUnitSystem } from "@/hooks/useProfile";
import { getDisplayWeightUnit } from "@/lib/units";
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
  const { logs } = useSyncedLogsContext();
  const { handleDelete, handleSave } = useTodayLogCrud(logs);

  const { unitSystem } = useUnitSystem();
  const weightUnit = getDisplayWeightUnit(unitSystem);

  // Pending edit from cross-page navigation (Home → Track)
  const pendingEditLogId = useStore((s) => s.pendingEditLogId);
  const setPendingEditLogId = useStore((s) => s.setPendingEditLogId);

  useLiveClock();
  const now = new Date();
  const [selectedDate, setSelectedDate] = useState(() =>
    startOfDay(new Date()),
  );

  const todayDate = useMemo(() => startOfDay(now), [now]);
  const dayOffset = useMemo(
    () => differenceInCalendarDays(selectedDate, todayDate),
    [selectedDate, todayDate],
  );
  const selectedStart = selectedDate.getTime();
  const selectedEnd = addDays(selectedDate, 1).getTime();

  const selectedLogs = useMemo(
    () =>
      logs.filter(
        (log) => log.timestamp >= selectedStart && log.timestamp < selectedEnd,
      ),
    [logs, selectedStart, selectedEnd],
  );

  // --- Auto-edit state ---
  const [autoEditLogId, setAutoEditLogId] = useState<string | null>(null);

  // Consume pending edit from Zustand store (cross-page navigation from Home)
  useEffect(() => {
    if (pendingEditLogId === null) return;
    const matchingLog = logs.find((entry) => entry.id === pendingEditLogId);
    if (matchingLog) {
      setSelectedDate(startOfDay(new Date(matchingLog.timestamp)));
    }
    setAutoEditLogId(pendingEditLogId);
    setPendingEditLogId(null);
  }, [pendingEditLogId, logs, setPendingEditLogId]);

  const handleAutoEditHandled = useCallback(() => {
    setAutoEditLogId(null);
  }, []);

  // --- Date navigation ---
  const handlePreviousDay = useCallback(
    () => setSelectedDate((value) => startOfDay(addDays(value, -1))),
    [],
  );
  const handleNextDay = useCallback(
    () =>
      setSelectedDate((value) => {
        const next = startOfDay(addDays(value, 1));
        return next.getTime() > todayDate.getTime() ? todayDate : next;
      }),
    [todayDate],
  );
  const handleJumpToToday = useCallback(
    () => setSelectedDate(todayDate),
    [todayDate],
  );
  const handleSelectDate = useCallback(
    (date: Date) => {
      const normalized = startOfDay(date);
      setSelectedDate(
        normalized.getTime() > todayDate.getTime() ? todayDate : normalized,
      );
    },
    [todayDate],
  );

  return (
    <div className="pb-8">
      <header className="mb-3">
        <div className="flex flex-wrap items-baseline gap-4">
          <h1 className="font-display text-2xl font-bold tracking-tight text-teal-600 dark:text-teal-400 md:text-3xl shrink-0">
            Track
          </h1>
          <p className="font-monaco text-xs uppercase tracking-[0.2em] text-teal-600 dark:text-teal-400 shrink-0">
            {format(now, "E · d MMMM · HH:mm")}
          </p>
          <TrackDatePicker
            selectedDate={selectedDate}
            todayDate={todayDate}
            onSelect={handleSelectDate}
          />
        </div>
      </header>

      <TodayLog
        logs={selectedLogs}
        habits={[]}
        weightUnit={weightUnit}
        constrainHeight={false}
        selectedDate={selectedDate}
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
