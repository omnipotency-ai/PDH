import type { FoodDigestionMetadata, FoodGroup } from "@shared/foodRegistry";
import type { ColumnDef } from "@tanstack/react-table";
import { useEffect, useState } from "react";
import { AiBadge } from "@/components/patterns/database/AiBadge";
import { BristolBreakdown } from "@/components/patterns/database/BristolBreakdown";
import type { StatusFilterValue } from "@/components/patterns/database/FilterSheet";
import { coerceFilterValues } from "@/components/patterns/database/filterUtils";
import { StatusBadge } from "@/components/patterns/database/StatusBadge";
import { TrendIndicator } from "@/components/patterns/database/TrendIndicator";
import type { FoodStat, FoodStatus, LocalTrialRecord } from "@/lib/analysis";
import { computeBristolAverage } from "@/lib/foodStatusThresholds";
import type { FoodPrimaryStatus, FoodTendency } from "@/types/domain";
import { GROUP_COLORS } from "@/types/domain";

// ── Override status type (mirrors convex ingredientOverrides schema) ─────────

export type OverrideStatus = "safe" | "watch" | "avoid";

// ── FoodDatabaseRow ─────────────────────────────────────────────────────────

/**
 * Composite row type for the food database table.
 *
 * Combines:
 *  - FoodStat data (analysis results from food trials)
 *  - Registry data (food group, recovery zone)
 *  - AI assessment data (latest verdict from AI insight)
 *  - User override data (manual status override)
 */
export interface FoodDatabaseRow {
  /** Canonical food key — used as the unique row ID. */
  key: string;
  /** Display name. */
  name: string;

  // ── Food stat data ──────────────────────────────────────────────────────
  /** All-time trial count. */
  totalTrials: number;
  /** Last 3 trial outcomes (newest first). */
  recentOutcomes: FoodStat["recentOutcomes"];
  /** Count breakdowns for recent outcomes. */
  badCount: number;
  looseCount: number;
  hardCount: number;
  goodCount: number;
  /** Average delay in hours from eating to bowel event. */
  avgDelayHours: number | null;
  /** Timestamp of the last trial. */
  lastTrialAt: number;
  /** Computed food status. */
  status: FoodStatus;
  primaryStatus: FoodPrimaryStatus;
  tendency: FoodTendency;
  confidence: number;
  /** Bayesian code-derived score (positive - negative evidence). */
  codeScore: number;
  /** AI assessment score. */
  aiScore: number;
  /** Combined Bayesian score (codeScore + aiScore). */
  combinedScore: number;
  recentSuspect: boolean;
  clearedHistory: boolean;
  /** Bristol score breakdown (code -> count). */
  bristolBreakdown: Record<number, number>;
  /** Average transit time in minutes. */
  avgTransitMinutes: number | null;
  /** Number of completed/resolved transits. */
  resolvedTransits: number;

  // ── Registry data ─────────────────────────────────────────────────────
  /** Food group (protein, carbs, fats, seasoning). */
  foodGroup?: FoodGroup;
  /** Recovery zone (1-3). */
  stage?: number;
  /** Shared digestion metadata from the registry. */
  digestion?: FoodDigestionMetadata;
  /** Registry note describing the canonical. */
  registryNotes?: string;

  // ── AI assessment data ──────────────────────────────────────────────────
  /** Latest AI verdict. */
  aiVerdict?: "safe" | "watch" | "trial_next" | "avoid";
  /** AI confidence level. */
  aiConfidence?: "high" | "medium" | "low";

  // ── Override data ───────────────────────────────────────────────────────
  /** User-set manual override status. */
  overrideStatus?: OverrideStatus;
  /** User note attached to the override. */
  overrideNote?: string;

