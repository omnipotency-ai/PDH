import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildFoodSearchDocuments } from "../shared/foodMatching";
import { api, internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { getFoodDocumentsNeedingEmbeddingRefresh } from "./foodParsing";
import schema from "./schema";

describe("server-side food parsing", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("parses deterministic foods and writes items back to log", async () => {
    const t = convexTest(schema);
    const userId = "test-user-parse";

    const logId = await t
      .withIdentity({ subject: userId })
      .mutation(api.logs.add, {
        timestamp: Date.now(),
        type: "food",
        data: {
          rawInput: "two toast, one banana, 125 grams of yogurt, honey",
          items: [],
          notes: "",
        },
      });

    // Run the scheduled processLogInternal (delay 0) from logs.add
    vi.runAllTimers();
    await t.finishInProgressScheduledFunctions();

    // Now call processLog directly (idempotent — re-parses the same input)
    await t
      .withIdentity({ subject: userId })
      .mutation(api.foodParsing.processLog, { logId });

    await t.run(async (ctx) => {
      const log = await ctx.db.get(logId);
      if (log === null) throw new Error("expected log");
      const data = (log as Doc<"logs">).data as {
        rawInput: string;
        items: Array<{
          parsedName: string;
          canonicalName?: string;
          resolvedBy?: string;
          quantity: number | null;
          unit: string | null;
        }>;
      };

      expect(data.rawInput).toBe(
        "two toast, one banana, 125 grams of yogurt, honey",
      );
      expect(data.items).toHaveLength(4);

      expect(data.items[0].parsedName).toBe("toast");
      expect(data.items[0].canonicalName).toBe("toast");
      expect(data.items[0].resolvedBy).toBe("registry");
      expect(data.items[0].quantity).toBe(2);

      expect(data.items[1].parsedName).toBe("banana");
      expect(data.items[1].canonicalName).toBe("ripe banana");
      expect(data.items[1].resolvedBy).toBe("registry");

      expect(data.items[2].parsedName).toBe("yogurt");
      expect(data.items[2].canonicalName).toBe("plain yogurt");
      expect(data.items[2].quantity).toBe(125);
      expect(data.items[2].unit).toBe("g");

      expect(data.items[3].parsedName).toBe("honey");
      expect(data.items[3].canonicalName).toBe("honey");
    });
  });

  it("parses word-count measure units and resolves lactose free cream cheese via the registry", async () => {
    const t = convexTest(schema);
    const userId = "test-user-word-measure";

    const logId = await t
      .withIdentity({ subject: userId })
      .mutation(api.logs.add, {
        timestamp: Date.now(),
        type: "food",
        data: {
          rawInput: "two teaspoons of lactose free cream cheese",
          items: [],
          notes: "",
        },
      });

    vi.runAllTimers();
    await t.finishInProgressScheduledFunctions();

    await t
      .withIdentity({ subject: userId })
      .mutation(api.foodParsing.processLog, { logId });

    await t.run(async (ctx) => {
      const log = await ctx.db.get(logId);
      if (log === null) throw new Error("expected log");
      const data = (log as Doc<"logs">).data as {
        items: Array<{
          parsedName: string;
          canonicalName?: string;
          resolvedBy?: string;
          quantity: number | null;
          unit: string | null;
          userSegment: string;
        }>;
      };

      expect(data.items).toHaveLength(1);
      expect(data.items[0]?.userSegment).toBe(
        "two teaspoons of lactose free cream cheese",
      );
      expect(data.items[0]?.parsedName).toBe("lactose free cream cheese");
      expect(data.items[0]?.canonicalName).toBe("cream cheese");
      expect(data.items[0]?.resolvedBy).toBe("registry");
      expect(data.items[0]?.quantity).toBe(2);
      expect(data.items[0]?.unit).toBe("tsp");
    });
  });

  it("does NOT create ingredientExposures at processing time (evidence waits 6 hours)", async () => {
    const t = convexTest(schema);
    const userId = "test-user-no-immediate-evidence";

    const logId = await t
      .withIdentity({ subject: userId })
      .mutation(api.logs.add, {
        timestamp: Date.now(),
        type: "food",
        data: {
          rawInput: "toast, honey",
          items: [],
          notes: "",
        },
      });

    // Run the scheduled processLogInternal (delay 0) from logs.add
    vi.runAllTimers();
    await t.finishInProgressScheduledFunctions();

    await t
      .withIdentity({ subject: userId })
      .mutation(api.foodParsing.processLog, { logId });

    await t.run(async (ctx) => {
      // No exposures should exist yet — evidence waits 6 hours
      const exposures = await ctx.db
        .query("ingredientExposures")
        .withIndex("by_userId_logId", (q) =>
          q.eq("userId", userId).eq("logId", logId),
        )
        .collect();
      expect(exposures).toHaveLength(0);

      // But items should be resolved in the log (display-only)
      const log = await ctx.db.get(logId);
      if (log === null) throw new Error("expected log");
      const data = (log as Doc<"logs">).data as {
        items: Array<{ parsedName: string; canonicalName?: string }>;
      };
      expect(data.items).toHaveLength(2);
      expect(data.items[0].canonicalName).toBe("toast");
      expect(data.items[1].canonicalName).toBe("honey");
    });
  });

  it("flags unresolved items as pending without canonicalName", async () => {
    const t = convexTest(schema);
    const userId = "test-user-partial";

    const logId = await t
      .withIdentity({ subject: userId })
      .mutation(api.logs.add, {
        timestamp: Date.now(),
        type: "food",
        data: {
          rawInput: "toast, xylofruit",
          items: [],
          notes: "",
        },
      });

    // Run the scheduled processLogInternal (delay 0) from logs.add
    vi.runAllTimers();
    await t.finishInProgressScheduledFunctions();

    await t
      .withIdentity({ subject: userId })
      .mutation(api.foodParsing.processLog, { logId });

    await t.run(async (ctx) => {
      const log = await ctx.db.get(logId);
      if (log === null) throw new Error("expected log");
      const data = (log as Doc<"logs">).data as {
        items: Array<{
          parsedName: string;
          canonicalName?: string;
          resolvedBy?: string;
          userSegment: string;
        }>;
      };
      expect(data.items).toHaveLength(2);

      // Toast resolved for display
      expect(data.items[0].parsedName).toBe("toast");
      expect(data.items[0].canonicalName).toBe("toast");
      expect(data.items[0].resolvedBy).toBe("registry");

      // Xylofruit unresolved
      expect(data.items[1].parsedName).toBe("xylofruit");
      expect(data.items[1].canonicalName).toBeUndefined();
      expect(data.items[1].resolvedBy).toBeUndefined();
      expect(data.items[1].userSegment).toBe("xylofruit");
    });
  });
});

