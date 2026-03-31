import { format } from "date-fns";
import type { LucideIcon } from "lucide-react";
import { Activity, Droplets, Footprints, HeartPulse, Moon, Soup, Weight } from "lucide-react";
import type { HabitConfig } from "@/lib/habitTemplates";
import type { SyncedLog } from "@/lib/sync";
import type { FoodItem, FoodLog } from "@/types/domain";
import type { HabitLogData } from "./types";

// ── Food item resolution status ─────────────────────────────────────────────

export type FoodItemResolutionStatus = "resolved" | "pending" | "expired" | "processing";

/**
 * Derive the resolution status of a single food item.
 * - "resolved": has a real canonicalName and resolvedBy is registry/llm/user
 * - "expired": canonicalName is "unknown_food" or resolvedBy is "expired"
 * - "pending": no canonicalName (or undefined), not expired — waiting for match
 * - "processing": not used per-item but included for type completeness
 */
export function getFoodItemResolutionStatus(item: FoodItem): FoodItemResolutionStatus {
  if (item.canonicalName === "unknown_food" || item.resolvedBy === "expired") {
    return "expired";
  }
  if (
    item.canonicalName != null &&
    item.canonicalName.length > 0 &&
    (item.resolvedBy === "registry" || item.resolvedBy === "llm" || item.resolvedBy === "user")
  ) {
    return "resolved";
  }
  return "pending";
}

/**
 * Check whether a food log is still processing (has rawInput but empty items array).
 */
export function isFoodLogProcessing(log: FoodLog): boolean {
  return log.data.items.length === 0 && Boolean(log.data.rawInput);
}

/**
 * Count unresolved (pending or expired) items in a food log.
 */
export function countUnresolvedItems(log: FoodLog): number {
  return log.data.items.filter((item) => {
    const status = getFoodItemResolutionStatus(item);
    return status === "pending" || status === "expired";
  }).length;
}

/**
 * Get the display name for a food item, including quantity and unit when available.
 * Examples: "2 sl toast", "1 med banana", "3 eggs", "chicken"
 */
export function getFoodItemDisplayName(item: FoodItem): string {
  const name =
    String(item.parsedName ?? "").trim() ||
    String(item.name ?? "").trim() ||
    String(item.rawName ?? "").trim() ||
    String(item.userSegment ?? "").trim() ||
    "Food";

  const qty = item.quantity;
  const unit = String(item.unit ?? "").trim();

  if (qty == null || !Number.isFinite(qty) || qty <= 0) {
    return name;
  }

  if (unit) {
    return `${qty} ${unit} ${name}`;
  }

  return `${qty} ${name}`;
}

/**
 * Build a default portion display hint (e.g., "~2 sl") when quantity is null
 * and the item has a defaultPortionDisplay value.
 */
export function getDefaultPortionHint(item: FoodItem): string | null {
  if (item.quantity != null) return null;
  if (!item.defaultPortionDisplay) return null;
  return `~${item.defaultPortionDisplay}`;
}

/** Type guard for logs that have notes */
export function hasNotes(log: SyncedLog): log is SyncedLog & { data: { notes?: string } } {
  return log.type === "digestion";
}

/** Type guard for logs that have items array */
export function hasItems(log: SyncedLog): log is SyncedLog & {
  data: { items: Array<{ name?: string; quantity?: number; unit?: string }> };
} {
  return log.type === "food" || log.type === "fluid";
}

export function getLogIcon(log: SyncedLog): LucideIcon {
  if (log.type === "food") return Soup;
  if (log.type === "fluid") return Droplets;
  if (log.type === "digestion") return HeartPulse;
  if (log.type === "weight") return Weight;
  if (log.type === "activity") {
    const at = String(log.data?.activityType ?? "").toLowerCase();
    if (at === "sleep") return Moon;
    if (at === "walk") return Footprints;
    return Activity;
  }
  return Activity;
}

export function getLogColor(log: SyncedLog): string {
  if (log.type === "food") return "text-[var(--section-food)]";
  if (log.type === "fluid") return "text-sky-600 dark:text-sky-400";
  if (log.type === "digestion") return "text-[var(--section-bowel)]";
  if (log.type === "weight") return "text-indigo-600 dark:text-indigo-400";
  if (log.type === "activity") {
    const at = String(log.data?.activityType ?? "").toLowerCase();
    if (at === "sleep") return "text-indigo-600 dark:text-indigo-400";
    return "text-teal-600 dark:text-teal-400";
  }
  return "text-[var(--color-text-secondary)]";
}

/**
 * Alias for getFoodItemDisplayName that accepts a looser item shape.
 * Delegates to the same name-resolution logic for consistency.
 */
export function formatItemDisplay(item: {
  name?: string;
  rawName?: string | null;
  userSegment?: string;
  parsedName?: string;
  quantity?: number | null;
  unit?: string | null;
}): string {
  return getFoodItemDisplayName(item as Parameters<typeof getFoodItemDisplayName>[0]);
}

/**
 * Build a timestamp from a date string (YYYY-MM-DD) and time string (HH:mm).
 * Returns undefined if neither date nor time changed from the original,
 * or if the inputs are empty / invalid.
 */
