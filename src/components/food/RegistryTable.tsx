import type { SortDirection, SortingState } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Search,
  Utensils,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import { getZoneBadgeClasses, type Zone } from "@/lib/zoneColors";
import { api } from "../../../convex/_generated/api";
import { EditableCell } from "./EditableCell";
import { EditableNumberCell } from "./EditableNumberCell";
import { EditableSelectCell } from "./EditableSelectCell";
import { OFFImportDialog } from "./OFFImportDialog";
import type { RegistryRow } from "./registryColumns";
import { buildRegistryColumns, STATUS_OPTIONS } from "./registryColumns";
import { AddRowButton, RowDeleteButton } from "./TableActions";

// ── Sort indicator ──────────────────────────────────────────────────────────

function SortIndicator({ direction }: { direction: false | SortDirection }) {
  if (direction === "asc") {
    return <ArrowUp size={12} className="shrink-0" />;
  }
  if (direction === "desc") {
    return <ArrowDown size={12} className="shrink-0" />;
  }
  return <ArrowUpDown size={12} className="shrink-0 opacity-30" />;
}

// ── Page size options ───────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

// ── Skeleton loading rows ───────────────────────────────────────────────────

function SkeletonRows({ columnCount }: { columnCount: number }) {
  const widths = ["w-32", "w-12", "w-20", "w-24", "w-16", "w-20"];
  return (
    <>
      {Array.from({ length: 5 }).map((_, rowIdx) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: stable skeleton indices
        <tr key={rowIdx} className="border-b border-[var(--border)]">
          {Array.from({ length: columnCount }).map((_, colIdx) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: stable skeleton indices
            <td key={colIdx} className="px-3 py-2.5">
              <div
                className={cn(
                  "h-4 animate-pulse rounded bg-[var(--surface-2)]",
                  widths[(rowIdx + colIdx) % widths.length],
                )}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ── Zone badge (read-only) ──────────────────────────────────────────────────

function ZoneBadge({ zone }: { zone: Zone | undefined }) {
  if (zone === undefined) {
    return <span className="text-xs text-[var(--text-faint)]">{"\u2014"}</span>;
  }
  return (
    <span
      className={cn(
        "inline-flex size-6 items-center justify-center rounded-full text-[10px] font-bold",
        getZoneBadgeClasses(zone),
      )}
    >
      {zone}
    </span>
  );
}

// ── Source badge (read-only) ────────────────────────────────────────────────

function SourceBadge({ source }: { source: "manual" | "openfoodfacts" | null }) {
  if (source === null) {
    return <span className="text-xs text-[var(--text-faint)]">{"\u2014"}</span>;
  }
  const label = source === "openfoodfacts" ? "OFF" : "Manual";
  return (
    <span className="inline-flex items-center rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
      {label}
    </span>
  );
}

// ── RegistryTable ───────────────────────────────────────────────────────────

export function RegistryTable() {
  const profiles = useQuery(api.ingredientProfiles.list);
  const registryEntries = useQuery(api.clinicalRegistry.list);
  const upsert = useMutation(api.ingredientProfiles.upsert);
  const remove = useMutation(api.ingredientProfiles.remove);
  const setToleranceStatus = useMutation(api.ingredientProfiles.setToleranceStatus);

  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [offImportOpen, setOffImportOpen] = useState(false);

  // Build a lookup map from clinicalRegistry id -> entry
  const registryMap = useMemo(() => {
    if (registryEntries === undefined)
      return new Map<string, { zone: 1 | 2 | 3; canonicalName: string }>();
    const map = new Map<string, { zone: 1 | 2 | 3; canonicalName: string }>();
    for (const entry of registryEntries) {
      map.set(entry._id, {
        zone: entry.zone,
        canonicalName: entry.canonicalName,
      });
    }
    return map;
  }, [registryEntries]);

  // Transform query results to flattened RegistryRow[]
  const rows: RegistryRow[] = useMemo(() => {
    if (profiles === undefined) return [];
    return profiles.map((p) => {
      const registryEntry = p.registryId !== undefined ? registryMap.get(p.registryId) : undefined;
      return {
        _id: p._id,
        canonicalName: p.canonicalName,
        displayName: p.displayName,
        productName: p.productName,
        kcal: p.nutritionPer100g.kcal,
        proteinG: p.nutritionPer100g.proteinG,
        carbsG: p.nutritionPer100g.carbsG,
        fatG: p.nutritionPer100g.fatG,
        sugarsG: p.nutritionPer100g.sugarsG,
        fiberG: p.nutritionPer100g.fiberG,
        source: p.source,
        registryId: p.registryId,
        zoneName: registryEntry?.canonicalName,
        zone: registryEntry?.zone,
        toleranceStatus: p.toleranceStatus,
        nutritionPer100g: p.nutritionPer100g,
      };
    });
  }, [profiles, registryMap]);

  // Build columns with cell renderers
  const columns = useMemo(() => {
    const base = buildRegistryColumns();

    // Override cell renderers per column
    for (const col of base) {
      switch (col.id) {
        case "displayName":
          col.cell = ({ row }) => (
            <EditableCell
              value={row.original.displayName}
              onSave={async (value) => {
                await upsert({
                  canonicalName: row.original.canonicalName,
                  displayName: value,
                  now: Date.now(),
                });
              }}
              placeholder="Food name"
            />
          );
          break;

        case "productName":
          col.cell = ({ row }) => (
            <EditableCell
              value={row.original.productName ?? ""}
              onSave={async (value) => {
                await upsert({
                  canonicalName: row.original.canonicalName,
                  displayName: row.original.displayName,
                  productName: value || null,
                  now: Date.now(),
                });
              }}
              placeholder="Product"
            />
          );
          break;

        case "zone":
          col.cell = ({ row }) => <ZoneBadge zone={row.original.zone} />;
          break;

        case "toleranceStatus":
          col.cell = ({ row }) => (
            <EditableSelectCell
              value={row.original.toleranceStatus ?? null}
              options={[...STATUS_OPTIONS]}
              onSave={async (value) => {
                await setToleranceStatus({
                  id: row.original._id,
                  status: value as "building" | "like" | "dislike" | "watch" | "avoid",
                });
              }}
            />
          );
          break;

        case "kcal":
          col.cell = ({ row }) => (
            <EditableNumberCell
              value={row.original.kcal}
              suffix=" kcal"
              onSave={async (value) => {
                await upsert({
                  canonicalName: row.original.canonicalName,
                  displayName: row.original.displayName,
                  nutritionPer100g: {
                    ...row.original.nutritionPer100g,
                    kcal: value,
                  },
                  now: Date.now(),
                });
              }}
            />
          );
          break;

        case "proteinG":
          col.cell = ({ row }) => (
            <EditableNumberCell
              value={row.original.proteinG}
              suffix="g"
              onSave={async (value) => {
                await upsert({
                  canonicalName: row.original.canonicalName,
                  displayName: row.original.displayName,
                  nutritionPer100g: {
                    ...row.original.nutritionPer100g,
                    proteinG: value,
                  },
                  now: Date.now(),
                });
              }}
            />
          );
          break;

        case "carbsG":
          col.cell = ({ row }) => (
            <EditableNumberCell
              value={row.original.carbsG}
              suffix="g"
              onSave={async (value) => {
                await upsert({
                  canonicalName: row.original.canonicalName,
                  displayName: row.original.displayName,
                  nutritionPer100g: {
                    ...row.original.nutritionPer100g,
                    carbsG: value,
                  },
                  now: Date.now(),
                });
              }}
            />
          );
          break;

        case "fatG":
          col.cell = ({ row }) => (
            <EditableNumberCell
              value={row.original.fatG}
              suffix="g"
              onSave={async (value) => {
                await upsert({
                  canonicalName: row.original.canonicalName,
                  displayName: row.original.displayName,
                  nutritionPer100g: {
                    ...row.original.nutritionPer100g,
                    fatG: value,
                  },
                  now: Date.now(),
                });
              }}
            />
          );
          break;

        case "fiberG":
          col.cell = ({ row }) => (
            <EditableNumberCell
              value={row.original.fiberG}
              suffix="g"
              onSave={async (value) => {
                await upsert({
                  canonicalName: row.original.canonicalName,
                  displayName: row.original.displayName,
                  nutritionPer100g: {
                    ...row.original.nutritionPer100g,
                    fiberG: value,
                  },
                  now: Date.now(),
                });
              }}
            />
          );
          break;

        case "source":
          col.cell = ({ row }) => <SourceBadge source={row.original.source} />;
          break;

        case "actions":
          col.cell = ({ row }) => (
            <RowDeleteButton
              onDelete={async () => {
                await remove({ id: row.original._id });
              }}
            />
          );
          break;
      }
    }

    return base;
  }, [upsert, remove, setToleranceStatus]);

  const handleAddFood = useCallback(async () => {
    await upsert({
      canonicalName: `new-food-${Date.now()}`,
      displayName: "New Food",
      nutritionPer100g: {
        kcal: null,
        fatG: null,
        saturatedFatG: null,
        carbsG: null,
        sugarsG: null,
        fiberG: null,
        proteinG: null,
        saltG: null,
      },
      now: Date.now(),
    });
  }, [upsert]);

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => row._id,
    globalFilterFn: (row, _columnId, filterValue) => {
      if (typeof filterValue !== "string" || filterValue.length === 0) return true;
      const query = filterValue.toLowerCase();
      return (
        row.original.displayName.toLowerCase().includes(query) ||
        (row.original.productName?.toLowerCase().includes(query) ?? false) ||
        row.original.canonicalName.toLowerCase().includes(query)
      );
    },
    initialState: {
      pagination: { pageSize: 25 },
    },
    state: {
      globalFilter,
      sorting,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
  });

  const { pageIndex, pageSize } = table.getState().pagination;
  const pageCount = table.getPageCount();
  const totalRows = table.getFilteredRowModel().rows.length;

  const isLoading = profiles === undefined || registryEntries === undefined;
  const isEmpty = !isLoading && profiles.length === 0;
  const hasNoResults = !isLoading && !isEmpty && table.getRowModel().rows.length === 0;

  return (
    <div data-slot="registry-table" className="flex flex-col gap-3">
      {/* Toolbar: search + add */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search
            size={14}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--text-faint)]"
          />
          <input
            type="text"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Search foods..."
            className={cn(
              "w-full rounded-lg border border-[var(--border)] bg-[var(--surface-1)] py-2 pr-3 pl-9 text-sm text-[var(--text)]",
              "placeholder:text-[var(--text-faint)]",
              "focus:border-[var(--border-strong)] focus:outline-none",
            )}
          />
        </div>
        <AddRowButton onAdd={handleAddFood} label="Add Food" />
      </div>

      {/* Scrollable table container */}
      <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface-1)]">
        <table className="w-full min-w-[1000px] border-collapse">
          {/* Header */}
          <thead className="sticky top-0 z-10 bg-[var(--surface-2)]">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header, colIdx) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  const isFirstCol = colIdx === 0;

                  return (
                    <th
                      key={header.id}
                      className={cn(
                        "px-3 py-2.5 text-left",
                        isFirstCol &&
                          "sticky left-0 z-20 bg-[var(--surface-2)] after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-[var(--border)]",
                      )}
                      style={{ width: header.getSize() }}
                      {...(canSort && {
                        "aria-sort":
                          sorted === "asc"
                            ? "ascending"
                            : sorted === "desc"
                              ? "descending"
                              : "none",
                      })}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="flex items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)] transition-colors hover:text-[var(--text)]"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <SortIndicator direction={sorted} />
                        </button>
                      ) : (
                        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)]">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </span>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>

          {/* Body */}
          <tbody>
            {isLoading ? (
              <SkeletonRows columnCount={columns.length} />
            ) : isEmpty ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <Utensils size={32} className="text-[var(--text-faint)] opacity-40" />
                    <p className="font-mono text-sm text-[var(--text-faint)]">
                      No foods in your registry yet
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void handleAddFood()}
                        className="rounded-lg bg-[var(--surface-2)] px-4 py-2 text-sm font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--text)]"
                      >
                        Add your first food
                      </button>
                      <button
                        type="button"
                        onClick={() => setOffImportOpen(true)}
                        className="rounded-lg bg-[var(--surface-2)] px-4 py-2 text-sm font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--text)]"
                      >
                        Import from OpenFoodFacts
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            ) : hasNoResults ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <Search size={32} className="text-[var(--text-faint)] opacity-40" />
                    <p className="font-mono text-sm text-[var(--text-faint)]">No results found</p>
                    <button
                      type="button"
                      onClick={() => setGlobalFilter("")}
                      className="rounded-lg bg-[var(--surface-2)] px-4 py-2 text-sm font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--text)]"
                    >
                      Clear search
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  data-slot="registry-row"
                  className="border-b border-[var(--border)] transition-colors hover:bg-[var(--surface-2)]/70"
                >
                  {row.getVisibleCells().map((cell, colIdx) => (
                    <td
                      key={cell.id}
                      className={cn(
                        "px-3 py-2",
                        colIdx === 0 &&
                          "sticky left-0 z-[1] bg-[var(--surface-1)] transition-colors after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-[var(--border)]",
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination controls — only show when data is loaded */}
      {!isLoading && (
        <div
          data-slot="registry-pagination"
          className="flex items-center justify-between gap-4 px-1"
        >
          {/* Row count summary */}
          <span className="font-mono text-xs text-[var(--text-faint)]">
            {totalRows === 0
              ? "0 rows"
              : `${pageIndex * pageSize + 1}\u2013${Math.min(
                  (pageIndex + 1) * pageSize,
                  totalRows,
                )} of ${totalRows}`}
          </span>

          <div className="flex items-center gap-3">
            {/* Page size selector */}
            <div className="flex items-center gap-1.5">
              <label
                htmlFor="registry-page-size"
                className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-faint)]"
              >
                Rows
              </label>
              <select
                id="registry-page-size"
                value={pageSize}
                onChange={(e) => {
                  table.setPageSize(Number(e.target.value));
                }}
                className="rounded border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 font-mono text-xs text-[var(--text-muted)] focus:border-[var(--border-strong)] focus:outline-none"
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>

            {/* Page navigation */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="inline-flex size-7 min-h-11 min-w-11 items-center justify-center rounded border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Previous page"
              >
                <ChevronLeft size={14} />
              </button>

              <span className="px-2 font-mono text-xs text-[var(--text-muted)]">
                {pageCount === 0 ? "0 / 0" : `${pageIndex + 1} / ${pageCount}`}
              </span>

              <button
                type="button"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="inline-flex size-7 min-h-11 min-w-11 items-center justify-center rounded border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Next page"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OFFImportDialog */}
      <OFFImportDialog open={offImportOpen} onOpenChange={setOffImportOpen} />
    </div>
  );
}
