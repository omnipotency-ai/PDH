import { describe, expect, it } from "vitest";
import { sanitizePlainText, sanitizeUnknownStringsDeep } from "../inputSafety";

describe("sanitizePlainText", () => {
  it("returns normal string unchanged", () => {
    const input = "Hello, world!";
    expect(sanitizePlainText(input)).toBe("Hello, world!");
  });

  it("strips control characters", () => {
    const input = "Hello\u0000World\u001F!";
    expect(sanitizePlainText(input)).toBe("HelloWorld!");
  });

  it("returns empty string for empty input", () => {
    expect(sanitizePlainText("")).toBe("");
  });

  it("trims whitespace by default", () => {
    expect(sanitizePlainText("  hello  ")).toBe("hello");
  });

  it("preserves newlines by default", () => {
    expect(sanitizePlainText("line1\nline2")).toBe("line1\nline2");
  });

  it("collapses whitespace when preserveNewlines is false", () => {
    expect(sanitizePlainText("hello\n\nworld", { preserveNewlines: false })).toBe("hello world");
  });
});

describe("sanitizeUnknownStringsDeep", () => {
  it("sanitizes nested string values", () => {
    const input = { name: "  John  ", nested: { value: "  test\u0000  " } };
    const result = sanitizeUnknownStringsDeep(input);

    expect(result.name).toBe("John");
    expect(result.nested.value).toBe("test");
  });

  it("preserves non-string values", () => {
    const input = { count: 42, active: true, tags: ["a", "b"] };
    const result = sanitizeUnknownStringsDeep(input);

    expect(result.count).toBe(42);
    expect(result.active).toBe(true);
    expect(result.tags).toEqual(["a", "b"]);
  });

  it("handles arrays of objects", () => {
    const input = [{ name: "  Alice  " }, { name: "  Bob  " }];
    const result = sanitizeUnknownStringsDeep(input);

    expect(result[0].name).toBe("Alice");
    expect(result[1].name).toBe("Bob");
  });

  it("truncates and warns when string exceeds maxStringLength", () => {
    const input = { name: "a".repeat(6000) };
    const result = sanitizeUnknownStringsDeep(input);
    expect(result.name).toBe(`${"a".repeat(5000)}...[truncated]`);
  });

  it("does not throw when string exceeds maxStringLength", () => {
    const input = { name: "a".repeat(6000) };
    expect(() => sanitizeUnknownStringsDeep(input)).not.toThrow();
  });

  it("respects custom maxStringLength by truncating", () => {
    const input = { name: "hello" };
    const result = sanitizeUnknownStringsDeep(input, { maxStringLength: 3 });
    expect(result.name).toBe("hel...[truncated]");
  });
});
