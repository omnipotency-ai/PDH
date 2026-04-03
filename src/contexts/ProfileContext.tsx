import { useMutation, useQuery } from "convex/react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from "react";
import type { HabitConfig } from "@/lib/habitTemplates";
import { getDefaultHabitTemplates } from "@/lib/habitTemplates";
import type { SleepGoal } from "@/lib/streaks";
import { DEFAULT_SLEEP_GOAL } from "@/lib/streaks";
import type { UnitSystem } from "@/lib/units";
import { DEFAULT_HEALTH_PROFILE } from "@/store";
import type {
  AiPreferences,
  FluidPreset,
  FoodPersonalisation,
  HealthProfile,
  NutritionGoals,
  TransitCalibration,
} from "@/types/domain";
import {
  DEFAULT_AI_PREFERENCES,
  DEFAULT_FOOD_PERSONALISATION,
  DEFAULT_NUTRITION_GOALS,
  DEFAULT_TRANSIT_CALIBRATION,
} from "@/types/domain";
import { api } from "../../convex/_generated/api";

// ---------------------------------------------------------------------------
// Default profile values — must match what ensureDefaults() produces in store.ts
// ---------------------------------------------------------------------------

/** All fields are required here — used as fallbacks when server data is missing. */
interface ResolvedProfile {
  unitSystem: UnitSystem;
  habits: HabitConfig[];
  fluidPresets: FluidPreset[];
  sleepGoal: SleepGoal;
  healthProfile: HealthProfile;
  aiPreferences: AiPreferences;
  foodPersonalisation: FoodPersonalisation;
  transitCalibration: TransitCalibration;
  nutritionGoals: NutritionGoals;
  foodFavourites: string[];
}

export const DEFAULT_PROFILE: ResolvedProfile = {
  unitSystem: "metric",
  habits: getDefaultHabitTemplates(),
  fluidPresets: [],
  sleepGoal: { ...DEFAULT_SLEEP_GOAL },
  healthProfile: { ...DEFAULT_HEALTH_PROFILE },
  aiPreferences: { ...DEFAULT_AI_PREFERENCES },
  foodPersonalisation: { ...DEFAULT_FOOD_PERSONALISATION },
  transitCalibration: { ...DEFAULT_TRANSIT_CALIBRATION },
  nutritionGoals: { ...DEFAULT_NUTRITION_GOALS },
  foodFavourites: [],
};

// ---------------------------------------------------------------------------
// Context type
// ---------------------------------------------------------------------------

/** The shape a patching call accepts — all fields optional. */
export type PatchProfileArgs = {
  unitSystem?: UnitSystem;
  habits?: HabitConfig[];
  fluidPresets?: FluidPreset[];
  sleepGoal?: SleepGoal;
  healthProfile?: HealthProfile;
  aiPreferences?: AiPreferences;
  foodPersonalisation?: FoodPersonalisation;
  transitCalibration?: TransitCalibration;
  nutritionGoals?: NutritionGoals;
  foodFavourites?: string[];
};

interface ProfileContextValue {
  /** Merged profile (server data + defaults). Never undefined after load. */
  profile: ResolvedProfile;
  /** True while the initial query is still loading. */
  isLoading: boolean;
  /** Granular patch — only sends the fields you pass. */
  patchProfile: (updates: PatchProfileArgs) => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/**
 * Build a ResolvedProfile from raw Convex data, falling back to defaults.
 * Extracted as a pure function so it can be called from useMemo without
 * needing a closure over component state.
 */
function resolveProfile(
  raw: ReturnType<typeof useQuery<typeof api.logs.getProfile>>,
): ResolvedProfile {
  if (raw === null || raw === undefined) return DEFAULT_PROFILE;
  const hp = raw.healthProfile as HealthProfile | undefined;
  return {
    unitSystem: raw.unitSystem ?? DEFAULT_PROFILE.unitSystem,
    habits: (raw.habits ?? DEFAULT_PROFILE.habits) as HabitConfig[],
    fluidPresets: (raw.fluidPresets ??
      DEFAULT_PROFILE.fluidPresets) as FluidPreset[],
    sleepGoal: raw.sleepGoal ?? DEFAULT_PROFILE.sleepGoal,
    healthProfile: hp ?? DEFAULT_PROFILE.healthProfile,
    aiPreferences: (raw.aiPreferences ??
      DEFAULT_PROFILE.aiPreferences) as AiPreferences,
    foodPersonalisation:
      raw.foodPersonalisation ?? DEFAULT_PROFILE.foodPersonalisation,
    transitCalibration:
      raw.transitCalibration ?? DEFAULT_PROFILE.transitCalibration,
    nutritionGoals:
      (raw.nutritionGoals as NutritionGoals | undefined) ??
      DEFAULT_PROFILE.nutritionGoals,
    foodFavourites:
      (raw.foodFavourites as string[] | undefined) ??
      DEFAULT_PROFILE.foodFavourites,
  };
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const raw = useQuery(api.logs.getProfile);
  const patchMutation = useMutation(api.logs.patchProfile);

  const isLoading = raw === undefined;

  // ---------------------------------------------------------------------------
  // Stabilize the profile reference using structural comparison.
  //
  // Problem: Convex's useQuery returns a new object reference on every
  // re-delivery, even when the underlying data hasn't changed. Since
  // `useMemo(() => ..., [raw])` uses reference equality, this causes a new
  // profile object on every delivery, which in turn triggers re-renders in
  // ALL context consumers — even those that only care about one field.
  //
  // Fix: Compare the resolved profile against the previous one using
  // JSON serialization. Only update the reference when data actually changes.
  // This is safe because ResolvedProfile contains only JSON-serializable
  // primitives, arrays, and plain objects — no functions, dates, or symbols.
  // ---------------------------------------------------------------------------
  const nextProfile = useMemo(() => resolveProfile(raw), [raw]);
  const prevProfileRef = useRef<ResolvedProfile>(DEFAULT_PROFILE);
  const prevHashRef = useRef<string>("");

  // TODO: JSON.stringify on every render is O(n) — could be optimized with
  // a shallow comparison of top-level fields (unitSystem, habits.length, etc.)
  // since ResolvedProfile has a known, flat-ish shape.
  const profile: ResolvedProfile = useMemo(() => {
    const nextHash = JSON.stringify(nextProfile);
    if (nextHash === prevHashRef.current) {
      return prevProfileRef.current;
    }
    prevHashRef.current = nextHash;
    prevProfileRef.current = nextProfile;
    return nextProfile;
  }, [nextProfile]);

  const patchProfile = useCallback(
    async (updates: PatchProfileArgs) => {
      // Build args with conditional spreads so only defined fields are sent.
      // Every field in PatchProfileArgs is optional and matches the Convex
      // patchProfile mutation's args, so the spread produces a valid argument.
      await patchMutation({
        now: Date.now(),
        ...(updates.unitSystem !== undefined && {
          unitSystem: updates.unitSystem,
        }),
        ...(updates.habits !== undefined && { habits: updates.habits }),
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
      });
    },
    [patchMutation],
  );

  const value: ProfileContextValue = useMemo(
    () => ({ profile, isLoading, patchProfile }),
    [profile, isLoading, patchProfile],
  );

  return <ProfileContext value={value}>{children}</ProfileContext>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useProfileContext(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (ctx === null) {
    throw new Error("useProfileContext must be used within ProfileProvider");
  }
  return ctx;
}
