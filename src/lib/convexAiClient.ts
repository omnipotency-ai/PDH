/**
 * Type definition for the Convex AI action caller.
 *
 * Hooks pass this caller (bound via `useAction(api.ai.chatCompletion)`) into
 * the AI library functions so they can relay prompts to OpenAI through Convex
 * without needing a browser-side OpenAI client.
 */
import type { AiModelName } from "./aiModels";

export type AllowedAiModel = AiModelName;

export type ConvexAiCaller = (args: {
  model: AllowedAiModel;
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: { type: string };
  featureType?: "drpoo" | "coaching";
}) => Promise<{
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } | null;
}>;
