import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useAiConfig() {
  const isAiConfigured = useQuery(api.appConfig.hasAiConfigured);

  return {
    isAiConfigured,
    isLoading: isAiConfigured === undefined,
  };
}
