import type { FoodGroup } from "@shared/foodRegistry";
import type { ColumnFiltersState, SortingState } from "@tanstack/react-table";

import type { FoodDatabaseRow } from "./columns";

const FILTERABLE_COLUMN_IDS = new Set(["status", "category", "stage"]);
const SORTABLE_COLUMN_IDS = new Set(["lastTested", "bristolAvg", "transitAvg", "trials", "stage"]);

export interface SmartViewPreset {
  id: string;
  label: string;
  columnFilters: ColumnFiltersState;
  sorting: SortingState;
  builtIn?: boolean;
}

function safeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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

export function columnFiltersEqual(a: ColumnFiltersState, b: ColumnFiltersState): boolean {
  const left = normalizeColumnFilters(a);
  const right = normalizeColumnFilters(b);
  return JSON.stringify(left) === JSON.stringify(right);
}

export function sortingEqual(a: SortingState, b: SortingState): boolean {
  const left = normalizeSorting(a);
  const right = normalizeSorting(b);
  return JSON.stringify(left) === JSON.stringify(right);
}

function rowMatchesStatusFilter(row: FoodDatabaseRow, values: string[]): boolean {
  return values.some((value) => {
    // Handle compound values like "safe-loose" and "safe-hard"
    if (value === "safe-loose") return row.primaryStatus === "safe" && row.tendency === "loose";
    if (value === "safe-hard") return row.primaryStatus === "safe" && row.tendency === "hard";
    return value === row.primaryStatus;
  });
}

function rowMatchesCategoryFilter(row: FoodDatabaseRow, values: string[]): boolean {
  if (row.foodGroup === undefined) return false;
  return values.some((value): value is FoodGroup => value === row.foodGroup);
}

function rowMatchesZoneFilter(row: FoodDatabaseRow, values: string[]): boolean {
  if (row.stage === undefined) return false;
  return values.includes(String(row.stage));
}

function rowMatchesNormalizedFilters(row: FoodDatabaseRow, filters: ColumnFiltersState): boolean {
  for (const filter of filters) {
    const values = safeStringArray(filter.value);
    if (values.length === 0) continue;
    if (filter.id === "status" && !rowMatchesStatusFilter(row, values)) return false;
    if (filter.id === "category" && !rowMatchesCategoryFilter(row, values)) return false;
    if (filter.id === "stage" && !rowMatchesZoneFilter(row, values)) return false;
  }
  return true;
}

export function rowMatchesFilters(row: FoodDatabaseRow, filters: ColumnFiltersState): boolean {
  const normalized = normalizeColumnFilters(filters);
  return rowMatchesNormalizedFilters(row, normalized);
}

export function countRowsForView(rows: readonly FoodDatabaseRow[], view: SmartViewPreset): number {
  const normalized = normalizeColumnFilters(view.columnFilters);
  return rows.filter((row) => rowMatchesNormalizedFilters(row, normalized)).length;
}

export interface SmartViewsProps {
  views: SmartViewPreset[];
  activeViewId: string | null;
  counts?: Record<string, number>;
  onSelectView: (viewId: string) => void;
  onDeleteView: (viewId: string) => void;
}

export function SmartViews({
  views,
  activeViewId,
  counts,
  onSelectView,
  onDeleteView,
}: SmartViewsProps) {
  return (
    <div data-slot="smart-views" className="flex flex-wrap gap-2">
      {views.map((view) => {
        const isActive = activeViewId === view.id;
        const count = counts?.[view.id];

        return (
          <div
            key={view.id}
            className={[
              "inline-flex items-center rounded-lg border",
              isActive
                ? "border-[var(--border-strong)] bg-[var(--surface-3)]"
                : "border-[var(--border)] bg-transparent",
            ].join(" ")}
          >
            <button
              type="button"
              onClick={() => onSelectView(view.id)}
              data-active={isActive || undefined}
              className={[
                "inline-flex min-h-11 items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors",
                isActive
                  ? "text-[var(--text)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text)]",
              ].join(" ")}
            >
              {view.label}
              {count !== undefined && (
                <span
                  className={[
                    "inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1 font-mono text-[10px] font-bold leading-tight",
                    isActive
                      ? "bg-[var(--surface-2)] text-[var(--text)]"
                      : "bg-[var(--surface-2)] text-[var(--text-faint)]",
                  ].join(" ")}
                >
                  {count}
                </span>
              )}
            </button>

            {!view.builtIn && (
              <button
                type="button"
                onClick={() => onDeleteView(view.id)}
                className="inline-flex min-h-11 items-center border-l border-[var(--border)] px-2 font-mono text-[10px] uppercase tracking-wide text-[var(--text-faint)] transition-colors hover:text-red-300"
                aria-label={`Delete smart view ${view.label}`}
                title={`Delete ${view.label}`}
              >
                Del
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
