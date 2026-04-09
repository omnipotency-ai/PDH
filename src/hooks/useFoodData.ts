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
  // Query is intentionally skipped (passed "skip") when query < 2 chars.
  // useQuery returns undefined both for "skipped" and "loading" — we must
  // distinguish them ourselves: isLoading is only true when the query was
  // actually dispatched but hasn't resolved yet.
  //
  // NOTE on errors: Convex's useQuery throws errors to the nearest React error
  // boundary — it does NOT return undefined on error. Therefore convexResults
  // being undefined means exactly one of: (a) skipped, or (b) in-flight. The
  // isQueryActive guard correctly distinguishes these two cases. No additional
  // error-state handling is needed here.
  const isQueryActive = query.length >= 2;
  const convexResults = useQuery(
    api.search.unifiedFoodSearch,
    isQueryActive ? { query, limit: 30 } : "skip",
  );

  // Static fallback — always available, used while Convex loads or as backfill.
  // Returning static results while isLoading=true is intentional: callers get
  // immediate (partial) results rather than an empty list during the Convex
  // round-trip. This is not stale data — it's a lower-fidelity response that
  // is clearly marked as source:"static".
  const staticResults = isQueryActive
    ? fuse.search(query, { limit: 20 }).map((r) => ({
        canonicalName: r.item.canonical,
        source: "static" as const,
        zone: r.item.zone,
        category: r.item.category,
      }))
    : [];

  // isLoading is true only when Convex was queried but hasn't responded yet.
  // When the query was skipped (short input), convexResults is undefined but
  // there is nothing in-flight — isLoading must be false in that case.
  const isLoading = isQueryActive && convexResults === undefined;

  // Merge: Convex results first, then static results not already in Convex results.
  // While Convex is loading, staticResults serve as an immediate partial response;
  // callers can use isLoading to show a spinner alongside them if desired.
  if (convexResults && convexResults.length > 0) {
    const seen = new Set(convexResults.map((r) => r.canonicalName));
    const backfill = staticResults.filter((r) => !seen.has(r.canonicalName));
    return { results: [...convexResults, ...backfill], isLoading: false };
  }

  return { results: staticResults, isLoading };
}

export function useFoodLookup(canonicalName: string | null) {
  // Query is intentionally skipped when canonicalName is null/empty.
  // isLoading is true only when the query was actually dispatched and is in-flight.
  //
  // NOTE on errors: Convex's useQuery throws errors to the nearest React error
  // boundary — it does NOT return undefined on error. Therefore convexResult
  // being undefined means exactly one of: (a) skipped (null canonicalName), or
  // (b) in-flight. The isQueryActive guard correctly distinguishes these two
  // cases. No additional error-state handling is needed here.
  const isQueryActive = canonicalName != null && canonicalName.length > 0;
  const convexResult = useQuery(
    api.search.lookupFood,
    isQueryActive ? { canonicalName } : "skip",
  );

  // Static fallback — always available alongside (or instead of) Convex data.
  // Returning static data while convexResult is undefined (in-flight) is
  // intentional: callers get a lower-fidelity but immediate response rather
  // than a blank state. This is not stale data — static and Convex data are
  // both returned and callers decide which to prefer via the `convex` field.
  const staticEntry = canonicalName
    ? FOOD_REGISTRY.find((e) => e.canonical === canonicalName)
    : null;
  const portionData = canonicalName
    ? FOOD_PORTION_DATA.get(canonicalName)
    : null;

  return {
    convex: convexResult,
    static: staticEntry ?? null,
    portionData: portionData ?? null,
    // isLoading is false when the query was skipped (null canonicalName).
    isLoading: isQueryActive && convexResult === undefined,
  };
}
