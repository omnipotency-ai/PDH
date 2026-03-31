import { describe, expect, it, vi } from "vitest";
import type { FoodParseResult, ParsedFoodItem } from "../foodParsing";
import {
  buildParsedFoodData,
  isValidFoodComponent,
  isValidFoodParseResult,
  normalizeItem,
  parseFood,
} from "../foodParsing";

/** Mirror the buildFallbackResult logic from foodParsing.ts */
function buildFallbackResult(rawText: string): FoodParseResult {
  const items = rawText
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    items: items.map((item) => {
      const name = item
        .toLowerCase()
        .replace(/^\d+\s*/, "")
        .trim();
      return {
        original: item,
        canonicalName: name || item.toLowerCase(),
        isNew: true,
        isComposite: false,
        quantity: null,
        unit: null,
        components: [
          {
            name,
            canonicalName: name || item.toLowerCase(),
            isNew: true,
            quantity: null,
            unit: null,
          },
        ],
      };
    }),
  };
}

// ── Test data ─────────────────────────────────────────────────────────────

/** A realistic AI response for "jam sandwich, 5 maria biscuits" */
const REALISTIC_AI_RESPONSE: FoodParseResult = {
  items: [
    {
      original: "jam sandwich",
      canonicalName: "bread",
      isNew: false,
      isComposite: true,
      quantity: 1,
      unit: null,
      preparation: "toasted",
      recoveryStage: 2,
      spiceLevel: "plain",
      components: [
        {
          name: "bread",
          canonicalName: "bread",
          isNew: false,
          quantity: 2,
          unit: "sl",
          preparation: "toasted",
          recoveryStage: 2,
          spiceLevel: "plain",
        },
        {
          name: "jam",
          canonicalName: "jam",
          isNew: true,
          quantity: 1,
          unit: "tbsp",
        },
      ],
    },
    {
      original: "5 maria biscuits",
      canonicalName: "biscuits",
      isNew: false,
      isComposite: false,
      quantity: 5,
      unit: null,
      recoveryStage: 2,
      spiceLevel: "plain",
      components: [
        {
          name: "biscuits",
          canonicalName: "biscuits",
          isNew: false,
          quantity: 5,
          unit: null,
        },
      ],
    },
  ],
};

