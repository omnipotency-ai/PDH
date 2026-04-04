/**
 * NutritionCard — main nutrition UI on the Track page.
 *
 * Manages collapsed view (calorie ring + stats, water bar, search row,
 * meal breakdown bar, macro row, meal slot accordions) and search view.
 * Placeholder slots for future sub-components (StagingModal, WaterModal,
 * CalorieDetail expansion, Favourites, Filter).
 *
 * State: useNutritionStore (ephemeral UI via useReducer)
 * Data: useNutritionData (read-only Convex-derived)
 */

import { FOOD_PORTION_DATA } from "@shared/foodPortionData";
import type { FoodRegistryEntry } from "@shared/foodRegistryData";
import {
  Camera,
  Droplet,
  Heart,
  Mic,
  SlidersHorizontal,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useNutritionData } from "@/hooks/useNutritionData";
import { getErrorMessage } from "@/lib/errors";
import { useAddSyncedLog, useRemoveSyncedLog } from "@/lib/sync";
import { useFoodFavourites } from "@/hooks/useProfile";
import { CalorieDetailView } from "./CalorieDetailView";
import { FavouritesView } from "./FavouritesView";
import { FoodFilterView } from "./FoodFilterView";
import { LogFoodModal } from "./LogFoodModal";
import { useNutritionStore } from "./useNutritionStore";
import { WaterModal } from "./WaterModal";

// ── Constants ────────────────────────────────────────────────────────────────

/** SVG calorie ring dimensions. */
const RING_SIZE = 72;
const RING_STROKE = 7;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// ── Calorie Ring ─────────────────────────────────────────────────────────────

