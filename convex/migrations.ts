import type { Infer } from "convex/values";
import { v } from "convex/values";
import { resolveCanonicalFoodName } from "../shared/foodCanonicalName";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import type {
  aiInsightValidator,
  aiRequestValidator,
  aiResponseValidator,
} from "./validators";

type LogDoc = Doc<"logs">;
type ProfileDoc = Doc<"profiles">;

type HabitLookup = {
  byId: Map<string, { id: string; name: string; habitType: string }>;
  byName: Map<string, { id: string; name: string; habitType: string }>;
};

type FixCounts = {
  removedFluidType: number;
  mappedDigestiveSizeTag: number;
  removedDigestiveSizeTag: number;
  filledHabitId: number;
  filledHabitType: number;
  normalizedHabitName: number;
  droppedActivityLegacyFields: number;
};

function emptyFixCounts(): FixCounts {
  return {
    removedFluidType: 0,
    mappedDigestiveSizeTag: 0,
    removedDigestiveSizeTag: 0,
    filledHabitId: 0,
    filledHabitType: 0,
    normalizedHabitName: 0,
    droppedActivityLegacyFields: 0,
  };
}

function mergeFixCounts(into: FixCounts, add: FixCounts) {
  into.removedFluidType += add.removedFluidType;
  into.mappedDigestiveSizeTag += add.mappedDigestiveSizeTag;
  into.removedDigestiveSizeTag += add.removedDigestiveSizeTag;
  into.filledHabitId += add.filledHabitId;
  into.filledHabitType += add.filledHabitType;
  into.normalizedHabitName += add.normalizedHabitName;
  into.droppedActivityLegacyFields += add.droppedActivityLegacyFields;
}

function normalizeKey(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug || "custom";
}

function inferHabitType(value: string): string {
  const key = normalizeKey(value).replace(/\s+/g, "_");
  if (/sleep|nap/.test(key)) return "sleep";
  if (/walk|movement|steps|run|breathe|stretch|yoga/.test(key))
    return "activity";
  if (/water|hydrat|tea|coffee|electrolyte|juice/.test(key)) return "fluid";
  if (/cig|smok|nicotine|alcohol|beer|wine|spirit|sweet|candy|drug/.test(key))
    return "destructive";
  if (/med|pill|tablet|medicine|dressing|wound/.test(key)) return "checkbox";
  if (/weight|weigh/.test(key)) return "weight";
  return "count";
}

