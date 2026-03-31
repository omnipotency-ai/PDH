import { v } from "convex/values";
import {
  buildFoodEvidenceResult,
  type FoodEvidenceLog,
  type HabitLike,
  normalizeAssessmentRecord,
  type TransitCalibration,
  toLegacyFoodStatus,
} from "../shared/foodEvidence";
import {
  getCanonicalFoodProjection,
  resolveCanonicalFoodName,
} from "../shared/foodProjection";
import { mutation, query } from "./_generated/server";
import { requireAuth } from "./lib/auth";
import {
  normalizeIngredientProfileTag,
  normalizeIngredientProfileTags,
} from "./ingredientProfileProjection";

const foodTypeValidator = v.union(
  v.literal("ingredient"),
  v.literal("composite"),
);

function resolveMappedCanonicalName(
  name: string,
  mapping: ReadonlyMap<string, string>,
): string {
  let current = name;
  const seen = new Set<string>();
  while (mapping.has(current)) {
    if (seen.has(current)) {
      throw new Error(`Merge map contains a cycle at "${current}".`);
    }
    seen.add(current);
    const next = mapping.get(current);
    if (next === undefined) break;
    current = next;
  }
  return current;
}

function dedupeStrings(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      out.push(value);
    }
  }
  return out;
}

function normalizeIngredients(
  ingredients: string[],
  rowCanonicalName: string,
  mapping: ReadonlyMap<string, string>,
): string[] {
  const normalized = ingredients
    .map((ingredient) =>
      resolveMappedCanonicalName(resolveCanonicalFoodName(ingredient), mapping),
    )
    .filter((ingredient) => ingredient.length > 0)
    .filter((ingredient) => ingredient !== rowCanonicalName);
  return dedupeStrings(normalized);
}

function firstNonNull<T>(values: Array<T | null | undefined>): T | null {
  for (const value of values) {
    if (value !== null && value !== undefined) return value;
  }
  return null;
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireAuth(ctx);
    const rows = await ctx.db
      .query("foodLibrary")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    // Deduplication: Two concurrent addEntry/updateEntry mutations can race
    // past each other's existence check and both insert, creating duplicate
    // rows for the same (userId, canonicalName). Convex indexes are not
    // unique constraints, so we deduplicate on read: keep only the earliest
    // created row per canonicalName (first entry wins).
    const bestByName = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      const existing = bestByName.get(row.canonicalName);
      if (
        !existing ||
        row.createdAt < existing.createdAt ||
        (row.createdAt === existing.createdAt &&
          row._creationTime < existing._creationTime)
      ) {
        bestByName.set(row.canonicalName, row);
      }
    }
    const deduped = Array.from(bestByName.values());

    // Sort by canonicalName in memory — no ordering index on name alone.
    deduped.sort((a, b) => a.canonicalName.localeCompare(b.canonicalName));

    return deduped.map((row) => ({
      id: row._id,
      userId: row.userId,
      canonicalName: row.canonicalName,
      type: row.type,
      ingredients: row.ingredients,
      createdAt: row.createdAt,
    }));
  },
});

export const addEntry = mutation({
  args: {
    canonicalName: v.string(),
    type: foodTypeValidator,
    ingredients: v.array(v.string()),
    // Transitional: accepted but ignored — server generates createdAt.
    createdAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const normalizedName = resolveCanonicalFoodName(args.canonicalName);
    const now = Date.now();

    // Race condition note: Two concurrent addEntry calls for the same
    // (userId, canonicalName) can both see "no rows" and both insert.
    // Convex indexes are not unique constraints, so duplicates can occur.
    // We collect ALL matching rows, return the earliest (first entry wins),
    // and delete any extras to self-heal duplicates.
    const allMatching = await ctx.db
      .query("foodLibrary")
      .withIndex("by_userId_name", (q) =>
        q.eq("userId", userId).eq("canonicalName", normalizedName),
      )
      .collect();

    if (allMatching.length > 0) {
      // Sort: earliest created first, break ties by creation time.
      const sorted = allMatching
        .slice()
        .sort(
          (a, b) =>
            a.createdAt - b.createdAt || a._creationTime - b._creationTime,
        );
      const keeper = sorted[0];

      // Delete any duplicates that accumulated from prior races.
      for (const duplicate of sorted.slice(1)) {
        await ctx.db.delete(duplicate._id);
      }

      return keeper._id;
    }

    return await ctx.db.insert("foodLibrary", {
      userId,
      canonicalName: normalizedName,
      type: args.type,
      ingredients: args.ingredients,
      createdAt: now,
    });
  },
});

