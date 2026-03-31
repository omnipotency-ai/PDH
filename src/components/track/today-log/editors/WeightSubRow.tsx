import { format } from "date-fns";
import { useCallback, useState } from "react";
import { useUnitSystem } from "@/hooks/useProfile";
import { kgToLbs, kgToStones, lbsToKg, stonesToKg } from "@/lib/formatWeight";
import { getDisplayWeightUnit } from "@/lib/units";
import type { WeightLog, WeightLogData } from "@/types/domain";
import type { LogUpdateData } from "../types";
import { EditableEntryRow } from "./EditableEntryRow";

function kgToDisplayString(kg: number, weightUnit: string): string {
  if (!Number.isFinite(kg) || kg <= 0) return "";
  if (weightUnit === "lbs") return String(Math.round(kgToLbs(kg) * 10) / 10);
  if (weightUnit === "stones") return String(Math.round(kgToStones(kg) * 10) / 10);
  return String(kg);
}

export function WeightSubRow({ entry }: { key?: string | number; entry: WeightLog }) {
  const { unitSystem } = useUnitSystem();
  const weightUnit = getDisplayWeightUnit(unitSystem);
  const kg = entry.data.weightKg;

  const [draftWeight, setDraftWeight] = useState(() => kgToDisplayString(kg, weightUnit));

  const onStartEditing = useCallback(() => {
    setDraftWeight(kgToDisplayString(entry.data.weightKg, weightUnit));
  }, [entry.data.weightKg, weightUnit]);

  const buildSaveData = useCallback((): LogUpdateData => {
    const rawVal = Number(draftWeight);
    const weightKg =
      Number.isFinite(rawVal) && rawVal > 0
        ? weightUnit === "lbs"
          ? Math.round(lbsToKg(rawVal) * 10) / 10
          : weightUnit === "stones"
            ? Math.round(stonesToKg(rawVal) * 10) / 10
            : rawVal
        : entry.data.weightKg;
    const nextData: WeightLogData = { weightKg };
    return nextData;
  }, [draftWeight, weightUnit, entry.data.weightKg]);

  const draftIsValid = (() => {
    const rawVal = Number(draftWeight);
    return draftWeight.trim().length > 0 && Number.isFinite(rawVal) && rawVal > 0;
  })();

  const renderEditFields = useCallback(
    () => (
      <>
        <input
          type="number"
          value={draftWeight}
          onChange={(e) => setDraftWeight(e.target.value)}
          step="0.1"
          placeholder={weightUnit}
          aria-invalid={!draftIsValid}
          className={`w-16 rounded border bg-[var(--color-bg-overlay)] px-1 py-0.5 text-center text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--section-log)] ${
            draftIsValid ? "border-[var(--color-border-default)]" : "border-red-400"
          }`}
        />
        <span className="text-xs text-[var(--color-text-tertiary)]">{weightUnit}</span>
        {!draftIsValid && <span className="text-[10px] text-red-400">Enter a valid weight</span>}
      </>
    ),
    [draftWeight, weightUnit, draftIsValid],
  );

  const displayVal =
    Number.isFinite(kg) && kg > 0
      ? weightUnit === "lbs"
        ? `${kgToLbs(kg).toFixed(1)} lbs`
        : weightUnit === "stones"
          ? `${kgToStones(kg).toFixed(1)} st`
          : `${kg.toFixed(1)} kg`
      : "";

  const renderDisplay = useCallback(
    () => (
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-[var(--color-text-tertiary)]">
          {format(entry.timestamp, "HH:mm")}
        </span>
        <span className="text-xs text-[var(--color-text-secondary)]">{displayVal}</span>
      </div>
    ),
    [entry.timestamp, displayVal],
  );

  return (
    <EditableEntryRow
      entryId={entry.id}
      timestamp={entry.timestamp}
      saveErrorMessage="Failed to save weight."
      buildSaveData={buildSaveData}
      onStartEditing={onStartEditing}
      renderEditFields={renderEditFields}
      renderDisplay={renderDisplay}
      editLayout="inline"
      displayPadding="compact"
    />
  );
}
