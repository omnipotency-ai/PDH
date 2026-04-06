import { v } from "convex/values";
import { resolveCanonicalFoodName } from "../shared/foodCanonicalName";
import { mutation, query } from "./_generated/server";
import { requireAuth } from "./lib/auth";
import { sanitizePlainText } from "./lib/inputSafety";

const overrideStatusValidator = v.union(
  v.literal("safe"),
  v.literal("watch"),
  v.literal("avoid"),
);

/** Max length for the user-provided note field. */
const NOTE_MAX_LENGTH = 500;

/** Max length for canonicalName input. */
const CANONICAL_NAME_MAX_LENGTH = 200;

export const list = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireAuth(ctx);
    const rows = await ctx.db
      .query("ingredientOverrides")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    // Deduplication: Two concurrent upsert mutations can race past each
    // other's existence check and both insert, creating duplicate rows for
    // the same (userId, canonicalName). Convex indexes are not unique
    // constraints, so we deduplicate on read: keep only the most recently
    // updated row per canonicalName.
    const bestByName = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      const existing = bestByName.get(row.canonicalName);
      if (
        !existing ||
        row.updatedAt > existing.updatedAt ||
        (row.updatedAt === existing.updatedAt &&
          row._creationTime > existing._creationTime)
      ) {
        bestByName.set(row.canonicalName, row);
      }
    }
    return Array.from(bestByName.values());
  },
});

export const upsert = mutation({
  args: {
    canonicalName: v.string(),
    status: overrideStatusValidator,
    note: v.optional(v.string()),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);

    const sanitizedInput = sanitizePlainText(args.canonicalName).slice(0, CANONICAL_NAME_MAX_LENGTH);
    const canonicalName = resolveCanonicalFoodName(sanitizedInput);
    if (!canonicalName) {
      throw new Error("canonicalName is required.");
    }

    const sanitizedNote =
      args.note !== undefined
        ? sanitizePlainText(args.note).slice(0, NOTE_MAX_LENGTH)
        : undefined;

    // Race condition note: Two concurrent upsert calls for the same
    // (userId, canonicalName) can both see "no rows" and both insert.
    // Convex indexes are not unique constraints, so duplicates can occur.
    // We collect ALL matching rows, update the most recent one, and delete
    // any extras to self-heal duplicates.
    const allMatching = await ctx.db
      .query("ingredientOverrides")
      .withIndex("by_userId_canonicalName", (q) =>
        q.eq("userId", userId).eq("canonicalName", canonicalName),
      )
      .collect();

    if (allMatching.length > 0) {
      // Sort: most recently updated first, break ties by creation time.
      const sorted = allMatching
        .slice()
        .sort(
          (a, b) =>
            b.updatedAt - a.updatedAt || b._creationTime - a._creationTime,
        );
      const keeper = sorted[0];

      // Update the keeper with the new values.
      await ctx.db.patch(keeper._id, {
        status: args.status,
        ...(sanitizedNote !== undefined ? { note: sanitizedNote } : {}),
        updatedAt: args.now,
      });

      // Delete any duplicates that accumulated from prior races.
      for (const duplicate of sorted.slice(1)) {
        await ctx.db.delete(duplicate._id);
      }

      return keeper._id;
    }

    return await ctx.db.insert("ingredientOverrides", {
      userId,
      canonicalName,
      status: args.status,
      ...(sanitizedNote !== undefined ? { note: sanitizedNote } : {}),
      createdAt: args.now,
      updatedAt: args.now,
    });
  },
});

export const remove = mutation({
  args: {
    canonicalName: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);

    const sanitizedInput = sanitizePlainText(args.canonicalName).slice(0, CANONICAL_NAME_MAX_LENGTH);
    const canonicalName = resolveCanonicalFoodName(sanitizedInput);
    if (!canonicalName) {
      throw new Error("canonicalName is required.");
    }

    // Collect ALL matching rows to handle duplicates from prior races.
    const allMatching = await ctx.db
      .query("ingredientOverrides")
      .withIndex("by_userId_canonicalName", (q) =>
        q.eq("userId", userId).eq("canonicalName", canonicalName),
      )
      .collect();

    if (allMatching.length === 0) return { removed: false };

    for (const row of allMatching) {
      await ctx.db.delete(row._id);
    }
    return { removed: true };
  },
});
