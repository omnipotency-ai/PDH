import { describe, expect, it } from "vitest";
import {
  buildFoodEvidenceResult,
  countRecentConsecutiveGoodTrials,
  type FoodEvidenceLog,
  type FoodEvidenceTrial,
  type HabitLike,
  INITIAL_GRADUATION_TRIALS,
  RECOVERY_GRADUATION_TRIALS,
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

function digestionLog(id: string, timestamp: number, bristolCode: number): FoodEvidenceLog {
  return {
    id,
    timestamp,
    type: "digestion",
    data: {
      bristolCode,
      episodesCount: 1,
    },
  };
}

function buildDailyTrialSeries(args: {
  foodName: string;
  trialCount: number;
  transitHours: number;
  bristolCodes: number[];
}): {
  habits: HabitLike[];
  logs: FoodEvidenceLog[];
} {
  const habits: HabitLike[] = [];
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
  }

  return { habits, logs };
}

// ── Constants ─────────────────────────────────────────────────────────────────

describe("evidence threshold constants", () => {
  it("INITIAL_GRADUATION_TRIALS is 5", () => {
    expect(INITIAL_GRADUATION_TRIALS).toBe(5);
  });

  it("RECOVERY_GRADUATION_TRIALS is 3", () => {
    expect(RECOVERY_GRADUATION_TRIALS).toBe(3);
  });
});

// ── countRecentConsecutiveGoodTrials ──────────────────────────────────────────

describe("countRecentConsecutiveGoodTrials", () => {
  it("returns 0 for empty trials array", () => {
    expect(countRecentConsecutiveGoodTrials([])).toBe(0);
  });

  it("counts all trials when all are good", () => {
    const trials: FoodEvidenceTrial[] = [
      makeTrial({ outcome: "good", bristolCode: 4 }),
      makeTrial({ outcome: "good", bristolCode: 4 }),
      makeTrial({ outcome: "good", bristolCode: 3 }),
    ];
    expect(countRecentConsecutiveGoodTrials(trials)).toBe(3);
  });

  it("stops counting at first non-good outcome", () => {
    const trials: FoodEvidenceTrial[] = [
      makeTrial({ outcome: "good", bristolCode: 4 }),
      makeTrial({ outcome: "good", bristolCode: 5 }),
      makeTrial({ outcome: "bad", bristolCode: 7 }),
      makeTrial({ outcome: "good", bristolCode: 4 }),
    ];
    expect(countRecentConsecutiveGoodTrials(trials)).toBe(2);
  });

  it("returns 0 when the most recent trial is bad", () => {
    const trials: FoodEvidenceTrial[] = [
      makeTrial({ outcome: "bad", bristolCode: 7 }),
      makeTrial({ outcome: "good", bristolCode: 4 }),
      makeTrial({ outcome: "good", bristolCode: 4 }),
    ];
    expect(countRecentConsecutiveGoodTrials(trials)).toBe(0);
  });

  it("stops counting at a loose outcome", () => {
    const trials: FoodEvidenceTrial[] = [
      makeTrial({ outcome: "good", bristolCode: 4 }),
      makeTrial({ outcome: "loose", bristolCode: 6 }),
      makeTrial({ outcome: "good", bristolCode: 4 }),
    ];
    expect(countRecentConsecutiveGoodTrials(trials)).toBe(1);
  });

  it("stops counting at a hard outcome", () => {
    const trials: FoodEvidenceTrial[] = [
      makeTrial({ outcome: "good", bristolCode: 4 }),
      makeTrial({ outcome: "hard", bristolCode: 2 }),
      makeTrial({ outcome: "good", bristolCode: 4 }),
    ];
    expect(countRecentConsecutiveGoodTrials(trials)).toBe(1);
  });

  it("handles null bristolCode gracefully (trusts outcome field)", () => {
    const trials: FoodEvidenceTrial[] = [
      makeTrial({ outcome: "good", bristolCode: null }),
      makeTrial({ outcome: "good", bristolCode: null }),
    ];
    expect(countRecentConsecutiveGoodTrials(trials)).toBe(2);
  });

  it("stops counting when bristolCode is outside 3-5 even if outcome is good", () => {
    // Edge case: outcome says "good" but bristolCode is 2 (shouldn't happen in practice,
    // but the function should be defensive)
    const trials: FoodEvidenceTrial[] = [
      makeTrial({ outcome: "good", bristolCode: 4 }),
      makeTrial({ outcome: "good", bristolCode: 2 }),
    ];
    expect(countRecentConsecutiveGoodTrials(trials)).toBe(1);
  });
});

// ── Initial graduation threshold ─────────────────────────────────────────────

