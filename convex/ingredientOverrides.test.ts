import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

describe("ingredientOverrides", () => {
  it("upserts and lists ingredient overrides for the authenticated user", async () => {
    const t = convexTest(schema);
    const userId = "test-user-123";

    await t.withIdentity({ subject: userId }).mutation(api.ingredientOverrides.upsert, {
      canonicalName: " Fresh Baked Xylofruit ",
      status: "avoid",
      now: Date.now(),
    });

    const rows = await t.withIdentity({ subject: userId }).query(api.ingredientOverrides.list, {});
    expect(rows).toHaveLength(1);
    expect(rows[0].canonicalName).toBe("baked xylofruit");
    expect(rows[0].status).toBe("avoid");

    await t.withIdentity({ subject: userId }).mutation(api.ingredientOverrides.upsert, {
      canonicalName: "fresh baked xylofruit",
      status: "safe",
      now: Date.now(),
    });

    const updated = await t
      .withIdentity({ subject: userId })
      .query(api.ingredientOverrides.list, {});
    expect(updated).toHaveLength(1);
    expect(updated[0].status).toBe("safe");
  });

  it("removes an existing override", async () => {
    const t = convexTest(schema);
    const userId = "test-user-123";

    await t.withIdentity({ subject: userId }).mutation(api.ingredientOverrides.upsert, {
      canonicalName: "toast",
      status: "watch",
      now: Date.now(),
    });

    const result = await t
      .withIdentity({ subject: userId })
      .mutation(api.ingredientOverrides.remove, {
        canonicalName: "toast",
      });
    expect(result.removed).toBe(true);

    const rows = await t.withIdentity({ subject: userId }).query(api.ingredientOverrides.list, {});
    expect(rows).toHaveLength(0);
  });

  it("requires auth", async () => {
    const t = convexTest(schema);

    await expect(t.query(api.ingredientOverrides.list, {})).rejects.toThrow("Not authenticated");
    await expect(
      t.mutation(api.ingredientOverrides.upsert, {
        canonicalName: "bread",
        status: "safe",
        now: Date.now(),
      }),
    ).rejects.toThrow("Not authenticated");
  });
});
