import { create } from "zustand";
import type { HabitLog } from "@/lib/habitTemplates";
import type {
  AiAnalysisStatus,
  BaselineAverages,
  FluidPreset,
  HealthProfile,
  LogDataMap,
  LogEntry,
  LogType,
} from "@/types/domain";

// ---------------------------------------------------------------------------
// Type guards (unchanged — consumed by many modules)
// ---------------------------------------------------------------------------

/** Type guard to narrow a LogEntry by type */
export function isLogType<T extends LogType>(
  log: LogEntry | { type: string; data: unknown },
  type: T,
): log is LogEntry & { type: T; data: LogDataMap[T] } {
  return log.type === type;
}

type NarrowableLog = LogEntry | { type: string; data: unknown };

function createLogTypeGuard<T extends LogType>(type: T) {
  return (log: NarrowableLog): log is LogEntry & { type: T; data: LogDataMap[T] } =>
    isLogType(log, type);
}

/** Type guard for food logs */
export const isFoodLog = createLogTypeGuard("food");

/** Type guard for fluid logs */
export const isFluidLog = createLogTypeGuard("fluid");

/** Type guard for digestion logs */
export const isDigestionLog = createLogTypeGuard("digestion");

/** Type guard for habit logs */
export const isHabitLog = createLogTypeGuard("habit");

/** Type guard for activity logs */
export const isActivityLog = createLogTypeGuard("activity");

/** Type guard for weight logs */
export const isWeightLog = createLogTypeGuard("weight");

// ---------------------------------------------------------------------------
// Re-exported types (consumed by other modules via "@/store")
// ---------------------------------------------------------------------------

export type { HabitConfig, HabitLog } from "@/lib/habitTemplates";
export type { SleepGoal } from "@/lib/streaks";

// ---------------------------------------------------------------------------
// Constants (consumed by settings / fluid forms)
// ---------------------------------------------------------------------------

/** Default drink choices shown beside the built-in water button on Track. */
export const DEFAULT_FLUID_PRESETS: FluidPreset[] = [
  { name: "Aquarius" },
  { name: "Juice" },
  { name: "Green tea" },
];

/** Maximum number of fluid presets the user can configure. */
export const MAX_FLUID_PRESETS = 3;

/** Fluid names that cannot be used as custom presets (reserved for built-in choices). */
export const BLOCKED_FLUID_PRESET_NAMES = new Set(["agua", "other", "water"]);

export const DEFAULT_HEALTH_PROFILE: HealthProfile = {
  gender: "",
  ageYears: null,
  surgeryType: "Ileostomy reversal",
  surgeryTypeOther: "",
  surgeryDate: "",
  height: null,
  startingWeight: null,
  currentWeight: null,
  targetWeight: null,
  comorbidities: [],
  otherConditions: "",
  medications: "",
  supplements: "",
  allergies: "",
  intolerances: "",
  dietaryHistory: "",
  smokingStatus: "",
  smokingCigarettesPerDay: null,
  smokingYears: null,
  alcoholUse: "",
  alcoholAmountPerSession: "",
  alcoholFrequency: "",
  alcoholYearsAtCurrentLevel: null,
  recreationalDrugUse: "",
  recreationalCategories: [],
  recreationalStimulantsFrequency: "",
  recreationalStimulantsYears: null,
  recreationalDepressantsFrequency: "",
  recreationalDepressantsYears: null,
  lifestyleNotes: "",
};

// ---------------------------------------------------------------------------
// AppState — transient UI state only (lost on refresh)
// ---------------------------------------------------------------------------

export interface AppState {
  // Habit logs (in-memory, populated by SyncedLogsContext from Convex)
  habitLogs: HabitLog[];
  addHabitLog: (log: HabitLog) => void;
  setHabitLogs: (logs: HabitLog[]) => void;
  removeHabitLog: (habitId: string, at: number) => void;

  // Baseline averages (computed, in-memory)
  baselineAverages: BaselineAverages | null;
  baselineTodayHash: string | null;
  lastInsightRunHash: string | null;
  setBaselineAverages: (averages: BaselineAverages, todayHash: string) => void;
  markInsightRun: () => void;

  // Analysis status (transient UI)
  aiAnalysisStatus: AiAnalysisStatus;
  aiAnalysisError: string | null;
  setAiAnalysisStatus: (status: AiAnalysisStatus, error?: string) => void;
}

// ---------------------------------------------------------------------------
// Store creation — plain create (no persist middleware)
// ---------------------------------------------------------------------------

export const useStore = create<AppState>()((set) => ({
  // Habit logs
  habitLogs: [],
  addHabitLog: (log) =>
    set((state) => ({
      habitLogs: [...state.habitLogs, log],
    })),
  setHabitLogs: (logs) =>
    set({
      habitLogs: logs,
    }),
  removeHabitLog: (habitId, at) =>
    set((state) => {
      const idx = state.habitLogs.findIndex((log) => log.habitId === habitId && log.at === at);
      if (idx === -1) return state;
      return {
        habitLogs: [...state.habitLogs.slice(0, idx), ...state.habitLogs.slice(idx + 1)],
      };
    }),

  // Baseline averages
  baselineAverages: null,
  baselineTodayHash: null,
  lastInsightRunHash: null,
  setBaselineAverages: (averages, todayHash) =>
    set({ baselineAverages: averages, baselineTodayHash: todayHash }),
  markInsightRun: () =>
    set((state) => ({
      baselineAverages: state.baselineAverages
        ? {
            ...state.baselineAverages,
            lastInsightRunAt: Date.now(),
            changedSinceLastRun: false,
          }
        : null,
      lastInsightRunHash: state.baselineTodayHash,
    })),

  aiAnalysisStatus: "idle",
  aiAnalysisError: null,
  setAiAnalysisStatus: (status, error) =>
    set({ aiAnalysisStatus: status, aiAnalysisError: error ?? null }),
}));
