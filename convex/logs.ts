import { v } from "convex/values";
import { resolveCanonicalFoodName } from "../shared/foodCanonicalName";
import { canonicalizeKnownFoodName } from "../shared/foodCanonicalization";
import { isFoodPipelineType } from "../shared/logTypeUtils";
import { getCanonicalFoodProjection } from "../shared/foodProjection";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { DatabaseReader, MutationCtx } from "./_generated/server";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { requireAuth } from "./lib/auth";
import {
  asNumber,
  asRecord,
  asStringArray,
  asTrimmedString,
  inferHabitTypeFromName,
  slugifyName,
} from "./lib/coerce";
import { sanitizeUnknownStringsDeep } from "./lib/inputSafety";
import {
  type aiInsightValidator,
  aiPreferencesValidator,
  type aiRequestValidator,
  type aiResponseValidator,
  fluidPresetsValidator,
  foodPersonalisationValidator,
  habitsValidator,
  healthProfileValidator,
  logDataValidator,
  nutritionGoalsValidator,
  sleepGoalValidator,
  transitCalibrationValidator,
} from "./validators";

const logTypeValidator = v.union(
  v.literal("food"),
  v.literal("liquid"),
  v.literal("fluid"),
  v.literal("habit"),
  v.literal("activity"),
  v.literal("digestion"),
  v.literal("weight"),
);

const KNOWN_HABIT_TYPES = new Set<string>([
  "sleep",
  "count",
  "activity",
  "fluid",
  "destructive",
  "checkbox",
  "weight",
] as const);

const LEGACY_HABIT_TYPE_MAP: Record<string, string> = {
  cigarettes: "destructive",
  rec_drugs: "destructive",
  confectionery: "destructive",
  alcohol: "destructive",
  movement: "activity",
  hydration: "fluid",
  medication: "checkbox",
  custom: "count",
  hygiene: "count",
  wellness: "count",
  recovery: "count",
  sweets: "destructive",
};

const KNOWN_HABIT_UNITS = new Set<string>([
  "count",
  "ml",
  "minutes",
  "hours",
] as const);

function asFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function normalizeStoredFluidPresets(
  value: unknown,
): Array<{ name: string }> | undefined {
  if (!Array.isArray(value)) return undefined;

  const seen = new Set<string>();
  const normalized: Array<{ name: string }> = [];

  for (const item of value) {
    const candidate =
      typeof item === "string"
        ? { name: item }
        : item && typeof item === "object"
          ? {
              name: asTrimmedString((item as { name?: unknown }).name) ?? "",
            }
          : null;
    if (!candidate) continue;

    const name = candidate.name.trim();
    if (!name) continue;

    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    normalized.push({
      name,
    });
  }

  return normalized.length > 0 ? normalized.slice(0, 3) : undefined;
}

/** Known legacy model names that should be normalized to current values. */
const LEGACY_AI_MODEL_MAP: Record<string, string> = {
  "gpt-5-mini": "gpt-5.4-mini",
  "gpt-4o-mini": "gpt-5.4-mini",
  "gpt-4o": "gpt-5.4",
  "gpt-4.1-nano": "gpt-5.4-mini",
  "gpt-4.1-mini": "gpt-5.4-mini",
  "gpt-5.2": "gpt-5.4",
};

function normalizeStoredAiModel(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) return "gpt-5.4";
  // If the value is a known legacy name, map it to the current name.
  const mapped = LEGACY_AI_MODEL_MAP[value];
  if (mapped !== undefined) return mapped;
  // Otherwise, pass through the user's selection unchanged.
  return value;
}

function normalizeStoredAiPreferences(
  value: unknown,
): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const preferences = value as Record<string, unknown>;
  return {
    ...preferences,
    aiModel: normalizeStoredAiModel(preferences.aiModel),
  };
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

function normalizeHabitType(rawType: string | undefined, name: string): string {
  if (rawType) {
    const normalized = rawType.trim().toLowerCase();
    if (KNOWN_HABIT_TYPES.has(normalized)) return normalized;
    if (normalized in LEGACY_HABIT_TYPE_MAP) {
      return LEGACY_HABIT_TYPE_MAP[normalized];
    }
  }
  return inferHabitTypeFromName(name);
}

function inferHabitKind(habitType: string): "positive" | "destructive" {
  return habitType === "destructive" ? "destructive" : "positive";
}

function normalizeKind(args: {
  rawKind: string | undefined;
  goalMode: string | undefined;
  habitType: string;
}): "positive" | "destructive" {
  const { rawKind, goalMode, habitType } = args;

  if (habitType === "destructive") return "destructive";
  if (habitType === "checkbox") return "positive";

  if (rawKind === "positive" || rawKind === "destructive") {
    return rawKind;
  }
  if (goalMode === "limit") return "destructive";
  if (goalMode === "target") return "positive";
  return inferHabitKind(habitType);
}

function normalizeLogAs(
  habitType: string,
  rawLogAs: "habit" | "fluid" | undefined,
): "habit" | "fluid" | undefined {
  if (rawLogAs) return rawLogAs;
  if (habitType === "fluid") return "fluid";
  return undefined;
}

function normalizeUnit(args: {
  rawUnit: string | undefined;
  habitType: string;
  logAs: "habit" | "fluid" | undefined;
}): "count" | "ml" | "minutes" | "hours" {
  const { rawUnit, habitType, logAs } = args;
  if (rawUnit && KNOWN_HABIT_UNITS.has(rawUnit)) {
    return rawUnit as "count" | "ml" | "minutes" | "hours";
  }
  if (habitType === "sleep") return "hours";
  if (habitType === "activity") return "minutes";
  if (habitType === "fluid" || logAs === "fluid") return "ml";
  return "count";
}

