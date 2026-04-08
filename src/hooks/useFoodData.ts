import { FOOD_PORTION_DATA } from "@shared/foodPortionData";
import { FOOD_REGISTRY } from "@shared/foodRegistryData";
import { useQuery } from "convex/react";
import Fuse from "fuse.js";
import { api } from "../../convex/_generated/api";

// Fuse index for static fallback (built once)
const fuse = new Fuse(FOOD_REGISTRY, {
  keys: ["canonical", "examples"],
  threshold: 0.4,
});

export function useFoodSearch(query: string) {
  // Convex query — returns empty until W2 seeds data
  const convexResults = useQuery(
    api.search.unifiedFoodSearch,
    query.length >= 2 ? { query, limit: 30 } : "skip",
  );

  // Static fallback — always available
  const staticResults =
    query.length >= 2
      ? fuse.search(query, { limit: 20 }).map((r) => ({
          canonicalName: r.item.canonical,
          source: "static" as const,
          zone: r.item.zone,
          category: r.item.category,
        }))
      : [];

  // Merge: Convex results first, then static results not already in Convex results
  if (convexResults && convexResults.length > 0) {
    const seen = new Set(convexResults.map((r) => r.canonicalName));
    const backfill = staticResults.filter((r) => !seen.has(r.canonicalName));
    return { results: [...convexResults, ...backfill], isLoading: false };
  }

  return { results: staticResults, isLoading: convexResults === undefined };
}

export function useFoodLookup(canonicalName: string | null) {
  const convexResult = useQuery(api.search.lookupFood, canonicalName ? { canonicalName } : "skip");

  // Static fallback
  const staticEntry = canonicalName
    ? FOOD_REGISTRY.find((e) => e.canonical === canonicalName)
    : null;
  const portionData = canonicalName ? FOOD_PORTION_DATA.get(canonicalName) : null;

  return {
    convex: convexResult,
    static: staticEntry,
    portionData,
    isLoading: convexResult === undefined,
  };
}
