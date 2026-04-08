/**
 * Seed script: populate the clinicalRegistry table from the static FOOD_REGISTRY
 * and FOOD_PORTION_DATA.
 *
 * This is an internalMutation — not callable from clients. Run it via the
 * Convex dashboard or `npx convex run seedClinicalData:seedClinicalRegistry`.
 *
 * Idempotent: existing rows (matched by canonicalName) are patched, new rows
 * are inserted.
 */
import { v } from "convex/values";
import type { FoodRegistryEntry } from "../shared/foodRegistryData";
import type { PortionData } from "../shared/foodPortionData";
import { internalMutation } from "./_generated/server";

// ── Pure mapping helper (exported for testing) ────────────────────────────────

/**
 * Maps a FoodRegistryEntry + optional PortionData into the shape expected by
 * the clinicalRegistry table. Pure function — no Convex dependencies.
 */
export function mapRegistryEntryToRow(
  entry: FoodRegistryEntry,
  portion: PortionData | undefined,
  now: number,
): Record<string, unknown> {
  return {
    canonicalName: entry.canonical,
    zone: entry.zone,
    ...(entry.subzone !== undefined && { subzone: entry.subzone }),
    category: entry.category,
    subcategory: entry.subcategory,
    group: entry.group,
    line: entry.line,
    lineOrder: entry.lineOrder,
    macros: [...entry.macros],
    ...(entry.notes !== undefined && { notes: entry.notes }),

    // Portion data (optional)
    ...(portion?.defaultPortionG !== undefined && {
      defaultPortionG: portion.defaultPortionG,
    }),
    ...(portion?.naturalUnit !== undefined && {
      naturalUnit: portion.naturalUnit,
    }),
    ...(portion?.unitWeightG !== undefined && {
      unitWeightG: portion.unitWeightG,
    }),

    // FoodDigestionMetadata fields (all optional)
    ...(entry.osmoticEffect !== undefined && {
      osmoticEffect: entry.osmoticEffect,
    }),
    ...(entry.totalResidue !== undefined && {
      totalResidue: entry.totalResidue,
    }),
    ...(entry.fiberTotalApproxG !== undefined && {
      fiberTotalApproxG: entry.fiberTotalApproxG,
    }),
    ...(entry.fiberInsolubleLevel !== undefined && {
      fiberInsolubleLevel: entry.fiberInsolubleLevel,
    }),
    ...(entry.fiberSolubleLevel !== undefined && {
      fiberSolubleLevel: entry.fiberSolubleLevel,
    }),
    ...(entry.gasProducing !== undefined && {
      gasProducing: entry.gasProducing,
    }),
    ...(entry.dryTexture !== undefined && { dryTexture: entry.dryTexture }),
    ...(entry.irritantLoad !== undefined && {
      irritantLoad: entry.irritantLoad,
    }),
    ...(entry.highFatRisk !== undefined && { highFatRisk: entry.highFatRisk }),
    ...(entry.lactoseRisk !== undefined && { lactoseRisk: entry.lactoseRisk }),

    createdAt: now,
    updatedAt: now,
  };
}

// ── Internal mutation ─────────────────────────────────────────────────────────

export const seedClinicalRegistry = internalMutation({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Dynamic imports: keeps the static data out of the Convex module graph
    // unless this mutation is actually invoked.
    const { FOOD_REGISTRY } = await import("../shared/foodRegistryData");
    const { FOOD_PORTION_DATA } = await import("../shared/foodPortionData");

    const now = Date.now();
    let inserted = 0;
    let updated = 0;

    for (const entry of FOOD_REGISTRY) {
      const portion = FOOD_PORTION_DATA.get(entry.canonical);
      const row = mapRegistryEntryToRow(entry, portion, now);

      // Check for existing row using the index
      const existing = await ctx.db
        .query("clinicalRegistry")
        .withIndex("by_canonicalName", (q) =>
          q.eq("canonicalName", entry.canonical),
        )
        .take(1);

      if (args.dryRun) {
        // In dry-run mode, just count what would happen
        if (existing.length > 0) {
          updated++;
        } else {
          inserted++;
        }
        continue;
      }

      if (existing.length > 0) {
        // Patch existing row (omit createdAt to preserve original)
        const { createdAt: _createdAt, ...patchFields } = row;
        await ctx.db.patch(existing[0]._id, patchFields);
        updated++;
      } else {
        await ctx.db.insert("clinicalRegistry", row as never);
        inserted++;
      }
    }

    return { inserted, updated, total: inserted + updated };
  },
});
