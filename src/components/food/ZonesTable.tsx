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
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import { api } from "../../../convex/_generated/api";
import { AddRowButton } from "./TableActions";
import type { ZoneRow } from "./zonesColumns";
import { getZonesColumns } from "./zonesColumns";

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

// ── ZonesTable ──────────────────────────────────────────────────────────────

export function ZonesTable() {
  const data = useQuery(api.clinicalRegistry.list);
  const updateEntry = useMutation(api.clinicalRegistry.update);
  const removeEntry = useMutation(api.clinicalRegistry.remove);
  const createEntry = useMutation(api.clinicalRegistry.create);

  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);

  // Transform query results to ZoneRow[]
  const rows: ZoneRow[] = useMemo(() => {
    if (data === undefined) return [];
    return data.map((entry) => ({
      _id: entry._id,
      canonicalName: entry.canonicalName,
      zone: entry.zone,
      category: entry.category,
      subcategory: entry.subcategory,
      group: entry.group,
      line: entry.line,
      lineOrder: entry.lineOrder,
      ...(entry.osmoticEffect !== undefined && {
        osmoticEffect: entry.osmoticEffect,
      }),
      ...(entry.totalResidue !== undefined && {
        totalResidue: entry.totalResidue,
      }),
      ...(entry.gasProducing !== undefined && {
        gasProducing: entry.gasProducing,
      }),
      ...(entry.fiberTotalApproxG !== undefined && {
        fiberTotalApproxG: entry.fiberTotalApproxG,
      }),
      ...(entry.highFatRisk !== undefined && {
        highFatRisk: entry.highFatRisk,
      }),
      ...(entry.irritantLoad !== undefined && {
        irritantLoad: entry.irritantLoad,
      }),
      ...(entry.lactoseRisk !== undefined && {
        lactoseRisk: entry.lactoseRisk,
      }),
      ...(entry.notes !== undefined && { notes: entry.notes }),
    }));
  }, [data]);

  // Build columns with mutation callbacks
  const columns = useMemo(
    () =>
      getZonesColumns({
        update: updateEntry,
        remove: removeEntry,
      }),
    [updateEntry, removeEntry],
  );

  const handleAddZone = useCallback(async () => {
    await createEntry({
      canonicalName: `new-entry-${Date.now()}`,
      zone: 1,
      category: "protein",
      subcategory: "meat",
      group: "protein",
      line: "meat_fish",
      lineOrder: 999,
    });
  }, [createEntry]);

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
      return row.original.canonicalName.toLowerCase().includes(query);
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

  // Loading state
  if (data === undefined) {
    return (
      <div data-slot="zones-table" className="flex items-center justify-center py-12">
        <span className="font-mono text-sm text-[var(--text-faint)]">Loading zones...</span>
      </div>
    );
  }

  return (
    <div data-slot="zones-table" className="flex flex-col gap-3">
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
            placeholder="Search zone entries..."
            className={cn(
              "w-full rounded-lg border border-[var(--border)] bg-[var(--surface-1)] py-2 pr-3 pl-9 text-sm text-[var(--text)]",
              "placeholder:text-[var(--text-faint)]",
              "focus:border-[var(--border-strong)] focus:outline-none",
            )}
          />
        </div>
        <AddRowButton onAdd={handleAddZone} label="Add Zone" />
      </div>

      {/* Scrollable table container */}
      <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface-1)]">
        <table className="w-full min-w-[1400px] border-collapse">
          {/* Header */}
          <thead className="sticky top-0 z-10 bg-[var(--surface-2)]">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();

                  return (
                    <th
                      key={header.id}
                      className="px-3 py-2.5 text-left"
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
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-12 text-center font-mono text-sm text-[var(--text-faint)]"
                >
                  {data.length === 0
                    ? "No zone entries yet. Add your first zone entry."
                    : "No zone entries found."}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  data-slot="zones-row"
                  className="border-b border-[var(--border)] transition-colors hover:bg-[var(--surface-2)]/70"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      <div data-slot="zones-pagination" className="flex items-center justify-between gap-4 px-1">
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
              htmlFor="zones-page-size"
              className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-faint)]"
            >
              Rows
            </label>
            <select
              id="zones-page-size"
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
    </div>
  );
}
