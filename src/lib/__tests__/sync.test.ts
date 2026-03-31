import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  ActivityLogData,
  DigestiveLogData,
  FluidLogData,
  FoodItem,
  FoodLogData,
  HabitLogData,
  ReproductiveLogData,
  WeightLogData,
} from "@/types/domain";
import type { ConvexLogRow } from "../sync";
import {
  asConvexId,
  sanitizeLogData,
  toConvexFoodItem,
  toSyncedLogs,
  toValidatedSyncedLog,
} from "../sync";

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a ConvexLogRow-shaped object for testing.
 * At runtime, Convex IDs are plain strings. We cast to ConvexLogRow
 * to satisfy the type system without importing Convex internals.
 */
function makeRow(
  overrides: Partial<{
    id: string;
    timestamp: number;
    type: string;
    data: unknown;
  }>,
): ConvexLogRow {
  return {
    id: overrides.id ?? "test-id-123",
    timestamp: overrides.timestamp ?? 1700000000000,
    type: overrides.type ?? "food",
    data: overrides.data ?? { items: [] },
  } as ConvexLogRow;
}

// ── asConvexId ───────────────────────────────────────────────────────────────

describe("asConvexId", () => {
  it("returns the string re-branded as a Convex Id for a valid id", () => {
    const id = "abc123def456";
    const result = asConvexId<"logs">(id);
    // At runtime, the branded Id is just the same string
    expect(result).toBe(id);
  });

  it("throws on empty string (WQ-032 fix)", () => {
    expect(() => asConvexId<"logs">("")).toThrow("asConvexId: received empty string");
  });

  it("accepts a single-character id", () => {
    const result = asConvexId<"logs">("x");
    expect(result).toBe("x");
  });
});

// ── toConvexFoodItem ─────────────────────────────────────────────────────────

describe("toConvexFoodItem", () => {
  it("converts canonicalName: null to undefined (omits the field)", () => {
    const item: FoodItem = {
      parsedName: "chicken breast",
      canonicalName: null,
      quantity: 200,
      unit: "g",
    };
    const result = toConvexFoodItem(item);
    expect(result).not.toHaveProperty("canonicalName");
    expect(result.parsedName).toBe("chicken breast");
    expect(result.quantity).toBe(200);
    expect(result.unit).toBe("g");
  });

  it("preserves canonicalName when it is a non-empty string", () => {
    const item: FoodItem = {
      parsedName: "chicken",
      canonicalName: "chicken breast",
      quantity: 100,
      unit: "g",
    };
    const result = toConvexFoodItem(item);
    expect(result.canonicalName).toBe("chicken breast");
  });

  it("omits canonicalName when it is undefined", () => {
    const item: FoodItem = {
      parsedName: "rice",
      quantity: 150,
      unit: "g",
    };
    const result = toConvexFoodItem(item);
    expect(result).not.toHaveProperty("canonicalName");
  });

  it("preserves all other fields unchanged", () => {
    const item: FoodItem = {
      userSegment: "grilled chicken with herbs",
      parsedName: "chicken",
      canonicalName: "chicken",
      quantity: 200,
      unit: "g",
      quantityText: "200g",
      preparation: "grilled",
      recoveryStage: 2,
      spiceLevel: "mild",
      bucketKey: "protein",
      bucketLabel: "Protein",
      matchConfidence: 0.95,
      matchStrategy: "fuzzy",
      resolvedBy: "user",
    };
    const result = toConvexFoodItem(item);
    expect(result.userSegment).toBe("grilled chicken with herbs");
    expect(result.parsedName).toBe("chicken");
    expect(result.canonicalName).toBe("chicken");
    expect(result.quantity).toBe(200);
    expect(result.unit).toBe("g");
    expect(result.quantityText).toBe("200g");
    expect(result.preparation).toBe("grilled");
    expect(result.recoveryStage).toBe(2);
    expect(result.spiceLevel).toBe("mild");
    expect(result.bucketKey).toBe("protein");
    expect(result.bucketLabel).toBe("Protein");
    expect(result.matchConfidence).toBe(0.95);
    expect(result.matchStrategy).toBe("fuzzy");
    expect(result.resolvedBy).toBe("user");
  });
});

