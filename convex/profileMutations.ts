import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth } from "./lib/auth";
import {
  asNumber,
  asTrimmedString,
  inferHabitTypeFromName,
  slugifyName,
} from "./lib/coerce";
import { sanitizeUnknownStringsDeep } from "./lib/inputSafety";
import {
  aiPreferencesValidator,
  fluidPresetsValidator,
  foodPersonalisationValidator,
  habitsValidator,
  healthProfileValidator,
  nutritionGoalsValidator,
  sleepGoalValidator,
  transitCalibrationValidator,
} from "./validators";

// ─────────────────────────────────────────────────────────────────────────────
// Habit type normalization
// ─────────────────────────────────────────────────────────────────────────────

const KNOWN_HABIT_TYPES = new Set<string>([
  "sleep",
  "count",
  "activity",
  "fluid",
  "destructive",
  "checkbox",
  "weight",
] as const);

const LEGACY_HABIT_TYPE_MAP: Record<string, string> = {
  cigarettes: "destructive",
  rec_drugs: "destructive",
  confectionery: "destructive",
  alcohol: "destructive",
  movement: "activity",
  hydration: "fluid",
  medication: "checkbox",
  custom: "count",
  hygiene: "count",
  wellness: "count",
  recovery: "count",
  sweets: "destructive",
};

const KNOWN_HABIT_UNITS = new Set<string>([
  "count",
  "ml",
  "minutes",
  "hours",
] as const);

function asFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function normalizeHabitType(rawType: string | undefined, name: string): string {
  if (rawType) {
    const normalized = rawType.trim().toLowerCase();
    if (KNOWN_HABIT_TYPES.has(normalized)) return normalized;
    if (normalized in LEGACY_HABIT_TYPE_MAP) {
      return LEGACY_HABIT_TYPE_MAP[normalized];
    }
  }
  return inferHabitTypeFromName(name);
}

function inferHabitKind(habitType: string): "positive" | "destructive" {
  return habitType === "destructive" ? "destructive" : "positive";
}

function normalizeKind(args: {
  rawKind: string | undefined;
  goalMode: string | undefined;
  habitType: string;
}): "positive" | "destructive" {
  const { rawKind, goalMode, habitType } = args;

  if (habitType === "destructive") return "destructive";
  if (habitType === "checkbox") return "positive";

  if (rawKind === "positive" || rawKind === "destructive") {
    return rawKind;
  }
  if (goalMode === "limit") return "destructive";
  if (goalMode === "target") return "positive";
  return inferHabitKind(habitType);
}

function normalizeLogAs(
  habitType: string,
  rawLogAs: "habit" | "fluid" | undefined,
): "habit" | "fluid" | undefined {
  if (rawLogAs) return rawLogAs;
  if (habitType === "fluid") return "fluid";
  return undefined;
}

function normalizeUnit(args: {
  rawUnit: string | undefined;
  habitType: string;
  logAs: "habit" | "fluid" | undefined;
}): "count" | "ml" | "minutes" | "hours" {
  const { rawUnit, habitType, logAs } = args;
  if (rawUnit && KNOWN_HABIT_UNITS.has(rawUnit)) {
    return rawUnit as "count" | "ml" | "minutes" | "hours";
  }
  if (habitType === "sleep") return "hours";
  if (habitType === "activity") return "minutes";
  if (habitType === "fluid" || logAs === "fluid") return "ml";
  return "count";
}

function normalizeQuickIncrement(
  habitType: string,
  rawIncrement: number | undefined,
): number {
  if (habitType === "checkbox") return 1;
  if (typeof rawIncrement === "number" && rawIncrement > 0) return rawIncrement;
  if (habitType === "sleep") return 0.5;
  if (habitType === "activity") return 10;
  if (habitType === "fluid") return 250;
  return 1;
}