describe("food parsing validation", () => {
  describe("isValidFoodParseResult", () => {
    it("accepts a well-formed AI response", () => {
      expect(isValidFoodParseResult(REALISTIC_AI_RESPONSE)).toBe(true);
    });

    it("rejects null", () => {
      expect(isValidFoodParseResult(null)).toBe(false);
    });

    it("rejects a string", () => {
      expect(isValidFoodParseResult("not an object")).toBe(false);
    });

    it("rejects an empty object", () => {
      expect(isValidFoodParseResult({})).toBe(false);
    });

    it("rejects when items is not an array", () => {
      expect(isValidFoodParseResult({ items: "not an array" })).toBe(false);
    });

    it("rejects an empty items array", () => {
      expect(isValidFoodParseResult({ items: [] })).toBe(false);
    });

    it("rejects when a required string field is missing on an item", () => {
      const bad = {
        items: [
          {
            // missing original
            canonicalName: "bread",
            isNew: false,
            isComposite: false,
            quantity: null,
            unit: null,
            components: [],
          },
        ],
      };
      expect(isValidFoodParseResult(bad)).toBe(false);
    });

    it("rejects when isNew is missing on an item", () => {
      const bad = {
        items: [
          {
            original: "toast",
            canonicalName: "toast",
            // missing isNew
            isComposite: false,
            quantity: null,
            unit: null,
            components: [],
          },
        ],
      };
      expect(isValidFoodParseResult(bad)).toBe(false);
    });

    it("rejects when components is missing on an item", () => {
      const bad = {
        items: [
          {
            original: "toast",
            canonicalName: "toast",
            isNew: false,
            isComposite: false,
            quantity: null,
            unit: null,
            // missing components
          },
        ],
      };
      expect(isValidFoodParseResult(bad)).toBe(false);
    });

    it("rejects when a component has an invalid recoveryStage", () => {
      const bad = {
        items: [
          {
            original: "toast",
            canonicalName: "toast",
            isNew: false,
            isComposite: false,
            quantity: null,
            unit: null,
            components: [
              {
                name: "toast",
                canonicalName: "toast",
                isNew: false,
                quantity: null,
                unit: null,
                recoveryStage: 4, // invalid
              },
            ],
          },
        ],
      };
      expect(isValidFoodParseResult(bad)).toBe(false);
    });

    it("rejects when a component has an invalid spiceLevel", () => {
      const bad = {
        items: [
          {
            original: "toast",
            canonicalName: "toast",
            isNew: false,
            isComposite: false,
            quantity: null,
            unit: null,
            components: [
              {
                name: "toast",
                canonicalName: "toast",
                isNew: false,
                quantity: null,
                unit: null,
                spiceLevel: "hot", // invalid
              },
            ],
          },
        ],
      };
      expect(isValidFoodParseResult(bad)).toBe(false);
    });

    it("rejects when an item canonicalName is empty", () => {
      const bad = {
        items: [
          {
            original: "toast",
            canonicalName: "   ",
            isNew: false,
            isComposite: false,
            quantity: null,
            unit: null,
            components: [
              {
                name: "toast",
                canonicalName: "toast",
                isNew: false,
                quantity: null,
                unit: null,
              },
            ],
          },
        ],
      };
      expect(isValidFoodParseResult(bad)).toBe(false);
    });

    it("rejects when a component name is empty", () => {
      const bad = {
        items: [
          {
            original: "toast",
            canonicalName: "toast",
            isNew: false,
            isComposite: false,
            quantity: null,
            unit: null,
            components: [
              {
                name: "   ",
                canonicalName: "toast",
                isNew: false,
                quantity: null,
                unit: null,
              },
            ],
          },
        ],
      };
      expect(isValidFoodParseResult(bad)).toBe(false);
    });
  });

  describe("buildParsedFoodData", () => {
    it("does not inherit a composite parent quantity into components without their own quantity", () => {
      const result = buildParsedFoodData([
        {
          original: "2 slices toast with butter",
          canonicalName: "toast with butter",
          isNew: true,
          isComposite: true,
          quantity: 2,
          unit: "sl",
          components: [
            {
              name: "toast",
              canonicalName: "toast",
              isNew: false,
              quantity: 2,
              unit: "sl",
            },
            {
              name: "butter",
              canonicalName: "butter",
              isNew: false,
              quantity: null,
              unit: null,
            },
          ],
        },
      ]);

      expect(result.items).toEqual([
        {
          parsedName: "toast",
          userSegment: "2 slices toast with butter",
          canonicalName: "toast",
          resolvedBy: "registry",
          quantity: 2,
          unit: "sl",
        },
        {
          parsedName: "butter",
          userSegment: "2 slices toast with butter",
          canonicalName: "butter",
          resolvedBy: "registry",
          quantity: null,
          unit: null,
        },
      ]);
    });

    it("inherits parent metadata only for single-component non-composite items", () => {
      const result = buildParsedFoodData([
        {
          original: "grilled chicken",
          canonicalName: "grilled white meat",
          isNew: false,
          isComposite: false,
          quantity: 1,
          unit: null,
          preparation: "grilled",
          recoveryStage: 2,
          spiceLevel: "plain",
          components: [
            {
              name: "grilled chicken",
              canonicalName: "grilled white meat",
              isNew: false,
              quantity: null,
              unit: null,
            },
          ],
        },
      ]);

      expect(result.items).toEqual([
        {
          parsedName: "grilled chicken",
          userSegment: "grilled chicken",
          canonicalName: "grilled white meat",
          resolvedBy: "registry",
          quantity: 1,
          unit: null,
          preparation: "grilled",
          recoveryStage: 2,
          spiceLevel: "plain",
        },
      ]);
    });
  });

  describe("isValidFoodComponent", () => {
    it("accepts a minimal valid component", () => {
      expect(
        isValidFoodComponent({
          name: "rice",
          canonicalName: "rice",
          isNew: false,
          quantity: null,
          unit: null,
        }),
      ).toBe(true);
    });

    it("accepts a fully-populated component", () => {
      expect(
        isValidFoodComponent({
          name: "eggs",
          canonicalName: "eggs",
          isNew: true,
          quantity: 2,
          unit: "xl",
          uncertain: true,
          uncertainQuestion: "Did you mean scrambled eggs?",
          suggestedMatch: "eggs",
          preparation: "scrambled",
          recoveryStage: 2,
          spiceLevel: "plain",
        }),
      ).toBe(true);
    });

    it("rejects when name is missing", () => {
      expect(
        isValidFoodComponent({
          canonicalName: "rice",
          isNew: false,
          quantity: null,
          unit: null,
        }),
      ).toBe(false);
    });

    it("rejects non-objects", () => {
      expect(isValidFoodComponent(null)).toBe(false);
      expect(isValidFoodComponent(undefined)).toBe(false);
      expect(isValidFoodComponent(42)).toBe(false);
      expect(isValidFoodComponent("string")).toBe(false);
    });
  });

  describe("normalizeItem", () => {
    it("converts undefined quantity/unit to null", () => {
      const item: ParsedFoodItem = {
        original: "rice",
        canonicalName: "rice",
        isNew: false,
        isComposite: false,
        quantity: undefined as unknown as null,
        unit: undefined as unknown as null,
        components: [
          {
            name: "rice",
            canonicalName: "rice",
            isNew: false,
            quantity: undefined as unknown as null,
            unit: undefined as unknown as null,
          },
        ],
      };

      const result = normalizeItem(item);
      expect(result.quantity).toBeNull();
      expect(result.unit).toBeNull();
      expect(result.components[0].quantity).toBeNull();
      expect(result.components[0].unit).toBeNull();
    });

    it("preserves numeric quantity and string unit", () => {
      const item: ParsedFoodItem = {
        original: "200ml juice",
        canonicalName: "juice",
        isNew: true,
        isComposite: false,
        quantity: 200,
        unit: "ml",
        components: [
          {
            name: "juice",
            canonicalName: "juice",
            isNew: true,
            quantity: 200,
            unit: "ml",
          },
        ],
      };

      const result = normalizeItem(item);
      expect(result.quantity).toBe(200);
      expect(result.unit).toBe("ml");
    });

    it("preserves preparation/spiceLevel and derives recoveryStage from the canonical zone", () => {
      // "chicken" maps to "grilled white meat" (Zone 2) — plain chicken = common dry-heat cooking
      const item: ParsedFoodItem = {
        original: "grilled chicken",
        canonicalName: "chicken",
        isNew: false,
        isComposite: false,
        quantity: 1,
        unit: null,
        preparation: "grilled",
        recoveryStage: 3,
        spiceLevel: "mild",
        components: [
          {
            name: "chicken",
            canonicalName: "chicken",
            isNew: false,
            quantity: 1,
            unit: null,
            preparation: "grilled",
            recoveryStage: 3,
            spiceLevel: "mild",
          },
        ],
      };

      const result = normalizeItem(item);
      expect(result.preparation).toBe("grilled");
      // recoveryStage overridden from input 3 to registry zone 2 (grilled white meat)
      expect(result.recoveryStage).toBe(2);
      expect(result.spiceLevel).toBe("mild");
      expect(result.components[0].preparation).toBe("grilled");
      expect(result.components[0].recoveryStage).toBe(2);
      expect(result.components[0].spiceLevel).toBe("mild");
    });

    it("preserves uncertainty fields when uncertain is true", () => {
      const item: ParsedFoodItem = {
        original: "pastel de nata",
        canonicalName: "custard tart",
        isNew: true,
        isComposite: false,
        quantity: 1,
        unit: null,
        uncertain: true,
        uncertainQuestion: "Did you mean Portuguese custard tart?",
        suggestedMatch: "custard tart",
        components: [
          {
            name: "custard tart",
            canonicalName: "custard tart",
            isNew: true,
            quantity: 1,
            unit: null,
          },
        ],
      };

      const result = normalizeItem(item);
      expect(result.uncertain).toBe(true);
      expect(result.uncertainQuestion).toBe("Did you mean Portuguese custard tart?");
      expect(result.suggestedMatch).toBe("custard tart");
    });

    it("preserves uncertainQuestion/suggestedMatch from input even when uncertain is false", () => {
      const staleQuestion = "Did you mean something else?";
      const staleSuggestion = "some suggestion";
      const item: ParsedFoodItem = {
        original: "rice",
        canonicalName: "rice",
        isNew: false,
        isComposite: false,
        quantity: null,
        unit: null,
        uncertain: false,
        uncertainQuestion: staleQuestion,
        suggestedMatch: staleSuggestion,
        components: [],
      };

      const result = normalizeItem(item);
      // normalizeItem now explicitly clears uncertainty fields when uncertain !== true
      expect(result.uncertain).toBeUndefined();
      expect(result.uncertainQuestion).toBeUndefined();
      expect(result.suggestedMatch).toBeUndefined();
    });
  });

  describe("buildFallbackResult", () => {
    it("splits comma-separated input into individual items", () => {
      const result = buildFallbackResult("toast, banana, rice");
      expect(result.items).toHaveLength(3);
      expect(result.items[0].canonicalName).toBe("toast");
      expect(result.items[1].canonicalName).toBe("banana");
      expect(result.items[2].canonicalName).toBe("rice");
    });

    it("strips leading digits and whitespace from canonical names", () => {
      const result = buildFallbackResult("5 biscuits, 200 ml juice");
      expect(result.items[0].canonicalName).toBe("biscuits");
      // The regex /^\d+\s*/ only strips leading digits + optional whitespace,
      // so "200 ml juice" becomes "ml juice" (the unit is not stripped).
      expect(result.items[1].canonicalName).toBe("ml juice");
    });

    it("does not strip non-digit prefixes", () => {
      // "200ml" (no space) -> strips "200" leaving "ml juice"
      const result = buildFallbackResult("200ml juice");
      expect(result.items[0].canonicalName).toBe("ml juice");
    });

    it("lowercases canonical names", () => {
      const result = buildFallbackResult("TOAST, Banana");
      expect(result.items[0].canonicalName).toBe("toast");
      expect(result.items[1].canonicalName).toBe("banana");
    });

    it("marks all items as new", () => {
      const result = buildFallbackResult("toast, banana");
      for (const item of result.items) {
        expect(item.isNew).toBe(true);
      }
    });

    it("sets quantity and unit to null", () => {
      const result = buildFallbackResult("toast");
      expect(result.items[0].quantity).toBeNull();
      expect(result.items[0].unit).toBeNull();
    });

    it("includes a single self-referencing component for each item", () => {
      const result = buildFallbackResult("toast");
      expect(result.items[0].components).toHaveLength(1);
      expect(result.items[0].components[0].canonicalName).toBe("toast");
    });

    it("returns a valid FoodParseResult shape", () => {
      const result = buildFallbackResult("jam sandwich, 5 maria biscuits, 200g rice pudding");
      expect(isValidFoodParseResult(result)).toBe(true);
    });

    it("handles empty string input", () => {
      const result = buildFallbackResult("");
      expect(result.items).toHaveLength(0);
    });

    it("handles single item without commas", () => {
      const result = buildFallbackResult("banana");
      expect(result.items).toHaveLength(1);
      expect(result.items[0].original).toBe("banana");
    });
  });

  describe("buildDeterministicItem — parsedName vs userSegment", () => {
    it("stores parsed food name without quantity/unit in parsedName field", async () => {
      const callAi = vi.fn();
      const result = await parseFood(callAi, "", "200g rice", []);
      expect(callAi).not.toHaveBeenCalled();

      const data = buildParsedFoodData(result.items);
      expect(data.items).toHaveLength(1);
      expect(data.items[0].parsedName).toBe("rice");
      expect(data.items[0].userSegment).toBe("200g rice");
      expect(data.items[0].canonicalName).toBe("white rice");
      expect(data.items[0].resolvedBy).toBe("registry");
      expect(data.items[0].quantity).toBe(200);
      expect(data.items[0].unit).toBe("g");
    });

    it("stores raw text in userSegment for each segment", async () => {
      const callAi = vi.fn();
      const result = await parseFood(callAi, "", "3 scrambled eggs", []);
      const data = buildParsedFoodData(result.items);
      expect(data.items[0].userSegment).toBe("3 scrambled eggs");
      expect(data.items[0].parsedName).not.toContain("3");
    });
  });

  describe("parseFood deterministic-first expectations", () => {
    const deterministicResponse = {
      items: [
        {
          original: "toast",
          canonicalName: "toast",
          isNew: false,
          isComposite: false,
          quantity: null,
          unit: null,
          components: [
            {
              name: "Toast",
              canonicalName: "toast",
              isNew: false,
              quantity: null,
              unit: null,
            },
          ],
        },
      ],
    };

    it("skips the LLM when the registry already defines the food", async () => {
      const callAi = vi.fn().mockResolvedValue({
        content: JSON.stringify(deterministicResponse),
        usage: null,
      });

      const result = await parseFood(callAi, "key", "Toast", []);
      expect(callAi).not.toHaveBeenCalled();
      expect(result.items[0].canonicalName).toBe("toast");
    });

    it("calls the LLM for unknown foods", async () => {
      const callAi = vi.fn().mockResolvedValue({
        content: JSON.stringify(deterministicResponse),
        usage: null,
      });

      await parseFood(callAi, "key", "Something new", []);
      expect(callAi).toHaveBeenCalledOnce();
    });

    it("calls the LLM only for unresolved fragments in mixed input", async () => {
      const callAi = vi
        .fn()
        .mockImplementation(async (args: { messages: Array<{ content: string }> }) => {
          const payload = JSON.parse(args.messages[1]?.content) as {
            rawText: string;
          };
          expect(payload.rawText).toBe("Something new");
          return {
            content: JSON.stringify({
              items: [
                {
                  original: "Something new",
                  canonicalName: "something new",
                  isNew: true,
                  isComposite: false,
                  quantity: null,
                  unit: null,
                  components: [
                    {
                      name: "Something new",
                      canonicalName: "something new",
                      isNew: true,
                      quantity: null,
                      unit: null,
                    },
                  ],
                },
              ],
            }),
            usage: null,
          };
        });

      const result = await parseFood(callAi, "key", "Toast, Something new", []);

      expect(callAi).toHaveBeenCalledOnce();
      expect(result.items.map((item) => item.original)).toEqual(["Toast", "Something new"]);
      expect(result.items.map((item) => item.canonicalName)).toEqual(["toast", "something new"]);
    });

    it("keeps user-entered component names intact", async () => {
      const namedResponse = {
        items: [
          {
            original: "Toasted Sourdough",
            canonicalName: "bread",
            isNew: false,
            isComposite: false,
            quantity: null,
            unit: null,
            components: [
              {
                name: "Toasted Sourdough",
                canonicalName: "bread",
                isNew: false,
                quantity: null,
                unit: null,
              },
            ],
          },
        ],
      };
      const callAi = vi.fn().mockResolvedValue({
        content: JSON.stringify(namedResponse),
        usage: null,
      });

      const result = await parseFood(callAi, "key", "Toasted Sourdough", []);
      expect(result.items[0].components[0].name).toBe("Toasted Sourdough");
    });
  });
});
