import { describe, expect, it } from "vitest";
import { analyzeLogs } from "@/lib/analysis";
import type { SyncedLog } from "@/lib/sync";

describe("analyzeLogs", () => {
  it("does not inject synthetic BRAT baseline rows with no evidence", () => {
    const result = analyzeLogs([]);
    expect(result.foodStats).toEqual([]);
  });

  it("uses canonical names for database rows while preserving alias history", () => {
    const baseTime = Date.UTC(2026, 2, 15, 9, 0, 0);
    const logs: SyncedLog[] = [
      {
        id: "food-1",
        timestamp: baseTime,
        type: "food",
        data: {
          items: [
            {
              parsedName: "baguette",
              userSegment: "baguette",
              canonicalName: "white bread",
              resolvedBy: "registry",
              quantity: 1,
              unit: "slice",
            },
          ],
        },
      },
      {
        id: "digestion-1",
        timestamp: baseTime + 20 * 60 * 60 * 1000,
        type: "digestion",
        data: {
          bristolCode: 4,
          episodesCount: 1,
        },
      },
    ];

    const result = analyzeLogs(logs);
    expect(result.foodStats).toHaveLength(1);
    expect(result.foodStats[0]?.key).toBe("white bread");
    expect(result.foodStats[0]?.name).toBe("White Bread");

    const trialHistory = result.resolvedTrialsByKey.get("white bread");
    expect(trialHistory).toHaveLength(1);
    expect(trialHistory?.[0]?.foodName).toBe("Baguette");
  });

  it("uses the white-toast label for the toast canonical row", () => {
    const baseTime = Date.UTC(2026, 2, 15, 9, 0, 0);
    const logs: SyncedLog[] = [
      {
        id: "food-1",
        timestamp: baseTime,
        type: "food",
        data: {
          items: [
            {
              parsedName: "toast",
              userSegment: "toast",
              canonicalName: "toast",
              resolvedBy: "registry",
              quantity: 1,
              unit: "slice",
            },
          ],
        },
      },
      {
        id: "digestion-1",
        timestamp: baseTime + 20 * 60 * 60 * 1000,
        type: "digestion",
        data: {
          bristolCode: 4,
          episodesCount: 1,
        },
      },
    ];

    const result = analyzeLogs(logs);
    expect(result.foodStats[0]?.key).toBe("toast");
    expect(result.foodStats[0]?.name).toBe("White Toast");
  });
});
