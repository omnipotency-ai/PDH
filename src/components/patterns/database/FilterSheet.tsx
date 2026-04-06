import type { FoodGroup } from "@shared/foodRegistry";
import type {
  ColumnFiltersState,
  OnChangeFn,
  SortingState,
} from "@tanstack/react-table";
import { useCallback, useRef, useState } from "react";
import { ResponsiveShell } from "@/components/ui/responsive-shell";
import { getColumnFilterValues } from "./filterUtils";
import { SORT_OPTIONS } from "./smartViewUtils";

// ── Status filter value type ──────────────────────────────────────────────────
//
// The filter UI supports compound values like "safe-loose" and "safe-hard"
// that combine FoodPrimaryStatus ("safe") with FoodTendency ("loose" | "hard").
// The column filterFn in columns.tsx understands these compound values.

export type StatusFilterValue =
  | "building"
  | "safe"
  | "safe-loose"
  | "safe-hard"
  | "watch"
  | "avoid";

// ── Constants ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: ReadonlyArray<{
  value: StatusFilterValue;
  label: string;
}> = [
  { value: "building", label: "Building" },
  { value: "safe", label: "Safe" },
  { value: "safe-loose", label: "Safe (Loose)" },
  { value: "safe-hard", label: "Safe (Hard)" },
  { value: "watch", label: "Watch" },
  { value: "avoid", label: "Avoid" },
];

const CATEGORY_OPTIONS: ReadonlyArray<{
  value: FoodGroup;
  label: string;
}> = [
  { value: "protein", label: "Protein" },
  { value: "carbs", label: "Carbs" },
  { value: "fats", label: "Fats" },
  { value: "seasoning", label: "Seasoning" },
];

const ZONE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "1", label: "Zone 1 (Early)" },
  { value: "2", label: "Zone 2 (Moderate)" },
  { value: "3", label: "Zone 3 (Variety)" },
];

type FilterChipOption<T extends string> = {
  value: T;
  label: string;
};

// ── Utility ──────────────────────────────────────────────────────────────────

/**
 * Count the number of active column filters.
 * Useful for showing a badge on the filter trigger button.
 */
export function countActiveFilters(filters: ColumnFiltersState): number {
  return filters.reduce((count, filter) => {
    if (Array.isArray(filter.value)) return count + filter.value.length;
    if (typeof filter.value === "string" && filter.value.length > 0)
      return count + 1;
    return count;
  }, 0);
}

function toggleFilterValue(
  filters: ColumnFiltersState,
  columnId: string,
  value: string,
): ColumnFiltersState {
  const current = getColumnFilterValues<string>(filters, columnId);
  const next = current.includes(value)
    ? current.filter((candidate) => candidate !== value)
    : [...current, value];

  if (next.length === 0) {
    return filters.filter((filter) => filter.id !== columnId);
  }

  const existing = filters.find((filter) => filter.id === columnId);
  if (existing !== undefined) {
    return filters.map((filter) =>
      filter.id === columnId ? { ...filter, value: next } : filter,
    );
  }

  return [...filters, { id: columnId, value: next }];
}

function getFilterChipClassName(isActive: boolean): string {
  return [
    "inline-flex items-center rounded-lg border px-3 py-2.5 text-xs font-medium transition-colors",
    isActive
      ? "border-[var(--border-strong)] bg-[var(--surface-3)] text-[var(--text)]"
      : "border-[var(--border)] bg-transparent text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:text-[var(--text)]",
  ].join(" ");
}

interface FilterChipGroupProps<T extends string> {
  activeValues: readonly T[];
  label: string;
  onToggle: (value: T) => void;
  options: ReadonlyArray<FilterChipOption<T>>;
  slot: string;
}

