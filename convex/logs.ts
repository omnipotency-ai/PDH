import { v } from "convex/values";
import { resolveCanonicalFoodName } from "../shared/foodCanonicalName";
import { canonicalizeKnownFoodName } from "../shared/foodCanonicalization";
import { isFoodPipelineType } from "../shared/logTypeUtils";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { requireAuth } from "./lib/auth";
import { asTrimmedString } from "./lib/coerce";
import { sanitizeUnknownStringsDeep } from "./lib/inputSafety";
import { logDataValidator } from "./validators";

// ─────────────────────────────────────────────────────────────────────────────
// Re-export profile and backup functions so existing api.logs.* call sites
// keep working without changes. The Convex router resolves functions by file
// path, so these re-exports expose them as api.logs.* AND as
// api.profileMutations.* / api.backup.* for new callers.
// ─────────────────────────────────────────────────────────────────────────────

export { getProfile, patchProfile, replaceProfile } from "./profileMutations";

export { deleteAll, exportBackup } from "./backup";

// ─────────────────────────────────────────────────────────────────────────────
// Log type validator
// ─────────────────────────────────────────────────────────────────────────────

const logTypeValidator = v.union(
  v.literal("food"),
  v.literal("liquid"),
  v.literal("fluid"),
  v.literal("habit"),
  v.literal("activity"),
  v.literal("digestion"),
  v.literal("weight"),
);

// ─────────────────────────────────────────────────────────────────────────────
// Recanonicalization helpers (food log maintenance mutations)
// ─────────────────────────────────────────────────────────────────────────────

const RECANONICALIZE_DROP = "__drop__" as const;

/** Override for a specific food item during recanonicalization.
 * If `drop` is true, the item is removed regardless of `canonicalName`.
 * `canonicalName` pins the item to a specific canonical (ignored if `drop` is true). */
const recanonicalizeOverrideValidator = v.object({
  logId: v.id("logs"),
  itemIndex: v.number(),
  canonicalName: v.optional(v.string()),
  drop: v.optional(v.boolean()),
});

function getRecanonicalizeOverrideKey(
  logId: Id<"logs">,
  itemIndex: number,
): string {
  return `${String(logId)}:${itemIndex}`;
}

function buildRecanonicalizeOverrideMap(
  overrides: ReadonlyArray<{
    logId: Id<"logs">;
    itemIndex: number;
    canonicalName?: string;
    drop?: boolean;
  }>,
): Map<string, string | typeof RECANONICALIZE_DROP> {
  const map = new Map<string, string | typeof RECANONICALIZE_DROP>();

  for (const override of overrides) {
    const key = getRecanonicalizeOverrideKey(
      override.logId,
      override.itemIndex,
    );
    if (override.drop) {
      map.set(key, RECANONICALIZE_DROP);
      continue;
    }

    const canonicalName = asTrimmedString(override.canonicalName);
    if (!canonicalName) continue;
    map.set(key, canonicalName);
  }

  return map;
}

function asRecoveryStage(value: unknown): 1 | 2 | 3 | undefined {
  return value === 1 || value === 2 || value === 3 ? value : undefined;
}

function asSpiceLevel(value: unknown): "plain" | "mild" | "spicy" | undefined {
  return value === "plain" || value === "mild" || value === "spicy"
    ? value
    : undefined;
}

function recanonicalizeStoredFoodName(args: {
  sourceName: string;
  oldCanonical?: string;
  override?: string;
}): string {
  const preferred = args.override ?? args.sourceName;
  const preferredMatch = canonicalizeKnownFoodName(preferred);
  if (preferredMatch) return preferredMatch;

  const oldCanonical = asTrimmedString(args.oldCanonical);
  if (oldCanonical) {
    const oldCanonicalMatch = canonicalizeKnownFoodName(oldCanonical);
    if (oldCanonicalMatch) return oldCanonicalMatch;
    return resolveCanonicalFoodName(oldCanonical);
  }

  return resolveCanonicalFoodName(preferred);
}

