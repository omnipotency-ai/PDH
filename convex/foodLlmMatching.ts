"use node";

/**
 * LLM-based food matching action.
 *
 * When deterministic parsing (processLog) leaves unresolved items, the client
 * calls this action to send them to OpenAI for segmentation, matching, and
 * web search. The LLM:
 *
 * 1. Segments free-form text (voice input often has no commas)
 * 2. Matches each segment to the food registry (binary: match or NOT_ON_LIST)
 * 3. Searches the web for unknown terms (brand names, regional foods) before
 *    giving up
 *
 * Results are written back via an internal mutation. Matched items get
 * `resolvedBy: "llm"`. Unmatched items stay pending for user resolution or
 * 6-hour expiry.
 *
 * The OpenAI API key is held at the app level in the Convex environment.
 *
 * WQ-346: Registry vocabulary is cached at module level (registry is static).
 * WQ-347: Fuse.js fuzzy pre-matching skips LLM for trivial matches.
 */

import { v } from "convex/values";
import Fuse from "fuse.js";
import { canonicalizeKnownFoodName } from "../shared/foodCanonicalization";
import { parseLeadingQuantity } from "../shared/foodParsing";
import { FOOD_REGISTRY, getFoodZone } from "../shared/foodRegistry";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import { requireAuth } from "./lib/auth";
import { sanitizePlainText } from "./lib/inputSafety";
import {
  classifyOpenAiHttpError,
  getConfiguredOpenAiApiKey,
} from "./lib/openai";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const OPENAI_API_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-5.4-mini";

/**
 * Fuse.js score threshold for fuzzy pre-matching. Fuse.js scores range from
 * 0 (perfect match) to 1 (no match). A threshold of 0.15 means only very
 * close matches are accepted without LLM verification.
 */
const FUZZY_PRE_MATCH_THRESHOLD = 0.15;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** A single food result from the LLM response. */
interface LlmFoodResult {
  parsedName: string;
  canonical: string; // registry canonical name or "NOT_ON_LIST"
}

/** A single segment result from the LLM response. */
interface LlmSegmentResult {
  segment: string;
  foods: LlmFoodResult[];
}

/** The full LLM response shape. */
interface LlmMatchingResponse {
  results: LlmSegmentResult[];
}

/** An item to write back after LLM processing. */
interface LlmResolvedItem {
  userSegment: string;
  parsedName: string;
  canonicalName: string;
  resolvedBy: "llm" | "fuzzy";
  quantity: number | null;
  unit: string | null;
  recoveryStage: 1 | 2 | 3 | null;
}

/** An item the LLM could not match. */
interface LlmUnresolvedItem {
  userSegment: string;
  parsedName: string;
  quantity: number | null;
  unit: string | null;
}

type LlmProcessedItem = LlmResolvedItem | LlmUnresolvedItem;

/** OpenAI chat completion response shape (only the fields we use). */
interface OpenAiChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

/** Document shape for the fuzzy pre-match Fuse.js index. */
interface FuzzyPreMatchDocument {
  canonical: string;
  zone: 1 | 2 | 3;
  examples: ReadonlyArray<string>;
}

/** Type guard: is this a resolved item (has canonicalName)? */
function isLlmResolvedItem(item: LlmProcessedItem): item is LlmResolvedItem {
  return "canonicalName" in item;
}

// ─────────────────────────────────────────────────────────────────────────────
// WQ-346: Module-level cached registry vocabulary
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lazily-initialized module-level cache for the registry vocabulary string.
 * Since the food registry is static (147 stations, locked), this string never
 * changes at runtime. Computing it once saves ~6,250 tokens per LLM call.
 */
let _cachedRegistryVocabulary: string | null = null;

/**
 * Build a compact vocabulary table from the food registry for the LLM prompt.
 * Each line: `canonical | zone | examples`
 *
 * Uses lazy module-level caching — the registry is static so this only needs
 * to be computed once per server process.
 */
function buildRegistryVocabularyForPrompt(): string {
  if (_cachedRegistryVocabulary !== null) {
    return _cachedRegistryVocabulary;
  }

  const lines: string[] = [];
  lines.push("canonical | zone | examples");
  lines.push("--- | --- | ---");

  for (const entry of FOOD_REGISTRY) {
    const examples = entry.examples.slice(0, 5).join(", ");
    lines.push(`${entry.canonical} | ${entry.zone} | ${examples}`);
  }

  _cachedRegistryVocabulary = lines.join("\n");
  return _cachedRegistryVocabulary;
}

