import { format } from "date-fns";
import { AlertTriangle, ChevronDown, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { BristolBadge } from "@/components/track/panels/BristolScale";
import { BOWEL_LOG_LABELS } from "@/components/track/panels/bowelConstants";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getErrorMessage } from "@/lib/errors";
import type { DigestiveLog, DigestiveLogData } from "@/types/domain";
import {
  applyDateTimeToTimestamp,
  getLogColor,
  getLogIcon,
  getLogNotes,
  getLogTitle,
  titleCaseToken as titleCase,
  truncatePreviewText,
} from "../helpers";
import {
  logGroupChevronTransition,
  logGroupExpandTransition,
  logGroupExpandVariants,
} from "../motion";
import { useTodayLogActions } from "../TodayLogContext";
import { useAutoEditEntry } from "../useAutoEditEntry";

const SELECTED_CHIP_STYLE = {
  backgroundColor: "color-mix(in srgb, var(--section-bowel) 20%, var(--color-bg-elevated) 80%)",
  border: "1px solid color-mix(in srgb, var(--section-bowel) 40%, transparent)",
  color: "color-mix(in srgb, var(--section-bowel) 88%, var(--color-text-primary) 12%)",
  boxShadow: "inset 0 1px 0 color-mix(in srgb, white 18%, transparent)",
} as const;

const IDLE_CHIP_STYLE = {
  backgroundColor: "var(--color-bg-elevated)",
  border: "1px solid var(--color-border-default)",
  color: "var(--color-text-tertiary)",
} as const;

