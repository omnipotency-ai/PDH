import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

describe("aggregateQueries", () => {
  it("returns food trial data for authenticated user", async () => {
    const t = convexTest(schema);

    // Insert a food trial summary directly
    await t.run(async (ctx) => {
      await ctx.db.insert("foodTrialSummary", {
        userId: "test-user-123",
        canonicalName: "banana",
        displayName: "Banana",
        currentStatus: "safe",
        latestAiVerdict: "safe",
        totalAssessments: 3,
        culpritCount: 0,
        safeCount: 3,
        nextToTryCount: 0,
        firstSeenAt: Date.now() - 86400000,
        lastAssessedAt: Date.now(),
        latestReasoning: "Well tolerated",
        updatedAt: Date.now(),
      });
    });

    const trials = await t
      .withIdentity({ subject: "test-user-123" })
      .query(api.aggregateQueries.allFoodTrials, {});
    expect(trials.trials.length).toBe(1);
    expect(trials.trials[0].canonicalName).toBe("ripe banana");
    expect(trials.trials[0].currentStatus).toBe("safe");
    expect(trials.isTruncated).toBe(false);
  });

  it("throws when querying without auth identity", async () => {
    const t = convexTest(schema);
    await expect(t.query(api.aggregateQueries.allFoodTrials, {})).rejects.toThrow(
      "Not authenticated",
    );
  });

  it("filters food trials by status", async () => {
    const t = convexTest(schema);

    // Insert multiple food trials with different statuses
    await t.run(async (ctx) => {
      await ctx.db.insert("foodTrialSummary", {
        userId: "test-user-123",
        canonicalName: "banana",
        displayName: "Banana",
        currentStatus: "safe",
        latestAiVerdict: "safe",
        totalAssessments: 1,
        culpritCount: 0,
        safeCount: 1,
        nextToTryCount: 0,
        firstSeenAt: Date.now(),
        lastAssessedAt: Date.now(),
        latestReasoning: "OK",
        updatedAt: Date.now(),
      });
      await ctx.db.insert("foodTrialSummary", {
        userId: "test-user-123",
        canonicalName: "spicy-curry",
        displayName: "Spicy Curry",
        currentStatus: "culprit",
        latestAiVerdict: "culprit",
        latestConfidence: "high",
        totalAssessments: 2,
        culpritCount: 2,
        safeCount: 0,
        nextToTryCount: 0,
        firstSeenAt: Date.now(),
        lastAssessedAt: Date.now(),
        latestReasoning: "Triggers issues",
        updatedAt: Date.now(),
      });
    });

    const culprits = await t
      .withIdentity({ subject: "test-user-123" })
      .query(api.aggregateQueries.foodTrialsByStatus, { status: "culprit" });
    expect(culprits.length).toBe(1);
    expect(culprits[0].canonicalName).toBe("spicy curry");
  });

  it("dedupes stale summary aliases in allFoodTrials", async () => {
    const t = convexTest(schema);
    const userId = "test-user-123";
    const baseTime = Date.UTC(2026, 2, 15, 10, 0, 0);

    await t.run(async (ctx) => {
      await ctx.db.insert("foodTrialSummary", {
        userId,
        canonicalName: "white bread",
        displayName: "White Bread",
        currentStatus: "watch",
        latestAiVerdict: "watch",
        totalAssessments: 1,
        culpritCount: 0,
        safeCount: 0,
        nextToTryCount: 0,
        firstSeenAt: baseTime,
        lastAssessedAt: baseTime,
        latestReasoning: "Older canonical row.",
        updatedAt: baseTime,
      });
      await ctx.db.insert("foodTrialSummary", {
        userId,
        canonicalName: "baguette",
        displayName: "Baguette",
        currentStatus: "safe",
        latestAiVerdict: "safe",
        totalAssessments: 2,
        culpritCount: 0,
        safeCount: 2,
        nextToTryCount: 0,
        firstSeenAt: baseTime + 1,
        lastAssessedAt: baseTime + 1,
        latestReasoning: "Newer alias row.",
        updatedAt: baseTime + 1,
      });
    });

    // allFoodTrials still normalizes and deduplicates across canonical aliases
    const trials = await t
      .withIdentity({ subject: userId })
      .query(api.aggregateQueries.allFoodTrials, {});
    expect(trials.trials).toHaveLength(1);
    expect(trials.trials[0]?.canonicalName).toBe("white bread");
    expect(trials.trials[0]?.displayName).toBe("White Bread");
    expect(trials.trials[0]?.latestReasoning).toBe("Newer alias row.");
    expect(trials.isTruncated).toBe(false);
  });

  it("foodTrialByName uses indexed lookup by canonical name", async () => {
    const t = convexTest(schema);
    const userId = "test-user-123";
    const baseTime = Date.UTC(2026, 2, 15, 10, 0, 0);

    // Post-migration: each canonical name has exactly one row with the
    // normalized name. The canonicalName migration ensures DB values are
    // already normalized, so foodTrialByName uses a direct index lookup.
    await t.run(async (ctx) => {
      await ctx.db.insert("foodTrialSummary", {
        userId,
        canonicalName: "white bread",
        displayName: "White Bread",
        currentStatus: "safe",
        latestAiVerdict: "safe",
        totalAssessments: 2,
        culpritCount: 0,
        safeCount: 2,
        nextToTryCount: 0,
        firstSeenAt: baseTime,
        lastAssessedAt: baseTime + 1,
        latestReasoning: "Well tolerated.",
        updatedAt: baseTime + 1,
      });
    });

    const summary = await t
      .withIdentity({ subject: userId })
      .query(api.aggregateQueries.foodTrialByName, {
        canonicalName: "White Bread",
      });
    expect(summary).toBeDefined();
    expect(summary?.canonicalName).toBe("white bread");
    expect(summary?.latestReasoning).toBe("Well tolerated.");
  });

  it("canonicalizes food name lookups before querying summaries", async () => {
    const t = convexTest(schema);

    await t.run(async (ctx) => {
      await ctx.db.insert("foodTrialSummary", {
        userId: "test-user-123",
        canonicalName: "egg",
        displayName: "Egg",
        currentStatus: "safe",
        latestAiVerdict: "safe",
        totalAssessments: 1,
        culpritCount: 0,
        safeCount: 1,
        nextToTryCount: 0,
        firstSeenAt: Date.now(),
        lastAssessedAt: Date.now(),
        latestReasoning: "Mapped to canonical egg.",
        updatedAt: Date.now(),
      });
    });

    const summary = await t
      .withIdentity({ subject: "test-user-123" })
      .query(api.aggregateQueries.foodTrialByName, {
        canonicalName: "Scrambled Egg",
      });

    expect(summary).toBeDefined();
    expect(summary?.canonicalName).toBe("egg");
  });
});
