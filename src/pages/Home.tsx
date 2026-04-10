import { Dialog } from "@base-ui/react/dialog";
import { useUser } from "@clerk/clerk-react";
import { useNavigate } from "@tanstack/react-router";
import {
  addDays,
  differenceInCalendarDays,
  format,
  startOfDay,
} from "date-fns";
import { MessageCircle, X } from "lucide-react";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";

import { ConversationPanel } from "@/components/track/dr-poo/ConversationPanel";
import { NutritionCard } from "@/components/track/nutrition/NutritionCard";
import { NutritionCardErrorBoundary } from "@/components/track/nutrition/NutritionCardErrorBoundary";
import { type BowelFormState, BowelSection } from "@/components/track/panels";
import { QuickCapture } from "@/components/track/quick-capture";
import { HabitDetailSheet } from "@/components/track/quick-capture/HabitDetailSheet";
import { ConfettiBurst } from "@/components/ui/Confetti";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { useSyncedLogsContext } from "@/contexts/SyncedLogsContext";
import { useAiInsights } from "@/hooks/useAiInsights";
import { useBaselineAverages } from "@/hooks/useBaselineAverages";
import { useCelebration } from "@/hooks/useCelebration";
import { useDayStats } from "@/hooks/useDayStats";
import { useFoodLlmMatching } from "@/hooks/useFoodLlmMatching";
import { useHabitStreaks } from "@/hooks/useHabitStreaks";
import { useLiveClock } from "@/hooks/useLiveClock";
import { useNutritionData } from "@/hooks/useNutritionData";
import { useHabits } from "@/hooks/useProfile";
import { useQuickCapture } from "@/hooks/useQuickCapture";
import { useUnresolvedFoodQueue } from "@/hooks/useUnresolvedFoodQueue";
import { useUnresolvedFoodToast } from "@/hooks/useUnresolvedFoodToast";
import { useWeeklySummaryAutoTrigger } from "@/hooks/useWeeklySummaryAutoTrigger";
import { bristolToConsistency, normalizeEpisodesCount } from "@/lib/analysis";
import { formatLocalDateKey, getDateScopedTimestamp } from "@/lib/dateUtils";
import { getErrorMessage } from "@/lib/errors";
import { normalizeFluidItemName } from "@/lib/normalizeFluidName";
import { type MealSlot, titleCase } from "@/lib/nutritionUtils";
import {
  useAddSyncedLog,
  useLatestSuccessfulAiAnalysis,
  useRemoveSyncedLog,
} from "@/lib/sync";
import { MS_PER_DAY } from "@/lib/timeConstants";
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
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
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

function getDayLabel(date: Date, todayDate: Date): string {
  const offset = differenceInCalendarDays(date, todayDate);
  if (offset === 0) return "Today";
  return format(date, "EEE, MMM d");
}

function getPrevDayLabel(selectedDate: Date, todayDate: Date): string {
  const offset = differenceInCalendarDays(selectedDate, todayDate);
  if (offset === 0) return "Yesterday";
  return format(addDays(selectedDate, -1), "EEEE");
}

function getNextDayLabel(selectedDate: Date, todayDate: Date): string {
  const offset = differenceInCalendarDays(selectedDate, todayDate);
  if (offset === -1) return "Today";
  return format(addDays(selectedDate, 1), "EEEE");
}

// ---------------------------------------------------------------------------
// Home page
// ---------------------------------------------------------------------------

