/**
 * Shared deterministic food parsing utilities.
 *
 * These functions handle the "fast path" of food parsing: comma splitting,
 * quantity extraction, and registry matching. They are dependency-free
 * (no imports from src/ or convex/) so both client and server can use them.
 *
 * The LLM-based parsing path lives in src/lib/foodParsing.ts (client) and
 * will move to convex/ actions in future tasks.
 *
 * @consumers
 *   - src/lib/foodParsing.ts (re-exports, uses in parseFood orchestrator)
 *   - convex/ server actions (future: server-side food processing)
 *   - shared/__tests__/foodParsing.test.ts
 */

import { canonicalizeKnownFoodName } from "./foodCanonicalization";
import { normalizeFoodName } from "./foodNormalize";
import { getFoodZone } from "./foodRegistryUtils";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface FoodComponent {
  name: string;
  canonicalName: string;
  isNew: boolean;
  quantity: number | null;
  unit: string | null;
  uncertain?: boolean;
  uncertainQuestion?: string;
  suggestedMatch?: string | null;
  preparation?: string;
  recoveryStage?: 1 | 2 | 3;
  spiceLevel?: "plain" | "mild" | "spicy";
}

export interface ParsedFoodItem {
  original: string;
  canonicalName: string;
  isNew: boolean;
  isComposite: boolean;
  quantity: number | null;
  unit: string | null;
  components: FoodComponent[];
  uncertain?: boolean;
  uncertainQuestion?: string;
  suggestedMatch?: string | null;
  preparation?: string;
  recoveryStage?: 1 | 2 | 3;
  spiceLevel?: "plain" | "mild" | "spicy";
}

