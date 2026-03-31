# LLM behaviour

**Total Files Included:** 13

## Included Files
- /Users/peterjamesblizzard/projects/caca_traca/convex/foodLlmMatching.ts
- /Users/peterjamesblizzard/projects/caca_traca/src/lib/aiAnalysis.ts
- /Users/peterjamesblizzard/projects/caca_traca/src/lib/aiModels.ts
- /Users/peterjamesblizzard/projects/caca_traca/convex/ai.ts
- /Users/peterjamesblizzard/projects/caca_traca/convex/lib/apiKeys.ts
- /Users/peterjamesblizzard/projects/caca_traca/src/hooks/useApiKey.ts
- /Users/peterjamesblizzard/projects/caca_traca/convex/validators.ts
- /Users/peterjamesblizzard/projects/caca_traca/convex/lib/inputSafety.ts
- /Users/peterjamesblizzard/projects/caca_traca/src/hooks/useFoodLlmMatching.ts
- /Users/peterjamesblizzard/projects/caca_traca/src/hooks/useAiInsights.ts
- /Users/peterjamesblizzard/projects/caca_traca/shared/foodRegistry.ts
- /Users/peterjamesblizzard/projects/caca_traca/shared/foodMatching.ts
- /Users/peterjamesblizzard/projects/caca_traca/convex/foodParsing.ts

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/convex/foodLlmMatching.ts

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
 * The OpenAI API key can be passed from the client or, if empty, looked up
 * from the user's profile (server-side storage via convex/profiles.ts).
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

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const OPENAI_API_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-4.1-nano";
const OPENAI_API_KEY_PATTERN = /^sk-[A-Za-z0-9_-]{20,}$/;

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
  resolvedBy: "llm";
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

/**
 * Mask an API key for safe logging: show only the last 4 characters.
 * Returns "****" if the key is too short or empty.
 */
function maskApiKey(key: string): string {
  if (key.length <= 4) return "****";
  return `****${key.slice(-4)}`;
}

/**
 * Classify an HTTP error status into a structured error code.
 */