// ─────────────────────────────────────────────────────────────────────────────
// WQ-347: Module-level cached Fuse.js index for fuzzy pre-matching
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lazily-initialized Fuse.js instance for fuzzy pre-matching before LLM calls.
 * Searches canonical names and example aliases. A very tight threshold (0.15)
 * ensures only near-exact matches skip the LLM.
 */
let _cachedFuseIndex: Fuse<FuzzyPreMatchDocument> | null = null;

function getFuzzyPreMatchIndex(): Fuse<FuzzyPreMatchDocument> {
  if (_cachedFuseIndex !== null) {
    return _cachedFuseIndex;
  }

  const documents: FuzzyPreMatchDocument[] = FOOD_REGISTRY.map((entry) => ({
    canonical: entry.canonical,
    zone: entry.zone,
    examples: entry.examples,
  }));

  _cachedFuseIndex = new Fuse(documents, {
    keys: [
      { name: "canonical", weight: 0.5 },
      { name: "examples", weight: 0.5 },
    ],
    threshold: FUZZY_PRE_MATCH_THRESHOLD,
    includeScore: true,
    ignoreLocation: true,
    minMatchCharLength: 3,
    shouldSort: true,
  });

  return _cachedFuseIndex;
}

/**
 * Attempt to fuzzy-match a single text segment against the food registry.
 * Returns a resolved item if the match is very confident (Fuse score <= threshold),
 * or null if the segment should be sent to the LLM.
 *
 * This is a cost optimization: trivial matches like "banana" -> "ripe banana"
 * skip the LLM entirely, saving ~40% of LLM calls.
 */
