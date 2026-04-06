import { format } from "date-fns";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getErrorMessage } from "@/lib/errors";
import { getHabitIcon } from "@/lib/habitIcons";
import type { DigestiveLog } from "@/types/domain";
import { DigestiveSubRow } from "../editors/DigestiveSubRow";
import {
  applyDateTimeToTimestamp,
  findHabitConfigForHabitLog,
  getLogColor,
  getLogDetail,
  getLogIcon,
  getLogNotes,
  getLogTitle,
  truncatePreviewText,
} from "../helpers";
import { useTodayLogActions } from "../TodayLogContext";
import type { LogEntryProps } from "../types";
import { useAutoEditEntry } from "../useAutoEditEntry";

// ── Digestion dispatcher ─────────────────────────────────────────────────

function DigestiveEntry({ log }: { log: DigestiveLog }) {
  return <DigestiveSubRow entry={log} />;
}

// ── Generic entry (unknown/future log types) ─────────────────────────────

function GenericEntry({ log, habits }: Pick<LogEntryProps, "log" | "habits">) {
  const { onSave, onDelete } = useTodayLogActions();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftDate, setDraftDate] = useState(() => format(log.timestamp, "yyyy-MM-dd"));
  const [draftTimestamp, setDraftTimestamp] = useState(() => format(log.timestamp, "HH:mm"));

  const habitConfig = log.type === "habit" ? findHabitConfigForHabitLog(habits, log.data) : null;
  const { Icon, color } = habitConfig
    ? {
        Icon: getHabitIcon(habitConfig).Icon,
        color: getHabitIcon(habitConfig).toneClassName,
      }
    : { Icon: getLogIcon(log), color: getLogColor(log) };

  const title = getLogTitle(log, habits);
  const detail = getLogDetail(log);
  const notesText = getLogNotes(log);

  const startEditing = useCallback(() => {
    setConfirmDelete(false);
    setDraftDate(format(log.timestamp, "yyyy-MM-dd"));
    setDraftTimestamp(format(log.timestamp, "HH:mm"));
    setEditing(true);
  }, [log.timestamp]);

  useAutoEditEntry(log.id, startEditing);

  const cancelEditing = () => {
    setEditing(false);
    setDraftDate(format(log.timestamp, "yyyy-MM-dd"));
    setDraftTimestamp(format(log.timestamp, "HH:mm"));
  };

  const handleSave = async () => {
    const newTimestamp = applyDateTimeToTimestamp(log.timestamp, draftDate, draftTimestamp);
    try {
      setSaving(true);
      await onSave(log.id, { ...log.data }, newTimestamp);
      setEditing(false);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to save. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await onDelete(log.id);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to delete entry."));
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="log-entry flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-[var(--section-log-muted)]">
      <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${color}`} />

      <div className="min-w-0 flex-1 overflow-hidden">
        {editing ? (
          <div className="flex flex-wrap items-center gap-1">
            <input
              type="date"
              value={draftDate}
              onChange={(e) => setDraftDate(e.target.value)}
              className="rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] px-2 py-1 font-mono text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--section-log)]"
            />
            <input
              type="time"
              value={draftTimestamp}
              onChange={(e) => setDraftTimestamp(e.target.value)}
              className="w-20 rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] px-2 py-1 font-mono text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--section-log)]"
            />
          </div>
        ) : (
          <>
            <Tooltip>
              <TooltipTrigger
                render={
                  <span className="block truncate text-sm font-semibold text-[var(--color-text-primary)]" />
                }
              >
                {title}
              </TooltipTrigger>
              <TooltipContent side="top" className="text-sm">
                {title}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <p className="mt-0.5 truncate font-mono text-xs text-[var(--color-text-tertiary)]" />
                }
              >
                {truncatePreviewText(
                  `${format(log.timestamp, "HH:mm")}${detail ? `  ${detail}` : ""}`,
                )}
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[56ch] text-sm leading-snug">
                {format(log.timestamp, "HH:mm")}
                {detail ? `  ${detail}` : ""}
              </TooltipContent>
            </Tooltip>
            {notesText && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <p className="mt-0.5 truncate text-xs italic text-[var(--color-text-tertiary)]" />
                  }
                >
                  {truncatePreviewText(notesText)}
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[56ch] text-sm leading-snug">
                  {notesText}
                </TooltipContent>
              </Tooltip>
            )}
          </>
        )}
      </div>

      <div className="flex flex-shrink-0 items-center gap-1">
        {confirmDelete ? (
          <>
            <span className="text-xs text-[var(--color-text-secondary)]">Sure?</span>
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={deleting}
              className="min-h-[36px] rounded-lg bg-red-500/20 px-2.5 py-1 text-xs font-semibold text-red-400 hover:bg-red-500/30"
            >
              {deleting ? "..." : "Yes"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="min-h-[36px] rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] px-2.5 py-1 text-xs font-semibold text-[var(--color-text-secondary)]"
            >
              No
            </button>
          </>
        ) : editing ? (
          <>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--section-log)] hover:bg-[var(--section-log-muted)] disabled:opacity-50"
              aria-label="Save"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={cancelEditing}
              disabled={saving}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-tertiary)] hover:bg-[var(--section-log-muted)] disabled:opacity-50"
              aria-label="Cancel"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={startEditing}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-tertiary)] opacity-30 transition-all hover:bg-[var(--section-log-muted)] hover:text-blue-400 hover:opacity-100"
              aria-label="Edit"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-tertiary)] opacity-30 transition-all hover:bg-[var(--section-log-muted)] hover:text-red-400 hover:opacity-100"
              aria-label="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Dispatcher ────────────────────────────────────────────────────────────

export function LogEntry({ log, habits }: LogEntryProps) {
  if (log.type === "digestion") {
    return <DigestiveEntry log={log as DigestiveLog} />;
  }
  return <GenericEntry log={log} habits={habits} />;
}
