/**
 * Type definition for the Convex AI action caller.
 *
 * Hooks pass this caller (bound via `useAction(api.ai.chatCompletion)`) into
 * the AI library functions so they can relay prompts to OpenAI through Convex
 * without needing a browser-side OpenAI client.
 */
export type AllowedAiModel = "gpt-5.4" | "gpt-5-mini" | "gpt-5.2";

export type ConvexAiCaller = (args: {
  apiKey?: string;
  model: AllowedAiModel;
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: { type: string };
}) => Promise<{
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } | null;
}>;
