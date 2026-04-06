/**
 * FoodRow — shared row component for food lists.
 *
 * Used by FavouritesView and FoodFilterView. Displays a food item with
 * heart icon, name, portion + calorie info, and an add button.
 *
 * Wrapped in React.memo to prevent re-renders when parent ticks
 * but row props haven't changed.
 */

import { Heart, Plus } from "lucide-react";
import { memo } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

interface FoodRowProps {
  canonicalName: string;
  displayName: string;
  portion: string;
  calories: number;
  dataSlot?: string;
  /** When undefined, heart is always filled (e.g. FavouritesView). */
  isFavourite?: boolean;
  onAdd: (canonicalName: string) => void;
  onToggleFavourite?: (canonicalName: string) => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export const FoodRow = memo(function FoodRow({
  canonicalName,
  displayName,
  portion,
  calories,
  dataSlot = "food-row",
  isFavourite,
  onAdd,
  onToggleFavourite,
}: FoodRowProps) {
  // When isFavourite is undefined, always show filled heart (FavouritesView context)
  const isFilled = isFavourite === undefined || isFavourite;

  return (
    <li
      data-slot={dataSlot}
      className="flex list-none items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-[var(--surface-2)]"
    >
      {/* Heart icon */}
      {onToggleFavourite ? (
        <button
          type="button"
          onClick={() => onToggleFavourite(canonicalName)}
          className="shrink-0 p-0"
          aria-label={
            isFilled ? `Remove ${displayName} from favourites` : `Add ${displayName} to favourites`
          }
        >
          <Heart
            className={`h-4 w-4 ${isFilled ? "fill-current" : ""}`}
            style={{ color: isFilled ? "var(--orange)" : "var(--text-faint)" }}
          />
        </button>
      ) : (
        <Heart
          className={`h-4 w-4 shrink-0 ${isFilled ? "fill-current" : ""}`}
          style={{ color: isFilled ? "var(--orange)" : "var(--text-faint)" }}
          aria-hidden="true"
        />
      )}

      {/* Food name */}
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--text)]">
        {displayName}
      </span>

      {/* Portion + calories */}
      <span className="shrink-0 text-xs text-[var(--text-muted)]">
        {portion}
        {portion && calories > 0 ? " · " : ""}
        {calories > 0 ? `${calories} kcal` : ""}
      </span>

      {/* Add button */}
      <button
        type="button"
        onClick={() => onAdd(canonicalName)}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors"
        style={{
          backgroundColor: "color-mix(in srgb, var(--orange) 15%, transparent)",
          color: "var(--orange)",
        }}
        aria-label={`Add ${displayName} to staging`}
      >
        <Plus className="h-4 w-4" />
      </button>
    </li>
  );
});
