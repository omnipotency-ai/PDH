import { describe, expect, it } from "vitest";
import { isValidGtinBarcode, normalizeBarcode } from "../lib/ingredientNutritionHelpers";

describe("ingredientNutrition barcode helpers", () => {
  it("normalizes barcode input to digits only", () => {
    expect(normalizeBarcode("  4006381333931 ")).toBe("4006381333931");
    expect(normalizeBarcode(" 4006 3813-3393 1 ")).toBe("4006381333931");
  });

  it("accepts common GTIN check digits", () => {
    expect(isValidGtinBarcode("4006381333931")).toBe(true);
    expect(isValidGtinBarcode("036000291452")).toBe(true);
    expect(isValidGtinBarcode("96385074")).toBe(true);
    expect(isValidGtinBarcode("00012345600012")).toBe(true);
  });

  it("rejects malformed or checksum-invalid barcodes", () => {
    expect(isValidGtinBarcode("1234567")).toBe(false);
    expect(isValidGtinBarcode("4006381333932")).toBe(false);
    expect(isValidGtinBarcode("036000291453")).toBe(false);
    expect(isValidGtinBarcode("00012345600013")).toBe(false);
  });
});
