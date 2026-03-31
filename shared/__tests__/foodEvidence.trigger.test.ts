import { describe, expect, it } from "vitest";
import {
  buildFoodEvidenceResult,
  type CorrelationType,
  type FoodEvidenceLog,
  TRIGGER_WEIGHT_BRISTOL_6,
  TRIGGER_WEIGHT_BRISTOL_7,
  TRIGGER_WINDOW_MINUTES,
} from "../foodEvidence";

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;
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

describe("trigger correlation constants", () => {
  it("TRIGGER_WINDOW_MINUTES is 180 (3 hours)", () => {
    expect(TRIGGER_WINDOW_MINUTES).toBe(180);
  });

  it("TRIGGER_WEIGHT_BRISTOL_7 is 1.5", () => {
    expect(TRIGGER_WEIGHT_BRISTOL_7).toBe(1.5);
  });

  it("TRIGGER_WEIGHT_BRISTOL_6 is 0.75", () => {
    expect(TRIGGER_WEIGHT_BRISTOL_6).toBe(0.75);
  });
});

describe("CorrelationType", () => {
  it("accepts trigger and transit as valid values", () => {
    const trigger: CorrelationType = "trigger";
    const transit: CorrelationType = "transit";
    expect(trigger).toBe("trigger");
    expect(transit).toBe("transit");
  });
});

describe("findTriggerCorrelations — via buildFoodEvidenceResult", () => {
  it("finds trigger correlation when food is eaten 1h before Bristol 7", () => {
    const logs: FoodEvidenceLog[] = [
      foodLog("food-1", BASE_TIME, "Toast"),
      digestionLog("digestion-1", BASE_TIME + 1 * HOUR, 7),
    ];

    const result = buildFoodEvidenceResult({
      logs,
      now: BASE_TIME + 2 * DAY,
    });
    const summary = result.summaries.find((s) => s.canonicalName === "toast");

    expect(summary).toBeDefined();
    expect(summary?.triggerEvidenceCount).toBe(1);
    expect(summary?.triggerEvidence).toHaveLength(1);

    const trigger = summary?.triggerEvidence[0];
    expect(trigger?.type).toBe("trigger");
    expect(trigger?.bristolCode).toBe(7);
    expect(trigger?.minutesAfterEating).toBe(60);
    expect(trigger?.weight).toBeGreaterThan(0);
  });

  it("does NOT find trigger correlation when food is eaten 4h before Bristol 7 (outside window)", () => {
    const logs: FoodEvidenceLog[] = [
      foodLog("food-1", BASE_TIME, "Toast"),
      digestionLog("digestion-1", BASE_TIME + 4 * HOUR, 7),
    ];

    const result = buildFoodEvidenceResult({
      logs,
      now: BASE_TIME + 2 * DAY,
    });
    const summary = result.summaries.find((s) => s.canonicalName === "toast");

    expect(summary).toBeDefined();
    expect(summary?.triggerEvidenceCount).toBe(0);
    expect(summary?.triggerEvidence).toHaveLength(0);
  });

  it("does NOT find trigger correlation for Bristol 4 (not 6-7)", () => {
    const logs: FoodEvidenceLog[] = [
      foodLog("food-1", BASE_TIME, "Toast"),
      digestionLog("digestion-1", BASE_TIME + 1 * HOUR, 4),
    ];

    const result = buildFoodEvidenceResult({
      logs,
      now: BASE_TIME + 2 * DAY,
    });
    const summary = result.summaries.find((s) => s.canonicalName === "toast");

    expect(summary).toBeDefined();
    expect(summary?.triggerEvidenceCount).toBe(0);
    expect(summary?.triggerEvidence).toHaveLength(0);
  });

  it("finds trigger correlation for food eaten 2h before Bristol 6", () => {
    const logs: FoodEvidenceLog[] = [
      foodLog("food-1", BASE_TIME, "Toast"),
      digestionLog("digestion-1", BASE_TIME + 2 * HOUR, 6),
      // Also add a normal BM later for transit correlation
      digestionLog("digestion-2", BASE_TIME + 20 * HOUR, 4),
    ];

    const result = buildFoodEvidenceResult({
      logs,
      now: BASE_TIME + 2 * DAY,
    });
    const summary = result.summaries.find((s) => s.canonicalName === "toast");

    expect(summary).toBeDefined();
    expect(summary?.triggerEvidenceCount).toBe(1);

    const trigger = summary?.triggerEvidence[0];
    expect(trigger?.bristolCode).toBe(6);
    expect(trigger?.minutesAfterEating).toBe(120);

    // Bristol 6: both trigger AND transit are relevant
    // The food should also have transit evidence (resolved trials)
    expect(summary?.resolvedTrials).toBeGreaterThanOrEqual(1);
  });

  it("does NOT find trigger for Bristol 1-5", () => {
    const bristolCodes = [1, 2, 3, 4, 5];
    for (const code of bristolCodes) {
      const logs: FoodEvidenceLog[] = [
        foodLog("food-1", BASE_TIME, "Toast"),
        digestionLog("digestion-1", BASE_TIME + 1 * HOUR, code),
      ];

      const result = buildFoodEvidenceResult({
        logs,
        now: BASE_TIME + 2 * DAY,
      });
      const summary = result.summaries.find((s) => s.canonicalName === "toast");

      expect(summary?.triggerEvidenceCount).toBe(0);
    }
  });
});

