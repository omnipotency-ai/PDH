import { afterEach, describe, expect, test, vi } from "vitest";
import {
  buildTodayHash,
  type ComputeBaselineInput,
  computeBaselineAverages,
} from "../baselineAverages";
import type { HabitConfig, HabitLog } from "../habitTemplates";
import type { SyncedLog } from "../sync";

// ── Test helpers ──────────────────────────────────────────────────────────────

/** Milliseconds per day, for building multi-day timestamps. */
const DAY_MS = 24 * 60 * 60 * 1000;

/** Base timestamp: 2026-03-10T12:00:00Z */
const BASE_TS = new Date("2026-03-10T12:00:00Z").getTime();

function makeHabit(overrides: Partial<HabitConfig> & { id: string; name: string }): HabitConfig {
  return {
    kind: "positive",
    unit: "count",
    quickIncrement: 1,
    showOnTrack: true,
    color: "blue",
    createdAt: 0,
    habitType: "count",
    ...overrides,
  };
}

function makeHabitLog(habitId: string, value: number, at: number): HabitLog {
  return {
    id: `log_${habitId}_${at}`,
    habitId,
    value,
    source: "quick",
    at,
  };
}

function makeFluidLog(
  items: Array<{ name: string; quantity: number }>,
  timestamp: number,
): SyncedLog {
  return {
    id: `fluid_${timestamp}`,
    timestamp,
    type: "fluid",
    data: {
      items: items.map((i) => ({ ...i, unit: "ml" })),
    },
  };
}

function makeDigestionLog(
  bristolCode: 1 | 2 | 3 | 4 | 5 | 6 | 7,
  timestamp: number,
  episodesCount?: number,
): SyncedLog {
  return {
    id: `digestion_${timestamp}`,
    timestamp,
    type: "digestion",
    data: {
      bristolCode,
      ...(episodesCount !== undefined && { episodesCount }),
    },
  };
}

function makeWeightLog(weightKg: number, timestamp: number): SyncedLog {
  return {
    id: `weight_${timestamp}`,
    timestamp,
    type: "weight",
    data: { weightKg },
  };
}

