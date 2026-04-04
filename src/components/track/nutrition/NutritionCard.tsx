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
  ChevronDown,
  ChevronUp,
  Droplet,
  Flame,
  Heart,
  Mic,
  SlidersHorizontal,
  Trash2,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useNutritionData } from "@/hooks/useNutritionData";
import { useFoodFavourites } from "@/hooks/useProfile";
import type { MealSlot } from "@/lib/nutritionUtils";
import type { SyncedLog } from "@/lib/sync";
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

/** Meal slot display config. */
const MEAL_SLOT_CONFIG: ReadonlyArray<{
  slot: MealSlot;
  label: string;
  time: string;
  color: string;
  dotColor: string;
}> = [
  {
    slot: "breakfast",
    label: "Breakfast",
    time: "07:00",
    color: "var(--orange)",
    dotColor: "var(--orange)",
  },
  {
    slot: "lunch",
    label: "Lunch",
    time: "13:00",
    color: "#34d399",
    dotColor: "#34d399",
  },
  {
    slot: "dinner",
    label: "Dinner",
    time: "20:00",
    color: "#a78bfa",
    dotColor: "#a78bfa",
  },
  {
    slot: "snack",
    label: "Snack",
    time: "15:00",
    color: "#fbbf24",
    dotColor: "#fbbf24",
  },
];

/** Macro display config. */
const MACRO_CONFIG: ReadonlyArray<{
  key: "protein" | "carbs" | "sugars" | "fat" | "fiber";
  label: string;
  color: string;
}> = [
  { key: "protein", label: "Proteins", color: "#f97316" },
  { key: "carbs", label: "Carbs", color: "#34d399" },
  { key: "sugars", label: "Sugars", color: "#fbbf24" },
  { key: "fat", label: "Fats", color: "#f87171" },
  { key: "fiber", label: "Fiber", color: "#818cf8" },
];

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
          <span className="text-3xl font-bold text-[var(--text)]">{consumed}</span>
          <span className="text-base text-[var(--text-muted)]">/ {goal} kcal</span>
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
      <Droplet className="h-5 w-5 shrink-0" style={{ color: "#42BCB8" }} aria-hidden="true" />
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

// ── Meal Breakdown Bar ──────────────────────────────────────────────────────

