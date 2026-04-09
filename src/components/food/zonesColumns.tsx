import type {
  FoodCategory,
  FoodGasLevel,
  FoodGroup,
  FoodLine,
  FoodResidueLevel,
  FoodRiskLevel,
  FoodSubcategory,
} from "@shared/foodRegistryData";
import type { ColumnDef } from "@tanstack/react-table";
import type { Id } from "../../../convex/_generated/dataModel";
import { EditableCell } from "./EditableCell";
import { EditableNumberCell } from "./EditableNumberCell";
import { EditableSelectCell } from "./EditableSelectCell";
import { RowDeleteButton } from "./TableActions";

// ── ZoneRow type ────────────────────────────────────────────────────────────

/** Row shape for the Zones table. Mirrors clinicalRegistry document fields. */
export interface ZoneRow {
  _id: Id<"clinicalRegistry">;
  canonicalName: string;
  zone: 1 | 2 | 3;
  category: FoodCategory;
  subcategory: FoodSubcategory;
  group: FoodGroup;
  line: FoodLine;
  lineOrder: number;
  macros: Array<"protein" | "carbohydrate" | "fat">;
  osmoticEffect?: FoodRiskLevel;
  totalResidue?: FoodResidueLevel;
  gasProducing?: FoodGasLevel;
  fiberTotalApproxG?: number;
  highFatRisk?: FoodRiskLevel;
  irritantLoad?: FoodRiskLevel;
  lactoseRisk?: FoodRiskLevel;
  notes?: string;
}

// ── Select option arrays ────────────────────────────────────────────────────

interface SelectOption {
  value: string;
  label: string;
  color?: string;
}

const ZONE_OPTIONS: SelectOption[] = [
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
];

const CATEGORY_OPTIONS: SelectOption[] = [
  { value: "protein", label: "Protein" },
  { value: "carbohydrate", label: "Carbohydrate" },
  { value: "fat", label: "Fat" },
  { value: "dairy", label: "Dairy" },
  { value: "condiment", label: "Condiment" },
  { value: "drink", label: "Drink" },
  { value: "beverage", label: "Beverage" },
];

const SUBCATEGORY_OPTIONS: SelectOption[] = [
  { value: "meat", label: "Meat" },
  { value: "fish", label: "Fish" },
  { value: "egg", label: "Egg" },
  { value: "legume", label: "Legume" },
  { value: "grain", label: "Grain" },
  { value: "vegetable", label: "Vegetable" },
  { value: "root_vegetable", label: "Root veg" },
  { value: "fruit", label: "Fruit" },
  { value: "oil", label: "Oil" },
  { value: "butter_cream", label: "Butter/cream" },
  { value: "nut_seed", label: "Nut/seed" },
  { value: "nut", label: "Nut" },
  { value: "milk_yogurt", label: "Milk/yogurt" },
  { value: "cheese", label: "Cheese" },
  { value: "dairy", label: "Dairy" },
  { value: "dairy_alternative", label: "Dairy alt" },
  { value: "dessert", label: "Dessert" },
  { value: "frozen", label: "Frozen" },
  { value: "herb", label: "Herb" },
  { value: "spice", label: "Spice" },
  { value: "sauce", label: "Sauce" },
  { value: "acid", label: "Acid" },
  { value: "thickener", label: "Thickener" },
  { value: "seasoning", label: "Seasoning" },
  { value: "irritant", label: "Irritant" },
  { value: "processed", label: "Processed" },
  { value: "composite_dish", label: "Composite" },
  { value: "sugar", label: "Sugar" },
  { value: "broth", label: "Broth" },
  { value: "hot_drink", label: "Hot drink" },
  { value: "juice", label: "Juice" },
  { value: "supplement", label: "Supplement" },
  { value: "water", label: "Water" },
  { value: "alcohol", label: "Alcohol" },
  { value: "fizzy_drink", label: "Fizzy drink" },
];

