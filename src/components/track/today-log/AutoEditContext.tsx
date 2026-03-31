import { createContext, useContext } from "react";

interface AutoEditContextValue {
  /** The log entry ID that should auto-open in edit mode. */
  autoEditId: string | null;
  /** Call this after handling the auto-edit to clear the ID. */
  onAutoEditHandled: () => void;
}

const AutoEditContext = createContext<AutoEditContextValue>({
  autoEditId: null,
  onAutoEditHandled: () => {},
});

export const AutoEditProvider = AutoEditContext.Provider;

export function useAutoEdit(): AutoEditContextValue {
  return useContext(AutoEditContext);
}
