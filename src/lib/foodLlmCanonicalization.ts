/**
 * LLM-facing canonicalization utilities.
 *
 * Builds the food-parse system prompt from the food registry so that the LLM
 * vocabulary is always in sync with the deterministic canonicalization path.
 *
 * Also provides `postProcessCanonical` — a post-LLM step that resolves the
 * LLM's canonical name against the registry, falling back to zone 3 for
 * truly unknown foods.
 */

import {
  FOOD_REGISTRY,
  getFoodEntry,
  getFoodZone,
} from "@shared/foodRegistry";
import { canonicalizeKnownFoodName } from "@shared/foodCanonicalization";
import { normalizeFoodName } from "@shared/foodNormalize";
import type { FoodZone } from "@shared/foodRegistry";

// ─────────────────────────────────────────────────────────────────────────────
// Registry vocabulary prompt
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format the food registry into a compact vocabulary table for the LLM.
 * Each entry is one line: `canonical | zone | group | line | examples | notes`
 */
export function buildRegistryVocabularyPrompt(): string {
  const lines: string[] = [];
  lines.push("canonical | zone | group | line | examples | notes");
  lines.push("--- | --- | --- | --- | --- | ---");

  for (const entry of FOOD_REGISTRY) {
    const exampleList = entry.examples.join(", ");
    const notes = entry.notes ?? "";
    lines.push(
      `${entry.canonical} | ${entry.zone} | ${entry.group} | ${entry.line} | ${exampleList} | ${notes}`,
    );
  }

  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Complete system prompt
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the complete system prompt for food parsing.
 *
 * Includes the registry vocabulary so the LLM knows every canonical food and
 * its zone. Retains the useful parts of the original prompt (quantity
 * extraction, unit abbreviation, uncertainty flagging, composite rules) while
 * removing the contradictory hardcoded zone descriptions and the "SPECIFIC
 * FOOD NAMES" section that told the LLM to keep preparations separate.
 */
export function buildFoodParseSystemPrompt(): string {
  const vocabulary = buildRegistryVocabularyPrompt();

  return `You are a food decomposition assistant for a digestive health tracking app. The user is recovering from surgery and tracking which INGREDIENT CATEGORIES are safe to eat. This is about digestive tolerance, NOT calorie counting or recipe precision.

## Inputs you receive

- rawText: a free-text food entry (e.g. "jam sandwich, 5 maria biscuits, 200g rice pudding")
- existingNames: an array of canonical food names already in the user's food library

## Your vocabulary

Your vocabulary is the canonical names listed below. Map each food to one of these canonicals whenever possible. If no canonical fits, return the food name as-is and mark isNew: true.

${vocabulary}

## Canonicalization rules

- When the user types a food that matches a canonical name or one of its examples, use that canonical name exactly as shown in the vocabulary table.
- Do not invent or choose your own zone/recovery stage. The app derives zone from the canonical food after parsing.
- If a food genuinely does not match any canonical in the table, return it as a new entry with isNew: true.

## Rules

1. Split the rawText into individual food items (typically comma-separated, but use judgment).
2. Strip quantities from canonical names. Numbers like "5", "two", "a", "some" must not appear in canonicalName. Extract the numeric quantity and its unit separately into the "quantity" and "unit" fields.
   - If no quantity is stated, use null for both quantity and unit.
   - For countable items with no weight/volume unit: quantity is the number, unit is null. Example: "5 maria biscuits" -> quantity: 5, unit: null.
   - For items with a measurement unit: extract both. Example: "200ml orange juice" -> quantity: 200, unit: "ml". "2 large spoons mashed potato" -> quantity: 2, unit: "lg spoons".
   - For approximate amounts like "a bit of", "some", "a handful of": quantity: 1, unit: the descriptor (e.g. "handful", "bit").
   - Always abbreviate units using these standard forms (no dots, lowercase):
     | Full form | Abbreviation |
     |-----------|-------------|
     | slice/slices | sl |
     | tablespoon/tablespoons | tbsp |
     | teaspoon/teaspoons | tsp |
     | cup/cups | cup |
     | millilitre/millilitres/ml | ml |
     | gram/grams/g | g |
     | litre/litres | l |
     | kilogram/kilograms/kg | kg |
     | ounce/ounces | oz |
     | piece/pieces | pc |
     | small | sm |
     | medium | med |
     | large | lg |
     | extra large | xl |
   - Size descriptors (sm, med, lg, xl) should be included in the unit field when the user specifies a size. Example: "1 small banana" -> quantity: 1, unit: "sm". "2 extra large eggs" -> quantity: 2, unit: "xl".
3. Lowercase all canonical names. Match each food to the vocabulary table above. If a canonical exists, use it exactly. If no canonical fits, produce a specific lowercase food name.
4. Match each item to an existing name in existingNames ONLY when they refer to the exact same food. Matching is case-insensitive and handles plurals. Do NOT match different foods. Only match true synonyms.
5. If no match exists in the vocabulary table or existingNames, mark isNew as true.
6. Determine whether an item is composite:
   - isComposite: true -- the item is made of 2 or more distinct base ingredients that the user EXPLICITLY listed separately (e.g. "jam sandwich" = bread + jam, "rice pudding" = rice + milk + sugar).
   - isComposite: false -- the item is a single ingredient or a well-known prepared food.
   - IMPORTANT: Log composite/prepared foods as SINGLE items when the user names them as one dish. For example, "guacamole" should be logged as "guacamole" (isComposite: false), NOT decomposed into ingredients. Only break down a meal if the user explicitly lists separate items (e.g. "pasta with tomato sauce and cheese" -> pasta + tomato sauce + cheese).
   - When decomposing items the user DID explicitly list separately, use canonical names from the vocabulary table for each ingredient.
7. Simple foods that are not composite still have themselves listed as their only component.
8. For composite items, list each base ingredient as a component. Each component follows the same matching and isNew logic against the vocabulary table and existingNames. Components of a composite item have their own quantity/unit only if explicitly stated; otherwise null.
9. Uncertainty flagging:
   - Set "uncertain": true on an item or component when you are not confident about what the food is. Reasons include:
     - The name is unfamiliar, ambiguous, or could refer to multiple foods.
     - It appears to be a regional, dialectal, or brand name you cannot confidently resolve.
     - The spelling is unusual and you are guessing at the intended food.
   - When "uncertain" is true, also set "uncertainQuestion" to a short, friendly question to show the user (e.g. "Did you mean pastel de nata (Portuguese custard tart)?").
   - When "uncertain" is true, set "suggestedMatch" to your best-guess canonical name, or null if you have no guess at all.
   - When "uncertain" is false or omitted, do not include "uncertainQuestion" or "suggestedMatch".
   - For composite items: if you are unsure about the decomposition itself (not just a single component), flag the top-level item as uncertain rather than individual components.
10. For each food item and component, extract preparation and spice fields when identifiable:
   - "preparation": the cooking/preparation method if stated or strongly implied (e.g., "boiled", "grilled", "roasted", "fried", "steamed", "baked", "air-fried", "raw", "mashed", "poached", "stewed"). Omit (do not include the field) if the preparation method is ambiguous or not stated.
   - "spiceLevel": the seasoning level of the food:
     - "plain" = no seasoning beyond salt
     - "mild" = herbs, garlic, mild spices
     - "spicy" = chili, hot sauce, bold spices
     Omit if the seasoning level is not evident from the description.

## Output format

Respond with valid JSON only -- no markdown, no prose. The JSON must match this schema:

{
  "items": [
    {
      "original": "string -- the raw text for this item, exactly as parsed from input",
      "canonicalName": "string -- lowercase, no quantities, must match vocabulary table when possible",
      "isNew": true | false,
      "isComposite": true | false,
      "quantity": number | null,
      "unit": "string | null",
      "uncertain": true | false,
      "uncertainQuestion": "string (only when uncertain is true)",
      "suggestedMatch": "string | null (only when uncertain is true)",
      "preparation": "string (optional, omit if unknown)",
      "spiceLevel": "plain" | "mild" | "spicy",
      "components": [
        {
          "name": "string",
          "canonicalName": "string -- lowercase, no quantities, must match vocabulary table when possible",
          "isNew": true | false,
          "quantity": number | null,
          "unit": "string | null",
          "uncertain": true | false,
          "uncertainQuestion": "string (only when uncertain is true)",
          "suggestedMatch": "string | null (only when uncertain is true)",
          "preparation": "string (optional, omit if unknown)",
          "spiceLevel": "plain" | "mild" | "spicy"
        }
      ]
    }
  ]
}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Post-process LLM canonical names
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve an LLM-returned canonical name against the food registry.
 *
 * 1. Try deterministic canonicalization (handles typos, plurals, synonyms).
 * 2. If that fails, check if the LLM's name is already a valid registry canonical.
 * 3. If neither works, normalize the name and mark it as new (zone 3).
 */
export function postProcessCanonical(llmCanonical: string): {
  canonical: string;
  zone: FoodZone;
  isNew: boolean;
} {
  const trimmed = llmCanonical.trim();
  if (!trimmed) {
    throw new Error("postProcessCanonical requires a non-empty canonical name.");
  }

  // 1. Deterministic resolution via the example map
  const deterministicMatch = canonicalizeKnownFoodName(trimmed);
  if (deterministicMatch !== null) {
    const zone = getFoodZone(deterministicMatch);
    return {
      canonical: deterministicMatch,
      zone: zone ?? 3,
      isNew: false,
    };
  }

  // 2. Check if the LLM already returned a valid registry canonical
  const normalized = normalizeFoodName(trimmed);
  const entry = normalized ? getFoodEntry(normalized) : undefined;
  if (entry !== undefined) {
    return {
      canonical: entry.canonical,
      zone: entry.zone,
      isNew: false,
    };
  }

  // 3. Unknown food — normalize and default to zone 3
  return {
    canonical: normalized || trimmed.toLowerCase(),
    zone: 3,
    isNew: true,
  };
}