export default function HomePage() {
  const { user } = useUser();

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
      return preview.length > 150
        ? `${preview.slice(0, 147).trimEnd()}...`
        : preview;
    }
    return getFallbackDrPooPrompt(currentMealSlot);
  }, [currentMealSlot, latestInsightSummary]);

  useEffect(() => {
    setDismissedCard(false);
  }, []);

  // ── Capture panel hooks (moved from Track) ──
  const { logs } = useSyncedLogsContext();
  const { habits } = useHabits();
  const removeHabitLog = useStore((s) => s.removeHabitLog);
  const habitLogs = useStore((s) => s.habitLogs);
  const setPendingEditLogId = useStore((s) => s.setPendingEditLogId);
  const navigate = useNavigate();

  // Auto-generate weekly summary when a Sunday 18:00 boundary passes
  useWeeklySummaryAutoTrigger();

  // Auto-trigger LLM matching for food logs with unresolved items
  useFoodLlmMatching();

  const { celebration, celebrateLog, celebrateGoalComplete, clearCelebration } =
    useCelebration();

  useLiveClock();
  const now = new Date();
  const [selectedDate, setSelectedDate] = useState(() =>
    startOfDay(new Date()),
  );

  const todayStart = useMemo(() => startOfDay(now).getTime(), [now]);
  const todayEnd = todayStart + MS_PER_DAY;
  const todayDate = useMemo(() => startOfDay(now), [now]);
  const dayOffset = useMemo(
    () => differenceInCalendarDays(selectedDate, todayDate),
    [selectedDate, todayDate],
  );
  const selectedStart = selectedDate.getTime();
  const selectedEnd = addDays(selectedDate, 1).getTime();
  const selectedCaptureTimestamp = useMemo(
    () =>
      dayOffset === 0 ? undefined : getDateScopedTimestamp(selectedDate, now),
    [dayOffset, now, selectedDate],
  );

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

  const afterSave = useCallback(() => {
    celebrateLog();
  }, [celebrateLog]);

  // Cross-page edit: navigate to Track with pending edit ID in Zustand store
  const handleRequestEdit = useCallback(
    (logId: string) => {
      setPendingEditLogId(logId);
      void navigate({ to: "/track" });
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
    celebrateGoalComplete,
    todayHabitCounts: selectedHabitCounts,
    todayFluidTotalsByName: selectedFluidTotalsByName,
    streakSummaries,
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

  const detailDaySummaries = useMemo(
    () =>
      detailSheetHabit
        ? daySummaries.filter(
            (summary) => summary.habitId === detailSheetHabit.id,
          )
        : [],
    [daySummaries, detailSheetHabit],
  );

  const _handleSelectDate = useCallback(
    (date: Date) => {
      const normalized = startOfDay(date);
      setSelectedDate(
        normalized.getTime() > todayDate.getTime() ? todayDate : normalized,
      );
    },
    [todayDate],
  );
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

  // ── Render ──

  const canMoveForward = dayOffset < 0;

  return (
    <div className="space-y-5">
      {/* ── Greeting row ── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-display text-2xl font-bold text-(--text)">
            {greeting},
          </p>
          <p className="font-display text-2xl font-bold text-(--text)">
            {firstName}
          </p>
        </div>
        {hasApiKey ? (
          <button
            type="button"
            onClick={() => openConversation()}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--section-log)]/35 bg-[var(--section-log-muted)] px-4 py-2 text-sm font-semibold text-[var(--section-log)] transition-colors hover:bg-[var(--section-log)]/15"
          >
            <MessageCircle className="h-4 w-4" />
            Ask Dr. Poo
          </button>
        ) : null}
      </div>

      {/* ── Date strip ── */}
      <div className="flex items-center justify-center gap-6">
        <button
          type="button"
          onClick={handlePreviousDay}
          aria-label="Go to previous day"
          className="font-sketch text-base font-semibold uppercase tracking-wide text-(--text-faint) transition-colors hover:text-(--text-muted)"
        >
          {getPrevDayLabel(selectedDate, todayDate)}
        </button>

        <div className="relative flex flex-col items-center gap-1">
          <span
            className="font-sketch text-lg font-bold uppercase tracking-wide text-teal-400"
            aria-current="date"
          >
            {getDayLabel(selectedDate, todayDate)}
          </span>
          <span
            className="h-0.5 w-full rounded-full bg-teal-500/70"
            aria-hidden="true"
          />
        </div>

        {canMoveForward ? (
          <button
            type="button"
            onClick={dayOffset === -1 ? handleJumpToToday : handleNextDay}
            aria-label="Go to next day"
            className="font-sketch text-base font-semibold uppercase tracking-wide text-(--text-faint) transition-colors hover:text-(--text-muted)"
          >
            {getNextDayLabel(selectedDate, todayDate)}
          </button>
        ) : (
          <span className="invisible font-sketch text-base font-semibold uppercase">
            Yesterday
          </span>
        )}
      </div>

      {/* ── Bowel Movement ── */}
      <ErrorBoundary label="Bowel Movement">
        <BowelSection
          onSave={handleLogBowel}
          {...(selectedCaptureTimestamp !== undefined && {
            captureTimestamp: selectedCaptureTimestamp,
          })}
        />
      </ErrorBoundary>

      {/* ── Nutrition ── */}
      <NutritionCardErrorBoundary>
        <NutritionCard
          selectedDate={selectedDate}
          {...(selectedCaptureTimestamp !== undefined && {
            captureTimestamp: selectedCaptureTimestamp,
          })}
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

      {/* ── Dr. Poo proactive card ── */}
      {hasApiKey && !dismissedCard ? (
        <section className="glass-card space-y-3 border border-[var(--section-log)]/20 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--section-log)]">
                Dr. Poo
              </p>
              <p className="text-sm text-(--text-muted)">{proactiveCardText}</p>
            </div>
            <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--section-log)]" />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setDismissedCard(true)}
              className="rounded-full border border-[var(--color-border-default)] px-3 py-1.5 text-sm font-medium text-(--text-muted) transition-colors hover:text-(--text)"
            >
              Got it
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
              className="rounded-full bg-[var(--section-log)] px-3 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              Chat with Dr. Poo
            </button>
          </div>
        </section>
      ) : null}

      {/* ── Modals & overlays ── */}

      <Dialog.Root open={conversationOpen} onOpenChange={setConversationOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm" />
          <Dialog.Popup className="fixed inset-x-4 top-1/2 z-50 mx-auto w-full max-w-2xl -translate-y-1/2 rounded-3xl border border-[var(--section-log)]/20 bg-[var(--card)] p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <Dialog.Title className="font-display text-xl font-bold text-(--text)">
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
        count={
          detailSheetHabit ? (selectedHabitCounts[detailSheetHabit.id] ?? 0) : 0
        }
        {...(detailSheetHabit?.logAs === "fluid" && {
          fluidMl:
            selectedFluidTotalsByName[
              normalizeFluidItemName(detailSheetHabit.name)
            ],
        })}
        daySummaries={detailDaySummaries}
        streakSummary={
          detailSheetHabit
            ? (streakSummaries[detailSheetHabit.id] ?? null)
            : null
        }
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
