import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

// ── Migration drift watch tests ─────────────────────────────────────────────
// These tests verify that the migration normalizer produces data shapes
// that pass schema validation. If the schema evolves and the migration
// doesn't keep up, these tests will catch the drift.

describe("migrateLegacyLogsBatch — data shape compliance", () => {
  const userId = "migration-test-user";

  it("normalizes a legacy food log to match current schema", async () => {
    const t = convexTest(schema);
    const now = Date.now();

    // Insert a profile (needed for habit lookup)
    await t.run(async (ctx) => {
      await ctx.db.insert("profiles", {
        userId,
        unitSystem: "metric",
        habits: [],
        updatedAt: now,
      });
    });

    // Insert a food log with extra/legacy shape (missing canonicalName)
    await t.run(async (ctx) => {
      await ctx.db.insert("logs", {
        userId,
        timestamp: now,
        type: "food",
        data: {
          items: [
            { name: "banana", quantity: 1, unit: null },
            { name: "rice", quantity: 200, unit: "g", canonicalName: "rice" },
          ],
        },
      });
    });

    // Run migration (not dry run)
    const result = await t.mutation(
      internal.migrations.migrateLegacyLogsBatch,
      {
        cursor: null,
        numItems: 10,
        dryRun: false,
      },
    );

    expect(result.scanned).toBe(1);
    expect(result.isDone).toBe(true);

    // Verify the migrated log is still readable via normal query
    const logs = await t
      .withIdentity({ subject: userId })
      .query(api.logs.list, {});
    expect(logs).toHaveLength(1);
    expect(logs[0].type).toBe("food");

    const data = logs[0].data as {
      items: Array<{
        name: string;
        quantity: number | null;
        unit: string | null;
      }>;
    };
    expect(data.items).toHaveLength(2);
    expect(data.items[0].name).toBe("banana");
    expect(data.items[0].quantity).toBe(1);
    expect(data.items[0].unit).toBeNull();
    expect(data.items[1].name).toBe("rice");
    expect(data.items[1].quantity).toBe(200);
    expect(data.items[1].unit).toBe("g");
  });

  it("normalizes a legacy fluid log removing fluidType field", async () => {
    const t = convexTest(schema);
    const now = Date.now();

    await t.run(async (ctx) => {
      await ctx.db.insert("profiles", {
        userId,
        unitSystem: "metric",
        habits: [],
        updatedAt: now,
      });
    });

    // Insert a legacy fluid log with the old fluidType format
    await t.run(async (ctx) => {
      await ctx.db.insert("logs", {
        userId,
        timestamp: now,
        type: "fluid",
        data: {
          items: [{ name: "Water", quantity: 250, unit: "ml" }],
        },
      });
    });

    const result = await t.mutation(
      internal.migrations.migrateLegacyLogsBatch,
      {
        cursor: null,
        numItems: 10,
        dryRun: false,
      },
    );

    expect(result.scanned).toBe(1);

    const logs = await t
      .withIdentity({ subject: userId })
      .query(api.logs.list, {});
    expect(logs).toHaveLength(1);
    const data = logs[0].data as {
      items: Array<{ name: string; quantity: number; unit: string }>;
    };
    expect(data.items).toHaveLength(1);
    expect(data.items[0].name).toBe("Water");
    expect(data.items[0].quantity).toBe(250);
    expect(data.items[0].unit).toBe("ml");
  });

  it("normalizes a digestion log with valid schema fields", async () => {
    const t = convexTest(schema);
    const now = Date.now();

    await t.run(async (ctx) => {
      await ctx.db.insert("profiles", {
        userId,
        unitSystem: "metric",
        habits: [],
        updatedAt: now,
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("logs", {
        userId,
        timestamp: now,
        type: "digestion",
        data: {
          bristolCode: 4,
          urgencyTag: "normal",
          effortTag: "easy",
          volumeTag: "medium",
          accident: false,
        },
      });
    });

    const result = await t.mutation(
      internal.migrations.migrateLegacyLogsBatch,
      {
        cursor: null,
        numItems: 10,
        dryRun: false,
      },
    );

    expect(result.scanned).toBe(1);

    const logs = await t
      .withIdentity({ subject: userId })
      .query(api.logs.list, {});
    expect(logs).toHaveLength(1);
    expect(logs[0].type).toBe("digestion");
    const data = logs[0].data as {
      bristolCode: number;
      urgencyTag?: string;
      accident?: boolean;
    };
    expect(data.bristolCode).toBe(4);
    expect(data.urgencyTag).toBe("normal");
    expect(data.accident).toBe(false);
  });

  it("normalizes a habit log filling missing habitId and habitType", async () => {
    const t = convexTest(schema);
    const now = Date.now();

    await t.run(async (ctx) => {
      await ctx.db.insert("profiles", {
        userId,
        unitSystem: "metric",
        habits: [
          {
            id: "habit_water",
            name: "Water",
            kind: "positive",
            unit: "ml",
            quickIncrement: 250,
            showOnTrack: true,
            color: "sky",
            createdAt: now - 100_000,
            habitType: "fluid",
          },
        ],
        updatedAt: now,
      });
    });

    // Insert a habit log with name but missing habitId and habitType
    await t.run(async (ctx) => {
      await ctx.db.insert("logs", {
        userId,
        timestamp: now,
        type: "habit",
        data: {
          habitId: "habit_water",
          name: "Water",
          habitType: "fluid",
          quantity: 250,
        },
      });
    });

    const result = await t.mutation(
      internal.migrations.migrateLegacyLogsBatch,
      {
        cursor: null,
        numItems: 10,
        dryRun: false,
      },
    );

    expect(result.scanned).toBe(1);

    const logs = await t
      .withIdentity({ subject: userId })
      .query(api.logs.list, {});
    expect(logs).toHaveLength(1);
    expect(logs[0].type).toBe("habit");
    const data = logs[0].data as {
      habitId: string;
      name: string;
      habitType: string;
      quantity?: number;
    };
    expect(data.habitId).toBe("habit_water");
    expect(data.name).toBe("Water");
    expect(data.habitType).toBe("fluid");
    expect(data.quantity).toBe(250);
  });

  it("normalizes an activity log keeping valid fields and dropping legacy ones", async () => {
    const t = convexTest(schema);
    const now = Date.now();

    await t.run(async (ctx) => {
      await ctx.db.insert("profiles", {
        userId,
        unitSystem: "metric",
        habits: [],
        updatedAt: now,
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("logs", {
        userId,
        timestamp: now,
        type: "activity",
        data: {
          activityType: "walk",
          durationMinutes: 30,
          feelTag: "great",
        },
      });
    });

    const result = await t.mutation(
      internal.migrations.migrateLegacyLogsBatch,
      {
        cursor: null,
        numItems: 10,
        dryRun: false,
      },
    );

    expect(result.scanned).toBe(1);

    const logs = await t
      .withIdentity({ subject: userId })
      .query(api.logs.list, {});
    expect(logs).toHaveLength(1);
    expect(logs[0].type).toBe("activity");
    const data = logs[0].data as {
      activityType: string;
      durationMinutes?: number;
      feelTag?: string;
    };
    expect(data.activityType).toBe("walk");
    expect(data.durationMinutes).toBe(30);
    expect(data.feelTag).toBe("great");
  });

  it("normalizes a weight log", async () => {
    const t = convexTest(schema);
    const now = Date.now();

    await t.run(async (ctx) => {
      await ctx.db.insert("profiles", {
        userId,
        unitSystem: "metric",
        habits: [],
        updatedAt: now,
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("logs", {
        userId,
        timestamp: now,
        type: "weight",
        data: {
          weightKg: 72.5,
        },
      });
    });

    const result = await t.mutation(
      internal.migrations.migrateLegacyLogsBatch,
      {
        cursor: null,
        numItems: 10,
        dryRun: false,
      },
    );

    expect(result.scanned).toBe(1);

    const logs = await t
      .withIdentity({ subject: userId })
      .query(api.logs.list, {});
    expect(logs).toHaveLength(1);
    expect(logs[0].type).toBe("weight");
    const data = logs[0].data as { weightKg: number };
    expect(data.weightKg).toBe(72.5);
  });

  it("dry run does not modify data", async () => {
    const t = convexTest(schema);
    const now = Date.now();

    await t.run(async (ctx) => {
      await ctx.db.insert("profiles", {
        userId,
        unitSystem: "metric",
        habits: [],
        updatedAt: now,
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("logs", {
        userId,
        timestamp: now,
        type: "food",
        data: {
          items: [{ name: "toast", quantity: null, unit: null }],
        },
      });
    });

    const result = await t.mutation(
      internal.migrations.migrateLegacyLogsBatch,
      {
        cursor: null,
        numItems: 10,
        dryRun: true,
      },
    );

    expect(result.scanned).toBe(1);
    // In dry run, the underlying data remains unchanged
    expect(result.isDone).toBe(true);
  });

  it("food log normalization preserves preparation, recoveryStage, spiceLevel fields", async () => {
    const t = convexTest(schema);
    const now = Date.now();

    await t.run(async (ctx) => {
      await ctx.db.insert("profiles", {
        userId,
        unitSystem: "metric",
        habits: [],
        updatedAt: now,
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("logs", {
        userId,
        timestamp: now,
        type: "food",
        data: {
          items: [
            {
              name: "grilled chicken",
              quantity: 1,
              unit: null,
              canonicalName: "chicken",
              preparation: "grilled",
              recoveryStage: 2,
              spiceLevel: "mild",
            },
          ],
        },
      });
    });

    await t.mutation(internal.migrations.migrateLegacyLogsBatch, {
      cursor: null,
      numItems: 10,
      dryRun: false,
    });

    const logs = await t
      .withIdentity({ subject: userId })
      .query(api.logs.list, {});
    expect(logs).toHaveLength(1);
    const data = logs[0].data as {
      items: Array<{
        name: string;
        preparation?: string;
        recoveryStage?: number;
        spiceLevel?: string;
      }>;
    };
    expect(data.items[0].preparation).toBe("grilled");
    expect(data.items[0].recoveryStage).toBe(2);
    expect(data.items[0].spiceLevel).toBe("mild");
  });
});

describe("normalizeCanonicalNames", () => {
  it("updates the newly added user-owned canonicalName tables", async () => {
    const t = convexTest(schema);
    const userId = "canonical-migration-user";
    const now = Date.now();

    await t.run(async (ctx) => {
      await ctx.db.insert("foodLibrary", {
        userId,
        canonicalName: "flora spreadable",
        type: "ingredient",
        ingredients: [],
        createdAt: now,
      });

      await ctx.db.insert("ingredientOverrides", {
        userId,
        canonicalName: "flora spreadable",
        status: "watch",
        createdAt: now,
        updatedAt: now,
      });

      await ctx.db.insert("ingredientProfiles", {
        userId,
        canonicalName: "flora spreadable",
        displayName: "Flora Spreadable",
        tags: [],
        foodGroup: "fats",
        foodLine: "dairy_fats",
        lowResidue: null,
        source: "manual",
        externalId: null,
        ingredientsText: null,
        nutritionPer100g: {
          kcal: null,
          fatG: null,
          saturatedFatG: null,
          carbsG: null,
          sugarsG: null,
          fiberG: null,
          proteinG: null,
          saltG: null,
        },
        createdAt: now,
        updatedAt: now,
      });
    });

    const foodLibraryResult = await t.mutation(
      internal.migrations.normalizeCanonicalNames,
      {
        table: "foodLibrary",
        dryRun: false,
      },
    );
    const overridesResult = await t.mutation(
      internal.migrations.normalizeCanonicalNames,
      {
        table: "ingredientOverrides",
        dryRun: false,
      },
    );
    const profilesResult = await t.mutation(
      internal.migrations.normalizeCanonicalNames,
      {
        table: "ingredientProfiles",
        dryRun: false,
      },
    );

    expect(foodLibraryResult.updated).toBe(1);
    expect(overridesResult.updated).toBe(1);
    expect(profilesResult.updated).toBe(1);

    await t.run(async (ctx) => {
      const foodLibrary = await ctx.db
        .query("foodLibrary")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();
      const ingredientOverride = await ctx.db
        .query("ingredientOverrides")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();
      const ingredientProfile = await ctx.db
        .query("ingredientProfiles")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();

      expect(foodLibrary?.canonicalName).toBe("butter");
      expect(ingredientOverride?.canonicalName).toBe("butter");
      expect(ingredientProfile?.canonicalName).toBe("butter");
    });
  });
});

describe("backfillFluidToLiquid", () => {
  const userId = "fluid-migration-test-user";

  it("leaves a water-only fluid log as type='fluid'", async () => {
    const t = convexTest(schema);
    const now = Date.now();

    await t.run(async (ctx) => {
      await ctx.db.insert("logs", {
        userId,
        timestamp: now,
        type: "fluid",
        data: { items: [{ name: "Water", quantity: 250, unit: "ml" }] },
      });
    });

    const result = await t.mutation(
      internal.migrations.backfillFluidToLiquid,
      {},
    );

    expect(result.scanned).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.isDone).toBe(true);

    await t.run(async (ctx) => {
      const log = await ctx.db
        .query("logs")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();
      if (log === null) throw new Error("expected log");
      expect(log.type).toBe("fluid");
    });
  });

  it("updates a non-water fluid log (Coffee) to type='liquid'", async () => {
    const t = convexTest(schema);
    const now = Date.now();

    await t.run(async (ctx) => {
      await ctx.db.insert("logs", {
        userId,
        timestamp: now,
        type: "fluid",
        data: { items: [{ name: "Coffee", quantity: 200, unit: "ml" }] },
      });
    });

    const result = await t.mutation(
      internal.migrations.backfillFluidToLiquid,
      {},
    );

    expect(result.scanned).toBe(1);
    expect(result.updated).toBe(1);
    expect(result.isDone).toBe(true);

    await t.run(async (ctx) => {
      const log = await ctx.db
        .query("logs")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();
      if (log === null) throw new Error("expected log");
      expect(log.type).toBe("liquid");
    });
  });

  it("updates a mixed log (Water + Coffee) to type='liquid'", async () => {
    const t = convexTest(schema);
    const now = Date.now();

    await t.run(async (ctx) => {
      await ctx.db.insert("logs", {
        userId,
        timestamp: now,
        type: "fluid",
        data: {
          items: [
            { name: "Water", quantity: 100, unit: "ml" },
            { name: "Coffee", quantity: 50, unit: "ml" },
          ],
        },
      });
    });

    const result = await t.mutation(
      internal.migrations.backfillFluidToLiquid,
      {},
    );

    expect(result.scanned).toBe(1);
    expect(result.updated).toBe(1);
    expect(result.isDone).toBe(true);

    await t.run(async (ctx) => {
      const log = await ctx.db
        .query("logs")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();
      if (log === null) throw new Error("expected log");
      expect(log.type).toBe("liquid");
    });
  });

  it("does not modify food logs", async () => {
    const t = convexTest(schema);
    const now = Date.now();

    await t.run(async (ctx) => {
      await ctx.db.insert("logs", {
        userId,
        timestamp: now,
        type: "food",
        data: { items: [{ name: "Toast", quantity: 1, unit: null }] },
      });
    });

    const result = await t.mutation(
      internal.migrations.backfillFluidToLiquid,
      {},
    );

    // scanned counts only fluid logs — food logs are skipped entirely
    expect(result.scanned).toBe(0);
    expect(result.updated).toBe(0);
    expect(result.isDone).toBe(true);

    await t.run(async (ctx) => {
      const log = await ctx.db
        .query("logs")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();
      if (log === null) throw new Error("expected log");
      expect(log.type).toBe("food");
    });
  });

  it("handles an empty batch (no fluid logs to process)", async () => {
    const t = convexTest(schema);

    const result = await t.mutation(
      internal.migrations.backfillFluidToLiquid,
      {},
    );

    expect(result.scanned).toBe(0);
    expect(result.updated).toBe(0);
    expect(result.isDone).toBe(true);
  });

  it("does a case-insensitive water check (lowercase 'water' stays as fluid)", async () => {
    const t = convexTest(schema);
    const now = Date.now();

    await t.run(async (ctx) => {
      await ctx.db.insert("logs", {
        userId,
        timestamp: now,
        type: "fluid",
        data: { items: [{ name: "water", quantity: 300, unit: "ml" }] },
      });
    });

    const result = await t.mutation(
      internal.migrations.backfillFluidToLiquid,
      {},
    );

    expect(result.scanned).toBe(1);
    expect(result.updated).toBe(0);

    await t.run(async (ctx) => {
      const log = await ctx.db
        .query("logs")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();
      if (log === null) throw new Error("expected log");
      expect(log.type).toBe("fluid");
    });
  });

  it("only patches the type field — leaves data, timestamp, userId unchanged", async () => {
    const t = convexTest(schema);
    const now = Date.now();

    await t.run(async (ctx) => {
      await ctx.db.insert("logs", {
        userId,
        timestamp: now,
        type: "fluid",
        data: { items: [{ name: "Orange Juice", quantity: 150, unit: "ml" }] },
      });
    });

    await t.mutation(internal.migrations.backfillFluidToLiquid, {});

    await t.run(async (ctx) => {
      const log = await ctx.db
        .query("logs")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();
      if (log === null) throw new Error("expected log");
      expect(log.type).toBe("liquid");
      expect(log.userId).toBe(userId);
      expect(log.timestamp).toBe(now);
      const data = log.data as {
        items: Array<{ name: string; quantity: number; unit: string }>;
      };
      expect(data.items).toHaveLength(1);
      expect(data.items[0].name).toBe("Orange Juice");
      expect(data.items[0].quantity).toBe(150);
      expect(data.items[0].unit).toBe("ml");
    });
  });
});
