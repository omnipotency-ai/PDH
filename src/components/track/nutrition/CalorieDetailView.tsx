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
 *
 * Fixes applied:
 *   #39  — dotColor removed; single `color` field in MEAL_SLOT_CONFIG.
 *   #40  — accordion uses CSS grid-rows transition instead of instant show/hide.
 *   #41  — food item keys use canonicalName/parsedName instead of array index.
 *   #43  — getDisplayName, getFoodItems, getItemMacros moved to nutritionUtils.ts.
 *   #54  — empty state when no meal entries exist across all slots.
 *   #64/#65 — no Record<string,any>, no biome-ignore; all types from domain.
 *   #78  — itemCount memoized inside MealSlotAccordion.
 */

import { ChevronDown, ChevronUp, Flame, Trash2 } from "lucide-react";
import React, { useCallback, useMemo, useState } from "react";
import { getDisplayName, getFoodItems, getItemMacros, type MealSlot } from "@/lib/nutritionUtils";
import type { SyncedLog } from "@/lib/sync";

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

/**
 * Meal slot display config.
 * #39: `color` is the single field; dotColor was redundant and has been removed.
 */
const MEAL_SLOT_CONFIG: ReadonlyArray<{
  slot: MealSlot;
  label: string;
  time: string;
  color: string;
}> = [
  {
    slot: "breakfast",
    label: "Breakfast",
    time: "07:00",
    color: "var(--orange)",
  },
  { slot: "lunch", label: "Lunch", time: "13:00", color: "#34d399" },
  { slot: "dinner", label: "Dinner", time: "20:00", color: "#a78bfa" },
  { slot: "snack", label: "Snack", time: "15:00", color: "#fbbf24" },
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

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ── Meal Breakdown Bar ────────────────────────────────────────────────────

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

      {/* Legend — uses config.color for dot (#39: no dotColor) */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {MEAL_SLOT_CONFIG.map((config) => (
          <div key={config.slot} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: config.color }}
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
  // #78: memoize itemCount to avoid re-traversing logs on every render.
  const itemCount = useMemo(
    () => logs.reduce((acc, log) => acc + getFoodItems(log).length, 0),
    [logs],
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

      {/*
       * #40: CSS grid-rows transition for smooth expand/collapse.
       * grid-rows-[0fr] collapses the inner div to zero height.
       * grid-rows-[1fr] expands it to natural height.
       * The inner div needs overflow-hidden so the grid can actually collapse it.
       */}
      <div
        className={[
          "grid transition-[grid-template-rows] duration-300 ease-in-out",
          isOpen && hasEntries ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        ].join(" ")}
        aria-hidden={!isOpen}
      >
        <div className="overflow-hidden">
          <div className="space-y-1 pb-2 pl-14 pr-2">
            {logs.flatMap((log) =>
              getFoodItems(log).map((item) => {
                const macros = getItemMacros(item);
                const displayName = capitalize(getDisplayName(item));
                // #41: stable key uses canonicalName or parsedName; falls back to
                // name, then userSegment. log.id scopes it to this log entry.
                const itemKey = `${log.id}-${item.canonicalName ?? item.parsedName ?? item.name ?? item.userSegment ?? displayName}`;
                return (
                  <div
                    key={itemKey}
                    className="flex items-start justify-between gap-2 rounded-lg px-2 py-2 hover:bg-[var(--surface-2)]"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-semibold text-[var(--text)]">
                        {displayName}
                      </span>
                      <span className="text-[11px] text-[var(--text-faint)]">
                        {macros.portionG}g · {macros.protein}g P · {macros.carbs}g C · {macros.fat}g
                        F · {macros.sugars}g S · {`${macros.fiber}g Fi`}
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
        </div>
      </div>
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

  // #54: compute whether any food has been logged today, for the empty state.
  const totalEntryCount = useMemo(
    () =>
      MEAL_SLOT_CONFIG.reduce(
        (sum, config) =>
          sum + logsByMealSlot[config.slot].reduce((acc, log) => acc + getFoodItems(log).length, 0),
        0,
      ),
    [logsByMealSlot],
  );

  return (
    <div data-slot="calorie-detail" className="space-y-4">
      {/* Meal breakdown bar */}
      <MealBreakdownBar caloriesByMealSlot={caloriesByMealSlot} />

      {/* Macro row */}
      <MacroRow macros={macros} />

      {/* Meal slot accordions (one open at a time) */}
      <div className="overflow-hidden rounded-xl border border-[var(--surface-3)] bg-[var(--surface-1)]">
        {/* #54: top-level empty state when no food has been logged today */}
        {totalEntryCount === 0 && (
          <div
            className="flex flex-col items-center gap-1 px-4 py-6 text-center"
            role="status"
            aria-label="No food logged today"
          >
            <span className="text-sm font-medium text-[var(--text-muted)]">
              No food logged today
            </span>
            <span className="text-xs text-[var(--text-faint)]">
              Log a meal to see your breakdown here.
            </span>
          </div>
        )}

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
