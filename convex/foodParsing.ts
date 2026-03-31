/**
 * Server-side food matching pipeline.
 *
 * The old architecture used deterministic registry lookup first and a
 * client-triggered LLM action as the normal unresolved path. This file now
 * owns the matching pipeline on the server:
 *
 * 1. cheap deterministic pre-processing
 * 2. fuzzy search over the shared food registry + learned aliases
 * 3. embedding search over a Convex vector index
 * 4. confidence routing into auto-map, candidate review, or bucket choice
 * 5. LLM fallback only for low-confidence structurally ambiguous phrases
 *
 * Evidence still waits 6 hours and continues to use `canonicalName` as the
 * downstream contract.
 */

import { ConvexError, v } from "convex/values";
import {
  createFoodMatcherContext,
  type FoodMatchBucketOption,
  type FoodMatchCandidate,
  type FoodSearchDocument,
  fuzzySearchFoodCandidates,
  getFoodEmbeddingSourceHash,
  isStructurallyAmbiguousPhrase,
  type LearnedFoodAlias,
  mergeFoodMatchCandidates,
  normalizeFoodMatchText,
  type PreprocessedFoodPhrase,
  preprocessMealText,
  routeFoodMatchConfidence,
  searchFoodDocuments,
} from "../shared/foodMatching";
import { getFoodZone, isCanonicalFood } from "../shared/foodRegistry";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { requireAuth } from "./lib/auth";
import { addToKnownFoods } from "./lib/knownFoods";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const EVIDENCE_WINDOW_MS = 6 * 60 * 60 * 1000;
const OPENAI_EMBEDDING_MODEL = "text-embedding-3-small";
const OPENAI_FALLBACK_MODEL = "gpt-4o-mini";
const OPENAI_API_URL = "https://api.openai.com/v1";
const EMBEDDING_DIMENSIONS = 1536;

/**
 * Static matcher context created with an empty aliases array. Learned aliases
 * are loaded from the DB at runtime and passed to createFoodMatcherContext()
 * per-request (see processLogInternal and searchFoods). This static instance
 * is only used for registry-only lookups (e.g. embedding staleness check,
 * resolveItem candidate lookup via documentMap).
 */
const STATIC_MATCHER_CONTEXT = createFoodMatcherContext([]);

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ProcessedFoodItem {
  userSegment: string;
  parsedName: string;
  quantity: number | null;
  unit: string | null;
  quantityText?: string | null | undefined;
  canonicalName?: string;
  resolvedBy?: "registry" | "llm" | "heuristic" | "fuzzy" | "user" | "expired";
  recoveryStage?: 1 | 2 | 3;
  bucketKey?: string;
  bucketLabel?: string;
  matchConfidence?: number;
  matchStrategy?: "alias" | "fuzzy" | "embedding" | "combined" | "llm" | "user";
  matchCandidates?: FoodMatchCandidate[] | undefined;
  bucketOptions?: FoodMatchBucketOption[] | undefined;
  defaultPortionDisplay?: string;
  preparation?: string;
  spiceLevel?: "plain" | "mild" | "spicy";
  // Legacy fields preserved for compatibility with older UI/helpers.
  name?: string;
  rawName?: string | null;
}

/**
 * Write-side variant of ProcessedFoodItem. Derived from ProcessedFoodItem but
 * with matchCandidates and bucketOptions expanded to plain object literals
 * (required by the Convex validator — it cannot accept class instances or
 * branded types from FoodMatchCandidate/FoodMatchBucketOption). Legacy-only
 * fields (name, rawName, defaultPortionDisplay, preparation, spiceLevel) are
 * omitted because they are never written by the pipeline.
 */
// TODO: derive from validator using Infer<> to keep in sync
type WriteProcessedFoodItem = Omit<
  ProcessedFoodItem,
  | "matchCandidates"
  | "bucketOptions"
  | "quantityText"
  | "name"
  | "rawName"
  | "defaultPortionDisplay"
  | "preparation"
  | "spiceLevel"
> & {
  // Narrowed from ProcessedFoodItem's `string | null | undefined` to match
  // the Convex validator which only accepts `string | null` (not undefined).
  quantityText?: string | null;
  matchCandidates?: Array<{
    canonicalName: string;
    zone: 1 | 2 | 3;
    group: "protein" | "carbs" | "fats" | "seasoning";
    line:
      | "meat_fish"
      | "eggs_dairy"
      | "vegetable_protein"
      | "grains"
      | "vegetables"
      | "fruit"
      | "oils"
      | "dairy_fats"
      | "nuts_seeds"
      | "sauces_condiments"
      | "herbs_spices";
    bucketKey: string;
    bucketLabel: string;
    resolver: "alias" | "fuzzy" | "embedding" | "combined" | "llm";
    combinedConfidence: number;
    fuzzyScore: number | null;
    embeddingScore: number | null;
    examples: string[];
  }>;
  bucketOptions?: Array<{
    bucketKey: string;
    bucketLabel: string;
    canonicalOptions: string[];
    bestConfidence: number;
  }>;
};

interface FoodLogData {
  rawInput?: string;
  items: Array<Record<string, unknown>>;
  notes?: string;
  mealSlot?: "breakfast" | "lunch" | "dinner" | "snack";
  evidenceProcessedAt?: number;
  itemsVersion?: number;
}

interface FoodLogSnapshot {
  logId: Id<"logs">;
  userId: string;
  rawInput: string;
}

interface OpenAiEmbeddingResponse {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
}

interface OpenAiChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

interface FoodSearchOptionResult {
  canonicalName: string;
  zone: 1 | 2 | 3;
  group: "protein" | "carbs" | "fats" | "seasoning";
  bucketKey: string;
  examples: string[];
}

type FoodEmbeddingVersionRow = {
  canonicalName: string;
  embeddingSourceHash?: string;
};

// ─── Validation helpers for isProcessedFoodItem ─────────────────────────────

const VALID_RESOLVED_BY: ReadonlySet<unknown> = new Set([
  "registry",
  "llm",
  "heuristic",
  "fuzzy",
  "user",
  "expired",
]);
const VALID_RECOVERY_STAGE: ReadonlySet<unknown> = new Set([1, 2, 3]);
const VALID_MATCH_STRATEGY: ReadonlySet<unknown> = new Set([
  "alias",
  "fuzzy",
  "embedding",
  "combined",
  "llm",
  "user",
]);
const VALID_SPICE_LEVEL: ReadonlySet<unknown> = new Set([
  "plain",
  "mild",
  "spicy",
]);
const VALID_CANDIDATE_RESOLVER: ReadonlySet<unknown> = new Set([
  "alias",
  "fuzzy",
  "embedding",
  "combined",
  "llm",
]);
const VALID_ZONE: ReadonlySet<unknown> = new Set([1, 2, 3]);
const VALID_GROUP: ReadonlySet<unknown> = new Set([
  "protein",
  "carbs",
  "fats",
  "seasoning",
]);
const VALID_LINE: ReadonlySet<unknown> = new Set([
  "meat_fish",
  "eggs_dairy",
  "vegetable_protein",
  "grains",
  "vegetables",
  "fruit",
  "oils",
  "dairy_fats",
  "nuts_seeds",
  "sauces_condiments",
  "herbs_spices",
]);

