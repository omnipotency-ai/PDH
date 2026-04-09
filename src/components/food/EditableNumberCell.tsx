import type React from "react";

import { cn } from "@/lib/utils";

import { useInlineEdit } from "./useInlineEdit";

interface EditableNumberCellProps {
  value: number | null;
  onSave: (value: number | null) => Promise<void> | void;
  suffix?: string;
  min?: number;
  className?: string;
}

/** Format a number for display: no trailing zeros, null shows empty. */
function formatDisplay(value: number | null, suffix: string | undefined): string {
  if (value === null) return "";
  const formatted = Number.isInteger(value) ? String(value) : String(parseFloat(value.toFixed(4)));
  if (suffix !== undefined) {
    return `${formatted}${suffix}`;
  }
  return formatted;
}

/**
 * Inline-editable number cell for TanStack React Table.
 * Click to edit, blur/Enter to save, Escape to cancel.
 * Validates that value >= min (default 0).
 * Keeps the editor open on save/validation failure and shows an error message.
 */
export function EditableNumberCell({
  value,
  onSave,
  suffix,
  min = 0,
  className,
}: EditableNumberCellProps) {
  const stringValue = value === null ? "" : String(value);

  const handleSave = async (raw: string) => {
    if (raw === "") {
      await onSave(null);
      return;
    }
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) {
      throw new Error("Invalid number");
    }
    if (parsed < min) {
      throw new Error(`Value must be >= ${min}`);
    }
    await onSave(parsed);
  };

  const {
    isEditing,
    editValue,
    error,
    startEdit,
    cancelEdit,
    commitEdit,
    setEditValue,
    clearError,
    inputRef,
  } = useInlineEdit({ initialValue: stringValue, onSave: handleSave });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void commitEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    }
  };

  if (isEditing) {
    return (
      <div data-slot="editable-number-cell" className="flex flex-col gap-0.5">
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="number"
          inputMode="decimal"
          value={editValue}
          onChange={(e) => {
            setEditValue(e.target.value);
            if (error !== null) clearError();
          }}
          onBlur={() => void commitEdit()}
          onKeyDown={handleKeyDown}
          {...(min !== undefined && { min })}
          className={cn(
            "w-full min-w-0 rounded-md bg-transparent px-1.5 py-0.5 text-sm text-[var(--text)]",
            "ring-1 outline-none",
            error !== null
              ? "ring-red-500 focus-visible:ring-red-500"
              : "ring-[var(--border)] focus-visible:ring-[var(--ring)]",
            // Hide browser number spinners for cleaner inline appearance.
            "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
            className,
          )}
        />
        {error !== null && <span className="text-xs text-red-500">{error}</span>}
      </div>
    );
  }

  const displayText = formatDisplay(value, suffix);

  return (
    <span
      data-slot="editable-number-cell"
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
        "inline-block w-full cursor-pointer rounded-md px-1.5 py-0.5 text-sm tabular-nums",
        "text-[var(--text)] hover:bg-[var(--surface-2)]",
        "transition-colors duration-150",
        !displayText && "text-[var(--text-faint)] italic",
        className,
      )}
    >
      {displayText || "\u00A0"}
    </span>
  );
}