// ─────────────────────────────────────────────────────────────────────────────
// Ingredient exposure helpers (shared between add/update/batchUpdate)
// ─────────────────────────────────────────────────────────────────────────────

async function clearIngredientExposuresForLog(
  ctx: MutationCtx,
  args: { userId: string; logId: Id<"logs"> },
) {
  const existing = await ctx.db
    .query("ingredientExposures")
    .withIndex("by_userId_logId", (q) =>
      q.eq("userId", args.userId).eq("logId", args.logId),
    )
    .collect();
  for (const row of existing) {
    await ctx.db.delete(row._id);
  }
  return existing.length;
}

function getCanonicalizedFoodItems(
  data: unknown,
): Array<Record<string, unknown>> | null {
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  const items = Array.isArray(row.items)
    ? row.items.filter(
        (item): item is Record<string, unknown> =>
          item !== null && typeof item === "object" && !Array.isArray(item),
      )
    : [];

  if (items.length === 0) {
    return [];
  }

  for (const item of items) {
    const ingredientName =
      asTrimmedString(item.userSegment) ??
      asTrimmedString(item.rawName) ??
      asTrimmedString(item.parsedName) ??
      asTrimmedString(item.name);
    const canonicalName = asTrimmedString(item.canonicalName);
    if (!ingredientName || !canonicalName) {
      return null;
    }
  }

  return items;
}

async function rebuildIngredientExposuresForFoodLog(
  ctx: MutationCtx,
  args: {
    userId: string;
    logId: Id<"logs">;
    timestamp: number;
    data: unknown;
  },
) {
  await clearIngredientExposuresForLog(ctx, {
    userId: args.userId,
    logId: args.logId,
  });
  const items = getCanonicalizedFoodItems(args.data);
  if (items === null) return 0;

  let inserted = 0;
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const ingredientName =
      asTrimmedString(item.userSegment) ??
      asTrimmedString(item.rawName) ??
      asTrimmedString(item.parsedName) ??
      asTrimmedString(item.name);
    const canonicalCandidate = asTrimmedString(item.canonicalName);
    if (!ingredientName || !canonicalCandidate) continue;

    // resolveCanonicalFoodName is idempotent — double-normalization
    // is safe, so calling it on an already-normalized value is a no-op.
    const canonicalName = resolveCanonicalFoodName(canonicalCandidate);
    if (!canonicalName) continue;

    // Skip unknown/unresolved items — they don't affect transit calculations
    if (canonicalName === "unknown_food") continue;

    const quantityRaw = item.quantity;
    const quantity =
      quantityRaw === null
        ? null
        : typeof quantityRaw === "number" && Number.isFinite(quantityRaw)
          ? quantityRaw
          : null;

    const unitRaw = item.unit;
    const unit = unitRaw === null ? null : (asTrimmedString(unitRaw) ?? null);
    const preparation = asTrimmedString(item.preparation);
    const recoveryStage = asRecoveryStage(item.recoveryStage);
    const spiceLevel = asSpiceLevel(item.spiceLevel);

    await ctx.db.insert("ingredientExposures", {
      userId: args.userId,
      logId: args.logId,
      itemIndex: index,
      logTimestamp: args.timestamp,
      ingredientName,
      canonicalName,
      quantity,
      unit,
      ...(preparation !== undefined && { preparation }),
      ...(recoveryStage !== undefined && { recoveryStage }),
      ...(spiceLevel !== undefined && { spiceLevel }),
      createdAt: args.timestamp,
    });
    inserted += 1;
  }

  return inserted;
}

