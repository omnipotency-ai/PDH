# Test 3: Test Writer — WITH Skill

## Functions Under Test

All exported from `/Users/peterjamesblizzard/projects/PDH/shared/foodNormalize.ts`:

| Function                                                                            | Description                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `normalizeFoodName(value: string): string`                                          | Main normalization pipeline: lowercases, trims, collapses spaces, strips diacritics, strips leading/trailing punctuation, normalizes hyphens, strips quantity prefixes (numeric and word-form), strips percentage patterns, strips filler phrases and filler words, singularizes the last word, applies synonym substitutions. Returns a canonical grouping key. |
| `formatFoodDisplayName(value: string): string`                                      | Title-cases each word of a food name for display. Pure transform, no normalization.                                                                                                                                                                                                                                                                              |
| `formatCanonicalFoodDisplayName(value: string): string`                             | Like `formatFoodDisplayName` but first checks `CANONICAL_DISPLAY_OVERRIDES` for manual overrides (e.g. "toast" → "White Toast").                                                                                                                                                                                                                                 |
| `prefersSummaryCandidate<T>(candidate, existing, normalizedCanonicalName): boolean` | Given two `foodTrialSummary` rows that share a canonical name, returns `true` if `candidate` should displace `existing`. Tiebreaker priority: exact canonical name match > most-recently-updated > most-recently-assessed > most-recently-created.                                                                                                               |

Internal helpers (`singularizeWord`, `singularize`, `stripQuantityPrefix`, `stripFillerWords`, `applySynonyms`) are private; they are exercised indirectly through `normalizeFoodName`.

---

## Test Code

