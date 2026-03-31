import { describe, expect, it } from "vitest";
import type { HabitConfig } from "../habitTemplates";
import { isHabitType, normalizeHabitConfig } from "../habitTemplates";

/**
 * Tests for validateHabitConfig (accessed via the public normalizeHabitConfig wrapper).
 *
 * normalizeHabitConfig spreads its input into a Record<string, unknown> and
 * delegates to validateHabitConfig, so testing normalizeHabitConfig exercises
 * the full validation path.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns a minimal valid habit config record for the given habitType. */
function validHabit(overrides: Partial<HabitConfig> = {}): HabitConfig {
  return {
    id: "habit_test",
    name: "Test Habit",
    kind: "positive",
    unit: "count",
    quickIncrement: 1,
    showOnTrack: true,
    color: "indigo",
    createdAt: 1000,
    habitType: "count",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Valid configs pass through unchanged
// ---------------------------------------------------------------------------

describe("validateHabitConfig — valid configs", () => {
  it("returns a valid positive/count habit unchanged", () => {
    const input = validHabit();
    const result = normalizeHabitConfig(input);

    expect(result.id).toBe("habit_test");
    expect(result.name).toBe("Test Habit");
    expect(result.kind).toBe("positive");
    expect(result.unit).toBe("count");
    expect(result.quickIncrement).toBe(1);
    expect(result.showOnTrack).toBe(true);
    expect(result.color).toBe("indigo");
    expect(result.createdAt).toBe(1000);
    expect(result.habitType).toBe("count");
  });

  it("preserves dailyTarget for positive habits", () => {
    const result = normalizeHabitConfig(validHabit({ dailyTarget: 8 }));
    expect(result.dailyTarget).toBe(8);
  });

  it("preserves optional fields: archivedAt, logAs, templateKey", () => {
    const result = normalizeHabitConfig(
      validHabit({
        archivedAt: 2000,
        logAs: "fluid",
        templateKey: "water",
      }),
    );
    expect(result.archivedAt).toBe(2000);
    expect(result.logAs).toBe("fluid");
    expect(result.templateKey).toBe("water");
  });

  it("preserves weeklyFrequencyTarget when valid", () => {
    const result = normalizeHabitConfig(
      validHabit({
        habitType: "activity",
        unit: "minutes",
        quickIncrement: 10,
        weeklyFrequencyTarget: 3,
      }),
    );
    expect(result.weeklyFrequencyTarget).toBe(3);
  });

  it("rounds weeklyFrequencyTarget to nearest integer", () => {
    const result = normalizeHabitConfig(
      validHabit({
        habitType: "activity",
        unit: "minutes",
        quickIncrement: 10,
        weeklyFrequencyTarget: 3.7,
      }),
    );
    expect(result.weeklyFrequencyTarget).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// dailyCap — WQ-005 patient safety fix
// ---------------------------------------------------------------------------

describe("validateHabitConfig — dailyCap (WQ-005 zero-cap fix)", () => {
  it("preserves dailyCap: 0 for destructive habits (patient safety fix)", () => {
    const result = normalizeHabitConfig(
      validHabit({
        kind: "destructive",
        habitType: "destructive",
        dailyCap: 0,
      }),
    );
    // This is the critical WQ-005 fix: dailyCap of 0 means "quit entirely"
    // and must NOT be stripped.
    expect(result.dailyCap).toBe(0);
  });

  it("preserves dailyCap: 5 for destructive habits", () => {
    const result = normalizeHabitConfig(
      validHabit({
        kind: "destructive",
        habitType: "destructive",
        dailyCap: 5,
      }),
    );
    expect(result.dailyCap).toBe(5);
  });

  it("omits dailyCap when it is undefined (no cap)", () => {
    const result = normalizeHabitConfig(
      validHabit({
        kind: "destructive",
        habitType: "destructive",
      }),
    );
    expect(result.dailyCap).toBeUndefined();
  });

  it("does not set dailyCap for negative values", () => {
    const result = normalizeHabitConfig(
      validHabit({
        kind: "destructive",
        habitType: "destructive",
        dailyCap: -1,
      }),
    );
    // dailyCap >= 0 is the guard, so -1 is excluded
    expect(result.dailyCap).toBeUndefined();
  });

  it("does not set dailyCap on positive habits even if provided", () => {
    const result = normalizeHabitConfig(
      validHabit({
        kind: "positive",
        habitType: "count",
        dailyCap: 10,
      }),
    );
    // dailyCap only applies when kind === "destructive"
    expect(result.dailyCap).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Habit types validate correctly
// ---------------------------------------------------------------------------

describe("validateHabitConfig — all habit types", () => {
  const habitTypeTestCases: Array<{
    habitType: HabitConfig["habitType"];
    unit: HabitConfig["unit"];
    quickIncrement: number;
    expectedKind: HabitConfig["kind"];
  }> = [
    {
      habitType: "count",
      unit: "count",
      quickIncrement: 1,
      expectedKind: "positive",
    },
    {
      habitType: "checkbox",
      unit: "count",
      quickIncrement: 1,
      expectedKind: "positive",
    },
    {
      habitType: "sleep",
      unit: "hours",
      quickIncrement: 0.5,
      expectedKind: "positive",
    },
    {
      habitType: "activity",
      unit: "minutes",
      quickIncrement: 10,
      expectedKind: "positive",
    },
    {
      habitType: "fluid",
      unit: "ml",
      quickIncrement: 250,
      expectedKind: "positive",
    },
    {
      habitType: "weight",
      unit: "count",
      quickIncrement: 1,
      expectedKind: "positive",
    },
    {
      habitType: "destructive",
      unit: "count",
      quickIncrement: 1,
      expectedKind: "destructive",
    },
  ];

  for (const tc of habitTypeTestCases) {
    it(`accepts habitType "${tc.habitType}" and infers kind "${tc.expectedKind}"`, () => {
      const result = normalizeHabitConfig(
        validHabit({
          habitType: tc.habitType,
          unit: tc.unit,
          quickIncrement: tc.quickIncrement,
        }),
      );
      expect(result.habitType).toBe(tc.habitType);
      expect(result.kind).toBe(tc.expectedKind);
    });
  }
});

describe("validateHabitConfig — invalid habit types", () => {
  it("infers habitType from name when rawType is unrecognized", () => {
    // "bogus" is not a valid habitType, so normalizeHabitTypeValue falls
    // through to inferHabitTypeFromName. "Test Habit" matches nothing
    // special, so it becomes "count".
    const input: Record<string, unknown> = {
      ...validHabit(),
      habitType: "bogus",
    };
    const result = normalizeHabitConfig(input as unknown as HabitConfig);
    expect(result.habitType).toBe("count");
  });

  it("infers habitType 'sleep' from name containing 'sleep'", () => {
    const input: Record<string, unknown> = {
      ...validHabit({
        name: "Sleep tracking",
        unit: "hours",
        quickIncrement: 0.5,
      }),
      habitType: "unknown",
    };
    const result = normalizeHabitConfig(input as unknown as HabitConfig);
    expect(result.habitType).toBe("sleep");
  });

  it("infers habitType 'destructive' from name containing 'cigarette'", () => {
    const input: Record<string, unknown> = {
      ...validHabit({ name: "Cigarette count" }),
      habitType: "unknown",
    };
    const result = normalizeHabitConfig(input as unknown as HabitConfig);
    expect(result.habitType).toBe("destructive");
    expect(result.kind).toBe("destructive");
  });
});

// ---------------------------------------------------------------------------
// Required fields — missing / invalid
// ---------------------------------------------------------------------------

describe("validateHabitConfig — required fields", () => {
  it("throws when id is missing", () => {
    const input = { ...validHabit(), id: undefined } as unknown as HabitConfig;
    expect(() => normalizeHabitConfig(input)).toThrow("id must be a non-empty string");
  });

  it("throws when id is empty string", () => {
    const input = validHabit({ id: "" });
    expect(() => normalizeHabitConfig(input)).toThrow("id must be a non-empty string");
  });

  it("throws when name is missing", () => {
    const input = {
      ...validHabit(),
      name: undefined,
    } as unknown as HabitConfig;
    expect(() => normalizeHabitConfig(input)).toThrow("name must be a non-empty string");
  });

  it("throws when name is empty string", () => {
    const input = validHabit({ name: "" });
    expect(() => normalizeHabitConfig(input)).toThrow("name must be a non-empty string");
  });

  it("throws when unit is invalid", () => {
    const input = {
      ...validHabit(),
      unit: "gallons",
    } as unknown as HabitConfig;
    expect(() => normalizeHabitConfig(input)).toThrow('invalid unit "gallons"');
  });

  it("throws when unit is missing", () => {
    const input = {
      ...validHabit(),
      unit: undefined,
    } as unknown as HabitConfig;
    expect(() => normalizeHabitConfig(input)).toThrow("invalid unit");
  });

  it("throws when quickIncrement is zero", () => {
    const input = validHabit({ quickIncrement: 0 });
    expect(() => normalizeHabitConfig(input)).toThrow("quickIncrement must be a positive number");
  });

  it("throws when quickIncrement is negative", () => {
    const input = validHabit({ quickIncrement: -5 });
    expect(() => normalizeHabitConfig(input)).toThrow("quickIncrement must be a positive number");
  });

  it("throws when quickIncrement is not a number", () => {
    const input = {
      ...validHabit(),
      quickIncrement: "fast",
    } as unknown as HabitConfig;
    expect(() => normalizeHabitConfig(input)).toThrow("quickIncrement must be a positive number");
  });

  it("throws when showOnTrack is not a boolean", () => {
    const input = {
      ...validHabit(),
      showOnTrack: "yes",
    } as unknown as HabitConfig;
    expect(() => normalizeHabitConfig(input)).toThrow("showOnTrack must be a boolean");
  });

  it("throws when color is missing", () => {
    const input = {
      ...validHabit(),
      color: undefined,
    } as unknown as HabitConfig;
    expect(() => normalizeHabitConfig(input)).toThrow("color must be a non-empty string");
  });

  it("throws when color is empty string", () => {
    const input = validHabit({ color: "" });
    expect(() => normalizeHabitConfig(input)).toThrow("color must be a non-empty string");
  });

  it("throws when createdAt is not a number", () => {
    const input = {
      ...validHabit(),
      createdAt: "yesterday",
    } as unknown as HabitConfig;
    expect(() => normalizeHabitConfig(input)).toThrow("createdAt must be a number");
  });
});

// ---------------------------------------------------------------------------
// Checkbox type normalization
// ---------------------------------------------------------------------------

describe("validateHabitConfig — checkbox normalization", () => {
  it("forces quickIncrement to 1 for checkbox habits", () => {
    const result = normalizeHabitConfig(validHabit({ habitType: "checkbox", quickIncrement: 5 }));
    expect(result.quickIncrement).toBe(1);
  });

  it("forces dailyTarget to 1 for checkbox habits", () => {
    const result = normalizeHabitConfig(validHabit({ habitType: "checkbox", dailyTarget: 10 }));
    expect(result.dailyTarget).toBe(1);
  });

  it("forces kind to positive for checkbox habits", () => {
    const result = normalizeHabitConfig(
      validHabit({
        habitType: "checkbox",
        kind: "destructive",
      }),
    );
    expect(result.kind).toBe("positive");
  });

  it("removes dailyCap for checkbox habits even if provided", () => {
    const input: Record<string, unknown> = {
      ...validHabit({ habitType: "checkbox" }),
      dailyCap: 5,
    };
    const result = normalizeHabitConfig(input as unknown as HabitConfig);
    expect(result.dailyCap).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Destructive type normalization
// ---------------------------------------------------------------------------

describe("validateHabitConfig — destructive normalization", () => {
  it("forces kind to destructive for destructive habits", () => {
    const result = normalizeHabitConfig(
      validHabit({
        habitType: "destructive",
        kind: "positive",
      }),
    );
    expect(result.kind).toBe("destructive");
  });

  it("removes dailyTarget for destructive habits", () => {
    const result = normalizeHabitConfig(
      validHabit({
        habitType: "destructive",
        kind: "destructive",
        dailyTarget: 5,
      }),
    );
    expect(result.dailyTarget).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Kind inference
// ---------------------------------------------------------------------------

describe("validateHabitConfig — kind inference", () => {
  it("infers kind from habitType when kind is not provided", () => {
    const input: Record<string, unknown> = {
      ...validHabit({ habitType: "fluid" }),
      kind: undefined,
    };
    const result = normalizeHabitConfig(input as unknown as HabitConfig);
    expect(result.kind).toBe("positive");
  });

  it("infers destructive kind when habitType is destructive and kind missing", () => {
    const input: Record<string, unknown> = {
      ...validHabit({ habitType: "destructive" }),
      kind: undefined,
    };
    const result = normalizeHabitConfig(input as unknown as HabitConfig);
    expect(result.kind).toBe("destructive");
  });
});

// ---------------------------------------------------------------------------
// Optional field validation
// ---------------------------------------------------------------------------

describe("validateHabitConfig — optional field validation", () => {
  it("throws when weeklyFrequencyTarget is zero", () => {
    expect(() =>
      normalizeHabitConfig(
        validHabit({
          habitType: "activity",
          unit: "minutes",
          quickIncrement: 10,
          weeklyFrequencyTarget: 0,
        }),
      ),
    ).toThrow("weeklyFrequencyTarget must be a positive number");
  });

  it("throws when weeklyFrequencyTarget is negative", () => {
    expect(() =>
      normalizeHabitConfig(
        validHabit({
          habitType: "activity",
          unit: "minutes",
          quickIncrement: 10,
          weeklyFrequencyTarget: -1,
        }),
      ),
    ).toThrow("weeklyFrequencyTarget must be a positive number");
  });

  it("throws when weeklyFrequencyTarget is NaN", () => {
    const input: Record<string, unknown> = {
      ...validHabit({
        habitType: "activity",
        unit: "minutes",
        quickIncrement: 10,
      }),
      weeklyFrequencyTarget: NaN,
    };
    expect(() => normalizeHabitConfig(input as unknown as HabitConfig)).toThrow(
      "weeklyFrequencyTarget must be a positive number",
    );
  });

  it("throws when archivedAt is not a number", () => {
    const input: Record<string, unknown> = {
      ...validHabit(),
      archivedAt: "2024-01-01",
    };
    expect(() => normalizeHabitConfig(input as unknown as HabitConfig)).toThrow(
      "archivedAt must be a number if provided",
    );
  });

  it("throws when logAs is invalid", () => {
    const input: Record<string, unknown> = {
      ...validHabit(),
      logAs: "food",
    };
    expect(() => normalizeHabitConfig(input as unknown as HabitConfig)).toThrow(
      'logAs must be "habit" or "fluid"',
    );
  });

  it("throws when templateKey is not a string", () => {
    const input: Record<string, unknown> = {
      ...validHabit(),
      templateKey: 123,
    };
    expect(() => normalizeHabitConfig(input as unknown as HabitConfig)).toThrow(
      "templateKey must be a string if provided",
    );
  });

  it("does not include dailyTarget when not provided", () => {
    const result = normalizeHabitConfig(validHabit());
    expect(result.dailyTarget).toBeUndefined();
  });

  it("does not include dailyTarget for positive habit when dailyTarget is 0", () => {
    const result = normalizeHabitConfig(validHabit({ dailyTarget: 0 }));
    // dailyTarget > 0 is required for it to be set
    expect(result.dailyTarget).toBeUndefined();
  });

  it("does not include dailyTarget for positive habit when dailyTarget is negative", () => {
    const result = normalizeHabitConfig(validHabit({ dailyTarget: -1 }));
    expect(result.dailyTarget).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Legacy habit type mapping
// ---------------------------------------------------------------------------

describe("validateHabitConfig — legacy type mapping", () => {
  it("maps legacy 'cigarettes' type to 'destructive'", () => {
    const input: Record<string, unknown> = {
      ...validHabit(),
      habitType: "cigarettes",
    };
    const result = normalizeHabitConfig(input as unknown as HabitConfig);
    expect(result.habitType).toBe("destructive");
    expect(result.kind).toBe("destructive");
  });

  it("maps legacy 'hydration' type to 'fluid'", () => {
    const input: Record<string, unknown> = {
      ...validHabit({ unit: "ml", quickIncrement: 250 }),
      habitType: "hydration",
    };
    const result = normalizeHabitConfig(input as unknown as HabitConfig);
    expect(result.habitType).toBe("fluid");
    expect(result.kind).toBe("positive");
  });

  it("maps legacy 'movement' type to 'activity'", () => {
    const input: Record<string, unknown> = {
      ...validHabit({ unit: "minutes", quickIncrement: 10 }),
      habitType: "movement",
    };
    const result = normalizeHabitConfig(input as unknown as HabitConfig);
    expect(result.habitType).toBe("activity");
    expect(result.kind).toBe("positive");
  });

  it("maps legacy 'medication' type to 'checkbox'", () => {
    const input: Record<string, unknown> = {
      ...validHabit(),
      habitType: "medication",
    };
    const result = normalizeHabitConfig(input as unknown as HabitConfig);
    expect(result.habitType).toBe("checkbox");
    expect(result.kind).toBe("positive");
  });

  it("overrides legacy 'hydration' to 'destructive' when kind is destructive", () => {
    const input: Record<string, unknown> = {
      ...validHabit({ unit: "ml", quickIncrement: 250 }),
      habitType: "hydration",
      kind: "destructive",
    };
    const result = normalizeHabitConfig(input as unknown as HabitConfig);
    expect(result.habitType).toBe("destructive");
    expect(result.kind).toBe("destructive");
  });
});

// ---------------------------------------------------------------------------
// isHabitType guard
// ---------------------------------------------------------------------------

describe("isHabitType", () => {
  it("returns true for all valid habit types", () => {
    const validTypes = ["sleep", "count", "activity", "fluid", "destructive", "checkbox", "weight"];
    for (const type of validTypes) {
      expect(isHabitType(type)).toBe(true);
    }
  });

  it("returns false for invalid strings", () => {
    expect(isHabitType("bogus")).toBe(false);
    expect(isHabitType("")).toBe(false);
  });

  it("returns false for non-string values", () => {
    expect(isHabitType(42)).toBe(false);
    expect(isHabitType(null)).toBe(false);
    expect(isHabitType(undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Valid unit types
// ---------------------------------------------------------------------------

describe("validateHabitConfig — all valid units", () => {
  const validUnits: HabitConfig["unit"][] = ["count", "ml", "minutes", "hours"];

  for (const unit of validUnits) {
    it(`accepts unit "${unit}"`, () => {
      const result = normalizeHabitConfig(validHabit({ unit }));
      expect(result.unit).toBe(unit);
    });
  }
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("validateHabitConfig — edge cases", () => {
  it("does not strip unknown extra properties (they are simply not in output)", () => {
    const input: Record<string, unknown> = {
      ...validHabit(),
      extraField: "should be ignored",
    };
    const result = normalizeHabitConfig(input as unknown as HabitConfig);
    // The result is a well-typed HabitConfig — extra properties are not present
    expect((result as unknown as Record<string, unknown>).extraField).toBeUndefined();
  });

  it("handles createdAt of 0 as valid", () => {
    const result = normalizeHabitConfig(validHabit({ createdAt: 0 }));
    expect(result.createdAt).toBe(0);
  });

  it("accepts fractional quickIncrement (e.g. 0.5 for sleep)", () => {
    const result = normalizeHabitConfig(
      validHabit({
        habitType: "sleep",
        unit: "hours",
        quickIncrement: 0.5,
      }),
    );
    expect(result.quickIncrement).toBe(0.5);
  });

  it("checkbox habit with dailyTarget > 1 is clamped to 1", () => {
    const result = normalizeHabitConfig(
      validHabit({
        habitType: "checkbox",
        dailyTarget: 99,
      }),
    );
    expect(result.dailyTarget).toBe(1);
  });

  it("logAs 'habit' is preserved", () => {
    const result = normalizeHabitConfig(validHabit({ logAs: "habit" }));
    expect(result.logAs).toBe("habit");
  });

  it("logAs 'fluid' is preserved", () => {
    const result = normalizeHabitConfig(validHabit({ logAs: "fluid" }));
    expect(result.logAs).toBe("fluid");
  });
});
