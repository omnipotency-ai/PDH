import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

interface SelectOption {
  value: string;
  label: string;
  color?: string;
}

interface EditableSelectCellProps {
  value: string | null;
  options: SelectOption[];
  onSave: (value: string) => Promise<void> | void;
  className?: string;
}

/**
 * Inline-editable select cell for TanStack React Table.
 * Renders as a styled badge/chip. On click, opens a native <select>.
 * On change, calls onSave immediately (no confirm step).
 * Keeps the select open on save failure and shows an error message.
 */
export function EditableSelectCell({ value, options, onSave, className }: EditableSelectCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectRef = useRef<HTMLSelectElement | null>(null);

  const currentOption = options.find((o) => o.value === value);
  const displayLabel = currentOption?.label ?? value ?? "\u2014";
  const displayColor = currentOption?.color;

  // Focus and open the select when editing starts.
  useEffect(() => {
    if (isEditing && selectRef.current) {
      selectRef.current.focus();
    }
  }, [isEditing]);

  const startEdit = useCallback(() => {
    setError(null);
    setIsEditing(true);
  }, []);

  const handleChange = useCallback(
    async (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newValue = e.target.value;

      if (newValue !== (value ?? "")) {
        // Attempt save first. Only close on success; keep open and show error on failure.
        try {
          await onSave(newValue);
          setError(null);
          setIsEditing(false);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Save failed");
          // isEditing remains true — user can retry or press Escape to cancel.
        }
      } else {
        setIsEditing(false);
      }
    },
    [value, onSave],
  );

  const handleBlur = useCallback(() => {
    // Only close on blur when no error is showing.
    // If an error is displayed the user needs to see it; Escape will dismiss.
    if (error === null) {
      setIsEditing(false);
    }
  }, [error]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLSelectElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setError(null);
      setIsEditing(false);
    }
  }, []);

  if (isEditing) {
    return (
      <div data-slot="editable-select-cell" className="flex flex-col gap-0.5">
        <select
          ref={selectRef}
          value={value ?? ""}
          onChange={(e) => void handleChange(e)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className={cn(
            "w-full min-w-0 rounded-md bg-transparent px-1 py-0.5 text-sm text-[var(--text)]",
            "ring-1 outline-none",
            error !== null
              ? "ring-red-500 focus-visible:ring-red-500"
              : "ring-[var(--border)] focus-visible:ring-[var(--ring)]",
            className,
          )}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error !== null && <span className="text-xs text-red-500">{error}</span>}
      </div>
    );
  }

  return (
    <span
      data-slot="editable-select-cell"
      role="button"
      tabIndex={0}
      onClick={startEdit}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          startEdit();
        }
      }}
      className={cn(
        "inline-flex cursor-pointer items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        "transition-colors duration-150",
        displayColor
          ? "border border-current/20"
          : "bg-[var(--surface-2)] text-[var(--text)] hover:bg-[var(--surface-3)]",
        className,
      )}
      {...(displayColor !== undefined && {
        style: {
          color: displayColor,
          backgroundColor: `color-mix(in srgb, ${displayColor} 15%, transparent)`,
        },
      })}
    >
      {displayColor !== undefined && (
        <span
          aria-hidden="true"
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: displayColor }}
        />
      )}
      {displayLabel}
    </span>
  );
}
