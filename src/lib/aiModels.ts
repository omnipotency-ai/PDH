/**
 * Central AI model configuration — single source of truth for all model names.
 *
 * These models are developer-configured via environment variables, not user
 * preferences:
 *   - Dr. Poo reports and weekly summaries: VITE_OPENAI_DR_POO_MODEL
 *   - Background LLM tasks (coaching, food parsing, suggestions): VITE_OPENAI_BACKGROUND_MODEL
 *
 * For backward compatibility, Dr. Poo also respects the older
 * VITE_OPENAI_INSIGHT_MODEL variable when the new one is absent.
 */

/** Ordered list of supported models for all app AI features. */
export const AI_MODEL_OPTIONS = ["gpt-5.4", "gpt-5.4-mini"] as const;

/** Union type for supported OpenAI models. */
export type AiModelName = (typeof AI_MODEL_OPTIONS)[number];

const FALLBACK_DR_POO_MODEL: AiModelName = "gpt-5.4";
const FALLBACK_BACKGROUND_MODEL: AiModelName = "gpt-5.4-mini";

/** All valid model names as a Set, for runtime validation. */
const VALID_AI_MODELS: ReadonlySet<string> = new Set<string>(AI_MODEL_OPTIONS);

/** Backward-compatible aliases for previously configured or stored model names. */
const LEGACY_AI_MODEL_ALIASES: Readonly<Record<string, AiModelName>> = {
  "gpt-5-mini": "gpt-5.4-mini",
  "gpt-5.2": "gpt-5.4",
  "gpt-4o-mini": "gpt-5.4-mini",
  "gpt-4o": "gpt-5.4",
  "gpt-4.1-nano": "gpt-5.4-mini",
  "gpt-4.1-mini": "gpt-5.4-mini",
};

/** Type guard: checks whether a value is a valid AiModelName. */
function isAiModelName(value: unknown): value is AiModelName {
  return typeof value === "string" && VALID_AI_MODELS.has(value);
}

function normalizeAiModel(model: unknown, fallback: AiModelName): AiModelName {
  if (isAiModelName(model)) return model;
  if (typeof model === "string") {
    return LEGACY_AI_MODEL_ALIASES[model] ?? fallback;
  }
  return fallback;
}

/** Developer-configured model used for Dr. Poo reports and weekly summaries. */
export const DR_POO_MODEL: AiModelName = normalizeAiModel(
  import.meta.env.VITE_OPENAI_DR_POO_MODEL ?? import.meta.env.VITE_OPENAI_INSIGHT_MODEL,
  FALLBACK_DR_POO_MODEL,
);

/** Developer-configured model used for coaching, suggestions, and food parsing. */
export const BACKGROUND_MODEL: AiModelName = normalizeAiModel(
  import.meta.env.VITE_OPENAI_BACKGROUND_MODEL,
  FALLBACK_BACKGROUND_MODEL,
);

/** Validate an unknown value into a valid model name, falling back to the supplied default. */
export function getValidAiModel(
  model: unknown,
  fallback: AiModelName = DR_POO_MODEL,
): AiModelName {
  return normalizeAiModel(model, fallback);
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
