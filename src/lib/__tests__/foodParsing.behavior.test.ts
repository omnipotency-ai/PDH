import { describe, expect, it, vi } from "vitest";
import type { ConvexAiCaller } from "../convexAiClient";
import { parseFood } from "../foodParsing";

describe("parseFood", () => {
  it("resolves fully deterministic inputs without calling the LLM", async () => {
    const callAi = vi.fn<ConvexAiCaller>();

    const result = await parseFood(callAi, "test-key", "toast, two scrambled eggs", []);

    expect(callAi).not.toHaveBeenCalled();
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      original: "toast",
      canonicalName: "toast",
      isNew: false,
      quantity: null,
      unit: null,
    });
    expect(result.items[1]).toMatchObject({
      original: "two scrambled eggs",
      canonicalName: "egg",
      isNew: false,
      quantity: 2,
      unit: null,
    });
  });

  it("sends only unresolved segments to the LLM and preserves merged order", async () => {
    const callAi = vi.fn<ConvexAiCaller>().mockResolvedValue({
      content: JSON.stringify({
        items: [
          {
            original: "jam sandwich",
            canonicalName: "jam sandwich",
            isNew: true,
            isComposite: false,
            quantity: null,
            unit: null,
            components: [
              {
                name: "jam sandwich",
                canonicalName: "jam sandwich",
                isNew: true,
                quantity: null,
                unit: null,
              },
            ],
          },
        ],
      }),
      usage: null,
    });

    const result = await parseFood(callAi, "test-key", "toast, jam sandwich", []);

    expect(callAi).toHaveBeenCalledTimes(1);
    const userMessage = callAi.mock.calls[0]?.[0].messages[1];
    expect(userMessage?.role).toBe("user");
    expect(JSON.parse(String(userMessage?.content))).toEqual({
      rawText: "jam sandwich",
      existingNames: [],
    });

    expect(result.items).toHaveLength(2);
    expect(result.items[0]?.canonicalName).toBe("toast");
    expect(result.items[1]?.original).toBe("jam sandwich");
  });

  it("keeps deterministic matches when unresolved segments fall back after an LLM failure", async () => {
    const callAi = vi.fn<ConvexAiCaller>().mockRejectedValue(new Error("boom"));
    // parseFood catches the LLM error and calls console.error before falling back.
    // Suppress the expected stderr output and assert it was called.
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await parseFood(callAi, "test-key", "toast, mystery stew", []);

    // Verify the error was logged (not silently swallowed)
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Food parsing request failed"));
    errorSpy.mockRestore();

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      original: "toast",
      canonicalName: "toast",
      isNew: false,
    });
    expect(result.items[1]).toMatchObject({
      original: "mystery stew",
      canonicalName: "mystery stew",
      isNew: true,
    });
  });

  it("falls back when the LLM returns an empty items array", async () => {
    const callAi = vi.fn<ConvexAiCaller>().mockResolvedValue({
      content: JSON.stringify({ items: [] }),
      usage: null,
    });
    // An empty items array fails isValidFoodParseResult, which calls console.error.
    // Suppress the expected stderr output and assert it was called.
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await parseFood(callAi, "test-key", "mystery stew", []);

    expect(errorSpy).toHaveBeenCalledWith(
      "Food parsing returned an unexpected response structure.",
    );
    errorSpy.mockRestore();

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      original: "mystery stew",
      canonicalName: "mystery stew",
      isNew: true,
    });
  });

  it("falls back without calling the LLM when no API key is available", async () => {
    const callAi = vi.fn<ConvexAiCaller>();

    const result = await parseFood(callAi, "", "mystery stew", []);

    expect(callAi).not.toHaveBeenCalled();
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.canonicalName).toBe("mystery stew");
  });

  it("bounds existingNames sent to the LLM for unresolved fragments", async () => {
    const callAi = vi.fn<ConvexAiCaller>().mockResolvedValue({
      content: JSON.stringify({
        items: [
          {
            original: "berry smoothie deluxe",
            canonicalName: "berry smoothie deluxe",
            isNew: true,
            isComposite: false,
            quantity: null,
            unit: null,
            components: [
              {
                name: "berry smoothie deluxe",
                canonicalName: "berry smoothie deluxe",
                isNew: true,
                quantity: null,
                unit: null,
              },
            ],
          },
        ],
      }),
      usage: null,
    });

    const existingNames = Array.from({ length: 100 }, (_, index) => `berry smoothie ${index + 1}`);

    await parseFood(callAi, "test-key", "berry smoothie deluxe", existingNames);

    const userMessage = callAi.mock.calls[0]?.[0].messages[1];
    const payload = JSON.parse(String(userMessage?.content)) as {
      rawText: string;
      existingNames: string[];
    };

    expect(payload.rawText).toBe("berry smoothie deluxe");
    expect(payload.existingNames.length).toBeLessThanOrEqual(24);
    expect(payload.existingNames).toContain("berry smoothie 1");
  });
});
