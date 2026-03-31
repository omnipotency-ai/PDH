import { describe, expect, it } from "vitest";
import {
  buildDeterministicItem,
  buildExistingNameMap,
  mergeParsedItems,
  parseLeadingQuantity,
  resolveExistingCanonicalName,
  sanitiseFoodInput,
  splitRawFoodItems,
} from "../foodParsing";

// ─────────────────────────────────────────────────────────────────────────────
// sanitiseFoodInput
// ─────────────────────────────────────────────────────────────────────────────

describe("sanitiseFoodInput", () => {
  it("trims and collapses whitespace", () => {
    expect(sanitiseFoodInput("  toast ,  rice  ")).toBe("toast , rice");
  });

  it("strips leading punctuation", () => {
    expect(sanitiseFoodInput("/toast")).toBe("toast");
  });

  it("strips multiple leading punctuation characters", () => {
    expect(sanitiseFoodInput("---toast")).toBe("toast");
    expect(sanitiseFoodInput("**toast")).toBe("toast");
    expect(sanitiseFoodInput("##toast")).toBe("toast");
  });

  it("removes orphaned unit prefixes at the start", () => {
    expect(sanitiseFoodInput("g pasta")).toBe("pasta");
    expect(sanitiseFoodInput("ml juice")).toBe("juice");
    expect(sanitiseFoodInput("tsp jam")).toBe("jam");
  });

  it("removes orphaned units after commas", () => {
    expect(sanitiseFoodInput("toast, g pasta")).toBe("toast, pasta");
  });

  it("strips punctuation after commas", () => {
    expect(sanitiseFoodInput("toast, /rice")).toBe("toast, rice");
  });

  it("handles empty input", () => {
    expect(sanitiseFoodInput("")).toBe("");
    expect(sanitiseFoodInput("   ")).toBe("");
  });

  it("does not strip valid numeric+unit prefixes", () => {
    // "200g pasta" has digits before "g", so orphaned unit regex does not match
    expect(sanitiseFoodInput("200g pasta")).toBe("200g pasta");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// splitRawFoodItems
// ─────────────────────────────────────────────────────────────────────────────

describe("splitRawFoodItems", () => {
  it("splits on commas", () => {
    expect(splitRawFoodItems("toast, rice, chicken")).toEqual(["toast", "rice", "chicken"]);
  });

  it("trims each item", () => {
    expect(splitRawFoodItems(" toast , rice ")).toEqual(["toast", "rice"]);
  });

  it("filters empty items", () => {
    expect(splitRawFoodItems("toast,,rice")).toEqual(["toast", "rice"]);
  });

  it("returns empty array for empty string", () => {
    expect(splitRawFoodItems("")).toEqual([]);
  });

  it("returns single item when no commas", () => {
    expect(splitRawFoodItems("banana")).toEqual(["banana"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// parseLeadingQuantity
// ─────────────────────────────────────────────────────────────────────────────

describe("parseLeadingQuantity", () => {
  it("returns empty for empty string", () => {
    expect(parseLeadingQuantity("")).toEqual({
      parsedName: "",
      quantity: null,
      unit: null,
    });
  });

  it("returns name as-is when no quantity prefix", () => {
    expect(parseLeadingQuantity("chicken")).toEqual({
      parsedName: "chicken",
      quantity: null,
      unit: null,
    });
  });

  it("parses numeric count", () => {
    expect(parseLeadingQuantity("3 bananas")).toEqual({
      parsedName: "bananas",
      quantity: 3,
      unit: null,
    });
  });

  it("parses numeric + measure unit", () => {
    expect(parseLeadingQuantity("200g rice")).toEqual({
      parsedName: "rice",
      quantity: 200,
      unit: "g",
    });
  });

  it("parses numeric + measure unit with 'of'", () => {
    expect(parseLeadingQuantity("200g of rice")).toEqual({
      parsedName: "rice",
      quantity: 200,
      unit: "g",
    });
  });

  it("parses numeric + size unit", () => {
    expect(parseLeadingQuantity("2 large bananas")).toEqual({
      parsedName: "bananas",
      quantity: 2,
      unit: "lg",
    });
  });

  it("parses word count", () => {
    expect(parseLeadingQuantity("two bananas")).toEqual({
      parsedName: "bananas",
      quantity: 2,
      unit: null,
    });
  });

  it("parses word count + measure unit with 'of'", () => {
    expect(parseLeadingQuantity("two teaspoons of lactose free cream cheese")).toEqual({
      parsedName: "lactose free cream cheese",
      quantity: 2,
      unit: "tsp",
    });
  });

  it("parses word count + size unit", () => {
    expect(parseLeadingQuantity("three large apples")).toEqual({
      parsedName: "apples",
      quantity: 3,
      unit: "lg",
    });
  });

  it("parses standalone size word without number", () => {
    expect(parseLeadingQuantity("sm banana")).toEqual({
      parsedName: "banana",
      quantity: 1,
      unit: "sm",
    });
    expect(parseLeadingQuantity("large apple")).toEqual({
      parsedName: "apple",
      quantity: 1,
      unit: "lg",
    });
    expect(parseLeadingQuantity("med toast")).toEqual({
      parsedName: "toast",
      quantity: 1,
      unit: "med",
    });
  });

  it("parses approximate quantities", () => {
    expect(parseLeadingQuantity("a bit of jam")).toEqual({
      parsedName: "jam",
      quantity: 1,
      unit: "a bit",
    });
    expect(parseLeadingQuantity("some rice")).toEqual({
      parsedName: "rice",
      quantity: 1,
      unit: "some",
    });
    expect(parseLeadingQuantity("a handful of nuts")).toEqual({
      parsedName: "nuts",
      quantity: 1,
      unit: "handful",
    });
  });

  it("parses decimal quantities", () => {
    expect(parseLeadingQuantity("1.5 cups flour")).toEqual({
      parsedName: "flour",
      quantity: 1.5,
      unit: "cup",
    });
  });

  it("parses slice units", () => {
    expect(parseLeadingQuantity("2 slices bread")).toEqual({
      parsedName: "bread",
      quantity: 2,
      unit: "sl",
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildExistingNameMap / resolveExistingCanonicalName
// ─────────────────────────────────────────────────────────────────────────────

describe("buildExistingNameMap", () => {
  it("builds a map from normalized names to originals", () => {
    const map = buildExistingNameMap(["White Rice", "Brown Rice"]);
    expect(map.size).toBe(2);
  });

  it("skips duplicates (first wins)", () => {
    const map = buildExistingNameMap(["rice", "Rice", "RICE"]);
    expect(map.size).toBe(1);
    expect(map.get("rice")).toBe("rice");
  });

  it("returns empty map for empty input", () => {
    const map = buildExistingNameMap([]);
    expect(map.size).toBe(0);
  });
});

describe("resolveExistingCanonicalName", () => {
  it("resolves a matching name", () => {
    const map = buildExistingNameMap(["White Rice"]);
    expect(resolveExistingCanonicalName("white rice", map)).toBe("White Rice");
  });

  it("returns null for non-matching name", () => {
    const map = buildExistingNameMap(["White Rice"]);
    expect(resolveExistingCanonicalName("pasta", map)).toBeNull();
  });

  it("returns null for empty input", () => {
    const map = buildExistingNameMap(["White Rice"]);
    expect(resolveExistingCanonicalName("", map)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildDeterministicItem
// ─────────────────────────────────────────────────────────────────────────────

describe("buildDeterministicItem", () => {
  const emptyMap = buildExistingNameMap([]);

  it("returns null for empty string", () => {
    expect(buildDeterministicItem("", emptyMap)).toBeNull();
  });

  it("returns null for whitespace-only string", () => {
    expect(buildDeterministicItem("   ", emptyMap)).toBeNull();
  });

  it("returns null for unrecognized food", () => {
    expect(buildDeterministicItem("xylofruit", emptyMap)).toBeNull();
  });

  it("resolves a known registry food", () => {
    const result = buildDeterministicItem("toast", emptyMap);
    expect(result).not.toBeNull();
    expect(result?.canonicalName).toBe("toast");
    expect(result?.isNew).toBe(false);
  });

  it("resolves a food with quantity prefix", () => {
    const result = buildDeterministicItem("200g rice", emptyMap);
    expect(result).not.toBeNull();
    expect(result?.quantity).toBe(200);
    expect(result?.unit).toBe("g");
    expect(result?.canonicalName).toBe("white rice");
  });

  it("resolves a food with word count", () => {
    const result = buildDeterministicItem("two bananas", emptyMap);
    expect(result).not.toBeNull();
    expect(result?.quantity).toBe(2);
    expect(result?.canonicalName).toBe("ripe banana");
  });

  it("sets parsedName on the component (not the raw segment)", () => {
    const result = buildDeterministicItem("200g rice", emptyMap);
    expect(result).not.toBeNull();
    expect(result?.components[0].name).toBe("rice");
  });

  it("resolves against existing name map when registry misses", () => {
    const existingMap = buildExistingNameMap(["My Special Porridge"]);
    // "my special porridge" normalizes to match "My Special Porridge"
    const result = buildDeterministicItem("my special porridge", existingMap);
    expect(result).not.toBeNull();
    expect(result?.canonicalName).toBe("My Special Porridge");
  });

  it("includes recoveryStage from registry", () => {
    const result = buildDeterministicItem("toast", emptyMap);
    expect(result).not.toBeNull();
    expect(result?.recoveryStage).toBeDefined();
    expect([1, 2, 3]).toContain(result?.recoveryStage);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// mergeParsedItems
// ─────────────────────────────────────────────────────────────────────────────

describe("mergeParsedItems", () => {
  it("merges groups in order", () => {
    const groups = new Map<
      number,
      Array<{
        original: string;
        canonicalName: string;
        isNew: boolean;
        isComposite: boolean;
        quantity: number | null;
        unit: string | null;
        components: Array<{
          name: string;
          canonicalName: string;
          isNew: boolean;
          quantity: number | null;
          unit: string | null;
        }>;
      }>
    >();
    groups.set(0, [
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
          },
        ],
      },
    ]);
    groups.set(1, [
      {
        original: "rice",
        canonicalName: "white rice",
        isNew: false,
        isComposite: false,
        quantity: null,
        unit: null,
        components: [
          {
            name: "rice",
            canonicalName: "white rice",
            isNew: false,
            quantity: null,
            unit: null,
          },
        ],
      },
    ]);

    const result = mergeParsedItems(2, groups);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].original).toBe("toast");
    expect(result.items[1].original).toBe("rice");
  });

  it("handles missing groups gracefully", () => {
    const groups = new Map<
      number,
      Array<{
        original: string;
        canonicalName: string;
        isNew: boolean;
        isComposite: boolean;
        quantity: number | null;
        unit: string | null;
        components: Array<{
          name: string;
          canonicalName: string;
          isNew: boolean;
          quantity: number | null;
          unit: string | null;
        }>;
      }>
    >();
    groups.set(0, [
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
          },
        ],
      },
    ]);
    // index 1 is missing

    const result = mergeParsedItems(2, groups);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].original).toBe("toast");
  });

  it("returns empty items for zero total", () => {
    const result = mergeParsedItems(0, new Map());
    expect(result.items).toEqual([]);
  });
});
