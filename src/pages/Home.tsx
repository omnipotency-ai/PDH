import { Dialog } from "@base-ui/react/dialog";
import { useUser } from "@clerk/clerk-react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { addDays, differenceInCalendarDays, format, startOfDay } from "date-fns";
import { MessageCircle, X } from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ConversationPanel } from "@/components/track/dr-poo/ConversationPanel";
import { LogFoodModal } from "@/components/track/nutrition/LogFoodModal";
import { NutritionCard } from "@/components/track/nutrition/NutritionCard";
import { NutritionCardErrorBoundary } from "@/components/track/nutrition/NutritionCardErrorBoundary";
import { buildStagedNutritionLogData } from "@/components/track/nutrition/nutritionLogging";
import { useNutritionStore } from "@/components/track/nutrition/useNutritionStore";
import { type BowelFormState, BowelSection } from "@/components/track/panels";
import { QuickCapture } from "@/components/track/quick-capture";
import { HabitDetailSheet } from "@/components/track/quick-capture/HabitDetailSheet";
import { TodayStatusRow } from "@/components/track/TodayStatusRow";
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
import { useFoodFavourites, useHabits } from "@/hooks/useProfile";
import { useQuickCapture } from "@/hooks/useQuickCapture";
import { useSlotScopedFoods } from "@/hooks/useSlotScopedFoods";
import { useUnresolvedFoodQueue } from "@/hooks/useUnresolvedFoodQueue";
import { useUnresolvedFoodToast } from "@/hooks/useUnresolvedFoodToast";
import { useWeeklySummaryAutoTrigger } from "@/hooks/useWeeklySummaryAutoTrigger";
import { bristolToConsistency, normalizeEpisodesCount } from "@/lib/analysis";
import { formatLocalDateKey, getDateScopedTimestamp } from "@/lib/dateUtils";
import { getErrorMessage } from "@/lib/errors";
import { normalizeFluidItemName } from "@/lib/normalizeFluidName";
import { type MealSlot, titleCase } from "@/lib/nutritionUtils";
import { useAddSyncedLog, useLatestSuccessfulAiAnalysis, useRemoveSyncedLog } from "@/lib/sync";
import { MS_PER_DAY } from "@/lib/timeConstants";
import { useStore } from "@/store";
import { api } from "../../convex/_generated/api";

// Lazy-loaded so that foodRegistry.ts is code-split
const FoodMatchingModal = lazy(() =>
  import("@/components/track/FoodMatchingModal").then((m) => ({
    default: m.FoodMatchingModal,
  })),
);

// ---------------------------------------------------------------------------
// Constants & types
// ---------------------------------------------------------------------------

const MEAL_SLOT_OPTIONS: ReadonlyArray<{ slot: MealSlot; label: string }> = [
  { slot: "breakfast", label: "Breakfast" },
  { slot: "lunch", label: "Lunch" },
  { slot: "dinner", label: "Dinner" },
  { slot: "snack", label: "Snack" },
];

type FavouriteSlotTags = Partial<Record<string, MealSlot[]>>;
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

