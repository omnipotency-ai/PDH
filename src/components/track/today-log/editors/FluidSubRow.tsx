import { format } from "date-fns";
import { useCallback, useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useUnitSystem } from "@/hooks/useProfile";
import { flOzToMl, formatFluidDisplay, getDisplayFluidUnit, mlToFlOz } from "@/lib/units";
import type { FluidLog } from "@/types/domain";
import { truncatePreviewText } from "../helpers";
import type { LogUpdateData } from "../types";
import { EditableEntryRow } from "./EditableEntryRow";

/** Convert an internal ml value to a display string for the draft input. */
function mlToDisplayString(ml: number, isImperial: boolean): string {
  if (!Number.isFinite(ml) || ml <= 0) return "";
  return isImperial ? String(mlToFlOz(ml)) : String(ml);
}

/** Convert a display draft string (in display units) back to ml. */
function displayStringToMl(value: string, isImperial: boolean): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return isImperial ? Math.round(flOzToMl(parsed)) : parsed;
}

export function FluidSubRow({ entry }: { key?: string | number; entry: FluidLog }) {
  const { unitSystem } = useUnitSystem();
  const isImperial = unitSystem !== "metric";
  const fluidUnit = getDisplayFluidUnit(unitSystem);

  const first = entry.data.items[0];
  const origName = String(first?.name ?? "").trim() || "Fluid";
  const origQty = Number(first?.quantity);

  const [draftName, setDraftName] = useState(origName);
  const [draftQty, setDraftQty] = useState(() => mlToDisplayString(origQty, isImperial));

  const onStartEditing = useCallback(() => {
    setDraftName(origName);
    setDraftQty(mlToDisplayString(origQty, isImperial));
  }, [origName, origQty, isImperial]);

  const onCancelEditing = useCallback(() => {
    setDraftName(origName);
    setDraftQty(mlToDisplayString(origQty, isImperial));
  }, [origName, origQty, isImperial]);

  const buildSaveData = useCallback((): LogUpdateData => {
    const quantityMl = displayStringToMl(draftQty, isImperial);
    return {
      ...entry.data,
      items: [
        {
          ...(first ?? {}),
          name: draftName.trim() || "Fluid",
          quantity: quantityMl,
          unit: "ml",
        },
      ],
    };
  }, [draftQty, isImperial, entry.data, first, draftName]);

  const renderEditFields = useCallback(
    () => (
      <div className="flex items-center gap-1">
        <input
          value={draftName}
          maxLength={40}
          onChange={(e) => setDraftName(e.target.value)}
          placeholder="Fluid"
          className="min-w-0 flex-1 rounded border border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] px-1.5 py-0.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--section-log)]"
        />
        <input
          type="number"
          value={draftQty}
          onChange={(e) => setDraftQty(e.target.value)}
          placeholder={fluidUnit}
          className="w-14 rounded border border-[var(--color-border-default)] bg-[var(--color-bg-overlay)] px-1 py-0.5 text-center text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--section-log)]"
        />
        <span className="text-xs text-[var(--color-text-tertiary)]">{fluidUnit}</span>
      </div>
    ),
    [draftName, draftQty, fluidUnit],
  );

  const displayQty =
    Number.isFinite(origQty) && origQty > 0 ? formatFluidDisplay(origQty, unitSystem) : "";
  const summaryText = `${format(entry.timestamp, "HH:mm")}  ${origName}  ${displayQty}`;

  const renderDisplay = useCallback(
    () => (
      <Tooltip>
        <TooltipTrigger
          render={<span className="truncate font-mono text-xs text-[var(--color-text-tertiary)]" />}
        >
          {truncatePreviewText(summaryText)}
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[56ch] text-sm leading-snug">
          {summaryText}
        </TooltipContent>
      </Tooltip>
    ),
    [summaryText],
  );

  return (
    <EditableEntryRow
      entryId={entry.id}
      timestamp={entry.timestamp}
      saveErrorMessage="Failed to save fluid entry."
      buildSaveData={buildSaveData}
      onStartEditing={onStartEditing}
      onCancelEditing={onCancelEditing}
      renderEditFields={renderEditFields}
      renderDisplay={renderDisplay}
      editLayout="stacked"
      displayPadding="compact"
    />
  );
}
