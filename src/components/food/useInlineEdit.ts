import { useCallback, useEffect, useRef, useState } from "react";

interface UseInlineEditOptions {
  /** The current display value (converted to string for editing). */
  initialValue: string;
  /** Async callback to persist the new value. Rejects on error to trigger revert. */
  onSave: (value: string) => Promise<void> | void;
}

interface UseInlineEditReturn {
  isEditing: boolean;
  editValue: string;
  startEdit: () => void;
  cancelEdit: () => void;
  commitEdit: () => Promise<void>;
  setEditValue: (v: string) => void;
  inputRef: React.RefObject<HTMLInputElement | HTMLSelectElement | null>;
}

/**
 * Manages per-cell inline edit state: click to edit, blur/Enter to save, Escape to cancel.
 * Handles optimistic display and reverts on save failure.
 */
export function useInlineEdit({
  initialValue,
  onSave,
}: UseInlineEditOptions): UseInlineEditReturn {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null);

  // Keep editValue in sync with external value changes when not actively editing.
  useEffect(() => {
    if (!isEditing) {
      setEditValue(initialValue);
    }
  }, [initialValue, isEditing]);

  // Focus input when editing starts.
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      // Select all text in input for easy replacement.
      if (inputRef.current instanceof HTMLInputElement) {
        inputRef.current.select();
      }
    }
  }, [isEditing]);

  const startEdit = useCallback(() => {
    setEditValue(initialValue);
    setIsEditing(true);
  }, [initialValue]);

  const cancelEdit = useCallback(() => {
    setEditValue(initialValue);
    setIsEditing(false);
  }, [initialValue]);

  const commitEdit = useCallback(async () => {
    const trimmed = editValue.trim();

    // No change — just close the editor.
    if (trimmed === initialValue) {
      setIsEditing(false);
      return;
    }

    // Optimistically close editor with new value.
    setIsEditing(false);

    try {
      await onSave(trimmed);
    } catch {
      // Revert on failure — the parent will still hold the old value,
      // so editValue resets via the useEffect sync above.
      setEditValue(initialValue);
    }
  }, [editValue, initialValue, onSave]);

  return {
    isEditing,
    editValue,
    startEdit,
    cancelEdit,
    commitEdit,
    setEditValue,
    inputRef,
  };
}