function isStringOrNullOrUndefined(value: unknown): boolean {
  return value === undefined || value === null || typeof value === "string";
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

function isOptionalNumber(value: unknown): boolean {
  return (
    value === undefined || (typeof value === "number" && Number.isFinite(value))
  );
}

function isOptionalLiteral(
  value: unknown,
  validSet: ReadonlySet<unknown>,
): boolean {
  return value === undefined || validSet.has(value);
}

function isValidMatchCandidate(candidate: unknown): boolean {
  if (typeof candidate !== "object" || candidate === null) return false;
  const c = candidate as Record<string, unknown>;
  return (
    typeof c.canonicalName === "string" &&
    VALID_ZONE.has(c.zone) &&
    VALID_GROUP.has(c.group) &&
    VALID_LINE.has(c.line) &&
    typeof c.bucketKey === "string" &&
    typeof c.bucketLabel === "string" &&
    VALID_CANDIDATE_RESOLVER.has(c.resolver) &&
    typeof c.combinedConfidence === "number" &&
    Number.isFinite(c.combinedConfidence) &&
    (c.fuzzyScore === null ||
      (typeof c.fuzzyScore === "number" && Number.isFinite(c.fuzzyScore))) &&
    (c.embeddingScore === null ||
      (typeof c.embeddingScore === "number" &&
        Number.isFinite(c.embeddingScore))) &&
    Array.isArray(c.examples) &&
    c.examples.every((ex: unknown) => typeof ex === "string")
  );
}

function isValidBucketOption(option: unknown): boolean {
  if (typeof option !== "object" || option === null) return false;
  const o = option as Record<string, unknown>;
  return (
    typeof o.bucketKey === "string" &&
    typeof o.bucketLabel === "string" &&
    typeof o.bestConfidence === "number" &&
    Number.isFinite(o.bestConfidence) &&
    Array.isArray(o.canonicalOptions) &&
    o.canonicalOptions.every((opt: unknown) => typeof opt === "string")
  );
}

/**
 * Full runtime type guard for ProcessedFoodItem. Validates ALL fields —
 * required fields must exist with the correct type, optional fields must be
 * undefined or the correct type/shape. Used instead of an unsafe cast when
 * reading items from the database.
 */
function isProcessedFoodItem(item: unknown): item is ProcessedFoodItem {
  if (typeof item !== "object" || item === null) return false;
  const record = item as Record<string, unknown>;

  // Required fields
  if (typeof record.userSegment !== "string") return false;
  if (typeof record.parsedName !== "string") return false;
  if (
    record.quantity !== null &&
    (typeof record.quantity !== "number" || !Number.isFinite(record.quantity))
  )
    return false;
  if (record.unit !== null && typeof record.unit !== "string") return false;

  // Optional scalar fields
  if (!isStringOrNullOrUndefined(record.quantityText)) return false;
  if (!isOptionalString(record.canonicalName)) return false;
  if (!isOptionalLiteral(record.resolvedBy, VALID_RESOLVED_BY)) return false;
  if (!isOptionalLiteral(record.recoveryStage, VALID_RECOVERY_STAGE))
    return false;
  if (!isOptionalString(record.bucketKey)) return false;
  if (!isOptionalString(record.bucketLabel)) return false;
  if (!isOptionalNumber(record.matchConfidence)) return false;
  if (!isOptionalLiteral(record.matchStrategy, VALID_MATCH_STRATEGY))
    return false;
  if (!isOptionalString(record.defaultPortionDisplay)) return false;
  if (!isOptionalString(record.preparation)) return false;
  if (!isOptionalLiteral(record.spiceLevel, VALID_SPICE_LEVEL)) return false;
  if (!isOptionalString(record.name)) return false;
  if (!isStringOrNullOrUndefined(record.rawName)) return false;

  // Optional array fields: matchCandidates
  if (record.matchCandidates !== undefined) {
    if (!Array.isArray(record.matchCandidates)) return false;
    if (!record.matchCandidates.every(isValidMatchCandidate)) return false;
  }

  // Optional array fields: bucketOptions
  if (record.bucketOptions !== undefined) {
    if (!Array.isArray(record.bucketOptions)) return false;
    if (!record.bucketOptions.every(isValidBucketOption)) return false;
  }

  return true;
}

/**
 * Runtime shape check for items read from the database. The schema stores items
 * as Record<string, unknown>[] but writeProcessedItems always writes the
 * ProcessedFoodItem shape. This guard validates ALL fields on ProcessedFoodItem
 * so we fail loudly on corrupt data rather than silently misinterpreting it.
 * Items that fail validation are warned about and excluded from the result.
 */
function assertProcessedFoodItems(
  items: Array<Record<string, unknown>>,
): ProcessedFoodItem[] {
  const validated: ProcessedFoodItem[] = [];

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (isProcessedFoodItem(item)) {
      validated.push(item);
    } else {
      console.warn(
        `assertProcessedFoodItems: item at index ${i} failed ProcessedFoodItem validation and will be excluded. ` +
          `This may indicate corrupt or pre-migration data. ` +
          `Fields present: ${Object.keys(item).join(", ")}`,
      );
    }
  }

  return validated;
}

// ─────────────────────────────────────────────────────────────────────────────
// Queries and mutations used by the action pipeline
// ─────────────────────────────────────────────────────────────────────────────

async function listFoodAliasesForUserFromDb(
  ctx: Pick<QueryCtx, "db">,
  userId: string,
): Promise<LearnedFoodAlias[]> {
  const globalAliases = await ctx.db
    .query("foodAliases")
    .withIndex("by_userId_normalizedAlias", (q) => q.eq("userId", null))
    .collect();
  const userAliases = await ctx.db
    .query("foodAliases")
    .withIndex("by_userId_normalizedAlias", (q) => q.eq("userId", userId))
    .collect();

  return [...globalAliases, ...userAliases].map((alias) => ({
    aliasText: alias.aliasText,
    normalizedAlias: alias.normalizedAlias,
    canonicalName: alias.canonicalName,
    userId: alias.userId,
  }));
}

export const getFoodLogForProcessing = internalQuery({
  args: { logId: v.id("logs") },
  handler: async (ctx, args): Promise<FoodLogSnapshot | null> => {
    const log = await ctx.db.get(args.logId);
    if (!log || log.type !== "food") return null;

    const data = log.data as FoodLogData;
    if (!data.rawInput || typeof data.rawInput !== "string") return null;

    return {
      logId: log._id,
      userId: log.userId,
      rawInput: data.rawInput,
    };
  },
});

