/**
 * NutritionCard — main nutrition UI on the Track page.
 *
 * The collapsed card (CalorieRing, search bar, Log Food button,
 * WaterProgressRow) is ALWAYS visible. Secondary panels (CalorieDetail,
 * Favourites, FoodFilter) render BELOW the water bar, one at a time.
 * Search results appear inline below the water bar when the user types.
 *
 * State: useNutritionStore (ephemeral UI via useReducer)
 * Data: useNutritionData (read-only Convex-derived)
 */

import { FOOD_PORTION_DATA } from "@shared/foodPortionData";
import { FOOD_REGISTRY, type FoodRegistryEntry } from "@shared/foodRegistryData";
import { format, isSameDay } from "date-fns";
import {
  Camera,
  Droplets,
  Heart,
  Mic,
  Plus,
  SlidersHorizontal,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useNutritionData } from "@/hooks/useNutritionData";
import { useFoodFavourites } from "@/hooks/useProfile";
import { getErrorMessage } from "@/lib/errors";
import {
  filterToKnownFoods,
  formatPortion,
  getDefaultCalories,
  titleCase,
} from "@/lib/nutritionUtils";
import { useAddSyncedLog, useRemoveSyncedLog } from "@/lib/sync";
import { getZoneBadgeBackground } from "@/lib/zoneColors";
import { CalorieDetailView } from "./CalorieDetailView";
import { FavouritesView } from "./FavouritesView";
import { FoodFilterView } from "./FoodFilterView";
import { FoodRow } from "./FoodRow";
import { LogFoodModal } from "./LogFoodModal";
import { buildRawNutritionLogData, buildStagedNutritionLogData } from "./nutritionLogging";
import { useNutritionStore } from "./useNutritionStore";
import { WaterModal } from "./WaterModal";

// ── Constants ────────────────────────────────────────────────────────────────

/** Subcategories that represent non-water drinks in the food registry. */
const DRINK_SUBCATEGORIES = new Set(["hot_drink", "juice", "fizzy_drink"]);

/**
 * Common drinks from the food registry, filtered to only entries that
 * also have portion data (so they can be staged). Computed once at
 * module load — the registry is static.
 */
const COMMON_DRINKS: ReadonlyArray<FoodRegistryEntry> = FOOD_REGISTRY.filter(
  (entry) => DRINK_SUBCATEGORIES.has(entry.subcategory) && FOOD_PORTION_DATA.has(entry.canonical),
);

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
          <span className="text-sm font-bold text-[var(--text)]">{remaining}</span>
          <span className="text-[10px] text-[var(--text-faint)]">left</span>
        </div>
      </div>

      {/* Stats beside ring + progress bar below text */}
      <div className="flex flex-1 flex-col items-start gap-1.5 text-left">
        <div className="flex items-baseline gap-1.5">
          <span className="text-xl font-bold text-[var(--text)]">{consumed}</span>
          <span className="text-xs text-[var(--text-muted)]">/ {goal} kcal</span>
        </div>
        <CalorieProgressBar consumed={consumed} goal={goal} />
      </div>
    </button>
  );
}

// ── Calorie Progress Bar ────────────────────────────────────────────────────

