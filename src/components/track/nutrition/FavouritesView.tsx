/**
 * FavouritesView — displays the user's favourited foods as a list.
 *
 * Matches the reference design: dark background, heart icons, food names,
 * portion + calorie info, and orange (+) buttons to add to staging.
 *
 * Uses FOOD_PORTION_DATA for calories/portions — no mock data.
 */

import { ArrowLeft, Heart } from "lucide-react";
import { useMemo } from "react";
import {
  filterToKnownFoods,
  formatPortion,
  getDefaultCalories,
  titleCase,
} from "@/lib/nutritionUtils";
import { FoodRow } from "./FoodRow";

// ── Types ────────────────────────────────────────────────────────────────────

interface FavouritesViewProps {
  favourites: string[];
  onAddToStaging: (canonicalName: string) => void;
  onBack: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export function FavouritesView({
  favourites,
  onAddToStaging,
  onBack,
}: FavouritesViewProps) {
  // Filter to only foods that exist in FOOD_PORTION_DATA
  const validFavourites = useMemo(
    () => filterToKnownFoods(favourites),
    [favourites],
  );

  return (
    <div data-slot="favourites-view" className="space-y-3">
      {/* Header row */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
          aria-label="Back to nutrition card"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">
          Favourites
        </span>
      </div>

      {/* Favourites list */}
      {validFavourites.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Heart className="h-8 w-8 text-[var(--text-faint)]" />
          <p className="text-sm text-[var(--text-muted)]">No favourites yet</p>
          <p className="text-xs text-[var(--text-faint)]">
            Tap the heart icon on any food to add it here.
          </p>
        </div>
      ) : (
        <ul className="space-y-1" aria-label="Favourite foods">
          {validFavourites.map((canonicalName) => (
            <FoodRow
              key={canonicalName}
              canonicalName={canonicalName}
              displayName={titleCase(canonicalName)}
              portion={formatPortion(canonicalName)}
              calories={getDefaultCalories(canonicalName)}
              onAdd={onAddToStaging}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
