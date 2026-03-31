import { CollapsibleSection } from "@/components/settings/CollapsibleSectionHeader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { HealthSectionProps } from "./types";

export function MedicationsSection({
  healthProfile,
  setHealthProfile,
}: Omit<HealthSectionProps, "unitSystem">) {
  return (
    <CollapsibleSection
      title="Medications, Supplements, Allergies & Intolerances"
      description="Include medicines, vitamins/minerals, and food or medication intolerances that affect digestion, hydration, and tolerance."
    >
      <div className="space-y-2.5">
        <div className="space-y-1">
          <Label className="text-[10px] text-[var(--text-faint)]">Medications</Label>
          <Input
            value={healthProfile.medications ?? ""}
            maxLength={1200}
            onChange={(e) => setHealthProfile({ medications: e.target.value })}
            placeholder="e.g. Imodium 2mg, Omeprazole 20mg"
            className="h-9"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-[var(--text-faint)]">Supplements</Label>
          <Input
            value={healthProfile.supplements ?? ""}
            maxLength={600}
            onChange={(e) => setHealthProfile({ supplements: e.target.value })}
            placeholder="e.g. B12, iron, electrolytes"
            className="h-9"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-[var(--text-faint)]">Allergies</Label>
          <Input
            value={healthProfile.allergies ?? ""}
            maxLength={500}
            onChange={(e) => setHealthProfile({ allergies: e.target.value })}
            placeholder="e.g. Penicillin, shellfish"
            className="h-9"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-[var(--text-faint)]">Intolerances</Label>
          <Input
            value={healthProfile.intolerances ?? ""}
            maxLength={500}
            onChange={(e) => setHealthProfile({ intolerances: e.target.value })}
            placeholder="e.g. Lactose, high-fiber skins, spicy foods"
            className="h-9"
          />
        </div>
      </div>
    </CollapsibleSection>
  );
}
