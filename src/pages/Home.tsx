import { Dialog } from "@base-ui/react/dialog";
import { useMutation, useQuery } from "convex/react";
import { useUser } from "@clerk/clerk-react";
import { startOfDay } from "date-fns";
import { MessageCircle, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConversationPanel } from "@/components/track/dr-poo/ConversationPanel";
import { HabitDetailSheet } from "@/components/track/quick-capture/HabitDetailSheet";
import { QuickCapture } from "@/components/track/quick-capture/QuickCapture";
import { FoodRow } from "@/components/track/nutrition/FoodRow";
import { LogFoodModal } from "@/components/track/nutrition/LogFoodModal";
import { buildStagedNutritionLogData } from "@/components/track/nutrition/nutritionLogging";
import { CircularProgressRing } from "@/components/track/nutrition/CircularProgressRing";
import { useAiInsights } from "@/hooks/useAiInsights";
import { useCelebration } from "@/hooks/useCelebration";
import { useDayStats } from "@/hooks/useDayStats";
import { useHabitStreaks } from "@/hooks/useHabitStreaks";
import { useNutritionStore } from "@/components/track/nutrition/useNutritionStore";
import { useNutritionData } from "@/hooks/useNutritionData";
import { useFoodFavourites, useHabits } from "@/hooks/useProfile";
import { useQuickCapture } from "@/hooks/useQuickCapture";
import { useSlotScopedFoods } from "@/hooks/useSlotScopedFoods";
import { normalizeFluidItemName } from "@/lib/normalizeFluidName";
import {
  formatPortion,
  getDefaultCalories,
  titleCase,
  type MealSlot,
} from "@/lib/nutritionUtils";
import { type HabitConfig, isMovementHabit, isSleepHabit } from "@/lib/habitTemplates";
import {
  useAddSyncedLog,
  useLatestSuccessfulAiAnalysis,
  useRemoveSyncedLog,
} from "@/lib/sync";
import { MS_PER_DAY } from "@/lib/timeConstants";
import { useStore } from "@/store";
import { api } from "../../convex/_generated/api";

const INITIAL_FAVOURITES_LIMIT = 7;

const MEAL_SLOT_OPTIONS: ReadonlyArray<{ slot: MealSlot; label: string }> = [
  { slot: "breakfast", label: "Breakfast" },
  { slot: "lunch", label: "Lunch" },
  { slot: "dinner", label: "Dinner" },
  { slot: "snack", label: "Snack" },
];

type FavouriteSlotTags = Partial<Record<string, MealSlot[]>>;
type ConversationSeed = { key: string; text: string };
type ModifierEntryMode = "minutes" | "hours";

const MODIFIER_CHIPS: ReadonlyArray<{
  key: string;
  label: string;
  matcher: (habit: HabitConfig) => boolean;
  mode?: ModifierEntryMode;
}> = [
  {
    key: "sleep",
    label: "Sleep",
    matcher: (habit) => isSleepHabit(habit),
    mode: "hours",
  },
  {
    key: "stress",
    label: "Stress",
    matcher: (habit) => /stress/i.test(habit.name),
  },
  {
    key: "mood",
    label: "Mood",
    matcher: (habit) => /mood/i.test(habit.name),
  },
  {
    key: "activity",
    label: "Activity",
    matcher: (habit) => isMovementHabit(habit) && habit.unit === "minutes",
    mode: "minutes",
  },
  {
    key: "medication",
    label: "Medication",
    matcher: (habit) => /medication/i.test(habit.name),
  },
  {
    key: "cigarettes",
    label: "Cigarettes",
    matcher: (habit) => /cigarette/i.test(habit.name),
  },
  {
    key: "supplements",
    label: "Supplements",
    matcher: (habit) => /supplement/i.test(habit.name),
  },
];

function getTimeOfDayGreeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function getDisplayName(name: string | null | undefined): string {
  const trimmed = name?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "there";
}