function CalorieProgressBar({ consumed, goal }: { consumed: number; goal: number }) {
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
  waterMl,
  goalMl,
  onOpenModal,
}: {
  /** Total fluid intake (water + coffee + tea + all fluids). */
  intakeMl: number;
  /** Water-only subset of intakeMl. */
  waterMl: number;
  goalMl: number;
  onOpenModal: () => void;
}) {
  const progress = goalMl > 0 ? Math.min(intakeMl / goalMl, 1) : 0;
  const waterProgress = goalMl > 0 ? Math.min(waterMl / goalMl, 1) : 0;
  const percentage = Math.round(progress * 100);

  return (
    <button
      type="button"
      data-slot="water-progress"
      className="group flex w-full items-center gap-2 rounded-lg transition-colors hover:bg-[var(--surface-2)]"
      onClick={onOpenModal}
      aria-label={`Fluids: ${intakeMl} ml of ${goalMl} ml (water: ${waterMl} ml). Tap to log water.`}
    >
      <Droplets className="h-5 w-5 shrink-0" style={{ color: "var(--water)" }} aria-hidden="true" />
      <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        Fluids
      </span>
      <span className="shrink-0 text-xs text-[var(--text-muted)]">
        {intakeMl}/{goalMl}ml
      </span>
      <div
        className="relative h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-3)]"
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Fluid progress: ${percentage}%`}
      >
        {/* Total fluids bar (teal) */}
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out"
          style={{
            width: `${Math.round(progress * 100)}%`,
            backgroundColor: "var(--fluid)",
          }}
        />
        {/* Water subset bar (sky blue, drawn over) */}
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out"
          style={{
            width: `${Math.round(waterProgress * 100)}%`,
            backgroundColor: "var(--water)",
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
  onClear,
  onFocus,
  onBlur,
  onSubmit,
  inputRef,
  hasResults,
}: {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  onFocus: () => void;
  onBlur: () => void;
  onSubmit: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  hasResults: boolean;
}) {
  return (
    <div data-slot="nutrition-search" className="relative flex-1">
      <Camera
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-faint)]"
        aria-hidden="true"
      />
      <Mic
        className="pointer-events-none absolute left-9 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-faint)]"
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          onSubmit();
        }}
        placeholder="Search or type a food..."
        className="w-full rounded-xl border border-[var(--color-border-default)] bg-[var(--surface-2)] py-2 pl-[3.75rem] pr-10 text-sm text-[var(--text)] placeholder:text-[var(--text-faint)] transition-colors focus:border-[var(--orange)] focus:outline-none focus:ring-1 focus:ring-[var(--orange)]"
        role="combobox"
        aria-label="Search foods"
        aria-autocomplete="list"
        aria-expanded={hasResults}
        aria-controls={hasResults ? "nutrition-search-results" : undefined}
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
  isFavourite,
  onSelect,
  onToggleFavourite,
}: {
  entry: FoodRegistryEntry;
  isFavourite: boolean;
  onSelect: (canonicalName: string) => void;
  onToggleFavourite: (canonicalName: string) => void;
}) {
  const portionData = FOOD_PORTION_DATA.get(entry.canonical);
  const calories = portionData
    ? Math.round(((portionData.caloriesPer100g ?? 0) * portionData.defaultPortionG) / 100)
    : 0;
  const portionLabel = portionData?.naturalUnit ?? `${portionData?.defaultPortionG ?? 0}g`;

  const zoneColor = getZoneBadgeBackground(entry.zone);

  return (
    <div
      data-slot="search-result"
      role="option"
      tabIndex={-1}
      aria-selected={false}
      aria-label={`${entry.canonical}, Zone ${entry.zone}, ${calories} kcal`}
      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-[var(--surface-2)]"
    >
      {/* Heart toggle */}
      <button
        type="button"
        className="shrink-0 p-0"
        onClick={() => onToggleFavourite(entry.canonical)}
        aria-label={
          isFavourite
            ? `Remove ${entry.canonical} from favourites`
            : `Add ${entry.canonical} to favourites`
        }
      >
        <Heart
          className={`h-4 w-4 ${isFavourite ? "fill-current" : ""}`}
          style={{
            color: isFavourite ? "var(--orange)" : "var(--text-faint)",
          }}
        />
      </button>

      {/* Clickable area for adding to staging */}
      <button
        type="button"
        className="flex flex-1 items-center justify-between text-left"
        onClick={() => onSelect(entry.canonical)}
        aria-label={`Select ${entry.canonical}`}
      >
        <div className="min-w-0 flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <span className="min-w-0 max-w-[160px] truncate text-sm font-medium text-[var(--text)]">
              {entry.canonical}
            </span>
            {/* Zone badge */}
            <span
              className="rounded-full px-1.5 py-0.5 text-[9px] font-bold leading-none text-white"
              style={{ backgroundColor: zoneColor }}
              title={`Zone ${entry.zone}`}
            >
              Z{entry.zone}
            </span>
          </div>
          <span className="text-[10px] text-[var(--text-faint)]">{portionLabel}</span>
        </div>
        <span className="text-xs font-medium text-[var(--text-muted)]">{calories} kcal</span>
      </button>

      {/* Explicit + button */}
      <button
        type="button"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--orange)] text-white transition-colors hover:brightness-110 active:brightness-95"
        onClick={() => onSelect(entry.canonical)}
        aria-label={`Add ${entry.canonical} to staging`}
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

// ── NutritionCard (main export) ──────────────────────────────────────────────

interface NutritionCardProps {
  selectedDate?: Date;
  captureTimestamp?: number;
}

export function NutritionCard({ selectedDate, captureTimestamp }: NutritionCardProps) {
  const { state, dispatch, searchResults, stagingCount, stagingTotals } = useNutritionStore();
  const {
    totalCaloriesToday,
    totalMacrosToday,
    totalFluidsMl,
    waterOnlyMl,
    calorieGoal,
    fluidGoal,
    caloriesByMealSlot,
    logsByMealSlot,
    recentFoods,
    currentMealSlot,
  } = useNutritionData(selectedDate);
  const { favourites, toggleFavourite, isFavourite } = useFoodFavourites();
  const addSyncedLog = useAddSyncedLog();
  const removeSyncedLog = useRemoveSyncedLog();

  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Snapshot ref for stagingItems — allows callbacks to read current items
  // without listing state.stagingItems as a dependency (avoids callback churn).
  const stagingItemsRef = useRef(state.stagingItems);
  stagingItemsRef.current = state.stagingItems;

  // Snapshot ref for view — allows the Escape handler to read current view
  // without re-registering the listener on every view transition.
  const viewRef = useRef(state.view);
  viewRef.current = state.view;

  // Snapshot ref for searchQuery — allows the Escape handler to read current query.
  const searchQueryRef = useRef(state.searchQuery);
  searchQueryRef.current = state.searchQuery;

  // ── Search focus state (local, not in reducer) ──────────────────────────
  const [searchFocused, setSearchFocused] = useState(false);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchFocusedRef = useRef(false);
  searchFocusedRef.current = searchFocused;

  useEffect(() => {
    if (state.activeMealSlot === currentMealSlot) return;
    dispatch({ type: "SET_ACTIVE_MEAL_SLOT", slot: currentMealSlot });
  }, [currentMealSlot, dispatch, state.activeMealSlot]);

  const handleSearchFocus = useCallback(() => {
    // Cancel any pending blur timeout (user re-focused quickly)
    if (blurTimeoutRef.current !== null) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    setSearchFocused(true);
  }, []);

  const handleSearchBlur = useCallback(() => {
    // Delay blur so click events on result rows fire before focus is lost
    blurTimeoutRef.current = setTimeout(() => {
      setSearchFocused(false);
      blurTimeoutRef.current = null;
    }, 200);
  }, []);

  // Cleanup blur timeout on unmount
  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current !== null) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  // Filter recentFoods to only those with known portion data
  const knownRecentFoods = useMemo(() => filterToKnownFoods(recentFoods), [recentFoods]);

  // Whether the search zero-state is active (focused, empty query)
  const showSearchZeroState = searchFocused && state.searchQuery.trim().length === 0;

  // Whether to show the recent foods section within the zero-state
  const showRecentZeroState = showSearchZeroState && knownRecentFoods.length > 0;
  const surfaceSlot =
    state.view !== "none"
      ? undefined
      : searchFocused || state.searchQuery.trim().length > 0
        ? "search-view"
        : "collapsed-view";

  // ── Global escape handler (decision #15) ─────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;

      // First: if search has text, clear it.
      if (searchQueryRef.current.length > 0) {
        e.preventDefault();
        dispatch({ type: "SET_SEARCH_QUERY", query: "" });
        return;
      }

      if (searchFocusedRef.current) {
        e.preventDefault();
        setSearchFocused(false);
        searchInputRef.current?.blur();
        return;
      }

      // Second: if a panel is open, close it.
      if (viewRef.current !== "none") {
        e.preventDefault();
        dispatch({ type: "SET_VIEW", view: "none" });
        return;
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dispatch]);

  // ── Handlers ─────────────────────────────────────────────────────────────

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

  // Toggle between none and calorieDetail
  const handleExpandCalories = useCallback(() => {
    dispatch({ type: "SET_VIEW", view: "calorieDetail" });
  }, [dispatch]);

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
          timestamp: captureTimestamp ?? Date.now(),
          type: "fluid",
          data: { items: [{ name: "Water", quantity: amountMl, unit: "ml" }] },
        });
        toast(`Water ${amountMl}ml logged`);
        dispatch({ type: "CLOSE_WATER_MODAL" });
      } catch (err) {
        toast.error(getErrorMessage(err, "Failed to log water"));
      }
    },
    [addSyncedLog, captureTimestamp, dispatch],
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
    (id: string) => {
      dispatch({ type: "REMOVE_FROM_STAGING", id });
    },
    [dispatch],
  );

  const handleUpdateStagedQuantity = useCallback(
    (id: string, newQuantity: number) => {
      const item = stagingItemsRef.current.find((i) => i.id === id);
      if (item) {
        const delta = newQuantity - item.portionG;
        dispatch({ type: "ADJUST_STAGING_PORTION", id, delta });
      }
    },
    [dispatch],
  );

  const handleClearStaging = useCallback(() => {
    dispatch({ type: "CLEAR_STAGING" });
  }, [dispatch]);

  const handleLogStagedFood = useCallback(async () => {
    try {
      const data = buildStagedNutritionLogData(state.stagingItems, state.activeMealSlot);
      await addSyncedLog({
        timestamp: captureTimestamp ?? Date.now(),
        type: "food",
        data,
      });
      const hasUnmatched = state.stagingItems.some(
        (item) => !FOOD_PORTION_DATA.has(item.canonicalName),
      );
      if (hasUnmatched) {
        toast.info("Food logged — matching in background");
      } else {
        toast(`${state.stagingItems.length} item(s) logged`);
      }
      dispatch({ type: "RESET_AFTER_LOG" });
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to log food"));
    }
  }, [addSyncedLog, captureTimestamp, dispatch, state.activeMealSlot, state.stagingItems]);

  const handleLogRawInput = useCallback(async () => {
    const data = buildRawNutritionLogData(state.searchQuery, state.activeMealSlot);
    if (!data) {
      searchInputRef.current?.focus();
      return;
    }

    try {
      await addSyncedLog({
        timestamp: captureTimestamp ?? Date.now(),
        type: "food",
        data,
      });
      toast.info("Meal logged. Parsing in background.");
      dispatch({ type: "RESET_AFTER_LOG" });
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to log food"));
    }
  }, [addSyncedLog, captureTimestamp, dispatch, state.activeMealSlot, state.searchQuery]);

  const handleAddMore = useCallback(() => {
    dispatch({ type: "CLOSE_STAGING_MODAL" });
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

  const handleBackToNone = useCallback(() => {
    dispatch({ type: "SET_VIEW", view: "none" });
    setSearchFocused(false);
    searchInputRef.current?.blur();
  }, [dispatch]);

  // Log Food button: if items staged, open staging modal. Otherwise, focus search.
  const handleLogFoodButton = useCallback(() => {
    if (stagingItemsRef.current.length > 0) {
      dispatch({ type: "OPEN_STAGING_MODAL" });
      return;
    } else {
      if (searchQueryRef.current.trim().length > 0) {
        void handleLogRawInput();
        return;
      }
      searchInputRef.current?.focus();
    }
  }, [dispatch, handleLogRawInput]);

  const handleSearchSubmit = useCallback(() => {
    if (stagingItemsRef.current.length > 0) {
      dispatch({ type: "OPEN_STAGING_MODAL" });
      return;
    }
    if (searchQueryRef.current.trim().length === 0) return;
    void handleLogRawInput();
  }, [dispatch, handleLogRawInput]);

  // ── Derived state ───────────────────────────────────────────────────────

  const hasSearchResults = state.searchQuery.trim().length >= 3 && searchResults.length > 0;

  const hasSearchQueryButNoResults =
    state.searchQuery.trim().length >= 3 && searchResults.length === 0;

  const isTypingShortQuery =
    state.searchQuery.trim().length > 0 && state.searchQuery.trim().length < 3;

  const selectedDateLabel =
    selectedDate && !isSameDay(selectedDate, new Date())
      ? format(selectedDate, "EEE, MMM d")
      : null;

  // ── Header icons ─────────────────────────────────────────────────────────

  const headerIcons = useMemo(
    () => (
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
          <SlidersHorizontal className="h-5 w-5" style={{ color: "var(--orange)" }} />
        </button>
        <button
          type="button"
          className="rounded-md p-1 transition-colors hover:bg-[var(--surface-2)]"
          aria-label="Log water"
          onClick={handleOpenWater}
        >
          <Droplets className="h-5 w-5" style={{ color: "var(--water)" }} />
        </button>
      </div>
    ),
    [dispatch, handleOpenWater],
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

      {/* ── ALWAYS VISIBLE: Calorie ring ─── */}
      <CalorieRing
        consumed={totalCaloriesToday}
        goal={calorieGoal}
        onExpand={handleExpandCalories}
      />

      {/* ── Search + Log Food button state container ─── */}
      <div {...(surfaceSlot !== undefined && { "data-slot": surfaceSlot })} className="space-y-3">
        <div className="flex items-center gap-2">
          <NutritionSearchInput
            value={state.searchQuery}
            onChange={handleSearchChange}
            onClear={handleSearchClear}
            onFocus={handleSearchFocus}
            onBlur={handleSearchBlur}
            onSubmit={handleSearchSubmit}
            inputRef={searchInputRef}
            hasResults={hasSearchResults}
          />
          <button
            type="button"
            data-slot="log-food-button"
            className="shrink-0 rounded-full bg-[var(--orange)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:brightness-110 active:brightness-95"
            onClick={handleLogFoodButton}
            aria-label={stagingCount > 0 ? "Review staged food items" : "Log food"}
          >
            Log Food
            {stagingCount > 0 && (
              <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white/20 px-1 text-[10px] font-bold">
                {stagingCount}
              </span>
            )}
          </button>
        </div>

        {/* ── Logging to: Meal label — only visible when search/filter/favorites active ─── */}
        {surfaceSlot !== "collapsed-view" && (
          <span data-slot="meal-slot-label" className="text-xs text-[var(--text-muted)]">
            Logging to: {titleCase(state.activeMealSlot)}
            {selectedDateLabel ? ` · ${selectedDateLabel}` : ""}
          </span>
        )}
      </div>

      {/* ── ALWAYS VISIBLE: Water progress row ─── */}
      <WaterProgressRow
        intakeMl={totalFluidsMl}
        waterMl={waterOnlyMl}
        goalMl={fluidGoal}
        onOpenModal={handleOpenWater}
      />

      {/* ── SEARCH ZERO-STATE — recent foods + common drinks when focused with empty query ─── */}
      {showRecentZeroState && (
        <div data-slot="recent-foods" className="space-y-1">
          <h3 className="px-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Recent
          </h3>
          <ul className="max-h-64 space-y-0.5 overflow-y-auto" aria-label="Recent foods">
            {knownRecentFoods.slice(0, 10).map((canonical) => (
              <FoodRow
                key={canonical}
                canonicalName={canonical}
                displayName={titleCase(canonical)}
                portion={formatPortion(canonical)}
                calories={getDefaultCalories(canonical)}
                onAdd={handleAddToStaging}
              />
            ))}
          </ul>
        </div>
      )}

      {showSearchZeroState && COMMON_DRINKS.length > 0 && (
        <div data-slot="common-drinks" className="space-y-1">
          <h3 className="px-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Common Drinks
          </h3>
          <ul className="space-y-0.5" aria-label="Common drinks">
            {COMMON_DRINKS.map((entry) => (
              <FoodRow
                key={entry.canonical}
                canonicalName={entry.canonical}
                displayName={titleCase(entry.canonical)}
                portion={formatPortion(entry.canonical)}
                calories={getDefaultCalories(entry.canonical)}
                onAdd={handleAddToStaging}
              />
            ))}
          </ul>
        </div>
      )}

      {/* ── SEARCH RESULTS — inline, shown when query has results ─── */}
      {isTypingShortQuery && (
        <p className="px-3 py-2 text-xs text-[var(--text-faint)]">
          Type at least 3 characters to search, or press Enter to send the text to the meal parser.
        </p>
      )}

      {hasSearchResults && (
        <div
          id="nutrition-search-results"
          data-slot="search-results"
          className="max-h-64 space-y-0.5 overflow-y-auto"
          role="listbox"
          aria-label="Search results"
        >
          {searchResults.map((entry) => (
            <SearchResultRow
              key={entry.canonical}
              entry={entry}
              isFavourite={isFavourite(entry.canonical)}
              onSelect={handleAddToStaging}
              onToggleFavourite={toggleFavourite}
            />
          ))}
        </div>
      )}

      {hasSearchQueryButNoResults && (
        <div className="space-y-1 px-3 py-4 text-center text-xs text-[var(--text-faint)]">
          <p>No foods found for &ldquo;{state.searchQuery}&rdquo;</p>
          <p>Press Enter or tap Log Food to parse it anyway.</p>
        </div>
      )}

      {/* ── SECONDARY PANELS — one at a time, below water bar ─── */}
      {state.view === "calorieDetail" && (
        <CalorieDetailView
          macros={totalMacrosToday}
          caloriesByMealSlot={caloriesByMealSlot}
          logsByMealSlot={logsByMealSlot}
          onDeleteLog={handleDeleteLog}
        />
      )}

      {state.view === "favourites" && (
        <FavouritesView
          favourites={favourites}
          onAddToStaging={handleAddToStaging}
          onBack={handleBackToNone}
        />
      )}

      {state.view === "foodFilter" && (
        <FoodFilterView
          recentFoods={recentFoods}
          favourites={favourites}
          onAddToStaging={handleAddToStaging}
          onBack={handleBackToNone}
        />
      )}

      {/* ── MODALS (unchanged) ─── */}
      <LogFoodModal
        open={state.stagingModalOpen}
        stagedItems={state.stagingItems}
        stagingTotals={stagingTotals}
        onClose={handleCloseStagingModal}
        onRemoveItem={handleRemoveFromStaging}
        onUpdateQuantity={handleUpdateStagedQuantity}
        onClearAll={handleClearStaging}
        onLogFood={handleLogStagedFood}
        onAddMore={handleAddMore}
      />

      <WaterModal
        open={state.waterModalOpen}
        onClose={handleCloseWater}
        onLogWater={handleLogWater}
        totalFluidsMl={totalFluidsMl}
        waterOnlyMl={waterOnlyMl}
        goalMl={fluidGoal}
      />
    </section>
  );
}
