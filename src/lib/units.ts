import { kgToLbs, kgToStones, lbsToKg, stonesToKg } from "./formatWeight";

export type UnitSystem = "metric" | "imperial_us" | "imperial_uk";
export type DisplayWeightUnit = "kg" | "lbs" | "stones";

export function normalizeUnitSystem(value: unknown): UnitSystem {
  if (value === "imperial_uk") return "imperial_uk";
  if (value === "imperial_us") return "imperial_us";
  // Legacy persisted value.
  if (value === "imperial") return "imperial_us";
  return "metric";
}

export function isImperialUnitSystem(unitSystem: UnitSystem): boolean {
  return unitSystem !== "metric";
}

export function getDisplayWeightUnit(unitSystem: UnitSystem): DisplayWeightUnit {
  if (unitSystem === "imperial_uk") return "stones";
  if (unitSystem === "imperial_us") return "lbs";
  return "kg";
}

export function kgToDisplayWeight(kg: number, unitSystem: UnitSystem): number {
  const unit = getDisplayWeightUnit(unitSystem);
  if (unit === "lbs") return kgToLbs(kg);
  if (unit === "stones") return kgToStones(kg);
  return kg;
}

export function displayWeightToKg(value: number, unitSystem: UnitSystem): number {
  const unit = getDisplayWeightUnit(unitSystem);
  if (unit === "lbs") return lbsToKg(value);
  if (unit === "stones") return stonesToKg(value);
  return value;
}

export function getWeightUnitLabel(unitSystem: UnitSystem): "kg" | "lb" | "st" {
  const unit = getDisplayWeightUnit(unitSystem);
  if (unit === "lbs") return "lb";
  if (unit === "stones") return "st";
  return "kg";
}

// ── Fluid units ────────────────────────────────────────────────────────────

const ML_PER_FL_OZ = 29.5735;

export type DisplayFluidUnit = "ml" | "fl oz";

export function getDisplayFluidUnit(unitSystem: UnitSystem): DisplayFluidUnit {
  return unitSystem === "metric" ? "ml" : "fl oz";
}

/** Convert millilitres to US fluid ounces, rounded to 1 decimal. */
export function mlToFlOz(ml: number): number {
  return Math.round((ml / ML_PER_FL_OZ) * 10) / 10;
}

/** Convert US fluid ounces to millilitres. */
export function flOzToMl(flOz: number): number {
  return flOz * ML_PER_FL_OZ;
}

/**
 * Format a millilitre value for display in the user's preferred unit.
 * Returns e.g. "250 ml" or "8.5 fl oz".
 */
export function formatFluidDisplay(ml: number, unitSystem: UnitSystem): string {
  if (unitSystem === "metric") {
    return `${Math.round(ml)} ml`;
  }
  const flOz = mlToFlOz(ml);
  return `${flOz} fl oz`;
}

// ── Height / length ─────────────────────────────────────────────────────────

const CM_PER_INCH = 2.54;

export function cmToInches(cm: number): number {
  return cm / CM_PER_INCH;
}

export function inchesToCm(inches: number): number {
  return inches * CM_PER_INCH;
}

export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalInches = cmToInches(cm);
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches - feet * 12;
  return { feet, inches };
}

export function feetInchesToCm(feet: number, inches: number): number {
  return inchesToCm(feet * 12 + inches);
}