const RISK_LEVEL_OPTIONS: SelectOption[] = [
  { value: "none", label: "None" },
  { value: "low", label: "Low" },
  { value: "low_moderate", label: "Low-mod" },
  { value: "moderate", label: "Moderate" },
  { value: "moderate_high", label: "Mod-high" },
  { value: "high", label: "High" },
];

const RESIDUE_OPTIONS: SelectOption[] = [
  { value: "very_low", label: "Very low" },
  { value: "low", label: "Low" },
  { value: "low_moderate", label: "Low-mod" },
  { value: "moderate", label: "Moderate" },
  { value: "high", label: "High" },
];

const GAS_OPTIONS: SelectOption[] = [
  { value: "no", label: "No" },
  { value: "possible", label: "Possible" },
  { value: "yes", label: "Yes" },
];

// ── Zone color helper ───────────────────────────────────────────────────────

const ZONE_COLORS: Record<string, string> = {
  "1": "var(--emerald)",
  "2": "var(--amber)",
  "3": "var(--section-quick)",
};

function getZoneSelectOptions(): SelectOption[] {
  return ZONE_OPTIONS.map((o) => ({
    ...o,
    color: ZONE_COLORS[o.value],
  }));
}

// ── Mutation callbacks type ─────────────────────────────────────────────────

export interface ZonesMutations {
  update: (args: Record<string, unknown> & { id: Id<"clinicalRegistry"> }) => Promise<null>;
  remove: (args: { id: Id<"clinicalRegistry"> }) => Promise<null>;
}

// ── Column factory ──────────────────────────────────────────────────────────

/**
 * Build column definitions for the Zones table.
 * Accepts mutation callbacks so cells can trigger inline edits.
 */
