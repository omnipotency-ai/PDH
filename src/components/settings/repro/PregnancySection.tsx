import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  calculateGestationalAgeFromDueDate,
  PREGNANCY_STATUS_OPTIONS,
} from "@/lib/reproductiveHealth";
import { cn } from "@/lib/utils";

import { DatePickerButton } from "./DatePickerButton";
import type { ReproSectionProps } from "./types";

export function PregnancySection({
  reproductiveHealth,
  updateReproductiveHealth,
}: ReproSectionProps) {
  const dueDateGestation = reproductiveHealth.dueDate
    ? calculateGestationalAgeFromDueDate(reproductiveHealth.dueDate)
    : null;
  const pregnancyWeeks = dueDateGestation?.week ?? null;
  const trimesterLabel =
    pregnancyWeeks == null
      ? "Not set"
      : pregnancyWeeks < 14
        ? "1st trimester"
        : pregnancyWeeks < 28
          ? "2nd trimester"
          : "3rd trimester";
  const trimesterSourceHint = dueDateGestation
    ? "Calculated from due date"
    : "Set due date to calculate";

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--section-repro)]">
        Pregnancy Status
      </p>
      <p className="text-[11px] text-[var(--text-muted)]">
        Helps tailor hydration and digestion guidance across not-pregnant, pregnant, and postpartum
        phases.
      </p>

      <fieldset className="grid gap-2 sm:grid-cols-3">
        {PREGNANCY_STATUS_OPTIONS.map((option) => {
          const selected = reproductiveHealth.pregnancyStatus === option.value;
          return (
            <label
              key={option.value}
              className={cn(
                "inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs transition-colors",
                selected
                  ? "border-[var(--section-repro)] bg-[var(--section-repro-muted)]"
                  : "border-[var(--border)] bg-[var(--surface-1)] text-[var(--text-faint)] opacity-70",
              )}
            >
              <input
                type="radio"
                name="pregnancy-status"
                value={option.value}
                checked={selected}
                onChange={() =>
                  updateReproductiveHealth({
                    pregnancyStatus: option.value,
                  })
                }
                className="h-3.5 w-3.5 accent-[var(--section-repro)]"
              />
              <span className={cn(selected ? "text-[var(--text)]" : "")}>{option.label}</span>
            </label>
          );
        })}
      </fieldset>

      {reproductiveHealth.pregnancyStatus === "not_pregnant" && (
        <div className="space-y-2 rounded-xl border border-[var(--section-repro-border)] bg-[var(--surface-1)] p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-0.5">
              <Label htmlFor="oral-contraceptive-switch" className="text-xs text-[var(--text)]">
                Using oral contraceptives
              </Label>
              <p className="text-[11px] text-[var(--text-muted)]">
                Include only if this affects digestion, appetite, nausea, or bowel pattern.
              </p>
            </div>
            <Switch
              id="oral-contraceptive-switch"
              size="sm"
              checked={reproductiveHealth.oralContraceptive}
              onCheckedChange={(checked) =>
                updateReproductiveHealth({ oralContraceptive: checked })
              }
              className="data-[checked]:bg-pink-400 data-[unchecked]:bg-muted-foreground/25 dark:data-[checked]:bg-pink-400"
            />
          </div>
          {reproductiveHealth.oralContraceptive && (
            <div className="space-y-1">
              <Label className="text-[10px] text-[var(--text-faint)]">
                Contraceptive notes (digestion-relevant)
              </Label>
              <Input
                value={reproductiveHealth.contraceptiveNotes}
                maxLength={500}
                onChange={(e) =>
                  updateReproductiveHealth({
                    contraceptiveNotes: e.target.value,
                  })
                }
                placeholder="e.g. nausea, appetite change, constipation, loose stools"
                className="h-9"
              />
            </div>
          )}
        </div>
      )}

      {reproductiveHealth.pregnancyStatus === "pregnant" && (
        <div className="space-y-2 rounded-xl border border-[var(--section-repro-border)] bg-[var(--surface-1)] p-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-[10px] text-[var(--text-faint)]">Due date</Label>
              <DatePickerButton
                value={reproductiveHealth.dueDate}
                placeholder="dd/mm/yyyy"
                onChange={(value) => updateReproductiveHealth({ dueDate: value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-[var(--text-faint)]">Weeks pregnant</Label>
              <div className="flex h-9 items-center rounded-xl border border-[var(--section-repro-border)] bg-[var(--surface-0)] px-3 text-xs text-[var(--text-muted)]">
                {pregnancyWeeks == null ? "Not set" : `${pregnancyWeeks} weeks`}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-[var(--text-faint)]">Trimester</Label>
              <div className="flex h-9 items-center justify-between rounded-xl border border-[var(--section-repro-border)] bg-[var(--surface-0)] px-3 text-xs text-[var(--text-muted)]">
                <span>{trimesterLabel}</span>
                <span className="text-[10px] text-[var(--text-faint)]">{trimesterSourceHint}</span>
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-[var(--text-faint)]">
              Pregnancy medications affecting digestion
            </Label>
            <Input
              value={reproductiveHealth.pregnancyMedicationNotes}
              maxLength={500}
              onChange={(e) =>
                updateReproductiveHealth({
                  pregnancyMedicationNotes: e.target.value,
                })
              }
              placeholder="e.g. anti-nausea meds, iron supplements, stool softeners"
              className="h-9"
            />
          </div>
        </div>
      )}

      {reproductiveHealth.pregnancyStatus === "postpartum" && (
        <div className="space-y-2 rounded-xl border border-[var(--section-repro-border)] bg-[var(--surface-1)] p-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="space-y-1">
              <Label className="text-[10px] text-[var(--text-faint)]">Postpartum since</Label>
              <DatePickerButton
                value={reproductiveHealth.postpartumSinceDate}
                placeholder="dd/mm/yyyy"
                onChange={(value) => updateReproductiveHealth({ postpartumSinceDate: value })}
              />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-xl border border-[var(--section-repro-border)] px-3 py-2">
              <Label htmlFor="breastfeeding-switch" className="text-xs text-[var(--text)]">
                Breastfeeding
              </Label>
              <Switch
                id="breastfeeding-switch"
                size="sm"
                checked={reproductiveHealth.breastfeeding}
                onCheckedChange={(checked) => updateReproductiveHealth({ breastfeeding: checked })}
                className="data-[checked]:bg-pink-400 data-[unchecked]:bg-muted-foreground/25 dark:data-[checked]:bg-pink-400"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-[var(--text-faint)]">
              Postpartum medications affecting digestion
            </Label>
            {/* TODO: Uses pregnancyMedicationNotes for postpartum too — add a dedicated
                postpartumMedicationNotes field to the schema when the repro model is extended. */}
            <Input
              value={reproductiveHealth.pregnancyMedicationNotes}
              maxLength={500}
              onChange={(e) =>
                updateReproductiveHealth({
                  pregnancyMedicationNotes: e.target.value,
                })
              }
              placeholder="e.g. pain relief, iron, lactation-related meds"
              className="h-9"
            />
          </div>
        </div>
      )}
    </div>
  );
}
