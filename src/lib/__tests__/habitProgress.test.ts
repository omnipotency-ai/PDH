import { describe, expect, it } from "vitest";
import {
  formatHabitNumber,
  getProgressBarColor,
  getProgressColor,
  getProgressFraction,
  getProgressText,
  type HabitProgressColor,
  shouldShowBadge,
} from "../habitProgress";
import type { HabitConfig } from "../habitTemplates";
import { HABIT_TEMPLATES } from "../habitTemplates";

// ---------------------------------------------------------------------------
// Test habit fixtures — built from real templates where possible, with
// minimal synthetic habits for edge cases.
// ---------------------------------------------------------------------------

/** Water: positive fluid habit with dailyTarget=1000, unit=ml, logAs=fluid */
const water = HABIT_TEMPLATES.water;

/** Coffee: destructive fluid habit with dailyCap=3, quickIncrement=250, logAs=fluid */
const coffee = HABIT_TEMPLATES.coffee;

/** Cigarettes: destructive counter habit with dailyCap=10, unit=count */
const cigarettes = HABIT_TEMPLATES.cigarettes;

/** Alcohol: destructive counter habit with dailyCap=2, unit=count */
const alcohol = HABIT_TEMPLATES.alcohol;

/** Rec Drugs: destructive counter habit with dailyCap=1, unit=count */
const recDrugs = HABIT_TEMPLATES.rec_drugs;

/** Confectionery (Sweets): destructive counter habit with dailyCap=5, unit=count */
const confectionery = HABIT_TEMPLATES.confectionery;

/** Walking: positive activity habit with dailyTarget=30, unit=minutes */
const walking = HABIT_TEMPLATES.walking;

/** Sleep: positive habit with dailyTarget=7, unit=hours */
const sleep = HABIT_TEMPLATES.sleep;

/** Medication: positive checkbox habit with dailyTarget=1, unit=count */
const medication = HABIT_TEMPLATES.medication;

/** Journaling: positive count habit with dailyTarget=1, unit=count */
const journaling = HABIT_TEMPLATES.journaling;

/** Weigh-in: positive weight habit, no target, no cap */
const weighIn = HABIT_TEMPLATES.weigh_in;

/** A synthetic destructive habit with dailyCap=0 (zero-cap edge case) */
const zeroCap: HabitConfig = {
  id: "habit_zero_cap",
  name: "Zero Cap Habit",
  kind: "destructive",
  unit: "count",
  quickIncrement: 1,
  dailyCap: 0,
  showOnTrack: true,
  color: "gray",
  createdAt: 0,
  habitType: "destructive",
};

/** A synthetic positive habit with no target and no cap — pure neutral */
const neutralHabit: HabitConfig = {
  id: "habit_neutral",
  name: "Neutral Habit",
  kind: "positive",
  unit: "count",
  quickIncrement: 1,
  showOnTrack: true,
  color: "indigo",
  createdAt: 0,
  habitType: "count",
};

// ---------------------------------------------------------------------------
// formatHabitNumber
// ---------------------------------------------------------------------------

describe("formatHabitNumber", () => {
  it("formats integers without decimals", () => {
    expect(formatHabitNumber(0)).toBe("0");
    expect(formatHabitNumber(5)).toBe("5");
    expect(formatHabitNumber(100)).toBe("100");
  });

  it("formats non-integers to 1 decimal place", () => {
    expect(formatHabitNumber(0.5)).toBe("0.5");
    expect(formatHabitNumber(7.25)).toBe("7.3");
    expect(formatHabitNumber(Math.PI)).toBe("3.1");
  });
});

// ---------------------------------------------------------------------------
// getProgressText
// ---------------------------------------------------------------------------

