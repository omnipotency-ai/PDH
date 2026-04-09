import { v } from "convex/values";
import { resolveCanonicalFoodName } from "../shared/foodCanonicalName";
import { getCanonicalFoodProjection } from "../shared/foodProjection";
import { mutation, query } from "./_generated/server";
import { requireAuth } from "./lib/auth";
import { customPortionValidator } from "./validators";

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
    customPortions: v.optional(v.array(customPortionValidator)),
    productName: v.optional(v.union(v.string(), v.null())),
    barcode: v.optional(v.union(v.string(), v.null())),
    registryId: v.optional(v.union(v.id("clinicalRegistry"), v.null())),
    toleranceStatus: v.optional(
      v.union(
        v.literal("building"),
        v.literal("like"),
        v.literal("dislike"),
        v.literal("watch"),
        v.literal("avoid"),
        v.null(),
      ),
    ),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);

    const canonicalName = resolveCanonicalFoodName(args.canonicalName);
    if (!canonicalName) {
      throw new Error("canonicalName is required.");
    }
    const projection = getCanonicalFoodProjection(canonicalName);

    // Validate customPortions early — applies to both create and update paths.
    if (args.customPortions !== undefined) {
      for (const p of args.customPortions) {
        if (p.weightG <= 0) throw new Error("Portion weight must be positive.");
      }
    }

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
      ...(args.customPortions !== undefined && {
        customPortions: args.customPortions,
      }),
      ...(args.productName !== undefined && {
        productName: args.productName === null ? undefined : args.productName,
      }),
      ...(args.barcode !== undefined && {
        barcode: args.barcode === null ? undefined : args.barcode,
      }),
      ...(args.registryId !== undefined && {
        registryId: args.registryId === null ? undefined : args.registryId,
      }),
      ...(args.toleranceStatus !== undefined && {
        toleranceStatus:
          args.toleranceStatus === null ? undefined : args.toleranceStatus,
      }),
      updatedAt: args.now,
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
      ...(args.customPortions !== undefined && {
        customPortions: args.customPortions,
      }),
      ...(args.productName !== undefined &&
        args.productName !== null && {
          productName: args.productName,
        }),
      ...(args.barcode !== undefined &&
        args.barcode !== null && {
          barcode: args.barcode,
        }),
      ...(args.registryId !== undefined &&
        args.registryId !== null && {
          registryId: args.registryId,
        }),
      ...(args.toleranceStatus !== undefined &&
        args.toleranceStatus !== null && {
          toleranceStatus: args.toleranceStatus,
        }),
      createdAt: args.now,
      updatedAt: args.now,
    });
  },
});

export const remove = mutation({
  args: { id: v.id("ingredientProfiles") },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const row = await ctx.db.get(args.id);
    if (!row || row.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(args.id);
  },
});

export const setToleranceStatus = mutation({
  args: {
    id: v.id("ingredientProfiles"),
    status: v.union(
      v.literal("building"),
      v.literal("like"),
      v.literal("dislike"),
      v.literal("watch"),
      v.literal("avoid"),
      v.null(),
    ),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const row = await ctx.db.get(args.id);
    if (!row || row.userId !== userId) throw new Error("Not found");
    await ctx.db.patch(args.id, {
      ...(args.status !== null
        ? { toleranceStatus: args.status }
        : { toleranceStatus: undefined }),
      updatedAt: Date.now(),
    });
  },
});

export const updatePortions = mutation({
  args: {
    id: v.id("ingredientProfiles"),
    customPortions: v.array(customPortionValidator),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const row = await ctx.db.get(args.id);
    if (!row || row.userId !== userId) throw new Error("Not found");
    // Validate: all weights must be positive
    for (const p of args.customPortions) {
      if (p.weightG <= 0) throw new Error("Portion weight must be positive");
    }
    await ctx.db.patch(args.id, {
      customPortions: args.customPortions,
      updatedAt: Date.now(),
    });
  },
});
