import { describe, expect, test } from "vitest";
import { computeDailyCounts } from "../BmFrequencyTile";
import { computeDailyAverages } from "../BristolTrendTile";
import { getCutoffTimestamp, getRecentDateKeys } from "../utils";

describe("hero day boundaries", () => {
  test("shared cutoff resolves to local midnight", () => {
    const nowMs = new Date(2026, 3, 6, 15, 30, 0).getTime();

    expect(getCutoffTimestamp(nowMs, 0)).toBe(new Date(2026, 3, 6, 0, 0, 0).getTime());
    expect(getCutoffTimestamp(nowMs, 7)).toBe(new Date(2026, 2, 30, 0, 0, 0).getTime());
    expect(getRecentDateKeys(nowMs, 2)).toEqual(["2026-04-05", "2026-04-06"]);
  });

  test("bm frequency counts only the matching calendar days", () => {
    const nowMs = new Date(2026, 3, 6, 15, 30, 0).getTime();

    expect(
      computeDailyCounts(
        [
          {
            timestamp: new Date(2026, 3, 4, 23, 59, 0).getTime(),
            episodesCount: 9,
          },
          {
            timestamp: new Date(2026, 3, 5, 23, 59, 0).getTime(),
            episodesCount: 2,
          },
          {
            timestamp: new Date(2026, 3, 6, 0, 1, 0).getTime(),
            episodesCount: 3,
          },
        ],
        2,
        nowMs,
      ),
    ).toEqual([
      { dateKey: "2026-04-05", count: 2 },
      { dateKey: "2026-04-06", count: 3 },
    ]);
  });

  test("bristol averages use the same calendar window", () => {
    const nowMs = new Date(2026, 3, 6, 15, 30, 0).getTime();

    expect(
      computeDailyAverages(
        [
          {
            timestamp: new Date(2026, 3, 5, 23, 59, 0).getTime(),
            bristolCode: 3,
          },
          {
            timestamp: new Date(2026, 3, 6, 0, 1, 0).getTime(),
            bristolCode: 5,
          },
        ],
        2,
        nowMs,
      ),
    ).toEqual([
      { dateKey: "2026-04-05", average: 3 },
      { dateKey: "2026-04-06", average: 5 },
    ]);
  });
});
