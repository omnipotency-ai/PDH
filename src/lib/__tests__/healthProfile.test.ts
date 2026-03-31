import { describe, expect, it } from "vitest";
import { normalizeHealthConditionName, normalizeHealthConditions } from "../healthProfile";

describe("normalizeHealthConditionName", () => {
  it("returns trimmed string for a valid condition", () => {
    expect(normalizeHealthConditionName("Diabetes")).toBe("Diabetes");
  });

  it("trims whitespace from condition names", () => {
    expect(normalizeHealthConditionName("  Diabetes  ")).toBe("Diabetes");
    expect(normalizeHealthConditionName("\tIBD\n")).toBe("IBD/IBS");
  });

  it("returns null for non-string inputs", () => {
    expect(normalizeHealthConditionName(null)).toBeNull();
    expect(normalizeHealthConditionName(undefined)).toBeNull();
    expect(normalizeHealthConditionName(42)).toBeNull();
    expect(normalizeHealthConditionName(true)).toBeNull();
    expect(normalizeHealthConditionName({})).toBeNull();
    expect(normalizeHealthConditionName([])).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(normalizeHealthConditionName("")).toBeNull();
  });

  it("returns null for whitespace-only string", () => {
    expect(normalizeHealthConditionName("   ")).toBeNull();
    expect(normalizeHealthConditionName("\t\n")).toBeNull();
  });

  describe("legacy condition name mappings", () => {
    it('maps "Coeliac disease" to "Celiac disease"', () => {
      expect(normalizeHealthConditionName("Coeliac disease")).toBe("Celiac disease");
    });

    it('maps "IBD / Crohn\'s / Colitis" to "IBD/IBS"', () => {
      expect(normalizeHealthConditionName("IBD / Crohn's / Colitis")).toBe("IBD/IBS");
    });

    it('maps "Diabetes / high blood sugar" to "Diabetes"', () => {
      expect(normalizeHealthConditionName("Diabetes / high blood sugar")).toBe("Diabetes");
    });

    it("does not map partial legacy names", () => {
      expect(normalizeHealthConditionName("Coeliac")).toBe("Coeliac");
      expect(normalizeHealthConditionName("IBD / Crohn's")).toBe("IBD / Crohn's");
      expect(normalizeHealthConditionName("Diabetes /")).toBe("Diabetes /");
    });

    it("does not map legacy names with extra whitespace (exact match after trim)", () => {
      expect(normalizeHealthConditionName(" Coeliac disease ")).toBe("Celiac disease");
      expect(normalizeHealthConditionName(" IBD / Crohn's / Colitis ")).toBe("IBD/IBS");
    });
  });

  it("passes through non-legacy condition names unchanged", () => {
    expect(normalizeHealthConditionName("IBS")).toBe("IBD/IBS");
    expect(normalizeHealthConditionName("GERD")).toBe("GERD");
    expect(normalizeHealthConditionName("Celiac disease")).toBe("Celiac disease");
  });
});

describe("normalizeHealthConditions", () => {
  it("normalizes an array of valid condition strings", () => {
    expect(normalizeHealthConditions(["IBS", "GERD"])).toEqual(["IBD/IBS", "GERD"]);
  });

  it("returns empty array for non-array inputs", () => {
    expect(normalizeHealthConditions(null)).toEqual([]);
    expect(normalizeHealthConditions(undefined)).toEqual([]);
    expect(normalizeHealthConditions("IBS")).toEqual([]);
    expect(normalizeHealthConditions(42)).toEqual([]);
    expect(normalizeHealthConditions({})).toEqual([]);
  });

  it("returns empty array for an empty array", () => {
    expect(normalizeHealthConditions([])).toEqual([]);
  });

  it("filters out invalid entries (non-strings, empty strings)", () => {
    expect(normalizeHealthConditions(["IBS", null, "", undefined, 42, "GERD"])).toEqual([
      "IBD/IBS",
      "GERD",
    ]);
  });

  it("filters out whitespace-only entries", () => {
    expect(normalizeHealthConditions(["IBS", "   ", "\t", "GERD"])).toEqual(["IBD/IBS", "GERD"]);
  });

  it("applies legacy mappings to array entries", () => {
    expect(
      normalizeHealthConditions([
        "Coeliac disease",
        "IBD / Crohn's / Colitis",
        "Diabetes / high blood sugar",
      ]),
    ).toEqual(["Celiac disease", "IBD/IBS", "Diabetes"]);
  });

  it("deduplicates conditions after normalization", () => {
    expect(normalizeHealthConditions(["IBS", "IBS", "GERD"])).toEqual(["IBD/IBS", "GERD"]);
  });

  it("deduplicates legacy mappings that resolve to the same name", () => {
    expect(
      normalizeHealthConditions([
        "Celiac disease",
        "Coeliac disease",
        "IBD",
        "IBD / Crohn's / Colitis",
      ]),
    ).toEqual(["Celiac disease", "IBD/IBS"]);
  });

  it("preserves insertion order after deduplication", () => {
    const result = normalizeHealthConditions(["GERD", "IBS", "GERD", "Celiac disease"]);
    expect(result).toEqual(["GERD", "IBD/IBS", "Celiac disease"]);
  });
});
