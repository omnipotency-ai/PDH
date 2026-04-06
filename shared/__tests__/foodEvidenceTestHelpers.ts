import type { FoodEvidenceLog, HabitLike } from "../foodEvidence";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const BASE_TIME = Date.UTC(2026, 0, 1, 8, 0, 0);

export interface FoodLogOptions {
  canonicalName?: string;
  quantity?: number;
  unit?: string | null;
}

export interface BuildDailyTrialSeriesArgs {
  foodName: string;
  trialCount: number;
  transitHours: number;
  bristolCodes: number[];
  confoundedIndexes?: number[];
  confounderHabit?: HabitLike;
}

export function foodLog(
  id: string,
  timestamp: number,
  name: string,
  options: FoodLogOptions = {},
): FoodEvidenceLog {
  return {
    id,
    timestamp,
    type: "food",
    data: {
      items: [
        {
          name,
          canonicalName: options.canonicalName ?? name.toLowerCase(),
          quantity: options.quantity ?? 1,
          unit: options.unit ?? "portion",
        },
      ],
    },
  };
}

export function digestionLog(
  id: string,
  timestamp: number,
  bristolCode: number,
  episodesCount = 1,
): FoodEvidenceLog {
  return {
    id,
    timestamp,
    type: "digestion",
    data: {
      bristolCode,
      episodesCount,
    },
  };
}

function habitLog(
  id: string,
  timestamp: number,
  habit: HabitLike,
): FoodEvidenceLog {
  return {
    id,
    timestamp,
    type: "habit",
    data: {
      habitId: habit.id,
      name: habit.name,
      quantity: 5,
    },
  };
}

export function buildDailyTrialSeries(args: BuildDailyTrialSeriesArgs): {
  habits: HabitLike[];
  logs: FoodEvidenceLog[];
} {
  const habits = args.confounderHabit ? [args.confounderHabit] : [];
  const logs: FoodEvidenceLog[] = [];
  const confoundedIndexes = new Set(args.confoundedIndexes ?? []);

  for (let index = 0; index < args.trialCount; index += 1) {
    const foodAt = BASE_TIME + index * DAY;
    const bowelAt = foodAt + args.transitHours * HOUR;

    logs.push(foodLog(`food-${index}`, foodAt, args.foodName));
    logs.push(
      digestionLog(
        `digestion-${index}`,
        bowelAt,
        args.bristolCodes[index] ?? args.bristolCodes[args.bristolCodes.length - 1] ?? 4,
      ),
    );

    if (confoundedIndexes.has(index) && args.confounderHabit) {
      logs.push(habitLog(`habit-${index}`, foodAt + 30 * 60 * 1000, args.confounderHabit));
    }
  }

  return { habits, logs };
}