export function applyDateTimeToTimestamp(
  originalTimestamp: number,
  dateString: string,
  timeString: string,
): number | undefined {
  if (!dateString || !timeString) {
    return undefined;
  }

  const origDate = new Date(originalTimestamp);
  const origDateStr = format(origDate, "yyyy-MM-dd");
  const origTimeStr = format(origDate, "HH:mm");

  if (dateString === origDateStr && timeString === origTimeStr) {
    return undefined;
  }

  const [year, month, day] = dateString.split("-").map(Number);
  const [h, m] = timeString.split(":").map(Number);

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(h) ||
    !Number.isFinite(m)
  ) {
    return undefined;
  }

  const next = new Date(year, month - 1, day, h, m, 0, 0);
  return next.getTime();
}

export function findHabitConfigForHabitLog(
  habits: HabitConfig[],
  data: HabitLogData | null | undefined,
): HabitConfig | null {
  const habitId = String(data?.habitId ?? "").trim();
  const name = String(data?.name ?? "").trim();
  return (
    habits.find((h) => h.id === habitId) ??
    habits.find((h) => name.length > 0 && h.name === name) ??
    null
  );
}

export function getLogTitle(log: SyncedLog, habits: HabitConfig[]): string {
  if (log.type === "food") return "Food Intake";
  if (log.type === "fluid") {
    const first = String(log.data.items[0]?.name ?? "").trim();
    return first || "Fluid";
  }
  if (log.type === "digestion") return "Bowel movement";
  if (log.type === "habit") {
    const habitConfig = findHabitConfigForHabitLog(habits, log.data);
    return habitConfig?.name ?? String(log.data?.name ?? "Habit");
  }
  if (log.type === "activity") {
    const at = String(log.data?.activityType ?? "").toLowerCase();
    if (at === "sleep") return "Sleep";
    if (at === "walk") return "Walk";
    if (!at) return "Activity";
    return titleCaseToken(at);
  }
  if (log.type === "weight") return "Weight Check-in";
  return "Entry";
}

export function getLogDetail(log: SyncedLog): string | null {
  if (log.type === "food") {
    const items = log.data.items;
    const rawLabels = items
      .map((item) =>
        String(item?.parsedName ?? item?.name ?? item?.rawName ?? item?.userSegment ?? "").trim(),
      )
      .filter(Boolean);
    if (rawLabels.length > 0) {
      const seen = new Set<string>();
      const uniqueLabels: string[] = [];
      for (const label of rawLabels) {
        const key = label.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        uniqueLabels.push(label);
      }
      if (uniqueLabels.length > 0) {
        return uniqueLabels.join(", ");
      }
    }
    const labels = items.map(formatItemDisplay).filter(Boolean);
    if (labels.length === 0) return null;
    return labels.join(", ");
  }
  if (log.type === "fluid") {
    const first = log.data.items[0];
    const qty = first?.quantity;
    const unit = String(first?.unit ?? "").trim();
    if (!Number.isFinite(qty)) return null;
    return unit ? `${qty} ${unit}` : String(qty);
  }
  if (log.type === "digestion") {
    const episodes = Number(log.data.episodesCount) || 1;
    const bristol = log.data.bristolCode ? `B${log.data.bristolCode}` : null;
    const urgency = log.data.urgencyTag ?? null;
    const effort = log.data.effortTag ?? null;
    const volume = log.data.volumeTag ?? null;
    const parts = [`${episodes}x`];
    if (bristol) parts.push(bristol);
    if (urgency) parts.push(urgency);
    if (effort) parts.push(effort);
    if (volume) parts.push(`${volume} vol`);
    return parts.join(" · ");
  }
  if (log.type === "activity") {
    const duration = Number(log.data.durationMinutes);
    const at = String(log.data.activityType ?? "").toLowerCase();
    if (!Number.isFinite(duration)) return null;
    if (at === "sleep") {
      const h = Math.floor(duration / 60);
      const m = duration % 60;
      return m ? `${h}h ${m}m` : `${h}h`;
    }
    return `${duration}m`;
  }
  if (log.type === "weight") {
    const kg = log.data.weightKg;
    return Number.isFinite(kg) ? `${kg.toFixed(1)} kg` : null;
  }
  return null;
}

export function getEditablePrimary(log: SyncedLog): string {
  if (log.type === "food") {
    const firstItem = log.data?.items?.[0];
    return String(
      firstItem?.userSegment ??
        firstItem?.rawName ??
        firstItem?.parsedName ??
        firstItem?.name ??
        "",
    ).trim();
  }
  if (log.type === "fluid") {
    return String(log.data?.items?.[0]?.name ?? "").trim();
  }
  return "";
}

export function canEditPrimary(log: SyncedLog): boolean {
  return log.type === "food" || log.type === "fluid";
}

export function formatDuration(minutes: number, type: string): string {
  if (type === "sleep") {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  }
  return `${minutes}m`;
}

export function getActivityEntryDurationMinutes(entry: SyncedLog): number | null {
  if (entry.type !== "activity") return null;
  const d = Number(entry.data?.durationMinutes);
  return Number.isFinite(d) && d > 0 ? d : null;
}

const COLLAPSED_PREVIEW_CHAR_LIMIT = 50;

export function truncatePreviewText(
  value: string | null | undefined,
  maxChars = COLLAPSED_PREVIEW_CHAR_LIMIT,
) {
  const text = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;
}

export function getActivityLabel(typeKey: string): string {
  if (typeKey === "walk") return "Walk";
  if (typeKey === "sleep") return "Sleep";
  return titleCaseToken(typeKey);
}

export function titleCaseToken(value: string): string {
  return value
    .replace(/_/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

/** Safely extract notes from any log type that supports it */
export function getLogNotes(log: SyncedLog): string {
  if (log.type === "digestion") {
    return String(log.data.notes ?? "");
  }
  return "";
}
