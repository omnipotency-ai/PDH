/**
 * Core sync types, validators, and sanitization helpers.
 *
 * Pure logic (no React hooks) — used by all other sync modules and tested
 * directly in `src/lib/__tests__/sync.test.ts` via the barrel re-export.
 */

import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { sanitizeUnknownStringsDeep } from "@/lib/inputSafety";
import type {
  ActivityLogData,
  DigestiveLogData,
  FluidLogData,
  FoodItem,
  FoodLogData,
  HabitLogData,
  LogDataMap,
  LogType,
  WeightLogData,
} from "@/types/domain";
import type { api } from "../../convex/_generated/api";
import type { Id, TableNames } from "../../convex/_generated/dataModel";

// ─── Convex API-boundary helpers ──────────────────────────────────────────────
//
// Convex IDs are branded strings (`string & { __tableName: T }`).  At runtime
// they are plain strings, but the TypeScript brand prevents accidental misuse.
// When the client receives an ID from a Convex query and later sends it back to
// a mutation, we must re-brand it.  Convex provides no runtime helper for this
// — the cast is the officially intended pattern.

/**
 * Re-brand a plain string as a Convex `Id<T>`.
 *
 * Only use at API boundaries where the string is **known** to originate from
 * a Convex document `_id` field (e.g. stored in local state after a query).
 */
export function asConvexId<T extends TableNames>(id: string): Id<T> {
  if (id.length === 0) {
    throw new Error("asConvexId: received empty string — expected a valid Convex document ID");
  }
  // Convex Ids are plain strings at runtime; the brand is compile-time only.
  return id as Id<T>;
}

/**
 * The Convex mutation `data` parameter type inferred from the log data validator.
 * Our domain `LogPayloadData` is structurally equivalent but uses slightly
 * different optional/nullable representations (e.g. `null` vs `undefined`).
 * Convex validates the data at runtime via its server-side validator, so
 * this cast is safe at the API boundary.
 */
type ConvexLogData = FunctionArgs<typeof api.logs.add>["data"];

/**
 * Set of valid log type strings for runtime validation.
 * Must stay in sync with the LogType union in domain.ts.
 */
const VALID_LOG_TYPES: ReadonlySet<string> = new Set<LogType>([
  "food",
  "liquid",
  "fluid",
  "digestion",
  "habit",
  "activity",
  "weight",
]);

/**
 * Runtime check: is this string a valid LogType?
 */
function isValidLogType(type: string): type is LogType {
  return VALID_LOG_TYPES.has(type);
}

// ─── WQ-015: Typed sanitization for log data ──────────────────────────────────

/**
 * Convert a domain `FoodItem` to a Convex-compatible food item.
 *
 * The domain `FoodItem.canonicalName` is `string | null` but the Convex
 * validator uses `v.optional(v.string())` which does not accept `null`.
 * This function converts `null` to `undefined` for that field so the
 * Convex server validator will accept it.
 */
export function toConvexFoodItem(
  item: FoodItem,
): Omit<FoodItem, "canonicalName"> & { canonicalName?: string } {
  const { canonicalName, ...rest } = item;
  return {
    ...rest,
    ...(canonicalName !== undefined && canonicalName !== null && { canonicalName }),
  };
}

/**
 * Sanitize a domain `LogPayloadData` value and convert it to the Convex
 * mutation `data` parameter type.
 *
 * The domain types (e.g. `FoodLogData`) are subsets of the Convex validator
 * types (which include server-only fields like `evidenceProcessedAt`,
 * `itemsVersion`). We discriminate on `type` to narrow the sanitized data
 * to the correct domain shape, then build a `ConvexLogData`-compatible
 * object for each variant.
 *
 * Convex re-validates at the server, so if a field is missing or has the
 * wrong shape, the server will reject it.
 */
/**
 * Assert that a sanitized value is a plain object (not null, not an array).
 * Throws with a descriptive message if the check fails so the error surfaces
 * clearly rather than producing a confusing downstream crash.
 */
function assertObject(value: unknown, context: string): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(
      `[sanitizeLogData] Expected plain object for ${context}, got ${Array.isArray(value) ? "array" : String(value === null ? "null" : typeof value)}`,
    );
  }
}

/**
 * Assert that a required field is present (not undefined) on a sanitized object.
 * Throws if the field is absent so missing discriminant fields are caught early
 * at the client boundary rather than silently sent to Convex as undefined.
 */
function assertField(obj: Record<string, unknown>, field: string, context: string): void {
  if (!(field in obj) || obj[field] === undefined) {
    throw new Error(`[sanitizeLogData] Missing required field "${field}" in ${context} log data`);
  }
}

