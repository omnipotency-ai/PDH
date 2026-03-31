# Model guide

**Total Files Included:** 44

## Included Files
- /Users/peterjamesblizzard/projects/caca_traca/src/pages/Patterns.tsx
- /Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/transit-map/TransitMap.tsx
- /Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/transit-map/useTransitScene.ts
- /Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/transit-map/useStationArtwork.ts
- /Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/transit-map/TransitMapInspector.tsx
- /Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/transit-map/IntersectionNode.tsx
- /Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/transit-map/StationTooltip.tsx
- /Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/transit-map/TrackSegment.tsx
- /Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/transit-map/StationMarker.tsx
- /Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/transit-map/ZoneCard.tsx
- /Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/transit-map/constants.ts
- /Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/transit-map/types.ts
- /Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/transit-map/utils.ts
- /Users/peterjamesblizzard/projects/caca_traca/src/data/transitData.ts
- /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/avocado.png
- /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/baked_sweet_potato.png
- /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/beef_steak.png
- /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/bread_basket.png
- /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/cinnamon.png
- /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/clear_broth.png
- /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/cottage_cheese.png
- /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/french_fries.png
- /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/fresh_banana.png
- /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/fresh_broccoli.png
- /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/golden_toast.png
- /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/green_herbs.png
- /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/honey_pot.png
- /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/leafy_greens.png
- /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/mashed_potatoes.png
- /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/mixed_berries.png
- /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/onion_group.png
- /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/pepper.png
- /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/pork_chop.png
- /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/poultry_drumstick.png
- /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/raw_carrot.png
- /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/raw_potato.png
- /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/raw_zucchini.png
- /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/rice_bowl.png
- /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/salmon_fillet.png
- /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/soft_boiled_egg.png
- /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/spaghetti_pasta.png
- /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/wedge_of_cheese.png
- /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/white_fish.png
- /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/yogurt_pot.png

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

## Source File: /Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/transit-map/TransitMap.tsx

