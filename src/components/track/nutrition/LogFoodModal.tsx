/**
 * LogFoodModal — staging confirmation modal for the Nutrition Card.
 *
 * Shows staged food items with quantity adjustment (+/- buttons),
 * per-item calories, aggregated totals, and macro pills.
 * Users can log the food, add more items, remove items, or clear all.
 *
 * Reads from FOOD_PORTION_DATA for macro computation.
 * Uses computeStagingTotals from useNutritionStore for aggregation.
 *
 * Ref: docs/plans/Worktree spec/user-annotations/22_log_food_modal_reference.png
 * Decisions: #3 Staging Modal, #13 Aggregation, #21 Natural units, #22 Macros
 */

import { Minus, Plus, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { computeStagingTotals, type StagedItem } from "./useNutritionStore";

// ── Types ──────────────────────────────────────────────────────────────────

export interface LogFoodModalProps {
  open: boolean;
  stagedItems: StagedItem[];
  onClose: () => void;
  onRemoveItem: (id: string) => void;
  onUpdateQuantity: (id: string, newQuantity: number) => void;
  onClearAll: () => void;
  onLogFood: () => void;
  onAddMore: () => void;
}

// ── Constants ──────────────────────────────────────────────────────────────

/** Macro pill display config — matches NutritionCard MACRO_CONFIG colors. */
const MACRO_PILL_CONFIG: ReadonlyArray<{
  key: "protein" | "carbs" | "fat" | "sugars" | "fiber";
  label: string;
  color: string;
}> = [
  { key: "protein", label: "Protein", color: "#f97316" },
  { key: "carbs", label: "Carbs", color: "#34d399" },
  { key: "fat", label: "Fat", color: "#f87171" },
  { key: "sugars", label: "Sugars", color: "#fbbf24" },
  { key: "fiber", label: "Fibre", color: "#818cf8" },
];

/** Fallback increment when a food has no unitWeightG. */
const DEFAULT_INCREMENT_G = 10;

// ── Helpers ────────────────────────────────────────────────────────────────

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Format a portion weight for display.
 * Shows natural unit count alongside grams when available.
 * e.g. "150g" or "2 slices (72g)"
 */
function formatPortion(item: StagedItem): string {
  if (item.naturalUnit != null && item.unitWeightG != null && item.unitWeightG > 0) {
    const unitCount = Math.round((item.portionG / item.unitWeightG) * 10) / 10;
    // Show as "Ng" if unit count is not a clean number
    if (unitCount === Math.round(unitCount) && unitCount > 0) {
      return `${unitCount} ${item.naturalUnit}${unitCount !== 1 ? "s" : ""} (${Math.round(item.portionG)}g)`;
    }
  }
  return `${Math.round(item.portionG)}g`;
}

/**
 * Get the increment/decrement step for a staged item.
 * Uses unitWeightG if available, otherwise DEFAULT_INCREMENT_G.
 */
function getStep(item: StagedItem): number {
  return item.unitWeightG ?? DEFAULT_INCREMENT_G;
}

// ── Food Item Row ──────────────────────────────────────────────────────────

function FoodItemRow({
  item,
  onUpdateQuantity,
  onRemoveItem,
}: {
  item: StagedItem;
  onUpdateQuantity: (id: string, newQuantity: number) => void;
  onRemoveItem: (id: string) => void;
}) {
  const step = getStep(item);
  const canDecrement = item.portionG > step;

  return (
    <div
      data-slot="log-food-item"
      className="flex items-center justify-between gap-2 rounded-lg px-2 py-2"
    >
      {/* Left: name + calories */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-semibold text-[var(--text)]">
          {capitalize(item.displayName)}
        </span>
        <span className="text-xs text-[var(--text-faint)]">{item.calories} kcal</span>
      </div>

      {/* Center: quantity controls */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--color-border-default)] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)] disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={() => onUpdateQuantity(item.id, item.portionG - step)}
          disabled={!canDecrement}
          aria-label={`Decrease ${item.displayName} portion`}
        >
          <Minus className="h-3.5 w-3.5" />
        </button>

        <span className="min-w-[60px] text-center text-sm font-medium text-[var(--text)]">
          {formatPortion(item)}
        </span>

        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--color-border-default)] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)]"
          onClick={() => onUpdateQuantity(item.id, item.portionG + step)}
          aria-label={`Increase ${item.displayName} portion`}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Right: remove button */}
      <button
        type="button"
        className="ml-1 flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-faint)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--red)]"
        onClick={() => onRemoveItem(item.id)}
        aria-label={`Remove ${item.displayName}`}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── Macro Pill ──────────────────────────────────────────────────────────────

