import { describe, expect, it } from "vitest";
import {
  CANONICAL_FOOD_NAMES,
  FOOD_GROUPS,
  FOOD_LINES,
  FOOD_REGISTRY,
  getFoodEntry,
  getFoodGroup,
  getFoodLine,
  getFoodsByLine,
  getFoodsByZone,
  getFoodZone,
  getGroupDisplayName,
  getLineDisplayName,
  getLinesByGroup,
  isCanonicalFood,
} from "../foodRegistry";

// ── CANONICAL_FOOD_NAMES ────────────────────────────────────────────────────

describe("CANONICAL_FOOD_NAMES", () => {
  it("is a non-empty set containing all registry canonicals", () => {
    expect(CANONICAL_FOOD_NAMES.size).toBeGreaterThan(0);
    expect(CANONICAL_FOOD_NAMES.size).toBe(FOOD_REGISTRY.length);
  });

  it("contains known canonicals", () => {
    expect(CANONICAL_FOOD_NAMES.has("toast")).toBe(true);
    expect(CANONICAL_FOOD_NAMES.has("egg")).toBe(true);
    expect(CANONICAL_FOOD_NAMES.has("white rice")).toBe(true);
  });

  it("does not contain non-canonical names", () => {
    expect(CANONICAL_FOOD_NAMES.has("scrambled eggs")).toBe(false);
    expect(CANONICAL_FOOD_NAMES.has("")).toBe(false);
  });
});

// ── isCanonicalFood ─────────────────────────────────────────────────────────

describe("isCanonicalFood", () => {
  it("returns true for canonical names", () => {
    expect(isCanonicalFood("toast")).toBe(true);
    expect(isCanonicalFood("egg")).toBe(true);
    expect(isCanonicalFood("ripe banana")).toBe(true);
  });

  it("returns false for non-canonical names", () => {
    expect(isCanonicalFood("scrambled eggs")).toBe(false);
    expect(isCanonicalFood("not a food")).toBe(false);
    expect(isCanonicalFood("")).toBe(false);
  });
});

// ── getFoodEntry ────────────────────────────────────────────────────────────

describe("getFoodEntry", () => {
  it("returns the registry entry for a known canonical", () => {
    const entry = getFoodEntry("toast");
    if (entry === undefined) throw new Error("expected entry for 'toast'");
    expect(entry.canonical).toBe("toast");
    expect(entry.zone).toBeDefined();
    expect(entry.group).toBeDefined();
    expect(entry.line).toBeDefined();
  });

  it("returns undefined for unknown canonicals", () => {
    expect(getFoodEntry("not a food")).toBeUndefined();
    expect(getFoodEntry("")).toBeUndefined();
  });

  it("returns entries with valid examples arrays", () => {
    const entry = getFoodEntry("egg");
    if (entry === undefined) throw new Error("expected entry for 'egg'");
    expect(Array.isArray(entry.examples)).toBe(true);
    expect(entry.examples.length).toBeGreaterThan(0);
  });
});

// ── getFoodZone ─────────────────────────────────────────────────────────────

describe("getFoodZone", () => {
  it("returns zone 1 for clear broth", () => {
    expect(getFoodZone("clear broth")).toBe(1);
  });

  it("returns zone 2 for grilled white meat", () => {
    expect(getFoodZone("grilled white meat")).toBe(2);
  });

  it("returns zone 3 for garlic", () => {
    expect(getFoodZone("garlic")).toBe(3);
  });

  it("returns undefined for unknown foods", () => {
    expect(getFoodZone("not a food")).toBeUndefined();
  });
});

// ── getFoodsByZone ──────────────────────────────────────────────────────────

describe("getFoodsByZone", () => {
  it("returns non-empty arrays for all zones", () => {
    const zone1 = getFoodsByZone(1);
    const zone2 = getFoodsByZone(2);
    const zone3 = getFoodsByZone(3);
    expect(zone1.length).toBeGreaterThan(0);
    expect(zone2.length).toBeGreaterThan(0);
    expect(zone3.length).toBeGreaterThan(0);
  });

  it("only returns entries matching the requested zone", () => {
    const zone1 = getFoodsByZone(1);
    for (const entry of zone1) {
      expect(entry.zone).toBe(1);
    }
  });

  it("returns all zone entries (sum equals registry size)", () => {
    const total = getFoodsByZone(1).length + getFoodsByZone(2).length + getFoodsByZone(3).length;
    expect(total).toBe(FOOD_REGISTRY.length);
  });
});

// ── getFoodGroup / getFoodLine ──────────────────────────────────────────────

