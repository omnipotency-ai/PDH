import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import {
  TEST_AI_INSIGHT,
  TEST_AI_REQUEST,
  TEST_AI_RESPONSE,
} from "./testFixtures";

describe("foodLibrary", () => {
  it("adds a food item and queries the library", async () => {
    const t = convexTest(schema);

    await t
      .withIdentity({ subject: "test-user-123" })
      .mutation(api.foodLibrary.addEntry, {
        canonicalName: "Rice",
        type: "ingredient",
        ingredients: [],
        createdAt: Date.now(),
      });

    const library = await t
      .withIdentity({ subject: "test-user-123" })
      .query(api.foodLibrary.list, {});
    expect(library.length).toBe(1);
    expect(library[0].canonicalName).toBe("white rice");
    expect(library[0].type).toBe("ingredient");
  });

  it("throws when querying without auth identity", async () => {
    const t = convexTest(schema);
    await expect(t.query(api.foodLibrary.list, {})).rejects.toThrow(
      "Not authenticated",
    );
  });

  it("throws when adding entry without auth identity", async () => {
    const t = convexTest(schema);
    await expect(
      t.mutation(api.foodLibrary.addEntry, {
        canonicalName: "test",
        type: "ingredient",
        ingredients: [],
        createdAt: Date.now(),
      }),
    ).rejects.toThrow("Not authenticated");
  });

  it("applies shared Phase D canonicalization when adding entries", async () => {
    const t = convexTest(schema);
    const user = t.withIdentity({ subject: "test-user-123" });
    const createdAt = Date.now();

    await user.mutation(api.foodLibrary.addEntry, {
      canonicalName: "nut butter",
      type: "ingredient",
      ingredients: [],
      createdAt,
    });
    await user.mutation(api.foodLibrary.addEntry, {
      canonicalName: "egg noodles",
      type: "ingredient",
      ingredients: [],
      createdAt,
    });
    await user.mutation(api.foodLibrary.addEntry, {
      canonicalName: "plain miso soup",
      type: "ingredient",
      ingredients: [],
      createdAt,
    });
    await user.mutation(api.foodLibrary.addEntry, {
      canonicalName: "silken tofu",
      type: "ingredient",
      ingredients: [],
      createdAt,
    });

    const library = await user.query(api.foodLibrary.list, {});

    expect(
      library.map(
        (row: { canonicalName: string; ingredients?: string[] }) =>
          row.canonicalName,
      ),
    ).toEqual(["miso soup", "noodles", "smooth nut butter", "tofu"]);
  });

  it("merges duplicate foods across library, logs, and assessment summaries", async () => {
    const t = convexTest(schema);
    const userId = "test-user-123";
    const now = Date.now();

    const logId = await t.run(async (ctx) => {
      const aiAnalysisA = await ctx.db.insert("aiAnalyses", {
        userId,
        timestamp: now - 10_000,
        request: TEST_AI_REQUEST,
        response: TEST_AI_RESPONSE,
        insight: TEST_AI_INSIGHT,
        model: "test-model",
        durationMs: 42,
        inputLogCount: 3,
      });
      const aiAnalysisB = await ctx.db.insert("aiAnalyses", {
        userId,
        timestamp: now - 5_000,
        request: TEST_AI_REQUEST,
        response: TEST_AI_RESPONSE,
        insight: TEST_AI_INSIGHT,
        model: "test-model",
        durationMs: 45,
        inputLogCount: 2,
      });

      await ctx.db.insert("foodLibrary", {
        userId,
        canonicalName: "xylofruit",
        type: "ingredient",
        ingredients: [],
        createdAt: now - 30_000,
      });
      await ctx.db.insert("foodLibrary", {
        userId,
        canonicalName: "baked xylofruit",
        type: "ingredient",
        ingredients: [],
        createdAt: now - 20_000,
      });
      await ctx.db.insert("foodLibrary", {
        userId,
        canonicalName: "ham sandwich",
        type: "composite",
        ingredients: ["baked xylofruit", "ham"],
        createdAt: now - 15_000,
      });

      await ctx.db.insert("foodAssessments", {
        userId,
        aiAnalysisId: aiAnalysisA,
        reportTimestamp: now - 10_000,
        foodName: "Fresh baked xylofruit",
        canonicalName: "baked xylofruit",
        verdict: "safe",
        reasoning: "No issues.",
      });
      await ctx.db.insert("foodAssessments", {
        userId,
        aiAnalysisId: aiAnalysisB,
        reportTimestamp: now - 5_000,
        foodName: "Fresh baked xylofruit",
        canonicalName: "baked xylofruit",
        verdict: "culprit",
        confidence: "high",
        reasoning: "Triggered loose stool.",
      });
      await ctx.db.insert("foodAssessments", {
        userId,
        aiAnalysisId: aiAnalysisB,
        reportTimestamp: now - 4_000,
        foodName: "Baguette",
        canonicalName: "xylofruit",
        verdict: "safe",
        reasoning: "Small amount tolerated.",
      });

      await ctx.db.insert("foodTrialSummary", {
        userId,
        canonicalName: "baked xylofruit",
        displayName: "Fresh baked xylofruit",
        currentStatus: "watch",
        latestAiVerdict: "culprit",
        latestConfidence: "high",
        totalAssessments: 2,
        culpritCount: 1,
        safeCount: 1,
        nextToTryCount: 0,
        firstSeenAt: now - 10_000,
        lastAssessedAt: now - 5_000,
        latestReasoning: "Old summary",
        updatedAt: now - 5_000,
      });
      await ctx.db.insert("foodTrialSummary", {
        userId,
        canonicalName: "xylofruit",
        displayName: "Baguette",
        currentStatus: "testing",
        latestAiVerdict: "safe",
        totalAssessments: 1,
        culpritCount: 0,
        safeCount: 1,
        nextToTryCount: 0,
        firstSeenAt: now - 4_000,
        lastAssessedAt: now - 4_000,
        latestReasoning: "Old summary",
        updatedAt: now - 4_000,
      });

      const logId = await ctx.db.insert("logs", {
        userId,
        timestamp: now - 1_000,
        type: "food",
        data: {
          items: [
            {
              name: "fresh baked xylofruit",
              quantity: 1,
              unit: null,
              canonicalName: "baked xylofruit",
            },
            {
              name: "ham",
              quantity: 1,
              unit: null,
              canonicalName: "ham",
            },
          ],
          notes: "",
        },
      });

      await ctx.db.insert("ingredientExposures", {
        userId,
        logId,
        itemIndex: 0,
        logTimestamp: now - 1_000,
        ingredientName: "fresh baked xylofruit",
        canonicalName: "baked xylofruit",
        quantity: 1,
        unit: null,
        createdAt: now - 900,
      });

      await ctx.db.insert("ingredientOverrides", {
        userId,
        canonicalName: "baked xylofruit",
        status: "watch",
        note: "old note",
        createdAt: now - 4_500,
        updatedAt: now - 4_500,
      });
      await ctx.db.insert("ingredientOverrides", {
        userId,
        canonicalName: "xylofruit",
        status: "safe",
        createdAt: now - 3_500,
        updatedAt: now - 3_500,
      });

      await ctx.db.insert("ingredientProfiles", {
        userId,
        canonicalName: "baked xylofruit",
        displayName: "Fresh baked xylofruit",
        tags: ["carbs", "bread"],
        foodGroup: null,
        foodLine: null,
        lowResidue: true,
        source: "manual",
        externalId: null,
        ingredientsText: null,
        nutritionPer100g: {
          kcal: 250,
          fatG: null,
          saturatedFatG: null,
          carbsG: 52,
          sugarsG: null,
          fiberG: null,
          proteinG: null,
          saltG: null,
        },
        createdAt: now - 3_000,
        updatedAt: now - 3_000,
      });
      await ctx.db.insert("ingredientProfiles", {
        userId,
        canonicalName: "xylofruit",
        displayName: "Baguette",
        tags: ["BRAT foods", "low residue"],
        foodGroup: null,
        foodLine: null,
        lowResidue: null,
        source: "openfoodfacts",
        externalId: "1234",
        ingredientsText: "flour, water, salt",
        nutritionPer100g: {
          kcal: null,
          fatG: 1.1,
          saturatedFatG: null,
          carbsG: null,
          sugarsG: null,
          fiberG: 2.8,
          proteinG: 8.4,
          saltG: 1.0,
        },
        createdAt: now - 2_000,
        updatedAt: now - 2_000,
      });

      return logId;
    });

    const mergeResult = await t
      .withIdentity({ subject: userId })
      .action(api.foodLibrary.mergeDuplicates, {
        merges: [{ source: "Fresh baked xylofruit", target: "xylofruit" }],
        now,
      });

    expect(mergeResult.mergesApplied).toBe(1);
    expect(mergeResult.foodAssessmentsUpdated).toBe(2);
    expect(mergeResult.ingredientExposuresUpdated).toBe(1);
    expect(mergeResult.ingredientOverridesUpdated).toBe(1);
    expect(mergeResult.ingredientOverridesMerged).toBe(1);
    expect(mergeResult.ingredientProfilesUpdated).toBe(1);
    expect(mergeResult.ingredientProfilesMerged).toBe(1);
    expect(mergeResult.foodLogItemsUpdated).toBe(1);
    expect(mergeResult.foodTrialSummariesRebuilt).toBe(1);

    const library = await t
      .withIdentity({ subject: userId })
      .query(api.foodLibrary.list, {});
    expect(
      library.some(
        (row: { canonicalName: string; ingredients?: string[] }) =>
          row.canonicalName === "baked xylofruit",
      ),
    ).toBe(false);
    expect(
      library.filter(
        (row: { canonicalName: string; ingredients?: string[] }) =>
          row.canonicalName === "xylofruit",
      ),
    ).toHaveLength(1);
    expect(
      library.find(
        (row: { canonicalName: string; ingredients?: string[] }) =>
          row.canonicalName === "ham sandwich",
      )?.ingredients,
    ).toEqual(["xylofruit", "ham"]); // "ham" canonical remains unchanged after merge

    await t.run(async (ctx) => {
      const sourceAssessments = await ctx.db
        .query("foodAssessments")
        .withIndex("by_userId_canonicalName", (q) =>
          q.eq("userId", userId).eq("canonicalName", "baked xylofruit"),
        )
        .collect();
      expect(sourceAssessments).toHaveLength(0);

      const mergedAssessments = await ctx.db
        .query("foodAssessments")
        .withIndex("by_userId_canonicalName", (q) =>
          q.eq("userId", userId).eq("canonicalName", "xylofruit"),
        )
        .collect();
      expect(mergedAssessments).toHaveLength(3);

      const mergedExposures = await ctx.db
        .query("ingredientExposures")
        .withIndex("by_userId_canonicalName", (q) =>
          q.eq("userId", userId).eq("canonicalName", "xylofruit"),
        )
        .collect();
      expect(mergedExposures).toHaveLength(1);

      const updatedLog = await ctx.db.get(logId);
      expect(updatedLog?.type).toBe("food");
      const updatedItems = (
        updatedLog?.data as { items?: Array<{ canonicalName?: string }> }
      ).items;
      expect(updatedItems?.[0]?.canonicalName).toBe("xylofruit");
      expect(updatedItems?.[1]?.canonicalName).toBe("ham"); // "ham" canonical unchanged

      const staleSummary = await ctx.db
        .query("foodTrialSummary")
        .withIndex("by_userId_canonicalName", (q) =>
          q.eq("userId", userId).eq("canonicalName", "baked xylofruit"),
        )
        .collect();
      expect(staleSummary).toHaveLength(0);

      const mergedSummary = await ctx.db
        .query("foodTrialSummary")
        .withIndex("by_userId_canonicalName", (q) =>
          q.eq("userId", userId).eq("canonicalName", "xylofruit"),
        )
        .collect();
      expect(mergedSummary).toHaveLength(1);
      expect(mergedSummary[0].totalAssessments).toBe(3);
      expect(mergedSummary[0].culpritCount).toBe(1);
      expect(mergedSummary[0].safeCount).toBe(2);
      expect(mergedSummary[0].latestAiVerdict).toBe("safe");

      const mergedOverrides = await ctx.db
        .query("ingredientOverrides")
        .withIndex("by_userId_canonicalName", (q) =>
          q.eq("userId", userId).eq("canonicalName", "xylofruit"),
        )
        .collect();
      expect(mergedOverrides).toHaveLength(1);
      expect(mergedOverrides[0].status).toBe("safe");

      const mergedProfiles = await ctx.db
        .query("ingredientProfiles")
        .withIndex("by_userId_canonicalName", (q) =>
          q.eq("userId", userId).eq("canonicalName", "xylofruit"),
        )
        .collect();
      expect(mergedProfiles).toHaveLength(1);
      expect(mergedProfiles[0].tags).toEqual([
        "brat foods",
        "bread",
        "carbs",
        "low residue",
      ]);
      expect(mergedProfiles[0].foodGroup).toBeNull();
      expect(mergedProfiles[0].foodLine).toBeNull();
      expect(mergedProfiles[0].nutritionPer100g.kcal).toBe(250);
      expect(mergedProfiles[0].nutritionPer100g.proteinG).toBe(8.4);
    });
  });

  it("throws when mergeDuplicates is called without auth", async () => {
    const t = convexTest(schema);
    await expect(
      t.action(api.foodLibrary.mergeDuplicates, {
        merges: [{ source: "a", target: "b" }],
        now: Date.now(),
      }),
    ).rejects.toThrow("Not authenticated");
  });

  it("dedupes exact duplicate food library rows even with no merge mappings", async () => {
    const t = convexTest(schema);
    const userId = "test-user-123";
    const now = Date.now();

    await t.run(async (ctx) => {
      await ctx.db.insert("foodLibrary", {
        userId,
        canonicalName: "fresh baked xylofruit",
        type: "ingredient",
        ingredients: [],
        createdAt: now - 10_000,
      });
      await ctx.db.insert("foodLibrary", {
        userId,
        canonicalName: "fresh baked xylofruit",
        type: "ingredient",
        ingredients: [],
        createdAt: now - 5_000,
      });
    });

    const result = await t
      .withIdentity({ subject: userId })
      .action(api.foodLibrary.mergeDuplicates, {
        merges: [],
        now,
      });

    expect(result.mergesApplied).toBe(0);
    expect(result.foodLibraryEntriesMerged).toBe(1);

    const library = await t
      .withIdentity({ subject: userId })
      .query(api.foodLibrary.list, {});
    const xylofruits = library.filter(
      (row: { canonicalName: string; ingredients?: string[] }) =>
        row.canonicalName === "baked xylofruit",
    );
    expect(xylofruits).toHaveLength(1);
  });
});