  // ── Resolved trial history (from local analysis) ──────────────────────
  /** Per-trial records from local food-bowel correlation analysis. Sorted newest first. */
  resolvedTrials?: LocalTrialRecord[];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

/**
 * Format a timestamp as a relative time string (e.g., "2 days ago").
 * Returns "Never" when the timestamp is 0 or missing.
 */
function formatRelativeTime(timestamp: number): string {
  if (timestamp <= 0) return "Never";

  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 0) return "Just now";
  if (diff < MS_PER_MINUTE) return "Just now";
  if (diff < MS_PER_HOUR) {
    const mins = Math.floor(diff / MS_PER_MINUTE);
    return `${mins}m ago`;
  }
  if (diff < MS_PER_DAY) {
    const hours = Math.floor(diff / MS_PER_HOUR);
    return `${hours}h ago`;
  }
  if (diff < 30 * MS_PER_DAY) {
    const days = Math.floor(diff / MS_PER_DAY);
    return `${days}d ago`;
  }
  if (diff < 365 * MS_PER_DAY) {
    const months = Math.floor(diff / (30 * MS_PER_DAY));
    return `${months}mo ago`;
  }
  const years = Math.floor(diff / (365 * MS_PER_DAY));
  return `${years}y ago`;
}

const RELATIVE_TIME_REFRESH_MS = 60_000;

/**
 * Renders a relative time string that auto-refreshes every 60 seconds
 * so the display stays current without a full page reload.
 */
function RelativeTime({ timestamp }: { timestamp: number }) {
  const [label, setLabel] = useState(() => formatRelativeTime(timestamp));

  useEffect(() => {
    setLabel(formatRelativeTime(timestamp));
    const id = setInterval(() => {
      setLabel(formatRelativeTime(timestamp));
    }, RELATIVE_TIME_REFRESH_MS);
    return () => clearInterval(id);
  }, [timestamp]);

  return <>{label}</>;
}

/**
 * Get the CSS color for a Bristol average value.
 *  - Green (normal): 3.0 to 5.0
 *  - Orange (borderline): 2.0-2.9 or 5.1-6.0
 *  - Red (outside range): < 2.0 or > 6.0
 */
function bristolAvgColor(avg: number): string {
  if (avg >= 3 && avg <= 5) return "var(--section-observe)";
  if (avg >= 2 && avg < 3) return "var(--section-quick)";
  if (avg > 5 && avg < 6) return "var(--section-quick)";
  // Bristol 6+ and below 2 are in the warning/alert tier
  return "var(--section-food)";
}

// ── Category label helper ───────────────────────────────────────────────────

const GROUP_LABEL: Record<FoodGroup, string> = {
  protein: "Protein",
  carbs: "Carbs",
  fats: "Fats",
  seasoning: "Seasoning",
};

// ── Column factory ──────────────────────────────────────────────────────────

