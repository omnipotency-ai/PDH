import type { FoodGroup } from "@shared/foodRegistry";
import type { ColumnFiltersState, SortingState } from "@tanstack/react-table";

import type { FoodDatabaseRow } from "./columns";

// ── Constants ────────────────────────────────────────────────────────────────

const FILTERABLE_COLUMN_IDS = new Set(["status", "category", "stage"]);

/**
 * SORT_OPTIONS is the single source of truth for sortable columns.
 * SORTABLE_COLUMN_IDS is derived from it to prevent silent divergence.
 */
export const SORT_OPTIONS = [
  { value: "lastTested", label: "Last Tested" },
  { value: "bristolAvg", label: "Bristol Avg" },
  { value: "transitAvg", label: "Transit Avg" },
  { value: "trials", label: "Trials" },
  { value: "stage", label: "Zone" },
] as const;

export type SortOptionValue = (typeof SORT_OPTIONS)[number]["value"];

export const SORTABLE_COLUMN_IDS = new Set<string>(
  SORT_OPTIONS.map((o) => o.value),
);

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SmartViewPreset {
  id: string;
  label: string;
  columnFilters: ColumnFiltersState;
  sorting: SortingState;
  builtIn?: boolean;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function safeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// ── Normalisation ─────────────────────────────────────────────────────────────

export function normalizeColumnFilters(input: unknown): ColumnFiltersState {
  if (!Array.isArray(input)) return [];

  const normalized: ColumnFiltersState = [];
  for (const filter of input) {
    if (!isRecord(filter)) continue;
    const raw = filter;
    if (typeof raw.id !== "string") continue;
    if (!FILTERABLE_COLUMN_IDS.has(raw.id)) continue;

    const values = safeStringArray(raw.value);
    if (values.length === 0) continue;
    normalized.push({
      id: raw.id,
      value: [...new Set(values)].sort(),
    });
  }

  return normalized.sort((a, b) => a.id.localeCompare(b.id));
}

export function normalizeSorting(input: unknown): SortingState {
  if (!Array.isArray(input) || input.length === 0) {
    return [{ id: "lastTested", desc: true }];
  }
  const first = input[0];
  if (!isRecord(first)) {
    return [{ id: "lastTested", desc: true }];
  }

  if (typeof first.id !== "string" || !SORTABLE_COLUMN_IDS.has(first.id)) {
    return [{ id: "lastTested", desc: true }];
  }

  return [{ id: first.id, desc: first.desc === true }];
}

// ── Equality helpers ──────────────────────────────────────────────────────────

export function columnFiltersEqual(
  a: ColumnFiltersState,
  b: ColumnFiltersState,
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const fa = a[i];
    const fb = b[i];
    if (fa.id !== fb.id) return false;
    const va = safeStringArray(fa.value);
    const vb = safeStringArray(fb.value);
    if (va.length !== vb.length) return false;
    for (let j = 0; j < va.length; j++) {
      if (va[j] !== vb[j]) return false;
    }
  }
  return true;
}

export function sortingEqual(a: SortingState, b: SortingState): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id || a[i].desc !== b[i].desc) return false;
  }
  return true;
}

// ── Row-matching helpers ──────────────────────────────────────────────────────

function rowMatchesStatusFilter(
  row: FoodDatabaseRow,
  values: string[],
): boolean {
  return values.some((value) => {
    // Handle compound values like "safe-loose" and "safe-hard"
    if (value === "safe-loose")
      return row.primaryStatus === "safe" && row.tendency === "loose";
    if (value === "safe-hard")
      return row.primaryStatus === "safe" && row.tendency === "hard";
    return value === row.primaryStatus;
  });
}

function rowMatchesCategoryFilter(
  row: FoodDatabaseRow,
  values: string[],
): boolean {
  if (row.foodGroup === undefined) return false;
  return values.some((value) => value === row.foodGroup);
}

function rowMatchesZoneFilter(row: FoodDatabaseRow, values: string[]): boolean {
  if (row.stage === undefined) return false;
  return values.includes(String(row.stage));
}

function rowMatchesNormalizedFilters(
  row: FoodDatabaseRow,
  filters: ColumnFiltersState,
): boolean {
  for (const filter of filters) {
    const values = safeStringArray(filter.value);
    if (values.length === 0) continue;
    if (filter.id === "status" && !rowMatchesStatusFilter(row, values))
      return false;
    if (filter.id === "category" && !rowMatchesCategoryFilter(row, values))
      return false;
    if (filter.id === "stage" && !rowMatchesZoneFilter(row, values))
      return false;
  }
  return true;
}

export function rowMatchesFilters(
  row: FoodDatabaseRow,
  filters: ColumnFiltersState,
): boolean {
  const normalized = normalizeColumnFilters(filters);
  return rowMatchesNormalizedFilters(row, normalized);
}

export function countRowsForView(
  rows: readonly FoodDatabaseRow[],
  view: SmartViewPreset,
): number {
  const normalized = normalizeColumnFilters(view.columnFilters);
  return rows.filter((row) => rowMatchesNormalizedFilters(row, normalized))
    .length;
}
