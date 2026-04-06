/**
 * Structural validators for log data shapes used in the evidence pipeline.
 *
 * These parsers validate `unknown` data at runtime and return typed objects
 * or `null` when the data does not match the expected shape. They replace
 * unsafe `as Record<string, unknown>` casts throughout `foodEvidence.ts`.
 *
 * Each parser checks that required fields exist and are the correct type.
 * Number fields are guarded against NaN.
 */

// ── Parsed types ────────────────────────────────────────────────────────────

export interface ParsedDigestiveData {
  bristolCode: number | undefined;
  urgency: string | undefined;
  effort: string | undefined;
  episodesCount: number | undefined;
}

export interface ParsedFoodItem {
  name?: string;
  rawName?: string;
  parsedName?: string;
  userSegment?: string;
  canonicalName?: string;
}

export interface ParsedFoodData {
  items: ParsedFoodItem[];
}

export interface ParsedHabitData {
  habitId: string;
  name: string;
  quantity: number | undefined;
}

export interface ParsedActivityData {
  activityType: string;
  durationMinutes: number | undefined;
}

export interface ParsedFluidItem {
  quantity: number | undefined;
}

export interface ParsedFluidData {
  items: ParsedFluidItem[];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeNumber(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function safeString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

// ── Parsers ─────────────────────────────────────────────────────────────────

/**
 * Parse digestive/bowel event log data.
 * Returns null if data is not a valid object.
 * Bristol Stool Scale codes are integers 1-7 only; out-of-range or non-integer
 * values are coerced to undefined rather than passed downstream.
 */
export function parseDigestiveData(data: unknown): ParsedDigestiveData | null {
  if (!isRecord(data)) return null;

  const rawBristol = safeNumber(data.bristolCode);
  const bristolCode =
    rawBristol !== undefined &&
    Number.isInteger(rawBristol) &&
    rawBristol >= 1 &&
    rawBristol <= 7
      ? rawBristol
      : undefined;

  return {
    bristolCode,
    urgency: safeString(data.urgency),
    effort: safeString(data.effort),
    episodesCount: safeNumber(data.episodesCount),
  };
}

/**
 * Parse food log data, extracting the items array.
 * Returns null if data is not a valid object or items is not an array.
 */
export function parseFoodData(data: unknown): ParsedFoodData | null {
  if (!isRecord(data)) return null;
  if (!Array.isArray(data.items)) return null;

  const items: ParsedFoodItem[] = [];
  for (const item of data.items) {
    if (!isRecord(item)) continue;
    items.push({
      ...(typeof item.name === "string" && { name: item.name }),
      ...(typeof item.rawName === "string" && { rawName: item.rawName }),
      ...(typeof item.parsedName === "string" && {
        parsedName: item.parsedName,
      }),
      ...(typeof item.userSegment === "string" && {
        userSegment: item.userSegment,
      }),
      ...(typeof item.canonicalName === "string" && {
        canonicalName: item.canonicalName,
      }),
    });
  }

  return { items };
}

/**
 * Parse habit log data.
 * Returns null if data is not a valid object or required string fields are missing.
 */
export function parseHabitData(data: unknown): ParsedHabitData | null {
  if (!isRecord(data)) return null;

  const habitId = safeString(data.habitId);
  const name = safeString(data.name);
  if (habitId === undefined || name === undefined) return null;

  return {
    habitId,
    name,
    quantity: safeNumber(data.quantity),
  };
}

/**
 * Parse activity log data.
 * Returns null if data is not a valid object or activityType is not a string.
 */
export function parseActivityData(data: unknown): ParsedActivityData | null {
  if (!isRecord(data)) return null;

  const activityType = safeString(data.activityType);
  if (activityType === undefined) return null;

  return {
    activityType,
    durationMinutes: safeNumber(data.durationMinutes),
  };
}

/**
 * Parse fluid log data, extracting the items array with quantities.
 * Returns null if data is not a valid object or items is not an array.
 */
export function parseFluidData(data: unknown): ParsedFluidData | null {
  if (!isRecord(data)) return null;
  if (!Array.isArray(data.items)) return null;

  const items: ParsedFluidItem[] = [];
  for (const item of data.items) {
    if (!isRecord(item)) continue;
    items.push({
      quantity: safeNumber(item.quantity),
    });
  }

  return { items };
}
