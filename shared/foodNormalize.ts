/**
 * Shared food name normalisation utilities.
 *
 * Every food name that becomes a grouping key must pass through
 * `normalizeFoodName` so that "Cottage Cheese", "cottage cheese",
 * and "cottage  cheese" all resolve to the same key.
 */

/**
 * Words that should NOT be de-pluralised because the singular form
 * is a different word or the trailing "s" is part of the root.
 */
const KEEP_PLURAL = new Set([
  "hummus",
  "couscous",
  "asparagus",
  "citrus",
  "pancreas",
  "diabetes",
  "lens",
  "plus",
  "gas",
  "lass",
  "bass",
  "mass",
  "glass",
  "grass",
  "class",
  "molasses",
  "swiss",
  "aioli",
  "broccoli",
]);

/**
 * Explicit plural → singular overrides for common food words where
 * simple suffix stripping produces the wrong result.
 */
const PLURAL_OVERRIDES: ReadonlyMap<string, string> = new Map([
  ["berries", "berry"],
  ["cherries", "cherry"],
  ["strawberries", "strawberry"],
  ["blueberries", "blueberry"],
  ["raspberries", "raspberry"],
  ["blackberries", "blackberry"],
  ["cranberries", "cranberry"],
  ["calories", "calorie"],
  ["cookies", "cookie"],
  ["brownies", "brownie"],
  ["smoothies", "smoothie"],
  ["potatoes", "potato"],
  ["tomatoes", "tomato"],
  ["mangoes", "mango"],
  ["avocados", "avocado"],
  ["tortillas", "tortilla"],
  ["leaves", "leaf"],
  ["cheeses", "cheese"],
  ["loaves", "loaf"],
  ["halves", "half"],
  ["knives", "knife"],
]);

/**
 * Basic singularisation for a single word.
 * Catches ~90% of common food plurals without any NLP dependency.
 */
function singularizeWord(word: string): string {
  if (word.length <= 3) return word;
  if (KEEP_PLURAL.has(word)) return word;

  // Check explicit overrides first
  const override = PLURAL_OVERRIDES.get(word);
  if (override) return override;

  // "ies" → "y" (e.g., "pastries" → "pastry") — but not "series"
  if (word.endsWith("ies") && word.length > 4) {
    return `${word.slice(0, -3)}y`;
  }

  // "ves" → "f" (e.g., "halves" → "half") — already handled by overrides
  // but catch remaining cases
  if (word.endsWith("ves") && word.length > 4) {
    return `${word.slice(0, -3)}f`;
  }

  // "ses" / "xes" / "zes" / "ches" / "shes" — drop "es"
  if (
    word.endsWith("ses") ||
    word.endsWith("xes") ||
    word.endsWith("zes") ||
    word.endsWith("ches") ||
    word.endsWith("shes")
  ) {
    return word.slice(0, -2);
  }

  // "oes" → "o" (e.g., "tomatoes" → "tomato") — already in overrides
  // but catch remaining cases
  if (word.endsWith("oes") && word.length > 4) {
    return word.slice(0, -2);
  }

  // General trailing "s" — but not "ss" (e.g., "grass", "bass")
  if (word.endsWith("s") && !word.endsWith("ss") && !word.endsWith("us")) {
    return word.slice(0, -1);
  }

  return word;
}

/**
 * Singularise a multi-word food name. Only the last word is singularised
 * because that's the noun in most food phrases (e.g., "chicken wings" → "chicken wing").
 */
function singularize(name: string): string {
  const words = name.split(" ");
  if (words.length === 0) return name;

  const lastIndex = words.length - 1;
  words[lastIndex] = singularizeWord(words[lastIndex]);

  return words.join(" ");
}

const QUANTITY_PREFIX =
  /^\d+\s*(g|grams?|ml|oz|cups?|tbsp|tsp|pieces?|slices?|servings?)\s+(of\s+)?/i;

/** Standalone unit words at start of string, with or without a leading digit. */
const STANDALONE_UNIT_PREFIX =
  /^(g|mg|kg|grams?|kilograms?|ml|millilitres?|milliliters?|l|litres?|liters?|oz|ounces?|lb|pounds?|tsp|teaspoons?|tbsp|tablespoons?|cups?|pieces?|pcs?|pc|slices?|sl|servings?)\s+(of\s+)?/i;

const FILLER_WORDS = new Set([
  "plain",
  "fresh",
  "organic",
  "homemade",
  "natural",
  "some",
  "a",
  "the",
  "free",
]);

/**
 * Multi-word filler phrases to strip before single-word filler stripping.
 * Order matters: longer phrases first.
 */
const FILLER_PHRASES = ["lactose free", "gluten free", "sugar free", "fat free", "dairy free"];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const FILLER_PHRASE_PATTERN = new RegExp(
  `\\b(?:${FILLER_PHRASES.map(escapeRegExp).join("|")})\\b`,
  "gi",
);

/** Word-form numbers that appear as quantities ("six crackers", "two eggs"). */
const WORD_NUMBERS = new Set([
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "half",
]);