function emptyInput(overrides?: Partial<ComputeBaselineInput>): ComputeBaselineInput {
  return {
    logs: [],
    habits: [],
    habitLogs: [],
    todayHabitCounts: {},
    todayFluidTotalsByName: {},
    todayTotalFluidMl: 0,
    lastInsightRunAt: null,
    lastInsightRunHash: null,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("computeBaselineAverages", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Empty data ──────────────────────────────────────────────────────────────

  describe("empty data", () => {
    test("returns zeroed baselines when all inputs are empty", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-17T10:00:00Z"));

      const result = computeBaselineAverages(emptyInput());

      expect(result.habits).toEqual({});
      expect(result.fluids).toEqual({});
      expect(result.totalFluidAvgMlPerDay).toBe(0);
      expect(result.waterAvgMlPerDay).toBe(0);
      expect(result.avgWeightKg).toBeNull();
      expect(result.avgBmPerDay).toBe(0);
      expect(result.avgBristolScore).toBeNull();
      expect(result.deltas).toEqual({});
      expect(result.fluidDeltas).toEqual({});
      expect(result.totalFluidDelta).toBeNull();
      expect(result.computedAt).toBe(Date.now());
      expect(result.lastInsightRunAt).toBeNull();
      expect(result.changedSinceLastRun).toBe(true);
    });

    test("habits with no matching logs get zero-valued baselines", () => {
      const habits = [
        makeHabit({
          id: "h1",
          name: "Walking",
          habitType: "activity",
          unit: "minutes",
        }),
        makeHabit({
          id: "h2",
          name: "Cigarettes",
          habitType: "destructive",
          kind: "destructive",
        }),
      ];

      const result = computeBaselineAverages(emptyInput({ habits, habitLogs: [] }));

      expect(Object.keys(result.habits)).toHaveLength(2);
      expect(result.habits.h1).toEqual({
        habitId: "h1",
        habitName: "Walking",
        habitType: "activity",
        avgPerLoggedDay: 0,
        avgPerCalendarDay: 0,
        completionRate: null,
        calendarDays: 0,
        loggedDays: 0,
        unit: "minutes",
      });
      expect(result.habits.h2).toEqual({
        habitId: "h2",
        habitName: "Cigarettes",
        habitType: "destructive",
        avgPerLoggedDay: 0,
        avgPerCalendarDay: 0,
        completionRate: null,
        calendarDays: 0,
        loggedDays: 0,
        unit: "count",
      });
    });
  });

  // ── Multi-habit scenarios ───────────────────────────────────────────────────

  describe("multi-habit scenarios", () => {
    test("computes independent baselines for multiple habits of different types", () => {
      const walkHabit = makeHabit({
        id: "walk",
        name: "Walking",
        habitType: "activity",
        unit: "minutes",
      });
      const sleepHabit = makeHabit({
        id: "sleep",
        name: "Sleep",
        habitType: "sleep",
        unit: "hours",
      });
      const cigHabit = makeHabit({
        id: "cigs",
        name: "Cigarettes",
        habitType: "destructive",
        kind: "destructive",
        dailyCap: 10,
      });

      const habitLogs: HabitLog[] = [
        // Walking: 30 min day 1, 45 min day 2
        makeHabitLog("walk", 30, BASE_TS),
        makeHabitLog("walk", 45, BASE_TS + DAY_MS),
        // Sleep: 7h day 1, 8h day 2, 6h day 3
        makeHabitLog("sleep", 7, BASE_TS),
        makeHabitLog("sleep", 8, BASE_TS + DAY_MS),
        makeHabitLog("sleep", 6, BASE_TS + 2 * DAY_MS),
        // Cigarettes: 5 on day 1 only
        makeHabitLog("cigs", 5, BASE_TS),
      ];

      const result = computeBaselineAverages(
        emptyInput({
          habits: [walkHabit, sleepHabit, cigHabit],
          habitLogs,
        }),
      );

      // Walking: 2 calendar days, 2 logged days, total 75 min
      expect(result.habits.walk.calendarDays).toBe(2);
      expect(result.habits.walk.loggedDays).toBe(2);
      expect(result.habits.walk.avgPerLoggedDay).toBe(37.5);
      expect(result.habits.walk.avgPerCalendarDay).toBe(37.5);

      // Sleep: 3 calendar days, 3 logged days, total 21 hours
      expect(result.habits.sleep.calendarDays).toBe(3);
      expect(result.habits.sleep.loggedDays).toBe(3);
      expect(result.habits.sleep.avgPerLoggedDay).toBe(7);
      expect(result.habits.sleep.avgPerCalendarDay).toBe(7);

      // Cigarettes: 1 calendar day, 1 logged day, total 5
      expect(result.habits.cigs.calendarDays).toBe(1);
      expect(result.habits.cigs.loggedDays).toBe(1);
      expect(result.habits.cigs.avgPerLoggedDay).toBe(5);
    });

    test("each habit has its own tracking window (not a global denominator)", () => {
      const earlyHabit = makeHabit({ id: "early", name: "Early" });
      const lateHabit = makeHabit({ id: "late", name: "Late" });

      const habitLogs: HabitLog[] = [
        // early habit: logs on day 1 and day 10 (10 calendar days)
        makeHabitLog("early", 1, BASE_TS),
        makeHabitLog("early", 1, BASE_TS + 9 * DAY_MS),
        // late habit: logs only on day 8 and day 9 (2 calendar days)
        makeHabitLog("late", 5, BASE_TS + 7 * DAY_MS),
        makeHabitLog("late", 5, BASE_TS + 8 * DAY_MS),
      ];

      const result = computeBaselineAverages(
        emptyInput({
          habits: [earlyHabit, lateHabit],
          habitLogs,
        }),
      );

      // early: 10 calendar days, total value = 2, avgPerCalendarDay = 0.2
      expect(result.habits.early.calendarDays).toBe(10);
      expect(result.habits.early.avgPerCalendarDay).toBe(0.2);

      // late: only 2 calendar days, total value = 10, avgPerCalendarDay = 5
      expect(result.habits.late.calendarDays).toBe(2);
      expect(result.habits.late.avgPerCalendarDay).toBe(5);
    });
  });

  // ── Habit types ─────────────────────────────────────────────────────────────

  describe("habit types", () => {
    test("boolean/checkbox habit computes completion rate", () => {
      const medHabit = makeHabit({
        id: "med",
        name: "Medication",
        habitType: "checkbox",
        kind: "positive",
        dailyTarget: 1,
      });

      const habitLogs: HabitLog[] = [
        // 3 calendar days, met target on 2 of them
        makeHabitLog("med", 1, BASE_TS),
        makeHabitLog("med", 1, BASE_TS + 2 * DAY_MS),
        // day 2 has no log -- counts as zero, does not meet target
      ];

      const result = computeBaselineAverages(emptyInput({ habits: [medHabit], habitLogs }));

      expect(result.habits.med.completionRate).toBeCloseTo(2 / 3);
      expect(result.habits.med.calendarDays).toBe(3);
      expect(result.habits.med.loggedDays).toBe(2);
    });

    test("counter habit does not have completion rate", () => {
      const counterHabit = makeHabit({
        id: "steps",
        name: "Steps",
        habitType: "count",
      });

      const habitLogs: HabitLog[] = [
        makeHabitLog("steps", 5000, BASE_TS),
        makeHabitLog("steps", 8000, BASE_TS + DAY_MS),
      ];

      const result = computeBaselineAverages(emptyInput({ habits: [counterHabit], habitLogs }));

      expect(result.habits.steps.completionRate).toBeNull();
      expect(result.habits.steps.avgPerLoggedDay).toBe(6500);
    });

    test("duration habit (minutes) computes averages correctly", () => {
      const yogaHabit = makeHabit({
        id: "yoga",
        name: "Yoga",
        habitType: "activity",
        unit: "minutes",
      });

      const habitLogs: HabitLog[] = [
        makeHabitLog("yoga", 20, BASE_TS),
        makeHabitLog("yoga", 30, BASE_TS),
        makeHabitLog("yoga", 15, BASE_TS + DAY_MS),
      ];

      const result = computeBaselineAverages(emptyInput({ habits: [yogaHabit], habitLogs }));

      // Day 1: 50 min, Day 2: 15 min, total 65
      expect(result.habits.yoga.avgPerLoggedDay).toBe(32.5);
      expect(result.habits.yoga.avgPerCalendarDay).toBe(32.5);
      expect(result.habits.yoga.loggedDays).toBe(2);
      expect(result.habits.yoga.unit).toBe("minutes");
    });

    test("time/sleep habit (hours) computes averages correctly", () => {
      const sleepHabit = makeHabit({
        id: "sleep",
        name: "Sleep",
        habitType: "sleep",
        unit: "hours",
      });

      const habitLogs: HabitLog[] = [
        makeHabitLog("sleep", 7.5, BASE_TS),
        makeHabitLog("sleep", 6.0, BASE_TS + DAY_MS),
        makeHabitLog("sleep", 8.0, BASE_TS + 2 * DAY_MS),
      ];

      const result = computeBaselineAverages(emptyInput({ habits: [sleepHabit], habitLogs }));

      // Total 21.5 across 3 days
      expect(result.habits.sleep.avgPerCalendarDay).toBeCloseTo(21.5 / 3);
      expect(result.habits.sleep.unit).toBe("hours");
    });
  });

  // ── Zero-cap habit (WQ-005 fix) ─────────────────────────────────────────────

  describe("zero-cap habit", () => {
    test("dailyCap=0 is preserved as a valid goal and the habit computes normally", () => {
      const quitSmokingHabit = makeHabit({
        id: "quit_smoking",
        name: "Cigarettes",
        habitType: "destructive",
        kind: "destructive",
        dailyCap: 0,
      });

      const habitLogs: HabitLog[] = [
        // User smoked 2 on day 1, 0 on day 2 (no log), 1 on day 3
        makeHabitLog("quit_smoking", 2, BASE_TS),
        makeHabitLog("quit_smoking", 1, BASE_TS + 2 * DAY_MS),
      ];

      const result = computeBaselineAverages(
        emptyInput({
          habits: [quitSmokingHabit],
          habitLogs,
          todayHabitCounts: { quit_smoking: 0 },
        }),
      );

      // The habit config with dailyCap=0 is valid and computes baselines
      expect(result.habits.quit_smoking).toBeDefined();
      expect(result.habits.quit_smoking.calendarDays).toBe(3);
      expect(result.habits.quit_smoking.avgPerCalendarDay).toBe(1);
      // dailyCap=0 means the goal is zero cigarettes; the habit config is not stripped
      expect(quitSmokingHabit.dailyCap).toBe(0);
    });
  });

  // ── Single log entry ────────────────────────────────────────────────────────

  describe("single log entry", () => {
    test("single habit log produces calendarDays=1, loggedDays=1", () => {
      const habit = makeHabit({ id: "h", name: "H" });
      const habitLogs: HabitLog[] = [makeHabitLog("h", 42, BASE_TS)];

      const result = computeBaselineAverages(emptyInput({ habits: [habit], habitLogs }));

      expect(result.habits.h.calendarDays).toBe(1);
      expect(result.habits.h.loggedDays).toBe(1);
      expect(result.habits.h.avgPerLoggedDay).toBe(42);
      expect(result.habits.h.avgPerCalendarDay).toBe(42);
    });

    test("single fluid log produces correct baselines", () => {
      const logs: SyncedLog[] = [makeFluidLog([{ name: "Water", quantity: 500 }], BASE_TS)];

      const result = computeBaselineAverages(emptyInput({ logs }));

      expect(result.fluids.water).toBeDefined();
      expect(result.fluids.water.avgMlPerDay).toBe(500);
      expect(result.fluids.water.loggedDays).toBe(1);
      expect(result.waterAvgMlPerDay).toBe(500);
      expect(result.totalFluidAvgMlPerDay).toBe(500);
    });

    test("single digestion log produces correct baselines", () => {
      const logs: SyncedLog[] = [makeDigestionLog(4, BASE_TS)];

      const result = computeBaselineAverages(emptyInput({ logs }));

      expect(result.avgBristolScore).toBe(4);
      expect(result.avgBmPerDay).toBe(1);
    });

    test("single weight log produces correct average", () => {
      const logs: SyncedLog[] = [makeWeightLog(72.5, BASE_TS)];

      const result = computeBaselineAverages(emptyInput({ logs }));

      expect(result.avgWeightKg).toBe(72.5);
    });
  });

  // ── Large number of logs ────────────────────────────────────────────────────

  describe("large number of logs", () => {
    test("correctly computes averages across 100 days of habit data", () => {
      const habit = makeHabit({ id: "walk", name: "Walking", unit: "minutes" });
      const habitLogs: HabitLog[] = [];

      for (let day = 0; day < 100; day++) {
        habitLogs.push(makeHabitLog("walk", 30, BASE_TS + day * DAY_MS));
      }

      const result = computeBaselineAverages(emptyInput({ habits: [habit], habitLogs }));

      expect(result.habits.walk.calendarDays).toBe(100);
      expect(result.habits.walk.loggedDays).toBe(100);
      expect(result.habits.walk.avgPerLoggedDay).toBe(30);
      expect(result.habits.walk.avgPerCalendarDay).toBe(30);
    });

    test("correctly computes averages across 100 days of mixed synced logs", () => {
      const logs: SyncedLog[] = [];
      for (let day = 0; day < 100; day++) {
        const ts = BASE_TS + day * DAY_MS;
        logs.push(makeFluidLog([{ name: "Water", quantity: 1000 }], ts));
        logs.push(makeWeightLog(70 + (day % 3), ts));
        if (day % 2 === 0) {
          logs.push(makeDigestionLog(4, ts));
        }
      }

      const result = computeBaselineAverages(emptyInput({ logs }));

      expect(result.fluids.water.calendarDays).toBe(100);
      expect(result.fluids.water.avgMlPerDay).toBe(1000);
      // Weight cycles 70,71,72: 34*70 + 33*71 + 33*72 = 7099, avg = 70.99
      expect(result.avgWeightKg).toBeCloseTo(70.99, 2);
      // 50 digestion logs over 50 calendar days (every other day), each with 1 episode
      // But digestion calendar span covers all 100 days (day 0 to day 98 = 99 days)
      expect(result.avgBristolScore).toBe(4);
    });
  });

  // ── Fluid baselines ─────────────────────────────────────────────────────────

  describe("fluid baselines", () => {
    test("aggregates multiple fluid types correctly", () => {
      const logs: SyncedLog[] = [
        makeFluidLog(
          [
            { name: "Water", quantity: 500 },
            { name: "Tea", quantity: 250 },
          ],
          BASE_TS,
        ),
        makeFluidLog(
          [
            { name: "Water", quantity: 300 },
            { name: "Tea", quantity: 200 },
          ],
          BASE_TS + DAY_MS,
        ),
      ];

      const result = computeBaselineAverages(emptyInput({ logs }));

      expect(result.fluids.water.avgMlPerDay).toBe(400); // 800 / 2 days
      expect(result.fluids.tea.avgMlPerDay).toBe(225); // 450 / 2 days
      expect(result.totalFluidAvgMlPerDay).toBe(625); // 1250 / 2 days
      expect(result.waterAvgMlPerDay).toBe(400);
    });

    test("'agua' is NOT treated as water (legacy synonym merge removed)", () => {
      const logs: SyncedLog[] = [
        makeFluidLog([{ name: "agua", quantity: 500 }], BASE_TS),
        makeFluidLog([{ name: "Water", quantity: 300 }], BASE_TS),
      ];

      const result = computeBaselineAverages(emptyInput({ logs }));

      // "agua" should be its own fluid, not merged with water
      expect(result.fluids.agua).toBeDefined();
      expect(result.fluids.water).toBeDefined();
      // waterAvgMlPerDay should only include "water", not "agua"
      expect(result.waterAvgMlPerDay).toBe(300);
    });

    test("fluid items with zero or negative quantity are ignored", () => {
      const logs: SyncedLog[] = [
        makeFluidLog(
          [
            { name: "Water", quantity: 0 },
            { name: "Tea", quantity: -100 },
            { name: "Juice", quantity: 200 },
          ],
          BASE_TS,
        ),
      ];

      const result = computeBaselineAverages(emptyInput({ logs }));

      expect(result.fluids.water).toBeUndefined();
      expect(result.fluids.tea).toBeUndefined();
      expect(result.fluids.juice).toBeDefined();
      expect(result.fluids.juice.avgMlPerDay).toBe(200);
    });

    test("fluid names are normalized (case-insensitive, diacritics removed)", () => {
      const logs: SyncedLog[] = [
        makeFluidLog([{ name: "WATER", quantity: 500 }], BASE_TS),
        makeFluidLog([{ name: "Water", quantity: 300 }], BASE_TS + DAY_MS),
      ];

      const result = computeBaselineAverages(emptyInput({ logs }));

      // Both should normalize to "water"
      expect(Object.keys(result.fluids)).toEqual(["water"]);
      expect(result.fluids.water.avgMlPerDay).toBe(400); // 800 / 2
    });
  });

  // ── Weight baselines ────────────────────────────────────────────────────────

  describe("weight baselines", () => {
    test("averages multiple weight logs", () => {
      const logs: SyncedLog[] = [
        makeWeightLog(70, BASE_TS),
        makeWeightLog(71, BASE_TS + DAY_MS),
        makeWeightLog(72, BASE_TS + 2 * DAY_MS),
      ];

      const result = computeBaselineAverages(emptyInput({ logs }));

      expect(result.avgWeightKg).toBe(71);
    });

    test("ignores zero and negative weight values", () => {
      const logs: SyncedLog[] = [
        makeWeightLog(0, BASE_TS),
        makeWeightLog(-5, BASE_TS + DAY_MS),
        makeWeightLog(70, BASE_TS + 2 * DAY_MS),
      ];

      const result = computeBaselineAverages(emptyInput({ logs }));

      expect(result.avgWeightKg).toBe(70);
    });
  });

  // ── Digestion baselines ─────────────────────────────────────────────────────

  describe("digestion baselines", () => {
    test("computes average Bristol score and BM per day", () => {
      const logs: SyncedLog[] = [
        makeDigestionLog(3, BASE_TS, 2),
        makeDigestionLog(5, BASE_TS + DAY_MS, 1),
        makeDigestionLog(4, BASE_TS + 2 * DAY_MS, 3),
      ];

      const result = computeBaselineAverages(emptyInput({ logs }));

      expect(result.avgBristolScore).toBe(4); // (3+5+4)/3
      // total BM count: 2+1+3 = 6, over 3 calendar days = 2
      expect(result.avgBmPerDay).toBe(2);
    });

    test("ignores Bristol scores outside 1-7 range", () => {
      const logs: SyncedLog[] = [
        // biome-ignore lint/suspicious/noExplicitAny: Intentional boundary test with invalid Bristol values
        makeDigestionLog(0 as any, BASE_TS),
        // biome-ignore lint/suspicious/noExplicitAny: Intentional boundary test with invalid Bristol values
        makeDigestionLog(8 as any, BASE_TS + DAY_MS),
        makeDigestionLog(4, BASE_TS + 2 * DAY_MS),
      ];

      const result = computeBaselineAverages(emptyInput({ logs }));

      // Only Bristol=4 is valid
      expect(result.avgBristolScore).toBe(4);
    });

    test("returns null Bristol score when no valid scores exist", () => {
      const logs: SyncedLog[] = [
        // biome-ignore lint/suspicious/noExplicitAny: Intentional boundary test with invalid Bristol values
        makeDigestionLog(0 as any, BASE_TS),
        // biome-ignore lint/suspicious/noExplicitAny: Intentional boundary test with invalid Bristol values
        makeDigestionLog(10 as any, BASE_TS + DAY_MS),
      ];

      const result = computeBaselineAverages(emptyInput({ logs }));

      expect(result.avgBristolScore).toBeNull();
      // BM count still computed from normalizeEpisodesCount (defaults to 1)
      expect(result.avgBmPerDay).toBeGreaterThan(0);
    });
  });

  // ── 24h deltas ──────────────────────────────────────────────────────────────

  describe("24h deltas", () => {
    test("computes habit deltas comparing today vs baseline", () => {
      const habit = makeHabit({ id: "walk", name: "Walking" });
      const habitLogs: HabitLog[] = [
        makeHabitLog("walk", 30, BASE_TS),
        makeHabitLog("walk", 50, BASE_TS + DAY_MS),
      ];

      const result = computeBaselineAverages(
        emptyInput({
          habits: [habit],
          habitLogs,
          todayHabitCounts: { walk: 60 },
        }),
      );

      const delta = result.deltas.walk;
      expect(delta).toBeDefined();
      expect(delta.todayValue).toBe(60);
      expect(delta.baselineAvg).toBe(40); // (30+50)/2
      expect(delta.absoluteDelta).toBe(20); // 60 - 40
      expect(delta.percentDelta).toBe(0.5); // 20/40
    });

    test("skips deltas for habits with no logs (calendarDays=0)", () => {
      const habit = makeHabit({ id: "h1", name: "H1" });

      const result = computeBaselineAverages(
        emptyInput({
          habits: [habit],
          habitLogs: [],
          todayHabitCounts: { h1: 5 },
        }),
      );

      expect(result.deltas.h1).toBeUndefined();
    });

    test("percentDelta is null when baseline average is zero", () => {
      const habit = makeHabit({ id: "h1", name: "H1" });
      // Multiple logs on the same day summing to zero won't happen with real data,
      // but baseline could be zero if avgPerCalendarDay rounds to 0.
      // We can create a scenario where avgPerCalendarDay is effectively zero
      // by having very sparse data over many days.
      // Actually, with value=0 habit logs, the total would be zero.
      const habitLogs: HabitLog[] = [
        makeHabitLog("h1", 0, BASE_TS),
        makeHabitLog("h1", 0, BASE_TS + DAY_MS),
      ];

      const result = computeBaselineAverages(
        emptyInput({
          habits: [habit],
          habitLogs,
          todayHabitCounts: { h1: 5 },
        }),
      );

      expect(result.deltas.h1.baselineAvg).toBe(0);
      expect(result.deltas.h1.percentDelta).toBeNull();
    });

    test("computes fluid deltas correctly", () => {
      const logs: SyncedLog[] = [
        makeFluidLog([{ name: "Water", quantity: 800 }], BASE_TS),
        makeFluidLog([{ name: "Water", quantity: 1200 }], BASE_TS + DAY_MS),
      ];

      const result = computeBaselineAverages(
        emptyInput({
          logs,
          todayFluidTotalsByName: { water: 1500 },
          todayTotalFluidMl: 1500,
        }),
      );

      const waterDelta = result.fluidDeltas.water;
      expect(waterDelta).toBeDefined();
      expect(waterDelta.todayValue).toBe(1500);
      expect(waterDelta.baselineAvg).toBe(1000); // 2000/2
      expect(waterDelta.absoluteDelta).toBe(500);
      expect(waterDelta.percentDelta).toBe(0.5);

      // Total fluid delta
      expect(result.totalFluidDelta).not.toBeNull();
      if (result.totalFluidDelta === null) throw new Error("expected totalFluidDelta");
      expect(result.totalFluidDelta.todayValue).toBe(1500);
      expect(result.totalFluidDelta.baselineAvg).toBe(1000);
    });

    test("total fluid delta is null when no historical fluid logs exist", () => {
      const result = computeBaselineAverages(emptyInput({ todayTotalFluidMl: 500 }));

      expect(result.totalFluidDelta).toBeNull();
    });
  });

  // ── Change detection ────────────────────────────────────────────────────────

  describe("change detection", () => {
    test("changedSinceLastRun is true when lastInsightRunHash is null (first run)", () => {
      const result = computeBaselineAverages(emptyInput({ lastInsightRunHash: null }));

      expect(result.changedSinceLastRun).toBe(true);
    });

    test("changedSinceLastRun is false when hash matches", () => {
      const hash = buildTodayHash({ walk: 30 }, { water: 500 }, 500);

      const result = computeBaselineAverages(
        emptyInput({
          todayHabitCounts: { walk: 30 },
          todayFluidTotalsByName: { water: 500 },
          todayTotalFluidMl: 500,
          lastInsightRunHash: hash,
        }),
      );

      expect(result.changedSinceLastRun).toBe(false);
    });

    test("changedSinceLastRun is true when hash differs", () => {
      const oldHash = buildTodayHash({ walk: 20 }, { water: 500 }, 500);

      const result = computeBaselineAverages(
        emptyInput({
          todayHabitCounts: { walk: 30 },
          todayFluidTotalsByName: { water: 500 },
          todayTotalFluidMl: 500,
          lastInsightRunHash: oldHash,
        }),
      );

      expect(result.changedSinceLastRun).toBe(true);
    });
  });

  // ── lastInsightRunAt passthrough ────────────────────────────────────────────

  describe("lastInsightRunAt passthrough", () => {
    test("preserves lastInsightRunAt value from input", () => {
      const runAt = Date.now() - 60000;
      const result = computeBaselineAverages(emptyInput({ lastInsightRunAt: runAt }));

      expect(result.lastInsightRunAt).toBe(runAt);
    });
  });

  // ── Mixed log types in synced logs ──────────────────────────────────────────

  describe("mixed log types", () => {
    test("correctly processes fluid, weight, and digestion from the same log array", () => {
      const logs: SyncedLog[] = [
        makeFluidLog([{ name: "Water", quantity: 500 }], BASE_TS),
        makeWeightLog(70, BASE_TS),
        makeDigestionLog(4, BASE_TS, 2),
        makeFluidLog([{ name: "Tea", quantity: 200 }], BASE_TS + DAY_MS),
        makeWeightLog(71, BASE_TS + DAY_MS),
        makeDigestionLog(3, BASE_TS + DAY_MS, 1),
      ];

      const result = computeBaselineAverages(emptyInput({ logs }));

      // Fluids
      expect(result.fluids.water.avgMlPerDay).toBe(250); // 500 / 2 days
      expect(result.fluids.tea.avgMlPerDay).toBe(100); // 200 / 2 days
      expect(result.totalFluidAvgMlPerDay).toBe(350); // 700 / 2
      expect(result.waterAvgMlPerDay).toBe(250);

      // Weight
      expect(result.avgWeightKg).toBe(70.5);

      // Digestion
      expect(result.avgBristolScore).toBe(3.5); // (4+3)/2
      expect(result.avgBmPerDay).toBe(1.5); // 3 episodes / 2 days
    });

    test("ignores non-fluid/weight/digestion log types in synced logs", () => {
      const foodLog: SyncedLog = {
        id: "food_1",
        timestamp: BASE_TS,
        type: "food",
        data: {
          items: [
            {
              quantity: 1,
              unit: "serving",
            },
          ],
        },
      };
      const activityLog: SyncedLog = {
        id: "activity_1",
        timestamp: BASE_TS,
        type: "activity",
        data: {
          activityType: "walking",
          durationMinutes: 30,
        },
      };

      const result = computeBaselineAverages(emptyInput({ logs: [foodLog, activityLog] }));

      // None of these should affect baselines
      expect(result.fluids).toEqual({});
      expect(result.avgWeightKg).toBeNull();
      expect(result.avgBristolScore).toBeNull();
      expect(result.avgBmPerDay).toBe(0);
    });
  });

  // ── avgPerLoggedDay vs avgPerCalendarDay ────────────────────────────────────

  describe("avgPerLoggedDay vs avgPerCalendarDay", () => {
    test("differ when there are gaps in logging", () => {
      const habit = makeHabit({ id: "h", name: "H" });
      // Log on day 1 and day 5 only (5 calendar days, 2 logged days)
      const habitLogs: HabitLog[] = [
        makeHabitLog("h", 10, BASE_TS),
        makeHabitLog("h", 20, BASE_TS + 4 * DAY_MS),
      ];

      const result = computeBaselineAverages(emptyInput({ habits: [habit], habitLogs }));

      expect(result.habits.h.loggedDays).toBe(2);
      expect(result.habits.h.calendarDays).toBe(5);
      expect(result.habits.h.avgPerLoggedDay).toBe(15); // 30 / 2
      expect(result.habits.h.avgPerCalendarDay).toBe(6); // 30 / 5
    });
  });

  // ── Multiple logs on the same day ───────────────────────────────────────────

  describe("multiple logs on the same day", () => {
    test("sums habit values on the same day correctly", () => {
      const habit = makeHabit({ id: "h", name: "H" });
      const habitLogs: HabitLog[] = [
        makeHabitLog("h", 10, BASE_TS),
        makeHabitLog("h", 5, BASE_TS + 3600000), // 1 hour later, same day
        makeHabitLog("h", 15, BASE_TS + 7200000), // 2 hours later, same day
      ];

      const result = computeBaselineAverages(emptyInput({ habits: [habit], habitLogs }));

      expect(result.habits.h.loggedDays).toBe(1);
      expect(result.habits.h.calendarDays).toBe(1);
      expect(result.habits.h.avgPerLoggedDay).toBe(30); // 10+5+15
    });

    test("sums fluid quantities on the same day and log correctly", () => {
      const logs: SyncedLog[] = [
        makeFluidLog(
          [
            { name: "Water", quantity: 200 },
            { name: "Water", quantity: 300 },
          ],
          BASE_TS,
        ),
      ];

      const result = computeBaselineAverages(emptyInput({ logs }));

      expect(result.fluids.water.avgMlPerDay).toBe(500);
      expect(result.fluids.water.loggedDays).toBe(1);
    });
  });
});

// ── buildTodayHash tests ──────────────────────────────────────────────────────

describe("buildTodayHash", () => {
  test("produces deterministic output for the same input", () => {
    const h1 = buildTodayHash({ walk: 30, sleep: 7 }, { water: 500 }, 500);
    const h2 = buildTodayHash({ walk: 30, sleep: 7 }, { water: 500 }, 500);
    expect(h1).toBe(h2);
  });

  test("produces different output for different inputs", () => {
    const h1 = buildTodayHash({ walk: 30 }, { water: 500 }, 500);
    const h2 = buildTodayHash({ walk: 31 }, { water: 500 }, 500);
    expect(h1).not.toBe(h2);
  });

  test("sorts keys for consistent output regardless of insertion order", () => {
    const h1 = buildTodayHash({ a: 1, b: 2 }, { x: 3, y: 4 }, 100);
    const h2 = buildTodayHash({ b: 2, a: 1 }, { y: 4, x: 3 }, 100);
    expect(h1).toBe(h2);
  });

  test("handles empty objects", () => {
    const h = buildTodayHash({}, {}, 0);
    expect(h).toBe("h[]f[]t0");
  });
});
