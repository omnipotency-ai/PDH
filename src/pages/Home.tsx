import { useMutation, useQuery } from "convex/react";
import { useUser } from "@clerk/clerk-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { FoodRow } from "@/components/track/nutrition/FoodRow";
import { LogFoodModal } from "@/components/track/nutrition/LogFoodModal";
import { buildStagedNutritionLogData } from "@/components/track/nutrition/nutritionLogging";
import { CircularProgressRing } from "@/components/track/nutrition/CircularProgressRing";
import { useNutritionStore } from "@/components/track/nutrition/useNutritionStore";
import { useNutritionData } from "@/hooks/useNutritionData";
import { useFoodFavourites } from "@/hooks/useProfile";
import { useSlotScopedFoods } from "@/hooks/useSlotScopedFoods";
import {
  formatPortion,
  getDefaultCalories,
  titleCase,
  type MealSlot,
} from "@/lib/nutritionUtils";
import { useAddSyncedLog } from "@/lib/sync";
import { api } from "../../convex/_generated/api";

const INITIAL_FAVOURITES_LIMIT = 7;

const MEAL_SLOT_OPTIONS: ReadonlyArray<{ slot: MealSlot; label: string }> = [
  { slot: "breakfast", label: "Breakfast" },
  { slot: "lunch", label: "Lunch" },
  { slot: "dinner", label: "Dinner" },
  { slot: "snack", label: "Snack" },
];

type FavouriteSlotTags = Partial<Record<string, MealSlot[]>>;

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

export default function HomePage() {
  const { user } = useUser();
  const { totalCaloriesToday, totalFluidsMl, calorieGoal, fluidGoal, currentMealSlot } =
    useNutritionData();
  const { favourites, isFavourite, toggleFavourite } = useFoodFavourites();
  const favouriteSlotTags = (useQuery(api.profiles.getFavouriteSlotTags, {}) ?? {}) as FavouriteSlotTags;
  const toggleFavouriteSlotTag = useMutation(api.profiles.toggleFavouriteSlotTag);
  const addSyncedLog = useAddSyncedLog();
  const { state, dispatch, stagingTotals } = useNutritionStore();
  const [slotOverride, setSlotOverride] = useState<MealSlot | null>(null);
  const [favouritesLimit, setFavouritesLimit] = useState(INITIAL_FAVOURITES_LIMIT);

  const activeMealSlot = slotOverride ?? currentMealSlot;
  const { recentFoods, frequentFoods } = useSlotScopedFoods(activeMealSlot);
  const greeting = getTimeOfDayGreeting(new Date().getHours());
  const firstName = getDisplayName(user?.firstName);

  useEffect(() => {
    if (state.activeMealSlot === activeMealSlot) return;
    dispatch({ type: "SET_ACTIVE_MEAL_SLOT", slot: activeMealSlot });
  }, [activeMealSlot, dispatch, state.activeMealSlot]);

  useEffect(() => {
    setFavouritesLimit(INITIAL_FAVOURITES_LIMIT);
  }, [activeMealSlot]);

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

  const showMoreFavourites =
    slotScopedFavourites.length > visibleFavourites.length
      ? () => setFavouritesLimit((current) => current + INITIAL_FAVOURITES_LIMIT)
      : undefined;

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-(--text-faint)">
          Home
        </p>
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-bold text-(--text)">
            {greeting}, {firstName}
          </h1>
          <p className="max-w-prose text-sm text-(--text-muted)">
            Your live nutrition summary updates from today&apos;s logs so you can see calories and
            fluids at a glance before logging the next meal.
          </p>
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
    </div>
  );
}
