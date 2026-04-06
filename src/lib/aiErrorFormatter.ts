/**
 * @file aiErrorFormatter.ts
 *
 * Sanitizes AI pipeline errors before they are shown in the UI.
 *
 * Raw error messages from OpenAI or Convex can contain API keys, request IDs,
 * model names, rate-limit quotas, or other internal details. This module maps
 * known error types to safe, user-friendly strings and strips any remaining
 * API key material before returning.
 *
 * The server (convex/ai.ts) throws errors with structured prefixes:
 *   [KEY_ERROR]     — bad or missing API key
 *   [QUOTA_ERROR]   — rate limited (HTTP 429)
 *   [NETWORK_ERROR] — server error or connection failure
 *   [NON_RETRYABLE] — error prefix indicating the action should not be retried
 *
 * @exports formatAiError — maps unknown errors to safe user-facing strings
 */

/**
 * Pattern matching API key material (e.g. sk-proj-abc123...).
 * Strips the key itself from any error message that leaks it.
 */
const API_KEY_PATTERN = /sk-[A-Za-z0-9_-]+/g;

/**
 * User-facing messages for each known error code.
 * These must never contain internal details.
 */
const USER_FACING_MESSAGES: Record<string, string> = {
  KEY_ERROR: "API key problem — please check your key in Settings.",
  QUOTA_ERROR: "Too many requests — please try again later.",
  NETWORK_ERROR: "Request failed — check your connection and try again.",
};

const GENERIC_FALLBACK = "Analysis failed — please try again.";
const TIMEOUT_MESSAGE = "Request timed out — please try again.";

/**
 * Extract the structured error code from a server-thrown error message.
 *
 * The server prefixes errors with `[CODE]` e.g. `[KEY_ERROR] ...`.
 * Returns null if no structured code is present.
 */
function extractErrorCode(message: string): string | null {
  const match = /\[([A-Z_]+)\]/.exec(message);
  if (match === null) return null;
  // Skip the [NON_RETRYABLE] prefix itself — it is a modifier, not an error code.
  if (match[1] === "NON_RETRYABLE") {
    // Try to find the next code in the string
    const rest = message.slice(match.index + match[0].length);
    return extractErrorCode(rest);
  }
  return match[1] ?? null;
}

/**
 * Strip API key material from a string.
 * Replaces anything matching sk-... with a safe placeholder.
 */
function stripApiKeyMaterial(text: string): string {
  return text.replace(API_KEY_PATTERN, "sk-****");
}

/**
 * Format an unknown AI pipeline error into a safe, user-facing string.
 *
 * Maps known error codes (KEY_ERROR, QUOTA_ERROR, NETWORK_ERROR) to
 * friendly messages. Detects abort/timeout errors. Strips API key material
 * from any fallback message text. Never exposes raw error internals.
 */
export function formatAiError(err: unknown): string {
  // Handle AbortError (from AbortController) — user navigated away or retried
  if (err instanceof Error && err.name === "AbortError") {
    return TIMEOUT_MESSAGE;
  }

  if (err instanceof Error) {
    const message = err.message;

    // Check for timeout signal in the message
    if (message.toLowerCase().includes("timed out")) {
      return TIMEOUT_MESSAGE;
    }

    // Try to find a structured error code from the server
    const code = extractErrorCode(message);
    if (code !== null) {
      const userMessage = USER_FACING_MESSAGES[code];
      if (userMessage !== undefined) {
        return userMessage;
      }
    }

    // No known code — sanitize and return stripped message, capped at 120 chars
    // so we don't leak a wall of text with internal details
    const sanitized = stripApiKeyMaterial(message);
    const capped = sanitized.length > 120 ? `${sanitized.slice(0, 120)}...` : sanitized;
    return capped || GENERIC_FALLBACK;
  }

  if (typeof err === "string") {
    const sanitized = stripApiKeyMaterial(err);
    const capped = sanitized.length > 120 ? `${sanitized.slice(0, 120)}...` : sanitized;
    return capped || GENERIC_FALLBACK;
  }

  return GENERIC_FALLBACK;
}