const SYNONYM_MAP: ReadonlyMap<string, string> = new Map([
  ["mashed potato", "pureed potato"],
  ["yoghurt", "yogurt"],
  ["natural yogurt", "yogurt"],
  ["plain yogurt", "yogurt"],
]);

function stripQuantityPrefix(name: string): string {
  return name.replace(QUANTITY_PREFIX, "");
}

function stripFillerWords(name: string): string {
  return name
    .split(" ")
    .filter((word) => !FILLER_WORDS.has(word))
    .join(" ");
}

function applySynonyms(name: string): string {
  return SYNONYM_MAP.get(name) ?? name;
}

/**
 * Normalise a food name into a canonical grouping key.
 *
 * - Trims whitespace and lowercases
 * - Collapses multiple spaces to a single space
 * - Strips leading quantity prefixes (e.g., "200g of" or "5 slices")
 * - Strips filler words (plain, fresh, organic) but keeps preparation words (fried, boiled, mashed)
 * - Applies synonym mapping for known equivalents
 * - Basic singularisation of the last word
 *
 * The result is suitable for use as a Map key to group food trials.
 */
export function normalizeFoodName(value: string): string {
  let cleaned = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
  if (!cleaned) return cleaned;

  // Strip leading punctuation (/, -, *, #, .)
  cleaned = cleaned.replace(/^[/\-.*#]+\s*/, "");
  // Strip trailing punctuation (periods, commas, semicolons, etc.)
  cleaned = cleaned.replace(/[.,;:!?]+$/, "");
  // Normalize hyphens to spaces
  cleaned = cleaned.replace(/-/g, " ").replace(/\s+/g, " ").trim();

  if (!cleaned) return cleaned;

  // Strip "200g of" style prefixes (digit + unit)
  cleaned = stripQuantityPrefix(cleaned).trim();
  // Strip standalone unit words without digits ("grams of", "tsp", "g")
  cleaned = cleaned.replace(STANDALONE_UNIT_PREFIX, "").trim();
  // Strip leading word-form numbers ("six crackers" → "crackers")
  const firstWord = cleaned.split(" ")[0];
  if (firstWord && WORD_NUMBERS.has(firstWord) && cleaned.includes(" ")) {
    cleaned = cleaned.slice(firstWord.length).trim();
  }
  // Strip percentage patterns ("85% cocoa" → "", "50% fat" → "")
  cleaned = cleaned.replace(/\d+%\s*\w*/g, "").trim();
  // Strip multi-word filler phrases ("lactose free cheese" → "cheese")
  cleaned = cleaned.replace(FILLER_PHRASE_PATTERN, "").trim();

  cleaned = stripFillerWords(cleaned).trim();
  cleaned = cleaned.replace(/\s+/g, " ");
  if (!cleaned) return cleaned;
  cleaned = singularize(cleaned);
  return applySynonyms(cleaned);
}

/**
 * Format a food name for display: title-case each word.
 */
export function formatFoodDisplayName(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

// Display name overrides for canonicals where title-casing alone is insufficient
const CANONICAL_DISPLAY_OVERRIDES: ReadonlyMap<string, string> = new Map([
  ["toast", "White Toast"],
]);

export function formatCanonicalFoodDisplayName(value: string): string {
  const key = value.trim().toLowerCase();
  return CANONICAL_DISPLAY_OVERRIDES.get(key) ?? formatFoodDisplayName(value);
}

// ---------------------------------------------------------------------------
// Shared summary-comparison utility (used by computeAggregates + aggregateQueries)
// ---------------------------------------------------------------------------

/**
 * Given two foodTrialSummary rows that resolve to the same canonical name,
 * determine whether `candidate` should be preferred over `existing`.
 *
 * Tiebreakers (in order):
 * 1. Exact canonical name match wins over a non-exact match.
 * 2. Most recently updated (updatedAt, falling back to _creationTime).
 * 3. Most recently assessed (lastAssessedAt).
 * 4. Most recently created (_creationTime).
 */
export function prefersSummaryCandidate<
  T extends {
    _creationTime: number;
    canonicalName: string;
    updatedAt?: number;
    lastAssessedAt?: number;
  },
>(candidate: T, existing: T, normalizedCanonicalName: string): boolean {
  const candidateExact = candidate.canonicalName === normalizedCanonicalName;
  const existingExact = existing.canonicalName === normalizedCanonicalName;
  if (candidateExact !== existingExact) return candidateExact;

  const candidateUpdatedAt = candidate.updatedAt ?? candidate._creationTime;
  const existingUpdatedAt = existing.updatedAt ?? existing._creationTime;
  if (candidateUpdatedAt !== existingUpdatedAt) {
    return candidateUpdatedAt > existingUpdatedAt;
  }

  const candidateLastAssessedAt = candidate.lastAssessedAt ?? 0;
  const existingLastAssessedAt = existing.lastAssessedAt ?? 0;
  if (candidateLastAssessedAt !== existingLastAssessedAt) {
    return candidateLastAssessedAt > existingLastAssessedAt;
  }

  return candidate._creationTime > existing._creationTime;
}