function normalizeGoalValues(args: {
  habitType: string;
  kind: "positive" | "destructive";
  rawDailyTarget: number | undefined;
  rawDailyCap: number | undefined;
}): { dailyTarget?: number; dailyCap?: number } {
  const { habitType, kind, rawDailyTarget, rawDailyCap } = args;
  if (habitType === "checkbox") return { dailyTarget: 1 };
  if (habitType === "destructive" || kind === "destructive") {
    if (typeof rawDailyCap === "number" && rawDailyCap > 0) {
      return { dailyCap: rawDailyCap };
    }
    return {};
  }
  if (typeof rawDailyTarget === "number" && rawDailyTarget > 0) {
    return { dailyTarget: rawDailyTarget };
  }
  return {};
}

function inferColor(habitType: string, rawColor: string | undefined): string {
  if (rawColor) return rawColor;
  if (habitType === "destructive") return "gray";
  if (habitType === "fluid") return "blue";
  return "indigo";
}

function normalizeStoredProfileHabit(
  rawHabit: unknown,
  index: number,
  fallbackCreatedAt: number,
) {
  if (!rawHabit || typeof rawHabit !== "object") return null;
  const raw = rawHabit as Record<string, unknown>;

  const name = asTrimmedString(raw.name);
  if (!name) return null;

  const rawHabitType = asTrimmedString(raw.habitType);
  const rawKind = asTrimmedString(raw.kind);
  const goalMode = asTrimmedString(raw.goalMode);
  const rawLogAs =
    raw.logAs === "habit" || raw.logAs === "fluid" ? raw.logAs : undefined;
  const rawUnit = asTrimmedString(raw.unit);
  const rawDailyTarget =
    asFiniteNumber(raw.dailyTarget) ?? asFiniteNumber(raw.dailyGoal);
  const rawDailyCap =
    asFiniteNumber(raw.dailyCap) ?? asFiniteNumber(raw.dailyGoal);

  const habitType = normalizeHabitType(rawHabitType, name);
  const kind = normalizeKind({ rawKind, goalMode, habitType });
  const logAs = normalizeLogAs(habitType, rawLogAs);
  const unit = normalizeUnit({ rawUnit, habitType, logAs });
  const quickIncrement = normalizeQuickIncrement(
    habitType,
    asFiniteNumber(raw.quickIncrement),
  );
  const { dailyTarget, dailyCap } = normalizeGoalValues({
    habitType,
    kind,
    rawDailyTarget,
    rawDailyCap,
  });

  const normalized: {
    id: string;
    name: string;
    kind: "positive" | "destructive";
    unit: "count" | "ml" | "minutes" | "hours";
    quickIncrement: number;
    dailyTarget?: number;
    dailyCap?: number;
    weeklyFrequencyTarget?: number;
    showOnTrack: boolean;
    color: string;
    createdAt: number;
    archivedAt?: number;
    logAs?: "habit" | "fluid";
    habitType: string;
    templateKey?: string;
  } = {
    id: asTrimmedString(raw.id) ?? `habit_${slugifyName(name)}_${index}`,
    name,
    kind,
    unit,
    quickIncrement,
    showOnTrack: typeof raw.showOnTrack === "boolean" ? raw.showOnTrack : true,
    color: inferColor(habitType, asTrimmedString(raw.color)),
    createdAt: asFiniteNumber(raw.createdAt) ?? fallbackCreatedAt,
    habitType,
  };

  if (typeof dailyTarget === "number" && dailyTarget > 0) {
    normalized.dailyTarget = dailyTarget;
  }
  if (typeof dailyCap === "number" && dailyCap > 0) {
    normalized.dailyCap = dailyCap;
  }

  const weeklyFrequencyTarget = asFiniteNumber(raw.weeklyFrequencyTarget);
  if (weeklyFrequencyTarget !== undefined && weeklyFrequencyTarget > 0) {
    normalized.weeklyFrequencyTarget = Math.round(weeklyFrequencyTarget);
  }

  const archivedAt = asFiniteNumber(raw.archivedAt);
  if (archivedAt !== undefined) normalized.archivedAt = archivedAt;
  if (logAs !== undefined) normalized.logAs = logAs;

  const templateKey = asTrimmedString(raw.templateKey);
  if (templateKey) normalized.templateKey = templateKey;

  return normalized;
}