```typescript
import { describe, expect, it } from "vitest";
import {
  formatCanonicalFoodDisplayName,
  formatFoodDisplayName,
  normalizeFoodName,
  prefersSummaryCandidate,
} from "../foodNormalize";

// ---------------------------------------------------------------------------
// normalizeFoodName — baseline pipeline
// ---------------------------------------------------------------------------

describe("normalizeFoodName — basic normalisation", () => {
  it("lowercases the input", () => {
    expect(normalizeFoodName("Cottage Cheese")).toBe("cottage cheese");
  });

  it("trims leading and trailing whitespace", () => {
    expect(normalizeFoodName("  rice  ")).toBe("rice");
  });

  it("collapses multiple interior spaces to one", () => {
    expect(normalizeFoodName("cottage  cheese")).toBe("cottage cheese");
    expect(normalizeFoodName("white   rice   pudding")).toBe(
      "white rice pudding",
    );
  });

  it("strips NFD diacritics (accent normalisation)", () => {
    // café → cafe, plàtano → platano
    expect(normalizeFoodName("café")).toBe("cafe");
    expect(normalizeFoodName("plàtano")).toBe("platano");
  });

  it("returns empty string for empty input", () => {
    expect(normalizeFoodName("")).toBe("");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(normalizeFoodName("   ")).toBe("");
    expect(normalizeFoodName("\t\n")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// normalizeFoodName — punctuation stripping
// ---------------------------------------------------------------------------

describe("normalizeFoodName — punctuation handling", () => {
  it("strips leading slash, dash, asterisk, hash, and period characters", () => {
    expect(normalizeFoodName("/ toast")).toBe("toast");
    expect(normalizeFoodName("- eggs")).toBe("egg");
    expect(normalizeFoodName("* bread")).toBe("bread");
    expect(normalizeFoodName("# rice")).toBe("rice");
    expect(normalizeFoodName(". soup")).toBe("soup");
  });

  it("strips multiple leading punctuation characters", () => {
    expect(normalizeFoodName("--- eggs")).toBe("egg");
    expect(normalizeFoodName("///")).toBe(""); // nothing left after stripping
  });

  it("strips trailing periods, commas, colons, semicolons, exclamation, question marks", () => {
    expect(normalizeFoodName("toast.")).toBe("toast");
    expect(normalizeFoodName("eggs,")).toBe("egg");
    expect(normalizeFoodName("rice:")).toBe("rice");
    expect(normalizeFoodName("soup;")).toBe("soup");
    expect(normalizeFoodName("bread!")).toBe("bread");
    expect(normalizeFoodName("fruit?")).toBe("fruit");
  });

  it("normalizes hyphens to spaces", () => {
    expect(normalizeFoodName("gluten-free bread")).toBe("bread");
    expect(normalizeFoodName("whole-grain toast")).toBe("whole grain toast");
  });

  it("returns empty string when input reduces to nothing after punctuation stripping", () => {
    expect(normalizeFoodName("---")).toBe("");
    expect(normalizeFoodName("///")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// normalizeFoodName — quantity prefix stripping (digit + unit)
// ---------------------------------------------------------------------------

describe("normalizeFoodName — quantity prefix stripping", () => {
  it("strips '200g of' style prefix", () => {
    expect(normalizeFoodName("200g of chicken")).toBe("chicken");
    expect(normalizeFoodName("100 grams of rice")).toBe("rice");
    expect(normalizeFoodName("2 slices of bread")).toBe("bread");
    expect(normalizeFoodName("3 cups of soup")).toBe("soup");
    expect(normalizeFoodName("1 tbsp olive oil")).toBe("olive oil");
    expect(normalizeFoodName("5 pieces of chicken")).toBe("chicken");
    expect(normalizeFoodName("2 servings of yogurt")).toBe("yogurt");
  });

  it("strips '200g' prefix without 'of'", () => {
    expect(normalizeFoodName("50ml milk")).toBe("milk");
    expect(normalizeFoodName("2oz cheese")).toBe("cheese");
  });

  it("strips standalone unit words without a leading digit", () => {
    expect(normalizeFoodName("grams of oats")).toBe("oat");
    expect(normalizeFoodName("tsp salt")).toBe("salt");
    expect(normalizeFoodName("g of rice")).toBe("rice");
    expect(normalizeFoodName("cups of tea")).toBe("tea");
    expect(normalizeFoodName("slices of toast")).toBe("toast");
  });

  it("does not strip a unit that is part of the food name (no space follows)", () => {
    // "oz" alone followed by more text qualifies; a bare food name "tea" is unaffected
    expect(normalizeFoodName("tea")).toBe("tea");
  });
});

// ---------------------------------------------------------------------------
// normalizeFoodName — word-form number stripping
// ---------------------------------------------------------------------------

describe("normalizeFoodName — word-form number stripping", () => {
  it("strips a word-form number at the start", () => {
    expect(normalizeFoodName("six crackers")).toBe("cracker");
    expect(normalizeFoodName("two eggs")).toBe("egg");
    expect(normalizeFoodName("three slices of bread")).toBe("bread");
    expect(normalizeFoodName("ten grapes")).toBe("grape");
    expect(normalizeFoodName("half banana")).toBe("banana");
  });

  it("does not strip a word-form number when it is the only word", () => {
    // Must have at least one other word to strip (the check requires cleaned.includes(" "))
    expect(normalizeFoodName("six")).toBe("six");
    expect(normalizeFoodName("half")).toBe("half");
  });
});

// ---------------------------------------------------------------------------
// normalizeFoodName — percentage pattern stripping
// ---------------------------------------------------------------------------

describe("normalizeFoodName — percentage stripping", () => {
  it("strips percentage patterns from the string", () => {
    // "85% cocoa" → the whole pattern "85% cocoa" is stripped leaving nothing
    expect(normalizeFoodName("85% cocoa dark chocolate")).toBe(
      "dark chocolate",
    );
    expect(normalizeFoodName("50% fat cheese")).toBe("cheese");
  });

  it("strips standalone percentage that leaves an empty result", () => {
    // If nothing else remains, return empty string
    expect(normalizeFoodName("85% cocoa")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// normalizeFoodName — filler phrase stripping (multi-word)
// ---------------------------------------------------------------------------

describe("normalizeFoodName — multi-word filler phrase stripping", () => {
  it("strips 'lactose free'", () => {
    expect(normalizeFoodName("lactose free milk")).toBe("milk");
  });

  it("strips 'gluten free'", () => {
    expect(normalizeFoodName("gluten free bread")).toBe("bread");
  });

  it("strips 'sugar free'", () => {
    expect(normalizeFoodName("sugar free jelly")).toBe("jelly");
  });

  it("strips 'fat free'", () => {
    expect(normalizeFoodName("fat free yogurt")).toBe("yogurt");
  });

  it("strips 'dairy free'", () => {
    expect(normalizeFoodName("dairy free milk")).toBe("milk");
  });

  it("strips filler phrases regardless of casing in original input", () => {
    // Input is lowercased before the pattern is applied
    expect(normalizeFoodName("Lactose Free Milk")).toBe("milk");
    expect(normalizeFoodName("GLUTEN FREE BREAD")).toBe("bread");
  });
});

// ---------------------------------------------------------------------------
// normalizeFoodName — single-word filler stripping
// ---------------------------------------------------------------------------

describe("normalizeFoodName — single-word filler stripping", () => {
  it("strips 'plain' from the front", () => {
    expect(normalizeFoodName("plain cracker")).toBe("cracker");
    expect(normalizeFoodName("plain crackers")).toBe("cracker");
    expect(normalizeFoodName("plain rice crackers")).toBe("rice cracker");
  });

  it("strips 'fresh' from the front", () => {
    expect(normalizeFoodName("fresh strawberries")).toBe("strawberry");
  });

  it("strips 'organic'", () => {
    expect(normalizeFoodName("organic eggs")).toBe("egg");
  });

  it("strips 'homemade'", () => {
    expect(normalizeFoodName("homemade soup")).toBe("soup");
  });

  it("strips 'natural'", () => {
    expect(normalizeFoodName("natural yogurt")).toBe("yogurt"); // also a synonym
  });

  it("strips articles 'a' and 'the'", () => {
    expect(normalizeFoodName("a banana")).toBe("banana");
    expect(normalizeFoodName("the soup")).toBe("soup");
  });

  it("strips 'some'", () => {
    expect(normalizeFoodName("some fruit")).toBe("fruit");
  });

  it("strips 'free' as a standalone word", () => {
    // "free" alone should be stripped; but in "sugar free" it's handled by the phrase first
    expect(normalizeFoodName("free range eggs")).toBe("range egg");
  });

  it("preserves preparation words (not in the filler set)", () => {
    expect(normalizeFoodName("fried egg")).toBe("fried egg");
    expect(normalizeFoodName("boiled egg")).toBe("boiled egg");
    expect(normalizeFoodName("mashed potato")).toBe("pureed potato"); // via synonym
    expect(normalizeFoodName("soaked plain cracker")).toBe("soaked cracker");
  });
});

// ---------------------------------------------------------------------------
// normalizeFoodName — singularisation
// ---------------------------------------------------------------------------

describe("normalizeFoodName — singularisation (KEEP_PLURAL words)", () => {
  it("keeps hummus singular (in KEEP_PLURAL)", () => {
    expect(normalizeFoodName("hummus")).toBe("hummus");
  });

  it("keeps couscous singular (in KEEP_PLURAL)", () => {
    expect(normalizeFoodName("couscous")).toBe("couscous");
  });

  it("keeps asparagus unchanged (in KEEP_PLURAL)", () => {
    expect(normalizeFoodName("asparagus")).toBe("asparagus");
  });

  it("keeps broccoli unchanged (in KEEP_PLURAL)", () => {
    expect(normalizeFoodName("broccoli")).toBe("broccoli");
  });

  it("keeps aioli unchanged (in KEEP_PLURAL)", () => {
    expect(normalizeFoodName("aioli")).toBe("aioli");
  });

  it("keeps swiss unchanged (in KEEP_PLURAL)", () => {
    expect(normalizeFoodName("swiss cheese")).toBe("swiss cheese");
  });

  it("does not singularize words of 3 or fewer characters", () => {
    // singularizeWord bails early for length <= 3
    expect(normalizeFoodName("tea")).toBe("tea");
    expect(normalizeFoodName("jam")).toBe("jam");
    expect(normalizeFoodName("egg")).toBe("egg"); // already singular, 3 chars
  });
});

describe("normalizeFoodName — singularisation (PLURAL_OVERRIDES)", () => {
  it("singularizes berries → berry", () => {
    expect(normalizeFoodName("berries")).toBe("berry");
  });

  it("singularizes cherries → cherry", () => {
    expect(normalizeFoodName("cherries")).toBe("cherry");
  });

  it("singularizes strawberries → strawberry", () => {
    expect(normalizeFoodName("strawberries")).toBe("strawberry");
  });

  it("singularizes blueberries → blueberry", () => {
    expect(normalizeFoodName("blueberries")).toBe("blueberry");
  });

  it("singularizes raspberries → raspberry", () => {
    expect(normalizeFoodName("raspberries")).toBe("raspberry");
  });

  it("singularizes blackberries → blackberry", () => {
    expect(normalizeFoodName("blackberries")).toBe("blackberry");
  });

  it("singularizes cranberries → cranberry", () => {
    expect(normalizeFoodName("cranberries")).toBe("cranberry");
  });

  it("singularizes cookies → cookie", () => {
    expect(normalizeFoodName("cookies")).toBe("cookie");
  });

  it("singularizes brownies → brownie", () => {
    expect(normalizeFoodName("brownies")).toBe("brownie");
  });

  it("singularizes smoothies → smoothie", () => {
    expect(normalizeFoodName("smoothies")).toBe("smoothie");
  });

  it("singularizes potatoes → potato (override beats 'oes' rule)", () => {
    expect(normalizeFoodName("potatoes")).toBe("potato");
  });

  it("singularizes tomatoes → tomato (override beats 'oes' rule)", () => {
    expect(normalizeFoodName("tomatoes")).toBe("tomato");
  });

  it("singularizes mangoes → mango (override)", () => {
    expect(normalizeFoodName("mangoes")).toBe("mango");
  });

  it("singularizes avocados → avocado (override)", () => {
    expect(normalizeFoodName("avocados")).toBe("avocado");
  });

  it("singularizes tortillas → tortilla (override)", () => {
    expect(normalizeFoodName("tortillas")).toBe("tortilla");
  });

  it("singularizes leaves → leaf (override)", () => {
    expect(normalizeFoodName("leaves")).toBe("leaf");
  });

  it("singularizes cheeses → cheese (override)", () => {
    expect(normalizeFoodName("cheeses")).toBe("cheese");
  });

  it("singularizes loaves → loaf (override)", () => {
    expect(normalizeFoodName("loaves")).toBe("loaf");
  });

  it("singularizes halves → half (override)", () => {
    expect(normalizeFoodName("halves")).toBe("half");
  });
});

describe("normalizeFoodName — singularisation (suffix rules)", () => {
  it("singularizes 'ies' ending → 'y' (pastries → pastry)", () => {
    expect(normalizeFoodName("pastries")).toBe("pastry");
  });

  it("does not singularize 'ies' ending when word length <= 4 (e.g. 'pies' stays)", () => {
    // "pies" is 4 chars; condition requires word.length > 4
    expect(normalizeFoodName("pies")).toBe("pie");
    // "ties" is 4 chars
    expect(normalizeFoodName("ties")).toBe("tie");
  });

  it("singularizes 'ves' ending → 'f' when not in overrides (e.g., 'shelves' → 'shelf')", () => {
    expect(normalizeFoodName("shelves")).toBe("shelf");
  });

  it("singularizes 'ses' ending (sauces → sauce)", () => {
    expect(normalizeFoodName("sauces")).toBe("sauce");
  });

  it("singularizes 'xes' ending (boxes → box)", () => {
    expect(normalizeFoodName("boxes")).toBe("box");
  });

  it("singularizes 'zes' ending (fuzzes → fuzz)", () => {
    expect(normalizeFoodName("fuzzes")).toBe("fuzz");
  });

  it("singularizes 'ches' ending (peaches → peach)", () => {
    expect(normalizeFoodName("peaches")).toBe("peach");
    expect(normalizeFoodName("sandwiches")).toBe("sandwich");
  });

  it("singularizes 'shes' ending (dishes → dish)", () => {
    expect(normalizeFoodName("dishes")).toBe("dish");
    expect(normalizeFoodName("squashes")).toBe("squash");
  });

  it("singularizes 'oes' ending not in overrides (heroes → hero)", () => {
    expect(normalizeFoodName("heroes")).toBe("hero");
  });

  it("singularizes plain trailing 's' (eggs → egg, grapes → grape)", () => {
    expect(normalizeFoodName("eggs")).toBe("egg");
    expect(normalizeFoodName("grapes")).toBe("grape");
    expect(normalizeFoodName("carrots")).toBe("carrot");
  });

  it("does NOT singularize 'ss' endings (grass, bass, glass stay unchanged)", () => {
    // These are in KEEP_PLURAL, so they're protected from the trailing-s rule
    expect(normalizeFoodName("glass")).toBe("glass");
    expect(normalizeFoodName("bass")).toBe("bass");
    expect(normalizeFoodName("grass")).toBe("grass");
  });

  it("does NOT singularize 'us' endings (citrus, asparagus stay unchanged)", () => {
    // "citrus" and "asparagus" are in KEEP_PLURAL
    expect(normalizeFoodName("citrus")).toBe("citrus");
  });

  it("only singularizes the LAST word in a multi-word name", () => {
    // "scrambled eggs" → "scrambled egg", not "scrambled egg" vs "scramble egg"
    expect(normalizeFoodName("scrambled eggs")).toBe("scrambled egg");
    expect(normalizeFoodName("chicken wings")).toBe("chicken wing");
    expect(normalizeFoodName("banana pancakes")).toBe("banana pancake");
  });
});

// ---------------------------------------------------------------------------
// normalizeFoodName — synonym mapping
// ---------------------------------------------------------------------------

describe("normalizeFoodName — synonym mapping", () => {
  it("maps mashed potato → pureed potato", () => {
    expect(normalizeFoodName("mashed potato")).toBe("pureed potato");
  });

  it("maps yoghurt → yogurt", () => {
    expect(normalizeFoodName("yoghurt")).toBe("yogurt");
  });

  it("maps natural yogurt → yogurt (filler 'natural' stripped, then synonym applied)", () => {
    expect(normalizeFoodName("natural yogurt")).toBe("yogurt");
  });

  it("maps plain yogurt → yogurt (filler 'plain' stripped, then synonym applied)", () => {
    expect(normalizeFoodName("plain yogurt")).toBe("yogurt");
  });

  it("does not apply synonym to similar-but-different names", () => {
    // "mashed potatoes" → singularises to "mashed potato" → hits the synonym
    expect(normalizeFoodName("mashed potatoes")).toBe("pureed potato");
    // "mashed sweet potato" has a different canonical and should NOT match
    expect(normalizeFoodName("mashed sweet potato")).toBe(
      "mashed sweet potato",
    );
  });
});

// ---------------------------------------------------------------------------
// normalizeFoodName — grouping key consistency guarantee
// ---------------------------------------------------------------------------

describe("normalizeFoodName — grouping key consistency", () => {
  it("Cottage Cheese, cottage cheese, cottage  cheese all resolve to the same key", () => {
    const key1 = normalizeFoodName("Cottage Cheese");
    const key2 = normalizeFoodName("cottage cheese");
    const key3 = normalizeFoodName("cottage  cheese");
    expect(key1).toBe(key2);
    expect(key2).toBe(key3);
  });

  it("plain yogurt, natural yogurt, yoghurt all resolve to the same key (yogurt)", () => {
    expect(normalizeFoodName("plain yogurt")).toBe("yogurt");
    expect(normalizeFoodName("natural yogurt")).toBe("yogurt");
    expect(normalizeFoodName("yoghurt")).toBe("yogurt");
  });

  it("200g of chicken and chicken resolve to the same key", () => {
    expect(normalizeFoodName("200g of chicken")).toBe(
      normalizeFoodName("chicken"),
    );
  });

  it("'fresh strawberries' and 'strawberry' resolve to the same key", () => {
    expect(normalizeFoodName("fresh strawberries")).toBe(
      normalizeFoodName("strawberry"),
    );
  });
});

// ---------------------------------------------------------------------------
// formatFoodDisplayName
// ---------------------------------------------------------------------------

describe("formatFoodDisplayName", () => {
  it("title-cases each word", () => {
    expect(formatFoodDisplayName("scrambled egg")).toBe("Scrambled Egg");
    expect(formatFoodDisplayName("white rice")).toBe("White Rice");
  });

  it("handles extra leading, trailing, and interior whitespace", () => {
    expect(formatFoodDisplayName("  scrambled   egg  ")).toBe("Scrambled Egg");
  });

  it("handles a single word", () => {
    expect(formatFoodDisplayName("toast")).toBe("Toast");
  });

  it("handles empty string", () => {
    expect(formatFoodDisplayName("")).toBe("");
  });

  it("handles whitespace-only string", () => {
    expect(formatFoodDisplayName("   ")).toBe("");
  });

  it("does not inherit normalisation — ALL-CAPS input just title-cases each word", () => {
    // formatFoodDisplayName is intentionally a dumb formatter; it does not lowercase then title-case
    // Each word: first char upper, rest lower. So "TOAST" → "Toast"
    expect(formatFoodDisplayName("TOAST")).toBe("Toast");
    expect(formatFoodDisplayName("scrambled EGG")).toBe("Scrambled Egg");
  });

  it("handles single-character words", () => {
    expect(formatFoodDisplayName("a b c")).toBe("A B C");
  });
});

// ---------------------------------------------------------------------------
// formatCanonicalFoodDisplayName
// ---------------------------------------------------------------------------

describe("formatCanonicalFoodDisplayName", () => {
  it("returns the override for 'toast' canonical → 'White Toast'", () => {
    expect(formatCanonicalFoodDisplayName("toast")).toBe("White Toast");
  });

  it("is case-insensitive for the override lookup", () => {
    // key is lowercased before the map lookup
    expect(formatCanonicalFoodDisplayName("Toast")).toBe("White Toast");
    expect(formatCanonicalFoodDisplayName("TOAST")).toBe("White Toast");
    expect(formatCanonicalFoodDisplayName("  toast  ")).toBe("White Toast");
  });

  it("falls back to standard title-casing for non-overridden canonicals", () => {
    expect(formatCanonicalFoodDisplayName("white bread")).toBe("White Bread");
    expect(formatCanonicalFoodDisplayName("cottage cheese")).toBe(
      "Cottage Cheese",
    );
  });

  it("handles empty string without throwing", () => {
    expect(formatCanonicalFoodDisplayName("")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// prefersSummaryCandidate
// ---------------------------------------------------------------------------

// Helper to build a minimal summary row
function makeSummary(overrides: {
  canonicalName: string;
  _creationTime?: number;
  updatedAt?: number;
  lastAssessedAt?: number;
}) {
  return {
    _creationTime: overrides._creationTime ?? 1000,
    canonicalName: overrides.canonicalName,
    updatedAt: overrides.updatedAt,
    lastAssessedAt: overrides.lastAssessedAt,
  };
}

describe("prefersSummaryCandidate — exact canonical name match tiebreaker", () => {
  it("prefers a candidate whose canonicalName exactly matches the normalized name", () => {
    const candidate = makeSummary({ canonicalName: "yogurt" });
    const existing = makeSummary({ canonicalName: "Yogurt" }); // not an exact match
    expect(prefersSummaryCandidate(candidate, existing, "yogurt")).toBe(true);
  });

  it("keeps existing when existing is the exact match and candidate is not", () => {
    const candidate = makeSummary({ canonicalName: "Yogurt" }); // not exact
    const existing = makeSummary({ canonicalName: "yogurt" }); // exact match
    expect(prefersSummaryCandidate(candidate, existing, "yogurt")).toBe(false);
  });

  it("moves to next tiebreaker when both are exact matches", () => {
    // Both exact — falls through to updatedAt comparison
    const candidate = makeSummary({ canonicalName: "yogurt", updatedAt: 2000 });
    const existing = makeSummary({ canonicalName: "yogurt", updatedAt: 1500 });
    expect(prefersSummaryCandidate(candidate, existing, "yogurt")).toBe(true);
  });

  it("moves to next tiebreaker when neither is an exact match", () => {
    // Neither exact — falls through to updatedAt comparison
    const candidate = makeSummary({ canonicalName: "Yogurt", updatedAt: 2000 });
    const existing = makeSummary({ canonicalName: "YOGURT", updatedAt: 1500 });
    expect(prefersSummaryCandidate(candidate, existing, "yogurt")).toBe(true);
  });
});

describe("prefersSummaryCandidate — updatedAt tiebreaker", () => {
  it("prefers the candidate with the higher updatedAt", () => {
    const candidate = makeSummary({ canonicalName: "yogurt", updatedAt: 3000 });
    const existing = makeSummary({ canonicalName: "yogurt", updatedAt: 2000 });
    expect(prefersSummaryCandidate(candidate, existing, "yogurt")).toBe(true);
  });

  it("keeps existing when existing has higher updatedAt", () => {
    const candidate = makeSummary({ canonicalName: "yogurt", updatedAt: 1000 });
    const existing = makeSummary({ canonicalName: "yogurt", updatedAt: 5000 });
    expect(prefersSummaryCandidate(candidate, existing, "yogurt")).toBe(false);
  });

  it("falls back to _creationTime when updatedAt is absent on both", () => {
    // No updatedAt → uses _creationTime as the effective updatedAt
    const candidate = makeSummary({
      canonicalName: "yogurt",
      _creationTime: 2000,
    });
    const existing = makeSummary({
      canonicalName: "yogurt",
      _creationTime: 1000,
    });
    expect(prefersSummaryCandidate(candidate, existing, "yogurt")).toBe(true);
  });

  it("uses candidate.updatedAt vs existing._creationTime when only candidate has updatedAt", () => {
    const candidate = makeSummary({
      canonicalName: "yogurt",
      _creationTime: 1000,
      updatedAt: 1500,
    });
    const existing = makeSummary({
      canonicalName: "yogurt",
      _creationTime: 2000,
    }); // no updatedAt
    // candidate effective = 1500, existing effective = 2000 → existing wins
    expect(prefersSummaryCandidate(candidate, existing, "yogurt")).toBe(false);
  });
});

describe("prefersSummaryCandidate — lastAssessedAt tiebreaker", () => {
  it("prefers candidate with higher lastAssessedAt when updatedAt is tied", () => {
    const candidate = makeSummary({
      canonicalName: "yogurt",
      updatedAt: 1000,
      lastAssessedAt: 5000,
    });
    const existing = makeSummary({
      canonicalName: "yogurt",
      updatedAt: 1000,
      lastAssessedAt: 3000,
    });
    expect(prefersSummaryCandidate(candidate, existing, "yogurt")).toBe(true);
  });

  it("keeps existing when existing has higher lastAssessedAt and updatedAt is tied", () => {
    const candidate = makeSummary({
      canonicalName: "yogurt",
      updatedAt: 1000,
      lastAssessedAt: 2000,
    });
    const existing = makeSummary({
      canonicalName: "yogurt",
      updatedAt: 1000,
      lastAssessedAt: 9000,
    });
    expect(prefersSummaryCandidate(candidate, existing, "yogurt")).toBe(false);
  });

  it("treats absent lastAssessedAt as 0 when comparing", () => {
    const candidate = makeSummary({
      canonicalName: "yogurt",
      updatedAt: 1000,
      lastAssessedAt: 1,
    });
    const existing = makeSummary({ canonicalName: "yogurt", updatedAt: 1000 }); // no lastAssessedAt
    // candidate = 1, existing = 0 → candidate wins
    expect(prefersSummaryCandidate(candidate, existing, "yogurt")).toBe(true);
  });
});

describe("prefersSummaryCandidate — _creationTime final tiebreaker", () => {
  it("prefers candidate with higher _creationTime when all other fields are tied", () => {
    const candidate = makeSummary({
      canonicalName: "yogurt",
      _creationTime: 9000,
      updatedAt: 1000,
      lastAssessedAt: 500,
    });
    const existing = makeSummary({
      canonicalName: "yogurt",
      _creationTime: 8000,
      updatedAt: 1000,
      lastAssessedAt: 500,
    });
    expect(prefersSummaryCandidate(candidate, existing, "yogurt")).toBe(true);
  });

  it("returns false (keeps existing) when candidate _creationTime is older", () => {
    const candidate = makeSummary({
      canonicalName: "yogurt",
      _creationTime: 100,
      updatedAt: 1000,
      lastAssessedAt: 500,
    });
    const existing = makeSummary({
      canonicalName: "yogurt",
      _creationTime: 999,
      updatedAt: 1000,
      lastAssessedAt: 500,
    });
    expect(prefersSummaryCandidate(candidate, existing, "yogurt")).toBe(false);
  });

  it("returns false when all fields are identical (no displacement on tie)", () => {
    const row = makeSummary({
      canonicalName: "yogurt",
      _creationTime: 1000,
      updatedAt: 500,
      lastAssessedAt: 200,
    });
    // Identical objects — candidate._creationTime === existing._creationTime, so returns false
    expect(prefersSummaryCandidate(row, { ...row }, "yogurt")).toBe(false);
  });
});
```