async function recanonicalizeFoodLogsForUser(
  ctx: MutationCtx,
  args: {
    userId: string;
    limit?: number;
    dryRun?: boolean;
    overrides?: Array<{
      logId: Id<"logs">;
      itemIndex: number;
      canonicalName?: string;
      drop?: boolean;
    }>;
  },
) {
  const userId = args.userId;
  const limit = Math.min(Math.max(args.limit ?? 5000, 1), 20000);
  const dryRun = args.dryRun ?? false;
  const overrideMap = buildRecanonicalizeOverrideMap(args.overrides ?? []);

  const logs = await ctx.db
    .query("logs")
    .withIndex("by_userId_timestamp", (q) => q.eq("userId", userId))
    .order("desc")
    .take(limit);

  let processedLogs = 0;
  let patchedLogs = 0;
  let droppedItems = 0;
  let recanonicalizedItems = 0;
  let totalItems = 0;
  let rebuiltExposures = 0;
  const droppedSamples: string[] = [];
  const recanonicalizedSamples: string[] = [];

  for (const log of logs) {
    if (!isFoodPipelineType(log.type)) continue;
    processedLogs += 1;

    const data = log.data as Record<string, unknown> | null;
    if (!data || typeof data !== "object") continue;
    const items = Array.isArray(data.items) ? data.items : [];
    if (items.length === 0) continue;

    let changed = false;
    const cleanedItems: Array<Record<string, unknown>> = [];

    for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
      const item = items[itemIndex];
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const rec = item as Record<string, unknown>;
      totalItems += 1;

      const userSegment = asTrimmedString(rec.userSegment);
      const rawName = asTrimmedString(rec.rawName);
      const parsedName = asTrimmedString(rec.parsedName);
      const name = asTrimmedString(rec.name);
      const sourceName = userSegment || rawName || parsedName || name;

      if (!sourceName) {
        droppedItems += 1;
        changed = true;
        continue;
      }

      const cleanedSource = sourceName.replace(/[.!?]+$/, "").trim();

      if (!cleanedSource) {
        droppedItems += 1;
        changed = true;
        continue;
      }

      const hasMultipleFoods = /,\s*\d/.test(cleanedSource);
      const isSentence = cleanedSource.split(/\s+/).length > 8;
      if (cleanedSource.length > 60 || hasMultipleFoods || isSentence) {
        droppedItems += 1;
        if (droppedSamples.length < 20) {
          droppedSamples.push(cleanedSource.slice(0, 80));
        }
        changed = true;
        continue;
      }

      const override = overrideMap.get(
        getRecanonicalizeOverrideKey(log._id, itemIndex),
      );
      if (override === RECANONICALIZE_DROP) {
        droppedItems += 1;
        if (droppedSamples.length < 20) {
          droppedSamples.push(cleanedSource.slice(0, 80));
        }
        changed = true;
        continue;
      }

      const oldCanonical = asTrimmedString(rec.canonicalName);
      const newCanonical = recanonicalizeStoredFoodName({
        sourceName: cleanedSource,
        ...(oldCanonical && { oldCanonical }),
        ...(override && { override }),
      });

      if (newCanonical !== oldCanonical) {
        recanonicalizedItems += 1;
        if (recanonicalizedSamples.length < 30) {
          recanonicalizedSamples.push(
            override
              ? `"${oldCanonical}" → "${newCanonical}" (override for "${sourceName}")`
              : `"${oldCanonical}" → "${newCanonical}" (from "${sourceName}")`,
          );
        }
        changed = true;
      }

      const nameUpdates: Record<string, unknown> = {};
      if (userSegment && userSegment !== cleanedSource) {
        nameUpdates.userSegment = cleanedSource;
      }
      if (rawName && rawName !== cleanedSource) {
        nameUpdates.rawName = cleanedSource;
      }
      if (parsedName && parsedName !== cleanedSource) {
        nameUpdates.parsedName = cleanedSource;
      }
      if (name && !rawName && !userSegment && name !== cleanedSource) {
        nameUpdates.name = cleanedSource;
      }

      cleanedItems.push({
        ...rec,
        ...nameUpdates,
        canonicalName: newCanonical,
      });
    }

    if (changed && !dryRun) {
      const cleanedData = {
        ...data,
        items: cleanedItems,
      } as unknown as Doc<"logs">["data"];
      await ctx.db.patch(log._id, {
        data: cleanedData,
      });
      patchedLogs += 1;

      rebuiltExposures += await rebuildIngredientExposuresForFoodLog(ctx, {
        userId,
        logId: log._id,
        timestamp: log.timestamp,
        data: cleanedData,
      });
    } else if (changed) {
      patchedLogs += 1;
    }
  }

  return {
    dryRun,
    processedLogs,
    patchedLogs,
    totalItems,
    droppedItems,
    recanonicalizedItems,
    rebuiltExposures,
    droppedSamples,
    recanonicalizedSamples,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────────────────────────────────

export const list = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const limit = Math.min(Math.max(args.limit ?? 300, 1), 5000);
    const rows = await ctx.db
      .query("logs")
      .withIndex("by_userId_timestamp", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);

    return rows.map((row) => ({
      id: row._id,
      timestamp: row.timestamp,
      type: row.type,
      data: row.data,
    }));
  },
});

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireAuth(ctx);
    // Safety cap to prevent unbounded reads. Proper pagination tracked as WQ-087.
    const rows = await ctx.db
      .query("logs")
      .withIndex("by_userId_timestamp", (q) => q.eq("userId", userId))
      .order("desc")
      .take(5000);

    return rows.map((row) => ({
      id: row._id,
      timestamp: row.timestamp,
      type: row.type,
      data: row.data,
    }));
  },
});