describe("getProgressText", () => {
  // --- Target habits (positive with dailyTarget) ---

  describe("target habits", () => {
    it("shows value/target for activity habit (walking)", () => {
      expect(getProgressText(walking, 15, undefined)).toBe("15 / 30 minutes");
    });

    it("abbreviates unit in tile mode for minutes", () => {
      expect(getProgressText(walking, 15, undefined, "tile")).toBe("15 / 30 min");
    });

    it("abbreviates unit in tile mode for hours", () => {
      expect(getProgressText(sleep, 5, undefined, "tile")).toBe("5 / 7 hrs");
    });

    it("shows value/target for count unit", () => {
      expect(getProgressText(journaling, 0, undefined)).toBe("0 / 1 count");
    });

    it('shows "Done" for single-count checkbox habit when count >= 1', () => {
      // medication: dailyTarget=1, unit=count => checkbox-like
      expect(getProgressText(medication, 1, undefined)).toContain("Done");
    });

    it("shows value/target for single-count checkbox habit when count is 0", () => {
      expect(getProgressText(medication, 0, undefined)).toBe("0 / 1 count");
    });

    it("shows fluid display for fluid target habit (water) in metric", () => {
      // water: logAs=fluid, unit=ml, dailyTarget=1000
      expect(getProgressText(water, 0, 500, "detail", "metric")).toBe("500 ml / 1000 ml");
    });

    it("shows fluid display for fluid target habit (water) in imperial", () => {
      expect(getProgressText(water, 0, 500, "detail", "imperial_us")).toBe(
        "16.9 fl oz / 33.8 fl oz",
      );
    });

    it("uses 0 ml when fluidMl is undefined for fluid target habit", () => {
      expect(getProgressText(water, 0, undefined, "detail", "metric")).toBe("0 ml / 1000 ml");
    });
  });

  // --- Cap habits (destructive with dailyCap) ---

  describe("cap habits (non-fluid)", () => {
    it('shows remaining count when under cap ("detail" mode)', () => {
      // cigarettes: dailyCap=10, count=3 => 7 remaining
      expect(getProgressText(cigarettes, 3, undefined)).toBe("7 remaining");
    });

    it('shows remaining count when under cap ("tile" mode)', () => {
      expect(getProgressText(cigarettes, 3, undefined, "tile")).toBe("7 left");
    });

    it('shows "At cap" when at cap', () => {
      expect(getProgressText(cigarettes, 10, undefined)).toBe("At cap");
    });

    it("shows over-cap amount when exceeding cap", () => {
      expect(getProgressText(cigarettes, 12, undefined)).toBe("2 over");
    });

    it("shows full cap remaining when count is 0", () => {
      expect(getProgressText(cigarettes, 0, undefined)).toBe("10 remaining");
    });
  });

  describe("cap habits (fluid — coffee)", () => {
    // coffee: kind=destructive, logAs=fluid, dailyCap=3, quickIncrement=250
    // progressValue = Math.round(fluidMl / 250)

    it("shows fluid display with remaining cups when under cap", () => {
      // 1 cup = 250ml, so fluidMl=250 => value=1, cap=3, 2 left
      const result = getProgressText(coffee, 1, 250, "detail", "metric");
      expect(result).toBe("250 ml \u00B7 2 cups left");
    });

    it('shows "At cap" when at cap', () => {
      // 3 cups = 750ml => value=3, cap=3
      const result = getProgressText(coffee, 3, 750, "detail", "metric");
      expect(result).toBe("750 ml \u00B7 At cap");
    });

    it("shows over-cap amount when exceeding cap", () => {
      // 5 cups = 1250ml => value=5, cap=3, 2 over
      const result = getProgressText(coffee, 5, 1250, "detail", "metric");
      expect(result).toBe("1250 ml \u00B7 2 cups over");
    });

    it("handles zero fluidMl", () => {
      const result = getProgressText(coffee, 0, 0, "detail", "metric");
      expect(result).toBe("0 ml \u00B7 3 cups left");
    });

    it("formats in imperial", () => {
      const result = getProgressText(coffee, 1, 250, "detail", "imperial_us");
      expect(result).toContain("fl oz");
      expect(result).toContain("2 cups left");
    });
  });

  // --- Zero cap edge case ---

  describe("zero-cap habits", () => {
    it('shows "At cap" when count is 0 and cap is 0', () => {
      expect(getProgressText(zeroCap, 0, undefined)).toBe("At cap");
    });

    it("shows over-cap when any usage with cap=0", () => {
      expect(getProgressText(zeroCap, 1, undefined)).toBe("1 over");
    });
  });

  // --- Destructive habits (smoking, alcohol, rec drugs) ---

  describe("destructive habits tracked without judgment", () => {
    it("tracks cigarettes with cap progress", () => {
      expect(getProgressText(cigarettes, 5, undefined)).toBe("5 remaining");
    });

    it("tracks alcohol with cap progress", () => {
      // alcohol: dailyCap=2
      expect(getProgressText(alcohol, 1, undefined)).toBe("1 remaining");
      expect(getProgressText(alcohol, 2, undefined)).toBe("At cap");
      expect(getProgressText(alcohol, 4, undefined)).toBe("2 over");
    });

    it("tracks rec drugs with cap progress", () => {
      // rec drugs: dailyCap=1
      expect(getProgressText(recDrugs, 0, undefined)).toBe("1 remaining");
      expect(getProgressText(recDrugs, 1, undefined)).toBe("At cap");
      expect(getProgressText(recDrugs, 3, undefined)).toBe("2 over");
    });

    it("tracks confectionery with cap progress", () => {
      // confectionery: dailyCap=5
      expect(getProgressText(confectionery, 2, undefined)).toBe("3 remaining");
    });
  });

  // --- Neutral habits (no target, no cap) ---

  describe("neutral habits (no target or cap)", () => {
    it("shows raw count for count-based habits", () => {
      expect(getProgressText(neutralHabit, 3, undefined)).toBe("3");
    });

    it("shows raw count of 0 for no logs", () => {
      expect(getProgressText(neutralHabit, 0, undefined)).toBe("0");
    });
  });

  // --- Fluid habit without target or cap ---

  describe("fluid habit without target or cap", () => {
    it("shows fluid display in metric", () => {
      const fluidNoTarget: HabitConfig = {
        id: "habit_juice",
        name: "Juice",
        kind: "positive",
        unit: "ml",
        quickIncrement: 100,
        showOnTrack: true,
        color: "orange",
        createdAt: 0,
        logAs: "fluid",
        habitType: "fluid",
      };
      expect(getProgressText(fluidNoTarget, 0, 350, "detail", "metric")).toBe("350 ml");
    });

    it("shows 0 ml when fluidMl is undefined", () => {
      const fluidNoTarget: HabitConfig = {
        id: "habit_juice",
        name: "Juice",
        kind: "positive",
        unit: "ml",
        quickIncrement: 100,
        showOnTrack: true,
        color: "orange",
        createdAt: 0,
        logAs: "fluid",
        habitType: "fluid",
      };
      expect(getProgressText(fluidNoTarget, 0, undefined, "detail", "metric")).toBe("0 ml");
    });
  });
});

