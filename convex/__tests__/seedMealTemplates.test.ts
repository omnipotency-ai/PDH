import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { internal } from "../_generated/api";
import schema from "../schema";
import {
  buildMealTemplateRows,
  MEAL_TEMPLATE_DEFINITIONS,
} from "../seedMealTemplates";

describe("MEAL_TEMPLATE_DEFINITIONS", () => {
  it("defines the expected canonical templates and breakfast defaults", () => {
    expect(
      MEAL_TEMPLATE_DEFINITIONS.map((template) => template.canonicalName),
    ).toEqual(["coffee + toast", "toast + spread"]);

    expect(MEAL_TEMPLATE_DEFINITIONS[0]).toMatchObject({
      type: "composite",
      ingredients: ["coffee", "toast"],
      structuredIngredients: [
        { canonicalName: "coffee", quantity: 200, unit: "ml" },
        { canonicalName: "toast", quantity: 2, unit: "slice" },
      ],
      slotDefaults: [
        {
          slot: "breakfast",
          overrides: [
            { canonicalName: "coffee", quantity: 200, unit: "ml" },
            { canonicalName: "toast", quantity: 2, unit: "slice" },
          ],
        },
      ],
    });

    expect(MEAL_TEMPLATE_DEFINITIONS[1].modifiers).toEqual([
      { canonicalName: "butter", quantity: 1, unit: "tsp", isDefault: false },
      { canonicalName: "jam", quantity: 1, unit: "tsp", isDefault: false },
      {
        canonicalName: "peanut butter",
        quantity: 1,
        unit: "tsp",
        isDefault: false,
      },
      {
        canonicalName: "cream cheese",
        quantity: 1,
        unit: "tbsp",
        isDefault: false,
      },
    ]);
  });

  it("builds per-user rows with a shared createdAt timestamp", () => {
    const rows = buildMealTemplateRows("user-123", 1712534400000);

    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.userId === "user-123")).toBe(true);
    expect(rows.every((row) => row.createdAt === 1712534400000)).toBe(true);
  });
});

describe("seedMealTemplates", () => {
  it("seeds both composite templates for a user", async () => {
    const t = convexTest(schema);
    const result = await t.mutation(
      internal.seedMealTemplates.seedMealTemplates,
      {
        userId: "user-123",
      },
    );

    expect(result).toEqual({
      inserted: 2,
      skipped: 0,
      total: 2,
      dryRun: false,
    });

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("foodLibrary")
        .withIndex("by_userId", (q) => q.eq("userId", "user-123"))
        .collect(),
    );

    expect(rows.map((row) => row.canonicalName).sort()).toEqual([
      "coffee + toast",
      "toast + spread",
    ]);
    expect(rows.every((row) => row.type === "composite")).toBe(true);

    const coffeeToast = rows.find(
      (row) => row.canonicalName === "coffee + toast",
    );
    expect(coffeeToast?.structuredIngredients).toEqual([
      { canonicalName: "coffee", quantity: 200, unit: "ml" },
      { canonicalName: "toast", quantity: 2, unit: "slice" },
    ]);
    expect(coffeeToast?.slotDefaults).toEqual([
      {
        slot: "breakfast",
        overrides: [
          { canonicalName: "coffee", quantity: 200, unit: "ml" },
          { canonicalName: "toast", quantity: 2, unit: "slice" },
        ],
      },
    ]);
  });

  it("is idempotent and preserves an existing user-owned template", async () => {
    const t = convexTest(schema);
    const userId = "user-456";

    await t.run(async (ctx) => {
      await ctx.db.insert("foodLibrary", {
        userId,
        canonicalName: "coffee + toast",
        type: "composite",
        ingredients: ["coffee"],
        structuredIngredients: [
          { canonicalName: "coffee", quantity: 150, unit: "ml" },
        ],
        modifiers: [],
        sizes: [],
        slotDefaults: [],
        createdAt: 1,
      });
    });

    const first = await t.mutation(
      internal.seedMealTemplates.seedMealTemplates,
      {
        userId,
      },
    );
    const second = await t.mutation(
      internal.seedMealTemplates.seedMealTemplates,
      {
        userId,
      },
    );

    expect(first).toEqual({ inserted: 1, skipped: 1, total: 2, dryRun: false });
    expect(second).toEqual({
      inserted: 0,
      skipped: 2,
      total: 2,
      dryRun: false,
    });

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("foodLibrary")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect(),
    );

    expect(rows).toHaveLength(2);

    const coffeeToast = rows.find(
      (row) => row.canonicalName === "coffee + toast",
    );
    expect(coffeeToast?.createdAt).toBe(1);
    expect(coffeeToast?.ingredients).toEqual(["coffee"]);
    expect(coffeeToast?.structuredIngredients).toEqual([
      { canonicalName: "coffee", quantity: 150, unit: "ml" },
    ]);
    expect(coffeeToast?.modifiers).toEqual([]);
  });
});
