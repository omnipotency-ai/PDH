import { addDays, format, startOfDay } from "date-fns";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AiInsightsSection } from "@/components/track/dr-poo/AiInsightsSection";

// Lazy-loaded so that foodRegistry.ts (2858 lines of static data) is code-split
// into a separate chunk and not bundled into the initial JS payload.
const FoodMatchingModal = lazy(() =>
  import("@/components/track/FoodMatchingModal").then((m) => ({
    default: m.FoodMatchingModal,
  })),
);

import { NutritionCard } from "@/components/track/nutrition/NutritionCard";
import {
  type BowelFormState,
  BowelSection,
  FluidSection,
  FoodSection,
} from "@/components/track/panels";
import { QuickCapture } from "@/components/track/quick-capture";
import { HabitDetailSheet } from "@/components/track/quick-capture/HabitDetailSheet";
import { TodayStatusRow } from "@/components/track/TodayStatusRow";
import { TodayLog } from "@/components/track/today-log";
import { ConfettiBurst } from "@/components/ui/Confetti";
import { useResponsiveShellMode } from "@/components/ui/responsive-shell";
import { useSyncedLogsContext } from "@/contexts/SyncedLogsContext";
import { useAiInsights } from "@/hooks/useAiInsights";
import { useBaselineAverages } from "@/hooks/useBaselineAverages";
import { useCelebration } from "@/hooks/useCelebration";
import { useDayStats } from "@/hooks/useDayStats";
import { useFoodLlmMatching } from "@/hooks/useFoodLlmMatching";
import { useFoodParsing } from "@/hooks/useFoodParsing";
import { useHabitStreaks } from "@/hooks/useHabitStreaks";
import { useLiveClock } from "@/hooks/useLiveClock";
import { useHabits, useUnitSystem } from "@/hooks/useProfile";
import { useQuickCapture } from "@/hooks/useQuickCapture";
import { useUnresolvedFoodQueue } from "@/hooks/useUnresolvedFoodQueue";
import { useUnresolvedFoodToast } from "@/hooks/useUnresolvedFoodToast";
import { useWeeklySummaryAutoTrigger } from "@/hooks/useWeeklySummaryAutoTrigger";
import { bristolToConsistency, normalizeEpisodesCount } from "@/lib/analysis";
import { formatLocalDateKey } from "@/lib/dateUtils";
import { getErrorMessage } from "@/lib/errors";
import type { HabitConfig } from "@/lib/habitTemplates";
import { isSleepHabit } from "@/lib/habitTemplates";
import { normalizeFluidItemName } from "@/lib/normalizeFluidName";
import { useAddSyncedLog, useRemoveSyncedLog, useUpdateSyncedLog } from "@/lib/sync";
import { MS_PER_DAY } from "@/lib/timeConstants";
import { getDisplayWeightUnit } from "@/lib/units";
import { useStore } from "@/store";
import type {
  ActivityLogData,
  FluidLogData,
  HabitLogData,
  LogDataMap,
  LogType,
} from "@/types/domain";

type LogPayloadData = LogDataMap[LogType];

function toActivityTypeKey(value: string): string {
  const key = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (/^walk(ing)?$/.test(key)) return "walk";
  return key;
}

function getHabitsForActivityType(habits: HabitConfig[], activityType: string): HabitConfig[] {
  if (activityType === "sleep") {
    return habits.filter((habit) => isSleepHabit(habit));
  }
  return habits.filter((habit) => toActivityTypeKey(habit.name) === activityType);
}

function getActivityHabitLogValue(habit: HabitConfig, durationMinutes: number): number {
  return habit.unit === "hours" ? Math.round((durationMinutes / 60) * 100) / 100 : durationMinutes;
}

