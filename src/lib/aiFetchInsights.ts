import {
  DEFAULT_INSIGHT_MODEL,
  getValidInsightModel,
  INSIGHT_MODEL_OPTIONS,
} from "@/lib/aiModels";
import { checkRateLimit } from "@/lib/aiRateLimiter";
import type { AllowedAiModel, ConvexAiCaller } from "@/lib/convexAiClient";
import { formatTime, getDaysPostOp } from "@/lib/aiUtils";
import { debugWarn } from "@/lib/debugLog";
import { getErrorMessage } from "@/lib/errors";
import {
  INPUT_SAFETY_LIMITS,
  sanitizeUnknownStringsDeep,
} from "@/lib/inputSafety";
import {
  MAX_CONVERSATION_MESSAGES,
  buildDeltaSignals,
  buildFoodContext,
  buildPatientSnapshot,
  buildRecentEvents,
  buildSystemPrompt,
  buildUserMessage,
  truncateForStorage,
} from "@/lib/aiPrompts";
import type {
  FoodTrialSummaryInput,
  PreviousReport,
  PreviousWeeklySummary,
  SuggestionHistoryEntry,
  WeeklyContext,
} from "@/lib/aiPrompts";
import type { BaselineAverages } from "@/types/domain";
import {
  enforceNovelEducationalInsight,
  isRecord,
  parseAiInsight,
  toStringArray,
} from "@/lib/aiParsing";
import type {
  AiNutritionistInsight,
  AiPreferences,
  DrPooReply,
  HealthProfile,
  LogEntry,
} from "@/types/domain";
import { DEFAULT_AI_PREFERENCES } from "@/types/domain";

export type { AiNutritionistInsight };
export type {
  FoodTrialSummaryInput,
  PreviousReport,
  PreviousWeeklySummary,
  SuggestionHistoryEntry,
  WeeklyContext,
};

// ─── Types defined here (fetch-layer concerns) ────────────────────────────────

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface EnhancedAiContext {
  foodTrials?: FoodTrialSummaryInput[];
  conversationHistory?: ConversationMessage[];
  weeklyContext?: WeeklyContext[];
  previousWeeklySummary?: PreviousWeeklySummary;
  recentSuggestions?: Array<{
    text: string;
    textNormalized: string;
    reportTimestamp: number;
  }>;
  baselineAverages?: BaselineAverages;
}

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

/** Estimated token count above which a warning is logged */
export const TOKEN_WARNING_THRESHOLD = 50_000;

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

export interface FetchAiInsightsOptions {
  /** When true, send only patient snapshot + conversation history (no full logs/trials/digests). */
  lightweight?: boolean;
}

// ─── Suggestion grouping ──────────────────────────────────────────────────────

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

// ─── fetchAiInsights ──────────────────────────────────────────────────────────

export async function fetchAiInsights(
  callAi: ConvexAiCaller,
  logs: LogEntry[],
  previousReports: PreviousReport[],
  patientMessages: DrPooReply[],
  healthProfile: HealthProfile,
  enhancedContext?: EnhancedAiContext,
  aiPreferences?: AiPreferences,
  options?: FetchAiInsightsOptions,
): Promise<AiAnalysisResult> {
  checkRateLimit();
  const nowMs = Date.now();
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
    const currentTime = formatTime(nowMs);

    const daysPostOp = getDaysPostOp(safeHealthProfile.surgeryDate, nowMs);
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
      content: JSON.stringify(lightweightPayload),
    });

    const estimatedTokens = messages.reduce((sum, m) => {
      const content =
        typeof m.content === "string" ? m.content : JSON.stringify(m.content);
      return sum + Math.ceil(content.length / 4);
    }, 0);

    if (estimatedTokens > TOKEN_WARNING_THRESHOLD) {
      debugWarn(
        "Dr. Poo",
        `High token estimate (lightweight): ~${estimatedTokens} tokens.`,
      );
    }

    const startedAt = performance.now();
    let rawContent: string;
    try {
      const result = await callAi({
        model: validatedModel,
        messages,
        responseFormat: { type: "json_object" },
        featureType: "drpoo",
      });
      rawContent = result.content;
    } catch (error) {
      const message = getErrorMessage(error);
      if (
        message.includes("401") ||
        message.includes("Unauthorized") ||
        message.includes("auth")
      ) {
        throw new Error("AI nutritionist request failed. Check your API key.");
      }
      if (message.includes("429") || message.includes("rate limit")) {
        throw new Error(
          "AI nutritionist request failed. Rate limit reached — please wait a moment and try again.",
        );
      }
      throw new Error(`AI nutritionist request failed: ${message}`);
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
      throw new Error(
        "AI nutritionist returned an unexpected response structure.",
      );
    }

    if (safePatientMessages.length === 0) {
      insight.directResponseToUser = null;
    }

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

  const recentEvents = buildRecentEvents(safeLogs, safeHealthProfile);

  const inputLogCount =
    recentEvents.foodLogs.length +
    recentEvents.bowelEvents.length +
    recentEvents.habitLogs.length +
    recentEvents.fluidLogs.length +
    recentEvents.activityLogs.length;

  const foodTrials = safeEnhancedContext?.foodTrials ?? [];
  const weeklyDigests = safeEnhancedContext?.weeklyContext ?? [];
  const conversationHistory = safeEnhancedContext?.conversationHistory;

  const patientSnapshot = buildPatientSnapshot(
    safeHealthProfile,
    foodTrials,
    weeklyDigests,
    nowMs,
  );
  const deltaSignals = buildDeltaSignals(safeLogs, foodTrials);
  const foodContextObj = buildFoodContext(
    foodTrials,
    safeLogs,
    safeHealthProfile,
  );

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

  const hasPreviousResponse = previousReports.length > 0;

  const suggestionHistory = groupSuggestions(
    safeEnhancedContext?.recentSuggestions ?? [],
  );

  const weeklyContext: WeeklyContext[] = weeklyDigests.map((wd) => ({
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
      suggestionHistory,
      weeklyContext,
      ...(safeEnhancedContext?.previousWeeklySummary !== undefined && {
        previousWeeklySummary: safeEnhancedContext.previousWeeklySummary,
      }),
      ...(safeEnhancedContext?.baselineAverages !== undefined && {
        baselineAverages: safeEnhancedContext.baselineAverages,
      }),
    }),
  });

  const estimatedTokens = messages.reduce((sum, m) => {
    const content =
      typeof m.content === "string" ? m.content : JSON.stringify(m.content);
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
      model: validatedModel,
      messages,
      responseFormat: { type: "json_object" },
      featureType: "drpoo",
    });
    rawContent = result.content;
  } catch (error) {
    const message = getErrorMessage(error);
    if (
      message.includes("401") ||
      message.includes("Unauthorized") ||
      message.includes("auth")
    ) {
      throw new Error("AI nutritionist request failed. Check your API key.");
    }
    if (message.includes("429") || message.includes("rate limit")) {
      throw new Error(
        "AI nutritionist request failed. Rate limit reached — please wait a moment and try again.",
      );
    }
    throw new Error(`AI nutritionist request failed: ${message}`);
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
    throw new Error(
      "AI nutritionist returned an unexpected response structure.",
    );
  }

  // Belt-and-suspenders: if no patient messages were pending, force directResponseToUser to null.
  if (safePatientMessages.length === 0) {
    insight.directResponseToUser = null;
  }

  const enrichedInsight = enforceNovelEducationalInsight(
    insight,
    previousReports,
  );

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

