import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth } from "./lib/auth";
import {
  foodCategoryValidator,
  foodGroupValidator,
  foodLineValidator,
  foodRiskLevelValidator,
  foodSubcategoryValidator,
  gasProducingValidator,
  totalResidueValidator,
} from "./validators";

// ── Queries ─────────────────────────────────────────────────────────────────

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAuth(ctx);
    // clinicalRegistry is a shared reference table (not user-scoped),
    // so collecting all rows is acceptable.
    const rows = await ctx.db.query("clinicalRegistry").collect();
    return rows.sort((a, b) => {
      if (a.zone !== b.zone) return a.zone - b.zone;
      return a.lineOrder - b.lineOrder;
    });
  },
});

export const byCanonicalName = query({
  args: { canonicalName: v.string() },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    return await ctx.db
      .query("clinicalRegistry")
      .withIndex("by_canonicalName", (q) =>
        q.eq("canonicalName", args.canonicalName),
      )
      .first();
  },
});

// ── Mutations ───────────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    canonicalName: v.string(),
    zone: v.union(v.literal(1), v.literal(2), v.literal(3)),
    category: foodCategoryValidator,
    subcategory: foodSubcategoryValidator,
    group: foodGroupValidator,
    line: foodLineValidator,
    lineOrder: v.number(),
    subzone: v.optional(v.union(v.literal("1A"), v.literal("1B"))),
    macros: v.optional(
      v.array(
        v.union(
          v.literal("protein"),
          v.literal("carbohydrate"),
          v.literal("fat"),
        ),
      ),
    ),
    notes: v.optional(v.string()),
    defaultPortionG: v.optional(v.number()),
    naturalUnit: v.optional(v.string()),
    unitWeightG: v.optional(v.number()),
    osmoticEffect: v.optional(foodRiskLevelValidator),
    totalResidue: v.optional(totalResidueValidator),
    fiberTotalApproxG: v.optional(v.number()),
    fiberInsolubleLevel: v.optional(foodRiskLevelValidator),
    fiberSolubleLevel: v.optional(foodRiskLevelValidator),
    gasProducing: v.optional(gasProducingValidator),
    irritantLoad: v.optional(foodRiskLevelValidator),
    highFatRisk: v.optional(foodRiskLevelValidator),
    lactoseRisk: v.optional(foodRiskLevelValidator),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    // Check canonicalName uniqueness
    const existing = await ctx.db
      .query("clinicalRegistry")
      .withIndex("by_canonicalName", (q) =>
        q.eq("canonicalName", args.canonicalName),
      )
      .first();
    if (existing) {
      throw new Error(
        `Clinical registry entry already exists for "${args.canonicalName}"`,
      );
    }

    const now = Date.now();
    return await ctx.db.insert("clinicalRegistry", {
      canonicalName: args.canonicalName,
      zone: args.zone,
      category: args.category,
      subcategory: args.subcategory,
      group: args.group,
      line: args.line,
      lineOrder: args.lineOrder,
      macros: args.macros ?? [],
      ...(args.subzone !== undefined && { subzone: args.subzone }),
      ...(args.notes !== undefined && { notes: args.notes }),
      ...(args.defaultPortionG !== undefined && {
        defaultPortionG: args.defaultPortionG,
      }),
      ...(args.naturalUnit !== undefined && { naturalUnit: args.naturalUnit }),
      ...(args.unitWeightG !== undefined && { unitWeightG: args.unitWeightG }),
      ...(args.osmoticEffect !== undefined && {
        osmoticEffect: args.osmoticEffect,
      }),
      ...(args.totalResidue !== undefined && {
        totalResidue: args.totalResidue,
      }),
      ...(args.fiberTotalApproxG !== undefined && {
        fiberTotalApproxG: args.fiberTotalApproxG,
      }),
      ...(args.fiberInsolubleLevel !== undefined && {
        fiberInsolubleLevel: args.fiberInsolubleLevel,
      }),
      ...(args.fiberSolubleLevel !== undefined && {
        fiberSolubleLevel: args.fiberSolubleLevel,
      }),
      ...(args.gasProducing !== undefined && {
        gasProducing: args.gasProducing,
      }),
      ...(args.irritantLoad !== undefined && {
        irritantLoad: args.irritantLoad,
      }),
      ...(args.highFatRisk !== undefined && { highFatRisk: args.highFatRisk }),
      ...(args.lactoseRisk !== undefined && { lactoseRisk: args.lactoseRisk }),
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("clinicalRegistry"),
    zone: v.optional(v.union(v.literal(1), v.literal(2), v.literal(3))),
    category: v.optional(foodCategoryValidator),
    subcategory: v.optional(foodSubcategoryValidator),
    osmoticEffect: v.optional(v.union(foodRiskLevelValidator, v.null())),
    totalResidue: v.optional(v.union(totalResidueValidator, v.null())),
    gasProducing: v.optional(v.union(gasProducingValidator, v.null())),
    fiberTotalApproxG: v.optional(v.union(v.number(), v.null())),
    highFatRisk: v.optional(v.union(foodRiskLevelValidator, v.null())),
    irritantLoad: v.optional(v.union(foodRiskLevelValidator, v.null())),
    lactoseRisk: v.optional(v.union(foodRiskLevelValidator, v.null())),
    notes: v.optional(v.union(v.string(), v.null())),
    defaultPortionG: v.optional(v.union(v.number(), v.null())),
    naturalUnit: v.optional(v.union(v.string(), v.null())),
    unitWeightG: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const row = await ctx.db.get(args.id);
    if (!row) throw new Error("Not found");

    await ctx.db.patch(args.id, {
      ...(args.zone !== undefined && { zone: args.zone }),
      ...(args.category !== undefined && { category: args.category }),
      ...(args.subcategory !== undefined && { subcategory: args.subcategory }),
      ...(args.osmoticEffect !== undefined && {
        osmoticEffect:
          args.osmoticEffect === null ? undefined : args.osmoticEffect,
      }),
      ...(args.totalResidue !== undefined && {
        totalResidue:
          args.totalResidue === null ? undefined : args.totalResidue,
      }),
      ...(args.gasProducing !== undefined && {
        gasProducing:
          args.gasProducing === null ? undefined : args.gasProducing,
      }),
      ...(args.fiberTotalApproxG !== undefined && {
        fiberTotalApproxG:
          args.fiberTotalApproxG === null ? undefined : args.fiberTotalApproxG,
      }),
      ...(args.highFatRisk !== undefined && {
        highFatRisk: args.highFatRisk === null ? undefined : args.highFatRisk,
      }),
      ...(args.irritantLoad !== undefined && {
        irritantLoad:
          args.irritantLoad === null ? undefined : args.irritantLoad,
      }),
      ...(args.lactoseRisk !== undefined && {
        lactoseRisk: args.lactoseRisk === null ? undefined : args.lactoseRisk,
      }),
      ...(args.notes !== undefined && {
        notes: args.notes === null ? undefined : args.notes,
      }),
      ...(args.defaultPortionG !== undefined && {
        defaultPortionG:
          args.defaultPortionG === null ? undefined : args.defaultPortionG,
      }),
      ...(args.naturalUnit !== undefined && {
        naturalUnit: args.naturalUnit === null ? undefined : args.naturalUnit,
      }),
      ...(args.unitWeightG !== undefined && {
        unitWeightG: args.unitWeightG === null ? undefined : args.unitWeightG,
      }),
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("clinicalRegistry") },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const row = await ctx.db.get(args.id);
    if (!row) throw new Error("Not found");
    await ctx.db.delete(args.id);
  },
});
