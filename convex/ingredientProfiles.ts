import { v } from "convex/values";
import { resolveCanonicalFoodName } from "../shared/foodCanonicalName";
import { getCanonicalFoodProjection } from "../shared/foodProjection";
import { mutation, query } from "./_generated/server";
import { requireAuth } from "./lib/auth";

export function normalizeIngredientProfileTag(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, " ");
}

export function normalizeIngredientProfileTags(values: string[]): string[] {
  const unique = new Set<string>();
  for (const value of values) {
    const tag = normalizeIngredientProfileTag(value);
    if (!tag) continue;
    unique.add(tag);
  }
  return Array.from(unique.values()).sort((a, b) => a.localeCompare(b));
}

export function normalizeIngredientProfileLabel(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

const nutritionPatchValidator = v.object({
  kcal: v.optional(v.union(v.number(), v.null())),
  fatG: v.optional(v.union(v.number(), v.null())),
  saturatedFatG: v.optional(v.union(v.number(), v.null())),
  carbsG: v.optional(v.union(v.number(), v.null())),
  sugarsG: v.optional(v.union(v.number(), v.null())),
  fiberG: v.optional(v.union(v.number(), v.null())),
  proteinG: v.optional(v.union(v.number(), v.null())),
  saltG: v.optional(v.union(v.number(), v.null())),
});

function toTitleCase(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function blankNutrition() {
  return {
    kcal: null,
    fatG: null,
    saturatedFatG: null,
    carbsG: null,
    sugarsG: null,
    fiberG: null,
    proteinG: null,
    saltG: null,
  };
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireAuth(ctx);
    const rows = await ctx.db
      .query("ingredientProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    return rows.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const byIngredient = query({
  args: {
    canonicalName: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);

    return await ctx.db
      .query("ingredientProfiles")
      .withIndex("by_userId_canonicalName", (q) =>
        q
          .eq("userId", userId)
          .eq("canonicalName", resolveCanonicalFoodName(args.canonicalName)),
      )
      .first();
  },
});

export const upsert = mutation({
  args: {
    canonicalName: v.string(),
    displayName: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    lowResidue: v.optional(v.union(v.boolean(), v.null())),
    source: v.optional(
      v.union(v.literal("manual"), v.literal("openfoodfacts"), v.null()),
    ),
    externalId: v.optional(v.union(v.string(), v.null())),
    ingredientsText: v.optional(v.union(v.string(), v.null())),
    nutritionPer100g: v.optional(nutritionPatchValidator),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);

    const canonicalName = resolveCanonicalFoodName(args.canonicalName);
    if (!canonicalName) {
      throw new Error("canonicalName is required.");
    }
    const projection = getCanonicalFoodProjection(canonicalName);

    const now = Date.now();

    const existing = await ctx.db
      .query("ingredientProfiles")
      .withIndex("by_userId_canonicalName", (q) =>
        q.eq("userId", userId).eq("canonicalName", canonicalName),
      )
      .first();

    const nextNutrition = {
      ...(existing?.nutritionPer100g ?? blankNutrition()),
    };

    if (args.nutritionPer100g !== undefined) {
      const patch = args.nutritionPer100g;
      if (patch.kcal !== undefined) nextNutrition.kcal = patch.kcal;
      if (patch.fatG !== undefined) nextNutrition.fatG = patch.fatG;
      if (patch.saturatedFatG !== undefined) {
        nextNutrition.saturatedFatG = patch.saturatedFatG;
      }
      if (patch.carbsG !== undefined) nextNutrition.carbsG = patch.carbsG;
      if (patch.sugarsG !== undefined) nextNutrition.sugarsG = patch.sugarsG;
      if (patch.fiberG !== undefined) nextNutrition.fiberG = patch.fiberG;
      if (patch.proteinG !== undefined) nextNutrition.proteinG = patch.proteinG;
      if (patch.saltG !== undefined) nextNutrition.saltG = patch.saltG;
    }

    const baseDisplay = normalizeIngredientProfileLabel(args.displayName ?? "");
    const displayName =
      baseDisplay || existing?.displayName || toTitleCase(canonicalName);

    const patchData = {
      displayName,
      ...(args.tags !== undefined && {
        tags: normalizeIngredientProfileTags(args.tags),
      }),
      foodGroup: projection.foodGroup,
      foodLine: projection.foodLine,
      ...(args.lowResidue !== undefined && { lowResidue: args.lowResidue }),
      ...(args.source !== undefined && { source: args.source }),
      ...(args.externalId !== undefined && {
        externalId:
          args.externalId === null
            ? null
            : normalizeIngredientProfileLabel(args.externalId),
      }),
      ...(args.ingredientsText !== undefined && {
        ingredientsText:
          args.ingredientsText === null
            ? null
            : normalizeIngredientProfileLabel(args.ingredientsText),
      }),
      ...(args.nutritionPer100g !== undefined && {
        nutritionPer100g: nextNutrition,
      }),
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, patchData);
      return existing._id;
    }

    return await ctx.db.insert("ingredientProfiles", {
      userId,
      canonicalName,
      displayName,
      tags:
        args.tags !== undefined
          ? normalizeIngredientProfileTags(args.tags)
          : [],
      foodGroup: projection.foodGroup,
      foodLine: projection.foodLine,
      lowResidue: args.lowResidue ?? null,
      source: args.source ?? null,
      externalId:
        args.externalId !== undefined
          ? args.externalId === null
            ? null
            : normalizeIngredientProfileLabel(args.externalId)
          : null,
      ingredientsText:
        args.ingredientsText !== undefined
          ? args.ingredientsText === null
            ? null
            : normalizeIngredientProfileLabel(args.ingredientsText)
          : null,
      nutritionPer100g:
        args.nutritionPer100g !== undefined
          ? {
              ...blankNutrition(),
              ...args.nutritionPer100g,
            }
          : blankNutrition(),
      createdAt: now,
      updatedAt: now,
    });
  },
});
