import { Label } from "@/components/ui/label";
import type { HealthSectionProps } from "./types";

export function ClinicalHistorySection({ healthProfile, setHealthProfile }: HealthSectionProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--section-health)]">
          Clinical History
        </p>
        <p className="text-[10px] text-[var(--text-faint)]">
          Free-text surgical, wound-healing, smoking, substance, and recovery context for Dr. Poo.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="clinical-history" className="text-[10px] text-[var(--text-faint)]">
          History
        </Label>
        <textarea
          id="clinical-history"
          value={healthProfile.clinicalHistory}
          onChange={(event) => setHealthProfile({ clinicalHistory: event.target.value })}
          rows={12}
          className="min-h-[16rem] w-full rounded-xl border border-[var(--section-health-border)] bg-[var(--surface-0)] px-3 py-2 text-sm text-[var(--text)] outline-none transition focus:border-[var(--section-health)] focus:ring-2 focus:ring-[var(--section-health)]/20"
          placeholder="Add surgeries, complications, wound healing, smoking, substance use, and anything else Dr. Poo should keep in mind."
        />
      </div>
    </div>
  );
}
