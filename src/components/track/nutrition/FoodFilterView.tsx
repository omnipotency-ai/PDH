/**
 * FoodFilterView — tab-based food browser for the Nutrition Card.
 *
 * Tabs: Recent | Frequent | All
 * Zero state shows recently logged foods for the current meal slot.
 * Each tab shows a list of food items with name, portion, calories,
 * and a (+) button to add to staging.
 *
 * Uses FOOD_PORTION_DATA for calories/portions — no mock data.
 * "Frequent" tab counts canonicalName occurrences in the 14-day log window.
 */

import { FOOD_PORTION_DATA } from "@shared/foodPortionData";
import { FOOD_REGISTRY } from "@shared/foodRegistryData";
import { isFoodPipelineType } from "@shared/logTypeUtils";
import { ArrowLeft, Clock, List, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { useSyncedLogsContext } from "@/contexts/SyncedLogsContext";
import {
  filterToKnownFoods,
  formatPortion,
  getDefaultCalories,
  titleCase,
} from "@/lib/nutritionUtils";
import { FoodRow } from "./FoodRow";

// ── Types ────────────────────────────────────────────────────────────────────

interface FoodFilterViewProps {
  recentFoods: string[];
  favourites: string[];
  onAddToStaging: (canonicalName: string) => void;
  onBack: () => void;
}

type FilterTab = "recent" | "frequent" | "all";

interface TabConfig {
  id: FilterTab;
  label: string;
  icon: typeof Clock;
}

/** Precomputed row data — resolved once in the displayedItems memo. */
interface ResolvedFoodItem {
  canonicalName: string;
  displayName: string;
  portion: string;
  calories: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

const TABS: ReadonlyArray<TabConfig> = [
  { id: "recent", label: "Recent", icon: Clock },
  { id: "frequent", label: "Frequent", icon: Star },
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
  const logs = useSyncedLogsContext();

  // Build the "All" list: every canonical food in FOOD_PORTION_DATA, sorted alphabetically.
  // Fix #27: slice applied inside memo rather than in displayedItems.
  const allFoods = useMemo(() => {
    const names: string[] = [];
    for (const entry of FOOD_REGISTRY) {
      if (FOOD_PORTION_DATA.has(entry.canonical)) {
        names.push(entry.canonical);
      }
    }
    names.sort((a, b) => a.localeCompare(b));
    return names.slice(0, MAX_ITEMS_PER_TAB);
  }, []);

  // Fix #25: use filterToKnownFoods instead of inline FOOD_PORTION_DATA.has()
  const validRecentFoods = useMemo(
    () => filterToKnownFoods(recentFoods).slice(0, MAX_ITEMS_PER_TAB),
    [recentFoods],
  );

  // Fix #26: Compute frequency map from 14-day logs.
  // Count how many times each canonicalName appears across all food pipeline logs.
  const frequentFoods = useMemo(() => {
    const frequencyMap = new Map<string, number>();

    for (const log of logs) {
      if (!isFoodPipelineType(log.type)) continue;

      const data = log.data as {
        items: ReadonlyArray<{ canonicalName?: string | null }>;
      };
      for (const item of data.items) {
        const canonical = item.canonicalName;
        if (canonical == null) continue;
        frequencyMap.set(canonical, (frequencyMap.get(canonical) ?? 0) + 1);
      }
    }

    // Sort by frequency descending, filter to known foods, take top N.
    const sorted = [...frequencyMap.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);

    return filterToKnownFoods(sorted).slice(0, MAX_ITEMS_PER_TAB);
  }, [logs]);

  // Frequency counts for display labels (only used by Frequent tab).
  const frequencyCountMap = useMemo(() => {
    const countMap = new Map<string, number>();

    for (const log of logs) {
      if (!isFoodPipelineType(log.type)) continue;

      const data = log.data as {
        items: ReadonlyArray<{ canonicalName?: string | null }>;
      };
      for (const item of data.items) {
        const canonical = item.canonicalName;
        if (canonical == null) continue;
        countMap.set(canonical, (countMap.get(canonical) ?? 0) + 1);
      }
    }

    return countMap;
  }, [logs]);

  // Fix #31: Precompute resolved props in displayedItems memo.
  // Each item has canonicalName, displayName, portion, and calories pre-resolved.
  const displayedItems: ResolvedFoodItem[] = useMemo(() => {
    let names: string[];
    switch (activeTab) {
      case "recent":
        names = validRecentFoods;
        break;
      case "frequent":
        names = frequentFoods;
        break;
      case "all":
        names = allFoods;
        break;
    }

    return names.map((canonicalName) => {
      const portion = formatPortion(canonicalName);
      const calories = getDefaultCalories(canonicalName);
      const count = activeTab === "frequent" ? frequencyCountMap.get(canonicalName) : undefined;

      // For Frequent tab, prepend the logged count to the portion string.
      const portionDisplay =
        count != null && count > 0 ? `Logged ${count}x${portion ? ` · ${portion}` : ""}` : portion;

      return {
        canonicalName,
        displayName: titleCase(canonicalName),
        portion: portionDisplay,
        calories,
      };
    });
  }, [activeTab, validRecentFoods, frequentFoods, allFoods, frequencyCountMap]);

  const favouriteSet = useMemo(() => new Set(favourites), [favourites]);

  // Tab count badges (#71) — derived from the per-tab lists, not displayedItems.
  const tabCounts: Record<FilterTab, number> = {
    recent: validRecentFoods.length,
    frequent: frequentFoods.length,
    all: allFoods.length,
  };

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
          const count = tabCounts[tab.id];
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
              <span>
                {tab.label}
                {count > 0 && <span className="ml-1 font-normal opacity-60">({count})</span>}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab panel — Fix #30: use shared FoodRow instead of local FoodFilterRow */}
      <div
        id={`filter-panel-${activeTab}`}
        role="tabpanel"
        aria-label={`${TABS.find((t) => t.id === activeTab)?.label ?? ""} foods`}
      >
        {displayedItems.length === 0 ? (
          <EmptyTabState tab={activeTab} />
        ) : (
          <ul className="space-y-1" aria-label={`${activeTab} foods`}>
            {displayedItems.map((item) => (
              <FoodRow
                key={item.canonicalName}
                dataSlot="food-filter-row"
                canonicalName={item.canonicalName}
                displayName={item.displayName}
                portion={item.portion}
                calories={item.calories}
                isFavourite={favouriteSet.has(item.canonicalName)}
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
