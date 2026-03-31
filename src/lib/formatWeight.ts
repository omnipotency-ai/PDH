export const LBS_PER_KG = 2.20462;
export const KG_PER_LB = 0.45359237;
export const LBS_PER_STONE = 14;
export const KG_PER_STONE = KG_PER_LB * LBS_PER_STONE;

export function kgToLbs(kg: number): number {
  return kg * LBS_PER_KG;
}

export function lbsToKg(lbs: number): number {
  return lbs * KG_PER_LB;
}

export function kgToStones(kg: number): number {
  return kg / KG_PER_STONE;
}

export function stonesToKg(stones: number): number {
  return stones * KG_PER_STONE;
}

export function formatWeight(kg: number, unit: "kg" | "lbs" | "stones"): string {
  if (!Number.isFinite(kg)) return "\u2014";
  if (unit === "lbs") {
    return `${kgToLbs(kg).toFixed(1)} lbs`;
  }
  if (unit === "stones") {
    return `${kgToStones(kg).toFixed(1)} st`;
  }
  return `${kg.toFixed(1)} kg`;
}

export function formatWeightDelta(deltaKg: number, unit: "kg" | "lbs" | "stones"): string {
  if (!Number.isFinite(deltaKg)) return "\u2014";
  const sign = deltaKg >= 0 ? "+" : "";
  if (unit === "lbs") {
    return `${sign}${kgToLbs(deltaKg).toFixed(1)} lbs`;
  }
  if (unit === "stones") {
    return `${sign}${kgToStones(deltaKg).toFixed(1)} st`;
  }
  return `${sign}${deltaKg.toFixed(1)} kg`;
}