function normalizeQuickIncrement(
  habitType: string,
  rawIncrement: number | undefined,
): number {
  if (habitType === "checkbox") return 1;
  if (typeof rawIncrement === "number" && rawIncrement > 0) return rawIncrement;
  if (habitType === "sleep") return 0.5;
  if (habitType === "activity") return 10;
  if (habitType === "fluid") return 250;
  return 1;
}

function normalizeGoalValues(args: {
  habitType: string;
  kind: "positive" | "destructive";
  rawDailyTarget: number | undefined;
  rawDailyCap: number | undefined;
}): { dailyTarget?: number; dailyCap?: number } {
  const { habitType, kind, rawDailyTarget, rawDailyCap } = args;
  if (habitType === "checkbox") return { dailyTarget: 1 };
  if (habitType === "destructive" || kind === "destructive") {
    if (typeof rawDailyCap === "number" && rawDailyCap > 0) {
      return { dailyCap: rawDailyCap };
    }
    return {};
  }
  if (typeof rawDailyTarget === "number" && rawDailyTarget > 0) {
    return { dailyTarget: rawDailyTarget };
  }
  return {};
}

function inferColor(habitType: string, rawColor: string | undefined): string {
  if (rawColor) return rawColor;
  if (habitType === "destructive") return "gray";
  if (habitType === "fluid") return "blue";
  return "indigo";
}

function normalizeStoredProfileHabit(
  rawHabit: unknown,
  index: number,
  fallbackCreatedAt: number,
) {
  if (!rawHabit || typeof rawHabit !== "object") return null;
  const raw = rawHabit as Record<string, unknown>;

  const name = asTrimmedString(raw.name);
  if (!name) return null;

  const rawHabitType = asTrimmedString(raw.habitType);
  const rawKind = asTrimmedString(raw.kind);
  const goalMode = asTrimmedString(raw.goalMode);
  const rawLogAs =
    raw.logAs === "habit" || raw.logAs === "fluid" ? raw.logAs : undefined;
  const rawUnit = asTrimmedString(raw.unit);
  const rawDailyTarget =
    asFiniteNumber(raw.dailyTarget) ?? asFiniteNumber(raw.dailyGoal);
  const rawDailyCap =
    asFiniteNumber(raw.dailyCap) ?? asFiniteNumber(raw.dailyGoal);

  const habitType = normalizeHabitType(rawHabitType, name);
  const kind = normalizeKind({ rawKind, goalMode, habitType });
  const logAs = normalizeLogAs(habitType, rawLogAs);
  const unit = normalizeUnit({ rawUnit, habitType, logAs });
  const quickIncrement = normalizeQuickIncrement(
    habitType,
    asFiniteNumber(raw.quickIncrement),
  );
  const { dailyTarget, dailyCap } = normalizeGoalValues({
    habitType,
    kind,
    rawDailyTarget,
    rawDailyCap,
  });

  const normalized: {
    id: string;
    name: string;
    kind: "positive" | "destructive";
    unit: "count" | "ml" | "minutes" | "hours";
    quickIncrement: number;
    dailyTarget?: number;
    dailyCap?: number;
    weeklyFrequencyTarget?: number;
    showOnTrack: boolean;
    color: string;
    createdAt: number;
    archivedAt?: number;
    logAs?: "habit" | "fluid";
    habitType: string;
    templateKey?: string;
  } = {
    id: asTrimmedString(raw.id) ?? `habit_${slugifyName(name)}_${index}`,
    name,
    kind,
    unit,
    quickIncrement,
    showOnTrack: typeof raw.showOnTrack === "boolean" ? raw.showOnTrack : true,
    color: inferColor(habitType, asTrimmedString(raw.color)),
    createdAt: asFiniteNumber(raw.createdAt) ?? fallbackCreatedAt,
    habitType,
  };

  if (typeof dailyTarget === "number" && dailyTarget > 0) {
    normalized.dailyTarget = dailyTarget;
  }
  if (typeof dailyCap === "number" && dailyCap > 0) {
    normalized.dailyCap = dailyCap;
  }

  const weeklyFrequencyTarget = asFiniteNumber(raw.weeklyFrequencyTarget);
  if (weeklyFrequencyTarget !== undefined && weeklyFrequencyTarget > 0) {
    normalized.weeklyFrequencyTarget = Math.round(weeklyFrequencyTarget);
  }

  const archivedAt = asFiniteNumber(raw.archivedAt);
  if (archivedAt !== undefined) normalized.archivedAt = archivedAt;
  if (logAs !== undefined) normalized.logAs = logAs;

  const templateKey = asTrimmedString(raw.templateKey);
  if (templateKey) normalized.templateKey = templateKey;

  return normalized;
}

function normalizeStoredProfileHabits(
  habits: unknown,
  fallbackCreatedAt: number,
) {
  if (!Array.isArray(habits)) return [];
  return habits
    .map((habit, index) =>
      normalizeStoredProfileHabit(habit, index, fallbackCreatedAt),
    )
    .filter((habit) => habit !== null);
}

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

