import { describe, expect, it } from "vitest";
import { formatWeight, formatWeightDelta } from "../formatWeight";

describe("formatWeight", () => {
  it("converts kg to lbs correctly", () => {
    expect(formatWeight(70, "lbs")).toBe("154.3 lbs");
  });

  it("formats kg correctly", () => {
    expect(formatWeight(70, "kg")).toBe("70.0 kg");
  });

  it("returns zero formatted correctly", () => {
    expect(formatWeight(0, "kg")).toBe("0.0 kg");
    expect(formatWeight(0, "lbs")).toBe("0.0 lbs");
  });

  it("handles decimal values", () => {
    expect(formatWeight(70.5, "kg")).toBe("70.5 kg");
    expect(formatWeight(70.5, "lbs")).toBe("155.4 lbs");
  });
});

describe("formatWeightDelta", () => {
  it("formats positive delta with plus sign", () => {
    expect(formatWeightDelta(2, "kg")).toBe("+2.0 kg");
    expect(formatWeightDelta(2, "lbs")).toBe("+4.4 lbs");
  });

  it("formats negative delta without explicit minus in prefix", () => {
    expect(formatWeightDelta(-2, "kg")).toBe("-2.0 kg");
  });

  it("formats zero as positive", () => {
    expect(formatWeightDelta(0, "kg")).toBe("+0.0 kg");
  });
});
