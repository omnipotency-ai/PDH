import { getFoodGroup, getFoodZone, getGroupDisplayName } from "@shared/foodRegistry";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  FlaskConical,
  Search,
  ShieldAlert,
  ShieldCheck,
  UtensilsCrossed,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useAnalyzedFoodStats } from "@/hooks/useAnalyzedFoodStats";
import type { FoodStat } from "@/lib/analysis";
import type { Zone } from "@/lib/foodStatusThresholds";
import type { FoodPrimaryStatus } from "@/types/domain";

// ── Constants ───────────────────────────────────────────────────────────────

const ZONE_META: Record<
  Zone,
  {
    label: string;
    description: string;
    color: string;
    mutedColor: string;
    borderColor: string;
  }
> = {
  1: {
    label: "Zone 1 — Safest",
    description: "Foundation foods: plain proteins, simple carbs, gentle foods",
    color: "var(--color-status-safe)",
    mutedColor: "var(--color-status-safe-bg)",
    borderColor: "var(--color-status-safe)",
  },
  2: {
    label: "Zone 2 — Moderate",
    description: "Cooked veg, pasta, dairy, moderate fruits",
    color: "var(--section-activity)",
    mutedColor: "var(--section-activity-muted)",
    borderColor: "var(--section-activity-border)",
  },
  3: {
    label: "Zone 3 — Caution",
    description: "Raw veg, high-fibre, nuts, seeds, spicy, fried foods",
    color: "var(--section-quick)",
    mutedColor: "var(--section-quick-muted)",
    borderColor: "var(--section-quick-border)",
  },
};

const STATUS_FILTERS: { value: "all" | FoodPrimaryStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "safe", label: "Safe" },
  { value: "watch", label: "Watch" },
  { value: "avoid", label: "Avoid" },
  { value: "building", label: "Building" },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatStatusLabel(food: FoodStat): string {
  if (food.primaryStatus !== "safe") return food.primaryStatus;
  if (food.tendency === "loose") return "safe (loose)";
  if (food.tendency === "hard") return "safe (hard)";
  return "safe";
}

function getStatusBadgeClasses(status: FoodPrimaryStatus): string {
  switch (status) {
    case "safe":
      return "bg-[var(--color-status-safe-bg)] text-[var(--color-status-safe)]";
    case "watch":
      return "bg-[var(--section-quick-muted)] text-[var(--section-quick)]";
    case "avoid":
      return "bg-[var(--section-food-muted)] text-[var(--section-food)]";
    case "building":
      return "bg-[var(--section-activity-muted)] text-[var(--section-activity)]";
  }
}

// ── Food Row ────────────────────────────────────────────────────────────────