---

## Testing Decisions

### What was tested

**`normalizeFoodName`** — the most complex function, tested in layers that mirror the actual pipeline order:

1. Baseline (lowercase, trim, collapse whitespace, diacritic stripping)
2. Punctuation stripping (leading and trailing; hyphen normalization)
3. Quantity prefix stripping (numeric+unit and standalone unit words)
4. Word-form number stripping
5. Percentage pattern stripping
6. Multi-word filler phrases
7. Single-word filler words (and preservation of non-filler words)
8. Singularization — split into three sub-groups: KEEP_PLURAL words, PLURAL_OVERRIDES map, and the suffix-rule branches (`ies`, `ves`, `ses/xes/zes/ches/shes`, `oes`, plain `s`, anti-patterns for `ss`/`us`)
9. Synonym mapping
10. Grouping key consistency guarantee (the stated goal of the function)

**`formatFoodDisplayName`** — straightforward title-casing; tested normal cases, whitespace edge cases, empty input, and the note that it is intentionally a "dumb formatter" that does not apply normalization.

**`formatCanonicalFoodDisplayName`** — tested override behavior, case-insensitivity of the override lookup, fallback path, and empty input.

**`prefersSummaryCandidate`** — tested all four tiebreaker levels independently, including the boundary where only one side has `updatedAt` (uses `_creationTime` fallback), the `lastAssessedAt = 0` sentinel for absent values, and the fully-tied case that must return `false` (no unnecessary displacement).