export const count = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireAuth(ctx);
    // Safety cap — returns approximate count for large datasets.
    // TODO: Replace with Convex aggregate for exact count (WQ-087).
    const rows = await ctx.db
      .query("logs")
      .withIndex("by_userId_timestamp", (q) => q.eq("userId", userId))
      .take(10000);
    return rows.length;
  },
});

export const listByRange = query({
  args: {
    startMs: v.number(),
    endMs: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    if (args.startMs > args.endMs) {
      throw new Error(
        `listByRange: startMs (${args.startMs}) must be <= endMs (${args.endMs})`,
      );
    }
    const safeLimit = Math.min(Math.max(args.limit ?? 5000, 1), 20000);
    const rows = await ctx.db
      .query("logs")
      .withIndex("by_userId_timestamp", (q) =>
        q
          .eq("userId", userId)
          .gte("timestamp", args.startMs)
          .lt("timestamp", args.endMs),
      )
      .order("desc")
      .take(safeLimit);

    return rows.map((row) => ({
      id: row._id,
      timestamp: row.timestamp,
      type: row.type,
      data: row.data,
    }));
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Mutations — log CRUD
// ─────────────────────────────────────────────────────────────────────────────

export const add = mutation({
  args: {
    timestamp: v.number(),
    type: logTypeValidator,
    data: logDataValidator,
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const data = sanitizeUnknownStringsDeep(args.data, { path: "log.data" });
    const logId = await ctx.db.insert("logs", {
      userId,
      timestamp: args.timestamp,
      type: args.type,
      data,
    });
    if (args.type === "food" || args.type === "liquid") {
      const foodData = data as { rawInput?: string; items?: unknown[] };
      if (
        foodData.rawInput &&
        (!foodData.items || (foodData.items as unknown[]).length === 0)
      ) {
        // New-style: raw text provided, items empty → schedule server-side processing
        await ctx.scheduler.runAfter(
          0,
          internal.foodParsing.processLogInternal,
          { logId },
        );
      } else {
        // Legacy path: items already provided (old client code)
        await rebuildIngredientExposuresForFoodLog(ctx, {
          userId,
          logId,
          timestamp: args.timestamp,
          data,
        });
      }
    }
    return logId;
  },
});

export const remove = mutation({
  args: {
    id: v.id("logs"),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const record = await ctx.db.get(args.id);
    if (!record) {
      throw new Error("Log entry not found.");
    }
    if (record.userId !== userId) {
      throw new Error("Not authorized to delete this log entry.");
    }
    if (record.type === "food" || record.type === "liquid") {
      await clearIngredientExposuresForLog(ctx, { userId, logId: record._id });
    }
    await ctx.db.delete(args.id);
  },
});

export const update = mutation({
  args: {
    id: v.id("logs"),
    timestamp: v.number(),
    data: logDataValidator,
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const data = sanitizeUnknownStringsDeep(args.data, { path: "log.data" });
    const record = await ctx.db.get(args.id);
    if (!record) {
      throw new Error("Log entry not found.");
    }
    if (record.userId !== userId) {
      throw new Error("Not authorized to update this log entry.");
    }
    await ctx.db.patch(args.id, {
      timestamp: args.timestamp,
      data,
    });
    if (record.type === "food" || record.type === "liquid") {
      const foodData = data as { rawInput?: string; items?: unknown[] };
      const hasRawInput =
        typeof foodData.rawInput === "string" && foodData.rawInput.length > 0;

      if (hasRawInput) {
        // New-style food log: clear stale exposures and re-run the
        // server-side pipeline so evidence waits the full 6-hour window.
        await clearIngredientExposuresForLog(ctx, {
          userId,
          logId: record._id,
        });
        await ctx.scheduler.runAfter(
          0,
          internal.foodParsing.processLogInternal,
          {
            logId: record._id,
          },
        );
      } else {
        // Legacy path: items already provided — rebuild immediately
        await rebuildIngredientExposuresForFoodLog(ctx, {
          userId,
          logId: record._id,
          timestamp: args.timestamp,
          data,
        });
      }
    }
  },
});

export const batchUpdateFoodItems = mutation({
  args: {
    updates: v.array(
      v.object({
        id: v.id("logs"),
        items: v.array(
          v.object({
            name: v.string(),
            rawName: v.optional(v.union(v.string(), v.null())),
            quantity: v.union(v.number(), v.null()),
            unit: v.union(v.string(), v.null()),
            canonicalName: v.optional(v.string()),
            preparation: v.optional(v.string()),
            recoveryStage: v.optional(
              v.union(v.literal(1), v.literal(2), v.literal(3)),
            ),
            spiceLevel: v.optional(
              v.union(
                v.literal("plain"),
                v.literal("mild"),
                v.literal("spicy"),
              ),
            ),
          }),
        ),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    let updated = 0;
    let skipped = 0;

    for (const entry of args.updates) {
      const record = await ctx.db.get(entry.id);
      if (!record) {
        skipped++;
        continue;
      }
      if (record.userId !== userId) {
        throw new Error("Not authorized");
      }
      if (!isFoodPipelineType(record.type)) {
        skipped++;
        continue;
      }

      const data = record.data as Record<string, unknown>;
      const notes = typeof data.notes === "string" ? data.notes : undefined;
      const mealSlot: "breakfast" | "lunch" | "dinner" | "snack" | undefined =
        data.mealSlot === "breakfast" ||
        data.mealSlot === "lunch" ||
        data.mealSlot === "dinner" ||
        data.mealSlot === "snack"
          ? data.mealSlot
          : undefined;

      const nextData = {
        ...(notes !== undefined && { notes }),
        ...(mealSlot !== undefined && { mealSlot }),
        items: entry.items,
      };

      await ctx.db.patch(entry.id, {
        data: nextData,
      });
      await rebuildIngredientExposuresForFoodLog(ctx, {
        userId,
        logId: record._id,
        timestamp: record.timestamp,
        data: nextData,
      });
      updated++;
    }

    return { updated, skipped };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Mutations — food log maintenance
// ─────────────────────────────────────────────────────────────────────────────

export const backfillIngredientExposures = mutation({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const limit = Math.min(Math.max(args.limit ?? 2000, 1), 20000);
    const logs = await ctx.db
      .query("logs")
      .withIndex("by_userId_timestamp", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);

    let processedLogs = 0;
    let indexedItems = 0;

    for (const log of logs) {
      if (log.type !== "food") continue;
      processedLogs += 1;
      indexedItems += await rebuildIngredientExposuresForFoodLog(ctx, {
        userId,
        logId: log._id,
        timestamp: log.timestamp,
        data: log.data,
      });
    }

    return {
      processedLogs,
      indexedItems,
      limit,
    };
  },
});

/**
 * Re-canonicalize all food log items against the current registry, fix the
 * stored canonicalName fields in log data, then rebuild ingredientExposures.
 *
 * This is a one-shot migration for cleaning up logs written before the
 * registry was finalized. It:
 *   1. Reads every food log
 *   2. For each item, re-derives canonicalName from rawName/name using the
 *      current registry + normalization
 *      Optional per-item overrides can pin a canonical or drop a legacy row
 *      when the stored text is known to be wrong.
 *   3. Drops items that are clearly not food (sentences, notes, garbage)
 *   4. Patches the log with cleaned data
 *   5. Rebuilds ingredientExposures from the cleaned log
 */
export const recanonicalizeAllFoodLogs = mutation({
  args: {
    limit: v.optional(v.number()),
    dryRun: v.optional(v.boolean()),
    overrides: v.optional(v.array(recanonicalizeOverrideValidator)),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    // Conditional spread required by exactOptionalPropertyTypes — Convex
    // v.optional() produces `T | undefined` which cannot be passed directly
    // to a function with optional (absent-only) properties.
    return recanonicalizeFoodLogsForUser(ctx, {
      userId,
      ...(args.limit !== undefined && { limit: args.limit }),
      ...(args.dryRun !== undefined && { dryRun: args.dryRun }),
      ...(args.overrides !== undefined && { overrides: args.overrides }),
    });
  },
});

// Planned for future admin/scheduled backfill — currently no callers
export const recanonicalizeAllFoodLogsForUser = internalMutation({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
    dryRun: v.optional(v.boolean()),
    overrides: v.optional(v.array(recanonicalizeOverrideValidator)),
  },
  handler: async (ctx, args) =>
    recanonicalizeFoodLogsForUser(ctx, {
      userId: args.userId,
      ...(args.limit !== undefined && { limit: args.limit }),
      ...(args.dryRun !== undefined && { dryRun: args.dryRun }),
      ...(args.overrides !== undefined && { overrides: args.overrides }),
    }),
});

export const backfillResolvedBy = mutation({
  args: {
    limit: v.optional(v.number()),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);

    const limit = Math.min(args.limit ?? 5000, 20000);
    const dryRun = args.dryRun ?? false;

    const logs = await ctx.db
      .query("logs")
      .withIndex("by_userId_timestamp", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);

    let logsPatched = 0;
    let itemsPatched = 0;

    for (const log of logs) {
      if (!isFoodPipelineType(log.type)) continue;
      const items = (log.data as Record<string, unknown> | undefined)?.items as
        | Array<Record<string, unknown>>
        | undefined;
      if (!Array.isArray(items) || items.length === 0) continue;

      let changed = false;
      const patchedItems = items.map((item) => {
        if (
          item.canonicalName &&
          item.canonicalName !== "unknown_food" &&
          !item.resolvedBy
        ) {
          changed = true;
          itemsPatched++;
          return { ...item, resolvedBy: "registry" };
        }
        return item;
      });

      if (changed && !dryRun) {
        await ctx.db.patch(log._id, {
          data: {
            ...(log.data as Record<string, unknown>),
            items: patchedItems,
          } as typeof log.data,
        });
        logsPatched++;
      } else if (changed) {
        logsPatched++;
      }
    }

    return { logsPatched, itemsPatched, dryRun };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Internal queries (used by actions that can't access ctx.db directly)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get the userId that owns a log entry. Returns null if the log doesn't exist.
 * Internal-only — not exposed to clients.
 */
export const getLogOwner = internalQuery({
  args: { logId: v.id("logs") },
  handler: async (ctx, args) => {
    const log = await ctx.db.get(args.logId);
    if (!log) return null;
    // Include itemsVersion for food logs so callers can do OCC checks
    const itemsVersion =
      log.type === "food" || log.type === "liquid"
        ? (((log.data as Record<string, unknown>).itemsVersion as
            | number
            | undefined) ?? 0)
        : 0;
    return { userId: log.userId, itemsVersion };
  },
});