// ── sanitizeLogData ──────────────────────────────────────────────────────────

describe("sanitizeLogData", () => {
  describe("food type", () => {
    it("produces correct output shape with items converted via toConvexFoodItem", () => {
      const data: FoodLogData = {
        items: [
          {
            parsedName: "chicken",
            canonicalName: null,
            quantity: 200,
            unit: "g",
          },
          {
            parsedName: "rice",
            canonicalName: "white rice",
            quantity: 150,
            unit: "g",
          },
        ],
        rawInput: "chicken and rice",
        notes: "lunch meal",
        mealSlot: "lunch",
      };
      const result = sanitizeLogData("food", data);
      // Result should have items array with canonicalName: null converted
      expect(result).toHaveProperty("items");
      const items = (result as { items: unknown[] }).items;
      expect(items).toHaveLength(2);
      // First item: canonicalName was null, should be omitted
      expect(items[0]).not.toHaveProperty("canonicalName");
      // Second item: canonicalName was "white rice", should be preserved
      expect((items[1] as { canonicalName?: string }).canonicalName).toBe("white rice");
      expect(result).toHaveProperty("rawInput", "chicken and rice");
      expect(result).toHaveProperty("notes", "lunch meal");
      expect(result).toHaveProperty("mealSlot", "lunch");
    });

    it("omits optional fields when they are undefined", () => {
      const data: FoodLogData = {
        items: [{ parsedName: "toast", quantity: 1, unit: "slice" }],
      };
      const result = sanitizeLogData("food", data);
      expect(result).toHaveProperty("items");
      expect(result).not.toHaveProperty("rawInput");
      expect(result).not.toHaveProperty("notes");
      expect(result).not.toHaveProperty("mealSlot");
    });
  });

  describe("fluid type", () => {
    it("produces correct output shape", () => {
      const data: FluidLogData = {
        items: [{ name: "water", quantity: 500, unit: "ml" }],
      };
      const result = sanitizeLogData("fluid", data);
      expect(result).toEqual({
        items: [{ name: "water", quantity: 500, unit: "ml" }],
      });
    });

    it("handles multiple fluid items", () => {
      const data: FluidLogData = {
        items: [
          { name: "water", quantity: 500, unit: "ml" },
          { name: "coffee", quantity: 250, unit: "ml" },
        ],
      };
      const result = sanitizeLogData("fluid", data);
      const items = (result as { items: unknown[] }).items;
      expect(items).toHaveLength(2);
    });
  });

  describe("digestion type", () => {
    it("produces correct output with all fields", () => {
      const data: DigestiveLogData = {
        bristolCode: 4,
        urgencyTag: "moderate",
        effortTag: "normal",
        consistencyTag: "formed",
        volumeTag: "medium",
        accident: false,
        notes: "normal BM",
        episodesCount: 2,
        windowMinutes: 30,
      };
      const result = sanitizeLogData("digestion", data);
      expect(result).toHaveProperty("bristolCode", 4);
      expect(result).toHaveProperty("urgencyTag", "moderate");
      expect(result).toHaveProperty("effortTag", "normal");
      expect(result).toHaveProperty("consistencyTag", "formed");
      expect(result).toHaveProperty("volumeTag", "medium");
      expect(result).toHaveProperty("accident", false);
      expect(result).toHaveProperty("notes", "normal BM");
      expect(result).toHaveProperty("episodesCount", 2);
      expect(result).toHaveProperty("windowMinutes", 30);
    });

    it("omits optional fields when they are undefined", () => {
      const data: DigestiveLogData = {
        bristolCode: 3,
      };
      const result = sanitizeLogData("digestion", data);
      expect(result).toHaveProperty("bristolCode", 3);
      expect(result).not.toHaveProperty("urgencyTag");
      expect(result).not.toHaveProperty("effortTag");
      expect(result).not.toHaveProperty("consistencyTag");
      expect(result).not.toHaveProperty("volumeTag");
      expect(result).not.toHaveProperty("accident");
      expect(result).not.toHaveProperty("notes");
      expect(result).not.toHaveProperty("episodesCount");
      expect(result).not.toHaveProperty("windowMinutes");
    });
  });

  describe("habit type", () => {
    it("produces correct output with all fields", () => {
      const data: HabitLogData = {
        habitId: "cig-1",
        name: "Cigarettes",
        habitType: "destructive",
        quantity: 5,
        action: "smoked",
      };
      const result = sanitizeLogData("habit", data);
      expect(result).toHaveProperty("habitId", "cig-1");
      expect(result).toHaveProperty("name", "Cigarettes");
      expect(result).toHaveProperty("habitType", "destructive");
      expect(result).toHaveProperty("quantity", 5);
      expect(result).toHaveProperty("action", "smoked");
    });

    it("omits optional fields when undefined", () => {
      const data: HabitLogData = {
        habitId: "med-1",
        name: "Medication",
        habitType: "checkbox",
      };
      const result = sanitizeLogData("habit", data);
      expect(result).toHaveProperty("habitId", "med-1");
      expect(result).toHaveProperty("name", "Medication");
      expect(result).toHaveProperty("habitType", "checkbox");
      expect(result).not.toHaveProperty("quantity");
      expect(result).not.toHaveProperty("action");
    });
  });

  describe("activity type", () => {
    it("produces correct output with all fields", () => {
      const data: ActivityLogData = {
        activityType: "walking",
        durationMinutes: 30,
        feelTag: "good",
      };
      const result = sanitizeLogData("activity", data);
      expect(result).toHaveProperty("activityType", "walking");
      expect(result).toHaveProperty("durationMinutes", 30);
      expect(result).toHaveProperty("feelTag", "good");
    });

    it("omits optional fields when undefined", () => {
      const data: ActivityLogData = {
        activityType: "yoga",
      };
      const result = sanitizeLogData("activity", data);
      expect(result).toHaveProperty("activityType", "yoga");
      expect(result).not.toHaveProperty("durationMinutes");
      expect(result).not.toHaveProperty("feelTag");
    });
  });

  describe("weight type", () => {
    it("produces correct output", () => {
      const data: WeightLogData = {
        weightKg: 72.5,
      };
      const result = sanitizeLogData("weight", data);
      expect(result).toEqual({ weightKg: 72.5 });
    });
  });

  describe("reproductive type", () => {
    it("produces correct output with all fields", () => {
      const data: ReproductiveLogData = {
        entryType: "cycle",
        periodStartDate: "2026-03-01",
        bleedingStatus: "medium",
        symptoms: ["cramps", "bloating"],
        notes: "day 2",
      };
      const result = sanitizeLogData("reproductive", data);
      expect(result).toHaveProperty("entryType", "cycle");
      expect(result).toHaveProperty("periodStartDate", "2026-03-01");
      expect(result).toHaveProperty("bleedingStatus", "medium");
      expect(result).toHaveProperty("symptoms");
      expect((result as { symptoms: string[] }).symptoms).toEqual(["cramps", "bloating"]);
      expect(result).toHaveProperty("notes", "day 2");
    });

    it("omits optional fields when undefined", () => {
      const data: ReproductiveLogData = {
        entryType: "cycle",
        periodStartDate: "2026-03-01",
        bleedingStatus: "none",
      };
      const result = sanitizeLogData("reproductive", data);
      expect(result).toHaveProperty("entryType", "cycle");
      expect(result).toHaveProperty("periodStartDate", "2026-03-01");
      expect(result).toHaveProperty("bleedingStatus", "none");
      expect(result).not.toHaveProperty("symptoms");
      expect(result).not.toHaveProperty("notes");
    });
  });

  describe("sanitization", () => {
    it("sanitizes string fields in food data (trims whitespace, strips control chars)", () => {
      const data: FoodLogData = {
        items: [{ parsedName: "  chicken  ", quantity: 200, unit: "  g  " }],
        rawInput: "  raw input  ",
        notes: "  some notes  ",
      };
      const result = sanitizeLogData("food", data);
      const items = (result as { items: Array<{ parsedName?: string; unit: string | null }> })
        .items;
      expect(items[0].parsedName).toBe("chicken");
      expect(items[0].unit).toBe("g");
      expect((result as { rawInput: string }).rawInput).toBe("raw input");
      expect((result as { notes: string }).notes).toBe("some notes");
    });

    it("sanitizes string fields in habit data", () => {
      const data: HabitLogData = {
        habitId: "  hab-1  ",
        name: "  Sleep  ",
        habitType: "  sleep  ",
      };
      const result = sanitizeLogData("habit", data);
      expect(result).toHaveProperty("habitId", "hab-1");
      expect(result).toHaveProperty("name", "Sleep");
      expect(result).toHaveProperty("habitType", "sleep");
    });
  });
});