// ─── Weekly Summary ───────────────────────────────────────────────────────────

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
  input: WeeklySummaryInput,
  model: AllowedAiModel = DEFAULT_INSIGHT_MODEL as AllowedAiModel,
): Promise<{
  result: WeeklySummaryResult;
  rawResponse: string;
  durationMs: number;
}> {
  checkRateLimit();
  const legacyModelAliases = new Set([
    "gpt-5-mini",
    "gpt-5.2",
    "gpt-4o-mini",
    "gpt-4o",
    "gpt-4.1-nano",
    "gpt-4.1-mini",
  ]);
  if (
    typeof model === "string" &&
    !INSIGHT_MODEL_OPTIONS.includes(model as (typeof INSIGHT_MODEL_OPTIONS)[number]) &&
    !legacyModelAliases.has(model)
  ) {
    throw new Error(`Unsupported weekly summary model: ${model}`);
  }
  const validatedModel = getValidInsightModel(model);

  const sanitized = sanitizeUnknownStringsDeep(input, {
    maxStringLength: INPUT_SAFETY_LIMITS.aiPayloadString,
    path: "ai.weeklySummaryInput",
  });

  // Basic runtime shape validation before the cast — sanitizeUnknownStringsDeep
  // returns `unknown`, so verify the expected top-level keys are present.
  if (
    typeof sanitized !== "object" ||
    sanitized === null ||
    !("weekOf" in sanitized) ||
    !("conversationMessages" in sanitized) ||
    !("suggestions" in sanitized) ||
    !("bowelNotes" in sanitized)
  ) {
    throw new Error(
      "Weekly summary input failed shape validation after sanitization — expected keys missing.",
    );
  }

  const safeInput = sanitized as WeeklySummaryInput;

  const messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }> = [
    { role: "system", content: WEEKLY_SUMMARY_SYSTEM_PROMPT },
    { role: "user", content: JSON.stringify(safeInput) },
  ];

  let rawContent: string;
  let durationMs: number;
  const startedAt = performance.now();
  try {
    const result = await callAi({
      model: validatedModel,
      messages,
      responseFormat: { type: "json_object" },
      featureType: "drpoo",
    });
    rawContent = result.content;
    durationMs = Math.round(performance.now() - startedAt);
  } catch (error) {
    const message = getErrorMessage(error);
    if (
      message.includes("401") ||
      message.includes("Unauthorized") ||
      message.includes("auth")
    ) {
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
      typeof parsed.weeklySummary === "string"
        ? parsed.weeklySummary
        : "No summary available.",
    keyFoods: {
      safe: toStringArray(keyFoods?.safe),
      flagged: toStringArray(keyFoods?.flagged),
      toTryNext: toStringArray(keyFoods?.toTryNext),
    },
    carryForwardNotes: toStringArray(parsed.carryForwardNotes),
  };

  return { result, rawResponse: rawContent, durationMs };
}
