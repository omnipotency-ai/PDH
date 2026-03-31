/**
 * AI call guard — last-resort safety net.
 *
 * The primary rate control is the 4-hour cooldown in useAiInsights.
 * This module provides a hard 5-minute minimum interval between any AI calls
 * as a backstop against accidental bursts.
 */

let lastCallTimestamp = 0;
const MIN_CALL_INTERVAL_MS = 300_000; // 5 minutes

/**
 * Check if an AI call is allowed based on rate limiting.
 * Throws an error if called too frequently.
 */
export function checkRateLimit(): void {
  if (MIN_CALL_INTERVAL_MS <= 0) {
    return;
  }
  const now = Date.now();
  if (now - lastCallTimestamp < MIN_CALL_INTERVAL_MS) {
    throw new Error("AI call rate limited — please wait 5 minutes between calls");
  }
  lastCallTimestamp = now;
}

/**
 * Reset the rate limiter (for testing purposes).
 */
export function resetRateLimit(): void {
  lastCallTimestamp = 0;
}