// ── toValidatedSyncedLog ─────────────────────────────────────────────────────

describe("toValidatedSyncedLog", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("valid log types", () => {
    it("converts a food log row to a SyncedLog with type 'food'", () => {
      const foodData: FoodLogData = {
        items: [{ parsedName: "banana", quantity: 1, unit: "piece" }],
      };
      const row = makeRow({
        id: "food-1",
        type: "food",
        data: foodData,
        timestamp: 1000,
      });
      const result = toValidatedSyncedLog(row);
      expect(result).not.toBeNull();
      if (result === null) throw new Error("expected result");
      expect(result.id).toBe("food-1");
      expect(result.timestamp).toBe(1000);
      expect(result.type).toBe("food");
      expect(result.data).toBe(foodData);
    });

    it("converts a fluid log row", () => {
      const fluidData: FluidLogData = {
        items: [{ name: "water", quantity: 500, unit: "ml" }],
      };
      const row = makeRow({ id: "fluid-1", type: "fluid", data: fluidData });
      const result = toValidatedSyncedLog(row);
      expect(result).not.toBeNull();
      if (result === null) throw new Error("expected result");
      expect(result.type).toBe("fluid");
      expect(result.data).toBe(fluidData);
    });

    it("converts a digestion log row", () => {
      const digestData: DigestiveLogData = { bristolCode: 4 };
      const row = makeRow({
        id: "digest-1",
        type: "digestion",
        data: digestData,
      });
      const result = toValidatedSyncedLog(row);
      expect(result).not.toBeNull();
      if (result === null) throw new Error("expected result");
      expect(result.type).toBe("digestion");
      expect(result.data).toBe(digestData);
    });

    it("converts a habit log row", () => {
      const habitData: HabitLogData = {
        habitId: "sleep-1",
        name: "Sleep",
        habitType: "sleep",
        quantity: 8,
      };
      const row = makeRow({ id: "habit-1", type: "habit", data: habitData });
      const result = toValidatedSyncedLog(row);
      expect(result).not.toBeNull();
      if (result === null) throw new Error("expected result");
      expect(result.type).toBe("habit");
      expect(result.data).toBe(habitData);
    });

    it("converts an activity log row", () => {
      const activityData: ActivityLogData = {
        activityType: "walking",
        durationMinutes: 45,
      };
      const row = makeRow({
        id: "act-1",
        type: "activity",
        data: activityData,
      });
      const result = toValidatedSyncedLog(row);
      expect(result).not.toBeNull();
      if (result === null) throw new Error("expected result");
      expect(result.type).toBe("activity");
      expect(result.data).toBe(activityData);
    });

    it("converts a weight log row", () => {
      const weightData: WeightLogData = { weightKg: 75.0 };
      const row = makeRow({ id: "weight-1", type: "weight", data: weightData });
      const result = toValidatedSyncedLog(row);
      expect(result).not.toBeNull();
      if (result === null) throw new Error("expected result");
      expect(result.type).toBe("weight");
      expect(result.data).toBe(weightData);
    });

    it("converts a reproductive log row (descoped but handled)", () => {
      const reproData: ReproductiveLogData = {
        entryType: "cycle",
        periodStartDate: "2026-03-01",
        bleedingStatus: "light",
      };
      const row = makeRow({
        id: "repro-1",
        type: "reproductive",
        data: reproData,
      });
      const result = toValidatedSyncedLog(row);
      expect(result).not.toBeNull();
      if (result === null) throw new Error("expected result");
      expect(result.type).toBe("reproductive");
      expect(result.data).toBe(reproData);
    });
  });

  describe("invalid log rows", () => {
    it("returns null and warns for an unknown type string", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const row = makeRow({ id: "bad-1", type: "unknown_type", data: {} });
      const result = toValidatedSyncedLog(row);
      expect(result).toBeNull();
      expect(warnSpy).toHaveBeenCalledOnce();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('unexpected type "unknown_type"'),
      );
    });

    it("returns null for an empty type string", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const row = makeRow({ id: "bad-2", type: "", data: {} });
      const result = toValidatedSyncedLog(row);
      expect(result).toBeNull();
      expect(warnSpy).toHaveBeenCalledOnce();
    });

    it("includes the row id in the warning message", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const row = makeRow({ id: "specific-id-999", type: "bogus", data: {} });
      toValidatedSyncedLog(row);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("specific-id-999"));
    });
  });
});