export default function TrackPage() {
  const logs = useSyncedLogsContext();
  const addSyncedLog = useAddSyncedLog();
  const removeSyncedLog = useRemoveSyncedLog();
  const updateSyncedLog = useUpdateSyncedLog();

  const { habits } = useHabits();
  const addHabitLog = useStore((state) => state.addHabitLog);
  const removeHabitLog = useStore((state) => state.removeHabitLog);
  const { unitSystem } = useUnitSystem();
  const weightUnit = getDisplayWeightUnit(unitSystem);
  const { sendNow } = useAiInsights();

  // Auto-generate weekly summary when a Sunday 18:00 boundary passes
  useWeeklySummaryAutoTrigger();

  // Auto-trigger LLM matching for food logs with unresolved items (no-op if no API key)
  useFoodLlmMatching();

  const { celebration, celebrateLog, celebrateGoalComplete, clearCelebration } = useCelebration();

  // useLiveClock fires once per minute, aligned to the clock minute.
  // On each tick we derive a fresh `now` from Date so all downstream
  // computations (todayStart, selectedDate, formatted header) stay current.
  useLiveClock();
  const now = new Date();
  const [dayOffset, setDayOffset] = useState(0);

  const todayStart = useMemo(() => startOfDay(now).getTime(), [now]);
  const todayEnd = todayStart + MS_PER_DAY;

  // --- Day statistics (extracted hook) ---
  const { todayHabitCounts, todayFluidTotalsByName, totalFluidMl, todayBmCount, lastBmTimestamp } =
    useDayStats({ logs, todayStart, todayEnd });

  const selectedDate = useMemo(() => startOfDay(addDays(now, dayOffset)), [now, dayOffset]);
  const selectedStart = selectedDate.getTime();
  const selectedEnd = addDays(selectedDate, 1).getTime();

  const selectedLogs = useMemo(
    () => logs.filter((log) => log.timestamp >= selectedStart && log.timestamp < selectedEnd),
    [logs, selectedStart, selectedEnd],
  );

  // --- Habit aggregate data for streaks, detail sheet, and coaching ---

  const habitLogs = useStore((s) => s.habitLogs);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const todayKey = formatLocalDateKey(todayStart);
    const storageKey = `quick-capture-destructive-rollover:${todayKey}`;
    if (window.localStorage.getItem(storageKey) === "shown") return;
    window.localStorage.setItem(storageKey, "shown");

    const yesterdayStart = todayStart - MS_PER_DAY;
    const yesterdayEnd = todayStart;

    const destructiveHabits = habits.filter(
      (habit) =>
        habit.kind === "destructive" && typeof habit.dailyCap === "number" && habit.dailyCap > 0,
    );

    if (destructiveHabits.length === 0) return;

    let underCapCount = 0;
    let zeroUseCount = 0;

    for (const habit of destructiveHabits) {
      const total = habitLogs
        .filter(
          (entry) =>
            entry.habitId === habit.id && entry.at >= yesterdayStart && entry.at < yesterdayEnd,
        )
        .reduce((sum, entry) => sum + entry.value, 0);

      if (total < (habit.dailyCap ?? 0)) underCapCount += 1;
      if (total === 0) zeroUseCount += 1;
    }

    if (zeroUseCount > 0) {
      const message =
        zeroUseCount === 1
          ? "Yesterday: zero use on one destructive habit. Excellent control."
          : `Yesterday: zero use on ${zeroUseCount} destructive habits. Excellent control.`;
      celebrateGoalComplete(message);
      return;
    }

    if (underCapCount > 0) {
      toast.success(
        underCapCount === 1
          ? "Yesterday: you stayed under a destructive cap. Keep that momentum."
          : `Yesterday: you stayed under ${underCapCount} destructive caps. Keep that momentum.`,
      );
    }
  }, [habits, habitLogs, todayStart, celebrateGoalComplete]);

  const { daySummaries, streakSummaries } = useHabitStreaks({
    habitLogs,
    habits,
    now,
  });

  // --- Baseline averages + scheduled insights (replaces old coaching strip) ---
  // Side-effect-only: computes and caches baselines in Zustand store.
  // The return value is consumed by other hooks via the store, not directly here.
  useBaselineAverages({
    logs,
    todayHabitCounts,
    todayFluidTotalsByName,
    todayTotalFluidMl: totalFluidMl,
  });

  // --- Persistent toast for unresolved food items (0-6 hour window) ---
  const [reviewQueueOpen, setReviewQueueOpen] = useState(false);
  const unresolvedQueue = useUnresolvedFoodQueue(logs);

  const handleReviewUnresolved = useCallback(() => {
    try {
      if (unresolvedQueue.length === 0) {
        toast.info("All food items have been resolved.");
        return;
      }
      setReviewQueueOpen(true);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Unable to load unresolved items. Check connection."));
    }
  }, [unresolvedQueue]);
  useUnresolvedFoodToast(logs, now.getTime(), handleReviewUnresolved);

  const afterSave = useCallback(() => {
    celebrateLog();
  }, [celebrateLog]);

  // --- Food parsing orchestration (extracted hook) ---
  const { handleLogFood: parseAndLogFood } = useFoodParsing({ afterSave });

  // FoodSection passes (notes, rawText, timestampMs?) — server handles all parsing.
  const handleLogFood = useCallback(
    (notes: string, rawText: string, timestampMs?: number) =>
      parseAndLogFood(notes, rawText, timestampMs),
    [parseAndLogFood],
  );

  // --- Auto-edit state: set by toast "Edit" button, consumed by TodayLog ---
  const [autoEditLogId, setAutoEditLogId] = useState<string | null>(null);

  const handleRequestEdit = useCallback((logId: string) => {
    // Ensure we're viewing today so the entry is visible
    setDayOffset(0);
    setAutoEditLogId(logId);
  }, []);

  const handleAutoEditHandled = useCallback(() => {
    setAutoEditLogId(null);
  }, []);

  // --- Quick capture handlers (extracted hook) ---
  const {
    handleQuickCaptureTap,
    handleLogSleepQuickCapture,
    handleLogActivityQuickCapture,
    handleLogFluid,
    handleLogWeightKg,
    handleQuickCaptureLongPress,
    handleCloseDetailSheet,
    detailSheetHabit,
  } = useQuickCapture({
    afterSave,
    celebrateGoalComplete,
    todayHabitCounts,
    todayFluidTotalsByName,
    streakSummaries,
    logs,
    todayStart,
    todayEnd,
    removeSyncedLog,
    removeHabitLog,
    onRequestEdit: handleRequestEdit,
  });

  // Detail day summaries for habit detail sheet (depends on daySummaries from useHabitStreaks)
  const detailDaySummaries = useMemo(
    () =>
      detailSheetHabit
        ? daySummaries.filter((summary) => summary.habitId === detailSheetHabit.id)
        : [],
    [daySummaries, detailSheetHabit],
  );

  const handlePreviousDay = useCallback(() => setDayOffset((value) => value - 1), []);
  const handleNextDay = useCallback(() => setDayOffset((value) => Math.min(value + 1, 0)), []);
  const handleJumpToToday = useCallback(() => setDayOffset(0), []);

  const handleLogBowel = async (state: BowelFormState) => {
    const consistencyTag = bristolToConsistency(state.bristolCode);
    const timestamp = state.timestampMs ?? Date.now();
    await addSyncedLog({
      timestamp,
      type: "digestion",
      data: {
        episodesCount: normalizeEpisodesCount(state.episodesCount),
        windowMinutes: 30,
        urgencyTag: state.urgencyTag,
        effortTag: state.effortTag,
        consistencyTag,
        volumeTag: state.volumeTag,
        bristolCode: state.bristolCode,
        accident: state.accident,
        notes: state.notes.trim(),
      },
    });
    afterSave();
  };

  const handleDelete = async (id: string) => {
    try {
      const logToDelete = logs.find((entry) => entry.id === id);

      await removeSyncedLog(id);

      // Clean up corresponding habit logs in Zustand
      if (logToDelete) {
        if (logToDelete.type === "fluid") {
          const items = logToDelete.data?.items;
          if (Array.isArray(items)) {
            for (const item of items) {
              const normalizedName = normalizeFluidItemName(item?.name);
              const matchingHabit = habits.find(
                (h) => h.logAs === "fluid" && normalizeFluidItemName(h.name) === normalizedName,
              );
              if (matchingHabit) {
                removeHabitLog(matchingHabit.id, logToDelete.timestamp);
              }
            }
          }
        } else if (logToDelete.type === "habit") {
          const habitId = logToDelete.data?.habitId;
          if (typeof habitId === "string") {
            removeHabitLog(habitId, logToDelete.timestamp);
          }
        } else if (logToDelete.type === "activity") {
          const activityType = toActivityTypeKey(String(logToDelete.data?.activityType ?? ""));
          if (activityType === "sleep") {
            for (const habit of habits) {
              if (isSleepHabit(habit)) {
                removeHabitLog(habit.id, logToDelete.timestamp);
              }
            }
          } else {
            for (const habit of habits) {
              const habitActivityType = toActivityTypeKey(habit.name);
              if (habitActivityType === activityType) {
                removeHabitLog(habit.id, logToDelete.timestamp);
              }
            }
          }
        }
      }
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to delete entry."));
    }
  };

  const handleSave = async (id: string, data: LogPayloadData, timestamp?: number) => {
    try {
      const log = logs.find((entry) => entry.id === id);
      if (!log) {
        throw new Error("Log not found.");
      }

      await updateSyncedLog({
        id,
        timestamp: timestamp ?? log.timestamp,
        type: log.type,
        data,
      });

      const nextTimestamp = timestamp ?? log.timestamp;

      if (log.type === "fluid") {
        const nextFluidData = data as FluidLogData;
        const previousItems = Array.isArray(log.data?.items) ? log.data.items : [];
        for (const item of previousItems) {
          const normalizedName = normalizeFluidItemName(item?.name);
          const matchingHabit = habits.find(
            (habit) =>
              habit.logAs === "fluid" && normalizeFluidItemName(habit.name) === normalizedName,
          );
          if (matchingHabit) {
            removeHabitLog(matchingHabit.id, log.timestamp);
          }
        }

        for (const item of nextFluidData.items) {
          const normalizedName = normalizeFluidItemName(item?.name);
          const quantity = Number(item.quantity ?? 0);
          if (!normalizedName || !Number.isFinite(quantity) || quantity <= 0) {
            continue;
          }

          const matchingHabit = habits.find(
            (habit) =>
              habit.logAs === "fluid" && normalizeFluidItemName(habit.name) === normalizedName,
          );
          if (!matchingHabit) continue;

          addHabitLog({
            id: crypto.randomUUID(),
            habitId: matchingHabit.id,
            value: quantity,
            source: "quick",
            at: nextTimestamp,
          });
        }
      } else if (log.type === "habit") {
        const nextHabitData = data as HabitLogData;
        const previousHabitId = typeof log.data?.habitId === "string" ? log.data.habitId : null;
        if (previousHabitId) {
          removeHabitLog(previousHabitId, log.timestamp);
        }

        const nextHabitId =
          typeof nextHabitData.habitId === "string" ? nextHabitData.habitId : null;
        const nextQuantity = Number(nextHabitData.quantity ?? 1);
        if (nextHabitId && Number.isFinite(nextQuantity) && nextQuantity > 0) {
          addHabitLog({
            id: crypto.randomUUID(),
            habitId: nextHabitId,
            value: nextQuantity,
            source: "quick",
            at: nextTimestamp,
          });
        }
      } else if (log.type === "activity") {
        const nextActivityData = data as ActivityLogData;
        const previousActivityType = toActivityTypeKey(String(log.data?.activityType ?? ""));
        for (const habit of getHabitsForActivityType(habits, previousActivityType)) {
          removeHabitLog(habit.id, log.timestamp);
        }

        const nextActivityType = toActivityTypeKey(String(nextActivityData.activityType ?? ""));
        const nextDurationMinutes = Number(nextActivityData.durationMinutes ?? 0);
        if (Number.isFinite(nextDurationMinutes) && nextDurationMinutes > 0) {
          for (const habit of getHabitsForActivityType(habits, nextActivityType)) {
            addHabitLog({
              id: crypto.randomUUID(),
              habitId: habit.id,
              value: getActivityHabitLogValue(habit, nextDurationMinutes),
              source: "quick",
              at: nextTimestamp,
            });
          }
        }
      }

      toast.success("Entry updated");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to update entry."));
      throw err;
    }
  };

  const responsiveMode = useResponsiveShellMode();
  const isMobile = responsiveMode === "mobile";
  const isTablet = responsiveMode === "tablet";
  const isDesktop = responsiveMode === "desktop";

  // Shared component instances rendered conditionally per layout
  const todayStatusRow = (
    <TodayStatusRow
      bmCount={todayBmCount}
      fluidTotalMl={totalFluidMl}
      lastBmTimestamp={lastBmTimestamp}
      nowMs={now.getTime()}
    />
  );

  const quickCapture = (
    <QuickCapture
      habits={habits}
      todayHabitCounts={todayHabitCounts}
      todayFluidMl={todayFluidTotalsByName}
      onTap={handleQuickCaptureTap}
      onLogSleepHours={handleLogSleepQuickCapture}
      onLogActivityMinutes={handleLogActivityQuickCapture}
      onLogWeightKg={handleLogWeightKg}
      onLongPress={handleQuickCaptureLongPress}
    />
  );

  const aiInsightsSection = <AiInsightsSection onSendNow={sendNow} />;

  const todayLog = (
    <TodayLog
      logs={selectedLogs}
      habits={habits}
      weightUnit={weightUnit}
      constrainHeight={isDesktop}
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
  );

  return (
    <div className="mx-auto max-w-440 pb-8">
      <header className="mb-3">
        <div className="grid grid-cols-1 items-baseline gap-5 md:grid-cols-2 xl:grid-cols-[3fr_4fr_3fr]">
          <div className="flex flex-wrap items-baseline gap-4">
            <h1 className="font-display text-2xl font-bold tracking-tight text-teal-600 dark:text-teal-400 md:text-3xl shrink-0">
              Track
            </h1>
            <p className="font-monaco text-xs uppercase tracking-[0.2em] text-teal-600 dark:text-teal-400 shrink-0">
              {format(now, "E · d MMMM · HH:mm")}
            </p>
          </div>
          <div className="flex justify-center">{todayStatusRow}</div>
          {isDesktop && <div />}
        </div>
      </header>

      <div className="stagger-reveal grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-[3fr_4fr_3fr] xl:items-start">
        {/* ── Column 1: Input forms ── */}
        <section className="space-y-3 min-w-0">
          <NutritionCard />
          <FoodSection onLogFood={handleLogFood} />
          <FluidSection onLogFluid={handleLogFluid} />
          <BowelSection onSave={handleLogBowel} />
          {quickCapture}
          {!isDesktop && aiInsightsSection}
        </section>

        {/* ── Tablet (md): Column 2 = TodayLog ── */}
        {isTablet && <section className="space-y-5 min-w-0">{todayLog}</section>}

        {/* ── Desktop (xl): Column 2 = AiInsights ── */}
        {isDesktop && <section className="space-y-5 min-w-0">{aiInsightsSection}</section>}

        {/* ── Mobile: TodayLog below inputs ── */}
        {isMobile && <aside className="space-y-5 min-w-0">{todayLog}</aside>}

        {/* ── Desktop (xl): Column 3 = TodayLog ── */}
        {isDesktop && (
          <aside className="min-w-0 self-start xl:sticky xl:top-4 xl:flex xl:h-[calc(100vh-2rem)] xl:flex-col xl:overflow-hidden">
            {todayLog}
          </aside>
        )}
      </div>

      {celebration?.confettiActive && (
        <ConfettiBurst
          active={celebration.confettiActive}
          onComplete={clearCelebration}
          originX={celebration.confettiOriginX}
          originY={celebration.confettiOriginY}
        />
      )}

      <HabitDetailSheet
        habit={detailSheetHabit}
        count={detailSheetHabit ? (todayHabitCounts[detailSheetHabit.id] ?? 0) : 0}
        {...(detailSheetHabit?.logAs === "fluid" && {
          fluidMl: todayFluidTotalsByName[normalizeFluidItemName(detailSheetHabit.name)],
        })}
        daySummaries={detailDaySummaries}
        streakSummary={detailSheetHabit ? (streakSummaries[detailSheetHabit.id] ?? null) : null}
        onClose={handleCloseDetailSheet}
      />

      <Suspense fallback={null}>
        <FoodMatchingModal
          queue={unresolvedQueue}
          open={reviewQueueOpen}
          onOpenChange={setReviewQueueOpen}
        />
      </Suspense>
    </div>
  );
}
