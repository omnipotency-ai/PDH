import { FOOD_PORTION_DATA } from "@shared/foodPortionData";
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
import type { Id } from "../../../convex/_generated/dataModel";
import { EditableCell } from "./EditableCell";
import { EditableNumberCell } from "./EditableNumberCell";
import type { PortionRow } from "./portionsColumns";
import { buildPortionsColumns } from "./portionsColumns";
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

// ── System default badge ────────────────────────────────────────────────────

function DefaultBadge() {
  return (
    <span className="ml-1 inline-flex items-center rounded-full bg-[var(--surface-2)] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-[var(--text-faint)]">
      default
    </span>
  );
}

// ── PortionsTable ───────────────────────────────────────────────────────────

export function PortionsTable() {
  const profiles = useQuery(api.ingredientProfiles.list);
  const updatePortions = useMutation(api.ingredientProfiles.updatePortions);

  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);

  // Flatten all custom portions + system defaults into PortionRow[]
  const rows: PortionRow[] = useMemo(() => {
    const result: PortionRow[] = [];

    // 1. Custom portions from ingredient profiles
    if (profiles !== undefined) {
      for (const profile of profiles) {
        const portions = profile.customPortions;
        if (portions === undefined) continue;
        for (let i = 0; i < portions.length; i++) {
          const portion = portions[i];
          result.push({
            id: `${profile._id}_${i}`,
            profileId: profile._id,
            foodName: profile.displayName,
            label: portion.label,
            weightG: portion.weightG,
            isSystemDefault: false,
            portionIndex: i,
          });
        }
      }
    }

    // 2. System defaults from FOOD_PORTION_DATA
    for (const [foodName, data] of FOOD_PORTION_DATA) {
      // Add the default portion entry
      result.push({
        id: `default_${foodName}`,
        profileId: null,
        foodName,
        label: data.naturalUnit ?? "portion",
        weightG:
          data.naturalUnit !== undefined && data.unitWeightG !== undefined
            ? data.unitWeightG
            : data.defaultPortionG,
        isSystemDefault: true,
        portionIndex: undefined,
      });
    }

    return result;
  }, [profiles]);

  // Helper: rebuild customPortions array for a profile after an edit
  const getProfilePortions = useCallback(
    (profileId: Id<"ingredientProfiles">): Array<{ label: string; weightG: number }> => {
      if (profiles === undefined) return [];
      const profile = profiles.find((p) => p._id === profileId);
      if (profile === undefined) return [];
      return [...(profile.customPortions ?? [])];
    },
    [profiles],
  );

  // Build columns with cell renderers
  const columns = useMemo(() => {
    const base = buildPortionsColumns();

    for (const col of base) {
      switch (col.id) {
        case "foodName":
          col.cell = ({ row }) => {
            if (row.original.isSystemDefault) {
              return (
                <span className="text-sm italic text-[var(--text-faint)]">
                  {row.original.foodName}
                  <DefaultBadge />
                </span>
              );
            }
            return <span className="text-sm text-[var(--text)]">{row.original.foodName}</span>;
          };
          break;

        case "label":
          col.cell = ({ row }) => {
            if (row.original.isSystemDefault) {
              return (
                <span className="text-sm italic text-[var(--text-faint)]">
                  {row.original.label}
                </span>
              );
            }
            return (
              <EditableCell
                value={row.original.label}
                placeholder="Label"
                onSave={async (value) => {
                  const trimmed = value.trim();
                  if (trimmed === "") return;
                  const profileId = row.original.profileId;
                  if (profileId === null) return;
                  const idx = row.original.portionIndex;
                  if (idx === undefined) return;

                  const portions = getProfilePortions(profileId);
                  if (idx < portions.length) {
                    portions[idx] = { ...portions[idx], label: trimmed };
                  }
                  await updatePortions({
                    id: profileId,
                    customPortions: portions,
                  });
                }}
              />
            );
          };
          break;

        case "weightG":
          col.cell = ({ row }) => {
            if (row.original.isSystemDefault) {
              return (
                <span className="text-sm italic tabular-nums text-[var(--text-faint)]">
                  {row.original.weightG}g
                </span>
              );
            }
            return (
              <EditableNumberCell
                value={row.original.weightG}
                suffix="g"
                min={0.1}
                onSave={async (value) => {
                  if (value === null || value <= 0) return;
                  const profileId = row.original.profileId;
                  if (profileId === null) return;
                  const idx = row.original.portionIndex;
                  if (idx === undefined) return;

                  const portions = getProfilePortions(profileId);
                  if (idx < portions.length) {
                    portions[idx] = { ...portions[idx], weightG: value };
                  }
                  await updatePortions({
                    id: profileId,
                    customPortions: portions,
                  });
                }}
              />
            );
          };
          break;

        case "actions":
          col.cell = ({ row }) => {
            if (row.original.isSystemDefault) {
              return null;
            }
            return (
              <RowDeleteButton
                onDelete={async () => {
                  const profileId = row.original.profileId;
                  if (profileId === null) return;
                  const idx = row.original.portionIndex;
                  if (idx === undefined) return;

                  const portions = getProfilePortions(profileId);
                  portions.splice(idx, 1);
                  await updatePortions({
                    id: profileId,
                    customPortions: portions,
                  });
                }}
              />
            );
          };
          break;
      }
    }

    return base;
  }, [updatePortions, getProfilePortions]);

  // Add a new portion to the first available profile
  const handleAddPortion = useCallback(async () => {
    if (profiles === undefined || profiles.length === 0) return;
    const profile = profiles[0];
    const existing = profile.customPortions ?? [];
    await updatePortions({
      id: profile._id,
      customPortions: [...existing, { label: "portion", weightG: 100 }],
    });
  }, [profiles, updatePortions]);

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => row.id,
    globalFilterFn: (row, _columnId, filterValue) => {
      if (typeof filterValue !== "string" || filterValue.length === 0) return true;
      const query = filterValue.toLowerCase();
      return (
        row.original.foodName.toLowerCase().includes(query) ||
        row.original.label.toLowerCase().includes(query)
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

  // Loading state
  if (profiles === undefined) {
    return (
      <div data-slot="portions-table" className="flex items-center justify-center py-12">
        <span className="font-mono text-sm text-[var(--text-faint)]">Loading portions...</span>
      </div>
    );
  }

  return (
    <div data-slot="portions-table" className="flex flex-col gap-3">
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
            placeholder="Search portions..."
            className={cn(
              "w-full rounded-lg border border-[var(--border)] bg-[var(--surface-1)] py-2 pr-3 pl-9 text-sm text-[var(--text)]",
              "placeholder:text-[var(--text-faint)]",
              "focus:border-[var(--border-strong)] focus:outline-none",
            )}
          />
        </div>
        <AddRowButton
          onAdd={handleAddPortion}
          label="Add Portion"
          disabled={profiles.length === 0}
        />
      </div>

      {/* Scrollable table container */}
      <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface-1)]">
        <table className="w-full min-w-[600px] border-collapse">
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
                  {rows.length === 0
                    ? "No portions defined yet. Add your first custom portion."
                    : "No portions found."}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  data-slot="portions-row"
                  className={cn(
                    "border-b border-[var(--border)] transition-colors",
                    row.original.isSystemDefault
                      ? "bg-[var(--surface-1)]/50"
                      : "hover:bg-[var(--surface-2)]/70",
                  )}
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
      <div data-slot="portions-pagination" className="flex items-center justify-between gap-4 px-1">
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
              htmlFor="portions-page-size"
              className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-faint)]"
            >
              Rows
            </label>
            <select
              id="portions-page-size"
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
