import { useMemo } from "react";
import { useSyncedLogsContext } from "@/contexts/SyncedLogsContext";
import { useMappedAssessments } from "@/hooks/useMappedAssessments";
import { useHabits, useTransitCalibration } from "@/hooks/useProfile";
import { analyzeLogs } from "@/lib/analysis";
import { useAllFoodTrials } from "@/lib/sync";

/**
 * Shared hook that runs `analyzeLogs` over the current synced logs,
 * food trials, habits, transit calibration, and AI assessments.
 *
 * Used by both PatternsPage (database + transit map) and MenuPage (food library).
 */
export function useAnalyzedFoodStats() {
  const { logs } = useSyncedLogsContext();
  const allFoodTrials = useAllFoodTrials();
  const { habits } = useHabits();
  const { transitCalibration } = useTransitCalibration();
  const mappedAssessments = useMappedAssessments();

  const analysis = useMemo(
    () =>
      analyzeLogs(logs, allFoodTrials?.trials ?? [], {
        habits: habits.map((h) => ({ id: h.id, name: h.name })),
        calibration: transitCalibration,
        assessments: mappedAssessments,
      }),
    [allFoodTrials, habits, transitCalibration, mappedAssessments, logs],
  );

  return analysis;
}
