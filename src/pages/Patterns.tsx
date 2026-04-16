import type { FoodDigestionMetadata, FoodGroup } from "@shared/foodRegistry";
import type { FoodAssessmentRecord } from "@shared/foodEvidence";
import type { ColumnFiltersState, SortingState } from "@tanstack/react-table";
import type { FunctionReturnType } from "convex/server";
import { useConvex } from "convex/react";
import { format } from "date-fns";
import { Filter, RefreshCw, Search } from "lucide-react";
import { type MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  type ToleranceStatus,
} from "@/components/patterns/database";
import { useLiveClock } from "@/hooks/useLiveClock";
import { useHabits, useTransitCalibration } from "@/hooks/useProfile";
import { analyzeLogs } from "@/lib/analysis";
import { getErrorMessage } from "@/lib/errors";
import { toSyncedLogs } from "@/lib/sync";
import { api } from "../../convex/_generated/api";

// ── Constants ────────────────────────────────────────────────────────────────

const SMART_VIEWS_STORAGE_KEY = "patterns-smart-views-v1";
const FILTER_STATE_STORAGE_KEY = "patterns-filter-state-v1";
const ALL_VIEW_ID = "all";
const DEFAULT_SORTING: SortingState = [{ id: "lastTested", desc: true }];
type LogsListAllRow = NonNullable<FunctionReturnType<typeof api.logs.listAll>>;
type AllFoodTrialsResult = NonNullable<
  FunctionReturnType<typeof api.aggregateQueries.allFoodTrials>
>;
type ClinicalRegistryRows = NonNullable<
  FunctionReturnType<typeof api.clinicalRegistry.list>
>;
type IngredientProfileRows = NonNullable<
  FunctionReturnType<typeof api.ingredientProfiles.list>
>;
type AssessmentRows = NonNullable<
  FunctionReturnType<typeof api.foodAssessments.allAssessmentRecords>
>;

function mapVerdict(value: unknown): FoodAssessmentRecord["verdict"] {
  switch (value) {
    case "safe":
    case "watch":
    case "avoid":
    case "trial_next":
      return value;
    default:
      return "watch";
  }
}

function mapConfidence(value: unknown): FoodAssessmentRecord["confidence"] {
  switch (value) {
    case "low":
    case "medium":
    case "high":
      return value;
    default:
      return "low";
  }
}

function mapCausalRole(value: unknown): FoodAssessmentRecord["causalRole"] {
  switch (value) {
    case "primary":
    case "possible":
    case "unlikely":
      return value;
    default:
      return "unlikely";
  }
}

