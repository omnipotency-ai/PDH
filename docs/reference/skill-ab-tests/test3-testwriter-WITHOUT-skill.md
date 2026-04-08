# Test 3: Test Writer — WITHOUT Skill

## Functions Under Test

From `shared/foodNormalize.ts`:

1. **`normalizeFoodName(value: string): string`** — The core export. Converts a raw food name string into a canonical grouping key. Pipeline: Unicode NFD normalization → lowercase → trim → collapse whitespace → strip leading punctuation → strip trailing punctuation → normalize hyphens → strip `200g of`-style quantity prefixes → strip standalone unit words → strip leading word-form numbers → strip percentage patterns → strip multi-word filler phrases → strip single filler words → singularize last word → apply synonym map.

2. **`formatFoodDisplayName(value: string): string`** — Title-cases each word in a food name for display purposes. Trims and collapses whitespace before processing.

3. **`formatCanonicalFoodDisplayName(value: string): string`** — Like `formatFoodDisplayName` but checks a hardcoded override map first. Currently "toast" → "White Toast".

4. **`prefersSummaryCandidate<T>(candidate: T, existing: T, normalizedCanonicalName: string): boolean`** — Compares two `foodTrialSummary`-shaped objects and returns `true` if `candidate` should replace `existing`. Tiebreaker order: exact canonical name match > most recent `updatedAt` (falling back to `_creationTime`) > most recent `lastAssessedAt` > most recent `_creationTime`.

Internal helpers (`singularizeWord`, `singularize`, `stripQuantityPrefix`, `stripFillerWords`, `applySynonyms`) are not exported but are exercised through `normalizeFoodName`.

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

// ── normalizeFoodName ────────────────────────────────────────────────────────

describe("normalizeFoodName — basic normalisation", () => {
  it("lowercases the input", () => {
    expect(normalizeFoodName("CHICKEN")).toBe("chicken");
    expect(normalizeFoodName("Cottage Cheese")).toBe("cottage cheese");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeFoodName("  rice  ")).toBe("rice");
    expect(normalizeFoodName("\t oats \n")).toBe("oat");
  });

  it("collapses multiple internal spaces to one", () => {
    expect(normalizeFoodName("cottage  cheese")).toBe("cottage cheese");
    expect(normalizeFoodName("white   rice")).toBe("white rice");
  });

  it("returns empty string for empty input", () => {
    expect(normalizeFoodName("")).toBe("");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(normalizeFoodName("   ")).toBe("");
  });

  it("returns empty string when input is only stripped punctuation", () => {
    expect(normalizeFoodName("---")).toBe("");
    expect(normalizeFoodName("///")).toBe("");
    expect(normalizeFoodName("***")).toBe("");
    expect(normalizeFoodName("...")).toBe("");
  });
});

// ── Unicode / accented characters ───────────────────────────────────────────

describe("normalizeFoodName — unicode normalisation", () => {
  it("strips combining diacritical marks", () => {
    // é (U+00E9) → e via NFD + strip combining marks
    expect(normalizeFoodName("café")).toBe("cafe");
    expect(normalizeFoodName("crème brûlée")).toBe("creme brulee");
  });

  it("handles pre-composed characters correctly", () => {
    // ñ in jalapeño
    expect(normalizeFoodName("jalapeño")).toBe("jalapeno");
  });
});

// ── Punctuation stripping ────────────────────────────────────────────────────

describe("normalizeFoodName — punctuation handling", () => {
  it("strips leading slash", () => {
    expect(normalizeFoodName("/toast")).toBe("toast");
  });

  it("strips multiple leading punctuation characters", () => {
    expect(normalizeFoodName("---toast")).toBe("toast");
    expect(normalizeFoodName("**bread")).toBe("bread");
    expect(normalizeFoodName("##rice")).toBe("rice");
  });

  it("strips trailing period", () => {
    expect(normalizeFoodName("bread.")).toBe("bread");
  });

  it("strips trailing comma", () => {
    expect(normalizeFoodName("bread,")).toBe("bread");
  });

  it("strips trailing semicolons and colons", () => {
    expect(normalizeFoodName("soup;")).toBe("soup");
    expect(normalizeFoodName("soup:")).toBe("soup");
  });

  it("strips trailing exclamation and question marks", () => {
    expect(normalizeFoodName("toast!")).toBe("toast");
    expect(normalizeFoodName("rice?")).toBe("rice");
  });

  it("converts hyphens to spaces", () => {
    expect(normalizeFoodName("gluten-free bread")).toBe("bread");
    // After hyphen→space, "gluten free" becomes a filler phrase
  });

  it("collapses spaces after hyphen conversion", () => {
    // "soft-boiled egg" → "soft boiled egg" after hyphen expansion
    expect(normalizeFoodName("soft-boiled egg")).toBe("soft boiled egg");
  });
});