describe("initial graduation — 5 resolved trials", () => {
  it("stays building when both effective evidence is low AND trial count is below 5", () => {
    // A food with only 1 resolved trial via carry-forward (low reliability)
    // should stay building because both conditions are met:
    // effectiveEvidence < 1.5 AND resolvedTrialCount < 5
    const logs: FoodEvidenceLog[] = [
      foodLog("food-1", BASE_TIME, "Toast"),
      // Bowel event far outside expected window — carry-forward with low reliability
      digestionLog("digestion-1", BASE_TIME + 48 * HOUR, 4),
    ];

    const result = buildFoodEvidenceResult({
      logs,
      now: BASE_TIME + 3 * DAY,
    });
    const summary = result.summaries.find((item) => item.canonicalName === "toast");

    expect(summary).toBeDefined();
    expect(summary?.resolvedTrials).toBe(1);
    expect(summary?.primaryStatus).toBe("building");
  });

  it("graduates to safe at exactly 5 good resolved trials", () => {
    const { logs } = buildDailyTrialSeries({
      foodName: "Toast",
      trialCount: 5,
      transitHours: 20,
      bristolCodes: [4, 4, 4, 4, 4],
    });

    const result = buildFoodEvidenceResult({
      logs,
      now: BASE_TIME + 6 * DAY,
    });
    const summary = result.summaries.find((item) => item.canonicalName === "toast");

    expect(summary).toBeDefined();
    expect(summary?.resolvedTrials).toBe(5);
    expect(summary?.primaryStatus).toBe("safe");
  });

  it("graduates at 6 resolved trials too (not just exactly 5)", () => {
    const { logs } = buildDailyTrialSeries({
      foodName: "Toast",
      trialCount: 6,
      transitHours: 20,
      bristolCodes: [4, 4, 4, 4, 4, 4],
    });

    const result = buildFoodEvidenceResult({
      logs,
      now: BASE_TIME + 7 * DAY,
    });
    const summary = result.summaries.find((item) => item.canonicalName === "toast");

    expect(summary).toBeDefined();
    expect(summary?.resolvedTrials).toBe(6);
    expect(summary?.primaryStatus).toBe("safe");
  });

  it("the 5-trial gate keeps food in building when evidence is decayed and trial count is below 5", () => {
    // A single trial from far in the past — recency decay makes effective evidence low.
    // Combined with trial count below 5, the food stays building.
    const veryOldTime = BASE_TIME - 120 * DAY; // 120 days ago — heavy decay
    const logs: FoodEvidenceLog[] = [
      foodLog("food-old", veryOldTime, "Toast"),
      digestionLog("digestion-old", veryOldTime + 20 * HOUR, 4),
    ];

    const result = buildFoodEvidenceResult({
      logs,
      now: BASE_TIME,
    });
    const summary = result.summaries.find((item) => item.canonicalName === "toast");

    expect(summary).toBeDefined();
    expect(summary?.resolvedTrials).toBe(1);
    // Old trial with heavy recency decay + below 5 trials = building
    expect(summary?.primaryStatus).toBe("building");
  });
});

// ── Recovery path ────────────────────────────────────────────────────────────