function mapChangeType(value: unknown): FoodAssessmentRecord["changeType"] {
  switch (value) {
    case "new":
    case "upgraded":
    case "downgraded":
    case "unchanged":
      return value;
    default:
      return "unchanged";
  }
}

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
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
        const row = entry as {
          id?: unknown;
          label?: unknown;
          columnFilters?: unknown;
          sorting?: unknown;
        };
        if (typeof row.id !== "string" || row.id.length === 0) return null;
        if (typeof row.label !== "string" || row.label.trim().length === 0) return null;
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

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        columnFilters: [],
        sorting: DEFAULT_SORTING,
        activeViewId: ALL_VIEW_ID,
      };
    }
    const obj = parsed as Record<string, unknown>;
    return {
      columnFilters: normalizeColumnFilters(obj["columnFilters"]),
      sorting: normalizeSorting(obj["sorting"]),
      activeViewId: typeof obj["activeViewId"] === "string" ? obj["activeViewId"] : ALL_VIEW_ID,
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
  const [savedViews, setSavedViews] = useState<SmartViewPreset[]>(readSavedSmartViews);
  const initialFilterState = useMemo(() => readFilterState(), []);

  const [activeViewId, setActiveViewId] = useState<string | null>(initialFilterState.activeViewId);
  const [appliedColumnFilters, setAppliedColumnFilters] = useState<ColumnFiltersState>(
    initialFilterState.columnFilters,
  );
  const [appliedSorting, setAppliedSorting] = useState<SortingState>(initialFilterState.sorting);

  const [draftColumnFilters, setDraftColumnFilters] = useState<ColumnFiltersState>(
    initialFilterState.columnFilters,
  );
  const [draftSorting, setDraftSorting] = useState<SortingState>(initialFilterState.sorting);
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
    setActiveViewId((current) => (current === nextActiveId ? current : nextActiveId));
  }, [appliedColumnFilters, appliedSorting, views]);

  useEffect(() => {
    const timer = setTimeout(() => {
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
    }, 300);
    return () => clearTimeout(timer);
  }, [savedViews]);

  useEffect(() => {
    const timer = setTimeout(() => {
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
    }, 300);
    return () => clearTimeout(timer);
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
      prevKeys.length !== nextKeys.length || nextKeys.some((key) => prev[key] !== next[key]);
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
      const existing = savedViews.find((view) => view.label.toLowerCase() === label.toLowerCase());

      if (existing) {
        const updated: SmartViewPreset = {
          ...existing,
          label,
          columnFilters: normalizedFilters,
          sorting: normalizedSorting,
        };
        setSavedViews((prev) => prev.map((view) => (view.id === existing.id ? updated : view)));
        setAppliedColumnFilters(normalizedFilters);
        setAppliedSorting(normalizedSorting);
        setActiveViewId(existing.id);
        setFilterSheetOpen(false);
        return;
      }

      const newView: SmartViewPreset = {
        id: `smart-${crypto.randomUUID()}`,
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

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a FoodDigestionMetadata object from a clinical registry row's fields.
 * Returns undefined when no relevant digestion fields are present.
 */
function buildDigestionMetadata(row: {
  osmoticEffect?: string;
  totalResidue?: string;
  fiberTotalApproxG?: number;
  fiberInsolubleLevel?: string;
  fiberSolubleLevel?: string;
  gasProducing?: string;
  irritantLoad?: string;
  highFatRisk?: string;
  lactoseRisk?: string;
}): FoodDigestionMetadata | undefined {
  // Conditional spreads avoid setting undefined on optional keys, satisfying
  // exactOptionalPropertyTypes. The cast to FoodDigestionMetadata is safe
  // because each value is narrowed to the correct literal union before spread.
  const metadata = {
    ...(row.osmoticEffect !== undefined && {
      osmoticEffect: row.osmoticEffect as FoodDigestionMetadata["osmoticEffect"],
    }),
    ...(row.totalResidue !== undefined && {
      totalResidue: row.totalResidue as FoodDigestionMetadata["totalResidue"],
    }),
    ...(row.fiberTotalApproxG !== undefined && {
      fiberTotalApproxG: row.fiberTotalApproxG,
    }),
    ...(row.fiberInsolubleLevel !== undefined && {
      fiberInsolubleLevel: row.fiberInsolubleLevel as FoodDigestionMetadata["fiberInsolubleLevel"],
    }),
    ...(row.fiberSolubleLevel !== undefined && {
      fiberSolubleLevel: row.fiberSolubleLevel as FoodDigestionMetadata["fiberSolubleLevel"],
    }),
    ...(row.gasProducing !== undefined && {
      gasProducing: row.gasProducing as FoodDigestionMetadata["gasProducing"],
    }),
    ...(row.irritantLoad !== undefined && {
      irritantLoad: row.irritantLoad as FoodDigestionMetadata["irritantLoad"],
    }),
    ...(row.highFatRisk !== undefined && {
      highFatRisk: row.highFatRisk as FoodDigestionMetadata["highFatRisk"],
    }),
    ...(row.lactoseRisk !== undefined && {
      lactoseRisk: row.lactoseRisk as FoodDigestionMetadata["lactoseRisk"],
    }),
  };
  return Object.keys(metadata).length > 0 ? (metadata as FoodDigestionMetadata) : undefined;
}

// ── Today Label (isolated timer to avoid full-page re-renders) ──────────────

function TodayLabel() {
  useLiveClock();
  const label = format(new Date(), "EEEE · MMM d, yyyy · h:mm a");

  return (
    <p className="font-mono text-xs uppercase tracking-[0.2em] text-(--section-summary) shrink-0">
      {label}
    </p>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PatternsPage() {
  const convex = useConvex();
  const { habits } = useHabits();
  const { transitCalibration } = useTransitCalibration();
  const [patternsData, setPatternsData] = useState<{
    logs: ReturnType<typeof toSyncedLogs>;
    foodTrials: AllFoodTrialsResult["trials"];
    mappedAssessments: FoodAssessmentRecord[];
    clinicalRegistryRows: ClinicalRegistryRows;
    ingredientProfileRows: IngredientProfileRows;
  } | null>(null);
  const [patternsLoading, setPatternsLoading] = useState(true);
  const [patternsError, setPatternsError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const refreshPatternsData = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setPatternsLoading(true);
    setPatternsError(null);

    try {
      const [
        logRows,
        allFoodTrialsResult,
        assessmentRecords,
        clinicalRegistryRows,
        ingredientProfileRows,
      ] = await Promise.all([
        convex.query(api.logs.listAll, {}),
        convex.query(api.aggregateQueries.allFoodTrials, {}),
        convex.query(api.foodAssessments.allAssessmentRecords, {}),
        convex.query(api.clinicalRegistry.list, {}),
        convex.query(api.ingredientProfiles.list, {}),
      ]);

      if (requestId !== requestIdRef.current) return;

      const mappedAssessments = (assessmentRecords as AssessmentRows).map((r) => ({
        canonicalName: r.canonicalName,
        foodName: r.foodName,
        food: r.foodName,
        verdict: mapVerdict(r.verdict),
        confidence: mapConfidence(r.confidence),
        causalRole: mapCausalRole(r.causalRole),
        changeType: mapChangeType(r.changeType),
        modifierSummary: r.modifierSummary ?? "",
        reasoning: r.reasoning,
        reportTimestamp: r.reportTimestamp,
      }));

      setPatternsData({
        logs: toSyncedLogs(logRows as LogsListAllRow),
        foodTrials: (allFoodTrialsResult as AllFoodTrialsResult).trials,
        mappedAssessments,
        clinicalRegistryRows: clinicalRegistryRows as ClinicalRegistryRows,
        ingredientProfileRows: ingredientProfileRows as IngredientProfileRows,
      });
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      setPatternsError(getErrorMessage(error, "Failed to refresh Patterns."));
    } finally {
      if (requestId === requestIdRef.current) {
        setPatternsLoading(false);
      }
    }
  }, [convex]);

  useEffect(() => {
    void refreshPatternsData();
  }, [refreshPatternsData]);

  const analysis = useMemo(
    () =>
      analyzeLogs(patternsData?.logs ?? [], patternsData?.foodTrials ?? [], {
        habits: habits.map((h) => ({ id: h.id, name: h.name })),
        calibration: transitCalibration,
        assessments: patternsData?.mappedAssessments ?? [],
      }),
    [habits, patternsData, transitCalibration],
  );

  const mappedAssessments = patternsData?.mappedAssessments ?? [];
  const clinicalRegistryRows = patternsData?.clinicalRegistryRows;
  const ingredientProfileRows = patternsData?.ingredientProfileRows;

  // Build O(1) lookup map: canonicalName (lowercase) → registry row.
  const registryByName = useMemo(() => {
    const map = new Map<
      string,
      {
        zone: 1 | 2 | 3;
        group: FoodGroup;
        notes?: string;
        osmoticEffect?: string;
        totalResidue?: string;
        fiberTotalApproxG?: number;
        fiberInsolubleLevel?: string;
        fiberSolubleLevel?: string;
        gasProducing?: string;
        irritantLoad?: string;
        highFatRisk?: string;
        lactoseRisk?: string;
      }
    >();
    for (const row of clinicalRegistryRows ?? []) {
      map.set(row.canonicalName.toLowerCase(), row);
    }
    return map;
  }, [clinicalRegistryRows]);

  // Build O(1) lookup map: canonicalName (lowercase) → toleranceStatus.
  const toleranceByName = useMemo(() => {
    const map = new Map<string, ToleranceStatus>();
    for (const profile of ingredientProfileRows ?? []) {
      if (profile.toleranceStatus !== undefined) {
        map.set(profile.canonicalName.toLowerCase(), profile.toleranceStatus as ToleranceStatus);
      }
    }
    return map;
  }, [ingredientProfileRows]);

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
      const key = stat.key.toLowerCase();
      const registryEntry = registryByName.get(key);

      // Zone defaults to 3 (experimental) when not in the clinical registry.
      const zone = registryEntry?.zone ?? 3;
      const foodGroup = registryEntry?.group;

      // Build digestion metadata from registry fields when present.
      const digestion: FoodDigestionMetadata | undefined = registryEntry
        ? buildDigestionMetadata(registryEntry)
        : undefined;

      const registryNotes = registryEntry?.notes;
      const toleranceStatus = toleranceByName.get(key);

      // Resolved trials for trial history display
      const resolvedTrials = analysis.resolvedTrialsByKey.get(stat.key) ?? undefined;

      // AI assessment for the AI column
      const aiAssessment = assessmentMap.get(key);

      return buildFoodDatabaseRow(stat, {
        stage: zone,
        ...(foodGroup !== undefined && { foodGroup }),
        ...(digestion !== undefined && { digestion }),
        ...(registryNotes !== undefined && { registryNotes }),
        ...(toleranceStatus !== undefined && { toleranceStatus }),
        ...(resolvedTrials !== undefined && { resolvedTrials }),
        ...(aiAssessment !== undefined && {
          aiVerdict: aiAssessment.verdict,
          aiConfidence: aiAssessment.confidence,
        }),
      });
    });
  }, [
    analysis.foodStats,
    analysis.resolvedTrialsByKey,
    mappedAssessments,
    registryByName,
    toleranceByName,
  ]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div data-slot="patterns-page" className="stagger-reveal mx-auto max-w-7xl space-y-5">
      {/* Page header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-baseline gap-4">
          <h1 className="font-sketch text-2xl font-bold tracking-tight text-(--section-summary) md:text-3xl shrink-0">
            Patterns
          </h1>
          <TodayLabel />
        </div>
        <button
          type="button"
          onClick={() => void refreshPatternsData()}
          disabled={patternsLoading}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--section-summary)]/20 bg-[var(--surface-1)] px-3 py-1.5 text-xs font-semibold text-[var(--section-summary)] transition-colors hover:bg-[var(--surface-2)] disabled:opacity-60"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${patternsLoading ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          <span>Refresh</span>
        </button>
      </header>

      {patternsError && (
        <p className="text-sm text-rose-500">{patternsError}</p>
      )}

      <section>
        <div className="mb-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--text-faint)]">
            Explore
          </p>
          <p className="text-sm text-[var(--text-muted)]">
            Browse your food database to see trial history, outcomes, and AI assessments.
          </p>
        </div>

        <DatabaseTabContent rows={databaseRows} />
      </section>
    </div>
  );
}
