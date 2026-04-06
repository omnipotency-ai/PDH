import type { FluidPreset } from "@/types/domain";

/** Default drink choices shown beside the built-in water button on Track. */
export const DEFAULT_FLUID_PRESETS: FluidPreset[] = [
  { name: "Aquarius" },
  { name: "Juice" },
  { name: "Green tea" },
];

/** Maximum number of fluid presets the user can configure. */
export const MAX_FLUID_PRESETS = 3;

/** Fluid names that cannot be used as custom presets (reserved for built-in choices). */
export const BLOCKED_FLUID_PRESET_NAMES = new Set(["agua", "other", "water"]);
