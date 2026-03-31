import { describe, expect, it } from "vitest";
import { normalizeFluidItemName } from "../normalizeFluidName";

describe("normalizeFluidItemName", () => {
  it("normalizes uppercase input to lowercase", () => {
    expect(normalizeFluidItemName("WATER")).toBe("water");
    expect(normalizeFluidItemName("JUICE")).toBe("juice");
  });

  it("trims leading and trailing whitespace", () => {
    expect(normalizeFluidItemName("  water  ")).toBe("water");
    expect(normalizeFluidItemName("\twater\n")).toBe("water");
  });

  it("collapses multiple spaces into one", () => {
    expect(normalizeFluidItemName("orange   juice")).toBe("orange juice");
  });

  it("removes diacritics", () => {
    expect(normalizeFluidItemName("café")).toBe("cafe");
    expect(normalizeFluidItemName("naïve")).toBe("naive");
  });

  it("handles empty string", () => {
    expect(normalizeFluidItemName("")).toBe("");
  });

  it("handles null/undefined by converting to empty string", () => {
    expect(normalizeFluidItemName(null)).toBe("");
    expect(normalizeFluidItemName(undefined)).toBe("");
  });
});