function normalizeHabitType(
  value: string | undefined,
  fallbackName: string,
): string {
  const raw = normalizeKey(value);
  if (!raw) return inferHabitType(fallbackName);
  switch (raw) {
    case "sleep":
    case "count":
    case "activity":
    case "fluid":
    case "destructive":
    case "checkbox":
    case "weight":
      return raw;
    case "cigarettes":
    case "rec_drugs":
    case "confectionery":
    case "alcohol":
    case "sweets":
      return "destructive";
    case "movement":
      return "activity";
    case "hydration":
      return "fluid";
    case "medication":
      return "checkbox";
    case "hygiene":
    case "wellness":
    case "recovery":
    case "custom":
      return "count";
    default:
      return inferHabitType(fallbackName);
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function asNullableNumber(value: unknown): number | null {
  if (value === null) return null;
  return asNumber(value) ?? null;
}

function asNullableString(value: unknown): string | null {
  if (value === null) return null;
  return typeof value === "string" ? value : null;
}

function buildHabitLookup(profile: ProfileDoc | null): HabitLookup {
  const byId = new Map<
    string,
    { id: string; name: string; habitType: string }
  >();
  const byName = new Map<
    string,
    { id: string; name: string; habitType: string }
  >();

  for (const rawHabit of profile?.habits ?? []) {
    if (!rawHabit || typeof rawHabit !== "object") continue;
    const habit = rawHabit as Record<string, unknown>;
    const id = asTrimmedString(habit.id);
    const name = asTrimmedString(habit.name);
    const habitType = name
      ? normalizeHabitType(asTrimmedString(habit.habitType), name)
      : undefined;
    if (!id || !name || !habitType) continue;

    const entry = {
      id,
      name,
      habitType,
    };
    byId.set(id, entry);
    const key = normalizeKey(name);
    if (key && !byName.has(key)) {
      byName.set(key, entry);
    }
  }

  return { byId, byName };
}

function normalizeFoodData(data: Record<string, unknown>) {
  const nextItems = Array.isArray(data.items)
    ? data.items.map((item) => {
        const row = (item ?? {}) as Record<string, unknown>;
        const next: {
          name: string;
          quantity: number | null;
          unit: string | null;
          canonicalName?: string;
          preparation?: string;
          recoveryStage?: 1 | 2 | 3;
          spiceLevel?: "plain" | "mild" | "spicy";
        } = {
          name: asTrimmedString(row.name) ?? "Food",
          quantity: asNullableNumber(row.quantity),
          unit: asNullableString(row.unit),
        };
        const canonicalName = asTrimmedString(row.canonicalName);
        if (canonicalName) {
          next.canonicalName = canonicalName;
        }
        const preparation = asTrimmedString(row.preparation);
        if (preparation) {
          next.preparation = preparation;
        }
        if (
          row.recoveryStage === 1 ||
          row.recoveryStage === 2 ||
          row.recoveryStage === 3
        ) {
          next.recoveryStage = row.recoveryStage;
        }
        if (
          row.spiceLevel === "plain" ||
          row.spiceLevel === "mild" ||
          row.spiceLevel === "spicy"
        ) {
          next.spiceLevel = row.spiceLevel;
        }
        return next;
      })
    : [];

  return { items: nextItems };
}

function normalizeFluidData(data: Record<string, unknown>, fixes: FixCounts) {
  const items = Array.isArray(data.items) ? data.items : [];
  const nextItems = items
    .map((item) => {
      const row = (item ?? {}) as Record<string, unknown>;
      const name = asTrimmedString(row.name);
      const quantity = asNumber(row.quantity);
      const unit = asTrimmedString(row.unit);
      if (!name || quantity === undefined || !unit) return null;
      return { name, quantity, unit };
    })
    .filter(
      (item): item is { name: string; quantity: number; unit: string } =>
        item !== null,
    );

  if (nextItems.length === 0) {
    const fallbackName =
      asTrimmedString(data.fluidType) ?? asTrimmedString(data.name) ?? "Fluid";
    nextItems.push({
      name: fallbackName,
      quantity: asNumber(data.quantity) ?? 0,
      unit: asTrimmedString(data.unit) ?? "ml",
    });
  }

  if (data.fluidType !== undefined) {
    fixes.removedFluidType += 1;
  }

  return { items: nextItems };
}

function normalizeDigestionData(
  data: Record<string, unknown>,
  fixes: FixCounts,
) {
  const next: {
    bristolCode: number;
    urgencyTag?: string;
    effortTag?: string;
    consistencyTag?: string;
    volumeTag?: string;
    accident?: boolean;
    notes?: string;
    episodesCount?: number | string;
    windowMinutes?: number;
  } = {
    bristolCode: asNumber(data.bristolCode) ?? 4,
  };

  const urgencyTag = asString(data.urgencyTag);
  if (urgencyTag !== undefined) next.urgencyTag = urgencyTag;
  const effortTag = asString(data.effortTag);
  if (effortTag !== undefined) next.effortTag = effortTag;
  const consistencyTag = asString(data.consistencyTag);
  if (consistencyTag !== undefined) next.consistencyTag = consistencyTag;

  const volumeTag = asString(data.volumeTag);
  const sizeTag = asString(data.sizeTag);
  if (volumeTag !== undefined) {
    next.volumeTag = volumeTag;
  } else if (sizeTag !== undefined) {
    next.volumeTag = sizeTag;
    fixes.mappedDigestiveSizeTag += 1;
  }
  if (data.sizeTag !== undefined) {
    fixes.removedDigestiveSizeTag += 1;
  }

  if (typeof data.accident === "boolean") next.accident = data.accident;
  const notes = asString(data.notes);
  if (notes !== undefined) next.notes = notes;
  const episodesCount = data.episodesCount;
  if (typeof episodesCount === "number" && Number.isFinite(episodesCount)) {
    next.episodesCount = episodesCount;
  } else if (typeof episodesCount === "string") {
    next.episodesCount = episodesCount;
  }
  const windowMinutes = asNumber(data.windowMinutes);
  if (windowMinutes !== undefined) next.windowMinutes = windowMinutes;

  return next;
}

function normalizeHabitData(
  data: Record<string, unknown>,
  lookup: HabitLookup,
  fixes: FixCounts,
) {
  const rawId = asTrimmedString(data.habitId);
  const rawType = asTrimmedString(data.habitType);
  const rawName = asTrimmedString(data.name);

  const byId = rawId ? lookup.byId.get(rawId) : undefined;
  const byName = rawName ? lookup.byName.get(normalizeKey(rawName)) : undefined;
  const match = byId ?? byName;

  const nextName =
    match?.name ?? rawName ?? (rawId ? rawId.replace(/^habit_/, "") : "Habit");
  const nextHabitId = rawId ?? match?.id ?? `habit_${slugify(nextName)}`;
  const nextHabitType = normalizeHabitType(
    rawType ?? match?.habitType,
    nextName,
  );

  if (!rawId) fixes.filledHabitId += 1;
  if (!rawType) fixes.filledHabitType += 1;
  if (match?.name && rawName && match.name !== rawName) {
    fixes.normalizedHabitName += 1;
  }

  const next: {
    habitId: string;
    name: string;
    habitType: string;
    quantity?: number;
    action?: string;
  } = {
    habitId: nextHabitId,
    name: nextName,
    habitType: nextHabitType,
  };

  const quantity = asNumber(data.quantity);
  if (quantity !== undefined) next.quantity = quantity;
  const action = asString(data.action);
  if (action !== undefined) next.action = action;

  return next;
}

function normalizeActivityData(
  data: Record<string, unknown>,
  fixes: FixCounts,
) {
  const activityType =
    asTrimmedString(data.activityType) ?? asTrimmedString(data.type) ?? "walk";
  const next: {
    activityType: string;
    durationMinutes?: number;
    feelTag?: string;
  } = {
    activityType,
  };

  const durationMinutes = asNumber(data.durationMinutes);
  if (durationMinutes !== undefined) next.durationMinutes = durationMinutes;
  const feelTag = asString(data.feelTag);
  if (feelTag !== undefined) next.feelTag = feelTag;

  if (
    data.type !== undefined ||
    data.sleepStartAt !== undefined ||
    data.wakeAt !== undefined ||
    data.wakeOffsetHours !== undefined ||
    data.notes !== undefined ||
    data.paceTag !== undefined
  ) {
    fixes.droppedActivityLegacyFields += 1;
  }

  return next;
}

function normalizeWeightData(data: Record<string, unknown>) {
  return {
    weightKg: asNumber(data.weightKg) ?? 0,
  };
}

function normalizeLogData(row: LogDoc, lookup: HabitLookup) {
  const fixes = emptyFixCounts();
  const data = (row.data ?? {}) as Record<string, unknown>;

  let nextData: Record<string, unknown>;
  switch (row.type) {
    case "food":
      nextData = normalizeFoodData(data);
      break;
    case "fluid":
      nextData = normalizeFluidData(data, fixes);
      break;
    case "digestion":
      nextData = normalizeDigestionData(data, fixes);
      break;
    case "habit":
      nextData = normalizeHabitData(data, lookup, fixes);
      break;
    case "activity":
      nextData = normalizeActivityData(data, fixes);
      break;
    case "weight":
      nextData = normalizeWeightData(data);
      break;
    default:
      nextData = data;
      break;
  }

  const changed = JSON.stringify(row.data) !== JSON.stringify(nextData);
  return { changed, nextData, fixes };
}

export const migrateLegacyLogsBatch = internalMutation({
  args: {
    cursor: v.union(v.string(), v.null()),
    numItems: v.number(),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const numItems = Math.min(Math.max(Math.floor(args.numItems), 1), 200);
    const page = await ctx.db.query("logs").paginate({
      cursor: args.cursor,
      numItems,
    });

    const userIds = [...new Set(page.page.map((row) => row.userId))];
    const habitLookups = new Map<string, HabitLookup>();
    for (const userId of userIds) {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();
      habitLookups.set(userId, buildHabitLookup(profile));
    }

    let changed = 0;
    const fixes = emptyFixCounts();

    for (const row of page.page) {
      const lookup = habitLookups.get(row.userId) ?? buildHabitLookup(null);
      const result = normalizeLogData(row, lookup);
      mergeFixCounts(fixes, result.fixes);
      if (!result.changed) continue;
      changed += 1;
      if (!args.dryRun) {
        await ctx.db.patch(row._id, {
          data: result.nextData as LogDoc["data"],
        });
      }
    }

    return {
      scanned: page.page.length,
      changed,
      fixes,
      continueCursor: page.continueCursor,
      isDone: page.isDone,
    };
  },
});

// One-time migration: backfill conversation entries from existing aiAnalyses.
// Creates assistant messages from report summaries and user messages from
// patient messages found in the request payload, so conversation history is
// complete for reports that pre-date the conversations table.
export const backfillConversations = internalMutation({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) throw new Error("Not authenticated");
    const userId = identity.subject;
    const limit = Math.min(Math.max(args.limit ?? 200, 1), 500);
    const analyses = await ctx.db
      .query("aiAnalyses")
      .withIndex("by_userId_timestamp", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);

    let backfilled = 0;

    for (const analysis of analyses) {
      // Check if an assistant message already exists for this report
      const existing = await ctx.db
        .query("conversations")
        .withIndex("by_aiAnalysisId", (q) => q.eq("aiAnalysisId", analysis._id))
        .first();

      if (existing) continue;

      // Extract summary from the insight blob
      const insight = analysis.insight as Record<string, unknown> | null;
      const summary =
        insight !== null &&
        typeof insight === "object" &&
        typeof insight.summary === "string"
          ? insight.summary
          : null;

      if (!summary) continue;

      // Insert the assistant message (the report summary)
      await ctx.db.insert("conversations", {
        userId,
        role: "assistant",
        content: summary,
        aiAnalysisId: analysis._id,
        timestamp: analysis.timestamp,
      });
      backfilled++;

      // Try to extract patient messages from the request payload.
      // The request blob contains a `messages` array with `role` and `content`.
      // Check both the legacy inline field and the new payloads table.
      let request = analysis.request as Record<string, unknown> | null;
      if (request === null || request === undefined) {
        const payload = await ctx.db
          .query("aiAnalysisPayloads")
          .withIndex("by_aiAnalysisId", (q) =>
            q.eq("aiAnalysisId", analysis._id),
          )
          .first();
        request = (payload?.request ?? null) as Record<string, unknown> | null;
      }
      if (
        request === null ||
        typeof request !== "object" ||
        !Array.isArray(request.messages)
      ) {
        continue;
      }

      const userPayload = (
        request.messages as Array<Record<string, unknown>>
      ).find((m) => m.role === "user");

      if (!userPayload || typeof userPayload.content !== "string") continue;

      try {
        const parsed = JSON.parse(userPayload.content) as Record<
          string,
          unknown
        >;
        if (!Array.isArray(parsed.patientMessages)) continue;

        for (const pm of parsed.patientMessages) {
          const msg = pm as Record<string, unknown> | null;
          if (
            msg === null ||
            typeof msg !== "object" ||
            typeof msg.message !== "string"
          ) {
            continue;
          }
          await ctx.db.insert("conversations", {
            userId,
            role: "user",
            content: msg.message,
            aiAnalysisId: analysis._id,
            // Place user messages slightly before the report timestamp
            timestamp: analysis.timestamp - 1,
          });
        }
      } catch {
        // Skip payloads that aren't valid JSON
      }
    }

    return { backfilled };
  },
});

