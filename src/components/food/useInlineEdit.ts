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
  /** Non-null when the last save attempt failed. Shown by the cell as an error message. */
  error: string | null;
  startEdit: () => void;
  cancelEdit: () => void;
  commitEdit: () => Promise<void>;
  setEditValue: (v: string) => void;
  /** Clears a displayed error without cancelling the edit. */
  clearError: () => void;
  inputRef: React.RefObject<HTMLInputElement | HTMLSelectElement | null>;
}

/**
 * Manages per-cell inline edit state: click to edit, blur/Enter to save, Escape to cancel.
 * The editor stays open on save failure and exposes an error message for the caller to display.
 */
export function useInlineEdit({ initialValue, onSave }: UseInlineEditOptions): UseInlineEditReturn {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null);
  const inFlightSaveRef = useRef<Promise<void> | null>(null);

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

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const startEdit = useCallback(() => {
    setEditValue(initialValue);
    setError(null);
    setIsEditing(true);
  }, [initialValue]);

  const cancelEdit = useCallback(() => {
    setEditValue(initialValue);
    setError(null);
    setIsEditing(false);
  }, [initialValue]);

  const commitEdit = useCallback(async () => {
    if (inFlightSaveRef.current !== null) {
      return inFlightSaveRef.current;
    }

    const trimmed = editValue.trim();

    // No change — just close the editor.
    if (trimmed === initialValue) {
      setError(null);
      setIsEditing(false);
      return;
    }

    // Attempt save first. Only close the editor on success.
    // On failure, keep the editor open and surface the error so the user can retry or cancel.
    const savePromise = (async () => {
      try {
        await onSave(trimmed);
        setError(null);
        setIsEditing(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
        // isEditing remains true — user can retry or press Escape to cancel.
      } finally {
        inFlightSaveRef.current = null;
      }
    })();

    inFlightSaveRef.current = savePromise;
    await savePromise;
  }, [editValue, initialValue, onSave]);

  return {
    isEditing,
    editValue,
    error,
    startEdit,
    cancelEdit,
    commitEdit,
    setEditValue,
    clearError,
    inputRef,
  };
}
