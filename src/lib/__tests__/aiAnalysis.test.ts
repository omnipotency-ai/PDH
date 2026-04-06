import { describe, expect, it } from "vitest";
import { MS_PER_DAY, MS_PER_HOUR } from "@/lib/timeConstants";
import type { AiNutritionistInsight, HealthProfile, LogEntry } from "@/types/domain";
import type {
  BowelEvent,
  FoodLog,
  FoodTrialSummaryInput,
  RecentEventsResult,
  WeeklyContext,
} from "../aiAnalysis";
import {
  buildDeltaSignals,
  buildFoodContext,
  buildPartialDayContext,
  buildPatientSnapshot,
  buildRecentEvents,
  buildUserMessage,
  computeBristolTrend,
  getFoodWindowHours,
  parseAiInsight,
} from "../aiAnalysis";

describe("parseAiInsight", () => {
  const FULL_VALID_RESPONSE: AiNutritionistInsight = {
    directResponseToUser: "Great progress today!",
    summary: "Your digestion looks stable.",
    clinicalReasoning:
      "Toast was eaten at 12:00 and the subsequent Bristol 4 at 18:00 falls within the expected 6h transit window.",
    educationalInsight: {
      topic: "Gastrocolic reflex",
      fact: "Urgency after eating is often the gastrocolic reflex.",
    },
    foodAssessments: [],
    suspectedCulprits: [
      {
        food: "Spicy curry",
        confidence: "high",
        reasoning: "Caused loose stool.",
      },
    ],
    mealPlan: [
      {
        meal: "Breakfast",
        items: ["toast", "banana"],
        reasoning: "Gentle start.",
      },
    ],
    suggestions: ["Drink more water", "Try smaller meals"],
  };

  it("parses a fully valid AI response", () => {
    const result = parseAiInsight(FULL_VALID_RESPONSE);
    expect(result).not.toBeNull();
    expect(result?.summary).toBe("Your digestion looks stable.");
    expect(result?.directResponseToUser).toBe("Great progress today!");
    expect(result?.suspectedCulprits).toHaveLength(1);
    expect(result?.mealPlan).toHaveLength(1);
    expect(result?.suggestions).toEqual(["Drink more water", "Try smaller meals"]);
    expect(result?.educationalInsight?.topic).toBe("Gastrocolic reflex");
  });

  // ── Null / non-object rejection ───────────────────────────────────────────

  it("returns null for null input", () => {
    expect(parseAiInsight(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(parseAiInsight(undefined)).toBeNull();
  });

  it("returns null for a string input", () => {
    expect(parseAiInsight("not an object")).toBeNull();
  });

  it("returns null for a number input", () => {
    expect(parseAiInsight(42)).toBeNull();
  });

  it("returns null for an array input", () => {
    expect(parseAiInsight([1, 2, 3])).toBeNull();
  });

  // ── Empty / minimal object ──────────────────────────────────────────────

  it("handles a completely empty object with safe defaults", () => {
    const result = parseAiInsight({});
    expect(result).not.toBeNull();
    expect(result?.summary).toBe("No summary available.");
    expect(result?.directResponseToUser).toBeNull();
    expect(result?.educationalInsight).toBeNull();
    expect(result?.suspectedCulprits).toEqual([]);
    expect(result?.mealPlan).toEqual([]);
    expect(result?.suggestions).toEqual([]);
  });

  // ── Malformed field handling ────────────────────────────────────────────

  it("defaults summary when not a string", () => {
    const result = parseAiInsight({ summary: 123 });
    expect(result?.summary).toBe("No summary available.");
  });

  it("defaults directResponseToUser to null when not a string", () => {
    const result = parseAiInsight({ directResponseToUser: 42 });
    expect(result?.directResponseToUser).toBeNull();
  });

  it("defaults educationalInsight to null when topic or fact is missing", () => {
    const result = parseAiInsight({
      educationalInsight: { topic: "Hydration" },
    });
    expect(result?.educationalInsight).toBeNull();
  });

  // ── Array field filtering ─────────────────────────────────────────────

  it("filters malformed entries from suspectedCulprits", () => {
    const result = parseAiInsight({
      suspectedCulprits: [
        { food: "Curry", confidence: "high", reasoning: "Caused issues" },
        { food: "Bread" }, // missing confidence + reasoning
        "not an object",
        null,
        { confidence: "low", reasoning: "Missing food field" }, // missing food
      ],
    });
    expect(result?.suspectedCulprits).toHaveLength(1);
    expect(result?.suspectedCulprits[0].food).toBe("Curry");
  });

  it("filters malformed entries from mealPlan", () => {
    const result = parseAiInsight({
      mealPlan: [
        { meal: "Breakfast", items: ["toast"], reasoning: "Gentle" },
        { meal: "Lunch", items: "not an array", reasoning: "Bad" },
        { meal: "Dinner" }, // missing items + reasoning
      ],
    });
    expect(result?.mealPlan).toHaveLength(1);
    expect(result?.mealPlan[0].meal).toBe("Breakfast");
  });

  it("filters non-string entries from suggestions", () => {
    const result = parseAiInsight({
      suggestions: ["Drink water", 42, null, "Rest more", undefined],
    });
    expect(result?.suggestions).toEqual(["Drink water", "Rest more"]);
  });

  it("defaults suggestions to empty array when not an array", () => {
    const result = parseAiInsight({ suggestions: "not an array" });
    expect(result?.suggestions).toEqual([]);
  });

  // ── Shape contract: output always satisfies AiNutritionistInsight ─────

  it("output always has all required keys even with garbage input", () => {
    const result = parseAiInsight({ random: "junk", number: 42 });
    expect(result).not.toBeNull();
    const keys: (keyof AiNutritionistInsight)[] = [
      "directResponseToUser",
      "summary",
      "educationalInsight",
      "suspectedCulprits",
      "mealPlan",
      "suggestions",
    ];
    for (const key of keys) {
      expect(result).toHaveProperty(key);
    }
  });
});

// ─── Helpers for partial-day context tests ─────────────────────────────────

function makeFoodLog(timestamp: number, items: Array<{ name: string }>): FoodLog {
  return {
    timestamp,
    time: new Date(timestamp).toISOString(),
    items: items.map((i) => ({
      name: i.name,
      canonicalName: null,
      quantity: null,
      unit: null,
    })),
  };
}

function makeBowelEvent(timestamp: number): BowelEvent {
  return {
    timestamp,
    time: new Date(timestamp).toISOString(),
    bristolCode: 4,
    consistency: "smooth",
    urgency: "normal",
    effort: "normal",
    volume: "normal",
    accident: false,
    episodes: 1,
    notes: "",
  };
}

// ─── buildPartialDayContext ────────────────────────────────────────────────

describe("buildPartialDayContext", () => {
  it("includes reportGeneratedAt", () => {
    const now = new Date("2026-03-17T14:30:00");
    const result = buildPartialDayContext([], [], now);
    expect(result.reportGeneratedAt).toBeDefined();
    expect(typeof result.reportGeneratedAt).toBe("string");
  });

  it("includes partialDayNote when before noon", () => {
    const morning = new Date("2026-03-17T08:00:00");
    const result = buildPartialDayContext([], [], morning);
    expect(result.partialDayNote).toContain("early in the day");
  });

  it("omits partialDayNote when after noon", () => {
    const afternoon = new Date("2026-03-17T14:00:00");
    const result = buildPartialDayContext([], [], afternoon);
    expect(result.partialDayNote).toBeUndefined();
  });

  it("reports no BM when bowelEvents is empty", () => {
    const now = new Date("2026-03-17T14:00:00");
    const result = buildPartialDayContext([], [], now);
    expect(result.timeSinceLastBowelMovement).toBe(
      "No bowel movements recorded in the data window.",
    );
  });

  it("reports hours since last BM", () => {
    const now = new Date("2026-03-17T14:00:00");
    const bmTime = now.getTime() - 5 * MS_PER_HOUR;
    const bowelEvents = [makeBowelEvent(bmTime)];
    const result = buildPartialDayContext([], bowelEvents, now);
    expect(result.timeSinceLastBowelMovement).toBe("5 hours");
  });

  it("lists foods in transit eaten after last BM and more than 6h ago", () => {
    const now = new Date("2026-03-17T20:00:00");
    const nowMs = now.getTime();
    const bmAt6am = makeBowelEvent(nowMs - 14 * MS_PER_HOUR); // 06:00
    const foodAt8am = makeFoodLog(nowMs - 12 * MS_PER_HOUR, [{ name: "Toast" }]); // 08:00
    const foodAt10am = makeFoodLog(nowMs - 10 * MS_PER_HOUR, [{ name: "Banana" }]); // 10:00

    const result = buildPartialDayContext([foodAt8am, foodAt10am], [bmAt6am], now);
    const inTransit = result.foodsCurrentlyInTransit;
    expect(Array.isArray(inTransit)).toBe(true);
    const transitArr = inTransit as string[];
    expect(transitArr).toHaveLength(2);
    // Most recent first (reversed order)
    expect(transitArr[0]).toContain("Banana");
    expect(transitArr[1]).toContain("Toast");
  });

  it("excludes foods eaten less than 6h ago", () => {
    const now = new Date("2026-03-17T14:00:00");
    const nowMs = now.getTime();
    const recentFood = makeFoodLog(nowMs - 3 * MS_PER_HOUR, [{ name: "Soup" }]);

    const result = buildPartialDayContext([recentFood], [], now);
    expect(result.foodsCurrentlyInTransit).toBeUndefined();
  });

  it("excludes foods eaten before last BM", () => {
    const now = new Date("2026-03-17T20:00:00");
    const nowMs = now.getTime();
    const foodBefore = makeFoodLog(nowMs - 12 * MS_PER_HOUR, [{ name: "Rice" }]);
    const bmAfter = makeBowelEvent(nowMs - 10 * MS_PER_HOUR);

    const result = buildPartialDayContext([foodBefore], [bmAfter], now);
    expect(result.foodsCurrentlyInTransit).toBeUndefined();
  });

  it("caps in-transit items at 10", () => {
    const now = new Date("2026-03-17T20:00:00");
    const nowMs = now.getTime();
    const foods: FoodLog[] = [];
    for (let i = 0; i < 15; i++) {
      foods.push(makeFoodLog(nowMs - (7 + i) * MS_PER_HOUR, [{ name: `Food ${i}` }]));
    }
    // Sort ascending by timestamp (as buildUserMessage provides)
    foods.sort((a, b) => a.timestamp - b.timestamp);

    const result = buildPartialDayContext(foods, [], now);
    const inTransit = result.foodsCurrentlyInTransit as string[];
    expect(inTransit).toHaveLength(10);
  });

  it("handles empty food logs with BM data", () => {
    const now = new Date("2026-03-17T14:00:00");
    const bowelEvents = [makeBowelEvent(now.getTime() - 2 * MS_PER_HOUR)];
    const result = buildPartialDayContext([], bowelEvents, now);
    expect(result.timeSinceLastBowelMovement).toBe("2 hours");
    expect(result.foodsCurrentlyInTransit).toBeUndefined();
  });

  it("handles food logs with no items (empty items array)", () => {
    const now = new Date("2026-03-17T20:00:00");
    const nowMs = now.getTime();
    const emptyFood = makeFoodLog(nowMs - 10 * MS_PER_HOUR, []);

    const result = buildPartialDayContext([emptyFood], [], now);
    expect(result.foodsCurrentlyInTransit).toBeUndefined();
  });
});

// ─── buildUserMessage partialDayContext integration ────────────────────────

describe("buildUserMessage", () => {
  const EMPTY_RECENT_EVENTS: RecentEventsResult = {
    foodLogs: [],
    bowelEvents: [],
    habitLogs: [],
    fluidLogs: [],
    activityLogs: [],
  };

  it("includes partialDayContext in the output JSON", () => {
    const result = buildUserMessage({
      recentEvents: EMPTY_RECENT_EVENTS,
      patientSnapshot: {},
      deltaSignals: {},
      foodContext: {},
      hasPreviousResponse: false,
      patientMessages: [],

      suggestionHistory: [],
      weeklyContext: [],
    });
    const parsed = JSON.parse(result) as Record<string, unknown>;
    expect(parsed.partialDayContext).toBeDefined();
    const ctx = parsed.partialDayContext as Record<string, unknown>;
    expect(ctx.reportGeneratedAt).toBeDefined();
    expect(ctx.timeSinceLastBowelMovement).toBe("No bowel movements recorded in the data window.");
  });

  it("includes time since last BM in partialDayContext", () => {
    const now = Date.now();
    const bm = makeBowelEvent(now - 3 * MS_PER_HOUR);
    const result = buildUserMessage({
      recentEvents: { ...EMPTY_RECENT_EVENTS, bowelEvents: [bm] },
      patientSnapshot: {},
      deltaSignals: {},
      foodContext: {},
      hasPreviousResponse: false,
      patientMessages: [],

      suggestionHistory: [],
      weeklyContext: [],
    });
    const parsed = JSON.parse(result) as Record<string, unknown>;
    const ctx = parsed.partialDayContext as Record<string, unknown>;
    expect(ctx.timeSinceLastBowelMovement).toBe("3 hours");
  });

  it("includes patient snapshot and food context in the output JSON", () => {
    const result = buildUserMessage({
      recentEvents: EMPTY_RECENT_EVENTS,
      patientSnapshot: {
        daysSinceReversal: 30,
        surgeryType: "Ileostomy reversal",
      },
      deltaSignals: { bristolChangeFromYesterday: -0.5 },
      foodContext: { activeFoodTrials: [], recentSafe: ["toast"] },
      hasPreviousResponse: false,
      patientMessages: [],

      suggestionHistory: [],
      weeklyContext: [],
    });
    const parsed = JSON.parse(result) as Record<string, unknown>;
    expect(parsed.patient).toBeDefined();
    const patient = parsed.patient as Record<string, unknown>;
    expect(patient.daysSinceReversal).toBe(30);
    expect(parsed.deltas).toBeDefined();
    expect(parsed.foodContext).toBeDefined();
  });

  it("nests recent events under recentEvents key", () => {
    const foodLog = makeFoodLog(Date.now(), [{ name: "Toast" }]);
    const bm = makeBowelEvent(Date.now() - MS_PER_HOUR);
    const result = buildUserMessage({
      recentEvents: {
        ...EMPTY_RECENT_EVENTS,
        foodLogs: [foodLog],
        bowelEvents: [bm],
      },
      patientSnapshot: {},
      deltaSignals: {},
      foodContext: {},
      hasPreviousResponse: false,
      patientMessages: [],

      suggestionHistory: [],
      weeklyContext: [],
    });
    const parsed = JSON.parse(result) as Record<string, unknown>;
    const events = parsed.recentEvents as Record<string, unknown>;
    expect(events.bowelMovements).toBeDefined();
    expect(events.foodsEaten).toBeDefined();
  });
});

// ─── getFoodWindowHours ─────────────────────────────────────────────────────

describe("getFoodWindowHours", () => {
  const BASE_PROFILE: HealthProfile = {
    gender: "",
    ageYears: null,
    surgeryType: "Other",
    surgeryTypeOther: "",
    surgeryDate: "",
    height: null,
    startingWeight: null,
    currentWeight: null,
    targetWeight: null,
    comorbidities: [],
    otherConditions: "",
    medications: "",
    supplements: "",
    allergies: "",
    intolerances: "",
    dietaryHistory: "",
    smokingStatus: "",
    smokingCigarettesPerDay: null,
    smokingYears: null,
    alcoholUse: "",
    alcoholAmountPerSession: "",
    alcoholFrequency: "",
    alcoholYearsAtCurrentLevel: null,
    recreationalDrugUse: "",
    recreationalCategories: [],
    recreationalStimulantsFrequency: "",
    recreationalStimulantsYears: null,
    recreationalDepressantsFrequency: "",
    recreationalDepressantsYears: null,
    lifestyleNotes: "",
  };

  it("returns 48h for ileostomy reversal", () => {
    expect(
      getFoodWindowHours({
        ...BASE_PROFILE,
        surgeryType: "Ileostomy reversal",
      }),
    ).toBe(48);
  });

  it("returns 72h for colostomy reversal", () => {
    expect(
      getFoodWindowHours({
        ...BASE_PROFILE,
        surgeryType: "Colostomy reversal",
      }),
    ).toBe(72);
  });

  it("returns 72h for Other surgery type", () => {
    expect(getFoodWindowHours(BASE_PROFILE)).toBe(72);
  });

  it("adds 24h for opioid medications", () => {
    const profile = {
      ...BASE_PROFILE,
      medications: "codeine (opioid), paracetamol",
    };
    expect(getFoodWindowHours(profile)).toBe(96); // 72 + 24
  });

  it("adds 24h for iron medications", () => {
    const profile = {
      ...BASE_PROFILE,
      medications: "Iron supplements",
    };
    expect(getFoodWindowHours(profile)).toBe(96); // 72 + 24
  });

  it("caps at 96h", () => {
    const profile = {
      ...BASE_PROFILE,
      medications: "opioid pain medication, iron supplements",
    };
    // 72 + 24 = 96, capped at 96
    expect(getFoodWindowHours(profile)).toBe(96);
  });
});

// ─── computeBristolTrend ──────────────────────────────────────────────────────

describe("computeBristolTrend", () => {
  it("returns insufficient data with fewer than 2 weeks", () => {
    expect(computeBristolTrend([])).toBe("insufficient data");
    expect(
      computeBristolTrend([
        {
          weekStart: "2026-03-10",
          avgBristolScore: 4.5,
          totalBowelEvents: 10,
          accidentCount: 0,
          uniqueFoodsEaten: 5,
          newFoodsTried: 1,
          foodsCleared: 0,
          foodsFlagged: 0,
        },
      ]),
    ).toBe("insufficient data");
  });

  it("returns stable when scores are close", () => {
    const result = computeBristolTrend([
      {
        weekStart: "2026-03-03",
        avgBristolScore: 4.2,
        totalBowelEvents: 10,
        accidentCount: 0,
        uniqueFoodsEaten: 5,
        newFoodsTried: 1,
        foodsCleared: 0,
        foodsFlagged: 0,
      },
      {
        weekStart: "2026-03-10",
        avgBristolScore: 4.3,
        totalBowelEvents: 10,
        accidentCount: 0,
        uniqueFoodsEaten: 5,
        newFoodsTried: 1,
        foodsCleared: 0,
        foodsFlagged: 0,
      },
    ]);
    expect(result).toContain("stable");
  });

  it("returns improving when trending from loose to firmer", () => {
    const result = computeBristolTrend([
      {
        weekStart: "2026-03-03",
        avgBristolScore: 6.3,
        totalBowelEvents: 10,
        accidentCount: 0,
        uniqueFoodsEaten: 5,
        newFoodsTried: 1,
        foodsCleared: 0,
        foodsFlagged: 0,
      },
      {
        weekStart: "2026-03-10",
        avgBristolScore: 5.4,
        totalBowelEvents: 10,
        accidentCount: 0,
        uniqueFoodsEaten: 5,
        newFoodsTried: 1,
        foodsCleared: 0,
        foodsFlagged: 0,
      },
      {
        weekStart: "2026-03-17",
        avgBristolScore: 4.5,
        totalBowelEvents: 10,
        accidentCount: 0,
        uniqueFoodsEaten: 5,
        newFoodsTried: 1,
        foodsCleared: 0,
        foodsFlagged: 0,
      },
    ]);
    expect(result).toContain("improving");
  });

  it("skips weeks with null Bristol scores", () => {
    const result = computeBristolTrend([
      {
        weekStart: "2026-03-03",
        avgBristolScore: 6.0,
        totalBowelEvents: 10,
        accidentCount: 0,
        uniqueFoodsEaten: 5,
        newFoodsTried: 1,
        foodsCleared: 0,
        foodsFlagged: 0,
      },
      {
        weekStart: "2026-03-10",
        avgBristolScore: null,
        totalBowelEvents: 0,
        accidentCount: 0,
        uniqueFoodsEaten: 0,
        newFoodsTried: 0,
        foodsCleared: 0,
        foodsFlagged: 0,
      },
      {
        weekStart: "2026-03-17",
        avgBristolScore: 4.5,
        totalBowelEvents: 10,
        accidentCount: 0,
        uniqueFoodsEaten: 5,
        newFoodsTried: 1,
        foodsCleared: 0,
        foodsFlagged: 0,
      },
    ]);
    // Should still work with 2 valid weeks
    expect(result).toContain("improving");
  });
});

// ─── Shared test helpers ────────────────────────────────────────────────────

/**
 * Base HealthProfile for tests. Spread and override as needed.
 * Defined once here so all new describe blocks can reuse it.
 */
const BASE_PROFILE: HealthProfile = {
  gender: "",
  ageYears: null,
  surgeryType: "Other",
  surgeryTypeOther: "",
  surgeryDate: "",
  height: null,
  startingWeight: null,
  currentWeight: null,
  targetWeight: null,
  comorbidities: [],
  otherConditions: "",
  medications: "",
  supplements: "",
  allergies: "",
  intolerances: "",
  dietaryHistory: "",
  smokingStatus: "",
  smokingCigarettesPerDay: null,
  smokingYears: null,
  alcoholUse: "",
  alcoholAmountPerSession: "",
  alcoholFrequency: "",
  alcoholYearsAtCurrentLevel: null,
  recreationalDrugUse: "",
  recreationalCategories: [],
  recreationalStimulantsFrequency: "",
  recreationalStimulantsYears: null,
  recreationalDepressantsFrequency: "",
  recreationalDepressantsYears: null,
  lifestyleNotes: "",
};

/** Create a minimal food LogEntry for testing. */
function makeLogEntryFood(
  timestamp: number,
  items: Array<{
    name: string;
    canonicalName?: string | null;
    quantity?: number | null;
    unit?: string | null;
  }>,
): LogEntry {
  return {
    id: `food-${timestamp}`,
    timestamp,
    type: "food",
    data: {
      items: items.map((i) => ({
        name: i.name,
        canonicalName: i.canonicalName ?? null,
        quantity: i.quantity ?? null,
        unit: i.unit ?? null,
      })),
    },
  };
}

/** Create a minimal digestion LogEntry for testing. */
function makeLogEntryDigestion(
  timestamp: number,
  bristolCode: 1 | 2 | 3 | 4 | 5 | 6 | 7,
): LogEntry {
  return {
    id: `digestion-${timestamp}`,
    timestamp,
    type: "digestion",
    data: {
      bristolCode,
    },
  };
}

/** Create a minimal habit LogEntry for testing. */
function makeLogEntryHabit(
  timestamp: number,
  habitId: string,
  name: string,
  quantity: number = 1,
): LogEntry {
  return {
    id: `habit-${timestamp}-${habitId}`,
    timestamp,
    type: "habit",
    data: {
      habitId,
      name,
      habitType: "count",
      quantity,
    },
  };
}

/** Create a minimal fluid LogEntry for testing. */
function makeLogEntryFluid(
  timestamp: number,
  name: string = "water",
  quantity: number = 250,
): LogEntry {
  return {
    id: `fluid-${timestamp}`,
    timestamp,
    type: "fluid",
    data: {
      items: [{ name, quantity, unit: "ml" }],
    },
  };
}

/** Create a minimal activity LogEntry for testing. */
function makeLogEntryActivity(timestamp: number, activityType: string = "walking"): LogEntry {
  return {
    id: `activity-${timestamp}`,
    timestamp,
    type: "activity",
    data: {
      activityType,
    },
  };
}

/** Create a FoodTrialSummaryInput for testing. */
function makeFoodTrial(
  overrides: Partial<FoodTrialSummaryInput> & {
    canonicalName: string;
    displayName: string;
  },
): FoodTrialSummaryInput {
  return {
    currentStatus: "testing",
    totalAssessments: 3,
    culpritCount: 0,
    safeCount: 0,
    latestReasoning: "test reasoning",
    lastAssessedAt: Date.now(),
    ...overrides,
  };
}

/** Create a WeeklyContext for testing. */
function makeWeeklyDigest(
  overrides: Partial<WeeklyContext> & { weekStart: string },
): WeeklyContext {
  return {
    avgBristolScore: 4.0,
    totalBowelEvents: 10,
    accidentCount: 0,
    uniqueFoodsEaten: 5,
    newFoodsTried: 1,
    foodsCleared: 0,
    foodsFlagged: 0,
    ...overrides,
  };
}

// ─── getFoodWindowHours (additional edge cases) ─────────────────────────────

describe("getFoodWindowHours (edge cases)", () => {
  it("returns 72h for colectomy with ileostomy (not ileostomy reversal)", () => {
    expect(
      getFoodWindowHours({
        ...BASE_PROFILE,
        surgeryType: "Colectomy with ileostomy",
      }),
    ).toBe(72);
  });

  it("returns 72h for colectomy with colostomy (not colostomy reversal)", () => {
    expect(
      getFoodWindowHours({
        ...BASE_PROFILE,
        surgeryType: "Colectomy with colostomy",
      }),
    ).toBe(72);
  });

  it("returns 72h for colectomy with primary anastomosis", () => {
    expect(
      getFoodWindowHours({
        ...BASE_PROFILE,
        surgeryType: "Colectomy with primary anastomosis",
      }),
    ).toBe(72);
  });

  it("does not add modifier for empty medications string", () => {
    expect(
      getFoodWindowHours({
        ...BASE_PROFILE,
        medications: "",
      }),
    ).toBe(72);
  });

  it("does not add modifier for medications without opioid or iron", () => {
    expect(
      getFoodWindowHours({
        ...BASE_PROFILE,
        medications: "paracetamol, omeprazole",
      }),
    ).toBe(72);
  });

  it("applies single +24h modifier even when both opioid and iron are present", () => {
    // hasSlowTransitModifier is a boolean — multiple matches still produce one +24h
    expect(
      getFoodWindowHours({
        ...BASE_PROFILE,
        medications: "opioid painkillers, iron tablets",
      }),
    ).toBe(96); // 72 + 24
  });
});

// ─── buildPatientSnapshot ─────────────────────────────────────────────────────

describe("buildPatientSnapshot", () => {
  it("includes daysSinceReversal when surgeryDate is set", () => {
    const pastDate = new Date(Date.now() - 30 * MS_PER_DAY).toISOString().slice(0, 10);
    const result = buildPatientSnapshot({ ...BASE_PROFILE, surgeryDate: pastDate }, [], []);
    expect(result.daysSinceReversal).toBe(30);
  });

  it("omits daysSinceReversal when surgeryDate is empty", () => {
    const result = buildPatientSnapshot({ ...BASE_PROFILE, surgeryDate: "" }, [], []);
    expect(result.daysSinceReversal).toBeUndefined();
  });

  it("splits medications into array", () => {
    const result = buildPatientSnapshot(
      { ...BASE_PROFILE, medications: "paracetamol, ibuprofen, omeprazole" },
      [],
      [],
    );
    expect(result.medications).toEqual(["paracetamol", "ibuprofen", "omeprazole"]);
  });

  it("omits medications when empty string", () => {
    const result = buildPatientSnapshot({ ...BASE_PROFILE, medications: "" }, [], []);
    expect(result.medications).toBeUndefined();
  });

  it("includes Bristol trend from weekly digests", () => {
    const digests: WeeklyContext[] = [
      makeWeeklyDigest({ weekStart: "2026-03-03", avgBristolScore: 6.0 }),
      makeWeeklyDigest({ weekStart: "2026-03-10", avgBristolScore: 4.5 }),
    ];
    const result = buildPatientSnapshot(BASE_PROFILE, [], digests);
    expect(result.currentBristolTrend).toContain("improving");
  });

  it("returns insufficient data for Bristol trend with no digests", () => {
    const result = buildPatientSnapshot(BASE_PROFILE, [], []);
    expect(result.currentBristolTrend).toBe("insufficient data");
  });

  it("includes food trial counts by status", () => {
    const trials: FoodTrialSummaryInput[] = [
      makeFoodTrial({
        canonicalName: "toast",
        displayName: "Toast",
        currentStatus: "testing",
        primaryStatus: "testing",
      }),
      makeFoodTrial({
        canonicalName: "rice",
        displayName: "Rice",
        currentStatus: "safe",
        primaryStatus: "safe",
      }),
      makeFoodTrial({
        canonicalName: "banana",
        displayName: "Banana",
        currentStatus: "safe",
        primaryStatus: "safe",
      }),
      makeFoodTrial({
        canonicalName: "curry",
        displayName: "Curry",
        currentStatus: "watch",
        primaryStatus: "watch",
      }),
    ];
    const result = buildPatientSnapshot(BASE_PROFILE, trials, []);
    const counts = result.foodTrialCounts as Record<string, number>;
    expect(counts.testing).toBe(1);
    expect(counts.safe).toBe(2);
    expect(counts.watch).toBe(1);
  });

  it("omits foodTrialCounts when no trials", () => {
    const result = buildPatientSnapshot(BASE_PROFILE, [], []);
    expect(result.foodTrialCounts).toBeUndefined();
  });

  it("uses surgeryTypeOther when surgeryType is Other", () => {
    const result = buildPatientSnapshot(
      {
        ...BASE_PROFILE,
        surgeryType: "Other",
        surgeryTypeOther: "Hartmann reversal",
      },
      [],
      [],
    );
    expect(result.surgeryType).toBe("Hartmann reversal");
  });

  it("uses surgeryType directly when not Other", () => {
    const result = buildPatientSnapshot(
      {
        ...BASE_PROFILE,
        surgeryType: "Ileostomy reversal",
        surgeryTypeOther: "should be ignored",
      },
      [],
      [],
    );
    expect(result.surgeryType).toBe("Ileostomy reversal");
  });

  it("includes baselineTransitMinutes based on profile", () => {
    const result = buildPatientSnapshot(
      { ...BASE_PROFILE, surgeryType: "Ileostomy reversal" },
      [],
      [],
    );
    // 48h * 60 = 2880 minutes
    expect(result.baselineTransitMinutes).toBe(2880);
  });

  it("uses primaryStatus over currentStatus for trial counts", () => {
    const trials: FoodTrialSummaryInput[] = [
      makeFoodTrial({
        canonicalName: "toast",
        displayName: "Toast",
        currentStatus: "testing",
        primaryStatus: "safe",
      }),
    ];
    const result = buildPatientSnapshot(BASE_PROFILE, trials, []);
    const counts = result.foodTrialCounts as Record<string, number>;
    expect(counts.safe).toBe(1);
    expect(counts.testing).toBeUndefined();
  });
});

// ─── buildDeltaSignals ────────────────────────────────────────────────────────

describe("buildDeltaSignals", () => {
  describe("bristolChangeFromYesterday (computeBristolChange)", () => {
    it("returns difference when logs exist for today and yesterday", () => {
      const now = Date.now();
      const todayStart = now - (now % MS_PER_DAY);
      const yesterdayMid = todayStart - MS_PER_DAY / 2;
      const todayMid = todayStart + MS_PER_DAY / 4;

      const logs: LogEntry[] = [
        makeLogEntryDigestion(yesterdayMid, 5),
        makeLogEntryDigestion(todayMid, 3),
      ];

      const result = buildDeltaSignals(logs, []);
      // today avg (3) - yesterday avg (5) = -2
      expect(result.bristolChangeFromYesterday).toBe(-2);
    });

    it("returns null when only today's logs exist", () => {
      const now = Date.now();
      const todayStart = now - (now % MS_PER_DAY);
      const todayMid = todayStart + MS_PER_DAY / 4;

      const logs: LogEntry[] = [makeLogEntryDigestion(todayMid, 4)];
      const result = buildDeltaSignals(logs, []);
      expect(result.bristolChangeFromYesterday).toBeNull();
    });

    it("returns null when no digestion logs exist", () => {
      const result = buildDeltaSignals([], []);
      expect(result.bristolChangeFromYesterday).toBeNull();
    });

    it("uses average when multiple BMs per day", () => {
      const now = Date.now();
      const todayStart = now - (now % MS_PER_DAY);
      const yesterdayMid = todayStart - MS_PER_DAY / 2;
      const todayEarly = todayStart + MS_PER_HOUR;
      const todayLate = todayStart + 4 * MS_PER_HOUR;

      const logs: LogEntry[] = [
        makeLogEntryDigestion(yesterdayMid, 4),
        makeLogEntryDigestion(todayEarly, 3),
        makeLogEntryDigestion(todayLate, 5),
      ];

      const result = buildDeltaSignals(logs, []);
      // today avg (3+5)/2=4 - yesterday avg (4) = 0
      expect(result.bristolChangeFromYesterday).toBe(0);
    });

    it("ignores invalid Bristol codes", () => {
      const now = Date.now();
      const todayStart = now - (now % MS_PER_DAY);
      const yesterdayMid = todayStart - MS_PER_DAY / 2;
      const todayMid = todayStart + MS_PER_HOUR;

      const logs: LogEntry[] = [
        makeLogEntryDigestion(yesterdayMid, 5),
        // biome-ignore lint/suspicious/noExplicitAny: Intentional boundary test with invalid Bristol value
        makeLogEntryDigestion(todayMid, 0 as any), // invalid: below 1
      ];

      const result = buildDeltaSignals(logs, []);
      // today's 0 is invalid and skipped, so no today scores -> null
      expect(result.bristolChangeFromYesterday).toBeNull();
    });
  });

  describe("recentCulpritExposure (findRecentCulpritExposure)", () => {
    it("returns food name when watch food is in recent logs", () => {
      const now = Date.now();
      const recentFoodLog = makeLogEntryFood(now - 2 * MS_PER_HOUR, [
        { name: "Spicy curry", canonicalName: "curry_spicy" },
      ]);

      const trials: FoodTrialSummaryInput[] = [
        makeFoodTrial({
          canonicalName: "curry_spicy",
          displayName: "Spicy Curry",
          currentStatus: "watch",
          primaryStatus: "watch",
        }),
      ];

      const result = buildDeltaSignals([recentFoodLog], trials);
      expect(result.recentCulpritExposure).toBe("Spicy Curry");
    });

    it("returns null when no matching food logs exist", () => {
      const trials: FoodTrialSummaryInput[] = [
        makeFoodTrial({
          canonicalName: "curry_spicy",
          displayName: "Spicy Curry",
          currentStatus: "watch",
          primaryStatus: "watch",
        }),
      ];

      // No food logs at all
      const result = buildDeltaSignals([], trials);
      expect(result.recentCulpritExposure).toBeNull();
    });

    it("does not return safe-status foods", () => {
      const now = Date.now();
      const recentFoodLog = makeLogEntryFood(now - 2 * MS_PER_HOUR, [
        { name: "Rice", canonicalName: "white_rice" },
      ]);

      const trials: FoodTrialSummaryInput[] = [
        makeFoodTrial({
          canonicalName: "white_rice",
          displayName: "White Rice",
          currentStatus: "safe",
          primaryStatus: "safe",
        }),
      ];

      const result = buildDeltaSignals([recentFoodLog], trials);
      expect(result.recentCulpritExposure).toBeNull();
    });

    it("returns food name for avoid-status food", () => {
      const now = Date.now();
      const recentFoodLog = makeLogEntryFood(now - 2 * MS_PER_HOUR, [
        { name: "Chilli", canonicalName: "chilli_pepper" },
      ]);

      const trials: FoodTrialSummaryInput[] = [
        makeFoodTrial({
          canonicalName: "chilli_pepper",
          displayName: "Chilli Pepper",
          currentStatus: "avoid",
          primaryStatus: "avoid",
        }),
      ];

      const result = buildDeltaSignals([recentFoodLog], trials);
      expect(result.recentCulpritExposure).toBe("Chilli Pepper");
    });

    it("does not return culprit from food log older than 24h", () => {
      const now = Date.now();
      const oldFoodLog = makeLogEntryFood(now - 25 * MS_PER_HOUR, [
        { name: "Spicy curry", canonicalName: "curry_spicy" },
      ]);

      const trials: FoodTrialSummaryInput[] = [
        makeFoodTrial({
          canonicalName: "curry_spicy",
          displayName: "Spicy Curry",
          currentStatus: "watch",
          primaryStatus: "watch",
        }),
      ];

      const result = buildDeltaSignals([oldFoodLog], trials);
      expect(result.recentCulpritExposure).toBeNull();
    });
  });

  describe("habitStreaks (computeHabitStreaks)", () => {
    it("returns streak of 3 for 3 consecutive days of logging", () => {
      const now = Date.now();
      const today = new Date(now).toISOString().slice(0, 10);
      const todayMs = new Date(today).getTime() + 8 * MS_PER_HOUR; // 8am today
      const yesterdayMs = todayMs - MS_PER_DAY;
      const twoDaysAgoMs = todayMs - 2 * MS_PER_DAY;

      const logs: LogEntry[] = [
        makeLogEntryHabit(twoDaysAgoMs, "habit_water", "Water"),
        makeLogEntryHabit(yesterdayMs, "habit_water", "Water"),
        makeLogEntryHabit(todayMs, "habit_water", "Water"),
      ];

      const result = buildDeltaSignals(logs, []);
      const streaks = result.habitStreaks as Record<string, number>;
      expect(streaks.Water).toBe(3);
    });

    it("resets streak when there is a gap in days", () => {
      const now = Date.now();
      const today = new Date(now).toISOString().slice(0, 10);
      const todayMs = new Date(today).getTime() + 8 * MS_PER_HOUR;
      const threeDaysAgoMs = todayMs - 3 * MS_PER_DAY; // gap: no log 2 days ago

      const logs: LogEntry[] = [
        makeLogEntryHabit(threeDaysAgoMs, "habit_water", "Water"),
        // No log 2 days ago
        // No log yesterday
        makeLogEntryHabit(todayMs, "habit_water", "Water"),
      ];

      const result = buildDeltaSignals(logs, []);
      const streaks = result.habitStreaks as Record<string, number>;
      // Streak is only 1 day (today) — not >= 2, so not included
      expect(streaks.Water).toBeUndefined();
    });

    it("does not return streak for single day of logging", () => {
      const now = Date.now();
      const today = new Date(now).toISOString().slice(0, 10);
      const todayMs = new Date(today).getTime() + 8 * MS_PER_HOUR;

      const logs: LogEntry[] = [makeLogEntryHabit(todayMs, "habit_water", "Water")];

      const result = buildDeltaSignals(logs, []);
      const streaks = result.habitStreaks as Record<string, number>;
      expect(streaks.Water).toBeUndefined();
    });

    it("tracks independent streaks for multiple habits", () => {
      const now = Date.now();
      const today = new Date(now).toISOString().slice(0, 10);
      const todayMs = new Date(today).getTime() + 8 * MS_PER_HOUR;
      const yesterdayMs = todayMs - MS_PER_DAY;
      const twoDaysAgoMs = todayMs - 2 * MS_PER_DAY;

      const logs: LogEntry[] = [
        // Water: 3-day streak
        makeLogEntryHabit(twoDaysAgoMs, "habit_water", "Water"),
        makeLogEntryHabit(yesterdayMs, "habit_water", "Water"),
        makeLogEntryHabit(todayMs, "habit_water", "Water"),
        // Walking: 2-day streak (yesterday + today only)
        makeLogEntryHabit(yesterdayMs, "habit_walking", "Walking"),
        makeLogEntryHabit(todayMs, "habit_walking", "Walking"),
      ];

      const result = buildDeltaSignals(logs, []);
      const streaks = result.habitStreaks as Record<string, number>;
      expect(streaks.Water).toBe(3);
      expect(streaks.Walking).toBe(2);
    });
  });

  describe("newFoodsThisWeek", () => {
    it("returns empty array (placeholder)", () => {
      const result = buildDeltaSignals([], []);
      expect(result.newFoodsThisWeek).toEqual([]);
    });
  });
});

// ─── buildFoodContext ───────────────────────────────────────────────────────

describe("buildFoodContext", () => {
  it("includes only testing/building status in activeFoodTrials", () => {
    const trials: FoodTrialSummaryInput[] = [
      makeFoodTrial({
        canonicalName: "toast",
        displayName: "Toast",
        currentStatus: "testing",
        primaryStatus: "testing",
        totalAssessments: 2,
      }),
      makeFoodTrial({
        canonicalName: "rice",
        displayName: "Rice",
        currentStatus: "building",
        primaryStatus: "building",
        totalAssessments: 4,
      }),
      makeFoodTrial({
        canonicalName: "banana",
        displayName: "Banana",
        currentStatus: "safe",
        primaryStatus: "safe",
        totalAssessments: 10,
      }),
      makeFoodTrial({
        canonicalName: "curry",
        displayName: "Curry",
        currentStatus: "watch",
        primaryStatus: "watch",
        totalAssessments: 3,
      }),
    ];

    const result = buildFoodContext(trials, [], BASE_PROFILE);
    const active = result.activeFoodTrials as Array<{ food: string }>;
    expect(active).toHaveLength(2);
    expect(active.map((a) => a.food)).toContain("Toast");
    expect(active.map((a) => a.food)).toContain("Rice");
    expect(active.map((a) => a.food)).not.toContain("Banana");
    expect(active.map((a) => a.food)).not.toContain("Curry");
  });

  it("includes only safe status in recentSafe, max 10, sorted by lastAssessedAt", () => {
    const now = Date.now();
    const trials: FoodTrialSummaryInput[] = [];

    // Create 12 safe trials
    for (let i = 0; i < 12; i++) {
      trials.push(
        makeFoodTrial({
          canonicalName: `food_${i}`,
          displayName: `Food ${i}`,
          currentStatus: "safe",
          primaryStatus: "safe",
          lastAssessedAt: now - i * MS_PER_HOUR, // most recent first
        }),
      );
    }

    const result = buildFoodContext(trials, [], BASE_PROFILE);
    const safe = result.recentSafe as string[];
    expect(safe).toHaveLength(10);
    // Most recently assessed should be first
    expect(safe[0]).toBe("Food 0");
    expect(safe[9]).toBe("Food 9");
  });

  it("includes only watch/avoid status in recentFlags, max 5", () => {
    const now = Date.now();
    const trials: FoodTrialSummaryInput[] = [];

    // Create 7 watch/avoid trials
    for (let i = 0; i < 7; i++) {
      trials.push(
        makeFoodTrial({
          canonicalName: `culprit_${i}`,
          displayName: `Culprit ${i}`,
          currentStatus: i % 2 === 0 ? "watch" : "avoid",
          primaryStatus: i % 2 === 0 ? "watch" : "avoid",
          lastAssessedAt: now - i * MS_PER_HOUR,
        }),
      );
    }

    const result = buildFoodContext(trials, [], BASE_PROFILE);
    const flags = result.recentFlags as Array<{ food: string; status: string }>;
    expect(flags).toHaveLength(5);
  });

  it("includes stillInTransit for foods beyond event window but within learned transit", () => {
    const now = Date.now();
    // Food eaten 80h ago (beyond 72h food window for "Other" surgery)
    const oldFoodLog = makeLogEntryFood(now - 80 * MS_PER_HOUR, [
      { name: "Oats", canonicalName: "oats" },
    ]);

    const trials: FoodTrialSummaryInput[] = [
      makeFoodTrial({
        canonicalName: "oats",
        displayName: "Oats",
        currentStatus: "testing",
        learnedTransitCenterMinutes: 90 * 60, // 90 hours center
        learnedTransitSpreadMinutes: 6 * 60, // 6 hours spread
      }),
    ];

    const result = buildFoodContext(trials, [oldFoodLog], BASE_PROFILE);
    expect(result.stillInTransit).toBeDefined();
    const transit = result.stillInTransit as string[];
    expect(transit).toContain("Oats");
  });

  it("omits stillInTransit when no foods are beyond event window", () => {
    const result = buildFoodContext([], [], BASE_PROFILE);
    expect(result.stillInTransit).toBeUndefined();
  });

  it("returns nextToTry as the building food with most assessments", () => {
    const trials: FoodTrialSummaryInput[] = [
      makeFoodTrial({
        canonicalName: "toast",
        displayName: "Toast",
        currentStatus: "building",
        primaryStatus: "building",
        totalAssessments: 3,
      }),
      makeFoodTrial({
        canonicalName: "rice",
        displayName: "Rice",
        currentStatus: "building",
        primaryStatus: "building",
        totalAssessments: 7,
      }),
      makeFoodTrial({
        canonicalName: "banana",
        displayName: "Banana",
        currentStatus: "testing",
        primaryStatus: "testing",
        totalAssessments: 10,
      }),
    ];

    const result = buildFoodContext(trials, [], BASE_PROFILE);
    expect(result.nextToTry).toBe("Rice");
  });

  it("returns no nextToTry when no building-status trials exist", () => {
    const trials: FoodTrialSummaryInput[] = [
      makeFoodTrial({
        canonicalName: "rice",
        displayName: "Rice",
        currentStatus: "safe",
        primaryStatus: "safe",
      }),
    ];

    const result = buildFoodContext(trials, [], BASE_PROFILE);
    expect(result.nextToTry).toBeUndefined();
  });

  it("returns empty arrays/undefined when no trials exist", () => {
    const result = buildFoodContext([], [], BASE_PROFILE);
    expect(result.activeFoodTrials).toEqual([]);
    expect(result.recentSafe).toEqual([]);
    expect(result.recentFlags).toEqual([]);
    expect(result.stillInTransit).toBeUndefined();
    expect(result.nextToTry).toBeUndefined();
  });
});

// ─── buildRecentEvents ────────────────────────────────────────────────────────

describe("buildRecentEvents", () => {
  it("includes food logs within food window", () => {
    const now = Date.now();
    const recentFood = makeLogEntryFood(now - 10 * MS_PER_HOUR, [
      { name: "Toast", canonicalName: "toast" },
    ]);

    const result = buildRecentEvents([recentFood], BASE_PROFILE);
    expect(result.foodLogs).toHaveLength(1);
    expect(result.foodLogs[0].items[0].name).toBe("Toast");
  });

  it("excludes food logs outside food window", () => {
    const now = Date.now();
    // 73h ago exceeds the 72h window for "Other" surgery type
    const oldFood = makeLogEntryFood(now - 73 * MS_PER_HOUR, [
      { name: "Toast", canonicalName: "toast" },
    ]);

    const result = buildRecentEvents([oldFood], BASE_PROFILE);
    expect(result.foodLogs).toHaveLength(0);
  });

  it("includes BM logs within 48h window", () => {
    const now = Date.now();
    const recentBM = makeLogEntryDigestion(now - 24 * MS_PER_HOUR, 4);

    const result = buildRecentEvents([recentBM], BASE_PROFILE);
    expect(result.bowelEvents).toHaveLength(1);
    expect(result.bowelEvents[0].bristolCode).toBe(4);
  });

  it("excludes BM logs outside 48h window", () => {
    const now = Date.now();
    const oldBM = makeLogEntryDigestion(now - 49 * MS_PER_HOUR, 4);

    const result = buildRecentEvents([oldBM], BASE_PROFILE);
    expect(result.bowelEvents).toHaveLength(0);
  });

  it("includes habit logs within 24h window", () => {
    const now = Date.now();
    const recentHabit = makeLogEntryHabit(now - 12 * MS_PER_HOUR, "habit_water", "Water");

    const result = buildRecentEvents([recentHabit], BASE_PROFILE);
    expect(result.habitLogs).toHaveLength(1);
  });

  it("excludes habit logs outside 24h window", () => {
    const now = Date.now();
    const oldHabit = makeLogEntryHabit(now - 25 * MS_PER_HOUR, "habit_water", "Water");

    const result = buildRecentEvents([oldHabit], BASE_PROFILE);
    expect(result.habitLogs).toHaveLength(0);
  });

  it("includes fluid logs within 24h window", () => {
    const now = Date.now();
    const recentFluid = makeLogEntryFluid(now - 12 * MS_PER_HOUR);

    const result = buildRecentEvents([recentFluid], BASE_PROFILE);
    expect(result.fluidLogs).toHaveLength(1);
  });

  it("excludes fluid logs outside 24h window", () => {
    const now = Date.now();
    const oldFluid = makeLogEntryFluid(now - 25 * MS_PER_HOUR);

    const result = buildRecentEvents([oldFluid], BASE_PROFILE);
    expect(result.fluidLogs).toHaveLength(0);
  });

  it("uses 48h food window for ileostomy reversal", () => {
    const now = Date.now();
    const profile: HealthProfile = {
      ...BASE_PROFILE,
      surgeryType: "Ileostomy reversal",
    };
    // 50h ago: outside ileostomy 48h window, inside colostomy 72h window
    const foodLog = makeLogEntryFood(now - 50 * MS_PER_HOUR, [
      { name: "Toast", canonicalName: "toast" },
    ]);

    const result = buildRecentEvents([foodLog], profile);
    expect(result.foodLogs).toHaveLength(0);
  });

  it("uses 72h food window for colostomy reversal", () => {
    const now = Date.now();
    const profile: HealthProfile = {
      ...BASE_PROFILE,
      surgeryType: "Colostomy reversal",
    };
    // 50h ago: within 72h window
    const foodLog = makeLogEntryFood(now - 50 * MS_PER_HOUR, [
      { name: "Toast", canonicalName: "toast" },
    ]);

    const result = buildRecentEvents([foodLog], profile);
    expect(result.foodLogs).toHaveLength(1);
  });

  it("handles mixed log types with different windows", () => {
    const now = Date.now();
    const logs: LogEntry[] = [
      // 30h ago — within food window (72h) but outside habit/fluid window (24h)
      makeLogEntryFood(now - 30 * MS_PER_HOUR, [{ name: "Toast", canonicalName: "toast" }]),
      makeLogEntryHabit(now - 30 * MS_PER_HOUR, "habit_water", "Water"),
      makeLogEntryFluid(now - 30 * MS_PER_HOUR),
      // 10h ago — within all windows
      makeLogEntryDigestion(now - 10 * MS_PER_HOUR, 4),
    ];

    const result = buildRecentEvents(logs, BASE_PROFILE);
    expect(result.foodLogs).toHaveLength(1); // 30h within 72h window
    expect(result.habitLogs).toHaveLength(0); // 30h outside 24h window
    expect(result.fluidLogs).toHaveLength(0); // 30h outside 24h window
    expect(result.bowelEvents).toHaveLength(1); // 10h within 48h window
  });

  it("includes activity logs within 24h window", () => {
    const now = Date.now();
    const recentActivity = makeLogEntryActivity(now - 12 * MS_PER_HOUR);

    const result = buildRecentEvents([recentActivity], BASE_PROFILE);
    expect(result.activityLogs).toHaveLength(1);
  });

  it("excludes activity logs outside 24h window", () => {
    const now = Date.now();
    const oldActivity = makeLogEntryActivity(now - 25 * MS_PER_HOUR);

    const result = buildRecentEvents([oldActivity], BASE_PROFILE);
    expect(result.activityLogs).toHaveLength(0);
  });

  it("returns empty arrays when no logs are provided", () => {
    const result = buildRecentEvents([], BASE_PROFILE);
    expect(result.foodLogs).toEqual([]);
    expect(result.bowelEvents).toEqual([]);
    expect(result.habitLogs).toEqual([]);
    expect(result.fluidLogs).toEqual([]);
    expect(result.activityLogs).toEqual([]);
  });

  it("filters out unknown_food items from food logs", () => {
    const now = Date.now();
    const foodLog = makeLogEntryFood(now - 1 * MS_PER_HOUR, [
      { name: "Toast", canonicalName: "toast" },
      { name: "Mystery item", canonicalName: "unknown_food" },
    ]);

    const result = buildRecentEvents([foodLog], BASE_PROFILE);
    expect(result.foodLogs).toHaveLength(1);
    // Only Toast should remain (unknown_food filtered out)
    expect(result.foodLogs[0].items).toHaveLength(1);
    expect(result.foodLogs[0].items[0].name).toBe("Toast");
  });

  it("sorts food logs ascending by timestamp", () => {
    const now = Date.now();
    const food1 = makeLogEntryFood(now - 5 * MS_PER_HOUR, [{ name: "Toast" }]);
    const food2 = makeLogEntryFood(now - 2 * MS_PER_HOUR, [{ name: "Rice" }]);
    const food3 = makeLogEntryFood(now - 8 * MS_PER_HOUR, [{ name: "Banana" }]);

    // Provide in non-sorted order
    const result = buildRecentEvents([food2, food3, food1], BASE_PROFILE);
    expect(result.foodLogs[0].items[0].name).toBe("Banana");
    expect(result.foodLogs[1].items[0].name).toBe("Toast");
    expect(result.foodLogs[2].items[0].name).toBe("Rice");
  });
});
