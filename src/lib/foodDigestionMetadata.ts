import type { FoodDigestionMetadata } from "@shared/foodRegistry";

export type DigestionBadgeTone = "positive" | "neutral" | "caution" | "danger";

export interface DigestionBadge {
  key: keyof FoodDigestionMetadata;
  label: string;
  value: string;
  tone: DigestionBadgeTone;
}

const FIELD_LABELS: Record<keyof FoodDigestionMetadata, string> = {
  osmoticEffect: "Osmotic",
  totalResidue: "Residue",
  fiberTotalApproxG: "Fibre",
  fiberInsolubleLevel: "Insoluble",
  fiberSolubleLevel: "Soluble",
  gasProducing: "Gas",
  dryTexture: "Dryness",
  irritantLoad: "Irritant",
  highFatRisk: "High fat",
  lactoseRisk: "Lactose",
};

function formatLevel(value: string): string {
  return value.replace(/_/g, " ");
}

function toneForValue(value: string | number): DigestionBadgeTone {
  if (typeof value === "number") {
    if (value === 0) return "positive";
    if (value >= 3) return "caution";
    return "neutral";
  }

  if (value === "none" || value === "no" || value === "very_low") {
    return "positive";
  }
  if (value === "low") return "neutral";
  if (value === "possible" || value === "low_moderate" || value === "moderate") {
    return "caution";
  }
  if (value === "moderate_high" || value === "high" || value === "yes") {
    return "danger";
  }
  // Unknown risk levels default to caution — err on the side of warning in a health app
  return "caution";
}

export function hasFoodDigestionMetadata(
  metadata: FoodDigestionMetadata | null | undefined,
): metadata is FoodDigestionMetadata {
  return metadata !== null && metadata !== undefined && Object.keys(metadata).length > 0;
}

const KNOWN_METADATA_KEYS = new Set<string>(Object.keys(FIELD_LABELS));

export function getFoodDigestionBadges(
  metadata: FoodDigestionMetadata | null | undefined,
): DigestionBadge[] {
  if (!hasFoodDigestionMetadata(metadata)) return [];

  return (Object.entries(metadata) as Array<[keyof FoodDigestionMetadata, string | number]>)
    .filter(([key]) => KNOWN_METADATA_KEYS.has(key))
    .map(([key, value]) => ({
      key,
      label: FIELD_LABELS[key],
      value:
        typeof value === "number"
          ? `${value}g`
          : key === "gasProducing" || key === "dryTexture"
            ? value
            : formatLevel(value),
      tone: toneForValue(value),
    }));
}

// Presentation utility co-located with digestion metadata for convenience
export function digestionBadgeClassName(tone: DigestionBadgeTone): string {
  const base =
    "inline-flex items-center rounded-full border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em]";

  switch (tone) {
    case "positive":
      return `${base} border-emerald-500/25 bg-emerald-500/10 text-emerald-200`;
    case "neutral":
      return `${base} border-slate-600 bg-slate-800 text-slate-300`;
    case "caution":
      return `${base} border-amber-500/25 bg-amber-500/10 text-amber-200`;
    case "danger":
      return `${base} border-rose-500/25 bg-rose-500/10 text-rose-200`;
  }
}
