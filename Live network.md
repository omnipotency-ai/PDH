# Live network

**Total Files Included:** 11

## Included Files
- /Users/peterjamesblizzard/projects/caca_traca/src/pages/Patterns.tsx
- /Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/transit-map/RegistryTransitMap.tsx
- /Users/peterjamesblizzard/projects/caca_traca/src/hooks/useTransitMapData.ts
- /Users/peterjamesblizzard/projects/caca_traca/src/types/transitMap.ts
- /Users/peterjamesblizzard/projects/caca_traca/src/lib/foodDigestionMetadata.ts
- /Users/peterjamesblizzard/projects/caca_traca/src/lib/analysis.ts
- /Users/peterjamesblizzard/projects/caca_traca/shared/foodRegistry.ts
- /Users/peterjamesblizzard/projects/caca_traca/shared/foodRegistryData.ts
- /Users/peterjamesblizzard/projects/caca_traca/shared/foodRegistryUtils.ts
- /Users/peterjamesblizzard/projects/caca_traca/shared/foodNormalize.ts
- /Users/peterjamesblizzard/projects/caca_traca/shared/foodTypes.ts

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/src/pages/Patterns.tsx

import {
  getFoodEntry,
  pickFoodDigestionMetadata,
} from "@shared/foodCanonicalization";
import type { ColumnFiltersState, SortingState } from "@tanstack/react-table";
import { format } from "date-fns";
import { Filter, Search } from "lucide-react";
import {
  type MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  buildFoodDatabaseRow,
  columnFiltersEqual,
  countActiveFilters,
  countRowsForView,
  DatabaseTable,
  FilterSheet,
  type FoodDatabaseRow,
  normalizeColumnFilters,
  normalizeSorting,
  type SmartViewPreset,
  SmartViews,
  sortingEqual,
} from "@/components/patterns/database";
import { HeroStrip } from "@/components/patterns/hero";
import TransitMapContainer from "@/components/patterns/transit-map/TransitMapContainer";
import TransitMap from "@/components/patterns/transit-map/TransitMap";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSyncedLogsContext } from "@/contexts/SyncedLogsContext";
import { useMappedAssessments } from "@/hooks/useMappedAssessments";
import { useHabits, useTransitCalibration } from "@/hooks/useProfile";
import { analyzeLogs } from "@/lib/analysis";
import { useAllFoodTrials } from "@/lib/sync";

// ── Constants ────────────────────────────────────────────────────────────────

const SMART_VIEWS_STORAGE_KEY = "patterns-smart-views-v1";
const FILTER_STATE_STORAGE_KEY = "patterns-filter-state-v1";
const ALL_VIEW_ID = "all";
const DEFAULT_SORTING: SortingState = [{ id: "lastTested", desc: true }];
const PRIMARY_PATTERN_TAB = "database";
const SECONDARY_PATTERN_TAB = "transit-map";
const TRANSIT_REGISTRY_TAB = "registry-network";
const TRANSIT_GUIDE_TAB = "model-guide";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeAllView(): SmartViewPreset {
  return {
    id: ALL_VIEW_ID,
    label: "All",
    builtIn: true,
    columnFilters: [],
    sorting: DEFAULT_SORTING,
  };
}

function readSavedSmartViews(): SmartViewPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SMART_VIEWS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((entry): SmartViewPreset | null => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry))
          return null;
        const row = entry as {
          id?: unknown;
          label?: unknown;
          columnFilters?: unknown;
          sorting?: unknown;
        };
        if (typeof row.id !== "string" || row.id.length === 0) return null;
        if (typeof row.label !== "string" || row.label.trim().length === 0)
          return null;
        return {
          id: row.id,
          label: row.label.trim(),
          builtIn: false,
          columnFilters: normalizeColumnFilters(row.columnFilters),
          sorting: normalizeSorting(row.sorting),
        };
      })
      .filter((view): view is SmartViewPreset => view !== null);
  } catch {
    return [];
  }
}

function readFilterState(): {
  columnFilters: ColumnFiltersState;
  sorting: SortingState;
  activeViewId: string | null;
} {
  if (typeof window === "undefined") {
    return {
      columnFilters: [],
      sorting: DEFAULT_SORTING,
      activeViewId: ALL_VIEW_ID,
    };
  }
  try {
    const raw = window.localStorage.getItem(FILTER_STATE_STORAGE_KEY);
    if (!raw) {
      return {
        columnFilters: [],
        sorting: DEFAULT_SORTING,
        activeViewId: ALL_VIEW_ID,
      };
    }

    const parsed = JSON.parse(raw) as {
      columnFilters?: unknown;
      sorting?: unknown;
      activeViewId?: unknown;
    };
    return {
      columnFilters: normalizeColumnFilters(parsed.columnFilters),
      sorting: normalizeSorting(parsed.sorting),
      activeViewId:
        typeof parsed.activeViewId === "string"
          ? parsed.activeViewId
          : ALL_VIEW_ID,
    };
  } catch {
    return {
      columnFilters: [],
      sorting: DEFAULT_SORTING,
      activeViewId: ALL_VIEW_ID,
    };
  }
}

// ── Database Tab Content ─────────────────────────────────────────────────────

function DatabaseTabContent({ rows }: { rows: FoodDatabaseRow[] }) {
  const allView = useMemo(() => makeAllView(), []);
  const [savedViews, setSavedViews] =
    useState<SmartViewPreset[]>(readSavedSmartViews);
  const initialFilterState = useMemo(() => readFilterState(), []);

  const [activeViewId, setActiveViewId] = useState<string | null>(
    initialFilterState.activeViewId,
  );
  const [appliedColumnFilters, setAppliedColumnFilters] =
    useState<ColumnFiltersState>(initialFilterState.columnFilters);
  const [appliedSorting, setAppliedSorting] = useState<SortingState>(
    initialFilterState.sorting,
  );

  const [draftColumnFilters, setDraftColumnFilters] =
    useState<ColumnFiltersState>(initialFilterState.columnFilters);
  const [draftSorting, setDraftSorting] = useState<SortingState>(
    initialFilterState.sorting,
  );
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const views = useMemo(() => [allView, ...savedViews], [allView, savedViews]);

  useEffect(() => {
    if (activeViewId === null) return;
    if (views.some((view) => view.id === activeViewId)) return;
    setActiveViewId(allView.id);
  }, [activeViewId, allView.id, views]);

  useEffect(() => {
    const matchingView = views.find(
      (view) =>
        columnFiltersEqual(view.columnFilters, appliedColumnFilters) &&
        sortingEqual(view.sorting, appliedSorting),
    );
    const nextActiveId = matchingView?.id ?? null;
    setActiveViewId((current) =>
      current === nextActiveId ? current : nextActiveId,
    );
  }, [appliedColumnFilters, appliedSorting, views]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        SMART_VIEWS_STORAGE_KEY,
        JSON.stringify(
          savedViews.map((view) => ({
            id: view.id,
            label: view.label,
            columnFilters: normalizeColumnFilters(view.columnFilters),
            sorting: normalizeSorting(view.sorting),
          })),
        ),
      );
    } catch {
      // localStorage unavailable
    }
  }, [savedViews]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        FILTER_STATE_STORAGE_KEY,
        JSON.stringify({
          columnFilters: normalizeColumnFilters(appliedColumnFilters),
          sorting: normalizeSorting(appliedSorting),
          activeViewId,
        }),
      );
    } catch {
      // localStorage unavailable
    }
  }, [activeViewId, appliedColumnFilters, appliedSorting]);

  // Build counts for each view, but only return a new object reference when
  // any numeric value actually changes. This prevents SmartViews from
  // re-rendering on every parent render when the counts are unchanged.
  const prevCountsRef = useRef<Record<string, number>>({});
  const counts = useMemo(() => {
    const next: Record<string, number> = {};
    for (const view of views) {
      next[view.id] = countRowsForView(rows, view);
    }
    const prev = prevCountsRef.current;
    const prevKeys = Object.keys(prev);
    const nextKeys = Object.keys(next);
    const changed =
      prevKeys.length !== nextKeys.length ||
      nextKeys.some((key) => prev[key] !== next[key]);
    if (!changed) return prev;
    prevCountsRef.current = next;
    return next;
  }, [rows, views]);

  const activeFilterCount = countActiveFilters(appliedColumnFilters);

  const handleSelectView = useCallback(
    (viewId: string) => {
      const view = views.find((entry) => entry.id === viewId);
      if (!view) return;
      setAppliedColumnFilters(normalizeColumnFilters(view.columnFilters));
      setAppliedSorting(normalizeSorting(view.sorting));
      setDraftColumnFilters(normalizeColumnFilters(view.columnFilters));
      setDraftSorting(normalizeSorting(view.sorting));
      setActiveViewId(view.id);
    },
    [views],
  );

  const handleDeleteView = useCallback(
    (viewId: string) => {
      setSavedViews((prev) => prev.filter((view) => view.id !== viewId));
      if (activeViewId !== viewId) return;
      setActiveViewId(allView.id);
      setAppliedColumnFilters(allView.columnFilters);
      setAppliedSorting(allView.sorting);
      setDraftColumnFilters(allView.columnFilters);
      setDraftSorting(allView.sorting);
    },
    [activeViewId, allView],
  );

  const handleOpenFilterSheet = useCallback(
    (e: MouseEvent) => {
      // Stop the click event from reaching vaul's document-level dismiss
      // listener. Without this, the same click that opens the drawer is
      // also seen as an "outside click" by vaul, causing an immediate close.
      e.nativeEvent.stopImmediatePropagation();
      setDraftColumnFilters(appliedColumnFilters);
      setDraftSorting(appliedSorting);
      setFilterSheetOpen(true);
    },
    [appliedColumnFilters, appliedSorting],
  );

  // AG1 fix: Only use onOpenChange for closing. Opening is handled by
  // handleOpenFilterSheet which syncs drafts first, then sets open=true.
  // Previously, syncing drafts inside onOpenChange(true) caused a state
  // update mid-animation, producing the open→close→open bounce.
  const handleFilterSheetOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setFilterSheetOpen(false);
    }
  }, []);

  const handleApplyFilters = useCallback(() => {
    const nextFilters = normalizeColumnFilters(draftColumnFilters);
    const nextSorting = normalizeSorting(draftSorting);
    setAppliedColumnFilters(nextFilters);
    setAppliedSorting(nextSorting);
    setFilterSheetOpen(false);

    const matchingView = views.find(
      (view) =>
        columnFiltersEqual(view.columnFilters, nextFilters) &&
        sortingEqual(view.sorting, nextSorting),
    );
    setActiveViewId(matchingView?.id ?? null);
  }, [draftColumnFilters, draftSorting, views]);

  const handleSaveView = useCallback(
    (name: string) => {
      const label = name.trim();
      if (label.length === 0) return;

      const normalizedFilters = normalizeColumnFilters(draftColumnFilters);
      const normalizedSorting = normalizeSorting(draftSorting);
      const existing = savedViews.find(
        (view) => view.label.toLowerCase() === label.toLowerCase(),
      );

      if (existing) {
        const updated: SmartViewPreset = {
          ...existing,
          label,
          columnFilters: normalizedFilters,
          sorting: normalizedSorting,
        };
        setSavedViews((prev) =>
          prev.map((view) => (view.id === existing.id ? updated : view)),
        );
        setAppliedColumnFilters(normalizedFilters);
        setAppliedSorting(normalizedSorting);
        setActiveViewId(existing.id);
        setFilterSheetOpen(false);
        return;
      }

      const newView: SmartViewPreset = {
        id: `smart-${Date.now().toString(36)}`,
        label,
        builtIn: false,
        columnFilters: normalizedFilters,
        sorting: normalizedSorting,
      };
      setSavedViews((prev) => [...prev, newView]);
      setAppliedColumnFilters(normalizedFilters);
      setAppliedSorting(normalizedSorting);
      setActiveViewId(newView.id);
      setFilterSheetOpen(false);
    },
    [draftColumnFilters, draftSorting, savedViews],
  );

  return (
    <div className="flex flex-col gap-3 pt-3">
      {/* Toolbar: smart views + filter button */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SmartViews
          views={views}
          activeViewId={activeViewId}
          counts={counts}
          onSelectView={handleSelectView}
          onDeleteView={handleDeleteView}
        />
        <button
          type="button"
          onClick={handleOpenFilterSheet}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-transparent px-3 py-1.5 font-mono text-xs font-medium text-[var(--text-muted)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text)]"
        >
          <Filter size={12} />
          Filters
          {activeFilterCount > 0 && (
            <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-teal-900 px-1 font-mono text-[10px] font-bold leading-tight text-teal-300">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Search input */}
      <div className="relative">
        <Search
          size={14}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--text-faint)]"
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search food names..."
          aria-label="Search food names"
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-1)] py-2 pl-9 pr-3 font-mono text-xs text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--border-strong)] focus:outline-none"
        />
      </div>

      <DatabaseTable
        data={rows}
        columnFilters={appliedColumnFilters}
        onColumnFiltersChange={setAppliedColumnFilters}
        sorting={appliedSorting}
        onSortingChange={setAppliedSorting}
        globalFilter={searchQuery}
        onGlobalFilterChange={setSearchQuery}
      />

      <FilterSheet
        open={filterSheetOpen}
        onOpenChange={handleFilterSheetOpenChange}
        columnFilters={draftColumnFilters}
        onColumnFiltersChange={setDraftColumnFilters}
        sorting={draftSorting}
        onSortingChange={setDraftSorting}
        onApply={handleApplyFilters}
        onSaveView={handleSaveView}
      />
    </div>
  );
}

// ── FoodEntryPoints removed — replaced by FoodSafetyGrid (Bug #20) ──────────

// ── Today Label (isolated timer to avoid full-page re-renders) ──────────────