// ── Migration: strip calibrations from all profile documents ──────────────
// The `calibrations` field was a legacy holdover. It's no longer in the schema.
// Run this before deploying the schema without `calibrations`.
export const stripCalibrations = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Safety cap to prevent Convex memory limit hits in large deployments.
    const profiles = await ctx.db.query("profiles").take(1000);
    let fixed = 0;

    for (const profile of profiles) {
      const raw = profile as Record<string, unknown>;
      if (!("calibrations" in raw)) continue;

      // Remove calibrations by replacing the document without it
      const { calibrations: _, ...rest } = raw;
      await ctx.db.replace(profile._id, rest as typeof profile);
      fixed++;
    }

    return { fixed };
  },
});

// ── Migration: normalize profile habits to strict HabitConfig shape ───────
// The storedProfileHabitsValidator now uses habitConfigValidator (strict).
// Run this to normalize any legacy profile habits that pre-date the
// normalizeStoredProfileHabits write-path normalization.
export const normalizeProfileHabits = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Safety cap to prevent Convex memory limit hits in large deployments.
    const profiles = await ctx.db.query("profiles").take(1000);
    let fixed = 0;

    for (const profile of profiles) {
      const rawHabits = profile.habits;
      if (!Array.isArray(rawHabits) || rawHabits.length === 0) continue;

      const VALID_HABIT_TYPES = new Set([
        "sleep",
        "count",
        "activity",
        "fluid",
        "destructive",
        "checkbox",
        "weight",
      ]);
      // Check if any habit is missing required fields or has invalid habitType
      const needsNormalization = rawHabits.some((habit) => {
        if (!habit || typeof habit !== "object") return true;
        const h = habit as Record<string, unknown>;
        return (
          typeof h.id !== "string" ||
          typeof h.name !== "string" ||
          typeof h.kind !== "string" ||
          typeof h.unit !== "string" ||
          typeof h.quickIncrement !== "number" ||
          typeof h.showOnTrack !== "boolean" ||
          typeof h.color !== "string" ||
          typeof h.createdAt !== "number" ||
          typeof h.habitType !== "string" ||
          !VALID_HABIT_TYPES.has(h.habitType as string)
        );
      });

      if (!needsNormalization) continue;

      // Trigger a profile save by patching updatedAt — the replaceProfile
      // mutation normalizes habits on write. For the migration, we do a
      // minimal normalization inline.
      const normalized = rawHabits
        .map((habit, index) => {
          if (!habit || typeof habit !== "object") return null;
          const h = habit as Record<string, unknown>;
          const name = typeof h.name === "string" ? h.name.trim() : "";
          if (!name) return null;

          const habitType = normalizeHabitType(
            typeof h.habitType === "string" ? h.habitType : undefined,
            name,
          );
          const kind =
            h.kind === "positive" || h.kind === "destructive"
              ? h.kind
              : habitType === "destructive"
                ? "destructive"
                : "positive";
          const unit =
            h.unit === "count" ||
            h.unit === "ml" ||
            h.unit === "minutes" ||
            h.unit === "hours"
              ? h.unit
              : "count";

          const result: Record<string, unknown> = {
            id: typeof h.id === "string" ? h.id : `habit_${index}`,
            name,
            kind: habitType === "checkbox" ? "positive" : kind,
            unit,
            quickIncrement:
              habitType === "checkbox"
                ? 1
                : typeof h.quickIncrement === "number" && h.quickIncrement > 0
                  ? h.quickIncrement
                  : 1,
            showOnTrack:
              typeof h.showOnTrack === "boolean" ? h.showOnTrack : true,
            color: typeof h.color === "string" ? h.color : "violet",
            createdAt:
              typeof h.createdAt === "number"
                ? h.createdAt
                : profile._creationTime,
            habitType,
          };

          if (typeof h.dailyTarget === "number" && h.dailyTarget > 0) {
            if (habitType === "checkbox") result.dailyTarget = 1;
            else if (kind === "positive" && habitType !== "destructive") {
              result.dailyTarget = h.dailyTarget;
            }
          }
          if (typeof h.dailyCap === "number" && h.dailyCap > 0) {
            if (habitType === "destructive" || kind === "destructive") {
              result.dailyCap = h.dailyCap;
            }
          }
          if (
            habitType === "checkbox" &&
            typeof result.dailyTarget !== "number"
          ) {
            result.dailyTarget = 1;
          }
          if (typeof h.archivedAt === "number") {
            result.archivedAt = h.archivedAt;
          }
          if (h.logAs === "habit" || h.logAs === "fluid") {
            result.logAs = h.logAs;
          }

          return result;
        })
        .filter((h) => h !== null);

      await ctx.db.patch(profile._id, {
        habits: normalized as typeof profile.habits,
      });
      fixed++;
    }

    return { fixed };
  },
});