describe("embedding refresh helpers", () => {
  it("refreshes missing and stale embedding rows, but skips current ones", () => {
    const [firstDocument, secondDocument] = buildFoodSearchDocuments([]);
    if (firstDocument === undefined) throw new Error("expected firstDocument");
    if (secondDocument === undefined)
      throw new Error("expected secondDocument");
    const refreshableDocuments = getFoodDocumentsNeedingEmbeddingRefresh(
      [firstDocument, secondDocument],
      [
        {
          canonicalName: firstDocument.canonicalName,
          embeddingSourceHash: firstDocument.embeddingSourceHash,
        },
        {
          canonicalName: secondDocument.canonicalName,
          embeddingSourceHash: "stale-hash",
        },
      ],
    );

    expect(refreshableDocuments).toEqual([secondDocument]);
    expect(
      getFoodDocumentsNeedingEmbeddingRefresh([firstDocument], []),
    ).toEqual([firstDocument]);
  });
});

describe("upsertFoodEmbeddings with sourceType", () => {
  const FAKE_EMBEDDING = Array(1536).fill(0.1) as number[];

  it("inserts a registry embedding and can update it", async () => {
    const t = convexTest(schema);

    // Insert a registry embedding
    await t.mutation(internal.foodParsing.upsertFoodEmbeddings, {
      rows: [
        {
          canonicalName: "toast",
          sourceText: "Food: toast. Zone: 1. Group: carbs.",
          sourceType: "registry",
          zone: 1 as const,
          group: "carbs" as const,
          line: "grains" as const,
          bucketKey: "line_grains",
          bucketLabel: "Bread, grain, or snack",
          embedding: FAKE_EMBEDDING,
          embeddingSourceHash: "hash-v1",
          updatedAt: 1000,
        },
      ],
    });

    // Verify it was inserted
    await t.run(async (ctx) => {
      const rows = await ctx.db.query("foodEmbeddings").collect();
      expect(rows).toHaveLength(1);
      expect(rows[0].canonicalName).toBe("toast");
      expect(rows[0].sourceType).toBe("registry");
      expect(rows[0].sourceText).toBe("Food: toast. Zone: 1. Group: carbs.");
    });

    // Update it with a new hash
    await t.mutation(internal.foodParsing.upsertFoodEmbeddings, {
      rows: [
        {
          canonicalName: "toast",
          sourceText: "Food: toast. Zone: 1. Group: carbs. Updated.",
          sourceType: "registry",
          zone: 1 as const,
          group: "carbs" as const,
          line: "grains" as const,
          bucketKey: "line_grains",
          bucketLabel: "Bread, grain, or snack",
          embedding: FAKE_EMBEDDING,
          embeddingSourceHash: "hash-v2",
          updatedAt: 2000,
        },
      ],
    });

    // Verify it was updated (not duplicated)
    await t.run(async (ctx) => {
      const rows = await ctx.db.query("foodEmbeddings").collect();
      expect(rows).toHaveLength(1);
      expect(rows[0].embeddingSourceHash).toBe("hash-v2");
      expect(rows[0].updatedAt).toBe(2000);
    });
  });

  it("inserts alias embeddings alongside registry embedding for same canonical", async () => {
    const t = convexTest(schema);

    // Insert a registry embedding
    await t.mutation(internal.foodParsing.upsertFoodEmbeddings, {
      rows: [
        {
          canonicalName: "toast",
          sourceText: "Food: toast.",
          sourceType: "registry",
          zone: 1 as const,
          group: "carbs" as const,
          line: "grains" as const,
          bucketKey: "line_grains",
          bucketLabel: "Bread, grain, or snack",
          embedding: FAKE_EMBEDDING,
          embeddingSourceHash: "registry-hash",
          updatedAt: 1000,
        },
      ],
    });

    // Insert an alias embedding for the same canonical
    await t.mutation(internal.foodParsing.upsertFoodEmbeddings, {
      rows: [
        {
          canonicalName: "toast",
          sourceText: "tostada",
          sourceType: "alias",
          zone: 1 as const,
          group: "carbs" as const,
          line: "grains" as const,
          bucketKey: "line_grains",
          bucketLabel: "Bread, grain, or snack",
          embedding: FAKE_EMBEDDING,
          embeddingSourceHash: "alias-hash-1",
          updatedAt: 2000,
        },
      ],
    });

    // Both should exist
    await t.run(async (ctx) => {
      const rows = await ctx.db
        .query("foodEmbeddings")
        .withIndex("by_canonicalName", (q) => q.eq("canonicalName", "toast"))
        .collect();
      expect(rows).toHaveLength(2);

      const registry = rows.find((r) => r.sourceType === "registry");
      const alias = rows.find((r) => r.sourceType === "alias");
      expect(registry).toBeDefined();
      expect(alias).toBeDefined();
      expect(alias?.sourceText).toBe("tostada");
    });

    // Insert a second alias for the same canonical
    await t.mutation(internal.foodParsing.upsertFoodEmbeddings, {
      rows: [
        {
          canonicalName: "toast",
          sourceText: "chelitos",
          sourceType: "alias",
          zone: 1 as const,
          group: "carbs" as const,
          line: "grains" as const,
          bucketKey: "line_grains",
          bucketLabel: "Bread, grain, or snack",
          embedding: FAKE_EMBEDDING,
          embeddingSourceHash: "alias-hash-2",
          updatedAt: 3000,
        },
      ],
    });

    // Now three rows: registry + 2 aliases
    await t.run(async (ctx) => {
      const rows = await ctx.db
        .query("foodEmbeddings")
        .withIndex("by_canonicalName", (q) => q.eq("canonicalName", "toast"))
        .collect();
      expect(rows).toHaveLength(3);

      const aliases = rows.filter((r) => r.sourceType === "alias");
      expect(aliases).toHaveLength(2);
      const aliasTexts = aliases.map((a) => a.sourceText).sort();
      expect(aliasTexts).toEqual(["chelitos", "tostada"]);
    });
  });

  it("updates an existing alias embedding when sourceText matches", async () => {
    const t = convexTest(schema);

    // Insert initial alias
    await t.mutation(internal.foodParsing.upsertFoodEmbeddings, {
      rows: [
        {
          canonicalName: "toast",
          sourceText: "tostada",
          sourceType: "alias",
          zone: 1 as const,
          group: "carbs" as const,
          line: "grains" as const,
          bucketKey: "line_grains",
          bucketLabel: "Bread, grain, or snack",
          embedding: FAKE_EMBEDDING,
          embeddingSourceHash: "old-hash",
          updatedAt: 1000,
        },
      ],
    });

    // Re-insert same alias with updated hash
    const UPDATED_EMBEDDING = Array(1536).fill(0.2) as number[];
    await t.mutation(internal.foodParsing.upsertFoodEmbeddings, {
      rows: [
        {
          canonicalName: "toast",
          sourceText: "tostada",
          sourceType: "alias",
          zone: 1 as const,
          group: "carbs" as const,
          line: "grains" as const,
          bucketKey: "line_grains",
          bucketLabel: "Bread, grain, or snack",
          embedding: UPDATED_EMBEDDING,
          embeddingSourceHash: "new-hash",
          updatedAt: 2000,
        },
      ],
    });

    // Should still be just one row, updated
    await t.run(async (ctx) => {
      const rows = await ctx.db.query("foodEmbeddings").collect();
      expect(rows).toHaveLength(1);
      expect(rows[0].embeddingSourceHash).toBe("new-hash");
      expect(rows[0].updatedAt).toBe(2000);
    });
  });

  it("treats pre-sourceType rows as registry entries for backward compatibility", async () => {
    const t = convexTest(schema);

    // Manually insert a legacy row without sourceType or sourceText
    await t.run(async (ctx) => {
      await ctx.db.insert("foodEmbeddings", {
        canonicalName: "toast",
        zone: 1 as 1 | 2 | 3,
        group: "carbs" as "protein" | "carbs" | "fats" | "seasoning",
        line: "grains" as
          | "meat_fish"
          | "eggs_dairy"
          | "vegetable_protein"
          | "grains"
          | "vegetables"
          | "fruit"
          | "oils"
          | "dairy_fats"
          | "nuts_seeds"
          | "sauces_condiments"
          | "herbs_spices",
        bucketKey: "line_grains",
        bucketLabel: "Bread, grain, or snack",
        embedding: FAKE_EMBEDDING,
        updatedAt: 500,
      });
    });

    // Upserting a registry entry should update the legacy row
    await t.mutation(internal.foodParsing.upsertFoodEmbeddings, {
      rows: [
        {
          canonicalName: "toast",
          sourceText: "Food: toast.",
          sourceType: "registry",
          zone: 1 as const,
          group: "carbs" as const,
          line: "grains" as const,
          bucketKey: "line_grains",
          bucketLabel: "Bread, grain, or snack",
          embedding: FAKE_EMBEDDING,
          embeddingSourceHash: "new-hash",
          updatedAt: 1000,
        },
      ],
    });

    // Should still be one row, now with sourceType
    await t.run(async (ctx) => {
      const rows = await ctx.db.query("foodEmbeddings").collect();
      expect(rows).toHaveLength(1);
      expect(rows[0].sourceType).toBe("registry");
      expect(rows[0].sourceText).toBe("Food: toast.");
      expect(rows[0].embeddingSourceHash).toBe("new-hash");
    });

    // An alias should create a new row alongside the updated legacy row
    await t.mutation(internal.foodParsing.upsertFoodEmbeddings, {
      rows: [
        {
          canonicalName: "toast",
          sourceText: "tostada",
          sourceType: "alias",
          zone: 1 as const,
          group: "carbs" as const,
          line: "grains" as const,
          bucketKey: "line_grains",
          bucketLabel: "Bread, grain, or snack",
          embedding: FAKE_EMBEDDING,
          embeddingSourceHash: "alias-hash",
          updatedAt: 2000,
        },
      ],
    });

    await t.run(async (ctx) => {
      const rows = await ctx.db.query("foodEmbeddings").collect();
      expect(rows).toHaveLength(2);
    });
  });
});