export interface FoodParseResult {
  items: ParsedFoodItem[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const COUNT_WORDS: ReadonlyMap<string, number> = new Map([
  ["a", 1],
  ["an", 1],
  ["one", 1],
  ["two", 2],
  ["three", 3],
  ["four", 4],
  ["five", 5],
  ["six", 6],
  ["seven", 7],
  ["eight", 8],
  ["nine", 9],
  ["ten", 10],
  ["eleven", 11],
  ["twelve", 12],
]);

const SIZE_UNIT_MAP: ReadonlyMap<string, string> = new Map([
  ["small", "sm"],
  ["sm", "sm"],
  ["medium", "med"],
  ["med", "med"],
  ["large", "lg"],
  ["lg", "lg"],
  ["extra large", "xl"],
  ["xl", "xl"],
]);

const MEASURE_UNIT_MAP: ReadonlyMap<string, string> = new Map([
  ["g", "g"],
  ["gram", "g"],
  ["grams", "g"],
  ["kg", "kg"],
  ["kilogram", "kg"],
  ["kilograms", "kg"],
  ["ml", "ml"],
  ["millilitre", "ml"],
  ["millilitres", "ml"],
  ["milliliter", "ml"],
  ["milliliters", "ml"],
  ["l", "l"],
  ["litre", "l"],
  ["litres", "l"],
  ["liter", "l"],
  ["liters", "l"],
  ["oz", "oz"],
  ["ounce", "oz"],
  ["ounces", "oz"],
  ["lb", "lb"],
  ["pound", "lb"],
  ["pounds", "lb"],
  ["tbsp", "tbsp"],
  ["tablespoon", "tbsp"],
  ["tablespoons", "tbsp"],
  ["tsp", "tsp"],
  ["teaspoon", "tsp"],
  ["teaspoons", "tsp"],
  ["cup", "cup"],
  ["cups", "cup"],
  ["piece", "pc"],
  ["pieces", "pc"],
  ["pc", "pc"],
  ["pcs", "pc"],
  ["slice", "sl"],
  ["slices", "sl"],
  ["sl", "sl"],
]);

/**
 * Regex fragment matching all recognized measurement unit alternatives.
 * Used by both numericMeasureMatch and wordMeasureMatch to avoid duplication.
 */
const MEASURE_UNIT_PATTERN =
  "g|grams?|kg|kilograms?|ml|millilitres?|milliliters?|l|litres?|liters?|oz|ounces?|lb|pounds?|tbsp|tablespoons?|tsp|teaspoons?|cups?|pieces?|pcs?|pc|slices?|sl";

const NUMERIC_MEASURE_PATTERN = new RegExp(
  `^(\\d+(?:\\.\\d+)?)\\s*(${MEASURE_UNIT_PATTERN})\\s+(?:of\\s+)?(.+)$`,
  "i",
);

const WORD_MEASURE_PATTERN = new RegExp(
  `^(a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\\s+(${MEASURE_UNIT_PATTERN})\\s+(?:of\\s+)?(.+)$`,
  "i",
);

// ─────────────────────────────────────────────────────────────────────────────
// Public functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Split raw food input on commas, trimming and filtering empties.
 * This is the "fast path" for comma-separated entries.
 */
export function splitRawFoodItems(raw: string): string[] {
  return raw
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

/**
 * Parse a leading quantity and unit from a raw food segment.
 *
 * Examples:
 *   "200g rice"          → { parsedName: "rice", quantity: 200, unit: "g" }
 *   "two large bananas"  → { parsedName: "bananas", quantity: 2, unit: "lg" }
 *   "a bit of jam"       → { parsedName: "jam", quantity: 1, unit: "bit" }
 *   "chicken"            → { parsedName: "chicken", quantity: null, unit: null }
 */
/**
 * Ensure a parsed quantity is a finite positive number. Returns null if the
 * value is NaN, Infinity, negative, or zero. This guards against malformed
 * numeric strings that slip past the regex.
 */
function sanitizeQuantity(value: number | null): number | null {
  if (value === null) return null;
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

export function parseLeadingQuantity(raw: string): {
  parsedName: string;
  quantity: number | null;
  unit: string | null;
} {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return { parsedName: "", quantity: null, unit: null };
  }

  const approximateMatch =
    /^(a bit of|bit of|some|a handful of|handful of)\s+(.+)$/i.exec(trimmed);
  if (approximateMatch) {
    const descriptor = approximateMatch[1].toLowerCase().replace(/\s+of$/, "");
    return {
      parsedName: approximateMatch[2]?.trim() ?? trimmed,
      quantity: 1,
      unit: descriptor === "a handful" ? "handful" : descriptor,
    };
  }

  const numericSizedMatch =
    /^(\d+(?:\.\d+)?)\s+(extra large|xl|large|lg|medium|med|small|sm)\s+(.+)$/i.exec(
      trimmed,
    );
  if (numericSizedMatch) {
    const unit =
      SIZE_UNIT_MAP.get(numericSizedMatch[2]?.toLowerCase() ?? "") ?? null;
    return {
      parsedName: numericSizedMatch[3]?.trim() ?? trimmed,
      quantity: sanitizeQuantity(Number(numericSizedMatch[1])),
      unit,
    };
  }

  const numericMeasureMatch = NUMERIC_MEASURE_PATTERN.exec(trimmed);
  if (numericMeasureMatch) {
    const unit =
      MEASURE_UNIT_MAP.get(numericMeasureMatch[2]?.toLowerCase() ?? "") ?? null;
    return {
      parsedName: numericMeasureMatch[3]?.trim() ?? trimmed,
      quantity: sanitizeQuantity(Number(numericMeasureMatch[1])),
      unit,
    };
  }

  const wordMeasureMatch = WORD_MEASURE_PATTERN.exec(trimmed);
  if (wordMeasureMatch) {
    return {
      parsedName: wordMeasureMatch[3]?.trim() ?? trimmed,
      quantity: COUNT_WORDS.get(wordMeasureMatch[1]?.toLowerCase() ?? "") ?? 1,
      unit:
        MEASURE_UNIT_MAP.get(wordMeasureMatch[2]?.toLowerCase() ?? "") ?? null,
    };
  }

  const numericCountMatch = /^(\d+(?:\.\d+)?)\s+(.+)$/i.exec(trimmed);
  if (numericCountMatch) {
    return {
      parsedName: numericCountMatch[2]?.trim() ?? trimmed,
      quantity: sanitizeQuantity(Number(numericCountMatch[1])),
      unit: null,
    };
  }

  const wordCountMatch =
    /^(a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(extra large|xl|large|lg|medium|med|small|sm)\s+(.+)$/i.exec(
      trimmed,
    );
  if (wordCountMatch) {
    const quantity =
      COUNT_WORDS.get(wordCountMatch[1]?.toLowerCase() ?? "") ?? 1;
    const unit =
      SIZE_UNIT_MAP.get(wordCountMatch[2]?.toLowerCase() ?? "") ?? null;
    return {
      parsedName: wordCountMatch[3]?.trim() ?? trimmed,
      quantity,
      unit,
    };
  }

  // Standalone size word without number: "sm banana" → qty 1, unit "sm"
  const sizeOnlyMatch =
    /^(extra large|xl|large|lg|medium|med|small|sm)\s+(.+)$/i.exec(trimmed);
  if (sizeOnlyMatch) {
    const unit =
      SIZE_UNIT_MAP.get(sizeOnlyMatch[1]?.toLowerCase() ?? "") ?? null;
    return {
      parsedName: sizeOnlyMatch[2]?.trim() ?? trimmed,
      quantity: 1,
      unit,
    };
  }

  const wordOnlyCountMatch =
    /^(a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(.+)$/i.exec(
      trimmed,
    );
  if (wordOnlyCountMatch) {
    return {
      parsedName: wordOnlyCountMatch[2]?.trim() ?? trimmed,
      quantity:
        COUNT_WORDS.get(wordOnlyCountMatch[1]?.toLowerCase() ?? "") ?? 1,
      unit: null,
    };
  }

  return {
    parsedName: trimmed,
    quantity: null,
    unit: null,
  };
}

/**
 * Sanitise raw food input text before parsing.
 * Cleans up voice-to-text artefacts like orphaned units, leading punctuation, etc.
 */
export function sanitiseFoodInput(raw: string): string {
  let text = raw.trim();

  // Collapse multiple spaces into one
  text = text.replace(/\s{2,}/g, " ");

  // Strip leading punctuation/symbols (e.g., "/", "-", ".", "*")
  text = text.replace(/^[/\-.*#]+\s*/, "");

  // Remove orphaned unit prefixes at the start of the string
  // e.g., "g pasta" → "pasta", "ml juice" → "juice", "tsp jam" → "jam"
  text = text.replace(/^(g|mg|kg|ml|l|oz|lb|tsp|tbsp|cup|sl|pc)\s+/i, "");

  // Also handle orphaned units after commas in multi-item entries
  // e.g., "toast, g pasta" → "toast, pasta"
  text = text.replace(/,\s*(g|mg|kg|ml|l|oz|lb|tsp|tbsp|cup|sl|pc)\s+/gi, ", ");

  // Strip leading punctuation again after comma-separated cleanup
  text = text.replace(/,\s*[/\-.*#]+\s*/g, ", ");

  return text.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Existing name matching (user's food library)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a map from normalized food names to their original form.
 * Used for matching user input against previously logged food names.
 */
export function buildExistingNameMap(
  existingNames: string[],
): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (const name of existingNames) {
    const normalized = normalizeFoodName(name);
    if (!normalized || map.has(normalized)) continue;
    map.set(normalized, name);
  }
  return map;
}

/**
 * Try to resolve an input string against a pre-built existing name map.
 * Returns the original (un-normalized) name if found, null otherwise.
 */
export function resolveExistingCanonicalName(
  input: string,
  existingNameMap: ReadonlyMap<string, string>,
): string | null {
  const normalized = normalizeFoodName(input);
  if (!normalized) return null;
  return existingNameMap.get(normalized) ?? null;
}

/**
 * Attempt to deterministically resolve a single food segment using the
 * registry and existing name map. Returns null if the segment cannot
 * be resolved without LLM assistance.
 *
 * This is the core of the "fast path": parse quantity, try registry
 * canonicalization, try existing name lookup. If all fail, return null
 * to signal the caller should escalate to the LLM.
 */
export function buildDeterministicItem(
  original: string,
  existingNameMap: ReadonlyMap<string, string>,
): ParsedFoodItem | null {
  const trimmedOriginal = original.trim();
  if (!trimmedOriginal) return null;

  const { parsedName, quantity, unit } = parseLeadingQuantity(trimmedOriginal);
  const canonical =
    canonicalizeKnownFoodName(parsedName) ??
    canonicalizeKnownFoodName(trimmedOriginal) ??
    resolveExistingCanonicalName(parsedName, existingNameMap) ??
    resolveExistingCanonicalName(trimmedOriginal, existingNameMap);
  if (canonical === null) return null;

  const recoveryStage = getFoodZone(canonical) ?? 3;
  return {
    original: trimmedOriginal,
    canonicalName: canonical,
    isNew: false,
    isComposite: false,
    quantity,
    unit,
    recoveryStage,
    components: [
      {
        name: parsedName,
        canonicalName: canonical,
        isNew: false,
        quantity,
        unit,
        recoveryStage,
      },
    ],
  };
}

/**
 * Merge parsed item groups (keyed by original segment index) back into
 * a single FoodParseResult, preserving the original segment ordering.
 */
export function mergeParsedItems(
  totalItems: number,
  parsedGroups: Map<number, ParsedFoodItem[]>,
): FoodParseResult {
  const merged: ParsedFoodItem[] = [];
  for (let index = 0; index < totalItems; index += 1) {
    const items = parsedGroups.get(index) ?? [];
    merged.push(...items);
  }
  return { items: merged };
}
