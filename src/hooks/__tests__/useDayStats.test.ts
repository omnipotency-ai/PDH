import { describe, expect, it } from "vitest";
import type { SyncedLog } from "@/lib/sync";
import { summarizeTodayFluidTotals } from "../useDayStats";

function makeLog(overrides: Partial<SyncedLog> & Pick<SyncedLog, "type" | "timestamp">): SyncedLog {
  return {
    id: `${overrides.type}-${overrides.timestamp}`,
    type: overrides.type,
    timestamp: overrides.timestamp,
    data: overrides.data ?? { items: [] },
  } as SyncedLog;
}

describe("summarizeTodayFluidTotals", () => {
  it("counts liquid food logs toward total fluid intake", () => {
    const totals = summarizeTodayFluidTotals([
      makeLog({
        type: "fluid",
        timestamp: 1_000,
        data: { items: [{ name: "Water", quantity: 250, unit: "ml" }] },
      }),
      makeLog({
        type: "liquid",
        timestamp: 2_000,
        data: { items: [{ name: "Aquarius", quantity: 240, unit: "ml" }] },
      }),
      makeLog({
        type: "liquid",
        timestamp: 3_000,
        data: { items: [{ name: "Water", quantity: 100, unit: "ml" }] },
      }),
    ]);

    expect(totals.todayFluidTotalsByName).toEqual({
      water: 350,
      aquarius: 240,
    });
    expect(totals.totalFluidMl).toBe(590);
    expect(totals.waterOnlyMl).toBe(350);
  });
});
