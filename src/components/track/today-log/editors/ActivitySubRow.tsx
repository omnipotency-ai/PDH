import { format } from "date-fns";
import { useCallback, useEffect, useState } from "react";
import type { SyncedLog } from "@/lib/sync";
import type { ActivityLogData } from "@/types/domain";
import { formatDuration, getActivityEntryDurationMinutes, getActivityLabel } from "../helpers";
import type { LogUpdateData } from "../types";
import { EditableEntryRow } from "./EditableEntryRow";

function durationToDisplayString(dur: number, isSleep: boolean): string {
  if (!Number.isFinite(dur) || dur <= 0) return "";
  return isSleep ? String(Math.round((dur / 60) * 10) / 10) : String(dur);
}

export function ActivitySubRow({
  entry,
  activityType,
  showLabel,
}: {
  entry: SyncedLog;
  activityType: string;
  showLabel?: boolean;
}) {
  const resolvedDuration = getActivityEntryDurationMinutes(entry);
  const dur = resolvedDuration ?? NaN;
  const isSleep = activityType === "sleep";

  const [draftDuration, setDraftDuration] = useState(() => durationToDisplayString(dur, isSleep));

  // Re-seed draft when entry changes (e.g. Convex sync updates the entry)
  useEffect(() => {
    setDraftDuration(durationToDisplayString(dur, isSleep));
  }, [dur, isSleep]);

  const buildSaveData = useCallback((): LogUpdateData => {
    const nextData: ActivityLogData = {
      activityType,
      durationMinutes:
        activityType === "sleep" ? Math.round(Number(draftDuration) * 60) : Number(draftDuration),
    };
    return nextData;
  }, [activityType, draftDuration]);

  const renderEditFields = useCallback(
    () => (
      <>
        <input
          type="number"
          value={draftDuration}
          onChange={(e) => setDraftDuration(e.target.value)}
          placeholder={activityType === "sleep" ? "hrs" : "mins"}
          step={activityType === "sleep" ? "0.5" : "1"}
          className="w-14 rounded border border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] px-1 py-0.5 text-center text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--section-log)]"
        />
        <span className="text-xs text-[var(--color-text-tertiary)]">
          {activityType === "sleep" ? "hrs" : "min"}
        </span>
      </>
    ),
    [draftDuration, activityType],
  );

  const renderDisplay = useCallback(
    () => (
      <span className="font-mono text-xs text-[var(--color-text-tertiary)]">
        <span className="whitespace-nowrap">{format(entry.timestamp, "HH:mm")}</span>
        {(showLabel || (Number.isFinite(dur) && dur > 0)) && (
          <span className="ml-2 inline-flex items-center gap-1 whitespace-nowrap">
            {showLabel && <span>{getActivityLabel(activityType)}</span>}
            {showLabel && Number.isFinite(dur) && dur > 0 && <span aria-hidden="true">·</span>}
            {Number.isFinite(dur) && dur > 0 && <span>{formatDuration(dur, activityType)}</span>}
          </span>
        )}
      </span>
    ),
    [entry.timestamp, showLabel, activityType, dur],
  );

  return (
    <EditableEntryRow
      entryId={entry.id}
      timestamp={entry.timestamp}
      saveErrorMessage="Failed to save activity."
      buildSaveData={buildSaveData}
      renderEditFields={renderEditFields}
      renderDisplay={renderDisplay}
      editLayout="inline"
      displayPadding="compact"
    />
  );
}
