import type React from "react";

import { cn } from "@/lib/utils";

import { useInlineEdit } from "./useInlineEdit";

interface EditableCellProps {
  value: string;
  onSave: (value: string) => Promise<void> | void;
  placeholder?: string;
  className?: string;
}

/**
 * Inline-editable text cell for TanStack React Table.
 * Click to edit, blur/Enter to save, Escape to cancel.
 */
export function EditableCell({
  value,
  onSave,
  placeholder,
  className,
}: EditableCellProps) {
  const {
    isEditing,
    editValue,
    startEdit,
    cancelEdit,
    commitEdit,
    setEditValue,
    inputRef,
  } = useInlineEdit({ initialValue: value, onSave });

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
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        data-slot="editable-cell"
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={() => void commitEdit()}
        onKeyDown={handleKeyDown}
        className={cn(
          "w-full min-w-0 rounded-md bg-transparent px-1.5 py-0.5 text-sm text-[var(--text)]",
          "ring-1 ring-[var(--border)] outline-none",
          "focus-visible:ring-[var(--ring)]",
          className,
        )}
        {...(placeholder !== undefined && { placeholder })}
      />
    );
  }

  return (
    <span
      data-slot="editable-cell"
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
        "inline-block w-full cursor-pointer rounded-md px-1.5 py-0.5 text-sm",
        "text-[var(--text)] hover:bg-[var(--surface-2)]",
        "transition-colors duration-150",
        !value && "text-[var(--text-faint)] italic",
        className,
      )}
    >
      {value || placeholder || "\u00A0"}
    </span>
  );
}
