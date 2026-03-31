import { describe, expect, it } from "vitest";
import {
  bristolToConsistency,
  normalizeDigestiveCategory,
  normalizeEpisodesCount,
} from "../analysis";

describe("bristolToConsistency", () => {
  // --- Valid codes: verify each maps to the correct category ---

  it("maps code 1 to constipated", () => {
    expect(bristolToConsistency(1)).toBe("constipated");
  });

  it("maps code 2 to hard", () => {
    expect(bristolToConsistency(2)).toBe("hard");
  });

  it("maps code 3 to firm", () => {
    expect(bristolToConsistency(3)).toBe("firm");
  });

  it("maps code 4 to firm", () => {
    expect(bristolToConsistency(4)).toBe("firm");
  });

  it("maps code 5 to firm", () => {
    expect(bristolToConsistency(5)).toBe("firm");
  });

  it("maps code 6 to loose", () => {
    expect(bristolToConsistency(6)).toBe("loose");
  });

  it("maps code 7 to diarrhea", () => {
    expect(bristolToConsistency(7)).toBe("diarrhea");
  });

  // --- Boundary: exactly 1 and exactly 7 are the edges of the valid range ---

  it("accepts boundary value 1 (lower bound)", () => {
    expect(bristolToConsistency(1)).toBe("constipated");
  });

  it("accepts boundary value 7 (upper bound)", () => {
    expect(bristolToConsistency(7)).toBe("diarrhea");
  });

  // --- Out of range: values just outside valid boundaries ---

  it("throws for code 0 (below lower bound)", () => {
    expect(() => bristolToConsistency(0)).toThrow("Invalid Bristol code: 0. Must be 1-7.");
  });

  it("throws for code 8 (above upper bound)", () => {
    expect(() => bristolToConsistency(8)).toThrow("Invalid Bristol code: 8. Must be 1-7.");
  });

  it("throws for code -1 (negative)", () => {
    expect(() => bristolToConsistency(-1)).toThrow("Invalid Bristol code: -1. Must be 1-7.");
  });

  // --- Non-integer values ---

  it("throws for non-integer value 1.5", () => {
    expect(() => bristolToConsistency(1.5)).toThrow("Invalid Bristol code: 1.5. Must be 1-7.");
  });

  it("throws for NaN", () => {
    expect(() => bristolToConsistency(NaN)).toThrow("Invalid Bristol code: NaN. Must be 1-7.");
  });

  // --- Additional edge cases ---

  it("throws for Infinity", () => {
    expect(() => bristolToConsistency(Infinity)).toThrow(
      "Invalid Bristol code: Infinity. Must be 1-7.",
    );
  });

  it("throws for -Infinity", () => {
    expect(() => bristolToConsistency(-Infinity)).toThrow(
      "Invalid Bristol code: -Infinity. Must be 1-7.",
    );
  });

  it("throws for very large integer", () => {
    expect(() => bristolToConsistency(100)).toThrow("Invalid Bristol code: 100. Must be 1-7.");
  });

  it("throws for very large negative integer", () => {
    expect(() => bristolToConsistency(-100)).toThrow("Invalid Bristol code: -100. Must be 1-7.");
  });
});

