import { MS_PER_DAY } from "@/lib/timeConstants";

/**
 * Shared utilities used by both aiPrompts.ts and aiFetchInsights.ts.
 * Extracted to avoid duplication — do not add anything here that is
 * not needed by both modules.
 */

export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString("en-GB", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getDaysPostOp(surgeryDate: string): number | null {
  if (!surgeryDate) return null;
  const surgery = new Date(surgeryDate);
  if (Number.isNaN(surgery.getTime())) return null;
  const now = new Date();
  return Math.floor((now.getTime() - surgery.getTime()) / MS_PER_DAY);
}
