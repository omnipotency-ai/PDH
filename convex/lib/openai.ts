export const OPENAI_API_KEY_PATTERN = /^sk-[A-Za-z0-9_-]{20,}$/;

export type OpenAiHttpErrorCode =
  | "KEY_ERROR"
  | "QUOTA_ERROR"
  | "NETWORK_ERROR";

/**
 * Mask an API key for safe logging: show only the last 4 characters.
 * Returns "****" if the key is too short or empty.
 */
export function maskApiKey(key: string): string {
  if (key.length <= 4) return "****";
  return `****${key.slice(-4)}`;
}

/**
 * Classify an OpenAI HTTP status code into a structured error code.
 */
export function classifyOpenAiHttpError(
  status: number,
): OpenAiHttpErrorCode {
  if (status === 401 || status === 403) return "KEY_ERROR";
  if (status === 429) return "QUOTA_ERROR";
  return "NETWORK_ERROR";
}
