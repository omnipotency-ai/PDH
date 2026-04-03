import { useCallback } from "react";
import { useAddSyncedLog } from "@/lib/sync";

interface UseFoodParsingOptions {
  /** Called after a food log is saved (e.g. to trigger celebrations). */
  afterSave: () => void;
}

export interface FoodParsingState {
  /**
   * Handle food input from the FoodSection form.
   *
   * Saves the raw text immediately with empty items. Server-side processing
   * (registry matching, LLM matching) is triggered automatically by the
   * logs.add mutation scheduler. Optional timestampMs overrides Date.now().
   *
   * The server handles all parsing — callers pass notes + raw text only.
   */
  handleLogFood: (notes: string, rawText: string, timestampMs?: number) => Promise<void>;
}

export function useFoodParsing({ afterSave }: UseFoodParsingOptions): FoodParsingState {
  const addSyncedLog = useAddSyncedLog();

  const handleLogFood = useCallback(
    async (notes: string, rawText: string, timestampMs?: number) => {
      const trimmedNotes = notes.trim() || "";
      const ts = timestampMs ?? Date.now();

      // Save immediately with empty items — server handles all parsing.
      // The logs.add mutation detects rawInput + empty items and schedules
      // processLogInternal for server-side registry + LLM matching.
      await addSyncedLog({
        timestamp: ts,
        type: "food",
        data: {
          rawInput: rawText,
          items: [],
          notes: trimmedNotes,
        },
      });

      afterSave();
    },
    [addSyncedLog, afterSave],
  );

  return {
    handleLogFood,
  };
}