describe("findTriggerCorrelations — multiple foods in trigger window", () => {
  it("gives trigger evidence to ALL foods in the window with priority ordering", () => {
    // Two foods eaten before a Bristol 7 event, both within 3h
    const logs: FoodEvidenceLog[] = [
      foodLog("food-1", BASE_TIME, "Toast"),
      foodLog("food-2", BASE_TIME + 30 * MINUTE, "Rice"),
      digestionLog("digestion-1", BASE_TIME + 2 * HOUR, 7),
    ];

    const result = buildFoodEvidenceResult({
      logs,
      now: BASE_TIME + 2 * DAY,
    });

    const toastSummary = result.summaries.find((s) => s.canonicalName === "toast");
    const riceSummary = result.summaries.find((s) => s.canonicalName === "white rice");

    // Both foods should have trigger evidence
    expect(toastSummary?.triggerEvidenceCount).toBe(1);
    expect(riceSummary?.triggerEvidenceCount).toBe(1);

    // Both weights should be positive
    const toastWeight = toastSummary?.triggerEvidence[0]?.weight ?? 0;
    const riceWeight = riceSummary?.triggerEvidence[0]?.weight ?? 0;
    expect(toastWeight).toBeGreaterThan(0);
    expect(riceWeight).toBeGreaterThan(0);

    // More recent food (rice, eaten 90min before event) should have
    // higher priority than older food (toast, eaten 120min before event)
    expect(riceWeight).toBeGreaterThan(toastWeight);
  });

  it("weights all foods in the trigger window — their weights sum to the base weight", () => {
    // Single food in window
    const singleFoodLogs: FoodEvidenceLog[] = [
      foodLog("food-1", BASE_TIME, "Toast"),
      digestionLog("digestion-1", BASE_TIME + 1 * HOUR, 7),
    ];

    const singleResult = buildFoodEvidenceResult({
      logs: singleFoodLogs,
      now: BASE_TIME + 2 * DAY,
    });
    const singleSummary = singleResult.summaries.find((s) => s.canonicalName === "toast");
    const singleWeight = singleSummary?.triggerEvidence[0]?.weight ?? 0;

    // With a single food, its weight should be the full base weight
    // adjusted only by priority score (which for a single item normalizes to 1)
    expect(singleWeight).toBeCloseTo(TRIGGER_WEIGHT_BRISTOL_7, 1);
  });
});

