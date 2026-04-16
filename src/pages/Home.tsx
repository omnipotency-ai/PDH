import { Dialog } from "@base-ui/react/dialog";
import { useUser } from "@clerk/clerk-react";
import { useNavigate } from "@tanstack/react-router";
import { useConvex } from "convex/react";
import {
  addDays,
  differenceInCalendarDays,
  format,
  isSameDay,
  startOfDay,
} from "date-fns";
import { MessageCircle, RefreshCw, Stethoscope, X } from "lucide-react";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { ConversationPanel } from "@/components/track/dr-poo/ConversationPanel";
import { NutritionCard } from "@/components/track/nutrition/NutritionCard";
import { NutritionCardErrorBoundary } from "@/components/track/nutrition/NutritionCardErrorBoundary";
import { type BowelFormState, BowelSection } from "@/components/track/panels";
import { QuickCapture } from "@/components/track/quick-capture";
import { HabitDetailSheet } from "@/components/track/quick-capture/HabitDetailSheet";
import { TodayLog } from "@/components/track/today-log";
import { TodayStatusRow } from "@/components/track/TodayStatusRow";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { useSyncedLogsContext } from "@/contexts/SyncedLogsContext";
import { useAiInsights } from "@/hooks/useAiInsights";
import { useBaselineAverages } from "@/hooks/useBaselineAverages";
import { useDayStats } from "@/hooks/useDayStats";
import { useLiveClock } from "@/hooks/useLiveClock";
import { useNutritionData } from "@/hooks/useNutritionData";
import { useHabits, useUnitSystem } from "@/hooks/useProfile";
import { useQuickCapture } from "@/hooks/useQuickCapture";
import { useTodayLogCrud } from "@/hooks/useTodayLogCrud";
import { useUnresolvedFoodQueue } from "@/hooks/useUnresolvedFoodQueue";
import { useUnresolvedFoodToast } from "@/hooks/useUnresolvedFoodToast";
import { useWeeklySummaryAutoTrigger } from "@/hooks/useWeeklySummaryAutoTrigger";
import { bristolToConsistency, normalizeEpisodesCount } from "@/lib/analysis";
import { formatLocalDateKey, getDateScopedTimestamp } from "@/lib/dateUtils";
import { getErrorMessage } from "@/lib/errors";
import { normalizeFluidItemName } from "@/lib/normalizeFluidName";
import { type MealSlot, titleCase } from "@/lib/nutritionUtils";
import {
  asConvexId,
  useAddSyncedLog,
  useLatestSuccessfulAiAnalysis,
  useRemoveSyncedLog,
  type SyncedLog,
  toSyncedLogs,
} from "@/lib/sync";
import { MS_PER_DAY } from "@/lib/timeConstants";
import { getDisplayWeightUnit } from "@/lib/units";
import { api } from "../../convex/_generated/api";
import { useStore } from "@/store";

// Lazy-loaded so that foodRegistry.ts is code-split
const FoodMatchingModal = lazy(() =>
  import("@/components/track/FoodMatchingModal").then((m) => ({
    default: m.FoodMatchingModal,
  })),
);

// ---------------------------------------------------------------------------
// Constants & types
// ---------------------------------------------------------------------------

