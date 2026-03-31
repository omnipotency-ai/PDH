import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import schema from "./schema";

describe("waitlist", () => {
  it("joins the waitlist with required fields", async () => {
    const t = convexTest(schema);

    const id = await t.mutation(api.waitlist.join, {
      name: "John Doe",
      email: "john@example.com",
      gdprConsent: true,
    });

    expect(id).toBeDefined();

    // Verify entry was created
    const entry = await t.run(async (ctx) => {
      return (await ctx.db.get(id)) as Doc<"waitlistEntries"> | null;
    });
    expect(entry?.name).toBe("John Doe");
    expect(entry?.email).toBe("john@example.com");
  });

  it("joins with optional surgery type and recovery stage", async () => {
    const t = convexTest(schema);

    const id = await t.mutation(api.waitlist.join, {
      name: "Jane Doe",
      email: "jane@example.com",
      surgeryType: "Ileostomy reversal",
      recoveryStage: "3 months post-op",
      gdprConsent: true,
    });

    const entry = await t.run(async (ctx) => {
      return (await ctx.db.get(id)) as Doc<"waitlistEntries"> | null;
    });
    expect(entry?.surgeryType).toBe("Ileostomy reversal");
    expect(entry?.recoveryStage).toBe("3 months post-op");
  });

  it("throws when GDPR consent is not given", async () => {
    const t = convexTest(schema);

    await expect(
      t.mutation(api.waitlist.join, {
        name: "No Consent",
        email: "no@example.com",
        gdprConsent: false,
      }),
    ).rejects.toThrow("GDPR consent is required");
  });

  it("upserts existing email entry", async () => {
    const t = convexTest(schema);

    // First join
    const id1 = await t.mutation(api.waitlist.join, {
      name: "Original Name",
      email: "same@example.com",
      gdprConsent: true,
    });

    // Second join with same email
    const id2 = await t.mutation(api.waitlist.join, {
      name: "Updated Name",
      email: "same@example.com",
      surgeryType: "Colostomy reversal",
      gdprConsent: true,
    });

    expect(id1).toBe(id2); // Same ID = upsert

    const entry = await t.run(async (ctx) => {
      return (await ctx.db.get(id2)) as Doc<"waitlistEntries"> | null;
    });
    expect(entry?.name).toBe("Updated Name");
    expect(entry?.surgeryType).toBe("Colostomy reversal");
  });

  it("unsubscribes from the waitlist", async () => {
    const t = convexTest(schema);

    await t.mutation(api.waitlist.join, {
      name: "To Unsubscribe",
      email: "unsub@example.com",
      gdprConsent: true,
    });

    await t.mutation(api.waitlist.unsubscribe, {
      email: "unsub@example.com",
    });

    // Verify unsubscribedAt is set
    const entry = await t.run(async (ctx) => {
      return await ctx.db
        .query("waitlistEntries")
        .withIndex("by_email", (q) => q.eq("email", "unsub@example.com"))
        .first();
    });
    expect(entry?.unsubscribedAt).toBeDefined();
  });
});
