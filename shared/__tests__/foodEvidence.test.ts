import { describe, expect, it } from "vitest";
import {
  buildFoodEvidenceResult,
  type FoodAssessmentRecord,
  type FoodEvidenceLog,
  type HabitLike,
  normalizeAssessmentRecord,
} from "../foodEvidence";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const BASE_TIME = Date.UTC(2026, 0, 1, 8, 0, 0);

function foodLog(id: string, timestamp: number, name: string): FoodEvidenceLog {
  return {
    id,
    timestamp,
    type: "food",
    data: {
      items: [
        {
          name,
          canonicalName: name.toLowerCase(),
          quantity: 1,
          unit: "portion",
        },
      ],
    },
  };
}

function digestionLog(
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
  args: {
    habitId: string;
    name: string;
    quantity: number;
  },
): FoodEvidenceLog {
  return {
    id,
    timestamp,
    type: "habit",
    data: args,
  };
}

function activityLog(
  id: string,
  timestamp: number,
  args: {
    activityType: string;
    durationMinutes: number;
  },
): FoodEvidenceLog {
  return {
    id,
    timestamp,
    type: "activity",
    data: args,
  };
}

function buildDailyTrialSeries(args: {
  foodName: string;
  trialCount: number;
  transitHours: number;
  bristolCodes: number[];
  confoundedIndexes?: number[];
}): {
  habits: HabitLike[];
  logs: FoodEvidenceLog[];
} {
  const confoundedIndexes = new Set(args.confoundedIndexes ?? []);
  const habits: HabitLike[] = [{ id: "nicotine", name: "Nicotine" }];
  const logs: FoodEvidenceLog[] = [];

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

    if (confoundedIndexes.has(index)) {
      logs.push(
        habitLog(`habit-${index}`, foodAt + 30 * 60 * 1000, {
          habitId: "nicotine",
          name: "Nicotine",
          quantity: 5,
        }),
      );
    }
  }

  return { habits, logs };
}