import {
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { MAIN_CATEGORIES, type MainCategory } from "@/data/transitData";
import {
  INTERCHANGE_A,
  INTERCHANGE_B,
  MAP_BACKGROUND,
  STATUS_ORDER,
  SVG_VIEWBOX,
  TRACK_COLOR_STROKE,
  TRACK_SHADOW_STROKE,
  ZONE_CARDS,
} from "./constants";
import { IntersectionNode } from "./IntersectionNode";
import { StationTooltip } from "./StationTooltip";
import { TrackSegment } from "./TrackSegment";
import { StatusPill, TransitMapInspector } from "./TransitMapInspector";
import type { TooltipState } from "./types";
import { useStationArtwork } from "./useStationArtwork";
import { collectSubLineStations, useTransitScene } from "./useTransitScene";
import { clamp, getCategoryShortLabel } from "./utils";
import { ZoneCard } from "./ZoneCard";

export default function TransitMap() {
  const [activeCategoryId, setActiveCategoryId] = useState(
    MAIN_CATEGORIES[0]?.id ?? "",
  );
  const [activeSubLineId, setActiveSubLineId] = useState(
    MAIN_CATEGORIES[0]?.subLines[0]?.id ?? "",
  );
  const [selectedStationId, setSelectedStationId] = useState<string | null>(
    null,
  );
  const [hoveredStationId, setHoveredStationId] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgIdPrefix = useId().replace(/:/g, "");

  const activeCategory =
    MAIN_CATEGORIES.find((category) => category.id === activeCategoryId) ??
    MAIN_CATEGORIES[0];
  const activeSubLine =
    activeCategory?.subLines.find(
      (subLine) => subLine.id === activeSubLineId,
    ) ?? activeCategory?.subLines[0];

  // Collect stations from SubLine data (no scene needed) for artwork loading.
  const stationsForArtwork = useMemo(
    () => collectSubLineStations(activeSubLine),
    [activeSubLine],
  );

  // Lazy-load artwork images for the current subline's stations.
  const artworkUrls = useStationArtwork(stationsForArtwork);

  // Build the positioned scene using the loaded artwork URLs.
  const { positionedTracks, stationLookup, counts, defaultStation } =
    useTransitScene(activeSubLine, artworkUrls);

  useEffect(() => {
    if (!activeCategory) return;
    if (
      activeCategory.subLines.some((subLine) => subLine.id === activeSubLineId)
    )
      return;
    setActiveSubLineId(activeCategory.subLines[0]?.id ?? "");
  }, [activeCategory, activeSubLineId]);

  useEffect(() => {
    setSelectedStationId(defaultStation?.station.id ?? null);
    setHoveredStationId(null);
    setTooltip(null);
  }, [defaultStation?.station.id]);

  const activeStation =
    (hoveredStationId ? stationLookup.get(hoveredStationId) : undefined) ??
    (selectedStationId ? stationLookup.get(selectedStationId) : undefined) ??
    defaultStation;

  const testedCount =
    counts.safe + counts.testing + counts.watch + counts.avoid;

  const updateTooltip = useCallback(
    (stationId: string, event: ReactMouseEvent<SVGGElement>) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const nextX = clamp(event.clientX - rect.left + 14, 18, rect.width - 210);
      const nextY = clamp(event.clientY - rect.top - 70, 18, rect.height - 86);
      setTooltip({ x: nextX, y: nextY, stationId });
    },
    [],
  );

  const handleStationHover = useCallback(
    (stationId: string, event: ReactMouseEvent<SVGGElement>) => {
      setHoveredStationId(stationId);
      updateTooltip(stationId, event);
    },
    [updateTooltip],
  );

  const handleStationMove = useCallback(
    (stationId: string, event: ReactMouseEvent<SVGGElement>) => {
      updateTooltip(stationId, event);
    },
    [updateTooltip],
  );

  const handleStationLeave = useCallback(() => {
    setHoveredStationId(null);
    setTooltip(null);
  }, []);

  const handleCategoryChange = useCallback((category: MainCategory) => {
    setActiveCategoryId(category.id);
    setActiveSubLineId(category.subLines[0]?.id ?? "");
  }, []);

  if (!activeCategory || !activeSubLine || !activeStation) {
    return (
      <section
        data-slot="transit-map-redesign"
        className="flex items-center justify-center p-8"
      >
        <p className="text-sm text-slate-400">No transit data available.</p>
      </section>
    );
  }

  const [zoneOne, zoneTwo, zoneThree] = activeSubLine.zones;
  if (!zoneOne || !zoneTwo || !zoneThree) {
    return (
      <section
        data-slot="transit-map-redesign"
        className="flex items-center justify-center p-8"
      >
        <p className="text-sm text-slate-400">No transit data available.</p>
      </section>
    );
  }

  const tooltipStation = tooltip
    ? stationLookup.get(tooltip.stationId)
    : undefined;
  const softShadowId = `${svgIdPrefix}-soft-shadow`;

  return (
    <section
      data-slot="transit-map-redesign"
      className="relative overflow-hidden rounded-[30px] border border-white/10 text-slate-50 shadow-[0_40px_120px_rgba(2,6,23,0.45)]"
      style={{ background: MAP_BACKGROUND }}
    >
      <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)] bg-[size:54px_54px] opacity-20" />
      <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_68%)] opacity-60" />

      <style>{`
        @keyframes transit-pulse {
          0% { opacity: 0.72; transform: scale(1); }
          70% { opacity: 0; transform: scale(1.55); }
          100% { opacity: 0; transform: scale(1.55); }
        }
      `}</style>

      <div className="relative grid gap-5 p-4 md:p-6 xl:grid-cols-[220px_minmax(0,1fr)_320px]">
        {/* Mobile sidebar */}
        <aside className="xl:hidden">
          <div className="grid gap-3">
            <div className="rounded-[24px] border border-white/10 bg-[#06101b]/88 p-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
                Transit Atlas
              </p>
              <h2 className="mt-3 font-display text-3xl font-bold text-slate-50">
                Food Lines
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Visual reference of the food reintroduction map with stations
                grouped by zone and line.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[24px] border border-white/10 bg-[#06101b]/88 p-3.5">
                <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
                  Status Key
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-2">
                    {STATUS_ORDER.slice(0, 3).map((status) => (
                      <StatusPill key={status} status={status} />
                    ))}
                  </div>
                  <div className="flex flex-col gap-2">
                    {STATUS_ORDER.slice(3).map((status) => (
                      <StatusPill key={status} status={status} />
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-[#06101b]/88 p-3.5">
                <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
                  Families
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {MAIN_CATEGORIES.map((category) => {
                    const isActive = category.id === activeCategory.id;
                    return (
                      <button
                        type="button"
                        key={category.id}
                        onClick={() => handleCategoryChange(category)}
                        className="min-w-0 rounded-full border px-1.5 py-2 text-center transition-colors"
                        style={{
                          background: isActive
                            ? `${category.accentColor}18`
                            : "rgba(255,255,255,0.04)",
                          borderColor: isActive
                            ? `${category.accentColor}42`
                            : "rgba(255,255,255,0.08)",
                        }}
                      >
                        <p
                          className="truncate font-display text-[11px] font-semibold"
                          style={{
                            color: isActive
                              ? category.accentColor
                              : "rgba(248,250,252,0.92)",
                          }}
                        >
                          {getCategoryShortLabel(category)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Desktop sidebar */}
        <aside className="hidden xl:flex xl:flex-col xl:gap-4">
          <div className="rounded-[24px] border border-white/10 bg-[#06101b]/88 p-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
              Transit Atlas
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold text-slate-50">
              Food Lines
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Visual reference of the food reintroduction map with stations
              grouped by zone and line.
            </p>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-[#06101b]/88 p-3">
            <p className="px-2 font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
              Families
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2">
              {MAIN_CATEGORIES.map((category) => {
                const isActive = category.id === activeCategory.id;
                return (
                  <button
                    type="button"
                    key={category.id}
                    onClick={() => handleCategoryChange(category)}
                    className="rounded-[18px] border px-4 py-3 text-left transition-colors"
                    style={{
                      background: isActive
                        ? `${category.accentColor}18`
                        : "rgba(255,255,255,0.04)",
                      borderColor: isActive
                        ? `${category.accentColor}42`
                        : "rgba(255,255,255,0.08)",
                    }}
                  >
                    <p
                      className="font-display text-lg font-semibold"
                      style={{
                        color: isActive
                          ? category.accentColor
                          : "rgba(248,250,252,0.92)",
                      }}
                    >
                      {category.name}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                      {category.subLines.length} lines
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-[#06101b]/88 p-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
              Status Key
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {STATUS_ORDER.map((status) => (
                <StatusPill key={status} status={status} />
              ))}
            </div>
          </div>
        </aside>

        {/* Main content area */}
        <div className="min-w-0 flex flex-col gap-4">
          <header className="overflow-hidden rounded-[26px] border border-white/10 bg-[#06101b]/88 p-5">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
                  Active Corridor
                </p>
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <h3 className="font-display text-4xl font-bold text-slate-50">
                    {activeSubLine.name}
                  </h3>
                  <span
                    className="rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em]"
                    style={{
                      color: activeCategory.accentColor,
                      borderColor: `${activeCategory.accentColor}34`,
                      background: `${activeCategory.accentColor}12`,
                    }}
                  >
                    {activeCategory.name}
                  </span>
                </div>
                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">
                  Tap a station to inspect its details. Zones progress from safe
                  foods to more experimental options.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  {
                    label: "Stops",
                    value: `${positionedTracks.flatMap((track) => track.stations).length}`,
                  },
                  { label: "Tested", value: `${testedCount}` },
                  { label: "Safe", value: `${counts.safe}` },
                  { label: "At Risk", value: `${counts.watch + counts.avoid}` },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-[18px] border border-white/8 bg-white/4 px-4 py-3"
                  >
                    <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500">
                      {item.label}
                    </p>
                    <p className="mt-2 font-display text-2xl font-bold text-slate-50">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {activeCategory.subLines.map((subLine) => {
                const isActive = subLine.id === activeSubLine.id;
                return (
                  <button
                    type="button"
                    key={subLine.id}
                    onClick={() => setActiveSubLineId(subLine.id)}
                    className="rounded-full border px-4 py-2 text-sm font-semibold transition-colors"
                    style={{
                      background: isActive
                        ? `${subLine.color}1f`
                        : "rgba(255,255,255,0.04)",
                      borderColor: isActive
                        ? `${subLine.color}50`
                        : "rgba(255,255,255,0.08)",
                      color: isActive
                        ? subLine.color
                        : "rgba(226,232,240,0.72)",
                    }}
                  >
                    {subLine.name}
                  </button>
                );
              })}
            </div>
          </header>

          <div
            ref={containerRef}
            className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#040a13]/90 p-2"
          >
            <div className="px-2 pb-2 md:hidden">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
                Swipe left or right to explore the full line map
              </p>
            </div>
            <div className="max-w-full overflow-x-auto overflow-y-hidden pb-2 touch-pan-x">
              <svg
                viewBox={`0 0 ${SVG_VIEWBOX.width} ${SVG_VIEWBOX.height}`}
                className="min-h-[34rem] w-[1220px] max-w-none sm:w-[1320px] md:w-full md:max-w-full"
                preserveAspectRatio="xMidYMid meet"
              >
                <title>{`${activeCategory.name} ${activeSubLine.name} transit map`}</title>

                <defs>
                  <filter id={softShadowId}>
                    <feDropShadow
                      dx="0"
                      dy="18"
                      stdDeviation="18"
                      floodColor="#020617"
                      floodOpacity="0.4"
                    />
                  </filter>
                  <clipPath id={`${svgIdPrefix}-frame-clip`}>
                    <rect
                      x="0"
                      y="0"
                      width={SVG_VIEWBOX.width}
                      height={SVG_VIEWBOX.height}
                      rx="36"
                    />
                  </clipPath>
                  {positionedTracks.flatMap((track) =>
                    track.stations.map((station) => (
                      <clipPath
                        id={`${svgIdPrefix}-${station.station.id}`}
                        key={`${track.key}-${station.station.id}-clip`}
                        clipPathUnits="objectBoundingBox"
                      >
                        <circle cx="0.5" cy="0.5" r="0.5" />
                      </clipPath>
                    )),
                  )}
                </defs>

                <g clipPath={`url(#${svgIdPrefix}-frame-clip)`}>
                  <rect
                    width={SVG_VIEWBOX.width}
                    height={SVG_VIEWBOX.height}
                    fill="transparent"
                  />

                  <ZoneCard zone={zoneOne} index={0} rect={ZONE_CARDS.one} />
                  <ZoneCard zone={zoneTwo} index={1} rect={ZONE_CARDS.two} />
                  <ZoneCard
                    zone={zoneThree}
                    index={2}
                    rect={ZONE_CARDS.three}
                  />

                  {/* Interchange trunk segment */}
                  <path
                    d={`M ${INTERCHANGE_B.x} ${INTERCHANGE_B.y} H 882`}
                    stroke="rgba(4, 9, 18, 0.88)"
                    strokeWidth={TRACK_SHADOW_STROKE}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d={`M ${INTERCHANGE_B.x} ${INTERCHANGE_B.y} H 882`}
                    stroke={activeSubLine.color}
                    strokeWidth={TRACK_COLOR_STROKE}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {positionedTracks.map((track) => (
                    <TrackSegment
                      key={track.key}
                      track={track}
                      lineColor={activeSubLine.color}
                      svgIdPrefix={svgIdPrefix}
                      softShadowId={softShadowId}
                      selectedStationId={selectedStationId}
                      hoveredStationId={hoveredStationId}
                      onStationHover={handleStationHover}
                      onStationMove={handleStationMove}
                      onStationLeave={handleStationLeave}
                      onStationSelect={setSelectedStationId}
                    />
                  ))}

                  <IntersectionNode
                    x={INTERCHANGE_A.x}
                    y={INTERCHANGE_A.y}
                    color={activeSubLine.color}
                  />
                  <IntersectionNode
                    x={INTERCHANGE_B.x}
                    y={INTERCHANGE_B.y}
                    color={activeSubLine.color}
                  />

                  <g
                    transform={`translate(${INTERCHANGE_A.x - 38}, ${INTERCHANGE_A.y - 92})`}
                  >
                    <rect
                      width={94}
                      height={24}
                      rx={12}
                      fill="rgba(4, 9, 18, 0.78)"
                      stroke={`${activeSubLine.color}35`}
                    />
                    <text
                      x={47}
                      y={16}
                      textAnchor="middle"
                      fontFamily="var(--font-mono)"
                      fontSize={10}
                      letterSpacing={1.6}
                      fill={activeSubLine.color}
                    >
                      INTERCHANGE
                    </text>
                  </g>

                  {defaultStation && (
                    <g
                      transform={`translate(${defaultStation.x + 42}, ${defaultStation.y - 58})`}
                    >
                      <rect
                        width={134}
                        height={44}
                        rx={18}
                        fill="rgba(4, 9, 18, 0.88)"
                        stroke="rgba(74, 222, 128, 0.35)"
                      />
                      <text
                        x={16}
                        y={17}
                        fontFamily="var(--font-mono)"
                        fontSize={10}
                        letterSpacing={1.6}
                        fill="#86efac"
                      >
                        YOU ARE HERE
                      </text>
                      <text
                        x={16}
                        y={32}
                        fontFamily="var(--font-display)"
                        fontSize={14}
                        fontWeight={700}
                        fill="rgba(248, 250, 252, 0.96)"
                      >
                        {defaultStation.station.name}
                      </text>
                    </g>
                  )}
                </g>
              </svg>
            </div>

            {tooltip && tooltipStation && (
              <StationTooltip tooltip={tooltip} station={tooltipStation} />
            )}
          </div>
        </div>

        <TransitMapInspector
          activeStation={activeStation}
          selectedStationId={selectedStationId ?? activeStation.station.id}
          onSelectStation={setSelectedStationId}
        />
      </div>
    </section>
  );
}

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/transit-map/useTransitScene.ts

import { useMemo } from "react";
import type { Station, SubLine, Track, Zone } from "@/data/transitData";
import { INTERCHANGE_A, INTERCHANGE_B } from "./constants";
import type { PositionedStation, PositionedTrack, StatusCounts } from "./types";
import { resolveArtworkKey } from "./useStationArtwork";
import { distribute, makeStatusCounts } from "./utils";

function createPositionedStation({
  station,
  zone,
  track,
  subLine,
  x,
  y,
  artworkUrls,
}: {
  station: Station;
  zone: Zone;
  track: Track;
  subLine: SubLine;
  x: number;
  y: number;
  artworkUrls: Record<string, string>;
}): PositionedStation {
  const artworkKey = resolveArtworkKey(station);
  const imageSrc = artworkKey !== undefined ? artworkUrls[artworkKey] : undefined;

  return {
    station,
    zone,
    track,
    subLine,
    x,
    y,
    ...(imageSrc !== undefined && { imageSrc }),
  };
}

function buildScene(subLine: SubLine, artworkUrls: Record<string, string>): PositionedTrack[] {
  const tracks: PositionedTrack[] = [];
  const [zoneOne, zoneTwo, zoneThree] = subLine.zones;

  if (zoneOne?.tracks[0]) {
    const x = 162;
    const yPoints = distribute(192, 570, zoneOne.tracks[0].stations.length);
    tracks.push({
      key: zoneOne.tracks[0].id,
      zone: zoneOne,
      track: zoneOne.tracks[0],
      path: `M ${x} 166 V 612 Q ${x} 656 204 656 H 270 Q 312 656 312 610 V ${INTERCHANGE_A.y} H ${INTERCHANGE_A.x}`,
      chipX: 86,
      chipY: 154,
      chipAlign: "start",
      stations: zoneOne.tracks[0].stations.map((station, index) =>
        createPositionedStation({
          station,
          zone: zoneOne,
          track: zoneOne.tracks[0],
          subLine,
          x,
          y: yPoints[index] ?? 192,
          artworkUrls,
        }),
      ),
    });
  }

  if (zoneTwo?.tracks[0]) {
    const topTrack = zoneTwo.tracks[0];
    tracks.push({
      key: topTrack.id,
      zone: zoneTwo,
      track: topTrack,
      path: `M ${INTERCHANGE_A.x} ${INTERCHANGE_A.y} H 378 Q 430 ${INTERCHANGE_A.y} 468 302 H 676 Q 748 302 ${INTERCHANGE_B.x} ${INTERCHANGE_B.y}`,
      chipX: 474,
      chipY: 258,
      chipAlign: "start",
      stations: topTrack.stations.map((station, index) =>
        createPositionedStation({
          station,
          zone: zoneTwo,
          track: topTrack,
          subLine,
          x: distribute(486, 668, topTrack.stations.length)[index] ?? 486,
          y: 302,
          artworkUrls,
        }),
      ),
    });
  }

  if (zoneTwo?.tracks[1]) {
    const bottomTrack = zoneTwo.tracks[1];
    tracks.push({
      key: bottomTrack.id,
      zone: zoneTwo,
      track: bottomTrack,
      path: `M ${INTERCHANGE_A.x} ${INTERCHANGE_A.y} H 378 Q 430 ${INTERCHANGE_A.y} 468 554 H 676 Q 748 554 ${INTERCHANGE_B.x} ${INTERCHANGE_B.y}`,
      chipX: 474,
      chipY: 594,
      chipAlign: "start",
      stations: bottomTrack.stations.map((station, index) =>
        createPositionedStation({
          station,
          zone: zoneTwo,
          track: bottomTrack,
          subLine,
          x: distribute(486, 668, bottomTrack.stations.length)[index] ?? 486,
          y: 554,
          artworkUrls,
        }),
      ),
    });
  }

  if (zoneThree) {
    const trackCount = zoneThree.tracks.length;
    const offsets = distribute(-170, 170, trackCount);
    for (const [index, track] of zoneThree.tracks.entries()) {
      const rowY = INTERCHANGE_B.y + (offsets[index] ?? 0);
      const chipY = rowY < INTERCHANGE_B.y ? rowY - 30 : rowY + 42;
      const branchStartX = rowY === INTERCHANGE_B.y ? 944 : 986;
      const path =
        rowY === INTERCHANGE_B.y
          ? `M 882 ${INTERCHANGE_B.y} H 1262`
          : `M 882 ${INTERCHANGE_B.y} Q 932 ${INTERCHANGE_B.y} 986 ${rowY} H 1262`;

      tracks.push({
        key: track.id,
        zone: zoneThree,
        track,
        path,
        chipX: branchStartX,
        chipY,
        chipAlign: "start",
        stations: track.stations.map((station, stationIndex) =>
          createPositionedStation({
            station,
            zone: zoneThree,
            track,
            subLine,
            x:
              distribute(branchStartX + 58, 1226, track.stations.length)[stationIndex] ??
              branchStartX + 58,
            y: rowY,
            artworkUrls,
          }),
        ),
      });
    }
  }

  return tracks;
}

/**
 * Extract all stations from a SubLine. Used both by useTransitScene
 * and by the artwork hook (to know which images to load).
 */
export function collectSubLineStations(subLine: SubLine | undefined): Station[] {
  if (!subLine) return [];
  return subLine.zones.flatMap((zone) => zone.tracks.flatMap((track) => track.stations));
}

interface TransitScene {
  positionedTracks: PositionedTrack[];
  stationLookup: Map<string, PositionedStation>;
  counts: StatusCounts;
  defaultStation: PositionedStation | null;
}

/**
 * Hook that builds the positioned transit scene from a SubLine and loaded artwork.
 * Extracts all scene-building, station lookup, and status counting logic.
 */
export function useTransitScene(
  activeSubLine: SubLine | undefined,
  artworkUrls: Record<string, string>,
): TransitScene {
  const positionedTracks = useMemo(
    () => (activeSubLine ? buildScene(activeSubLine, artworkUrls) : []),
    [activeSubLine, artworkUrls],
  );

  const stationLookup = useMemo(() => {
    const entries = positionedTracks.flatMap((track) =>
      track.stations.map((station) => [station.station.id, station] as const),
    );
    return new Map<string, PositionedStation>(entries);
  }, [positionedTracks]);

  const counts = useMemo(() => {
    const next = makeStatusCounts();
    for (const track of positionedTracks) {
      for (const station of track.stations) {
        next[station.station.status] += 1;
      }
    }
    return next;
  }, [positionedTracks]);

  const defaultStation = useMemo(() => {
    const current = positionedTracks
      .flatMap((track) => track.stations)
      .find((station) => station.station.isCurrent);
    return current ?? positionedTracks[0]?.stations[0] ?? null;
  }, [positionedTracks]);

  return {
    positionedTracks,
    stationLookup,
    counts,
    defaultStation,
  };
}

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/transit-map/useStationArtwork.ts

import { useEffect, useRef, useState } from "react";
import type { Station } from "@/data/transitData";
import { normalizeSearchValue } from "./utils";

/**
 * Lazy glob — Vite returns a Record of () => Promise<module> functions.
 * Images are only loaded when invoked, NOT bundled into the initial JS.
 */
const ARTWORK_LOADERS = import.meta.glob("../../../assets/transit-map/*.png", {
  eager: false,
  import: "default",
}) as Record<string, () => Promise<string>>;

/**
 * Map from short key (e.g. "avocado") to its lazy loader function.
 */
const LOADER_BY_KEY = Object.fromEntries(
  Object.entries(ARTWORK_LOADERS).map(([path, loader]) => {
    const fileName = path.split("/").pop() ?? path;
    const key = fileName.replace(/\.png$/i, "");
    return [key, loader];
  }),
) as Record<string, () => Promise<string>>;

// Pre-compiled regex patterns for artwork key resolution.
// Module-level constants avoid re-compiling on every call to resolveArtworkKey.
const RX_SWEET_POTATO = /sweet potato|pumpkin/;
const RX_MASHED_POTATO = /mashed.*potato|potato.*mashed|pureed.*potato/;
const RX_POTATO = /potato/;
const RX_CARROT = /carrot/;
const RX_ZUCCHINI = /zucchini|courgette|cucumber/;
const RX_BROCCOLI = /broccoli|cauliflower/;
const RX_LEAFY = /spinach|lettuce|mixed greens|bok choy|greens|edamame|leafy/;
const RX_HERB =
  /herb|parsley|chives|dill|basil|thyme|oregano|rosemary|sage|mint|coriander|lemongrass|kaffir|fennel/;
const RX_GREEN_HERBS =
  /parsley|chives|dill|basil|thyme|oregano|rosemary|bay leaf|sage|tarragon|mint|coriander|lemongrass|kaffir|fennel/;
const RX_PEPPER = /pepper|capsicum|chilli|mustard|bbq sauce|hot sauce|worcestershire/;
const RX_ONION = /onion/;
const RX_BANANA = /banana/;
const RX_BERRIES = /strawberry|blueberry|berries/;
const RX_RICE = /rice|porridge|semolina|polenta|couscous|quinoa/;
const RX_TOAST = /toast/;
const RX_BREAD = /bread|crumpet|cracker|pretzel|muffin|biscuit|cake/;
const RX_PASTA = /pasta|spaghetti/;
const RX_CHIPS = /chip|fries|tempura/;
const RX_POULTRY = /chicken|turkey/;
const RX_SALMON = /salmon|tuna|sardine/;
const RX_FISH = /white fish|fish|prawn|crab/;
const RX_EGG = /egg/;
const RX_BEEF = /beef|lamb/;
const RX_PORK = /pork|ham|salami|sausage|bacon/;
const RX_COTTAGE_CHEESE = /cottage cheese/;
const RX_YOGURT = /yoghurt|yogurt|milk|ice cream|gelato/;
const RX_CHEESE = /ricotta|feta|mozzarella|cheddar|parmesan|gruyere|cheese|brie|camembert/;
const RX_AVOCADO = /avocado/;
const RX_CINNAMON = /cinnamon|nutmeg/;
const RX_BROTH = /broth|miso|soy sauce|oyster sauce|fish sauce/;

/**
 * Module-level cache: station ID → resolved artwork key (or null = no artwork).
 * Persists for the lifetime of the module, so repeated calls for the same station
 * (e.g. across re-renders or buildScene calls) never re-run the regex battery.
 *
 * NOTE: This cache survives HMR reloads. During development, stale entries may
 * persist across hot updates. Call `clearArtworkKeyCache()` in tests to reset.
 */
const artworkKeyCache = new Map<string, string | null>();

/**
 * Clear the module-level artwork key cache.
 * Intended for test cleanup so cached results don't leak between test cases.
 */
export function clearArtworkKeyCache(): void {
  artworkKeyCache.clear();
}

function matchArtworkKey(key: string): string | undefined {
  if (RX_SWEET_POTATO.test(key)) return "baked_sweet_potato";
  if (RX_MASHED_POTATO.test(key)) return "mashed_potatoes";
  if (RX_POTATO.test(key)) return "raw_potato";
  if (RX_CARROT.test(key)) return "raw_carrot";
  if (RX_ZUCCHINI.test(key)) return "raw_zucchini";
  if (RX_BROCCOLI.test(key)) return "fresh_broccoli";
  if (RX_LEAFY.test(key) && !RX_HERB.test(key)) return "leafy_greens";
  if (RX_GREEN_HERBS.test(key)) return "green_herbs";
  if (RX_PEPPER.test(key)) return "pepper";
  if (RX_ONION.test(key)) return "onion_group";
  if (RX_BANANA.test(key)) return "fresh_banana";
  if (RX_BERRIES.test(key)) return "mixed_berries";
  if (RX_RICE.test(key)) return "rice_bowl";
  if (RX_TOAST.test(key)) return "golden_toast";
  if (RX_BREAD.test(key)) return "bread_basket";
  if (RX_PASTA.test(key)) return "spaghetti_pasta";
  if (RX_CHIPS.test(key)) return "french_fries";
  if (RX_POULTRY.test(key)) return "poultry_drumstick";
  if (RX_SALMON.test(key)) return "salmon_fillet";
  if (RX_FISH.test(key)) return "white_fish";
  if (RX_EGG.test(key)) return "soft_boiled_egg";
  if (RX_BEEF.test(key)) return "beef_steak";
  if (RX_PORK.test(key)) return "pork_chop";
  if (RX_COTTAGE_CHEESE.test(key)) return "cottage_cheese";
  if (RX_YOGURT.test(key)) return "yogurt_pot";
  if (RX_CHEESE.test(key)) return "wedge_of_cheese";
  if (RX_AVOCADO.test(key)) return "avocado";
  if (RX_CINNAMON.test(key)) return "cinnamon";
  if (RX_BROTH.test(key)) return "clear_broth";
  return undefined;
}

/**
 * Given a station, return the artwork key it should use (or undefined).
 * Results are memoized by station ID to avoid re-running 30+ regexes on repeated calls.
 */
export function resolveArtworkKey(station: Station): string | undefined {
  const cached = artworkKeyCache.get(station.id);
  if (cached !== undefined) {
    return cached ?? undefined;
  }
  const key = normalizeSearchValue(`${station.name} ${station.preparation}`);
  const resolved = matchArtworkKey(key);
  artworkKeyCache.set(station.id, resolved ?? null);
  return resolved;
}

/**
 * Collect unique artwork keys needed for a set of stations.
 */
function collectNeededKeys(stations: Station[]): string[] {
  const keys = new Set<string>();
  for (const station of stations) {
    const artworkKey = resolveArtworkKey(station);
    if (artworkKey !== undefined) {
      keys.add(artworkKey);
    }
  }
  return Array.from(keys);
}

/**
 * Hook that lazily loads station artwork PNGs on demand.
 *
 * Given a list of stations currently visible, it loads only the images
 * needed for those stations. Returns a map from artwork key to resolved URL.
 */
export function useStationArtwork(stations: Station[]): Record<string, string> {
  const [loaded, setLoaded] = useState<Record<string, string>>({});

  // Track loaded state via ref to avoid including it in the effect dependency array.
  // Including `loaded` directly would cause an infinite re-render cycle: the effect
  // loads images -> updates `loaded` -> triggers the effect again.
  const loadedRef = useRef(loaded);
  loadedRef.current = loaded;

  useEffect(() => {
    const neededKeys = collectNeededKeys(stations);
    const currentLoaded = loadedRef.current;
    const keysToLoad = neededKeys.filter(
      (k) => currentLoaded[k] === undefined && LOADER_BY_KEY[k] !== undefined,
    );

    if (keysToLoad.length === 0) return;

    let cancelled = false;

    const loadImages = async () => {
      const results: Array<[string, string]> = [];

      await Promise.all(
        keysToLoad.map(async (artworkKey) => {
          const loader = LOADER_BY_KEY[artworkKey];
          if (!loader) return;
          try {
            const url = await loader();
            results.push([artworkKey, url]);
          } catch (error) {
            // Log but don't crash — missing artwork is non-fatal
            console.error(`Failed to load transit map artwork: ${artworkKey}`, error);
          }
        }),
      );

      if (!cancelled && results.length > 0) {
        setLoaded((prev) => {
          const next = { ...prev };
          for (const [key, url] of results) {
            next[key] = url;
          }
          return next;
        });
      }
    };

    loadImages();

    return () => {
      cancelled = true;
    };
  }, [stations]);

  return loaded;
}

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/transit-map/TransitMapInspector.tsx

import { useState } from "react";
import { type FoodStatus, STATUS_COLORS, STATUS_LABELS } from "@/data/transitData";
import type { FocusedStation } from "./types";
import { getInitials } from "./utils";

function StatusPill({ status }: { status: FoodStatus }) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
      style={{
        background: `${STATUS_COLORS[status]}18`,
        borderColor: `${STATUS_COLORS[status]}38`,
        color: STATUS_COLORS[status],
      }}
    >
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: STATUS_COLORS[status] }}
      />
      {status}
    </span>
  );
}

export { StatusPill };

interface TransitMapInspectorProps {
  activeStation: FocusedStation;
  selectedStationId: string;
  onSelectStation: (stationId: string) => void;
}

export function TransitMapInspector({
  activeStation,
  selectedStationId,
  onSelectStation,
}: TransitMapInspectorProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  return (
    <aside className="flex flex-col gap-4 xl:max-h-[46rem]">
      <div className="overflow-hidden rounded-[24px] border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface-1)_92%,transparent)]">
        <div className="relative overflow-hidden border-b border-[var(--border)] px-5 py-5">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(244,114,182,0.18),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(45,212,191,0.12),transparent_34%)]" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--text-faint)]">
                Station Inspector
              </p>
              <h3 className="mt-2 font-display text-2xl font-bold text-[var(--text)]">
                {activeStation.station.name}
              </h3>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                {activeStation.station.preparation}
              </p>
            </div>
            <StatusPill status={activeStation.station.status} />
          </div>
          <div className="relative mt-5 flex items-center gap-4">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-[22px] border border-[var(--border)] bg-[var(--surface-0)] shadow-[0_20px_50px_rgba(0,0,0,0.18)]">
              {activeStation.imageSrc ? (
                <img
                  src={activeStation.imageSrc}
                  alt={activeStation.station.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="font-mono text-2xl font-bold text-[var(--text-muted)]">
                  {getInitials(activeStation.station.name)}
                </span>
              )}
            </div>
            <div className="space-y-2 text-sm text-[var(--text-muted)]">
              <div>
                <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--text-faint)]">
                  Family
                </span>
                <p className="mt-1 font-medium text-[var(--text)]">{activeStation.subLine.name}</p>
              </div>
              <div>
                <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--text-faint)]">
                  Corridor
                </span>
                <p className="mt-1 font-medium text-[var(--text)]">
                  {activeStation.zone.name}
                  {activeStation.track.label ? ` / ${activeStation.track.label}` : " / Main"}
                </p>
              </div>
            </div>
          </div>
          {activeStation.station.isCurrent && (
            <div className="relative mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/35 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-300" />
              Current stop
            </div>
          )}
          <div className="mt-5">
            <button
              type="button"
              onClick={() => setDetailsOpen((open) => !open)}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-3)]"
            >
              <span className="inline-block h-2 w-2 rounded-full bg-[var(--text-faint)]" />
              {detailsOpen ? "Hide route details" : "Show route details"}
            </button>
            {!detailsOpen && (
              <p className="mt-3 text-sm text-[var(--text-muted)]">
                Keep the inspector clean by default. Open details for jump targets and pinned-state
                context.
              </p>
            )}
          </div>
        </div>

        {detailsOpen && (
          <div className="space-y-4 border-t border-[var(--border)] px-5 py-5">
            <div className="grid grid-cols-2 gap-3 text-sm text-[var(--text-muted)]">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--text-faint)]">
                  Status
                </p>
                <p className="mt-2 font-medium text-[var(--text)]">
                  {STATUS_LABELS[activeStation.station.status]}
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--text-faint)]">
                  Selection
                </p>
                <p className="mt-2 font-medium text-[var(--text)]">
                  {selectedStationId === activeStation.station.id
                    ? "Pinned in map"
                    : "Hover preview"}
                </p>
              </div>
            </div>

            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--text-faint)]">
                Quick Jumps
              </p>
              <div className="mt-3 max-h-[20rem] space-y-3 overflow-y-auto pr-1">
                {activeStation.subLine.zones.map((zone) => (
                  <div key={zone.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-display text-sm font-semibold text-[var(--text)]">
                        {zone.name}
                      </p>
                      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-faint)]">
                        {zone.description}
                      </span>
                    </div>
                    {zone.tracks.map((track) => (
                      <div key={track.id} className="space-y-2">
                        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-faint)]">
                          {track.label ?? "Main line"}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {track.stations.map((station) => {
                            const isSelected = station.id === selectedStationId;
                            return (
                              <button
                                type="button"
                                key={station.id}
                                onClick={() => onSelectStation(station.id)}
                                className="rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-sky-400"
                                style={{
                                  background: isSelected
                                    ? `${STATUS_COLORS[station.status]}24`
                                    : "rgba(255,255,255,0.04)",
                                  borderColor: isSelected
                                    ? `${STATUS_COLORS[station.status]}44`
                                    : "rgba(255,255,255,0.08)",
                                  color: isSelected ? "#f8fafc" : "rgba(226,232,240,0.78)",
                                }}
                              >
                                {station.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/transit-map/IntersectionNode.tsx

interface IntersectionNodeProps {
  x: number;
  y: number;
  color: string;
}

export function IntersectionNode({ x, y, color }: IntersectionNodeProps) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <circle
        r={23}
        fill="color-mix(in srgb, var(--surface-0) 96%, black 4%)"
        stroke={`${color}35`}
        strokeWidth={3}
      />
      <circle
        r={14}
        fill="color-mix(in srgb, var(--surface-1) 92%, black 8%)"
        stroke={color}
        strokeWidth={4}
      />
      <circle r={5.5} fill={color} />
    </g>
  );
}

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/transit-map/StationTooltip.tsx

import { STATUS_COLORS } from "@/data/transitData";
import type { PositionedStation, TooltipState } from "./types";

interface StationTooltipProps {
  tooltip: TooltipState;
  station: PositionedStation;
}

export function StationTooltip({ tooltip, station }: StationTooltipProps) {
  return (
    <div
      className="pointer-events-none absolute z-20 min-w-[13rem] rounded-[18px] border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface-1)_94%,transparent)] px-3.5 py-3 shadow-[0_24px_60px_rgba(2,6,23,0.24)] backdrop-blur"
      style={{ left: tooltip.x, top: tooltip.y }}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="font-display text-base font-bold text-[var(--text)]">
          {station.station.name}
        </p>
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]"
          style={{
            background: `${STATUS_COLORS[station.station.status]}18`,
            color: STATUS_COLORS[station.station.status],
          }}
        >
          {station.station.status}
        </span>
      </div>
      <p className="mt-1 text-xs text-[var(--text-muted)]">{station.station.preparation}</p>
      <div className="mt-3 flex items-center gap-2 text-[11px] text-[var(--text-faint)]">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: STATUS_COLORS[station.station.status] }}
        />
        {station.track.label ?? station.zone.name}
      </div>
    </div>
  );
}

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/transit-map/TrackSegment.tsx

import type { MouseEvent as ReactMouseEvent } from "react";
import { TRACK_COLOR_STROKE, TRACK_SHADOW_STROKE } from "./constants";
import { StationMarker } from "./StationMarker";
import type { PositionedTrack } from "./types";

interface TrackChipProps {
  label: string;
  x: number;
  y: number;
  color: string;
  align: "start" | "middle" | "end";
}

function TrackChip({ label, x, y, color, align }: TrackChipProps) {
  const width = Math.max(112, label.length * 6.9 + 30);
  const left = align === "middle" ? x - width / 2 : align === "end" ? x - width : x;

  return (
    <g transform={`translate(${left}, ${y - 14})`}>
      <rect
        width={width}
        height={28}
        rx={14}
        fill="rgba(5, 10, 20, 0.84)"
        stroke={`${color}55`}
        strokeWidth={1}
      />
      <text
        x={width / 2}
        y={17}
        textAnchor="middle"
        fontFamily="var(--font-mono)"
        fontSize={10}
        letterSpacing={1.2}
        fill={color}
      >
        {label.toUpperCase()}
      </text>
    </g>
  );
}

interface TrackSegmentProps {
  track: PositionedTrack;
  lineColor: string;
  svgIdPrefix: string;
  softShadowId: string;
  selectedStationId: string | null;
  hoveredStationId: string | null;
  onStationHover: (stationId: string, event: ReactMouseEvent<SVGGElement>) => void;
  onStationMove: (stationId: string, event: ReactMouseEvent<SVGGElement>) => void;
  onStationLeave: () => void;
  onStationSelect: (stationId: string) => void;
}

export function TrackSegment({
  track,
  lineColor,
  svgIdPrefix,
  softShadowId,
  selectedStationId,
  hoveredStationId,
  onStationHover,
  onStationMove,
  onStationLeave,
  onStationSelect,
}: TrackSegmentProps) {
  return (
    <g>
      <path
        d={track.path}
        stroke="rgba(4, 9, 18, 0.88)"
        strokeWidth={TRACK_SHADOW_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={track.path}
        stroke={lineColor}
        strokeWidth={TRACK_COLOR_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        filter={`url(#${softShadowId})`}
      />
      <TrackChip
        label={track.track.label ?? `${track.zone.shortName} main`}
        x={track.chipX}
        y={track.chipY}
        color={lineColor}
        align={track.chipAlign}
      />
      {track.stations.map((station) => {
        const isSelected = station.station.id === selectedStationId;
        const isHovered = station.station.id === hoveredStationId;
        const clipId = `${svgIdPrefix}-${station.station.id}`;

        return (
          <StationMarker
            key={station.station.id}
            clipId={clipId}
            station={station.station}
            x={station.x}
            y={station.y}
            lineColor={lineColor}
            isHovered={isHovered}
            isSelected={isSelected}
            {...(station.imageSrc !== undefined && {
              imageSrc: station.imageSrc,
            })}
            onHover={(event) => onStationHover(station.station.id, event)}
            onMove={(event) => onStationMove(station.station.id, event)}
            onLeave={onStationLeave}
            onSelect={() => onStationSelect(station.station.id)}
          />
        );
      })}
    </g>
  );
}

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/transit-map/StationMarker.tsx

import type { MouseEvent as ReactMouseEvent } from "react";
import { STATUS_COLORS, STATUS_LABELS, type Station } from "@/data/transitData";
import { STATION_RADIUS } from "./constants";
import { getInitials } from "./utils";

interface StationMarkerProps {
  clipId: string;
  station: Station;
  imageSrc?: string;
  x: number;
  y: number;
  lineColor: string;
  isHovered: boolean;
  isSelected: boolean;
  onHover: (event: ReactMouseEvent<SVGGElement>) => void;
  onMove: (event: ReactMouseEvent<SVGGElement>) => void;
  onLeave: () => void;
  onSelect: () => void;
}

export function StationMarker({
  clipId,
  station,
  imageSrc,
  x,
  y,
  lineColor,
  isHovered,
  isSelected,
  onHover,
  onMove,
  onLeave,
  onSelect,
}: StationMarkerProps) {
  const statusColor = STATUS_COLORS[station.status];
  const ringRadius = STATION_RADIUS + (isSelected ? 5 : station.isCurrent ? 3 : 0);
  const showPulse = station.isCurrent || isSelected;

  return (
    // biome-ignore lint/a11y/useSemanticElements: SVG group used as a focusable station target
    <g
      transform={`translate(${x}, ${y})`}
      role="button"
      tabIndex={0}
      style={{ cursor: "pointer" }}
      onMouseEnter={onHover}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onFocus={onSelect}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      aria-label={`${station.name}. ${station.preparation}. ${STATUS_LABELS[station.status]}.`}
    >
      {showPulse && (
        <>
          <circle
            r={ringRadius + 9}
            fill="none"
            stroke={`${statusColor}55`}
            strokeWidth={2}
            style={{
              animation: "transit-pulse 2.4s ease-out infinite",
              transformOrigin: `${x}px ${y}px`,
            }}
          />
          <circle
            r={ringRadius + 15}
            fill="none"
            stroke={`${lineColor}44`}
            strokeWidth={1.5}
            style={{
              animation: "transit-pulse 2.4s ease-out 0.5s infinite",
              transformOrigin: `${x}px ${y}px`,
            }}
          />
        </>
      )}
      <circle
        r={ringRadius + 7}
        fill="rgba(4, 9, 18, 0.86)"
        stroke={`${lineColor}26`}
        strokeWidth={2}
      />
      {imageSrc ? (
        <image
          href={imageSrc}
          x={-STATION_RADIUS}
          y={-STATION_RADIUS}
          width={STATION_RADIUS * 2}
          height={STATION_RADIUS * 2}
          clipPath={`url(#${clipId})`}
          preserveAspectRatio="xMidYMid slice"
          opacity={isHovered ? 1 : 0.96}
          style={{ filter: "saturate(1.15) contrast(1.08)" }}
        />
      ) : (
        <g>
          <circle r={STATION_RADIUS} fill={`${lineColor}22`} />
          <text
            y={5}
            textAnchor="middle"
            fontFamily="var(--font-mono)"
            fontSize={15}
            fontWeight={700}
            fill="rgba(248, 250, 252, 0.92)"
          >
            {getInitials(station.name)}
          </text>
        </g>
      )}
      <circle
        r={STATION_RADIUS + 1}
        fill="none"
        stroke={statusColor}
        strokeWidth={isSelected ? 4.5 : isHovered ? 4 : 3}
      />
      <circle r={STATION_RADIUS + 5} fill="none" stroke={`${lineColor}45`} strokeWidth={1.5} />
      <title>{`${station.name} • ${station.preparation} • ${STATUS_LABELS[station.status]}`}</title>
    </g>
  );
}

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/transit-map/ZoneCard.tsx

import type { Zone } from "@/data/transitData";
import { ZONE_SURFACES } from "./constants";

interface ZoneCardProps {
  zone: Zone;
  index: number;
  rect: { x: number; y: number; width: number; height: number };
}

export function ZoneCard({ zone, index, rect }: ZoneCardProps) {
  const tone = ZONE_SURFACES[index];
  return (
    <g>
      <rect
        x={rect.x}
        y={rect.y}
        width={rect.width}
        height={rect.height}
        rx={28}
        fill={tone.fill}
        stroke={tone.stroke}
        strokeWidth={1.5}
      />
      <text
        x={rect.x + 26}
        y={rect.y + 34}
        fontFamily="var(--font-mono)"
        fontSize={12}
        fontWeight={700}
        letterSpacing={2.1}
        fill={tone.label}
      >
        {zone.shortName}
      </text>
      <text
        x={rect.x + 26}
        y={rect.y + 62}
        fontFamily="var(--font-display)"
        fontSize={28}
        fontWeight={700}
        fill="rgba(248, 250, 252, 0.96)"
      >
        {zone.name}
      </text>
      <text
        x={rect.x + 26}
        y={rect.y + 92}
        fontFamily="var(--font-sans)"
        fontSize={14}
        fill="rgba(226, 232, 240, 0.66)"
      >
        {zone.description}
      </text>
    </g>
  );
}

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/transit-map/constants.ts

import type { FoodStatus } from "@/data/transitData";

export const MAP_BACKGROUND =
  "radial-gradient(circle at top left, color-mix(in srgb, var(--indigo) 22%, transparent) 0%, transparent 24%), radial-gradient(circle at 88% 12%, color-mix(in srgb, var(--teal) 18%, transparent) 0%, transparent 20%), radial-gradient(circle at 50% 100%, color-mix(in srgb, var(--section-summary) 14%, transparent) 0%, transparent 28%), linear-gradient(180deg, color-mix(in srgb, var(--surface-2) 86%, black 14%) 0%, color-mix(in srgb, var(--surface-0) 92%, black 8%) 100%)";

export const ZONE_SURFACES = [
  {
    fill: "rgba(110, 231, 183, 0.08)",
    stroke: "rgba(110, 231, 183, 0.2)",
    label: "#86efac",
  },
  {
    fill: "rgba(96, 165, 250, 0.08)",
    stroke: "rgba(96, 165, 250, 0.2)",
    label: "#7dd3fc",
  },
  {
    fill: "rgba(244, 114, 182, 0.08)",
    stroke: "rgba(244, 114, 182, 0.2)",
    label: "#f9a8d4",
  },
] as const;

export const STATUS_ORDER: FoodStatus[] = ["safe", "testing", "watch", "avoid", "untested"];
export const STATION_RADIUS = 29;
export const TRACK_SHADOW_STROKE = 18;
export const TRACK_COLOR_STROKE = 10;
export const SVG_VIEWBOX = { width: 1400, height: 860 } as const;
export const INTERCHANGE_A = { x: 330, y: 430 } as const;
export const INTERCHANGE_B = { x: 814, y: 430 } as const;
export const ZONE_CARDS = {
  one: { x: 52, y: 116, width: 300, height: 592 },
  two: { x: 372, y: 184, width: 418, height: 492 },
  three: { x: 836, y: 98, width: 516, height: 650 },
} as const;

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/transit-map/types.ts

import type { Station, SubLine, Track, Zone } from "@/data/transitData";

export interface FocusedStation {
  station: Station;
  zone: Zone;
  track: Track;
  subLine: SubLine;
  imageSrc?: string;
}

export interface PositionedStation extends FocusedStation {
  x: number;
  y: number;
}

export interface PositionedTrack {
  key: string;
  zone: Zone;
  track: Track;
  path: string;
  stations: PositionedStation[];
  chipX: number;
  chipY: number;
  chipAlign: "start" | "middle" | "end";
}

export interface TooltipState {
  x: number;
  y: number;
  stationId: string;
}

export interface StatusCounts {
  safe: number;
  testing: number;
  watch: number;
  avoid: number;
  untested: number;
}

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/src/components/patterns/transit-map/utils.ts

import type { MainCategory } from "@/data/transitData";
import type { StatusCounts } from "./types";

export function normalizeSearchValue(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function makeStatusCounts(): StatusCounts {
  return { safe: 0, testing: 0, watch: 0, avoid: 0, untested: 0 };
}

export function distribute(start: number, end: number, count: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [(start + end) / 2];
  return Array.from({ length: count }, (_, index) => start + ((end - start) * index) / (count - 1));
}

export function getInitials(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "");
  return letters.join("") || "?";
}

export function getCategoryShortLabel(category: MainCategory): string {
  switch (category.id) {
    case "carbs":
      return "Carbs";
    case "proteins":
      return "Protein";
    case "fats":
      return "Fats";
    case "seasoning":
      return "Spice";
    default:
      return category.name;
  }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/src/data/transitData.ts

// ============================================================
// FOOD TRANSIT MAP — DATA LAYER v2
// Design: Dark Metro Cartography — pastel stations on dark bg
// Hierarchy: Main categories > Sub-lines > Zones > Tracks > Stations
// ============================================================

export type FoodStatus = "untested" | "testing" | "safe" | "watch" | "avoid";

export interface Station {
  id: string;
  name: string;
  preparation: string;
  status: FoodStatus;
  isCurrent?: boolean;
  emoji?: string;
}

export interface Track {
  id: string;
  label?: string;
  stations: Station[];
}

export interface Zone {
  id: string;
  name: string;
  shortName: string;
  description: string;
  tracks: Track[];
}

export interface SubLine {
  id: string;
  name: string;
  /** Pastel line colour (for dark background) */
  color: string;
  zones: Zone[];
}

export interface MainCategory {
  id: string;
  name: string;
  /** Accent colour for the category tab */
  accentColor: string;
  subLines: SubLine[];
}

// ── Status colours (pastel-friendly on dark bg) ───────────────
export const STATUS_COLORS: Record<FoodStatus, string> = {
  untested: "#64748b", // slate — not yet reached
  testing: "#60a5fa", // sky blue — currently trialing
  safe: "#4ade80", // soft green — passed safely
  watch: "#fbbf24", // amber — caused mild upset
  avoid: "#f87171", // soft red — caused bad reaction
};

export const STATUS_LABELS: Record<FoodStatus, string> = {
  untested: "Not yet reached",
  testing: "Currently trialing",
  safe: "Safe ✓",
  watch: "Watch — mild reaction",
  avoid: "Avoid for now",
};

// ── Pastel line colours for dark background ───────────────────
// These are soft, luminous pastels that read well on #1a1f2e

// ============================================================
// MAIN CATEGORIES
// ============================================================

export const MAIN_CATEGORIES: MainCategory[] = [
  // ── CARBOHYDRATES ──────────────────────────────────────────
  {
    id: "carbs",
    name: "Carbohydrates",
    accentColor: "#a3e635",
    subLines: [
      {
        id: "vegetables",
        name: "Vegetables",
        color: "#86efac", // pastel green
        zones: [
          {
            id: "veg-z1",
            name: "Zone 1",
            shortName: "Z1",
            description: "Mashed & puréed · Days 14–21",
            tracks: [
              {
                id: "veg-z1-main",
                stations: [
                  {
                    id: "v1",
                    name: "Potatoes",
                    preparation: "Mashed & peeled",
                    status: "safe",
                    emoji: "🥔",
                  },
                  {
                    id: "v2",
                    name: "Carrots",
                    preparation: "Mashed & peeled",
                    status: "safe",
                    emoji: "🥕",
                  },
                  {
                    id: "v3",
                    name: "Zucchini",
                    preparation: "Mashed & peeled",
                    status: "safe",
                    emoji: "🥒",
                  },
                  {
                    id: "v4",
                    name: "Sweet Potato",
                    preparation: "Mashed & peeled",
                    status: "watch",
                    emoji: "🍠",
                  },
                  {
                    id: "v5",
                    name: "Pumpkin",
                    preparation: "Mashed & peeled",
                    status: "testing",
                    isCurrent: true,
                    emoji: "🎃",
                  },
                ],
              },
            ],
          },
          {
            id: "veg-z2",
            name: "Zone 2",
            shortName: "Z2",
            description: "Boiled to softness · Weeks 4–10",
            tracks: [
              {
                id: "veg-z2-top",
                label: "Previously safe, now boiled",
                stations: [
                  {
                    id: "v6",
                    name: "Potatoes",
                    preparation: "Boiled",
                    status: "untested",
                    emoji: "🥔",
                  },
                  {
                    id: "v7",
                    name: "Carrots",
                    preparation: "Boiled",
                    status: "untested",
                    emoji: "🥕",
                  },
                  {
                    id: "v8",
                    name: "Zucchini",
                    preparation: "Boiled",
                    status: "untested",
                    emoji: "🥒",
                  },
                  {
                    id: "v9",
                    name: "Sweet Potato",
                    preparation: "Boiled",
                    status: "untested",
                    emoji: "🍠",
                  },
                  {
                    id: "v10",
                    name: "Pumpkin",
                    preparation: "Boiled",
                    status: "untested",
                    emoji: "🎃",
                  },
                ],
              },
              {
                id: "veg-z2-bottom",
                label: "New vegetables to trial",
                stations: [
                  {
                    id: "v11",
                    name: "Broccoli",
                    preparation: "Boiled",
                    status: "untested",
                    emoji: "🥦",
                  },
                  {
                    id: "v12",
                    name: "Cauliflower",
                    preparation: "Boiled",
                    status: "untested",
                    emoji: "🥦",
                  },
                  {
                    id: "v13",
                    name: "Spinach",
                    preparation: "Boiled",
                    status: "untested",
                    emoji: "🌿",
                  },
                  {
                    id: "v14",
                    name: "Eggplant",
                    preparation: "Boiled",
                    status: "untested",
                    emoji: "🍆",
                  },
                  {
                    id: "v15",
                    name: "Mixed Greens",
                    preparation: "Boiled",
                    status: "untested",
                    emoji: "🥬",
                  },
                ],
              },
            ],
          },
          {
            id: "veg-z3",
            name: "Zone 3",
            shortName: "Z3",
            description: "All preparation methods · Ongoing",
            tracks: [
              {
                id: "veg-z3-raw",
                label: "Raw",
                stations: [
                  {
                    id: "v16",
                    name: "Cucumber",
                    preparation: "Raw",
                    status: "untested",
                    emoji: "🥒",
                  },
                  {
                    id: "v17",
                    name: "Lettuce",
                    preparation: "Raw",
                    status: "untested",
                    emoji: "🥬",
                  },
                  {
                    id: "v18",
                    name: "Tomato",
                    preparation: "Raw",
                    status: "untested",
                    emoji: "🍅",
                  },
                ],
              },
              {
                id: "veg-z3-baked",
                label: "Baked",
                stations: [
                  {
                    id: "v19",
                    name: "Potatoes",
                    preparation: "Baked",
                    status: "untested",
                    emoji: "🥔",
                  },
                  {
                    id: "v20",
                    name: "Zucchini",
                    preparation: "Baked",
                    status: "untested",
                    emoji: "🥒",
                  },
                  {
                    id: "v21",
                    name: "Capsicum",
                    preparation: "Baked",
                    status: "untested",
                    emoji: "🫑",
                  },
                ],
              },
              {
                id: "veg-z3-stirfried",
                label: "Stir-Fried",
                stations: [
                  {
                    id: "v22",
                    name: "Bok Choy",
                    preparation: "Stir-fried",
                    status: "untested",
                    emoji: "🥬",
                  },
                  {
                    id: "v23",
                    name: "Mushrooms",
                    preparation: "Stir-fried",
                    status: "untested",
                    emoji: "🍄",
                  },
                  {
                    id: "v24",
                    name: "Snap Peas",
                    preparation: "Stir-fried",
                    status: "untested",
                    emoji: "🫛",
                  },
                ],
              },
              {
                id: "veg-z3-deepfried",
                label: "Deep-Fried",
                stations: [
                  {
                    id: "v25",
                    name: "Zucchini Chips",
                    preparation: "Deep-fried",
                    status: "untested",
                    emoji: "🥒",
                  },
                  {
                    id: "v26",
                    name: "Onion Rings",
                    preparation: "Deep-fried",
                    status: "untested",
                    emoji: "🧅",
                  },
                  {
                    id: "v27",
                    name: "Tempura Veg",
                    preparation: "Deep-fried",
                    status: "untested",
                    emoji: "🍤",
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "fruit",
        name: "Fruit",
        color: "#f9a8d4", // pastel pink
        zones: [
          {
            id: "fruit-z1",
            name: "Zone 1",
            shortName: "Z1",
            description: "Puréed only · Days 14–21",
            tracks: [
              {
                id: "fruit-z1-main",
                stations: [
                  { id: "f1", name: "Banana", preparation: "Puréed", status: "safe", emoji: "🍌" },
                  {
                    id: "f2",
                    name: "Apple",
                    preparation: "Puréed, no skin",
                    status: "safe",
                    emoji: "🍎",
                  },
                  {
                    id: "f3",
                    name: "Pear",
                    preparation: "Puréed, no skin",
                    status: "watch",
                    emoji: "🍐",
                  },
                ],
              },
            ],
          },
          {
            id: "fruit-z2",
            name: "Zone 2",
            shortName: "Z2",
            description: "Soft & stewed · Weeks 4–10",
            tracks: [
              {
                id: "fruit-z2-top",
                label: "Stewed fruits",
                stations: [
                  {
                    id: "f4",
                    name: "Apple",
                    preparation: "Stewed",
                    status: "untested",
                    emoji: "🍎",
                  },
                  {
                    id: "f5",
                    name: "Pear",
                    preparation: "Stewed",
                    status: "untested",
                    emoji: "🍐",
                  },
                  {
                    id: "f6",
                    name: "Peach",
                    preparation: "Stewed",
                    status: "untested",
                    emoji: "🍑",
                  },
                  {
                    id: "f7",
                    name: "Mango",
                    preparation: "Soft, ripe",
                    status: "untested",
                    emoji: "🥭",
                  },
                ],
              },
              {
                id: "fruit-z2-bottom",
                label: "New soft fruits",
                stations: [
                  {
                    id: "f8",
                    name: "Melon",
                    preparation: "Soft, ripe",
                    status: "untested",
                    emoji: "🍈",
                  },
                  {
                    id: "f9",
                    name: "Papaya",
                    preparation: "Ripe",
                    status: "untested",
                    emoji: "🍈",
                  },
                  {
                    id: "f10",
                    name: "Kiwi",
                    preparation: "No seeds",
                    status: "untested",
                    emoji: "🥝",
                  },
                  {
                    id: "f11",
                    name: "Grapes",
                    preparation: "Peeled",
                    status: "untested",
                    emoji: "🍇",
                  },
                ],
              },
            ],
          },
          {
            id: "fruit-z3",
            name: "Zone 3",
            shortName: "Z3",
            description: "All forms · Ongoing",
            tracks: [
              {
                id: "fruit-z3-raw",
                label: "Raw",
                stations: [
                  {
                    id: "f12",
                    name: "Strawberry",
                    preparation: "Raw",
                    status: "untested",
                    emoji: "🍓",
                  },
                  {
                    id: "f13",
                    name: "Blueberry",
                    preparation: "Raw",
                    status: "untested",
                    emoji: "🫐",
                  },
                  {
                    id: "f14",
                    name: "Orange",
                    preparation: "Segments",
                    status: "untested",
                    emoji: "🍊",
                  },
                ],
              },
              {
                id: "fruit-z3-dried",
                label: "Dried",
                stations: [
                  {
                    id: "f15",
                    name: "Raisins",
                    preparation: "Dried",
                    status: "untested",
                    emoji: "🍇",
                  },
                  {
                    id: "f16",
                    name: "Apricot",
                    preparation: "Dried",
                    status: "untested",
                    emoji: "🍑",
                  },
                  {
                    id: "f17",
                    name: "Prunes",
                    preparation: "Dried",
                    status: "untested",
                    emoji: "🟣",
                  },
                ],
              },
              {
                id: "fruit-z3-juice",
                label: "Juice",
                stations: [
                  {
                    id: "f18",
                    name: "Apple Juice",
                    preparation: "Diluted",
                    status: "untested",
                    emoji: "🍎",
                  },
                  {
                    id: "f19",
                    name: "Orange Juice",
                    preparation: "Diluted",
                    status: "untested",
                    emoji: "🍊",
                  },
                  {
                    id: "f20",
                    name: "Grape Juice",
                    preparation: "Diluted",
                    status: "untested",
                    emoji: "🍇",
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "grains",
        name: "Grains & Cereals",
        color: "#fde68a", // pastel yellow
        zones: [
          {
            id: "grains-z1",
            name: "Zone 1",
            shortName: "Z1",
            description: "Smooth & puréed · Days 14–21",
            tracks: [
              {
                id: "grains-z1-main",
                stations: [
                  {
                    id: "g1",
                    name: "White Rice",
                    preparation: "Overcooked, mushy",
                    status: "safe",
                    emoji: "🍚",
                  },
                  {
                    id: "g2",
                    name: "Oat Porridge",
                    preparation: "Smooth, no lumps",
                    status: "safe",
                    emoji: "🥣",
                  },
                  {
                    id: "g3",
                    name: "White Bread",
                    preparation: "Soaked in broth",
                    status: "watch",
                    emoji: "🍞",
                  },
                  {
                    id: "g4",
                    name: "Semolina",
                    preparation: "Smooth porridge",
                    status: "testing",
                    isCurrent: true,
                    emoji: "🌾",
                  },
                ],
              },
            ],
          },
          {
            id: "grains-z2",
            name: "Zone 2",
            shortName: "Z2",
            description: "Soft cooked · Weeks 4–10",
            tracks: [
              {
                id: "grains-z2-top",
                label: "Previously safe, softer",
                stations: [
                  {
                    id: "g5",
                    name: "White Rice",
                    preparation: "Soft cooked",
                    status: "untested",
                    emoji: "🍚",
                  },
                  {
                    id: "g6",
                    name: "Oat Porridge",
                    preparation: "Slightly thicker",
                    status: "untested",
                    emoji: "🥣",
                  },
                  {
                    id: "g7",
                    name: "White Bread",
                    preparation: "Soft, no crust",
                    status: "untested",
                    emoji: "🍞",
                  },
                  {
                    id: "g8",
                    name: "Pasta",
                    preparation: "Well cooked",
                    status: "untested",
                    emoji: "🍝",
                  },
                ],
              },
              {
                id: "grains-z2-bottom",
                label: "New grains to trial",
                stations: [
                  {
                    id: "g9",
                    name: "Polenta",
                    preparation: "Soft, creamy",
                    status: "untested",
                    emoji: "🌽",
                  },
                  {
                    id: "g10",
                    name: "Couscous",
                    preparation: "Soaked",
                    status: "untested",
                    emoji: "🌾",
                  },
                  {
                    id: "g11",
                    name: "Quinoa",
                    preparation: "Well rinsed",
                    status: "untested",
                    emoji: "🌾",
                  },
                  {
                    id: "g12",
                    name: "Rice Cakes",
                    preparation: "Soft, plain",
                    status: "untested",
                    emoji: "🍘",
                  },
                ],
              },
            ],
          },
          {
            id: "grains-z3",
            name: "Zone 3",
            shortName: "Z3",
            description: "All forms · Ongoing",
            tracks: [
              {
                id: "grains-z3-wholegrain",
                label: "Wholegrain",
                stations: [
                  {
                    id: "g13",
                    name: "Brown Rice",
                    preparation: "Well cooked",
                    status: "untested",
                    emoji: "🍚",
                  },
                  {
                    id: "g14",
                    name: "Wholemeal Bread",
                    preparation: "Toasted",
                    status: "untested",
                    emoji: "🍞",
                  },
                  {
                    id: "g15",
                    name: "Oat Biscuits",
                    preparation: "Plain",
                    status: "untested",
                    emoji: "🍪",
                  },
                ],
              },
              {
                id: "grains-z3-baked",
                label: "Baked",
                stations: [
                  {
                    id: "g16",
                    name: "Muffin",
                    preparation: "Plain, low fat",
                    status: "untested",
                    emoji: "🧁",
                  },
                  {
                    id: "g17",
                    name: "Crackers",
                    preparation: "Plain",
                    status: "untested",
                    emoji: "🫙",
                  },
                  {
                    id: "g18",
                    name: "Crumpets",
                    preparation: "Plain",
                    status: "untested",
                    emoji: "🍞",
                  },
                ],
              },
              {
                id: "grains-z3-fried",
                label: "Fried / Crunchy",
                stations: [
                  {
                    id: "g19",
                    name: "Chips",
                    preparation: "Thin cut",
                    status: "untested",
                    emoji: "🍟",
                  },
                  {
                    id: "g20",
                    name: "Corn Chips",
                    preparation: "Plain",
                    status: "untested",
                    emoji: "🌽",
                  },
                  {
                    id: "g21",
                    name: "Pretzels",
                    preparation: "Plain",
                    status: "untested",
                    emoji: "🥨",
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },

  // ── PROTEINS ───────────────────────────────────────────────
  {
    id: "proteins",
    name: "Proteins",
    accentColor: "#fb923c",
    subLines: [
      {
        id: "meat",
        name: "Meat & Fish",
        color: "#fdba74", // pastel orange
        zones: [
          {
            id: "meat-z1",
            name: "Zone 1",
            shortName: "Z1",
            description: "Puréed & very soft · Days 14–21",
            tracks: [
              {
                id: "meat-z1-main",
                stations: [
                  { id: "p1", name: "Chicken", preparation: "Puréed", status: "safe", emoji: "🍗" },
                  {
                    id: "p2",
                    name: "White Fish",
                    preparation: "Puréed",
                    status: "safe",
                    emoji: "🐟",
                  },
                  {
                    id: "p3",
                    name: "Eggs",
                    preparation: "Scrambled soft",
                    status: "testing",
                    isCurrent: true,
                    emoji: "🥚",
                  },
                  {
                    id: "p4",
                    name: "Tuna",
                    preparation: "Tinned, mashed",
                    status: "untested",
                    emoji: "🐠",
                  },
                ],
              },
            ],
          },
          {
            id: "meat-z2",
            name: "Zone 2",
            shortName: "Z2",
            description: "Soft cooked · Weeks 4–10",
            tracks: [
              {
                id: "meat-z2-top",
                label: "Previously safe, soft cooked",
                stations: [
                  {
                    id: "p5",
                    name: "Chicken",
                    preparation: "Poached",
                    status: "untested",
                    emoji: "🍗",
                  },
                  {
                    id: "p6",
                    name: "White Fish",
                    preparation: "Steamed",
                    status: "untested",
                    emoji: "🐟",
                  },
                  {
                    id: "p7",
                    name: "Eggs",
                    preparation: "Soft boiled",
                    status: "untested",
                    emoji: "🥚",
                  },
                  {
                    id: "p8",
                    name: "Salmon",
                    preparation: "Steamed",
                    status: "untested",
                    emoji: "🐟",
                  },
                ],
              },
              {
                id: "meat-z2-bottom",
                label: "New proteins to trial",
                stations: [
                  {
                    id: "p9",
                    name: "Turkey",
                    preparation: "Minced, moist",
                    status: "untested",
                    emoji: "🦃",
                  },
                  {
                    id: "p10",
                    name: "Prawns",
                    preparation: "Steamed",
                    status: "untested",
                    emoji: "🍤",
                  },
                  {
                    id: "p11",
                    name: "Sardines",
                    preparation: "Tinned",
                    status: "untested",
                    emoji: "🐟",
                  },
                  {
                    id: "p12",
                    name: "Crab",
                    preparation: "Flaked",
                    status: "untested",
                    emoji: "🦀",
                  },
                ],
              },
            ],
          },
          {
            id: "meat-z3",
            name: "Zone 3",
            shortName: "Z3",
            description: "All cooking methods · Ongoing",
            tracks: [
              {
                id: "meat-z3-grilled",
                label: "Grilled",
                stations: [
                  {
                    id: "p13",
                    name: "Chicken Breast",
                    preparation: "Grilled",
                    status: "untested",
                    emoji: "🍗",
                  },
                  {
                    id: "p14",
                    name: "Salmon",
                    preparation: "Grilled",
                    status: "untested",
                    emoji: "🐟",
                  },
                  {
                    id: "p15",
                    name: "Tuna Steak",
                    preparation: "Grilled",
                    status: "untested",
                    emoji: "🐠",
                  },
                ],
              },
              {
                id: "meat-z3-red",
                label: "Red Meat",
                stations: [
                  {
                    id: "p16",
                    name: "Beef Mince",
                    preparation: "Well cooked",
                    status: "untested",
                    emoji: "🥩",
                  },
                  {
                    id: "p17",
                    name: "Lamb",
                    preparation: "Slow cooked",
                    status: "untested",
                    emoji: "🥩",
                  },
                  {
                    id: "p18",
                    name: "Pork",
                    preparation: "Slow cooked",
                    status: "untested",
                    emoji: "🥩",
                  },
                ],
              },
              {
                id: "meat-z3-processed",
                label: "Processed",
                stations: [
                  {
                    id: "p19",
                    name: "Ham",
                    preparation: "Thin sliced",
                    status: "untested",
                    emoji: "🍖",
                  },
                  {
                    id: "p20",
                    name: "Salami",
                    preparation: "Small amount",
                    status: "untested",
                    emoji: "🍕",
                  },
                  {
                    id: "p21",
                    name: "Sausages",
                    preparation: "Well cooked",
                    status: "untested",
                    emoji: "🌭",
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "dairy",
        name: "Dairy",
        color: "#bfdbfe", // pastel blue
        zones: [
          {
            id: "dairy-z1",
            name: "Zone 1",
            shortName: "Z1",
            description: "Smooth & diluted · Days 14–21",
            tracks: [
              {
                id: "dairy-z1-main",
                stations: [
                  {
                    id: "d1",
                    name: "Yoghurt",
                    preparation: "Plain, smooth",
                    status: "safe",
                    emoji: "🥛",
                  },
                  {
                    id: "d2",
                    name: "Milk",
                    preparation: "Diluted in food",
                    status: "safe",
                    emoji: "🥛",
                  },
                  {
                    id: "d3",
                    name: "Cottage Cheese",
                    preparation: "Smooth",
                    status: "watch",
                    emoji: "🧀",
                  },
                  {
                    id: "d4",
                    name: "Ricotta",
                    preparation: "Smooth",
                    status: "testing",
                    isCurrent: true,
                    emoji: "🧀",
                  },
                ],
              },
            ],
          },
          {
            id: "dairy-z2",
            name: "Zone 2",
            shortName: "Z2",
            description: "Soft dairy · Weeks 4–10",
            tracks: [
              {
                id: "dairy-z2-top",
                label: "Previously safe",
                stations: [
                  {
                    id: "d5",
                    name: "Yoghurt",
                    preparation: "Full fat, plain",
                    status: "untested",
                    emoji: "🥛",
                  },
                  {
                    id: "d6",
                    name: "Milk",
                    preparation: "Full fat",
                    status: "untested",
                    emoji: "🥛",
                  },
                  {
                    id: "d7",
                    name: "Cream",
                    preparation: "In sauces",
                    status: "untested",
                    emoji: "🥛",
                  },
                  {
                    id: "d8",
                    name: "Butter",
                    preparation: "Small amount",
                    status: "untested",
                    emoji: "🧈",
                  },
                ],
              },
              {
                id: "dairy-z2-bottom",
                label: "New dairy to trial",
                stations: [
                  {
                    id: "d9",
                    name: "Soft Cheese",
                    preparation: "Brie, camembert",
                    status: "untested",
                    emoji: "🧀",
                  },
                  {
                    id: "d10",
                    name: "Feta",
                    preparation: "Crumbled",
                    status: "untested",
                    emoji: "🧀",
                  },
                  {
                    id: "d11",
                    name: "Mozzarella",
                    preparation: "Fresh",
                    status: "untested",
                    emoji: "🧀",
                  },
                  {
                    id: "d12",
                    name: "Sour Cream",
                    preparation: "Small amount",
                    status: "untested",
                    emoji: "🥛",
                  },
                ],
              },
            ],
          },
          {
            id: "dairy-z3",
            name: "Zone 3",
            shortName: "Z3",
            description: "Full dairy range · Ongoing",
            tracks: [
              {
                id: "dairy-z3-hard",
                label: "Hard Cheese",
                stations: [
                  {
                    id: "d13",
                    name: "Cheddar",
                    preparation: "Grated",
                    status: "untested",
                    emoji: "🧀",
                  },
                  {
                    id: "d14",
                    name: "Parmesan",
                    preparation: "Grated",
                    status: "untested",
                    emoji: "🧀",
                  },
                  {
                    id: "d15",
                    name: "Gruyère",
                    preparation: "Sliced",
                    status: "untested",
                    emoji: "🧀",
                  },
                ],
              },
              {
                id: "dairy-z3-icecream",
                label: "Frozen",
                stations: [
                  {
                    id: "d16",
                    name: "Ice Cream",
                    preparation: "Plain vanilla",
                    status: "untested",
                    emoji: "🍦",
                  },
                  {
                    id: "d17",
                    name: "Frozen Yoghurt",
                    preparation: "Plain",
                    status: "untested",
                    emoji: "🍧",
                  },
                  {
                    id: "d18",
                    name: "Gelato",
                    preparation: "Plain",
                    status: "untested",
                    emoji: "🍨",
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "plant-proteins",
        name: "Plant Proteins",
        color: "#a5f3fc", // pastel cyan
        zones: [
          {
            id: "pp-z1",
            name: "Zone 1",
            shortName: "Z1",
            description: "Puréed · Days 14–21",
            tracks: [
              {
                id: "pp-z1-main",
                stations: [
                  {
                    id: "pp1",
                    name: "Tofu",
                    preparation: "Soft, silken",
                    status: "safe",
                    emoji: "🟨",
                  },
                  {
                    id: "pp2",
                    name: "Lentils",
                    preparation: "Puréed",
                    status: "safe",
                    emoji: "🫘",
                  },
                  {
                    id: "pp3",
                    name: "Hummus",
                    preparation: "Smooth",
                    status: "watch",
                    emoji: "🫘",
                  },
                  {
                    id: "pp4",
                    name: "Edamame",
                    preparation: "Puréed",
                    status: "testing",
                    isCurrent: true,
                    emoji: "🫛",
                  },
                ],
              },
            ],
          },
          {
            id: "pp-z2",
            name: "Zone 2",
            shortName: "Z2",
            description: "Soft cooked · Weeks 4–10",
            tracks: [
              {
                id: "pp-z2-top",
                label: "Previously safe",
                stations: [
                  {
                    id: "pp5",
                    name: "Tofu",
                    preparation: "Firm, steamed",
                    status: "untested",
                    emoji: "🟨",
                  },
                  {
                    id: "pp6",
                    name: "Lentils",
                    preparation: "Well cooked",
                    status: "untested",
                    emoji: "🫘",
                  },
                  {
                    id: "pp7",
                    name: "Chickpeas",
                    preparation: "Puréed",
                    status: "untested",
                    emoji: "🫘",
                  },
                  {
                    id: "pp8",
                    name: "Edamame",
                    preparation: "Boiled",
                    status: "untested",
                    emoji: "🫛",
                  },
                ],
              },
              {
                id: "pp-z2-bottom",
                label: "New plant proteins",
                stations: [
                  {
                    id: "pp9",
                    name: "Black Beans",
                    preparation: "Well cooked",
                    status: "untested",
                    emoji: "🫘",
                  },
                  {
                    id: "pp10",
                    name: "Tempeh",
                    preparation: "Steamed",
                    status: "untested",
                    emoji: "🟫",
                  },
                  {
                    id: "pp11",
                    name: "Miso",
                    preparation: "In broth",
                    status: "untested",
                    emoji: "🫙",
                  },
                  {
                    id: "pp12",
                    name: "Pea Protein",
                    preparation: "In smoothie",
                    status: "untested",
                    emoji: "🫛",
                  },
                ],
              },
            ],
          },
          {
            id: "pp-z3",
            name: "Zone 3",
            shortName: "Z3",
            description: "All forms · Ongoing",
            tracks: [
              {
                id: "pp-z3-nuts",
                label: "Nuts & Seeds",
                stations: [
                  {
                    id: "pp13",
                    name: "Almonds",
                    preparation: "Ground/sliced",
                    status: "untested",
                    emoji: "🌰",
                  },
                  {
                    id: "pp14",
                    name: "Walnuts",
                    preparation: "Chopped",
                    status: "untested",
                    emoji: "🌰",
                  },
                  {
                    id: "pp15",
                    name: "Chia Seeds",
                    preparation: "Soaked",
                    status: "untested",
                    emoji: "⚫",
                  },
                ],
              },
              {
                id: "pp-z3-whole",
                label: "Whole Legumes",
                stations: [
                  {
                    id: "pp16",
                    name: "Kidney Beans",
                    preparation: "Well cooked",
                    status: "untested",
                    emoji: "🫘",
                  },
                  {
                    id: "pp17",
                    name: "Cannellini",
                    preparation: "Well cooked",
                    status: "untested",
                    emoji: "🫘",
                  },
                  {
                    id: "pp18",
                    name: "Puy Lentils",
                    preparation: "Well cooked",
                    status: "untested",
                    emoji: "🫘",
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },

  // ── FATS ───────────────────────────────────────────────────
  {
    id: "fats",
    name: "Fats",
    accentColor: "#c084fc",
    subLines: [
      {
        id: "healthy-fats",
        name: "Healthy Fats",
        color: "#d8b4fe", // pastel purple
        zones: [
          {
            id: "hf-z1",
            name: "Zone 1",
            shortName: "Z1",
            description: "Blended in · Days 14–21",
            tracks: [
              {
                id: "hf-z1-main",
                stations: [
                  {
                    id: "hf1",
                    name: "Olive Oil",
                    preparation: "Blended in purée",
                    status: "safe",
                    emoji: "🫒",
                  },
                  {
                    id: "hf2",
                    name: "Avocado",
                    preparation: "Puréed",
                    status: "safe",
                    emoji: "🥑",
                  },
                  {
                    id: "hf3",
                    name: "Flaxseed",
                    preparation: "Ground, in food",
                    status: "watch",
                    emoji: "🌾",
                  },
                  {
                    id: "hf4",
                    name: "Nut Butter",
                    preparation: "Smooth, small amt",
                    status: "testing",
                    isCurrent: true,
                    emoji: "🥜",
                  },
                ],
              },
            ],
          },
          {
            id: "hf-z2",
            name: "Zone 2",
            shortName: "Z2",
            description: "Moderate amounts · Weeks 4–10",
            tracks: [
              {
                id: "hf-z2-top",
                label: "Oils & spreads",
                stations: [
                  {
                    id: "hf5",
                    name: "Olive Oil",
                    preparation: "Drizzled",
                    status: "untested",
                    emoji: "🫒",
                  },
                  {
                    id: "hf6",
                    name: "Coconut Oil",
                    preparation: "Cooking",
                    status: "untested",
                    emoji: "🥥",
                  },
                  {
                    id: "hf7",
                    name: "Tahini",
                    preparation: "Small amount",
                    status: "untested",
                    emoji: "🟤",
                  },
                  {
                    id: "hf8",
                    name: "Avocado",
                    preparation: "Sliced",
                    status: "untested",
                    emoji: "🥑",
                  },
                ],
              },
              {
                id: "hf-z2-bottom",
                label: "New healthy fats",
                stations: [
                  {
                    id: "hf9",
                    name: "Salmon Oil",
                    preparation: "Capsule/drizzle",
                    status: "untested",
                    emoji: "🐟",
                  },
                  {
                    id: "hf10",
                    name: "Walnut Oil",
                    preparation: "Drizzled",
                    status: "untested",
                    emoji: "🌰",
                  },
                  {
                    id: "hf11",
                    name: "Hemp Seeds",
                    preparation: "Sprinkled",
                    status: "untested",
                    emoji: "🌿",
                  },
                  {
                    id: "hf12",
                    name: "Pumpkin Seeds",
                    preparation: "Ground",
                    status: "untested",
                    emoji: "🎃",
                  },
                ],
              },
            ],
          },
          {
            id: "hf-z3",
            name: "Zone 3",
            shortName: "Z3",
            description: "Full range · Ongoing",
            tracks: [
              {
                id: "hf-z3-nuts",
                label: "Whole Nuts",
                stations: [
                  {
                    id: "hf13",
                    name: "Almonds",
                    preparation: "Whole",
                    status: "untested",
                    emoji: "🌰",
                  },
                  {
                    id: "hf14",
                    name: "Cashews",
                    preparation: "Whole",
                    status: "untested",
                    emoji: "🌰",
                  },
                  {
                    id: "hf15",
                    name: "Pistachios",
                    preparation: "Shelled",
                    status: "untested",
                    emoji: "🌰",
                  },
                ],
              },
              {
                id: "hf-z3-seeds",
                label: "Seeds",
                stations: [
                  {
                    id: "hf16",
                    name: "Chia Seeds",
                    preparation: "Soaked",
                    status: "untested",
                    emoji: "⚫",
                  },
                  {
                    id: "hf17",
                    name: "Sunflower",
                    preparation: "Sprinkled",
                    status: "untested",
                    emoji: "🌻",
                  },
                  {
                    id: "hf18",
                    name: "Sesame",
                    preparation: "Sprinkled",
                    status: "untested",
                    emoji: "🌾",
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "unhealthy-fats",
        name: "Saturated Fats",
        color: "#fca5a5", // pastel red
        zones: [
          {
            id: "uf-z1",
            name: "Zone 1",
            shortName: "Z1",
            description: "Minimal only · Days 14–21",
            tracks: [
              {
                id: "uf-z1-main",
                stations: [
                  {
                    id: "uf1",
                    name: "Butter",
                    preparation: "Small amt in mash",
                    status: "watch",
                    emoji: "🧈",
                  },
                  {
                    id: "uf2",
                    name: "Cream",
                    preparation: "Tiny in food",
                    status: "watch",
                    emoji: "🥛",
                  },
                  {
                    id: "uf3",
                    name: "Coconut Cream",
                    preparation: "Tiny in food",
                    status: "testing",
                    isCurrent: true,
                    emoji: "🥥",
                  },
                ],
              },
            ],
          },
          {
            id: "uf-z2",
            name: "Zone 2",
            shortName: "Z2",
            description: "Small amounts · Weeks 4–10",
            tracks: [
              {
                id: "uf-z2-top",
                label: "Cooking fats",
                stations: [
                  {
                    id: "uf4",
                    name: "Butter",
                    preparation: "Cooking",
                    status: "untested",
                    emoji: "🧈",
                  },
                  {
                    id: "uf5",
                    name: "Lard",
                    preparation: "Cooking",
                    status: "untested",
                    emoji: "🫙",
                  },
                  {
                    id: "uf6",
                    name: "Ghee",
                    preparation: "Cooking",
                    status: "untested",
                    emoji: "🫙",
                  },
                  {
                    id: "uf7",
                    name: "Palm Oil",
                    preparation: "Cooking",
                    status: "untested",
                    emoji: "🌴",
                  },
                ],
              },
              {
                id: "uf-z2-bottom",
                label: "Processed fats",
                stations: [
                  {
                    id: "uf8",
                    name: "Margarine",
                    preparation: "Spread",
                    status: "untested",
                    emoji: "🧈",
                  },
                  {
                    id: "uf9",
                    name: "Mayo",
                    preparation: "Small amount",
                    status: "untested",
                    emoji: "🫙",
                  },
                  {
                    id: "uf10",
                    name: "Cream Cheese",
                    preparation: "Spread",
                    status: "untested",
                    emoji: "🧀",
                  },
                  {
                    id: "uf11",
                    name: "Sour Cream",
                    preparation: "Small amount",
                    status: "untested",
                    emoji: "🥛",
                  },
                ],
              },
            ],
          },
          {
            id: "uf-z3",
            name: "Zone 3",
            shortName: "Z3",
            description: "Occasional · Ongoing",
            tracks: [
              {
                id: "uf-z3-fried",
                label: "Fried Foods",
                stations: [
                  {
                    id: "uf12",
                    name: "Chips",
                    preparation: "Occasional",
                    status: "untested",
                    emoji: "🍟",
                  },
                  {
                    id: "uf13",
                    name: "Fried Egg",
                    preparation: "Occasional",
                    status: "untested",
                    emoji: "🍳",
                  },
                  {
                    id: "uf14",
                    name: "Bacon",
                    preparation: "Occasional",
                    status: "untested",
                    emoji: "🥓",
                  },
                ],
              },
              {
                id: "uf-z3-processed",
                label: "Processed",
                stations: [
                  {
                    id: "uf15",
                    name: "Pastry",
                    preparation: "Occasional",
                    status: "untested",
                    emoji: "🥐",
                  },
                  {
                    id: "uf16",
                    name: "Croissant",
                    preparation: "Occasional",
                    status: "untested",
                    emoji: "🥐",
                  },
                  {
                    id: "uf17",
                    name: "Doughnuts",
                    preparation: "Occasional",
                    status: "untested",
                    emoji: "🍩",
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },

  // ── SEASONING ──────────────────────────────────────────────
  {
    id: "seasoning",
    name: "Seasoning",
    accentColor: "#34d399",
    subLines: [
      {
        id: "herbs",
        name: "Herbs",
        color: "#6ee7b7", // pastel mint
        zones: [
          {
            id: "herbs-z1",
            name: "Zone 1",
            shortName: "Z1",
            description: "Very mild only · Days 14–21",
            tracks: [
              {
                id: "herbs-z1-main",
                stations: [
                  {
                    id: "h1",
                    name: "Parsley",
                    preparation: "Fresh, blended in",
                    status: "safe",
                    emoji: "🌿",
                  },
                  {
                    id: "h2",
                    name: "Chives",
                    preparation: "Fresh, blended in",
                    status: "safe",
                    emoji: "🌿",
                  },
                  {
                    id: "h3",
                    name: "Dill",
                    preparation: "Fresh, blended in",
                    status: "watch",
                    emoji: "🌿",
                  },
                  {
                    id: "h4",
                    name: "Basil",
                    preparation: "Fresh, blended in",
                    status: "testing",
                    isCurrent: true,
                    emoji: "🌿",
                  },
                ],
              },
            ],
          },
          {
            id: "herbs-z2",
            name: "Zone 2",
            shortName: "Z2",
            description: "Mild herbs · Weeks 4–10",
            tracks: [
              {
                id: "herbs-z2-top",
                label: "Fresh herbs",
                stations: [
                  {
                    id: "h5",
                    name: "Basil",
                    preparation: "Fresh",
                    status: "untested",
                    emoji: "🌿",
                  },
                  {
                    id: "h6",
                    name: "Thyme",
                    preparation: "Fresh or dried",
                    status: "untested",
                    emoji: "🌿",
                  },
                  {
                    id: "h7",
                    name: "Oregano",
                    preparation: "Dried",
                    status: "untested",
                    emoji: "🌿",
                  },
                  {
                    id: "h8",
                    name: "Rosemary",
                    preparation: "Fresh, chopped",
                    status: "untested",
                    emoji: "🌿",
                  },
                ],
              },
              {
                id: "herbs-z2-bottom",
                label: "Dried herbs",
                stations: [
                  {
                    id: "h9",
                    name: "Bay Leaf",
                    preparation: "In cooking",
                    status: "untested",
                    emoji: "🌿",
                  },
                  {
                    id: "h10",
                    name: "Sage",
                    preparation: "Dried",
                    status: "untested",
                    emoji: "🌿",
                  },
                  {
                    id: "h11",
                    name: "Tarragon",
                    preparation: "Dried",
                    status: "untested",
                    emoji: "🌿",
                  },
                  {
                    id: "h12",
                    name: "Mint",
                    preparation: "Fresh",
                    status: "untested",
                    emoji: "🌿",
                  },
                ],
              },
            ],
          },
          {
            id: "herbs-z3",
            name: "Zone 3",
            shortName: "Z3",
            description: "Full herb range · Ongoing",
            tracks: [
              {
                id: "herbs-z3-strong",
                label: "Strong herbs",
                stations: [
                  {
                    id: "h13",
                    name: "Coriander",
                    preparation: "Fresh",
                    status: "untested",
                    emoji: "🌿",
                  },
                  {
                    id: "h14",
                    name: "Lemongrass",
                    preparation: "Infused",
                    status: "untested",
                    emoji: "🌿",
                  },
                  {
                    id: "h15",
                    name: "Kaffir Lime",
                    preparation: "In dishes",
                    status: "untested",
                    emoji: "🍋",
                  },
                ],
              },
              {
                id: "herbs-z3-medicinal",
                label: "Medicinal",
                stations: [
                  {
                    id: "h16",
                    name: "Ginger",
                    preparation: "Grated, small",
                    status: "untested",
                    emoji: "🫚",
                  },
                  {
                    id: "h17",
                    name: "Turmeric",
                    preparation: "Ground, small",
                    status: "untested",
                    emoji: "🟡",
                  },
                  {
                    id: "h18",
                    name: "Fennel",
                    preparation: "Seed or frond",
                    status: "untested",
                    emoji: "🌿",
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "spices",
        name: "Spices & Condiments",
        color: "#fed7aa", // pastel peach
        zones: [
          {
            id: "spices-z1",
            name: "Zone 1",
            shortName: "Z1",
            description: "Salt only · Days 14–21",
            tracks: [
              {
                id: "spices-z1-main",
                stations: [
                  {
                    id: "sp1",
                    name: "Salt",
                    preparation: "Tiny amount",
                    status: "safe",
                    emoji: "🧂",
                  },
                  {
                    id: "sp2",
                    name: "Lemon Juice",
                    preparation: "Small squeeze",
                    status: "safe",
                    emoji: "🍋",
                  },
                  {
                    id: "sp3",
                    name: "Soy Sauce",
                    preparation: "Low sodium, tiny",
                    status: "watch",
                    emoji: "🫙",
                  },
                  {
                    id: "sp4",
                    name: "Miso",
                    preparation: "Diluted in broth",
                    status: "testing",
                    isCurrent: true,
                    emoji: "🫙",
                  },
                ],
              },
            ],
          },
          {
            id: "spices-z2",
            name: "Zone 2",
            shortName: "Z2",
            description: "Mild spices · Weeks 4–10",
            tracks: [
              {
                id: "spices-z2-top",
                label: "Mild spices",
                stations: [
                  {
                    id: "sp5",
                    name: "Cumin",
                    preparation: "Ground, small",
                    status: "untested",
                    emoji: "🟤",
                  },
                  {
                    id: "sp6",
                    name: "Coriander",
                    preparation: "Ground",
                    status: "untested",
                    emoji: "🟤",
                  },
                  {
                    id: "sp7",
                    name: "Cinnamon",
                    preparation: "Ground",
                    status: "untested",
                    emoji: "🟤",
                  },
                  {
                    id: "sp8",
                    name: "Nutmeg",
                    preparation: "Grated, tiny",
                    status: "untested",
                    emoji: "🟤",
                  },
                ],
              },
              {
                id: "spices-z2-bottom",
                label: "Condiments",
                stations: [
                  {
                    id: "sp9",
                    name: "Mustard",
                    preparation: "Mild, small",
                    status: "untested",
                    emoji: "🟡",
                  },
                  {
                    id: "sp10",
                    name: "Vinegar",
                    preparation: "Small amount",
                    status: "untested",
                    emoji: "🫙",
                  },
                  {
                    id: "sp11",
                    name: "Fish Sauce",
                    preparation: "Tiny amount",
                    status: "untested",
                    emoji: "🫙",
                  },
                  {
                    id: "sp12",
                    name: "Oyster Sauce",
                    preparation: "Small amount",
                    status: "untested",
                    emoji: "🫙",
                  },
                ],
              },
            ],
          },
          {
            id: "spices-z3",
            name: "Zone 3",
            shortName: "Z3",
            description: "Full spice range · Ongoing",
            tracks: [
              {
                id: "spices-z3-hot",
                label: "Hot & Spicy",
                stations: [
                  {
                    id: "sp13",
                    name: "Black Pepper",
                    preparation: "Ground",
                    status: "untested",
                    emoji: "⚫",
                  },
                  {
                    id: "sp14",
                    name: "Chilli Flakes",
                    preparation: "Small amount",
                    status: "untested",
                    emoji: "🌶️",
                  },
                  {
                    id: "sp15",
                    name: "Hot Sauce",
                    preparation: "Small amount",
                    status: "untested",
                    emoji: "🌶️",
                  },
                ],
              },
              {
                id: "spices-z3-sauces",
                label: "Sauces",
                stations: [
                  {
                    id: "sp16",
                    name: "Tomato Sauce",
                    preparation: "Low sugar",
                    status: "untested",
                    emoji: "🍅",
                  },
                  {
                    id: "sp17",
                    name: "Worcestershire",
                    preparation: "Small amount",
                    status: "untested",
                    emoji: "🫙",
                  },
                  {
                    id: "sp18",
                    name: "BBQ Sauce",
                    preparation: "Small amount",
                    status: "untested",
                    emoji: "🫙",
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];

// ── Flat list of all sub-lines for easy lookup ────────────────
export const ALL_SUBLINES = MAIN_CATEGORIES.flatMap((cat) =>
  cat.subLines.map((sl) => ({ ...sl, categoryId: cat.id, categoryName: cat.name })),
);

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/avocado.png

*Binary asset omitted from inline concatenation.*

- Path: `/Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/avocado.png`
- Size: `119524` bytes

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/baked_sweet_potato.png

*Binary asset omitted from inline concatenation.*

- Path: `/Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/baked_sweet_potato.png`
- Size: `159837` bytes

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/beef_steak.png

*Binary asset omitted from inline concatenation.*

- Path: `/Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/beef_steak.png`
- Size: `191592` bytes

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/bread_basket.png

*Binary asset omitted from inline concatenation.*

- Path: `/Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/bread_basket.png`
- Size: `92990` bytes

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/cinnamon.png

*Binary asset omitted from inline concatenation.*

- Path: `/Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/cinnamon.png`
- Size: `133562` bytes

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/clear_broth.png

*Binary asset omitted from inline concatenation.*

- Path: `/Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/clear_broth.png`
- Size: `152616` bytes

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/cottage_cheese.png

*Binary asset omitted from inline concatenation.*

- Path: `/Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/cottage_cheese.png`
- Size: `167321` bytes

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/french_fries.png

*Binary asset omitted from inline concatenation.*

- Path: `/Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/french_fries.png`
- Size: `107560` bytes

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/fresh_banana.png

*Binary asset omitted from inline concatenation.*

- Path: `/Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/fresh_banana.png`
- Size: `35135` bytes

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/fresh_broccoli.png

*Binary asset omitted from inline concatenation.*

- Path: `/Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/fresh_broccoli.png`
- Size: `93537` bytes

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/golden_toast.png

*Binary asset omitted from inline concatenation.*

- Path: `/Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/golden_toast.png`
- Size: `170346` bytes

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/green_herbs.png

*Binary asset omitted from inline concatenation.*

- Path: `/Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/green_herbs.png`
- Size: `184965` bytes

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/honey_pot.png

*Binary asset omitted from inline concatenation.*

- Path: `/Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/honey_pot.png`
- Size: `144910` bytes

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/leafy_greens.png

*Binary asset omitted from inline concatenation.*

- Path: `/Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/leafy_greens.png`
- Size: `103018` bytes

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/mashed_potatoes.png

*Binary asset omitted from inline concatenation.*

- Path: `/Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/mashed_potatoes.png`
- Size: `148785` bytes

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/mixed_berries.png

*Binary asset omitted from inline concatenation.*

- Path: `/Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/mixed_berries.png`
- Size: `185462` bytes

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/onion_group.png

*Binary asset omitted from inline concatenation.*

- Path: `/Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/onion_group.png`
- Size: `182823` bytes

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/pepper.png

*Binary asset omitted from inline concatenation.*

- Path: `/Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/pepper.png`
- Size: `109299` bytes

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/pork_chop.png

*Binary asset omitted from inline concatenation.*

- Path: `/Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/pork_chop.png`
- Size: `138169` bytes

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/poultry_drumstick.png

*Binary asset omitted from inline concatenation.*

- Path: `/Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/poultry_drumstick.png`
- Size: `87288` bytes

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/raw_carrot.png

*Binary asset omitted from inline concatenation.*

- Path: `/Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/raw_carrot.png`
- Size: `94345` bytes

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/raw_potato.png

*Binary asset omitted from inline concatenation.*

- Path: `/Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/raw_potato.png`
- Size: `357299` bytes

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/raw_zucchini.png

*Binary asset omitted from inline concatenation.*

- Path: `/Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/raw_zucchini.png`
- Size: `180305` bytes

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/rice_bowl.png

*Binary asset omitted from inline concatenation.*

- Path: `/Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/rice_bowl.png`
- Size: `100796` bytes

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/salmon_fillet.png

*Binary asset omitted from inline concatenation.*

- Path: `/Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/salmon_fillet.png`
- Size: `117507` bytes

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/soft_boiled_egg.png

*Binary asset omitted from inline concatenation.*

- Path: `/Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/soft_boiled_egg.png`
- Size: `129919` bytes

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/spaghetti_pasta.png

*Binary asset omitted from inline concatenation.*

- Path: `/Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/spaghetti_pasta.png`
- Size: `231549` bytes

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/wedge_of_cheese.png

*Binary asset omitted from inline concatenation.*

- Path: `/Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/wedge_of_cheese.png`
- Size: `135365` bytes

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/white_fish.png

*Binary asset omitted from inline concatenation.*

- Path: `/Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/white_fish.png`
- Size: `168778` bytes

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/yogurt_pot.png

*Binary asset omitted from inline concatenation.*

- Path: `/Users/peterjamesblizzard/projects/caca_traca/src/assets/transit-map/yogurt_pot.png`
- Size: `231815` bytes

---

