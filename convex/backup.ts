import { v } from "convex/values";
import { getCanonicalFoodProjection } from "../shared/foodProjection";
import type { Id } from "./_generated/dataModel";
import type { DatabaseReader, MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { requireAuth } from "./lib/auth";
import {
  asNumber,
  asRecord,
  asStringArray,
  asTrimmedString,
} from "./lib/coerce";
import { sanitizeUnknownStringsDeep } from "./lib/inputSafety";
import {
  normalizeStoredAiPreferences,
  normalizeStoredFluidPresets,
} from "./profileMutations";
import {
  type aiInsightValidator,
  type aiRequestValidator,
  type aiResponseValidator,
  aiPreferencesValidator,
  fluidPresetsValidator,
  foodPreferencesValidator,
  habitsValidator,
  healthProfileValidator,
  sleepGoalValidator,
  transitCalibrationValidator,
} from "./validators";

// ─────────────────────────────────────────────────────────────────────────────
// User data table registry
// ─────────────────────────────────────────────────────────────────────────────

// All tables that store per-user data and have a by_userId index.
// IMPORTANT: When adding a new table with a by_userId index to schema.ts,
// you MUST add it to this list. Otherwise "Delete My Account Data" will
// leave orphaned data.
export const USER_DATA_TABLES = [
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

export type UserDataTableName = (typeof USER_DATA_TABLES)[number];

// ─────────────────────────────────────────────────────────────────────────────
// Backup payload types
// ─────────────────────────────────────────────────────────────────────────────

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

const FOOD_PRIMARY_STATUSES = new Set<string>([
  "building",
  "safe",
  "watch",
  "avoid",
]);

const FOOD_TENDENCIES = new Set<string>(["neutral", "loose", "hard"]);

// ─────────────────────────────────────────────────────────────────────────────
// Coerce helpers (backup-specific)
// ─────────────────────────────────────────────────────────────────────────────

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

/** Validate a string as a known food trial status, defaulting to "testing". */
function asFoodTrialStatus(value: string | undefined): FoodTrialStatus {
  if (value && FOOD_TRIAL_STATUSES.has(value)) return value as FoodTrialStatus;
  return "testing";
}

/** Validate a string as a known food trial AI verdict, defaulting to "none". */
function asFoodTrialAiVerdict(value: string | undefined): FoodTrialAiVerdict {
  if (value && FOOD_TRIAL_AI_VERDICTS.has(value))
    return value as FoodTrialAiVerdict;
  return "none";
}

function isFoodPrimaryStatus(
  value: unknown,
): value is "building" | "safe" | "watch" | "avoid" {
  return typeof value === "string" && FOOD_PRIMARY_STATUSES.has(value);
}

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

// ─────────────────────────────────────────────────────────────────────────────
// Backup data access helpers
// ─────────────────────────────────────────────────────────────────────────────

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
  const id = asTrimmedString(value);
  if (!id) return undefined;
  return mapping.get(id);
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

/**
 * INTERNAL: Deletes all rows across USER_DATA_TABLES for the given userId.
 * Callers are responsible for ensuring userId belongs to the authenticated user.
 * This function does NOT verify auth — do not call with an untrusted userId.
 */
export async function deleteAllUserData(ctx: MutationCtx, userId: string) {
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

// ─────────────────────────────────────────────────────────────────────────────
// Backup validator
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Public query and mutations
// ─────────────────────────────────────────────────────────────────────────────

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
