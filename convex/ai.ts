"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import { requireAuth } from "./lib/auth";

// Allowed OpenAI models — constrained to prevent arbitrary model strings.
// Keep in sync with src/lib/aiModels.ts INSIGHT_MODEL_OPTIONS + BACKGROUND_MODEL
// and convex/validators.ts allowedModelsValidator.
const allowedModels = v.union(
  v.literal("gpt-5.4"),
  v.literal("gpt-5-mini"),
);

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
 * (server-stored preferred, client-provided as fallback), makes the call, and
 * returns the result.
 */
export const chatCompletion = action({
  args: {
    // Client-supplied key is optional — server-stored key is preferred.
    // The client key exists as a fallback for users who haven't saved their key
    // server-side yet (legacy BYOK flow via IndexedDB).
    apiKey: v.optional(v.string()),
    model: allowedModels,
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
  handler: async (
    ctx,
    args,
  ): Promise<{
    content: string;
    usage: { promptTokens: number; completionTokens: number; totalTokens: number } | null;
  }> => {
    const { userId } = await requireAuth(ctx);

    // Resolve API key: prefer server-stored key, fall back to client-provided.
    // Server key is authoritative — it was validated and stored by the user via
    // the settings UI. Client key is a legacy fallback for the IndexedDB BYOK flow.
    let apiKey: string | undefined;
    const profileKey = await ctx.runQuery(internal.profiles.getServerApiKey, {
      userId,
    });
    if (profileKey !== null) {
      apiKey = profileKey;
    } else if (args.apiKey) {
      apiKey = args.apiKey;
    }

    if (apiKey === undefined) {
      throw new Error(
        "[NON_RETRYABLE] [KEY_ERROR] No OpenAI API key available. Please add your key in Settings.",
      );
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