export function sanitizeLogData(type: LogType, data: LogPayloadData): ConvexLogData {
  const sanitized = sanitizeUnknownStringsDeep(data);

  // Discriminate on the log type to build the correct ConvexLogData variant.
  // Each branch produces an object that satisfies the corresponding Convex
  // validator shape. Server-only fields (evidenceProcessedAt, itemsVersion)
  // are never sent from the client, so we don't include them.
  switch (type) {
    case "food":
    case "liquid": {
      assertObject(sanitized, type);
      assertField(sanitized, "items", type);
      const d = sanitized as FoodLogData;
      // Map items to fix null→undefined for canonicalName (domain allows null,
      // Convex validator does not).
      const convexItems = d.items.map(toConvexFoodItem);
      return {
        items: convexItems,
        ...(d.rawInput !== undefined && { rawInput: d.rawInput }),
        ...(d.notes !== undefined && { notes: d.notes }),
        ...(d.mealSlot !== undefined && { mealSlot: d.mealSlot }),
      } satisfies ConvexLogData;
    }
    case "fluid": {
      assertObject(sanitized, "fluid");
      assertField(sanitized, "items", "fluid");
      const d = sanitized as FluidLogData;
      return { items: d.items } satisfies ConvexLogData;
    }
    case "digestion": {
      assertObject(sanitized, "digestion");
      assertField(sanitized, "bristolCode", "digestion");
      const d = sanitized as DigestiveLogData;
      return {
        bristolCode: d.bristolCode,
        ...(d.urgencyTag !== undefined && { urgencyTag: d.urgencyTag }),
        ...(d.effortTag !== undefined && { effortTag: d.effortTag }),
        ...(d.consistencyTag !== undefined && {
          consistencyTag: d.consistencyTag,
        }),
        ...(d.volumeTag !== undefined && { volumeTag: d.volumeTag }),
        ...(d.accident !== undefined && { accident: d.accident }),
        ...(d.notes !== undefined && { notes: d.notes }),
        ...(d.episodesCount !== undefined && {
          episodesCount: d.episodesCount,
        }),
        ...(d.windowMinutes !== undefined && {
          windowMinutes: d.windowMinutes,
        }),
      } satisfies ConvexLogData;
    }
    case "habit": {
      assertObject(sanitized, "habit");
      assertField(sanitized, "habitId", "habit");
      assertField(sanitized, "name", "habit");
      assertField(sanitized, "habitType", "habit");
      const d = sanitized as HabitLogData;
      return {
        habitId: d.habitId,
        name: d.name,
        habitType: d.habitType,
        ...(d.quantity !== undefined && { quantity: d.quantity }),
        ...(d.action !== undefined && { action: d.action }),
      } satisfies ConvexLogData;
    }
    case "activity": {
      assertObject(sanitized, "activity");
      assertField(sanitized, "activityType", "activity");
      const d = sanitized as ActivityLogData;
      return {
        activityType: d.activityType,
        ...(d.durationMinutes !== undefined && {
          durationMinutes: d.durationMinutes,
        }),
        ...(d.feelTag !== undefined && { feelTag: d.feelTag }),
      } satisfies ConvexLogData;
    }
    case "weight": {
      assertObject(sanitized, "weight");
      assertField(sanitized, "weightKg", "weight");
      const d = sanitized as WeightLogData;
      return { weightKg: d.weightKg } satisfies ConvexLogData;
    }
  }
}

// ─── WQ-014: Validated Convex→SyncedLog mapping ──────────────────────────────

/**
 * Convex query results for logs are flat unions
 * (`{ type: T1 | T2 | …, data: D1 | D2 | … }`), not discriminated unions.
 * Our `SyncedLog` type is a proper discriminated union that pairs each `type`
 * with its corresponding `data` shape.
 *
 * This function validates each row's `type` field at runtime, narrowing to the
 * correct discriminated union member. Rows with unexpected types are skipped
 * with a warning rather than crashing the app.
 */
export type ConvexLogRow = NonNullable<FunctionReturnType<typeof api.logs.list>>[number];

export function toValidatedSyncedLog(row: ConvexLogRow): SyncedLog | null {
  const id = row.id as string;
  const { timestamp, type, data } = row;

  if (!isValidLogType(type)) {
    console.warn(`[sync] Skipping log ${id}: unexpected type "${type}"`);
    return null;
  }

  // Now `type` is narrowed to `LogType`. We switch on the type to build each
  // discriminated union member with the correct type-to-data pairing.
  // The server-side validators guarantee the data shape matches the type,
  // so the data narrowing per case is safe.
  switch (type) {
    case "food":
      return { id, timestamp, type, data: data as LogDataMap["food"] };
    case "liquid":
      return { id, timestamp, type, data: data as LogDataMap["liquid"] };
    case "fluid":
      return { id, timestamp, type, data: data as LogDataMap["fluid"] };
    case "digestion":
      return { id, timestamp, type, data: data as LogDataMap["digestion"] };
    case "habit":
      return { id, timestamp, type, data: data as LogDataMap["habit"] };
    case "activity":
      return { id, timestamp, type, data: data as LogDataMap["activity"] };
    case "weight":
      return { id, timestamp, type, data: data as LogDataMap["weight"] };
  }
}

export function toSyncedLogs(rows: ConvexLogRow[] | undefined): SyncedLog[] {
  if (!rows) return [];
  const result: SyncedLog[] = [];
  for (const row of rows) {
    const log = toValidatedSyncedLog(row);
    if (log !== null) {
      result.push(log);
    }
  }
  return result;
}

/** Union of all log data shapes, keyed by LogType */
export type LogPayloadData = LogDataMap[LogType];

/** Discriminated union of all synced log types with properly typed data */
export type SyncedLog = {
  [K in LogType]: {
    id: string;
    timestamp: number;
    type: K;
    data: LogDataMap[K];
  };
}[LogType];
