const MS_PER_DAY = 24 * 60 * 60 * 1000;

function floorMod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function daysToUtcDateKey(daysSinceEpoch: number): string {
  // Convert a day count relative to 1970-01-01 UTC into YYYY-MM-DD without
  // using Date mutation helpers. This keeps the helper deterministic across
  // runtimes and time zones.
  let z = daysSinceEpoch + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097; // [0, 146096]
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) /
      365,
  );
  let year = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp + (mp < 10 ? 3 : -9);
  if (month <= 2) {
    year += 1;
  }

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Compute the Monday 00:00:00 UTC start of the week containing `timestamp`.
 *
 * This uses pure epoch arithmetic so client and server code can share the same
 * boundary calculation without depending on local timezone behavior.
 */
export function getWeekStart(timestamp: number): {
  weekStart: string;
  weekStartTimestamp: number;
} {
  const dayNumber = Math.floor(timestamp / MS_PER_DAY);
  // 1970-01-01 was a Thursday. With Monday=0, Thursday maps to 3.
  const daysSinceMonday = floorMod(dayNumber + 3, 7);
  const weekStartDayNumber = dayNumber - daysSinceMonday;
  const weekStartTimestamp = weekStartDayNumber * MS_PER_DAY;

  return {
    weekStart: daysToUtcDateKey(weekStartDayNumber),
    weekStartTimestamp,
  };
}
