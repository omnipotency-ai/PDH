import { format } from "date-fns";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { type ReactNode, useCallback, useState } from "react";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errors";
import { applyDateTimeToTimestamp } from "../helpers";
import { useTodayLogActions } from "../TodayLogContext";
import type { LogUpdateData } from "../types";
import { useAutoEditEntry } from "../useAutoEditEntry";

// ── Types ─────────────────────────────────────────────────────────────

export interface EditableEntryRowProps {
  /** The log entry ID (used for save/delete callbacks and auto-edit). */
  entryId: string;
  /** The entry timestamp (used for date/time draft initialization). */
  timestamp: number;
  /** Human-readable error context for the toast (e.g. "Failed to save fluid entry."). */
  saveErrorMessage: string;

  /**
   * Called when the user clicks Save. Must return the data to persist.
   * Receives the current draft date/time strings so the caller can build their data.
   */
  buildSaveData: () => LogUpdateData;

  /**
   * Called when entering edit mode so the parent can reset its domain-specific draft state.
   * The shared date/time drafts are reset automatically.
   */
  onStartEditing?: () => void;

  /**
   * Called when the user cancels editing (optional — for editors that want to reset
   * domain-specific draft state on cancel).
   */
  onCancelEditing?: () => void;

  /** The form fields unique to this entry type, rendered inside the edit mode wrapper. */
  renderEditFields: (props: { draftDate: string; draftTime: string }) => ReactNode;

  /** The display content shown in non-editing mode. */
  renderDisplay: () => ReactNode;

  /**
   * Optional extra action buttons rendered before the Edit pencil in display mode.
   * Used by FoodSubRow for the raw-input edit button.
   */
  renderExtraActions?: () => ReactNode;

  /**
   * Whether the edit form wraps the date/time inputs and custom fields in a
   * single flex row (default) or uses a multi-row layout with space-y.
   * - "inline": single flex row with gap-1 (HabitSubRow, ActivitySubRow, WeightSubRow)
   * - "stacked": space-y-1 wrapper, date/time in their own row (FluidSubRow, FoodSubRow)
   * - "stacked-2": space-y-2 with border/bg — used by editors that need extra visual
   *   separation, e.g. a digestion detail editor embedded inside a group row.
   *   TODO: audit current callers and remove if unused.
   */
  editLayout?: "inline" | "stacked" | "stacked-2";

  /**
   * Controls the padding of the outer display wrapper.
   * - "compact" (default): py-1 — used by most single-line editors
   * - "normal": py-1.5 — used by FoodSubRow
   * - "spacious": py-2
   */
  displayPadding?: "compact" | "normal" | "spacious";

  /**
   * Whether to show the date input in edit mode. Defaults to true.
   * All current editors show it, but this provides flexibility.
   */
  showDateInput?: boolean;
}

function getDisplayPaddingClass(displayPadding: "compact" | "normal" | "spacious"): string {
  if (displayPadding === "spacious") return "py-2";
  if (displayPadding === "normal") return "py-1.5";
  return "py-1";
}

// ── Component ─────────────────────────────────────────────────────────