export function buildColumns(): ColumnDef<FoodDatabaseRow>[] {
  return [
    // ── Food name + preparation method ──────────────────────────────────────
    {
      id: "food",
      accessorKey: "name",
      header: "Food",
      size: 200,
      cell: ({ row }) => {
        const { name, overrideStatus } = row.original;
        return (
          <div data-slot="food-cell" className="flex items-center gap-1.5">
            <span className="font-display text-sm font-semibold text-[var(--text)]">{name}</span>
            {overrideStatus !== undefined && (
              <span className="inline-flex shrink-0 items-center rounded border border-slate-600 bg-slate-800 px-1 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wide text-slate-300">
                Manual
              </span>
            )}
          </div>
        );
      },
    },

    // ── Zone (1-3) ─────────────────────────────────────────────────────────
    {
      id: "stage",
      accessorKey: "stage",
      header: "Zone",
      size: 70,
      cell: ({ row }) => {
        const { stage } = row.original;
        if (stage === undefined) {
          return <span className="font-mono text-xs text-[var(--text-faint)]">&mdash;</span>;
        }
        return (
          <span
            data-slot="stage-cell"
            className="inline-flex h-6 w-6 items-center justify-center rounded-full font-mono text-xs font-bold"
            style={{
              background: "color-mix(in srgb, var(--text-muted) 15%, transparent)",
              color: "var(--text-muted)",
            }}
          >
            {stage}
          </span>
        );
      },
      filterFn: (row, _columnId, filterValue) => {
        const selected = coerceFilterValues<string>(filterValue);
        if (selected.length === 0) return true;
        const stage = row.original.stage;
        if (stage === undefined) return false;
        return selected.includes(String(stage));
      },
    },

    // ── Status badge ────────────────────────────────────────────────────────
    {
      id: "status",
      accessorKey: "status",
      header: "Status",
      size: 110,
      cell: ({ row }) => {
        return (
          <StatusBadge
            primaryStatus={row.original.primaryStatus}
            tendency={row.original.tendency}
          />
        );
      },
      filterFn: (row, _columnId, filterValue) => {
        const selected = coerceFilterValues<StatusFilterValue>(filterValue);
        if (selected.length === 0) return true;
        const { primaryStatus, tendency } = row.original;
        return selected.some((value) => {
          if (value === "safe-loose") return primaryStatus === "safe" && tendency === "loose";
          if (value === "safe-hard") return primaryStatus === "safe" && tendency === "hard";
          return value === primaryStatus;
        });
      },
    },

    // ── Category (line category) ────────────────────────────────────────────
    {
      id: "category",
      accessorKey: "foodGroup",
      header: "Category",
      size: 100,
      cell: ({ row }) => {
        const { foodGroup } = row.original;
        if (foodGroup === undefined) {
          return <span className="font-mono text-xs text-[var(--text-faint)]">&mdash;</span>;
        }
        const colors = GROUP_COLORS[foodGroup];
        return (
          <span
            data-slot="category-cell"
            className="inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide"
            style={{
              color: `var(--color-${colors.primary})`,
              background: `color-mix(in srgb, var(--color-${colors.primary}) 12%, transparent)`,
              borderColor: `color-mix(in srgb, var(--color-${colors.primary}) 25%, transparent)`,
            }}
          >
            {GROUP_LABEL[foodGroup]}
          </span>
        );
      },
      filterFn: (row, _columnId, filterValue) => {
        const selected = coerceFilterValues<FoodGroup>(filterValue);
        if (selected.length === 0) return true;
        return row.original.foodGroup !== undefined && selected.includes(row.original.foodGroup);
      },
    },

    // ── Bristol average ─────────────────────────────────────────────────────
    {
      id: "bristolAvg",
      header: "Bristol Avg",
      size: 90,
      accessorFn: (row) => computeBristolAverage(row.bristolBreakdown),
      cell: ({ getValue }) => {
        const raw = getValue();
        const avg = typeof raw === "number" ? raw : null;
        if (avg === null) {
          return <span className="font-mono text-xs text-[var(--text-faint)]">&mdash;</span>;
        }
        return (
          <span
            data-slot="bristol-avg-cell"
            className="font-mono text-sm font-bold"
            style={{ color: bristolAvgColor(avg) }}
          >
            {avg.toFixed(1)}
          </span>
        );
      },
      sortingFn: "basic",
    },

    // ── Transit average ─────────────────────────────────────────────────────
    {
      id: "transitAvg",
      header: "Transit Avg",
      size: 100,
      accessorFn: (row) => row.avgTransitMinutes,
      cell: ({ row }) => {
        const { avgTransitMinutes } = row.original;
        if (avgTransitMinutes === null) {
          return <span className="font-mono text-xs text-[var(--text-faint)]">&mdash;</span>;
        }
        const hours = Math.round(avgTransitMinutes / 6) / 10;
        return (
          <span data-slot="transit-avg-cell" className="font-mono text-sm text-[var(--text-muted)]">
            {hours}h
          </span>
        );
      },
      sortingFn: "basic",
    },

    // ── Trials count ────────────────────────────────────────────────────────
    {
      id: "trials",
      accessorKey: "resolvedTransits",
      header: "Trials",
      size: 90,
      cell: ({ row }) => {
        const { resolvedTransits, totalTrials } = row.original;
        return (
          <span data-slot="trials-cell" className="font-mono text-sm text-[var(--text-muted)]">
            {resolvedTransits}
            <span className="text-[var(--text-faint)]">/{totalTrials}</span>
          </span>
        );
      },
      sortingFn: "basic",
    },

    // ── Last tested (relative time) ─────────────────────────────────────────
    {
      id: "lastTested",
      accessorKey: "lastTrialAt",
      header: "Last eaten",
      size: 100,
      cell: ({ row }) => {
        const { lastTrialAt } = row.original;
        return (
          <span data-slot="last-tested-cell" className="font-mono text-xs text-[var(--text-muted)]">
            <RelativeTime timestamp={lastTrialAt} />
          </span>
        );
      },
      sortingFn: "basic",
    },

    // ── AI status badge ─────────────────────────────────────────────────────
    {
      id: "aiStatus",
      header: "AI",
      size: 60,
      accessorFn: (row) => row.aiVerdict,
      cell: ({ row }) => {
        const { aiVerdict } = row.original;
        if (aiVerdict === undefined) {
          return <span className="font-mono text-xs text-[var(--text-faint)]">&mdash;</span>;
        }
        return <AiBadge type={aiVerdict} />;
      },
    },

    // ── Trend indicator ─────────────────────────────────────────────────────
    {
      id: "trend",
      header: "Trend",
      size: 60,
      cell: ({ row }) => <TrendIndicator stat={row.original} />,
    },

    // ── Bristol breakdown (expandable detail) ───────────────────────────────
    {
      id: "bristolBreakdown",
      header: "Bristol Detail",
      size: 140,
      cell: ({ row }) => {
        return <BristolBreakdown breakdown={row.original.bristolBreakdown} />;
      },
    },
  ];
}

