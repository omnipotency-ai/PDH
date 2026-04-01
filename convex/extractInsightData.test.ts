import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import {
  TEST_AI_INSIGHT,
  TEST_AI_INSIGHT_WITH_FOODS,
  TEST_AI_REQUEST,
  TEST_AI_RESPONSE,
} from "./testFixtures";

describe("extractInsightData", () => {
  it("throws without auth identity", async () => {
    const t = convexTest(schema);
    await expect(
      t.mutation(api.extractInsightData.backfillAll, {}),
    ).rejects.toThrow("Not authenticated");
  });

  it("skips already fully processed analyses", async () => {
    const t = convexTest(schema);

    // Create an AI analysis
    const aiAnalysisId = await t.run(async (ctx) => {
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

    // Create existing food assessment (marks it as fully processed)
    await t.run(async (ctx) => {
      await ctx.db.insert("foodAssessments", {
        userId: "test-user-123",
        aiAnalysisId,
        reportTimestamp: Date.now(),
        foodName: "Existing",
        canonicalName: "existing",
        verdict: "safe",
        reasoning: "Already extracted",
      });
    });

    const result = await t
      .withIdentity({ subject: "test-user-123" })
      .mutation(api.extractInsightData.backfillAll, {});

    // Should skip the already processed analysis
    expect(result.scheduled).toBe(0);
  });

  describe("with fake timers (needed for finishAllScheduledFunctions)", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("schedules analyses when food assessments are missing", async () => {
      const t = convexTest(schema);

      await t.run(async (ctx) => {
        return await ctx.db.insert("aiAnalyses", {
          userId: "test-user-123",
          timestamp: Date.now(),
          request: TEST_AI_REQUEST,
          response: TEST_AI_RESPONSE,
          insight: TEST_AI_INSIGHT_WITH_FOODS,
          model: "test",
          durationMs: 100,
          inputLogCount: 1,
        });
      });

      const result = await t
        .withIdentity({ subject: "test-user-123" })
        .mutation(api.extractInsightData.backfillAll, {});

      expect(result.scheduled).toBe(1);
      await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    });
  });

  it("only processes own user analyses", async () => {
    const t = convexTest(schema);

    // Create analysis for different user
    await t.run(async (ctx) => {
      await ctx.db.insert("aiAnalyses", {
        userId: "other-user",
        timestamp: Date.now(),
        request: TEST_AI_REQUEST,
        response: TEST_AI_RESPONSE,
        insight: { ...TEST_AI_INSIGHT, suggestions: ["Other user suggestion"] },
        model: "test",
        durationMs: 100,
        inputLogCount: 1,
      });
    });

    const result = await t
      .withIdentity({ subject: "test-user-123" })
      .mutation(api.extractInsightData.backfillAll, {});

    // Should not process other user's analyses
    expect(result.scheduled).toBe(0);
  });

  it("returns zero scheduled when no unprocessed analyses", async () => {
    const t = convexTest(schema);

    // No analyses at all
    const result = await t
      .withIdentity({ subject: "test-user-123" })
      .mutation(api.extractInsightData.backfillAll, {});

    expect(result.scheduled).toBe(0);
  });

  it("extracts structured food assessments into normalized rows", async () => {
    const t = convexTest(schema);

    const aiAnalysisId = await t.run(async (ctx) => {
      return await ctx.db.insert("aiAnalyses", {
        userId: "test-user-123",
        timestamp: Date.now(),
        request: TEST_AI_REQUEST,
        response: TEST_AI_RESPONSE,
        insight: TEST_AI_INSIGHT_WITH_FOODS,
        model: "test",
        durationMs: 100,
        inputLogCount: 1,
      });
    });

    const result = await t.mutation(
      internal.extractInsightData.extractFromReport,
      {
        aiAnalysisId,
        skipScheduling: true,
      },
    );

    expect(result.extracted).toBe(true);

    const spicyCurry = await t
      .withIdentity({ subject: "test-user-123" })
      .query(api.foodAssessments.historyByFood, {
        canonicalName: "spicy curry",
      });
    const rice = await t
      .withIdentity({ subject: "test-user-123" })
      .query(api.foodAssessments.historyByFood, {
        canonicalName: "rice",
      });
    const oatmeal = await t
      .withIdentity({ subject: "test-user-123" })
      .query(api.foodAssessments.historyByFood, {
        canonicalName: "oatmeal",
      });

    expect(spicyCurry[0]?.verdict).toBe("avoid");
    expect(spicyCurry[0]?.causalRole).toBe("primary");
    expect(rice[0]?.verdict).toBe("safe");
    expect(oatmeal[0]?.verdict).toBe("trial_next");
  });

  it("extracts canonical structured food assessments without duplicating legacy fallback rows", async () => {
    const t = convexTest(schema);
    const reportTimestamp = Date.UTC(2026, 1, 14, 9, 30, 0);

    const aiAnalysisId = await t.run(async (ctx) => {
      return await ctx.db.insert("aiAnalyses", {
        userId: "test-user-123",
        timestamp: reportTimestamp,
        request: TEST_AI_REQUEST,
        response: TEST_AI_RESPONSE,
        insight: {
          ...TEST_AI_INSIGHT,
          foodAssessments: [
            {
              food: "  Plain Toast  ",
              verdict: "safe",
              confidence: "high",
              causalRole: "unlikely",
              changeType: "upgraded",
              modifierSummary: "No accelerants in scope.",
              reasoning: "Five calm trials and no matching bad output.",
            },
            {
              food: "Espresso",
              verdict: "watch",
              confidence: "medium",
              causalRole: "possible",
              changeType: "new",
              modifierSummary: "Nicotine compressed the likely transit window.",
              reasoning: "Output landed in a mixed/confounded window.",
            },
          ],
          suspectedCulprits: [
            {
              food: "Legacy Chili",
              confidence: "high",
              reasoning: "Legacy fallback should be ignored.",
            },
          ],
          suggestions: ["Keep the next coffee away from nicotine."],
        },
        model: "test",
        durationMs: 100,
        inputLogCount: 2,
      });
    });

    const result = await t.mutation(
      internal.extractInsightData.extractFromReport,
      {
        aiAnalysisId,
        skipScheduling: true,
      },
    );

    expect(result).toEqual({ extracted: true });

    const assessments = await t.run(async (ctx) => {
      return await ctx.db
        .query("foodAssessments")
        .withIndex("by_aiAnalysisId", (q) => q.eq("aiAnalysisId", aiAnalysisId))
        .collect();
    });

    expect(assessments).toHaveLength(2);
    expect(
      assessments.map((assessment) => assessment.canonicalName).sort(),
    ).toEqual(["coffee", "toast"]);

    const toast = assessments.find(
      (assessment) => assessment.canonicalName === "toast",
    );
    expect(toast).toMatchObject({
      foodName: "White Toast", // formatCanonicalFoodDisplayName("toast") uses display override
      verdict: "safe",
      confidence: "high",
      causalRole: "unlikely",
      changeType: "upgraded",
      modifierSummary: "No accelerants in scope.",
      reasoning: "Five calm trials and no matching bad output.",
    });

    // "Espresso" is now canonicalized to "coffee" via registry alias
    const coffeeAssessment = assessments.find(
      (assessment) => assessment.canonicalName === "coffee",
    );
    expect(coffeeAssessment).toMatchObject({
      foodName: "Coffee",
      verdict: "watch",
      confidence: "medium",
      causalRole: "possible",
      changeType: "new",
      modifierSummary: "Nicotine compressed the likely transit window.",
      reasoning: "Output landed in a mixed/confounded window.",
    });
  });

  it("does not duplicate food assessments on re-extraction", async () => {
    const t = convexTest(schema);

    const aiAnalysisId = await t.run(async (ctx) => {
      return await ctx.db.insert("aiAnalyses", {
        userId: "test-user-123",
        timestamp: Date.now(),
        request: TEST_AI_REQUEST,
        response: TEST_AI_RESPONSE,
        insight: TEST_AI_INSIGHT_WITH_FOODS,
        model: "test",
        durationMs: 100,
        inputLogCount: 1,
      });
    });

    // First extraction
    const result1 = await t.mutation(
      internal.extractInsightData.extractFromReport,
      {
        aiAnalysisId,
        skipScheduling: true,
      },
    );
    expect(result1).toEqual({ extracted: true });

    // Second extraction should not insert duplicates
    const result2 = await t.mutation(
      internal.extractInsightData.extractFromReport,
      {
        aiAnalysisId,
        skipScheduling: true,
      },
    );
    expect(result2).toEqual({ extracted: false });

    const assessments = await t.run(async (ctx) => {
      return await ctx.db
        .query("foodAssessments")
        .withIndex("by_aiAnalysisId", (q) => q.eq("aiAnalysisId", aiAnalysisId))
        .collect();
    });

    expect(assessments).toHaveLength(3);
  });

  it("repairs partially extracted reports by mirroring visible food verdicts into structured rows", async () => {
    const t = convexTest(schema);
    const reportTimestamp = Date.UTC(2026, 2, 15, 14, 54, 44);

    const aiAnalysisId = await t.run(async (ctx) => {
      return await ctx.db.insert("aiAnalyses", {
        userId: "test-user-123",
        timestamp: reportTimestamp,
        request: TEST_AI_REQUEST,
        response: TEST_AI_RESPONSE,
        insight: {
          ...TEST_AI_INSIGHT,
          foodAssessments: [
            {
              food: "Roast Chicken Breast",
              verdict: "safe",
              confidence: "high",
              causalRole: "unlikely",
              changeType: "unchanged",
              modifierSummary: "Outside the loose-output window.",
              reasoning: "Repeated clean exposure.",
            },
          ],
          suspectedCulprits: [
            {
              food: "Biscoff",
              confidence: "medium",
              reasoning: "This still sits inside the loose-output window.",
            },
          ],
        },
        model: "test",
        durationMs: 100,
        inputLogCount: 2,
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("foodAssessments", {
        userId: "test-user-123",
        aiAnalysisId,
        reportTimestamp,
        foodName: "Roast Chicken Breast",
        canonicalName: "grilled white meat",
        verdict: "safe",
        confidence: "high",
        causalRole: "unlikely",
        changeType: "unchanged",
        modifierSummary: "Outside the loose-output window.",
        reasoning: "Repeated clean exposure.",
      });
    });

    const result = await t.mutation(
      internal.extractInsightData.extractFromReport,
      {
        aiAnalysisId,
        skipScheduling: true,
      },
    );

    expect(result).toEqual({ extracted: true });

    const assessments = await t.run(async (ctx) =>
      ctx.db
        .query("foodAssessments")
        .withIndex("by_aiAnalysisId", (q) => q.eq("aiAnalysisId", aiAnalysisId))
        .collect(),
    );

    expect(
      assessments.map((assessment) => assessment.canonicalName).sort(),
    ).toEqual(["grilled white meat", "high-sugar refined snack"]);

    const biscoff = assessments.find(
      (assessment) => assessment.canonicalName === "high-sugar refined snack",
    );
    expect(biscoff).toMatchObject({
      foodName: "High-sugar Refined Snack",
      verdict: "watch",
      confidence: "medium",
    });
  });
});