/**
 * Read the food log's userId and current itemsVersion for the LLM matching
 * action's optimistic concurrency check.
 */
export const getFoodLogVersionInfo = internalQuery({
  args: { logId: v.id("logs") },
  handler: async (
    ctx,
    args,
  ): Promise<{ userId: string; itemsVersion: number } | null> => {
    const log = await ctx.db.get(args.logId);
    if (!log || log.type !== "food") return null;

    const data = log.data as FoodLogData;
    return {
      userId: log.userId,
      itemsVersion: data.itemsVersion ?? 0,
    };
  },
});

export const listFoodAliasesForUser = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args): Promise<LearnedFoodAlias[]> => {
    return await listFoodAliasesForUserFromDb(ctx, args.userId);
  },
});

export const listFoodEmbeddings = internalQuery({
  args: {},
  handler: async (ctx): Promise<Doc<"foodEmbeddings">[]> => {
    // Known performance concern: Convex does not support field projection on
    // queries, so this pulls full documents including 1536-dim embedding vectors
    // even though ensureFoodEmbeddings() only needs canonicalName and
    // embeddingSourceHash for the staleness check. A .take(1000) safety bound
    // prevents unbounded growth if the registry expands unexpectedly.
    const results = await ctx.db.query("foodEmbeddings").take(1000);
    if (results.length === 1000) {
      console.warn(
        "listFoodEmbeddings: result count equals 1000 — results may be truncated. " +
          "Consider increasing the limit or paginating.",
      );
    }
    return results;
  },
});

export const getFoodEmbeddingsByIds = internalQuery({
  args: { ids: v.array(v.id("foodEmbeddings")) },
  handler: async (ctx, args): Promise<Doc<"foodEmbeddings">[]> => {
    const rows = await Promise.all(args.ids.map((id) => ctx.db.get(id)));
    return rows.filter((row): row is Doc<"foodEmbeddings"> => row !== null);
  },
});

/**
 * Check if a specific alias embedding already exists with the given hash.
 * Used by embedAliasInternal to avoid fetching all embeddings for a staleness check.
 */
export const isAliasEmbeddingCurrent = internalQuery({
  args: {
    canonicalName: v.string(),
    aliasText: v.string(),
    embeddingSourceHash: v.string(),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const candidates = await ctx.db
      .query("foodEmbeddings")
      .withIndex("by_canonicalName", (q) => q.eq("canonicalName", args.canonicalName))
      .collect();

    return candidates.some(
      (row) =>
        row.sourceType === "alias" &&
        row.sourceText === args.aliasText &&
        row.embeddingSourceHash === args.embeddingSourceHash,
    );
  },
});