export const updateEntry = mutation({
  args: {
    canonicalName: v.string(),
    type: foodTypeValidator,
    ingredients: v.array(v.string()),
    now: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const normalizedName = resolveCanonicalFoodName(args.canonicalName);
    const now = args.now ?? Date.now();

    // Race condition note: Two concurrent updateEntry calls for the same
    // (userId, canonicalName) can both see "no rows" and both insert.
    // Convex indexes are not unique constraints, so duplicates can occur.
    // We collect ALL matching rows, update the earliest (first entry wins),
    // and delete any extras to self-heal duplicates.
    const allMatching = await ctx.db
      .query("foodLibrary")
      .withIndex("by_userId_name", (q) =>
        q.eq("userId", userId).eq("canonicalName", normalizedName),
      )
      .collect();

    if (allMatching.length === 0) {
      return await ctx.db.insert("foodLibrary", {
        userId,
        canonicalName: normalizedName,
        type: args.type,
        ingredients: args.ingredients,
        createdAt: now,
      });
    }

    // Sort: earliest created first, break ties by creation time.
    const sorted = allMatching
      .slice()
      .sort(
        (a, b) =>
          a.createdAt - b.createdAt || a._creationTime - b._creationTime,
      );
    const keeper = sorted[0];

    await ctx.db.patch(keeper._id, {
      type: args.type,
      ingredients: args.ingredients,
    });

    // Delete any duplicates that accumulated from prior races.
    for (const duplicate of sorted.slice(1)) {
      await ctx.db.delete(duplicate._id);
    }

    return keeper._id;
  },
});

