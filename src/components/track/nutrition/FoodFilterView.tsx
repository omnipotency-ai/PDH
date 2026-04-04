/**
 * FoodFilterView — tab-based food browser for the Nutrition Card.
 *
 * Tabs: Recent | Frequent | Favourites | All
 * Zero state shows recently logged foods for the current meal slot.
 * Each tab shows a list of food items with name, portion, calories,
 * and a (+) button to add to staging.
 *
 * Uses FOOD_PORTION_DATA for calories/portions — no mock data.
 * "Frequent" tab is a placeholder until frequency tracking is built.
 */

import { FOOD_PORTION_DATA } from "@shared/foodPortionData";
import { FOOD_REGISTRY } from "@shared/foodRegistryData";
import { ArrowLeft, Clock, Heart, List, Plus, Star } from "lucide-react";
import { useMemo, useState } from "react";
import {
  formatPortion,
  getDefaultCalories,
  titleCase,
} from "@/lib/nutritionUtils";

// ── Types ────────────────────────────────────────────────────────────────────

interface FoodFilterViewProps {
  recentFoods: string[];
  favourites: string[];
  onAddToStaging: (canonicalName: string) => void;
  onBack: () => void;
}

type FilterTab = "recent" | "frequent" | "favourites" | "all";

interface TabConfig {
  id: FilterTab;
  label: string;
  icon: typeof Clock;
}

// ── Constants ────────────────────────────────────────────────────────────────

const TABS: ReadonlyArray<TabConfig> = [
  { id: "recent", label: "Recent", icon: Clock },
  { id: "frequent", label: "Frequent", icon: Star },
  { id: "favourites", label: "Favourites", icon: Heart },
  { id: "all", label: "All", icon: List },
];

/** Maximum items shown per tab to keep the list scannable. */
const MAX_ITEMS_PER_TAB = 50;

// ── Component ────────────────────────────────────────────────────────────────

export function FoodFilterView({
  recentFoods,
  favourites,
  onAddToStaging,
  onBack,
}: FoodFilterViewProps) {
  const [activeTab, setActiveTab] = useState<FilterTab>("recent");

  // Build the "All" list: every canonical food in FOOD_PORTION_DATA, sorted alphabetically.
  const allFoods = useMemo(() => {
    const names: string[] = [];
    for (const entry of FOOD_REGISTRY) {
      if (FOOD_PORTION_DATA.has(entry.canonical)) {
        names.push(entry.canonical);
      }
    }
    names.sort((a, b) => a.localeCompare(b));
    return names;
  }, []);

  // Filter recent and favourites to only foods with portion data.
  const validRecentFoods = useMemo(
    () =>
      recentFoods
        .filter((name) => FOOD_PORTION_DATA.has(name))
        .slice(0, MAX_ITEMS_PER_TAB),
    [recentFoods],
  );

  const validFavourites = useMemo(
    () =>
      favourites
        .filter((name) => FOOD_PORTION_DATA.has(name))
        .slice(0, MAX_ITEMS_PER_TAB),
    [favourites],
  );

  // Frequent: for now, same as recent (frequency tracking not yet built).
  // This is a placeholder — the data source will change when frequency
  // tracking is implemented.
  const frequentFoods = validRecentFoods;

  // Select items based on active tab.
  const displayedItems = useMemo(() => {
    switch (activeTab) {
      case "recent":
        return validRecentFoods;
      case "frequent":
        return frequentFoods;
      case "favourites":
        return validFavourites;
      case "all":
        return allFoods.slice(0, MAX_ITEMS_PER_TAB);
    }
  }, [activeTab, validRecentFoods, frequentFoods, validFavourites, allFoods]);

  const favouriteSet = useMemo(() => new Set(favourites), [favourites]);

  return (
    <div data-slot="food-filter-view" className="space-y-3">
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
          Browse Foods
        </span>
      </div>

      {/* Tab bar */}
      <div
        data-slot="filter-tabs"
        className="flex gap-1 rounded-xl bg-[var(--surface-2)] p-1"
        role="tablist"
        aria-label="Food filter tabs"
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`filter-panel-${tab.id}`}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition-colors ${
                isActive
                  ? "bg-[var(--surface-3)] text-[var(--text)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab panel */}
      <div
        id={`filter-panel-${activeTab}`}
        role="tabpanel"
        aria-label={`${TABS.find((t) => t.id === activeTab)?.label ?? ""} foods`}
      >
        {displayedItems.length === 0 ? (
          <EmptyTabState tab={activeTab} />
        ) : (
          <ul className="space-y-1" aria-label={`${activeTab} foods`}>
            {displayedItems.map((canonicalName) => (
              <FoodFilterRow
                key={canonicalName}
                canonicalName={canonicalName}
                displayName={titleCase(canonicalName)}
                portion={formatPortion(canonicalName)}
                calories={getDefaultCalories(canonicalName)}
                isFavourite={favouriteSet.has(canonicalName)}
                onAdd={onAddToStaging}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ── EmptyTabState ────────────────────────────────────────────────────────────

function EmptyTabState({ tab }: { tab: FilterTab }) {
  const messages: Record<FilterTab, { title: string; subtitle: string }> = {
    recent: {
      title: "No recent foods",
      subtitle: "Foods you log will appear here.",
    },
    frequent: {
      title: "No frequent foods yet",
      subtitle: "Foods you log often will appear here.",
    },
    favourites: {
      title: "No favourites yet",
      subtitle: "Tap the heart icon on any food to save it here.",
    },
    all: {
      title: "No foods available",
      subtitle: "The food database is empty.",
    },
  };

  const { title, subtitle } = messages[tab];

  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <p className="text-sm text-[var(--text-muted)]">{title}</p>
      <p className="text-xs text-[var(--text-faint)]">{subtitle}</p>
    </div>
  );
}

// ── FoodFilterRow ────────────────────────────────────────────────────────────

function FoodFilterRow({
  canonicalName,
  displayName,
  portion,
  calories,
  isFavourite,
  onAdd,
}: {
  canonicalName: string;
  displayName: string;
  portion: string;
  calories: number;
  isFavourite: boolean;
  onAdd: (canonicalName: string) => void;
}) {
  return (
    <li
      data-slot="food-filter-row"
      className="flex list-none items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-[var(--surface-2)]"
    >
      {/* Favourite indicator */}
      <Heart
        className={`h-4 w-4 shrink-0 ${isFavourite ? "fill-current" : ""}`}
        style={{ color: isFavourite ? "var(--orange)" : "var(--text-faint)" }}
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
