/**
 * @file foodParsing.ts
 *
 * Deterministic-first food parsing module. Takes raw food input text
 * (including voice-to-text), sanitises it, resolves known registry phrases
 * locally, and escalates only unresolved fragments to the LLM. AI failures
 * fall back to a simple comma-split heuristic.
 *
 * Deterministic parsing functions (splitting, quantity extraction, registry
 * matching) live in shared/foodParsing.ts so both client and server can
 * use them. This file re-exports those and adds the LLM orchestration layer.
 *
 * @exports parseFood — main entry point for AI food parsing
 * @exports sanitiseFoodInput — re-exported from shared
 * @exports ParsedFoodItem, FoodComponent, FoodParseResult — re-exported from shared
 *
 * @consumers
 *   - src/hooks/useFoodParsing.ts (sole runtime consumer)
 *   - src/lib/__tests__/foodParsing.test.ts
 */

import { normalizeFoodName } from "@shared/foodNormalize";
import type { FoodComponent, FoodParseResult, ParsedFoodItem } from "@shared/foodParsing";
import {
  buildDeterministicItem,
  buildExistingNameMap,
  mergeParsedItems,
  parseLeadingQuantity,
  sanitiseFoodInput,
  splitRawFoodItems,
} from "@shared/foodParsing";
import { BACKGROUND_MODEL } from "./aiModels";
import type { ConvexAiCaller } from "./convexAiClient";
import { getErrorMessage } from "./errors";
import { buildFoodParseSystemPrompt, postProcessCanonical } from "./foodLlmCanonicalization";

// ─────────────────────────────────────────────────────────────────────────────
// Re-exports from shared for backward compatibility
// ─────────────────────────────────────────────────────────────────────────────

export type {
  FoodComponent,
  FoodParseResult,
  ParsedFoodItem,
} from "@shared/foodParsing";
export {
  buildDeterministicItem,
  buildExistingNameMap,
  mergeParsedItems,
  parseLeadingQuantity,
  sanitiseFoodInput,
  splitRawFoodItems,
} from "@shared/foodParsing";

// ─────────────────────────────────────────────────────────────────────────────
// Types that remain client-side (used by buildParsedFoodData and parseFood)
// ─────────────────────────────────────────────────────────────────────────────

export interface ParsedFoodLogItem {
  parsedName: string;
  userSegment: string;
  canonicalName: string;
  resolvedBy: "registry" | "llm" | "heuristic" | "user" | "expired";
  quantity: number | null;
  unit: string | null;
  preparation?: string;
  recoveryStage?: 1 | 2 | 3;
  spiceLevel?: "plain" | "mild" | "spicy";
}

export interface NewFoodLibraryEntry {
  canonicalName: string;
  type: "ingredient" | "composite";
  ingredients: string[];
  createdAt: number;
}

export interface ParsedFoodWritePayload {
  items: ParsedFoodLogItem[];
  newLibraryEntries: NewFoodLibraryEntry[];
}

interface NormalizableFoodFields {
  canonicalName: string;
  isNew: boolean;
  quantity: number | null;
  unit: string | null;
  uncertain?: boolean;
  uncertainQuestion?: string;
  suggestedMatch?: string | null;
  preparation?: string;
  recoveryStage?: 1 | 2 | 3;
  spiceLevel?: "plain" | "mild" | "spicy";
}

// ─────────────────────────────────────────────────────────────────────────────
// LLM support functions (client-only, not shared)
// ─────────────────────────────────────────────────────────────────────────────

const FOOD_PARSE_MODEL = BACKGROUND_MODEL;

const MAX_LLM_EXISTING_NAME_CANDIDATES = 24;

function tokenizeFoodName(value: string): string[] {
  const normalized = normalizeFoodName(value);
  if (!normalized) return [];
  return normalized
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}

function buildRelevantExistingNames(rawText: string, existingNames: string[]): string[] {
  const queryNormalized = normalizeFoodName(rawText);
  if (!queryNormalized) return [];

  const queryTokens = new Set(tokenizeFoodName(rawText));
  const deduped = new Map<string, string>();
  for (const name of existingNames) {
    const normalized = normalizeFoodName(name);
    if (!normalized || deduped.has(normalized)) continue;
    deduped.set(normalized, name);
  }

  return Array.from(deduped.entries())
    .map(([normalized, name]) => {
      let score = 0;
      if (normalized === queryNormalized) {
        score += 1_000;
      }
      if (normalized.includes(queryNormalized) || queryNormalized.includes(normalized)) {
        score += 100;
      }

      const candidateTokens = new Set(tokenizeFoodName(name));
      for (const token of queryTokens) {
        if (candidateTokens.has(token)) {
          score += 10;
        }
      }

      return {
        name,
        normalized,
        score,
      };
    })
    .filter((candidate) => candidate.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.normalized.length - b.normalized.length ||
        a.name.localeCompare(b.name),
    )
    .slice(0, MAX_LLM_EXISTING_NAME_CANDIDATES)
    .map((candidate) => candidate.name);
}

