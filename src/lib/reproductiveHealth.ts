import { differenceInCalendarDays, parseISO } from "date-fns";
import { formatLocalDateKey } from "@/lib/dateUtils";
import type {
  MenopauseStatus,
  PregnancyStatus,
  ReproductiveBleedingStatus,
  ReproductiveSymptom,
} from "@/types/domain";

export const REPRODUCTIVE_BLEEDING_OPTIONS: Array<{
  value: ReproductiveBleedingStatus;
  label: string;
}> = [
  { value: "none", label: "None" },
  { value: "spotting", label: "Spotting" },
  { value: "light", label: "Light" },
  { value: "medium", label: "Medium" },
  { value: "heavy", label: "Heavy" },
];

export const REPRODUCTIVE_SYMPTOM_OPTIONS: Array<{
  value: ReproductiveSymptom;
  label: string;
}> = [
  { value: "cramps", label: "Cramps" },
  { value: "bloating", label: "Bloating" },
  { value: "nausea", label: "Nausea" },
  { value: "constipation", label: "Constipation" },
  { value: "diarrhea", label: "Diarrhea" },
  { value: "headache", label: "Headache" },
  { value: "fatigue", label: "Fatigue" },
];

export const PREGNANCY_STATUS_OPTIONS: Array<{
  value: PregnancyStatus;
  label: string;
}> = [
  { value: "not_pregnant", label: "Not pregnant" },
  { value: "pregnant", label: "Pregnant" },
  { value: "postpartum", label: "Postpartum" },
];

export const MENOPAUSE_STATUS_OPTIONS: Array<{
  value: MenopauseStatus;
  label: string;
}> = [
  { value: "not_applicable", label: "Not applicable / not tracking" },
  { value: "perimenopause", label: "Perimenopause" },
  { value: "menopause", label: "Menopause" },
  { value: "unsure", label: "Unsure / exploring" },
];

export function parseDateOnly(value: string): Date | null {
  if (!value) return null;
  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getDateKeyFromTimestamp(timestamp: number): string {
  return formatLocalDateKey(timestamp);
}

export function getTodayDateKey(): string {
  return formatLocalDateKey(new Date());
}

export function calculateCycleDay(periodStartDate: string, onDate = new Date()): number | null {
  const start = parseDateOnly(periodStartDate);
  if (!start) return null;
  const diff = differenceInCalendarDays(onDate, start);
  if (diff < 0) return null;
  return diff + 1;
}

export interface GestationalAge {
  week: number;
  day: number;
  trimester: 1 | 2 | 3;
  daysUntilDue: number;
}

export function calculateGestationalAgeFromDueDate(
  dueDate: string,
  onDate = new Date(),
): GestationalAge | null {
  const due = parseDateOnly(dueDate);
  if (!due) return null;
  const daysUntilDue = differenceInCalendarDays(due, onDate);
  const gestationalDays = 280 - daysUntilDue;
  if (gestationalDays < 0) return null;
  const week = Math.floor(gestationalDays / 7) + 1;
  const day = gestationalDays % 7;
  // T1: < 91 days (end of week 13), T2: < 189 days (end of week 27), T3: >= 189
  const trimester: 1 | 2 | 3 = gestationalDays < 91 ? 1 : gestationalDays < 189 ? 2 : 3;
  return { week, day, trimester, daysUntilDue };
}

export function bleedingStatusBadgeClass(status: ReproductiveBleedingStatus): string {
  switch (status) {
    case "heavy":
      return "bg-rose-500/20 text-rose-300 border-rose-400/40";
    case "medium":
      return "bg-rose-400/15 text-rose-200 border-rose-300/35";
    case "light":
      return "bg-pink-400/15 text-pink-200 border-pink-300/35";
    case "spotting":
      return "bg-fuchsia-400/10 text-fuchsia-200 border-fuchsia-300/30";
    default:
      return "bg-[var(--surface-3)] text-[var(--text-faint)] border-[var(--border)]";
  }
}

export function isBleedingStatusActive(status: ReproductiveBleedingStatus): boolean {
  return status !== "none";
}
