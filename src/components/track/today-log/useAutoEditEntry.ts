import { useEffect, useRef } from "react";
import { useAutoEdit } from "./AutoEditContext";

/**
 * Hook for sub-row editors that auto-opens edit mode when the entry ID
 * matches the autoEditId from context.
 *
 * @param entryId - The log entry's ID
 * @param startEditing - Callback to enter edit mode (should initialize draft state + set editing=true)
 */
export function useAutoEditEntry(entryId: string, startEditing: () => void): void {
  const { autoEditId, onAutoEditHandled } = useAutoEdit();
  const lastHandledRef = useRef<string | null>(null);

  useEffect(() => {
    if (autoEditId != null && autoEditId === entryId && autoEditId !== lastHandledRef.current) {
      lastHandledRef.current = autoEditId;
      startEditing();
      onAutoEditHandled();
    }
  }, [autoEditId, entryId, startEditing, onAutoEditHandled]);
}
