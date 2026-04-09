/**
 * FilterValueNumericInput — inline number input for numeric filter chips.
 *
 * Used for Fibre (g) and Calories filters where the user enters a threshold
 * value instead of selecting from a combobox.
 *
 * TODO: Consider merging FilterValueCombobox + FilterValueNumericInput into a
 * union FilterValueInput component with a discriminated `kind` prop.
 */

import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";

/** Acceptable range for nutritional threshold values (g or kcal). */
const NUMERIC_MIN = 0;
const NUMERIC_MAX = 10000;

interface FilterValueNumericInputProps {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  placeholder?: string;
}

export function FilterValueNumericInput({
  value,
  onChange,
  placeholder = "0",
}: FilterValueNumericInputProps) {
  // Keep local string state to allow intermediate editing (e.g., clearing the field)
  const [localValue, setLocalValue] = useState(
    value !== undefined ? String(value) : "",
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      setLocalValue(raw);

      if (raw === "") {
        onChange(undefined);
        return;
      }

      const parsed = Number.parseFloat(raw);
      // Reject NaN, Infinity, -Infinity, and out-of-range values
      if (!Number.isFinite(parsed)) return;
      if (parsed < NUMERIC_MIN || parsed > NUMERIC_MAX) return;
      onChange(parsed);
    },
    [onChange],
  );

  const handleBlur = useCallback(() => {
    // On blur, normalize the display to match the actual numeric value
    if (value !== undefined) {
      setLocalValue(String(value));
    } else {
      setLocalValue("");
    }
  }, [value]);

  return (
    <input
      data-slot="filter-value-numeric-input"
      type="number"
      inputMode="decimal"
      step="any"
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={cn(
        "w-12 rounded border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-0.5 text-xs text-[var(--text)] tabular-nums",
        "placeholder:text-[var(--text-faint)]",
        "focus:border-[var(--border-strong)] focus:outline-none",
        "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
      )}
      aria-label="Numeric threshold value"
    />
  );
}