function CalorieRing({
  consumed,
  goal,
  onExpand,
}: {
  consumed: number;
  goal: number;
  onExpand: () => void;
}) {
  const remaining = Math.max(0, goal - consumed);
  const progress = goal > 0 ? Math.min(consumed / goal, 1) : 0;
  const strokeDashoffset = RING_CIRCUMFERENCE * (1 - progress);

  return (
    <button
      type="button"
      data-slot="calorie-ring"
      className="group flex items-center gap-4 rounded-lg transition-colors hover:bg-[var(--surface-2)]"
      onClick={onExpand}
      aria-label={`${remaining} calories remaining of ${goal} calorie goal. Tap to expand.`}
    >
      {/* Ring */}
      <div className="relative shrink-0">
        <svg
          width={RING_SIZE}
          height={RING_SIZE}
          viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
          className="-rotate-90"
          aria-hidden="true"
        >
          {/* Background track */}
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            stroke="var(--surface-3)"
            strokeWidth={RING_STROKE}
          />
          {/* Progress arc */}
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            stroke="var(--orange)"
            strokeWidth={RING_STROKE}
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-[stroke-dashoffset] duration-500 ease-out"
          />
        </svg>
        {/* Center text inside ring */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-sm font-bold text-[var(--text)]">
            {remaining}
          </span>
          <span className="text-[10px] text-[var(--text-faint)]">left</span>
        </div>
      </div>

      {/* Stats beside ring + progress bar below text */}
      <div className="flex flex-1 flex-col items-start gap-1.5 text-left">
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-bold text-[var(--text)]">
            {consumed}
          </span>
          <span className="text-base text-[var(--text-muted)]">
            / {goal} kcal
          </span>
        </div>
        <CalorieProgressBar consumed={consumed} goal={goal} />
      </div>
    </button>
  );
}

// ── Calorie Progress Bar ────────────────────────────────────────────────────

function CalorieProgressBar({
  consumed,
  goal,
}: {
  consumed: number;
  goal: number;
}) {
  const progress = goal > 0 ? Math.min(consumed / goal, 1) : 0;
  const percentage = Math.round(progress * 100);

  return (
    <div
      data-slot="calorie-progress"
      className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-3)]"
      role="progressbar"
      aria-valuenow={percentage}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Calorie progress: ${percentage}%`}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500 ease-out"
        style={{
          width: `${percentage}%`,
          backgroundColor: "var(--orange)",
        }}
      />
    </div>
  );
}

// ── Water Progress Row ───────────────────────────────────────────────────────

function WaterProgressRow({
  intakeMl,
  goalMl,
  onOpenModal,
}: {
  intakeMl: number;
  goalMl: number;
  onOpenModal: () => void;
}) {
  const progress = goalMl > 0 ? Math.min(intakeMl / goalMl, 1) : 0;
  const percentage = Math.round(progress * 100);

  return (
    <button
      type="button"
      data-slot="water-progress"
      className="group flex w-full items-center gap-2 rounded-lg transition-colors hover:bg-[var(--surface-2)]"
      onClick={onOpenModal}
      aria-label={`Water: ${intakeMl} of ${goalMl} ml. Tap to log water.`}
    >
      <Droplet
        className="h-5 w-5 shrink-0"
        style={{ color: "#42BCB8" }}
        aria-hidden="true"
      />
      <span className="shrink-0 text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        Water
      </span>
      <span className="shrink-0 text-sm text-[var(--text-muted)]">
        {intakeMl}/{goalMl}ml
      </span>
      <div
        className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-3)]"
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{
            width: `${percentage}%`,
            backgroundColor: "#42BCB8",
          }}
        />
      </div>
    </button>
  );
}

// ── Search Input ─────────────────────────────────────────────────────────────

function NutritionSearchInput({
  value,
  onChange,
  onFocus,
  onClear,
  inputRef,
}: {
  value: string;
  onChange: (value: string) => void;
  onFocus: () => void;
  onClear: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div data-slot="nutrition-search" className="relative flex-1">
      <Camera
        className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--text-faint)]"
        aria-hidden="true"
      />
      <Mic
        className="pointer-events-none absolute left-10 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--text-faint)]"
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        placeholder="Search or type a food..."
        className="w-full rounded-xl border border-[var(--color-border-default)] bg-[var(--surface-2)] py-3 pl-[4.5rem] pr-10 text-base text-[var(--text)] placeholder:text-[var(--text-faint)] transition-colors focus:border-[var(--orange)] focus:outline-none focus:ring-1 focus:ring-[var(--orange)]"
        aria-label="Search foods"
        autoComplete="off"
      />
      {value.length > 0 && (
        <button
          type="button"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--text)]"
          onClick={onClear}
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

// ── Search Result Row ────────────────────────────────────────────────────────

function SearchResultRow({
  entry,
  onSelect,
}: {
  entry: FoodRegistryEntry;
  onSelect: (canonicalName: string) => void;
}) {
  const portionData = FOOD_PORTION_DATA.get(entry.canonical);
  const calories = portionData
    ? Math.round(
        ((portionData.caloriesPer100g ?? 0) * portionData.defaultPortionG) /
          100,
      )
    : 0;
  const portionLabel =
    portionData?.naturalUnit ?? `${portionData?.defaultPortionG ?? 0}g`;

  return (
    <button
      type="button"
      data-slot="search-result"
      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors hover:bg-[var(--surface-2)]"
      onClick={() => onSelect(entry.canonical)}
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-[var(--text)]">
          {entry.canonical}
        </span>
        <span className="text-[10px] text-[var(--text-faint)]">
          {portionLabel}
        </span>
      </div>
      <span className="text-xs font-medium text-[var(--text-muted)]">
        {calories} kcal
      </span>
    </button>
  );
}

// ── Search View ──────────────────────────────────────────────────────────────

function SearchView({
  searchQuery,
  searchResults,
  onQueryChange,
  onClear,
  onSelect,
  inputRef,
}: {
  searchQuery: string;
  searchResults: FoodRegistryEntry[];
  onQueryChange: (query: string) => void;
  onClear: () => void;
  onSelect: (canonicalName: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div data-slot="search-view" className="space-y-2">
      <NutritionSearchInput
        value={searchQuery}
        onChange={onQueryChange}
        onFocus={() => {
          /* Already in search view */
        }}
        onClear={onClear}
        inputRef={inputRef}
      />

      {searchQuery.trim().length > 0 && searchQuery.trim().length < 3 && (
        <p className="px-3 py-2 text-xs text-[var(--text-faint)]">
          Type at least 3 characters...
        </p>
      )}

      {searchResults.length > 0 && (
        <div
          className="max-h-64 space-y-0.5 overflow-y-auto"
          role="listbox"
          aria-label="Search results"
        >
          {searchResults.map((entry) => (
            <SearchResultRow
              key={entry.canonical}
              entry={entry}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}

      {searchQuery.trim().length >= 3 && searchResults.length === 0 && (
        <p className="px-3 py-4 text-center text-xs text-[var(--text-faint)]">
          No foods found for &ldquo;{searchQuery}&rdquo;
        </p>
      )}
    </div>
  );
}

// ── Collapsed View ───────────────────────────────────────────────────────────

function CollapsedView({
  consumed,
  goal,
  waterIntakeMl,
  waterGoalMl,
  stagingCount,
  searchQuery,
  onExpandCalories,
  onOpenWater,
  onSearchFocus,
  onSearchChange,
  onSearchClear,
  searchInputRef,
}: {
  consumed: number;
  goal: number;
  waterIntakeMl: number;
  waterGoalMl: number;
  stagingCount: number;
  searchQuery: string;
  onExpandCalories: () => void;
  onOpenWater: () => void;
  onSearchFocus: () => void;
  onSearchChange: (value: string) => void;
  onSearchClear: () => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div data-slot="collapsed-view" className="space-y-4">
      {/* ── Calorie section: ring + stats + progress bar ─── */}
      <CalorieRing
        consumed={consumed}
        goal={goal}
        onExpand={onExpandCalories}
      />

      {/* ── Search + Log Food (same row) ─── */}
      <div className="flex items-center gap-2">
        <NutritionSearchInput
          value={searchQuery}
          onChange={onSearchChange}
          onFocus={onSearchFocus}
          onClear={onSearchClear}
          inputRef={searchInputRef}
        />
        <button
          type="button"
          data-slot="log-food-button"
          className="shrink-0 rounded-full bg-[var(--orange)] px-6 py-3 text-base font-semibold text-white transition-colors hover:brightness-110 active:brightness-95"
          onClick={onSearchFocus}
          aria-label="Log food"
        >
          Log Food
          {stagingCount > 0 && (
            <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white/20 px-1 text-[10px] font-bold">
              {stagingCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Water row (compact, at bottom) ─── */}
      <WaterProgressRow
        intakeMl={waterIntakeMl}
        goalMl={waterGoalMl}
        onOpenModal={onOpenWater}
      />
    </div>
  );
}

// ── NutritionCard (main export) ──────────────────────────────────────────────

export function NutritionCard() {
  const { state, dispatch, searchResults, stagingCount } = useNutritionStore();
  const {
    totalCaloriesToday,
    totalMacrosToday,
    waterIntakeToday,
    calorieGoal,
    waterGoal,
    caloriesByMealSlot,
    logsByMealSlot,
    recentFoods,
  } = useNutritionData();
  const { favourites } = useFoodFavourites();
  const addSyncedLog = useAddSyncedLog();
  const removeSyncedLog = useRemoveSyncedLog();

  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // ── Global escape handler (decision #15) ─────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && state.view !== "collapsed") {
        e.preventDefault();
        dispatch({ type: "SET_VIEW", view: "collapsed" });
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state.view, dispatch]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleSearchFocus = useCallback(() => {
    dispatch({ type: "SET_VIEW", view: "search" });
    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
  }, [dispatch]);

  const handleSearchChange = useCallback(
    (query: string) => {
      dispatch({ type: "SET_SEARCH_QUERY", query });
    },
    [dispatch],
  );

  const handleSearchClear = useCallback(() => {
    dispatch({ type: "SET_SEARCH_QUERY", query: "" });
    searchInputRef.current?.focus();
  }, [dispatch]);

  // Bug 3 fix: toggle between collapsed and calorieDetail
  const handleExpandCalories = useCallback(() => {
    dispatch({
      type: "SET_VIEW",
      view: state.view === "calorieDetail" ? "collapsed" : "calorieDetail",
    });
  }, [dispatch, state.view]);

  const handleOpenWater = useCallback(() => {
    dispatch({ type: "OPEN_WATER_MODAL" });
  }, [dispatch]);

  const handleCloseWater = useCallback(() => {
    dispatch({ type: "CLOSE_WATER_MODAL" });
  }, [dispatch]);

  const handleLogWater = useCallback(
    async (amountMl: number) => {
      try {
        await addSyncedLog({
          timestamp: Date.now(),
          type: "fluid",
          data: { items: [{ name: "Water", quantity: amountMl, unit: "ml" }] },
        });
        toast(`Water ${amountMl}ml logged`);
        dispatch({ type: "CLOSE_WATER_MODAL" });
      } catch (err) {
        toast.error(getErrorMessage(err, "Failed to log water"));
      }
    },
    [addSyncedLog, dispatch],
  );

  const handleSelectFood = useCallback(
    (canonicalName: string) => {
      dispatch({ type: "ADD_TO_STAGING", canonicalName });
    },
    [dispatch],
  );

  const handleAddToStaging = useCallback(
    (canonicalName: string) => {
      dispatch({ type: "ADD_TO_STAGING", canonicalName });
    },
    [dispatch],
  );

  const handleCloseStagingModal = useCallback(() => {
    dispatch({ type: "CLOSE_STAGING_MODAL" });
  }, [dispatch]);

  const handleRemoveFromStaging = useCallback(
    (canonicalName: string) => {
      const item = state.stagingItems.find(
        (i) => i.canonicalName === canonicalName,
      );
      if (item) dispatch({ type: "REMOVE_FROM_STAGING", id: item.id });
    },
    [dispatch, state.stagingItems],
  );

  const handleUpdateStagedQuantity = useCallback(
    (canonicalName: string, newQuantity: number) => {
      const item = state.stagingItems.find(
        (i) => i.canonicalName === canonicalName,
      );
      if (item) {
        const delta = newQuantity - item.portionG;
        dispatch({ type: "ADJUST_STAGING_PORTION", id: item.id, delta });
      }
    },
    [dispatch, state.stagingItems],
  );

  const handleClearStaging = useCallback(() => {
    dispatch({ type: "CLEAR_STAGING" });
  }, [dispatch]);

  const handleLogFood = useCallback(async () => {
    try {
      await addSyncedLog({
        timestamp: Date.now(),
        type: "food",
        data: {
          items: state.stagingItems.map((item) => ({
            canonicalName: item.canonicalName,
            parsedName: item.displayName,
            quantity: item.portionG,
            unit: "g",
          })),
        },
      });
      toast(`${state.stagingItems.length} item(s) logged`);
      dispatch({ type: "RESET_AFTER_LOG" });
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to log food"));
    }
  }, [addSyncedLog, state.stagingItems, dispatch]);

  const handleAddMore = useCallback(() => {
    dispatch({ type: "CLOSE_STAGING_MODAL" });
    dispatch({ type: "SET_VIEW", view: "search" });
    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
  }, [dispatch]);

  const handleDeleteLog = useCallback(
    async (logId: string) => {
      try {
        await removeSyncedLog(logId);
        toast("Entry deleted");
      } catch (err) {
        toast.error(getErrorMessage(err, "Failed to delete entry"));
      }
    },
    [removeSyncedLog],
  );

  const handleBackToCollapsed = useCallback(() => {
    dispatch({ type: "SET_VIEW", view: "collapsed" });
  }, [dispatch]);

  // ── Header icons ─────────────────────────────────────────────────────────

  const headerIcons = (
    <div className="ml-auto flex items-center gap-3">
      <button
        type="button"
        className="rounded-md p-1 transition-colors hover:bg-[var(--surface-2)]"
        aria-label="Favourites"
        onClick={() => dispatch({ type: "SET_VIEW", view: "favourites" })}
      >
        <Heart className="h-5 w-5" style={{ color: "var(--orange)" }} />
      </button>
      <button
        type="button"
        className="rounded-md p-1 transition-colors hover:bg-[var(--surface-2)]"
        aria-label="Filter foods"
        onClick={() => dispatch({ type: "SET_VIEW", view: "foodFilter" })}
      >
        <SlidersHorizontal
          className="h-5 w-5"
          style={{ color: "var(--orange)" }}
        />
      </button>
      <button
        type="button"
        className="rounded-md p-1 transition-colors hover:bg-[var(--surface-2)]"
        aria-label="Log water"
        onClick={handleOpenWater}
      >
        <Droplet className="h-5 w-5" style={{ color: "#42BCB8" }} />
      </button>
    </div>
  );

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <section
      data-slot="nutrition-card"
      className="glass-card glass-card-food space-y-3 p-4"
      aria-label="Nutrition tracking"
    >
      <SectionHeader
        icon={UtensilsCrossed}
        title="Nutrition"
        color="var(--section-food)"
        mutedColor="var(--section-food-muted)"
      >
        {headerIcons}
      </SectionHeader>

      {/* Collapsed view (default) — compact: ring + search + water */}
      {state.view === "collapsed" && (
        <CollapsedView
          consumed={totalCaloriesToday}
          goal={calorieGoal}
          waterIntakeMl={waterIntakeToday}
          waterGoalMl={waterGoal}
          stagingCount={stagingCount}
          searchQuery={state.searchQuery}
          onExpandCalories={handleExpandCalories}
          onOpenWater={handleOpenWater}
          onSearchFocus={handleSearchFocus}
          onSearchChange={handleSearchChange}
          onSearchClear={handleSearchClear}
          searchInputRef={searchInputRef}
        />
      )}

      {/* Search view */}
      {state.view === "search" && (
        <SearchView
          searchQuery={state.searchQuery}
          searchResults={searchResults}
          onQueryChange={handleSearchChange}
          onClear={handleSearchClear}
          onSelect={handleSelectFood}
          inputRef={searchInputRef}
        />
      )}

      {/* Calorie detail view — expanded: ring + water + search + breakdown + macros + accordions */}
      {state.view === "calorieDetail" && (
        <div data-slot="calorie-detail-view" className="space-y-4">
          <CalorieRing
            consumed={totalCaloriesToday}
            goal={calorieGoal}
            onExpand={handleExpandCalories}
          />
          <WaterProgressRow
            intakeMl={waterIntakeToday}
            goalMl={waterGoal}
            onOpenModal={handleOpenWater}
          />
          <div className="flex items-center gap-2">
            <NutritionSearchInput
              value={state.searchQuery}
              onChange={handleSearchChange}
              onFocus={handleSearchFocus}
              onClear={handleSearchClear}
              inputRef={searchInputRef}
            />
            <button
              type="button"
              data-slot="log-food-button"
              className="shrink-0 rounded-full bg-[var(--orange)] px-6 py-3 text-base font-semibold text-white transition-colors hover:brightness-110 active:brightness-95"
              onClick={handleSearchFocus}
              aria-label="Log food"
            >
              Log Food
              {stagingCount > 0 && (
                <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white/20 px-1 text-[10px] font-bold">
                  {stagingCount}
                </span>
              )}
            </button>
          </div>
          <CalorieDetailView
            macros={totalMacrosToday}
            caloriesByMealSlot={caloriesByMealSlot}
            logsByMealSlot={logsByMealSlot}
            onDeleteLog={handleDeleteLog}
          />
        </div>
      )}

      {/* FavouritesView */}
      {state.view === "favourites" && (
        <FavouritesView
          favourites={favourites}
          onAddToStaging={handleAddToStaging}
          onBack={handleBackToCollapsed}
        />
      )}

      {/* FoodFilterView */}
      {state.view === "foodFilter" && (
        <FoodFilterView
          recentFoods={recentFoods}
          favourites={favourites}
          onAddToStaging={handleAddToStaging}
          onBack={handleBackToCollapsed}
        />
      )}

      {/* LogFoodModal (staging) */}
      <LogFoodModal
        open={state.stagingModalOpen}
        stagedItems={state.stagingItems}
        onClose={handleCloseStagingModal}
        onRemoveItem={handleRemoveFromStaging}
        onUpdateQuantity={handleUpdateStagedQuantity}
        onClearAll={handleClearStaging}
        onLogFood={handleLogFood}
        onAddMore={handleAddMore}
      />

      {/* WaterModal */}
      <WaterModal
        open={state.waterModalOpen}
        onClose={handleCloseWater}
        onLogWater={handleLogWater}
        currentIntakeMl={waterIntakeToday}
        goalMl={waterGoal}
      />
    </section>
  );
}