function TodayLabel() {
  const [label, setLabel] = useState(() =>
    format(new Date(), "EEEE · MMM d, yyyy · h:mm a"),
  );

  useEffect(() => {
    let id: ReturnType<typeof setTimeout>;
    const tick = () => {
      const current = new Date();
      setLabel(format(current, "EEEE · MMM d, yyyy · h:mm a"));
      const msUntilNextMinute =
        (60 - current.getSeconds()) * 1000 - current.getMilliseconds();
      id = setTimeout(tick, Math.max(msUntilNextMinute, 1000));
    };
    const now = new Date();
    const msUntilNextMinute =
      (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
    id = setTimeout(tick, Math.max(msUntilNextMinute, 1000));
    return () => clearTimeout(id);
  }, []);

  return (
    <p className="font-mono text-xs uppercase tracking-[0.2em] text-(--section-summary) shrink-0">
      {label}
    </p>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PatternsPage() {
  const logs = useSyncedLogsContext();
  const allFoodTrials = useAllFoodTrials();
  const { habits } = useHabits();
  const mappedAssessments = useMappedAssessments();
  const { transitCalibration } = useTransitCalibration();

  // ── Analysis for Database tab ──────────────────────────────────────────────

  const analysis = useMemo(
    () =>
      analyzeLogs(logs, allFoodTrials ?? [], {
        habits: habits.map((h) => ({ id: h.id, name: h.name })),
        calibration: transitCalibration,
        assessments: mappedAssessments,
      }),
    [allFoodTrials, habits, transitCalibration, mappedAssessments, logs],
  );

  const databaseRows = useMemo(() => {
    // Build assessment lookup by canonical name (lowercase) for AI column.
    // Use the most recent assessment when multiple exist for the same food.
    const assessmentMap = new Map<
      string,
      {
        verdict: "safe" | "watch" | "trial_next" | "avoid";
        confidence: "high" | "medium" | "low";
      }
    >();
    for (const a of mappedAssessments ?? []) {
      const mapKey = a.canonicalName.toLowerCase();
      const existing = assessmentMap.get(mapKey);
      if (existing === undefined) {
        assessmentMap.set(mapKey, {
          verdict: a.verdict,
          confidence: a.confidence,
        });
      }
      // If a newer assessment exists we keep whichever was inserted first
      // (mappedAssessments is already sorted by reportTimestamp desc via Convex).
    }

    return analysis.foodStats.map((stat) => {
      const foodEntry = getFoodEntry(stat.key);
      const zone = foodEntry?.zone ?? 3;
      const foodGroup = foodEntry?.group;
      const digestion = foodEntry
        ? pickFoodDigestionMetadata(foodEntry)
        : undefined;

      // Resolved trials for trial history display
      const resolvedTrials =
        analysis.resolvedTrialsByKey.get(stat.key) ?? undefined;

      // AI assessment for the AI column
      const aiAssessment = assessmentMap.get(stat.key.toLowerCase());

      return buildFoodDatabaseRow(stat, {
        stage: zone,
        ...(foodGroup !== undefined && { foodGroup }),
        ...(digestion !== undefined && { digestion }),
        ...(foodEntry?.notes !== undefined && {
          registryNotes: foodEntry.notes,
        }),
        ...(resolvedTrials !== undefined && { resolvedTrials }),
        ...(aiAssessment !== undefined && {
          aiVerdict: aiAssessment.verdict,
          aiConfidence: aiAssessment.confidence,
        }),
      });
    });
  }, [analysis.foodStats, analysis.resolvedTrialsByKey, mappedAssessments]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      data-slot="patterns-page"
      className="stagger-reveal mx-auto max-w-7xl space-y-5"
    >
      {/* Page header */}
      <header className="flex flex-wrap items-baseline gap-4">
        <h1 className="font-display text-2xl font-bold tracking-tight text-(--section-summary) md:text-3xl shrink-0">
          Patterns
        </h1>
        <TodayLabel />
      </header>

      {/* Hero strip — always visible at top */}
      <HeroStrip />

      <Tabs defaultValue={PRIMARY_PATTERN_TAB} className="gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--text-faint)]">
              Explore
            </p>
            <p className="text-sm text-[var(--text-muted)]">
              Start in the database, then switch to the transit map for the
              metro view.
            </p>
          </div>
          <TabsList className="grid w-full grid-cols-2 rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-1 sm:w-auto">
            <TabsTrigger
              value={PRIMARY_PATTERN_TAB}
              className="rounded-lg px-4 py-2 font-mono text-xs uppercase tracking-[0.18em] text-[var(--text-muted)] data-[active]:bg-[var(--surface-2)] data-[active]:text-[var(--text)]"
            >
              Database
            </TabsTrigger>
            <TabsTrigger
              value={SECONDARY_PATTERN_TAB}
              className="rounded-lg px-4 py-2 font-mono text-xs uppercase tracking-[0.18em] text-[var(--text-muted)] data-[active]:bg-[var(--surface-2)] data-[active]:text-[var(--text)]"
            >
              Transit Map
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value={PRIMARY_PATTERN_TAB} forceMount>
          <DatabaseTabContent rows={databaseRows} />
        </TabsContent>

        <TabsContent value={SECONDARY_PATTERN_TAB} forceMount>
          <div
            data-slot="patterns-transit-map-panel"
            className="overflow-hidden rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface-1)] shadow-[0_24px_80px_rgba(15,23,42,0.18)]"
          >
            <Tabs defaultValue={TRANSIT_REGISTRY_TAB} className="gap-0">
              <div className="flex flex-col gap-3 border-b border-[var(--border)] px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--text-faint)]">
                    Transit views
                  </p>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    The live network reads from the registry and evidence. The
                    model guide keeps the original visual reference untouched.
                  </p>
                </div>
                <TabsList className="grid w-full grid-cols-2 rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-1 sm:w-auto">
                  <TabsTrigger
                    value={TRANSIT_REGISTRY_TAB}
                    className="rounded-lg px-4 py-2 font-mono text-xs uppercase tracking-[0.18em] text-[var(--text-muted)] data-[active]:bg-[var(--surface-2)] data-[active]:text-[var(--text)]"
                  >
                    Live network
                  </TabsTrigger>
                  <TabsTrigger
                    value={TRANSIT_GUIDE_TAB}
                    className="rounded-lg px-4 py-2 font-mono text-xs uppercase tracking-[0.18em] text-[var(--text-muted)] data-[active]:bg-[var(--surface-2)] data-[active]:text-[var(--text)]"
                  >
                    Model guide
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent
                value={TRANSIT_REGISTRY_TAB}
                forceMount
                className="p-4"
              >
                <TransitMapContainer foodStats={analysis.foodStats} />
              </TabsContent>

              <TabsContent value={TRANSIT_GUIDE_TAB}>
                <TransitMap />
              </TabsContent>
            </Tabs>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/transit-map/RegistryTransitMap.tsx

import { Clock3, FlaskConical, Route, ShieldAlert } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useTransitMapData } from "@/hooks/useTransitMapData";
import type { FoodStat } from "@/lib/analysis";
import { digestionBadgeClassName, getFoodDigestionBadges } from "@/lib/foodDigestionMetadata";
import {
  confidenceLabel,
  serviceRecord,
  stationSignalFromStatus,
  type TransitCorridor,
  type TransitStation,
  tendencyLabel,
} from "@/types/transitMap";

const GROUP_THEME: Record<
  TransitCorridor["group"],
  { panel: string; accent: string; chip: string }
> = {
  protein: {
    panel:
      "border-orange-500/20 bg-[radial-gradient(circle_at_top_left,_rgba(251,146,60,0.18),_transparent_45%),linear-gradient(180deg,rgba(15,23,42,0.95),rgba(2,6,23,0.96))]",
    accent: "text-orange-200",
    chip: "border-orange-500/20 bg-orange-500/10 text-orange-200",
  },
  carbs: {
    panel:
      "border-sky-500/20 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_45%),linear-gradient(180deg,rgba(15,23,42,0.95),rgba(2,6,23,0.96))]",
    accent: "text-sky-200",
    chip: "border-sky-500/20 bg-sky-500/10 text-sky-200",
  },
  fats: {
    panel:
      "border-emerald-500/20 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_45%),linear-gradient(180deg,rgba(15,23,42,0.95),rgba(2,6,23,0.96))]",
    accent: "text-emerald-200",
    chip: "border-emerald-500/20 bg-emerald-500/10 text-emerald-200",
  },
  seasoning: {
    panel:
      "border-rose-500/20 bg-[radial-gradient(circle_at_top_left,_rgba(244,63,94,0.18),_transparent_45%),linear-gradient(180deg,rgba(15,23,42,0.95),rgba(2,6,23,0.96))]",
    accent: "text-rose-200",
    chip: "border-rose-500/20 bg-rose-500/10 text-rose-200",
  },
};

export interface RegistryTransitMapProps {
  foodStats: FoodStat[];
}

export default function RegistryTransitMap({ foodStats }: RegistryTransitMapProps) {
  const network = useTransitMapData(foodStats);

  const firstStation = useMemo(
    () =>
      network.corridors.flatMap((corridor) => corridor.lines.flatMap((line) => line.stations))[0] ??
      null,
    [network.corridors],
  );

  const [selectedCanonical, setSelectedCanonical] = useState<string | null>(null);
  // Ref avoids re-triggering the effect when the user selects a station.
  // The effect only needs to run when the network data or firstStation changes.
  const selectedCanonicalRef = useRef(selectedCanonical);
  selectedCanonicalRef.current = selectedCanonical;

  useEffect(() => {
    const current = selectedCanonicalRef.current;
    if (current !== null && network.stationsByCanonical.has(current)) {
      return;
    }
    setSelectedCanonical(firstStation?.canonical ?? null);
  }, [firstStation, network.stationsByCanonical]);

  const selectedStation =
    (selectedCanonical !== null ? network.stationsByCanonical.get(selectedCanonical) : undefined) ??
    firstStation ??
    null;
  const selectedLocation =
    selectedStation !== null ? network.stationLocation.get(selectedStation.canonical) : undefined;
  const nextSuggested = network.corridors.find((c) => c.nextStop !== null)?.nextStop ?? null;
  const untestedStations = network.totalStations - network.testedStations;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.85fr)]">
      <section
        data-slot="registry-transit-map"
        className="overflow-hidden rounded-[1.35rem] border border-[var(--border)] bg-[var(--surface-1)]"
      >
        <div className="border-b border-slate-800 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(251,146,60,0.12),_transparent_30%),linear-gradient(180deg,rgba(2,6,23,0.98),rgba(15,23,42,0.92))] px-5 py-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-slate-500">
                Live Registry
              </p>
              <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-50">
                Transit map from your data
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
                Stations, notes, and digestion flags come directly from the canonical food registry.
                Evidence overlays on top of those stations without a separate transit taxonomy.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <SummaryCard label="Stations" value={network.totalStations} />
              <SummaryCard label="Tested" value={network.testedStations} />
              <SummaryCard label="Untested" value={untestedStations} />
              <SummaryCard
                label="Next stop"
                value={nextSuggested?.displayName ?? "Pick any"}
                compact
              />
            </div>
          </div>
        </div>

        <div className="space-y-4 p-4">
          {network.corridors.map((corridor) => {
            const theme = GROUP_THEME[corridor.group];

            return (
              <section
                key={corridor.group}
                className={`rounded-[1.15rem] border p-4 ${theme.panel}`}
              >
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
                      Corridor
                    </p>
                    <h3 className={`font-display text-xl font-semibold ${theme.accent}`}>
                      {corridor.displayName}
                    </h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.2em] ${theme.chip}`}
                    >
                      {corridor.testedCount}/{corridor.totalCount} tested
                    </span>
                    {corridor.nextStop !== null && (
                      <span className="rounded-full border border-slate-700 bg-slate-900/70 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-300">
                        Next: {corridor.nextStop.displayName}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  {corridor.lines.map((line) => (
                    <div
                      key={line.line}
                      className="rounded-2xl border border-slate-800/90 bg-slate-950/75 p-3"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div>
                          <h4 className="font-mono text-xs uppercase tracking-[0.2em] text-slate-300">
                            {line.displayName}
                          </h4>
                          <p className="text-xs text-slate-500">
                            {line.testedCount}/{line.totalCount} tested
                          </p>
                        </div>
                        {line.nextStop !== null && (
                          <span className="rounded-full border border-slate-700 bg-slate-900/90 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
                            Next {line.nextStop.displayName}
                          </span>
                        )}
                      </div>

                      <div className="space-y-2">
                        {line.stations.map((station) => (
                          <StationButton
                            key={station.canonical}
                            station={station}
                            selected={station.canonical === selectedStation?.canonical}
                            onSelect={setSelectedCanonical}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </section>

      <aside className="rounded-[1.35rem] border border-slate-800 bg-[linear-gradient(180deg,rgba(2,6,23,0.98),rgba(15,23,42,0.96))] p-5">
        {selectedStation === null || selectedLocation === undefined ? (
          <p className="text-sm text-slate-400">No station selected.</p>
        ) : (
          <StationDetail
            station={selectedStation}
            corridor={selectedLocation.corridor}
            lineName={selectedLocation.line.displayName}
          />
        )}
      </aside>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: number | string;
  compact?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-800/90 bg-slate-950/70 px-3 py-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500">{label}</p>
      <p
        className={`mt-1 font-display ${compact ? "text-base" : "text-xl"} font-semibold text-slate-100`}
      >
        {value}
      </p>
    </div>
  );
}

function StationButton({
  station,
  selected,
  onSelect,
}: {
  station: TransitStation;
  selected: boolean;
  onSelect: (canonical: string) => void;
}) {
  const signal = stationSignalFromStatus(station.primaryStatus);
  const record = serviceRecord(station);

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(station.canonical)}
      className={`w-full rounded-2xl border px-3 py-2 text-left transition focus-visible:ring-2 focus-visible:ring-sky-400 ${
        selected
          ? "border-sky-400/60 bg-sky-500/10 shadow-[0_0_0_1px_rgba(56,189,248,0.15)]"
          : "border-slate-800 bg-slate-900/70 hover:border-slate-700 hover:bg-slate-900"
      }`}
    >
      <div className="flex items-start gap-2">
        <span className={`mt-1 h-2.5 w-2.5 rounded-full ${signalDotClass(signal)}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate font-medium text-slate-100">{station.displayName}</p>
            <span className="shrink-0 rounded-full border border-slate-700 bg-slate-950 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
              Z{station.zone}
              {station.subzone ?? ""}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">{record ?? "No transit evidence yet"}</p>
        </div>
      </div>
    </button>
  );
}

function StationDetail({
  station,
  corridor,
  lineName,
}: {
  station: TransitStation;
  corridor: TransitCorridor;
  lineName: string;
}) {
  const digestionBadges = getFoodDigestionBadges(station.digestion);
  const service = serviceRecord(station);
  const theme = GROUP_THEME[corridor.group];

  return (
    <div className="space-y-5">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
          Selected station
        </p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-3xl font-semibold tracking-tight text-slate-50">
              {station.displayName}
            </h3>
            <p className="mt-1 text-sm text-slate-400">
              {corridor.displayName} · {lineName}
            </p>
          </div>
          <div
            className={`rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] ${theme.chip}`}
          >
            Zone {station.zone}
            {station.subzone !== undefined ? ` · ${station.subzone}` : ""}
          </div>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <MetricCard
          icon={<Route className="h-4 w-4" />}
          label="Status"
          value={station.primaryStatus ?? "Untested"}
        />
        <MetricCard
          icon={<Clock3 className="h-4 w-4" />}
          label="Confidence"
          value={confidenceLabel(station.confidence)}
        />
        <MetricCard
          icon={<FlaskConical className="h-4 w-4" />}
          label="Tendency"
          value={tendencyLabel(station.tendency) ?? "No signal"}
        />
      </div>

      {station.notes !== undefined && (
        <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
            Registry note
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-300">{station.notes}</p>
        </section>
      )}

      <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-slate-400" />
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
            Digestion profile
          </p>
        </div>
        {digestionBadges.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No digestion metadata attached yet.</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {digestionBadges.map((badge) => (
              <span key={badge.key} className={digestionBadgeClassName(badge.tone)}>
                {badge.label}: {badge.value}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
          Evidence overlay
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <EvidenceStat label="Trials logged" value={`${station.totalTrials}`} />
          <EvidenceStat label="Resolved transits" value={`${station.resolvedTransits}`} />
          <EvidenceStat
            label="Avg transit"
            value={
              station.avgTransitMinutes === null
                ? "Pending"
                : // Convert minutes to hours with 1 decimal: divide by 60, round via integer trick to avoid floating-point string issues
                  `${Math.round(station.avgTransitMinutes / 6) / 10}h`
            }
          />
          <EvidenceStat label="Service record" value={service ?? "No record yet"} />
        </div>
      </section>
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3">
      <div className="flex items-center gap-2 text-slate-400">{icon}</div>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-slate-100">{value}</p>
    </div>
  );
}

function EvidenceStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm leading-6 text-slate-200">{value}</p>
    </div>
  );
}

function signalDotClass(signal: ReturnType<typeof stationSignalFromStatus>): string {
  switch (signal) {
    case "green":
      return "bg-emerald-400";
    case "amber":
      return "bg-amber-400";
    case "red":
      return "bg-rose-400";
    case "blue":
      return "bg-sky-400";
    case "grey":
      return "bg-slate-500";
  }
}

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/src/hooks/useTransitMapData.ts

/**
 * useTransitMapData — data-driven transit map foundation.
 *
 * Fuses the food registry (95 stations) with the Bayesian evidence pipeline
 * (from analyzeLogs) to produce a map-ready TransitNetwork model.
 *
 * This hook is the ONLY place where registry structure meets evidence data.
 * All downstream transit-map UI components consume TransitNetwork, never
 * the registry or evidence pipeline directly.
 *
 * Data flow:
 *   registry (shared/foodRegistry.ts)
 *     → 95 entries with group, line, lineOrder, zone
 *   + evidence (analyzeLogs → FoodStat[])
 *     → primaryStatus, tendency, trials, bristol, transit times
 *   = TransitNetwork
 *     → corridors → lines → stations (with evidence)
 */

import { formatCanonicalFoodDisplayName } from "@shared/foodNormalize";
import {
  FOOD_GROUPS,
  FOOD_REGISTRY,
  type FoodGroup,
  type FoodLine,
  type FoodRegistryEntry,
  getFoodsByLine,
  getGroupDisplayName,
  getLineDisplayName,
  getLinesByGroup,
  pickFoodDigestionMetadata,
} from "@shared/foodRegistry";
import { useMemo } from "react";
import type { FoodStat } from "@/lib/analysis";
import type {
  TransitCorridor,
  TransitLine,
  TransitNetwork,
  TransitStation,
} from "@/types/transitMap";

// ── Station builder ──────────────────────────────────────────────────────

function buildStation(entry: FoodRegistryEntry, statsByKey: Map<string, FoodStat>): TransitStation {
  const stat = statsByKey.get(entry.canonical);
  const digestion = pickFoodDigestionMetadata(entry) ?? null;

  const displayName = formatCanonicalFoodDisplayName(entry.canonical);

  if (!stat || stat.totalTrials === 0) {
    return {
      canonical: entry.canonical,
      displayName,
      zone: entry.zone,
      subzone: entry.subzone,
      lineOrder: entry.lineOrder,
      notes: entry.notes,
      digestion,
      primaryStatus: null,
      tendency: null,
      totalTrials: 0,
      resolvedTransits: 0,
      avgTransitMinutes: null,
      confidence: null,
      bristolBreakdown: {},
      latestAiVerdict: null,
      latestAiReasoning: null,
      lastTrialAt: 0,
      // TODO: firstSeenAt always equals lastTrialAt here because FoodStat lacks a
      // firstSeenAt field. TransitStation requires it (non-optional), so we cannot
      // remove it without updating the type definition in src/types/transitMap.ts.
      firstSeenAt: 0,
    };
  }

  return {
    canonical: entry.canonical,
    displayName,
    zone: entry.zone,
    subzone: entry.subzone,
    lineOrder: entry.lineOrder,
    notes: entry.notes,
    digestion,
    primaryStatus: stat.primaryStatus,
    tendency: stat.tendency,
    totalTrials: stat.totalTrials,
    resolvedTransits: stat.resolvedTransits,
    avgTransitMinutes: stat.avgTransitMinutes,
    confidence: stat.confidence,
    bristolBreakdown: stat.bristolBreakdown,
    latestAiVerdict: null,
    latestAiReasoning: null,
    lastTrialAt: stat.lastTrialAt,
    // TODO: firstSeenAt always equals lastTrialAt here because FoodStat lacks a
    // firstSeenAt field. TransitStation requires it (non-optional), so we cannot
    // remove it without updating the type definition in src/types/transitMap.ts.
    firstSeenAt: stat.lastTrialAt,
  };
}

// ── Line builder ─────────────────────────────────────────────────────────

function buildLine(line: FoodLine, statsByKey: Map<string, FoodStat>): TransitLine {
  const entries = getFoodsByLine(line); // already sorted by lineOrder
  const stations = entries.map((entry) => buildStation(entry, statsByKey));
  const testedCount = stations.filter((s) => s.totalTrials > 0).length;

  // Next stop: first station by lineOrder that is untested or still building evidence
  const nextStop =
    stations.find((s) => s.primaryStatus === null || s.primaryStatus === "building") ?? null;

  return {
    line,
    displayName: getLineDisplayName(line),
    stations,
    testedCount,
    totalCount: stations.length,
    nextStop,
  };
}

// ── Corridor builder ─────────────────────────────────────────────────────

function buildCorridor(group: FoodGroup, statsByKey: Map<string, FoodStat>): TransitCorridor {
  const groupLines = getLinesByGroup(group);
  const lines = groupLines.map((line) => buildLine(line, statsByKey));

  const testedCount = lines.reduce((sum, l) => sum + l.testedCount, 0);
  const totalCount = lines.reduce((sum, l) => sum + l.totalCount, 0);

  // Corridor next stop: first across all lines by lineOrder
  const nextStop =
    lines
      .flatMap((l) => (l.nextStop ? [l.nextStop] : []))
      .sort((a, b) => a.lineOrder - b.lineOrder)[0] ?? null;

  return {
    group,
    displayName: `${getGroupDisplayName(group)} Corridor`,
    lines,
    testedCount,
    totalCount,
    nextStop,
  };
}

// ── Network builder ──────────────────────────────────────────────────────

function buildTransitNetwork(statsByKey: Map<string, FoodStat>): TransitNetwork {
  const corridors = FOOD_GROUPS.map((group) => buildCorridor(group, statsByKey));

  const stationsByCanonical = new Map<string, TransitStation>();
  const stationLocation = new Map<string, { corridor: TransitCorridor; line: TransitLine }>();

  for (const corridor of corridors) {
    for (const line of corridor.lines) {
      for (const station of line.stations) {
        stationsByCanonical.set(station.canonical, station);
        stationLocation.set(station.canonical, { corridor, line });
      }
    }
  }

  const totalStations = FOOD_REGISTRY.length;
  const testedStations = [...stationsByCanonical.values()].filter((s) => s.totalTrials > 0).length;

  return {
    corridors,
    totalStations,
    testedStations,
    stationsByCanonical,
    stationLocation,
  };
}

// ── Hook ─────────────────────────────────────────────────────────────────

/**
 * Build a TransitNetwork from the food registry and evidence analysis.
 *
 * @param foodStats - Output from analyzeLogs().foodStats. Pass empty array if
 *   analysis hasn't run yet.
 */
export function useTransitMapData(foodStats: FoodStat[]): TransitNetwork {
  return useMemo(() => {
    const statsByKey = new Map<string, FoodStat>();
    for (const stat of foodStats) {
      statsByKey.set(stat.key, stat);
    }
    return buildTransitNetwork(statsByKey);
  }, [foodStats]);
}

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/src/types/transitMap.ts

/**
 * Transit Map data model — built from registry + evidence pipeline.
 *
 * This replaces the hardcoded transitData.ts model. Every type here is
 * derived from the canonical food registry and the Bayesian evidence
 * pipeline. No hardcoded station statuses, no parallel taxonomy.
 *
 * Hierarchy: Corridor (FoodGroup) → Line (FoodLine) → Station (FoodRegistryEntry + evidence)
 */

import type {
  FoodDigestionMetadata,
  FoodGroup,
  FoodLine,
  FoodSubzone,
  FoodZone,
} from "@shared/foodRegistry";
import type { FoodPrimaryStatus, FoodTendency } from "@shared/foodTypes";

// ── Station (one canonical food with evidence) ────────────────────────────

export interface TransitStation {
  /** Registry canonical name — unique station ID. */
  canonical: string;
  /** Human display name (title-cased canonical). */
  displayName: string;
  /** Zone: 1 (safe start), 2 (expanded), 3 (experimental). */
  zone: FoodZone;
  /** Subzone for Zone 1 entries: 1A (liquids) or 1B (soft solids). */
  subzone: FoodSubzone | undefined;
  /** Position within the line (1 = try first). */
  lineOrder: number;
  /** Registry notes — digestive distinction context. */
  notes: string | undefined;
  /** Shared digestion metadata from the registry. */
  digestion: FoodDigestionMetadata | null;

  // ── Evidence (null = untested) ──────────────────────────────────────────

  /** Bayesian primary status. null = no evidence yet. */
  primaryStatus: FoodPrimaryStatus | null;
  /** Tendency: neutral/loose/hard. null = no evidence. */
  tendency: FoodTendency | null;
  /** Total trial count (all-time). */
  totalTrials: number;
  /** Resolved transit count. */
  resolvedTransits: number;
  /** Average transit time in minutes. null = no resolved transits. */
  avgTransitMinutes: number | null;
  /** Bayesian confidence (0-1). null = untested. */
  confidence: number | null;
  /** Bristol score breakdown: { 3: 5, 4: 8, 6: 2 }. Empty = untested. */
  bristolBreakdown: Record<number, number>;
  /** Latest AI verdict if any. */
  latestAiVerdict: string | null;
  /** Latest AI reasoning if any. */
  latestAiReasoning: string | null;
  /** Timestamp of most recent trial. 0 = never tested. */
  lastTrialAt: number;
  /** Timestamp of first trial. 0 = never tested. */
  firstSeenAt: number;
}

// ── Signal colour (derived from primaryStatus) ───────────────────────────

export type StationSignal = "green" | "amber" | "red" | "blue" | "grey";

export function stationSignalFromStatus(status: FoodPrimaryStatus | null): StationSignal {
  switch (status) {
    case "safe":
      return "green";
    case "building":
      return "blue";
    case "watch":
      return "amber";
    case "avoid":
      return "red";
    case null:
      return "grey";
  }
}

// ── Tendency labels (transit-themed) ─────────────────────────────────────

export type TendencyLabel = "On time" | "Express" | "Delayed";

export function tendencyLabel(tendency: FoodTendency | null): TendencyLabel | null {
  switch (tendency) {
    case "neutral":
      return "On time";
    case "loose":
      return "Express";
    case "hard":
      return "Delayed";
    case null:
      return null;
  }
}

// ── Confidence labels ────────────────────────────────────────────────────

export function confidenceLabel(confidence: number | null): string {
  if (confidence === null || confidence === 0) return "Untested";
  if (confidence < 0.3) return "More transits needed";
  if (confidence < 0.6) return "Building signal";
  return "Strong signal";
}

// ── Service record (summary string) ──────────────────────────────────────

export function serviceRecord(station: TransitStation): string | null {
  if (station.resolvedTransits === 0) return null;

  const parts: string[] = [];
  const good = station.bristolBreakdown
    ? Object.entries(station.bristolBreakdown)
        .filter(([code]) => {
          const n = Number(code);
          return n >= 3 && n <= 5;
        })
        .reduce((sum, [, count]) => sum + count, 0)
    : 0;

  const loose = station.bristolBreakdown
    ? Object.entries(station.bristolBreakdown)
        .filter(([code]) => Number(code) === 6)
        .reduce((sum, [, count]) => sum + count, 0)
    : 0;

  const hard = station.bristolBreakdown
    ? Object.entries(station.bristolBreakdown)
        .filter(([code]) => {
          const n = Number(code);
          return n <= 2;
        })
        .reduce((sum, [, count]) => sum + count, 0)
    : 0;

  const bad = station.bristolBreakdown
    ? Object.entries(station.bristolBreakdown)
        .filter(([code]) => Number(code) >= 7)
        .reduce((sum, [, count]) => sum + count, 0)
    : 0;

  const total = station.resolvedTransits;
  parts.push(`${total} transit${total === 1 ? "" : "s"}`);

  const details: string[] = [];
  if (good > 0) details.push(`${good} on time`);
  if (hard > 0) details.push(`${hard} delayed`);
  if (loose > 0) details.push(`${loose} express`);
  if (bad > 0) details.push(`${bad} cancelled`);

  if (details.length > 0) {
    parts.push(details.join(", "));
  }

  return parts.join(" — ");
}

// ── Line (sub-line within a corridor) ────────────────────────────────────

export interface TransitLine {
  /** FoodLine key (e.g., "meat_fish"). */
  line: FoodLine;
  /** Human display name (e.g., "Meat & Fish"). */
  displayName: string;
  /** Stations sorted by lineOrder. */
  stations: TransitStation[];
  /** Summary: total stations tested / total stations. */
  testedCount: number;
  /** Summary: total stations on this line. */
  totalCount: number;
  /** Next suggested station to try (first untested/building by lineOrder). */
  nextStop: TransitStation | null;
}

// ── Corridor (food group) ────────────────────────────────────────────────

export interface TransitCorridor {
  /** FoodGroup key (e.g., "protein"). */
  group: FoodGroup;
  /** Human display name (e.g., "Protein Corridor"). */
  displayName: string;
  /** Lines within this corridor. */
  lines: TransitLine[];
  /** Summary: total stations tested across all lines. */
  testedCount: number;
  /** Summary: total stations across all lines. */
  totalCount: number;
  /** Next suggested station across all lines in this corridor. */
  nextStop: TransitStation | null;
}

// ── Full network ─────────────────────────────────────────────────────────

export interface TransitNetwork {
  /** All 4 corridors. */
  corridors: TransitCorridor[];
  /** Total stations in the network. */
  totalStations: number;
  /** Total stations with at least one trial. */
  testedStations: number;
  /** Flat lookup: canonical → station (for deep linking). */
  stationsByCanonical: Map<string, TransitStation>;
  /** Flat lookup: canonical → { corridor, line } (for navigation). */
  stationLocation: Map<string, { corridor: TransitCorridor; line: TransitLine }>;
}

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/src/lib/foodDigestionMetadata.ts

import type { FoodDigestionMetadata } from "@shared/foodRegistry";

export type DigestionBadgeTone = "positive" | "neutral" | "caution" | "danger";

export interface DigestionBadge {
  key: keyof FoodDigestionMetadata;
  label: string;
  value: string;
  tone: DigestionBadgeTone;
}

const FIELD_LABELS: Record<keyof FoodDigestionMetadata, string> = {
  osmoticEffect: "Osmotic",
  totalResidue: "Residue",
  fiberTotalApproxG: "Fibre",
  fiberInsolubleLevel: "Insoluble",
  fiberSolubleLevel: "Soluble",
  gasProducing: "Gas",
  dryTexture: "Dryness",
  irritantLoad: "Irritant",
  highFatRisk: "High fat",
  lactoseRisk: "Lactose",
};

function formatLevel(value: string): string {
  return value.replace(/_/g, " ");
}

function toneForValue(value: string | number): DigestionBadgeTone {
  if (typeof value === "number") {
    if (value === 0) return "positive";
    if (value >= 3) return "caution";
    return "neutral";
  }

  if (value === "none" || value === "no" || value === "very_low") {
    return "positive";
  }
  if (value === "low") return "neutral";
  if (value === "possible" || value === "low_moderate" || value === "moderate") {
    return "caution";
  }
  if (value === "moderate_high" || value === "high" || value === "yes") {
    return "danger";
  }
  // Unknown risk levels default to caution — err on the side of warning in a health app
  return "caution";
}

export function hasFoodDigestionMetadata(
  metadata: FoodDigestionMetadata | null | undefined,
): metadata is FoodDigestionMetadata {
  return metadata !== null && metadata !== undefined && Object.keys(metadata).length > 0;
}

const KNOWN_METADATA_KEYS = new Set<string>(Object.keys(FIELD_LABELS));

export function getFoodDigestionBadges(
  metadata: FoodDigestionMetadata | null | undefined,
): DigestionBadge[] {
  if (!hasFoodDigestionMetadata(metadata)) return [];

  return (Object.entries(metadata) as Array<[keyof FoodDigestionMetadata, string | number]>)
    .filter(([key]) => KNOWN_METADATA_KEYS.has(key))
    .map(([key, value]) => ({
      key,
      label: FIELD_LABELS[key],
      value:
        typeof value === "number"
          ? `${value}g`
          : key === "gasProducing" || key === "dryTexture"
            ? value
            : formatLevel(value),
      tone: toneForValue(value),
    }));
}

// Presentation utility co-located with digestion metadata for convenience
export function digestionBadgeClassName(tone: DigestionBadgeTone): string {
  const base =
    "inline-flex items-center rounded-full border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em]";

  switch (tone) {
    case "positive":
      return `${base} border-emerald-500/25 bg-emerald-500/10 text-emerald-200`;
    case "neutral":
      return `${base} border-slate-600 bg-slate-800 text-slate-300`;
    case "caution":
      return `${base} border-amber-500/25 bg-amber-500/10 text-amber-200`;
    case "danger":
      return `${base} border-rose-500/25 bg-rose-500/10 text-rose-200`;
  }
}

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/src/lib/analysis.ts

import { buildFoodEvidenceResult, toLegacyFoodStatus } from "@shared/foodEvidence";
import { formatCanonicalFoodDisplayName } from "@shared/foodNormalize";
import { resolveCanonicalFoodName } from "@shared/foodProjection";
import type { FoodTrialStatus, SyncedLog } from "@/lib/sync";
import type { DigestiveLogData, FoodPrimaryStatus, FoodTendency } from "@/types/domain";

type DigestiveCategory = "constipated" | "hard" | "firm" | "loose" | "diarrhea";
export type FoodStatus = Exclude<FoodTrialStatus, "culprit" | "cleared">;
type TrialOutcome = "good" | "loose" | "hard" | "bad";

/** A single resolved food-to-bowel correlation record, for display in trial history. */
export interface LocalTrialRecord {
  /** Unique ID for rendering keys (trialId from food log). */
  id: string;
  /** Timestamp of when the food was eaten. */
  foodTimestamp: number;
  /** Bristol score of the correlated bowel event (null if not recorded). */
  bristolCode: number | null;
  /** Transit time in minutes from eating to bowel event. */
  transitMinutes: number;
  /** Outcome classification: good, loose, hard, bad. */
  outcome: TrialOutcome;
  /** Original food name as logged by the user (e.g., "baguette" for canonical "bread"). */
  foodName?: string;
  /** Quantity of the food item (e.g., 2 for "2 slices"). Not yet populated by the evidence pipeline. */
  quantity?: number;
  /** Unit of the food quantity (e.g., "slices", "g"). Not yet populated by the evidence pipeline. */
  unit?: string;
}

export interface FoodStat {
  key: string; // canonical name (from LLM or legacy normalization)
  name: string; // display name
  totalTrials: number; // all-time trial count
  recentOutcomes: TrialOutcome[]; // last 3 trial outcomes (newest first)
  badCount: number; // diarrhea/constipation in last 3
  looseCount: number; // loose in last 3
  hardCount: number; // hard in last 3
  goodCount: number; // normal/no-event in last 3
  avgDelayHours: number | null;
  lastTrialAt: number;
  status: FoodStatus;
  primaryStatus: FoodPrimaryStatus;
  tendency: FoodTendency;
  confidence: number;
  codeScore: number;
  aiScore: number;
  combinedScore: number;
  recentSuspect: boolean;
  clearedHistory: boolean;
  learnedTransitCenterMinutes: number;
  learnedTransitSpreadMinutes: number;
  bristolBreakdown: Record<number, number>; // e.g., { 4: 3, 5: 1, 6: 2 }
  avgTransitMinutes: number | null; // average time from eating to stool in minutes
  resolvedTransits: number; // count of completed transits (resolved trials)
}

interface FusedFoodSummaryOverride {
  aiScore?: number;
  clearedHistory?: boolean;
  codeScore?: number;
  combinedScore?: number;
  confidence?: number;
  learnedTransitCenterMinutes?: number;
  learnedTransitSpreadMinutes?: number;
  primaryStatus?: FoodPrimaryStatus;
  recentSuspect?: boolean;
  tendency?: FoodTendency;
}

interface AnalysisResult {
  foodStats: FoodStat[];
  /** Per-food-key resolved trial records, for trial history display. Sorted newest first. */
  resolvedTrialsByKey: Map<string, LocalTrialRecord[]>;
}

/** Status sort order: safe foods first, risky last */
export const STATUS_ORDER_SAFE_FIRST: Record<FoodStatus, number> = {
  safe: 0,
  "safe-loose": 1,
  "safe-hard": 2,
  testing: 3,
  watch: 4,
  risky: 5,
};

export function analyzeLogs(
  logs: SyncedLog[],
  fusedFoodSummaries: ReadonlyArray<
    {
      canonicalName: string;
    } & FusedFoodSummaryOverride
  > = [],
  evidenceInputs?: {
    habits?: Array<{ id: string; name: string }> | undefined;
    calibration?: import("@shared/foodEvidence").TransitCalibration | undefined;
    assessments?: import("@shared/foodEvidence").FoodAssessmentRecord[] | undefined;
  },
): AnalysisResult {
  const fused = buildFoodEvidenceResult({
    logs,
    ...(evidenceInputs?.habits && { habits: evidenceInputs.habits }),
    ...(evidenceInputs?.calibration && {
      calibration: evidenceInputs.calibration,
    }),
    ...(evidenceInputs?.assessments && {
      assessments: evidenceInputs.assessments,
    }),
  });
  const overridesByKey = new Map(
    fusedFoodSummaries.map((summary) => [resolveCanonicalFoodName(summary.canonicalName), summary]),
  );
  const foodStats = fused.summaries.map((summary) => {
    const override = overridesByKey.get(summary.canonicalName);

    // Compute avg transit in a single pass — avoids allocating a transitValues array.
    const trialCount = summary.trials.length;
    let transitSum = 0;
    for (const trial of summary.trials) {
      transitSum += trial.transitMinutes;
    }
    const avgTransitMinutes = trialCount > 0 ? Math.round(transitSum / trialCount) : null;
    const avgDelayHours =
      avgTransitMinutes !== null ? Math.round((avgTransitMinutes / 60) * 10) / 10 : null;
    const recentOutcomes = summary.trials.slice(0, 3).map((trial) => trial.outcome);

    // Count outcomes in a single pass instead of four separate filter calls.
    let badCount = 0;
    let looseCount = 0;
    let hardCount = 0;
    let goodCount = 0;
    for (const outcome of recentOutcomes) {
      if (outcome === "bad") badCount += 1;
      else if (outcome === "loose") looseCount += 1;
      else if (outcome === "hard") hardCount += 1;
      else goodCount += 1;
    }

    const bristolBreakdown = summary.trials.reduce<Record<number, number>>((acc, trial) => {
      if (trial.bristolCode === null) return acc;
      acc[trial.bristolCode] = (acc[trial.bristolCode] ?? 0) + 1;
      return acc;
    }, {});
    const primaryStatus = override?.primaryStatus ?? summary.primaryStatus;
    const tendency = override?.tendency ?? summary.tendency;
    const legacyStatus = toLegacyFoodStatus(primaryStatus, tendency);

    return {
      key: summary.canonicalName,
      name: formatCanonicalFoodDisplayName(summary.canonicalName),
      totalTrials: summary.totalTrials,
      recentOutcomes,
      badCount,
      looseCount,
      hardCount,
      goodCount,
      avgDelayHours,
      lastTrialAt: summary.lastTrialAt,
      status: legacyStatus,
      primaryStatus,
      tendency,
      confidence: override?.confidence ?? summary.confidence,
      codeScore: override?.codeScore ?? summary.codeScore,
      aiScore: override?.aiScore ?? summary.aiScore,
      combinedScore: override?.combinedScore ?? summary.combinedScore,
      recentSuspect: override?.recentSuspect ?? summary.recentSuspect,
      clearedHistory: override?.clearedHistory ?? summary.clearedHistory,
      learnedTransitCenterMinutes:
        override?.learnedTransitCenterMinutes ?? summary.learnedTransitCenterMinutes,
      learnedTransitSpreadMinutes:
        override?.learnedTransitSpreadMinutes ?? summary.learnedTransitSpreadMinutes,
      bristolBreakdown,
      avgTransitMinutes,
      resolvedTransits: summary.resolvedTrials,
    } satisfies FoodStat;
  });
  foodStats.sort((a, b) => {
    const statusDiff = STATUS_ORDER_SAFE_FIRST[a.status] - STATUS_ORDER_SAFE_FIRST[b.status];
    if (statusDiff !== 0) return statusDiff;
    if (b.totalTrials !== a.totalTrials) return b.totalTrials - a.totalTrials;
    return b.lastTrialAt - a.lastTrialAt;
  });

  // Build per-food-key resolved trial records for trial history display
  const resolvedTrialsByKey = new Map<string, LocalTrialRecord[]>();
  for (const summary of fused.summaries) {
    const records = summary.trials.map((trial) => ({
      id: trial.trialId,
      foodTimestamp: trial.foodTimestamp,
      bristolCode: trial.bristolCode,
      transitMinutes: trial.transitMinutes,
      outcome: trial.outcome,
      ...(trial.foodName !== undefined && { foodName: trial.foodName }),
    }));
    if (records.length === 0) continue;
    records.sort((a, b) => b.foodTimestamp - a.foodTimestamp);
    resolvedTrialsByKey.set(summary.canonicalName, records);
  }

  return {
    foodStats,
    resolvedTrialsByKey,
  };
}

export function bristolToConsistency(code: number): DigestiveCategory {
  if (!Number.isInteger(code) || code < 1 || code > 7) {
    throw new Error(`Invalid Bristol code: ${code}. Must be 1-7.`);
  }
  if (code === 7) return "diarrhea";
  if (code === 6) return "loose";
  if (code === 1) return "constipated";
  if (code === 2) return "hard";
  return "firm";
}

export function normalizeDigestiveCategory(
  data: DigestiveLogData | Record<string, unknown>,
): DigestiveCategory | null {
  const tag = readText(data?.consistencyTag).toLowerCase();
  if (
    tag === "constipated" ||
    tag === "hard" ||
    tag === "firm" ||
    tag === "loose" ||
    tag === "diarrhea"
  )
    return tag;

  const code = Number(data?.bristolCode);
  if (Number.isFinite(code)) {
    return bristolToConsistency(code);
  }

  // No usable data — return null so the caller can skip this data point
  // rather than defaulting to "loose" and unfairly penalising foods.
  return null;
}

function readText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

export function normalizeEpisodesCount(value: unknown): number {
  const count = Number(value);
  if (!Number.isFinite(count)) return 1;
  return Math.min(Math.max(Math.floor(count), 1), 20);
}

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/shared/foodRegistry.ts

/**
 * Food Registry — barrel re-export.
 *
 * All registry data (types, entries, zone arrays) lives in foodRegistryData.ts.
 * All lookup/utility functions live in foodRegistryUtils.ts.
 *
 * This file re-exports everything from both for backward compatibility.
 */

export type {
  FoodCategory,
  FoodDigestionMetadata,
  FoodDryTextureLevel,
  FoodGasLevel,
  FoodGroup,
  FoodLine,
  FoodRegistryEntry,
  FoodResidueLevel,
  FoodRiskLevel,
  FoodSubcategory,
  FoodSubzone,
  FoodZone,
} from "./foodRegistryData";

export { FOOD_GROUP_LINES, FOOD_REGISTRY } from "./foodRegistryData";

export {
  CANONICAL_FOOD_NAMES,
  FOOD_GROUPS,
  FOOD_LINES,
  getFoodDigestionMetadata,
  getFoodEntry,
  getFoodGroup,
  getFoodLine,
  getFoodsByLine,
  getFoodsByZone,
  getFoodZone,
  getGroupDisplayName,
  getLineDisplayName,
  getLinesByGroup,
  isCanonicalFood,
  pickFoodDigestionMetadata,
} from "./foodRegistryUtils";

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/shared/foodRegistryData.ts

/**
 * Food Registry — the single source of truth for all canonical foods.
 *
 * Every canonical food in this app is defined here. Both the deterministic
 * canonicalization function and the LLM canonicalization prompt are derived
 * from this registry. To add, rename, or reclassify a food, edit this file only.
 *
 * Zone model (metro map metaphor):
 *   Zone 1A  – Clear and full liquids. Immediate post-op recovery.
 *   Zone 1B  – Soft, low-residue solids. First solid foods post-surgery.
 *   Zone 2   – Expanded but still defensive diet. More variety, mild herbs,
 *              more protein preparations, peeled/well-cooked veg. Still no
 *              garlic, onion, chili, fried foods, legumes, or raw salads.
 *   Zone 3   – Experimental. Anything outside Zones 1–2. Introduce one at a
 *              time only when stable on a Zone 2 baseline.
 *
 * Hierarchy:
 *   4 groups (protein, carbs, fats, seasoning) → 11 sub-lines.
 *   Every entry has a required group + line assignment.
 *
 * Clinical basis: <2 g fibre per serving for Zones 1–2; no skins/seeds/hulls;
 * no strong spices. Sources: NHS low-residue diet leaflets, UCSF ileostomy
 * diet, Bowel Cancer Australia, Leeds Teaching Hospitals ileostomy guide.
 */

export type FoodZone = 1 | 2 | 3;
export type FoodSubzone = "1A" | "1B";

export const FOOD_GROUP_LINES = {
  protein: ["meat_fish", "eggs_dairy", "vegetable_protein"],
  carbs: ["grains", "vegetables", "fruit"],
  fats: ["oils", "dairy_fats", "nuts_seeds"],
  seasoning: ["sauces_condiments", "herbs_spices"],
} as const;

export type FoodGroup = keyof typeof FOOD_GROUP_LINES;
export type FoodLine = (typeof FOOD_GROUP_LINES)[FoodGroup][number];

export type FoodCategory =
  | "protein"
  | "carbohydrate"
  | "fat"
  | "dairy"
  | "condiment"
  | "drink"
  | "beverage";

export type FoodSubcategory =
  | "meat"
  | "fish"
  | "egg"
  | "legume"
  | "grain"
  | "vegetable"
  | "root_vegetable"
  | "fruit"
  | "oil"
  | "butter_cream"
  | "nut_seed"
  | "nut"
  | "milk_yogurt"
  | "cheese"
  | "dairy"
  | "dairy_alternative"
  | "dessert"
  | "frozen"
  | "herb"
  | "spice"
  | "sauce"
  | "acid"
  | "thickener"
  | "seasoning"
  | "irritant"
  | "processed"
  | "composite_dish"
  | "sugar"
  | "broth"
  | "hot_drink"
  | "juice"
  | "supplement"
  | "water"
  | "alcohol"
  | "fizzy_drink";

export type FoodRiskLevel =
  | "none"
  | "low"
  | "low_moderate"
  | "moderate"
  | "moderate_high"
  | "high";

export type FoodResidueLevel =
  | "very_low"
  | "low"
  | "low_moderate"
  | "moderate"
  | "high";

export type FoodGasLevel = "no" | "possible" | "yes";
export type FoodDryTextureLevel = "no" | "low" | "yes";

export interface FoodDigestionMetadata {
  osmoticEffect?: FoodRiskLevel;
  totalResidue?: FoodResidueLevel;
  fiberTotalApproxG?: number;
  fiberInsolubleLevel?: FoodRiskLevel;
  fiberSolubleLevel?: FoodRiskLevel;
  gasProducing?: FoodGasLevel;
  dryTexture?: FoodDryTextureLevel;
  irritantLoad?: FoodRiskLevel;
  highFatRisk?: FoodRiskLevel;
  lactoseRisk?: FoodRiskLevel;
}

interface FoodRegistryEntryBase extends FoodDigestionMetadata {
  /** The tracking unit. This is what the transit map and trial system use. */
  canonical: string;
  zone: FoodZone;
  /** Only set for zone 1 entries: 1A = liquids, 1B = soft solids. */
  subzone?: FoodSubzone;
  category: FoodCategory;
  subcategory: FoodSubcategory;
  /** Primary macronutrients. Dual-role foods (dairy, legumes) list more than one. */
  macros: ReadonlyArray<"protein" | "carbohydrate" | "fat">;
  /**
   * Natural-language phrases a user might type that map to this canonical.
   * Used both for deterministic lookup (after normalization) and as LLM context.
   */
  examples: ReadonlyArray<string>;
  /** Macronutrient group for transit map display. */
  group: FoodGroup;
  /** Sub-line within the group. */
  line: FoodLine;
  /** Suggested exploration order within the sub-line (1 = try first). */
  lineOrder: number;
  /** Why this canonical is distinct — fed to the LLM as context. */
  notes?: string;
}

export type FoodRegistryEntry = {
  [Group in FoodGroup]: FoodRegistryEntryBase & {
    group: Group;
    line: (typeof FOOD_GROUP_LINES)[Group][number];
  };
}[FoodGroup];

// ─────────────────────────────────────────────────────────────────────────────
// ZONE 1A — Clear and full liquids
// ─────────────────────────────────────────────────────────────────────────────

const ZONE_1A: ReadonlyArray<FoodRegistryEntry> = [
  {
    canonical: "clear broth",
    zone: 1,
    subzone: "1A",
    category: "drink",
    subcategory: "broth",
    macros: ["protein"],
    group: "protein",
    line: "meat_fish",
    lineOrder: 1,
    examples: [
      "broth",
      "clear broth",
      "chicken broth",
      "chicken stock",
      "beef broth",
      "beef stock",
      "vegetable stock",
      "vegetable broth",
      "bone broth",
      "bouillon",
      "consommé",
      "clear soup",
      "stock",
    ],
    notes:
      "Clear, strained liquid only. No solids, cream, or blended vegetables.",
  },
  {
    canonical: "gelatin dessert",
    zone: 1,
    subzone: "1A",
    category: "carbohydrate",
    subcategory: "dessert",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "grains",
    lineOrder: 0,
    examples: [
      "gelatin dessert",
      "gelatin",
      "gelatine",
      "jelly",
      "jello",
      "jelly pot",
      "gelatin cup",
    ],
    notes:
      "Smooth gelatin dessert only. No fruit pieces, seeds, cream, or layered toppings.",
  },
  {
    canonical: "smooth soup",
    zone: 1,
    subzone: "1A",
    category: "drink",
    subcategory: "broth",
    macros: ["carbohydrate", "fat"],
    group: "carbs",
    line: "vegetables",
    lineOrder: 0,
    examples: [
      "smooth soup",
      "blended soup",
      "pureed soup",
      "strained soup",
      "carrot soup",
      "butternut squash soup",
      "pumpkin soup",
      "potato soup",
      "cream of potato soup",
      "cream of pumpkin soup",
      "cream of carrot soup",
    ],
    notes:
      "Fully blended and strained. No chunks, seeds, or high-fat cream. Cream-of style soups are fine in small amounts.",
  },
  {
    canonical: "protein drink",
    zone: 1,
    subzone: "1A",
    category: "drink",
    subcategory: "milk_yogurt",
    macros: ["protein"],
    group: "protein",
    line: "eggs_dairy",
    lineOrder: 6,
    examples: [
      "protein drink",
      "clear protein drink",
      "clear whey",
      "medical protein drink",
      "protein water",
      "clear protein shake",
    ],
    notes:
      "Clear whey or hospital-style protein water. Kept separate from milk because the texture and sugar load behave differently.",
    osmoticEffect: "moderate",
    totalResidue: "very_low",
    fiberTotalApproxG: 0,
    fiberInsolubleLevel: "none",
    fiberSolubleLevel: "none",
    gasProducing: "possible",
    dryTexture: "no",
    irritantLoad: "low",
    highFatRisk: "none",
    lactoseRisk: "low",
  },

  // ── beverages ──
  {
    canonical: "water",
    zone: 1,
    subzone: "1A",
    category: "beverage",
    subcategory: "water",
    macros: [],
    group: "carbs",
    line: "vegetables",
    lineOrder: 1,
    examples: [
      "water",
      "plain water",
      "still water",
      "tap water",
      "mineral water",
      "filtered water",
      "glass of water",
      "sparkling water",
    ],
    notes:
      "Most fundamental intake. Sparkling/carbonated water may cause gas — see carbonated drinks for Zone 3 fizzy beverages. Small sips recommended initially post-surgery.",
  },
  {
    canonical: "diluted juice",
    zone: 1,
    subzone: "1A",
    category: "beverage",
    subcategory: "juice",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "fruit",
    lineOrder: 0,
    examples: [
      "apple juice",
      "diluted juice",
      "clear juice",
      "strained juice",
      "grape juice",
      "diluted squash",
      "squash",
      "cordial",
      "diluted cordial",
      "fruit juice",
      "juice",
    ],
    notes:
      "Clear or strained juice only — no pulp. Dilute 50:50 with water initially to reduce osmotic load. Apple juice is the standard first juice post-surgery.",
  },
  {
    canonical: "tea",
    zone: 1,
    subzone: "1A",
    category: "beverage",
    subcategory: "hot_drink",
    macros: [],
    group: "carbs",
    line: "vegetables",
    lineOrder: 24,
    examples: [
      "tea",
      "weak tea",
      "plain tea",
      "black tea",
      "herbal tea",
      "chamomile tea",
      "peppermint tea",
      "green tea",
      "rooibos",
      "decaf tea",
      "cup of tea",
      "cuppa",
    ],
    notes:
      "Weak/plain tea without milk. Universally allowed on clear liquid diets. Herbal teas (chamomile, peppermint) are often recommended for post-surgical comfort. Caffeinated tea in moderation.",
  },
  {
    canonical: "electrolyte drink",
    zone: 1,
    subzone: "1A",
    category: "beverage",
    subcategory: "supplement",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "vegetables",
    lineOrder: 25,
    examples: [
      "electrolyte drink",
      "dioralyte",
      "pedialyte",
      "oral rehydration",
      "ORS",
      "rehydration salts",
      "electrolyte water",
      "sports drink",
      "lucozade sport",
      "powerade",
      "gatorade",
    ],
    notes:
      "Essential for post-surgical hydration, especially after ileocolic resection. Osmotic effect can be moderate due to sugar/salt concentration.",
  },
  {
    canonical: "ice lolly",
    zone: 1,
    subzone: "1A",
    category: "beverage",
    subcategory: "frozen",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "fruit",
    lineOrder: 15,
    examples: [
      "ice lolly",
      "popsicle",
      "ice pop",
      "fruit ice",
      "frozen juice bar",
      "ice block",
      "calippo",
      "fab ice lolly",
      "mr freeze",
    ],
    notes:
      "Smooth ice lollies only — no fruit pieces, no cream/dairy. Essentially frozen diluted juice. Standard clear liquid diet item for patients with poor appetite.",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// ZONE 1B — Soft, low-residue solids
// ─────────────────────────────────────────────────────────────────────────────

const ZONE_1B: ReadonlyArray<FoodRegistryEntry> = [
  // ── meat_fish ──
  {
    canonical: "boiled fish",
    zone: 1,
    subzone: "1B",
    category: "protein",
    subcategory: "fish",
    macros: ["protein"],
    group: "protein",
    line: "meat_fish",
    lineOrder: 2,
    examples: [
      "fish",
      "boiled fish",
      "poached fish",
      "boiled cod",
      "poached haddock",
      "steamed white fish",
      "steamed fish",
      "poached white fish",
      "steamed cod",
      "poached cod",
      "steamed haddock",
      "steamed tilapia",
      "steamed sole",
      "steamed plaice",
      "steamed pollock",
      "plain fish",
      "fish cooked in water",
      "merluza fish poached",
      "merlusa fish poached",
      "poached merluza",
      "poached hake",
    ],
    notes: "White fish only, moist-heat, no added fat.",
  },
  {
    canonical: "boiled white meat",
    zone: 1,
    subzone: "1B",
    category: "protein",
    subcategory: "meat",
    macros: ["protein"],
    group: "protein",
    line: "meat_fish",
    lineOrder: 3,
    examples: [
      "boiled chicken",
      "poached chicken",
      "boiled turkey",
      "poached turkey",
      "steamed chicken",
      "poached chicken breast",
      "boiled chicken breast",
      "steamed chicken breast",
      "poached chicken thigh",
      "boiled chicken thigh",
      "poached chicken fillet",
      "boiled chicken fillet",
      "chicken cooked in water",
      "slow cooked chicken in broth",
    ],
    notes:
      "Moist-heat only (poached, boiled, steamed). No added fat, no browning. The most gentle white meat preparation for Zone 1.",
  },

  // ── eggs_dairy ──
  {
    canonical: "plain yogurt",
    zone: 1,
    subzone: "1B",
    category: "dairy",
    subcategory: "milk_yogurt",
    macros: ["protein", "fat"],
    group: "protein",
    line: "eggs_dairy",
    lineOrder: 1,
    examples: [
      "yogurt",
      "yoghurt",
      "plain yogurt",
      "plain yoghurt",
      "natural yogurt",
      "desnatado yogurt",
      "desnatado yoghurt",
      "plain desnatado yogurt",
      "greek yogurt",
      "greek yoghurt",
      "low fat yogurt",
      "smooth yogurt",
      "probiotic yogurt",
      "live yogurt",
    ],
    notes:
      "Plain, smooth, no fruit pieces or granola. Greek yogurt included — high protein, easy to digest.",
  },
  {
    canonical: "egg",
    zone: 1,
    subzone: "1B",
    category: "protein",
    subcategory: "egg",
    macros: ["protein", "fat"],
    group: "protein",
    line: "eggs_dairy",
    lineOrder: 2,
    examples: [
      "egg",
      "eggs",
      "boiled egg",
      "soft boiled egg",
      "hard boiled egg",
      "dippy egg",
      "poached egg",
      "poached eggs",
      "scrambled egg",
      "scrambled eggs",
      // soft scrambled egg moved from Zone 2 buttered scrambled eggs to Zone 1B plain egg —
      // rationale: without butter, plain soft-scrambled is digestively equivalent to boiled egg
      "soft scrambled egg",
      "soft scrabled egg", // intentional typo alias for voice-to-text capture
      "omelette",
      "omelet",
      "plain omelette",
      "egg white",
      "egg whites",
      "frittata",
      "shirred egg",
      "coddled egg",
      "two egg omelette",
      "three scrambled eggs",
      "six poached eggs",
      "four boiled eggs",
    ],
    notes:
      "Any cooked egg preparation without added fat: boiled, poached, scrambled (no butter), plain omelette. Quantity variations all map here.",
  },
  {
    canonical: "milk",
    zone: 1,
    subzone: "1B",
    category: "dairy",
    subcategory: "milk_yogurt",
    macros: ["protein", "carbohydrate", "fat"],
    group: "protein",
    line: "eggs_dairy",
    lineOrder: 3,
    examples: [
      "milk",
      "whole milk",
      "full fat milk",
      "semi-skimmed milk",
      "skimmed milk",
      "low fat milk",
      "cow's milk",
      "glass of milk",
      "warm milk",
      "hot milk",
    ],
    notes:
      "Includes milk drunk plain or used in tea/coffee. Lactose intolerance post-surgery is possible — track tolerance.",
  },
  {
    canonical: "cottage cheese",
    zone: 1,
    subzone: "1B",
    category: "dairy",
    subcategory: "cheese",
    macros: ["protein", "fat"],
    group: "protein",
    line: "eggs_dairy",
    lineOrder: 4,
    examples: [
      "cottage cheese",
      "low fat cottage cheese",
      "smooth cottage cheese",
    ],
    notes: "Soft, smooth, high protein, low fat. Easy to digest.",
  },
  {
    canonical: "custard",
    zone: 1,
    subzone: "1B",
    category: "dairy",
    subcategory: "dessert",
    macros: ["carbohydrate", "fat", "protein"],
    group: "protein",
    line: "eggs_dairy",
    lineOrder: 5,
    examples: [
      "custard",
      "plain custard",
      "vanilla custard",
      "egg custard",
      "pouring custard",
      "crème anglaise",
      "creme anglaise",
    ],
    notes:
      "Smooth milk-and-egg custard only. No pastry shells, dried fruit, or baked skins.",
  },

  // ── grains ──
  {
    canonical: "white rice",
    zone: 1,
    subzone: "1B",
    category: "carbohydrate",
    subcategory: "grain",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "grains",
    lineOrder: 2,
    examples: [
      "white rice",
      "rice",
      "plain rice",
      "boiled rice",
      "steamed rice",
      "long grain rice",
      "basmati rice",
      "jasmine rice",
      "arborio rice",
      "risotto rice",
      "congee",
      "rice porridge",
      "rice soup (rice)",
      "sm bowl white rice soup (rice)",
    ],
    notes:
      "Well-cooked, plain. Any white rice variety. Congee counts here — very well-cooked.",
  },
  {
    canonical: "toast",
    zone: 1,
    subzone: "1B",
    category: "carbohydrate",
    subcategory: "grain",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "grains",
    lineOrder: 3,
    examples: [
      "toast",
      "white toast",
      "plain toast",
      "dry toast",
      "slice of toast",
      "two slices of toast",
    ],
    notes:
      "A BRAT-diet staple. Toasting dries the bread and makes it easier to digest than soft white bread. Distinct canonical — do not merge with white bread.",
  },
  {
    canonical: "soaked cracker",
    zone: 1,
    subzone: "1B",
    category: "carbohydrate",
    subcategory: "grain",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "grains",
    lineOrder: 4,
    examples: [
      "soaked cracker",
      "soaked plain cracker",
      "cracker soaked in broth",
      "plain salted cracker soaked in broth",
    ],
    notes:
      "Zone 1 cracker only: softened in broth or soup until no longer dry. Dry refined crackers move to crispy cracker in Zone 2.",
  },
  {
    canonical: "white bread",
    zone: 1,
    subzone: "1B",
    category: "carbohydrate",
    subcategory: "grain",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "grains",
    lineOrder: 5,
    examples: [
      // bare "bread" → white bread; specific bread types (sourdough, rye, etc.) have their own entries
      "bread",
      "white bread",
      "white loaf",
      "white roll",
      "white bread roll",
      "sliced white bread",
      "soft white bread",
      "crusty white bread",
      "crusty bread",
      "stale crusty bread",
      "stale bread",
      "baguette",
      "1/2 baguette",
      "1/2 a baguette",
      "fresh baked baguette",
      "white sandwich bread",
      "plain white roll",
      "white pitta",
      "french baguette",
      "baked baguette",
      "french bread",
      "soft white bread slice",
      "wrap",
      "flat bread tortilla",
      "wrap (flat bread tortilla)",
      "hamburger bun",
      "hot dog bun",
    ],
    notes:
      "Soft white bread. Slightly more fermentable than toast — users often tolerate toast first. No seeds, grains, or added fibre.",
  },
  {
    canonical: "white pasta",
    zone: 1,
    subzone: "1B",
    category: "carbohydrate",
    subcategory: "grain",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "grains",
    lineOrder: 6,
    examples: [
      "pasta",
      "white pasta",
      "spaghetti",
      "penne",
      "fusilli",
      "tagliatelle",
      "linguine",
      "macaroni",
      "rigatoni",
      "orzo",
      "cooked pasta",
      "boiled pasta",
    ],
    notes:
      "White/refined pasta only, well-cooked. No wholemeal pasta (Zone 3).",
  },
  {
    canonical: "rice cracker",
    zone: 1,
    subzone: "1B",
    category: "carbohydrate",
    subcategory: "grain",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "grains",
    lineOrder: 8,
    examples: [
      "rice cracker",
      "rice crackers",
      "plain rice cracker",
      "rice cake",
      "plain rice cake",
      "savoury rice cracker",
    ],
    notes: "Light crackers. Low residue, easy to digest.",
  },
  {
    canonical: "porridge",
    zone: 1,
    subzone: "1B",
    category: "carbohydrate",
    subcategory: "grain",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "grains",
    lineOrder: 9,
    examples: [
      "porridge",
      "oatmeal",
      "oats",
      "smooth porridge",
      "rolled oats",
      "instant oats",
      "ready brek",
      "plain oat porridge",
    ],
    notes: "Smooth, plain, no added seeds or dried fruit.",
  },
  {
    canonical: "noodles",
    zone: 1,
    subzone: "1B",
    category: "carbohydrate",
    subcategory: "grain",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "grains",
    lineOrder: 7,
    examples: [
      "noodles",
      "plain noodles",
      "egg noodles",
      "rice noodles",
      "udon",
      "vermicelli",
      "plain noodle soup noodles",
    ],
    notes:
      "Plain refined noodles only, well-cooked and not fried. No spicy broths, garlic-heavy sauces, or stir-fry preparations.",
  },
  {
    canonical: "rice pudding",
    zone: 1,
    subzone: "1B",
    category: "carbohydrate",
    subcategory: "dessert",
    macros: ["carbohydrate", "fat", "protein"],
    group: "carbs",
    line: "grains",
    lineOrder: 10,
    examples: [
      "rice pudding",
      "plain rice pudding",
      "creamed rice",
      "milky rice pudding",
      "rice pudding pot",
    ],
    notes:
      "Soft rice cooked in milk until very tender. No dried fruit, nuts, seeds, or cinnamon-heavy toppings.",
  },
  {
    canonical: "soft couscous",
    zone: 1,
    subzone: "1B",
    category: "carbohydrate",
    subcategory: "grain",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "grains",
    lineOrder: 11,
    examples: [
      "soft couscous",
      "plain couscous",
      "soft plain couscous",
      "couscous soft",
      "fine couscous",
    ],
    notes:
      "Plain, fine couscous cooked very soft. No herbs, seeds, or vegetables.",
    osmoticEffect: "low",
    totalResidue: "low",
    fiberTotalApproxG: 1,
    fiberInsolubleLevel: "low",
    fiberSolubleLevel: "low",
    gasProducing: "no",
    dryTexture: "no",
    irritantLoad: "none",
    highFatRisk: "none",
    lactoseRisk: "none",
  },
  {
    canonical: "soft polenta",
    zone: 1,
    subzone: "1B",
    category: "carbohydrate",
    subcategory: "grain",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "grains",
    lineOrder: 12,
    examples: [
      "soft polenta",
      "plain polenta",
      "soft fine polenta",
      "fine polenta",
      "polenta soft",
    ],
    notes:
      "Plain, fine polenta cooked until spoon-soft. No cheese, herbs, or coarse grit.",
    osmoticEffect: "low",
    totalResidue: "low",
    fiberTotalApproxG: 1,
    fiberInsolubleLevel: "low",
    fiberSolubleLevel: "low",
    gasProducing: "no",
    dryTexture: "no",
    irritantLoad: "none",
    highFatRisk: "none",
    lactoseRisk: "none",
  },

  // ── vegetables ──
  {
    canonical: "mashed potato",
    zone: 1,
    subzone: "1B",
    category: "carbohydrate",
    subcategory: "vegetable",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "vegetables",
    lineOrder: 2,
    examples: [
      "mashed potato",
      "mashed potatoes",
      "mash",
      "mash potato",
      "pureed potato",
      "potato mash",
      "smooth mash",
      "creamed potato",
      "potato puree",
      "potato purée",
    ],
    notes:
      "Peeled, well-cooked, mashed smooth. Small amount of butter or milk is fine.",
  },
  {
    canonical: "mashed root vegetable",
    zone: 1,
    subzone: "1B",
    category: "carbohydrate",
    subcategory: "vegetable",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "vegetables",
    lineOrder: 3,
    examples: [
      "pureed carrot",
      "mashed carrot",
      "carrot puree",
      "pureed parsnip",
      "pureed swede",
      "pureed pumpkin",
      "mashed butternut squash",
      "cooked carrot",
      "soft carrot",
      "baby carrot cooked",
      "well cooked carrot",
      "mashed pumpkin",
      "pumpkin puree",
      "calabaza",
      "pureed butternut squash",
      "acorn squash",
      "winter squash",
      "squash puree",
    ],
    notes:
      "Peeled, well-cooked, pureed or mashed. Replaces separate cooked carrot and cooked pumpkin entries for Zone 1B.",
  },

  // ── fruit ──
  {
    canonical: "ripe banana",
    zone: 1,
    subzone: "1B",
    category: "carbohydrate",
    subcategory: "fruit",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "fruit",
    lineOrder: 1,
    examples: [
      "banana",
      "bananas",
      "ripe banana",
      "small banana",
      "sm banana",
      "mashed banana",
      "soft banana",
      "very ripe banana",
    ],
    notes:
      "Must be fully ripe — green or underripe bananas are harder to digest and can increase output.",
  },
  {
    canonical: "stewed apple",
    zone: 1,
    subzone: "1B",
    category: "carbohydrate",
    subcategory: "fruit",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "fruit",
    lineOrder: 2,
    examples: [
      "stewed apple",
      "cooked apple",
      "baked apple",
      "apple sauce",
      "applesauce",
      "apple puree",
      "pureed apple",
      "stewed apple without skin",
      "peeled cooked apple",
    ],
    notes:
      "Peeled, stewed or cooked until soft. No raw apple (high fibre, firm texture).",
  },
  {
    canonical: "canned pear",
    zone: 1,
    subzone: "1B",
    category: "carbohydrate",
    subcategory: "fruit",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "fruit",
    lineOrder: 3,
    examples: [
      "canned pear",
      "tinned pear",
      "pear in juice",
      "pear in syrup",
      "canned fruit",
      "tinned fruit",
      "peeled cooked pear",
      "stewed pear",
      "poached pear",
      "poached pears",
    ],
    notes:
      "Canned/tinned in juice, or freshly stewed, peeled. Very low residue.",
  },
  {
    canonical: "canned peach",
    zone: 1,
    subzone: "1B",
    category: "carbohydrate",
    subcategory: "fruit",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "fruit",
    lineOrder: 4,
    examples: [
      "canned peach",
      "tinned peach",
      "peach in juice",
      "peach in syrup",
      "canned apricot",
      "tinned apricot",
      "canned nectarine",
    ],
    notes:
      "Canned/tinned in juice. Soft, very low residue. Zone changed from 2 to 1B.",
  },

  // ── oils ──
  {
    canonical: "olive oil",
    zone: 1,
    subzone: "1B",
    category: "fat",
    subcategory: "oil",
    macros: ["fat"],
    group: "fats",
    line: "oils",
    lineOrder: 1,
    examples: [
      "olive oil",
      "extra virgin olive oil",
      "olive oil extra virgin",
      "drizzle of olive oil",
      "teaspoon of olive oil",
      "tablespoon of olive oil",
    ],
    notes: "Small amounts in cooking. Monounsaturated fat.",
  },

  // ── sauces_condiments ──
  {
    canonical: "salt",
    zone: 1,
    subzone: "1B",
    category: "condiment",
    subcategory: "seasoning",
    macros: [],
    group: "seasoning",
    line: "sauces_condiments",
    lineOrder: 1,
    examples: [
      "salt",
      "sea salt",
      "table salt",
      "rock salt",
      "a pinch of salt",
      "seasoned with salt",
    ],
  },

  // ── eggs_dairy (additional) ──
  {
    canonical: "smooth mousse",
    zone: 1,
    subzone: "1B",
    category: "protein",
    subcategory: "dessert",
    macros: ["protein", "fat"],
    group: "protein",
    line: "eggs_dairy",
    lineOrder: 12,
    examples: [
      "mousse",
      "chocolate mousse",
      "vanilla mousse",
      "mousse pot",
      "whipped dessert",
      "aero mousse",
      "cadbury mousse",
      "gu mousse",
    ],
    notes:
      "Smooth, aerated desserts. Bridge between liquid gelatin (1A) and custard (1B). Must be smooth — no chunks, nuts, or fruit pieces.",
  },

  // ── grains (additional) ──
  {
    canonical: "semolina",
    zone: 1,
    subzone: "1B",
    category: "carbohydrate",
    subcategory: "grain",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "grains",
    lineOrder: 19,
    examples: [
      "semolina",
      "semolina pudding",
      "cream of wheat",
      "semolina porridge",
      "semolina dessert",
      "farina",
    ],
    notes:
      "Refined wheat product, very gentle. Common in UK/European post-surgical recovery diets. Similar to porridge but from wheat rather than oats.",
  },

  // ── vegetables (additional) ──
  {
    canonical: "mashed sweet potato",
    zone: 1,
    subzone: "1B",
    category: "carbohydrate",
    subcategory: "root_vegetable",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "vegetables",
    lineOrder: 26,
    examples: [
      "mashed sweet potato",
      "sweet potato mash",
      "pureed sweet potato",
      "sweet potato puree",
      "whipped sweet potato",
    ],
    notes:
      "Peeled and mashed/pureed sweet potato. As gentle as regular mashed potato. Higher beta-carotene. No skin.",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// ZONE 2 — Expanded but still defensive diet
// ─────────────────────────────────────────────────────────────────────────────

const ZONE_2: ReadonlyArray<FoodRegistryEntry> = [
  // ── meat_fish ──
  {
    canonical: "grilled white meat",
    zone: 2,
    category: "protein",
    subcategory: "meat",
    macros: ["protein", "fat"],
    group: "protein",
    line: "meat_fish",
    lineOrder: 4,
    examples: [
      "chicken",
      "grilled chicken",
      "baked chicken",
      "roasted chicken",
      "grilled turkey",
      "baked turkey",
      "grilled chicken breast",
      "grilled chicken fillet",
      "baked chicken breast",
      "roasted chicken breast",
      "roast chicken breast",
      "roast chicken",
      "air fried chicken",
      "oven chicken",
      "chicken bake",
      "turkey",
      "roast turkey",
      "sliced turkey",
      "turkey slices",
      "deli turkey",
      "cold turkey",
      "turkey breast",
      "roasted turkey",
    ],
    notes:
      "Dry-heat chicken or turkey (grilled, baked, roasted, air-fried) with little or no added fat. No skin. Distinct from Zone 1 boiled white meat (moist-heat).",
  },
  {
    canonical: "cooked fish",
    zone: 2,
    category: "protein",
    subcategory: "fish",
    macros: ["protein", "fat"],
    group: "protein",
    line: "meat_fish",
    lineOrder: 5,
    examples: [
      "baked fish",
      "grilled fish",
      "baked cod",
      "grilled haddock",
      "baked white fish",
      "grilled white fish",
      "grilled cod",
      "fish with butter",
      "baked tilapia",
      "baked sole",
      "fish in foil",
    ],
    notes:
      "White fish with small amount of butter or oil. Distinct from Zone 1 boiled fish.",
  },
  {
    canonical: "lean minced meat",
    zone: 2,
    category: "protein",
    subcategory: "meat",
    macros: ["protein", "fat"],
    group: "protein",
    line: "meat_fish",
    lineOrder: 6,
    examples: [
      "lean mince",
      "lean minced beef",
      "lean minced turkey",
      "minced beef",
      "minced turkey",
      "lean ground beef",
      "ground turkey",
      "lean meatballs",
      "minced meat patty",
    ],
    notes:
      "Finely minced, well-cooked meat without gristle or heavy browning. Distinct from chunkier red meat cuts.",
    osmoticEffect: "none",
    totalResidue: "low_moderate",
    fiberTotalApproxG: 0,
    fiberInsolubleLevel: "low",
    fiberSolubleLevel: "low",
    gasProducing: "possible",
    dryTexture: "low",
    irritantLoad: "low",
    highFatRisk: "low_moderate",
    lactoseRisk: "none",
  },
  {
    canonical: "red meat",
    zone: 2,
    category: "protein",
    subcategory: "meat",
    macros: ["protein", "fat"],
    group: "protein",
    line: "meat_fish",
    lineOrder: 7,
    examples: [
      "beef",
      "lamb",
      "pork",
      "pork tenderloin",
      "roast beef",
      "lean pork",
      "pork fillet",
      "pork loin",
      "roast pork",
      "baked pork",
      "grilled pork",
    ],
    notes:
      "Whole-cut or chunked red meat, well cooked with excess fat drained off. No spicy seasoning.",
  },
  {
    canonical: "oily fish",
    zone: 2,
    category: "protein",
    subcategory: "fish",
    macros: ["protein", "fat"],
    group: "protein",
    line: "meat_fish",
    lineOrder: 8,
    examples: [
      "salmon",
      "tuna",
      "mackerel",
      "sardines",
      "baked salmon",
      "grilled salmon",
      "poached salmon",
      "salmon fillet",
      "steamed salmon",
      "salmon with lemon",
      "fresh salmon",
      "canned tuna",
      "tinned tuna",
      "tuna in water",
      "tuna in oil",
      "tuna in brine",
      "tuna flakes",
    ],
    notes:
      "Oily fish — healthy unsaturated fat. Small portions. Replaces separate salmon and tuna entries.",
  },
  {
    canonical: "ham",
    zone: 2,
    category: "protein",
    subcategory: "meat",
    macros: ["protein", "fat"],
    group: "protein",
    line: "meat_fish",
    lineOrder: 9,
    examples: [
      "roast ham",
      "ham",
      "thick ham",
      "thick sliced ham",
      "sliced ham",
      "carved ham",
      "ham off the bone",
      "deli roast ham",
      "roasted ham slices",
      "cooked roast ham",
      "cooked ham",
      "boiled ham",
      "lean ham",
      "ham slice",
      "honey ham",
    ],
    notes:
      "Thick-cut cooked ham or ham off the bone. Less processed than sausage-style meats, but still saltier than chicken or turkey.",
  },

  // ── eggs_dairy ──
  {
    canonical: "buttered scrambled eggs",
    zone: 2,
    category: "protein",
    subcategory: "egg",
    macros: ["protein", "fat"],
    group: "protein",
    line: "eggs_dairy",
    lineOrder: 7,
    examples: [
      "buttered scrambled eggs",
      "scrambled eggs with butter",
      "scrambled eggs in butter",
      "creamy scrambled eggs",
    ],
    notes:
      "Scrambled eggs cooked with a small amount of butter. More satiating than plain scrambled eggs. Tolerated by most when Zone 1 eggs are established.",
  },
  {
    canonical: "flavoured yogurt",
    zone: 2,
    category: "dairy",
    subcategory: "milk_yogurt",
    macros: ["protein", "carbohydrate"],
    group: "protein",
    line: "eggs_dairy",
    lineOrder: 8,
    examples: [
      "flavoured yogurt",
      "flavored yogurt",
      "fruit yogurt",
      "strawberry yogurt",
      "strawberry flavoured greek yogurt",
      "strawberry flavored greek yogurt",
      "greek strawberry yogurt",
      "vanilla yogurt",
      "peach yogurt",
      "smooth fruit yogurt",
    ],
    notes:
      "Smooth fruit-flavoured yogurt without fruit pieces or seeds. More sugar than plain yogurt — trial when plain yogurt is well tolerated.",
  },
  {
    canonical: "milk pudding",
    zone: 2,
    category: "dairy",
    subcategory: "dessert",
    macros: ["carbohydrate", "fat", "protein"],
    group: "protein",
    line: "eggs_dairy",
    lineOrder: 9,
    examples: [
      "milk pudding",
      "panna cotta",
      "blancmange",
      "junket",
      "set milk pudding",
      "vanilla panna cotta",
      "plain panna cotta",
    ],
    notes:
      "Set milk-based desserts without added fruit pieces or nuts. Gentle protein and fat source.",
  },
  {
    canonical: "kefir",
    zone: 2,
    category: "dairy",
    subcategory: "milk_yogurt",
    macros: ["protein", "fat"],
    group: "protein",
    line: "eggs_dairy",
    lineOrder: 10,
    examples: ["kefir", "milk kefir", "probiotic kefir", "kefir yogurt"],
    notes:
      "Fermented dairy. Unpredictable post-anastomosis — some tolerate well, others experience increased output. Trial cautiously from a stable Zone 2 baseline.",
  },
  {
    canonical: "fried egg",
    zone: 2,
    category: "protein",
    subcategory: "egg",
    macros: ["protein", "fat"],
    group: "protein",
    line: "eggs_dairy",
    lineOrder: 11,
    examples: [
      "fried egg",
      "fried eggs",
      "pan fried egg",
      "sunny side up",
      "over easy",
      "over hard",
      "eggs fried in butter",
      "butter fried egg",
      "egg in butter",
    ],
    notes:
      "Egg cooked in added fat (butter, oil). Moved from Zone 3 to Zone 2 — buttered scrambled eggs are already Zone 2, so fried egg is consistent.",
  },

  // ── vegetable_protein ──
  {
    canonical: "tofu",
    zone: 2,
    category: "protein",
    subcategory: "legume",
    macros: ["protein", "fat"],
    group: "protein",
    line: "vegetable_protein",
    lineOrder: 1,
    examples: [
      "tofu",
      "plain tofu",
      "silken tofu",
      "soft tofu",
      "firm tofu",
      "steamed tofu",
    ],
    notes:
      "Plain tofu only. Soft soy protein without the skins and fibre load of whole legumes. No fried, smoked, or spicy tofu dishes.",
  },

  // ── grains ──
  {
    canonical: "crispy cracker",
    zone: 2,
    category: "carbohydrate",
    subcategory: "grain",
    macros: ["carbohydrate", "fat"],
    group: "carbs",
    line: "grains",
    lineOrder: 13,
    examples: [
      "crispy cracker",
      "quelitas",
      "quelitas snacks",
      "quelitas mediterranean snacks",
      "quelitos",
      "kelitos",
      "chelitas",
      "tuc",
      "tuc plain",
      "tuck cracker",
      "tuc crackers",
      "tuck crackers",
      "ritz",
      "ritz original",
      "ritz crackers",
      "water biscuit",
      "water biscuits",
      "cream cracker",
      "cream crackers",
      "saltines",
      "cracker",
      "crackers",
      "breadstick",
      "breadsticks",
      "bread snacks",
      "baked bread snacks",
      "toasted bread snacks",
      "grissini",
      "mini grissini",
      "bayonetas",
      "tostada",
      "tostadas",
    ],
    notes:
      "Thin, crispy refined crackers and breadsticks. Low fibre, moderately fatty, and notably dry compared with soaked Zone 1 crackers.",
    osmoticEffect: "low",
    totalResidue: "low",
    fiberTotalApproxG: 1.5,
    fiberInsolubleLevel: "low_moderate",
    fiberSolubleLevel: "low",
    gasProducing: "possible",
    dryTexture: "yes",
    irritantLoad: "low",
    highFatRisk: "low",
    lactoseRisk: "none",
  },
  {
    canonical: "plain biscuit",
    zone: 2,
    category: "carbohydrate",
    subcategory: "processed",
    macros: ["carbohydrate", "fat"],
    group: "carbs",
    line: "grains",
    lineOrder: 14,
    examples: [
      "plain biscuit",
      "plain biscuits",
      "biscuit",
      "biscuits",
      "digestive",
      "digestive biscuit",
      "rich tea",
      "rich tea biscuit",
      "shortbread",
      "maria biscuit",
      "maria biscuits",
      "maria biscuits (plain)",
      "maria",
    ],
    notes:
      "Plain, low-fibre tea biscuits such as Maria biscuits. Drier and less sugary than Biscoff-style biscuits, but still more processed than toast or white bread.",
    osmoticEffect: "low_moderate",
    totalResidue: "low",
    fiberTotalApproxG: 1,
    fiberInsolubleLevel: "low",
    fiberSolubleLevel: "low",
    gasProducing: "possible",
    dryTexture: "yes",
    irritantLoad: "low",
    highFatRisk: "low_moderate",
    lactoseRisk: "low",
  },
  {
    canonical: "low-fiber cereal",
    zone: 2,
    category: "carbohydrate",
    subcategory: "grain",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "grains",
    lineOrder: 15,
    examples: [
      "low fiber cereal",
      "cornflakes",
      "rice krispies",
      "puffed rice cereal",
      "cream of rice cereal",
      "sugar puff",
      "sugar puffs",
    ],
    notes:
      "Refined breakfast cereals without nuts, seeds, dried fruit, or bran. Use milk cautiously if lactose is still unsettled.",
    osmoticEffect: "low_moderate",
    totalResidue: "low",
    fiberTotalApproxG: 2,
    fiberInsolubleLevel: "low",
    fiberSolubleLevel: "low_moderate",
    gasProducing: "possible",
    dryTexture: "no",
    irritantLoad: "none",
    highFatRisk: "none",
    lactoseRisk: "none",
  },
  {
    canonical: "basic savoury snack",
    zone: 2,
    category: "carbohydrate",
    subcategory: "processed",
    macros: ["carbohydrate", "fat"],
    group: "carbs",
    line: "grains",
    lineOrder: 16,
    examples: [
      "plain crisps",
      "plain potato crisps",
      "plain salted lays",
      "salted crisps",
      "mini pretzels",
      "soft pretzel",
      "plain corn puffs",
      "cheese puffs",
      "cheese crackers",
      "baked cheese snacks",
      "wotsits",
      "cheetos",
      "cheese straws",
    ],
    notes:
      "Plain savoury snacks with low fibre but a dry, bulky texture. Start with small portions and pair with fluids.",
    osmoticEffect: "low",
    totalResidue: "low",
    fiberTotalApproxG: 1.5,
    fiberInsolubleLevel: "low_moderate",
    fiberSolubleLevel: "low",
    gasProducing: "possible",
    dryTexture: "yes",
    irritantLoad: "low",
    highFatRisk: "low_moderate",
    lactoseRisk: "none",
  },
  {
    canonical: "low-fiber sweet snack",
    zone: 2,
    category: "carbohydrate",
    subcategory: "sugar",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "grains",
    lineOrder: 17,
    examples: [
      "gummy bears",
      "fruit jelly sweets",
      "fruit snack gummies",
      "marshmallows",
      "jelly babies",
      "wine gums",
      "haribo",
      "fruit pastilles",
      "meringue",
      "turkish delight",
    ],
    notes:
      "Low-residue sweets with almost no fibre. The main risk is osmotic looseness from concentrated sugar.",
    osmoticEffect: "moderate_high",
    totalResidue: "very_low",
    fiberTotalApproxG: 0,
    fiberInsolubleLevel: "low",
    fiberSolubleLevel: "low",
    gasProducing: "possible",
    dryTexture: "no",
    irritantLoad: "none",
    highFatRisk: "none",
    lactoseRisk: "none",
  },
  {
    canonical: "simple chocolate snack",
    zone: 2,
    category: "carbohydrate",
    subcategory: "sugar",
    macros: ["carbohydrate", "fat"],
    group: "carbs",
    line: "grains",
    lineOrder: 18,
    examples: [
      "plain milk chocolate bar",
      "plain chocolate biscuit",
      "chocolate coated plain biscuit",
      "chocolate bar",
      "milk chocolate bar",
      "small chocolate bar",
      "kit kat",
    ],
    notes:
      "Small portions of plain chocolate or simple chocolate biscuits with no nuts, caramel, or dried fruit.",
    osmoticEffect: "moderate",
    totalResidue: "low",
    fiberTotalApproxG: 1.5,
    fiberInsolubleLevel: "low",
    fiberSolubleLevel: "low",
    gasProducing: "possible",
    dryTexture: "yes",
    irritantLoad: "low",
    highFatRisk: "moderate",
    lactoseRisk: "low",
  },

  // ── vegetables ──
  {
    canonical: "boiled carrot",
    zone: 2,
    category: "carbohydrate",
    subcategory: "vegetable",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "vegetables",
    lineOrder: 4,
    examples: [
      "boiled carrot",
      "steamed carrot",
      "carrot sticks cooked",
      "soft cooked carrot",
    ],
    notes:
      "Boiled, not pureed. Distinct from Zone 1B mashed root vegetable (pureed).",
  },
  {
    canonical: "baked potato",
    zone: 2,
    category: "carbohydrate",
    subcategory: "vegetable",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "vegetables",
    lineOrder: 5,
    examples: [
      "baked potato",
      "jacket potato",
      "oven potato",
      "baked potato flesh",
      "jacket potato without skin",
    ],
    notes: "Flesh only — no skin (Zone 3). Skin holds significant fibre.",
  },
  {
    canonical: "sweet potato",
    zone: 2,
    category: "carbohydrate",
    subcategory: "vegetable",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "vegetables",
    lineOrder: 6,
    examples: [
      "sweet potato",
      "baked sweet potato",
      "boiled sweet potato",
      "yam",
    ],
    notes:
      "Peeled, well-cooked. No skin. Mashed/pureed sweet potato has its own Zone 1B entry.",
  },
  {
    canonical: "cooked pumpkin",
    zone: 2,
    category: "carbohydrate",
    subcategory: "vegetable",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "vegetables",
    lineOrder: 7,
    examples: [
      "baked pumpkin",
      "roasted pumpkin",
      "baked butternut squash",
      "roasted butternut squash",
      "steamed pumpkin",
      "boiled pumpkin",
      "steamed butternut squash",
    ],
    notes:
      "Boiled/baked pumpkin (not pureed — pureed is under mashed root vegetable in Zone 1B).",
  },
  {
    canonical: "courgette",
    zone: 2,
    category: "carbohydrate",
    subcategory: "vegetable",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "vegetables",
    lineOrder: 8,
    examples: [
      "courgette",
      "zucchini",
      "cooked courgette",
      "steamed courgette",
      "boiled courgette",
      "peeled courgette",
      "courgette without skin",
    ],
    notes:
      "Peeled, well-cooked. Skin can be included if very well cooked and soft.",
  },
  {
    canonical: "peeled cucumber",
    zone: 2,
    category: "carbohydrate",
    subcategory: "vegetable",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "vegetables",
    lineOrder: 9,
    examples: [
      "peeled cucumber",
      "cucumber without skin",
      "deseeded cucumber",
      "cucumber flesh",
    ],
    notes:
      "Peeled and de-seeded only. Cucumber with skin stays in Zone 3. Exception to the no-raw-vegetables guidance: peeled, de-seeded cucumber is >95% water with near-zero fiber.",
  },
  {
    canonical: "cooked spinach",
    zone: 2,
    category: "carbohydrate",
    subcategory: "vegetable",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "vegetables",
    lineOrder: 11,
    examples: [
      "spinach",
      "cooked spinach",
      "steamed spinach",
      "boiled spinach",
      "wilted spinach",
      "baby spinach cooked",
    ],
    notes: "Well-wilted, no raw spinach in Zones 1–2.",
  },
  {
    canonical: "cooked tomato",
    zone: 2,
    category: "carbohydrate",
    subcategory: "vegetable",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "vegetables",
    lineOrder: 12,
    examples: [
      "cooked tomato",
      "roasted tomato",
      "baked tomato",
      "peeled tomato",
      "de-seeded tomato",
      "canned tomato",
      "tinned tomato",
      "passata",
      "strained tomato",
    ],
    notes:
      "Peeled and de-seeded, or canned/passata. No raw tomato with skin or seeds.",
  },
  {
    canonical: "cooked bell pepper",
    zone: 2,
    category: "carbohydrate",
    subcategory: "vegetable",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "vegetables",
    lineOrder: 13,
    examples: [
      "cooked bell pepper",
      "roasted pepper",
      "grilled pepper",
      "cooked capsicum",
      "roasted capsicum",
      "peeled pepper",
      "pepper in sauce",
    ],
    notes: "Well-cooked or roasted, peeled, no seeds. Not raw (Zone 3).",
  },
  {
    canonical: "swede",
    zone: 2,
    category: "carbohydrate",
    subcategory: "vegetable",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "vegetables",
    lineOrder: 14,
    examples: [
      "swede",
      "rutabaga",
      "cooked swede",
      "boiled swede",
      "mashed swede",
      "turnip",
      "cooked turnip",
    ],
    notes: "Peeled, well-cooked.",
  },
  {
    canonical: "parsnip",
    zone: 2,
    category: "carbohydrate",
    subcategory: "vegetable",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "vegetables",
    // lineOrder 10: parsnip is well-tolerated early in vegetable reintroduction
    lineOrder: 10,
    examples: [
      "parsnip",
      "cooked parsnip",
      "boiled parsnip",
      "roasted parsnip",
      "mashed parsnip",
    ],
    notes: "Peeled, well-cooked.",
  },
  {
    canonical: "cauliflower",
    zone: 2,
    category: "carbohydrate",
    subcategory: "vegetable",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "vegetables",
    lineOrder: 15,
    examples: [
      "cauliflower",
      "coliflower",
      "cooked cauliflower",
      "steamed cauliflower",
      "boiled cauliflower",
      "cauliflower florets",
      "cauliflower mash",
      "mashed cauliflower",
    ],
    notes:
      "Florets only, no tough stalks, well-cooked. End of Zone 2 — gassy but tolerable.",
    gasProducing: "yes",
  },

  // ── fruit ──
  {
    canonical: "melon",
    zone: 2,
    category: "carbohydrate",
    subcategory: "fruit",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "fruit",
    lineOrder: 5,
    examples: [
      "melon",
      "honeydew melon",
      "cantaloupe",
      "rockmelon",
      "watermelon",
      "ripe melon",
    ],
    notes: "Ripe, no skin. Low fibre, very high water content.",
  },
  {
    canonical: "ripe mango",
    zone: 2,
    category: "carbohydrate",
    subcategory: "fruit",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "fruit",
    lineOrder: 6,
    examples: [
      "mango",
      "ripe mango",
      "fresh mango",
      "mango flesh",
      "sliced mango",
    ],
    notes:
      "Ripe, no skin. Good source of soluble fibre — tolerated well in Zone 2.",
  },
  {
    canonical: "peeled apple",
    zone: 2,
    category: "carbohydrate",
    subcategory: "fruit",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "fruit",
    lineOrder: 7,
    examples: [
      "peeled apple",
      "apple without skin",
      "skinless apple",
      "apple peeled",
    ],
    notes:
      "Peeled raw apple — skin removed reduces insoluble fibre. Easier to digest than raw apple with skin (Zone 3), harder than stewed apple (Zone 1).",
  },

  // ── oils ──
  {
    canonical: "vegetable oil",
    zone: 2,
    category: "fat",
    subcategory: "oil",
    macros: ["fat"],
    group: "fats",
    line: "oils",
    lineOrder: 2,
    examples: [
      "vegetable oil",
      "sunflower oil",
      "rapeseed oil",
      "canola oil",
      "cooking oil",
      "neutral oil",
    ],
    notes:
      "For cooking. Small amounts only. Coconut oil has its own Zone 3 entry under coconut.",
  },

  // ── dairy_fats ──
  {
    canonical: "butter",
    zone: 2,
    category: "fat",
    subcategory: "butter_cream",
    macros: ["fat"],
    group: "fats",
    line: "dairy_fats",
    lineOrder: 1,
    examples: [
      "butter",
      "a little butter",
      "small amount of butter",
      "teaspoon of butter",
      "butter on toast",
      "margarine",
      "flora spreadable",
    ],
    notes:
      "Small amounts as spread or in cooking. Saturated fat — use sparingly. Zone changed from 1B to 2.",
  },
  {
    canonical: "cream cheese",
    zone: 2,
    category: "dairy",
    subcategory: "cheese",
    macros: ["fat", "protein"],
    group: "fats",
    line: "dairy_fats",
    lineOrder: 2,
    examples: [
      "cream cheese",
      "soft cheese",
      "Philadelphia",
      "soft white cheese",
      "ricotta",
      "quark",
      "lactose free cream cheese",
      "spreadable cheese",
      "lactose-free cream cheese",
      "dairy free cream cheese",
    ],
    notes:
      "Soft, smooth dairy. Ricotta and quark included — lower fat than cream cheese.",
  },
  {
    canonical: "hard cheese",
    zone: 2,
    category: "dairy",
    subcategory: "cheese",
    macros: ["protein", "fat"],
    group: "fats",
    line: "dairy_fats",
    lineOrder: 3,
    examples: [
      "four cheeses",
      "cheddar",
      "cheddar cheese",
      "hard cheese",
      "edam",
      "gouda",
      "mild cheddar",
      "mature cheddar",
      "grated cheese",
      "cheese slice",
    ],
    notes:
      "Small amounts. Hard cheeses are dense in saturated fat — use as a topping, not a main dish.",
  },
  {
    canonical: "cream",
    zone: 2,
    category: "dairy",
    subcategory: "butter_cream",
    macros: ["fat"],
    group: "fats",
    line: "dairy_fats",
    lineOrder: 5,
    examples: [
      "cream",
      "single cream",
      "light cream",
      "cooking cream",
      "cream in sauce",
      "splash of cream",
      "crème fraîche",
      "sour cream",
    ],
    notes:
      "Small amounts in cooking only. High fat — too much can worsen loose stools.",
  },
  {
    canonical: "plain ice cream",
    zone: 2,
    category: "dairy",
    subcategory: "dessert",
    macros: ["carbohydrate", "fat"],
    group: "fats",
    line: "dairy_fats",
    lineOrder: 6,
    examples: [
      "ice cream",
      "plain ice cream",
      "vanilla ice cream",
      "dairy ice cream",
      "gelato",
    ],
    notes:
      "Plain vanilla or similar. Small portion. High fat and sugar — limit to occasional small serving.",
  },

  // ── nuts_seeds ──
  {
    canonical: "avocado",
    zone: 2,
    category: "fat",
    subcategory: "fruit",
    macros: ["fat", "carbohydrate"],
    group: "fats",
    line: "nuts_seeds",
    lineOrder: 1,
    examples: [
      "avocado",
      "ripe avocado",
      "avocado flesh",
      "mashed avocado",
      "smashed avocado",
    ],
    notes:
      "Primarily healthy monounsaturated fat. Small portions — high fat content can increase output if eaten in large amounts. Moved from fruit to nuts_seeds.",
  },
  {
    canonical: "smooth nut butter",
    zone: 2,
    category: "fat",
    subcategory: "nut_seed",
    macros: ["fat", "protein"],
    group: "fats",
    line: "nuts_seeds",
    lineOrder: 2,
    examples: [
      "nut butter",
      "peanut butter",
      "smooth peanut butter",
      "almond butter",
      "smooth almond butter",
      "cashew butter",
      "hazelnut butter",
      "smooth nut butter",
    ],
    notes:
      "Smooth nut butters only — no crunchy. No chunks or pieces. Trial cautiously from a stable Zone 2 baseline.",
  },

  // ── sauces_condiments ──
  {
    canonical: "soy sauce",
    zone: 2,
    category: "condiment",
    subcategory: "sauce",
    macros: [],
    group: "seasoning",
    line: "sauces_condiments",
    lineOrder: 2,
    examples: [
      "soy sauce",
      "soya sauce",
      "tamari",
      "light soy sauce",
      "low sodium soy sauce",
    ],
    notes: "Small amounts. Tamari is gluten-free equivalent.",
  },
  {
    canonical: "smooth tomato sauce",
    zone: 2,
    category: "condiment",
    subcategory: "sauce",
    macros: ["carbohydrate"],
    group: "seasoning",
    line: "sauces_condiments",
    lineOrder: 3,
    examples: [
      "smooth tomato sauce",
      "tomato sauce",
      "passata sauce",
      "marinara sauce",
      "plain tomato sauce",
      "homemade tomato sauce",
      "ketchup",
      "tomato ketchup",
    ],
    notes:
      "Smooth only — no chunks, seeds, or garlic/onion. Ketchup in small amounts.",
  },
  {
    canonical: "mild mustard",
    zone: 2,
    category: "condiment",
    subcategory: "sauce",
    macros: [],
    group: "seasoning",
    line: "sauces_condiments",
    lineOrder: 4,
    examples: [
      "mustard",
      "mild mustard",
      "smooth mustard",
      "dijon mustard",
      "french mustard",
      "english mustard",
    ],
    notes:
      "Small amounts as a condiment. Wholegrain mustard has seeds — borderline, use sparingly.",
  },
  {
    canonical: "white sauce",
    zone: 2,
    category: "condiment",
    subcategory: "sauce",
    macros: ["carbohydrate", "fat"],
    group: "seasoning",
    line: "sauces_condiments",
    lineOrder: 5,
    examples: [
      "white sauce",
      "béchamel",
      "bechamel sauce",
      "cheese sauce",
      "cream sauce",
      "mild cream sauce",
      "béchamel sauce",
    ],
    notes: "Milk-based sauce thickened with flour. No garlic or onion base.",
  },
  {
    canonical: "gravy",
    zone: 2,
    category: "condiment",
    subcategory: "sauce",
    macros: ["carbohydrate", "fat"],
    group: "seasoning",
    line: "sauces_condiments",
    lineOrder: 6,
    examples: [
      "gravy",
      "plain gravy",
      "brown gravy",
      "chicken gravy",
      "beef gravy",
      "smooth gravy",
    ],
    notes:
      "Smooth gravy only. Best treated like a flour-thickened sauce, not a broth. No onion pieces or peppercorn-heavy gravy.",
  },
  {
    canonical: "honey",
    zone: 2,
    category: "condiment",
    subcategory: "sugar",
    macros: ["carbohydrate"],
    group: "seasoning",
    line: "sauces_condiments",
    lineOrder: 7,
    examples: [
      "honey",
      "runny honey",
      "clear honey",
      "honey drizzle",
      "teaspoon of honey",
    ],
    notes:
      "Small amounts as a smooth sweetener or spread. Concentrated sugar load, so treat as a condiment not a free food.",
  },
  {
    canonical: "jam",
    zone: 2,
    category: "condiment",
    subcategory: "sugar",
    macros: ["carbohydrate"],
    group: "seasoning",
    line: "sauces_condiments",
    lineOrder: 8,
    examples: [
      "jam",
      "smooth jam",
      "seedless jam",
      "fruit jam",
      "strawberry jam",
      "raspberry jam",
      "grape jelly",
      "crema de membrillo",
      "pico's crema de membrillo",
      "quince paste",
      "quince jelly",
    ],
    notes:
      "Smooth or seedless fruit spread only. Keep this separate from gelatin dessert and from chunky preserves with skins or seeds.",
  },

  // ── herbs_spices ──
  {
    canonical: "mild herb",
    zone: 2,
    category: "condiment",
    subcategory: "herb",
    macros: [],
    group: "seasoning",
    line: "herbs_spices",
    lineOrder: 2,
    examples: [
      "thyme",
      "rosemary",
      "sage",
      "basil",
      "oregano",
      "tarragon",
      "dried parsley",
      "dried chives",
      "mixed herbs",
      "herbes de provence",
      "bay leaf",
      "fresh thyme",
      "fresh rosemary",
      "fresh basil",
      "fresh sage",
    ],
    notes:
      "Dried or fresh culinary herbs in moderate cooking amounts. More robust than Zone 1 garnish herbs. Not the same as spicy or hot seasonings.",
  },
  {
    canonical: "mild spice",
    zone: 2,
    category: "condiment",
    subcategory: "spice",
    macros: [],
    group: "seasoning",
    line: "herbs_spices",
    lineOrder: 3,
    examples: [
      "cinnamon",
      "nutmeg",
      "vanilla",
      "vanilla extract",
      "mild paprika",
      "sweet paprika",
      "turmeric",
      "ground ginger",
      "cardamom",
      "allspice",
      "mixed spice",
    ],
    notes:
      "Mild, non-hot ground spices in small cooking amounts. Ground ginger and turmeric are generally well-tolerated. Not hot/chili spices.",
  },

  // ── grains (additional) ──
  {
    canonical: "plain pancake",
    zone: 2,
    category: "carbohydrate",
    subcategory: "grain",
    macros: ["carbohydrate", "protein", "fat"],
    group: "carbs",
    line: "grains",
    lineOrder: 20,
    examples: [
      "pancake",
      "crepe",
      "plain pancake",
      "plain crepe",
      "scotch pancake",
      "drop scone",
      "pikelets",
      "american pancake",
      "thin pancake",
    ],
    notes:
      "Plain pancake/crepe made from white flour, egg, milk. Essentially cooked batter — digestively similar to white bread + egg. No rich fillings.",
  },
  {
    canonical: "bagel",
    zone: 2,
    category: "carbohydrate",
    subcategory: "grain",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "grains",
    lineOrder: 28,
    examples: ["bagel", "toasted bagel", "plain bagel", "white bagel"],
    notes:
      "Denser than soft white bread. Requires more chewing, which aids digestion. Plain/white only — seeded or wholegrain bagels are Zone 3.",
  },

  // ── vegetables (additional) ──
  {
    canonical: "boiled potato",
    zone: 2,
    category: "carbohydrate",
    subcategory: "root_vegetable",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "vegetables",
    lineOrder: 27,
    examples: [
      "boiled potatoes",
      "boiled potato",
      "new potatoes",
      "boiled new potatoes",
      "boiled white potato",
      "plain potatoes",
      "steamed potatoes",
      "peeled potatoes",
    ],
    notes:
      "Peeled, boiled/steamed potatoes. Softer than baked, not mashed. Bridge between mashed (1B) and baked (Zone 2).",
  },
  {
    canonical: "cooked beetroot",
    zone: 2,
    category: "carbohydrate",
    subcategory: "root_vegetable",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "vegetables",
    lineOrder: 28,
    examples: [
      "beetroot",
      "cooked beetroot",
      "boiled beetroot",
      "roasted beetroot",
      "pickled beetroot",
      "beet",
      "beets",
    ],
    notes:
      "Peeled, well-cooked beetroot. Low fiber when peeled and boiled. Common in NHS low-residue guidance. May cause red/purple stool discoloration — this is harmless.",
  },
  {
    canonical: "plant milk",
    zone: 2,
    category: "beverage",
    subcategory: "dairy_alternative",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "vegetables",
    lineOrder: 29,
    examples: [
      "oat milk",
      "almond milk",
      "soy milk",
      "plant milk",
      "coconut milk",
      "rice milk",
      "oat drink",
      "soya milk",
      "dairy-free milk alternative",
      "lactose-free plant milk",
    ],
    notes:
      "Dairy alternatives. Generally well-tolerated for patients avoiding lactose. Oat milk and rice milk are gentlest. Soy milk has moderate protein. Coconut milk (carton, not canned) is low-residue.",
  },

  // ── fruit (additional) ──
  {
    canonical: "grapes",
    zone: 2,
    category: "carbohydrate",
    subcategory: "fruit",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "fruit",
    lineOrder: 17,
    examples: [
      "grapes",
      "green grapes",
      "red grapes",
      "black grapes",
      "seedless grapes",
    ],
    notes:
      "Peeled or seedless preferred. Grape skin can be tough — peel if early in Zone 2. Moderate fructose.",
  },
  {
    canonical: "canned mandarin",
    zone: 2,
    category: "carbohydrate",
    subcategory: "fruit",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "fruit",
    lineOrder: 18,
    examples: [
      "canned mandarin",
      "tinned mandarin",
      "mandarin segments in juice",
      "mandarin segments in syrup",
      "canned satsuma",
      "canned clementine",
    ],
    notes:
      "Canned mandarin in juice or syrup is much milder than fresh citrus. Acid is neutralized by the canning process. Similar tolerance profile to canned peach (Zone 1B).",
  },

  // ── dairy_fats (additional) ──
  {
    canonical: "mozzarella",
    zone: 2,
    category: "fat",
    subcategory: "dairy",
    macros: ["protein", "fat"],
    group: "fats",
    line: "dairy_fats",
    lineOrder: 4,
    examples: [
      "mozzarella",
      "fresh mozzarella",
      "buffalo mozzarella",
      "mozzarella cheese",
      "halloumi",
      "paneer",
      "queso fresco",
      "feta",
    ],
    notes:
      "Soft fresh cheeses. Lower lactose than aged cheese due to whey drainage. Distinct from cream cheese (spreadable) and hard cheese (aged).",
  },

  // ── sauces_condiments (additional) ──
  {
    canonical: "citrus juice",
    zone: 2,
    category: "condiment",
    subcategory: "acid",
    macros: [],
    group: "seasoning",
    line: "sauces_condiments",
    lineOrder: 12,
    examples: [
      "lemon juice",
      "lime juice",
      "lemon",
      "lime",
      "squeeze of lemon",
      "squeeze of lime",
      "lemon wedge",
      "lime wedge",
      "lemon dressing",
    ],
    notes:
      "Condiment-quantity citrus juice. Small amounts as flavoring (on fish, in dressings, in water). Not eating whole citrus fruit — see 'citrus fruit' for Zone 3.",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// ZONE 3 — Experimental. Introduce one at a time from a stable Zone 2 baseline.
// ─────────────────────────────────────────────────────────────────────────────

const ZONE_3: ReadonlyArray<FoodRegistryEntry> = [
  // ── meat_fish ──
  {
    canonical: "fast food burger",
    zone: 3,
    category: "protein",
    subcategory: "composite_dish",
    macros: ["protein", "carbohydrate", "fat"],
    group: "protein",
    line: "meat_fish",
    lineOrder: 10,
    examples: [
      "hamburger",
      "burger",
      "cheeseburger",
      "Big Mac",
      "fast food burger",
      "chicken burger",
      "hamburger and chips",
      "McDonalds",
      "Burger King",
      "Wendy's",
      "drive through",
      "takeaway burger",
    ],
    notes:
      "High fat, high salt, often with garlic/onion. Full Zone 3 challenge. Renamed from fast food.",
  },
  {
    canonical: "processed meat",
    zone: 3,
    category: "protein",
    subcategory: "processed",
    macros: ["protein", "fat"],
    group: "protein",
    line: "meat_fish",
    lineOrder: 11,
    examples: [
      "sausage",
      "sausages",
      "bacon",
      "salami",
      "pepperoni",
      "chorizo",
      "hot dog",
      "frankfurter",
      "black pudding",
      "pâté",
      "streaky bacon",
    ],
    notes:
      "High fat, high salt, strong spicing. Covers sausage-style and cured meats such as chorizo, salami, bacon, and hot dogs.",
  },
  {
    canonical: "battered fish",
    zone: 3,
    category: "protein",
    subcategory: "fish",
    macros: ["protein", "fat", "carbohydrate"],
    group: "protein",
    line: "meat_fish",
    lineOrder: 12,
    examples: [
      "fish and chips",
      "battered fish",
      "deep fried fish",
      "fish in batter",
    ],
    notes: "Deep fried in batter. New entry.",
  },
  {
    canonical: "chili con carne",
    zone: 3,
    category: "protein",
    subcategory: "composite_dish",
    macros: ["protein", "carbohydrate", "fat"],
    group: "protein",
    line: "meat_fish",
    lineOrder: 13,
    examples: [
      "chili con carne",
      "bean chili",
      "veggie chili",
      "chilli con carne",
    ],
    notes:
      "Composite dish: meat, legumes, spicy. Combines three Zone 3 ingredients: chili, garlic/onion, and legumes.",
  },
  {
    canonical: "stir fry",
    zone: 3,
    category: "protein",
    subcategory: "composite_dish",
    macros: ["protein", "carbohydrate", "fat"],
    group: "protein",
    line: "meat_fish",
    lineOrder: 14,
    examples: [
      "stir fry",
      "chicken stir fry",
      "beef stir fry",
      "vegetable stir fry",
      "noodle stir fry",
      "soy stir fry",
    ],
    notes:
      "Composite dish: meat, vegetables, fried. High-heat oil-based mixed dish. Often includes garlic, onion, soy sauce, and fibrous vegetables. Keep separate from curry-style dishes.",
  },
  {
    canonical: "curry dish",
    zone: 3,
    category: "protein",
    subcategory: "composite_dish",
    macros: ["protein", "carbohydrate", "fat"],
    group: "protein",
    line: "meat_fish",
    lineOrder: 15,
    examples: [
      "curry",
      "chicken tikka masala",
      "korma",
      "vindaloo",
      "Thai curry",
      "green curry",
      "red curry",
      "massaman curry",
      "Indian takeaway",
      "butter chicken",
    ],
    notes:
      "Composite dish: meat, vegetables, spicy. Restaurant/takeaway curries almost always contain garlic, onion, and chili in significant quantities.",
  },

  // ── vegetable_protein ──
  {
    canonical: "legumes",
    zone: 3,
    category: "protein",
    subcategory: "legume",
    macros: ["protein", "carbohydrate"],
    group: "protein",
    line: "vegetable_protein",
    lineOrder: 3,
    examples: [
      "beans",
      "kidney beans",
      "black beans",
      "cannellini beans",
      "baked beans",
      "lentils",
      "red lentils",
      "green lentils",
      "chickpeas",
      "hummus",
      "split peas",
      "edamame",
      "butter beans",
      "haricot beans",
    ],
    notes:
      "Flagged for both blockage risk and high gas/wind in all ileostomy and post-surgical guidelines.",
  },
  {
    canonical: "mild veggie burger",
    zone: 3,
    category: "protein",
    subcategory: "processed",
    macros: ["protein", "carbohydrate"],
    group: "protein",
    line: "vegetable_protein",
    lineOrder: 4,
    examples: [
      "mild veggie burger",
      "veggie patty",
      "rice potato patty",
      "simple veggie patty",
      "non bean veggie burger",
    ],
    notes:
      "Soft, non-bean veggie burger or patty built from potato, rice, or tofu rather than whole legumes or seeds.",
    osmoticEffect: "low",
    totalResidue: "low_moderate",
    fiberTotalApproxG: 2,
    fiberInsolubleLevel: "low_moderate",
    fiberSolubleLevel: "low_moderate",
    gasProducing: "possible",
    dryTexture: "low",
    irritantLoad: "low",
    highFatRisk: "low",
    lactoseRisk: "none",
  },

  // ── grains ──
  {
    canonical: "pizza",
    zone: 3,
    category: "carbohydrate",
    subcategory: "composite_dish",
    macros: ["carbohydrate", "fat", "protein"],
    group: "carbs",
    line: "grains",
    lineOrder: 21,
    examples: [
      "pizza",
      "cheese pizza",
      "pepperoni pizza",
      "margarita pizza",
      "takeaway pizza",
      "frozen pizza",
    ],
    notes: "High fat, often contains garlic, onion, and spiced toppings.",
  },
  {
    canonical: "wholegrain bread",
    zone: 3,
    category: "carbohydrate",
    subcategory: "grain",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "grains",
    lineOrder: 22,
    examples: [
      "wholegrain bread",
      "wholemeal bread",
      "brown bread",
      "seeded bread",
      "multigrain bread",
      "rye bread",
      "sourdough",
      "brown toast",
      "wholewheat bread",
    ],
    notes:
      "High insoluble fibre. Move to Zone 3 when ready to reintroduce higher-fibre grains.",
  },
  {
    canonical: "brown rice",
    zone: 3,
    category: "carbohydrate",
    subcategory: "grain",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "grains",
    lineOrder: 23,
    examples: [
      "brown rice",
      "wholegrain rice",
      "wild rice",
      "red rice",
      "black rice",
      "quinoa",
      "bulgur wheat",
      "freekeh",
      "farro",
    ],
    notes:
      "Higher fibre than white rice. Quinoa and bulgur also included here.",
  },
  {
    canonical: "sweet biscuit",
    zone: 3,
    category: "carbohydrate",
    subcategory: "processed",
    macros: ["carbohydrate", "fat"],
    group: "carbs",
    line: "grains",
    lineOrder: 24,
    examples: [
      "sweet biscuit",
      "cookie",
      "cookies",
      "oreo",
      "custard cream",
      "bourbon biscuit",
      "jammie dodgers",
      "ginger nut",
      "lemon cream biscuit",
      "chocolate digestive",
      "choc chip cookies",
      "hobnob",
      "maryland cookie",
      "chips ahoy",
      "mikado",
      "coconut cream biscuits",
    ],
    notes:
      "Sweeter or richer biscuits and cookies. Higher sugar and fat than plain biscuits, with more filling, chocolate, or frosting risk.",
  },
  {
    canonical: "high-sugar refined snack",
    zone: 3,
    category: "carbohydrate",
    subcategory: "processed",
    macros: ["carbohydrate", "fat"],
    group: "carbs",
    line: "grains",
    lineOrder: 25,
    examples: [
      "high sugar refined snack",
      "biscoff",
      "biscoff biscuit",
      "biscoff biscuits",
      "lotus biscoff",
      "pastries",
      "confectionery",
      "flapjacks",
      "pop tarts",
      "rice krispie treats",
    ],
    notes:
      "Highly refined, sugary snack foods with a stronger osmotic-risk profile than plain biscuits. Includes pastries, flapjacks, and similar.",
    osmoticEffect: "moderate_high",
    totalResidue: "low",
    fiberTotalApproxG: 1,
    fiberInsolubleLevel: "low",
    fiberSolubleLevel: "low",
    gasProducing: "possible",
    dryTexture: "yes",
    irritantLoad: "low",
    highFatRisk: "moderate",
    lactoseRisk: "low",
  },
  {
    canonical: "non-sugar sweetener",
    zone: 3,
    category: "condiment",
    subcategory: "sugar",
    macros: [],
    group: "seasoning",
    line: "sauces_condiments",
    lineOrder: 11,
    examples: [
      "stevia",
      "sweetener",
      "artificial sweetener",
      "sucralose",
      "aspartame",
      "saccharin",
    ],
    notes:
      "Non-sugar sweeteners. Low residue, but keep separate from sugar because they behave differently and often appear in tiny add-on amounts.",
  },
  {
    canonical: "dark chocolate",
    zone: 3,
    category: "condiment",
    subcategory: "sugar",
    macros: ["carbohydrate", "fat"],
    group: "carbs",
    line: "grains",
    lineOrder: 26,
    examples: [
      "dark chocolate",
      "dark chocolate square",
      "dark chocolate 85% cocoa",
      "dark chocolate 90% cocoa",
    ],
    notes:
      "Separate from generic confectionery because the sugar load is lower, but cocoa solids and fat still make it a Zone 3 challenge.",
  },
  {
    canonical: "refined confectionery",
    zone: 3,
    category: "condiment",
    subcategory: "sugar",
    macros: ["carbohydrate", "fat"],
    group: "carbs",
    line: "grains",
    lineOrder: 27,
    examples: [
      "refined confectionery",
      "concentrated sweet food",
      "concentrated sweets",
      "chocolate",
      "milk chocolate",
      "white chocolate",
      "caramel",
      "caramel sweets",
      "candy",
      "sweets",
      "cough sweets",
      "halls honey & lemon cough sweets",
      "halls honey lemon cough sweets",
      "cake",
      "doughnut",
      "brownie",
      "rich dessert",
      "fudge",
      "toffee",
      "croissant",
      "danish pastry",
    ],
    notes:
      "Concentrated fructose and sugar load can cause osmotic diarrhea and high output. Small occasional amounts (tablespoon-level) may be tolerated — test from a stable baseline.",
  },

  // ── vegetables ──
  {
    canonical: "roasted potato",
    zone: 3,
    category: "carbohydrate",
    subcategory: "vegetable",
    macros: ["carbohydrate", "fat"],
    group: "carbs",
    line: "vegetables",
    lineOrder: 16,
    examples: [
      "roasted potato",
      "roast potato",
      "roasties",
      "oven roasted potato",
      "potatoes roasted in oil",
    ],
    notes:
      "Peeled, roasted with oil. Zone changed from 2 to 3 (roasted in fat).",
  },
  {
    canonical: "broccoli",
    zone: 3,
    category: "carbohydrate",
    subcategory: "vegetable",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "vegetables",
    lineOrder: 17,
    examples: [
      "broccoli",
      "cooked broccoli",
      "steamed broccoli",
      "boiled broccoli",
      "broccoli florets",
      "well cooked broccoli",
    ],
    notes:
      "Zone changed from 2 to 3. Cruciferous, gassy, high output risk for anastomosis. Florets only, no stalks.",
  },
  {
    canonical: "green beans",
    zone: 3,
    category: "carbohydrate",
    subcategory: "vegetable",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "vegetables",
    lineOrder: 18,
    examples: [
      "green beans",
      "french beans",
      "fine beans",
      "steamed green beans",
      "boiled green beans",
      "cooked green beans",
    ],
    notes: "Zone changed from 2 to 3. Stringy, gassy.",
  },
  {
    canonical: "leek",
    zone: 3,
    category: "carbohydrate",
    subcategory: "vegetable",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "vegetables",
    lineOrder: 19,
    examples: [
      "leek",
      "cooked leek",
      "steamed leek",
      "boiled leek",
      "braised leek",
      "leek in sauce",
    ],
    notes: "Zone changed from 2 to 3. Basically an onion.",
  },
  {
    canonical: "onion",
    zone: 3,
    category: "carbohydrate",
    subcategory: "vegetable",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "vegetables",
    lineOrder: 20,
    examples: [
      "onion",
      "onions",
      "raw onion",
      "cooked onion",
      "fried onion",
      "shallot",
      "spring onion",
      "scallion",
      "red onion",
      "white onion",
      "brown onion",
    ],
    notes:
      "Moved from condiment to vegetables. Gas, odour, and high output risk. Even cooked onion can cause problems early on.",
  },
  {
    canonical: "sweetcorn",
    zone: 3,
    category: "carbohydrate",
    subcategory: "vegetable",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "vegetables",
    lineOrder: 21,
    examples: [
      "corn",
      "sweetcorn",
      "corn on the cob",
      "sweet corn",
      "corn kernels",
      "popcorn",
    ],
    notes:
      "Hulls pass through undigested — blockage risk even when cooked. Popcorn is also Zone 3.",
  },
  {
    canonical: "raw salad",
    zone: 3,
    category: "carbohydrate",
    subcategory: "vegetable",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "vegetables",
    lineOrder: 22,
    examples: [
      "salad",
      "green salad",
      "mixed salad",
      "lettuce",
      "rocket",
      "arugula",
      "coleslaw",
      "raw cabbage",
      "beansprouts",
      "raw celery",
      "celery",
      "raw carrot",
      "grated carrot",
      "raw pepper",
      "raw mushrooms",
      "spinach salad",
    ],
    notes:
      "Raw vegetables are consistently Zone 3 in post-surgical guidelines regardless of type.",
  },
  {
    canonical: "mushrooms",
    zone: 3,
    category: "carbohydrate",
    subcategory: "vegetable",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "vegetables",
    lineOrder: 23,
    examples: [
      "mushrooms",
      "button mushrooms",
      "field mushrooms",
      "portobello mushroom",
      "shiitake",
      "oyster mushroom",
      "cooked mushrooms",
      "fried mushrooms",
    ],
    notes:
      "Spongy texture with polysaccharides that can cause high output and gas. Zone 3 even when cooked.",
  },

  // ── fruit ──
  {
    canonical: "mandarin",
    zone: 3,
    category: "carbohydrate",
    subcategory: "fruit",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "fruit",
    lineOrder: 8,
    examples: [
      "mandarin",
      "tangerine",
      "clementine",
      "mandarin segments",
      "satsuma",
    ],
    notes:
      "Fresh mandarin/tangerine/clementine. Zone 3 due to citrus acid. Canned mandarin has its own Zone 2 entry.",
  },
  {
    canonical: "kiwi",
    zone: 3,
    category: "carbohydrate",
    subcategory: "fruit",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "fruit",
    lineOrder: 9,
    examples: ["kiwi", "kiwi fruit", "kiwifruit", "green kiwi", "golden kiwi"],
    notes:
      "Actinidin enzyme stimulates bowel motility. Seeds throughout flesh. Reliably causes increased output.",
  },
  {
    canonical: "citrus fruit",
    zone: 3,
    category: "carbohydrate",
    subcategory: "fruit",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "fruit",
    lineOrder: 10,
    examples: [
      "orange",
      "oranges",
      "whole orange",
      "orange segments",
      "orange juice",
      "fresh orange juice",
      "grapefruit",
      "pomelo",
    ],
    notes:
      "Pith and membrane are tough fibre. Concentrated vitamin C in juice can increase output. Mandarin segments (no pith) are Zone 3 instead.",
  },
  {
    canonical: "pineapple",
    zone: 3,
    category: "carbohydrate",
    subcategory: "fruit",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "fruit",
    lineOrder: 11,
    examples: [
      "pineapple",
      "fresh pineapple",
      "canned pineapple",
      "pineapple chunks",
      "pineapple rings",
    ],
    notes: "Bromelain enzyme and fibrous flesh. Can be very stimulating.",
  },
  {
    canonical: "strawberries",
    zone: 3,
    category: "carbohydrate",
    subcategory: "fruit",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "fruit",
    lineOrder: 12,
    examples: [
      "strawberries",
      "strawberry",
      "fresh strawberries",
      "blueberries",
      "raspberries",
      "blackberries",
      "mixed berries",
      "berries",
    ],
    notes:
      "Seeds on skin of strawberries and inside raspberries/blackberries. Small amounts of very ripe strawberries may be tolerated in late Zone 2, but keep to Zone 3 until stable.",
  },
  {
    canonical: "dried fruit",
    zone: 3,
    category: "carbohydrate",
    subcategory: "fruit",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "fruit",
    lineOrder: 13,
    examples: [
      "dried fruit",
      "raisins",
      "sultanas",
      "prunes",
      "dates",
      "dried apricots",
      "dried mango",
      "cranberries dried",
      "currants",
    ],
    notes:
      "Very concentrated fibre and fructose. Prunes especially well-known as bowel stimulants.",
  },
  {
    canonical: "exotic fruit",
    zone: 3,
    category: "carbohydrate",
    subcategory: "fruit",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "fruit",
    lineOrder: 14,
    examples: [
      "papaya",
      "dragon fruit",
      "passion fruit",
      "lychee",
      "guava",
      "jackfruit",
      "durian",
      "starfruit",
      "persimmon",
    ],
    notes: "Variable fibre, seeds, and enzymes. Trial one at a time.",
  },
  {
    canonical: "apple",
    zone: 3,
    category: "carbohydrate",
    subcategory: "fruit",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "fruit",
    lineOrder: 16,
    examples: [
      "apple",
      "raw apple",
      "green apple",
      "red apple",
      "gala apple",
      "granny smith",
      "fuji apple",
      "braeburn",
      "apple with skin",
    ],
    notes:
      "Raw apple with skin — high insoluble fibre, firm texture. Zone 3. Peeled apple is Zone 2, stewed apple is Zone 1.",
  },

  // ── oils ──
  {
    canonical: "deep fried food",
    zone: 3,
    category: "fat",
    subcategory: "processed",
    macros: ["fat", "carbohydrate"],
    group: "fats",
    line: "oils",
    lineOrder: 3,
    examples: [
      "chips",
      "french fries",
      "deep fried food",
      "KFC",
      "fried chicken",
      "chicken nuggets",
      "onion rings",
      "tempura",
      "battered food",
    ],
    notes:
      "High fat from deep frying consistently causes diarrhea and high output. Chips/fries are Zone 3 regardless of base ingredient.",
  },

  // ── dairy_fats ──
  {
    canonical: "soft rind cheese",
    zone: 3,
    category: "dairy",
    subcategory: "cheese",
    macros: ["fat", "protein"],
    group: "fats",
    line: "dairy_fats",
    lineOrder: 7,
    examples: [
      "brie",
      "camembert",
      "gorgonzola",
      "blue cheese",
      "stilton",
      "roquefort",
      "soft rind cheese",
      "mould-ripened cheese",
    ],
    notes:
      "Very high fat. Can worsen loose stools. Trial small amounts from a stable Zone 2 baseline.",
  },
  {
    canonical: "double cream",
    zone: 3,
    category: "dairy",
    subcategory: "butter_cream",
    macros: ["fat"],
    group: "fats",
    line: "dairy_fats",
    lineOrder: 8,
    examples: [
      "double cream",
      "heavy cream",
      "whipped cream",
      "clotted cream",
      "whipping cream",
    ],
    notes:
      "Very high saturated fat. More concentrated than the Zone 2 single/cooking cream.",
  },

  // ── nuts_seeds ──
  {
    canonical: "nuts",
    zone: 3,
    category: "fat",
    subcategory: "nut_seed",
    macros: ["fat", "protein"],
    group: "fats",
    line: "nuts_seeds",
    lineOrder: 3,
    examples: [
      "nuts",
      "peanuts",
      "almonds",
      "cashews",
      "walnuts",
      "pistachios",
      "hazelnuts",
      "pecans",
      "macadamia",
    ],
    notes:
      "Blockage risk from skins. Smooth nut butters have their own Zone 2 entry.",
  },
  {
    canonical: "seeds",
    zone: 3,
    category: "fat",
    subcategory: "nut_seed",
    macros: ["fat", "protein"],
    group: "fats",
    line: "nuts_seeds",
    lineOrder: 4,
    examples: [
      "seeds",
      "sunflower seeds",
      "pumpkin seeds",
      "chia seeds",
      "flax seeds",
      "linseed",
      "sesame seeds",
      "hemp seeds",
      "poppy seeds",
    ],
    notes: "Blockage risk — small seeds can accumulate.",
  },
  {
    canonical: "guacamole",
    zone: 3,
    category: "fat",
    subcategory: "fruit",
    macros: ["fat", "carbohydrate"],
    group: "fats",
    line: "nuts_seeds",
    lineOrder: 5,
    examples: ["guacamole", "guac", "avocado dip"],
    notes:
      "Contains avocado plus additional ingredients (onion, lime, cilantro, chili) that may irritate. Zone 3 because of the combined irritant load — test only when plain avocado is well tolerated.",
  },

  // ── sauces_condiments ──
  {
    canonical: "miso soup",
    zone: 3,
    category: "drink",
    subcategory: "broth",
    macros: [],
    group: "seasoning",
    line: "sauces_condiments",
    lineOrder: 9,
    examples: [
      "miso soup",
      "plain miso soup",
      "miso broth",
      "strained miso soup",
    ],
    notes:
      "Fermented soy broth. Keep separate from clear stock because it carries soy solids/seasoning and is often served with tofu, seaweed, or scallion.",
  },
  {
    canonical: "hot sauce",
    zone: 3,
    category: "condiment",
    subcategory: "irritant",
    macros: [],
    group: "seasoning",
    line: "sauces_condiments",
    lineOrder: 10,
    examples: [
      "hot sauce",
      "sriracha",
      "tabasco",
      "chili sauce",
      "sambal",
      "harissa",
      "peri peri sauce",
      "piri piri",
      "buffalo sauce",
    ],
    notes:
      "Capsaicin-based sauces. Direct GI irritant that increases motility and output even in small quantities.",
  },

  // ── herbs_spices ──
  {
    canonical: "black pepper",
    zone: 3,
    category: "condiment",
    subcategory: "spice",
    macros: [],
    group: "seasoning",
    line: "herbs_spices",
    lineOrder: 4,
    examples: [
      "black pepper",
      "lots of pepper",
      "freshly ground pepper",
      "cracked black pepper",
      "white pepper",
    ],
    notes:
      "Piperine in black pepper is a mild GI irritant. Zone changed from 2 to 3.",
  },
  {
    canonical: "garlic",
    zone: 3,
    category: "condiment",
    subcategory: "herb",
    macros: [],
    group: "seasoning",
    line: "herbs_spices",
    lineOrder: 5,
    examples: [
      "garlic",
      "garlic clove",
      "minced garlic",
      "garlic powder",
      "garlic paste",
      "roasted garlic",
      "garlic bread",
      "garlic butter",
    ],
    notes:
      "Moved to herbs_spices. Consistently flagged in ileostomy and bowel surgery guidelines for gas, odour, and high output.",
  },
  {
    canonical: "chili",
    zone: 3,
    category: "condiment",
    subcategory: "irritant",
    macros: [],
    group: "seasoning",
    line: "herbs_spices",
    lineOrder: 6,
    examples: [
      "chili",
      "chilli",
      "chili pepper",
      "fresh chili",
      "red chili",
      "green chili",
      "cayenne",
      "cayenne pepper",
      "chili flakes",
      "red pepper flakes",
      "hot pepper",
      "jalapeño",
      "scotch bonnet",
      "bird's eye chili",
    ],
    notes:
      "Capsaicin directly stimulates bowel motility and is the most consistent GI irritant in all guidelines.",
  },
  {
    canonical: "hot spice blend",
    zone: 3,
    category: "condiment",
    subcategory: "spice",
    macros: [],
    group: "seasoning",
    line: "herbs_spices",
    lineOrder: 7,
    examples: [
      "curry powder",
      "hot curry powder",
      "garam masala",
      "Chinese five spice",
      "ras el hanout",
      "za'atar",
      "berbere",
      "jerk seasoning",
      "cajun seasoning",
    ],
    notes:
      "Complex spice blends, especially those containing chili, garlic powder, or onion powder.",
  },

  // ── grains (additional) ──
  {
    canonical: "alcohol",
    zone: 3,
    category: "beverage",
    subcategory: "alcohol",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "grains",
    lineOrder: 29,
    examples: [
      "beer",
      "wine",
      "red wine",
      "white wine",
      "spirits",
      "vodka",
      "gin",
      "whisky",
      "rum",
      "cider",
      "lager",
      "ale",
      "prosecco",
      "champagne",
      "cocktail",
      "shandy",
      "pint",
    ],
    notes:
      "GI irritant that increases output and dehydrates. Beer/cider also carbonated. Wine contains tannins and acid. Spirits are concentrated irritants. Start with small amounts, always with food, never on an empty stomach. Very common patient question.",
  },
  {
    canonical: "carbonated drink",
    zone: 3,
    category: "beverage",
    subcategory: "fizzy_drink",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "grains",
    lineOrder: 30,
    examples: [
      "coke",
      "coca cola",
      "pepsi",
      "lemonade",
      "fizzy drink",
      "soda",
      "pop",
      "tonic water",
      "7up",
      "sprite",
      "fanta",
      "diet coke",
      "energy drink",
      "red bull",
      "monster",
      "irn bru",
      "ginger beer",
      "ginger ale",
    ],
    notes:
      "Gas from carbonation causes bloating and discomfort. Sugar versions have high osmotic load. Diet versions contain artificial sweeteners. Energy drinks combine caffeine + carbonation + sugar. Flat/degassed versions are better tolerated.",
  },

  // ── vegetables (additional) ──
  {
    canonical: "coffee",
    zone: 3,
    category: "beverage",
    subcategory: "hot_drink",
    macros: [],
    group: "carbs",
    line: "vegetables",
    lineOrder: 30,
    examples: [
      "coffee",
      "black coffee",
      "espresso",
      "americano",
      "latte",
      "cappuccino",
      "flat white",
      "instant coffee",
      "decaf coffee",
      "iced coffee",
      "cold brew",
    ],
    notes:
      "WARNING: Coffee stimulates colonic motility and gastric acid secretion. Can significantly increase output frequency. Even decaf has some effect. Introduce very cautiously — small amounts, not on an empty stomach. Many patients find coffee is the last thing they can reintroduce.",
  },

  // ── fruit (additional) ──
  {
    canonical: "fig",
    zone: 3,
    category: "carbohydrate",
    subcategory: "fruit",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "fruit",
    lineOrder: 19,
    examples: [
      "fig",
      "figs",
      "fresh fig",
      "dried fig",
      "fig roll",
      "fig bar",
      "fig newton",
    ],
    notes:
      "Very high fiber and full of small seeds. Both fresh and dried are Zone 3. Dried figs are especially high in concentrated fiber and fructose. A common natural laxative.",
  },
  {
    canonical: "pomegranate",
    zone: 3,
    category: "carbohydrate",
    subcategory: "fruit",
    macros: ["carbohydrate"],
    group: "carbs",
    line: "fruit",
    lineOrder: 20,
    examples: [
      "pomegranate",
      "pomegranate seeds",
      "pomegranate arils",
      "pomegranate juice",
    ],
    notes:
      "Seeds are the defining characteristic — hundreds of small seeds per fruit. Pomegranate juice (strained) may be tolerated earlier but whole seeds are a blockage concern.",
  },

  // ── nuts_seeds (additional) ──
  {
    canonical: "coconut",
    zone: 3,
    category: "fat",
    subcategory: "nut",
    macros: ["fat"],
    group: "fats",
    line: "nuts_seeds",
    lineOrder: 6,
    examples: [
      "coconut",
      "desiccated coconut",
      "coconut flakes",
      "coconut cream",
      "canned coconut milk",
      "coconut oil",
      "coconut butter",
      "fresh coconut",
      "toasted coconut",
    ],
    notes:
      "High fat and fiber. Desiccated coconut is very high fiber. Canned coconut milk (thick, for cooking) is high fat — distinct from carton coconut milk (Zone 2 plant milk). Common in baked goods and curries.",
  },
];

type FoodEntryEnrichment = FoodDigestionMetadata & {
  addExamples?: ReadonlyArray<string>;
};

const CLEAR_LIQUID_PROFILE: FoodDigestionMetadata = {
  osmoticEffect: "low",
  totalResidue: "very_low",
  fiberTotalApproxG: 0,
  fiberInsolubleLevel: "low",
  fiberSolubleLevel: "low",
  gasProducing: "no",
  dryTexture: "no",
  irritantLoad: "none",
  highFatRisk: "none",
  lactoseRisk: "none",
};

const SMOOTH_LIQUID_PROFILE: FoodDigestionMetadata = {
  osmoticEffect: "low",
  totalResidue: "low",
  fiberTotalApproxG: 1.5,
  fiberInsolubleLevel: "low",
  fiberSolubleLevel: "low_moderate",
  gasProducing: "no",
  dryTexture: "no",
  irritantLoad: "low",
  highFatRisk: "low",
  lactoseRisk: "low",
};

const REFINED_GRAIN_PROFILE: FoodDigestionMetadata = {
  osmoticEffect: "low",
  totalResidue: "low",
  fiberTotalApproxG: 1.5,
  fiberInsolubleLevel: "low",
  fiberSolubleLevel: "low",
  gasProducing: "no",
  dryTexture: "low",
  irritantLoad: "none",
  highFatRisk: "none",
  lactoseRisk: "none",
};

const DRY_REFINED_GRAIN_PROFILE: FoodDigestionMetadata = {
  ...REFINED_GRAIN_PROFILE,
  dryTexture: "yes",
};

const PORRIDGE_PROFILE: FoodDigestionMetadata = {
  osmoticEffect: "low",
  totalResidue: "low",
  fiberTotalApproxG: 2,
  fiberInsolubleLevel: "low",
  fiberSolubleLevel: "low_moderate",
  gasProducing: "possible",
  dryTexture: "no",
  irritantLoad: "none",
  highFatRisk: "none",
  lactoseRisk: "low",
};

const PUDDING_PROFILE: FoodDigestionMetadata = {
  osmoticEffect: "moderate",
  totalResidue: "very_low",
  fiberTotalApproxG: 0.5,
  fiberInsolubleLevel: "low",
  fiberSolubleLevel: "low",
  gasProducing: "no",
  dryTexture: "no",
  irritantLoad: "none",
  highFatRisk: "low_moderate",
  lactoseRisk: "low_moderate",
};

const ROOT_VEG_PROFILE: FoodDigestionMetadata = {
  osmoticEffect: "low",
  totalResidue: "low",
  fiberTotalApproxG: 2.5,
  fiberInsolubleLevel: "low_moderate",
  fiberSolubleLevel: "moderate",
  gasProducing: "possible",
  dryTexture: "no",
  irritantLoad: "none",
  highFatRisk: "low",
  lactoseRisk: "none",
};

const LOW_FIBER_VEG_PROFILE: FoodDigestionMetadata = {
  osmoticEffect: "low",
  totalResidue: "low_moderate",
  fiberTotalApproxG: 2,
  fiberInsolubleLevel: "low_moderate",
  fiberSolubleLevel: "moderate",
  gasProducing: "possible",
  dryTexture: "no",
  irritantLoad: "none",
  highFatRisk: "low",
  lactoseRisk: "none",
};

const LEAN_PROTEIN_PROFILE: FoodDigestionMetadata = {
  osmoticEffect: "none",
  totalResidue: "low",
  fiberTotalApproxG: 0,
  fiberInsolubleLevel: "low",
  fiberSolubleLevel: "low",
  gasProducing: "no",
  dryTexture: "no",
  irritantLoad: "low",
  highFatRisk: "low",
  lactoseRisk: "none",
};

const DRY_HEAT_PROTEIN_PROFILE: FoodDigestionMetadata = {
  ...LEAN_PROTEIN_PROFILE,
  dryTexture: "low",
};

const EGG_PROFILE: FoodDigestionMetadata = {
  osmoticEffect: "none",
  totalResidue: "very_low",
  fiberTotalApproxG: 0,
  fiberInsolubleLevel: "low",
  fiberSolubleLevel: "low",
  gasProducing: "no",
  dryTexture: "no",
  irritantLoad: "none",
  highFatRisk: "low",
  lactoseRisk: "none",
};

const MILK_PROFILE: FoodDigestionMetadata = {
  osmoticEffect: "moderate",
  totalResidue: "very_low",
  fiberTotalApproxG: 0,
  fiberInsolubleLevel: "low",
  fiberSolubleLevel: "low",
  gasProducing: "possible",
  dryTexture: "no",
  irritantLoad: "none",
  highFatRisk: "low_moderate",
  lactoseRisk: "moderate",
};

const YOGURT_PROFILE: FoodDigestionMetadata = {
  osmoticEffect: "low_moderate",
  totalResidue: "very_low",
  fiberTotalApproxG: 0,
  fiberInsolubleLevel: "low",
  fiberSolubleLevel: "low",
  gasProducing: "possible",
  dryTexture: "no",
  irritantLoad: "none",
  highFatRisk: "low",
  lactoseRisk: "moderate",
};

const SOFT_CHEESE_PROFILE: FoodDigestionMetadata = {
  osmoticEffect: "low",
  totalResidue: "very_low",
  fiberTotalApproxG: 0,
  fiberInsolubleLevel: "low",
  fiberSolubleLevel: "low",
  gasProducing: "possible",
  dryTexture: "no",
  irritantLoad: "low",
  highFatRisk: "low_moderate",
  lactoseRisk: "low_moderate",
};

const HARD_CHEESE_PROFILE: FoodDigestionMetadata = {
  osmoticEffect: "low",
  totalResidue: "very_low",
  fiberTotalApproxG: 0,
  fiberInsolubleLevel: "low",
  fiberSolubleLevel: "low",
  gasProducing: "possible",
  dryTexture: "low",
  irritantLoad: "low",
  highFatRisk: "moderate",
  lactoseRisk: "low",
};

const OIL_PROFILE: FoodDigestionMetadata = {
  osmoticEffect: "none",
  totalResidue: "very_low",
  fiberTotalApproxG: 0,
  fiberInsolubleLevel: "low",
  fiberSolubleLevel: "low",
  gasProducing: "no",
  dryTexture: "no",
  irritantLoad: "none",
  highFatRisk: "moderate",
  lactoseRisk: "none",
};

const BUTTER_PROFILE: FoodDigestionMetadata = {
  ...OIL_PROFILE,
  highFatRisk: "moderate",
  lactoseRisk: "low",
};

const CREAM_PROFILE: FoodDigestionMetadata = {
  osmoticEffect: "low",
  totalResidue: "very_low",
  fiberTotalApproxG: 0,
  fiberInsolubleLevel: "low",
  fiberSolubleLevel: "low",
  gasProducing: "possible",
  dryTexture: "no",
  irritantLoad: "low",
  highFatRisk: "high",
  lactoseRisk: "moderate",
};

const SOFT_FRUIT_PROFILE: FoodDigestionMetadata = {
  osmoticEffect: "moderate",
  totalResidue: "low_moderate",
  fiberTotalApproxG: 2.5,
  fiberInsolubleLevel: "low_moderate",
  fiberSolubleLevel: "moderate",
  gasProducing: "possible",
  dryTexture: "no",
  irritantLoad: "low",
  highFatRisk: "none",
  lactoseRisk: "none",
};

const MELON_PROFILE: FoodDigestionMetadata = {
  osmoticEffect: "moderate",
  totalResidue: "low",
  fiberTotalApproxG: 1,
  fiberInsolubleLevel: "low",
  fiberSolubleLevel: "low",
  gasProducing: "possible",
  dryTexture: "no",
  irritantLoad: "low",
  highFatRisk: "none",
  lactoseRisk: "none",
};

const FERMENTED_DAIRY_PROFILE: FoodDigestionMetadata = {
  osmoticEffect: "moderate",
  totalResidue: "very_low",
  fiberTotalApproxG: 0,
  fiberInsolubleLevel: "low",
  fiberSolubleLevel: "low",
  gasProducing: "possible",
  dryTexture: "no",
  irritantLoad: "low_moderate",
  highFatRisk: "low",
  lactoseRisk: "moderate",
};

const SWEET_SNACK_PROFILE: FoodDigestionMetadata = {
  osmoticEffect: "moderate",
  totalResidue: "very_low",
  fiberTotalApproxG: 0,
  fiberInsolubleLevel: "low",
  fiberSolubleLevel: "low",
  gasProducing: "possible",
  dryTexture: "no",
  irritantLoad: "none",
  highFatRisk: "low",
  lactoseRisk: "low",
};

const DEEP_FRIED_PROFILE: FoodDigestionMetadata = {
  osmoticEffect: "low",
  totalResidue: "low",
  fiberTotalApproxG: 1.5,
  fiberInsolubleLevel: "low_moderate",
  fiberSolubleLevel: "low",
  gasProducing: "possible",
  dryTexture: "yes",
  irritantLoad: "low",
  highFatRisk: "high",
  lactoseRisk: "none",
};

const FOOD_ENTRY_ENRICHMENTS: ReadonlyMap<string, FoodEntryEnrichment> =
  new Map([
    [
      "clear broth",
      {
        addExamples: [
          "clear vegetable broth",
          "clear chicken broth",
          "clear beef broth",
        ],
        ...CLEAR_LIQUID_PROFILE,
      },
    ],
    ["gelatin dessert", { ...SWEET_SNACK_PROFILE }],
    [
      "smooth soup",
      {
        addExamples: [
          "clear strained tomato broth",
          "strained vegetable soup",
          "carrot and potato soup",
          "strained chicken puree soup",
        ],
        ...SMOOTH_LIQUID_PROFILE,
      },
    ],
    ["boiled fish", { ...LEAN_PROTEIN_PROFILE }],
    ["boiled white meat", { ...LEAN_PROTEIN_PROFILE }],
    ["plain yogurt", { addExamples: ["strained yogurt"], ...YOGURT_PROFILE }],
    ["egg", { ...EGG_PROFILE }],
    ["milk", { ...MILK_PROFILE }],
    [
      "cottage cheese",
      {
        ...SOFT_CHEESE_PROFILE,
      },
    ],
    ["custard", { ...PUDDING_PROFILE }],
    ["white rice", { ...REFINED_GRAIN_PROFILE }],
    [
      "toast",
      {
        ...DRY_REFINED_GRAIN_PROFILE,
        highFatRisk: "low",
      },
    ],
    ["white bread", { ...REFINED_GRAIN_PROFILE }],
    [
      "white pasta",
      {
        addExamples: ["plain macaroni", "plain spaghetti"],
        ...REFINED_GRAIN_PROFILE,
      },
    ],
    ["rice cracker", { ...DRY_REFINED_GRAIN_PROFILE }],
    ["porridge", { ...PORRIDGE_PROFILE }],
    ["noodles", { ...REFINED_GRAIN_PROFILE }],
    [
      "rice pudding",
      { addExamples: ["tapioca pudding", "sago pudding"], ...PUDDING_PROFILE },
    ],
    ["mashed potato", { ...ROOT_VEG_PROFILE }],
    ["mashed root vegetable", { ...ROOT_VEG_PROFILE }],
    ["ripe banana", { ...SOFT_FRUIT_PROFILE }],
    ["stewed apple", { ...SOFT_FRUIT_PROFILE }],
    [
      "canned pear",
      {
        addExamples: ["peeled soft pear", "pear puree"],
        ...SOFT_FRUIT_PROFILE,
      },
    ],
    [
      "canned peach",
      {
        addExamples: [
          "peeled ripe peach",
          "peeled ripe nectarine",
          "peeled ripe apricot",
          "canned apricots in juice",
        ],
        ...SOFT_FRUIT_PROFILE,
      },
    ],
    ["olive oil", { ...OIL_PROFILE }],
    [
      "grilled white meat",
      {
        addExamples: [
          "grilled chicken breast lightly oiled",
          "baked chicken breast no heavy crust",
          "grilled turkey breast",
          "roast turkey breast",
        ],
        ...DRY_HEAT_PROTEIN_PROFILE,
      },
    ],
    [
      "ham",
      {
        ...DRY_HEAT_PROTEIN_PROFILE,
        irritantLoad: "low_moderate",
        highFatRisk: "low_moderate",
      },
    ],
    [
      "cooked fish",
      {
        addExamples: [
          "baked cod light oil",
          "baked haddock",
          "grilled hake",
          "grilled sole",
        ],
        ...DRY_HEAT_PROTEIN_PROFILE,
      },
    ],
    [
      "buttered scrambled eggs",
      { ...EGG_PROFILE, dryTexture: "low", highFatRisk: "low_moderate" },
    ],
    ["flavoured yogurt", { ...YOGURT_PROFILE, osmoticEffect: "moderate" }],
    ["milk pudding", { ...PUDDING_PROFILE }],
    [
      "boiled carrot",
      { addExamples: ["boiled carrots"], ...LOW_FIBER_VEG_PROFILE },
    ],
    [
      "baked potato",
      {
        addExamples: ["peeled potato pieces"],
        ...ROOT_VEG_PROFILE,
      },
    ],
    [
      "sweet potato",
      { addExamples: ["boiled sweet potato"], ...ROOT_VEG_PROFILE },
    ],
    [
      "cooked pumpkin",
      { addExamples: ["boiled butternut squash"], ...LOW_FIBER_VEG_PROFILE },
    ],
    [
      "courgette",
      {
        addExamples: [
          "boiled peeled courgette",
          "boiled peeled zucchini",
          "boiled peeled marrow",
        ],
        ...LOW_FIBER_VEG_PROFILE,
      },
    ],
    [
      "swede",
      { addExamples: ["boiled swede", "boiled turnip"], ...ROOT_VEG_PROFILE },
    ],
    ["parsnip", { ...ROOT_VEG_PROFILE }],
    ["melon", { ...MELON_PROFILE }],
    ["ripe mango", { ...SOFT_FRUIT_PROFILE }],
    ["peeled apple", { ...SOFT_FRUIT_PROFILE }],
    ["vegetable oil", { ...OIL_PROFILE }],
    ["butter", { ...BUTTER_PROFILE }],
    [
      "non-sugar sweetener",
      {
        osmoticEffect: "none",
        totalResidue: "very_low",
        fiberTotalApproxG: 0,
        fiberInsolubleLevel: "low",
        fiberSolubleLevel: "low",
        gasProducing: "possible",
        dryTexture: "no",
        irritantLoad: "none",
        highFatRisk: "none",
        lactoseRisk: "none",
      },
    ],
    ["cream cheese", { ...SOFT_CHEESE_PROFILE }],
    [
      "hard cheese",
      {
        addExamples: [
          "mild sliced cheese",
          "grated mild cheese",
          "grated mild cheese on pasta",
          "melted cheese on potato",
        ],
        ...HARD_CHEESE_PROFILE,
      },
    ],
    ["cream", { ...CREAM_PROFILE }],
    [
      "plain ice cream",
      {
        osmoticEffect: "moderate",
        totalResidue: "very_low",
        fiberTotalApproxG: 0,
        fiberInsolubleLevel: "low",
        fiberSolubleLevel: "low",
        gasProducing: "possible",
        dryTexture: "no",
        irritantLoad: "none",
        highFatRisk: "moderate",
        lactoseRisk: "moderate",
      },
    ],
    [
      "tofu",
      {
        addExamples: [
          "firm tofu cubes in mild sauce",
          "plain tofu stir fry with peeled soft veg",
        ],
        ...SOFT_CHEESE_PROFILE,
        highFatRisk: "low",
        lactoseRisk: "none",
      },
    ],
    ["kefir", { addExamples: ["plain kefir"], ...FERMENTED_DAIRY_PROFILE }],
    [
      "sweet biscuit",
      {
        osmoticEffect: "moderate",
        totalResidue: "low",
        fiberTotalApproxG: 1.5,
        fiberInsolubleLevel: "low",
        fiberSolubleLevel: "low",
        gasProducing: "possible",
        dryTexture: "yes",
        irritantLoad: "low",
        highFatRisk: "moderate",
        lactoseRisk: "low",
      },
    ],
    [
      "dark chocolate",
      {
        osmoticEffect: "low_moderate",
        totalResidue: "low",
        fiberTotalApproxG: 2,
        fiberInsolubleLevel: "low",
        fiberSolubleLevel: "low",
        gasProducing: "possible",
        dryTexture: "low",
        irritantLoad: "low",
        highFatRisk: "moderate",
        lactoseRisk: "low",
      },
    ],
    [
      "refined confectionery",
      {
        osmoticEffect: "high",
        totalResidue: "very_low",
        fiberTotalApproxG: 0,
        fiberInsolubleLevel: "low",
        fiberSolubleLevel: "low",
        gasProducing: "possible",
        dryTexture: "no",
        irritantLoad: "low",
        highFatRisk: "moderate",
        lactoseRisk: "low",
      },
    ],
    ["deep fried food", { ...DEEP_FRIED_PROFILE }],
  ]);

function mergeExamples(
  existing: ReadonlyArray<string>,
  additions: ReadonlyArray<string>,
): ReadonlyArray<string> {
  const seen = new Set(existing.map((example) => example.toLowerCase()));
  const merged = [...existing];

  for (const addition of additions) {
    const key = addition.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(addition);
    }
  }

  return merged;
}

function applyFoodEntryEnrichment(entry: FoodRegistryEntry): FoodRegistryEntry {
  const enrichment = FOOD_ENTRY_ENRICHMENTS.get(entry.canonical);
  if (!enrichment) return entry;

  const { addExamples, ...metadata } = enrichment;

  return {
    ...entry,
    ...(addExamples
      ? { examples: mergeExamples(entry.examples, addExamples) }
      : {}),
    ...metadata,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Combined registry
// ─────────────────────────────────────────────────────────────────────────────

const BASE_FOOD_REGISTRY: ReadonlyArray<FoodRegistryEntry> = [
  ...ZONE_1A,
  ...ZONE_1B,
  ...ZONE_2,
  ...ZONE_3,
];

export const FOOD_REGISTRY: ReadonlyArray<FoodRegistryEntry> =
  BASE_FOOD_REGISTRY.map(applyFoodEntryEnrichment);

function isFoodLineInGroup(group: FoodGroup, line: FoodLine): boolean {
  return (FOOD_GROUP_LINES[group] as ReadonlyArray<FoodLine>).includes(line);
}

function assertFoodRegistryInvariants(
  registry: ReadonlyArray<FoodRegistryEntry>,
): void {
  const canonicals = new Set<string>();
  const lineOrders = new Map<FoodLine, Map<number, string>>();

  for (const entry of registry) {
    if (canonicals.has(entry.canonical)) {
      throw new Error(
        `Duplicate canonical found in FOOD_REGISTRY: ${entry.canonical}`,
      );
    }
    canonicals.add(entry.canonical);

    if (entry.zone === 1 && entry.subzone === undefined) {
      throw new Error(
        `Zone 1 registry entry is missing a subzone: ${entry.canonical}`,
      );
    }
    if (entry.zone !== 1 && entry.subzone !== undefined) {
      throw new Error(
        `Only Zone 1 entries may declare subzone: ${entry.canonical}`,
      );
    }
    if (!isFoodLineInGroup(entry.group, entry.line)) {
      throw new Error(
        `Invalid group/line combination in FOOD_REGISTRY: ${entry.canonical} (${entry.group} -> ${entry.line})`,
      );
    }
    if (!Number.isInteger(entry.lineOrder) || entry.lineOrder < 0) {
      throw new Error(
        `Invalid lineOrder for FOOD_REGISTRY entry "${entry.canonical}": ${entry.lineOrder}`,
      );
    }
    if (entry.examples.length === 0) {
      throw new Error(
        `Registry entry must define at least one example: ${entry.canonical}`,
      );
    }

    const lineOrderMap =
      lineOrders.get(entry.line) ?? new Map<number, string>();
    const existingLineOrderOwner = lineOrderMap.get(entry.lineOrder);
    if (existingLineOrderOwner && existingLineOrderOwner !== entry.canonical) {
      throw new Error(
        `Duplicate lineOrder ${entry.lineOrder} on ${entry.line}: ${existingLineOrderOwner} and ${entry.canonical}`,
      );
    }
    lineOrderMap.set(entry.lineOrder, entry.canonical);
    lineOrders.set(entry.line, lineOrderMap);
  }
}

assertFoodRegistryInvariants(FOOD_REGISTRY);

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/shared/foodRegistryUtils.ts

/**
 * Food Registry Utilities — lookup, search, and display functions
 * that operate on the canonical food registry.
 *
 * All data definitions live in foodRegistryData.ts.
 * This file imports the registry and provides O(1) lookups + helpers.
 */

import type {
  FoodDigestionMetadata,
  FoodGroup,
  FoodLine,
  FoodRegistryEntry,
  FoodZone,
} from "./foodRegistryData";
import { FOOD_GROUP_LINES, FOOD_REGISTRY } from "./foodRegistryData";

/**
 * All canonical food names as a Set for O(1) membership checks.
 */
export const CANONICAL_FOOD_NAMES: ReadonlySet<string> = new Set(
  FOOD_REGISTRY.map((e) => e.canonical),
);

/**
 * O(1) lookup map from canonical name to registry entry.
 * Built once at module load.
 */
const FOOD_ENTRY_MAP: ReadonlyMap<string, FoodRegistryEntry> = new Map(
  FOOD_REGISTRY.map((e) => [e.canonical, e]),
);

export function pickFoodDigestionMetadata(
  source: FoodDigestionMetadata,
): FoodDigestionMetadata | undefined {
  const metadata: FoodDigestionMetadata = {
    ...(source.osmoticEffect !== undefined && {
      osmoticEffect: source.osmoticEffect,
    }),
    ...(source.totalResidue !== undefined && {
      totalResidue: source.totalResidue,
    }),
    ...(source.fiberTotalApproxG !== undefined && {
      fiberTotalApproxG: source.fiberTotalApproxG,
    }),
    ...(source.fiberInsolubleLevel !== undefined && {
      fiberInsolubleLevel: source.fiberInsolubleLevel,
    }),
    ...(source.fiberSolubleLevel !== undefined && {
      fiberSolubleLevel: source.fiberSolubleLevel,
    }),
    ...(source.gasProducing !== undefined && {
      gasProducing: source.gasProducing,
    }),
    ...(source.dryTexture !== undefined && {
      dryTexture: source.dryTexture,
    }),
    ...(source.irritantLoad !== undefined && {
      irritantLoad: source.irritantLoad,
    }),
    ...(source.highFatRisk !== undefined && {
      highFatRisk: source.highFatRisk,
    }),
    ...(source.lactoseRisk !== undefined && {
      lactoseRisk: source.lactoseRisk,
    }),
  };

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

export function isCanonicalFood(name: string): boolean {
  return CANONICAL_FOOD_NAMES.has(name);
}

export function getFoodEntry(canonical: string): FoodRegistryEntry | undefined {
  return FOOD_ENTRY_MAP.get(canonical);
}

export function getFoodDigestionMetadata(canonical: string): FoodDigestionMetadata | undefined {
  const entry = getFoodEntry(canonical);
  return entry ? pickFoodDigestionMetadata(entry) : undefined;
}

export function getFoodZone(canonical: string): FoodZone | undefined {
  return getFoodEntry(canonical)?.zone;
}

export function getFoodsByZone(zone: FoodZone): ReadonlyArray<FoodRegistryEntry> {
  return FOOD_REGISTRY.filter((e) => e.zone === zone);
}

// ── GROUP → LINE mapping ──────────────────────────────────────────────────

export const FOOD_GROUPS: ReadonlyArray<FoodGroup> = Object.freeze(
  Object.keys(FOOD_GROUP_LINES) as FoodGroup[],
);

export const FOOD_LINES: ReadonlyArray<FoodLine> = Object.freeze(
  Object.values(FOOD_GROUP_LINES).flatMap((lines) => [...lines]) as FoodLine[],
);

export function getFoodGroup(canonical: string): FoodGroup | undefined {
  return getFoodEntry(canonical)?.group;
}

export function getFoodLine(canonical: string): FoodLine | undefined {
  return getFoodEntry(canonical)?.line;
}

export function getFoodsByLine(line: FoodLine): ReadonlyArray<FoodRegistryEntry> {
  return FOOD_REGISTRY.filter((e) => e.line === line).sort((a, b) => a.lineOrder - b.lineOrder);
}

export function getLinesByGroup(group: FoodGroup): ReadonlyArray<FoodLine> {
  return FOOD_GROUP_LINES[group];
}

export function getLineDisplayName(line: FoodLine): string {
  const names: Record<FoodLine, string> = {
    meat_fish: "Meat & Fish",
    eggs_dairy: "Eggs & Dairy",
    vegetable_protein: "Vegetable Protein",
    grains: "Grains",
    vegetables: "Vegetables",
    fruit: "Fruit",
    oils: "Oils",
    dairy_fats: "Dairy Fats",
    nuts_seeds: "Nuts & Seeds",
    sauces_condiments: "Sauces & Condiments",
    herbs_spices: "Herbs & Spices",
  };
  return names[line];
}

export function getGroupDisplayName(group: FoodGroup): string {
  const names: Record<FoodGroup, string> = {
    protein: "Protein",
    carbs: "Carbs",
    fats: "Fats",
    seasoning: "Seasoning",
  };
  return names[group];
}

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/shared/foodNormalize.ts

/**
 * Shared food name normalisation utilities.
 *
 * Every food name that becomes a grouping key must pass through
 * `normalizeFoodName` so that "Cottage Cheese", "cottage cheese",
 * and "cottage  cheese" all resolve to the same key.
 */

/**
 * Words that should NOT be de-pluralised because the singular form
 * is a different word or the trailing "s" is part of the root.
 */
const KEEP_PLURAL = new Set([
  "hummus",
  "couscous",
  "asparagus",
  "citrus",
  "pancreas",
  "diabetes",
  "lens",
  "plus",
  "gas",
  "lass",
  "bass",
  "mass",
  "glass",
  "grass",
  "class",
  "molasses",
  "swiss",
  "aioli",
  "broccoli",
]);

/**
 * Explicit plural → singular overrides for common food words where
 * simple suffix stripping produces the wrong result.
 */
const PLURAL_OVERRIDES: ReadonlyMap<string, string> = new Map([
  ["berries", "berry"],
  ["cherries", "cherry"],
  ["strawberries", "strawberry"],
  ["blueberries", "blueberry"],
  ["raspberries", "raspberry"],
  ["blackberries", "blackberry"],
  ["cranberries", "cranberry"],
  ["calories", "calorie"],
  ["cookies", "cookie"],
  ["brownies", "brownie"],
  ["smoothies", "smoothie"],
  ["potatoes", "potato"],
  ["tomatoes", "tomato"],
  ["mangoes", "mango"],
  ["avocados", "avocado"],
  ["tortillas", "tortilla"],
  ["leaves", "leaf"],
  ["cheeses", "cheese"],
  ["loaves", "loaf"],
  ["halves", "half"],
  ["knives", "knife"],
]);

/**
 * Basic singularisation for a single word.
 * Catches ~90% of common food plurals without any NLP dependency.
 */
function singularizeWord(word: string): string {
  if (word.length <= 3) return word;
  if (KEEP_PLURAL.has(word)) return word;

  // Check explicit overrides first
  const override = PLURAL_OVERRIDES.get(word);
  if (override) return override;

  // "ies" → "y" (e.g., "pastries" → "pastry") — but not "series"
  if (word.endsWith("ies") && word.length > 4) {
    return `${word.slice(0, -3)}y`;
  }

  // "ves" → "f" (e.g., "halves" → "half") — already handled by overrides
  // but catch remaining cases
  if (word.endsWith("ves") && word.length > 4) {
    return `${word.slice(0, -3)}f`;
  }

  // "ses" / "xes" / "zes" / "ches" / "shes" — drop "es"
  if (
    word.endsWith("ses") ||
    word.endsWith("xes") ||
    word.endsWith("zes") ||
    word.endsWith("ches") ||
    word.endsWith("shes")
  ) {
    return word.slice(0, -2);
  }

  // "oes" → "o" (e.g., "tomatoes" → "tomato") — already in overrides
  // but catch remaining cases
  if (word.endsWith("oes") && word.length > 4) {
    return word.slice(0, -2);
  }

  // General trailing "s" — but not "ss" (e.g., "grass", "bass")
  if (word.endsWith("s") && !word.endsWith("ss") && !word.endsWith("us")) {
    return word.slice(0, -1);
  }

  return word;
}

/**
 * Singularise a multi-word food name. Only the last word is singularised
 * because that's the noun in most food phrases (e.g., "chicken wings" → "chicken wing").
 */
function singularize(name: string): string {
  const words = name.split(" ");
  if (words.length === 0) return name;

  const lastIndex = words.length - 1;
  words[lastIndex] = singularizeWord(words[lastIndex]);

  return words.join(" ");
}

const QUANTITY_PREFIX =
  /^\d+\s*(g|grams?|ml|oz|cups?|tbsp|tsp|pieces?|slices?|servings?)\s+(of\s+)?/i;

/** Standalone unit words at start of string, with or without a leading digit. */
const STANDALONE_UNIT_PREFIX =
  /^(g|mg|kg|grams?|kilograms?|ml|millilitres?|milliliters?|l|litres?|liters?|oz|ounces?|lb|pounds?|tsp|teaspoons?|tbsp|tablespoons?|cups?|pieces?|pcs?|pc|slices?|sl|servings?)\s+(of\s+)?/i;

const FILLER_WORDS = new Set([
  "plain",
  "fresh",
  "organic",
  "homemade",
  "natural",
  "some",
  "a",
  "the",
  "free",
]);

/**
 * Multi-word filler phrases to strip before single-word filler stripping.
 * Order matters: longer phrases first.
 */
const FILLER_PHRASES = ["lactose free", "gluten free", "sugar free", "fat free", "dairy free"];

/** Word-form numbers that appear as quantities ("six crackers", "two eggs"). */
const WORD_NUMBERS = new Set([
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "half",
]);

const SYNONYM_MAP: ReadonlyMap<string, string> = new Map([
  ["mashed potato", "pureed potato"],
  ["yoghurt", "yogurt"],
  ["natural yogurt", "yogurt"],
  ["plain yogurt", "yogurt"],
]);

function stripQuantityPrefix(name: string): string {
  return name.replace(QUANTITY_PREFIX, "");
}

function stripFillerWords(name: string): string {
  return name
    .split(" ")
    .filter((word) => !FILLER_WORDS.has(word))
    .join(" ");
}

function applySynonyms(name: string): string {
  return SYNONYM_MAP.get(name) ?? name;
}

/**
 * Normalise a food name into a canonical grouping key.
 *
 * - Trims whitespace and lowercases
 * - Collapses multiple spaces to a single space
 * - Strips leading quantity prefixes (e.g., "200g of" or "5 slices")
 * - Strips filler words (plain, fresh, organic) but keeps preparation words (fried, boiled, mashed)
 * - Applies synonym mapping for known equivalents
 * - Basic singularisation of the last word
 *
 * The result is suitable for use as a Map key to group food trials.
 */
export function normalizeFoodName(value: string): string {
  let cleaned = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
  if (!cleaned) return cleaned;

  // Strip leading punctuation (/, -, *, #, .)
  cleaned = cleaned.replace(/^[/\-.*#]+\s*/, "");
  // Strip trailing punctuation (periods, commas, semicolons, etc.)
  cleaned = cleaned.replace(/[.,;:!?]+$/, "");
  // Normalize hyphens to spaces
  cleaned = cleaned.replace(/-/g, " ").replace(/\s+/g, " ").trim();

  if (!cleaned) return cleaned;

  // Strip "200g of" style prefixes (digit + unit)
  cleaned = stripQuantityPrefix(cleaned).trim();
  // Strip standalone unit words without digits ("grams of", "tsp", "g")
  cleaned = cleaned.replace(STANDALONE_UNIT_PREFIX, "").trim();
  // Strip leading word-form numbers ("six crackers" → "crackers")
  const firstWord = cleaned.split(" ")[0];
  if (firstWord && WORD_NUMBERS.has(firstWord) && cleaned.includes(" ")) {
    cleaned = cleaned.slice(firstWord.length).trim();
  }
  // Strip percentage patterns ("85% cocoa" → "", "50% fat" → "")
  cleaned = cleaned.replace(/\d+%\s*\w*/g, "").trim();
  // Strip multi-word filler phrases ("lactose free cheese" → "cheese")
  for (const phrase of FILLER_PHRASES) {
    cleaned = cleaned.replace(new RegExp(`\\b${phrase}\\b`, "gi"), "").trim();
  }

  cleaned = stripFillerWords(cleaned).trim();
  cleaned = cleaned.replace(/\s+/g, " ");
  if (!cleaned) return cleaned;
  cleaned = singularize(cleaned);
  return applySynonyms(cleaned);
}

/**
 * Format a food name for display: title-case each word.
 */
export function formatFoodDisplayName(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

// Display name overrides for canonicals where title-casing alone is insufficient
const CANONICAL_DISPLAY_OVERRIDES: ReadonlyMap<string, string> = new Map([
  ["toast", "White Toast"],
]);

export function formatCanonicalFoodDisplayName(value: string): string {
  const key = value.trim().toLowerCase();
  return CANONICAL_DISPLAY_OVERRIDES.get(key) ?? formatFoodDisplayName(value);
}

// ---------------------------------------------------------------------------
// Shared summary-comparison utility (used by computeAggregates + aggregateQueries)
// ---------------------------------------------------------------------------

/**
 * Given two foodTrialSummary rows that resolve to the same canonical name,
 * determine whether `candidate` should be preferred over `existing`.
 *
 * Tiebreakers (in order):
 * 1. Exact canonical name match wins over a non-exact match.
 * 2. Most recently updated (updatedAt, falling back to _creationTime).
 * 3. Most recently assessed (lastAssessedAt).
 * 4. Most recently created (_creationTime).
 */
export function prefersSummaryCandidate<
  T extends {
    _creationTime: number;
    canonicalName: string;
    updatedAt?: number;
    lastAssessedAt?: number;
  },
>(candidate: T, existing: T, normalizedCanonicalName: string): boolean {
  const candidateExact = candidate.canonicalName === normalizedCanonicalName;
  const existingExact = existing.canonicalName === normalizedCanonicalName;
  if (candidateExact !== existingExact) return candidateExact;

  const candidateUpdatedAt = candidate.updatedAt ?? candidate._creationTime;
  const existingUpdatedAt = existing.updatedAt ?? existing._creationTime;
  if (candidateUpdatedAt !== existingUpdatedAt) {
    return candidateUpdatedAt > existingUpdatedAt;
  }

  const candidateLastAssessedAt = candidate.lastAssessedAt ?? 0;
  const existingLastAssessedAt = existing.lastAssessedAt ?? 0;
  if (candidateLastAssessedAt !== existingLastAssessedAt) {
    return candidateLastAssessedAt > existingLastAssessedAt;
  }

  return candidate._creationTime > existing._creationTime;
}

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/shared/foodTypes.ts

/**
 * Shared food-system type definitions.
 *
 * These types are used by both the client (src/) and server (convex/) sides.
 * They live in shared/ so that foodEvidence.ts (also in shared/) can import
 * them without reaching into src/types/domain.ts.
 *
 * The canonical copy of these types lives HERE. src/types/domain.ts re-exports
 * them for backward compatibility with existing client-side imports.
 */

export interface TransitCalibration {
  source: "default" | "learned";
  centerMinutes: number;
  spreadMinutes: number;
  sampleSize: number;
  learnedAt: number | null;
}

export type FoodPrimaryStatus = "building" | "safe" | "watch" | "avoid";
export type FoodTendency = "neutral" | "loose" | "hard";
export type FoodAssessmentVerdict = "safe" | "watch" | "avoid" | "trial_next";
export type FoodAssessmentConfidence = "low" | "medium" | "high";
export type FoodAssessmentCausalRole = "primary" | "possible" | "unlikely";
export type FoodAssessmentChangeType = "new" | "upgraded" | "downgraded" | "unchanged";

---