function SummaryBar({
  label,
  consumed,
  goal,
  unit,
  color,
}: {
  label: string;
  consumed: number;
  goal: number;
  unit: string;
  color: string;
}) {
  const safeGoal = goal > 0 ? goal : 1;
  const progress = Math.min(consumed / safeGoal, 1);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-(--text-faint)">
          {label}
        </span>
        <span className="text-sm font-medium tabular-nums text-(--text-muted)">
          {consumed} / {goal} {unit}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-3)]">
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{
            width: `${Math.round(progress * 100)}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
}

function HomeFoodSection({
  title,
  foods,
  emptyMessage,
  onAdd,
  onToggleFavourite,
  isFavourite,
  showMore,
}: {
  title: string;
  foods: string[];
  emptyMessage: string;
  onAdd: (canonicalName: string) => void;
  onToggleFavourite: (canonicalName: string) => void | Promise<void>;
  isFavourite: (canonicalName: string) => boolean;
  showMore?: () => void;
}) {
  return (
    <section className="glass-card space-y-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-(--text-faint)">
          {title}
        </h2>
        {showMore ? (
          <button
            type="button"
            onClick={showMore}
            className="text-xs font-medium text-(--text-muted) transition-colors hover:text-(--text)"
          >
            Show more
          </button>
        ) : null}
      </div>

      {foods.length > 0 ? (
        <ul className="space-y-1">
          {foods.map((canonicalName) => (
            <FoodRow
              key={`${title}-${canonicalName}`}
              canonicalName={canonicalName}
              displayName={titleCase(canonicalName)}
              portion={formatPortion(canonicalName)}
              calories={getDefaultCalories(canonicalName)}
              isFavourite={isFavourite(canonicalName)}
              onAdd={onAdd}
              onToggleFavourite={onToggleFavourite}
            />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-(--text-muted)">{emptyMessage}</p>
      )}
    </section>
  );
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

export default function HomePage() {
  const { user } = useUser();
  const now = new Date();
  const todayStart = startOfDay(now).getTime();
  const todayEnd = todayStart + MS_PER_DAY;
  const { totalCaloriesToday, totalFluidsMl, calorieGoal, fluidGoal, currentMealSlot } =
    useNutritionData();
  const { habits } = useHabits();
  const latestSuccessfulAnalysis = useLatestSuccessfulAiAnalysis();
  const { hasApiKey, sendNow } = useAiInsights();
  const { favourites, isFavourite, toggleFavourite } = useFoodFavourites();
  const favouriteSlotTags = (useQuery(api.profiles.getFavouriteSlotTags, {}) ?? {}) as FavouriteSlotTags;
  const toggleFavouriteSlotTag = useMutation(api.profiles.toggleFavouriteSlotTag);
  const addSyncedLog = useAddSyncedLog();
  const removeSyncedLog = useRemoveSyncedLog();
  const { state, dispatch, stagingTotals } = useNutritionStore();
  const [slotOverride, setSlotOverride] = useState<MealSlot | null>(null);
  const [favouritesLimit, setFavouritesLimit] = useState(INITIAL_FAVOURITES_LIMIT);
  const [conversationOpen, setConversationOpen] = useState(false);
  const [conversationSeed, setConversationSeed] = useState<ConversationSeed | null>(null);
  const [dismissedCard, setDismissedCard] = useState(false);
  const [modifierEntry, setModifierEntry] = useState<{
    habit: HabitConfig;
    mode: ModifierEntryMode;
  } | null>(null);
  const [modifierValue, setModifierValue] = useState("");
  const removeHabitLog = useStore((state) => state.removeHabitLog);
  const habitLogs = useStore((state) => state.habitLogs);
  const { celebrateGoalComplete } = useCelebration();

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

  const syncedLogs = useQuery(api.logs.list, { limit: 3000 });
  const dayLogs = useMemo(() => syncedLogs ?? [], [syncedLogs]);
  const { todayHabitCounts, todayFluidTotalsByName } = useDayStats({
    logs: dayLogs,
    todayStart,
    todayEnd,
  });
  const { daySummaries, streakSummaries } = useHabitStreaks({
    habitLogs,
    habits,
    now,
  });
  const {
    handleQuickCaptureTap,
    handleLogSleepQuickCapture,
    handleLogActivityQuickCapture,
    handleLogWeightKg,
    handleQuickCaptureLongPress,
    handleCloseDetailSheet,
    detailSheetHabit,
  } = useQuickCapture({
    afterSave: () => {},
    celebrateGoalComplete,
    todayHabitCounts,
    todayFluidTotalsByName,
    streakSummaries,
    logs: dayLogs,
    todayStart,
    todayEnd,
    removeSyncedLog,
    removeHabitLog,
    onRequestEdit: () => {},
  });
  const detailDaySummaries = useMemo(
    () =>
      detailSheetHabit
        ? daySummaries.filter((summary) => summary.habitId === detailSheetHabit.id)
        : [],
    [daySummaries, detailSheetHabit],
  );
  const modifierHabits = useMemo(
    () =>
      MODIFIER_CHIPS.map((chip) => ({
        ...chip,
        habit: habits.find(chip.matcher) ?? null,
      })),
    [habits],
  );

  useEffect(() => {
    if (state.activeMealSlot === activeMealSlot) return;
    dispatch({ type: "SET_ACTIVE_MEAL_SLOT", slot: activeMealSlot });
  }, [activeMealSlot, dispatch, state.activeMealSlot]);

  useEffect(() => {
    setFavouritesLimit(INITIAL_FAVOURITES_LIMIT);
  }, [activeMealSlot]);

  useEffect(() => {
    setDismissedCard(false);
  }, [proactiveCardText]);

  const slotScopedFavourites = useMemo(
    () =>
      favourites.filter((canonicalName) =>
        (favouriteSlotTags[canonicalName] ?? []).includes(activeMealSlot),
      ),
    [activeMealSlot, favouriteSlotTags, favourites],
  );

  const visibleFavourites = useMemo(
    () => slotScopedFavourites.slice(0, favouritesLimit),
    [favouritesLimit, slotScopedFavourites],
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

  const handleAddAndReview = useCallback(
    (canonicalName: string) => {
      dispatch({ type: "ADD_TO_STAGING", canonicalName });
      dispatch({ type: "OPEN_STAGING_MODAL" });
    },
    [dispatch],
  );

  const handleToggleFavourite = useCallback(
    async (canonicalName: string) => {
      try {
        if (isFavourite(canonicalName)) {
          toggleFavourite(canonicalName);
          return;
        }

        await toggleFavouriteSlotTag({
          canonicalName,
          slot: activeMealSlot,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update favourites";
        toast.error(message);
      }
    },
    [activeMealSlot, isFavourite, toggleFavourite, toggleFavouriteSlotTag],
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

  const openModifierEntry = useCallback((habit: HabitConfig, mode: ModifierEntryMode) => {
    setModifierEntry({ habit, mode });
    setModifierValue(mode === "hours" ? String(habit.quickIncrement) : String(habit.quickIncrement));
  }, []);

  const handleModifierChipTap = useCallback(
    async (habit: HabitConfig | null, mode?: ModifierEntryMode) => {
      if (!habit) return;
      if (mode) {
        openModifierEntry(habit, mode);
        return;
      }
      await handleQuickCaptureTap(habit);
    },
    [handleQuickCaptureTap, openModifierEntry],
  );

  const handleSubmitModifierEntry = useCallback(async () => {
    if (!modifierEntry) return;

    const parsed = Number(modifierValue);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error("Enter a value greater than 0.");
      return;
    }

    if (modifierEntry.mode === "hours") {
      await handleLogSleepQuickCapture(modifierEntry.habit, parsed);
    } else {
      await handleLogActivityQuickCapture(modifierEntry.habit, parsed);
    }

    setModifierEntry(null);
    setModifierValue("");
  }, [handleLogActivityQuickCapture, handleLogSleepQuickCapture, modifierEntry, modifierValue]);

  const showMoreFavourites =
    slotScopedFavourites.length > visibleFavourites.length
      ? () => setFavouritesLimit((current) => current + INITIAL_FAVOURITES_LIMIT)
      : undefined;

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

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-(--text-faint)">
          Home
        </p>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="font-display text-3xl font-bold text-(--text)">
              {greeting}, {firstName}
            </h1>
            <p className="max-w-prose text-sm text-(--text-muted)">
              Your live nutrition summary updates from today&apos;s logs so you can see calories and
              fluids at a glance before logging the next meal.
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
      </section>

      <section className="glass-card space-y-4 p-4 sm:p-5" aria-label="Today nutrition summary">
        <div className="flex items-center gap-4">
          <div className="flex justify-center sm:justify-start">
            <CircularProgressRing
              value={totalCaloriesToday}
              goal={calorieGoal}
              color="var(--orange)"
              size={112}
              strokeWidth={10}
              ariaLabel={`Calories: ${totalCaloriesToday} of ${calorieGoal} kilocalories`}
              unitLabel="kcal"
            />
          </div>

          <div className="min-w-0 flex-1 space-y-4">
            <SummaryBar
              label="Calories"
              consumed={totalCaloriesToday}
              goal={calorieGoal}
              unit="kcal"
              color="var(--orange)"
            />
            <SummaryBar
              label="Fluids"
              consumed={totalFluidsMl}
              goal={fluidGoal}
              unit="ml"
              color="var(--fluid)"
            />
          </div>
        </div>
      </section>

      <section className="glass-card space-y-4 p-4">
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
      </section>

      <section className="glass-card space-y-4 p-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-(--text-faint)">
            Modifiers
          </p>
          <div className="flex flex-wrap gap-2">
            {modifierHabits.map(({ key, label, habit, mode }) => (
              <button
                key={key}
                type="button"
                disabled={habit === null}
                onClick={() => {
                  void handleModifierChipTap(habit, mode);
                }}
                className="rounded-full border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45"
                style={{
                  borderColor: habit ? "var(--color-border-default)" : "var(--surface-3)",
                  backgroundColor: "var(--surface-2)",
                  color: habit ? "var(--text)" : "var(--text-faint)",
                }}
                title={habit ? `Log ${label}` : `${label} isn't configured yet`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <QuickCapture
          habits={habits}
          todayHabitCounts={todayHabitCounts}
          todayFluidMl={todayFluidTotalsByName}
          onTap={(habit) => {
            void handleQuickCaptureTap(habit);
          }}
          onLogSleepHours={handleLogSleepQuickCapture}
          onLogActivityMinutes={handleLogActivityQuickCapture}
          onLogWeightKg={handleLogWeightKg}
          onLongPress={handleQuickCaptureLongPress}
        />
      </section>

      <HomeFoodSection
        title="Favourites"
        foods={visibleFavourites}
        emptyMessage={`No favourites for ${titleCase(activeMealSlot)}`}
        onAdd={handleAddAndReview}
        onToggleFavourite={handleToggleFavourite}
        isFavourite={isFavourite}
        {...(showMoreFavourites ? { showMore: showMoreFavourites } : {})}
      />

      <HomeFoodSection
        title="Recent"
        foods={visibleRecentFoods}
        emptyMessage={`Nothing logged recently for ${titleCase(activeMealSlot)}`}
        onAdd={handleAddAndReview}
        onToggleFavourite={handleToggleFavourite}
        isFavourite={isFavourite}
      />

      <HomeFoodSection
        title="Frequent"
        foods={visibleFrequentFoods}
        emptyMessage={`No frequent foods yet for ${titleCase(activeMealSlot)}`}
        onAdd={handleAddAndReview}
        onToggleFavourite={handleToggleFavourite}
        isFavourite={isFavourite}
      />

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

      <Dialog.Root
        open={modifierEntry !== null}
        onOpenChange={(open) => {
          if (!open) {
            setModifierEntry(null);
            setModifierValue("");
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm" />
          <Dialog.Popup className="fixed inset-x-4 top-1/2 z-50 mx-auto w-full max-w-sm -translate-y-1/2 rounded-3xl border border-[var(--color-border-default)] bg-[var(--card)] p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <Dialog.Title className="font-display text-xl font-bold text-(--text)">
                  {modifierEntry ? `Log ${modifierEntry.habit.name}` : "Log modifier"}
                </Dialog.Title>
                <p className="text-sm text-(--text-muted)">
                  {modifierEntry?.mode === "hours"
                    ? "Enter hours, then save."
                    : "Enter minutes, then save."}
                </p>
              </div>
              <Dialog.Close className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border-default)] text-(--text-muted) transition-colors hover:text-(--text)">
                <X className="h-4 w-4" />
              </Dialog.Close>
            </div>

            <div className="space-y-3">
              <input
                type="number"
                min="0"
                step={modifierEntry?.mode === "hours" ? "0.5" : "1"}
                value={modifierValue}
                onChange={(event) => setModifierValue(event.target.value)}
                className="h-12 w-full rounded-2xl border border-[var(--color-border-default)] bg-[var(--surface-1)] px-4 text-center text-lg font-medium text-(--text)"
              />
              <button
                type="button"
                onClick={() => {
                  void handleSubmitModifierEntry();
                }}
                className="w-full rounded-2xl bg-[var(--section-quick)] px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                Save
              </button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

      <HabitDetailSheet
        habit={detailSheetHabit}
        count={detailSheetHabit ? (todayHabitCounts[detailSheetHabit.id] ?? 0) : 0}
        {...(detailSheetHabit?.logAs === "fluid"
          ? {
              fluidMl:
                todayFluidTotalsByName[normalizeFluidItemName(detailSheetHabit.name)] ?? 0,
            }
          : {})}
        daySummaries={detailDaySummaries}
        streakSummary={detailSheetHabit ? (streakSummaries[detailSheetHabit.id] ?? null) : null}
        onClose={handleCloseDetailSheet}
      />
    </div>
  );
}