export const replaceProfile = mutation({
  args: {
    unitSystem: v.union(
      v.literal("metric"),
      v.literal("imperial_us"),
      v.literal("imperial_uk"),
    ),
    habits: habitsValidator,
    fluidPresets: v.optional(fluidPresetsValidator),
    sleepGoal: v.optional(sleepGoalValidator),
    healthProfile: v.optional(healthProfileValidator),
    aiPreferences: v.optional(aiPreferencesValidator),
    foodPersonalisation: v.optional(foodPersonalisationValidator),
    transitCalibration: v.optional(transitCalibrationValidator),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    if (args.habits.length > 100) {
      throw new Error("Profile cannot contain more than 100 habits.");
    }

    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    const updatedAt = args.now;
    // Normalize once on write so reactive reads can return habits as-stored.
    const normalizedHabits = normalizeStoredProfileHabits(
      sanitizeUnknownStringsDeep(args.habits, {
        path: "profile.habits",
      }),
      updatedAt,
    );

    const payload: {
      userId: string;
      unitSystem: "metric" | "imperial_us" | "imperial_uk";
      habits: typeof args.habits;
      fluidPresets?: typeof args.fluidPresets;
      updatedAt: number;
      sleepGoal?: typeof args.sleepGoal;
      healthProfile?: typeof args.healthProfile;
      aiPreferences?: typeof args.aiPreferences;
      foodPersonalisation?: typeof args.foodPersonalisation;
      transitCalibration?: typeof args.transitCalibration;
    } = {
      userId,
      unitSystem: args.unitSystem,
      habits: normalizedHabits as typeof args.habits,
      updatedAt,
    };
    if (args.fluidPresets !== undefined) {
      payload.fluidPresets =
        normalizeStoredFluidPresets(
          sanitizeUnknownStringsDeep(args.fluidPresets, {
            path: "profile.fluidPresets",
          }),
        ) ?? [];
    }
    if (args.sleepGoal !== undefined) {
      payload.sleepGoal = sanitizeUnknownStringsDeep(args.sleepGoal, {
        path: "profile.sleepGoal",
      });
    }
    if (args.healthProfile !== undefined) {
      payload.healthProfile = sanitizeUnknownStringsDeep(args.healthProfile, {
        path: "profile.healthProfile",
      });
    }
    if (args.aiPreferences !== undefined) {
      payload.aiPreferences = normalizeStoredAiPreferences(
        sanitizeUnknownStringsDeep(args.aiPreferences, {
          path: "profile.aiPreferences",
        }),
      ) as typeof args.aiPreferences;
    }
    if (args.foodPersonalisation !== undefined) {
      payload.foodPersonalisation = sanitizeUnknownStringsDeep(
        args.foodPersonalisation,
        {
          path: "profile.foodPersonalisation",
        },
      );
    }
    if (args.transitCalibration !== undefined) {
      payload.transitCalibration = sanitizeUnknownStringsDeep(
        args.transitCalibration,
        {
          path: "profile.transitCalibration",
        },
      );
    }

    if (existing) {
      await ctx.db.replace(existing._id, payload);
      return existing._id;
    }
    return await ctx.db.insert("profiles", payload);
  },
});

export const patchProfile = mutation({
  args: {
    unitSystem: v.optional(
      v.union(
        v.literal("metric"),
        v.literal("imperial_us"),
        v.literal("imperial_uk"),
      ),
    ),
    habits: v.optional(habitsValidator),
    fluidPresets: v.optional(fluidPresetsValidator),
    sleepGoal: v.optional(sleepGoalValidator),
    healthProfile: v.optional(healthProfileValidator),
    aiPreferences: v.optional(aiPreferencesValidator),
    foodPersonalisation: v.optional(foodPersonalisationValidator),
    transitCalibration: v.optional(transitCalibrationValidator),
    nutritionGoals: v.optional(nutritionGoalsValidator),
    foodFavourites: v.optional(v.array(v.string())),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);

    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    const updatedAt = args.now;

    // Build updates from non-undefined args only
    const updates: Record<string, unknown> = { updatedAt };

    if (args.unitSystem !== undefined) {
      updates.unitSystem = args.unitSystem;
    }
    if (args.habits !== undefined) {
      if (args.habits.length > 100) {
        throw new Error("Profile cannot contain more than 100 habits.");
      }
      updates.habits = normalizeStoredProfileHabits(
        sanitizeUnknownStringsDeep(args.habits, { path: "profile.habits" }),
        updatedAt,
      );
    }
    if (args.fluidPresets !== undefined) {
      updates.fluidPresets =
        normalizeStoredFluidPresets(
          sanitizeUnknownStringsDeep(args.fluidPresets, {
            path: "profile.fluidPresets",
          }),
        ) ?? [];
    }
    if (args.sleepGoal !== undefined) {
      updates.sleepGoal = sanitizeUnknownStringsDeep(args.sleepGoal, {
        path: "profile.sleepGoal",
      });
    }
    if (args.healthProfile !== undefined) {
      updates.healthProfile = sanitizeUnknownStringsDeep(args.healthProfile, {
        path: "profile.healthProfile",
      });
    }
    if (args.aiPreferences !== undefined) {
      updates.aiPreferences = normalizeStoredAiPreferences(
        sanitizeUnknownStringsDeep(args.aiPreferences, {
          path: "profile.aiPreferences",
        }),
      ) as typeof args.aiPreferences;
    }
    if (args.foodPersonalisation !== undefined) {
      updates.foodPersonalisation = sanitizeUnknownStringsDeep(
        args.foodPersonalisation,
        {
          path: "profile.foodPersonalisation",
        },
      );
    }
    if (args.transitCalibration !== undefined) {
      updates.transitCalibration = sanitizeUnknownStringsDeep(
        args.transitCalibration,
        {
          path: "profile.transitCalibration",
        },
      );
    }
    if (args.nutritionGoals !== undefined) {
      updates.nutritionGoals = args.nutritionGoals;
    }
    if (args.foodFavourites !== undefined) {
      updates.foodFavourites = sanitizeUnknownStringsDeep(args.foodFavourites, {
        path: "profile.foodFavourites",
      });
    }

    if (existing) {
      await ctx.db.patch(existing._id, updates);
      return existing._id;
    }

    // No existing profile — insert with required fields defaulted
    return await ctx.db.insert("profiles", {
      userId,
      unitSystem:
        (updates.unitSystem as "metric" | "imperial_us" | "imperial_uk") ??
        "metric",
      habits: (updates.habits as typeof args.habits) ?? [],
      updatedAt,
      ...(updates.fluidPresets !== undefined && {
        fluidPresets: updates.fluidPresets,
      }),
      ...(updates.sleepGoal !== undefined && {
        sleepGoal: updates.sleepGoal,
      }),
      ...(updates.healthProfile !== undefined && {
        healthProfile: updates.healthProfile,
      }),
      ...(updates.aiPreferences !== undefined && {
        aiPreferences: updates.aiPreferences,
      }),
      ...(updates.foodPersonalisation !== undefined && {
        foodPersonalisation: updates.foodPersonalisation,
      }),
      ...(updates.transitCalibration !== undefined && {
        transitCalibration: updates.transitCalibration,
      }),
      ...(updates.nutritionGoals !== undefined && {
        nutritionGoals: updates.nutritionGoals,
      }),
      ...(updates.foodFavourites !== undefined && {
        foodFavourites: updates.foodFavourites,
      }),
    } as Parameters<typeof ctx.db.insert<"profiles">>[1]);
  },
});

