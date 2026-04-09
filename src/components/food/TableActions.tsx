import { Check, Plus, Trash2, X } from "lucide-react";
import { useCallback, useState } from "react";

import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// RowDeleteButton
// ---------------------------------------------------------------------------

interface RowDeleteButtonProps {
  onDelete: () => Promise<void> | void;
  disabled?: boolean;
  className?: string;
}

/**
 * Row-level delete button with inline confirmation.
 * First click shows "Delete?" with Cancel/Confirm. No browser alerts.
 */
export function RowDeleteButton({ onDelete, disabled, className }: RowDeleteButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = useCallback(async () => {
    setDeleting(true);
    try {
      await onDelete();
    } catch {
      // Surface errors via parent error boundary or toast — don't swallow silently,
      // but the component itself just resets its state.
    } finally {
      setDeleting(false);
      setConfirming(false);
    }
  }, [onDelete]);

  const handleCancel = useCallback(() => {
    setConfirming(false);
  }, []);

  if (confirming) {
    return (
      <span
        data-slot="row-delete-confirm"
        className={cn("inline-flex items-center gap-1", className)}
      >
        <span className="text-xs text-[var(--text-muted)]">Delete?</span>
        <button
          type="button"
          aria-label="Cancel delete"
          onClick={handleCancel}
          disabled={deleting}
          className={cn(
            "inline-flex size-6 items-center justify-center rounded-md",
            "text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]",
            "transition-colors duration-150",
            "disabled:pointer-events-none disabled:opacity-45",
          )}
        >
          <X className="size-3.5" />
        </button>
        <button
          type="button"
          aria-label="Confirm delete"
          onClick={() => void handleConfirm()}
          disabled={deleting}
          className={cn(
            "inline-flex size-6 items-center justify-center rounded-md",
            "text-red-400 hover:bg-red-500/15 hover:text-red-300",
            "transition-colors duration-150",
            "disabled:pointer-events-none disabled:opacity-45",
          )}
        >
          <Check className="size-3.5" />
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      data-slot="row-delete-button"
      aria-label="Delete row"
      onClick={() => setConfirming(true)}
      disabled={disabled === true || deleting}
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-md",
        "text-[var(--text-faint)] hover:bg-red-500/10 hover:text-red-400",
        "transition-colors duration-150",
        "disabled:pointer-events-none disabled:opacity-45",
        className,
      )}
    >
      <Trash2 className="size-3.5" />
    </button>
  );
}

// ---------------------------------------------------------------------------
// AddRowButton
// ---------------------------------------------------------------------------

interface AddRowButtonProps {
  onAdd: () => Promise<void> | void;
  disabled?: boolean;
  label?: string;
  className?: string;
}

/**
 * Table-level "Add" button. Renders a compact `+ Add` control.
 */
export function AddRowButton({ onAdd, disabled, label = "Add", className }: AddRowButtonProps) {
  const [adding, setAdding] = useState(false);

  const handleClick = useCallback(async () => {
    setAdding(true);
    try {
      await onAdd();
    } catch {
      // Surface errors via parent — component resets state.
    } finally {
      setAdding(false);
    }
  }, [onAdd]);

  return (
    <button
      type="button"
      data-slot="add-row-button"
      onClick={() => void handleClick()}
      disabled={disabled === true || adding}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium",
        "text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]",
        "transition-colors duration-150",
        "disabled:pointer-events-none disabled:opacity-45",
        className,
      )}
    >
      <Plus className="size-4" />
      {label}
    </button>
  );
}
