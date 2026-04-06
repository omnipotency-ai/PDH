import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { getWeekStart } from "../shared/weekUtils";
import {
  TEST_AI_INSIGHT,
  TEST_AI_REQUEST,
  TEST_AI_RESPONSE,
} from "./testFixtures";

describe("computeAggregates", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("backfills food trials only for foods with actual trials", async () => {
    const t = convexTest(schema);
    const now = Date.UTC(2026, 0, 1, 8, 0, 0);

    // Create an AI analysis
    const aiAnalysisId = await t.run(async (ctx) => {
      return await ctx.db.insert("aiAnalyses", {
        userId: "test-user-123",
        timestamp: now,
        request: TEST_AI_REQUEST,
        response: TEST_AI_RESPONSE,
        insight: TEST_AI_INSIGHT,
        model: "test",
        durationMs: 100,
        inputLogCount: 1,
      });
    });

    // Create food assessments and matching actual trials.
    await t.run(async (ctx) => {
      await ctx.db.insert("logs", {
        userId: "test-user-123",
        timestamp: now,
        type: "food",
        data: {
          items: [
            {
              name: "Banana",
              canonicalName: "banana",
              quantity: 1,
              unit: null,
            },
          ],
        },
      });
      await ctx.db.insert("logs", {
        userId: "test-user-123",
        timestamp: now + 8 * 60 * 60 * 1000,
        type: "digestion",
        data: { bristolCode: 4, episodesCount: 1 },
      });
      await ctx.db.insert("logs", {
        userId: "test-user-123",
        timestamp: now + 24 * 60 * 60 * 1000,
        type: "food",
        data: {
          items: [
            { name: "Rice", canonicalName: "rice", quantity: 1, unit: null },
          ],
        },
      });
      await ctx.db.insert("logs", {
        userId: "test-user-123",
        timestamp: now + 32 * 60 * 60 * 1000,
        type: "digestion",
        data: { bristolCode: 4, episodesCount: 1 },
      });

      await ctx.db.insert("foodAssessments", {
        userId: "test-user-123",
        aiAnalysisId,
        reportTimestamp: now,
        foodName: "Banana",
        canonicalName: "banana",
        verdict: "safe",
        reasoning: "Well tolerated",
      });
      await ctx.db.insert("foodAssessments", {
        userId: "test-user-123",
        aiAnalysisId,
        reportTimestamp: now + 24 * 60 * 60 * 1000,
        foodName: "Rice",
        canonicalName: "rice",
        verdict: "safe",
        reasoning: "Easy to digest",
      });
    });

    const result = await t
      .withIdentity({ subject: "test-user-123" })
      .mutation(api.computeAggregates.backfillFoodTrials, {});

    // Drain all scheduled backfill mutations before the test ends.
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());

    expect(result.scheduled).toBe(true);
  });

  it("throws backfillFoodTrials without auth", async () => {
    const t = convexTest(schema);
    await expect(
      t.mutation(api.computeAggregates.backfillFoodTrials, {}),
    ).rejects.toThrow("Not authenticated");
  });

  it("backfills weekly digests for authenticated user", async () => {
    const t = convexTest(schema);
    const now = Date.now();

    // Create a log entry
    await t.run(async (ctx) => {
      await ctx.db.insert("logs", {
        userId: "test-user-123",
        timestamp: now,
        type: "food",
        data: { items: [{ name: "banana", quantity: 1, unit: null }] },
      });
    });

    const result = await t
      .withIdentity({ subject: "test-user-123" })
      .mutation(api.computeAggregates.backfillWeeklyDigests, { now });

    // Drain all scheduled backfill mutations before the test ends.
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());

    expect(result.scheduled).toBe(true);
  });

  it("counts current avoid verdicts in weekly digest top culprits", async () => {
    const t = convexTest(schema);
    const userId = "test-user-123";
    // Use current timestamp so the digest falls in the "current week" window
    const now = Date.now();

    await t.run(async (ctx) => {
      const aiAnalysisId = await ctx.db.insert("aiAnalyses", {
        userId,
        timestamp: now,
        request: TEST_AI_REQUEST,
        response: TEST_AI_RESPONSE,
        insight: TEST_AI_INSIGHT,
        model: "test",
        durationMs: 100,
        inputLogCount: 1,
      });

      await ctx.db.insert("logs", {
        userId,
        timestamp: now,
        type: "food",
        data: {
          items: [
            {
              name: "Raw Onion",
              canonicalName: "raw onion",
              quantity: 1,
              unit: null,
            },
          ],
        },
      });

      await ctx.db.insert("foodAssessments", {
        userId,
        aiAnalysisId,
        reportTimestamp: now,
        foodName: "Raw Onion",
        canonicalName: "raw onion",
        verdict: "avoid",
        reasoning: "Current fused avoid verdict.",
      });
    });

    await t.mutation(internal.computeAggregates.updateWeeklyDigest, {
      userId,
      eventTimestamp: now,
      now,
    });

    // Compute Monday 00:00:00 UTC for the week containing `now`.
    const monday = getWeekStart(now);

    const digest = await t
      .withIdentity({ subject: userId })
      .query(api.aggregateQueries.currentWeekDigest, { weekStartMs: monday.weekStartTimestamp });

    expect(digest).toBeDefined();
    expect(digest?.foodsFlagged).toBe(1);
    expect(digest?.topCulprits).toEqual(["raw onion"]);
  });

  it("counts weekly foods by canonical identity instead of raw item names", async () => {
    const t = convexTest(schema);
    const userId = "test-user-123";
    const priorWeek = Date.UTC(2026, 2, 2, 10, 0, 0);
    const currentWeek = Date.UTC(2026, 2, 9, 10, 0, 0);

    await t.run(async (ctx) => {
      // Profile with knownFoods set simulating that "egg" was previously
      // logged (in production, writeProcessedItems would have populated this).
      await ctx.db.insert("profiles", {
        userId,
        unitSystem: "metric",
        habits: [],
        knownFoods: ["egg"],
        updatedAt: priorWeek,
      });

      await ctx.db.insert("logs", {
        userId,
        timestamp: priorWeek,
        type: "food",
        data: {
          items: [
            {
              name: "Egg",
              canonicalName: "egg",
              quantity: 1,
              unit: null,
            },
          ],
        },
      });

      await ctx.db.insert("logs", {
        userId,
        timestamp: currentWeek,
        type: "food",
        data: {
          items: [
            {
              parsedName: "Scrambled Eggs",
              userSegment: "two scrambled eggs",
              resolvedBy: "registry",
              canonicalName: "egg",
              quantity: 2,
              unit: null,
            },
            {
              parsedName: "Poached Egg",
              userSegment: "Poached Egg",
              resolvedBy: "registry",
              canonicalName: "egg",
              quantity: 1,
              unit: null,
            },
          ],
        },
      });
    });

    await t.mutation(internal.computeAggregates.updateWeeklyDigest, {
      userId,
      eventTimestamp: currentWeek,
      now: currentWeek,
    });

    const digest = await t.run(async (ctx) => {
      return await ctx.db
        .query("weeklyDigest")
        .withIndex("by_userId_weekStart", (q) => q.eq("userId", userId))
        .order("desc")
        .first();
    });

    expect(digest).toBeDefined();
    expect(digest?.uniqueFoodsEaten).toBe(1);
    expect(digest?.newFoodsTried).toBe(0);
  });

  it("detects new foods using knownFoods set instead of historical scan", async () => {
    const t = convexTest(schema);
    const userId = "test-user-123";
    const currentWeek = Date.UTC(2026, 2, 9, 10, 0, 0);

    await t.run(async (ctx) => {
      // Profile with no knownFoods — all foods this week should be "new"
      await ctx.db.insert("profiles", {
        userId,
        unitSystem: "metric",
        habits: [],
        updatedAt: currentWeek - 1000,
      });

      await ctx.db.insert("logs", {
        userId,
        timestamp: currentWeek,
        type: "food",
        data: {
          items: [
            {
              parsedName: "Toast",
              userSegment: "toast",
              resolvedBy: "registry",
              canonicalName: "toast",
              quantity: 1,
              unit: null,
            },
            {
              parsedName: "Banana",
              userSegment: "banana",
              resolvedBy: "registry",
              canonicalName: "ripe banana",
              quantity: 1,
              unit: null,
            },
          ],
        },
      });
    });

    await t.mutation(internal.computeAggregates.updateWeeklyDigest, {
      userId,
      eventTimestamp: currentWeek,
      now: currentWeek,
    });

    const digest = await t.run(async (ctx) => {
      return await ctx.db
        .query("weeklyDigest")
        .withIndex("by_userId_weekStart", (q) => q.eq("userId", userId))
        .order("desc")
        .first();
    });

    expect(digest).toBeDefined();
    expect(digest?.uniqueFoodsEaten).toBe(2);
    // Both foods are new since knownFoods was empty
    expect(digest?.newFoodsTried).toBe(2);

    // Verify the profile's knownFoods was updated with this week's foods
    const profile = await t.run(async (ctx) => {
      return await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();
    });

    expect(profile?.knownFoods).toBeDefined();
    const known = new Set(profile?.knownFoods ?? []);
    expect(known.has("toast")).toBe(true);
    expect(known.has("ripe banana")).toBe(true);
  });

  it("does not count known foods as new in weekly digest", async () => {
    const t = convexTest(schema);
    const userId = "test-user-123";
    const currentWeek = Date.UTC(2026, 2, 9, 10, 0, 0);

    await t.run(async (ctx) => {
      // Profile already knows about toast from a prior week
      await ctx.db.insert("profiles", {
        userId,
        unitSystem: "metric",
        habits: [],
        knownFoods: ["toast"],
        updatedAt: currentWeek - 1000,
      });

      await ctx.db.insert("logs", {
        userId,
        timestamp: currentWeek,
        type: "food",
        data: {
          items: [
            {
              parsedName: "Toast",
              userSegment: "toast",
              resolvedBy: "registry",
              canonicalName: "toast",
              quantity: 1,
              unit: null,
            },
            {
              parsedName: "Banana",
              userSegment: "banana",
              resolvedBy: "registry",
              canonicalName: "ripe banana",
              quantity: 1,
              unit: null,
            },
          ],
        },
      });
    });

    await t.mutation(internal.computeAggregates.updateWeeklyDigest, {
      userId,
      eventTimestamp: currentWeek,
      now: currentWeek,
    });

    const digest = await t.run(async (ctx) => {
      return await ctx.db
        .query("weeklyDigest")
        .withIndex("by_userId_weekStart", (q) => q.eq("userId", userId))
        .order("desc")
        .first();
    });

    expect(digest).toBeDefined();
    expect(digest?.uniqueFoodsEaten).toBe(2);
    // Only "ripe banana" is new; "toast" was already known
    expect(digest?.newFoodsTried).toBe(1);

    // Verify "ripe banana" was added to knownFoods
    const profile = await t.run(async (ctx) => {
      return await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();
    });

    const known = new Set(profile?.knownFoods ?? []);
    expect(known.has("toast")).toBe(true);
    expect(known.has("ripe banana")).toBe(true);
  });

  it("backfills knownFoods from existing food logs", async () => {
    const t = convexTest(schema);
    const userId = "test-user-123";
    const baseTime = Date.UTC(2026, 2, 1, 8, 0, 0);

    await t.run(async (ctx) => {
      await ctx.db.insert("profiles", {
        userId,
        unitSystem: "metric",
        habits: [],
        updatedAt: baseTime,
      });

      // Two food logs with different canonical names
      await ctx.db.insert("logs", {
        userId,
        timestamp: baseTime,
        type: "food",
        data: {
          items: [
            {
              name: "Toast",
              canonicalName: "toast",
              quantity: 1,
              unit: null,
            },
          ],
        },
      });
      await ctx.db.insert("logs", {
        userId,
        timestamp: baseTime + 1000,
        type: "food",
        data: {
          items: [
            {
              name: "Banana",
              canonicalName: "ripe banana",
              quantity: 1,
              unit: null,
            },
          ],
        },
      });
      // Non-food log should be ignored
      await ctx.db.insert("logs", {
        userId,
        timestamp: baseTime + 2000,
        type: "digestion",
        data: { bristolCode: 4, episodesCount: 1 },
      });
    });

    const result = await t
      .withIdentity({ subject: userId })
      .mutation(api.computeAggregates.backfillKnownFoods, {});

    expect(result.scheduled).toBe(true);

    // Drain all scheduled backfill mutations
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());

    const profile = await t.run(async (ctx) => {
      return await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();
    });

    expect(profile?.knownFoods).toBeDefined();
    const known = new Set(profile?.knownFoods ?? []);
    expect(known.has("toast")).toBe(true);
    expect(known.has("ripe banana")).toBe(true);
    expect(known.size).toBe(2);
  });

  it("throws backfillKnownFoods without auth", async () => {
    const t = convexTest(schema);
    await expect(
      t.mutation(api.computeAggregates.backfillKnownFoods, {}),
    ).rejects.toThrow("Not authenticated");
  });

  it("throws backfillWeeklyDigests without auth", async () => {
    const t = convexTest(schema);
    await expect(
      t.mutation(api.computeAggregates.backfillWeeklyDigests, {
        now: Date.now(),
      }),
    ).rejects.toThrow("Not authenticated");
  });

  it("schedules backfill even when no logs exist", async () => {
    const t = convexTest(schema);

    const result = await t
      .withIdentity({ subject: "test-user-123" })
      .mutation(api.computeAggregates.backfillWeeklyDigests, {
        now: Date.now(),
      });

    // Drain all scheduled backfill mutations before the test ends.
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());

    // The mutation just schedules the worker; it always returns scheduled: true.
    expect(result.scheduled).toBe(true);
  });

  it("uses the report timestamp when recomputing with no logs or assessments", async () => {
    const t = convexTest(schema);
    const userId = "test-user-123";
    const reportTimestamp = Date.UTC(2026, 2, 10, 9, 0, 0);

    const aiAnalysisId = await t.run(async (ctx) => {
      await ctx.db.insert("profiles", {
        userId,
        unitSystem: "metric",
        habits: [],
        updatedAt: reportTimestamp - 10_000,
      });

      return await ctx.db.insert("aiAnalyses", {
        userId,
        timestamp: reportTimestamp,
        request: TEST_AI_REQUEST,
        response: TEST_AI_RESPONSE,
        insight: TEST_AI_INSIGHT,
        model: "test",
        durationMs: 100,
        inputLogCount: 0,
      });
    });

    const result = await t.mutation(
      internal.computeAggregates.updateFoodTrialSummary,
      {
        userId,
        aiAnalysisId,
      },
    );

    expect(result.updated).toBe(0);

    const profile = await t.run(async (ctx) => {
      return await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();
    });

    expect(profile?.updatedAt).toBe(reportTimestamp);
  });

  it("deletes stale duplicate summary rows after canonical normalization", async () => {
    const t = convexTest(schema);
    const userId = "test-user-123";
    const baseTime = Date.UTC(2026, 2, 12, 8, 0, 0);

    const aiAnalysisId = await t.run(async (ctx) => {
      await ctx.db.insert("profiles", {
        userId,
        unitSystem: "metric",
        habits: [],
        updatedAt: baseTime,
      });

      await ctx.db.insert("logs", {
        userId,
        timestamp: baseTime,
        type: "food",
        data: {
          items: [
            {
              name: "Fresh Baked Baguette",
              canonicalName: "baguette",
              quantity: 1,
              unit: "slice",
            },
          ],
        },
      });
      await ctx.db.insert("logs", {
        userId,
        timestamp: baseTime + 8 * 60 * 60 * 1000,
        type: "digestion",
        data: { bristolCode: 4, episodesCount: 1 },
      });

      const inserted = await ctx.db.insert("aiAnalyses", {
        userId,
        timestamp: baseTime + 9 * 60 * 60 * 1000,
        request: TEST_AI_REQUEST,
        response: TEST_AI_RESPONSE,
        insight: TEST_AI_INSIGHT,
        model: "test",
        durationMs: 100,
        inputLogCount: 1,
      });

      await ctx.db.insert("foodAssessments", {
        userId,
        aiAnalysisId: inserted,
        reportTimestamp: baseTime + 9 * 60 * 60 * 1000,
        foodName: "Fresh Baked Baguette",
        canonicalName: "baguette",
        verdict: "safe",
        reasoning: "Alias stored before the registry merge.",
      });

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
        firstSeenAt: baseTime - 2,
        lastAssessedAt: baseTime - 2,
        latestReasoning: "Older canonical row.",
        updatedAt: baseTime - 2,
      });
      await ctx.db.insert("foodTrialSummary", {
        userId,
        canonicalName: "baguette",
        displayName: "Baguette",
        currentStatus: "safe",
        latestAiVerdict: "safe",
        totalAssessments: 1,
        culpritCount: 0,
        safeCount: 1,
        nextToTryCount: 0,
        firstSeenAt: baseTime - 1,
        lastAssessedAt: baseTime - 1,
        latestReasoning: "Older alias row.",
        updatedAt: baseTime - 1,
      });

      return inserted;
    });

    const result = await t.mutation(
      internal.computeAggregates.updateFoodTrialSummary,
      {
        userId,
        aiAnalysisId,
      },
    );

    expect(result.updated).toBe(1);

    const summaries = await t.run(async (ctx) => {
      return await ctx.db
        .query("foodTrialSummary")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();
    });

    expect(summaries).toHaveLength(1);
    expect(summaries[0]?.canonicalName).toBe("white bread");
    expect(summaries[0]?.displayName).toBe("White Bread");
    expect(summaries[0]?.latestReasoning).toBe(
      "Alias stored before the registry merge.",
    );
  });

  it("keeps a food safe when clean trials outweigh one confounded bad day", async () => {
    const t = convexTest(schema);
    const userId = "test-user-123";
    const baseTime = Date.UTC(2026, 0, 1, 8, 0, 0);

    const aiAnalysisId = await t.run(async (ctx) => {
      await ctx.db.insert("profiles", {
        userId,
        unitSystem: "metric",
        habits: [],
        updatedAt: baseTime,
      });

      for (let index = 0; index < 5; index += 1) {
        const at = baseTime + index * 24 * 60 * 60 * 1000;
        await ctx.db.insert("logs", {
          userId,
          timestamp: at,
          type: "food",
          data: {
            items: [
              {
                name: "Toast",
                canonicalName: "toast",
                quantity: 1,
                unit: "slice",
              },
            ],
          },
        });
        await ctx.db.insert("logs", {
          userId,
          timestamp: at + 20 * 60 * 60 * 1000,
          type: "digestion",
          data: { bristolCode: 4, episodesCount: 1 },
        });
      }

      const badTrialAt = baseTime + 5 * 24 * 60 * 60 * 1000;
      await ctx.db.insert("logs", {
        userId,
        timestamp: badTrialAt,
        type: "food",
        data: {
          items: [
            {
              name: "Toast",
              canonicalName: "toast",
              quantity: 1,
              unit: "slice",
            },
          ],
        },
      });
      await ctx.db.insert("logs", {
        userId,
        timestamp: badTrialAt + 30 * 60 * 1000,
        type: "habit",
        data: {
          habitId: "habit_nicotine",
          name: "Nicotine",
          habitType: "destructive",
          quantity: 2,
        },
      });
      await ctx.db.insert("logs", {
        userId,
        timestamp: badTrialAt + 45 * 60 * 1000,
        type: "habit",
        data: {
          habitId: "habit_coffee",
          name: "Coffee",
          habitType: "destructive",
          quantity: 2,
        },
      });
      await ctx.db.insert("logs", {
        userId,
        timestamp: badTrialAt + 2 * 60 * 60 * 1000,
        type: "activity",
        data: {
          activityType: "walk",
          durationMinutes: 45,
        },
      });
      await ctx.db.insert("logs", {
        userId,
        timestamp: badTrialAt + 20 * 60 * 60 * 1000,
        type: "digestion",
        data: { bristolCode: 7, episodesCount: 1 },
      });

      const inserted = await ctx.db.insert("aiAnalyses", {
        userId,
        timestamp: badTrialAt,
        request: TEST_AI_REQUEST,
        response: TEST_AI_RESPONSE,
        insight: TEST_AI_INSIGHT,
        model: "test",
        durationMs: 100,
        inputLogCount: 1,
      });

      await ctx.db.insert("foodAssessments", {
        userId,
        aiAnalysisId: inserted,
        reportTimestamp: badTrialAt,
        foodName: "Toast",
        canonicalName: "toast",
        verdict: "safe",
        confidence: "medium",
        causalRole: "unlikely",
        changeType: "unchanged",
        modifierSummary: "Confounders shortened the likely window.",
        reasoning: "Five clean trials still dominate the evidence.",
      });

      return inserted;
    });

    const result = await t.mutation(
      internal.computeAggregates.updateFoodTrialSummary,
      {
        userId,
        aiAnalysisId,
      },
    );

    expect(result.updated).toBeGreaterThanOrEqual(1);

    const toast = await t
      .withIdentity({ subject: userId })
      .query(api.aggregateQueries.foodTrialByName, {
        canonicalName: "toast",
      });

    const profile = await t.run(async (ctx) => {
      return await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();
    });

    expect(toast).toBeDefined();
    expect(toast?.primaryStatus).toBe("safe");
    expect(toast?.currentStatus).toBe("safe");
    expect(toast?.recentSuspect).toBe(false);
    expect(toast?.combinedScore).toBeGreaterThan(0);
    expect(toast?.learnedTransitCenterMinutes).toBeGreaterThan(0);
    expect(profile?.transitCalibration?.source).toBe("learned");
    expect(profile?.transitCalibration?.sampleSize).toBeGreaterThanOrEqual(4);
  });

  it("downgrades a food to avoid after repeated low-confounder bad trials", async () => {
    const t = convexTest(schema);
    const userId = "test-user-123";
    const baseTime = Date.UTC(2026, 2, 1, 8, 0, 0);

    const aiAnalysisId = await t.run(async (ctx) => {
      await ctx.db.insert("profiles", {
        userId,
        unitSystem: "metric",
        habits: [],
        updatedAt: baseTime,
      });

      for (let index = 0; index < 3; index += 1) {
        const at = baseTime + index * 24 * 60 * 60 * 1000;
        await ctx.db.insert("logs", {
          userId,
          timestamp: at,
          type: "food",
          data: {
            items: [
              {
                name: "Raw Onion",
                canonicalName: "raw onion",
                quantity: 1,
                unit: "serving",
              },
            ],
          },
        });
        await ctx.db.insert("logs", {
          userId,
          timestamp: at + 20 * 60 * 60 * 1000,
          type: "digestion",
          data: { bristolCode: 7, episodesCount: 1 },
        });
      }

      const inserted = await ctx.db.insert("aiAnalyses", {
        userId,
        timestamp: baseTime + 3 * 24 * 60 * 60 * 1000,
        request: TEST_AI_REQUEST,
        response: TEST_AI_RESPONSE,
        insight: TEST_AI_INSIGHT,
        model: "test",
        durationMs: 100,
        inputLogCount: 1,
      });

      await ctx.db.insert("foodAssessments", {
        userId,
        aiAnalysisId: inserted,
        reportTimestamp: baseTime + 3 * 24 * 60 * 60 * 1000,
        foodName: "Raw Onion",
        canonicalName: "raw onion",
        verdict: "avoid",
        confidence: "high",
        causalRole: "primary",
        changeType: "downgraded",
        modifierSummary: "No confounders present.",
        reasoning: "Repeated Bristol 7 episodes in the expected window.",
      });

      return inserted;
    });

    const result = await t.mutation(
      internal.computeAggregates.updateFoodTrialSummary,
      {
        userId,
        aiAnalysisId,
      },
    );

    expect(result.updated).toBeGreaterThanOrEqual(1);

    const onion = await t
      .withIdentity({ subject: userId })
      .query(api.aggregateQueries.foodTrialByName, {
        canonicalName: "raw onion",
      });

    expect(onion).toBeDefined();
    expect(onion?.primaryStatus).toBe("avoid");
    expect(onion?.currentStatus).toBe("risky");
    expect(onion?.recentSuspect).toBe(true);
    expect(onion?.culpritCount).toBe(1);
    expect(onion?.combinedScore).toBeLessThan(0);
  });
});