function MacroPill({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div
      data-slot="macro-pill"
      className="flex items-center gap-1 rounded-full px-2.5 py-1"
      style={{ backgroundColor: `${color}20` }}
    >
      <span className="text-xs font-bold" style={{ color }}>
        {value}g
      </span>
      <span className="text-[10px] text-[var(--text-muted)]">{label}</span>
    </div>
  );
}

// ── LogFoodModal ───────────────────────────────────────────────────────────

export function LogFoodModal({
  open,
  stagedItems,
  onClose,
  onRemoveItem,
  onUpdateQuantity,
  onClearAll,
  onLogFood,
  onAddMore,
}: LogFoodModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // ── Focus trap + Escape handler ────────────────────────────────────────

  useEffect(() => {
    if (!open) return;

    // Save currently focused element to restore later
    previousFocusRef.current = document.activeElement as HTMLElement | null;

    // Focus the dialog container
    const timer = setTimeout(() => {
      dialogRef.current?.focus();
    }, 0);

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      // Focus trap: Tab cycles within the dialog
      if (e.key === "Tab" && dialogRef.current) {
        const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusableElements.length === 0) return;

        const first = focusableElements[0];
        const last = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", handleKeyDown);
      // Restore focus
      previousFocusRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  // ── Compute totals ─────────────────────────────────────────────────────

  const totals = computeStagingTotals(stagedItems);
  const itemCount = stagedItems.length;
  const itemLabel = itemCount === 1 ? "1 item" : `${itemCount} items`;

  return (
    <>
      {/* Backdrop */}
      <div
        data-slot="log-food-backdrop"
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        data-slot="log-food-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Log Food"
        tabIndex={-1}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 outline-none"
      >
        {/* biome-ignore lint/a11y/noStaticElementInteractions: stopPropagation prevents backdrop click-through; not interactive */}
        <div
          className="w-full max-w-md rounded-2xl border border-[var(--color-border-default)] bg-[var(--card)] shadow-xl"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {/* ── Header ─────────────────────────────────────────────── */}
          <div
            data-slot="log-food-header"
            className="flex items-start justify-between border-b border-[var(--surface-3)] px-4 pt-4 pb-3"
          >
            <div className="flex flex-col gap-0.5">
              <h2 className="text-lg font-bold font-display" style={{ color: "var(--orange)" }}>
                Log Food
              </h2>
              <span className="text-xs text-[var(--text-muted)]">{itemLabel}</span>
            </div>

            <div className="flex items-center gap-2">
              {stagedItems.length > 0 && (
                <button
                  type="button"
                  className="rounded-md px-2 py-1 text-xs font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--red)]"
                  onClick={onClearAll}
                  aria-label="Clear all staged items"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-faint)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                onClick={onClose}
                aria-label="Close Log Food modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* ── Food items list ─────────────────────────────────────── */}
          <div data-slot="log-food-items" className="max-h-64 overflow-y-auto px-4 py-2">
            {stagedItems.length === 0 ? (
              <p className="py-6 text-center text-sm italic text-[var(--text-faint)]">
                No items staged. Tap "add more..." to search.
              </p>
            ) : (
              <div className="space-y-1">
                {stagedItems.map((item) => (
                  <FoodItemRow
                    key={item.id}
                    item={item}
                    onUpdateQuantity={onUpdateQuantity}
                    onRemoveItem={onRemoveItem}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Totals + Macros ─────────────────────────────────────── */}
          {stagedItems.length > 0 && (
            <div
              data-slot="log-food-totals"
              className="border-t border-[var(--surface-3)] px-4 py-3"
            >
              {/* Total row */}
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-[var(--text)]">Total</span>
                <span className="text-sm font-bold text-[var(--text)]">{totals.calories} kcal</span>
              </div>

              {/* Macro pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                {MACRO_PILL_CONFIG.map((m) => (
                  <MacroPill key={m.key} value={totals[m.key]} label={m.label} color={m.color} />
                ))}
              </div>
            </div>
          )}

          {/* ── Action buttons ─────────────────────────────────────── */}
          <div
            data-slot="log-food-actions"
            className="flex items-center gap-3 border-t border-[var(--surface-3)] px-4 py-3"
          >
            <button
              type="button"
              className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white transition-colors hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: "var(--orange)" }}
              onClick={onLogFood}
              disabled={stagedItems.length === 0}
            >
              Log Food
            </button>
            <button
              type="button"
              className="flex-1 rounded-xl border-2 py-2.5 text-sm font-bold transition-colors hover:opacity-90"
              style={{
                borderColor: "var(--orange)",
                color: "var(--orange)",
              }}
              onClick={onAddMore}
            >
              add more...
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
