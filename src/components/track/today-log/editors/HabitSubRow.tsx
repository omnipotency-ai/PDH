import { format } from "date-fns";
import { useCallback } from "react";
import type { SyncedLog } from "@/lib/sync";
import type { LogUpdateData } from "../types";
import { EditableEntryRow } from "./EditableEntryRow";

export function HabitSubRow({ entry }: { key?: string | number; entry: SyncedLog }) {
  const buildSaveData = useCallback((): LogUpdateData => ({ ...entry.data }), [entry.data]);

  const habitName = entry.type === "habit" ? String(entry.data?.name ?? "Habit") : "Habit";

  const renderEditFields = useCallback(
    () => <span className="text-xs text-[var(--color-text-secondary)]">{habitName}</span>,
    [habitName],
  );

  const renderDisplay = useCallback(
    () => (
      <span className="font-mono text-xs text-[var(--color-text-tertiary)]">
        {format(entry.timestamp, "HH:mm")}
      </span>
    ),
    [entry.timestamp],
  );

  return (
    <EditableEntryRow
      entryId={entry.id}
      timestamp={entry.timestamp}
      saveErrorMessage="Failed to save habit."
      buildSaveData={buildSaveData}
      renderEditFields={renderEditFields}
      renderDisplay={renderDisplay}
      editLayout="inline"
      displayPadding="compact"
    />
  );
}
