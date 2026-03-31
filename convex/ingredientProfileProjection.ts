import { getCanonicalFoodProjection } from "../shared/foodProjection";

export function normalizeIngredientProfileTag(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, " ");
}

export function normalizeIngredientProfileTags(values: string[]): string[] {
  const unique = new Set<string>();
  for (const value of values) {
    const tag = normalizeIngredientProfileTag(value);
    if (!tag) continue;
    unique.add(tag);
  }
  return Array.from(unique.values()).sort((a, b) => a.localeCompare(b));
}

export function normalizeIngredientProfileLabel(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function getIngredientProfileProjection(canonicalName: string) {
  return getCanonicalFoodProjection(canonicalName);
}
