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
  foodPersonalisationValidator,
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
      const type = asTrimmedString(row.type);
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
        data: (row.data ?? {}) as Parameters<
          typeof ctx.db.insert<"logs">
        >[1]["data"],
      });
      logIdMap.set(row.id, nextId);
      logsInserted++;
    }
    insertedCounts.logs = logsInserted;

    // Each AI analysis triggers 2 inserts (aiAnalyses + aiAnalysisPayloads).
    // Cap at 500 to stay well within Convex per-transaction write limits.
    // deleteAllUserData already ran, so a mid-import failure leaves the DB
    // in a partially-deleted state — fail fast before writing anything.
    const AI_ANALYSIS_IMPORT_LIMIT = 500;
    if ((payload.data.aiAnalyses?.length ?? 0) > AI_ANALYSIS_IMPORT_LIMIT) {
      throw new Error(
        `Import contains ${payload.data.aiAnalyses.length} AI analyses, ` +
          `which exceeds the safe import limit of ${AI_ANALYSIS_IMPORT_LIMIT}. ` +
          `Import a more recent backup or clear old analyses first.`,
      );
    }

    for (const row of payload.data.aiAnalyses) {
      const rowError = asTrimmedString(row.error);
      // Write lightweight metadata to aiAnalyses (no request/response).
      const nextId = await ctx.db.insert("aiAnalyses", {
        userId,
        timestamp: asNumber(row.timestamp) ?? payload.exportedAt,
        insight: (row.insight ?? null) as typeof aiInsightValidator.type,
        model: asTrimmedString(row.model) ?? "unknown",
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
      const encryptedApiKey = asTrimmedString(row.encryptedApiKey);
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
        canonicalName: asTrimmedString(row.canonicalName) ?? "",
        type: row.type === "composite" ? "composite" : "ingredient",
        ingredients: asStringArray(row.ingredients),
        createdAt: asNumber(row.createdAt) ?? payload.exportedAt,
      });
    }
    insertedCounts.foodLibrary = payload.data.foodLibrary.length;

    for (const row of payload.data.ingredientOverrides) {
      const rowNote = asTrimmedString(row.note);
      await ctx.db.insert("ingredientOverrides", {
        userId,
        canonicalName: asTrimmedString(row.canonicalName) ?? "",
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
        asTrimmedString(row.canonicalName) ?? "",
      );
      await ctx.db.insert("ingredientProfiles", {
        userId,
        canonicalName: asTrimmedString(row.canonicalName) ?? "",
        displayName:
          asTrimmedString(row.displayName) ??
          asTrimmedString(row.canonicalName) ??
          "",
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
        weekStart: asTrimmedString(row.weekStart) ?? "",
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
        weeklySummary: asTrimmedString(row.weeklySummary) ?? "",
        keyFoods: asKeyFoods(row.keyFoods),
        carryForwardNotes: asStringArray(row.carryForwardNotes),
        model: asTrimmedString(row.model) ?? "unknown",
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
        content: asTrimmedString(row.content) ?? "",
        ...(promptVersion !== undefined && { promptVersion }),
      });
    }
    insertedCounts.conversations = payload.data.conversations.length;

    for (const row of payload.data.foodAssessments) {
      const aiAnalysisId = remapId(row.aiAnalysisId, aiAnalysisIdMap);
      if (!aiAnalysisId) continue;
      const verdict = asTrimmedString(row.verdict);
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
      const modifierSummary = asTrimmedString(row.modifierSummary);
      await ctx.db.insert("foodAssessments", {
        userId,
        aiAnalysisId,
        reportTimestamp: asNumber(row.reportTimestamp) ?? payload.exportedAt,
        foodName: asTrimmedString(row.foodName) ?? "",
        canonicalName: asTrimmedString(row.canonicalName) ?? "",
        verdict: asBackupFoodVerdict(verdict),
        ...(row.confidence === "high" ||
        row.confidence === "medium" ||
        row.confidence === "low"
          ? { confidence: row.confidence }
          : {}),
        ...(causalRole && { causalRole }),
        ...(changeType && { changeType }),
        ...(modifierSummary !== undefined && { modifierSummary }),
        reasoning: asTrimmedString(row.reasoning) ?? "",
      });
    }
    insertedCounts.foodAssessments = payload.data.foodAssessments.length;

    // reportSuggestions: silently skip on import — table eliminated in WQ-309.
    // Suggestions are now read directly from aiAnalyses.insight.suggestions.

    for (const row of payload.data.ingredientExposures) {
      const logId = remapId(row.logId, logIdMap);
      if (!logId) continue;
      const preparation = asTrimmedString(row.preparation);
      await ctx.db.insert("ingredientExposures", {
        userId,
        logId,
        itemIndex: asNumber(row.itemIndex) ?? 0,
        logTimestamp: asNumber(row.logTimestamp) ?? payload.exportedAt,
        ingredientName: asTrimmedString(row.ingredientName) ?? "",
        canonicalName: asTrimmedString(row.canonicalName) ?? "",
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
      const currentStatus = asTrimmedString(row.currentStatus);
      const latestAiVerdict = asTrimmedString(row.latestAiVerdict);
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
        canonicalName: asTrimmedString(row.canonicalName) ?? "",
        displayName: asTrimmedString(row.displayName) ?? "",
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
        latestReasoning: asTrimmedString(row.latestReasoning) ?? "",
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
