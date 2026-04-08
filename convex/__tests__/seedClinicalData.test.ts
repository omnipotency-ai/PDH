/**
 * seedClinicalData — pure mapping helper tests
 *
 * Tests the mapRegistryEntryToRow function with mock entries to verify
 * correct field mapping from FoodRegistryEntry + PortionData to the
 * clinicalRegistry table shape.
 */
import { describe, expect, it } from "vitest";
import { mapRegistryEntryToRow } from "../seedClinicalData";
import type { FoodRegistryEntry } from "../../shared/foodRegistryData";
import type { PortionData } from "../../shared/foodPortionData";

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_ENTRY_MINIMAL: FoodRegistryEntry = {
  canonical: "white rice",
  zone: 1,
  subzone: "1B",
  category: "carbohydrate",
  subcategory: "grain",
  macros: ["carbohydrate"],
  group: "carbs",
  line: "grains",
  lineOrder: 1,
  examples: ["white rice", "plain rice", "basmati rice"],
  notes: "Well-cooked, low-residue grain.",
  osmoticEffect: "low",
  totalResidue: "very_low",
  fiberTotalApproxG: 0.4,
  fiberInsolubleLevel: "low",
  fiberSolubleLevel: "low",
  gasProducing: "no",
  dryTexture: "no",
  irritantLoad: "none",
  highFatRisk: "none",
  lactoseRisk: "none",
};

const MOCK_ENTRY_NO_OPTIONALS: FoodRegistryEntry = {
  canonical: "olive oil",
  zone: 2,
  category: "fat",
  subcategory: "oil",
  macros: ["fat"],
  group: "fats",
  line: "oils",
  lineOrder: 1,
  examples: ["olive oil", "extra virgin olive oil"],
};

const MOCK_PORTION: PortionData = {
  defaultPortionG: 150,
  naturalUnit: "cup",
  unitWeightG: 185,
  caloriesPer100g: 130,
  proteinPer100g: 2.7,
  carbsPer100g: 28,
  fatPer100g: 0.3,
  sugarsPer100g: 0,
  fiberPer100g: 0.4,
  source: "usda",
};

