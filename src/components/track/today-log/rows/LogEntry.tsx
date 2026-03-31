import { format } from "date-fns";
import { AlertTriangle, Check, ChevronDown, Pencil, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { BristolBadge } from "@/components/track/panels/BristolScale";
import { BOWEL_LOG_LABELS } from "@/components/track/panels/bowelConstants";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getErrorMessage } from "@/lib/errors";
import { getHabitIcon } from "@/lib/habitIcons";
import type { DigestiveLogData, FluidLogData, FoodLogData } from "@/types/domain";
import {
  applyDateTimeToTimestamp,
  findHabitConfigForHabitLog,
  getEditablePrimary,
  getLogColor,
  getLogDetail,
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
import type { DraftItem, LogEntryProps, LogUpdateData } from "../types";
import { useAutoEditEntry } from "../useAutoEditEntry";

export function LogEntry({ log, habits, onDelete, onSave }: LogEntryProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [digestionExpanded, setDigestionExpanded] = useState(false);
  const isDigestion = log.type === "digestion";
  const [draftPrimary, setDraftPrimary] = useState(() => getEditablePrimary(log));
  const [draftNotes, setDraftNotes] = useState(() => getLogNotes(log));
  const [draftDate, setDraftDate] = useState(() => format(log.timestamp, "yyyy-MM-dd"));
  const [draftTimestamp, setDraftTimestamp] = useState(() => format(log.timestamp, "HH:mm"));
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  // Digestion draft fields
  const [draftBristol, setDraftBristol] = useState(0);
  const [draftEpisodes, setDraftEpisodes] = useState(1);
  const [draftUrgency, setDraftUrgency] = useState("");
  const [draftEffort, setDraftEffort] = useState("");
  const [draftVolume, setDraftVolume] = useState("");
  const [draftAccident, setDraftAccident] = useState(false);

  // For habit logs, resolve icon per-habit; otherwise use the generic icon
  const habitConfig = log.type === "habit" ? findHabitConfigForHabitLog(habits, log.data) : null;
  const { Icon, color } = habitConfig
    ? {
        Icon: getHabitIcon(habitConfig).Icon,
        color: getHabitIcon(habitConfig).toneClassName,
      }
    : { Icon: getLogIcon(log), color: getLogColor(log) };
  const title = getLogTitle(log, habits);
  const detail = getLogDetail(log);
  const digestionSelectedChipStyle = {
    backgroundColor: "color-mix(in srgb, var(--section-bowel) 20%, var(--color-bg-elevated) 80%)",
    border: "1px solid color-mix(in srgb, var(--section-bowel) 40%, transparent)",
    color: "color-mix(in srgb, var(--section-bowel) 88%, var(--color-text-primary) 12%)",
    boxShadow: "inset 0 1px 0 color-mix(in srgb, white 18%, transparent)",
  } as const;
  const digestionIdleChipStyle = {
    backgroundColor: "var(--color-bg-elevated)",
    border: "1px solid var(--color-border-default)",
    color: "var(--color-text-tertiary)",
  } as const;

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await onDelete(log.id);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to delete entry."));
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  useEffect(() => {
    if (!editing) {
      setDraftPrimary(getEditablePrimary(log));
      setDraftNotes(getLogNotes(log));
      setDraftDate(format(log.timestamp, "yyyy-MM-dd"));
      setDraftTimestamp(format(log.timestamp, "HH:mm"));
    }
  }, [editing, log]);

  const initFoodDraftItems = useCallback((): DraftItem[] => {
    if (log.type !== "food") return [];
    return log.data.items.map((item) => ({
      id: crypto.randomUUID(),
      name: String(item?.parsedName ?? item?.name ?? item?.rawName ?? item?.userSegment ?? ""),
      quantity:
        item?.quantity != null && Number.isFinite(Number(item.quantity))
          ? String(item.quantity)
          : "",
      unit: String(item?.unit ?? ""),
    }));
  }, [log]);

  const startEditing = useCallback(() => {
    setConfirmDelete(false);
    setDraftPrimary(getEditablePrimary(log));
    setDraftNotes(getLogNotes(log));
    setDraftDate(format(log.timestamp, "yyyy-MM-dd"));
    setDraftTimestamp(format(log.timestamp, "HH:mm"));
    if (log.type === "food") {
      setDraftItems(initFoodDraftItems());
    }
    if (log.type === "digestion") {
      setDraftBristol(log.data.bristolCode || 0);
      setDraftEpisodes(Number(log.data.episodesCount) || 1);
      setDraftUrgency(String(log.data.urgencyTag ?? ""));
      setDraftEffort(String(log.data.effortTag ?? ""));
      setDraftVolume(String(log.data.volumeTag ?? ""));
      setDraftAccident(Boolean(log.data.accident));
    }
    setEditing(true);
  }, [log, initFoodDraftItems]);

  // Auto-open edit mode when this entry's ID matches the toast "Edit" target
  useAutoEditEntry(log.id, startEditing);

  const cancelEditing = () => {
    setEditing(false);
    setDraftPrimary(getEditablePrimary(log));
    setDraftNotes(getLogNotes(log));
    setDraftDate(format(log.timestamp, "yyyy-MM-dd"));
    setDraftTimestamp(format(log.timestamp, "HH:mm"));
  };

  const saveEditing = async () => {
    const notes = draftNotes.trim();

    let nextData: LogUpdateData;
    if (log.type === "food") {
      const originalItems = Array.isArray(log.data?.items) ? log.data.items : [];
      const editedItems = draftItems
        .filter((d) => d.name.trim())
        .map((draft, i) => ({
          ...(originalItems[i] ?? {}),
          parsedName: draft.name.trim(),
          userSegment: [draft.quantity || null, draft.unit.trim() || null, draft.name.trim()]
            .filter(Boolean)
            .join(" "),
          resolvedBy: "user" as const,
          quantity: draft.quantity ? Number(draft.quantity) : null,
          unit: draft.unit.trim() || null,
        }));
      nextData = {
        ...log.data,
        items:
          editedItems.length > 0
            ? editedItems
            : [
                {
                  parsedName: "Food",
                  userSegment: "Food",
                  resolvedBy: "user" as const,
                  quantity: null,
                  unit: null,
                },
              ],
      } satisfies FoodLogData;
    } else if (log.type === "fluid") {
      const existingItems = log.data.items;
      const items = existingItems.map((item) => ({ ...item }));
      if (items.length > 0) {
        items[0] = {
          ...items[0],
          name: draftPrimary.trim() || "Fluid",
        };
      }
      nextData = {
        items,
      } satisfies FluidLogData;
    } else if (log.type === "digestion") {
      const bristolCode = (draftBristol || log.data?.bristolCode) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
      let consistencyTag: string | undefined;
      if (draftBristol === 7) consistencyTag = "watery";
      else if (draftBristol === 6) consistencyTag = "loose";
      else if (draftBristol === 5) consistencyTag = "soft";
      else if (draftBristol >= 3) consistencyTag = "normal";
      else if (draftBristol >= 1) consistencyTag = "hard";
      nextData = {
        bristolCode,
        episodesCount: draftEpisodes,
        accident: draftAccident,
        ...(draftUrgency && { urgencyTag: draftUrgency }),
        ...(draftEffort && { effortTag: draftEffort }),
        ...(draftVolume && { volumeTag: draftVolume }),
        ...(consistencyTag !== undefined && { consistencyTag }),
        ...(notes.length > 0 && { notes }),
        ...(log.data?.windowMinutes !== undefined && {
          windowMinutes: log.data.windowMinutes,
        }),
      } satisfies DigestiveLogData;
    } else {
      // habit, activity, weight — pass through unchanged
      nextData = { ...log.data };
    }

    // Compute new timestamp if date or time changed
    const newTimestamp = applyDateTimeToTimestamp(log.timestamp, draftDate, draftTimestamp);

    try {
      setSaving(true);
      await onSave(log.id, nextData, newTimestamp);
      setEditing(false);
      if (isDigestion) setDigestionExpanded(false);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to save. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  // ── Digestion: group-row layout with inline editing ────────────────────
  if (isDigestion) {
    const handleToggleExpand = () => {
      if (!digestionExpanded) {
        setDraftBristol(Number(log.data?.bristolCode) || 0);
        setDraftEpisodes(Number(log.data?.episodesCount) || 1);
        setDraftUrgency(String(log.data?.urgencyTag ?? ""));
        setDraftEffort(String(log.data?.effortTag ?? ""));
        setDraftVolume(String(log.data?.volumeTag ?? ""));
        setDraftAccident(Boolean(log.data?.accident));
        setDraftNotes(String(log.data?.notes ?? ""));
        setDraftDate(format(log.timestamp, "yyyy-MM-dd"));
        setDraftTimestamp(format(log.timestamp, "HH:mm"));
      }
      setDigestionExpanded((prev) => !prev);
    };

    // Pre-compute collapsed summary fields
    const bristolCode = Number(log.data?.bristolCode) || 0;
    const volumeTag = String(log.data?.volumeTag ?? "");
    const urgencyTag = String(log.data?.urgencyTag ?? "");
    const effortTag = String(log.data?.effortTag ?? "");
    const notesText = getLogNotes(log);

    // Build Line 2: "HH:mm . B4 . Volume: Small"
    const collapsedLine2Parts: string[] = [format(log.timestamp, "HH:mm")];
    if (bristolCode > 0) collapsedLine2Parts.push(`B${bristolCode}`);
    if (volumeTag) {
      collapsedLine2Parts.push(
        `Volume: ${BOWEL_LOG_LABELS.volume[volumeTag as keyof typeof BOWEL_LOG_LABELS.volume] ?? titleCase(volumeTag)}`,
      );
    }
    const collapsedLine2 = collapsedLine2Parts.join(" \u00B7 ");

    // Build Line 3: "Urgency: Low . Effort: Some"
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
          aria-expanded={digestionExpanded}
          aria-controls={`digestion-detail-${log.id}`}
          className="flex w-full items-start gap-3 px-3 py-2.5 text-left"
        >
          <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${color}`} />
          <div className="min-w-0 flex-1">
            {/* F1 Line 1: Title + Bristol badge */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                {title}
              </span>
              {!digestionExpanded && bristolCode > 0 && <BristolBadge code={bristolCode} />}
            </div>
            {!digestionExpanded && (
              <>
                {/* F1 Line 2: time . bristol code . volume */}
                <p className="mt-0.5 truncate font-mono text-xs text-[var(--color-text-tertiary)]">
                  {collapsedLine2}
                </p>
                {/* F1 Line 3: urgency . effort (only if present) */}
                {collapsedLine3 && (
                  <p className="mt-0.5 truncate font-mono text-xs text-[var(--color-text-tertiary)]">
                    {collapsedLine3}
                  </p>
                )}
                {/* F1 Line 4: note preview */}
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
            {log.data?.accident && (
              <span className="rounded-full bg-red-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-red-400">
                !
              </span>
            )}
            <motion.div
              animate={{ rotate: digestionExpanded ? 180 : 0 }}
              transition={logGroupChevronTransition}
              aria-hidden="true"
            >
              <ChevronDown className="h-4 w-4 text-[var(--color-text-tertiary)]" />
            </motion.div>
          </div>
        </button>

        <AnimatePresence>
          {digestionExpanded && (
            <motion.div
              id={`digestion-detail-${log.id}`}
              initial="collapsed"
              animate="expanded"
              exit="collapsed"
              variants={logGroupExpandVariants}
              transition={logGroupExpandTransition}
              className="overflow-hidden"
            >
              <fieldset className="ml-7 max-w-[46ch] space-y-2 border-none p-0 m-0 px-3 pb-3 pt-1">
                <legend className="sr-only">Edit bowel movement</legend>
                {/* F2: Date + Time */}
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
                    value={draftTimestamp}
                    onChange={(e) => setDraftTimestamp(e.target.value)}
                    className="w-28 rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] px-2 py-1 font-mono text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--section-log)]"
                  />
                </div>

                {/* F2: Bristol */}
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
                      style={
                        draftBristol === code ? digestionSelectedChipStyle : digestionIdleChipStyle
                      }
                    >
                      {code}
                    </button>
                  ))}
                </div>

                {/* F2: Episodes + Accident */}
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
                        : digestionIdleChipStyle
                    }
                  >
                    <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                    Accident
                  </button>
                </div>

                {/* F2: Urgency -- labeled */}
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
                      style={
                        draftUrgency === v ? digestionSelectedChipStyle : digestionIdleChipStyle
                      }
                    >
                      {BOWEL_LOG_LABELS.urgency[v]}
                    </button>
                  ))}
                </div>

                {/* F2: Effort -- labeled */}
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
                      style={
                        draftEffort === v ? digestionSelectedChipStyle : digestionIdleChipStyle
                      }
                    >
                      {BOWEL_LOG_LABELS.effort[v]}
                    </button>
                  ))}
                </div>

                {/* F2: Volume -- labeled */}
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
                      style={
                        draftVolume === v ? digestionSelectedChipStyle : digestionIdleChipStyle
                      }
                    >
                      {BOWEL_LOG_LABELS.volume[v]}
                    </button>
                  ))}
                </div>

                {/* F2: Notes -- constrained width, scrollable */}
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
                    onClick={() => void saveEditing()}
                    disabled={saving}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                    style={digestionSelectedChipStyle}
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

  const notesText = getLogNotes(log);

  return (
    <div className="log-entry flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-[var(--section-log-muted)]">
      <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${color}`} />

      <div className="min-w-0 flex-1 overflow-hidden">
        {editing ? (
          <div className="space-y-2">
            {/* Date + Time input -- all types */}
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

            {/* Food: per-item editing */}
            {log.type === "food" && (
              <div className="space-y-1.5">
                {draftItems.map((draft, i) => (
                  <div key={draft.id} className="flex items-center gap-1">
                    <input
                      type="number"
                      value={draft.quantity}
                      onChange={(e) => {
                        const next = [...draftItems];
                        next[i] = { ...draft, quantity: e.target.value };
                        setDraftItems(next);
                      }}
                      placeholder="qty"
                      className="w-14 rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] px-1.5 py-1 text-center text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--section-log)]"
                    />
                    <input
                      value={draft.unit}
                      maxLength={7}
                      onChange={(e) => {
                        const next = [...draftItems];
                        next[i] = { ...draft, unit: e.target.value };
                        setDraftItems(next);
                      }}
                      placeholder="unit"
                      className="w-12 rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] px-1.5 py-1 text-center text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--section-log)]"
                    />
                    <input
                      value={draft.name}
                      maxLength={60}
                      onChange={(e) => {
                        const next = [...draftItems];
                        next[i] = { ...draft, name: e.target.value };
                        setDraftItems(next);
                      }}
                      placeholder="Food name"
                      className="min-w-0 flex-1 rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] px-2 py-1 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--section-log)]"
                    />
                    {draftItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setDraftItems(draftItems.filter((d) => d.id !== draft.id))}
                        className="flex h-6 w-6 items-center justify-center rounded text-[var(--color-text-tertiary)] hover:text-red-400"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Fluid: name editing (single primary) */}
            {log.type === "fluid" && (
              <input
                value={draftPrimary}
                maxLength={40}
                onChange={(e) => setDraftPrimary(e.target.value)}
                className="w-full rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] px-2 py-1 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--section-log)]"
                placeholder="Fluid"
              />
            )}
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
              onClick={() => void saveEditing()}
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
