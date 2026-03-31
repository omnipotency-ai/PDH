import type { HabitConfig, HabitLog } from "@/lib/habitTemplates";
import { isCapHabit, isHabitType } from "@/lib/habitTemplates";
import { normalizeFluidItemName } from "@/lib/normalizeFluidName";
import type { SyncedLog } from "@/lib/sync";

const REC_DRUG_ALIASES = ["rec drugs", "rec_drugs", "recreational drugs", "tina"];
const WALKING_ALIASES = ["walk", "walking"];

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeActivityType(value: string): string {
  const normalized = normalizeKey(value);
  if (normalized === "walk") return "walking";
  return normalized;
}

function buildHabitAliases(habit: HabitConfig): string[] {
  const aliases = new Set<string>();
  aliases.add(normalizeKey(habit.id));
  aliases.add(normalizeKey(habit.name));
  if (habit.templateKey) aliases.add(normalizeKey(habit.templateKey));

  if (habit.templateKey === "rec_drugs") {
    for (const alias of REC_DRUG_ALIASES) aliases.add(normalizeKey(alias));
  }
  if (habit.templateKey === "walking") {
    for (const alias of WALKING_ALIASES) aliases.add(normalizeKey(alias));
  }
  if (habit.templateKey === "confectionery") {
    aliases.add("sweets");
    aliases.add("sweet");
  }

  return Array.from(aliases);
}

function resolveHabitFromKey(
  habits: HabitConfig[],
  aliasMap: Map<string, HabitConfig>,
  rawKey: string | null | undefined,
  fallbackType?: HabitConfig["habitType"],
): HabitConfig | null {
  if (rawKey) {
    const direct = aliasMap.get(normalizeKey(rawKey));
    if (direct) return direct;
  }
  if (!fallbackType) return null;
  return habits.find((habit) => habit.habitType === fallbackType) ?? null;
}

function getActivityHabitValue(habit: HabitConfig, durationMinutes: number): number {
  return habit.unit === "hours" ? Math.round((durationMinutes / 60) * 100) / 100 : durationMinutes;
}

export function rebuildHabitLogsFromSyncedLogs(
  syncedLogs: SyncedLog[],
  habits: HabitConfig[],
): HabitLog[] {
  const aliasMap = new Map<string, HabitConfig>();
  const fluidHabitMap = new Map<string, HabitConfig>();
  const activityHabitMap = new Map<string, HabitConfig[]>();

  for (const habit of habits) {
    for (const alias of buildHabitAliases(habit)) {
      if (!aliasMap.has(alias)) aliasMap.set(alias, habit);
    }
    if (habit.logAs === "fluid") {
      fluidHabitMap.set(normalizeFluidItemName(habit.name), habit);
    }
    if (habit.habitType === "activity") {
      const activityKey = normalizeActivityType(habit.name);
      const existing = activityHabitMap.get(activityKey) ?? [];
      existing.push(habit);
      activityHabitMap.set(activityKey, existing);
    }
  }

  const rebuilt: HabitLog[] = [];

  for (const log of syncedLogs.slice().sort((a, b) => a.timestamp - b.timestamp)) {
    if (log.type === "habit") {
      const habit = resolveHabitFromKey(
        habits,
        aliasMap,
        typeof log.data.habitId === "string"
          ? log.data.habitId
          : typeof log.data.name === "string"
            ? log.data.name
            : null,
        isHabitType(log.data.habitType) ? log.data.habitType : undefined,
      );
      if (!habit) continue;
      const quantity = Number(log.data.quantity ?? 1);
      if (!Number.isFinite(quantity) || quantity <= 0) continue;
      rebuilt.push({
        id: `derived:${log.id}:${habit.id}`,
        habitId: habit.id,
        value: quantity,
        source: "import",
        at: log.timestamp,
      });
      continue;
    }

    if (log.type === "fluid") {
      for (let index = 0; index < log.data.items.length; index += 1) {
        const item = log.data.items[index];
        const normalizedName = normalizeFluidItemName(item.name);
        const habit = fluidHabitMap.get(normalizedName);
        const quantity = Number(item.quantity ?? 0);
        if (!habit || !Number.isFinite(quantity) || quantity <= 0) continue;
        rebuilt.push({
          id: `derived:${log.id}:${habit.id}:${index}`,
          habitId: habit.id,
          value: isCapHabit(habit) ? 1 : quantity,
          source: "import",
          at: log.timestamp,
        });
      }
      continue;
    }

    if (log.type === "activity") {
      const activityType = normalizeActivityType(
        typeof log.data.activityType === "string" ? log.data.activityType : "",
      );
      const durationMinutes = Number(log.data.durationMinutes ?? 0);
      if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) continue;

      if (activityType === "sleep") {
        for (const habit of habits.filter((entry) => entry.habitType === "sleep")) {
          rebuilt.push({
            id: `derived:${log.id}:${habit.id}`,
            habitId: habit.id,
            value: getActivityHabitValue(habit, durationMinutes),
            source: "import",
            at: log.timestamp,
          });
        }
        continue;
      }

      const matchingHabits = activityHabitMap.get(activityType) ?? [];
      for (const habit of matchingHabits) {
        rebuilt.push({
          id: `derived:${log.id}:${habit.id}`,
          habitId: habit.id,
          value: getActivityHabitValue(habit, durationMinutes),
          source: "import",
          at: log.timestamp,
        });
      }
    }
  }

  return rebuilt;
}