// ── Migration: normalize aiAnalyses insight/request/response fields ───────
// Strips unknown fields from insight objects and ensures all required fields
// are present. Also normalizes request and response to their expected shapes.
// Run this before deploying the strict AI analysis validators.
const VALID_CONFIDENCES = new Set(["high", "medium", "low"]);
const VALID_EXPERIMENT_STATUSES = new Set([
  "adapted",
  "broken",
  "testing",
  "rewarding",
]);

type StoredInsight = Infer<typeof aiInsightValidator>;
type StoredRequest = Infer<typeof aiRequestValidator>;
type StoredResponse = Infer<typeof aiResponseValidator>;

function normalizeStoredInsight(raw: unknown): StoredInsight {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;

  const directResponseToUser =
    typeof obj.directResponseToUser === "string"
      ? obj.directResponseToUser
      : null;

  const summary =
    typeof obj.summary === "string" ? obj.summary : "No summary available.";

  let educationalInsight: { topic: string; fact: string } | null = null;
  if (
    obj.educationalInsight &&
    typeof obj.educationalInsight === "object" &&
    !Array.isArray(obj.educationalInsight)
  ) {
    const ei = obj.educationalInsight as Record<string, unknown>;
    if (typeof ei.topic === "string" && typeof ei.fact === "string") {
      educationalInsight = { topic: ei.topic, fact: ei.fact };
    }
  }

  type ExperimentStatus = "adapted" | "broken" | "testing" | "rewarding";
  let lifestyleExperiment: {
    status: ExperimentStatus;
    message: string;
  } | null = null;
  if (
    obj.lifestyleExperiment &&
    typeof obj.lifestyleExperiment === "object" &&
    !Array.isArray(obj.lifestyleExperiment)
  ) {
    const le = obj.lifestyleExperiment as Record<string, unknown>;
    if (
      typeof le.status === "string" &&
      VALID_EXPERIMENT_STATUSES.has(le.status) &&
      typeof le.message === "string"
    ) {
      lifestyleExperiment = {
        status: le.status as ExperimentStatus,
        message: le.message,
      };
    }
  }

  const suspectedCulprits = Array.isArray(obj.suspectedCulprits)
    ? obj.suspectedCulprits
        .filter(
          (item: unknown) =>
            item &&
            typeof item === "object" &&
            !Array.isArray(item) &&
            typeof (item as Record<string, unknown>).food === "string" &&
            typeof (item as Record<string, unknown>).confidence === "string" &&
            typeof (item as Record<string, unknown>).reasoning === "string",
        )
        .map((item: unknown) => {
          type ConfidenceLevel = "high" | "medium" | "low";
          const c = item as Record<string, unknown>;
          const confidence: ConfidenceLevel = VALID_CONFIDENCES.has(
            c.confidence as string,
          )
            ? (c.confidence as ConfidenceLevel)
            : "low";
          return {
            food: c.food as string,
            confidence,
            reasoning: c.reasoning as string,
          };
        })
    : [];

  const likelySafe = Array.isArray(obj.likelySafe)
    ? obj.likelySafe
        .filter(
          (item: unknown) =>
            item &&
            typeof item === "object" &&
            !Array.isArray(item) &&
            typeof (item as Record<string, unknown>).food === "string" &&
            typeof (item as Record<string, unknown>).reasoning === "string",
        )
        .map((item: unknown) => {
          const s = item as Record<string, unknown>;
          return { food: s.food as string, reasoning: s.reasoning as string };
        })
    : [];

  const mealPlan = Array.isArray(obj.mealPlan)
    ? obj.mealPlan
        .filter(
          (item: unknown) =>
            item &&
            typeof item === "object" &&
            !Array.isArray(item) &&
            typeof (item as Record<string, unknown>).meal === "string" &&
            Array.isArray((item as Record<string, unknown>).items) &&
            typeof (item as Record<string, unknown>).reasoning === "string",
        )
        .map((item: unknown) => {
          const m = item as Record<string, unknown>;
          return {
            meal: m.meal as string,
            items: (m.items as unknown[]).filter(
              (i): i is string => typeof i === "string",
            ),
            reasoning: m.reasoning as string,
          };
        })
    : [];

  let nextFoodToTry = {
    food: "Plain white rice",
    reasoning: "Safe default after any episode.",
    timing: "Next meal",
  };
  if (
    obj.nextFoodToTry &&
    typeof obj.nextFoodToTry === "object" &&
    !Array.isArray(obj.nextFoodToTry)
  ) {
    const nft = obj.nextFoodToTry as Record<string, unknown>;
    if (typeof nft.food === "string") {
      nextFoodToTry = {
        food: nft.food,
        reasoning: typeof nft.reasoning === "string" ? nft.reasoning : "",
        timing: typeof nft.timing === "string" ? nft.timing : "",
      };
    }
  }

  let miniChallenge: { challenge: string; duration: string } | null = null;
  if (
    obj.miniChallenge &&
    typeof obj.miniChallenge === "object" &&
    !Array.isArray(obj.miniChallenge)
  ) {
    const mc = obj.miniChallenge as Record<string, unknown>;
    if (typeof mc.challenge === "string") {
      miniChallenge = {
        challenge: mc.challenge,
        duration: typeof mc.duration === "string" ? mc.duration : "",
      };
    }
  }

  const suggestions = Array.isArray(obj.suggestions)
    ? obj.suggestions.filter((s): s is string => typeof s === "string")
    : [];

  return {
    directResponseToUser,
    summary,
    educationalInsight,
    lifestyleExperiment,
    suspectedCulprits,
    likelySafe,
    mealPlan,
    nextFoodToTry,
    miniChallenge,
    suggestions,
  };
}

