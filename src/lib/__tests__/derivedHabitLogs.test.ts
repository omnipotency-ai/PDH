import { describe, expect, it } from "vitest";
import { rebuildHabitLogsFromSyncedLogs } from "../derivedHabitLogs";
import type { HabitConfig, HabitLog } from "../habitTemplates";
import { HABIT_TEMPLATES } from "../habitTemplates";
import type { SyncedLog } from "../sync";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal HabitConfig with sensible defaults, overridden by `overrides`. */
function makeHabit(
  overrides: Partial<HabitConfig> & Pick<HabitConfig, "id" | "name">,
): HabitConfig {
  return {
    kind: "positive",
    unit: "count",
    quickIncrement: 1,
    showOnTrack: true,
    color: "indigo",
    createdAt: 0,
    habitType: "count",
    ...overrides,
  };
}

/** Build a SyncedLog of type "habit". */
function makeHabitLog(
  id: string,
  timestamp: number,
  data: {
    habitId?: string;
    name?: string;
    habitType?: string;
    quantity?: number;
    action?: string;
  },
): SyncedLog {
  return {
    id,
    timestamp,
    type: "habit",
    data: {
      habitId: data.habitId ?? "",
      name: data.name ?? "",
      habitType: data.habitType ?? "",
      ...("quantity" in data && data.quantity !== undefined ? { quantity: data.quantity } : {}),
      ...("action" in data && data.action !== undefined ? { action: data.action } : {}),
    },
  };
}

/** Build a SyncedLog of type "fluid". */
function makeFluidLog(
  id: string,
  timestamp: number,
  items: Array<{ name: string; quantity: number; unit: string }>,
): SyncedLog {
  return {
    id,
    timestamp,
    type: "fluid",
    data: { items },
  };
}

