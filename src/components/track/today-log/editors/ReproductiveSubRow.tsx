import { format } from "date-fns";
import { useCallback, useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  REPRODUCTIVE_BLEEDING_OPTIONS,
  REPRODUCTIVE_SYMPTOM_OPTIONS,
} from "@/lib/reproductiveHealth";
import type {
  ReproductiveBleedingStatus,
  ReproductiveLog,
  ReproductiveLogData,
  ReproductiveSymptom,
} from "@/types/domain";
import {
  getReproductiveBleedingLabel,
  getReproductiveDaysSincePeriodStart,
  getReproductiveStatTooltip,
  titleCaseToken,
} from "../helpers";
import type { LogUpdateData } from "../types";
import { EditableEntryRow } from "./EditableEntryRow";

export function ReproductiveSubRow({ entry }: { key?: string | number; entry: ReproductiveLog }) {
  const entryBleedingStatus = entry.data.bleedingStatus;
  const entryPeriodStartDate = entry.data.periodStartDate;
  const entrySymptoms = (entry.data.symptoms ?? []).map(titleCaseToken);
  const entryNotes = String(entry.data.notes ?? "").trim();

  const [draftPeriodStartDate, setDraftPeriodStartDate] = useState(entryPeriodStartDate);
  const [draftBleedingStatus, setDraftBleedingStatus] =
    useState<ReproductiveBleedingStatus>(entryBleedingStatus);
  const [draftSymptoms, setDraftSymptoms] = useState<ReproductiveSymptom[]>(
    () => entry.data.symptoms ?? [],
  );
  const [draftNotes, setDraftNotes] = useState(entryNotes);

  const resetDraft = useCallback(() => {
    setDraftPeriodStartDate(entry.data.periodStartDate);
    setDraftBleedingStatus(entry.data.bleedingStatus);
    setDraftSymptoms(entry.data.symptoms ?? []);
    setDraftNotes(String(entry.data.notes ?? "").trim());
  }, [
    entry.data.periodStartDate,
    entry.data.bleedingStatus,
    entry.data.symptoms,
    entry.data.notes,
  ]);

  const buildSaveData = useCallback((): LogUpdateData => {
    const trimmedNotes = draftNotes.trim();
    const nextData: ReproductiveLogData = {
      entryType: "cycle",
      periodStartDate: draftPeriodStartDate,
      bleedingStatus: draftBleedingStatus,
      ...(draftSymptoms.length > 0 && { symptoms: draftSymptoms }),
      ...(trimmedNotes.length > 0 && { notes: trimmedNotes }),
    };
    return nextData;
  }, [draftNotes, draftPeriodStartDate, draftBleedingStatus, draftSymptoms]);

  const renderEditFields = useCallback(
    () => (
      <>
        <label className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">
            Period start
          </span>
          <input
            type="date"
            value={draftPeriodStartDate}
            onChange={(e) => setDraftPeriodStartDate(e.target.value)}
            className="rounded border border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] px-1.5 py-0.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--section-log)]"
          />
        </label>

        <div className="flex flex-wrap items-center gap-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">
            Bleeding
          </span>
          {REPRODUCTIVE_BLEEDING_OPTIONS.map((option) => {
            const active = draftBleedingStatus === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setDraftBleedingStatus(option.value)}
                className={`rounded-md px-2 py-1 text-[10px] transition-colors ${
                  active
                    ? "bg-[var(--section-log)] text-white"
                    : "border border-[var(--color-border-default)] text-[var(--color-text-tertiary)] hover:bg-[var(--section-log-muted)]"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-1">
          {REPRODUCTIVE_SYMPTOM_OPTIONS.map((option) => {
            const selected = draftSymptoms.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() =>
                  setDraftSymptoms((current) =>
                    current.includes(option.value)
                      ? current.filter((value) => value !== option.value)
                      : [...current, option.value],
                  )
                }
                className={`rounded-md px-2 py-0.5 text-[10px] transition-colors ${
                  selected
                    ? "bg-[var(--section-log)]/15 text-[var(--section-log)] ring-1 ring-[var(--section-log)]/40"
                    : "border border-[var(--color-border-default)] text-[var(--color-text-tertiary)] hover:bg-[var(--section-log-muted)]"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">
              Notes
            </span>
            <span className="text-[10px] text-[var(--color-text-tertiary)]">
              {draftNotes.length}/400
            </span>
          </div>
          <textarea
            value={draftNotes}
            maxLength={400}
            onChange={(e) => setDraftNotes(e.target.value)}
            rows={2}
            placeholder="Add notes"
            className="w-full resize-none rounded border border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] px-1.5 py-1 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--section-log)]"
          />
        </div>
      </>
    ),
    [draftPeriodStartDate, draftBleedingStatus, draftSymptoms, draftNotes],
  );

  const daysStat = getReproductiveDaysSincePeriodStart(entry);
  const statTooltip = getReproductiveStatTooltip(entry);
  const symptomsText = entrySymptoms.length > 0 ? entrySymptoms.join(", ") : "None";

  const renderDisplay = useCallback(
    () => (
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-[var(--color-text-tertiary)]">
            {format(entry.timestamp, "HH:mm")}
          </span>
          <span className="rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-text-secondary)]">
            {getReproductiveBleedingLabel(entry.data?.bleedingStatus)}
          </span>
          {daysStat !== null && statTooltip && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <span className="rounded-full border border-[var(--color-border-default)] px-2 py-0.5 font-mono text-[10px] font-semibold text-[var(--section-summary)]" />
                }
              >
                {daysStat}d
              </TooltipTrigger>
              <TooltipContent>{statTooltip}</TooltipContent>
            </Tooltip>
          )}
        </div>

        <div className="text-xs text-[var(--color-text-secondary)]">
          <span className="text-[var(--color-text-tertiary)]">Period start: </span>
          <span className="font-mono">{entryPeriodStartDate || "Not set"}</span>
        </div>

        <div className="text-xs text-[var(--color-text-secondary)]">
          <span className="text-[var(--color-text-tertiary)]">Symptoms: </span>
          <Tooltip>
            <TooltipTrigger
              render={
                <span
                  className="inline-block align-top"
                  style={{
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    maxWidth: "26ch",
                  }}
                />
              }
            >
              {symptomsText}
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[56ch] text-sm leading-snug">
              {symptomsText}
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="text-xs text-[var(--color-text-secondary)]">
          <span className="text-[var(--color-text-tertiary)]">Notes: </span>
          {entryNotes ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <span
                    className="inline-block align-top italic"
                    style={{
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      maxWidth: "26ch",
                    }}
                  />
                }
              >
                {entryNotes}
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[56ch] text-sm leading-snug">
                {entryNotes}
              </TooltipContent>
            </Tooltip>
          ) : (
            <span className="text-[var(--color-text-tertiary)]">None</span>
          )}
        </div>
      </div>
    ),
    [
      entry.timestamp,
      entry.data?.bleedingStatus,
      daysStat,
      statTooltip,
      entryPeriodStartDate,
      symptomsText,
      entryNotes,
    ],
  );

  return (
    <EditableEntryRow
      entryId={entry.id}
      timestamp={entry.timestamp}
      saveErrorMessage="Failed to save entry."
      buildSaveData={buildSaveData}
      onStartEditing={resetDraft}
      onCancelEditing={resetDraft}
      renderEditFields={renderEditFields}
      renderDisplay={renderDisplay}
      editLayout="stacked-2"
      displayPadding="spacious"
    />
  );
}