export function normalizeStoredProfileHabits(
  habits: unknown,
  fallbackCreatedAt: number,
) {
  if (!Array.isArray(habits)) return [];
  return habits
    .map((habit, index) =>
      normalizeStoredProfileHabit(habit, index, fallbackCreatedAt),
    )
    .filter((habit) => habit !== null);
}

// ─────────────────────────────────────────────────────────────────────────────
// Fluid preset normalization
// ─────────────────────────────────────────────────────────────────────────────

export function normalizeStoredFluidPresets(
  value: unknown,
): Array<{ name: string }> | undefined {
  if (!Array.isArray(value)) return undefined;

  const seen = new Set<string>();
  const normalized: Array<{ name: string }> = [];

  for (const item of value) {
    const candidate =
      typeof item === "string"
        ? { name: item }
        : item && typeof item === "object"
          ? {
              name: asTrimmedString((item as { name?: unknown }).name) ?? "",
            }
          : null;
    if (!candidate) continue;

    const name = candidate.name.trim();
    if (!name) continue;

    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    normalized.push({
      name,
    });
  }

  return normalized.length > 0 ? normalized.slice(0, 3) : undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// AI preferences normalization
// ─────────────────────────────────────────────────────────────────────────────

/** Known legacy model names that should be normalized to current values. */
const LEGACY_AI_MODEL_MAP: Record<string, string> = {
  "gpt-5-mini": "gpt-5.4-mini",
  "gpt-4o-mini": "gpt-5.4-mini",
  "gpt-4o": "gpt-5.4",
  "gpt-4.1-nano": "gpt-5.4-mini",
  "gpt-4.1-mini": "gpt-5.4-mini",
  "gpt-5.2": "gpt-5.4",
};

function normalizeStoredAiModel(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) return "gpt-5.4";
  const mapped = LEGACY_AI_MODEL_MAP[value];
  if (mapped !== undefined) return mapped;
  return value;
}

