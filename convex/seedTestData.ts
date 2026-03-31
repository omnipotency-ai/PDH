/**
 * Seed test data for dev database.
 *
 * Creates 10 days of backdated food logs, bowel movements, and fluid logs
 * for a given user. Designed to build up enough evidence to test:
 *   - Food safety grid (repeated foods build evidence)
 *   - Transit map evidence display
 *   - Dr. Poo reports
 *
 * Usage: Run from the Convex dashboard or via `npx convex run seedTestData:seedTestData '{"userId":"<clerk-user-id>"}'`
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

/** List distinct userIds from the logs table — useful for finding the test user. */
export const listUserIds = internalQuery({
  args: {},
  handler: async (ctx) => {
    const logs = await ctx.db.query("logs").take(100);
    const ids = new Set(logs.map((l) => l.userId));
    return Array.from(ids);
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const MS_PER_DAY = 86_400_000;
const MS_PER_HOUR = 3_600_000;

// ─────────────────────────────────────────────────────────────────────────────
// Food item definitions — mirrors what writeProcessedItems would produce
// ─────────────────────────────────────────────────────────────────────────────

interface SeedFoodItem {
  userSegment: string;
  parsedName: string;
  quantity: number | null;
  unit: string | null;
  canonicalName: string;
  resolvedBy: "registry";
  recoveryStage: 1 | 2 | 3;
  matchConfidence: number;
  matchStrategy: "combined";
  group: string;
  line: string;
}

function makeFoodItem(
  userSegment: string,
  canonicalName: string,
  zone: 1 | 2 | 3,
  group: "protein" | "carbs" | "fats" | "seasoning",
  line:
    | "meat_fish"
    | "eggs_dairy"
    | "vegetable_protein"
    | "grains"
    | "vegetables"
    | "fruit"
    | "oils"
    | "dairy_fats"
    | "nuts_seeds"
    | "sauces_condiments"
    | "herbs_spices",
): SeedFoodItem {
  return {
    userSegment,
    parsedName: userSegment,
    quantity: null,
    unit: null,
    canonicalName,
    resolvedBy: "registry",
    recoveryStage: zone,
    matchConfidence: 0.95,
    matchStrategy: "combined",
    group,
    line,
  };
}

// Pre-built food items for each meal component
const CHICKEN = makeFoodItem(
  "chicken",
  "grilled white meat",
  2,
  "protein",
  "meat_fish",
);
const RICE = makeFoodItem("rice", "white rice", 1, "carbs", "grains");
const TOAST = makeFoodItem("toast", "toast", 1, "carbs", "grains");
const BUTTER = makeFoodItem("butter", "butter", 2, "fats", "dairy_fats");
const SCRAMBLED_EGGS = makeFoodItem(
  "scrambled eggs",
  "buttered scrambled eggs",
  2,
  "protein",
  "eggs_dairy",
);
const MASHED_POTATO = makeFoodItem(
  "mashed potato",
  "mashed potato",
  1,
  "carbs",
  "vegetables",
);
const GRAVY = makeFoodItem(
  "gravy",
  "gravy",
  2,
  "seasoning",
  "sauces_condiments",
);
const SALMON = makeFoodItem("salmon", "oily fish", 2, "protein", "meat_fish");
const BROCCOLI = makeFoodItem("broccoli", "broccoli", 3, "carbs", "vegetables");

// ─────────────────────────────────────────────────────────────────────────────
// Meal templates — repeated to build evidence
// ─────────────────────────────────────────────────────────────────────────────

interface MealTemplate {
  text: string;
  items: SeedFoodItem[];
  hourOffset: number; // hours from midnight
}

const CHICKEN_AND_RICE: MealTemplate = {
  text: "chicken and rice",
  items: [CHICKEN, RICE],
  hourOffset: 12.5,
};

const TOAST_WITH_BUTTER: MealTemplate = {
  text: "toast with butter",
  items: [TOAST, BUTTER],
  hourOffset: 8,
};

const SCRAMBLED_EGGS_MEAL: MealTemplate = {
  text: "scrambled eggs",
  items: [SCRAMBLED_EGGS],
  hourOffset: 8.5,
};

const MASHED_POTATO_WITH_GRAVY: MealTemplate = {
  text: "mashed potato with gravy",
  items: [MASHED_POTATO, GRAVY],
  hourOffset: 18,
};

const SALMON_WITH_BROCCOLI: MealTemplate = {
  text: "salmon with broccoli",
  items: [SALMON, BROCCOLI],
  hourOffset: 18.5,
};

// ─────────────────────────────────────────────────────────────────────────────
// Daily schedules — 10 days of meals
// Each day has 2-3 meals. Repeated meals build evidence.
// ─────────────────────────────────────────────────────────────────────────────

// Day index 0 = 10 days ago, Day index 9 = yesterday
const DAILY_MEALS: ReadonlyArray<ReadonlyArray<MealTemplate>> = [
  // Day -10: toast+butter, chicken+rice
  [TOAST_WITH_BUTTER, CHICKEN_AND_RICE],
  // Day -9: scrambled eggs, chicken+rice, mashed potato+gravy
  [SCRAMBLED_EGGS_MEAL, CHICKEN_AND_RICE, MASHED_POTATO_WITH_GRAVY],
  // Day -8: toast+butter, chicken+rice
  [TOAST_WITH_BUTTER, CHICKEN_AND_RICE],
  // Day -7: scrambled eggs, salmon+broccoli
  [SCRAMBLED_EGGS_MEAL, SALMON_WITH_BROCCOLI],
  // Day -6: toast+butter, chicken+rice
  [TOAST_WITH_BUTTER, CHICKEN_AND_RICE],
  // Day -5: scrambled eggs, mashed potato+gravy
  [SCRAMBLED_EGGS_MEAL, MASHED_POTATO_WITH_GRAVY],
  // Day -4: toast+butter, chicken+rice
  [TOAST_WITH_BUTTER, CHICKEN_AND_RICE],
  // Day -3: chicken+rice (lunch), salmon+broccoli
  [{ ...CHICKEN_AND_RICE, hourOffset: 12 }, SALMON_WITH_BROCCOLI],
  // Day -2: toast+butter (breakfast), chicken+rice (lunch)
  [TOAST_WITH_BUTTER, { ...CHICKEN_AND_RICE, hourOffset: 13 }],
  // Day -1: scrambled eggs (breakfast), chicken+rice (dinner at 19:00)
  [SCRAMBLED_EGGS_MEAL, { ...CHICKEN_AND_RICE, hourOffset: 19 }],
];

// ─────────────────────────────────────────────────────────────────────────────
// BM schedules — 1-2 per day, mostly Bristol 3-4 with occasional 5-6
// ─────────────────────────────────────────────────────────────────────────────

type BristolCode = 1 | 2 | 3 | 4 | 5 | 6 | 7;

interface BmTemplate {
  bristolCode: BristolCode;
  urgencyTag: string;
  effortTag: string;
  volumeTag: string;
  hourOffset: number;
}

const DAILY_BMS: ReadonlyArray<ReadonlyArray<BmTemplate>> = [
  // Day -10
  [
    {
      bristolCode: 4,
      urgencyTag: "normal",
      effortTag: "easy",
      volumeTag: "medium",
      hourOffset: 9,
    },
  ],
  // Day -9
  [
    {
      bristolCode: 3,
      urgencyTag: "normal",
      effortTag: "moderate",
      volumeTag: "medium",
      hourOffset: 7,
    },
    {
      bristolCode: 4,
      urgencyTag: "normal",
      effortTag: "easy",
      volumeTag: "small",
      hourOffset: 15,
    },
  ],
  // Day -8
  [
    {
      bristolCode: 4,
      urgencyTag: "normal",
      effortTag: "easy",
      volumeTag: "medium",
      hourOffset: 10,
    },
  ],
  // Day -7 (salmon+broccoli day — slightly looser)
  [
    {
      bristolCode: 5,
      urgencyTag: "urgent",
      effortTag: "easy",
      volumeTag: "medium",
      hourOffset: 6,
    },
    {
      bristolCode: 4,
      urgencyTag: "normal",
      effortTag: "easy",
      volumeTag: "small",
      hourOffset: 22,
    },
  ],
  // Day -6
  [
    {
      bristolCode: 3,
      urgencyTag: "normal",
      effortTag: "moderate",
      volumeTag: "medium",
      hourOffset: 8,
    },
  ],
  // Day -5
  [
    {
      bristolCode: 4,
      urgencyTag: "normal",
      effortTag: "easy",
      volumeTag: "medium",
      hourOffset: 9,
    },
    {
      bristolCode: 4,
      urgencyTag: "normal",
      effortTag: "easy",
      volumeTag: "small",
      hourOffset: 20,
    },
  ],
  // Day -4
  [
    {
      bristolCode: 3,
      urgencyTag: "normal",
      effortTag: "moderate",
      volumeTag: "medium",
      hourOffset: 7.5,
    },
  ],
  // Day -3 (second salmon+broccoli day — loose again)
  [
    {
      bristolCode: 6,
      urgencyTag: "urgent",
      effortTag: "easy",
      volumeTag: "large",
      hourOffset: 8,
    },
    {
      bristolCode: 5,
      urgencyTag: "urgent",
      effortTag: "easy",
      volumeTag: "medium",
      hourOffset: 16,
    },
  ],
  // Day -2
  [
    {
      bristolCode: 4,
      urgencyTag: "normal",
      effortTag: "easy",
      volumeTag: "medium",
      hourOffset: 10,
    },
  ],
  // Day -1
  [
    {
      bristolCode: 3,
      urgencyTag: "normal",
      effortTag: "moderate",
      volumeTag: "medium",
      hourOffset: 9,
    },
    {
      bristolCode: 4,
      urgencyTag: "normal",
      effortTag: "easy",
      volumeTag: "small",
      hourOffset: 21,
    },
  ],
];

// ─────────────────────────────────────────────────────────────────────────────
// Fluid schedules — water intake throughout the day
// ─────────────────────────────────────────────────────────────────────────────

interface FluidTemplate {
  amount: number; // ml
  hourOffset: number;
}

const DAILY_FLUIDS: ReadonlyArray<ReadonlyArray<FluidTemplate>> = [
  // Day -10
  [
    { amount: 250, hourOffset: 7 },
    { amount: 300, hourOffset: 11 },
    { amount: 250, hourOffset: 15 },
    { amount: 200, hourOffset: 19 },
  ],
  // Day -9
  [
    { amount: 300, hourOffset: 8 },
    { amount: 250, hourOffset: 12 },
    { amount: 250, hourOffset: 16 },
  ],
  // Day -8
  [
    { amount: 250, hourOffset: 7.5 },
    { amount: 300, hourOffset: 12 },
    { amount: 200, hourOffset: 17 },
    { amount: 250, hourOffset: 20 },
  ],
  // Day -7
  [
    { amount: 300, hourOffset: 7 },
    { amount: 250, hourOffset: 13 },
    { amount: 300, hourOffset: 18 },
  ],
  // Day -6
  [
    { amount: 250, hourOffset: 8 },
    { amount: 300, hourOffset: 12 },
    { amount: 250, hourOffset: 16 },
    { amount: 200, hourOffset: 20 },
  ],
  // Day -5
  [
    { amount: 300, hourOffset: 7 },
    { amount: 250, hourOffset: 11 },
    { amount: 250, hourOffset: 15 },
  ],
  // Day -4
  [
    { amount: 250, hourOffset: 7 },
    { amount: 300, hourOffset: 12 },
    { amount: 250, hourOffset: 17 },
    { amount: 200, hourOffset: 21 },
  ],
  // Day -3
  [
    { amount: 300, hourOffset: 8 },
    { amount: 250, hourOffset: 13 },
    { amount: 300, hourOffset: 19 },
  ],
  // Day -2
  [
    { amount: 250, hourOffset: 7.5 },
    { amount: 300, hourOffset: 12 },
    { amount: 250, hourOffset: 16 },
    { amount: 200, hourOffset: 20 },
  ],
  // Day -1
  [
    { amount: 300, hourOffset: 7 },
    { amount: 250, hourOffset: 11 },
    { amount: 250, hourOffset: 15 },
    { amount: 300, hourOffset: 19 },
  ],
];

// ─────────────────────────────────────────────────────────────────────────────
// Seed mutation
// ─────────────────────────────────────────────────────────────────────────────

export const seedTestData = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const { userId } = args;
    const now = Date.now();

    let foodLogCount = 0;
    let bmLogCount = 0;
    let fluidLogCount = 0;

    for (let dayIndex = 0; dayIndex < 10; dayIndex++) {
      // Day 0 = 10 days ago, Day 9 = 1 day ago
      const daysAgo = 10 - dayIndex;
      const dayStartMs = now - daysAgo * MS_PER_DAY;

      // ── Food logs ──────────────────────────────────────────────────────
      const meals = DAILY_MEALS[dayIndex];
      if (meals !== undefined) {
        for (const meal of meals) {
          const timestamp = dayStartMs + meal.hourOffset * MS_PER_HOUR;
          await ctx.db.insert("logs", {
            userId,
            timestamp,
            type: "food",
            data: {
              rawInput: meal.text,
              items: meal.items.map((item) => ({
                userSegment: item.userSegment,
                parsedName: item.parsedName,
                quantity: item.quantity,
                unit: item.unit,
                canonicalName: item.canonicalName,
                resolvedBy: item.resolvedBy,
                recoveryStage: item.recoveryStage,
                matchConfidence: item.matchConfidence,
                matchStrategy: item.matchStrategy,
              })),
              itemsVersion: 1,
              evidenceProcessedAt: timestamp + 6 * MS_PER_HOUR,
            },
          });
          foodLogCount++;
        }
      }

      // ── BM logs ────────────────────────────────────────────────────────
      const bms = DAILY_BMS[dayIndex];
      if (bms !== undefined) {
        for (const bm of bms) {
          const timestamp = dayStartMs + bm.hourOffset * MS_PER_HOUR;
          await ctx.db.insert("logs", {
            userId,
            timestamp,
            type: "digestion",
            data: {
              bristolCode: bm.bristolCode,
              urgencyTag: bm.urgencyTag,
              effortTag: bm.effortTag,
              volumeTag: bm.volumeTag,
            },
          });
          bmLogCount++;
        }
      }

      // ── Fluid logs ─────────────────────────────────────────────────────
      const fluids = DAILY_FLUIDS[dayIndex];
      if (fluids !== undefined) {
        for (const fluid of fluids) {
          const timestamp = dayStartMs + fluid.hourOffset * MS_PER_HOUR;
          await ctx.db.insert("logs", {
            userId,
            timestamp,
            type: "fluid",
            data: {
              items: [{ name: "water", quantity: fluid.amount, unit: "ml" }],
            },
          });
          fluidLogCount++;
        }
      }
    }

    console.log(
      `Seeded ${foodLogCount} food logs, ${bmLogCount} BM logs, ${fluidLogCount} fluid logs for user ${userId}`,
    );

    return { foodLogCount, bmLogCount, fluidLogCount };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Clear mutation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SAFE clear: only deletes logs in the seeded time range (Day -11 to Day 0 from now).
 * Does NOT delete all user logs — only the backdated window used by seedTestData.
 */
export const clearTestData = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const { userId } = args;
    const now = Date.now();
    const seedRangeStart = now - 11 * MS_PER_DAY;
    const seedRangeEnd = now;

    const logs = await ctx.db
      .query("logs")
      .withIndex("by_userId_timestamp", (q) =>
        q
          .eq("userId", userId)
          .gte("timestamp", seedRangeStart)
          .lte("timestamp", seedRangeEnd),
      )
      .collect();

    let deletedCount = 0;
    for (const log of logs) {
      await ctx.db.delete(log._id);
      deletedCount++;
    }

    console.log(
      `Deleted ${deletedCount} logs for user ${userId} in seeded range (${new Date(seedRangeStart).toISOString()} to ${new Date(seedRangeEnd).toISOString()})`,
    );

    return { deletedCount };
  },
});
