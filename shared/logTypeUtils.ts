/**
 * Whether a log type flows through the food matching/parsing pipeline.
 * Currently: "food" and "liquid" (non-water beverages).
 * Centralised so new food-like types only need adding in one place.
 */
export function isFoodPipelineType(type: string): type is "food" | "liquid" {
  return type === "food" || type === "liquid";
}
