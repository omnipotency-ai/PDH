"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import { requireAuth } from "./lib/auth";
import {
  classifyOpenAiHttpError,
  getConfiguredOpenAiApiKey,
} from "./lib/openai";

// 5-minute server-side cooldown for background AI calls.
const AI_RATE_LIMIT_MS = 300_000;

// Allowed OpenAI models — constrained to prevent arbitrary model strings.
// Keep in sync with src/lib/aiModels.ts AI_MODEL_OPTIONS + BACKGROUND_MODEL
// and convex/validators.ts allowedModelsValidator.
const allowedModels = v.union(v.literal("gpt-5.4"), v.literal("gpt-5.4-mini"));

/**
 * Generic OpenAI chat completion action.
 *
 * The client builds the full prompt (system + user messages) and sends them here.
 * This action is a thin relay: it authenticates the user, resolves the
 * deployment-level OpenAI key from the Convex environment, makes the call,
 * and returns the result.
 */
export const chatCompletion = action({
  args: {
    model: allowedModels,
    messages: v.array(
      v.object({
        role: v.union(
          v.literal("system"),
          v.literal("user"),
          v.literal("assistant"),
        ),
        content: v.string(),
      }),
    ),
    temperature: v.optional(v.number()),
    maxTokens: v.optional(v.number()),
    responseFormat: v.optional(v.object({ type: v.string() })),
    // Identifies the AI feature making this call so rate limits are enforced
    // separately. Defaults to "drpoo" for backward compatibility.
    featureType: v.optional(v.union(v.literal("drpoo"), v.literal("coaching"))),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    content: string;
    usage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    } | null;
  }> => {
    const { userId } = await requireAuth(ctx);

    // Server-side rate limiting: enforce a per-user cooldown for background AI
    // calls only. Dr. Poo report cadence is controlled client-side using the
    // timestamps of the bowel events being analyzed, so backfilled logs and
    // manual full-report overrides are not blocked by call-time cooldowns.
    const featureType = args.featureType ?? "drpoo";
    const now = Date.now();

    if (featureType === "coaching") {
      const rateLimits = await ctx.runQuery(internal.profiles.getAiRateLimits, {
        userId,
      });
      const lastCallAt = rateLimits.lastCoachingCallAt;
      if (lastCallAt !== null && now - lastCallAt < AI_RATE_LIMIT_MS) {
        const waitSeconds = Math.ceil(
          (AI_RATE_LIMIT_MS - (now - lastCallAt)) / 1000,
        );
        throw new Error(
          `[NON_RETRYABLE] [RATE_LIMITED] AI call rate limited — please wait ${waitSeconds}s before calling ${featureType} again.`,
        );
      }
    }

    const apiKey = getConfiguredOpenAiApiKey();
    if (apiKey === null) {
      throw new Error(
        "[NON_RETRYABLE] [CONFIG_ERROR] AI is not configured for this deployment.",
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

      if (featureType === "coaching") {
        // Record successful background-call time so the next background task
        // can be rate-checked.
        await ctx.runMutation(internal.profiles.updateAiRateLimit, {
          userId,
          featureType,
          calledAt: now,
        });
      }

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

      const errorCode =
        status !== undefined
          ? classifyOpenAiHttpError(status)
          : "NETWORK_ERROR";
      const message =
        err instanceof Error ? err.message : "Unknown OpenAI error";

      // Non-retryable errors: bad key, forbidden
      const isNonRetryable = errorCode === "KEY_ERROR";
      const prefix = isNonRetryable ? "[NON_RETRYABLE] " : "";

      throw new Error(`${prefix}[${errorCode}] OpenAI API error: ${message}`);
    }
  },
});