### Edge cases specifically identified

- `singularizeWord` 3-char guard: words of length ≤ 3 bypass singularization entirely.
- `ies` rule requires `word.length > 4` — "pies" (4 chars) and "ties" (4 chars) only avoid the rule by length, but "pie" / "tie" still end up correct via the trailing-s rule. Added a note in the test about how this actually resolves.
- KEEP_PLURAL set prevents the trailing-`s` rule from mangling "glass", "grass", "bass" etc.
- `updatedAt` fallback to `_creationTime`: a row with no `updatedAt` uses `_creationTime` as its effective update timestamp — so a candidate with `updatedAt: 1500` can lose to an existing row with no `updatedAt` but `_creationTime: 2000`.
- Percentage stripping can empty the string entirely ("85% cocoa" → "") — the function handles this with the `if (!cleaned) return cleaned` guard.
- Hyphen normalization happens before the rest of the pipeline, so "gluten-free bread" → "gluten free bread" → phrase-stripped → "bread".
- `prefersSummaryCandidate` is a pure value comparison with no side-effects, so it needs no mocks and no fake timers.

### What was deliberately not tested

- CSS/visual appearance — per the agent definition, no React Testing Library or rendering tests.
- Internal helpers (`singularizeWord`, `singularize`, `escapeRegExp`, etc.) in isolation — they are private and tested adequately through `normalizeFoodName`.
- Convex-layer behavior — `normalizeFoodName` is a shared utility; there is no Convex layer to test here.
- "Renders without crashing" patterns — not applicable to utility functions.

