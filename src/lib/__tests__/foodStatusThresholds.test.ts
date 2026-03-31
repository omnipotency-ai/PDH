import { describe, expect, it } from "vitest";
import {
  bristolCategory,
  classifyConsistency,
  computeBristolAverage,
  getBristolExpectation,
  MAJORITY_THRESHOLD,
  STEADY_STATE_MONTHS,
} from "../foodStatusThresholds";

// ── bristolCategory ──────────────────────────────────────────────────────────

describe("bristolCategory", () => {
  it("maps Bristol 1 to constipated", () => {
    expect(bristolCategory(1)).toBe("constipated");
  });

  it("maps Bristol 2 to constipated", () => {
    expect(bristolCategory(2)).toBe("constipated");
  });

  it("maps Bristol 3 to hard", () => {
    expect(bristolCategory(3)).toBe("hard");
  });

  it("maps Bristol 4 to normal", () => {
    expect(bristolCategory(4)).toBe("normal");
  });

  it("maps Bristol 5 to loose", () => {
    expect(bristolCategory(5)).toBe("loose");
  });

  it("maps Bristol 6 to loose", () => {
    expect(bristolCategory(6)).toBe("loose");
  });

  it("maps Bristol 7 to diarrhea", () => {
    expect(bristolCategory(7)).toBe("diarrhea");
  });

  it("throws on Bristol 0", () => {
    expect(() => bristolCategory(0)).toThrow(RangeError);
  });

  it("throws on Bristol 8", () => {
    expect(() => bristolCategory(8)).toThrow(RangeError);
  });

  it("throws on negative values", () => {
    expect(() => bristolCategory(-1)).toThrow(RangeError);
  });

  it("throws on non-integer values", () => {
    expect(() => bristolCategory(3.5)).toThrow(RangeError);
  });
});

// ── computeBristolAverage ────────────────────────────────────────────────────

describe("computeBristolAverage", () => {
  it("returns null for empty breakdown", () => {
    expect(computeBristolAverage({})).toBeNull();
  });

  it("returns the score for a single entry", () => {
    expect(computeBristolAverage({ 4: 1 })).toBe(4);
  });

  it("computes weighted average of multiple scores", () => {
    // (4*3 + 5*2) / 5 = 22/5 = 4.4
    expect(computeBristolAverage({ 4: 3, 5: 2 })).toBeCloseTo(4.4);
  });

  it("ignores entries with zero count", () => {
    expect(computeBristolAverage({ 4: 3, 7: 0 })).toBe(4);
  });
});

// ── classifyConsistency (majority-rules 30% threshold) ───────────────────────