describe("normalizeDigestiveCategory", () => {
  // --- Direct consistencyTag values ---

  it("returns consistencyTag when it is a valid category", () => {
    expect(
      normalizeDigestiveCategory({
        bristolCode: 4,
        consistencyTag: "constipated",
      }),
    ).toBe("constipated");
    expect(normalizeDigestiveCategory({ bristolCode: 4, consistencyTag: "hard" })).toBe("hard");
    expect(normalizeDigestiveCategory({ bristolCode: 4, consistencyTag: "firm" })).toBe("firm");
    expect(normalizeDigestiveCategory({ bristolCode: 4, consistencyTag: "loose" })).toBe("loose");
    expect(
      normalizeDigestiveCategory({
        bristolCode: 4,
        consistencyTag: "diarrhea",
      }),
    ).toBe("diarrhea");
  });

  it("normalizes consistencyTag case-insensitively", () => {
    expect(normalizeDigestiveCategory({ bristolCode: 4, consistencyTag: "FIRM" })).toBe("firm");
    expect(normalizeDigestiveCategory({ bristolCode: 4, consistencyTag: "Loose" })).toBe("loose");
    expect(
      normalizeDigestiveCategory({
        bristolCode: 4,
        consistencyTag: "DIARRHEA",
      }),
    ).toBe("diarrhea");
  });

  it("prioritizes consistencyTag over bristolCode", () => {
    // consistencyTag says "loose" but bristolCode says firm (4) -- tag wins
    expect(normalizeDigestiveCategory({ bristolCode: 4, consistencyTag: "loose" })).toBe("loose");
  });

  // --- Falls back to bristolCode when consistencyTag is absent or invalid ---

  it("falls back to bristolCode when consistencyTag is absent", () => {
    expect(normalizeDigestiveCategory({ bristolCode: 1 })).toBe("constipated");
    expect(normalizeDigestiveCategory({ bristolCode: 4 })).toBe("firm");
    expect(normalizeDigestiveCategory({ bristolCode: 7 })).toBe("diarrhea");
  });

  it("falls back to bristolCode when consistencyTag is an unrecognized string", () => {
    expect(normalizeDigestiveCategory({ bristolCode: 6, consistencyTag: "watery" })).toBe("loose");
  });

  it("falls back to bristolCode when consistencyTag is empty string", () => {
    expect(normalizeDigestiveCategory({ bristolCode: 2, consistencyTag: "" })).toBe("hard");
  });

  // --- Returns null when no usable data ---

  it("returns null when bristolCode is not a finite number and no valid tag", () => {
    expect(normalizeDigestiveCategory({ bristolCode: NaN })).toBeNull();
  });

  it("returns null for empty object", () => {
    expect(normalizeDigestiveCategory({})).toBeNull();
  });

  it("returns null when bristolCode is undefined and no tag", () => {
    expect(
      normalizeDigestiveCategory({ bristolCode: undefined } as Record<string, unknown>),
    ).toBeNull();
  });

  // --- Propagates bristolToConsistency errors for out-of-range codes ---

  it("returns null when bristolCode is out of range and no valid tag", () => {
    expect(normalizeDigestiveCategory({ bristolCode: 0 })).toBeNull();
    expect(normalizeDigestiveCategory({ bristolCode: 8 })).toBeNull();
  });
});

describe("normalizeEpisodesCount", () => {
  it("returns the number when given a valid integer", () => {
    expect(normalizeEpisodesCount(3)).toBe(3);
  });

  it("floors decimal values", () => {
    expect(normalizeEpisodesCount(2.9)).toBe(2);
  });

  it("clamps to minimum of 1", () => {
    expect(normalizeEpisodesCount(0)).toBe(1);
    expect(normalizeEpisodesCount(-5)).toBe(1);
  });

  it("clamps to maximum of 20", () => {
    expect(normalizeEpisodesCount(25)).toBe(20);
    expect(normalizeEpisodesCount(100)).toBe(20);
  });

  it("returns 1 for NaN inputs", () => {
    expect(normalizeEpisodesCount(NaN)).toBe(1);
  });

  it("returns 1 for non-numeric values", () => {
    expect(normalizeEpisodesCount("abc")).toBe(1);
    expect(normalizeEpisodesCount(undefined)).toBe(1);
    expect(normalizeEpisodesCount(null)).toBe(1);
  });

  it("parses numeric strings", () => {
    expect(normalizeEpisodesCount("5")).toBe(5);
    expect(normalizeEpisodesCount("3.7")).toBe(3);
  });

  it("returns 1 for Infinity", () => {
    expect(normalizeEpisodesCount(Infinity)).toBe(1);
  });

  it("handles boundary values exactly", () => {
    expect(normalizeEpisodesCount(1)).toBe(1);
    expect(normalizeEpisodesCount(20)).toBe(20);
  });
});