function normalizeStoredRequest(raw: unknown): StoredRequest {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;

  if (typeof obj.model !== "string" || !Array.isArray(obj.messages)) {
    return null;
  }

  const messages = obj.messages
    .filter(
      (m: unknown) =>
        m &&
        typeof m === "object" &&
        !Array.isArray(m) &&
        typeof (m as Record<string, unknown>).role === "string" &&
        typeof (m as Record<string, unknown>).content === "string",
    )
    .map((m: unknown) => {
      const msg = m as Record<string, unknown>;
      return { role: msg.role as string, content: msg.content as string };
    });

  return { model: obj.model, messages };
}

export const normalizeAiInsightData = internalMutation({
  args: {
    cursor: v.union(v.string(), v.null()),
    numItems: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const numItems = Math.min(Math.max(args.numItems ?? 50, 1), 200);
    const page = await ctx.db.query("aiAnalyses").paginate({
      cursor: args.cursor,
      numItems,
    });

    let changed = 0;

    for (const row of page.page) {
      const normalizedInsight = normalizeStoredInsight(row.insight);
      const normalizedRequest = normalizeStoredRequest(row.request);
      const normalizedResponse: StoredResponse =
        typeof row.response === "string" ? row.response : null;

      const insightChanged =
        JSON.stringify(row.insight) !== JSON.stringify(normalizedInsight);
      const requestChanged =
        JSON.stringify(row.request) !== JSON.stringify(normalizedRequest);
      const responseChanged = row.response !== normalizedResponse;

      if (insightChanged || requestChanged || responseChanged) {
        await ctx.db.patch(row._id, {
          insight: normalizedInsight,
          request: normalizedRequest,
          response: normalizedResponse,
        });
        changed++;
      }
    }

    return {
      scanned: page.page.length,
      changed,
      continueCursor: page.continueCursor,
      isDone: page.isDone,
    };
  },
});

const VALID_USAGE_FREQUENCIES = new Set([
  "more_than_once_per_day",
  "daily",
  "a_few_times_per_week",
  "about_once_per_week",
  "a_few_times_per_month",
  "about_once_per_month",
  "a_few_times_per_year",
  "about_once_per_year_or_less",
  "",
]);

function normalizeUsageFrequency(value: unknown): string {
  if (typeof value !== "string") return "";
  if (VALID_USAGE_FREQUENCIES.has(value)) return value;
  switch (value) {
    case "more_than_once_daily":
      return "more_than_once_per_day";
    case "less_than_daily":
      return "a_few_times_per_week";
    case "less_than_weekly":
      return "a_few_times_per_month";
    case "less_than_monthly":
      return "a_few_times_per_year";
    case "less_than_yearly":
      return "about_once_per_year_or_less";
    default:
      return "";
  }
}