describe("getFoodGroup", () => {
  it("returns the group for a known canonical", () => {
    const group = getFoodGroup("egg");
    expect(group).toBeDefined();
    expect(FOOD_GROUPS).toContain(group);
  });

  it("returns undefined for unknown canonicals", () => {
    expect(getFoodGroup("not a food")).toBeUndefined();
  });
});

describe("getFoodLine", () => {
  it("returns the line for a known canonical", () => {
    const line = getFoodLine("egg");
    expect(line).toBeDefined();
    expect(FOOD_LINES).toContain(line);
  });

  it("returns undefined for unknown canonicals", () => {
    expect(getFoodLine("not a food")).toBeUndefined();
  });
});

// ── getFoodsByLine ──────────────────────────────────────────────────────────

describe("getFoodsByLine", () => {
  it("returns entries for a valid line", () => {
    const entries = getFoodsByLine("grains");
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(entry.line).toBe("grains");
    }
  });

  it("returns entries sorted by lineOrder", () => {
    const entries = getFoodsByLine("grains");
    for (let i = 1; i < entries.length; i++) {
      expect(entries[i].lineOrder).toBeGreaterThanOrEqual(entries[i - 1].lineOrder);
    }
  });

  it("returns empty array for a line with no entries", () => {
    // Cast to test with a non-existent line value
    const entries = getFoodsByLine("nonexistent" as never);
    expect(entries).toHaveLength(0);
  });
});

// ── getLinesByGroup ─────────────────────────────────────────────────────────

describe("getLinesByGroup", () => {
  it("returns lines for protein group", () => {
    const lines = getLinesByGroup("protein");
    expect(lines).toContain("meat_fish");
    expect(lines).toContain("eggs_dairy");
    expect(lines).toContain("vegetable_protein");
  });

  it("returns lines for carbs group", () => {
    const lines = getLinesByGroup("carbs");
    expect(lines).toContain("grains");
    expect(lines).toContain("vegetables");
    expect(lines).toContain("fruit");
  });

  it("returns lines for fats group", () => {
    const lines = getLinesByGroup("fats");
    expect(lines).toContain("oils");
    expect(lines).toContain("dairy_fats");
    expect(lines).toContain("nuts_seeds");
  });

  it("returns lines for seasoning group", () => {
    const lines = getLinesByGroup("seasoning");
    expect(lines).toContain("sauces_condiments");
    expect(lines).toContain("herbs_spices");
  });
});

// ── Display name functions ──────────────────────────────────────────────────

describe("getLineDisplayName", () => {
  it("returns human-readable names for all lines", () => {
    expect(getLineDisplayName("meat_fish")).toBe("Meat & Fish");
    expect(getLineDisplayName("eggs_dairy")).toBe("Eggs & Dairy");
    expect(getLineDisplayName("vegetable_protein")).toBe("Vegetable Protein");
    expect(getLineDisplayName("grains")).toBe("Grains");
    expect(getLineDisplayName("vegetables")).toBe("Vegetables");
    expect(getLineDisplayName("fruit")).toBe("Fruit");
    expect(getLineDisplayName("oils")).toBe("Oils");
    expect(getLineDisplayName("dairy_fats")).toBe("Dairy Fats");
    expect(getLineDisplayName("nuts_seeds")).toBe("Nuts & Seeds");
    expect(getLineDisplayName("sauces_condiments")).toBe("Sauces & Condiments");
    expect(getLineDisplayName("herbs_spices")).toBe("Herbs & Spices");
  });
});

describe("getGroupDisplayName", () => {
  it("returns human-readable names for all groups", () => {
    expect(getGroupDisplayName("protein")).toBe("Protein");
    expect(getGroupDisplayName("carbs")).toBe("Carbs");
    expect(getGroupDisplayName("fats")).toBe("Fats");
    expect(getGroupDisplayName("seasoning")).toBe("Seasoning");
  });
});

// ── FOOD_GROUPS / FOOD_LINES constants ──────────────────────────────────────

describe("FOOD_GROUPS", () => {
  it("contains exactly 4 groups", () => {
    expect(FOOD_GROUPS).toHaveLength(4);
    expect(FOOD_GROUPS).toContain("protein");
    expect(FOOD_GROUPS).toContain("carbs");
    expect(FOOD_GROUPS).toContain("fats");
    expect(FOOD_GROUPS).toContain("seasoning");
  });
});

describe("FOOD_LINES", () => {
  it("contains exactly 11 lines", () => {
    expect(FOOD_LINES).toHaveLength(11);
  });
});
