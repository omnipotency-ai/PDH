import { type HabitConfig, isCheckboxHabit } from "@/lib/habitTemplates";
import { isFoodPipelineType } from "@shared/logTypeUtils";
import type { SyncedLog } from "@/lib/sync";
import type { FluidLog, WeightLog } from "@/types/domain";
import type { DisplayItem, FoodPipelineLog } from "./types";

function isFoodPipelineLog(log: SyncedLog): log is FoodPipelineLog {
  return isFoodPipelineType(log.type);
}

function sumFluidMl(entries: FluidLog[]): number {
  let total = 0;
  for (const entry of entries) {
    const items = entry.data.items;
    for (const item of items) {
      const qty = Number(item?.quantity);
      if (!Number.isFinite(qty) || qty <= 0) continue;
      const unit = String(item?.unit ?? "")
        .trim()
        .toLowerCase();
      if (unit === "l") {
        total += qty * 1000;
      } else {
        // ml (default) or unrecognised unit
        total += qty;
      }
    }
  }
  return total;
}

function resolveHabitGroupKey(habits: HabitConfig[], log: Extract<SyncedLog, { type: "habit" }>): string {
  const habitId = String(log.data?.habitId ?? "").trim();
  const name = String(log.data?.name ?? "").trim();
  const matchedHabit =
    habits.find((h) => h.id === habitId) ??
    habits.find((h) => name.length > 0 && h.name === name) ??
    null;

  return matchedHabit?.id || habitId || name || "habit";
}

/** Find the maximum timestamp in an array of logs. Avoids Math.max(...spread) allocation. */
function maxTimestamp(entries: ReadonlyArray<{ timestamp: number }>): number {
  let max = -Infinity;
  for (const e of entries) {
    if (e.timestamp > max) max = e.timestamp;
  }
  return max;
}

export function groupLogEntries(sorted: SyncedLog[], habits: HabitConfig[]): DisplayItem[] {
  const items: DisplayItem[] = [];

  // Accumulate groups
  const foodEntries: FoodPipelineLog[] = [];
  const fluidEntries: FluidLog[] = [];
  const weightEntries: WeightLog[] = [];
  const sleepActivityEntries: SyncedLog[] = [];
  const activityEntries: SyncedLog[] = [];
  // Plain object is cheaper than Map for small string-keyed collections
  const habitGroups: Record<string, SyncedLog[]> = Object.create(null);

  for (const log of sorted) {
    if (isFoodPipelineLog(log)) {
      // Liquid logs use the same item shape as food logs and belong in the food group.
      foodEntries.push(log);
      continue;
    }

    if (log.type === "digestion") {
      items.push({ kind: "individual", log, sortKey: log.timestamp });
      continue;
    }

    if (log.type === "fluid") {
      fluidEntries.push(log);
      continue;
    }

    if (log.type === "weight") {
      weightEntries.push(log);
      continue;
    }

    if (log.type === "habit") {
      const key = resolveHabitGroupKey(habits, log);
      const group = habitGroups[key];
      if (group) {
        group.push(log);
      } else {
        habitGroups[key] = [log];
      }
      continue;
    }

    if (log.type === "activity") {
      const activityType = String(log.data?.activityType ?? "")
        .trim()
        .toLowerCase();
      if (activityType === "sleep") {
        sleepActivityEntries.push(log);
      } else {
        activityEntries.push(log);
      }
      continue;
    }

    // Unknown type fallback — defensive guard for future log types.
    // TypeScript narrows `log` to `never` here since all known types are handled above,
    // so we cast to SyncedLog to access `.timestamp`.
    const unknownLog: SyncedLog = log as SyncedLog;
    items.push({
      kind: "individual",
      log: unknownLog,
      sortKey: unknownLog.timestamp,
    });
  }

  // Create food group
  if (foodEntries.length > 0) {
    items.push({
      kind: "food",
      entries: foodEntries,
      sortKey: maxTimestamp(foodEntries),
    });
  }

  // Create fluid group
  if (fluidEntries.length > 0) {
    items.push({
      kind: "fluid",
      entries: fluidEntries,
      totalMl: sumFluidMl(fluidEntries),
      sortKey: maxTimestamp(fluidEntries),
    });
  }

  // Create habit groups
  for (const key in habitGroups) {
    const entries = habitGroups[key];
    if (entries === undefined || entries.length === 0) continue;
    const first = entries[0];
    const firstData = first?.type === "habit" ? first.data : null;
    const matchedHabit =
      habits.find((h) => h.id === key) ??
      habits.find((h) => firstData?.name && h.name === firstData.name) ??
      null;
    // Legacy fallback: if no matched HabitConfig exists (e.g. the habit was deleted or
    // imported from an old backup), infer event vs counter from the raw log fields.
    // `habitType` and `action` were written by older versions of the log schema and are
    // no longer populated by current mutations — this branch handles historical records only.
    const isEvent =
      matchedHabit !== null
        ? isCheckboxHabit(matchedHabit)
        : String(firstData?.habitType ?? "")
            .trim()
            .toLowerCase() === "checkbox" ||
          String(firstData?.action ?? "")
            .trim()
            .toLowerCase() === "check";
    if (isEvent) {
      items.push({
        kind: "event_habit",
        groupKey: key,
        entries,
        sortKey: maxTimestamp(entries),
      });
    } else {
      items.push({
        kind: "counter_habit",
        groupKey: key,
        entries,
        sortKey: maxTimestamp(entries),
      });
    }
  }

  // Create dedicated sleep group
  if (sleepActivityEntries.length > 0) {
    items.push({
      kind: "sleep",
      groupKey: "sleep",
      entries: sleepActivityEntries,
      sortKey: maxTimestamp(sleepActivityEntries),
    });
  }

  // Create activity group (non-sleep activities only)
  if (activityEntries.length > 0) {
    items.push({
      kind: "activity",
      groupKey: "activity",
      entries: activityEntries,
      sortKey: maxTimestamp(activityEntries),
    });
  }

  // Create weight group
  if (weightEntries.length > 0) {
    items.push({
      kind: "weight",
      entries: weightEntries,
      sortKey: maxTimestamp(weightEntries),
    });
  }

  // Sort by most-recent timestamp descending
  items.sort((a, b) => b.sortKey - a.sortKey);
  return items;
}