export const upsertFoodEmbeddings = internalMutation({
  args: {
    rows: v.array(
      v.object({
        canonicalName: v.string(),
        sourceText: v.optional(v.string()),
        sourceType: v.optional(
          v.union(v.literal("registry"), v.literal("alias")),
        ),
        zone: v.union(v.literal(1), v.literal(2), v.literal(3)),
        group: v.union(
          v.literal("protein"),
          v.literal("carbs"),
          v.literal("fats"),
          v.literal("seasoning"),
        ),
        line: v.union(
          v.literal("meat_fish"),
          v.literal("eggs_dairy"),
          v.literal("vegetable_protein"),
          v.literal("grains"),
          v.literal("vegetables"),
          v.literal("fruit"),
          v.literal("oils"),
          v.literal("dairy_fats"),
          v.literal("nuts_seeds"),
          v.literal("sauces_condiments"),
          v.literal("herbs_spices"),
        ),
        bucketKey: v.string(),
        bucketLabel: v.string(),
        embedding: v.array(v.float64()),
        embeddingSourceHash: v.optional(v.string()),
        updatedAt: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    // Sequential DB ops are intentional here: Convex mutations are
    // transactional, so each iteration runs within the same transaction.
    // Batching is handled by the caller (ensureFoodEmbeddings) which collects
    // all rows needing refresh and passes them in a single mutation call.
    for (const row of args.rows) {
      // For registry entries: match by canonicalName where sourceType is
      // "registry" or undefined (backward compat with pre-sourceType rows).
      // For alias entries: match by canonicalName + sourceText to allow
      // multiple alias embeddings per canonical food.
      const candidates = await ctx.db
        .query("foodEmbeddings")
        .withIndex("by_canonicalName", (q) =>
          q.eq("canonicalName", row.canonicalName),
        )
        .collect();

      const isAlias = row.sourceType === "alias";
      const existing = isAlias
        ? candidates.find(
            (c) => c.sourceType === "alias" && c.sourceText === row.sourceText,
          )
        : candidates.find(
            (c) => c.sourceType === "registry" || c.sourceType === undefined,
          );

      if (existing) {
        await ctx.db.patch(existing._id, row);
        continue;
      }

      await ctx.db.insert("foodEmbeddings", row);
    }
  },
});

export const writeProcessedItems = internalMutation({
  args: {
    logId: v.id("logs"),
    items: v.array(
      v.object({
        userSegment: v.string(),
        parsedName: v.string(),
        quantity: v.union(v.number(), v.null()),
        unit: v.union(v.string(), v.null()),
        quantityText: v.optional(v.union(v.string(), v.null())),
        canonicalName: v.optional(v.string()),
        resolvedBy: v.optional(
          v.union(
            v.literal("registry"),
            v.literal("llm"),
            v.literal("heuristic"),
            v.literal("fuzzy"),
            v.literal("user"),
            v.literal("expired"),
          ),
        ),
        recoveryStage: v.optional(
          v.union(v.literal(1), v.literal(2), v.literal(3)),
        ),
        bucketKey: v.optional(v.string()),
        bucketLabel: v.optional(v.string()),
        matchConfidence: v.optional(v.number()),
        matchStrategy: v.optional(
          v.union(
            v.literal("alias"),
            v.literal("fuzzy"),
            v.literal("embedding"),
            v.literal("combined"),
            v.literal("llm"),
            v.literal("user"),
          ),
        ),
        matchCandidates: v.optional(
          v.array(
            v.object({
              canonicalName: v.string(),
              zone: v.union(v.literal(1), v.literal(2), v.literal(3)),
              group: v.union(
                v.literal("protein"),
                v.literal("carbs"),
                v.literal("fats"),
                v.literal("seasoning"),
              ),
              line: v.union(
                v.literal("meat_fish"),
                v.literal("eggs_dairy"),
                v.literal("vegetable_protein"),
                v.literal("grains"),
                v.literal("vegetables"),
                v.literal("fruit"),
                v.literal("oils"),
                v.literal("dairy_fats"),
                v.literal("nuts_seeds"),
                v.literal("sauces_condiments"),
                v.literal("herbs_spices"),
              ),
              bucketKey: v.string(),
              bucketLabel: v.string(),
              resolver: v.union(
                v.literal("alias"),
                v.literal("fuzzy"),
                v.literal("embedding"),
                v.literal("combined"),
                v.literal("llm"),
              ),
              combinedConfidence: v.number(),
              fuzzyScore: v.union(v.number(), v.null()),
              embeddingScore: v.union(v.number(), v.null()),
              examples: v.array(v.string()),
            }),
          ),
        ),
        bucketOptions: v.optional(
          v.array(
            v.object({
              bucketKey: v.string(),
              bucketLabel: v.string(),
              canonicalOptions: v.array(v.string()),
              bestConfidence: v.number(),
            }),
          ),
        ),
      }),
    ),
  },
  handler: async (ctx, args) => {
    // Validate numeric fields on items before writing to DB
    for (let i = 0; i < args.items.length; i += 1) {
      const item = args.items[i];
      if (
        item.quantity !== null &&
        (!Number.isFinite(item.quantity) || item.quantity <= 0)
      ) {
        throw new Error(
          `writeProcessedItems: item[${i}] quantity must be a positive finite number or null, got ${item.quantity}`,
        );
      }
      if (
        item.matchConfidence !== undefined &&
        (!Number.isFinite(item.matchConfidence) ||
          item.matchConfidence < 0 ||
          item.matchConfidence > 1)
      ) {
        throw new Error(
          `writeProcessedItems: item[${i}] matchConfidence must be a finite number between 0 and 1, got ${item.matchConfidence}`,
        );
      }
    }

    const log = await ctx.db.get(args.logId);
    if (!log || log.type !== "food") return;

    const data = log.data as FoodLogData;
    const nextVersion = (data.itemsVersion ?? 0) + 1;

    await ctx.db.patch(args.logId, {
      data: {
        ...data,
        items: args.items,
        itemsVersion: nextVersion,
      } as typeof log.data,
    });

    // Add resolved canonical names to the user's knownFoods set (WQ-302).
    // This avoids unbounded historical scans in weeklyDigest.
    const resolvedNames = args.items
      .filter(
        (item) =>
          item.canonicalName !== undefined &&
          item.canonicalName !== "" &&
          item.canonicalName !== "unknown_food" &&
          item.resolvedBy !== undefined &&
          item.resolvedBy !== "expired",
      )
      .map((item) => item.canonicalName as string);
    if (resolvedNames.length > 0) {
      await addToKnownFoods(ctx, log.userId, resolvedNames);
    }
  },
});

export const searchFoods = query({
  args: {
    query: v.string(),
    bucketKey: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<FoodSearchOptionResult[]> => {
    const { userId } = await requireAuth(ctx);
    const aliases = await listFoodAliasesForUserFromDb(ctx, userId);
    const matcherContext = createFoodMatcherContext(aliases);
    // Capped at 80 results to bound query cost; clients should paginate for more.
    // Guard against NaN/Infinity — fall back to default if the input is not a finite positive number.
    const rawLimit = args.limit ?? 80;
    const limit =
      Number.isFinite(rawLimit) && rawLimit > 0
        ? Math.max(1, Math.min(Math.floor(rawLimit), 80))
        : 80;
    const documents = searchFoodDocuments(args.query, matcherContext, {
      ...(args.bucketKey ? { bucketKey: args.bucketKey } : {}),
      limit,
    });

    return documents.map((document) => ({
      canonicalName: document.canonicalName,
      zone: document.zone,
      group: document.group,
      bucketKey: document.bucketKey,
      examples: [...document.examples],
    }));
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// OpenAI helpers
// ─────────────────────────────────────────────────────────────────────────────

function getServerOpenAiApiKey(): string | null {
  const apiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
  if (!apiKey) {
    // TODO(review): decide whether missing OPENAI_API_KEY should hard-fail the
    // semantic layer instead of allowing fuzzy-only matching in development.
    return null;
  }
  return apiKey;
}

async function fetchOpenAiEmbeddings(
  texts: ReadonlyArray<string>,
  apiKey: string,
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const response = await fetch(`${OPENAI_API_URL}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_EMBEDDING_MODEL,
      input: texts,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `OpenAI embeddings request failed (${response.status} ${response.statusText})`,
    );
  }

  const json = (await response.json()) as OpenAiEmbeddingResponse;
  return json.data
    .sort((a, b) => a.index - b.index)
    .map((item) => item.embedding);
}

async function fetchLlmFallbackChoice(
  phrase: string,
  candidates: ReadonlyArray<FoodMatchCandidate>,
  apiKey: string,
): Promise<string | null> {
  if (candidates.length === 0) return null;

  const response = await fetch(`${OPENAI_API_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_FALLBACK_MODEL,
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "You choose the closest food registry canonical from a short list. Reply with the exact canonical name or the single word none.",
        },
        {
          role: "user",
          content: JSON.stringify({
            phrase,
            candidates: candidates.slice(0, 3).map((candidate) => ({
              canonicalName: candidate.canonicalName,
              zone: candidate.zone,
              group: candidate.group,
              line: candidate.line,
              bucketLabel: candidate.bucketLabel,
              confidence: candidate.combinedConfidence,
              examples: candidate.examples.slice(0, 4),
            })),
            instruction:
              "Which is most appropriate? If none apply, reply 'none'.",
          }),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(
      `OpenAI fallback request failed (${response.status} ${response.statusText})`,
    );
  }

  const json = (await response.json()) as OpenAiChatCompletionResponse;
  const content = json.choices?.[0]?.message?.content?.trim() ?? "";
  if (!content) return null;

  const normalized = normalizeFoodMatchText(
    content.replace(/^["']|["']$/g, ""),
  );
  if (normalized === "none") return null;

  const matchedCandidate = candidates.find(
    (candidate) =>
      normalizeFoodMatchText(candidate.canonicalName) === normalized,
  );
  return matchedCandidate?.canonicalName ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Matching helpers
// ─────────────────────────────────────────────────────────────────────────────

function toResolvedItem(
  phrase: PreprocessedFoodPhrase,
  candidate: FoodMatchCandidate,
  resolvedBy: "registry" | "llm",
): ProcessedFoodItem {
  const zone = getFoodZone(candidate.canonicalName);
  return {
    userSegment: phrase.rawPhrase,
    parsedName: phrase.parsedName,
    quantity: phrase.quantity,
    unit: phrase.unit,
    ...(phrase.quantityText !== null && { quantityText: phrase.quantityText }),
    canonicalName: candidate.canonicalName,
    resolvedBy,
    ...(zone !== undefined && { recoveryStage: zone }),
    bucketKey: candidate.bucketKey,
    bucketLabel: candidate.bucketLabel,
    matchConfidence: candidate.combinedConfidence,
    matchStrategy: resolvedBy === "llm" ? "llm" : candidate.resolver,
  };
}

function toPendingItem(
  phrase: PreprocessedFoodPhrase,
  route: ReturnType<typeof routeFoodMatchConfidence>,
): ProcessedFoodItem {
  const topBucket = route.buckets[0];
  return {
    userSegment: phrase.rawPhrase,
    parsedName: phrase.parsedName,
    quantity: phrase.quantity,
    unit: phrase.unit,
    ...(phrase.quantityText !== null && { quantityText: phrase.quantityText }),
    ...(topBucket && {
      bucketKey: topBucket.bucketKey,
      bucketLabel: topBucket.bucketLabel,
    }),
    ...(route.topCandidate && {
      matchConfidence: route.topCandidate.combinedConfidence,
    }),
    ...(route.topCandidate && { matchStrategy: route.topCandidate.resolver }),
    ...(route.candidates.length > 0 && {
      matchCandidates: route.candidates.map((candidate) => ({
        ...candidate,
        examples: [...candidate.examples],
      })),
    }),
    ...(route.buckets.length > 0 && {
      bucketOptions: route.buckets.map((bucket) => ({
        ...bucket,
        canonicalOptions: [...bucket.canonicalOptions],
      })),
    }),
  };
}

function serializeProcessedItem(
  item: ProcessedFoodItem,
): WriteProcessedFoodItem {
  return {
    userSegment: item.userSegment,
    parsedName: item.parsedName,
    quantity: item.quantity,
    unit: item.unit,
    ...(item.quantityText !== undefined && { quantityText: item.quantityText }),
    ...(item.canonicalName !== undefined && {
      canonicalName: item.canonicalName,
    }),
    ...(item.resolvedBy !== undefined && { resolvedBy: item.resolvedBy }),
    ...(item.recoveryStage !== undefined && {
      recoveryStage: item.recoveryStage,
    }),
    ...(item.bucketKey !== undefined && { bucketKey: item.bucketKey }),
    ...(item.bucketLabel !== undefined && { bucketLabel: item.bucketLabel }),
    ...(item.matchConfidence !== undefined && {
      matchConfidence: item.matchConfidence,
    }),
    ...(item.matchStrategy !== undefined && {
      matchStrategy: item.matchStrategy,
    }),
    ...(item.matchCandidates !== undefined && {
      matchCandidates: item.matchCandidates.map((candidate) => ({
        ...candidate,
        examples: [...candidate.examples],
      })),
    }),
    ...(item.bucketOptions !== undefined && {
      bucketOptions: item.bucketOptions.map((bucket) => ({
        ...bucket,
        canonicalOptions: [...bucket.canonicalOptions],
      })),
    }),
  };
}

export function getFoodDocumentsNeedingEmbeddingRefresh(
  documents: ReadonlyArray<FoodSearchDocument>,
  existingRows: ReadonlyArray<FoodEmbeddingVersionRow>,
): FoodSearchDocument[] {
  const existingHashesByCanonical = new Map(
    existingRows.map((row) => [row.canonicalName, row.embeddingSourceHash]),
  );

  return documents.filter((document) => {
    return (
      existingHashesByCanonical.get(document.canonicalName) !==
      document.embeddingSourceHash
    );
  });
}

async function ensureFoodEmbeddings(ctx: ActionCtx): Promise<boolean> {
  const apiKey = getServerOpenAiApiKey();
  if (!apiKey) return false;

  const existingRows = await ctx.runQuery(
    internal.foodParsing.listFoodEmbeddings,
    {},
  );
  const documentsNeedingRefresh = getFoodDocumentsNeedingEmbeddingRefresh(
    STATIC_MATCHER_CONTEXT.documents,
    existingRows,
  );
  if (documentsNeedingRefresh.length === 0) return true;

  const embeddings = await fetchOpenAiEmbeddings(
    documentsNeedingRefresh.map((document) => document.embeddingText),
    apiKey,
  );

  await ctx.runMutation(internal.foodParsing.upsertFoodEmbeddings, {
    rows: documentsNeedingRefresh.map((document, index) => ({
      canonicalName: document.canonicalName,
      sourceText: document.embeddingText,
      sourceType: "registry" as const,
      zone: document.zone,
      group: document.group,
      line: document.line,
      bucketKey: document.bucketKey,
      bucketLabel: document.bucketLabel,
      embedding: embeddings[index] ?? Array(EMBEDDING_DIMENSIONS).fill(0),
      embeddingSourceHash: document.embeddingSourceHash,
      updatedAt: Date.now(),
    })),
  });

  return true;
}

/**
 * Explicitly seed all registry embeddings. Safe to call multiple times —
 * only embeds entries that are missing or whose source text has changed.
 * Intended to be called from the Convex dashboard or a deploy hook.
 */
export const seedRegistryEmbeddings = internalAction({
  args: {},
  handler: async (ctx) => {
    const success = await ensureFoodEmbeddings(ctx);
    if (!success) {
      console.error(
        "seedRegistryEmbeddings: failed — OPENAI_API_KEY is not set.",
      );
    } else {
      console.log(
        `seedRegistryEmbeddings: seeded/refreshed embeddings for ${STATIC_MATCHER_CONTEXT.documents.length} registry entries.`,
      );
    }
    return success;
  },
});

/**
 * Embed a learned user alias so future misspellings resolve via vector
 * similarity. Scheduled from resolveItem after upsertLearnedAlias.
 *
 * The alias text is embedded directly (not the structured registry text),
 * but the row inherits zone/group/line/bucket from the canonical food it
 * maps to. This means vector search returns the correct canonical even
 * when the query text is a brand name or voice-to-text misspelling.
 */
export const embedAliasInternal = internalAction({
  args: {
    aliasText: v.string(),
    canonicalName: v.string(),
  },
  handler: async (ctx, args) => {
    const apiKey = getServerOpenAiApiKey();
    if (!apiKey) {
      console.warn(
        `embedAliasInternal: skipping alias "${args.aliasText}" — no OPENAI_API_KEY.`,
      );
      return;
    }

    // Look up the canonical food's metadata from the registry.
    const document = STATIC_MATCHER_CONTEXT.documentMap.get(args.canonicalName);
    if (!document) {
      console.warn(
        `embedAliasInternal: canonical "${args.canonicalName}" not found in registry. Skipping.`,
      );
      return;
    }

    const sourceHash = getFoodEmbeddingSourceHash(args.aliasText);

    // Check if this exact alias is already embedded with the same hash.
    // Uses a targeted query by canonicalName index instead of fetching all embeddings.
    const alreadyEmbedded = await ctx.runQuery(
      internal.foodParsing.isAliasEmbeddingCurrent,
      {
        canonicalName: args.canonicalName,
        aliasText: args.aliasText,
        embeddingSourceHash: sourceHash,
      },
    );
    if (alreadyEmbedded) return;

    const embeddings = await fetchOpenAiEmbeddings([args.aliasText], apiKey);
    const embedding = embeddings[0];
    if (!embedding || embedding.length !== EMBEDDING_DIMENSIONS) {
      console.error(
        `embedAliasInternal: embedding response invalid for alias "${args.aliasText}".`,
      );
      return;
    }

    await ctx.runMutation(internal.foodParsing.upsertFoodEmbeddings, {
      rows: [
        {
          canonicalName: args.canonicalName,
          sourceText: args.aliasText,
          sourceType: "alias" as const,
          zone: document.zone,
          group: document.group,
          line: document.line,
          bucketKey: document.bucketKey,
          bucketLabel: document.bucketLabel,
          embedding,
          embeddingSourceHash: sourceHash,
          updatedAt: Date.now(),
        },
      ],
    });
  },
});

async function searchEmbeddingCandidates(
  ctx: ActionCtx,
  embedding: number[] | null,
): Promise<Array<{ canonicalName: string; embeddingScore: number }>> {
  if (!embedding || embedding.length !== EMBEDDING_DIMENSIONS) return [];

  const matches = await ctx.vectorSearch("foodEmbeddings", "by_embedding", {
    vector: embedding,
    limit: 5,
  });
  if (matches.length === 0) return [];

  const rows: Doc<"foodEmbeddings">[] = await ctx.runQuery(
    internal.foodParsing.getFoodEmbeddingsByIds,
    {
      ids: matches.map((match) => match._id),
    },
  );
  const rowMap = new Map(rows.map((row) => [row._id, row]));

  return matches
    .map((match) => {
      const row = rowMap.get(match._id);
      if (!row) return null;
      return {
        canonicalName: row.canonicalName,
        embeddingScore: Math.max(0, Math.min(1, (match._score + 1) / 2)),
      };
    })
    .filter(
      (
        candidate,
      ): candidate is { canonicalName: string; embeddingScore: number } =>
        candidate !== null,
    );
}

async function tryLlmFallback(
  phrase: PreprocessedFoodPhrase,
  candidates: ReadonlyArray<FoodMatchCandidate>,
): Promise<FoodMatchCandidate | null> {
  const apiKey = getServerOpenAiApiKey();
  if (!apiKey || candidates.length === 0) return null;

  const canonicalName = await fetchLlmFallbackChoice(
    phrase.parsedName,
    candidates,
    apiKey,
  );
  if (!canonicalName) return null;

  const matchedCandidate = candidates.find(
    (candidate) => candidate.canonicalName === canonicalName,
  );
  if (!matchedCandidate) return null;

  return {
    ...matchedCandidate,
    resolver: "llm",
    combinedConfidence: Math.max(matchedCandidate.combinedConfidence, 0.6),
  };
}

async function upsertLearnedAlias(
  ctx: MutationCtx,
  userId: string,
  aliasText: string,
  canonicalName: string,
  source: "user" | "bucket",
  now?: number,
): Promise<void> {
  const normalizedAlias = normalizeFoodMatchText(aliasText);
  if (!normalizedAlias) return;

  const existing = await ctx.db
    .query("foodAliases")
    .withIndex("by_userId_normalizedAlias", (q) =>
      q.eq("userId", userId).eq("normalizedAlias", normalizedAlias),
    )
    .unique();

  const timestamp = now ?? Date.now();
  if (existing) {
    await ctx.db.patch(existing._id, {
      aliasText,
      canonicalName,
      source,
      updatedAt: timestamp,
    });
    return;
  }

  await ctx.db.insert("foodAliases", {
    aliasText,
    normalizedAlias,
    canonicalName,
    userId,
    source,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export const processLog = mutation({
  args: { logId: v.id("logs") },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);

    const log = await ctx.db.get(args.logId);
    if (!log) throw new Error("Log not found");
    if (log.type !== "food") throw new Error("Log is not a food log");
    if (log.userId !== userId) {
      throw new Error("Not authorized to process this log");
    }

    await ctx.scheduler.runAfter(0, internal.foodParsing.processLogInternal, {
      logId: args.logId,
    });
  },
});

export const processLogInternal = internalAction({
  args: { logId: v.id("logs") },
  handler: async (ctx, args) => {
    const snapshot = await ctx.runQuery(
      internal.foodParsing.getFoodLogForProcessing,
      {
        logId: args.logId,
      },
    );
    if (!snapshot) return;

    const phrases = preprocessMealText(snapshot.rawInput);
    if (phrases.length === 0) {
      await ctx.runMutation(internal.foodParsing.writeProcessedItems, {
        logId: snapshot.logId,
        items: [],
      });
      return;
    }

    const learnedAliases = await ctx.runQuery(
      internal.foodParsing.listFoodAliasesForUser,
      {
        userId: snapshot.userId,
      },
    );
    const matcherContext = createFoodMatcherContext(learnedAliases);

    let phraseEmbeddings: number[][] = [];
    try {
      const embeddingsReady = await ensureFoodEmbeddings(ctx);
      const apiKey = getServerOpenAiApiKey();
      if (embeddingsReady && apiKey) {
        phraseEmbeddings = await fetchOpenAiEmbeddings(
          phrases.map((phrase) => phrase.parsedName),
          apiKey,
        );
      }
    } catch (error) {
      console.error(
        "Food embedding layer unavailable. Falling back to fuzzy-only matching.",
        error,
      );
    }

    const items: ProcessedFoodItem[] = [];

    for (let index = 0; index < phrases.length; index += 1) {
      const phrase = phrases[index];
      const fuzzyCandidates = fuzzySearchFoodCandidates(
        phrase.parsedName,
        matcherContext,
      );

      let embeddingCandidates: Array<{
        canonicalName: string;
        embeddingScore: number;
      }> = [];

      try {
        embeddingCandidates = await searchEmbeddingCandidates(
          ctx,
          phraseEmbeddings[index] ?? null,
        );
      } catch (error) {
        console.error(
          `Embedding search failed for phrase "${phrase.parsedName}". Continuing without semantic scores.`,
          error,
        );
      }

      const mergedCandidates = mergeFoodMatchCandidates(
        fuzzyCandidates,
        embeddingCandidates,
        matcherContext,
      );
      const route = routeFoodMatchConfidence(phrase, mergedCandidates);

      if (route.level === "high" && route.topCandidate) {
        items.push(toResolvedItem(phrase, route.topCandidate, "registry"));
        continue;
      }

      if (
        route.level === "low" &&
        isStructurallyAmbiguousPhrase(phrase) &&
        route.candidates.length > 0
      ) {
        try {
          const llmCandidate = await tryLlmFallback(phrase, route.candidates);
          if (llmCandidate) {
            items.push(toResolvedItem(phrase, llmCandidate, "llm"));
            continue;
          }
        } catch (error) {
          console.error(
            `LLM fallback failed for phrase "${phrase.parsedName}". Keeping it unresolved.`,
            error,
          );
        }
      }

      items.push(toPendingItem(phrase, route));
    }

    await ctx.runMutation(internal.foodParsing.writeProcessedItems, {
      logId: snapshot.logId,
      items: items.map(serializeProcessedItem),
    });

    await ctx.scheduler.runAfter(
      EVIDENCE_WINDOW_MS,
      internal.foodParsing.processEvidence,
      {
        logId: snapshot.logId,
      },
    );
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// LLM result application (called by foodLlmMatching.matchUnresolvedItems)
// ─────────────────────────────────────────────────────────────────────────────

export const applyLlmResults = internalMutation({
  args: {
    logId: v.id("logs"),
    userId: v.string(),
    expectedItemsVersion: v.number(),
    now: v.optional(v.number()),
    resolvedItems: v.array(
      v.object({
        userSegment: v.string(),
        parsedName: v.string(),
        canonicalName: v.string(),
        resolvedBy: v.union(v.literal("llm"), v.literal("fuzzy")),
        quantity: v.union(v.number(), v.null()),
        unit: v.union(v.string(), v.null()),
        recoveryStage: v.union(
          v.literal(1),
          v.literal(2),
          v.literal(3),
          v.null(),
        ),
      }),
    ),
  },
  handler: async (ctx, args) => {
    if (
      !Number.isInteger(args.expectedItemsVersion) ||
      args.expectedItemsVersion < 0
    ) {
      throw new Error(
        `expectedItemsVersion must be a non-negative integer, got ${args.expectedItemsVersion}`,
      );
    }

    // Validate quantity fields on resolved items
    for (const item of args.resolvedItems) {
      if (
        item.quantity !== null &&
        (!Number.isFinite(item.quantity) || item.quantity <= 0)
      ) {
        throw new Error(
          `resolvedItem quantity must be a positive finite number or null, got ${item.quantity} for "${item.parsedName}"`,
        );
      }
    }

    const log = await ctx.db.get(args.logId);
    if (!log || log.type !== "food") {
      throw new Error("Log not found or is not a food log");
    }
    if (log.userId !== args.userId) {
      throw new Error("Not authorized to modify this log");
    }

    const data = log.data as FoodLogData;
    const currentVersion = data.itemsVersion ?? 0;

    // Optimistic concurrency: bail if the log was modified since we read it
    if (currentVersion !== args.expectedItemsVersion) {
      throw new Error(
        `Items version mismatch: expected ${args.expectedItemsVersion}, got ${currentVersion}. ` +
          "The log was modified while LLM matching was in progress.",
      );
    }

    if (!data.items || data.items.length === 0) {
      throw new Error("Log has no items to update");
    }

    const currentItems = assertProcessedFoodItems(data.items);

    // Build a map of unresolved item indices by userSegment for efficient lookup.
    // An item is "unresolved" if it has no canonicalName (or it's empty).
    const unresolvedBySegment = new Map<string, number[]>();
    for (let i = 0; i < currentItems.length; i += 1) {
      const item = currentItems[i];
      const hasCanonical =
        item.canonicalName !== null &&
        item.canonicalName !== undefined &&
        item.canonicalName !== "";
      if (!hasCanonical) {
        const indices = unresolvedBySegment.get(item.userSegment) ?? [];
        indices.push(i);
        unresolvedBySegment.set(item.userSegment, indices);
      }
    }

    const updatedItems = [...currentItems];

    // Track which item indices were resolved by LLM in this mutation, so we
    // can create exposures for them if the evidence window already closed.
    const resolvedIndices: number[] = [];

    // Apply resolved items: match each LLM result to an unresolved item by userSegment
    for (const resolved of args.resolvedItems) {
      const indices = unresolvedBySegment.get(resolved.userSegment);
      if (!indices || indices.length === 0) continue;

      // Take the first unresolved index for this segment
      const itemIndex = indices.shift();
      if (itemIndex === undefined) continue;

      // Clean up empty array entries in the map
      if (indices.length === 0) {
        unresolvedBySegment.delete(resolved.userSegment);
      }

      const zone =
        resolved.recoveryStage === 1 ||
        resolved.recoveryStage === 2 ||
        resolved.recoveryStage === 3
          ? resolved.recoveryStage
          : undefined;

      updatedItems[itemIndex] = {
        ...currentItems[itemIndex],
        canonicalName: resolved.canonicalName,
        resolvedBy: resolved.resolvedBy,
        ...(zone !== undefined && { recoveryStage: zone }),
        matchConfidence: 1,
        matchStrategy: resolved.resolvedBy === "fuzzy" ? "fuzzy" : ("llm" as const),
        // Clear candidates/buckets since the item is now resolved
        matchCandidates: undefined,
        bucketOptions: undefined,
      };

      resolvedIndices.push(itemIndex);
    }

    // Write updated items back to the log
    const nextVersion = currentVersion + 1;
    await ctx.db.patch(args.logId, {
      data: {
        ...data,
        items: updatedItems.map(serializeProcessedItem),
        itemsVersion: nextVersion,
      } as typeof log.data,
    });

    // Add LLM-resolved canonical names to the user's knownFoods set (WQ-302).
    const llmResolvedNames = args.resolvedItems.map(
      (item) => item.canonicalName,
    );
    if (llmResolvedNames.length > 0) {
      await addToKnownFoods(ctx, log.userId, llmResolvedNames);
    }

    // If the evidence window has already closed (evidenceProcessedAt is set),
    // processEvidence won't re-run (it guards with `if (data.evidenceProcessedAt != null) return`),
    // so we must create ingredientExposures for the newly resolved items directly.
    // If the window is still open, leave exposure creation to processEvidence to avoid duplicates.
    if (data.evidenceProcessedAt == null) {
      return;
    }

    // Create exposures for items that were just resolved by LLM.
    // resolvedIndices tracks exactly which item positions were updated above.
    for (const itemIndex of resolvedIndices) {
      const item = updatedItems[itemIndex];
      if (
        item.canonicalName === null ||
        item.canonicalName === undefined ||
        item.canonicalName === "" ||
        item.canonicalName === "unknown_food"
      ) {
        continue;
      }

      await ctx.db.insert("ingredientExposures", {
        userId: log.userId,
        logId: args.logId,
        itemIndex,
        logTimestamp: log.timestamp,
        ingredientName: item.userSegment,
        canonicalName: item.canonicalName,
        quantity: item.quantity,
        unit: item.unit,
        ...(item.preparation !== undefined && {
          preparation: item.preparation,
        }),
        ...(item.recoveryStage !== undefined && {
          recoveryStage: item.recoveryStage,
        }),
        ...(item.spiceLevel !== undefined && { spiceLevel: item.spiceLevel }),
        createdAt: args.now ?? Date.now(),
      });
    }
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Evidence processing
// ─────────────────────────────────────────────────────────────────────────────

export const processEvidence = internalMutation({
  args: { logId: v.id("logs"), now: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const log = await ctx.db.get(args.logId);
    if (!log || log.type !== "food") return;

    const data = log.data as FoodLogData;
    if (data.evidenceProcessedAt != null) return;

    const evidenceProcessedAt = args.now ?? Date.now();

    if (!data.items || data.items.length === 0) {
      // No items to process — just mark the evidence window as closed.
      await ctx.db.patch(args.logId, {
        data: { ...data, evidenceProcessedAt } as typeof log.data,
      });
      return;
    }

    const currentItems = assertProcessedFoodItems(data.items);
    const updatedItems: ProcessedFoodItem[] = currentItems.map((item) => {
      if (
        item.canonicalName !== null &&
        item.canonicalName !== undefined &&
        item.canonicalName !== ""
      ) {
        return item;
      }

      return {
        ...item,
        canonicalName: "unknown_food",
        resolvedBy: "expired" as const,
        // Override any existing candidates — they are no longer relevant for
        // expired items. serializeProcessedItem will strip these undefined
        // values via conditional spread when writing to the DB.
        matchCandidates: undefined,
        bucketOptions: undefined,
      };
    });

    // Normalize all items through serializeProcessedItem to ensure consistent
    // data shape (no explicit `undefined` values) before writing to the DB.
    const serializedItems = updatedItems.map(serializeProcessedItem);

    // Single patch: sets both the updated items and the evidence timestamp
    // atomically, avoiding a previous double-patch where the first write
    // set evidenceProcessedAt and the second overwrote the entire data field.
    await ctx.db.patch(args.logId, {
      data: {
        ...data,
        items: serializedItems,
        evidenceProcessedAt,
      } as typeof log.data,
    });

    for (let i = 0; i < updatedItems.length; i += 1) {
      const item = updatedItems[i];
      if (
        item.canonicalName === null ||
        item.canonicalName === undefined ||
        item.canonicalName === "" ||
        item.canonicalName === "unknown_food"
      ) {
        continue;
      }

      await ctx.db.insert("ingredientExposures", {
        userId: log.userId,
        logId: args.logId,
        itemIndex: i,
        logTimestamp: log.timestamp,
        ingredientName: item.userSegment,
        canonicalName: item.canonicalName,
        quantity: item.quantity,
        unit: item.unit,
        ...(item.preparation !== undefined && {
          preparation: item.preparation,
        }),
        ...(item.recoveryStage !== undefined && {
          recoveryStage: item.recoveryStage,
        }),
        ...(item.spiceLevel !== undefined && { spiceLevel: item.spiceLevel }),
        createdAt: evidenceProcessedAt,
      });
    }
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Manual resolution
// ─────────────────────────────────────────────────────────────────────────────

export const resolveItem = mutation({
  args: {
    logId: v.id("logs"),
    itemIndex: v.number(),
    canonicalName: v.string(),
    now: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);

    const log = await ctx.db.get(args.logId);
    if (!log) throw new Error("Log not found");
    if (log.type !== "food") throw new Error("Log is not a food log");
    if (log.userId !== userId) {
      throw new Error("Not authorized to modify this log");
    }

    const data = log.data as FoodLogData;
    if (!data.items || data.items.length === 0) {
      throw new Error("Log has no items");
    }

    const items = assertProcessedFoodItems(data.items);
    if (!Number.isInteger(args.itemIndex) || args.itemIndex < 0) {
      throw new ConvexError(
        `itemIndex must be a non-negative integer, got ${args.itemIndex}`,
      );
    }
    if (args.itemIndex >= items.length) {
      throw new Error("Item index out of range");
    }

    const item = items[args.itemIndex];

    // Policy: expired items cannot be re-matched via resolveItem.
    // Users should edit the raw log text to fix expired items instead.
    if (item.resolvedBy === "expired") {
      throw new ConvexError(
        `Item at index ${args.itemIndex} is expired and cannot be re-matched. ` +
          "Edit the raw log text to correct expired items.",
      );
    }

    const alreadyResolved =
      item.canonicalName != null &&
      item.canonicalName !== "" &&
      item.canonicalName !== "unknown_food";
    if (alreadyResolved) {
      throw new ConvexError(
        `Item at index ${args.itemIndex} is already resolved ` +
          `(canonicalName: "${item.canonicalName}").`,
      );
    }

    if (args.canonicalName.trim().length === 0) {
      throw new ConvexError("canonicalName must be non-empty");
    }

    if (!isCanonicalFood(args.canonicalName)) {
      throw new ConvexError(
        "Invalid canonical name: not found in food registry",
      );
    }

    const zone = getFoodZone(args.canonicalName);
    const selectedCandidate =
      item.matchCandidates?.find(
        (candidate) => candidate.canonicalName === args.canonicalName,
      ) ?? STATIC_MATCHER_CONTEXT.documentMap.get(args.canonicalName);

    const updatedItem: ProcessedFoodItem = {
      ...item,
      canonicalName: args.canonicalName,
      resolvedBy: "user",
      ...(zone !== undefined && { recoveryStage: zone }),
      ...(selectedCandidate && { bucketKey: selectedCandidate.bucketKey }),
      ...(selectedCandidate && { bucketLabel: selectedCandidate.bucketLabel }),
      matchConfidence: Math.max(item.matchConfidence ?? 0, 1),
      matchStrategy: "user",
      matchCandidates: undefined,
      bucketOptions: undefined,
    };

    const updatedItems = [...items];
    updatedItems[args.itemIndex] = updatedItem;

    const nextVersion = (data.itemsVersion ?? 0) + 1;
    await ctx.db.patch(args.logId, {
      data: {
        ...data,
        items: updatedItems,
        itemsVersion: nextVersion,
      } as typeof log.data,
    });

    const aliasText = item.parsedName || item.userSegment;
    const aliasSource =
      item.bucketOptions && item.bucketOptions.length > 0 ? "bucket" : "user";
    await upsertLearnedAlias(
      ctx,
      userId,
      aliasText,
      args.canonicalName,
      aliasSource,
    );

    // Embed the alias text so future misspellings resolve via vector
    // similarity (WQ-308). Runs in the background — failure is non-critical.
    await ctx.scheduler.runAfter(0, internal.foodParsing.embedAliasInternal, {
      aliasText,
      canonicalName: args.canonicalName,
    });

    // Add the resolved food to the user's knownFoods set (WQ-302).
    await addToKnownFoods(ctx, userId, [args.canonicalName]);

    // If the evidence window has already closed, processEvidence won't re-run,
    // so we must create the ingredientExposure for this newly resolved item
    // directly. Same pattern as applyLlmResults.
    if (data.evidenceProcessedAt != null) {
      await ctx.db.insert("ingredientExposures", {
        userId,
        logId: args.logId,
        itemIndex: args.itemIndex,
        logTimestamp: log.timestamp,
        ingredientName: updatedItem.userSegment,
        canonicalName: args.canonicalName,
        quantity: updatedItem.quantity,
        unit: updatedItem.unit,
        ...(updatedItem.preparation !== undefined && {
          preparation: updatedItem.preparation,
        }),
        ...(updatedItem.recoveryStage !== undefined && {
          recoveryStage: updatedItem.recoveryStage,
        }),
        ...(updatedItem.spiceLevel !== undefined && {
          spiceLevel: updatedItem.spiceLevel,
        }),
        createdAt: args.now ?? Date.now(),
      });
    }
  },
});