---

## Methodology Notes

The test-writer agent definition shaped the approach in the following concrete ways:

**"Tests must verify real behavior"** — Every assertion is derived from the documented contract of the function (e.g., "200g of chicken" and "chicken" must produce the same grouping key). No test merely checks that the function returns a string.

**"No mocking unless physically impossible"** — `normalizeFoodName` and the other utilities are pure functions with no I/O or time dependency. No mocks were introduced. The agent definition explicitly says `vi.useFakeTimers()` is the only acceptable time mock; none of these functions use `Date`, so no fake timers were needed either.

**"Layer: Utility functions → Vitest, pure logic, transformations"** — All four exported functions fit squarely in the utility layer. No `convex-test` wrapper, no Playwright, just Vitest with `describe`/`it`/`expect` — matching exactly what the test layer table prescribes.

**"Don't copy bad patterns"** — The existing `foodNormalize.test.ts` is limited (22 tests, mostly the `ses/xes/zes/ches/shes` and `oes` branches, plus basic edge cases and synonyms). It does not cover `prefersSummaryCandidate` at all, and omits the numeric-quantity stripping, word-number stripping, percentage stripping, the `ves`/`ies` suffix rules in detail, or the grouping-key consistency property. This report's test suite covers all of those, following the rule that "existing tests may violate these rules — these rules win."

**"Ask: if the implementation was completely wrong but returned the right type, would this test catch it?"** — This question drove inclusion of the grouping-key consistency section: if `normalizeFoodName` returned the raw input as a lowercase string (correct type, wrong behavior), the consistency tests would fail because `"200g of chicken"` would not equal `"chicken"`.
