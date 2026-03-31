/**
 * Safely extract an error message from an unknown error type.
 * Use this instead of inline instanceof Error checks.
 */
export function getErrorMessage(err: unknown, fallback = "An unknown error occurred"): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return fallback;
}