function FilterChipGroup<T extends string>({
  activeValues,
  label,
  onToggle,
  options,
  slot,
}: FilterChipGroupProps<T>) {
  return (
    <section data-slot={slot}>
      <h3 className="mb-3 font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--text-faint)]">
        {label}
      </h3>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isActive = activeValues.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onToggle(option.value)}
              aria-pressed={isActive}
              data-active={isActive || undefined}
              className={getFilterChipClassName(isActive)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ── Props ────────────────────────────────────────────────────────────────────

export interface FilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columnFilters: ColumnFiltersState;
  onColumnFiltersChange: OnChangeFn<ColumnFiltersState>;
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  onApply: () => void;
  onSaveView: (name: string) => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export function FilterSheet({
  open,
  onOpenChange,
  columnFilters,
  onColumnFiltersChange,
  sorting,
  onSortingChange,
  onApply,
  onSaveView,
}: FilterSheetProps) {
  const activeStatus = getColumnFilterValues<StatusFilterValue>(
    columnFilters,
    "status",
  );
  const activeCategory = getColumnFilterValues<FoodGroup>(
    columnFilters,
    "category",
  );
  const activeZone = getColumnFilterValues<string>(columnFilters, "stage");
  const activeSort = sorting[0] ?? { id: "lastTested", desc: true };

  // ── Save-view inline form state ─────────────────────────────────────────
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [viewName, setViewName] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);

  const handleSaveViewButtonClick = useCallback(() => {
    setSaveViewOpen(true);
    setViewName("");
    // Focus the input after the next paint
    requestAnimationFrame(() => {
      nameInputRef.current?.focus();
    });
  }, []);

  const handleSaveViewCancel = useCallback(() => {
    setSaveViewOpen(false);
    setViewName("");
  }, []);

  const handleSaveViewConfirm = useCallback(() => {
    const trimmed = viewName.trim();
    if (trimmed.length === 0) return;
    onSaveView(trimmed);
    setSaveViewOpen(false);
    setViewName("");
  }, [viewName, onSaveView]);

  const handleStatusClick = useCallback(
    (value: StatusFilterValue) => {
      onColumnFiltersChange((prev) => toggleFilterValue(prev, "status", value));
    },
    [onColumnFiltersChange],
  );

  const handleCategoryClick = useCallback(
    (value: FoodGroup) => {
      onColumnFiltersChange((prev) =>
        toggleFilterValue(prev, "category", value),
      );
    },
    [onColumnFiltersChange],
  );

  const handleZoneClick = useCallback(
    (value: string) => {
      onColumnFiltersChange((prev) => toggleFilterValue(prev, "stage", value));
    },
    [onColumnFiltersChange],
  );

  const handleSortByChange = useCallback(
    (nextColumnId: string) => {
      onSortingChange([{ id: nextColumnId, desc: activeSort.desc }]);
    },
    [activeSort.desc, onSortingChange],
  );

  const handleSortDirectionToggle = useCallback(() => {
    onSortingChange([{ id: activeSort.id, desc: !activeSort.desc }]);
  }, [activeSort.desc, activeSort.id, onSortingChange]);

  const handleClearAll = useCallback(() => {
    onColumnFiltersChange([]);
  }, [onColumnFiltersChange]);

  const hasActiveFilters = columnFilters.length > 0;

  return (
    <ResponsiveShell open={open} onOpenChange={onOpenChange} title="Filters">
      <div data-slot="filter-sheet-body" className="flex flex-col gap-6 p-4">
        <FilterChipGroup
          slot="filter-section-status"
          label="Status"
          options={STATUS_OPTIONS}
          activeValues={activeStatus}
          onToggle={handleStatusClick}
        />

        <FilterChipGroup
          slot="filter-section-category"
          label="Category"
          options={CATEGORY_OPTIONS}
          activeValues={activeCategory}
          onToggle={handleCategoryClick}
        />

        <FilterChipGroup
          slot="filter-section-zone"
          label="Zone"
          options={ZONE_OPTIONS}
          activeValues={activeZone}
          onToggle={handleZoneClick}
        />

        {/* Sorting controls */}
        <section data-slot="filter-section-sorting">
          <h3 className="mb-3 font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--text-faint)]">
            Sort
          </h3>
          <div className="flex items-center gap-2">
            <select
              value={activeSort.id}
              onChange={(event) => handleSortByChange(event.target.value)}
              className="min-h-11 min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2.5 font-mono text-xs text-[var(--text)] focus:border-[var(--border-strong)] focus:outline-none"
              aria-label="Sort by"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleSortDirectionToggle}
              className="inline-flex min-h-11 min-w-24 items-center justify-center rounded-lg border border-[var(--border)] bg-transparent px-3 py-2.5 font-mono text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text)]"
              aria-label={`Sort direction ${activeSort.desc ? "descending" : "ascending"}`}
            >
              {activeSort.desc ? "Desc" : "Asc"}
            </button>
          </div>
        </section>

        {/* Inline save-view form — shown when the user clicks "Save as view" */}
        {saveViewOpen && (
          <section data-slot="filter-section-save-view">
            <h3 className="mb-3 font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--text-faint)]">
              Name this view
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveViewConfirm();
              }}
              className="flex flex-col gap-2"
            >
              <input
                ref={nameInputRef}
                type="text"
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                placeholder="e.g. Safe proteins"
                aria-label="Smart view name"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 font-mono text-xs text-[var(--text)] placeholder:text-[var(--text-faint)] focus:border-[var(--border-strong)] focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={viewName.trim().length === 0}
                  className="flex-1 rounded-lg border border-teal-500/60 bg-teal-900/30 px-3 py-2 text-xs font-semibold text-teal-200 transition-colors hover:border-teal-400 hover:bg-teal-900/40 hover:text-teal-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={handleSaveViewCancel}
                  className="flex-1 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-xs font-medium text-[var(--text-muted)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        )}
      </div>

      {/* Footer actions */}
      <div
        data-slot="filter-sheet-footer"
        className="border-t border-[var(--border)] p-4"
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={handleSaveViewButtonClick}
            className="w-full rounded-lg border border-[var(--border)] bg-transparent px-4 py-2 text-sm font-medium text-[var(--text-muted)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
          >
            Save as view
          </button>

          <button
            type="button"
            onClick={onApply}
            className="w-full rounded-lg border border-teal-500/60 bg-teal-900/30 px-4 py-2 text-sm font-semibold text-teal-200 transition-colors hover:border-teal-400 hover:bg-teal-900/40 hover:text-teal-100"
          >
            Apply filters
          </button>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearAll}
              className="w-full rounded-lg border border-[var(--border)] bg-transparent px-4 py-2 text-sm font-medium text-[var(--text-muted)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
            >
              Clear all
            </button>
          )}
        </div>
      </div>
    </ResponsiveShell>
  );
}