function fuzzyPreMatch(segment: string): LlmResolvedItem | null {
  const { parsedName, quantity, unit } = parseLeadingQuantity(segment);

  // Normalize for search: lowercase, trim
  const searchText = parsedName.toLowerCase().trim();
  if (searchText.length < 3) return null;

  const fuse = getFuzzyPreMatchIndex();
  const results = fuse.search(searchText, { limit: 1 });

  if (results.length === 0) return null;

  const topResult = results[0];
  // Fuse.js score: 0 = perfect match, 1 = no match.
  // Only accept if score is within threshold (very close match).
  if (
    topResult.score === undefined ||
    topResult.score > FUZZY_PRE_MATCH_THRESHOLD
  ) {
    return null;
  }

  const canonical = topResult.item.canonical;
  const zone = getFoodZone(canonical);
  if (zone === null || zone === undefined) return null;

  return {
    userSegment: segment,
    parsedName,
    canonicalName: canonical,
    resolvedBy: "fuzzy" as const,
    quantity,
    unit,
    recoveryStage: zone,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt builder
// ─────────────────────────────────────────────────────────────────────────────

/** Message pair returned by buildMatchingPrompt for safe LLM invocation. */
interface MatchingPromptMessages {
  /** System message containing instructions and registry — no user data. */
  systemPrompt: string;
  /** User message containing sanitized user input as structured JSON. */
  userMessage: string;
}

/**
 * Build separate system and user messages for LLM food matching.
 *
 * User-provided data (rawInput, unresolvedSegments) is passed as structured
 * JSON in the user message rather than interpolated into the system prompt.
 * This prevents prompt injection via malicious user input.
 */
function buildMatchingPrompt(
  rawInput: string,
  unresolvedSegments: string[],
  registryVocabulary: string,
): MatchingPromptMessages {
  // Sanitize user-provided strings (strip control characters, normalize unicode)
  const sanitizedRawInput = sanitizePlainText(rawInput, {
    preserveNewlines: false,
  });
  const sanitizedSegments = unresolvedSegments.map((s) =>
    sanitizePlainText(s, { preserveNewlines: false }),
  );

  const systemPrompt = `You are matching food items to a food category registry for a digestive health tracker.

The user message below contains a JSON object with two fields:
- "rawInput": the full meal text the user logged
- "unresolvedSegments": an array of text segments that could not be matched automatically

## Food category registry
${registryVocabulary}

## Your task
For each unmatched segment in the user's "unresolvedSegments" array:
1. If a segment contains MULTIPLE distinct foods (e.g. "steak and chips with bacon dressing"), extract each food separately BUT keep the original segment text in the "segment" field.
2. If you don't recognize a term, SEARCH THE WEB for it (brand names, regional foods, slang). Examples:
   - "Biscoff" → refined sweet biscuit brand → registry: "high-sugar refined snack"
   - "Kelitos" → breadstick snack → registry: "crispy cracker"
3. Match each food to a canonical name from the registry. Include typo corrections (e.g. "baban" -> banana -> "ripe banana").
4. If a food genuinely cannot be matched to anything in the registry even after web search, mark it as NOT_ON_LIST.

IMPORTANT: The "segment" field in your response MUST exactly match one of the strings from the "unresolvedSegments" array in the user message. Do NOT combine or split segments.

Respond with ONLY valid JSON, no markdown formatting:
{
  "results": [
    {
      "segment": "exact text from unresolvedSegments array",
      "foods": [
        { "parsedName": "extracted food name", "canonical": "registry canonical" | "NOT_ON_LIST" }
      ]
    }
  ]
}`;

  const userMessage = JSON.stringify({
    rawInput: sanitizedRawInput,
    unresolvedSegments: sanitizedSegments,
  });

  return { systemPrompt, userMessage };
}

// ─────────────────────────────────────────────────────────────────────────────
// Response parser
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse and validate the LLM JSON response. Returns null if the response
 * cannot be parsed or does not match the expected schema.
 */
function parseLlmResponse(raw: string): LlmMatchingResponse | null {
  // Trim first so trailing whitespace after code fences doesn't break the regex
  let cleaned = raw.trim();
  // Strip markdown code fences if present
  cleaned = cleaned
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("results" in parsed) ||
    !Array.isArray((parsed as Record<string, unknown>).results)
  ) {
    return null;
  }

  const response = parsed as { results: unknown[] };
  const validatedResults: LlmSegmentResult[] = [];

  for (const result of response.results) {
    if (
      typeof result !== "object" ||
      result === null ||
      !("segment" in result) ||
      !("foods" in result)
    ) {
      continue;
    }

    const segmentResult = result as {
      segment: unknown;
      foods: unknown;
    };

    if (
      typeof segmentResult.segment !== "string" ||
      !Array.isArray(segmentResult.foods)
    ) {
      continue;
    }

    const validatedFoods: LlmFoodResult[] = [];
    for (const food of segmentResult.foods) {
      if (
        typeof food !== "object" ||
        food === null ||
        !("parsedName" in food) ||
        !("canonical" in food)
      ) {
        continue;
      }

      const foodResult = food as {
        parsedName: unknown;
        canonical: unknown;
      };

      if (
        typeof foodResult.parsedName !== "string" ||
        typeof foodResult.canonical !== "string"
      ) {
        continue;
      }

      validatedFoods.push({
        parsedName: foodResult.parsedName,
        canonical: foodResult.canonical,
      });
    }

    validatedResults.push({
      segment: segmentResult.segment,
      foods: validatedFoods,
    });
  }

  return { results: validatedResults };
}

// ─────────────────────────────────────────────────────────────────────────────
// Post-processing: validate LLM matches against the registry
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Process the LLM response into items ready for writeback.
 *
 * For each LLM-returned food:
 * - If canonical is "NOT_ON_LIST", the item stays unresolved
 * - If canonical is a valid registry name, verify it exists in the registry
 *   (the LLM might hallucinate names). If valid, resolve as "llm".
 * - If canonical doesn't exist in registry, try deterministic canonicalization
 *   as a fallback. If that fails, mark as unresolved.
 */
function processLlmResults(
  llmResponse: LlmMatchingResponse,
): LlmProcessedItem[] {
  const items: LlmProcessedItem[] = [];

  for (const segmentResult of llmResponse.results) {
    for (const food of segmentResult.foods) {
      const { parsedName, quantity, unit } = parseLeadingQuantity(
        food.parsedName,
      );

      if (food.canonical === "NOT_ON_LIST") {
        items.push({
          userSegment: segmentResult.segment,
          parsedName,
          quantity,
          unit,
        });
        continue;
      }

      // Verify the LLM's canonical name against the registry
      const zone = getFoodZone(food.canonical);
      if (zone !== null && zone !== undefined) {
        // Valid registry match
        items.push({
          userSegment: segmentResult.segment,
          parsedName,
          canonicalName: food.canonical,
          resolvedBy: "llm" as const,
          quantity,
          unit,
          recoveryStage: zone,
        });
        continue;
      }

      // LLM returned a name not in the registry — try deterministic fallback
      const deterministicMatch = canonicalizeKnownFoodName(food.canonical);
      if (deterministicMatch !== null) {
        const deterministicZone = getFoodZone(deterministicMatch);
        items.push({
          userSegment: segmentResult.segment,
          parsedName,
          canonicalName: deterministicMatch,
          resolvedBy: "llm" as const,
          quantity,
          unit,
          recoveryStage: deterministicZone ?? null,
        });
        continue;
      }

      // Also try the original parsedName through deterministic path
      const parsedNameMatch = canonicalizeKnownFoodName(parsedName);
      if (parsedNameMatch !== null) {
        const parsedNameZone = getFoodZone(parsedNameMatch);
        items.push({
          userSegment: segmentResult.segment,
          parsedName,
          canonicalName: parsedNameMatch,
          resolvedBy: "llm" as const,
          quantity,
          unit,
          recoveryStage: parsedNameZone ?? null,
        });
        continue;
      }

      // Genuinely unresolvable
      items.push({
        userSegment: segmentResult.segment,
        parsedName,
        quantity,
        unit,
      });
    }
  }

  return items;
}

// ─────────────────────────────────────────────────────────────────────────────
// Test-only exports
// ─────────────────────────────────────────────────────────────────────────────

/** Exported for unit testing only. Do not use in production code. */
export const _testing = {
  buildRegistryVocabularyForPrompt,
  buildMatchingPrompt,
  parseLlmResponse,
  processLlmResults,
  fuzzyPreMatch,
  /** Reset module-level caches (for test isolation). */
  _resetCaches: () => {
    _cachedRegistryVocabulary = null;
    _cachedFuseIndex = null;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// The action
// ─────────────────────────────────────────────────────────────────────────────

/**
 * LLM-based food matching action.
 *
 * Called by the client (via useFoodLlmMatching hook) when food logs have
 * unresolved items after deterministic parsing. The API key is resolved in
 * order: (1) server-stored profile key, (2) client-provided arg (legacy fallback).
 *
 * Flow:
 * 1. Authenticate user and resolve API key
 * 2. Read the log's current itemsVersion for optimistic concurrency
 * 3. Fuzzy pre-match segments against registry (WQ-347) — trivial matches skip LLM
 * 4. Build the matching prompt with the full food registry vocabulary
 * 5. Call OpenAI (model-agnostic — configurable via `model` arg)
 * 6. Parse and validate the structured JSON response
 * 7. Post-process: verify matches against the registry, deterministic fallback
 * 8. Write resolved items back via applyLlmResults mutation
 */
export const matchUnresolvedItems = action({
  args: {
    logId: v.id("logs"),
    rawInput: v.string(),
    unresolvedSegments: v.array(v.string()),
    model: v.optional(
      v.union(
        v.literal("gpt-5.4-mini"),
        v.literal("gpt-5.4"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    // 1. Auth guard
    const { userId } = await requireAuth(ctx);

    const apiKey = getConfiguredOpenAiApiKey();
    if (apiKey === null) {
      throw new Error(
        "[NON_RETRYABLE] [CONFIG_ERROR] AI is not configured for this deployment.",
      );
    }

    // 3. Bail early if no segments to process
    if (args.unresolvedSegments.length === 0) {
      return { matched: 0, unresolved: 0 };
    }

    // W0-10: Input length cap — prevent runaway requests from causing huge LLM
    // prompts and excessive API costs. Truncate array and individual strings
    // before any further processing.
    const MAX_SEGMENTS = 50;
    const MAX_SEGMENT_CHARS = 200;

    let segments = args.unresolvedSegments;
    if (segments.length > MAX_SEGMENTS) {
      console.warn(
        `[matchUnresolvedItems] Received ${segments.length} segments — truncating to ${MAX_SEGMENTS}.`,
      );
      segments = segments.slice(0, MAX_SEGMENTS);
    }
    segments = segments.map((s) =>
      s.length > MAX_SEGMENT_CHARS ? s.slice(0, MAX_SEGMENT_CHARS) : s,
    );

    // 4. Read the log's current version for optimistic concurrency
    const versionInfo = await ctx.runQuery(
      internal.foodParsing.getFoodLogVersionInfo,
      {
        logId: args.logId,
      },
    );
    if (versionInfo === null) {
      throw new Error(
        "[NON_RETRYABLE] [VALIDATION_ERROR] Log not found or is not a food log.",
      );
    }
    if (versionInfo.userId !== userId) {
      throw new Error(
        "[NON_RETRYABLE] [VALIDATION_ERROR] Not authorized to process this log.",
      );
    }

    // ─── WQ-347: Fuzzy pre-matching ──────────────────────────────────────
    // Try to match each segment against the registry using Fuse.js before
    // sending anything to the LLM. Only very high-confidence matches
    // (score <= 0.15) are accepted. This saves ~40% of LLM calls for
    // trivial matches like "banana" -> "ripe banana".
    const fuzzyMatched: LlmResolvedItem[] = [];
    const segmentsNeedingLlm: string[] = [];

    for (const segment of segments) {
      const fuzzyResult = fuzzyPreMatch(segment);
      if (fuzzyResult !== null) {
        fuzzyMatched.push(fuzzyResult);
      } else {
        segmentsNeedingLlm.push(segment);
      }
    }

    // If all segments were fuzzy-matched, skip the LLM entirely
    let llmResolved: LlmResolvedItem[] = [];
    let llmUnresolvedCount = 0;

    if (segmentsNeedingLlm.length > 0) {
      // 5. Build the prompt (uses cached registry vocabulary — WQ-346)
      const registryVocabulary = buildRegistryVocabularyForPrompt();
      const { systemPrompt, userMessage } = buildMatchingPrompt(
        args.rawInput,
        segmentsNeedingLlm,
        registryVocabulary,
      );

      // 6. Call OpenAI
      const model = args.model ?? DEFAULT_MODEL;
      const response = await fetch(`${OPENAI_API_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) {
        const statusText = `${response.status} ${response.statusText}`;
        const errorCode = classifyOpenAiHttpError(response.status);
        const isNonRetryable = errorCode === "KEY_ERROR";
        const prefix = isNonRetryable ? "[NON_RETRYABLE] " : "";
        throw new Error(
          `${prefix}[${errorCode}] OpenAI API request failed: ${statusText}`,
        );
      }

      const json = (await response.json()) as OpenAiChatCompletionResponse;
      const content = json.choices?.[0]?.message?.content ?? "";
      if (!content) {
        // WQ-323: Structured error — empty LLM content is a validation error,
        // not a warning to swallow. Return count so client knows nothing matched.
        console.error(
          "[VALIDATION_ERROR] matchUnresolvedItems: OpenAI returned empty content for",
          segmentsNeedingLlm.length,
          "segments.",
        );
        llmUnresolvedCount = segmentsNeedingLlm.length;
      } else {
        // 7. Parse and validate
        const llmResponse = parseLlmResponse(content);
        if (llmResponse === null) {
          console.error(
            "[VALIDATION_ERROR] matchUnresolvedItems: Failed to parse LLM response. First 500 chars:",
            content.slice(0, 500),
          );
          llmUnresolvedCount = segmentsNeedingLlm.length;
        } else {
          // 8. Post-process: verify against registry, deterministic fallback
          const processedItems = processLlmResults(llmResponse);
          llmResolved = processedItems.filter(isLlmResolvedItem);
          llmUnresolvedCount = processedItems.filter(
            (item) => !isLlmResolvedItem(item),
          ).length;
        }
      }
    }

    // 9. Combine fuzzy + LLM resolved items
    const allResolved = [...fuzzyMatched, ...llmResolved];

    // 10. Apply results if there are any resolved items
    if (allResolved.length > 0) {
      await ctx.runMutation(internal.foodParsing.applyLlmResults, {
        logId: args.logId,
        userId,
        expectedItemsVersion: versionInfo.itemsVersion,
        resolvedItems: allResolved.map((item) => ({
          userSegment: item.userSegment,
          parsedName: item.parsedName,
          canonicalName: item.canonicalName,
          resolvedBy: item.resolvedBy,
          quantity: item.quantity,
          unit: item.unit,
          recoveryStage: item.recoveryStage,
        })),
      });
    }

    return {
      matched: allResolved.length,
      unresolved: llmUnresolvedCount,
    };
  },
});