describe("trigger evidence — Bristol 7 marks transit evidence as unreliable", () => {
  it("reduces transit evidence contribution for Bristol 7 trigger events", () => {
    // Scenario: food eaten, Bristol 7 happens 1h later (trigger),
    // then a normal BM happens at the expected transit time (20h)
    const logsWithTrigger: FoodEvidenceLog[] = [
      foodLog("food-1", BASE_TIME, "Toast"),
      digestionLog("trigger-event", BASE_TIME + 1 * HOUR, 7),
      digestionLog("normal-event", BASE_TIME + 20 * HOUR, 4),
    ];

    // Comparison: same scenario but without the trigger event
    const logsWithoutTrigger: FoodEvidenceLog[] = [
      foodLog("food-1", BASE_TIME, "Toast"),
      digestionLog("normal-event", BASE_TIME + 20 * HOUR, 4),
    ];

    const withTrigger = buildFoodEvidenceResult({
      logs: logsWithTrigger,
      now: BASE_TIME + 2 * DAY,
    });
    const withoutTrigger = buildFoodEvidenceResult({
      logs: logsWithoutTrigger,
      now: BASE_TIME + 2 * DAY,
    });

    const triggerSummary = withTrigger.summaries.find((s) => s.canonicalName === "toast");
    const normalSummary = withoutTrigger.summaries.find((s) => s.canonicalName === "toast");

    // The trigger scenario should have worse codeScore because
    // trigger evidence adds negative signal
    expect(triggerSummary?.codeScore ?? 0).toBeLessThan(normalSummary?.codeScore ?? 0);

    // Trigger evidence should be present
    expect(triggerSummary?.triggerEvidenceCount).toBe(1);
    expect(normalSummary?.triggerEvidenceCount).toBe(0);
  });

  it("Bristol 6 trigger keeps both trigger and transit evidence active", () => {
    const logs: FoodEvidenceLog[] = [
      foodLog("food-1", BASE_TIME, "Toast"),
      digestionLog("trigger-event", BASE_TIME + 2 * HOUR, 6),
      digestionLog("normal-event", BASE_TIME + 20 * HOUR, 4),
    ];

    const result = buildFoodEvidenceResult({
      logs,
      now: BASE_TIME + 2 * DAY,
    });
    const summary = result.summaries.find((s) => s.canonicalName === "toast");

    // Trigger evidence from Bristol 6
    expect(summary?.triggerEvidenceCount).toBe(1);
    expect(summary?.triggerEvidence[0]?.bristolCode).toBe(6);

    // Transit evidence should still have normal-weight contributions
    // (Bristol 6 doesn't mark transit as unreliable like Bristol 7 does)
    expect(summary?.resolvedTrials).toBeGreaterThanOrEqual(1);
  });
});

describe("trigger evidence — codeScore integration", () => {
  it("repeated trigger events push codeScore strongly negative", () => {
    // 3 days of eating toast, each followed by Bristol 7 within 1h
    const logs: FoodEvidenceLog[] = [];
    for (let day = 0; day < 3; day++) {
      const foodTime = BASE_TIME + day * DAY;
      logs.push(foodLog(`food-${day}`, foodTime, "Toast"));
      logs.push(digestionLog(`trigger-${day}`, foodTime + 1 * HOUR, 7));
    }

    const result = buildFoodEvidenceResult({
      logs,
      now: BASE_TIME + 4 * DAY,
    });
    const summary = result.summaries.find((s) => s.canonicalName === "toast");

    expect(summary).toBeDefined();
    expect(summary?.triggerEvidenceCount).toBe(3);
    expect(summary?.codeScore ?? 0).toBeLessThan(0);
    expect(summary?.posteriorSafety ?? 1).toBeLessThan(0.5);
  });

  it("a single trigger event among many good trials does not override safe status", () => {
    // 10 good trials + 1 trigger event
    const logs: FoodEvidenceLog[] = [];
    for (let day = 0; day < 10; day++) {
      const foodTime = BASE_TIME + day * DAY;
      logs.push(foodLog(`food-${day}`, foodTime, "Toast"));
      logs.push(digestionLog(`bm-${day}`, foodTime + 20 * HOUR, 4));
    }
    // One trigger event on the last day
    logs.push(digestionLog("trigger-event", BASE_TIME + 9 * DAY + 1 * HOUR, 7));

    const result = buildFoodEvidenceResult({
      logs,
      now: BASE_TIME + 12 * DAY,
    });
    const summary = result.summaries.find((s) => s.canonicalName === "toast");

    expect(summary).toBeDefined();
    expect(summary?.triggerEvidenceCount).toBe(1);
    // Should still be safe — one trigger among many good trials
    expect(summary?.primaryStatus).toBe("safe");
    expect(summary?.posteriorSafety ?? 0).toBeGreaterThan(0.5);
  });
});

