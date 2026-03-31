import { CollapsibleSection } from "@/components/settings/CollapsibleSectionHeader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HEALTH_COMORBIDITY_OPTIONS, HEALTH_GI_CONDITION_OPTIONS } from "@/types/domain";
import { ChipGroup } from "./ChipGroup";
import type { HealthSectionProps } from "./types";

export function ConditionsSection({
  healthProfile,
  setHealthProfile,
}: Omit<HealthSectionProps, "unitSystem">) {
  const toggleCondition = (condition: string) => {
    const current = healthProfile.comorbidities ?? [];
    const next = current.includes(condition)
      ? current.filter((c) => c !== condition)
      : [...current, condition];
    setHealthProfile({ comorbidities: next });
  };

  return (
    <CollapsibleSection
      title="Digestive Conditions & Comorbidities"
      description="Add GI and related medical conditions (for example diabetes, thyroid, kidney, heart) that may change hydration, motility, or food tolerance."
    >
      <div className="space-y-2">
        <ChipGroup
          label="GI medical conditions"
          options={HEALTH_GI_CONDITION_OPTIONS}
          selectedValues={healthProfile.comorbidities}
          onToggle={toggleCondition}
        />
        <ChipGroup
          label="Comorbidities affecting digestion"
          options={HEALTH_COMORBIDITY_OPTIONS}
          selectedValues={healthProfile.comorbidities}
          onToggle={toggleCondition}
        />
      </div>
      <div className="flex items-center gap-2">
        <Label className="shrink-0 text-[10px] text-[var(--text-faint)]">Other conditions</Label>
        <Input
          value={healthProfile.otherConditions}
          maxLength={500}
          onChange={(e) => setHealthProfile({ otherConditions: e.target.value })}
          placeholder="Other GI or comorbidity details relevant to digestion/hydration"
          className="h-9"
        />
      </div>
    </CollapsibleSection>
  );
}