describe("buildFoodEvidenceResult", () => {
  it("treats Bristol 1 as a severe constipated outcome", () => {
    const logs = [
      foodLog("food-1", BASE_TIME, "Beans"),
      digestionLog("digestion-1", BASE_TIME + 20 * HOUR, 1),
    ];

    const result = buildFoodEvidenceResult({
      logs,
      now: BASE_TIME + 2 * DAY,
    });
    const summary = result.summaries[0];

    expect(summary).toBeDefined();
    expect(summary?.trials).toHaveLength(1);
    expect(summary?.trials[0]?.outcome).toBe("bad");
    expect(summary?.trials[0]?.negativeWeight).toBe(1);
    expect(summary?.trials[0]?.severe).toBe(true);
  });

  it("enforces a 6-hour minimum transit floor even when learned calibration is shorter", () => {
    const logs = [
      foodLog("food-1", BASE_TIME, "Toast"),
      digestionLog("digestion-early", BASE_TIME + 3 * HOUR, 4),
      digestionLog("digestion-expected", BASE_TIME + 7 * HOUR, 4),
    ];

    const result = buildFoodEvidenceResult({
      logs,
      calibration: {
        source: "learned",
        centerMinutes: 120,
        spreadMinutes: 90,
        sampleSize: 8,
        learnedAt: BASE_TIME - DAY,
      },
      now: BASE_TIME + DAY,
    });
    const summary = result.summaries.find((item) => item.canonicalName === "toast");

    expect(summary).toBeDefined();
    expect(summary?.resolvedTrials).toBe(1);
    expect(summary?.trials[0]?.transitMinutes).toBe(7 * 60);
    expect(summary?.trials[0]?.bowelTimestamp).toBe(BASE_TIME + 7 * HOUR);
    expect(summary?.trials[0]?.resolutionMode).toBe("expected_window");
  });

  it("excludes assessment-only foods from summaries", () => {
    const logs = [
      foodLog("food-1", BASE_TIME, "Rice"),
      digestionLog("digestion-1", BASE_TIME + 20 * HOUR, 4),
    ];
    const assessments: FoodAssessmentRecord[] = [
      {
        canonicalName: "rice",
        foodName: "Rice",
        food: "Rice",
        verdict: "safe",
        confidence: "high",
        causalRole: "unlikely",
        changeType: "unchanged",
        modifierSummary: "",
        reasoning: "Stable.",
        reportTimestamp: BASE_TIME + HOUR,
      },
      {
        canonicalName: "dragon fruit",
        foodName: "Dragon Fruit",
        food: "Dragon Fruit",
        verdict: "safe",
        confidence: "high",
        causalRole: "unlikely",
        changeType: "unchanged",
        modifierSummary: "",
        reasoning: "Mentioned by AI only.",
        reportTimestamp: BASE_TIME + 2 * HOUR,
      },
    ];

    const result = buildFoodEvidenceResult({
      logs,
      assessments,
      now: BASE_TIME + 2 * DAY,
    });

    expect(result.summaries.map((item) => item.canonicalName)).toEqual(["white rice"]);
  });

  it("carries long-gap trials forward to the next bowel event with lower reliability", () => {
    const logs = [
      foodLog("food-1", BASE_TIME, "Rice"),
      digestionLog("digestion-1", BASE_TIME + 48 * HOUR, 1),
    ];

    const result = buildFoodEvidenceResult({
      logs,
      now: BASE_TIME + 3 * DAY,
    });
    const summary = result.summaries.find((item) => item.canonicalName === "white rice");

    expect(summary).toBeDefined();
    expect(summary?.totalTrials).toBe(1);
    expect(summary?.resolvedTrials).toBe(1);
    expect(summary?.trials[0]?.resolutionMode).toBe("carry_forward");
    expect(summary?.trials[0]?.transitMinutes).toBe(48 * 60);
    expect(summary?.trials[0]?.modifierReliability).toBeLessThan(0.7);
    expect(summary?.confidence).toBeLessThan(0.15);
  });

  it("keeps open trials unresolved when no later bowel event exists yet", () => {
    const logs = [foodLog("food-1", BASE_TIME, "Toast")];

    const result = buildFoodEvidenceResult({
      logs,
      now: BASE_TIME + 12 * HOUR,
    });
    const summary = result.summaries.find((item) => item.canonicalName === "toast");

    expect(summary).toBeDefined();
    expect(summary?.totalTrials).toBe(1);
    expect(summary?.resolvedTrials).toBe(0);
    expect(summary?.trials).toHaveLength(0);
    expect(summary?.confidence).toBe(0);
    expect(summary?.primaryStatus).toBe("building");
  });

  it("keeps a food safe after many clean trials and one confounded bad day", () => {
    const bristolCodes = Array.from({ length: 28 }, (_, index) => (index === 27 ? 7 : 4));
    const { logs, habits } = buildDailyTrialSeries({
      foodName: "Toast",
      trialCount: 28,
      transitHours: 20,
      bristolCodes,
      confoundedIndexes: [27],
    });
    logs.push(
      habitLog("habit-27-caffeine", BASE_TIME + 27 * DAY + HOUR, {
        habitId: "coffee",
        name: "Coffee",
        quantity: 1,
      }),
      activityLog("activity-27", BASE_TIME + 27 * DAY + 2 * HOUR, {
        activityType: "walk",
        durationMinutes: 45,
      }),
    );

    const result = buildFoodEvidenceResult({
      logs,
      habits,
      now: BASE_TIME + 29 * DAY,
    });
    const summary = result.summaries.find((item) => item.canonicalName === "toast");

    expect(summary).toBeDefined();
    expect(summary?.totalTrials).toBe(28);
    expect(summary?.resolvedTrials).toBe(28);
    expect(summary?.primaryStatus).toBe("safe");
    expect(summary?.posteriorSafety).toBeGreaterThan(0.75);
    expect(summary?.recentSuspect).toBe(false);
    expect(summary?.trials.at(0)?.modifierReliability).toBeLessThan(0.7);
  });

  it("keeps a food safe when one carried-forward bad trial follows repeated clean in-window trials", () => {
    const logs = [
      foodLog("food-1", BASE_TIME, "Toast"),
      digestionLog("digestion-1", BASE_TIME + 20 * HOUR, 4),
      foodLog("food-2", BASE_TIME + 2 * DAY, "Toast"),
      digestionLog("digestion-2", BASE_TIME + 2 * DAY + 20 * HOUR, 4),
      foodLog("food-3", BASE_TIME + 4 * DAY, "Toast"),
      digestionLog("digestion-3", BASE_TIME + 4 * DAY + 20 * HOUR, 4),
      foodLog("food-4", BASE_TIME + 6 * DAY, "Toast"),
      digestionLog("digestion-4", BASE_TIME + 6 * DAY + 20 * HOUR, 4),
      foodLog("food-5", BASE_TIME + 8 * DAY, "Toast"),
      digestionLog("digestion-5", BASE_TIME + 12 * DAY, 1),
    ];

    const result = buildFoodEvidenceResult({
      logs,
      now: BASE_TIME + 14 * DAY,
    });
    const summary = result.summaries.find((item) => item.canonicalName === "toast");

    expect(summary).toBeDefined();
    expect(summary?.resolvedTrials).toBe(5);
    expect(
      summary?.trials.filter((trial) => trial.resolutionMode === "carry_forward"),
    ).toHaveLength(1);
    expect(summary?.primaryStatus).toBe("safe");
    expect(summary?.posteriorSafety).toBeGreaterThan(0.7);
  });

  it("requires stronger evidence before Zone 3 foods graduate to safe", () => {
    const bristolCodes = [4, 7, 6, 7, 5];
    const toastSeries = buildDailyTrialSeries({
      foodName: "Toast",
      trialCount: 5,
      transitHours: 20,
      bristolCodes,
    });
    const biscoffSeries = buildDailyTrialSeries({
      foodName: "Biscoff",
      trialCount: 5,
      transitHours: 20,
      bristolCodes,
    });

    const toastResult = buildFoodEvidenceResult({
      logs: toastSeries.logs,
      habits: toastSeries.habits,
      now: BASE_TIME + 6 * DAY,
    });
    const biscoffResult = buildFoodEvidenceResult({
      logs: biscoffSeries.logs,
      habits: biscoffSeries.habits,
      now: BASE_TIME + 6 * DAY,
    });

    const toastSummary = toastResult.summaries.find((item) => item.canonicalName === "toast");
    const biscoffSummary = biscoffResult.summaries.find(
      (item) => item.canonicalName === "high-sugar refined snack",
    );

    expect(toastSummary?.primaryStatus).toBe("safe");
    expect(biscoffSummary?.primaryStatus).toBe("watch");
    expect(toastSummary?.posteriorSafety).toBeGreaterThan(biscoffSummary?.posteriorSafety ?? 0);
  });

  it("downgrades a food to avoid after repeated low-confounder bad trials", () => {
    const { logs } = buildDailyTrialSeries({
      foodName: "Hot Sauce",
      trialCount: 3,
      transitHours: 20,
      bristolCodes: [7, 7, 7],
    });

    const result = buildFoodEvidenceResult({
      logs,
      now: BASE_TIME + 4 * DAY,
    });
    const summary = result.summaries.find((item) => item.canonicalName === "hot sauce");

    expect(summary).toBeDefined();
    expect(summary?.primaryStatus).toBe("avoid");
    expect(summary?.posteriorSafety).toBeLessThan(0.45);
    expect(summary?.recentSuspect).toBe(true);
    expect(summary?.trials.every((trial) => trial.modifierReliability >= 0.7)).toBe(true);
  });

  it("switches transit calibration from default to learned after enough low-confounder samples", () => {
    const { logs } = buildDailyTrialSeries({
      foodName: "Rice",
      trialCount: 4,
      transitHours: 20,
      bristolCodes: [4, 4, 4, 4],
    });

    const result = buildFoodEvidenceResult({
      logs,
      now: BASE_TIME + 5 * DAY,
    });
    const summary = result.summaries.find((item) => item.canonicalName === "white rice");

    expect(result.transitCalibration.source).toBe("learned");
    expect(result.transitCalibration.sampleSize).toBe(4);
    expect(result.transitCalibration.centerMinutes).toBe(20 * 60);
    expect(result.transitCalibration.learnedAt).not.toBeNull();
    expect(summary?.learnedTransitCenterMinutes).toBe(20 * 60);
    expect(summary?.learnedTransitSpreadMinutes).toBeGreaterThanOrEqual(90);
  });

  it("excludes unknown_food items from trials and summaries", () => {
    const logs: FoodEvidenceLog[] = [
      {
        id: "food-1",
        timestamp: BASE_TIME,
        type: "food",
        data: {
          items: [
            {
              parsedName: "toast",
              userSegment: "toast",
              canonicalName: "toast",
              resolvedBy: "registry",
              quantity: 1,
              unit: null,
            },
            {
              parsedName: "xylofruit",
              userSegment: "xylofruit",
              canonicalName: "unknown_food",
              resolvedBy: "expired",
              quantity: null,
              unit: null,
            },
          ],
        },
      },
      digestionLog("digestion-1", BASE_TIME + 20 * HOUR, 4),
    ];

    const result = buildFoodEvidenceResult({
      logs,
      now: BASE_TIME + 2 * DAY,
    });

    // Only toast should appear — unknown_food is filtered out
    const canonicalNames = result.summaries.map((s) => s.canonicalName);
    expect(canonicalNames).toContain("toast");
    expect(canonicalNames).not.toContain("unknown_food");
    expect(result.summaries).toHaveLength(1);
  });

  it("excludes unknown_food items even when they have legacy field names", () => {
    const logs: FoodEvidenceLog[] = [
      {
        id: "food-1",
        timestamp: BASE_TIME,
        type: "food",
        data: {
          items: [
            {
              name: "banana",
              canonicalName: "banana",
              quantity: 1,
              unit: null,
            },
            {
              name: "mystery item",
              rawName: "mystery item",
              canonicalName: "unknown_food",
              quantity: null,
              unit: null,
            },
          ],
        },
      },
      digestionLog("digestion-1", BASE_TIME + 20 * HOUR, 4),
    ];

    const result = buildFoodEvidenceResult({
      logs,
      now: BASE_TIME + 2 * DAY,
    });

    const canonicalNames = result.summaries.map((s) => s.canonicalName);
    // "banana" resolves to "ripe banana" via the food registry
    expect(canonicalNames).toContain("ripe banana");
    expect(canonicalNames).not.toContain("unknown_food");
  });
});