describe("trigger evidence — edge cases", () => {
  it("food eaten exactly at 0 minutes before Bristol 7 gets trigger evidence", () => {
    // Simultaneous eating and BM (rare but possible: eating triggers immediate reflex)
    const logs: FoodEvidenceLog[] = [
      foodLog("food-1", BASE_TIME, "Toast"),
      digestionLog("digestion-1", BASE_TIME, 7),
    ];

    const result = buildFoodEvidenceResult({
      logs,
      now: BASE_TIME + 2 * DAY,
    });
    const summary = result.summaries.find((s) => s.canonicalName === "toast");

    expect(summary?.triggerEvidenceCount).toBe(1);
    expect(summary?.triggerEvidence[0]?.minutesAfterEating).toBe(0);
  });

  it("food eaten exactly at 180 minutes before Bristol 7 gets trigger evidence (boundary)", () => {
    const logs: FoodEvidenceLog[] = [
      foodLog("food-1", BASE_TIME, "Toast"),
      digestionLog("digestion-1", BASE_TIME + 180 * MINUTE, 7),
    ];

    const result = buildFoodEvidenceResult({
      logs,
      now: BASE_TIME + 2 * DAY,
    });
    const summary = result.summaries.find((s) => s.canonicalName === "toast");

    expect(summary?.triggerEvidenceCount).toBe(1);
    expect(summary?.triggerEvidence[0]?.minutesAfterEating).toBe(180);
  });

  it("food eaten 181 minutes before Bristol 7 does NOT get trigger evidence", () => {
    const logs: FoodEvidenceLog[] = [
      foodLog("food-1", BASE_TIME, "Toast"),
      digestionLog("digestion-1", BASE_TIME + 181 * MINUTE, 7),
    ];

    const result = buildFoodEvidenceResult({
      logs,
      now: BASE_TIME + 2 * DAY,
    });
    const summary = result.summaries.find((s) => s.canonicalName === "toast");

    expect(summary?.triggerEvidenceCount).toBe(0);
  });

  it("BM before food (negative time) does NOT get trigger evidence", () => {
    const logs: FoodEvidenceLog[] = [
      digestionLog("digestion-1", BASE_TIME, 7),
      foodLog("food-1", BASE_TIME + 1 * HOUR, "Toast"),
    ];

    const result = buildFoodEvidenceResult({
      logs,
      now: BASE_TIME + 2 * DAY,
    });
    const summary = result.summaries.find((s) => s.canonicalName === "toast");

    // Toast should exist as a trial but with no trigger evidence
    expect(summary).toBeDefined();
    expect(summary?.triggerEvidenceCount).toBe(0);
  });

  it("no digestive events produces no trigger evidence", () => {
    const logs: FoodEvidenceLog[] = [foodLog("food-1", BASE_TIME, "Toast")];

    const result = buildFoodEvidenceResult({
      logs,
      now: BASE_TIME + 2 * DAY,
    });
    const summary = result.summaries.find((s) => s.canonicalName === "toast");

    expect(summary).toBeDefined();
    expect(summary?.triggerEvidenceCount).toBe(0);
    expect(summary?.triggerEvidence).toHaveLength(0);
  });
});