export const getProfile = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireAuth(ctx);
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (!profile) return null;
    return {
      ...profile,
      ...(profile.fluidPresets !== undefined && {
        fluidPresets: normalizeStoredFluidPresets(profile.fluidPresets) ?? [],
      }),
      ...(profile.aiPreferences !== undefined && {
        aiPreferences:
          normalizeStoredAiPreferences(profile.aiPreferences) ??
          profile.aiPreferences,
      }),
    };
  },
});

// All tables that store per-user data and have a by_userId index.
// IMPORTANT: When adding a new table with a by_userId index to schema.ts,
// you MUST add it to this list. Otherwise "Delete My Account Data" will
// leave orphaned data.
const USER_DATA_TABLES = [
  "logs",
  "ingredientExposures",
  "ingredientOverrides",
  "ingredientProfiles",
  "aiAnalyses",
  "aiAnalysisPayloads",
  "conversations",
  "foodAssessments",
  "foodTrialSummary",
  "weeklyDigest",
  "weeklySummaries",
  "profiles",
  "foodLibrary",
] as const;

type UserDataTableName = (typeof USER_DATA_TABLES)[number];

type BackupRow = Record<string, unknown> & { id: string };

type BackupPayload = {
  version: 1;
  exportedAt: number;
  data: Record<UserDataTableName, BackupRow[]>;
};

type BackupLogType =
  | "food"
  | "liquid"
  | "fluid"
  | "habit"
  | "activity"
  | "digestion"
  | "weight";

const BACKUP_LOG_TYPES = new Set<string>([
  "food",
  "liquid",
  "fluid",
  "habit",
  "activity",
  "digestion",
  "weight",
] as const);

type BackupFoodVerdict =
  | "culprit"
  | "safe"
  | "watch"
  | "next_to_try"
  | "avoid"
  | "trial_next";

const BACKUP_FOOD_VERDICTS = new Set<string>([
  "culprit",
  "safe",
  "watch",
  "next_to_try",
  "avoid",
  "trial_next",
] as const);

/** Validate a string as a known log type. Returns null for unknown types — callers must skip null entries. */
function asBackupLogType(value: string | undefined): BackupLogType | null {
  if (value && BACKUP_LOG_TYPES.has(value)) return value as BackupLogType;
  return null;
}

/** Validate a string as a known food verdict, defaulting to "watch". */
function asBackupFoodVerdict(value: string | undefined): BackupFoodVerdict {
  if (value && BACKUP_FOOD_VERDICTS.has(value))
    return value as BackupFoodVerdict;
  return "watch";
}

/** Coerce an unknown value to a bristolDistribution record with safe defaults. */
function asBristolDistribution(value: unknown): {
  bristol1: number;
  bristol2: number;
  bristol3: number;
  bristol4: number;
  bristol5: number;
  bristol6: number;
  bristol7: number;
} {
  const record = asRecord(value);
  return {
    bristol1: asNumber(record?.bristol1) ?? 0,
    bristol2: asNumber(record?.bristol2) ?? 0,
    bristol3: asNumber(record?.bristol3) ?? 0,
    bristol4: asNumber(record?.bristol4) ?? 0,
    bristol5: asNumber(record?.bristol5) ?? 0,
    bristol6: asNumber(record?.bristol6) ?? 0,
    bristol7: asNumber(record?.bristol7) ?? 0,
  };
}

/** Coerce an unknown value to a keyFoods record with safe defaults. */
function asKeyFoods(value: unknown): {
  safe: string[];
  flagged: string[];
  toTryNext: string[];
} {
  const record = asRecord(value);
  return {
    safe: asStringArray(record?.safe),
    flagged: asStringArray(record?.flagged),
    toTryNext: asStringArray(record?.toTryNext),
  };
}

type FoodTrialStatus =
  | "testing"
  | "safe"
  | "safe-loose"
  | "safe-hard"
  | "watch"
  | "risky"
  | "culprit"
  | "cleared";

const FOOD_TRIAL_STATUSES = new Set<string>([
  "testing",
  "safe",
  "safe-loose",
  "safe-hard",
  "watch",
  "risky",
  "culprit",
  "cleared",
]);

/** Validate a string as a known food trial status, defaulting to "testing". */
function asFoodTrialStatus(value: string | undefined): FoodTrialStatus {
  if (value && FOOD_TRIAL_STATUSES.has(value)) return value as FoodTrialStatus;
  return "testing";
}

type FoodTrialAiVerdict =
  | "culprit"
  | "safe"
  | "next_to_try"
  | "watch"
  | "avoid"
  | "trial_next"
  | "none";

