/**
 * QuickPicksView — spotlight food chips for fast logging.
 *
 * Combines slot-scoped favourites + frequent + recent into a set of
 * tappable pills. Tapping a pill adds the food to staging.
 *
 * Shown automatically when the search bar is focused with an empty query,
 * or manually via the ⚡ header icon.
 */

import { useQuery } from "convex/react";
import { useMemo } from "react";
import { useFoodFavourites } from "@/hooks/useProfile";
import { useSlotScopedFoods } from "@/hooks/useSlotScopedFoods";
import { type MealSlot, titleCase } from "@/lib/nutritionUtils";
import { api } from "../../../../convex/_generated/api";

// ── Types ────────────────────────────────────────────────────────────────────

interface QuickPicksViewProps {
  /** Active meal slot for scoping. null = show all slots (unfiltered). */
  slotFilter: MealSlot | null;
  /** Fallback slot used when slotFilter is null (time-of-day auto-detected). */
  activeMealSlot: MealSlot;
  onAddToStaging: (canonicalName: string) => void;
}

type FavouriteSlotTags = Partial<Record<string, MealSlot[]>>;

// ── Component ────────────────────────────────────────────────────────────────

export function QuickPicksView({
  slotFilter,
  activeMealSlot,
  onAddToStaging,
}: QuickPicksViewProps) {
  const effectiveSlot = slotFilter ?? activeMealSlot;
  const { recentFoods, frequentFoods } = useSlotScopedFoods(effectiveSlot);
  const { favourites } = useFoodFavourites();
  const favouriteSlotTags = (useQuery(api.profiles.getFavouriteSlotTags, {}) ??
    {}) as FavouriteSlotTags;

  const spotlightFoods = useMemo(() => {
    // Slot-scoped favourites
    const slotFavourites = favourites.filter((name) =>
      (favouriteSlotTags[name] ?? []).includes(effectiveSlot),
    );

    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const name of [
      ...slotFavourites,
      ...frequentFoods.slice(0, 7),
      ...recentFoods.slice(0, 7),
    ]) {
      if (seen.has(name)) continue;
      seen.add(name);
      ordered.push(name);
    }
    return ordered.slice(0, 12);
  }, [effectiveSlot, favouriteSlotTags, favourites, frequentFoods, recentFoods]);

  if (spotlightFoods.length === 0) {
    return (
      <p className="py-3 text-center text-xs text-[var(--text-faint)]">
        No quick picks for {titleCase(effectiveSlot)} yet. Log some meals to populate this.
      </p>
    );
  }

  return (
    <div data-slot="quick-picks-view" className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-faint)]">
        Quick Picks
      </p>
      <div className="flex flex-wrap gap-2">
        {spotlightFoods.map((canonicalName) => (
          <button
            key={canonicalName}
            type="button"
            onClick={() => onAddToStaging(canonicalName)}
            className="rounded-full border border-[var(--color-border-default)] bg-[var(--surface-2)] px-3 py-1.5 text-sm font-medium text-[var(--text)] transition-colors hover:border-[var(--orange)] hover:text-[var(--orange)]"
          >
            {titleCase(canonicalName)}
          </button>
        ))}
      </div>
    </div>
  );
}
