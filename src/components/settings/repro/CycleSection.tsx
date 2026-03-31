import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { ReproductiveCyclePhase } from "@/types/domain";
import { DatePickerButton } from "./DatePickerButton";
import type { ReproSectionProps } from "./types";

function isValidCyclePhase(v: string): v is ReproductiveCyclePhase {
  return (
    v === "unknown" ||
    v === "menstrual" ||
    v === "follicular" ||
    v === "ovulatory" ||
    v === "luteal"
  );
}

export function CycleSection({ reproductiveHealth, updateReproductiveHealth }: ReproSectionProps) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--section-repro)]">
        Cycle
      </p>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <Label htmlFor="cycle-tracking-switch" className="text-sm font-medium text-[var(--text)]">
            Track menstrual cycle
          </Label>
          <p className="text-[11px] text-[var(--text-muted)]">
            Used to correlate gut symptoms with hormonal phase and cycle timing.
          </p>
        </div>
        <Switch
          id="cycle-tracking-switch"
          size="sm"
          checked={reproductiveHealth.cycleTrackingEnabled}
          onCheckedChange={(checked) =>
            updateReproductiveHealth({
              cycleTrackingEnabled: checked,
            })
          }
          className="data-[checked]:bg-pink-400 data-[unchecked]:bg-muted-foreground/25 dark:data-[checked]:bg-pink-400"
        />
      </div>

      {reproductiveHealth.cycleTrackingEnabled && (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-[10px] text-[var(--text-faint)]">Last period start date</Label>
              <DatePickerButton
                value={reproductiveHealth.lastPeriodStartDate}
                placeholder="dd/mm/yyyy"
                onChange={(value) => updateReproductiveHealth({ lastPeriodStartDate: value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-[var(--text-faint)]">Current phase</Label>
              <select
                className="h-9 w-full rounded-xl border border-[var(--section-repro-border)] bg-[var(--surface-0)] px-3 text-sm text-[var(--text)]"
                value={reproductiveHealth.currentCyclePhase ?? "unknown"}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!isValidCyclePhase(val)) return;
                  updateReproductiveHealth({ currentCyclePhase: val });
                }}
                title="Current cycle phase"
              >
                <option value="unknown">Unknown / unsure</option>
                <option value="menstrual">Menstrual</option>
                <option value="follicular">Follicular</option>
                <option value="ovulatory">Ovulatory</option>
                <option value="luteal">Luteal</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-[var(--text-faint)]">
                Typical cycle length (days)
              </Label>
              <Input
                type="number"
                min={15}
                max={60}
                value={reproductiveHealth.averageCycleLengthDays ?? ""}
                onChange={(e) =>
                  updateReproductiveHealth({
                    averageCycleLengthDays: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="h-9"
                placeholder="e.g. 28"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-[var(--text-faint)]">
                Typical period length (days)
              </Label>
              <Input
                type="number"
                min={1}
                max={14}
                value={reproductiveHealth.averagePeriodLengthDays ?? ""}
                onChange={(e) =>
                  updateReproductiveHealth({
                    averagePeriodLengthDays: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="h-9"
                placeholder="e.g. 5"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-[var(--text-faint)]">
                Symptoms usually start before period (days)
              </Label>
              <Input
                type="number"
                min={0}
                max={14}
                value={reproductiveHealth.symptomsBeforePeriodDays ?? ""}
                onChange={(e) =>
                  updateReproductiveHealth({
                    symptomsBeforePeriodDays: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="h-9"
                placeholder="e.g. 2"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-[var(--text-faint)]">
                Symptoms usually settle after period starts (days)
              </Label>
              <Input
                type="number"
                min={0}
                max={14}
                value={reproductiveHealth.symptomsAfterPeriodDays ?? ""}
                onChange={(e) =>
                  updateReproductiveHealth({
                    symptomsAfterPeriodDays: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="h-9"
                placeholder="e.g. 1"
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] text-[var(--text-faint)]">
                Cycle-related gut symptom severity
              </Label>
              <span className="text-[10px] text-[var(--text-muted)]">
                {reproductiveHealth.cycleSymptomSeverity ?? 0}/10
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={reproductiveHealth.cycleSymptomSeverity ?? 0}
              onChange={(e) =>
                updateReproductiveHealth({
                  cycleSymptomSeverity: Number(e.target.value),
                })
              }
              className="h-2 w-full cursor-pointer accent-pink-400"
              aria-label="Cycle symptom severity"
            />
          </div>
        </div>
      )}
    </div>
  );
}
