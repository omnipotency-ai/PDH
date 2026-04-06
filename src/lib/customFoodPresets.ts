export interface CustomFoodPreset {
  id: string;
  name: string;
  ingredients: string[];
}

export const MAX_PRESET_NAME_LENGTH = 80;
export const MAX_INGREDIENT_NAME_LENGTH = 20;
export const MAX_PRESETS = 12;
export const CUSTOM_FOOD_PRESETS_STORAGE_KEY = "caca-custom-food-presets-v1";

function isCustomFoodPreset(value: unknown): value is CustomFoodPreset {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    Array.isArray(candidate.ingredients) &&
    candidate.ingredients.every((item) => typeof item === "string")
  );
}

export function createBlankCustomFoodPreset(): CustomFoodPreset {
  return {
    id: crypto.randomUUID(),
    name: "",
    ingredients: [],
  };
}

export function parseIngredientsInput(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim().slice(0, MAX_INGREDIENT_NAME_LENGTH))
    .filter(Boolean);
}

export function formatIngredientsInput(ingredients: string[]): string {
  return ingredients.join(", ");
}

function normalizePreset(preset: CustomFoodPreset): CustomFoodPreset {
  return {
    id: preset.id,
    name: preset.name.trim().slice(0, MAX_PRESET_NAME_LENGTH),
    ingredients: preset.ingredients
      .map((item) => item.trim().slice(0, MAX_INGREDIENT_NAME_LENGTH))
      .filter(Boolean),
  };
}

export function loadCustomFoodPresets(): CustomFoodPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_FOOD_PRESETS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isCustomFoodPreset).map(normalizePreset).slice(0, MAX_PRESETS);
  } catch {
    return [];
  }
}

export function saveCustomFoodPresets(presets: CustomFoodPreset[]): void {
  if (typeof window === "undefined") return;
  const normalized = presets
    .map(normalizePreset)
    .filter((preset) => preset.name.length > 0)
    .slice(0, MAX_PRESETS);

  try {
    window.localStorage.setItem(CUSTOM_FOOD_PRESETS_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Ignore write failures in private browsing/storage-restricted environments.
  }
}