function parseClockMinutes(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

function toClock(minutes: number): string {
  const bounded = Math.min(Math.max(Math.round(minutes), 0), 23 * 60 + 59);
  const h = Math.floor(bounded / 60);
  const m = bounded % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function midpointClock(start: string, end: string, fallback: string): string {
  const s = parseClockMinutes(start);
  const e = parseClockMinutes(end);
  if (s === null || e === null || e <= s) return fallback;
  return toClock(Math.round((s + e) / 2));
}

// Migration for the v1 release domain refactor:
// - aiPreferences.location -> aiPreferences.locationTimezone
// - 3-meal schedule -> explicit 6-meal schedule
// - healthProfile legacy keys renamed to canonical v1 keys
// - removed profile metadata fields dropped from stored objects
export const normalizeProfileDomainV1 = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Safety cap to prevent Convex memory limit hits in large deployments.
    const profiles = await ctx.db.query("profiles").take(1000);
    let fixed = 0;

    for (const profile of profiles) {
      let changed = false;
      let nextUnitSystem = profile.unitSystem;
      let nextHealthProfile = profile.healthProfile;
      let nextAiPreferences = profile.aiPreferences;
      const rawUnitSystem = (profile as { unitSystem?: unknown }).unitSystem;

      if (rawUnitSystem === "imperial") {
        nextUnitSystem = "imperial_us";
        changed = true;
      }

      if (profile.healthProfile && typeof profile.healthProfile === "object") {
        const hp = profile.healthProfile as Record<string, unknown>;
        const comorbiditiesSource = Array.isArray(hp.comorbidities)
          ? hp.comorbidities
          : Array.isArray(hp.healthConditions)
            ? hp.healthConditions
            : [];

        const normalizedCategories = Array.isArray(hp.recreationalCategories)
          ? hp.recreationalCategories.filter(
              (value): value is "stimulants" | "depressants" =>
                value === "stimulants" || value === "depressants",
            )
          : [];

        const normalizedHealth = {
          ...hp,
          height:
            typeof hp.height === "number" || hp.height === null
              ? hp.height
              : asNullableNumber(hp.heightCm),
          startingWeight:
            typeof hp.startingWeight === "number" || hp.startingWeight === null
              ? hp.startingWeight
              : asNullableNumber(hp.startingWeightKg),
          currentWeight:
            typeof hp.currentWeight === "number" || hp.currentWeight === null
              ? hp.currentWeight
              : asNullableNumber(hp.currentWeightKg),
          targetWeight:
            typeof hp.targetWeight === "number" || hp.targetWeight === null
              ? hp.targetWeight
              : asNullableNumber(hp.targetWeightKg),
          comorbidities: comorbiditiesSource.filter(
            (value): value is string => typeof value === "string",
          ),
          otherConditions:
            typeof hp.otherConditions === "string"
              ? hp.otherConditions
              : typeof hp.healthConditionsOther === "string"
                ? hp.healthConditionsOther
                : "",
          alcoholFrequency: normalizeUsageFrequency(hp.alcoholFrequency),
          recreationalStimulantsFrequency: normalizeUsageFrequency(
            hp.recreationalStimulantsFrequency,
          ),
          recreationalDepressantsFrequency: normalizeUsageFrequency(
            hp.recreationalDepressantsFrequency,
          ),
          recreationalCategories: normalizedCategories,
        } as Record<string, unknown>;

        delete normalizedHealth.heightCm;
        delete normalizedHealth.startingWeightKg;
        delete normalizedHealth.currentWeightKg;
        delete normalizedHealth.targetWeightKg;
        delete normalizedHealth.healthConditions;
        delete normalizedHealth.healthConditionsOther;
        delete normalizedHealth.smokingNotes;
        delete normalizedHealth.alcoholNotes;
        delete normalizedHealth.recreationalStimulantsAmount;
        delete normalizedHealth.recreationalDepressantsAmount;
        delete normalizedHealth.recreationalPsychedelicsAmount;
        delete normalizedHealth.recreationalPsychedelicsFrequency;
        delete normalizedHealth.recreationalPsychedelicsYears;
        delete normalizedHealth.heightUnit;
        delete normalizedHealth.weightUnit;

        if (JSON.stringify(hp) !== JSON.stringify(normalizedHealth)) {
          nextHealthProfile = normalizedHealth as typeof profile.healthProfile;
          changed = true;
        }
      }

      if (profile.aiPreferences && typeof profile.aiPreferences === "object") {
        const prefs = profile.aiPreferences as Record<string, unknown>;
        const mealSchedule =
          (prefs.mealSchedule as Record<string, unknown> | undefined) ?? {};
        const breakfast =
          typeof mealSchedule.breakfast === "string"
            ? mealSchedule.breakfast
            : "07:00";
        const lunch =
          typeof mealSchedule.lunch === "string" ? mealSchedule.lunch : "13:00";
        const dinner =
          typeof mealSchedule.dinner === "string"
            ? mealSchedule.dinner
            : "19:00";

        const normalizedPrefs = {
          ...prefs,
          locationTimezone:
            typeof prefs.locationTimezone === "string"
              ? prefs.locationTimezone
              : typeof prefs.location === "string"
                ? prefs.location
                : "",
          mealSchedule: {
            breakfast,
            middaySnack:
              typeof mealSchedule.middaySnack === "string"
                ? mealSchedule.middaySnack
                : midpointClock(breakfast, lunch, "10:00"),
            lunch,
            midafternoonSnack:
              typeof mealSchedule.midafternoonSnack === "string"
                ? mealSchedule.midafternoonSnack
                : midpointClock(lunch, dinner, "16:00"),
            dinner,
            lateEveningSnack:
              typeof mealSchedule.lateEveningSnack === "string"
                ? mealSchedule.lateEveningSnack
                : "22:00",
          },
          promptVersion:
            typeof prefs.promptVersion === "number" &&
            Number.isFinite(prefs.promptVersion)
              ? prefs.promptVersion
              : 2,
          preset:
            prefs.preset === "reassuring_coach" ||
            prefs.preset === "clear_clinician" ||
            prefs.preset === "data_deep_dive" ||
            prefs.preset === "quiet_checkin" ||
            prefs.preset === "custom"
              ? prefs.preset
              : "reassuring_coach",
        } as Record<string, unknown>;

        delete normalizedPrefs.location;
        delete normalizedPrefs.suggestionCount;
        delete normalizedPrefs.toneFriendliness;
        delete normalizedPrefs.toneProfessionalism;
        delete normalizedPrefs.warmth;

        if (JSON.stringify(prefs) !== JSON.stringify(normalizedPrefs)) {
          nextAiPreferences = normalizedPrefs as typeof profile.aiPreferences;
          changed = true;
        }
      }

      if (!changed) continue;
      await ctx.db.patch(profile._id, {
        ...(nextUnitSystem !== profile.unitSystem && {
          unitSystem: nextUnitSystem,
        }),
        ...(nextHealthProfile !== undefined && {
          healthProfile: nextHealthProfile,
        }),
        ...(nextAiPreferences !== undefined && {
          aiPreferences: nextAiPreferences,
        }),
        updatedAt: Date.now(),
      });
      fixed++;
    }

    return { scanned: profiles.length, fixed };
  },
});