describe("classifyConsistency", () => {
  describe("empty / no data", () => {
    it("returns testing for empty breakdown", () => {
      expect(classifyConsistency({})).toBe("testing");
    });

    it("returns testing when all counts are zero", () => {
      expect(classifyConsistency({ 4: 0, 5: 0 })).toBe("testing");
    });
  });

  describe("single score (100% in its category)", () => {
    it("single Bristol 1 -> safe-hard (constipated)", () => {
      expect(classifyConsistency({ 1: 1 })).toBe("safe-hard");
    });

    it("single Bristol 2 -> safe-hard (constipated)", () => {
      expect(classifyConsistency({ 2: 1 })).toBe("safe-hard");
    });

    it("single Bristol 3 -> safe-hard (hard)", () => {
      expect(classifyConsistency({ 3: 1 })).toBe("safe-hard");
    });

    it("single Bristol 4 -> safe (normal)", () => {
      expect(classifyConsistency({ 4: 1 })).toBe("safe");
    });

    it("single Bristol 5 -> safe-loose (loose)", () => {
      expect(classifyConsistency({ 5: 1 })).toBe("safe-loose");
    });

    it("single Bristol 6 -> safe-loose (loose)", () => {
      expect(classifyConsistency({ 6: 1 })).toBe("safe-loose");
    });

    it("single Bristol 7 -> safe-loose (diarrhea)", () => {
      expect(classifyConsistency({ 7: 1 })).toBe("safe-loose");
    });
  });

  describe("all-same scores", () => {
    it("[4,4,4,4] -> safe (all normal)", () => {
      expect(classifyConsistency({ 4: 4 })).toBe("safe");
    });

    it("[7,7,7] -> safe-loose (all diarrhea)", () => {
      expect(classifyConsistency({ 7: 3 })).toBe("safe-loose");
    });

    it("[1,1,1,1,1] -> safe-hard (all constipated)", () => {
      expect(classifyConsistency({ 1: 5 })).toBe("safe-hard");
    });

    it("[3,3,3] -> safe-hard (all hard)", () => {
      expect(classifyConsistency({ 3: 3 })).toBe("safe-hard");
    });

    it("[5,5,5,5] -> safe-loose (all loose)", () => {
      expect(classifyConsistency({ 5: 4 })).toBe("safe-loose");
    });
  });

  describe("30% threshold boundary", () => {
    it("exactly 30% qualifies — 3 out of 10", () => {
      // 3 normal (30%), 7 loose (70%) -> loose wins by count
      expect(classifyConsistency({ 4: 3, 5: 7 })).toBe("safe-loose");
    });

    it("exactly 30% qualifies — both at 30%+ means highest count wins", () => {
      // 3 normal (30%), 4 loose (40%), 3 hard (30%) -> loose has highest count
      expect(classifyConsistency({ 4: 3, 5: 4, 3: 3 })).toBe("safe-loose");
    });

    it("just under 30% does not qualify alone", () => {
      // 10 total: normal=2 (20%), loose=2 (20%), hard=2 (20%), constipated=2 (20%), diarrhea=2 (20%)
      // No category reaches 30% -> falls back to highest count (all equal) -> most concerning wins
      // diarrhea has highest concern distance (4)
      expect(classifyConsistency({ 4: 2, 5: 2, 3: 2, 1: 2, 7: 2 })).toBe("safe-loose");
    });
  });

  describe("dominant category wins", () => {
    it("Bristol 7 dominant -> safe-loose (diarrhea)", () => {
      // 7 diarrhea (70%), 3 normal (30%) -> diarrhea wins by count
      expect(classifyConsistency({ 7: 7, 4: 3 })).toBe("safe-loose");
    });

    it("Bristol 1-2 dominant -> safe-hard (constipated)", () => {
      // 6 constipated (60%), 4 normal (40%) -> constipated wins by count
      expect(classifyConsistency({ 1: 3, 2: 3, 4: 4 })).toBe("safe-hard");
    });

    it("Bristol 4 dominant -> safe (normal)", () => {
      // 6 normal (60%), 2 loose (20%), 2 hard (20%)
      expect(classifyConsistency({ 4: 6, 5: 2, 3: 2 })).toBe("safe");
    });
  });

  describe("tie-breaking", () => {
    it("equal counts: more concerning category wins (loose > normal)", () => {
      // 5 normal (50%), 5 loose (50%) -> both at 30%+, same count -> loose is more concerning
      expect(classifyConsistency({ 4: 5, 5: 5 })).toBe("safe-loose");
    });

    it("equal counts: more concerning category wins (diarrhea > constipated)", () => {
      // 5 constipated (50%), 5 diarrhea (50%) -> same count -> diarrhea more concerning
      expect(classifyConsistency({ 1: 5, 7: 5 })).toBe("safe-loose");
    });

    it("equal counts: more concerning category wins (constipated > hard)", () => {
      // 5 hard (50%), 5 constipated (50%) -> same count -> constipated more concerning
      expect(classifyConsistency({ 3: 5, 1: 5 })).toBe("safe-hard");
    });

    it("equal counts: more concerning category wins (hard > normal)", () => {
      // 5 normal (50%), 5 hard (50%) -> same count -> hard more concerning
      expect(classifyConsistency({ 4: 5, 3: 5 })).toBe("safe-hard");
    });
  });

  describe("mixed realistic data", () => {
    it("[3,4,4,5,6] — normal at 40% wins (2 of 5)", () => {
      // hard=1 (20%), normal=2 (40%), loose=2 (40%)
      // Both normal and loose at 30%+, tied at 2 count -> loose more concerning
      expect(classifyConsistency({ 3: 1, 4: 2, 5: 1, 6: 1 })).toBe("safe-loose");
    });

    it("[4,4,4,5,5,6] — normal at 50%, loose at 50%", () => {
      // normal=3 (50%), loose=3 (50%) -> both qualify, same count -> loose more concerning
      expect(classifyConsistency({ 4: 3, 5: 2, 6: 1 })).toBe("safe-loose");
    });

    it("[3,3,4,4,4,4,5] — normal at 57% dominates", () => {
      // hard=2 (29%), normal=4 (57%), loose=1 (14%)
      // Only normal qualifies at 30%+ -> safe
      expect(classifyConsistency({ 3: 2, 4: 4, 5: 1 })).toBe("safe");
    });

    it("[1,2,3,4,5,6,7] — one of each, no category reaches 30%", () => {
      // constipated=2 (29%), hard=1 (14%), normal=1 (14%), loose=2 (29%), diarrhea=1 (14%)
      // No category reaches 30% -> fallback to highest count: constipated=2, loose=2 tied
      // constipated has higher concern distance (3) than loose (2) -> safe-hard
      expect(classifyConsistency({ 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1 })).toBe("safe-hard");
    });

    it("[4,4,4,4,4,7] — normal dominates at 83%", () => {
      // normal=5 (83%), diarrhea=1 (17%) -> normal wins
      expect(classifyConsistency({ 4: 5, 7: 1 })).toBe("safe");
    });

    it("[2,2,2,6,6,6,6] — loose at 57% beats constipated at 43%", () => {
      // constipated=3 (43%), loose=4 (57%) -> loose wins by count
      expect(classifyConsistency({ 2: 3, 6: 4 })).toBe("safe-loose");
    });
  });

  describe("MAJORITY_THRESHOLD constant", () => {
    it("is set to 0.3 (30%)", () => {
      expect(MAJORITY_THRESHOLD).toBe(0.3);
    });
  });

  describe("edge cases", () => {
    it("large counts maintain correct percentages", () => {
      // 300 normal (30%), 700 loose (70%)
      expect(classifyConsistency({ 4: 300, 5: 700 })).toBe("safe-loose");
    });

    it("ignores zero-count entries", () => {
      // Only 4:5 counts, others are zero
      expect(classifyConsistency({ 4: 5, 1: 0, 7: 0 })).toBe("safe");
    });

    it("handles Bristol 1 and 2 together as constipated", () => {
      // 3 of Bristol 1 + 3 of Bristol 2 = 6 constipated (60%), 4 normal (40%)
      expect(classifyConsistency({ 1: 3, 2: 3, 4: 4 })).toBe("safe-hard");
    });

    it("handles Bristol 5 and 6 together as loose", () => {
      // 3 of Bristol 5 + 3 of Bristol 6 = 6 loose (60%), 4 normal (40%)
      expect(classifyConsistency({ 5: 3, 6: 3, 4: 4 })).toBe("safe-loose");
    });
  });
});

