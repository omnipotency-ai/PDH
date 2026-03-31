import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  aiInsightValidator,
  aiPreferencesValidator,
  aiRequestValidator,
  aiResponseValidator,
  foodAssessmentCausalRoleValidator,
  foodAssessmentChangeTypeValidator,
  foodGroupValidator,
  foodLineValidator,
  foodPersonalisationValidator,
  foodPrimaryStatusValidator,
  foodTendencyValidator,
  healthProfileValidator,
  logDataValidator,
  sleepGoalValidator,
  storedFluidPresetsValidator,
  storedProfileHabitsValidator,
  transitCalibrationValidator,
} from "./validators";

export default defineSchema({
  logs: defineTable({
    userId: v.string(),
    timestamp: v.number(),
    type: v.union(
      v.literal("food"),
      v.literal("fluid"),
      v.literal("habit"),
      v.literal("activity"),
      v.literal("digestion"),
      v.literal("weight"),
    ),
    data: logDataValidator,
  })
    .index("by_userId", ["userId"])
    .index("by_userId_timestamp", ["userId", "timestamp"]),

  foodAliases: defineTable({
    aliasText: v.string(),
    normalizedAlias: v.string(),
    canonicalName: v.string(),
    userId: v.union(v.string(), v.null()),
    source: v.union(v.literal("user"), v.literal("bucket"), v.literal("seed")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_normalizedAlias", ["normalizedAlias"])
    .index("by_userId_normalizedAlias", ["userId", "normalizedAlias"])
    .index("by_canonicalName", ["canonicalName"]),

  foodEmbeddings: defineTable({
    canonicalName: v.string(),
    // The raw text that was embedded. For registry entries this is the
    // structured embedding text; for aliases it is the user's original phrase.
    sourceText: v.optional(v.string()),
    // Whether this row represents a registry canonical or a learned user alias.
    // Optional for backward compatibility with existing rows (treated as "registry").
    sourceType: v.optional(v.union(v.literal("registry"), v.literal("alias"))),
    zone: v.union(v.literal(1), v.literal(2), v.literal(3)),
    group: foodGroupValidator,
    line: foodLineValidator,
    bucketKey: v.string(),
    bucketLabel: v.string(),
    embedding: v.array(v.float64()),
    embeddingSourceHash: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_canonicalName", ["canonicalName"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536,
      filterFields: ["zone", "group", "line", "bucketKey"],
    }),

  ingredientExposures: defineTable({
    userId: v.string(),
    // Source food log row and item position within that log
    logId: v.id("logs"),
    itemIndex: v.number(),
    logTimestamp: v.number(),
    ingredientName: v.string(),
    canonicalName: v.string(),
    quantity: v.union(v.number(), v.null()),
    unit: v.union(v.string(), v.null()),
    preparation: v.optional(v.string()),
    recoveryStage: v.optional(
      v.union(v.literal(1), v.literal(2), v.literal(3)),
    ),
    spiceLevel: v.optional(
      v.union(v.literal("plain"), v.literal("mild"), v.literal("spicy")),
    ),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_logId", ["userId", "logId"])
    .index("by_userId_canonicalName", ["userId", "canonicalName"])
    .index("by_userId_timestamp", ["userId", "logTimestamp"]),

  ingredientOverrides: defineTable({
    userId: v.string(),
    canonicalName: v.string(),
    status: v.union(v.literal("safe"), v.literal("watch"), v.literal("avoid")),
    note: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_canonicalName", ["userId", "canonicalName"])
    .index("by_userId_status", ["userId", "status"]),

  ingredientProfiles: defineTable({
    userId: v.string(),
    canonicalName: v.string(),
    displayName: v.string(),
    tags: v.array(v.string()),
    foodGroup: v.union(foodGroupValidator, v.null()),
    foodLine: v.union(foodLineValidator, v.null()),
    lowResidue: v.union(v.boolean(), v.null()),
    source: v.union(v.literal("manual"), v.literal("openfoodfacts"), v.null()),
    externalId: v.union(v.string(), v.null()),
    ingredientsText: v.union(v.string(), v.null()),
    nutritionPer100g: v.object({
      kcal: v.union(v.number(), v.null()),
      fatG: v.union(v.number(), v.null()),
      saturatedFatG: v.union(v.number(), v.null()),
      carbsG: v.union(v.number(), v.null()),
      sugarsG: v.union(v.number(), v.null()),
      fiberG: v.union(v.number(), v.null()),
      proteinG: v.union(v.number(), v.null()),
      saltG: v.union(v.number(), v.null()),
    }),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_canonicalName", ["userId", "canonicalName"]),

  aiAnalyses: defineTable({
    userId: v.string(),
    timestamp: v.number(),
    // Deprecated: request/response moved to aiAnalysisPayloads table
    // to reduce reactive query bandwidth. Kept optional for backward
    // compatibility with existing documents until migration runs.
    request: v.optional(aiRequestValidator),
    response: v.optional(aiResponseValidator),
    insight: aiInsightValidator,
    model: v.string(),
    durationMs: v.number(),
    inputLogCount: v.number(),
    error: v.optional(v.string()),
    starred: v.optional(v.boolean()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_timestamp", ["userId", "timestamp"]),

  // Stores the heavy LLM request/response payloads separately from
  // aiAnalyses metadata. This prevents reactive subscriptions on
  // aiAnalyses from re-reading ~50-100KB payloads per document on
  // every tick (was costing 3.29 GB/day in bandwidth).
  aiAnalysisPayloads: defineTable({
    userId: v.string(),
    aiAnalysisId: v.id("aiAnalyses"),
    request: aiRequestValidator,
    response: aiResponseValidator,
  })
    .index("by_userId", ["userId"])
    .index("by_aiAnalysisId", ["aiAnalysisId"]),

  conversations: defineTable({
    userId: v.string(),
    // Links this message to the report it's associated with.
    // For "user" messages: the report that was visible when the user typed the reply.
    // For "assistant" messages: the report that was generated.
    aiAnalysisId: v.optional(v.id("aiAnalyses")),
    timestamp: v.number(),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    // Prompt version that produced this message — changing personality creates a new version
    promptVersion: v.optional(v.number()),
  })
    .index("by_aiAnalysisId", ["aiAnalysisId"])
    .index("by_userId", ["userId"])
    .index("by_userId_timestamp", ["userId", "timestamp"])
    .searchIndex("search_content", {
      searchField: "content",
      filterFields: ["userId"],
    }),

  foodAssessments: defineTable({
    userId: v.string(),
    // Link back to the source report
    aiAnalysisId: v.id("aiAnalyses"),
    // When the report was generated
    reportTimestamp: v.number(),

    // The food being assessed
    foodName: v.string(),
    // Normalized/canonical version (lowercase, trimmed) for dedup queries
    canonicalName: v.string(),

    // What Dr. Poo said about it
    verdict: v.union(
      v.literal("culprit"),
      v.literal("safe"),
      v.literal("watch"),
      v.literal("next_to_try"),
      v.literal("avoid"),
      v.literal("trial_next"),
    ),
    // Only for culprits
    confidence: v.optional(
      v.union(v.literal("high"), v.literal("medium"), v.literal("low")),
    ),
    causalRole: v.optional(foodAssessmentCausalRoleValidator),
    changeType: v.optional(foodAssessmentChangeTypeValidator),
    modifierSummary: v.optional(v.string()),
    reasoning: v.string(),
  })
    .index("by_aiAnalysisId", ["aiAnalysisId"])
    .index("by_userId", ["userId"])
    .index("by_userId_aiAnalysisId", ["userId", "aiAnalysisId"])
    .index("by_userId_canonicalName", ["userId", "canonicalName"])
    .index("by_userId_verdict", ["userId", "verdict"])
    .index("by_userId_timestamp", ["userId", "reportTimestamp"]),

  foodTrialSummary: defineTable({
    userId: v.string(),
    canonicalName: v.string(),
    displayName: v.string(),
    currentStatus: v.union(
      v.literal("testing"),
      v.literal("safe"),
      v.literal("safe-loose"),
      v.literal("safe-hard"),
      v.literal("watch"),
      v.literal("risky"),
      v.literal("culprit"),
      v.literal("cleared"),
    ),
    primaryStatus: v.optional(foodPrimaryStatusValidator),
    tendency: v.optional(foodTendencyValidator),
    confidence: v.optional(v.number()),
    codeScore: v.optional(v.number()),
    aiScore: v.optional(v.number()),
    combinedScore: v.optional(v.number()),
    recentSuspect: v.optional(v.boolean()),
    clearedHistory: v.optional(v.boolean()),
    learnedTransitCenterMinutes: v.optional(v.number()),
    learnedTransitSpreadMinutes: v.optional(v.number()),
    latestAiVerdict: v.union(
      v.literal("culprit"),
      v.literal("safe"),
      v.literal("next_to_try"),
      v.literal("watch"),
      v.literal("avoid"),
      v.literal("trial_next"),
      v.literal("none"),
    ),
    latestConfidence: v.optional(
      v.union(v.literal("high"), v.literal("medium"), v.literal("low")),
    ),
    totalAssessments: v.number(),
    culpritCount: v.number(),
    safeCount: v.number(),
    nextToTryCount: v.number(),
    firstSeenAt: v.number(),
    lastAssessedAt: v.number(),
    latestReasoning: v.string(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_canonicalName", ["userId", "canonicalName"])
    .index("by_userId_status", ["userId", "currentStatus"])
    .index("by_userId_updatedAt", ["userId", "updatedAt"]),

  weeklyDigest: defineTable({
    userId: v.string(),
    weekStart: v.string(),
    weekStartTimestamp: v.number(),
    totalBowelEvents: v.number(),
    avgBristolScore: v.optional(v.number()),
    bristolDistribution: v.object({
      bristol1: v.number(),
      bristol2: v.number(),
      bristol3: v.number(),
      bristol4: v.number(),
      bristol5: v.number(),
      bristol6: v.number(),
      bristol7: v.number(),
    }),
    accidentCount: v.number(),
    totalFoodLogs: v.number(),
    uniqueFoodsEaten: v.number(),
    newFoodsTried: v.number(),
    totalReports: v.number(),
    foodsCleared: v.number(),
    foodsFlagged: v.number(),
    topCulprits: v.array(v.string()),
    topSafe: v.array(v.string()),
    totalHabitLogs: v.optional(v.number()),
    totalFluidMl: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_weekStart", ["userId", "weekStartTimestamp"]),

  weeklySummaries: defineTable({
    userId: v.string(),
    // Sunday 18:00 start of the week being summarised
    weekStartTimestamp: v.number(),
    // Following Sunday 17:59:59 end of the week
    weekEndTimestamp: v.number(),
    weeklySummary: v.string(),
    keyFoods: v.object({
      safe: v.array(v.string()),
      flagged: v.array(v.string()),
      toTryNext: v.array(v.string()),
    }),
    carryForwardNotes: v.array(v.string()),
    model: v.string(),
    durationMs: v.number(),
    generatedAt: v.number(),
    // Prompt version that produced this summary — changing personality creates a new version
    promptVersion: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_weekStart", ["userId", "weekStartTimestamp"]),

  profiles: defineTable({
    userId: v.string(),
    unitSystem: v.union(
      v.literal("metric"),
      v.literal("imperial_us"),
      v.literal("imperial_uk"),
    ),
    habits: storedProfileHabitsValidator,
    fluidPresets: v.optional(storedFluidPresetsValidator),
    sleepGoal: v.optional(sleepGoalValidator),
    healthProfile: v.optional(healthProfileValidator),
    aiPreferences: v.optional(aiPreferencesValidator),
    foodPersonalisation: v.optional(foodPersonalisationValidator),
    transitCalibration: v.optional(transitCalibrationValidator),
    // Set of all canonical food names the user has ever logged.
    // Used by weeklyDigest to determine "new foods" without scanning
    // all historical logs. Populated by writeProcessedItems, resolveItem,
    // and updateWeeklyDigestImpl; backfilled by backfillKnownFoodsWorker.
    knownFoods: v.optional(v.array(v.string())),
    // Encrypted BYOK OpenAI API key. Stored server-side so Convex actions can
    // read it without the client passing it each time.
    encryptedApiKey: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),

  foodLibrary: defineTable({
    userId: v.string(),
    canonicalName: v.string(),
    type: v.union(v.literal("ingredient"), v.literal("composite")),
    ingredients: v.array(v.string()),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_name", ["userId", "canonicalName"]),

  foodRequests: defineTable({
    userId: v.string(),
    foodName: v.string(),
    rawInput: v.optional(v.string()),
    note: v.optional(v.string()),
    logId: v.optional(v.string()),
    itemIndex: v.optional(v.number()),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
    ),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_status", ["status"]),

  // waitlistEntries is retained for data preservation (existing user signups)
  // and is NOT an active feature. Do not add new writes to this table.
  waitlistEntries: defineTable({
    name: v.string(),
    email: v.string(),
    surgeryType: v.optional(v.string()),
    recoveryStage: v.optional(v.string()),
    gdprConsent: v.boolean(),
    subscribedAt: v.number(),
    unsubscribedAt: v.optional(v.number()),
  }).index("by_email", ["email"]),
});