describe("normalizeAssessmentRecord", () => {
  const TIMESTAMP = Date.UTC(2026, 0, 15, 12, 0, 0);

  it("normalizes a fully-specified assessment record", () => {
    const result = normalizeAssessmentRecord({
      food: "White Rice",
      verdict: "safe",
      confidence: "high",
      causalRole: "primary",
      changeType: "upgraded",
      modifierSummary: "No confounders present",
      reasoning: "Consistently good outcomes over 14 days.",
      reportTimestamp: TIMESTAMP,
    });

    expect(result.food).toBe("White Rice");
    expect(result.foodName).toBe("White Rice");
    expect(result.canonicalName).toBe("white rice");
    expect(result.verdict).toBe("safe");
    expect(result.confidence).toBe("high");
    expect(result.causalRole).toBe("primary");
    expect(result.changeType).toBe("upgraded");
    expect(result.modifierSummary).toBe("No confounders present");
    expect(result.reasoning).toBe("Consistently good outcomes over 14 days.");
    expect(result.reportTimestamp).toBe(TIMESTAMP);
  });

  it("defaults confidence to medium when omitted", () => {
    const result = normalizeAssessmentRecord({
      food: "Toast",
      verdict: "watch",
      reasoning: "Unclear pattern.",
      reportTimestamp: TIMESTAMP,
    });

    expect(result.confidence).toBe("medium");
  });

  it("defaults causalRole to possible when omitted", () => {
    const result = normalizeAssessmentRecord({
      food: "Toast",
      verdict: "watch",
      reasoning: "Unclear pattern.",
      reportTimestamp: TIMESTAMP,
    });

    expect(result.causalRole).toBe("possible");
  });

  it("defaults changeType to unchanged when omitted", () => {
    const result = normalizeAssessmentRecord({
      food: "Toast",
      verdict: "safe",
      reasoning: "Stable.",
      reportTimestamp: TIMESTAMP,
    });

    expect(result.changeType).toBe("unchanged");
  });

  it("defaults modifierSummary to empty string when omitted", () => {
    const result = normalizeAssessmentRecord({
      food: "Toast",
      verdict: "safe",
      reasoning: "Stable.",
      reportTimestamp: TIMESTAMP,
    });

    expect(result.modifierSummary).toBe("");
  });

  it("trims whitespace from food and reasoning", () => {
    const result = normalizeAssessmentRecord({
      food: "  Scrambled Egg  ",
      verdict: "safe",
      reasoning: "  Good tolerance observed.  ",
      reportTimestamp: TIMESTAMP,
    });

    expect(result.food).toBe("Scrambled Egg");
    expect(result.reasoning).toBe("Good tolerance observed.");
  });

  it("resolves a known food name to its canonical via the registry", () => {
    const result = normalizeAssessmentRecord({
      food: "Banana",
      verdict: "safe",
      reasoning: "Well tolerated.",
      reportTimestamp: TIMESTAMP,
    });

    // "banana" resolves to "ripe banana" in the food registry
    expect(result.canonicalName).toBe("ripe banana");
    expect(result.foodName).toBe("Banana");
  });

  it("falls back to normalizeFoodName for unrecognized foods", () => {
    const result = normalizeAssessmentRecord({
      food: "Dragon Fruit Smoothie",
      verdict: "trial_next",
      reasoning: "Not yet tried.",
      reportTimestamp: TIMESTAMP,
    });

    // Not in registry, so falls back to normalizeFoodName
    expect(result.canonicalName).toBe("dragon fruit smoothie");
    expect(result.foodName).toBe("Dragon Fruit Smoothie");
  });

  it("title-cases the foodName from raw input", () => {
    const result = normalizeAssessmentRecord({
      food: "grilled chicken breast",
      verdict: "safe",
      reasoning: "Fine.",
      reportTimestamp: TIMESTAMP,
    });

    expect(result.foodName).toBe("Grilled Chicken Breast");
  });
});
