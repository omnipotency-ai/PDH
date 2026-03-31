import { createContext, type ReactNode, useContext } from "react";
import { useApiKey } from "@/hooks/useApiKey";

type ApiKeyContextValue = ReturnType<typeof useApiKey>;

const ApiKeyContext = createContext<ApiKeyContextValue | null>(null);

export function ApiKeyProvider({ children }: { children: ReactNode }) {
  const value = useApiKey();
  return <ApiKeyContext value={value}>{children}</ApiKeyContext>;
}

export function useApiKeyContext(): ApiKeyContextValue {
  const ctx = useContext(ApiKeyContext);
  if (!ctx) throw new Error("useApiKeyContext must be used within ApiKeyProvider");
  return ctx;
}
