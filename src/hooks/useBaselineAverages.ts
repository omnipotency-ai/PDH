/**
 * Hook that computes and caches baseline averages + 24h deltas.
 *
 * Recomputes when:
 * - logs change (new synced data from Convex)
 * - habitLogs change (new habit taps)
 * - todayHabitCounts or todayFluidTotalsByName change
 *
 * The result is persisted in the Zustand store so it survives page reloads
 * and is available to the AI insight job without re-computation.
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useHabits } from "@/hooks/useProfile";
import { buildTodayHash, computeBaselineAverages } from "@/lib/baselineAverages";
import type { HabitConfig, HabitLog } from "@/lib/habitTemplates";
import type { SyncedLog } from "@/lib/sync";
import { useStore } from "@/store";
import type { BaselineAverages } from "@/types/domain";

/** Debounce delay before recomputing after the last data change (5 seconds). */
const RECOMPUTE_DEBOUNCE_MS = 5_000;

interface UseBaselineAveragesInput {
  /** All synced logs from Convex. */
  logs: SyncedLog[];
  /** Today's per-habit counts (from useDayStats or computeTodayHabitCounts). */
  todayHabitCounts: Record<string, number>;
  /** Today's fluid totals by normalized name (from useDayStats). */
  todayFluidTotalsByName: Record<string, number>;
  /** Today's total fluid ml (from useDayStats). */
  todayTotalFluidMl: number;
}

export function useBaselineAverages(input: UseBaselineAveragesInput): BaselineAverages | null {
  const { logs, todayHabitCounts, todayFluidTotalsByName, todayTotalFluidMl } = input;

  const { habits } = useHabits();
  const habitLogs = useStore((s) => s.habitLogs);
  const storedBaseline = useStore((s) => s.baselineAverages);
  const storedTodayHash = useStore((s) => s.baselineTodayHash);
  const setBaselineAverages = useStore((s) => s.setBaselineAverages);

  const lastLogsFingerprintRef = useRef<string>("");
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lastInsightRunHash = useStore((s) => s.lastInsightRunHash);

  // Build the current today hash to detect changes
  const currentTodayHash = useMemo(
    () => buildTodayHash(todayHabitCounts, todayFluidTotalsByName, todayTotalFluidMl),
    [todayHabitCounts, todayFluidTotalsByName, todayTotalFluidMl],
  );

  // Fingerprint that changes when historical logs arrive (e.g. Convex sync).
  // Captures both count changes and new tail entries.
  const logsFingerprint = `${logs.length}-${logs[logs.length - 1]?.id ?? ""}`;

  // Determine if we need to recompute
  const needsRecompute = useMemo(() => {
    // No stored baseline at all — must compute
    if (storedBaseline === null) return true;
    // Today's data changed since last computation
    if (currentTodayHash !== storedTodayHash) return true;
    // Historical logs changed (new synced data from Convex, e.g. weight from yesterday)
    if (logsFingerprint !== lastLogsFingerprintRef.current) return true;
    return false;
  }, [storedBaseline, currentTodayHash, storedTodayHash, logsFingerprint]);

  // Store all computation inputs in refs so the debounced callback always
  // reads the latest values, regardless of when it fires.
  const inputsRef = useRef({
    logs,
    habits,
    habitLogs,
    todayHabitCounts,
    todayFluidTotalsByName,
    todayTotalFluidMl,
    lastInsightRunAt: storedBaseline?.lastInsightRunAt ?? null,
    lastInsightRunHash,
    logsFingerprint,
    currentTodayHash,
  });
  // Keep refs fresh on every render (no effect needed, refs are synchronous)
  inputsRef.current = {
    logs,
    habits,
    habitLogs,
    todayHabitCounts,
    todayFluidTotalsByName,
    todayTotalFluidMl,
    lastInsightRunAt: storedBaseline?.lastInsightRunAt ?? null,
    lastInsightRunHash,
    logsFingerprint,
    currentTodayHash,
  };

  // Stable reference to setBaselineAverages (Zustand selectors are stable)
  const setBaselineRef = useRef(setBaselineAverages);
  setBaselineRef.current = setBaselineAverages;

  const executeComputation = useCallback(() => {
    const snap = inputsRef.current;
    const result = runComputation(
      snap.logs,
      snap.habits,
      snap.habitLogs,
      snap.todayHabitCounts,
      snap.todayFluidTotalsByName,
      snap.todayTotalFluidMl,
      snap.lastInsightRunAt,
      snap.lastInsightRunHash,
    );
    lastLogsFingerprintRef.current = snap.logsFingerprint;
    setBaselineRef.current(result, snap.currentTodayHash);
  }, []);

  // Debounced recomputation: when data changes rapidly, only the LAST
  // change triggers computation after RECOMPUTE_DEBOUNCE_MS of quiet.
  // First computation (storedBaseline === null) fires immediately.
  useEffect(() => {
    if (!needsRecompute) {
      return () => {
        if (pendingTimerRef.current !== null) {
          clearTimeout(pendingTimerRef.current);
          pendingTimerRef.current = null;
        }
      };
    }

    // First computation ever — compute immediately, don't debounce
    if (storedBaseline === null) {
      executeComputation();
      return;
    }

    // Clear any previously scheduled recomputation
    if (pendingTimerRef.current !== null) {
      clearTimeout(pendingTimerRef.current);
    }

    // Schedule recomputation after debounce window
    pendingTimerRef.current = setTimeout(() => {
      pendingTimerRef.current = null;
      executeComputation();
    }, RECOMPUTE_DEBOUNCE_MS);

    return () => {
      if (pendingTimerRef.current !== null) {
        clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
    };
  }, [needsRecompute, storedBaseline, executeComputation]);

  return storedBaseline;
}

/** Pure computation wrapper to keep the effect body clean. */
function runComputation(
  logs: SyncedLog[],
  habits: HabitConfig[],
  habitLogs: HabitLog[],
  todayHabitCounts: Record<string, number>,
  todayFluidTotalsByName: Record<string, number>,
  todayTotalFluidMl: number,
  lastInsightRunAt: number | null,
  lastInsightRunHash: string | null,
): BaselineAverages {
  return computeBaselineAverages({
    logs,
    habits,
    habitLogs,
    todayHabitCounts,
    todayFluidTotalsByName,
    todayTotalFluidMl,
    lastInsightRunAt,
    lastInsightRunHash,
  });
}
