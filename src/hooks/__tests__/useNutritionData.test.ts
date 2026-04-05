import { describe, expect, it } from "vitest";
import type { SyncedLog } from "@/lib/sync";
import { getNutritionDayBounds, splitNutritionLogsForWindow } from "../useNutritionData";

function makeLog(overrides: Partial<SyncedLog> & Pick<SyncedLog, "type" | "timestamp">): SyncedLog {
  return {
    id: `${overrides.type}-${overrides.timestamp}`,
    type: overrides.type,
    timestamp: overrides.timestamp,
    data: overrides.data ?? { items: [] },
  } as SyncedLog;
}

describe("getNutritionDayBounds", () => {
  it("returns the local start and end of the selected date", () => {
    const { startMs, endMs } = getNutritionDayBounds(new Date(2026, 3, 5, 16, 30));

    expect(new Date(startMs).getHours()).toBe(0);
    expect(new Date(startMs).getDate()).toBe(5);
    expect(endMs - startMs).toBe(24 * 60 * 60 * 1000);
  });
});

describe("splitNutritionLogsForWindow", () => {
  it("keeps only food/liquid/fluid logs inside the requested day window", () => {
    const { startMs, endMs } = getNutritionDayBounds(new Date(2026, 3, 5, 12, 0));
    const logs = [
      makeLog({ type: "food", timestamp: startMs + 1_000 }),
      makeLog({ type: "liquid", timestamp: startMs + 2_000 }),
      makeLog({
        type: "fluid",
        timestamp: startMs + 3_000,
        data: { items: [{ name: "Water", quantity: 250, unit: "ml" }] },
      }),
      makeLog({ type: "food", timestamp: endMs + 1_000 }),
      makeLog({ type: "digestion", timestamp: startMs + 4_000 }),
    ];

    const { todayFoodLogs, todayFluidLogs } = splitNutritionLogsForWindow(logs, startMs, endMs);

    expect(todayFoodLogs).toHaveLength(2);
    expect(todayFoodLogs.map((log) => log.type)).toEqual(["food", "liquid"]);
    expect(todayFluidLogs).toHaveLength(1);
    expect(todayFluidLogs[0]?.type).toBe("fluid");
  });
});
