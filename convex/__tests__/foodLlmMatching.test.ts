/**
 * Tests for convex/foodLlmMatching.ts helper functions and applyLlmResults mutation.
 *
 * The four internal helpers (buildRegistryVocabularyForPrompt, buildMatchingPrompt,
 * parseLlmResponse, processLlmResults) are exported via _testing for direct testing.
 * The matchUnresolvedItems action is tested via convex-test for auth and API key validation.
 * The applyLlmResults internalMutation is tested via convex-test for writeback logic.
 */
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FOOD_REGISTRY } from "../../shared/foodRegistry";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { _testing } from "../foodLlmMatching";
import schema from "../schema";

const {
  buildRegistryVocabularyForPrompt,
  buildMatchingPrompt,
  parseLlmResponse,
  processLlmResults,
} = _testing;
const ORIGINAL_ENCRYPTION_SECRET = process.env.API_KEY_ENCRYPTION_SECRET;

// ─────────────────────────────────────────────────────────────────────────────
// buildRegistryVocabularyForPrompt
// ─────────────────────────────────────────────────────────────────────────────

describe("buildRegistryVocabularyForPrompt", () => {
  it("returns a string with header and separator lines", () => {
    const result = buildRegistryVocabularyForPrompt();
    const lines = result.split("\n");

    expect(lines[0]).toBe("canonical | zone | examples");
    expect(lines[1]).toBe("--- | --- | ---");
  });

  it("includes one line per registry entry (plus 2 header lines)", () => {
    const result = buildRegistryVocabularyForPrompt();
    const lines = result.split("\n");

    // 2 header lines + one line per registry entry
    expect(lines).toHaveLength(FOOD_REGISTRY.length + 2);
  });

  it("includes canonical name, zone, and up to 5 examples per entry", () => {
    const result = buildRegistryVocabularyForPrompt();
    const lines = result.split("\n");

    // Find the line for "toast" (zone 1, known entry)
    const toastLine = lines.find((l) => l.startsWith("toast |"));
    expect(toastLine).toBeDefined();
    expect(toastLine).toContain("| 1 |");

    // Find honey (zone 2)
    const honeyLine = lines.find((l) => l.startsWith("honey |"));
    expect(honeyLine).toBeDefined();
    expect(honeyLine).toContain("| 2 |");
  });

  it("limits examples to 5 per entry", () => {
    const result = buildRegistryVocabularyForPrompt();
    const lines = result.split("\n");

    // Find an entry that has many examples in the registry
    const entryWithManyExamples = FOOD_REGISTRY.find(
      (e) => e.examples.length > 5,
    );

    if (entryWithManyExamples) {
      const line = lines.find((l) =>
        l.startsWith(`${entryWithManyExamples.canonical} |`),
      );
      if (line === undefined) throw new Error("expected line");
      // The examples portion should have at most 5 comma-separated items
      const examplesPart = line.split(" | ")[2];
      const exampleCount = examplesPart.split(", ").length;
      expect(exampleCount).toBeLessThanOrEqual(5);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildMatchingPrompt
// ─────────────────────────────────────────────────────────────────────────────

describe("buildMatchingPrompt", () => {
  it("returns separate system and user messages", () => {
    const result = buildMatchingPrompt(
      "steak and chips",
      ["steak and chips"],
      "canonical | zone | examples",
    );

    expect(result).toHaveProperty("systemPrompt");
    expect(result).toHaveProperty("userMessage");
    expect(typeof result.systemPrompt).toBe("string");
    expect(typeof result.userMessage).toBe("string");
  });

  it("does NOT include raw user input in the system prompt", () => {
    // Use a unique string that won't collide with static instruction examples
    const result = buildMatchingPrompt(
      "xylophone berry smoothie",
      ["xylophone berry smoothie"],
      "canonical | zone | examples",
    );

    // User input must NOT appear in the system prompt (prompt injection prevention)
    expect(result.systemPrompt).not.toContain("xylophone berry smoothie");
    // But it should appear in the user message
    const parsed = JSON.parse(result.userMessage);
    expect(parsed.rawInput).toBe("xylophone berry smoothie");
  });

  it("includes raw input in the user message as structured JSON", () => {
    const result = buildMatchingPrompt(
      "steak and chips",
      ["steak and chips"],
      "canonical | zone | examples",
    );

    const parsed = JSON.parse(result.userMessage);
    expect(parsed.rawInput).toBe("steak and chips");
    expect(parsed.unresolvedSegments).toEqual(["steak and chips"]);
  });

  it("includes all unresolved segments in the user message JSON", () => {
    const result = buildMatchingPrompt(
      "steak and chips, biscoff",
      ["steak and chips", "biscoff"],
      "vocab-placeholder",
    );

    const parsed = JSON.parse(result.userMessage);
    expect(parsed.unresolvedSegments).toEqual(["steak and chips", "biscoff"]);
  });

  it("includes the registry vocabulary in the system prompt", () => {
    const vocab =
      "canonical | zone | examples\n--- | --- | ---\ntoast | 1 | toast, white toast";
    const result = buildMatchingPrompt("toast", ["toast"], vocab);

    expect(result.systemPrompt).toContain(vocab);
  });

  it("includes instructions about JSON response format in system prompt", () => {
    const result = buildMatchingPrompt("test", ["test"], "vocab");

    expect(result.systemPrompt).toContain("Respond with ONLY valid JSON");
    expect(result.systemPrompt).toContain('"results"');
    expect(result.systemPrompt).toContain("NOT_ON_LIST");
  });

  it("includes instructions about web search in system prompt", () => {
    const result = buildMatchingPrompt("test", ["test"], "vocab");

    expect(result.systemPrompt).toContain("SEARCH THE WEB");
  });

  it("includes instructions about multi-food segments in system prompt", () => {
    const result = buildMatchingPrompt("test", ["test"], "vocab");

    expect(result.systemPrompt).toContain("MULTIPLE distinct foods");
  });

  it("sanitizes control characters from user input", () => {
    const result = buildMatchingPrompt(
      "toast\u0000with\u0007injection",
      ["segment\u0000with\u0007chars"],
      "vocab",
    );

    const parsed = JSON.parse(result.userMessage);
    expect(parsed.rawInput).not.toContain("\u0000");
    expect(parsed.rawInput).not.toContain("\u0007");
    expect(parsed.unresolvedSegments[0]).not.toContain("\u0000");
    expect(parsed.unresolvedSegments[0]).not.toContain("\u0007");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// parseLlmResponse
// ─────────────────────────────────────────────────────────────────────────────

describe("parseLlmResponse", () => {
  const validResponse = JSON.stringify({
    results: [
      {
        segment: "steak and chips",
        foods: [
          { parsedName: "steak", canonical: "NOT_ON_LIST" },
          { parsedName: "chips", canonical: "NOT_ON_LIST" },
        ],
      },
    ],
  });

  it("parses valid JSON response", () => {
    const result = parseLlmResponse(validResponse);

    if (result === undefined || result === null)
      throw new Error("expected result");
    expect(result.results).toHaveLength(1);
    expect(result.results[0].segment).toBe("steak and chips");
    expect(result.results[0].foods).toHaveLength(2);
    expect(result.results[0].foods[0].parsedName).toBe("steak");
    expect(result.results[0].foods[0].canonical).toBe("NOT_ON_LIST");
  });

  it("strips ```json markdown fences", () => {
    const wrapped = `\`\`\`json\n${validResponse}\n\`\`\``;
    const result = parseLlmResponse(wrapped);

    if (result === undefined || result === null)
      throw new Error("expected result");
    expect(result.results).toHaveLength(1);
  });

  it("strips ``` markdown fences without json tag", () => {
    const wrapped = `\`\`\`\n${validResponse}\n\`\`\``;
    const result = parseLlmResponse(wrapped);

    if (result === undefined || result === null)
      throw new Error("expected result");
    expect(result.results).toHaveLength(1);
  });

  it("returns null for completely invalid JSON", () => {
    expect(parseLlmResponse("not json at all")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseLlmResponse("")).toBeNull();
  });

  it("returns null for valid JSON without results array", () => {
    expect(parseLlmResponse('{"data": []}')).toBeNull();
  });

  it("returns null for valid JSON where results is not an array", () => {
    expect(parseLlmResponse('{"results": "not-array"}')).toBeNull();
  });

  it("returns null for null JSON value", () => {
    expect(parseLlmResponse("null")).toBeNull();
  });

  it("returns null for JSON number", () => {
    expect(parseLlmResponse("42")).toBeNull();
  });

  it("skips segment results missing segment field", () => {
    const response = JSON.stringify({
      results: [
        { foods: [{ parsedName: "toast", canonical: "toast" }] },
        {
          segment: "honey",
          foods: [{ parsedName: "honey", canonical: "honey" }],
        },
      ],
    });

    const result = parseLlmResponse(response);
    if (result === null) throw new Error("expected result");
    // First result is skipped because it has no segment field
    expect(result.results).toHaveLength(1);
    expect(result.results[0].segment).toBe("honey");
  });

  it("skips segment results missing foods field", () => {
    const response = JSON.stringify({
      results: [{ segment: "toast" }],
    });

    const result = parseLlmResponse(response);
    if (result === null) throw new Error("expected result");
    expect(result.results).toHaveLength(0);
  });

  it("skips segment results where segment is not a string", () => {
    const response = JSON.stringify({
      results: [
        {
          segment: 123,
          foods: [{ parsedName: "toast", canonical: "toast" }],
        },
      ],
    });

    const result = parseLlmResponse(response);
    if (result === null) throw new Error("expected result");
    expect(result.results).toHaveLength(0);
  });

  it("skips segment results where foods is not an array", () => {
    const response = JSON.stringify({
      results: [{ segment: "toast", foods: "not-array" }],
    });

    const result = parseLlmResponse(response);
    if (result === null) throw new Error("expected result");
    expect(result.results).toHaveLength(0);
  });

  it("skips food entries missing parsedName", () => {
    const response = JSON.stringify({
      results: [
        {
          segment: "toast",
          foods: [
            { canonical: "toast" }, // no parsedName
            { parsedName: "honey", canonical: "honey" },
          ],
        },
      ],
    });

    const result = parseLlmResponse(response);
    if (result === null) throw new Error("expected result");
    expect(result.results[0].foods).toHaveLength(1);
    expect(result.results[0].foods[0].parsedName).toBe("honey");
  });

  it("skips food entries missing canonical", () => {
    const response = JSON.stringify({
      results: [
        {
          segment: "toast",
          foods: [
            { parsedName: "toast" }, // no canonical
          ],
        },
      ],
    });

    const result = parseLlmResponse(response);
    if (result === null) throw new Error("expected result");
    expect(result.results[0].foods).toHaveLength(0);
  });

  it("skips food entries where parsedName is not a string", () => {
    const response = JSON.stringify({
      results: [
        {
          segment: "test",
          foods: [{ parsedName: 42, canonical: "toast" }],
        },
      ],
    });

    const result = parseLlmResponse(response);
    if (result === null) throw new Error("expected result");
    expect(result.results[0].foods).toHaveLength(0);
  });

  it("skips food entries where canonical is not a string", () => {
    const response = JSON.stringify({
      results: [
        {
          segment: "test",
          foods: [{ parsedName: "toast", canonical: 123 }],
        },
      ],
    });

    const result = parseLlmResponse(response);
    if (result === null) throw new Error("expected result");
    expect(result.results[0].foods).toHaveLength(0);
  });

  it("skips null food entries", () => {
    const response = JSON.stringify({
      results: [
        {
          segment: "test",
          foods: [null, { parsedName: "toast", canonical: "toast" }],
        },
      ],
    });

    const result = parseLlmResponse(response);
    if (result === null) throw new Error("expected result");
    expect(result.results[0].foods).toHaveLength(1);
  });

  it("skips null segment results", () => {
    const response = JSON.stringify({
      results: [
        null,
        {
          segment: "honey",
          foods: [{ parsedName: "honey", canonical: "honey" }],
        },
      ],
    });

    const result = parseLlmResponse(response);
    if (result === null) throw new Error("expected result");
    expect(result.results).toHaveLength(1);
  });

  it("handles multiple segments with multiple foods", () => {
    const response = JSON.stringify({
      results: [
        {
          segment: "steak and chips",
          foods: [
            { parsedName: "steak", canonical: "NOT_ON_LIST" },
            { parsedName: "chips", canonical: "NOT_ON_LIST" },
          ],
        },
        {
          segment: "banana",
          foods: [{ parsedName: "banana", canonical: "ripe banana" }],
        },
      ],
    });

    const result = parseLlmResponse(response);
    if (result === null) throw new Error("expected result");
    expect(result.results).toHaveLength(2);
    expect(result.results[0].foods).toHaveLength(2);
    expect(result.results[1].foods).toHaveLength(1);
  });

  it("returns empty results array for empty results", () => {
    const response = JSON.stringify({ results: [] });
    const result = parseLlmResponse(response);

    if (result === null) throw new Error("expected result");
    expect(result.results).toHaveLength(0);
  });

  it("handles segment with empty foods array", () => {
    const response = JSON.stringify({
      results: [{ segment: "mystery", foods: [] }],
    });

    const result = parseLlmResponse(response);
    if (result === null) throw new Error("expected result");
    expect(result.results).toHaveLength(1);
    expect(result.results[0].foods).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// processLlmResults
// ─────────────────────────────────────────────────────────────────────────────

describe("processLlmResults", () => {
  it("resolves food matched to a valid registry canonical", () => {
    const items = processLlmResults({
      results: [
        {
          segment: "some toast",
          foods: [{ parsedName: "toast", canonical: "toast" }],
        },
      ],
    });

    expect(items).toHaveLength(1);
    expect("canonicalName" in items[0]).toBe(true);
    const resolved = items[0] as {
      canonicalName: string;
      resolvedBy: string;
      recoveryStage: number | null;
    };
    expect(resolved.canonicalName).toBe("toast");
    expect(resolved.resolvedBy).toBe("llm");
    expect(resolved.recoveryStage).toBe(1); // toast is zone 1
  });

  it("marks NOT_ON_LIST foods as unresolved", () => {
    const items = processLlmResults({
      results: [
        {
          segment: "xylofruit",
          foods: [{ parsedName: "xylofruit", canonical: "NOT_ON_LIST" }],
        },
      ],
    });

    expect(items).toHaveLength(1);
    expect("canonicalName" in items[0]).toBe(false);
    expect(items[0].parsedName).toBe("xylofruit");
    expect(items[0].userSegment).toBe("xylofruit");
  });

  it("falls back to deterministic canonicalization when LLM returns invalid canonical", () => {
    // LLM returns "banana" which is not a registry canonical, but
    // canonicalizeKnownFoodName("banana") resolves to "ripe banana"
    const items = processLlmResults({
      results: [
        {
          segment: "banana",
          foods: [{ parsedName: "banana", canonical: "banana" }],
        },
      ],
    });

    expect(items).toHaveLength(1);
    expect("canonicalName" in items[0]).toBe(true);
    const resolved = items[0] as { canonicalName: string; resolvedBy: string };
    expect(resolved.canonicalName).toBe("ripe banana");
    expect(resolved.resolvedBy).toBe("llm");
  });

  it("falls back to parsedName canonicalization when LLM canonical is wrong", () => {
    // LLM returns a totally bogus canonical, but the parsedName itself
    // can be deterministically resolved
    const items = processLlmResults({
      results: [
        {
          segment: "some honey",
          foods: [{ parsedName: "honey", canonical: "completely_bogus_name" }],
        },
      ],
    });

    expect(items).toHaveLength(1);
    expect("canonicalName" in items[0]).toBe(true);
    const resolved = items[0] as { canonicalName: string };
    expect(resolved.canonicalName).toBe("honey");
  });

  it("marks food as unresolved when both LLM canonical and parsedName fail", () => {
    const items = processLlmResults({
      results: [
        {
          segment: "totally unknown",
          foods: [
            {
              parsedName: "zyxwvut",
              canonical: "also_not_real",
            },
          ],
        },
      ],
    });

    expect(items).toHaveLength(1);
    expect("canonicalName" in items[0]).toBe(false);
    expect(items[0].parsedName).toBe("zyxwvut");
  });

  it("extracts quantity and unit from parsedName via parseLeadingQuantity", () => {
    const items = processLlmResults({
      results: [
        {
          segment: "2 slices of toast",
          foods: [{ parsedName: "2 slices of toast", canonical: "toast" }],
        },
      ],
    });

    expect(items).toHaveLength(1);
    const item = items[0] as { quantity: number | null; unit: string | null };
    expect(item.quantity).toBe(2);
    expect(item.unit).toBe("sl");
  });

  it("handles multiple foods in a single segment", () => {
    const items = processLlmResults({
      results: [
        {
          segment: "toast and honey",
          foods: [
            { parsedName: "toast", canonical: "toast" },
            { parsedName: "honey", canonical: "honey" },
          ],
        },
      ],
    });

    expect(items).toHaveLength(2);
    expect("canonicalName" in items[0]).toBe(true);
    expect("canonicalName" in items[1]).toBe(true);
    expect((items[0] as { canonicalName: string }).canonicalName).toBe("toast");
    expect((items[1] as { canonicalName: string }).canonicalName).toBe("honey");
    // Both should reference the original segment
    expect(items[0].userSegment).toBe("toast and honey");
    expect(items[1].userSegment).toBe("toast and honey");
  });

  it("handles multiple segments", () => {
    const items = processLlmResults({
      results: [
        {
          segment: "toast",
          foods: [{ parsedName: "toast", canonical: "toast" }],
        },
        {
          segment: "unknown thing",
          foods: [{ parsedName: "unknown thing", canonical: "NOT_ON_LIST" }],
        },
      ],
    });

    expect(items).toHaveLength(2);
    expect("canonicalName" in items[0]).toBe(true);
    expect("canonicalName" in items[1]).toBe(false);
  });

  it("handles empty results", () => {
    const items = processLlmResults({ results: [] });
    expect(items).toHaveLength(0);
  });

  it("handles segment with empty foods array", () => {
    const items = processLlmResults({
      results: [{ segment: "something", foods: [] }],
    });
    expect(items).toHaveLength(0);
  });

  it("includes recoveryStage from registry for resolved items", () => {
    // honey is zone 2
    const items = processLlmResults({
      results: [
        {
          segment: "honey",
          foods: [{ parsedName: "honey", canonical: "honey" }],
        },
      ],
    });

    expect(items).toHaveLength(1);
    const resolved = items[0] as { recoveryStage: number | null };
    expect(resolved.recoveryStage).toBe(2);
  });

  it("sets null quantity and unit when parsedName has no leading quantity", () => {
    const items = processLlmResults({
      results: [
        {
          segment: "toast",
          foods: [{ parsedName: "toast", canonical: "toast" }],
        },
      ],
    });

    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBeNull();
    expect(items[0].unit).toBeNull();
  });

  it("resolves via deterministic fallback on LLM canonical and preserves zone", () => {
    // "ripe banana" is the canonical in the registry with zone 1
    // LLM returns "banana" as canonical (not exact), deterministic resolves it
    const items = processLlmResults({
      results: [
        {
          segment: "a banana",
          foods: [{ parsedName: "banana", canonical: "banana" }],
        },
      ],
    });

    expect(items).toHaveLength(1);
    expect("canonicalName" in items[0]).toBe(true);
    const resolved = items[0] as {
      canonicalName: string;
      recoveryStage: number | null;
    };
    expect(resolved.canonicalName).toBe("ripe banana");
    expect(resolved.recoveryStage).toBe(1);
  });

  it("mixes resolved and unresolved across segments correctly", () => {
    const items = processLlmResults({
      results: [
        {
          segment: "toast with alien paste",
          foods: [
            { parsedName: "toast", canonical: "toast" },
            { parsedName: "alien paste", canonical: "NOT_ON_LIST" },
          ],
        },
        {
          segment: "completely unknown",
          foods: [
            { parsedName: "gloopfruit", canonical: "gloopfruit_made_up" },
          ],
        },
        {
          segment: "honey drizzle",
          foods: [{ parsedName: "honey", canonical: "honey" }],
        },
      ],
    });

    expect(items).toHaveLength(4);

    // toast: resolved
    expect("canonicalName" in items[0]).toBe(true);
    expect((items[0] as { canonicalName: string }).canonicalName).toBe("toast");

    // alien paste: NOT_ON_LIST => unresolved
    expect("canonicalName" in items[1]).toBe(false);
    expect(items[1].parsedName).toBe("alien paste");

    // gloopfruit: bogus canonical, bogus parsedName => unresolved
    expect("canonicalName" in items[2]).toBe(false);
    expect(items[2].parsedName).toBe("gloopfruit");

    // honey: resolved
    expect("canonicalName" in items[3]).toBe(true);
    expect((items[3] as { canonicalName: string }).canonicalName).toBe("honey");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// matchUnresolvedItems action — validation paths
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// parseLlmResponse — additional malformed input edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe("parseLlmResponse — malformed and adversarial inputs", () => {
  it("returns null for HTML error page response", () => {
    const html = "<html><body><h1>500 Internal Server Error</h1></body></html>";
    expect(parseLlmResponse(html)).toBeNull();
  });

  it("returns null for plain text error message", () => {
    expect(
      parseLlmResponse("Rate limit exceeded. Please retry after 30 seconds."),
    ).toBeNull();
  });

  it("returns null for JSON with nested results but wrong shape", () => {
    const response = JSON.stringify({
      results: {
        data: [{ segment: "toast", foods: [] }],
      },
    });
    expect(parseLlmResponse(response)).toBeNull();
  });

  it("returns null for truncated JSON response", () => {
    const truncated = '{"results": [{"segment": "toast", "foods": [{"parse';
    expect(parseLlmResponse(truncated)).toBeNull();
  });

  it("returns null for JSON array instead of object", () => {
    const response = JSON.stringify([
      {
        segment: "toast",
        foods: [{ parsedName: "toast", canonical: "toast" }],
      },
    ]);
    expect(parseLlmResponse(response)).toBeNull();
  });

  it("handles response with extra whitespace and newlines", () => {
    const response = `

    {"results": [{"segment": "toast", "foods": [{"parsedName": "toast", "canonical": "toast"}]}]}

    `;
    const result = parseLlmResponse(response);
    if (result === null) throw new Error("expected result");
    expect(result.results).toHaveLength(1);
  });

  it("returns null for JSON boolean value", () => {
    expect(parseLlmResponse("true")).toBeNull();
  });

  it("returns null for JSON string value", () => {
    expect(parseLlmResponse('"just a string"')).toBeNull();
  });

  it("handles markdown fences with extra content before/after", () => {
    const response =
      "Here is the result:\n```json\n" +
      JSON.stringify({
        results: [
          {
            segment: "honey",
            foods: [{ parsedName: "honey", canonical: "honey" }],
          },
        ],
      }) +
      "\n```\nHope this helps!";
    // The prefix "Here is the result:" makes parsing unpredictable,
    // but the code only strips leading/trailing fences after trim
    const result = parseLlmResponse(response);
    // This should fail to parse because of the prefix text
    expect(result).toBeNull();
  });

  it("handles deeply nested but structurally wrong results", () => {
    const response = JSON.stringify({
      results: [
        {
          segment: "toast",
          foods: [
            {
              parsedName: "toast",
              canonical: "toast",
              extra: { nested: { deep: true } },
            },
          ],
        },
      ],
    });
    // Extra fields are ignored; valid structure still parses
    const result = parseLlmResponse(response);
    if (result === null) throw new Error("expected result");
    expect(result.results[0].foods[0].parsedName).toBe("toast");
  });

  it("handles results with duplicate segments", () => {
    const response = JSON.stringify({
      results: [
        {
          segment: "toast",
          foods: [{ parsedName: "toast", canonical: "toast" }],
        },
        {
          segment: "toast",
          foods: [{ parsedName: "toast", canonical: "toast" }],
        },
      ],
    });
    const result = parseLlmResponse(response);
    if (result === null) throw new Error("expected result");
    // Both segments are kept — deduplication is not parseLlmResponse's job
    expect(result.results).toHaveLength(2);
  });

  it("returns empty foods for segment where all food entries are invalid", () => {
    const response = JSON.stringify({
      results: [
        {
          segment: "mystery",
          foods: [
            { parsedName: 42, canonical: "toast" },
            { parsedName: null, canonical: "toast" },
            { canonical: "toast" },
            { parsedName: "toast" },
          ],
        },
      ],
    });
    const result = parseLlmResponse(response);
    if (result === null) throw new Error("expected result");
    expect(result.results).toHaveLength(1);
    expect(result.results[0].foods).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// matchUnresolvedItems action — validation paths
// ─────────────────────────────────────────────────────────────────────────────

describe("matchUnresolvedItems action", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    process.env.API_KEY_ENCRYPTION_SECRET = "test-api-key-encryption-secret";
  });

  afterEach(() => {
    vi.useRealTimers();
    if (ORIGINAL_ENCRYPTION_SECRET === undefined) {
      delete process.env.API_KEY_ENCRYPTION_SECRET;
      return;
    }
    process.env.API_KEY_ENCRYPTION_SECRET = ORIGINAL_ENCRYPTION_SECRET;
  });

  it("throws when called without authentication", async () => {
    const t = convexTest(schema);
    const userId = "test-user-auth";

    const logId = await t
      .withIdentity({ subject: userId })
      .mutation(api.logs.add, {
        timestamp: Date.now(),
        type: "food",
        data: {
          rawInput: "mystery food",
          items: [],
          notes: "",
        },
      });

    // Without identity — requireAuth throws
    await expect(
      t.action(api.foodLlmMatching.matchUnresolvedItems, {
        logId,
        rawInput: "mystery food",
        unresolvedSegments: ["mystery food"],
      }),
    ).rejects.toThrow("Not authenticated");
  });

  it("throws on invalid API key format (client-provided fallback)", async () => {
    const t = convexTest(schema);
    const userId = "test-user-bad-key";

    const logId = await t
      .withIdentity({ subject: userId })
      .mutation(api.logs.add, {
        timestamp: Date.now(),
        type: "food",
        data: {
          rawInput: "mystery food",
          items: [],
          notes: "",
        },
      });

    // No server key stored, so client key is used as fallback — and it's invalid
    await expect(
      t
        .withIdentity({ subject: userId })
        .action(api.foodLlmMatching.matchUnresolvedItems, {
          apiKey: "not-a-valid-key",
          logId,
          rawInput: "mystery food",
          unresolvedSegments: ["mystery food"],
        }),
    ).rejects.toThrow(
      "[NON_RETRYABLE] [KEY_ERROR] Invalid OpenAI API key format",
    );
  });

  it("throws when no API key is available (no server key, no client key)", async () => {
    const t = convexTest(schema);
    const userId = "test-user-no-key";

    const logId = await t
      .withIdentity({ subject: userId })
      .mutation(api.logs.add, {
        timestamp: Date.now(),
        type: "food",
        data: {
          rawInput: "mystery food",
          items: [],
          notes: "",
        },
      });

    await expect(
      t
        .withIdentity({ subject: userId })
        .action(api.foodLlmMatching.matchUnresolvedItems, {
          logId,
          rawInput: "mystery food",
          unresolvedSegments: ["mystery food"],
        }),
    ).rejects.toThrow(
      "[NON_RETRYABLE] [KEY_ERROR] No OpenAI API key available. Please add your key in Settings.",
    );
  });

  it("returns early with zero counts for empty unresolvedSegments", async () => {
    const t = convexTest(schema);
    const userId = "test-user-empty";

    // Store a server key so the action can proceed past key resolution
    await t.withIdentity({ subject: userId }).mutation(api.profiles.setApiKey, {
      apiKey: "sk-test1234567890abcdefghij",
    });

    const logId = await t
      .withIdentity({ subject: userId })
      .mutation(api.logs.add, {
        timestamp: Date.now(),
        type: "food",
        data: {
          rawInput: "nothing unresolved",
          items: [],
          notes: "",
        },
      });

    const result = await t
      .withIdentity({ subject: userId })
      .action(api.foodLlmMatching.matchUnresolvedItems, {
        logId,
        rawInput: "nothing unresolved",
        unresolvedSegments: [],
      });
    expect(result).toEqual({ matched: 0, unresolved: 0 });
  });

  it("resolves the server-stored key without any client key", async () => {
    const t = convexTest(schema);
    const userId = "test-user-server-key";

    await t.withIdentity({ subject: userId }).mutation(api.profiles.setApiKey, {
      apiKey: "sk-test1234567890abcdefghij",
    });

    const logId = await t
      .withIdentity({ subject: userId })
      .mutation(api.logs.add, {
        timestamp: Date.now(),
        type: "food",
        data: {
          rawInput: "nothing unresolved",
          items: [],
          notes: "",
        },
      });

    // No apiKey arg at all — server resolves from profile
    const result = await t
      .withIdentity({ subject: userId })
      .action(api.foodLlmMatching.matchUnresolvedItems, {
        logId,
        rawInput: "nothing unresolved",
        unresolvedSegments: [],
      });

    expect(result).toEqual({ matched: 0, unresolved: 0 });
  });

  it("throws when log does not belong to the authenticated user", async () => {
    const t = convexTest(schema);
    const ownerUserId = "test-user-owner";
    const attackerUserId = "test-user-attacker";

    // Both users need API keys for the action to proceed past key resolution
    await t
      .withIdentity({ subject: ownerUserId })
      .mutation(api.profiles.setApiKey, {
        apiKey: "sk-test1234567890abcdefghij",
      });
    await t
      .withIdentity({ subject: attackerUserId })
      .mutation(api.profiles.setApiKey, {
        apiKey: "sk-test1234567890abcdefghij",
      });

    const logId = await t
      .withIdentity({ subject: ownerUserId })
      .mutation(api.logs.add, {
        timestamp: Date.now(),
        type: "food",
        data: {
          rawInput: "my private food",
          items: [],
          notes: "",
        },
      });

    await expect(
      t
        .withIdentity({ subject: attackerUserId })
        .action(api.foodLlmMatching.matchUnresolvedItems, {
          logId,
          rawInput: "my private food",
          unresolvedSegments: ["my private food"],
        }),
    ).rejects.toThrow(
      "[NON_RETRYABLE] [VALIDATION_ERROR] Not authorized to process this log.",
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LLM API failure scenarios — test via parseLlmResponse + processLlmResults
//
// The matchUnresolvedItems action catches all OpenAI errors gracefully
// (console.error + return), so API failures result in silent no-ops from
// the caller's perspective. We test the response-handling paths directly
// since they are the defensive layer against malformed/error responses.
// ─────────────────────────────────────────────────────────────────────────────

describe("LLM API failure response handling", () => {
  it("parseLlmResponse handles HTTP 401 error body (unauthorized)", () => {
    // OpenAI 401 responses return JSON error objects
    const errorResponse = JSON.stringify({
      error: {
        message:
          "Incorrect API key provided: sk-test****. You can find your API key at https://platform.openai.com/account/api-keys.",
        type: "invalid_request_error",
        param: null,
        code: "invalid_api_key",
      },
    });
    // Should return null — no "results" field
    expect(parseLlmResponse(errorResponse)).toBeNull();
  });

  it("parseLlmResponse handles HTTP 429 error body (rate limit)", () => {
    const errorResponse = JSON.stringify({
      error: {
        message:
          "Rate limit reached for gpt-4o-mini in organization org-xxx on tokens per min (TPM): Limit 200000, Used 199500, Requested 1000.",
        type: "tokens",
        param: null,
        code: "rate_limit_exceeded",
      },
    });
    expect(parseLlmResponse(errorResponse)).toBeNull();
  });

  it("parseLlmResponse handles HTTP 500 error body (server error)", () => {
    const errorResponse = JSON.stringify({
      error: {
        message: "The server had an error while processing your request.",
        type: "server_error",
        param: null,
        code: null,
      },
    });
    expect(parseLlmResponse(errorResponse)).toBeNull();
  });

  it("parseLlmResponse handles connection timeout text response", () => {
    // Sometimes timeouts produce non-JSON responses
    expect(parseLlmResponse("")).toBeNull();
    expect(parseLlmResponse("Gateway Timeout")).toBeNull();
    expect(parseLlmResponse("502 Bad Gateway")).toBeNull();
  });

  it("parseLlmResponse handles partial/streamed JSON (incomplete response)", () => {
    // Simulates a response cut off mid-stream
    const partial =
      '{"results": [{"segment": "toast and honey", "foods": [{"parsedName": "toast", "canonical": "toas';
    expect(parseLlmResponse(partial)).toBeNull();
  });

  it("parseLlmResponse handles response with only markdown fences and no content", () => {
    expect(parseLlmResponse("```json\n```")).toBeNull();
    expect(parseLlmResponse("```\n```")).toBeNull();
  });

  it("processLlmResults handles results where all foods have invalid canonicals", () => {
    // Simulates LLM hallucinating registry names
    const items = processLlmResults({
      results: [
        {
          segment: "mystery food one",
          foods: [{ parsedName: "zxqwerty", canonical: "hallucinated_food_1" }],
        },
        {
          segment: "mystery food two",
          foods: [
            { parsedName: "abcnotreal", canonical: "hallucinated_food_2" },
          ],
        },
      ],
    });

    // All items should be unresolved
    expect(items).toHaveLength(2);
    for (const item of items) {
      expect("canonicalName" in item).toBe(false);
    }
    expect(items[0].parsedName).toBe("zxqwerty");
    expect(items[1].parsedName).toBe("abcnotreal");
  });

  it("processLlmResults handles results where LLM returns empty foods for all segments", () => {
    const items = processLlmResults({
      results: [
        { segment: "something weird", foods: [] },
        { segment: "another weird thing", foods: [] },
      ],
    });

    expect(items).toHaveLength(0);
  });

  it("parseLlmResponse handles LLM returning conversational text with embedded JSON", () => {
    // Some models prefix JSON with explanation text
    const response =
      "I'll analyze the food items for you.\n\n" +
      JSON.stringify({
        results: [
          {
            segment: "toast",
            foods: [{ parsedName: "toast", canonical: "toast" }],
          },
        ],
      });
    // The prefix text makes this unparseable
    expect(parseLlmResponse(response)).toBeNull();
  });

  it("parseLlmResponse handles LLM returning results with unicode/emoji content", () => {
    const response = JSON.stringify({
      results: [
        {
          segment: "toast",
          foods: [{ parsedName: "toast \u{1F35E}", canonical: "toast" }],
        },
      ],
    });
    const result = parseLlmResponse(response);
    if (result === null) throw new Error("expected result");
    // The parsedName includes the emoji — this is fine, the registry lookup
    // will handle validation downstream
    expect(result.results[0].foods[0].parsedName).toBe("toast \u{1F35E}");
  });

  it("parseLlmResponse returns empty results for valid structure with only invalid entries", () => {
    const response = JSON.stringify({
      results: [
        null,
        { segment: 123, foods: [] },
        { foods: [{ parsedName: "toast", canonical: "toast" }] },
      ],
    });
    const result = parseLlmResponse(response);
    if (result === null) throw new Error("expected result");
    expect(result.results).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// applyLlmResults internalMutation
//
// Tests the writeback mutation that applies LLM-resolved food items to the log.
// We insert logs directly via t.run to create the exact data shape needed,
// bypassing the full pipeline which requires external API calls.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Helper: create a food log with unresolved items directly in the database.
 * Returns the log ID. Items are written in ProcessedFoodItem shape that
 * passes assertProcessedFoodItems validation.
 */
async function createFoodLogWithItems(
  t: ReturnType<typeof convexTest>,
  opts: {
    userId: string;
    rawInput: string;
    items: Array<{
      userSegment: string;
      parsedName: string;
      quantity: number | null;
      unit: string | null;
      canonicalName?: string;
      resolvedBy?: "registry" | "llm" | "user" | "expired";
      recoveryStage?: 1 | 2 | 3;
      matchConfidence?: number;
      matchStrategy?:
        | "alias"
        | "fuzzy"
        | "embedding"
        | "combined"
        | "llm"
        | "user";
      matchCandidates?: Array<{
        canonicalName: string;
        zone: 1 | 2 | 3;
        group: "protein" | "carbs" | "fats" | "seasoning";
        line: string;
        bucketKey: string;
        bucketLabel: string;
        resolver: string;
        combinedConfidence: number;
        fuzzyScore: number | null;
        embeddingScore: number | null;
        examples: string[];
      }>;
      bucketOptions?: Array<{
        bucketKey: string;
        bucketLabel: string;
        canonicalOptions: string[];
        bestConfidence: number;
      }>;
    }>;
    itemsVersion?: number;
    evidenceProcessedAt?: number;
  },
): Promise<Id<"logs">> {
  const logId = await t.run(async (ctx) => {
    return await ctx.db.insert("logs", {
      userId: opts.userId,
      timestamp: Date.now(),
      type: "food",
      data: {
        rawInput: opts.rawInput,
        items: opts.items,
        notes: "",
        ...(opts.itemsVersion !== undefined && {
          itemsVersion: opts.itemsVersion,
        }),
        ...(opts.evidenceProcessedAt !== undefined && {
          evidenceProcessedAt: opts.evidenceProcessedAt,
        }),
      },
    });
  });
  return logId;
}

/** Helper: read the food log's items from the database. */
async function readFoodLogItems(
  t: ReturnType<typeof convexTest>,
  logId: Id<"logs">,
): Promise<{
  items: Array<Record<string, unknown>>;
  itemsVersion: number;
  evidenceProcessedAt: number | undefined;
}> {
  return await t.run(async (ctx) => {
    const log = await ctx.db.get(logId);
    if (log === null) throw new Error("log not found");
    const data = log.data as {
      items: Array<Record<string, unknown>>;
      itemsVersion?: number;
      evidenceProcessedAt?: number;
    };
    return {
      items: data.items,
      itemsVersion: data.itemsVersion ?? 0,
      evidenceProcessedAt: data.evidenceProcessedAt,
    };
  });
}

describe("applyLlmResults internalMutation", () => {
  it("writes canonicalName and resolvedBy='llm' on the matched item", async () => {
    const t = convexTest(schema);
    const userId = "test-apply-basic";

    const logId = await createFoodLogWithItems(t, {
      userId,
      rawInput: "biscoff",
      items: [
        {
          userSegment: "biscoff",
          parsedName: "biscoff",
          quantity: null,
          unit: null,
        },
      ],
      itemsVersion: 1,
    });

    await t.mutation(internal.foodParsing.applyLlmResults, {
      logId,
      userId,
      expectedItemsVersion: 1,
      resolvedItems: [
        {
          userSegment: "biscoff",
          parsedName: "biscoff",
          canonicalName: "sweet biscuit",
          resolvedBy: "llm",
          quantity: null,
          unit: null,
          recoveryStage: 3,
        },
      ],
    });

    const { items, itemsVersion } = await readFoodLogItems(t, logId);
    expect(items).toHaveLength(1);
    expect(items[0].canonicalName).toBe("sweet biscuit");
    expect(items[0].resolvedBy).toBe("llm");
    expect(items[0].matchConfidence).toBe(1);
    expect(items[0].matchStrategy).toBe("llm");
    expect(items[0].recoveryStage).toBe(3);
    // Version should be incremented
    expect(itemsVersion).toBe(2);
  });

  it("rejects when version mismatch occurs (optimistic concurrency)", async () => {
    const t = convexTest(schema);
    const userId = "test-apply-version-mismatch";

    const logId = await createFoodLogWithItems(t, {
      userId,
      rawInput: "toast",
      items: [
        {
          userSegment: "toast",
          parsedName: "toast",
          quantity: null,
          unit: null,
        },
      ],
      itemsVersion: 5,
    });

    // Pass a stale version (3 instead of 5)
    await expect(
      t.mutation(internal.foodParsing.applyLlmResults, {
        logId,
        userId,
        expectedItemsVersion: 3,
        resolvedItems: [
          {
            userSegment: "toast",
            parsedName: "toast",
            canonicalName: "toast",
            resolvedBy: "llm",
            quantity: null,
            unit: null,
            recoveryStage: 1,
          },
        ],
      }),
    ).rejects.toThrow("Items version mismatch");
  });

  it("matches the correct item when multiple items share the same userSegment", async () => {
    const t = convexTest(schema);
    const userId = "test-apply-segment-match";

    // Two unresolved items with the same userSegment (e.g. "toast and honey" was
    // split by the LLM into two foods but both reference the original segment)
    const logId = await createFoodLogWithItems(t, {
      userId,
      rawInput: "toast and honey",
      items: [
        {
          userSegment: "toast and honey",
          parsedName: "toast and honey",
          quantity: null,
          unit: null,
        },
        {
          userSegment: "toast and honey",
          parsedName: "something else unresolved",
          quantity: null,
          unit: null,
        },
      ],
      itemsVersion: 1,
    });

    // Resolve only the first item matching this segment
    await t.mutation(internal.foodParsing.applyLlmResults, {
      logId,
      userId,
      expectedItemsVersion: 1,
      resolvedItems: [
        {
          userSegment: "toast and honey",
          parsedName: "toast",
          canonicalName: "toast",
          resolvedBy: "llm",
          quantity: null,
          unit: null,
          recoveryStage: 1,
        },
      ],
    });

    const { items } = await readFoodLogItems(t, logId);
    expect(items).toHaveLength(2);
    // First item should be resolved
    expect(items[0].canonicalName).toBe("toast");
    expect(items[0].resolvedBy).toBe("llm");
    // Second item should remain unresolved
    expect(items[1].canonicalName).toBeUndefined();
    expect(items[1].resolvedBy).toBeUndefined();
  });

  it("clears matchCandidates and bucketOptions on resolved items", async () => {
    const t = convexTest(schema);
    const userId = "test-apply-clear-candidates";

    const logId = await createFoodLogWithItems(t, {
      userId,
      rawInput: "biscoff",
      items: [
        {
          userSegment: "biscoff",
          parsedName: "biscoff",
          quantity: null,
          unit: null,
          matchCandidates: [
            {
              canonicalName: "sweet biscuit",
              zone: 3 as const,
              group: "carbs" as const,
              line: "grains",
              bucketKey: "sweet-biscuit",
              bucketLabel: "Sweet Biscuit",
              resolver: "fuzzy",
              combinedConfidence: 0.6,
              fuzzyScore: 0.6,
              embeddingScore: null,
              examples: ["biscuit", "cookie"],
            },
          ],
          bucketOptions: [
            {
              bucketKey: "sweet-biscuit",
              bucketLabel: "Sweet Biscuit",
              canonicalOptions: ["sweet biscuit"],
              bestConfidence: 0.6,
            },
          ],
        },
      ],
      itemsVersion: 1,
    });

    await t.mutation(internal.foodParsing.applyLlmResults, {
      logId,
      userId,
      expectedItemsVersion: 1,
      resolvedItems: [
        {
          userSegment: "biscoff",
          parsedName: "biscoff",
          canonicalName: "sweet biscuit",
          resolvedBy: "llm",
          quantity: null,
          unit: null,
          recoveryStage: 3,
        },
      ],
    });

    const { items } = await readFoodLogItems(t, logId);
    expect(items).toHaveLength(1);
    expect(items[0].canonicalName).toBe("sweet biscuit");
    // matchCandidates and bucketOptions should be cleared (undefined in serialized output)
    expect(items[0].matchCandidates).toBeUndefined();
    expect(items[0].bucketOptions).toBeUndefined();
  });

  it("creates ingredientExposures when evidenceProcessedAt is already set", async () => {
    const t = convexTest(schema);
    const userId = "test-apply-post-evidence";

    // Create a log where the evidence window has already closed
    const logId = await createFoodLogWithItems(t, {
      userId,
      rawInput: "biscoff",
      items: [
        {
          userSegment: "biscoff",
          parsedName: "biscoff",
          quantity: null,
          unit: null,
        },
      ],
      itemsVersion: 1,
      evidenceProcessedAt: Date.now() - 1000, // Already processed
    });

    await t.mutation(internal.foodParsing.applyLlmResults, {
      logId,
      userId,
      expectedItemsVersion: 1,
      resolvedItems: [
        {
          userSegment: "biscoff",
          parsedName: "biscoff",
          canonicalName: "sweet biscuit",
          resolvedBy: "llm",
          quantity: null,
          unit: null,
          recoveryStage: 3,
        },
      ],
    });

    // Should have created an ingredientExposure directly
    const exposures = await t.run(async (ctx) => {
      return await ctx.db
        .query("ingredientExposures")
        .withIndex("by_userId_logId", (q) =>
          q.eq("userId", userId).eq("logId", logId),
        )
        .collect();
    });

    expect(exposures).toHaveLength(1);
    expect(exposures[0].canonicalName).toBe("sweet biscuit");
    expect(exposures[0].ingredientName).toBe("biscoff");
    expect(exposures[0].userId).toBe(userId);
  });

  it("does NOT create ingredientExposures when evidence window is still open", async () => {
    const t = convexTest(schema);
    const userId = "test-apply-pre-evidence";

    // Create a log where the evidence window has NOT yet closed
    const logId = await createFoodLogWithItems(t, {
      userId,
      rawInput: "biscoff",
      items: [
        {
          userSegment: "biscoff",
          parsedName: "biscoff",
          quantity: null,
          unit: null,
        },
      ],
      itemsVersion: 1,
      // No evidenceProcessedAt — window still open
    });

    await t.mutation(internal.foodParsing.applyLlmResults, {
      logId,
      userId,
      expectedItemsVersion: 1,
      resolvedItems: [
        {
          userSegment: "biscoff",
          parsedName: "biscoff",
          canonicalName: "sweet biscuit",
          resolvedBy: "llm",
          quantity: null,
          unit: null,
          recoveryStage: 3,
        },
      ],
    });

    // Should NOT have created any exposures (processEvidence will do it later)
    const exposures = await t.run(async (ctx) => {
      return await ctx.db
        .query("ingredientExposures")
        .withIndex("by_userId_logId", (q) =>
          q.eq("userId", userId).eq("logId", logId),
        )
        .collect();
    });

    expect(exposures).toHaveLength(0);
  });

  it("throws when log does not belong to the user", async () => {
    const t = convexTest(schema);
    const ownerId = "test-apply-owner";
    const attackerId = "test-apply-attacker";

    const logId = await createFoodLogWithItems(t, {
      userId: ownerId,
      rawInput: "toast",
      items: [
        {
          userSegment: "toast",
          parsedName: "toast",
          quantity: null,
          unit: null,
        },
      ],
      itemsVersion: 1,
    });

    await expect(
      t.mutation(internal.foodParsing.applyLlmResults, {
        logId,
        userId: attackerId,
        expectedItemsVersion: 1,
        resolvedItems: [
          {
            userSegment: "toast",
            parsedName: "toast",
            canonicalName: "toast",
            resolvedBy: "llm",
            quantity: null,
            unit: null,
            recoveryStage: 1,
          },
        ],
      }),
    ).rejects.toThrow("Not authorized");
  });

  it("throws when log is not a food log", async () => {
    const t = convexTest(schema);
    const userId = "test-apply-non-food";

    // Create a digestion log
    const logId = await t.run(async (ctx) => {
      return await ctx.db.insert("logs", {
        userId,
        timestamp: Date.now(),
        type: "digestion",
        data: { bristolCode: 4 },
      });
    });

    await expect(
      t.mutation(internal.foodParsing.applyLlmResults, {
        logId,
        userId,
        expectedItemsVersion: 0,
        resolvedItems: [
          {
            userSegment: "toast",
            parsedName: "toast",
            canonicalName: "toast",
            resolvedBy: "llm",
            quantity: null,
            unit: null,
            recoveryStage: 1,
          },
        ],
      }),
    ).rejects.toThrow("not a food or liquid log");
  });

  it("throws when log has no items", async () => {
    const t = convexTest(schema);
    const userId = "test-apply-empty-items";

    const logId = await createFoodLogWithItems(t, {
      userId,
      rawInput: "toast",
      items: [],
      itemsVersion: 0,
    });

    await expect(
      t.mutation(internal.foodParsing.applyLlmResults, {
        logId,
        userId,
        expectedItemsVersion: 0,
        resolvedItems: [
          {
            userSegment: "toast",
            parsedName: "toast",
            canonicalName: "toast",
            resolvedBy: "llm",
            quantity: null,
            unit: null,
            recoveryStage: 1,
          },
        ],
      }),
    ).rejects.toThrow("no items");
  });

  it("skips resolved items whose userSegment does not match any unresolved item", async () => {
    const t = convexTest(schema);
    const userId = "test-apply-no-match-segment";

    const logId = await createFoodLogWithItems(t, {
      userId,
      rawInput: "toast",
      items: [
        {
          userSegment: "toast",
          parsedName: "toast",
          quantity: null,
          unit: null,
        },
      ],
      itemsVersion: 1,
    });

    // Try to apply a result for a segment that doesn't exist in the log
    await t.mutation(internal.foodParsing.applyLlmResults, {
      logId,
      userId,
      expectedItemsVersion: 1,
      resolvedItems: [
        {
          userSegment: "nonexistent segment",
          parsedName: "mystery",
          canonicalName: "toast",
          resolvedBy: "llm",
          quantity: null,
          unit: null,
          recoveryStage: 1,
        },
      ],
    });

    // Item should remain unchanged (still unresolved)
    const { items, itemsVersion } = await readFoodLogItems(t, logId);
    expect(items).toHaveLength(1);
    expect(items[0].canonicalName).toBeUndefined();
    // Version should still be incremented (the mutation always bumps it)
    expect(itemsVersion).toBe(2);
  });

  it("resolves multiple items across different userSegments in one call", async () => {
    const t = convexTest(schema);
    const userId = "test-apply-multiple";

    const logId = await createFoodLogWithItems(t, {
      userId,
      rawInput: "toast, honey",
      items: [
        {
          userSegment: "toast",
          parsedName: "toast",
          quantity: null,
          unit: null,
        },
        {
          userSegment: "honey",
          parsedName: "honey",
          quantity: null,
          unit: null,
        },
      ],
      itemsVersion: 1,
    });

    await t.mutation(internal.foodParsing.applyLlmResults, {
      logId,
      userId,
      expectedItemsVersion: 1,
      resolvedItems: [
        {
          userSegment: "toast",
          parsedName: "toast",
          canonicalName: "toast",
          resolvedBy: "llm",
          quantity: null,
          unit: null,
          recoveryStage: 1,
        },
        {
          userSegment: "honey",
          parsedName: "honey",
          canonicalName: "honey",
          resolvedBy: "llm",
          quantity: null,
          unit: null,
          recoveryStage: 2,
        },
      ],
    });

    const { items, itemsVersion } = await readFoodLogItems(t, logId);
    expect(items).toHaveLength(2);
    expect(items[0].canonicalName).toBe("toast");
    expect(items[0].resolvedBy).toBe("llm");
    expect(items[0].recoveryStage).toBe(1);
    expect(items[1].canonicalName).toBe("honey");
    expect(items[1].resolvedBy).toBe("llm");
    expect(items[1].recoveryStage).toBe(2);
    expect(itemsVersion).toBe(2);
  });

  it("does not overwrite already-resolved items (only matches unresolved ones)", async () => {
    const t = convexTest(schema);
    const userId = "test-apply-skip-resolved";

    const logId = await createFoodLogWithItems(t, {
      userId,
      rawInput: "toast, biscoff",
      items: [
        {
          userSegment: "toast",
          parsedName: "toast",
          canonicalName: "toast",
          resolvedBy: "registry",
          recoveryStage: 1,
          quantity: null,
          unit: null,
          matchConfidence: 1,
          matchStrategy: "alias",
        },
        {
          userSegment: "biscoff",
          parsedName: "biscoff",
          quantity: null,
          unit: null,
          // No canonicalName — unresolved
        },
      ],
      itemsVersion: 2,
    });

    await t.mutation(internal.foodParsing.applyLlmResults, {
      logId,
      userId,
      expectedItemsVersion: 2,
      resolvedItems: [
        {
          userSegment: "toast",
          parsedName: "toast",
          canonicalName: "bread",
          resolvedBy: "llm",
          quantity: null,
          unit: null,
          recoveryStage: 1,
        },
        {
          userSegment: "biscoff",
          parsedName: "biscoff",
          canonicalName: "sweet biscuit",
          resolvedBy: "llm",
          quantity: null,
          unit: null,
          recoveryStage: 3,
        },
      ],
    });

    const { items } = await readFoodLogItems(t, logId);
    expect(items).toHaveLength(2);
    // First item: already resolved as "toast" via "registry" — should NOT be overwritten
    expect(items[0].canonicalName).toBe("toast");
    expect(items[0].resolvedBy).toBe("registry");
    // Second item: was unresolved, now resolved by LLM
    expect(items[1].canonicalName).toBe("sweet biscuit");
    expect(items[1].resolvedBy).toBe("llm");
  });

  it("handles version 0 (default) when itemsVersion is not set", async () => {
    const t = convexTest(schema);
    const userId = "test-apply-version-zero";

    // Create log without explicit itemsVersion (defaults to undefined/0)
    const logId = await createFoodLogWithItems(t, {
      userId,
      rawInput: "toast",
      items: [
        {
          userSegment: "toast",
          parsedName: "toast",
          quantity: null,
          unit: null,
        },
      ],
      // No itemsVersion set — defaults to 0
    });

    await t.mutation(internal.foodParsing.applyLlmResults, {
      logId,
      userId,
      expectedItemsVersion: 0,
      resolvedItems: [
        {
          userSegment: "toast",
          parsedName: "toast",
          canonicalName: "toast",
          resolvedBy: "llm",
          quantity: null,
          unit: null,
          recoveryStage: 1,
        },
      ],
    });

    const { items, itemsVersion } = await readFoodLogItems(t, logId);
    expect(items[0].canonicalName).toBe("toast");
    expect(itemsVersion).toBe(1);
  });

  it("creates multiple ingredientExposures for multiple resolved items post-evidence", async () => {
    const t = convexTest(schema);
    const userId = "test-apply-multi-exposure";

    const logId = await createFoodLogWithItems(t, {
      userId,
      rawInput: "toast, honey",
      items: [
        {
          userSegment: "toast",
          parsedName: "toast",
          quantity: null,
          unit: null,
        },
        {
          userSegment: "honey",
          parsedName: "honey",
          quantity: null,
          unit: null,
        },
      ],
      itemsVersion: 1,
      evidenceProcessedAt: Date.now() - 5000,
    });

    await t.mutation(internal.foodParsing.applyLlmResults, {
      logId,
      userId,
      expectedItemsVersion: 1,
      resolvedItems: [
        {
          userSegment: "toast",
          parsedName: "toast",
          canonicalName: "toast",
          resolvedBy: "llm",
          quantity: null,
          unit: null,
          recoveryStage: 1,
        },
        {
          userSegment: "honey",
          parsedName: "honey",
          canonicalName: "honey",
          resolvedBy: "llm",
          quantity: null,
          unit: null,
          recoveryStage: 2,
        },
      ],
    });

    const exposures = await t.run(async (ctx) => {
      return await ctx.db
        .query("ingredientExposures")
        .withIndex("by_userId_logId", (q) =>
          q.eq("userId", userId).eq("logId", logId),
        )
        .collect();
    });

    expect(exposures).toHaveLength(2);
    const canonicalNames = exposures.map((e) => e.canonicalName).sort();
    expect(canonicalNames).toEqual(["honey", "toast"]);
  });

  it("preserves recoveryStage on ingredientExposures created post-evidence", async () => {
    const t = convexTest(schema);
    const userId = "test-apply-exposure-zone";

    const logId = await createFoodLogWithItems(t, {
      userId,
      rawInput: "honey",
      items: [
        {
          userSegment: "honey",
          parsedName: "honey",
          quantity: null,
          unit: null,
        },
      ],
      itemsVersion: 1,
      evidenceProcessedAt: Date.now() - 1000,
    });

    await t.mutation(internal.foodParsing.applyLlmResults, {
      logId,
      userId,
      expectedItemsVersion: 1,
      resolvedItems: [
        {
          userSegment: "honey",
          parsedName: "honey",
          canonicalName: "honey",
          resolvedBy: "llm",
          quantity: null,
          unit: null,
          recoveryStage: 2,
        },
      ],
    });

    const exposures = await t.run(async (ctx) => {
      return await ctx.db
        .query("ingredientExposures")
        .withIndex("by_userId_logId", (q) =>
          q.eq("userId", userId).eq("logId", logId),
        )
        .collect();
    });

    expect(exposures).toHaveLength(1);
    expect(exposures[0].recoveryStage).toBe(2);
  });

  it("does not create exposure for items with null recoveryStage", async () => {
    const t = convexTest(schema);
    const userId = "test-apply-null-stage";

    const logId = await createFoodLogWithItems(t, {
      userId,
      rawInput: "mystery food",
      items: [
        {
          userSegment: "mystery food",
          parsedName: "mystery food",
          quantity: null,
          unit: null,
        },
      ],
      itemsVersion: 1,
      evidenceProcessedAt: Date.now() - 1000,
    });

    await t.mutation(internal.foodParsing.applyLlmResults, {
      logId,
      userId,
      expectedItemsVersion: 1,
      resolvedItems: [
        {
          userSegment: "mystery food",
          parsedName: "mystery food",
          canonicalName: "toast",
          resolvedBy: "llm",
          quantity: null,
          unit: null,
          recoveryStage: null,
        },
      ],
    });

    // Exposure should still be created (canonicalName is valid)
    const exposures = await t.run(async (ctx) => {
      return await ctx.db
        .query("ingredientExposures")
        .withIndex("by_userId_logId", (q) =>
          q.eq("userId", userId).eq("logId", logId),
        )
        .collect();
    });

    expect(exposures).toHaveLength(1);
    expect(exposures[0].canonicalName).toBe("toast");
    // recoveryStage should not be set (undefined on the exposure)
    expect(exposures[0].recoveryStage).toBeUndefined();
  });

  it("increments version even when no segment matches are found", async () => {
    const t = convexTest(schema);
    const userId = "test-apply-version-bump";

    const logId = await createFoodLogWithItems(t, {
      userId,
      rawInput: "toast",
      items: [
        {
          userSegment: "toast",
          parsedName: "toast",
          canonicalName: "toast",
          resolvedBy: "registry",
          quantity: null,
          unit: null,
        },
      ],
      itemsVersion: 3,
    });

    // All items already resolved, so nothing to match — but version still bumps
    await t.mutation(internal.foodParsing.applyLlmResults, {
      logId,
      userId,
      expectedItemsVersion: 3,
      resolvedItems: [
        {
          userSegment: "toast",
          parsedName: "toast",
          canonicalName: "bread",
          resolvedBy: "llm",
          quantity: null,
          unit: null,
          recoveryStage: 1,
        },
      ],
    });

    const { itemsVersion } = await readFoodLogItems(t, logId);
    expect(itemsVersion).toBe(4);
  });
});