describe("recovery path — food can recover from negative status", () => {
  it("food with avoid status recovers after 3 consecutive good recent trials", () => {
    // First: 3 bad trials to establish "avoid" status
    // Then: 3 good trials to trigger recovery
    const bristolCodes = [7, 7, 7, 4, 4, 4];
    const { logs } = buildDailyTrialSeries({
      foodName: "Hot Sauce",
      trialCount: 6,
      transitHours: 20,
      bristolCodes,
    });

    const result = buildFoodEvidenceResult({
      logs,
      now: BASE_TIME + 7 * DAY,
    });
    const summary = result.summaries.find((item) => item.canonicalName === "hot sauce");

    expect(summary).toBeDefined();
    expect(summary?.resolvedTrials).toBe(6);
    // The 3 most recent trials are good — recovery should kick in
    expect(summary?.primaryStatus).toBe("safe");
  });

  it("food with watch status recovers after 3 consecutive good recent trials", () => {
    // Mixed bad outcomes to push toward watch, then 3 good trials
    const bristolCodes = [7, 6, 6, 4, 4, 4];
    const { logs } = buildDailyTrialSeries({
      foodName: "Hot Sauce",
      trialCount: 6,
      transitHours: 20,
      bristolCodes,
    });

    const result = buildFoodEvidenceResult({
      logs,
      now: BASE_TIME + 7 * DAY,
    });
    const summary = result.summaries.find((item) => item.canonicalName === "hot sauce");

    expect(summary).toBeDefined();
    expect(summary?.resolvedTrials).toBe(6);
    // With 3 recent good trials, the food should recover
    expect(summary?.primaryStatus).toBe("safe");
  });

  it("food with fewer than 3 good trials after avoid stays avoid", () => {
    // 3 bad trials (avoid), then only 2 good trials
    const bristolCodes = [7, 7, 7, 4, 4];
    const { logs } = buildDailyTrialSeries({
      foodName: "Hot Sauce",
      trialCount: 5,
      transitHours: 20,
      bristolCodes,
    });

    const result = buildFoodEvidenceResult({
      logs,
      now: BASE_TIME + 6 * DAY,
    });
    const summary = result.summaries.find((item) => item.canonicalName === "hot sauce");

    expect(summary).toBeDefined();
    expect(summary?.resolvedTrials).toBe(5);
    // Only 2 recent good trials — not enough for recovery
    expect(summary?.primaryStatus).not.toBe("safe");
  });

  it("recovery requires consecutive good trials — a bad trial in between resets the count", () => {
    // 3 bad, 2 good, 1 bad, 2 good = only 2 consecutive recent good
    const bristolCodes = [7, 7, 7, 4, 4, 7, 4, 4];
    const { logs } = buildDailyTrialSeries({
      foodName: "Hot Sauce",
      trialCount: 8,
      transitHours: 20,
      bristolCodes,
    });

    const result = buildFoodEvidenceResult({
      logs,
      now: BASE_TIME + 9 * DAY,
    });
    const summary = result.summaries.find((item) => item.canonicalName === "hot sauce");

    expect(summary).toBeDefined();
    // Most recent 2 trials are good, but the 3rd-most-recent is bad
    // So recentConsecutiveGoodTrials = 2, which is < 3
    expect(summary?.primaryStatus).not.toBe("safe");
  });

  it("recovery path does not apply when evidence is too low and trials below 5", () => {
    // A single carry-forward trial (low reliability) stays building
    // even though the trial is "good" — because building requires BOTH
    // low effective evidence AND fewer than 5 trials
    const logs: FoodEvidenceLog[] = [
      foodLog("food-1", BASE_TIME, "Toast"),
      digestionLog("digestion-1", BASE_TIME + 48 * HOUR, 4),
    ];

    const result = buildFoodEvidenceResult({
      logs,
      now: BASE_TIME + 3 * DAY,
    });
    const summary = result.summaries.find((item) => item.canonicalName === "toast");

    expect(summary).toBeDefined();
    expect(summary?.resolvedTrials).toBe(1);
    // Low evidence + below 5 trials = building, recovery can't apply here
    expect(summary?.primaryStatus).toBe("building");
  });

  it("food with enough evidence but fewer than 5 trials graduates normally (building gate requires both conditions)", () => {
    // 4 well-resolved trials have enough effective evidence to exceed 1.5,
    // so the food graduates even though trial count is below 5.
    // This verifies the AND condition: building requires BOTH conditions.
    const { logs } = buildDailyTrialSeries({
      foodName: "Toast",
      trialCount: 4,
      transitHours: 20,
      bristolCodes: [4, 4, 4, 4],
    });

    const result = buildFoodEvidenceResult({
      logs,
      now: BASE_TIME + 5 * DAY,
    });
    const summary = result.summaries.find((item) => item.canonicalName === "toast");

    expect(summary).toBeDefined();
    expect(summary?.resolvedTrials).toBe(4);
    // Effective evidence > 1.5 with 4 trials, so building gate doesn't apply
    expect(summary?.primaryStatus).toBe("safe");
  });
});

// ── Dead code removal verification ──────────────────────────────────────────
// MIN_RESOLVED_TRIALS was deleted from src/lib/foodStatusThresholds.ts (WQ-049).
// Verified by: if it were re-exported, importing it would produce a compile error
// since the constant no longer exists. No runtime test needed.

// ── Helper ───────────────────────────────────────────────────────────────────

function makeTrial(overrides: {
  outcome: FoodEvidenceTrial["outcome"];
  bristolCode: number | null;
}): FoodEvidenceTrial {
  return {
    trialId: `trial-${Math.random().toString(36).slice(2)}`,
    canonicalName: "test_food",
    foodName: "Test Food",
    foodTimestamp: BASE_TIME,
    bowelTimestamp: BASE_TIME + 20 * HOUR,
    transitMinutes: 20 * 60,
    resolutionMode: "expected_window",
    outcome: overrides.outcome,
    bristolCode: overrides.bristolCode,
    negativeWeight: overrides.outcome === "bad" ? 1 : overrides.outcome === "good" ? 0 : 0.35,
    modifierDeltaMinutes: 0,
    modifierReliability: 1,
    severe: overrides.outcome === "bad",
  };
}
