import { Input } from "@/components/ui/input";
import type { HealthSectionProps } from "./types";

export function DietarySection({
  healthProfile,
  setHealthProfile,
}: Omit<HealthSectionProps, "unitSystem">) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--section-health)]">
        Dietary History
      </p>
      <p className="text-[10px] text-[var(--text-faint)]">
        Share appetite changes, fluid intake habits, and any output consistency patterns you have
        noticed.
      </p>
      <Input
        value={healthProfile.dietaryHistory ?? ""}
        maxLength={800}
        onChange={(e) => setHealthProfile({ dietaryHistory: e.target.value })}
        placeholder="e.g. Lower appetite, avoiding fruit skins, drinking less water, high morning output"
        className="h-9"
      />
    </div>
  );
}