/** Build a SyncedLog of type "activity". */
function makeActivityLog(
  id: string,
  timestamp: number,
  data: { activityType: string; durationMinutes?: number; feelTag?: string },
): SyncedLog {
  return {
    id,
    timestamp,
    type: "activity",
    data: {
      activityType: data.activityType,
      ...(data.durationMinutes !== undefined ? { durationMinutes: data.durationMinutes } : {}),
      ...(data.feelTag !== undefined ? { feelTag: data.feelTag } : {}),
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("rebuildHabitLogsFromSyncedLogs", () => {
  // ── Empty input ──────────────────────────────────────────────────────────

  describe("empty inputs", () => {
    it("returns empty array when syncedLogs is empty", () => {
      const result = rebuildHabitLogsFromSyncedLogs([], [makeHabit({ id: "h1", name: "Test" })]);
      expect(result).toEqual([]);
    });

    it("returns empty array when habits is empty", () => {
      const log = makeHabitLog("log1", 1000, {
        habitId: "h1",
        habitType: "count",
        quantity: 1,
      });
      const result = rebuildHabitLogsFromSyncedLogs([log], []);
      expect(result).toEqual([]);
    });

    it("returns empty array when both inputs are empty", () => {
      const result = rebuildHabitLogsFromSyncedLogs([], []);
      expect(result).toEqual([]);
    });
  });

  // ── Habit type logs ──────────────────────────────────────────────────────

  describe("habit type logs", () => {
    it("matches by habitId field", () => {
      const habits = [
        makeHabit({
          id: "habit_cigs",
          name: "Cigarettes",
          habitType: "destructive",
        }),
      ];
      const logs = [
        makeHabitLog("log1", 1000, {
          habitId: "habit_cigs",
          name: "Cigarettes",
          habitType: "destructive",
          quantity: 3,
        }),
      ];

      const result = rebuildHabitLogsFromSyncedLogs(logs, habits);

      expect(result).toHaveLength(1);
      expect(result[0].habitId).toBe("habit_cigs");
      expect(result[0].value).toBe(3);
      expect(result[0].source).toBe("import");
      expect(result[0].at).toBe(1000);
    });

    it("matches by name field when habitId does not resolve", () => {
      const habits = [
        makeHabit({
          id: "h_water",
          name: "Water",
          habitType: "fluid",
          logAs: "fluid",
        }),
      ];
      const logs = [
        makeHabitLog("log1", 2000, {
          habitId: "unknown_id",
          name: "Water",
          habitType: "fluid",
          quantity: 250,
        }),
      ];

      const result = rebuildHabitLogsFromSyncedLogs(logs, habits);

      expect(result).toHaveLength(1);
      expect(result[0].habitId).toBe("h_water");
      expect(result[0].value).toBe(250);
    });

    it("defaults quantity to 1 when not provided", () => {
      const habits = [makeHabit({ id: "h_med", name: "Medication", habitType: "checkbox" })];
      const logs = [
        makeHabitLog("log1", 3000, {
          habitId: "h_med",
          name: "Medication",
          habitType: "checkbox",
        }),
      ];

      const result = rebuildHabitLogsFromSyncedLogs(logs, habits);

      expect(result).toHaveLength(1);
      expect(result[0].value).toBe(1);
    });

    it("skips log when quantity is zero", () => {
      const habits = [makeHabit({ id: "h1", name: "Test" })];
      const logs = [
        makeHabitLog("log1", 1000, {
          habitId: "h1",
          name: "Test",
          habitType: "count",
          quantity: 0,
        }),
      ];

      const result = rebuildHabitLogsFromSyncedLogs(logs, habits);
      expect(result).toEqual([]);
    });

    it("skips log when quantity is negative", () => {
      const habits = [makeHabit({ id: "h1", name: "Test" })];
      const logs = [
        makeHabitLog("log1", 1000, {
          habitId: "h1",
          name: "Test",
          habitType: "count",
          quantity: -5,
        }),
      ];

      const result = rebuildHabitLogsFromSyncedLogs(logs, habits);
      expect(result).toEqual([]);
    });

    it("skips log when no matching habit is found (id, name, and habitType all miss)", () => {
      // The habit is "sleep" type, and the log uses an invalid habitType plus
      // non-matching id/name, so no resolution pathway succeeds.
      const habits = [makeHabit({ id: "h1", name: "Water", habitType: "sleep" })];
      const logs = [
        makeHabitLog("log1", 1000, {
          habitId: "nonexistent",
          name: "Nonexistent",
          habitType: "invalid",
          quantity: 1,
        }),
      ];

      const result = rebuildHabitLogsFromSyncedLogs(logs, habits);
      expect(result).toEqual([]);
    });

    it("resolves via habitType fallback when id and name miss but type matches", () => {
      // When habitId and name don't match any alias, the function falls back
      // to finding the first habit whose habitType matches the log's habitType.
      const habits = [makeHabit({ id: "h1", name: "Water", habitType: "count" })];
      const logs = [
        makeHabitLog("log1", 1000, {
          habitId: "nonexistent",
          name: "Nonexistent",
          habitType: "count",
          quantity: 1,
        }),
      ];

      const result = rebuildHabitLogsFromSyncedLogs(logs, habits);
      expect(result).toHaveLength(1);
      expect(result[0].habitId).toBe("h1");
    });

    it("generates correct derived ID format", () => {
      const habits = [makeHabit({ id: "h1", name: "Test" })];
      const logs = [
        makeHabitLog("log123", 1000, {
          habitId: "h1",
          habitType: "count",
          quantity: 1,
        }),
      ];

      const result = rebuildHabitLogsFromSyncedLogs(logs, habits);
      expect(result[0].id).toBe("derived:log123:h1");
    });
  });

  // ── isHabitType guard (WQ-033) ───────────────────────────────────────────

  describe("isHabitType guard — invalid habitType values", () => {
    it("skips log with invalid habitType string when no habit matches by name or id", () => {
      const habits = [makeHabit({ id: "h1", name: "Test", habitType: "count" })];
      const logs = [
        makeHabitLog("log1", 1000, {
          habitId: "no_match",
          name: "no_match",
          habitType: "invalid",
          quantity: 1,
        }),
      ];

      const result = rebuildHabitLogsFromSyncedLogs(logs, habits);
      expect(result).toEqual([]);
    });

    it("skips log with empty string habitType when no habit matches by name or id", () => {
      const habits = [makeHabit({ id: "h1", name: "Test", habitType: "count" })];
      const logs = [
        makeHabitLog("log1", 1000, {
          habitId: "no_match",
          name: "no_match",
          habitType: "",
          quantity: 1,
        }),
      ];

      const result = rebuildHabitLogsFromSyncedLogs(logs, habits);
      expect(result).toEqual([]);
    });

    it("still resolves by habitId even when habitType is invalid", () => {
      const habits = [makeHabit({ id: "h1", name: "Test", habitType: "count" })];
      const logs = [
        makeHabitLog("log1", 1000, {
          habitId: "h1",
          name: "Test",
          habitType: "invalid",
          quantity: 2,
        }),
      ];

      // The habit can be resolved by id alias even though habitType is invalid —
      // the invalid habitType just means the fallback type lookup won't be used.
      const result = rebuildHabitLogsFromSyncedLogs(logs, habits);
      expect(result).toHaveLength(1);
      expect(result[0].habitId).toBe("h1");
      expect(result[0].value).toBe(2);
    });

    it("falls back to habitType when habitId and name don't match directly", () => {
      const habits = [makeHabit({ id: "h_sleep", name: "Sleep", habitType: "sleep" })];
      const logs = [
        makeHabitLog("log1", 1000, {
          habitId: "unknown_id",
          name: "unknown_name",
          habitType: "sleep",
          quantity: 8,
        }),
      ];

      const result = rebuildHabitLogsFromSyncedLogs(logs, habits);
      expect(result).toHaveLength(1);
      expect(result[0].habitId).toBe("h_sleep");
      expect(result[0].value).toBe(8);
    });

    it("does not fall back when habitType is invalid (no match by id/name)", () => {
      const habits = [makeHabit({ id: "h_sleep", name: "Sleep", habitType: "sleep" })];
      const logs = [
        makeHabitLog("log1", 1000, {
          habitId: "unknown_id",
          name: "unknown_name",
          habitType: "bogus",
          quantity: 8,
        }),
      ];

      const result = rebuildHabitLogsFromSyncedLogs(logs, habits);
      // Cannot match by id/name, and habitType is invalid so no fallback
      expect(result).toEqual([]);
    });
  });

  // ── Fluid type logs ──────────────────────────────────────────────────────

  describe("fluid type logs", () => {
    it("matches fluid items to habits with logAs=fluid", () => {
      const habits = [
        makeHabit({
          id: "habit_water",
          name: "Water",
          kind: "positive",
          unit: "ml",
          habitType: "fluid",
          logAs: "fluid",
        }),
      ];
      const logs = [makeFluidLog("log1", 1000, [{ name: "Water", quantity: 500, unit: "ml" }])];

      const result = rebuildHabitLogsFromSyncedLogs(logs, habits);

      expect(result).toHaveLength(1);
      expect(result[0].habitId).toBe("habit_water");
      expect(result[0].value).toBe(500);
      expect(result[0].id).toBe("derived:log1:habit_water:0");
    });

    it("handles multiple fluid items in one log", () => {
      const habits = [
        makeHabit({
          id: "habit_water",
          name: "Water",
          habitType: "fluid",
          logAs: "fluid",
          unit: "ml",
        }),
        makeHabit({
          id: "habit_tea",
          name: "Tea",
          habitType: "fluid",
          logAs: "fluid",
          unit: "ml",
        }),
      ];
      const logs = [
        makeFluidLog("log1", 1000, [
          { name: "Water", quantity: 250, unit: "ml" },
          { name: "Tea", quantity: 300, unit: "ml" },
        ]),
      ];

      const result = rebuildHabitLogsFromSyncedLogs(logs, habits);

      expect(result).toHaveLength(2);
      expect(result[0].habitId).toBe("habit_water");
      expect(result[0].value).toBe(250);
      expect(result[0].id).toBe("derived:log1:habit_water:0");
      expect(result[1].habitId).toBe("habit_tea");
      expect(result[1].value).toBe(300);
      expect(result[1].id).toBe("derived:log1:habit_tea:1");
    });

    it("skips fluid items with zero quantity", () => {
      const habits = [
        makeHabit({
          id: "habit_water",
          name: "Water",
          habitType: "fluid",
          logAs: "fluid",
          unit: "ml",
        }),
      ];
      const logs = [makeFluidLog("log1", 1000, [{ name: "Water", quantity: 0, unit: "ml" }])];

      const result = rebuildHabitLogsFromSyncedLogs(logs, habits);
      expect(result).toEqual([]);
    });

    it("skips fluid items with no matching habit", () => {
      const habits = [
        makeHabit({
          id: "habit_water",
          name: "Water",
          habitType: "fluid",
          logAs: "fluid",
          unit: "ml",
        }),
      ];
      const logs = [makeFluidLog("log1", 1000, [{ name: "Juice", quantity: 200, unit: "ml" }])];

      const result = rebuildHabitLogsFromSyncedLogs(logs, habits);
      expect(result).toEqual([]);
    });

    it("uses value=1 for cap habits (destructive with dailyCap)", () => {
      const habits = [
        makeHabit({
          id: "habit_coffee",
          name: "Coffee",
          kind: "destructive",
          habitType: "destructive",
          logAs: "fluid",
          unit: "count",
          dailyCap: 3,
        }),
      ];
      const logs = [makeFluidLog("log1", 1000, [{ name: "Coffee", quantity: 250, unit: "ml" }])];

      const result = rebuildHabitLogsFromSyncedLogs(logs, habits);

      expect(result).toHaveLength(1);
      // isCapHabit returns true for destructive + dailyCap, so value should be 1
      expect(result[0].value).toBe(1);
    });
  });

  // ── Activity type logs ───────────────────────────────────────────────────

  describe("activity type logs", () => {
    it("matches activity logs to activity habits", () => {
      const habits = [
        makeHabit({
          id: "habit_walking",
          name: "Walking",
          habitType: "activity",
          unit: "minutes",
          templateKey: "walking",
        }),
      ];
      const logs = [
        makeActivityLog("log1", 1000, {
          activityType: "walking",
          durationMinutes: 30,
        }),
      ];

      const result = rebuildHabitLogsFromSyncedLogs(logs, habits);

      expect(result).toHaveLength(1);
      expect(result[0].habitId).toBe("habit_walking");
      expect(result[0].value).toBe(30);
    });

    it("normalizes 'walk' alias to 'walking'", () => {
      const habits = [
        makeHabit({
          id: "habit_walking",
          name: "Walking",
          habitType: "activity",
          unit: "minutes",
          templateKey: "walking",
        }),
      ];
      const logs = [
        makeActivityLog("log1", 1000, {
          activityType: "walk",
          durationMinutes: 45,
        }),
      ];

      const result = rebuildHabitLogsFromSyncedLogs(logs, habits);

      expect(result).toHaveLength(1);
      expect(result[0].habitId).toBe("habit_walking");
      expect(result[0].value).toBe(45);
    });

    it("converts duration to hours for habits with unit=hours", () => {
      const habits = [
        makeHabit({
          id: "habit_sleep",
          name: "Sleep",
          habitType: "sleep",
          unit: "hours",
          templateKey: "sleep",
        }),
      ];
      const logs = [
        makeActivityLog("log1", 1000, {
          activityType: "sleep",
          durationMinutes: 480,
        }),
      ];

      const result = rebuildHabitLogsFromSyncedLogs(logs, habits);

      expect(result).toHaveLength(1);
      expect(result[0].habitId).toBe("habit_sleep");
      expect(result[0].value).toBe(8); // 480 / 60 = 8 hours
    });

    it("rounds hours value to 2 decimal places", () => {
      const habits = [
        makeHabit({
          id: "habit_sleep",
          name: "Sleep",
          habitType: "sleep",
          unit: "hours",
        }),
      ];
      const logs = [
        makeActivityLog("log1", 1000, {
          activityType: "sleep",
          durationMinutes: 100,
        }),
      ];

      const result = rebuildHabitLogsFromSyncedLogs(logs, habits);

      expect(result).toHaveLength(1);
      // 100 / 60 = 1.6666..., rounded to 2 decimal places = 1.67
      expect(result[0].value).toBe(1.67);
    });

    it("skips activity with zero duration", () => {
      const habits = [
        makeHabit({
          id: "habit_walking",
          name: "Walking",
          habitType: "activity",
          unit: "minutes",
        }),
      ];
      const logs = [
        makeActivityLog("log1", 1000, {
          activityType: "walking",
          durationMinutes: 0,
        }),
      ];

      const result = rebuildHabitLogsFromSyncedLogs(logs, habits);
      expect(result).toEqual([]);
    });

    it("skips activity with missing durationMinutes", () => {
      const habits = [
        makeHabit({
          id: "habit_walking",
          name: "Walking",
          habitType: "activity",
          unit: "minutes",
        }),
      ];
      const logs = [makeActivityLog("log1", 1000, { activityType: "walking" })];

      const result = rebuildHabitLogsFromSyncedLogs(logs, habits);
      expect(result).toEqual([]);
    });

    it("routes sleep activities to all sleep-type habits", () => {
      const habits = [
        makeHabit({
          id: "habit_sleep",
          name: "Sleep",
          habitType: "sleep",
          unit: "hours",
        }),
        makeHabit({
          id: "habit_nap",
          name: "Nap",
          habitType: "sleep",
          unit: "minutes",
        }),
      ];
      const logs = [
        makeActivityLog("log1", 1000, {
          activityType: "sleep",
          durationMinutes: 120,
        }),
      ];

      const result = rebuildHabitLogsFromSyncedLogs(logs, habits);

      expect(result).toHaveLength(2);
      const sleepResult = result.find((r) => r.habitId === "habit_sleep");
      const napResult = result.find((r) => r.habitId === "habit_nap");
      expect(sleepResult?.value).toBe(2); // 120 / 60 = 2 hours
      expect(napResult?.value).toBe(120); // minutes
    });

    it("skips activity with no matching habit", () => {
      const habits = [
        makeHabit({
          id: "habit_walking",
          name: "Walking",
          habitType: "activity",
          unit: "minutes",
        }),
      ];
      const logs = [
        makeActivityLog("log1", 1000, {
          activityType: "swimming",
          durationMinutes: 30,
        }),
      ];

      const result = rebuildHabitLogsFromSyncedLogs(logs, habits);
      expect(result).toEqual([]);
    });
  });

  // ── Sort behavior (O(n log n)) ──────────────────────────────────────────

  describe("sort behavior", () => {
    it("outputs logs sorted by timestamp ascending regardless of input order", () => {
      const habits = [makeHabit({ id: "h1", name: "Test" })];
      const logs = [
        makeHabitLog("log3", 3000, {
          habitId: "h1",
          habitType: "count",
          quantity: 1,
        }),
        makeHabitLog("log1", 1000, {
          habitId: "h1",
          habitType: "count",
          quantity: 1,
        }),
        makeHabitLog("log2", 2000, {
          habitId: "h1",
          habitType: "count",
          quantity: 1,
        }),
      ];

      const result = rebuildHabitLogsFromSyncedLogs(logs, habits);

      expect(result).toHaveLength(3);
      expect(result[0].at).toBe(1000);
      expect(result[1].at).toBe(2000);
      expect(result[2].at).toBe(3000);
    });

    it("preserves insertion order for logs with identical timestamps", () => {
      const habits = [makeHabit({ id: "h1", name: "Test" })];
      const logs = [
        makeHabitLog("logA", 1000, {
          habitId: "h1",
          habitType: "count",
          quantity: 1,
        }),
        makeHabitLog("logB", 1000, {
          habitId: "h1",
          habitType: "count",
          quantity: 2,
        }),
      ];

      const result = rebuildHabitLogsFromSyncedLogs(logs, habits);

      expect(result).toHaveLength(2);
      // Both at same timestamp, should preserve relative order
      expect(result[0].id).toBe("derived:logA:h1");
      expect(result[1].id).toBe("derived:logB:h1");
    });

    it("does not mutate the input array", () => {
      const habits = [makeHabit({ id: "h1", name: "Test" })];
      const logs = [
        makeHabitLog("log2", 2000, {
          habitId: "h1",
          habitType: "count",
          quantity: 1,
        }),
        makeHabitLog("log1", 1000, {
          habitId: "h1",
          habitType: "count",
          quantity: 1,
        }),
      ];
      const originalFirstId = logs[0].id;

      rebuildHabitLogsFromSyncedLogs(logs, habits);

      // Input array should not be reordered
      expect(logs[0].id).toBe(originalFirstId);
    });
  });

  // ── Mixed valid and invalid logs ─────────────────────────────────────────

  describe("mixed valid and invalid logs", () => {
    it("keeps valid logs and skips invalid ones", () => {
      const habits = [
        makeHabit({ id: "h1", name: "Test", habitType: "count" }),
        makeHabit({
          id: "habit_water",
          name: "Water",
          habitType: "fluid",
          logAs: "fluid",
          unit: "ml",
        }),
      ];
      const logs: SyncedLog[] = [
        // Valid habit log
        makeHabitLog("log1", 1000, {
          habitId: "h1",
          habitType: "count",
          quantity: 3,
        }),
        // Invalid: no matching habit (invalid habitType prevents fallback)
        makeHabitLog("log2", 2000, {
          habitId: "nonexistent",
          name: "nonexistent",
          habitType: "invalid",
          quantity: 1,
        }),
        // Valid fluid log
        makeFluidLog("log3", 3000, [{ name: "Water", quantity: 250, unit: "ml" }]),
        // Invalid: fluid with zero quantity
        makeFluidLog("log4", 4000, [{ name: "Water", quantity: 0, unit: "ml" }]),
        // Invalid: habit with invalid habitType and no matching id/name
        makeHabitLog("log5", 5000, {
          habitId: "nope",
          name: "nope",
          habitType: "invalid",
          quantity: 1,
        }),
      ];

      const result = rebuildHabitLogsFromSyncedLogs(logs, habits);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("derived:log1:h1");
      expect(result[1].id).toBe("derived:log3:habit_water:0");
    });

    it("handles mix of habit, fluid, and activity logs", () => {
      const habits = [
        makeHabit({
          id: "h_cig",
          name: "Cigarettes",
          habitType: "destructive",
        }),
        makeHabit({
          id: "h_water",
          name: "Water",
          habitType: "fluid",
          logAs: "fluid",
          unit: "ml",
        }),
        makeHabit({
          id: "h_walk",
          name: "Walking",
          habitType: "activity",
          unit: "minutes",
        }),
      ];
      const logs: SyncedLog[] = [
        makeHabitLog("log1", 1000, {
          habitId: "h_cig",
          habitType: "destructive",
          quantity: 2,
        }),
        makeFluidLog("log2", 2000, [{ name: "Water", quantity: 500, unit: "ml" }]),
        makeActivityLog("log3", 3000, {
          activityType: "walking",
          durationMinutes: 20,
        }),
      ];

      const result = rebuildHabitLogsFromSyncedLogs(logs, habits);

      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({ habitId: "h_cig", value: 2, at: 1000 });
      expect(result[1]).toMatchObject({
        habitId: "h_water",
        value: 500,
        at: 2000,
      });
      expect(result[2]).toMatchObject({
        habitId: "h_walk",
        value: 20,
        at: 3000,
      });
    });
  });

  // ── Non-matching log types (food, digestion, weight, reproductive) ─────

  describe("non-matching log types", () => {
    it("ignores food type logs entirely", () => {
      const habits = [makeHabit({ id: "h1", name: "Test" })];
      const foodLog: SyncedLog = {
        id: "food1",
        timestamp: 1000,
        type: "food",
        data: {
          items: [
            {
              name: "Apple",
              quantity: 1,
              unit: "whole",
              canonicalName: "apple",
            },
          ],
        },
      };

      const result = rebuildHabitLogsFromSyncedLogs([foodLog], habits);
      expect(result).toEqual([]);
    });

    it("ignores digestion type logs entirely", () => {
      const habits = [makeHabit({ id: "h1", name: "Test" })];
      const digestionLog: SyncedLog = {
        id: "dig1",
        timestamp: 1000,
        type: "digestion",
        data: { bristolCode: 4 },
      };

      const result = rebuildHabitLogsFromSyncedLogs([digestionLog], habits);
      expect(result).toEqual([]);
    });

    it("ignores weight type logs entirely", () => {
      const habits = [makeHabit({ id: "h1", name: "Test" })];
      const weightLog: SyncedLog = {
        id: "w1",
        timestamp: 1000,
        type: "weight",
        data: { weightKg: 75 },
      };

      const result = rebuildHabitLogsFromSyncedLogs([weightLog], habits);
      expect(result).toEqual([]);
    });
  });

  // ── Alias resolution ─────────────────────────────────────────────────────

  describe("alias resolution", () => {
    it("resolves rec_drugs aliases (tina, recreational drugs)", () => {
      const habits = [
        makeHabit({
          id: "habit_rec_drugs",
          name: "Rec Drugs",
          habitType: "destructive",
          templateKey: "rec_drugs",
        }),
      ];

      // "tina" is a known alias for rec_drugs
      const logs = [
        makeHabitLog("log1", 1000, {
          habitId: "tina",
          habitType: "destructive",
          quantity: 1,
        }),
      ];

      const result = rebuildHabitLogsFromSyncedLogs(logs, habits);
      expect(result).toHaveLength(1);
      expect(result[0].habitId).toBe("habit_rec_drugs");
    });

    it("resolves confectionery aliases (sweets, sweet)", () => {
      const habits = [
        makeHabit({
          id: "habit_confectionery",
          name: "Sweets",
          habitType: "destructive",
          templateKey: "confectionery",
        }),
      ];

      // The name "Sweets" matches directly, but also the alias "sweet" should work
      const logs = [
        makeHabitLog("log1", 1000, {
          habitId: "sweet",
          habitType: "destructive",
          quantity: 2,
        }),
      ];

      const result = rebuildHabitLogsFromSyncedLogs(logs, habits);
      expect(result).toHaveLength(1);
      expect(result[0].habitId).toBe("habit_confectionery");
    });

    it("resolves walking alias (walk)", () => {
      const habits = [
        makeHabit({
          id: "habit_walking",
          name: "Walking",
          habitType: "activity",
          unit: "minutes",
          templateKey: "walking",
        }),
      ];

      const logs = [
        makeHabitLog("log1", 1000, {
          habitId: "walk",
          habitType: "activity",
          quantity: 30,
        }),
      ];

      const result = rebuildHabitLogsFromSyncedLogs(logs, habits);
      expect(result).toHaveLength(1);
      expect(result[0].habitId).toBe("habit_walking");
    });

    it("resolves by templateKey", () => {
      const habits = [
        makeHabit({
          id: "habit_sleep",
          name: "Sleep",
          habitType: "sleep",
          unit: "hours",
          templateKey: "sleep",
        }),
      ];

      const logs = [
        makeHabitLog("log1", 1000, {
          habitId: "sleep",
          habitType: "sleep",
          quantity: 7,
        }),
      ];

      const result = rebuildHabitLogsFromSyncedLogs(logs, habits);
      expect(result).toHaveLength(1);
      expect(result[0].habitId).toBe("habit_sleep");
    });

    it("handles case-insensitive matching", () => {
      const habits = [makeHabit({ id: "h1", name: "Water", habitType: "fluid" })];
      const logs = [
        makeHabitLog("log1", 1000, {
          habitId: "WATER",
          habitType: "fluid",
          quantity: 250,
        }),
      ];

      const result = rebuildHabitLogsFromSyncedLogs(logs, habits);
      expect(result).toHaveLength(1);
      expect(result[0].habitId).toBe("h1");
    });
  });

  // ── Output shape validation ──────────────────────────────────────────────

  describe("output shape", () => {
    it("produces HabitLog objects with all required fields", () => {
      const habits = [makeHabit({ id: "h1", name: "Test", habitType: "count" })];
      const logs = [
        makeHabitLog("log1", 42000, {
          habitId: "h1",
          habitType: "count",
          quantity: 5,
        }),
      ];

      const result = rebuildHabitLogsFromSyncedLogs(logs, habits);

      expect(result).toHaveLength(1);
      const entry = result[0];
      expect(entry).toEqual({
        id: "derived:log1:h1",
        habitId: "h1",
        value: 5,
        source: "import",
        at: 42000,
      } satisfies HabitLog);
    });
  });

  // ── Real template integration ────────────────────────────────────────────

  describe("with real HABIT_TEMPLATES", () => {
    const realHabits = Object.values(HABIT_TEMPLATES);

    it("resolves water fluid log against real templates", () => {
      const logs = [makeFluidLog("log1", 1000, [{ name: "Water", quantity: 500, unit: "ml" }])];

      const result = rebuildHabitLogsFromSyncedLogs(logs, realHabits);

      expect(result).toHaveLength(1);
      expect(result[0].habitId).toBe("habit_water");
      expect(result[0].value).toBe(500);
    });

    it("resolves coffee as cap habit against real templates (value=1)", () => {
      const logs = [makeFluidLog("log1", 1000, [{ name: "Coffee", quantity: 250, unit: "ml" }])];

      const result = rebuildHabitLogsFromSyncedLogs(logs, realHabits);

      expect(result).toHaveLength(1);
      expect(result[0].habitId).toBe("habit_coffee");
      // Coffee is destructive with dailyCap=3, so isCapHabit=true, value=1
      expect(result[0].value).toBe(1);
    });

    it("resolves sleep activity against real templates in hours", () => {
      const logs = [
        makeActivityLog("log1", 1000, {
          activityType: "sleep",
          durationMinutes: 450,
        }),
      ];

      const result = rebuildHabitLogsFromSyncedLogs(logs, realHabits);

      expect(result).toHaveLength(1);
      expect(result[0].habitId).toBe("habit_sleep");
      expect(result[0].value).toBe(7.5); // 450 / 60 = 7.5
    });

    it("resolves walking activity against real templates", () => {
      const logs = [
        makeActivityLog("log1", 1000, {
          activityType: "walking",
          durationMinutes: 30,
        }),
      ];

      const result = rebuildHabitLogsFromSyncedLogs(logs, realHabits);

      const walkingResults = result.filter((r) => r.habitId === "habit_walking");
      expect(walkingResults).toHaveLength(1);
      expect(walkingResults[0].value).toBe(30);
    });

    it("resolves cigarettes habit against real templates", () => {
      const logs = [
        makeHabitLog("log1", 1000, {
          habitId: "habit_cigarettes",
          habitType: "destructive",
          quantity: 5,
        }),
      ];

      const result = rebuildHabitLogsFromSyncedLogs(logs, realHabits);

      expect(result).toHaveLength(1);
      expect(result[0].habitId).toBe("habit_cigarettes");
      expect(result[0].value).toBe(5);
    });
  });
});