function getFollowUpPrompt(activeMealSlot: MealSlot, hasInsight: boolean): string {
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
  const { favourites } = useFoodFavourites();
  const favouriteSlotTags = (useQuery(api.profiles.getFavouriteSlotTags, {}) ??
    {}) as FavouriteSlotTags;
  const addSyncedLog = useAddSyncedLog();
  const removeSyncedLog = useRemoveSyncedLog();
  const { state, dispatch, stagingTotals } = useNutritionStore();
  const [slotOverride, setSlotOverride] = useState<MealSlot | null>(null);
  const [conversationOpen, setConversationOpen] = useState(false);
  const [conversationSeed, setConversationSeed] = useState<ConversationSeed | null>(null);
  const [dismissedCard, setDismissedCard] = useState(false);

  const activeMealSlot = slotOverride ?? currentMealSlot;
  const { recentFoods, frequentFoods } = useSlotScopedFoods(activeMealSlot);
  const greeting = getTimeOfDayGreeting(new Date().getHours());
  const firstName = getDisplayName(user?.firstName);
  const latestInsightSummary = latestSuccessfulAnalysis?.insight.summary ?? null;

  const proactiveCardText = useMemo(() => {
    const preview = latestInsightSummary ? toPreviewText(latestInsightSummary) : "";
    if (preview.length > 0) {
      return preview.length > 150 ? `${preview.slice(0, 147).trimEnd()}...` : preview;
    }
    return getFallbackDrPooPrompt(activeMealSlot);
  }, [activeMealSlot, latestInsightSummary]);

  useEffect(() => {
    if (state.activeMealSlot === activeMealSlot) return;
    dispatch({ type: "SET_ACTIVE_MEAL_SLOT", slot: activeMealSlot });
  }, [activeMealSlot, dispatch, state.activeMealSlot]);

  useEffect(() => {
    setDismissedCard(false);
  }, []);

  // Spotlight foods (favourites + frequent + recent, scoped to active meal slot)
  const slotScopedFavourites = useMemo(
    () =>
      favourites.filter((canonicalName) =>
        (favouriteSlotTags[canonicalName] ?? []).includes(activeMealSlot),
      ),
    [activeMealSlot, favouriteSlotTags, favourites],
  );

  const visibleRecentFoods = useMemo(() => recentFoods.slice(0, 7), [recentFoods]);
  const visibleFrequentFoods = useMemo(() => frequentFoods.slice(0, 7), [frequentFoods]);

  const spotlightFoods = useMemo(() => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const canonicalName of [
      ...slotScopedFavourites,
      ...visibleFrequentFoods,
      ...visibleRecentFoods,
    ]) {
      if (seen.has(canonicalName)) continue;
      seen.add(canonicalName);
      ordered.push(canonicalName);
    }
    return ordered.slice(0, 12);
  }, [slotScopedFavourites, visibleFrequentFoods, visibleRecentFoods]);

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

  const { celebration, celebrateLog, celebrateGoalComplete, clearCelebration } = useCelebration();

  useLiveClock();
  const now = new Date();
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));

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
    () => (dayOffset === 0 ? undefined : getDateScopedTimestamp(selectedDate, now)),
    [dayOffset, now, selectedDate],
  );

  // Day statistics (actual today + selected day)
  const {
    todayHabitCounts,
    todayFluidTotalsByName,
    totalFluidMl,
    waterOnlyMl,
    todayBmCount,
    lastBmTimestamp,
  } = useDayStats({ logs, todayStart, todayEnd });
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

  const { daySummaries, streakSummaries } = useHabitStreaks({ habitLogs, habits, now });

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
      toast.error(getErrorMessage(err, "Unable to load unresolved items. Check connection."));
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
        ? daySummaries.filter((summary) => summary.habitId === detailSheetHabit.id)
        : [],
    [daySummaries, detailSheetHabit],
  );

  const _handleSelectDate = useCallback(
    (date: Date) => {
      const normalized = startOfDay(date);
      setSelectedDate(normalized.getTime() > todayDate.getTime() ? todayDate : normalized);
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
  const handleJumpToToday = useCallback(() => setSelectedDate(todayDate), [todayDate]);

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

  // ── Food platform handlers ──

  const handleAddAndReview = useCallback(
    (canonicalName: string) => {
      dispatch({ type: "ADD_TO_STAGING", canonicalName });
      dispatch({ type: "OPEN_STAGING_MODAL" });
    },
    [dispatch],
  );

  const handleUpdateStagedQuantity = useCallback(
    (id: string, newQuantity: number) => {
      const item = state.stagingItems.find((entry) => entry.id === id);
      if (!item) return;

      dispatch({
        type: "ADJUST_STAGING_PORTION",
        id,
        delta: newQuantity - item.portionG,
      });
    },
    [dispatch, state.stagingItems],
  );

  const handleLogStagedFood = useCallback(async () => {
    try {
      const data = buildStagedNutritionLogData(state.stagingItems, activeMealSlot);
      await addSyncedLog({
        timestamp: Date.now(),
        type: "food",
        data,
      });
      toast(`${state.stagingItems.length} item(s) logged`);
      dispatch({ type: "RESET_AFTER_LOG" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to log food";
      toast.error(message);
    }
  }, [activeMealSlot, addSyncedLog, dispatch, state.stagingItems]);

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
          <p className="font-display text-2xl font-bold text-(--text)">{greeting},</p>
          <p className="font-display text-2xl font-bold text-(--text)">{firstName}</p>
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
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={handlePreviousDay}
          aria-label="Go to previous day"
          className="text-xs font-medium text-(--text-muted) transition-colors hover:text-(--text)"
        >
          {getPrevDayLabel(selectedDate, todayDate)}
        </button>
        <span
          className="rounded-full border px-3 py-1 text-xs font-semibold"
          style={{
            backgroundColor: "color-mix(in srgb, var(--orange) 10%, var(--color-bg-elevated) 90%)",
            borderColor: "color-mix(in srgb, var(--orange) 28%, transparent)",
            color: "color-mix(in srgb, var(--orange) 82%, var(--color-text-primary) 18%)",
          }}
        >
          {getDayLabel(selectedDate, todayDate)}
        </span>
        {canMoveForward && (
          <button
            type="button"
            onClick={dayOffset === -1 ? handleJumpToToday : handleNextDay}
            aria-label="Go to next day"
            className="text-xs font-medium text-(--text-muted) transition-colors hover:text-(--text)"
          >
            {getNextDayLabel(selectedDate, todayDate)}
          </button>
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
                openConversation(getFollowUpPrompt(activeMealSlot, latestInsightSummary !== null))
              }
              className="rounded-full bg-[var(--section-log)] px-3 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              Chat with Dr. Poo
            </button>
          </div>
        </section>
      ) : null}

      {/* ── Parked sections (not final placement) ── */}
      <section className="space-y-4 opacity-60">
        <TodayStatusRow
          bmCount={todayBmCount}
          fluidTotalMl={totalFluidMl}
          waterOnlyMl={waterOnlyMl}
          lastBmTimestamp={lastBmTimestamp}
          nowMs={now.getTime()}
        />

        <div className="glass-card space-y-4 p-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-(--text-faint)">
              Meal slot
            </p>
            <div className="flex flex-wrap gap-2">
              {MEAL_SLOT_OPTIONS.map(({ slot, label }) => {
                const isActive = slot === activeMealSlot;
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setSlotOverride(slot)}
                    className="rounded-full border px-3 py-1.5 text-sm font-medium transition-colors"
                    style={{
                      borderColor: isActive ? "var(--orange)" : "var(--color-border-default)",
                      backgroundColor: isActive
                        ? "color-mix(in srgb, var(--orange) 16%, transparent)"
                        : "transparent",
                      color: isActive ? "var(--orange)" : "var(--text-muted)",
                    }}
                    aria-pressed={isActive}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {spotlightFoods.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-(--text-faint)">
                Quick picks
              </p>
              <div className="flex flex-wrap gap-2">
                {spotlightFoods.map((canonicalName) => (
                  <button
                    key={`chip-${canonicalName}`}
                    type="button"
                    onClick={() => handleAddAndReview(canonicalName)}
                    className="rounded-full border border-[var(--color-border-default)] bg-[var(--surface-2)] px-3 py-1.5 text-sm font-medium text-(--text) transition-colors hover:border-[var(--orange)] hover:text-[var(--orange)]"
                  >
                    {titleCase(canonicalName)}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {/* ── Modals & overlays ── */}

      <LogFoodModal
        open={state.stagingModalOpen}
        stagedItems={state.stagingItems}
        stagingTotals={stagingTotals}
        onClose={() => dispatch({ type: "CLOSE_STAGING_MODAL" })}
        onRemoveItem={(id) => dispatch({ type: "REMOVE_FROM_STAGING", id })}
        onUpdateQuantity={handleUpdateStagedQuantity}
        onClearAll={() => dispatch({ type: "CLEAR_STAGING" })}
        onLogFood={handleLogStagedFood}
        onAddMore={() => dispatch({ type: "CLOSE_STAGING_MODAL" })}
      />

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
              {...(conversationSeed?.text ? { initialReplyText: conversationSeed.text } : {})}
              {...(conversationSeed?.key ? { initialReplyKey: conversationSeed.key } : {})}
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
        count={detailSheetHabit ? (selectedHabitCounts[detailSheetHabit.id] ?? 0) : 0}
        {...(detailSheetHabit?.logAs === "fluid" && {
          fluidMl: selectedFluidTotalsByName[normalizeFluidItemName(detailSheetHabit.name)],
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
