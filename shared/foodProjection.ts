import { resolveCanonicalFoodName } from "./foodCanonicalName";
import { formatFoodDisplayName } from "./foodNormalize";
import { type FoodGroup, type FoodLine, getFoodEntry } from "./foodRegistry";

export const BRAT_BASELINE_CANONICALS = [
  "ripe banana",
  "white rice",
  "toast",
  "stewed apple",
] as const;

export const BRAT_FOOD_KEYS: ReadonlySet<string> = new Set(
  BRAT_BASELINE_CANONICALS,
);

export interface LoggedFoodIdentity {
  canonicalName: string;
  displayName: string;
}

export interface CanonicalFoodProjection {
  foodGroup: FoodGroup | null;
  foodLine: FoodLine | null;
}

function readText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function getLoggedFoodIdentity(candidate: {
  name?: unknown;
  rawName?: unknown;
  parsedName?: unknown;
  userSegment?: unknown;
  canonicalName?: unknown;
}): LoggedFoodIdentity | null {
  const userSegment = readText(candidate.userSegment);
  const rawName = readText(candidate.rawName);
  const parsedName = readText(candidate.parsedName);
  const name = readText(candidate.name);
  const rawCanonical = readText(candidate.canonicalName);
  const displaySource =
    parsedName || name || rawName || userSegment || rawCanonical;
  if (!displaySource) return null;

  return {
    canonicalName: resolveCanonicalFoodName(rawCanonical || displaySource),
    displayName: formatFoodDisplayName(displaySource),
  };
}

export function getCanonicalFoodProjection(
  canonicalName: string,
): CanonicalFoodProjection {
  const resolved = resolveCanonicalFoodName(canonicalName);
  const entry = getFoodEntry(resolved);
  return {
    foodGroup: entry?.group ?? null,
    foodLine: entry?.line ?? null,
  };
}
