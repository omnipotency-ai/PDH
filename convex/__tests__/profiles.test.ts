/**
 * Profiles API Key Management — Coverage Tests
 *
 * Exercises the `setApiKey`, `removeApiKey`, and `hasServerApiKey` functions
 * from convex/profiles.ts:
 *
 * - setApiKey: stores encrypted key, validates format, auth enforcement
 * - removeApiKey: clears key, auth enforcement
 * - hasServerApiKey: returns correct boolean, unauthenticated returns false
 * - getServerApiKey (internal): returns decrypted key
 */
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_API_KEY = "sk-test1234567890abcdefghij";
const INVALID_API_KEY = "not-a-valid-key";
const ORIGINAL_ENCRYPTION_SECRET = process.env.API_KEY_ENCRYPTION_SECRET;

beforeEach(() => {
  process.env.API_KEY_ENCRYPTION_SECRET = "test-api-key-encryption-secret";
});

afterEach(() => {
  if (ORIGINAL_ENCRYPTION_SECRET === undefined) {
    delete process.env.API_KEY_ENCRYPTION_SECRET;
    return;
  }
  process.env.API_KEY_ENCRYPTION_SECRET = ORIGINAL_ENCRYPTION_SECRET;
});

/** Create a profile for the given user so mutations can find it. */
async function seedProfile(t: ReturnType<typeof convexTest>, userId: string) {
  await t.run(async (ctx) => {
    await ctx.db.insert("profiles", {
      userId,
      unitSystem: "metric",
      habits: [],
      updatedAt: Date.now(),
    });
  });
}

// ---------------------------------------------------------------------------
// setApiKey mutation
// ---------------------------------------------------------------------------