export function EditableEntryRow({
  entryId,
  timestamp,
  saveErrorMessage,
  buildSaveData,
  onStartEditing,
  onCancelEditing,
  renderEditFields,
  renderDisplay,
  renderExtraActions,
  editLayout = "inline",
  displayPadding = "compact",
  showDateInput = true,
}: EditableEntryRowProps) {
  const { onSave, onDelete } = useTodayLogActions();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [draftDate, setDraftDate] = useState(() => format(timestamp, "yyyy-MM-dd"));
  const [draftTime, setDraftTime] = useState(() => format(timestamp, "HH:mm"));

  const startEditing = useCallback(() => {
    setDraftDate(format(timestamp, "yyyy-MM-dd"));
    setDraftTime(format(timestamp, "HH:mm"));
    setConfirmDelete(false);
    onStartEditing?.();
    setEditing(true);
  }, [timestamp, onStartEditing]);

  useAutoEditEntry(entryId, startEditing);

  const handleSave = async () => {
    const data = buildSaveData();
    const newTimestamp = applyDateTimeToTimestamp(timestamp, draftDate, draftTime);
    try {
      setSaving(true);
      await onSave(entryId, data, newTimestamp);
      setEditing(false);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, saveErrorMessage));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    onCancelEditing?.();
    setEditing(false);
  };

  // ── Edit mode ───────────────────────────────────────────────────────

  if (editing) {
    const dateTimeInputs = (
      <>
        {showDateInput && (
          <input
            type="date"
            value={draftDate}
            onChange={(e) => setDraftDate(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleSave();
              }
            }}
            className="rounded border border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] px-1 py-0.5 font-mono text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--section-log)]"
          />
        )}
        <input
          type="time"
          value={draftTime}
          onChange={(e) => setDraftTime(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void handleSave();
            }
          }}
          className="w-[4.5rem] rounded border border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] px-1 py-0.5 font-mono text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--section-log)]"
        />
      </>
    );

    const saveButton = (
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="flex h-6 w-6 items-center justify-center rounded text-[var(--section-log)] hover:bg-[var(--section-log-muted)] disabled:opacity-50"
        aria-label="Save"
      >
        <Check className="h-3 w-3" />
      </button>
    );

    const cancelButton = (
      <button
        type="button"
        onClick={handleCancel}
        disabled={saving}
        className="flex h-6 w-6 items-center justify-center rounded text-[var(--color-text-tertiary)] hover:bg-[var(--section-log-muted)] disabled:opacity-50"
        aria-label="Cancel"
      >
        <X className="h-3 w-3" />
      </button>
    );

    if (editLayout === "inline") {
      return (
        <div
          data-slot="editable-entry-row"
          className="flex flex-wrap items-center gap-1 rounded-md px-2 py-1"
        >
          {dateTimeInputs}
          {renderEditFields({ draftDate, draftTime })}
          {saveButton}
          {cancelButton}
        </div>
      );
    }

    if (editLayout === "stacked-2") {
      return (
        <div
          data-slot="editable-entry-row"
          className="space-y-2 rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] px-2 py-2"
        >
          <div className="flex flex-wrap items-center gap-2">{dateTimeInputs}</div>
          {renderEditFields({ draftDate, draftTime })}
          <div className="flex items-center gap-1">
            {saveButton}
            {cancelButton}
          </div>
        </div>
      );
    }

    // stacked
    return (
      <div data-slot="editable-entry-row" className="space-y-1 rounded-md px-2 py-1">
        <div className="flex flex-wrap items-center gap-1">
          {dateTimeInputs}
          <div className="ml-auto flex items-center gap-0.5">
            {saveButton}
            {cancelButton}
          </div>
        </div>
        {renderEditFields({ draftDate, draftTime })}
      </div>
    );
  }

  // ── Display mode ────────────────────────────────────────────────────

  const paddingClass = getDisplayPaddingClass(displayPadding);

  return (
    <div
      data-slot="editable-entry-row"
      className={`group/entry flex items-start justify-between gap-2 rounded-md px-2 ${paddingClass} hover:bg-[var(--section-log-muted)]`}
    >
      {renderDisplay()}
      <div className="flex flex-shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/entry:opacity-100 focus-within:opacity-100">
        {renderExtraActions?.()}
        <button
          type="button"
          onClick={startEditing}
          className="flex h-6 w-6 items-center justify-center rounded text-[var(--color-text-tertiary)] hover:text-blue-400"
          aria-label="Edit entry"
        >
          <Pencil className="h-3 w-3" />
        </button>
        {confirmDelete ? (
          <>
            <span className="mr-1 text-xs text-slate-400">Sure?</span>
            <button
              type="button"
              className="rounded p-1 text-xs text-red-400 hover:bg-red-400/10"
              onClick={() =>
                void (async () => {
                  try {
                    await onDelete(entryId);
                    setConfirmDelete(false);
                  } catch (err: unknown) {
                    toast.error(getErrorMessage(err, "Failed to delete entry."));
                  }
                })()
              }
            >
              Yes
            </button>
            <button
              type="button"
              className="rounded p-1 text-xs text-slate-400 hover:bg-slate-400/10"
              onClick={() => setConfirmDelete(false)}
            >
              No
            </button>
          </>
        ) : (
          <button
            type="button"
            className="rounded p-1 text-slate-400 hover:text-red-400"
            onClick={() => setConfirmDelete(true)}
            aria-label="Delete entry"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