function FoodRow({ food }: { food: FoodStat }) {
  const group = getFoodGroup(food.key);
  const categoryLabel = group ? getGroupDisplayName(group) : "Other";

  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 transition-colors hover:bg-[var(--surface-2)]">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--text)]">{food.name}</p>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="text-[10px] text-[var(--text-faint)]">{categoryLabel}</span>
          {food.totalTrials > 0 && (
            <span className="text-[10px] text-[var(--text-faint)]">
              {food.totalTrials} trial{food.totalTrials !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>
      <span
        className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${getStatusBadgeClasses(food.primaryStatus)}`}
      >
        {formatStatusLabel(food)}
      </span>
    </div>
  );
}

// ── Zone Section ────────────────────────────────────────────────────────────

function ZoneSection({ zone, foods }: { zone: Zone; foods: FoodStat[] }) {
  const meta = ZONE_META[zone];

  if (foods.length === 0) return null;

  // Sort: safe first, then watch, building, avoid. Within each status, alphabetical.
  const statusOrder: Record<FoodPrimaryStatus, number> = {
    safe: 0,
    watch: 1,
    building: 2,
    avoid: 3,
  };
  const sorted = [...foods].sort((a, b) => {
    const statusDiff = statusOrder[a.primaryStatus] - statusOrder[b.primaryStatus];
    if (statusDiff !== 0) return statusDiff;
    return a.name.localeCompare(b.name);
  });

  return (
    <section className="glass-card overflow-hidden">
      <div className="px-4 py-3">
        <h2 className="text-sm font-bold" style={{ color: meta.color }}>
          {meta.label}
        </h2>
        <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{meta.description}</p>
        <p className="mt-1 text-[10px] text-[var(--text-faint)]">
          {foods.length} food{foods.length !== 1 ? "s" : ""}
        </p>
      </div>
      <div className="space-y-1.5 px-4 pb-4">
        {sorted.map((food) => (
          <FoodRow key={food.key} food={food} />
        ))}
      </div>
    </section>
  );
}

// ── Summary Bar ─────────────────────────────────────────────────────────────

function SummaryBar({ foodStats }: { foodStats: FoodStat[] }) {
  const counts = useMemo(() => {
    let safe = 0;
    let watch = 0;
    let avoid = 0;
    let building = 0;
    for (const food of foodStats) {
      switch (food.primaryStatus) {
        case "safe":
          safe++;
          break;
        case "watch":
          watch++;
          break;
        case "avoid":
          avoid++;
          break;
        case "building":
          building++;
          break;
      }
    }
    return { safe, watch, avoid, building, total: foodStats.length };
  }, [foodStats]);

  return (
    <div className="grid grid-cols-4 gap-2">
      <div className="rounded-lg bg-[var(--color-status-safe-bg)] px-3 py-2 text-center">
        <ShieldCheck size={14} className="mx-auto text-[var(--color-status-safe)]" />
        <p className="mt-1 text-lg font-bold text-[var(--color-status-safe)]">{counts.safe}</p>
        <p className="text-[10px] text-[var(--text-muted)]">Safe</p>
      </div>
      <div className="rounded-lg bg-[var(--section-quick-muted)] px-3 py-2 text-center">
        <AlertTriangle size={14} className="mx-auto text-[var(--section-quick)]" />
        <p className="mt-1 text-lg font-bold text-[var(--section-quick)]">{counts.watch}</p>
        <p className="text-[10px] text-[var(--text-muted)]">Watch</p>
      </div>
      <div className="rounded-lg bg-[var(--section-food-muted)] px-3 py-2 text-center">
        <ShieldAlert size={14} className="mx-auto text-[var(--section-food)]" />
        <p className="mt-1 text-lg font-bold text-[var(--section-food)]">{counts.avoid}</p>
        <p className="text-[10px] text-[var(--text-muted)]">Avoid</p>
      </div>
      <div className="rounded-lg bg-[var(--section-activity-muted)] px-3 py-2 text-center">
        <FlaskConical size={14} className="mx-auto text-[var(--section-activity)]" />
        <p className="mt-1 text-lg font-bold text-[var(--section-activity)]">{counts.building}</p>
        <p className="text-[10px] text-[var(--text-muted)]">Building</p>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function MenuPage() {
  const analysis = useAnalyzedFoodStats();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | FoodPrimaryStatus>("all");

  // Apply search and status filter
  const filteredFoods = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return analysis.foodStats.filter((food) => {
      if (statusFilter !== "all" && food.primaryStatus !== statusFilter) return false;
      if (
        query &&
        !food.name.toLowerCase().includes(query) &&
        !food.key.toLowerCase().includes(query)
      )
        return false;
      return true;
    });
  }, [analysis.foodStats, searchQuery, statusFilter]);

  // Group filtered foods by zone
  const foodsByZone = useMemo(() => {
    const groups: Record<Zone, FoodStat[]> = { 1: [], 2: [], 3: [] };
    for (const food of filteredFoods) {
      const zone = getFoodZone(food.key) ?? 3;
      groups[zone].push(food);
    }
    return groups;
  }, [filteredFoods]);

  const totalCount = analysis.foodStats.length;

  return (
    <div className="stagger-reveal mx-auto max-w-3xl space-y-5">
      {/* Page header */}
      <header className="space-y-1">
        <Link
          to="/patterns"
          className="inline-flex items-center gap-1 text-xs text-[var(--text-faint)] transition-colors hover:text-[var(--text-muted)]"
        >
          <ArrowLeft size={12} />
          Back to Patterns
        </Link>
        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-sketch text-2xl font-bold tracking-tight text-[var(--section-meals)] md:text-3xl">
              Food Library
            </h1>
            <p className="text-xs text-[var(--text-muted)]">
              Your tested foods grouped by recovery zone
            </p>
          </div>
          <div className="flex items-center gap-1.5 rounded-md bg-[var(--surface-2)] px-2.5 py-1">
            <UtensilsCrossed size={12} className="text-[var(--text-muted)]" />
            <span className="text-xs text-[var(--text-muted)]">
              {totalCount} food{totalCount !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </header>

      {/* Summary counts */}
      <SummaryBar foodStats={analysis.foodStats} />

      {/* Search and filter */}
      <div className="space-y-3">
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]"
          />
          <input
            type="text"
            placeholder="Search foods..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search food names"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-1)] py-2.5 pl-9 pr-3 text-sm text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--section-meals)] focus:outline-none focus:ring-1 focus:ring-[var(--section-meals)]"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setStatusFilter(filter.value)}
              aria-pressed={statusFilter === filter.value}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                statusFilter === filter.value
                  ? "bg-[var(--section-meals)] text-white"
                  : "bg-[var(--surface-2)] text-[var(--text-muted)] hover:bg-[var(--surface-3)]"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filtered results info */}
      {(searchQuery || statusFilter !== "all") && (
        <p className="text-xs text-[var(--text-faint)]">
          Showing {filteredFoods.length} of {totalCount} foods
          {searchQuery && ` matching "${searchQuery}"`}
          {statusFilter !== "all" && ` with status "${statusFilter}"`}
        </p>
      )}

      {/* Zone sections */}
      {filteredFoods.length === 0 ? (
        <div className="glass-card rounded-xl p-6 text-center">
          <UtensilsCrossed size={24} className="mx-auto mb-2 text-[var(--text-faint)]" />
          <p className="text-sm font-medium text-[var(--text)]">No foods found</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {totalCount === 0
              ? "Log foods on the Track page to start building your food library."
              : "Try adjusting your search or filter."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <ZoneSection zone={1} foods={foodsByZone[1]} />
          <ZoneSection zone={2} foods={foodsByZone[2]} />
          <ZoneSection zone={3} foods={foodsByZone[3]} />
        </div>
      )}
    </div>
  );
}
