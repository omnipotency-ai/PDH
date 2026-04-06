/**
 * Central AI model configuration — single source of truth for all model names.
 *
 * Two tiers:
 *   - Background: cheapest capable model, used for coaching, suggestions, food parsing.
 *     Not user-configurable.
 *   - Insight: used for Dr. Poo reports and analysis. User-selectable from INSIGHT_MODEL_OPTIONS.
 */

/** Model used for coaching snippets, pane summaries, suggestions, and food parsing. */
export const BACKGROUND_MODEL = "gpt-5.4-mini";

/** Ordered list of models the user may pick for insight/analysis tasks. */
export const INSIGHT_MODEL_OPTIONS = ["gpt-5.4", "gpt-5.4-mini"] as const;

/** Default insight model for new users / factory reset. */
export const DEFAULT_INSIGHT_MODEL: InsightModel = "gpt-5.4";

/** Union type for user-selectable insight models. */
export type InsightModel = (typeof INSIGHT_MODEL_OPTIONS)[number];

/** All valid insight models as a Set, for runtime validation. */
const VALID_INSIGHT_MODELS: ReadonlySet<string> = new Set<string>(INSIGHT_MODEL_OPTIONS);

/** Backward-compatible aliases for previously stored model names. */
const LEGACY_INSIGHT_MODEL_ALIASES: Readonly<Record<string, InsightModel>> = {
  "gpt-5-mini": "gpt-5.4-mini",
  "gpt-5.2": "gpt-5.4",
  "gpt-4o-mini": "gpt-5.4-mini",
  "gpt-4o": "gpt-5.4",
  "gpt-4.1-nano": "gpt-5.4-mini",
  "gpt-4.1-mini": "gpt-5.4-mini",
};

/** Type guard: checks whether a value is a valid InsightModel. */
function isInsightModel(value: unknown): value is InsightModel {
  return typeof value === "string" && VALID_INSIGHT_MODELS.has(value);
}

/** Validate an unknown value into a valid InsightModel, falling back to the default. */
export function getValidInsightModel(model: unknown): InsightModel {
  if (isInsightModel(model)) return model;
  if (typeof model === "string") {
    return LEGACY_INSIGHT_MODEL_ALIASES[model] ?? DEFAULT_INSIGHT_MODEL;
  }
  return DEFAULT_INSIGHT_MODEL;
}

/** Human-readable label for a model name. */
export function getModelLabel(model: string): string {
  switch (model) {
    case "gpt-5.4-mini":
      return "GPT-5.4 Mini";
    case "gpt-5.4":
      return "GPT-5.4";
    default:
      return model;
  }
}
