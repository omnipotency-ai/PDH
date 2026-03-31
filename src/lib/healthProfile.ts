/**
 * Shared utilities for health profile data normalization.
 */

/**
 * Normalize health condition names to handle legacy values and spelling variants.
 * Use this when loading/importing health conditions from external sources.
 */
export function normalizeHealthConditionName(condition: unknown): string | null {
  if (typeof condition !== "string") return null;
  const trimmed = condition.trim();
  if (!trimmed) return null;

  // Legacy condition name mappings
  if (trimmed === "Coeliac disease") return "Celiac disease";
  if (trimmed === "IBD / Crohn's / Colitis") return "IBD/IBS";
  if (trimmed === "IBD") return "IBD/IBS";
  if (trimmed === "IBS") return "IBD/IBS";
  if (trimmed === "Diabetes / high blood sugar") return "Diabetes";

  return trimmed;
}

/**
 * Normalize an array of health conditions, deduplicating and filtering invalid entries.
 */
export function normalizeHealthConditions(conditions: unknown): string[] {
  if (!Array.isArray(conditions)) return [];

  const normalized = conditions
    .map(normalizeHealthConditionName)
    .filter((c): c is string => c !== null);

  return Array.from(new Set(normalized));
}