const FOOD_TRIAL_AI_VERDICTS = new Set<string>([
  "culprit",
  "safe",
  "next_to_try",
  "watch",
  "avoid",
  "trial_next",
  "none",
]);

/** Validate a string as a known food trial AI verdict, defaulting to "none". */
function asFoodTrialAiVerdict(value: string | undefined): FoodTrialAiVerdict {
  if (value && FOOD_TRIAL_AI_VERDICTS.has(value))
    return value as FoodTrialAiVerdict;
  return "none";
}

const FOOD_PRIMARY_STATUSES = new Set<string>([
  "building",
  "safe",
  "watch",
  "avoid",
]);

function isFoodPrimaryStatus(
  value: unknown,
): value is "building" | "safe" | "watch" | "avoid" {
  return typeof value === "string" && FOOD_PRIMARY_STATUSES.has(value);
}

const FOOD_TENDENCIES = new Set<string>(["neutral", "loose", "hard"]);

function isFoodTendency(value: unknown): value is "neutral" | "loose" | "hard" {
  return typeof value === "string" && FOOD_TENDENCIES.has(value);
}

/** Coerce an unknown value to a nutritionPer100g record with safe defaults. */
function asNutritionPer100g(value: unknown): {
  kcal: number | null;
  fatG: number | null;
  saturatedFatG: number | null;
  carbsG: number | null;
  sugarsG: number | null;
  fiberG: number | null;
  proteinG: number | null;
  saltG: number | null;
} {
  const record = asRecord(value);
  const numOrNull = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  return {
    kcal: numOrNull(record?.kcal),
    fatG: numOrNull(record?.fatG),
    saturatedFatG: numOrNull(record?.saturatedFatG),
    carbsG: numOrNull(record?.carbsG),
    sugarsG: numOrNull(record?.sugarsG),
    fiberG: numOrNull(record?.fiberG),
    proteinG: numOrNull(record?.proteinG),
    saltG: numOrNull(record?.saltG),
  };
}

async function listRowsByUserId(
  db: DatabaseReader,
  table: UserDataTableName,
  userId: string,
): Promise<BackupRow[]> {
  const rows = await db
    .query(table)
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();

  return (rows as Array<Record<string, unknown>>).map((row) => {
    const { _id, _creationTime: _ignoredCreationTime, ...rest } = row;
    return {
      id: String(_id),
      ...rest,
    };
  });
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function normalizeBackupPayload(payload: unknown): BackupPayload {
  const root = asRecord(payload);
  if (!root) {
    throw new Error("Backup payload is missing the root object.");
  }

  if (root.version !== 1) {
    throw new Error("Unsupported backup version.");
  }

  const data = asRecord(root.data);
  if (!data) {
    throw new Error("Backup payload is missing the data object.");
  }

  const normalizedData = Object.fromEntries(
    USER_DATA_TABLES.map((table) => {
      const rows = Array.isArray(data[table])
        ? data[table].filter(
            (row): row is BackupRow =>
              row !== null &&
              typeof row === "object" &&
              !Array.isArray(row) &&
              typeof (row as { id?: unknown }).id === "string",
          )
        : [];
      return [table, rows];
    }),
  ) as Record<UserDataTableName, BackupRow[]>;

  return {
    version: 1,
    exportedAt: asNumber(root.exportedAt) ?? 0,
    data: normalizedData,
  };
}

function backupRowTimestamp(row: BackupRow): number {
  return (
    asNumber(row.updatedAt) ??
    asNumber(row.timestamp) ??
    asNumber(row.createdAt) ??
    asNumber(row.reportTimestamp) ??
    asNumber(row.weekStartTimestamp) ??
    asNumber(row.generatedAt) ??
    asNumber(row.startedAt) ??
    asNumber(row.logTimestamp) ??
    asNumber(row.lastAssessedAt) ??
    0
  );
}

function remapId<T extends string>(
  value: unknown,
  mapping: ReadonlyMap<string, T>,
): T | undefined {
  const id = asString(value);
  if (!id) return undefined;
  return mapping.get(id);
}

async function deleteAllUserData(ctx: MutationCtx, userId: string) {
  const counts: Record<string, number> = {};
  let totalDeleted = 0;

  for (const table of USER_DATA_TABLES) {
    let deleted = 0;
    while (true) {
      const batch = await ctx.db
        .query(table)
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .take(200);
      if (batch.length === 0) break;
      for (const row of batch) {
        await ctx.db.delete(row._id);
      }
      deleted += batch.length;
    }
    counts[table] = deleted;
    totalDeleted += deleted;
  }

  return { totalDeleted, ...counts };
}

export const exportBackup = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireAuth(ctx);

    const rows = await Promise.all(
      USER_DATA_TABLES.map(
        async (table) =>
          [table, await listRowsByUserId(ctx.db, table, userId)] as const,
      ),
    );
    const data = Object.fromEntries(rows) as Record<
      UserDataTableName,
      BackupRow[]
    >;
    const exportedAt = Math.max(
      0,
      ...Object.values(data).flatMap((tableRows) =>
        tableRows.map(backupRowTimestamp),
      ),
    );

    return {
      version: 1 as const,
      exportedAt,
      data,
    };
  },
});

export const deleteAll = mutation({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireAuth(ctx);
    return deleteAllUserData(ctx, userId);
  },
});

/**
 * Validator for backup payloads. Validates the top-level structure
 * (version, exportedAt, data object with known table keys containing arrays).
 *
 * Per-row validation within each array uses v.any() because backup data may
 * contain legacy field shapes that don't match the current strict schema.
 * The normalizeBackupPayload() runtime function handles per-row coercion
 * and sanitization, so type safety is enforced at insert time, not at the
 * validator boundary.
 */