type ConversationSeed = { key: string; text: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTimeOfDayGreeting(hour: number): string {
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
}

function getDisplayName(name: string | null | undefined): string {
  const trimmed = name?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "there";
}

function toPreviewText(markdown: string): string {
  return markdown
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#>*_`~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getFallbackDrPooPrompt(activeMealSlot: MealSlot): string {
  const slotLabel = titleCase(activeMealSlot);
  return `Have you logged ${slotLabel.toLowerCase()} yet? Dr. Poo can help you think through what feels safe today.`;
}

function formatDatePillShort(date: Date, today: Date): string {
  if (isSameDay(date, today)) return "TODAY";
  return format(date, "EEE MMM d").toUpperCase();
}

function getFollowUpPrompt(
  activeMealSlot: MealSlot,
  hasInsight: boolean,
): string {
  if (hasInsight) {
    return "Can you explain that summary in more detail and tell me what to watch next?";
  }
  return `Can you help me think about my ${titleCase(activeMealSlot).toLowerCase()} choices today?`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Home page
// ---------------------------------------------------------------------------

export default function HomePage() {
  const { user } = useUser();
  const convex = useConvex();

  // ── Food platform hooks ──
  const { currentMealSlot } = useNutritionData();
  const latestSuccessfulAnalysis = useLatestSuccessfulAiAnalysis();
  const { hasApiKey, sendNow, triggerAnalysis } = useAiInsights();
  const addSyncedLog = useAddSyncedLog();
  const removeSyncedLog = useRemoveSyncedLog();
  const [conversationOpen, setConversationOpen] = useState(false);
  const [conversationSeed, setConversationSeed] =
    useState<ConversationSeed | null>(null);
  const [dismissedCard, setDismissedCard] = useState(false);

  const greeting = getTimeOfDayGreeting(new Date().getHours());
  const firstName = getDisplayName(user?.firstName);
  const latestInsightSummary =
    latestSuccessfulAnalysis?.insight.summary ?? null;

  const proactiveCardText = useMemo(() => {
    const preview = latestInsightSummary
      ? toPreviewText(latestInsightSummary)
      : "";
    if (preview.length > 0) {
      return preview.length > 600
        ? `${preview.slice(0, 597).trimEnd()}...`
        : preview;
    }
    return getFallbackDrPooPrompt(currentMealSlot);
  }, [currentMealSlot, latestInsightSummary]);

  // ── Capture panel hooks ──
  const { logs } = useSyncedLogsContext();
  const { habits } = useHabits();
  const { unitSystem } = useUnitSystem();
  const weightUnit = getDisplayWeightUnit(unitSystem);
  const removeHabitLog = useStore((s) => s.removeHabitLog);
  const habitLogs = useStore((s) => s.habitLogs);
  const pendingEditLogId = useStore((s) => s.pendingEditLogId);
  const setPendingEditLogId = useStore((s) => s.setPendingEditLogId);
  const navigate = useNavigate();

  // Shared CRUD handlers (also used by right-column TodayLog)
  const { handleDelete, handleSave } = useTodayLogCrud(logs);

  // Auto-generate weekly summary when a Sunday 18:00 boundary passes
  useWeeklySummaryAutoTrigger();

  useLiveClock();
  const now = new Date();

  // ── Date state — from Zustand store ──
  const activeDate = useStore((s) => s.activeDate);
  const goBack = useStore((s) => s.goBack);
  const goForward = useStore((s) => s.goForward);
  const goToToday = useStore((s) => s.goToToday);

  const todayStart = useMemo(() => startOfDay(now).getTime(), [now]);
  const todayEnd = todayStart + MS_PER_DAY;
  const todayDate = useMemo(() => startOfDay(now), [now]);
  const dayOffset = useMemo(
    () => differenceInCalendarDays(activeDate, todayDate),
    [activeDate, todayDate],
  );
  const selectedStart = activeDate.getTime();
  const selectedEnd = addDays(activeDate, 1).getTime();

  // ── Time override for Quick Capture / Nutrition ──
  // When set (e.g. "22:00"), logs use activeDate + this time instead of now.
  const [captureTimeOverride, setCaptureTimeOverride] = useState("");

  const selectedCaptureTimestamp = useMemo(() => {
    if (captureTimeOverride) {
      const [h, m] = captureTimeOverride.split(":").map(Number);
      if (Number.isFinite(h) && Number.isFinite(m)) {
        const d = new Date(activeDate);
        return new Date(
          d.getFullYear(),
          d.getMonth(),
          d.getDate(),
          h,
          m,
          0,
          0,
        ).getTime();
      }
    }
    return dayOffset === 0
      ? undefined
      : getDateScopedTimestamp(activeDate, now);
  }, [captureTimeOverride, dayOffset, now, activeDate]);

  // Day statistics (actual today + selected day)
  const { todayHabitCounts, todayFluidTotalsByName, totalFluidMl } =
    useDayStats({
      logs,
      todayStart,
      todayEnd,
    });
  const {
    todayHabitCounts: selectedHabitCounts,
    todayFluidTotalsByName: selectedFluidTotalsByName,
    totalFluidMl: totalFluidMlForSelected,
  } = useDayStats({ logs, todayStart: selectedStart, todayEnd: selectedEnd });

  // Destructive habit rollover toast (once per day)
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
        habit.kind === "destructive" &&
        typeof habit.dailyCap === "number" &&
        habit.dailyCap > 0,
    );

    if (destructiveHabits.length === 0) return;

    let underCapCount = 0;
    let zeroUseCount = 0;

    for (const habit of destructiveHabits) {
      const total = habitLogs
        .filter(
          (entry) =>
            entry.habitId === habit.id &&
            entry.at >= yesterdayStart &&
            entry.at < yesterdayEnd,
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
      toast.success(message);
      return;
    }

    if (underCapCount > 0) {
      toast.success(
        underCapCount === 1
          ? "Yesterday: you stayed under a destructive cap. Keep that momentum."
          : `Yesterday: you stayed under ${underCapCount} destructive caps. Keep that momentum.`,
      );
    }
  }, [habits, habitLogs, todayStart]);

  // Baseline averages (side-effect-only: caches in Zustand store)
  useBaselineAverages({
    logs,
    todayHabitCounts,
    todayFluidTotalsByName,
    todayTotalFluidMl: totalFluidMl,
  });

  // Unresolved food queue + persistent toast
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
      toast.error(
        getErrorMessage(
          err,
          "Unable to load unresolved items. Check connection.",
        ),
      );
    }
  }, [unresolvedQueue]);
  useUnresolvedFoodToast(logs, now.getTime(), handleReviewUnresolved);

  const afterSave = useCallback(() => {}, []);

  // Cross-page edit: on desktop right column is visible, no navigation needed
  const handleRequestEdit = useCallback(
    (logId: string) => {
      setPendingEditLogId(logId);
      // On desktop (lg: ≥ 1024px), right column TodayLog is visible
      if (window.innerWidth < 1024) {
        void navigate({ to: "/track" });
      }
    },
    [navigate, setPendingEditLogId],
  );

  // Quick capture handlers
  const {
    handleQuickCaptureTap,
    handleLogSleepQuickCapture,
    handleLogActivityQuickCapture,
    handleLogWeightKg,
    handleQuickCaptureLongPress,
    handleCloseDetailSheet,
    detailSheetHabit,
  } = useQuickCapture({
    afterSave,
    todayHabitCounts: selectedHabitCounts,
    todayFluidTotalsByName: selectedFluidTotalsByName,
    logs,
    todayStart: selectedStart,
    todayEnd: selectedEnd,
    removeSyncedLog,
    removeHabitLog,
    onRequestEdit: handleRequestEdit,
    ...(selectedCaptureTimestamp !== undefined && {
      captureTimestamp: selectedCaptureTimestamp,
    }),
    captureStart: selectedStart,
    captureEnd: selectedEnd,
    captureOffset: dayOffset,
  });

  // Auto-edit state for right-column TodayLog
  const [autoEditLogId, setAutoEditLogId] = useState<string | null>(null);
  useEffect(() => {
    if (pendingEditLogId === null) return;
    // Only consume on desktop (mobile navigates to Track instead)
    if (window.innerWidth >= 1024) {
      setAutoEditLogId(pendingEditLogId);
      setPendingEditLogId(null);
    }
  }, [pendingEditLogId, setPendingEditLogId]);

  const handleAutoEditHandled = useCallback(() => {
    setAutoEditLogId(null);
  }, []);

  const handleLogBowel = async (bowelState: BowelFormState) => {
    const consistencyTag = bristolToConsistency(bowelState.bristolCode);
    const timestamp = bowelState.timestampMs ?? Date.now();
    await addSyncedLog({
      timestamp,
      type: "digestion",
      data: {
        episodesCount: normalizeEpisodesCount(bowelState.episodesCount),
        windowMinutes: 30,
        urgencyTag: bowelState.urgencyTag,
        effortTag: bowelState.effortTag,
        consistencyTag,
        volumeTag: bowelState.volumeTag,
        bristolCode: bowelState.bristolCode,
        accident: bowelState.accident,
        notes: bowelState.notes.trim(),
      },
    });
    afterSave();
    void triggerAnalysis({
      bristolScore: bowelState.bristolCode,
      autoSendEnabled: true,
      digestionTimestamp: timestamp,
    });
  };

  const openConversation = useCallback((text?: string) => {
    setConversationSeed(
      text
        ? {
            key: `${Date.now()}`,
            text,
          }
        : null,
    );
    setConversationOpen(true);
  }, []);

  // ── Right column data ──
  const [selectedLogs, setSelectedLogs] = useState<SyncedLog[]>([]);
  const [selectedLogsLoading, setSelectedLogsLoading] = useState(true);
  const [selectedLogsError, setSelectedLogsError] = useState<string | null>(
    null,
  );
  const selectedLogsRequestIdRef = useRef(0);

  const loadSelectedLogs = useCallback(async () => {
    const requestId = ++selectedLogsRequestIdRef.current;
    setSelectedLogsLoading(true);
    setSelectedLogsError(null);

    try {
      const rows = await convex.query(api.logs.listByRange, {
        startMs: selectedStart,
        endMs: selectedEnd,
        limit: 500,
      });
      if (requestId !== selectedLogsRequestIdRef.current) return;
      setSelectedLogs(toSyncedLogs(rows));
    } catch (error) {
      if (requestId !== selectedLogsRequestIdRef.current) return;
      setSelectedLogsError(
        getErrorMessage(error, "Failed to refresh this day."),
      );
    } finally {
      if (requestId === selectedLogsRequestIdRef.current) {
        setSelectedLogsLoading(false);
      }
    }
  }, [convex, selectedEnd, selectedStart]);

  useEffect(() => {
    void loadSelectedLogs();
  }, [loadSelectedLogs]);

  const bmCount = useMemo(
    () => selectedLogs.filter((l) => l.type === "digestion").length,
    [selectedLogs],
  );

  const waterOnlyMl = selectedFluidTotalsByName["water"] ?? 0;

  const lastBmTimestamp = useMemo(() => {
    const bms = selectedLogs
      .filter((l) => l.type === "digestion")
      .sort((a, b) => b.timestamp - a.timestamp);
    return bms[0]?.timestamp ?? null;
  }, [selectedLogs]);

  // ── Render ──

  const canMoveForward = dayOffset < 0;

  const handleDesktopLogDelete = useCallback(
    async (id: string) => {
      await handleDelete(id);
      await loadSelectedLogs();
    },
    [handleDelete, loadSelectedLogs],
  );

  const handleDesktopLogSave = useCallback(
    async (
      id: string,
      data: Parameters<typeof handleSave>[1],
      timestamp?: number,
    ) => {
      await handleSave(id, data, timestamp);
      await loadSelectedLogs();
    },
    [handleSave, loadSelectedLogs],
  );

  return (
    <>
      {/* ── Shared top row: date strip (left) + status bar (right) ── */}
      <div className="lg:grid lg:grid-cols-2 lg:items-center lg:gap-6 mb-4">
        {/* Date strip */}
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={goBack}
            aria-label="Go to previous day"
            className="rounded-full px-3 py-1.5 font-sketch text-sm font-semibold text-(--text-faint) transition-colors hover:text-(--text-muted)"
          >
            {formatDatePillShort(addDays(activeDate, -1), todayDate)}
          </button>

          <div className="relative flex flex-col items-center gap-1 px-4 py-2">
            <span
              className="font-sketch text-base font-bold text-teal-400 underline underline-offset-4 decoration-teal-500/70 decoration-2"
              aria-current="date"
            >
              {formatDatePillShort(activeDate, todayDate)}
            </span>
          </div>

          {canMoveForward ? (
            <button
              type="button"
              onClick={dayOffset === -1 ? goToToday : goForward}
              aria-label="Go to next day"
              className="rounded-full px-3 py-1.5 font-sketch text-sm font-semibold text-(--text-faint) transition-colors hover:text-(--text-muted)"
            >
              {formatDatePillShort(addDays(activeDate, 1), todayDate)}
            </button>
          ) : (
            <span className="invisible rounded-full px-3 py-1.5 font-sketch text-sm font-semibold">
              Fri
            </span>
          )}
        </div>
        {/* Status bar — hidden on mobile, shown on desktop */}
        <div className="hidden lg:block">
          <TodayStatusRow
            bmCount={bmCount}
            fluidTotalMl={totalFluidMlForSelected}
            waterOnlyMl={waterOnlyMl}
            lastBmTimestamp={lastBmTimestamp}
            nowMs={now.getTime()}
            isCurrentDay={dayOffset === 0}
          />
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
        {/* ── Left column ── */}
        <div className="space-y-4">
          {/* ── Greeting row ── */}
          <div className="glass-card glass-card-greeting rounded-2xl p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-sketch text-xl font-bold text-sky-300/70">
                  {greeting},
                </p>
                <p className="font-sketch text-xl font-bold text-sky-300/70">
                  {firstName}
                </p>
              </div>
              {hasApiKey ? (
                <button
                  type="button"
                  onClick={() => openConversation()}
                  className="inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-500/15 px-4 py-2 font-sketch text-xs font-semibold text-sky-300 transition-colors hover:bg-sky-500/25"
                >
                  <Stethoscope className="h-4 w-4" />
                  Ask Dr Poo
                </button>
              ) : null}
            </div>
          </div>

          {/* ── Nutrition ── */}
          <NutritionCardErrorBoundary>
            <NutritionCard
              selectedDate={activeDate}
              {...(selectedCaptureTimestamp !== undefined && {
                captureTimestamp: selectedCaptureTimestamp,
              })}
              captureTimeOverride={captureTimeOverride}
              onCaptureTimeChange={setCaptureTimeOverride}
            />
          </NutritionCardErrorBoundary>

          {/* ── Quick Capture ── */}
          <QuickCapture
            habits={habits}
            todayHabitCounts={selectedHabitCounts}
            todayFluidMl={selectedFluidTotalsByName}
            onTap={handleQuickCaptureTap}
            onLogSleepHours={handleLogSleepQuickCapture}
            onLogActivityMinutes={handleLogActivityQuickCapture}
            onLogWeightKg={handleLogWeightKg}
            onLongPress={handleQuickCaptureLongPress}
          />

          {/* ── Bowel Movement ── */}
          <ErrorBoundary label="Bowel Movement">
            <BowelSection
              onSave={handleLogBowel}
              {...(selectedCaptureTimestamp !== undefined && {
                captureTimestamp: selectedCaptureTimestamp,
              })}
            />
          </ErrorBoundary>

          {/* ── Dr. Poo proactive card ── */}
          {hasApiKey && !dismissedCard ? (
            <section className="glass-card glass-card-drpoo rounded-2xl p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Stethoscope
                    className="h-5 w-5 shrink-0"
                    style={{ color: "var(--section-drpoo)" }}
                  />
                  <p
                    className="font-sketch text-[0.7rem] font-bold uppercase tracking-[0.1em]"
                    style={{ color: "var(--section-drpoo)" }}
                  >
                    Dr Poo Says
                  </p>
                </div>
                <MessageCircle
                  className="h-5 w-5 shrink-0 opacity-50"
                  style={{ color: "var(--section-drpoo)" }}
                />
              </div>
              <p className="mt-3 text-sm leading-relaxed text-[rgba(240,248,255,0.8)]">
                {proactiveCardText}
              </p>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setDismissedCard(true)}
                  className="rounded-full border border-[var(--section-drpoo-border)] px-3 py-1.5 font-sketch text-xs font-semibold uppercase tracking-wide transition-colors hover:bg-[var(--section-drpoo-muted)]"
                  style={{ color: "var(--section-drpoo)" }}
                >
                  Got It
                </button>
                <button
                  type="button"
                  onClick={() =>
                    openConversation(
                      getFollowUpPrompt(
                        currentMealSlot,
                        latestInsightSummary !== null,
                      ),
                    )
                  }
                  className="rounded-full border border-[var(--section-drpoo-border)] bg-[var(--section-drpoo-muted)] px-3 py-1.5 font-sketch text-xs font-semibold uppercase tracking-wide transition-opacity hover:opacity-90"
                  style={{ color: "var(--section-drpoo)" }}
                >
                  Ask More
                </button>
              </div>
            </section>
          ) : null}
        </div>

        {/* ── Right column — desktop only ── */}
        <div className="hidden lg:block space-y-3">
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => void loadSelectedLogs()}
              disabled={selectedLogsLoading}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--section-log)]/20 bg-[var(--surface-1)] px-3 py-1.5 text-xs font-semibold text-[var(--section-log)] transition-colors hover:bg-[var(--surface-2)] disabled:opacity-60"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${selectedLogsLoading ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              <span>Refresh</span>
            </button>
          </div>
          {selectedLogsError && (
            <p className="text-sm text-rose-500">{selectedLogsError}</p>
          )}
          <TodayLog
            title="LOGS"
            logs={selectedLogs}
            habits={habits}
            weightUnit={weightUnit}
            constrainHeight={false}
            selectedDate={activeDate}
            dayOffset={dayOffset}
            onPreviousDay={goBack}
            onNextDay={goForward}
            onJumpToToday={goToToday}
            onDelete={handleDesktopLogDelete}
            onSave={handleDesktopLogSave}
            autoEditId={autoEditLogId}
            onAutoEditHandled={handleAutoEditHandled}
          />
        </div>
      </div>

      {/* ── Modals & overlays ── */}

      <Dialog.Root open={conversationOpen} onOpenChange={setConversationOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm" />
          <Dialog.Popup className="fixed inset-x-4 top-1/2 z-50 mx-auto w-full max-w-2xl -translate-y-1/2 rounded-3xl border border-[var(--section-log)]/20 bg-[var(--card)] p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <Dialog.Title className="font-sketch text-xl font-bold text-(--text)">
                  Dr. Poo
                </Dialog.Title>
                <p className="text-sm text-(--text-muted)">
                  Ask a question or continue the current conversation.
                </p>
              </div>
              <Dialog.Close className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border-default)] text-(--text-muted) transition-colors hover:text-(--text)">
                <X className="h-4 w-4" />
              </Dialog.Close>
            </div>

            <ConversationPanel
              onSendNow={sendNow}
              {...(conversationSeed?.text
                ? { initialReplyText: conversationSeed.text }
                : {})}
              {...(conversationSeed?.key
                ? { initialReplyKey: conversationSeed.key }
                : {})}
            />
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

      <HabitDetailSheet
        habit={detailSheetHabit}
        count={
          detailSheetHabit ? (selectedHabitCounts[detailSheetHabit.id] ?? 0) : 0
        }
        {...(detailSheetHabit?.logAs === "fluid" && {
          fluidMl:
            selectedFluidTotalsByName[
              normalizeFluidItemName(detailSheetHabit.name)
            ],
        })}
        onClose={handleCloseDetailSheet}
      />

      <Suspense fallback={null}>
        <FoodMatchingModal
          queue={unresolvedQueue}
          open={reviewQueueOpen}
          onOpenChange={setReviewQueueOpen}
        />
      </Suspense>
    </>
  );
}
