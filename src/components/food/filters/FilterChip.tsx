/**
 * FilterChip — a single composable filter chip in the filter bar.
 *
 * Layout: [Type label] [Operator dropdown] [Value combobox/input] [Remove button]
 *
 * The type label is non-interactive monospace small caps.
 * Operator is a native select dropdown.
 * Value is either a searchable combobox or a numeric input.
 * Remove is a small x button.
 */

import { X } from "lucide-react";
import { useCallback } from "react";
import { cn } from "@/lib/utils";
import { FilterOperatorDropdown } from "./FilterOperatorDropdown";
import { FilterValueCombobox } from "./FilterValueCombobox";
import { FilterValueNumericInput } from "./FilterValueNumericInput";
import type { FilterOperator, FilterState } from "./filterTypes";
import { getOperatorsForType, isNumericFilterType } from "./filterTypes";

interface FilterChipProps {
  filter: FilterState;
  onUpdate: (id: string, updater: (prev: FilterState) => FilterState) => void;
  onRemove: (id: string) => void;
}

export function FilterChip({ filter, onUpdate, onRemove }: FilterChipProps) {
  const isNumeric = isNumericFilterType(filter.type);

  const handleOperatorChange = useCallback(
    (operator: FilterOperator) => {
      onUpdate(filter.id, (prev) => ({ ...prev, operator }));
    },
    [filter.id, onUpdate],
  );

  const handleValuesChange = useCallback(
    (values: string[]) => {
      onUpdate(filter.id, (prev) => {
        // When value count changes, the available operators may change.
        // If the current operator is no longer valid, switch to the first valid one.
        const newOperators = getOperatorsForType(prev.type, values.length);
        const operatorStillValid = newOperators.includes(prev.operator);
        return {
          ...prev,
          values,
          ...(!operatorStillValid && { operator: newOperators[0] }),
        };
      });
    },
    [filter.id, onUpdate],
  );

  const handleNumericChange = useCallback(
    (numericValue: number | undefined) => {
      onUpdate(filter.id, (prev) => {
        // Destructure to remove numericValue, then conditionally re-add it.
        const { numericValue: _removed, ...rest } = prev;
        return {
          ...rest,
          ...(numericValue !== undefined && { numericValue }),
        };
      });
    },
    [filter.id, onUpdate],
  );

  const handleRemove = useCallback(() => {
    onRemove(filter.id);
  }, [filter.id, onRemove]);

  return (
    <div
      data-slot="filter-chip"
      className={cn(
        "flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1",
        "transition-colors hover:border-[var(--border-strong)]",
      )}
    >
      {/* Type label */}
      <span
        data-slot="filter-chip-type"
        className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-faint)]"
      >
        {filter.type}
      </span>

      {/* Operator dropdown */}
      <FilterOperatorDropdown
        filterType={filter.type}
        operator={filter.operator}
        selectedCount={filter.values.length}
        onChange={handleOperatorChange}
      />

      {/* Value: combobox or numeric input */}
      {isNumeric ? (
        <FilterValueNumericInput value={filter.numericValue} onChange={handleNumericChange} />
      ) : (
        <FilterValueCombobox
          filterType={filter.type}
          values={filter.values}
          onChange={handleValuesChange}
        />
      )}

      {/* Remove button */}
      <button
        type="button"
        onClick={handleRemove}
        className={cn(
          "ml-0.5 flex shrink-0 items-center justify-center rounded-full p-0.5",
          "text-[var(--text-faint)] hover:text-[var(--text)] focus:outline-none",
        )}
        aria-label={`Remove ${filter.type} filter`}
      >
        <X size={12} />
      </button>
    </div>
  );
}
