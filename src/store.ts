import { create } from "zustand";
import type { HabitLog } from "@/lib/habitTemplates";
import type { AiAnalysisStatus, BaselineAverages } from "@/types/domain";

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