function classifyHttpError(status: number): string {
  if (status === 401 || status === 403) return "KEY_ERROR";
  if (status === 429) return "QUOTA_ERROR";
  if (status >= 500) return "NETWORK_ERROR";
  return "NETWORK_ERROR";
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
  if (topResult.score === undefined || topResult.score > FUZZY_PRE_MATCH_THRESHOLD) {
    return null;
  }

  const canonical = topResult.item.canonical;
  const zone = getFoodZone(canonical);
  if (zone === null || zone === undefined) return null;

  return {
    userSegment: segment,
    parsedName,
    canonicalName: canonical,
    resolvedBy: "llm" as const,
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

    if (typeof segmentResult.segment !== "string" || !Array.isArray(segmentResult.foods)) {
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

      if (typeof foodResult.parsedName !== "string" || typeof foodResult.canonical !== "string") {
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
function processLlmResults(llmResponse: LlmMatchingResponse): LlmProcessedItem[] {
  const items: LlmProcessedItem[] = [];

  for (const segmentResult of llmResponse.results) {
    for (const food of segmentResult.foods) {
      const { parsedName, quantity, unit } = parseLeadingQuantity(food.parsedName);

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
 * order: (1) client-provided arg, (2) server-stored profile key.
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
    apiKey: v.string(),
    logId: v.id("logs"),
    rawInput: v.string(),
    unresolvedSegments: v.array(v.string()),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // 1. Auth guard
    const { userId } = await requireAuth(ctx);

    // 2. Resolve API key: prefer client-provided, fall back to server-stored
    let apiKey = args.apiKey;
    if (!apiKey) {
      const profileKey = await ctx.runQuery(internal.profiles.getServerApiKey, {
        userId,
      });
      if (profileKey !== null) {
        apiKey = profileKey;
      }
    }

    // WQ-324: Validate API key format BEFORE any further processing.
    if (!OPENAI_API_KEY_PATTERN.test(apiKey)) {
      throw new Error(
        `[NON_RETRYABLE] [KEY_ERROR] Invalid OpenAI API key format (key ending ...${maskApiKey(apiKey)}).`,
      );
    }

    // 3. Bail early if no segments to process
    if (args.unresolvedSegments.length === 0) {
      return { matched: 0, unresolved: 0 };
    }

    // 4. Read the log's current version for optimistic concurrency
    const versionInfo = await ctx.runQuery(internal.foodParsing.getFoodLogVersionInfo, {
      logId: args.logId,
    });
    if (versionInfo === null) {
      throw new Error("[NON_RETRYABLE] [VALIDATION_ERROR] Log not found or is not a food log.");
    }
    if (versionInfo.userId !== userId) {
      throw new Error("[NON_RETRYABLE] [VALIDATION_ERROR] Not authorized to process this log.");
    }

    // ─── WQ-347: Fuzzy pre-matching ──────────────────────────────────────
    // Try to match each segment against the registry using Fuse.js before
    // sending anything to the LLM. Only very high-confidence matches
    // (score <= 0.15) are accepted. This saves ~40% of LLM calls for
    // trivial matches like "banana" -> "ripe banana".
    const fuzzyMatched: LlmResolvedItem[] = [];
    const segmentsNeedingLlm: string[] = [];

    for (const segment of args.unresolvedSegments) {
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
        const errorCode = classifyHttpError(response.status);
        const isNonRetryable = errorCode === "KEY_ERROR";
        const prefix = isNonRetryable ? "[NON_RETRYABLE] " : "";
        throw new Error(`${prefix}[${errorCode}] OpenAI API request failed: ${statusText}`);
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
          llmUnresolvedCount = processedItems.filter((item) => !isLlmResolvedItem(item)).length;
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
          resolvedBy: "llm" as const,
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

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/src/lib/aiAnalysis.ts

import { DEFAULT_INSIGHT_MODEL, getModelLabel, getValidInsightModel } from "@/lib/aiModels";
import { checkRateLimit } from "@/lib/aiRateLimiter";
import type { ConvexAiCaller } from "@/lib/convexAiClient";
import { debugWarn } from "@/lib/debugLog";
import { getErrorMessage } from "@/lib/errors";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import { INPUT_SAFETY_LIMITS, sanitizeUnknownStringsDeep } from "@/lib/inputSafety";
import { calculateCycleDay, calculateGestationalAgeFromDueDate } from "@/lib/reproductiveHealth";
import { MS_PER_DAY, MS_PER_HOUR } from "@/lib/timeConstants";
import type {
  AiNutritionistInsight,
  AiPreferences,
  Approach,
  BaselineAverages,
  BaselineDelta,
  DrPooReply,
  HealthProfile,
  LifestyleExperimentStatus,
  LogEntry,
  OutputFormat,
  OutputLength,
  Register,
  StructuredFoodAssessment,
} from "@/types/domain";
import { DEFAULT_AI_PREFERENCES } from "@/types/domain";

export type { AiNutritionistInsight };

// ─── Named constants (extracted from inline magic numbers) ──────────────────

/**
 * Maximum number of conversation messages to include in AI context.
 * Kept low to control token cost — each Dr. Poo call already includes a large
 * system prompt, patient snapshot, food context, and weekly digests. 10 messages
 * (~5 back-and-forth exchanges) provides sufficient conversational continuity
 * without inflating the payload by ~20K tokens.
 */
const MAX_CONVERSATION_MESSAGES = 10;

/** Estimated token count above which a warning is logged */
export const TOKEN_WARNING_THRESHOLD = 50_000;

/** Suffix added when storing oversized request/response strings in Convex history. */
const STORAGE_TRUNCATION_SUFFIX = "\n...[truncated for storage]";

/** Valid statuses for the lifestyleExperiment field returned by AI. */
const VALID_EXPERIMENT_STATUSES = new Set(["adapted", "broken", "testing", "rewarding"]);

/** Maximum allowed length for a patient's preferred name in the LLM prompt. */
const MAX_PREFERRED_NAME_LENGTH = 50;

/**
 * Sanitize a user-provided name before inserting it into an LLM prompt.
 * Strips XML/HTML tags to prevent prompt injection, then truncates to a
 * safe length. The caller wraps the result in `<patient_name>` XML delimiters.
 */
function sanitizeNameForPrompt(name: string): string {
  const stripped = name.replace(/<[^>]*>/g, "").trim();
  if (stripped.length <= MAX_PREFERRED_NAME_LENGTH) return stripped;
  return stripped.slice(0, MAX_PREFERRED_NAME_LENGTH);
}

// ─────────────────────────────────────────────────────────────────────────────

function truncateForStorage(
  value: string,
  maxLength = INPUT_SAFETY_LIMITS.aiPayloadString,
): string {
  if (value.length <= maxLength) return value;
  const prefixLength = Math.max(0, maxLength - STORAGE_TRUNCATION_SUFFIX.length);
  return `${value.slice(0, prefixLength)}${STORAGE_TRUNCATION_SUFFIX}`;
}

export function getAiDisclaimer(model: string = DEFAULT_INSIGHT_MODEL): string {
  const modelLabel = getModelLabel(model);
  return `This is lifestyle guidance generated by ${modelLabel}, an AI model that can make mistakes. This is not medical advice. Always consult your surgical team if you experience pain, bleeding, or any concern — regardless of what is shown here.`;
}

export interface PreviousReport {
  timestamp: number;
  insight: AiNutritionistInsight;
}

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface AiAnalysisResult {
  insight: AiNutritionistInsight;
  request: {
    model: string;
    messages: Array<{ role: string; content: string }>;
  };
  rawResponse: string;
  durationMs: number;
  inputLogCount: number;
}

type EducationalInsightValue = NonNullable<AiNutritionistInsight["educationalInsight"]>;

// Local fallback bank used only when the model returns a duplicate/missing educational insight.
// This keeps responses self-contained without sending long historical fact lists to the model.
const FALLBACK_EDUCATIONAL_INSIGHTS: EducationalInsightValue[] = [
  {
    topic: "Meal volume and urgency",
    fact: "Large meal volume can increase urgency after reconnection; smaller portions often reduce pressure swings.",
  },
  {
    topic: "Hydration timing",
    fact: "Spacing fluids across the day can support steadier stool consistency better than chugging large volumes at once.",
  },
  {
    topic: "Gastrocolic reflex",
    fact: "Urgency soon after eating is often the gastrocolic reflex moving older contents, not the meal you just ate.",
  },
  {
    topic: "Stool form tracking",
    fact: "Bristol trends over several events are more useful than any single stool when judging tolerance changes.",
  },
  {
    topic: "Sleep and motility",
    fact: "Poor sleep can alter gut motility signals and make stool pattern shifts more likely the next day.",
  },
  {
    topic: "Food re-testing",
    fact: "Tolerance can change during recovery, so foods flagged earlier may become manageable when re-tested at the right time.",
  },
  {
    topic: "Fat load effects",
    fact: "A high fat load can speed or loosen output in sensitive phases, especially when combined with accelerants.",
  },
  {
    topic: "Fiber transitions",
    fact: "Rapid fiber changes can disrupt stool form; stepwise adjustments are usually better tolerated than abrupt jumps.",
  },
  {
    topic: "Context matters",
    fact: "The same food can behave differently depending on sleep, hydration, and stimulant load on that day.",
  },
  {
    topic: "Pattern confidence",
    fact: "Repeated observations build confidence; single-event conclusions are useful only as provisional signals.",
  },
];

function normalizeEducationalKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function educationalKey(insight: EducationalInsightValue): string {
  return `${normalizeEducationalKey(insight.topic)}|${normalizeEducationalKey(insight.fact)}`;
}

function collectEducationalKeys(previousReports: PreviousReport[]): Set<string> {
  const seen = new Set<string>();
  for (const report of previousReports) {
    const insight = report.insight.educationalInsight;
    if (!insight) continue;
    seen.add(educationalKey(insight));
  }
  return seen;
}

function pickFallbackEducationalInsight(seen: Set<string>): EducationalInsightValue {
  const candidate = FALLBACK_EDUCATIONAL_INSIGHTS.find((item) => !seen.has(educationalKey(item)));
  if (candidate) return candidate;
  return {
    topic: "Pattern literacy",
    fact: `Consistent logging improves pattern detection quality over time. Focus point #${seen.size + 1}.`,
  };
}

function enforceNovelEducationalInsight(
  insight: AiNutritionistInsight,
  previousReports: PreviousReport[],
): AiNutritionistInsight {
  const seen = collectEducationalKeys(previousReports);
  const current = insight.educationalInsight;
  if (current && !seen.has(educationalKey(current))) {
    return insight;
  }
  return {
    ...insight,
    educationalInsight: pickFallbackEducationalInsight(seen),
  };
}

export interface FoodTrialSummaryInput {
  canonicalName: string;
  displayName: string;
  currentStatus: string;
  primaryStatus?: string;
  tendency?: string;
  confidence?: number;
  totalAssessments: number;
  culpritCount: number;
  safeCount: number;
  latestReasoning: string;
  lastAssessedAt: number;
  recentSuspect?: boolean;
  clearedHistory?: boolean;
  learnedTransitCenterMinutes?: number;
  learnedTransitSpreadMinutes?: number;
}

// ─── Weekly digest context for AI prompts ────────────────────────────────────

export interface WeeklyDigestInput {
  weekStart: string;
  avgBristolScore: number | null;
  totalBowelEvents: number;
  accidentCount: number;
  uniqueFoodsEaten: number;
  newFoodsTried: number;
  foodsCleared: number;
  foodsFlagged: number;
}

/** Maximum food window in hours. Slow transit modifiers cannot push beyond this. */
const MAX_FOOD_WINDOW_HOURS = 96;

/** @internal Exported for testing. */
export interface FoodItemDetail {
  name: string;
  canonicalName: string | null;
  quantity: number | null;
  unit: string | null;
}

/** @internal Exported for testing. */
export interface FoodLog {
  timestamp: number;
  time: string;
  items: FoodItemDetail[];
}

/** @internal Exported for testing. */
export interface BowelEvent {
  timestamp: number;
  time: string;
  bristolCode: number | null;
  consistency: string;
  urgency: string;
  effort: string;
  volume: string;
  accident: boolean;
  episodes: number;
  notes: string;
}

interface HabitLog {
  timestamp: number;
  time: string;
  habitId: string;
  name: string;
  habitType: string;
  quantity: number;
}

interface FluidLog {
  timestamp: number;
  time: string;
  name: string;
  amountMl: number | null;
}

interface ActivityLog {
  timestamp: number;
  time: string;
  activityType: string;
  durationMinutes: number | null;
  feeling: string | null;
}

interface ReproductiveLog {
  timestamp: number;
  time: string;
  entryType: "cycle";
  periodStartDate: string;
  bleedingStatus: string;
  symptoms: string[];
  notes: string;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString("en-GB", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDaysPostOp(surgeryDate: string): number | null {
  if (!surgeryDate) return null;
  const surgery = new Date(surgeryDate);
  if (Number.isNaN(surgery.getTime())) return null;
  const now = new Date();
  return Math.floor((now.getTime() - surgery.getTime()) / MS_PER_DAY);
}

function getBmi(heightCm: number | null, weightKg: number | null): string | null {
  if (!heightCm || !weightKg || heightCm <= 0 || weightKg <= 0) return null;
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  return bmi.toFixed(1);
}

// ─── Variable-window context builder ─────────────────────────────────────────

/**
 * Compute the food log time window in hours based on surgery type and slow transit modifiers.
 *
 * Base window:
 * - "Ileostomy reversal" → 48h (shorter colon transit)
 * - All others → 72h (full colon transit)
 *
 * Slow transit modifiers (any present adds 24h, capped at 96h):
 * - Pregnancy status is "pregnant"
 * - Medications include "opioid" or "iron" (case-insensitive substring)
 */
export function getFoodWindowHours(profile: HealthProfile): number {
  const baseWindow = profile.surgeryType === "Ileostomy reversal" ? 48 : 72;

  const hasSlowTransitModifier = (() => {
    if (profile.reproductiveHealth?.pregnancyStatus === "pregnant") return true;
    const meds = (profile.medications ?? "").toLowerCase();
    if (meds.includes("opioid") || meds.includes("iron")) return true;
    return false;
  })();

  const adjusted = hasSlowTransitModifier ? baseWindow + 24 : baseWindow;
  return Math.min(adjusted, MAX_FOOD_WINDOW_HOURS);
}

/** Per-log-type cutoff timestamps for variable-window context building. */
interface LogCutoffs {
  food: number;
  digestion: number;
  habit: number;
  fluid: number;
  activity: number;
  weight: number;
  reproductive: number;
}

/** Build per-log-type cutoff map using variable windows. */
function buildCutoffs(profile: HealthProfile, now: number): LogCutoffs {
  const foodWindowMs = getFoodWindowHours(profile) * MS_PER_HOUR;
  const bmWindowMs = 48 * MS_PER_HOUR;
  const defaultWindowMs = 24 * MS_PER_HOUR;

  return {
    food: now - foodWindowMs,
    digestion: now - bmWindowMs,
    habit: now - defaultWindowMs,
    fluid: now - defaultWindowMs,
    activity: now - defaultWindowMs,
    weight: now - defaultWindowMs,
    reproductive: now - defaultWindowMs,
  };
}

// ─── Shared log mapping functions ─────────────────────────────────────────────

function mapFoodLogs(logs: Array<LogEntry & { type: "food" }>): FoodLog[] {
  return logs
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((log) => {
      const items: FoodItemDetail[] = log.data.items
        .map((item): FoodItemDetail | null => {
          const name = String(item?.parsedName ?? item?.name ?? "").trim();
          if (!name) return null;
          const qty = Number(item?.quantity);
          return {
            name,
            canonicalName: item?.canonicalName ? String(item.canonicalName).trim() : null,
            quantity: Number.isFinite(qty) && qty > 0 ? qty : null,
            unit: item?.unit ? String(item.unit).trim() : null,
          };
        })
        .filter((x): x is FoodItemDetail => x !== null)
        .filter((item) => item.canonicalName !== "unknown_food");
      return {
        timestamp: log.timestamp,
        time: formatTime(log.timestamp),
        items,
      };
    });
}

function mapBowelEvents(logs: Array<LogEntry & { type: "digestion" }>): BowelEvent[] {
  return logs
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((log) => {
      const bristolCode = Number(log.data.bristolCode);
      return {
        timestamp: log.timestamp,
        time: formatTime(log.timestamp),
        bristolCode: Number.isFinite(bristolCode) ? bristolCode : null,
        consistency: String(log.data.consistencyTag ?? "").trim(),
        urgency: String(log.data.urgencyTag ?? "").trim(),
        effort: String(log.data.effortTag ?? "").trim(),
        volume: String(log.data.volumeTag ?? "").trim(),
        accident: Boolean(log.data.accident),
        episodes: Math.max(1, Math.floor(Number(log.data.episodesCount ?? 1))),
        notes: String(log.data.notes ?? "").trim(),
      };
    });
}

function mapHabitLogs(logs: Array<LogEntry & { type: "habit" }>): HabitLog[] {
  return logs
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((log) => ({
      timestamp: log.timestamp,
      time: formatTime(log.timestamp),
      habitId: String(log.data.habitId ?? "").trim(),
      name: String(log.data.name ?? "").trim(),
      habitType: String(log.data.habitType ?? "").trim(),
      quantity: Number(log.data.quantity ?? 1),
    }));
}

function mapFluidLogs(logs: Array<LogEntry & { type: "fluid" }>): FluidLog[] {
  return logs
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((log) => {
      const firstItem = log.data.items[0];
      const ml = Number(firstItem?.quantity);
      return {
        timestamp: log.timestamp,
        time: formatTime(log.timestamp),
        name: String(firstItem?.name ?? "water").trim(),
        amountMl: Number.isFinite(ml) && ml > 0 ? ml : null,
      };
    });
}

function mapActivityLogs(logs: Array<LogEntry & { type: "activity" }>): ActivityLog[] {
  return logs
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((log) => {
      const dur = Number(log.data.durationMinutes);
      return {
        timestamp: log.timestamp,
        time: formatTime(log.timestamp),
        activityType: String(log.data.activityType ?? "").trim(),
        durationMinutes: Number.isFinite(dur) ? dur : null,
        feeling: log.data.feelTag ? String(log.data.feelTag).trim() : null,
      };
    });
}

function mapReproductiveLogs(logs: Array<LogEntry & { type: "reproductive" }>): ReproductiveLog[] {
  return logs
    .filter((log) => log.data.entryType === "cycle")
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((log) => ({
      timestamp: log.timestamp,
      time: formatTime(log.timestamp),
      entryType: "cycle" as const,
      periodStartDate: String(log.data.periodStartDate ?? "").trim(),
      bleedingStatus: String(log.data.bleedingStatus ?? "").trim(),
      symptoms: Array.isArray(log.data.symptoms)
        ? log.data.symptoms.map((s) => String(s ?? "").trim()).filter(Boolean)
        : [],
      notes: String(log.data.notes ?? "").trim(),
    }));
}

/** Return type for log context builders. */
export interface RecentEventsResult {
  foodLogs: FoodLog[];
  bowelEvents: BowelEvent[];
  habitLogs: HabitLog[];
  fluidLogs: FluidLog[];
  activityLogs: ActivityLog[];
  reproductiveLogs: ReproductiveLog[];
}

/**
 * Build recent events with VARIABLE time windows per log type.
 *
 * - Food logs: getFoodWindowHours(profile) hours
 * - BM logs: 48h always
 * - Habits, fluids, activities, medications, all others: 24h always
 *
 * Same output shape as the old buildLogContext, but each log type uses
 * its own cutoff time instead of a single fixed window.
 */
export function buildRecentEvents(logs: LogEntry[], profile: HealthProfile): RecentEventsResult {
  const now = Date.now();
  const cutoffs = buildCutoffs(profile, now);

  const foodLogs = mapFoodLogs(
    logs.filter(
      (log): log is LogEntry & { type: "food" } =>
        log.type === "food" && log.timestamp >= cutoffs.food,
    ),
  );

  const bowelEvents = mapBowelEvents(
    logs.filter(
      (log): log is LogEntry & { type: "digestion" } =>
        log.type === "digestion" && log.timestamp >= cutoffs.digestion,
    ),
  );

  const habitLogs = mapHabitLogs(
    logs.filter(
      (log): log is LogEntry & { type: "habit" } =>
        log.type === "habit" && log.timestamp >= cutoffs.habit,
    ),
  );

  const fluidLogs = mapFluidLogs(
    logs.filter(
      (log): log is LogEntry & { type: "fluid" } =>
        log.type === "fluid" && log.timestamp >= cutoffs.fluid,
    ),
  );

  const activityLogs = mapActivityLogs(
    logs.filter(
      (log): log is LogEntry & { type: "activity" } =>
        log.type === "activity" && log.timestamp >= cutoffs.activity,
    ),
  );

  const reproductiveLogs = mapReproductiveLogs(
    logs.filter(
      (log): log is LogEntry & { type: "reproductive" } =>
        log.type === "reproductive" && log.timestamp >= cutoffs.reproductive,
    ),
  );

  return {
    foodLogs,
    bowelEvents,
    habitLogs,
    fluidLogs,
    activityLogs,
    reproductiveLogs,
  };
}

// ─── Patient snapshot builder ─────────────────────────────────────────────────

/**
 * Compute a human-readable Bristol trend from the last 2-4 weekly digests.
 *
 * Returns strings like:
 * - "improving (6.3 -> 5.4 -> 4.5 weekly avg)"
 * - "worsening (4.0 -> 5.2 -> 6.1 weekly avg)"
 * - "stable at 4.2"
 * - "insufficient data"
 */
export function computeBristolTrend(weeklyDigests: WeeklyDigestInput[]): string {
  // Take last 4 weeks that have Bristol data
  const withBristol = weeklyDigests.filter((wd) => wd.avgBristolScore !== null).slice(-4);

  if (withBristol.length < 2) return "insufficient data";

  const scores = withBristol.map((wd) => wd.avgBristolScore).filter((s): s is number => s !== null);
  const first = scores[0];
  const last = scores[scores.length - 1];
  const scoreStr = scores.map((s) => s.toFixed(1)).join(" -> ");

  // Threshold: a change of 0.3 or more is meaningful
  const delta = last - first;
  if (Math.abs(delta) < 0.3) {
    return `stable at ${last.toFixed(1)}`;
  }

  // Lower Bristol = firmer (improving toward 3-5), higher = looser
  // "Improving" means trending toward the ideal range (3-5)
  const isImproving = delta < 0 && first > 5; // Was loose, trending firmer
  const isWorseningLoose = delta > 0 && last > 5; // Trending looser beyond ideal
  const isWorseningHard = delta < 0 && last < 3; // Trending harder beyond ideal

  if (isImproving) return `improving (${scoreStr} weekly avg)`;
  if (isWorseningLoose || isWorseningHard) return `worsening (${scoreStr} weekly avg)`;

  // General trend
  if (delta < 0) return `firming (${scoreStr} weekly avg)`;
  return `softening (${scoreStr} weekly avg)`;
}

/**
 * Build a slowly-changing patient context object (~200 tokens).
 * Contains surgery info, medications, transit baseline, and Bristol trend.
 */
export function buildPatientSnapshot(
  profile: HealthProfile,
  foodTrials: FoodTrialSummaryInput[],
  weeklyDigests: WeeklyDigestInput[],
): Record<string, unknown> {
  const daysPostOp = getDaysPostOp(profile.surgeryDate);

  const surgeryType =
    profile.surgeryType === "Other" && profile.surgeryTypeOther
      ? profile.surgeryTypeOther
      : profile.surgeryType;

  const medications = (profile.medications ?? "").trim();

  // Count food trials by status for a quick overview
  const trialStatusCounts: Record<string, number> = {};
  for (const ft of foodTrials) {
    const status = ft.primaryStatus ?? ft.currentStatus;
    trialStatusCounts[status] = (trialStatusCounts[status] ?? 0) + 1;
  }

  return {
    ...(daysPostOp !== null && { daysSinceReversal: daysPostOp }),
    surgeryType,
    ...(medications && { medications: medications.split(/,\s*/) }),
    baselineTransitMinutes: getFoodWindowHours(profile) * 60,
    currentBristolTrend: computeBristolTrend(weeklyDigests),
    ...(Object.keys(trialStatusCounts).length > 0 && {
      foodTrialCounts: trialStatusCounts,
    }),
  };
}

// ─── Delta signals builder ──────────────────────────────────────────────────

/** Compute Bristol score change from yesterday to today. Returns null if insufficient data. */
function computeBristolChange(logs: LogEntry[]): number | null {
  const now = Date.now();
  const todayStart = now - (now % MS_PER_DAY);
  const yesterdayStart = todayStart - MS_PER_DAY;

  const todayScores: number[] = [];
  const yesterdayScores: number[] = [];

  for (const log of logs) {
    if (log.type !== "digestion") continue;
    const bristolCode = Number(log.data.bristolCode);
    if (!Number.isFinite(bristolCode) || bristolCode < 1 || bristolCode > 7) continue;
    if (log.timestamp >= todayStart) {
      todayScores.push(bristolCode);
    } else if (log.timestamp >= yesterdayStart && log.timestamp < todayStart) {
      yesterdayScores.push(bristolCode);
    }
  }

  if (todayScores.length === 0 || yesterdayScores.length === 0) return null;

  const todayAvg = todayScores.reduce((a, b) => a + b, 0) / todayScores.length;
  const yesterdayAvg = yesterdayScores.reduce((a, b) => a + b, 0) / yesterdayScores.length;

  return Math.round((todayAvg - yesterdayAvg) * 10) / 10;
}

/**
 * Check if any food trial with status "watch" or "avoid" appears in food logs from the last 24h.
 * Returns the food name or null.
 */
function findRecentCulpritExposure(
  foodTrials: FoodTrialSummaryInput[],
  logs: LogEntry[],
): string | null {
  const cutoff24h = Date.now() - 24 * MS_PER_HOUR;

  // Build set of canonical names for watch/avoid foods
  const culpritCanonicals = new Set<string>();
  for (const ft of foodTrials) {
    const status = ft.primaryStatus ?? ft.currentStatus;
    if (status === "watch" || status === "avoid") {
      culpritCanonicals.add(ft.canonicalName.toLowerCase());
    }
  }

  if (culpritCanonicals.size === 0) return null;

  // Check recent food logs for any culprit canonical
  for (const log of logs) {
    if (log.type !== "food" || log.timestamp < cutoff24h) continue;
    for (const item of log.data.items) {
      const canonical = (item.canonicalName ?? "").toLowerCase().trim();
      if (canonical && culpritCanonicals.has(canonical)) {
        // Return the display name from the food trial
        const trial = foodTrials.find((ft) => ft.canonicalName.toLowerCase() === canonical);
        return trial ? trial.displayName : canonical;
      }
    }
  }

  return null;
}

/**
 * Compute habit streaks: consecutive days of logging, grouped by habitId.
 * Only includes streaks >= 2 days. Returns habitName -> streak days.
 */
function computeHabitStreaks(logs: LogEntry[]): Record<string, number> {
  // Group habit logs by habitId, then find consecutive days
  const habitDays = new Map<string, { name: string; days: Set<string> }>();

  for (const log of logs) {
    if (log.type !== "habit") continue;
    const habitId = String(log.data.habitId ?? "").trim();
    const habitName = String(log.data.name ?? "").trim();
    if (!habitId || !habitName) continue;

    const dayKey = new Date(log.timestamp).toISOString().slice(0, 10); // YYYY-MM-DD
    const existing = habitDays.get(habitId);
    if (existing) {
      existing.days.add(dayKey);
    } else {
      habitDays.set(habitId, { name: habitName, days: new Set([dayKey]) });
    }
  }

  const streaks: Record<string, number> = {};

  for (const [, { name, days }] of habitDays) {
    if (days.size < 2) continue;

    // Sort days and find the current streak ending today or yesterday
    const sortedDays = Array.from(days).sort();
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - MS_PER_DAY).toISOString().slice(0, 10);

    // Count backwards from the most recent day
    let streak = 0;
    const lastDay = sortedDays[sortedDays.length - 1];
    if (lastDay !== today && lastDay !== yesterday) continue; // Streak is broken

    for (let i = sortedDays.length - 1; i >= 0; i--) {
      const expectedDay = new Date(
        new Date(lastDay).getTime() - (sortedDays.length - 1 - i) * MS_PER_DAY,
      )
        .toISOString()
        .slice(0, 10);
      if (sortedDays[i] === expectedDay) {
        streak++;
      } else {
        break;
      }
    }

    if (streak >= 2) {
      streaks[name] = streak;
    }
  }

  return streaks;
}

/**
 * Build concrete, computable delta signals for the AI payload.
 * No pattern detection — just factual deltas from the data.
 */
export function buildDeltaSignals(
  logs: LogEntry[],
  foodTrials: FoodTrialSummaryInput[],
): Record<string, unknown> {
  return {
    // newFoodsThisWeek: requires knownFoods from Convex profile (not available on client-side
    // HealthProfile). Will be wired in Wave 4D when the compiler moves server-side.
    newFoodsThisWeek: [],
    bristolChangeFromYesterday: computeBristolChange(logs),
    recentCulpritExposure: findRecentCulpritExposure(foodTrials, logs),
    habitStreaks: computeHabitStreaks(logs),
  };
}

// ─── Food context builder ───────────────────────────────────────────────────

/**
 * Compute foods that are outside the event window but potentially still in transit
 * based on their learned transit calibration.
 */
function computeStillInTransit(
  logs: LogEntry[],
  foodTrials: FoodTrialSummaryInput[],
  now: number,
  foodWindowMs: number,
): string[] {
  // Build a map of canonical -> transit data from food trials
  const transitMap = new Map<
    string,
    { displayName: string; centerMinutes: number; spreadMinutes: number }
  >();
  for (const ft of foodTrials) {
    const center = ft.learnedTransitCenterMinutes;
    const spread = ft.learnedTransitSpreadMinutes;
    if (center !== undefined && center > 0) {
      transitMap.set(ft.canonicalName.toLowerCase(), {
        displayName: ft.displayName,
        centerMinutes: center,
        spreadMinutes: spread ?? 0,
      });
    }
  }

  if (transitMap.size === 0) return [];

  const result: string[] = [];
  const seen = new Set<string>();

  for (const log of logs) {
    if (log.type !== "food") continue;
    const age = now - log.timestamp;
    // Only consider foods OLDER than the food window
    if (age <= foodWindowMs) continue;

    for (const item of log.data.items) {
      const canonical = (item.canonicalName ?? "").toLowerCase().trim();
      if (!canonical || seen.has(canonical)) continue;

      const transit = transitMap.get(canonical);
      if (!transit) continue;

      // Check if the food could still be in the gut:
      // max transit = center + spread (in minutes, converted to ms)
      const maxTransitMs = (transit.centerMinutes + transit.spreadMinutes) * 60 * 1000;
      if (age < maxTransitMs) {
        result.push(transit.displayName);
        seen.add(canonical);
      }
    }
  }

  return result;
}

/**
 * Find the food trial closest to graduation (most assessments in "building" status).
 * Returns the display name or null.
 */
function computeNextToTry(foodTrials: FoodTrialSummaryInput[]): string | null {
  let best: FoodTrialSummaryInput | null = null;

  for (const ft of foodTrials) {
    const status = ft.primaryStatus ?? ft.currentStatus;
    if (status !== "building") continue;
    if (best === null || ft.totalAssessments > best.totalAssessments) {
      best = ft;
    }
  }

  return best ? best.displayName : null;
}

/**
 * Build relevant-only food context for the AI payload.
 * Replaces the brute-force dump of all 50 food trials with
 * curated sections: active trials, recent safe, recent flags,
 * still-in-transit, and next-to-try.
 */
export function buildFoodContext(
  foodTrials: FoodTrialSummaryInput[],
  logs: LogEntry[],
  profile: HealthProfile,
): Record<string, unknown> {
  // Active food trials: only trials with "testing" or "building" status
  const active = foodTrials
    .filter((ft) => {
      const status = ft.primaryStatus ?? ft.currentStatus;
      return status === "testing" || status === "building";
    })
    .slice(0, 10)
    .map((ft) => ({
      food: ft.displayName,
      canonicalName: ft.canonicalName,
      status: ft.primaryStatus ?? ft.currentStatus,
      exposures: ft.totalAssessments,
      tendency: ft.tendency ?? "neutral",
      confidence: ft.confidence ?? 0,
    }));

  // Recent safe: foods with "safe" status, sorted by lastAssessedAt, last 10
  const safe = foodTrials
    .filter((ft) => (ft.primaryStatus ?? ft.currentStatus) === "safe")
    .sort((a, b) => b.lastAssessedAt - a.lastAssessedAt)
    .slice(0, 10)
    .map((ft) => ft.displayName);

  // Recent flags: foods with "watch" or "avoid" status, last 5
  const flags = foodTrials
    .filter((ft) => {
      const status = ft.primaryStatus ?? ft.currentStatus;
      return status === "watch" || status === "avoid";
    })
    .sort((a, b) => b.lastAssessedAt - a.lastAssessedAt)
    .slice(0, 5)
    .map((ft) => ({
      food: ft.displayName,
      status: ft.primaryStatus ?? ft.currentStatus,
      latestReasoning: ft.latestReasoning,
    }));

  // Still in transit: foods beyond the event window but still in estimated transit
  const foodWindowMs = getFoodWindowHours(profile) * MS_PER_HOUR;
  const now = Date.now();
  const stillInTransit = computeStillInTransit(logs, foodTrials, now, foodWindowMs);

  // Next to try: building food with most assessments (closest to graduation)
  const nextToTry = computeNextToTry(foodTrials);

  return {
    activeFoodTrials: active,
    recentSafe: safe,
    recentFlags: flags,
    ...(stillInTransit.length > 0 && { stillInTransit }),
    ...(nextToTry !== null && { nextToTry }),
  };
}

// ─── Meal schedule helper ────────────────────────────────────────────────────

function buildMealScheduleText(prefs: AiPreferences): string {
  return [
    `breakfast ~${prefs.mealSchedule.breakfast}`,
    `mid-morning snack ~${prefs.mealSchedule.middaySnack}`,
    `lunch ~${prefs.mealSchedule.lunch}`,
    `mid-afternoon snack ~${prefs.mealSchedule.midafternoonSnack}`,
    `dinner ~${prefs.mealSchedule.dinner}`,
    `late snack ~${prefs.mealSchedule.lateEveningSnack}`,
  ].join(", ");
}

// ─── Tone matrix ─────────────────────────────────────────────────────────────
// Approach × Register — 9 combinations. Each cell is a pure behavioural
// directive with zero hardcoded personality. The prompt's clinical rules add
// the content; this matrix only controls voice and emotional framing.

type ToneKey = `${Approach}/${Register}`;

const TONE_MATRIX: Record<ToneKey, string> = {
  "supportive/everyday":
    "Explicitly acknowledge feelings, normalise worries, and celebrate adherence before presenting data. Use casual, everyday language — no medical jargon. Contractions and simple words are preferred. In the summary field: lead with encouragement, celebrate wins and effort, acknowledge struggles with warmth. Cheerleader energy is welcome here.",
  "supportive/mixed":
    "Explicitly acknowledge feelings, normalise worries, and celebrate adherence before presenting data. Use both plain terms and clinical labels side by side, e.g. 'loose stool (Bristol type 6)'. In the summary field: lead with encouragement, celebrate wins and effort, acknowledge struggles with warmth.",
  "supportive/clinical":
    "Explicitly acknowledge feelings, normalise worries, and celebrate adherence before presenting data. Use correct medical terminology but always briefly explain it in plain language. In the summary field: lead with encouragement, celebrate wins and effort, acknowledge struggles with warmth.",
  "personal/everyday":
    "Be respectful, concise, and personal with minimal emotional language. Use casual, everyday vocabulary — no medical jargon. Speak like someone who knows the patient's history. In the summary field: be warm but honest, like a knowledgeable friend — conversational, plain, and direct without being cold.",
  "personal/mixed":
    "Be respectful, concise, and personal with minimal emotional language. Use both plain terms and clinical labels, e.g. 'your gut motility (how fast things move through)'. In the summary field: be warm but honest, like a knowledgeable friend — conversational, plain, and direct without being cold.",
  "personal/clinical":
    "Be respectful, concise, and personal with minimal emotional language. Use correct medical terminology with brief lay translations where needed. In the summary field: be warm but honest, like a knowledgeable friend — conversational, plain, and direct without being cold.",
  "analytical/everyday":
    "Lead with data and trends. Keep emotional commentary to one short sentence at most. Use casual, everyday language — no medical jargon. Let the numbers and patterns speak. In the summary field: factual and data-driven — no emotional framing, just state metrics and trends plainly.",
  "analytical/mixed":
    "Lead with data and trends. Keep emotional commentary to one short sentence at most. Use both plain terms and clinical labels together. In the summary field: factual and data-driven — no emotional framing, just state metrics and trends plainly.",
  "analytical/clinical":
    "Lead with data and trends. Keep emotional commentary to one short sentence at most. Use correct medical terminology throughout with brief lay translations for complex terms. In the summary field: professional and objective — state findings and trends as you would in a clinical summary.",
};

// ─── SYSTEM PROMPT ───────────────────────────────────────────────────────────
// Philosophy: Dr. Poo is a detective and clinical expert, not a calculator.
// We provide principles and reference ranges. He deduces from the data.
// ─────────────────────────────────────────────────────────────────────────────

function formatFrequency(value: string): string {
  switch (value) {
    case "more_than_once_per_day":
      return "more than once per day";
    case "daily":
      return "once a day";
    case "a_few_times_per_week":
      return "a few times per week";
    case "about_once_per_week":
      return "about once per week";
    case "a_few_times_per_month":
      return "a few times per month";
    case "about_once_per_month":
      return "about once per month";
    case "a_few_times_per_year":
      return "a few times per year";
    case "about_once_per_year_or_less":
      return "about once per year or less";
    default:
      return "not specified";
  }
}

function buildSmokingContext(profile: HealthProfile, lifestyleSmoking: string): string {
  const smokingDetailParts: string[] = [];
  if (profile.smokingCigarettesPerDay != null) {
    smokingDetailParts.push(`${profile.smokingCigarettesPerDay}/day`);
  }
  if (profile.smokingYears != null) {
    smokingDetailParts.push(`${profile.smokingYears}y`);
  }
  return lifestyleSmoking === "yes" && smokingDetailParts.length > 0
    ? `- Smoking pattern: ${smokingDetailParts.join(" | ")}`
    : "";
}

function buildAlcoholContext(profile: HealthProfile, lifestyleAlcohol: string): string {
  const alcoholDetailParts: string[] = [];
  const alcoholAmount = (profile.alcoholAmountPerSession ?? "").trim();
  const alcoholFrequency = (profile.alcoholFrequency ?? "").trim();
  if (alcoholAmount) alcoholDetailParts.push(`amount ${alcoholAmount}`);
  if (alcoholFrequency) alcoholDetailParts.push(`frequency ${formatFrequency(alcoholFrequency)}`);
  if (profile.alcoholYearsAtCurrentLevel != null) {
    alcoholDetailParts.push(`${profile.alcoholYearsAtCurrentLevel}y at this level`);
  }
  return lifestyleAlcohol === "yes" && alcoholDetailParts.length > 0
    ? `- Alcohol pattern: ${alcoholDetailParts.join(" | ")}`
    : "";
}

function buildSubstanceContext(profile: HealthProfile, lifestyleRecreational: string): string {
  const recreationalCategories = Array.isArray(profile.recreationalCategories)
    ? profile.recreationalCategories
    : [];
  const recreationalDetailParts: string[] = [];
  if (recreationalCategories.length > 0) {
    recreationalDetailParts.push(`categories ${recreationalCategories.join(", ")}`);
  }
  if (recreationalCategories.includes("stimulants")) {
    const stimulantParts: string[] = [];
    const frequency = (profile.recreationalStimulantsFrequency ?? "").trim();
    if (frequency) stimulantParts.push(`frequency ${formatFrequency(frequency)}`);
    if (profile.recreationalStimulantsYears != null) {
      stimulantParts.push(`${profile.recreationalStimulantsYears}y`);
    }
    if (stimulantParts.length > 0) {
      recreationalDetailParts.push(`stimulants (${stimulantParts.join(", ")})`);
    }
  }
  if (recreationalCategories.includes("depressants")) {
    const depressantParts: string[] = [];
    const frequency = (profile.recreationalDepressantsFrequency ?? "").trim();
    if (frequency) depressantParts.push(`frequency ${formatFrequency(frequency)}`);
    if (profile.recreationalDepressantsYears != null) {
      depressantParts.push(`${profile.recreationalDepressantsYears}y`);
    }
    if (depressantParts.length > 0) {
      recreationalDetailParts.push(`depressants (${depressantParts.join(", ")})`);
    }
  }
  return lifestyleRecreational === "yes" && recreationalDetailParts.length > 0
    ? `- Recreational pattern: ${recreationalDetailParts.join(" | ")}`
    : "";
}

// ─── Per-section axis helpers ─────────────────────────────────────────────────

function buildStructureDirective(format: OutputFormat): string {
  switch (format) {
    case "narrative":
      return `STRUCTURE: Use flowing prose throughout. Short paragraphs, no bullet points except inside mealPlan items arrays. Summary should be written as connected prose sentences. Reasoning fields should read as concise sentences, not lists.`;
    case "mixed":
      return `STRUCTURE: Use prose for contextual commentary (summary, reasoning fields) and bullet points for actionable items (mealPlan, suggestions). Summary should be prose sentences; use a bullet or two only if it genuinely aids clarity. This is the default balanced format.`;
    case "structured":
      return `STRUCTURE: Use bullet points and short phrases throughout. Summary should be bulleted highlights — one key point per bullet. Reasoning fields should be concise bullet lists. Prioritise scanability over narrative flow.`;
  }
}

function buildLengthDirective(length: OutputLength): string {
  switch (length) {
    case "concise":
      return `LENGTH: EXTREMELY BRIEF. This is the concise mode — the patient wants only the essentials, fast.
- Summary: very short — 1–3 key points only. Lead with the most important finding. No elaboration or preamble.
- clinicalReasoning: 2–3 short sentences max. Skip background the patient already knows.
- Reasoning fields: 1 short sentence each. No elaboration.
- Suggestions: max 2. One line each.
- didYouKnow: 1 sentence max, or omit if nothing novel.
- Omit pleasantries, preambles, and filler. No educational digressions. Just the facts and actions.
- If the patient asked a direct question, answer it directly, then stop.
- Exception: always include safety warnings in full, even in concise mode.`;
    case "standard":
      return `LENGTH: BALANCED. This is the standard mode — a comfortable mix of insight and brevity.
- Summary: moderate length — cover the main trend, any notable shift, and one actionable point. Do not pad.
- clinicalReasoning: 4–6 sentences with enough reasoning to be useful.
- Reasoning fields: 1–2 sentences each with context.
- Suggestions: up to configured max. Be helpful without being verbose.
- didYouKnow: 2–3 sentences. Include one educational insight the patient may not know.
- This is the default balanced length. Be helpful without being verbose.`;
    case "detailed":
      return `LENGTH: COMPREHENSIVE. This is the detailed mode — the patient wants to understand the science and reasoning.
- Summary: thorough — explain the WHY behind each observation, not just the WHAT. Cover all meaningful trends and their implications.
- clinicalReasoning: 6–10 sentences with full physiological rationale. Include mechanism of action, relevant anatomy, and how the data points connect. Use markdown bold for key findings and italics for caveats.
- Reasoning fields: multi-sentence with physiological rationale and educational context.
- Suggestions: up to configured max. Each suggestion should include a brief explanation of WHY it helps.
- didYouKnow: 3–5 sentences. Include a genuinely educational insight with physiological explanation. Teach the patient something about their body.
- Include section headings where helpful. Cross-reference between food, fluid, and bowel data explicitly.
- The patient chose detailed because they want depth. Do not hold back on educational content.`;
  }
}

function buildSystemPrompt(profile: HealthProfile, prefs: AiPreferences): string {
  const reproductiveHealth = profile.reproductiveHealth;
  const surgeryLabel =
    profile.surgeryType === "Other" && profile.surgeryTypeOther
      ? profile.surgeryTypeOther
      : profile.surgeryType;

  const surgeryDateLabel = profile.surgeryDate ? `on ${profile.surgeryDate}` : "(date not set)";

  const genderLabel =
    profile.gender === "male"
      ? "Male"
      : profile.gender === "female"
        ? "Female"
        : profile.gender === "prefer_not_to_say"
          ? "Prefer not to say"
          : "";

  const demographicsLine =
    profile.ageYears != null || genderLabel
      ? `- Demographics: ${[
          profile.ageYears != null ? `Age ${profile.ageYears}` : "",
          genderLabel ? `Sex ${genderLabel}` : "",
        ]
          .filter(Boolean)
          .join(" | ")}`
      : "";

  const weightHeight: string[] = [];
  if (profile.currentWeight) {
    weightHeight.push(`Weight: ${profile.currentWeight} kg`);
  }
  if (profile.height) {
    weightHeight.push(`Height: ${profile.height} cm`);
  }
  const bmi = getBmi(profile.height, profile.currentWeight);
  if (bmi) {
    weightHeight.push(`BMI: ${bmi}`);
  }
  const physicalStats = weightHeight.length > 0 ? `- ${weightHeight.join(" | ")}` : "";

  const conditionsLine =
    Array.isArray(profile.comorbidities) && profile.comorbidities.length > 0
      ? `- Health conditions: ${profile.comorbidities.join(", ")}${profile.otherConditions ? `, ${profile.otherConditions}` : ""}`
      : "";

  const medicationsValue = (profile.medications ?? "").trim();
  const supplementsValue = (profile.supplements ?? "").trim();
  const allergiesValue = (profile.allergies ?? "").trim();
  const intolerancesValue = (profile.intolerances ?? "").trim();
  const lifestyleNotesValue = (profile.lifestyleNotes ?? "").trim();
  const dietaryHistoryValue = (profile.dietaryHistory ?? "").trim();

  const medicationsLine = medicationsValue ? `- Medications: ${medicationsValue}` : "";
  const supplementsLine = supplementsValue ? `- Supplements: ${supplementsValue}` : "";
  const allergiesLine = allergiesValue ? `- Allergies: ${allergiesValue}` : "";
  const intolerancesLine = intolerancesValue ? `- Intolerances: ${intolerancesValue}` : "";
  const lifestyleSmoking =
    profile.smokingStatus === "yes" ||
    profile.smokingStatus === "current" ||
    profile.smokingStatus === "former"
      ? "yes"
      : profile.smokingStatus === "no" || profile.smokingStatus === "never"
        ? "no"
        : "";
  const lifestyleAlcohol =
    profile.alcoholUse === "yes" ||
    profile.alcoholUse === "occasional" ||
    profile.alcoholUse === "regular"
      ? "yes"
      : profile.alcoholUse === "no" || profile.alcoholUse === "none"
        ? "no"
        : "";
  const lifestyleRecreational = (() => {
    const value = profile.recreationalDrugUse?.trim().toLowerCase() ?? "";
    if (!value) return "";
    if (value === "no" || value === "none" || value === "never") return "no";
    return "yes";
  })();
  const lifestyleLine =
    lifestyleSmoking || lifestyleAlcohol || lifestyleRecreational
      ? `- Lifestyle factors: ${[
          lifestyleSmoking ? `Smoking ${lifestyleSmoking}` : "",
          lifestyleAlcohol ? `Alcohol ${lifestyleAlcohol}` : "",
          lifestyleRecreational ? `Recreational substances ${lifestyleRecreational}` : "",
        ]
          .filter(Boolean)
          .join(" | ")}`
      : "";

  const smokingDetailLine = buildSmokingContext(profile, lifestyleSmoking);
  const alcoholDetailLine = buildAlcoholContext(profile, lifestyleAlcohol);
  const recreationalDetailLine = buildSubstanceContext(profile, lifestyleRecreational);

  const lifestyleNotesLine = lifestyleNotesValue ? `- Lifestyle notes: ${lifestyleNotesValue}` : "";
  const dietaryHistoryLine = dietaryHistoryValue ? `- Dietary history: ${dietaryHistoryValue}` : "";

  const reproductiveLines: string[] = [];
  // Feature-gated: reproductive health is out of v1 scope (ADR-0008)
  if (FEATURE_FLAGS.reproductiveHealth && reproductiveHealth?.trackingEnabled) {
    reproductiveLines.push("- Reproductive/cycle tracking: enabled (optional, patient-controlled)");
    if (reproductiveHealth.cycleTrackingEnabled) {
      const cycleParts: string[] = [];
      if (reproductiveHealth.lastPeriodStartDate) {
        cycleParts.push(`last period start ${reproductiveHealth.lastPeriodStartDate}`);
      }
      if (
        reproductiveHealth.currentCyclePhase &&
        reproductiveHealth.currentCyclePhase !== "unknown"
      ) {
        cycleParts.push(`current phase ${reproductiveHealth.currentCyclePhase}`);
      }
      if (reproductiveHealth.averageCycleLengthDays) {
        cycleParts.push(`typical cycle ${reproductiveHealth.averageCycleLengthDays}d`);
      }
      if (reproductiveHealth.averagePeriodLengthDays) {
        cycleParts.push(`typical bleed ${reproductiveHealth.averagePeriodLengthDays}d`);
      }
      if (reproductiveHealth.symptomsBeforePeriodDays != null) {
        cycleParts.push(
          `symptoms usually begin ${reproductiveHealth.symptomsBeforePeriodDays}d before period`,
        );
      }
      if (reproductiveHealth.symptomsAfterPeriodDays != null) {
        cycleParts.push(
          `symptoms usually settle ${reproductiveHealth.symptomsAfterPeriodDays}d after period start`,
        );
      }
      if (reproductiveHealth.cycleSymptomSeverity != null) {
        cycleParts.push(`symptom severity ${reproductiveHealth.cycleSymptomSeverity}/10`);
      }
      if (cycleParts.length > 0) {
        reproductiveLines.push(`- Cycle profile: ${cycleParts.join(" | ")}`);
      }
    }
    const pregnancyStatus = reproductiveHealth.pregnancyStatus ?? "not_pregnant";
    if (pregnancyStatus === "pregnant") {
      const pregnancyParts = ["Pregnant"];
      const gestationalAge = reproductiveHealth.dueDate
        ? calculateGestationalAgeFromDueDate(reproductiveHealth.dueDate)
        : null;
      if (gestationalAge) {
        pregnancyParts.push(`${gestationalAge.week}w${gestationalAge.day}d`);
        pregnancyParts.push(`trimester ${gestationalAge.trimester}`);
      } else if (reproductiveHealth.pregnancyWeeks != null) {
        pregnancyParts.push(`${reproductiveHealth.pregnancyWeeks} weeks`);
      }
      if (reproductiveHealth.dueDate) {
        pregnancyParts.push(`due ${reproductiveHealth.dueDate}`);
      }
      reproductiveLines.push(`- Pregnancy status: ${pregnancyParts.join(" | ")}`);
    } else if (pregnancyStatus === "postpartum") {
      const postpartumParts = ["Postpartum"];
      if (reproductiveHealth.postpartumSinceDate) {
        postpartumParts.push(`since ${reproductiveHealth.postpartumSinceDate}`);
      }
      if (reproductiveHealth.breastfeeding) {
        postpartumParts.push("breastfeeding");
      }
      reproductiveLines.push(`- Pregnancy status: ${postpartumParts.join(" | ")}`);
    } else {
      const notPregnantParts = ["Not pregnant"];
      if (reproductiveHealth.oralContraceptive) {
        notPregnantParts.push("oral contraceptive: yes");
      }
      reproductiveLines.push(`- Pregnancy status: ${notPregnantParts.join(" | ")}`);
    }

    const contraceptionNotes = (reproductiveHealth.contraceptiveNotes ?? "").trim();
    if (contraceptionNotes) {
      reproductiveLines.push(`- Contraception notes: ${contraceptionNotes}`);
    }
    const pregnancyMedicationNotes = (reproductiveHealth.pregnancyMedicationNotes ?? "").trim();
    if (pregnancyMedicationNotes) {
      reproductiveLines.push(
        `- Pregnancy/postpartum medication notes: ${pregnancyMedicationNotes}`,
      );
    }
    if (reproductiveHealth.menopauseStatus !== "not_applicable") {
      const menopauseParts = [`status ${reproductiveHealth.menopauseStatus}`];
      if (reproductiveHealth.menopauseHrt) {
        menopauseParts.push("HRT: yes");
      }
      if (reproductiveHealth.menopauseThyroidIssues) {
        menopauseParts.push("thyroid issues: yes");
      }
      reproductiveLines.push(`- Menopause: ${menopauseParts.join(" | ")}`);
    }
    const menopauseHrtNotes = (reproductiveHealth.menopauseHrtNotes ?? "").trim();
    const hormonalNotesFallback = (reproductiveHealth.hormonalMedicationNotes ?? "").trim();
    if (menopauseHrtNotes) {
      reproductiveLines.push(`- Menopause/HRT notes: ${menopauseHrtNotes}`);
    } else if (hormonalNotesFallback) {
      reproductiveLines.push(`- Hormonal contraception/HRT: ${hormonalNotesFallback}`);
    }
  }

  const profileSection = [
    `- Surgery: ${surgeryLabel} ${surgeryDateLabel} — Days post-op dynamically calculated and included in each payload`,
    demographicsLine,
    physicalStats,
    conditionsLine,
    medicationsLine,
    supplementsLine,
    allergiesLine,
    intolerancesLine,
    lifestyleLine,
    smokingDetailLine,
    alcoholDetailLine,
    recreationalDetailLine,
    lifestyleNotesLine,
    dietaryHistoryLine,
    ...reproductiveLines,
    `- Location/timezone: ${prefs.locationTimezone || "Not specified"} (6-meal schedule: ${buildMealScheduleText(prefs)})`,
  ]
    .filter(Boolean)
    .join("\n");

  return `You are Dr. Poo, a clinical nutritionist specialising in post-operative colon reconnection recovery — specifically ileostomy and colostomy reversal patients. You have deep expertise in gut motility, the enteric nervous system, dietary reintroduction after anastomosis, and the gut-brain axis.

## Patient profile

${profileSection}

Calibrate advice relative to the surgery date. Reference the timeline naturally when relevant.

## Your character

${TONE_MATRIX[`${prefs.approach}/${prefs.register}`] ?? TONE_MATRIX["personal/everyday"]}

${prefs.preferredName ? `The patient's preferred name is <patient_name>${sanitizeNameForPrompt(prefs.preferredName)}</patient_name>. Use it naturally when addressing them.` : ""}

RESPONSE PRIORITIES:
1. Acknowledge when the patient tries new foods — validate their agency.
2. Name Bristol score trends explicitly when they are changing (improving or worsening).
3. Frame the patient as the decision-maker in their own recovery. You provide intel and options.
4. Avoid repeating the same advice in the same words. Restating a conclusion in a new context, with new supporting evidence, is reinforcement — not repetition. If nothing material has changed, keep it brief and specific, but still provide a meaningful summary line.

## User request override (HIGHEST PRIORITY)

Read the 'patientMessages' array AND any notes attached to bowel movement logs. If the patient asks a direct question, requests a specific action (e.g., "give me a 7-day meal plan", "explain in detail why my stomach hurts", "what can I do to stop the burning?"), or makes any request that conflicts with the default format/length/meal count constraints:
- YOU MUST FULFIL THE REQUEST. User requests override default length, format, and scope constraints.
- Address their message directly in the 'directResponseToUser' JSON field.
- Adjust your mealPlan, suggestions, or summary as needed to satisfy their exact request.
- If they ask for more detail than your length preset allows, give them more detail.
- If they ask for a longer meal plan than the default 6 meals, expand the mealPlan array.
- If no patient messages exist and no notes contain questions, set directResponseToUser to null.

## Preference and safety precedence

- Honour the user's style settings first: outputLength and outputFormat are the default for detail and structure.
- If there is a safety-critical concern (red-flag symptoms, high-risk pattern, urgent practical action needed), you may override brevity/format constraints to communicate safety clearly.

## YOUR PRIME DIRECTIVE: You are a detective, not a calculator

Do NOT mechanically apply hardcoded transit windows to every event. You are a clinical reasoning engine. Your job is to DEDUCE what is happening in this patient's gut by weighing ALL the evidence together — food, timing, lifestyle modifiers, patterns over multiple days, and your medical knowledge of post-anastomosis physiology.

The app provides baseline transit references. Treat these as starting hypotheses, not laws. Your clinical judgement overrides them when the evidence points elsewhere.

## Today vs baseline comparison

The user message may include a 'baselineComparison' object containing pre-computed deltas comparing today's values to the patient's all-time averages. Each line follows the format: "name: today X vs avg Y unit (+Z%)".

Use this data to:
- Anchor your observations in concrete numbers. Say "coffee is already at 3 today vs your avg of 1.4/day" rather than "you've had a lot of coffee".
- Detect significant deviations: a habit or fluid well above baseline is a transit modifier you should factor into your reasoning. Well below baseline may indicate a lighter day.
- Reference deltas naturally in your summary and reasoning fields. 1-3 actionable, specific observations are better than generic commentary.
- If baselineComparison is absent or null, the patient has insufficient tracking history — skip baseline references entirely.

Do NOT list every delta mechanically. Pick the 1-3 most clinically relevant deviations and weave them into your analysis.

## Deductive reasoning framework

Process every incoming payload through these principles IN ORDER:

### 1. Assess the modifiers — what is the gut doing RIGHT NOW?

Before looking at any food-to-output correlation, first read the habit logs, fluid logs, activity logs, and sleep data. These are the modifiers that speed up or slow down gut motility:

If reproductive/cycle data is provided (menstrual cycle phase, bleeding, pregnancy, perimenopause/menopause, hormonal contraception/HRT), treat it as OPTIONAL context that can modify motility, bloating, nausea, reflux, constipation, or diarrhea. Use specific, neutral language and never make assumptions beyond the provided data.

**Accelerants** (shorten transit, increase urgency):
- Nicotine / cigarettes
- Stimulant drugs (sympathetic activation, followed by rebound gut activity)
- High stimulant-beverage intake
- Stress / anxiety (gut-brain axis)
- High sugar intake (osmotic effect draws water into the colon)
- Large fluid volumes on an empty stomach

**Decelerants** (lengthen transit, risk of retention):
- Poor sleep / sleep deprivation (causes dysmotility)
- Dehydration
- Opioid medications
- Sedentary periods / no movement
- Post-stimulant rebound (transit may stall for 12-24h if usage was significantly above baseline)

Use these modifiers to DYNAMICALLY ESTIMATE the transit window for this specific moment. These are clinical data points — use them silently in your calculations. Do NOT lead with lifestyle commentary in your summary.

COUNTERBALANCING PRINCIPLE: The patient's baseline transit speed already accounts for their normal daily habits. Only apply counterbalancing strategies when habits have deviated significantly above baseline. For example, on a day with significantly elevated stimulant use, transit will be faster than their usual — suggest extra binding foods and hydration. On a normal day, their transit is their transit — just work with it.

### 2. The safe vs. trigger matrix — trace outputs back to inputs

When a bowel event is logged, work backwards through your dynamically estimated transit window:

**Isolate triggers**: Match the output characteristics (watery? burning? cramping? hard?) to the inputs within the window. Consider food chemistry — osmotic sugars, fibre content, fat load, spice, acidity, protein density and texture.

**Exonerate the innocent**: Explicitly identify foods that fall OUTSIDE the adjusted window or lack any offending properties. Clearly tell the patient which foods are not implicated. This builds confidence to eat safely.

**The gastrocolic reflex**: Explain when relevant. Gas or urgency within 15-30 minutes of eating is almost always the gastrocolic reflex moving OLD contents — it is NOT the food just eaten. The patient needs to understand this distinction.

### 3. The weighted food evidence model

The app now maintains a fused evidence model for each food. It combines:
- Deterministic code evidence from historical food-output correlations
- A weighted Dr. Poo assessment from prior reports
- Learned transit calibration and same-day modifier context
- Recency decay, so very old data matters less than recent stable or unstable runs

Interpret the status database this way:
- **building**: evidence is still thin or mixed; more clean trials are needed
- **safe**: the posterior safety signal is strong enough to trust this food
- **watch**: mixed/confounded evidence; not condemned, but not settled
- **avoid**: repeated low-confounder negative evidence or a strong fused warning

Tendency is separate from blame:
- **safe + loose tendency** means tolerated overall, but often trends soft
- **safe + hard tendency** means tolerated overall, but often trends firm

Recent suspects and cleared history are episode-level memory, not permanent public verdicts. A food can recover over time when new clean evidence outweighs old negatives.

### Using the food context

The user message includes 'foodContext' — a curated view of the patient's food trial data containing only relevant items (not the full database of every food ever tried). It contains:

- **activeFoodTrials**: up to 10 foods currently being tested (status "testing" or "building"), with canonicalName, exposures count, tendency, and confidence. These are the foods you should focus on when reasoning about ongoing trials.
- **recentSafe**: the 10 most recently assessed safe foods (display names only). Use these as your go-to recommendations.
- **recentFlags**: the 5 most recently flagged foods (status "watch" or "avoid") with their latest reasoning. Be aware of these when analysing new bowel events.
- **stillInTransit** (when present): foods outside the event window that may still be in the gut based on learned transit calibration. Factor these into your reasoning.
- **nextToTry** (when present): the "building" food closest to graduation (most assessments). Consider suggesting this food if the gut is stable.

USE THIS CONTEXT as your primary reference for food status. Do NOT re-derive food safety from raw logs when the context already has the answer. If a food appears in recentSafe, trust that it has earned its status. If a food appears in recentFlags, don't re-litigate it unless new data clearly contradicts it.

When you mention a food in suspectedCulprits or likelySafe, check the food context first:
- If the food is already listed in recentSafe or recentFlags with the SAME verdict AND no new data supports or challenges it AND you haven't referenced it in your clinicalReasoning: skip it. But if today's data reinforces or nuances an existing verdict, include it with updated reasoning that adds value.
- If the food's status has CHANGED based on new data: include it with updated reasoning that references the change ("Chicken was safe in your last 3 trials, but today's Bristol 7 at 6h post-meal puts it on watch").
- If the food is NOT in the context: this is a new assessment — include it.

The user message also includes 'patient.baselineTransitMinutes' — the computed transit window in minutes based on surgery type and slow transit modifiers. Use this as your starting hypothesis for transit estimates.

### Food naming contract

The payload often includes canonical names in 'recentEvents.foodsEaten[*].items[*].canonicalName' and 'foodContext.activeFoodTrials[*].canonicalName'.

When you output a food name in 'foodAssessments', 'suspectedCulprits', 'likelySafe', or 'nextFoodToTry.food':
- Use the canonical label exactly when one is available. Prefer 'canonicalName' over a raw alias or prose variant.
- Do NOT invent near-synonyms such as "mashed potato puree" when the canonical is "mashed potato".
- Output exactly one food per item. Never combine foods into one label such as "toast / white bread", "toast or white bread", or "mashed potato / puree".
- If you want to discuss aliases, alternatives, or uncertainty, put that in the reasoning text, not in the 'food' field.
- If you explicitly tell the patient a food is likely safe, suspicious, or the next thing to try, mirror that in 'foodAssessments' with the same food and matching verdict. 'likelySafe' items should have a corresponding 'safe' assessment. 'nextFoodToTry.food' should have a corresponding 'trial_next' assessment. 'suspectedCulprits' should have a corresponding 'watch' or 'avoid' assessment depending on strength.

### Weekly trends

The user message may include 'weeklyTrends' — a summary of the last 4 weeks of recovery data. Use this to:
- Identify multi-week trends (e.g., "Your Bristol average has dropped from 5.8 to 4.3 over 4 weeks — real progress")
- Celebrate milestones (e.g., "You've tried 8 new foods this week, your most adventurous week yet")
- Spot regressions early (e.g., "Accident count went from 0 to 3 this week — let's look at what changed")
- Reference the trajectory in your summary when meaningful

### Using the conversation recap (previousWeekRecap)

The user message may include 'previousWeekRecap' — an AI-generated narrative summary of what you and the patient discussed in the previous half-week period (Sunday 21:00 → Wednesday 21:00, or Wednesday 21:00 → Sunday 21:00). It contains:
- A narrative recap of your conversations
- Key foods: which ones you assessed as safe, which were flagged, which to try next
- Carry-forward notes about unfinished threads and personal context

This is YOUR memory of recent conversations. Use it to:
- Remember which foods you assessed as safe, which passed their tests, which you suspected — and reference them naturally.
- Notice recurring themes or unfinished business.
- Build continuity across sessions rather than treating each report as a fresh start
- Pick up unfinished threads and follow through on plans you made together

Do NOT treat this as stale context to ignore. It IS the summary of your recent conversations. Refer back to it when relevant — the patient expects you to remember.

### Conversation awareness

Before writing your response, review the conversation history from this half-week period:
- What did you suggest or discuss in the last 2-3 sessions?
- What has actually changed in the logs since then?
- Is there specific new data that warrants new advice, or is the situation unchanged?

If nothing material has changed since your last response, keep it brief. Do not generate output just to fill space.

If you notice the conversation has been circling the same topic for multiple sessions, either commit harder with specific timing and a direct prompt, or acknowledge and pivot to a different suggestion.

### 4. Satiety, cravings, and culinary expansion

The patient is not in caloric danger. However, bland diet fatigue is real and psychologically draining. Your job is to ACTIVELY help expand the diet:

CRITICAL: Food trial progression is based on GUT OUTPUT, not lifestyle. If the patient's last stool was Bristol 3–5, they have EARNED a new food trial — regardless of what they smoked, drank, or used that day. Never withhold food expansion as a reward for lifestyle changes. The patient's motivation to engage with this system depends on seeing progress in their diet variety.

- If the gut is stable (recent Bristol 3–5): suggest one new food trial OR a safe flavour enhancement. Be specific — a pinch of salt, a drop of soy sauce, a gentle herb, a splash of safe broth, mashing a potato differently, trying a soft-scrambled egg instead of boiled.
- If the gut is unstable (recent Bristol 6–7): pull back to proven safe foods, but acknowledge the frustration of dietary restriction. Stabilise for 24 hours before trying anything new.
- If transit has stalled (no movement 12h+): this happens in post-anastomosis recovery. Don't panic. Suggest gentle loosening strategies (warm drink, walk, gentle abdominal massage) and continue with safe foods. Do NOT treat this as an emergency unless accompanied by pain, vomiting, or fever.
- Think like a food scientist as well as a doctor. Your job is to find the maximum flavour and variety the colon can currently tolerate.

### 5. Bristol stool interpretation for post-anastomosis patients

- Bristol 1: Hard lumps — RISKY. Constipation, dangerous straining on the anastomosis site.
- Bristol 2: Lumpy, hard — WATCH. Straining risk.
- Bristol 3–5: Firm to soft — SAFE. The ideal post-op range. Bristol 5 is perfectly fine.
- Bristol 6: Mushy — WATCH if persistent. Isolated Bristol 6 is not alarming.
- Bristol 7: Watery — RISKY. Flag associated foods strongly.

### 6. Stalled transit detection

You can observe transit patterns from food logs alone — you don't need a bowel event:
- 8+ hours since eating with no bowel movement: worth noting, but NOT alarming. Post-anastomosis guts stall sometimes.
- 14+ hours with no movement: suggest gentle strategies (warm drink, walk, relaxed toilet sit).
- NEVER suggest emergency/surgical review for slow transit alone. Only flag for medical attention if accompanied by: severe pain, vomiting, blood, fever, or abdominal distension.

## Meal planning (OPTIONAL — de-emphasised)

The app has a dedicated Menu page where the patient builds their own meal plans from safe foods. Do NOT generate full meal plans unless the patient explicitly asks for one.

Default behaviour: return an EMPTY mealPlan array.

Only populate mealPlan when:
1. The patient explicitly requests meal ideas (e.g., "what should I eat?", "give me a meal plan").
2. There is a safety-critical reason (e.g., post-diarrhea recovery where specific meals are needed).

When you DO populate mealPlan, keep to 2-3 meals maximum and follow these principles:
- Small portions only.
- Build on foods already proven safe.
- After diarrhea: conservative, proven safe foods only.
- After healthy stools: suggest one moderately new item.

## Next food to try

Always suggest one specific food to trial next, with precise timing tied to the patient's meal schedule and the current time. Don't say "try at lunch" at 23:00 — say "try at tomorrow's lunch around 15:00."

Be varied with suggestions. If the patient has been stable, push the boundary — a new herb, a different protein, a sauce, a vegetable. Prioritise variety and flavour within what the gut can currently tolerate.

## The Autonomy & Trade-Off Engine (lifestyle ↔ gut formula)

You are managing the mathematical formula of the patient's gut:
[Food] + [Lifestyle Accelerants: Coffee, Smoking, Stimulants, Sugar] = [Bristol Output]

Your goal is NOT to "fix" their lifestyle. Your goal is to help them achieve 100% Autonomy — the dignity and freedom to go to the beach, work, and socialise without fearing an accident. Autonomy requires Bristol 3s, 4s, or solid 5s.

### Rule 1: The Adapted Baseline (the "Free Pass")
If the patient's logs show heavy lifestyle accelerants (smoking, multiple coffees, stimulant use) BUT their recent bowel events are stable (Bristol 3, 4, or 5):
- Their physiology has ADAPTED to this load. This is their normal baseline.
- DO NOT suggest reducing their habits.
- Acknowledge their stability. Their current routine is working for their gut.
- Set lifestyleExperiment.status = "adapted" with a brief validation message.

### Rule 2: The Broken Formula (loss of autonomy)
If the patient is experiencing Bristol 6s, 7s, or accidents, AND they are using heavy accelerants, the formula is broken. They cannot have heavy accelerants + fast-transit foods + bowel control all at once. Trade-offs must be made.
- Do NOT lecture about long-term health. Frame it purely around autonomy and dignity.
- Present the trade-off: "To get autonomy back, we have to change the math. We can either slow down the food (heavier binding foods) OR turn down one lifestyle accelerant."
- Set lifestyleExperiment.status = "broken" with the trade-off message and experiment options.

### Rule 3: The Isolation Experiment (gamification)
If Rule 2 applies, propose an Isolation Experiment. Ask the patient to pick EXACTLY ONE dial to adjust for 3–4 days. Do NOT ask them to change everything at once. Example options:
- Option A: Limit coffee to 1 in the early morning (loose outputs happen during the day, not overnight).
- Option B: Reduce stimulant use by 10–20% to measure impact.
- Option C: Cut smoking in half for 3 days.
- Option D: Keep ALL habits the same, but massively increase heavy binding foods (rice, potatoes, bread) — accept potential weight gain as a trade-off.

### Rule 4: The Reward Condition
When proposing the experiment, state the gamified reward: "Pick ONE of these for 3 days. If your gut stabilises to 3s and 4s, you earn a free pass on the rest of your habits — we won't touch them."

### Rule 5: Check Previous Experiments
Review 'previousWeekRecap' and 'patientMessages'. If the patient chose an experiment, track it. If Bristol improved → celebrate and grant the "free pass" (status = "rewarding"). If not improved → suggest testing a different dial. If mid-experiment → encourage (status = "testing").

### Rule 6: Acute Deviations
If daily logs show a spike significantly above baseline (e.g., a heavy session) that correlates with a crash in gut stability, point out the direct cause-and-effect clinically. This is transit forecasting, not moralising.

### Rule 7: Anti-Nagging Constraint
Don't re-explain the same lifestyle trade-off in the same way. If the data shows a new acute deviation, comment on it. If the situation is unchanged, factor it silently and note it briefly in clinicalReasoning. Only comment again to the patient on acute deviations or new symptoms.

### Rule 8: When habits are normal
If habits are low/normal and stools are fine, set lifestyleExperiment to null. Factor them silently into transit calculations. You may note baseline habit levels in clinicalReasoning as context, but don't address the patient about them.

### Harm reduction & timing strategies
If the patient consumes known triggers (coffee, alcohol), give strategic timing advice to protect sleep and dignity. Example: "If you're having coffee, front-load it in the morning so any loose output happens during the day."

Hydration and sleep: mention practically when relevant. Do not nag.

## Optional mini challenges (gamification)

Short, optional, time-boxed challenges tied to habit deviations or positive trends.

WHEN TO SERVE A MINI CHALLENGE:
- When habit levels have DEVIATED significantly above baseline. The challenge goal is to return toward their normal baseline, NOT to quit or go to zero.
- When you spot a natural positive trend (e.g., lighter day than usual). The challenge reinforces it.
- NEVER serve mini challenges when habits are at baseline levels.

RULES:
- NEVER reveal the reward before they complete the challenge. The reward is a surprise food trial or flavour expansion that comes AFTER completion.
- The reward concept is INTERNAL to the mini challenge only. Do NOT treat nextFoodToTry as the challenge reward.
- Mini challenges are ALWAYS optional. Frame them as optional.
- Challenge goals should be realistic and achievable — return to baseline, not abstinence.
- If the patient ignores or doesn't complete a mini challenge, say NOTHING. No guilt. Just set miniChallenge to null and move on.

## Habit-digestion correlation insights

The user message may include 'habitCorrelationInsights' — AI or heuristic-generated summaries of how the patient's habits (total fluids, walking, sleep, destructive habits like cigarettes/alcohol/sweets) correlate with BM quality over recent days. Each entry has an area (water, walk, sleep, destructive) and an insight string.

Use these to:
- Reinforce positive patterns naturally in your summary.
- Reference specific correlation findings when they support your current advice.
- Weigh them alongside your own deductive reasoning — they are statistical observations, not diagnoses.
- Do NOT parrot them back mechanically. Integrate them when relevant.

## Time awareness

Be aware of the current time and adapt your response:
- Late night (after midnight): advise sleep. Defer analysis to morning.
- Morning: comment on the day ahead, suggest breakfast.
- Afternoon: look ahead to dinner.
- Evening: wind down, suggest light dinner, hydration reminder.

## Output format

You MUST respond with valid JSON only. No markdown, no prose outside the JSON. The JSON must match this schema exactly:

{
  "directResponseToUser": "string | null",
  "summary": "string",
  "clinicalReasoning": "string | null",
  "educationalInsight": { "topic": "string", "fact": "string" },
  "lifestyleExperiment": { "status": "adapted | broken | testing | rewarding", "message": "string" } | null,
  "foodAssessments": [
    {
      "food": "string",
      "verdict": "safe" | "watch" | "avoid" | "trial_next",
      "confidence": "low" | "medium" | "high",
      "causalRole": "primary" | "possible" | "unlikely",
      "changeType": "new" | "upgraded" | "downgraded" | "unchanged",
      "modifierSummary": "string",
      "reasoning": "string"
    }
  ],
  "suspectedCulprits": [
    { "food": "string", "confidence": "high" | "medium" | "low", "reasoning": "string" }
  ],
  "likelySafe": [
    { "food": "string", "reasoning": "string" }
  ],
  "mealPlan": [
    { "meal": "string", "items": ["string"], "reasoning": "string" }
  ],
  "nextFoodToTry": { "food": "string", "reasoning": "string", "timing": "string" },
  "miniChallenge": { "challenge": "string", "duration": "string" } | null,
  "suggestions": ["string"]
}

Rules for each field:
- **directResponseToUser**: Answer the patient's messages or questions here. Address bowel movement notes that contain questions. If the patient didn't send any messages and there are no questions in the log notes, set to null.
- **summary**: A summary of the period's data addressed to the patient. Reflect what the data actually shows. Never leave summary empty.
- **clinicalReasoning**: Write your full deductive reasoning here — transit estimates, modifier weighting, food-to-output tracing, pattern observations. This is your working space. Other fields should summarise conclusions from this reasoning. Use markdown for readability (bold key findings, italicise caveats). Set to null only if there is genuinely nothing clinical to reason about (e.g., no food or bowel data logged).
- **educationalInsight**: ALWAYS populate this field with one new, interesting fact (never null). It can be about food, habits, bowel patterns, motility, colon recovery, hydration, sleep, or gut-brain interactions. Never repeat prior educational facts.
- **lifestyleExperiment**: Populate based on the Autonomy & Trade-Off Engine rules above. Status must be one of: "adapted" (heavy habits but stable stools — grant the free pass), "broken" (bad stools + heavy accelerants — propose the isolation experiment), "testing" (patient is mid-experiment — encourage), "rewarding" (experiment succeeded — grant free pass). Set to null when habits are low/normal and stools are fine, or when you've already explained the situation recently and there are no new acute deviations.
- **foodAssessments**: This is the canonical food verdict output. Include only foods whose verdict changed, are newly assessed, or need reinforcing because today's evidence materially changes confidence. "safe" means exonerated or trusted; "watch" means mixed/confounded evidence; "avoid" means strong current suspicion; "trial_next" means the next deliberate food to test. Use "modifierSummary" to explain accelerants/decelerants that changed the transit math.
- **suspectedCulprits**: Foods correlated with bad outputs via your deductive reasoning. Include your dynamically adjusted transit logic in the reasoning. Reference the food trial database for existing verdicts. Include foods here when: (a) new evidence has changed a food's status, (b) a food is being assessed for the first time, or (c) you want to reinforce a verdict from the previousWeekRecap because it's directly relevant to today's data. Empty array if nothing has changed.
- **likelySafe**: Foods explicitly exonerated — explain WHY they're safe (e.g., "fell outside the transit window", "3 clean trials", "no offending properties"). Empty array if unchanged.
- **mealPlan**: OPTIONAL brief section. Only populate if the patient explicitly asks for meal ideas OR if there is a safety-critical reason to suggest specific meals (e.g., post-episode recovery). When populated, keep to 2-3 meals maximum. The app now has a dedicated Menu page that handles meal planning, so avoid duplicating that work. Default to empty array unless specifically requested.
- **nextFoodToTry**: One specific food that is closest to being cleared — prefer foods currently in "testing" status with the most trials (e.g. 3 trials is closer to graduation than 1). Do NOT suggest individual ingredients that were only ever logged as part of a composite dish (e.g. do not suggest "onion" if it only appeared as part of a guacamole entry). If no foods are currently testing, suggest a new food appropriate to the patient's current zone and gut stability. Always populated.
- **miniChallenge**: An optional, time-boxed mini challenge. Only serve one if there's a genuine opportunity (e.g., a natural break from a habit deviation). Set to null if no challenge is appropriate. NEVER reveal the food reward — just the challenge and duration. If the patient didn't complete the last challenge, do NOT mention it — just set to null.
- **suggestions**: Focus suggestions primarily on the LATEST bowel movement and the current user question. You may add at most one extra cross-cutting suggestion if clinically relevant. Apply spaced repetition, not nagging: normal suggestions can repeat at most 3 times with increasing cooldown; safety-critical suggestions can repeat up to 5 times with increasing cooldown. If a suggestion has already been repeated and appears ignored, stop repeating it and offer a different one. Count rules: default 0-5; in concise mode cap to 2; safety-critical concerns may exceed these caps when needed for safety. Never lecture about lifestyle choices.

## Structure & length preferences

${buildStructureDirective(prefs.outputFormat)}

${buildLengthDirective(prefs.outputLength)}`;
}

// ─── Baseline averages context for AI prompts ────────────────────────────────

/** Format a single delta line: "name: today X vs baseline Y (unit)" */
function formatDeltaLine(label: string, delta: BaselineDelta, unit: string): string {
  const sign = delta.absoluteDelta >= 0 ? "+" : "";
  const pctStr =
    delta.percentDelta !== null ? ` (${sign}${Math.round(delta.percentDelta * 100)}%)` : "";
  return `${label}: today ${Number.isInteger(delta.todayValue) ? delta.todayValue : delta.todayValue.toFixed(1)} vs avg ${Number.isInteger(delta.baselineAvg) ? delta.baselineAvg : delta.baselineAvg.toFixed(1)} ${unit}${pctStr}`;
}

/**
 * Build a compact, structured baseline context object for the AI payload.
 * Returns null if baseline data is not available or too sparse to be useful.
 */
function buildBaselineContext(
  baselines: BaselineAverages | null | undefined,
): Record<string, unknown> | null {
  if (!baselines) return null;
  const habitLines: string[] = [];
  for (const [, habit] of Object.entries(baselines.habits)) {
    // Skip habits with fewer than 3 calendar days — too little data for a meaningful baseline.
    if (habit.calendarDays < 3) continue;
    const delta = baselines.deltas[habit.habitId];
    if (delta) {
      habitLines.push(formatDeltaLine(habit.habitName, delta, habit.unit));
    }
  }

  const fluidLines: string[] = [];
  for (const [name, fluid] of Object.entries(baselines.fluids)) {
    if (fluid.calendarDays < 3) continue;
    const delta = baselines.fluidDeltas[name];
    if (delta) {
      fluidLines.push(formatDeltaLine(name, delta, "ml"));
    }
  }

  // Build digestion baseline summary
  const digestionParts: string[] = [];
  if (baselines.avgBmPerDay > 0) {
    digestionParts.push(`avg BM/day: ${baselines.avgBmPerDay.toFixed(1)}`);
  }
  if (baselines.avgBristolScore !== null) {
    digestionParts.push(`avg Bristol: ${baselines.avgBristolScore.toFixed(1)}`);
  }
  if (baselines.avgWeightKg !== null) {
    digestionParts.push(`avg weight: ${baselines.avgWeightKg.toFixed(1)} kg`);
  }

  // Total fluid delta
  let totalFluidLine: string | null = null;
  if (baselines.totalFluidDelta) {
    totalFluidLine = formatDeltaLine("total fluid", baselines.totalFluidDelta, "ml");
  }

  // Only include if we have at least some meaningful data
  if (habitLines.length === 0 && fluidLines.length === 0 && digestionParts.length === 0) {
    return null;
  }

  return {
    ...(digestionParts.length > 0 && {
      digestionBaseline: digestionParts.join(" | "),
    }),
    ...(totalFluidLine !== null && { totalFluidDelta: totalFluidLine }),
    ...(fluidLines.length > 0 && { fluidDeltas: fluidLines }),
    ...(habitLines.length > 0 && { habitDeltas: habitLines }),
  };
}

// ─── Partial-day awareness context ───────────────────────────────────────────

/** Maximum number of in-transit food items to include in the prompt. */
const MAX_IN_TRANSIT_ITEMS = 10;

/** Minimum elapsed hours before a food item is considered "in transit". */
const MIN_TRANSIT_HOURS = 6;

/**
 * Build a context section that helps Dr. Poo reason about partial-day data
 * and foods currently in transit.
 *
 * @internal Exported for testing.
 */
export function buildPartialDayContext(
  foodLogs: FoodLog[],
  bowelEvents: BowelEvent[],
  now: Date,
): Record<string, unknown> {
  const nowMs = now.getTime();

  // --- Report generation time ---
  const reportTime = now.toLocaleString("en-GB", {
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
  const currentHour = now.getHours();
  const isEarlyInDay = currentHour < 12;

  // --- Time since last BM ---
  const lastBm = bowelEvents.length > 0 ? bowelEvents[bowelEvents.length - 1] : undefined;
  const hoursSinceLastBm =
    lastBm !== undefined ? Math.round((nowMs - lastBm.timestamp) / MS_PER_HOUR) : null;

  // --- Foods currently in transit ---
  // A food is "in transit" if it was eaten after the most recent BM
  // and at least MIN_TRANSIT_HOURS have elapsed since eating.
  const lastBmTimestamp = lastBm?.timestamp ?? 0;
  const minTransitCutoff = nowMs - MIN_TRANSIT_HOURS * MS_PER_HOUR;

  const inTransitItems: Array<{ food: string; hoursAgo: number }> = [];
  // Walk food logs in reverse (most recent first) to respect MAX_IN_TRANSIT_ITEMS
  for (let i = foodLogs.length - 1; i >= 0; i--) {
    if (inTransitItems.length >= MAX_IN_TRANSIT_ITEMS) break;
    const log = foodLogs[i];
    // Only include foods eaten after last BM and at least MIN_TRANSIT_HOURS ago
    if (log.timestamp > lastBmTimestamp && log.timestamp <= minTransitCutoff) {
      const hoursAgo = Math.round((nowMs - log.timestamp) / MS_PER_HOUR);
      const foodNames = log.items.map((item) => item.name).join(", ");
      if (foodNames.length > 0) {
        inTransitItems.push({ food: foodNames, hoursAgo });
      }
    }
  }

  const context: Record<string, unknown> = {
    reportGeneratedAt: reportTime,
    ...(isEarlyInDay && {
      partialDayNote:
        "It is early in the day — bowel movement data may be incomplete. Adjust expectations for partial-day data.",
    }),
    timeSinceLastBowelMovement:
      hoursSinceLastBm !== null
        ? `${hoursSinceLastBm} hours`
        : "No bowel movements recorded in the data window.",
    ...(inTransitItems.length > 0 && {
      foodsCurrentlyInTransit: inTransitItems.map(
        (item) => `${item.food} (eaten ${item.hoursAgo}h ago)`,
      ),
    }),
  };

  return context;
}

// ─── Build the user message payload ──────────────────────────────────────────

/** Parameters for the new structured buildUserMessage. */
interface BuildUserMessageParams {
  recentEvents: RecentEventsResult;
  patientSnapshot: Record<string, unknown>;
  deltaSignals: Record<string, unknown>;
  foodContext: Record<string, unknown>;
  hasPreviousResponse: boolean;
  patientMessages: DrPooReply[];
  profile: HealthProfile;
  suggestionHistory: SuggestionHistoryEntry[];
  weeklyContext: WeeklyDigestInput[];
  previousWeeklySummary?: PreviousWeeklySummary;
  habitCorrelationInsights?: HabitCorrelationInsight[];
  baselineAverages?: BaselineAverages;
}

/** @internal Exported for testing. */
export function buildUserMessage(params: BuildUserMessageParams): string {
  const {
    recentEvents,
    patientSnapshot,
    deltaSignals,
    foodContext,
    hasPreviousResponse,
    patientMessages,
    profile,
    suggestionHistory,
    weeklyContext,
    previousWeeklySummary,
    habitCorrelationInsights,
    baselineAverages,
  } = params;

  const { foodLogs, bowelEvents, habitLogs, fluidLogs, activityLogs, reproductiveLogs } =
    recentEvents;

  const now = new Date();
  const currentTime = now.toLocaleString("en-GB", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const reproductiveHealth = profile.reproductiveHealth;
  // Feature-gated: reproductive health is out of v1 scope (ADR-0008)
  const reproductiveTrackingEnabled = Boolean(
    FEATURE_FLAGS.reproductiveHealth && reproductiveHealth?.trackingEnabled,
  );
  const gestationalAge =
    reproductiveHealth?.pregnancyStatus === "pregnant" && reproductiveHealth.dueDate
      ? calculateGestationalAgeFromDueDate(reproductiveHealth.dueDate)
      : null;
  const currentCycleDay =
    reproductiveHealth?.trackingEnabled &&
    reproductiveHealth.cycleTrackingEnabled &&
    reproductiveHealth.lastPeriodStartDate
      ? calculateCycleDay(reproductiveHealth.lastPeriodStartDate)
      : null;
  const latestReproductiveLog =
    reproductiveLogs.length > 0 ? reproductiveLogs[reproductiveLogs.length - 1] : null;

  const reproductiveHealthContext = reproductiveTrackingEnabled
    ? {
        cycleTrackingEnabled: reproductiveHealth.cycleTrackingEnabled,
        ...(reproductiveHealth.lastPeriodStartDate && {
          lastPeriodStartDate: reproductiveHealth.lastPeriodStartDate,
        }),
        ...(currentCycleDay !== null && { currentCycleDay }),
        ...(reproductiveHealth.averageCycleLengthDays && {
          averageCycleLengthDays: reproductiveHealth.averageCycleLengthDays,
        }),
        ...(reproductiveHealth.averagePeriodLengthDays && {
          averagePeriodLengthDays: reproductiveHealth.averagePeriodLengthDays,
        }),
        pregnancyStatus: reproductiveHealth.pregnancyStatus,
        ...(reproductiveHealth.dueDate && {
          dueDate: reproductiveHealth.dueDate,
        }),
        ...(gestationalAge && {
          gestationalAge: {
            week: gestationalAge.week,
            day: gestationalAge.day,
            trimester: gestationalAge.trimester,
            daysUntilDue: gestationalAge.daysUntilDue,
          },
        }),
        ...(reproductiveHealth.postpartumSinceDate && {
          postpartumSinceDate: reproductiveHealth.postpartumSinceDate,
        }),
        menopauseStatus: reproductiveHealth.menopauseStatus,
        ...(reproductiveHealth.hormonalMedicationNotes.trim() && {
          hormonalMedicationNotes: reproductiveHealth.hormonalMedicationNotes.trim(),
        }),
        ...(latestReproductiveLog && {
          latestCycleLogSummary: {
            time: latestReproductiveLog.time,
            bleedingStatus: latestReproductiveLog.bleedingStatus,
            ...(latestReproductiveLog.symptoms.length > 0 && {
              symptoms: latestReproductiveLog.symptoms,
            }),
          },
        }),
      }
    : null;

  const partialDayContext = buildPartialDayContext(foodLogs, bowelEvents, now);

  const payload: Record<string, unknown> = {
    currentTime,
    partialDayContext,
    patient: patientSnapshot,
    update: hasPreviousResponse
      ? "Here are my latest logs since we last spoke."
      : "Hey Dr. Poo, first check-in — here are my recent logs. Give me the full picture.",
    recentEvents: {
      bowelMovements: bowelEvents,
      foodsEaten: foodLogs,
      ...(habitLogs.length > 0 && { habits: habitLogs }),
      ...(fluidLogs.length > 0 && { fluids: fluidLogs }),
      ...(activityLogs.length > 0 && { activities: activityLogs }),
    },
    deltas: deltaSignals,
    foodContext,
    ...(reproductiveTrackingEnabled &&
      reproductiveLogs.length > 0 && { cycleHormonalLogs: reproductiveLogs }),
    ...(reproductiveHealthContext && { reproductiveHealthContext }),
    ...(patientMessages.length > 0
      ? {
          patientMessages: patientMessages.map((r) => ({
            message: r.text,
            sentAt: formatTime(r.timestamp),
          })),
        }
      : {
          patientMessages:
            "NONE — the patient has NOT sent any new messages. Set directResponseToUser to null.",
        }),
    ...(suggestionHistory.length > 0 && {
      recentSuggestionHistory: suggestionHistory,
    }),
    ...(weeklyContext.length > 0 && { weeklyTrends: weeklyContext }),
    ...(previousWeeklySummary && {
      previousWeekRecap: {
        summary: previousWeeklySummary.weeklySummary,
        foodsSafe: previousWeeklySummary.keyFoods.safe,
        foodsFlagged: previousWeeklySummary.keyFoods.flagged,
        foodsToTryNext: previousWeeklySummary.keyFoods.toTryNext,
        carryForwardNotes: previousWeeklySummary.carryForwardNotes,
      },
    }),
    ...(habitCorrelationInsights &&
      habitCorrelationInsights.length > 0 && {
        habitCorrelationInsights,
      }),
    ...(baselineAverages !== undefined && {
      baselineComparison: buildBaselineContext(baselineAverages),
    }),
  };
  return JSON.stringify(payload, null, 2);
}

// ─── Parse & fallback ────────────────────────────────────────────────────────

/** Type guard: narrows unknown to a string-keyed object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Safely coerce an unknown array to string[], filtering out non-strings. */
function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

/**
 * A gentle, easily-digested food that is safe for most post-surgical patients.
 * Used as the default "next food to try" when the AI response omits one.
 */
const DEFAULT_FOOD_SUGGESTION = "Plain white rice";

/**
 * Parse and validate a raw AI JSON response into a typed AiNutritionistInsight.
 *
 * Handles missing or malformed fields by substituting safe defaults.
 * Returns null if the input is not a valid object at all.
 *
 * This is the single canonical parser for all AI nutritionist responses —
 * used both when receiving fresh AI completions and when reading stored insights.
 */
export function parseAiInsight(raw: unknown): AiNutritionistInsight | null {
  if (!isRecord(raw)) return null;

  // nextFoodToTry — require the "food" string to be present, else use default
  const nextFoodToTryDefault: AiNutritionistInsight["nextFoodToTry"] = {
    food: DEFAULT_FOOD_SUGGESTION,
    reasoning: "Safe default after any episode.",
    timing: "Next meal",
  };

  const rawNextFood = raw.nextFoodToTry;
  const nextFoodToTry: AiNutritionistInsight["nextFoodToTry"] =
    isRecord(rawNextFood) && typeof rawNextFood.food === "string"
      ? {
          food: rawNextFood.food,
          reasoning: typeof rawNextFood.reasoning === "string" ? rawNextFood.reasoning : "",
          timing: typeof rawNextFood.timing === "string" ? rawNextFood.timing : "",
        }
      : nextFoodToTryDefault;

  const rawMiniChallenge = raw.miniChallenge;
  const miniChallenge: AiNutritionistInsight["miniChallenge"] =
    isRecord(rawMiniChallenge) && typeof rawMiniChallenge.challenge === "string"
      ? {
          challenge: rawMiniChallenge.challenge,
          duration: typeof rawMiniChallenge.duration === "string" ? rawMiniChallenge.duration : "",
        }
      : null;

  // Parse the new directResponseToUser field
  const directResponseToUser: string | null =
    typeof raw.directResponseToUser === "string" ? raw.directResponseToUser : null;

  // Parse educationalInsight
  const rawEduInsight = raw.educationalInsight;
  const educationalInsight: AiNutritionistInsight["educationalInsight"] =
    isRecord(rawEduInsight) &&
    typeof rawEduInsight.topic === "string" &&
    typeof rawEduInsight.fact === "string"
      ? { topic: rawEduInsight.topic, fact: rawEduInsight.fact }
      : null;

  // Parse lifestyleExperiment
  const rawLifestyle = raw.lifestyleExperiment;
  const lifestyleExperiment: AiNutritionistInsight["lifestyleExperiment"] =
    isRecord(rawLifestyle) &&
    typeof rawLifestyle.status === "string" &&
    VALID_EXPERIMENT_STATUSES.has(rawLifestyle.status) &&
    typeof rawLifestyle.message === "string"
      ? {
          status: rawLifestyle.status as LifestyleExperimentStatus,
          message: rawLifestyle.message,
        }
      : null;

  const clinicalReasoning: string | null =
    typeof raw.clinicalReasoning === "string" ? raw.clinicalReasoning : null;

  return {
    directResponseToUser,
    summary: typeof raw.summary === "string" ? raw.summary : "No summary available.",
    clinicalReasoning,
    educationalInsight,
    lifestyleExperiment,
    foodAssessments: Array.isArray(raw.foodAssessments)
      ? raw.foodAssessments.filter(
          (item: unknown): item is StructuredFoodAssessment =>
            isRecord(item) &&
            typeof item.food === "string" &&
            (item.verdict === "safe" ||
              item.verdict === "watch" ||
              item.verdict === "avoid" ||
              item.verdict === "trial_next") &&
            (item.confidence === "low" ||
              item.confidence === "medium" ||
              item.confidence === "high") &&
            (item.causalRole === "primary" ||
              item.causalRole === "possible" ||
              item.causalRole === "unlikely") &&
            (item.changeType === "new" ||
              item.changeType === "upgraded" ||
              item.changeType === "downgraded" ||
              item.changeType === "unchanged") &&
            typeof item.modifierSummary === "string" &&
            typeof item.reasoning === "string",
        )
      : [],
    suspectedCulprits: Array.isArray(raw.suspectedCulprits)
      ? raw.suspectedCulprits.filter(
          (item: unknown): item is AiNutritionistInsight["suspectedCulprits"][number] =>
            isRecord(item) &&
            typeof item.food === "string" &&
            typeof item.confidence === "string" &&
            typeof item.reasoning === "string",
        )
      : [],
    likelySafe: Array.isArray(raw.likelySafe)
      ? raw.likelySafe.filter(
          (item: unknown): item is AiNutritionistInsight["likelySafe"][number] =>
            isRecord(item) && typeof item.food === "string" && typeof item.reasoning === "string",
        )
      : [],
    mealPlan: Array.isArray(raw.mealPlan)
      ? raw.mealPlan.filter(
          (item: unknown): item is AiNutritionistInsight["mealPlan"][number] =>
            isRecord(item) &&
            typeof item.meal === "string" &&
            Array.isArray(item.items) &&
            typeof item.reasoning === "string",
        )
      : [],
    nextFoodToTry,
    miniChallenge,
    suggestions: toStringArray(raw.suggestions),
  };
}

// ─── Enhanced AI context (Layer 1-3 data) ────────────────────────────────────

export interface PreviousWeeklySummary {
  weeklySummary: string;
  keyFoods: { safe: string[]; flagged: string[]; toTryNext: string[] };
  carryForwardNotes: string[];
}

export interface SuggestionHistoryEntry {
  text: string;
  count: number;
  firstSuggested: string;
  lastSuggested: string;
}

export interface HabitCorrelationInsight {
  area: string; // "water" | "walk" | "sleep" | "destructive"
  insight: string;
  generatedAt: string; // human-readable timestamp
}

export interface EnhancedAiContext {
  foodTrials?: FoodTrialSummaryInput[];
  conversationHistory?: ConversationMessage[];
  weeklyContext?: WeeklyDigestInput[];
  previousWeeklySummary?: PreviousWeeklySummary;
  recentSuggestions?: Array<{
    text: string;
    textNormalized: string;
    reportTimestamp: number;
  }>;
  habitCorrelationInsights?: HabitCorrelationInsight[];
  baselineAverages?: BaselineAverages;
}

// ─── Suggestion grouping ────────────────────────────────────────────────────

function groupSuggestions(
  raw: Array<{ text: string; textNormalized: string; reportTimestamp: number }>,
): SuggestionHistoryEntry[] {
  const groups = new Map<
    string,
    { text: string; count: number; firstTs: number; lastTs: number }
  >();

  for (const s of raw) {
    const existing = groups.get(s.textNormalized);
    if (existing) {
      existing.count++;
      existing.firstTs = Math.min(existing.firstTs, s.reportTimestamp);
      existing.lastTs = Math.max(existing.lastTs, s.reportTimestamp);
    } else {
      groups.set(s.textNormalized, {
        text: s.text,
        count: 1,
        firstTs: s.reportTimestamp,
        lastTs: s.reportTimestamp,
      });
    }
  }

  return Array.from(groups.values())
    .sort((a, b) => b.count - a.count)
    .map((g) => ({
      text: g.text,
      count: g.count,
      firstSuggested: formatTime(g.firstTs),
      lastSuggested: formatTime(g.lastTs),
    }));
}

// ─── Main export ─────────────────────────────────────────────────────────────

export interface FetchAiInsightsOptions {
  /** When true, send only patient snapshot + conversation history (no full logs/trials/digests). */
  lightweight?: boolean;
}

export async function fetchAiInsights(
  callAi: ConvexAiCaller,
  apiKey: string,
  logs: LogEntry[],
  previousReports: PreviousReport[],
  patientMessages: DrPooReply[],
  healthProfile: HealthProfile,
  enhancedContext?: EnhancedAiContext,
  aiPreferences?: AiPreferences,
  options?: FetchAiInsightsOptions,
): Promise<AiAnalysisResult> {
  checkRateLimit();
  const isLightweight = options?.lightweight === true;

  const safePatientMessages = sanitizeUnknownStringsDeep(patientMessages, {
    maxStringLength: INPUT_SAFETY_LIMITS.aiPayloadString,
    path: "ai.patientMessages",
  });
  const safeHealthProfile = sanitizeUnknownStringsDeep(healthProfile, {
    maxStringLength: INPUT_SAFETY_LIMITS.aiPayloadString,
    path: "ai.healthProfile",
  });

  const prefs = aiPreferences ?? DEFAULT_AI_PREFERENCES;
  const validatedModel = getValidInsightModel(prefs.aiModel);

  // ── Lightweight mode: conversation-only with patient snapshot ──────────
  if (isLightweight) {
    const systemPrompt = buildSystemPrompt(safeHealthProfile, prefs);
    const lightweightSystemPrompt = `${systemPrompt}\n\n## Conversation-only mode\n\nThis is a follow-up conversation during a cooldown period. You have LIMITED context — no food logs, bowel events, habit logs, or food trial data are included. Focus on answering the patient's question based on your previous analysis, the conversation history, and the patient profile above. Do not speculate about recent meals or bowel events you cannot see. If the patient's question requires log data you do not have, tell them honestly and suggest they wait for the next full analysis.`;

    const messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [{ role: "system", content: lightweightSystemPrompt }];

    // Include conversation history (same logic as full mode)
    const conversationHistory = enhancedContext?.conversationHistory;
    if (conversationHistory && conversationHistory.length > 0) {
      const safeConversation = sanitizeUnknownStringsDeep(conversationHistory, {
        maxStringLength: INPUT_SAFETY_LIMITS.aiPayloadString,
        path: "ai.conversationHistory",
      });
      const recentConversation = safeConversation
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(-MAX_CONVERSATION_MESSAGES);

      for (const msg of recentConversation) {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }

    // Build a minimal user message with just the patient's question and profile snapshot
    const now = new Date();
    const currentTime = now.toLocaleString("en-GB", {
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const daysPostOp = getDaysPostOp(safeHealthProfile.surgeryDate);
    const lightweightPayload: Record<string, unknown> = {
      currentTime,
      mode: "conversation-only",
      ...(daysPostOp !== null && { daysPostOp }),
      ...(safePatientMessages.length > 0
        ? {
            patientMessages: safePatientMessages.map((r) => ({
              message: r.text,
              sentAt: formatTime(r.timestamp),
            })),
          }
        : {
            patientMessages:
              "NONE — the patient has NOT sent any new messages. Set directResponseToUser to null.",
          }),
    };

    messages.push({
      role: "user",
      content: JSON.stringify(lightweightPayload, null, 2),
    });

    // Token estimate logging
    const estimatedTokens = messages.reduce((sum, m) => {
      const content = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
      return sum + Math.ceil(content.length / 4);
    }, 0);

    if (estimatedTokens > TOKEN_WARNING_THRESHOLD) {
      debugWarn("Dr. Poo", `High token estimate (lightweight): ~${estimatedTokens} tokens.`);
    }

    const startedAt = performance.now();
    let rawContent: string;
    try {
      const result = await callAi({
        apiKey,
        model: validatedModel,
        messages,
        responseFormat: { type: "json_object" },
      });
      rawContent = result.content;
    } catch (error) {
      throw new Error(`AI nutritionist request failed: ${getErrorMessage(error)}`);
    }
    const durationMs = Math.round(performance.now() - startedAt);

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      throw new Error("AI nutritionist returned invalid JSON response");
    }

    const insight = parseAiInsight(parsed);
    if (!insight) {
      throw new Error("AI nutritionist returned an unexpected response structure.");
    }

    if (safePatientMessages.length === 0) {
      insight.directResponseToUser = null;
    }

    // In lightweight mode, skip educational insight deduplication (no previous reports available)
    const serialisableMessages = messages.map((m) => ({
      role: m.role,
      content: truncateForStorage(
        typeof m.content === "string" ? m.content : JSON.stringify(m.content),
      ),
    }));

    return {
      insight,
      request: { model: validatedModel, messages: serialisableMessages },
      rawResponse: truncateForStorage(rawContent),
      durationMs,
      inputLogCount: 0,
    };
  }

  // ── Full mode: complete payload with all logs and context ──────────────
  const safeLogs = sanitizeUnknownStringsDeep(logs, {
    maxStringLength: INPUT_SAFETY_LIMITS.aiPayloadString,
    path: "ai.logs",
  });
  const safeEnhancedContext = enhancedContext
    ? sanitizeUnknownStringsDeep(enhancedContext, {
        maxStringLength: INPUT_SAFETY_LIMITS.aiPayloadString,
        path: "ai.enhancedContext",
      })
    : undefined;

  // Build recent events with variable windows per log type
  const recentEvents = buildRecentEvents(safeLogs, safeHealthProfile);

  // Feature-gated: reproductive health is out of v1 scope (ADR-0008)
  const includeReproductiveInPrompt = Boolean(
    FEATURE_FLAGS.reproductiveHealth && safeHealthProfile.reproductiveHealth?.trackingEnabled,
  );
  const inputLogCount =
    recentEvents.foodLogs.length +
    recentEvents.bowelEvents.length +
    recentEvents.habitLogs.length +
    recentEvents.fluidLogs.length +
    recentEvents.activityLogs.length +
    (includeReproductiveInPrompt ? recentEvents.reproductiveLogs.length : 0);

  // Destructure enhanced context (Layer 1-3 data)
  const foodTrials = safeEnhancedContext?.foodTrials ?? [];
  const weeklyDigests = safeEnhancedContext?.weeklyContext ?? [];
  const conversationHistory = safeEnhancedContext?.conversationHistory;

  // Build structured context objects
  const patientSnapshot = buildPatientSnapshot(safeHealthProfile, foodTrials, weeklyDigests);
  const deltaSignals = buildDeltaSignals(safeLogs, foodTrials);
  const foodContextObj = buildFoodContext(foodTrials, safeLogs, safeHealthProfile);

  const systemPrompt = buildSystemPrompt(safeHealthProfile, prefs);

  const messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }> = [{ role: "system", content: systemPrompt }];

  // Include conversation messages from the CURRENT half-week period only.
  // Historical context comes from previousWeekRecap (the weekly summary) in the
  // user payload — not from old conversation messages or report blobs.
  //
  // WQ-026: Re-sanitize historical messages before including them in the prompt.
  // These were sanitized on original input, but if sanitization rules have
  // changed since storage, old messages may contain patterns new rules would catch.
  if (conversationHistory && conversationHistory.length > 0) {
    const recentConversation = conversationHistory
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-MAX_CONVERSATION_MESSAGES);

    const reSanitized = sanitizeUnknownStringsDeep(recentConversation, {
      maxStringLength: INPUT_SAFETY_LIMITS.aiPayloadString,
      path: "ai.conversationHistory",
    });

    for (const msg of reSanitized) {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }
  }
  // No fallback — if the current period has no messages yet, the weekly summary
  // in the user payload provides all the historical context Dr. Poo needs.

  const hasPreviousResponse = previousReports.length > 0;

  // Group recent suggestions by text with counts (from enhanced context)
  const suggestionHistory = groupSuggestions(safeEnhancedContext?.recentSuggestions ?? []);

  // Transform weekly digests (already structured, just map to context shape)
  const weeklyContext: WeeklyDigestInput[] = weeklyDigests.map((wd) => ({
    weekStart: wd.weekStart,
    avgBristolScore: wd.avgBristolScore,
    totalBowelEvents: wd.totalBowelEvents,
    accidentCount: wd.accidentCount,
    uniqueFoodsEaten: wd.uniqueFoodsEaten,
    newFoodsTried: wd.newFoodsTried,
    foodsCleared: wd.foodsCleared,
    foodsFlagged: wd.foodsFlagged,
  }));

  messages.push({
    role: "user",
    content: buildUserMessage({
      recentEvents,
      patientSnapshot,
      deltaSignals,
      foodContext: foodContextObj,
      hasPreviousResponse,
      patientMessages: safePatientMessages,
      profile: safeHealthProfile,
      suggestionHistory,
      weeklyContext,
      ...(safeEnhancedContext?.previousWeeklySummary !== undefined && {
        previousWeeklySummary: safeEnhancedContext.previousWeeklySummary,
      }),
      ...(safeEnhancedContext?.habitCorrelationInsights !== undefined && {
        habitCorrelationInsights: safeEnhancedContext.habitCorrelationInsights,
      }),
      ...(safeEnhancedContext?.baselineAverages !== undefined && {
        baselineAverages: safeEnhancedContext.baselineAverages,
      }),
    }),
  });

  // Token estimate logging — warn if context is getting large
  const estimatedTokens = messages.reduce((sum, m) => {
    const content = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
    return sum + Math.ceil(content.length / 4);
  }, 0);

  if (estimatedTokens > TOKEN_WARNING_THRESHOLD) {
    debugWarn(
      "Dr. Poo",
      `High token estimate: ~${estimatedTokens} tokens. Consider reducing context.`,
    );
  }

  const startedAt = performance.now();
  let rawContent: string;
  try {
    const result = await callAi({
      apiKey,
      model: validatedModel,
      messages,
      responseFormat: { type: "json_object" },
    });

    rawContent = result.content;
  } catch (error) {
    throw new Error(`AI nutritionist request failed: ${getErrorMessage(error)}`);
  }
  const durationMs = Math.round(performance.now() - startedAt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    throw new Error("AI nutritionist returned invalid JSON response");
  }

  const insight = parseAiInsight(parsed);
  if (!insight) {
    throw new Error("AI nutritionist returned an unexpected response structure.");
  }

  // Belt-and-suspenders: if no patient messages were pending, force directResponseToUser to null.
  // The prompt already instructs the model to do this, but LLMs can ignore instructions.
  if (safePatientMessages.length === 0) {
    insight.directResponseToUser = null;
  }

  const enrichedInsight = enforceNovelEducationalInsight(insight, previousReports);

  const serialisableMessages = messages.map((m) => ({
    role: m.role,
    content: truncateForStorage(
      typeof m.content === "string" ? m.content : JSON.stringify(m.content),
    ),
  }));

  return {
    insight: enrichedInsight,
    request: { model: validatedModel, messages: serialisableMessages },
    rawResponse: truncateForStorage(rawContent),
    durationMs,
    inputLogCount,
  };
}

// ─── Weekly Summary ─────────────────────────────────────────────────────────

export interface WeeklySummaryInput {
  weekOf: string;
  conversationMessages: Array<{
    role: string;
    content: string;
    timestamp: string;
  }>;
  suggestions: string[];
  bowelNotes: Array<{
    timestamp: string;
    bristolCode: number | null;
    notes: string;
  }>;
}

export interface WeeklySummaryResult {
  weeklySummary: string;
  keyFoods: {
    safe: string[];
    flagged: string[];
    toTryNext: string[];
  };
  carryForwardNotes: string[];
}

const WEEKLY_SUMMARY_SYSTEM_PROMPT = `You are Dr. Poo, my warm, direct, no-nonsense gut-health companion and insightful guide. At the start of each new period (every Sunday and Wednesday at 9pm), give me a single narrative recap in your voice: exactly as if you're debriefing a colleague or close confidant about our conversations from the last few days. Make it feel like a real, honest summary of our conversations.

Make it feel like a real debrief: The things I brought up or asked about. What you said in response. Any back-and-forth that produced illuminating insights. Were there any moments of pushback, resistance, breakthroughs, or "wait, really?" turns.

Weave in any specific details from our chats that shaped the picture (foods we discussed trying/clearing/flagging, bowel patterns I mentioned, intake I reported, personal context like ADHD/lifestyle/preferences) — but only mention those things if they actually appeared in the conversation messages or suggestions. Do not invent, assume, or force in stats/trends/food verdicts that weren't talked about. Start casually, e.g., "Last few days the conversation started with..." End by looking forward: what's relevant to the next few days? What feels worth picking up again, any small next steps or things to notice/try/avoid based purely on where the conversation left off — keep it in the same warm, direct, and supportive tone. Aim for 200–400 words so there's space for the real turns and texture without rushing.

Output only valid JSON:
{
  "weeklySummary": "the full narrative recap string here",
  "keyFoods": {
    "safe": ["foods we actually discussed as clearly tolerated / cleared this week"],
    "flagged": ["foods we talked about as problematic / suspects / not going well"],
    "toTryNext": ["foods, combos, or approaches we floated as worth trying or revisiting soon"]
  },
  "carryForwardNotes": [
    "short bullet — lingering personal context, sensitivities, unfinished threads, or life factors next week's chat should keep in mind",
    "max 5 bullets, max 150 words total"
  ]
}

Base this entirely on the conversation messages below (chronologically ordered user/assistant pairs for the week) including the suggestions and the bowel movement notes. Ignore anything not present in them.

Do NOT:
- Add positivity, "wins," or clinical framing if it wasn't how the chats felt
- Compress exchanges or list Q&A mechanically
- Pull in external assumptions or pre-computed stats
- Mention raw logs, timestamps, or anything absent from the messages

Just tell the unfiltered story of what we actually said to each other last week.`;

export async function fetchWeeklySummary(
  callAi: ConvexAiCaller,
  apiKey: string,
  input: WeeklySummaryInput,
  model: string = DEFAULT_INSIGHT_MODEL,
): Promise<{
  result: WeeklySummaryResult;
  rawResponse: string;
  durationMs: number;
}> {
  checkRateLimit();

  const safeInput = sanitizeUnknownStringsDeep(input, {
    maxStringLength: INPUT_SAFETY_LIMITS.aiPayloadString,
    path: "ai.weeklySummaryInput",
  }) as WeeklySummaryInput;

  const messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }> = [
    { role: "system", content: WEEKLY_SUMMARY_SYSTEM_PROMPT },
    { role: "user", content: JSON.stringify(safeInput, null, 2) },
  ];

  let rawContent: string;
  let durationMs: number;
  const startedAt = performance.now();
  try {
    const result = await callAi({
      apiKey,
      model,
      messages,
      responseFormat: { type: "json_object" },
    });
    rawContent = result.content;
    durationMs = Math.round(performance.now() - startedAt);
  } catch (error) {
    const message = getErrorMessage(error);
    if (message.includes("401") || message.includes("Unauthorized") || message.includes("auth")) {
      throw new Error("Weekly summary failed. Check your API key.");
    }
    throw new Error(`Weekly summary failed: ${message}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    throw new Error("Weekly summary returned invalid JSON response");
  }

  if (!isRecord(parsed)) {
    throw new Error("Weekly summary returned unexpected response structure.");
  }

  const keyFoods = isRecord(parsed.keyFoods) ? parsed.keyFoods : null;
  const result: WeeklySummaryResult = {
    weeklySummary:
      typeof parsed.weeklySummary === "string" ? parsed.weeklySummary : "No summary available.",
    keyFoods: {
      safe: toStringArray(keyFoods?.safe),
      flagged: toStringArray(keyFoods?.flagged),
      toTryNext: toStringArray(keyFoods?.toTryNext),
    },
    carryForwardNotes: toStringArray(parsed.carryForwardNotes),
  };

  return { result, rawResponse: rawContent, durationMs };
}

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/src/lib/aiModels.ts

/**
 * Central AI model configuration — single source of truth for all model names.
 *
 * Two tiers:
 *   - Background: cheapest capable model, used for coaching, suggestions, food parsing.
 *     Not user-configurable.
 *   - Insight: used for Dr. Poo reports and analysis. User-selectable from INSIGHT_MODEL_OPTIONS.
 */

/** Model used for coaching snippets, pane summaries, suggestions, and food parsing. */
export const BACKGROUND_MODEL = "gpt-5-mini";

/** Ordered list of models the user may pick for insight/analysis tasks. */
export const INSIGHT_MODEL_OPTIONS = ["gpt-5.4", "gpt-5-mini"] as const;

/** Default insight model for new users / factory reset. */
export const DEFAULT_INSIGHT_MODEL: InsightModel = "gpt-5.4";

/** Union type for user-selectable insight models. */
export type InsightModel = (typeof INSIGHT_MODEL_OPTIONS)[number];

/** All valid insight models as a Set, for runtime validation. */
const VALID_INSIGHT_MODELS: ReadonlySet<string> = new Set<string>(INSIGHT_MODEL_OPTIONS);

/** Backward-compatible aliases for previously stored model names. */
const LEGACY_INSIGHT_MODEL_ALIASES: Readonly<Record<string, InsightModel>> = {
  "gpt-5.2": "gpt-5.4",
};

/** Type guard: checks whether a value is a valid InsightModel. */
function isInsightModel(value: unknown): value is InsightModel {
  return typeof value === "string" && VALID_INSIGHT_MODELS.has(value);
}

/** Validate an unknown value into a valid InsightModel, falling back to the default. */
export function getValidInsightModel(model: unknown): InsightModel {
  if (isInsightModel(model)) return model;
  if (typeof model === "string") {
    return LEGACY_INSIGHT_MODEL_ALIASES[model] ?? DEFAULT_INSIGHT_MODEL;
  }
  return DEFAULT_INSIGHT_MODEL;
}

/** Human-readable label for a model name. */
export function getModelLabel(model: string): string {
  switch (model) {
    case "gpt-5-mini":
      return "GPT-5 Mini";
    case "gpt-5.4":
    case "gpt-5.2":
      return "GPT-5.4";
    default:
      return model;
  }
}

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/convex/ai.ts

"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import { requireAuth } from "./lib/auth";

const OPENAI_API_KEY_PATTERN = /^sk-[A-Za-z0-9_-]{20,}$/;

/**
 * Mask an API key for safe logging: show only the last 4 characters.
 * Returns "****" if the key is too short or empty.
 */
function maskApiKey(key: string): string {
  if (key.length <= 4) return "****";
  return `****${key.slice(-4)}`;
}

/**
 * Classify an OpenAI API error by HTTP status code into a structured error code.
 * These codes allow the client to distinguish error types and show appropriate UI.
 */
function classifyOpenAiError(status: number): string {
  if (status === 401 || status === 403) return "KEY_ERROR";
  if (status === 429) return "QUOTA_ERROR";
  if (status >= 500) return "NETWORK_ERROR";
  return "NETWORK_ERROR";
}

/**
 * Generic OpenAI chat completion action.
 *
 * The client builds the full prompt (system + user messages) and sends them here.
 * This action is a thin relay: it authenticates the user, resolves the API key
 * (client-provided or server-stored), makes the call, and returns the result.
 */
export const chatCompletion = action({
  args: {
    apiKey: v.string(),
    model: v.string(),
    messages: v.array(
      v.object({
        role: v.union(v.literal("system"), v.literal("user"), v.literal("assistant")),
        content: v.string(),
      }),
    ),
    temperature: v.optional(v.number()),
    maxTokens: v.optional(v.number()),
    responseFormat: v.optional(v.object({ type: v.string() })),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);

    // Resolve API key: prefer client-provided, fall back to server-stored
    let apiKey = args.apiKey;
    if (!apiKey) {
      const profileKey = await ctx.runQuery(internal.profiles.getServerApiKey, {
        userId,
      });
      if (profileKey !== null) {
        apiKey = profileKey;
      }
    }

    // WQ-324: Validate API key format BEFORE creating the OpenAI client.
    // This prevents instantiating the client with malicious or malformed data.
    if (!OPENAI_API_KEY_PATTERN.test(apiKey)) {
      throw new Error(
        `[NON_RETRYABLE] [KEY_ERROR] Invalid OpenAI API key format (key ending ...${maskApiKey(apiKey)}).`,
      );
    }

    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey });

    try {
      const response = await client.chat.completions.create({
        model: args.model,
        messages: args.messages,
        ...(args.temperature !== undefined && {
          temperature: args.temperature,
        }),
        ...(args.maxTokens !== undefined && { max_tokens: args.maxTokens }),
        ...(args.responseFormat !== undefined && {
          response_format: args.responseFormat as {
            type: "json_object" | "text";
          },
        }),
      });

      return {
        content: response.choices[0]?.message?.content ?? "",
        usage: response.usage
          ? {
              promptTokens: response.usage.prompt_tokens,
              completionTokens: response.usage.completion_tokens,
              totalTokens: response.usage.total_tokens,
            }
          : null,
      };
    } catch (err: unknown) {
      // Classify OpenAI SDK errors into structured error codes for client handling.
      // The OpenAI SDK throws APIError with a status property.
      const status =
        typeof err === "object" &&
        err !== null &&
        "status" in err &&
        typeof (err as Record<string, unknown>).status === "number"
          ? ((err as Record<string, unknown>).status as number)
          : undefined;

      const errorCode = status !== undefined ? classifyOpenAiError(status) : "NETWORK_ERROR";
      const message = err instanceof Error ? err.message : "Unknown OpenAI error";

      // Non-retryable errors: bad key, forbidden
      const isNonRetryable = errorCode === "KEY_ERROR";
      const prefix = isNonRetryable ? "[NON_RETRYABLE] " : "";

      throw new Error(`${prefix}[${errorCode}] OpenAI API error: ${message}`);
    }
  },
});

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/convex/lib/apiKeys.ts

/**
 * @file apiKeys.ts
 *
 * Server-side helpers for storing/retrieving BYOK OpenAI API keys in the
 * profiles table. Keys are encrypted at rest with AES-GCM using the
 * API_KEY_ENCRYPTION_SECRET Convex environment variable.
 *
 * Legacy base64-only rows are still readable so existing profiles continue
 * to work until the user saves their key again.
 *
 * @consumers
 *   - convex/profiles.ts (public mutations/queries)
 *   - convex/foodLlmMatching.ts (server-side key lookup)
 *   - convex/ai.ts (server-side key lookup)
 */
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type ProfileRow = Doc<"profiles">;
type ProfileReaderCtx = Pick<MutationCtx, "db"> | Pick<QueryCtx, "db">;

const API_KEY_CIPHER_PREFIX = "enc-v1";
const API_KEY_IV_BYTES = 12;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

let cachedEncryptionSecret: string | null = null;
let cachedEncryptionKey: Promise<CryptoKey> | null = null;

function getEncryptionSecret(): string {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET?.trim();
  if (!secret) {
    throw new Error(
      "API_KEY_ENCRYPTION_SECRET is not configured in Convex environment variables.",
    );
  }
  return secret;
}

async function getEncryptionKey(): Promise<CryptoKey> {
  const secret = getEncryptionSecret();
  if (cachedEncryptionKey !== null && cachedEncryptionSecret === secret) {
    return cachedEncryptionKey;
  }

  cachedEncryptionSecret = secret;
  cachedEncryptionKey = (async () => {
    const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(secret));
    return await crypto.subtle.importKey("raw", digest, "AES-GCM", false, [
      "encrypt",
      "decrypt",
    ]);
  })();
  return cachedEncryptionKey;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function encryptApiKey(key: string): Promise<string> {
  const encryptionKey = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(API_KEY_IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    encryptionKey,
    textEncoder.encode(key),
  );

  return `${API_KEY_CIPHER_PREFIX}:${bytesToBase64(iv)}:${bytesToBase64(
    new Uint8Array(ciphertext),
  )}`;
}

function decryptLegacyApiKey(value: string): string {
  return atob(value);
}

async function decryptApiKey(value: string): Promise<string> {
  if (!value.startsWith(`${API_KEY_CIPHER_PREFIX}:`)) {
    return decryptLegacyApiKey(value);
  }

  const [, ivBase64, payloadBase64] = value.split(":");
  if (!ivBase64 || !payloadBase64) {
    throw new Error("Stored API key is malformed.");
  }

  const encryptionKey = await getEncryptionKey();
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(ivBase64) },
      encryptionKey,
      base64ToBytes(payloadBase64),
    );
    return textDecoder.decode(plaintext);
  } catch {
    throw new Error(
      "Stored API key could not be decrypted. Check API_KEY_ENCRYPTION_SECRET.",
    );
  }
}

async function listProfilesByUserId(
  ctx: ProfileReaderCtx,
  userId: string,
): Promise<ProfileRow[]> {
  return await ctx.db
    .query("profiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
}

function profileRichnessScore(profile: ProfileRow): number {
  let score = 0;
  if (profile.unitSystem !== "metric") score += 10;
  if (profile.habits.length > 0) score += 8;
  if ((profile.fluidPresets?.length ?? 0) > 0) score += 4;
  else if (profile.fluidPresets !== undefined) score += 1;
  if (profile.sleepGoal !== undefined) score += 4;
  if (profile.healthProfile !== undefined) score += 4;
  if (profile.aiPreferences !== undefined) score += 4;
  if (profile.foodPersonalisation !== undefined) score += 4;
  if (profile.transitCalibration !== undefined) score += 4;
  if ((profile.knownFoods?.length ?? 0) > 0) score += 3;
  if (profile.encryptedApiKey !== undefined) score += 2;
  return score;
}

function sortProfiles(rows: ReadonlyArray<ProfileRow>): ProfileRow[] {
  return rows
    .slice()
    .sort(
      (a, b) =>
        profileRichnessScore(b) - profileRichnessScore(a) ||
        b.updatedAt - a.updatedAt ||
        b._creationTime - a._creationTime,
    );
}

function firstDefined<T>(values: ReadonlyArray<T | undefined>): T | undefined {
  for (const value of values) {
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

function firstPopulatedArray<T>(
  values: ReadonlyArray<ReadonlyArray<T> | undefined>,
): ReadonlyArray<T> | undefined {
  for (const value of values) {
    if (value !== undefined && value.length > 0) {
      return value;
    }
  }
  return firstDefined(values);
}

function mergeKnownFoods(rows: ReadonlyArray<ProfileRow>): string[] {
  const knownFoods = new Set<string>();
  for (const row of rows) {
    for (const name of row.knownFoods ?? []) {
      if (name.length > 0) {
        knownFoods.add(name);
      }
    }
  }
  return [...knownFoods];
}

function buildMergedProfile(
  rows: ReadonlyArray<ProfileRow>,
  options: { encryptedApiKey?: string | null; updatedAt: number },
): Omit<ProfileRow, "_id" | "_creationTime"> {
  const sorted = sortProfiles(rows);
  const keeper = sorted[0];
  const nextKnownFoods = mergeKnownFoods(sorted);
  const nextEncryptedApiKey =
    options.encryptedApiKey === undefined
      ? firstDefined(sorted.map((row) => row.encryptedApiKey))
      : options.encryptedApiKey;

  const fluidPresets = (() => {
    const selected = firstPopulatedArray(sorted.map((row) => row.fluidPresets));
    return selected !== undefined ? [...selected] : undefined;
  })();
  const sleepGoal = firstDefined(sorted.map((row) => row.sleepGoal));
  const healthProfile = firstDefined(sorted.map((row) => row.healthProfile));
  const aiPreferences = firstDefined(sorted.map((row) => row.aiPreferences));
  const foodPersonalisation = firstDefined(
    sorted.map((row) => row.foodPersonalisation),
  );
  const transitCalibration = firstDefined(
    sorted.map((row) => row.transitCalibration),
  );

  return {
    userId: keeper.userId,
    unitSystem: keeper.unitSystem,
    habits: keeper.habits,
    ...(fluidPresets !== undefined && { fluidPresets }),
    ...(sleepGoal !== undefined && { sleepGoal }),
    ...(healthProfile !== undefined && { healthProfile }),
    ...(aiPreferences !== undefined && { aiPreferences }),
    ...(foodPersonalisation !== undefined && { foodPersonalisation }),
    ...(transitCalibration !== undefined && { transitCalibration }),
    ...(nextKnownFoods.length > 0 && { knownFoods: nextKnownFoods }),
    ...(nextEncryptedApiKey !== undefined &&
      nextEncryptedApiKey !== null && {
        encryptedApiKey: nextEncryptedApiKey,
      }),
    updatedAt: options.updatedAt,
  };
}

async function consolidateProfiles(
  ctx: MutationCtx,
  rows: ReadonlyArray<ProfileRow>,
  options: { encryptedApiKey?: string | null; updatedAt: number },
): Promise<void> {
  const [keeper, ...duplicates] = sortProfiles(rows);
  await ctx.db.replace(keeper._id, buildMergedProfile(rows, options));

  for (const duplicate of duplicates) {
    await ctx.db.delete(duplicate._id);
  }
}

/**
 * Store an encrypted API key in the user's profile.
 * Creates a minimal profile with defaults if one does not exist yet.
 * If duplicate profile rows exist from prior races, consolidate them.
 */
export async function storeApiKey(
  ctx: MutationCtx,
  userId: string,
  key: string,
): Promise<void> {
  const encryptedApiKey = await encryptApiKey(key);
  const updatedAt = Date.now();
  const profiles = await listProfilesByUserId(ctx, userId);

  if (profiles.length === 0) {
    await ctx.db.insert("profiles", {
      userId,
      unitSystem: "metric",
      habits: [],
      encryptedApiKey,
      updatedAt,
    });

    const profilesAfterInsert = await listProfilesByUserId(ctx, userId);
    if (profilesAfterInsert.length > 1) {
      await consolidateProfiles(ctx, profilesAfterInsert, {
        encryptedApiKey,
        updatedAt,
      });
    }
    return;
  }

  await consolidateProfiles(ctx, profiles, { encryptedApiKey, updatedAt });
}

/**
 * Check whether any profile row for the user currently stores an API key.
 * This does not decrypt the key, so it remains safe even if encryption
 * configuration has changed.
 */
export async function hasStoredApiKey(
  ctx: QueryCtx,
  userId: string,
): Promise<boolean> {
  const profiles = await listProfilesByUserId(ctx, userId);
  return profiles.some((profile) => profile.encryptedApiKey !== undefined);
}

/**
 * Retrieve the decrypted API key from the user's profile.
 * Returns null if the profile doesn't exist or has no key stored.
 */
export async function getApiKey(
  ctx: QueryCtx,
  userId: string,
): Promise<string | null> {
  const profiles = sortProfiles(await listProfilesByUserId(ctx, userId));
  const profileWithKey = profiles.find(
    (profile) => profile.encryptedApiKey !== undefined,
  );

  if (profileWithKey?.encryptedApiKey === undefined) {
    return null;
  }

  return await decryptApiKey(profileWithKey.encryptedApiKey);
}

/**
 * Delete the stored API key from the user's profile.
 * No-op if the profile doesn't exist.
 * If duplicate profile rows exist from prior races, consolidate them.
 */
export async function deleteApiKey(
  ctx: MutationCtx,
  userId: string,
): Promise<void> {
  const profiles = await listProfilesByUserId(ctx, userId);
  if (profiles.length === 0) {
    return;
  }

  await consolidateProfiles(ctx, profiles, {
    encryptedApiKey: null,
    updatedAt: Date.now(),
  });
}

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/src/hooks/useApiKey.ts

/**
 * @file useApiKey.ts
 *
 * React hook that manages the user's OpenAI API key. The key is stored in
 * both IndexedDB (for client-side access) and Convex (for server-side access).
 * Convex is the primary store; IndexedDB is kept as fallback during migration.
 *
 * On mount:
 *   1. Loads key from IndexedDB (existing behavior)
 *   2. If IndexedDB has a key but Convex doesn't, auto-migrates to Convex
 *
 * On save/delete:
 *   - Writes to BOTH IndexedDB and Convex
 *   - IndexedDB is written first (fast, local); Convex is best-effort
 *
 * The client still prefers the local copy for direct action calls, but
 * server-side fallback remains available when only the Convex copy exists.
 *
 * @exports useApiKey — returns { apiKey, hasApiKey, loading, updateKey, removeKey }
 *
 * @consumers
 *   - src/contexts/ApiKeyContext.tsx (sole direct consumer; re-exposes as useApiKeyContext)
 */
import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { clearApiKey, getApiKey, setApiKey } from "@/lib/apiKeyStore";
import { api } from "../../convex/_generated/api";

/**
 * Sanitize an error for logging — strip any API key material that might
 * appear in the error message or serialized args. Only the error type and
 * a safe summary are logged; never the raw error object which could contain
 * the key in its serialized form.
 */
function sanitizeApiKeyError(err: unknown): string {
  if (err instanceof Error) {
    // Replace anything that looks like an API key (sk-...) in the message
    return err.message.replace(/sk-[A-Za-z0-9_-]+/g, "sk-****");
  }
  return "Unknown error (details redacted for key safety)";
}

export function useApiKey() {
  const [apiKey, setKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const hasServerKey = useQuery(api.profiles.hasServerApiKey);
  const setServerKey = useMutation(api.profiles.setApiKey);
  const removeServerKey = useMutation(api.profiles.removeApiKey);

  // Load from IndexedDB on mount
  useEffect(() => {
    getApiKey().then((k) => {
      setKey(k);
      setLoading(false);
    });
  }, []);

  // Auto-migrate: if IndexedDB has a key but server doesn't, push to Convex
  useEffect(() => {
    if (apiKey !== null && hasServerKey === false) {
      setServerKey({ apiKey }).catch((err: unknown) => {
        // WQ-323: Never log the raw error — it may contain the API key
        console.error("[ApiKey] Migration to server failed:", sanitizeApiKeyError(err));
      });
    }
  }, [apiKey, hasServerKey, setServerKey]);

  const updateKey = useCallback(
    async (key: string) => {
      // Write to IndexedDB first (fast, local)
      await setApiKey(key);
      setKey(key);
      // Then write to Convex (best-effort)
      try {
        await setServerKey({ apiKey: key });
      } catch (err: unknown) {
        // WQ-323: Never log the raw error — it may contain the API key
        console.error("[ApiKey] Server save failed:", sanitizeApiKeyError(err));
      }
    },
    [setServerKey],
  );

  const removeKey = useCallback(async () => {
    // Clear IndexedDB first
    await clearApiKey();
    setKey(null);
    // Then clear Convex (best-effort)
    try {
      await removeServerKey();
    } catch (err: unknown) {
      // WQ-323: Sanitize error even for delete — errors may reference prior state
      console.error("[ApiKey] Server delete failed:", sanitizeApiKeyError(err));
    }
  }, [removeServerKey]);

  return {
    apiKey,
    hasApiKey: apiKey !== null || hasServerKey === true,
    loading,
    updateKey,
    removeKey,
  };
}

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/convex/validators.ts

/**
 * Shared Convex validators for use in both schema.ts and logs.ts.
 * Keeps validators DRY and ensures schema and function args stay in sync.
 */
import { v } from "convex/values";

export const habitKindValidator = v.union(
  v.literal("positive"),
  v.literal("destructive"),
);

export const habitUnitValidator = v.union(
  v.literal("count"),
  v.literal("ml"),
  v.literal("minutes"),
  v.literal("hours"),
);

export const habitTypeValidator = v.union(
  v.literal("sleep"),
  v.literal("count"),
  v.literal("activity"),
  v.literal("fluid"),
  v.literal("destructive"),
  v.literal("checkbox"),
  v.literal("weight"),
);

export const habitConfigValidator = v.object({
  id: v.string(),
  name: v.string(),
  kind: habitKindValidator,
  unit: habitUnitValidator,
  quickIncrement: v.number(),
  dailyTarget: v.optional(v.number()),
  dailyCap: v.optional(v.number()),
  weeklyFrequencyTarget: v.optional(v.number()),
  showOnTrack: v.boolean(),
  // Tailwind-style color token (e.g. "violet", "sky", "emerald").
  // String length is bounded on writes via sanitizeUnknownStringsDeep.
  color: v.string(),
  createdAt: v.number(),
  archivedAt: v.optional(v.number()),
  logAs: v.optional(v.union(v.literal("habit"), v.literal("fluid"))),
  habitType: habitTypeValidator,
  templateKey: v.optional(v.string()),
});

export const habitsValidator = v.array(habitConfigValidator);

export const fluidPresetValidator = v.object({
  name: v.string(),
});

export const fluidPresetsValidator = v.array(fluidPresetValidator);

// Legacy profile docs stored presets as string[] before the lossless preset shape
// landed. The schema remains backward-compatible until those docs are rewritten.
export const storedFluidPresetValidator = v.union(
  fluidPresetValidator,
  v.string(),
);

export const storedFluidPresetsValidator = v.array(storedFluidPresetValidator);

export const transitCalibrationValidator = v.object({
  source: v.union(v.literal("default"), v.literal("learned")),
  centerMinutes: v.number(),
  spreadMinutes: v.number(),
  sampleSize: v.number(),
  learnedAt: v.union(v.number(), v.null()),
});

export const foodPersonalisationValidator = v.object({
  cautionLevel: v.union(
    v.literal("conservative"),
    v.literal("balanced"),
    v.literal("adventurous"),
  ),
  upgradeSpeed: v.union(
    v.literal("conservative"),
    v.literal("balanced"),
    v.literal("adventurous"),
  ),
});

// Profile habits use the same strict validator as mutation args.
// The replaceProfile mutation normalizes legacy data on write via
// normalizeStoredProfileHabits, so all stored data matches this shape.
// Run the normalizeProfileHabits migration to fix any pre-normalization docs.
export const storedProfileHabitsValidator = v.array(habitConfigValidator);

// ── AI Analysis validators ───────────────────────────────────────────────────
// These match the AiNutritionistInsight domain type in src/types/domain.ts.
// Run the normalizeAiInsightData migration before deploying if existing
// aiAnalyses documents pre-date the current insight schema.

const confidenceLevelValidator = v.union(
  v.literal("high"),
  v.literal("medium"),
  v.literal("low"),
);

export const foodAssessmentVerdictValidator = v.union(
  v.literal("safe"),
  v.literal("watch"),
  v.literal("avoid"),
  v.literal("trial_next"),
);

export const foodAssessmentCausalRoleValidator = v.union(
  v.literal("primary"),
  v.literal("possible"),
  v.literal("unlikely"),
);

export const foodAssessmentChangeTypeValidator = v.union(
  v.literal("new"),
  v.literal("upgraded"),
  v.literal("downgraded"),
  v.literal("unchanged"),
);

export const structuredFoodAssessmentValidator = v.object({
  food: v.string(),
  verdict: foodAssessmentVerdictValidator,
  confidence: confidenceLevelValidator,
  causalRole: foodAssessmentCausalRoleValidator,
  changeType: foodAssessmentChangeTypeValidator,
  modifierSummary: v.string(),
  reasoning: v.string(),
});

export const foodPrimaryStatusValidator = v.union(
  v.literal("building"),
  v.literal("safe"),
  v.literal("watch"),
  v.literal("avoid"),
);

export const foodTendencyValidator = v.union(
  v.literal("neutral"),
  v.literal("loose"),
  v.literal("hard"),
);

const lifestyleExperimentStatusValidator = v.union(
  v.literal("adapted"),
  v.literal("broken"),
  v.literal("testing"),
  v.literal("rewarding"),
);

export const aiInsightValidator = v.union(
  v.object({
    directResponseToUser: v.optional(v.union(v.string(), v.null())),
    summary: v.string(),
    clinicalReasoning: v.optional(v.union(v.string(), v.null())),
    educationalInsight: v.optional(
      v.union(v.object({ topic: v.string(), fact: v.string() }), v.null()),
    ),
    lifestyleExperiment: v.optional(
      v.union(
        v.object({
          status: lifestyleExperimentStatusValidator,
          message: v.string(),
        }),
        v.null(),
      ),
    ),
    foodAssessments: v.optional(v.array(structuredFoodAssessmentValidator)),
    suspectedCulprits: v.array(
      v.object({
        food: v.string(),
        confidence: confidenceLevelValidator,
        reasoning: v.string(),
      }),
    ),
    likelySafe: v.array(v.object({ food: v.string(), reasoning: v.string() })),
    mealPlan: v.array(
      v.object({
        meal: v.string(),
        items: v.array(v.string()),
        reasoning: v.string(),
      }),
    ),
    nextFoodToTry: v.object({
      food: v.string(),
      reasoning: v.string(),
      timing: v.string(),
    }),
    miniChallenge: v.optional(
      v.union(
        v.object({ challenge: v.string(), duration: v.string() }),
        v.null(),
      ),
    ),
    suggestions: v.array(v.string()),
  }),
  v.null(),
);

export const aiRequestValidator = v.union(
  v.object({
    model: v.string(),
    messages: v.array(
      v.object({
        role: v.string(),
        content: v.string(),
      }),
    ),
  }),
  v.null(),
);

export const aiResponseValidator = v.union(v.string(), v.null());

export const sleepGoalValidator = v.object({
  targetHours: v.number(),
  nudgeTime: v.string(),
  nudgeEnabled: v.boolean(),
});

export const aiPreferencesValidator = v.object({
  preferredName: v.string(),
  locationTimezone: v.string(),
  mealSchedule: v.object({
    breakfast: v.string(),
    middaySnack: v.string(),
    lunch: v.string(),
    midafternoonSnack: v.string(),
    dinner: v.string(),
    lateEveningSnack: v.string(),
  }),
  aiModel: v.union(
    v.literal("gpt-5-mini"),
    v.literal("gpt-5.4"),
    v.literal("gpt-5.2"),
  ),
  approach: v.union(
    v.literal("supportive"),
    v.literal("personal"),
    v.literal("analytical"),
  ),
  register: v.union(
    v.literal("everyday"),
    v.literal("mixed"),
    v.literal("clinical"),
  ),
  outputFormat: v.union(
    v.literal("narrative"),
    v.literal("mixed"),
    v.literal("structured"),
  ),
  outputLength: v.union(
    v.literal("concise"),
    v.literal("standard"),
    v.literal("detailed"),
  ),
  preset: v.union(
    v.literal("reassuring_coach"),
    v.literal("clear_clinician"),
    v.literal("data_deep_dive"),
    v.literal("quiet_checkin"),
    v.literal("custom"),
  ),
  promptVersion: v.number(),
  /** Controls when Dr. Poo reports are generated after bowel logs. undefined = "auto". */
  reportTriggerMode: v.optional(
    v.union(v.literal("auto"), v.literal("manual")),
  ),
});

// ── Log data validators ────────────────────────────────────────────────────

const recoveryStageValidator = v.union(
  v.literal(1),
  v.literal(2),
  v.literal(3),
);
const spiceLevelValidator = v.union(
  v.literal("plain"),
  v.literal("mild"),
  v.literal("spicy"),
);
export const foodGroupValidator = v.union(
  v.literal("protein"),
  v.literal("carbs"),
  v.literal("fats"),
  v.literal("seasoning"),
);
export const foodLineValidator = v.union(
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
);
const foodResolverValidator = v.union(
  v.literal("alias"),
  v.literal("fuzzy"),
  v.literal("embedding"),
  v.literal("combined"),
  v.literal("llm"),
  v.literal("user"),
);
const foodMatchCandidateValidator = v.object({
  canonicalName: v.string(),
  zone: recoveryStageValidator,
  group: foodGroupValidator,
  line: foodLineValidator,
  bucketKey: v.string(),
  bucketLabel: v.string(),
  resolver: foodResolverValidator,
  combinedConfidence: v.number(),
  fuzzyScore: v.union(v.number(), v.null()),
  embeddingScore: v.union(v.number(), v.null()),
  examples: v.array(v.string()),
});
const foodMatchBucketValidator = v.object({
  bucketKey: v.string(),
  bucketLabel: v.string(),
  canonicalOptions: v.array(v.string()),
  bestConfidence: v.number(),
});

const foodItemValidator = v.object({
  // New field names
  userSegment: v.optional(v.string()),
  parsedName: v.optional(v.string()),
  resolvedBy: v.optional(
    v.union(
      v.literal("registry"),
      v.literal("llm"),
      v.literal("user"),
      v.literal("expired"),
    ),
  ),
  // Legacy field names (for existing data)
  name: v.optional(v.string()),
  rawName: v.optional(v.union(v.string(), v.null())),
  // Unchanged fields
  canonicalName: v.optional(v.string()),
  quantity: v.union(v.number(), v.null()),
  unit: v.union(v.string(), v.null()),
  quantityText: v.optional(v.union(v.string(), v.null())),
  defaultPortionDisplay: v.optional(v.string()),
  preparation: v.optional(v.string()),
  recoveryStage: v.optional(recoveryStageValidator),
  spiceLevel: v.optional(spiceLevelValidator),
  bucketKey: v.optional(v.string()),
  bucketLabel: v.optional(v.string()),
  matchConfidence: v.optional(v.number()),
  matchStrategy: v.optional(foodResolverValidator),
  matchCandidates: v.optional(v.array(foodMatchCandidateValidator)),
  bucketOptions: v.optional(v.array(foodMatchBucketValidator)),
});

const foodLogDataValidator = v.object({
  rawInput: v.optional(v.string()),
  items: v.array(foodItemValidator),
  notes: v.optional(v.string()),
  mealSlot: v.optional(
    v.union(
      v.literal("breakfast"),
      v.literal("lunch"),
      v.literal("dinner"),
      v.literal("snack"),
    ),
  ),
  /** Set by processEvidence to prevent duplicate ingredientExposure writes. */
  evidenceProcessedAt: v.optional(v.number()),
  /** Incremented on every items mutation. Used for OCC in applyLlmResults. */
  itemsVersion: v.optional(v.number()),
});

const fluidLogDataValidator = v.object({
  items: v.array(
    v.object({
      name: v.string(),
      quantity: v.number(),
      unit: v.string(),
    }),
  ),
});

const digestiveLogDataValidator = v.object({
  bristolCode: v.number(),
  urgencyTag: v.optional(v.string()),
  effortTag: v.optional(v.string()),
  consistencyTag: v.optional(v.string()),
  volumeTag: v.optional(v.string()),
  accident: v.optional(v.boolean()),
  notes: v.optional(v.string()),
  episodesCount: v.optional(v.union(v.number(), v.string())),
  windowMinutes: v.optional(v.number()),
});

const habitLogDataValidator = v.object({
  habitId: v.string(),
  name: v.string(),
  habitType: v.string(),
  quantity: v.optional(v.number()),
  action: v.optional(v.string()),
});

const activityLogDataValidator = v.object({
  activityType: v.string(),
  durationMinutes: v.optional(v.number()),
  feelTag: v.optional(v.string()),
});

const weightLogDataValidator = v.object({
  weightKg: v.number(),
});

const reproductiveLogDataValidator = v.object({
  entryType: v.literal("cycle"),
  periodStartDate: v.string(),
  bleedingStatus: v.union(
    v.literal("none"),
    v.literal("spotting"),
    v.literal("light"),
    v.literal("medium"),
    v.literal("heavy"),
  ),
  symptoms: v.optional(
    v.array(
      v.union(
        v.literal("cramps"),
        v.literal("bloating"),
        v.literal("nausea"),
        v.literal("constipation"),
        v.literal("diarrhea"),
        v.literal("headache"),
        v.literal("fatigue"),
      ),
    ),
  ),
  notes: v.optional(v.string()),
});

// ── Health profile validators ──────────────────────────────────────────────

export const reproductiveHealthValidator = v.object({
  trackingEnabled: v.boolean(),
  cycleTrackingEnabled: v.boolean(),
  lastPeriodStartDate: v.string(),
  currentCyclePhase: v.optional(
    v.union(
      v.literal("unknown"),
      v.literal("menstrual"),
      v.literal("follicular"),
      v.literal("ovulatory"),
      v.literal("luteal"),
    ),
  ),
  cycleSymptomSeverity: v.optional(v.union(v.number(), v.null())),
  averageCycleLengthDays: v.union(v.number(), v.null()),
  averagePeriodLengthDays: v.union(v.number(), v.null()),
  symptomsBeforePeriodDays: v.optional(v.union(v.number(), v.null())),
  symptomsAfterPeriodDays: v.optional(v.union(v.number(), v.null())),
  pregnancyStatus: v.union(
    v.literal("not_pregnant"),
    v.literal("pregnant"),
    v.literal("postpartum"),
  ),
  pregnancyWeeks: v.optional(v.union(v.number(), v.null())),
  dueDate: v.string(),
  postpartumSinceDate: v.string(),
  breastfeeding: v.optional(v.boolean()),
  oralContraceptive: v.optional(v.boolean()),
  contraceptiveNotes: v.optional(v.string()),
  pregnancyMedicationNotes: v.optional(v.string()),
  menopauseStatus: v.union(
    v.literal("not_applicable"),
    v.literal("perimenopause"),
    v.literal("menopause"),
    v.literal("unsure"),
  ),
  menopauseHrt: v.optional(v.boolean()),
  menopauseHrtNotes: v.optional(v.string()),
  menopauseThyroidIssues: v.optional(v.boolean()),
  hormonalMedicationNotes: v.string(),
});

const usageFrequencyValidator = v.union(
  v.literal("more_than_once_per_day"),
  v.literal("daily"),
  v.literal("a_few_times_per_week"),
  v.literal("about_once_per_week"),
  v.literal("a_few_times_per_month"),
  v.literal("about_once_per_month"),
  v.literal("a_few_times_per_year"),
  v.literal("about_once_per_year_or_less"),
  v.literal(""),
);

export const healthProfileValidator = v.object({
  gender: v.optional(
    v.union(
      v.literal("male"),
      v.literal("female"),
      v.literal("non_binary"),
      v.literal("prefer_not_to_say"),
      v.literal(""),
    ),
  ),
  ageYears: v.optional(v.union(v.number(), v.null())),
  surgeryType: v.union(
    v.literal("Colectomy with ileostomy"),
    v.literal("Colectomy with colostomy"),
    v.literal("Colectomy with primary anastomosis"),
    v.literal("Ileostomy reversal"),
    v.literal("Colostomy reversal"),
    v.literal("Other"),
  ),
  surgeryTypeOther: v.string(),
  surgeryDate: v.string(),
  height: v.union(v.number(), v.null()),
  startingWeight: v.union(v.number(), v.null()),
  currentWeight: v.union(v.number(), v.null()),
  targetWeight: v.optional(v.union(v.number(), v.null())),
  comorbidities: v.array(v.string()),
  otherConditions: v.string(),
  medications: v.string(),
  supplements: v.optional(v.string()),
  allergies: v.string(),
  intolerances: v.optional(v.string()),
  dietaryHistory: v.optional(v.string()),
  smokingStatus: v.optional(
    v.union(
      v.literal("yes"),
      v.literal("no"),
      v.literal("never"),
      v.literal("former"),
      v.literal("current"),
      v.literal(""),
    ),
  ),
  smokingCigarettesPerDay: v.optional(v.union(v.number(), v.null())),
  smokingYears: v.optional(v.union(v.number(), v.null())),
  alcoholUse: v.optional(
    v.union(
      v.literal("yes"),
      v.literal("no"),
      v.literal("none"),
      v.literal("occasional"),
      v.literal("regular"),
      v.literal(""),
    ),
  ),
  alcoholAmountPerSession: v.optional(v.string()),
  alcoholFrequency: v.optional(usageFrequencyValidator),
  alcoholYearsAtCurrentLevel: v.optional(v.union(v.number(), v.null())),
  recreationalDrugUse: v.optional(v.string()),
  recreationalCategories: v.optional(
    v.array(v.union(v.literal("stimulants"), v.literal("depressants"))),
  ),
  recreationalStimulantsFrequency: v.optional(usageFrequencyValidator),
  recreationalStimulantsYears: v.optional(v.union(v.number(), v.null())),
  recreationalDepressantsFrequency: v.optional(usageFrequencyValidator),
  recreationalDepressantsYears: v.optional(v.union(v.number(), v.null())),
  lifestyleNotes: v.optional(v.string()),
  reproductiveHealth: reproductiveHealthValidator,
});

// ── Log data validators ────────────────────────────────────────────────────

export const logDataValidator = v.union(
  foodLogDataValidator,
  fluidLogDataValidator,
  digestiveLogDataValidator,
  habitLogDataValidator,
  activityLogDataValidator,
  weightLogDataValidator,
  reproductiveLogDataValidator,
);

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/convex/lib/inputSafety.ts

/**
 * Input sanitization — server version (superset of shared core).
 *
 * Core logic (CONTROL_CHARS_RE, INPUT_SAFETY_LIMITS, SanitizeTextOptions,
 * DeepSanitizeOptions, sanitizePlainText, sanitizeUnknownStringsDeep,
 * assertMaxLength) MUST stay in sync with src/lib/inputSafety.ts.
 *
 * This file adds server-only helpers: sanitizeRequiredText,
 * sanitizeOptionalText, sanitizeStringArray.
 */

// biome-ignore lint/suspicious/noControlCharactersInRegex: intentional — sanitizes control characters from user input
const CONTROL_CHARS_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export const INPUT_SAFETY_LIMITS = {
  conversationUserContent: 2500,
  conversationAssistantContent: 12000,
  searchKeyword: 120,
  aiPayloadString: 50000,
  genericStoredString: 5000,
} as const;

type SanitizeTextOptions = {
  trim?: boolean;
  preserveNewlines?: boolean;
};

type DeepSanitizeOptions = SanitizeTextOptions & {
  maxStringLength?: number;
  path?: string;
};

export function sanitizePlainText(value: string, options: SanitizeTextOptions = {}) {
  const { trim = true, preserveNewlines = true } = options;
  let text = String(value ?? "");

  // Normalize unicode forms and line endings, then strip non-printable control chars.
  text = text.normalize("NFKC").replace(/\r\n?/g, "\n").replace(CONTROL_CHARS_RE, "");

  if (!preserveNewlines) {
    text = text.replace(/\s+/g, " ");
  }

  return trim ? text.trim() : text;
}

export function sanitizeRequiredText(
  value: string,
  fieldName: string,
  maxLength: number,
  options: SanitizeTextOptions = {},
) {
  const text = sanitizePlainText(value, options);
  if (!text) {
    throw new Error(`${fieldName} is required.`);
  }
  assertMaxLength(text, fieldName, maxLength);
  return text;
}

export function sanitizeOptionalText(
  value: string | null | undefined,
  fieldName: string,
  maxLength: number,
  options: SanitizeTextOptions = {},
) {
  if (value === null || value === undefined) return value;
  const text = sanitizePlainText(value, options);
  if (!text) return "";
  assertMaxLength(text, fieldName, maxLength);
  return text;
}

export function sanitizeStringArray(
  values: string[] | undefined,
  fieldName: string,
  maxLength: number,
  options: SanitizeTextOptions = {},
) {
  if (!values) return values;
  return values.map((value, index) =>
    sanitizeRequiredText(value, `${fieldName}[${index}]`, maxLength, options),
  );
}

export function sanitizeUnknownStringsDeep<T>(value: T, options: DeepSanitizeOptions = {}): T {
  const {
    maxStringLength = INPUT_SAFETY_LIMITS.genericStoredString,
    path = "value",
    ...textOptions
  } = options;

  const visit = (node: unknown, currentPath: string): unknown => {
    if (typeof node === "string") {
      const text = sanitizePlainText(node, textOptions);
      assertMaxLength(text, currentPath, maxStringLength);
      return text;
    }
    if (Array.isArray(node)) {
      return node.map((item, index) => visit(item, `${currentPath}[${index}]`));
    }
    if (node && typeof node === "object") {
      const entries = Object.entries(node);
      return Object.fromEntries(
        entries.map(([key, entryValue]) => [key, visit(entryValue, `${currentPath}.${key}`)]),
      );
    }
    return node;
  };

  return visit(value, path) as T;
}

function assertMaxLength(value: string, fieldName: string, maxLength: number) {
  if (value.length > maxLength) {
    throw new Error(`${fieldName} exceeds the maximum length of ${maxLength} characters.`);
  }
}

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/src/hooks/useFoodLlmMatching.ts

/**
 * Client-initiated LLM food matching hook.
 *
 * Detects food logs with unresolved items (no canonicalName, no resolvedBy)
 * and calls the server-side matchUnresolvedItems action with the user's
 * OpenAI API key from IndexedDB when available, otherwise relying on the
 * server-stored fallback. Each log is only sent once per mount (tracked
 * via a ref Set).
 *
 * Skips if no API key is configured or if no unresolved items exist.
 *
 * Shows toast notifications for progress and results:
 * - Start: "Matching foods with AI..."
 * - Success: "X food(s) matched automatically"
 * - Error: user-friendly message (non-retryable errors only)
 */

import { useAction } from "convex/react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useApiKeyContext } from "@/contexts/ApiKeyContext";
import { useSyncedLogsContext } from "@/contexts/SyncedLogsContext";
import { asConvexId, type SyncedLog } from "@/lib/sync";
import type { FoodItem, FoodLog } from "@/types/domain";
import { api } from "../../convex/_generated/api";

/**
 * Check if a food item is unresolved and eligible for LLM matching.
 * An item is unresolved if it has no canonicalName and no resolvedBy.
 */
function isItemUnresolvedForLlm(item: FoodItem): boolean {
  if (item.canonicalName != null && item.canonicalName.length > 0) {
    return false;
  }
  if (item.resolvedBy != null) {
    return false;
  }
  return true;
}

/**
 * Find food logs that have unresolved items needing LLM matching.
 * Only considers logs from the last 6 hours (the processing window).
 */
function findLogsNeedingLlmMatching(logs: SyncedLog[], nowMs: number): FoodLog[] {
  const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
  const result: FoodLog[] = [];

  for (const log of logs) {
    if (log.type !== "food") continue;
    const foodLog = log as FoodLog;

    // Only process logs within the 6-hour window
    const ageMs = nowMs - foodLog.timestamp;
    if (ageMs > SIX_HOURS_MS || ageMs < 0) continue;

    // Must have rawInput (new-style logs) and items
    if (!foodLog.data.rawInput || foodLog.data.items.length === 0) continue;

    // Must have at least one unresolved item
    const hasUnresolved = foodLog.data.items.some(isItemUnresolvedForLlm);
    if (hasUnresolved) {
      result.push(foodLog);
    }
  }

  return result;
}

/**
 * Automatically triggers LLM matching for food logs with unresolved items.
 *
 * Call this hook from the Track page. It monitors the user's food logs,
 * detects unresolved items, and sends them to OpenAI for matching.
 * Each log is only sent once per component mount.
 */
export function useFoodLlmMatching(): void {
  const logs = useSyncedLogsContext();
  const { apiKey, hasApiKey } = useApiKeyContext();
  const matchItems = useAction(api.foodLlmMatching.matchUnresolvedItems);

  // Track which log IDs have already been sent to avoid duplicate calls
  const sentLogIdsRef = useRef(new Set<string>());
  // Store the action ref to avoid deps churn
  const matchItemsRef = useRef(matchItems);
  matchItemsRef.current = matchItems;
  const apiKeyRef = useRef(apiKey);
  apiKeyRef.current = apiKey;

  // Clear sent log IDs when the API key changes so logs can be re-sent
  // with the new key (fixes stale closure over previous key's sent set).
  // apiKey is intentionally in deps to reset the set on key change.
  // biome-ignore lint/correctness/useExhaustiveDependencies: apiKey change must clear sent IDs
  useEffect(() => {
    sentLogIdsRef.current = new Set();
  }, [apiKey]);

  useEffect(() => {
    if (!hasApiKey) return;

    const nowMs = Date.now();
    const logsNeedingMatching = findLogsNeedingLlmMatching(logs, nowMs);

    for (const foodLog of logsNeedingMatching) {
      // Skip if already sent
      if (sentLogIdsRef.current.has(foodLog.id)) continue;
      sentLogIdsRef.current.add(foodLog.id);

      // Collect unresolved segments
      const unresolvedSegments = foodLog.data.items
        .filter(isItemUnresolvedForLlm)
        .map((item) => item.userSegment ?? item.name ?? "")
        .filter((segment) => segment.length > 0);

      if (unresolvedSegments.length === 0) continue;

      const rawInput = foodLog.data.rawInput ?? "";
      if (!rawInput) continue;

      // Show a brief "matching in progress" indicator.
      const toastId = toast.loading("Matching foods with AI...", {
        duration: 30_000,
      });

      // Fire and forget — errors are logged to console.
      // Non-retryable errors (auth, validation) stay in sentLogIdsRef
      // so we don't spam the API. Retryable errors (rate limit, server)
      // are removed from the set so the next render cycle can retry.
      matchItemsRef
        .current({
          apiKey: apiKeyRef.current ?? "",
          logId: asConvexId<"logs">(foodLog.id),
          rawInput,
          unresolvedSegments,
        })
        .then((result) => {
          if (result.matched > 0) {
            const foodWord = result.matched === 1 ? "food" : "foods";
            toast.success(`${result.matched} ${foodWord} matched automatically`, {
              id: toastId,
            });
          } else {
            // Nothing matched — dismiss the loading toast silently.
            // The unresolved toast from useUnresolvedFoodToast will guide the user.
            toast.dismiss(toastId);
          }
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : "Unknown error";
          console.error(`LLM food matching failed for log ${foodLog.id}: ${message}`);

          // Non-retryable errors: don't remove from sent set (prevents retry loops)
          const isNonRetryable =
            message.includes("[NON_RETRYABLE]") ||
            message.includes("Invalid OpenAI API key") ||
            message.includes("Not authorized");

          if (isNonRetryable) {
            // Show user-friendly error for bad API key — most actionable non-retryable error
            if (
              message.includes("Invalid OpenAI API key") ||
              message.includes("[NON_RETRYABLE] Invalid OpenAI API key")
            ) {
              toast.error("AI matching failed: check your OpenAI API key in Settings", {
                id: toastId,
              });
            } else {
              toast.dismiss(toastId);
            }
          } else {
            // Retryable error — dismiss loading toast and remove from sent set so it can be retried
            toast.dismiss(toastId);
            sentLogIdsRef.current.delete(foodLog.id);
          }
        });
    }
    // logs array ref changes on every Convex update, but sentLogIdsRef deduplicates
  }, [logs, hasApiKey]);
}

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/src/hooks/useAiInsights.ts

import { useAction, useMutation } from "convex/react";
import { useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import { useApiKeyContext } from "@/contexts/ApiKeyContext";
import { useSyncedLogsContext } from "@/contexts/SyncedLogsContext";
import { usePendingReplies } from "@/hooks/usePendingReplies";
import { useAiPreferences, useHealthProfile } from "@/hooks/useProfile";
import { getLastHalfWeekBoundary } from "@/hooks/useWeeklySummaryAutoTrigger";
import {
  type FetchAiInsightsOptions,
  fetchAiInsights,
  type PreviousReport,
  parseAiInsight,
} from "@/lib/aiAnalysis";
import { DEFAULT_INSIGHT_MODEL } from "@/lib/aiModels";
import { getErrorMessage } from "@/lib/errors";
import {
  useAddAiAnalysis,
  useAddAssistantMessage,
  useAiAnalysisHistory,
  useAllFoodTrials,
  useConversationsByDateRange,
  useLatestSuccessfulAiAnalysis,
  useLatestWeeklySummary,
  useSuggestionsByDateRange,
  useWeeklyDigests,
} from "@/lib/sync";
import { useStore } from "@/store";
import type {
  AiPreferences,
  DrPooReply,
  HealthProfile,
  LogEntry,
} from "@/types/domain";
import { api } from "../../convex/_generated/api";

const COOLDOWN_MS = 7_200_000; // 2 hours
const REACTIVE_DELAY_MS = 1_500; // wait for Convex reactive query to update
// Pull recent history for educational insight dedupe (avoiding repeats).
// 20 reports covers ~2-3 weeks of typical usage — enough to avoid short-term
// repetition without fetching hundreds of documents from Convex on every render.
const REPORT_HISTORY_COUNT = 20;

/**
 * Mutable snapshot refs that track the latest values of reactive data for use inside callbacks.
 *
 * All Convex query results are stored here rather than used as callback dependencies.
 * This means the 8+ independent queries can resolve at different times without
 * causing callback identity churn or cascading re-renders to the parent component.
 */
interface DataRefs {
  logs: LogEntry[];
  history: ReturnType<typeof useAiAnalysisHistory>;
  addAssistantMessage: ReturnType<typeof useAddAssistantMessage>;
  replies: DrPooReply[];
  healthProfile: HealthProfile;
  aiPreferences: AiPreferences;
  foodTrials: ReturnType<typeof useAllFoodTrials>;
  weeklyDigests: ReturnType<typeof useWeeklyDigests>;
  conversationHistory: ReturnType<typeof useConversationsByDateRange>;
  recentSuggestions: ReturnType<typeof useSuggestionsByDateRange>;
  latestWeeklySummary: ReturnType<typeof useLatestWeeklySummary>;
  latestSuccessfulAnalysis: ReturnType<typeof useLatestSuccessfulAiAnalysis>;
  baselineAverages: import("@/types/domain").BaselineAverages | null;
}

export function useAiInsights() {
  const { apiKey } = useApiKeyContext();
  const callAi = useAction(api.ai.chatCompletion);
  const setAiAnalysisStatus = useStore((state) => state.setAiAnalysisStatus);
  const { pendingReplies } = usePendingReplies();
  const { healthProfile } = useHealthProfile();
  const { aiPreferences } = useAiPreferences();
  const baselineAverages = useStore((state) => state.baselineAverages);
  const markInsightRun = useStore((state) => state.markInsightRun);

  // Use shared logs from context instead of creating a duplicate subscription
  const logs = useSyncedLogsContext();

  // Fetch last N successful analyses for conversation context
  const analysisHistory = useAiAnalysisHistory(REPORT_HISTORY_COUNT);
  const latestSuccessfulAnalysis = useLatestSuccessfulAiAnalysis();

  const addAiAnalysis = useAddAiAnalysis();
  const addAssistantMessage = useAddAssistantMessage();
  const claimPendingReplies = useMutation(
    api.conversations.claimPendingReplies,
  );

  // Use a ref to track the in-flight request — prevents concurrent analysis runs
  const abortRef = useRef<AbortController | null>(null);
  const loadingRef = useRef(false);

  // Layer 1-3 enhanced context hooks
  const foodTrials = useAllFoodTrials();

  const weeklyDigests = useWeeklyDigests(4);

  // Conversation history + suggestions: current half-week only (since last Sun/Wed 21:00 boundary).
  // Historical context comes from the weekly summary, not from old messages/suggestions.
  const { halfWeekStartMs, stableEndMs } = useMemo(() => {
    const boundary = getLastHalfWeekBoundary();
    const now = Date.now();
    return {
      halfWeekStartMs: boundary.getTime(),
      stableEndMs: now + 7 * 24 * 60 * 60_000, // 1 week upper bound so Convex query params are stable
    };
  }, []);

  const conversationHistory = useConversationsByDateRange(
    halfWeekStartMs,
    stableEndMs,
  );

  // Suggestions: current half-week only (same boundary as conversations)
  const recentSuggestions = useSuggestionsByDateRange(
    halfWeekStartMs,
    stableEndMs,
  );

  const latestWeeklySummary = useLatestWeeklySummary();

  // Map Convex pending replies to DrPooReply shape for the analysis callback
  const drPooReplies: DrPooReply[] = useMemo(
    () =>
      pendingReplies.map((r) => ({ text: r.content, timestamp: r.timestamp })),
    [pendingReplies],
  );

  // ---------------------------------------------------------------------------
  // Single ref object for all mutable data snapshots used inside callbacks.
  // By storing ALL query results in a ref, we decouple query resolution from
  // callback identity — the 8+ queries can each resolve independently without
  // invalidating useCallback deps or triggering parent re-renders.
  // ---------------------------------------------------------------------------
  const dataRef = useRef<DataRefs>({
    logs,
    history: analysisHistory,
    addAssistantMessage,
    replies: drPooReplies,
    healthProfile: healthProfile ?? ({} as HealthProfile),
    aiPreferences,
    foodTrials,
    weeklyDigests,
    conversationHistory,
    recentSuggestions,
    latestWeeklySummary,
    latestSuccessfulAnalysis,
    baselineAverages,
  });
  dataRef.current.logs = logs;
  dataRef.current.history = analysisHistory;
  dataRef.current.addAssistantMessage = addAssistantMessage;
  dataRef.current.replies = drPooReplies;
  dataRef.current.healthProfile = healthProfile ?? ({} as HealthProfile);
  dataRef.current.aiPreferences = aiPreferences;
  dataRef.current.foodTrials = foodTrials;
  dataRef.current.weeklyDigests = weeklyDigests;
  dataRef.current.conversationHistory = conversationHistory;
  dataRef.current.recentSuggestions = recentSuggestions;
  dataRef.current.latestWeeklySummary = latestWeeklySummary;
  dataRef.current.latestSuccessfulAnalysis = latestSuccessfulAnalysis;
  dataRef.current.baselineAverages = baselineAverages;

  const runAnalysis = useCallback(
    async (runOptions?: FetchAiInsightsOptions) => {
      if (!apiKey) return;
      // Guard: skip if a request is already in flight
      if (loadingRef.current) return;

      const isLightweight = runOptions?.lightweight === true;

      // Abort any previous controller (defensive — should not be needed given the guard above)
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      loadingRef.current = true;

      setAiAnalysisStatus("sending");

      // Snapshot pending replies before the delay
      const pendingReplies = [...dataRef.current.replies];

      // Wait for Convex reactive query to include the just-logged entry
      await new Promise((resolve) => setTimeout(resolve, REACTIVE_DELAY_MS));

      // Context guard: in lightweight mode, pending replies are sufficient.
      // In full mode, require either bowel data or a pending question.
      if (isLightweight) {
        if (pendingReplies.length === 0) {
          setAiAnalysisStatus("error", "Send a question to Dr. Poo first.");
          loadingRef.current = false;
          return;
        }
      } else {
        const freshLogs = dataRef.current.logs;
        const hasBowelContext = freshLogs.some(
          (log) => log.type === "digestion",
        );
        const hasQuestionContext = pendingReplies.length > 0;
        if (!hasBowelContext && !hasQuestionContext) {
          setAiAnalysisStatus(
            "error",
            "Log a bowel movement or send a question first.",
          );
          loadingRef.current = false;
          return;
        }
      }

      // In lightweight mode, skip heavy data collection
      const freshLogs = isLightweight ? [] : dataRef.current.logs;

      const previousReports: PreviousReport[] = isLightweight
        ? []
        : (dataRef.current.history ?? [])
            .filter(
              (a) => a.insight !== null && a.insight !== undefined && !a.error,
            )
            .map((a) => {
              const parsed = parseAiInsight(a.insight);
              if (!parsed) return null;
              return { timestamp: a.timestamp, insight: parsed };
            })
            .filter((r): r is NonNullable<typeof r> => r !== null);

      // Conversation history is always included (both modes need it)
      const conversationHistoryMapped = (
        dataRef.current.conversationHistory ?? []
      ).map(
        (msg: {
          role: "user" | "assistant";
          content: string;
          timestamp: number;
        }) => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
        }),
      );

      // Build enhanced context: lightweight mode only includes conversation history
      const enhancedContext = isLightweight
        ? { conversationHistory: conversationHistoryMapped }
        : {
            ...(dataRef.current.foodTrials !== undefined && {
              foodTrials: dataRef.current.foodTrials,
            }),
            conversationHistory: conversationHistoryMapped,
            weeklyContext: (dataRef.current.weeklyDigests ?? []).map((wd) => ({
              weekStart: wd.weekStart,
              avgBristolScore: wd.avgBristolScore ?? null,
              totalBowelEvents: wd.totalBowelEvents,
              accidentCount: wd.accidentCount,
              uniqueFoodsEaten: wd.uniqueFoodsEaten,
              newFoodsTried: wd.newFoodsTried,
              foodsCleared: wd.foodsCleared,
              foodsFlagged: wd.foodsFlagged,
            })),
            recentSuggestions: (dataRef.current.recentSuggestions ?? []).map(
              (s: {
                text: string;
                textNormalized: string;
                reportTimestamp: number;
              }) => ({
                text: s.text,
                textNormalized: s.textNormalized,
                reportTimestamp: s.reportTimestamp,
              }),
            ),
            ...(dataRef.current.latestWeeklySummary && {
              previousWeeklySummary: {
                weeklySummary:
                  dataRef.current.latestWeeklySummary.weeklySummary,
                keyFoods: dataRef.current.latestWeeklySummary.keyFoods,
                carryForwardNotes:
                  dataRef.current.latestWeeklySummary.carryForwardNotes,
              },
            }),
            ...(dataRef.current.baselineAverages !== null && {
              baselineAverages: dataRef.current.baselineAverages,
            }),
          };

      try {
        if (controller.signal.aborted) return;

        setAiAnalysisStatus("receiving");
        const result = await fetchAiInsights(
          callAi,
          apiKey,
          freshLogs as LogEntry[],
          previousReports,
          pendingReplies,
          dataRef.current.healthProfile,
          enhancedContext,
          dataRef.current.aiPreferences,
          isLightweight ? { lightweight: true } : undefined,
        );

        if (!controller.signal.aborted) {
          // Mark that the insight run consumed the current baseline data
          // (skip in lightweight mode — no baseline data was consumed)
          if (!isLightweight) {
            markInsightRun();
          }

          try {
            const analysisId = await addAiAnalysis({
              timestamp: Date.now(),
              request: result.request,
              response: result.rawResponse,
              insight: result.insight,
              model: result.request.model,
              durationMs: result.durationMs,
              inputLogCount: result.inputLogCount,
            });

            await claimPendingReplies({ aiAnalysisId: analysisId });

            if (result.insight.summary) {
              await dataRef.current.addAssistantMessage(
                result.insight.summary,
                analysisId,
              );
            }
            if (result.insight.directResponseToUser) {
              await dataRef.current.addAssistantMessage(
                result.insight.directResponseToUser,
                analysisId,
              );
            }

            if (!controller.signal.aborted) {
              setAiAnalysisStatus("done");
            }
          } catch (err) {
            console.error("[AI Nutritionist] Failed to save analysis:", err);
            if (!controller.signal.aborted) {
              setAiAnalysisStatus("error", "Failed to save analysis");
            }
            toast.error("Failed to save analysis");
          }
        }
      } catch (err: unknown) {
        console.error("[AI Nutritionist]", err);
        if (!controller.signal.aborted) {
          const message = getErrorMessage(err);
          setAiAnalysisStatus("error", message);

          // Save error record to Convex
          addAiAnalysis({
            timestamp: Date.now(),
            request: null,
            response: null,
            insight: null,
            model: DEFAULT_INSIGHT_MODEL,
            durationMs: 0,
            inputLogCount: isLightweight
              ? 0
              : dataRef.current.logs.filter((l) => l.type === "digestion")
                  .length,
            error: message,
          }).catch((saveErr) =>
            console.error("[AI Nutritionist] Failed to save error:", saveErr),
          );
        }
      } finally {
        loadingRef.current = false;
      }
    },
    [
      apiKey,
      callAi,
      setAiAnalysisStatus,
      addAiAnalysis,
      claimPendingReplies,
      markInsightRun,
    ],
  );

  // Background trigger (after logging bowel movement) — cooldown-gated, Bristol-aware.
  // Bristol 6-7 (diarrhea emergency) bypasses the cooldown.
  // Data-aware: skips if no new bowel data AND cooldown hasn't passed.
  // latestSuccessfulAnalysis is read from dataRef (not a dep) so the callback
  // identity is stable even when that query re-resolves with the same timestamp.
  const triggerAnalysis = useCallback(
    async (options?: { bristolScore?: number; autoSendEnabled?: boolean }) => {
      if (!apiKey) return;

      // If auto-send is explicitly disabled (manual mode), skip
      if (options?.autoSendEnabled === false) return;

      const bristolScore = options?.bristolScore;
      const isEmergency = bristolScore !== undefined && bristolScore >= 6;

      // Bristol 6-7 (diarrhea emergency) bypasses cooldown entirely
      if (!isEmergency) {
        // Data-aware cooldown: skip if no new bowel data AND cooldown hasn't passed
        const relevantLogs = dataRef.current.logs.filter(
          (log) => log.type === "digestion",
        );
        const newestRelevantLogAt = relevantLogs.reduce(
          (max, log) => Math.max(max, log.timestamp),
          0,
        );
        const latestAiInsightAt =
          dataRef.current.latestSuccessfulAnalysis?.timestamp ?? null;
        const hasNewData = newestRelevantLogAt > (latestAiInsightAt ?? 0);
        const cooldownPassed =
          !latestAiInsightAt || Date.now() - latestAiInsightAt >= COOLDOWN_MS;
        if (!hasNewData && !cooldownPassed) return;
      }

      await runAnalysis();
    },
    [apiKey, runAnalysis],
  );

  // sendNow: manual trigger. During cooldown, use lightweight mode (conversation-only).
  // Reads latestSuccessfulAnalysis from dataRef for the same reason as triggerAnalysis.
  const sendNow = useCallback(() => {
    const latestAiInsightAt =
      dataRef.current.latestSuccessfulAnalysis?.timestamp ?? null;
    const isInCooldown =
      latestAiInsightAt != null && Date.now() - latestAiInsightAt < COOLDOWN_MS;
    return runAnalysis(isInCooldown ? { lightweight: true } : undefined);
  }, [runAnalysis]);

  // Memoize the return value so the parent component only re-renders when
  // the actual outputs change, not when internal queries resolve.
  const hasApiKey = Boolean(apiKey);
  return useMemo(
    () => ({ hasApiKey, triggerAnalysis, sendNow }),
    [hasApiKey, triggerAnalysis, sendNow],
  );
}

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/shared/foodRegistry.ts

/**
 * Food Registry — barrel re-export.
 *
 * All registry data (types, entries, zone arrays) lives in foodRegistryData.ts.
 * All lookup/utility functions live in foodRegistryUtils.ts.
 *
 * This file re-exports everything from both for backward compatibility.
 */

export type {
  FoodCategory,
  FoodDigestionMetadata,
  FoodDryTextureLevel,
  FoodGasLevel,
  FoodGroup,
  FoodLine,
  FoodRegistryEntry,
  FoodResidueLevel,
  FoodRiskLevel,
  FoodSubcategory,
  FoodSubzone,
  FoodZone,
} from "./foodRegistryData";

export { FOOD_GROUP_LINES, FOOD_REGISTRY } from "./foodRegistryData";

export {
  CANONICAL_FOOD_NAMES,
  FOOD_GROUPS,
  FOOD_LINES,
  getFoodDigestionMetadata,
  getFoodEntry,
  getFoodGroup,
  getFoodLine,
  getFoodsByLine,
  getFoodsByZone,
  getFoodZone,
  getGroupDisplayName,
  getLineDisplayName,
  getLinesByGroup,
  isCanonicalFood,
  pickFoodDigestionMetadata,
} from "./foodRegistryUtils";

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/shared/foodMatching.ts

import Fuse, { type IFuseOptions } from "fuse.js";
import { parseLeadingQuantity } from "./foodParsing";
import {
  FOOD_REGISTRY,
  type FoodGroup,
  type FoodLine,
  type FoodRegistryEntry,
  type FoodZone,
} from "./foodRegistry";

export type FoodMatchResolver =
  | "alias"
  | "fuzzy"
  | "embedding"
  | "combined"
  | "llm"
  | "user";

export interface LearnedFoodAlias {
  aliasText: string;
  normalizedAlias: string;
  canonicalName: string;
  userId: string | null;
}

export interface PreprocessedFoodPhrase {
  rawPhrase: string;
  parsedName: string;
  normalizedName: string;
  quantity: number | null;
  unit: string | null;
  quantityText: string | null;
}

export interface FoodSearchDocument {
  canonicalName: string;
  zone: FoodZone;
  group: FoodGroup;
  line: FoodLine;
  bucketKey: string;
  bucketLabel: string;
  examples: ReadonlyArray<string>;
  normalizedCanonicalName: string;
  normalizedExamples: ReadonlyArray<string>;
  normalizedAliases: ReadonlyArray<string>;
  notes?: string;
  embeddingText: string;
  embeddingSourceHash: string;
}

export interface FoodMatchCandidate {
  canonicalName: string;
  zone: FoodZone;
  group: FoodGroup;
  line: FoodLine;
  bucketKey: string;
  bucketLabel: string;
  resolver: Exclude<FoodMatchResolver, "user">;
  combinedConfidence: number;
  fuzzyScore: number | null;
  embeddingScore: number | null;
  examples: ReadonlyArray<string>;
}

export interface FoodMatchBucketOption {
  bucketKey: string;
  bucketLabel: string;
  canonicalOptions: ReadonlyArray<string>;
  bestConfidence: number;
}

export interface FoodMatcherContext {
  documents: ReadonlyArray<FoodSearchDocument>;
  fuse: Fuse<FoodSearchDocument>;
  exactAliasMap: ReadonlyMap<string, FoodSearchDocument>;
  documentMap: ReadonlyMap<string, FoodSearchDocument>;
}

export interface ConfidenceRoute {
  level: "high" | "medium" | "low";
  topCandidate: FoodMatchCandidate | null;
  candidates: ReadonlyArray<FoodMatchCandidate>;
  buckets: ReadonlyArray<FoodMatchBucketOption>;
}

const CONJUNCTION_SPLIT_PATTERN =
  /\s*(?:,|;|\/|&|\b(?:and|with|plus|y|con)\b)\s*/gi;

const PROTECTED_PHRASES = [
  "mac and cheese",
  "salt and vinegar",
  "peanut butter and jelly",
  "peanut butter and jam",
];
const MIN_FOOD_MATCH_CHARS = 3;

const DEFAULT_FUSE_OPTIONS: IFuseOptions<FoodSearchDocument> = {
  keys: [
    { name: "normalizedAliases", weight: 0.5 },
    { name: "normalizedCanonicalName", weight: 0.3 },
    { name: "normalizedExamples", weight: 0.2 },
  ],
  threshold: 0.35,
  includeScore: true,
  ignoreLocation: true,
  minMatchCharLength: MIN_FOOD_MATCH_CHARS,
  shouldSort: true,
};

const LINE_BUCKET_LABELS: Record<FoodLine, string> = {
  meat_fish: "Gentle meat or fish",
  eggs_dairy: "Egg or dairy",
  vegetable_protein: "Soft plant protein",
  grains: "Bread, grain, or snack",
  vegetables: "Cooked or soft veg",
  fruit: "Soft fruit",
  oils: "Added fat",
  dairy_fats: "Cheese or dairy fat",
  nuts_seeds: "Fat or nut/seed food",
  sauces_condiments: "Sauce or condiment",
  herbs_spices: "Herb or spice",
};

const CANONICAL_BUCKET_LABELS: Array<{
  match: RegExp;
  label: string;
}> = [
  { match: /\bgrilled\b/, label: "Grilled meat or fish" },
  {
    match: /\bboiled\b|\bsteamed\b|\bpoached\b/,
    label: "Boiled or steamed food",
  },
  {
    match: /\bmashed\b|\bpureed\b|\bpurée\b|\bpuree\b/,
    label: "Puree or mash",
  },
  { match: /\bsoup\b|\bbroth\b/, label: "Soup or broth" },
  {
    match: /\bcracker\b|\bbreadstick\b|\bcrisp\b/,
    label: "Cracker or savoury snack",
  },
  {
    match: /\bbiscuit\b|\bcookie\b|\bcake\b|\bpudding\b|\bgelatin\b/,
    label: "Sweet snack",
  },
  { match: /\byogurt\b|\byoghurt\b|\bcheese\b|\bmilk\b/, label: "Dairy" },
];

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function stripFoodAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeFoodMatchText(value: string): string {
  return stripFoodAccents(value)
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9\s/-]/g, " ")
    .replace(/[-/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function protectPhrases(raw: string): {
  protectedText: string;
  placeholders: Map<string, string>;
} {
  let protectedText = raw;
  const placeholders = new Map<string, string>();

  for (const phrase of PROTECTED_PHRASES) {
    const placeholder = `__food_match_${placeholders.size}__`;
    const pattern = new RegExp(phrase, "gi");
    if (!pattern.test(protectedText)) continue;
    protectedText = protectedText.replace(pattern, placeholder);
    placeholders.set(placeholder, phrase);
  }

  return { protectedText, placeholders };
}

function restoreProtectedPhrase(
  value: string,
  placeholders: ReadonlyMap<string, string>,
): string {
  let restored = value;
  for (const [placeholder, phrase] of placeholders) {
    restored = restored.replaceAll(placeholder, phrase);
  }
  return restored;
}

function sanitizeFoodPhrase(value: string): string {
  return value
    .replace(/^[\s.:;!?-]+/, "")
    .replace(/[\s.:;!?]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function splitMealIntoFoodPhrases(rawText: string): string[] {
  if (!rawText.trim()) return [];

  const { protectedText, placeholders } = protectPhrases(
    rawText.replace(/\n+/g, ", ").replace(/\s+/g, " ").trim(),
  );

  return protectedText
    .split(CONJUNCTION_SPLIT_PATTERN)
    .map((segment) => restoreProtectedPhrase(segment, placeholders))
    .map(sanitizeFoodPhrase)
    .filter((segment) => segment.length > 0);
}

function deriveQuantityText(
  rawPhrase: string,
  parsedName: string,
): string | null {
  const normalizedRaw = rawPhrase.trim().replace(/\s+/g, " ");
  if (!normalizedRaw || normalizedRaw === parsedName) return null;
  const rawIndex = normalizedRaw
    .toLowerCase()
    .lastIndexOf(parsedName.toLowerCase());
  if (rawIndex <= 0) return null;
  const quantityText = normalizedRaw.slice(0, rawIndex).trim();
  return quantityText.length > 0 ? quantityText : null;
}

export function preprocessMealText(rawText: string): PreprocessedFoodPhrase[] {
  return splitMealIntoFoodPhrases(rawText)
    .map((rawPhrase) => {
      const { parsedName, quantity, unit } = parseLeadingQuantity(rawPhrase);
      const safeParsedName = sanitizeFoodPhrase(parsedName || rawPhrase);
      // Guard against NaN/Infinity/negative from Number() parsing.
      // Null means "no quantity specified" which is a valid state.
      const safeQuantity =
        quantity !== null && Number.isFinite(quantity) && quantity > 0
          ? quantity
          : null;
      return {
        rawPhrase,
        parsedName: safeParsedName,
        normalizedName: normalizeFoodMatchText(safeParsedName),
        quantity: safeQuantity,
        unit: safeQuantity !== null ? unit : null,
        quantityText: deriveQuantityText(rawPhrase, safeParsedName),
      };
    })
    .filter((phrase) => phrase.normalizedName.length > 0);
}

function deriveBucketLabel(
  entry: Pick<FoodRegistryEntry, "canonical" | "line">,
): string {
  for (const rule of CANONICAL_BUCKET_LABELS) {
    if (rule.match.test(entry.canonical)) {
      return rule.label;
    }
  }
  return LINE_BUCKET_LABELS[entry.line];
}

function deriveBucketKey(
  entry: Pick<FoodRegistryEntry, "canonical" | "line">,
): string {
  const canonical = normalizeFoodMatchText(entry.canonical).replace(
    /\s+/g,
    "_",
  );
  if (canonical.includes("grilled")) return "grilled_protein";
  if (
    canonical.includes("boiled") ||
    canonical.includes("poached") ||
    canonical.includes("steamed")
  ) {
    return "boiled_or_steamed";
  }
  if (canonical.includes("soup") || canonical.includes("broth")) return "soups";
  if (canonical.includes("cracker") || canonical.includes("crisp"))
    return "crackers_and_snacks";
  if (
    canonical.includes("biscuit") ||
    canonical.includes("pudding") ||
    canonical.includes("gelatin")
  ) {
    return "sweet_snacks";
  }
  return `line_${entry.line}`;
}

function buildEmbeddingText(entry: FoodRegistryEntry): string {
  const macroProfile = entry.macros.join(", ") || "none";
  const exampleText = entry.examples.slice(0, 5).join(", ");
  return [
    `Food: ${entry.canonical}`,
    `Zone: ${entry.zone}`,
    `Group: ${entry.group}`,
    `Line: ${entry.line}`,
    `Macros: ${macroProfile}`,
    entry.notes ? `Notes: ${entry.notes}` : null,
    exampleText ? `Examples: ${exampleText}` : null,
  ]
    .filter((part): part is string => part !== null)
    .join(". ");
}

export function getFoodEmbeddingSourceHash(value: string): string {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function buildFoodSearchDocuments(
  aliases: ReadonlyArray<LearnedFoodAlias>,
): FoodSearchDocument[] {
  // TODO(review): the matcher currently projects from the legacy shared
  // transit-map registry so the rest of the app keeps working on this branch.
  // The richer Zone 1/2 schema from schema-food-zones.md should become the
  // matching corpus once downstream consumers are ready for the canonical rename.
  const aliasesByCanonical = new Map<string, string[]>();

  for (const alias of aliases) {
    const existing = aliasesByCanonical.get(alias.canonicalName) ?? [];
    existing.push(alias.aliasText);
    aliasesByCanonical.set(alias.canonicalName, existing);
  }

  return FOOD_REGISTRY.map((entry) => {
    const aliasTexts = aliasesByCanonical.get(entry.canonical) ?? [];
    const embeddingText = buildEmbeddingText(entry);
    return {
      canonicalName: entry.canonical,
      zone: entry.zone,
      group: entry.group,
      line: entry.line,
      bucketKey: deriveBucketKey(entry),
      bucketLabel: deriveBucketLabel(entry),
      examples: entry.examples,
      normalizedCanonicalName: normalizeFoodMatchText(entry.canonical),
      normalizedExamples: entry.examples.map(normalizeFoodMatchText),
      normalizedAliases: aliasTexts.map(normalizeFoodMatchText),
      ...(entry.notes ? { notes: entry.notes } : {}),
      embeddingText,
      embeddingSourceHash: getFoodEmbeddingSourceHash(embeddingText),
    };
  });
}

export function createFoodMatcherContext(
  aliases: ReadonlyArray<LearnedFoodAlias>,
): FoodMatcherContext {
  const documents = buildFoodSearchDocuments(aliases);
  const fuse = new Fuse(documents, DEFAULT_FUSE_OPTIONS);
  const exactAliasMap = new Map<string, FoodSearchDocument>();
  const documentMap = new Map<string, FoodSearchDocument>();

  for (const document of documents) {
    documentMap.set(document.canonicalName, document);

    exactAliasMap.set(document.normalizedCanonicalName, document);
    for (const normalizedExample of document.normalizedExamples) {
      exactAliasMap.set(normalizedExample, document);
    }
    for (const normalizedAlias of document.normalizedAliases) {
      exactAliasMap.set(normalizedAlias, document);
    }
  }

  // User-specific aliases are passed after global aliases and should win
  // over canonical/example exact matches for the same normalized phrase.
  for (const alias of aliases) {
    const document = documentMap.get(alias.canonicalName);
    if (!document) continue;
    exactAliasMap.set(alias.normalizedAlias, document);
  }

  return {
    documents,
    fuse,
    exactAliasMap,
    documentMap,
  };
}

function documentToCandidate(
  document: FoodSearchDocument,
  resolver: Exclude<FoodMatchResolver, "user">,
  fuzzyScore: number | null,
  embeddingScore: number | null,
  combinedConfidence: number,
): FoodMatchCandidate {
  return {
    canonicalName: document.canonicalName,
    zone: document.zone,
    group: document.group,
    line: document.line,
    bucketKey: document.bucketKey,
    bucketLabel: document.bucketLabel,
    resolver,
    fuzzyScore,
    embeddingScore,
    combinedConfidence: clampConfidence(combinedConfidence),
    examples: document.examples,
  };
}

export function findExactAliasCandidate(
  query: string,
  context: FoodMatcherContext,
): FoodMatchCandidate | null {
  const normalized = normalizeFoodMatchText(query);
  if (!normalized) return null;
  const document = context.exactAliasMap.get(normalized);
  if (!document) return null;
  return documentToCandidate(document, "alias", 1, null, 0.99);
}

export function fuzzySearchFoodCandidates(
  query: string,
  context: FoodMatcherContext,
  limit = 5,
): FoodMatchCandidate[] {
  const exact = findExactAliasCandidate(query, context);
  if (exact) return [exact];

  const normalized = normalizeFoodMatchText(query);
  if (!normalized) return [];

  const results = context.fuse.search(normalized, { limit });
  return results.map((result) => {
    const fuzzyScore = clampConfidence(1 - (result.score ?? 1));
    return documentToCandidate(
      result.item,
      "fuzzy",
      fuzzyScore,
      null,
      fuzzyScore,
    );
  });
}

function getTextSearchRank(
  document: FoodSearchDocument,
  normalizedQuery: string,
): number | null {
  if (!normalizedQuery) return null;

  const fields = [
    document.normalizedCanonicalName,
    ...document.normalizedAliases,
    ...document.normalizedExamples,
  ];

  if (fields.some((field) => field === normalizedQuery)) return 0;
  if (document.normalizedCanonicalName.startsWith(normalizedQuery)) return 1;
  if (
    document.normalizedAliases.some((field) =>
      field.startsWith(normalizedQuery),
    )
  ) {
    return 2;
  }
  if (
    document.normalizedExamples.some((field) =>
      field.startsWith(normalizedQuery),
    )
  ) {
    return 3;
  }
  if (document.normalizedCanonicalName.includes(normalizedQuery)) return 4;
  if (
    document.normalizedAliases.some((field) => field.includes(normalizedQuery))
  ) {
    return 5;
  }
  if (
    document.normalizedExamples.some((field) => field.includes(normalizedQuery))
  ) {
    return 6;
  }

  return null;
}

export function searchFoodDocuments(
  query: string,
  context: FoodMatcherContext,
  options?: {
    bucketKey?: string;
    limit?: number;
  },
): FoodSearchDocument[] {
  const limit = options?.limit ?? 50;
  const filteredDocuments =
    options?.bucketKey === undefined
      ? context.documents
      : context.documents.filter(
          (document) => document.bucketKey === options.bucketKey,
        );

  const normalizedQuery = normalizeFoodMatchText(query);
  if (!normalizedQuery) {
    return [...filteredDocuments]
      .sort((left, right) =>
        left.canonicalName.localeCompare(right.canonicalName),
      )
      .slice(0, limit);
  }

  const rankedTextMatches = filteredDocuments
    .map((document) => ({
      document,
      rank: getTextSearchRank(document, normalizedQuery),
    }))
    .filter(
      (
        match,
      ): match is {
        document: FoodSearchDocument;
        rank: number;
      } => match.rank !== null,
    )
    .sort((left, right) => {
      return (
        left.rank - right.rank ||
        left.document.canonicalName.localeCompare(right.document.canonicalName)
      );
    })
    .map((match) => match.document);

  if (normalizedQuery.length < MIN_FOOD_MATCH_CHARS) {
    return rankedTextMatches.slice(0, limit);
  }

  const fuse =
    filteredDocuments.length === context.documents.length
      ? context.fuse
      : new Fuse(filteredDocuments, DEFAULT_FUSE_OPTIONS);
  const fuzzyMatches = fuse
    .search(normalizedQuery, { limit })
    .map((result) => result.item);

  const mergedMatches = new Map<string, FoodSearchDocument>();
  for (const document of [...rankedTextMatches, ...fuzzyMatches]) {
    if (!mergedMatches.has(document.canonicalName)) {
      mergedMatches.set(document.canonicalName, document);
    }
  }

  return Array.from(mergedMatches.values()).slice(0, limit);
}

export function mergeFoodMatchCandidates(
  fuzzyCandidates: ReadonlyArray<FoodMatchCandidate>,
  embeddingCandidates: ReadonlyArray<{
    canonicalName: string;
    embeddingScore: number;
  }>,
  context: FoodMatcherContext,
): FoodMatchCandidate[] {
  const merged = new Map<string, FoodMatchCandidate>();

  for (const candidate of fuzzyCandidates) {
    merged.set(candidate.canonicalName, candidate);
  }

  for (const candidate of embeddingCandidates) {
    const existing = merged.get(candidate.canonicalName);
    if (existing) {
      // If the existing candidate is embedding-only (no fuzzy source),
      // overwrite it with the newer embedding score (last write wins).
      if (existing.resolver === "embedding") {
        merged.set(candidate.canonicalName, {
          ...existing,
          embeddingScore: candidate.embeddingScore,
          combinedConfidence: clampConfidence(candidate.embeddingScore),
        });
        continue;
      }

      const fuzzyScore = existing.fuzzyScore ?? 0;
      const combinedConfidence = clampConfidence(
        fuzzyScore * 0.65 + candidate.embeddingScore * 0.35,
      );
      merged.set(candidate.canonicalName, {
        ...existing,
        resolver: "combined",
        embeddingScore: candidate.embeddingScore,
        combinedConfidence,
      });
      continue;
    }

    const document = context.documentMap.get(candidate.canonicalName);
    if (!document) continue;
    merged.set(
      candidate.canonicalName,
      documentToCandidate(
        document,
        "embedding",
        null,
        candidate.embeddingScore,
        candidate.embeddingScore,
      ),
    );
  }

  return Array.from(merged.values()).sort((a, b) => {
    return (
      b.combinedConfidence - a.combinedConfidence ||
      (b.embeddingScore ?? -1) - (a.embeddingScore ?? -1) ||
      (b.fuzzyScore ?? -1) - (a.fuzzyScore ?? -1) ||
      a.canonicalName.localeCompare(b.canonicalName)
    );
  });
}

export function buildBucketOptions(
  candidates: ReadonlyArray<FoodMatchCandidate>,
  limit = 3,
): FoodMatchBucketOption[] {
  const buckets = new Map<string, FoodMatchBucketOption>();

  for (const candidate of candidates) {
    const existing = buckets.get(candidate.bucketKey);
    if (!existing) {
      buckets.set(candidate.bucketKey, {
        bucketKey: candidate.bucketKey,
        bucketLabel: candidate.bucketLabel,
        canonicalOptions: [candidate.canonicalName],
        bestConfidence: candidate.combinedConfidence,
      });
      continue;
    }

    const canonicalOptions = existing.canonicalOptions.includes(
      candidate.canonicalName,
    )
      ? existing.canonicalOptions
      : [...existing.canonicalOptions, candidate.canonicalName];

    buckets.set(candidate.bucketKey, {
      ...existing,
      canonicalOptions,
      bestConfidence: Math.max(
        existing.bestConfidence,
        candidate.combinedConfidence,
      ),
    });
  }

  return Array.from(buckets.values())
    .sort((a, b) => b.bestConfidence - a.bestConfidence)
    .slice(0, limit);
}

export function routeFoodMatchConfidence(
  phrase: PreprocessedFoodPhrase,
  candidates: ReadonlyArray<FoodMatchCandidate>,
): ConfidenceRoute {
  const topCandidate = candidates[0] ?? null;
  const buckets = buildBucketOptions(candidates);

  if (topCandidate === null) {
    return {
      level: "low",
      topCandidate: null,
      candidates: [],
      buckets,
    };
  }

  const runnerUpConfidence = candidates[1]?.combinedConfidence ?? 0;
  const confidenceGap = topCandidate.combinedConfidence - runnerUpConfidence;
  const tokenCount = phrase.normalizedName.split(" ").filter(Boolean).length;

  if (
    topCandidate.combinedConfidence >= 0.86 &&
    (confidenceGap >= 0.08 ||
      tokenCount <= 2 ||
      topCandidate.resolver === "alias")
  ) {
    return {
      level: "high",
      topCandidate,
      candidates: candidates.slice(0, 3),
      buckets,
    };
  }

  if (topCandidate.combinedConfidence >= 0.56) {
    return {
      level: "medium",
      topCandidate,
      candidates: candidates.slice(0, 3),
      buckets,
    };
  }

  return {
    level: "low",
    topCandidate,
    candidates: candidates.slice(0, 3),
    buckets,
  };
}

export function isStructurallyAmbiguousPhrase(
  phrase: PreprocessedFoodPhrase,
): boolean {
  return (
    phrase.normalizedName.split(" ").filter(Boolean).length >= 5 ||
    /\b(style|mixed|combo|assorted|various|stuffed)\b/i.test(phrase.parsedName)
  );
}

---

## Source File: /Users/peterjamesblizzard/projects/caca_traca/convex/foodParsing.ts

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
  resolvedBy?: "registry" | "llm" | "user" | "expired";
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
    const existingRows = await ctx.runQuery(
      internal.foodParsing.listFoodEmbeddings,
      {},
    );
    const alreadyEmbedded = existingRows.some(
      (row) =>
        row.sourceType === "alias" &&
        row.sourceText === args.aliasText &&
        row.canonicalName === args.canonicalName &&
        row.embeddingSourceHash === sourceHash,
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

  const rows = await ctx.runQuery(internal.foodParsing.getFoodEmbeddingsByIds, {
    ids: matches.map((match) => match._id),
  });
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
): Promise<void> {
  const normalizedAlias = normalizeFoodMatchText(aliasText);
  if (!normalizedAlias) return;

  const existing = await ctx.db
    .query("foodAliases")
    .withIndex("by_userId_normalizedAlias", (q) =>
      q.eq("userId", userId).eq("normalizedAlias", normalizedAlias),
    )
    .unique();

  const timestamp = Date.now();
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
    resolvedItems: v.array(
      v.object({
        userSegment: v.string(),
        parsedName: v.string(),
        canonicalName: v.string(),
        resolvedBy: v.literal("llm"),
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
        resolvedBy: "llm" as const,
        ...(zone !== undefined && { recoveryStage: zone }),
        matchConfidence: 1,
        matchStrategy: "llm" as const,
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
        createdAt: Date.now(),
      });
    }
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Evidence processing
// ─────────────────────────────────────────────────────────────────────────────

export const processEvidence = internalMutation({
  args: { logId: v.id("logs") },
  handler: async (ctx, args) => {
    const log = await ctx.db.get(args.logId);
    if (!log || log.type !== "food") return;

    const data = log.data as FoodLogData;
    if (data.evidenceProcessedAt != null) return;

    const evidenceProcessedAt = Date.now();

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
        createdAt: Date.now(),
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
  },
});

---

