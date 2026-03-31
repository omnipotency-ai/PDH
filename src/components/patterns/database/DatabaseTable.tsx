import type {
  ColumnFiltersState,
  OnChangeFn,
  SortDirection,
  SortingState,
} from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Fragment, useMemo } from "react";
import { buildColumns, type FoodDatabaseRow } from "./columns";
import { TrialHistorySubRow } from "./TrialHistorySubRow";

// ── Props ────────────────────────────────────────────────────────────────────

interface DatabaseTableProps {
  data: FoodDatabaseRow[];
  columnFilters?: ColumnFiltersState;
  onColumnFiltersChange?: OnChangeFn<ColumnFiltersState>;
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  globalFilter?: string;
  onGlobalFilterChange?: (value: string) => void;
}

// ── Sort indicator ───────────────────────────────────────────────────────────

function SortIndicator({ direction }: { direction: false | SortDirection }) {
  if (direction === "asc") {
    return <ArrowUp size={12} className="shrink-0" />;
  }
  if (direction === "desc") {
    return <ArrowDown size={12} className="shrink-0" />;
  }
  return <ArrowUpDown size={12} className="shrink-0 opacity-30" />;
}

// ── Page size options ────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

// ── DatabaseTable ────────────────────────────────────────────────────────────

export function DatabaseTable({
  data,
  columnFilters,
  onColumnFiltersChange,
  sorting,
  onSortingChange,
  globalFilter,
  onGlobalFilterChange,
}: DatabaseTableProps) {
  const builtColumns = useMemo(() => buildColumns(), []);

  const table = useReactTable({
    data,
    columns: builtColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand: () => true,
    getRowId: (row) => row.key,
    globalFilterFn: (row, _columnId, filterValue) => {
      if (typeof filterValue !== "string" || filterValue.length === 0) return true;
      const query = filterValue.toLowerCase();
      return row.original.name.toLowerCase().includes(query);
    },
    initialState: {
      pagination: { pageSize: 25 },
      ...(sorting === undefined && {
        sorting: [{ id: "lastTested", desc: true }],
      }),
    },
    state: {
      ...(columnFilters !== undefined && { columnFilters }),
      ...(sorting !== undefined && { sorting }),
      ...(globalFilter !== undefined && { globalFilter }),
    },
    ...(onColumnFiltersChange !== undefined && {
      onColumnFiltersChange,
    }),
    ...(onSortingChange !== undefined && {
      onSortingChange,
    }),
    ...(onGlobalFilterChange !== undefined && {
      onGlobalFilterChange,
    }),
  });

  const { pageIndex, pageSize } = table.getState().pagination;
  const pageCount = table.getPageCount();
  const totalRows = table.getFilteredRowModel().rows.length;

  return (
    <div data-slot="database-table" className="flex flex-col gap-0">
      {/* Scrollable table container */}
      <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface-1)]">
        <table className="w-full min-w-[900px] border-collapse">
          {/* ── Sticky header ──────────────────────────────────────────── */}
          <thead className="sticky top-0 z-10 bg-[var(--surface-2)]">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();

                  const isFirst = header.index === 0;

                  return (
                    <th
                      key={header.id}
                      className={`px-3 py-2.5 text-left${isFirst ? " sticky left-0 z-20 bg-[var(--surface-2)]" : ""}`}
                      style={{
                        width: header.getSize(),
                      }}
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

          {/* ── Body ───────────────────────────────────────────────────── */}
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={builtColumns.length}
                  className="px-3 py-12 text-center font-mono text-sm text-[var(--text-faint)]"
                >
                  No foods found.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <Fragment key={row.id}>
                  <tr
                    data-slot="database-row"
                    className="cursor-pointer border-b border-[var(--border)] transition-colors hover:bg-[var(--surface-2)]/70"
                    onClick={() => row.toggleExpanded()}
                  >
                    {row.getVisibleCells().map((cell, cellIndex) => (
                      <td
                        key={cell.id}
                        className={`px-3 py-2.5${cellIndex === 0 ? " sticky left-0 z-10 bg-[var(--surface-1)]" : ""}`}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>

                  {row.getIsExpanded() && (
                    <tr key={`${row.id}-expanded`}>
                      <td
                        colSpan={row.getVisibleCells().length}
                        className="border-b border-[var(--border)] bg-[var(--surface-1)]/80"
                      >
                        <TrialHistorySubRow row={row.original} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination controls ──────────────────────────────────────── */}
      <div
        data-slot="database-pagination"
        className="flex items-center justify-between gap-4 px-1 pt-3"
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
              htmlFor="db-page-size"
              className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-faint)]"
            >
              Rows
            </label>
            <select
              id="db-page-size"
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
              className="inline-flex h-7 w-7 min-h-11 min-w-11 items-center justify-center rounded border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-30"
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
              className="inline-flex h-7 w-7 min-h-11 min-w-11 items-center justify-center rounded border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-30"
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
