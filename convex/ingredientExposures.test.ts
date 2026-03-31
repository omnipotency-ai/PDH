import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import schema from "./schema";

describe("ingredientExposures", () => {
  it("groups exposures by canonical name and returns history via index", async () => {
    const t = convexTest(schema);
    const userId = "test-user-123";
    // March 15, 2026 (month is zero-indexed)
    const baseTime = Date.UTC(2026, 2, 15, 11, 0, 0);

    // Stored canonical names are pre-normalized (migration ensures this).
    await t.run(async (ctx) => {
      const logId = await ctx.db.insert("logs", {
        userId,
        timestamp: baseTime,
        type: "food",
        data: { items: [] },
      });

      await ctx.db.insert("ingredientExposures", {
        userId,
        logId,
        itemIndex: 0,
        logTimestamp: baseTime + 1,
        ingredientName: "Fresh Baked Baguette",
        canonicalName: "white bread",
        quantity: 1,
        unit: "slice",
        createdAt: baseTime + 1,
      });

      await ctx.db.insert("ingredientExposures", {
        userId,
        logId,
        itemIndex: 1,
        logTimestamp: baseTime + 2,
        ingredientName: "White Bread",
        canonicalName: "white bread",
        quantity: 1,
        unit: "slice",
        createdAt: baseTime + 2,
      });
    });

    const result = await t
      .withIdentity({ subject: userId })
      .query(api.ingredientExposures.allIngredients, {});
    expect(result.ingredients).toHaveLength(1);
    expect(result.count).toBe(1);
    expect(result.isTruncated).toBe(false);
    expect(result.ingredients[0]?.canonicalName).toBe("white bread");
    expect(result.ingredients[0]?.displayName).toBe("White Bread");
    expect(result.ingredients[0]?.totalExposures).toBe(2);

    // Caller passes non-normalized name — input normalization resolves it.
    const history = await t
      .withIdentity({ subject: userId })
      .query(api.ingredientExposures.historyByIngredient, {
        canonicalName: "Baguette",
      });
    expect(history).toHaveLength(2);
    expect(history.every((row: Doc<"ingredientExposures">) => row.canonicalName === "white bread")).toBe(
      true,
    );
    expect(history[0]?.ingredientName).toBe("White Bread");
    expect(history[1]?.ingredientName).toBe("Fresh Baked Baguette");
  });
});