export function DigestiveSubRow({ entry }: { entry: DigestiveLog }) {
  const { onSave, onDelete } = useTodayLogActions();

  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [draftBristol, setDraftBristol] = useState(0);
  const [draftEpisodes, setDraftEpisodes] = useState(1);
  const [draftUrgency, setDraftUrgency] = useState("");
  const [draftEffort, setDraftEffort] = useState("");
  const [draftVolume, setDraftVolume] = useState("");
  const [draftAccident, setDraftAccident] = useState(false);
  const [draftNotes, setDraftNotes] = useState("");
  const [draftDate, setDraftDate] = useState(() => format(entry.timestamp, "yyyy-MM-dd"));
  const [draftTime, setDraftTime] = useState(() => format(entry.timestamp, "HH:mm"));

  const Icon = getLogIcon(entry);
  const color = getLogColor(entry);
  const title = getLogTitle(entry, []);
  const notesText = getLogNotes(entry);

  const seedDrafts = useCallback(() => {
    setDraftBristol(Number(entry.data?.bristolCode) || 0);
    setDraftEpisodes(Number(entry.data?.episodesCount) || 1);
    setDraftUrgency(String(entry.data?.urgencyTag ?? ""));
    setDraftEffort(String(entry.data?.effortTag ?? ""));
    setDraftVolume(String(entry.data?.volumeTag ?? ""));
    setDraftAccident(Boolean(entry.data?.accident));
    setDraftNotes(String(entry.data?.notes ?? ""));
    setDraftDate(format(entry.timestamp, "yyyy-MM-dd"));
    setDraftTime(format(entry.timestamp, "HH:mm"));
  }, [entry]);

  const handleToggleExpand = () => {
    if (!expanded) {
      seedDrafts();
    }
    setExpanded((prev) => !prev);
  };

  // Auto-open edit mode when this entry's ID matches the toast "Edit" target
  const handleAutoEdit = useCallback(() => {
    if (!expanded) {
      seedDrafts();
      setExpanded(true);
    }
  }, [expanded, seedDrafts]);
  useAutoEditEntry(entry.id, handleAutoEdit);

  const handleSave = async () => {
    const bristolCode = (draftBristol || entry.data?.bristolCode) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
    let consistencyTag: string | undefined;
    if (draftBristol === 7) consistencyTag = "watery";
    else if (draftBristol === 6) consistencyTag = "loose";
    else if (draftBristol === 5) consistencyTag = "soft";
    else if (draftBristol >= 3) consistencyTag = "normal";
    else if (draftBristol >= 1) consistencyTag = "hard";

    const notes = draftNotes.trim();
    const nextData: DigestiveLogData = {
      bristolCode,
      episodesCount: draftEpisodes,
      accident: draftAccident,
      ...(draftUrgency && { urgencyTag: draftUrgency }),
      ...(draftEffort && { effortTag: draftEffort }),
      ...(draftVolume && { volumeTag: draftVolume }),
      ...(consistencyTag !== undefined && { consistencyTag }),
      ...(notes.length > 0 && { notes }),
      ...(entry.data?.windowMinutes !== undefined && {
        windowMinutes: entry.data.windowMinutes,
      }),
    };

    const newTimestamp = applyDateTimeToTimestamp(entry.timestamp, draftDate, draftTime);

    try {
      setSaving(true);
      await onSave(entry.id, nextData, newTimestamp);
      setExpanded(false);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to save bowel movement."));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await onDelete(entry.id);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to delete entry."));
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  // Pre-compute collapsed summary fields
  const bristolCode = Number(entry.data?.bristolCode) || 0;
  const volumeTag = String(entry.data?.volumeTag ?? "");
  const urgencyTag = String(entry.data?.urgencyTag ?? "");
  const effortTag = String(entry.data?.effortTag ?? "");

  // Build Line 2: "HH:mm · B4 · Volume: Small"
  const collapsedLine2Parts: string[] = [format(entry.timestamp, "HH:mm")];
  if (bristolCode > 0) collapsedLine2Parts.push(`B${bristolCode}`);
  if (volumeTag) {
    collapsedLine2Parts.push(
      `Volume: ${BOWEL_LOG_LABELS.volume[volumeTag as keyof typeof BOWEL_LOG_LABELS.volume] ?? titleCase(volumeTag)}`,
    );
  }
  const collapsedLine2 = collapsedLine2Parts.join(" \u00B7 ");

  // Build Line 3: "Urgency: Low · Effort: Some"
  const collapsedLine3Parts: string[] = [];
  if (urgencyTag) {
    collapsedLine3Parts.push(
      `Urgency: ${BOWEL_LOG_LABELS.urgency[urgencyTag as keyof typeof BOWEL_LOG_LABELS.urgency] ?? titleCase(urgencyTag)}`,
    );
  }
  if (effortTag) {
    collapsedLine3Parts.push(
      `Effort: ${BOWEL_LOG_LABELS.effort[effortTag as keyof typeof BOWEL_LOG_LABELS.effort] ?? titleCase(effortTag)}`,
    );
  }
  const collapsedLine3 = collapsedLine3Parts.join(" \u00B7 ");

  return (
    <div className="log-entry group rounded-xl transition-colors hover:bg-[var(--section-log-muted)]">
      <button
        type="button"
        onClick={handleToggleExpand}
        aria-expanded={expanded}
        aria-controls={`digestion-detail-${entry.id}`}
        className="flex w-full items-start gap-3 px-3 py-2.5 text-left"
      >
        <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${color}`} />
        <div className="min-w-0 flex-1">
          {/* Line 1: Title + Bristol badge */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</span>
            {!expanded && bristolCode > 0 && <BristolBadge code={bristolCode} />}
          </div>
          {!expanded && (
            <>
              {/* Line 2: time · bristol code · volume */}
              <p className="mt-0.5 truncate font-mono text-xs text-[var(--color-text-tertiary)]">
                {collapsedLine2}
              </p>
              {/* Line 3: urgency · effort (only if present) */}
              {collapsedLine3 && (
                <p className="mt-0.5 truncate font-mono text-xs text-[var(--color-text-tertiary)]">
                  {collapsedLine3}
                </p>
              )}
              {/* Line 4: note preview */}
              {notesText && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <p className="mt-0.5 truncate text-xs italic text-[var(--color-text-tertiary)]" />
                    }
                  >
                    {truncatePreviewText(notesText, 26)}
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[56ch] text-sm leading-snug">
                    {notesText}
                  </TooltipContent>
                </Tooltip>
              )}
            </>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {entry.data?.accident && (
            <span
              role="img"
              aria-label="Accident reported"
              title="Accident"
              className="rounded-full bg-red-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-red-400"
            >
              !
            </span>
          )}
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={logGroupChevronTransition}
            aria-hidden="true"
          >
            <ChevronDown className="h-4 w-4 text-[var(--color-text-tertiary)]" />
          </motion.div>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            id={`digestion-detail-${entry.id}`}
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            variants={logGroupExpandVariants}
            transition={logGroupExpandTransition}
            className="overflow-hidden"
          >
            <fieldset className="ml-7 max-w-[46ch] space-y-2 border-none p-0 m-0 px-3 pb-3 pt-1">
              <legend className="sr-only">Edit bowel movement</legend>

              {/* When: Date + Time */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-14 text-xs font-medium text-[var(--color-text-tertiary)]">
                  When
                </span>
                <input
                  type="date"
                  value={draftDate}
                  onChange={(e) => setDraftDate(e.target.value)}
                  className="rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] px-2 py-1 font-mono text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--section-log)]"
                />
                <input
                  type="time"
                  value={draftTime}
                  onChange={(e) => setDraftTime(e.target.value)}
                  className="w-28 rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] px-2 py-1 font-mono text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--section-log)]"
                />
              </div>

              {/* Bristol */}
              <div className="flex flex-wrap items-center gap-1">
                <span className="w-14 text-xs font-medium text-[var(--color-text-tertiary)]">
                  Bristol
                </span>
                {[1, 2, 3, 4, 5, 6, 7].map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setDraftBristol(code)}
                    aria-label={`Type ${code}`}
                    aria-pressed={draftBristol === code}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold transition-colors"
                    style={draftBristol === code ? SELECTED_CHIP_STYLE : IDLE_CHIP_STYLE}
                  >
                    {code}
                  </button>
                ))}
              </div>

              {/* Episodes + Accident */}
              <div className="flex items-center gap-2">
                <span className="w-14 text-xs font-medium text-[var(--color-text-tertiary)]">
                  Episodes
                </span>
                <input
                  type="number"
                  min={1}
                  value={draftEpisodes}
                  onChange={(e) => setDraftEpisodes(Math.max(1, Number(e.target.value) || 1))}
                  className="w-14 rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] px-1.5 py-1 text-center text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--section-log)]"
                />
                <button
                  type="button"
                  onClick={() => setDraftAccident(!draftAccident)}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors"
                  style={
                    draftAccident
                      ? {
                          backgroundColor: "rgba(239, 68, 68, 0.12)",
                          border: "1px solid rgba(239, 68, 68, 0.28)",
                          color: "rgb(220, 38, 38)",
                        }
                      : IDLE_CHIP_STYLE
                  }
                >
                  <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                  Accident
                </button>
              </div>

              {/* Urgency */}
              <div className="flex flex-wrap items-center gap-1">
                <span className="w-14 text-xs font-medium text-[var(--color-text-tertiary)]">
                  Urgency
                </span>
                {(["low", "medium", "high", "immediate"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setDraftUrgency(draftUrgency === v ? "" : v)}
                    className="rounded-md px-2 py-1 text-xs transition-colors"
                    style={draftUrgency === v ? SELECTED_CHIP_STYLE : IDLE_CHIP_STYLE}
                  >
                    {BOWEL_LOG_LABELS.urgency[v]}
                  </button>
                ))}
              </div>

              {/* Effort */}
              <div className="flex flex-wrap items-center gap-1">
                <span className="w-14 text-xs font-medium text-[var(--color-text-tertiary)]">
                  Effort
                </span>
                {(["none", "some", "hard", "urgent-release"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setDraftEffort(draftEffort === v ? "" : v)}
                    className="rounded-md px-2 py-1 text-xs transition-colors"
                    style={draftEffort === v ? SELECTED_CHIP_STYLE : IDLE_CHIP_STYLE}
                  >
                    {BOWEL_LOG_LABELS.effort[v]}
                  </button>
                ))}
              </div>

              {/* Volume */}
              <div className="flex flex-wrap items-center gap-1">
                <span className="w-14 text-xs font-medium text-[var(--color-text-tertiary)]">
                  Volume
                </span>
                {(["small", "medium", "large", "juices"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setDraftVolume(draftVolume === v ? "" : v)}
                    className="rounded-md px-2 py-1 text-xs transition-colors"
                    style={draftVolume === v ? SELECTED_CHIP_STYLE : IDLE_CHIP_STYLE}
                  >
                    {BOWEL_LOG_LABELS.volume[v]}
                  </button>
                ))}
              </div>

              {/* Notes */}
              <textarea
                value={draftNotes}
                maxLength={400}
                onChange={(e) => setDraftNotes(e.target.value)}
                className="w-full max-w-[45ch] resize-none overflow-y-auto rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] px-2 py-1 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--section-log)]"
                rows={2}
                style={{ maxHeight: "5rem" }}
                placeholder="Add notes"
              />

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={saving || (!draftBristol && !entry.data?.bristolCode)}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                  style={SELECTED_CHIP_STYLE}
                >
                  {saving ? "Saving..." : "Save"}
                </button>
                {confirmDelete ? (
                  <>
                    <span className="text-xs text-[var(--color-text-secondary)]">Delete?</span>
                    <button
                      type="button"
                      onClick={() => void handleDelete()}
                      disabled={deleting}
                      className="min-h-[28px] rounded-lg bg-red-500/20 px-2.5 py-1 text-xs font-semibold text-red-400 hover:bg-red-500/30"
                    >
                      {deleting ? "..." : "Yes"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="min-h-[28px] rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] px-2.5 py-1 text-xs font-semibold text-[var(--color-text-secondary)]"
                    >
                      No
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-[var(--color-text-tertiary)] hover:text-red-400"
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete
                  </button>
                )}
              </div>
            </fieldset>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
