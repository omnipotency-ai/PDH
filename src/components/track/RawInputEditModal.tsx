/**
 * Modal for editing a food log's raw input text.
 *
 * When saved, the rawInput is replaced and items is set to an empty array.
 * The Convex reactive pipeline detects the empty items array on the updated
 * log and automatically re-triggers server-side food processing from Stage 1
 * (deterministic registry matching, then LLM matching for unresolved items).
 *
 * The previous rawInput is not preserved — the user is making a
 * conscious correction to their food entry.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ResponsiveShell } from "@/components/ui/responsive-shell";
import { getErrorMessage } from "@/lib/errors";
import { useUpdateSyncedLog } from "@/lib/sync";

interface RawInputEditModalProps {
  /** Whether the modal is open. */
  open: boolean;
  /** Callback to close the modal. */
  onOpenChange: (open: boolean) => void;
  /** The log ID to edit. */
  logId: string;
  /** The current rawInput text to show in the editor. */
  currentRawInput: string;
  /** The log's current timestamp (needed for the update mutation). */
  logTimestamp: number;
  /** Existing notes on the log entry, preserved across edits. */
  currentNotes?: string;
  /** The log's type — preserved so liquid logs don't become food logs on edit. */
  logType?: "food" | "liquid";
}

export function RawInputEditModal({
  open,
  onOpenChange,
  logId,
  currentRawInput,
  logTimestamp,
  currentNotes,
  logType = "food",
}: RawInputEditModalProps) {
  const [editedText, setEditedText] = useState(currentRawInput);
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const updateSyncedLog = useUpdateSyncedLog();

  // Sync editedText when the modal opens with new content
  useEffect(() => {
    if (open) {
      setEditedText(currentRawInput);
    }
  }, [open, currentRawInput]);

  // Auto-focus the textarea when the modal opens
  useEffect(() => {
    if (open && textareaRef.current) {
      // Small delay to ensure the modal animation has started
      const timeout = setTimeout(() => {
        textareaRef.current?.focus();
        // Place cursor at the end
        const length = textareaRef.current?.value.length ?? 0;
        textareaRef.current?.setSelectionRange(length, length);
      }, 100);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [open]);

  const handleSave = useCallback(async () => {
    const trimmed = editedText.trim();
    if (!trimmed) {
      toast.error("Food entry cannot be empty.");
      return;
    }

    if (trimmed === currentRawInput.trim()) {
      // No change — just close
      onOpenChange(false);
      return;
    }

    setIsSaving(true);
    try {
      // Update the log with new rawInput and empty items (triggers reprocessing).
      // Preserve existing notes so they are not silently cleared.
      await updateSyncedLog({
        id: logId,
        timestamp: logTimestamp,
        type: logType,
        data: {
          rawInput: trimmed,
          items: [],
          notes: currentNotes ?? "",
        },
      });

      toast.success("Food entry updated. Reprocessing...");
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to update food entry."));
    } finally {
      setIsSaving(false);
    }
  }, [
    editedText,
    currentRawInput,
    currentNotes,
    logId,
    logTimestamp,
    updateSyncedLog,
    onOpenChange,
  ]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Cmd/Ctrl+Enter saves
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        void handleSave();
      }
    },
    [handleSave],
  );

  const hasChanges = editedText.trim() !== currentRawInput.trim();

  return (
    <ResponsiveShell
      open={open}
      onOpenChange={onOpenChange}
      title="Edit food entry"
      description="Edit the raw text of your food entry. This will trigger full reprocessing."
    >
      <div data-slot="raw-input-edit-body" className="space-y-4 p-4">
        <div className="space-y-1.5">
          <label
            htmlFor="raw-input-editor"
            className="text-xs font-medium text-[var(--text-muted)]"
          >
            What did you eat?
          </label>
          <textarea
            ref={textareaRef}
            id="raw-input-editor"
            value={editedText}
            onChange={(event) => setEditedText(event.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={500}
            rows={3}
            className="w-full rounded-lg border border-[var(--section-food-border)] bg-[var(--section-food-muted)] px-3 py-2 text-sm text-[var(--text-muted)] placeholder:text-[var(--text-faint)] focus:border-[var(--section-food)]/50 focus:ring-2 focus:ring-[var(--section-food)]/30 focus:outline-none resize-none"
            placeholder="eg. two toast, honey, butter"
          />
          <p className="text-[10px] text-[var(--text-faint)]">
            Separate items with commas. Save to reprocess.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => void handleSave()}
            disabled={isSaving || !editedText.trim() || !hasChanges}
            className="rounded-[6px] px-4 text-xs font-semibold"
            style={{
              border: "none",
              background: "var(--section-food)",
              color: "#ffffff",
              boxShadow: "0 0 12px var(--section-food-glow)",
            }}
          >
            {isSaving ? "Saving..." : "Save & Reprocess"}
          </Button>
        </div>
      </div>
    </ResponsiveShell>
  );
}
