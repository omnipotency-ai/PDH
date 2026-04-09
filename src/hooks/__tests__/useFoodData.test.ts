import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock useQuery before importing the hook
const mockUseQuery = vi.fn();
vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

// Must import after mock setup
const { useFoodSearch, useFoodLookup } = await import("../useFoodData");

describe("useFoodSearch", () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
  });

  it("returns static results when Convex returns undefined (loading)", () => {
    mockUseQuery.mockReturnValue(undefined);
    const { results, isLoading } = useFoodSearch("toast");
    expect(isLoading).toBe(true);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].canonicalName).toBe("toast");
    expect(results[0].source).toBe("static");
  });

  it("returns static results when Convex returns empty array", () => {
    mockUseQuery.mockReturnValue([]);
    const { results, isLoading } = useFoodSearch("toast");
    expect(isLoading).toBe(false);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].source).toBe("static");
  });

  it("merges Convex + static results without duplicates", () => {
    mockUseQuery.mockReturnValue([
      { canonicalName: "toast", source: "user", productName: "My Toast" },
    ]);
    const { results } = useFoodSearch("toast");
    // Should have the Convex result first
    expect(results[0]).toEqual({
      canonicalName: "toast",
      source: "user",
      productName: "My Toast",
    });
    // Static results should not include "toast" again
    const toastResults = results.filter((r) => r.canonicalName === "toast");
    expect(toastResults).toHaveLength(1);
  });

  it("returns empty results and isLoading=false for queries shorter than 2 chars", () => {
    mockUseQuery.mockReturnValue(undefined);
    const { results, isLoading } = useFoodSearch("t");
    expect(results).toEqual([]);
    // Query is skipped (not dispatched) for short inputs, so nothing is in-flight.
    // isLoading must be false even though useQuery returns undefined in both
    // "skipped" and "loading" states — we distinguish them via isQueryActive.
    expect(isLoading).toBe(false);
  });
});

describe("useFoodLookup", () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
  });

  it("returns static fallback when Convex returns undefined", () => {
    mockUseQuery.mockReturnValue(undefined);
    const result = useFoodLookup("toast");
    expect(result.isLoading).toBe(true);
    expect(result.static?.canonical).toBe("toast");
    expect(result.portionData?.caloriesPer100g).toBe(313);
  });

  it("returns static fallback when Convex returns null", () => {
    mockUseQuery.mockReturnValue(null);
    const result = useFoodLookup("toast");
    expect(result.isLoading).toBe(false);
    expect(result.convex).toBeNull();
    expect(result.static?.canonical).toBe("toast");
  });

  it("skips query when canonicalName is null", () => {
    mockUseQuery.mockReturnValue(undefined);
    const result = useFoodLookup(null);
    expect(result.static).toBeNull();
    expect(result.portionData).toBeNull();
  });
});
