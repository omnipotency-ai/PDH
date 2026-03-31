import { useCallback } from "react";
import { Separator } from "@/components/ui/separator";
import { useHealthProfile } from "@/hooks/useProfile";
import type { HealthProfile } from "@/types/domain";
import { CycleSection, MenopauseSection, PregnancySection } from "./repro";

export function ReproForm() {
  const { healthProfile, isLoading, setHealthProfile: setFullHealthProfile } = useHealthProfile();

  const setHealthProfile = useCallback(
    (updates: Partial<HealthProfile>) => {
      if (!healthProfile) return;
      void setFullHealthProfile({ ...healthProfile, ...updates });
    },
    [healthProfile, setFullHealthProfile],
  );

  if (isLoading) {
    return <p className="text-xs text-[var(--text-faint)]">Loading reproductive health...</p>;
  }

  const reproductiveHealth = healthProfile.reproductiveHealth;

  const updateReproductiveHealth = (updates: Partial<typeof reproductiveHealth>) => {
    setHealthProfile({
      reproductiveHealth: { ...reproductiveHealth, ...updates },
    });
  };

  return (
    <div className="space-y-4">
      <CycleSection
        reproductiveHealth={reproductiveHealth}
        updateReproductiveHealth={updateReproductiveHealth}
      />

      <Separator />

      <PregnancySection
        reproductiveHealth={reproductiveHealth}
        updateReproductiveHealth={updateReproductiveHealth}
      />

      <Separator />

      <MenopauseSection
        reproductiveHealth={reproductiveHealth}
        updateReproductiveHealth={updateReproductiveHealth}
      />

      <p className="text-[10px] text-[var(--text-faint)]">
        Included in Dr. Poo context only when Reproductive Health is enabled.
      </p>
    </div>
  );
}
