import { describe, expect, it } from "vitest";
import { HABIT_TEMPLATES } from "@/lib/habitTemplates";
import type { SyncedLog } from "@/lib/sync";
import { groupLogEntries } from "../grouping";

function makeHabitLog(overrides: Partial<SyncedLog> & Pick<SyncedLog, "timestamp">): SyncedLog {
  return {
    id: `${overrides.timestamp}-${Math.random().toString(36).slice(2)}`,
    type: "habit",
    timestamp: overrides.timestamp,
    data: overrides.data ?? {
      habitId: HABIT_TEMPLATES.cigarettes.id,
      name: HABIT_TEMPLATES.cigarettes.name,
      habitType: HABIT_TEMPLATES.cigarettes.habitType,
      quantity: 1,
      action: "event",
    },
  } as SyncedLog;
}

describe("groupLogEntries", () => {
  it("merges legacy habit-name-only cigarette logs into the canonical habit group", () => {
    const habits = [HABIT_TEMPLATES.cigarettes];
    const logs = [
      makeHabitLog({
        timestamp: 2_000,
        data: {
          habitId: HABIT_TEMPLATES.cigarettes.id,
          name: HABIT_TEMPLATES.cigarettes.name,
          habitType: HABIT_TEMPLATES.cigarettes.habitType,
          quantity: 1,
          action: "event",
        },
      }),
      makeHabitLog({
        timestamp: 1_000,
        data: {
          habitId: "",
          name: HABIT_TEMPLATES.cigarettes.name,
          habitType: HABIT_TEMPLATES.cigarettes.habitType,
          quantity: 1,
          action: "event",
        },
      }),
    ];

    const items = groupLogEntries(logs, habits);
    const cigaretteGroup = items.find(
      (item) => item.kind === "counter_habit" || item.kind === "event_habit",
    );

    expect(cigaretteGroup?.kind).toBe("counter_habit");
    expect(cigaretteGroup).toMatchObject({
      groupKey: HABIT_TEMPLATES.cigarettes.id,
      entries: expect.arrayContaining([expect.any(Object)]),
    });
    expect(cigaretteGroup?.entries).toHaveLength(2);
  });
});
