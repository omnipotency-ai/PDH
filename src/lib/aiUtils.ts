import { MS_PER_DAY } from "@/lib/timeConstants";

/**
 * Shared utilities used by both aiPrompts.ts and aiFetchInsights.ts.
 * Extracted to avoid duplication — do not add anything here that is
 * not needed by both modules.
 */

export function formatTime(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

export function getDaysPostOp(surgeryDate: string, nowMs: number = Date.now()): number | null {
  if (!surgeryDate) return null;
  const surgery = new Date(surgeryDate);
  if (Number.isNaN(surgery.getTime())) return null;
  return Math.floor((nowMs - surgery.getTime()) / MS_PER_DAY);
}
