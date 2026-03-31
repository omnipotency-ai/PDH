import { describe, expect, it } from "vitest";
import { buildRegistryVocabularyPrompt, postProcessCanonical } from "../foodLlmCanonicalization";

describe("buildRegistryVocabularyPrompt", () => {
  it("includes full example lists instead of truncating after five examples", () => {
    const prompt = buildRegistryVocabularyPrompt();

    expect(prompt).toContain("bone broth");
    expect(prompt).toContain("consommé");
  });

  it("includes registry notes so the LLM sees the clinical distinction", () => {
    const prompt = buildRegistryVocabularyPrompt();

    expect(prompt).toContain("Smooth nut butters only");
    expect(prompt).toContain("Fermented soy broth");
  });
});

describe("postProcessCanonical", () => {
  it("resolves corrected registry aliases", () => {
    expect(postProcessCanonical("nut butter")).toEqual({
      canonical: "smooth nut butter",
      zone: 2,
      isNew: false,
    });
  });

  it("keeps exact registry canonicals after trimming and normalization", () => {
    expect(postProcessCanonical("  legumes  ")).toEqual({
      canonical: "legumes",
      zone: 3,
      isNew: false,
    });
  });

  it("normalizes unknown foods to new zone 3 canonicals", () => {
    expect(postProcessCanonical("Dragon Fruit Smoothie")).toEqual({
      canonical: "dragon fruit smoothie",
      zone: 3,
      isNew: true,
    });
  });

  it("rejects blank canonical names", () => {
    expect(() => postProcessCanonical("   ")).toThrow(
      "postProcessCanonical requires a non-empty canonical name.",
    );
  });
});
