import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { MENOPAUSE_STATUS_OPTIONS } from "@/lib/reproductiveHealth";

import type { ReproSectionProps } from "./types";

export function MenopauseSection({
  reproductiveHealth,
  updateReproductiveHealth,
}: ReproSectionProps) {
  const isMenopauseApplicable =
    reproductiveHealth.menopauseStatus === "perimenopause" ||
    reproductiveHealth.menopauseStatus === "menopause";

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--section-repro)]">
        Menopause
      </p>
      <p className="text-[11px] text-[var(--text-muted)]">
        Menopause stage can change motility, sleep, and symptom patterns that affect food tolerance.
      </p>
      <div className="space-y-1">
        <Label className="text-[10px] text-[var(--text-faint)]">Menopause status</Label>
        <select
          className="h-9 w-full rounded-xl border border-[var(--section-repro-border)] bg-[var(--surface-0)] px-3 text-sm text-[var(--text)]"
          value={reproductiveHealth.menopauseStatus}
          onChange={(e) => {
            const val = e.target.value;
            const match = MENOPAUSE_STATUS_OPTIONS.find((o) => o.value === val);
            if (!match) return;
            updateReproductiveHealth({ menopauseStatus: match.value });
          }}
          title="Menopause status"
        >
          {MENOPAUSE_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      {isMenopauseApplicable && (
        <div className="space-y-2 rounded-xl border border-[var(--section-repro-border)] bg-[var(--surface-1)] p-3">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="menopause-hrt-switch" className="text-xs text-[var(--text)]">
              Using HRT
            </Label>
            <Switch
              id="menopause-hrt-switch"
              size="sm"
              checked={reproductiveHealth.menopauseHrt}
              onCheckedChange={(checked) => updateReproductiveHealth({ menopauseHrt: checked })}
              className="data-[checked]:bg-pink-400 data-[unchecked]:bg-muted-foreground/25 dark:data-[checked]:bg-pink-400"
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="menopause-thyroid-switch" className="text-xs text-[var(--text)]">
              Thyroid issues
            </Label>
            <Switch
              id="menopause-thyroid-switch"
              size="sm"
              checked={reproductiveHealth.menopauseThyroidIssues}
              onCheckedChange={(checked) =>
                updateReproductiveHealth({ menopauseThyroidIssues: checked })
              }
              className="data-[checked]:bg-pink-400 data-[unchecked]:bg-muted-foreground/25 dark:data-[checked]:bg-pink-400"
            />
          </div>
          {(reproductiveHealth.menopauseHrt || reproductiveHealth.menopauseThyroidIssues) && (
            <div className="space-y-1">
              <Label className="text-[10px] text-[var(--text-faint)]">Menopause notes</Label>
              <Input
                value={reproductiveHealth.menopauseHrtNotes}
                maxLength={500}
                onChange={(e) =>
                  updateReproductiveHealth({
                    menopauseHrtNotes: e.target.value,
                  })
                }
                placeholder="e.g. HRT type or thyroid treatment relevant to digestion"
                className="h-9"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