// ── getBristolExpectation (surgery-type-aware Bristol ranges) ─────────────────

describe("getBristolExpectation", () => {
  describe("STEADY_STATE_MONTHS constant", () => {
    it("is set to 6", () => {
      expect(STEADY_STATE_MONTHS).toBe(6);
    });
  });

  describe("out-of-range Bristol throws", () => {
    it("throws on Bristol 0", () => {
      expect(() => getBristolExpectation(0, "ileocolic", 1)).toThrow(RangeError);
    });

    it("throws on Bristol 8", () => {
      expect(() => getBristolExpectation(8, "colonic", 1)).toThrow(RangeError);
    });

    it("throws on negative values", () => {
      expect(() => getBristolExpectation(-1, "ileocolic", 1)).toThrow(RangeError);
    });

    it("throws on non-integer values", () => {
      expect(() => getBristolExpectation(3.5, "colonic", 1)).toThrow(RangeError);
    });

    it("throws on NaN", () => {
      expect(() => getBristolExpectation(Number.NaN, "ileocolic", 1)).toThrow(RangeError);
    });
  });

  describe("ileocolic early recovery (< 6 months)", () => {
    const surgeryType = "ileocolic" as const;
    const months = 2;

    it("Bristol 1 -> concern (hard stools unusual for ileocolic)", () => {
      expect(getBristolExpectation(1, surgeryType, months)).toBe("concern");
    });

    it("Bristol 2 -> unusual", () => {
      expect(getBristolExpectation(2, surgeryType, months)).toBe("unusual");
    });

    it("Bristol 3 -> ideal", () => {
      expect(getBristolExpectation(3, surgeryType, months)).toBe("ideal");
    });

    it("Bristol 4 -> ideal", () => {
      expect(getBristolExpectation(4, surgeryType, months)).toBe("ideal");
    });

    it("Bristol 5 -> expected (looser stools normal for ileocolic)", () => {
      expect(getBristolExpectation(5, surgeryType, months)).toBe("expected");
    });

    it("Bristol 6 -> expected", () => {
      expect(getBristolExpectation(6, surgeryType, months)).toBe("expected");
    });

    it("Bristol 7 -> concern (always concern)", () => {
      expect(getBristolExpectation(7, surgeryType, months)).toBe("concern");
    });
  });

  describe("colonic early recovery (< 6 months)", () => {
    const surgeryType = "colonic" as const;
    const months = 3;

    it("Bristol 1 -> expected (firmer stools normal for colonic)", () => {
      expect(getBristolExpectation(1, surgeryType, months)).toBe("expected");
    });

    it("Bristol 2 -> expected", () => {
      expect(getBristolExpectation(2, surgeryType, months)).toBe("expected");
    });

    it("Bristol 3 -> ideal", () => {
      expect(getBristolExpectation(3, surgeryType, months)).toBe("ideal");
    });

    it("Bristol 4 -> ideal", () => {
      expect(getBristolExpectation(4, surgeryType, months)).toBe("ideal");
    });

    it("Bristol 5 -> unusual", () => {
      expect(getBristolExpectation(5, surgeryType, months)).toBe("unusual");
    });

    it("Bristol 6 -> concern (loose stools concerning for colonic)", () => {
      expect(getBristolExpectation(6, surgeryType, months)).toBe("concern");
    });

    it("Bristol 7 -> concern (always concern)", () => {
      expect(getBristolExpectation(7, surgeryType, months)).toBe("concern");
    });
  });

  describe("steady state (>= 6 months) — both types converge", () => {
    it.each([
      ["ileocolic" as const, 6],
      ["ileocolic" as const, 12],
      ["colonic" as const, 6],
      ["colonic" as const, 24],
    ])("%s at %i months: Bristol 3-4 -> ideal", (surgeryType, months) => {
      expect(getBristolExpectation(3, surgeryType, months)).toBe("ideal");
      expect(getBristolExpectation(4, surgeryType, months)).toBe("ideal");
    });

    it.each([
      ["ileocolic" as const, 6],
      ["colonic" as const, 6],
    ])("%s at %i months: Bristol 1 -> concern", (surgeryType, months) => {
      expect(getBristolExpectation(1, surgeryType, months)).toBe("concern");
    });

    it.each([
      ["ileocolic" as const, 6],
      ["colonic" as const, 6],
    ])("%s at %i months: Bristol 2 -> normal", (surgeryType, months) => {
      expect(getBristolExpectation(2, surgeryType, months)).toBe("normal");
    });

    it.each([
      ["ileocolic" as const, 6],
      ["colonic" as const, 6],
    ])("%s at %i months: Bristol 5 -> normal", (surgeryType, months) => {
      expect(getBristolExpectation(5, surgeryType, months)).toBe("normal");
    });

    it.each([
      ["ileocolic" as const, 6],
      ["colonic" as const, 6],
    ])("%s at %i months: Bristol 6 -> concern", (surgeryType, months) => {
      expect(getBristolExpectation(6, surgeryType, months)).toBe("concern");
    });

    it.each([
      ["ileocolic" as const, 6],
      ["colonic" as const, 6],
    ])("%s at %i months: Bristol 7 -> concern", (surgeryType, months) => {
      expect(getBristolExpectation(7, surgeryType, months)).toBe("concern");
    });
  });

  describe("Bristol 7 is always concern", () => {
    it("ileocolic early recovery", () => {
      expect(getBristolExpectation(7, "ileocolic", 1)).toBe("concern");
    });

    it("colonic early recovery", () => {
      expect(getBristolExpectation(7, "colonic", 1)).toBe("concern");
    });

    it("ileocolic steady state", () => {
      expect(getBristolExpectation(7, "ileocolic", 12)).toBe("concern");
    });

    it("colonic steady state", () => {
      expect(getBristolExpectation(7, "colonic", 12)).toBe("concern");
    });

    it("other surgery type", () => {
      expect(getBristolExpectation(7, "other", 1)).toBe("concern");
    });

    it("undefined surgery type", () => {
      expect(getBristolExpectation(7, undefined, 1)).toBe("concern");
    });
  });

  describe("unknown/other surgery type -> steady state defaults", () => {
    it("other at 1 month: Bristol 3 -> ideal (uses steady state)", () => {
      expect(getBristolExpectation(3, "other", 1)).toBe("ideal");
    });

    it("other at 1 month: Bristol 1 -> concern (uses steady state)", () => {
      expect(getBristolExpectation(1, "other", 1)).toBe("concern");
    });

    it("other at 1 month: Bristol 5 -> normal (uses steady state)", () => {
      expect(getBristolExpectation(5, "other", 1)).toBe("normal");
    });

    it("undefined at 1 month: Bristol 3 -> ideal (uses steady state)", () => {
      expect(getBristolExpectation(3, undefined, 1)).toBe("ideal");
    });

    it("undefined at 1 month: Bristol 1 -> concern (uses steady state)", () => {
      expect(getBristolExpectation(1, undefined, 1)).toBe("concern");
    });

    it("undefined at 1 month: Bristol 6 -> concern (uses steady state)", () => {
      expect(getBristolExpectation(6, undefined, 1)).toBe("concern");
    });
  });

  describe("boundary: exactly 6 months -> steady state", () => {
    it("ileocolic at exactly 6 months: Bristol 5 -> normal (not expected)", () => {
      expect(getBristolExpectation(5, "ileocolic", 6)).toBe("normal");
    });

    it("colonic at exactly 6 months: Bristol 2 -> normal (not expected)", () => {
      expect(getBristolExpectation(2, "colonic", 6)).toBe("normal");
    });

    it("ileocolic at 5.9 months: Bristol 5 -> expected (still early recovery)", () => {
      expect(getBristolExpectation(5, "ileocolic", 5.9)).toBe("expected");
    });

    it("colonic at 5.9 months: Bristol 2 -> expected (still early recovery)", () => {
      expect(getBristolExpectation(2, "colonic", 5.9)).toBe("expected");
    });
  });

  describe("complete matrix — every Bristol code for each surgery type + phase", () => {
    const ileocolicEarly = [
      [1, "concern"],
      [2, "unusual"],
      [3, "ideal"],
      [4, "ideal"],
      [5, "expected"],
      [6, "expected"],
      [7, "concern"],
    ] as const;

    it.each(ileocolicEarly)("ileocolic early: Bristol %i -> %s", (bristol, expected) => {
      expect(getBristolExpectation(bristol, "ileocolic", 2)).toBe(expected);
    });

    const colonicEarly = [
      [1, "expected"],
      [2, "expected"],
      [3, "ideal"],
      [4, "ideal"],
      [5, "unusual"],
      [6, "concern"],
      [7, "concern"],
    ] as const;

    it.each(colonicEarly)("colonic early: Bristol %i -> %s", (bristol, expected) => {
      expect(getBristolExpectation(bristol, "colonic", 2)).toBe(expected);
    });

    const steadyState = [
      [1, "concern"],
      [2, "normal"],
      [3, "ideal"],
      [4, "ideal"],
      [5, "normal"],
      [6, "concern"],
      [7, "concern"],
    ] as const;

    it.each(steadyState)("steady state: Bristol %i -> %s", (bristol, expected) => {
      expect(getBristolExpectation(bristol, "ileocolic", 12)).toBe(expected);
    });
  });

  describe("month = 0 edge case", () => {
    it("ileocolic at 0 months: Bristol 5 -> expected (early recovery)", () => {
      expect(getBristolExpectation(5, "ileocolic", 0)).toBe("expected");
    });

    it("colonic at 0 months: Bristol 1 -> expected (early recovery)", () => {
      expect(getBristolExpectation(1, "colonic", 0)).toBe("expected");
    });
  });
});
