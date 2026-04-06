import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

describe("ingredientProfiles", () => {
  it("projects known foods onto registry group/line metadata", async () => {
    const t = convexTest(schema);
    const userId = "test-user-123";

    await t.withIdentity({ subject: userId }).mutation(api.ingredientProfiles.upsert, {
      canonicalName: " Scrambled   Eggs ",
      displayName: "Scrambled eggs",
      tags: ["Breakfast", " egg ", "egg", "Low Residue"],
      lowResidue: true,
      source: "manual",
      now: Date.now(),
      nutritionPer100g: {
        kcal: 143,
        proteinG: 13,
      },
    });

    const rows = await t.withIdentity({ subject: userId }).query(api.ingredientProfiles.list, {});
    expect(rows).toHaveLength(1);
    expect(rows[0].canonicalName).toBe("egg");
    expect(rows[0].tags).toEqual(["breakfast", "egg", "low residue"]);
    expect(rows[0].foodGroup).toBe("protein");
    expect(rows[0].foodLine).toBe("eggs_dairy");
    expect(rows[0].lowResidue).toBe(true);
    expect(rows[0].nutritionPer100g.kcal).toBe(143);
    expect(rows[0].nutritionPer100g.proteinG).toBe(13);
  });

  it("merges nutrition patch fields and leaves non-registry foods unprojected", async () => {
    const t = convexTest(schema);
    const userId = "test-user-456";

    await t.withIdentity({ subject: userId }).mutation(api.ingredientProfiles.upsert, {
      canonicalName: "xylofruit",
      displayName: "Xylofruit",
      now: Date.now(),
      nutritionPer100g: {
        kcal: 250,
      },
    });

    await t.withIdentity({ subject: userId }).mutation(api.ingredientProfiles.upsert, {
      canonicalName: "xylofruit",
      now: Date.now(),
      nutritionPer100g: {
        proteinG: 8,
      },
    });

    const row = await t
      .withIdentity({ subject: userId })
      .query(api.ingredientProfiles.byIngredient, {
        canonicalName: "xylofruit",
      });
    expect(row).not.toBeNull();
    expect(row?.foodGroup).toBeNull();
    expect(row?.foodLine).toBeNull();
    expect(row?.nutritionPer100g.kcal).toBe(250);
    expect(row?.nutritionPer100g.proteinG).toBe(8);
  });

  it("requires authentication", async () => {
    const t = convexTest(schema);

    await expect(t.query(api.ingredientProfiles.list, {})).rejects.toThrow("Not authenticated");
    await expect(
      t.mutation(api.ingredientProfiles.upsert, {
        canonicalName: "xylofruit",
        now: Date.now(),
      }),
    ).rejects.toThrow("Not authenticated");
  });
});
