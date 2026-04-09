/**
 * Favourite Slot Tags — Pure toggle logic + Convex mutation tests
 *
 * Covers:
 * - toggleSlotTagPure: add new food+slot, add second slot, remove slot,
 *   foodFavourites sync (added on tag-add, NOT removed on tag-remove)
 * - toggleFavouriteSlotTag mutation: round-trip through Convex
 * - getFavouriteSlotTags query: returns correct data
 */
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { beforeEach, describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import { type MealSlot, toggleSlotTagPure } from "../profiles";
import schema from "../schema";

const modules = import.meta.glob("../**/*.ts");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Seed a bare profile for the given user. */
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

/** Create a fresh convexTest instance. Each test gets its own isolated DB. */
function makeT() {
  return convexTest(schema, modules);
}

// ---------------------------------------------------------------------------
// Pure function tests — toggleSlotTagPure
// ---------------------------------------------------------------------------

describe("toggleSlotTagPure", () => {
  it("adds a new food with a slot to empty state", () => {
    const { nextTags, nextFavourites } = toggleSlotTagPure(
      {},
      [],
      "porridge",
      "breakfast",
    );

    expect(nextTags).toEqual({ porridge: ["breakfast"] });
    expect(nextFavourites).toEqual(["porridge"]);
  });

  it("adds a second slot to an existing food", () => {
    const { nextTags, nextFavourites } = toggleSlotTagPure(
      { porridge: ["breakfast"] },
      ["porridge"],
      "porridge",
      "snack",
    );

    expect(nextTags).toEqual({ porridge: ["breakfast", "snack"] });
    // foodFavourites should not duplicate
    expect(nextFavourites).toEqual(["porridge"]);
  });

  it("removes a slot when it already exists (toggle off)", () => {
    const { nextTags, nextFavourites } = toggleSlotTagPure(
      { porridge: ["breakfast", "snack"] },
      ["porridge"],
      "porridge",
      "breakfast",
    );

    expect(nextTags).toEqual({ porridge: ["snack"] });
    // foodFavourites must NOT be removed when removing a slot tag
    expect(nextFavourites).toEqual(["porridge"]);
  });

  it("removes the food key from tags when last slot is removed", () => {
    const { nextTags, nextFavourites } = toggleSlotTagPure(
      { porridge: ["breakfast"] },
      ["porridge"],
      "porridge",
      "breakfast",
    );

    expect(nextTags).toEqual({});
    expect(Object.keys(nextTags)).not.toContain("porridge");
    // foodFavourites must still contain the food
    expect(nextFavourites).toEqual(["porridge"]);
  });

  it("adds food to favourites when adding a slot tag for a non-favourite food", () => {
    const { nextTags, nextFavourites } = toggleSlotTagPure(
      {},
      ["chicken breast"],
      "white rice",
      "lunch",
    );

    expect(nextTags).toEqual({ "white rice": ["lunch"] });
    expect(nextFavourites).toEqual(["chicken breast", "white rice"]);
  });

  it("does not duplicate food in favourites when already present", () => {
    const { nextTags, nextFavourites } = toggleSlotTagPure(
      {},
      ["white rice"],
      "white rice",
      "dinner",
    );

    expect(nextTags).toEqual({ "white rice": ["dinner"] });
    expect(nextFavourites).toEqual(["white rice"]);
  });

  it("handles multiple foods independently", () => {
    const initial: Record<string, MealSlot[]> = {
      porridge: ["breakfast"],
      "white rice": ["lunch", "dinner"],
    };

    // Add snack to white rice
    const result = toggleSlotTagPure(
      initial,
      ["porridge", "white rice"],
      "white rice",
      "snack",
    );

    expect(result.nextTags).toEqual({
      porridge: ["breakfast"],
      "white rice": ["lunch", "dinner", "snack"],
    });
    expect(result.nextFavourites).toEqual(["porridge", "white rice"]);
  });
});

// ---------------------------------------------------------------------------
// Convex mutation/query integration tests
// ---------------------------------------------------------------------------

describe("toggleFavouriteSlotTag mutation", () => {
  let t: ReturnType<typeof makeT>;

  beforeEach(() => {
    t = makeT();
  });

  it("adds a slot tag and syncs foodFavourites", async () => {
    const userId = "slot-tag-add-user";
    await seedProfile(t, userId);

    await t
      .withIdentity({ tokenIdentifier: userId })
      .mutation(api.profiles.toggleFavouriteSlotTag, {
        canonicalName: "porridge",
        slot: "breakfast",
      });

    // Verify via direct DB read
    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .unique();
      if (profile === null) throw new Error("expected profile");
      expect(profile.foodFavouriteSlotTags).toEqual({
        porridge: ["breakfast"],
      });
      expect(profile.foodFavourites).toEqual(["porridge"]);
    });
  });

  it("toggles off an existing slot tag", async () => {
    const userId = "slot-tag-remove-user";
    await seedProfile(t, userId);

    const identity = { tokenIdentifier: userId };

    // Add then remove
    await t
      .withIdentity(identity)
      .mutation(api.profiles.toggleFavouriteSlotTag, {
        canonicalName: "porridge",
        slot: "breakfast",
      });
    await t
      .withIdentity(identity)
      .mutation(api.profiles.toggleFavouriteSlotTag, {
        canonicalName: "porridge",
        slot: "breakfast",
      });

    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .unique();
      if (profile === null) throw new Error("expected profile");
      // Tags should be empty (key removed)
      expect(profile.foodFavouriteSlotTags).toEqual({});
      // But food should still be in favourites
      expect(profile.foodFavourites).toEqual(["porridge"]);
    });
  });

  it("throws when not authenticated", async () => {
    await expect(
      t.mutation(api.profiles.toggleFavouriteSlotTag, {
        canonicalName: "porridge",
        slot: "breakfast",
      }),
    ).rejects.toThrow("Not authenticated");
  });
});

describe("getFavouriteSlotTags query", () => {
  let t: ReturnType<typeof makeT>;

  beforeEach(() => {
    t = makeT();
  });

  it("returns empty object when no tags set", async () => {
    const userId = "slot-tag-query-empty";
    await seedProfile(t, userId);

    const result = await t
      .withIdentity({ tokenIdentifier: userId })
      .query(api.profiles.getFavouriteSlotTags, {});

    expect(result).toEqual({});
  });

  it("returns the full tags record after mutations", async () => {
    const userId = "slot-tag-query-full";
    await seedProfile(t, userId);

    const identity = { tokenIdentifier: userId };

    await t
      .withIdentity(identity)
      .mutation(api.profiles.toggleFavouriteSlotTag, {
        canonicalName: "porridge",
        slot: "breakfast",
      });
    await t
      .withIdentity(identity)
      .mutation(api.profiles.toggleFavouriteSlotTag, {
        canonicalName: "white rice",
        slot: "lunch",
      });
    await t
      .withIdentity(identity)
      .mutation(api.profiles.toggleFavouriteSlotTag, {
        canonicalName: "white rice",
        slot: "dinner",
      });

    const result = await t
      .withIdentity(identity)
      .query(api.profiles.getFavouriteSlotTags, {});

    expect(result).toEqual({
      porridge: ["breakfast"],
      "white rice": ["lunch", "dinner"],
    });
  });

  it("throws when not authenticated", async () => {
    await expect(
      t.query(api.profiles.getFavouriteSlotTags, {}),
    ).rejects.toThrow("Not authenticated");
  });
});
