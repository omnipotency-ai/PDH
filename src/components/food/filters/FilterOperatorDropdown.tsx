/**
 * FilterOperatorDropdown — dropdown for selecting the operator on a filter chip.
 *
 * Uses a native <select> for simplicity and accessibility. The available
 * operators depend on the filter type and how many values are selected.
 */

import { cn } from "@/lib/utils";
import type { FilterOperator, FilterType } from "./filterTypes";
import { getOperatorsForType } from "./filterTypes";

interface FilterOperatorDropdownProps {
  filterType: FilterType;
  operator: FilterOperator;
  selectedCount: number;
  onChange: (operator: FilterOperator) => void;
}

export function FilterOperatorDropdown({
  filterType,
  operator,
  selectedCount,
  onChange,
}: FilterOperatorDropdownProps) {
  const operators = getOperatorsForType(filterType, selectedCount);

  return (
    <select
      data-slot="filter-operator-dropdown"
      value={operator}
      onChange={(e) => onChange(e.target.value as FilterOperator)}
      className={cn(
        "cursor-pointer appearance-none rounded border-none bg-transparent px-1 py-0.5 text-xs font-medium text-[var(--text-muted)]",
        "hover:text-[var(--text)] focus:text-[var(--text)] focus:outline-none",
      )}
      aria-label={`Operator for ${filterType} filter`}
    >
      {operators.map((op) => (
        <option key={op} value={op}>
          {op}
        </option>
      ))}
    </select>
  );
}
