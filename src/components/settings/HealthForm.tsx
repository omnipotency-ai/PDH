import { useCallback } from "react";
import { Separator } from "@/components/ui/separator";
import { useHealthProfile, useUnitSystem } from "@/hooks/useProfile";
import type { HealthProfile } from "@/types/domain";
import { ClinicalHistorySection, DemographicsSection } from "./health";

export function HealthForm() {
  const { healthProfile, isLoading, setHealthProfile: patchHealthProfile } = useHealthProfile();
  const { unitSystem } = useUnitSystem();

  const setHealthProfile = useCallback(
    (updates: Partial<HealthProfile>) => {
      if (!healthProfile) return;
      void patchHealthProfile(updates);
    },
    [healthProfile, patchHealthProfile],
  );

  if (isLoading) {
    return <p className="text-xs text-[var(--text-faint)]">Loading health profile...</p>;
  }

  return (
    <div className="space-y-4">
      <DemographicsSection
        healthProfile={healthProfile}
        setHealthProfile={setHealthProfile}
        unitSystem={unitSystem}
      />

      <Separator />

      <ClinicalHistorySection
        healthProfile={healthProfile}
        setHealthProfile={setHealthProfile}
        unitSystem={unitSystem}
      />

      <p className="text-[10px] text-[var(--text-faint)]">
        Used by Dr. Poo as durable recovery context alongside your live logs.
      </p>
    </div>
  );
}
