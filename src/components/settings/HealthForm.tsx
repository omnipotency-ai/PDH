import { useCallback } from "react";
import { Separator } from "@/components/ui/separator";
import { useHealthProfile, useUnitSystem } from "@/hooks/useProfile";
import type { HealthProfile } from "@/types/domain";
import {
  ConditionsSection,
  DemographicsSection,
  DietarySection,
  LifestyleSection,
  MedicationsSection,
  SurgerySection,
} from "./health";

export function HealthForm() {
  const { healthProfile, isLoading, setHealthProfile: setFullHealthProfile } = useHealthProfile();
  const { unitSystem } = useUnitSystem();

  // Child sections use the old partial-update pattern: setHealthProfile({ field: value }).
  // The hook's setter takes a full HealthProfile, so we wrap it to merge partials.
  const setHealthProfile = useCallback(
    (updates: Partial<HealthProfile>) => {
      if (!healthProfile) return;
      void setFullHealthProfile({ ...healthProfile, ...updates });
    },
    [healthProfile, setFullHealthProfile],
  );

  if (isLoading) {
    return <p className="text-xs text-[var(--text-faint)]">Loading health profile...</p>;
  }

  return (
    <div className="space-y-4">
      <SurgerySection healthProfile={healthProfile} setHealthProfile={setHealthProfile} />

      <Separator />

      <DemographicsSection
        healthProfile={healthProfile}
        setHealthProfile={setHealthProfile}
        unitSystem={unitSystem}
      />

      <Separator />

      <ConditionsSection healthProfile={healthProfile} setHealthProfile={setHealthProfile} />

      <Separator />

      <MedicationsSection healthProfile={healthProfile} setHealthProfile={setHealthProfile} />

      <Separator />

      <LifestyleSection healthProfile={healthProfile} setHealthProfile={setHealthProfile} />

      <Separator />

      <DietarySection healthProfile={healthProfile} setHealthProfile={setHealthProfile} />

      <p className="text-[10px] text-[var(--text-faint)]">
        Shared with Dr. Poo to personalise your advice. Stored securely in your cloud profile.
      </p>
    </div>
  );
}