const NOW = 1712534400000; // Fixed timestamp for deterministic tests

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("mapRegistryEntryToRow", () => {
  it("maps all required fields correctly", () => {
    const row = mapRegistryEntryToRow(MOCK_ENTRY_MINIMAL, undefined, NOW);

    expect(row.canonicalName).toBe("white rice");
    expect(row.zone).toBe(1);
    expect(row.category).toBe("carbohydrate");
    expect(row.subcategory).toBe("grain");
    expect(row.group).toBe("carbs");
    expect(row.line).toBe("grains");
    expect(row.lineOrder).toBe(1);
    expect(row.macros).toEqual(["carbohydrate"]);
    expect(row.createdAt).toBe(NOW);
    expect(row.updatedAt).toBe(NOW);
  });

  it("maps optional subzone when present", () => {
    const row = mapRegistryEntryToRow(MOCK_ENTRY_MINIMAL, undefined, NOW);
    expect(row.subzone).toBe("1B");
  });

  it("omits subzone when not present", () => {
    const row = mapRegistryEntryToRow(MOCK_ENTRY_NO_OPTIONALS, undefined, NOW);
    expect(row).not.toHaveProperty("subzone");
  });

  it("maps optional notes when present", () => {
    const row = mapRegistryEntryToRow(MOCK_ENTRY_MINIMAL, undefined, NOW);
    expect(row.notes).toBe("Well-cooked, low-residue grain.");
  });

  it("omits notes when not present", () => {
    const row = mapRegistryEntryToRow(MOCK_ENTRY_NO_OPTIONALS, undefined, NOW);
    expect(row).not.toHaveProperty("notes");
  });

  it("maps portion data when provided", () => {
    const row = mapRegistryEntryToRow(MOCK_ENTRY_MINIMAL, MOCK_PORTION, NOW);

    expect(row.defaultPortionG).toBe(150);
    expect(row.naturalUnit).toBe("cup");
    expect(row.unitWeightG).toBe(185);
  });

  it("omits portion fields when portion is undefined", () => {
    const row = mapRegistryEntryToRow(MOCK_ENTRY_MINIMAL, undefined, NOW);

    expect(row).not.toHaveProperty("defaultPortionG");
    expect(row).not.toHaveProperty("naturalUnit");
    expect(row).not.toHaveProperty("unitWeightG");
  });

  it("maps all FoodDigestionMetadata fields when present", () => {
    const row = mapRegistryEntryToRow(MOCK_ENTRY_MINIMAL, undefined, NOW);

    expect(row.osmoticEffect).toBe("low");
    expect(row.totalResidue).toBe("very_low");
    expect(row.fiberTotalApproxG).toBe(0.4);
    expect(row.fiberInsolubleLevel).toBe("low");
    expect(row.fiberSolubleLevel).toBe("low");
    expect(row.gasProducing).toBe("no");
    expect(row.dryTexture).toBe("no");
    expect(row.irritantLoad).toBe("none");
    expect(row.highFatRisk).toBe("none");
    expect(row.lactoseRisk).toBe("none");
  });

  it("omits all FoodDigestionMetadata fields when not present", () => {
    const row = mapRegistryEntryToRow(MOCK_ENTRY_NO_OPTIONALS, undefined, NOW);

    expect(row).not.toHaveProperty("osmoticEffect");
    expect(row).not.toHaveProperty("totalResidue");
    expect(row).not.toHaveProperty("fiberTotalApproxG");
    expect(row).not.toHaveProperty("fiberInsolubleLevel");
    expect(row).not.toHaveProperty("fiberSolubleLevel");
    expect(row).not.toHaveProperty("gasProducing");
    expect(row).not.toHaveProperty("dryTexture");
    expect(row).not.toHaveProperty("irritantLoad");
    expect(row).not.toHaveProperty("highFatRisk");
    expect(row).not.toHaveProperty("lactoseRisk");
  });

  it("creates a mutable copy of macros (not the readonly original)", () => {
    const row = mapRegistryEntryToRow(MOCK_ENTRY_MINIMAL, undefined, NOW);

    // The spread creates a new array — verify it's not the same reference
    expect(row.macros).not.toBe(MOCK_ENTRY_MINIMAL.macros);
    expect(row.macros).toEqual(["carbohydrate"]);
  });

  it("does not include examples field (not in clinicalRegistry schema)", () => {
    const row = mapRegistryEntryToRow(MOCK_ENTRY_MINIMAL, undefined, NOW);
    expect(row).not.toHaveProperty("examples");
  });

  it("does not include nutrition-per-100g fields from PortionData", () => {
    const row = mapRegistryEntryToRow(MOCK_ENTRY_MINIMAL, MOCK_PORTION, NOW);

    // These PortionData fields are not mapped to clinicalRegistry
    expect(row).not.toHaveProperty("caloriesPer100g");
    expect(row).not.toHaveProperty("proteinPer100g");
    expect(row).not.toHaveProperty("carbsPer100g");
    expect(row).not.toHaveProperty("fatPer100g");
    expect(row).not.toHaveProperty("sugarsPer100g");
    expect(row).not.toHaveProperty("fiberPer100g");
    expect(row).not.toHaveProperty("source");
  });

  it("handles portion data without naturalUnit/unitWeightG", () => {
    const partialPortion: PortionData = {
      defaultPortionG: 15,
      source: "usda",
    };
    const row = mapRegistryEntryToRow(
      MOCK_ENTRY_NO_OPTIONALS,
      partialPortion,
      NOW,
    );

    expect(row.defaultPortionG).toBe(15);
    expect(row).not.toHaveProperty("naturalUnit");
    expect(row).not.toHaveProperty("unitWeightG");
  });
});
