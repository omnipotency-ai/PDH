/**
 * FilterAddPopover — popover shown when clicking [+ Filter] to add a new filter.
 *
 * Shows filter types organized into groups (Classification, Preparation,
 * Digestion Risk, Nutrition, Tags) with separators between groups.
 * Uses the existing Base UI Popover wrapper from src/components/ui/popover.tsx.
 */

import {
  Apple,
  Beaker,
  CircleDot,
  Dna,
  Droplets,
  Flame,
  Gauge,
  Heart,
  Layers,
  Leaf,
  MapPin,
  Milk,
  Scissors,
  Tag,
  Waves,
  Wheat,
  Wind,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { FilterType } from "./filterTypes";

// ── Popover Group Definitions ──────────────────────────────────────────────

interface FilterTypeEntry {
  type: FilterType;
  icon: ReactNode;
}

const FILTER_VIEW_GROUPS: FilterTypeEntry[][] = [
  // Classification
  [
    { type: FilterType.ZONE, icon: <MapPin size={14} /> },
    { type: FilterType.TYPE, icon: <Droplets size={14} /> },
    { type: FilterType.MACROS, icon: <Dna size={14} /> },
    { type: FilterType.SUBCATEGORY, icon: <Apple size={14} /> },
    { type: FilterType.STATUS, icon: <Heart size={14} /> },
  ],
  // Preparation
  [
    { type: FilterType.MECHANICAL_FORM, icon: <Scissors size={14} /> },
    { type: FilterType.COOKING_METHOD, icon: <Flame size={14} /> },
    { type: FilterType.SKIN, icon: <Layers size={14} /> },
  ],
  // Digestion Risk
  [
    { type: FilterType.OSMOTIC_EFFECT, icon: <Waves size={14} /> },
    { type: FilterType.FODMAP_LEVEL, icon: <Beaker size={14} /> },
    { type: FilterType.RESIDUE, icon: <Leaf size={14} /> },
    { type: FilterType.GAS_PRODUCING, icon: <Wind size={14} /> },
    { type: FilterType.FAT_RISK, icon: <CircleDot size={14} /> },
    { type: FilterType.IRRITANT_LOAD, icon: <Zap size={14} /> },
    { type: FilterType.LACTOSE_RISK, icon: <Milk size={14} /> },
  ],
  // Nutrition
  [
    { type: FilterType.FIBRE, icon: <Wheat size={14} /> },
    { type: FilterType.KCAL, icon: <Gauge size={14} /> },
  ],
  // Tags
  [{ type: FilterType.TAGS, icon: <Tag size={14} /> }],
];

// ── Component ──────────────────────────────────────────────────────────────

interface FilterAddPopoverProps {
  onAdd: (type: FilterType) => void;
  /** Filter types that are already active (to visually indicate or disable). */
  activeFilterTypes: FilterType[];
}

export function FilterAddPopover({ onAdd, activeFilterTypes }: FilterAddPopoverProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = useCallback(
    (type: FilterType) => {
      onAdd(type);
      setOpen(false);
    },
    [onAdd],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger>
        <button
          type="button"
          data-slot="filter-add-trigger"
          className={cn(
            "flex shrink-0 items-center gap-1 rounded-full border border-dashed border-[var(--border)] px-2.5 py-1 text-xs text-[var(--text-muted)]",
            "transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text)]",
          )}
        >
          + Filter
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" sideOffset={6} className="w-56 p-1.5">
        <div data-slot="filter-add-popover" className="flex flex-col">
          {FILTER_VIEW_GROUPS.map((group, groupIndex) => (
            <div key={groupIndex}>
              {/* Separator between groups (not before first) */}
              {groupIndex > 0 && <hr className="mx-1 my-1 h-px border-none bg-[var(--border)]" />}

              {group.map((entry) => {
                const isActive = activeFilterTypes.includes(entry.type);

                return (
                  <button
                    key={entry.type}
                    type="button"
                    onClick={() => handleSelect(entry.type)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-xs",
                      "transition-colors hover:bg-[var(--surface-2)]",
                      isActive ? "text-[var(--text-faint)] opacity-60" : "text-[var(--text-muted)]",
                    )}
                    aria-label={`Add ${entry.type} filter`}
                  >
                    <span className="flex shrink-0 items-center text-[var(--text-faint)]">
                      {entry.icon}
                    </span>
                    <span>{entry.type}</span>
                    {isActive && (
                      <span className="ml-auto font-mono text-[9px] uppercase tracking-wider text-[var(--text-faint)]">
                        active
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
