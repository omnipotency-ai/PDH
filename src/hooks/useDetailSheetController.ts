import { useCallback, useMemo, useState } from "react";
import type { HabitConfig } from "@/lib/habitTemplates";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UseDetailSheetControllerOptions {
  habits: HabitConfig[];
}

interface DetailSheetControllerResult {
  detailSheetHabit: HabitConfig | null;
  handleQuickCaptureLongPress: (habit: HabitConfig) => void;
  handleCloseDetailSheet: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Manages the detail sheet open/close/navigation state for habit long-press.
 * Extracted from useQuickCapture to isolate UI state from logging logic.
 */
export function useDetailSheetController({
  habits,
}: UseDetailSheetControllerOptions): DetailSheetControllerResult {
  const [detailSheetHabitId, setDetailSheetHabitId] = useState<string | null>(null);

  const detailSheetHabit = useMemo(
    () => habits.find((habit) => habit.id === detailSheetHabitId) ?? null,
    [habits, detailSheetHabitId],
  );

  const handleQuickCaptureLongPress = useCallback((habit: HabitConfig) => {
    setDetailSheetHabitId(habit.id);
  }, []);

  const handleCloseDetailSheet = useCallback(() => {
    setDetailSheetHabitId(null);
  }, []);

  return {
    detailSheetHabit,
    handleQuickCaptureLongPress,
    handleCloseDetailSheet,
  };
}
