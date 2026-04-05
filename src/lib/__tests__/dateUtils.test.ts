import { describe, expect, it } from "vitest";
import { formatLocalDateKey, getDateScopedTimestamp } from "../dateUtils";

describe("formatLocalDateKey", () => {
  it("formats a local date as YYYY-MM-DD", () => {
    expect(formatLocalDateKey(new Date(2026, 3, 5, 14, 30))).toBe("2026-04-05");
  });
});

describe("getDateScopedTimestamp", () => {
  it("preserves the selected calendar date while applying the reference time", () => {
    const selectedDate = new Date(2026, 3, 2, 0, 0, 0, 0);
    const referenceTime = new Date(2026, 3, 5, 14, 23, 11, 450);

    const result = new Date(getDateScopedTimestamp(selectedDate, referenceTime));

    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(3);
    expect(result.getDate()).toBe(2);
    expect(result.getHours()).toBe(14);
    expect(result.getMinutes()).toBe(23);
    expect(result.getSeconds()).toBe(11);
    expect(result.getMilliseconds()).toBe(450);
  });
});
