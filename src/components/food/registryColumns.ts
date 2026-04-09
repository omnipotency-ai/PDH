import type { ColumnDef } from "@tanstack/react-table";
import type { Id } from "../../../convex/_generated/dataModel";

// ── Row type ────────────────────────────────────────────────────────────────

/**
 * Flattened row type for the Registry TanStack table.
 * nutritionPer100g fields are lifted to top-level for column access.
 * The full `nutritionPer100g` object is preserved for mutation spread.
 */
export type RegistryRow = {
  _id: Id<"ingredientProfiles">;
  canonicalName: string;
  displayName: string;
  productName: string | undefined;
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  sugarsG: number | null;
  fiberG: number | null;
  source: "manual" | "openfoodfacts" | null;
  registryId: Id<"clinicalRegistry"> | undefined;
  zoneName: string | undefined;
  zone: 1 | 2 | 3 | undefined;
  toleranceStatus: "building" | "like" | "dislike" | "watch" | "avoid" | undefined;
  /** Full nutrition object for mutation spread. */
  nutritionPer100g: {
    kcal: number | null;
    fatG: number | null;
    saturatedFatG: number | null;
    carbsG: number | null;
    sugarsG: number | null;
    fiberG: number | null;
    proteinG: number | null;
    saltG: number | null;
  };
};

// ── Status options ──────────────────────────────────────────────────────────

export interface StatusOption {
  value: string;
  label: string;
  color: string;
}

export const STATUS_OPTIONS: ReadonlyArray<StatusOption> = [
  { value: "building", label: "Building", color: "var(--text-muted)" },
  { value: "like", label: "Like", color: "#10b981" },
  { value: "dislike", label: "Dislike", color: "#6b7280" },
  { value: "watch", label: "Watch", color: "#f59e0b" },
  { value: "avoid", label: "Avoid", color: "#ef4444" },
];

// ── Column definitions (cell renderers injected by the table component) ─────

/**
 * Returns static column definitions for the registry table.
 * Cell renderers are intentionally left as `undefined` here — the table
 * component injects them via `columnDef.cell` override, because cells
 * need hooks (useMutation) that cannot live in a plain .ts file.
 *
 * This file owns: id, header, size, accessorFn, enableSorting, meta.
 */
export function buildRegistryColumns(): Array<ColumnDef<RegistryRow, unknown>> {
  return [
    {
      id: "displayName",
      header: "Name",
      accessorFn: (row) => row.displayName,
      size: 180,
      enableSorting: true,
    },
    {
      id: "productName",
      header: "Product",
      accessorFn: (row) => row.productName ?? "",
      size: 160,
      enableSorting: true,
    },
    {
      id: "zone",
      header: "Zone",
      accessorFn: (row) => row.zone ?? null,
      size: 60,
      enableSorting: true,
    },
    {
      id: "toleranceStatus",
      header: "Status",
      accessorFn: (row) => row.toleranceStatus ?? null,
      size: 100,
      enableSorting: true,
    },
    {
      id: "kcal",
      header: "kcal",
      accessorFn: (row) => row.kcal,
      size: 80,
      enableSorting: true,
    },
    {
      id: "proteinG",
      header: "Protein",
      accessorFn: (row) => row.proteinG,
      size: 70,
      enableSorting: true,
    },
    {
      id: "carbsG",
      header: "Carbs",
      accessorFn: (row) => row.carbsG,
      size: 70,
      enableSorting: true,
    },
    {
      id: "fatG",
      header: "Fat",
      accessorFn: (row) => row.fatG,
      size: 70,
      enableSorting: true,
    },
    {
      id: "fiberG",
      header: "Fibre",
      accessorFn: (row) => row.fiberG,
      size: 70,
      enableSorting: true,
    },
    {
      id: "source",
      header: "Source",
      accessorFn: (row) => row.source,
      size: 90,
      enableSorting: true,
    },
    {
      id: "actions",
      header: "",
      size: 50,
      enableSorting: false,
    },
  ];
}
