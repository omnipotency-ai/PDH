import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clampTimestamp, FIVE_YEARS_MS, ONE_DAY_MS } from "../usePanelTime";

const FIXED_NOW = new Date("2026-04-06T12:00:00Z").getTime();

describe("clampTimestamp", () => {
  beforeEach(() => {
    vi.spyOn(Date, "now").mockReturnValue(FIXED_NOW);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("passes through a timestamp within the valid range unchanged", () => {
    // A timestamp from yesterday — well within range
    const yesterday = FIXED_NOW - 24 * 60 * 60 * 1000;
    expect(clampTimestamp(yesterday)).toBe(yesterday);
  });

  it("passes through the current timestamp unchanged", () => {
    expect(clampTimestamp(FIXED_NOW)).toBe(FIXED_NOW);
  });

  it("passes through a timestamp exactly at the lower bound", () => {
    const lowerBound = FIXED_NOW - FIVE_YEARS_MS;
    expect(clampTimestamp(lowerBound)).toBe(lowerBound);
  });

  it("passes through a timestamp exactly at the upper bound", () => {
    const upperBound = FIXED_NOW + ONE_DAY_MS;
    expect(clampTimestamp(upperBound)).toBe(upperBound);
  });

  it("clamps a timestamp 1ms before the lower bound to now", () => {
    const tooOld = FIXED_NOW - FIVE_YEARS_MS - 1;
    expect(clampTimestamp(tooOld)).toBe(FIXED_NOW);
  });

  it("clamps a timestamp 1ms after the upper bound to now", () => {
    const tooFuture = FIXED_NOW + ONE_DAY_MS + 1;
    expect(clampTimestamp(tooFuture)).toBe(FIXED_NOW);
  });

  it("clamps epoch-0 (Unix origin) to now", () => {
    expect(clampTimestamp(0)).toBe(FIXED_NOW);
  });

  it("clamps a far-future timestamp (year 2100) to now", () => {
    const farFuture = new Date("2100-01-01T00:00:00Z").getTime();
    expect(clampTimestamp(farFuture)).toBe(FIXED_NOW);
  });

  it("logs a console.warn when the timestamp is too old", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const tooOld = FIXED_NOW - FIVE_YEARS_MS - 1;
    clampTimestamp(tooOld);
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0]?.[0]).toContain("5 years in the past");
  });

  it("logs a console.warn when the timestamp is too far in the future", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const tooFuture = FIXED_NOW + ONE_DAY_MS + 1;
    clampTimestamp(tooFuture);
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0]?.[0]).toContain("1 day in the future");
  });

  it("does not log a console.warn for valid timestamps", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    clampTimestamp(FIXED_NOW - 1000);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
