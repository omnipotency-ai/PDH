export interface CustomFoodPreset {
  id: string;
  name: string;
  ingredients: string[];
}

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
    id: `food_${Date.now()}_${Math.round(Math.random() * 10000)}`,
    name: "",
    ingredients: [],
  };
}

export function parseIngredientsInput(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20);
}

export function formatIngredientsInput(ingredients: string[]): string {
  return ingredients.join(", ");
}

export function loadCustomFoodPresets(): CustomFoodPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_FOOD_PRESETS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isCustomFoodPreset)
      .map((preset) => ({
        id: preset.id,
        name: preset.name.trim().slice(0, 80),
        ingredients: preset.ingredients
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 20),
      }))
      .slice(0, 12);
  } catch {
    return [];
  }
}

export function saveCustomFoodPresets(presets: CustomFoodPreset[]): void {
  if (typeof window === "undefined") return;
  const normalized = presets
    .map((preset) => ({
      id: preset.id,
      name: preset.name.trim().slice(0, 80),
      ingredients: preset.ingredients
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 20),
    }))
    .filter((preset) => preset.name.length > 0)
    .slice(0, 12);

  try {
    window.localStorage.setItem(CUSTOM_FOOD_PRESETS_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Ignore write failures in private browsing/storage-restricted environments.
  }
}
