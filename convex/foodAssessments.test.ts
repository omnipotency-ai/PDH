import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import schema from "./schema";
import { TEST_AI_INSIGHT, TEST_AI_REQUEST, TEST_AI_RESPONSE } from "./testFixtures";

describe("foodAssessments", () => {
  it("queries assessments by userId", async () => {
    const t = convexTest(schema);

    // Insert an aiAnalysis first (required for foreign key)
    const aiAnalysisId = await t.run(async (ctx) => {
      return await ctx.db.insert("aiAnalyses", {
        userId: "test-user-123",
        timestamp: Date.now(),
        request: TEST_AI_REQUEST,
        response: TEST_AI_RESPONSE,
        insight: TEST_AI_INSIGHT,
        model: "test-model",
        durationMs: 100,
        inputLogCount: 5,
      });
    });

    // Insert with the correct canonical name (as the migration ensures)
    await t.run(async (ctx) => {
      await ctx.db.insert("foodAssessments", {
        userId: "test-user-123",
        aiAnalysisId,
        reportTimestamp: Date.now(),
        foodName: "Banana",
        canonicalName: "ripe banana",
        verdict: "safe",
        reasoning: "Well tolerated",
      });
    });

    const foods = await t
      .withIdentity({ subject: "test-user-123" })
      .query(api.foodAssessments.allFoods, {});
    expect(foods.foods.length).toBe(1);
    expect(foods.foods[0].canonicalName).toBe("ripe banana");
    expect(foods.foods[0].originalFoodName).toBe("Banana");
    expect(foods.foods[0].latestVerdict).toBe("safe");
    expect(foods.isTruncated).toBe(false);
  });

  it("throws when querying without auth identity", async () => {
    const t = convexTest(schema);
    await expect(t.query(api.foodAssessments.allFoods, {})).rejects.toThrow("Not authenticated");
  });

  it("deduplicates assessments by canonical name in allFoods", async () => {
    const t = convexTest(schema);
    const userId = "test-user-123";
    const baseTime = Date.UTC(2026, 2, 15, 9, 0, 0);

    const aiAnalysisId = await t.run(async (ctx) => {
      return await ctx.db.insert("aiAnalyses", {
        userId,
        timestamp: baseTime,
        request: TEST_AI_REQUEST,
        response: TEST_AI_RESPONSE,
        insight: TEST_AI_INSIGHT,
        model: "test-model",
        durationMs: 100,
        inputLogCount: 2,
      });
    });

    // Both rows have the same canonical name (as the migration would ensure).
    // allFoods should deduplicate and return only the latest.
    await t.run(async (ctx) => {
      await ctx.db.insert("foodAssessments", {
        userId,
        aiAnalysisId,
        reportTimestamp: baseTime + 1,
        foodName: "Fresh Baked Baguette",
        canonicalName: "white bread",
        verdict: "watch",
        reasoning: "Earlier assessment.",
      });
      await ctx.db.insert("foodAssessments", {
        userId,
        aiAnalysisId,
        reportTimestamp: baseTime + 2,
        foodName: "White Bread",
        canonicalName: "white bread",
        verdict: "safe",
        reasoning: "Later assessment.",
      });
    });

    const foods = await t.withIdentity({ subject: userId }).query(api.foodAssessments.allFoods, {});
    expect(foods.foods).toHaveLength(1);
    expect(foods.foods[0]?.canonicalName).toBe("white bread");
    expect(foods.foods[0]?.foodName).toBe("White Bread");
    expect(foods.foods[0]?.originalFoodName).toBe("White Bread");
    expect(foods.foods[0]?.latestVerdict).toBe("safe");
    expect(foods.isTruncated).toBe(false);

    // historyByFood should return both rows for the same canonical name
    const history = await t
      .withIdentity({ subject: userId })
      .query(api.foodAssessments.historyByFood, {
        canonicalName: "white bread",
      });
    expect(history).toHaveLength(2);
    expect(
      history.every((row: Doc<"foodAssessments">) => row.canonicalName === "white bread"),
    ).toBe(true);
    expect(history[0]?.foodName).toBe("White Bread");
    expect(history[1]?.foodName).toBe("Fresh Baked Baguette");
  });

  it("returns both legacy culprits and current avoid verdicts from the flagged query", async () => {
    const t = convexTest(schema);
    const userId = "test-user-123";

    const aiAnalysisId = await t.run(async (ctx) => {
      return await ctx.db.insert("aiAnalyses", {
        userId,
        timestamp: Date.now(),
        request: TEST_AI_REQUEST,
        response: TEST_AI_RESPONSE,
        insight: TEST_AI_INSIGHT,
        model: "test-model",
        durationMs: 100,
        inputLogCount: 5,
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("foodAssessments", {
        userId,
        aiAnalysisId,
        reportTimestamp: Date.now(),
        foodName: "Spicy Curry",
        canonicalName: "spicy curry",
        verdict: "culprit",
        reasoning: "Legacy verdict.",
      });
      await ctx.db.insert("foodAssessments", {
        userId,
        aiAnalysisId,
        reportTimestamp: Date.now() + 1,
        foodName: "Raw Onion",
        canonicalName: "raw onion",
        verdict: "avoid",
        reasoning: "Current fused verdict.",
      });
    });

    const flagged = await t
      .withIdentity({ subject: userId })
      .query(api.foodAssessments.culprits, {});

    expect(flagged).toHaveLength(2);
    expect(flagged.map((row: Doc<"foodAssessments">) => row.verdict).sort()).toEqual([
      "avoid",
      "culprit",
    ]);
  });

  it("canonicalizes history lookups before querying", async () => {
    const t = convexTest(schema);
    const userId = "test-user-123";

    const aiAnalysisId = await t.run(async (ctx) => {
      return await ctx.db.insert("aiAnalyses", {
        userId,
        timestamp: Date.now(),
        request: TEST_AI_REQUEST,
        response: TEST_AI_RESPONSE,
        insight: TEST_AI_INSIGHT,
        model: "test-model",
        durationMs: 100,
        inputLogCount: 5,
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("foodAssessments", {
        userId,
        aiAnalysisId,
        reportTimestamp: Date.now(),
        foodName: "Scrambled Egg",
        canonicalName: "egg",
        verdict: "safe",
        reasoning: "Mapped to canonical egg.",
      });
    });

    // Caller passes display name "Scrambled Egg" — should be normalized to "egg"
    const history = await t
      .withIdentity({ subject: userId })
      .query(api.foodAssessments.historyByFood, {
        canonicalName: "Scrambled Egg",
      });

    expect(history).toHaveLength(1);
    expect(history[0]?.canonicalName).toBe("egg");
  });

  it("returns safe foods without re-normalizing stored canonical names", async () => {
    const t = convexTest(schema);
    const userId = "test-user-123";

    const aiAnalysisId = await t.run(async (ctx) => {
      return await ctx.db.insert("aiAnalyses", {
        userId,
        timestamp: Date.now(),
        request: TEST_AI_REQUEST,
        response: TEST_AI_RESPONSE,
        insight: TEST_AI_INSIGHT,
        model: "test-model",
        durationMs: 100,
        inputLogCount: 3,
      });
    });

    // Insert with the correct canonical name (as the migration ensures)
    await t.run(async (ctx) => {
      await ctx.db.insert("foodAssessments", {
        userId,
        aiAnalysisId,
        reportTimestamp: Date.now(),
        foodName: "Banana",
        canonicalName: "ripe banana",
        verdict: "safe",
        reasoning: "Stored with correct canonical name after migration.",
      });
    });

    const safes = await t
      .withIdentity({ subject: userId })
      .query(api.foodAssessments.safeFoods, {});

    expect(safes).toHaveLength(1);
    expect(safes[0]?.canonicalName).toBe("ripe banana");
    // Original foodName is preserved as-is
    expect(safes[0]?.foodName).toBe("Banana");
  });
});
