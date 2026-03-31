import { useHabits } from "@/hooks/useProfile";
import type { HabitStreakSummary } from "@/lib/habitAggregates";
import type { HabitConfig } from "@/lib/habitTemplates";
import type { SyncedLog } from "@/lib/sync";
import { useCelebrationTrigger } from "./useCelebrationTrigger";
import { useDetailSheetController } from "./useDetailSheetController";
import { useHabitLog } from "./useHabitLog";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UseQuickCaptureOptions {
  afterSave: () => void;
  celebrateGoalComplete: (message: string) => void;
  todayHabitCounts: Record<string, number>;
  todayFluidTotalsByName: Record<string, number>;
  streakSummaries: Record<string, HabitStreakSummary>;
  logs: SyncedLog[];
  todayStart: number;
  todayEnd: number;
  removeSyncedLog: (id: string) => Promise<unknown>;
  removeHabitLog: (habitId: string, at: number) => void;
  /** Called when the user taps "Edit" on a post-log toast. Receives the synced log ID. */
  onRequestEdit: (logId: string) => void;
  captureTimestamp?: number;
  captureStart?: number;
  captureEnd?: number;
  captureOffset?: number;
}

interface QuickCaptureResult {
  handleQuickCaptureTap: (habit: HabitConfig) => Promise<void>;
  handleLogSleepQuickCapture: (habit: HabitConfig, hours: number) => Promise<void>;
  handleLogActivityQuickCapture: (habit: HabitConfig, minutes: number) => Promise<void>;
  handleLogFluid: (
    name: string,
    milliliters: number,
    timestamp?: number,
    skipHabitLog?: boolean,
  ) => Promise<string>;
  handleIncrementHabit: (
    habit: HabitConfig,
    currentCompleted: number,
    timestamp?: number,
  ) => Promise<string>;
  handleLogWeightKg: (weightKg: number) => Promise<void>;
  handleQuickCaptureLongPress: (habit: HabitConfig) => void;
  handleCloseDetailSheet: () => void;

  detailSheetHabit: HabitConfig | null;
  detailDaySummaries: Array<{
    date: string;
    habitId: string;
    totalValue: number;
    isGoodDay: boolean;
  }>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Thin composition hook that combines detail sheet state, celebration triggers,
 * and habit logging handlers into a unified quick-capture interface.
 *
 * The public API is intentionally unchanged from the original monolithic hook
 * so that Track.tsx and other consumers work without modification.
 */
export function useQuickCapture({
  afterSave,
  celebrateGoalComplete,
  todayHabitCounts,
  todayFluidTotalsByName,
  streakSummaries,
  logs,
  todayStart,
  todayEnd,
  removeSyncedLog,
  removeHabitLog,
  onRequestEdit,
  captureTimestamp,
  captureStart,
  captureEnd,
  captureOffset,
}: UseQuickCaptureOptions): QuickCaptureResult {
  const { habits } = useHabits();

  // 1. Detail sheet state (long-press -> open, close)
  const { detailSheetHabit, handleQuickCaptureLongPress, handleCloseDetailSheet } =
    useDetailSheetController({ habits });

  // 2. Celebration trigger (goal threshold detection + message selection)
  const { checkAndCelebrateGoal } = useCelebrationTrigger({
    streakSummaries,
    celebrateGoalComplete,
  });

  // 3. All logging handlers (habits, fluid, sleep, activity, weight)
  const {
    handleQuickCaptureTap,
    handleLogSleepQuickCapture,
    handleLogActivityQuickCapture,
    handleLogFluid,
    handleIncrementHabit,
    handleLogWeightKg,
  } = useHabitLog({
    afterSave,
    todayHabitCounts,
    todayFluidTotalsByName,
    logs,
    todayStart,
    todayEnd,
    removeSyncedLog,
    removeHabitLog,
    onRequestEdit,
    checkAndCelebrateGoal,
    celebrateGoalComplete,
    ...(captureTimestamp !== undefined && { captureTimestamp }),
    ...(captureStart !== undefined && { captureStart }),
    ...(captureEnd !== undefined && { captureEnd }),
    ...(captureOffset !== undefined && { captureOffset }),
  });

  return {
    handleQuickCaptureTap,
    handleLogSleepQuickCapture,
    handleLogActivityQuickCapture,
    handleLogFluid,
    handleIncrementHabit,
    handleLogWeightKg,
    handleQuickCaptureLongPress,
    handleCloseDetailSheet,
    detailSheetHabit,
    // Note: detailDaySummaries is computed in Track.tsx since it depends on daySummaries from useHabitStreaks
    detailDaySummaries: [],
  };
}
