/**
 * @file profiles.ts
 *
 * Runtime profile helpers. The app now uses an app-owned OpenAI secret from
 * Convex environment variables, so only per-user AI rate-limit state remains here.
 * Also includes favourite slot tag mutations for the Food Platform.
 */
import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { mealSlotValidator } from "./validators";

// ── Types for pure toggle logic ──────────────────────────────────────────────

/** Meal slot literal union — inferred from mealSlotValidator to keep in sync. */
export type MealSlot = typeof mealSlotValidator.type;

/** The shape of the foodFavouriteSlotTags record stored on profiles. */
type SlotTagRecord = Record<string, MealSlot[]>;

/**
 * Pure function: compute the next state of foodFavouriteSlotTags and
 * foodFavourites after toggling a slot for a given food.
 *
 * Exported for unit testing.
 */
export function toggleSlotTagPure(
  currentTags: SlotTagRecord,
  currentFavourites: string[],
  canonicalName: string,
  slot: MealSlot,
): { nextTags: SlotTagRecord; nextFavourites: string[] } {
  const existingSlots = currentTags[canonicalName] ?? [];
  const slotIndex = existingSlots.indexOf(slot);
  const isRemoving = slotIndex !== -1;

  let nextSlots: MealSlot[];
  if (isRemoving) {
    // Remove this slot
    nextSlots = [
      ...existingSlots.slice(0, slotIndex),
      ...existingSlots.slice(slotIndex + 1),
    ];
  } else {
    // Add this slot
    nextSlots = [...existingSlots, slot];
  }

  // Build next tags record
  const nextTags: SlotTagRecord = { ...currentTags };
  if (nextSlots.length === 0) {
    // Remove the key entirely when no slots remain
    delete nextTags[canonicalName];
  } else {
    nextTags[canonicalName] = nextSlots;
  }

  // Sync foodFavourites: add when adding a slot, but never remove on slot removal
  let nextFavourites = [...currentFavourites];
  if (!isRemoving && !nextFavourites.includes(canonicalName)) {
    nextFavourites = [...nextFavourites, canonicalName];
  }

  return { nextTags, nextFavourites };
}

/**
 * Internal query: read the stored AI rate limit timestamps for a user.
 * Returns null timestamps if no limits have been recorded yet.
 */
export const getAiRateLimits = internalQuery({
  args: { userId: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<{
    lastDrPooCallAt: number | null;
    lastCoachingCallAt: number | null;
  }> => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    if (profile === null) {
      return { lastDrPooCallAt: null, lastCoachingCallAt: null };
    }

    return {
      lastDrPooCallAt: profile.aiRateLimits?.lastDrPooCallAt ?? null,
      lastCoachingCallAt: profile.aiRateLimits?.lastCoachingCallAt ?? null,
    };
  },
});

/**
 * Internal mutation: update the AI rate limit timestamp for a specific feature.
 * Creates the profile's aiRateLimits field if it does not exist.
 */
export const updateAiRateLimit = internalMutation({
  args: {
    userId: v.string(),
    featureType: v.union(v.literal("drpoo"), v.literal("coaching")),
    calledAt: v.number(),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    if (profile === null) {
      // No profile yet — nothing to update. The rate limit will not persist
      // for this call, but this is a safe degradation (profile is created on
      // first meaningful user action).
      return;
    }

    const existing = profile.aiRateLimits ?? {};

    if (args.featureType === "drpoo") {
      await ctx.db.patch(profile._id, {
        aiRateLimits: { ...existing, lastDrPooCallAt: args.calledAt },
      });
    } else {
      await ctx.db.patch(profile._id, {
        aiRateLimits: { ...existing, lastCoachingCallAt: args.calledAt },
      });
    }
  },
});

// ── Favourite slot tag mutations ─────────────────────────────────────────────

/**
 * Toggle a meal-slot tag on a favourite food. If the slot is already tagged
 * for that food, it is removed. Otherwise it is added. Adding a slot also
 * ensures the food is present in foodFavourites (but removing a slot does NOT
 * remove from foodFavourites — that is a separate user action).
 */
export const toggleFavouriteSlotTag = mutation({
  args: {
    canonicalName: v.string(),
    slot: mealSlotValidator,
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Not authenticated");
    }
    const userId = identity.tokenIdentifier;

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (profile === null) {
      throw new Error("Profile not found");
    }

    const currentTags: SlotTagRecord =
      (profile.foodFavouriteSlotTags as SlotTagRecord | undefined) ?? {};
    const currentFavourites: string[] = profile.foodFavourites ?? [];

    const { nextTags, nextFavourites } = toggleSlotTagPure(
      currentTags,
      currentFavourites,
      args.canonicalName,
      args.slot as MealSlot,
    );

    await ctx.db.patch(profile._id, {
      foodFavouriteSlotTags: nextTags,
      foodFavourites: nextFavourites,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Query: return the full foodFavouriteSlotTags record for the authenticated user.
 * Returns an empty object if no tags have been set.
 */
export const getFavouriteSlotTags = query({
  args: {},
  handler: async (ctx): Promise<SlotTagRecord> => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Not authenticated");
    }
    const userId = identity.tokenIdentifier;

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (profile === null) {
      return {};
    }

    return (profile.foodFavouriteSlotTags as SlotTagRecord | undefined) ?? {};
  },
});