// ── Utility: convert a FoodStat + optional enrichment into a FoodDatabaseRow

/**
 * Build a FoodDatabaseRow from a FoodStat and optional registry/AI/override data.
 * This is the canonical way to assemble row data for the database table.
 */
// Conditional spreads required by exactOptionalPropertyTypes — strips undefined values
export function buildFoodDatabaseRow(
  stat: FoodStat,
  options?: {
    foodGroup?: FoodGroup;
    stage?: number;
    digestion?: FoodDigestionMetadata;
    registryNotes?: string;
    aiVerdict?: "safe" | "watch" | "trial_next" | "avoid";
    aiConfidence?: "high" | "medium" | "low";
    overrideStatus?: OverrideStatus;
    overrideNote?: string;
    resolvedTrials?: LocalTrialRecord[];
  },
): FoodDatabaseRow {
  const {
    learnedTransitCenterMinutes: _learnedTransitCenterMinutes,
    learnedTransitSpreadMinutes: _learnedTransitSpreadMinutes,
    ...statFields
  } = stat;

  return {
    ...statFields,
    ...(options?.foodGroup !== undefined && {
      foodGroup: options.foodGroup,
    }),
    ...(options?.stage !== undefined && { stage: options.stage }),
    ...(options?.digestion !== undefined && { digestion: options.digestion }),
    ...(options?.registryNotes !== undefined && {
      registryNotes: options.registryNotes,
    }),
    ...(options?.aiVerdict !== undefined && { aiVerdict: options.aiVerdict }),
    ...(options?.aiConfidence !== undefined && {
      aiConfidence: options.aiConfidence,
    }),
    ...(options?.overrideStatus !== undefined && {
      overrideStatus: options.overrideStatus,
    }),
    ...(options?.overrideNote !== undefined && {
      overrideNote: options.overrideNote,
    }),
    ...(options?.resolvedTrials !== undefined && {
      resolvedTrials: options.resolvedTrials,
    }),
  };
}