export function normalizeStoredAiPreferences(
  value: unknown,
): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const preferences = value as Record<string, unknown>;
  return {
    ...preferences,
    aiModel: normalizeStoredAiModel(preferences.aiModel),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared payload construction helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the normalized profile payload from args.
 * Used by both replaceProfile (which needs all required fields) and
 * patchProfile (which builds partial updates). Both repeat the same
 * per-field normalization logic, so it is extracted here.
 */
export function buildNormalizedProfileFields(args: {
  unitSystem?: "metric" | "imperial_us" | "imperial_uk";
  habits?: typeof habitsValidator.type;
  fluidPresets?: typeof fluidPresetsValidator.type;
  sleepGoal?: typeof sleepGoalValidator.type;
  healthProfile?: typeof healthProfileValidator.type;
  aiPreferences?: typeof aiPreferencesValidator.type;
  foodPersonalisation?: typeof foodPersonalisationValidator.type;
  transitCalibration?: typeof transitCalibrationValidator.type;
  nutritionGoals?: typeof nutritionGoalsValidator.type;
  foodFavourites?: string[];
  updatedAt: number;
}): Record<string, unknown> {
  const fields: Record<string, unknown> = { updatedAt: args.updatedAt };

  if (args.unitSystem !== undefined) {
    fields.unitSystem = args.unitSystem;
  }
  if (args.habits !== undefined) {
    fields.habits = normalizeStoredProfileHabits(
      sanitizeUnknownStringsDeep(args.habits, { path: "profile.habits" }),
      args.updatedAt,
    );
  }
  if (args.fluidPresets !== undefined) {
    fields.fluidPresets =
      normalizeStoredFluidPresets(
        sanitizeUnknownStringsDeep(args.fluidPresets, {
          path: "profile.fluidPresets",
        }),
      ) ?? [];
  }
  if (args.sleepGoal !== undefined) {
    fields.sleepGoal = sanitizeUnknownStringsDeep(args.sleepGoal, {
      path: "profile.sleepGoal",
    });
  }
  if (args.healthProfile !== undefined) {
    fields.healthProfile = sanitizeUnknownStringsDeep(args.healthProfile, {
      path: "profile.healthProfile",
    });
  }
  if (args.aiPreferences !== undefined) {
    fields.aiPreferences = normalizeStoredAiPreferences(
      sanitizeUnknownStringsDeep(args.aiPreferences, {
        path: "profile.aiPreferences",
      }),
    ) as typeof args.aiPreferences;
  }
  if (args.foodPersonalisation !== undefined) {
    fields.foodPersonalisation = sanitizeUnknownStringsDeep(
      args.foodPersonalisation,
      { path: "profile.foodPersonalisation" },
    );
  }
  if (args.transitCalibration !== undefined) {
    fields.transitCalibration = sanitizeUnknownStringsDeep(
      args.transitCalibration,
      { path: "profile.transitCalibration" },
    );
  }
  if (args.nutritionGoals !== undefined) {
    fields.nutritionGoals = args.nutritionGoals;
  }
  if (args.foodFavourites !== undefined) {
    fields.foodFavourites = sanitizeUnknownStringsDeep(args.foodFavourites, {
      path: "profile.foodFavourites",
    });
  }

  return fields;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public mutations and query
// ─────────────────────────────────────────────────────────────────────────────

export const replaceProfile = mutation({
  args: {
    unitSystem: v.union(
      v.literal("metric"),
      v.literal("imperial_us"),
      v.literal("imperial_uk"),
    ),
    habits: habitsValidator,
    fluidPresets: v.optional(fluidPresetsValidator),
    sleepGoal: v.optional(sleepGoalValidator),
    healthProfile: v.optional(healthProfileValidator),
    aiPreferences: v.optional(aiPreferencesValidator),
    foodPersonalisation: v.optional(foodPersonalisationValidator),
    transitCalibration: v.optional(transitCalibrationValidator),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    if (args.habits.length > 100) {
      throw new Error("Profile cannot contain more than 100 habits.");
    }

    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    // nutritionGoals and foodFavourites are patch-only fields — excluded from full replace
    // to prevent accidental overwrites of independently-managed preference data.
    const fields = buildNormalizedProfileFields({
      unitSystem: args.unitSystem,
      habits: args.habits,
      ...(args.fluidPresets !== undefined && {
        fluidPresets: args.fluidPresets,
      }),
      ...(args.sleepGoal !== undefined && { sleepGoal: args.sleepGoal }),
      ...(args.healthProfile !== undefined && {
        healthProfile: args.healthProfile,
      }),
      ...(args.aiPreferences !== undefined && {
        aiPreferences: args.aiPreferences,
      }),
      ...(args.foodPersonalisation !== undefined && {
        foodPersonalisation: args.foodPersonalisation,
      }),
      ...(args.transitCalibration !== undefined && {
        transitCalibration: args.transitCalibration,
      }),
      updatedAt: args.now,
    });

    const payload = {
      userId,
      unitSystem: fields.unitSystem as "metric" | "imperial_us" | "imperial_uk",
      habits: fields.habits as typeof habitsValidator.type,
      updatedAt: fields.updatedAt as number,
      ...(fields.fluidPresets !== undefined && {
        fluidPresets: fields.fluidPresets,
      }),
      ...(fields.sleepGoal !== undefined && { sleepGoal: fields.sleepGoal }),
      ...(fields.healthProfile !== undefined && {
        healthProfile: fields.healthProfile,
      }),
      ...(fields.aiPreferences !== undefined && {
        aiPreferences: fields.aiPreferences,
      }),
      ...(fields.foodPersonalisation !== undefined && {
        foodPersonalisation: fields.foodPersonalisation,
      }),
      ...(fields.transitCalibration !== undefined && {
        transitCalibration: fields.transitCalibration,
      }),
    };

    if (existing) {
      await ctx.db.replace(
        existing._id,
        payload as Parameters<typeof ctx.db.replace<"profiles">>[1],
      );
      return existing._id;
    }
    return await ctx.db.insert(
      "profiles",
      payload as Parameters<typeof ctx.db.insert<"profiles">>[1],
    );
  },
});

export const patchProfile = mutation({
  args: {
    unitSystem: v.optional(
      v.union(
        v.literal("metric"),
        v.literal("imperial_us"),
        v.literal("imperial_uk"),
      ),
    ),
    habits: v.optional(habitsValidator),
    fluidPresets: v.optional(fluidPresetsValidator),
    sleepGoal: v.optional(sleepGoalValidator),
    healthProfile: v.optional(healthProfileValidator),
    aiPreferences: v.optional(aiPreferencesValidator),
    foodPersonalisation: v.optional(foodPersonalisationValidator),
    transitCalibration: v.optional(transitCalibrationValidator),
    nutritionGoals: v.optional(nutritionGoalsValidator),
    foodFavourites: v.optional(v.array(v.string())),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);

    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (args.habits !== undefined && args.habits.length > 100) {
      throw new Error("Profile cannot contain more than 100 habits.");
    }

    const updates = buildNormalizedProfileFields({
      ...(args.unitSystem !== undefined && { unitSystem: args.unitSystem }),
      ...(args.habits !== undefined && { habits: args.habits }),
      ...(args.fluidPresets !== undefined && {
        fluidPresets: args.fluidPresets,
      }),
      ...(args.sleepGoal !== undefined && { sleepGoal: args.sleepGoal }),
      ...(args.healthProfile !== undefined && {
        healthProfile: args.healthProfile,
      }),
      ...(args.aiPreferences !== undefined && {
        aiPreferences: args.aiPreferences,
      }),
      ...(args.foodPersonalisation !== undefined && {
        foodPersonalisation: args.foodPersonalisation,
      }),
      ...(args.transitCalibration !== undefined && {
        transitCalibration: args.transitCalibration,
      }),
      ...(args.nutritionGoals !== undefined && {
        nutritionGoals: args.nutritionGoals,
      }),
      ...(args.foodFavourites !== undefined && {
        foodFavourites: args.foodFavourites,
      }),
      updatedAt: args.now,
    });

    if (existing) {
      await ctx.db.patch(existing._id, updates);
      return existing._id;
    }

    // No existing profile — insert with required fields defaulted
    return await ctx.db.insert("profiles", {
      userId,
      unitSystem:
        (updates.unitSystem as "metric" | "imperial_us" | "imperial_uk") ??
        "metric",
      habits: (updates.habits as typeof habitsValidator.type) ?? [],
      updatedAt: args.now,
      ...(updates.fluidPresets !== undefined && {
        fluidPresets: updates.fluidPresets,
      }),
      ...(updates.sleepGoal !== undefined && {
        sleepGoal: updates.sleepGoal,
      }),
      ...(updates.healthProfile !== undefined && {
        healthProfile: updates.healthProfile,
      }),
      ...(updates.aiPreferences !== undefined && {
        aiPreferences: updates.aiPreferences,
      }),
      ...(updates.foodPersonalisation !== undefined && {
        foodPersonalisation: updates.foodPersonalisation,
      }),
      ...(updates.transitCalibration !== undefined && {
        transitCalibration: updates.transitCalibration,
      }),
      ...(updates.nutritionGoals !== undefined && {
        nutritionGoals: updates.nutritionGoals,
      }),
      ...(updates.foodFavourites !== undefined && {
        foodFavourites: updates.foodFavourites,
      }),
    } as Parameters<typeof ctx.db.insert<"profiles">>[1]);
  },
});

export const getProfile = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireAuth(ctx);
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (!profile) return null;
    return {
      ...profile,
      ...(profile.fluidPresets !== undefined && {
        fluidPresets: normalizeStoredFluidPresets(profile.fluidPresets) ?? [],
      }),
      ...(profile.aiPreferences !== undefined && {
        aiPreferences:
          normalizeStoredAiPreferences(profile.aiPreferences) ??
          profile.aiPreferences,
      }),
    };
  },
});