describe("full pipeline end-to-end", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("exercises the complete pipeline: submit → parse → evidence processing", async () => {
    const t = convexTest(schema);
    const userId = "test-user-e2e";

    // Step 1: User submits raw text with mixed known + unknown foods
    const logId = await t
      .withIdentity({ subject: userId })
      .mutation(api.logs.add, {
        timestamp: Date.now(),
        type: "food",
        data: {
          rawInput: "two toast, honey, xylofruit",
          items: [],
          notes: "",
        },
      });

    // Step 2: Verify log was stored with rawInput and empty items
    await t.run(async (ctx) => {
      const log = await ctx.db.get(logId);
      if (log === null) throw new Error("expected log");
      expect((log as Doc<"logs">).type).toBe("food");
      const data = (log as Doc<"logs">).data as {
        rawInput: string;
        items: unknown[];
      };
      expect(data.rawInput).toBe("two toast, honey, xylofruit");
      expect(data.items).toHaveLength(0);
    });

    // Step 3: Run processLogInternal (scheduled by logs.add at delay 0)
    // This parses deterministically: toast + honey → registry, xylofruit → unresolved
    vi.runAllTimers();
    await t.finishInProgressScheduledFunctions();

    // Step 4: Verify deterministic parsing results
    await t.run(async (ctx) => {
      const log = await ctx.db.get(logId);
      if (log === null) throw new Error("expected log");
      const data = (log as Doc<"logs">).data as {
        rawInput: string;
        items: Array<{
          parsedName: string;
          userSegment: string;
          canonicalName?: string;
          resolvedBy?: string;
          quantity: number | null;
          unit: string | null;
        }>;
      };

      // rawInput preserved immutably
      expect(data.rawInput).toBe("two toast, honey, xylofruit");
      expect(data.items).toHaveLength(3);

      // Toast: registry match with quantity
      expect(data.items[0].parsedName).toBe("toast");
      expect(data.items[0].userSegment).toBe("two toast");
      expect(data.items[0].canonicalName).toBe("toast");
      expect(data.items[0].resolvedBy).toBe("registry");
      expect(data.items[0].quantity).toBe(2);

      // Honey: registry match
      expect(data.items[1].parsedName).toBe("honey");
      expect(data.items[1].canonicalName).toBe("honey");
      expect(data.items[1].resolvedBy).toBe("registry");

      // Xylofruit: unresolved (not in registry)
      expect(data.items[2].parsedName).toBe("xylofruit");
      expect(data.items[2].userSegment).toBe("xylofruit");
      expect(data.items[2].canonicalName).toBeUndefined();
      expect(data.items[2].resolvedBy).toBeUndefined();
    });

    // Step 5: Verify NO exposures exist yet (evidence waits 6 hours)
    await t.run(async (ctx) => {
      const exposures = await ctx.db
        .query("ingredientExposures")
        .withIndex("by_userId_logId", (q) =>
          q.eq("userId", userId).eq("logId", logId),
        )
        .collect();
      expect(exposures).toHaveLength(0);
    });

    // Step 6: Run all scheduled functions (including 6-hour processEvidence)
    // LLM action will silently fail (no OpenAI key) — xylofruit stays unresolved
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());

    // Step 7: Verify final state after evidence processing
    await t.run(async (ctx) => {
      const log = await ctx.db.get(logId);
      if (log === null) throw new Error("expected log");
      const data = (log as Doc<"logs">).data as {
        rawInput: string;
        items: Array<{
          parsedName: string;
          userSegment: string;
          canonicalName?: string;
          resolvedBy?: string;
          quantity: number | null;
        }>;
      };

      // rawInput still immutable
      expect(data.rawInput).toBe("two toast, honey, xylofruit");
      expect(data.items).toHaveLength(3);

      // Toast and honey: resolved, correct canonicalNames
      expect(data.items[0].canonicalName).toBe("toast");
      expect(data.items[0].resolvedBy).toBe("registry");
      expect(data.items[1].canonicalName).toBe("honey");
      expect(data.items[1].resolvedBy).toBe("registry");

      // Xylofruit: expired to unknown_food
      expect(data.items[2].canonicalName).toBe("unknown_food");
      expect(data.items[2].resolvedBy).toBe("expired");

      // Check exposures: only resolved items get exposures
      const exposures = await ctx.db
        .query("ingredientExposures")
        .withIndex("by_userId_logId", (q) =>
          q.eq("userId", userId).eq("logId", logId),
        )
        .collect();

      // Toast + honey = 2 exposures. No unknown_food exposure.
      expect(exposures).toHaveLength(2);

      const canonicals = exposures.map((e) => e.canonicalName).sort();
      expect(canonicals).toEqual(["honey", "toast"]);

      // Verify no unknown_food in exposures
      const unknownExposures = exposures.filter(
        (e) => e.canonicalName === "unknown_food",
      );
      expect(unknownExposures).toHaveLength(0);

      // Verify resolved items have correct canonicalNames in exposures
      const toastExposure = exposures.find((e) => e.canonicalName === "toast");
      if (toastExposure === undefined)
        throw new Error("expected toastExposure");
      expect(toastExposure.ingredientName).toBe("two toast");

      const honeyExposure = exposures.find((e) => e.canonicalName === "honey");
      if (honeyExposure === undefined)
        throw new Error("expected honeyExposure");
      expect(honeyExposure.ingredientName).toBe("honey");
    });
  });
});