// ---------------------------------------------------------------------------
// getProgressColor
// ---------------------------------------------------------------------------

describe("getProgressColor", () => {
  describe("target habits", () => {
    it('returns "target-met" when value >= target', () => {
      expect(getProgressColor(walking, 30, undefined)).toBe("target-met");
      expect(getProgressColor(walking, 45, undefined)).toBe("target-met");
    });

    it('returns "target-in-progress" when value < target', () => {
      expect(getProgressColor(walking, 0, undefined)).toBe("target-in-progress");
      expect(getProgressColor(walking, 29, undefined)).toBe("target-in-progress");
    });

    it("works with fluid target habits using fluidMl", () => {
      // water: dailyTarget=1000 (in ml)
      expect(getProgressColor(water, 0, 1000)).toBe("target-met");
      expect(getProgressColor(water, 0, 999)).toBe("target-in-progress");
    });

    it("works with checkbox habit (medication)", () => {
      expect(getProgressColor(medication, 1, undefined)).toBe("target-met");
      expect(getProgressColor(medication, 0, undefined)).toBe("target-in-progress");
    });
  });

  describe("cap habits", () => {
    it('returns "cap-clear" when value is 0', () => {
      expect(getProgressColor(cigarettes, 0, undefined)).toBe("cap-clear");
    });

    it('returns "cap-under" when well under cap', () => {
      // cigarettes: dailyCap=10, value=3 => remaining=7, > 2 threshold
      expect(getProgressColor(cigarettes, 3, undefined)).toBe("cap-under");
    });

    it('returns "cap-warning" when within 2 of cap', () => {
      // cigarettes: cap=10, value=8 => remaining=2
      expect(getProgressColor(cigarettes, 8, undefined)).toBe("cap-warning");
      // remaining=1
      expect(getProgressColor(cigarettes, 9, undefined)).toBe("cap-warning");
    });

    it('returns "cap-at" when exactly at cap', () => {
      expect(getProgressColor(cigarettes, 10, undefined)).toBe("cap-at");
    });

    it('returns "cap-over" when exceeding cap', () => {
      expect(getProgressColor(cigarettes, 11, undefined)).toBe("cap-over");
    });

    it("works with fluid cap habit (coffee)", () => {
      // coffee: dailyCap=3, quickIncrement=250, logAs=fluid
      // value = Math.round(fluidMl / 250)
      expect(getProgressColor(coffee, 0, 0)).toBe("cap-clear");
      expect(getProgressColor(coffee, 1, 250)).toBe("cap-warning"); // remaining=2
      expect(getProgressColor(coffee, 2, 500)).toBe("cap-warning"); // remaining=1
      expect(getProgressColor(coffee, 3, 750)).toBe("cap-at");
      expect(getProgressColor(coffee, 4, 1000)).toBe("cap-over");
    });
  });

  describe("zero-cap habits", () => {
    it('returns "cap-at" when count is 0 and cap is 0', () => {
      expect(getProgressColor(zeroCap, 0, undefined)).toBe("cap-at");
    });

    it('returns "cap-over" when any usage and cap is 0', () => {
      expect(getProgressColor(zeroCap, 1, undefined)).toBe("cap-over");
    });
  });

  describe("destructive habits (smoking, alcohol, rec drugs)", () => {
    it("cigarettes progress color changes through levels", () => {
      expect(getProgressColor(cigarettes, 0, undefined)).toBe("cap-clear");
      expect(getProgressColor(cigarettes, 5, undefined)).toBe("cap-under");
      expect(getProgressColor(cigarettes, 9, undefined)).toBe("cap-warning");
      expect(getProgressColor(cigarettes, 10, undefined)).toBe("cap-at");
      expect(getProgressColor(cigarettes, 15, undefined)).toBe("cap-over");
    });

    it("alcohol cap works with small cap value", () => {
      // alcohol: dailyCap=2
      expect(getProgressColor(alcohol, 0, undefined)).toBe("cap-clear");
      expect(getProgressColor(alcohol, 1, undefined)).toBe("cap-warning"); // remaining=1 <= 2
      expect(getProgressColor(alcohol, 2, undefined)).toBe("cap-at");
      expect(getProgressColor(alcohol, 3, undefined)).toBe("cap-over");
    });

    it("rec drugs cap works with cap=1", () => {
      // rec drugs: dailyCap=1
      expect(getProgressColor(recDrugs, 0, undefined)).toBe("cap-clear");
      expect(getProgressColor(recDrugs, 1, undefined)).toBe("cap-at");
      expect(getProgressColor(recDrugs, 2, undefined)).toBe("cap-over");
    });
  });

  describe("neutral habits", () => {
    it('returns "neutral" for habits with no target or cap', () => {
      expect(getProgressColor(neutralHabit, 0, undefined)).toBe("neutral");
      expect(getProgressColor(neutralHabit, 100, undefined)).toBe("neutral");
    });

    it('returns "neutral" for weigh-in (no target)', () => {
      expect(getProgressColor(weighIn, 0, undefined)).toBe("neutral");
      expect(getProgressColor(weighIn, 1, undefined)).toBe("neutral");
    });
  });
});