// ── toSyncedLogs ─────────────────────────────────────────────────────────────

describe("toSyncedLogs", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty array for undefined input", () => {
    const result = toSyncedLogs(undefined);
    expect(result).toEqual([]);
  });

  it("returns empty array for empty array input", () => {
    const result = toSyncedLogs([]);
    expect(result).toEqual([]);
  });

  it("converts all 6 active log types in a single batch", () => {
    const rows: ConvexLogRow[] = [
      makeRow({ id: "f1", type: "food", data: { items: [] } }),
      makeRow({ id: "f2", type: "fluid", data: { items: [] } }),
      makeRow({ id: "d1", type: "digestion", data: { bristolCode: 3 } }),
      makeRow({
        id: "h1",
        type: "habit",
        data: { habitId: "h", name: "n", habitType: "count" },
      }),
      makeRow({ id: "a1", type: "activity", data: { activityType: "walk" } }),
      makeRow({ id: "w1", type: "weight", data: { weightKg: 70 } }),
    ];
    const result = toSyncedLogs(rows);
    expect(result).toHaveLength(6);
    expect(result.map((r) => r.type)).toEqual([
      "food",
      "fluid",
      "digestion",
      "habit",
      "activity",
      "weight",
    ]);
  });

  it("skips invalid rows without crashing", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const rows: ConvexLogRow[] = [
      makeRow({ id: "valid-1", type: "food", data: { items: [] } }),
      makeRow({ id: "bad-1", type: "nonsense", data: {} }),
      makeRow({ id: "valid-2", type: "weight", data: { weightKg: 65 } }),
    ];
    const result = toSyncedLogs(rows);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("valid-1");
    expect(result[1].id).toBe("valid-2");
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it("handles reproductive type rows without crashing", () => {
    const rows: ConvexLogRow[] = [
      makeRow({
        id: "repro-1",
        type: "reproductive",
        data: {
          entryType: "cycle",
          periodStartDate: "2026-03-01",
          bleedingStatus: "none",
        },
      }),
    ];
    const result = toSyncedLogs(rows);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("reproductive");
  });

  it("preserves row order from input", () => {
    const rows: ConvexLogRow[] = [
      makeRow({
        id: "c",
        type: "weight",
        data: { weightKg: 70 },
        timestamp: 3000,
      }),
      makeRow({ id: "a", type: "food", data: { items: [] }, timestamp: 1000 }),
      makeRow({ id: "b", type: "fluid", data: { items: [] }, timestamp: 2000 }),
    ];
    const result = toSyncedLogs(rows);
    expect(result.map((r) => r.id)).toEqual(["c", "a", "b"]);
  });

  it("returns empty array when all rows have invalid types", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const rows: ConvexLogRow[] = [
      makeRow({ id: "bad-1", type: "invalid1", data: {} }),
      makeRow({ id: "bad-2", type: "invalid2", data: {} }),
    ];
    const result = toSyncedLogs(rows);
    expect(result).toEqual([]);
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });

  it("preserves the data reference for each valid row", () => {
    const foodData = {
      items: [{ parsedName: "apple", quantity: 1, unit: "piece" }],
    };
    const rows: ConvexLogRow[] = [makeRow({ id: "ref-1", type: "food", data: foodData })];
    const result = toSyncedLogs(rows);
    expect(result[0].data).toBe(foodData);
  });
});
