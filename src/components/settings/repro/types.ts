import type { ReproductiveHealthSettings } from "@/types/domain";

export interface ReproSectionProps {
  reproductiveHealth: ReproductiveHealthSettings;
  updateReproductiveHealth: (updates: Partial<ReproductiveHealthSettings>) => void;
}