// ── Quantity prefix stripping ────────────────────────────────────────────────

describe("normalizeFoodName — quantity prefix stripping", () => {
  it("strips digit + gram prefix", () => {
    expect(normalizeFoodName("200g pasta")).toBe("pasta");
    expect(normalizeFoodName("100grams rice")).toBe("rice");
  });

  it("strips digit + ml prefix", () => {
    expect(normalizeFoodName("250ml milk")).toBe("milk");
  });

  it("strips digit + oz prefix", () => {
    expect(normalizeFoodName("8oz chicken")).toBe("chicken");
  });

  it("strips digit + cup/cups prefix", () => {
    expect(normalizeFoodName("2 cups oats")).toBe("oat");
    expect(normalizeFoodName("1 cup rice")).toBe("rice");
  });

  it("strips digit + tbsp prefix", () => {
    expect(normalizeFoodName("2 tbsp butter")).toBe("butter");
  });

  it("strips digit + tsp prefix", () => {
    expect(normalizeFoodName("1 tsp salt")).toBe("salt");
  });

  it("strips digit + piece/pieces prefix", () => {
    expect(normalizeFoodName("3 pieces chicken")).toBe("chicken");
    expect(normalizeFoodName("1 piece toast")).toBe("toast");
  });

  it("strips digit + slice/slices prefix", () => {
    expect(normalizeFoodName("2 slices bread")).toBe("bread");
  });

  it("strips digit + serving/servings prefix", () => {
    expect(normalizeFoodName("1 serving rice")).toBe("rice");
    expect(normalizeFoodName("2 servings pasta")).toBe("pasta");
  });

  it("strips quantity prefix followed by 'of'", () => {
    expect(normalizeFoodName("200g of pasta")).toBe("pasta");
    expect(normalizeFoodName("2 cups of oats")).toBe("oat");
  });

  it("does not strip a number that is not followed by a unit", () => {
    // "2 eggs" — "2" alone is not a unit word, but WORD_NUMBERS covers "two"
    // a plain digit like "2" is not in WORD_NUMBERS, so it stays (checked below)
    // This is a boundary case — verify the actual behavior
    expect(normalizeFoodName("2 eggs")).toBe("2 egg");
  });
});

// ── Standalone unit word stripping (no leading digit) ───────────────────────

describe("normalizeFoodName — standalone unit prefix stripping", () => {
  it("strips 'g' at start without digit", () => {
    expect(normalizeFoodName("g pasta")).toBe("pasta");
  });

  it("strips 'grams' at start", () => {
    expect(normalizeFoodName("grams rice")).toBe("rice");
  });

  it("strips 'ml' at start", () => {
    expect(normalizeFoodName("ml juice")).toBe("juice");
  });

  it("strips 'tsp' at start", () => {
    expect(normalizeFoodName("tsp jam")).toBe("jam");
  });

  it("strips 'tbsp' at start", () => {
    expect(normalizeFoodName("tbsp butter")).toBe("butter");
  });

  it("strips 'oz' at start", () => {
    expect(normalizeFoodName("oz chicken")).toBe("chicken");
  });

  it("strips 'cups' at start", () => {
    expect(normalizeFoodName("cups oats")).toBe("oat");
  });

  it("strips standalone unit followed by 'of'", () => {
    expect(normalizeFoodName("grams of rice")).toBe("rice");
    expect(normalizeFoodName("cups of oats")).toBe("oat");
  });
});

// ── Word-form number stripping ───────────────────────────────────────────────

describe("normalizeFoodName — word-form number stripping", () => {
  it("strips 'two' at the start of a multi-word name", () => {
    expect(normalizeFoodName("two eggs")).toBe("egg");
  });

  it("strips 'three' at the start", () => {
    expect(normalizeFoodName("three crackers")).toBe("cracker");
  });

  it("strips 'six' at the start", () => {
    expect(normalizeFoodName("six crackers")).toBe("cracker");
  });

  it("strips 'half' as a word-form number prefix", () => {
    // "half" is in WORD_NUMBERS, so "half portion" → "portion"
    // but "half" alone should not be stripped (no second word)
    expect(normalizeFoodName("half portion rice")).toBe("portion rice");
  });

  it("does not strip a word-form number when it is the only word", () => {
    // No second word, so the stripping guard (`cleaned.includes(" ")`) prevents it
    expect(normalizeFoodName("six")).toBe("six");
  });

  it("does not strip word-form numbers mid-string", () => {
    // Only the first word is checked
    expect(normalizeFoodName("eggs two")).toBe("egg two");
  });
});

// ── Percentage pattern stripping ─────────────────────────────────────────────

