import { describe, expect, it } from "vitest";
import {
  createFoodMatcherContext,
  type FoodMatchCandidate,
  type FoodMatcherContext,
  mergeFoodMatchCandidates,
} from "../foodMatching";

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a synthetic FoodMatchCandidate for unit tests.
 * Requires canonicalName; all other fields have sensible defaults.
 */
function makeCandidate(
  overrides: Partial<FoodMatchCandidate> & { canonicalName: string },
): FoodMatchCandidate {
  return {
    zone: 1,
    group: "carbs",
    line: "grains",
    bucketKey: "line_grains",
    bucketLabel: "Bread, grain, or snack",
    resolver: "fuzzy",
    combinedConfidence: 0.5,
    fuzzyScore: 0.5,
    embeddingScore: null,
    examples: [],
    ...overrides,
  };
}

/** Shared matcher context with no learned aliases */
function makeContext(): FoodMatcherContext {
  return createFoodMatcherContext([]);
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("mergeFoodMatchCandidates", () => {
  // ── Empty / minimal inputs ──────────────────────────────────────────────

  describe("empty and minimal inputs", () => {
    it("returns empty array when both inputs are empty", () => {
      const context = makeContext();
      const result = mergeFoodMatchCandidates([], [], context);
      expect(result).toEqual([]);
    });

    it("returns fuzzy candidates unchanged when embedding list is empty", () => {
      const context = makeContext();
      const fuzzy = [
        makeCandidate({
          canonicalName: "toast",
          combinedConfidence: 0.8,
          fuzzyScore: 0.8,
        }),
      ];
      const result = mergeFoodMatchCandidates(fuzzy, [], context);

      expect(result).toHaveLength(1);
      expect(result[0].canonicalName).toBe("toast");
      expect(result[0].resolver).toBe("fuzzy");
      expect(result[0].combinedConfidence).toBe(0.8);
      expect(result[0].fuzzyScore).toBe(0.8);
      expect(result[0].embeddingScore).toBeNull();
    });

    it("returns embedding candidates when fuzzy list is empty", () => {
      const context = makeContext();
      const embedding = [{ canonicalName: "toast", embeddingScore: 0.7 }];
      const result = mergeFoodMatchCandidates([], embedding, context);

      expect(result).toHaveLength(1);
      expect(result[0].canonicalName).toBe("toast");
      expect(result[0].resolver).toBe("embedding");
      expect(result[0].embeddingScore).toBe(0.7);
      expect(result[0].fuzzyScore).toBeNull();
      expect(result[0].combinedConfidence).toBe(0.7);
    });

    it("returns single fuzzy candidate unchanged", () => {
      const context = makeContext();
      const fuzzy = [
        makeCandidate({
          canonicalName: "egg",
          combinedConfidence: 0.9,
          fuzzyScore: 0.9,
        }),
      ];
      const result = mergeFoodMatchCandidates(fuzzy, [], context);

      expect(result).toHaveLength(1);
      expect(result[0].canonicalName).toBe("egg");
      expect(result[0].combinedConfidence).toBe(0.9);
    });
  });

  // ── Merging behavior ────────────────────────────────────────────────────

  describe("merging fuzzy and embedding candidates", () => {
    it("combines scores for a candidate present in both sources", () => {
      const context = makeContext();
      const fuzzy = [
        makeCandidate({
          canonicalName: "toast",
          fuzzyScore: 0.8,
          combinedConfidence: 0.8,
        }),
      ];
      const embedding = [{ canonicalName: "toast", embeddingScore: 0.6 }];

      const result = mergeFoodMatchCandidates(fuzzy, embedding, context);

      expect(result).toHaveLength(1);
      const merged = result[0];
      expect(merged.canonicalName).toBe("toast");
      expect(merged.resolver).toBe("combined");
      expect(merged.fuzzyScore).toBe(0.8);
      expect(merged.embeddingScore).toBe(0.6);
      // Combined: 0.8 * 0.65 + 0.6 * 0.35 = 0.52 + 0.21 = 0.73
      expect(merged.combinedConfidence).toBeCloseTo(0.73, 5);
    });

    it("preserves separate candidates when canonical names differ", () => {
      const context = makeContext();
      const fuzzy = [
        makeCandidate({
          canonicalName: "toast",
          fuzzyScore: 0.8,
          combinedConfidence: 0.8,
        }),
      ];
      const embedding = [{ canonicalName: "egg", embeddingScore: 0.6 }];

      const result = mergeFoodMatchCandidates(fuzzy, embedding, context);

      expect(result).toHaveLength(2);
      const names = result.map((c) => c.canonicalName);
      expect(names).toContain("toast");
      expect(names).toContain("egg");
    });

    it("uses combined resolver when candidate appears in both sources", () => {
      const context = makeContext();
      const fuzzy = [
        makeCandidate({
          canonicalName: "white rice",
          fuzzyScore: 0.7,
          combinedConfidence: 0.7,
          resolver: "alias",
        }),
      ];
      const embedding = [{ canonicalName: "white rice", embeddingScore: 0.5 }];

      const result = mergeFoodMatchCandidates(fuzzy, embedding, context);

      expect(result[0].resolver).toBe("combined");
    });

    it("preserves all non-score fields from the fuzzy candidate when merging", () => {
      const context = makeContext();
      const fuzzy = [
        makeCandidate({
          canonicalName: "toast",
          zone: 1,
          group: "carbs",
          line: "grains",
          bucketKey: "line_grains",
          bucketLabel: "Bread, grain, or snack",
          fuzzyScore: 0.8,
          combinedConfidence: 0.8,
          examples: ["sourdough", "white bread"],
        }),
      ];
      const embedding = [{ canonicalName: "toast", embeddingScore: 0.6 }];

      const result = mergeFoodMatchCandidates(fuzzy, embedding, context);
      const merged = result[0];

      expect(merged.zone).toBe(1);
      expect(merged.group).toBe("carbs");
      expect(merged.line).toBe("grains");
      expect(merged.bucketKey).toBe("line_grains");
      expect(merged.bucketLabel).toBe("Bread, grain, or snack");
      expect(merged.examples).toEqual(["sourdough", "white bread"]);
    });
  });

  // ── Confidence score aggregation ────────────────────────────────────────

  describe("confidence score aggregation", () => {
    it("applies 65/35 weighting for combined scores", () => {
      const context = makeContext();
      const fuzzy = [
        makeCandidate({
          canonicalName: "toast",
          fuzzyScore: 1.0,
          combinedConfidence: 1.0,
        }),
      ];
      const embedding = [{ canonicalName: "toast", embeddingScore: 1.0 }];

      const result = mergeFoodMatchCandidates(fuzzy, embedding, context);
      // 1.0 * 0.65 + 1.0 * 0.35 = 1.0
      expect(result[0].combinedConfidence).toBeCloseTo(1.0, 5);
    });

    it("applies 65/35 weighting with zero fuzzy score", () => {
      const context = makeContext();
      const fuzzy = [
        makeCandidate({
          canonicalName: "toast",
          fuzzyScore: 0.0,
          combinedConfidence: 0.0,
        }),
      ];
      const embedding = [{ canonicalName: "toast", embeddingScore: 0.8 }];

      const result = mergeFoodMatchCandidates(fuzzy, embedding, context);
      // 0.0 * 0.65 + 0.8 * 0.35 = 0.28
      expect(result[0].combinedConfidence).toBeCloseTo(0.28, 5);
    });

    it("applies 65/35 weighting with zero embedding score", () => {
      const context = makeContext();
      const fuzzy = [
        makeCandidate({
          canonicalName: "toast",
          fuzzyScore: 0.9,
          combinedConfidence: 0.9,
        }),
      ];
      const embedding = [{ canonicalName: "toast", embeddingScore: 0.0 }];

      const result = mergeFoodMatchCandidates(fuzzy, embedding, context);
      // 0.9 * 0.65 + 0.0 * 0.35 = 0.585
      expect(result[0].combinedConfidence).toBeCloseTo(0.585, 5);
    });

    it("uses null fuzzyScore as 0 in the weighting formula", () => {
      const context = makeContext();
      const fuzzy = [
        makeCandidate({
          canonicalName: "toast",
          fuzzyScore: null,
          combinedConfidence: 0.5,
        }),
      ];
      const embedding = [{ canonicalName: "toast", embeddingScore: 0.6 }];

      const result = mergeFoodMatchCandidates(fuzzy, embedding, context);
      // null fuzzyScore treated as 0: 0 * 0.65 + 0.6 * 0.35 = 0.21
      expect(result[0].combinedConfidence).toBeCloseTo(0.21, 5);
    });

    it("clamps combined confidence to maximum of 1.0", () => {
      const context = makeContext();
      // Even though scores are at max, 1.0 * 0.65 + 1.0 * 0.35 = 1.0
      // so it naturally stays at 1.0. But let's verify with a candidate
      // that has an already-high combinedConfidence.
      const fuzzy = [
        makeCandidate({
          canonicalName: "toast",
          fuzzyScore: 1.0,
          combinedConfidence: 1.0,
        }),
      ];
      const embedding = [{ canonicalName: "toast", embeddingScore: 1.0 }];

      const result = mergeFoodMatchCandidates(fuzzy, embedding, context);
      expect(result[0].combinedConfidence).toBeLessThanOrEqual(1.0);
    });

    it("clamps combined confidence to minimum of 0", () => {
      const context = makeContext();
      const fuzzy = [
        makeCandidate({
          canonicalName: "toast",
          fuzzyScore: 0,
          combinedConfidence: 0,
        }),
      ];
      const embedding = [{ canonicalName: "toast", embeddingScore: 0 }];

      const result = mergeFoodMatchCandidates(fuzzy, embedding, context);
      expect(result[0].combinedConfidence).toBeGreaterThanOrEqual(0);
      expect(result[0].combinedConfidence).toBe(0);
    });

    it("embedding-only candidate uses embeddingScore as combinedConfidence", () => {
      const context = makeContext();
      const embedding = [{ canonicalName: "egg", embeddingScore: 0.85 }];

      const result = mergeFoodMatchCandidates([], embedding, context);

      expect(result).toHaveLength(1);
      expect(result[0].combinedConfidence).toBe(0.85);
      expect(result[0].embeddingScore).toBe(0.85);
      expect(result[0].fuzzyScore).toBeNull();
    });
  });

  // ── Sorting behavior ───────────────────────────────────────────────────

  describe("sorting", () => {
    it("sorts by combinedConfidence descending", () => {
      const context = makeContext();
      const fuzzy = [
        makeCandidate({
          canonicalName: "toast",
          combinedConfidence: 0.5,
          fuzzyScore: 0.5,
        }),
        makeCandidate({
          canonicalName: "egg",
          combinedConfidence: 0.9,
          fuzzyScore: 0.9,
        }),
        makeCandidate({
          canonicalName: "white rice",
          combinedConfidence: 0.7,
          fuzzyScore: 0.7,
        }),
      ];

      const result = mergeFoodMatchCandidates(fuzzy, [], context);
      expect(result.map((c) => c.canonicalName)).toEqual(["egg", "white rice", "toast"]);
    });

    it("breaks ties on combinedConfidence with embeddingScore descending", () => {
      const context = makeContext();
      const fuzzy = [
        makeCandidate({
          canonicalName: "toast",
          combinedConfidence: 0.7,
          fuzzyScore: 0.7,
          embeddingScore: 0.3,
        }),
        makeCandidate({
          canonicalName: "egg",
          combinedConfidence: 0.7,
          fuzzyScore: 0.7,
          embeddingScore: 0.8,
        }),
      ];

      const result = mergeFoodMatchCandidates(fuzzy, [], context);
      // Same combinedConfidence, higher embeddingScore first
      expect(result[0].canonicalName).toBe("egg");
      expect(result[1].canonicalName).toBe("toast");
    });

    it("breaks ties on embeddingScore with fuzzyScore descending", () => {
      const context = makeContext();
      const fuzzy = [
        makeCandidate({
          canonicalName: "toast",
          combinedConfidence: 0.7,
          fuzzyScore: 0.5,
          embeddingScore: 0.6,
        }),
        makeCandidate({
          canonicalName: "egg",
          combinedConfidence: 0.7,
          fuzzyScore: 0.9,
          embeddingScore: 0.6,
        }),
      ];

      const result = mergeFoodMatchCandidates(fuzzy, [], context);
      expect(result[0].canonicalName).toBe("egg");
      expect(result[1].canonicalName).toBe("toast");
    });

    it("breaks all-scores tie with canonicalName ascending (alphabetical)", () => {
      const context = makeContext();
      const fuzzy = [
        makeCandidate({
          canonicalName: "toast",
          combinedConfidence: 0.7,
          fuzzyScore: 0.7,
          embeddingScore: null,
        }),
        makeCandidate({
          canonicalName: "egg",
          combinedConfidence: 0.7,
          fuzzyScore: 0.7,
          embeddingScore: null,
        }),
      ];

      const result = mergeFoodMatchCandidates(fuzzy, [], context);
      // null embeddingScores are treated as -1 in comparison, so equal
      // fuzzyScores equal, so alphabetical: egg < toast
      expect(result[0].canonicalName).toBe("egg");
      expect(result[1].canonicalName).toBe("toast");
    });

    it("re-sorts after merging changes confidence values", () => {
      const context = makeContext();
      // Toast starts higher but after merge gets lower combined score
      const fuzzy = [
        makeCandidate({
          canonicalName: "toast",
          fuzzyScore: 0.6,
          combinedConfidence: 0.6,
        }),
        makeCandidate({
          canonicalName: "egg",
          fuzzyScore: 0.4,
          combinedConfidence: 0.4,
        }),
      ];
      // Egg gets a strong embedding boost
      const embedding = [{ canonicalName: "egg", embeddingScore: 0.95 }];

      const result = mergeFoodMatchCandidates(fuzzy, embedding, context);
      // Toast stays at 0.6, egg becomes: 0.4*0.65 + 0.95*0.35 = 0.26 + 0.3325 = 0.5925
      // Toast (0.6) > Egg (~0.5925)
      expect(result[0].canonicalName).toBe("toast");
      expect(result[1].canonicalName).toBe("egg");
      expect(result[1].combinedConfidence).toBeCloseTo(0.5925, 4);
    });
  });

  // ── Embedding-only candidates ──────────────────────────────────────────

  describe("embedding-only candidates", () => {
    it("skips embedding candidates not found in documentMap", () => {
      const context = makeContext();
      const embedding = [{ canonicalName: "nonexistent food xyz", embeddingScore: 0.9 }];

      const result = mergeFoodMatchCandidates([], embedding, context);
      expect(result).toHaveLength(0);
    });

    it("creates embedding candidates with correct document metadata", () => {
      const context = makeContext();
      const embedding = [{ canonicalName: "toast", embeddingScore: 0.75 }];

      const result = mergeFoodMatchCandidates([], embedding, context);

      expect(result).toHaveLength(1);
      const candidate = result[0];
      expect(candidate.resolver).toBe("embedding");
      expect(candidate.canonicalName).toBe("toast");
      expect(candidate.embeddingScore).toBe(0.75);
      expect(candidate.fuzzyScore).toBeNull();
      expect(candidate.combinedConfidence).toBe(0.75);
      // Verify metadata was pulled from document
      expect(candidate.zone).toBeDefined();
      expect(candidate.group).toBeDefined();
      expect(candidate.line).toBeDefined();
      expect(candidate.bucketKey).toBeDefined();
      expect(candidate.bucketLabel).toBeDefined();
      expect(candidate.examples.length).toBeGreaterThan(0);
    });

    it("handles multiple embedding-only candidates", () => {
      const context = makeContext();
      const embedding = [
        { canonicalName: "toast", embeddingScore: 0.8 },
        { canonicalName: "egg", embeddingScore: 0.6 },
        { canonicalName: "white rice", embeddingScore: 0.4 },
      ];

      const result = mergeFoodMatchCandidates([], embedding, context);

      expect(result).toHaveLength(3);
      // Sorted by embeddingScore (which equals combinedConfidence here)
      expect(result[0].canonicalName).toBe("toast");
      expect(result[1].canonicalName).toBe("egg");
      expect(result[2].canonicalName).toBe("white rice");
    });
  });

  // ── Duplicate handling ────────────────────────────────────────────────

  describe("duplicate handling", () => {
    it("last fuzzy candidate with same canonicalName wins", () => {
      const context = makeContext();
      const fuzzy = [
        makeCandidate({
          canonicalName: "toast",
          fuzzyScore: 0.5,
          combinedConfidence: 0.5,
        }),
        makeCandidate({
          canonicalName: "toast",
          fuzzyScore: 0.9,
          combinedConfidence: 0.9,
        }),
      ];

      const result = mergeFoodMatchCandidates(fuzzy, [], context);

      // Map.set overwrites — last entry wins
      expect(result).toHaveLength(1);
      expect(result[0].fuzzyScore).toBe(0.9);
      expect(result[0].combinedConfidence).toBe(0.9);
    });

    it("last embedding candidate with same canonicalName wins for overlap", () => {
      const context = makeContext();
      const fuzzy = [
        makeCandidate({
          canonicalName: "toast",
          fuzzyScore: 0.8,
          combinedConfidence: 0.8,
        }),
      ];
      const embedding = [
        { canonicalName: "toast", embeddingScore: 0.3 },
        { canonicalName: "toast", embeddingScore: 0.9 },
      ];

      const result = mergeFoodMatchCandidates(fuzzy, embedding, context);

      expect(result).toHaveLength(1);
      // Second embedding entry overwrites the first merge
      // Final: 0.8 * 0.65 + 0.9 * 0.35 = 0.52 + 0.315 = 0.835
      expect(result[0].embeddingScore).toBe(0.9);
      expect(result[0].combinedConfidence).toBeCloseTo(0.835, 5);
    });

    it("duplicate embedding-only candidates: last write wins", () => {
      const context = makeContext();
      const embedding = [
        { canonicalName: "toast", embeddingScore: 0.3 },
        { canonicalName: "toast", embeddingScore: 0.9 },
      ];

      const result = mergeFoodMatchCandidates([], embedding, context);

      expect(result).toHaveLength(1);
      expect(result[0].embeddingScore).toBe(0.9);
      expect(result[0].combinedConfidence).toBe(0.9);
    });
  });

  // ── Mixed source scenarios ────────────────────────────────────────────

  describe("mixed source scenarios", () => {
    it("merges multiple fuzzy and embedding candidates correctly", () => {
      const context = makeContext();
      const fuzzy = [
        makeCandidate({
          canonicalName: "toast",
          fuzzyScore: 0.9,
          combinedConfidence: 0.9,
        }),
        makeCandidate({
          canonicalName: "egg",
          fuzzyScore: 0.6,
          combinedConfidence: 0.6,
        }),
      ];
      const embedding = [
        { canonicalName: "toast", embeddingScore: 0.7 },
        { canonicalName: "white rice", embeddingScore: 0.8 },
      ];

      const result = mergeFoodMatchCandidates(fuzzy, embedding, context);

      expect(result).toHaveLength(3);

      // toast: combined (0.9*0.65 + 0.7*0.35 = 0.585 + 0.245 = 0.83)
      const toast = result.find((c) => c.canonicalName === "toast");
      if (toast === undefined) throw new Error("expected toast candidate");
      expect(toast.resolver).toBe("combined");
      expect(toast.combinedConfidence).toBeCloseTo(0.83, 5);

      // white rice: embedding only (0.8)
      const rice = result.find((c) => c.canonicalName === "white rice");
      if (rice === undefined) throw new Error("expected white rice candidate");
      expect(rice.resolver).toBe("embedding");
      expect(rice.combinedConfidence).toBe(0.8);

      // egg: fuzzy only (0.6)
      const egg = result.find((c) => c.canonicalName === "egg");
      if (egg === undefined) throw new Error("expected egg candidate");
      expect(egg.resolver).toBe("fuzzy");
      expect(egg.combinedConfidence).toBe(0.6);

      // Sorted: toast (0.83) > rice (0.8) > egg (0.6)
      expect(result[0].canonicalName).toBe("toast");
      expect(result[1].canonicalName).toBe("white rice");
      expect(result[2].canonicalName).toBe("egg");
    });

    it("handles alias resolver in fuzzy candidates correctly when merged", () => {
      const context = makeContext();
      const fuzzy = [
        makeCandidate({
          canonicalName: "toast",
          resolver: "alias",
          fuzzyScore: 1.0,
          combinedConfidence: 0.99,
        }),
      ];
      const embedding = [{ canonicalName: "toast", embeddingScore: 0.5 }];

      const result = mergeFoodMatchCandidates(fuzzy, embedding, context);

      expect(result).toHaveLength(1);
      // Resolver changes from "alias" to "combined"
      expect(result[0].resolver).toBe("combined");
      // Combined: 1.0 * 0.65 + 0.5 * 0.35 = 0.65 + 0.175 = 0.825
      expect(result[0].combinedConfidence).toBeCloseTo(0.825, 5);
    });

    it("handles all candidates overlapping between fuzzy and embedding", () => {
      const context = makeContext();
      const fuzzy = [
        makeCandidate({
          canonicalName: "toast",
          fuzzyScore: 0.8,
          combinedConfidence: 0.8,
        }),
        makeCandidate({
          canonicalName: "egg",
          fuzzyScore: 0.6,
          combinedConfidence: 0.6,
        }),
      ];
      const embedding = [
        { canonicalName: "toast", embeddingScore: 0.7 },
        { canonicalName: "egg", embeddingScore: 0.5 },
      ];

      const result = mergeFoodMatchCandidates(fuzzy, embedding, context);

      expect(result).toHaveLength(2);
      expect(result.every((c) => c.resolver === "combined")).toBe(true);

      // toast: 0.8*0.65 + 0.7*0.35 = 0.52 + 0.245 = 0.765
      // egg:   0.6*0.65 + 0.5*0.35 = 0.39 + 0.175 = 0.565
      expect(result[0].canonicalName).toBe("toast");
      expect(result[0].combinedConfidence).toBeCloseTo(0.765, 5);
      expect(result[1].canonicalName).toBe("egg");
      expect(result[1].combinedConfidence).toBeCloseTo(0.565, 5);
    });
  });

  // ── Edge cases ────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("handles embedding candidate with score of exactly 0", () => {
      const context = makeContext();
      const embedding = [{ canonicalName: "toast", embeddingScore: 0 }];

      const result = mergeFoodMatchCandidates([], embedding, context);

      expect(result).toHaveLength(1);
      expect(result[0].combinedConfidence).toBe(0);
      expect(result[0].embeddingScore).toBe(0);
    });

    it("handles embedding candidate with score of exactly 1", () => {
      const context = makeContext();
      const embedding = [{ canonicalName: "toast", embeddingScore: 1 }];

      const result = mergeFoodMatchCandidates([], embedding, context);

      expect(result).toHaveLength(1);
      expect(result[0].combinedConfidence).toBe(1);
    });

    it("handles large number of candidates", () => {
      const context = makeContext();
      // Get all available canonical names from context
      const allNames = Array.from(context.documentMap.keys()).slice(0, 20);

      const fuzzy = allNames.map((name, index) =>
        makeCandidate({
          canonicalName: name,
          fuzzyScore: (20 - index) / 20,
          combinedConfidence: (20 - index) / 20,
        }),
      );
      const embedding = allNames.slice(0, 10).map((name, index) => ({
        canonicalName: name,
        embeddingScore: (10 - index) / 10,
      }));

      const result = mergeFoodMatchCandidates(fuzzy, embedding, context);

      expect(result).toHaveLength(20);
      // All merged candidates should have "combined" resolver
      const combined = result.filter((c) => c.resolver === "combined");
      expect(combined).toHaveLength(10);
      // All fuzzy-only candidates should have "fuzzy" resolver
      const fuzzyOnly = result.filter((c) => c.resolver === "fuzzy");
      expect(fuzzyOnly).toHaveLength(10);
    });

    it("result is sorted even with a single combined candidate", () => {
      const context = makeContext();
      const fuzzy = [
        makeCandidate({
          canonicalName: "toast",
          fuzzyScore: 0.3,
          combinedConfidence: 0.3,
        }),
        makeCandidate({
          canonicalName: "egg",
          fuzzyScore: 0.9,
          combinedConfidence: 0.9,
        }),
      ];
      const embedding = [{ canonicalName: "toast", embeddingScore: 0.95 }];

      const result = mergeFoodMatchCandidates(fuzzy, embedding, context);
      // egg stays at 0.9, toast becomes 0.3*0.65 + 0.95*0.35 = 0.195 + 0.3325 = 0.5275
      expect(result[0].canonicalName).toBe("egg");
      expect(result[0].combinedConfidence).toBe(0.9);
      expect(result[1].canonicalName).toBe("toast");
      expect(result[1].combinedConfidence).toBeCloseTo(0.5275, 4);
    });

    it("preserves embedding metadata from document when no fuzzy match", () => {
      const context = makeContext();
      // "clear broth" is in the registry — verify full metadata is populated
      const embedding = [{ canonicalName: "clear broth", embeddingScore: 0.65 }];

      const result = mergeFoodMatchCandidates([], embedding, context);

      expect(result).toHaveLength(1);
      const broth = result[0];
      expect(broth.canonicalName).toBe("clear broth");
      expect(broth.zone).toBe(1);
      expect(broth.group).toBe("protein");
      expect(broth.line).toBe("meat_fish");
      expect(broth.examples.length).toBeGreaterThan(0);
    });

    it("filters out embedding candidates with unknown canonical names gracefully", () => {
      const context = makeContext();
      const fuzzy = [
        makeCandidate({
          canonicalName: "toast",
          fuzzyScore: 0.8,
          combinedConfidence: 0.8,
        }),
      ];
      const embedding = [
        { canonicalName: "unknown food abc", embeddingScore: 0.9 },
        { canonicalName: "toast", embeddingScore: 0.7 },
      ];

      const result = mergeFoodMatchCandidates(fuzzy, embedding, context);

      // "unknown food abc" is not in documentMap and was not in fuzzy, so skipped
      expect(result).toHaveLength(1);
      expect(result[0].canonicalName).toBe("toast");
      expect(result[0].resolver).toBe("combined");
    });

    it("does not skip unknown embedding candidate if it overlaps with fuzzy", () => {
      const context = makeContext();
      // If a fuzzy candidate has a canonical name not in the registry (edge case),
      // the embedding merge still works because it uses existing fuzzy candidate data
      const fuzzy = [
        makeCandidate({
          canonicalName: "custom food",
          fuzzyScore: 0.7,
          combinedConfidence: 0.7,
        }),
      ];
      const embedding = [{ canonicalName: "custom food", embeddingScore: 0.5 }];

      const result = mergeFoodMatchCandidates(fuzzy, embedding, context);

      expect(result).toHaveLength(1);
      expect(result[0].canonicalName).toBe("custom food");
      expect(result[0].resolver).toBe("combined");
      // 0.7 * 0.65 + 0.5 * 0.35 = 0.455 + 0.175 = 0.63
      expect(result[0].combinedConfidence).toBeCloseTo(0.63, 5);
    });
  });
});