export const addBatch = mutation({
  args: {
    entries: v.array(
      v.object({
        canonicalName: v.string(),
        type: foodTypeValidator,
        ingredients: v.array(v.string()),
        // Transitional: accepted but ignored — server generates createdAt.
        createdAt: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);

    if (args.entries.length > 100) {
      throw new Error("Batch too large: maximum 100 entries per call.");
    }

    const now = Date.now();
    const ids: string[] = [];

    // Race condition note: Concurrent addBatch/addEntry calls for the same
    // (userId, canonicalName) can both see "no rows" and both insert.
    // We collect ALL matching rows per entry, return the earliest (first
    // entry wins), and delete any extras to self-heal duplicates.
    for (const entry of args.entries) {
      const normalizedName = resolveCanonicalFoodName(entry.canonicalName);

      const allMatching = await ctx.db
        .query("foodLibrary")
        .withIndex("by_userId_name", (q) =>
          q.eq("userId", userId).eq("canonicalName", normalizedName),
        )
        .collect();

      if (allMatching.length > 0) {
        // Sort: earliest created first, break ties by creation time.
        const sorted = allMatching
          .slice()
          .sort(
            (a, b) =>
              a.createdAt - b.createdAt || a._creationTime - b._creationTime,
          );
        const keeper = sorted[0];

        // Delete any duplicates that accumulated from prior races.
        for (const duplicate of sorted.slice(1)) {
          await ctx.db.delete(duplicate._id);
        }

        ids.push(keeper._id);
        continue;
      }

      const id = await ctx.db.insert("foodLibrary", {
        userId,
        canonicalName: normalizedName,
        type: entry.type,
        ingredients: entry.ingredients,
        createdAt: now,
      });
      ids.push(id);
    }

    return ids;
  },
});

export const mergeDuplicates = mutation({
  args: {
    merges: v.array(
      v.object({
        source: v.string(),
        target: v.string(),
      }),
    ),
    updateFoodLogs: v.optional(v.boolean()),
    now: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const now = args.now ?? Date.now();

    const normalizedMerges = new Map<string, string>();
    for (const merge of args.merges) {
      const source = resolveCanonicalFoodName(merge.source);
      const target = resolveCanonicalFoodName(merge.target);
      if (!source || !target || source === target) continue;

      const existingTarget = normalizedMerges.get(source);
      if (existingTarget && existingTarget !== target) {
        throw new Error(
          `Conflicting targets for "${source}": "${existingTarget}" vs "${target}".`,
        );
      }
      normalizedMerges.set(source, target);
    }

    const finalMerges = new Map<string, string>();
    for (const [source, firstTarget] of normalizedMerges) {
      const resolvedTarget = resolveMappedCanonicalName(
        firstTarget,
        normalizedMerges,
      );
      if (resolvedTarget === source) {
        throw new Error(`Invalid merge cycle for "${source}".`);
      }
      finalMerges.set(source, resolvedTarget);
    }

    const result = {
      mergesRequested: args.merges.length,
      mergesApplied: finalMerges.size,
      mappings: Array.from(finalMerges.entries()).map(([source, target]) => ({
        source,
        target,
      })),
      foodLibraryEntriesRenamed: 0,
      foodLibraryEntriesMerged: 0,
      foodLibraryIngredientRefsUpdated: 0,
      foodAssessmentsUpdated: 0,
      ingredientExposuresUpdated: 0,
      ingredientOverridesUpdated: 0,
      ingredientOverridesMerged: 0,
      ingredientProfilesUpdated: 0,
      ingredientProfilesMerged: 0,
      foodLogsUpdated: 0,
      foodLogItemsUpdated: 0,
      foodTrialSummariesDeleted: 0,
      foodTrialSummariesRebuilt: 0,
    };

    for (const [source, target] of finalMerges) {
      const assessments = await ctx.db
        .query("foodAssessments")
        .withIndex("by_userId_canonicalName", (q) =>
          q.eq("userId", userId).eq("canonicalName", source),
        )
        .collect();

      for (const row of assessments) {
        await ctx.db.patch(row._id, { canonicalName: target });
        result.foodAssessmentsUpdated += 1;
      }
    }

    for (const [source, target] of finalMerges) {
      const exposures = await ctx.db
        .query("ingredientExposures")
        .withIndex("by_userId_canonicalName", (q) =>
          q.eq("userId", userId).eq("canonicalName", source),
        )
        .collect();

      for (const row of exposures) {
        await ctx.db.patch(row._id, { canonicalName: target });
        result.ingredientExposuresUpdated += 1;
      }
    }

    for (const [source, target] of finalMerges) {
      const overrides = await ctx.db
        .query("ingredientOverrides")
        .withIndex("by_userId_canonicalName", (q) =>
          q.eq("userId", userId).eq("canonicalName", source),
        )
        .collect();

      for (const row of overrides) {
        await ctx.db.patch(row._id, { canonicalName: target });
        result.ingredientOverridesUpdated += 1;
      }
    }

    const overrideRows = await ctx.db
      .query("ingredientOverrides")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    const groupedOverrides = new Map<string, (typeof overrideRows)[number][]>();
    for (const row of overrideRows) {
      const group = groupedOverrides.get(row.canonicalName);
      if (group) {
        group.push(row);
      } else {
        groupedOverrides.set(row.canonicalName, [row]);
      }
    }
    for (const group of groupedOverrides.values()) {
      if (group.length <= 1) continue;
      const sorted = group
        .slice()
        .sort(
          (a, b) =>
            b.updatedAt - a.updatedAt || b._creationTime - a._creationTime,
        );
      const keeper = sorted[0];
      const duplicates = sorted.slice(1);
      const nextNote =
        keeper.note ??
        firstNonNull(
          sorted
            .slice(1)
            .map((row) => (typeof row.note === "string" ? row.note : null)),
        ) ??
        undefined;
      if (nextNote !== keeper.note) {
        await ctx.db.patch(keeper._id, { note: nextNote });
      }
      for (const duplicate of duplicates) {
        await ctx.db.delete(duplicate._id);
        result.ingredientOverridesMerged += 1;
      }
    }

    for (const [source, target] of finalMerges) {
      const profiles = await ctx.db
        .query("ingredientProfiles")
        .withIndex("by_userId_canonicalName", (q) =>
          q.eq("userId", userId).eq("canonicalName", source),
        )
        .collect();

      for (const row of profiles) {
        await ctx.db.patch(row._id, { canonicalName: target });
        result.ingredientProfilesUpdated += 1;
      }
    }

    const profileRows = await ctx.db
      .query("ingredientProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    const groupedProfiles = new Map<string, (typeof profileRows)[number][]>();
    for (const row of profileRows) {
      const group = groupedProfiles.get(row.canonicalName);
      if (group) {
        group.push(row);
      } else {
        groupedProfiles.set(row.canonicalName, [row]);
      }
    }
    for (const [canonicalName, group] of groupedProfiles) {
      if (group.length <= 1) continue;
      const sorted = group
        .slice()
        .sort(
          (a, b) =>
            b.updatedAt - a.updatedAt || b._creationTime - a._creationTime,
        );
      const keeper = sorted[0];
      const duplicates = sorted.slice(1);
      const mergedTags = normalizeIngredientProfileTags(
        sorted.flatMap((row) =>
          row.tags.map((tag) => normalizeIngredientProfileTag(tag)),
        ),
      );
      const mergedNutrition = {
        kcal: firstNonNull(sorted.map((row) => row.nutritionPer100g.kcal)),
        fatG: firstNonNull(sorted.map((row) => row.nutritionPer100g.fatG)),
        saturatedFatG: firstNonNull(
          sorted.map((row) => row.nutritionPer100g.saturatedFatG),
        ),
        carbsG: firstNonNull(sorted.map((row) => row.nutritionPer100g.carbsG)),
        sugarsG: firstNonNull(
          sorted.map((row) => row.nutritionPer100g.sugarsG),
        ),
        fiberG: firstNonNull(sorted.map((row) => row.nutritionPer100g.fiberG)),
        proteinG: firstNonNull(
          sorted.map((row) => row.nutritionPer100g.proteinG),
        ),
        saltG: firstNonNull(sorted.map((row) => row.nutritionPer100g.saltG)),
      };
      const projection = getCanonicalFoodProjection(canonicalName);

      await ctx.db.patch(keeper._id, {
        canonicalName,
        displayName:
          firstNonNull(
            sorted
              .map((row) => row.displayName.trim())
              .filter((value) => value.length > 0),
          ) ?? canonicalName,
        tags: mergedTags,
        foodGroup: projection.foodGroup,
        foodLine: projection.foodLine,
        lowResidue: firstNonNull(sorted.map((row) => row.lowResidue)),
        source: firstNonNull(sorted.map((row) => row.source)),
        externalId: firstNonNull(sorted.map((row) => row.externalId)),
        ingredientsText: firstNonNull(sorted.map((row) => row.ingredientsText)),
        nutritionPer100g: mergedNutrition,
        createdAt: Math.min(...sorted.map((row) => row.createdAt)),
        updatedAt: now,
      });

      for (const duplicate of duplicates) {
        await ctx.db.delete(duplicate._id);
        result.ingredientProfilesMerged += 1;
      }
    }

    for (const [source, target] of finalMerges) {
      const sourceRows = await ctx.db
        .query("foodLibrary")
        .withIndex("by_userId_name", (q) =>
          q.eq("userId", userId).eq("canonicalName", source),
        )
        .collect();

      for (const row of sourceRows) {
        await ctx.db.patch(row._id, { canonicalName: target });
        result.foodLibraryEntriesRenamed += 1;
      }
    }

    let libraryRows = await ctx.db
      .query("foodLibrary")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    for (const row of libraryRows) {
      const normalizedCanonicalName = resolveCanonicalFoodName(
        row.canonicalName,
      );
      const canonicalName = resolveMappedCanonicalName(
        normalizedCanonicalName,
        finalMerges,
      );
      const nextIngredients = normalizeIngredients(
        row.ingredients,
        canonicalName,
        finalMerges,
      );

      const canonicalChanged = canonicalName !== row.canonicalName;
      const ingredientsChanged =
        JSON.stringify(nextIngredients) !== JSON.stringify(row.ingredients);
      if (!canonicalChanged && !ingredientsChanged) continue;

      await ctx.db.patch(row._id, {
        canonicalName,
        ingredients: nextIngredients,
      });

      if (canonicalChanged) {
        result.foodLibraryEntriesRenamed += 1;
      }
      if (ingredientsChanged) {
        result.foodLibraryIngredientRefsUpdated += 1;
      }
    }

    libraryRows = await ctx.db
      .query("foodLibrary")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    const groupedByCanonicalName = new Map<
      string,
      (typeof libraryRows)[number][]
    >();
    for (const row of libraryRows) {
      const key = row.canonicalName;
      const group = groupedByCanonicalName.get(key);
      if (group) {
        group.push(row);
      } else {
        groupedByCanonicalName.set(key, [row]);
      }
    }

    for (const [canonicalName, group] of groupedByCanonicalName) {
      if (group.length <= 1) continue;
      const sorted = group
        .slice()
        .sort(
          (a, b) =>
            a.createdAt - b.createdAt || a._creationTime - b._creationTime,
        );
      const keeper = sorted[0];
      const duplicates = sorted.slice(1);
      const mergedType = sorted.some((row) => row.type === "composite")
        ? "composite"
        : "ingredient";
      const mergedIngredients = normalizeIngredients(
        sorted.flatMap((row) => row.ingredients),
        canonicalName,
        finalMerges,
      );
      const mergedCreatedAt = Math.min(...sorted.map((row) => row.createdAt));

      const needsKeeperPatch =
        keeper.type !== mergedType ||
        keeper.createdAt !== mergedCreatedAt ||
        JSON.stringify(keeper.ingredients) !==
          JSON.stringify(mergedIngredients);

      if (needsKeeperPatch) {
        await ctx.db.patch(keeper._id, {
          type: mergedType,
          ingredients: mergedIngredients,
          createdAt: mergedCreatedAt,
        });
      }

      for (const duplicate of duplicates) {
        await ctx.db.delete(duplicate._id);
        result.foodLibraryEntriesMerged += 1;
      }
    }

    if (args.updateFoodLogs !== false) {
      // Safety cap: 5000 logs to prevent unbounded scan in merge operations.
      const logs = await ctx.db
        .query("logs")
        .withIndex("by_userId_timestamp", (q) => q.eq("userId", userId))
        .take(5000);

      for (const log of logs) {
        if (log.type !== "food") continue;
        const data = log.data as Record<string, unknown>;
        const items = Array.isArray(data.items)
          ? (data.items as Array<Record<string, unknown>>)
          : [];

        let itemChanged = false;
        const nextItems = items.map((item) => {
          const rawCanonicalName =
            typeof item.canonicalName === "string" ? item.canonicalName : null;
          if (!rawCanonicalName) return item;

          const nextCanonicalName = resolveMappedCanonicalName(
            resolveCanonicalFoodName(rawCanonicalName),
            finalMerges,
          );

          if (nextCanonicalName === rawCanonicalName) return item;

          itemChanged = true;
          result.foodLogItemsUpdated += 1;
          return {
            ...item,
            canonicalName: nextCanonicalName,
          };
        });

        if (!itemChanged) continue;

        await ctx.db.patch(log._id, {
          data: {
            ...data,
            items: nextItems,
          } as typeof log.data,
        });
        result.foodLogsUpdated += 1;
      }
    }

    for (const source of finalMerges.keys()) {
      const staleSummaries = await ctx.db
        .query("foodTrialSummary")
        .withIndex("by_userId_canonicalName", (q) =>
          q.eq("userId", userId).eq("canonicalName", source),
        )
        .collect();

      for (const stale of staleSummaries) {
        await ctx.db.delete(stale._id);
        result.foodTrialSummariesDeleted += 1;
      }
    }

    const targetNames = dedupeStrings(Array.from(finalMerges.values()));
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    const allAssessments = await ctx.db
      .query("foodAssessments")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    const logs = await ctx.db
      .query("logs")
      .withIndex("by_userId_timestamp", (q) => q.eq("userId", userId))
      .collect();
    const recomputeAt = Math.max(
      profile?.updatedAt ?? 0,
      ...logs.map((log) => log.timestamp),
      ...allAssessments.map((assessment) => assessment.reportTimestamp),
    );
    const fused = buildFoodEvidenceResult({
      logs: logs.map((log) => ({
        id: String(log._id),
        timestamp: log.timestamp,
        type: log.type,
        data: log.data,
      })) as FoodEvidenceLog[],
      habits: (profile?.habits ?? []) as HabitLike[],
      assessments: allAssessments.map((assessment) =>
        normalizeAssessmentRecord({
          food: assessment.canonicalName || assessment.foodName,
          verdict:
            assessment.verdict === "culprit"
              ? "avoid"
              : assessment.verdict === "next_to_try"
                ? "trial_next"
                : assessment.verdict,
          ...(assessment.confidence && { confidence: assessment.confidence }),
          ...(assessment.causalRole && { causalRole: assessment.causalRole }),
          ...(assessment.changeType && { changeType: assessment.changeType }),
          ...(assessment.modifierSummary && {
            modifierSummary: assessment.modifierSummary,
          }),
          reasoning: assessment.reasoning,
          reportTimestamp: assessment.reportTimestamp,
        }),
      ),
      ...(profile?.transitCalibration && {
        calibration: profile.transitCalibration as TransitCalibration,
      }),
      now: recomputeAt,
    });
    const fusedByName = new Map(
      fused.summaries.map((summary) => [summary.canonicalName, summary]),
    );

    if (profile) {
      await ctx.db.patch(profile._id, {
        transitCalibration: fused.transitCalibration,
        updatedAt: recomputeAt,
      });
    }

    for (const canonicalName of targetNames) {
      const allForFood = await ctx.db
        .query("foodAssessments")
        .withIndex("by_userId_canonicalName", (q) =>
          q.eq("userId", userId).eq("canonicalName", canonicalName),
        )
        .order("desc")
        .collect();

      const existingSummaries = await ctx.db
        .query("foodTrialSummary")
        .withIndex("by_userId_canonicalName", (q) =>
          q.eq("userId", userId).eq("canonicalName", canonicalName),
        )
        .collect();

      if (allForFood.length === 0) {
        for (const row of existingSummaries) {
          await ctx.db.delete(row._id);
          result.foodTrialSummariesDeleted += 1;
        }
        continue;
      }

      const summary = fusedByName.get(canonicalName);
      if (!summary) {
        for (const row of existingSummaries) {
          await ctx.db.delete(row._id);
          result.foodTrialSummariesDeleted += 1;
        }
        continue;
      }

      const latestAiVerdict:
        | "safe"
        | "watch"
        | "avoid"
        | "trial_next"
        | "none" =
        summary.latestAiVerdict === "avoid"
          ? "avoid"
          : summary.latestAiVerdict === "trial_next"
            ? "trial_next"
            : summary.latestAiVerdict;

      const summaryData = {
        userId,
        canonicalName,
        displayName: summary.displayName,
        currentStatus: toLegacyFoodStatus(
          summary.primaryStatus,
          summary.tendency,
        ),
        latestAiVerdict,
        ...(summary.latestConfidence !== undefined && {
          latestConfidence: summary.latestConfidence,
        }),
        totalAssessments: summary.totalAssessments,
        culpritCount: summary.culpritCount,
        safeCount: summary.safeCount,
        nextToTryCount: summary.nextToTryCount,
        firstSeenAt: summary.firstSeenAt,
        lastAssessedAt: summary.lastTrialAt,
        latestReasoning: summary.latestAiReasoning,
        primaryStatus: summary.primaryStatus,
        tendency: summary.tendency,
        confidence: summary.confidence,
        codeScore: summary.codeScore,
        aiScore: summary.aiScore,
        combinedScore: summary.combinedScore,
        recentSuspect: summary.recentSuspect,
        clearedHistory: summary.clearedHistory,
        learnedTransitCenterMinutes: summary.learnedTransitCenterMinutes,
        learnedTransitSpreadMinutes: summary.learnedTransitSpreadMinutes,
        updatedAt: recomputeAt,
      };

      if (existingSummaries.length === 0) {
        await ctx.db.insert("foodTrialSummary", summaryData);
      } else {
        await ctx.db.patch(existingSummaries[0]._id, summaryData);
        for (const duplicate of existingSummaries.slice(1)) {
          await ctx.db.delete(duplicate._id);
          result.foodTrialSummariesDeleted += 1;
        }
      }
      result.foodTrialSummariesRebuilt += 1;
    }

    return result;
  },
});
