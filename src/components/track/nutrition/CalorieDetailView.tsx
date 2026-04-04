/**
 * CalorieDetailView — expanded calorie breakdown for the Nutrition Card.
 *
 * Shows: segmented meal breakdown bar, 5-column macro row,
 * one-open-at-a-time meal slot accordions with food items and delete buttons.
 *
 * Spec: W2-05 — C's segmented color bar, C's per-slot calories,
 * 5-column macros, B's one-open-at-a-time accordion.
 * Corrected meal times: breakfast 5-9am, lunch 1-4pm, dinner 8-11pm, else snack.
 * Delete button on food rows via removeSyncedLog.
 */

import { FOOD_PORTION_DATA } from "@shared/foodPortionData";
import { ChevronDown, ChevronUp, Flame, Trash2 } from "lucide-react";
import React, { useCallback, useState } from "react";
import { computeMacrosForPortion, type MealSlot } from "@/lib/nutritionUtils";
import type { SyncedLog } from "@/lib/sync";
import type { FoodItem } from "@/types/domain";

// ── Types ──────────────────────────────────────────────────────────────────

/** Narrowed SyncedLog for food pipeline types. */
type FoodPipelineLog = SyncedLog & { type: "food" | "liquid" };

export interface CalorieDetailViewProps {
  macros: {
    protein: number;
    carbs: number;
    fat: number;
    sugars: number;
    fiber: number;
  };
  caloriesByMealSlot: Record<MealSlot, number>;
  logsByMealSlot: Record<MealSlot, FoodPipelineLog[]>;
  onDeleteLog: (logId: string) => void;
}

// ── Constants ──────────────────────────────────────────────────────────────

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

// ── Helpers ────────────────────────────────────────────────────────────────

function getFoodItems(log: FoodPipelineLog): FoodItem[] {
  return log.data.items;
}

function getDisplayName(item: FoodItem): string {
  return (
    item.canonicalName ??
    item.parsedName ??
    item.name ??
    item.userSegment ??
    "Unknown food"
  );
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

/**
 * Resolve effective portion weight and compute macros for a single food item.
 * Delegates scaling to the consolidated `computeMacrosForPortion()`.
 */
function getItemMacros(item: FoodItem) {
  const canonical = item.canonicalName;
  if (canonical == null) return ZERO_MACROS;

  // Resolve effective portion weight (mirrors getEffectivePortionG in nutritionUtils)
  let portionG = 0;
  if (item.quantity != null && item.quantity > 0) {
    portionG = item.quantity;
  } else {
    const portionData = FOOD_PORTION_DATA.get(canonical);
    portionG = portionData?.defaultPortionG ?? 0;
  }

  const macros = computeMacrosForPortion(canonical, portionG);
  return { ...macros, portionG };
}

// ── Meal Breakdown Bar ────────────────────────────────────────────────────

function MealBreakdownBar({
  caloriesByMealSlot,
}: {
  caloriesByMealSlot: Record<MealSlot, number>;
}) {
  const total = MEAL_SLOT_CONFIG.reduce(
    (sum, s) => sum + caloriesByMealSlot[s.slot],
    0,
  );

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

// ── Macro Row ─────────────────────────────────────────────────────────────

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
    <div
      data-slot="macro-summary"
      className="flex items-start justify-between gap-1 px-1"
    >
      {MACRO_CONFIG.map((m) => (
        <div key={m.key} className="flex flex-col items-center gap-0.5">
          <span className="text-lg font-bold" style={{ color: m.color }}>
            {macros[m.key]}
            <span className="text-sm font-normal">g</span>
          </span>
          <span className="text-[10px] text-[var(--text-faint)]">
            {m.label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Meal Slot Accordion ───────────────────────────────────────────────────

const MealSlotAccordion = React.memo(function MealSlotAccordion({
  config,
  logs,
  totalCalories,
  isOpen,
  slot,
  setOpenSlot,
  onDeleteLog,
}: {
  config: (typeof MEAL_SLOT_CONFIG)[number];
  logs: FoodPipelineLog[];
  totalCalories: number;
  isOpen: boolean;
  slot: MealSlot;
  setOpenSlot: React.Dispatch<React.SetStateAction<MealSlot | null>>;
  onDeleteLog: (logId: string) => void;
}) {
  const itemCount = logs.reduce(
    (acc, log) => acc + getFoodItems(log).length,
    0,
  );
  const hasEntries = itemCount > 0;

  const handleToggle = useCallback(() => {
    if (hasEntries) {
      setOpenSlot((prev) => (prev === slot ? null : slot));
    }
  }, [hasEntries, setOpenSlot, slot]);

  return (
    <div
      data-slot="meal-slot-accordion"
      className="border-b border-[var(--surface-3)] last:border-b-0"
    >
      {/* Accordion header */}
      <button
        type="button"
        className="flex w-full items-center gap-3 px-2 py-3 text-left transition-colors hover:bg-[var(--surface-2)]"
        onClick={handleToggle}
        aria-expanded={isOpen}
        aria-label={`${config.label}: ${hasEntries ? `${totalCalories} kcal, ${itemCount} items` : "No entries"}`}
        disabled={!hasEntries}
      >
        {/* Time */}
        <span className="w-12 shrink-0 text-xs text-[var(--text-faint)]">
          {config.time}
        </span>

        {/* Meal name */}
        <span className="font-semibold text-sm text-[var(--text)]">
          {config.label}
        </span>

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
          <span className="text-sm text-[var(--text-muted)]">
            {totalCalories} kcal
          </span>
        ) : (
          <span className="text-xs italic text-[var(--text-faint)]">
            No entries
          </span>
        )}

        {/* Chevron */}
        {hasEntries && (
          <span className="ml-1 text-[var(--text-faint)]" aria-hidden="true">
            {isOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
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
                    <span className="text-sm font-semibold text-[var(--text)]">
                      {displayName}
                    </span>
                    <span className="text-[11px] text-[var(--text-faint)]">
                      {macros.portionG}g &middot; {macros.protein}g P &middot;{" "}
                      {macros.carbs}g C &middot; {macros.fat}g F
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
});

// ── CalorieDetailView ─────────────────────────────────────────────────────

export function CalorieDetailView({
  macros,
  caloriesByMealSlot,
  logsByMealSlot,
  onDeleteLog,
}: CalorieDetailViewProps) {
  const [openSlot, setOpenSlot] = useState<MealSlot | null>(null);

  return (
    <div data-slot="calorie-detail" className="space-y-4">
      {/* Meal breakdown bar */}
      <MealBreakdownBar caloriesByMealSlot={caloriesByMealSlot} />

      {/* Macro row */}
      <MacroRow macros={macros} />

      {/* Meal slot accordions (one open at a time) */}
      <div className="overflow-hidden rounded-xl border border-[var(--surface-3)] bg-[var(--surface-1)]">
        {MEAL_SLOT_CONFIG.map((config) => (
          <MealSlotAccordion
            key={config.slot}
            config={config}
            logs={logsByMealSlot[config.slot]}
            totalCalories={caloriesByMealSlot[config.slot]}
            isOpen={openSlot === config.slot}
            slot={config.slot}
            setOpenSlot={setOpenSlot}
            onDeleteLog={onDeleteLog}
          />
        ))}
      </div>
    </div>
  );
}
