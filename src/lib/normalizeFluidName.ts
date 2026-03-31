/**
 * Normalizes a fluid item name for consistent comparison and aggregation.
 * Used by Track.tsx for fluid totals display.
 */
export function normalizeFluidItemName(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}