export function getZonesColumns(mutations: ZonesMutations): ColumnDef<ZoneRow>[] {
  const { update, remove } = mutations;

  return [
    // ── Name ──────────────────────────────────────────────────────────────
    {
      id: "canonicalName",
      accessorKey: "canonicalName",
      header: "Name",
      size: 150,
      cell: ({ row }) => (
        <EditableCell
          value={row.original.canonicalName}
          onSave={async (value) => {
            // canonicalName is not in the update mutation args — it's the identity field.
            // For now, name editing is a no-op. A rename would require delete+recreate.
            void value;
          }}
        />
      ),
    },

    // ── Zone ──────────────────────────────────────────────────────────────
    {
      id: "zone",
      accessorKey: "zone",
      header: "Zone",
      size: 70,
      cell: ({ row }) => (
        <EditableSelectCell
          value={String(row.original.zone)}
          options={getZoneSelectOptions()}
          onSave={async (value) => {
            await update({
              id: row.original._id,
              zone: Number(value) as 1 | 2 | 3,
            });
          }}
        />
      ),
    },

    // ── Category ──────────────────────────────────────────────────────────
    {
      id: "category",
      accessorKey: "category",
      header: "Category",
      size: 120,
      cell: ({ row }) => (
        <EditableSelectCell
          value={row.original.category}
          options={CATEGORY_OPTIONS}
          onSave={async (value) => {
            await update({
              id: row.original._id,
              category: value as FoodCategory,
            });
          }}
        />
      ),
    },

    // ── Subcategory ───────────────────────────────────────────────────────
    {
      id: "subcategory",
      accessorKey: "subcategory",
      header: "Subcategory",
      size: 130,
      cell: ({ row }) => (
        <EditableSelectCell
          value={row.original.subcategory}
          options={SUBCATEGORY_OPTIONS}
          onSave={async (value) => {
            await update({
              id: row.original._id,
              subcategory: value as FoodSubcategory,
            });
          }}
        />
      ),
    },

    // ── Osmotic ───────────────────────────────────────────────────────────
    {
      id: "osmoticEffect",
      accessorKey: "osmoticEffect",
      header: "Osmotic",
      size: 90,
      cell: ({ row }) => (
        <EditableSelectCell
          value={row.original.osmoticEffect ?? null}
          options={RISK_LEVEL_OPTIONS}
          onSave={async (value) => {
            await update({
              id: row.original._id,
              osmoticEffect: value === "" ? null : (value as FoodRiskLevel),
            });
          }}
        />
      ),
    },

    // ── Residue ───────────────────────────────────────────────────────────
    {
      id: "totalResidue",
      accessorKey: "totalResidue",
      header: "Residue",
      size: 90,
      cell: ({ row }) => (
        <EditableSelectCell
          value={row.original.totalResidue ?? null}
          options={RESIDUE_OPTIONS}
          onSave={async (value) => {
            await update({
              id: row.original._id,
              totalResidue: value === "" ? null : (value as FoodResidueLevel),
            });
          }}
        />
      ),
    },

    // ── Gas ───────────────────────────────────────────────────────────────
    {
      id: "gasProducing",
      accessorKey: "gasProducing",
      header: "Gas",
      size: 80,
      cell: ({ row }) => (
        <EditableSelectCell
          value={row.original.gasProducing ?? null}
          options={GAS_OPTIONS}
          onSave={async (value) => {
            await update({
              id: row.original._id,
              gasProducing: value === "" ? null : (value as FoodGasLevel),
            });
          }}
        />
      ),
    },

    // ── Fibre (g) ─────────────────────────────────────────────────────────
    {
      id: "fiberTotalApproxG",
      accessorKey: "fiberTotalApproxG",
      header: "Fibre (g)",
      size: 80,
      cell: ({ row }) => (
        <EditableNumberCell
          value={row.original.fiberTotalApproxG ?? null}
          onSave={async (value) => {
            await update({ id: row.original._id, fiberTotalApproxG: value });
          }}
        />
      ),
    },

    // ── Fat Risk ──────────────────────────────────────────────────────────
    {
      id: "highFatRisk",
      accessorKey: "highFatRisk",
      header: "Fat Risk",
      size: 90,
      cell: ({ row }) => (
        <EditableSelectCell
          value={row.original.highFatRisk ?? null}
          options={RISK_LEVEL_OPTIONS}
          onSave={async (value) => {
            await update({
              id: row.original._id,
              highFatRisk: value === "" ? null : (value as FoodRiskLevel),
            });
          }}
        />
      ),
    },

    // ── Irritant ──────────────────────────────────────────────────────────
    {
      id: "irritantLoad",
      accessorKey: "irritantLoad",
      header: "Irritant",
      size: 90,
      cell: ({ row }) => (
        <EditableSelectCell
          value={row.original.irritantLoad ?? null}
          options={RISK_LEVEL_OPTIONS}
          onSave={async (value) => {
            await update({
              id: row.original._id,
              irritantLoad: value === "" ? null : (value as FoodRiskLevel),
            });
          }}
        />
      ),
    },

    // ── Lactose ───────────────────────────────────────────────────────────
    {
      id: "lactoseRisk",
      accessorKey: "lactoseRisk",
      header: "Lactose",
      size: 90,
      cell: ({ row }) => (
        <EditableSelectCell
          value={row.original.lactoseRisk ?? null}
          options={RISK_LEVEL_OPTIONS}
          onSave={async (value) => {
            await update({
              id: row.original._id,
              lactoseRisk: value === "" ? null : (value as FoodRiskLevel),
            });
          }}
        />
      ),
    },

    // ── Notes ─────────────────────────────────────────────────────────────
    {
      id: "notes",
      accessorKey: "notes",
      header: "Notes",
      size: 200,
      cell: ({ row }) => (
        <EditableCell
          value={row.original.notes ?? ""}
          placeholder="Add note..."
          onSave={async (value) => {
            await update({
              id: row.original._id,
              notes: value === "" ? null : value,
            });
          }}
        />
      ),
    },

    // ── Actions ───────────────────────────────────────────────────────────
    {
      id: "actions",
      header: "",
      size: 50,
      enableSorting: false,
      cell: ({ row }) => (
        <RowDeleteButton
          onDelete={async () => {
            await remove({ id: row.original._id });
          }}
        />
      ),
    },
  ];
}