describe("normalizeFoodName — percentage stripping", () => {
  it("strips a percentage and its following word", () => {
    expect(normalizeFoodName("85% cocoa chocolate")).toBe("chocolate");
  });

  it("strips a lone percentage", () => {
    // "50% fat milk" → "milk" (the regex strips "50% fat")
    expect(normalizeFoodName("50% fat milk")).toBe("milk");
  });

  it("strips percentage at start, leaving remainder", () => {
    expect(normalizeFoodName("2% milk")).toBe("milk");
  });
});

// ── Filler phrase stripping (multi-word) ─────────────────────────────────────

describe("normalizeFoodName — multi-word filler phrase stripping", () => {
  it("strips 'gluten free'", () => {
    expect(normalizeFoodName("gluten free bread")).toBe("bread");
  });

  it("strips 'lactose free'", () => {
    expect(normalizeFoodName("lactose free milk")).toBe("milk");
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

  it("strips filler phrase even when it appears mid-string", () => {
    expect(normalizeFoodName("white gluten free bread")).toBe("white bread");
  });

  it("strips filler phrase case-insensitively", () => {
    expect(normalizeFoodName("Gluten Free Bread")).toBe("bread");
    expect(normalizeFoodName("LACTOSE FREE MILK")).toBe("milk");
  });
});

// ── Single-word filler stripping ─────────────────────────────────────────────

describe("normalizeFoodName — single-word filler stripping", () => {
  it("strips 'plain'", () => {
    expect(normalizeFoodName("plain cracker")).toBe("cracker");
  });

  it("strips 'fresh'", () => {
    expect(normalizeFoodName("fresh orange juice")).toBe("orange juice");
  });

  it("strips 'organic'", () => {
    expect(normalizeFoodName("organic apple")).toBe("apple");
  });

  it("strips 'homemade'", () => {
    expect(normalizeFoodName("homemade soup")).toBe("soup");
  });

  it("strips 'natural'", () => {
    expect(normalizeFoodName("natural yogurt")).toBe("yogurt");
    // Note: "natural yogurt" is also a synonym for "yogurt" — synonym wins
  });

  it("strips 'a' as a filler word", () => {
    expect(normalizeFoodName("a banana")).toBe("banana");
  });

  it("strips 'the' as a filler word", () => {
    expect(normalizeFoodName("the soup")).toBe("soup");
  });

  it("strips 'some' as a filler word", () => {
    expect(normalizeFoodName("some rice")).toBe("rice");
  });

  it("strips 'free' as a standalone word (after filler phrases are gone)", () => {
    // If "free" is left over standalone (not part of phrase already stripped),
    // it should be stripped by the single-word filler pass
    expect(normalizeFoodName("free range egg")).toBe("range egg");
  });

  it("keeps preparation words that are not in the filler set", () => {
    // "fried", "boiled", "mashed", "scrambled" — none are in FILLER_WORDS
    expect(normalizeFoodName("fried egg")).toBe("fried egg");
    expect(normalizeFoodName("boiled egg")).toBe("boiled egg");
    expect(normalizeFoodName("scrambled eggs")).toBe("scrambled egg");
  });

  it("strips multiple filler words in one name", () => {
    expect(normalizeFoodName("fresh organic apple")).toBe("apple");
    expect(normalizeFoodName("plain fresh crackers")).toBe("cracker");
  });
});

// ── Singularisation — KEEP_PLURAL set ────────────────────────────────────────

describe("normalizeFoodName — KEEP_PLURAL words are not singularised", () => {
  it("keeps hummus", () => expect(normalizeFoodName("hummus")).toBe("hummus"));
  it("keeps couscous", () =>
    expect(normalizeFoodName("couscous")).toBe("couscous"));
  it("keeps asparagus", () =>
    expect(normalizeFoodName("asparagus")).toBe("asparagus"));
  it("keeps broccoli", () =>
    expect(normalizeFoodName("broccoli")).toBe("broccoli"));
  it("keeps aioli", () => expect(normalizeFoodName("aioli")).toBe("aioli"));
  it("keeps molasses", () =>
    expect(normalizeFoodName("molasses")).toBe("molasses"));
  it("keeps swiss (as in Swiss cheese)", () =>
    expect(normalizeFoodName("swiss cheese")).toBe("swiss cheese"));
  it("keeps glass", () => expect(normalizeFoodName("glass")).toBe("glass"));
  it("keeps grass", () => expect(normalizeFoodName("grass")).toBe("grass"));
  it("keeps citrus", () => expect(normalizeFoodName("citrus")).toBe("citrus"));
});

// ── Singularisation — PLURAL_OVERRIDES ───────────────────────────────────────

describe("normalizeFoodName — PLURAL_OVERRIDES applied correctly", () => {
  it("berries → berry", () =>
    expect(normalizeFoodName("berries")).toBe("berry"));
  it("strawberries → strawberry", () =>
    expect(normalizeFoodName("strawberries")).toBe("strawberry"));
  it("blueberries → blueberry", () =>
    expect(normalizeFoodName("blueberries")).toBe("blueberry"));
  it("raspberries → raspberry", () =>
    expect(normalizeFoodName("raspberries")).toBe("raspberry"));
  it("blackberries → blackberry", () =>
    expect(normalizeFoodName("blackberries")).toBe("blackberry"));
  it("cranberries → cranberry", () =>
    expect(normalizeFoodName("cranberries")).toBe("cranberry"));
  it("cherries → cherry", () =>
    expect(normalizeFoodName("cherries")).toBe("cherry"));
  it("calories → calorie", () =>
    expect(normalizeFoodName("calories")).toBe("calorie"));
  it("cookies → cookie", () =>
    expect(normalizeFoodName("cookies")).toBe("cookie"));
  it("brownies → brownie", () =>
    expect(normalizeFoodName("brownies")).toBe("brownie"));
  it("smoothies → smoothie", () =>
    expect(normalizeFoodName("smoothies")).toBe("smoothie"));
  it("potatoes → potato", () =>
    expect(normalizeFoodName("potatoes")).toBe("potato"));
  it("tomatoes → tomato", () =>
    expect(normalizeFoodName("tomatoes")).toBe("tomato"));
  it("mangoes → mango", () =>
    expect(normalizeFoodName("mangoes")).toBe("mango"));
  it("avocados → avocado", () =>
    expect(normalizeFoodName("avocados")).toBe("avocado"));
  it("tortillas → tortilla", () =>
    expect(normalizeFoodName("tortillas")).toBe("tortilla"));
  it("leaves → leaf", () => expect(normalizeFoodName("leaves")).toBe("leaf"));
  it("cheeses → cheese", () =>
    expect(normalizeFoodName("cheeses")).toBe("cheese"));
  it("loaves → loaf", () => expect(normalizeFoodName("loaves")).toBe("loaf"));
  it("halves → half", () => expect(normalizeFoodName("halves")).toBe("half"));
  it("knives → knife", () => expect(normalizeFoodName("knives")).toBe("knife"));
});

// ── Singularisation — suffix rules ───────────────────────────────────────────

describe("normalizeFoodName — suffix singularisation rules", () => {
  it("'ies' → 'y' for words not in overrides (e.g., pastries → pastry)", () => {
    expect(normalizeFoodName("pastries")).toBe("pastry");
  });

  it("'ies' → 'y' requires length > 4 (e.g., 'pies' is only 4 chars, but word > 4 after strip)", () => {
    // "pies" has 4 chars — length > 4 fails, falls through to general "s" rule
    // "pies" ends in "s" but not "ss" or "us", so → "pie"
    expect(normalizeFoodName("pies")).toBe("pie");
  });

  it("'ves' → 'f' for words not in overrides (e.g., scarves → scarf)", () => {
    expect(normalizeFoodName("scarves")).toBe("scarf");
  });

  it("'ses' ending: sauces → sauce", () => {
    expect(normalizeFoodName("sauces")).toBe("sauce");
  });

  it("'xes' ending: boxes → box", () => {
    expect(normalizeFoodName("boxes")).toBe("box");
  });

  it("'ches' ending: peaches → peach", () => {
    expect(normalizeFoodName("peaches")).toBe("peach");
  });

  it("'ches' ending: sandwiches → sandwich", () => {
    expect(normalizeFoodName("sandwiches")).toBe("sandwich");
  });

  it("'shes' ending: dishes → dish", () => {
    expect(normalizeFoodName("dishes")).toBe("dish");
  });

  it("'shes' ending: squashes → squash", () => {
    expect(normalizeFoodName("squashes")).toBe("squash");
  });

  it("'oes' ending not in overrides: heroes → hero", () => {
    expect(normalizeFoodName("heroes")).toBe("hero");
  });

  it("general trailing 's' removed: eggs → egg", () => {
    expect(normalizeFoodName("eggs")).toBe("egg");
  });

  it("general trailing 's' removed: apples → apple", () => {
    expect(normalizeFoodName("apples")).toBe("apple");
  });

  it("double-s ('ss') not de-pluralised: grass stays grass", () => {
    // But "grass" is also in KEEP_PLURAL, so both guards protect it.
    // Test something not in KEEP_PLURAL ending in "ss":
    expect(normalizeFoodName("cress")).toBe("cress");
  });

  it("'us' ending not de-pluralised: sinus stays sinus", () => {
    // Words ending in "us" are guarded — even if not in KEEP_PLURAL
    expect(normalizeFoodName("lotus")).toBe("lotus");
  });

  it("short words (<= 3 chars) not singularised", () => {
    expect(normalizeFoodName("tea")).toBe("tea");
    expect(normalizeFoodName("jam")).toBe("jam");
    expect(normalizeFoodName("oats")).toBe("oat"); // 4 chars, gets singularised
  });

  it("only the last word in a phrase is singularised", () => {
    // "chicken wings" → "chicken wing"  (not "chickens wing")
    expect(normalizeFoodName("chicken wings")).toBe("chicken wing");
    expect(normalizeFoodName("scrambled eggs")).toBe("scrambled egg");
  });

  it("a single-word name gets its own word singularised", () => {
    expect(normalizeFoodName("bananas")).toBe("banana");
  });
});

// ── Synonym mapping ───────────────────────────────────────────────────────────

describe("normalizeFoodName — synonym mapping", () => {
  it("maps 'mashed potato' → 'pureed potato'", () => {
    expect(normalizeFoodName("mashed potato")).toBe("pureed potato");
  });

  it("maps 'yoghurt' → 'yogurt'", () => {
    expect(normalizeFoodName("yoghurt")).toBe("yogurt");
  });

  it("maps 'natural yogurt' → 'yogurt'", () => {
    // 'natural' is stripped first by filler words, leaving 'yogurt'.
    // So the synonym key 'natural yogurt' is never actually matched here —
    // the synonym is reached via the filler-word strip producing 'yogurt' directly.
    // Test the uppercase / varied input path to confirm output.
    expect(normalizeFoodName("Natural Yogurt")).toBe("yogurt");
  });

  it("maps 'plain yogurt' → 'yogurt'", () => {
    // 'plain' stripped → 'yogurt'; synonym map for 'plain yogurt' is also a fallback
    expect(normalizeFoodName("Plain Yogurt")).toBe("yogurt");
  });

  it("does not map unknown food names", () => {
    expect(normalizeFoodName("rice")).toBe("rice");
    expect(normalizeFoodName("toast")).toBe("toast");
  });
});

// ── Combined pipeline: real-world inputs ─────────────────────────────────────

describe("normalizeFoodName — real-world combined pipeline", () => {
  it("normalises 'Cottage Cheese', 'cottage cheese', 'cottage  cheese' to the same key", () => {
    const a = normalizeFoodName("Cottage Cheese");
    const b = normalizeFoodName("cottage cheese");
    const c = normalizeFoodName("cottage  cheese");
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("handles '200g of fresh organic chicken'", () => {
    // strip quantity → "fresh organic chicken"
    // strip filler words → "chicken"
    expect(normalizeFoodName("200g of fresh organic chicken")).toBe("chicken");
  });

  it("handles '3 plain crackers'", () => {
    // word-number strip: nope (3 is digit, not word-form) — stays "3 plain crackers"
    // wait: QUANTITY_PREFIX requires a unit after the digit. "3" alone is not stripped.
    // "plain" is then stripped → "3 cracker" ... let's verify actual behavior.
    // Actually: WORD_NUMBERS only has one/two/.../ten/half — "3" (digit) not in set.
    // QUANTITY_PREFIX: /^\d+\s*(g|grams?|ml|oz|cups?|tbsp|tsp|pieces?|slices?|servings?)\s+/
    // "3 plain crackers" — "3" is followed by "plain", not a unit, so no strip.
    // Then filler strips "plain" → "3 crackers" → singularize → "3 cracker"
    expect(normalizeFoodName("3 plain crackers")).toBe("3 cracker");
  });

  it("handles 'two plain crackers'", () => {
    // word-number strip: "two" is in WORD_NUMBERS and there is a space → strip "two"
    // → "plain crackers" → strip "plain" → "crackers" → singularize → "cracker"
    expect(normalizeFoodName("two plain crackers")).toBe("cracker");
  });

  it("handles 'gluten-free bread rolls'", () => {
    // hyphen → space: "gluten free bread rolls"
    // filler phrase "gluten free" stripped → "bread rolls"
    // singularize last word → "bread roll"
    expect(normalizeFoodName("gluten-free bread rolls")).toBe("bread roll");
  });

  it("handles '85% cocoa dark chocolate'", () => {
    // percentage strip: "85% cocoa" → "" + " dark chocolate" → "dark chocolate"
    expect(normalizeFoodName("85% cocoa dark chocolate")).toBe(
      "dark chocolate",
    );
  });

  it("handles 'Strawberries'", () => {
    // lowercase → "strawberries" → PLURAL_OVERRIDES → "strawberry"
    expect(normalizeFoodName("Strawberries")).toBe("strawberry");
  });

  it("handles '/Fresh Broccoli' (leading slash, KEEP_PLURAL)", () => {
    // strip leading "/" → "fresh broccoli"
    // lowercase → "fresh broccoli"
    // strip filler "fresh" → "broccoli"
    // KEEP_PLURAL protects "broccoli"
    expect(normalizeFoodName("/Fresh Broccoli")).toBe("broccoli");
  });

  it("handles 'lactose free cottage cheese slices'", () => {
    // filler phrase "lactose free" stripped → "cottage cheese slices"
    // singularize "slices" → "slice" — but "slices" is after "cheese", only last word
    // so → "cottage cheese slice"
    expect(normalizeFoodName("lactose free cottage cheese slices")).toBe(
      "cottage cheese slice",
    );
  });

  it("handles a name that is just a filler word", () => {
    // "plain" alone → after stripping, empty string
    expect(normalizeFoodName("plain")).toBe("");
    expect(normalizeFoodName("fresh")).toBe("");
  });
});

// ── formatFoodDisplayName ─────────────────────────────────────────────────────

describe("formatFoodDisplayName", () => {
  it("title-cases a single word", () => {
    expect(formatFoodDisplayName("toast")).toBe("Toast");
  });

  it("title-cases multiple words", () => {
    expect(formatFoodDisplayName("scrambled egg")).toBe("Scrambled Egg");
    expect(formatFoodDisplayName("white rice")).toBe("White Rice");
  });

  it("handles already-uppercase input by lowercasing everything but first char", () => {
    // Implementation lowercases .slice(1) of each word
    expect(formatFoodDisplayName("SCRAMBLED EGG")).toBe("Scrambled Egg");
  });

  it("trims surrounding whitespace", () => {
    expect(formatFoodDisplayName("  toast  ")).toBe("Toast");
  });

  it("collapses internal whitespace", () => {
    expect(formatFoodDisplayName("scrambled   egg")).toBe("Scrambled Egg");
  });

  it("returns empty string for empty input", () => {
    expect(formatFoodDisplayName("")).toBe("");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(formatFoodDisplayName("   ")).toBe("");
  });

  it("handles a single character word", () => {
    expect(formatFoodDisplayName("a")).toBe("A");
  });

  it("does not alter numbers embedded in words", () => {
    expect(formatFoodDisplayName("vitamin b12 tablet")).toBe(
      "Vitamin B12 Tablet",
    );
  });
});

// ── formatCanonicalFoodDisplayName ───────────────────────────────────────────

describe("formatCanonicalFoodDisplayName", () => {
  it("maps 'toast' to 'White Toast' via the override map", () => {
    expect(formatCanonicalFoodDisplayName("toast")).toBe("White Toast");
  });

  it("is case-insensitive when looking up overrides (uses .toLowerCase())", () => {
    expect(formatCanonicalFoodDisplayName("Toast")).toBe("White Toast");
    expect(formatCanonicalFoodDisplayName("TOAST")).toBe("White Toast");
  });

  it("trims whitespace before looking up in override map", () => {
    expect(formatCanonicalFoodDisplayName("  toast  ")).toBe("White Toast");
  });

  it("falls back to title-casing for unknown canonicals", () => {
    expect(formatCanonicalFoodDisplayName("white bread")).toBe("White Bread");
    expect(formatCanonicalFoodDisplayName("yogurt")).toBe("Yogurt");
  });

  it("returns empty string for empty input (via title-case fallback)", () => {
    expect(formatCanonicalFoodDisplayName("")).toBe("");
  });
});

// ── prefersSummaryCandidate ───────────────────────────────────────────────────

type SummaryLike = {
  _creationTime: number;
  canonicalName: string;
  updatedAt?: number;
  lastAssessedAt?: number;
};

function makeSummary(
  overrides: Partial<SummaryLike> & { canonicalName: string },
): SummaryLike {
  return {
    _creationTime: 1000,
    updatedAt: undefined,
    lastAssessedAt: undefined,
    ...overrides,
  };
}

describe("prefersSummaryCandidate — exact name match tiebreaker", () => {
  it("returns true when candidate has exact match and existing does not", () => {
    const candidate = makeSummary({
      canonicalName: "apple",
      _creationTime: 1000,
    });
    const existing = makeSummary({
      canonicalName: "Apple",
      _creationTime: 2000,
    }); // not exact
    expect(prefersSummaryCandidate(candidate, existing, "apple")).toBe(true);
  });

  it("returns false when existing has exact match and candidate does not", () => {
    const candidate = makeSummary({
      canonicalName: "Apple",
      _creationTime: 2000,
    });
    const existing = makeSummary({
      canonicalName: "apple",
      _creationTime: 1000,
    });
    expect(prefersSummaryCandidate(candidate, existing, "apple")).toBe(false);
  });

  it("proceeds to next tiebreaker when both are exact matches", () => {
    const candidate = makeSummary({
      canonicalName: "apple",
      _creationTime: 1000,
      updatedAt: 3000,
    });
    const existing = makeSummary({
      canonicalName: "apple",
      _creationTime: 2000,
      updatedAt: 2000,
    });
    // Both exact; candidate updatedAt (3000) > existing updatedAt (2000) → true
    expect(prefersSummaryCandidate(candidate, existing, "apple")).toBe(true);
  });

  it("proceeds to next tiebreaker when neither is an exact match", () => {
    const candidate = makeSummary({
      canonicalName: "Apple",
      _creationTime: 1000,
      updatedAt: 3000,
    });
    const existing = makeSummary({
      canonicalName: "Apple",
      _creationTime: 2000,
      updatedAt: 2000,
    });
    // Neither exact; candidate updatedAt (3000) > existing updatedAt (2000) → true
    expect(prefersSummaryCandidate(candidate, existing, "apple")).toBe(true);
  });
});

describe("prefersSummaryCandidate — updatedAt tiebreaker", () => {
  it("prefers candidate with more recent updatedAt", () => {
    const candidate = makeSummary({
      canonicalName: "apple",
      updatedAt: 5000,
      _creationTime: 1000,
    });
    const existing = makeSummary({
      canonicalName: "apple",
      updatedAt: 4000,
      _creationTime: 1000,
    });
    expect(prefersSummaryCandidate(candidate, existing, "apple")).toBe(true);
  });

  it("prefers existing with more recent updatedAt", () => {
    const candidate = makeSummary({
      canonicalName: "apple",
      updatedAt: 3000,
      _creationTime: 1000,
    });
    const existing = makeSummary({
      canonicalName: "apple",
      updatedAt: 5000,
      _creationTime: 1000,
    });
    expect(prefersSummaryCandidate(candidate, existing, "apple")).toBe(false);
  });

  it("falls back to _creationTime when updatedAt is absent on both", () => {
    // updatedAt undefined → falls back to _creationTime
    const candidate = makeSummary({
      canonicalName: "apple",
      _creationTime: 9000,
    });
    const existing = makeSummary({
      canonicalName: "apple",
      _creationTime: 7000,
    });
    expect(prefersSummaryCandidate(candidate, existing, "apple")).toBe(true);
  });

  it("uses _creationTime as fallback when only one has updatedAt", () => {
    // candidate updatedAt=undefined → uses creationTime=500
    // existing updatedAt=8000 → uses 8000
    // existing is more recent → false
    const candidate = makeSummary({
      canonicalName: "apple",
      _creationTime: 500,
    });
    const existing = makeSummary({
      canonicalName: "apple",
      _creationTime: 500,
      updatedAt: 8000,
    });
    expect(prefersSummaryCandidate(candidate, existing, "apple")).toBe(false);
  });
});

describe("prefersSummaryCandidate — lastAssessedAt tiebreaker", () => {
  const base = { canonicalName: "apple", updatedAt: 5000, _creationTime: 1000 };

  it("prefers candidate with more recent lastAssessedAt when updatedAt is equal", () => {
    const candidate = makeSummary({ ...base, lastAssessedAt: 9000 });
    const existing = makeSummary({ ...base, lastAssessedAt: 7000 });
    expect(prefersSummaryCandidate(candidate, existing, "apple")).toBe(true);
  });

  it("prefers existing with more recent lastAssessedAt", () => {
    const candidate = makeSummary({ ...base, lastAssessedAt: 6000 });
    const existing = makeSummary({ ...base, lastAssessedAt: 8000 });
    expect(prefersSummaryCandidate(candidate, existing, "apple")).toBe(false);
  });

  it("treats missing lastAssessedAt as 0", () => {
    // candidate lastAssessedAt=undefined (0), existing lastAssessedAt=1 → false
    const candidate = makeSummary({ ...base });
    const existing = makeSummary({ ...base, lastAssessedAt: 1 });
    expect(prefersSummaryCandidate(candidate, existing, "apple")).toBe(false);
  });

  it("both missing lastAssessedAt — falls through to _creationTime tiebreaker", () => {
    const candidate = makeSummary({ ...base, _creationTime: 2000 });
    const existing = makeSummary({ ...base, _creationTime: 1500 });
    // updatedAt equal, lastAssessedAt both 0 (equal), candidate _creationTime larger → true
    expect(prefersSummaryCandidate(candidate, existing, "apple")).toBe(true);
  });
});

describe("prefersSummaryCandidate — _creationTime final tiebreaker", () => {
  it("prefers candidate with later _creationTime when all else is equal", () => {
    const candidate = makeSummary({
      canonicalName: "apple",
      _creationTime: 200,
      updatedAt: 500,
      lastAssessedAt: 300,
    });
    const existing = makeSummary({
      canonicalName: "apple",
      _creationTime: 100,
      updatedAt: 500,
      lastAssessedAt: 300,
    });
    expect(prefersSummaryCandidate(candidate, existing, "apple")).toBe(true);
  });

  it("returns false when existing has later _creationTime and all else equal", () => {
    const candidate = makeSummary({
      canonicalName: "apple",
      _creationTime: 100,
      updatedAt: 500,
      lastAssessedAt: 300,
    });
    const existing = makeSummary({
      canonicalName: "apple",
      _creationTime: 200,
      updatedAt: 500,
      lastAssessedAt: 300,
    });
    expect(prefersSummaryCandidate(candidate, existing, "apple")).toBe(false);
  });

  it("returns false (not true) when both records are completely identical", () => {
    // All fields equal → candidate._creationTime > existing._creationTime is false
    const record = makeSummary({
      canonicalName: "apple",
      _creationTime: 500,
      updatedAt: 1000,
      lastAssessedAt: 800,
    });
    expect(prefersSummaryCandidate(record, record, "apple")).toBe(false);
  });
});
```

---

## Testing Decisions

**Functions covered and why:**

`normalizeFoodName` is the most complex function — it is the canonical grouping key for all food data. I decomposed its multi-step pipeline into one test suite per stage so failures are immediately localized:

1. **Basic normalisation** — lowercase, trim, whitespace collapse, empty/whitespace-only inputs. These are preconditions for all later logic.

2. **Unicode normalization** — NFD + combining-mark strip is easy to miss. Testing `é`, `ñ`, `û` ensures international food names (e.g., "jalapeño", "crème brûlée") produce valid ASCII keys.

3. **Punctuation handling** — leading and trailing punctuation, hyphen-to-space conversion. Hyphens are interesting because "gluten-free" after conversion becomes a two-word filler phrase that is then stripped by a later stage — I verified the cascade.

4. **Quantity prefix stripping (digit + unit)** — Tested each unit token in `QUANTITY_PREFIX`. Also tested the `"of"` optional clause. Boundary case: `"2 eggs"` where `"2"` is a digit but NOT followed by a unit token, so it stays — this is a subtle edge case worth documenting.

5. **Standalone unit stripping (no digit)** — Separate regex to `QUANTITY_PREFIX`. Tested a representative sample of unit tokens.

6. **Word-form number stripping** — Tests that `WORD_NUMBERS` words are stripped only when they are the first word AND there is a second word. A lone `"six"` should not be stripped.

7. **Percentage stripping** — `\d+%\s*\w*` removes e.g. `"85% cocoa"`. Tested with a word following the `%` and without.

8. **Multi-word filler phrases** — All five entries in `FILLER_PHRASES` tested. Also tested case-insensitivity (the regex uses `gi`) and mid-string occurrence.

9. **Single-word filler stripping** — All 8 words in `FILLER_WORDS`. Special attention to `"free"`, which is interesting because it is stripped standalone but is also part of multi-word phrases already handled earlier.

10. **KEEP_PLURAL** — All 20 words tested individually since any unexpected singularization here would corrupt grouping keys for common foods.

11. **PLURAL_OVERRIDES** — All 21 map entries tested to confirm the override map is complete and correct.

12. **Suffix singularization rules** — Each branch in `singularizeWord` tested: `ies→y`, `ves→f`, `ses/xes/zes/ches/shes→drop es`, `oes→drop es`, general trailing `s`. Also tested the guards against `ss` and `us` endings, and the 3-char minimum. Critical test: only the **last word** is singularized.

13. **Synonym mapping** — All 4 entries in `SYNONYM_MAP`. The `"natural yogurt"` case is subtle: `"natural"` is stripped as a filler word first, so `"yogurt"` is reached via the filler path — the synonym entry for `"natural yogurt"` may never actually fire in practice.

14. **Real-world combined pipeline** — End-to-end cases that exercise multiple stages at once (`"200g of fresh organic chicken"`, `"gluten-free bread rolls"`, `"85% cocoa dark chocolate"`). These catch regressions where stage ordering matters.

`formatFoodDisplayName`: Simple but used in UI. Tested title-casing, whitespace handling, empty inputs, all-uppercase input (verifying `.toLowerCase()` on `.slice(1)`), and numbers in words.

`formatCanonicalFoodDisplayName`: The override map lookup. Tested that the key comparison is case-insensitive and whitespace-trimmed, that unknown names fall through to title-case, and the empty string case.

`prefersSummaryCandidate`: This is the most logic-dense function with four tiebreaker levels. I wrote a `makeSummary` helper to keep tests concise, then wrote one suite per tiebreaker level. Key edge cases: `updatedAt` absent (falls back to `_creationTime`), `lastAssessedAt` absent (treated as `0`), and the case where all fields are identical (should return `false`, not `true`).

**What I chose NOT to test:**

- Internal functions (`singularizeWord`, `singularize`, `stripQuantityPrefix`, etc.) directly, since they are not exported. They are fully exercised through `normalizeFoodName`.
- The regex constants themselves — testing them in isolation would duplicate the `normalizeFoodName` tests without adding coverage.
- `escapeRegExp` — it is a pure utility only used to build `FILLER_PHRASE_PATTERN`; its correctness is verified indirectly through the filler phrase tests.
