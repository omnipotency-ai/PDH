import { createContext, useContext } from "react";
import type { LogUpdateData } from "./types";

// ── Actions context ─────────────────────────────────────────────────
// Provides delete and save callbacks to all TodayLog children,
// eliminating the need to pass onDelete/onSave through every group row.

interface TodayLogActionsValue {
  onDelete: (id: string) => Promise<void>;
  onSave: (id: string, data: LogUpdateData, timestamp?: number) => Promise<void>;
}

const TodayLogActionsContext = createContext<TodayLogActionsValue | null>(null);

export const TodayLogActionsProvider = TodayLogActionsContext.Provider;

export function useTodayLogActions(): TodayLogActionsValue {
  const ctx = useContext(TodayLogActionsContext);
  if (ctx === null) {
    throw new Error("useTodayLogActions must be used within TodayLogActionsProvider");
  }
  return ctx;
}
