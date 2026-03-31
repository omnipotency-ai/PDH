import type { UnitSystem } from "@/lib/units";
import type { HealthProfile } from "@/types/domain";

export interface HealthSectionProps {
  healthProfile: HealthProfile;
  setHealthProfile: (update: Partial<HealthProfile>) => void;
  unitSystem: UnitSystem;
}
