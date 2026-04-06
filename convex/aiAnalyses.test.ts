import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { TEST_AI_INSIGHT, TEST_AI_REQUEST, TEST_AI_RESPONSE } from "./testFixtures";

describe("aiAnalyses", () => {
  it("queries analyses by userId", async () => {
    const t = convexTest(schema);
    const timestamp = Date.now();

    // Insert directly to avoid scheduler side effects
    await t.run(async (ctx) => {
      await ctx.db.insert("aiAnalyses", {
        userId: "test-user-123",
        timestamp,
        request: TEST_AI_REQUEST,
        response: TEST_AI_RESPONSE,
        insight: { ...TEST_AI_INSIGHT, summary: "All good" },
        model: "gpt-5.4-mini",
        durationMs: 1500,
        inputLogCount: 10,
      });
    });

    const analyses = await t
      .withIdentity({ subject: "test-user-123" })
      .query(api.aiAnalyses.list, {});
    expect(analyses.length).toBe(1);
    expect(analyses[0].model).toBe("gpt-5.4-mini");
    expect(analyses[0].inputLogCount).toBe(10);
  });

  it("throws when querying without auth identity", async () => {
    const t = convexTest(schema);
    await expect(t.query(api.aiAnalyses.list, {})).rejects.toThrow("Not authenticated");
  });

  it("toggles star on an analysis", async () => {
    const t = convexTest(schema);

    // Insert directly
    const id = await t.run(async (ctx) => {
      return await ctx.db.insert("aiAnalyses", {
        userId: "test-user-123",
        timestamp: Date.now(),
        request: TEST_AI_REQUEST,
        response: TEST_AI_RESPONSE,
        insight: TEST_AI_INSIGHT,
        model: "test",
        durationMs: 100,
        inputLogCount: 1,
      });
    });

    // Toggle star on
    const starred = await t
      .withIdentity({ subject: "test-user-123" })
      .mutation(api.aiAnalyses.toggleStar, { id });
    expect(starred).toBe(true);

    // Toggle star off
    const unstarred = await t
      .withIdentity({ subject: "test-user-123" })
      .mutation(api.aiAnalyses.toggleStar, { id });
    expect(unstarred).toBe(false);
  });

  it("returns latest analysis", async () => {
    const t = convexTest(schema);
    const now = Date.now();

    // Insert directly to avoid scheduler
    await t.run(async (ctx) => {
      await ctx.db.insert("aiAnalyses", {
        userId: "test-user-123",
        timestamp: now - 10000,
        request: TEST_AI_REQUEST,
        response: TEST_AI_RESPONSE,
        insight: { ...TEST_AI_INSIGHT, summary: "Old report" },
        model: "test",
        durationMs: 100,
        inputLogCount: 1,
      });
      await ctx.db.insert("aiAnalyses", {
        userId: "test-user-123",
        timestamp: now,
        request: TEST_AI_REQUEST,
        response: TEST_AI_RESPONSE,
        insight: { ...TEST_AI_INSIGHT, summary: "New report" },
        model: "test",
        durationMs: 100,
        inputLogCount: 2,
      });
    });

    const latest = await t
      .withIdentity({ subject: "test-user-123" })
      .query(api.aiAnalyses.latest, {});
    expect(latest).not.toBeNull();
    expect(latest?.insight).not.toBeNull();
    if (latest?.insight) {
      expect(latest.insight.summary).toBe("New report");
    }
    expect(latest?.inputLogCount).toBe(2);
  });

  it("throws toggleStar without auth", async () => {
    const t = convexTest(schema);
    const id = await t.run(async (ctx) => {
      return await ctx.db.insert("aiAnalyses", {
        userId: "test-user-123",
        timestamp: Date.now(),
        request: TEST_AI_REQUEST,
        response: TEST_AI_RESPONSE,
        insight: TEST_AI_INSIGHT,
        model: "test",
        durationMs: 100,
        inputLogCount: 1,
      });
    });

    await expect(t.mutation(api.aiAnalyses.toggleStar, { id })).rejects.toThrow(
      "Not authenticated",
    );
  });
});