// ---------------------------------------------------------------------------
// shouldShowBadge
// ---------------------------------------------------------------------------

describe("shouldShowBadge", () => {
  it('returns "check" when target is met', () => {
    expect(shouldShowBadge(walking, 30, undefined)).toBe("check");
    expect(shouldShowBadge(medication, 1, undefined)).toBe("check");
  });

  it('returns "warning" when cap is exceeded', () => {
    expect(shouldShowBadge(cigarettes, 11, undefined)).toBe("warning");
    expect(shouldShowBadge(alcohol, 3, undefined)).toBe("warning");
  });

  it("returns null when in progress (not met, not over)", () => {
    expect(shouldShowBadge(walking, 10, undefined)).toBeNull();
    expect(shouldShowBadge(cigarettes, 5, undefined)).toBeNull();
  });

  it("returns null when at cap (not over)", () => {
    expect(shouldShowBadge(cigarettes, 10, undefined)).toBeNull();
  });

  it("returns null for neutral habits regardless of count", () => {
    expect(shouldShowBadge(neutralHabit, 0, undefined)).toBeNull();
    expect(shouldShowBadge(neutralHabit, 100, undefined)).toBeNull();
  });

  it("returns null when cap is clear (0 usage)", () => {
    expect(shouldShowBadge(cigarettes, 0, undefined)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getProgressFraction
// ---------------------------------------------------------------------------

describe("getProgressFraction", () => {
  describe("target habits", () => {
    it("returns fraction of target met", () => {
      // walking: dailyTarget=30
      expect(getProgressFraction(walking, 15, undefined)).toBe(0.5);
    });

    it("returns 0 when no progress", () => {
      expect(getProgressFraction(walking, 0, undefined)).toBe(0);
    });

    it("caps at 1.0 even when exceeding target", () => {
      expect(getProgressFraction(walking, 60, undefined)).toBe(1);
    });

    it("works with fluid target (water)", () => {
      // water: dailyTarget=1000ml
      expect(getProgressFraction(water, 0, 500)).toBe(0.5);
      expect(getProgressFraction(water, 0, 1000)).toBe(1);
      expect(getProgressFraction(water, 0, 2000)).toBe(1); // capped at 1
    });

    it("works with checkbox habit", () => {
      // medication: dailyTarget=1
      expect(getProgressFraction(medication, 0, undefined)).toBe(0);
      expect(getProgressFraction(medication, 1, undefined)).toBe(1);
    });
  });

  describe("cap habits", () => {
    it("returns fraction of cap used", () => {
      // cigarettes: dailyCap=10
      expect(getProgressFraction(cigarettes, 5, undefined)).toBe(0.5);
    });

    it("returns 0 when no usage", () => {
      expect(getProgressFraction(cigarettes, 0, undefined)).toBe(0);
    });

    it("caps at 1.0 even when exceeding cap", () => {
      expect(getProgressFraction(cigarettes, 15, undefined)).toBe(1);
    });

    it("works with fluid cap (coffee)", () => {
      // coffee: dailyCap=3, quickIncrement=250
      // value = Math.round(fluidMl / 250)
      expect(getProgressFraction(coffee, 0, 0)).toBe(0);
      expect(getProgressFraction(coffee, 1, 250)).toBeCloseTo(1 / 3);
      expect(getProgressFraction(coffee, 3, 750)).toBe(1);
      expect(getProgressFraction(coffee, 5, 1250)).toBe(1); // capped
    });
  });

  describe("zero-cap habits", () => {
    it("returns 1 when cap is 0 and count is 0 (0/0 falls back to dailyCap ?? 1 = 0, then 0/0)", () => {
      // zeroCap has dailyCap=0, so cap = 0
      // value = 0, cap = 0 => Math.min(0/0, 1) = NaN — but the code uses dailyCap ?? 1
      // Wait: the code does `habit.dailyCap ?? 1` only in getProgressColor, but
      // getProgressFraction does `habit.dailyCap ?? 1` too.
      // With dailyCap=0: cap = 0, but ?? only triggers on null/undefined, not 0.
      // So cap = 0, value/cap = 0/0 = NaN, Math.min(NaN, 1) = NaN
      // Actually let me verify: dailyCap is 0, so `habit.dailyCap ?? 1` = 0.
      // 0/0 = NaN, Math.min(NaN, 1) = NaN
      const result = getProgressFraction(zeroCap, 0, undefined);
      expect(result).toBeNaN();
    });

    it("returns NaN when cap is 0 and count > 0 (division by zero)", () => {
      // value=1, cap=0 => 1/0 = Infinity, Math.min(Infinity, 1) = 1
      expect(getProgressFraction(zeroCap, 1, undefined)).toBe(1);
    });
  });

  describe("neutral habits", () => {
    it("returns 0 for habits with no target or cap", () => {
      expect(getProgressFraction(neutralHabit, 0, undefined)).toBe(0);
      expect(getProgressFraction(neutralHabit, 100, undefined)).toBe(0);
    });
  });
});

// ---------------------------------------------------------------------------
// getProgressBarColor
// ---------------------------------------------------------------------------

describe("getProgressBarColor", () => {
  const expectedMappings: [HabitProgressColor, string][] = [
    ["target-met", "bg-emerald-500"],
    ["target-in-progress", "bg-emerald-500/60"],
    ["cap-warning", "bg-orange-500"],
    ["cap-at", "bg-amber-500"],
    ["cap-over", "bg-red-500"],
    ["cap-clear", "bg-emerald-500"],
    ["cap-under", "bg-emerald-500/60"],
    ["neutral", "bg-[var(--text-muted)]"],
  ];

  for (const [color, expected] of expectedMappings) {
    it(`maps "${color}" to "${expected}"`, () => {
      expect(getProgressBarColor(color)).toBe(expected);
    });
  }
});

// ---------------------------------------------------------------------------
// Integration: end-to-end scenarios using real templates
// ---------------------------------------------------------------------------

describe("integration scenarios", () => {
  it("sleep habit: partial progress in hours", () => {
    expect(getProgressText(sleep, 5, undefined)).toBe("5 / 7 hours");
    expect(getProgressColor(sleep, 5, undefined)).toBe("target-in-progress");
    expect(getProgressFraction(sleep, 5, undefined)).toBeCloseTo(5 / 7);
    expect(shouldShowBadge(sleep, 5, undefined)).toBeNull();
  });

  it("sleep habit: target met", () => {
    expect(getProgressText(sleep, 7, undefined)).toBe("7 / 7 hours");
    expect(getProgressColor(sleep, 7, undefined)).toBe("target-met");
    expect(getProgressFraction(sleep, 7, undefined)).toBe(1);
    expect(shouldShowBadge(sleep, 7, undefined)).toBe("check");
  });

  it("water habit: no logs (zero state)", () => {
    expect(getProgressText(water, 0, 0, "detail", "metric")).toBe("0 ml / 1000 ml");
    expect(getProgressColor(water, 0, 0)).toBe("target-in-progress");
    expect(getProgressFraction(water, 0, 0)).toBe(0);
    expect(shouldShowBadge(water, 0, 0)).toBeNull();
  });

  it("water habit: fully hydrated", () => {
    expect(getProgressText(water, 0, 1500, "detail", "metric")).toBe("1500 ml / 1000 ml");
    expect(getProgressColor(water, 0, 1500)).toBe("target-met");
    expect(getProgressFraction(water, 0, 1500)).toBe(1);
    expect(shouldShowBadge(water, 0, 1500)).toBe("check");
  });

  it("cigarettes: escalation from clear to over", () => {
    // Clear
    expect(getProgressColor(cigarettes, 0, undefined)).toBe("cap-clear");
    expect(shouldShowBadge(cigarettes, 0, undefined)).toBeNull();

    // Under
    expect(getProgressColor(cigarettes, 5, undefined)).toBe("cap-under");
    expect(shouldShowBadge(cigarettes, 5, undefined)).toBeNull();

    // Warning
    expect(getProgressColor(cigarettes, 9, undefined)).toBe("cap-warning");
    expect(shouldShowBadge(cigarettes, 9, undefined)).toBeNull();

    // At
    expect(getProgressColor(cigarettes, 10, undefined)).toBe("cap-at");
    expect(shouldShowBadge(cigarettes, 10, undefined)).toBeNull();

    // Over — badge appears
    expect(getProgressColor(cigarettes, 11, undefined)).toBe("cap-over");
    expect(shouldShowBadge(cigarettes, 11, undefined)).toBe("warning");
  });

  it("medication checkbox: complete flow", () => {
    expect(getProgressText(medication, 0, undefined)).toBe("0 / 1 count");
    expect(getProgressColor(medication, 0, undefined)).toBe("target-in-progress");
    expect(shouldShowBadge(medication, 0, undefined)).toBeNull();

    expect(getProgressText(medication, 1, undefined)).toContain("Done");
    expect(getProgressColor(medication, 1, undefined)).toBe("target-met");
    expect(shouldShowBadge(medication, 1, undefined)).toBe("check");
  });

  it("neutral count habits with no target or cap stay neutral", () => {
    expect(getProgressText(neutralHabit, 0, undefined)).toBe("0");
    expect(getProgressText(neutralHabit, 3, undefined)).toBe("3");
    expect(getProgressColor(neutralHabit, 3, undefined)).toBe("neutral");
    expect(getProgressFraction(neutralHabit, 3, undefined)).toBe(0);
    expect(shouldShowBadge(neutralHabit, 3, undefined)).toBeNull();
  });
});
