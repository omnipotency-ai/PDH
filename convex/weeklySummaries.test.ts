import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

describe("weeklySummaries", () => {
  it("creates a summary and queries by date range", async () => {
    const t = convexTest(schema);
    const weekStart = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const weekEnd = Date.now();

    await t.withIdentity({ subject: "test-user-123" }).mutation(api.weeklySummaries.add, {
      weekStartTimestamp: weekStart,
      weekEndTimestamp: weekEnd,
      weeklySummary: "Good week overall",
      keyFoods: {
        safe: ["banana"],
        flagged: ["spicy curry"],
        toTryNext: ["oatmeal"],
      },
      carryForwardNotes: ["Avoid late meals"],
      model: "test-model",
      durationMs: 500,
      generatedAt: Date.now(),
      promptVersion: 3,
    });

    const summary = await t
      .withIdentity({ subject: "test-user-123" })
      .query(api.weeklySummaries.getByWeek, {
        weekStartTimestamp: weekStart,
      });

    expect(summary).not.toBeNull();
    expect(summary?.weeklySummary).toBe("Good week overall");
    expect(summary?.keyFoods.safe).toContain("banana");
    expect(summary?.promptVersion).toBe(3);
  });

  it("throws when querying without auth identity", async () => {
    const t = convexTest(schema);
    await expect(t.query(api.weeklySummaries.getLatest, {})).rejects.toThrow("Not authenticated");
  });

  it("throws when adding summary without auth identity", async () => {
    const t = convexTest(schema);
    await expect(
      t.mutation(api.weeklySummaries.add, {
        weekStartTimestamp: Date.now(),
        weekEndTimestamp: Date.now(),
        weeklySummary: "test",
        keyFoods: { safe: [], flagged: [], toTryNext: [] },
        carryForwardNotes: [],
        model: "test",
        durationMs: 0,
        generatedAt: Date.now(),
      }),
    ).rejects.toThrow("Not authenticated");
  });
});
