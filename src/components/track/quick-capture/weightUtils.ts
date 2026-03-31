import { kgToLbs, lbsToKg } from "@/lib/formatWeight";

/**
 * Strip all non-numeric and non-period characters, enforce at most one decimal
 * point with a single decimal digit.
 */
export function sanitizeDecimalInput(value: string): string {
  let sanitized = value.replace(/[^\d.]/g, "");
  const parts = sanitized.split(".");
  if (parts.length > 2) {
    sanitized = `${parts[0]}.${parts.slice(1).join("")}`;
  }
  // Re-split after multi-dot normalization to apply decimal truncation correctly
  const finalParts = sanitized.split(".");
  if (finalParts.length === 2 && finalParts[1].length > 1) {
    sanitized = `${finalParts[0]}.${finalParts[1].slice(0, 1)}`;
  }
  return sanitized;
}

/** Strip all non-digit characters. */
export function sanitizeWholeNumberInput(value: string): string {
  return value.replace(/[^\d]/g, "");
}

/** Convert kg to stones + pounds (whole numbers, clamped). */
export function kgToStonesAndPounds(kg: number): {
  stones: number;
  pounds: number;
} {
  const totalLbs = kgToLbs(kg);
  const stones = Math.max(0, Math.floor(totalLbs / 14));
  const pounds = Math.max(0, Math.round(totalLbs - stones * 14));
  return { stones, pounds: Math.min(pounds, 13) };
}

/** Convert stones + pounds back to kg. */
export function stonesAndPoundsToKg(stones: number, pounds: number): number {
  return lbsToKg(stones * 14 + pounds);
}
