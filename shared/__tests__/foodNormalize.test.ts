import { describe, expect, it } from "vitest";
import {
  formatCanonicalFoodDisplayName,
  formatFoodDisplayName,
  normalizeFoodName,
} from "../foodNormalize";

// ── singularizeWord — "ses"/"xes"/"zes"/"ches"/"shes" branch (line 94) ──────

describe("normalizeFoodName — ses/xes/zes/ches/shes plurals", () => {
  it("singularizes words ending in 'ses'", () => {
    // "sauces" → "sauce" (drops "es")
    expect(normalizeFoodName("sauces")).toBe("sauce");
  });

  it("singularizes words ending in 'xes'", () => {
    // "boxes" → "box"
    expect(normalizeFoodName("boxes")).toBe("box");
  });

  it("singularizes words ending in 'zes'", () => {
    // "zes" ending hits the ses/xes/zes/ches/shes branch, drops "es"
    // "fuzzes" → "fuzz" (4+ chars, ends in "zes")
    expect(normalizeFoodName("fuzzes")).toBe("fuzz");
  });

  it("singularizes words ending in 'ches'", () => {
    // "peaches" → "peach"
    expect(normalizeFoodName("peaches")).toBe("peach");
    expect(normalizeFoodName("sandwiches")).toBe("sandwich");
  });

  it("singularizes words ending in 'shes'", () => {
    // "dishes" → "dish"
    expect(normalizeFoodName("dishes")).toBe("dish");
    expect(normalizeFoodName("squashes")).toBe("squash");
  });
});

// ── singularizeWord — "oes" branch (line 100) ──────────────────────────────

describe("normalizeFoodName — oes plurals", () => {
  it("singularizes words ending in 'oes' not in overrides", () => {
    // "heroes" → "hero" (drops "es")
    expect(normalizeFoodName("heroes")).toBe("hero");
  });

  it("uses override for tomatoes and potatoes", () => {
    // These are in PLURAL_OVERRIDES, so they hit the override path, not line 100
    expect(normalizeFoodName("tomatoes")).toBe("tomato");
    expect(normalizeFoodName("potatoes")).toBe("potato");
  });
});

// ── Additional normalization edge cases ─────────────────────────────────────

describe("normalizeFoodName — edge cases", () => {
  it("returns empty string for empty input", () => {
    expect(normalizeFoodName("")).toBe("");
    expect(normalizeFoodName("   ")).toBe("");
  });

  it("returns empty string when input is only punctuation", () => {
    expect(normalizeFoodName("---")).toBe("");
    expect(normalizeFoodName("///")).toBe("");
  });

  it("handles KEEP_PLURAL words", () => {
    expect(normalizeFoodName("hummus")).toBe("hummus");
    expect(normalizeFoodName("couscous")).toBe("couscous");
    expect(normalizeFoodName("asparagus")).toBe("asparagus");
    expect(normalizeFoodName("broccoli")).toBe("broccoli");
    expect(normalizeFoodName("aioli")).toBe("aioli");
  });

  it("applies synonym mapping", () => {
    expect(normalizeFoodName("mashed potato")).toBe("pureed potato");
    expect(normalizeFoodName("yoghurt")).toBe("yogurt");
    expect(normalizeFoodName("natural yogurt")).toBe("yogurt");
    expect(normalizeFoodName("plain yogurt")).toBe("yogurt");
  });

  it("handles words with 3 or fewer characters without singularizing", () => {
    // Short words are returned as-is by singularizeWord
    expect(normalizeFoodName("tea")).toBe("tea");
    expect(normalizeFoodName("jam")).toBe("jam");
  });

  it("strips multiple filler phrases", () => {
    expect(normalizeFoodName("gluten free bread")).toBe("bread");
    expect(normalizeFoodName("sugar free jelly")).toBe("jelly");
    expect(normalizeFoodName("fat free yogurt")).toBe("yogurt");
    expect(normalizeFoodName("dairy free milk")).toBe("milk");
  });

  it("treats plain cracker as the generic cracker family again", () => {
    expect(normalizeFoodName("plain cracker")).toBe("cracker");
    expect(normalizeFoodName("plain crackers")).toBe("cracker");
    expect(normalizeFoodName("plain rice crackers")).toBe("rice cracker");
    expect(normalizeFoodName("soaked plain cracker")).toBe("soaked cracker");
  });
});

// ── formatFoodDisplayName ───────────────────────────────────────────────────

describe("formatFoodDisplayName", () => {
  it("title-cases each word", () => {
    expect(formatFoodDisplayName("scrambled egg")).toBe("Scrambled Egg");
    expect(formatFoodDisplayName("white rice")).toBe("White Rice");
  });

  it("handles extra whitespace", () => {
    expect(formatFoodDisplayName("  scrambled   egg  ")).toBe("Scrambled Egg");
  });

  it("handles single word", () => {
    expect(formatFoodDisplayName("toast")).toBe("Toast");
  });

  it("handles empty string", () => {
    expect(formatFoodDisplayName("")).toBe("");
    expect(formatFoodDisplayName("   ")).toBe("");
  });
});

describe("formatCanonicalFoodDisplayName", () => {
  it("uses a white-toast label for the toast canonical", () => {
    expect(formatCanonicalFoodDisplayName("toast")).toBe("White Toast");
  });

  it("falls back to standard title-casing for other canonicals", () => {
    expect(formatCanonicalFoodDisplayName("white bread")).toBe("White Bread");
  });
});