describe("processEvidence (6-hour evidence window)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates ingredientExposures for resolved items after 6 hours", async () => {
    const t = convexTest(schema);
    const userId = "test-user-evidence";

    const logId = await t
      .withIdentity({ subject: userId })
      .mutation(api.logs.add, {
        timestamp: Date.now(),
        type: "food",
        data: {
          rawInput: "toast, honey",
          items: [],
          notes: "",
        },
      });

    // Run processLogInternal (delay 0) — parses items, schedules processEvidence at 6h
    vi.runAllTimers();
    await t.finishInProgressScheduledFunctions();

    // Verify no exposures yet
    await t.run(async (ctx) => {
      const exposures = await ctx.db
        .query("ingredientExposures")
        .withIndex("by_userId_logId", (q) =>
          q.eq("userId", userId).eq("logId", logId),
        )
        .collect();
      expect(exposures).toHaveLength(0);
    });

    // Run all remaining scheduled functions (including 6-hour processEvidence)
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());

    await t.run(async (ctx) => {
      const exposures = await ctx.db
        .query("ingredientExposures")
        .withIndex("by_userId_logId", (q) =>
          q.eq("userId", userId).eq("logId", logId),
        )
        .collect();

      // Both toast and honey are registry-resolved — should have 2 exposures
      expect(exposures).toHaveLength(2);
      expect(exposures[0].canonicalName).toBe("toast");
      expect(exposures[0].ingredientName).toBe("toast");
      expect(exposures[0].itemIndex).toBe(0);
      expect(exposures[1].canonicalName).toBe("honey");
      expect(exposures[1].ingredientName).toBe("honey");
      expect(exposures[1].itemIndex).toBe(1);
    });
  });

  it("expires unresolved items to unknown_food and excludes them from evidence", async () => {
    const t = convexTest(schema);
    const userId = "test-user-expire";

    const logId = await t
      .withIdentity({ subject: userId })
      .mutation(api.logs.add, {
        timestamp: Date.now(),
        type: "food",
        data: {
          rawInput: "toast, xylofruit",
          items: [],
          notes: "",
        },
      });

    // Run processLogInternal (delay 0) + LLM scheduling
    vi.runAllTimers();
    await t.finishInProgressScheduledFunctions();

    // Run all scheduled functions (including 6-hour processEvidence)
    // Note: LLM action will fail (no OpenAI key in test) — that's fine,
    // xylofruit stays unresolved and gets expired
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());

    await t.run(async (ctx) => {
      // Check that xylofruit was expired in the log data
      const log = await ctx.db.get(logId);
      if (log === null) throw new Error("expected log");
      const data = (log as Doc<"logs">).data as {
        items: Array<{
          parsedName: string;
          canonicalName?: string;
          resolvedBy?: string;
        }>;
      };
      expect(data.items).toHaveLength(2);

      // Toast stays resolved
      expect(data.items[0].canonicalName).toBe("toast");
      expect(data.items[0].resolvedBy).toBe("registry");

      // Xylofruit expired to unknown_food
      expect(data.items[1].canonicalName).toBe("unknown_food");
      expect(data.items[1].resolvedBy).toBe("expired");

      // Only toast should have an exposure — unknown_food is excluded
      const exposures = await ctx.db
        .query("ingredientExposures")
        .withIndex("by_userId_logId", (q) =>
          q.eq("userId", userId).eq("logId", logId),
        )
        .collect();
      expect(exposures).toHaveLength(1);
      expect(exposures[0].canonicalName).toBe("toast");
    });
  });

  it("idempotency: does not create duplicate exposures on re-run", async () => {
    const t = convexTest(schema);
    const userId = "test-user-idempotent";

    const logId = await t
      .withIdentity({ subject: userId })
      .mutation(api.logs.add, {
        timestamp: Date.now(),
        type: "food",
        data: {
          rawInput: "toast",
          items: [],
          notes: "",
        },
      });

    // Run processLogInternal + all scheduled (including processEvidence)
    vi.runAllTimers();
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());

    await t.run(async (ctx) => {
      const exposures = await ctx.db
        .query("ingredientExposures")
        .withIndex("by_userId_logId", (q) =>
          q.eq("userId", userId).eq("logId", logId),
        )
        .collect();
      expect(exposures).toHaveLength(1);
    });

    // Call processLog again (which schedules another processEvidence)
    await t
      .withIdentity({ subject: userId })
      .mutation(api.foodParsing.processLog, { logId });

    // Run the newly scheduled processEvidence
    vi.runAllTimers();
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());

    await t.run(async (ctx) => {
      // Still only 1 exposure — idempotency guard prevented duplicate
      const exposures = await ctx.db
        .query("ingredientExposures")
        .withIndex("by_userId_logId", (q) =>
          q.eq("userId", userId).eq("logId", logId),
        )
        .collect();
      expect(exposures).toHaveLength(1);
    });
  });

  it("editing a new-style food log clears exposures and re-schedules processing", async () => {
    const t = convexTest(schema);
    const userId = "test-user-edit-evidence";
    const now = Date.now();

    const logId = await t
      .withIdentity({ subject: userId })
      .mutation(api.logs.add, {
        timestamp: now,
        type: "food",
        data: {
          rawInput: "toast",
          items: [],
          notes: "",
        },
      });

    // Run processLogInternal + processEvidence
    vi.runAllTimers();
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());

    // Verify exposure exists
    await t.run(async (ctx) => {
      const exposures = await ctx.db
        .query("ingredientExposures")
        .withIndex("by_userId_logId", (q) =>
          q.eq("userId", userId).eq("logId", logId),
        )
        .collect();
      expect(exposures).toHaveLength(1);
      expect(exposures[0].canonicalName).toBe("toast");
    });

    // Edit the log to change rawInput
    await t.withIdentity({ subject: userId }).mutation(api.logs.update, {
      id: logId,
      timestamp: now,
      data: {
        rawInput: "honey, banana",
        items: [],
        notes: "",
      },
    });

    // Old exposures should be cleared immediately
    await t.run(async (ctx) => {
      const exposures = await ctx.db
        .query("ingredientExposures")
        .withIndex("by_userId_logId", (q) =>
          q.eq("userId", userId).eq("logId", logId),
        )
        .collect();
      expect(exposures).toHaveLength(0);
    });

    // Re-run the server matcher explicitly so the new action-based pipeline
    // completes before the assertions below.
    await t.action(internal.foodParsing.processLogInternal, { logId });

    // Verify items were re-parsed
    await t.run(async (ctx) => {
      const log = await ctx.db.get(logId);
      if (log === null) throw new Error("expected log");
      const logData = (log as Doc<"logs">).data as {
        rawInput?: string;
        items: Array<{
          parsedName?: string;
          canonicalName?: string;
          resolvedBy?: string;
        }>;
      };
      expect(logData.rawInput).toBe("honey, banana");
      expect(logData.items).toHaveLength(2);
      expect(logData.items[0].canonicalName).toBe("honey");
      expect(logData.items[1].canonicalName).toBe("ripe banana");
    });

    // Run the 6-hour processEvidence scheduled by processLogInternal
    vi.runAllTimers();
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());

    // Verify new exposures were created for the updated food items
    await t.run(async (ctx) => {
      const exposures = await ctx.db
        .query("ingredientExposures")
        .withIndex("by_userId_logId", (q) =>
          q.eq("userId", userId).eq("logId", logId),
        )
        .collect();
      expect(exposures).toHaveLength(2);

      const canonicals = exposures.map((e) => e.canonicalName).sort();
      expect(canonicals).toEqual(["honey", "ripe banana"]);
    });
  });
});
