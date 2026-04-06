/**
 * @file aiErrorFormatter.ts
 *
 * Formats errors from the AI pipeline into safe, user-friendly strings.
 *
 * Rules:
 *  1. Map known OpenAI/network error types to plain user messages.
 *  2. Strip any material matching the sk-... API key pattern from the output.
 *  3. Never surface raw error details that may contain credentials, request IDs,
 *     model names, or rate-limit quota numbers.
 */

const SK_PATTERN = /sk-[A-Za-z0-9_-]+/g;

/** Strip API key material from a string. */
function stripApiKeys(text: string): string {
  return text.replace(SK_PATTERN, "sk-****");
}

/**
 * Map an error from the AI pipeline to a safe, user-friendly string.
 *
 * Recognises OpenAI HTTP status codes and common error message patterns.
 * Falls back to a generic "Analysis failed" message rather than surfacing
 * raw error details.
 */
export function formatAiError(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();

    // Rate limit (429)
    if (
      msg.includes("rate limit") ||
      msg.includes("rate_limit") ||
      msg.includes("429") ||
      msg.includes("too many requests")
    ) {
      return "Too many requests, try again later.";
    }

    // Auth / key problems (401, 403)
    if (
      msg.includes("401") ||
      msg.includes("403") ||
      msg.includes("invalid api key") ||
      msg.includes("incorrect api key") ||
      msg.includes("authentication") ||
      msg.includes("unauthorized") ||
      msg.includes("forbidden")
    ) {
      return "API key problem — check your key in Settings.";
    }

    // Timeout
    if (
      msg.includes("timeout") ||
      msg.includes("timed out") ||
      msg.includes("etimedout") ||
      msg.includes("abort")
    ) {
      return "Request timed out — try again.";
    }

    // Network / connectivity
    if (
      msg.includes("network") ||
      msg.includes("fetch") ||
      msg.includes("econnreset") ||
      msg.includes("enotfound") ||
      msg.includes("failed to fetch")
    ) {
      return "Network error — check your connection.";
    }
  }

  // Generic fallback — never show raw error details
  return "Analysis failed.";
}

/**
 * Same as formatAiError but also strips any residual sk-... material.
 * Use this at any render boundary where the error string may come from
 * an older code path or an external source.
 */
export function sanitizeAiErrorForDisplay(message: string): string {
  return stripApiKeys(message);
}
