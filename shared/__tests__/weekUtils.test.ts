import { describe, expect, it } from "vitest";
import { getWeekStart } from "../weekUtils";

describe("weekUtils", () => {
  it("returns Monday UTC week start for a midweek timestamp", () => {
    const timestamp = Date.UTC(2026, 3, 8, 14, 30, 0); // Wednesday
    const weekStart = getWeekStart(timestamp);
    expect(weekStart.weekStart).toBe("2026-04-06");
    expect(weekStart.weekStartTimestamp).toBe(Date.UTC(2026, 3, 6, 0, 0, 0));
  });

  it("returns the same week start for any day in the same UTC week", () => {
    const monday = getWeekStart(Date.UTC(2026, 3, 6, 0, 0, 0));
    const sunday = getWeekStart(Date.UTC(2026, 3, 12, 23, 59, 59));
    expect(sunday).toEqual(monday);
  });
});
