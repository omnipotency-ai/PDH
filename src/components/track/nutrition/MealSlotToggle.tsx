/**
 * MealSlotToggle — row of meal slot chips for filtering food views.
 *
 * Tap a slot to filter. Tap the active slot to deselect (show all).
 * Appears in QuickPicks, Favourites, and Browse views.
 */

import { type MealSlot, titleCase } from "@/lib/nutritionUtils";

const SLOTS: ReadonlyArray<MealSlot> = ["breakfast", "lunch", "dinner", "snack"];

interface MealSlotToggleProps {
  /** Currently active slot filter. null = all slots (unfiltered). */
  activeSlot: MealSlot | null;
  onToggle: (slot: MealSlot) => void;
}

export function MealSlotToggle({ activeSlot, onToggle }: MealSlotToggleProps) {
  return (
    <div data-slot="meal-slot-toggle" className="flex flex-wrap gap-1.5">
      {SLOTS.map((slot) => {
        const isActive = slot === activeSlot;
        return (
          <button
            key={slot}
            type="button"
            onClick={() => onToggle(slot)}
            className="rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors"
            style={{
              borderColor: isActive ? "var(--orange)" : "var(--color-border-default)",
              backgroundColor: isActive
                ? "color-mix(in srgb, var(--orange) 16%, transparent)"
                : "transparent",
              color: isActive ? "var(--orange)" : "var(--text-muted)",
            }}
            aria-pressed={isActive}
          >
            {titleCase(slot)}
          </button>
        );
      })}
    </div>
  );
}
