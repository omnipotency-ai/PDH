import { describe, expect, it } from "vitest";
import { formatLocalDateKey } from "../dateUtils";
import { computeDaySummaries, computeStreakSummary, getGoodDayLabel } from "../habitAggregates";
import type { HabitConfig, HabitLog } from "../habitTemplates";

describe("formatLocalDateKey", () => {
  it("formats Date to YYYY-MM-DD", () => {
    const date = new Date(2024, 0, 15); // Jan 15, 2024
    expect(formatLocalDateKey(date)).toBe("2024-01-15");
  });

  it("formats timestamp to YYYY-MM-DD", () => {
    const timestamp = new Date(2024, 5, 1).getTime(); // June 1, 2024
    expect(formatLocalDateKey(timestamp)).toBe("2024-06-01");
  });
});

describe("computeDaySummaries", () => {
  const mockHabit: HabitConfig = {
    id: "habit_water",
    name: "Water",
    kind: "positive",
    unit: "ml",
    quickIncrement: 250,
    dailyTarget: 2000,
    showOnTrack: true,
    color: "sky",
    createdAt: Date.now(),
    habitType: "fluid",
  };

  it("returns zero/default for empty array", () => {
    const result = computeDaySummaries([], [mockHabit], {
      start: "2024-01-01",
      end: "2024-01-03",
    });

    expect(result.length).toBe(3); // 3 days
    expect(result.every((s) => s.totalValue === 0)).toBe(true);
  });

  it("returns single entry value for one log", () => {
    const logs: HabitLog[] = [
      {
        id: "log-1",
        habitId: "habit_water",
        at: new Date("2024-01-02T10:00:00").getTime(),
        value: 500,
        source: "quick",
      },
    ];
    const result = computeDaySummaries(logs, [mockHabit], {
      start: "2024-01-01",
      end: "2024-01-03",
    });

    const jan2 = result.find((s) => s.date === "2024-01-02");
    expect(jan2?.totalValue).toBe(500);
  });

  it("aggregates multiple entries correctly", () => {
    const logs: HabitLog[] = [
      {
        id: "log-1",
        habitId: "habit_water",
        at: new Date("2024-01-02T08:00:00").getTime(),
        value: 500,
        source: "quick",
      },
      {
        id: "log-2",
        habitId: "habit_water",
        at: new Date("2024-01-02T12:00:00").getTime(),
        value: 750,
        source: "quick",
      },
      {
        id: "log-3",
        habitId: "habit_water",
        at: new Date("2024-01-02T18:00:00").getTime(),
        value: 1000,
        source: "quick",
      },
    ];
    const result = computeDaySummaries(logs, [mockHabit], {
      start: "2024-01-02",
      end: "2024-01-02",
    });

    expect(result[0].totalValue).toBe(2250);
    expect(result[0].isGoodDay).toBe(true); // >= 2000 target
  });

  it("marks day as not good when below target", () => {
    const logs: HabitLog[] = [
      {
        id: "log-1",
        habitId: "habit_water",
        at: new Date("2024-01-02T10:00:00").getTime(),
        value: 500,
        source: "quick",
      },
    ];
    const result = computeDaySummaries(logs, [mockHabit], {
      start: "2024-01-02",
      end: "2024-01-02",
    });

    expect(result[0].isGoodDay).toBe(false); // 500 < 2000 target
  });
});

describe("computeStreakSummary", () => {
  it("counts consecutive good days", () => {
    const summaries = [
      {
        date: "2024-01-03",
        habitId: "habit_water",
        totalValue: 2500,
        isGoodDay: true,
      },
      {
        date: "2024-01-02",
        habitId: "habit_water",
        totalValue: 2100,
        isGoodDay: true,
      },
      {
        date: "2024-01-01",
        habitId: "habit_water",
        totalValue: 500,
        isGoodDay: false,
      },
    ];
    const result = computeStreakSummary(summaries, "habit_water", 7);

    expect(result.currentGoodStreak).toBe(2);
    expect(result.goodDaysInWindow).toBe(2);
  });

  it("returns zero streak when most recent day is bad", () => {
    const summaries = [
      {
        date: "2024-01-03",
        habitId: "habit_water",
        totalValue: 500,
        isGoodDay: false,
      },
      {
        date: "2024-01-02",
        habitId: "habit_water",
        totalValue: 2100,
        isGoodDay: true,
      },
    ];
    const result = computeStreakSummary(summaries, "habit_water", 7);

    expect(result.currentGoodStreak).toBe(0);
  });
});

describe("getGoodDayLabel", () => {
  it("returns human-readable label", () => {
    const summary = {
      habitId: "habit_water",
      currentGoodStreak: 3,
      goodDaysInWindow: 5,
      windowSize: 7,
    };
    expect(getGoodDayLabel(summary)).toBe("5 of last 7 days");
  });
});
