/**
 * FavouritesView — displays the user's favourited foods as a list.
 *
 * Matches the reference design: dark background, heart icons, food names,
 * portion + calorie info, and orange (+) buttons to add to staging.
 *
 * Uses FOOD_PORTION_DATA for calories/portions — no mock data.
 */

import { FOOD_PORTION_DATA } from "@shared/foodPortionData";
import { ArrowLeft, Heart, Plus } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface FavouritesViewProps {
  favourites: string[];
  onAddToStaging: (canonicalName: string) => void;
  onBack: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Capitalize the first letter of each word. */
function titleCase(str: string): string {
  return str
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Format portion display: "150g" or "1 medium egg (50g)". */
function formatPortion(canonicalName: string): string {
  const data = FOOD_PORTION_DATA.get(canonicalName);
  if (!data) return "";

  if (data.naturalUnit != null && data.unitWeightG != null) {
    return `${data.naturalUnit} (${data.defaultPortionG}g)`;
  }
  return `${data.defaultPortionG}g`;
}

/** Get calories for the default portion. */
function getDefaultCalories(canonicalName: string): number {
  const data = FOOD_PORTION_DATA.get(canonicalName);
  if (!data || data.caloriesPer100g == null) return 0;
  return Math.round((data.caloriesPer100g * data.defaultPortionG) / 100);
}

// ── Component ────────────────────────────────────────────────────────────────

export function FavouritesView({ favourites, onAddToStaging, onBack }: FavouritesViewProps) {
  // Filter to only foods that exist in FOOD_PORTION_DATA
  const validFavourites = favourites.filter((name) => FOOD_PORTION_DATA.has(name));

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
          {validFavourites.map((canonicalName) => {
            const portion = formatPortion(canonicalName);
            const calories = getDefaultCalories(canonicalName);

            return (
              <FavouriteRow
                key={canonicalName}
                canonicalName={canonicalName}
                displayName={titleCase(canonicalName)}
                portion={portion}
                calories={calories}
                onAdd={onAddToStaging}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── FavouriteRow ─────────────────────────────────────────────────────────────

function FavouriteRow({
  canonicalName,
  displayName,
  portion,
  calories,
  onAdd,
}: {
  canonicalName: string;
  displayName: string;
  portion: string;
  calories: number;
  onAdd: (canonicalName: string) => void;
}) {
  return (
    <li
      data-slot="favourite-row"
      className="flex list-none items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-[var(--surface-2)]"
    >
      {/* Heart icon */}
      <Heart
        className="h-5 w-5 shrink-0 fill-current"
        style={{ color: "var(--orange)" }}
        aria-hidden="true"
      />

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
          backgroundColor: "rgba(249, 115, 22, 0.15)",
          color: "var(--orange)",
        }}
        aria-label={`Add ${displayName} to staging`}
      >
        <Plus className="h-4 w-4" />
      </button>
    </li>
  );
}
