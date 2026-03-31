import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import schema from "./schema";
import {
  TEST_AI_INSIGHT,
  TEST_AI_REQUEST,
  TEST_AI_RESPONSE,
} from "./testFixtures";

describe("logs", () => {
  it("creates a log entry and queries it back", async () => {
    const t = convexTest(schema);
    const timestamp = Date.now();
    const foodData = {
      items: [{ name: "banana", quantity: 1, unit: "piece" }],
    };

    const logId = await t
      .withIdentity({ subject: "test-user-123" })
      .mutation(api.logs.add, {
        timestamp,
        type: "food",
        data: foodData,
      });

    expect(logId).toBeDefined();

    const logs = await t
      .withIdentity({ subject: "test-user-123" })
      .query(api.logs.list, {});
    expect(logs.length).toBe(1);
    expect(logs[0].timestamp).toBe(timestamp);
    expect(logs[0].type).toBe("food");
    expect(logs[0].data).toEqual(foodData);
  });

  it("throws when querying without auth identity", async () => {
    const t = convexTest(schema);
    await expect(t.query(api.logs.list, {})).rejects.toThrow(
      "Not authenticated",
    );
  });

  it("only returns logs for the authenticated user", async () => {
    const t = convexTest(schema);
    const timestamp = Date.now();

    // User A creates a log
    await t.withIdentity({ subject: "user-A" }).mutation(api.logs.add, {
      timestamp,
      type: "food",
      data: { items: [{ name: "apple", quantity: 1, unit: null }] },
    });

    // User B creates a log
    await t.withIdentity({ subject: "user-B" }).mutation(api.logs.add, {
      timestamp: timestamp + 1000,
      type: "food",
      data: { items: [{ name: "orange", quantity: 2, unit: null }] },
    });

    // User A queries — should only see their log
    const logsA = await t
      .withIdentity({ subject: "user-A" })
      .query(api.logs.list, {});
    expect(logsA.length).toBe(1);
    expect((logsA[0].data as { items: { name: string }[] }).items[0].name).toBe(
      "apple",
    );

    // User B queries — should only see their log
    const logsB = await t
      .withIdentity({ subject: "user-B" })
      .query(api.logs.list, {});
    expect(logsB.length).toBe(1);
    expect((logsB[0].data as { items: { name: string }[] }).items[0].name).toBe(
      "orange",
    );
  });

  it("returns every log from listAll without the capped list limit", async () => {
    const t = convexTest(schema);
    const userId = "test-user-123";

    await t.run(async (ctx) => {
      for (let index = 0; index < 5001; index += 1) {
        await ctx.db.insert("logs", {
          userId,
          timestamp: index,
          type: "food",
          data: { items: [{ name: `item-${index}`, quantity: 1, unit: null }] },
        });
      }
    });

    const capped = await t
      .withIdentity({ subject: userId })
      .query(api.logs.list, { limit: 5001 });
    const all = await t
      .withIdentity({ subject: userId })
      .query(api.logs.listAll, {});

    expect(capped).toHaveLength(5000);
    expect(all).toHaveLength(5000);
    expect(all[0]?.timestamp).toBe(5000);
    expect(all.at(-1)?.timestamp).toBe(1);
  });

  it("only indexes ingredient exposures after a food log is canonicalized", async () => {
    const t = convexTest(schema);
    const userId = "test-user-123";
    const firstTimestamp = Date.now();

    const logId = await t
      .withIdentity({ subject: userId })
      .mutation(api.logs.add, {
        timestamp: firstTimestamp,
        type: "food",
        data: {
          items: [
            {
              name: "ham sandwich",
              quantity: 2,
              unit: null,
            },
          ],
        },
      });

    await t.run(async (ctx) => {
      const rows = await ctx.db
        .query("ingredientExposures")
        .withIndex("by_userId_logId", (q) =>
          q.eq("userId", userId).eq("logId", logId),
        )
        .collect();
      expect(rows).toHaveLength(0);
    });

    const secondTimestamp = firstTimestamp + 60_000;
    await t.withIdentity({ subject: userId }).mutation(api.logs.update, {
      id: logId,
      timestamp: secondTimestamp,
      data: {
        items: [
          {
            parsedName: "scrambled eggs",
            userSegment: "two scrambled eggs",
            resolvedBy: "registry",
            canonicalName: "egg",
            quantity: 2,
            unit: null,
            recoveryStage: 2,
            spiceLevel: "plain",
          },
        ],
      },
    });

    await t.run(async (ctx) => {
      const rows = await ctx.db
        .query("ingredientExposures")
        .withIndex("by_userId_logId", (q) =>
          q.eq("userId", userId).eq("logId", logId),
        )
        .collect();
      expect(rows).toHaveLength(1);
      expect(rows[0].ingredientName).toBe("two scrambled eggs");
      expect(rows[0].canonicalName).toBe("egg");
      expect(rows[0].logTimestamp).toBe(secondTimestamp);
      expect(rows[0].recoveryStage).toBe(2);
      expect(rows[0].spiceLevel).toBe("plain");
    });
  });

  it("removes ingredient exposures when a food log is deleted", async () => {
    const t = convexTest(schema);
    const userId = "test-user-123";
    const logId = await t
      .withIdentity({ subject: userId })
      .mutation(api.logs.add, {
        timestamp: Date.now(),
        type: "food",
        data: {
          items: [
            {
              name: "banana",
              canonicalName: "banana",
              quantity: 1,
              unit: null,
            },
          ],
        },
      });

    await t
      .withIdentity({ subject: userId })
      .mutation(api.logs.remove, { id: logId });

    await t.run(async (ctx) => {
      const rows = await ctx.db
        .query("ingredientExposures")
        .withIndex("by_userId_logId", (q) =>
          q.eq("userId", userId).eq("logId", logId),
        )
        .collect();
      expect(rows).toHaveLength(0);
    });
  });

  it("stores rawInput when adding a food log", async () => {
    const t = convexTest(schema);
    const userId = "test-user-raw";

    const logId = await t
      .withIdentity({ subject: userId })
      .mutation(api.logs.add, {
        timestamp: Date.now(),
        type: "food",
        data: {
          rawInput: "two toast, honey, butter",
          items: [
            {
              parsedName: "toast",
              userSegment: "two toast",
              resolvedBy: "registry",
              quantity: 2,
              unit: null,
              canonicalName: "toast",
            },
            {
              parsedName: "honey",
              userSegment: "honey",
              resolvedBy: "registry",
              quantity: 1,
              unit: null,
              canonicalName: "honey",
            },
            {
              parsedName: "butter",
              userSegment: "butter",
              resolvedBy: "registry",
              quantity: 1,
              unit: null,
              canonicalName: "butter",
            },
          ],
          notes: "",
        },
      });

    await t.run(async (ctx) => {
      const log = await ctx.db.get(logId);
      if (log === null) throw new Error("expected log");
      const data = (log as Doc<"logs">).data as { rawInput?: string };
      expect(data.rawInput).toBe("two toast, honey, butter");
    });
  });

  it("recanonicalizes legacy food names through the registry without touching rawInput", async () => {
    const t = convexTest(schema);
    const userId = "test-user-recanonicalize";

    const logId = await t
      .withIdentity({ subject: userId })
      .mutation(api.logs.add, {
        timestamp: Date.now(),
        type: "food",
        data: {
          rawInput: "legacy audit row",
          items: [
            {
              name: "boiled chicken fillet",
              canonicalName: "boiled chicken fillet",
              quantity: 1,
              unit: null,
            },
            {
              name: "flora spreadable",
              canonicalName: "flora spreadable",
              quantity: 1,
              unit: null,
            },
            {
              name: "strawberry flavoured greek yogurt",
              canonicalName: "strawberry flavoured greek yogurt",
              quantity: 1,
              unit: null,
            },
            {
              name: "plain cracker",
              canonicalName: "plain cracker",
              quantity: 1,
              unit: null,
            },
            {
              name: "sugar puffs",
              canonicalName: "sugar puff",
              quantity: 1,
              unit: null,
            },
            {
              name: "1/2 a baguette",
              canonicalName: "white bread",
              quantity: 1,
              unit: null,
            },
            {
              name: "sm banana",
              canonicalName: "ripe banana",
              quantity: 1,
              unit: null,
            },
          ],
        },
      });

    const result = await t
      .withIdentity({ subject: userId })
      .mutation(api.logs.recanonicalizeAllFoodLogs, {
        limit: 10,
      });

    expect(result.patchedLogs).toBe(1);
    expect(result.recanonicalizedItems).toBe(5);

    await t.run(async (ctx) => {
      const log = await ctx.db.get(logId);
      const data = log?.data as {
        rawInput?: string;
        items?: Array<{ canonicalName?: string }>;
      };
      expect(data.rawInput).toBe("legacy audit row");
      expect(data.items?.map((item) => item.canonicalName)).toEqual([
        "boiled white meat",
        "butter",
        "flavoured yogurt",
        "crispy cracker",
        "low-fiber cereal",
        "white bread",
        "ripe banana",
      ]);

      const exposures = await ctx.db
        .query("ingredientExposures")
        .withIndex("by_userId_logId", (q) =>
          q.eq("userId", userId).eq("logId", logId),
        )
        .collect();
      expect(exposures).toHaveLength(7);
      expect(exposures.map((row) => row.canonicalName)).toEqual([
        "boiled white meat",
        "butter",
        "flavoured yogurt",
        "crispy cracker",
        "low-fiber cereal",
        "white bread",
        "ripe banana",
      ]);
    });
  });

  it("supports explicit per-item overrides and drops during recanonicalization", async () => {
    const t = convexTest(schema);
    const userId = "test-user-recanonicalize-overrides";

    const logId = await t
      .withIdentity({ subject: userId })
      .mutation(api.logs.add, {
        timestamp: Date.now(),
        type: "food",
        data: {
          rawInput: "carrot, potato, chicken, tomato",
          items: [
            {
              name: "carrot",
              canonicalName: "carrot",
              quantity: 1,
              unit: null,
            },
            {
              name: "potato",
              canonicalName: "potato",
              quantity: 1,
              unit: null,
            },
            {
              name: "chicken",
              canonicalName: "chicken",
              quantity: 1,
              unit: null,
            },
            {
              name: "tomato",
              canonicalName: "tomato",
              quantity: 1,
              unit: null,
            },
          ],
        },
      });

    const result = await t
      .withIdentity({ subject: userId })
      .mutation(api.logs.recanonicalizeAllFoodLogs, {
        limit: 10,
        overrides: [
          {
            logId,
            itemIndex: 0,
            canonicalName: "mashed root vegetable",
          },
          {
            logId,
            itemIndex: 1,
            canonicalName: "mashed potato",
          },
          {
            logId,
            itemIndex: 2,
            canonicalName: "boiled white meat",
          },
          {
            logId,
            itemIndex: 3,
            drop: true,
          },
        ],
      });

    expect(result.patchedLogs).toBe(1);
    expect(result.droppedItems).toBe(1);
    expect(result.recanonicalizedItems).toBe(3);

    await t.run(async (ctx) => {
      const log = await ctx.db.get(logId);
      const data = log?.data as {
        rawInput?: string;
        items?: Array<{ canonicalName?: string }>;
      };
      expect(data.rawInput).toBe("carrot, potato, chicken, tomato");
      expect(data.items?.map((item) => item.canonicalName)).toEqual([
        "mashed root vegetable",
        "mashed potato",
        "boiled white meat",
      ]);

      const exposures = await ctx.db
        .query("ingredientExposures")
        .withIndex("by_userId_logId", (q) =>
          q.eq("userId", userId).eq("logId", logId),
        )
        .collect();
      expect(exposures).toHaveLength(3);
      expect(exposures.map((row) => row.canonicalName)).toEqual([
        "mashed root vegetable",
        "mashed potato",
        "boiled white meat",
      ]);
    });
  });

  it("normalizes legacy profile fields when reading the profile", async () => {
    const t = convexTest(schema);
    const userId = "test-user-legacy-profile";
    const now = Date.now();

    await t.run(async (ctx) => {
      await ctx.db.insert("profiles", {
        userId,
        unitSystem: "metric",
        habits: [],
        fluidPresets: ["Aquarius", "Tea", "Aquarius"],
        aiPreferences: {
          preferredName: "Peter",
          locationTimezone: "Europe/Madrid",
          mealSchedule: {
            breakfast: "07:00",
            middaySnack: "10:00",
            lunch: "13:00",
            midafternoonSnack: "16:00",
            dinner: "19:00",
            lateEveningSnack: "22:00",
          },
          aiModel: "gpt-5.2",
          approach: "supportive",
          register: "mixed",
          outputFormat: "mixed",
          outputLength: "standard",
          preset: "reassuring_coach",
          promptVersion: 2,
        },
        updatedAt: now,
      });
    });

    const profile = await t
      .withIdentity({ subject: userId })
      .query(api.logs.getProfile, {});

    expect(profile).not.toBeNull();
    expect(profile?.fluidPresets).toEqual([
      { name: "Aquarius" },
      { name: "Tea" },
    ]);
    expect(profile?.aiPreferences?.aiModel).toBe("gpt-5.2");
  });

  it("exports and restores a full backup with remapped linked records", async () => {
    const t = convexTest(schema);
    const userId = "test-user-123";
    const now = Date.now();

    await t.run(async (ctx) => {
      const logId = await ctx.db.insert("logs", {
        userId,
        timestamp: now,
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

      const aiAnalysisId = await ctx.db.insert("aiAnalyses", {
        userId,
        timestamp: now + 1,
        request: TEST_AI_REQUEST,
        response: TEST_AI_RESPONSE,
        insight: TEST_AI_INSIGHT,
        model: "test-model",
        durationMs: 120,
        inputLogCount: 3,
      });

      await ctx.db.insert("profiles", {
        userId,
        unitSystem: "metric",
        habits: [],
        fluidPresets: [{ name: "Tea" }],
        knownFoods: ["toast", "banana"],
        encryptedApiKey: "enc-v1:test-iv:test-ciphertext",
        updatedAt: now + 2,
      });

      await ctx.db.insert("foodLibrary", {
        userId,
        canonicalName: "toast",
        type: "ingredient",
        ingredients: [],
        createdAt: now + 3,
      });

      await ctx.db.insert("conversations", {
        userId,
        aiAnalysisId,
        timestamp: now + 4,
        role: "assistant",
        content: "Toast still looks safe overall.",
      });

      await ctx.db.insert("foodAssessments", {
        userId,
        aiAnalysisId,
        reportTimestamp: now + 5,
        foodName: "Toast",
        canonicalName: "toast",
        verdict: "avoid",
        confidence: "medium",
        causalRole: "possible",
        changeType: "downgraded",
        modifierSummary: "Heavy nicotine load shortened transit.",
        reasoning: "Confounded bad day.",
      });

      await ctx.db.insert("foodTrialSummary", {
        userId,
        canonicalName: "toast",
        displayName: "Toast",
        currentStatus: "safe",
        latestAiVerdict: "avoid",
        latestConfidence: "medium",
        totalAssessments: 4,
        culpritCount: 1,
        safeCount: 3,
        nextToTryCount: 0,
        firstSeenAt: now - 10_000,
        lastAssessedAt: now + 5,
        latestReasoning: "Mostly safe with one confounded downgrade.",
        primaryStatus: "safe",
        tendency: "neutral",
        confidence: 0.78,
        codeScore: 1.2,
        aiScore: -0.4,
        combinedScore: 0.8,
        recentSuspect: true,
        clearedHistory: false,
        learnedTransitCenterMinutes: 720,
        learnedTransitSpreadMinutes: 120,
        updatedAt: now + 7,
      });

      await ctx.db.insert("weeklyDigest", {
        userId,
        weekStart: "2026-03-02",
        weekStartTimestamp: now - 86_400_000,
        totalBowelEvents: 2,
        avgBristolScore: 4,
        bristolDistribution: {
          bristol1: 0,
          bristol2: 0,
          bristol3: 0,
          bristol4: 2,
          bristol5: 0,
          bristol6: 0,
          bristol7: 0,
        },
        accidentCount: 0,
        totalFoodLogs: 1,
        uniqueFoodsEaten: 1,
        newFoodsTried: 0,
        totalReports: 1,
        foodsCleared: 1,
        foodsFlagged: 0,
        topCulprits: [],
        topSafe: ["toast"],
        totalHabitLogs: 1,
        totalFluidMl: 750,
        updatedAt: now + 8,
      });

      await ctx.db.insert("weeklySummaries", {
        userId,
        weekStartTimestamp: now - 86_400_000,
        weekEndTimestamp: now,
        weeklySummary: "Stable week with one confounded toast wobble.",
        keyFoods: {
          safe: ["toast"],
          flagged: [],
          toTryNext: ["oatmeal"],
        },
        carryForwardNotes: ["Retest toast without cigarettes."],
        model: "test-model",
        durationMs: 99,
        generatedAt: now + 9,
      });

      await ctx.db.insert("ingredientExposures", {
        userId,
        logId,
        itemIndex: 0,
        logTimestamp: now,
        ingredientName: "Toast",
        canonicalName: "toast",
        quantity: 1,
        unit: "slice",
        createdAt: now + 10,
      });
    });

    const backup = await t
      .withIdentity({ subject: userId })
      .query(api.logs.exportBackup, {});
    expect(backup.version).toBe(1);
    expect(backup.data.logs).toHaveLength(1);
    expect(backup.data.aiAnalyses).toHaveLength(1);
    expect(backup.data.ingredientExposures).toHaveLength(1);

    await t.withIdentity({ subject: userId }).mutation(api.logs.deleteAll, {});

    const emptyLogs = await t
      .withIdentity({ subject: userId })
      .query(api.logs.list, {});
    expect(emptyLogs).toHaveLength(0);

    const restore = await t
      .withIdentity({ subject: userId })
      .mutation(api.logs.importBackup, { payload: backup });
    expect(restore.inserted.logs).toBe(1);
    expect(restore.inserted.aiAnalyses).toBe(1);

    await t.run(async (ctx) => {
      const restoredLogs = await ctx.db
        .query("logs")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();
      const restoredAiAnalyses = await ctx.db
        .query("aiAnalyses")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();
      const restoredConversations = await ctx.db
        .query("conversations")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();
      const restoredAssessments = await ctx.db
        .query("foodAssessments")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();
      const restoredExposures = await ctx.db
        .query("ingredientExposures")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();
      const restoredProfile = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();

      expect(restoredLogs).toHaveLength(1);
      expect(restoredAiAnalyses).toHaveLength(1);
      expect(restoredConversations).toHaveLength(1);
      expect(restoredAssessments).toHaveLength(1);
      expect(restoredExposures).toHaveLength(1);
      expect(restoredProfile?.fluidPresets).toEqual([{ name: "Tea" }]);
      expect(restoredProfile?.knownFoods).toEqual(["toast", "banana"]);
      expect(restoredProfile?.encryptedApiKey).toBe(
        "enc-v1:test-iv:test-ciphertext",
      );

      expect(restoredConversations[0].aiAnalysisId).toBe(
        restoredAiAnalyses[0]._id,
      );
      expect(restoredAssessments[0].aiAnalysisId).toBe(
        restoredAiAnalyses[0]._id,
      );
      expect(restoredExposures[0].logId).toBe(restoredLogs[0]._id);
    });
  });
});
