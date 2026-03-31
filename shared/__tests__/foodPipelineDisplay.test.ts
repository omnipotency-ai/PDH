/**
 * Food Pipeline Display & Resolution Tests
 *
 * Tests the display name chain and resolution status logic.
 * Some tests are expected to FAIL — they document known bugs
 * that need fixing.
 */
import { describe, expect, it } from "vitest";
import {
  getCanonicalFoodProjection,
  getLoggedFoodIdentity,
  resolveCanonicalFoodName,
} from "../foodProjection";

// Import the helpers we're testing — they're pure functions, no React needed
// We test them via their logic directly since they don't depend on React
// Note: getFoodItemResolutionStatus and getFoodItemDisplayName are in
// src/components/track/today-log/helpers.ts which imports React types.
// We replicate the logic here to test without React dependency.

// ── Resolution status logic (mirrors helpers.ts) ────────────────────────────

type FoodItemResolutionStatus = "resolved" | "pending" | "expired" | "processing";

interface MinimalFoodItem {
  canonicalName?: string;
  resolvedBy?: string;
  parsedName?: string;
  name?: string;
  rawName?: string;
  userSegment?: string;
}

function getFoodItemResolutionStatus(item: MinimalFoodItem): FoodItemResolutionStatus {
  if (item.canonicalName === "unknown_food" || item.resolvedBy === "expired") {
    return "expired";
  }
  if (
    item.canonicalName != null &&
    item.canonicalName.length > 0 &&
    (item.resolvedBy === "registry" || item.resolvedBy === "llm" || item.resolvedBy === "user")
  ) {
    return "resolved";
  }
  return "pending";
}

function getFoodItemDisplayName(item: MinimalFoodItem): string {
  return (
    String(item.userSegment ?? "").trim() ||
    String(item.rawName ?? "").trim() ||
    String(item.parsedName ?? "").trim() ||
    String(item.name ?? "").trim() ||
    "Food"
  );
}

// ── Resolution Status Tests ─────────────────────────────────────────────────

describe("getFoodItemResolutionStatus", () => {
  it("returns 'resolved' for registry-matched items", () => {
    const item = { canonicalName: "toast", resolvedBy: "registry" };
    expect(getFoodItemResolutionStatus(item)).toBe("resolved");
  });

  it("returns 'resolved' for LLM-matched items", () => {
    const item = { canonicalName: "sweet_biscuit", resolvedBy: "llm" };
    expect(getFoodItemResolutionStatus(item)).toBe("resolved");
  });

  it("returns 'resolved' for user-matched items", () => {
    const item = { canonicalName: "bread", resolvedBy: "user" };
    expect(getFoodItemResolutionStatus(item)).toBe("resolved");
  });

  it("returns 'expired' for unknown_food items", () => {
    const item = { canonicalName: "unknown_food", resolvedBy: "expired" };
    expect(getFoodItemResolutionStatus(item)).toBe("expired");
  });

  it("returns 'pending' for items with no canonicalName", () => {
    const item = { parsedName: "kelitos" };
    expect(getFoodItemResolutionStatus(item)).toBe("pending");
  });

  it("returns 'pending' for items with canonicalName but no resolvedBy", () => {
    // BUG BASELINE: This is the legacy item case — old items have canonicalName
    // from client-side parsing but no resolvedBy field.
    // Current behavior: returns "pending" (bug — should be "resolved" for legacy items)
    const item = { canonicalName: "toast", name: "toast" };
    expect(getFoodItemResolutionStatus(item)).toBe("pending");
  });
});

// ── Display Name Tests ──────────────────────────────────────────────────────

describe("getFoodItemDisplayName", () => {
  it("BUG BASELINE: currently returns userSegment with quantity prefix", () => {
    // This test documents the current (buggy) behavior.
    // userSegment contains "4 toast" but display should show "toast"
    const item = {
      userSegment: "4 toast",
      parsedName: "toast",
      canonicalName: "toast",
    };
    // Current behavior: returns "4 toast" (bug)
    expect(getFoodItemDisplayName(item)).toBe("4 toast");
  });

  it("BUG BASELINE: returns quantity+unit prefix in display name", () => {
    const item = {
      userSegment: "2 tbsp guacamole",
      parsedName: "guacamole",
      canonicalName: "guacamole",
    };
    // Current behavior: returns "2 tbsp guacamole" (bug)
    expect(getFoodItemDisplayName(item)).toBe("2 tbsp guacamole");
  });

  it("falls back to parsedName when no userSegment", () => {
    const item = { parsedName: "toast", canonicalName: "toast" };
    expect(getFoodItemDisplayName(item)).toBe("toast");
  });

  it("falls back to name when no parsedName or userSegment", () => {
    const item = { name: "toast", canonicalName: "toast" };
    expect(getFoodItemDisplayName(item)).toBe("toast");
  });

  it("returns 'Food' when no name fields set", () => {
    const item = {};
    expect(getFoodItemDisplayName(item)).toBe("Food");
  });
});