describe("profiles.setApiKey", () => {
  it("rejects unauthenticated access", async () => {
    const t = convexTest(schema);
    await expect(
      t.mutation(api.profiles.setApiKey, { apiKey: VALID_API_KEY }),
    ).rejects.toThrow("Not authenticated");
  });

  it("rejects invalid API key format", async () => {
    const t = convexTest(schema);
    const userId = "setkey-invalid-user";
    await seedProfile(t, userId);

    await expect(
      t.withIdentity({ subject: userId }).mutation(api.profiles.setApiKey, {
        apiKey: INVALID_API_KEY,
      }),
    ).rejects.toThrow("Invalid API key format");
  });

  it("stores encrypted key in profile", async () => {
    const t = convexTest(schema);
    const userId = "setkey-store-user";
    await seedProfile(t, userId);

    await t.withIdentity({ subject: userId }).mutation(api.profiles.setApiKey, {
      apiKey: VALID_API_KEY,
    });

    // Verify the key is stored encrypted, not in plaintext or legacy base64.
    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();
      if (profile === null) throw new Error("expected profile");

      // Key should be stored, not undefined
      expect(profile.encryptedApiKey).toBeDefined();
      // Key should NOT be stored in plaintext
      expect(profile.encryptedApiKey).not.toBe(VALID_API_KEY);
      // Key should NOT be stored in the legacy base64 format
      expect(profile.encryptedApiKey).not.toBe(btoa(VALID_API_KEY));
      expect(profile.encryptedApiKey?.startsWith("enc-v1:")).toBe(true);
    });
  });

  it("overwrites existing key", async () => {
    const t = convexTest(schema);
    const userId = "setkey-overwrite-user";
    await seedProfile(t, userId);

    const firstKey = "sk-firstKey123456789012345";
    const secondKey = "sk-secondKey12345678901234";

    await t.withIdentity({ subject: userId }).mutation(api.profiles.setApiKey, {
      apiKey: firstKey,
    });
    await t.withIdentity({ subject: userId }).mutation(api.profiles.setApiKey, {
      apiKey: secondKey,
    });

    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();
      if (profile === null) throw new Error("expected profile");
      expect(profile.encryptedApiKey).toBeDefined();
      expect(profile.encryptedApiKey).not.toBe(btoa(secondKey));
    });
  });

  it("creates profile with defaults when none exists", async () => {
    const t = convexTest(schema);
    const userId = "setkey-no-profile-user";
    // Do NOT seed profile — storeApiKey should upsert

    await t.withIdentity({ subject: userId }).mutation(api.profiles.setApiKey, {
      apiKey: VALID_API_KEY,
    });

    // Verify the profile was created with defaults and the key was stored
    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();
      if (profile === null) throw new Error("expected profile to be created");

      expect(profile.userId).toBe(userId);
      expect(profile.unitSystem).toBe("metric");
      expect(profile.habits).toEqual([]);
      expect(profile.encryptedApiKey?.startsWith("enc-v1:")).toBe(true);
      expect(profile.updatedAt).toBeGreaterThan(0);
    });
  });

  it("consolidates duplicate profiles while preserving richer profile data", async () => {
    const t = convexTest(schema);
    const userId = "setkey-dedupe-user";
    const now = Date.now();

    await t.run(async (ctx) => {
      await ctx.db.insert("profiles", {
        userId,
        unitSystem: "imperial_us",
        habits: [
          {
            id: "sleep",
            name: "Sleep",
            kind: "positive",
            unit: "hours",
            quickIncrement: 1,
            showOnTrack: true,
            color: "sky",
            createdAt: now - 1000,
            habitType: "sleep",
          },
        ],
        knownFoods: ["toast"],
        updatedAt: now - 1000,
      });
      await ctx.db.insert("profiles", {
        userId,
        unitSystem: "metric",
        habits: [],
        fluidPresets: [{ name: "Tea" }],
        knownFoods: ["banana"],
        updatedAt: now,
      });
    });

    await t.withIdentity({ subject: userId }).mutation(api.profiles.setApiKey, {
      apiKey: VALID_API_KEY,
    });

    await t.run(async (ctx) => {
      const profiles = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();

      expect(profiles).toHaveLength(1);
      expect(profiles[0].unitSystem).toBe("imperial_us");
      expect(profiles[0].habits).toHaveLength(1);
      expect(profiles[0].fluidPresets).toEqual([{ name: "Tea" }]);
      expect(profiles[0].knownFoods).toEqual(expect.arrayContaining(["toast", "banana"]));
      expect(profiles[0].encryptedApiKey?.startsWith("enc-v1:")).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// removeApiKey mutation
// ---------------------------------------------------------------------------

describe("profiles.removeApiKey", () => {
  it("rejects unauthenticated access", async () => {
    const t = convexTest(schema);
    await expect(t.mutation(api.profiles.removeApiKey, {})).rejects.toThrow(
      "Not authenticated",
    );
  });

  it("clears stored key", async () => {
    const t = convexTest(schema);
    const userId = "removekey-user";
    await seedProfile(t, userId);

    // First store a key
    await t.withIdentity({ subject: userId }).mutation(api.profiles.setApiKey, {
      apiKey: VALID_API_KEY,
    });

    // Verify it exists
    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();
      if (profile === null) throw new Error("expected profile");
      expect(profile.encryptedApiKey).toBeDefined();
    });

    // Remove it
    await t
      .withIdentity({ subject: userId })
      .mutation(api.profiles.removeApiKey, {});

    // Verify it's gone
    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();
      if (profile === null) throw new Error("expected profile");
      expect(profile.encryptedApiKey).toBeUndefined();
    });
  });

  it("consolidates duplicate profiles when removing a stored key", async () => {
    const t = convexTest(schema);
    const userId = "removekey-dedupe-user";
    const now = Date.now();

    await t.run(async (ctx) => {
      const encryptedApiKey = btoa(VALID_API_KEY);
      await ctx.db.insert("profiles", {
        userId,
        unitSystem: "metric",
        habits: [],
        encryptedApiKey,
        updatedAt: now - 1000,
      });
      await ctx.db.insert("profiles", {
        userId,
        unitSystem: "metric",
        habits: [],
        encryptedApiKey,
        knownFoods: ["toast"],
        updatedAt: now,
      });
    });

    await t
      .withIdentity({ subject: userId })
      .mutation(api.profiles.removeApiKey, {});

    await t.run(async (ctx) => {
      const profiles = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();

      expect(profiles).toHaveLength(1);
      expect(profiles[0].encryptedApiKey).toBeUndefined();
      expect(profiles[0].knownFoods).toEqual(["toast"]);
    });
  });

  it("is a no-op when no profile exists", async () => {
    const t = convexTest(schema);
    const userId = "removekey-no-profile";
    // No profile seeded — should not throw
    await t
      .withIdentity({ subject: userId })
      .mutation(api.profiles.removeApiKey, {});
  });
});

