/**
 * FilterBar — composable, chip-based filter bar for the Food page tables.
 *
 * Renders a horizontal scrollable bar of FilterChips with an [+ Filter]
 * button at the end. Manages FilterState[] internally and exposes it
 * via the onFiltersChange callback.
 *
 * Uses motion/react for chip enter/exit animations.
 */

import { AnimatePresence, motion } from "motion/react";
import { useCallback } from "react";
import { FilterAddPopover } from "./FilterAddPopover";
import { FilterChip } from "./FilterChip";
import type { FilterState, FilterType } from "./filterTypes";
import { getDefaultOperator } from "./filterTypes";

// TODO(M-FF): Sync filter state to URL params for shareable/persistent filters
// FilterBar is controlled — URL sync would be implemented at the call site (ZonesTable/RegistryTable)
// by serialising `filters` to search params and reading them back on mount.
interface FilterBarProps {
  filters: FilterState[];
  onFiltersChange: (filters: FilterState[]) => void;
}

export function FilterBar({ filters, onFiltersChange }: FilterBarProps) {
  const activeFilterTypes = filters.map((f) => f.type);

  const handleAddFilter = useCallback(
    (type: FilterType) => {
      const newFilter: FilterState = {
        id: crypto.randomUUID(),
        type,
        operator: getDefaultOperator(type),
        values: [],
      };
      onFiltersChange([...filters, newFilter]);
    },
    [filters, onFiltersChange],
  );

  const handleUpdateFilter = useCallback(
    (id: string, updater: (prev: FilterState) => FilterState) => {
      onFiltersChange(
        filters.map((f) => {
          if (f.id !== id) return f;
          return updater(f);
        }),
      );
    },
    [filters, onFiltersChange],
  );

  const handleRemoveFilter = useCallback(
    (id: string) => {
      onFiltersChange(filters.filter((f) => f.id !== id));
    },
    [filters, onFiltersChange],
  );

  return (
    <div
      data-slot="filter-bar"
      className="flex items-center gap-2 overflow-x-auto pb-1"
      role="toolbar"
      aria-label="Active filters"
    >
      {filters.length === 0 && (
        <span className="text-xs text-[var(--text-faint)]">No active filters</span>
      )}

      <AnimatePresence mode="popLayout">
        {filters.map((filter) => (
          <motion.div
            key={filter.id}
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15 }}
          >
            <FilterChip
              filter={filter}
              onUpdate={handleUpdateFilter}
              onRemove={handleRemoveFilter}
            />
          </motion.div>
        ))}
      </AnimatePresence>

      <FilterAddPopover
        onAdd={handleAddFilter}
        activeFilterTypes={activeFilterTypes}
      />
    </div>
  );
}