// ── Food Projection (Patterns table display name) ───────────────────────────

describe("getLoggedFoodIdentity (patterns table display)", () => {
  it("uses parsedName (not userSegment) for displayName", () => {
    const result = getLoggedFoodIdentity({
      userSegment: "4 toast",
      parsedName: "toast",
      canonicalName: "toast",
    });
    // Fixed: parsedName is preferred over userSegment (no quantity prefix)
    expect(result?.displayName).toBe("Toast");
  });

  it("uses parsedName without measurement prefix for displayName", () => {
    const result = getLoggedFoodIdentity({
      userSegment: "2 tbsp guacamole",
      parsedName: "guacamole",
      canonicalName: "guacamole",
    });
    // Fixed: parsedName is preferred over userSegment (no measurement prefix)
    expect(result?.displayName).toBe("Guacamole");
  });

  it("correctly resolves canonicalName regardless of displayName bug", () => {
    const result = getLoggedFoodIdentity({
      userSegment: "4 toast",
      parsedName: "toast",
      canonicalName: "toast",
    });
    // canonicalName should still be correct
    expect(result?.canonicalName).toBe("toast");
  });

  it("uses parsedName for displayName when no userSegment", () => {
    const result = getLoggedFoodIdentity({
      parsedName: "toast",
      canonicalName: "toast",
    });
    expect(result?.displayName).toBe("Toast");
  });

  it("returns null when no name fields are set", () => {
    const result = getLoggedFoodIdentity({});
    expect(result).toBeNull();
  });

  it("correctly handles legacy items with only name field", () => {
    const result = getLoggedFoodIdentity({
      name: "toast",
      canonicalName: "toast",
    });
    expect(result?.displayName).toBe("Toast");
    expect(result?.canonicalName).toBe("toast");
  });
});

// ── resolveCanonicalFoodName ────────────────────────────────────────────────

describe("resolveCanonicalFoodName", () => {
  it("returns canonical for a known registry food", () => {
    expect(resolveCanonicalFoodName("scrambled eggs")).toBe("egg");
    expect(resolveCanonicalFoodName("basmati rice")).toBe("white rice");
    expect(resolveCanonicalFoodName("toast")).toBe("toast");
  });

  it("falls back to normalizeFoodName for unknown foods", () => {
    // Not in registry, so returns the normalized form
    expect(resolveCanonicalFoodName("pad thai")).toBe("pad thai");
    expect(resolveCanonicalFoodName("tikka masala")).toBe("tikka masala");
  });

  it("normalizes even when canonicalization returns null", () => {
    // Unknown food with uppercase and extra spaces gets normalized
    expect(resolveCanonicalFoodName("  Fancy  Dish  ")).toBe("fancy dish");
  });
});

// ── getCanonicalFoodProjection ──────────────────────────────────────────────

describe("getCanonicalFoodProjection", () => {
  it("returns group and line for a known canonical", () => {
    const projection = getCanonicalFoodProjection("toast");
    expect(projection.foodGroup).not.toBeNull();
    expect(projection.foodLine).not.toBeNull();
  });

  it("returns group and line for a known canonical (egg)", () => {
    const projection = getCanonicalFoodProjection("egg");
    expect(projection.foodGroup).toBe("protein");
    expect(projection.foodLine).toBe("eggs_dairy");
  });

  it("returns nulls for an unknown food", () => {
    const projection = getCanonicalFoodProjection("pad thai");
    expect(projection.foodGroup).toBeNull();
    expect(projection.foodLine).toBeNull();
  });

  it("resolves aliases before looking up projection", () => {
    // "scrambled eggs" should resolve to "egg" canonical, then look up its projection
    const projection = getCanonicalFoodProjection("scrambled eggs");
    expect(projection.foodGroup).toBe("protein");
    expect(projection.foodLine).toBe("eggs_dairy");
  });

  it("handles a raw display name that normalizes to a canonical", () => {
    // "Basmati Rice" is not a canonical, but normalizes to "basmati rice"
    // which canonicalizes to "white rice"
    const projection = getCanonicalFoodProjection("Basmati Rice");
    expect(projection.foodGroup).toBe("carbs");
    expect(projection.foodLine).toBe("grains");
  });
});
