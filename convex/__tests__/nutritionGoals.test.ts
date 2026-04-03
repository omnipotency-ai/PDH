/**
 * Nutrition Goals and Food Favourites — Profile Schema Tests
 *
 * Covers:
 * - patchProfile with nutritionGoals sets the field
 * - patchProfile with foodFavourites sets the field
 * - Reading profile returns defaults when goals not set
 * - Adding and removing favourites works correctly
 */
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

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

// ---------------------------------------------------------------------------
// nutritionGoals
// ---------------------------------------------------------------------------

describe("patchProfile — nutritionGoals", () => {
  it("sets nutritionGoals when provided", async () => {
    const t = convexTest(schema);
    const userId = "nutrition-set-user";
    await seedProfile(t, userId);

    await t.withIdentity({ subject: userId }).mutation(api.logs.patchProfile, {
      nutritionGoals: { dailyCalorieGoal: 2000, dailyWaterGoalMl: 1500 },
      now: Date.now(),
    });

    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();
      if (profile === null) throw new Error("expected profile");
      expect(profile.nutritionGoals).toEqual({
        dailyCalorieGoal: 2000,
        dailyWaterGoalMl: 1500,
      });
    });
  });

  it("overwrites existing nutritionGoals when patched again", async () => {
    const t = convexTest(schema);
    const userId = "nutrition-overwrite-user";
    await seedProfile(t, userId);

    await t.withIdentity({ subject: userId }).mutation(api.logs.patchProfile, {
      nutritionGoals: { dailyCalorieGoal: 1800, dailyWaterGoalMl: 1000 },
      now: Date.now(),
    });

    await t.withIdentity({ subject: userId }).mutation(api.logs.patchProfile, {
      nutritionGoals: { dailyCalorieGoal: 2200, dailyWaterGoalMl: 2000 },
      now: Date.now(),
    });

    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();
      if (profile === null) throw new Error("expected profile");
      expect(profile.nutritionGoals).toEqual({
        dailyCalorieGoal: 2200,
        dailyWaterGoalMl: 2000,
      });
    });
  });

  it("leaves nutritionGoals undefined when not provided in patch", async () => {
    const t = convexTest(schema);
    const userId = "nutrition-missing-user";
    await seedProfile(t, userId);

    // Patch with something unrelated — nutritionGoals should stay absent
    await t.withIdentity({ subject: userId }).mutation(api.logs.patchProfile, {
      unitSystem: "imperial_us",
      now: Date.now(),
    });

    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();
      if (profile === null) throw new Error("expected profile");
      expect(profile.nutritionGoals).toBeUndefined();
    });
  });

  it("creates profile with nutritionGoals when no profile exists", async () => {
    const t = convexTest(schema);
    const userId = "nutrition-insert-user";
    // No seed — patchProfile should upsert

    await t.withIdentity({ subject: userId }).mutation(api.logs.patchProfile, {
      nutritionGoals: { dailyCalorieGoal: 1850, dailyWaterGoalMl: 1000 },
      now: Date.now(),
    });

    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();
      if (profile === null) throw new Error("expected profile");
      expect(profile.nutritionGoals).toEqual({
        dailyCalorieGoal: 1850,
        dailyWaterGoalMl: 1000,
      });
    });
  });
});

// ---------------------------------------------------------------------------
// foodFavourites
// ---------------------------------------------------------------------------

describe("patchProfile — foodFavourites", () => {
  it("sets foodFavourites when provided", async () => {
    const t = convexTest(schema);
    const userId = "favs-set-user";
    await seedProfile(t, userId);

    await t.withIdentity({ subject: userId }).mutation(api.logs.patchProfile, {
      foodFavourites: ["chicken breast", "white rice"],
      now: Date.now(),
    });

    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();
      if (profile === null) throw new Error("expected profile");
      expect(profile.foodFavourites).toEqual(["chicken breast", "white rice"]);
    });
  });

  it("sets empty array for foodFavourites", async () => {
    const t = convexTest(schema);
    const userId = "favs-empty-user";
    await seedProfile(t, userId);

    // First set some favourites
    await t.withIdentity({ subject: userId }).mutation(api.logs.patchProfile, {
      foodFavourites: ["chicken breast"],
      now: Date.now(),
    });

    // Then clear them
    await t.withIdentity({ subject: userId }).mutation(api.logs.patchProfile, {
      foodFavourites: [],
      now: Date.now(),
    });

    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();
      if (profile === null) throw new Error("expected profile");
      expect(profile.foodFavourites).toEqual([]);
    });
  });

  it("adds a favourite by patching with updated array", async () => {
    const t = convexTest(schema);
    const userId = "favs-add-user";
    await seedProfile(t, userId);

    await t.withIdentity({ subject: userId }).mutation(api.logs.patchProfile, {
      foodFavourites: ["chicken breast"],
      now: Date.now(),
    });

    await t.withIdentity({ subject: userId }).mutation(api.logs.patchProfile, {
      foodFavourites: ["chicken breast", "white rice"],
      now: Date.now(),
    });

    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();
      if (profile === null) throw new Error("expected profile");
      expect(profile.foodFavourites).toEqual(["chicken breast", "white rice"]);
    });
  });

  it("removes a favourite by patching with filtered array", async () => {
    const t = convexTest(schema);
    const userId = "favs-remove-user";
    await seedProfile(t, userId);

    await t.withIdentity({ subject: userId }).mutation(api.logs.patchProfile, {
      foodFavourites: ["chicken breast", "white rice", "banana"],
      now: Date.now(),
    });

    // Remove "white rice" by patching with filtered list
    await t.withIdentity({ subject: userId }).mutation(api.logs.patchProfile, {
      foodFavourites: ["chicken breast", "banana"],
      now: Date.now(),
    });

    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();
      if (profile === null) throw new Error("expected profile");
      expect(profile.foodFavourites).toEqual(["chicken breast", "banana"]);
      expect(profile.foodFavourites).not.toContain("white rice");
    });
  });

  it("leaves foodFavourites undefined when not provided in patch", async () => {
    const t = convexTest(schema);
    const userId = "favs-missing-user";
    await seedProfile(t, userId);

    await t.withIdentity({ subject: userId }).mutation(api.logs.patchProfile, {
      unitSystem: "imperial_us",
      now: Date.now(),
    });

    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();
      if (profile === null) throw new Error("expected profile");
      expect(profile.foodFavourites).toBeUndefined();
    });
  });
});