// ---------------------------------------------------------------------------
// hasServerApiKey query
// ---------------------------------------------------------------------------

describe("profiles.hasServerApiKey", () => {
  it("returns false when unauthenticated", async () => {
    const t = convexTest(schema);
    const result = await t.query(api.profiles.hasServerApiKey, {});
    expect(result).toBe(false);
  });

  it("returns false when no key is stored", async () => {
    const t = convexTest(schema);
    const userId = "haskey-no-key-user";
    await seedProfile(t, userId);

    const result = await t
      .withIdentity({ subject: userId })
      .query(api.profiles.hasServerApiKey, {});
    expect(result).toBe(false);
  });

  it("returns true when key is stored", async () => {
    const t = convexTest(schema);
    const userId = "haskey-with-key-user";
    await seedProfile(t, userId);

    await t.withIdentity({ subject: userId }).mutation(api.profiles.setApiKey, {
      apiKey: VALID_API_KEY,
    });

    const result = await t
      .withIdentity({ subject: userId })
      .query(api.profiles.hasServerApiKey, {});
    expect(result).toBe(true);
  });

  it("returns false after key is removed", async () => {
    const t = convexTest(schema);
    const userId = "haskey-removed-user";
    await seedProfile(t, userId);

    await t.withIdentity({ subject: userId }).mutation(api.profiles.setApiKey, {
      apiKey: VALID_API_KEY,
    });
    await t
      .withIdentity({ subject: userId })
      .mutation(api.profiles.removeApiKey, {});

    const result = await t
      .withIdentity({ subject: userId })
      .query(api.profiles.hasServerApiKey, {});
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getServerApiKey internal query
// ---------------------------------------------------------------------------

describe("profiles.getServerApiKey (internal)", () => {
  it("returns null when no profile exists", async () => {
    const t = convexTest(schema);
    const result = await t.query(internal.profiles.getServerApiKey, {
      userId: "ghost-user",
    });
    expect(result).toBeNull();
  });

  it("returns null when no key is stored", async () => {
    const t = convexTest(schema);
    const userId = "internal-no-key-user";
    await seedProfile(t, userId);

    const result = await t.query(internal.profiles.getServerApiKey, { userId });
    expect(result).toBeNull();
  });

  it("returns the decrypted key", async () => {
    const t = convexTest(schema);
    const userId = "internal-with-key-user";
    await seedProfile(t, userId);

    await t.withIdentity({ subject: userId }).mutation(api.profiles.setApiKey, {
      apiKey: VALID_API_KEY,
    });

    const result = await t.query(internal.profiles.getServerApiKey, { userId });
    expect(result).toBe(VALID_API_KEY);
  });

  it("still reads legacy base64-only keys", async () => {
    const t = convexTest(schema);
    const userId = "internal-legacy-key-user";
    await seedProfile(t, userId);

    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();
      if (profile === null) throw new Error("expected profile");

      await ctx.db.patch(profile._id, {
        encryptedApiKey: btoa(VALID_API_KEY),
      });
    });

    const result = await t.query(internal.profiles.getServerApiKey, { userId });
    expect(result).toBe(VALID_API_KEY);
  });
});