const backupPayloadValidator = v.object({
  version: v.number(),
  exportedAt: v.number(),
  data: v.object({
    logs: v.optional(v.array(v.any())),
    ingredientExposures: v.optional(v.array(v.any())),
    ingredientOverrides: v.optional(v.array(v.any())),
    ingredientProfiles: v.optional(v.array(v.any())),
    aiAnalyses: v.optional(v.array(v.any())),
    aiAnalysisPayloads: v.optional(v.array(v.any())),
    conversations: v.optional(v.array(v.any())),
    foodAssessments: v.optional(v.array(v.any())),
    // reportSuggestions: kept in validator for backward-compatible backup import
    // (old backups may contain this key). Data is silently ignored on import.
    reportSuggestions: v.optional(v.array(v.any())),
    foodTrialSummary: v.optional(v.array(v.any())),
    weeklyDigest: v.optional(v.array(v.any())),
    weeklySummaries: v.optional(v.array(v.any())),
    profiles: v.optional(v.array(v.any())),
    foodLibrary: v.optional(v.array(v.any())),
  }),
});

export const importBackup = mutation({
  args: {
    payload: backupPayloadValidator,
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);

    const payload = normalizeBackupPayload(
      sanitizeUnknownStringsDeep(args.payload, {
        path: "backup",
      }),
    );

    const deleted = await deleteAllUserData(ctx, userId);

    const insertedCounts: Partial<Record<UserDataTableName, number>> = {};
    const logIdMap = new Map<string, Id<"logs">>();
    const aiAnalysisIdMap = new Map<string, Id<"aiAnalyses">>();

    let logsInserted = 0;
    let logsSkippedUnknownType = 0;
    for (const row of payload.data.logs) {
      const type = asString(row.type);
      const validatedType = asBackupLogType(type);
      if (validatedType === null) {
        console.warn(
          `restoreFromBackup: skipping log row with unknown type "${type ?? "(missing)"}"`,
        );
        logsSkippedUnknownType++;
        continue;
      }
      const nextId = await ctx.db.insert("logs", {
        userId,
        timestamp: asNumber(row.timestamp) ?? payload.exportedAt,
        type: validatedType,
        // Log data has a complex union shape (food | fluid | habit | activity |
        // digestion | weight). Backup rows may contain legacy field shapes
        // that normalizeBackupPayload doesn't deep-validate.
        // The Convex schema validator will reject structurally invalid data at
        // write time, so this cast is a bridge, not a bypass.
        data: (row.data ?? {}) as typeof logDataValidator.type,
      });
      logIdMap.set(row.id, nextId);
      logsInserted++;
    }
    insertedCounts.logs = logsInserted;

    for (const row of payload.data.aiAnalyses) {
      const rowError = asString(row.error);
      // Write lightweight metadata to aiAnalyses (no request/response).
      const nextId = await ctx.db.insert("aiAnalyses", {
        userId,
        timestamp: asNumber(row.timestamp) ?? payload.exportedAt,
        insight: (row.insight ?? null) as typeof aiInsightValidator.type,
        model: asString(row.model) ?? "unknown",
        durationMs: asNumber(row.durationMs) ?? 0,
        inputLogCount: asNumber(row.inputLogCount) ?? 0,
        ...(rowError !== undefined && { error: rowError }),
        ...(typeof row.starred === "boolean" && { starred: row.starred }),
      });
      // Store heavy request/response payload in separate table.
      await ctx.db.insert("aiAnalysisPayloads", {
        userId,
        aiAnalysisId: nextId,
        request: (row.request ?? null) as typeof aiRequestValidator.type,
        response: (row.response ?? null) as typeof aiResponseValidator.type,
      });
      aiAnalysisIdMap.set(row.id, nextId);
    }
    insertedCounts.aiAnalyses = payload.data.aiAnalyses.length;

    for (const row of payload.data.profiles) {
      const encryptedApiKey = asString(row.encryptedApiKey);
      await ctx.db.insert("profiles", {
        userId,
        unitSystem:
          row.unitSystem === "imperial_us" || row.unitSystem === "imperial_uk"
            ? row.unitSystem
            : "metric",
        // Profile sub-objects (habits, sleepGoal, healthProfile, aiPreferences,
        // foodPersonalisation, transitCalibration) are deeply nested validators.
        // Backup data may contain legacy shapes. These casts use the validator
        // types so TypeScript sees the correct shape; Convex schema validation
        // rejects structurally invalid data at write time.
        habits: (Array.isArray(row.habits)
          ? row.habits
          : []) as typeof habitsValidator.type,
        ...(row.fluidPresets !== undefined && {
          fluidPresets: normalizeStoredFluidPresets(row.fluidPresets) ?? [],
        }),
        ...(row.sleepGoal !== undefined && {
          sleepGoal: row.sleepGoal as typeof sleepGoalValidator.type,
        }),
        ...(row.healthProfile !== undefined && {
          healthProfile:
            row.healthProfile as typeof healthProfileValidator.type,
        }),
        ...(row.aiPreferences !== undefined && {
          aiPreferences: normalizeStoredAiPreferences(
            row.aiPreferences,
          ) as typeof aiPreferencesValidator.type,
        }),
        ...(row.foodPersonalisation !== undefined && {
          foodPersonalisation:
            row.foodPersonalisation as typeof foodPersonalisationValidator.type,
        }),
        ...(row.transitCalibration !== undefined && {
          transitCalibration:
            row.transitCalibration as typeof transitCalibrationValidator.type,
        }),
        ...(Array.isArray(row.knownFoods) && {
          knownFoods: asStringArray(row.knownFoods),
        }),
        ...(encryptedApiKey !== undefined && { encryptedApiKey }),
        updatedAt: asNumber(row.updatedAt) ?? payload.exportedAt,
      });
    }
    insertedCounts.profiles = payload.data.profiles.length;

    for (const row of payload.data.foodLibrary) {
      await ctx.db.insert("foodLibrary", {
        userId,
        canonicalName: asString(row.canonicalName) ?? "",
        type: row.type === "composite" ? "composite" : "ingredient",
        ingredients: asStringArray(row.ingredients),
        createdAt: asNumber(row.createdAt) ?? payload.exportedAt,
      });
    }
    insertedCounts.foodLibrary = payload.data.foodLibrary.length;

    for (const row of payload.data.ingredientOverrides) {
      const rowNote = asString(row.note);
      await ctx.db.insert("ingredientOverrides", {
        userId,
        canonicalName: asString(row.canonicalName) ?? "",
        status:
          row.status === "watch" || row.status === "avoid"
            ? row.status
            : "safe",
        ...(rowNote !== undefined && { note: rowNote }),
        createdAt: asNumber(row.createdAt) ?? payload.exportedAt,
        updatedAt: asNumber(row.updatedAt) ?? payload.exportedAt,
      });
    }
    insertedCounts.ingredientOverrides =
      payload.data.ingredientOverrides.length;

    for (const row of payload.data.ingredientProfiles) {
      const projection = getCanonicalFoodProjection(
        asString(row.canonicalName) ?? "",
      );
      await ctx.db.insert("ingredientProfiles", {
        userId,
        canonicalName: asString(row.canonicalName) ?? "",
        displayName:
          asString(row.displayName) ?? asString(row.canonicalName) ?? "",
        tags: asStringArray(row.tags),
        foodGroup: projection.foodGroup,
        foodLine: projection.foodLine,
        lowResidue:
          typeof row.lowResidue === "boolean" || row.lowResidue === null
            ? row.lowResidue
            : null,
        source:
          row.source === "manual" ||
          row.source === "openfoodfacts" ||
          row.source === null
            ? row.source
            : null,
        externalId:
          typeof row.externalId === "string" || row.externalId === null
            ? row.externalId
            : null,
        ingredientsText:
          typeof row.ingredientsText === "string" ||
          row.ingredientsText === null
            ? row.ingredientsText
            : null,
        nutritionPer100g: asNutritionPer100g(row.nutritionPer100g),
        createdAt: asNumber(row.createdAt) ?? payload.exportedAt,
        updatedAt: asNumber(row.updatedAt) ?? payload.exportedAt,
      });
    }
    insertedCounts.ingredientProfiles = payload.data.ingredientProfiles.length;

    for (const row of payload.data.weeklyDigest) {
      const avgBristolScore = asNumber(row.avgBristolScore);
      const totalHabitLogs = asNumber(row.totalHabitLogs);
      const totalFluidMl = asNumber(row.totalFluidMl);
      await ctx.db.insert("weeklyDigest", {
        userId,
        weekStart: asString(row.weekStart) ?? "",
        weekStartTimestamp: asNumber(row.weekStartTimestamp) ?? 0,
        totalBowelEvents: asNumber(row.totalBowelEvents) ?? 0,
        ...(avgBristolScore !== undefined && { avgBristolScore }),
        bristolDistribution: asBristolDistribution(row.bristolDistribution),
        accidentCount: asNumber(row.accidentCount) ?? 0,
        totalFoodLogs: asNumber(row.totalFoodLogs) ?? 0,
        uniqueFoodsEaten: asNumber(row.uniqueFoodsEaten) ?? 0,
        newFoodsTried: asNumber(row.newFoodsTried) ?? 0,
        totalReports: asNumber(row.totalReports) ?? 0,
        foodsCleared: asNumber(row.foodsCleared) ?? 0,
        foodsFlagged: asNumber(row.foodsFlagged) ?? 0,
        topCulprits: asStringArray(row.topCulprits),
        topSafe: asStringArray(row.topSafe),
        ...(totalHabitLogs !== undefined && { totalHabitLogs }),
        ...(totalFluidMl !== undefined && { totalFluidMl }),
        updatedAt: asNumber(row.updatedAt) ?? payload.exportedAt,
      });
    }
    insertedCounts.weeklyDigest = payload.data.weeklyDigest.length;

    for (const row of payload.data.weeklySummaries) {
      const promptVersion = asNumber(row.promptVersion);
      await ctx.db.insert("weeklySummaries", {
        userId,
        weekStartTimestamp: asNumber(row.weekStartTimestamp) ?? 0,
        weekEndTimestamp: asNumber(row.weekEndTimestamp) ?? 0,
        weeklySummary: asString(row.weeklySummary) ?? "",
        keyFoods: asKeyFoods(row.keyFoods),
        carryForwardNotes: asStringArray(row.carryForwardNotes),
        model: asString(row.model) ?? "unknown",
        durationMs: asNumber(row.durationMs) ?? 0,
        generatedAt: asNumber(row.generatedAt) ?? payload.exportedAt,
        ...(promptVersion !== undefined && { promptVersion }),
      });
    }
    insertedCounts.weeklySummaries = payload.data.weeklySummaries.length;

    for (const row of payload.data.conversations) {
      const aiAnalysisId = remapId(row.aiAnalysisId, aiAnalysisIdMap);
      const promptVersion = asNumber(row.promptVersion);
      await ctx.db.insert("conversations", {
        userId,
        ...(aiAnalysisId !== undefined && { aiAnalysisId }),
        timestamp: asNumber(row.timestamp) ?? payload.exportedAt,
        role: row.role === "assistant" ? "assistant" : "user",
        content: asString(row.content) ?? "",
        ...(promptVersion !== undefined && { promptVersion }),
      });
    }
    insertedCounts.conversations = payload.data.conversations.length;

    for (const row of payload.data.foodAssessments) {
      const aiAnalysisId = remapId(row.aiAnalysisId, aiAnalysisIdMap);
      if (!aiAnalysisId) continue;
      const verdict = asString(row.verdict);
      const causalRole =
        row.causalRole === "primary" ||
        row.causalRole === "possible" ||
        row.causalRole === "unlikely"
          ? row.causalRole
          : undefined;
      const changeType =
        row.changeType === "new" ||
        row.changeType === "upgraded" ||
        row.changeType === "downgraded" ||
        row.changeType === "unchanged"
          ? row.changeType
          : undefined;
      const modifierSummary = asString(row.modifierSummary);
      await ctx.db.insert("foodAssessments", {
        userId,
        aiAnalysisId,
        reportTimestamp: asNumber(row.reportTimestamp) ?? payload.exportedAt,
        foodName: asString(row.foodName) ?? "",
        canonicalName: asString(row.canonicalName) ?? "",
        verdict: asBackupFoodVerdict(verdict),
        ...(row.confidence === "high" ||
        row.confidence === "medium" ||
        row.confidence === "low"
          ? { confidence: row.confidence }
          : {}),
        ...(causalRole && { causalRole }),
        ...(changeType && { changeType }),
        ...(modifierSummary !== undefined && { modifierSummary }),
        reasoning: asString(row.reasoning) ?? "",
      });
    }
    insertedCounts.foodAssessments = payload.data.foodAssessments.length;

    // reportSuggestions: silently skip on import — table eliminated in WQ-309.
    // Suggestions are now read directly from aiAnalyses.insight.suggestions.

    for (const row of payload.data.ingredientExposures) {
      const logId = remapId(row.logId, logIdMap);
      if (!logId) continue;
      const preparation = asString(row.preparation);
      await ctx.db.insert("ingredientExposures", {
        userId,
        logId,
        itemIndex: asNumber(row.itemIndex) ?? 0,
        logTimestamp: asNumber(row.logTimestamp) ?? payload.exportedAt,
        ingredientName: asString(row.ingredientName) ?? "",
        canonicalName: asString(row.canonicalName) ?? "",
        quantity:
          typeof row.quantity === "number" || row.quantity === null
            ? row.quantity
            : null,
        unit:
          typeof row.unit === "string" || row.unit === null ? row.unit : null,
        ...(preparation !== undefined && { preparation }),
        ...(row.recoveryStage === 1 ||
        row.recoveryStage === 2 ||
        row.recoveryStage === 3
          ? { recoveryStage: row.recoveryStage }
          : {}),
        ...(row.spiceLevel === "plain" ||
        row.spiceLevel === "mild" ||
        row.spiceLevel === "spicy"
          ? { spiceLevel: row.spiceLevel }
          : {}),
        createdAt: asNumber(row.createdAt) ?? payload.exportedAt,
      });
    }
    insertedCounts.ingredientExposures =
      payload.data.ingredientExposures.length;

    for (const row of payload.data.foodTrialSummary) {
      const currentStatus = asString(row.currentStatus);
      const latestAiVerdict = asString(row.latestAiVerdict);
      const confidence = asNumber(row.confidence);
      const codeScore = asNumber(row.codeScore);
      const aiScore = asNumber(row.aiScore);
      const combinedScore = asNumber(row.combinedScore);
      const learnedTransitCenterMinutes = asNumber(
        row.learnedTransitCenterMinutes,
      );
      const learnedTransitSpreadMinutes = asNumber(
        row.learnedTransitSpreadMinutes,
      );
      await ctx.db.insert("foodTrialSummary", {
        userId,
        canonicalName: asString(row.canonicalName) ?? "",
        displayName: asString(row.displayName) ?? "",
        currentStatus: asFoodTrialStatus(currentStatus),
        ...(isFoodPrimaryStatus(row.primaryStatus) && {
          primaryStatus: row.primaryStatus,
        }),
        ...(isFoodTendency(row.tendency) && { tendency: row.tendency }),
        ...(confidence !== undefined && { confidence }),
        ...(codeScore !== undefined && { codeScore }),
        ...(aiScore !== undefined && { aiScore }),
        ...(combinedScore !== undefined && { combinedScore }),
        ...(typeof row.recentSuspect === "boolean" && {
          recentSuspect: row.recentSuspect,
        }),
        ...(typeof row.clearedHistory === "boolean" && {
          clearedHistory: row.clearedHistory,
        }),
        ...(learnedTransitCenterMinutes !== undefined && {
          learnedTransitCenterMinutes,
        }),
        ...(learnedTransitSpreadMinutes !== undefined && {
          learnedTransitSpreadMinutes,
        }),
        latestAiVerdict: asFoodTrialAiVerdict(latestAiVerdict),
        ...(row.latestConfidence === "high" ||
        row.latestConfidence === "medium" ||
        row.latestConfidence === "low"
          ? { latestConfidence: row.latestConfidence }
          : {}),
        totalAssessments: asNumber(row.totalAssessments) ?? 0,
        culpritCount: asNumber(row.culpritCount) ?? 0,
        safeCount: asNumber(row.safeCount) ?? 0,
        nextToTryCount: asNumber(row.nextToTryCount) ?? 0,
        firstSeenAt: asNumber(row.firstSeenAt) ?? payload.exportedAt,
        lastAssessedAt: asNumber(row.lastAssessedAt) ?? payload.exportedAt,
        latestReasoning: asString(row.latestReasoning) ?? "",
        updatedAt: asNumber(row.updatedAt) ?? payload.exportedAt,
      });
    }
    insertedCounts.foodTrialSummary = payload.data.foodTrialSummary.length;

    return {
      version: payload.version,
      deleted,
      importedAt: payload.exportedAt,
      inserted: insertedCounts,
      ...(logsSkippedUnknownType > 0 && { logsSkippedUnknownType }),
    };
  },
});

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
