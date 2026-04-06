/**
 * Food canonicalization — deterministic path.
 *
 * Builds a lookup map from every example in the food registry to its canonical
 * name. The LLM-based path uses the same registry but handles natural language
 * variation that the deterministic rules cannot.
 *
 * Returns null when the input does not match any known canonical. The caller
 * should pass nulls to the LLM for resolution.
 */

import { normalizeFoodName } from "./foodNormalize";
import { FOOD_REGISTRY } from "./foodRegistry";

// ─────────────────────────────────────────────────────────────────────────────
// Example lookup map
// Each registry example is normalized and mapped to its canonical.
// The canonical itself is also registered as a lookup key.
// ─────────────────────────────────────────────────────────────────────────────

function buildExampleMap(): Map<string, string> {
  const map = new Map<string, string>();
  const collisions = new Map<string, Set<string>>();

  const registerAlias = (normalized: string, canonical: string) => {
    const existing = map.get(normalized);
    if (!existing) {
      map.set(normalized, canonical);
      return;
    }
    if (existing === canonical) return;

    const conflict = collisions.get(normalized) ?? new Set([existing]);
    conflict.add(canonical);
    collisions.set(normalized, conflict);
  };

  for (const entry of FOOD_REGISTRY) {
    const normalizedCanonical = normalizeFoodName(entry.canonical);
    if (normalizedCanonical) {
      registerAlias(normalizedCanonical, entry.canonical);
    }

    for (const example of entry.examples) {
      const normalized = normalizeFoodName(example);
      if (normalized) {
        registerAlias(normalized, entry.canonical);
      }
    }
  }

  if (collisions.size > 0) {
    const details = Array.from(collisions.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(
        ([alias, canonicals]) =>
          `${alias} -> ${Array.from(canonicals).sort().join(", ")}`,
      )
      .join("; ");
    // Do not throw at module load time — a crash here takes down the entire app
    // or Convex worker. Log clearly so the issue is visible, then continue with
    // the first registered mapping for each collision. The duplicate-alias Vitest
    // test catches this at build time instead.
    console.error(
      `[foodCanonicalization] Duplicate normalized food aliases found in FOOD_REGISTRY: ${details}`,
    );
  }

  return map;
}

const EXAMPLE_MAP: ReadonlyMap<string, string> = buildExampleMap();

// ─────────────────────────────────────────────────────────────────────────────
// Quantity word stripping
// normalizeFoodName handles digit prefixes ("5 slices of") but not word-form
// quantities ("three scrambled eggs", "a couple of boiled eggs").
// ─────────────────────────────────────────────────────────────────────────────

const LEADING_QUANTITY_WORDS = new Set([
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
  "eleven",
  "twelve",
  "a",
  "an",
  "half",
  "couple",
  "few",
  "some",
  "several",
  "of",
]);

function stripLeadingQuantity(input: string): string {
  const words = input.split(" ");
  let i = 0;
  while (
    i < words.length &&
    (LEADING_QUANTITY_WORDS.has(words[i]) || /^\d+$/.test(words[i]))
  ) {
    i++;
  }
  return words.slice(i).join(" ").trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Attempt to resolve a user-entered food string to a canonical name using the
 * food registry. Returns the canonical string on a match, or null if the input
 * is not recognised.
 *
 * Null signals the caller to escalate to the LLM-based canonicalization path.
 *
 * Examples:
 *   "three scrambled eggs"  → "egg"
 *   "six poached eggs"      → "egg"
 *   "fried egg"             → "fried egg"
 *   "grilled chicken"       → "grilled chicken"
 *   "tikka masala"          → null  (pass to LLM)
 */
export function canonicalizeKnownFoodName(input: string): string | null {
  if (!input.trim()) return null;

  // First pass: normalize and look up directly
  const normalized = normalizeFoodName(input);
  if (normalized) {
    const match = EXAMPLE_MAP.get(normalized);
    if (match) return match;
  }

  // Second pass: strip leading quantity words and retry
  // Handles "three scrambled eggs" → "scrambled egg" → "egg"
  const stripped = stripLeadingQuantity(
    normalized ?? input.toLowerCase().trim(),
  );
  if (stripped && stripped !== normalized) {
    const normalizedStripped = normalizeFoodName(stripped);
    if (normalizedStripped) {
      const match = EXAMPLE_MAP.get(normalizedStripped);
      if (match) return match;
    }
  }

  return null;
}
