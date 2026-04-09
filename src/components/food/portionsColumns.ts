import type { ColumnDef } from "@tanstack/react-table";
import type { Id } from "../../../convex/_generated/dataModel";

// ── Row type ────────────────────────────────────────────────────────────────

/**
 * Flattened row type for the Portions table.
 * Each row represents a single portion entry — either a user's custom portion
 * from an ingredientProfile, or a system default from FOOD_PORTION_DATA.
 */
export interface PortionRow {
  /** Synthetic key: `${profileId}_${index}` for custom, `default_${foodName}` for system */
  id: string;
  /** Profile ID. Null for system default rows. */
  profileId: Id<"ingredientProfiles"> | null;
  /** Display name of the food this portion belongs to. */
  foodName: string;
  /** Portion label (e.g. "slice", "cup"). */
  label: string;
  /** Weight in grams. */
  weightG: number;
  /** True for FOOD_PORTION_DATA entries (read-only). */
  isSystemDefault: boolean;
  /** Index within the customPortions array (for mutation). Undefined for system defaults. */
  portionIndex: number | undefined;
}

// ── Column definitions ──────────────────────────────────────────────────────

/**
 * Returns static column definitions for the portions table.
 * Cell renderers are injected by PortionsTable.tsx, because cells
 * need hooks (useMutation) that cannot live in a plain .ts file.
 */
export function buildPortionsColumns(): Array<ColumnDef<PortionRow, unknown>> {
  return [
    {
      id: "foodName",
      header: "Food",
      accessorFn: (row) => row.foodName,
      size: 200,
      enableSorting: true,
    },
    {
      id: "label",
      header: "Label",
      accessorFn: (row) => row.label,
      size: 160,
      enableSorting: true,
    },
    {
      id: "weightG",
      header: "Weight (g)",
      accessorFn: (row) => row.weightG,
      size: 120,
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