/** Built once at module load. The prompt is deterministic (derived from the registry). */
const SYSTEM_PROMPT = buildFoodParseSystemPrompt();

function buildUserMessage(rawText: string, existingNames: string[]): string {
  return JSON.stringify(
    {
      rawText,
      existingNames: buildRelevantExistingNames(rawText, existingNames),
    },
    null,
    2,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LLM response validation
// ─────────────────────────────────────────────────────────────────────────────

/** Narrows a non-null object to a string-keyed record for property access. */
export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/**
 * Shared field checks for both FoodComponent and ParsedFoodItem.
 * Both types share these optional/nullable fields with identical constraints.
 */
export function hasValidFoodFields(r: Record<string, unknown>): boolean {
  return (
    typeof r.canonicalName === "string" &&
    r.canonicalName.trim().length > 0 &&
    typeof r.isNew === "boolean" &&
    (r.quantity === null || r.quantity === undefined || typeof r.quantity === "number") &&
    (r.unit === null || r.unit === undefined || typeof r.unit === "string") &&
    (r.uncertain === undefined || typeof r.uncertain === "boolean") &&
    (r.uncertainQuestion === undefined || typeof r.uncertainQuestion === "string") &&
    (r.suggestedMatch === undefined ||
      r.suggestedMatch === null ||
      typeof r.suggestedMatch === "string") &&
    (r.preparation === undefined || typeof r.preparation === "string") &&
    (r.recoveryStage === undefined ||
      r.recoveryStage === 1 ||
      r.recoveryStage === 2 ||
      r.recoveryStage === 3) &&
    (r.spiceLevel === undefined ||
      r.spiceLevel === "plain" ||
      r.spiceLevel === "mild" ||
      r.spiceLevel === "spicy")
  );
}

export function isValidFoodComponent(c: unknown): c is FoodComponent {
  if (!isRecord(c)) return false;
  return typeof c.name === "string" && c.name.trim().length > 0 && hasValidFoodFields(c);
}

export function isValidParsedFoodItem(item: unknown): item is ParsedFoodItem {
  if (!isRecord(item)) return false;
  return (
    typeof item.original === "string" &&
    item.original.trim().length > 0 &&
    typeof item.isComposite === "boolean" &&
    hasValidFoodFields(item) &&
    Array.isArray(item.components) &&
    item.components.length > 0 &&
    item.components.every(isValidFoodComponent)
  );
}

export function isValidFoodParseResult(parsed: unknown): parsed is FoodParseResult {
  if (!isRecord(parsed)) return false;
  return (
    Array.isArray(parsed.items) &&
    parsed.items.length > 0 &&
    parsed.items.every(isValidParsedFoodItem)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LLM fallback and normalization
// ─────────────────────────────────────────────────────────────────────────────

function buildFallbackResult(rawText: string): FoodParseResult {
  const items = splitRawFoodItems(rawText);
  return {
    items: items.map((item) => {
      const { parsedName, quantity, unit } = parseLeadingQuantity(item);
      const name = parsedName.toLowerCase().trim();
      const resolved = postProcessCanonical(name || item);
      return {
        original: item,
        canonicalName: resolved.canonical,
        isNew: resolved.isNew,
        isComposite: false,
        quantity,
        unit,
        recoveryStage: resolved.zone,
        components: [
          {
            name: item,
            canonicalName: resolved.canonical,
            isNew: resolved.isNew,
            quantity,
            unit,
            recoveryStage: resolved.zone,
          },
        ],
      };
    }),
  };
}

/**
 * Shared normalization for food fields common to both FoodComponent and ParsedFoodItem.
 * Resolves canonical name, clamps quantity/unit, and preserves optional fields.
 */
function normalizeFields<T extends NormalizableFoodFields>(
  entry: T,
): T & {
  canonicalName: string;
  isNew: boolean;
  quantity: number | null;
  unit: string | null;
  recoveryStage?: 1 | 2 | 3;
} {
  const resolved = postProcessCanonical(entry.canonicalName.trim());
  const recoveryStage = resolved.zone;
  return {
    ...entry,
    canonicalName: resolved.canonical,
    isNew: resolved.isNew ? entry.isNew : false,
    quantity: typeof entry.quantity === "number" ? entry.quantity : null,
    unit: typeof entry.unit === "string" && entry.unit.trim().length > 0 ? entry.unit.trim() : null,
    ...(entry.uncertain === true
      ? {
          uncertain: true,
          ...(entry.uncertainQuestion !== undefined && {
            uncertainQuestion: entry.uncertainQuestion,
          }),
          ...(entry.suggestedMatch !== undefined && {
            suggestedMatch: entry.suggestedMatch,
          }),
        }
      : {
          uncertain: undefined,
          uncertainQuestion: undefined,
          suggestedMatch: undefined,
        }),
    ...(entry.preparation !== undefined && { preparation: entry.preparation }),
    ...(recoveryStage !== undefined && { recoveryStage }),
    ...(entry.spiceLevel !== undefined && { spiceLevel: entry.spiceLevel }),
  };
}

export function normalizeComponent(c: FoodComponent): FoodComponent {
  return {
    ...normalizeFields(c),
    name: c.name.trim(),
  };
}

export function normalizeItem(item: ParsedFoodItem): ParsedFoodItem {
  return {
    ...normalizeFields(item),
    original: item.original.trim(),
    components: item.components.map(normalizeComponent),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export function buildParsedFoodData(parsedItems: ParsedFoodItem[]): ParsedFoodWritePayload {
  const finalItems: ParsedFoodLogItem[] = [];
  const newLibraryEntries: NewFoodLibraryEntry[] = [];
  const createdAt = Date.now();

  for (const item of parsedItems) {
    const shouldInheritParentFields = !item.isComposite && item.components.length === 1;

    for (const component of item.components) {
      const preparation =
        component.preparation ?? (shouldInheritParentFields ? item.preparation : undefined);
      const recoveryStage =
        component.recoveryStage ?? (shouldInheritParentFields ? item.recoveryStage : undefined);
      const spiceLevel =
        component.spiceLevel ?? (shouldInheritParentFields ? item.spiceLevel : undefined);

      finalItems.push({
        parsedName: component.name.trim(),
        userSegment: item.original.trim(),
        canonicalName: component.canonicalName.trim(),
        resolvedBy: component.isNew ? ("heuristic" as const) : ("registry" as const),
        quantity: component.quantity ?? (shouldInheritParentFields ? item.quantity : null),
        unit: component.unit ?? (shouldInheritParentFields ? item.unit : null),
        ...(preparation !== undefined && { preparation }),
        ...(recoveryStage !== undefined && { recoveryStage }),
        ...(spiceLevel !== undefined && { spiceLevel }),
      });

      if (component.isNew) {
        newLibraryEntries.push({
          canonicalName: component.canonicalName.trim(),
          type: "ingredient",
          ingredients: [],
          createdAt,
        });
      }
    }

    if (item.isComposite && item.components.length > 1) {
      newLibraryEntries.push({
        canonicalName: item.canonicalName.trim(),
        type: "composite",
        ingredients: item.components.map((component) => component.canonicalName.trim()),
        createdAt,
      });
    }
  }

  return {
    items: finalItems,
    newLibraryEntries,
  };
}

export async function parseFood(
  callAi: ConvexAiCaller,
  apiKey: string,
  rawText: string,
  existingNames: string[],
): Promise<FoodParseResult> {
  const cleanedText = sanitiseFoodInput(rawText);
  const rawItems = splitRawFoodItems(cleanedText);
  if (rawItems.length === 0) {
    return { items: [] };
  }
  const existingNameMap = buildExistingNameMap(existingNames);
  const parsedGroups = new Map<number, ParsedFoodItem[]>();
  const unresolvedItems: Array<{ index: number; text: string }> = [];
  const canUseAi = apiKey.trim().length > 0;

  rawItems.forEach((item, index) => {
    const parsed = buildDeterministicItem(item, existingNameMap);
    if (parsed) {
      parsedGroups.set(index, [parsed]);
      return;
    }
    unresolvedItems.push({ index, text: item });
  });

  if (rawItems.length > 0 && unresolvedItems.length === 0) {
    return mergeParsedItems(rawItems.length, parsedGroups);
  }

  for (const entry of unresolvedItems) {
    const fallbackItems = buildFallbackResult(entry.text).items;

    if (!canUseAi) {
      parsedGroups.set(entry.index, fallbackItems);
      continue;
    }

    try {
      const result = await callAi({
        apiKey,
        model: FOOD_PARSE_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: buildUserMessage(entry.text, existingNames),
          },
        ],
        responseFormat: { type: "json_object" },
      });

      const parsed: unknown = JSON.parse(result.content);
      if (!isValidFoodParseResult(parsed)) {
        console.error("Food parsing returned an unexpected response structure.");
        parsedGroups.set(entry.index, fallbackItems);
        continue;
      }

      parsedGroups.set(entry.index, parsed.items.map(normalizeItem));
    } catch (error: unknown) {
      const message =
        error instanceof SyntaxError
          ? "Food parsing returned invalid JSON"
          : `Food parsing request failed: ${getErrorMessage(error)}`;
      console.error(message);
      parsedGroups.set(entry.index, fallbackItems);
    }
  }

  return mergeParsedItems(rawItems.length, parsedGroups);
}