// Log-type normalization for legacy top-level rows no longer used by the UI model:
// - sleep -> activity({ activityType: "sleep", durationMinutes? })
// - wellness -> habit({ habitType: "count", quantity: 1 })
export const normalizeLegacyTopLevelLogTypesV1 = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Safety cap to prevent Convex memory limit hits in large deployments.
    const logs = await ctx.db.query("logs").take(1000);
    let fixed = 0;

    for (const log of logs) {
      const raw = log as unknown as Record<string, unknown>;
      const type = String(raw.type ?? "");
      const data = (raw.data as Record<string, unknown> | null) ?? {};

      if (type === "sleep") {
        const duration = Number(data.durationMinutes);
        await ctx.db.patch(log._id, {
          type: "activity",
          data:
            Number.isFinite(duration) && duration > 0
              ? { activityType: "sleep", durationMinutes: duration }
              : { activityType: "sleep" },
        });
        fixed++;
        continue;
      }

      if (type === "wellness") {
        const wellnessType =
          typeof data.wellnessType === "string" &&
          data.wellnessType.trim().length > 0
            ? data.wellnessType.trim()
            : "Wellness";
        await ctx.db.patch(log._id, {
          type: "habit",
          data: {
            habitId: `habit_wellness_${wellnessType.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
            name: wellnessType,
            habitType: "count",
            quantity: 1,
          },
        });
        fixed++;
      }
    }

    return { scanned: logs.length, fixed };
  },
});

// ── Migration: backfill digestion log derived fields ─────────────────────
// Ensures all digestion logs have:
// - consistencyTag derived from bristolCode (if missing)
// - windowMinutes defaulted to 30 (if missing)
// - episodesCount defaulted to 1 (if missing)
// Does NOT overwrite existing values.
function bristolToConsistencyTag(
  code: number,
): "diarrhea" | "loose" | "constipated" | "hard" | "firm" {
  if (code >= 7) return "diarrhea";
  if (code === 6) return "loose";
  if (code <= 1) return "constipated";
  if (code === 2) return "hard";
  return "firm";
}

export const backfillDigestionLogFields = internalMutation({
  args: {
    limit: v.optional(v.number()),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) throw new Error("Not authenticated");
    const userId = identity.subject;
    const limit = Math.min(Math.max(args.limit ?? 5000, 1), 20000);

    const logs = await ctx.db
      .query("logs")
      .withIndex("by_userId_timestamp", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);

    let scanned = 0;
    let updated = 0;
    let addedConsistencyTag = 0;
    let addedWindowMinutes = 0;
    let addedEpisodesCount = 0;

    for (const log of logs) {
      if (log.type !== "digestion") continue;
      scanned++;

      const data = (log.data ?? {}) as Record<string, unknown>;
      const bristolCode = asNumber(data.bristolCode);
      let changed = false;
      const patch: Record<string, unknown> = { ...data };

      if (data.consistencyTag === undefined && bristolCode !== undefined) {
        patch.consistencyTag = bristolToConsistencyTag(bristolCode);
        addedConsistencyTag++;
        changed = true;
      }

      if (data.windowMinutes === undefined) {
        patch.windowMinutes = 30;
        addedWindowMinutes++;
        changed = true;
      }

      if (data.episodesCount === undefined) {
        patch.episodesCount = 1;
        addedEpisodesCount++;
        changed = true;
      }

      if (changed) {
        updated++;
        if (!args.dryRun) {
          await ctx.db.patch(log._id, {
            data: patch as typeof log.data,
          });
        }
      }
    }

    return {
      scanned,
      updated,
      addedConsistencyTag,
      addedWindowMinutes,
      addedEpisodesCount,
      dryRun: args.dryRun ?? false,
    };
  },
});

// ── Migration: move request/response from aiAnalyses → aiAnalysisPayloads ──
//
// Existing aiAnalyses documents contain huge request/response LLM payloads
// (50-100KB each). Reactive subscriptions read full documents, causing
// 3.29 GB/day in bandwidth. This migration moves the heavy fields to a
// separate table and nulls them out in aiAnalyses.
//
// Safe to run multiple times — skips rows that already have a payload row.

export const migrateAiAnalysisPayloads = internalMutation({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const BATCH_SIZE = 5;
    const dryRun = args.dryRun ?? false;

    // Query a small batch of aiAnalyses docs. Each doc is 50-100KB due to
    // inline request/response payloads, so we keep the batch tiny to stay
    // well under Convex document read limits.
    const candidates = await ctx.db.query("aiAnalyses").take(BATCH_SIZE);

    // Filter to only docs that still have inline request/response fields.
    const unmigrated = candidates.filter(
      (row) =>
        (row.request !== null && row.request !== undefined) ||
        (row.response !== null && row.response !== undefined),
    );

    let migrated = 0;
    let skippedAlreadyDone = 0;

    for (const row of unmigrated) {
      // Idempotency check: skip if a payload row already exists.
      const existingPayload = await ctx.db
        .query("aiAnalysisPayloads")
        .withIndex("by_aiAnalysisId", (q) => q.eq("aiAnalysisId", row._id))
        .first();

      if (existingPayload) {
        // Payload exists — just clear the inline fields from aiAnalyses.
        if (!dryRun) {
          await ctx.db.patch(row._id, {
            request: undefined,
            response: undefined,
          });
        }
        migrated++;
        continue;
      }

      if (!dryRun) {
        // Create the payload row in the separate table.
        await ctx.db.insert("aiAnalysisPayloads", {
          userId: row.userId,
          aiAnalysisId: row._id,
          request: (row.request ?? null) as typeof aiRequestValidator.type,
          response: (row.response ?? null) as typeof aiResponseValidator.type,
        });

        // Clear the heavy inline fields from aiAnalyses.
        await ctx.db.patch(row._id, {
          request: undefined,
          response: undefined,
        });
      }

      migrated++;
    }

    skippedAlreadyDone = candidates.length - unmigrated.length;

    // Schedule next batch only if we actually migrated something (not just skipped).
    // Without this check, fully-migrated tables loop forever reading the same docs.
    const hasMore = candidates.length === BATCH_SIZE && migrated > 0;
    if (hasMore && !dryRun) {
      await ctx.scheduler.runAfter(
        100,
        internal.migrations.migrateAiAnalysisPayloads,
        {},
      );
    }

    const status = hasMore ? "Scheduling next batch..." : "Migration complete.";
    console.log(
      `migrateAiAnalysisPayloads: migrated=${migrated}, skippedAlreadyDone=${skippedAlreadyDone}, dryRun=${dryRun}. ${status}`,
    );

    return { migrated, skippedAlreadyDone, dryRun, hasMore };
  },
});

// ── Migration: normalize canonicalName values across food tables ──
//
// Multiple tables store canonicalName values that can become stale when the
// food registry evolves. This migration resolves each stored name against the
// current registry (via resolveCanonicalFoodName). This is a prerequisite for switching
// query functions from .collect() to indexed queries.
//
// Safe to run multiple times — skips rows where the name already matches.

const CANONICAL_TABLES = [
  "foodAssessments",
  "ingredientExposures",
  "foodTrialSummary",
  "foodAliases",
  "foodLibrary",
  "ingredientOverrides",
  "ingredientProfiles",
] as const;

type CanonicalTable = (typeof CANONICAL_TABLES)[number];

const NORMALIZE_BATCH_SIZE = 50;

function nextCanonicalTable(current: CanonicalTable): CanonicalTable | null {
  const idx = CANONICAL_TABLES.indexOf(current);
  if (idx < 0 || idx >= CANONICAL_TABLES.length - 1) return null;
  return CANONICAL_TABLES[idx + 1];
}

export const normalizeCanonicalNames = internalMutation({
  args: {
    table: v.optional(
      v.union(
        v.literal("foodAssessments"),
        v.literal("ingredientExposures"),
        v.literal("foodTrialSummary"),
        v.literal("foodAliases"),
        v.literal("foodLibrary"),
        v.literal("ingredientOverrides"),
        v.literal("ingredientProfiles"),
      ),
    ),
    cursor: v.optional(v.string()),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const tableName: CanonicalTable = args.table ?? "foodAssessments";
    const dryRun = args.dryRun ?? false;
    const cursorId = args.cursor as Id<CanonicalTable> | undefined;

    // Build the query with optional cursor for pagination.
    let q = ctx.db.query(tableName);
    if (cursorId !== undefined) {
      // Only process docs created after the cursor doc.
      // We use the system _id ordering to paginate.
      q = q.filter((row) => row.gt(row.field("_id"), cursorId));
    }

    const batch = await q.take(NORMALIZE_BATCH_SIZE);

    let checked = 0;
    let updated = 0;
    let lastId: string | undefined;

    // Cache resolved names within the batch to avoid redundant lookups
    // when multiple documents share the same canonicalName.
    const canonicalCache = new Map<string, string>();
    function getCachedCanonical(name: string): string {
      const cached = canonicalCache.get(name);
      if (cached !== undefined) return cached;
      const result = resolveCanonicalFoodName(name);
      canonicalCache.set(name, result);
      return result;
    }

    for (const doc of batch) {
      checked++;
      lastId = doc._id as string;

      const currentDoc = doc as { _id: string; canonicalName: string };
      const resolved = getCachedCanonical(currentDoc.canonicalName);

      if (resolved !== currentDoc.canonicalName) {
        if (!dryRun) {
          await ctx.db.patch(doc._id as Id<CanonicalTable>, {
            canonicalName: resolved,
          });
        }
        updated++;
      }
    }

    console.log(
      `[normalizeCanonicals] ${tableName}: checked=${checked}, updated=${updated}, dryRun=${dryRun}`,
    );

    // If the batch was full, schedule next batch for the same table.
    if (batch.length === NORMALIZE_BATCH_SIZE) {
      await ctx.scheduler.runAfter(
        100,
        internal.migrations.normalizeCanonicalNames,
        {
          table: tableName,
          ...(lastId !== undefined && { cursor: lastId }),
          ...(dryRun && { dryRun }),
        },
      );
      return {
        tableName,
        checked,
        updated,
        dryRun,
        status: "scheduling_next_batch" as const,
      };
    }

    // Table is complete. Move to the next table or finish.
    const nextTable = nextCanonicalTable(tableName);
    if (nextTable !== null) {
      console.log(
        `[normalizeCanonicals] ${tableName} complete. Moving to ${nextTable}.`,
      );
      await ctx.scheduler.runAfter(
        100,
        internal.migrations.normalizeCanonicalNames,
        {
          table: nextTable,
          ...(dryRun && { dryRun }),
        },
      );
      return {
        tableName,
        checked,
        updated,
        dryRun,
        status: "table_complete" as const,
      };
    }

    console.log("[normalizeCanonicals] All tables complete.");
    return {
      tableName,
      checked,
      updated,
      dryRun,
      status: "all_complete" as const,
    };
  },
});
