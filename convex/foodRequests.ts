import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireAuth } from "./lib/auth";
import { sanitizeOptionalText, sanitizeRequiredText } from "./lib/inputSafety";

/**
 * Submit a request to add a new food to the registry.
 *
 * Called from FoodMatchingModal when a user can't find a matching canonical
 * and wants to request that a new food be added.
 */
export const submitRequest = mutation({
  args: {
    foodName: v.string(),
    rawInput: v.optional(v.string()),
    note: v.optional(v.string()),
    logId: v.optional(v.string()),
    itemIndex: v.optional(v.number()),
    now: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);

    const foodName = sanitizeRequiredText(args.foodName, "Food name", 200, {
      preserveNewlines: false,
    });
    const rawInput = sanitizeOptionalText(args.rawInput, "Raw input", 500, {
      preserveNewlines: false,
    });
    const note = sanitizeOptionalText(args.note, "Note", 500, {
      preserveNewlines: true,
    });

    await ctx.db.insert("foodRequests", {
      userId,
      foodName,
      ...(rawInput !== undefined && rawInput !== null && { rawInput }),
      ...(note !== undefined && note !== null && { note }),
      ...(args.logId !== undefined && { logId: args.logId }),
      ...(args.itemIndex !== undefined && { itemIndex: args.itemIndex }),
      status: "pending",
      createdAt: args.now ?? Date.now(),
    });
  },
});