function MealBreakdownBar({
  caloriesByMealSlot,
}: {
  caloriesByMealSlot: Record<MealSlot, number>;
}) {
  const total = MEAL_SLOT_CONFIG.reduce((sum, s) => sum + caloriesByMealSlot[s.slot], 0);

  return (
    <div data-slot="meal-breakdown" className="space-y-2">
      {/* Stacked horizontal bar */}
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-[var(--surface-3)]">
        {MEAL_SLOT_CONFIG.map((config) => {
          const cals = caloriesByMealSlot[config.slot];
          const widthPercent = total > 0 ? (cals / total) * 100 : 0;
          if (widthPercent <= 0) return null;
          return (
            <div
              key={config.slot}
              className="h-full transition-[width] duration-500 ease-out"
              style={{
                width: `${widthPercent}%`,
                backgroundColor: config.color,
              }}
              title={`${config.label}: ${cals} kcal`}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {MEAL_SLOT_CONFIG.map((config) => (
          <div key={config.slot} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: config.dotColor }}
              aria-hidden="true"
            />
            <span className="text-xs text-[var(--text-muted)]">
              {config.label}{" "}
              <span className="font-semibold text-[var(--text)]">
                {caloriesByMealSlot[config.slot]}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Macro Row ───────────────────────────────────────────────────────────────

function MacroRow({
  macros,
}: {
  macros: {
    protein: number;
    carbs: number;
    fat: number;
    sugars: number;
    fiber: number;
  };
}) {
  return (
    <div data-slot="macro-summary" className="flex items-start justify-between gap-1 px-1">
      {MACRO_CONFIG.map((m) => (
        <div key={m.key} className="flex flex-col items-center gap-0.5">
          <span className="text-lg font-bold" style={{ color: m.color }}>
            {macros[m.key]}
            <span className="text-sm font-normal">g</span>
          </span>
          <span className="text-[10px] text-[var(--text-faint)]">{m.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Meal Slot Accordion ─────────────────────────────────────────────────────

/** Narrowed SyncedLog for food pipeline types. */
type FoodPipelineLog = SyncedLog & { type: "food" | "liquid" };

// biome-ignore lint/suspicious/noExplicitAny: SyncedLog data is loosely typed
function getFoodItems(log: FoodPipelineLog): Array<Record<string, any>> {
  return Array.isArray(log.data?.items) ? log.data.items : [];
}

// biome-ignore lint/suspicious/noExplicitAny: SyncedLog item shape is dynamic
function getDisplayName(item: Record<string, any>): string {
  return item.canonicalName ?? item.parsedName ?? item.name ?? item.userSegment ?? "Unknown food";
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

const ZERO_MACROS = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  sugars: 0,
  fiber: 0,
  portionG: 0,
};

// biome-ignore lint/suspicious/noExplicitAny: SyncedLog item shape is dynamic
function getItemMacros(item: Record<string, any>) {
  const canonical = item.canonicalName;
  if (canonical == null) return ZERO_MACROS;

  const portionData = FOOD_PORTION_DATA.get(canonical);
  if (!portionData) return ZERO_MACROS;

  const portionG =
    item.quantity != null && item.quantity > 0 ? item.quantity : portionData.defaultPortionG;
  const scale = portionG / 100;

  return {
    calories: Math.round((portionData.caloriesPer100g ?? 0) * scale),
    protein: Math.round((portionData.proteinPer100g ?? 0) * scale * 10) / 10,
    carbs: Math.round((portionData.carbsPer100g ?? 0) * scale * 10) / 10,
    fat: Math.round((portionData.fatPer100g ?? 0) * scale * 10) / 10,
    sugars: Math.round((portionData.sugarsPer100g ?? 0) * scale * 10) / 10,
    fiber: Math.round((portionData.fiberPer100g ?? 0) * scale * 10) / 10,
    portionG,
  };
}

function MealSlotAccordion({
  config,
  logs,
  totalCalories,
  isOpen,
  onToggle,
  onDeleteLog,
}: {
  config: (typeof MEAL_SLOT_CONFIG)[number];
  logs: FoodPipelineLog[];
  totalCalories: number;
  isOpen: boolean;
  onToggle: () => void;
  onDeleteLog: (logId: string) => void;
}) {
  const itemCount = logs.reduce((acc, log) => acc + getFoodItems(log).length, 0);
  const hasEntries = itemCount > 0;

  return (
    <div
      data-slot="meal-slot-accordion"
      className="border-b border-[var(--surface-3)] last:border-b-0"
    >
      {/* Accordion header */}
      <button
        type="button"
        className="flex w-full items-center gap-3 px-2 py-3 text-left transition-colors hover:bg-[var(--surface-2)]"
        onClick={() => {
          if (hasEntries) onToggle();
        }}
        aria-expanded={isOpen}
        aria-label={`${config.label}: ${hasEntries ? `${totalCalories} kcal, ${itemCount} items` : "No entries"}`}
        disabled={!hasEntries}
      >
        {/* Time */}
        <span className="w-12 shrink-0 text-xs text-[var(--text-faint)]">{config.time}</span>

        {/* Meal name */}
        <span className="font-semibold text-sm text-[var(--text)]">{config.label}</span>

        {/* Count badge */}
        {hasEntries && (
          <span
            className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ backgroundColor: config.color }}
            role="status"
            aria-label={`${itemCount} items`}
          >
            {itemCount}
          </span>
        )}

        {/* Spacer */}
        <span className="flex-1" />

        {/* Calories or "No entries" */}
        {hasEntries ? (
          <span className="text-sm text-[var(--text-muted)]">{totalCalories} kcal</span>
        ) : (
          <span className="text-xs italic text-[var(--text-faint)]">No entries</span>
        )}

        {/* Chevron */}
        {hasEntries && (
          <span className="ml-1 text-[var(--text-faint)]" aria-hidden="true">
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </span>
        )}
      </button>

      {/* Expanded: food items */}
      {isOpen && hasEntries && (
        <div className="space-y-1 pb-2 pl-14 pr-2">
          {logs.flatMap((log) =>
            getFoodItems(log).map((item, idx) => {
              const macros = getItemMacros(item);
              const displayName = capitalize(getDisplayName(item));
              return (
                <div
                  key={`${log.id}-${idx}`}
                  className="flex items-start justify-between gap-2 rounded-lg px-2 py-2 hover:bg-[var(--surface-2)]"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-semibold text-[var(--text)]">{displayName}</span>
                    <span className="text-[11px] text-[var(--text-faint)]">
                      {macros.portionG}g &middot; {macros.protein}g P &middot; {macros.carbs}g C
                      &middot; {macros.fat}g F
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className="flex items-center gap-1 text-sm font-semibold"
                      style={{ color: "var(--orange)" }}
                    >
                      <Flame className="h-3.5 w-3.5" aria-hidden="true" />
                      {macros.calories}
                    </span>
                    <button
                      type="button"
                      className="rounded-md p-1 text-[var(--text-faint)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--red)]"
                      aria-label={`Delete ${displayName}`}
                      onClick={() => onDeleteLog(log.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            }),
          )}
        </div>
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
    ? Math.round(((portionData.caloriesPer100g ?? 0) * portionData.defaultPortionG) / 100)
    : 0;
  const portionLabel = portionData?.naturalUnit ?? `${portionData?.defaultPortionG ?? 0}g`;

  return (
    <button
      type="button"
      data-slot="search-result"
      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors hover:bg-[var(--surface-2)]"
      onClick={() => onSelect(entry.canonical)}
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-[var(--text)]">{entry.canonical}</span>
        <span className="text-[10px] text-[var(--text-faint)]">{portionLabel}</span>
      </div>
      <span className="text-xs font-medium text-[var(--text-muted)]">{calories} kcal</span>
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
        <p className="px-3 py-2 text-xs text-[var(--text-faint)]">Type at least 3 characters...</p>
      )}

      {searchResults.length > 0 && (
        <div
          className="max-h-64 space-y-0.5 overflow-y-auto"
          role="listbox"
          aria-label="Search results"
        >
          {searchResults.map((entry) => (
            <SearchResultRow key={entry.canonical} entry={entry} onSelect={onSelect} />
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
      <CalorieRing consumed={consumed} goal={goal} onExpand={onExpandCalories} />

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
      <WaterProgressRow intakeMl={waterIntakeMl} goalMl={waterGoalMl} onOpenModal={onOpenWater} />
    </div>
  );
}

// ── Calorie Detail View ────────────────────────────────────────────────────

function CalorieDetailView({
  consumed,
  goal,
  macros,
  waterIntakeMl,
  waterGoalMl,
  caloriesByMealSlot,
  logsByMealSlot,
  stagingCount,
  searchQuery,
  onExpandCalories,
  onOpenWater,
  onSearchFocus,
  onSearchChange,
  onSearchClear,
  onDeleteLog,
  searchInputRef,
}: {
  consumed: number;
  goal: number;
  macros: {
    protein: number;
    carbs: number;
    fat: number;
    sugars: number;
    fiber: number;
  };
  waterIntakeMl: number;
  waterGoalMl: number;
  caloriesByMealSlot: Record<MealSlot, number>;
  logsByMealSlot: Record<MealSlot, FoodPipelineLog[]>;
  stagingCount: number;
  searchQuery: string;
  onExpandCalories: () => void;
  onOpenWater: () => void;
  onSearchFocus: () => void;
  onSearchChange: (value: string) => void;
  onSearchClear: () => void;
  onDeleteLog: (logId: string) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [openSlot, setOpenSlot] = useState<MealSlot | null>(null);

  return (
    <div data-slot="calorie-detail-view" className="space-y-4">
      <CalorieRing consumed={consumed} goal={goal} onExpand={onExpandCalories} />

      {/* ── Water row ─── */}
      <WaterProgressRow intakeMl={waterIntakeMl} goalMl={waterGoalMl} onOpenModal={onOpenWater} />

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

      {/* ── Meal breakdown bar ─── */}
      <MealBreakdownBar caloriesByMealSlot={caloriesByMealSlot} />

      {/* ── Macro row ─── */}
      <MacroRow macros={macros} />

      {/* ── Meal slot accordions (one open at a time) ─── */}
      <div
        data-slot="calorie-detail"
        className="overflow-hidden rounded-xl border border-[var(--surface-3)] bg-[var(--surface-1)]"
      >
        {MEAL_SLOT_CONFIG.map((config) => (
          <MealSlotAccordion
            key={config.slot}
            config={config}
            logs={logsByMealSlot[config.slot] as FoodPipelineLog[]}
            totalCalories={caloriesByMealSlot[config.slot]}
            isOpen={openSlot === config.slot}
            onToggle={() => setOpenSlot(openSlot === config.slot ? null : config.slot)}
            onDeleteLog={onDeleteLog}
          />
        ))}
      </div>
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
    (_amountMl: number) => {
      // TODO: wire to actual fluid logging (FluidSection pattern)
      dispatch({ type: "CLOSE_WATER_MODAL" });
    },
    [dispatch],
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
      const item = state.stagingItems.find((i) => i.canonicalName === canonicalName);
      if (item) dispatch({ type: "REMOVE_FROM_STAGING", id: item.id });
    },
    [dispatch, state.stagingItems],
  );

  const handleUpdateStagedQuantity = useCallback(
    (canonicalName: string, newQuantity: number) => {
      const item = state.stagingItems.find((i) => i.canonicalName === canonicalName);
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

  const handleLogFood = useCallback(() => {
    // TODO: wire to actual food logging pipeline
    dispatch({ type: "RESET_AFTER_LOG" });
  }, [dispatch]);

  const handleAddMore = useCallback(() => {
    dispatch({ type: "CLOSE_STAGING_MODAL" });
    dispatch({ type: "SET_VIEW", view: "search" });
    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
  }, [dispatch]);

  const handleDeleteLog = useCallback((_logId: string) => {
    // TODO: wire to useRemoveSyncedLog
  }, []);

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
        <SlidersHorizontal className="h-5 w-5" style={{ color: "var(--orange)" }} />
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
        <CalorieDetailView
          consumed={totalCaloriesToday}
          goal={calorieGoal}
          macros={totalMacrosToday}
          waterIntakeMl={waterIntakeToday}
          waterGoalMl={waterGoal}
          caloriesByMealSlot={caloriesByMealSlot}
          logsByMealSlot={logsByMealSlot as Record<MealSlot, FoodPipelineLog[]>}
          stagingCount={stagingCount}
          searchQuery={state.searchQuery}
          onExpandCalories={handleExpandCalories}
          onOpenWater={handleOpenWater}
          onSearchFocus={handleSearchFocus}
          onSearchChange={handleSearchChange}
          onSearchClear={handleSearchClear}
          onDeleteLog={handleDeleteLog}
          searchInputRef={searchInputRef}
        />
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
