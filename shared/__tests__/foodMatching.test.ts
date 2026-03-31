import { describe, expect, it } from "vitest";
import {
  createFoodMatcherContext,
  type FoodMatchCandidate,
  fuzzySearchFoodCandidates,
  getFoodEmbeddingSourceHash,
  type PreprocessedFoodPhrase,
  preprocessMealText,
  routeFoodMatchConfidence,
  searchFoodDocuments,
} from "../foodMatching";

describe("preprocessMealText", () => {
  it("splits on commas, with, and Spanish y while preserving quantities", () => {
    expect(
      preprocessMealText("2 slices of toast with butter y jam, soup").map((phrase) => ({
        parsedName: phrase.parsedName,
        quantity: phrase.quantity,
        unit: phrase.unit,
      })),
    ).toEqual([
      { parsedName: "toast", quantity: 2, unit: "sl" },
      { parsedName: "butter", quantity: null, unit: null },
      { parsedName: "jam", quantity: null, unit: null },
      { parsedName: "soup", quantity: null, unit: null },
    ]);
  });

  it("normalizes accents for Spanish and Catalan input", () => {
    const [phrase] = preprocessMealText("plàtano muy maduro");
    expect(phrase?.normalizedName).toBe("platano muy maduro");
  });

  it("returns empty array for empty string", () => {
    expect(preprocessMealText("")).toEqual([]);
  });

  it("returns empty array for whitespace-only input", () => {
    expect(preprocessMealText("   ")).toEqual([]);
    expect(preprocessMealText("\t\n  ")).toEqual([]);
  });

  it("handles single word input", () => {
    const result = preprocessMealText("toast");
    expect(result).toHaveLength(1);
    expect(result[0].parsedName).toBe("toast");
    expect(result[0].quantity).toBeNull();
    expect(result[0].unit).toBeNull();
  });

  it("returns empty array for emoji-only input", () => {
    // Emojis are stripped by normalization, resulting in empty normalizedName
    const result = preprocessMealText("🍕🌮🥑");
    expect(result).toEqual([]);
  });

  it("returns empty array for delimiter-only input", () => {
    expect(preprocessMealText("and, with")).toEqual([]);
    expect(preprocessMealText(", , ,")).toEqual([]);
    expect(preprocessMealText("and with and")).toEqual([]);
  });
});

describe("createFoodMatcherContext", () => {
  it("lets user aliases override canonical/example exact matches", () => {
    const context = createFoodMatcherContext([
      {
        aliasText: "toast",
        normalizedAlias: "toast",
        canonicalName: "sweet biscuit",
        userId: "user_123",
      },
    ]);

    const [candidate] = fuzzySearchFoodCandidates("toast", context);
    expect(candidate?.canonicalName).toBe("sweet biscuit");
    expect(candidate?.resolver).toBe("alias");
  });

  it("supports short manual search queries without falling below Fuse min length", () => {
    const context = createFoodMatcherContext([]);
    const results = searchFoodDocuments("to", context, { limit: 10 });

    expect(results.some((document) => document.canonicalName === "toast")).toBe(true);
  });

  it("changes embedding source hashes when the embedding text changes", () => {
    expect(getFoodEmbeddingSourceHash("Food: toast")).not.toBe(
      getFoodEmbeddingSourceHash("Food: toast. Examples: sourdough"),
    );
  });
});

// Helper to build a synthetic candidate for confidence routing tests
function makeSyntheticCandidate(
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

// Helper to build a synthetic phrase for confidence routing tests
function makeSyntheticPhrase(overrides?: Partial<PreprocessedFoodPhrase>): PreprocessedFoodPhrase {
  return {
    rawPhrase: "test food",
    parsedName: "test food",
    normalizedName: "test food",
    quantity: null,
    unit: null,
    quantityText: null,
    ...overrides,
  };
}

describe("routeFoodMatchConfidence", () => {
  it("routes strong exact/alias matches to high confidence", () => {
    const context = createFoodMatcherContext([]);
    const [phrase] = preprocessMealText("toast");
    if (phrase === undefined)
      throw new Error("expected at least one phrase from preprocessMealText");
    const candidates = fuzzySearchFoodCandidates("toast", context);
    const route = routeFoodMatchConfidence(phrase, candidates);

    expect(route.level).toBe("high");
    expect(route.topCandidate?.canonicalName).toBe("toast");
  });

  it("routes medium confidence when top candidate is between 0.56 and 0.86", () => {
    const phrase = makeSyntheticPhrase();
    const candidates = [
      makeSyntheticCandidate({
        canonicalName: "toast",
        combinedConfidence: 0.7,
      }),
      makeSyntheticCandidate({
        canonicalName: "bread",
        combinedConfidence: 0.3,
      }),
    ];

    const route = routeFoodMatchConfidence(phrase, candidates);
    expect(route.level).toBe("medium");
    expect(route.topCandidate?.canonicalName).toBe("toast");
    expect(route.topCandidate?.combinedConfidence).toBe(0.7);
  });

  it("routes low confidence when top candidate is below 0.56", () => {
    const phrase = makeSyntheticPhrase();
    const candidates = [
      makeSyntheticCandidate({
        canonicalName: "toast",
        combinedConfidence: 0.4,
      }),
      makeSyntheticCandidate({
        canonicalName: "bread",
        combinedConfidence: 0.2,
      }),
    ];

    const route = routeFoodMatchConfidence(phrase, candidates);
    expect(route.level).toBe("low");
    expect(route.topCandidate?.canonicalName).toBe("toast");
  });

  it("routes low confidence with null topCandidate for zero candidates", () => {
    const phrase = makeSyntheticPhrase();
    const route = routeFoodMatchConfidence(phrase, []);

    expect(route.level).toBe("low");
    expect(route.topCandidate).toBeNull();
    expect(route.candidates).toEqual([]);
  });
});
